import type { Metadata } from "next";
import QRCode from "qrcode";
import { ENDERECO_PUBLICO } from "@/lib/endereco";

export const metadata: Metadata = {
  title: "QR code para a guarita",
  robots: { index: false },
};

/** Folha A4 para imprimir e colar na guarita. O QR é gerado no build. */
export default async function PaginaQr() {
  const svg = await QRCode.toString(ENDERECO_PUBLICO, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0f1419", light: "#ffffff" } });
  const enderecoCurto = ENDERECO_PUBLICO.replace(/^https?:\/\//, "");

  return (
    <main className="folha mx-auto flex w-full max-w-[210mm] flex-1 flex-col items-center justify-center gap-8 bg-white px-8 py-12 text-center text-[#0f1419] print:min-h-[297mm]">
      <h1 className="text-4xl font-black leading-tight">Tem vaga no A, no C ou no H?</h1>
      <p className="text-2xl">Aponte a câmera do celular para ver as vagas livres agora.</p>
      <div data-testid="qr" className="w-[110mm] max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-2xl font-bold">{enderecoCurto}</p>
      <p className="text-base text-[#4b5563]">Cada vaga tem um sensor. A página mostra quantas estão livres em cada bolsão e avisa quando não tem dado.</p>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { background: #fff !important; }
          .folha { padding: 0; }
        }
      `}</style>
    </main>
  );
}
