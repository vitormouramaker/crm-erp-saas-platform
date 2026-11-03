import { API_BASE } from "../config/api";
import { decrypt, encrypt } from "../utils/cripto";

export type DeveloperWebhookEventKey =
  | "conversation.created"
  | "message.created"
  | "customer.created"
  | "deal.closed_won"
  | "deal.closed_lost";

export type DeveloperWebhookSecurityLocation = "header" | "body" | "query";

export type DeveloperWebhookEventCatalogItem = {
  key: DeveloperWebhookEventKey;
  label: string;
  description: string;
  payload_example: Record<string, unknown>;
};

export type DeveloperWebhookRecord = {
  id: number;
  empresa_id: number;
  nome: string;
  url: string;
  security_key: string;
  security_location: DeveloperWebhookSecurityLocation;
  security_field_name: string;
  eventos: DeveloperWebhookEventKey[];
  ativo: boolean;
  criado_em: string | null;
  atualizado_em: string | null;
};

export type DeveloperWebhookHistoryRecord = {
  id: number;
  empresa_id: number;
  webhook_id: number;
  webhook_nome: string;
  event_key: DeveloperWebhookEventKey | string;
  entity_id: number | null;
  dispatch_key: string;
  request_url: string;
  request_headers: Record<string, unknown>;
  request_body: Record<string, unknown>;
  response_status: number | null;
  response_headers: Record<string, unknown>;
  response_body: string | null;
  status: "processing" | "success" | "error" | string;
  error_message: string | null;
  instance_id: string | null;
  created_at: string | null;
  finished_at: string | null;
};

type RawApiResponse<T> = {
  payload?: string;
  boleano?: boolean;
  mensagem?: string;
  obj?: T;
  success?: boolean;
  message?: string;
  data?: T;
};

type ListResponseData = {
  webhooks?: Partial<DeveloperWebhookRecord>[];
  event_catalog?: DeveloperWebhookEventCatalogItem[];
};

type HistoryResponseData = {
  historico?: Partial<DeveloperWebhookHistoryRecord>[];
};

type ParsedApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
};

function normalizeWebhookRecord(
  item: Partial<DeveloperWebhookRecord> | undefined,
  empresaId: number,
): DeveloperWebhookRecord {
  return {
    id: Number(item?.id || 0),
    empresa_id: Number(item?.empresa_id || empresaId),
    nome: String(item?.nome || ""),
    url: String(item?.url || ""),
    security_key: String(item?.security_key || ""),
    security_location: (
      item?.security_location === "body" || item?.security_location === "query"
        ? item.security_location
        : "header"
    ) as DeveloperWebhookSecurityLocation,
    security_field_name: String(item?.security_field_name || "x-webhook-codigo"),
    eventos: Array.isArray(item?.eventos)
      ? item.eventos.filter(Boolean) as DeveloperWebhookEventKey[]
      : [],
    ativo: Boolean(item?.ativo),
    criado_em: item?.criado_em ? String(item.criado_em) : null,
    atualizado_em: item?.atualizado_em ? String(item.atualizado_em) : null,
  };
}

async function parseApiResponse<T>(raw: RawApiResponse<T>): Promise<ParsedApiResponse<T>> {
  if (raw?.payload) {
    const decoded = await decrypt(raw.payload);
    if (decoded) {
      return {
        success: Boolean(decoded?.boleano),
        message: String(decoded?.mensagem || ""),
        data: decoded?.obj as T | undefined,
      };
    }
  }

  return {
    success: raw?.success ?? raw?.boleano ?? false,
    message: String(raw?.message ?? raw?.mensagem ?? ""),
    data: raw?.data ?? raw?.obj,
  };
}

