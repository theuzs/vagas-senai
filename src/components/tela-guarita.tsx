"use client";

import { useEffect, useSyncExternalStore } from "react";
import { especiaisLivres, horaCurta, orientacaoGuarita, textoIdade } from "@/lib/vagas/regras";
import type { Bolsao, Situacao } from "@/lib/vagas/tipos";
import { useVagas, type OpcoesVagas } from "@/lib/vagas/use-vagas";
import { Avisos, Conexao } from "./avisos";
import { IconeAlerta, usePulso } from "./cartao-bolsao";
import { GradeVagas } from "./grade-vagas";

/**
 * Tela do PC da guarita: paisagem, tela cheia, sem rolagem. Três colunas grandes e,
 * embaixo, o que o vigia pode dizer ao motorista. Feita para ficar aberta a noite toda
 * em modo quiosque (chrome --kiosk .../guarita).
 */
export function TelaGuarita(props: OpcoesVagas) {
  const { modo, bolsoes, situacoes, status, erroCarga, agoraServidorMs } = useVagas(props);
  const orientacao = orientacaoGuarita(bolsoes, situacoes);
  useTelaAcesa();

  return (
    <main data-testid="tela-guarita" className="flex h-dvh flex-col gap-[1.6vh] overflow-hidden px-[2vw] py-[2vh]">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(1.2rem,2.4vw,2.4rem)] font-black leading-tight">Vagas SENAI Blumenau</h1>
          <Conexao status={status} modo={modo} className="text-[clamp(0.75rem,1.1vw,1.1rem)]" />
        </div>
        <div className="flex items-center gap-[1.5vw]">
          <BotaoTelaCheia />
          <Relogio ms={agoraServidorMs} />
        </div>
      </header>

      <Avisos modo={modo} erroCarga={erroCarga} className="text-[clamp(0.9rem,1.3vw,1.3rem)]" />

      <section className="grid min-h-0 flex-1 gap-[1.5vw]" style={{ gridTemplateColumns: `repeat(${Math.max(bolsoes.length, 1)}, minmax(0, 1fr))` }} aria-label="Bolsões" aria-live="polite">
        {bolsoes.map((b) => (
          <ColunaBolsao
            key={b.id}
            bolsao={b}
            situacao={situacoes.get(b.id) ?? "sem-dados"}
            agoraServidorMs={agoraServidorMs}
            indicado={orientacao.indicado?.id === b.id}
          />
        ))}
      </section>

      <footer
        data-testid="orientacao"
        data-tipo={orientacao.tipo}
        className={`rounded-2xl border-2 px-[2vw] py-[1.4vh] ${
          orientacao.tipo === "indicar"
            ? "border-livre bg-[var(--livre-fundo)]"
            : orientacao.tipo === "lotado"
              ? "border-lotado bg-[var(--lotado-fundo)]"
              : "listrado border-sem-dados bg-[var(--sem-dados-fundo)]"
        }`}
      >
        <p className="text-[clamp(1.1rem,2.4vw,2.6rem)] font-black leading-tight">{orientacao.texto}</p>
        {orientacao.detalhe && (
          <p className="mt-1 flex items-center gap-2 text-[clamp(0.9rem,1.5vw,1.6rem)] font-semibold text-sem-dados">
            <IconeAlerta className="h-[1.2em] w-[1.2em] shrink-0" />
            {orientacao.detalhe}
          </p>
        )}
      </footer>
    </main>
  );
}

const ESTILO: Record<Situacao, { caixa: string; texto: string; rotulo: string }> = {
  livre: { caixa: "border-livre bg-[var(--livre-fundo)]", texto: "text-livre", rotulo: "Tem vaga" },
  poucas: { caixa: "border-poucas bg-[var(--poucas-fundo)]", texto: "text-poucas", rotulo: "Poucas vagas" },
  lotado: { caixa: "border-lotado bg-[var(--lotado-fundo)]", texto: "text-lotado", rotulo: "Lotado" },
  "sem-dados": { caixa: "listrado border-dashed border-sem-dados bg-[var(--sem-dados-fundo)]", texto: "text-sem-dados", rotulo: "Sem dados" },
};

