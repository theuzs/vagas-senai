"use client";

import { useEffect, useState } from "react";
import { useTituloDemo } from "@/lib/vagas/use-titulo-demo";
import { useVagas, type OpcoesVagas } from "@/lib/vagas/use-vagas";
import { Anunciador, useAnuncios } from "./anunciador";
import { Avisos, Conexao, FaixaDemo } from "./avisos";
import { CartaoBolsao } from "./cartao-bolsao";
import { Legenda } from "./legenda";
import { MapaCampus } from "./mapa-campus";
import { ResumoVagas } from "./resumo-vagas";
import { SecaoBolsao } from "./secao-bolsao";

/** Página do celular: cabeçalho de uma linha, resumo, cartões, seções e o mapa no fim. */
export function PainelVagas(props: OpcoesVagas) {
  const {
    modo,
    bolsoes,
    situacoes,
    status,
    agoraServidorMs,
    causa,
    carregou,
    leituraOkEm,
    online,
    ultimoDadoMs,
    tentarAgora,
  } = useVagas(props);
  const anuncio = useAnuncios(bolsoes, situacoes, causa, carregou);
  const algumComDado = [...situacoes.values()].some((s) => s !== "sem-dados");
  const [destacado, setDestacado] = useState<string | null>(null);
  useTituloDemo(modo, "Vagas SENAI Blumenau");

  useEffect(() => {
    if (!destacado) return;
    const t = setTimeout(() => setDestacado(null), 1500);
    return () => clearTimeout(t);
  }, [destacado]);

  function irParaSecao(id: string) {
    const alvo = document.getElementById(`bloco-${id}`);
    if (!alvo) return;
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    alvo.scrollIntoView({
      behavior: reduz ? "auto" : "smooth",
      block: "start",
    });
    alvo.focus({ preventScroll: true });
    setDestacado(id);
  }

  return (
    <div data-conexao={causa} className="flex flex-col gap-4">
      {modo === "demo" && <FaixaDemo agoraMs={agoraServidorMs} />}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4 lg:sticky lg:top-5">
          <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h1 className="text-xl font-black">Vagas SENAI Blumenau</h1>
            <Conexao
              modo={modo}
              causa={causa}
              situacoes={situacoes}
              status={status}
              ultimoDadoMs={ultimoDadoMs}
            />
          </header>
          <Anunciador texto={anuncio} />
          <Avisos
            modo={modo}
            causa={causa}
            online={online}
            leituraOkEm={leituraOkEm}
            tentarAgora={tentarAgora}
            semFaixaDemo
          />
          {causa === "sensor" && modo !== "sem-configuracao" && (
            <ResumoVagas
              bolsoes={bolsoes}
              situacoes={situacoes}
              agoraServidorMs={agoraServidorMs}
            />
          )}

          <div className="@container">
            <div
              className="flex flex-col gap-2 @min-[14rem]:flex-row"
              role="list"
              aria-label="Resumo dos estacionamentos"
            >
              {bolsoes.map((b) => (
                <div key={b.id} role="listitem" className="flex min-w-0 flex-1">
                  <CartaoBolsao
                    bolsao={b}
                    situacao={situacoes.get(b.id) ?? "sem-dados"}
                    carregou={carregou}
                    aoTocar={irParaSecao}
                  />
                </div>
              ))}
            </div>
          </div>
          {algumComDado && <Legenda bolsoes={bolsoes} />}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {bolsoes.map((b) => (
              <SecaoBolsao
                key={b.id}
                bolsao={b}
                situacao={situacoes.get(b.id) ?? "sem-dados"}
                agoraServidorMs={agoraServidorMs}
                causa={causa}
                online={online}
                destacado={destacado === b.id}
              />
            ))}
          </div>

          <h2 className="text-lg font-bold">Como chegar</h2>
          <MapaCampus bolsoes={bolsoes} situacoes={situacoes} />
        </div>
      </div>
    </div>
  );
}
