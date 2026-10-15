"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ConfiguracaoSupabase } from "./configuracao";
import { BOLSOES_PADRAO, MAQUETE_PADRAO } from "./padrao";
import { causaSemDados, deslocamentoRelogio, situacaoComum } from "./regras";
import type { Bolsao, Carga, CausaSemDados, FonteVagas, Situacao, StatusConexao } from "./tipos";

const INTERVALO_RELOGIO_MS = 5 * 60_000;
/** Sem Realtime, a página lê a API neste intervalo (decisão D3). */
export const INTERVALO_SEM_REALTIME_MS = 10_000;
const ESPERA_PRIMEIRA_FALHA_MS = 5_000;
/** Chave em sessionStorage que a tela de erro (UX-15) usa para contar as tentativas. */
export const CHAVE_TENTATIVAS_ERRO = "vagas-erro-tentativas";

export type Modo = "supabase" | "demo" | "maquete" | "sem-configuracao";

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
  /** Por que a tela está em SEM DADOS, quando está. */
  causa: CausaSemDados;
  /** true quando a primeira leitura terminou, com sucesso ou erro. */
  carregou: boolean;
  /** Instante local da última leitura ou evento bem-sucedido. */
  leituraOkEm: number | null;
  /** Maior atualizado_em entre os bolsões, em ms; muda a cada dado novo. */
  ultimoDadoMs: number | null;
  /** navigator.onLine; só o valor false conta como prova de falta de rede. */
  online: boolean;
  tentarAgora: () => void;
}

const semAssinatura = () => () => {};
const parametro = (nome: string) => new URLSearchParams(window.location.search).get(nome) === "1";
const demoNoEndereco = () => parametro("demo");
const maqueteNoEndereco = () => !parametro("demo") && parametro("maquete");
const falsoNoServidor = () => false;

const assinarRede = (aviso: () => void) => {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
};
const lerOnline = () => navigator.onLine;
const onlineNoServidor = () => true;

function maiorAtualizado(bolsoes: Bolsao[]): number | null {
  let maior: number | null = null;
  for (const b of bolsoes) {
    if (!b.atualizado_em) continue;
    const t = Date.parse(b.atualizado_em);
    if (!Number.isNaN(t) && (maior === null || t > maior)) maior = t;
  }
  return maior;
}

/**
 * Estado dos bolsões ao vivo, usado pela página do celular e pela tela da guarita.
 * Reavalia as situações a cada segundo mesmo sem mensagem nova: se o Realtime cair,
 * os dados envelhecem e viram SEM DADOS sozinhos. Sem Realtime, lê a API a cada 10 s.
 */
