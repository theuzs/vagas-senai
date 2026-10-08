import type { Modo } from "@/lib/vagas/use-vagas";
import type { StatusConexao } from "@/lib/vagas/tipos";

/** Faixa de demonstração, aviso de configuração e aviso de erro de leitura. */
export function Avisos({ modo, erroCarga, className = "text-sm" }: { modo: Modo; erroCarga: boolean; className?: string }) {
  return (
    <>
      {modo === "demo" && (
        <p data-testid="faixa-demo" className={`rounded-lg border border-poucas bg-[var(--poucas-fundo)] px-3 py-2 font-semibold text-poucas ${className}`}>
          Demonstração: dados simulados. Os números não são do estacionamento.
        </p>
      )}
      {modo === "sem-configuracao" && (
        <p data-testid="aviso-configuracao" className={`rounded-lg border border-sem-dados bg-[var(--sem-dados-fundo)] px-3 py-2 text-sem-dados ${className}`}>
          Configuração incompleta: faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. A página não consegue ler as vagas.
        </p>
      )}
      {erroCarga && modo === "supabase" && (
        <p data-testid="aviso-erro" className={`rounded-lg border border-sem-dados bg-[var(--sem-dados-fundo)] px-3 py-2 text-sem-dados ${className}`}>
          A página não conseguiu ler os dados. Ela tenta de novo sozinha.
        </p>
      )}
    </>
  );
}

export function Conexao({ status, modo, className = "text-xs" }: { status: StatusConexao; modo: Modo; className?: string }) {
  const info: Record<StatusConexao, { texto: string; cor: string }> = {
    conectando: { texto: "Conectando", cor: "bg-texto-secundario" },
    "ao-vivo": { texto: modo === "demo" ? "Simulação ao vivo" : "Ao vivo", cor: "bg-livre" },
    reconectando: { texto: "Reconectando", cor: "bg-poucas" },
    "sem-configuracao": { texto: "Sem conexão", cor: "bg-lotado" },
  };
  const i = info[status];
  return (
    <p data-testid="status-conexao" data-status={status} className={`flex items-center gap-2 font-semibold uppercase tracking-wide text-texto-secundario ${className}`}>
      <span aria-hidden="true" className={`inline-block h-[0.8em] w-[0.8em] rounded-full ${i.cor}`} />
      {i.texto}
    </p>
  );
}
