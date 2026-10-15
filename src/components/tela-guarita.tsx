"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { anunciosGuarita, avisoColunaSemDados, categoriaAnuncio, dadosVisiveis, especiaisLivres, horaCurta, orientacaoGuarita, textoEspecial, textoIdade, textoSemDados, type EstadoAnuncio } from "@/lib/vagas/regras";
import { servidorResponde } from "@/lib/vagas/servidor-responde";
import type { Bolsao, CausaSemDados, Situacao } from "@/lib/vagas/tipos";
import { useVagas, type OpcoesVagas } from "@/lib/vagas/use-vagas";
import { VISUAL } from "@/lib/vagas/visual";
import { Anunciador, useAnuncios } from "./anunciador";
import { Avisos, Conexao } from "./avisos";
import { BarraOcupacao } from "./barra-ocupacao";
import { useMudou, usePulso } from "./cartao-bolsao";
import { Icone } from "./icones";
import { Marca } from "./marca";

const semAssinatura = () => () => {};
const parametro = (nome: string) => () => new URLSearchParams(window.location.search).get(nome) === "1";
const falsoNoServidor = () => false;

/**
 * Tela do PC da guarita: paisagem, tela cheia, sem rolagem. Três colunas grandes e,
 * embaixo, o que o vigia diz ao motorista. Feita para ficar aberta a noite toda
 * em modo quiosque (chrome --kiosk .../guarita?quiosque=1).
 */
