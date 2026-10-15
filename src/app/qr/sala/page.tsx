import type { Metadata } from "next";
import { Folha } from "@/components/folha";
import { ENDERECO_PUBLICO } from "@/lib/endereco";
import { svgDoQr } from "@/lib/qr";

export const metadata: Metadata = {
  title: "QR code para as salas",
  robots: { index: false },
};

/** Folha A4 para as salas de aula: o QR e o passo a passo para a tela inicial do celular. */
export default async function PaginaQrSala() {
  const svg = await svgDoQr(ENDERECO_PUBLICO);
  const enderecoCurto = ENDERECO_PUBLICO.replace(/^https?:\/\//, "");

  return (
    <Folha testId="folha-qr-sala">
      <h1 className="text-[34px] font-black leading-[1.1] text-balance sm:text-[48px] print:text-[48px]">Veja as vagas livres antes de chegar ao SENAI</h1>
      <p className="text-[22px] font-semibold leading-tight sm:text-[28px] print:text-[28px]">Aponte a câmera do celular e abra a página.</p>
      <div data-testid="qr" className="w-[140mm] max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="break-all text-[20px] font-extrabold sm:text-[28px] print:text-[28px]">{enderecoCurto}</p>
      <p className="max-w-[160mm] text-[16px] leading-snug text-[#4b5563] sm:text-[18px] print:text-[18px]">
        No Android, abra o menu do Chrome e toque em Adicionar à tela inicial. No iPhone, toque em Compartilhar e depois em Adicionar à Tela de Início.
      </p>
    </Folha>
  );
}
