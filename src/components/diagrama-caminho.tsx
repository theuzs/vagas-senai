/** O caminho do dado, do sensor até a tela. Só texto e caixas: lê em qualquer largura. */
const PASSOS = [
  { titulo: "Sensor em cada vaga", detalhe: "diz se a vaga está livre ou ocupada" },
  { titulo: "Placa ESP32 do estacionamento", detalhe: "lê os sensores a cada 10 segundos" },
  { titulo: "Wi-Fi do campus", detalhe: "leva o estado das vagas para a internet" },
  { titulo: "Banco de dados", detalhe: "guarda o estado atual e a hora do último envio" },
  { titulo: "Esta página e a tela da guarita", detalhe: "mostram o número ou SEM DADOS" },
];

export function DiagramaCaminho() {
  return (
    <ol data-testid="diagrama-caminho" aria-label="Caminho do dado, do sensor até a tela" className="flex flex-col gap-1 md:flex-row md:items-stretch">
      {PASSOS.map((p, i) => (
        <li key={p.titulo} className="flex flex-col md:flex-1 md:flex-row md:items-center">
          <div className="flex-1 rounded-xl border border-borda bg-superficie px-3 py-2">
            <p className="font-bold leading-tight">{p.titulo}</p>
            <p className="text-sm text-texto-secundario">{p.detalhe}</p>
          </div>
          {i < PASSOS.length - 1 && (
            <span aria-hidden="true" className="flex shrink-0 justify-center text-texto-secundario md:px-1">
              <svg viewBox="0 0 24 24" className="h-6 w-6 rotate-90 md:rotate-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