export function TelaGuarita(props: OpcoesVagas) {
  const { modo, bolsoes, situacoes, status, agoraServidorMs, causa, carregou, leituraOkEm, online, ultimoDadoMs, tentarAgora } = useVagas(props);
  // Memória do último bloco indicado, para a faixa não trocar enquanto o vigia fala (UX-33).
  // A memória é lida e gravada no render de propósito: o resultado deste render depende do anterior.
  const anterior = useRef<string | null>(null);
  // eslint-disable-next-line react-hooks/refs
  const orientacao = orientacaoGuarita(bolsoes, situacoes, causa, anterior.current);
  // eslint-disable-next-line react-hooks/refs
  anterior.current = orientacao.indicado?.id ?? null;
  const anuncio = useAnuncios(bolsoes, situacoes, causa, carregou);
  const som = useSyncExternalStore(semAssinatura, parametro("som"), falsoNoServidor);
  const cursorParado = useCursorParado(3000);
  const [somBloqueado, ligarSom] = useAvisosFalados(som, bolsoes, situacoes, causa, carregou);
  useTelaAcesa();
  useRecargaDiaria();

  const demo = modo === "demo";
  const faixaDeAlerta = orientacao.tipo === "sem-dados" || demo;
  const detalhe = demo ? "Não use estes números para orientar motoristas." : orientacao.detalhe;

  return (
    <main
      data-testid="tela-guarita"
      data-conexao={causa}
      className={`flex h-dvh flex-col gap-[1.6vh] overflow-hidden px-[2vw] py-[2vh] baixa:h-auto baixa:min-h-dvh baixa:overflow-visible ${cursorParado ? "cursor-none" : ""}`}
    >
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          {demo ? (
            <h1 data-testid="faixa-demo" className="flex items-center gap-2 break-words text-[clamp(1.2rem,2.6vw,3rem)] font-black text-demo">
              <Icone nome="alerta" className="h-[1em] w-[1em] shrink-0" />
              Demonstração: números simulados
            </h1>
          ) : (
            <h1 className="flex items-center gap-2 break-words text-[clamp(0.9rem,1.4vw,1.6rem)] font-semibold text-texto-secundario">
              <Marca className="h-[1em] w-[1em] shrink-0" />
              Vagas SENAI Blumenau
            </h1>
          )}
          <Conexao modo={modo} causa={causa} situacoes={situacoes} status={status} ultimoDadoMs={ultimoDadoMs} className="text-[clamp(1rem,1.6vw,1.6rem)] font-bold" />
        </div>
        <div className="flex items-center gap-[1.5vw]">
          {somBloqueado && (
            <button type="button" onClick={ligarSom} className="min-h-11 rounded-xl border border-borda bg-superficie px-4 text-[clamp(0.85rem,1.1vw,1.1rem)] font-semibold hover:bg-superficie-2">
              Ligar o som
            </button>
          )}
          <BotaoTelaCheia />
          <Relogio ms={agoraServidorMs} />
        </div>
      </header>

      <Anunciador texto={anuncio} />
      <Avisos modo={modo} causa={causa} online={online} leituraOkEm={leituraOkEm} tentarAgora={tentarAgora} className="text-[clamp(0.9rem,1.3vw,1.3rem)]" semFaixaDemo semAvisoErro />

      <section
        className="grid min-h-0 flex-1 gap-[1.5vw] pt-[1.2em] baixa:flex-none"
        style={{ gridTemplateColumns: `repeat(${Math.max(bolsoes.length, 1)}, minmax(0, 1fr))` }}
        aria-label="Estacionamentos"
      >
        {bolsoes.map((b) => (
          <ColunaBolsao
            key={b.id}
            bolsao={b}
            situacao={situacoes.get(b.id) ?? "sem-dados"}
            agoraServidorMs={agoraServidorMs}
            indicado={orientacao.indicado?.id === b.id}
            causa={causa}
            carregou={carregou}
            online={online}
          />
        ))}
      </section>

      <footer
        data-testid="orientacao"
        data-tipo={orientacao.tipo}
        className={`rounded-2xl border-2 px-[2vw] py-[1.4vh] baixa:sticky baixa:bottom-0 baixa:z-10 ${
          demo
            ? "border-demo bg-[var(--demo-fundo)]"
            : orientacao.tipo === "indicar"
              ? "border-livre bg-[var(--livre-fundo)]"
              : orientacao.tipo === "lotado"
                ? "border-lotado bg-[var(--lotado-fundo)]"
                : "listrado-forte border-sem-dados bg-[var(--sem-dados-fundo)]"
        }`}
      >
        <p className="text-balance text-[var(--text-g-faixa)] font-black leading-tight">{orientacao.texto}</p>
        {orientacao.especiais && <p className="text-[var(--text-g-detalhe)] font-bold text-[var(--vaga-especial)]">{orientacao.especiais}</p>}
        <p className={`mt-1 flex items-center gap-2 text-balance text-[var(--text-g-detalhe)] font-semibold ${faixaDeAlerta ? "text-sem-dados" : "text-texto"} ${detalhe ? "" : "invisible"}`}>
          {detalhe && faixaDeAlerta && <Icone nome="alerta" className="h-[1.2em] w-[1.2em] shrink-0" />}
          {detalhe ?? " "}
        </p>
      </footer>
    </main>
  );
}

