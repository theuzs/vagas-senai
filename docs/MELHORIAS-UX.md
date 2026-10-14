# Melhorias de UX e UI

Este documento junta a auditoria de UX e UI feita em 14/10/2026 em nove lentes, mais uma busca de lacunas: motorista (MOT), vigia (VIG), estados e conexão (EST), acessibilidade (ACE), visual (VIS), textos (TXT), QR, PWA e desempenho (QRP), produto (PRD), página local do ESP32 (ESP) e lacunas (LAC). Os 137 itens verificados viraram 64 itens de implementação, em três ondas. Cada item guarda entre parênteses os ids de origem, para quem quiser rastrear a evidência.

Quem implementa é o Fable, numa sessão nova do Claude Code neste repositório, com o Matheus aprovando. O Matheus delegou as escolhas de produto: elas estão na seção "Decisões tomadas" e já valem. Siga essas decisões sem perguntar de novo.

As capturas citadas como evidência (nomes como `guarita-1366-misto.png`, `MOT-…`, `VIGV-…`) ficaram em `.auditoria-ux/telas/` na raiz do repositório, pasta ignorada pelo git (o índice `INDICE.txt` diz a rota, o tamanho e o cenário de cada uma). Se a pasta não existir mais, refaça a cena com `tests/e2e/supabase-falso.ts`.

## Como trabalhar

1. Faça uma onda por vez, na ordem dos itens. A ordem já respeita as dependências.
2. Faça um commit por item, ou por um grupo pequeno de itens que mexem no mesmo arquivo. A mensagem do commit cita o id (`UX-07: faixa da guarita começa pelo bloco sem dados`).
3. Antes de escrever código do Next, leia o guia em `node_modules/next/dist/docs/` e respeite os avisos de descontinuação. A versão é a 16.3.6.
4. Depois de cada item, rode `npm run check`. Nos itens com E2E, rode contra o build de produção: `npm run build`, `npx next start -p 3001` e `E2E_BASE_URL=http://localhost:3001 npm run test:e2e`. O servidor de dev às vezes trava.
5. Nos itens de firmware, compile com `arduino-cli compile --fqbn esp32:esp32:esp32 firmware/bolsao`. O executável fica em `%LOCALAPPDATA%\arduino-cli\arduino-cli.exe`, fora do PATH. Os itens de firmware de uma onda saem juntos, para o João gravar as placas uma vez só.
6. No fim de cada onda, atualize as capturas de `docs/telas/` com `CAPTURAS=1 npx playwright test capturas` (decisão 29) e confira as imagens.
7. Registre em `docs/DECISOES.md`, a partir do número 38, cada decisão desta lista que o item aplicar e todo desvio da especificação que o item citar. Quando o item disser "registrar", o texto da decisão já está aqui; copie com as palavras do item.
8. Quando um teste atual esperar um texto que o item troca, atualize o teste no mesmo commit. O item lista esses testes.

## Regras que nenhuma mudança pode quebrar

- **SEM DADOS.** Bolsão com `atualizado_em` nulo ou com mais de 30 s pela hora do servidor nunca mostra número. A tela mostra SEM DADOS em alerta (texto, ícone, borda tracejada e listras), e a grade não mostra vaga livre nem ocupada. A regra vale para o estado inicial, a queda do Realtime, o erro de rede, a página local da placa, o mapa, a guarita, o título da aba, a imagem de compartilhamento e todo lugar novo que mostrar quantidade. Hora e data do último dado são permitidas só nos lugares que este documento indica.
- **Sem segredo na página.** A página não tem código de servidor que leia dado de vaga e só usa a chave publishable. Nada de `service_role`, nada de ISR, `use cache` ou fetch de `vagas.bolsoes` em componente de servidor.
- **Banco.** Tudo no schema `vagas`. Migrations novas em `db/migracoes`, com o próximo número livre, aplicadas por `npm run db:aplicar`. Nunca use `supabase link`, `supabase db push` nem `supabase migration`. Toda função nova recebe `revoke execute ... from public` antes do grant.
- **Textos.** Todo texto visível segue a seção "Textos" do `CLAUDE.md`. Os textos deste documento já seguem; copie como estão. Nas telas, o lugar se chama "Bloco X" e o substantivo comum é "estacionamento". "Bolsão" fica só no código, no banco e nos documentos internos.
- **Firmware.** Um arquivo por placa, configuração em `const` no topo, sem `config.h`. A pasta `firmware/bolsao/placas/` é ignorada pelo git e tem tokens: nenhum script imprime token, chave ou senha.
- **Guarita.** As colunas ficam na ordem A, C, H. O relógio continua com a proteção `noCliente` (mostra `--:--` até hidratar).

## Decisões tomadas

D1. **Guarita usa barra de ocupação no lugar da grade.** A grade cortava células sem avisar (108 de 500 visíveis), vira textura a 3 m e toma a altura que os textos maiores precisam. A barra foi validada com os tamanhos novos em 1024x768, 1366x768, 1280x1024 e 1920x1080. A grade continua no celular. Ficam de fora a grade ajustável da guarita (EST-06) e a parte de grade do VIS-01.

D2. **O número grande conta só as vagas comuns.** As vagas especiais aparecem em "+2 especiais" logo abaixo. Vale para cartão, coluna da guarita, resumo e orientação. `vagas.historico` continua com o total.

D3. **Sem Realtime, a página lê a API a cada 10 s.** É um complemento da especificação 3.1. Os avisos dizem "a cada 10 s" porque o laço existe.

D4. **A tela diz a causa do SEM DADOS, sem mudar o visual.** Quatro causas: carregando, sem conexão, erro de configuração e sensor. O visual de alerta continua desde o primeiro quadro. A proposta de um "Carregando" neutro, sem alerta, foi recusada porque contraria a regra do estado inicial.

D5. **Faixa da guarita começa pelo bloco que pode ter vaga.** Com resto lotado e um bloco sem dados, o texto grande é "Bloco H sem dados. Ele pode ter vaga." e não contém "lotado". Com vaga, o texto é "Indique o Bloco A: 12 vagas livres.". A guarita não pede ao vigia para "conferir no local", porque ele não sai da guarita. Escolhi o texto do VIG-01 no lugar do TXT-01, porque o TXT-01 deixava "lotados" no texto grande.

D6. **Termos visíveis: "Bloco X" e "estacionamento".** O mapa, os rótulos de leitor de tela, as âncoras (`#bloco-A`), o rodapé e a folha do QR deixam de dizer "bolsão".

D7. **Mapa sem números, depois das seções, com o título "Como chegar".** O estado aparece por cor, borda, listras e ícone. Os cartões já dão o número. É desvio da especificação 3.5.1.

D8. **Cores:** `--lotado` passa a `#f87171` no próprio token (sem criar `--lotado-texto`); `--vaga-ocupada` passa a `#6b7785`; o × da ocupada usa `var(--fundo)`; a vaga especial ganha contorno azul por fora da célula e a letra do tipo dentro. O teste de contraste fica em `src/app/contraste.test.ts`.

D9. **Bloco indicado na guarita ganha o selo "INDIQUE ESTE" no topo da coluna, e o anel sai.** O selo combina com "Indique o Bloco A" da faixa e continua verdadeiro com a histerese do UX-33.

D10. **Na guarita, nada entra acima das colunas.** A falha de leitura aparece na faixa de baixo e no indicador; a demonstração aparece no título do cabeçalho. Assim as colunas não pulam.

D11. **Indicador de conexão:** "Ao vivo", "Conectando", "Sem conexão", "Sensores sem dados", "Simulação" e "Fora do ar". "Sem conexão desde 19:42" ficou de fora porque não cabe no cabeçalho de uma linha; a hora vai no aviso.

D12. **Data do último dado:** "18:37" no mesmo dia, "ontem às 22:30" no dia anterior e "13/10 às 22:30" antes disso, comparando o calendário de America/Sao_Paulo.

D13. **Vagas especiais em texto:** "PCD: 2 livres", "PCD: 1 livre", "Idoso: nenhuma livre". O mesmo formato no celular e na guarita, sem o total.

D14. **Demonstração com roteiro fixo de 180 s alinhado ao relógio** (PRD-02), no lugar do ajuste de tempo do EST-13. Todas as telas mostram o mesmo número no mesmo instante. A demonstração usa cor violeta própria, separada de "poucas".

D15. **Página local da placa mostra SEM DADOS depois de 20 s sem resposta.** É mais rígido que os 30 s do site e cobre um envio preso com os novos timeouts de TLS. Um limite de 5 s faria a tela piscar a cada envio lento.

D16. **A fonte Inter sai.** A página usa a fonte do sistema, a mesma da página local da placa. Isso tira 47,6 KB do caminho até o primeiro número.

D17. **Convite de instalação só no iPhone, sem `beforeinstallprompt`.** O Chrome do Android já oferece a instalação, e o guia do Next desaconselha o botão próprio.

D18. **Só tema escuro.** A página ignora o tema claro do sistema, porque o uso é à noite e a tela da guarita fica ligada no escuro.

D19. **Leitor de tela:** sai o `aria-live` das listas de cartões e das colunas. Um anunciador fala só quando a situação de um bloco muda.

D20. **O link "Avisar erro" para o motorista (LAC-03) ficou de fora,** pelo mesmo motivo do PRD-11. A detecção de sensor travado do UX-58 pega o defeito sem depender de ninguém.

D21. **Tela de resultados entra na Onda 3, fora do escopo original.** O histórico já existe para a banca (decisão 8) e ninguém consegue vê-lo.

D22. **A tela de erro e a 404 nunca mostram número guardado.** A guarita tenta de novo sozinha e só recarrega quando o servidor responde, para não cair na página de erro do Chrome sem teclado.

### Pendências que só pessoas resolvem

