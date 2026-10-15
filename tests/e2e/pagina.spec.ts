import { expect, test } from "@playwright/test";
import { linha, supabaseFalso } from "./supabase-falso";

const agoraIso = () => new Date().toISOString();
const ha = (s: number) => new Date(Date.now() - s * 1000).toISOString();

test.describe("página das vagas", () => {
  test("antes do primeiro dado, todos os cartões mostram SEM DADOS e nenhum número", async ({ page }) => {
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, null, null), linha("C", "Bloco C", 2, null, null), linha("H", "Bloco H", 3, null, null)],
      agora: agoraIso,
    });
    await page.goto("/");
    for (const id of ["A", "C", "H"]) {
      const cartao = page.getByTestId(`cartao-${id}`);
      await expect(cartao).toHaveAttribute("data-situacao", "sem-dados");
      await expect(cartao).toContainText("SEM DADOS");
      await expect(cartao).not.toContainText(/\b\d+\b/);
      await expect(page.getByTestId(`grade-${id}`)).toHaveAttribute("data-sem-dados", "sim");
    }
    await expect(page.getByTestId("secao-A")).toContainText("Os sensores deste bloco ainda não mandaram dados.");
    await expect(page.getByTestId("secao-A")).not.toContainText("(");
    await expect(page.getByTestId("secao-A")).not.toContainText(/bols[ãa]o/i);
    await expect(page.getByTestId("faixa-demo")).toHaveCount(0);
    await expect(page.getByTestId("status-conexao")).toHaveAttribute("data-status", "ao-vivo");
    await expect(page.getByTestId("status-conexao")).toHaveAttribute("data-indicador", "sem-sensores");
    await expect(page.getByTestId("status-conexao")).toContainText("Sensores sem dados");
    await expect(page.getByTestId("legenda")).toHaveCount(0);
  });

  test("com dado fresco mostra o número certo, a grade com as cores certas e as vagas especiais", async ({ page }) => {
    await supabaseFalso(page, {
      bolsoes: [
        linha("A", "Bloco A", 1, "0110100", agoraIso(), { pcd: [0, 1] }),
        linha("C", "Bloco C", 2, "1111", agoraIso()),
        linha("H", "Bloco H", 3, "0000000000000", agoraIso()),
      ],
      agora: agoraIso,
    });
    await page.goto("/");

    // O número conta só as vagas comuns: A tem 4 livres, 1 delas PCD.
    const a = page.getByTestId("cartao-A");
    // 3 comuns livres de 5 é "poucas" (limite 3)
    await expect(a).toHaveAttribute("data-situacao", "poucas");
    await expect(a).toContainText("3");
    await expect(a).toContainText("livres");
    await expect(a).toContainText("Poucas");
    await expect(a).toContainText("+1 especial");
    await expect(page.getByTestId("cartao-C")).toHaveAttribute("data-situacao", "lotado");
    await expect(page.getByTestId("cartao-C")).toContainText("LOTADO");
    await expect(page.getByTestId("cartao-H")).toHaveAttribute("data-situacao", "livre");
    await expect(page.getByTestId("cartao-H")).toContainText("13");
    await expect(page.getByTestId("status-conexao")).toHaveAttribute("data-indicador", "ao-vivo");

    const grade = page.getByTestId("grade-A");
    await expect(grade).toHaveAttribute("data-sem-dados", "nao");
    const celulas = grade.locator("[data-vaga]");
    await expect(celulas).toHaveCount(7);
    const estados = await celulas.evaluateAll((els) => els.map((e) => e.getAttribute("data-vaga")));
    expect(estados).toEqual(["livre", "ocupada", "ocupada", "livre", "ocupada", "livre", "livre"]);
    const corLivre = await celulas.nth(0).evaluate((e) => getComputedStyle(e).backgroundColor);
    const corOcupada = await celulas.nth(1).evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(corLivre).not.toBe(corOcupada);
    await expect(grade.locator("[data-tipo=pcd]")).toHaveCount(2);
    // Até 12 vagas a grade é a grande, numerada, com ícones.
    for (const c of await celulas.all()) expect((await c.boundingBox())!.width).toBeGreaterThanOrEqual(40);
    await expect(grade.locator("[data-vaga=ocupada] [data-icone=carro]")).toHaveCount(3);
    await expect(grade.locator("[data-tipo=pcd][data-vaga=livre] [data-icone=cadeirante]")).toHaveCount(1);

    await expect(page.getByTestId("secao-A")).toContainText("3 livres de 5 vagas comuns");
    await expect(page.getByTestId("especial-pcd")).toContainText("PCD: 1 livre");
    await expect(page.getByTestId("secao-A")).toContainText("Atualizado agora");
    await expect(page.getByTestId("legenda")).toContainText("Livre");
    await expect(page.getByTestId("legenda")).toContainText("P: PCD");
    await expect(page.getByTestId("legenda")).not.toContainText("Idoso");
    await expect(page.getByTestId("resumo")).toContainText("O Bloco H tem mais vagas: 13 livres.");
  });

  test("com 13 ou mais vagas a grade fica compacta, e a especial livre mostra a letra", async ({ page }) => {
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "00111", agoraIso(), { pcd: [0], idoso: [1] }), linha("C", "Bloco C", 2, "0".repeat(13), agoraIso(), { pcd: [0] }), linha("H", "Bloco H", 3, null, null)],
      agora: agoraIso,
    });
    await page.goto("/");
    const compacta = page.getByTestId("grade-C").locator("[data-vaga]");
    await expect(compacta).toHaveCount(13);
    expect((await compacta.first().boundingBox())!.width).toBeLessThan(30);
    await expect(page.getByTestId("grade-C").locator("[data-tipo=pcd][data-vaga=livre]")).toHaveText("P");
    await expect(page.getByTestId("grade-A").locator("[data-tipo]").first()).toHaveCSS("outline-style", "solid");
    await expect(page.getByTestId("legenda")).toContainText("I: Idoso");
    // A só tem as especiais livres: LOTADO com "+2 especiais"
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "lotado");
    await expect(page.getByTestId("cartao-A")).toContainText("+2 especiais");
    await expect(page.getByTestId("cartao-A")).not.toContainText("livre");
  });

  test("dado que envelhece 31 s vira SEM DADOS com a grade vazia e listrada", async ({ page }) => {
    await page.clock.install();
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "0000000000", agoraIso()), linha("C", "Bloco C", 2, "0000000000", agoraIso()), linha("H", "Bloco H", 3, "0000000000", agoraIso())],
      agora: agoraIso,
    });
    await page.goto("/");
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");

    await page.clock.runFor(20_000);
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
    await expect(page.getByTestId("secao-A")).toContainText(/há \d+ s/);

    await page.clock.runFor(12_000);
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "sem-dados");
    await expect(page.getByTestId("cartao-A")).not.toContainText(/\b\d+\b/);
    const grade = page.getByTestId("grade-A");
    await expect(grade).toHaveAttribute("data-sem-dados", "sim");
    await expect(grade.locator("[data-vaga]")).toHaveCount(0);
    await expect(grade).toContainText(/Sem dados desde \d{2}:\d{2}/);
    await expect(page.getByTestId("secao-A")).toContainText(/O último dado dos sensores chegou às \d{2}:\d{2}\./);
    await expect(page.getByTestId("resumo")).not.toContainText(/\d+ livres/);
  });

  test("zero com dado fresco mostra LOTADO, e um UPDATE pelo Realtime muda a tela", async ({ page }) => {
    const sb = await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "111", agoraIso()), linha("C", "Bloco C", 2, "000", agoraIso()), linha("H", "Bloco H", 3, "000", agoraIso())],
      agora: agoraIso,
    });
    await page.goto("/");
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "lotado");
    await expect(page.getByTestId("cartao-A")).toContainText("LOTADO");
    await expect.poll(() => sb.assinado()).toBe(true);

    const ultimoAntes = await page.getByTestId("pulso-dado").getAttribute("data-ultimo");
    sb.atualizar(linha("A", "Bloco A", 1, "011", agoraIso()));
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "poucas");
    await expect(page.getByTestId("cartao-A")).toContainText("1");
    await expect(page.getByTestId("cartao-A")).toContainText("Poucas");
    await expect(page.getByTestId("secao-A")).toContainText("1 livre de 3");
    await expect(page.getByTestId("pulso-dado")).not.toHaveAttribute("data-ultimo", ultimoAntes!);
  });

  test("os três cartões ficam lado a lado em 360 px sem rolagem horizontal, com o mesmo esqueleto", async ({ page }) => {
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "0101", agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
      agora: agoraIso,
    });
    await page.goto("/");
    const caixas = await Promise.all(["A", "C", "H"].map((id) => page.getByTestId(`cartao-${id}`).boundingBox()));
    for (const c of caixas) expect(c).not.toBeNull();
    const [a, c, h] = caixas as { x: number; y: number; width: number; height: number }[];
    expect(Math.abs(a.y - c.y)).toBeLessThan(2);
    expect(Math.abs(c.y - h.y)).toBeLessThan(2);
    expect(a.x + a.width).toBeLessThanOrEqual(c.x + 1);
    expect(c.x + c.width).toBeLessThanOrEqual(h.x + 1);
    expect(h.x + h.width).toBeLessThanOrEqual(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    for (const caixa of [a, c, h]) expect(caixa.height).toBeGreaterThanOrEqual(44);
    // O "0" do LOTADO tem o mesmo tamanho do número do cartão livre
    const fonteLivre = await page.getByTestId("cartao-A").locator("[data-anim], span.tabular-nums").first().evaluate((e) => getComputedStyle(e).fontSize);
    const fonteLotado = await page.getByTestId("cartao-C").locator("span.tabular-nums").first().evaluate((e) => getComputedStyle(e).fontSize);
    expect(fonteLotado).toBe(fonteLivre);
    const semDados = page.getByTestId("cartao-H").getByText("SEM DADOS");
    expect(parseFloat(await semDados.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14);
    // O topo dos cartões fica perto do topo da tela
    expect(a.y).toBeLessThanOrEqual(200);
  });

  test("em 320 px nada transborda", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "0".repeat(123) + "1".repeat(377), agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
      agora: agoraIso,
    });
    await page.goto("/");
    await expect(page.getByTestId("cartao-A")).toContainText("123");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const h = (await page.getByTestId("cartao-H").boundingBox())!;
    const texto = (await page.getByTestId("cartao-H").getByText("SEM DADOS").boundingBox())!;
    expect(texto.x + texto.width).toBeLessThanOrEqual(h.x + h.width + 1);
    const h1 = (await page.locator("h1").boundingBox())!;
    expect(h1.height).toBeLessThanOrEqual(32);
  });

  test("tocar no cartão rola até a seção e a destaca sem mudar o endereço", async ({ page }) => {
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "0".repeat(40), agoraIso()), linha("C", "Bloco C", 2, "0".repeat(40), agoraIso()), linha("H", "Bloco H", 3, "0".repeat(60), agoraIso())],
      agora: agoraIso,
    });
    await page.goto("/");
    await page.getByTestId("cartao-H").click();
    await expect(page.getByTestId("secao-H")).toHaveAttribute("data-destaque", "sim");
    await expect(page.getByTestId("secao-H")).toBeInViewport();
    expect(await page.evaluate(() => location.hash)).toBe("");
    await expect(page.getByTestId("secao-H")).not.toHaveAttribute("data-destaque", "sim", { timeout: 3000 });
  });

  test("?demo=1 mostra a faixa de demonstração presa no topo, com saída para os dados reais", async ({ page }) => {
    let chamouRest = false;
    await page.route(/\/rest\/v1\//, async (rota) => {
      chamouRest = true;
      await rota.abort();
    });
    await page.goto("/?demo=1");
    await expect(page.getByTestId("faixa-demo")).toContainText("Demonstração");
    await expect(page.getByTestId("cartao-A")).not.toHaveAttribute("data-situacao", "sem-dados");
    await expect(page.getByTestId("status-conexao")).toContainText("Simulação");
    expect(await page.title()).toContain("Demonstração");
    await page.evaluate(() => window.scrollTo(0, 900));
    const faixa = (await page.getByTestId("faixa-demo").boundingBox())!;
    expect(faixa.y).toBeGreaterThanOrEqual(0);
    expect(faixa.y + faixa.height).toBeLessThanOrEqual(740);
    expect(chamouRest).toBe(false);
    await page.getByRole("link", { name: "Ver as vagas reais" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("faixa-demo")).toHaveCount(0);
  });

  test("sem ?demo=1 nada é simulado: a tela segue o que o banco devolve", async ({ page }) => {
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, null, null), linha("C", "Bloco C", 2, null, null), linha("H", "Bloco H", 3, null, null)],
      agora: agoraIso,
    });
    await page.goto("/");
    await expect(page.getByTestId("status-conexao")).toHaveAttribute("data-status", "ao-vivo");
    await page.waitForTimeout(5_000);
    for (const id of ["A", "C", "H"]) {
      await expect(page.getByTestId(`cartao-${id}`)).toHaveAttribute("data-situacao", "sem-dados");
    }
    await expect(page.getByTestId("faixa-demo")).toHaveCount(0);
  });

  test("se a API falhar, a página diz que está sem conexão, sem culpar o sensor, e tenta de novo", async ({ page }) => {
    let falhas = 0;
    await page.route(/\/rest\/v1\//, (rota) => {
      falhas++;
      return rota.fulfill({ status: 500, body: "erro" });
    });
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => ws.close({ code: 1006 }));
    await page.goto("/");
    await expect(page.getByTestId("aviso-erro")).toBeVisible();
    await expect(page.getByTestId("aviso-erro")).toContainText("tenta de novo a cada 10 s");
    await expect(page.getByTestId("status-conexao")).toHaveAttribute("data-indicador", "sem-conexao");
    for (const id of ["A", "C", "H"]) {
      await expect(page.getByTestId(`cartao-${id}`)).toHaveAttribute("data-situacao", "sem-dados");
    }
    await expect(page.getByTestId("secao-A")).toContainText("sem conexão com o servidor");
    await expect(page.getByTestId("secao-A")).not.toContainText("sensor");
    await expect(page.getByTestId("resumo")).toHaveCount(0);
    // Depois que a API volta, o botão "Tentar agora" recupera a página
    await page.unroute(/\/rest\/v1\//);
    await supabaseFalso(page, { bolsoes: [linha("A", "Bloco A", 1, "0000000000", agoraIso())], agora: agoraIso });
    await page.getByRole("button", { name: "Tentar agora" }).click();
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
    await expect(page.getByTestId("aviso-erro")).toHaveCount(0);
    expect(falhas).toBeGreaterThanOrEqual(1);
  });

  test("com o Realtime bloqueado, a página continua lendo a API a cada 10 s", async ({ page }) => {
    await page.clock.install();
    const sb = await supabaseFalso(page, {
      bolsoes: () => [linha("A", "Bloco A", 1, "0000000000", agoraIso()), linha("C", "Bloco C", 2, null, null), linha("H", "Bloco H", 3, null, null)],
      agora: agoraIso,
      realtime: false,
    });
    await page.goto("/");
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
    const cargasIniciais = sb.cargas();
    for (let i = 0; i < 6; i++) await page.clock.runFor(10_000);
    await expect.poll(() => sb.cargas()).toBeGreaterThanOrEqual(cargasIniciais + 5);
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
    // Um UPDATE que não chega e um dado fixo de 60 s atrás continuam virando SEM DADOS
    sb.definir([linha("A", "Bloco A", 1, "0000000000", ha(60))]);
    await page.clock.runFor(11_000);
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "sem-dados");
    await expect(page.getByTestId("cartao-A")).not.toContainText(/\d/);
  });

  test("a primeira leitura chega antes do supabase-js", async ({ page }) => {
    await page.route(/\/_next\/static\/.*\.js$/, async (rota) => {
      const resposta = await rota.fetch();
      const corpo = await resposta.text();
      if (corpo.includes("RealtimeClient")) {
        await new Promise((r) => setTimeout(r, 8_000));
      }
      await rota.fulfill({ response: resposta, body: corpo });
    });
    await supabaseFalso(page, { bolsoes: [linha("A", "Bloco A", 1, "0000000000", agoraIso())], agora: agoraIso });
    await page.goto("/");
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre", { timeout: 6_000 });
    await expect(page.getByTestId("status-conexao")).toHaveAttribute("data-indicador", "ao-vivo");
  });

  test("enquanto carrega, a tela diz que está carregando e não culpa o sensor", async ({ page }) => {
    await page.route(/\/rest\/v1\/bolsoes/, async (rota) => {
      await new Promise((r) => setTimeout(r, 2_500));
      await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([linha("A", "Bloco A", 1, "0000000000", agoraIso())]) });
    });
    await page.route(/\/rest\/v1\/rpc\/agora/, (rota) => rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(agoraIso()) }));
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, () => {});
    await page.goto("/");
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "sem-dados");
    await expect(page.getByTestId("secao-A")).toContainText("carregando as vagas");
    await expect(page.getByTestId("secao-A")).not.toContainText("sensor");
    await expect(page.getByTestId("status-conexao")).toContainText("Conectando");
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
  });

  test("aviso da manutenção aparece só junto do SEM DADOS", async ({ page }) => {
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "0000", agoraIso(), {}, { aviso: "Sensor em conserto até sexta" }), linha("H", "Bloco H", 3, "0000", ha(2 * 86_400), {}, { aviso: "Sensor em conserto até sexta" })],
      agora: agoraIso,
    });
    await page.goto("/");
    await expect(page.getByTestId("aviso-manutencao-H")).toContainText("Aviso da manutenção: Sensor em conserto até sexta");
    await expect(page.getByTestId("cartao-H")).not.toContainText(/\d/);
    await expect(page.getByTestId("aviso-manutencao-A")).toHaveCount(0);
  });

  test("com ?maquete=1 só o bloco de maquete aparece, e sem o parâmetro ele fica de fora", async ({ page }) => {
    const sb = await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "1111", agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, "1111", agoraIso()), linha("M", "Bloco M (maquete)", 9, "010", agoraIso(), {}, { publico: false })],
      agora: agoraIso,
    });
    await page.goto("/");
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "lotado");
    await expect(page.getByTestId("cartao-M")).toHaveCount(0);
    await expect.poll(() => sb.assinado()).toBe(true);
    sb.atualizar(linha("M", "Bloco M (maquete)", 9, "000", agoraIso(), {}, { publico: false }));
    await page.waitForTimeout(500);
    await expect(page.getByTestId("cartao-M")).toHaveCount(0);
    await expect(page.getByTestId("resumo")).toContainText("Os três estacionamentos estão lotados.");

    await page.goto("/?maquete=1");
    await expect(page.getByTestId("cartao-M")).toHaveAttribute("data-situacao", "poucas");
    await expect(page.getByTestId("cartao-A")).toHaveCount(0);
    await expect(page.getByTestId("faixa-maquete")).toContainText("Maquete");
  });
});
