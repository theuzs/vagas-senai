# Decisões do firmware (rascunho)

Registros dos itens de firmware de `docs/MELHORIAS-UX.md` (UX-20 a UX-27, UX-51 a UX-53, a parte de firmware do UX-58 e a maquete). O Matheus junta este rascunho em `docs/DECISOES.md`, a partir do número 38.

## UX-20 · Gerador dos arquivos das placas

- **Os arquivos das placas são gerados, e não copiados à mão.** `npm run firmware:placas` (`scripts/gerar-placas.ts`) lê `firmware/bolsao/bolsao.ino` e grava `firmware/bolsao/placas/bolsao_X/bolsao_X.ino` para A, C e H, trocando `ID_BOLSAO`, `NOME_BOLSAO`, `AP_SSID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `TOKEN_CENTRAL` pelos valores do `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TOKEN_BOLSAO_A`, `TOKEN_BOLSAO_C`, `TOKEN_BOLSAO_H`). Se o arquivo anterior da placa tinha `WIFI_SSID`, `WIFI_SENHA`, `WIFI_USUARIO` ou `PINO_VAGA` diferentes do exemplo, o gerador leva essas linhas. O script nunca imprime token, chave nem senha. `npm run firmware:compilar` compila `firmware/bolsao`, `firmware/maquete` e cada placa com o arduino-cli.
- **`VERSAO_FIRMWARE`** é a data da última mudança do `.ino`, fora do bloco de configuração. Ela aparece no monitor serial, na página local e no diagnóstico enviado ao banco.