- **João:** posições de PCD e idoso (UX-14 só tem efeito depois); por onde se entra em cada bolsão (UX-57); tabela de proximidade bloco → bolsão (UX-55); nome completo, curso e autorização para o crédito (UX-56); se há maquete com sensores (UX-59).
- **Matheus ou SENAI:** tamanho real do monitor da guarita (as contas de ângulo do UX-08 supõem 18,5" em 1366x768); caixa de som na guarita (UX-63); regulamento do prêmio sobre identificar o autor (UX-56); limite de eventos do plano Vercel (UX-60).

---

## Onda 1: correções, regra do produto, guarita e acessibilidade

### UX-01 · Testes de guarda antes de mexer
(VIS-17, TXT-16, EST-17, VIG-17, ACE-12, QRP-15, PRD-14) · Telas: todas · Impacto: alto · Esforço: P

**Problema.** Quase todos os itens mexem perto do SEM DADOS. Hoje os E2E só conferem `data-situacao` e ausência de dígito com `atualizado_em` nulo (pagina.spec.ts:17, extras.spec.ts:19 e 63-64). Nada confere listras, borda e ícone, dado velho com hora, o HTML estático, a ordem das colunas nem a faixa de demonstração na guarita.

**Fazer.** Criar `tests/e2e/guardas.spec.ts`, que passa no build atual:
- `/` e `/guarita` com A de 10 min, C fresco lotado e H de ontem às 22:30: `cartao-A`, `cartao-H`, `mapa-A`, `mapa-H` e o centro das colunas A e H contêm "SEM DADOS" e não casam com `/\d/`. Em `tela-guarita.tsx:101`, acrescentar `data-testid={`centro-${bolsao.id}`}`. `secao-A` casa com `/\d{2}:\d{2}/`.
- Mesmo cenário: `cartao-A` e `guarita-A` têm `border-style: dashed`, `background-image` com `repeating-linear-gradient` e um `svg`; `cartao-C` e `guarita-C` têm borda sólida e nenhum gradiente; o retângulo de `mapa-A` tem `stroke-dasharray`; `grade-A` não tem `[data-vaga=livre]` nem `[data-vaga=ocupada]`.
- Guarda de dígito geral, em dois cenários (as três linhas nulas; A de 10 min, C de 45 s, H nulo): juntar `textContent` e `aria-label` de `[data-testid^=cartao-]`, `[data-testid^=mapa-]`, `[data-testid^=secao-]`, `[data-testid^=guarita-]`, `[data-testid^=grade-]`, `orientacao` e `document.title`; apagar `/\b\d{2}:\d{2}\b/g` e `/\b\d{2}\/\d{2}\b/g`; não pode sobrar dígito.
- HTML bruto de `/` e `/guarita` (via `request.get`): todo `data-situacao` é "sem-dados" e nenhum `cartao-` ou `guarita-` tem dígito.
- `/guarita` com A 5 livres, C 2 e H 30: `x` de `guarita-A` < `guarita-C` < `guarita-H`, e `guarita-H` tem `data-indicado="sim"`.
- `/guarita?demo=1`: `faixa-demo` contém "Demonstração", o status contém "Simulação" e nenhuma chamada a `/rest/v1/` sai. `/guarita` sem demo, com tudo nulo: `faixa-demo` com contagem 0 depois de 5 s.
- Criar `tests/e2e/acessibilidade.spec.ts`: meta viewport sem `maximum-scale` e sem `user-scalable=no`; `html[lang=pt-BR]`; com `reducedMotion: 'reduce'`, `.pulso` tem `animation-name: none`; cartão focado por Tab tem `outline-style: solid` e largura ≥ 2 px; `[data-testid^=grade-]` tem `role=img` e o `ariaSnapshot` não tem filhos; todo `a` e `button` visível em `/` e `/guarita` mede ≥ 44x44 px.

Ao longo das ondas, todo lugar novo que mostre quantidade entra no seletor da guarda de dígito, e toda tela nova com `useVagas` ganha o par de testes de demonstração.

**Arquivos.** `tests/e2e/guardas.spec.ts`, `tests/e2e/acessibilidade.spec.ts`, `src/components/tela-guarita.tsx`.
**Pronto quando.** Os dois arquivos passam no build atual e continuam passando no fim de cada onda.

### UX-02 · Uma porta só para o número: `dadosVisiveis()`
(EST-17) · Telas: todas · Impacto: médio · Esforço: P

**Problema.** Cada componente decide sozinho se mostra número: `cartao-bolsao.tsx:15`, `tela-guarita.tsx:81`, `mapa-campus.tsx:66`, `secao-bolsao.tsx:46-47`, `grade-vagas.tsx:10-11`. Basta esquecer a condição num lugar novo.

**Fazer.** Em `src/lib/vagas/regras.ts`, criar `dadosVisiveis(b: Bolsao, s: Situacao): { livres: number; total: number; vagas: boolean[] } | null`, que devolve `null` quando `s === "sem-dados"` ou quando `vagas_livres`, `total_vagas` ou `vagas` é `null`. Trocar as cinco leituras por ela. `GradeVagas` passa a receber `dados` (ou `null`).
**Arquivos.** `regras.ts`, `regras.test.ts`, os cinco componentes.
**Pronto quando.** Unitários: `null` para cada motivo de sem-dados (nulo, 31 s, 6 s no futuro, tamanho incoerente, livres maior que o total) e o objeto certo para livre, poucas e lotado. `grep -rn vagas_livres src/components` não acha nada. UX-01 passa.

### UX-03 · Leitura de reserva enquanto o Realtime está fora
(MOT-02, VIG-03, EST-02, EST-08, QRP-08) · Telas: celular, guarita · Impacto: alto · Esforço: M

**Problema.** `carregar()` só roda na abertura, no SUBSCRIBED e no `visibilitychange` (use-vagas.ts:93, 107 e 118-121). Com o WebSocket bloqueado e a API funcionando, houve 1 leitura em 180 s, e os três blocos ficaram SEM DADOS para sempre (VIG-ws-bloqueado-180s.png). Com a REST falhando uma vez, a página nunca tentou de novo, embora o aviso diga "Ela tenta de novo sozinha." (avisos.tsx:20). Um UPDATE do Realtime não limpa `erroCarga` (use-vagas.ts:72), e o aviso fica ao lado de "AO VIVO" (EST-banner-preso.png). No quiosque a aba nunca fica oculta.

**Fazer.** Em `useVagas`, dentro do efeito principal (use-vagas.ts:56-129), um laço com `setTimeout` encadeado, cancelado na limpeza:
1. Depois de cada `carregar()`: se falhou, próxima leitura em 5 s na primeira falha seguida e em 10 s nas seguintes; se deu certo e o canal não está assinado, em 10 s (`INTERVALO_SEM_REALTIME_MS = 10_000`, ao lado de `INTERVALO_RELOGIO_MS`); se o canal está assinado, nada.
2. Status "reconectando" agenda leitura em 10 s; "ao-vivo" cancela o agendado (a linha 107 já recarrega).
3. Flag `lendo`: com leitura em andamento, pula a vez. Com `document.visibilityState === "hidden"`, não agenda.
4. UPDATE válido do Realtime chama `setErroCarga(false)` e marca `leituraOkEm = Date.now()`. Toda `carregar()` bem-sucedida também marca.
5. `window` ouve `online` e chama `carregar()`. `aoVoltar` passa a chamar `setAgoraLocal(Date.now())` antes de `carregar()` e também ouve `pageshow` e `focus`. No tique de 1 s, se passaram mais de 5 s desde o tique anterior (aparelho dormiu), chama `carregar()`.
6. Expor `leituraOkEm: number | null`, `carregou: boolean` (true quando a primeira `carregar()` termina, com sucesso ou erro) e `tentarAgora()`.
7. No modo demo o canal já nasce assinado (fonte-demo.ts:49) e o laço não roda.
8. Registrar: "Sem Realtime, a página lê a API a cada 10 s, e volta a ler quando a rede volta ou o aparelho acorda. O frescor continua decidido só por `atualizado_em` contra a hora do servidor."

**Arquivos.** `src/lib/vagas/use-vagas.ts`, `tests/e2e/supabase-falso.ts`, `tests/e2e/pagina.spec.ts`, `tests/e2e/extras.spec.ts`, `src/components/painel-vagas.test.tsx`, `docs/DECISOES.md`.
**Pronto quando.** Em `supabase-falso.ts`, aceitar `realtime?: boolean` (com `false`, fecha cada socket com 1006) e `bolsoes` como função chamada a cada carga. E2E com `page.clock`: (a) `realtime: false` e A fresco a cada carga, `/guarita` avança 60 s em passos de 10 s: `guarita-A` continua "livre" e houve ≥ 6 cargas; (b) com Realtime ligado, 60 s dão ≤ 2 cargas; (c) `realtime: false` e `atualizado_em` fixo de 60 s atrás: `guarita-A` em "sem-dados" e sem dígito; (d) REST 500 só na primeira: em até 15 s `cartao-A` sai de "sem-dados"; (e) REST sempre 500 e Realtime manda UPDATE de A: `aviso-erro` some; (f) com o relógio parado, `setSystemTime(+10 min)`, REST pendurada e `visibilitychange`: `cartao-A` vira "sem-dados" em até 300 ms reais; (g) `context.setOffline(true)` e depois `false`: as cargas sobem em até 2 s. Componente (jsdom, timers falsos): `carregar` rejeitada uma vez é chamada 2 vezes depois de 5 s; com "hidden", 30 s não geram chamada.

### UX-04 · Data no último dado quando ele é de outro dia
(MOT-06, EST-09, TXT-05, PRD-05) · Telas: celular, guarita · Impacto: médio · Esforço: P

**Problema.** `textoIdade` usa só a hora (regras.ts:57). Às 19:00, um dado de 21 h atrás aparece como "sem dados desde 22:00", e um de 49 h como "sem dados desde 18:00" (MOT-dado-de-ontem-360.png). Toda placa desligada depois da aula aparece assim na noite seguinte.

**Fazer.** Em `regras.ts`, criar `quando(ms, agoraServidorMs): string`, que compara o calendário em America/Sao_Paulo com `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })`, nunca a diferença de 24 h. Mesmo dia: "19:42". Dia anterior: "ontem às 22:00". Antes: "06/10 às 22:00". Dado do futuro: só a hora. `textoIdade` passa a devolver `"sem dados desde " + quando(...)`. "agora" e "há N s" continuam (especificação 3.2). Os itens UX-05 e UX-13 usam `quando`.
**Arquivos.** `regras.ts`, `regras.test.ts`.
**Pronto quando.** Com `AGORA = 2026-10-08T22:00Z`: 90 s antes → "sem dados desde 18:58"; 19 h antes → "sem dados desde 00:00"; 19 h e 1 min → "sem dados desde ontem às 23:59"; 21 h → "sem dados desde ontem às 22:00"; 49 h → "sem dados desde 06/10 às 18:00"; 10 s no futuro → "sem dados desde 19:00". `pagina.spec.ts:79` continua passando.

### UX-05 · Causa certa do SEM DADOS
(EST-01, EST-03, TXT-02, TXT-03, MOT-03, QRP-03, QRP-08, VIG-02) · Telas: celular, guarita · Impacto: alto · Esforço: M · Depende de: UX-03, UX-04

**Problema.** Todo SEM DADOS culpa o sensor. Com a API fora, as três seções dizem "O sensor deste bolsão não mandou dado recente (ainda não recebeu dados)." (celular-360-erro-rede.png) e a faixa da guarita diz "Os sensores não estão mandando dados." (guarita-1366-erro-rede.png). A mesma frase aparece na primeira pintura, antes de qualquer leitura (EST-semjs-guarita.png, txt-guarita-1366-carregando.png). O parêntese vem de `textoIdade` sem sujeito (secao-bolsao.tsx:43), e com dado incoerente a frase vira "não mandou dado recente (agora)". O vigia chama o João por causa de um sensor que está bom.

**Fazer.**
1. Em `tipos.ts`, `type CausaSemDados = "carregando" | "sem-conexao" | "configuracao" | "sensor"`. Em `regras.ts`, função pura `causaSemDados(e: { modo; carregou; msDesdeMontagem; status; erroCarga; online; msDesdeLeituraOk: number | null })`, nesta ordem: modo "sem-configuracao" → "configuracao"; `!carregou && msDesdeMontagem < 5000` → "carregando"; `online === false` → "sem-conexao"; `msDesdeLeituraOk !== null && msDesdeLeituraOk <= 15000` → "sensor"; `status === "ao-vivo" && carregou && !erroCarga` → "sensor"; senão "sem-conexao". O limite de 5 s vem de um `setTimeout` na montagem. Modo demo → sempre "sensor".
2. `useVagas` calcula `causa` a cada tique e devolve. `online` vem de `navigator.onLine` com `useSyncExternalStore` nos eventos `online` e `offline` (servidor: `true`). Só o valor `false` conta.
3. Em `regras.ts`, `textoSemDados(b, agoraServidorMs, causa, aparelho: "celular" | "guarita"): { longo: string; curto: string }`:
   - carregando: longo "A página está carregando as vagas."; curto "carregando".
   - sem-conexao com `online === false`: longo "O celular está sem internet. O bloco pode ter vaga livre. Confira no local."; curto "sem internet".
   - sem-conexao: longo "Este aparelho está sem conexão com o servidor. O bloco pode ter vaga livre. Confira no local."; curto "sem conexão".
   - configuracao: longo "A página está com erro de configuração. O bloco pode ter vaga livre. Confira no local."; curto "erro de configuração".
   - sensor e `atualizado_em` nulo ou inválido: longo "Os sensores deste bloco ainda não mandaram dados. O bloco pode ter vaga livre. Confira no local."; curto "ainda não recebeu dados".
   - sensor e dado velho (idade > 30 s ou < -5 s): longo "O último dado dos sensores chegou às 18:37. O bloco pode ter vaga livre. Confira no local." (com `quando`: "chegou ontem às 22:30", "chegou em 13/10 às 22:30"); curto "sem dados desde 18:37".
   - sensor e idade entre -5 s e 30 s (dado incoerente): longo "Os sensores deste bloco mandaram um dado incompleto. O bloco pode ter vaga livre. Confira no local."; curto "dado incompleto".
4. `secao-bolsao.tsx:43` usa o longo; a linha pequena da coluna da guarita (`tela-guarita.tsx:125`) usa o curto. `textoIdade` fica só para dado fresco.
5. `painel-vagas.tsx` e `tela-guarita.tsx` ganham `data-conexao={causa}` no elemento raiz, para os testes.
6. Em `src/app/page.tsx` e `src/app/guarita/page.tsx`, antes do painel: `<noscript><p className="rounded-lg border border-sem-dados px-3 py-2 text-sem-dados">Esta página precisa de JavaScript para mostrar as vagas.</p></noscript>` (guia: `generate-metadata.md:1141`).
7. O visual não muda: cartões, colunas, mapa e grade continuam com `data-situacao="sem-dados"`, alerta, ícone e listras. Registrar o desvio da lista de textos de idade da especificação 3.2.

**Arquivos.** `tipos.ts`, `regras.ts`, `regras.test.ts`, `use-vagas.ts`, `secao-bolsao.tsx`, `painel-vagas.tsx`, `tela-guarita.tsx`, `src/app/page.tsx`, `src/app/guarita/page.tsx`, `tests/e2e/pagina.spec.ts`, `tests/e2e/extras.spec.ts`, `docs/DECISOES.md`.
**Pronto quando.** Unitários de `causaSemDados`: carregando (1 s), sem-conexao (6 s sem leitura), sensor (ao-vivo sem erro), sem-conexao (ao-vivo com erro e sem leitura), sensor (reconectando com leitura há 8 s), sem-conexao (reconectando com leitura há 20 s), sem-conexao (offline). Unitários de `textoSemDados` nos sete casos; nenhum texto que não seja da causa "sensor" contém "sensor". E2E: REST atrasada 2 s, aos 300 ms `cartao-A` em "sem-dados" sem dígito e `secao-A` com "carregando as vagas" e sem "sensor"; REST 500 e WebSocket 1006, depois de 6 s `secao-A` contém "sem conexão com o servidor" e não contém "sensor"; A de 10 min com Realtime assinado, `secao-A` casa com `/O último dado dos sensores chegou às \d{2}:\d{2}\./`; H nulo, `secao-H` contém "ainda não mandaram dados" e não contém "(" nem "bolsão"; `javaScriptEnabled: false` mostra "Esta página precisa de JavaScript" em `/` e `/guarita`. Atualizar `pagina.spec.ts:20` e `:79` e `regras.test.ts:69-74`.

### UX-06 · Indicador e aviso de conexão que dizem a verdade
(EST-04, EST-05, TXT-06, TXT-12, VIG-02, MOT-02, QRP-08) · Telas: celular, guarita · Impacto: médio · Esforço: P · Depende de: UX-05

**Problema.** O indicador fica verde com "AO VIVO" ao lado de três SEM DADOS (celular-360-semdados.png, guarita-1366-semdados.png). Sem Realtime, ele diz "Reconectando" enquanto mostra números lidos pela REST. Na guarita ele tem 15 px em cinza. O aviso de erro depende só de `erroCarga`, não diz desde quando, não tem ação e, na guarita, empurra as colunas 57 px para baixo. Sem configuração, o público lê nomes de variáveis (avisos.tsx:15).

**Fazer.**
1. Em `regras.ts`, `indicadorConexao(modo, causa, situacoes): { chave; texto; tom: "verde" | "alerta" | "cinza" | "vermelho" }`: demo → "demo", "Simulação", verde; sem-configuracao → "sem-configuracao", "Fora do ar", vermelho; carregando → "conectando", "Conectando", cinza; sem-conexao → "sem-conexao", "Sem conexão", alerta; sensor e algum bloco fora de sem-dados → "ao-vivo", "Ao vivo", verde; sensor e todos em sem-dados → "sem-sensores", "Sensores sem dados", alerta.
2. `Conexao` (avisos.tsx:27-40) usa essa função, mantém `data-status` como está e ganha `data-indicador={chave}`. O tom "alerta" usa `rounded-lg border border-sem-dados bg-[var(--sem-dados-fundo)] px-2 text-sem-dados` e o ícone de alerta. Na guarita, o indicador usa `text-[clamp(1rem,1.6vw,1.6rem)] font-bold` (22 px em 1366).
3. `aviso-erro` aparece quando o modo é "supabase" e a causa é "sem-conexao", nunca na guarita (`tela-guarita.tsx:34` passa `semAvisoErro`). Textos, com a hora de `horaCurta` da última leitura boa:
   - offline: "O celular está sem internet. A página lê as vagas de novo quando a conexão voltar."
   - com `leituraOkEm`: "Este aparelho está sem conexão com o servidor desde 19:42. A página tenta de novo a cada 10 s."
   - sem leitura boa: "A página não conseguiu ler as vagas. Ela tenta de novo a cada 10 s."
   - Botão "Tentar agora" (`type="button"`, `min-h-11`, `border-sem-dados`) que chama `tentarAgora()`. O aviso ganha `role="alert"`.
4. Aviso de configuração (avisos.tsx:14) vira `<div role="alert">` com `<p>`: "A página está fora do ar por um erro de configuração. Confira as vagas no local." e `<details><summary className="inline-flex min-h-11 cursor-pointer items-center">Ver detalhes técnicos</summary>Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no build da Vercel.</details>`.
5. `docs/DEPLOY.md:56` passa a esperar "os três blocos em SEM DADOS e o status 'Sensores sem dados'". Registrar o desvio da especificação 3.3 ("Ao vivo" e "Reconectando").

**Arquivos.** `regras.ts`, `regras.test.ts`, `avisos.tsx`, `painel-vagas.tsx`, `tela-guarita.tsx`, `painel-vagas.test.tsx`, `tests/e2e/pagina.spec.ts`, `tests/e2e/extras.spec.ts`, `docs/DEPLOY.md`, `docs/DECISOES.md`.
**Pronto quando.** Unitários dos seis casos. E2E: tudo nulo com canal assinado → `data-indicador="sem-sensores"`; A fresco → "ao-vivo"; REST 500 e 1006 → "sem-conexao", `aviso-erro` com "tenta de novo a cada 10 s" e botão "Tentar agora"; depois de trocar a rota por dados frescos, clicar no botão deixa `cartao-A` "livre" e `aviso-erro` com contagem 0; em `/guarita`, `guarita-A.y` igual (±1 px) com REST 500 e no cenário normal, e o indicador com font-size ≥ 21 px em 1366x768; `painel-vagas.test.tsx:42` encontra "erro de configuração", "Fora do ar" e o nome da variável só dentro de `details`. Continuam passando `pagina.spec.ts:22`, `:136`, `:126` e `:144`.

### UX-07 · Faixa da guarita começa pelo bloco que pode ter vaga
(VIG-01, TXT-01, EST-14, VIG-02, LAC-04) · Telas: guarita · Impacto: alto · Esforço: P · Depende de: UX-05

**Problema.** Com A e C lotados e H sem dados, o texto grande (32,8 px) é "Os bolsões com sensor funcionando estão lotados." (regras.ts:143-150), e a 3 m só "lotados" se lê (VIG-a-3m-visao-20-40-lotadoesemdado.png). É o erro do problema original. O detalhe pede "confira no local", que o vigia não faz sem sair da guarita. Com um só lotado, a frase fica no plural (guarita-1366-velho.png). Um bloco sem dados há 10 min recebe a mesma frase de um sem dados há 31 s.

**Fazer.** `orientacaoGuarita(bolsoes, situacoes, causa)` em `regras.ts:117-153`. "Bloco H" vem de `b.nome`; vários usam "Blocos C e H" (com `listaNomes`).
- **Causa diferente de "sensor" e nenhum bloco indicado:** tipo "sem-dados". carregando: "A tela está carregando as vagas."; sem-conexao: "Esta tela está sem conexão."; configuracao: "Esta tela está com erro de configuração.". Detalhe nos três: "Não diga ao motorista que está lotado.". Com sem-conexao, o detalhe é "Não diga que está lotado. Os números voltam sozinhos quando a conexão voltar.".
- **Indicar:** "Indique o Bloco A: 12 vagas livres." (singular "1 vaga livre"). Detalhe com bloco sem dados: "Bloco H sem dados. Ele pode ter vaga." (plural "Blocos C e H sem dados. Eles podem ter vaga.").
- **Nenhum com vaga, algum sem dados, resto lotado:** tipo "sem-dados". Texto "Bloco H sem dados. Ele pode ter vaga." (plural acima). Detalhe "Os sensores mostram o Bloco C lotado." ou "Os sensores mostram os blocos A e C lotados.".
- **Todos lotados:** "Os três estacionamentos estão lotados." (outra quantidade: "Todos os estacionamentos estão lotados.").
- **Todos sem dados, causa sensor:** "Os sensores não estão mandando dados." e "Não diga ao motorista que está lotado.".
- Aviso no centro da coluna SEM DADOS (`tela-guarita.tsx:105-107`): "Não diga que está lotado. O bloco pode ter vaga.". Quando o bloco está sem dados há mais de 10 min (`LIMITE_AVISO_RESPONSAVEL_MS = 600_000`, ou `atualizado_em` nulo depois da primeira leitura) e a causa é "sensor": "Não diga que está lotado. Avise o responsável pelos sensores.".
- `text-balance` nos dois `<p>` da faixa (linhas 59 e 61) e no aviso do centro.
- Registrar a troca de textos da especificação 3.5 item 3 e da decisão 31.

**Arquivos.** `regras.ts`, `regras.test.ts`, `tela-guarita.tsx`, `tests/e2e/extras.spec.ts`, `docs/DECISOES.md`.
**Pronto quando.** Unitários: `[A=0, C=0, H=null]` → texto "Bloco H sem dados. Ele pode ter vaga.", `not.toMatch(/lotad/)` no texto, detalhe "Os sensores mostram os blocos A e C lotados."; `[A=0, C=null, H=null]` → "Blocos C e H sem dados. Eles podem ter vaga." e "Os sensores mostram o Bloco A lotado."; `[A=0, C=0, H=7]` → "Indique o Bloco H: 7 vagas livres."; `[A=1, C=0, H=0]` → "Indique o Bloco A: 1 vaga livre."; todos nulos com causa "sem-conexao" → "Esta tela está sem conexão." e tipo "sem-dados"; com causa "sem-conexao" e A fresco com 3 livres → tipo "indicar". E2E: A e C "1111" frescos e H de 45 s, o primeiro `<p>` de `orientacao` começa com "Bloco H sem dados" e não contém "lotados". Atualizar `regras.test.ts:121, 129, 136, 144, 158` e `extras.spec.ts:58, 59, 92`.

### UX-08 · Guarita legível a 3 m, com barra no lugar da grade e sem saltos
(VIG-04, VIG-05, ACE-01, EST-11, VIS-01 parte de tamanhos) · Telas: guarita · Impacto: alto · Esforço: M

**Problema.** Em 1366x768, só o número (44 minutos de arco a 3 m) e o SEM DADOS passam do mínimo de 16 minutos. "TEM VAGA" tem 17,8 px (4,4'), o detalhe 20,5 px (5,1'), "Não diga que está lotado." 20,5 px, o status 15 px. Em 1024x768, tudo fica 25% menor. A grade (`max-h-[18vh] overflow-hidden`, linha 140) mostra 108 de 500 células, todas verdes (VIG-recorte-grade-500.png), e desenha 12 bolhas fictícias em SEM DADOS. Os números ficam em alturas diferentes (y = 245, 255 e 235) e sobem 7 px quando o detalhe da faixa aparece.

**Fazer.** Em `src/components/tela-guarita.tsx`:
1. Cabeçalho da coluna (linha 93): `flex flex-col items-start gap-[0.4vh]`, rótulo embaixo do nome nas três colunas. h2: `<h2 aria-label={bolsao.nome} className="flex items-baseline gap-[0.3em] leading-none">` com `<span className="text-[clamp(0.9rem,1.6vw,1.8rem)] font-bold uppercase text-texto-secundario">Bloco</span>`, espaço e `<span data-testid={`letra-${id}`} className="text-[clamp(4rem,min(6vw,10vh),8rem)] font-black">{id}</span>`.
2. Rótulo de estado (linha 95) e aviso do SEM DADOS (linha 105): `text-[clamp(1rem,2vw,2.4rem)]`, o aviso com `text-balance`. Número (linhas 111 e 116): não muda.
3. Faixa (linha 59): `text-[clamp(1.5rem,min(4vw,7vh),5rem)]`; detalhe (linha 61): `text-[clamp(1.1rem,2.2vw,2.8rem)]`. O `<p>` do detalhe sempre existe; sem detalhe, ganha `invisible` e o conteúdo `" "`.
4. Cabeçalho: h1 (linha 25) `text-[clamp(0.9rem,1.4vw,1.6rem)] font-semibold text-texto-secundario`; relógio (linha 160) `text-[clamp(2.2rem,4.6vw,5.5rem)]`; data (linha 163) `text-[clamp(0.9rem,1.5vw,1.8rem)]`. Manter `noCliente`.
5. Linha de baixo da coluna (linha 123): `text-[clamp(1rem,1.8vw,2.2rem)]`. `data-testid={`meio-${id}`}` na div da linha 101.
6. Criar `src/components/barra-ocupacao.tsx` e usar no lugar das linhas 140-142: `<div data-testid={`barra-${id}`} data-sem-dados={semDados ? "sim" : "nao"} role="img" aria-label={semDados ? `${nome}: sem dados` : `${nome}: ${livres} de ${total} livres`} className="flex h-[clamp(14px,3.2vh,40px)] overflow-hidden rounded-full">`. Com dado: `<span data-parte="livre" className="bg-[var(--vaga-livre)]" style={{ width: `${(livres / total) * 100}%` }} />` e `<span data-parte="ocupada" className="flex-1 bg-[var(--vaga-ocupada)]" />`. Em SEM DADOS: barra inteira listrada em `bg-[var(--vaga-neutra)]`, sem `data-parte`.
7. Bloco de baixo da coluna (linha 122) com altura fixa `h-[12vh]` e `justify-end`, para o centro ter a mesma altura nas três colunas.
8. `aria-label` da coluna (linha 90): "Bloco A: 1 vaga livre" ou "Bloco A: 12 vagas livres".
9. Se o Tailwind não ler `min()` como tamanho de fonte, usar `text-[length:clamp(...)]`.

**Arquivos.** `tela-guarita.tsx`, `barra-ocupacao.tsx`, `tests/e2e/extras.spec.ts`.
**Pronto quando.** O teste "cabe sem rolagem" (extras.spec.ts:23-47) roda em 1024x768, 1280x1024, 1366x768 e 1920x1080, com A de 500 vagas (123 livres), C lotado e H sem dados, e em `/guarita?demo=1`. Em cada caso: `scrollHeight` ≤ altura; `meio-X` com `scrollHeight <= clientHeight + 1`; `letra-A` ≥ 64 px; a largura de "500" cabe na largura útil do cartão; os números de A, C e H com o mesmo `y` (±1 px); nenhuma caixa da coluna (h2, rótulo, número ou SEM DADOS, aviso, linha de baixo, barra) cruza outra. Em 1366x768: `letra-A` ≥ 76 px, faixa ≥ 53 px, relógio ≥ 62 px, aviso ≥ 27 px. Barra: em A, `data-parte=livre` dividido pela barra entre 0,236 e 0,256; C com `livre` de largura 0; H sem `data-parte` e sem dígito; nenhum `[data-vaga]` dentro de `guarita-A`. Quando H para (clock avança 41 s), a altura de `guarita-A` não muda (±1 px). Risco conhecido: as contas de ângulo supõem monitor de 18,5". Se o monitor real for maior, os tamanhos continuam valendo como mínimo.

### UX-09 · Vermelho do LOTADO acima de 4,5:1 e teste de contraste dos tokens
(ACE-03, MOT-09, VIS-08) · Telas: todas · Impacto: alto · Esforço: P

**Problema.** `--lotado #ef4444` dá 4,38:1 sobre `#3b1111` e 4,37:1 sobre `#182028`, e aparece em texto de 14 px ("LOTADO" do cartão, "Lotado" da seção). Com protanopia cai para 3,10:1. Nenhum teste confere contraste.

**Fazer.** `--lotado: #f87171` em `src/app/globals.css:21` (5,96:1, 5,95:1 e 6,69:1). Criar `src/app/contraste.test.ts`, que lê `globals.css` com `fs`, extrai as variáveis de `:root` e calcula a razão WCAG. Pares de 4,5:1: livre, poucas, lotado e sem-dados sobre o próprio fundo e sobre `--superficie`; `--texto-secundario` sobre `--fundo`, `--superficie`, `--superficie-2` e os quatro fundos de estado. Pares de 3:1 (entram no UX-11): `--vaga-ocupada` e `--vaga-livre` sobre `--superficie-2`; `--fundo` sobre `--vaga-ocupada`; `--vaga-especial` sobre `--superficie-2`; `--destaque` sobre `--fundo`.
**Arquivos.** `globals.css`, `src/app/contraste.test.ts`.
**Pronto quando.** O teste passa com `#f87171` e falha se o token voltar para `#ef4444`.

### UX-10 · Cartão do celular: mesmo esqueleto nos quatro estados
(VIS-04, ACE-02, MOT-09, EST-12, MOT-14) · Telas: celular · Impacto: médio · Esforço: P

**Problema.** A letra branca de 30 px chama mais atenção que o número colorido de 36 px. No LOTADO, o "0" cai para 24 px (cartao-bolsao.tsx:43) e não pulsa; no SEM DADOS, o rótulo tem 12 px (linha 37), o menor texto do cartão. Livre e poucas mostram o mesmo conteúdo e só a cor muda (1,06:1 entre si). O `aria-label` "Bloco C: 2 vagas livres" não segue o texto visível "BLOCO C 2 livres".

**Fazer.** Em `cartao-bolsao.tsx`, quatro linhas fixas em todos os estados: (1) "Bloco" 11 px, maiúsculas, `tracking-wide`, `text-texto-secundario`; (2) letra 22 px `font-black`; (3) linha de valor com 48 px de altura: número 44 px `font-black tabular-nums leading-none` na cor do estado (34 px com 3 dígitos), "0" do LOTADO no mesmo tamanho e com a classe `pulso` quando `pulsando`; em SEM DADOS, só o ícone de alerta `h-10 w-10`; (4) rótulo `text-sm font-black uppercase leading-tight`: "livres", "livre", "LOTADO" ou "SEM DADOS". Em poucas, uma linha a mais `<span className="text-sm font-black uppercase">Poucas</span>`. O `aria-label` começa com as palavras visíveis: "Bloco A 12 livres", "Bloco A 1 livre", "Bloco C 2 livres, poucas vagas", "Bloco C 0 lotado", "Bloco H sem dados". Borda, fundo e `min-h-[7.5rem]` continuam.
**Arquivos.** `cartao-bolsao.tsx`, `painel-vagas.test.tsx`, `tests/e2e/pagina.spec.ts`.
**Pronto quando.** Componente: `getByRole('link', { name: 'Bloco C 2 livres, poucas vagas' })` existe e `cartao-C` contém "Poucas"; `cartao-A` livre não contém "Poucas"; `getByRole('link', { name: 'Bloco H sem dados' })` existe sem dígito; de 2 para 0 livres, o "0" tem `pulso`. E2E 360x740 cenários cheio e velho: font-size do "0" igual ao do número de um cartão livre; `bottom` do rótulo dos três cartões varia ≤ 1 px; "SEM DADOS" com font-size ≥ 14 px; os três cartões no mesmo `y`. Em 320x640: `scrollWidth` ≤ 320 e "SEM DADOS" de `cartao-H` dentro do cartão; número de 3 dígitos cabe (`scrollWidth == clientWidth`).

### UX-11 · Grade do celular: contraste, especiais distintas e legenda
(MOT-08, ACE-05, VIS-06, TXT-08) · Telas: celular · Impacto: médio · Esforço: M · Depende de: UX-09

**Problema.** A ocupada `#566270` tem 2,35:1 contra a grade e o × tem 2,42:1 (WCAG 1.4.11 pede 3:1). O anel azul da especial (grade-vagas.tsx:34) tem 1,12:1 sobre o verde, e PCD e idoso ficam iguais (MOT-grade-especiais-zoom.png). Nenhuma legenda explica verde, × e contorno; o `title` não aparece no toque.

**Fazer.**
1. `--vaga-ocupada: #6b7785` (3,20:1). O × usa `text-fundo` e `strokeWidth` 2 (4,06:1).
2. Especial: trocar `ring-2 ring-inset ring-[var(--vaga-especial)]` por `outline-2 outline-solid outline-[var(--vaga-especial)] outline-offset-0` (5,74:1 contra a grade). Na especial livre, a inicial do tipo centrada: "P" pcd, "I" idoso, "G" gestante, "M" moto, com `flex items-center justify-center text-[10px] font-black leading-none text-[#0f1419]` (8,12:1). A especial ocupada continua com × e contorno.
3. Componente `src/components/legenda.tsx` (`data-testid="legenda"`), uma vez em `painel-vagas.tsx`, logo antes da lista de seções, só quando algum bloco tem dado fresco: `<ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-texto-secundario">` com amostras de 12 px nas mesmas classes da grade e os textos "Livre", "Ocupada", "P: PCD", "I: Idoso". Os dois últimos só aparecem quando algum bloco tem esse tipo em `especiais`.
4. `aria-label` da grade: "Vagas do Bloco A: 12 de 40 livres. PCD: 2 livres. Idoso: nenhuma livre." (formato da D13).
5. Pares de 3:1 do UX-09 entram no `contraste.test.ts`.

**Arquivos.** `globals.css`, `grade-vagas.tsx`, `legenda.tsx`, `painel-vagas.tsx`, `contraste.test.ts`, `tests/e2e/pagina.spec.ts`, `painel-vagas.test.tsx`.
**Pronto quando.** Contraste dos três pares ≥ 3. E2E com C "00111" e `{pcd:[0], idoso:[1]}`: `[data-tipo=pcd][data-vaga=livre]` tem "P" e `[data-tipo=idoso][data-vaga=livre]` tem "I"; `[data-tipo]` com `outline-style: solid` e `outline-width: 2px`; `legenda` visível com "Livre", "Ocupada", "P: PCD" e "I: Idoso"; sem especiais, a legenda não contém "PCD"; com tudo sem dados, `legenda` com contagem 0. Componente: `getByRole("img", { name: /Vagas do Bloco A: 4 de 7 livres/ })` existe.

### UX-12 · Grade em SEM DADOS vira um bloco listrado, sem células
(VIS-05, EST-15) · Telas: celular · Impacto: médio · Esforço: P · Depende de: UX-05

**Problema.** Em SEM DADOS, as células neutras somem nas listras (1,02:1) e parecem bolhas borradas. Sem total conhecido, a grade inventa 12 células (`total_vagas ?? 12`, grade-vagas.tsx:10).

**Fazer.** Com `dados === null`, `GradeVagas` não renderiza células. No lugar, um bloco com `listrado`, `border-2 border-dashed border-sem-dados`, `rounded-xl`, altura mínima 48 px (com total conhecido, a altura que a grade teria, até 120 px), `data-sem-dados="sim"`, `data-grade-vazia="sim"`, `role="img"` e `aria-label="Vagas do Bloco H: sem dados"`. No centro, o ícone de alerta de 20 px e o curto do UX-05 com a primeira letra maiúscula, em 14 px `font-semibold text-sem-dados` ("Sem dados desde 19:42", "Ainda não recebeu dados", "Sem conexão", "Carregando"). O fallback `?? 12` sai.
**Arquivos.** `grade-vagas.tsx`, `tests/e2e/pagina.spec.ts`.
**Pronto quando.** Depois de 31 s (pagina.spec.ts:61), `grade-A` tem 0 `[data-vaga]`, casa com `/Sem dados desde \d{2}:\d{2}/` e tem `data-sem-dados="sim"`. Com H nulo, `grade-H` contém "Ainda não recebeu dados". Sem aviso de hidratação no console em `/`.

### UX-13 · Topo do celular: cabeçalho de uma linha e frase de resumo
(MOT-11, MOT-05, PRD-05) · Telas: celular · Impacto: médio · Esforço: P · Depende de: UX-05, UX-06

**Problema.** Título, subtítulo de duas linhas e status ocupam 126 px; os cartões começam em y=142. O celular não diz para onde ir: em celular-360-lotadoesemdado.png, A e C lotados e H sem dados, o "Confira no local" só aparece perto de y=900. Com todos sem dados, ninguém explica o que fazer.

**Fazer.**
1. Levar o cabeçalho para dentro de `PainelVagas`: `<header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">` com o h1 "Vagas SENAI Blumenau" em `text-xl font-black whitespace-nowrap` e `<Conexao>` à direita. Tirar o subtítulo (a frase fica em `metadata.description`). `<main>` com `pt-3 pb-5` (page.tsx:6).
2. Em `regras.ts`, `orientacaoMotorista(bolsoes, situacoes, agoraServidorMs): { texto; detalhe: string | null }`:
   - com vaga: "O Bloco A tem mais vagas: 12 livres." (singular "1 livre"); detalhe com bloco sem dados: "O Bloco H está sem dados e pode ter vaga. Confira no local." (plural "Os blocos C e H estão sem dados e podem ter vaga. Confira no local.").
   - nenhum com vaga, algum sem dados: "O Bloco H está sem dados e pode ter vaga." e "Os sensores mostram os blocos A e C lotados." (singular "o Bloco C lotado").
   - todos lotados: "Os três estacionamentos estão lotados."
   - todos sem dados: "Os sensores não estão mandando dados." e detalhe "O último dado chegou ontem às 22:47. Confira as vagas no local." (com `quando` do `atualizado_em` mais recente) ou "Os sensores ainda não mandaram nenhum dado. Confira as vagas no local.".
3. Entre o cabeçalho e os cartões: `<div data-testid="resumo">` com `<p className="text-base font-bold">` e, se houver detalhe, `<p className="mt-1 flex items-center gap-2 text-sm font-semibold text-sem-dados">` com o ícone de alerta `h-4 w-4 shrink-0`. Sem `aria-live` (o UX-41 cuida dos anúncios). O resumo só aparece com causa "sensor" (some em carregando, sem conexão e configuração, que já têm aviso).
4. Os cartões continuam na ordem A, C, H.

**Arquivos.** `painel-vagas.tsx`, `src/app/page.tsx`, `regras.ts`, `regras.test.ts`, `tests/e2e/pagina.spec.ts`.
**Pronto quando.** Unitários dos quatro casos. E2E 360x740: A e C "1111" e H nulo → `resumo` contém "O Bloco H está sem dados e pode ter vaga." e não contém "três"; misto → "O Bloco A tem mais vagas"; tudo com `atualizado_em` de 20 h → "ontem às" e sem outros dígitos fora da hora; REST 500 → `resumo` não existe; REST atrasada 3 s → `resumo` não existe antes da resposta; topo de `cartao-A` ≤ 130 px; h1 com altura ≤ 32 px para os status "Ao vivo", "Conectando", "Sem conexão", "Sensores sem dados" e "Simulação", e a 320 px h1 numa linha e `scrollWidth` ≤ 320; com A "0111", C "1111" e H "0000000000", os `cartao-*` aparecem na ordem A, C, H; com `page.clock`, 32 s sem atualização deixam `resumo` sem número de vagas.

### UX-14 · O número grande conta só as vagas comuns
(MOT-01) · Telas: celular, guarita · Impacto: alto · Esforço: M · Depende de: UX-02, UX-07, UX-10, UX-13

**Problema.** O número é `vagas_livres` e conta as especiais (cartao-bolsao.tsx:15 e 48; regras.ts:34-36). Com 5 vagas por placa, basta a PCD ser a última livre para o cartão mostrar "1 livre" (MOTV-cinco-vagas-pcd-360.png), e a guarita indicaria esse bloco. À noite, as especiais costumam ser as últimas livres.

**Fazer.**
1. Em `regras.ts`: `livresComuns(b)` (posições livres fora das listas de especiais; só posições válidas; posição em duas listas conta uma vez; `null` se `vagas` é `null`), `totalComuns(b)`, `especiaisLivresTotal(b)` e `situacaoComum(b, agora)`, que chama `situacao()` primeiro e devolve "sem-dados" quando for o caso; com dado fresco, "lotado" se comuns = 0, "poucas" se comuns ≤ `limitePoucas(totalComuns)`, "livre" nos outros. Sem especiais, igual a `situacao()`. `dadosVisiveis` ganha `livresComuns` e `especiaisLivres`.
2. `use-vagas.ts:133` usa `situacaoComum`.
3. Cartão e coluna da guarita mostram `livresComuns` e, com especial livre e dado fresco, a linha `<span data-testid="cartao-especiais" className="text-xs font-semibold text-[var(--vaga-especial)]">+2 especiais</span>` ("+1 especial"). Com comuns = 0: "0", "LOTADO" e a linha. `aria-label`: "Bloco C 0 lotado, mais 2 especiais livres" e "Bloco A 10 livres, mais 2 especiais livres".
4. `orientacaoGuarita` e `orientacaoMotorista` filtram e ordenam por `livresComuns`. Quando nenhum bloco fresco tem vaga comum e algum tem especial livre: texto "As vagas comuns estão lotadas." e campo novo `especiais`: "Vagas especiais livres: Bloco C (1 PCD, 1 idoso)." A guarita mostra esse campo numa linha a mais; o aviso de bloco sem dados continua no detalhe, com prioridade.
5. Registrar: "O número grande conta só as vagas comuns. As especiais aparecem em '+N especiais'. `vagas.historico` continua com o total."

**Arquivos.** `regras.ts`, `regras.test.ts`, `use-vagas.ts`, `cartao-bolsao.tsx`, `secao-bolsao.tsx`, `tela-guarita.tsx`, `tests/e2e/pagina.spec.ts`, `tests/e2e/extras.spec.ts`, `docs/DECISOES.md`.
**Pronto quando.** Unitários: "00111" com `{pcd:[0], idoso:[1]}` → `livresComuns` 0, `especiaisLivresTotal` 2, `situacaoComum` "lotado"; o mesmo com 31 s → "sem-dados"; "01111" com `{pcd:[0], idoso:[0]}` → 1 especial livre; sem especiais, igual a `situacao` em toda a suíte atual; A "11111", C "00111" com as especiais e H "11111" → "As vagas comuns estão lotadas.", tipo diferente de "indicar" e `especiais` com "Bloco C". E2E no mesmo cenário: `cartao-C` com `data-situacao="lotado"`, "LOTADO" e "+2 especiais", sem "livre"; `orientacao` com "As vagas comuns estão lotadas" e sem "três"; com `page.clock`, depois de 32 s, `cartao-C` sem dígito e sem "especia". O efeito real só aparece quando o João mandar as posições.

### UX-15 · Telas de erro e 404 em português, que se recuperam sozinhas
(VIG-08, LAC-01) · Telas: guarita, celular, todas · Impacto: médio · Esforço: P

**Problema.** `src/app` não tem `not-found.tsx`, `error.tsx` nem `global-error.tsx`. Endereço errado mostra "404: This page could not be found." sem link (LAC-404-360.png). Uma exceção de render deixa a guarita com a mensagem padrão em fundo branco a noite toda, e o quiosque só fecha com Alt+F4.

**Fazer.**
1. `src/lib/vagas/servidor-responde.ts`: `servidorResponde()` faz `fetch(location.pathname, { method: "HEAD", cache: "no-store" })` e devolve `ok`, ou `false` em exceção.
2. `src/components/erro-tela.tsx` (`"use client"`), `ErroTela({ error, retry, titulo, intervaloMs })`: tela inteira com o visual do SEM DADOS (listrado, `border-dashed border-sem-dados`, `bg-[var(--sem-dados-fundo)]`), título `text-[clamp(1.5rem,4vw,5rem)] font-black`, texto "Não diga ao motorista que está lotado. A tela tenta de novo em 30 s." na guarita ou "A página tenta de novo em 10 segundos." no resto, botão "Tentar agora" (`min-h-11`) e "Tentativa 1 de 3" em `text-texto-secundario`. `useEffect`: `console.error(error)`; depois de `intervaloMs`, soma 1 em `sessionStorage["vagas-erro-tentativas"]` (try/catch) e chama `retry()`. Na terceira tentativa, chama `servidorResponde()`: `true` → `location.reload()` e zera o contador; `false` → tenta de novo em 60 s. A tela nunca mostra número de vagas.
3. `src/app/guarita/error.tsx`: título "A tela da guarita parou por um erro.", 30 s. `src/app/error.tsx`: título "A página parou de funcionar.", 10 s. `useVagas` zera o contador na primeira carga boa.
4. `src/app/global-error.tsx`: importa `./globals.css`, `<html lang="pt-BR"><body>` com `ErroTela` e título "A página parou por um erro." (o guia diz que o global-error precisa dos próprios `html`, `body` e estilos).
5. `src/app/not-found.tsx` (Server Component): `metadata.title` "Página não encontrada", h1 "Esta página não existe.", "Confira o endereço ou abra a página das vagas." e `Link` "Ver as vagas" para `/`, com altura ≥ 44 px.
Leia `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` (o `retry` é estável desde a 16.3.0).

**Arquivos.** Os cinco arquivos novos, `src/components/erro-tela.test.tsx`, `use-vagas.ts`, `tests/e2e/extras.spec.ts`.
**Pronto quando.** E2E: `/qualquer-coisa` responde 404, mostra "Esta página não existe." e o link "Ver as vagas" com `href="/"`, e não contém "could not be found". Vitest com timers falsos: depois de 30 s, `retry` chamado uma vez e o texto contém "Não diga ao motorista que está lotado."; com o contador em 2 e `servidorResponde` falso, `location.reload` não é chamado; com verdadeiro, é chamado uma vez; com `sessionStorage` que lança erro, renderiza e chama `retry`.

### UX-16 · zod/mini no lugar do zod completo
(QRP-01) · Telas: celular, guarita · Impacto: alto · Esforço: P

**Problema.** Antes do primeiro número, a página baixa um chunk de 635.815 bytes (152 KB com gzip) com o supabase-js e o zod, inclusive as mensagens de erro de todos os idiomas ("Nieprawidłow" 13 vezes, "无效" 13 vezes). O `import { z } from "zod"` de `tipos.ts:1` e `fonte-supabase.ts:2` impede o Turbopack de descartar os idiomas. No 4G lento, o primeiro número sai com mediana de 4.186 ms.

**Fazer.** Em `tipos.ts` e `fonte-supabase.ts`, `import * as z from "zod/mini"` e o esquema: id `z.string().check(z.regex(/^[A-Z0-9]{1,8}$/))`; nome `z.string().check(z.minLength(1))`; ordem `z.number().check(z.int())`; total_vagas `z.nullable(z.number().check(z.int(), z.minimum(1), z.maximum(500)))`; vagas_livres `z.nullable(z.number().check(z.int(), z.minimum(0)))`; vagas `z.nullable(z.array(z.boolean()))`; especiais `z._default(z.record(z.string(), z.array(z.number().check(z.int(), z.minimum(0)))), {})`; atualizado_em `z.nullable(z.string())`. O tipo continua `z.infer<typeof EsquemaBolsao>`.
**Arquivos.** `tipos.ts`, `fonte-supabase.ts`, `tests/e2e/desempenho.spec.ts`.
**Pronto quando.** `regras.test.ts:96-106` passa sem mudança. `tests/e2e/desempenho.spec.ts` abre `/` com o Supabase falso, guarda o corpo das respostas `.js` até `cartao-A` sair de "sem-dados" e confere que nenhum corpo contém "Nieprawidłow" nem "无效" e que a soma fica abaixo de 800.000 bytes (hoje 1.104.065; medido 764.738).

### UX-17 · Primeira leitura enquanto a página hidrata
(QRP-02, QRP-15) · Telas: celular, guarita · Impacto: alto · Esforço: M · Depende de: UX-03, UX-16

**Problema.** O GET de `bolsoes` só sai depois de hidratar, importar `./fonte-supabase` (use-vagas.ts:86) e executar esse chunk. Em produção, no 4G lento, os chunks principais terminam aos 1.407 ms e a resposta chega aos 4.210 ms. Esse tempo todo a tela fica em SEM DADOS.

**Fazer.**
1. Mover `COLUNAS` para `tipos.ts`. Criar `src/lib/vagas/carga-inicial.ts`. Na avaliação do módulo, só se `typeof window !== "undefined"`, a URL não tem `demo=1` e `configuracaoSupabase()` não é `null`, disparar em paralelo `fetch(`${url}/rest/v1/bolsoes?select=${COLUNAS}&order=ordem`, { headers: { apikey: chave, "Accept-Profile": "vagas" }, cache: "no-store" })` (erro se `!r.ok`, valida com `z.array(EsquemaBolsao).parse`) e `fetch(`${url}/rest/v1/rpc/agora`, { method: "POST", headers: { apikey: chave, "Content-Profile": "vagas", "Content-Type": "application/json" }, body: "{}", cache: "no-store" })` (guarda t0 e t1; `relogio: null` se falhar). Exportar `pegarCargaInicial(): Promise<Carga> | null`, que devolve a promessa uma vez e `null` depois.
2. Em `use-vagas.ts`, `iniciar()` começa com `const inicial = !fonte && modo === "supabase" ? pegarCargaInicial() : null` e aplica o resultado como `carregar()` aplica (`setErroCarga(false)`, ordena por `ordem`, `aplicarRelogio`, marca `leituraOkEm` e `carregou`); no catch, `setErroCarga(true)` e `carregou`. O import de `fonte-supabase` segue em paralelo; depois dele, `if (!inicial) await carregar()`. O Realtime fica igual.
3. Registrar: "A primeira leitura usa `fetch` direto, no navegador, sem esperar o supabase-js. Nenhum dado de vaga é lido no servidor: nada de fetch de `vagas.bolsoes` em componente de servidor, ISR ou `use cache`."

**Arquivos.** `carga-inicial.ts`, `use-vagas.ts`, `tipos.ts`, `fonte-supabase.ts`, `tests/e2e/desempenho.spec.ts`, `docs/DECISOES.md`.
**Pronto quando.** E2E: `page.route` em `/_next/static/**/*.js` nunca responde o corpo que contém "RealtimeClient"; com o Supabase falso, `cartao-A` em `/` e `guarita-A` em `/guarita` saem de "sem-dados" em até 10 s, com o indicador ainda "conectando". O build atual falha nesse teste. Os testes de queda e volta do Realtime e o HTML estático do UX-01 continuam passando. Medição manual com 4G lento: mediana do primeiro número ≤ 3,0 s.

### UX-18 · Folha do QR legível do carro, em uma página só
(QRP-04, QRP-05, TXT-09, LAC-02) · Telas: qr · Impacto: alto · Esforço: M

**Problema.** O QR impresso mede 110 mm, nível M, em modo byte (qr/page.tsx:12 e 19), e lê a cerca de 1 m. O título "Tem vaga no A, no C ou no H?" é pergunta seguida da resposta, que o CLAUDE.md proíbe. A folha não diz para parar o carro e usa "bolsão". A impressão sai em duas páginas, a segunda em branco, e com fundo ligado as margens saem quase pretas (`color-scheme: dark`, globals.css:46-48).

**Fazer.**
1. `src/lib/qr.ts`: `OPCOES_QR = { errorCorrectionLevel: "H", margin: 4 } as const` e `textoDoQr(endereco)`, que devolve `endereco.replace(/\/$/, "").toUpperCase()` quando a URL tem pathname `/`, sem search e sem hash, e o endereço sem mudança nos outros casos.
2. `qr/page.tsx`: `QRCode.toString(textoDoQr(ENDERECO_PUBLICO), { type: "svg", ...OPCOES_QR, color: { dark: "#0f1419", light: "#ffffff" } })`, QR com `w-[165mm]` e `data-testid="qr"`.
3. Textos, nesta ordem: título em duas linhas, 56 px, peso 900, "Vagas livres agora" / "nos blocos A, C e H"; instrução 30 px, peso 600, "Com o carro parado, aponte a câmera do celular."; o QR; "vagas.rubysistemas.com.br" 28 px, peso 800; rodapé 14 px: "Cada vaga tem um sensor. Quando um estacionamento fica sem dado, a página mostra SEM DADOS no lugar do número. Para abrir mais rápido nas próximas noites, adicione a página à tela inicial do celular."
4. Impressão: no `@media print`, `html { color-scheme: light; background: #fff; }` e `@page { size: A4; margin: 12mm; }`; no `main`, trocar `print:min-h-[297mm]` por `print:min-h-0 print:flex-none print:h-[272mm]` com `justify-between`.
5. Só na tela (`print:hidden`): botão "Imprimir esta folha" (`src/components/botao-imprimir.tsx`, chama `window.print()`, alvo ≥ 44 px) e "Na janela de impressão, escolha papel A4 e escala 100 %.".
6. `docs/DEPLOY.md`, seção 8: imprimir em papel fosco ou plastificar com plástico fosco; colar com o centro do QR entre 1,0 e 1,3 m do chão. Registrar a troca do texto da especificação 3.5. A folha já impressa precisa ser impressa de novo.

**Arquivos.** `qr/page.tsx`, `src/lib/qr.ts`, `src/lib/qr.test.ts`, `botao-imprimir.tsx`, `tests/e2e/extras.spec.ts`, `docs/DEPLOY.md`, `docs/DECISOES.md`.
**Pronto quando.** Unitário: `QRCode.create(textoDoQr(ENDERECO_PUBLICO), OPCOES_QR)` tem versão 3 e segmento `Alphanumeric`; `textoDoQr('https://x.com/?demo=1')` não muda. E2E: `page.pdf({ preferCSSPageSize: true, printBackground: true })` tem uma página (`/\/Type\s*\/Page[^s]/g` em latin1); com mídia print, `colorScheme` "light", `main` entre 1020 e 1032 px, botão invisível, `[data-testid=qr]` ≥ 620 px, `viewBox="0 0 37 37"`, h1 ≥ 56 px e "Com o carro parado" visível; o `main` não casa com `/bols[ãa]o/i`. Teste manual: câmera nativa de um Android e de um iPhone a 1,5 m, à noite, pela janela do carro.

### UX-19 · Termos únicos: "Bloco X" e "estacionamento"
(TXT-04, TXT-15) · Telas: celular, guarita, mapa, qr · Impacto: médio · Esforço: P

**Problema.** O mesmo lugar é "Bloco A" nos cartões e "Bolsão A" no mapa (mapa-campus.tsx:72). Aparecem também "Resumo dos bolsões" (painel-vagas.tsx:18), "Bolsões" (tela-guarita.tsx:36), "com os bolsões A, C e H" (mapa-campus.tsx:37), `#bolsao-A` (cartao-bolsao.tsx:28) e o rodapé "Quando um bolsão fica sem dado..." (page.tsx:15), que também liga vários números a "dele".

**Fazer.** `mapa-campus.tsx:72` usa `{b.nome}`; figcaption "Mapa simplificado. Os retângulos coloridos são os estacionamentos de cada bloco. A entrada é pela guarita, na Rua São Paulo."; `aria-label` do SVG "Mapa simplificado do campus com os estacionamentos dos blocos A, C e H"; `painel-vagas.tsx:18` "Resumo dos estacionamentos"; `tela-guarita.tsx:36` "Estacionamentos"; âncora e id `bloco-A` (cartao-bolsao.tsx:28, secao-bolsao.tsx:26). Rodapé (page.tsx:15): "Cada vaga tem um sensor, e os números desta página vêm desses sensores e mudam sozinhos. Quando o dado de um estacionamento tem mais de 30 segundos, a página mostra SEM DADOS no lugar do número."
**Arquivos.** `mapa-campus.tsx`, `painel-vagas.tsx`, `tela-guarita.tsx`, `cartao-bolsao.tsx`, `secao-bolsao.tsx`, `src/app/page.tsx`, `tests/e2e/extras.spec.ts`.
**Pronto quando.** E2E em `/` (misto), `/guarita` e `/qr`: `main.innerText()`, os `svg text`, todos os `aria-label` e `page.title()` não casam com `/bols[ãa]o/i`. O rodapé contém "vêm desses sensores" e "a página mostra SEM DADOS no lugar do número".

### UX-20 · Gerador dos arquivos das placas e versão do firmware
(ESP-14) · Telas: esp32 · Impacto: médio · Esforço: M

**Problema.** Os três arquivos de `firmware/bolsao/placas/` são cópias manuais do `bolsao.ino`, ignoradas pelo git. Todo item de firmware desta lista deixaria as placas com o código velho, e nada mostra a versão gravada. Este item vem antes dos outros de firmware.

**Fazer.**
1. `const char* VERSAO_FIRMWARE = "2026-10-14";` fora do bloco de configuração. Atualize a data a cada mudança do `.ino`.
2. `scripts/gerar-placas.ts` (`npm run firmware:placas`): para A, C e H, lê o `bolsao.ino` e troca pela linha `const char* NOME = "...";` os valores de `ID_BOLSAO`, `NOME_BOLSAO` ("Bloco X"), `AP_SSID` ("Estacionamento-X"), `SUPABASE_URL` (`NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_ANON_KEY` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) e `TOKEN_CENTRAL` (`TOKEN_BOLSAO_X`), lidos do `.env.local`. Se o arquivo da placa já tem `WIFI_SSID`, `WIFI_SENHA`, `WIFI_USUARIO` ou `PINO_VAGA` diferentes do exemplo, leva essas linhas. Acrescenta um cabeçalho de 3 linhas e grava só em `firmware/bolsao/placas/bolsao_X/bolsao_X.ino`. Erros: "Não achei TOKEN_CENTRAL no bolsao.ino" e "Falta TOKEN_BOLSAO_H no .env.local". Nunca imprime token, chave nem senha.
3. `npm run firmware:compilar`: `arduino-cli compile --fqbn esp32:esp32:esp32` em `firmware/bolsao` e em cada placa, procurando o executável no PATH e em `%LOCALAPPDATA%\arduino-cli\arduino-cli.exe`.
4. LEIAME: "Ao receber uma versão nova, copie do arquivo antigo para o novo as linhas de WIFI_SSID, WIFI_SENHA, WIFI_USUARIO e PINO_VAGA." Registrar o gerador.

**Arquivos.** `firmware/bolsao/bolsao.ino`, `scripts/gerar-placas.ts`, `scripts/gerar-placas.test.ts`, `package.json`, `firmware/LEIAME.md`, `docs/DECISOES.md`.
**Pronto quando.** Vitest com fixtures: arquivo antigo com `WIFI_SSID "REDE-X"` e `PINO_VAGA {4, 13}` gera arquivo com esses valores, o token da env de fixture e o resto igual ao `.ino`; fixture sem `TOKEN_CENTRAL` gera erro com o nome; a saída do script não contém o token. `npm run firmware:compilar` termina sem erro.

### UX-21 · N_VAGAS calculado a partir de PINO_VAGA
(ESP-03) · Telas: esp32 · Impacto: alto · Esforço: P · Depende de: UX-20

**Problema.** Com `N_VAGAS = 8` e 5 pinos listados (bolsao.ino:18-19), o C++ preenche o resto com o GPIO 0 sem aviso. O botão BOOT deixa o pino em HIGH, e o site mostra 3 vagas livres para sempre, com dado fresco. A regra do SEM DADOS não pega. Um pino da flash (6 a 11) também compila e trava a placa.

**Fazer.** `const int PINO_VAGA[] = {32, 33, 34, 35, 25};   // um pino por vaga, na ordem das vagas` e, depois do bloco de configuração, `const int N_VAGAS = sizeof(PINO_VAGA) / sizeof(PINO_VAGA[0]);`. No `setup`, conferir cada pino: inexistente (20, 24, 28 a 31, > 39), flash (6 a 11), serial (1 e 3) ou repetido imprime, a cada 10 s, "[config] A vaga 4 usa o GPIO 6, que é da memória flash. Troque em PINO_VAGA." e não chama `publicar()` (o site mostra SEM DADOS; a página local mostra a situação "config" do UX-26). Pinos 0, 2, 5, 12 e 15 só avisam: "[config] A vaga 3 usa o GPIO 12, que pode atrapalhar a partida da placa.". O cabeçalho dos arquivos de placas passa a "Falta conferir PINO_VAGA (um pino por vaga) e preencher o Wi-Fi do campus.". Registrar que a decisão 35 mudou.
**Arquivos.** `bolsao.ino`, `scripts/gerar-placas.ts`, `firmware/LEIAME.md`, `docs/DECISOES.md`.
**Pronto quando.** `grep -nE 'const int +N_VAGAS += *[0-9]'` não acha nada em `firmware/bolsao`. Uma cópia com 8 pinos compila e, em bancada, publica 8 caracteres. Com o GPIO 6, a placa imprime a linha `[config]` a cada 10 s, nenhuma linha `[http]`, e o site fica em SEM DADOS.

### UX-22 · Timeouts do TLS abaixo do watchdog
(ESP-07) · Telas: esp32 · Impacto: médio · Esforço: P · Depende de: UX-20

**Problema.** O handshake do `WiFiClientSecure` espera até 120 s (NetworkClientSecure.cpp:41), e o watchdog é de 30 s com pânico (bolsao.ino:287-291). Um portal que aceita a porta 443 e não fala TLS reinicia a placa em ciclo, derrubando a rede Estacionamento-X.

**Fazer.** No `setup`, depois de `tls.setInsecure()`, `tls.setHandshakeTimeout(6);` (segundos). Em `publicar()`, `http.setConnectTimeout(4000);` e manter `http.setTimeout(5000)`. O pior envio preso fica perto de 15 s.
**Arquivos.** `bolsao.ino`.
**Pronto quando.** Em bancada, com `SUPABASE_URL` apontando para um PC que aceita TCP na 443 e não responde (`ncat -l 443 -k`) e um token de teste, o serial mostra "[http] sem resposta do Supabase" a cada ciclo e a placa não reinicia em 5 min.

### UX-23 · Página local da placa sem número velho
(ESP-01, ESP-09, EST-07, ACE-04, VIS-15, TXT-11, PRD-07) · Telas: esp32 · Impacto: alto · Esforço: P · Depende de: UX-20, UX-22

**Problema.** Quando o fetch falha, o catch (bolsao.ino:232-236) só troca classes: "3 vagas livres" continua 6 s depois da queda, com a grade Livre/Ocupada a 35% de opacidade (esp-360-queda.png). O fetch não tem timeout e o `setInterval` de 1 s acumula 6 requisições abertas enquanto o loop está preso num POST (esp-360-travado.png). Antes da primeira resposta, "--" aparece com borda e ponto verdes.

**Fazer.** No script da `PAGINA`:
1. Busca separada do desenho: `async function ciclo(){ const c = new AbortController(); const t = setTimeout(() => c.abort(), 3000); try { const r = await fetch('/status', {cache:'no-store', signal:c.signal}); if (!r.ok) throw new Error(r.status); ultimoDado = await r.json(); ultimoOk = performance.now(); falhou = false; } catch (e) { falhou = true; } finally { clearTimeout(t); setTimeout(ciclo, 1000); } }`. Nunca há duas consultas abertas.
2. `setInterval(desenhar, 1000)` calcula `semDados = ultimoOk === null || performance.now() - ultimoOk > LIMITE_LOCAL_MS`, com `const LIMITE_LOCAL_MS = 20000; // a página fala direto com a placa; 20 s cobre um envio preso e é mais rígido que os 30 s do site`.
3. Com `semDados`: `#livres` mostra o triângulo de alerta (SVG inline com os paths do ícone de alerta do site) e "SEM DADOS"; `#rotulo` diz "A placa não responde há N s." ou "A página ainda não recebeu dados da placa."; o resumo ganha borda tracejada `#fbbf24`, fundo `#2a2a2a` e as listras de `.listrado`, copiadas inline; o pátio é esvaziado (`patio.innerHTML = ''`). O HTML já sai nesse estado, sem "--" e sem verde.
4. Entre a primeira falha e os 20 s, o número continua e o rodapé diz "A placa não responde há N s.". Com `falhou` falso, o rodapé diz "A página consulta a placa a cada segundo.".
5. Remover `.patio.offline .vaga { opacity:.35; }` (linha 200). `aria-hidden="true"` no `.icone`; `role="status"` no `#atualizado`.

**Arquivos.** `bolsao.ino`, `tests/e2e/esp-pagina.spec.ts`.
**Pronto quando.** `tests/e2e/esp-pagina.spec.ts` extrai o texto entre `R"rawliteral(` e `)rawliteral"`, instala `page.clock` e serve a página em `http://192.168.4.1/` com `/status` falso (`page.goto`, para o fetch relativo ter origem). Confere: antes da primeira resposta, nenhum `.vaga.livre` ou `.vaga.ocupada`, "SEM DADOS" visível, `#livres` sem dígito; depois de uma resposta boa e da rota abortada, `runFor(21000)` dá o mesmo; com a rota pendurada por 21 s, também; com respostas de 9 s, nunca há mais de uma requisição `/status` aberta (`request`, `requestfinished`, `requestfailed`) e "A placa não responde há" aparece antes de 5 s; uma rota `**` que aborta tudo fora de `http://192.168.4.1/` conta 0. A placa compila.

### UX-24 · Resposta do envio classificada no monitor serial
(ESP-06) · Telas: esp32 · Impacto: médio · Esforço: P · Depende de: UX-20

**Problema.** 401 e 403 saem juntos como "token recusado" (bolsao.ino:156). Medido: chave errada dá 401, token errado dá 403. Portal cativo que responde 200 conta como envio certo, porque o TLS aceita qualquer certificado (linha 270). Schema não exposto dá 406, mas o LEIAME:28 e o DEPLOY:97 dizem 404.

**Fazer.** Ler `String corpo = http.getString();`. Sucesso só com `codigo == 200 && corpo.indexOf("\"atualizados\"") >= 0`. Guardar o caso no enum `situacaoEnvio` (ok, chave, token, dados, funcao, schema, portal, sem_internet, outro), usado pelo UX-26. Mensagens: ok → "[http] ok, 3 de 5 livres, 180 ms, sinal -67 dBm"; 200 sem "atualizados" ou 300 a 399 → "[http] a rede respondeu no lugar do Supabase ({codigo}). Isso acontece quando ela pede login no navegador. Peça à TI para liberar o MAC {mac}."; 401 → "[http] chave recusada (401). A SUPABASE_ANON_KEY deste arquivo está errada. Peça ao Matheus um arquivo novo."; 403 → "[http] token recusado (403). Avise o Matheus: o token deste arquivo foi trocado ou desligado."; 400 → "[http] dados recusados (400): {corpo}"; 404 → "[http] o Supabase não achou a função publicar (404). Avise o Matheus."; 406 → "[http] o schema vagas não está liberado na API (406). Avise o Matheus."; negativo → "[http] sem resposta do Supabase ({texto}). Confira se a rede tem internet.", com -1 "não conectou", -5 "a conexão caiu", -11 "demorou demais para responder" e outros "erro N"; outro código → "[http] erro {codigo}: {120 primeiros caracteres do corpo}". Corrigir `LEIAME.md:28` e `DEPLOY.md:97`.
**Arquivos.** `bolsao.ino`, `firmware/LEIAME.md`, `docs/DEPLOY.md`.
**Pronto quando.** Em bancada: chave com um caractere trocado imprime "chave recusada (401)"; token trocado imprime "token recusado (403)"; um servidor HTTPS de teste que responde 200 com `<html>login</html>` imprime "a rede respondeu no lugar do Supabase (200)" (302 dá a mesma frase com 302). Use um token de teste.

### UX-25 · Partida e Wi-Fi explicados no monitor serial
(ESP-04, ESP-08) · Telas: esp32 · Impacto: alto · Esforço: P · Depende de: UX-20

**Problema.** Depois de "[wifi] conectando em REDE", a placa fica 30 s em silêncio e diz só "sem conexão há 30 s". Não diz se a rede não foi achada, se a senha foi recusada ou se a rede é aberta e o arquivo tem senha (o core exige WPA2 com senha preenchida). Não há sinal, versão, motivo do reinício nem mapa de pinos. Valores de exemplo ("NOME-DA-REDE") seguem sem aviso.

**Fazer.**
1. `WiFi.onEvent(aoDesconectar, ARDUINO_EVENT_WIFI_STA_DISCONNECTED)`: o callback só guarda `info.wifi_sta_disconnected.reason` numa `volatile`; o loop imprime quando muda. Tradução: 201 "a rede {SSID} não foi encontrada. Confira o nome. A placa só pega 2,4 GHz."; 210 "a rede {SSID} usa outro tipo de segurança. Se ela pede usuário, preencha WIFI_USUARIO."; 211 "a rede {SSID} é aberta ou usa segurança antiga. Se ela não pede senha, deixe WIFI_SENHA = \"\"."; 15, 23, 202, 204 "a rede recusou a senha" (com usuário: "a rede recusou o usuário ou a senha"); 200 "o sinal da rede sumiu"; 212 "o sinal está fraco demais"; outro "a conexão falhou (código N)". Linha: "[wifi] não conectou: {motivo}. A placa tenta de novo em 30 s.". Ao conectar: "[wifi] conectado em {SSID}, IP 10.20.4.37, sinal -71 dBm (fraco)" (bom ≥ -67, fraco -68 a -80, muito fraco < -80). A cada 60 s, abaixo de -80: "[wifi] sinal muito fraco (-84 dBm). Aproxime a placa do roteador ou use antena externa.".
2. Bloco de partida: "[bolsao] Bloco A (ID A), firmware 2026-10-14" / "[bolsao] reinício: {motivo}" / "[vagas] 5 vagas: 1=GPIO32 2=GPIO33 ..." / "[local] rede Estacionamento-A, senha vagas1234, página http://192.168.4.1" / "[wifi] MAC 24:6F:28:AA:BB:CC (a TI libera este)" / "[wifi] conectando em SENAI-IOT". MAC de `WiFi.macAddress()`, nunca `softAPmacAddress()`. Motivo de `esp_reset_reason()`: POWERON "ligou na energia"; BROWNOUT "a tensão caiu. Confira a fonte e o cabo."; TASK_WDT, INT_WDT, WDT "travou e o watchdog reiniciou"; PANIC "erro no programa"; SW "reiniciada pelo programa"; outro "código N".
3. Valores de exemplo (`WIFI_SSID == "NOME-DA-REDE"`, `WIFI_SENHA == "senha-da-rede"`, `TOKEN_CENTRAL` começando com "cole-aqui", `SUPABASE_URL` com "xxxxxxxx", `SUPABASE_ANON_KEY == "eyJ..."`): uma linha por campo, por exemplo "[config] Falta preencher WIFI_SSID no topo do arquivo." (senha: "... Se a rede não pede senha, deixe WIFI_SENHA = \"\"."), repetidas a cada 10 s, sem chamar `conectarWifi()` nem `publicar()`. A rede local continua no ar.
4. Os mesmos textos vão nos campos `motivo_wifi` e `reinicio` do `/status` (UX-26).

**Arquivos.** `bolsao.ino`, `firmware/LEIAME.md`.
**Pronto quando.** Em bancada: senha errada mostra "a rede recusou a senha" em até 15 s; SSID inexistente, "não foi encontrada"; rede aberta com senha preenchida, "é aberta ou usa segurança antiga"; a linha de conectado traz o sinal; o `.ino` do repositório sem preencher mostra as linhas `[config]` e nenhuma "conectando em NOME-DA-REDE"; desligar e ligar mostra "ligou na energia"; um `while (true) {}` de teste mostra "travou e o watchdog reiniciou"; o MAC impresso é o da lista de clientes de um roteador.

### UX-26 · Diagnóstico na página local da placa
(ESP-02, PRD-07, TXT-11) · Telas: esp32 · Impacto: alto · Esforço: M · Depende de: UX-23, UX-24, UX-25

**Problema.** O `/status` não traz Wi-Fi, IP, MAC, sinal nem idade do envio, e a página ignora o código HTTP. Token recusado e placa sem Wi-Fi geram telas idênticas pixel a pixel. Depois de uma queda de Wi-Fi, `http` continua 200 (bolsao.ino:134). O João tem só o celular no estacionamento.

**Fazer.**
1. `/status` ganha: `envio` (texto do enum do UX-24 mais `config`, `sem_wifi` e `aguardando`), `wifi`, `rede` (`WIFI_SSID`), `sinal` (`WiFi.RSSI()`, 0 sem Wi-Fi), `ip`, `mac` (`WiFi.macAddress()`), `motivo_wifi`, `ultimo_ok_s` (-1 se nunca), `ligada_s`, `reinicio`, `versao` e `pinos`. Regras de `envio`, na ordem: `config` quando falta preencher; `sem_wifi` sempre que `WiFi.status() != WL_CONNECTED`; `aguardando` com Wi-Fi e sem tentativa desde que conectou; `ok` só com resposta válida há menos de 30 s, com o comentário "30 s, igual ao LIMITE_FRESCOR_MS do site; não use só ultimoCodigoHttp, ele não muda quando o Wi-Fi cai"; os outros vêm do enum. Senha, token e chave nunca entram no JSON.
2. Faixa abaixo do título (`aria-live="polite"`, texto trocado só quando muda), verde com ✓ em `ok` e âmbar com triângulo nos outros: config "Falta preencher o Wi-Fi do campus no arquivo da placa."; sem_wifi "A placa está sem o Wi-Fi do campus. Motivo: {motivo_wifi}. Ela tenta de novo sozinha."; aguardando "A placa entrou no Wi-Fi. O próximo envio sai em até 10 s."; ok "A placa está enviando para o site. O último envio foi há {ultimo_ok_s} s."; chave "O site recusou a chave do Supabase (401). Peça ao Matheus um arquivo novo."; token "O site recusou o token desta placa (403). Avise o Matheus."; dados "O banco recusou os dados (400). Confira ID_BOLSAO no arquivo."; funcao "O site não achou a função de envio (404). Avise o Matheus."; schema "O site não liberou o schema vagas (406). Avise o Matheus."; portal "A rede pediu login no navegador. Peça à TI para liberar o MAC {mac}."; sem_internet "A placa tem Wi-Fi, mas o site não respondeu. Confira se a rede libera a internet."; outro "O último envio certo foi há {ultimo_ok_s} s. Avise o Matheus.". Fora de `ok`, uma segunda linha: "Enquanto isso, o site mostra SEM DADOS para o {nome}.". Em SEM DADOS do UX-23, a faixa diz "A placa não responde há N s.".
3. Abaixo da grade, "Detalhes da placa": "Wi-Fi do campus: {rede} · sinal bom|fraco|muito fraco ({sinal} dBm)", "IP da placa", "MAC (a TI libera este)", "Ligada há", "Último reinício", "Firmware". Em SEM DADOS, "(dados de N s atrás)".
4. Título da aba "Placa do Bloco A" a partir de `d.nome`; antes, "Placa do estacionamento". Subtítulo: "Página local da placa. Os motoristas usam vagas.rubysistemas.com.br.".

**Arquivos.** `bolsao.ino`, `tests/e2e/esp-pagina.spec.ts`, `firmware/LEIAME.md`.
**Pronto quando.** Um caso de E2E por valor de `envio` confere o texto exato da faixa; `token` e `sem_wifi` diferem; o MAC aparece em `portal`; `{envio:"sem_wifi", wifi:false, nuvem:false, http:200}` não mostra "enviando para o site". `grep` confere que `statusJson` não cita `TOKEN_CENTRAL`, `WIFI_SENHA`, `SUPABASE_ANON_KEY` nem `softAPmacAddress`. Compila, e a flash usada fica abaixo de 90 %.

### UX-27 · LEIAME para quem grava e instala a placa
(ESP-05) · Telas: esp32 · Impacto: médio · Esforço: M · Depende de: UX-21 a UX-26

**Problema.** O LEIAME (LEIAME.md:13-18) manda preencher o Supabase e gerar token, que o João não faz, e não cita `placas/`, o core 3.x, a rede Estacionamento-X, os pinos usáveis nem como conferir no site. Com o core 2.x, a compilação para com um erro que não aponta a causa. Entra na Onda 1 porque o João grava as placas uma vez com tudo desta onda.

**Fazer.**
1. Em `bolsao.ino`, depois dos includes: `#if !defined(ESP_ARDUINO_VERSION_MAJOR) || ESP_ARDUINO_VERSION_MAJOR < 3` / `#error "Este código precisa da placa esp32 versão 3.x. No Arduino IDE: Ferramentas > Placa > Gerenciador de Placas > esp32 (Espressif) > instale a 3.3.x."` / `#endif`.
2. LEIAME abre com "Instalar uma placa", em passos numerados: URL adicional `https://espressif.github.io/arduino-esp32/package_esp32_index.json`, esp32 3.3.x, placa "ESP32 Dev Module"; abrir `bolsao_X.ino`; conferir `PINO_VAGA`; preencher `WIFI_SSID`, `WIFI_SENHA` (e `WIFI_USUARIO` se a rede pedir; rede sem senha: `WIFI_SENHA = ""`); gravar; monitor serial em 115200 comparado com a partida do UX-25, copiada no texto; entrar em Estacionamento-X (UX-51); tampar cada sensor e conferir a vaga certa (UX-53); abrir vagas.rubysistemas.com.br e ver o bloco sair de SEM DADOS em até 10 s; anotar as vagas de PCD e idoso pelo número da página e mandar ao Matheus.
3. Tabela de pinos: sensor 4, 13, 14, 16 a 19, 21 a 23, 25 a 27, 32, 33; só entrada 34, 35, 36, 39; evitar 0, 2, 5, 12, 15; nunca 1, 3, 6 a 11. Máximo de 19 sensores por placa.
4. Tabela "Se der erro" com a mensagem exata: o `#error`, `WPA2_AUTH_PEAP was not declared` ou `esp_task_wdt_config_t was not declared` → atualizar a placa esp32; `Failed to connect to ESP32: Timed out waiting for packet header` → segurar BOOT ao começar a gravar; porta COM ausente → driver CP210x ou CH340; e as mensagens `[config]`, `[wifi]` e `[http]` dos UX-21, UX-24 e UX-25.
5. Token e Supabase vão para a seção "Para o Matheus". Nota: enquanto a placa procura o Wi-Fi do campus, o celular pode cair da rede Estacionamento-X; basta entrar de novo.
6. Registrar a pergunta ao João sobre bolsão com mais de 19 vagas.

**Arquivos.** `firmware/LEIAME.md`, `bolsao.ino`, `docs/DECISOES.md`.
**Pronto quando.** O LEIAME abre com "Instalar uma placa" e tem as partes 2 a 5; `grep -n "placas/"` acha a pasta; `npm run token:gerar` só aparece em "Para o Matheus"; o `#if/#error` fica antes de `conectarWifi`. Num Arduino IDE com esp32 2.0.17, a compilação para com a frase em português.

---

## Onda 2: refinamento visual e melhorias médias

### UX-28 · Ícones próprios num arquivo só
(VIS-10) · Telas: celular, guarita, mapa · Impacto: baixo · Esforço: P

**Fazer.** `src/components/icones.tsx` com SVG inline em `viewBox 0 0 24 24`, `stroke currentColor`, `strokeWidth 2.2`, pontas redondas, `aria-hidden="true"` e `data-icone`: `alerta` (movido de cartao-bolsao.tsx:72-80), `x` (movido de grade-vagas.tsx:37-39), `carro` (visto de cima), `cadeirante`, `idoso` (pessoa com bengala), `bloqueio` (círculo com barra) e `seta`. Em `regras.ts`, ao lado de `ROTULOS`, o mapa tipo → ícone (pcd → cadeirante, idoso → idoso). O LOTADO do cartão e da coluna ganha `bloqueio`. Na seção, "PCD: 2 livres" ganha o ícone de 1em.
**Pronto quando.** Vitest: cada ícone com `data-icone` e `aria-hidden`. E2E: cartão lotado tem `[data-icone=bloqueio]` e não tem `alerta`; cartão sem dados tem `alerta` e não tem `bloqueio`; `grep 'function IconeAlerta' src/components/cartao-bolsao.tsx` não acha nada.

### UX-29 · Um mapa de estilo por situação e escala de texto da guarita em tokens
(VIS-12) · Telas: todas · Impacto: baixo · Esforço: M · Depende de: UX-08, UX-28

**Problema.** Há cinco tabelas de estilo por situação (cartao-bolsao.tsx:6-11, secao-bolsao.tsx:6-18, tela-guarita.tsx:51-57 e 71-76, mapa-campus.tsx:9-14), já divergentes no SEM DADOS, e 13 `clamp()` soltos na guarita.
**Fazer.** `src/lib/vagas/visual.ts` com `VISUAL: Record<Situacao, { cor; fundo; borda; tracejado; listrado; icone: "alerta" | "bloqueio" | null; rotulo; rotuloCurto }>`, com nomes de classe completos. Os componentes leem daí. No `@theme` de `globals.css`, os tamanhos da guarita do UX-08 viram tokens `--text-g-letra`, `--text-g-numero`, `--text-g-faixa`, `--text-g-detalhe`, `--text-g-corpo`, `--text-g-relogio` e `--text-g-legenda`, com os mesmos valores.
**Pronto quando.** `grep 'clamp(' src/components/tela-guarita.tsx` não acha nada; nenhum componente tem `Record<Situacao, ...>` próprio; unitário: só `VISUAL['sem-dados']` tem `listrado`, e ele tem `tracejado` e `icone: 'alerta'`; UX-01 e os E2E atuais passam.

### UX-30 · Guarita: selo "INDIQUE ESTE" e SEM DADOS visível de longe
(VIG-10, VIS-13, VIG-11) · Telas: guarita · Impacto: médio · Esforço: P · Depende de: UX-08

**Problema.** O indicado só tem `ring-4 ring-offset-4` (tela-guarita.tsx:91), que a 3 m parece uma borda comum (VIG-a-3m-visao-20-40-misto.png). As listras do SEM DADOS têm 1,21:1 e somem a 3 m, e "poucas" e "sem dados" têm cores com 1,29:1 entre si.
**Fazer.** Tirar o anel. Na coluna indicada, selo `absolute` centrado em `-top-[0.8em]`, `data-testid="selo-indicado"`, fundo `var(--livre)`, texto `var(--fundo)` (8,12:1), `font-black uppercase`, `text-[clamp(0.9rem,1.7vw,2.2rem)]`, `px-[0.8em] py-[0.2em] rounded-full`, com o ícone `seta` para baixo e o texto "INDIQUE ESTE". A seção das colunas ganha `padding-top` igual à metade da altura do selo. Em `globals.css`, `.listrado-forte { background-image: repeating-linear-gradient(135deg, transparent 0 18px, rgb(255 255 255 / 0.1) 18px 36px); }`, usado na coluna SEM DADOS, na faixa nos estados de alerta e na barra em SEM DADOS. Coluna SEM DADOS com `border-[6px] border-dashed`. O `.listrado` continua no celular.
**Pronto quando.** E2E em 1024x768 e 1366x768 com A 12 livres, C lotado e H sem dados: só `guarita-A` tem `selo-indicado` visível com "INDIQUE ESTE", dentro da viewport; com A e C lotados e H sem dados, nenhum selo; `guarita-H` com `background-image` contendo `rgba(255, 255, 255, 0.1)` e `18px` e `border-top-width: 6px`; `guarita-A` com 3px. Unitário: `#9fb0bf` e `#fbbf24` sobre `#3f3f3f` ≥ 4,5:1.

### UX-31 · Guarita: linha de detalhe e vagas especiais por extenso
(VIG-15, TXT-07, TXT-08) · Telas: guarita · Impacto: médio · Esforço: P · Depende de: UX-08

**Problema.** "de 40 · PCD: 2 · Idoso: 0 · agora" (tela-guarita.tsx:122-139) tem 17 px em cinza; "PCD: 2" não diz se é livre ou total; "agora" sozinho não diz o quê.
**Fazer.** Em `regras.ts`, `textoEspecial(e)`: "PCD: 2 livres", "PCD: 1 livre", "Idoso: nenhuma livre" (D13). A linha de baixo vira "de 40 vagas · atualizado agora" (ou "atualizado há 12 s"). Abaixo, só com especiais e dado fresco, `<p data-testid={`especiais-${id}`} className="text-[clamp(0.9rem,1.5vw,1.8rem)] font-bold text-[var(--vaga-especial)] text-balance">` com os tipos separados por " · ".
**Pronto quando.** Unitários de `textoEspecial` com 0, 1 e 2. E2E 1366x768, A de 40 com `{pcd:[0,1], idoso:[2]}`, 0 e 1 livres e 2 ocupada: `especiais-A` com "PCD: 2 livres · Idoso: nenhuma livre" e ≥ 20 px; `meio-A` não transborda; `guarita-A` contém "de 40 vagas" e "atualizado agora"; com H sem dados, `especiais-H` não existe. "Cabe sem rolagem" passa com A de 500 e especiais em 1024x768.

### UX-32 · Guarita com zoom ou escala do Windows
(ACE-08) · Telas: guarita · Impacto: baixo · Esforço: P · Depende de: UX-08

**Problema.** Com zoom de 200% em 1366x768 (683x384 de CSS), há 10 sobreposições; com os tamanhos do UX-08, até 911x512 ganha sobreposições. A tela tem `h-dvh overflow-hidden` (linha 22).
**Fazer.** `@custom-variant baixa (@media (max-height: 599px));` em `globals.css`. Na guarita: `main` com `baixa:h-auto baixa:min-h-dvh baixa:overflow-visible`; seção das colunas `baixa:flex-none`; faixa `baixa:sticky baixa:bottom-0 baixa:z-10`; h1 troca `truncate` por `break-words`. Registrar o desvio da especificação 3.5 item 3 (sem rolagem), que só vale abaixo de 600 px de altura de CSS.
**Pronto quando.** E2E em 683x384 (`deviceScaleFactor: 2`) e 911x512 (1,5), misto e com um bloco lotado: nenhum texto de coluna cruza outro; a faixa tem `bottom` ≤ altura ao abrir e depois de rolar até o fim; `scrollWidth` ≤ largura. "Cabe sem rolagem" em 1366x768 e 1920x1080 continua passando.

### UX-33 · Indicação estável entre blocos parecidos
(EST-10) · Telas: guarita, celular · Impacto: médio · Esforço: P · Depende de: UX-07

**Problema.** Alternando A=12/H=11 e A=11/H=12, a faixa e o selo trocaram de bloco a cada atualização, enquanto o vigia fala com o motorista.
**Fazer.** `orientacaoGuarita(..., anteriorId?: string | null)` mantém o anterior se ele está livre ou poucas, com dado fresco, ≥ 3 livres e `livres >= maior - 3`; senão, o máximo, com empate pela ordem. `TelaGuarita` guarda `anteriorId` num `useRef`. `orientacaoMotorista` usa o mesmo mecanismo no `PainelVagas`. Registrar.
**Pronto quando.** Unitários: A=12, H=11, anterior H → H; A=15, H=11, anterior H → A; H lotado → A; H sem dados → nunca H; H 2 e A 3, anterior H → A. E2E: a sequência alternada gera no máximo uma troca de `data-indicado`.

### UX-34 · Demonstração clara em todas as telas
(VIG-07, EST-13, TXT-10, VIS-12, PRD-14) · Telas: celular, guarita · Impacto: médio · Esforço: P · Depende de: UX-08

**Problema.** Na guarita, a faixa de demonstração tem 17,8 px e o status 15 px; a 3 m, a tela parece real, e a faixa de orientação diz "Mais vagas agora: Bloco H, 23 livres." em verde. No celular, a faixa sai da tela depois de rolar e não tem saída para os dados reais. A demonstração usa as cores de "poucas".
**Fazer.**
1. Tokens `--demo: #c4b5fd` e `--demo-fundo: #241a3d` (8,82:1), com `--color-demo` no `@theme`, para a faixa e o ponto de "Simulação".
2. Celular: `faixa-demo` com `sticky top-0 z-20`, texto "Demonstração: os números desta página são simulados e não vêm do estacionamento." e `<a href="/" className="inline-flex min-h-11 items-center underline">Ver as vagas reais</a>` (um `<a>` comum, para recarregar e sair do modo demo).
3. Guarita: o h1 vira `<h1 data-testid="faixa-demo" className="text-[clamp(1.2rem,2.6vw,3rem)] font-black text-demo">` com o ícone de alerta e "Demonstração: números simulados"; `<Avisos semFaixaDemo>`; o detalhe da faixa vira "Não use estes números para orientar motoristas.".
4. `document.title` "Demonstração · Vagas SENAI Blumenau" em `/?demo=1` e "Demonstração · Guarita" em `/guarita?demo=1` (sem número).
5. Registrar que na guarita a faixa da especificação 3.1 vira o título do cabeçalho.
**Pronto quando.** E2E: em 360x740 com `scrollTo(0, 900)`, `faixa-demo` com `top` ≥ 0 e `bottom` ≤ altura; o link "Ver as vagas reais" leva a `/` e `faixa-demo` some; em `/guarita?demo=1` 1366x768, uma só `faixa-demo`, dentro do `header`, font-size ≥ 34 px, `orientacao` com "Não use estes números para orientar motoristas.", `scrollHeight` ≤ 768; `page.title()` com "Demonstração" só em demo; `grep poucas src/components/avisos.tsx` não acha nada. UX-01 passa.

### UX-35 · Demonstração com roteiro igual em todos os aparelhos
(PRD-02, EST-13) · Telas: celular, guarita · Impacto: alto · Esforço: M · Depende de: UX-34

**Problema.** A demonstração sorteia com `Math.random` e conta o ciclo desde a abertura (fonte-demo.ts:16-61). Celular e guarita discordam no mesmo instante (A 18 contra A 14). O H fica em SEM DADOS 61 s em 600 s, em trechos de 11 a 15 s; o LOTADO pisca 2 a 4 s.
**Fazer.** Reescrever `fonte-demo.ts` em torno de `estadoDemo(ms): { bolsoes; cena: { numero: 1|2|3|4; texto; proximaEmS } }`, só função do relógio. Ciclo de 180 s alinhado: `inicio = Math.floor(ms / 180000) * 180000`; passos a cada 3 s; livres por pontos-chave com interpolação linear, no máximo 1 vaga por passo:
- A (40, PCD 0 e 1): 0 s = 22, 60 s = 8, 105 s = 8, 174 s = 22.
- C (24, PCD 0, idoso 1): 0 s = 10, 60 s = 3, 69 s = 0, 105 s = 0, 111 s = 2, 174 s = 10.
- H (60, PCD 0 a 2): 0 s = 35, 60 s = 20, 105 s = 33; de 105 s a 171 s não muda e `atualizado_em` fica em 105 s; volta em 174 s com 34 e em 177 s com 35.
Posições que trocam vêm de um mulberry32 com semente fixa por bloco, refazendo o ciclo desde o passo 0. O SEM DADOS do H sai de `situacao()` com o `atualizado_em` congelado. `assinar()` dispara no próximo múltiplo de 3000 ms. Cenas: 1 (0-60 s) "O estacionamento enche no começo da noite."; 2 (60-105 s) "O Bloco C lotou. A tela indica outro bloco."; 3 (105-174 s) "Os sensores do Bloco H pararam de mandar dados. Depois de 30 segundos sem dado, a tela mostra SEM DADOS."; 4 (174-180 s) "Os sensores do Bloco H voltaram a mandar dados.". No celular, a faixa ganha `<p data-testid="cena-demo">Cena 3 de 4: {texto} Próxima cena em {s} s.</p>`; a guarita não mostra a cena. Registrar o desvio da especificação 3.1.
**Pronto quando.** `fonte-demo.test.ts`: mesmo `t` dá o mesmo resultado; nenhum bloco muda mais de 1 por passo, inclusive na virada; C = 0 em início + 70 s; H "sem-dados" em + 140 s, não em + 120 s, e volta em + 174 s; A nunca sem dados. E2E: `/?demo=1` e `/guarita?demo=1` com `page.clock` no mesmo instante mostram o mesmo número; em + 140 s, `cartao-H` e `guarita-H` em "sem-dados" e `cena-demo` com "Cena 3 de 4"; `/guarita?demo=1` em 1024x768 sem rolagem.

### UX-36 · Mapa: legível, sem números e depois das seções
(MOT-04, ACE-09, VIS-03, EST-16, EST-14) · Telas: mapa, celular · Impacto: médio · Esforço: M · Depende de: UX-28

**Problema.** A 360 px, o SVG tem escala 0,47 e os textos ficam entre 4,2 e 5,7 px. O mapa ocupa y=288 a 477, e com 5 vagas por bloco a seção H começa abaixo da dobra (y=777). Repete os cartões, escreve "1 livres", "LOTADO" vaza do retângulo do A, SEM DADOS não tem listras nem ícone. A Rua São Paulo está na faixa de baixo, mas no mapa oficial ela é a faixa vertical da esquerda. O `aria-label` não diz onde fica cada bloco.
**Fazer.**
1. Em `painel-vagas.tsx`, o mapa vai para depois das seções, com `<h2 className="text-lg font-bold">Como chegar</h2>`.
2. Em `mapa-campus.tsx`, sair número, "livres", "LOTADO", "SEM DADOS" e "Bolsão X". Cada estacionamento fica com fundo e borda da situação e a letra centrada em `fontSize 40`, `fontWeight 900`, `fill var(--texto)`. Livre e poucas: só cor. Lotado: ícone `bloqueio` de 32 unidades acima da letra quando couber (largura ≥ 90). SEM DADOS: borda tracejada, `<pattern id="mapa-listras">` de listras a 45° (`rgb(255 255 255 / 0.10)`, 8 unidades) num segundo `<rect data-listras="sim">` e ícone `alerta` de 32 unidades quando couber.
3. "Rua São Paulo" na faixa da esquerda, `rotate(-90)`, `fontSize 26`, com a faixa em ~36 unidades e o resto deslocado à direita; a faixa de baixo fica sem nome. Guarita com `fill #1d4ed8`, sem texto dentro; "Guarita" fora da caixa, sem encostar no A (viewBox `0 0 640 300`). Prédios com `fill var(--borda)`, `stroke #4a5b6b`; letras dos prédios em `fontSize 24`, `var(--texto-secundario)`. Nenhum `<text>` abaixo de 24 unidades. Cada `<g>` de estacionamento com `<title>` "Bloco A: livre", "Bloco C: lotado", "Bloco H: sem dados".
4. `aria-label`: "Mapa do campus. A guarita fica na Rua São Paulo, no canto de baixo à esquerda. O estacionamento do Bloco A fica entre os blocos A e B, perto da guarita. O do Bloco C fica abaixo do bloco C. O do Bloco H fica abaixo do bloco H, no lado direito do campus." Figcaption: "Mapa simplificado. A guarita é o quadrado azul no canto de baixo, à esquerda." Conferir as posições com o João antes de publicar.
5. Registrar o desvio da especificação 3.5.1 (D7).
**Pronto quando.** E2E 360x740 misto: topo de `secao-C` < 740; para todo `<text>`, `fontSize × (largura do svg / largura do viewBox)` ≥ 11; `mapa` sem dígitos; o mapa vem depois de `secao-H` no DOM; a letra de cada estacionamento fica dentro do retângulo e nenhum par de `<text>` se cruza; `mapa-H` com `data-situacao="sem-dados"`, `stroke-dasharray`, `[data-listras=sim]` e `[data-icone=alerta]`; `mapa-C` lotado com `[data-icone=bloqueio]` e sem listras. Reescrever `extras.spec.ts:6-20` para conferir `data-situacao` de A, C e H.

### UX-37 · Seção do celular: linha de detalhe em partes
(MOT-07, TXT-07, EST-14) · Telas: celular · Impacto: médio · Esforço: P · Depende de: UX-14, UX-28

**Problema.** `secao-bolsao.tsx:41-57` junta total, especiais e idade numa frase de 14 px cinza que quebra "Idoso: 0" de "livres" (celular-360-misto.png) e escreve "1 de 1 livres".
**Fazer.** Três partes: (1) `text-base font-bold`: "12 livres de 40" ("1 livre de 24"); com especiais, "10 livres de 38 vagas comuns"; (2) com especiais e dado fresco, `flex flex-wrap gap-2` com um chip por tipo: `<span data-testid="especial-pcd" className="whitespace-nowrap rounded-full border border-[var(--vaga-especial)] px-2 py-0.5 text-sm text-texto">` com o ícone do tipo e `textoEspecial`; (3) `text-xs text-texto-secundario`: "Atualizado agora" ou "Atualizado há 12 s". Em SEM DADOS, o texto longo do UX-05 e nenhum chip.
**Pronto quando.** E2E 360x740 misto: `especial-pcd` e `especial-idoso` com altura < 30 px; `especial-idoso` com "Idoso: nenhuma livre"; `secao-A` com "Atualizado agora"; com A de 1 vaga livre, "1 livre de"; depois de 32 s, nenhum `[data-testid^=especial-]`. Atualizar `pagina.spec.ts:56-58, 95` e `painel-vagas.test.tsx:75`.

### UX-38 · Até 12 vagas, a grade desenha vagas numeradas
(VIS-02) · Telas: celular · Impacto: médio · Esforço: M · Depende de: UX-11, UX-28

**Problema.** As placas têm 5 vagas. A grade mostra 5 quadrados de 16 px num canto de 280 px e não numera as vagas, então a banca não liga a célula à vaga da maquete. A página local já mostra "Vaga 1", "Vaga 2".
**Fazer.** Com dado e total ≤ 12: `colunas = total <= 6 ? total : Math.ceil(total / 2)`, `gridTemplateColumns: repeat(colunas, minmax(0, 56px))`, `gap` 6 px. Cada vaga: número `i+1` em 12 px `font-bold tabular-nums text-texto-secundario` em cima e um ladrilho `aspect-[3/4] rounded-md` embaixo, mantendo `data-vaga`, `data-tipo` e `title`. Livre: `var(--vaga-livre)`; especial livre: ícone do tipo com 60% da largura em `var(--fundo)` e o contorno do UX-11; ocupada: `var(--vaga-ocupada)` com o ícone `carro` em `var(--fundo)`. Com 13 ou mais, a grade de hoje. Registrar o desvio da especificação 3.3.3.
**Pronto quando.** E2E 360x740 com A "01011" e `{pcd:[0]}`: cada `[data-vaga]` ≥ 40 px, números 1 a 5 na ordem, ocupadas com `[data-icone=carro]`, `[data-tipo=pcd]` com `[data-icone=cadeirante]`; com 12 vagas, 2 linhas e ≥ 40 px; com 13, células de 16 px. `pagina.spec.ts:25` passa.

### UX-39 · Tocar no cartão rola até a seção e mostra onde parou
(MOT-10) · Telas: celular · Impacto: baixo · Esforço: P · Depende de: UX-19

**Problema.** O toque no H rola até o fim (scrollY 404) e deixa a seção na metade de baixo, sem destaque, e o endereço fica com `#bolsao-H`.
**Fazer.** `onClick` no cartão: `preventDefault`; achar `bloco-${id}`; `scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' })` com `reduz` de `prefers-reduced-motion`; `focus({ preventScroll: true })`; `dataset.destaque = 'sim'` e apagar em 1500 ms. Seção com `tabIndex={-1}`. `globals.css`: `[data-destaque="sim"] { outline: 3px solid var(--destaque); outline-offset: 2px; }`. Manter o `href`. Não usar `scroll-behavior: smooth` no `html` (version-16.md, "Scroll Behavior Override").
**Pronto quando.** E2E 360x740: depois de tocar em `cartao-H`, `secao-H` com `data-destaque="sim"` e dentro da viewport; `location.hash` vazio; depois de 2 s, sem `data-destaque`; com `reducedMotion: 'reduce'`, o scroll já está no destino logo depois do toque.

### UX-40 · Animações curtas quando algo muda
(EST-12, VIS-07, MOT-14) · Telas: celular, guarita · Impacto: médio · Esforço: M · Depende de: UX-10, UX-30

**Problema.** Só existe `.pulso` (globals.css:72-90). Quando um bloco lota ou fica sem dados com a tela aberta, só a cor muda; a vaga que mudou na grade não tem sinal; o ponto "Ao vivo" é estático; os números proporcionais mudam de largura.
**Fazer.**
1. `usePulso` devolve "subiu", "desceu" ou `null`. Keyframes `entrar-de-baixo` e `entrar-de-cima` (translateY ±0.35em e opacity 0.2 → 0 e 1), 280 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`, via `data-anim` no número, inclusive o "0".
2. Hook `useMudou(situacao)`: quando a situação muda com `carregou` já true antes, o cartão e a coluna recebem `troca-situacao` (box-shadow de `0 0 0 0` a `0 0 0 10px` em `color-mix(in srgb, var(--cor-estado) 45%, transparent)`, 700 ms); `--cor-estado` vem do `style` de cada situação. Entrada em SEM DADOS anima só a borda e pulsa o texto "SEM DADOS", nunca o conteúdo que sai.
3. `transition-colors duration-300` no cartão, na coluna e nas células com dado.
4. Grade: guarda o `vagas` anterior em `useRef`; células que trocaram com dado fresco antes e depois recebem `vaga-mudou` (outline 2px `var(--texto)` que some em 1,2 s). Ao sair de SEM DADOS, nada pisca.
5. `useVagas` expõe `ultimoDadoMs` (maior `atualizado_em`); `Conexao` desenha sobre o ponto um anel `data-testid="pulso-dado"`, `data-ultimo` e `key={ultimoDadoMs}`, com `ping-unico` (scale 1 → 2,2, opacity 0,6 → 0, 600 ms, uma vez).
6. `tabular-nums` em todo número de vagas. Trocar globals.css:86-90 por `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }`.
**Pronto quando.** Vitest do cartão: 5 → 6 `data-anim="subiu"`; 6 → 4 "desceu"; 4 → 0 "desceu" no "0"; ao virar SEM DADOS, nenhum dígito e nenhum `data-anim`. E2E: inverter a vaga 5 de A dá `vaga-mudou` na 5ª célula em até 300 ms e some em 2 s; ao abrir com tudo fresco, nenhum `troca-situacao` nem `vaga-mudou` por 1 s; UPDATE muda `data-ultimo` de `pulso-dado` e 15 s sem UPDATE não mudam; com `reducedMotion: 'reduce'`, `animation-duration` < 1 ms.

### UX-41 · Leitor de tela: avisos só quando a situação muda
(ACE-06) · Telas: celular, guarita · Impacto: baixo · Esforço: M · Depende de: UX-05

**Problema.** A seção da guarita com `aria-live` (tela-guarita.tsx:36) muda 20 vezes em 10 s ("há 5 s", "há 6 s"). No celular, a lista de cartões (painel-vagas.tsx:18) anuncia só "11", sem o bloco.
**Fazer.** Tirar o `aria-live` de `painel-vagas.tsx:18` e `tela-guarita.tsx:36`. `src/components/anunciador.tsx`: `<p role="status" className="sr-only">` e `useAnuncios(bolsoes, situacoes, causa, carregou)`. Quando `carregou` vira true, guarda as situações sem falar. Depois, só fala quando a situação muda: "Bloco H sem dados. Confira no local."; "Bloco C lotado."; "Bloco C com poucas vagas: 2 livres."; "Bloco A tem vaga: 12 livres.". Conexão: "Conexão perdida. A página tenta de novo a cada 10 s." quando a causa vira "sem-conexao", e "Conexão de volta." quando sai. Frases do mesmo tique saem juntas. Usar em `PainelVagas` e `TelaGuarita`.
**Pronto quando.** Vitest com fonte falsa e timers falsos: depois da primeira carga, `status` vazio; dado de H com 31 s dá "Bloco H sem dados. Confira no local."; A de 12 para 11, ainda livre, não muda o texto. E2E em `/guarita` com dados constantes: um `MutationObserver` em `[aria-live]` e `[role=status]` registra 0 mudanças em 12 s.

### UX-42 · Cartões empilham com fonte grande ou zoom
(ACE-07) · Telas: celular · Impacto: médio · Esforço: M · Depende de: UX-10, UX-14

**Problema.** Com a fonte em 200% ou zoom de 200%, "Bloco" mede 101 px num cartão de 88 px e invade os vizinhos (ACE-celular-360-fonte200.png).
**Fazer.** Em `painel-vagas.tsx`, lista dentro de `<div className="@container">` com `flex flex-col gap-2 @min-[14rem]:flex-row`. Cartão estreito vira linha: `grid grid-cols-[auto_auto_1fr] items-center gap-x-2 min-h-14 px-3 py-2 text-left`, valor com `justify-self-end`; com espaço, o layout do UX-10 via `@min-[14rem]:flex @min-[14rem]:flex-col ...`. Registrar o desvio da especificação 3.3 item 2 (cartões lado a lado só com fonte normal).
**Pronto quando.** E2E em 360x740 com `html{font-size:200%}` e em 180x370 com `deviceScaleFactor: 2`: todo `span` do cartão dentro da caixa, os três cartões com `y` diferentes, `scrollWidth` ≤ largura, "Poucas" e "+2 especiais" dentro do cartão. Com fonte normal em 360 e 320, mesmo `y`.

### UX-43 · Modo de contraste alto do Windows
(ACE-10) · Telas: guarita, celular · Impacto: baixo · Esforço: P

**Fazer.** Em `globals.css`: `@media (forced-colors: active) { [data-vaga="livre"] { forced-color-adjust: none; background: CanvasText; } [data-vaga="ocupada"] { border: 1px solid CanvasText; } [data-vaga="ocupada"] svg { forced-color-adjust: none; color: CanvasText; } [data-tipo] { outline: 2px solid Highlight; outline-offset: 1px; } [data-indicado="sim"] { outline: 4px double CanvasText; outline-offset: 4px; } [data-parte="livre"] { forced-color-adjust: none; background: CanvasText; } [data-testid="status-conexao"] > span { forced-color-adjust: none; background: CanvasText; } }`. Bloco listrado do SEM DADOS fica sem preenchimento.
**Pronto quando.** E2E com `forcedColors: 'active'` no misto: fundo de `[data-vaga=livre]` diferente do da grade; `[data-indicado=sim]` com `outline-style` diferente de `none`; `[data-parte=livre]` com fundo diferente da barra. Conferir no Windows com os temas "Deserto" e "Noite".

### UX-44 · Tablet e desktop com cartões maiores e duas colunas
(VIS-11) · Telas: celular · Impacto: médio · Esforço: M · Depende de: UX-10, UX-36

**Problema.** Em 768 px, cartões de 240 px com número de 36 px; em 1366x768, a seção H fica entre 927 e 1058 px e sobram 300 px vazios de cada lado. A banca pode abrir num notebook ou projetor.
**Fazer.** A partir de `sm`: cartão `sm:min-h-[10rem]`, número `sm:text-6xl` (3 dígitos `sm:text-5xl`), letra `sm:text-3xl`. A partir de `lg`: `main` com `lg:max-w-6xl`; `PainelVagas` com `lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-6`; esquerda com cabeçalho, avisos, resumo, cartões e legenda (`lg:sticky lg:top-5`); direita com seções e mapa. A ordem do DOM não muda.
**Pronto quando.** E2E 1366x768 misto sem rolar: `bottom` de `secao-H` ≤ 768. `scrollWidth` ≤ largura em 640, 768, 1024, 1366 e 1920. Em 768x1024, número ≥ 56 px.

### UX-45 · Quiosque: sem botão de tela cheia e sem cursor parado
(VIG-09, VIG-13) · Telas: guarita · Impacto: baixo · Esforço: P

**Problema.** O `--kiosk` não usa a Fullscreen API, então "Abrir em tela cheia" deve ficar a noite toda no topo (tela-guarita.tsx:170-190; o comentário da linha 177 está errado). O ponteiro fica parado em cima dos cartões.
**Fazer.** `DEPLOY.md:78`: atalho abre `https://vagas.rubysistemas.com.br/guarita?quiosque=1`. `BotaoTelaCheia` some com `quiosque=1` (lido com `useSyncExternalStore`, como o demo), `fullscreenElement !== null`, `innerWidth >= screen.width - 1 && innerHeight >= screen.height - 1` ou `matchMedia("(display-mode: fullscreen)")`; assina também `resize`. Corrigir o comentário e `DEPLOY.md:83` ("Fora do modo quiosque e da tela cheia, a página mostra um botão..."). Hook `useCursorParado(3000)`: `pointermove` e `pointerdown` em `window`; 3 s parado põe `cursor-none` no `main`.
**Pronto quando.** E2E: em `/guarita?quiosque=1`, o botão "Abrir em tela cheia" com contagem 0; com viewport 1366x768 e `screen` 1920x1080, o botão aparece; com `screen` igual ao viewport, some. Com `page.clock`, mouse parado 3,5 s deixa `cursor: none`; mover volta a `auto`.

