import { tipoDaVaga } from "@/lib/vagas/regras";
import type { Bolsao } from "@/lib/vagas/tipos";

/**
 * Uma célula por vaga, na ordem dos sensores. Funciona de 1 a 500 vagas.
 * Livre e ocupada se distinguem por cor e por forma (ocupada leva um ×);
 * especial leva borda azul. Sem dados, tudo fica neutro e listrado.
 */
export function GradeVagas({ bolsao, semDados }: { bolsao: Bolsao; semDados: boolean }) {
  const total = semDados ? (bolsao.total_vagas ?? 12) : (bolsao.vagas?.length ?? 0);
  const vagas = semDados ? null : bolsao.vagas;

  return (
    <div
      data-testid={`grade-${bolsao.id}`}
      data-sem-dados={semDados ? "sim" : "nao"}
      className={`grid gap-1 rounded-xl p-2 ${semDados ? "listrado bg-[var(--sem-dados-fundo)]" : "bg-superficie-2"}`}
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(16px, 1fr))" }}
      role="img"
      aria-label={semDados ? `Grade do ${bolsao.nome} sem dados` : `Grade do ${bolsao.nome}: ${bolsao.vagas_livres} de ${total} livres`}
    >
      {Array.from({ length: total }, (_, i) => {
        const tipo = tipoDaVaga(bolsao.especiais, i);
        if (!vagas) {
          return <span key={i} data-vaga="neutra" className="aspect-square rounded-[3px] bg-[var(--vaga-neutra)]" />;
        }
        const ocupada = vagas[i];
        return (
          <span
            key={i}
            data-vaga={ocupada ? "ocupada" : "livre"}
            data-tipo={tipo ?? undefined}
            title={`Vaga ${i + 1}${tipo ? ` (${tipo.toUpperCase()})` : ""}: ${ocupada ? "ocupada" : "livre"}`}
            className={`relative aspect-square rounded-[3px] ${ocupada ? "bg-[var(--vaga-ocupada)]" : "bg-[var(--vaga-livre)]"} ${tipo ? "ring-2 ring-inset ring-[var(--vaga-especial)]" : ""}`}
          >
            {ocupada && (
              <svg viewBox="0 0 10 10" aria-hidden="true" className="absolute inset-0 h-full w-full p-[3px] text-black/60" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                <path d="M2 2l6 6M8 2l-6 6" />
              </svg>
            )}
          </span>
        );
      })}
    </div>
  );
}
