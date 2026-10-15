import { describe, expect, it } from "vitest";
import {
  anunciosGuarita,
  avisoColunaSemDados,
  causaSemDados,
  dadosVisiveis,
  deslocamentoRelogio,
  especiaisLivres,
  especiaisLivresTotal,
  idadeMs,
  indicadorConexao,
  limitePoucas,
  livresComuns,
  orientacaoGuarita,
  orientacaoMotorista,
  quando,
  situacao,
  situacaoComum,
  textoEspecial,
  textoIdade,
  textoSemDados,
  tipoDaVaga,
  type EstadoAnuncio,
} from "./regras";
import { EsquemaBolsao, type Bolsao, type Situacao } from "./tipos";

const AGORA = Date.parse("2026-10-08T22:00:00.000Z");
const iso = (msAntes: number) => new Date(AGORA - msAntes).toISOString();

function bolsao(livres: number, total: number, msAntes = 1000) {
  const vagas = Array.from({ length: total }, (_, i) => i >= livres);
  return { atualizado_em: iso(msAntes), vagas, total_vagas: total, vagas_livres: livres, especiais: {} };
}

/** Bolsão completo a partir de uma string de 0 (livre) e 1 (ocupada); null = sem dado. */
function b(id: string, ordem: number, estados: string | null, especiais: Bolsao["especiais"] = {}, msAntes = 1000, aviso: string | null = null): Bolsao {
  const vagas = estados === null ? null : [...estados].map((c) => c === "1");
  return {
    id,
    nome: `Bloco ${id}`,
    ordem,
    total_vagas: vagas?.length ?? null,
    vagas_livres: vagas ? vagas.filter((v) => !v).length : null,
    vagas,
    especiais,
    atualizado_em: estados === null ? null : iso(msAntes),
    aviso,
    publico: true,
  };
}
const n = (livres: number | null, total = 10) => (livres === null ? null : "0".repeat(livres) + "1".repeat(total - livres));
const sit = (bs: Bolsao[]) => new Map<string, Situacao>(bs.map((x) => [x.id, situacaoComum(x, AGORA)]));

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

describe("dadosVisiveis", () => {
  it("devolve null para cada motivo de sem-dados", () => {
    const x = bolsao(5, 40);
    expect(dadosVisiveis(x, "sem-dados")).toBeNull();
    for (const ruim of [bolsao(5, 40, 31_000), bolsao(5, 40, -6_000), { ...bolsao(5, 40), vagas: [false, true] }, { ...bolsao(5, 40), vagas_livres: 41 }, { ...x, vagas_livres: null }]) {
      expect(dadosVisiveis(ruim, situacao(ruim, AGORA))).toBeNull();
    }
  });

  it("devolve o objeto certo para livre, poucas e lotado", () => {
    expect(dadosVisiveis(bolsao(12, 40), "livre")).toMatchObject({ livres: 12, total: 40, livresComuns: 12, especiaisLivres: 0 });
    expect(dadosVisiveis(bolsao(2, 40), "poucas")?.livres).toBe(2);
    expect(dadosVisiveis(bolsao(0, 40), "lotado")?.livres).toBe(0);
  });
});

describe("vagas comuns (decisão D2)", () => {
  it("'00111' com pcd 0 e idoso 1: nenhuma comum livre, 2 especiais, LOTADO", () => {
    const x = b("C", 2, "00111", { pcd: [0], idoso: [1] });
    expect(livresComuns(x)).toBe(0);
    expect(especiaisLivresTotal(x)).toBe(2);
    expect(situacaoComum(x, AGORA)).toBe("lotado");
    expect(situacaoComum(b("C", 2, "00111", { pcd: [0], idoso: [1] }, 31_000), AGORA)).toBe("sem-dados");
  });

  it("posição em duas listas conta uma vez", () => {
    expect(especiaisLivresTotal(b("A", 1, "01111", { pcd: [0], idoso: [0] }))).toBe(1);
    expect(livresComuns({ vagas: null, especiais: {} })).toBeNull();
  });

  it("sem especiais é igual a situacao", () => {
    for (const [l, t] of [
      [0, 40],
      [3, 5],
      [4, 5],
      [5, 40],
      [51, 500],
    ]) {
      expect(situacaoComum(bolsao(l, t), AGORA)).toBe(situacao(bolsao(l, t), AGORA));
    }
  });
});

