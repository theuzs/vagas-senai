import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Bolsao, FonteVagas, StatusConexao } from "@/lib/vagas/tipos";
import { CartaoBolsao } from "./cartao-bolsao";
import { GradeVagas } from "./grade-vagas";
import { PainelVagas } from "./painel-vagas";

afterEach(() => {
  vi.useRealTimers();
});

function bolsao(id: string, ordem: number, estados: string | null, msAtras = 0, especiais: Bolsao["especiais"] = {}): Bolsao {
  const vagas = estados === null ? null : [...estados].map((c) => c === "1");
  return {
    id,
    nome: `Bloco ${id}`,
    ordem,
    total_vagas: vagas?.length ?? null,
    vagas_livres: vagas ? vagas.filter((v) => !v).length : null,
    vagas,
    especiais,
    atualizado_em: estados === null ? null : new Date(Date.now() - msAtras).toISOString(),
    aviso: null,
    publico: true,
  };
}

function fonteFalsa(inicial: Bolsao[] | (() => Promise<Bolsao[]>)) {
  let aoMudar: ((b: Bolsao) => void) | undefined;
  let aoStatus: ((s: StatusConexao) => void) | undefined;
  const fonte: FonteVagas = {
    carregar: vi.fn(async () => ({ bolsoes: typeof inicial === "function" ? await inicial() : inicial, relogio: { servidorMs: Date.now(), t0: Date.now(), t1: Date.now() } })),
    medirRelogio: vi.fn(async () => ({ servidorMs: Date.now(), t0: Date.now(), t1: Date.now() })),
    assinar: vi.fn((m, s) => {
      aoMudar = m;
      aoStatus = s;
      return () => {};
    }),
  };
  return { fonte, mudar: (b: Bolsao) => aoMudar?.(b), status: (s: StatusConexao) => aoStatus?.(s) };
}

const config = { url: "https://x.supabase.co", chaveAnon: "chave-de-teste" };

