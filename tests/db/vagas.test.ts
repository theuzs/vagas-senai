import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { como, conectar, criarCentral, lerBolsao, limparEstado, publicar } from "./conexao";

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

async function codigoDoErro(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}

describe("migration e seed", () => {
  it("cria os três bolsões sem estado", async () => {
    const linhas = await sql<{ id: string; nome: string; ordem: number; vagas_livres: number | null; atualizado_em: Date | null }[]>`
      select id, nome, ordem, vagas_livres, atualizado_em from vagas.bolsoes where publico order by ordem`;
    expect(linhas.map((l) => [l.id, l.nome, l.ordem])).toEqual([
      ["A", "Bloco A", 1],
      ["C", "Bloco C", 2],
      ["H", "Bloco H", 3],
    ]);
    for (const l of linhas) {
      expect(l.vagas_livres).toBeNull();
      expect(l.atualizado_em).toBeNull();
    }
  });

  it("bolsoes está na publicação do Realtime", async () => {
    const r = await sql`select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'vagas' and tablename = 'bolsoes'`;
    expect(r.length).toBe(1);
  });

  it("não cria nada no schema public", async () => {
    const r = await sql`select tablename from pg_tables where schemaname = 'public'`;
    expect(r.length).toBe(0);
  });
});

describe("permissões", () => {
  it("anon lê bolsoes", async () => {
    const r = await como(sql, "anon", (tx) => tx`select id from vagas.bolsoes where publico`);
    expect(r.length).toBe(3);
  });

  it("anon não insere, altera nem apaga bolsoes", async () => {
    expect(await codigoDoErro(como(sql, "anon", (tx) => tx`insert into vagas.bolsoes (id, nome) values ('X', 'Bloco X')`))).toBe("42501");
    expect(await codigoDoErro(como(sql, "anon", (tx) => tx`update vagas.bolsoes set vagas_livres = 99 where id = 'A'`))).toBe("42501");
    expect(await codigoDoErro(como(sql, "anon", (tx) => tx`delete from vagas.bolsoes where id = 'A'`))).toBe("42501");
    expect((await lerBolsao(sql, "A")).vagas_livres).toBeNull();
  });

  it("anon não lê centrais nem historico", async () => {
    expect(await codigoDoErro(como(sql, "anon", (tx) => tx`select * from vagas.centrais`))).toBe("42501");
    expect(await codigoDoErro(como(sql, "anon", (tx) => tx`select * from vagas.historico`))).toBe("42501");
  });

  it("authenticated tem as mesmas portas que anon", async () => {
    const r = await como(sql, "authenticated", (tx) => tx`select id from vagas.bolsoes where publico`);
    expect(r.length).toBe(3);
    expect(await codigoDoErro(como(sql, "authenticated", (tx) => tx`update vagas.bolsoes set vagas_livres = 1`))).toBe("42501");
    expect(await codigoDoErro(como(sql, "authenticated", (tx) => tx`select * from vagas.centrais`))).toBe("42501");
  });

  it("anon chama agora()", async () => {
    const [r] = await como(sql, "anon", (tx) => tx<{ agora: Date }[]>`select vagas.agora()`);
    expect(Math.abs(r.agora.getTime() - Date.now())).toBeLessThan(60_000);
  });
});

describe("publicar: token", () => {
  it("recusa sem token, token curto, token errado e central inativa", async () => {
    await criarCentral(sql, "ativa");
    const inativo = await criarCentral(sql, "parada", false);
    expect(await codigoDoErro(publicar(sql, null, { A: "01" }))).toBe("28000");
    expect(await codigoDoErro(publicar(sql, "curto", { A: "01" }))).toBe("28000");
    expect(await codigoDoErro(publicar(sql, "x".repeat(43), { A: "01" }))).toBe("28000");
    expect(await codigoDoErro(publicar(sql, inativo, { A: "01" }))).toBe("28000");
    expect((await lerBolsao(sql, "A")).atualizado_em).toBeNull();
  });

  it("registra o último envio da central", async () => {
    const token = await criarCentral(sql, "c1");
    await publicar(sql, token, {});
    const [c] = await sql<{ ultimo_envio: Date | null }[]>`select ultimo_envio from vagas.centrais where id = 'c1'`;
    expect(c.ultimo_envio).not.toBeNull();
  });
});

