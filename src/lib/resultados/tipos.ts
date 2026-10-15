/** Linhas que as funções vagas.resumo_noites, vagas.impacto e vagas.serie_noite devolvem. */

export interface ResumoNoite {
  /** AAAA-MM-DD em São Paulo. */
  noite: string;
  bolsao_id: string;
  janelas_com_dado: number;
  janelas_lotado: number;
  min_livres: number;
  total_vagas: number;
}

export interface ImpactoNoite {
  noite: string;
  janelas_avaliadas: number;
  janelas_lotado_com_vaga_em_outro: number;
  /** Nulo quando nenhuma janela contou. O PostgREST manda numeric como número. */
  media_livres_outros: number | string | null;
}

export interface Foto {
  bolsao_id: string;
  /** ISO 8601, como o PostgREST manda. */
  momento: string;
  vagas_livres: number;
  total_vagas: number;
}
