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
const char PAGINA[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vagas do Estacionamento</title>
<style>
  :root { --bg:#0f1419; --card:#1a212b; --texto:#e8edf2; --suave:#8a96a3; --livre:#22c55e; --ocupada:#ef4444; --offline:#f59e0b; --sem-dados:#fbbf24; --sem-dados-fundo:#2a2a2a; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:system-ui,-apple-system,"Segoe UI",sans-serif; background:var(--bg); color:var(--texto); min-height:100vh; padding:24px 16px; display:flex; flex-direction:column; align-items:center; }
  header { text-align:center; margin-bottom:24px; }
  header h1 { font-size:1.4rem; font-weight:600; }
  header p { color:var(--suave); font-size:.9rem; margin-top:4px; }
  .resumo { background:var(--card); border-radius:20px; padding:24px 40px; text-align:center; margin-bottom:28px; border:2px solid var(--livre); transition:border-color .3s; }
  .resumo.lotado { border-color:var(--ocupada); }
  .resumo .numero { font-size:4rem; font-weight:700; line-height:1; }
  .resumo .rotulo { color:var(--suave); margin-top:6px; }
  /* SEM DADOS: borda tracejada, listras e ícone, como no site. Copiado de .listrado em src/app/globals.css. */
  .resumo.sem-dados { border:2px dashed var(--sem-dados); background-color:var(--sem-dados-fundo); background-image:repeating-linear-gradient(135deg,transparent 0 8px,rgb(255 255 255 / 0.06) 8px 16px); }
  .resumo.sem-dados .numero { font-size:2rem; color:var(--sem-dados); display:flex; align-items:center; justify-content:center; gap:10px; }
  .resumo.sem-dados .rotulo { color:var(--texto); }
  .alerta { width:1.25em; height:1.25em; flex:none; }
  .patio { width:100%; max-width:640px; display:grid; grid-template-columns:repeat(auto-fit,minmax(100px,1fr)); gap:12px; }
  .vaga { background:var(--card); border-radius:14px; padding:20px 8px; text-align:center; border:2px solid transparent; transition:all .3s; }
  .vaga .num { font-size:.8rem; color:var(--suave); margin-bottom:8px; }
  .vaga .icone { font-size:2rem; margin-bottom:8px; }
  .vaga .status { font-weight:600; font-size:.9rem; }
  .vaga.livre { border-color:var(--livre); }
  .vaga.livre .status { color:var(--livre); }
  .vaga.ocupada { border-color:var(--ocupada); background:#2a1a1d; }
  .vaga.ocupada .status { color:var(--ocupada); }
  .rodape { margin-top:28px; color:var(--suave); font-size:.8rem; display:flex; align-items:center; gap:8px; }
  .ponto { width:10px; height:10px; border-radius:50%; background:var(--livre); flex:none; }
  .ponto.sem-dados { background:var(--sem-dados); }
</style>
</head>
<body>
  <header><h1 id="titulo">Estacionamento</h1><p>Vagas em tempo real</p></header>
  <div class="resumo sem-dados" id="resumo">
    <div class="numero" id="livres"><svg class="alerta" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/></svg><span>SEM DADOS</span></div>
    <div class="rotulo" id="rotulo">A página ainda não recebeu dados da placa.</div>
  </div>
  <div class="patio" id="patio"></div>
  <div class="rodape"><span class="ponto sem-dados" id="ponto"></span><span id="atualizado" role="status">A página consulta a placa a cada segundo.</span></div>
<script>
  const LIMITE_LOCAL_MS = 20000; // a página fala direto com a placa; 20 s cobre um envio preso e é mais rígido que os 30 s do site
  const ICONE_ALERTA = '<svg class="alerta" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/></svg>';
  const patio=document.getElementById('patio'),resumo=document.getElementById('resumo'),ponto=document.getElementById('ponto');
  const livresEl=document.getElementById('livres'),rotuloEl=document.getElementById('rotulo'),atualizadoEl=document.getElementById('atualizado');
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

  function desenharVagas(d){
    patio.innerHTML='';
    d.vagas.forEach((ocupada,i)=>{
      const el=document.createElement('div');
      el.className='vaga '+(ocupada?'ocupada':'livre');
      el.innerHTML='<div class="num">Vaga '+(i+1)+'</div><div class="icone" aria-hidden="true">'+(ocupada?'🚗':'🅿️')+'</div><div class="status">'+(ocupada?'Ocupada':'Livre')+'</div>';
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
      resumo.className = 'resumo sem-dados';
      texto(rotuloEl, semResposta);
      patio.innerHTML = ''; desenhado = null;
      ponto.className = 'ponto sem-dados';
      texto(atualizadoEl, semResposta);
      return;
    }
    const d = ultimoDado;
    texto(document.getElementById('titulo'), d.nome);
    texto(livresEl, String(d.livres));
    texto(rotuloEl, d.livres === 1 ? 'vaga livre' : 'vagas livres');
    resumo.className = 'resumo' + (d.livres === 0 ? ' lotado' : '');
    if (d !== desenhado) { desenharVagas(d); desenhado = d; }
    ponto.className = 'ponto' + (falhou ? ' sem-dados' : '');
    texto(atualizadoEl, falhou ? semResposta : 'A página consulta a placa a cada segundo.');
  }

  desenhar(); setInterval(desenhar, 1000); ciclo();
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

  // O POST pode segurar o loop por até 15 s (4 s de conexão, 6 s de TLS e 5 s de resposta).
  // A leitura dos sensores pausa nesse tempo; com o filtro de 3 leituras isso não muda nenhum estado.
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
