import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAVE_TENTATIVAS, ErroTela } from "./erro-tela";

const { servidorResponde } = vi.hoisted(() => ({ servidorResponde: vi.fn(async () => false) }));
vi.mock("@/lib/vagas/servidor-responde", () => ({ servidorResponde }));

const erro = new Error("quebrou");
const reload = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  sessionStorage.clear();
  servidorResponde.mockReset();
  servidorResponde.mockResolvedValue(false);
  reload.mockReset();
  vi.stubGlobal("location", { ...window.location, pathname: "/guarita", reload });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function avancar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("ErroTela", () => {
  it("na guarita, espera 30 s, chama retry uma vez e fala com o vigia", async () => {
    const retry = vi.fn();
    render(<ErroTela error={erro} retry={retry} titulo="A tela da guarita parou por um erro." intervaloMs={30_000} guarita />);
    expect(screen.getByTestId("erro-tela")).toHaveTextContent("Não diga ao motorista que está lotado. A tela tenta de novo em 30 s.");
    expect(screen.getByTestId("erro-tela")).toHaveTextContent("Tentativa 1 de 3");
    expect(screen.getByTestId("erro-tela").textContent).not.toMatch(/\d+ (vagas?|livres?)/);
    await avancar(29_000);
    expect(retry).not.toHaveBeenCalled();
    await avancar(1_000);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CHAVE_TENTATIVAS)).toBe("1");
    expect(console.error).toHaveBeenCalledWith(erro);
  });

  it("fora da guarita, diz que a página tenta em 10 segundos", () => {
    render(<ErroTela error={erro} retry={vi.fn()} titulo="A página parou de funcionar." intervaloMs={10_000} />);
    expect(screen.getByTestId("erro-tela")).toHaveTextContent("A página tenta de novo em 10 segundos.");
    expect(screen.getByTestId("erro-tela")).not.toHaveTextContent("motorista");
  });

  it("na terceira tentativa com o servidor fora, não recarrega e tenta de novo em 60 s", async () => {
    sessionStorage.setItem(CHAVE_TENTATIVAS, "2");
    const retry = vi.fn();
    render(<ErroTela error={erro} retry={retry} titulo="t" intervaloMs={10_000} />);
    expect(screen.getByTestId("erro-tela")).toHaveTextContent("Tentativa 3 de 3");
    await avancar(10_000);
    expect(servidorResponde).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    await avancar(60_000);
    expect(servidorResponde).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it("na terceira tentativa com o servidor respondendo, recarrega uma vez e zera o contador", async () => {
    sessionStorage.setItem(CHAVE_TENTATIVAS, "2");
    servidorResponde.mockResolvedValue(true);
    render(<ErroTela error={erro} retry={vi.fn()} titulo="t" intervaloMs={10_000} />);
    await avancar(10_000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CHAVE_TENTATIVAS)).toBe("0");
  });

  it("com sessionStorage que lança erro, renderiza e chama retry", async () => {
    const quebrado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    vi.stubGlobal("sessionStorage", quebrado);
    const retry = vi.fn();
    render(<ErroTela error={erro} retry={retry} titulo="t" intervaloMs={10_000} />);
    expect(screen.getByTestId("erro-tela")).toHaveTextContent("Tentativa 1 de 3");
    await avancar(10_000);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("o botão Tentar agora chama retry na hora", () => {
    const retry = vi.fn();
    render(<ErroTela error={erro} retry={retry} titulo="t" intervaloMs={10_000} />);
    act(() => screen.getByRole("button", { name: "Tentar agora" }).click());
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
