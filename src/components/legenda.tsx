import type { Bolsao } from "@/lib/vagas/tipos";
import { Icone, ICONE_DO_TIPO } from "./icones";

/** Legenda da grade do celular (UX-11). Só aparece quando algum bloco tem dado. */
export function Legenda({ bolsoes }: { bolsoes: Bolsao[] }) {
  const tipos = new Set<string>();
  for (const b of bolsoes) for (const t of Object.keys(b.especiais ?? {})) tipos.add(t);
  return (
    <ul data-testid="legenda" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-texto-secundario" aria-label="Legenda da grade">
      <li className="flex items-center gap-1">
        <span aria-hidden="true" className="inline-block h-3 w-3 rounded-[3px] bg-[var(--vaga-livre)]" />
        Livre
      </li>
      <li className="flex items-center gap-1">
        <span aria-hidden="true" className="relative inline-block h-3 w-3 rounded-[3px] bg-[var(--vaga-ocupada)] text-fundo">
          <Icone nome="x" className="absolute inset-0 h-full w-full p-[1px]" />
        </span>
        Ocupada
      </li>
      {tipos.has("pcd") && (
        <li className="flex items-center gap-1">
          <span aria-hidden="true" className="inline-flex h-3 w-3 items-center justify-center rounded-[3px] bg-[var(--vaga-livre)] text-[#0f1419] outline-2 outline-solid outline-[var(--vaga-especial)]">
            <Icone nome={ICONE_DO_TIPO.pcd} className="h-2.5 w-2.5" />
          </span>
          P: PCD
        </li>
      )}
      {tipos.has("idoso") && (
        <li className="flex items-center gap-1">
          <span aria-hidden="true" className="inline-flex h-3 w-3 items-center justify-center rounded-[3px] bg-[var(--vaga-livre)] text-[#0f1419] outline-2 outline-solid outline-[var(--vaga-especial)]">
            <Icone nome={ICONE_DO_TIPO.idoso} className="h-2.5 w-2.5" />
          </span>
          I: Idoso
        </li>
      )}
    </ul>
  );
}
