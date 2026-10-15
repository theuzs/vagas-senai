/**
 * Filtro dos acessos contados (UX-60): a guarita, a demonstração e a maquete ficam
 * de fora, para o número refletir só motoristas.
 */
export function filtrarEvento<T extends { url: string }>(evento: T): T | null {
  let u: URL;
  try {
    u = new URL(evento.url, "https://vagas.rubysistemas.com.br");
  } catch {
    return evento;
  }
  if (u.pathname.startsWith("/guarita")) return null;
  if (u.searchParams.get("demo") === "1" || u.searchParams.get("maquete") === "1") return null;
  return evento;
}
