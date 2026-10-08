import { createHash, randomBytes } from "node:crypto";

export interface TokenGerado {
  token: string;
  hashHex: string;
  sql: string;
}

/** Hash que o banco compara: sha256 do token em UTF-8 (igual a vagas.publicar). */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Gera um token novo para uma central e o SQL que cadastra só o hash.
 * O token em texto vai para o config.h do firmware e para mais lugar nenhum.
 */
export function gerarToken(id: string, nome: string): TokenGerado {
  if (!/^[a-z0-9-]{1,40}$/.test(id)) throw new Error("id da central: só letras minúsculas, números e hífen");
  const token = randomBytes(32).toString("base64url");
  const hashHex = hashDoToken(token);
  const sql = [
    `insert into vagas.centrais (id, nome, token_hash, ativa)`,
    `values ('${id}', '${nome.replace(/'/g, "''")}', decode('${hashHex}', 'hex'), true)`,
    `on conflict (id) do update set nome = excluded.nome, token_hash = excluded.token_hash, ativa = true;`,
  ].join("\n");
  return { token, hashHex, sql };
}
