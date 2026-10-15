import type { Bolsao, CausaSemDados, Situacao } from "./tipos";

/** Dado com mais de 30 s vira SEM DADOS. Único lugar que define isso. */
export const LIMITE_FRESCOR_MS = 30_000;

/** Dado "do futuro" além disso indica relógio errado; na dúvida, não mostrar número. */
export const TOLERANCIA_FUTURO_MS = 5_000;

/** Depois disso sem dado, a guarita pede para avisar o responsável pelos sensores. */
export const LIMITE_AVISO_RESPONSAVEL_MS = 600_000;

/** Idade do dado em ms pela hora do servidor, ou null quando nunca recebeu dado. */
export function idadeMs(atualizadoEm: string | null, agoraServidorMs: number): number | null {
  if (!atualizadoEm) return null;
  const t = Date.parse(atualizadoEm);
  if (Number.isNaN(t)) return null;
  return agoraServidorMs - t;
}

/** Até quantas vagas livres conta como "poucas". */
export function limitePoucas(totalVagas: number): number {
  return Math.max(3, Math.ceil(totalVagas * 0.1));
}

type Estado = Pick<Bolsao, "atualizado_em" | "vagas" | "total_vagas" | "vagas_livres">;
type ComEspeciais = Pick<Bolsao, "vagas" | "especiais">;

/**
 * Situação de um bolsão. Qualquer dúvida sobre o dado vira "sem-dados": é a regra
 * que impede a página de mandar motorista embora com o bolsão vazio.
 */
export function situacao(b: Estado, agoraServidorMs: number): Situacao {
  const idade = idadeMs(b.atualizado_em, agoraServidorMs);
  if (idade === null) return "sem-dados";
  if (idade > LIMITE_FRESCOR_MS) return "sem-dados";
  if (idade < -TOLERANCIA_FUTURO_MS) return "sem-dados";
  if (b.vagas === null || b.total_vagas === null || b.vagas_livres === null) return "sem-dados";
  if (b.vagas.length !== b.total_vagas) return "sem-dados";
  if (b.vagas_livres > b.total_vagas) return "sem-dados";
  if (b.vagas_livres === 0) return "lotado";
  if (b.vagas_livres <= limitePoucas(b.total_vagas)) return "poucas";
  return "livre";
}

/** Posições que estão em alguma lista de vagas especiais e existem na grade. */
function posicoesEspeciais(b: ComEspeciais): Set<number> {
  const s = new Set<number>();
  const n = b.vagas?.length ?? 0;
  for (const posicoes of Object.values(b.especiais ?? {})) {
    for (const p of posicoes) if (p >= 0 && p < n) s.add(p);
  }
  return s;
}

/** Vagas livres fora das listas de especiais, ou null sem a lista de vagas. */
export function livresComuns(b: ComEspeciais): number | null {
  if (!b.vagas) return null;
  const esp = posicoesEspeciais(b);
  return b.vagas.filter((ocupada, i) => !ocupada && !esp.has(i)).length;
}

/** Quantas vagas não são especiais. */
export function totalComuns(b: ComEspeciais): number | null {
  if (!b.vagas) return null;
  return b.vagas.length - posicoesEspeciais(b).size;
}

/** Vagas especiais livres, somando os tipos (posição em duas listas conta uma vez). */
export function especiaisLivresTotal(b: ComEspeciais): number {
  if (!b.vagas) return 0;
  let n = 0;
  for (const p of posicoesEspeciais(b)) if (!b.vagas[p]) n++;
  return n;
}

/**
 * Situação olhando só as vagas comuns: o número grande da tela conta só elas, e um
 * bolsão em que só sobrou a vaga PCD aparece como LOTADO (decisão D2).
 */
export function situacaoComum(b: Estado & ComEspeciais, agoraServidorMs: number): Situacao {
  const s = situacao(b, agoraServidorMs);
  if (s === "sem-dados") return s;
  const comuns = livresComuns(b) ?? 0;
  const total = totalComuns(b) ?? 0;
  if (comuns === 0) return "lotado";
  if (comuns <= limitePoucas(total)) return "poucas";
  return "livre";
}

