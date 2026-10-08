# Firmware

```
nós (ESP-NOW) ──► central (placa atual) ──fio serial──► ponte (Wi-Fi do campus) ──HTTPS──► Supabase
                                                            └─► LCD na guarita (opcional)
```

- `central/`: o trecho que a central atual precisa para mandar os dados pelo fio. Veja `central/LEIAME.md`.
- `ponte/`: o firmware completo do ESP32 novo. Ele não participa do ESP-NOW.

## Por que duas placas

O ESP32 tem um rádio só. Se a central entrasse no Wi-Fi do campus, o ESP-NOW passaria para o canal do roteador e deixaria de ouvir os nós, que falam no canal do softAP atual. Rede de campus ainda troca de canal sozinha. Com duas placas a central não muda, os nós não mudam, e uma queda de internet ou um POST lento não atrapalha a recepção.

## Ligação

| Central | Ponte | LCD 20x4 I2C (opcional) |
|---|---|---|
| GPIO 17 (TX2) → | GPIO 16 (RX2) | |
| GND ↔ | GND | GND |
| | GPIO 21 (SDA) | SDA |
| | GPIO 22 (SCL) | SCL |
| | 5 V | VCC |

## Gravar a ponte

1. Copie `ponte/config.exemplo.h` para `ponte/config.h` e preencha Wi-Fi, URL e chave anon do Supabase e o token da central (`npm run token:gerar` na raiz do projeto). O `config.h` não vai para o git.
2. Com a Arduino IDE: abra `ponte/ponte.ino`, placa "ESP32 Dev Module", e se for usar o LCD instale a biblioteca "LiquidCrystal I2C" (Frank de Brabander). Grave.
3. Com o arduino-cli:

```
arduino-cli config init
arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32
arduino-cli lib install "LiquidCrystal I2C"
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/ponte
arduino-cli upload --fqbn esp32:esp32:esp32 -p COM5 firmware/ponte
arduino-cli monitor -p COM5 -c baudrate=115200
```

## O que o monitor serial mostra

- `[wifi] conectado, IP ...`: entrou na rede.
- `[http] ok, 3 bolsões em 180 ms`: publicou. Na primeira vez leva ~2 s (handshake TLS); depois a conexão fica aberta.
- `[http] token recusado (403)`: o token do `config.h` não bate com `vagas.centrais`, ou a central está com `ativa = false`.
- `[http] erro 400 ...`: o banco recusou o payload (bolsão desconhecido, estado inválido). O texto diz qual.
- `[http] falha de rede`: sem resposta. A ponte tenta de novo no próximo ciclo.
- `[serial] linha descartada`: a central mandou algo fora do formato ou o fio está com ruído.

## Comportamento quando algo cai

| Situação | Ponte | Página |
|---|---|---|
| Wi-Fi do campus cai | continua lendo a serial e o LCD; refaz o `begin` com espera crescente (30 s, 1, 2, 4, 5 min) | após 30 s, SEM DADOS nos três |
| Supabase fora do ar | registra o erro, tenta a cada 10 s | após 30 s, SEM DADOS |
| Nó do H morre | o H sai do payload depois de 5 s sem linha | após 30 s, só o H em SEM DADOS |
| Central reinicia | sem linhas por alguns segundos; nada trava | SEM DADOS até a central voltar |
| Ponte trava | watchdog de 30 s reinicia a placa | SEM DADOS até voltar |

## Alternativa: placa única

Daria para rodar a lógica da ponte na própria central em modo `WIFI_AP_STA`: a central entra no Wi-Fi do campus como cliente e mantém o ESP-NOW. Isso só funciona se os nós falarem no mesmo canal do roteador do campus (`esp_wifi_set_channel` nos nós com o canal que o roteador usa) e se esse canal não mudar. Se a TI trocar o canal, ou se o roteador usar 5 GHz para o SSID (o ESP32 só pega 2,4 GHz), a central para de ouvir os nós sem avisar. Como os nós já estão instalados e o objetivo é confiabilidade, a versão com duas placas é a recomendada. Se um dia for necessário, o código de `ponte.ino` muda pouco: troque `WiFi.mode(WIFI_STA)` por `WIFI_AP_STA`, tire a leitura da serial e chame `processarLinha`/a atualização de `bolsoes[]` direto do `loop()` a partir do buffer do ESP-NOW.
