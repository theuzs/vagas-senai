import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** Tela de resultados com as rpc respondidas pelo Playwright. Nenhuma chamada ao Supabase real. */

const JANELAS = Array.from({ length: 54 }, (_, i) => {
  const min = 18 * 60 + i * 5;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
});

function fotos(noite: string, bolsao: string, total: number, livresEm: (hora: string, i: number) => number | null) {
  return JANELAS.flatMap((hora, i) => {
    const livres = livresEm(hora, i);
    if (livres === null) return [];
    return [{ bolsao_id: bolsao, momento: `${noite}T${hora}:00-03:00`, vagas_livres: livres, total_vagas: total }];
  });
}

const NOITE = "2026-10-13";
const ANTERIOR = "2026-10-12";

const SERIE: Record<string, unknown[]> = {
  [NOITE]: [
    // A sem foto às 19:10; lota das 20:00 às 20:55
    ...fotos(NOITE, "A", 40, (h, i) => (h === "19:10" ? null : h >= "20:00" && h < "21:00" ? 0 : 12 + (i % 5))),
    ...fotos(NOITE, "C", 24, (h, i) => 3 + (i % 4)),
    // H só tem foto na primeira hora
    ...fotos(NOITE, "H", 60, (h, i) => (h < "19:00" ? 30 - i : null)),
  ],
  [ANTERIOR]: [...fotos(ANTERIOR, "A", 40, () => 5), ...fotos(ANTERIOR, "C", 24, () => 0)],
};

const RESUMO = [
  { noite: NOITE, bolsao_id: "A", janelas_com_dado: 53, janelas_lotado: 12, min_livres: 0, total_vagas: 40 },
  { noite: NOITE, bolsao_id: "C", janelas_com_dado: 54, janelas_lotado: 0, min_livres: 3, total_vagas: 24 },
  { noite: NOITE, bolsao_id: "H", janelas_com_dado: 12, janelas_lotado: 0, min_livres: 19, total_vagas: 60 },
  { noite: ANTERIOR, bolsao_id: "A", janelas_com_dado: 54, janelas_lotado: 0, min_livres: 5, total_vagas: 40 },
  { noite: ANTERIOR, bolsao_id: "C", janelas_com_dado: 54, janelas_lotado: 54, min_livres: 0, total_vagas: 24 },
];

const IMPACTO = [
  { noite: NOITE, janelas_avaliadas: 53, janelas_lotado_com_vaga_em_outro: 12, media_livres_outros: 7.5 },
  { noite: ANTERIOR, janelas_avaliadas: 54, janelas_lotado_com_vaga_em_outro: 54, media_livres_outros: 5 },
];