function normalizeWebhookHistoryRecord(
  item: Partial<DeveloperWebhookHistoryRecord> | undefined,
): DeveloperWebhookHistoryRecord {
  return {
    id: Number(item?.id || 0),
    empresa_id: Number(item?.empresa_id || 0),
    webhook_id: Number(item?.webhook_id || 0),
    webhook_nome: String(item?.webhook_nome || ""),
    event_key: String(item?.event_key || ""),
    entity_id:
      item?.entity_id === null || item?.entity_id === undefined ? null : Number(item.entity_id),
    dispatch_key: String(item?.dispatch_key || ""),
    request_url: String(item?.request_url || ""),
    request_headers:
      item?.request_headers && typeof item.request_headers === "object"
        ? (item.request_headers as Record<string, unknown>)
        : {},
    request_body:
      item?.request_body && typeof item.request_body === "object"
        ? (item.request_body as Record<string, unknown>)
        : {},
    response_status:
      item?.response_status === null || item?.response_status === undefined
        ? null
        : Number(item.response_status),
    response_headers:
      item?.response_headers && typeof item.response_headers === "object"
        ? (item.response_headers as Record<string, unknown>)
        : {},
    response_body: item?.response_body ? String(item.response_body) : null,
    status: String(item?.status || "processing"),
    error_message: item?.error_message ? String(item.error_message) : null,
    instance_id: item?.instance_id ? String(item.instance_id) : null,
    created_at: item?.created_at ? String(item.created_at) : null,
    finished_at: item?.finished_at ? String(item.finished_at) : null,
  };
}

export async function getDeveloperWebhooks(empresaId: number): Promise<{
  webhooks: DeveloperWebhookRecord[];
  eventCatalog: DeveloperWebhookEventCatalogItem[];
}> {
  const payload = await encrypt({ empresa_id: empresaId });

  const response = await fetch(`${API_BASE}/developer_webhooks/listar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const raw = (await response.json()) as RawApiResponse<ListResponseData>;
  const body = await parseApiResponse(raw);

  if (!response.ok || !body?.success || !body?.data) {
    throw new Error(body?.message || "Nao foi possivel carregar os webhooks de desenvolvedor.");
  }

  return {
    webhooks: Array.isArray(body.data.webhooks)
      ? body.data.webhooks.map((item) => normalizeWebhookRecord(item, empresaId))
      : [],
    eventCatalog: Array.isArray(body.data.event_catalog) ? body.data.event_catalog : [],
  };
}

export async function saveDeveloperWebhook(params: {
  empresaId: number;
  id?: number | null;
  nome: string;
  url: string;
  securityKey: string;
  securityLocation: DeveloperWebhookSecurityLocation;
  securityFieldName: string;
  eventos: DeveloperWebhookEventKey[];
  ativo: boolean;
}): Promise<{ webhook: DeveloperWebhookRecord; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    id: params.id || null,
    nome: params.nome,
    url: params.url,
    security_key: params.securityKey,
    security_location: params.securityLocation,
    security_field_name: params.securityFieldName,
    eventos: params.eventos,
    ativo: params.ativo,
  });

  const response = await fetch(`${API_BASE}/developer_webhooks/salvar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const raw = (await response.json()) as RawApiResponse<Partial<DeveloperWebhookRecord>>;
  const body = await parseApiResponse(raw);

  if (!response.ok || !body?.success || !body?.data) {
    throw new Error(body?.message || "Nao foi possivel salvar o webhook de desenvolvedor.");
  }

  return {
    webhook: normalizeWebhookRecord(body.data, params.empresaId),
    message: body.message || "Webhook salvo com sucesso.",
  };
}

export async function deleteDeveloperWebhook(params: {
  empresaId: number;
  id: number;
}): Promise<string> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    id: params.id,
  });

  const response = await fetch(`${API_BASE}/developer_webhooks/deletar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const raw = (await response.json()) as RawApiResponse<Record<string, never>>;
  const body = await parseApiResponse(raw);

  if (!response.ok || !body?.success) {
    throw new Error(body?.message || "Nao foi possivel remover o webhook de desenvolvedor.");
  }

  return body.message || "Webhook removido com sucesso.";
}

export async function getDeveloperWebhookHistory(params: {
  empresaId: number;
  webhookId: number;
  limit?: number;
}): Promise<DeveloperWebhookHistoryRecord[]> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    webhook_id: params.webhookId,
    limit: params.limit || 50,
  });

  const response = await fetch(`${API_BASE}/developer_webhooks/historico`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const raw = (await response.json()) as RawApiResponse<HistoryResponseData>;
  const body = await parseApiResponse(raw);

  if (!response.ok || !body?.success || !body?.data) {
    throw new Error(body?.message || "Nao foi possivel carregar o historico do webhook.");
  }

  return Array.isArray(body.data.historico)
    ? body.data.historico.map((item) => normalizeWebhookHistoryRecord(item))
    : [];
}
