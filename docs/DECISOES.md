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