function ColunaBolsao({
  bolsao,
  situacao,
  agoraServidorMs,
  indicado,
  causa,
  carregou,
  online,
}: {
  bolsao: Bolsao;
  situacao: Situacao;
  agoraServidorMs: number;
  indicado: boolean;
  causa: CausaSemDados;
  carregou: boolean;
  online: boolean;
}) {
  const v = VISUAL[situacao];
  const dados = dadosVisiveis(bolsao, situacao);
  const semDados = dados === null;
  const livres = dados ? dados.livresComuns : null;
  const direcao = usePulso(livres);
  const trocou = useMudou(situacao, carregou);
  const especiais = dados ? especiaisLivres(bolsao) : [];
  const curto = textoSemDados(bolsao, agoraServidorMs, { causa, online, aparelho: "guarita" }).curto;
  const rotulo = semDados ? `${bolsao.nome}: sem dados` : situacao === "lotado" ? `${bolsao.nome}: lotado` : `${bolsao.nome}: ${livres} ${livres === 1 ? "vaga livre" : "vagas livres"}`;

  return (
    <article
      data-testid={`guarita-${bolsao.id}`}
      data-situacao={situacao}
      data-indicado={indicado ? "sim" : "nao"}
      aria-label={rotulo}
      style={{ "--cor-estado": v.corCss } as React.CSSProperties}
      className={`relative flex min-h-0 min-w-0 flex-col rounded-3xl p-[1.4vw] transition-colors duration-300 ${v.fundo} ${v.borda} ${semDados ? "listrado-forte border-[6px]" : "border-[3px]"} ${trocou ? "troca-situacao" : ""}`}
    >
      {indicado && (
        <span
          data-testid="selo-indicado"
          className="absolute -top-[0.8em] left-1/2 flex -translate-x-1/2 items-center gap-[0.3em] whitespace-nowrap rounded-full bg-[var(--livre)] px-[0.8em] py-[0.2em] text-[clamp(0.9rem,1.7vw,2.2rem)] font-black uppercase text-fundo"
        >
          <Icone nome="seta" className="h-[1em] w-[1em]" />
          INDIQUE ESTE
        </span>
      )}
      <div className="flex flex-col items-start gap-[0.4vh]">
        <h2 aria-label={bolsao.nome} className="flex items-baseline gap-[0.3em] leading-none">
          <span className="text-[clamp(0.9rem,1.6vw,1.8rem)] font-bold uppercase text-texto-secundario">Bloco</span>
          <span data-testid={`letra-${bolsao.id}`} className="text-[var(--text-g-letra)] font-black">
            {bolsao.id}
          </span>
        </h2>
        <span className={`flex items-center gap-1 text-[var(--text-g-rotulo)] font-bold uppercase ${v.cor}`}>
          {v.icone && <Icone nome={v.icone} className="h-[1.2em] w-[1.2em]" />}
          {v.rotulo}
        </span>
      </div>

      <div data-testid={`meio-${bolsao.id}`} className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        {semDados ? (
          <div data-testid={`centro-${bolsao.id}`} className="flex flex-col items-center">
            <span className={`text-[clamp(2rem,5.5vw,6.5rem)] font-black leading-none ${v.cor}`}>SEM DADOS</span>
            <span className="mt-[1.5vh] max-w-[22ch] text-balance text-[var(--text-g-rotulo)] font-semibold leading-snug">{avisoColunaSemDados(bolsao, agoraServidorMs, causa, carregou)}</span>
            {bolsao.aviso && (
              <span data-testid={`aviso-manutencao-${bolsao.id}`} className="mt-[1vh] text-[var(--text-g-corpo)] font-semibold text-sem-dados">
                Aviso da manutenção: {bolsao.aviso}
              </span>
            )}
          </div>
        ) : (
          <div data-testid={`centro-${bolsao.id}`} className="flex flex-col items-center">
            <span key={livres} data-anim={direcao ?? undefined} className={`text-[var(--text-g-numero)] font-black leading-none tabular-nums ${v.cor} ${direcao ? "pulso" : ""}`}>
              {livres}
            </span>
            <span className={`text-[clamp(1.1rem,2.2vw,2.6rem)] font-bold leading-tight ${v.cor}`}>{situacao === "lotado" ? "LOTADO" : livres === 1 ? "vaga livre" : "vagas livres"}</span>
            {dados.especiaisLivres > 0 && (
              <span data-testid={`especiais-extra-${bolsao.id}`} className="text-[var(--text-g-corpo)] font-bold text-[var(--vaga-especial)]">
                +{dados.especiaisLivres} {dados.especiaisLivres === 1 ? "especial" : "especiais"}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex h-[12vh] flex-col justify-end gap-[0.8vh]">
        {semDados ? (
          <p className="text-[var(--text-g-corpo)] text-texto-secundario">{curto}</p>
        ) : (
          <>
            {especiais.length > 0 && (
              <p data-testid={`especiais-${bolsao.id}`} className="text-balance text-[var(--text-g-legenda)] font-bold text-[var(--vaga-especial)]">
                {especiais.map(textoEspecial).join(" · ")}
              </p>
            )}
            <p className="text-[var(--text-g-corpo)] text-texto-secundario">
              <span className="font-semibold text-texto">de {dados.total} vagas</span>
              {" · "}atualizado {textoIdade(bolsao, agoraServidorMs)}
            </p>
          </>
        )}
        <BarraOcupacao id={bolsao.id} nome={bolsao.nome} livres={dados ? dados.livres : null} total={dados ? dados.total : null} />
      </div>
    </article>
  );
}

const noNavegador = () => true;
const noServidor = () => false;

function Relogio({ ms }: { ms: number }) {
  // A página é gerada no build. Se a hora viesse do servidor, seria a do build, e o React
  // manteria esse texto depois da hidratação até o minuto (e a data até o dia) mudar.
  const noCliente = useSyncExternalStore(semAssinatura, noNavegador, noServidor);
  const texto = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(ms));
  const data = texto.charAt(0).toUpperCase() + texto.slice(1);
  return (
    <div className="text-right">
      <p data-testid="relogio" className="text-[var(--text-g-relogio)] font-black leading-none tabular-nums">
        {noCliente ? horaCurta(ms) : "--:--"}
      </p>
      <p data-testid="data-hoje" className="text-[clamp(0.9rem,1.5vw,1.8rem)] text-texto-secundario">
        {noCliente ? data : " "}
      </p>
      <p data-testid="versao" className="text-[clamp(0.6rem,0.8vw,0.8rem)] text-texto-secundario">
        Versão {process.env.NEXT_PUBLIC_VERSAO}
      </p>
    </div>
  );
}

const assinarTelaCheia = (aviso: () => void) => {
  document.addEventListener("fullscreenchange", aviso);
  window.addEventListener("resize", aviso);
  return () => {
    document.removeEventListener("fullscreenchange", aviso);
    window.removeEventListener("resize", aviso);
  };
};
const emTelaCheia = () =>
  new URLSearchParams(window.location.search).get("quiosque") === "1" ||
  document.fullscreenElement !== null ||
  (window.innerWidth >= screen.width - 1 && window.innerHeight >= screen.height - 1) ||
  window.matchMedia("(display-mode: fullscreen)").matches;
const telaCheiaNoServidor = () => true;

/** Some em tela cheia, no modo quiosque (?quiosque=1) e quando a janela já ocupa a tela inteira (UX-45). */
function BotaoTelaCheia() {
  const cheia = useSyncExternalStore(assinarTelaCheia, emTelaCheia, telaCheiaNoServidor);
  if (cheia) return null;
  return (
    <button
      type="button"
      onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
      className="min-h-11 rounded-xl border border-borda bg-superficie px-4 text-[clamp(0.85rem,1.1vw,1.1rem)] font-semibold hover:bg-superficie-2"
    >
      Abrir em tela cheia
    </button>
  );
}

/** Esconde o ponteiro depois de alguns segundos parado (UX-45). */
function useCursorParado(ms: number): boolean {
  const [parado, setParado] = useState(false);
  useEffect(() => {
    let t = setTimeout(() => setParado(true), ms);
    const mexeu = () => {
      setParado(false);
      clearTimeout(t);
      t = setTimeout(() => setParado(true), ms);
    };
    window.addEventListener("pointermove", mexeu);
    window.addEventListener("pointerdown", mexeu);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", mexeu);
      window.removeEventListener("pointerdown", mexeu);
    };
  }, [ms]);
  return parado;
}

/** Pede ao navegador para não apagar a tela (Wake Lock) e pede de novo se a trava soltar. */
function useTelaAcesa() {
  useEffect(() => {
    type Trava = { release: () => Promise<void>; addEventListener?: (t: "release", f: () => void) => void };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Trava> } };
    if (!nav.wakeLock) return;
    let trava: Trava | null = null;
    let ativo = true;
    const pedir = () => {
      if (document.visibilityState !== "visible") return;
      nav.wakeLock!
        .request("screen")
        .then((t) => {
          if (!ativo) {
            void t.release();
            return;
          }
          trava = t;
          t.addEventListener?.("release", () => {
            if (ativo) setTimeout(pedir, 5_000);
          });
        })
        .catch(() => {});
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", pedir);
      void trava?.release().catch(() => {});
    };
  }, []);
}

