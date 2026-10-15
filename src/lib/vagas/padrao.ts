import type { Bolsao } from "./tipos";

const vazio = { total_vagas: null, vagas_livres: null, vagas: null, especiais: {}, atualizado_em: null, aviso: null };

/** Os bolsões do problema, sem dado. É o que a tela mostra antes da primeira carga. */
export const BOLSOES_PADRAO: Bolsao[] = [
  { id: "A", nome: "Bloco A", ordem: 1, publico: true, ...vazio },
  { id: "C", nome: "Bloco C", ordem: 2, publico: true, ...vazio },
  { id: "H", nome: "Bloco H", ordem: 3, publico: true, ...vazio },
];

/** O bolsão da maquete (UX-59), antes da primeira carga com ?maquete=1. */
export const MAQUETE_PADRAO: Bolsao[] = [{ id: "M", nome: "Bloco M (maquete)", ordem: 9, publico: false, ...vazio }];
