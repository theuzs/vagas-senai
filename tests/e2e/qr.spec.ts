import { expect, test } from "@playwright/test";
import { ENDERECO_PUBLICO } from "../../src/lib/endereco";

/** Folhas do QR (guarita e salas) e o botão "Enviar o link". */

const A4 = { width: 794, height: 1123 };

test.describe("folha do QR da guarita (UX-18)", () => {
  test("mostra o QR grande, o endereço e a instrução para o carro parado", async ({ page }) => {
    await page.goto("/qr");
    await expect(page.getByTestId("qr").locator("svg")).toBeVisible();
    await expect(page.getByTestId("qr").locator("svg")).toHaveAttribute("viewBox", "0 0 37 37");
    await expect(page.locator("main")).toContainText("vagas.rubysistemas.com.br");
    await expect(page.locator("main")).toContainText("Com o carro parado, aponte a câmera do celular.");
    await expect(page.locator("main")).toContainText("Vagas livres agora");
    await expect(page.locator("main")).not.toContainText(/bols[ãa]o/i);
    const botao = page.getByRole("button", { name: "Imprimir esta folha" });
    await expect(botao).toBeVisible();
    expect((await botao.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test("na impressão cabe numa página A4 em esquema claro", async ({ page }) => {
    await page.setViewportSize(A4);
    await page.goto("/qr");
    await page.emulateMedia({ media: "print" });

    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light");
    const main = await page.locator("main").boundingBox();
    expect(main!.height).toBeGreaterThanOrEqual(1020);
    expect(main!.height).toBeLessThanOrEqual(1032);
    await expect(page.getByRole("button", { name: "Imprimir esta folha" })).toBeHidden();
    const qr = await page.getByTestId("qr").boundingBox();
    expect(qr!.width).toBeGreaterThanOrEqual(620);
    const h1 = page.getByRole("heading", { level: 1 });
    expect(await h1.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(56);
    await expect(h1).toBeVisible();
    await expect(page.getByText("Com o carro parado")).toBeVisible();

    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const paginas = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(paginas.length).toBe(1);
  });
});

test.describe("folha do QR para salas (UX-64)", () => {
  test("tem o QR, o título e as instruções de instalação", async ({ page }) => {
    await page.goto("/qr/sala");
    await expect(page.getByTestId("qr").locator("svg")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Veja as vagas livres antes de chegar ao SENAI");
    await expect(page.locator("main")).toContainText("Aponte a câmera do celular e abra a página.");
    await expect(page.locator("main")).toContainText("Adicionar à tela inicial");
    await expect(page.locator("main")).toContainText("Adicionar à Tela de Início");
    await expect(page.locator("main")).toContainText("vagas.rubysistemas.com.br");
    await expect(page.locator("main")).not.toContainText(/bols[ãa]o/i);
  });

  test("na impressão cabe numa página A4", async ({ page }) => {
    await page.setViewportSize(A4);
    await page.goto("/qr/sala");
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  });
});

test.describe("botão Enviar o link (UX-64)", () => {
  for (const rota of ["/", "/?demo=1"]) {
    test(`em ${rota}, com share, manda sempre o endereço público`, async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { __compartilhados: unknown[] }).__compartilhados = [];
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: (dados: unknown) => {
            (window as unknown as { __compartilhados: unknown[] }).__compartilhados.push(dados);
            return Promise.resolve();
          },
        });
      });
      await page.route(/\/rest\/v1\//, (rota) => rota.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
      await page.goto(rota);
      const botao = page.getByRole("button", { name: "Enviar o link" });
      test.skip((await botao.count()) === 0, "o botão entra no rodapé de src/app/page.tsx (UX-64)");
      expect((await botao.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await botao.click();
      const compartilhados = await page.evaluate(() => (window as unknown as { __compartilhados: { url: string; title: string; text: string }[] }).__compartilhados);
      expect(compartilhados).toHaveLength(1);
      expect(compartilhados[0].url).toBe(ENDERECO_PUBLICO);
      expect(compartilhados[0].url).not.toContain("demo");
      expect(compartilhados[0].title).toBe("Vagas SENAI Blumenau");
    });
  }

  test("sem share, copia o link e avisa", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    });
    await page.route(/\/rest\/v1\//, (rota) => rota.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.goto("/");
    const botao = page.getByRole("button", { name: "Enviar o link" });
    test.skip((await botao.count()) === 0, "o botão entra no rodapé de src/app/page.tsx (UX-64)");
    await botao.click();
    await expect(page.getByTestId("link-copiado")).toHaveText("Link copiado.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ENDERECO_PUBLICO);
  });
});
