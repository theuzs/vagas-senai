/**
 * Aplica as migrations de db/migracoes num Postgres pela URL de conexão.
 *
 *   npm run db:aplicar                  usa o DATABASE_URL do ambiente ou do .env.local
 *   npm run db:aplicar -- --conferir    só lista o que falta
 *
 * Cada arquivo roda numa transação e é registrado em vagas.migracoes. Nada fora do
 * schema vagas é tocado, e a tabela supabase_migrations fica em paz.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";
import { aplicarMigracoes } from "./migracoes";

config({ path: ".env.local", quiet: true });

const url = process.argv.find((a) => a.startsWith("postgres://") || a.startsWith("postgresql://")) ?? process.env.DATABASE_URL;
const conferir = process.argv.includes("--conferir");

if (!url) {
  console.error("Faltou a URL do banco. Use DATABASE_URL=... npm run db:aplicar");
  process.exit(1);
}

async function main() {
  const dir = join("db", "migracoes");
  const arquivos = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((nome) => ({ nome, sql: readFileSync(join(dir, nome), "utf8") }));
  const sql = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const r = await aplicarMigracoes(sql, arquivos, { conferir });
    for (const n of r.jaAplicadas) console.log("ok      ", n);
    for (const n of r.aplicadas) console.log("aplicada", n);
    for (const n of r.pendentes) console.log("pendente", n);
    if (conferir) console.log(r.pendentes.length ? `${r.pendentes.length} pendente(s).` : "Nada pendente.");
    else console.log(r.aplicadas.length ? `${r.aplicadas.length} migration(s) aplicada(s).` : "Nada a aplicar.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
