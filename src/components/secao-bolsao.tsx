"use client";

import { dadosVisiveis, especiaisLivres, textoEspecial, textoIdade, textoSemDados, totalComuns } from "@/lib/vagas/regras";
import type { Bolsao, CausaSemDados, Situacao } from "@/lib/vagas/tipos";
import { VISUAL } from "@/lib/vagas/visual";
import { GradeVagas } from "./grade-vagas";
import { Icone, ICONE_DO_TIPO } from "./icones";

export function SecaoBolsao({
  bolsao,
  situacao,
  agoraServidorMs,
  causa,
  online,
  destacado = false,
}: {
  bolsao: Bolsao;
  situacao: Situacao;
  agoraServidorMs: number;
  causa: CausaSemDados;
  online: boolean;
  destacado?: boolean;
}) {
  const v = VISUAL[situacao];
  const dados = dadosVisiveis(bolsao, situacao);
  const especiais = dados ? especiaisLivres(bolsao) : [];
  const semDados = textoSemDados(bolsao, agoraServidorMs, { causa, online, aparelho: "celular" });
  const comuns = totalComuns(bolsao);
  const idade = textoIdade(bolsao, agoraServidorMs);

  return (
    <section
      id={`bloco-${bolsao.id}`}
      data-testid={`secao-${bolsao.id}`}
      aria-labelledby={`titulo-${bolsao.id}`}
      tabIndex={-1}
      data-destaque={destacado ? "sim" : undefined}
      className="scroll-mt-4 rounded-2xl border border-borda bg-superficie p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={`titulo-${bolsao.id}`} className="text-lg font-bold">
          {bolsao.nome}
        </h2>
        <p className={`flex items-center gap-1 text-sm font-semibold ${v.cor}`}>
          {v.icone && <Icone nome={v.icone} className="h-4 w-4" />}
          {v.rotulo}
        </p>
      </div>

      {dados ? (
        <div className="mt-1 flex flex-col gap-1.5">
          <p className="text-base font-bold">
            {especiais.length > 0 && comuns !== null
              ? `${dados.livresComuns} ${dados.livresComuns === 1 ? "livre" : "livres"} de ${comuns} vagas comuns`
              : `${dados.livres} ${dados.livres === 1 ? "livre" : "livres"} de ${dados.total}`}
          </p>
          {especiais.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {especiais.map((e) => (
                <span
                  key={e.tipo}
                  data-testid={`especial-${e.tipo}`}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--vaga-especial)] px-2 py-0.5 text-sm text-texto"
                >
                  {ICONE_DO_TIPO[e.tipo] && <Icone nome={ICONE_DO_TIPO[e.tipo]} className="h-[1em] w-[1em]" />}
                  {textoEspecial(e)}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-texto-secundario">Atualizado {idade}</p>
        </div>
      ) : (
        <div className="mt-1 flex flex-col gap-1">
          <p className="text-sm text-texto-secundario">{semDados.longo}</p>
          {bolsao.aviso && (
            <p data-testid={`aviso-manutencao-${bolsao.id}`} className="text-sm font-semibold text-sem-dados">
              Aviso da manutenção: {bolsao.aviso}
            </p>
          )}
        </div>
      )}

      <div className="mt-3">
        <GradeVagas bolsao={bolsao} situacao={situacao} textoSemDados={semDados.curto} />
      </div>
    </section>
  );
}
