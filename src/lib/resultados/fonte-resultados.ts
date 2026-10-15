import type { ConfiguracaoSupabase } from "@/lib/vagas/configuracao";
import type { Foto, ImpactoNoite, ResumoNoite } from "./tipos";

/**
 * Chama as funções de resultados pela API REST do Supabase, só com a chave publishable.
 * Um fetch direto basta: a tela não precisa do Realtime nem do supabase-js.
 */
async function rpc<T>(config: ConfiguracaoSupabase, nome: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${config.url}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      apikey: config.chaveAnon,
      Authorization: `Bearer ${config.chaveAnon}`,
      "Content-Profile": "vagas",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${nome}: HTTP ${r.status}`);
  const dados: unknown = await r.json();
  if (!Array.isArray(dados)) throw new Error(`${nome}: resposta inesperada`);
  return dados as T;
}

export const DIAS_PADRAO = 30;

export function lerResumo(config: ConfiguracaoSupabase, dias = DIAS_PADRAO): Promise<ResumoNoite[]> {
  return rpc<ResumoNoite[]>(config, "resumo_noites", { p_dias: dias });
}

export function lerImpacto(config: ConfiguracaoSupabase, dias = DIAS_PADRAO): Promise<ImpactoNoite[]> {
  return rpc<ImpactoNoite[]>(config, "impacto", { p_dias: dias });
}

export function lerSerie(config: ConfiguracaoSupabase, noite: string): Promise<Foto[]> {
  return rpc<Foto[]>(config, "serie_noite", { p_noite: noite });
}
