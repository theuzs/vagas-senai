/**
 * Faz o papel da ponte: publica estados simulados no Supabase a cada 10 s,
 * pela mesma rota e com o mesmo payload que o firmware usa.
 *
 *   TOKEN_CENTRAL=... npm run simular:ponte
 *   npm run simular:ponte -- --parar H     deixa o H de fora (vira SEM DADOS na página)
 *   npm run simular:ponte -- --seco        só mostra o payload, sem enviar
 *
 * Lê NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e TOKEN_CENTRAL do
 * ambiente ou do .env.local.
 */
import { config } from "dotenv";
import { iniciarBolsoes, montarPayload, passo } from "./simulador";

config({ quiet: true });
config({ path: ".env.local", override: false, quiet: true });

const args = process.argv.slice(2);
const seco = args.includes("--seco");
const parados = args.flatMap((a, i) => (a === "--parar" && args[i + 1] ? [args[i + 1].toUpperCase()] : []));

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const chave = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const token = process.env.TOKEN_CENTRAL ?? "";

const bolsoes = iniciarBolsoes();

async function enviar() {
  passo(bolsoes);
  const payload = montarPayload(token || "token-de-exemplo-com-32-caracteres", bolsoes, parados);
  if (seco) {
    console.log(JSON.stringify({ ...payload, p_token: "<token>" }, null, 2));
    return;
  }
  const r = await fetch(`${url}/rest/v1/rpc/publicar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      "Content-Profile": "vagas",
    },
    body: JSON.stringify(payload),
  });
  const texto = await r.text();
  const hora = new Date().toLocaleTimeString("pt-BR");
  if (r.ok) {
    const livres = bolsoes.filter((b) => !parados.includes(b.id)).map((b) => `${b.id}=${b.estados.filter((o) => !o).length}/${b.total}`);
    console.log(`${hora} ok ${livres.join(" ")}${parados.length ? ` (parados: ${parados.join(",")})` : ""}`);
  } else {
    console.error(`${hora} erro ${r.status}: ${texto}`);
  }
}

async function main() {
  if (seco) {
    await enviar();
    return;
  }
  if (!/^https:\/\//.test(url) || !chave || !token) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou TOKEN_CENTRAL. Use --seco para só ver o payload.");
    process.exit(1);
  }
  console.log(`Publicando em ${url} a cada 10 s. Ctrl+C para parar.`);
  await enviar();
  setInterval(() => void enviar().catch((e) => console.error("falha:", e)), 10_000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
