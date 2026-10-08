"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ConfiguracaoSupabase } from "./configuracao";
import { BOLSOES_PADRAO } from "./padrao";
import { deslocamentoRelogio, situacao } from "./regras";
import type { Bolsao, Carga, FonteVagas, Situacao, StatusConexao } from "./tipos";

const INTERVALO_RELOGIO_MS = 5 * 60_000;

export type Modo = "supabase" | "demo" | "sem-configuracao";

export interface OpcoesVagas {
  configuracao: ConfiguracaoSupabase | null;
  /** Para testes: substitui a fonte real. */
  fonte?: FonteVagas;
  /** Para testes: força o modo em vez de ler ?demo=1. */
  modoInicial?: Modo;
}

export interface EstadoVagas {
  modo: Modo;
  bolsoes: Bolsao[];
  situacoes: Map<string, Situacao>;
  status: StatusConexao;
  erroCarga: boolean;
  agoraServidorMs: number;
}

const semAssinatura = () => () => {};
const demoNoEndereco = () => new URLSearchParams(window.location.search).get("demo") === "1";
const falsoNoServidor = () => false;

/**
 * Estado dos bolsões ao vivo, usado pela página do celular e pela tela da guarita.
 * Reavalia as situações a cada segundo mesmo sem mensagem nova: se o Realtime cair,
 * os dados envelhecem e viram SEM DADOS sozinhos.
 */
export function useVagas({ configuracao, fonte: fonteInjetada, modoInicial }: OpcoesVagas): EstadoVagas {
  // A página é estática; ?demo=1 só existe no navegador. No servidor vale "sem demo".
  const demo = useSyncExternalStore(semAssinatura, demoNoEndereco, falsoNoServidor);
  const modo: Modo = modoInicial ?? (demo ? "demo" : configuracao ? "supabase" : "sem-configuracao");

  const [bolsoes, setBolsoes] = useState<Bolsao[]>(BOLSOES_PADRAO);
  const [statusFonte, setStatus] = useState<StatusConexao>("conectando");
  const [erroCarga, setErroCarga] = useState(false);
  const [deslocamento, setDeslocamento] = useState<number | null>(null);
  const [agoraLocal, setAgoraLocal] = useState(() => Date.now());
  const status: StatusConexao = modo === "sem-configuracao" ? "sem-configuracao" : statusFonte;

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
          const { fonteDemo } = await import("./fonte-demo");
          fonte = fonteDemo();
        } else if (configuracao) {
          const { fonteSupabase } = await import("./fonte-supabase");
          fonte = fonteSupabase(configuracao);
        } else {
          return;
        }
      }
      if (!ativo) return;
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
      if (document.visibilityState === "visible") void carregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      ativo = false;
      clearInterval(relogioTimer);
      document.removeEventListener("visibilitychange", aoVoltar);
      cancelarAssinatura?.();
    };
  }, [modo, configuracao, fonteInjetada]);

  // Sem medição do servidor, usa o relógio do aparelho (deslocamento 0).
  const agoraServidorMs = agoraLocal + (deslocamento ?? 0);
  const situacoes = useMemo(() => new Map(bolsoes.map((b) => [b.id, situacao(b, agoraServidorMs)])), [bolsoes, agoraServidorMs]);

  return { modo, bolsoes, situacoes, status, erroCarga, agoraServidorMs };
}
