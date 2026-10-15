"use client";

import { useEffect, useRef, useState } from "react";
import { dadosVisiveis } from "@/lib/vagas/regras";
import type { Bolsao, Situacao } from "@/lib/vagas/tipos";
import { VISUAL } from "@/lib/vagas/visual";
import { Icone } from "./icones";

export type Direcao = "subiu" | "desceu" | null;

/**
 * Cartão do celular: o mesmo esqueleto nos quatro estados (UX-10), número grande só
 * com dado fresco e contando só as vagas comuns (decisão D2).
 */
export function CartaoBolsao({ bolsao, situacao, carregou = true, aoTocar }: { bolsao: Bolsao; situacao: Situacao; carregou?: boolean; aoTocar?: (id: string) => void }) {
  const v = VISUAL[situacao];
  const dados = dadosVisiveis(bolsao, situacao);
  const livres = dados ? dados.livresComuns : null;
  const especiais = dados ? dados.especiaisLivres : 0;
  const direcao = usePulso(livres);
  const trocou = useMudou(situacao, carregou);
  const semDados = dados === null;
  const lotado = situacao === "lotado";
  const tresDigitos = livres !== null && livres >= 100;

  const nomeVisivel = semDados
    ? `${bolsao.nome} sem dados`
    : lotado
      ? `${bolsao.nome} 0 lotado`
      : `${bolsao.nome} ${livres} ${livres === 1 ? "livre" : "livres"}${situacao === "poucas" ? ", poucas vagas" : ""}`;
  const rotulo = especiais > 0 && !semDados ? `${nomeVisivel}, mais ${especiais} ${especiais === 1 ? "especial livre" : "especiais livres"}` : nomeVisivel;

  return (
    <a
      href={`#bloco-${bolsao.id}`}
      onClick={(e) => {
        if (!aoTocar) return;
        e.preventDefault();
        aoTocar(bolsao.id);
      }}
      data-testid={`cartao-${bolsao.id}`}
      data-situacao={situacao}
      aria-label={rotulo}
      style={{ "--cor-estado": v.corCss } as React.CSSProperties}
      className={`flex min-h-[7.5rem] min-w-0 flex-1 rounded-2xl border-2 no-underline transition-colors duration-300 ${v.borda} ${v.fundo} ${v.listrado ? "listrado" : ""} ${trocou ? "troca-situacao" : ""} grid grid-cols-[auto_auto_1fr] items-center gap-x-2 px-3 py-2 text-left @min-[14rem]:flex @min-[14rem]:flex-col @min-[14rem]:items-center @min-[14rem]:justify-between @min-[14rem]:px-1 @min-[14rem]:py-3 @min-[14rem]:text-center sm:min-h-[10rem]`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-texto-secundario">Bloco</span>
      <span className="text-[22px] font-black leading-none text-texto sm:text-3xl">{bolsao.id}</span>
      <span className="flex h-12 flex-col items-end justify-center justify-self-end @min-[14rem]:items-center @min-[14rem]:justify-self-auto">
        {semDados ? (
          <Icone nome="alerta" className={`h-10 w-10 ${v.cor}`} />
        ) : (
          <span
            key={livres}
            data-anim={direcao ?? undefined}
            className={`font-black leading-none tabular-nums ${v.cor} ${tresDigitos ? "text-[34px] sm:text-5xl" : "text-[44px] sm:text-6xl"} ${direcao ? "pulso" : ""}`}
          >
            {livres}
          </span>
        )}
      </span>
      <span className={`col-span-3 text-sm font-black uppercase leading-tight ${v.cor}`}>
        {semDados ? "SEM DADOS" : lotado ? "LOTADO" : livres === 1 ? "livre" : "livres"}
      </span>
      {situacao === "poucas" && <span className={`col-span-3 text-sm font-black uppercase ${v.cor}`}>Poucas</span>}
      {!semDados && especiais > 0 && (
        <span data-testid="cartao-especiais" className="col-span-3 text-xs font-semibold text-[var(--vaga-especial)]">
          +{especiais} {especiais === 1 ? "especial" : "especiais"}
        </span>
      )}
    </a>
  );
}

/** Direção da última mudança do número, por ~450 ms. Sem dado (null) não anima. */
export function usePulso(valor: number | null): Direcao {
  const anterior = useRef(valor);
  const [direcao, setDirecao] = useState<Direcao>(null);
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = valor;
    if (valor === null || antes === valor) return;
    if (antes === null) return;
    setDirecao(valor > antes ? "subiu" : "desceu");
    const t = setTimeout(() => setDirecao(null), 450);
    return () => clearTimeout(t);
  }, [valor]);
  return direcao;
}

/** true por 700 ms quando a situação muda com a tela já carregada (UX-40). */
export function useMudou(situacao: Situacao, carregou: boolean): boolean {
  const anterior = useRef<Situacao | null>(null);
  const [trocou, setTrocou] = useState(false);
  useEffect(() => {
    const antes = anterior.current;
    if (carregou) anterior.current = situacao;
    if (!carregou || antes === null || antes === situacao) return;
    setTrocou(true);
    const t = setTimeout(() => setTrocou(false), 700);
    return () => clearTimeout(t);
  }, [situacao, carregou]);
  return trocou;
}

export { IconeAlerta } from "./icones";
