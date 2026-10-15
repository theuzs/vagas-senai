import type { Metadata } from "next";
import { IconeAlerta } from "@/components/cartao-bolsao";
import { Folha } from "@/components/folha";

export const metadata: Metadata = {
  title: "Guia da tela da guarita",
  robots: { index: false },
};

/** Os quatro estados da tela, com o retângulo na cor e no padrão que o vigia vê no monitor. */
const ESTADOS = [
  {
    id: "livre",
    nome: "Tem vaga",
    texto: "mande o motorista para o bloco que a faixa de baixo indica.",
    caixa: "border-[var(--livre)] bg-[var(--livre-fundo)] text-[var(--livre)]",
    amostra: "12",
  },
  {
    id: "poucas",
    nome: "Poucas vagas",
    texto: "o bloco tem poucas vagas livres. Avise que ele pode lotar antes de o motorista chegar.",
    caixa: "border-[var(--poucas)] bg-[var(--poucas-fundo)] text-[var(--poucas)]",
    amostra: "2",
  },
  {
    id: "lotado",
    nome: "Lotado",
    texto: "os sensores mandaram dado agora e o bloco não tem vaga.",
    caixa: "border-[var(--lotado)] bg-[var(--lotado-fundo)] text-[var(--lotado)]",
    amostra: "0",
  },
  {
    id: "sem-dados",
    nome: "Sem dados",
    texto: "a tela não sabe quantas vagas o bloco tem. Não diga que está lotado.",
    caixa: "listrado border-dashed border-[var(--sem-dados)] bg-[var(--sem-dados-fundo)] text-[var(--sem-dados)]",
    amostra: null,
  },
] as const;

/** Folha A4 para colar ao lado do monitor da guarita. */
export default function PaginaGuia() {
  return (
    <Folha testId="folha-guia">
      <h1 className="text-[30px] font-black leading-tight sm:text-[40px] print:text-[40px]">Como usar a tela de vagas</h1>

      <ol className="flex w-full flex-col gap-5 text-left">
        {ESTADOS.map((e) => (
          <li key={e.id} data-testid={`estado-${e.id}`} className="flex items-center gap-6">
            <span
              aria-hidden="true"
              className={`flex h-[24mm] w-[24mm] shrink-0 items-center justify-center rounded-2xl border-[3px] text-[34px] font-black leading-none ${e.caixa}`}
            >
              {e.amostra ?? <IconeAlerta className="h-12 w-12" />}
            </span>
            <p className="text-[20px] leading-snug">
              <strong className="font-black">{e.nome}:</strong> {e.texto}
            </p>
          </li>
        ))}
      </ol>

      <div className="w-full text-left text-[20px] leading-relaxed">
        <p className="font-semibold">Se um bloco ficar sem dados por mais de 10 minutos, avise o responsável:</p>
        <p className="mt-3">Nome: ________________________________</p>
        <p className="mt-2">Telefone ou ramal: ____________________</p>
      </div>
    </Folha>
  );
}
