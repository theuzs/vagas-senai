# Decisões do firmware (rascunho)

Registros dos itens de firmware de `docs/MELHORIAS-UX.md` (UX-20 a UX-27, UX-51 a UX-53, a parte de firmware do UX-58 e a maquete). O Matheus junta este rascunho em `docs/DECISOES.md`, a partir do número 38.

## UX-20 · Gerador dos arquivos das placas

- **Os arquivos das placas são gerados, e não copiados à mão.** `npm run firmware:placas` (`scripts/gerar-placas.ts`) lê `firmware/bolsao/bolsao.ino` e grava `firmware/bolsao/placas/bolsao_X/bolsao_X.ino` para A, C e H, trocando `ID_BOLSAO`, `NOME_BOLSAO`, `AP_SSID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `TOKEN_CENTRAL` pelos valores do `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TOKEN_BOLSAO_A`, `TOKEN_BOLSAO_C`, `TOKEN_BOLSAO_H`). Se o arquivo anterior da placa tinha `WIFI_SSID`, `WIFI_SENHA`, `WIFI_USUARIO` ou `PINO_VAGA` diferentes do exemplo, o gerador leva essas linhas. O script nunca imprime token, chave nem senha. `npm run firmware:compilar` compila `firmware/bolsao`, `firmware/maquete` e cada placa com o arduino-cli.
- **`VERSAO_FIRMWARE`** é a data da última mudança do `.ino`, fora do bloco de configuração. Ela aparece no monitor serial, na página local e no diagnóstico enviado ao banco.

## UX-21 · N_VAGAS calculado a partir de PINO_VAGA

- **A decisão 35 mudou.** O João não confere mais `N_VAGAS`: a quantidade de vagas é o tamanho de `PINO_VAGA` (`const int N_VAGAS = sizeof(PINO_VAGA) / sizeof(PINO_VAGA[0]);`). Com isso, uma lista com menos pinos do que o número declarado não preenche vagas com o GPIO 0. O cabeçalho dos arquivos das placas passou a dizer "Falta conferir PINO_VAGA (um pino por vaga) e preencher o Wi-Fi do campus.".
- **Pino inválido bloqueia o envio.** Na partida, a placa confere cada pino: inexistente (20, 24, 28 a 31, acima de 39), da flash (6 a 11), da serial (1 e 3) ou repetido. Com erro, ela imprime `[config] A vaga 4 usa o GPIO 6, que é da memória flash. Troque em PINO_VAGA.` a cada 10 s e não chama `publicar()`, então o site mostra SEM DADOS e a página local mostra a situação "config". Os pinos 0, 2, 5, 12 e 15 só geram aviso na partida.
