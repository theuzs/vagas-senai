# Firmware

```
ESP32 do bolsão (sensores + Wi-Fi do campus) ──HTTPS a cada 10 s──► Supabase ──► página
        └─► página local em 192.168.4.1 (rede Estacionamento-X)
```

- `bolsao/bolsao.ino`: o código de cada ESP32. Leitura dos sensores (igual ao código original do João), página local e envio para o Supabase. Este arquivo não tem segredo.
- `bolsao/placas/bolsao_A/bolsao_A.ino`, `bolsao_C` e `bolsao_H`: o arquivo pronto de cada placa, com o Supabase e o token preenchidos. A pasta `placas/` é ignorada pelo git. O Matheus gera esses arquivos com `npm run firmware:placas` (veja "Para o Matheus").
- `maquete/maquete.ino`: uma placa só que lê vários bolsões, para a maquete de demonstração.
- `central/` e `ponte/`: variante para o caso de os nós voltarem a mandar por ESP-NOW para uma central. Não é preciso para o caminho atual.

## Instalar uma placa

1. No Arduino IDE, abra Arquivo > Preferências e cole em "URLs adicionais para gerenciadores de placas": `https://espressif.github.io/arduino-esp32/package_esp32_index.json`.
2. Em Ferramentas > Placa > Gerenciador de Placas, procure `esp32` (Espressif Systems) e instale a versão 3.3.x. Com a versão 2.x a compilação para com uma mensagem em português dizendo isso.
3. Em Ferramentas > Placa, escolha "ESP32 Dev Module".
4. Abra o arquivo da placa: `bolsao/placas/bolsao_A/bolsao_A.ino` (ou `_C`, `_H`). Ao receber uma versão nova, copie do arquivo antigo para o novo as linhas de `WIFI_SSID`, `WIFI_SENHA`, `WIFI_USUARIO` e `PINO_VAGA`.
5. Confira `PINO_VAGA`: um pino por vaga, na ordem das vagas. A quantidade de vagas é o tamanho da lista. Use a tabela de pinos abaixo.
6. Preencha `WIFI_SSID` e `WIFI_SENHA`. Se a rede pede usuário e senha, preencha também `WIFI_USUARIO`. Se a rede não pede senha, deixe `WIFI_SENHA = ""`.
7. Ligue a placa no USB e grave (Sketch > Carregar). Se a gravação parar em `Timed out waiting for packet header`, segure o botão BOOT da placa quando a gravação começar.
8. Abra o monitor serial em 115200. A partida tem esta cara:
   ```
   [bolsao] Bloco A (ID A), firmware 2026-10-15
   [bolsao] reinício: ligou na energia
   [vagas] 5 vagas: 1=GPIO32 2=GPIO33 3=GPIO34 4=GPIO35 5=GPIO25
   [local] rede Estacionamento-A, senha vagas1234, página http://192.168.4.1
   [wifi] MAC 24:6F:28:AA:BB:CC (a TI libera este)
   [wifi] conectando em SENAI-IOT
   [wifi] conectado em SENAI-IOT, IP 10.20.4.37, sinal -61 dBm (bom)
   [http] ok, 3 de 5 livres, 180 ms, sinal -61 dBm
   ```
   A linha `[http] ok` repete a cada 10 s. A primeira leva uns 2 s a mais por causa do TLS. Se aparecer outra coisa, procure a mensagem na tabela "Se der erro".
9. Entre na rede Estacionamento-A (senha vagas1234). O celular abre a página da placa sozinho. Se não abrir, desligue os dados móveis e abra http://192.168.4.1. No iPhone, use a página dentro da janela que abrir. Se você tocar em Cancelar, o iPhone sai da rede da placa. A página mostra a faixa de diagnóstico, o número de vagas livres, a grade e os detalhes da placa. Enquanto a placa procura o Wi-Fi do campus, o celular pode cair da rede Estacionamento-A; basta entrar de novo.
10. Tampe cada sensor, um por vez, e confira na página que a vaga certa muda para "Ocupada". A célula que mudou ganha um contorno branco por 5 s. O monitor serial mostra `[vaga] 3 (GPIO 34) ocupada`.
11. Abra `https://vagas.rubysistemas.com.br` e veja o bloco sair de SEM DADOS em até 10 s.
12. Preencha `VAGAS_PCD` e `VAGAS_IDOSO` com os números das vagas que a página mostra (por exemplo `"1,2"`) e grave de novo. A placa manda isso ao site a cada envio, e a página local mostra "Vaga 1 (PCD)". Se um número não existir, o monitor serial mostra `[config] VAGAS_PCD tem a vaga 7, mas N_VAGAS é 5` e o site fica sem as vagas especiais até corrigir.

### Pinos do ESP32

| Uso | GPIO |
|---|---|
| Sensor (entrada normal) | 4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33 |
| Sensor (só entrada, sem resistor interno) | 34, 35, 36, 39 |
| Evitar: mexem na partida da placa | 0, 2, 5, 12, 15 |
| Nunca: serial e memória flash | 1, 3, 6, 7, 8, 9, 10, 11 |

Dá para ligar no máximo 19 sensores numa placa. Um pino da lista "nunca" ou repetido faz a placa imprimir `[config]` a cada 10 s e não enviar nada; o site fica em SEM DADOS até o arquivo ser corrigido.

### Se der erro

