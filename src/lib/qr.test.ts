import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { ENDERECO_PUBLICO } from "./endereco";
import { OPCOES_QR, svgDoQr, textoDoQr } from "./qr";

describe("textoDoQr", () => {
  it("põe o endereço da raiz em maiúsculas e sem a barra final", () => {
    expect(textoDoQr("https://vagas.rubysistemas.com.br")).toBe("HTTPS://VAGAS.RUBYSISTEMAS.COM.BR");
    expect(textoDoQr("https://vagas.rubysistemas.com.br/")).toBe("HTTPS://VAGAS.RUBYSISTEMAS.COM.BR");
  });

  it("não mexe em endereço com caminho, busca ou âncora", () => {
    expect(textoDoQr("https://x.com/?demo=1")).toBe("https://x.com/?demo=1");
    expect(textoDoQr("https://x.com/guarita")).toBe("https://x.com/guarita");
    expect(textoDoQr("https://x.com/#bloco-A")).toBe("https://x.com/#bloco-A");
    expect(textoDoQr("isso não é url")).toBe("isso não é url");
  });
});

describe("QR da folha", () => {
  it("é versão 3, alfanumérico e nível H", () => {
    const qr = QRCode.create(textoDoQr(ENDERECO_PUBLICO), OPCOES_QR);
    expect(qr.version).toBe(3);
    expect(qr.segments.map((s) => s.mode.id)).toEqual(["Alphanumeric"]);
    expect(qr.errorCorrectionLevel.bit).toBe(2);
  });

  it("o SVG tem 29 módulos mais 4 de margem de cada lado", async () => {
    const svg = await svgDoQr(ENDERECO_PUBLICO);
    expect(svg).toContain('viewBox="0 0 37 37"');
    expect(svg).toContain("#0f1419");
  });
});
