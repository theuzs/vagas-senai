# Decisões

## Para confirmar (tomadas em 07/10/2026)

1. **Supabase compartilhado com o WebSiteFoods.** Tudo deste projeto fica no schema `vagas`, separado das tabelas do Vitta's. As migrations daqui não usam o `supabase db push`, porque o histórico de migrations do Supabase é do WebSiteFoods. Elas rodam por um script próprio (`npm run db:aplicar`) ou coladas no SQL Editor.
2. **Escrita só pela função `vagas.publicar` com token da central.** Uma política de escrita para `anon` ficou de fora porque a chave `anon` está dentro da página e qualquer um poderia gravar número falso. Uma Edge Function também ficou de fora: ela teria a mesma segurança, mas daria mais trabalho para publicar e demoraria na primeira chamada. A função fica dentro da migration e o banco guarda só o hash do token.
3. **Duas placas na central.** A central atual continua só com ESP-NOW e passa os dados por fio para um ESP32 novo, a ponte, que cuida do Wi-Fi. Assim o canal do Wi-Fi do campus não atrapalha os nós e uma queda de internet não trava a recepção. A versão com uma placa só fica documentada como alternativa.
4. **O total de vagas vem do nó.** O banco aceita de 1 a 500 vagas por bolsão e atualiza o total sozinho pelo tamanho da lista que chega. Não é preciso cadastrar quantas vagas cada bolsão tem.
5. **Bolsões são linhas da tabela.** A, C e H vêm cadastrados. Para incluir outro bolsão, basta inserir uma linha, sem mexer em código.
6. **Tempos.** A ponte publica a cada 10 s. Um bolsão só vai na publicação se o nó dele mandou dado nos últimos 5 s. A página mostra SEM DADOS quando o dado tem mais de 30 s.
7. **Hora do servidor.** A página calcula a idade do dado com a hora do Supabase, para um celular com relógio errado não esconder nem inventar vaga.
8. **Histórico guardado desde o primeiro dia.** O banco grava uma foto da ocupação a cada 5 minutos, sem tela por enquanto. Esse dado serve para mostrar à banca do prêmio quantas vagas sobravam à noite.
9. **Vagas de PCD e idoso.** Ficam marcadas no banco pela posição do sensor, e a página mostra separado ("PCD: 1 livre").
10. **Página.** Usa Next.js como o WebSiteFoods, sem código de servidor e só com a chave pública. Com `?demo=1` no endereço ela mostra dados simulados, com uma faixa avisando. Isso serve para apresentar o projeto sem o hardware ligado.
11. **Endereço.** `vagas.rubysistemas.com.br`, num projeto novo na mesma conta da Vercel.
12. **Wi-Fi.** O firmware da ponte aceita rede só com senha e rede com usuário e senha. Isso se escolhe no `config.h`.
13. **Painel LCD na guarita.** Um display de 20x4 ligado na ponte, opcional, com os números de cada bolsão. Funciona mesmo sem internet.
14. **Visual.** Tema escuro, porque o uso é à noite. Verde para livre, amarelo para poucas vagas, vermelho para lotado e SEM DADOS com listras e ícone de alerta. Na tela aparece o nome "Vagas SENAI Blumenau", sem o logo do SENAI.
15. **Repositório.** `theuzs/vagas-senai`, privado.

## Perguntas em aberto

Para o João:
- Onde a central vai ficar? Na guarita seria o ideal, porque tem tomada e o vigia veria o LCD.
- Pode mandar o código (`.ino`) da central e de um nó? Com ele dá para encaixar o trecho que manda os dados para a ponte e conferir se uma placa só daria conta.
- Quais vagas de cada bolsão são de PCD ou idoso (pela ordem dos sensores)?
- O Wi-Fi do campus pede só senha, usuário e senha, ou uma página de login no navegador? No último caso, a TI precisa liberar a ponte pelo MAC.
- O sinal do nó do H chega até onde a central vai ficar? Pelo mapa são uns 100 m com prédios no meio.

Para o Matheus:
- Reservar o subdomínio `vagas` no WebSiteFoods, para ninguém criar uma loja com esse nome? É opcional.

## Decididas durante a noite (07 para 08/10/2026)

