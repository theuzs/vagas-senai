// Bolsão com sensores + envio para o Supabase, em um arquivo só.
// O ESP32 entra no Wi-Fi do campus, lê um sensor por vaga e publica o estado
// a cada 10 s em vagas.publicar. A página local (192.168.4.1) continua existindo
// como apoio, se MANTER_PAGINA_LOCAL for 1.
//
// Placa: ESP32 Dev Module. Compilado no core arduino-esp32 3.x.
// Preencha as linhas de configuração e grave um por bolsão (ID_BOLSAO "A", "C", "H").

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <esp_task_wdt.h>

// ================= CONFIGURAÇÃO (muda por bolsão) =================
const char* ID_BOLSAO   = "A";            // "A", "C" ou "H" (tem que existir em vagas.bolsoes)
const char* NOME_BOLSAO = "Bloco A";
const int   N_VAGAS     = 5;
const int   PINO_VAGA[N_VAGAS] = {32, 33, 34, 35, 25};

// Wi-Fi do campus. Rede com usuário e senha (WPA2-Enterprise): preencha WIFI_USUARIO.
// Rede só com senha: deixe WIFI_USUARIO = "".
const char* WIFI_SSID    = "NOME-DA-REDE";
const char* WIFI_SENHA   = "senha-da-rede";
const char* WIFI_USUARIO = "";

// Supabase. URL e chave anon podem ficar aqui (a anon só lê e chama publicar).
const char* SUPABASE_URL      = "https://xxxxxxxxxxxx.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJ...";
// Token deste bolsão, de `npm run token:gerar -- bolsao-a "Bolsão A"`. Este não pode vazar:
// não faça commit do arquivo com o token preenchido.
const char* TOKEN_CENTRAL = "cole-aqui-o-token";

const unsigned long INTERVALO_PUBLICAR_MS = 10000;   // 5 a 10 s (handshake TLS leva ~2 s)

// Página local no softAP "Estacionamento-A" (opcional). 1 liga, 0 desliga.
#define MANTER_PAGINA_LOCAL 1
const char* AP_SSID  = "Estacionamento-A";
const char* AP_SENHA = "vagas1234";       // mínimo 8 caracteres
// ===================================================================

bool estado[N_VAGAS]   = {false};
int  contagem[N_VAGAS] = {0};
unsigned long ultimaLeitura = 0;
unsigned long ultimoEnvio   = 0;
unsigned long ultimoEnvioOk = 0;
bool  envioOk = false;
int   ultimoCodigoHttp = 0;
unsigned long desconectadoDesde = 0;
unsigned long proximaTentativaWifi = 0;
unsigned long esperaWifi = 30000;

WiFiClientSecure tls;
HTTPClient http;
#if MANTER_PAGINA_LOCAL
WebServer server(80);
#endif

// ---------------- sensores (igual ao original) ----------------

void lerVagas() {
  for (int i = 0; i < N_VAGAS; i++) {
    bool bruto = !digitalRead(PINO_VAGA[i]);  // LOW = reflexo = ocupada
    if (bruto != estado[i]) {
      contagem[i]++;
      if (contagem[i] >= 3) {
        estado[i] = bruto;
        contagem[i] = 0;
      }
    } else {
      contagem[i] = 0;
    }
  }
}

int contarLivres() {
  int livres = 0;
  for (int i = 0; i < N_VAGAS; i++) if (!estado[i]) livres++;
  return livres;
}

// ---------------- Wi-Fi do campus (nunca trava o loop) ----------------

void conectarWifi() {
  if (strlen(WIFI_USUARIO) > 0) {
    WiFi.begin(WIFI_SSID, WPA2_AUTH_PEAP, WIFI_USUARIO, WIFI_USUARIO, WIFI_SENHA);
  } else {
    WiFi.begin(WIFI_SSID, WIFI_SENHA);
  }
  Serial.print("[wifi] conectando em "); Serial.println(WIFI_SSID);
}

void cuidarWifi() {
  unsigned long agora = millis();
  if (WiFi.status() == WL_CONNECTED) {
    if (desconectadoDesde != 0) {
      Serial.print("[wifi] conectado, IP "); Serial.println(WiFi.localIP());
      desconectadoDesde = 0;
      esperaWifi = 30000;
    }
    return;
  }
  if (desconectadoDesde == 0) {
    desconectadoDesde = agora;
    proximaTentativaWifi = agora + esperaWifi;
    return;
  }
  // O auto-reconnect do core tenta sozinho. Passada a espera, refaz o begin com espera crescente.
  if ((long)(agora - proximaTentativaWifi) >= 0) {
    Serial.print("[wifi] sem conexão há "); Serial.print((agora - desconectadoDesde) / 1000); Serial.println(" s, tentando de novo");
    WiFi.disconnect(false, false);
    delay(50);
    conectarWifi();
    esperaWifi = min(esperaWifi * 2, 300000UL);
    proximaTentativaWifi = agora + esperaWifi;
  }
}