### UX-46 · Guarita a noite inteira sem intervenção, com versão visível
(VIG-14, LAC-06) · Telas: guarita · Impacto: baixo · Esforço: P · Depende de: UX-15

**Problema.** A página abre ao ligar o PC e nunca recarrega, então um deploy só chega com reinício. O Wake Lock só é pedido de novo no `visibilitychange`. Ninguém sabe que versão o PC roda.
**Fazer.** Hook `useRecargaDiaria`: a cada minuto confere a hora de São Paulo; uma vez por dia às 17:30, se a página está aberta há mais de 1 h, `servidorResponde()` (UX-15) e `location.reload()`; senão, tenta em 5 min. Em `useTelaAcesa`, `trava.addEventListener("release", () => setTimeout(pedir, 5_000))`. `next.config.ts`: `env: { NEXT_PUBLIC_VERSAO: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7) }`. Abaixo da data do relógio: `<p data-testid="versao" className="text-[clamp(0.6rem,0.8vw,0.8rem)] text-texto-secundario">Versão {process.env.NEXT_PUBLIC_VERSAO}</p>`. `DEPLOY.md`, "Se algo der errado": "Guarita com comportamento antigo | peça ao vigia o código de 'Versão' no canto da tela e compare com o último commit. Se for diferente, peça para apertar Alt+F4 e abrir o atalho de novo." e a nota da recarga das 17:30.
**Pronto quando.** E2E com `page.clock.install({ time: new Date("2026-10-14T16:20:00-03:00") })`: `window.__marca = 1`, HEAD 200, avançar até 17:31 deixa `__marca` indefinido; com HEAD abortado, `__marca` continua 1. Vitest: depois de `release` e 5 s, `request` chamado de novo. `versao` casa com `/^Versão ([0-9a-f]{7}|local)$/`.

