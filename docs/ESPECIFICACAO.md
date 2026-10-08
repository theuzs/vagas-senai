# Especificação

## 1. Arquitetura

```
nós (1 ESP32 por bolsão, sensor IR por vaga)
   │ ESP-NOW, a cada 1 s, inclusive sem mudança (não muda)
   ▼
central (placa atual, só ESP-NOW)
   │ fio serial (UART), uma linha por pacote recebido
   ▼
ponte (ESP32 novo, só Wi-Fi do campus) ── LCD opcional na guarita
   │ HTTPS a cada 10 s, POST /rest/v1/rpc/publicar
   ▼
Supabase: vagas.publicar → vagas.bolsoes → Realtime
   │ WebSocket
   ▼
página em vagas.rubysistemas.com.br (Next.js na Vercel)
```

O ESP32 tem um rádio só. Se a central entrasse no Wi-Fi do campus, o ESP-NOW passaria para o canal do roteador e deixaria de ouvir os nós, que falam no canal do softAP atual. Com duas placas, a central continua igual, os nós não mudam, e uma queda do Wi-Fi ou uma requisição HTTPS lenta não atrapalha a recepção ESP-NOW. Se mais tarde ficar provado que uma placa só basta, a lógica da ponte é reaproveitada (ver 4.4).

## 2. Banco (schema `vagas`)

As migrations ficam em `db/migracoes/NNNN_nome.sql` e rodam em ordem. A primeira cria tudo desta seção.

### 2.1 Tabelas

`vagas.bolsoes`, uma linha por bolsão:

| coluna | tipo | regra |
|---|---|---|
| `id` | text, PK | `^[A-Z0-9]{1,8}$` (ex.: `A`) |
| `nome` | text not null | ex.: `Bloco A` |
| `ordem` | smallint not null default 0 | ordem na tela |
| `total_vagas` | smallint, nulo | 1 a 500; vem do tamanho da lista enviada pelo nó |
| `vagas_livres` | smallint, nulo | entre 0 e `total_vagas`; calculado pelo banco |
| `vagas` | jsonb, nulo | array de booleanos, uma posição por vaga na ordem dos sensores, `true` = ocupada |
| `especiais` | jsonb not null default `'{}'` | posições especiais, ex.: `{"pcd":[0,1],"idoso":[5]}` (índice a partir de 0) |
| `atualizado_em` | timestamptz, nulo | hora do servidor no último dado recebido |

Seed dentro da própria migration: `('A','Bloco A',1)`, `('C','Bloco C',2)`, `('H','Bloco H',3)`, com os campos de estado nulos. Nulo quer dizer "nunca recebeu dado", e a página mostra SEM DADOS. Nenhum seed pode gravar zero.

`vagas.centrais`, uma linha por central autorizada a publicar:

| coluna | tipo |
|---|---|
| `id` | text, PK (ex.: `central-1`) |
| `nome` | text |
| `token_hash` | bytea not null unique (sha256 do token) |
| `ativa` | boolean not null default true |
| `criada_em` | timestamptz default now() |
| `ultimo_envio` | timestamptz, nulo |

O token em texto fica só no `config.h` da ponte. O banco guarda apenas o hash.

`vagas.historico`, uma foto a cada 5 minutos por bolsão, para mostrar à banca o efeito do sistema:

| coluna | tipo |
|---|---|
| `bolsao_id` | text references `vagas.bolsoes(id)` |
| `momento` | timestamptz (início da janela de 5 min) |
| `vagas_livres` | smallint not null |
| `total_vagas` | smallint not null |
| PK | (`bolsao_id`, `momento`) |

Por ano isso dá uns 300 mil registros (cerca de 20 MB). Ainda não há tela de histórico nem limpeza automática.

`vagas.migracoes` (`nome` text PK, `aplicada_em` timestamptz) é criada pelo script `db:aplicar`, não pela migration.

### 2.2 Função `vagas.publicar(p_token text, p_bolsoes jsonb) returns jsonb`