describe("publicar: dados", () => {
  let token: string;
  beforeEach(async () => {
    token = await criarCentral(sql, "c1");
  });

  it("grava vagas, total, livres e atualizado_em, e não toca no bolsão ausente", async () => {
    const r = await publicar(sql, token, { A: "0110100", H: "1111" });
    expect(r.atualizados.sort()).toEqual(["A", "H"]);

    const a = await lerBolsao(sql, "A");
    expect(a.total_vagas).toBe(7);
    expect(a.vagas_livres).toBe(4);
    expect(a.vagas).toEqual([false, true, true, false, true, false, false]);
    expect(a.atualizado_em).not.toBeNull();

    const h = await lerBolsao(sql, "H");
    expect(h.vagas_livres).toBe(0);
    expect(h.total_vagas).toBe(4);

    const c = await lerBolsao(sql, "C");
    expect(c.atualizado_em).toBeNull();
    expect(c.vagas).toBeNull();
  });

  it("aceita 1 e 500 vagas", async () => {
    await publicar(sql, token, { A: "0", C: "1".repeat(499) + "0" });
    expect((await lerBolsao(sql, "A")).total_vagas).toBe(1);
    const c = await lerBolsao(sql, "C");
    expect(c.total_vagas).toBe(500);
    expect(c.vagas_livres).toBe(1);
  });

  it("recusa bolsão desconhecido, caractere inválido, texto vazio, mais de 500 e valor que não é texto, sem gravar nada", async () => {
    expect(await codigoDoErro(publicar(sql, token, { A: "01", X: "01" }))).toBe("22023");
    expect(await codigoDoErro(publicar(sql, token, { A: "012" }))).toBe("22023");
    expect(await codigoDoErro(publicar(sql, token, { A: "" }))).toBe("22023");
    expect(await codigoDoErro(publicar(sql, token, { A: "0".repeat(501) }))).toBe("22023");
    expect(await codigoDoErro(publicar(sql, token, { A: 7 }))).toBe("22023");
    expect(await codigoDoErro(publicar(sql, token, { A: ["0", "1"] }))).toBe("22023");
    expect(await codigoDoErro(publicar(sql, token, ["A"]))).toBe("22023");
    expect((await lerBolsao(sql, "A")).atualizado_em).toBeNull();
    const [h] = await sql<{ n: number }[]>`select count(*)::int as n from vagas.historico`;
    expect(h.n).toBe(0);
  });

  it("objeto vazio é aceito e não altera bolsão", async () => {
    const r = await publicar(sql, token, {});
    expect(r.atualizados).toEqual([]);
    expect((await lerBolsao(sql, "A")).atualizado_em).toBeNull();
  });

  it("duas chamadas na mesma janela de 5 min geram uma linha no histórico", async () => {
    await publicar(sql, token, { A: "0101" });
    await publicar(sql, token, { A: "0000" });
    const linhas = await sql<{ bolsao_id: string; vagas_livres: number; total_vagas: number }[]>`select bolsao_id, vagas_livres, total_vagas from vagas.historico`;
    expect(linhas).toEqual([{ bolsao_id: "A", vagas_livres: 2, total_vagas: 4 }]);
  });

  it("o momento do histórico é múltiplo de 5 minutos", async () => {
    await publicar(sql, token, { C: "01" });
    const [l] = await sql<{ momento: Date }[]>`select momento from vagas.historico`;
    expect(l.momento.getTime() % (5 * 60_000)).toBe(0);
  });
});
