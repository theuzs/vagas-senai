/**
 * Gera os PNG da PWA a partir de public/icone.svg usando o Chromium do Playwright
 * (já instalado para os testes), sem dependência nativa.
 *
 *   npm run icones
 *
 * Saída: public/icones/icone-192.png, icone-512.png, icone-512-maskable.png,
 * src/app/apple-icon.png (180 px, fundo cheio), src/app/icon.svg (favicon) e
 * src/app/opengraph-image.png (1200x630, prévia do link no WhatsApp).
 */
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
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

// O iPhone não aceita transparência no ícone da tela inicial: fundo cheio, sem cantos.
const svgApple = svg.replace('rx="96" fill="#0f1419"', 'rx="0" fill="#0f1419"');

const SAIDAS: { arquivo: string; tamanho: number; svg: string }[] = [
  { arquivo: join("public", "icones", "icone-192.png"), tamanho: 192, svg },
  { arquivo: join("public", "icones", "icone-512.png"), tamanho: 512, svg },
  { arquivo: join("public", "icones", "icone-512-maskable.png"), tamanho: 512, svg: svgMaskable },
  { arquivo: join("src", "app", "apple-icon.png"), tamanho: 180, svg: svgApple },
];

// Prévia do link (Open Graph): sem número e sem as cores de livre e lotado.
const paginaOg = `<!doctype html><html><body style="margin:0;width:1200px;height:630px;background:#0f1419;display:flex;align-items:center;justify-content:center;gap:56px;font-family:system-ui,'Segoe UI',Roboto,sans-serif">
  <div style="width:240px;height:240px">${svg.replace(/width="512" height="512"/, 'width="240" height="240"')}</div>
  <div style="max-width:720px">
    <div style="font-size:72px;font-weight:900;color:#eef3f7;line-height:1.1">Vagas SENAI Blumenau</div>
    <div style="font-size:34px;color:#9fb0bf;margin-top:20px;line-height:1.3">Vagas livres nos blocos A, C e H, contadas por um sensor em cada vaga.</div>
  </div>
</body></html>`;

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
    const og = await navegador.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await og.setContent(paginaOg);
    const arquivoOg = join("src", "app", "opengraph-image.png");
    await og.screenshot({ path: arquivoOg, type: "png" });
    await og.close();
    const kb = Math.round(statSync(arquivoOg).size / 1024);
    if (kb > 300) throw new Error(`${arquivoOg} tem ${kb} KB; o limite é 300 KB`);
    console.log("gerado", arquivoOg, `${kb} KB`);
  } finally {
    await navegador.close();
  }
  copyFileSync(join("public", "icone.svg"), join("src", "app", "icon.svg"));
  console.log("copiado src/app/icon.svg");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
