import { API_BASE } from "../config/api";
import { readStoredSession } from "../utils/authSession";
import { decrypt, encrypt } from "../utils/cripto";

type ApiEnvelope<T> = {
  boleano: boolean;
  obj?: T;
  mensagem?: string;
  msg?: string;
};

async function getSessionContext() {
  const session = await readStoredSession();
  const empresaId = Number(session?.user?.empresa_id || 0);
  const userId = Number(session?.user?.id || 0);
  if (!empresaId || !userId) throw new Error("Sessao invalida ou expirada.");
  return { empresaId, userId };
}

async function postSafety<T>(path: string, input: Record<string, unknown>) {
  const { empresaId, userId } = await getSessionContext();
  const payload = await encrypt({
    empresa_id: empresaId,
    usuario_id: userId,
    ...input,
  });
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  const raw = await response.json();
  const envelope = (raw?.payload ? await decrypt(raw.payload) : raw) as ApiEnvelope<T>;
  if (!response.ok || !envelope?.boleano) {
    throw new Error(String(envelope?.mensagem || envelope?.msg || "Nao foi possivel concluir a acao."));
  }
  return envelope;
}

export type BlockedClient = {
  id: number;
  cliente_id: number;
  motivo?: string | null;
  criado_em?: string;
};

export const appSafetyService = {
  blockClient: (input: { clienteId: number; conversaId: number; motivo?: string }) =>
    postSafety<BlockedClient>("/atendimento/bloquear_cliente", {
      cliente_id: input.clienteId,
      conversa_id: input.conversaId,
      motivo: input.motivo || null,
    }),

  unblockClient: (input: { clienteId: number; conversaId: number }) =>
    postSafety<BlockedClient>("/atendimento/desbloquear_cliente", {
      cliente_id: input.clienteId,
      conversa_id: input.conversaId,
    }),

  listBlockedClients: () =>
    postSafety<BlockedClient[]>("/atendimento/listar_clientes_bloqueados", {}),

  report: (input: {
    clienteId: number;
    conversaId: number;
    mensagemId?: number;
    motivo: string;
    descricao?: string;
  }) =>
    postSafety<{ id: number }>("/atendimento/denunciar", {
      cliente_id: input.clienteId,
      conversa_id: input.conversaId,
      mensagem_id: input.mensagemId || null,
      tipo: "abuso",
      motivo: input.motivo,
      descricao: input.descricao || null,
    }),

  hideMessage: (input: { conversaId: number; mensagemId: number }) =>
    postSafety<{ id: number; apagada: boolean }>("/atendimento/apagar_mensagem", {
      conversa_id: input.conversaId,
      mensagem_id: input.mensagemId,
    }),
};
