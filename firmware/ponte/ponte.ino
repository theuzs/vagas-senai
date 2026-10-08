/*
 * Ponte: recebe o estado dos bolsões da central por fio (Serial2) e publica no Supabase
 * pelo Wi-Fi do campus. Não participa do ESP-NOW. Se o Wi-Fi cair, continua lendo a
 * serial e mostrando o LCD; quando voltar, publica de novo.
 *
 * Protocolo serial (central -> ponte), 115200 8N1, uma linha por pacote de nó:
 *   $V,<id>,<estados>*<cs>\n
 *   id: A, C, H (1 a 8 letras/números); estados: 0 livre, 1 ocupada, um por vaga (1 a 500);
 *   cs: XOR dos bytes entre '$' e '*', dois dígitos hexadecimais maiúsculos.
 *
 * Placa: ESP32 Dev Module (esp32:esp32:esp32). Testado para compilar no core arduino-esp32 3.x.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <esp_task_wdt.h>
#include "config.h"

#if USAR_LCD
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(LCD_ENDERECO, 20, 4);
#endif

#if !defined(ESP_ARDUINO_VERSION_MAJOR) || ESP_ARDUINO_VERSION_MAJOR < 3
#include "esp_wpa2.h"
#endif

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

static const uint8_t  MAX_BOLSOES = 8;
static const uint16_t MAX_VAGAS = 500;
static const uint16_t LINHA_MAX = 600;
static const uint32_t WATCHDOG_S = 30;
static const uint32_t LIMITE_SEM_DADOS_MS = 30000;  // igual ao da página

struct Bolsao {
  char     id[9];
  char     estados[MAX_VAGAS + 1];
  uint16_t total;
  uint16_t livres;
  uint32_t ultimoQuadroMs;
  bool     usado;
};

static Bolsao bolsoes[MAX_BOLSOES];
static char   linha[LINHA_MAX + 1];
static size_t linhaLen = 0;

static uint32_t ultimoEnvioMs = 0;
static uint32_t ultimoEnvioOkMs = 0;
static bool     ultimoEnvioOk = false;
static int      ultimoCodigoHttp = 0;
static uint32_t linhasDescartadas = 0;
static uint32_t desconectadoDesdeMs = 0;
static uint32_t proximaTentativaWifiMs = 0;
static uint32_t esperaWifiMs = 30000;

static WiFiClientSecure tls;
static HTTPClient http;

// ---------------------------------------------------------------------------
// Wi-Fi (nunca bloqueia o loop)
// ---------------------------------------------------------------------------

static void conectarWifi() {
  WiFi.disconnect(true, false);
  delay(50);
  if (strlen(WIFI_USUARIO) > 0) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
    WiFi.begin(WIFI_SSID, WPA2_AUTH_PEAP, WIFI_USUARIO, WIFI_USUARIO, WIFI_SENHA);
#else
    esp_wifi_sta_wpa2_ent_set_identity((uint8_t*)WIFI_USUARIO, strlen(WIFI_USUARIO));
    esp_wifi_sta_wpa2_ent_set_username((uint8_t*)WIFI_USUARIO, strlen(WIFI_USUARIO));
    esp_wifi_sta_wpa2_ent_set_password((uint8_t*)WIFI_SENHA, strlen(WIFI_SENHA));
    esp_wifi_sta_wpa2_ent_enable();
    WiFi.begin(WIFI_SSID);
#endif
  } else {
    WiFi.begin(WIFI_SSID, WIFI_SENHA);
  }
  Serial.printf("[wifi] conectando em %s\n", WIFI_SSID);
}

static void cuidarWifi() {
  uint32_t agora = millis();
  if (WiFi.status() == WL_CONNECTED) {
    if (desconectadoDesdeMs != 0) {
      Serial.printf("[wifi] conectado, IP %s\n", WiFi.localIP().toString().c_str());
      desconectadoDesdeMs = 0;
      esperaWifiMs = 30000;
    }
    return;
  }
  if (desconectadoDesdeMs == 0) {
    desconectadoDesdeMs = agora;
    proximaTentativaWifiMs = agora + esperaWifiMs;
    return;
  }
  // O auto-reconnect do core tenta sozinho. Se passar da espera, refaz o begin com espera crescente.
  if ((int32_t)(agora - proximaTentativaWifiMs) >= 0) {
    Serial.printf("[wifi] sem conexão há %lu s, tentando de novo\n", (unsigned long)((agora - desconectadoDesdeMs) / 1000));
    conectarWifi();
    esperaWifiMs = min<uint32_t>(esperaWifiMs * 2, 300000);
    proximaTentativaWifiMs = agora + esperaWifiMs;
  }
}

// ---------------------------------------------------------------------------
// Serial vinda da central
// ---------------------------------------------------------------------------

static Bolsao* acharOuCriar(const char* id) {
  for (uint8_t i = 0; i < MAX_BOLSOES; i++) {
    if (bolsoes[i].usado && strcmp(bolsoes[i].id, id) == 0) return &bolsoes[i];
  }
  for (uint8_t i = 0; i < MAX_BOLSOES; i++) {
    if (!bolsoes[i].usado) {
      bolsoes[i].usado = true;
      strncpy(bolsoes[i].id, id, sizeof(bolsoes[i].id) - 1);
      return &bolsoes[i];
    }
  }
  return nullptr;
}

static bool hexParaByte(const char* h, uint8_t& saida) {
  uint8_t v = 0;
  for (int i = 0; i < 2; i++) {
    char c = h[i];
    v <<= 4;
    if (c >= '0' && c <= '9') v |= c - '0';
    else if (c >= 'A' && c <= 'F') v |= c - 'A' + 10;
    else return false;
  }
  saida = v;
  return true;
}

// Linha completa, sem o '\n'. Devolve false se for inválida.
static bool processarLinha(char* l, size_t n) {
  if (n < 8 || l[0] != '$' || l[1] != 'V' || l[2] != ',') return false;
  char* ast = strrchr(l, '*');
  if (!ast || (size_t)(ast - l) != n - 3) return false;
  uint8_t csInformado;
  if (!hexParaByte(ast + 1, csInformado)) return false;
  uint8_t cs = 0;
  for (char* p = l + 1; p < ast; p++) cs ^= (uint8_t)*p;
  if (cs != csInformado) return false;

  *ast = '\0';
  char* id = l + 3;
  char* virgula = strchr(id, ',');
  if (!virgula) return false;
  *virgula = '\0';
  char* estados = virgula + 1;
  size_t idLen = strlen(id);
  if (idLen < 1 || idLen > 8) return false;
  for (size_t i = 0; i < idLen; i++) {
    if (!((id[i] >= 'A' && id[i] <= 'Z') || (id[i] >= '0' && id[i] <= '9'))) return false;
  }
  size_t total = strlen(estados);
  if (total < 1 || total > MAX_VAGAS) return false;
  uint16_t livres = 0;
  for (size_t i = 0; i < total; i++) {
    if (estados[i] == '0') livres++;
    else if (estados[i] != '1') return false;
  }

  Bolsao* b = acharOuCriar(id);
  if (!b) return false;
  memcpy(b->estados, estados, total + 1);
  b->total = total;
  b->livres = livres;
  b->ultimoQuadroMs = millis();
  return true;
}

static void lerSerial() {
  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\n') {
      linha[linhaLen] = '\0';
      size_t n = linhaLen;
      if (n > 0 && linha[n - 1] == '\r') linha[--n] = '\0';
      if (!processarLinha(linha, n)) {
        linhasDescartadas++;
        Serial.printf("[serial] linha descartada (%lu no total)\n", (unsigned long)linhasDescartadas);
      }
      linhaLen = 0;
    } else if (linhaLen < LINHA_MAX) {
      linha[linhaLen++] = c;
    } else {
      // Linha grande demais: descarta até o próximo '\n'.
      linhaLen = 0;
      linhasDescartadas++;
    }
  }
}

// ---------------------------------------------------------------------------
// Publicação no Supabase
// ---------------------------------------------------------------------------

// Monta {"p_token":"...","p_bolsoes":{"A":"0101",...}} só com os bolsões frescos.
// Bolsão sem quadro recente fica de fora: assim ele envelhece no banco e vira SEM DADOS na página.
static size_t montarPayload(char* saida, size_t cap, uint8_t& quantos) {
  uint32_t agora = millis();
  size_t pos = snprintf(saida, cap, "{\"p_token\":\"%s\",\"p_bolsoes\":{", TOKEN_CENTRAL);
  quantos = 0;
  for (uint8_t i = 0; i < MAX_BOLSOES && pos < cap; i++) {
    Bolsao& b = bolsoes[i];
    if (!b.usado || b.total == 0) continue;
    if (agora - b.ultimoQuadroMs > FRESCOR_NO_MS) continue;
    pos += snprintf(saida + pos, cap - pos, "%s\"%s\":\"%s\"", quantos ? "," : "", b.id, b.estados);
    quantos++;
  }
  pos += snprintf(saida + pos, cap - pos, "}}");
  return pos < cap ? pos : cap - 1;
}

static void publicar() {
  if (WiFi.status() != WL_CONNECTED) return;

  // ~120 bytes de cabeçalho + até 8 bolsões de 500 vagas.
  static char payload[160 + MAX_BOLSOES * (MAX_VAGAS + 16)];
  uint8_t quantos = 0;
  size_t tam = montarPayload(payload, sizeof(payload), quantos);

  const String url = String(SUPABASE_URL) + "/rest/v1/rpc/publicar";
  http.setReuse(true);          // mantém a conexão TLS entre ciclos: handshake só na primeira vez
  http.setTimeout(5000);
  if (!http.begin(tls, url)) {
    Serial.println("[http] begin falhou");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Profile", "vagas");

  uint32_t t0 = millis();
  int codigo = http.POST((uint8_t*)payload, tam);
  ultimoCodigoHttp = codigo;
  if (codigo == 200) {
    ultimoEnvioOk = true;
    ultimoEnvioOkMs = millis();
    Serial.printf("[http] ok, %u bolsões em %lu ms\n", quantos, (unsigned long)(millis() - t0));
  } else if (codigo == 401 || codigo == 403) {
    ultimoEnvioOk = false;
    Serial.printf("[http] token recusado (%d): confira TOKEN_CENTRAL e a tabela vagas.centrais\n", codigo);
  } else if (codigo > 0) {
    ultimoEnvioOk = false;
    Serial.printf("[http] erro %d: %s\n", codigo, http.getString().c_str());
  } else {
    ultimoEnvioOk = false;
    Serial.printf("[http] falha de rede: %s\n", HTTPClient::errorToString(codigo).c_str());
  }
  http.end();  // com setReuse(true) a conexão fica aberta para o próximo ciclo
}

// ---------------------------------------------------------------------------
// LCD (opcional)
// ---------------------------------------------------------------------------

#if USAR_LCD
static void desenharLcd() {
  uint32_t agora = millis();
  char l[21];
  uint8_t linhaLcd = 0;
  for (uint8_t i = 0; i < MAX_BOLSOES && linhaLcd < 3; i++) {
    Bolsao& b = bolsoes[i];
    if (!b.usado) continue;
    if (agora - b.ultimoQuadroMs > LIMITE_SEM_DADOS_MS) {
      snprintf(l, sizeof(l), "%-3s SEM DADOS       ", b.id);
    } else if (b.livres == 0) {
      snprintf(l, sizeof(l), "%-3s LOTADO          ", b.id);
    } else {
      snprintf(l, sizeof(l), "%-3s %3u livres/%3u  ", b.id, b.livres, b.total);
    }
    l[20] = '\0';
    lcd.setCursor(0, linhaLcd++);
    lcd.print(l);
  }
  while (linhaLcd < 3) {
    lcd.setCursor(0, linhaLcd++);
    lcd.print("                    ");
  }
  if (WiFi.status() != WL_CONNECTED) {
    snprintf(l, sizeof(l), "WiFi: sem rede      ");
  } else if (ultimoEnvioOk) {
    snprintf(l, sizeof(l), "WiFi ok  envio %3lus ", (unsigned long)((agora - ultimoEnvioOkMs) / 1000));
  } else {
    snprintf(l, sizeof(l), "WiFi ok  envio erro ");
  }
  l[20] = '\0';
  lcd.setCursor(0, 3);
  lcd.print(l);
}
#endif

// ---------------------------------------------------------------------------
// Setup e loop
// ---------------------------------------------------------------------------

static void ligarWatchdog() {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t cfg = {};
  cfg.timeout_ms = WATCHDOG_S * 1000;
  cfg.idle_core_mask = 0;
  cfg.trigger_panic = true;
  if (esp_task_wdt_init(&cfg) != ESP_OK) esp_task_wdt_reconfigure(&cfg);
#else
  esp_task_wdt_init(WATCHDOG_S, true);
#endif
  esp_task_wdt_add(NULL);
}

void setup() {
  Serial.begin(115200);
  Serial2.setRxBufferSize(8192);  // aguenta a serial enquanto um POST lento bloqueia
  Serial2.begin(115200, SERIAL_8N1, PINO_RX_CENTRAL, PINO_TX_CENTRAL);
  memset(bolsoes, 0, sizeof(bolsoes));

#if USAR_LCD
  Wire.begin(PINO_SDA, PINO_SCL);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Vagas SENAI");
  lcd.setCursor(0, 1);
  lcd.print("iniciando...");
#endif

  // Protótipo: aceita qualquer certificado. Na versão final, troque por uma destas linhas:
  //   tls.setCACertBundle(x509_crt_imported_bundle_bin_start);   // pacote de raízes do core (recomendado)
  //   tls.setCACert(CERTIFICADO_RAIZ_PEM);                        // só a raiz que assina *.supabase.co
  tls.setInsecure();

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  conectarWifi();

  ligarWatchdog();
  Serial.println("[ponte] pronta");
}

void loop() {
  esp_task_wdt_reset();
  lerSerial();
  cuidarWifi();

  uint32_t agora = millis();
  if (agora - ultimoEnvioMs >= INTERVALO_PUBLICAR_MS) {
    ultimoEnvioMs = agora;
    publicar();
  }

#if USAR_LCD
  static uint32_t ultimoLcdMs = 0;
  if (agora - ultimoLcdMs >= 1000) {
    ultimoLcdMs = agora;
    desenharLcd();
  }
#endif

  delay(5);
}
