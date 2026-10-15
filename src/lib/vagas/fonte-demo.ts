import type { Bolsao, Carga, FonteVagas } from "./tipos";

/**
 * Demonstração com roteiro fixo de 180 s alinhado ao relógio (decisão D14): todas as
 * telas mostram o mesmo número no mesmo instante. Só entra com ?demo=1.
 *
 * Cenas: 1 (0-60 s) o estacionamento enche; 2 (60-105 s) o C lota; 3 (105-174 s) o H
 * para de mandar dado e vira SEM DADOS pela regra dos 30 s; 4 (174-180 s) o H volta.
 */
export const CICLO_MS = 180_000;
export const PASSO_MS = 3_000;

interface Roteiro {
  id: string;
  nome: string;
  ordem: number;
  total: number;
  especiais: Bolsao["especiais"];
  /** Pontos-chave (segundo, vagas livres) com interpolação linear entre eles. */
  pontos: [number, number][];
  /** Trecho em que atualizado_em fica congelado (o H some). */
  congelado?: [number, number];
}

const ROTEIRO: Roteiro[] = [
  { id: "A", nome: "Bloco A", ordem: 1, total: 40, especiais: { pcd: [0, 1] }, pontos: [[0, 22], [60, 8], [105, 8], [174, 22], [180, 22]] },
  { id: "C", nome: "Bloco C", ordem: 2, total: 24, especiais: { pcd: [0], idoso: [1] }, pontos: [[0, 10], [60, 3], [69, 0], [105, 0], [111, 2], [174, 10], [180, 10]] },
  { id: "H", nome: "Bloco H", ordem: 3, total: 60, especiais: { pcd: [0, 1, 2] }, pontos: [[0, 35], [60, 20], [105, 33], [171, 33], [174, 34], [177, 35], [180, 35]], congelado: [105, 171] },
];

export interface Cena {
  numero: 1 | 2 | 3 | 4;
  texto: string;
  proximaEmS: number;
}

const CENAS: { inicio: number; fim: number; texto: string }[] = [
  { inicio: 0, fim: 60, texto: "O estacionamento enche no começo da noite." },
  { inicio: 60, fim: 105, texto: "O Bloco C lotou. A tela indica outro bloco." },
  { inicio: 105, fim: 174, texto: "Os sensores do Bloco H pararam de mandar dados. Depois de 30 segundos sem dado, a tela mostra SEM DADOS." },
  { inicio: 174, fim: 180, texto: "Os sensores do Bloco H voltaram a mandar dados." },
];

/** Gerador determinístico, para as posições que trocam serem as mesmas em todo aparelho. */
function mulberry32(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function livresNoSegundo(r: Roteiro, s: number): number {
  const pts = r.pontos;
  for (let i = 1; i < pts.length; i++) {
    const [s0, v0] = pts[i - 1];
    const [s1, v1] = pts[i];
    if (s <= s1) {
      if (s1 === s0) return v1;
      return Math.round(v0 + ((v1 - v0) * (s - s0)) / (s1 - s0));
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * Monta a grade de um bolsão num passo, refazendo o ciclo desde o passo 0 com a
 * mesma semente: no máximo uma vaga muda por passo, e a posição é sempre a mesma.
 * As vagas liberam na ordem inversa da ocupação, então o fim do ciclo volta ao
 * estado inicial e a virada não troca várias vagas de uma vez.
 */
function gradeNoPasso(r: Roteiro, passo: number): boolean[] {
  const aleatorio = mulberry32(r.id.charCodeAt(0) * 7919);
  const vagas = Array.from({ length: r.total }, () => false);
  const livresIniciais = livresNoSegundo(r, 0);
  // Começa ocupando as últimas, para as especiais (no início) ficarem livres.
  for (let i = r.total - 1; i >= livresIniciais; i--) vagas[i] = true;
  let livres = livresIniciais;
  const ocupadasNoCiclo: number[] = [];
  for (let p = 1; p <= passo; p++) {
    const alvo = livresNoSegundo(r, (p * PASSO_MS) / 1000);
    if (alvo === livres) continue;
    if (alvo < livres) {
      const candidatas = vagas.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      if (candidatas.length === 0) continue;
      const i = candidatas[Math.floor(aleatorio() * candidatas.length)];
      vagas[i] = true;
      ocupadasNoCiclo.push(i);
      livres--;
    } else {
      const i = ocupadasNoCiclo.pop();
      if (i === undefined) continue;
      vagas[i] = false;
      livres++;
    }
  }
  return vagas;
}

/** O estado da demonstração num instante. É só função do relógio. */
export function estadoDemo(ms: number): { bolsoes: Bolsao[]; cena: Cena } {
  const inicio = Math.floor(ms / CICLO_MS) * CICLO_MS;
  const passo = Math.floor((ms - inicio) / PASSO_MS);
  const segundo = (passo * PASSO_MS) / 1000;
  const bolsoes = ROTEIRO.map((r) => {
    const vagas = gradeNoPasso(r, passo);
    const congelado = r.congelado && segundo >= r.congelado[0] && segundo < r.congelado[1];
    const segundoDoDado = congelado ? r.congelado![0] : segundo;
    return {
      id: r.id,
      nome: r.nome,
      ordem: r.ordem,
      total_vagas: r.total,
      vagas: congelado ? gradeNoPasso(r, r.congelado![0] / (PASSO_MS / 1000)) : vagas,
      vagas_livres: congelado ? livresNoSegundo(r, r.congelado![0]) : vagas.filter((v) => !v).length,
      especiais: r.especiais,
      atualizado_em: new Date(inicio + segundoDoDado * 1000).toISOString(),
      aviso: null,
      publico: true,
    };
  });
  const c = CENAS.findIndex((x) => segundo >= x.inicio && segundo < x.fim);
  const atual = CENAS[c === -1 ? 0 : c];
  const cena: Cena = { numero: ((c === -1 ? 0 : c) + 1) as Cena["numero"], texto: atual.texto, proximaEmS: Math.max(1, atual.fim - segundo) };
  return { bolsoes, cena };
}

export function fonteDemo(): FonteVagas {
  return {
    async carregar(): Promise<Carga> {
      const t = Date.now();
      return { bolsoes: estadoDemo(t).bolsoes, relogio: { servidorMs: t, t0: t, t1: t } };
    },
    async medirRelogio() {
      const t = Date.now();
      return { servidorMs: t, t0: t, t1: t };
    },
    assinar(aoMudar, aoStatus) {
      aoStatus("ao-vivo");
      let timer: ReturnType<typeof setTimeout> | undefined;
      const agendar = () => {
        const agora = Date.now();
        const proximo = Math.floor(agora / PASSO_MS) * PASSO_MS + PASSO_MS;
        timer = setTimeout(() => {
          for (const b of estadoDemo(Date.now()).bolsoes) aoMudar(b);
          agendar();
        }, proximo - agora);
      };
      agendar();
      return () => clearTimeout(timer);
    },
  };
}
