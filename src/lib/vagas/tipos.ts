import * as z from "zod/mini";

// zod/mini no lugar do zod completo: o Turbopack descarta as mensagens de erro de
// todos os idiomas e o chunk que precede o primeiro número fica bem menor (UX-16).

/** Colunas lidas de vagas.bolsoes, na ordem do select. */
export const COLUNAS = "id,nome,ordem,total_vagas,vagas_livres,vagas,especiais,atualizado_em,aviso,publico";

/** Linha de vagas.bolsoes como chega do Supabase (REST ou Realtime). */
export const EsquemaBolsao = z.object({
  id: z.string().check(z.regex(/^[A-Z0-9]{1,8}$/)),
  nome: z.string().check(z.minLength(1)),
  ordem: z.number().check(z.int()),
  total_vagas: z.nullable(z.number().check(z.int(), z.minimum(1), z.maximum(500))),
  vagas_livres: z.nullable(z.number().check(z.int(), z.minimum(0))),
  vagas: z.nullable(z.array(z.boolean())),
  especiais: z._default(z.record(z.string(), z.array(z.number().check(z.int(), z.minimum(0)))), {}),
  atualizado_em: z.nullable(z.string()),
  /** Aviso da manutenção, só mostrado junto do SEM DADOS (UX-61). */
  aviso: z._default(z.nullable(z.string().check(z.maxLength(80))), null),
  /** Bolsão de maquete fica fora da página pública (UX-59). */
  publico: z._default(z.boolean(), true),
});

export type Bolsao = z.infer<typeof EsquemaBolsao>;

export type Situacao = "sem-dados" | "lotado" | "poucas" | "livre";

export type StatusConexao = "conectando" | "ao-vivo" | "reconectando" | "sem-configuracao";

/** Por que a tela está em SEM DADOS. O visual de alerta é o mesmo; só o texto muda. */
export type CausaSemDados = "carregando" | "sem-conexao" | "configuracao" | "sensor";

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
