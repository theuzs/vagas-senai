import type { Bolsao, Situacao } from "@/lib/vagas/tipos";
import { VISUAL } from "@/lib/vagas/visual";

/**
 * Mapa esquemático do campus (não é o mapa oficial): a Rua São Paulo à esquerda, a
 * guarita no canto de baixo, os blocos e os três estacionamentos. Sem número: o
 * estado aparece por cor, borda, listras e ícone (decisão D7).
 * Posições vêm do mapa em docs/mapa-senai-blumenau.jpg, simplificadas.
 */

// Retângulos dos estacionamentos e dos blocos, em unidades do viewBox 0 0 640 300.
const ESTACIONAMENTOS: Record<string, { x: number; y: number; w: number; h: number }> = {
  A: { x: 130, y: 120, w: 60, h: 120 },
  C: { x: 250, y: 165, w: 100, h: 70 },
  H: { x: 440, y: 110, w: 160, h: 130 },
};

const BLOCOS: { nome: string; x: number; y: number; w: number; h: number }[] = [
  { nome: "A", x: 60, y: 60, w: 60, h: 130 },
  { nome: "B", x: 196, y: 50, w: 46, h: 180 },
  { nome: "C", x: 250, y: 100, w: 100, h: 55 },
  { nome: "D", x: 360, y: 60, w: 36, h: 170 },
  { nome: "E", x: 404, y: 40, w: 30, h: 44 },
  { nome: "H", x: 440, y: 30, w: 160, h: 70 },
  { nome: "G", x: 606, y: 30, w: 30, h: 60 },
  { nome: "F", x: 606, y: 110, w: 30, h: 90 },
];

export function MapaCampus({ bolsoes, situacoes }: { bolsoes: Bolsao[]; situacoes: Map<string, Situacao> }) {
  const descricao =
    "Mapa do campus. A guarita fica na Rua São Paulo, no canto de baixo à esquerda. O estacionamento do Bloco A fica entre os blocos A e B, perto da guarita. O do Bloco C fica abaixo do bloco C. O do Bloco H fica abaixo do bloco H, no lado direito do campus.";
  return (
    <figure data-testid="mapa" className="rounded-2xl border border-borda bg-superficie p-3">
      <svg viewBox="0 0 640 300" role="img" aria-label={descricao} className="h-auto w-full">
        <defs>
          <pattern id="mapa-listras" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="8" fill="rgb(255 255 255 / 0.10)" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="640" height="300" rx="12" fill="var(--superficie-2)" />
        {/* Rua São Paulo, à esquerda */}
        <rect x="0" y="0" width="36" height="300" fill="var(--borda)" />
        <text transform="translate(24 150) rotate(-90)" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--texto-secundario)">
          Rua São Paulo
        </text>
        {/* via de baixo, sem nome */}
        <rect x="36" y="270" width="604" height="30" fill="var(--borda)" />

        {BLOCOS.map((b) => (
          <g key={b.nome}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="4" fill="var(--borda)" stroke="#4a5b6b" />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 8} textAnchor="middle" fontSize="24" fill="var(--texto-secundario)">
              {b.nome}
            </text>
          </g>
        ))}

        {/* guarita */}
        <rect x="46" y="226" width="40" height="36" rx="4" fill="#1d4ed8" />
        <text x="66" y="222" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--texto)">
          Guarita
        </text>

        {bolsoes.map((b) => {
          const r = ESTACIONAMENTOS[b.id];
          if (!r) return null;
          const s = situacoes.get(b.id) ?? "sem-dados";
          const v = VISUAL[s];
          const cabeIcone = r.w >= 90;
          const icone = cabeIcone && v.icone ? v.icone : null;
          const cy = r.y + r.h / 2;
          return (
            <g key={b.id} data-testid={`mapa-${b.id}`} data-situacao={s}>
              <title>{`${b.nome}: ${s === "sem-dados" ? "sem dados" : s}`}</title>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="6" fill={v.fundoCss} stroke={v.corCss} strokeWidth="3" strokeDasharray={v.tracejado ? "8 6" : undefined} />
              {v.listrado && <rect data-listras="sim" x={r.x} y={r.y} width={r.w} height={r.h} rx="6" fill="url(#mapa-listras)" />}
              {icone && (
                <g data-icone={icone} transform={`translate(${r.x + r.w / 2 - 16} ${cy - 44}) scale(1.333)`} fill="none" stroke={v.corCss} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  {icone === "alerta" ? (
                    <>
                      <path d="M12 3 2.5 20h19L12 3Z" />
                      <path d="M12 9v5" />
                      <path d="M12 17.5h.01" />
                    </>
                  ) : (
                    <>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M5.6 5.6l12.8 12.8" />
                    </>
                  )}
                </g>
              )}
              <text x={r.x + r.w / 2} y={cy + (icone ? 24 : 14)} textAnchor="middle" fontSize="40" fontWeight="900" fill="var(--texto)">
                {b.id}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-xs text-texto-secundario">Mapa simplificado. A guarita é o quadrado azul no canto de baixo, à esquerda.</figcaption>
    </figure>
  );
}
