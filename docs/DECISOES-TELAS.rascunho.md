# Decisões das telas novas (rascunho)

Rascunho dos registros pedidos pelos itens UX-15, UX-18, UX-54, UX-56, UX-62 e UX-64 de `docs/MELHORIAS-UX.md`. Quem fechar a onda copia estes itens para `docs/DECISOES.md`, numerando a partir do próximo número livre.

## UX-15: telas de erro e 404

- **A tela de erro e a 404 nunca mostram número guardado** (D22 da lista). `src/app/error.tsx`, `src/app/guarita/error.tsx` e `src/app/global-error.tsx` usam `ErroTela`, com o visual do SEM DADOS. A guarita tenta de novo sozinha a cada 30 s e a página a cada 10 s. Na terceira tentativa seguida, a tela faz um `HEAD` no próprio endereço e só recarrega quando o servidor responde; sem resposta, tenta de novo em 60 s. Assim o quiosque não cai na página de erro do Chrome, de onde ninguém sai sem teclado.
- O contador de tentativas fica em `sessionStorage["vagas-erro-tentativas"]`. Quem mexer em `useVagas` zera esse contador na primeira carga boa (`sessionStorage.setItem("vagas-erro-tentativas", "0")` dentro de try/catch).
- `ErroTela` ganhou a prop `guarita` para escolher o texto do vigia. O item só listava `error`, `retry`, `titulo` e `intervaloMs`; o texto depende da tela e não do intervalo.
- `not-found.tsx` é componente de servidor e usa o layout raiz, então sai com o tema escuro e o título "Página não encontrada".

## UX-18: folha do QR

- **A folha do QR muda o texto da especificação 3.5.** O título "Tem vaga no A, no C ou no H?" era pergunta seguida da resposta. Agora a folha diz "Vagas livres agora / nos blocos A, C e H", "Com o carro parado, aponte a câmera do celular.", o endereço e um rodapé que explica o SEM DADOS e a tela inicial do celular. O QR passou de 110 mm, nível M, modo byte para 165 mm, nível H, modo alfanumérico (endereço em maiúsculas, versão 3), com margem de 4 módulos. A impressão sai em uma página A4, com esquema claro e margem de 12 mm. A folha já impressa precisa ser impressa de novo.
- As três folhas impressas (`/qr`, `/qr/sala` e `/guarita/guia`) usam o mesmo componente `Folha` (`src/components/folha.tsx`), que traz o botão "Imprimir esta folha" e a dica de papel A4 só na tela, e o estilo de impressão.
- O teste atual `tests/e2e/extras.spec.ts` ("/qr tem o QR code e o endereço") espera "Aponte a câmera" com A maiúsculo; o texto novo é "Com o carro parado, aponte a câmera do celular.". Quem mexe nesse arquivo troca a expectativa para `/aponte a câmera/i`.

## UX-62: guia impresso do vigia

- `/guarita/guia` é uma folha A4 com os quatro estados da tela (retângulo de 24 mm na cor e no padrão de cada um) e espaço para o nome e o telefone do responsável pelos sensores. A página fica fora dos buscadores (`robots: index false`) e não lê dado nenhum. O passo 5 da seção 7 do `DEPLOY.md` manda imprimir e colar ao lado do monitor.

## UX-56: página "Como funciona"

- `/como-funciona` é estática, sem `useVagas`, e não faz pedido nenhum ao Supabase. Ela explica o problema (texto do desafio), o caminho do dado (`DiagramaCaminho`), a regra do SEM DADOS, a tela da guarita (captura `public/telas/guarita-demo.png`, tirada de `/guarita?demo=1` em 1366x768 por `scripts/capturar-guarita-demo.ts`), a maquete da primeira demonstração e quem fez. Os créditos usam o nome e o curso que o Matheus autorizou: "Sensores e placas: João Victor Fagundes Miranda, aluno de Desenvolvimento de Sistemas do SENAI Blumenau. Site e banco de dados: Matheus Fagundes."
- A seção "Veja funcionando" virou um painel de navegação com um cartão por tela (página das vagas, demonstração, guarita, guarita em demonstração, guia do vigia, folha do QR, QR para salas e resultados). O Matheus pediu um lugar de onde se chega a todas as telas; o item só listava três links.
- Os links "Como funciona" e "Resultados" no rodapé de `/` ficam por conta de quem mexe em `src/app/page.tsx`.

## UX-54: tela de resultados

- **Tela de resultados entra na Onda 3, fora do escopo original** (D21 da lista). O histórico já existia para a banca (decisão 8) e ninguém conseguia vê-lo. `/resultados` lê três funções novas da migration `0002_resultados.sql` (`vagas.resumo_noites`, `vagas.impacto` e `vagas.serie_noite`), em `security definer`, que devolvem só agregados e a série de uma noite; `anon` continua sem ler `vagas.historico`. Toda cifra fica presa à data ("Noite de 13/10") e a tela não usa `useVagas` nem lê `vagas.bolsoes`.
- Em `vagas.impacto`, "janelas avaliadas" são as janelas com foto de pelo menos dois bolsões, porque só nelas dá para comparar um bolsão com outro. A média de vagas livres "dos outros blocos" é a média, nas janelas que contaram, das vagas livres dos bolsões com foto e com vaga. Bolsão sem foto nunca conta como lotado nem como vaga.
- O filtro de `publico` (UX-59) ficou de fora das funções, por pedido do Matheus; quem fizer o UX-59 acrescenta `where b.publico` nas três.
- A página chama as rpc com `fetch` direto e a chave publishable (`src/lib/resultados/fonte-resultados.ts`), sem o supabase-js, porque não precisa de Realtime.
- O gráfico (`grafico-noite.tsx`) é um SVG por bloco, com a linha quebrada onde falta foto e uma faixa hachurada "sem dados" no lugar. Um SVG por bloco evita faixas sobrepostas quando dois blocos ficam sem foto em horas diferentes.
- O CSV usa ponto e vírgula e a hora local de São Paulo na coluna `momento` ("18:05"), porque a coluna `noite` já traz a data e a planilha fica legível.
- O link "Resultados" no rodapé de `/` fica por conta de quem mexe em `src/app/page.tsx`.

## UX-64: enviar o link e folha de QR para salas

- `EnviarLink` (`src/components/enviar-link.tsx`) usa `navigator.share` com título, texto e o endereço público; sem `share` (ou se a folha de compartilhar falhar), copia o endereço e mostra "Link copiado." por 3 s numa região `aria-live`. O endereço é sempre `ENDERECO_PUBLICO`, nunca o da aba (que pode ter `?demo=1`).
- O botão entra no rodapé de `/` por quem mexe em `src/app/page.tsx`: `import { EnviarLink } from "@/components/enviar-link";` e `<EnviarLink />` dentro do `<footer>`. Os E2E de `tests/e2e/qr.spec.ts` que clicam no botão ficam pulados ("skipped") até o botão existir.
- `/qr/sala` é a mesma folha A4 do `/qr`, com o QR de 140 mm, o título "Veja as vagas livres antes de chegar ao SENAI" e o passo a passo para adicionar a página à tela inicial no Android e no iPhone. Fica fora dos buscadores.
