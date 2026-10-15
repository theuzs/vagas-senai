"use client";

import { useEffect, useState } from "react";
import { ENDERECO_PUBLICO } from "@/lib/endereco";

const DADOS = {
  title: "Vagas SENAI Blumenau",
  text: "Vagas livres agora nos blocos A, C e H do SENAI Blumenau.",
  url: ENDERECO_PUBLICO,
} as const;

const AVISO_MS = 3_000;

/**
 * "Enviar o link" para o rodapé da página. Usa a folha de compartilhar do aparelho e,
 * sem ela, copia o endereço. Sempre o endereço público, sem `?demo=1`.
 */
export function EnviarLink() {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), AVISO_MS);
    return () => clearTimeout(t);
  }, [copiado]);

  async function enviar() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(DADOS);
        return;
      } catch {
        // cancelou a folha ou o aparelho recusou: cai para copiar
      }
    }
    try {
      await navigator.clipboard.writeText(ENDERECO_PUBLICO);
      setCopiado(true);
    } catch {
      // sem permissão de área de transferência: o endereço continua visível na página
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void enviar()}
        className="inline-flex min-h-11 items-center rounded-xl border border-borda bg-superficie px-4 font-semibold text-texto hover:bg-superficie-2"
      >
        Enviar o link
      </button>
      <span aria-live="polite" data-testid="link-copiado" className="text-sm font-semibold text-livre">
        {copiado ? "Link copiado." : ""}
      </span>
    </div>
  );
}