16. **Base montada à mão, sem `create-next-app`.** O gerador não aceita pasta com arquivos e traria versões diferentes. O `package.json` fixa as mesmas versões do WebSiteFoods. O `npm install` precisa de `--legacy-peer-deps`: o npm 11.1 quebra ao resolver os peers opcionais do Vitest 5 (erro `edgesOut`). Por isso `vite` e `@testing-library/dom` estão declarados de forma explícita.
17. **Migration do próprio projeto registra em `vagas.migracoes`.** Script `scripts/db-aplicar.ts`, com a lógica em `scripts/migracoes.ts` para o teste de banco cobrir.
18. **Limite de 500 vagas conferido por `length`, não por regex.** O regex do Postgres não aceita `{1,500}` (limite de 255).
19. **O total de vagas de um bolsão vem do tamanho da lista que o nó manda.** Não há cadastro de quantas vagas cada bolsão tem; a função `publicar` atualiza `total_vagas` a cada envio.
20. **`agora()` é chamada junto com a carga.** A página mede o relógio do servidor na carga, a cada 5 min e ao voltar para a aba. Sem resposta, usa o relógio do aparelho.
21. **"Poucas vagas" = até `max(3, 10 %)` do total.** Com 3 vagas, 3 livres ainda conta como "poucas". Os testes refletem isso.
22. **`?demo=1` e `?painel=1` são lidos no navegador com `useSyncExternalStore`.** A página continua estática (prerender) e sem `searchParams` no servidor.
23. **Teste de "sem variável de ambiente" é de componente, não E2E.** As variáveis `NEXT_PUBLIC_*` entram no build, então um E2E precisaria de outro build. O componente aceita `configuracao={null}` e o teste jsdom cobre o aviso e o SEM DADOS.
24. **Simulação do Supabase no E2E.** O Playwright responde o REST (`page.route`) e o WebSocket do Realtime (`page.routeWebSocket`, protocolo Phoenix v2). Nenhum teste toca o Supabase real.
25. **Ícones da PWA gerados pelo Chromium do Playwright** (`npm run icones`), a partir de `public/icone.svg`, sem dependência nativa. O `apple-icon.png` fica em `src/app/` e o Next liga sozinho.
26. **Firmware escrito para o core arduino-esp32 3.x** (compilado no 3.3.12), com `#if` para o 2.x no watchdog e no WPA2-Enterprise. Buffer serial de 8 KB em vez de 4 KB, para aguentar um POST lento.
27. **Trecho da central sem o código real.** `saida_ponte.h` é genérico e compila; o encaixe no callback do ESP-NOW está descrito com um pacote hipotético em `firmware/central/LEIAME.md`.
28. **Extras feitos:** mapa esquemático em SVG próprio, `/qr` (folha A4, QR gerado no build com o pacote `qrcode`) e `?painel=1`. O endereço do QR vem de `NEXT_PUBLIC_ENDERECO_PUBLICO`, com `https://vagas.rubysistemas.com.br` como padrão.
29. **Capturas de tela** em `docs/telas/`, tiradas por `CAPTURAS=1 npx playwright test capturas`.

## Confirmadas em 08/10/2026

O Matheus confirmou as 29 e acrescentou:

30. **Um ESP32 por bolsão fala direto com o Supabase, em um arquivo só.** O código real dos nós (`bolsao.ino` original do João) lê os sensores e serve uma página no softAP; não há ESP-NOW nem central. Então a decisão 3 (duas placas) deixa de ser necessária: `firmware/bolsao/bolsao.ino` junta a leitura original, a página local (opcional) e o envio pelo Wi-Fi do campus. As pastas `firmware/central` e `firmware/ponte` ficam como variante, caso os nós voltem a usar ESP-NOW. Um token por bolsão (`bolsao-a`, `bolsao-c`, `bolsao-h`).
31. **Tela da guarita em `/guarita`, no lugar do `?painel=1`.** O PC da guarita é paisagem; a tela tem três colunas, relógio e a orientação para o vigia ("Mais vagas agora: Bloco H, 12 livres."). Com algum bolsão sem dado, a faixa avisa para conferir no local e nunca diz que está tudo lotado. A lógica de dados saiu do painel do celular para `useVagas`, usada pelas duas telas.

## Decididas em 14/10/2026

