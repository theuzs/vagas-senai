import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DiagramaCaminho } from "@/components/diagrama-caminho";

export const metadata: Metadata = {
  title: "Como funciona",
  description: "Como os sensores, as placas e o banco de dados levam o número de vagas livres até a página e a tela da guarita.",
};

/** Painel de navegação: uma entrada por tela do sistema. */
const TELAS = [
  { href: "/", titulo: "Página das vagas", texto: "Os três estacionamentos ao vivo, para o motorista." },
  { href: "/?demo=1", titulo: "Demonstração", texto: "A mesma página com dados simulados e uma faixa avisando." },
  { href: "/guarita", titulo: "Tela da guarita", texto: "Três colunas grandes e a orientação para o vigia." },
  { href: "/guarita?demo=1", titulo: "Guarita em demonstração", texto: "A tela da guarita com dados simulados." },
  { href: "/guarita/guia", titulo: "Guia do vigia", texto: "Folha para imprimir e colar ao lado do monitor." },
  { href: "/qr", titulo: "Folha do QR code", texto: "Folha A4 para a guarita e as entradas dos estacionamentos." },
  { href: "/qr/sala", titulo: "QR para salas", texto: "Folha com o QR e o passo a passo para a tela inicial do celular." },
  { href: "/resultados", titulo: "Resultados das noites", texto: "Quantas vezes um bloco lotou enquanto outro tinha vaga." },
];

export default function PaginaComoFunciona() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-black leading-tight">Como funciona</h1>
        <p className="text-sm text-texto-secundario">O monitor das vagas de estacionamento dos blocos A, C e H do SENAI Blumenau no período noturno.</p>
      </header>

      <Secao id="problema" titulo="O problema">
        <p>O texto do desafio diz:</p>
        <blockquote className="border-l-4 border-borda pl-4 text-texto-secundario">
          Atualmente, não há uma forma confiável de informar a disponibilidade de vagas de estacionamento no período noturno nos blocos A, C e H.
          Em diversas situações, os vigias orientam os motoristas de que não existem vagas disponíveis, fazendo com que estacionem em locais mais
          distantes. No entanto, posteriormente é constatado que ainda havia vagas livres nos estacionamentos desses blocos, gerando deslocamentos
          desnecessários, perda de tempo e insatisfação dos usuários.
        </blockquote>
        <p>O sistema conta as vagas livres com um sensor em cada vaga e mostra o número para o motorista no celular e para o vigia na guarita.</p>
      </Secao>

      <Secao id="caminho" titulo="Como o dado chega até a tela">
        <DiagramaCaminho />
        <p>A placa de cada estacionamento lê os sensores e manda o estado das vagas a cada 10 segundos.</p>
      </Secao>

      <Secao id="sem-dados" titulo="Quando aparece SEM DADOS">
        <p>
          Se um estacionamento passa 30 segundos sem mandar dado, a página deixa de mostrar o número e mostra SEM DADOS. Zero vagas só aparece quando
          o dado é recente. Com essa regra, a página não manda ninguém embora por causa de um número antigo.
        </p>
      </Secao>

      <Secao id="guarita" titulo="A tela da guarita">
        <figure className="flex flex-col gap-2">
          <Image
            src="/telas/guarita-demo.png"
            alt="Tela da guarita em demonstração, com dados simulados: três colunas, uma por bloco, e a faixa de orientação embaixo."
            width={1366}
            height={768}
            sizes="(max-width: 768px) 100vw, 768px"
            className="h-auto w-full rounded-xl border border-borda"
          />
          <figcaption className="text-sm text-texto-secundario">Tela da guarita em demonstração, com dados simulados.</figcaption>
        </figure>
        <p>
          A tela fica aberta a noite toda no PC da guarita. A faixa de baixo diz ao vigia qual bloco indicar e avisa quando um bloco está sem dados.
        </p>
      </Secao>

      <Secao id="maquete" titulo="A maquete">
        <p>
          A primeira demonstração usa uma maquete pequena com sensores de verdade: uma placa ESP32 lê os sensores de miniaturas dos três
          estacionamentos. O site mostra a maquete até as placas serem instaladas nos estacionamentos.
        </p>
      </Secao>

      <Secao id="quem-fez" titulo="Quem fez">
        <p>Sensores, placas, site e banco de dados: João Victor Fagundes Miranda, aluno de Desenvolvimento de Sistemas do SENAI Itumbiara.</p>
      </Secao>

      <Secao id="veja" titulo="Veja funcionando">
        <ul data-testid="navegacao" className="grid gap-3 sm:grid-cols-2">
          {TELAS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="flex min-h-11 flex-col gap-1 rounded-xl border border-borda bg-superficie px-4 py-3 no-underline hover:bg-superficie-2"
              >
                <span className="font-bold text-texto">{t.titulo}</span>
                <span className="text-sm text-texto-secundario">{t.texto}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Secao>
    </main>
  );
}

function Secao({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`titulo-${id}`} className="flex flex-col gap-3">
      <h2 id={`titulo-${id}`} className="text-lg font-bold">
        {titulo}
      </h2>
      {children}
    </section>
  );
}
