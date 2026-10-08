import type { Metadata } from "next";
import { TelaGuarita } from "@/components/tela-guarita";
import { configuracaoSupabase } from "@/lib/vagas/configuracao";

export const metadata: Metadata = {
  title: "Guarita · Vagas SENAI Blumenau",
  robots: { index: false },
};

export default function PaginaGuarita() {
  return <TelaGuarita configuracao={configuracaoSupabase()} />;
}
