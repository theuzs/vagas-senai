import { PainelVagas } from "@/components/painel-vagas";
import { configuracaoSupabase } from "@/lib/vagas/configuracao";

export default function Pagina() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-black leading-tight">Vagas SENAI Blumenau</h1>
        <p className="text-sm text-texto-secundario">Vagas livres agora nos estacionamentos dos blocos A, C e H.</p>
      </header>

      <PainelVagas configuracao={configuracaoSupabase()} />

      <footer className="mt-auto pt-4 text-xs text-texto-secundario">
        <p>Cada vaga tem um sensor. Os números vêm dele e mudam sozinhos nesta tela. Quando um bolsão fica sem dado por 30 segundos, a página avisa em vez de mostrar um número.</p>
      </footer>
    </main>
  );
}
