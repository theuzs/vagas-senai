# Plano da noite

Você vai trabalhar sozinho até de manhã. O Matheus confirma as decisões no dia seguinte. Leia antes `CLAUDE.md`, `docs/PROBLEMA.md`, `docs/ESPECIFICACAO.md` e `docs/DECISOES.md`.

## Regras da noite

- Não pare para perguntar. Quando faltar informação, escolha a opção mais simples que não feche portas, registre em `docs/DECISOES.md` na seção "Decididas durante a noite" e siga.
- Faça um commit ao fim de cada etapa, com mensagem curta em português e a linha `Co-Authored-By` que o Claude Code indicar. Se o remoto `origin` existir, dê push em `main`, porque o repositório é privado.
- Se uma etapa travar por muito tempo, registre o motivo no relatório e passe para a próxima.
- Você pode instalar pacotes npm e também o `arduino-cli`, o core `esp32:esp32` e a biblioteca de LCD I2C, só para compilar o firmware. Para o `arduino-cli`, prefira baixar o zip do Windows 64 bits da página de releases do projeto no GitHub e extrair em `%LOCALAPPDATA%\arduino-cli`. Esse caminho não pede administrador. Não use nada que abra janela de permissão do Windows, porque ninguém vai estar acordado para clicar.
- Se não houver remoto (`git remote -v` vazio), não crie nenhum: faça só commits locais e o Matheus liga o remoto de manhã.
- Não faça:
  - conexão com o Supabase de produção (não existe `.env` com chave real, e isso é de propósito);
  - deploy na Vercel ou mudança de DNS;
  - commit de `.env*`, `firmware/**/config.h` ou token;
  - mudança no repositório do WebSiteFoods ou na comunicação ESP-NOW dos nós.

## Etapas

Cada etapa tem um "pronto quando". Só passe para a próxima quando ele valer ou quando o motivo de não valer estiver no relatório.

### 1. Base do projeto

- `create-next-app` não aceita pasta com arquivos. Gere o projeto numa pasta temporária e mova para cá, sem sobrescrever `CLAUDE.md`, `README.md`, `.gitignore` e `docs/`. Se o gerador criar um `CLAUDE.md` ou `AGENTS.md` com o aviso do Next, junte o aviso ao fim do nosso `CLAUDE.md`.
- Use as mesmas versões do `../WebSiteFoods/package.json`: next 16.3.x, react 19.2.x, tailwind 4, typescript 5, vitest, @playwright/test, supabase-js, zod, tsx, postgres, embedded-postgres.
- TypeScript estrito, ESLint, Vitest com dois projetos (`unit` e `db`), Playwright.
- Scripts no `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:db`, `test:e2e`, `check`, `db:aplicar`, `token:gerar`, `simular:ponte`.
- `.env.example` com as variáveis da seção 6 da especificação, valores vazios.

Pronto quando `npm run check` e `npm run build` passam.

### 2. Banco

- `db/migracoes/0001_vagas.sql` conforme a seção 2 da especificação.
- `tests/db/shim-supabase.sql`: roles `anon`, `authenticated` e `service_role` e a publicação `supabase_realtime`. Use como base `../WebSiteFoods/tests/db/shim-supabase.sql`, sem a parte de `auth` e `storage`. Não dê privilégio padrão no schema `vagas`, porque o Supabase também não dá.
- `tests/db/global-setup.ts` com Postgres embutido em porta própria (54200 + pid % 90) e pasta em `os.tmpdir()/vagas-senai/`, igual ao do WebSiteFoods.

Pronto quando os testes de banco cobrem:
- a migration roda do zero;
- os três bolsões nascem com estado nulo;
- `anon` lê `bolsoes`, mas não consegue inserir, alterar nem apagar;
- `anon` não lê `centrais` nem `historico`;
- `publicar` sem token, com token curto, errado ou de central inativa falha com `28000`;
- `publicar` com bolsão desconhecido, caractere fora de `0`/`1`, texto vazio ou com mais de 500 caracteres falha com `22023` e não grava nada;
- `publicar` válido grava `vagas`, `total_vagas`, `vagas_livres` e `atualizado_em` e não toca no bolsão ausente;
- duas chamadas na mesma janela de 5 min geram uma linha só em `historico`;
- `agora()` funciona como `anon`;
- `bolsoes` está na publicação `supabase_realtime`.

