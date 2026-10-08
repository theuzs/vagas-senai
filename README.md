# Vagas SENAI Blumenau

Monitor das vagas de estacionamento dos bolsões A, C e H do SENAI Blumenau. Cada vaga tem um sensor; um ESP32 por bolsão lê os sensores e publica o estado no Supabase pelo Wi-Fi do campus; a página mostra os três bolsões ao vivo em `vagas.rubysistemas.com.br`.

```
ESP32 do bolsão (Wi-Fi) → Supabase → página → celular
```

Regra principal: bolsão sem dado há mais de 30 s mostra **SEM DADOS**, nunca zero. Zero só aparece com dado fresco, e aí a tela diz LOTADO.

Documentos: [problema](docs/PROBLEMA.md), [especificação](docs/ESPECIFICACAO.md), [decisões](docs/DECISOES.md), [deploy](docs/DEPLOY.md), [firmware](firmware/LEIAME.md).

## Rodar no computador

Precisa de Node 22.

```
npm install --legacy-peer-deps
npm run dev
```

Abra http://localhost:3000/?demo=1 para ver a página com dados simulados (a faixa amarela avisa que é demonstração). Sem `?demo=1` a página lê o Supabase das variáveis de ambiente; copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Testes:

```
npm run check        # lint, typecheck, testes unitários, de componente e de banco (Postgres embutido, sem Docker)
npm run test:e2e     # Playwright; sobe o next dev sozinho e simula o Supabase
```

O E2E é mais estável contra o build de produção: `npm run build`, depois `npx next start -p 3001` em outro terminal e `E2E_BASE_URL=http://localhost:3001 npm run test:e2e`.

## Banco

Tudo fica no schema `vagas` do Supabase: `bolsoes` (estado atual), `centrais` (hash do token de cada central), `historico` (foto a cada 5 min) e as funções `publicar` (única porta de escrita) e `agora` (hora do servidor). As migrations ficam em `db/migracoes`.

Aplicar no Supabase (uma vez, do seu computador):

```
DATABASE_URL="postgres://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:6543/postgres" npm run db:aplicar
```

O script registra o que já rodou em `vagas.migracoes` e não toca em nada fora do schema. Se preferir, cole o conteúdo de `db/migracoes/0001_vagas.sql` no SQL Editor do Supabase. Depois, em Project Settings → Data API → Exposed schemas, acrescente `vagas`.

## Token de cada bolsão

```
npm run token:gerar -- bolsao-a "Bolsão A"
```

Mostra o token (vai para o topo do `bolsao.ino`) e um SQL com o hash (vai para o SQL Editor). Gere um por bolsão (`bolsao-a`, `bolsao-c`, `bolsao-h`): se um ESP32 for levado, só o token dele é trocado. O banco nunca guarda o token em texto. Para trocar, rode de novo: o antigo deixa de valer.

## Firmware

`firmware/bolsao/bolsao.ino` é o arquivo único de cada bolsão: leitura dos sensores (igual ao código original), página local opcional e envio para o Supabase. Preencha o bloco de configuração no topo (`ID_BOLSAO`, pinos, Wi-Fi, URL e chave anon, token) e grave um por bolsão. Não faça commit do arquivo com o token preenchido. Detalhes em `firmware/LEIAME.md`.

## Testar o caminho completo

1. Sem hardware: `TOKEN_CENTRAL=<token> npm run simular:ponte` publica dados aleatórios a cada 10 s. Abra a página no celular e veja os números mudarem. Pare o simulador: em até 30 s os três bolsões viram SEM DADOS. `npm run simular:ponte -- --parar H` deixa só o H sem dado.
2. Com o ESP32 do bolsão: grave o firmware, abra o monitor serial em 115200 e espere `[http] ok`. A página passa a seguir os sensores.

## Variáveis de ambiente

| variável | onde | pode ficar exposta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel, `.env.local`, `bolsao.ino` | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel, `.env.local`, `bolsao.ino` | sim: só lê `vagas.bolsoes` e chama `publicar` (que exige o token) e `agora` |
| `TOKEN_CENTRAL` | topo do `bolsao.ino` e ambiente do simulador | não |
| `DATABASE_URL` | só no computador, na hora do `db:aplicar` | não, e nunca na Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | não é usada aqui | nunca, em lugar nenhum deste projeto |
