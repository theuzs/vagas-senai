"use client";

import { ErroTela } from "@/components/erro-tela";

export default function ErroGuarita({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErroTela error={error} retry={retry} titulo="A tela da guarita parou por um erro." intervaloMs={30_000} guarita />;
}
