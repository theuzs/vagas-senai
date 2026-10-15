import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    // Aparece no canto da tela da guarita, para saber que versão o PC roda (UX-46).
    NEXT_PUBLIC_VERSAO: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
  },
};

export default nextConfig;
