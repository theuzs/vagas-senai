import { expect, test } from "@playwright/test";
import { linha, supabaseFalso } from "./supabase-falso";

const agoraIso = () => new Date().toISOString();
const ha = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const rep = (total: number, livres: number) => "0".repeat(livres) + "1".repeat(total - livres);

test("o mapa mostra cada estacionamento pelo estado, sem número, depois das seções", async ({ page }) => {
  await supabaseFalso(page, {
    bolsoes: [linha("A", "Bloco A", 1, "0000000000", agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
    agora: agoraIso,
  });
  await page.goto("/");
  await expect(page.getByTestId("mapa")).toBeVisible();
  await expect(page.getByTestId("mapa-A")).toHaveAttribute("data-situacao", "livre");
  await expect(page.getByTestId("mapa-C")).toHaveAttribute("data-situacao", "lotado");
  await expect(page.getByTestId("mapa-C").locator("[data-icone=bloqueio]")).toHaveCount(1);
  await expect(page.getByTestId("mapa-C").locator("[data-listras=sim]")).toHaveCount(0);
  await expect(page.getByTestId("mapa-H")).toHaveAttribute("data-situacao", "sem-dados");
  await expect(page.getByTestId("mapa-H").locator("[data-listras=sim]")).toHaveCount(1);
  await expect(page.getByTestId("mapa-H").locator("[data-icone=alerta]")).toHaveCount(1);
  expect(await page.getByTestId("mapa-H").locator("rect").first().getAttribute("stroke-dasharray")).toBeTruthy();
  await expect(page.getByTestId("mapa")).not.toContainText(/\d/);
  await expect(page.getByTestId("mapa")).not.toContainText(/bols[ãa]o/i);
  // vem depois das seções no DOM e os textos do SVG são legíveis em 360 px
  const ordem = await page.evaluate(() => {
    const secao = document.querySelector("[data-testid=secao-H]")!;
    const mapa = document.querySelector("[data-testid=mapa]")!;
    return secao.compareDocumentPosition(mapa) & Node.DOCUMENT_POSITION_FOLLOWING ? "depois" : "antes";
  });
  expect(ordem).toBe("depois");
  const menorFonte = await page.evaluate(() => {
    const svg = document.querySelector("[data-testid=mapa] svg") as SVGSVGElement;
    const escala = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    return Math.min(...[...svg.querySelectorAll("text")].map((t) => parseFloat(t.getAttribute("fontSize") ?? t.getAttribute("font-size") ?? "0") * escala));
  });
  expect(menorFonte).toBeGreaterThanOrEqual(11);
});

test.describe("tela da guarita", () => {
  // A guarita roda num PC: sem emulação de celular, que aumenta os textos sozinha.
  test.use({ isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  for (const tela of [
    { width: 1024, height: 768 },
    { width: 1280, height: 1024 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    test(`cabe sem rolagem em ${tela.width}x${tela.height}, com 500 vagas, e mostra os três lado a lado`, async ({ page }) => {
      await page.setViewportSize(tela);
      await supabaseFalso(page, {
        bolsoes: [linha("A", "Bloco A", 1, rep(500, 123), agoraIso(), { pcd: [0, 1], idoso: [2] }), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
        agora: agoraIso,
      });
      await page.goto("/guarita");
      await expect(page.getByTestId("guarita-A")).toHaveAttribute("data-situacao", "livre");
      await expect(page.getByTestId("guarita-A")).toContainText("120");
      // espera a animação de entrada do número, que conta no scrollHeight enquanto roda
      await page.waitForTimeout(800);
      const caixas = await Promise.all(["A", "C", "H"].map((id) => page.getByTestId(`guarita-${id}`).boundingBox()));
      const [a, c, h] = caixas as { x: number; y: number; width: number; height: number }[];
      expect(Math.abs(a.y - c.y)).toBeLessThan(2);
      expect(Math.abs(c.y - h.y)).toBeLessThan(2);
      expect(a.x + a.width).toBeLessThan(c.x);
      expect(c.x + c.width).toBeLessThan(h.x);
      const rolagem = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
      expect(rolagem.w).toBeLessThanOrEqual(tela.width);
      expect(rolagem.h).toBeLessThanOrEqual(tela.height);
      for (const id of ["A", "C", "H"]) {
        const meio = page.getByTestId(`meio-${id}`);
        const m = await meio.evaluate((e) => ({ s: e.scrollHeight, c: e.clientHeight }));
        expect(m.s).toBeLessThanOrEqual(m.c + 1);
      }
      expect(parseFloat(await page.getByTestId("letra-A").evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(64);
      // os centros das três colunas ficam na mesma altura
      const centros = await Promise.all(["A", "C", "H"].map((id) => page.getByTestId(`centro-${id}`).boundingBox()));
      expect(Math.abs(centros[0]!.y + centros[0]!.height / 2 - (centros[1]!.y + centros[1]!.height / 2))).toBeLessThan(2);
      // barra: A tem 123/500 livres; C nada livre; H sem parte e sem dígito
      const proporcao = await page.getByTestId("barra-A").evaluate((e) => {
        const livre = e.querySelector("[data-parte=livre]") as HTMLElement;
        return livre.getBoundingClientRect().width / e.getBoundingClientRect().width;
      });
      expect(proporcao).toBeGreaterThan(0.236);
      expect(proporcao).toBeLessThan(0.256);
      expect((await page.getByTestId("barra-C").locator("[data-parte=livre]").boundingBox())!.width).toBe(0);
      await expect(page.getByTestId("barra-H").locator("[data-parte]")).toHaveCount(0);
      await expect(page.getByTestId("guarita-A").locator("[data-vaga]")).toHaveCount(0);
      await expect(page.getByTestId("especiais-A")).toContainText("PCD: 2 livres · Idoso: 1 livre");
      await expect(page.getByTestId("guarita-A")).toContainText("de 500 vagas");
      await expect(page.getByTestId("especiais-H")).toHaveCount(0);
      const orientacao = await page.getByTestId("orientacao").boundingBox();
      expect(orientacao!.y + orientacao!.height).toBeLessThanOrEqual(tela.height);
    });
  }

  test("em 1366x768 os textos passam do mínimo para 3 m", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, rep(40, 12), agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
      agora: agoraIso,
    });
    await page.goto("/guarita");
    await expect(page.getByTestId("guarita-A")).toHaveAttribute("data-indicado", "sim");
    const fonte = async (sel: string) => parseFloat(await page.locator(sel).first().evaluate((e) => getComputedStyle(e).fontSize));
    expect(await fonte("[data-testid=letra-A]")).toBeGreaterThanOrEqual(76);
    expect(await fonte("[data-testid=orientacao] p")).toBeGreaterThanOrEqual(53);
    expect(await fonte("[data-testid=relogio]")).toBeGreaterThanOrEqual(62);
    // O aviso do centro precisa caber em duas linhas abaixo do SEM DADOS; 21 px a 3 m ainda lê (5,2').
    expect(await fonte("[data-testid=centro-H] span:nth-child(2)")).toBeGreaterThanOrEqual(21);
    expect(await fonte("[data-testid=status-conexao]")).toBeGreaterThanOrEqual(21);
    await expect(page.getByTestId("selo-indicado")).toContainText("INDIQUE ESTE");
    await expect(page.getByTestId("selo-indicado")).toBeInViewport();
    await expect(page.getByTestId("guarita-H")).toHaveCSS("border-top-width", "6px");
    await expect(page.getByTestId("guarita-A")).toHaveCSS("border-top-width", "3px");
    expect(await page.getByTestId("guarita-H").evaluate((e) => getComputedStyle(e).backgroundImage)).toContain("18px");
  });

  test("indica o bloco com mais vaga e avisa sobre o que está sem dados", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "0011111111", agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
      agora: agoraIso,
    });
    await page.goto("/guarita");
    await expect(page.getByTestId("orientacao")).toHaveAttribute("data-tipo", "indicar");
    await expect(page.getByTestId("orientacao")).toContainText("Indique o Bloco A: 2 vagas livres.");
    await expect(page.getByTestId("orientacao")).toContainText("Bloco H sem dados. Ele pode ter vaga.");
    await expect(page.getByTestId("guarita-A")).toHaveAttribute("data-indicado", "sim");
    await expect(page.getByTestId("guarita-C")).toContainText("LOTADO");
    await expect(page.getByTestId("guarita-H")).toContainText("SEM DADOS");
    await expect(page.getByTestId("guarita-H")).toContainText("Não diga que está lotado. Avise o responsável pelos sensores.");
    await expect(page.getByTestId("guarita-H")).not.toContainText(/\d+/);
    await expect(page.getByTestId("relogio")).toHaveText(/^\d{2}:\d{2}$/);
    await expect(page.getByTestId("versao")).toHaveText(/^Versão ([0-9a-f]{7}|local)$/);
  });

  test("com o resto lotado e um sem dado, o texto grande começa pelo bloco sem dados", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "1111", agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, "0000", ha(45))],
      agora: agoraIso,
    });
    await page.goto("/guarita");
    const primeiro = page.getByTestId("orientacao").locator("p").first();
    await expect(primeiro).toHaveText(/^Bloco H sem dados/);
    await expect(primeiro).not.toContainText("lotados");
    await expect(page.getByTestId("orientacao")).toContainText("Os sensores mostram os blocos A e C lotados.");
    await expect(page.getByTestId("guarita-H")).toContainText("Não diga que está lotado. O bloco pode ter vaga.");
  });

  test("o relógio mostra a hora e a data de agora assim que abre, e não as do build", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const momento = "2030-03-05T23:17:05-03:00";
    await page.clock.install({ time: new Date(momento) });
    await supabaseFalso(page, { bolsoes: [linha("A", "Bloco A", 1, null, null)], agora: () => momento });
    await page.goto("/guarita");
    await expect(page.getByTestId("relogio")).toHaveText("23:17");
    await expect(page.getByTestId("data-hoje")).toHaveText("Terça-feira, 5 de março");
  });

  test("com tudo lotado e depois sem dado, nunca diz que está tudo lotado, e a altura não pula", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.clock.install();
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "1111", agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, "1111", agoraIso())],
      agora: agoraIso,
    });
    await page.goto("/guarita");
    await expect(page.getByTestId("orientacao")).toHaveAttribute("data-tipo", "lotado");
    await expect(page.getByTestId("orientacao")).toContainText("Os três estacionamentos estão lotados.");
    const alturaAntes = (await page.getByTestId("guarita-A").boundingBox())!.height;
    await page.clock.runFor(41_000);
    await expect(page.getByTestId("orientacao")).toHaveAttribute("data-tipo", "sem-dados");
    await expect(page.getByTestId("orientacao")).not.toContainText("lotados");
    await expect(page.getByTestId("orientacao")).toContainText("Não diga ao motorista que está lotado.");
    expect(Math.abs((await page.getByTestId("guarita-A").boundingBox())!.height - alturaAntes)).toBeLessThan(2);
  });

  test("sem conexão, a faixa fala da tela, nada entra acima das colunas e o indicador é grande", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.route(/\/rest\/v1\//, (rota) => rota.fulfill({ status: 500, body: "erro" }));
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => ws.close({ code: 1006 }));
    await page.goto("/guarita");
    await expect(page.getByTestId("orientacao")).toContainText("Esta tela está sem conexão.", { timeout: 20_000 });
    await expect(page.getByTestId("aviso-erro")).toHaveCount(0);
    await expect(page.getByTestId("status-conexao")).toHaveAttribute("data-indicador", "sem-conexao");
    const y = (await page.getByTestId("guarita-A").boundingBox())!.y;
    await page.unroute(/\/rest\/v1\//);
    await supabaseFalso(page, { bolsoes: [linha("A", "Bloco A", 1, "0000", agoraIso())], agora: agoraIso });
    await page.goto("/guarita");
    await expect(page.getByTestId("guarita-A")).toHaveAttribute("data-situacao", "livre");
    expect(Math.abs((await page.getByTestId("guarita-A").boundingBox())!.y - y)).toBeLessThanOrEqual(1);
  });

  test("a indicação não troca de bloco a cada atualização quando a diferença é pequena", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const sb = await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, rep(40, 12), agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, rep(60, 11), agoraIso())],
      agora: agoraIso,
    });
    await page.goto("/guarita");
    await expect(page.getByTestId("guarita-A")).toHaveAttribute("data-indicado", "sim");
    await expect.poll(() => sb.assinado()).toBe(true);
    let trocas = 0;
    let anterior = "A";
    for (let i = 0; i < 6; i++) {
      sb.atualizar(linha("A", "Bloco A", 1, rep(40, i % 2 ? 12 : 11), agoraIso()));
      sb.atualizar(linha("H", "Bloco H", 3, rep(60, i % 2 ? 11 : 12), agoraIso()));
      await page.waitForTimeout(300);
      const indicado = (await page.getByTestId("guarita-A").getAttribute("data-indicado")) === "sim" ? "A" : "H";
      if (indicado !== anterior) trocas++;
      anterior = indicado;
    }
    expect(trocas).toBeLessThanOrEqual(1);
  });

  test("no quiosque o botão de tela cheia some e o cursor parado desaparece", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await supabaseFalso(page, { bolsoes: [linha("A", "Bloco A", 1, "0000", agoraIso())], agora: agoraIso });
    await page.goto("/guarita?quiosque=1");
    await expect(page.getByTestId("guarita-A")).toHaveAttribute("data-situacao", "livre");
    await expect(page.getByRole("button", { name: "Abrir em tela cheia" })).toHaveCount(0);
    await page.mouse.move(200, 200);
    await expect(page.getByTestId("tela-guarita")).toHaveCSS("cursor", "none", { timeout: 6_000 });
    await page.mouse.move(300, 300);
    await expect(page.getByTestId("tela-guarita")).not.toHaveCSS("cursor", "none");
  });

  test("com zoom de 200 % a guarita ganha rolagem e a faixa fica presa embaixo", async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: { width: 683, height: 384 }, deviceScaleFactor: 2 });
    const page = await contexto.newPage();
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, rep(40, 12), agoraIso(), { pcd: [0, 1] }), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
      agora: agoraIso,
    });
    await page.goto("/guarita");
    await expect(page.getByTestId("guarita-A")).toHaveAttribute("data-situacao", "livre");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(683);
    const faixa = (await page.getByTestId("orientacao").boundingBox())!;
    expect(faixa.y + faixa.height).toBeLessThanOrEqual(384 + 1);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const depois = (await page.getByTestId("orientacao").boundingBox())!;
    expect(depois.y + depois.height).toBeLessThanOrEqual(384 + 1);
    await contexto.close();
  });

  test("avisos falados com ?som=1", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.clock.install();
    await page.addInitScript(() => {
      (window as unknown as { __falas: string[] }).__falas = [];
      Object.defineProperty(window, "speechSynthesis", { value: { speak: (u: { text: string }) => (window as unknown as { __falas: string[] }).__falas.push(u.text) } });
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
        text: string;
        lang = "";
        onerror: unknown = null;
        constructor(t: string) {
          this.text = t;
        }
      };
    });
    const sb = await supabaseFalso(page, { bolsoes: [linha("A", "Bloco A", 1, "0000", agoraIso()), linha("C", "Bloco C", 2, "0000", agoraIso())], agora: agoraIso });
    await page.goto("/guarita?som=1");
    await expect(page.getByTestId("guarita-C")).toHaveAttribute("data-situacao", "livre");
    await expect.poll(() => sb.assinado()).toBe(true);
    // O relógio falso da página corre à frente do relógio do Node: o dado novo leva o mesmo avanço.
    await page.clock.runFor(21_000);
    sb.atualizar(linha("C", "Bloco C", 2, "1111", new Date(Date.now() + 21_000).toISOString()));
    await expect(page.getByTestId("guarita-C")).toHaveAttribute("data-situacao", "lotado");
    await page.clock.runFor(21_000);
    const falas = await page.evaluate(() => (window as unknown as { __falas: string[] }).__falas);
    expect(falas).toContain("Som ligado.");
    expect(falas).toContain("Bloco C lotou.");
  });
});

