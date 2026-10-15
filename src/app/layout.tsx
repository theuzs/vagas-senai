import type { Metadata, Viewport } from "next";
import { Analise } from "@/components/analise";
import { ENDERECO_PUBLICO } from "@/lib/endereco";
import "./globals.css";

const DESCRICAO = "Vagas livres agora nos estacionamentos dos blocos A, C e H do SENAI Blumenau, contadas por um sensor em cada vaga.";

export const metadata: Metadata = {
  metadataBase: new URL(ENDERECO_PUBLICO),
  title: { default: "Vagas SENAI Blumenau", template: "%s · Vagas SENAI Blumenau" },
  description: DESCRICAO,
  appleWebApp: { capable: true, statusBarStyle: "black", title: "Vagas SENAI" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Vagas SENAI Blumenau",
    title: "Vagas SENAI Blumenau",
    description: "Vagas livres agora nos estacionamentos dos blocos A, C e H do SENAI Blumenau.",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1419",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="flex min-h-full flex-col">
        {children}
        <Analise />
      </body>
    </html>
  );
}
