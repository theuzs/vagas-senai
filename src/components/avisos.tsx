"use client";

import { horaCurta, indicadorConexao } from "@/lib/vagas/regras";
import type { CausaSemDados, Situacao } from "@/lib/vagas/tipos";
import type { Modo } from "@/lib/vagas/use-vagas";
import { Icone } from "./icones";

export interface PropsAvisos {
  modo: Modo;
  causa: CausaSemDados;
  online: boolean;
  leituraOkEm: number | null;
  tentarAgora: () => void;
  className?: string;
  /** A guarita mostra a demonstração no título e a falha na faixa de baixo (D10). */
  semFaixaDemo?: boolean;
  semAvisoErro?: boolean;
}

/** Faixa de demonstração, aviso de configuração e aviso de falha de leitura (UX-06, UX-34). */
export function Avisos({ modo, causa, online, leituraOkEm, tentarAgora, className = "text-sm", semFaixaDemo = false, semAvisoErro = false }: PropsAvisos) {
  const erro = (modo === "supabase" || modo === "maquete") && causa === "sem-conexao" && !semAvisoErro;
  const textoErro = !online
    ? "O celular está sem internet. A página lê as vagas de novo quando a conexão voltar."
    : leituraOkEm !== null
      ? `Este aparelho está sem conexão com o servidor desde ${horaCurta(leituraOkEm)}. A página tenta de novo a cada 10 s.`
      : "A página não conseguiu ler as vagas. Ela tenta de novo a cada 10 s.";
  return (
    <>
      {modo === "demo" && !semFaixaDemo && (
        <div data-testid="faixa-demo" className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-demo bg-[var(--demo-fundo)] px-3 py-2 font-semibold text-demo ${className}`}>
          <span className="flex items-center gap-2">
            <Icone nome="alerta" className="h-[1.2em] w-[1.2em] shrink-0" />
            Demonstração: os números desta página são simulados e não vêm do estacionamento.
          </span>
          {/* Um <a> comum: a página precisa recarregar para sair do modo demo. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="inline-flex min-h-11 items-center underline">
            Ver as vagas reais
          </a>
        </div>
      )}
      {modo === "maquete" && !semFaixaDemo && (
        <p data-testid="faixa-maquete" className={`flex items-center gap-2 rounded-lg border border-demo bg-[var(--demo-fundo)] px-3 py-2 font-semibold text-demo ${className}`}>
          <Icone nome="alerta" className="h-[1.2em] w-[1.2em] shrink-0" />
          Maquete: sensores reais de uma maquete, fora do estacionamento.
        </p>
      )}
      {modo === "sem-configuracao" && (
        <div role="alert" data-testid="aviso-configuracao" className={`rounded-lg border border-sem-dados bg-[var(--sem-dados-fundo)] px-3 py-2 text-sem-dados ${className}`}>
          <p>A página está fora do ar por um erro de configuração. Confira as vagas no local.</p>
          <details className="mt-1">
            <summary className="inline-flex min-h-11 cursor-pointer items-center">Ver detalhes técnicos</summary>
            Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no build da Vercel.
          </details>
        </div>
      )}
      {erro && (
        <div role="alert" data-testid="aviso-erro" className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-sem-dados bg-[var(--sem-dados-fundo)] px-3 py-2 text-sem-dados ${className}`}>
          <span>{textoErro}</span>
          <button type="button" onClick={tentarAgora} className="min-h-11 rounded-lg border border-sem-dados px-3 font-semibold">
            Tentar agora
          </button>
        </div>
      )}
    </>
  );
}

const TOM: Record<string, string> = {
  verde: "bg-livre",
  alerta: "bg-sem-dados",
  cinza: "bg-texto-secundario",
  vermelho: "bg-lotado",
};

/** Indicador do cabeçalho: diz "Ao vivo" só com algum bloco mostrando número (UX-06). */
export function Conexao({
  modo,
  causa,
  situacoes,
  status,
  className = "text-xs",
  ultimoDadoMs = null,
}: {
  modo: Modo;
  causa: CausaSemDados;
  situacoes: Map<string, Situacao>;
  status: string;
  className?: string;
  ultimoDadoMs?: number | null;
}) {
  const i = indicadorConexao(modo === "maquete" ? "supabase" : modo, causa, situacoes);
  const alerta = i.tom === "alerta";
  return (
    <p
      data-testid="status-conexao"
      data-status={status}
      data-indicador={i.chave}
      className={`flex items-center gap-2 font-semibold uppercase tracking-wide ${alerta ? "rounded-lg border border-sem-dados bg-[var(--sem-dados-fundo)] px-2 text-sem-dados" : i.chave === "demo" ? "text-demo" : "text-texto-secundario"} ${className}`}
    >
      <span className="relative inline-flex h-[0.8em] w-[0.8em]">
        <span aria-hidden="true" className={`inline-block h-full w-full rounded-full ${i.chave === "demo" ? "bg-demo" : TOM[i.tom]}`} />
        {ultimoDadoMs !== null && (
          <span key={ultimoDadoMs} data-testid="pulso-dado" data-ultimo={ultimoDadoMs} aria-hidden="true" className={`ping-unico absolute inset-0 rounded-full ${i.chave === "demo" ? "bg-demo" : TOM[i.tom]}`} />
        )}
      </span>
      {alerta && <Icone nome="alerta" className="h-[1.2em] w-[1.2em]" />}
      {i.texto}
    </p>
  );
}
