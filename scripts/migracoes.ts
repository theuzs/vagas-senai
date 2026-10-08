import type { Sql } from "postgres";

export interface Migracao {
  nome: string;
  sql: string;
}

export interface Resultado {
  jaAplicadas: string[];
  aplicadas: string[];
  pendentes: string[];
}

/**
 * Aplica em ordem as migrations que ainda não constam em vagas.migracoes.
 * Com `conferir`, só lista. Separado do CLI para o teste de banco cobrir.
 */
export async function aplicarMigracoes(sql: Sql, migracoes: Migracao[], opcoes: { conferir?: boolean } = {}): Promise<Resultado> {
  await sql.unsafe("create schema if not exists vagas");
  await sql.unsafe("create table if not exists vagas.migracoes (nome text primary key, aplicada_em timestamptz not null default now())");
  const feitas = new Set((await sql<{ nome: string }[]>`select nome from vagas.migracoes`).map((r) => r.nome));

  const r: Resultado = { jaAplicadas: [], aplicadas: [], pendentes: [] };
  for (const m of migracoes) {
    if (feitas.has(m.nome)) {
      r.jaAplicadas.push(m.nome);
      continue;
    }
    if (opcoes.conferir) {
      r.pendentes.push(m.nome);
      continue;
    }
    await sql.begin(async (tx) => {
      await tx.unsafe(m.sql);
      await tx`insert into vagas.migracoes (nome) values (${m.nome})`;
    });
    r.aplicadas.push(m.nome);
  }
  return r;
}
