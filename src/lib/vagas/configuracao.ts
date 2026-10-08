export interface ConfiguracaoSupabase {
  url: string;
  chaveAnon: string;
}

/**
 * Lê as variáveis públicas do Supabase. Sem elas a página mostra SEM DADOS em tudo
 * e um aviso; nunca cai em dados simulados por conta própria.
 * As variáveis precisam ser lidas por nome completo para o Next inserir no bundle.
 */
export function configuracaoSupabase(): ConfiguracaoSupabase | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const chaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!/^https:\/\/[^/\s]+$/.test(url) || chaveAnon.length < 10) return null;
  return { url, chaveAnon };
}
