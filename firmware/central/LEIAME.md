# Trecho para a central

A central continua igual: recebe os nós por ESP-NOW, mantém o softAP e a página local se quiser. A única mudança é repassar cada pacote recebido para a ponte por um fio serial. O arquivo `saida_ponte.h` faz isso.

Este trecho foi escrito sem ver o código atual da central nem o formato do pacote dos nós. O exemplo abaixo usa uma struct hipotética; ajuste os nomes para o pacote real.

## Ligação

| Central (ESP32) | Ponte (ESP32) |
|---|---|
| GPIO 17 (TX2) | GPIO 16 (RX2) |
| GND | GND |

Só um fio de dados, da central para a ponte. As duas placas precisam de alimentação própria, ou a mesma fonte 5 V. Fio curto (até uns 2 m vai bem a 115200).

## Como encaixar

1. Copie `saida_ponte.h` para a pasta do `.ino` da central e inclua: `#include "saida_ponte.h"`.
2. No `setup()`, depois do `Serial.begin`: `iniciarSaidaPonte();` (RX 16, TX 17; se esses pinos já estiverem em uso, passe outros: `iniciarSaidaPonte(26, 27)`).
3. No callback do ESP-NOW, só copie o pacote para um buffer e marque uma flag. Escrever na serial dentro do callback não é permitido (ele roda na tarefa do Wi-Fi).
4. No `loop()`, quando a flag estiver marcada, chame `enviarParaPonte(id, estados, n)`.

## Exemplo

```cpp
#include <esp_now.h>
#include <WiFi.h>
#include "saida_ponte.h"

// Pacote hipotético. Troque pelo que os nós realmente mandam.
struct PacoteNo {
  uint8_t  bolsao;        // 0 = A, 1 = C, 2 = H  (ou o que o nó usa)
  uint16_t total;         // quantas vagas
  uint8_t  estados[64];   // 0 livre, 1 ocupada, uma posição por vaga
};

// Se o pacote não traz o id do bolsão, descubra pelo MAC do nó:
static const struct { uint8_t mac[6]; const char* id; } NOS[] = {
  {{0x24, 0x6F, 0x28, 0xAA, 0xBB, 0x01}, "A"},
  {{0x24, 0x6F, 0x28, 0xAA, 0xBB, 0x02}, "C"},
  {{0x24, 0x6F, 0x28, 0xAA, 0xBB, 0x03}, "H"},
};

static const char* IDS[] = {"A", "C", "H"};

// Buffer de troca entre o callback e o loop (um por bolsão).
static PacoteNo pendente[3];
static volatile bool temPendente[3] = {false, false, false};

// Core 3.x: a assinatura leva esp_now_recv_info_t*. Core 2.x: const uint8_t* mac.
void aoReceber(const esp_now_recv_info_t* info, const uint8_t* dados, int tam) {
  if (tam != sizeof(PacoteNo)) return;
  const PacoteNo* p = (const PacoteNo*)dados;
  if (p->bolsao > 2) return;
  memcpy(&pendente[p->bolsao], p, sizeof(PacoteNo));
  temPendente[p->bolsao] = true;
  // ... aqui continua o que a central já fazia com o pacote (página local etc.)
}

void setup() {
  Serial.begin(115200);
  iniciarSaidaPonte();
  // ... WiFi.mode, esp_now_init, esp_now_register_recv_cb(aoReceber) como já está
}

void loop() {
  for (int i = 0; i < 3; i++) {
    if (temPendente[i]) {
      temPendente[i] = false;
      PacoteNo copia;
      noInterrupts();
      memcpy(&copia, &pendente[i], sizeof(copia));
      interrupts();
      enviarParaPonte(IDS[i], copia.estados, copia.total);
    }
  }
  // ... resto do loop da central
}
```

Como os nós mandam a cada 1 s mesmo sem mudança, a ponte recebe uma linha por bolsão por segundo. É isso que a ponte usa para saber que o nó está vivo: bolsão sem linha há mais de 5 s fica de fora da publicação e vira SEM DADOS na página.

## Conferir no monitor serial da ponte

Com a ponte ligada na USB e o monitor em 115200, cada linha válida não imprime nada; linha inválida imprime `[serial] linha descartada`. Se só aparecer isso, confira o GND comum e se TX da central está no RX da ponte.