function ColunaBolsao({ bolsao, situacao, agoraServidorMs, indicado }: { bolsao: Bolsao; situacao: Situacao; agoraServidorMs: number; indicado: boolean }) {
  const e = ESTILO[situacao];
  const semDados = situacao === "sem-dados";
  const livres = semDados ? null : bolsao.vagas_livres;
  const pulsando = usePulso(livres);
  const especiais = semDados ? [] : especiaisLivres(bolsao);

  return (
    <article
      data-testid={`guarita-${bolsao.id}`}
      data-situacao={situacao}
      data-indicado={indicado ? "sim" : "nao"}
      aria-label={semDados ? `${bolsao.nome}: sem dados` : situacao === "lotado" ? `${bolsao.nome}: lotado` : `${bolsao.nome}: ${livres} livres`}
      className={`relative flex min-h-0 min-w-0 flex-col rounded-3xl border-[3px] p-[1.4vw] ${e.caixa} ${indicado ? "ring-4 ring-livre ring-offset-4 ring-offset-[var(--fundo)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[clamp(1.4rem,3vw,3.4rem)] font-black leading-none">{bolsao.nome}</h2>
        <span className={`flex items-center gap-1 text-[clamp(0.8rem,1.3vw,1.4rem)] font-bold uppercase ${e.texto}`}>
          {semDados && <IconeAlerta className="h-[1.2em] w-[1.2em]" />}
          {e.rotulo}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        {semDados ? (
          <>
            <span className={`text-[clamp(2rem,5.5vw,6.5rem)] font-black leading-none ${e.texto}`}>SEM DADOS</span>
            <span className="mt-[1.5vh] max-w-[22ch] text-[clamp(0.9rem,1.5vw,1.6rem)] font-semibold leading-snug">
              Não diga que está lotado. Confira no local.
            </span>
          </>
        ) : situacao === "lotado" ? (
          <>
            <span className={`text-[clamp(4rem,13vw,15rem)] font-black leading-none ${e.texto}`}>0</span>
            <span className={`text-[clamp(1.4rem,3vw,3.4rem)] font-black leading-none ${e.texto}`}>LOTADO</span>
          </>
        ) : (
          <>
            <span className={`text-[clamp(4rem,13vw,15rem)] font-black leading-none ${e.texto} ${pulsando ? "pulso" : ""}`}>{livres}</span>
            <span className={`text-[clamp(1.1rem,2.2vw,2.6rem)] font-bold leading-tight ${e.texto}`}>{livres === 1 ? "vaga livre" : "vagas livres"}</span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-[1vh]">
        <p className="text-[clamp(0.8rem,1.25vw,1.4rem)] text-texto-secundario">
          {semDados ? (
            textoIdade(bolsao, agoraServidorMs)
          ) : (
            <>
              <span className="font-semibold text-texto">de {bolsao.total_vagas}</span>
              {especiais.map((x) => (
                <span key={x.tipo}>
                  {" · "}
                  {x.rotulo}: {x.livres}
                </span>
              ))}
              {" · "}
              {textoIdade(bolsao, agoraServidorMs)}
            </>
          )}
        </p>
        <div className="max-h-[18vh] overflow-hidden">
          <GradeVagas bolsao={bolsao} semDados={semDados} />
        </div>
      </div>
    </article>
  );
}

const semAssinatura = () => () => {};
const noNavegador = () => true;
const noServidor = () => false;

function Relogio({ ms }: { ms: number }) {
  // A página é gerada no build. Se a hora viesse do servidor, seria a do build, e o React
  // manteria esse texto depois da hidratação até o minuto (e a data até o dia) mudar.
  const noCliente = useSyncExternalStore(semAssinatura, noNavegador, noServidor);
  const texto = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(ms));
  const data = texto.charAt(0).toUpperCase() + texto.slice(1);
  return (
    <div className="text-right">
      <p data-testid="relogio" className="text-[clamp(1.6rem,3.4vw,3.8rem)] font-black leading-none tabular-nums">
        {noCliente ? horaCurta(ms) : "--:--"}
      </p>
      <p data-testid="data-hoje" className="text-[clamp(0.75rem,1.1vw,1.1rem)] text-texto-secundario">
        {noCliente ? data : " "}
      </p>
    </div>
  );
}

const assinarTelaCheia = (aviso: () => void) => {
  document.addEventListener("fullscreenchange", aviso);
  return () => document.removeEventListener("fullscreenchange", aviso);
};
const emTelaCheia = () => document.fullscreenElement !== null;
const telaCheiaNoServidor = () => true;

/** Some quando já está em tela cheia (ou em modo quiosque, que conta como tela cheia). */
function BotaoTelaCheia() {
  const cheia = useSyncExternalStore(assinarTelaCheia, emTelaCheia, telaCheiaNoServidor);
  if (cheia) return null;
  return (
    <button
      type="button"
      onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
      className="min-h-11 rounded-xl border border-borda bg-superficie px-4 text-[clamp(0.85rem,1.1vw,1.1rem)] font-semibold hover:bg-superficie-2"
    >
      Abrir em tela cheia
    </button>
  );
}

/** Pede ao navegador para não apagar a tela (Wake Lock). Sem suporte, não faz nada. */
function useTelaAcesa() {
  useEffect(() => {
    type Trava = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Trava> } };
    if (!nav.wakeLock) return;
    let trava: Trava | null = null;
    let ativo = true;
    const pedir = () => {
      if (document.visibilityState !== "visible") return;
      nav.wakeLock!
        .request("screen")
        .then((t) => {
          if (ativo) trava = t;
          else void t.release();
        })
        .catch(() => {});
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", pedir);
      void trava?.release().catch(() => {});
    };
  }, []);
}
