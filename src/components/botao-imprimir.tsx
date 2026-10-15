"use client";

/** Só aparece na tela. Abre a janela de impressão do navegador. */
export function BotaoImprimir({ children = "Imprimir esta folha" }: { children?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 rounded-xl border border-borda bg-superficie px-5 font-semibold text-texto hover:bg-superficie-2 print:hidden"
    >
      {children}
    </button>
  );
}
