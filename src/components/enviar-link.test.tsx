import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENDERECO_PUBLICO } from "@/lib/endereco";
import { EnviarLink } from "./enviar-link";

const share = vi.fn<(dados: ShareData) => Promise<void>>(async () => {});
const writeText = vi.fn(async () => {});

beforeEach(() => {
  vi.useFakeTimers();
  share.mockClear();
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
});

async function clicar() {
  await act(async () => {
    screen.getByRole("button", { name: "Enviar o link" }).click();
    await Promise.resolve();
  });
}

describe("EnviarLink", () => {
  it("com share, manda o título, o texto e o endereço público", async () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<EnviarLink />);
    await clicar();
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ title: "Vagas SENAI Blumenau", text: "Vagas livres agora nos blocos A, C e H do SENAI Blumenau.", url: ENDERECO_PUBLICO });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByTestId("link-copiado")).toHaveTextContent("");
  });

  it("sem share, copia o endereço e avisa por 3 s", async () => {
    render(<EnviarLink />);
    await clicar();
    expect(writeText).toHaveBeenCalledWith(ENDERECO_PUBLICO);
    expect(screen.getByTestId("link-copiado")).toHaveTextContent("Link copiado.");
    expect(screen.getByTestId("link-copiado")).toHaveAttribute("aria-live", "polite");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(screen.getByTestId("link-copiado")).toHaveTextContent("");
  });

  it("se a folha de compartilhar falhar, copia o endereço", async () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn(async () => Promise.reject(new Error("cancelou"))) });
    render(<EnviarLink />);
    await clicar();
    expect(writeText).toHaveBeenCalledWith(ENDERECO_PUBLICO);
  });
});