export interface DadosVisiveis {
  livres: number;
  total: number;
  vagas: boolean[];
  livresComuns: number;
  especiaisLivres: number;
}

/**
 * Única porta para mostrar número: devolve null em SEM DADOS ou com campo faltando.
 * Nenhum componente lê vagas_livres direto (UX-02).
 */
export function dadosVisiveis(b: Estado & ComEspeciais, s: Situacao): DadosVisiveis | null {
  if (s === "sem-dados") return null;
  if (b.vagas_livres === null || b.total_vagas === null || b.vagas === null) return null;
  return {
    livres: b.vagas_livres,
    total: b.total_vagas,
    vagas: b.vagas,
    livresComuns: livresComuns(b) ?? b.vagas_livres,
    especiaisLivres: especiaisLivresTotal(b),
  };
}

/**
 * Quanto somar ao relógio do aparelho para chegar ao do servidor.
 * t0 e t1 são os instantes locais antes e depois da chamada; a resposta vale no meio.
 */
export function deslocamentoRelogio(t0: number, t1: number, servidorMs: number): number {
  return servidorMs - (t0 + t1) / 2;
}

const FUSO = "America/Sao_Paulo";

/** Hora local no formato HH:MM de America/Sao_Paulo. */
export function horaCurta(ms: number): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO }).format(new Date(ms));
}

