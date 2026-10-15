/**
 * Testa a página local da placa (a que o ESP32 serve em http://192.168.4.1) sem placa:
 * o HTML vem direto de firmware/bolsao/bolsao.ino e o /status é respondido pelo Playwright.
 *
 * Não precisa do servidor Next. Para o Playwright não subir o `next dev`, aponte
 * E2E_BASE_URL para qualquer endereço:
 *
 *   E2E_BASE_URL=http://192.168.4.1 npx playwright test esp-pagina
 */
import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ORIGEM = "http://192.168.4.1";
const INICIO = new Date("2026-10-15T19:00:00-03:00");

export function htmlDaPlaca(sketch = join("firmware", "bolsao", "bolsao.ino")): string {
  const ino = readFileSync(join(process.cwd(), sketch), "utf8");
  const ini = ino.indexOf('R"rawliteral(');
  const fim = ino.indexOf(')rawliteral"');
  if (ini < 0 || fim < 0) throw new Error("não achei a PAGINA no .ino");
  return ino.slice(ini + 'R"rawliteral('.length, fim);
}

export interface StatusPlaca {
  bolsao: string;
  nome: string;
  vagas: boolean[];
  livres: number;
  nuvem: boolean;
  http: number;
  envio: string;
  wifi: boolean;
  rede: string;
  sinal: number;
  ip: string;
  mac: string;
  motivo_wifi: string;
  ultimo_ok_s: number;
  ligada_s: number;
  reinicio: string;
  versao: string;
  config: string;
  pinos: number[];
  [campo: string]: unknown;
}

export function status(extra: Partial<StatusPlaca> = {}): StatusPlaca {
  const vagas = extra.vagas ?? [false, true, false, false, true];
  return {
    bolsao: "A",
    nome: "Bloco A",
    vagas,
    livres: vagas.filter((v) => !v).length,
    nuvem: true,
    http: 200,
    envio: "ok",
    wifi: true,
    rede: "SENAI-IOT",
    sinal: -61,
    ip: "10.20.4.37",
    mac: "24:6F:28:AA:BB:CC",
    motivo_wifi: "",
    ultimo_ok_s: 3,
    ligada_s: 11520,
    reinicio: "ligou na energia",
    versao: "2026-10-15",
    config: "",
    pinos: vagas.map((_, i) => 32 + i),
    ...extra,
  };
}

type Resposta = (rota: Route) => Promise<void> | void;

/**
 * Serve a página em http://192.168.4.1/ (para o fetch relativo ter origem), instala o relógio
 * falso pausado e aborta qualquer pedido para fora da placa, contando-os.
 */
export async function abrirPagina(page: Page, responder: Resposta, html = htmlDaPlaca()) {
  const contagem = { foraDaPlaca: 0 };
  const estado = { responder };
  await page.route("**", async (rota) => {
    if (rota.request().url().startsWith(`${ORIGEM}/`)) {
      await rota.fallback();
      return;
    }
    contagem.foraDaPlaca++;
    await rota.abort();
  });
  await page.route(`${ORIGEM}/`, (rota) => rota.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
  await page.route(`${ORIGEM}/status`, (rota) => estado.responder(rota));
  await page.clock.install({ time: INICIO });
  await page.clock.pauseAt(INICIO);
  await page.goto(`${ORIGEM}/`);
  return {
    contagem,
    trocarResposta(nova: Resposta) {
      estado.responder = nova;
    },
  };
}

export const responderCom = (s: StatusPlaca): Resposta => (rota) => rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(s) });
const pendurar: Resposta = () => {};
const abortar: Resposta = (rota) => rota.abort();

async function esperarSemDados(page: Page) {
  const livres = page.locator("#livres");
  await expect(livres).toContainText("SEM DADOS");
  await expect(livres).not.toContainText(/\d/);
  await expect(page.locator(".vaga.livre")).toHaveCount(0);
  await expect(page.locator(".vaga.ocupada")).toHaveCount(0);
  await expect(page.locator("#resumo")).toHaveClass(/sem-dados/);
  await expect(page.locator("#resumo")).toHaveCSS("border-top-style", "dashed");
  await expect(page.locator("#resumo")).toHaveCSS("background-image", /repeating-linear-gradient/);
  await expect(page.locator("#resumo svg")).toHaveCount(1);
}

