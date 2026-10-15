import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { como, conectar, criarCentral, lerBolsao, limparEstado } from "./conexao";

let sql: Sql;

beforeAll(() => {
  sql = conectar();
});
afterAll(async () => {
  await sql.end();
});
beforeEach(async () => {
  await limparEstado(sql);
  await sql`update vagas.bolsoes set especiais = '{}', aviso = null`;
});

async function codigoDoErro(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}

/** Chama publicar como anon com os quatro parâmetros. */
async function publicar4(token: string, bolsoes: unknown, diag: unknown = null, especiais: unknown = null) {
  return como(sql, "anon", async (tx) => {
    const [r] = await tx<{ publicar: { atualizados: string[] } }[]>`
      select vagas.publicar(${token}, ${tx.json(bolsoes as never)}::jsonb, ${diag === null ? null : tx.json(diag as never)}::jsonb, ${especiais === null ? null : tx.json(especiais as never)}::jsonb)`;
    return r.publicar;
  });
}

describe("migration 0003", () => {
  it("existe uma só função publicar, com quatro parâmetros", async () => {
    const r = await sql<{ n: number; args: string }[]>`select count(*)::int as n, min(pg_get_function_arguments(oid)) as args from pg_proc where proname = 'publicar' and pronamespace = 'vagas'::regnamespace`;
    expect(r[0].n).toBe(1);
    expect(r[0].args).toContain("p_diag jsonb DEFAULT NULL");
  });

  it("o bolsão M nasce fora da página pública e anon consegue lê-lo", async () => {
    const r = await como(sql, "anon", (tx) => tx<{ id: string; publico: boolean }[]>`select id, publico from vagas.bolsoes where id = 'M'`);
    expect(r).toEqual([{ id: "M", publico: false }]);
    const publicos = await como(sql, "anon", (tx) => tx<{ id: string }[]>`select id from vagas.bolsoes where publico order by ordem`);
    expect(publicos.map((b) => b.id)).toEqual(["A", "C", "H"]);
  });
});

describe("publicar: p_diag (UX-58)", () => {
  it("objeto grava diag e diag_em; valor que não é objeto grava as vagas e deixa diag nulo", async () => {
    const token = await criarCentral(sql, "bolsao-a");
    await publicar4(token, { A: "010" }, { rssi: -67, uptime_s: 10 });
    const [c] = await sql<{ diag: { rssi: number } | null; diag_em: Date | null }[]>`select diag, diag_em from vagas.centrais where id = 'bolsao-a'`;
    expect(c.diag?.rssi).toBe(-67);
    expect(c.diag_em).not.toBeNull();

    const token2 = await criarCentral(sql, "bolsao-c");
    await publicar4(token2, { C: "01" }, "texto");
    const [c2] = await sql<{ diag: unknown; ultimo_envio: Date | null }[]>`select diag, ultimo_envio from vagas.centrais where id = 'bolsao-c'`;
    expect(c2.diag).toBeNull();
    expect(c2.ultimo_envio).not.toBeNull();
    expect((await lerBolsao(sql, "C")).total_vagas).toBe(2);
  });

  it("placas() é executável por anon e não expõe o hash do token", async () => {
    await criarCentral(sql, "bolsao-a");
    await criarCentral(sql, "inativa", false);
    const r = await como(sql, "anon", (tx) => tx<Record<string, unknown>[]>`select * from vagas.placas()`);
    expect(r.map((p) => p.id)).toEqual(["bolsao-a"]);
    expect(Object.keys(r[0])).not.toContain("token_hash");
    expect(await codigoDoErro(como(sql, "anon", (tx) => tx`select token_hash from vagas.centrais`))).toBe("42501");
  });
});

describe("publicar: p_especiais (UX-58)", () => {
  it("grava, zera e recusa posição fora da grade ou tipo desconhecido sem gravar nada", async () => {
    const token = await criarCentral(sql, "bolsao-a");
    await publicar4(token, { A: "01010" }, null, { A: { pcd: [0, 1] } });
    const [a] = await sql<{ especiais: Record<string, number[]> }[]>`select especiais from vagas.bolsoes where id = 'A'`;
    expect(a.especiais).toEqual({ pcd: [0, 1] });

    expect(await codigoDoErro(publicar4(token, { A: "00000" }, null, { A: { pcd: [5] } }))).toBe("22023");
    expect(await codigoDoErro(publicar4(token, { A: "00000" }, null, { A: { vip: [0] } }))).toBe("22023");
    expect(await codigoDoErro(publicar4(token, { A: "00000" }, null, { A: { pcd: [0, 0] } }))).toBe("22023");
    const depois = await lerBolsao(sql, "A");
    expect(depois.vagas).toEqual([false, true, false, true, false]);
    const [a2] = await sql<{ especiais: Record<string, number[]> }[]>`select especiais from vagas.bolsoes where id = 'A'`;
    expect(a2.especiais).toEqual({ pcd: [0, 1] });

    await publicar4(token, { A: "01010" });
    const [a3] = await sql<{ especiais: Record<string, number[]> }[]>`select especiais from vagas.bolsoes where id = 'A'`;
    expect(a3.especiais).toEqual({ pcd: [0, 1] });

    await publicar4(token, { A: "01010" }, null, { A: {} });
    const [a4] = await sql<{ especiais: Record<string, number[]> }[]>`select especiais from vagas.bolsoes where id = 'A'`;
    expect(a4.especiais).toEqual({});
  });
});

describe("token limitado a bolsões (UX-59)", () => {
  it("token com lista publica só nos seus bolsões; lista nula publica em qualquer um", async () => {
    const maquete = await criarCentral(sql, "maquete");
    await sql`update vagas.centrais set bolsoes = '{M}' where id = 'maquete'`;
    expect((await publicar4(maquete, { M: "010" })).atualizados).toEqual(["M"]);
    expect(await codigoDoErro(publicar4(maquete, { A: "01" }))).toBe("28000");
    expect((await lerBolsao(sql, "A")).vagas).toBeNull();
    expect(await codigoDoErro(publicar4(maquete, { M: "010" }, null, { A: { pcd: [0] } }))).toBe("28000");

    const livre = await criarCentral(sql, "livre");
    expect((await publicar4(livre, { A: "01", M: "1" })).atualizados.sort()).toEqual(["A", "M"]);
  });
});

describe("aviso da manutenção (UX-61)", () => {
  it("anon lê o aviso e não altera; publicar não mexe nele; o limite é 80 caracteres", async () => {
    await sql`update vagas.bolsoes set aviso = 'Sensor em conserto até sexta' where id = 'H'`;
    const r = await como(sql, "anon", (tx) => tx<{ aviso: string | null }[]>`select aviso from vagas.bolsoes where id = 'H'`);
    expect(r[0].aviso).toBe("Sensor em conserto até sexta");
    expect(await codigoDoErro(como(sql, "anon", (tx) => tx`update vagas.bolsoes set aviso = 'x' where id = 'H'`))).toBe("42501");
    const token = await criarCentral(sql, "bolsao-h");
    await publicar4(token, { H: "0" });
    expect((await sql<{ aviso: string }[]>`select aviso from vagas.bolsoes where id = 'H'`)[0].aviso).toBe("Sensor em conserto até sexta");
    expect(await codigoDoErro(sql`update vagas.bolsoes set aviso = ${"x".repeat(81)} where id = 'H'`)).toBe("23514");
  });
});
