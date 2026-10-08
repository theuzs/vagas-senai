import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aplicarMigracoes } from "../../scripts/migracoes";
import { iniciarBolsoes, montarPayload } from "../../scripts/simulador";
import { gerarToken, hashDoToken } from "../../scripts/token";
import { como, conectar, limparEstado } from "./conexao";

describe("token:gerar", () => {
  let sql: Sql;
  beforeAll(() => {
    sql = conectar();
  });
  afterAll(async () => {
    await sql.end();
  });

  it("gera um token que a função publicar aceita, e o SQL cadastra só o hash", async () => {
    await limparEstado(sql);
    const g = gerarToken("central-teste", "Central d'água");
    expect(g.token.length).toBeGreaterThanOrEqual(32);
    expect(g.hashHex).toBe(hashDoToken(g.token));
    expect(g.sql).not.toContain(g.token);
    await sql.unsafe(g.sql);

    const r = await como(sql, "anon", async (tx) => {
      const [x] = await tx<{ publicar: { atualizados: string[] } }[]>`select vagas.publicar(${g.token}, ${tx.json({ A: "01" })}::jsonb)`;
      return x.publicar;
    });
    expect(r.atualizados).toEqual(["A"]);

    // Rodar o SQL de novo (token novo para a mesma central) troca o hash e invalida o antigo.
    const g2 = gerarToken("central-teste", "Central");
    await sql.unsafe(g2.sql);
    await expect(
      como(sql, "anon", (tx) => tx`select vagas.publicar(${g.token}, ${tx.json({ A: "01" })}::jsonb)`),
    ).rejects.toMatchObject({ code: "28000" });
  });

  it("recusa id de central fora do padrão", () => {
    expect(() => gerarToken("Central 1", "x")).toThrow();
  });

  it("o simulador monta um payload que publicar aceita e deixa o bolsão parado de fora", async () => {
    await limparEstado(sql);
    const g = gerarToken("sim", "Simulador");
    await sql.unsafe(g.sql);
    const payload = montarPayload(g.token, iniciarBolsoes(), ["H"]);
    expect(Object.keys(payload.p_bolsoes).sort()).toEqual(["A", "C"]);
    expect(payload.p_bolsoes.A).toMatch(/^[01]{40}$/);
    const r = await como(sql, "anon", async (tx) => {
      const [x] = await tx<{ publicar: { atualizados: string[] } }[]>`select vagas.publicar(${payload.p_token}, ${tx.json(payload.p_bolsoes)}::jsonb)`;
      return x.publicar;
    });
    expect(r.atualizados.sort()).toEqual(["A", "C"]);
  });
});

describe("db:aplicar", () => {
  // Banco próprio, vazio, para ver o script aplicar do zero.
  const PORT = 54100 + (process.pid % 90);
  const DIR = join(tmpdir(), "vagas-senai", `pgdata-aplicar-${process.pid}`);
  const URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;
  let pg: EmbeddedPostgres;
  let sql: Sql;

  beforeAll(async () => {
    pg = new EmbeddedPostgres({ databaseDir: DIR, port: PORT, user: "postgres", password: "postgres", persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {}, onError: () => {} });
    await pg.initialise();
    await pg.start();
    sql = postgres(URL, { max: 1, onnotice: () => {} });
    await sql.unsafe(readFileSync(join(process.cwd(), "tests", "db", "shim-supabase.sql"), "utf8"));
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
    await pg?.stop();
  });

  function migracoes() {
    const dir = join(process.cwd(), "db", "migracoes");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((nome) => ({ nome, sql: readFileSync(join(dir, nome), "utf8") }));
  }

  it("aplica tudo na primeira vez, nada na segunda, e --conferir lista certo", async () => {
    const lista = migracoes();
    expect(lista.length).toBeGreaterThan(0);

    const antes = await aplicarMigracoes(sql, lista, { conferir: true });
    expect(antes.pendentes).toEqual(lista.map((m) => m.nome));
    expect(antes.aplicadas).toEqual([]);

    const primeira = await aplicarMigracoes(sql, lista);
    expect(primeira.aplicadas).toEqual(lista.map((m) => m.nome));
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from vagas.bolsoes`;
    expect(n.n).toBe(3);

    const segunda = await aplicarMigracoes(sql, lista);
    expect(segunda.aplicadas).toEqual([]);
    expect(segunda.jaAplicadas).toEqual(lista.map((m) => m.nome));

    const depois = await aplicarMigracoes(sql, lista, { conferir: true });
    expect(depois.pendentes).toEqual([]);

    const registradas = await sql<{ nome: string }[]>`select nome from vagas.migracoes order by nome`;
    expect(registradas.map((r) => r.nome)).toEqual(lista.map((m) => m.nome));
  });

  it("uma migration com erro não é registrada", async () => {
    await expect(aplicarMigracoes(sql, [{ nome: "9999_quebrada.sql", sql: "select * from vagas.nao_existe" }])).rejects.toBeTruthy();
    const r = await sql`select 1 from vagas.migracoes where nome = '9999_quebrada.sql'`;
    expect(r.length).toBe(0);
  });
});
