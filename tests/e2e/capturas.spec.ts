import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { linha, supabaseFalso } from "./supabase-falso";

/**
 * Tira capturas de tela para a documentação. Só roda com CAPTURAS=1:
 *   CAPTURAS=1 npx playwright test capturas
 * Saída em docs/telas/.
 */
test.skip(!process.env.CAPTURAS, "só com CAPTURAS=1");

const agoraIso = () => new Date().toISOString();
const PASTA = join("docs", "telas");

test.beforeAll(() => {
  mkdirSync(PASTA, { recursive: true });
});

test("página com dados, um bolsão lotado e um sem dados", async ({ page }) => {
  await supabaseFalso(page, {
    bolsoes: [
      linha("A", "Bloco A", 1, "0110100011010001101000110100011010001101", agoraIso(), { pcd: [0, 1] }),
      linha("C", "Bloco C", 2, "111111111111111111111111", agoraIso(), { pcd: [0], idoso: [1] }),
      linha("H", "Bloco H", 3, null, null),
    ],
    agora: agoraIso,
  });
  await page.goto("/");
  await expect(page.getByTestId("cartao-C")).toHaveAttribute("data-situacao", "lotado");
  await page.screenshot({ path: join(PASTA, "pagina.png"), fullPage: true });
});

test("modo painel", async ({ page }) => {
  await supabaseFalso(page, {
    bolsoes: [linha("A", "Bloco A", 1, "0110100011010001101000110100011010001101", agoraIso()), linha("C", "Bloco C", 2, "111111111111111111111111", agoraIso()), linha("H", "Bloco H", 3, null, null)],
    agora: agoraIso,
  });
  await page.goto("/?painel=1");
  await expect(page.getByTestId("cartao-C")).toHaveAttribute("data-situacao", "lotado");
  await page.screenshot({ path: join(PASTA, "painel.png") });
});

test("folha do QR", async ({ page }) => {
  await page.goto("/qr");
  await page.screenshot({ path: join(PASTA, "qr.png"), fullPage: true });
});
