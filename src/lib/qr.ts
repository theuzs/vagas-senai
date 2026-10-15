import QRCode from "qrcode";

/**
 * Nível H de correção e margem de 4 módulos: o QR é lido de dentro do carro, à noite,
 * com a folha atrás de um vidro. A margem é a "zona de silêncio" que a câmera precisa.
 */
export const OPCOES_QR = { errorCorrectionLevel: "H", margin: 4 } as const;

/**
 * Texto que vai no QR. O endereço da raiz, sem busca nem âncora, vai em maiúsculas:
 * o QR usa o modo alfanumérico, fica menor (versão 3) e lê de mais longe. O navegador
 * aceita o esquema e o domínio em maiúsculas. Qualquer outro endereço vai como está,
 * porque caminho e parâmetros diferenciam maiúsculas.
 */
export function textoDoQr(endereco: string): string {
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return endereco;
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return endereco;
  return endereco.replace(/\/$/, "").toUpperCase();
}

/** SVG do QR em preto sobre branco, para as folhas impressas. Gerado no build. */
export function svgDoQr(endereco: string): Promise<string> {
  return QRCode.toString(textoDoQr(endereco), { type: "svg", ...OPCOES_QR, color: { dark: "#0f1419", light: "#ffffff" } });
}
