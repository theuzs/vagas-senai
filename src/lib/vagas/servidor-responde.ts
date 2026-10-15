/**
 * Confere se o servidor da página responde, antes de recarregar a tela por conta própria.
 * Um HEAD no próprio endereço evita que a guarita caia na página de erro do Chrome,
 * de onde ninguém sai sem teclado.
 */
export async function servidorResponde(): Promise<boolean> {
  try {
    const r = await fetch(location.pathname, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}
