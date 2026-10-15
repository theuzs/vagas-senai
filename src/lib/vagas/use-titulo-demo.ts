"use client";

import { useEffect } from "react";
import type { Modo } from "./use-vagas";

/**
 * Na demonstração, o título da aba avisa, sem número (UX-34). O Next repõe o título
 * dos metadados depois da hidratação, por isso um observador o corrige quando muda.
 */
export function useTituloDemo(modo: Modo, nome: string) {
  useEffect(() => {
    if (modo !== "demo") return;
    const desejado = `Demonstração · ${nome}`;
    const anterior = document.title;
    const corrigir = () => {
      if (document.title !== desejado) document.title = desejado;
    };
    corrigir();
    const obs = new MutationObserver(corrigir);
    obs.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      obs.disconnect();
      document.title = anterior;
    };
  }, [modo, nome]);
}
