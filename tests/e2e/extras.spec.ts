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

test("?painel=1 mostra só os cartões, grandes", async ({ page }) => {
  await supabaseFalso(page, {
    bolsoes: [linha("A", "Bloco A", 1, "0000000000", agoraIso()), linha("C", "Bloco C", 2, "1111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
    agora: agoraIso,
  });
  await page.goto("/?painel=1");
  await expect(page.getByTestId("cartao-A")).toContainText("10");
  await expect(page.getByTestId("secao-A")).toHaveCount(0);
  await expect(page.getByTestId("mapa")).toHaveCount(0);
  const caixa = await page.getByTestId("cartao-A").boundingBox();
  expect(caixa!.height).toBeGreaterThan(300);
  await expect(page.getByTestId("faixa-demo")).toHaveCount(0);
});

test("/qr tem o QR code e o endereço", async ({ page }) => {
  await page.goto("/qr");
  await expect(page.getByTestId("qr").locator("svg")).toBeVisible();
  await expect(page.locator("main")).toContainText("vagas.rubysistemas.com.br");
  await expect(page.locator("main")).toContainText("Aponte a câmera");
});
