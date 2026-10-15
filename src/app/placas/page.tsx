import type { Metadata } from "next";
import { TelaPlacas } from "@/components/tela-placas";
import { configuracaoSupabase } from "@/lib/vagas/configuracao";

export const metadata: Metadata = {
  title: "Placas",
  robots: { index: false },
};

export default function PaginaPlacas() {
  return <TelaPlacas configuracao={configuracaoSupabase()} />;
}
