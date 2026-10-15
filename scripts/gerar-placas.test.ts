import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cabecalho, gerarPlaca, linhaDoCampo } from "./gerar-placas";

/** Trecho de configuração igual ao do bolsao.ino, com os valores de exemplo. */
const INO_EXEMPLO = `// Bolsão com sensores.
#include <WiFi.h>

// ================= CONFIGURAÇÃO (muda por bolsão) =================
const char* ID_BOLSAO   = "A";            // "A", "C" ou "H"
const char* NOME_BOLSAO = "Bloco A";
const int   PINO_VAGA[] = {32, 33, 34, 35, 25};   // um pino por vaga, na ordem das vagas

const char* WIFI_SSID    = "NOME-DA-REDE";
const char* WIFI_SENHA   = "senha-da-rede";
const char* WIFI_USUARIO = "";

const char* SUPABASE_URL      = "https://xxxxxxxxxxxx.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJ...";
const char* TOKEN_CENTRAL = "cole-aqui-o-token";

const char* AP_SSID  = "Estacionamento-A";
const char* AP_SENHA = "vagas1234";
// ===================================================================

void setup() {}
`;

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://projeto-teste.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "chave-publica-de-teste",
  TOKEN_BOLSAO_A: "token-secreto-da-placa-a",
  TOKEN_BOLSAO_C: "token-secreto-da-placa-c",
  TOKEN_BOLSAO_H: "token-secreto-da-placa-h",
};

describe("gerarPlaca", () => {
  it("troca id, nome, rede local, Supabase e token, e mantém o resto igual ao .ino", () => {
    const saida = gerarPlaca(INO_EXEMPLO, "H", ENV, null, "2026-10-15");
    expect(saida).toContain('const char* ID_BOLSAO = "H";');
    expect(saida).toContain('const char* NOME_BOLSAO = "Bloco H";');
    expect(saida).toContain('const char* AP_SSID = "Estacionamento-H";');
    expect(saida).toContain('const char* SUPABASE_URL = "https://projeto-teste.supabase.co";');
    expect(saida).toContain('const char* SUPABASE_ANON_KEY = "chave-publica-de-teste";');
    expect(saida).toContain('const char* TOKEN_CENTRAL = "token-secreto-da-placa-h";');
    expect(saida).not.toContain("token-secreto-da-placa-a");
    // O que não é configurado continua como no exemplo.
    expect(saida).toContain('const char* WIFI_SSID    = "NOME-DA-REDE";');
    expect(saida).toContain("const int   PINO_VAGA[] = {32, 33, 34, 35, 25};   // um pino por vaga, na ordem das vagas");
    expect(saida).toContain("void setup() {}");
    expect(saida.startsWith(cabecalho("H", "2026-10-15"))).toBe(true);
    expect(saida.split("\n").slice(0, 3).every((l) => l.startsWith("//"))).toBe(true);
    expect(saida).toContain("Falta conferir PINO_VAGA (um pino por vaga) e preencher o Wi-Fi do campus.");
  });

  it("leva do arquivo antigo o Wi-Fi e os pinos que o João mudou", () => {
    const antigo = gerarPlaca(INO_EXEMPLO, "A", ENV, null, "2026-10-01")
      .replace('const char* WIFI_SSID    = "NOME-DA-REDE";', 'const char* WIFI_SSID    = "REDE-X";')
      .replace("const int   PINO_VAGA[] = {32, 33, 34, 35, 25};   // um pino por vaga, na ordem das vagas", "const int   PINO_VAGA[] = {4, 13};")
      .replace('const char* TOKEN_CENTRAL = "token-secreto-da-placa-a";', 'const char* TOKEN_CENTRAL = "token-velho";');
    const saida = gerarPlaca(INO_EXEMPLO, "A", ENV, antigo, "2026-10-15");
    expect(saida).toContain('const char* WIFI_SSID    = "REDE-X";');
    expect(saida).toContain("const int   PINO_VAGA[] = {4, 13};");
    expect(saida).not.toContain("{32, 33, 34, 35, 25}");
    // Senha e usuário iguais ao exemplo não contam como editados.
    expect(saida).toContain('const char* WIFI_SENHA   = "senha-da-rede";');
    expect(saida).toContain('const char* WIFI_USUARIO = "";');
    // O token vem da env, nunca do arquivo antigo.
    expect(saida).toContain('const char* TOKEN_CENTRAL = "token-secreto-da-placa-a";');
    expect(saida).not.toContain("token-velho");
  });

  it("avisa com o nome do campo quando o .ino não tem TOKEN_CENTRAL", () => {
    const semToken = INO_EXEMPLO.replace(/^const char\* TOKEN_CENTRAL.*$/m, "");
    expect(() => gerarPlaca(semToken, "A", ENV, null)).toThrow("Não achei TOKEN_CENTRAL no bolsao.ino");
  });

  it("avisa com o nome da variável quando falta o token da placa no .env.local", () => {
    const { TOKEN_BOLSAO_H: _h, ...env } = ENV;
    void _h;
    let erro = "";
    try {
      gerarPlaca(INO_EXEMPLO, "H", env, null);
    } catch (e) {
      erro = (e as Error).message;
    }
    expect(erro).toBe("Falta TOKEN_BOLSAO_H no .env.local");
    expect(erro).not.toContain("token-secreto");
  });

  it("não deixa nenhum segredo nas mensagens de erro", () => {
    for (const campo of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const) {
      const env = { ...ENV, [campo]: "" };
      let erro = "";
      try {
        gerarPlaca(INO_EXEMPLO, "C", env, null);
      } catch (e) {
        erro = (e as Error).message;
      }
      expect(erro).toBe(`Falta ${campo} no .env.local`);
      for (const valor of Object.values(ENV)) expect(erro).not.toContain(valor);
    }
  });

  it("acha os campos no bolsao.ino do repositório", () => {
    const ino = readFileSync(join(process.cwd(), "firmware", "bolsao", "bolsao.ino"), "utf8");
    for (const campo of ["ID_BOLSAO", "NOME_BOLSAO", "AP_SSID", "SUPABASE_URL", "SUPABASE_ANON_KEY", "TOKEN_CENTRAL", "WIFI_SSID", "WIFI_SENHA", "WIFI_USUARIO", "PINO_VAGA"]) {
      expect(linhaDoCampo(ino, campo), campo).not.toBeNull();
    }
    const saida = gerarPlaca(ino, "C", ENV, null, "2026-10-15");
    expect(saida).toContain('const char* ID_BOLSAO = "C";');
    expect(saida).toContain('const char* AP_SSID = "Estacionamento-C";');
    expect(saida).toMatch(/const char\* VERSAO_FIRMWARE = "\d{4}-\d{2}-\d{2}";/);
  });
});
