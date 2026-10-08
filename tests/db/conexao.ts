import { createHash, randomBytes } from "node:crypto";
import postgres, { type Sql } from "postgres";

export function conectar(): Sql {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL não definido (global-setup não rodou?)");
  return postgres(url, { max: 2, onnotice: () => {} });
}

/**
 * Executa `fn` numa transação assumindo o papel do Supabase indicado.
 * - "service": service_role (bypass de RLS)
 * - "anon": visitante da página (a chave pública)
 * - "authenticated": usuário logado (não existe neste projeto, mas as policies cobrem)
 */
export async function como<T>(sql: Sql, quem: "service" | "anon" | "authenticated", fn: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe(`set local role ${quem === "service" ? "service_role" : quem}`);
    return fn(tx as unknown as Sql);
  }) as Promise<T>;
}

/** Cadastra uma central com um token novo e devolve o token em texto. */
export async function criarCentral(sql: Sql, id: string, ativa = true): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token, "utf8").digest();
  await sql`insert into vagas.centrais (id, nome, token_hash, ativa) values (${id}, ${"Central " + id}, ${hash}, ${ativa})
            on conflict (id) do update set token_hash = excluded.token_hash, ativa = excluded.ativa`;
  return token;
}

/** Chama vagas.publicar como anon (é assim que a ponte chama, pelo PostgREST). */
export async function publicar(sql: Sql, token: string | null, bolsoes: unknown) {
  return como(sql, "anon", async (tx) => {
    const [r] = await tx<{ publicar: { atualizados: string[] } }[]>`select vagas.publicar(${token}, ${tx.json(bolsoes as never)}::jsonb)`;
    return r.publicar;
  });
}

export async function lerBolsao(sql: Sql, id: string) {
  const [b] = await sql<
    { id: string; total_vagas: number | null; vagas_livres: number | null; vagas: boolean[] | null; atualizado_em: Date | null }[]
  >`select id, total_vagas, vagas_livres, vagas, atualizado_em from vagas.bolsoes where id = ${id}`;
  return b;
}

export async function limparEstado(sql: Sql) {
  await sql`update vagas.bolsoes set vagas = null, total_vagas = null, vagas_livres = null, atualizado_em = null`;
  await sql`delete from vagas.historico`;
  await sql`delete from vagas.centrais`;
}
