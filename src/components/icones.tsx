/** Ícones próprios num arquivo só (UX-28): traço de 2,2, pontas redondas, sempre decorativos. */

export type NomeIcone = "alerta" | "x" | "carro" | "cadeirante" | "idoso" | "bloqueio" | "seta" | "ok";

const CAMINHOS: Record<NomeIcone, React.ReactNode> = {
  alerta: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 17.5h.01" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  carro: (
    <>
      <path d="M7 3h10l2 6v12H5V9l2-6Z" />
      <path d="M5 13h14" />
      <path d="M8 17h.01M16 17h.01" />
    </>
  ),
  cadeirante: (
    <>
      <circle cx="11" cy="4" r="1.6" />
      <path d="M10 7.5v6h5l2.5 5" />
      <path d="M10 10h4" />
      <path d="M7.5 11.5a4.5 4.5 0 1 0 6 6.5" />
    </>
  ),
  idoso: (
    <>
      <circle cx="12" cy="4" r="1.6" />
      <path d="M12 7v7l-2 7" />
      <path d="M12 14l2 7" />
      <path d="M12 9l3 3" />
      <path d="M17 11v10" />
    </>
  ),
  bloqueio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
  seta: (
    <>
      <path d="M12 4v16" />
      <path d="M5 13l7 7 7-7" />
    </>
  ),
  ok: <path d="M4 12.5l5 5L20 6.5" />,
};

/** Mapa tipo de vaga especial → ícone. */
export const ICONE_DO_TIPO: Record<string, NomeIcone> = { pcd: "cadeirante", idoso: "idoso" };

export function Icone({ nome, className = "h-5 w-5" }: { nome: NomeIcone; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-icone={nome}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {CAMINHOS[nome]}
    </svg>
  );
}

export function IconeAlerta({ className = "h-5 w-5" }: { className?: string }) {
  return <Icone nome="alerta" className={className} />;
}
