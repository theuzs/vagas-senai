import * as z from "zod/mini";
import { configuracaoSupabase } from "./configuracao";
import { COLUNAS, EsquemaBolsao, type Carga } from "./tipos";

/**
 * Primeira leitura com fetch direto, disparada na avaliação do módulo, antes de o
 * supabase-js carregar (UX-17). Só no navegador, fora do modo demo e com configuração.
 * Nenhum dado de vaga é lido no servidor: nada de fetch em componente de servidor.
 */
let promessa: Promise<Carga> | null = null;
let entregue = false;

function iniciar(): Promise<Carga> | null {
  if (typeof window === "undefined") return null;
  const busca = new URLSearchParams(window.location.search);
  if (busca.get("demo") === "1") return null;
  const config = configuracaoSupabase();
  if (!config) return null;
  const cabecalhos = { apikey: config.chaveAnon, Authorization: `Bearer ${config.chaveAnon}` };
  const filtro = busca.get("maquete") === "1" ? "publico=eq.false" : "publico=eq.true";
  const bolsoes = fetch(`${config.url}/rest/v1/bolsoes?select=${COLUNAS}&${filtro}&order=ordem`, {
    headers: { ...cabecalhos, "Accept-Profile": "vagas" },
    cache: "no-store",
  }).then(async (r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return z.array(EsquemaBolsao).parse(await r.json());
  });
  const t0 = Date.now();
  const relogio: Promise<Carga["relogio"]> = fetch(`${config.url}/rest/v1/rpc/agora`, {
    method: "POST",
    headers: { ...cabecalhos, "Content-Profile": "vagas", "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  })
    .then(async (r) => {
      const t1 = Date.now();
      if (!r.ok) return null;
      const servidorMs = Date.parse(await r.json());
      return Number.isNaN(servidorMs) ? null : { servidorMs, t0, t1 };
    })
    .catch(() => null);
  return Promise.all([bolsoes, relogio]).then(([b, r]) => ({ bolsoes: b, relogio: r }));
}

promessa = iniciar();
// Sem ninguém ouvindo ainda, uma falha não pode virar erro não tratado.
promessa?.catch(() => {});

/** Devolve a promessa da primeira leitura uma vez só; depois, null. */
export function pegarCargaInicial(): Promise<Carga> | null {
  if (entregue) return null;
  entregue = true;
  return promessa;
}
