"use client";

import { useEffect, useRef, useState } from "react";
import type { Bolsao, CausaSemDados, Situacao } from "@/lib/vagas/tipos";
import { dadosVisiveis } from "@/lib/vagas/regras";

/**
 * Região de status para leitor de tela (UX-41): fala só quando a situação de um bloco
 * muda ou quando a conexão cai e volta, nunca a cada tique do relógio.
 */
export function useAnuncios(bolsoes: Bolsao[], situacoes: Map<string, Situacao>, causa: CausaSemDados, carregou: boolean): string {
  const anteriores = useRef<Map<string, Situacao> | null>(null);
  const causaAnterior = useRef<CausaSemDados | null>(null);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    if (!carregou) return;
    const frases: string[] = [];
    if (anteriores.current === null) {
      anteriores.current = new Map(situacoes);
      causaAnterior.current = causa;
      return;
    }
    for (const b of bolsoes) {
      const s = situacoes.get(b.id) ?? "sem-dados";
      const antes = anteriores.current.get(b.id);
      if (antes === s) continue;
      const d = dadosVisiveis(b, s);
      if (s === "sem-dados") frases.push(`${b.nome} sem dados. Confira no local.`);
      else if (s === "lotado") frases.push(`${b.nome} lotado.`);
      else if (s === "poucas") frases.push(`${b.nome} com poucas vagas: ${d?.livresComuns ?? 0} livres.`);
      else frases.push(`${b.nome} tem vaga: ${d?.livresComuns ?? 0} livres.`);
    }
    anteriores.current = new Map(situacoes);
    if (causaAnterior.current !== causa) {
      if (causa === "sem-conexao") frases.push("Conexão perdida. A página tenta de novo a cada 10 s.");
      else if (causaAnterior.current === "sem-conexao") frases.push("Conexão de volta.");
      causaAnterior.current = causa;
    }
    // A região de status só muda numa transição, por isso o texto nasce aqui e não no render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (frases.length > 0) setTexto(frases.join(" "));
  }, [bolsoes, situacoes, causa, carregou]);

  return texto;
}

export function Anunciador({ texto }: { texto: string }) {
  return (
    <p role="status" className="sr-only" data-testid="anunciador">
      {texto}
    </p>
  );
}