test("a demonstração mostra o mesmo número no celular e na guarita, e a cena do roteiro", async ({ browser }) => {
  const instante = new Date("2026-10-14T21:00:00.000Z");
  instante.setTime(Math.floor(instante.getTime() / 180_000) * 180_000 + 140_000);
  const celular = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const guarita = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const p1 = await celular.newPage();
  const p2 = await guarita.newPage();
  await p1.clock.install({ time: instante });
  await p2.clock.install({ time: instante });
  await p1.goto("/?demo=1");
  await p2.goto("/guarita?demo=1");
  await expect(p1.getByTestId("cartao-H")).toHaveAttribute("data-situacao", "sem-dados");
  await expect(p2.getByTestId("guarita-H")).toHaveAttribute("data-situacao", "sem-dados");
  await expect(p1.getByTestId("cena-demo")).toContainText("Cena 3 de 4");
  const n1 = (await p1.getByTestId("cartao-A").textContent())!.match(/\d+/)![0];
  await expect(p2.getByTestId("guarita-A")).toContainText(n1);
  expect(await p2.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(768);
  await celular.close();
  await guarita.close();
});

test("/qr tem o QR code e o endereço", async ({ page }) => {
  await page.goto("/qr");
  await expect(page.getByTestId("qr").locator("svg")).toBeVisible();
  await expect(page.locator("main")).toContainText("vagas.rubysistemas.com.br");
  await expect(page.locator("main")).toContainText(/aponte a câmera/i);
});
