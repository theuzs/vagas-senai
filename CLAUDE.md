# CLAUDE.md

Monitor das vagas de estacionamento dos bolsões A, C e H do SENAI Blumenau no período noturno. O projeto é do João Victor Fagundes Miranda, aluno do SENAI Itumbiara, e concorre a um prêmio do SENAI com prazo em novembro de 2026.

- Problema original e mapa do campus: `docs/PROBLEMA.md`
- O que construir: `docs/ESPECIFICACAO.md`
- Ordem de trabalho e critérios de pronto: `docs/PLANO.md`
- Decisões e perguntas em aberto: `docs/DECISOES.md`
- Lista de melhorias de UX e UI (implementada em 15/10/2026): `docs/MELHORIAS-UX.md`

Caminho dos dados: um ESP32 por bolsão lê um sensor por vaga e, pelo Wi-Fi do campus, chama `vagas.publicar` no Supabase a cada 10 s (`firmware/bolsao/bolsao.ino`, um arquivo só) → tabela `vagas.bolsoes` → Realtime → página em `vagas.rubysistemas.com.br`. A variante com central + ponte (`firmware/central`, `firmware/ponte`) fica guardada para o caso de os nós voltarem a usar ESP-NOW.

## Regra do produto acima de todas

Bolsão sem dado recente nunca mostra número. Se `atualizado_em` for nulo ou tiver mais de 30 s pela hora do servidor, a página mostra SEM DADOS em alerta. Zero só aparece com dado fresco. A regra vale para o estado inicial, para queda do Realtime, para erro de rede e para a grade de vagas: sem dado, nenhuma vaga aparece como livre nem como ocupada.

## Ambiente compartilhado

O domínio e a conta Vercel são os mesmos do WebSiteFoods, que tem uma loja real em produção. O Supabase é um projeto próprio do SENAI (`hsfsejmhltkxiwniuunf`, decisão 32 em `docs/DECISOES.md`).

- Tudo deste projeto fica no schema `vagas`. Nunca crie nada em `public` nem altere objetos fora de `vagas`.
- Nunca use `supabase link`, `supabase db push` nem `supabase migration`. As migrations daqui ficam em `db/migracoes` e são aplicadas por `npm run db:aplicar`, que registra o que já rodou em `vagas.migracoes`.
- A chave `service_role` não é usada neste projeto: nem no firmware, nem na Vercel, nem em scripts.
- O ESP32 nunca fica exposto na internet (nada de port forwarding). Ele só faz requisições de saída.
- O repositório do WebSiteFoods (`../WebSiteFoods`) pode ser lido como referência, mas não deve ser alterado.

## Stack

- Next.js (App Router) + TypeScript estrito + Tailwind, nas mesmas versões do WebSiteFoods. A página não tem código de servidor nem segredo: lê com supabase-js usando a chave pública.
- Supabase: Postgres e Realtime (`postgres_changes` em `vagas.bolsoes`).
- Testes: Vitest (regras e componentes), Vitest com Postgres embutido para banco e RLS (sem Docker) e Playwright (E2E).
- Firmware: Arduino C++ para ESP32 em `firmware/`, no estilo do código do João: um arquivo, configuração em `const` no topo, sem `config.h`.

## Comandos

- `npm run dev`: página em http://localhost:3000 (`?demo=1` usa dados simulados).
- `npm run check`: lint + typecheck + testes unitários e de banco.
- `npm run test:db`: só testes de banco (Postgres embutido efêmero).
- `npm run test:e2e`: Playwright. Prefira rodar contra build de produção (`npm run build` e `npx next start -p 3001`), porque o servidor de dev às vezes trava.
- `npm run db:aplicar`: aplica `db/migracoes` no banco de `DATABASE_URL`.
- `npm run token:gerar`: cria o token da central e o SQL com o hash.
- `npm run simular:ponte`: faz o papel da ponte e publica dados de teste no Supabase (o token `simulador` precisa estar ativo).
- `npm run firmware:placas`: gera os arquivos das placas com os tokens do `.env.local`; `npm run firmware:compilar`: compila tudo com o arduino-cli.

## Textos

Português do Brasil, frases curtas, botões dizendo a ação. O texto não pode ter cara de IA: nada de travessão no meio da frase, "não é X, é Y", frase curta de efeito depois do ponto, pergunta seguida da resposta, frase sem sujeito, trio "sem X, sem Y, sem Z", título-slogan ou "de verdade". Escreva com sujeito e verbo e prefira fato a adjetivo.

## Next.js

Esta versão do Next tem mudanças grandes em relação ao que você conhece. Antes de escrever código do Next, leia o guia em `node_modules/next/dist/docs/` e respeite os avisos de descontinuação.

## Decisões

Registre decisões e desvios da especificação em `docs/DECISOES.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