### UX-47 · PWA: orientação livre, ícones, nome curto e barra do iPhone
(MOT-12, ACE-12, QRP-11, TXT-13, VIS-14, QRP-09, VIS-16) · Telas: pwa · Impacto: baixo · Esforço: P

**Problema.** `manifest.ts:10` trava retrato (falha WCAG 1.3.4). O `apple-icon.png` tem cantos transparentes. O nome curto "Vagas" se confunde com apps de emprego. `statusBarStyle: "black-translucent"` (layout.tsx:14) deve pôr o título sob a hora no iPhone. Não há `meta color-scheme`.
**Fazer.** `manifest.ts`: tirar `orientation`, acrescentar `id: "/"`, `short_name: "Vagas SENAI"`, `description: "Vagas livres nos estacionamentos dos blocos A, C e H do SENAI Blumenau."`. `layout.tsx`: `appleWebApp.title "Vagas SENAI"`, `statusBarStyle: "black"`, `colorScheme: "dark"` no viewport. `scripts/gerar-icones.ts`: apple-icon a partir de `svg.replace('rx="96" fill="#0f1419"', 'rx="0" fill="#0f1419"')`, com fundo cheio, e `npm run icones`. Não pôr screenshots no manifest. Registrar o desvio da especificação 3.4 (nome curto) e a D18.
**Pronto quando.** `pwa.spec.ts`: `manifest.id` "/", `orientation` indefinido, `short_name` "Vagas SENAI"; `apple-mobile-web-app-title` e `apple-mobile-web-app-status-bar-style` com "Vagas SENAI" e "black"; `meta[name=color-scheme]` "dark"; com `colorScheme: 'light'`, fundo do body `rgb(15, 20, 25)`; pixel (0,0) do apple-icon com alfa 255; em 740x360 e 844x390, `cartao-A` visível sem rolar e `scrollWidth` ≤ largura. Teste manual num iPhone: título inteiro abaixo da hora.

