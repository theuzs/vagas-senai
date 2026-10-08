/** Lógica do simulador da ponte, separada do CLI para teste. */

export interface BolsaoSimulado {
  id: string;
  total: number;
  estados: boolean[];
}

export function iniciarBolsoes(): BolsaoSimulado[] {
  return [
    { id: "A", total: 40, estados: Array.from({ length: 40 }, () => Math.random() < 0.7) },
    { id: "C", total: 24, estados: Array.from({ length: 24 }, () => Math.random() < 0.7) },
    { id: "H", total: 60, estados: Array.from({ length: 60 }, () => Math.random() < 0.7) },
  ];
}

/** Muda de 1 a 3 vagas por bolsão, como num estacionamento à noite. */
export function passo(bolsoes: BolsaoSimulado[]): void {
  for (const b of bolsoes) {
    const quantas = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < quantas; i++) {
      const p = Math.floor(Math.random() * b.total);
      b.estados[p] = !b.estados[p];
    }
  }
}

/** Payload no formato que vagas.publicar aceita. `parados` ficam de fora, como um nó morto. */
export function montarPayload(token: string, bolsoes: BolsaoSimulado[], parados: string[] = []) {
  const p_bolsoes: Record<string, string> = {};
  for (const b of bolsoes) {
    if (parados.includes(b.id)) continue;
    p_bolsoes[b.id] = b.estados.map((o) => (o ? "1" : "0")).join("");
  }
  return { p_token: token, p_bolsoes };
}
