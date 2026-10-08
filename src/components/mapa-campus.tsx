import type { Bolsao, Situacao } from "@/lib/vagas/tipos";

/**
 * Mapa esquemático do campus (não é o mapa oficial): guarita na Rua São Paulo,
 * os blocos e os três bolsões. Cada bolsão mostra o número ou o estado.
 * Posições vêm do mapa em docs/mapa-senai-blumenau.jpg, simplificadas.
 */

const COR: Record<Situacao, { fundo: string; borda: string; texto: string }> = {
  livre: { fundo: "var(--livre-fundo)", borda: "var(--livre)", texto: "var(--livre)" },
  poucas: { fundo: "var(--poucas-fundo)", borda: "var(--poucas)", texto: "var(--poucas)" },
  lotado: { fundo: "var(--lotado-fundo)", borda: "var(--lotado)", texto: "var(--lotado)" },
  "sem-dados": { fundo: "var(--sem-dados-fundo)", borda: "var(--sem-dados)", texto: "var(--sem-dados)" },
};

// Retângulos dos bolsões e dos blocos, em unidades do viewBox 0 0 640 260.
const BOLSOES: Record<string, { x: number; y: number; w: number; h: number }> = {
  A: { x: 96, y: 110, w: 52, h: 110 },
  C: { x: 212, y: 150, w: 90, h: 60 },
  H: { x: 400, y: 100, w: 150, h: 130 },
};

const BLOCOS: { nome: string; x: number; y: number; w: number; h: number }[] = [
  { nome: "A", x: 30, y: 60, w: 60, h: 120 },
  { nome: "B", x: 154, y: 50, w: 50, h: 170 },
  { nome: "C", x: 212, y: 90, w: 90, h: 50 },
  { nome: "D", x: 310, y: 60, w: 36, h: 170 },
  { nome: "E", x: 360, y: 40, w: 36, h: 44 },
  { nome: "H", x: 400, y: 30, w: 150, h: 60 },
  { nome: "G", x: 560, y: 30, w: 60, h: 60 },
  { nome: "F", x: 560, y: 110, w: 60, h: 90 },
];

export function MapaCampus({ bolsoes, situacoes }: { bolsoes: Bolsao[]; situacoes: Map<string, Situacao> }) {
  return (
    <figure data-testid="mapa" className="rounded-2xl border border-borda bg-superficie p-3">
      <svg viewBox="0 0 640 260" role="img" aria-label="Mapa esquemático do campus com os bolsões A, C e H" className="h-auto w-full">
        <rect x="0" y="0" width="640" height="260" rx="12" fill="var(--superficie-2)" />
        {/* ruas */}
        <rect x="0" y="236" width="640" height="24" fill="var(--borda)" />
        <text x="320" y="252" textAnchor="middle" fontSize="11" fill="var(--texto-secundario)">
          Rua São Paulo
        </text>
        <rect x="0" y="0" width="22" height="236" fill="var(--borda)" />

        {BLOCOS.map((b) => (
          <g key={b.nome}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="4" fill="var(--superficie)" stroke="var(--borda)" />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} textAnchor="middle" fontSize="12" fill="var(--texto-secundario)">
              {b.nome}
            </text>
          </g>
        ))}

        {/* guarita */}
        <rect x="30" y="196" width="34" height="30" rx="3" fill="var(--destaque)" opacity="0.9" />
        <text x="47" y="215" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">
          Guarita
        </text>

        {bolsoes.map((b) => {
          const r = BOLSOES[b.id];
          if (!r) return null;
          const s = situacoes.get(b.id) ?? "sem-dados";
          const c = COR[s];
          const rotulo = s === "sem-dados" ? "SEM DADOS" : s === "lotado" ? "LOTADO" : String(b.vagas_livres);
          const fonte = s === "sem-dados" ? 11 : s === "lotado" ? 13 : 24;
          return (
            <g key={b.id} data-testid={`mapa-${b.id}`} data-situacao={s}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="6" fill={c.fundo} stroke={c.borda} strokeWidth="2" strokeDasharray={s === "sem-dados" ? "5 4" : undefined} />
              <text x={r.x + r.w / 2} y={r.y + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--texto)">
                Bolsão {b.id}
              </text>
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 + fonte / 2.5} textAnchor="middle" fontSize={fonte} fontWeight="900" fill={c.texto}>
                {rotulo}
              </text>
              {s !== "sem-dados" && s !== "lotado" && (
                <text x={r.x + r.w / 2} y={r.y + r.h - 8} textAnchor="middle" fontSize="10" fill={c.texto}>
                  livres
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-xs text-texto-secundario">Mapa simplificado. A entrada é pela guarita, na Rua São Paulo.</figcaption>
    </figure>
  );
}
