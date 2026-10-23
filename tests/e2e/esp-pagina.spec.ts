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
  mudou_ha: number[];
  trocas_min: number[];
  aviso_config: string;
  especiais: Record<string, number[]>;
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
    mudou_ha: vagas.map(() => -1),
    trocas_min: vagas.map(() => 0),
    aviso_config: "",
    especiais: {},
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
    { envio: "chave", texto: "O site recusou a chave do Supabase (401). Confira a chave no painel do Supabase (Project Settings > API Keys)." },
    { envio: "token", texto: "O site recusou o token desta placa (403). Gere outro com npm run token:gerar." },
    { envio: "dados", texto: "O banco recusou os dados (400). Confira ID_BOLSAO no arquivo." },
    { envio: "funcao", texto: "O site não achou a função de envio (404). Rode as migrations com npm run db:aplicar." },
    { envio: "schema", texto: "O site não liberou o schema vagas (406). Libere o schema vagas na API do Supabase." },
    { envio: "portal", texto: "A rede pediu login no navegador. Peça à TI para liberar o MAC 24:6F:28:AA:BB:CC." },
    { envio: "sem_internet", texto: "A placa tem Wi-Fi, mas o site não respondeu. Confira se a rede libera a internet." },
    { envio: "outro", extra: { ultimo_ok_s: 95 }, texto: "O último envio certo foi há 95 s. Confira o monitor serial." },
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

