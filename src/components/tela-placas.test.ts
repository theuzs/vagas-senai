import { describe, expect, it } from "vitest";
import { estadoDaPlaca, qualidadeDoSinal, sensoresSuspeitos, textoLigada } from "./tela-placas";

const AGORA = Date.parse("2026-10-08T22:00:00.000Z");
const placa = (msAntes: number | null) => ({ id: "bolsao-a", nome: "Bolsão A", ultimo_envio: msAntes === null ? null : new Date(AGORA - msAntes).toISOString(), diag: null, diag_em: null, bolsoes: null });

describe("tela das placas (UX-58)", () => {
  it("classifica o último envio", () => {
    expect(estadoDaPlaca(placa(3_000), AGORA).texto).toBe("Mandando");
    expect(estadoDaPlaca(placa(2 * 60_000), AGORA).texto).toBe("Atrasada");
    expect(estadoDaPlaca(placa(6 * 60_000), AGORA).texto).toBe("Parada desde 18:54");
    expect(estadoDaPlaca(placa(null), AGORA).texto).toBe("Nunca mandou dado");
  });

  it("qualidade do sinal e tempo ligada", () => {
    expect(qualidadeDoSinal(-67)).toBe("bom");
    expect(qualidadeDoSinal(-70)).toBe("fraco");
    expect(qualidadeDoSinal(-80)).toBe("ruim");
    expect(textoLigada(3 * 3600 + 12 * 60)).toBe("3 h 12 min");
    expect(textoLigada(600)).toBe("10 min");
  });

  it("acha o sensor que não muda enquanto os outros mudam", () => {
    expect(sensoresSuspeitos([0, 0, 27, 0, 0])).toEqual([2]);
    expect(sensoresSuspeitos([40, 40, 40, 40, 40])).toEqual([]);
    expect(sensoresSuspeitos([0, 0, 27, 30, 31])).toEqual([2, 3, 4]);
    expect(sensoresSuspeitos([0, 27, 30, 31, 40])).toEqual([]);
    expect(sensoresSuspeitos(undefined)).toEqual([]);
  });
});