### UX-48 · Identidade: favicon, marca, títulos e prévia no WhatsApp
(VIS-09, TXT-14, QRP-07, PRD-12) · Telas: celular, guarita, qr, pwa · Impacto: médio · Esforço: P

**Problema.** `/favicon.ico` e `/icon.svg` dão 404. A marca só aparece na tela inicial. Não há Open Graph nem `metadataBase`, e a prévia no WhatsApp sai sem imagem. O título do `/qr` não tem o nome do sistema.
**Fazer.**
1. `src/app/icon.svg` copiado de `public/icone.svg` (o gerador de ícones copia também).
2. `src/components/marca.tsx` (SVG inline, `aria-hidden`, `data-testid="marca"`): ao lado do h1 da guarita com 1em, e no topo da folha do QR com 20 mm, acima do título. No celular a marca fica de fora, porque o cabeçalho do UX-13 precisa caber numa linha.
3. `layout.tsx`: `metadataBase: new URL(ENDERECO_PUBLICO)`; `title: { default: "Vagas SENAI Blumenau", template: "%s · Vagas SENAI Blumenau" }`; `description: "Vagas livres agora nos estacionamentos dos blocos A, C e H do SENAI Blumenau, contadas por um sensor em cada vaga."`; `openGraph: { type: "website", locale: "pt_BR", siteName: "Vagas SENAI Blumenau", title: "Vagas SENAI Blumenau", description: "Vagas livres agora nos estacionamentos dos blocos A, C e H do SENAI Blumenau.", url: "/" }`; `twitter: { card: "summary_large_image" }`. `guarita/page.tsx` title "Guarita"; `qr/page.tsx` title "Folha do QR code".
4. `src/app/opengraph-image.png` (1200x630, < 300 KB) gerado pelo `gerar-icones.ts`: fundo `#0f1419`, marca de 240 px, "Vagas SENAI Blumenau" 72 px peso 900 `#eef3f7` e "Vagas livres nos blocos A, C e H, contadas por um sensor em cada vaga." 34 px `#9fb0bf`. Sem número e sem as cores de livre e lotado. `opengraph-image.alt.txt`: "Ícone e nome do Vagas SENAI Blumenau".
Leia `generate-metadata.md:241-289, 391-428, 1344-1378` e `opengraph-image.md:15-60`.
**Pronto quando.** `pwa.spec.ts`: `link[rel=icon]` responde 200 `image/svg+xml`; `og:image` absoluta começando por `ENDERECO_PUBLICO`, e o caminho pedido ao servidor do teste responde 200 `image/png` < 300 KB; `og:locale` "pt_BR", `og:site_name` e `twitter:card`; títulos "Guarita · Vagas SENAI Blumenau" e "Folha do QR code · Vagas SENAI Blumenau"; `marca` em `/guarita` e `/qr`. Manual: colar o link no WhatsApp.

