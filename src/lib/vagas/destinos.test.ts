import { describe, expect, it } from "vitest";
import { recomendacao } from "./destinos";
import { situacaoComum } from "./regras";
import type { Bolsao, Situacao } from "./tipos";

const AGORA = Date.parse("2026-10-08T22:00:00.000Z");
function b(id: string, ordem: number, livres: number | null, total = 40): Bolsao {
  const vagas = livres === null ? null : Array.from({ length: total }, (_, i) => i >= livres);
  return { id, nome: `Bloco ${id}`, ordem, total_vagas: vagas ? total : null, vagas_livres: livres, vagas, especiais: {}, atualizado_em: vagas ? new Date(AGORA - 1000).toISOString() : null, aviso: null, publico: true };
}
const sit = (bs: Bolsao[]) => new Map<string, Situacao>(bs.map((x) => [x.id, situacaoComum(x, AGORA)]));

describe("recomendacao por destino (UX-55)", () => {
  it("D com C e H livres indica o C", () => {
    const bs = [b("A", 1, 20), b("C", 2, 12), b("H", 3, 30)];
    expect(recomendacao(bs, sit(bs), "D", AGORA).texto).toBe("Para o bloco D, o mais perto com vaga é o Bloco C, com 12 livres.");
  });

  it("D com C sem dados e H livre indica o H e avisa do C", () => {
    const bs = [b("A", 1, 20), b("C", 2, null), b("H", 3, 30)];
    const r = recomendacao(bs, sit(bs), "D", AGORA);
    expect(r.texto).toBe("Para o bloco D, o mais perto com vaga é o Bloco H, com 30 livres.");
    expect(r.detalhe).toBe("O Bloco C, mais perto, está sem dados. Se passar por ele, confira no local.");
  });

  it("D com C em poucas indica o C e cita o H", () => {
    const bs = [b("A", 1, 20), b("C", 2, 2), b("H", 3, 30)];
    const r = recomendacao(bs, sit(bs), "D", AGORA);
    expect(r.texto).toBe("Para o bloco D, o mais perto com vaga é o Bloco C, com 2 livres.");
    expect(r.detalhe).toBe("O Bloco C tem poucas vagas. Se lotar, o Bloco H tem 30 livres.");
  });

  it("sem bloco com vaga, cai no texto geral e nunca indica bloco sem dados", () => {
    const bs = [b("A", 1, 0), b("C", 2, 0), b("H", 3, null)];
    const r = recomendacao(bs, sit(bs), "H", AGORA);
    expect(r.texto).toBe("O Bloco H está sem dados e pode ter vaga.");
    expect(r.indicado).toBeNull();
  });

  it("sem destino devolve a orientação geral", () => {
    const bs = [b("A", 1, 20), b("C", 2, 12), b("H", 3, 30)];
    expect(recomendacao(bs, sit(bs), null, AGORA).texto).toBe("O Bloco H tem mais vagas: 30 livres.");
  });
});