32. **Supabase próprio do SENAI.** O Matheus criou um projeto só para este sistema (`hsfsejmhltkxiwniuunf`, região sa-east-1), no lugar do Supabase do WebSiteFoods. Isso substitui a decisão 1. O domínio e a conta Vercel continuam os do WebSiteFoods. O código continua usando o schema `vagas` e o `npm run db:aplicar`, porque a página, os testes e o firmware dependem desse schema. O banco só aceita conexão direta por IPv6, então o `DATABASE_URL` usa o pooler `aws-1-sa-east-1.pooler.supabase.com`, porta 5432.
33. **`npm run db:aplicar` lê o `.env.local`.** Assim basta ter o `DATABASE_URL` nesse arquivo, sem colar a URL no terminal.
34. **`vagas.migracoes` com RLS ligado.** A tabela não tem grant para `anon`, mas o schema `vagas` é exposto na API e o painel do Supabase acusaria a tabela como aberta. O script liga o RLS toda vez que roda.
35. **Arquivo pronto para cada placa.** `firmware/bolsao/placas/bolsao_A`, `bolsao_C` e `bolsao_H` (pasta ignorada pelo git) já têm URL, chave publishable, token do bolsão e nome da rede local (`Estacionamento-A`, `-C`, `-H`). O João só confere `N_VAGAS` e `PINO_VAGA` e preenche o Wi-Fi do campus. O `bolsao.ino` do repositório continua sem segredo.
36. **Token do simulador desligado depois dos testes.** Para usar o simulador de novo: `update vagas.centrais set ativa = true where id = 'simulador';`.
37. **Projeto `vagas-senai` na Vercel, equipe `ruby-sistemas`**, criado pelo Vercel CLI e ligado ao repositório `theuzs/vagas-senai`: cada push na `main` publica sozinho. Só tem as duas variáveis públicas (produção e preview). O domínio `vagas.rubysistemas.com.br` ficou no projeto sem registro novo, porque o DNS do `rubysistemas.com.br` já está na Vercel. O projeto `websitefoods` não foi alterado.

## Decididas em 15/10/2026 (implementação de `docs/MELHORIAS-UX.md`)

As decisões D1 a D22 de `docs/MELHORIAS-UX.md` valem como tomadas e foram aplicadas. Os registros que os itens pediram estão abaixo.