### UX-49 · Desempenho: preconnect e fonte do sistema
(QRP-06, QRP-12) · Telas: todas · Impacto: baixo · Esforço: P · Depende de: UX-17

**Problema.** Não há preconnect ao Supabase, e a conexão só começa depois do JS. A Inter (47,6 KB com preload) disputa banda com o JS e troca de fonte depois de aparecer.
**Fazer.** Em `page.tsx` e `guarita/page.tsx`, com `configuracaoSupabase()` não nula, `preconnect(url, { crossOrigin: "anonymous" })` e `prefetchDNS(url)` de `react-dom` (`generate-metadata.md:1149-1167`). Tirar `next/font/google` de `layout.tsx` e usar `--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (globals.css:43). Conferir nas capturas o peso 900 no Android, no iPhone e no Windows da guarita.
**Pronto quando.** E2E: HTML de `/` e `/guarita` com `link[rel=preconnect][href$=".supabase.co"][crossorigin]`; `/qr` sem; HTML de `/` sem `link[rel=preload][as=font]`. Depois do build, `.next/static/media` sem woff2.

### UX-50 · Instrução de instalação no iPhone
(QRP-10, MOT-15, PRD-13) · Telas: pwa, celular · Impacto: baixo · Esforço: P

**Problema.** No iPhone, o Safari não oferece a instalação, e quem vem toda noite precisa do QR ou do endereço.
**Fazer.** `src/components/convite-instalar.tsx` só em `page.tsx`, entre o painel e o rodapé. Aparece quando: iPhone ou iPad (`/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)`); não instalado (`display-mode: standalone` falso e `navigator.standalone !== true`); segunda visita ou mais (contador em `localStorage`, com try/catch); não fechado antes. Texto: "Para abrir as vagas direto da tela inicial, toque em Compartilhar e depois em Adicionar à Tela de Início." Botão "Fechar" (≥ 44 px) grava a recusa. Sem `localStorage`, não aparece. Não ouvir `beforeinstallprompt` (D17).
**Pronto quando.** `pwa.spec.ts` com userAgent de iPhone e 2 visitas: o texto aparece abaixo de `secao-H`; "Fechar" e recarregar o escondem; com `navigator.standalone = true`, não aparece; com Pixel 7 e em `/guarita`, não aparece; `addEventListener` nunca recebe "beforeinstallprompt".

### UX-51 · Rede da placa abre a página sozinha
(ESP-13) · Telas: esp32 · Impacto: médio · Esforço: P · Depende de: UX-20

**Problema.** Na rede Estacionamento-X, sem internet, o Android manda o tráfego pelo 4G e `http://192.168.4.1` não abre. O firmware só responde `/` e `/status`.
**Fazer.** Dentro de `#if MANTER_PAGINA_LOCAL`: `#include <DNSServer.h>`, `DNSServer dns;`; depois de `WiFi.softAP`, `WiFi.AP.enableDhcpCaptivePortal();` e `dns.start();`; `server.onNotFound([](){ server.sendHeader("Location", "http://192.168.4.1/"); server.send(302, "text/plain", ""); });`. LEIAME: "Entre na rede Estacionamento-A (senha vagas1234). O celular abre a página da placa sozinho. Se não abrir, desligue os dados móveis e abra http://192.168.4.1. No iPhone, use a página dentro da janela que abrir. Se você tocar em Cancelar, o iPhone sai da rede da placa."
**Pronto quando.** Em bancada, um Android com dados móveis ligados mostra a notificação de login e abre a página; no iPhone, a janela abre a página; `curl -i http://192.168.4.1/generate_204` dá 302 para `http://192.168.4.1/`; `nslookup connectivitycheck.gstatic.com 192.168.4.1` dá `192.168.4.1`.

