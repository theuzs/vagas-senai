/**
 * Gera os PNG da PWA a partir de public/icone.svg usando o Chromium do Playwright
 * (já instalado para os testes), sem dependência nativa.
 *
 *   npm run icones
 *
 * Saída: public/icones/icone-192.png, icone-512.png, icone-512-maskable.png e
 * src/app/apple-icon.png (180 px, que o Next liga sozinho no <head>).
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const svg = readFileSync(join("public", "icone.svg"), "utf8");

// Versão "maskable": o sistema recorta um círculo ou outra forma no centro, então o
// desenho fica na zona segura (80 % do centro) sobre um fundo cheio.
const svgMaskable = svg
  .replace('rx="96" fill="#0f1419"', 'rx="0" fill="#0f1419"')
  .replace('<rect x="56" y="56" width="400" height="400" rx="72"', '<rect x="96" y="96" width="320" height="320" rx="56"')
  .replace('<path d="M168 400V112', '<g transform="translate(256 256) scale(0.78) translate(-256 -256)"><path d="M168 400V112')
  .replace('<circle cx="380" cy="380" r="46" fill="#22c55e"/>', '<circle cx="380" cy="380" r="46" fill="#22c55e"/></g>');

const SAIDAS: { arquivo: string; tamanho: number; svg: string }[] = [
  { arquivo: join("public", "icones", "icone-192.png"), tamanho: 192, svg },
  { arquivo: join("public", "icones", "icone-512.png"), tamanho: 512, svg },
  { arquivo: join("public", "icones", "icone-512-maskable.png"), tamanho: 512, svg: svgMaskable },
  { arquivo: join("src", "app", "apple-icon.png"), tamanho: 180, svg },
];

async function main() {
  mkdirSync(join("public", "icones"), { recursive: true });
  const navegador = await chromium.launch();
  try {
    for (const s of SAIDAS) {
      const pagina = await navegador.newPage({ viewport: { width: s.tamanho, height: s.tamanho }, deviceScaleFactor: 1 });
      await pagina.setContent(
        `<!doctype html><html><body style="margin:0;background:transparent">${s.svg.replace(/width="512" height="512"/, `width="${s.tamanho}" height="${s.tamanho}"`)}</body></html>`,
      );
      await pagina.screenshot({ path: s.arquivo, omitBackground: true, type: "png" });
      await pagina.close();
      console.log("gerado", s.arquivo);
    }
  } finally {
    await navegador.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
