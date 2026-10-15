import type { Page, WebSocketRoute } from "@playwright/test";

export interface LinhaBolsao {
  id: string;
  nome: string;
  ordem: number;
  total_vagas: number | null;
  vagas_livres: number | null;
  vagas: boolean[] | null;
  especiais: Record<string, number[]>;
  atualizado_em: string | null;
  aviso?: string | null;
  publico?: boolean;
}

export function linha(id: string, nome: string, ordem: number, estados: string | null, atualizadoEm: string | null, especiais: Record<string, number[]> = {}, extra: Partial<LinhaBolsao> = {}): LinhaBolsao {
  const vagas = estados === null ? null : [...estados].map((c) => c === "1");
  return {
    id,
    nome,
    ordem,
    total_vagas: vagas?.length ?? null,
    vagas_livres: vagas ? vagas.filter((v) => !v).length : null,
    vagas,
    especiais,
    atualizado_em: atualizadoEm,
    aviso: null,
    publico: true,
    ...extra,
  };
}

export interface OpcoesFalso {
  /** A lista, ou uma função chamada a cada carga. */
  bolsoes: LinhaBolsao[] | (() => LinhaBolsao[]);
  agora: () => string;
  /** false: fecha cada WebSocket com 1006, como uma rede que bloqueia o Realtime. */
  realtime?: boolean;
}

/**
 * Faz o papel do Supabase: responde a API REST e o WebSocket do Realtime
 * (protocolo Phoenix, versão 2: mensagens em array [join_ref, ref, topic, event, payload]).
 * Filtra `publico` como o PostgREST faria com `publico=eq.true`.
 */
export async function supabaseFalso(page: Page, inicial: OpcoesFalso) {
  const estado = { bolsoes: inicial.bolsoes, cargas: 0 };
  let socket: WebSocketRoute | null = null;
  let topico: string | null = null;
  let joinRef: string | null = null;
  let subscrito = false;
  const lista = () => (typeof estado.bolsoes === "function" ? estado.bolsoes() : estado.bolsoes);

  await page.route(/\/rest\/v1\/bolsoes(\?|$)/, async (rota) => {
    estado.cargas++;
    const url = new URL(rota.request().url());
    const filtro = url.searchParams.get("publico");
    const quer = filtro === "eq.false" ? false : filtro === "eq.true" ? true : null;
    const corpo = lista().filter((b) => quer === null || (b.publico ?? true) === quer);
    await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });
  });
  await page.route(/\/rest\/v1\/rpc\/agora(\?|$)/, async (rota) => {
    await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(inicial.agora()) });
  });

  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    if (inicial.realtime === false) {
      ws.close({ code: 1006, reason: "bloqueado" });
      return;
    }
    socket = ws;
    ws.onMessage((mensagem) => {
      if (typeof mensagem !== "string") return;
      const [jr, ref, topic, event, payload] = JSON.parse(mensagem) as [string | null, string | null, string, string, Record<string, unknown>];
      if (event === "heartbeat") {
        ws.send(JSON.stringify([null, ref, "phoenix", "phx_reply", { status: "ok", response: {} }]));
        return;
      }
      if (event === "phx_join") {
        topico = topic;
        joinRef = jr;
        const config = payload.config as { postgres_changes?: { event: string; schema: string; table: string; filter?: string }[] };
        const pcs = (config.postgres_changes ?? []).map((f, i) => ({ id: 100 + i, ...f }));
        subscrito = true;
        ws.send(JSON.stringify([jr, ref, topic, "phx_reply", { status: "ok", response: { postgres_changes: pcs } }]));
        return;
      }
      if (event === "access_token") {
        ws.send(JSON.stringify([jr, ref, topic, "phx_reply", { status: "ok", response: {} }]));
      }
    });
  });

  return {
    estado,
    /** Troca o que o REST devolve na próxima carga. */
    definir(bolsoes: LinhaBolsao[] | (() => LinhaBolsao[])) {
      estado.bolsoes = bolsoes;
    },
    cargas: () => estado.cargas,
    assinado: () => subscrito,
    /** Manda um UPDATE pelo Realtime, como o banco faria. */
    atualizar(registro: LinhaBolsao) {
      if (!socket || !topico) throw new Error("Realtime ainda não assinou");
      if (typeof estado.bolsoes !== "function") estado.bolsoes = estado.bolsoes.map((b) => (b.id === registro.id ? registro : b));
      const dados = {
        ids: [100],
        data: {
          type: "UPDATE",
          schema: "vagas",
          table: "bolsoes",
          commit_timestamp: new Date().toISOString(),
          columns: [],
          record: registro,
          old_record: { id: registro.id },
          errors: null,
        },
      };
      socket.send(JSON.stringify([joinRef, null, topico, "postgres_changes", dados]));
    },
    /** Derruba a conexão: o cliente tenta reconectar sozinho. */
    derrubar() {
      socket?.close({ code: 1006, reason: "queda" });
    },
  };
}
