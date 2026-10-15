import { livresComuns, orientacaoMotorista, type OrientacaoMotorista } from "./regras";
import type { Bolsao, Situacao } from "./tipos";

/** Blocos de destino que o motorista pode escolher (UX-55). */
export const DESTINOS = ["A", "A1", "B", "B1", "C", "D", "E", "F", "G", "H", "Cantina"] as const;
export type Destino = (typeof DESTINOS)[number];

/**
 * Estacionamentos do mais perto ao mais longe de cada destino. Tabela a confirmar com
 * o João: o A fica ao lado da guarita e o H no fundo, junto de E, F, G, H e Cantina.
 */
export const PROXIMIDADE: Record<Destino, string[]> = {
  A: ["A", "C", "H"],
  A1: ["A", "C", "H"],
  B: ["A", "C", "H"],
  B1: ["C", "A", "H"],
  C: ["C", "A", "H"],
  D: ["C", "H", "A"],
  E: ["H", "C", "A"],
  Cantina: ["H", "C", "A"],
  F: ["H", "C", "A"],
  G: ["H", "C", "A"],
  H: ["H", "C", "A"],
};

export const CHAVE_DESTINO = "vagas.destino";

export function nomeDestino(d: Destino): string {
  return d === "Cantina" ? "a Cantina" : `o bloco ${d}`;
}

/** A recomendação por destino: o mais perto com vaga comum livre; nunca um bloco sem dados. */
export function recomendacao(bolsoes: Bolsao[], situacoes: Map<string, Situacao>, destino: Destino | null, agoraServidorMs: number, anteriorId?: string | null): OrientacaoMotorista {
  const geral = orientacaoMotorista(bolsoes, situacoes, agoraServidorMs, anteriorId);
  if (!destino) return geral;
  const ordem = PROXIMIDADE[destino];
  const porId = new Map(bolsoes.map((b) => [b.id, b]));
  const sit = (id: string) => situacoes.get(id) ?? "sem-dados";
  const temVaga = (id: string) => (sit(id) === "livre" || sit(id) === "poucas") && (livresComuns(porId.get(id)!) ?? 0) > 0;
  const candidatos = ordem.filter((id) => porId.has(id));
  const escolhido = candidatos.find(temVaga);
  if (!escolhido) return geral;
  const b = porId.get(escolhido)!;
  const n = livresComuns(b) ?? 0;
  const texto = `Para ${nomeDestino(destino)}, o mais perto com vaga é o ${b.nome}, com ${n} ${n === 1 ? "livre" : "livres"}.`;
  const posicao = candidatos.indexOf(escolhido);
  const segundo = candidatos.slice(posicao + 1).find(temVaga);
  let detalhe: string | null = null;
  if (sit(escolhido) === "poucas" && segundo) {
    const s = porId.get(segundo)!;
    detalhe = `O ${b.nome} tem poucas vagas. Se lotar, o ${s.nome} tem ${livresComuns(s) ?? 0} livres.`;
  } else {
    const maisPerto = candidatos.slice(0, posicao).find((id) => sit(id) === "sem-dados");
    if (maisPerto) detalhe = `O ${porId.get(maisPerto)!.nome}, mais perto, está sem dados. Se passar por ele, confira no local.`;
  }
  return { texto, detalhe, indicado: b, especiais: null };
}
