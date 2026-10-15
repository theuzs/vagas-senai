"use client";

import { useEffect, useState } from "react";
import { csvDaNoite, dataCurta, noitesDe, resumoGeral, textoBloco, textoNoite, textoResumo } from "@/lib/resultados/calculos";
import { DIAS_PADRAO, lerImpacto, lerResumo, lerSerie } from "@/lib/resultados/fonte-resultados";
import type { Foto, ImpactoNoite, ResumoNoite } from "@/lib/resultados/tipos";
import type { ConfiguracaoSupabase } from "@/lib/vagas/configuracao";
import { GraficoNoite } from "./grafico-noite";

type Carga = { estado: "carregando" } | { estado: "erro" } | { estado: "pronto"; resumo: ResumoNoite[]; impacto: ImpactoNoite[] };
/** Série de uma noite. Enquanto a noite escolhida não bate com `noite` daqui, a tela está carregando. */
type Serie = { noite: string; estado: "erro" } | { noite: string; estado: "pronto"; fotos: Foto[] };

/**
 * Resultados das noites: só dados históricos, sempre presos à data. A tela não usa
 * `useVagas` e nunca mostra quantas vagas há agora.
 */
export function TelaResultados({ configuracao }: { configuracao: ConfiguracaoSupabase | null }) {
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [noite, setNoite] = useState<string | null>(null);
  const [serieLida, setSerieLida] = useState<Serie | null>(null);

  useEffect(() => {
    if (!configuracao) return;
    let ativo = true;
    Promise.all([lerResumo(configuracao, DIAS_PADRAO), lerImpacto(configuracao, DIAS_PADRAO)])
      .then(([resumo, impacto]) => {
        if (!ativo) return;
        setCarga({ estado: "pronto", resumo, impacto });
        setNoite((atual) => atual ?? noitesDe(resumo)[0] ?? null);
      })
      .catch(() => {
        if (ativo) setCarga({ estado: "erro" });
      });
    return () => {
      ativo = false;
    };
  }, [configuracao]);

  useEffect(() => {
    if (!configuracao || !noite) return;
    let ativo = true;
    lerSerie(configuracao, noite)
      .then((fotos) => {
        if (ativo) setSerieLida({ noite, estado: "pronto", fotos });
      })
      .catch(() => {
        if (ativo) setSerieLida({ noite, estado: "erro" });
      });
    return () => {
      ativo = false;
    };
  }, [configuracao, noite]);

  if (!configuracao) {
    return (
      <p role="alert" data-testid="aviso-configuracao" className="rounded-lg border border-sem-dados bg-[var(--sem-dados-fundo)] px-3 py-2 text-sem-dados">
        A página está fora do ar por um erro de configuração.
      </p>
    );
  }
  if (carga.estado === "carregando") {
    return (
      <p data-testid="resultados-carregando" className="text-texto-secundario">
        A página está carregando os resultados.
      </p>
    );
  }
  if (carga.estado === "erro") {
    return (
      <p role="alert" data-testid="resultados-erro" className="rounded-lg border border-sem-dados bg-[var(--sem-dados-fundo)] px-3 py-2 text-sem-dados">
        A página não conseguiu ler os resultados. Recarregue para tentar de novo.
      </p>
    );
  }

  const noites = noitesDe(carga.resumo);
  if (noites.length === 0 || !noite) {
    return (
      <p data-testid="resultados-vazio" className="text-texto-secundario">
        Ainda não há noites com dados. O primeiro resultado aparece depois da primeira noite com os sensores ligados.
      </p>
    );
  }

  const serie: Serie | null = serieLida && serieLida.noite === noite ? serieLida : null;
  const geral = resumoGeral(carga.impacto);
  const daNoite = carga.resumo.filter((r) => r.noite === noite);
  const blocos = [...new Set(carga.resumo.map((r) => r.bolsao_id))].sort();

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="titulo-resumo" className="flex flex-col gap-2 rounded-2xl border border-borda bg-superficie p-4">
        <h2 id="titulo-resumo" className="text-lg font-bold">
          {geral.noites === 1 ? "Última noite" : `Últimas ${geral.noites} noites`}
        </h2>
        <p data-testid="resumo-geral" className="text-base">
          {textoResumo(geral)}
        </p>
        <p data-testid="nota" className="text-sm text-texto-secundario">
          Os números vêm de uma foto da ocupação a cada 5 minutos, das 18h às 22h30. Uma janela sem foto quer dizer que os sensores não mandaram dado.
        </p>
      </section>

      <section aria-labelledby="titulo-noite" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-noite" data-testid="titulo-noite" className="text-lg font-bold">
            {textoNoite(noite)}
          </h2>
          <label htmlFor="escolha-noite" className="flex items-center gap-2 text-sm">
            Noite
            <select
              id="escolha-noite"
              value={noite}
              onChange={(e) => setNoite(e.target.value)}
              className="min-h-11 rounded-lg border border-borda bg-superficie px-3 text-base text-texto"
            >
              {noites.map((n) => (
                <option key={n} value={n}>
                  {dataCurta(n)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul data-testid="blocos-noite" className="flex flex-col gap-1">
          {daNoite.map((r) => (
            <li key={r.bolsao_id} data-testid={`bloco-${r.bolsao_id}`}>
              {textoBloco(r)}
            </li>
          ))}
          {blocos
            .filter((id) => !daNoite.some((r) => r.bolsao_id === id))
            .map((id) => (
              <li key={id} data-testid={`bloco-${id}`}>
                Bloco {id}: sem dado nessa noite.
              </li>
            ))}
        </ul>

        {serie === null && <p className="text-sm text-texto-secundario">A página está carregando o gráfico.</p>}
        {serie?.estado === "erro" && (
          <p role="alert" className="text-sm text-sem-dados">
            A página não conseguiu ler as fotos dessa noite.
          </p>
        )}
        {serie?.estado === "pronto" && (
          <>
            <div className="flex flex-col gap-4">
              {blocos.map((id) => (
                <GraficoNoite key={id} id={id} noite={noite} fotos={serie.fotos} />
              ))}
            </div>
            <BotaoCsv noite={noite} fotos={serie.fotos} />
          </>
        )}
      </section>
    </div>
  );
}

function BotaoCsv({ noite, fotos }: { noite: string; fotos: Foto[] }) {
  function baixar() {
    const blob = new Blob([csvDaNoite(noite, fotos)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vagas-noite-${noite}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  return (
    <button type="button" onClick={baixar} className="min-h-11 self-start rounded-xl border border-borda bg-superficie px-5 font-semibold hover:bg-superficie-2">
      Baixar CSV
    </button>
  );
}
