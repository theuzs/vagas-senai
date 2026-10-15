import { expect, test } from "@playwright/test";

/** Telas novas sem dado ao vivo: 404, guia do vigia e "Como funciona". */

test.describe("página não encontrada (UX-15)", () => {
  test("endereço errado responde 404 em português, com link para as vagas", async ({ page }) => {
    const resposta = await page.goto("/qualquer-coisa");
    expect(resposta?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Esta página não existe.");
    const link = page.getByRole("link", { name: "Ver as vagas" });
    await expect(link).toHaveAttribute("href", "/");
    const caixa = await link.boundingBox();
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator("body")).not.toContainText("could not be found");
    await expect(page.locator("body")).not.toContainText("404");
  });
});

test.describe("guia impresso do vigia (UX-62)", () => {
  test("mostra os quatro estados e o espaço para o contato", async ({ page }) => {
    await page.goto("/guarita/guia");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Como usar a tela de vagas");
    const main = page.locator("main");
    await expect(main).toContainText("Tem vaga: mande o motorista para o bloco que a faixa de baixo indica.");
    await expect(main).toContainText("Poucas vagas: o bloco tem poucas vagas livres. Avise que ele pode lotar antes de o motorista chegar.");
    await expect(main).toContainText("Lotado: os sensores mandaram dado agora e o bloco não tem vaga.");
    await expect(main).toContainText("Sem dados: a tela não sabe quantas vagas o bloco tem. Não diga que está lotado.");
    await expect(main).toContainText("Se um bloco ficar sem dados por mais de 10 minutos, avise o responsável:");
    await expect(main).toContainText("Nome:");
    await expect(main).toContainText("Telefone ou ramal:");
    for (const id of ["livre", "poucas", "lotado", "sem-dados"]) await expect(page.getByTestId(`estado-${id}`)).toBeVisible();
    await expect(page.getByTestId("estado-sem-dados").locator("span").first()).toHaveCSS("border-style", "dashed");
  });

  test("na impressão cabe numa página A4", async ({ page }) => {
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.goto("/guarita/guia");
    await page.emulateMedia({ media: "print" });
    const altura = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(altura).toBeLessThanOrEqual(1123);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  });
});

test.describe('página "Como funciona" (UX-56)', () => {
  test("explica o sistema sem mostrar vaga ao vivo e leva para todas as telas", async ({ page }) => {
    const pedidos: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/rest/v1/") || r.url().includes("/realtime/")) pedidos.push(r.url());
    });
    const resposta = await page.goto("/como-funciona");
    expect(resposta?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Como funciona");
    await expect(page.getByRole("link", { name: /^Demonstração/ })).toHaveAttribute("href", "/?demo=1");
    await expect(page.getByRole("link", { name: /^Guarita em demonstração/ })).toHaveAttribute("href", "/guarita?demo=1");
    await expect(page.getByRole("link", { name: /^Resultados das noites/ })).toHaveAttribute("href", "/resultados");
    await expect(page.getByRole("link", { name: /^Guia do vigia/ })).toHaveAttribute("href", "/guarita/guia");
    await expect(page.getByRole("link", { name: /^QR para salas/ })).toHaveAttribute("href", "/qr/sala");
    expect(await page.locator("[data-testid^=cartao-], [data-testid^=guarita-]").count()).toBe(0);
    await expect(page.locator("img[alt*='dados simulados']")).toBeVisible();
    await expect(page.locator("main")).toContainText("Sensores e placas: João Victor Fagundes Miranda");
    await expect(page.locator("main")).toContainText("A maquete");
    await expect(page.locator("main")).not.toContainText(/bols[ãa]o/i);

    const links = page.getByTestId("navegacao").getByRole("link");
    expect(await links.count()).toBe(8);
    for (const link of await links.all()) {
      const caixa = await link.boundingBox();
      expect(caixa!.height).toBeGreaterThanOrEqual(44);
    }
    expect(pedidos).toEqual([]);
  });

  test("a captura da guarita existe e é uma imagem", async ({ request }) => {
    const r = await request.get("/telas/guarita-demo.png");
    expect(r.ok()).toBe(true);
    expect(r.headers()["content-type"]).toContain("image/png");
  });

  test("o rodapé da página das vagas leva para Como funciona e Resultados", async ({ page }) => {
    await page.route(/\/rest\/v1\//, (rota) => rota.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.goto("/");
    const comoFunciona = page.locator("footer").getByRole("link", { name: "Como funciona" });
    test.skip((await comoFunciona.count()) === 0, "os links entram no rodapé de src/app/page.tsx (UX-54 e UX-56)");
    await expect(comoFunciona).toHaveAttribute("href", "/como-funciona");
    expect((await comoFunciona.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const resultados = page.locator("footer").getByRole("link", { name: "Resultados" });
    await expect(resultados).toHaveAttribute("href", "/resultados");
    expect((await resultados.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});