- `language plpgsql security definer set search_path = ''`, com todos os nomes qualificados.
- Token: confere `sha256(convert_to(p_token, 'UTF8'))` com o `token_hash` de uma central `ativa`. Token nulo, menor que 32 caracteres ou sem correspondência gera erro com `errcode = '28000'` (o PostgREST responde 403).
- `p_bolsoes` é um objeto `{"A": "0110...", "H": "1100..."}`. A chave é o `id` de um bolsão existente. O valor é um texto só com `0` (livre) e `1` (ocupada), de 1 a 500 caracteres. Um item inválido recusa a chamada inteira com `errcode = '22023'` (o PostgREST responde 400). Objeto vazio é aceito e só atualiza `ultimo_envio`.
- Para cada bolsão recebido, grava `vagas` (array de booleanos), `total_vagas` (comprimento), `vagas_livres` (quantidade de `0`) e `atualizado_em = now()`.
- Bolsão que não veio no objeto não é tocado. É assim que um nó parado envelhece e vira SEM DADOS na página.
- Insere em `vagas.historico` com `momento = date_bin('5 minutes', now(), timestamptz '2000-01-01 00:00:00+00')` e `on conflict do nothing`.
- Atualiza `vagas.centrais.ultimo_envio`.
- Retorna `{"atualizados": ["A", "H"]}`.

Payload que a ponte manda, uma requisição com todos os bolsões frescos (um handshake TLS por ciclo):

```json
{"p_token": "…", "p_bolsoes": {"A": "0110100", "C": "1111", "H": "000101"}}
```

### 2.3 Função `vagas.agora() returns timestamptz`

`language sql stable`, retorna `now()`. A página usa para acertar o relógio com o do servidor.

### 2.4 Permissões

```sql
alter table vagas.bolsoes   enable row level security;
alter table vagas.centrais  enable row level security;
alter table vagas.historico enable row level security;

grant usage on schema vagas to anon, authenticated, service_role;
grant select on vagas.bolsoes to anon, authenticated;
create policy leitura_publica on vagas.bolsoes
  for select to anon, authenticated using (true);
-- bolsoes: nenhuma política de insert/update/delete
-- centrais e historico: nenhum grant e nenhuma política para anon/authenticated

revoke execute on all functions in schema vagas from public;
grant execute on function vagas.publicar(text, jsonb) to anon, authenticated;
grant execute on function vagas.agora() to anon, authenticated;

alter publication supabase_realtime add table vagas.bolsoes;
```

Por que assim: a chave `anon` fica dentro da página, então qualquer pessoa pode usá-la. Uma política de escrita para `anon` deixaria qualquer um gravar "30 vagas livres". A única porta de escrita é `publicar`, que exige o token da central. Se o token vazar, quem tiver ele consegue mexer só na ocupação das vagas, e basta desativar a central (`ativa = false`) e gerar outro.

### 2.5 Configuração manual no Supabase

Em Project Settings → Data API → Exposed schemas, acrescentar `vagas`. Isso só adiciona o schema à API e não muda nada do WebSiteFoods. Quem faz é o Matheus, no deploy.

## 3. Página

### 3.1 Fonte de dados

Uma interface única, por exemplo:

```ts
interface FonteVagas {
  carregar(): Promise<{ bolsoes: Bolsao[]; agoraServidor: Date }>;
  assinar(aoMudar: (b: Bolsao) => void, aoStatus: (s: StatusConexao) => void): () => void;
}
```

- **Supabase**: `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` com `.schema('vagas')`. Carrega `bolsoes` ordenado por `ordem` e chama `rpc('agora')`. Assina `postgres_changes` de `UPDATE` em `vagas.bolsoes`. Ao (re)conectar (`SUBSCRIBED`), recarrega tudo, porque eventos podem ter sido perdidos. Ao voltar para a aba (`visibilitychange`), recarrega e confere o canal.
- **Demonstração**: só com `?demo=1`, sempre com uma faixa fixa "Demonstração: dados simulados". Muda vagas a cada 2 a 4 s, deixa um bolsão lotado de vez em quando e derruba o H por 40 s a cada 2 min para mostrar SEM DADOS. Nunca liga sozinha. Se faltar variável de ambiente, a página mostra SEM DADOS em tudo e um aviso de configuração incompleta, nunca dados simulados.

### 3.2 Regras (funções puras, com testes)

- `LIMITE_FRESCOR_MS = 30_000`, definido em um lugar só.
- `situacao(bolsao, agoraServidor)` devolve `sem-dados`, `lotado`, `poucas` ou `livre`:
  - `sem-dados`: `atualizado_em` nulo, `vagas` ou `total_vagas` nulos, tamanho de `vagas` diferente de `total_vagas`, idade maior que 30 s, ou idade negativa além de 5 s (relógio errado; na dúvida, não mostrar número).
  - `lotado`: dado fresco e `vagas_livres = 0`.
  - `poucas`: `vagas_livres <= max(3, ceil(total_vagas * 0.1))`.
  - `livre`: o resto.