describe("relógio", () => {
  it("o deslocamento usa o meio da medição", () => {
    expect(deslocamentoRelogio(1000, 1400, 61_200)).toBe(60_000);
    expect(deslocamentoRelogio(1000, 1000, 1000)).toBe(0);
    expect(deslocamentoRelogio(10_000, 10_000, 4_000)).toBe(-6_000);
  });
});

describe("quando e textoIdade", () => {
  // 22:00Z = 19:00 em São Paulo
  it("hora no mesmo dia, 'ontem às' no dia anterior e a data antes disso", () => {
    expect(quando(AGORA - 90_000, AGORA)).toBe("18:58");
    expect(quando(AGORA - 19 * 3_600_000, AGORA)).toBe("00:00");
    expect(quando(AGORA - (19 * 60 + 1) * 60_000, AGORA)).toBe("ontem às 23:59");
    expect(quando(AGORA - 21 * 3_600_000, AGORA)).toBe("ontem às 22:00");
    expect(quando(AGORA - 49 * 3_600_000, AGORA)).toBe("06/10 às 18:00");
    expect(quando(AGORA + 10_000, AGORA)).toBe("19:00");
  });

  it("textoIdade cobre os textos", () => {
    expect(textoIdade({ atualizado_em: null }, AGORA)).toBe("ainda não recebeu dados");
    expect(textoIdade({ atualizado_em: iso(2_000) }, AGORA)).toBe("agora");
    expect(textoIdade({ atualizado_em: iso(12_400) }, AGORA)).toBe("há 12 s");
    expect(textoIdade({ atualizado_em: iso(90_000) }, AGORA)).toBe("sem dados desde 18:58");
    expect(textoIdade({ atualizado_em: iso(19 * 3_600_000) }, AGORA)).toBe("sem dados desde 00:00");
    expect(textoIdade({ atualizado_em: iso((19 * 60 + 1) * 60_000) }, AGORA)).toBe("sem dados desde ontem às 23:59");
    expect(textoIdade({ atualizado_em: iso(21 * 3_600_000) }, AGORA)).toBe("sem dados desde ontem às 22:00");
    expect(textoIdade({ atualizado_em: iso(49 * 3_600_000) }, AGORA)).toBe("sem dados desde 06/10 às 18:00");
    expect(textoIdade({ atualizado_em: iso(-10_000) }, AGORA)).toBe("sem dados desde 19:00");
  });
});

describe("causaSemDados", () => {
  const base = { modo: "supabase" as const, carregou: false, msDesdeMontagem: 1000, status: "conectando" as const, erroCarga: false, online: true, msDesdeLeituraOk: null };
  it("segue a ordem das causas", () => {
    expect(causaSemDados(base)).toBe("carregando");
    expect(causaSemDados({ ...base, msDesdeMontagem: 6000 })).toBe("sem-conexao");
    expect(causaSemDados({ ...base, carregou: true, status: "ao-vivo" })).toBe("sensor");
    expect(causaSemDados({ ...base, carregou: true, status: "ao-vivo", erroCarga: true })).toBe("sem-conexao");
    expect(causaSemDados({ ...base, carregou: true, status: "reconectando", msDesdeLeituraOk: 8000 })).toBe("sensor");
    expect(causaSemDados({ ...base, carregou: true, status: "reconectando", msDesdeLeituraOk: 20_000 })).toBe("sem-conexao");
    expect(causaSemDados({ ...base, carregou: true, status: "ao-vivo", online: false })).toBe("sem-conexao");
    expect(causaSemDados({ ...base, modo: "sem-configuracao" })).toBe("configuracao");
    expect(causaSemDados({ ...base, modo: "demo" })).toBe("sensor");
  });
});

