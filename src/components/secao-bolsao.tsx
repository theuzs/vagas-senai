import { especiaisLivres, textoIdade } from "@/lib/vagas/regras";
import type { Bolsao, Situacao } from "@/lib/vagas/tipos";
import { IconeAlerta } from "./cartao-bolsao";
import { GradeVagas } from "./grade-vagas";

const TEXTO_SITUACAO: Record<Situacao, string> = {
  livre: "Tem vaga",
  poucas: "Poucas vagas",
  lotado: "Lotado",
  "sem-dados": "Sem dados",
};

const COR: Record<Situacao, string> = {
  livre: "text-livre",
  poucas: "text-poucas",
  lotado: "text-lotado",
  "sem-dados": "text-sem-dados",
};

export function SecaoBolsao({ bolsao, situacao, agoraServidorMs }: { bolsao: Bolsao; situacao: Situacao; agoraServidorMs: number }) {
  const semDados = situacao === "sem-dados";
  const especiais = semDados ? [] : especiaisLivres(bolsao);

  return (
    <section
      id={`bolsao-${bolsao.id}`}
      data-testid={`secao-${bolsao.id}`}
      aria-labelledby={`titulo-${bolsao.id}`}
      className="scroll-mt-4 rounded-2xl border border-borda bg-superficie p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={`titulo-${bolsao.id}`} className="text-lg font-bold">
          {bolsao.nome}
        </h2>
        <p className={`flex items-center gap-1 text-sm font-semibold ${COR[situacao]}`}>
          {semDados && <IconeAlerta className="h-4 w-4" />}
          {TEXTO_SITUACAO[situacao]}
        </p>
      </div>

      <p className="mt-1 text-sm text-texto-secundario">
        {semDados ? (
          <span>O sensor deste bolsão não mandou dado recente ({textoIdade(bolsao, agoraServidorMs)}). Confira no local.</span>
        ) : (
          <>
            <span className="font-semibold text-texto">
              {bolsao.vagas_livres} de {bolsao.total_vagas} livres
            </span>
            {especiais.map((e) => (
              <span key={e.tipo}>
                {" · "}
                {e.rotulo}: {e.livres} {e.livres === 1 ? "livre" : "livres"}
              </span>
            ))}
            <span>{" · "}atualizado {textoIdade(bolsao, agoraServidorMs)}</span>
          </>
        )}
      </p>

      <div className="mt-3">
        <GradeVagas bolsao={bolsao} semDados={semDados} />
      </div>
    </section>
  );
}
