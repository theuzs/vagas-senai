import { describe, expect, it } from "vitest";
import { JANELAS, JANELAS_POR_NOITE, csvDaNoite, dataCurta, lacunas, noitesDe, resumoGeral, textoBloco, textoNoite, textoResumo } from "./calculos";

const foto = (bolsao: string, hora: string, livres = 3, total = 10) => ({ bolsao_id: bolsao, momento: `2026-10-13T${hora}:00-03:00`, vagas_livres: livres, total_vagas: total });

describe("janelas", () => {
  it("são 54, das 18:00 às 22:25", () => {
    expect(JANELAS_POR_NOITE).toBe(54);
    expect(JANELAS[0]).toBe("18:00");
    expect(JANELAS[1]).toBe("18:05");
    expect(JANELAS[53]).toBe("22:25");
  });
});

describe("textos", () => {
  it("prende a data e escreve a noite", () => {
    expect(dataCurta("2026-10-13")).toBe("13/10");
    expect(textoNoite("2026-10-05")).toBe("Noite de 05/10");
  });

  it("resumo geral soma as noites e pondera a média", () => {
    const r = resumoGeral([
      { noite: "2026-10-13", janelas_avaliadas: 53, janelas_lotado_com_vaga_em_outro: 12, media_livres_outros: 7.5 },
      { noite: "2026-10-12", janelas_avaliadas: 54, janelas_lotado_com_vaga_em_outro: 3, media_livres_outros: "10" },
      { noite: "2026-10-11", janelas_avaliadas: 20, janelas_lotado_com_vaga_em_outro: 0, media_livres_outros: null },
    ]);
    expect(r).toEqual({ noites: 3, janelas: 127, lotadoComVaga: 15, mediaOutros: 8 });
    expect(textoResumo(r)).toBe("Em 15 das 127 janelas das últimas 3 noites, um bloco estava lotado e outro tinha vaga livre. Nessas janelas, os outros blocos tinham em média 8 vagas livres.");
  });

  it("resumo sem janela que contou não fala de média", () => {
    const r = resumoGeral([{ noite: "2026-10-13", janelas_avaliadas: 54, janelas_lotado_com_vaga_em_outro: 0, media_livres_outros: null }]);
    expect(textoResumo(r)).toBe("Em 0 das 54 janelas da última noite, um bloco estava lotado e outro tinha vaga livre.");
  });

  it("média com vírgula", () => {
    const r = resumoGeral([{ noite: "2026-10-13", janelas_avaliadas: 54, janelas_lotado_com_vaga_em_outro: 3, media_livres_outros: 5.3 }]);
    expect(textoResumo(r)).toContain("em média 5,3 vagas livres.");
  });

  it("linha do bloco", () => {
    expect(textoBloco({ noite: "2026-10-13", bolsao_id: "A", janelas_com_dado: 52, janelas_lotado: 12, min_livres: 0, total_vagas: 40 })).toBe(
      "Bloco A: dado em 52 de 54 janelas (96 %). Lotou em 12 janelas.",
    );
    expect(textoBloco({ noite: "2026-10-13", bolsao_id: "C", janelas_com_dado: 54, janelas_lotado: 1, min_livres: 0, total_vagas: 24 })).toBe(
      "Bloco C: dado em 54 de 54 janelas (100 %). Lotou em 1 janela.",
    );
    expect(textoBloco({ noite: "2026-10-13", bolsao_id: "H", janelas_com_dado: 3, janelas_lotado: 0, min_livres: 5, total_vagas: 60 })).toBe(
      "Bloco H: dado em 3 de 54 janelas (6 %). Não lotou.",
    );
  });
});

describe("noites e lacunas", () => {
  it("lista as noites da mais recente para a mais antiga, sem repetir", () => {
    expect(noitesDe([{ noite: "2026-10-12" }, { noite: "2026-10-13" }, { noite: "2026-10-12" }])).toEqual(["2026-10-13", "2026-10-12"]);
  });

  it("acha os trechos sem foto", () => {
    const fotos = JANELAS.filter((h) => h !== "19:10" && h !== "19:15" && h < "22:00").map((h) => foto("A", h));
    expect(lacunas(fotos)).toEqual([
      { de: 14, ate: 15 },
      { de: 48, ate: 53 },
    ]);
    expect(lacunas([])).toEqual([{ de: 0, ate: 53 }]);
    expect(lacunas(JANELAS.map((h) => foto("A", h)))).toEqual([]);
  });
});

describe("csv", () => {
  it("tem cabeçalho e uma linha por foto, com hora local", () => {
    const csv = csvDaNoite("2026-10-13", [foto("A", "18:00", 12, 40), foto("C", "18:05", 0, 24)]);
    expect(csv).toBe("noite;momento;bolsao;livres;total\n2026-10-13;18:00;A;12;40\n2026-10-13;18:05;C;0;24\n");
  });
});
