"use client";

import { ErroTela } from "@/components/erro-tela";
import "./globals.css";

/** Substitui o layout raiz quando ele quebra; por isso traz html, body e os estilos. */
export default function ErroGlobal({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="flex min-h-full flex-col">
        <title>Vagas SENAI Blumenau</title>
        <ErroTela error={error} retry={retry} titulo="A página parou por um erro." intervaloMs={10_000} />
      </body>
    </html>
  );
}