### UX-52 · Página local com as cores e ícones do site
(ESP-10, VIS-15) · Telas: esp32 · Impacto: baixo · Esforço: P · Depende de: UX-23

**Problema.** Na página local, a ocupada é vermelha com 🚗, e com 0 livres aparece "0 vagas livres" sem LOTADO; no site, vermelho é LOTADO. "Ocupada" tem 4,42:1. Emojis mudam com o celular. Título e aba são iguais nas três placas.
**Fazer.** Copiar os tokens de `globals.css:9-28` para o `<style>` com o comentário "copiado de src/app/globals.css; mantenha igual" (com `--lotado: #f87171` e `--vaga-ocupada: #6b7785`). Livre: fundo `--livre-fundo`, borda e "Livre" em `--livre`. Ocupada: fundo `--superficie-2`, borda `--vaga-ocupada`, × em SVG inline e "Ocupada" em `--texto`. Com 0 livres, resumo com fundo `--lotado-fundo`, borda `--lotado`, "LOTADO" 2.5rem peso 800 e "0 de {total} livres" embaixo. Sem emojis. No topo da `PAGINA`: "Esta página roda sem internet. Não use fonte, script ou imagem de fora." e fonte `system-ui`. Mostrar o esboço ao João antes e manter título, resumo, grade e rodapé.
**Pronto quando.** E2E: o HTML não casa com `/\p{Extended_Pictographic}/u`; com 0 livres, "LOTADO" aparece e nenhuma `.vaga` tem `rgb(239, 68, 68)`; todo texto visível com 4,5:1 (3:1 acima de 24 px ou 18,66 px em negrito); 0 requisições fora de `192.168.4.1`.

### UX-53 · Grade da página local para testar os sensores
(ESP-11, ESP-12) · Telas: esp32 · Impacto: médio · Esforço: M · Depende de: UX-26, UX-52

**Problema.** Com 20 vagas, a página mede 1394 px. A célula não diz o pino. Para conferir que o sensor 7 está na vaga 7, o João procura qual célula mudou, e nenhuma se destaca. Sensor oscilando não aparece como falha.
**Fazer.** `.patio{grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px}`; célula com `padding:8px 4px`, número da vaga 1rem negrito, "GPIO 32" em .7rem `--texto-secundario`, estado "Livre" ou "Ocupada" (nunca abreviado) em .75rem e o × da ocupada no canto. Firmware: em `lerVagas`, na troca, `mudouEm[i] = millis()`, `trocas[i]++` e "[vaga] 7 (GPIO 27) ocupada". `/status` ganha `pinos`, `mudou_ha` (-1 se nunca) e `trocas_min` (zera a cada 60 s). Célula com `mudou_ha < 5`: outline 3px `#eef3f7` e "mudou agora" (branco, porque azul é vaga especial). Com `trocas_min >= 12`: borda tracejada `#fbbf24`, "instável", e a faixa diz "A vaga 7 (GPIO 27) trocou 15 vezes neste minuto. Confira o fio e o alinhamento do sensor."; o serial repete a frase uma vez por minuto.
**Pronto quando.** E2E 360x740 com 20 vagas: `#patio` ≤ 420 px, `scrollWidth` 360, cada célula com "GPIO", "Ocupada" numa linha; `mudou_ha[7]=2` destaca só a vaga 8; `trocas_min[2]=15` mostra "instável" e a frase, e 11 não. Bancada: tampar um sensor imprime "[vaga] N (GPIO X) ocupada" em menos de 1 s.

---

## Onda 3: telas e recursos novos

### UX-54 · Tela de resultados das noites (fora do escopo original)
(PRD-01) · Telas: nova tela `/resultados` · Impacto: alto · Esforço: G

**Problema.** O banco guarda uma foto a cada 5 min "para mostrar à banca o efeito do sistema" (decisão 8), mas anon não lê `vagas.historico` (42501) e não há tela. O dado que mostra quantas vezes um bloco lotou com outro tendo vaga está trancado.
**Fazer.**
1. Migration nova: três funções `language sql stable security definer set search_path = ''`, cada uma com `revoke execute ... from public` e `grant execute ... to anon, authenticated, service_role`: `vagas.resumo_noites(p_dias int default 30) returns table(noite date, bolsao_id text, janelas_com_dado int, janelas_lotado int, min_livres int, total_vagas int)`; `vagas.impacto(p_dias int default 30) returns table(noite date, janelas_avaliadas int, janelas_lotado_com_vaga_em_outro int, media_livres_outros numeric)` (por janela, só blocos com foto; conta quando um com foto tem 0 e outro com foto tem mais de 0; sem foto nunca conta como lotado); `vagas.serie_noite(p_noite date) returns table(bolsao_id text, momento timestamptz, vagas_livres int, total_vagas int)`. Filtro: `(momento at time zone 'America/Sao_Paulo')::time >= '18:00'` e `< '22:30'` (54 janelas); noite = data em São Paulo; `p_dias` em `least(greatest(p_dias,1),120)`. Se o UX-59 existir, filtrar `publico = true`.
2. `src/app/resultados/page.tsx` (title "Resultados") com `src/components/tela-resultados.tsx`, chamando as rpc com a chave publishable. h1 "Resultados das noites". Resumo: "Em {m} das {j} janelas das últimas {n} noites, um bloco estava lotado e outro tinha vaga livre. Nessas janelas, os outros blocos tinham em média {x} vagas livres." Por bloco: "Bloco A: dado em 52 de 54 janelas (96 %). Lotou em 12 janelas." Nota: "Os números vêm de uma foto da ocupação a cada 5 minutos, das 18h às 22h30. Uma janela sem foto quer dizer que os sensores não mandaram dado." Vazio: "Ainda não há noites com dados. O primeiro resultado aparece depois da primeira noite com os sensores ligados." Toda cifra presa à data ("Noite de 13/10"); nunca "agora".
3. `src/components/grafico-noite.tsx`: linhas em SVG próprio, eixo 18:00 a 22:25, `select` "Noite"; janela sem foto quebra a linha e vira faixa hachurada `data-testid="lacuna"` com "sem dados", sem interpolar nem desenhar zero.
4. Botão "Baixar CSV" (Blob) com `noite;momento;bolsao;livres;total`.
5. Link "Resultados" no rodapé de `/` (≥ 44 px) e no UX-56. `DEPLOY.md`: antes da banca, `select min(momento), count(*) from vagas.historico` e apagar as fotos anteriores à instalação. Registrar a D21.
**Pronto quando.** `tests/db/vagas.test.ts`: "anon não lê centrais nem historico" passa sem mudança; anon executa as três; fotos às 18:00, 18:05, 18:15 e 23:00 dão `janelas_com_dado = 3`; A 0 e C 5 na mesma janela contam 1, e A 0 com C sem foto contam 0; `resumo_noites(1000)` igual a `resumo_noites(120)`. `tests/e2e/resultados.spec.ts` com rotas falsas: resumo com os números do mock; `lacuna` às 19:10 sem ponto da linha dentro; vazio mostra "Ainda não há noites com dados."; "Baixar CSV" baixa cabeçalho e uma linha por foto. `/resultados` aparece como estática no build.

