# Decisões das telas novas (rascunho)

Rascunho dos registros pedidos pelos itens UX-15, UX-18, UX-54, UX-56, UX-62 e UX-64 de `docs/MELHORIAS-UX.md`. Quem fechar a onda copia estes itens para `docs/DECISOES.md`, numerando a partir do próximo número livre.

## UX-15: telas de erro e 404

- **A tela de erro e a 404 nunca mostram número guardado** (D22 da lista). `src/app/error.tsx`, `src/app/guarita/error.tsx` e `src/app/global-error.tsx` usam `ErroTela`, com o visual do SEM DADOS. A guarita tenta de novo sozinha a cada 30 s e a página a cada 10 s. Na terceira tentativa seguida, a tela faz um `HEAD` no próprio endereço e só recarrega quando o servidor responde; sem resposta, tenta de novo em 60 s. Assim o quiosque não cai na página de erro do Chrome, de onde ninguém sai sem teclado.
- O contador de tentativas fica em `sessionStorage["vagas-erro-tentativas"]`. Quem mexer em `useVagas` zera esse contador na primeira carga boa (`sessionStorage.setItem("vagas-erro-tentativas", "0")` dentro de try/catch).
- `ErroTela` ganhou a prop `guarita` para escolher o texto do vigia. O item só listava `error`, `retry`, `titulo` e `intervaloMs`; o texto depende da tela e não do intervalo.
- `not-found.tsx` é componente de servidor e usa o layout raiz, então sai com o tema escuro e o título "Página não encontrada".
