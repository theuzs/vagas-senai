import { expect, test } from "@playwright/test";
import { linha, supabaseFalso } from "./supabase-falso";

const agoraIso = () => new Date().toISOString();
const misto = () => [linha("A", "Bloco A", 1, "0011" + "0".repeat(10) + "1".repeat(26), agoraIso(), { pcd: [0, 1], idoso: [2] }), linha("C", "Bloco C", 2, "00" + "1".repeat(22), agoraIso()), linha("H", "Bloco H", 3, null, null)];

test.describe("acessibilidade", () => {
  test("viewport permite zoom, lang é pt-BR e os alvos de toque têm 44 px", async ({ page }) => {
    await supabaseFalso(page, { bolsoes: misto(), agora: agoraIso });
    await page.goto("/");
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).not.toContain("maximum-scale");
    expect(viewport).not.toContain("user-scalable=no");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    for (const rota of ["/", "/guarita"]) {
      if (rota === "/guarita") await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto(rota);
      await expect(page.getByTestId(rota === "/" ? "cartao-A" : "guarita-A")).toHaveAttribute("data-situacao", "livre");
      for (const el of await page.locator("a, button").all()) {
        if (!(await el.isVisible())) continue;
        const caixa = (await el.boundingBox())!;
        expect(caixa.width, await el.innerText()).toBeGreaterThanOrEqual(44);
        expect(caixa.height, await el.innerText()).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("com menos movimento, nada anima; o foco é visível; a grade é uma imagem só", async ({ browser }) => {
    const contexto = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 360, height: 740 } });
    const page = await contexto.newPage();
    await supabaseFalso(page, { bolsoes: misto(), agora: agoraIso });
    await page.goto("/");
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
    const duracao = await page.getByTestId("cartao-A").locator("span.tabular-nums").first().evaluate((e) => getComputedStyle(e).animationDuration);
    expect(parseFloat(duracao)).toBeLessThan(0.001);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focado = page.locator(":focus");
    await expect(focado).toHaveCSS("outline-style", "solid");
    expect(parseFloat(await focado.evaluate((e) => getComputedStyle(e).outlineWidth))).toBeGreaterThanOrEqual(2);
    const grade = page.getByTestId("grade-A");
    await expect(grade).toHaveAttribute("role", "img");
    const snapshot = await grade.ariaSnapshot();
    expect(snapshot.split("\n").length).toBeLessThanOrEqual(1);
    await contexto.close();
  });

  test("o leitor de tela recebe aviso só quando a situação muda", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await supabaseFalso(page, { bolsoes: misto(), agora: agoraIso });
    await page.goto("/guarita");
    await expect(page.getByTestId("guarita-A")).toHaveAttribute("data-situacao", "livre");
    const mudancas = await page.evaluate(
      () =>
        new Promise<number>((resolver) => {
          let n = 0;
          const obs = new MutationObserver(() => n++);
          for (const el of document.querySelectorAll("[aria-live], [role=status]")) obs.observe(el, { childList: true, characterData: true, subtree: true });
          setTimeout(() => resolver(n), 12_000);
        }),
    );
    expect(mudancas).toBe(0);
  });

  test("com a fonte em 200 % os cartões empilham sem transbordar", async ({ page }) => {
    await supabaseFalso(page, { bolsoes: misto(), agora: agoraIso });
    await page.addStyleTag({ content: "html{font-size:200%}" });
    await page.goto("/");
    await page.addStyleTag({ content: "html{font-size:200%}" });
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
    const [a, c, h] = await Promise.all(["A", "C", "H"].map((id) => page.getByTestId(`cartao-${id}`).boundingBox()));
    expect(a!.y).not.toBe(c!.y);
    expect(c!.y).not.toBe(h!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    for (const id of ["A", "C", "H"]) {
      const cartao = page.getByTestId(`cartao-${id}`);
      const caixa = (await cartao.boundingBox())!;
      for (const span of await cartao.locator("span").all()) {
        const s = await span.boundingBox();
        if (!s || s.width === 0) continue;
        expect(s.x + s.width).toBeLessThanOrEqual(caixa.x + caixa.width + 1);
      }
    }
  });

  test("no modo de contraste alto, livre e ocupada continuam diferentes", async ({ browser }) => {
    const contexto = await browser.newContext({ forcedColors: "active", viewport: { width: 1366, height: 768 } });
    const page = await contexto.newPage();
    await supabaseFalso(page, { bolsoes: misto(), agora: agoraIso });
    await page.goto("/");
    await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
    const livre = await page.locator("[data-vaga=livre]").first().evaluate((e) => getComputedStyle(e).backgroundColor);
    const grade = await page.getByTestId("grade-A").evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(livre).not.toBe(grade);
    await page.goto("/guarita");
    await expect(page.getByTestId("guarita-A")).toHaveAttribute("data-indicado", "sim");
    expect(await page.getByTestId("guarita-A").evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe("none");
    const parteLivre = await page.locator("[data-parte=livre]").first().evaluate((e) => getComputedStyle(e).backgroundColor);
    const barra = await page.getByTestId("barra-A").evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(parteLivre).not.toBe(barra);
    await contexto.close();
  });
});
