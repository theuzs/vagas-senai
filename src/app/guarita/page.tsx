import type { Metadata } from "next";
import { preconnect, prefetchDNS } from "react-dom";
import { TelaGuarita } from "@/components/tela-guarita";
import { configuracaoSupabase } from "@/lib/vagas/configuracao";

export const metadata: Metadata = {
  title: "Guarita",
  robots: { index: false },
};

export default function PaginaGuarita() {
  const config = configuracaoSupabase();
  if (config) {
    preconnect(config.url, { crossOrigin: "anonymous" });
    prefetchDNS(config.url);
  }
  return (
    <>
      <noscript>
        <p className="rounded-lg border border-sem-dados px-3 py-2 text-sem-dados">Esta página precisa de JavaScript para mostrar as vagas.</p>
      </noscript>
      <TelaGuarita configuracao={config} />
    </>
  );
}
