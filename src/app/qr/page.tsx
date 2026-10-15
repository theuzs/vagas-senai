import type { Metadata } from "next";
import { Folha } from "@/components/folha";
import { ENDERECO_PUBLICO } from "@/lib/endereco";
import { svgDoQr } from "@/lib/qr";

export const metadata: Metadata = {
  title: "QR code para a guarita",
  robots: { index: false },
};

/**
 * Folha A4 para colar na guarita e nas entradas dos estacionamentos. O QR é gerado no
 * build, em nível H, e mede 165 mm para ser lido de dentro do carro.
 */
export default async function PaginaQr() {
  const svg = await svgDoQr(ENDERECO_PUBLICO);
  const enderecoCurto = ENDERECO_PUBLICO.replace(/^https?:\/\//, "");

  return (
    <Folha testId="folha-qr">
      <h1 className="text-[56px] font-black leading-[1.05]">
        Vagas livres agora
        <br />
        nos blocos A, C e H
      </h1>
      <p className="text-[30px] font-semibold leading-tight">Com o carro parado, aponte a câmera do celular.</p>
      <div data-testid="qr" className="w-[165mm] max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-[28px] font-extrabold">{enderecoCurto}</p>
      <p className="max-w-[150mm] text-[14px] leading-snug text-[#4b5563]">
        Cada vaga tem um sensor. Quando um estacionamento fica sem dado, a página mostra SEM DADOS no lugar do número. Para abrir mais rápido nas
        próximas noites, adicione a página à tela inicial do celular.
      </p>
    </Folha>
  );
}