describe("textoSemDados", () => {
  const nulo = { atualizado_em: null };
  const op = (causa: Parameters<typeof textoSemDados>[2]["causa"], online = true) => ({ causa, online, aparelho: "celular" as const });
  it("cobre os sete casos e só a causa sensor fala em sensor", () => {
    const casos = [
      textoSemDados(nulo, AGORA, op("carregando")),
      textoSemDados(nulo, AGORA, op("sem-conexao", false)),
      textoSemDados(nulo, AGORA, op("sem-conexao")),
      textoSemDados(nulo, AGORA, op("configuracao")),
    ];
    expect(casos[0]).toEqual({ longo: "A página está carregando as vagas.", curto: "carregando" });
    expect(casos[1].longo).toBe("O celular está sem internet. O bloco pode ter vaga livre. Confira no local.");
    expect(casos[2].longo).toBe("Este aparelho está sem conexão com o servidor. O bloco pode ter vaga livre. Confira no local.");
    expect(casos[3].longo).toBe("A página está com erro de configuração. O bloco pode ter vaga livre. Confira no local.");
    for (const c of casos) expect(c.longo + c.curto).not.toMatch(/sensor/);

    expect(textoSemDados(nulo, AGORA, op("sensor"))).toEqual({ longo: "Os sensores deste bloco ainda não mandaram dados. O bloco pode ter vaga livre. Confira no local.", curto: "ainda não recebeu dados" });
    expect(textoSemDados({ atualizado_em: iso(90_000) }, AGORA, op("sensor"))).toEqual({ longo: "O último dado dos sensores chegou às 18:58. O bloco pode ter vaga livre. Confira no local.", curto: "sem dados desde 18:58" });
    expect(textoSemDados({ atualizado_em: iso(21 * 3_600_000) }, AGORA, op("sensor")).longo).toBe("O último dado dos sensores chegou ontem às 22:00. O bloco pode ter vaga livre. Confira no local.");
    expect(textoSemDados({ atualizado_em: iso(49 * 3_600_000) }, AGORA, op("sensor")).longo).toBe("O último dado dos sensores chegou em 06/10 às 18:00. O bloco pode ter vaga livre. Confira no local.");
    expect(textoSemDados({ atualizado_em: iso(2_000) }, AGORA, op("sensor"))).toEqual({ longo: "Os sensores deste bloco mandaram um dado incompleto. O bloco pode ter vaga livre. Confira no local.", curto: "dado incompleto" });
    expect(textoSemDados(nulo, AGORA, { causa: "sem-conexao", online: false, aparelho: "guarita" }).longo).toMatch(/^Este computador está sem internet/);
  });
});

