import type { Bolsao } from "./tipos";

/** Os bolsões do problema, sem dado. É o que a tela mostra antes da primeira carga. */
export const BOLSOES_PADRAO: Bolsao[] = [
  { id: "A", nome: "Bloco A", ordem: 1, total_vagas: null, vagas_livres: null, vagas: null, especiais: {}, atualizado_em: null },
  { id: "C", nome: "Bloco C", ordem: 2, total_vagas: null, vagas_livres: null, vagas: null, especiais: {}, atualizado_em: null },
  { id: "H", nome: "Bloco H", ordem: 3, total_vagas: null, vagas_livres: null, vagas: null, especiais: {}, atualizado_em: null },
];
