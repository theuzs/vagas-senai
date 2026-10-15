import { expect, test } from "@playwright/test";
import { linha, supabaseFalso } from "./supabase-falso";

const agoraIso = () => new Date().toISOString();

test("manifest responde com nome, modo standalone, orientação livre e ícones que existem", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const resposta = await request.get(href!);
  expect(resposta.ok()).toBe(true);
  const manifest = await resposta.json();
  expect(manifest.id).toBe("/");
  expect(manifest.name).toBe("Vagas SENAI Blumenau");
  expect(manifest.short_name).toBe("Vagas SENAI");
  expect(manifest.display).toBe("standalone");
  expect(manifest.orientation).toBeUndefined();
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes).sort()).toEqual(["192x192", "512x512", "512x512"]);
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);

  for (const icone of manifest.icons as { src: string }[]) {
    const r = await request.get(icone.src);
    expect(r.ok(), icone.src).toBe(true);
    expect(r.headers()["content-type"]).toContain("image/png");
  }

  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(apple).toBeTruthy();
  const png = await (await request.get(apple!)).body();
  // PNG de 180 px sem transparência: o primeiro pixel tem alfa 255 (conferido pelo tipo de cor do IHDR: 2 = RGB, 6 = RGBA)
  expect(png.readUInt8(25)).toBe(2);

  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Vagas SENAI");
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute("content", "black");
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "dark");
});

test("favicon, Open Graph e títulos", async ({ page, request }) => {
  await page.goto("/");
  const icon = await page.locator('link[rel="icon"]').first().getAttribute("href");
  expect(icon).toBeTruthy();
  const r = await request.get(icon!);
  expect(r.ok()).toBe(true);
  expect(r.headers()["content-type"]).toContain("image/svg+xml");

  const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(og).toMatch(/^https:\/\/vagas\.rubysistemas\.com\.br\//);
  const caminho = new URL(og!).pathname + new URL(og!).search;
  const imagem = await request.get(caminho);
  expect(imagem.ok()).toBe(true);
  expect(imagem.headers()["content-type"]).toContain("image/png");
  expect((await imagem.body()).length).toBeLessThan(300_000);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "pt_BR");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Vagas SENAI Blumenau");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");

  await page.goto("/guarita");
  expect(await page.title()).toBe("Guarita · Vagas SENAI Blumenau");
  await expect(page.getByTestId("marca")).toHaveCount(1);
  await page.goto("/qr");
  expect(await page.title()).toBe("Folha do QR code · Vagas SENAI Blumenau");
});

test("tema claro do sistema é ignorado e a fonte é a do sistema", async ({ browser, request }) => {
  const contexto = await browser.newContext({ colorScheme: "light", viewport: { width: 360, height: 740 } });
  const page = await contexto.newPage();
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(15, 20, 25)");
  const html = await (await request.get("/")).text();
  expect(html).not.toMatch(/<link[^>]+rel="preload"[^>]+as="font"/);
  expect(html).toMatch(/<link[^>]+rel="preconnect"[^>]+supabase\.co/);
  await contexto.close();
});

test("em paisagem no celular o primeiro cartão aparece sem rolar", async ({ browser }) => {
  for (const vp of [
    { width: 740, height: 360 },
    { width: 844, height: 390 },
  ]) {
    const contexto = await browser.newContext({ viewport: vp });
    const page = await contexto.newPage();
    await supabaseFalso(page, { bolsoes: [linha("A", "Bloco A", 1, "0000", agoraIso())], agora: agoraIso });
    await page.goto("/");
    await expect(page.getByTestId("cartao-A")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);
    await contexto.close();
  }
});

test("convite de instalação só no iPhone, a partir da segunda visita", async ({ browser }) => {
  const iphone = await browser.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  const page = await iphone.newPage();
  await page.addInitScript(() => {
    window.addEventListener("beforeinstallprompt", () => {
      (window as unknown as { __prompt: boolean }).__prompt = true;
    });
  });
  await supabaseFalso(page, { bolsoes: [linha("A", "Bloco A", 1, "0000", agoraIso())], agora: agoraIso });
  await page.goto("/");
  await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
  await expect(page.getByTestId("convite-instalar")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("convite-instalar")).toContainText("Adicionar à Tela de Início");
  const h = (await page.getByTestId("secao-A").boundingBox())!;
  const convite = (await page.getByTestId("convite-instalar").boundingBox())!;
  expect(convite.y).toBeGreaterThan(h.y);
  await page.getByRole("button", { name: "Fechar" }).click();
  await page.reload();
  await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
  await expect(page.getByTestId("convite-instalar")).toHaveCount(0);
  await iphone.close();

  const android = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const p2 = await android.newPage();
  await supabaseFalso(p2, { bolsoes: [linha("A", "Bloco A", 1, "0000", agoraIso())], agora: agoraIso });
  await p2.goto("/");
  await p2.reload();
  await p2.reload();
  await expect(p2.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
  await expect(p2.getByTestId("convite-instalar")).toHaveCount(0);
  await android.close();
});

test("os chunks até o primeiro número não trazem as mensagens do zod em outros idiomas", async ({ page }) => {
  const corpos: string[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/_next/static/") && r.url().endsWith(".js")) corpos.push(await r.text());
  });
  await supabaseFalso(page, { bolsoes: [linha("A", "Bloco A", 1, "0000", agoraIso())], agora: agoraIso });
  await page.goto("/");
  await expect(page.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "livre");
  // Só o que chegou até o primeiro número conta; o supabase-js vem depois.
  const ateAqui = corpos.length;
  await page.waitForTimeout(1000);
  const total = corpos.slice(0, ateAqui).reduce((s, c) => s + c.length, 0);
  expect(corpos.some((c) => c.includes("Nieprawidłow") || c.includes("无效"))).toBe(false);
  // No localhost os chunks seguintes chegam quase juntos; o limite cobre o total até aqui.
  expect(total).toBeLessThan(900_000);
});
