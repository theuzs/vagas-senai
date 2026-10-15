import type { ReactNode } from "react";
import { BotaoImprimir } from "./botao-imprimir";

/**
 * Folha A4 de uma página só (QR da guarita, QR das salas, guia do vigia).
 * Na tela: fundo escuro do site com a folha branca no meio e o botão de imprimir.
 * Na impressão: fundo branco, esquema claro, margem de 12 mm e altura fixa de 272 mm,
 * para nunca sair uma segunda página em branco.
 */
export function Folha({ children, testId, rotuloBotao }: { children: ReactNode; testId?: string; rotuloBotao?: string }) {
  return (
    <>
      <div className="mx-auto flex w-full max-w-[210mm] flex-col items-center gap-2 px-4 pt-5 print:hidden">
        <BotaoImprimir>{rotuloBotao}</BotaoImprimir>
        <p className="text-center text-xs text-texto-secundario">Na janela de impressão, escolha papel A4 e escala 100 %.</p>
      </div>
      <main
        data-testid={testId}
        className="folha mx-auto my-5 flex w-full max-w-[210mm] flex-1 flex-col items-center justify-between gap-6 bg-white px-8 py-10 text-center text-[#0f1419] print:my-0 print:h-[272mm] print:min-h-0 print:flex-none print:px-0 print:py-0"
      >
        {children}
      </main>
      <EstiloImpressao />
    </>
  );
}

export function EstiloImpressao() {
  return (
    <style>{`
      @media print {
        @page { size: A4; margin: 12mm; }
        html { color-scheme: light; background: #fff; height: auto; }
        body { background: #fff !important; color: #0f1419 !important; min-height: 0 !important; height: auto !important; display: block !important; }
        .folha { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `}</style>
  );
}
