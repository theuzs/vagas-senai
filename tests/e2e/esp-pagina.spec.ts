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