### UX-55 · Recomendação por bloco de destino no celular
(PRD-03) · Telas: celular · Impacto: alto · Esforço: M · Depende de: UX-13, UX-14 · Pendência: João confere a tabela

**Problema.** A melhor escolha depende do destino: o A fica ao lado da guarita e o H no fundo, junto de E, F, G, H e Cantina. Quem vai ao F e segue "mais vagas" pode parar no A e atravessar o campus.
**Fazer.** `src/lib/vagas/destinos.ts`: A, A1, B → [A, C, H]; B1, C → [C, A, H]; D → [C, H, A]; E, Cantina, F, G, H → [H, C, A]. `recomendacao(bolsoes, situacoes, destino)`: sem destino, o resultado de `orientacaoMotorista`; com destino, o primeiro da ordem em livre ou poucas com comuns > 0 (nunca sem dados). Texto: "Para o bloco D, o mais perto com vaga é o Bloco C, com 12 livres." (singular). Detalhe, com prioridade para o segundo: "O Bloco C tem poucas vagas. Se lotar, o Bloco H tem 30 livres." e "O Bloco C, mais perto, está sem dados. Se passar por ele, confira no local.". Sem alvo, o texto de `orientacaoMotorista`. No resumo do UX-13, o botão "Escolher meu bloco" (`min-h-11`, `aria-expanded`) abre botões `aria-pressed`: "Bloco A", "Bloco A1", "Bloco B", "Bloco B1", "Bloco C", "Bloco D", "Bloco E", "Bloco F", "Bloco G", "Bloco H", "Cantina" e "Não escolher bloco"; depois vira "Trocar meu bloco (D)". A escolha fica em `localStorage["vagas.destino"]`, lida com `useSyncExternalStore` (servidor: `null`) e try/catch.
**Pronto quando.** Unitários: D com C e H livres → C; D com C sem dados e H livre → H e "mais perto, está sem dados"; D com C em poucas → C e "Se lotar, o Bloco H"; A e C lotados e H sem dados → texto de `orientacaoMotorista`; nunca indica bloco sem dados. E2E 360x740: escolher D mostra "Para o bloco D, o mais perto com vaga é o Bloco C"; a escolha sobrevive à recarga; com `localStorage` que lança erro, a página carrega; o fim do resumo fica acima de 740 px.

### UX-56 · Página "Como funciona", com créditos
(PRD-04, TXT-15) · Telas: nova tela `/como-funciona` · Impacto: médio · Esforço: M · Pendência: nome e curso do João e regulamento do prêmio

**Fazer.** Rota estática `src/app/como-funciona/page.tsx` (title "Como funciona"), sem `useVagas`. h1 "Como funciona". Seções: "O problema" (texto do desafio de `docs/PROBLEMA.md`); "Como o dado chega até a tela", com `src/components/diagrama-caminho.tsx` (Sensor em cada vaga → Placa ESP32 do estacionamento → Wi-Fi do campus → Banco de dados → Esta página e a tela da guarita) e "A placa de cada estacionamento lê os sensores e manda o estado das vagas a cada 10 segundos."; "Quando aparece SEM DADOS": "Se um estacionamento passa 30 segundos sem mandar dado, a página deixa de mostrar o número e mostra SEM DADOS. Zero vagas só aparece quando o dado é recente. Com essa regra, a página não manda ninguém embora por causa de um número antigo."; "A tela da guarita", com captura de `/guarita?demo=1` em `public/telas/guarita-demo.png` (faixa de demonstração visível) e legenda "Tela da guarita em demonstração, com dados simulados."; "Quem fez": "Sensores e placas: João {sobrenome}, aluno de {curso} do SENAI Blumenau. Site e banco de dados: Matheus Fagundes." (só depois de o João autorizar e de conferir o regulamento); "Veja funcionando": "Abrir a demonstração" (`/?demo=1`), "Abrir a tela da guarita em demonstração" (`/guarita?demo=1`) e "Ver os resultados" (`/resultados`, se o UX-54 existir). Link "Como funciona" no rodapé de `/` (≥ 44 px). Sem foto com placa de carro ou rosto.
**Pronto quando.** E2E: `/como-funciona` responde 200 com o h1; "Abrir a demonstração" com `href="/?demo=1"`; nenhum `cartao-` ou `guarita-`; imagem com `alt` contendo "dados simulados"; link do rodapé ≥ 44 px. Estática no build.

### UX-57 · Caminho da guarita até cada estacionamento no mapa
(MOT-04 parte 4) · Telas: mapa · Impacto: médio · Esforço: P · Depende de: UX-36 · Pendência: João confirma as entradas

**Fazer.** Depois de o João dizer por onde se entra em cada estacionamento, desenhar `<path stroke="var(--destaque)" strokeWidth="4" strokeDasharray="8 6" fill="none">` da guarita pela via de baixo até a entrada de cada um, com `data-testid` `rota-A`, `rota-C` e `rota-H`. `aria-label` do SVG: "Mapa do campus com o caminho da guarita até os estacionamentos dos blocos A, C e H", seguido das posições do UX-36.
**Pronto quando.** E2E: `rota-A`, `rota-C` e `rota-H` existem; nenhuma rota cruza o texto de outro elemento; UX-36 continua passando.

### UX-58 · Diagnóstico remoto das placas e vagas especiais definidas na placa
(PRD-06, PRD-08) · Telas: nova tela `/placas`, esp32 · Impacto: médio · Esforço: M

**Problema.** Para saber por que uma placa parou ou se um sensor está tapado, o João vai ao estacionamento com notebook. Um sensor tapado manda "ocupada" com dado fresco e a regra de 30 s não pega. As posições de PCD e idoso só entram por SQL, e mudar a ordem de `PINO_VAGA` deixa o banco apontando para as vagas erradas.
**Fazer.**
1. Migration nova: `alter table vagas.centrais add column diag jsonb, add column diag_em timestamptz;`; `drop function vagas.publicar(text, jsonb);` e `create` de `vagas.publicar(p_token text, p_bolsoes jsonb, p_diag jsonb default null, p_especiais jsonb default null)` com o mesmo corpo. `p_diag`: grava `diag` e `diag_em = now()` só quando é objeto ≤ 2048 bytes; senão ignora sem erro. `p_especiais`: chaves `pcd`, `idoso`, `gestante`, `moto`, inteiros de 0 a total - 1 sem repetição; erro → 22023 sem gravar nada; `null` → não mexe. `revoke ... from public` e grant para anon, authenticated e service_role. `vagas.placas() returns table(id text, nome text, ultimo_envio timestamptz, diag jsonb, diag_em timestamptz)`, security definer, só centrais ativas, sem `token_hash`.
2. Firmware: em `lerVagas`, o `millis()` da última troca por sensor; payload com `"p_diag":{"rssi":-67,"uptime_s":11520,"reinicio":"watchdog","versao":"2026-10-14","sem_mudar_h":[0,0,27,0,1]}`. Abaixo de `PINO_VAGA`: `const char* VAGAS_PCD = "";` e `const char* VAGAS_IDOSO = "";` em numeração humana ("1,2"). O `setup` confere faixa e repetição; erro imprime "[config] VAGAS_PCD tem a vaga 7, mas N_VAGAS é 5", não manda `p_especiais` e aparece na página local; sem erro, manda sempre `"p_especiais":{"A":{"pcd":[0,1]}}` (ou `{"A":{}}`). A página local mostra "Vaga 1 (PCD)".
3. `src/app/placas/page.tsx` (robots noindex, sem link em `/`) com `tela-placas.tsx`, que chama `rpc('placas')` a cada 10 s e `rpc('agora')`. Estado por placa: "Mandando" (≤ 30 s), "Atrasada" (30 s a 5 min), "Parada desde 19:12" (com `quando`), "Nunca mandou dado". Abaixo: "Sinal do Wi-Fi: -67 dBm (bom)" (bom ≥ -67, fraco -68 a -75, ruim < -75), "Ligada há 3 h 12 min", "Último reinício: watchdog", "Versão: 2026-10-14"; para cada sensor com `sem_mudar_h` ≥ 24 quando pelo menos metade dos outros do mesmo estacionamento mudou em 24 h: "Vaga 3 não muda há 27 h. Confira se o sensor está sujo ou tapado." Com `diag_em` > 5 min, "Diagnóstico de 19:12".
4. Registrar: "A placa define as vagas especiais. Um update por SQL é sobrescrito no envio seguinte." e o desvio da especificação 2.2.
**Pronto quando.** Banco: `placas()` sem `token_hash` e executável por anon; testes atuais de `publicar` sem mudança; `p_diag` objeto grava; `p_diag = '"texto"'` grava as vagas e deixa `diag` nulo; `count(*) from pg_proc where proname = 'publicar'` = 1; `p_especiais {"A":{"pcd":[0,1]}}` grava; posição ≥ total e chave "vip" dão 22023 sem gravar; sem `p_especiais`, nada muda; `{"A":{}}` zera. E2E `/placas`: envio de 3 s → "Mandando"; 6 min → "Parada desde"; rssi -80 → "(ruim)"; `[0,0,27,0,0]` → "Vaga 3 não muda há 27 h"; `[40,40,40,40,40]` → sem aviso. Firmware compila com `VAGAS_PCD = ""` e `"1,2"`.

### UX-59 · Modo maquete para a banca, fora da página pública
(PRD-10) · Telas: celular, guarita, esp32 · Impacto: médio · Esforço: M · Pendência: João ter uma maquete com sensores

**Problema.** A prova mais forte é tampar um sensor e ver o celular mudar, mas os estacionamentos ficam longe da banca. Um bloco de teste apareceria para os motoristas, e qualquer token publica em qualquer bloco.
**Fazer.** Migration nova: `alter table vagas.bolsoes add column publico boolean not null default true;`; `insert into vagas.bolsoes (id, nome, ordem, publico) values ('M', 'Bloco M (maquete)', 9, false);`; `alter table vagas.centrais add column bolsoes text[];` (nulo = todos); `publicar` recusa com 28000, sem gravar, id fora da lista; `bolsao-a` → `'{A}'`, `bolsao-c` → `'{C}'`, `bolsao-h` → `'{H}'`; token `maquete` com `'{M}'` via `npm run token:gerar -- maquete "Maquete da banca"`. Página: `publico` em `COLUNAS` e no esquema (`z._default(z.boolean(), true)`); carga com `.eq('publico', true)` e descarte no cliente de linhas e eventos com `publico=false`; com `?maquete=1` (ignorado com `demo=1`), carga e Realtime só do M e `faixa-maquete`: "Maquete: sensores reais de uma maquete, fora do estacionamento.". Placa da maquete com `ID_BOLSAO "M"` e `INTERVALO_PUBLICAR_MS 3000`. O UX-01 ganha o par de testes do modo.
**Pronto quando.** E2E com A, C, H e M (`publico=false`): `/` com 3 cartões e sem `cartao-M`; UPDATE do M não cria cartão; `/?maquete=1` com `cartao-M` e `faixa-maquete`; M parado 31 s vira SEM DADOS; `/guarita` com A, C e H lotados diz "Os três estacionamentos estão lotados.". Banco: token maquete publica no M; publicar `{"A":"01"}` com ele dá 28000 e A não muda; token com lista nula publica em qualquer bloco; anon lê o M.

### UX-60 · Contar acessos para mostrar o uso à banca
(PRD-09) · Telas: todas · Impacto: médio · Esforço: P · Pendência: limite do plano Vercel

**Fazer.** `@vercel/analytics` 2.0.1. `src/lib/analise.ts`: `filtrarEvento(evento)` devolve `null` com pathname começando em `/guarita` ou com `demo=1` ou `maquete=1`. `src/components/analise.tsx` (`"use client"`) com `<Analytics beforeSend={filtrarEvento} />` de `@vercel/analytics/next`, renderizado no `body` do layout. Ativar o Web Analytics no projeto `vagas-senai`. Na página do UX-56: "A página conta os acessos sem cookies e sem identificar quem acessou."
**Pronto quando.** Unitários de `filtrarEvento` com `/guarita`, `/?demo=1` e `/`. E2E: abrir `/` faz pedido a `/_vercel/insights/script.js`.

### UX-61 · Aviso de manutenção por bloco, só junto do SEM DADOS
(LAC-05) · Telas: celular, guarita · Impacto: médio · Esforço: M

**Fazer.** Migration nova: `alter table vagas.bolsoes add column aviso text check (aviso is null or char_length(aviso) between 1 and 80);`. O Matheus usa `update vagas.bolsoes set aviso = 'Sensor em conserto até sexta' where id = 'H';` (exemplo em `DEPLOY.md`). `aviso` em `COLUNAS`, no esquema (`z._default(z.nullable(z.string().check(z.maxLength(80))), null)`), em `padrao.ts` e na demonstração. Só em SEM DADOS: na seção, linha `text-sm font-semibold text-sem-dados` "Aviso da manutenção: {aviso}"; na coluna da guarita, abaixo do aviso do centro. Com aviso, a coluna não pede para avisar o responsável (UX-07). Cartão e mapa não mudam. A guarda de dígito do UX-01 olha só o número e o rótulo, porque o aviso pode ter datas.
**Pronto quando.** E2E: H de 2 dias com aviso mostra SEM DADOS e "Aviso da manutenção: Sensor em conserto" no celular e na guarita, sem dígito no cartão; com dado fresco, o aviso some. Banco: anon lê `aviso`, não atualiza; `publicar` não mexe no aviso.

### UX-62 · Guia impresso do vigia
(LAC-04) · Telas: nova tela `/guarita/guia` · Impacto: médio · Esforço: P

**Fazer.** `src/app/guarita/guia/page.tsx` (robots `index: false`, title "Guia da tela da guarita"), impressão em A4 de uma página, como a folha do QR. Título "Como usar a tela de vagas". Quatro blocos com retângulo de 24 mm na cor e padrão do estado: "Tem vaga: mande o motorista para o bloco que a faixa de baixo indica." / "Poucas vagas: o bloco tem poucas vagas livres. Avise que ele pode lotar antes de o motorista chegar." / "Lotado: os sensores mandaram dado agora e o bloco não tem vaga." / "Sem dados: a tela não sabe quantas vagas o bloco tem. Não diga que está lotado." Embaixo: "Se um bloco ficar sem dados por mais de 10 minutos, avise o responsável:" e as linhas "Nome: ______" e "Telefone ou ramal: ______". `DEPLOY.md`, seção 7, passo 5: "Imprima /guarita/guia, escreva o contato do responsável e cole ao lado do monitor."
**Pronto quando.** E2E: a página mostra os quatro estados; com mídia print em 794 px, `scrollHeight` ≤ 1123.

### UX-63 · Aviso falado opcional na guarita
(VIG-12) · Telas: guarita · Impacto: médio · Esforço: M · Depende de: UX-05 · Pendência: caixa de som na guarita

**Fazer.** Em `regras.ts`, função pura `anunciosGuarita(entrada, anunciado, agoraMs, semConexao)` com categorias "com-vaga" (livre e poucas), "lotado" e "sem-dados". Um bloco gera anúncio quando a categoria muda e dura 20 s (60 s para sem-dados): "Bloco A voltou a ter vaga." (de lotado), "Bloco A tem vaga." (de sem dados), "Bloco C lotou.", "Bloco H ficou sem dados.". Com a causa "sem-conexao", nenhum bloco fala e sai uma vez "A tela da guarita está sem conexão." depois de 60 s. Hook `useAnuncios` só com `?som=1`, começando do estado da primeira carga, rodando a cada segundo e falando com `speechSynthesis` em `pt-BR`. Ao abrir, fala "Som ligado."; com erro `not-allowed`, o cabeçalho mostra "Ligar o som" (`min-h-11`). `DEPLOY.md:78`: `--autoplay-policy=no-user-gesture-required` e `som=1` no atalho, com caixa de som ligada. Conferir a voz em português no Windows da guarita.
**Pronto quando.** Unitários: A alternando 0 e 1 a cada 10 s por 2 min não fala; C lotado 20 s fala "Bloco C lotou." uma vez; depois, C com vaga 20 s fala "Bloco C voltou a ter vaga."; H sem dados 59 s não fala e 60 s fala; com sem conexão, nenhum anúncio de bloco. E2E com `speechSynthesis` falso em `window.__falas`: em `/guarita?som=1`, C lotado por 21 s gera "Bloco C lotou."; sem `som=1`, nada.

### UX-64 · Enviar o link e folha de QR para salas
(QRP-14, PRD-13) · Telas: celular, qr · Impacto: baixo · Esforço: P

**Fazer.** No rodapé de `/`, `src/components/enviar-link.tsx` com o botão "Enviar o link" (≥ 44 px): com `navigator.share`, `share({ title: "Vagas SENAI Blumenau", text: "Vagas livres agora nos blocos A, C e H do SENAI Blumenau.", url: ENDERECO_PUBLICO })`; sem, `clipboard.writeText(ENDERECO_PUBLICO)` e "Link copiado." por 3 s numa região `aria-live`. Sempre o endereço público, sem `?demo=1`. Rota estática `src/app/qr/sala/page.tsx` (robots noindex) com o QR do UX-18, h1 "Veja as vagas livres antes de chegar ao SENAI", "Aponte a câmera do celular e abra a página.", "No Android, abra o menu do Chrome e toque em Adicionar à tela inicial. No iPhone, toque em Compartilhar e depois em Adicionar à Tela de Início." e o endereço curto.
**Pronto quando.** E2E: com `share` falso, o clique chama `share` com `url` igual a `ENDERECO_PUBLICO`, também em `?demo=1`; sem `share`, aparece "Link copiado."; `/qr/sala` tem o QR e o h1 e é estática no build.

---

## Fora desta lista

- **Grade ajustável na guarita (EST-06, VIS-01):** a barra do UX-08 resolve o corte e libera altura; a grade continua no celular.
- **Link "Avisar erro" para o motorista (LAC-03, PRD-11):** o motorista está dirigindo e não sabe o número da vaga; o UX-58 detecta o sensor travado sozinho.
- **"Carregando" neutro, sem alerta, na primeira carga (EST-03, QRP-03):** contraria a regra do estado inicial; só o texto muda (UX-05).
- **Botão próprio de instalação com `beforeinstallprompt` (MOT-15, PRD-13):** esconde a mini-barra do Chrome, e o guia do Next desaconselha.
- **Destaque de 20 s e lista das últimas mudanças na guarita (VIG-06):** o cartão inteiro já muda de cor; o UX-63 cobre quem não olha a tela.
- **Deslocar a tela 3 px contra marca no monitor (VIG-16):** nada indica monitor OLED; desligar fora do horário pelo Windows resolve.
- **Botão "Mostrar as 500 vagas" (MOT-13):** as placas têm 5 vagas e a grade já funciona com 500.
- **Folhas por entrada de bloco e QR de demonstração (QRP-13):** a folha geral serve em qualquer entrada, e um QR de demonstração colado levaria motoristas a números falsos.
- **Foco programático ao seguir a âncora (ACE-11):** os navegadores já movem o ponto de partida do teclado; o UX-39 cuida do destaque visual.
- **Tema claro (VIS-16):** dobraria tokens e capturas para uma tela usada à noite.
- **Service worker para modo offline (QRP-08):** sem ganho claro, e a especificação 3.4 só o permite se for preciso.
- **Trocar o supabase-js por `@supabase/realtime-js` (QRP-02):** ganho de 41 KB com risco alto; vale um item próprio depois do UX-17.
- **Itens "Manter" (MOT-16, MOT-17, MOT-18, PRD-15, ESP-15, ESP-16, ESP-17):** já estão implementados, e as proteções foram para o UX-01 e para os itens de firmware.
