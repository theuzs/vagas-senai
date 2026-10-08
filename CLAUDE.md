# CLAUDE.md

Monitor das vagas de estacionamento dos bolsões A, C e H do SENAI Blumenau no período noturno. O projeto é do João, primo do Matheus, e concorre a um prêmio do SENAI com prazo em novembro de 2026.

- Problema original e mapa do campus: `docs/PROBLEMA.md`
- O que construir: `docs/ESPECIFICACAO.md`
- Ordem de trabalho e critérios de pronto: `docs/PLANO.md`
- Decisões e perguntas em aberto: `docs/DECISOES.md`

Caminho dos dados: nós ESP32 (ESP-NOW, 1 s) → central (placa atual) → fio serial → ponte ESP32 (Wi-Fi do campus) → HTTPS a cada 10 s → função `vagas.publicar` no Supabase → tabela `vagas.bolsoes` → Realtime → página em `vagas.rubysistemas.com.br`.

## Regra do produto acima de todas

Bolsão sem dado recente nunca mostra número. Se `atualizado_em` for nulo ou tiver mais de 30 s pela hora do servidor, a página mostra SEM DADOS em alerta. Zero só aparece com dado fresco. A regra vale para o estado inicial, para queda do Realtime, para erro de rede e para a grade de vagas: sem dado, nenhuma vaga aparece como livre nem como ocupada.

## Ambiente compartilhado

O Supabase, o domínio e a conta Vercel são os mesmos do WebSiteFoods, que tem uma loja real em produção.

- Tudo deste projeto fica no schema `vagas`. Nunca crie nada em `public` nem altere objetos fora de `vagas`.
- Nunca use `supabase link`, `supabase db push` nem `supabase migration`. A tabela de histórico de migrations do Supabase pertence ao WebSiteFoods. As migrations daqui ficam em `db/migracoes` e são aplicadas por `npm run db:aplicar`, que registra o que já rodou em `vagas.migracoes`.
- A chave `service_role` não é usada neste projeto: nem no firmware, nem na Vercel, nem em scripts.
- O ESP32 nunca fica exposto na internet (nada de port forwarding). Ele só faz requisições de saída.
- A comunicação ESP-NOW entre nós e central não muda.
- O repositório do WebSiteFoods (`../WebSiteFoods`) pode ser lido como referência, mas não deve ser alterado.

## Stack

- Next.js (App Router) + TypeScript estrito + Tailwind, nas mesmas versões do WebSiteFoods. A página não tem código de servidor nem segredo: lê com supabase-js usando a chave pública.
- Supabase: Postgres e Realtime (`postgres_changes` em `vagas.bolsoes`).
- Testes: Vitest (regras e componentes), Vitest com Postgres embutido para banco e RLS (sem Docker) e Playwright (E2E).
- Firmware: Arduino C++ para ESP32 em `firmware/`.

## Comandos

- `npm run dev`: página em http://localhost:3000 (`?demo=1` usa dados simulados).
- `npm run check`: lint + typecheck + testes unitários e de banco.
- `npm run test:db`: só testes de banco (Postgres embutido efêmero).
- `npm run test:e2e`: Playwright. Prefira rodar contra build de produção (`npm run build` e `npx next start -p 3001`), porque o servidor de dev às vezes trava.
- `npm run db:aplicar`: aplica `db/migracoes` no banco de `DATABASE_URL`.
- `npm run token:gerar`: cria o token da central e o SQL com o hash.
- `npm run simular:ponte`: faz o papel da ponte e publica dados de teste no Supabase.

## Textos

Português do Brasil, frases curtas, botões dizendo a ação. O texto não pode ter cara de IA: nada de travessão no meio da frase, "não é X, é Y", frase curta de efeito depois do ponto, pergunta seguida da resposta, frase sem sujeito, trio "sem X, sem Y, sem Z", título-slogan ou "de verdade". Escreva com sujeito e verbo e prefira fato a adjetivo.

## Next.js

Esta versão do Next tem mudanças grandes em relação ao que você conhece. Antes de escrever código do Next, leia o guia em `node_modules/next/dist/docs/` e respeite os avisos de descontinuação.

## Decisões

Registre decisões e desvios da especificação em `docs/DECISOES.md`.