test.describe("página local da placa: sem número velho", () => {
  test("antes da primeira resposta já mostra SEM DADOS, sem vaga e sem dígito", async ({ page }) => {
    const { contagem } = await abrirPagina(page, pendurar);
    await esperarSemDados(page);
    await expect(page.locator("#rotulo")).toHaveText("A página ainda não recebeu dados da placa.");
    await expect(page.locator("#livres")).not.toContainText("--");
    await expect(page.locator("#ponto")).toHaveClass(/sem-dados/);
    expect(contagem.foraDaPlaca).toBe(0);
  });

  test("depois de uma resposta boa, 21 s sem resposta voltam para SEM DADOS", async ({ page }) => {
    const { trocarResposta, contagem } = await abrirPagina(page, responderCom(status()));
    await expect(page.locator("#livres")).toHaveText("3");
    await expect(page.locator(".vaga.livre")).toHaveCount(3);
    await expect(page.locator(".vaga.ocupada")).toHaveCount(2);
    await expect(page.locator("#atualizado")).toHaveText("A página consulta a placa a cada segundo.");

    trocarResposta(abortar);
    await page.clock.runFor(4000);
    // Entre a primeira falha e os 20 s, o número continua e o rodapé avisa.
    await expect(page.locator("#livres")).toHaveText("3");
    await expect(page.locator("#atualizado")).toContainText(/A placa não responde há \d+ s\./);

    await page.clock.runFor(17000);
    await esperarSemDados(page);
    await expect(page.locator("#rotulo")).toContainText(/A placa não responde há \d+ s\./);
    expect(contagem.foraDaPlaca).toBe(0);
  });

  test("com a rota pendurada por 21 s, também mostra SEM DADOS", async ({ page }) => {
    const { trocarResposta } = await abrirPagina(page, responderCom(status()));
    await expect(page.locator("#livres")).toHaveText("3");
    trocarResposta(pendurar);
    await page.clock.runFor(21000);
    await esperarSemDados(page);
  });

  test("com respostas de 9 s nunca há duas consultas abertas, e o aviso chega antes de 5 s", async ({ page }) => {
    const pendentes: { rota: Route; em: number }[] = [];
    let abertas = 0;
    let maxAbertas = 0;
    let relogio = 0;
    const ehStatus = (url: string) => url === `${ORIGEM}/status`;
    page.on("request", (r) => {
      if (ehStatus(r.url())) {
        abertas++;
        maxAbertas = Math.max(maxAbertas, abertas);
      }
    });
    page.on("requestfinished", (r) => {
      if (ehStatus(r.url())) abertas--;
    });
    page.on("requestfailed", (r) => {
      if (ehStatus(r.url())) abertas--;
    });

    const { trocarResposta } = await abrirPagina(page, responderCom(status()));
    await expect(page.locator("#livres")).toHaveText("3");

    trocarResposta((rota) => {
      pendentes.push({ rota, em: relogio });
    });
    let avisoEm: number | null = null;
    for (let passo = 0; passo < 24; passo++) {
      await page.clock.runFor(500);
      relogio += 500;
      for (const p of pendentes.filter((p) => relogio - p.em >= 9000)) {
        pendentes.splice(pendentes.indexOf(p), 1);
        await p.rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(status()) }).catch(() => {});
      }
      if (avisoEm === null && (await page.locator("#atualizado").textContent())?.includes("A placa não responde há")) avisoEm = relogio;
    }
    expect(maxAbertas).toBe(1);
    expect(avisoEm).not.toBeNull();
    expect(avisoEm!).toBeLessThan(5000);
  });

  test("não faz nenhum pedido para fora da placa", async ({ page }) => {
    const { contagem } = await abrirPagina(page, responderCom(status()));
    await expect(page.locator("#livres")).toHaveText("3");
    await page.clock.runFor(5000);
    expect(contagem.foraDaPlaca).toBe(0);
  });
});

