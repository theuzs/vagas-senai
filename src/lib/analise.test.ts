import { describe, expect, it } from "vitest";
import { filtrarEvento } from "./analise";

describe("filtrarEvento (UX-60)", () => {
  it("deixa de fora a guarita, a demonstração e a maquete", () => {
    expect(filtrarEvento({ url: "https://vagas.rubysistemas.com.br/guarita" })).toBeNull();
    expect(filtrarEvento({ url: "/guarita/guia" })).toBeNull();
    expect(filtrarEvento({ url: "https://vagas.rubysistemas.com.br/?demo=1" })).toBeNull();
    expect(filtrarEvento({ url: "/?maquete=1" })).toBeNull();
    expect(filtrarEvento({ url: "https://vagas.rubysistemas.com.br/" })).toEqual({ url: "https://vagas.rubysistemas.com.br/" });
    expect(filtrarEvento({ url: "/como-funciona" })).toEqual({ url: "/como-funciona" });
  });
});