describe("PainelVagas", () => {
  it("sem configuração mostra o aviso, SEM DADOS em tudo e nenhum número", () => {
    render(<PainelVagas configuracao={null} />);
    const aviso = screen.getByTestId("aviso-configuracao");
    expect(aviso).toHaveTextContent("erro de configuração");
    expect(screen.getByTestId("status-conexao")).toHaveTextContent("Fora do ar");
    expect(aviso.querySelector("details")).toHaveTextContent("NEXT_PUBLIC_SUPABASE_URL");
    expect(aviso.textContent!.replace(aviso.querySelector("details")!.textContent!, "")).not.toMatch(/NEXT_PUBLIC/);
    expect(screen.getByTestId("status-conexao")).toHaveAttribute("data-status", "sem-configuracao");
    for (const id of ["A", "C", "H"]) {
      const cartao = screen.getByTestId(`cartao-${id}`);
      expect(cartao).toHaveAttribute("data-situacao", "sem-dados");
      expect(cartao.textContent).not.toMatch(/\d/);
    }
    expect(screen.queryByTestId("faixa-demo")).toBeNull();
    expect(screen.queryByTestId("resumo")).toBeNull();
  });

  it("reage a um evento da fonte e ao status da conexão", async () => {
    const f = fonteFalsa([bolsao("A", 1, "111"), bolsao("C", 2, null), bolsao("H", 3, "0000000000")]);
    render(<PainelVagas configuracao={config} fonte={f.fonte} modoInicial="supabase" />);

    await screen.findAllByText("LOTADO");
    expect(screen.getByTestId("cartao-C")).toHaveAttribute("data-situacao", "sem-dados");
    expect(screen.getByTestId("cartao-H")).toHaveAttribute("data-situacao", "livre");

    act(() => f.status("ao-vivo"));
    expect(screen.getByTestId("status-conexao")).toHaveAttribute("data-status", "ao-vivo");
    expect(screen.getByTestId("status-conexao")).toHaveAttribute("data-indicador", "ao-vivo");
    expect(f.fonte.carregar).toHaveBeenCalledTimes(2);

    act(() => f.mudar(bolsao("A", 1, "001")));
    expect(screen.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "poucas");
    expect(screen.getByTestId("cartao-A")).toHaveTextContent("2");
    expect(screen.getByTestId("cartao-A")).toHaveTextContent("Poucas");

    act(() => f.status("reconectando"));
    expect(screen.getByTestId("status-conexao")).toHaveAttribute("data-status", "reconectando");
  });

  it("dado que chega com 31 s já aparece como SEM DADOS", async () => {
    const f = fonteFalsa([bolsao("A", 1, "0000000000", 31_000), bolsao("C", 2, "0000000000", 29_000), bolsao("H", 3, null)]);
    render(<PainelVagas configuracao={config} fonte={f.fonte} modoInicial="supabase" />);
    await screen.findByText("10 livres de 10");
    expect(screen.getByTestId("cartao-A")).toHaveAttribute("data-situacao", "sem-dados");
    expect(screen.getByTestId("cartao-C")).toHaveAttribute("data-situacao", "livre");
  });

  it("a leitura falhada é repetida depois de 5 s, e com a aba oculta não é", async () => {
    vi.useFakeTimers();
    const t0 = Date.now();
    const chamadas: number[] = [];
    const fonte: FonteVagas = {
      carregar: async () => {
        chamadas.push(Date.now() - t0);
        if (chamadas.length === 1) throw new Error("rede");
        return { bolsoes: [bolsao("A", 1, "000")], relogio: null };
      },
      medirRelogio: async () => null,
      assinar: () => () => {},
    };
    render(<PainelVagas configuracao={config} fonte={fonte} modoInicial="supabase" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(chamadas).toEqual([0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100);
    });
    expect(chamadas).toEqual([0, 5000]);

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(chamadas).toEqual([0, 5000]);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("o anunciador fala só quando a situação muda", async () => {
    const f = fonteFalsa([bolsao("A", 1, "0000000000000"), bolsao("C", 2, "1111"), bolsao("H", 3, "0000000000")]);
    render(<PainelVagas configuracao={config} fonte={f.fonte} modoInicial="supabase" />);
    await screen.findAllByText("LOTADO");
    expect(screen.getByTestId("anunciador")).toHaveTextContent("");
    act(() => f.mudar(bolsao("A", 1, "0000000000001")));
    expect(screen.getByTestId("anunciador")).toHaveTextContent("");
    act(() => f.mudar(bolsao("H", 3, "0000000000", 31_000)));
    expect(screen.getByTestId("anunciador")).toHaveTextContent("Bloco H sem dados. Confira no local.");
  });
});

describe("CartaoBolsao", () => {
  it("nomes acessíveis seguem o texto visível", () => {
    const { rerender } = render(<CartaoBolsao bolsao={bolsao("C", 2, "0011")} situacao="poucas" />);
    expect(screen.getByRole("link", { name: "Bloco C 2 livres, poucas vagas" })).toBeInTheDocument();
    expect(screen.getByTestId("cartao-C")).toHaveTextContent("Poucas");
    rerender(<CartaoBolsao bolsao={bolsao("C", 2, "1111")} situacao="lotado" />);
    expect(screen.getByRole("link", { name: "Bloco C 0 lotado" })).toBeInTheDocument();
    expect(screen.getByTestId("cartao-C").querySelector("[data-anim]")).toHaveAttribute("data-anim", "desceu");
    rerender(<CartaoBolsao bolsao={bolsao("H", 3, null)} situacao="sem-dados" />);
    expect(screen.getByRole("link", { name: "Bloco H sem dados" })).toBeInTheDocument();
    expect(screen.getByTestId("cartao-H").textContent).not.toMatch(/\d/);
    expect(screen.getByTestId("cartao-H").querySelector("[data-anim]")).toBeNull();
    rerender(<CartaoBolsao bolsao={bolsao("A", 1, "00000000000000", 0, { pcd: [0, 1] })} situacao="livre" />);
    expect(screen.getByRole("link", { name: "Bloco A 12 livres, mais 2 especiais livres" })).toBeInTheDocument();
    expect(screen.getByTestId("cartao-A")).toHaveTextContent("+2 especiais");
  });

  it("anima para cima e para baixo", () => {
    const { rerender } = render(<CartaoBolsao bolsao={bolsao("A", 1, "00000111")} situacao="livre" />);
    rerender(<CartaoBolsao bolsao={bolsao("A", 1, "00000011")} situacao="livre" />);
    expect(screen.getByTestId("cartao-A").querySelector("[data-anim]")).toHaveAttribute("data-anim", "subiu");
    rerender(<CartaoBolsao bolsao={bolsao("A", 1, "00001111")} situacao="livre" />);
    expect(screen.getByTestId("cartao-A").querySelector("[data-anim]")).toHaveAttribute("data-anim", "desceu");
  });
});

describe("GradeVagas", () => {
  it("tem nome acessível com total, livres e especiais", () => {
    render(<GradeVagas bolsao={bolsao("A", 1, "0110100", 0, { pcd: [0, 1] })} situacao="livre" textoSemDados="" />);
    expect(screen.getByRole("img", { name: /Vagas do Bloco A: 4 de 7 livres\. PCD: 1 livre\./ })).toBeInTheDocument();
  });
});
