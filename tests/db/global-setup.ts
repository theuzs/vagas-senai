/**
 * Sobe um Postgres embutido (sem Docker), aplica o shim do Supabase e as migrations
 * de db/migracoes. Usado pelo projeto "db" do Vitest.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";

// Porta variável por execução: um Postgres de teste que ficou preso não bloqueia a próxima rodada.
const PORT = Number(process.env.TEST_PG_PORT ?? 54200 + (process.pid % 90));
// Fora do projeto para o watcher do Next não reagir às escritas do Postgres.
const DIR = join(tmpdir(), "vagas-senai", `pgdata-test-${process.pid}`);
const URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;

let pg: EmbeddedPostgres | undefined;

export async function setup() {
  if (existsSync(DIR)) rmSync(DIR, { recursive: true, force: true });
  pg = new EmbeddedPostgres({
    databaseDir: DIR,
    port: PORT,
    user: "postgres",
    password: "postgres",
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: (e) => {
      const s = String(e);
      if (/FATAL|could not|error/i.test(s)) console.error("[postgres de teste]", s.slice(0, 400));
    },
  });
  await pg.initialise();
  await pg.start();

  const sql = postgres(URL, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(readFileSync(join(process.cwd(), "tests", "db", "shim-supabase.sql"), "utf8"));
    const dir = join(process.cwd(), "db", "migracoes");
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      await sql.unsafe(readFileSync(join(dir, f), "utf8"));
    }
  } finally {
    await sql.end();
  }
  process.env.TEST_DATABASE_URL = URL;
}

export async function teardown() {
  await pg?.stop();
  if (existsSync(DIR)) rmSync(DIR, { recursive: true, force: true });
}
