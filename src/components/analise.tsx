"use client";

import { Analytics } from "@vercel/analytics/next";
import { filtrarEvento } from "@/lib/analise";

/** Contagem de acessos sem cookies (UX-60). O filtro tira guarita, demonstração e maquete. */
export function Analise() {
  return <Analytics beforeSend={filtrarEvento} />;
}
