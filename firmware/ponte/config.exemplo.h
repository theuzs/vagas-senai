// Copie este arquivo para config.h (que fica fora do git) e preencha.
#pragma once

// ---- Wi-Fi do campus ----
#define WIFI_SSID "NOME-DA-REDE"
#define WIFI_SENHA "senha-da-rede"
// Rede com usuário e senha (WPA2-Enterprise/PEAP): preencha o usuário.
// Rede só com senha: deixe "" (vazio).
#define WIFI_USUARIO ""

// ---- Supabase (podem ficar expostas: a chave anon só lê bolsoes e chama publicar/agora) ----
#define SUPABASE_URL "https://xxxxxxxxxxxx.supabase.co"
#define SUPABASE_ANON_KEY "eyJ..."

// ---- Token desta central (gerado por `npm run token:gerar`). Este NÃO pode vazar. ----
#define TOKEN_CENTRAL "cole-aqui-o-token"

// ---- Pinos e opções ----
#define PINO_RX_CENTRAL 16   // RX2 da ponte <- TX2 (GPIO 17) da central
#define PINO_TX_CENTRAL 17   // não usado, mas Serial2 precisa de um
#define INTERVALO_PUBLICAR_MS 10000   // 5 a 10 s: o handshake TLS leva ~2 s
#define FRESCOR_NO_MS 5000            // bolsão só vai no envio se o nó falou nos últimos 5 s

// LCD 20x4 I2C na guarita (opcional): 1 liga, 0 desliga
#define USAR_LCD 0
#define LCD_ENDERECO 0x27
#define PINO_SDA 21
#define PINO_SCL 22