describe("indicadorConexao", () => {
  const tudoSem = new Map<string, Situacao>([["A", "sem-dados"]]);
  const umCom = new Map<string, Situacao>([["A", "livre"]]);
  it("cobre os seis casos", () => {
    expect(indicadorConexao("demo", "sensor", umCom)).toMatchObject({ chave: "demo", texto: "Simulação", tom: "verde" });
    expect(indicadorConexao("sem-configuracao", "configuracao", tudoSem)).toMatchObject({ chave: "sem-configuracao", texto: "Fora do ar", tom: "vermelho" });
    expect(indicadorConexao("supabase", "carregando", tudoSem)).toMatchObject({ chave: "conectando", texto: "Conectando", tom: "cinza" });
    expect(indicadorConexao("supabase", "sem-conexao", umCom)).toMatchObject({ chave: "sem-conexao", texto: "Sem conexão", tom: "alerta" });
    expect(indicadorConexao("supabase", "sensor", umCom)).toMatchObject({ chave: "ao-vivo", texto: "Ao vivo", tom: "verde" });
    expect(indicadorConexao("supabase", "sensor", tudoSem)).toMatchObject({ chave: "sem-sensores", texto: "Sensores sem dados", tom: "alerta" });
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

  it("textoEspecial com 0, 1 e 2", () => {
    expect(textoEspecial({ rotulo: "PCD", livres: 2 })).toBe("PCD: 2 livres");
    expect(textoEspecial({ rotulo: "PCD", livres: 1 })).toBe("PCD: 1 livre");
    expect(textoEspecial({ rotulo: "Idoso", livres: 0 })).toBe("Idoso: nenhuma livre");
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
    const x = EsquemaBolsao.parse({ id: "H", nome: "Bloco H", ordem: 3, total_vagas: 2, vagas_livres: 1, vagas: [false, true], especiais: { pcd: [0] }, atualizado_em: iso(0) });
    expect(x.especiais.pcd).toEqual([0]);
    expect(x.aviso).toBeNull();
    expect(x.publico).toBe(true);
  });

  it("recusa linha estranha", () => {
    expect(EsquemaBolsao.safeParse({ id: "a", nome: "x", ordem: 1 }).success).toBe(false);
    expect(EsquemaBolsao.safeParse({ id: "A", nome: "Bloco A", ordem: 1, total_vagas: 1, vagas_livres: 0, vagas: [1], especiais: {}, atualizado_em: null }).success).toBe(false);
  });
});

describe("orientacaoGuarita", () => {
  it("indica o bloco com mais vagas comuns livres", () => {
    const bs = [b("A", 1, n(2)), b("C", 2, n(0)), b("H", 3, n(7))];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.tipo).toBe("indicar");
    expect(o.indicado?.id).toBe("H");
    expect(o.texto).toBe("Indique o Bloco H: 7 vagas livres.");
    expect(o.detalhe).toBeNull();
  });

  it("empate fica com a ordem da tela, e uma vaga usa singular", () => {
    const bs = [b("A", 1, n(1)), b("C", 2, n(0)), b("H", 3, n(0))];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.indicado?.id).toBe("A");
    expect(o.texto).toBe("Indique o Bloco A: 1 vaga livre.");
  });

  it("bloco sem dado nunca é indicado e entra no detalhe", () => {
    const bs = [b("A", 1, n(3)), b("C", 2, null), b("H", 3, null)];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.indicado?.id).toBe("A");
    expect(o.detalhe).toBe("Blocos C e H sem dados. Eles podem ter vaga.");
  });

  it("com o resto lotado e um sem dado, o texto grande começa pelo bloco sem dados", () => {
    const bs = [b("A", 1, n(0)), b("C", 2, n(0)), b("H", 3, null)];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.tipo).toBe("sem-dados");
    expect(o.texto).toBe("Bloco H sem dados. Ele pode ter vaga.");
    expect(o.texto).not.toMatch(/lotad/);
    expect(o.detalhe).toBe("Os sensores mostram os blocos A e C lotados.");
  });

  it("dois sem dados e um lotado", () => {
    const bs = [b("A", 1, n(0)), b("C", 2, null), b("H", 3, null)];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.texto).toBe("Blocos C e H sem dados. Eles podem ter vaga.");
    expect(o.detalhe).toBe("Os sensores mostram o Bloco A lotado.");
  });

  it("tudo sem dado pede para não dizer que está lotado", () => {
    const bs = [b("A", 1, null), b("C", 2, null), b("H", 3, null)];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.tipo).toBe("sem-dados");
    expect(o.texto).toBe("Os sensores não estão mandando dados.");
    expect(o.detalhe).toBe("Não diga ao motorista que está lotado.");
  });

  it("só diz lotado quando os três têm dado fresco e zero vagas", () => {
    const bs = [b("A", 1, n(0)), b("C", 2, n(0)), b("H", 3, n(0))];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.tipo).toBe("lotado");
    expect(o.texto).toBe("Os três estacionamentos estão lotados.");
  });

  it("sem conexão, a faixa fala da tela, e com um bloco fresco ainda indica", () => {
    const nulos = [b("A", 1, null), b("C", 2, null), b("H", 3, null)];
    const o = orientacaoGuarita(nulos, sit(nulos), "sem-conexao");
    expect(o).toMatchObject({ tipo: "sem-dados", texto: "Esta tela está sem conexão.", detalhe: "Não diga que está lotado. Os números voltam sozinhos quando a conexão voltar." });
    expect(orientacaoGuarita(nulos, sit(nulos), "carregando").texto).toBe("A tela está carregando as vagas.");
    expect(orientacaoGuarita(nulos, sit(nulos), "configuracao").texto).toBe("Esta tela está com erro de configuração.");
    const comA = [b("A", 1, n(3)), b("C", 2, null), b("H", 3, null)];
    expect(orientacaoGuarita(comA, sit(comA), "sem-conexao").tipo).toBe("indicar");
  });

  it("vagas comuns lotadas com especial livre", () => {
    const bs = [b("A", 1, "11111"), b("C", 2, "00111", { pcd: [0], idoso: [1] }), b("H", 3, "11111")];
    const o = orientacaoGuarita(bs, sit(bs));
    expect(o.tipo).not.toBe("indicar");
    expect(o.texto).toBe("As vagas comuns estão lotadas.");
    expect(o.especiais).toBe("Vagas especiais livres: Bloco C (1 PCD, 1 idoso).");
  });

  it("mantém o bloco anterior quando a diferença é pequena (UX-33)", () => {
    const perto = [b("A", 1, n(12, 40)), b("H", 3, n(11, 40))];
    expect(orientacaoGuarita(perto, sit(perto), "sensor", "H").indicado?.id).toBe("H");
    const longe = [b("A", 1, n(15, 40)), b("H", 3, n(11, 40))];
    expect(orientacaoGuarita(longe, sit(longe), "sensor", "H").indicado?.id).toBe("A");
    const hLotado = [b("A", 1, n(12, 40)), b("H", 3, n(0, 40))];
    expect(orientacaoGuarita(hLotado, sit(hLotado), "sensor", "H").indicado?.id).toBe("A");
    const hSem = [b("A", 1, n(12, 40)), b("H", 3, null)];
    expect(orientacaoGuarita(hSem, sit(hSem), "sensor", "H").indicado?.id).toBe("A");
    const poucas = [b("A", 1, n(3, 40)), b("H", 3, n(2, 40))];
    expect(orientacaoGuarita(poucas, sit(poucas), "sensor", "H").indicado?.id).toBe("A");
  });
});

