import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Lê as variáveis de :root em globals.css e calcula a razão de contraste WCAG (UX-09). */
const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
const raiz = css.match(/:root\s*\{([^}]*)\}/)![1];
const tokens: Record<string, string> = {};
for (const m of raiz.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) tokens[m[1]] = m[2].toLowerCase();

function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const cor = (nome: string) => {
  const v = tokens[nome];
  if (!v) throw new Error(`token --${nome} não achado em globals.css`);
  return v;
};

describe("contraste dos tokens", () => {
  const texto: [string, string][] = [
    ["livre", "livre-fundo"],
    ["poucas", "poucas-fundo"],
    ["lotado", "lotado-fundo"],
    ["sem-dados", "sem-dados-fundo"],
    ["demo", "demo-fundo"],
    ["livre", "superficie"],
    ["poucas", "superficie"],
    ["lotado", "superficie"],
    ["sem-dados", "superficie"],
    ["texto-secundario", "fundo"],
    ["texto-secundario", "superficie"],
    ["texto-secundario", "superficie-2"],
    ["texto-secundario", "livre-fundo"],
    ["texto-secundario", "poucas-fundo"],
    ["texto-secundario", "lotado-fundo"],
    ["texto-secundario", "sem-dados-fundo"],
  ];
  it.each(texto)("texto: --%s sobre --%s tem pelo menos 4,5:1", (a, b) => {
    expect(contraste(cor(a), cor(b))).toBeGreaterThanOrEqual(4.5);
  });

  const graficos: [string, string][] = [
    ["vaga-ocupada", "superficie-2"],
    ["vaga-livre", "superficie-2"],
    ["fundo", "vaga-ocupada"],
    ["vaga-especial", "superficie-2"],
    ["destaque", "fundo"],
  ];
  it.each(graficos)("elemento gráfico: --%s sobre --%s tem pelo menos 3:1", (a, b) => {
    expect(contraste(cor(a), cor(b))).toBeGreaterThanOrEqual(3);
  });

  it("o vermelho do LOTADO não volta para #ef4444", () => {
    expect(cor("lotado")).not.toBe("#ef4444");
    expect(contraste("#ef4444", cor("lotado-fundo"))).toBeLessThan(4.5);
  });

  it("os textos da guarita sobre o fundo listrado passam de 4,5:1", () => {
    expect(contraste("#9fb0bf", "#3f3f3f")).toBeGreaterThanOrEqual(4.5);
    expect(contraste("#fbbf24", "#3f3f3f")).toBeGreaterThanOrEqual(4.5);
  });
});
