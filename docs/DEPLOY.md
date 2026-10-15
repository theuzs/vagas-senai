# Deploy

Passo a passo para colocar a página no ar em `vagas.rubysistemas.com.br`. O Supabase é um projeto próprio do SENAI (`hsfsejmhltkxiwniuunf`, região São Paulo). O domínio e a conta Vercel são os que já existem para o WebSiteFoods, e nada aqui mexe no que o WebSiteFoods usa.

## 1. Supabase: expor o schema

1. Abra o projeto no painel do Supabase.
2. Project Settings → Data API → **Exposed schemas**: acrescente `vagas` à lista (deixe `public` e o resto como está). Salve.

Isso só diz à API que o schema existe. Sem este passo a página recebe erro 404 ao ler `bolsoes`.

## 2. Supabase: aplicar a migration

No seu computador, na pasta do projeto:

1. No `.env.local`, preencha `DATABASE_URL` com a URL do **Session pooler**, trocando `<senha>` pela senha do banco:
   ```
   DATABASE_URL=postgresql://postgres.hsfsejmhltkxiwniuunf:<senha>@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
   ```
   A conexão direta (`db.hsfsejmhltkxiwniuunf.supabase.co`) só tem endereço IPv6 e não funciona em toda rede. Por isso a URL é a do pooler.
2. Rode `npm run db:aplicar`.

Deve aparecer `aplicada` para cada arquivo de `db/migracoes` que ainda não rodou (hoje `0001_vagas.sql`, `0002_placas_maquete_aviso.sql` e `0003_resultados.sql`). Rodar de novo mostra `ok` e não faz nada.

Se preferir não usar a URL do banco: abra o SQL Editor, cole o conteúdo de `db/migracoes/0001_vagas.sql` e execute. Depois rode também o SQL abaixo, que registra a migration como aplicada. Sem esse registro, um `npm run db:aplicar` no futuro tenta rodar a 0001 de novo e para com erro de tabela já existente.

```sql
create table if not exists vagas.migracoes (nome text primary key, aplicada_em timestamptz not null default now());
alter table vagas.migracoes enable row level security;
insert into vagas.migracoes (nome) values ('0001_vagas.sql');
```

Para conferir: Table Editor → schema `vagas` → `bolsoes` deve ter A, C e H com `atualizado_em` vazio. Database → Publications → `supabase_realtime` deve listar `vagas.bolsoes`.

## 3. Token da central

Um por bolsão:

```
npm run token:gerar -- bolsao-a "Bolsão A"
npm run token:gerar -- bolsao-c "Bolsão C"
npm run token:gerar -- bolsao-h "Bolsão H"
```

1. Copie o SQL de cada um e execute no SQL Editor.
2. Guarde cada token: ele vai no topo do `firmware/bolsao/bolsao.ino` daquele bolsão (`TOKEN_CENTRAL`). Não aparece de novo; se perder, rode o comando outra vez e grave o firmware de novo.

## 4. Vercel

