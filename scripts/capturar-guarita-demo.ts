/**
 * Tira a captura da tela da guarita em demonstração para a página "Como funciona".
 *
 *   npm run build && npx next start -p 3002
 *   npx tsx scripts/capturar-guarita-demo.ts http://localhost:3002
 *
 * Saída: public/telas/guarita-demo.png (1366x768). Nenhuma chamada ao Supabase: o modo
 * demo gera os dados no navegador.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3002";
const saida = join("public", "telas", "guarita-demo.png");

async function main() {
  mkdirSync(join("public", "telas"), { recursive: true });
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1366, height: 768 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  await pagina.goto(`${base}/guarita?demo=1`);
  await pagina.getByTestId("faixa-demo").waitFor();
  await pagina.getByTestId("relogio").filter({ hasText: /\d{2}:\d{2}/ }).waitFor();
  await pagina.locator('[data-testid="guarita-A"]:not([data-situacao="sem-dados"])').waitFor();
  await pagina.waitForTimeout(500);
  await pagina.screenshot({ path: saida });
  await navegador.close();
  console.log("captura salva em", saida);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