describe("orientacaoMotorista", () => {
  it("cobre os quatro casos", () => {
    const comVaga = [b("A", 1, n(12, 40)), b("C", 2, n(0)), b("H", 3, null)];
    expect(orientacaoMotorista(comVaga, sit(comVaga), AGORA)).toMatchObject({ texto: "O Bloco A tem mais vagas: 12 livres.", detalhe: "O Bloco H está sem dados e pode ter vaga. Confira no local." });
    const semVaga = [b("A", 1, n(0)), b("C", 2, n(0)), b("H", 3, null)];
    expect(orientacaoMotorista(semVaga, sit(semVaga), AGORA)).toMatchObject({ texto: "O Bloco H está sem dados e pode ter vaga.", detalhe: "Os sensores mostram os blocos A e C lotados." });
    const lotados = [b("A", 1, n(0)), b("C", 2, n(0)), b("H", 3, n(0))];
    expect(orientacaoMotorista(lotados, sit(lotados), AGORA).texto).toBe("Os três estacionamentos estão lotados.");
    const nulos = [b("A", 1, null), b("C", 2, null), b("H", 3, null)];
    expect(orientacaoMotorista(nulos, sit(nulos), AGORA)).toMatchObject({ texto: "Os sensores não estão mandando dados.", detalhe: "Os sensores ainda não mandaram nenhum dado. Confira as vagas no local." });
    const velhos = [b("A", 1, n(5), {}, 21 * 3_600_000), b("C", 2, n(5), {}, 22 * 3_600_000), b("H", 3, null)];
    expect(orientacaoMotorista(velhos, sit(velhos), AGORA).detalhe).toBe("O último dado chegou ontem às 22:00. Confira as vagas no local.");
    const umLivre = [b("A", 1, n(1)), b("C", 2, n(0)), b("H", 3, n(0))];
    expect(orientacaoMotorista(umLivre, sit(umLivre), AGORA).texto).toBe("O Bloco A tem mais vagas: 1 livre.");
  });
});

