"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ConfiguracaoSupabase } from "@/lib/vagas/configuracao";
import { BOLSOES_PADRAO } from "@/lib/vagas/padrao";
import { deslocamentoRelogio, situacao } from "@/lib/vagas/regras";
import type { Bolsao, Carga, FonteVagas, StatusConexao } from "@/lib/vagas/tipos";
import { CartaoBolsao } from "./cartao-bolsao";
import { MapaCampus } from "./mapa-campus";
import { SecaoBolsao } from "./secao-bolsao";

const INTERVALO_RELOGIO_MS = 5 * 60_000;

type Modo = "supabase" | "demo" | "sem-configuracao";

interface Props {
  configuracao: ConfiguracaoSupabase | null;
  /** Para testes: substitui a fonte real. */
  fonte?: FonteVagas;
  /** Para testes: força o modo em vez de ler ?demo=1. */
  modoInicial?: Modo;
}

const semAssinatura = () => () => {};
const demoNoEndereco = () => new URLSearchParams(window.location.search).get("demo") === "1";
const painelNoEndereco = () => new URLSearchParams(window.location.search).get("painel") === "1";
const falsoNoServidor = () => false;

export function PainelVagas({ configuracao, fonte: fonteInjetada, modoInicial }: Props) {
  // A página é estática; ?demo=1 só existe no navegador. No servidor vale "sem demo".
  const demo = useSyncExternalStore(semAssinatura, demoNoEndereco, falsoNoServidor);
  // ?painel=1: só os cartões, grandes, para uma TV ou tablet na guarita.
  const painel = useSyncExternalStore(semAssinatura, painelNoEndereco, falsoNoServidor);
  const modo: Modo = modoInicial ?? (demo ? "demo" : configuracao ? "supabase" : "sem-configuracao");

  const [bolsoes, setBolsoes] = useState<Bolsao[]>(BOLSOES_PADRAO);
  const [statusFonte, setStatus] = useState<StatusConexao>("conectando");
  const [erroCarga, setErroCarga] = useState(false);
  const [deslocamento, setDeslocamento] = useState<number | null>(null);
  const [agoraLocal, setAgoraLocal] = useState(() => Date.now());
  const fonteRef = useRef<FonteVagas | null>(null);
  const status: StatusConexao = modo === "sem-configuracao" ? "sem-configuracao" : statusFonte;

  // Reavalia as situações a cada segundo mesmo sem mensagem nova: se o Realtime cair,
  // os dados envelhecem e viram SEM DADOS sozinhos.
  useEffect(() => {
    const t = setInterval(() => setAgoraLocal(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (modo === "sem-configuracao") return;
    let ativo = true;
    let fonte = fonteInjetada ?? null;
    let cancelarAssinatura: (() => void) | undefined;

    function aplicarRelogio(relogio: Carga["relogio"]) {
      if (!ativo || !relogio) return;
      setDeslocamento(deslocamentoRelogio(relogio.t0, relogio.t1, relogio.servidorMs));
    }

    async function carregar() {
      if (!fonte) return;
      try {
        const carga = await fonte.carregar();
        if (!ativo) return;
        setErroCarga(false);
        if (carga.bolsoes.length > 0) setBolsoes([...carga.bolsoes].sort((a, b) => a.ordem - b.ordem));
        aplicarRelogio(carga.relogio);
      } catch {
        if (ativo) setErroCarga(true);
      }
    }

    async function iniciar() {
      if (!fonte) {
        if (modo === "demo") {
          const { fonteDemo } = await import("@/lib/vagas/fonte-demo");
          fonte = fonteDemo();
        } else if (configuracao) {
          const { fonteSupabase } = await import("@/lib/vagas/fonte-supabase");
          fonte = fonteSupabase(configuracao);
        } else {
          return;
        }
      }
      if (!ativo) return;
      fonteRef.current = fonte;
      await carregar();
      if (!ativo) return;
      cancelarAssinatura = fonte.assinar(
        (b) => {
          if (!ativo) return;
          setBolsoes((atual) => {
            const semEle = atual.filter((x) => x.id !== b.id);
            return [...semEle, b].sort((x, y) => x.ordem - y.ordem);
          });
        },
        (s) => {
          if (!ativo) return;
          setStatus(s);
          // Ao (re)conectar, recarrega: eventos podem ter se perdido enquanto estava fora.
          if (s === "ao-vivo") void carregar();
        },
      );
    }

    void iniciar();

    const relogioTimer = setInterval(() => {
      void fonte?.medirRelogio().then(aplicarRelogio);
    }, INTERVALO_RELOGIO_MS);

    const aoVoltar = () => {
      if (document.visibilityState === "visible") {
        void carregar();
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      ativo = false;
      clearInterval(relogioTimer);
      document.removeEventListener("visibilitychange", aoVoltar);
      cancelarAssinatura?.();
      fonteRef.current = null;
    };
  }, [modo, configuracao, fonteInjetada]);

  // Sem medição do servidor, usa o relógio do aparelho (deslocamento 0).
  const agoraServidorMs = agoraLocal + (deslocamento ?? 0);
  const situacoes = useMemo(() => new Map(bolsoes.map((b) => [b.id, situacao(b, agoraServidorMs)])), [bolsoes, agoraServidorMs]);

  return (
    <div className="flex flex-col gap-4" data-painel={painel ? "sim" : "nao"}>
      {modo === "demo" && (
        <p data-testid="faixa-demo" className="rounded-lg border border-poucas bg-[var(--poucas-fundo)] px-3 py-2 text-sm font-semibold text-poucas">
          Demonstração: dados simulados. Os números não são do estacionamento.
        </p>
      )}
      {modo === "sem-configuracao" && (
        <p data-testid="aviso-configuracao" className="rounded-lg border border-sem-dados bg-[var(--sem-dados-fundo)] px-3 py-2 text-sm text-sem-dados">
          Configuração incompleta: faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. A página não consegue ler as vagas.
        </p>
      )}
      {erroCarga && modo === "supabase" && (
        <p data-testid="aviso-erro" className="rounded-lg border border-sem-dados bg-[var(--sem-dados-fundo)] px-3 py-2 text-sm text-sem-dados">
          A página não conseguiu ler os dados. Ela tenta de novo sozinha.
        </p>
      )}

      <Conexao status={status} modo={modo} />

      <div className={`flex gap-2 ${painel ? "min-h-[60vh] gap-4" : ""}`} role="list" aria-label="Resumo dos bolsões" aria-live="polite">
        {bolsoes.map((b) => (
          <div key={b.id} role="listitem" className="flex min-w-0 flex-1">
            <CartaoBolsao bolsao={b} situacao={situacoes.get(b.id) ?? "sem-dados"} grande={painel} />
          </div>
        ))}
      </div>

      {!painel && <MapaCampus bolsoes={bolsoes} situacoes={situacoes} />}

      {!painel && (
        <div className="flex flex-col gap-3">
          {bolsoes.map((b) => (
            <SecaoBolsao key={b.id} bolsao={b} situacao={situacoes.get(b.id) ?? "sem-dados"} agoraServidorMs={agoraServidorMs} />
          ))}
        </div>
      )}
    </div>
  );
}

function Conexao({ status, modo }: { status: StatusConexao; modo: Modo }) {
  const info: Record<StatusConexao, { texto: string; cor: string }> = {
    conectando: { texto: "Conectando", cor: "bg-texto-secundario" },
    "ao-vivo": { texto: modo === "demo" ? "Simulação ao vivo" : "Ao vivo", cor: "bg-livre" },
    reconectando: { texto: "Reconectando", cor: "bg-poucas" },
    "sem-configuracao": { texto: "Sem conexão", cor: "bg-lotado" },
  };
  const i = info[status];
  return (
    <p data-testid="status-conexao" data-status={status} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-texto-secundario">
      <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${i.cor}`} />
      {i.texto}
    </p>
  );
}
