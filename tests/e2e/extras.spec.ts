import { expect, test } from "@playwright/test";
import { linha, supabaseFalso } from "./supabase-falso";

const agoraIso = () => new Date().toISOString();

test("o mapa mostra cada bolsão com o número ou o estado", async ({ page }) => {
  await supabaseFalso(page, {
    bolsoes: [linha("A", "Bloco A", 1, "0000000000", agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
    agora: agoraIso,
  });
  await page.goto("/");
  await expect(page.getByTestId("mapa")).toBeVisible();
  await expect(page.getByTestId("mapa-A")).toHaveAttribute("data-situacao", "livre");
  await expect(page.getByTestId("mapa-A")).toContainText("10");
  await expect(page.getByTestId("mapa-C")).toHaveAttribute("data-situacao", "lotado");
  await expect(page.getByTestId("mapa-C")).toContainText("LOTADO");
  await expect(page.getByTestId("mapa-H")).toHaveAttribute("data-situacao", "sem-dados");
  await expect(page.getByTestId("mapa-H")).toContainText("SEM DADOS");
  await expect(page.getByTestId("mapa-H")).not.toContainText(/\d/);
});

test.describe("tela da guarita", () => {
  for (const tela of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    test(`cabe sem rolagem em ${tela.width}x${tela.height} e mostra os três lado a lado`, async ({ page }) => {
      await page.setViewportSize(tela);
      await supabaseFalso(page, {
        bolsoes: [linha("A", "Bloco A", 1, "0".repeat(12) + "1".repeat(28), agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
        agora: agoraIso,
      });
      await page.goto("/guarita");
      await expect(page.getByTestId("guarita-A")).toHaveAttribute("data-situacao", "livre");
      const caixas = await Promise.all(["A", "C", "H"].map((id) => page.getByTestId(`guarita-${id}`).boundingBox()));
      const [a, c, h] = caixas as { x: number; y: number; width: number; height: number }[];
      expect(Math.abs(a.y - c.y)).toBeLessThan(2);
      expect(Math.abs(c.y - h.y)).toBeLessThan(2);
      expect(a.x + a.width).toBeLessThan(c.x);
      expect(c.x + c.width).toBeLessThan(h.x);
      const rolagem = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
      expect(rolagem.w).toBeLessThanOrEqual(tela.width);
      expect(rolagem.h).toBeLessThanOrEqual(tela.height);
      const orientacao = page.getByTestId("orientacao");
      const caixaOrientacao = await orientacao.boundingBox();
      expect(caixaOrientacao!.y + caixaOrientacao!.height).toBeLessThanOrEqual(tela.height);
    });
  }

  test("indica o bolsão com mais vaga e avisa sobre o que está sem dados", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "0011111111", agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
      agora: agoraIso,
    });
    await page.goto("/guarita");
    await expect(page.getByTestId("orientacao")).toHaveAttribute("data-tipo", "indicar");
    await expect(page.getByTestId("orientacao")).toContainText("Mais vagas agora: Bloco A, 2 livres.");
    await expect(page.getByTestId("orientacao")).toContainText("Bloco H sem dados: confira no local.");
    await expect(page.getByTestId("guarita-A")).toHaveAttribute("data-indicado", "sim");
    await expect(page.getByTestId("guarita-C")).toContainText("LOTADO");
    await expect(page.getByTestId("guarita-H")).toContainText("SEM DADOS");
    await expect(page.getByTestId("guarita-H")).toContainText("Não diga que está lotado");
    await expect(page.getByTestId("guarita-H")).not.toContainText(/\d+/);
    await expect(page.getByTestId("relogio")).toHaveText(/^\d{2}:\d{2}$/);
  });

  test("o relógio mostra a hora e a data de agora assim que abre, e não as do build", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    // Uma terça-feira longe da data do build. Aparelho e servidor concordam, então o
    // deslocamento é zero e nada força o React a redesenhar o relógio.
    const momento = "2030-03-05T23:17:05-03:00";
    await page.clock.install({ time: new Date(momento) });
    await supabaseFalso(page, { bolsoes: [linha("A", "Bloco A", 1, null, null)], agora: () => momento });
    await page.goto("/guarita");
    await expect(page.getByTestId("relogio")).toHaveText("23:17");
    await expect(page.getByTestId("data-hoje")).toHaveText("Terça-feira, 5 de março");
  });

  test("com o resto lotado e um sem dado, nunca diz que está tudo lotado", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.clock.install();
    await supabaseFalso(page, {
      bolsoes: [linha("A", "Bloco A", 1, "1111", agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, "1111", agoraIso())],
      agora: agoraIso,
    });
    await page.goto("/guarita");
    await expect(page.getByTestId("orientacao")).toHaveAttribute("data-tipo", "lotado");
    await page.clock.fastForward(31_000);
    await expect(page.getByTestId("orientacao")).toHaveAttribute("data-tipo", "sem-dados");
    await expect(page.getByTestId("orientacao")).not.toContainText("lotados");
    await expect(page.getByTestId("orientacao")).toContainText("Confira no local");
  });
});

test("/qr tem o QR code e o endereço", async ({ page }) => {
  await page.goto("/qr");
  await expect(page.getByTestId("qr").locator("svg")).toBeVisible();
  await expect(page.locator("main")).toContainText("vagas.rubysistemas.com.br");
  await expect(page.locator("main")).toContainText("Aponte a câmera");
});