test.describe("página local da placa: diagnóstico", () => {
  const casos: { envio: string; extra?: Partial<StatusPlaca>; texto: string }[] = [
    { envio: "config", texto: "Falta preencher o Wi-Fi do campus no arquivo da placa." },
    { envio: "config", extra: { config: "A vaga 4 usa o GPIO 6, que é da memória flash. Troque em PINO_VAGA." }, texto: "A vaga 4 usa o GPIO 6, que é da memória flash. Troque em PINO_VAGA." },
    { envio: "sem_wifi", extra: { wifi: false, sinal: 0, ip: "", motivo_wifi: "a rede recusou a senha" }, texto: "A placa está sem o Wi-Fi do campus. Motivo: a rede recusou a senha. Ela tenta de novo sozinha." },
    { envio: "aguardando", texto: "A placa entrou no Wi-Fi. O próximo envio sai em até 10 s." },
    { envio: "ok", extra: { ultimo_ok_s: 4 }, texto: "A placa está enviando para o site. O último envio foi há 4 s." },
    { envio: "chave", texto: "O site recusou a chave do Supabase (401). Peça ao Matheus um arquivo novo." },
    { envio: "token", texto: "O site recusou o token desta placa (403). Avise o Matheus." },
    { envio: "dados", texto: "O banco recusou os dados (400). Confira ID_BOLSAO no arquivo." },
    { envio: "funcao", texto: "O site não achou a função de envio (404). Avise o Matheus." },
    { envio: "schema", texto: "O site não liberou o schema vagas (406). Avise o Matheus." },
    { envio: "portal", texto: "A rede pediu login no navegador. Peça à TI para liberar o MAC 24:6F:28:AA:BB:CC." },
    { envio: "sem_internet", texto: "A placa tem Wi-Fi, mas o site não respondeu. Confira se a rede libera a internet." },
    { envio: "outro", extra: { ultimo_ok_s: 95 }, texto: "O último envio certo foi há 95 s. Avise o Matheus." },
  ];
  for (const caso of casos) {
    test(`faixa com envio "${caso.envio}"${caso.extra?.config ? " e erro de pino" : ""}`, async ({ page }) => {
      await abrirPagina(page, responderCom(status({ envio: caso.envio, ...caso.extra })));
      await expect(page.locator("#faixa-texto")).toHaveText(caso.texto);
      const extra = page.locator("#faixa-extra");
      if (caso.envio === "ok") {
        await expect(page.locator("#faixa")).toHaveClass(/ok/);
        await expect(extra).toBeHidden();
      } else {
        await expect(page.locator("#faixa")).not.toHaveClass(/ok/);
        await expect(extra).toHaveText("Enquanto isso, o site mostra SEM DADOS para o Bloco A.");
      }
    });
  }

  test("token recusado e placa sem Wi-Fi não ficam iguais", async ({ page }) => {
    await abrirPagina(page, responderCom(status({ envio: "token" })));
    const comToken = await page.locator("#faixa").textContent();
    await page.reload();
    await page.route(`${ORIGEM}/status`, responderCom(status({ envio: "sem_wifi", wifi: false, sinal: 0, ip: "", motivo_wifi: "a rede SENAI-IOT não foi encontrada. Confira o nome. A placa só pega 2,4 GHz" })));
    await page.reload();
    await expect(page.locator("#faixa-texto")).toContainText("sem o Wi-Fi do campus");
    const semWifi = await page.locator("#faixa").textContent();
    expect(comToken).not.toEqual(semWifi);
    await expect(page.locator("#detalhes")).toContainText("sem conexão");
  });

  test("sem Wi-Fi, mesmo com http 200 guardado, não diz que está enviando", async ({ page }) => {
    await abrirPagina(page, responderCom(status({ envio: "sem_wifi", wifi: false, nuvem: false, http: 200 })));
    await expect(page.locator("#faixa-texto")).toContainText("sem o Wi-Fi do campus");
    await expect(page.locator("#faixa")).not.toContainText("enviando para o site");
  });

  test("título, subtítulo e detalhes da placa", async ({ page }) => {
    await abrirPagina(page, pendurar);
    await expect(page).toHaveTitle("Placa do estacionamento");
    await expect(page.locator("header p")).toHaveText("Página local da placa. Os motoristas usam vagas.rubysistemas.com.br.");
    await page.route(`${ORIGEM}/status`, responderCom(status({ sinal: -71 })));
    await page.clock.runFor(4000);
    await expect(page).toHaveTitle("Placa do Bloco A");
    await expect(page.locator("#titulo")).toHaveText("Bloco A");
    const detalhes = page.locator("#detalhes");
    await expect(detalhes).toContainText("Wi-Fi do campus: SENAI-IOT · sinal fraco (-71 dBm)");
    await expect(detalhes).toContainText("IP da placa: 10.20.4.37");
    await expect(detalhes).toContainText("MAC (a TI libera este): 24:6F:28:AA:BB:CC");
    await expect(detalhes).toContainText("Ligada há: 3 h 12 min");
    await expect(detalhes).toContainText("Último reinício: ligou na energia");
    await expect(detalhes).toContainText("Firmware: 2026-10-15");
    await expect(page.locator("#faixa")).toHaveAttribute("aria-live", "polite");

    await page.route(`${ORIGEM}/status`, abortar);
    await page.clock.runFor(25000);
    await esperarSemDados(page);
    await expect(detalhes).toContainText(/\(dados de \d+ s atrás\)/);
    await expect(page.locator("#faixa-texto")).toContainText(/A placa não responde há \d+ s\./);
  });

  test("statusJson não cita senha, token, chave nem o MAC do softAP", () => {
    const ino = readFileSync(join(process.cwd(), "firmware", "bolsao", "bolsao.ino"), "utf8");
    const ini = ino.indexOf("void statusJson()");
    const fim = ino.indexOf("\n}\n", ini);
    expect(ini).toBeGreaterThan(0);
    const corpo = ino.slice(ini, fim);
    for (const proibido of ["TOKEN_CENTRAL", "WIFI_SENHA", "SUPABASE_ANON_KEY", "softAPmacAddress", "AP_SENHA"]) {
      expect(corpo, proibido).not.toContain(proibido);
    }
  });
});
