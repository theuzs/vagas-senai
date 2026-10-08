# Relatório da noite (07 para 08/10/2026)

## O que você precisa fazer de manhã

1. Ler as decisões 16 a 29 em `docs/DECISOES.md` e dizer se alguma não serve.
2. Criar o repositório `theuzs/vagas-senai` no GitHub (privado, vazio) e ligar:
   ```
   cd Documents\GitHub\vagas-senai
   git remote add origin https://github.com/theuzs/vagas-senai.git
   git push -u origin main
   ```
3. Seguir `docs/DEPLOY.md`: expor o schema `vagas` no Supabase, aplicar a migration, gerar o token, criar o projeto na Vercel com as duas variáveis, adicionar o domínio. Em meia hora dá para ver a página no ar.
4. Testar com `npm run simular:ponte` (passo 6 do deploy) e abrir no celular.
5. Mandar para o João: `firmware/central/LEIAME.md` e `firmware/ponte/`. Ele precisa do `.ino` da central para encaixar o trecho, e das respostas das perguntas em `docs/DECISOES.md`.

Para rodar aqui: `npm install --legacy-peer-deps` já foi feito; `npm run dev` e abra http://localhost:3000/?demo=1.

## O que ficou pronto

| Etapa | Estado | Prova |
|---|---|---|
| 1. Base do projeto | pronta | `npm run check` e `npm run build` passam |
| 2. Banco | pronta | `db/migracoes/0001_vagas.sql`; 21 testes de banco (RLS, token, payload, histórico, Realtime) |
| 3. Regras da página | pronta | `src/lib/vagas/regras.ts`; 13 testes unitários |
| 4. Página | pronta | 8 E2E com Supabase simulado (REST e WebSocket) + 3 testes de componente |
| 5. PWA | pronta | `manifest.webmanifest`, ícones 192/512/maskable, apple-icon; 1 E2E |
| 6. Firmware | pronto e compilado | `ponte.ino` compila no core 3.3.12 com LCD ligado e desligado; `saida_ponte.h` compila num sketch mínimo |
| 7. Scripts | prontos | `db:aplicar`, `token:gerar`, `simular:ponte`, `icones`; 5 testes de banco |
| 8. Documentação | pronta | `README.md`, `docs/DEPLOY.md`, `firmware/LEIAME.md`, `firmware/central/LEIAME.md` |
| 9. Extras | prontos | mapa esquemático, `/qr`, `?painel=1`; 3 E2E |

Capturas em `docs/telas/` (`pagina.png`, `painel.png`, `qr.png`).

### Saída dos comandos

```
npm run check
  lint: sem erros
  typecheck: sem erros
  vitest: Test Files 4 passed | Tests 37 passed (unit 13, ui 3, db 21)

npm run test:e2e
  12 passed, 3 skipped (capturas, só com CAPTURAS=1)

npm run build
  ○ /  ○ /qr  ○ /manifest.webmanifest  ○ /apple-icon.png  (tudo estático)

arduino-cli compile --fqbn esp32:esp32:esp32 firmware/ponte
  USAR_LCD 0: Sketch uses 1020888 bytes (77%); RAM 58192 bytes (17%)
  USAR_LCD 1: Sketch uses 1048128 bytes (79%); RAM 59608 bytes (18%)
```

O Vitest imprime "something prevents 3 Vite servers from exiting" no fim, mas termina com código 0. É um aviso conhecido do Vitest 5 com o projeto jsdom; não afeta o resultado.

## O que não ficou pronto ou precisa de você

- **Remoto no GitHub.** Não existia e eu não tinha como criar. Nove commits locais na `main`.
- **Nada foi testado contra o Supabase real** (de propósito, sem chave aqui). O caminho REST, a função `publicar` e o Realtime foram testados num Postgres embutido e com um Supabase simulado no navegador. O primeiro teste real é o passo 6 do `docs/DEPLOY.md`.
- **Trecho da central é genérico.** Sem o `.ino` real, o encaixe no callback do ESP-NOW está descrito com um pacote hipotético. Quando o João mandar o código, dá para deixar pronto para colar.
- **Firmware compilado, não gravado.** Sem placa aqui. A primeira gravação pode pegar algo de hardware (pinos ocupados, LCD em outro endereço I2C).
- **Wi-Fi do campus.** O firmware aceita senha simples e usuário+senha (PEAP). Se o campus usar página de login no navegador, a TI precisa liberar o MAC da ponte.

## Decisões tomadas durante a noite

Estão numeradas de 16 a 29 em `docs/DECISOES.md`. As que mais merecem um olhar:

- `npm install` precisa de `--legacy-peer-deps` (bug do npm 11.1 com o Vitest 5). Está no README.
- "Poucas vagas" vale até `max(3, 10 %)` do total; com bolsão de 3 vagas, 3 livres ainda é "poucas".
- O teste de "página sem variável de ambiente" é de componente, não E2E, porque as variáveis entram no build.
- O endereço do QR tem padrão `https://vagas.rubysistemas.com.br` e pode ser trocado por `NEXT_PUBLIC_ENDERECO_PUBLICO`.

## Ferramentas instaladas nesta máquina

- `arduino-cli` 1.5.2 em `%LOCALAPPDATA%\arduino-cli\` (não está no PATH; chame pelo caminho completo ou adicione).
- Core `esp32:esp32` 3.3.12 e biblioteca "LiquidCrystal I2C" em `%LOCALAPPDATA%\Arduino15\` (uns 9 GB; pode apagar se não for compilar firmware aqui).
- Chromium do Playwright (já existia para o WebSiteFoods).