38. **Supabase, Vercel e o repositório já estão com tudo.** As migrations `0002_placas_maquete_aviso.sql` e `0003_resultados.sql` foram aplicadas no projeto do SENAI por `npm run db:aplicar`. O token `maquete` está em `vagas.centrais` com `bolsoes` nulo (publica em A, C e H) e em `TOKEN_MAQUETE` no `.env.local`.
39. **Sem Realtime, a página lê a API a cada 10 s** (D3), e volta a ler quando a rede volta ou o aparelho acorda (tique de 1 s com mais de 5 s de atraso). O frescor continua decidido só por `atualizado_em` contra a hora do servidor. Uma leitura agendada enquanto a aba está oculta não roda; a volta da aba lê de novo.
40. **A primeira leitura usa `fetch` direto, no navegador, sem esperar o supabase-js** (`src/lib/vagas/carga-inicial.ts`). Nenhum dado de vaga é lido no servidor: nada de fetch de `vagas.bolsoes` em componente de servidor, ISR ou `use cache`.
41. **A tela diz a causa do SEM DADOS** (D4): carregando, sem conexão, erro de configuração ou sensor. Os textos de idade da especificação 3.2 ganharam a data quando o dado é de outro dia ("sem dados desde ontem às 22:30", "desde 06/10 às 18:00", D12). O indicador do cabeçalho passou a "Ao vivo", "Conectando", "Sem conexão", "Sensores sem dados", "Simulação" e "Fora do ar" (D11), no lugar de "Ao vivo" e "Reconectando" da especificação 3.3.
42. **A faixa da guarita começa pelo bloco que pode ter vaga** (D5): "Bloco H sem dados. Ele pode ter vaga." no texto grande e "Indique o Bloco A: 12 vagas livres." quando há vaga. Troca os textos da especificação 3.5 item 3 e da decisão 31. O aviso no centro da coluna é "Não diga que está lotado. O bloco pode ter vaga." e, com mais de 10 min sem dado (ou nunca, depois da primeira leitura), "Não diga que está lotado. Avise o responsável pelos sensores.". Com aviso da manutenção (decisão 50), a coluna não pede para avisar o responsável.
43. **O número grande conta só as vagas comuns** (D2). As especiais aparecem em "+N especiais" e, por extenso, "PCD: 2 livres", "Idoso: nenhuma livre" (D13). `vagas.historico` continua com o total. Quando as comuns acabam e há especial livre, a faixa diz "As vagas comuns estão lotadas." e "Vagas especiais livres: Bloco C (1 PCD, 1 idoso).".
44. **Guarita com barra de ocupação no lugar da grade** (D1), selo "INDIQUE ESTE" no lugar do anel (D9), nada acima das colunas (D10) e indicação com histerese: o bloco indicado só troca quando outro tem mais de 3 vagas comuns a mais, ou quando o atual cai abaixo de 3 (UX-33). O mesmo vale para a frase de resumo do celular. Os tamanhos da guarita são tokens `--text-g-*` em `globals.css`; o número é limitado por `15vh` e o "SEM DADOS" por `6.5vh`, para a coluna caber em 1024x768 com 500 vagas; o aviso do centro ficou em 1,6vw (22 px em 1366x768, 5,2 minutos de arco a 3 m) para caber em duas linhas.
45. **Abaixo de 600 px de altura de CSS (zoom ou escala do Windows), a guarita ganha rolagem** e a faixa fica presa embaixo (UX-32). Só nesse caso a regra "sem rolagem" da especificação 3.5 item 3 não vale.
46. **Demonstração com roteiro fixo de 180 s alinhado ao relógio** (D14): todas as telas mostram o mesmo número no mesmo instante, com quatro cenas e cor violeta própria. Na guarita, a faixa da especificação 3.1 vira o título do cabeçalho; no celular ela fica presa no topo com a cena e o link "Ver as vagas reais". O título da aba vira "Demonstração · …".
47. **Mapa sem números, depois das seções, com o título "Como chegar"** (D7, desvio da especificação 3.5.1). A Rua São Paulo fica na faixa da esquerda e nenhum texto do SVG tem menos de 24 unidades. Os termos visíveis são "Bloco X" e "estacionamento" (D6); "bolsão" fica no código, no banco e nos documentos.
48. **Até 12 vagas, a grade do celular desenha vagas numeradas com ícones** (UX-38, desvio da especificação 3.3.3); com 13 ou mais, a grade compacta com × e a letra do tipo especial. Em SEM DADOS a grade vira um bloco listrado sem células, com o motivo. Com fonte em 200 % os cartões empilham (UX-42, desvio da especificação 3.3 item 2).
49. **Cores:** `--lotado` passou a `#f87171` e `--vaga-ocupada` a `#6b7785` (D8), com teste de contraste em `src/app/contraste.test.ts`. Só tema escuro (D18). A fonte Inter saiu (D16). Convite de instalação só no iPhone, sem `beforeinstallprompt` (D17); nome curto da PWA "Vagas SENAI" (desvio da especificação 3.4) e orientação livre.
50. **Aviso da manutenção por bloco** (UX-61): coluna `vagas.bolsoes.aviso` (até 80 caracteres), mostrada só junto do SEM DADOS. Exemplo: `update vagas.bolsoes set aviso = 'Sensor em conserto até sexta' where id = 'H';`.
51. **Bolsão de maquete fora da página pública** (UX-59): `vagas.bolsoes.publico` (o `M` nasce com `false`), `?maquete=1` mostra só ele, e `vagas.centrais.bolsoes` limita em que bolsões cada token publica (`bolsao-a` → `{A}` etc.; nulo = todos). Enquanto a maquete faz o papel dos três estacionamentos, o token `maquete` fica com a lista nula e os números dela aparecem no site público; quando as placas reais entrarem, basta trocar os ids em `BOLSOES` do `maquete.ino` para `M` e a lista do token para `{M}`.
52. **Diagnóstico das placas** (UX-58): `vagas.publicar(p_token, p_bolsoes, p_diag, p_especiais)` substitui a função de dois parâmetros; `vagas.placas()` lista as centrais ativas sem o hash; a tela `/placas` (fora dos buscadores) mostra último envio, sinal, tempo ligada, reinício, versão e o sensor que não muda há 24 h enquanto os outros mudam. **A placa define as vagas especiais** (`VAGAS_PCD`, `VAGAS_IDOSO` no `.ino`); um update por SQL é sobrescrito no envio seguinte. É desvio da especificação 2.2.
53. **Tela de resultados `/resultados`** (D21, fora do escopo original), com as funções `vagas.resumo_noites`, `vagas.impacto` e `vagas.serie_noite` (`security definer`, só agregados; `anon` continua sem ler `historico`; a maquete fica de fora). "Janelas avaliadas" são as com foto de pelo menos dois bolsões; a média "dos outros blocos" é a dos bolsões com foto e com vaga nessas janelas. Um gráfico SVG por bloco; CSV com `;` e hora local.
54. **Telas de erro e 404 em português** (D22): `error.tsx`, `guarita/error.tsx`, `global-error.tsx` e `not-found.tsx` com o visual do SEM DADOS, sem número guardado. A guarita tenta de novo a cada 30 s e, na terceira tentativa, só recarrega se um `HEAD` no próprio endereço responder. O contador fica em `sessionStorage["vagas-erro-tentativas"]` e `useVagas` o zera na primeira carga boa.
55. **Folha do QR** (UX-18): QR de 165 mm, nível H, modo alfanumérico; título "Vagas livres agora / nos blocos A, C e H" e "Com o carro parado, aponte a câmera do celular." (desvio do texto da especificação 3.5). As três folhas (`/qr`, `/qr/sala`, `/guarita/guia`) usam `src/components/folha.tsx`. A folha já impressa precisa ser impressa de novo.
56. **Página `/como-funciona`** com o problema, o caminho do dado, a regra do SEM DADOS, a maquete, os créditos ("Sensores e placas: João Victor Fagundes Miranda, aluno de Desenvolvimento de Sistemas do SENAI Itumbiara. Site e banco de dados: Matheus Fagundes.") e o painel com um cartão por tela. É a porta de entrada para todas as telas; o rodapé de `/` leva até ela, até `/resultados`, `/guarita` e `/qr`, e tem o botão "Enviar o link".
57. **Guarita no PC:** o atalho abre `/guarita?quiosque=1` (some o botão de tela cheia); `&som=1` liga os avisos falados (UX-63) e exige caixa de som e a flag `--autoplay-policy=no-user-gesture-required`. A tela recarrega sozinha uma vez por dia às 17:30 se estiver aberta há mais de 1 h e o servidor responder, e mostra a versão (7 caracteres do commit) no canto (UX-46). O guia impresso do vigia fica em `/guarita/guia`.
58. **Acessos contados pelo Web Analytics da Vercel** (UX-60), sem cookies, com a guarita, a demonstração e a maquete filtradas. Precisa ligar o Web Analytics no projeto `vagas-senai` na Vercel; sem isso o script responde 404 e nada quebra.
59. **Leitor de tela:** sem `aria-live` nas listas; um anunciador fala só quando a situação de um bloco muda ou a conexão cai e volta (D19). Alvos de toque de 44 px, zoom livre, modo de contraste alto do Windows coberto (UX-43).
60. **Firmware:** os arquivos das placas são gerados por `npm run firmware:placas` a partir do `.env.local` e compilados por `npm run firmware:compilar`; `N_VAGAS` vem do tamanho de `PINO_VAGA` (a decisão 35 mudou: o João confere só os pinos e o Wi-Fi); pino inválido bloqueia o envio; timeouts de TLS abaixo do watchdog; a página local da placa mostra SEM DADOS depois de 20 s sem resposta (D15) e diagnóstico completo; a rede da placa abre a página sozinha (portal cativo); `VERSAO_FIRMWARE` é a data da última mudança. O `bolsao.ino` para a compilação com uma frase em português no core esp32 2.x.
61. **Maquete com uma placa só:** `firmware/maquete/maquete.ino` lê vários bolsões (lista `BOLSOES` no topo) e publica tudo numa chamada a cada 3 s, com o token `maquete`. A cópia preenchida fica em `firmware/bolsao/placas/maquete/` (ignorada pelo git). Pergunta para o João: existe bolsão com mais de 19 vagas? Uma placa tem 19 entradas usáveis.
62. **Commits por grupo de itens, e não por item,** nas partes do site em que os itens dividiam os mesmos arquivos (regras, hook e componentes). O firmware e as telas novas saíram um commit por item, nas branches `firmware-ux` e `telas-ux`, integradas na `main`.
