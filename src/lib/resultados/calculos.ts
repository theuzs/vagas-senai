import { horaCurta } from "@/lib/vagas/regras";
import type { Foto, ImpactoNoite, ResumoNoite } from "./tipos";

/** As 54 janelas de 5 min de uma noite, das 18:00 às 22:25, como "HH:MM". */
export const JANELAS: readonly string[] = Array.from({ length: 54 }, (_, i) => {
  const min = 18 * 60 + i * 5;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
});
export const JANELAS_POR_NOITE = JANELAS.length;

/** "2026-10-13" → "13/10". */
export function dataCurta(noite: string): string {
  const [, m, d] = noite.split("-");
  return `${d}/${m}`;
}

export function textoNoite(noite: string): string {
  return `Noite de ${dataCurta(noite)}`;
}

/** Hora da foto em São Paulo, "18:05". */
export function horaDaFoto(foto: Pick<Foto, "momento">): string {
  return horaCurta(Date.parse(foto.momento));
}

export interface ResumoGeral {
  noites: number;
  janelas: number;
  lotadoComVaga: number;
  /** Média ponderada pelas janelas que contaram, ou null sem janela. */
  mediaOutros: number | null;
}

export function resumoGeral(impactos: ImpactoNoite[]): ResumoGeral {
  let janelas = 0;
  let lotadoComVaga = 0;
  let somaMedias = 0;
  for (const i of impactos) {
    janelas += i.janelas_avaliadas;
    lotadoComVaga += i.janelas_lotado_com_vaga_em_outro;
    const media = i.media_livres_outros === null ? NaN : Number(i.media_livres_outros);
    if (Number.isFinite(media)) somaMedias += media * i.janelas_lotado_com_vaga_em_outro;
  }
  return { noites: impactos.length, janelas, lotadoComVaga, mediaOutros: lotadoComVaga > 0 ? somaMedias / lotadoComVaga : null };
}

function numero(n: number, casas = 1): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** "Em 12 das 107 janelas das últimas 2 noites, um bloco estava lotado e outro tinha vaga livre. ..." */
export function textoResumo(r: ResumoGeral): string {
  const base = `Em ${r.lotadoComVaga} das ${r.janelas} janelas ${r.noites === 1 ? "da última noite" : `das últimas ${r.noites} noites`}, um bloco estava lotado e outro tinha vaga livre.`;
  if (r.mediaOutros === null) return base;
  return `${base} Nessas janelas, os outros blocos tinham em média ${numero(r.mediaOutros)} ${r.mediaOutros === 1 ? "vaga livre" : "vagas livres"}.`;
}

/** "Bloco A: dado em 52 de 54 janelas (96 %). Lotou em 12 janelas." */
export function textoBloco(r: ResumoNoite): string {
  const pct = Math.round((r.janelas_com_dado / JANELAS_POR_NOITE) * 100);
  const dado = `Bloco ${r.bolsao_id}: dado em ${r.janelas_com_dado} de ${JANELAS_POR_NOITE} janelas (${pct} %).`;
  const lotou = r.janelas_lotado === 0 ? "Não lotou." : `Lotou em ${plural(r.janelas_lotado, "janela", "janelas")}.`;
  return `${dado} ${lotou}`;
}

/** Noites distintas, da mais recente para a mais antiga. */
export function noitesDe(linhas: { noite: string }[]): string[] {
  return [...new Set(linhas.map((l) => l.noite))].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

export interface Lacuna {
  /** Índices das janelas (0 a 53), inclusive. */
  de: number;
  ate: number;
}

/** Trechos da noite sem foto, para o gráfico hachurar. */
export function lacunas(fotos: Pick<Foto, "momento">[]): Lacuna[] {
  const presentes = new Set(fotos.map(horaDaFoto));
  const saida: Lacuna[] = [];
  let aberta: Lacuna | null = null;
  JANELAS.forEach((hora, i) => {
    if (presentes.has(hora)) {
      if (aberta) saida.push(aberta);
      aberta = null;
    } else if (aberta) {
      aberta.ate = i;
    } else {
      aberta = { de: i, ate: i };
    }
  });
  if (aberta) saida.push(aberta);
  return saida;
}

/** Índice da janela de uma foto, ou -1 fora das 54. */
export function indiceDaJanela(foto: Pick<Foto, "momento">): number {
  return JANELAS.indexOf(horaDaFoto(foto));
}

/** CSV com ponto e vírgula, uma linha por foto, hora local de São Paulo. */
export function csvDaNoite(noite: string, fotos: Foto[]): string {
  const linhas = fotos.map((f) => [noite, horaDaFoto(f), f.bolsao_id, f.vagas_livres, f.total_vagas].join(";"));
  return ["noite;momento;bolsao;livres;total", ...linhas].join("\n") + "\n";
}
