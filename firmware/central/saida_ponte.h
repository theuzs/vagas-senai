// Trecho para a central atual (a placa que recebe os nós por ESP-NOW).
// Monta a linha "$V,<id>,<estados>*<cs>\n" e escreve em Serial2 para a ponte.
// Veja LEIAME.md nesta pasta para onde chamar.
#pragma once
#include <Arduino.h>

// Chame uma vez no setup(), depois de Serial.begin():
//   iniciarSaidaPonte();
inline void iniciarSaidaPonte(int pinoRx = 16, int pinoTx = 17) {
  Serial2.begin(115200, SERIAL_8N1, pinoRx, pinoTx);
}

// id: "A", "C", "H" (1 a 8 letras maiúsculas ou números)
// estados: um byte por vaga, 0 = livre, qualquer outro valor = ocupada
// n: quantidade de vagas (1 a 500)
// Chame no loop(), nunca dentro do callback do ESP-NOW.
inline void enviarParaPonte(const char* id, const uint8_t* estados, uint16_t n) {
  if (!id || !estados || n < 1 || n > 500) return;
  static char linha[3 + 8 + 1 + 500 + 1 + 2 + 2];  // "$V," id "," estados "*" cs "\n"
  size_t pos = 0;
  linha[pos++] = '$';
  linha[pos++] = 'V';
  linha[pos++] = ',';
  for (size_t i = 0; id[i] && i < 8; i++) linha[pos++] = id[i];
  linha[pos++] = ',';
  for (uint16_t i = 0; i < n; i++) linha[pos++] = estados[i] ? '1' : '0';
  uint8_t cs = 0;
  for (size_t i = 1; i < pos; i++) cs ^= (uint8_t)linha[i];
  static const char DIGITOS_HEX[] = "0123456789ABCDEF"; // "HEX" é macro do Arduino
  linha[pos++] = '*';
  linha[pos++] = DIGITOS_HEX[cs >> 4];
  linha[pos++] = DIGITOS_HEX[cs & 0x0F];
  linha[pos++] = '\n';
  Serial2.write((const uint8_t*)linha, pos);
}
