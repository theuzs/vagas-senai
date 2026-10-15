import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página não encontrada",
};

export default function NaoEncontrada() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-black leading-tight">Esta página não existe.</h1>
      <p className="text-texto-secundario">Confira o endereço ou abra a página das vagas.</p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-borda bg-superficie px-5 font-semibold hover:bg-superficie-2">
        Ver as vagas
      </Link>
    </main>
  );
}
