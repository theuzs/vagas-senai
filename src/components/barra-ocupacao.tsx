/**
 * Barra de ocupação da guarita (decisão D1): legível a 3 m, no lugar da grade.
 * Em SEM DADOS fica inteira listrada, sem parte livre nem ocupada.
 */
export function BarraOcupacao({ id, nome, livres, total }: { id: string; nome: string; livres: number | null; total: number | null }) {
  const semDados = livres === null || total === null || total === 0;
  return (
    <div
      data-testid={`barra-${id}`}
      data-sem-dados={semDados ? "sim" : "nao"}
      role="img"
      aria-label={semDados ? `${nome}: sem dados` : `${nome}: ${livres} de ${total} livres`}
      className={`flex h-[clamp(14px,3.2vh,40px)] overflow-hidden rounded-full ${semDados ? "listrado-forte bg-[var(--vaga-neutra)]" : "bg-[var(--vaga-ocupada)]"}`}
    >
      {!semDados && (
        <>
          <span data-parte="livre" className="bg-[var(--vaga-livre)] transition-[width] duration-300" style={{ width: `${(livres / total) * 100}%` }} />
          <span data-parte="ocupada" className="flex-1 bg-[var(--vaga-ocupada)]" />
        </>
      )}
    </div>
  );
}
