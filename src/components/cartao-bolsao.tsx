"use client";

import { useEffect, useRef, useState } from "react";
import type { Bolsao, Situacao } from "@/lib/vagas/tipos";

const ESTILO: Record<Situacao, { borda: string; fundo: string; texto: string }> = {
  livre: { borda: "border-livre", fundo: "bg-[var(--livre-fundo)]", texto: "text-livre" },
  poucas: { borda: "border-poucas", fundo: "bg-[var(--poucas-fundo)]", texto: "text-poucas" },
  lotado: { borda: "border-lotado", fundo: "bg-[var(--lotado-fundo)]", texto: "text-lotado" },
  "sem-dados": { borda: "border-sem-dados border-dashed", fundo: "bg-[var(--sem-dados-fundo)] listrado", texto: "text-sem-dados" },
};

export function CartaoBolsao({ bolsao, situacao }: { bolsao: Bolsao; situacao: Situacao }) {
  const e = ESTILO[situacao];
  const livres = situacao === "sem-dados" ? null : bolsao.vagas_livres;

  // Pulsa quando o número muda (quem pediu menos movimento não vê, pelo CSS).
  const anterior = useRef(livres);
  const [pulsando, setPulsando] = useState(false);
  useEffect(() => {
    if (anterior.current !== livres && livres !== null) {
      setPulsando(true);
      const t = setTimeout(() => setPulsando(false), 450);
      anterior.current = livres;
      return () => clearTimeout(t);
    }
    anterior.current = livres;
  }, [livres]);

  const rotulo =
    situacao === "sem-dados"
      ? `${bolsao.nome}: sem dados`
      : situacao === "lotado"
        ? `${bolsao.nome}: lotado`
        : `${bolsao.nome}: ${livres} ${livres === 1 ? "vaga livre" : "vagas livres"}`;

  return (
    <a
      href={`#bolsao-${bolsao.id}`}
      data-testid={`cartao-${bolsao.id}`}
      data-situacao={situacao}
      aria-label={rotulo}
      className={`flex min-h-[7.5rem] min-w-0 flex-1 flex-col items-center justify-between rounded-2xl border-2 px-1 py-3 text-center no-underline ${e.borda} ${e.fundo}`}
    >
      <span className="text-sm font-semibold uppercase tracking-wide text-texto-secundario">Bloco</span>
      <span className="text-3xl font-black leading-none text-texto">{bolsao.id}</span>
      {situacao === "sem-dados" ? (
        <span className={`flex flex-col items-center gap-1 text-xs font-bold leading-tight ${e.texto}`}>
          <IconeAlerta />
          SEM DADOS
        </span>
      ) : situacao === "lotado" ? (
        <span className={`flex flex-col items-center gap-1 text-sm font-black leading-tight ${e.texto}`}>
          <span className="text-2xl leading-none">0</span>
          LOTADO
        </span>
      ) : (
        <span className={`flex flex-col items-center leading-tight ${e.texto}`}>
          <span className={`text-4xl font-black leading-none ${pulsando ? "pulso" : ""}`}>{livres}</span>
          <span className="text-xs font-semibold">{livres === 1 ? "livre" : "livres"}</span>
        </span>
      )}
    </a>
  );
}

export function IconeAlerta({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}
