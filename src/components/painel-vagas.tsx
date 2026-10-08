"use client";

import { useVagas, type OpcoesVagas } from "@/lib/vagas/use-vagas";
import { Avisos, Conexao } from "./avisos";
import { CartaoBolsao } from "./cartao-bolsao";
import { MapaCampus } from "./mapa-campus";
import { SecaoBolsao } from "./secao-bolsao";

/** Página do celular: cartões lado a lado, mapa e uma seção por bolsão. */
export function PainelVagas(props: OpcoesVagas) {
  const { modo, bolsoes, situacoes, status, erroCarga, agoraServidorMs } = useVagas(props);

  return (
    <div className="flex flex-col gap-4">
      <Avisos modo={modo} erroCarga={erroCarga} />
      <Conexao status={status} modo={modo} />

      <div className="flex gap-2" role="list" aria-label="Resumo dos bolsões" aria-live="polite">
        {bolsoes.map((b) => (
          <div key={b.id} role="listitem" className="flex min-w-0 flex-1">
            <CartaoBolsao bolsao={b} situacao={situacoes.get(b.id) ?? "sem-dados"} />
          </div>
        ))}
      </div>

      <MapaCampus bolsoes={bolsoes} situacoes={situacoes} />

      <div className="flex flex-col gap-3">
        {bolsoes.map((b) => (
          <SecaoBolsao key={b.id} bolsao={b} situacao={situacoes.get(b.id) ?? "sem-dados"} agoraServidorMs={agoraServidorMs} />
        ))}
      </div>
    </div>
  );
}
