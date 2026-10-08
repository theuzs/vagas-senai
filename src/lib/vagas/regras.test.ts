import { describe, expect, it } from "vitest";
import { deslocamentoRelogio, especiaisLivres, idadeMs, limitePoucas, orientacaoGuarita, situacao, textoIdade, tipoDaVaga } from "./regras";
import { EsquemaBolsao } from "./tipos";

const AGORA = Date.parse("2026-10-08T22:00:00.000Z");
const iso = (msAntes: number) => new Date(AGORA - msAntes).toISOString();

function bolsao(livres: number, total: number, msAntes = 1000) {
  const vagas = Array.from({ length: total }, (_, i) => i >= livres);
  return { atualizado_em: iso(msAntes), vagas, total_vagas: total, vagas_livres: livres };
}

describe("situacao", () => {
  it("sem dado nenhum é sem-dados", () => {
    expect(situacao({ atualizado_em: null, vagas: null, total_vagas: null, vagas_livres: null }, AGORA)).toBe("sem-dados");
  });

  it("dado de 29 s é fresco e de 31 s não", () => {
    expect(situacao(bolsao(5, 40, 29_000), AGORA)).toBe("livre");
    expect(situacao(bolsao(5, 40, 31_000), AGORA)).toBe("sem-dados");
  });

  it("relógio do servidor atrás do dado além de 5 s é sem-dados", () => {
    expect(situacao(bolsao(5, 40, -4_000), AGORA)).toBe("livre");
    expect(situacao(bolsao(5, 40, -6_000), AGORA)).toBe("sem-dados");
  });

  it("campos de estado nulos ou tamanho incoerente é sem-dados", () => {
    expect(situacao({ ...bolsao(5, 40), vagas: null }, AGORA)).toBe("sem-dados");
    expect(situacao({ ...bolsao(5, 40), total_vagas: null }, AGORA)).toBe("sem-dados");
    expect(situacao({ ...bolsao(5, 40), vagas_livres: null }, AGORA)).toBe("sem-dados");
    expect(situacao({ ...bolsao(5, 40), vagas: [false, true] }, AGORA)).toBe("sem-dados");
    expect(situacao({ ...bolsao(5, 40), vagas_livres: 41 }, AGORA)).toBe("sem-dados");
  });

  it("zero com dado fresco é lotado, nunca sem-dados", () => {
    expect(situacao(bolsao(0, 40), AGORA)).toBe("lotado");
    expect(situacao(bolsao(0, 1), AGORA)).toBe("lotado");
  });

  it("limite de poucas com 5, 40 e 500 vagas", () => {
    expect(limitePoucas(5)).toBe(3);
    expect(limitePoucas(40)).toBe(4);
    expect(limitePoucas(500)).toBe(50);
    expect(situacao(bolsao(3, 5), AGORA)).toBe("poucas");
    expect(situacao(bolsao(4, 5), AGORA)).toBe("livre");
    expect(situacao(bolsao(4, 40), AGORA)).toBe("poucas");
    expect(situacao(bolsao(5, 40), AGORA)).toBe("livre");
    expect(situacao(bolsao(50, 500), AGORA)).toBe("poucas");
    expect(situacao(bolsao(51, 500), AGORA)).toBe("livre");
  });

  it("data inválida é sem-dados", () => {
    expect(situacao({ ...bolsao(5, 40), atualizado_em: "ontem" }, AGORA)).toBe("sem-dados");
    expect(idadeMs("ontem", AGORA)).toBeNull();
  });
});

describe("relógio", () => {
  it("o deslocamento usa o meio da medição", () => {
    expect(deslocamentoRelogio(1000, 1400, 61_200)).toBe(60_000);
    expect(deslocamentoRelogio(1000, 1000, 1000)).toBe(0);
    expect(deslocamentoRelogio(10_000, 10_000, 4_000)).toBe(-6_000);
  });
});

describe("textoIdade", () => {
  it("cobre os quatro textos", () => {
    expect(textoIdade({ atualizado_em: null }, AGORA)).toBe("ainda não recebeu dados");
    expect(textoIdade({ atualizado_em: iso(2_000) }, AGORA)).toBe("agora");
    expect(textoIdade({ atualizado_em: iso(12_400) }, AGORA)).toBe("há 12 s");
    // 22:00Z = 19:00 em São Paulo
    expect(textoIdade({ atualizado_em: iso(90_000) }, AGORA)).toBe("sem dados desde 18:58");
    expect(textoIdade({ atualizado_em: iso(-10_000) }, AGORA)).toBe("sem dados desde 19:00");
  });
});

