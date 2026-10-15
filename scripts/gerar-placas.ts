/**
 * Gera o arquivo pronto de cada placa a partir de firmware/bolsao/bolsao.ino.
 *
 *   npm run firmware:placas
 *
 * Para A, C e H, lê o bolsao.ino e troca ID_BOLSAO, NOME_BOLSAO, AP_SSID, SUPABASE_URL,
 * SUPABASE_ANON_KEY e TOKEN_CENTRAL pelos valores do .env.local (NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY e TOKEN_BOLSAO_A, _C, _H). Se o arquivo da placa já existe
 * e tem WIFI_SSID, WIFI_SENHA, WIFI_USUARIO ou PINO_VAGA diferentes do exemplo, essas
 * linhas são levadas para o arquivo novo. O resultado vai para
 * firmware/bolsao/placas/bolsao_X/bolsao_X.ino, pasta ignorada pelo git.
 *
 * O script nunca imprime token, chave nem senha.
 */
import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PLACAS = ["A", "C", "H"] as const;
export type IdPlaca = (typeof PLACAS)[number];

/** Linhas que o João edita na placa e que não podem se perder numa versão nova. */
export const CAMPOS_DA_PLACA = ["WIFI_SSID", "WIFI_SENHA", "WIFI_USUARIO", "PINO_VAGA"] as const;

export interface EnvPlacas {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  TOKEN_BOLSAO_A?: string;
  TOKEN_BOLSAO_C?: string;
  TOKEN_BOLSAO_H?: string;
  [chave: string]: string | undefined;
}

function regexCampo(nome: string): RegExp {
  // `const char* NOME = "...";` ou `const int NOME[] = {...};`, com ou sem comentário no fim.
  return new RegExp(`^[ \\t]*const[ \\t]+(?:char\\*|int)[ \\t]+${nome}(?:\\[[^\\]]*\\])?[ \\t]*=.*$`, "m");
}

/** Devolve a linha inteira de um campo, ou null se ela não existe. */
export function linhaDoCampo(texto: string, nome: string): string | null {
  const m = texto.match(regexCampo(nome));
  return m ? m[0] : null;
}

function trocarTexto(texto: string, nome: string, valor: string, origem: string): string {
  const re = regexCampo(nome);
  if (!re.test(texto)) throw new Error(`Não achei ${nome} no ${origem}`);
  return texto.replace(re, `const char* ${nome} = "${valor}";`);
}

function trocarLinha(texto: string, nome: string, linha: string, origem: string): string {
  const re = regexCampo(nome);
  if (!re.test(texto)) throw new Error(`Não achei ${nome} no ${origem}`);
  return texto.replace(re, () => linha);
}

export function cabecalho(id: IdPlaca, data: string): string {
  return [
    `// Arquivo da placa do Bloco ${id}, gerado por \`npm run firmware:placas\` em ${data}. Ele tem o token: não faça commit.`,
    `// Falta conferir PINO_VAGA (um pino por vaga) e preencher o Wi-Fi do campus.`,
    `// Ao receber uma versão nova, copie do arquivo antigo para o novo as linhas de WIFI_SSID, WIFI_SENHA, WIFI_USUARIO e PINO_VAGA.`,
  ].join("\n");
}

/**
 * Monta o arquivo da placa `id`. `antigo` é o conteúdo do arquivo que já estava na pasta
 * da placa, ou null. Lança erro com o nome do campo que falta, sem valor nenhum.
 */
export function gerarPlaca(ino: string, id: IdPlaca, env: EnvPlacas, antigo: string | null, data = hoje()): string {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = env[`TOKEN_BOLSAO_${id}`];
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL no .env.local");
  if (!chave) throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local");
  if (!token) throw new Error(`Falta TOKEN_BOLSAO_${id} no .env.local`);

  let saida = ino;
  saida = trocarTexto(saida, "ID_BOLSAO", id, "bolsao.ino");
  saida = trocarTexto(saida, "NOME_BOLSAO", `Bloco ${id}`, "bolsao.ino");
  saida = trocarTexto(saida, "AP_SSID", `Estacionamento-${id}`, "bolsao.ino");
  saida = trocarTexto(saida, "SUPABASE_URL", url, "bolsao.ino");
  saida = trocarTexto(saida, "SUPABASE_ANON_KEY", chave, "bolsao.ino");
  saida = trocarTexto(saida, "TOKEN_CENTRAL", token, "bolsao.ino");

  if (antigo) {
    for (const campo of CAMPOS_DA_PLACA) {
      const linhaAntiga = linhaDoCampo(antigo, campo);
      const linhaExemplo = linhaDoCampo(ino, campo);
      if (linhaAntiga && linhaExemplo && linhaAntiga.trim() !== linhaExemplo.trim()) {
        saida = trocarLinha(saida, campo, linhaAntiga, "bolsao.ino");
      }
    }
  }

  return `${cabecalho(id, data)}\n${saida}`;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Caminho do arquivo de uma placa dentro da pasta ignorada pelo git. */
export function caminhoDaPlaca(raiz: string, id: IdPlaca): string {
  return join(raiz, "firmware", "bolsao", "placas", `bolsao_${id}`, `bolsao_${id}.ino`);
}

/**
 * Gera as três placas e devolve as mensagens para o terminal.
 * As mensagens só têm nomes de campos e caminhos: nunca o valor de um segredo.
 */
export function gerarTodas(raiz: string, env: EnvPlacas): string[] {
  const origem = join(raiz, "firmware", "bolsao", "bolsao.ino");
  const ino = readFileSync(origem, "utf8");
  const mensagens: string[] = [];
  for (const id of PLACAS) {
    const destino = caminhoDaPlaca(raiz, id);
    const antigo = existsSync(destino) ? readFileSync(destino, "utf8") : null;
    const texto = gerarPlaca(ino, id, env, antigo);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, texto, "utf8");
    const levadas = antigo ? CAMPOS_DA_PLACA.filter((c) => texto.includes(linhaDoCampo(antigo, c) ?? "\u0000") && linhaDoCampo(antigo, c) !== linhaDoCampo(ino, c)) : [];
    const nota = levadas.length ? ` (manteve ${levadas.join(", ")} do arquivo anterior)` : "";
    mensagens.push(`gerado ${destino}${nota}`);
  }
  return mensagens;
}

const executadoDireto = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (executadoDireto) {
  config({ quiet: true });
  config({ path: ".env.local", override: false, quiet: true });
  try {
    for (const m of gerarTodas(process.cwd(), process.env as EnvPlacas)) console.log(m);
    console.log("Pronto. Confira PINO_VAGA e preencha o Wi-Fi do campus em cada arquivo antes de gravar.");
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
