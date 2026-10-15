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
