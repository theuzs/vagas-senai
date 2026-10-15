"use client";

import { useEffect, useRef, useState } from "react";
import { dadosVisiveis, especiaisLivres, textoEspecial, tipoDaVaga } from "@/lib/vagas/regras";
import type { Bolsao, Situacao } from "@/lib/vagas/tipos";
import { Icone, ICONE_DO_TIPO } from "./icones";

const LETRA: Record<string, string> = { pcd: "P", idoso: "I", gestante: "G", moto: "M" };

/**
 * Uma célula por vaga, na ordem dos sensores. Até 12 vagas, cada uma ganha número e um
 * ladrilho grande (UX-38); com mais, a grade compacta, que funciona até 500.
 * Sem dados, nenhuma célula: um bloco listrado com o motivo (UX-12).
 */
export function GradeVagas({ bolsao, situacao, textoSemDados }: { bolsao: Bolsao; situacao: Situacao; textoSemDados: string }) {
  const dados = dadosVisiveis(bolsao, situacao);
  const mudaram = useCelulasQueMudaram(dados?.vagas ?? null);

  if (!dados) {
    const total = bolsao.total_vagas;
    const altura = total ? Math.min(120, Math.max(48, Math.ceil(total / 12) * 20 + 16)) : 48;
    const texto = textoSemDados.charAt(0).toUpperCase() + textoSemDados.slice(1);
    return (
      <div
        data-testid={`grade-${bolsao.id}`}
        data-sem-dados="sim"
        data-grade-vazia="sim"
        role="img"
        aria-label={`Vagas do ${bolsao.nome}: sem dados`}
        style={{ minHeight: altura }}
        className="listrado flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sem-dados bg-[var(--sem-dados-fundo)] p-2 text-sm font-semibold text-sem-dados"
      >
        <Icone nome="alerta" className="h-5 w-5 shrink-0" />
        <span>{texto}</span>
      </div>
    );
  }

  const { vagas, livres, total } = dados;
  const grande = total <= 12;
  const colunas = total <= 6 ? total : Math.ceil(total / 2);
  const especiais = especiaisLivres(bolsao).map(textoEspecial).join(". ");
  const rotulo = `Vagas do ${bolsao.nome}: ${livres} de ${total} livres.${especiais ? ` ${especiais}.` : ""}`;

  return (
    <div
      data-testid={`grade-${bolsao.id}`}
      data-sem-dados="nao"
      className={`grid rounded-xl bg-superficie-2 p-2 ${grande ? "gap-1.5" : "gap-1"}`}
      style={{ gridTemplateColumns: grande ? `repeat(${colunas}, minmax(0, 56px))` : "repeat(auto-fill, minmax(16px, 1fr))" }}
      role="img"
      aria-label={rotulo}
    >
      {vagas.map((ocupada, i) => {
        const tipo = tipoDaVaga(bolsao.especiais, i);
        const mudou = mudaram.has(i);
        const titulo = `Vaga ${i + 1}${tipo ? ` (${tipo.toUpperCase()})` : ""}: ${ocupada ? "ocupada" : "livre"}`;
        const classesCelula = `relative transition-colors duration-300 ${ocupada ? "bg-[var(--vaga-ocupada)]" : "bg-[var(--vaga-livre)]"} ${tipo ? "outline-2 outline-solid outline-[var(--vaga-especial)] outline-offset-0" : ""} ${mudou ? "vaga-mudou" : ""}`;
        if (grande) {
          return (
            <span key={i} className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-bold tabular-nums text-texto-secundario">{i + 1}</span>
              <span data-vaga={ocupada ? "ocupada" : "livre"} data-tipo={tipo ?? undefined} title={titulo} className={`flex aspect-[3/4] w-full items-center justify-center rounded-md ${classesCelula}`}>
                {ocupada ? (
                  <Icone nome="carro" className="h-[60%] w-[60%] text-fundo" />
                ) : tipo ? (
                  <Icone nome={ICONE_DO_TIPO[tipo] ?? "ok"} className="h-[60%] w-[60%] text-fundo" />
                ) : null}
              </span>
            </span>
          );
        }
        return (
          <span key={i} data-vaga={ocupada ? "ocupada" : "livre"} data-tipo={tipo ?? undefined} title={titulo} className={`flex aspect-square items-center justify-center rounded-[3px] ${classesCelula}`}>
            {ocupada ? (
              <Icone nome="x" className="absolute inset-0 h-full w-full p-[2px] text-fundo" />
            ) : tipo ? (
              <span className="text-[10px] font-black leading-none text-[#0f1419]">{LETRA[tipo] ?? tipo.charAt(0).toUpperCase()}</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

/** Índices das células que trocaram de estado com dado fresco antes e depois (UX-40). */
function useCelulasQueMudaram(vagas: boolean[] | null): Set<number> {
  const anterior = useRef<boolean[] | null>(null);
  const [mudaram, setMudaram] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = vagas;
    if (!vagas || !antes || antes.length !== vagas.length) return;
    const s = new Set<number>();
    vagas.forEach((v, i) => {
      if (antes[i] !== v) s.add(i);
    });
    if (s.size === 0) return;
    setMudaram(s);
    const t = setTimeout(() => setMudaram(new Set()), 1200);
    return () => clearTimeout(t);
  }, [vagas]);
  return mudaram;
}