### 3. Regras da página

Funções puras da seção 3.2 em `src/lib/vagas/`.

Pronto quando os testes unitários cobrem cada caminho de `situacao` (nulos, 29 s, 31 s, relógio adiantado, tamanho incoerente, zero fresco, limite de "poucas" com 5, 40 e 500 vagas), o cálculo do deslocamento do relógio e os textos de idade.

### 4. Página

Seções 3.1 e 3.3 da especificação.

Pronto quando o E2E (Playwright, viewport 360 × 740) cobre:
- antes do primeiro dado, todos os cartões mostram SEM DADOS e nenhum número;
- com dado fresco, o cartão mostra o número certo e a grade tem as cores certas;
- adiantando o relógio em 31 s (`page.clock`), o cartão vira SEM DADOS e a grade fica neutra;
- zero com dado fresco mostra LOTADO;
- os três cartões aparecem lado a lado em 360 px sem rolagem horizontal;
- `?demo=1` mostra a faixa de demonstração e, sem esse parâmetro, nada é simulado;
- sem variáveis de ambiente, a página mostra SEM DADOS e o aviso de configuração.

Para testar a fonte do Supabase sem o Supabase, use `page.route` para responder o REST (`/rest/v1/bolsoes` e `/rest/v1/rpc/agora`) e, se der, `page.routeWebSocket` para simular o Realtime (resposta ao `phx_join` e um evento `postgres_changes`). Se simular o protocolo do Realtime ficar complicado demais, teste a reação a eventos com uma fonte falsa em teste de componente e registre isso no relatório.

### 5. PWA

Seção 3.4. Pronto quando `/manifest.webmanifest` responde com os ícones certos e os arquivos de ícone existem.

### 6. Firmware

Seção 4 inteira: `firmware/ponte/`, `firmware/central/`, `firmware/LEIAME.md` com a ligação dos fios, os passos para gravar e a alternativa de placa única.

- Confira no core instalado a API de WPA2-Enterprise e do watchdog, porque elas mudaram entre as versões 2.x e 3.x do arduino-esp32.
- O `.gitignore` precisa cobrir `firmware/**/config.h`.

Pronto quando `arduino-cli compile --fqbn esp32:esp32:esp32 firmware/ponte` passa com um `config.h` copiado do exemplo, com `USAR_LCD` ligado e desligado. Se o `arduino-cli` não instalar, registre no relatório que o firmware não foi compilado.

### 7. Scripts

Seção 5. Pronto quando:
- `db:aplicar` testado contra o Postgres embutido aplica tudo na primeira vez, não faz nada na segunda e `--conferir` lista certo;
- `token:gerar` gera um token cujo hash bate com o que a função `publicar` aceita (teste de banco);
- `simular:ponte --seco` mostra um payload que a função aceita.

### 8. Documentação

- `README.md`: o que é, como rodar local (`npm run dev` com `?demo=1`), como aplicar a migration, o que colar no firmware, como testar o caminho completo (simulador, depois a ponte de verdade).
- `docs/DEPLOY.md`: seção 6 da especificação passo a passo, para alguém iniciante seguir.

### 9. Extras, se sobrar tempo

Na ordem da seção 3.5: mapa esquemático, `/qr`, `?painel=1`. Cada um com pelo menos um teste E2E.

### 10. Relatório

Escreva `docs/RELATORIO-NOITE.md` e faça o último commit:
- o que ficou pronto, etapa por etapa, com a saída resumida de `npm run check`, `npm run test:e2e` e da compilação do firmware;
- o que não ficou pronto e por quê;
- decisões tomadas durante a noite;
- o que o Matheus precisa fazer de manhã, em passos curtos.