async function supabaseResultadosFalso(page: Page, dados: { resumo: unknown[]; impacto: unknown[]; serie: Record<string, unknown[]> }) {
  const chamadas: string[] = [];
  await page.route(/\/rest\/v1\/rpc\/(resumo_noites|impacto|serie_noite)(\?|$)/, async (rota) => {
    const url = new URL(rota.request().url());
    const nome = url.pathname.split("/").pop()!;
    chamadas.push(nome);
    const corpo = rota.request().postDataJSON() as Record<string, unknown> | null;
    let resposta: unknown[] = [];
    if (nome === "resumo_noites") resposta = dados.resumo;
    else if (nome === "impacto") resposta = dados.impacto;
    else resposta = dados.serie[String(corpo?.p_noite)] ?? [];
    await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resposta) });
  });
  await page.route(/\/rest\/v1\/bolsoes/, async (rota) => {
    chamadas.push("bolsoes");
    await rota.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  return { chamadas };
}

test("mostra o resumo com os números do mock, preso à data, sem ler as vagas ao vivo", async ({ page }) => {
  const falso = await supabaseResultadosFalso(page, { resumo: RESUMO, impacto: IMPACTO, serie: SERIE });
  await page.goto("/resultados");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Resultados das noites");
  await expect(page.getByTestId("resumo-geral")).toHaveText(
    "Em 66 das 107 janelas das últimas 2 noites, um bloco estava lotado e outro tinha vaga livre. Nessas janelas, os outros blocos tinham em média 5,5 vagas livres.",
  );
  await expect(page.getByTestId("nota")).toContainText("Os números vêm de uma foto da ocupação a cada 5 minutos, das 18h às 22h30.");
  await expect(page.getByTestId("titulo-noite")).toHaveText("Noite de 13/10");
  await expect(page.getByTestId("bloco-A")).toHaveText("Bloco A: dado em 53 de 54 janelas (98 %). Lotou em 12 janelas.");
  await expect(page.getByTestId("bloco-C")).toHaveText("Bloco C: dado em 54 de 54 janelas (100 %). Não lotou.");
  await expect(page.getByTestId("bloco-H")).toHaveText("Bloco H: dado em 12 de 54 janelas (22 %). Não lotou.");
  await expect(page.locator("main")).not.toContainText(/\bagora\b/i);
  expect(await page.locator("[data-testid^=cartao-], [data-testid^=guarita-]").count()).toBe(0);
  await expect(page.getByTestId("grafico-A")).toBeVisible();
  expect(falso.chamadas).not.toContain("bolsoes");
});

test("janela sem foto vira faixa hachurada sem ponto da linha dentro", async ({ page }) => {
  await supabaseResultadosFalso(page, { resumo: RESUMO, impacto: IMPACTO, serie: SERIE });
  await page.goto("/resultados");
  const grafico = page.getByTestId("grafico-A");
  const lacuna = grafico.locator('[data-testid="lacuna"][data-de="19:10"]');
  await expect(lacuna.first()).toHaveAttribute("data-ate", "19:10");
  await expect(lacuna.first()).toHaveAttribute("aria-label", "sem dados de 19:10 a 19:10");
  const faixa = await lacuna.first().locator("rect").boundingBox();
  const pontos = await grafico.locator("circle").evaluateAll((cs) => cs.map((c) => c.getBoundingClientRect()).map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })));
  expect(pontos.length).toBe(53);
  for (const p of pontos) {
    const dentro = p.x > faixa!.x && p.x < faixa!.x + faixa!.width && p.y > faixa!.y && p.y < faixa!.y + faixa!.height;
    expect(dentro).toBe(false);
  }
  expect(await grafico.locator('circle[data-ponto="19:10"]').count()).toBe(0);
  // H parou às 19:00: uma lacuna grande até o fim da noite, e nenhum ponto depois
  const lacunaH = page.getByTestId("grafico-H").locator('[data-testid="lacuna"]');
  await expect(lacunaH).toHaveCount(1);
  await expect(lacunaH).toHaveAttribute("data-de", "19:00");
  await expect(lacunaH).toHaveAttribute("data-ate", "22:25");
  await expect(lacunaH).toContainText("sem dados");
});

test("trocar a noite recarrega os blocos e o gráfico", async ({ page }) => {
  await supabaseResultadosFalso(page, { resumo: RESUMO, impacto: IMPACTO, serie: SERIE });
  await page.goto("/resultados");
  await page.getByRole("combobox", { name: "Noite" }).selectOption(ANTERIOR);
  await expect(page.getByTestId("titulo-noite")).toHaveText("Noite de 12/10");
  await expect(page.getByTestId("bloco-C")).toHaveText("Bloco C: dado em 54 de 54 janelas (100 %). Lotou em 54 janelas.");
  await expect(page.getByTestId("bloco-H")).toHaveText("Bloco H: sem dado nessa noite.");
  await expect(page.getByTestId("grafico-C").locator("circle")).toHaveCount(54);
});

test("sem noites, diz que ainda não há dados", async ({ page }) => {
  await supabaseResultadosFalso(page, { resumo: [], impacto: [], serie: {} });
  await page.goto("/resultados");
  await expect(page.getByTestId("resultados-vazio")).toHaveText("Ainda não há noites com dados. O primeiro resultado aparece depois da primeira noite com os sensores ligados.");
  expect(await page.locator("main").textContent()).not.toMatch(/\d{2}:\d{2}/);
});

test("com a API fora, avisa sem mostrar número", async ({ page }) => {
  await page.route(/\/rest\/v1\/rpc\//, (rota) => rota.fulfill({ status: 500, body: "erro" }));
  await page.goto("/resultados");
  await expect(page.getByTestId("resultados-erro")).toContainText("não conseguiu ler os resultados");
  expect(await page.getByTestId("resultados-erro").textContent()).not.toMatch(/\d/);
});

test("Baixar CSV entrega o cabeçalho e uma linha por foto", async ({ page }) => {
  await supabaseResultadosFalso(page, { resumo: RESUMO, impacto: IMPACTO, serie: SERIE });
  await page.goto("/resultados");
  const botao = page.getByRole("button", { name: "Baixar CSV" });
  await expect(botao).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), botao.click()]);
  expect(download.suggestedFilename()).toBe("vagas-noite-2026-10-13.csv");
  const caminho = await download.path();
  const linhas = readFileSync(caminho!, "utf8").trimEnd().split("\n");
  expect(linhas[0]).toBe("noite;momento;bolsao;livres;total");
  expect(linhas.length).toBe(1 + SERIE[NOITE].length);
  expect(linhas[1]).toBe("2026-10-13;18:00;A;12;40");
  expect(linhas.some((l) => l.startsWith("2026-10-13;19:10;A;"))).toBe(false);
});
