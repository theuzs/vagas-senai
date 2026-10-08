import { z } from "zod";

/** Linha de vagas.bolsoes como chega do Supabase (REST ou Realtime). */
export const EsquemaBolsao = z.object({
  id: z.string().regex(/^[A-Z0-9]{1,8}$/),
  nome: z.string().min(1),
  ordem: z.number().int(),
  total_vagas: z.number().int().min(1).max(500).nullable(),
  vagas_livres: z.number().int().min(0).nullable(),
  vagas: z.array(z.boolean()).nullable(),
  especiais: z.record(z.string(), z.array(z.number().int().min(0))).default({}),
  atualizado_em: z.string().nullable(),
});

export type Bolsao = z.infer<typeof EsquemaBolsao>;

export type Situacao = "sem-dados" | "lotado" | "poucas" | "livre";

export type StatusConexao = "conectando" | "ao-vivo" | "reconectando" | "sem-configuracao";

export interface Carga {
  bolsoes: Bolsao[];
  /** Hora do servidor (ms) e os instantes locais em que a medição começou e terminou. */
  relogio: { servidorMs: number; t0: number; t1: number } | null;
}

/** De onde a página lê os dados. Supabase em produção; simulação com ?demo=1. */
export interface FonteVagas {
  carregar(): Promise<Carga>;
  assinar(aoMudar: (bolsao: Bolsao) => void, aoStatus: (status: StatusConexao) => void): () => void;
  /** Mede a hora do servidor de novo (a cada 5 min e ao voltar para a aba). */
  medirRelogio(): Promise<Carga["relogio"]>;
}
