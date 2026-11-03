import { API_BASE } from "../config/api";
import { encrypt } from "../utils/cripto";

export type WebhookClienteInfo = {
  empresa_id: number;
  webhook_public_id: string;
  webhook_url: string;
  webhook_metodo: string;
  webhook_ativo: boolean;
  webhook_codigo_validacao: string;
  endpoints: WebhookClienteEndpoint[];
  n8n_endpoints: WebhookClienteEndpoint[];
  n8n_webhook_url: string;
  n8n_webhook_metodo: string;
  n8n_webhook_secret_field: string;
  n8n_webhook_header_validacao: string;
  n8n_ia_nome: string;
};

export type WebhookClienteEndpoint = {
  id: string;
  metodo: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | string;
  titulo: string;
  descricao: string;
  url: string;
};

type WebhookClienteResponse = {
  success?: boolean;
  message?: string;
  data?: Partial<WebhookClienteInfo>;
};

type UpdateWebhookStatusResponse = {
  success?: boolean;
  message?: string;
  data?: {
    empresa_id?: number;
    cliente_webhook_ativo?: boolean;
  };
};

type UpdateN8nIaNameResponse = {
  success?: boolean;
  message?: string;
  data?: {
    empresa_id?: number;
    n8n_ia_nome?: string;
  };
};

export async function getWebhookClienteInfo(empresaId: number): Promise<WebhookClienteInfo> {
  const payload = await encrypt({ empresa_id: empresaId });

  const response = await fetch(`${API_BASE}/webhook/cliente/configuracao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  if (!response.ok) {
    throw new Error("Falha ao buscar dados do webhook de clientes.");
  }

  const body = (await response.json()) as WebhookClienteResponse;

  if (!body?.success || !body?.data) {
    throw new Error(body?.message || "Nao foi possivel carregar o webhook de clientes.");
  }

  return {
    empresa_id: Number(body.data.empresa_id || empresaId),
    webhook_public_id: String(body.data.webhook_public_id || ""),
    webhook_url: String(body.data.webhook_url || ""),
    webhook_metodo: String(body.data.webhook_metodo || "POST"),
    webhook_ativo: Boolean(body.data.webhook_ativo),
    webhook_codigo_validacao: String(body.data.webhook_codigo_validacao || ""),
    endpoints: Array.isArray(body.data.endpoints)
      ? body.data.endpoints.map((endpoint) => ({
          id: String(endpoint?.id || ""),
          metodo: String(endpoint?.metodo || "GET").toUpperCase(),
          titulo: String(endpoint?.titulo || "Endpoint"),
          descricao: String(endpoint?.descricao || ""),
          url: String(endpoint?.url || ""),
        }))
      : [],
    n8n_endpoints: Array.isArray(body.data.n8n_endpoints)
      ? body.data.n8n_endpoints.map((endpoint) => ({
          id: String(endpoint?.id || ""),
          metodo: String(endpoint?.metodo || "POST").toUpperCase(),
          titulo: String(endpoint?.titulo || "Endpoint"),
          descricao: String(endpoint?.descricao || ""),
          url: String(endpoint?.url || ""),
        }))
      : [],
    n8n_webhook_url: String(body.data.n8n_webhook_url || ""),
    n8n_webhook_metodo: String(body.data.n8n_webhook_metodo || "POST"),
    n8n_webhook_secret_field: String(body.data.n8n_webhook_secret_field || "secret"),
    n8n_webhook_header_validacao: String(
      body.data.n8n_webhook_header_validacao || "x-webhook-codigo",
    ),
    n8n_ia_nome: String(body.data.n8n_ia_nome || "n8n IA"),
  };
}

export async function updateWebhookClienteStatus(params: {
  empresaId: number;
  ativo: boolean;
  webhookCodigo: string;
}): Promise<{ ativo: boolean; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    ativo: params.ativo,
    webhook_codigo: params.webhookCodigo,
  });

  const response = await fetch(`${API_BASE}/webhook/cliente/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const body = (await response.json()) as UpdateWebhookStatusResponse;

  if (
    !response.ok ||
    !body?.success ||
    typeof body?.data?.cliente_webhook_ativo !== "boolean"
  ) {
    throw new Error(body?.message || "Nao foi possivel atualizar o status do webhook.");
  }

  return {
    ativo: Boolean(body.data.cliente_webhook_ativo),
    message: body.message || "Status atualizado com sucesso.",
  };
}

export async function updateWebhookClienteN8nIaName(params: {
  empresaId: number;
  n8nIaNome: string;
}): Promise<{ n8nIaNome: string; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    n8n_ia_nome: params.n8nIaNome,
  });

  const response = await fetch(`${API_BASE}/webhook/cliente/configuracao`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const body = (await response.json()) as UpdateN8nIaNameResponse;

  if (!response.ok || !body?.success || typeof body?.data?.n8n_ia_nome !== "string") {
    throw new Error(body?.message || "Nao foi possivel atualizar o nome da IA.");
  }

  return {
    n8nIaNome: String(body.data.n8n_ia_nome || "n8n IA"),
    message: body.message || "Nome da IA atualizado com sucesso.",
  };
}