| Mensagem | O que fazer |
|---|---|
| `#error Este código precisa da placa esp32 versão 3.x` | Atualize a placa esp32 no Gerenciador de Placas para a 3.3.x (passo 2). |
| `WPA2_AUTH_PEAP was not declared` ou `esp_task_wdt_config_t was not declared` | A placa esp32 instalada é antiga. Atualize para a 3.3.x. |
| `Failed to connect to ESP32: Timed out waiting for packet header` | Segure o botão BOOT da placa quando a gravação começar. |
| Nenhuma porta COM em Ferramentas > Porta | Instale o driver do conversor USB da placa: CP210x (Silicon Labs) ou CH340. |
| `[config] Falta preencher WIFI_SSID no topo do arquivo.` | O arquivo ainda tem os valores de exemplo. Preencha o Wi-Fi do campus (passo 6). Vale para `WIFI_SENHA`, `TOKEN_CENTRAL`, `SUPABASE_URL` e `SUPABASE_ANON_KEY`. |
| `[config] A vaga 4 usa o GPIO 6, que é da memória flash. Troque em PINO_VAGA.` | Troque o pino pela tabela acima. A placa não envia nada até corrigir. O mesmo vale para "que não existe no ESP32", "que é da porta serial" e "igual à vaga N". |
| `[config] A vaga 3 usa o GPIO 12, que pode atrapalhar a partida da placa.` | Só um aviso. Se a placa reiniciar sozinha ou não ligar, troque o pino. |
| `[config] VAGAS_PCD tem a vaga 7, mas N_VAGAS é 5` | Confira os números em `VAGAS_PCD` e `VAGAS_IDOSO`. A placa continua enviando as vagas, sem as especiais. |
| `[wifi] não conectou: a rede X não foi encontrada. Confira o nome. A placa só pega 2,4 GHz.` | Confira `WIFI_SSID`. A placa não vê redes de 5 GHz. |
| `[wifi] não conectou: a rede recusou a senha.` | Confira `WIFI_SENHA`. Com `WIFI_USUARIO`, a mensagem diz "o usuário ou a senha". |
| `[wifi] não conectou: a rede X usa outro tipo de segurança. Se ela pede usuário, preencha WIFI_USUARIO.` | A rede pede usuário e senha (WPA2-Enterprise). |
| `[wifi] não conectou: a rede X é aberta ou usa segurança antiga. Se ela não pede senha, deixe WIFI_SENHA = "".` | O arquivo tem senha e a rede não pede. |
| `[wifi] sinal muito fraco (-84 dBm).` | Aproxime a placa do roteador ou use antena externa. |
| `[http] a rede respondeu no lugar do Supabase (200).` | A rede pede login no navegador (portal cativo). Peça à TI para liberar o MAC que aparece na linha `[wifi] MAC`. |
| `[http] chave recusada (401).` | A `SUPABASE_ANON_KEY` do arquivo está errada. Peça ao Matheus um arquivo novo. |
| `[http] token recusado (403).` | O token deste arquivo foi trocado ou desligado. Avise o Matheus. |
| `[http] dados recusados (400): ...` | O banco recusou o envio. Quase sempre `ID_BOLSAO` que não existe na tabela. |
| `[http] o Supabase não achou a função publicar (404).` | A migration não rodou no banco. Avise o Matheus. |
| `[http] o schema vagas não está liberado na API (406).` | O schema `vagas` não está exposto na API do Supabase. Avise o Matheus. |
| `[http] sem resposta do Supabase (não conectou).` | A rede tem Wi-Fi mas não libera a internet, ou o Supabase está fora. A placa tenta de novo em 10 s. |
| `[wifi] sem conexão há N s, tentando de novo` | A placa refaz a conexão com espera crescente (30 s, 1, 2, 4, 5 min). |

A página local mostra as mesmas situações em texto, na faixa abaixo do título. Com a placa parada, a página mostra SEM DADOS depois de 20 s.

## Comportamento quando algo cai

| Situação | ESP32 | Página |
|---|---|---|
| Wi-Fi do campus cai | continua lendo os sensores e servindo a página local; reconecta sozinho | após 30 s, aquele bolsão em SEM DADOS |
| Supabase fora do ar | registra o erro, tenta a cada 10 s | após 30 s, SEM DADOS |
| ESP32 de um bolsão desliga | | só aquele bolsão em SEM DADOS |
| Loop trava | watchdog de 30 s reinicia a placa | SEM DADOS até voltar |

Durante um POST o loop pode ficar parado até 15 s (4 s de conexão, 6 s de TLS e 5 s de resposta). A leitura dos sensores pausa nesse tempo; com o filtro de 3 leituras, nenhum estado muda por causa disso.

## Para o Matheus

1. Tokens, um por bolsão: `npm run token:gerar -- bolsao-a "Bolsão A"` (e `bolsao-c`, `bolsao-h`). Rode o SQL de cada um no Supabase e guarde os tokens no `.env.local` como `TOKEN_BOLSAO_A`, `TOKEN_BOLSAO_C` e `TOKEN_BOLSAO_H`.
2. No `.env.local`, confira `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. `npm run firmware:placas` gera `bolsao/placas/bolsao_X/bolsao_X.ino` para A, C e H. Se o arquivo da placa já existia com Wi-Fi ou pinos editados, o gerador leva essas linhas. O script não imprime token, chave nem senha.
4. `npm run firmware:compilar` compila `bolsao/`, `maquete/` e cada placa com o arduino-cli (procura no PATH e em `%LOCALAPPDATA%\arduino-cli\arduino-cli.exe`).
5. Mande ao João só a pasta da placa dele. Não faça commit de nenhum arquivo com token ou senha.
6. `MANTER_PAGINA_LOCAL`: 1 mantém a rede `Estacionamento-X` com a página; 0 desliga.

### Certificado TLS

No protótipo `tls.setInsecure()` aceita qualquer certificado. Na versão final, troque pela linha comentada logo acima dele (`setCACertBundle`), que valida o Supabase com o pacote de raízes do próprio core.
