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
