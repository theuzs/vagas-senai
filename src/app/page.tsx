import { preconnect, prefetchDNS } from "react-dom";
import { ConviteInstalar } from "@/components/convite-instalar";
import { PainelVagas } from "@/components/painel-vagas";
import { configuracaoSupabase } from "@/lib/vagas/configuracao";

export default function Pagina() {
  const config = configuracaoSupabase();
  if (config) {
    preconnect(config.url, { crossOrigin: "anonymous" });
    prefetchDNS(config.url);
  }
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pt-3 pb-5 lg:max-w-6xl">
      <noscript>
        <p className="rounded-lg border border-sem-dados px-3 py-2 text-sem-dados">Esta página precisa de JavaScript para mostrar as vagas.</p>
      </noscript>

      <PainelVagas configuracao={config} />

      <ConviteInstalar />

      <footer className="mt-auto flex flex-col gap-3 pt-4 text-xs text-texto-secundario">
        <p>
          Cada vaga tem um sensor, e os números desta página vêm desses sensores e mudam sozinhos. Quando o dado de um estacionamento tem mais de 30 segundos, a página mostra SEM
          DADOS no lugar do número.
        </p>
        <nav aria-label="Outras páginas" className="flex flex-wrap gap-x-4 gap-y-1">
          <a href="/como-funciona" className="inline-flex min-h-11 items-center underline">
            Como funciona
          </a>
          <a href="/resultados" className="inline-flex min-h-11 items-center underline">
            Resultados
          </a>
          <a href="/guarita" className="inline-flex min-h-11 items-center underline">
            Tela da guarita
          </a>
          <a href="/qr" className="inline-flex min-h-11 items-center underline">
            Folha do QR code
          </a>
        </nav>
      </footer>
    </main>
  );
}
