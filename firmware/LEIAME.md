# Firmware

```
ESP32 do bolsão (sensores + Wi-Fi do campus) ──HTTPS a cada 10 s──► Supabase ──► página
        └─► página local em 192.168.4.1 (opcional, igual à original)
```

- `bolsao/bolsao.ino`: **o arquivo que vai em cada ESP32.** Leitura dos sensores (igual ao código original do João), página local opcional e envio para o Supabase.
- `central/` e `ponte/`: variante para o caso de os nós voltarem a mandar por ESP-NOW para uma central. Não é preciso para o caminho atual.

## Gravar um bolsão

1. Abra `bolsao/bolsao.ino` e preencha o bloco de configuração no topo:
   - `ID_BOLSAO` ("A", "C" ou "H"), `NOME_BOLSAO`, `N_VAGAS` e os pinos;
   - `WIFI_SSID`, `WIFI_SENHA` e, se a rede pedir usuário, `WIFI_USUARIO`;
   - `SUPABASE_URL` e `SUPABASE_ANON_KEY` (Project Settings → Data API e API Keys);
   - `TOKEN_CENTRAL`, de `npm run token:gerar -- bolsao-a "Bolsão A"` (um por bolsão).
   - `MANTER_PAGINA_LOCAL`: 1 mantém a rede `Estacionamento-A` com a página; 0 desliga.
2. Arduino IDE: placa "ESP32 Dev Module", grave. Ou `arduino-cli compile --fqbn esp32:esp32:esp32 firmware/bolsao` e `arduino-cli upload --fqbn esp32:esp32:esp32 -p COM5 firmware/bolsao`.
3. Monitor serial em 115200. Esperado: `[wifi] conectado, IP ...` e depois `[http] ok, 3 livres, 180 ms` a cada 10 s (a primeira vez leva ~2 s por causa do TLS).

Não faça commit do arquivo com o token ou a senha do Wi-Fi preenchidos.

## O que o monitor serial mostra

- `[http] token recusado (403)`: o token não bate com `vagas.centrais`, ou a central está com `ativa = false`.
- `[http] erro 400 ...`: o banco recusou o payload. Quase sempre `ID_BOLSAO` que não existe na tabela.
- `[http] erro 404`: o schema `vagas` não está exposto na API do Supabase.
- `[http] falha de rede`: sem resposta. Tenta de novo no próximo ciclo.
- `[wifi] sem conexão há N s, tentando de novo`: refaz a conexão com espera crescente (30 s, 1, 2, 4, 5 min).

## Comportamento quando algo cai

| Situação | ESP32 | Página |
|---|---|---|
| Wi-Fi do campus cai | continua lendo os sensores e servindo a página local; reconecta sozinho | após 30 s, aquele bolsão em SEM DADOS |
| Supabase fora do ar | registra o erro, tenta a cada 10 s | após 30 s, SEM DADOS |
| ESP32 de um bolsão desliga | | só aquele bolsão em SEM DADOS |
| Loop trava | watchdog de 30 s reinicia a placa | SEM DADOS até voltar |

Durante um POST o loop pode ficar parado até 5 s (timeout). A leitura dos sensores pausa nesse tempo; com o filtro de 3 leituras, nenhum estado muda por causa disso. Se um dia isso incomodar, o envio pode ir para uma tarefa separada do FreeRTOS.

## Wi-Fi do campus

- Só senha: preencha `WIFI_SSID` e `WIFI_SENHA`.
- Usuário e senha (WPA2-Enterprise/PEAP): preencha também `WIFI_USUARIO`.
- Página de login no navegador (portal cativo): o ESP32 não consegue passar. A TI precisa liberar o MAC da placa (aparece no monitor serial na linha `[bolsao] ... pronto, MAC ...`).
- O ESP32 só pega 2,4 GHz.

## Certificado TLS

No protótipo `tls.setInsecure()` aceita qualquer certificado. Na versão final, troque pela linha comentada logo acima dele (`setCACertBundle`), que valida o Supabase com o pacote de raízes do próprio core.
