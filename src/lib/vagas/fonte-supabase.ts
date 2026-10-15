import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod/mini";
import type { ConfiguracaoSupabase } from "./configuracao";
import { COLUNAS, EsquemaBolsao, type Bolsao, type Carga, type FonteVagas } from "./tipos";

// Um cliente por URL: o React em modo estrito monta o painel duas vezes em desenvolvimento.
const clientes = new Map<string, SupabaseClient<any, "vagas">>(); // eslint-disable-line @typescript-eslint/no-explicit-any

function cliente(config: ConfiguracaoSupabase) {
  let c = clientes.get(config.url);
  if (!c) {
    c = createClient(config.url, config.chaveAnon, {
      db: { schema: "vagas" },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clientes.set(config.url, c);
  }
  return c;
}

/**
 * Lê vagas.bolsoes pela API pública e assina as mudanças pelo Realtime. Só a chave anon.
 * Com `maquete`, lê só os bolsões fora da página pública (UX-59).
 */
export function fonteSupabase(config: ConfiguracaoSupabase, opcoes: { maquete?: boolean } = {}): FonteVagas {
  const supabase = cliente(config);
  const publico = !opcoes.maquete;

  async function medirRelogio(): Promise<Carga["relogio"]> {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc("agora");
    const t1 = Date.now();
    if (error || typeof data !== "string") return null;
    const servidorMs = Date.parse(data);
    if (Number.isNaN(servidorMs)) return null;
    return { servidorMs, t0, t1 };
  }

  async function carregar(): Promise<Carga> {
    const [resposta, relogio] = await Promise.all([supabase.from("bolsoes").select(COLUNAS).eq("publico", publico).order("ordem"), medirRelogio()]);
    if (resposta.error) throw resposta.error;
    return { bolsoes: z.array(EsquemaBolsao).parse(resposta.data), relogio };
  }

  function assinar(aoMudar: (b: Bolsao) => void, aoStatus: (s: "ao-vivo" | "reconectando") => void) {
    const canal = supabase
      .channel(publico ? "vagas-bolsoes" : "vagas-maquete")
      .on("postgres_changes", { event: "UPDATE", schema: "vagas", table: "bolsoes" }, (evento) => {
        const linha = EsquemaBolsao.safeParse(evento.new);
        // Linha de maquete nunca entra na página pública, e vice-versa.
        if (linha.success && linha.data.publico === publico) aoMudar(linha.data);
      })
      .subscribe((status) => {
        aoStatus(status === "SUBSCRIBED" ? "ao-vivo" : "reconectando");
      });
    return () => {
      void supabase.removeChannel(canal);
    };
  }

  return { carregar, assinar, medirRelogio };
}
