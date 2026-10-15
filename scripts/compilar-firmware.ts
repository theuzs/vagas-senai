/**
 * Compila o firmware com o arduino-cli: firmware/bolsao, firmware/maquete e cada placa
 * em firmware/bolsao/placas/. Procura o arduino-cli no PATH e em
 * %LOCALAPPDATA%\arduino-cli\arduino-cli.exe.
 *
 *   npm run firmware:compilar
 *
 * A saída mostra só o resumo de cada sketch (bytes e porcentagem da flash).
 * O script nunca imprime o conteúdo dos arquivos das placas.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FQBN = "esp32:esp32:esp32";

function acharArduinoCli(): string | null {
  const nome = process.platform === "win32" ? "arduino-cli.exe" : "arduino-cli";
  const sep = process.platform === "win32" ? ";" : ":";
  for (const pasta of (process.env.PATH ?? "").split(sep)) {
    if (pasta && existsSync(join(pasta, nome))) return join(pasta, nome);
  }
  const local = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "arduino-cli", "arduino-cli.exe") : null;
  if (local && existsSync(local)) return local;
  return null;
}

function sketches(raiz: string): string[] {
  const lista = [join(raiz, "firmware", "bolsao"), join(raiz, "firmware", "maquete")].filter((p) => existsSync(p));
  const placas = join(raiz, "firmware", "bolsao", "placas");
  if (existsSync(placas)) {
    for (const nome of readdirSync(placas, { withFileTypes: true })) {
      if (nome.isDirectory() && existsSync(join(placas, nome.name, `${nome.name}.ino`))) lista.push(join(placas, nome.name));
    }
  }
  return lista;
}

const cli = acharArduinoCli();
if (!cli) {
  console.error("Não achei o arduino-cli. Instale em https://arduino.github.io/arduino-cli/ ou copie para %LOCALAPPDATA%\\arduino-cli\\arduino-cli.exe.");
  process.exit(1);
}

let falhou = false;
for (const pasta of sketches(process.cwd())) {
  process.stdout.write(`${pasta} ... `);
  const r = spawnSync(cli, ["compile", "--fqbn", FQBN, pasta], { encoding: "utf8" });
  const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const resumo = saida.match(/Sketch uses .*\./)?.[0];
  if (r.status === 0) {
    console.log(resumo ?? "ok");
  } else {
    falhou = true;
    console.log("ERRO");
    console.log(saida.split("\n").filter((l) => /error|erro|#error/i.test(l)).slice(0, 20).join("\n"));
  }
}
process.exit(falhou ? 1 : 0);
