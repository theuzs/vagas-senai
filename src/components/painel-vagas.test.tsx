import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Bolsao, FonteVagas, StatusConexao } from "@/lib/vagas/tipos";
import { PainelVagas } from "./painel-vagas";

afterEach(() => {
  vi.useRealTimers();
});

function bolsao(id: string, ordem: number, estados: string | null, msAtras = 0): Bolsao {
  const vagas = estados === null ? null : [...estados].map((c) => c === "1");
  return {
    id,
    nome: `Bloco ${id}`,
    ordem,
    total_vagas: vagas?.length ?? null,
    vagas_livres: vagas ? vagas.filter((v) => !v).length : null,
    vagas,
    especiais: {},
    atualizado_em: estados === null ? null : new Date(Date.now() - msAtras).toISOString(),
  };
}

function fonteFalsa(inicial: Bolsao[]) {
  let aoMudar: ((b: Bolsao) => void) | undefined;
  let aoStatus: ((s: StatusConexao) => void) | undefined;
  const fonte: FonteVagas = {
    carregar: vi.fn(async () => ({ bolsoes: inicial, relogio: { servidorMs: Date.now(), t0: Date.now(), t1: Date.now() } })),
    medirRelogio: vi.fn(async () => ({ servidorMs: Date.now(), t0: Date.now(), t1: Date.now() })),
    assinar: vi.fn((m, s) => {
      aoMudar = m;
      aoStatus = s;
      return () => {};
    }),
  };
  return { fonte, mudar: (b: Bolsao) => aoMudar?.(b), status: (s: StatusConexao) => aoStatus?.(s) };
}

describe("PainelVagas", () => {
  it("sem configuração mostra o aviso, SEM DADOS em tudo e nenhum número", () => {
    render(<PainelVagas configuracao={null} />);
    expect(screen.getByTestId("aviso-configuracao")).toHaveTextContent("Configuração incompleta");
    expect(screen.getByTestId("status-conexao")).toHaveAttribute("data-status", "sem-configuracao");
    for (const id of ["A", "C", "H"]) {
      const cartao = screen.getByTestId(`cartao-${id}`);
      expect(cartao).toHaveAttribute("data-situacao", "sem-dados");
      expect(cartao.textContent).not.toMatch(/\d/);
    }
    expect(screen.queryByTestId("faixa-demo")).toBeNull();
  });

  it("reage a um evento da fonte e ao status da conexão", async () => {
    const f = fonteFalsa([bolsao("A", 1, "111"), bolsao("C", 2, null), bolsao("H", 3, "0000000000")]);
    render(<PainelVagas configuracao={{ url: "https://x.supabase.co", chaveAnon: "chave-de-teste" }} fonte={f.fonte} modoInicial="supabase" />);

    await screen.findAllByText("LOTADO");
    expect(screen.getByTestId("cartao-C")).toHaveAttribute("data-situacao", "sem-dados");
    expect(screen.getByTestId("cartao-H")).toHaveAttribute("data-situacao", "livre");

    act(() => f.status("ao-vivo"));
    expect(screen.getByTestId("status-conexao")).toHaveAttribute("data-status", "ao-vivo");
    expect(f.fonte.carregar).toHaveBeenCalledTimes(2);

    act(() => f.mudar(bolsao("A", 1, "001")));
    expect(screen.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "poucas");
    expect(screen.getByTestId("cartao-A")).toHaveTextContent("2");

    act(() => f.status("reconectando"));
    expect(screen.getByTestId("status-conexao")).toHaveAttribute("data-status", "reconectando");
  });

  it("dado que chega com 31 s já aparece como SEM DADOS", async () => {
    const f = fonteFalsa([bolsao("A", 1, "0000000000", 31_000), bolsao("C", 2, "0000000000", 29_000), bolsao("H", 3, null)]);
    render(<PainelVagas configuracao={{ url: "https://x.supabase.co", chaveAnon: "chave-de-teste" }} fonte={f.fonte} modoInicial="supabase" />);
    await screen.findByText("10 de 10 livres");
    expect(screen.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "sem-dados");
    expect(screen.getByTestId("cartao-C")).toHaveAttribute("data-situacao", "livre");
  });
});