/** Razão de contraste WCAG de cada texto visível contra o primeiro fundo opaco acima dele. */
async function contrastes(page: Page): Promise<{ texto: string; razao: number; minimo: number; cor: string; fundo: string }[]> {
  return page.evaluate(() => {
    function canal(v: number) {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    function rgb(cor: string): [number, number, number, number] | null {
      const m = cor.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    function lum([r, g, b]: number[]) {
      return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    }
    function fundoDe(el: Element): [number, number, number, number] {
      let atual: Element | null = el;
      while (atual) {
        const c = rgb(getComputedStyle(atual).backgroundColor);
        if (c && c[3] > 0) return c;
        atual = atual.parentElement;
      }
      return [255, 255, 255, 1];
    }
    const saida: { texto: string; razao: number; minimo: number; cor: string; fundo: string }[] = [];
    const todos = document.body.querySelectorAll("*");
    for (const el of todos) {
      const direto = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()).map((n) => n.textContent!.trim()).join(" ");
      if (!direto) continue;
      const h = el as HTMLElement;
      if (!h.checkVisibility()) continue;
      const est = getComputedStyle(h);
      const cor = rgb(est.color);
      if (!cor) continue;
      const fundo = fundoDe(h);
      const l1 = lum(cor), l2 = lum(fundo);
      const razao = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const px = parseFloat(est.fontSize);
      const negrito = parseInt(est.fontWeight, 10) >= 700;
      const minimo = px >= 24 || (negrito && px >= 18.66) ? 3 : 4.5;
      saida.push({ texto: direto.slice(0, 40), razao: Math.round(razao * 100) / 100, minimo, cor: est.color, fundo: `rgb(${fundo.slice(0, 3).join(", ")})` });
    }
    return saida;
  });
}

test.describe("página local da placa: cores e ícones do site", () => {
  test("o HTML não tem emoji", () => {
    expect(htmlDaPlaca()).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("com 0 livres mostra LOTADO, sem o vermelho antigo nas vagas", async ({ page }) => {
    const { contagem } = await abrirPagina(page, responderCom(status({ vagas: [true, true, true, true] })));
    await expect(page.locator("#livres")).toHaveText("LOTADO");
    await expect(page.locator("#rotulo")).toHaveText("0 de 4 livres");
    await expect(page.locator("#resumo")).toHaveClass(/lotado/);
    await expect(page.locator(".vaga.ocupada")).toHaveCount(4);
    await expect(page.locator(".vaga.ocupada svg")).toHaveCount(4);
    for (const vaga of await page.locator(".vaga").all()) {
      for (const prop of ["border-top-color", "background-color", "color"]) {
        expect(await vaga.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)).not.toBe("rgb(239, 68, 68)");
      }
    }
    expect(contagem.foraDaPlaca).toBe(0);
  });

  test("todo texto visível tem contraste de 4,5:1 (3:1 nos grandes), nos três estados", async ({ page }) => {
    const ruins = (lista: Awaited<ReturnType<typeof contrastes>>) => {
      expect(lista.length).toBeGreaterThanOrEqual(6);
      return lista.filter((c) => c.razao < c.minimo);
    };
    const { trocarResposta, contagem } = await abrirPagina(page, pendurar);
    expect(ruins(await contrastes(page))).toEqual([]);

    trocarResposta(responderCom(status({ envio: "token" })));
    await page.clock.runFor(4000);
    await expect(page.locator("#livres")).toHaveText("3");
    expect(ruins(await contrastes(page))).toEqual([]);

    trocarResposta(responderCom(status({ vagas: [true, true, true] })));
    await page.clock.runFor(2000);
    await expect(page.locator("#livres")).toHaveText("LOTADO");
    expect(ruins(await contrastes(page))).toEqual([]);
    expect(contagem.foraDaPlaca).toBe(0);
  });
});

test.describe("página local da placa: grade para testar os sensores", () => {
  const VINTE = Array.from({ length: 20 }, (_, i) => i % 3 === 0);

  test("com 20 vagas a grade cabe em 360x740 sem rolagem horizontal, com GPIO e estado numa linha", async ({ page }) => {
    await abrirPagina(page, responderCom(status({ vagas: VINTE })));
    await expect(page.locator(".vaga")).toHaveCount(20);
    const patio = page.locator("#patio");
    expect((await patio.boundingBox())!.height).toBeLessThanOrEqual(420);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
    for (const vaga of await page.locator(".vaga").all()) {
      await expect(vaga).toContainText(/GPIO \d+/);
      await expect(vaga).toContainText(/Vaga \d+/);
      await expect(vaga).toContainText(/Livre|Ocupada/);
      const status = vaga.locator(".status");
      const alturaLinha = await status.evaluate((el) => {
        const est = getComputedStyle(el);
        return { altura: el.getBoundingClientRect().height, fonte: parseFloat(est.fontSize) };
      });
      expect(alturaLinha.altura, "estado numa linha só").toBeLessThan(alturaLinha.fonte * 1.8);
    }
    const ocupadas = page.locator(".vaga.ocupada");
    await expect(ocupadas.first()).toContainText("Ocupada");
    await expect(ocupadas.first().locator("svg")).toHaveCount(1);
  });

  test("mudou_ha menor que 5 destaca só aquela vaga", async ({ page }) => {
    const mudou = Array.from({ length: 10 }, () => -1);
    mudou[7] = 2;
    await abrirPagina(page, responderCom(status({ vagas: Array(10).fill(false), mudou_ha: mudou, trocas_min: Array(10).fill(0) })));
    await expect(page.locator(".vaga.mudou")).toHaveCount(1);
    const destaque = page.locator(".vaga.mudou");
    await expect(destaque).toContainText("Vaga 8");
    await expect(destaque).toContainText("mudou agora");
    await expect(destaque).toHaveCSS("outline-width", "3px");
    await expect(destaque).toHaveCSS("outline-color", "rgb(238, 243, 247)");
    await expect(page.locator(".vaga").filter({ hasText: "mudou agora" })).toHaveCount(1);
    await expect(page.locator("#faixa-vaga")).toBeHidden();
  });

  test("trocas_min de 15 mostra instável e a frase; 11 não", async ({ page }) => {
    const trocas = Array(10).fill(0);
    trocas[2] = 15;
    const { trocarResposta } = await abrirPagina(page, responderCom(status({ vagas: Array(10).fill(false), mudou_ha: Array(10).fill(-1), trocas_min: trocas })));
    const instavel = page.locator(".vaga.instavel");
    await expect(instavel).toHaveCount(1);
    await expect(instavel).toContainText("Vaga 3");
    await expect(instavel).toContainText("instável");
    await expect(instavel).toHaveCSS("border-top-style", "dashed");
    await expect(instavel).toHaveCSS("border-top-color", "rgb(251, 191, 36)");
    await expect(page.locator("#faixa-vaga")).toHaveText("A vaga 3 (GPIO 34) trocou 15 vezes neste minuto. Confira o fio e o alinhamento do sensor.");
    // A faixa principal continua com a situação do envio.
    await expect(page.locator("#faixa-texto")).toContainText("A placa está enviando para o site.");

    trocas[2] = 11;
    trocarResposta(responderCom(status({ vagas: Array(10).fill(false), mudou_ha: Array(10).fill(-1), trocas_min: [...trocas] })));
    await page.clock.runFor(2000);
    await expect(page.locator(".vaga.instavel")).toHaveCount(0);
    await expect(page.locator("#patio")).not.toContainText("instável");
    await expect(page.locator("#faixa-vaga")).toBeHidden();
  });
});

test.describe("página local da placa: vagas especiais", () => {
  test("mostra o tipo da vaga e o aviso de VAGAS_PCD errado", async ({ page }) => {
    const { trocarResposta } = await abrirPagina(page, responderCom(status({ especiais: { pcd: [0, 1], idoso: [3] } })));
    await expect(page.locator(".vaga").nth(0)).toContainText("Vaga 1 (PCD)");
    await expect(page.locator(".vaga").nth(1)).toContainText("Vaga 2 (PCD)");
    await expect(page.locator(".vaga").nth(3)).toContainText("Vaga 4 (Idoso)");
    await expect(page.locator(".vaga").nth(2)).not.toContainText("(");
    await expect(page.locator("#faixa-config")).toBeHidden();

    trocarResposta(responderCom(status({ aviso_config: "VAGAS_PCD tem a vaga 7, mas N_VAGAS é 5" })));
    await page.clock.runFor(2000);
    await expect(page.locator("#faixa-config")).toHaveText("VAGAS_PCD tem a vaga 7, mas N_VAGAS é 5. O site fica sem as vagas especiais desta placa.");
    await expect(page.locator("#faixa-texto")).toContainText("A placa está enviando para o site.");
    await expect(page.locator(".vaga").nth(0)).not.toContainText("(");
  });
});

// ---------------- maquete: uma placa com vários bolsões ----------------

interface BolsaoMaquete {
  id: string;
  nome: string;
  vagas: boolean[];
  livres: number;
  pinos: number[];
  mudou_ha: number[];
  trocas_min: number[];
  especiais: Record<string, number[]>;
}

function bolsaoMaquete(id: string, vagas: boolean[], extra: Partial<BolsaoMaquete> = {}): BolsaoMaquete {
  return {
    id,
    nome: `Bloco ${id}`,
    vagas,
    livres: vagas.filter((v) => !v).length,
    pinos: vagas.map((_, i) => 30 + i),
    mudou_ha: vagas.map(() => -1),
    trocas_min: vagas.map(() => 0),
    especiais: {},
    ...extra,
  };
}

function statusMaquete(bolsoes: BolsaoMaquete[], extra: Record<string, unknown> = {}) {
  const { vagas: _v, pinos: _p, mudou_ha: _m, trocas_min: _t, especiais: _e, bolsao: _b, nome: _n, ...comum } = status();
  void [_v, _p, _m, _t, _e, _b, _n];
  return { ...comum, bolsoes, livres: bolsoes.reduce((s, b) => s + b.livres, 0), intervalo_s: 3, ...extra };
}

test.describe("página local da maquete", () => {
  const HTML_MAQUETE = () => htmlDaPlaca(join("firmware", "maquete", "maquete.ino"));
  const tres = () => [bolsaoMaquete("A", [false, true, false], { especiais: { pcd: [0] } }), bolsaoMaquete("C", [true, true, true]), bolsaoMaquete("H", [false, false, false], { especiais: { idoso: [0] } })];

  test("antes da primeira resposta mostra SEM DADOS, sem bolsão nem dígito", async ({ page }) => {
    const { contagem } = await abrirPagina(page, pendurar, HTML_MAQUETE());
    await esperarSemDados(page);
    await expect(page.locator(".bolsao")).toHaveCount(0);
    await expect(page).toHaveTitle("Placa da maquete");
    expect(contagem.foraDaPlaca).toBe(0);
  });

  test("mostra cada bolsão com o seu resumo e a sua grade, e volta para SEM DADOS depois de 21 s", async ({ page }) => {
    const { trocarResposta, contagem } = await abrirPagina(page, responderCom(statusMaquete(tres()) as unknown as StatusPlaca), HTML_MAQUETE());
    await expect(page.locator(".bolsao")).toHaveCount(3);
    await expect(page.locator("#resumo")).toBeHidden();
    const a = page.locator(".bolsao[data-id=A]");
    await expect(a.locator("h2")).toHaveText("Bloco A");
    await expect(a.locator(".numero")).toHaveText("2");
    await expect(a.locator(".vaga")).toHaveCount(3);
    await expect(a.locator(".vaga").nth(0)).toContainText("Vaga 1 (PCD)");
    await expect(a.locator(".vaga").nth(1)).toHaveClass(/ocupada/);
    const c = page.locator(".bolsao[data-id=C]");
    await expect(c.locator(".numero")).toHaveText("LOTADO");
    await expect(c.locator(".rotulo")).toHaveText("0 de 3 livres");
    await expect(c.locator(".resumo")).toHaveClass(/lotado/);
    const h = page.locator(".bolsao[data-id=H]");
    await expect(h.locator(".numero")).toHaveText("3");
    await expect(h.locator(".vaga").nth(0)).toContainText("Vaga 1 (Idoso)");
    await expect(page.locator("#faixa-texto")).toHaveText("A placa está enviando para o site. O último envio foi há 3 s.");
    await expect(page.locator("#detalhes")).toContainText("Envio: a cada 3 s");
    expect(HTML_MAQUETE()).not.toMatch(/\p{Extended_Pictographic}/u);

    trocarResposta(abortar);
    await page.clock.runFor(21000);
    await esperarSemDados(page);
    await expect(page.locator(".bolsao")).toHaveCount(0);
    expect(contagem.foraDaPlaca).toBe(0);
  });

  test("faixa fora de ok cita os três blocos e a vaga instável diz o bolsão", async ({ page }) => {
    const bolsoes = tres();
    bolsoes[2].trocas_min = [0, 15, 0];
    await abrirPagina(page, responderCom(statusMaquete(bolsoes, { envio: "token" }) as unknown as StatusPlaca), HTML_MAQUETE());
    await expect(page.locator("#faixa-texto")).toHaveText("O site recusou o token desta placa (403). Gere outro com npm run token:gerar.");
    await expect(page.locator("#faixa-extra")).toHaveText("Enquanto isso, o site mostra SEM DADOS para Bloco A, Bloco C, Bloco H.");
    await expect(page.locator("#faixa-vaga")).toHaveText("A vaga 2 do Bloco H (GPIO 31) trocou 15 vezes neste minuto. Confira o fio e o alinhamento do sensor.");
    await expect(page.locator(".bolsao[data-id=H] .vaga.instavel")).toHaveCount(1);
  });

  test("statusJson da maquete não cita senha, token, chave nem o MAC do softAP", () => {
    const ino = readFileSync(join(process.cwd(), "firmware", "maquete", "maquete.ino"), "utf8");
    const ini = ino.indexOf("void statusJson()");
    const fim = ino.indexOf("\n}\n", ini);
    expect(ini).toBeGreaterThan(0);
    const corpo = ino.slice(ini, fim);
    for (const proibido of ["TOKEN_CENTRAL", "WIFI_SENHA", "SUPABASE_ANON_KEY", "softAPmacAddress", "AP_SENHA"]) {
      expect(corpo, proibido).not.toContain(proibido);
    }
  });
});
