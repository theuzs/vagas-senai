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
#include <esp_system.h>

#if !defined(ESP_ARDUINO_VERSION_MAJOR) || ESP_ARDUINO_VERSION_MAJOR < 3
#error "Este código precisa da placa esp32 versão 3.x. No Arduino IDE: Ferramentas > Placa > Gerenciador de Placas > esp32 (Espressif) > instale a 3.3.x."
#endif

// ================= CONFIGURAÇÃO (muda por bolsão) =================
const char* ID_BOLSAO   = "A";            // "A", "C" ou "H" (tem que existir em vagas.bolsoes)
const char* NOME_BOLSAO = "Bloco A";
const int   PINO_VAGA[] = {32, 33, 34, 35, 25};   // um pino por vaga, na ordem das vagas

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

// Data da última mudança deste arquivo. Aparece no monitor serial e na página local.
const char* VERSAO_FIRMWARE = "2026-10-15";

// Uma vaga por pino listado. Não há número para conferir: a lista é a configuração.
const int N_VAGAS = sizeof(PINO_VAGA) / sizeof(PINO_VAGA[0]);

bool estado[N_VAGAS]   = {false};
int  contagem[N_VAGAS] = {0};
// Para testar os sensores pela página local: quando cada vaga mudou e quantas vezes no minuto.
unsigned long mudouEm[N_VAGAS] = {0};   // millis() da última troca; 0 = nunca
int  trocas[N_VAGAS] = {0};             // trocas no minuto atual
unsigned long inicioMinuto = 0;
const int LIMITE_TROCAS_MIN = 12;       // a partir daqui a vaga é "instável"
unsigned long ultimaLeitura = 0;
unsigned long ultimoEnvio   = 0;
unsigned long ultimoEnvioOk = 0;
bool  envioOk = false;
// Erro de configuração que impede o envio (pino inválido). Vazio = tudo certo.
String erroConfig = "";
unsigned long ultimoAvisoConfig = 0;
int   ultimoCodigoHttp = 0;
// Resultado do último envio, classificado. Vai para o monitor serial e para o /status.
enum SituacaoEnvio { ENVIO_NENHUM, ENVIO_OK, ENVIO_CHAVE, ENVIO_TOKEN, ENVIO_DADOS, ENVIO_FUNCAO, ENVIO_SCHEMA, ENVIO_PORTAL, ENVIO_SEM_INTERNET, ENVIO_OUTRO };
SituacaoEnvio situacaoEnvio = ENVIO_NENHUM;
bool tentouDesdeConexao = false;   // já houve um envio desde que o Wi-Fi conectou
unsigned long desconectadoDesde = 0;
unsigned long proximaTentativaWifi = 0;
unsigned long esperaWifi = 30000;
// Motivo da última desconexão do Wi-Fi (código do ESP-IDF), guardado pelo evento e lido no loop.
volatile int motivoDesconexao = 0;
int motivoImpresso = 0;
String motivoWifi = "";          // texto do motivo, para o monitor serial e o /status
String textoReinicio = "";       // por que a placa ligou, de esp_reset_reason()
unsigned long ultimoAvisoSinal = 0;
// Valores de exemplo no topo do arquivo. Com algum, a placa não tenta o Wi-Fi nem o envio.
bool faltaConfig = false;
unsigned long ultimoAvisoFalta = 0;

WiFiClientSecure tls;
HTTPClient http;
#if MANTER_PAGINA_LOCAL
#include <DNSServer.h>
WebServer server(80);
DNSServer dns;   // responde todo nome com 192.168.4.1: o celular abre a página sozinho
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
        mudouEm[i] = millis();
        trocas[i]++;
        Serial.print("[vaga] "); Serial.print(i + 1); Serial.print(" (GPIO "); Serial.print(PINO_VAGA[i]); Serial.print(") ");
        Serial.println(bruto ? "ocupada" : "livre");
      }
    } else {
      contagem[i] = 0;
    }
  }
}

// Confere PINO_VAGA na partida. Pino inexistente, da flash, da serial ou repetido
// impede o envio: o site mostra SEM DADOS em vez de um número inventado.
void conferirPinos() {
  for (int i = 0; i < N_VAGAS; i++) {
    int g = PINO_VAGA[i];
    String motivo = "";
    if (g < 0 || g == 20 || g == 24 || (g >= 28 && g <= 31) || g > 39) motivo = "que não existe no ESP32";
    else if (g >= 6 && g <= 11) motivo = "que é da memória flash";
    else if (g == 1 || g == 3) motivo = "que é da porta serial";
    else {
      for (int j = 0; j < i; j++) {
        if (PINO_VAGA[j] == g) { motivo = "igual à vaga " + String(j + 1); break; }
      }
    }
    if (motivo.length() > 0) {
      if (erroConfig.length() == 0) {
        erroConfig = "A vaga " + String(i + 1) + " usa o GPIO " + String(g) + ", " + motivo + ". Troque em PINO_VAGA.";
      }
      continue;
    }
    if (g == 0 || g == 2 || g == 5 || g == 12 || g == 15) {
      Serial.print("[config] A vaga "); Serial.print(i + 1); Serial.print(" usa o GPIO "); Serial.print(g);
      Serial.println(", que pode atrapalhar a partida da placa.");
    }
    pinMode(g, INPUT);
  }
}