- Relógio: `deslocamento = agoraServidor − (t0 + t1) / 2`, medido na carga, a cada 5 min e ao voltar para a aba. Se `rpc('agora')` falhar, usa o relógio do aparelho.
- A tela reavalia as situações a cada 1 s, mesmo sem chegar mensagem. Se o WebSocket cair, os dados envelhecem e viram SEM DADOS sozinhos.
- Idade em texto: "agora" (até 5 s), "há 12 s", "sem dados desde 19:42" (hora de America/Sao_Paulo), "ainda não recebeu dados".

### 3.3 Tela (celular primeiro, a partir de 360 px)

1. Cabeçalho curto com o nome da página e o estado da conexão ("Ao vivo" ou "Reconectando").
2. Linha com todos os bolsões lado a lado, um cartão por bolsão, todos visíveis em 360 px sem rolagem horizontal. Cada cartão mostra a letra do bloco e um destes: número grande + "livres", "LOTADO", ou "SEM DADOS".
3. Uma seção por bolsão com "12 de 40 livres", vagas especiais livres quando houver ("PCD: 1 livre"), a idade do dado e a grade de vagas. A grade usa `repeat(auto-fill, minmax(16px, 1fr))` e funciona de 1 a 500 vagas. Livre, ocupada e especial se distinguem por cor e por forma ou ícone. Em SEM DADOS a grade fica neutra e hachurada, com a hora do último dado.
4. Rodapé curto explicando que os números vêm de um sensor em cada vaga.

Visual:
- Tema escuro por padrão, porque o uso é à noite. Contraste AA.
- Verde para livre, amarelo para poucas, vermelho para LOTADO. SEM DADOS precisa se distinguir de LOTADO sem depender de cor: texto, ícone de alerta e listras.
- Alvos de toque de pelo menos 44 px, foco visível, `prefers-reduced-motion` respeitado.
- O Matheus gosta de movimento: uma animação curta quando o número muda cai bem.
- Sem logo do SENAI. O nome na tela é texto: "Vagas SENAI Blumenau".

### 3.4 PWA

- `app/manifest.ts` (rota de metadados do Next): nome "Vagas SENAI Blumenau", nome curto "Vagas", `display: standalone`, cores do tema.
- Ícones 192, 512, 512 maskable e apple-touch-icon 180, gerados por script a partir de `public/icone.svg`.
- Nada de service worker guardando dados em cache. Se algum navegador exigir service worker para instalar, ele só repassa para a rede.

### 3.5 Extras, depois do núcleo

1. Mapa esquemático do campus em SVG próprio, inspirado em `docs/mapa-senai-blumenau.jpg` sem copiar a arte: guarita, blocos A, C e H e os três bolsões com número ou estado. Fica abaixo da linha de cartões.
2. Rota `/qr`: folha A4 para imprimir e colar na guarita, com QR code para `https://vagas.rubysistemas.com.br` e a frase "Aponte a câmera para ver as vagas livres agora".
3. `?painel=1`: modo para TV ou tablet na guarita, só os cartões, em tamanho grande.

## 4. Firmware

### 4.1 Protocolo serial (central → ponte)

Uma linha ASCII por pacote recebido de um nó:

```
$V,<id>,<estados>*<cs>\n
```

- `<id>`: id do bolsão (`A`, `C`, `H`).
- `<estados>`: um caractere por vaga, `0` livre e `1` ocupada, de 1 a 500.
- `<cs>`: XOR de todos os bytes entre `$` e `*`, em dois dígitos hexadecimais maiúsculos.
- 115200 baud, 8N1. Linha maior que 600 bytes, checksum errado ou campo inválido é descartado e contado no log.

### 4.2 Ponte (`firmware/ponte/`)

