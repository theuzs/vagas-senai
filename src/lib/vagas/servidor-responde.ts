/** Confere se o servidor responde antes de recarregar a página (UX-15, UX-46). */
export async function servidorResponde(): Promise<boolean> {
  try {
    const r = await fetch(location.pathname, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}