// Fecha o minuto: avisa das vagas instáveis e zera as contagens.
void fecharMinuto() {
  for (int i = 0; i < N_VAGAS; i++) {
    if (trocas[i] >= LIMITE_TROCAS_MIN) {
      Serial.print("[vaga] A vaga "); Serial.print(i + 1); Serial.print(" (GPIO "); Serial.print(PINO_VAGA[i]); Serial.print(") trocou ");
      Serial.print(trocas[i]); Serial.println(" vezes neste minuto. Confira o fio e o alinhamento do sensor.");
    }
    trocas[i] = 0;
  }
}

int contarLivres() {
  int livres = 0;
  for (int i = 0; i < N_VAGAS; i++) if (!estado[i]) livres++;
  return livres;
}

// ---------------- Wi-Fi do campus (nunca trava o loop) ----------------

const char* classeSinal(int rssi) {
  if (rssi >= -67) return "bom";
  if (rssi >= -80) return "fraco";
  return "muito fraco";
}

// O callback roda em outra tarefa: só guarda o código. O loop imprime.
void aoDesconectar(arduino_event_id_t evento, arduino_event_info_t info) {
  motivoDesconexao = info.wifi_sta_disconnected.reason;
}

String traduzirMotivo(int codigo) {
  String rede = String(WIFI_SSID);
  switch (codigo) {
    case 201: return "a rede " + rede + " não foi encontrada. Confira o nome. A placa só pega 2,4 GHz";
    case 210: return "a rede " + rede + " usa outro tipo de segurança. Se ela pede usuário, preencha WIFI_USUARIO";
    case 211: return "a rede " + rede + " é aberta ou usa segurança antiga. Se ela não pede senha, deixe WIFI_SENHA = \"\"";
    case 15: case 23: case 202: case 204:
      return strlen(WIFI_USUARIO) > 0 ? "a rede recusou o usuário ou a senha" : "a rede recusou a senha";
    case 200: return "o sinal da rede sumiu";
    case 212: return "o sinal está fraco demais";
    default: return "a conexão falhou (código " + String(codigo) + ")";
  }
}

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
      int rssi = WiFi.RSSI();
      Serial.print("[wifi] conectado em "); Serial.print(WIFI_SSID); Serial.print(", IP "); Serial.print(WiFi.localIP());
      Serial.print(", sinal "); Serial.print(rssi); Serial.print(" dBm ("); Serial.print(classeSinal(rssi)); Serial.println(")");
      desconectadoDesde = 0;
      esperaWifi = 30000;
      tentouDesdeConexao = false;
      motivoImpresso = 0;
      motivoDesconexao = 0;
      motivoWifi = "";
    }
    if (agora - ultimoAvisoSinal >= 60000) {
      ultimoAvisoSinal = agora;
      int rssi = WiFi.RSSI();
      if (rssi < -80) {
        Serial.print("[wifi] sinal muito fraco ("); Serial.print(rssi); Serial.println(" dBm). Aproxime a placa do roteador ou use antena externa.");
      }
    }
    return;
  }
  if (desconectadoDesde == 0) {
    desconectadoDesde = agora;
    proximaTentativaWifi = agora + esperaWifi;
  }
  int motivo = motivoDesconexao;
  if (motivo != 0 && motivo != motivoImpresso) {
    motivoImpresso = motivo;
    motivoWifi = traduzirMotivo(motivo);
    Serial.print("[wifi] não conectou: "); Serial.print(motivoWifi); Serial.print(". A placa tenta de novo em ");
    Serial.print(esperaWifi / 1000); Serial.println(" s.");
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

// ---------------- partida ----------------

String motivoDoReinicio() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON: return "ligou na energia";
    case ESP_RST_BROWNOUT: return "a tensão caiu. Confira a fonte e o cabo.";
    case ESP_RST_TASK_WDT: case ESP_RST_INT_WDT: case ESP_RST_WDT: return "travou e o watchdog reiniciou";
    case ESP_RST_PANIC: return "erro no programa";
    case ESP_RST_SW: return "reiniciada pelo programa";
    default: return "código " + String((int)esp_reset_reason());
  }
}

