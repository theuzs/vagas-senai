"use client";

import { useEffect, useState } from "react";

const CHAVE_VISITAS = "vagas.visitas";
const CHAVE_FECHOU = "vagas.convite-fechado";

function ehIphone(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function instalado(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Convite de instalação só no iPhone (decisão D17), a partir da segunda visita.
 * Sem localStorage não aparece. Nunca ouve beforeinstallprompt.
 */
export function ConviteInstalar() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    try {
      if (!ehIphone() || instalado()) return;
      if (localStorage.getItem(CHAVE_FECHOU) === "1") return;
      const visitas = Number(localStorage.getItem(CHAVE_VISITAS) ?? "0") + 1;
      localStorage.setItem(CHAVE_VISITAS, String(visitas));
      // Só o navegador sabe se é iPhone e quantas visitas houve; por isso a decisão fica no efeito.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (visitas >= 2) setMostrar(true);
    } catch {
      // sem localStorage: sem convite
    }
  }, []);

  if (!mostrar) return null;
  return (
    <div data-testid="convite-instalar" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border border-borda bg-superficie p-4 text-sm">
      <p>Para abrir as vagas direto da tela inicial, toque em Compartilhar e depois em Adicionar à Tela de Início.</p>
      <button
        type="button"
        onClick={() => {
          setMostrar(false);
          try {
            localStorage.setItem(CHAVE_FECHOU, "1");
          } catch {
            // sem localStorage: fecha só nesta visita
          }
        }}
        className="min-h-11 rounded-lg border border-borda px-3 font-semibold"
      >
        Fechar
      </button>
    </div>
  );
}