// ---------------- Supabase ----------------

// {"p_token":"...","p_bolsoes":{"A":"01001"}}   0 = livre, 1 = ocupada
String montarPayload() {
  String s = "{\"p_token\":\"";
  s += TOKEN_CENTRAL;
  s += "\",\"p_bolsoes\":{\"";
  s += ID_BOLSAO;
  s += "\":\"";
  for (int i = 0; i < N_VAGAS; i++) s += estado[i] ? '1' : '0';
  s += "\"}}";
  return s;
}

void publicar() {
  if (WiFi.status() != WL_CONNECTED) return;

  String url = String(SUPABASE_URL) + "/rest/v1/rpc/publicar";
  http.setReuse(true);     // mantém a conexão TLS aberta entre envios
  http.setTimeout(5000);
  if (!http.begin(tls, url)) {
    Serial.println("[http] begin falhou");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Profile", "vagas");

  unsigned long t0 = millis();
  int codigo = http.POST(montarPayload());
  ultimoCodigoHttp = codigo;
  if (codigo == 200) {
    envioOk = true;
    ultimoEnvioOk = millis();
    Serial.print("[http] ok, "); Serial.print(contarLivres()); Serial.print(" livres, ");
    Serial.print(millis() - t0); Serial.println(" ms");
  } else if (codigo == 401 || codigo == 403) {
    envioOk = false;
    Serial.print("[http] token recusado ("); Serial.print(codigo); Serial.println("): confira TOKEN_CENTRAL e vagas.centrais");
  } else if (codigo > 0) {
    envioOk = false;
    Serial.print("[http] erro "); Serial.print(codigo); Serial.print(": "); Serial.println(http.getString());
  } else {
    envioOk = false;
    Serial.print("[http] falha de rede: "); Serial.println(HTTPClient::errorToString(codigo));
  }
  http.end();
}

// ---------------- página local (opcional) ----------------

#if MANTER_PAGINA_LOCAL
const char PAGINA[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vagas do Estacionamento</title>
<style>
  :root { --bg:#0f1419; --card:#1a212b; --texto:#e8edf2; --suave:#8a96a3; --livre:#22c55e; --ocupada:#ef4444; --offline:#f59e0b; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:system-ui,-apple-system,"Segoe UI",sans-serif; background:var(--bg); color:var(--texto); min-height:100vh; padding:24px 16px; display:flex; flex-direction:column; align-items:center; }
  header { text-align:center; margin-bottom:24px; }
  header h1 { font-size:1.4rem; font-weight:600; }
  header p { color:var(--suave); font-size:.9rem; margin-top:4px; }
  .resumo { background:var(--card); border-radius:20px; padding:24px 40px; text-align:center; margin-bottom:28px; border:2px solid var(--livre); transition:border-color .3s; }
  .resumo.lotado { border-color:var(--ocupada); }
  .resumo.offline { border-color:var(--offline); }
  .resumo .numero { font-size:4rem; font-weight:700; line-height:1; }
  .resumo .rotulo { color:var(--suave); margin-top:6px; }
  .patio { width:100%; max-width:640px; display:grid; grid-template-columns:repeat(auto-fit,minmax(100px,1fr)); gap:12px; }
  .vaga { background:var(--card); border-radius:14px; padding:20px 8px; text-align:center; border:2px solid transparent; transition:all .3s; }
  .vaga .num { font-size:.8rem; color:var(--suave); margin-bottom:8px; }
  .vaga .icone { font-size:2rem; margin-bottom:8px; }
  .vaga .status { font-weight:600; font-size:.9rem; }
  .vaga.livre { border-color:var(--livre); }
  .vaga.livre .status { color:var(--livre); }
  .vaga.ocupada { border-color:var(--ocupada); background:#2a1a1d; }
  .vaga.ocupada .status { color:var(--ocupada); }
  .patio.offline .vaga { opacity:.35; }
  .rodape { margin-top:28px; color:var(--suave); font-size:.8rem; display:flex; align-items:center; gap:8px; }
  .ponto { width:10px; height:10px; border-radius:50%; background:var(--livre); }
  .ponto.offline { background:var(--offline); }
</style>
</head>
<body>
  <header><h1 id="titulo">Estacionamento</h1><p>Vagas em tempo real</p></header>
  <div class="resumo" id="resumo"><div class="numero" id="livres">--</div><div class="rotulo" id="rotulo">vagas livres</div></div>
  <div class="patio" id="patio"></div>
  <div class="rodape"><span class="ponto" id="ponto"></span><span id="atualizado">Conectando...</span></div>
<script>
  const patio=document.getElementById('patio'),resumo=document.getElementById('resumo'),ponto=document.getElementById('ponto');
  let ultimoOk=0;
  function desenhar(d){
    document.getElementById('titulo').textContent=d.nome;
    document.getElementById('livres').textContent=d.livres;
    document.getElementById('rotulo').textContent=d.livres===1?'vaga livre':'vagas livres';
    resumo.classList.toggle('lotado',d.livres===0);
    patio.innerHTML='';
    d.vagas.forEach((ocupada,i)=>{
      const el=document.createElement('div');
      el.className='vaga '+(ocupada?'ocupada':'livre');
      el.innerHTML='<div class="num">Vaga '+(i+1)+'</div><div class="icone">'+(ocupada?'🚗':'🅿️')+'</div><div class="status">'+(ocupada?'Ocupada':'Livre')+'</div>';
      patio.appendChild(el);
    });
    document.getElementById('atualizado').textContent=d.nuvem?'Atualizando ao vivo · enviando para a nuvem':'Atualizando ao vivo · sem nuvem';
  }
  async function atualizar(){
    try{
      const r=await fetch('/status',{cache:'no-store'});const d=await r.json();desenhar(d);
      ultimoOk=Date.now();patio.classList.remove('offline');resumo.classList.remove('offline');ponto.classList.remove('offline');
    }catch(e){
      patio.classList.add('offline');resumo.classList.add('offline');ponto.classList.add('offline');
      const s=ultimoOk?Math.round((Date.now()-ultimoOk)/1000):null;
      document.getElementById('atualizado').textContent=s===null?'Sem conexão com o sensor':'Sem conexão há '+s+'s';
    }
  }
  atualizar();setInterval(atualizar,1000);
</script>
</body>
</html>
)rawliteral";

void paginaInicial() { server.send(200, "text/html", PAGINA); }

void statusJson() {
  String json = "{\"bolsao\":\"" + String(ID_BOLSAO) + "\"";
  json += ",\"nome\":\"" + String(NOME_BOLSAO) + "\"";
  json += ",\"vagas\":[";
  for (int i = 0; i < N_VAGAS; i++) {
    json += estado[i] ? "true" : "false";
    if (i < N_VAGAS - 1) json += ",";
  }
  json += "],\"livres\":" + String(contarLivres());
  json += ",\"nuvem\":" + String(envioOk && millis() - ultimoEnvioOk < 30000 ? "true" : "false");
  json += ",\"http\":" + String(ultimoCodigoHttp) + "}";
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}
#endif

// ---------------- setup e loop ----------------

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < N_VAGAS; i++) pinMode(PINO_VAGA[i], INPUT);

  // Protótipo: aceita qualquer certificado. Na versão final, troque por:
  //   tls.setCACertBundle(x509_crt_imported_bundle_bin_start);   // pacote de raízes do core
  tls.setInsecure();

#if MANTER_PAGINA_LOCAL
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_SENHA);
  Serial.print("Rede local: "); Serial.print(AP_SSID); Serial.print("  http://"); Serial.println(WiFi.softAPIP());
  server.on("/", paginaInicial);
  server.on("/status", statusJson);
  server.begin();
#else
  WiFi.mode(WIFI_STA);
#endif
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  conectarWifi();

  // Se o loop travar por 30 s, a placa reinicia sozinha.
  esp_task_wdt_config_t cfg = {};
  cfg.timeout_ms = 30000;
  cfg.trigger_panic = true;
  if (esp_task_wdt_init(&cfg) != ESP_OK) esp_task_wdt_reconfigure(&cfg);
  esp_task_wdt_add(NULL);

  Serial.print("[bolsao] "); Serial.print(NOME_BOLSAO); Serial.print(" pronto, MAC "); Serial.println(WiFi.macAddress());
}

void loop() {
  esp_task_wdt_reset();
#if MANTER_PAGINA_LOCAL
  server.handleClient();
#endif
  cuidarWifi();

  unsigned long agora = millis();
  if (agora - ultimaLeitura >= 100) {
    ultimaLeitura = agora;
    lerVagas();
  }

  // O POST pode segurar o loop por até 5 s (timeout). A leitura dos sensores
  // pausa nesse tempo; com o filtro de 3 leituras isso não muda nenhum estado.
  if (agora - ultimoEnvio >= INTERVALO_PUBLICAR_MS) {
    ultimoEnvio = agora;
    publicar();
  }
}