// Campos ainda com o valor de exemplo. Uma linha por campo, repetida a cada 10 s.
void avisarFaltaConfig() {
  if (strcmp(WIFI_SSID, "NOME-DA-REDE") == 0) Serial.println("[config] Falta preencher WIFI_SSID no topo do arquivo.");
  if (strcmp(WIFI_SENHA, "senha-da-rede") == 0) Serial.println("[config] Falta preencher WIFI_SENHA no topo do arquivo. Se a rede não pede senha, deixe WIFI_SENHA = \"\".");
  if (strncmp(TOKEN_CENTRAL, "cole-aqui", 9) == 0) Serial.println("[config] Falta preencher TOKEN_CENTRAL no topo do arquivo.");
  if (strstr(SUPABASE_URL, "xxxxxxxx") != NULL) Serial.println("[config] Falta preencher SUPABASE_URL no topo do arquivo.");
  if (strcmp(SUPABASE_ANON_KEY, "eyJ...") == 0) Serial.println("[config] Falta preencher SUPABASE_ANON_KEY no topo do arquivo.");
}

bool temValorDeExemplo() {
  return strcmp(WIFI_SSID, "NOME-DA-REDE") == 0 || strcmp(WIFI_SENHA, "senha-da-rede") == 0 ||
         strncmp(TOKEN_CENTRAL, "cole-aqui", 9) == 0 || strstr(SUPABASE_URL, "xxxxxxxx") != NULL ||
         strcmp(SUPABASE_ANON_KEY, "eyJ...") == 0;
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

// Texto para os códigos negativos do HTTPClient.
String textoErroRede(int codigo) {
  if (codigo == HTTPC_ERROR_CONNECTION_REFUSED) return "não conectou";
  if (codigo == HTTPC_ERROR_CONNECTION_LOST) return "a conexão caiu";
  if (codigo == HTTPC_ERROR_READ_TIMEOUT) return "demorou demais para responder";
  return "erro " + String(codigo);
}

void publicar() {
  if (WiFi.status() != WL_CONNECTED) return;

  String url = String(SUPABASE_URL) + "/rest/v1/rpc/publicar";
  http.setReuse(true);     // mantém a conexão TLS aberta entre envios
  http.setConnectTimeout(4000);   // conexão TCP
  http.setTimeout(5000);          // resposta. O pior envio preso fica perto de 15 s.
  if (!http.begin(tls, url)) {
    Serial.println("[http] begin falhou");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Profile", "vagas");

  tentouDesdeConexao = true;
  unsigned long t0 = millis();
  int codigo = http.POST(montarPayload());
  String corpo = http.getString();
  http.end();
  ultimoCodigoHttp = codigo;
  envioOk = false;

  // Sucesso só com 200 e o corpo da função publicar. Um portal cativo também responde 200,
  // e o TLS aceita qualquer certificado, então o código sozinho não basta.
  if (codigo == 200 && corpo.indexOf("\"atualizados\"") >= 0) {
    situacaoEnvio = ENVIO_OK;
    envioOk = true;
    ultimoEnvioOk = millis();
    Serial.print("[http] ok, "); Serial.print(contarLivres()); Serial.print(" de "); Serial.print(N_VAGAS); Serial.print(" livres, ");
    Serial.print(millis() - t0); Serial.print(" ms, sinal "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
  } else if (codigo == 200 || (codigo >= 300 && codigo <= 399)) {
    situacaoEnvio = ENVIO_PORTAL;
    Serial.print("[http] a rede respondeu no lugar do Supabase ("); Serial.print(codigo);
    Serial.print("). Isso acontece quando ela pede login no navegador. Peça à TI para liberar o MAC "); Serial.print(WiFi.macAddress()); Serial.println(".");
  } else if (codigo == 401) {
    situacaoEnvio = ENVIO_CHAVE;
    Serial.println("[http] chave recusada (401). A SUPABASE_ANON_KEY deste arquivo está errada. Peça ao Matheus um arquivo novo.");
  } else if (codigo == 403) {
    situacaoEnvio = ENVIO_TOKEN;
    Serial.println("[http] token recusado (403). Avise o Matheus: o token deste arquivo foi trocado ou desligado.");
  } else if (codigo == 400) {
    situacaoEnvio = ENVIO_DADOS;
    Serial.print("[http] dados recusados (400): "); Serial.println(corpo);
  } else if (codigo == 404) {
    situacaoEnvio = ENVIO_FUNCAO;
    Serial.println("[http] o Supabase não achou a função publicar (404). Avise o Matheus.");
  } else if (codigo == 406) {
    situacaoEnvio = ENVIO_SCHEMA;
    Serial.println("[http] o schema vagas não está liberado na API (406). Avise o Matheus.");
  } else if (codigo < 0) {
    situacaoEnvio = ENVIO_SEM_INTERNET;
    Serial.print("[http] sem resposta do Supabase ("); Serial.print(textoErroRede(codigo)); Serial.println("). Confira se a rede tem internet.");
  } else {
    situacaoEnvio = ENVIO_OUTRO;
    Serial.print("[http] erro "); Serial.print(codigo); Serial.print(": "); Serial.println(corpo.substring(0, 120));
  }
}

// ---------------- página local (opcional) ----------------

#if MANTER_PAGINA_LOCAL
// Esta página roda sem internet. Não use fonte, script ou imagem de fora.
// As cores são as do site (src/app/globals.css). Ícones em SVG inline, sem emoji.
const char PAGINA[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Placa do estacionamento</title>
<style>
  /* copiado de src/app/globals.css; mantenha igual */
  :root {
    --fundo: #0f1419;
    --superficie: #182028;
    --superficie-2: #1f2a34;
    --borda: #2c3a47;
    --texto: #eef3f7;
    --texto-secundario: #9fb0bf;
    --destaque: #3b82f6;

    --livre: #22c55e;
    --livre-fundo: #0f2f1c;
    --poucas: #f59e0b;
    --poucas-fundo: #3a2a06;
    --lotado: #f87171;
    --lotado-fundo: #3b1111;
    --sem-dados: #fbbf24;
    --sem-dados-fundo: #2a2a2a;
    --vaga-ocupada: #6b7785;
    --vaga-livre: #22c55e;
    --vaga-especial: #60a5fa;
    --vaga-neutra: #2c3a47;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:system-ui,-apple-system,"Segoe UI",sans-serif; background:var(--fundo); color:var(--texto); min-height:100vh; padding:24px 16px; display:flex; flex-direction:column; align-items:center; }
  header { text-align:center; margin-bottom:16px; }
  header h1 { font-size:1.4rem; font-weight:600; }
  header p { color:var(--texto-secundario); font-size:.9rem; margin-top:4px; }
  .faixa { width:100%; max-width:640px; border:2px solid var(--sem-dados); background:var(--superficie); border-radius:12px; padding:10px 12px; margin-bottom:20px; display:flex; gap:10px; align-items:flex-start; color:var(--sem-dados); font-size:.95rem; line-height:1.35; }
  .faixa.ok { border-color:var(--livre); color:var(--livre); }
  .faixa .icone-faixa { width:1.4em; height:1.4em; flex:none; margin-top:.05em; }
  .faixa p + p { color:var(--texto); margin-top:4px; }
  .resumo { width:100%; max-width:640px; background:var(--superficie); border-radius:20px; padding:24px 16px; text-align:center; margin-bottom:28px; border:2px solid var(--livre); }
  .resumo .numero { font-size:4rem; font-weight:700; line-height:1; color:var(--livre); }
  .resumo .rotulo { color:var(--texto-secundario); margin-top:6px; }
  .resumo.lotado { background:var(--lotado-fundo); border-color:var(--lotado); }
  .resumo.lotado .numero { font-size:2.5rem; font-weight:800; color:var(--lotado); }
  /* SEM DADOS: borda tracejada, listras e ícone, como no site. Copiado de .listrado em src/app/globals.css. */
  .resumo.sem-dados { border:2px dashed var(--sem-dados); background-color:var(--sem-dados-fundo); background-image:repeating-linear-gradient(135deg,transparent 0 8px,rgb(255 255 255 / 0.06) 8px 16px); }
  .resumo.sem-dados .numero { font-size:2rem; color:var(--sem-dados); display:flex; align-items:center; justify-content:center; gap:10px; }
  .resumo.sem-dados .rotulo { color:var(--texto); }
  .alerta { width:1.25em; height:1.25em; flex:none; }
  .patio { width:100%; max-width:640px; display:grid; grid-template-columns:repeat(auto-fill,minmax(64px,1fr)); gap:8px; }
  .vaga { position:relative; background:var(--superficie-2); border-radius:10px; padding:8px 4px; text-align:center; border:2px solid var(--vaga-ocupada); }
  .vaga .num { font-size:1rem; font-weight:700; line-height:1.2; color:var(--texto); }
  .vaga .gpio { font-size:.7rem; color:var(--texto-secundario); margin:2px 0; white-space:nowrap; }
  .vaga .status { font-weight:600; font-size:.75rem; color:var(--texto); white-space:nowrap; }
  .vaga .extra { font-size:.65rem; font-weight:600; margin-top:2px; white-space:nowrap; }
  .vaga.livre { background:var(--livre-fundo); border-color:var(--livre); }
  .vaga.livre .status { color:var(--livre); }
  .vaga.mudou { outline:3px solid #eef3f7; outline-offset:-1px; }
  .vaga.mudou .extra { color:#eef3f7; }
  .vaga.instavel { border-style:dashed; border-color:#fbbf24; }
  .vaga.instavel .extra { color:#fbbf24; }
  .vaga .x { position:absolute; top:3px; right:3px; width:12px; height:12px; color:var(--texto); }
  .detalhes { width:100%; max-width:640px; margin-top:28px; background:var(--superficie); border-radius:14px; padding:14px 16px; font-size:.9rem; }
  .detalhes h2 { font-size:1rem; font-weight:600; margin-bottom:8px; }
  .detalhes h2 span { color:var(--texto-secundario); font-weight:400; }
  .detalhes li { list-style:none; padding:3px 0; color:var(--texto-secundario); }
  .detalhes li b { color:var(--texto); font-weight:500; }
  .rodape { margin-top:20px; color:var(--texto-secundario); font-size:.8rem; display:flex; align-items:center; gap:8px; }
  .ponto { width:10px; height:10px; border-radius:50%; background:var(--livre); flex:none; }
  .ponto.sem-dados { background:var(--sem-dados); }
</style>
</head>
<body>
  <header><h1 id="titulo">Placa do estacionamento</h1><p>Página local da placa. Os motoristas usam vagas.rubysistemas.com.br.</p></header>
  <div class="faixa" id="faixa" aria-live="polite"><svg class="icone-faixa" id="faixa-icone" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/></svg><div><p id="faixa-texto">A página ainda não recebeu dados da placa.</p><p id="faixa-extra" hidden></p><p id="faixa-vaga" hidden></p></div></div>
  <div class="resumo sem-dados" id="resumo">
    <div class="numero" id="livres"><svg class="alerta" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/></svg><span>SEM DADOS</span></div>
    <div class="rotulo" id="rotulo">A página ainda não recebeu dados da placa.</div>
  </div>
  <div class="patio" id="patio"></div>
  <section class="detalhes" id="detalhes" hidden>
    <h2>Detalhes da placa <span id="detalhes-idade"></span></h2>
    <ul id="detalhes-lista"></ul>
  </section>
  <div class="rodape"><span class="ponto sem-dados" id="ponto"></span><span id="atualizado" role="status">A página consulta a placa a cada segundo.</span></div>
<script>
  const LIMITE_LOCAL_MS = 20000; // a página fala direto com a placa; 20 s cobre um envio preso e é mais rígido que os 30 s do site
  const ALERTA = '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/>';
  const CERTO = '<path d="M4 12.5 9.5 18 20 6.5"/>';
  const ICONE_ALERTA = '<svg class="alerta" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + ALERTA + '</svg>';
  const patio=document.getElementById('patio'),resumo=document.getElementById('resumo'),ponto=document.getElementById('ponto');
  const livresEl=document.getElementById('livres'),rotuloEl=document.getElementById('rotulo'),atualizadoEl=document.getElementById('atualizado');
  const faixa=document.getElementById('faixa'),faixaTexto=document.getElementById('faixa-texto'),faixaExtra=document.getElementById('faixa-extra'),faixaIcone=document.getElementById('faixa-icone'),faixaVaga=document.getElementById('faixa-vaga');
  const LIMITE_TROCAS_MIN = 12;
  const detalhes=document.getElementById('detalhes'),detalhesLista=document.getElementById('detalhes-lista'),detalhesIdade=document.getElementById('detalhes-idade');
  let ultimoDado=null, ultimoOk=null, falhou=false, desenhado=null;

  // Busca separada do desenho: nunca há duas consultas abertas.
  async function ciclo(){
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 3000);
    try {
      const r = await fetch('/status', {cache:'no-store', signal:c.signal});
      if (!r.ok) throw new Error(r.status);
      ultimoDado = await r.json();
      ultimoOk = performance.now();
      falhou = false;
      desenhar();
    } catch (e) {
      falhou = true;
      desenhar();
    } finally {
      clearTimeout(t);
      setTimeout(ciclo, 1000);
    }
  }

  function texto(el, t){ if (el.textContent !== t) el.textContent = t; }
  function classe(el, c){ if (el.className !== c) el.className = c; }
  function sinalTexto(d){ return d.wifi ? 'sinal ' + (d.sinal >= -67 ? 'bom' : d.sinal >= -80 ? 'fraco' : 'muito fraco') + ' (' + d.sinal + ' dBm)' : 'sem conexão'; }
  function duracao(s){
    if (s < 60) return s + ' s';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? h + ' h ' + m + ' min' : m + ' min';
  }

  // Texto da faixa para cada valor de "envio" do /status.
  function textoFaixa(d){
    switch (d.envio) {
      case 'config': return d.config ? d.config : 'Falta preencher o Wi-Fi do campus no arquivo da placa.';
      case 'sem_wifi': return 'A placa está sem o Wi-Fi do campus. Motivo: ' + (d.motivo_wifi || 'ainda procurando a rede') + '. Ela tenta de novo sozinha.';
      case 'aguardando': return 'A placa entrou no Wi-Fi. O próximo envio sai em até 10 s.';
      case 'ok': return 'A placa está enviando para o site. O último envio foi há ' + d.ultimo_ok_s + ' s.';
      case 'chave': return 'O site recusou a chave do Supabase (401). Peça ao Matheus um arquivo novo.';
      case 'token': return 'O site recusou o token desta placa (403). Avise o Matheus.';
      case 'dados': return 'O banco recusou os dados (400). Confira ID_BOLSAO no arquivo.';
      case 'funcao': return 'O site não achou a função de envio (404). Avise o Matheus.';
      case 'schema': return 'O site não liberou o schema vagas (406). Avise o Matheus.';
      case 'portal': return 'A rede pediu login no navegador. Peça à TI para liberar o MAC ' + d.mac + '.';
      case 'sem_internet': return 'A placa tem Wi-Fi, mas o site não respondeu. Confira se a rede libera a internet.';
      default: return 'O último envio certo foi há ' + (d.ultimo_ok_s >= 0 ? d.ultimo_ok_s + ' s' : 'mais de um dia') + '. Avise o Matheus.';
    }
  }

  function linha(el, t){ if (t) { texto(el, t); el.hidden = false; } else { el.hidden = true; texto(el, ''); } }
  function mostrarFaixa(ok, principal, extra, vaga){
    classe(faixa, 'faixa' + (ok ? ' ok' : ''));
    const icone = ok ? CERTO : ALERTA;
    if (faixaIcone.innerHTML !== icone) faixaIcone.innerHTML = icone;
    texto(faixaTexto, principal);
    linha(faixaExtra, extra);
    linha(faixaVaga, vaga);
  }

  // Primeira vaga instável do minuto, para a faixa.
  function avisoInstavel(d){
    if (!d.trocas_min) return null;
    for (let i = 0; i < d.vagas.length; i++) {
      if (d.trocas_min[i] >= LIMITE_TROCAS_MIN) {
        return 'A vaga ' + (i + 1) + ' (GPIO ' + d.pinos[i] + ') trocou ' + d.trocas_min[i] + ' vezes neste minuto. Confira o fio e o alinhamento do sensor.';
      }
    }
    return null;
  }

  function desenharDetalhes(d){
    const itens = [
      ['Wi-Fi do campus', d.rede + ' · ' + sinalTexto(d)],
      ['IP da placa', d.ip || 'sem IP'],
      ['MAC (a TI libera este)', d.mac],
      ['Ligada há', duracao(d.ligada_s)],
      ['Último reinício', d.reinicio],
      ['Firmware', d.versao]
    ];
    detalhesLista.innerHTML = itens.map(i => '<li>' + i[0] + ': <b></b></li>').join('');
    detalhesLista.querySelectorAll('b').forEach((b, i) => { b.textContent = itens[i][1]; });
    detalhes.hidden = false;
  }

  const X = '<svg class="x" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l6 6M8 2l-6 6"/></svg>';
  function desenharVagas(d){
    patio.innerHTML='';
    d.vagas.forEach((ocupada,i)=>{
      const mudou = d.mudou_ha && d.mudou_ha[i] >= 0 && d.mudou_ha[i] < 5;
      const instavel = d.trocas_min && d.trocas_min[i] >= LIMITE_TROCAS_MIN;
      const el=document.createElement('div');
      el.className='vaga '+(ocupada?'ocupada':'livre')+(mudou?' mudou':'')+(instavel?' instavel':'');
      const extra = instavel ? 'instável' : mudou ? 'mudou agora' : '';
      el.innerHTML=(ocupada?X:'')+'<div class="num">Vaga '+(i+1)+'</div><div class="gpio">GPIO '+(d.pinos ? d.pinos[i] : '?')+'</div><div class="status">'+(ocupada?'Ocupada':'Livre')+'</div>'+(extra?'<div class="extra">'+extra+'</div>':'');
      patio.appendChild(el);
    });
  }

  function desenhar(){
    const agora = performance.now();
    const semDados = ultimoOk === null || agora - ultimoOk > LIMITE_LOCAL_MS;
    const s = ultimoOk === null ? null : Math.round((agora - ultimoOk) / 1000);
    const semResposta = s === null ? 'A página ainda não recebeu dados da placa.' : 'A placa não responde há ' + s + ' s.';
    if (semDados) {
      if (!resumo.classList.contains('sem-dados')) livresEl.innerHTML = ICONE_ALERTA + '<span>SEM DADOS</span>';
      classe(resumo, 'resumo sem-dados');
      texto(rotuloEl, semResposta);
      patio.innerHTML = ''; desenhado = null;
      classe(ponto, 'ponto sem-dados');
      texto(atualizadoEl, semResposta);
      mostrarFaixa(false, semResposta, null, null);
      if (ultimoDado) texto(detalhesIdade, '(dados de ' + s + ' s atrás)');
      return;
    }
    const d = ultimoDado;
    texto(document.getElementById('titulo'), d.nome);
    if (document.title !== 'Placa do ' + d.nome) document.title = 'Placa do ' + d.nome;
    const lotado = d.livres === 0;
    texto(livresEl, lotado ? 'LOTADO' : String(d.livres));
    texto(rotuloEl, lotado ? '0 de ' + d.vagas.length + ' livres' : d.livres === 1 ? 'vaga livre' : 'vagas livres');
    classe(resumo, 'resumo' + (lotado ? ' lotado' : ''));
    if (d !== desenhado) { desenharVagas(d); desenharDetalhes(d); desenhado = d; }
    texto(detalhesIdade, '');
    const ok = d.envio === 'ok';
    mostrarFaixa(ok, textoFaixa(d), ok ? null : 'Enquanto isso, o site mostra SEM DADOS para o ' + d.nome + '.', avisoInstavel(d));
    classe(ponto, 'ponto' + (falhou ? ' sem-dados' : ''));
    texto(atualizadoEl, falhou ? semResposta : 'A página consulta a placa a cada segundo.');
  }

  desenhar(); setInterval(desenhar, 1000); ciclo();
</script>
</body>
</html>
)rawliteral";

void paginaInicial() { server.send(200, "text/html", PAGINA); }

// Texto do campo "envio" do /status. A ordem importa: config, sem_wifi, aguardando, ok, resto.
const char* textoEnvio() {
  if (faltaConfig || erroConfig.length() > 0) return "config";
  if (WiFi.status() != WL_CONNECTED) return "sem_wifi";
  if (!tentouDesdeConexao) return "aguardando";
  // 30 s, igual ao LIMITE_FRESCOR_MS do site; não use só ultimoCodigoHttp, ele não muda quando o Wi-Fi cai
  if (envioOk && millis() - ultimoEnvioOk < 30000) return "ok";
  switch (situacaoEnvio) {
    case ENVIO_CHAVE: return "chave";
    case ENVIO_TOKEN: return "token";
    case ENVIO_DADOS: return "dados";
    case ENVIO_FUNCAO: return "funcao";
    case ENVIO_SCHEMA: return "schema";
    case ENVIO_PORTAL: return "portal";
    case ENVIO_SEM_INTERNET: return "sem_internet";
    case ENVIO_NENHUM: return "aguardando";
    default: return "outro";
  }
}

// Escapa aspas e barras para o JSON.
String jsonTexto(const String& t) {
  String r = "\"";
  for (unsigned int i = 0; i < t.length(); i++) {
    char c = t[i];
    if (c == '"' || c == '\\') r += '\\';
    r += c;
  }
  r += "\"";
  return r;
}

// Senha, token e chave nunca entram aqui.
void statusJson() {
  bool wifi = WiFi.status() == WL_CONNECTED;
  String json = "{\"bolsao\":" + jsonTexto(ID_BOLSAO);
  json += ",\"nome\":" + jsonTexto(NOME_BOLSAO);
  json += ",\"vagas\":[";
  for (int i = 0; i < N_VAGAS; i++) {
    json += estado[i] ? "true" : "false";
    if (i < N_VAGAS - 1) json += ",";
  }
  json += "],\"livres\":" + String(contarLivres());
  json += ",\"nuvem\":" + String(envioOk && millis() - ultimoEnvioOk < 30000 ? "true" : "false");
  json += ",\"http\":" + String(ultimoCodigoHttp);
  json += ",\"envio\":" + jsonTexto(textoEnvio());
  json += ",\"wifi\":" + String(wifi ? "true" : "false");
  json += ",\"rede\":" + jsonTexto(WIFI_SSID);
  json += ",\"sinal\":" + String(wifi ? WiFi.RSSI() : 0);
  json += ",\"ip\":" + jsonTexto(wifi ? WiFi.localIP().toString() : String(""));
  json += ",\"mac\":" + jsonTexto(WiFi.macAddress());
  json += ",\"motivo_wifi\":" + jsonTexto(motivoWifi);
  json += ",\"ultimo_ok_s\":" + String(ultimoEnvioOk == 0 ? -1 : (long)((millis() - ultimoEnvioOk) / 1000));
  json += ",\"ligada_s\":" + String(millis() / 1000);
  json += ",\"reinicio\":" + jsonTexto(textoReinicio);
  json += ",\"versao\":" + jsonTexto(VERSAO_FIRMWARE);
  json += ",\"config\":" + jsonTexto(erroConfig);
  json += ",\"pinos\":[";
  for (int i = 0; i < N_VAGAS; i++) {
    json += String(PINO_VAGA[i]);
    if (i < N_VAGAS - 1) json += ",";
  }
  json += "],\"mudou_ha\":[";
  for (int i = 0; i < N_VAGAS; i++) {
    json += String(mudouEm[i] == 0 ? -1 : (long)((millis() - mudouEm[i]) / 1000));
    if (i < N_VAGAS - 1) json += ",";
  }
  json += "],\"trocas_min\":[";
  for (int i = 0; i < N_VAGAS; i++) {
    json += String(trocas[i]);
    if (i < N_VAGAS - 1) json += ",";
  }
  json += "]}";
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}
#endif

// ---------------- setup e loop ----------------

void setup() {
  Serial.begin(115200);
  conferirPinos();

  // Protótipo: aceita qualquer certificado. Na versão final, troque por:
  //   tls.setCACertBundle(x509_crt_imported_bundle_bin_start);   // pacote de raízes do core
  tls.setInsecure();
  // O handshake do TLS esperaria 120 s. Com 6 s, um portal que aceita a porta 443 e não
  // fala TLS não segura o loop até o watchdog (30 s) reiniciar a placa.
  tls.setHandshakeTimeout(6);

#if MANTER_PAGINA_LOCAL
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_SENHA);
  // Portal cativo: o DHCP avisa o celular e o DNS responde tudo com o IP da placa.
  // Qualquer endereço desconhecido redireciona para a página, inclusive os testes de
  // conectividade do Android e do iPhone.
  WiFi.AP.enableDhcpCaptivePortal();
  dns.start();
  server.on("/", paginaInicial);
  server.on("/status", statusJson);
  server.onNotFound([]() {
    server.sendHeader("Location", "http://192.168.4.1/");
    server.send(302, "text/plain", "");
  });
  server.begin();
#else
  WiFi.mode(WIFI_STA);
#endif
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.onEvent(aoDesconectar, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);

  textoReinicio = motivoDoReinicio();
  Serial.println();
  Serial.print("[bolsao] "); Serial.print(NOME_BOLSAO); Serial.print(" (ID "); Serial.print(ID_BOLSAO); Serial.print("), firmware "); Serial.println(VERSAO_FIRMWARE);
  Serial.print("[bolsao] reinício: "); Serial.println(textoReinicio);
  Serial.print("[vagas] "); Serial.print(N_VAGAS); Serial.print(N_VAGAS == 1 ? " vaga:" : " vagas:");
  for (int i = 0; i < N_VAGAS; i++) { Serial.print(" "); Serial.print(i + 1); Serial.print("=GPIO"); Serial.print(PINO_VAGA[i]); }
  Serial.println();
  if (erroConfig.length() > 0) { Serial.print("[config] "); Serial.println(erroConfig); }
#if MANTER_PAGINA_LOCAL
  Serial.print("[local] rede "); Serial.print(AP_SSID); Serial.print(", senha "); Serial.print(AP_SENHA);
  Serial.print(", página http://"); Serial.println(WiFi.softAPIP());
#endif
  Serial.print("[wifi] MAC "); Serial.print(WiFi.macAddress()); Serial.println(" (a TI libera este)");

  faltaConfig = temValorDeExemplo();
  if (faltaConfig) {
    avisarFaltaConfig();
    ultimoAvisoFalta = millis();
  } else {
    conectarWifi();
  }

  // Se o loop travar por 30 s, a placa reinicia sozinha.
  esp_task_wdt_config_t cfg = {};
  cfg.timeout_ms = 30000;
  cfg.trigger_panic = true;
  if (esp_task_wdt_init(&cfg) != ESP_OK) esp_task_wdt_reconfigure(&cfg);
  esp_task_wdt_add(NULL);

}

void loop() {
  esp_task_wdt_reset();
#if MANTER_PAGINA_LOCAL
  server.handleClient();
#endif
  unsigned long agora = millis();
  if (faltaConfig) {
    // Sem Wi-Fi e sem envio até o arquivo ser preenchido. A rede local continua no ar.
    if (agora - ultimoAvisoFalta >= 10000) {
      ultimoAvisoFalta = agora;
      avisarFaltaConfig();
    }
  } else {
    cuidarWifi();
  }

  if (agora - ultimaLeitura >= 100) {
    ultimaLeitura = agora;
    lerVagas();
  }
  if (agora - inicioMinuto >= 60000) {
    inicioMinuto = agora;
    fecharMinuto();
  }

  // O POST pode segurar o loop por até 15 s (4 s de conexão, 6 s de TLS e 5 s de resposta).
  // A leitura dos sensores pausa nesse tempo; com o filtro de 3 leituras isso não muda nenhum estado.
  if (faltaConfig) return;
  if (erroConfig.length() > 0) {
    if (ultimoAvisoConfig == 0 || agora - ultimoAvisoConfig >= 10000) {
      ultimoAvisoConfig = agora;
      Serial.print("[config] "); Serial.println(erroConfig);
    }
    return;   // sem envio: o site mostra SEM DADOS
  }
  if (agora - ultimoEnvio >= INTERVALO_PUBLICAR_MS) {
    ultimoEnvio = agora;
    publicar();
  }
}
