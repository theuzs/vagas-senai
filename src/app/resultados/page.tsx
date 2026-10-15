import type { Metadata } from "next";
import Link from "next/link";
import { TelaResultados } from "@/components/tela-resultados";
import { configuracaoSupabase } from "@/lib/vagas/configuracao";

export const metadata: Metadata = {
  title: "Resultados",
  description: "Quantas vezes um estacionamento lotou enquanto outro tinha vaga, noite a noite.",
};

/** Só histórico, preso à data. Nada aqui diz quantas vagas há agora. */
export default function PaginaResultados() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-black leading-tight">Resultados das noites</h1>
        <p className="text-sm text-texto-secundario">O que os sensores registraram nas noites anteriores, das 18h às 22h30.</p>
      </header>

      <TelaResultados configuracao={configuracaoSupabase()} />

      <footer className="mt-auto flex flex-wrap gap-x-4 pt-4 text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center text-texto-secundario underline">
          Ver as vagas
        </Link>
        <Link href="/como-funciona" className="inline-flex min-h-11 items-center text-texto-secundario underline">
          Como funciona
        </Link>
      </footer>
    </main>
  );
}
