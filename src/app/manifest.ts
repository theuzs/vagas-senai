import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vagas SENAI Blumenau",
    short_name: "Vagas SENAI",
    description: "Vagas livres nos estacionamentos dos blocos A, C e H do SENAI Blumenau.",
    start_url: "/",
    display: "standalone",
    lang: "pt-BR",
    background_color: "#0f1419",
    theme_color: "#0f1419",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/icone-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
