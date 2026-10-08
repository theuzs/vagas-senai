import type { Bolsao, Situacao } from "./tipos";

/** Dado com mais de 30 s vira SEM DADOS. Único lugar que define isso. */
export const LIMITE_FRESCOR_MS = 30_000;

/** Dado "do futuro" além disso indica relógio errado; na dúvida, não mostrar número. */
export const TOLERANCIA_FUTURO_MS = 5_000;

/** Idade do dado em ms pela hora do servidor, ou null quando nunca recebeu dado. */
export function idadeMs(atualizadoEm: string | null, agoraServidorMs: number): number | null {
  if (!atualizadoEm) return null;
  const t = Date.parse(atualizadoEm);
  if (Number.isNaN(t)) return null;
  return agoraServidorMs - t;
}

/** Até quantas vagas livres conta como "poucas". */
export function limitePoucas(totalVagas: number): number {
  return Math.max(3, Math.ceil(totalVagas * 0.1));
}

/**
 * Situação de um bolsão. Qualquer dúvida sobre o dado vira "sem-dados": é a regra
 * que impede a página de mandar motorista embora com o bolsão vazio.
 */
export function situacao(b: Pick<Bolsao, "atualizado_em" | "vagas" | "total_vagas" | "vagas_livres">, agoraServidorMs: number): Situacao {
  const idade = idadeMs(b.atualizado_em, agoraServidorMs);
  if (idade === null) return "sem-dados";
  if (idade > LIMITE_FRESCOR_MS) return "sem-dados";
  if (idade < -TOLERANCIA_FUTURO_MS) return "sem-dados";
  if (b.vagas === null || b.total_vagas === null || b.vagas_livres === null) return "sem-dados";
  if (b.vagas.length !== b.total_vagas) return "sem-dados";
  if (b.vagas_livres > b.total_vagas) return "sem-dados";
  if (b.vagas_livres === 0) return "lotado";
  if (b.vagas_livres <= limitePoucas(b.total_vagas)) return "poucas";
  return "livre";
}

/**
 * Quanto somar ao relógio do aparelho para chegar ao do servidor.
 * t0 e t1 são os instantes locais antes e depois da chamada; a resposta vale no meio.
 */
export function deslocamentoRelogio(t0: number, t1: number, servidorMs: number): number {
  return servidorMs - (t0 + t1) / 2;
}

/** Hora local no formato HH:MM de America/Sao_Paulo. */
export function horaCurta(ms: number): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(ms));
}

/** Texto da idade do dado para a tela. */
export function textoIdade(b: Pick<Bolsao, "atualizado_em">, agoraServidorMs: number): string {
  const idade = idadeMs(b.atualizado_em, agoraServidorMs);
  if (idade === null) return "ainda não recebeu dados";
  if (idade > LIMITE_FRESCOR_MS || idade < -TOLERANCIA_FUTURO_MS) {
    return `sem dados desde ${horaCurta(Date.parse(b.atualizado_em!))}`;
  }
  if (idade <= 5_000) return "agora";
  return `há ${Math.floor(idade / 1000)} s`;
}

export interface EspecialLivre {
  tipo: string;
  rotulo: string;
  livres: number;
  total: number;
}

const ROTULOS: Record<string, string> = { pcd: "PCD", idoso: "Idoso", gestante: "Gestante", moto: "Moto" };

/** Vagas especiais (PCD, idoso...) livres, só quando o bolsão tem dado. Fora do alcance da grade é ignorado. */
export function especiaisLivres(b: Pick<Bolsao, "vagas" | "especiais">): EspecialLivre[] {
  if (!b.vagas) return [];
  const saida: EspecialLivre[] = [];
  for (const [tipo, posicoes] of Object.entries(b.especiais ?? {})) {
    const validas = posicoes.filter((p) => p >= 0 && p < b.vagas!.length);
    if (validas.length === 0) continue;
    saida.push({
      tipo,
      rotulo: ROTULOS[tipo] ?? tipo,
      livres: validas.filter((p) => !b.vagas![p]).length,
      total: validas.length,
    });
  }
  return saida;
}

/** Tipo especial de uma posição da grade, ou null. */
export function tipoDaVaga(especiais: Bolsao["especiais"], indice: number): string | null {
  for (const [tipo, posicoes] of Object.entries(especiais ?? {})) {
    if (posicoes.includes(indice)) return tipo;
  }
  return null;
}
