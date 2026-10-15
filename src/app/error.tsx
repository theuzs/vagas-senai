"use client";

import { ErroTela } from "@/components/erro-tela";

export default function Erro({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErroTela error={error} retry={retry} titulo="A página parou de funcionar." intervaloMs={10_000} />;
}