describe("especiais", () => {
  it("conta livres por tipo e ignora posição fora da grade", () => {
    const r = especiaisLivres({ vagas: [false, true, false, true], especiais: { pcd: [0, 1], idoso: [3, 9] } });
    expect(r).toEqual([
      { tipo: "pcd", rotulo: "PCD", livres: 1, total: 2 },
      { tipo: "idoso", rotulo: "Idoso", livres: 0, total: 1 },
    ]);
    expect(especiaisLivres({ vagas: null, especiais: { pcd: [0] } })).toEqual([]);
    expect(especiaisLivres({ vagas: [false], especiais: { pcd: [5] } })).toEqual([]);
  });

  it("tipoDaVaga acha a posição", () => {
    expect(tipoDaVaga({ pcd: [0, 1] }, 1)).toBe("pcd");
    expect(tipoDaVaga({ pcd: [0, 1] }, 2)).toBeNull();
    expect(tipoDaVaga({}, 0)).toBeNull();
  });
});

describe("EsquemaBolsao", () => {
  it("aceita a linha do seed e a linha com dados", () => {
    expect(EsquemaBolsao.parse({ id: "A", nome: "Bloco A", ordem: 1, total_vagas: null, vagas_livres: null, vagas: null, especiais: {}, atualizado_em: null }).id).toBe("A");
    const b = EsquemaBolsao.parse({ id: "H", nome: "Bloco H", ordem: 3, total_vagas: 2, vagas_livres: 1, vagas: [false, true], especiais: { pcd: [0] }, atualizado_em: iso(0) });
    expect(b.especiais.pcd).toEqual([0]);
  });

  it("recusa linha estranha", () => {
    expect(EsquemaBolsao.safeParse({ id: "a", nome: "x", ordem: 1 }).success).toBe(false);
    expect(EsquemaBolsao.safeParse({ id: "A", nome: "Bloco A", ordem: 1, total_vagas: 1, vagas_livres: 0, vagas: [1], especiais: {}, atualizado_em: null }).success).toBe(false);
  });
});

describe("orientacaoGuarita", () => {
  function b(id: string, ordem: number, livres: number | null, total = 10) {
    const vagas = livres === null ? null : Array.from({ length: total }, (_, i) => i >= livres);
    return { id, nome: `Bloco ${id}`, ordem, total_vagas: livres === null ? null : total, vagas_livres: livres, vagas, especiais: {}, atualizado_em: livres === null ? null : iso(1000) };
  }
  const sit = (bs: ReturnType<typeof b>[]) => new Map(bs.map((x) => [x.id, situacao(x, AGORA)]));

  it("indica o bolsão com mais vagas livres", () => {
    const bs = [b("A", 1, 2), b("C", 2, 0), b("H", 3, 7)];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.tipo).toBe("indicar");
    expect(o.indicado?.id).toBe("H");
    expect(o.texto).toBe("Mais vagas agora: Bloco H, 7 livres.");
    expect(o.detalhe).toBeNull();
  });

  it("empate fica com a ordem da tela, e uma vaga usa singular", () => {
    const bs = [b("A", 1, 1), b("C", 2, 1), b("H", 3, 0)];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.indicado?.id).toBe("A");
    expect(o.texto).toBe("Mais vagas agora: Bloco A, 1 livre.");
  });

  it("bolsão sem dado nunca é indicado e gera aviso para conferir", () => {
    const bs = [b("A", 1, 3), b("C", 2, null), b("H", 3, null)];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.indicado?.id).toBe("A");
    expect(o.detalhe).toBe("Blocos C e H sem dados: confira no local.");
  });

  it("com o resto lotado e um sem dado, não diz que está tudo lotado", () => {
    const bs = [b("A", 1, 0), b("C", 2, 0), b("H", 3, null)];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.tipo).toBe("sem-dados");
    expect(o.texto).not.toMatch(/três bolsões estão lotados/);
    expect(o.detalhe).toBe("Bloco H sem dados: confira no local.");
  });

  it("tudo sem dado pede para conferir no local", () => {
    const bs = [b("A", 1, null), b("C", 2, null), b("H", 3, null)];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.tipo).toBe("sem-dados");
    expect(o.texto).toBe("Os sensores não estão mandando dados.");
  });

  it("só diz lotado quando os três têm dado fresco e zero vagas", () => {
    const bs = [b("A", 1, 0), b("C", 2, 0), b("H", 3, 0)];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.tipo).toBe("lotado");
    expect(o.texto).toBe("Os três bolsões estão lotados.");
  });
});
