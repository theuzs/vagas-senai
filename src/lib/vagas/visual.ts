import type { Situacao } from "./tipos";

export interface Visual {
  /** Classe de cor do texto do estado. */
  cor: string;
  /** Classe de fundo. */
  fundo: string;
  /** Classe de borda, com cor. */
  borda: string;
  /** Cor do estado em CSS, para `--cor-estado` e para o SVG do mapa. */
  corCss: string;
  fundoCss: string;
  tracejado: boolean;
  listrado: boolean;
  icone: "alerta" | "bloqueio" | null;
  rotulo: string;
  rotuloCurto: string;
}

/** Um mapa de estilo por situação, usado por cartão, seção, coluna da guarita e mapa (UX-29). */
export const VISUAL: Record<Situacao, Visual> = {
  livre: {
    cor: "text-livre",
    fundo: "bg-[var(--livre-fundo)]",
    borda: "border-livre",
    corCss: "var(--livre)",
    fundoCss: "var(--livre-fundo)",
    tracejado: false,
    listrado: false,
    icone: null,
    rotulo: "Tem vaga",
    rotuloCurto: "livres",
  },
  poucas: {
    cor: "text-poucas",
    fundo: "bg-[var(--poucas-fundo)]",
    borda: "border-poucas",
    corCss: "var(--poucas)",
    fundoCss: "var(--poucas-fundo)",
    tracejado: false,
    listrado: false,
    icone: null,
    rotulo: "Poucas vagas",
    rotuloCurto: "poucas",
  },
  lotado: {
    cor: "text-lotado",
    fundo: "bg-[var(--lotado-fundo)]",
    borda: "border-lotado",
    corCss: "var(--lotado)",
    fundoCss: "var(--lotado-fundo)",
    tracejado: false,
    listrado: false,
    icone: "bloqueio",
    rotulo: "Lotado",
    rotuloCurto: "LOTADO",
  },
  "sem-dados": {
    cor: "text-sem-dados",
    fundo: "bg-[var(--sem-dados-fundo)]",
    borda: "border-sem-dados border-dashed",
    corCss: "var(--sem-dados)",
    fundoCss: "var(--sem-dados-fundo)",
    tracejado: true,
    listrado: true,
    icone: "alerta",
    rotulo: "Sem dados",
    rotuloCurto: "SEM DADOS",
  },
};