/** Uma vez por dia às 17:30, se a página está aberta há mais de 1 h e o servidor responde, recarrega (UX-46). */
function useRecargaDiaria() {
  useEffect(() => {
    const abertaEm = Date.now();
    let ultimoDia = "";
    let proximaTentativa = 0;
    const conferir = async () => {
      const agora = new Date();
      const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(agora);
      const pegar = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
      const dia = `${pegar("year")}-${pegar("month")}-${pegar("day")}`;
      const minutos = Number(pegar("hour")) * 60 + Number(pegar("minute"));
      if (minutos < 17 * 60 + 30 || dia === ultimoDia || Date.now() < proximaTentativa) return;
      if (Date.now() - abertaEm < 3_600_000) return;
      if (await servidorResponde()) {
        ultimoDia = dia;
        location.reload();
      } else {
        proximaTentativa = Date.now() + 5 * 60_000;
      }
    };
    const t = setInterval(() => void conferir(), 60_000);
    return () => clearInterval(t);
  }, []);
}

/** Avisos falados com ?som=1 (UX-63). Devolve se o som está bloqueado e a função para liberar. */
function useAvisosFalados(ligado: boolean, bolsoes: Bolsao[], situacoes: Map<string, Situacao>, causa: CausaSemDados, carregou: boolean): [boolean, () => void] {
  const [bloqueado, setBloqueado] = useState(false);
  const estado = useRef<{ atual: Map<string, EstadoAnuncio>; anunciado: Map<string, EstadoAnuncio>; semConexaoDesde: number | null; avisouConexao: boolean }>({
    atual: new Map(),
    anunciado: new Map(),
    semConexaoDesde: null,
    avisouConexao: false,
  });
  // O laço de 1 s lê sempre o estado mais recente sem reiniciar a cada render.
  const ultimo = useRef({ bolsoes, situacoes, causa, carregou });
  // eslint-disable-next-line react-hooks/refs
  ultimo.current = { bolsoes, situacoes, causa, carregou };

  const falar = (frase: string) => {
    if (typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(frase);
    u.lang = "pt-BR";
    u.onerror = (e) => {
      if (e.error === "not-allowed") setBloqueado(true);
    };
    speechSynthesis.speak(u);
  };

  useEffect(() => {
    if (!ligado) return;
    falar("Som ligado.");
    const t = setInterval(() => {
      const { bolsoes, situacoes, causa, carregou } = ultimo.current;
      if (!carregou) return;
      const agora = Date.now();
      const e = estado.current;
      const semConexao = causa === "sem-conexao";
      if (semConexao) {
        e.semConexaoDesde ??= agora;
        if (!e.avisouConexao && agora - e.semConexaoDesde >= 60_000) {
          e.avisouConexao = true;
          falar("A tela da guarita está sem conexão.");
        }
      } else {
        e.semConexaoDesde = null;
        e.avisouConexao = false;
      }
      const entrada = bolsoes.map((b) => ({ id: b.id, nome: b.nome, categoria: categoriaAnuncio(situacoes.get(b.id) ?? "sem-dados") }));
      const r = anunciosGuarita(entrada, e.anunciado, agora, semConexao, e.atual);
      e.anunciado = r.anunciado;
      e.atual = r.atual;
      for (const f of r.frases) falar(f);
    }, 1000);
    return () => clearInterval(t);
  }, [ligado]);

  return [bloqueado, () => {
    setBloqueado(false);
    falar("Som ligado.");
  }];
}
