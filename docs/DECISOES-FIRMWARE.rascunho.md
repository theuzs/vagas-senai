# Decisões do firmware (rascunho)

Registros dos itens de firmware de `docs/MELHORIAS-UX.md` (UX-20 a UX-27, UX-51 a UX-53, a parte de firmware do UX-58 e a maquete). O Matheus junta este rascunho em `docs/DECISOES.md`, a partir do número 38.

## UX-20 · Gerador dos arquivos das placas

- **Os arquivos das placas são gerados, e não copiados à mão.** `npm run firmware:placas` (`scripts/gerar-placas.ts`) lê `firmware/bolsao/bolsao.ino` e grava `firmware/bolsao/placas/bolsao_X/bolsao_X.ino` para A, C e H, trocando `ID_BOLSAO`, `NOME_BOLSAO`, `AP_SSID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `TOKEN_CENTRAL` pelos valores do `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TOKEN_BOLSAO_A`, `TOKEN_BOLSAO_C`, `TOKEN_BOLSAO_H`). Se o arquivo anterior da placa tinha `WIFI_SSID`, `WIFI_SENHA`, `WIFI_USUARIO` ou `PINO_VAGA` diferentes do exemplo, o gerador leva essas linhas. O script nunca imprime token, chave nem senha. `npm run firmware:compilar` compila `firmware/bolsao`, `firmware/maquete` e cada placa com o arduino-cli.
- **`VERSAO_FIRMWARE`** é a data da última mudança do `.ino`, fora do bloco de configuração. Ela aparece no monitor serial, na página local e no diagnóstico enviado ao banco.

## UX-21 · N_VAGAS calculado a partir de PINO_VAGA

- **A decisão 35 mudou.** O João não confere mais `N_VAGAS`: a quantidade de vagas é o tamanho de `PINO_VAGA` (`const int N_VAGAS = sizeof(PINO_VAGA) / sizeof(PINO_VAGA[0]);`). Com isso, uma lista com menos pinos do que o número declarado não preenche vagas com o GPIO 0. O cabeçalho dos arquivos das placas passou a dizer "Falta conferir PINO_VAGA (um pino por vaga) e preencher o Wi-Fi do campus.".
- **Pino inválido bloqueia o envio.** Na partida, a placa confere cada pino: inexistente (20, 24, 28 a 31, acima de 39), da flash (6 a 11), da serial (1 e 3) ou repetido. Com erro, ela imprime `[config] A vaga 4 usa o GPIO 6, que é da memória flash. Troque em PINO_VAGA.` a cada 10 s e não chama `publicar()`, então o site mostra SEM DADOS e a página local mostra a situação "config". Os pinos 0, 2, 5, 12 e 15 só geram aviso na partida.

## UX-27 · LEIAME para quem grava e instala a placa

- **Pergunta para o João: existe bolsão com mais de 19 vagas?** Uma placa ESP32 Dev Module tem 19 pinos usáveis como entrada de sensor (15 normais e 4 só de entrada). Com mais vagas, é preciso uma segunda placa no mesmo bolsão ou um expansor de entradas, e o firmware ainda não trata nenhum dos dois.
- O `bolsao.ino` para a compilação com uma mensagem em português quando a placa esp32 instalada é a 2.x (`#error` logo depois dos includes).

## UX-58 · Diagnóstico remoto e vagas especiais definidas na placa (parte do firmware)

- **A placa define as vagas especiais. Um update por SQL é sobrescrito no envio seguinte.** `VAGAS_PCD` e `VAGAS_IDOSO` ficam logo abaixo de `PINO_VAGA`, em numeração humana ("1,2"). A placa confere faixa e repetição na partida; com erro, imprime `[config] VAGAS_PCD tem a vaga 7, mas N_VAGAS é 5`, mostra o aviso na página local e não manda `p_especiais`. Sem erro, manda sempre `"p_especiais":{"A":{"pcd":[0,1]}}` (ou `{"A":{}}`), com posições a partir de 0, como o banco guarda.
- **Desvio da especificação 2.2:** as posições de PCD e idoso deixam de ser cadastradas só no banco. A fonte passa a ser o arquivo da placa, porque mudar a ordem de `PINO_VAGA` deixaria o banco apontando para as vagas erradas.
- **Diagnóstico no payload.** Cada envio leva `"p_diag":{"rssi":-67,"uptime_s":11520,"reinicio":"watchdog","versao":"2026-10-15","sem_mudar_h":[0,0,27,0,1]}`. `sem_mudar_h` conta as horas desde a última troca de cada sensor (desde a partida, se ele nunca trocou). `reinicio` vai curto: "energia", "queda de tensão", "watchdog", "erro no programa", "programa" ou "código N". A função `publicar` precisa aceitar `p_diag` e `p_especiais` com default null (migration do UX-58, fora deste rascunho).
