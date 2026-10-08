import type { Bolsao, Carga, FonteVagas } from "./tipos";

/**
 * Dados simulados para apresentar a página sem o hardware ligado. Só entra com ?demo=1
 * e sempre com a faixa "Demonstração" na tela.
 * - muda vagas a cada 2 a 4 s;
 * - de vez em quando lota um bolsão;
 * - a cada 2 min o H para de atualizar por 40 s, para mostrar SEM DADOS.
 */
export function fonteDemo(): FonteVagas {
  const estado = new Map<string, Bolsao>([
    ["A", novo("A", "Bloco A", 1, 40, { pcd: [0, 1] })],
    ["C", novo("C", "Bloco C", 2, 24, { pcd: [0], idoso: [1] })],
    ["H", novo("H", "Bloco H", 3, 60, { pcd: [0, 1, 2] })],
  ]);
  const inicio = Date.now();

  function novo(id: string, nome: string, ordem: number, total: number, especiais: Bolsao["especiais"]): Bolsao {
    const vagas = Array.from({ length: total }, () => Math.random() < 0.7);
    return { id, nome, ordem, total_vagas: total, vagas, vagas_livres: vagas.filter((v) => !v).length, especiais, atualizado_em: new Date().toISOString() };
  }

  function hParado(agora: number) {
    const noCiclo = (agora - inicio) % 120_000;
    return noCiclo >= 60_000 && noCiclo < 100_000;
  }

  function passo(b: Bolsao): Bolsao {
    const vagas = [...(b.vagas ?? [])];
    const quantas = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < quantas; i++) {
      const p = Math.floor(Math.random() * vagas.length);
      vagas[p] = !vagas[p];
    }
    if (Math.random() < 0.04) vagas.fill(true);
    return { ...b, vagas, vagas_livres: vagas.filter((v) => !v).length, atualizado_em: new Date().toISOString() };
  }

  return {
    async carregar(): Promise<Carga> {
      const t = Date.now();
      return { bolsoes: [...estado.values()], relogio: { servidorMs: t, t0: t, t1: t } };
    },
    async medirRelogio() {
      const t = Date.now();
      return { servidorMs: t, t0: t, t1: t };
    },
    assinar(aoMudar, aoStatus) {
      aoStatus("ao-vivo");
      let timer: ReturnType<typeof setTimeout> | undefined;
      const agendar = () => {
        timer = setTimeout(() => {
          const agora = Date.now();
          for (const [id, b] of estado) {
            if (id === "H" && hParado(agora)) continue;
            const atual = passo(b);
            estado.set(id, atual);
            aoMudar(atual);
          }
          agendar();
        }, 2000 + Math.random() * 2000);
      };
      agendar();
      return () => clearTimeout(timer);
    },
  };
}
