/**
 * Gera o token de uma central e o SQL com o hash.
 *
 *   npm run token:gerar -- central-1 "Central da guarita"
 *
 * Cole o SQL no SQL Editor do Supabase e o token no config.h da ponte.
 * O token aparece uma vez só: ele não fica guardado em lugar nenhum.
 */
import { gerarToken } from "./token";

const [id = "central-1", nome = "Central"] = process.argv.slice(2);

const g = gerarToken(id, nome);

console.log("Token da central (cole em firmware/ponte/config.h, em TOKEN_CENTRAL):\n");
console.log(`  ${g.token}\n`);
console.log("SQL para rodar no Supabase (SQL Editor), que guarda só o hash:\n");
console.log(g.sql);
console.log("\nPara testar sem o hardware: TOKEN_CENTRAL=<token> npm run simular:ponte");
