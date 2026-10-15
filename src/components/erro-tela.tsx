"use client";

import { useEffect, useSyncExternalStore } from "react";
import { servidorResponde } from "@/lib/vagas/servidor-responde";
import { IconeAlerta } from "./cartao-bolsao";

/** Contador de tentativas seguidas. `useVagas` zera na primeira carga boa. */
export const CHAVE_TENTATIVAS = "vagas-erro-tentativas";
const MAXIMO_TENTATIVAS = 3;
const INTERVALO_SERVIDOR_FORA_MS = 60_000;

function lerTentativas(): number {
  try {
    const n = Number(sessionStorage.getItem(CHAVE_TENTATIVAS) ?? "0");
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

const ouvintes = new Set<() => void>();

function gravarTentativas(n: number) {
  try {
    sessionStorage.setItem(CHAVE_TENTATIVAS, String(n));
  } catch {
    // sem sessionStorage a tela continua tentando, só não guarda a conta
  }
  for (const o of ouvintes) o();
}

const assinarTentativas = (aviso: () => void) => {
  ouvintes.add(aviso);
  return () => {
    ouvintes.delete(aviso);
  };
};
const zeroNoServidor = () => 0;

export interface PropsErroTela {
  error: Error & { digest?: string };
  retry: () => void;
  titulo: string;
  /** Quanto esperar antes de tentar de novo sozinha. */
  intervaloMs: number;
  /** Na guarita o texto fala com o vigia. */
  guarita?: boolean;
}

/**
 * Tela inteira com o visual do SEM DADOS para quando a página quebra. Tenta de novo
 * sozinha; na terceira tentativa seguida confere se o servidor responde e só então
 * recarrega. Nunca mostra número de vagas.
 */
export function ErroTela({ error, retry, titulo, intervaloMs, guarita = false }: PropsErroTela) {
  // No servidor não há sessionStorage; a conta aparece depois de hidratar.
  const feitas = useSyncExternalStore(assinarTentativas, lerTentativas, zeroNoServidor);
  const tentativa = Math.min(feitas + 1, MAXIMO_TENTATIVAS);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tentar() {
      if (!ativo) return;
      const n = lerTentativas() + 1;
      gravarTentativas(n);
      if (n < MAXIMO_TENTATIVAS) {
        retry();
        return;
      }
      if (await servidorResponde()) {
        gravarTentativas(0);
        location.reload();
        return;
      }
      if (!ativo) return;
      timer = setTimeout(() => void tentar(), INTERVALO_SERVIDOR_FORA_MS);
    }

    timer = setTimeout(() => void tentar(), intervaloMs);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [error, retry, intervaloMs]);

  const segundos = Math.round(intervaloMs / 1000);
  const texto = guarita ? `Não diga ao motorista que está lotado. A tela tenta de novo em ${segundos} s.` : `A página tenta de novo em ${segundos} segundos.`;

  return (
    <main
      data-testid="erro-tela"
      className="listrado flex min-h-dvh flex-col items-center justify-center gap-6 border-4 border-dashed border-sem-dados bg-[var(--sem-dados-fundo)] px-6 py-10 text-center"
    >
      <IconeAlerta className="h-16 w-16 text-sem-dados" />
      <h1 className="text-[clamp(1.5rem,4vw,5rem)] font-black leading-tight text-sem-dados text-balance">{titulo}</h1>
      <p className="max-w-[40ch] text-[clamp(1rem,2vw,2rem)] font-semibold text-balance">{texto}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="min-h-11 rounded-xl border-2 border-sem-dados bg-superficie px-6 text-[clamp(1rem,1.6vw,1.6rem)] font-bold hover:bg-superficie-2"
      >
        Tentar agora
      </button>
      <p className="text-[clamp(0.9rem,1.4vw,1.4rem)] text-texto-secundario">
        Tentativa {tentativa} de {MAXIMO_TENTATIVAS}
      </p>
    </main>
  );
}