function dataLocal(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

/**
 * Quando algo aconteceu, para quem lê hoje: "19:42", "ontem às 22:30" ou "13/10 às 22:30".
 * Compara o calendário de São Paulo, não a diferença de 24 h.
 */
export function quando(ms: number, agoraServidorMs: number): string {
  const hora = horaCurta(ms);
  if (ms > agoraServidorMs) return hora;
  const dia = dataLocal(ms);
  if (dia === dataLocal(agoraServidorMs)) return hora;
  if (dia === dataLocal(agoraServidorMs - 86_400_000)) return `ontem às ${hora}`;
  const [, mes, d] = dia.split("-");
  return `${d}/${mes} às ${hora}`;
}

/** Texto da idade do dado para a tela. */
export function textoIdade(b: Pick<Bolsao, "atualizado_em">, agoraServidorMs: number): string {
  const idade = idadeMs(b.atualizado_em, agoraServidorMs);
  if (idade === null) return "ainda não recebeu dados";
  if (idade > LIMITE_FRESCOR_MS || idade < -TOLERANCIA_FUTURO_MS) {
    return `sem dados desde ${quando(Date.parse(b.atualizado_em!), agoraServidorMs)}`;
  }
  if (idade <= 5_000) return "agora";
  return `há ${Math.floor(idade / 1000)} s`;
}

export interface EntradaCausa {
  modo: "supabase" | "demo" | "sem-configuracao";
  carregou: boolean;
  msDesdeMontagem: number;
  status: "conectando" | "ao-vivo" | "reconectando" | "sem-configuracao";
  erroCarga: boolean;
  online: boolean;
  msDesdeLeituraOk: number | null;
}

/** Por que a tela está em SEM DADOS. A ordem importa: a causa mais certa vem primeiro. */
export function causaSemDados(e: EntradaCausa): CausaSemDados {
  if (e.modo === "demo") return "sensor";
  if (e.modo === "sem-configuracao") return "configuracao";
  if (!e.carregou && e.msDesdeMontagem < 5000) return "carregando";
  if (e.online === false) return "sem-conexao";
  if (e.msDesdeLeituraOk !== null && e.msDesdeLeituraOk <= 15_000) return "sensor";
  if (e.status === "ao-vivo" && e.carregou && !e.erroCarga) return "sensor";
  return "sem-conexao";
}

export interface TextoSemDados {
  longo: string;
  curto: string;
}

const CONFIRA = "O bloco pode ter vaga livre. Confira no local.";

/** Texto do SEM DADOS: diz a causa sem culpar o sensor quando o problema é a conexão. */
export function textoSemDados(
  b: Pick<Bolsao, "atualizado_em">,
  agoraServidorMs: number,
  opcoes: { causa: CausaSemDados; online: boolean; aparelho: "celular" | "guarita" },
): TextoSemDados {
  const { causa, online, aparelho } = opcoes;
  if (causa === "carregando") return { longo: "A página está carregando as vagas.", curto: "carregando" };
  if (causa === "sem-conexao" && online === false) {
    return {
      longo: `${aparelho === "celular" ? "O celular" : "Este computador"} está sem internet. ${CONFIRA}`,
      curto: "sem internet",
    };
  }
  if (causa === "sem-conexao") return { longo: `Este aparelho está sem conexão com o servidor. ${CONFIRA}`, curto: "sem conexão" };
  if (causa === "configuracao") return { longo: `A página está com erro de configuração. ${CONFIRA}`, curto: "erro de configuração" };
  const idade = idadeMs(b.atualizado_em, agoraServidorMs);
  if (idade === null) return { longo: `Os sensores deste bloco ainda não mandaram dados. ${CONFIRA}`, curto: "ainda não recebeu dados" };
  if (idade > LIMITE_FRESCOR_MS || idade < -TOLERANCIA_FUTURO_MS) {
    const q = quando(Date.parse(b.atualizado_em!), agoraServidorMs);
    return { longo: `O último dado dos sensores chegou ${prefixoQuando(q)}. ${CONFIRA}`, curto: `sem dados desde ${q}` };
  }
  return { longo: `Os sensores deste bloco mandaram um dado incompleto. ${CONFIRA}`, curto: "dado incompleto" };
}

export interface Indicador {
  chave: "demo" | "sem-configuracao" | "conectando" | "sem-conexao" | "ao-vivo" | "sem-sensores";
  texto: string;
  tom: "verde" | "alerta" | "cinza" | "vermelho";
}

/** O que o indicador do cabeçalho diz. "Ao vivo" só com algum bloco mostrando número. */
export function indicadorConexao(modo: EntradaCausa["modo"], causa: CausaSemDados, situacoes: Map<string, Situacao>): Indicador {
  if (modo === "demo") return { chave: "demo", texto: "Simulação", tom: "verde" };
  if (modo === "sem-configuracao") return { chave: "sem-configuracao", texto: "Fora do ar", tom: "vermelho" };
  if (causa === "carregando") return { chave: "conectando", texto: "Conectando", tom: "cinza" };
  if (causa === "sem-conexao") return { chave: "sem-conexao", texto: "Sem conexão", tom: "alerta" };
  const algumComDado = [...situacoes.values()].some((s) => s !== "sem-dados");
  if (algumComDado) return { chave: "ao-vivo", texto: "Ao vivo", tom: "verde" };
  return { chave: "sem-sensores", texto: "Sensores sem dados", tom: "alerta" };
}

export interface EspecialLivre {
  tipo: string;
  rotulo: string;
  livres: number;
  total: number;
}

export const ROTULOS: Record<string, string> = { pcd: "PCD", idoso: "Idoso", gestante: "Gestante", moto: "Moto" };

/** Vagas especiais (PCD, idoso...) livres, só quando o bolsão tem dado. Fora do alcance da grade é ignorado. */
export function especiaisLivres(b: ComEspeciais): EspecialLivre[] {
  if (!b.vagas) return [];
  const saida: EspecialLivre[] = [];
  for (const [tipo, posicoes] of Object.entries(b.especiais ?? {})) {
    const validas = posicoes.filter((p) => p >= 0 && p < b.vagas!.length);
    if (validas.length === 0) continue;
    saida.push({
      tipo,
      rotulo: ROTULOS[tipo] ?? tipo,
      livres: validas.filter((p) => !b.vagas![p]).length,
      total: validas.length,
    });
  }
  return saida;
}

/** "PCD: 2 livres", "PCD: 1 livre", "Idoso: nenhuma livre" (decisão D13). */
export function textoEspecial(e: Pick<EspecialLivre, "rotulo" | "livres">): string {
  if (e.livres === 0) return `${e.rotulo}: nenhuma livre`;
  return `${e.rotulo}: ${e.livres} ${e.livres === 1 ? "livre" : "livres"}`;
}

/** Tipo especial de uma posição da grade, ou null. */
export function tipoDaVaga(especiais: Bolsao["especiais"], indice: number): string | null {
  for (const [tipo, posicoes] of Object.entries(especiais ?? {})) {
    if (posicoes.includes(indice)) return tipo;
  }
  return null;
}

function listaIds(bs: Bolsao[]): string {
  const ids = bs.map((b) => b.id);
  if (ids.length <= 1) return ids.join("");
  return `${ids.slice(0, -1).join(", ")} e ${ids[ids.length - 1]}`;
}

function nomeOuBlocos(bs: Bolsao[], minusculo = false): string {
  if (bs.length === 1) return minusculo ? `o ${bs[0].nome}` : bs[0].nome;
  return minusculo ? `os blocos ${listaIds(bs)}` : `Blocos ${listaIds(bs)}`;
}

function vagasLivres(n: number): string {
  return `${n} ${n === 1 ? "vaga livre" : "vagas livres"}`;
}

/** "Bloco C (1 PCD, 1 idoso)" para cada bloco com especial livre. */
function especiaisPorBloco(bs: Bolsao[]): string {
  return bs
    .map((b) => {
      const partes = especiaisLivres(b)
        .filter((e) => e.livres > 0)
        .map((e) => `${e.livres} ${e.tipo === "pcd" ? "PCD" : e.rotulo.toLowerCase()}`);
      return `${b.nome} (${partes.join(", ")})`;
    })
    .join(", ");
}

/**
 * Qual bloco indicar. Mantém o anterior quando a diferença é pequena, para a faixa
 * não trocar de bloco enquanto o vigia fala com o motorista (UX-33).
 */
function escolherIndicado(comVaga: Bolsao[], anteriorId: string | null | undefined): Bolsao | null {
  if (comVaga.length === 0) return null;
  const maior = livresComuns(comVaga[0]) ?? 0;
  const anterior = anteriorId ? comVaga.find((b) => b.id === anteriorId) : undefined;
  if (anterior) {
    const n = livresComuns(anterior) ?? 0;
    if (n >= 3 && n >= maior - 3) return anterior;
  }
  return comVaga[0];
}

function separar(bolsoes: Bolsao[], situacoes: Map<string, Situacao>) {
  const sit = (b: Bolsao) => situacoes.get(b.id) ?? "sem-dados";
  const semDados = bolsoes.filter((b) => sit(b) === "sem-dados");
  const comVaga = bolsoes
    .filter((b) => (sit(b) === "livre" || sit(b) === "poucas") && (livresComuns(b) ?? 0) > 0)
    .sort((a, b) => (livresComuns(b) ?? 0) - (livresComuns(a) ?? 0) || a.ordem - b.ordem);
  const lotados = bolsoes.filter((b) => sit(b) === "lotado");
  const comEspecial = bolsoes.filter((b) => sit(b) !== "sem-dados" && especiaisLivresTotal(b) > 0);
  return { semDados, comVaga, lotados, comEspecial };
}

export interface Orientacao {
  tipo: "indicar" | "lotado" | "sem-dados";
  /** Bolsão com mais vagas comuns livres entre os que têm dado fresco. */
  indicado: Bolsao | null;
  /** Bolsões sem dado recente: o vigia não pode dizer que estão lotados. */
  semDados: Bolsao[];
  texto: string;
  detalhe: string | null;
  /** Vagas especiais livres quando as comuns acabaram. */
  especiais: string | null;
}

/**
 * O que a tela da guarita diz ao vigia. Só indica bloco com dado fresco e vaga comum
 * livre; bloco sem dado nunca entra na conta de "lotado", e o texto grande começa
 * pelo bloco que pode ter vaga (decisão D5).
 */
export function orientacaoGuarita(bolsoes: Bolsao[], situacoes: Map<string, Situacao>, causa: CausaSemDados = "sensor", anteriorId?: string | null): Orientacao {
  const { semDados, comVaga, lotados, comEspecial } = separar(bolsoes, situacoes);
  const indicado = escolherIndicado(comVaga, anteriorId);
  const avisoSemDados =
    semDados.length === 0 ? null : semDados.length === 1 ? `${semDados[0].nome} sem dados. Ele pode ter vaga.` : `${nomeOuBlocos(semDados)} sem dados. Eles podem ter vaga.`;
  const especiais = comVaga.length === 0 && comEspecial.length > 0 ? `Vagas especiais livres: ${especiaisPorBloco(comEspecial)}.` : null;

  if (indicado) {
    return { tipo: "indicar", indicado, semDados, texto: `Indique o ${indicado.nome}: ${vagasLivres(livresComuns(indicado) ?? 0)}.`, detalhe: avisoSemDados, especiais: null };
  }
  if (causa !== "sensor") {
    const texto = causa === "carregando" ? "A tela está carregando as vagas." : causa === "sem-conexao" ? "Esta tela está sem conexão." : "Esta tela está com erro de configuração.";
    const detalhe = causa === "sem-conexao" ? "Não diga que está lotado. Os números voltam sozinhos quando a conexão voltar." : "Não diga ao motorista que está lotado.";
    return { tipo: "sem-dados", indicado: null, semDados, texto, detalhe, especiais: null };
  }
  if (semDados.length === bolsoes.length) {
    return { tipo: "sem-dados", indicado: null, semDados, texto: "Os sensores não estão mandando dados.", detalhe: "Não diga ao motorista que está lotado.", especiais: null };
  }
  if (semDados.length > 0) {
    const detalhe = lotados.length > 0 ? `Os sensores mostram ${nomeOuBlocos(lotados, true)} ${lotados.length === 1 ? "lotado" : "lotados"}.` : null;
    return { tipo: "sem-dados", indicado: null, semDados, texto: avisoSemDados!, detalhe, especiais };
  }
  if (especiais) {
    return { tipo: "lotado", indicado: null, semDados, texto: "As vagas comuns estão lotadas.", detalhe: null, especiais };
  }
  return { tipo: "lotado", indicado: null, semDados, texto: bolsoes.length === 3 ? "Os três estacionamentos estão lotados." : "Todos os estacionamentos estão lotados.", detalhe: null, especiais: null };
}

export interface OrientacaoMotorista {
  texto: string;
  detalhe: string | null;
  indicado: Bolsao | null;
  especiais: string | null;
}

/** A frase de resumo do celular: para onde ir (UX-13). */
export function orientacaoMotorista(bolsoes: Bolsao[], situacoes: Map<string, Situacao>, agoraServidorMs: number, anteriorId?: string | null): OrientacaoMotorista {
  const { semDados, comVaga, lotados, comEspecial } = separar(bolsoes, situacoes);
  const indicado = escolherIndicado(comVaga, anteriorId);
  const especiais = comVaga.length === 0 && comEspecial.length > 0 ? `Vagas especiais livres: ${especiaisPorBloco(comEspecial)}.` : null;
  const avisoSemDados =
    semDados.length === 0
      ? null
      : semDados.length === 1
        ? `O ${semDados[0].nome} está sem dados e pode ter vaga.`
        : `Os blocos ${listaIds(semDados)} estão sem dados e podem ter vaga.`;

  if (indicado) {
    const n = livresComuns(indicado) ?? 0;
    return { texto: `O ${indicado.nome} tem mais vagas: ${n} ${n === 1 ? "livre" : "livres"}.`, detalhe: avisoSemDados ? `${avisoSemDados} Confira no local.` : null, indicado, especiais: null };
  }
  if (semDados.length === bolsoes.length) {
    const ultimos = bolsoes.map((b) => (b.atualizado_em ? Date.parse(b.atualizado_em) : NaN)).filter((t) => !Number.isNaN(t));
    const detalhe = ultimos.length > 0 ? `O último dado chegou ${prefixoQuando(quando(Math.max(...ultimos), agoraServidorMs))}. Confira as vagas no local.` : "Os sensores ainda não mandaram nenhum dado. Confira as vagas no local.";
    return { texto: "Os sensores não estão mandando dados.", detalhe, indicado: null, especiais: null };
  }
  if (semDados.length > 0) {
    const detalhe = lotados.length > 0 ? `Os sensores mostram ${nomeOuBlocos(lotados, true)} ${lotados.length === 1 ? "lotado" : "lotados"}.` : null;
    return { texto: avisoSemDados!, detalhe, indicado: null, especiais };
  }
  if (especiais) return { texto: "As vagas comuns estão lotadas.", detalhe: null, indicado: null, especiais };
  return { texto: bolsoes.length === 3 ? "Os três estacionamentos estão lotados." : "Todos os estacionamentos estão lotados.", detalhe: null, indicado: null, especiais: null };
}

/** "às 19:42", "ontem às 22:47", "em 13/10 às 22:30". */
function prefixoQuando(q: string): string {
  if (q.startsWith("ontem")) return q;
  if (q.includes(" às ")) return `em ${q}`;
  return `às ${q}`;
}

/** O aviso no centro da coluna SEM DADOS da guarita (UX-07, UX-61). */
export function avisoColunaSemDados(b: Pick<Bolsao, "atualizado_em" | "aviso">, agoraServidorMs: number, causa: CausaSemDados, carregou: boolean): string {
  if (b.aviso) return "Não diga que está lotado. O bloco pode ter vaga.";
  if (causa !== "sensor") return "Não diga que está lotado. O bloco pode ter vaga.";
  const idade = idadeMs(b.atualizado_em, agoraServidorMs);
  const muitoTempo = idade === null ? carregou : idade > LIMITE_AVISO_RESPONSAVEL_MS;
  if (muitoTempo) return "Não diga que está lotado. Avise o responsável pelos sensores.";
  return "Não diga que está lotado. O bloco pode ter vaga.";
}

export type CategoriaAnuncio = "com-vaga" | "lotado" | "sem-dados";

export function categoriaAnuncio(s: Situacao): CategoriaAnuncio {
  if (s === "sem-dados") return "sem-dados";
  if (s === "lotado") return "lotado";
  return "com-vaga";
}

export interface EstadoAnuncio {
  categoria: CategoriaAnuncio;
  desdeMs: number;
}

/**
 * Avisos falados da guarita (UX-63): um bloco só fala quando a categoria muda e se
 * mantém por 20 s (60 s para sem dados), para um sensor oscilando não virar alarme.
 */
export function anunciosGuarita(
  entrada: { id: string; nome: string; categoria: CategoriaAnuncio }[],
  anunciado: Map<string, EstadoAnuncio>,
  agoraMs: number,
  semConexao: boolean,
  atual: Map<string, EstadoAnuncio>,
): { frases: string[]; anunciado: Map<string, EstadoAnuncio>; atual: Map<string, EstadoAnuncio> } {
  const frases: string[] = [];
  const novoAtual = new Map(atual);
  const novoAnunciado = new Map(anunciado);
  for (const b of entrada) {
    const a = novoAtual.get(b.id);
    if (!a || a.categoria !== b.categoria) {
      novoAtual.set(b.id, { categoria: b.categoria, desdeMs: agoraMs });
      continue;
    }
    if (semConexao) continue;
    const limite = b.categoria === "sem-dados" ? 60_000 : 20_000;
    if (agoraMs - a.desdeMs < limite) continue;
    const ultimo = novoAnunciado.get(b.id);
    if (ultimo && ultimo.categoria === b.categoria) continue;
    if (!ultimo) {
      novoAnunciado.set(b.id, { categoria: b.categoria, desdeMs: agoraMs });
      continue;
    }
    if (b.categoria === "com-vaga") frases.push(ultimo.categoria === "lotado" ? `${b.nome} voltou a ter vaga.` : `${b.nome} tem vaga.`);
    else if (b.categoria === "lotado") frases.push(`${b.nome} lotou.`);
    else frases.push(`${b.nome} ficou sem dados.`);
    novoAnunciado.set(b.id, { categoria: b.categoria, desdeMs: agoraMs });
  }
  return { frases, anunciado: novoAnunciado, atual: novoAtual };
}