export function useVagas({ configuracao, fonte: fonteInjetada, modoInicial }: OpcoesVagas): EstadoVagas {
  // A página é estática; ?demo=1 e ?maquete=1 só existem no navegador. No servidor vale "sem demo".
  const demo = useSyncExternalStore(semAssinatura, demoNoEndereco, falsoNoServidor);
  const maquete = useSyncExternalStore(semAssinatura, maqueteNoEndereco, falsoNoServidor);
  const online = useSyncExternalStore(assinarRede, lerOnline, onlineNoServidor);
  const modo: Modo = modoInicial ?? (demo ? "demo" : configuracao ? (maquete ? "maquete" : "supabase") : "sem-configuracao");

  // null até a primeira carga: a tela mostra o padrão do modo (A, C e H, ou o M da maquete).
  const [bolsoesLidos, setBolsoes] = useState<Bolsao[] | null>(null);
  const padrao = modo === "maquete" ? MAQUETE_PADRAO : BOLSOES_PADRAO;
  const bolsoes = bolsoesLidos ?? padrao;
  const [statusFonte, setStatus] = useState<StatusConexao>("conectando");
  const [erroCarga, setErroCarga] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const [leituraOkEm, setLeituraOkEm] = useState<number | null>(null);
  const [deslocamento, setDeslocamento] = useState<number | null>(null);
  const [agoraLocal, setAgoraLocal] = useState(() => Date.now());
  const [montadoEm] = useState(() => Date.now());
  const [passouCincoSegundos, setPassouCincoSegundos] = useState(false);
  const pedirLeitura = useRef<(() => void) | null>(null);
  const status: StatusConexao = modo === "sem-configuracao" ? "sem-configuracao" : statusFonte;

  useEffect(() => {
    let anterior = Date.now();
    const t = setInterval(() => {
      const agora = Date.now();
      // Mais de 5 s entre dois tiques: o aparelho dormiu. Lê de novo.
      if (agora - anterior > 5000) pedirLeitura.current?.();
      anterior = agora;
      setAgoraLocal(agora);
    }, 1000);
    const limite = setTimeout(() => setPassouCincoSegundos(true), 5000);
    return () => {
      clearInterval(t);
      clearTimeout(limite);
    };
  }, []);

  useEffect(() => {
    if (modo === "sem-configuracao") return;
    let ativo = true;
    let fonte = fonteInjetada ?? null;
    let cancelarAssinatura: (() => void) | undefined;
    let assinado = false;
    let lendo = false;
    let falhasSeguidas = 0;
    let agendado: ReturnType<typeof setTimeout> | undefined;

    function aplicarRelogio(relogio: Carga["relogio"]) {
      if (!ativo || !relogio) return;
      setDeslocamento(deslocamentoRelogio(relogio.t0, relogio.t1, relogio.servidorMs));
    }

    function marcarOk() {
      setErroCarga(false);
      setLeituraOkEm(Date.now());
      try {
        sessionStorage.removeItem(CHAVE_TENTATIVAS_ERRO);
      } catch {
        // sem sessionStorage (modo privado): nada a zerar
      }
    }

    function aplicarCarga(carga: Carga) {
      if (!ativo) return;
      marcarOk();
      if (carga.bolsoes.length > 0) setBolsoes([...carga.bolsoes].sort((a, b) => a.ordem - b.ordem));
      aplicarRelogio(carga.relogio);
    }

    function agendar(ms: number) {
      clearTimeout(agendado);
      agendado = setTimeout(() => {
        // A aba ficou oculta depois do agendamento: a volta (visibilitychange) lê de novo.
        if (document.visibilityState === "hidden") return;
        void carregar();
      }, ms);
    }

    function depoisDaLeitura(falhou: boolean) {
      if (!ativo || modo === "demo") return;
      if (document.visibilityState === "hidden") return;
      if (falhou) {
        falhasSeguidas++;
        agendar(falhasSeguidas === 1 ? ESPERA_PRIMEIRA_FALHA_MS : INTERVALO_SEM_REALTIME_MS);
        return;
      }
      falhasSeguidas = 0;
      if (!assinado) agendar(INTERVALO_SEM_REALTIME_MS);
    }

    async function carregar() {
      if (!fonte || lendo) return;
      lendo = true;
      let falhou = false;
      try {
        const carga = await fonte.carregar();
        aplicarCarga(carga);
      } catch {
        falhou = true;
        if (ativo) setErroCarga(true);
      } finally {
        lendo = false;
        if (ativo) setCarregou(true);
        depoisDaLeitura(falhou);
      }
    }

    pedirLeitura.current = () => {
      setAgoraLocal(Date.now());
      void carregar();
    };

    async function iniciar() {
      let inicial: Promise<Carga> | null = null;
      if (!fonte && modo === "supabase") {
        const { pegarCargaInicial } = await import("./carga-inicial");
        inicial = pegarCargaInicial();
      }
      if (inicial) {
        void inicial
          .then((carga) => {
            if (!ativo) return;
            aplicarCarga(carga);
            setCarregou(true);
          })
          .catch(() => {
            if (!ativo) return;
            setErroCarga(true);
            setCarregou(true);
          });
      }
      if (!fonte) {
        if (modo === "demo") {
          const { fonteDemo } = await import("./fonte-demo");
          fonte = fonteDemo();
        } else if (configuracao) {
          const { fonteSupabase } = await import("./fonte-supabase");
          fonte = fonteSupabase(configuracao, { maquete: modo === "maquete" });
        } else {
          return;
        }
      }
      if (!ativo) return;
      if (!inicial) await carregar();
      if (!ativo) return;
      cancelarAssinatura = fonte.assinar(
        (b) => {
          if (!ativo) return;
          marcarOk();
          setBolsoes((atual) => {
            const semEle = (atual ?? padrao).filter((x) => x.id !== b.id);
            return [...semEle, b].sort((x, y) => x.ordem - y.ordem);
          });
        },
        (s) => {
          if (!ativo) return;
          setStatus(s);
          assinado = s === "ao-vivo";
          if (s === "ao-vivo") {
            // Ao (re)conectar, recarrega: eventos podem ter se perdido enquanto estava fora.
            clearTimeout(agendado);
            void carregar();
          } else if (modo !== "demo") {
            agendar(INTERVALO_SEM_REALTIME_MS);
          }
        },
      );
    }

    void iniciar();

    const relogioTimer = setInterval(() => {
      void fonte?.medirRelogio().then(aplicarRelogio);
    }, INTERVALO_RELOGIO_MS);

    const aoVoltar = () => {
      if (document.visibilityState === "visible") pedirLeitura.current?.();
    };
    const aoFicarOnline = () => pedirLeitura.current?.();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    window.addEventListener("online", aoFicarOnline);

    return () => {
      ativo = false;
      pedirLeitura.current = null;
      clearTimeout(agendado);
      clearInterval(relogioTimer);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      window.removeEventListener("online", aoFicarOnline);
      cancelarAssinatura?.();
    };
  }, [modo, configuracao, fonteInjetada, padrao]);

  const tentarAgora = useCallback(() => pedirLeitura.current?.(), []);

  // Sem medição do servidor, usa o relógio do aparelho (deslocamento 0).
  const agoraServidorMs = agoraLocal + (deslocamento ?? 0);
  const situacoes = useMemo(() => new Map(bolsoes.map((b) => [b.id, situacaoComum(b, agoraServidorMs)])), [bolsoes, agoraServidorMs]);
  const ultimoDadoMs = useMemo(() => maiorAtualizado(bolsoes), [bolsoes]);

  const causa = causaSemDados({
    modo: modo === "maquete" ? "supabase" : modo,
    carregou,
    msDesdeMontagem: passouCincoSegundos ? 5000 : agoraLocal - montadoEm,
    status,
    erroCarga,
    online,
    msDesdeLeituraOk: leituraOkEm === null ? null : agoraLocal - leituraOkEm,
  });

  return { modo, bolsoes, situacoes, status, erroCarga, agoraServidorMs, causa, carregou, leituraOkEm, ultimoDadoMs, online, tentarAgora };
}
