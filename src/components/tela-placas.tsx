"use client";

import { useEffect, useState } from "react";
import type { ConfiguracaoSupabase } from "@/lib/vagas/configuracao";
import { quando } from "@/lib/vagas/regras";
import { Icone } from "./icones";

interface Placa {
  id: string;
  nome: string | null;
  ultimo_envio: string | null;
  diag: { rssi?: number; uptime_s?: number; reinicio?: string; versao?: string; sem_mudar_h?: number[] } | null;
  diag_em: string | null;
  bolsoes: string[] | null;
}

type Estado = { tipo: "mandando" | "atrasada" | "parada" | "nunca"; texto: string };

export function estadoDaPlaca(p: Placa, agoraMs: number): Estado {
  if (!p.ultimo_envio) return { tipo: "nunca", texto: "Nunca mandou dado" };
  const t = Date.parse(p.ultimo_envio);
  const idade = agoraMs - t;
  if (idade <= 30_000) return { tipo: "mandando", texto: "Mandando" };
  if (idade <= 5 * 60_000) return { tipo: "atrasada", texto: "Atrasada" };
  return { tipo: "parada", texto: `Parada desde ${quando(t, agoraMs)}` };
}

export function qualidadeDoSinal(rssi: number): string {
  if (rssi >= -67) return "bom";
  if (rssi >= -75) return "fraco";
  return "ruim";
}

export function textoLigada(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

/** Sensores que não mudam há 24 h enquanto pelo menos metade dos outros mudou (UX-58). */
export function sensoresSuspeitos(semMudarH: number[] | undefined): number[] {
  if (!semMudarH || semMudarH.length < 2) return [];
  const suspeitos: number[] = [];
  semMudarH.forEach((h, i) => {
    if (h < 24) return;
    const outros = semMudarH.filter((_, j) => j !== i);
    const mudaram = outros.filter((o) => o < 24).length;
    if (mudaram * 2 >= outros.length) suspeitos.push(i);
  });
  return suspeitos;
}

async function rpc<T>(config: ConfiguracaoSupabase, nome: string): Promise<T> {
  const r = await fetch(`${config.url}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: { apikey: config.chaveAnon, Authorization: `Bearer ${config.chaveAnon}`, "Content-Profile": "vagas", "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Saúde de cada placa, para o João ver do celular sem ir ao estacionamento. */
export function TelaPlacas({ configuracao }: { configuracao: ConfiguracaoSupabase | null }) {
  const [placas, setPlacas] = useState<Placa[] | null>(null);
  const [erro, setErro] = useState(false);
  const [deslocamento, setDeslocamento] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!configuracao) return;
    let ativo = true;
    const ler = async () => {
      try {
        const t0 = Date.now();
        const [lista, hora] = await Promise.all([rpc<Placa[]>(configuracao, "placas"), rpc<string>(configuracao, "agora")]);
        const t1 = Date.now();
        if (!ativo) return;
        const servidor = Date.parse(hora);
        if (!Number.isNaN(servidor)) setDeslocamento(servidor - (t0 + t1) / 2);
        setPlacas(lista);
        setErro(false);
      } catch {
        if (ativo) setErro(true);
      }
    };
    void ler();
    const t = setInterval(() => void ler(), 10_000);
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => {
      ativo = false;
      clearInterval(t);
      clearInterval(relogio);
    };
  }, [configuracao]);

  const agoraServidor = agora + deslocamento;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-black">Placas</h1>
        <p className="text-sm text-texto-secundario">Último envio e diagnóstico de cada placa. A página lê o banco a cada 10 s.</p>
      </header>
      {!configuracao && <p className="rounded-lg border border-sem-dados px-3 py-2 text-sem-dados">A página está com erro de configuração.</p>}
      {erro && (
        <p role="alert" className="rounded-lg border border-sem-dados bg-[var(--sem-dados-fundo)] px-3 py-2 text-sm text-sem-dados">
          A página não conseguiu ler o banco. Ela tenta de novo a cada 10 s.
        </p>
      )}
      {placas && placas.length === 0 && <p className="text-sm text-texto-secundario">Nenhuma placa cadastrada.</p>}
      <ul className="flex flex-col gap-3">
        {placas?.map((p) => {
          const estado = estadoDaPlaca(p, agoraServidor);
          const d = p.diag;
          const diagVelho = p.diag_em ? agoraServidor - Date.parse(p.diag_em) > 5 * 60_000 : false;
          const suspeitos = sensoresSuspeitos(d?.sem_mudar_h);
          const alerta = estado.tipo !== "mandando";
          return (
            <li key={p.id} data-testid={`placa-${p.id}`} data-estado={estado.tipo} className={`rounded-2xl border p-4 ${alerta ? "border-sem-dados bg-[var(--sem-dados-fundo)]" : "border-livre bg-[var(--livre-fundo)]"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-lg font-bold">
                  {p.nome ?? p.id} <span className="text-sm font-normal text-texto-secundario">({p.id})</span>
                </h2>
                <p className={`flex items-center gap-1 text-sm font-semibold ${alerta ? "text-sem-dados" : "text-livre"}`}>
                  {alerta ? <Icone nome="alerta" className="h-4 w-4" /> : <Icone nome="ok" className="h-4 w-4" />}
                  {estado.texto}
                </p>
              </div>
              {d && (
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {typeof d.rssi === "number" && (
                    <li>
                      Sinal do Wi-Fi: {d.rssi} dBm ({qualidadeDoSinal(d.rssi)})
                    </li>
                  )}
                  {typeof d.uptime_s === "number" && <li>Ligada há {textoLigada(d.uptime_s)}</li>}
                  {d.reinicio && <li>Último reinício: {d.reinicio}</li>}
                  {d.versao && <li>Versão: {d.versao}</li>}
                  {suspeitos.map((i) => (
                    <li key={i} className="font-semibold text-sem-dados">
                      Vaga {i + 1} não muda há {d.sem_mudar_h![i]} h. Confira se o sensor está sujo ou tapado.
                    </li>
                  ))}
                  {diagVelho && p.diag_em && <li className="text-texto-secundario">Diagnóstico de {quando(Date.parse(p.diag_em), agoraServidor)}</li>}
                </ul>
              )}
              {p.bolsoes && <p className="mt-2 text-xs text-texto-secundario">Publica em: {p.bolsoes.join(", ")}</p>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
