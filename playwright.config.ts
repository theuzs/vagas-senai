import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Por padrão sobe `next dev` na porta 3000. Para rodar contra um build de produção
 * (preferido: o servidor de dev às vezes trava), rode `npm run build` e
 * `npx next start -p 3001`, e exporte E2E_BASE_URL=http://localhost:3001.
 *
 * Os testes não dependem do Supabase: eles respondem a API REST com `page.route`.
 * As variáveis NEXT_PUBLIC_* precisam existir no build (qualquer valor com a forma certa).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const usaServidorExterno = !!process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: join(tmpdir(), "vagas-senai", "playwright"),
  timeout: 60_000,
  retries: 0,
  workers: 1,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    {
      name: "celular",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 360, height: 740 },
      },
    },
  ],
  webServer: usaServidorExterno
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://teste-e2e.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "chave-anon-de-teste",
        },
      },
});