describe("avisoColunaSemDados", () => {
  it("pede para avisar o responsável depois de 10 min ou com nulo depois da primeira carga", () => {
    expect(avisoColunaSemDados({ atualizado_em: iso(31_000), aviso: null }, AGORA, "sensor", true)).toBe("Não diga que está lotado. O bloco pode ter vaga.");
    expect(avisoColunaSemDados({ atualizado_em: iso(601_000), aviso: null }, AGORA, "sensor", true)).toBe("Não diga que está lotado. Avise o responsável pelos sensores.");
    expect(avisoColunaSemDados({ atualizado_em: null, aviso: null }, AGORA, "sensor", true)).toBe("Não diga que está lotado. Avise o responsável pelos sensores.");
    expect(avisoColunaSemDados({ atualizado_em: null, aviso: null }, AGORA, "sensor", false)).toBe("Não diga que está lotado. O bloco pode ter vaga.");
    expect(avisoColunaSemDados({ atualizado_em: null, aviso: null }, AGORA, "sem-conexao", true)).toBe("Não diga que está lotado. O bloco pode ter vaga.");
    expect(avisoColunaSemDados({ atualizado_em: null, aviso: "Sensor em conserto" }, AGORA, "sensor", true)).toBe("Não diga que está lotado. O bloco pode ter vaga.");
  });
});

describe("anunciosGuarita (UX-63)", () => {
  function roda(sequencia: { s: number; cat: "com-vaga" | "lotado" | "sem-dados" }[], semConexao = false) {
    let anunciado = new Map<string, EstadoAnuncio>();
    let atual = new Map<string, EstadoAnuncio>();
    const frases: string[] = [];
    let i = 0;
    for (let s = 0; s <= sequencia[sequencia.length - 1].s; s++) {
      while (i + 1 < sequencia.length && sequencia[i + 1].s <= s) i++;
      const r = anunciosGuarita([{ id: "C", nome: "Bloco C", categoria: sequencia[i].cat }], anunciado, s * 1000, semConexao, atual);
      anunciado = r.anunciado;
      atual = r.atual;
      frases.push(...r.frases);
    }
    return frases;
  }

  it("sensor oscilando não fala; mudanças que duram falam uma vez", () => {
    const osc: { s: number; cat: "com-vaga" | "lotado" }[] = [];
    for (let s = 0; s < 120; s += 10) osc.push({ s, cat: s % 20 === 0 ? "lotado" : "com-vaga" });
    expect(roda(osc)).toEqual([]);
    expect(roda([{ s: 0, cat: "com-vaga" }, { s: 25, cat: "lotado" }, { s: 60, cat: "lotado" }])).toEqual(["Bloco C lotou."]);
    expect(roda([{ s: 0, cat: "com-vaga" }, { s: 25, cat: "lotado" }, { s: 60, cat: "com-vaga" }, { s: 100, cat: "com-vaga" }])).toEqual(["Bloco C lotou.", "Bloco C voltou a ter vaga."]);
    expect(roda([{ s: 0, cat: "com-vaga" }, { s: 25, cat: "sem-dados" }, { s: 84, cat: "sem-dados" }])).toEqual([]);
    expect(roda([{ s: 0, cat: "com-vaga" }, { s: 25, cat: "sem-dados" }, { s: 86, cat: "sem-dados" }])).toEqual(["Bloco C ficou sem dados."]);
    expect(roda([{ s: 0, cat: "com-vaga" }, { s: 25, cat: "lotado" }, { s: 60, cat: "lotado" }], true)).toEqual([]);
  });
});
