import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { como, conectar, limparEstado } from "./conexao";

let sql: Sql;

beforeAll(() => {
  sql = conectar();
});
afterAll(async () => {
  await sql.end();
});
beforeEach(async () => {
  await limparEstado(sql);
});

/** Data (AAAA-MM-DD) em São Paulo de `diasAtras` dias atrás. */
function noite(diasAtras: number): string {
  const d = new Date(Date.now() - diasAtras * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Insere uma foto no histórico na hora local de São Paulo (UTC-3, sem horário de verão). */
async function foto(bolsao: string, dia: string, hora: string, livres: number, total = 10) {
  await sql`insert into vagas.historico (bolsao_id, momento, vagas_livres, total_vagas) values (${bolsao}, ${`${dia}T${hora}:00-03:00`}::timestamptz, ${livres}, ${total})`;
}

interface Resumo {
  noite: string;
  bolsao_id: string;
  janelas_com_dado: number;
  janelas_lotado: number;
  min_livres: number;
  total_vagas: number;
}
interface Impacto {
  noite: string;
  janelas_avaliadas: number;
  janelas_lotado_com_vaga_em_outro: number;
  media_livres_outros: string | null;
}
interface Ponto {
  bolsao_id: string;
  momento: Date;
  vagas_livres: number;
  total_vagas: number;
}

// O driver converte `date` em Date do JS; o ::text deixa a noite como o PostgREST manda ("AAAA-MM-DD").
const COLUNAS_RESUMO = "noite::text as noite, bolsao_id, janelas_com_dado, janelas_lotado, min_livres, total_vagas";
const COLUNAS_IMPACTO = "noite::text as noite, janelas_avaliadas, janelas_lotado_com_vaga_em_outro, media_livres_outros";
const resumo = (dias?: number) =>
  como(sql, "anon", (tx) =>
    dias === undefined ? tx.unsafe<Resumo[]>(`select ${COLUNAS_RESUMO} from vagas.resumo_noites()`) : tx.unsafe<Resumo[]>(`select ${COLUNAS_RESUMO} from vagas.resumo_noites($1)`, [dias]),
  );
const impacto = (dias?: number) =>
  como(sql, "anon", (tx) =>
    dias === undefined ? tx.unsafe<Impacto[]>(`select ${COLUNAS_IMPACTO} from vagas.impacto()`) : tx.unsafe<Impacto[]>(`select ${COLUNAS_IMPACTO} from vagas.impacto($1)`, [dias]),
  );
const serie = (dia: string) => como(sql, "anon", (tx) => tx<Ponto[]>`select * from vagas.serie_noite(${dia}::date)`);

async function codigoDoErro(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}

describe("resultados: permissões", () => {
  it("anon executa as três funções e continua sem ler o histórico", async () => {
    expect(await resumo()).toEqual([]);
    expect(await impacto()).toEqual([]);
    expect(await serie(noite(1))).toEqual([]);
    expect(await codigoDoErro(como(sql, "anon", (tx) => tx`select * from vagas.historico`))).toBe("42501");
  });

  it("authenticated também executa", async () => {
    const r = await como(sql, "authenticated", (tx) => tx`select * from vagas.resumo_noites(7)`);
    expect(r).toEqual([]);
  });
});

describe("resumo_noites", () => {
  it("conta só as janelas das 18:00 às 22:25 em São Paulo", async () => {
    const d = noite(1);
    await foto("A", d, "18:00", 3);
    await foto("A", d, "18:05", 0);
    await foto("A", d, "18:15", 7);
    await foto("A", d, "23:00", 9);
    await foto("A", d, "22:30", 9);
    await foto("A", d, "17:55", 9);
    const r = await resumo();
    expect(r).toHaveLength(1);
    expect(r[0].bolsao_id).toBe("A");
    expect(r[0].noite).toBe(d);
    expect(r[0].janelas_com_dado).toBe(3);
    expect(r[0].janelas_lotado).toBe(1);
    expect(r[0].min_livres).toBe(0);
    expect(r[0].total_vagas).toBe(10);
  });

  it("uma foto às 22:25 ainda entra e a noite é a data local", async () => {
    const d = noite(2);
    await foto("C", d, "22:25", 2);
    const r = await resumo();
    expect(r.map((x) => [x.noite, x.bolsao_id, x.janelas_com_dado])).toEqual([[d, "C", 1]]);
  });

  it("separa por noite e por bolsão, da mais recente para a mais antiga", async () => {
    await foto("A", noite(3), "19:00", 1);
    await foto("H", noite(3), "19:00", 4);
    await foto("A", noite(1), "19:00", 2);
    const r = await resumo();
    expect(r.map((x) => [x.noite, x.bolsao_id])).toEqual([
      [noite(1), "A"],
      [noite(3), "A"],
      [noite(3), "H"],
    ]);
  });

  it("p_dias fica entre 1 e 120", async () => {
    await foto("A", noite(1), "19:00", 1);
    await foto("A", noite(45), "19:00", 1);
    await foto("A", noite(119), "19:00", 1);
    await foto("A", noite(125), "19:00", 1);
    expect((await resumo()).map((x) => x.noite)).toEqual([noite(1)]);
    expect((await resumo(120)).map((x) => x.noite)).toEqual([noite(1), noite(45), noite(119)]);
    expect(await resumo(1000)).toEqual(await resumo(120));
    expect(await resumo(0)).toEqual(await resumo(1));
    expect(await resumo(-5)).toEqual(await resumo(1));
  });
});

describe("impacto", () => {
  it("conta a janela em que um bolsão com foto lotou e outro com foto tinha vaga", async () => {
    const d = noite(1);
    await foto("A", d, "19:00", 0);
    await foto("C", d, "19:00", 5);
    const r = await impacto();
    expect(r).toHaveLength(1);
    expect(r[0].noite).toBe(d);
    expect(r[0].janelas_avaliadas).toBe(1);
    expect(r[0].janelas_lotado_com_vaga_em_outro).toBe(1);
    expect(Number(r[0].media_livres_outros)).toBe(5);
  });

  it("bolsão sem foto nunca conta como lotado nem como vaga", async () => {
    const d = noite(1);
    await foto("A", d, "19:00", 0);
    const r = await impacto();
    expect(r).toHaveLength(1);
    expect(r[0].janelas_avaliadas).toBe(0);
    expect(r[0].janelas_lotado_com_vaga_em_outro).toBe(0);
    expect(r[0].media_livres_outros).toBeNull();
  });

  it("dois lotados e um com vaga contam uma janela; todos com vaga não contam", async () => {
    const d = noite(1);
    await foto("A", d, "19:00", 0);
    await foto("C", d, "19:00", 0);
    await foto("H", d, "19:00", 8);
    await foto("A", d, "19:05", 3);
    await foto("C", d, "19:05", 4);
    await foto("A", d, "19:10", 0);
    await foto("C", d, "19:10", 2);
    await foto("H", d, "19:10", 6);
    const r = await impacto();
    expect(r[0].janelas_avaliadas).toBe(3);
    expect(r[0].janelas_lotado_com_vaga_em_outro).toBe(2);
    // janelas que contam: 19:00 (H=8) e 19:10 (C=2, H=6): média 16/3 = 5,3
    expect(Number(r[0].media_livres_outros)).toBeCloseTo(5.3, 1);
  });

  it("respeita o limite de dias", async () => {
    await foto("A", noite(1), "19:00", 0);
    await foto("C", noite(1), "19:00", 1);
    await foto("A", noite(40), "19:00", 0);
    await foto("C", noite(40), "19:00", 1);
    expect((await impacto()).map((x) => x.noite)).toEqual([noite(1)]);
    expect((await impacto(120)).map((x) => x.noite)).toEqual([noite(1), noite(40)]);
  });
});

describe("serie_noite", () => {
  it("devolve as fotos da noite no horário certo, por bolsão e hora", async () => {
    const d = noite(1);
    await foto("C", d, "18:10", 4, 24);
    await foto("A", d, "18:05", 7, 40);
    await foto("A", d, "18:00", 8, 40);
    await foto("A", d, "23:00", 8, 40);
    await foto("A", noite(2), "18:00", 8, 40);
    const r = await serie(d);
    expect(r.map((p) => [p.bolsao_id, p.vagas_livres, p.total_vagas])).toEqual([
      ["A", 8, 40],
      ["A", 7, 40],
      ["C", 4, 24],
    ]);
    expect(r[0].momento.toISOString()).toBe(new Date(`${d}T18:00:00-03:00`).toISOString());
  });
});
