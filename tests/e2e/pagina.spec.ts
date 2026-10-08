import { expect, test } from "@playwright/test";
import { linha, supabaseFalso } from "./supabase-falso";

const agoraIso = () => new Date().toISOString();

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
    await expect(page.getByTestId("secao-A")).toContainText("ainda não recebeu dados");
    await expect(page.getByTestId("faixa-demo")).toHaveCount(0);
    await expect(page.getByTestId("status-conexao")).toHaveAttribute("data-status", "ao-vivo");
  });

  test("com dado fresco mostra o número certo, a grade com as cores certas e as vagas especiais", async ({ page }) => {
    await supabaseFalso(page, {
      bolsoes: [
        linha("A", "Bloco A", 1, "0110100", agoraIso(), { pcd: [0, 1] }),
        linha("C", "Bloco C", 2, "1111", agoraIso()),
        linha("H", "Bloco H", 3, "0000000000", agoraIso()),
      ],
      agora: agoraIso,
    });
    await page.goto("/");

    const a = page.getByTestId("cartao-A");
    await expect(a).toHaveAttribute("data-situacao", "livre");
    await expect(a).toContainText("4");
    await expect(a).toContainText("livres");
    await expect(page.getByTestId("cartao-C")).toHaveAttribute("data-situacao", "lotado");
    await expect(page.getByTestId("cartao-C")).toContainText("LOTADO");
    await expect(page.getByTestId("cartao-H")).toHaveAttribute("data-situacao", "livre");
    await expect(page.getByTestId("cartao-H")).toContainText("10");

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

    await expect(page.getByTestId("secao-A")).toContainText("4 de 7 livres");
    await expect(page.getByTestId("secao-A")).toContainText("PCD: 1 livre");
    await expect(page.getByTestId("secao-A")).toContainText("atualizado agora");
  });

  test("dado que envelhece 31 s vira SEM DADOS com a grade neutra", async ({ page }) => {
    await page.clock.install();
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "0000000000", agoraIso()), linha("C", "Bloco C", 2, "0000000000", agoraIso()), linha("H", "Bloco H", 3, "0000000000", agoraIso())],
      agora: agoraIso,
    });
    await page.goto("/");
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");

    await page.clock.fastForward(20_000);
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
    await expect(page.getByTestId("secao-A")).toContainText(/há \d+ s/);

    await page.clock.fastForward(12_000);
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "sem-dados");
    await expect(page.getByTestId("cartao-A")).not.toContainText(/\b\d+\b/);
    await expect(page.getByTestId("grade-A")).toHaveAttribute("data-sem-dados", "sim");
    await expect(page.getByTestId("grade-A").locator("[data-vaga=livre]")).toHaveCount(0);
    await expect(page.getByTestId("secao-A")).toContainText(/sem dados desde \d{2}:\d{2}/);
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

    sb.atualizar(linha("A", "Bloco A", 1, "011", agoraIso()));
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "poucas");
    await expect(page.getByTestId("cartao-A")).toContainText("1");
    await expect(page.getByTestId("secao-A")).toContainText("1 de 3 livres");
  });

  test("os três cartões ficam lado a lado em 360 px sem rolagem horizontal", async ({ page }) => {
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
    const larguraRolavel = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(larguraRolavel).toBeLessThanOrEqual(360);
    for (const caixa of [a, c, h]) expect(caixa.height).toBeGreaterThanOrEqual(44);
  });

  test("?demo=1 mostra a faixa de demonstração e dados simulados", async ({ page }) => {
    let chamouRest = false;
    await page.route(/\/rest\/v1\//, async (rota) => {
      chamouRest = true;
      await rota.abort();
    });
    await page.goto("/?demo=1");
    await expect(page.getByTestId("faixa-demo")).toContainText("Demonstração");
    await expect(page.getByTestId("cartao-A")).not.toHaveAttribute("data-situacao", "sem-dados");
    await expect(page.getByTestId("status-conexao")).toContainText("Simulação");
    expect(chamouRest).toBe(false);
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

  test("se a API falhar, a página avisa e continua em SEM DADOS", async ({ page }) => {
    await page.route(/\/rest\/v1\//, (rota) => rota.fulfill({ status: 500, body: "erro" }));
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, () => {});
    await page.goto("/");
    await expect(page.getByTestId("aviso-erro")).toBeVisible();
    for (const id of ["A", "C", "H"]) {
      await expect(page.getByTestId(`cartao-${id}`)).toHaveAttribute("data-situacao", "sem-dados");
    }
  });
});
