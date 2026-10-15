import { describe, expect, it } from "vitest";
import { CICLO_MS, PASSO_MS, estadoDemo } from "./fonte-demo";
import { situacao } from "./regras";

const INICIO = Math.floor(Date.parse("2026-10-14T21:00:00.000Z") / CICLO_MS) * CICLO_MS;
const em = (s: number) => INICIO + s * 1000;
const bolsao = (s: number, id: string) => estadoDemo(em(s)).bolsoes.find((b) => b.id === id)!;

describe("estadoDemo", () => {
  it("o mesmo instante dá o mesmo resultado", () => {
    expect(estadoDemo(em(47))).toEqual(estadoDemo(em(47)));
    expect(estadoDemo(em(45)).bolsoes).toEqual(estadoDemo(em(45) + 2999).bolsoes);
  });

  it("nenhum bloco muda mais de uma vaga por passo, inclusive na virada do ciclo", () => {
    const passos = CICLO_MS / PASSO_MS;
    for (const id of ["A", "C", "H"]) {
      let anterior = bolsao(0, id).vagas!;
      for (let p = 1; p <= passos + 3; p++) {
        const atual = bolsao((p * PASSO_MS) / 1000, id).vagas!;
        const diferentes = atual.filter((v, i) => v !== anterior[i]).length;
        expect(diferentes, `${id} no passo ${p}`).toBeLessThanOrEqual(1);
        anterior = atual;
      }
    }
  });

  it("o C lota aos 70 s e o H some aos 140 s e volta aos 174 s", () => {
    expect(bolsao(70, "C").vagas_livres).toBe(0);
    expect(situacao(bolsao(140, "H"), em(140))).toBe("sem-dados");
    expect(situacao(bolsao(120, "H"), em(120))).toBe("livre");
    expect(situacao(bolsao(174, "H"), em(174))).not.toBe("sem-dados");
    for (let s = 0; s < 180; s += 3) expect(situacao(bolsao(s, "A"), em(s))).not.toBe("sem-dados");
  });

  it("as cenas seguem o roteiro", () => {
    expect(estadoDemo(em(10)).cena).toMatchObject({ numero: 1, proximaEmS: 51 });
    expect(estadoDemo(em(61)).cena.numero).toBe(2);
    expect(estadoDemo(em(140)).cena).toMatchObject({ numero: 3 });
    expect(estadoDemo(em(175)).cena.numero).toBe(4);
  });

  it("vagas_livres bate com a grade", () => {
    for (const s of [0, 33, 66, 99, 150, 177]) {
      for (const b of estadoDemo(em(s)).bolsoes) expect(b.vagas_livres).toBe(b.vagas!.filter((v) => !v).length);
    }
  });
});