1. Crie o repositório `vagas-senai` no GitHub (privado) e dê push.
2. Na Vercel: Add New → Project → importe `vagas-senai`. Framework: Next.js (detecta sozinho). Não precisa mudar comando de build.
3. Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = a URL do projeto (Project Settings → Data API → Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a chave `anon` / publishable (Project Settings → API Keys)
   Só essas duas. Não coloque `DATABASE_URL` nem `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy. Abra o endereço `.vercel.app` que aparece: os três bolsões devem estar em SEM DADOS e o status "Ao vivo".

## 5. Domínio

1. No projeto da Vercel: Settings → Domains → Add → `vagas.rubysistemas.com.br`.
2. O DNS já responde, porque o Registro.br tem o CNAME `*` apontando para a Vercel (do WebSiteFoods). A Vercel pode pedir um registro TXT de verificação por o domínio raiz estar em outro projeto; se pedir, crie o TXT no Registro.br exatamente como mostrado.
3. Um domínio específico tem prioridade sobre o curinga, então `vagas.` vai para este projeto e o resto continua indo para o WebSiteFoods.

## 6. Testar o caminho completo

1. No computador: `TOKEN_CENTRAL=<token> NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run simular:ponte` (ou coloque as três no `.env.local`).
2. Abra `https://vagas.rubysistemas.com.br` no celular. Em até 10 s os números aparecem e passam a mudar.
3. Pare o simulador (Ctrl+C). Em até 30 s os três viram SEM DADOS.
4. `npm run simular:ponte -- --parar H`: só o H fica em SEM DADOS.
5. Com o ESP32 do bolsão gravado e no Wi-Fi do campus, o monitor serial mostra `[http] ok` a cada 10 s e a página passa a seguir os sensores.

## 7. PC da guarita

A tela do vigia fica em `https://vagas.rubysistemas.com.br/guarita`.

1. No PC da guarita, crie um atalho do Chrome com o destino:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --noerrdialogs --disable-session-crashed-bubble https://vagas.rubysistemas.com.br/guarita?quiosque=1
   ```
   O `--kiosk` abre em tela cheia, sem barra de endereço. Para sair, `Alt+F4`.
2. Para abrir sozinha ao ligar o PC: `Win+R`, digite `shell:startup` e copie o atalho para essa pasta.
3. Em Configurações → Sistema → Energia, ponha "Desligar a tela" e "Suspender" em **Nunca**. A página também pede ao navegador para não apagar a tela, mas a configuração do Windows manda.
4. Fora do modo quiosque e da tela cheia, a página mostra um botão "Abrir em tela cheia". O `?quiosque=1` esconde o botão. Para os avisos falados, acrescente `&som=1` ao endereço e `--autoplay-policy=no-user-gesture-required` ao atalho, com uma caixa de som ligada.
5. A tela recarrega sozinha uma vez por dia às 17:30, se estiver aberta há mais de 1 h e o servidor responder. O código de "Versão" no canto diz qual build o PC roda.
5. Imprima `https://vagas.rubysistemas.com.br/guarita/guia`, escreva o contato do responsável pelos sensores e cole ao lado do monitor.

## 8. QR code na guarita

Abra `https://vagas.rubysistemas.com.br/qr` e toque em "Imprimir esta folha" (a página já vem em A4, numa página só; na janela de impressão, escolha papel A4 e escala 100 %). Imprima em papel fosco ou plastifique com plástico fosco: o brilho atrapalha a câmera à noite. Cole na guarita e nas entradas dos estacionamentos com o centro do QR entre 1,0 e 1,3 m do chão, na altura dos olhos de quem está no carro. A folha impressa antes de 15/10/2026 tinha um QR menor e precisa ser impressa de novo.

Para as salas de aula, abra `https://vagas.rubysistemas.com.br/qr/sala`: é a mesma folha, com instruções para adicionar a página à tela inicial do celular.

## 9. Resultados para a banca

A tela `https://vagas.rubysistemas.com.br/resultados` mostra, noite a noite, quantas vezes um bloco lotou enquanto outro tinha vaga. Ela lê as funções `vagas.resumo_noites`, `vagas.impacto` e `vagas.serie_noite` da migration `0003_resultados.sql` (aplique com `npm run db:aplicar`).

Antes da banca, confira desde quando há fotos e apague as anteriores à instalação das placas, para o simulador e os testes não entrarem na conta:

```sql
select min(momento), count(*) from vagas.historico;
delete from vagas.historico where momento < '2026-11-01 00:00-03';  -- troque pela data da instalação
```

## 10. Maquete, placas e manutenção

- **Maquete:** o arquivo preenchido está em `firmware/bolsao/placas/maquete/maquete.ino` (gerado a partir de `firmware/maquete/maquete.ino` com o `TOKEN_MAQUETE` do `.env.local`). Enquanto ela faz o papel dos três estacionamentos, o token `maquete` publica em A, C e H e os números aparecem no site. Quando as placas reais entrarem: `update vagas.centrais set bolsoes = '{M}' where id = 'maquete';` e troque os ids em `BOLSOES` para `M`; a maquete passa a aparecer só em `https://vagas.rubysistemas.com.br/?maquete=1`.
- **Placas:** `https://vagas.rubysistemas.com.br/placas` mostra o último envio e o diagnóstico de cada placa (fora dos buscadores). Para gerar os arquivos das placas de novo: `npm run firmware:placas`; para compilar tudo: `npm run firmware:compilar`.
- **Aviso da manutenção:** `update vagas.bolsoes set aviso = 'Sensor em conserto até sexta' where id = 'H';` aparece só enquanto o bloco está em SEM DADOS; `set aviso = null` tira.
- **Acessos:** ligue o Web Analytics no projeto `vagas-senai` da Vercel (Analytics → Enable). A guarita, a demonstração e a maquete não contam.

## Se algo der errado

| Sintoma | Causa provável |
|---|---|
| Guarita com comportamento antigo | peça ao vigia o código de "Versão" no canto da tela e compare com o último commit. Se for diferente, peça para apertar Alt+F4 e abrir o atalho de novo. |
| Página com "Fora do ar" e "erro de configuração" | faltou variável na Vercel; confira o nome exato e faça redeploy |
| Página com "Sem conexão" o tempo todo | o schema `vagas` não está exposto (passo 1) ou a migration não rodou (passo 2) |
| Números só mudam a cada 10 s (sem Realtime) | `vagas.bolsoes` não está na publicação Realtime; rode `alter publication supabase_realtime add table vagas.bolsoes;` |
| Simulador ou ESP32 com 403 | token não bate: rode o SQL do `token:gerar` de novo e use o token novo |
| Simulador ou ESP32 com 406 | schema não exposto (passo 1) |
| Simulador ou ESP32 com 404 | a função `publicar` não existe: a migration não rodou (passo 2) |
| Simulador ou ESP32 com 400 | payload inválido (ex.: `ID_BOLSAO` que não existe na tabela); a mensagem diz o motivo |
