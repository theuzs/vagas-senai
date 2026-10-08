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

for (const tela of [
  { nome: "guarita-1366", width: 1366, height: 768 },
  { nome: "guarita-1920", width: 1920, height: 1080 },
]) {
  test(`tela da guarita ${tela.nome}`, async ({ page }) => {
    await page.setViewportSize({ width: tela.width, height: tela.height });
    await supabaseFalso(page, {
      bolsoes: [
        linha("A", "Bloco A", 1, "0110100011010001101000110100011010001101", agoraIso(), { pcd: [0, 1] }),
        linha("C", "Bloco C", 2, "111111111111111111111111", agoraIso(), { pcd: [0], idoso: [1] }),
        linha("H", "Bloco H", 3, null, null),
      ],
      agora: agoraIso,
    });
    await page.goto("/guarita");
    await expect(page.getByTestId("guarita-C")).toHaveAttribute("data-situacao", "lotado");
    await page.screenshot({ path: join(PASTA, `${tela.nome}.png`) });
  });
}

test("folha do QR", async ({ page }) => {
  await page.goto("/qr");
  await page.screenshot({ path: join(PASTA, "qr.png"), fullPage: true });
});
