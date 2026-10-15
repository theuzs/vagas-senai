import { expect, test } from "@playwright/test";
import { linha, supabaseFalso } from "./supabase-falso";

/**
 * Guardas da regra do produto (UX-01): sem dado recente, nenhum número, em todo lugar
 * que mostre quantidade. Todo elemento novo que mostre número entra no seletor abaixo.
 */
const agoraIso = () => new Date().toISOString();
const ha = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const ontem2230 = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(22, 30, 0, 0);
  return d.toISOString();
};

const SELETORES = ["[data-testid^=cartao-]", "[data-testid^=mapa-]", "[data-testid^=secao-]", "[data-testid^=guarita-]", "[data-testid^=grade-]", "[data-testid=orientacao]", "[data-testid=resumo]"];

async function textoComNumeros(page: import("@playwright/test").Page) {
  return page.evaluate((seletores) => {
    const partes: string[] = [document.title];
    for (const s of seletores) {
      for (const el of document.querySelectorAll(s)) {
        partes.push(el.textContent ?? "");
        partes.push(el.getAttribute("aria-label") ?? "");
        for (const filho of el.querySelectorAll("[aria-label]")) partes.push(filho.getAttribute("aria-label") ?? "");
      }
    }
    return partes.join(" ").replace(/\b\d{2}:\d{2}\b/g, "").replace(/\b\d{2}\/\d{2}\b/g, "");
  }, SELETORES);
}

const cenarioVelho = () => [linha("A", "Bloco A", 1, "0".repeat(40), ha(600)), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, "0".repeat(60), ontem2230())];

test.describe("guardas do SEM DADOS", () => {
  for (const rota of ["/", "/guarita"]) {
    test(`${rota}: dado velho mostra SEM DADOS com listras, borda tracejada e ícone, sem dígito`, async ({ page }) => {
      if (rota === "/guarita") await page.setViewportSize({ width: 1366, height: 768 });
      await supabaseFalso(page, { bolsoes: cenarioVelho(), agora: agoraIso });
      await page.goto(rota);
      const prefixo = rota === "/" ? "cartao" : "guarita";
      for (const id of ["A", "H"]) {
        const el = page.getByTestId(`${prefixo}-${id}`);
        await expect(el).toHaveAttribute("data-situacao", "sem-dados");
        await expect(el).toContainText("SEM DADOS");
        await expect(el).not.toContainText(/\d/);
        await expect(el).toHaveCSS("border-top-style", "dashed");
        const fundo = await el.evaluate((e) => getComputedStyle(e).backgroundImage);
        expect(fundo).toContain("repeating-linear-gradient");
        await expect(el.locator("svg")).not.toHaveCount(0);
      }
      const c = page.getByTestId(`${prefixo}-C`);
      await expect(c).toHaveCSS("border-top-style", "solid");
      expect(await c.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe("none");
      if (rota === "/") {
        await expect(page.getByTestId("mapa-A")).toHaveAttribute("data-situacao", "sem-dados");
        expect(await page.getByTestId("mapa-A").locator("rect").first().getAttribute("stroke-dasharray")).toBeTruthy();
        await expect(page.getByTestId("grade-A").locator("[data-vaga=livre], [data-vaga=ocupada]")).toHaveCount(0);
        await expect(page.getByTestId("secao-A")).toContainText(/\d{2}:\d{2}/);
        await expect(page.getByTestId("secao-H")).toContainText("ontem às");
      } else {
        for (const id of ["A", "H"]) {
          await expect(page.getByTestId(`centro-${id}`)).toContainText("SEM DADOS");
          await expect(page.getByTestId(`centro-${id}`)).not.toContainText(/\d/);
        }
      }
    });
  }

  for (const cenario of [
    { nome: "tudo nulo", bolsoes: () => [linha("A", "Bloco A", 1, null, null), linha("C", "Bloco C", 2, null, null), linha("H", "Bloco H", 3, null, null)] },
    { nome: "A de 10 min, C de 45 s, H nulo", bolsoes: () => [linha("A", "Bloco A", 1, "0".repeat(40), ha(600)), linha("C", "Bloco C", 2, "0000", ha(45)), linha("H", "Bloco H", 3, null, null)] },
  ]) {
    for (const rota of ["/", "/guarita"]) {
      test(`guarda de dígito em ${rota} com ${cenario.nome}`, async ({ page }) => {
        if (rota === "/guarita") await page.setViewportSize({ width: 1366, height: 768 });
        await supabaseFalso(page, { bolsoes: cenario.bolsoes(), agora: agoraIso });
        await page.goto(rota);
        await expect(page.getByTestId(rota === "/" ? "cartao-A" : "guarita-A")).toHaveAttribute("data-situacao", "sem-dados");
        await page.waitForTimeout(1500);
        expect(await textoComNumeros(page)).not.toMatch(/\d/);
      });
    }
  }

  test("o HTML estático de / e /guarita já vem em SEM DADOS, sem número", async ({ request }) => {
    for (const rota of ["/", "/guarita"]) {
      const html = await (await request.get(rota)).text();
      const situacoes = [...html.matchAll(/data-situacao="([^"]+)"/g)].map((m) => m[1]);
      expect(situacoes.length).toBeGreaterThan(0);
      expect(situacoes.every((s) => s === "sem-dados")).toBe(true);
      for (const m of html.matchAll(/<(a|article)[^>]*data-testid="(cartao|guarita)-[A-Z]"[^>]*>([\s\S]*?)<\/\1>/g)) {
        expect(m[3].replace(/<[^>]+>/g, "")).not.toMatch(/\d/);
      }
    }
  });

  test("a guarita mantém a ordem A, C, H e indica o bloco com mais vagas", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "0".repeat(5) + "1".repeat(35), agoraIso()), linha("C", "Bloco C", 2, "00" + "1".repeat(22), agoraIso()), linha("H", "Bloco H", 3, "0".repeat(30) + "1".repeat(30), agoraIso())],
      agora: agoraIso,
    });
    await page.goto("/guarita");
    await expect(page.getByTestId("guarita-H")).toHaveAttribute("data-indicado", "sim");
    const [a, c, h] = await Promise.all(["A", "C", "H"].map((id) => page.getByTestId(`guarita-${id}`).boundingBox()));
    expect(a!.x).toBeLessThan(c!.x);
    expect(c!.x).toBeLessThan(h!.x);
  });

  test("/guarita?demo=1 diz que é demonstração, e sem demo a faixa não existe", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    let chamouRest = false;
    await page.route(/\/rest\/v1\//, async (rota) => {
      chamouRest = true;
      await rota.abort();
    });
    await page.goto("/guarita?demo=1");
    await expect(page.getByTestId("faixa-demo")).toContainText("Demonstração");
    await expect(page.getByTestId("status-conexao")).toContainText("Simulação");
    await expect(page.getByTestId("orientacao")).toContainText("Não use estes números para orientar motoristas.");
    expect(await page.title()).toContain("Demonstração");
    expect(chamouRest).toBe(false);

    await page.unroute(/\/rest\/v1\//);
    await supabaseFalso(page, { bolsoes: [linha("A", "Bloco A", 1, null, null), linha("C", "Bloco C", 2, null, null), linha("H", "Bloco H", 3, null, null)], agora: agoraIso });
    await page.goto("/guarita");
    await page.waitForTimeout(5000);
    await expect(page.getByTestId("faixa-demo")).toHaveCount(0);
  });
});