- `config.exemplo.h` (versionado) e `config.h` (no `.gitignore`): `WIFI_SSID`, `WIFI_SENHA`, `WIFI_USUARIO` opcional (WPA2-Enterprise/PEAP quando definido), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TOKEN_CENTRAL`, pinos, `USAR_LCD`.
- Serial2 em RX 16 / TX 17, com `setRxBufferSize(4096)` antes do `begin`.
- Guarda por bolsão (até 8) o último texto de estados e o `millis()` do último quadro válido.
- A cada 10 s, se o Wi-Fi estiver conectado, monta o JSON com os bolsões cujo último quadro tem até 5 s e faz um POST. Bolsão mais velho que isso fica de fora, para envelhecer no banco.
- HTTPS: `WiFiClientSecure` com `setInsecure()` no protótipo e um comentário marcando onde entra a validação na versão final (de preferência o pacote de certificados raiz do core, com `setCACertBundle`). `HTTPClient` com `setReuse(true)` para não refazer o handshake a cada ciclo, timeout de 5 s.
- Cabeçalhos: `apikey`, `Authorization: Bearer <anon>`, `Content-Type: application/json`, `Content-Profile: vagas`.
- Resposta: 200 ok; 401 ou 403 registra "token recusado"; outros códigos e falhas registram no log e tentam no próximo ciclo. Nada disso bloqueia a leitura serial por mais que o timeout.
- Wi-Fi não bloqueante: `WIFI_STA`, `setAutoReconnect(true)`, nunca `while (WiFi.status() != WL_CONNECTED)`. Se ficar mais de 30 s desconectado, refaz o `begin` com espera crescente.
- Watchdog de tarefa de 30 s no loop. Se travar, a placa reinicia.
- LCD 20x4 I2C opcional (`USAR_LCD`, endereço 0x27, SDA 21, SCL 22): uma linha por bolsão ("A   12 livres", "C   SEM DADOS" quando não chega quadro há mais de 30 s) e uma linha de estado do Wi-Fi e do último envio. Funciona mesmo sem internet.
- Log pela USB serial para depuração.

### 4.3 Trecho da central (`firmware/central/`)

O código atual da central e o formato do pacote dos nós ainda não chegaram. Entregar:

- `saida_ponte.h` com `void enviarParaPonte(const char* id, const uint8_t* estados, uint16_t n)` que monta a linha do 4.1 e escreve em `Serial2`.
- `LEIAME.md` explicando como encaixar: o callback do ESP-NOW só copia o pacote para um buffer e marca uma flag; o `loop()` chama `enviarParaPonte`. Escrever na serial dentro do callback não é permitido. Incluir um exemplo com uma struct de pacote hipotética e uma tabela MAC → id do bolsão, avisando que precisa ser ajustado ao pacote real.
- Ligação: TX2 (GPIO 17) da central no RX2 (GPIO 16) da ponte, GND com GND.

### 4.4 Placa única (alternativa)

Documentar em `firmware/LEIAME.md` como a mesma lógica de publicação rodaria na própria central em `WIFI_AP_STA`, e por que isso só funciona se o canal do Wi-Fi do campus for o mesmo dos nós e não mudar.

## 5. Scripts

- `scripts/db-aplicar.ts` (`npm run db:aplicar`): aplica `db/migracoes` em `DATABASE_URL`, cada arquivo numa transação, registrando em `vagas.migracoes`. `--conferir` só lista o que falta. Não toca em `supabase_migrations` nem em nada fora de `vagas`.
- `scripts/gerar-token.ts` (`npm run token:gerar -- central-1 "Central da guarita"`): gera 32 bytes aleatórios em base64url, mostra o token para colar no `config.h` e o SQL `insert into vagas.centrais (...) values (..., decode('<sha256 hex>', 'hex'))`. O hash é calculado no script, para o token não passar pelo SQL Editor.
- `scripts/simular-ponte.ts` (`npm run simular:ponte`): faz o papel da ponte com `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `TOKEN_CENTRAL` do ambiente. Publica estados aleatórios a cada 10 s. `--parar H` deixa o H de fora para testar SEM DADOS, e `--seco` só mostra o payload.

## 6. Deploy (com o Matheus)

1. Expor o schema `vagas` (2.5).
2. `DATABASE_URL=... npm run db:aplicar` (ou colar as migrations no SQL Editor).
3. `npm run token:gerar`, rodar o SQL no SQL Editor e colar o token no `config.h`.
4. Projeto novo na Vercel ligado ao repositório `vagas-senai`, com as variáveis abaixo.
5. Settings → Domains: `vagas.rubysistemas.com.br`. O DNS já cobre, porque existe o CNAME `*`, e o domínio específico tem prioridade sobre o curinga do WebSiteFoods.
6. `npm run simular:ponte` e abrir a página no celular. Parar o simulador e ver SEM DADOS em até 30 s.

| variável | onde | pode ficar exposta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel, `.env.local`, `config.h` | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel, `.env.local`, `config.h` | sim; ela só lê `vagas.bolsoes` e chama as duas funções |
| `TOKEN_CENTRAL` | só `config.h` e ambiente do simulador | não |
| `DATABASE_URL` | só no computador, na hora de aplicar migration | não; nunca na Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | não é usada neste projeto | nunca colocar em lugar nenhum daqui |

## 7. Fora de escopo por enquanto

Login de usuário, reserva de vaga, notificação push, tela de histórico de ocupação e app nativo.
