"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { CHAVE_DESTINO, DESTINOS, recomendacao, type Destino } from "@/lib/vagas/destinos";
import type { Bolsao, Situacao } from "@/lib/vagas/tipos";
import { Icone } from "./icones";

const semAssinatura = () => () => {};
const lerDestino = (): Destino | null => {
  try {
    const v = localStorage.getItem(CHAVE_DESTINO);
    return v && (DESTINOS as readonly string[]).includes(v) ? (v as Destino) : null;
  } catch {
    return null;
  }
};
const nuloNoServidor = () => null;

/** A frase de resumo do celular e a escolha do bloco de destino (UX-13, UX-55). */
export function ResumoVagas({ bolsoes, situacoes, agoraServidorMs }: { bolsoes: Bolsao[]; situacoes: Map<string, Situacao>; agoraServidorMs: number }) {
  const guardado = useSyncExternalStore(semAssinatura, lerDestino, nuloNoServidor);
  // undefined = o motorista ainda não mexeu nesta visita: vale o que está guardado.
  const [escolha, setEscolha] = useState<Destino | null | undefined>(undefined);
  const destino = escolha === undefined ? guardado : escolha;
  const [aberto, setAberto] = useState(false);
  // Memória do último bloco indicado, para a frase não trocar a cada atualização (UX-33).
  // A memória é lida e gravada no render de propósito: o resultado deste render depende do anterior.
  const anterior = useRef<string | null>(null);
  // eslint-disable-next-line react-hooks/refs
  const r = recomendacao(bolsoes, situacoes, destino, agoraServidorMs, anterior.current);
  // eslint-disable-next-line react-hooks/refs
  anterior.current = r.indicado?.id ?? null;

  function escolher(d: Destino | null) {
    setEscolha(d);
    setAberto(false);
    try {
      if (d) localStorage.setItem(CHAVE_DESTINO, d);
      else localStorage.removeItem(CHAVE_DESTINO);
    } catch {
      // sem localStorage: a escolha vale só nesta visita
    }
  }

  return (
    <div data-testid="resumo" className="flex flex-col gap-2">
      <p className="text-base font-bold">{r.texto}</p>
      {r.detalhe && (
        <p className="flex items-center gap-2 text-sm font-semibold text-sem-dados">
          <Icone nome="alerta" className="h-4 w-4 shrink-0" />
          {r.detalhe}
        </p>
      )}
      {r.especiais && <p className="text-sm font-semibold text-[var(--vaga-especial)]">{r.especiais}</p>}
      <div>
        <button
          type="button"
          aria-expanded={aberto}
          onClick={() => setAberto((a) => !a)}
          className="min-h-11 rounded-lg border border-borda bg-superficie px-3 text-sm font-semibold"
        >
          {destino ? `Trocar meu bloco (${destino})` : "Escolher meu bloco"}
        </button>
        {aberto && (
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Bloco de destino">
            {DESTINOS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={destino === d}
                onClick={() => escolher(d)}
                className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${destino === d ? "border-destaque bg-[color-mix(in_srgb,var(--destaque)_25%,transparent)]" : "border-borda bg-superficie"}`}
              >
                {d === "Cantina" ? "Cantina" : `Bloco ${d}`}
              </button>
            ))}
            <button type="button" aria-pressed={destino === null} onClick={() => escolher(null)} className="min-h-11 rounded-lg border border-borda bg-superficie px-3 text-sm font-semibold">
              Não escolher bloco
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
