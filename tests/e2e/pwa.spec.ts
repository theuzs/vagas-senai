import { expect, test } from "@playwright/test";

test("manifest responde com nome, modo standalone e ícones que existem", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const resposta = await request.get(href!);
  expect(resposta.ok()).toBe(true);
  const manifest = await resposta.json();
  expect(manifest.name).toBe("Vagas SENAI Blumenau");
  expect(manifest.short_name).toBe("Vagas");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes).sort()).toEqual(["192x192", "512x512", "512x512"]);
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);

  for (const icone of manifest.icons as { src: string }[]) {
    const r = await request.get(icone.src);
    expect(r.ok(), icone.src).toBe(true);
    expect(r.headers()["content-type"]).toContain("image/png");
  }

  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(apple).toBeTruthy();
  expect((await request.get(apple!)).ok()).toBe(true);
});
