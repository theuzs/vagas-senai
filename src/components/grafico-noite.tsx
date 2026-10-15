import { JANELAS, JANELAS_POR_NOITE, dataCurta, horaDaFoto, indiceDaJanela, lacunas } from "@/lib/resultados/calculos";
import type { Foto } from "@/lib/resultados/tipos";

const LARGURA = 640;
const ALTURA = 170;
const ESQ = 34;
const DIR = 8;
const TOPO = 10;
const BASE = 26;
const LARGURA_UTIL = LARGURA - ESQ - DIR;
const ALTURA_UTIL = ALTURA - TOPO - BASE;
const PASSO = LARGURA_UTIL / JANELAS_POR_NOITE;

const x = (indice: number) => ESQ + (indice + 0.5) * PASSO;

/**
 * Vagas livres de um bloco ao longo de uma noite, das 18:00 às 22:25, em SVG próprio.
 * Janela sem foto quebra a linha e vira faixa hachurada "sem dados": o gráfico nunca
 * interpola nem desenha zero onde não houve foto.
 */
export function GraficoNoite({ id, noite, fotos }: { id: string; noite: string; fotos: Foto[] }) {
  const doBloco = fotos.filter((f) => f.bolsao_id === id && indiceDaJanela(f) >= 0).sort((a, b) => indiceDaJanela(a) - indiceDaJanela(b));
  const total = Math.max(1, ...doBloco.map((f) => f.total_vagas));
  const y = (livres: number) => TOPO + ALTURA_UTIL - (livres / total) * ALTURA_UTIL;
  const faltas = lacunas(doBloco);
  const idHachura = `hachura-${id}`;

  // Trechos contínuos: a linha para onde falta foto.
  const trechos: Foto[][] = [];
  let anterior = -2;
  for (const f of doBloco) {
    const i = indiceDaJanela(f);
    if (i === anterior + 1) trechos[trechos.length - 1].push(f);
    else trechos.push([f]);
    anterior = i;
  }

  const rotulo =
    doBloco.length === 0
      ? `Bloco ${id}, noite de ${dataCurta(noite)}: sem dados em toda a noite`
      : `Bloco ${id}, noite de ${dataCurta(noite)}: vagas livres a cada 5 minutos, das 18:00 às 22:25, com ${doBloco.length} de ${JANELAS_POR_NOITE} janelas com dado`;

  return (
    <figure data-testid={`grafico-${id}`} className="flex flex-col gap-1">
      <figcaption className="text-sm font-bold">
        Bloco {id} <span className="font-normal text-texto-secundario">({doBloco.length === 0 ? "sem dados" : `até ${total} vagas`})</span>
      </figcaption>
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} role="img" aria-label={rotulo} className="h-auto w-full">
        <defs>
          <pattern id={idHachura} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--sem-dados)" strokeWidth="2" strokeOpacity="0.45" />
          </pattern>
        </defs>

        {/* eixo y: 0 e o total */}
        <line x1={ESQ} y1={TOPO} x2={ESQ} y2={TOPO + ALTURA_UTIL} stroke="var(--borda)" />
        <text x={ESQ - 4} y={TOPO + 4} textAnchor="end" fontSize="10" fill="var(--texto-secundario)">
          {total}
        </text>
        <text x={ESQ - 4} y={TOPO + ALTURA_UTIL + 4} textAnchor="end" fontSize="10" fill="var(--texto-secundario)">
          0
        </text>

        {/* eixo x: uma marca por hora cheia */}
        <line x1={ESQ} y1={TOPO + ALTURA_UTIL} x2={LARGURA - DIR} y2={TOPO + ALTURA_UTIL} stroke="var(--borda)" />
        {JANELAS.map((hora, i) =>
          hora.endsWith(":00") ? (
            <g key={hora}>
              <line x1={x(i)} y1={TOPO + ALTURA_UTIL} x2={x(i)} y2={TOPO + ALTURA_UTIL + 4} stroke="var(--borda)" />
              <text x={x(i)} y={ALTURA - 8} textAnchor="middle" fontSize="10" fill="var(--texto-secundario)">
                {hora}
              </text>
            </g>
          ) : null,
        )}

        {/* janelas sem foto */}
        {faltas.map((l) => (
          <g key={`${l.de}-${l.ate}`} data-testid="lacuna" data-de={JANELAS[l.de]} data-ate={JANELAS[l.ate]} aria-label={`sem dados de ${JANELAS[l.de]} a ${JANELAS[l.ate]}`}>
            <rect x={ESQ + l.de * PASSO} y={TOPO} width={(l.ate - l.de + 1) * PASSO} height={ALTURA_UTIL} fill={`url(#${idHachura})`} stroke="var(--sem-dados)" strokeDasharray="3 3" strokeOpacity="0.7" />
            <text
              x={ESQ + (l.de + (l.ate - l.de + 1) / 2) * PASSO}
              y={TOPO + ALTURA_UTIL / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fontWeight="700"
              fill="var(--sem-dados)"
              transform={(l.ate - l.de + 1) * PASSO < 60 ? `rotate(-90 ${ESQ + (l.de + (l.ate - l.de + 1) / 2) * PASSO} ${TOPO + ALTURA_UTIL / 2})` : undefined}
            >
              sem dados
            </text>
          </g>
        ))}

        {/* a linha, um trecho por sequência de fotos seguidas */}
        {trechos.map((t) => (
          <polyline
            key={indiceDaJanela(t[0])}
            points={t.map((f) => `${x(indiceDaJanela(f))},${y(f.vagas_livres)}`).join(" ")}
            fill="none"
            stroke="var(--livre)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {doBloco.map((f) => (
          <circle
            key={f.momento}
            data-ponto={horaDaFoto(f)}
            cx={x(indiceDaJanela(f))}
            cy={y(f.vagas_livres)}
            r={f.vagas_livres === 0 ? 3.5 : 2}
            fill={f.vagas_livres === 0 ? "var(--lotado)" : "var(--livre)"}
          >
            <title>{`${horaDaFoto(f)}: ${f.vagas_livres === 0 ? "lotado" : `${f.vagas_livres} de ${f.total_vagas} livres`}`}</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}
