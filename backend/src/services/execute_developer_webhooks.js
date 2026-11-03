const axios = require("axios");
const crypto = require("crypto");
const os = require("os");
const models = require("../models/models_developer_webhooks");
const { postgres } = require("../server/connect");
const { assertPublicHttpUrl } = require("../security/outbound_url");

const EVENT_CATALOG = [
  {
    key: "conversation.created",
    label: "Novas conversas",
    description: "Dispara quando uma nova conversa e criada no atendimento.",
    payload_example: {
      event: "conversation.created",
      occurred_at: "2026-07-16T13:45:00.000Z",
      source: "orbita_crm",
      company: { id: 12 },
      data: {
        conversation: {
          id: 981,
          status_id: 0,
          started_at: "2026-07-16T13:45:00.000Z",
          ended_at: null,
          number_phone_id: "5511999999999",
          empresa_meta_param_id: 7,
          owner_user_id: null,
          owner_user_name: null,
          assigned_user_id: 42,
          assigned_user_name: "Ana Souza",
        },
        customer: {
          id: 204,
          nome: "Maria da Silva",
          telefone: "5511999999999",
          email: "maria@email.com",
          origem: "whatsapp",
        },
      },
    },
  },
  {
    key: "message.created",
    label: "Novas mensagens",
    description: "Dispara a cada nova mensagem registrada na conversa.",
    payload_example: {
      event: "message.created",
      occurred_at: "2026-07-16T13:46:12.000Z",
      source: "orbita_crm",
      company: { id: 12 },
      data: {
        message: {
          id: 1502,
          conversation_id: 981,
          text: "Ola! Gostaria de mais informacoes.",
          type_id: 1,
          media_type: null,
          media_id: null,
          whatsapp_message_id: "wamid.HBgLN...",
          direction: "incoming",
          sender: "cliente",
          send_by: 1,
          reply: false,
          reply_message_id: null,
          status: null,
        },
        conversation: {
          id: 981,
          status_id: 0,
          number_phone_id: "5511999999999",
          empresa_meta_param_id: 7,
        },
        customer: {
          id: 204,
          nome: "Maria da Silva",
          telefone: "5511999999999",
          email: "maria@email.com",
        },
      },
    },
  },
  {
    key: "customer.created",
    label: "Novos clientes",
    description: "Dispara quando um novo cliente e cadastrado no sistema.",
    payload_example: {
      event: "customer.created",
      occurred_at: "2026-07-16T13:44:03.000Z",
      source: "orbita_crm",
      company: { id: 12 },
      data: {
        customer: {
          id: 204,
          nome: "Maria da Silva",
          telefone: "5511999999999",
          email: "maria@email.com",
          cpf: null,
          origem: "manual",
          data_aniversario: null,
          data_cadastro: "2026-07-16T13:44:03.000Z",
          tags: [],
          tags_webhook: [],
          utms: [],
        },
      },
    },
  },
  {
    key: "deal.closed_won",
    label: "Vendas fechadas",
    description: "Dispara quando um negocio e fechado como ganho.",
    payload_example: {
      event: "deal.closed_won",
      occurred_at: "2026-07-16T15:10:00.000Z",
      source: "orbita_crm",
      company: { id: 12 },
      data: {
        deal: {
          id: 551,
          crm_id: 8,
          crm_nome: "Funil Principal",
          etapa_id: 22,
          etapa_codigo: "closed-won",
          etapa_nome: "Fechado Ganho",
          title: "Venda - Maria da Silva",
          amount: 1290.5,
          quantidade_itens: 3,
          sale_origin: "whatsapp",
          created_at: "2026-07-15T18:20:00.000Z",
          entry_date: "2026-07-15T18:20:00.000Z",
          closing_date: "2026-07-16T15:10:00.000Z",
          payment_method: { codigo: "pix", nome: "Pix" },
          installments: 1,
          refusal_reason: null,
          owner: { id: 14, nome: "Carlos Lima" },
          customer: {
            id: 204,
            nome: "Maria da Silva",
            telefone: "5511999999999",
            email: "maria@email.com",
            origem: "whatsapp",
          },
          quote: {
            id: 89,
            title: "Orcamento principal",
            subtotal: 1290.5,
            discount: 0,
            total: 1290.5,
            status: "closed-won",
            notes: "Venda confirmada.",
            items: [],
          },
        },
      },
    },
  },
  {
    key: "deal.closed_lost",
    label: "Vendas perdidas",
    description: "Dispara quando um negocio e fechado como perdido.",
    payload_example: {
      event: "deal.closed_lost",
      occurred_at: "2026-07-16T15:10:00.000Z",
      source: "orbita_crm",
      company: { id: 12 },
      data: {
        deal: {
          id: 552,
          crm_id: 8,
          crm_nome: "Funil Principal",
          etapa_id: 23,
          etapa_codigo: "closed-lost",
          etapa_nome: "Fechado Perdido",
          title: "Venda - Joao Pereira",
          amount: 0,
          quantidade_itens: 2,
          sale_origin: "meta_ads",
          created_at: "2026-07-15T12:00:00.000Z",
          entry_date: "2026-07-15T12:00:00.000Z",
          closing_date: "2026-07-16T15:10:00.000Z",
          payment_method: null,
          installments: null,
          refusal_reason: { codigo: "sem-orcamento", nome: "Sem orcamento" },
          owner: { id: 18, nome: "Juliana Costa" },
          customer: {
            id: 305,
            nome: "Joao Pereira",
            telefone: "5511988887777",
            email: "joao@email.com",
            origem: "meta_ads",
          },
          quote: {
            id: 90,
            title: "Orcamento principal",
            subtotal: 650,
            discount: 0,
            total: 650,
            status: "closed-lost",
            notes: "Cliente desistiu.",
            items: [],
          },
        },
      },
    },
  },
];

const VALID_EVENT_KEYS = new Set(EVENT_CATALOG.map((item) => item.key));
const VALID_SECURITY_LOCATIONS = new Set(["header", "body", "query"]);
const INSTANCE_ID = `${os.hostname()}:${process.pid}`;

function normalizeText(value) {
  const text = String(value || "").trim();
  return text.length ? text : null;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "1", "sim", "on", "ativo"].includes(normalized)) return true;
  if (["false", "0", "nao", "não", "off", "inativo"].includes(normalized)) return false;
  return fallback;
}

function normalizeEvents(events) {
  const input = Array.isArray(events) ? events : [];
  return [...new Set(input.map((item) => String(item || "").trim()).filter((item) => VALID_EVENT_KEYS.has(item)))];
}

function normalizeSecurityLocation(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_SECURITY_LOCATIONS.has(normalized) ? normalized : "header";
}

function normalizeSecurityFieldName(value) {
  const normalized = normalizeText(value);
  return normalized || "x-webhook-codigo";
}

function normalizeObject(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function truncateText(value, max = 12000) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}...[truncated]` : text;
}

function serializeResponseBody(data) {
  if (data === null || data === undefined) return null;
  if (typeof data === "string") return truncateText(data);

  try {
    return truncateText(JSON.stringify(data));
  } catch {
    return truncateText(String(data));
  }
}

function maskSecretValue(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 4) return "****";
  return `${text.slice(0, 2)}****${text.slice(-2)}`;
}

function buildDispatchKey(webhookId, eventKey, entityId, occurredAt) {
  return crypto
    .createHash("md5")
    .update(`${webhookId}:${eventKey}:${entityId || ""}:${occurredAt || ""}`)
    .digest("hex");
}

function normalizeWebhookRow(row = {}) {
  return {
    id: Number(row.id),
    empresa_id: Number(row.empresa_id),
    nome: row.nome || "",
    url: row.url || "",
    security_key: row.security_key || "",
    security_location: normalizeSecurityLocation(row.security_location),
    security_field_name: normalizeSecurityFieldName(row.security_field_name),
    eventos: normalizeEvents(Array.isArray(row.eventos) ? row.eventos : row.eventos || []),
    ativo: Boolean(row.ativo),
    criado_em: row.criado_em ? new Date(row.criado_em).toISOString() : null,
    atualizado_em: row.atualizado_em ? new Date(row.atualizado_em).toISOString() : null,
  };
}

function getEventCatalog() {
  return EVENT_CATALOG.map((item) => ({
    key: item.key,
    label: item.label,
    description: item.description,
    payload_example: item.payload_example,
  }));
}

function validateUrl(url) {
  const normalized = normalizeText(url);
  if (!normalized) throw new Error("Informe a URL do webhook.");

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Informe uma URL valida para o webhook.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("A URL do webhook deve usar http ou https.");
  }

  return parsed.toString();
}

function mapMessageSender(sendBy) {
  const normalized = Number(sendBy);
  if (normalized === 1) return { sender: "cliente", direction: "incoming" };
  if (normalized === 2) return { sender: "atendente", direction: "outgoing" };
  if (normalized === 3) return { sender: "n8n_ia", direction: "outgoing" };
  if (normalized === 4) return { sender: "whatsapp_celular", direction: "outgoing" };
  return { sender: "sistema", direction: "outgoing" };
}

function buildEnvelope(event, companyId, occurredAt, data) {
  return {
    event,
    occurred_at: occurredAt || new Date().toISOString(),
    source: "orbita_crm",
    company: {
      id: Number(companyId),
    },
    data,
  };
}

function buildCustomerEnvelope(row) {
  return buildEnvelope("customer.created", row.empresa_id, row.data_cadastro, {
    customer: {
      id: Number(row.id),
      nome: row.nome || "",
      telefone: row.telefone || "",
      email: row.email || "",
      cpf: row.cpf || null,
      origem: row.origem || null,
      data_aniversario: row.data_aniversario || null,
      data_cadastro: row.data_cadastro ? new Date(row.data_cadastro).toISOString() : null,
      tags: Array.isArray(row.tags) ? row.tags : [],
      tags_webhook: Array.isArray(row.tags_webhook) ? row.tags_webhook : [],
      utms: Array.isArray(row.utms) ? row.utms : [],
    },
  });
}

function buildConversationEnvelope(row) {
  return buildEnvelope("conversation.created", row.empresa_id, row.data_inicio, {
    conversation: {
      id: Number(row.id),
      status_id: row.status_id === null || row.status_id === undefined ? null : Number(row.status_id),
      started_at: row.data_inicio ? new Date(row.data_inicio).toISOString() : null,
      ended_at: row.data_fim ? new Date(row.data_fim).toISOString() : null,
      number_phone_id: row.number_phone_id || null,
      empresa_meta_param_id:
        row.empresa_meta_param_id === null || row.empresa_meta_param_id === undefined
          ? null
          : Number(row.empresa_meta_param_id),
      owner_user_id: row.usuario_id === null || row.usuario_id === undefined ? null : Number(row.usuario_id),
      owner_user_name: row.usuario_nome || null,
      assigned_user_id:
        row.usuario_atribuido_id === null || row.usuario_atribuido_id === undefined
          ? null
          : Number(row.usuario_atribuido_id),
      assigned_user_name: row.usuario_atribuido_nome || null,
    },
    customer: {
      id: row.cliente_id === null || row.cliente_id === undefined ? null : Number(row.cliente_id),
      nome: row.cliente_nome || "",
      telefone: row.cliente_telefone || "",
      email: row.cliente_email || "",
      origem: row.cliente_origem || null,
    },
  });
}

function buildMessageEnvelope(row) {
  const senderInfo = mapMessageSender(row.send_by);

  return buildEnvelope("message.created", row.empresa_id, row.data_mensagem, {
    message: {
      id: Number(row.id),
      conversation_id: Number(row.cliente_conversa_id),
      text: row.mensagem || "",
      type_id: row.tipo_id === null || row.tipo_id === undefined ? null : Number(row.tipo_id),
      media_type: row.media_tipe || null,
      media_id: row.midia_id || null,
      whatsapp_message_id: row.mensagem_whats_id || null,
      direction: senderInfo.direction,
      sender: senderInfo.sender,
      send_by: row.send_by === null || row.send_by === undefined ? null : Number(row.send_by),
      reply: Boolean(row.reply),
      reply_message_id:
        row.mensagem_reply_id === null || row.mensagem_reply_id === undefined
          ? null
          : Number(row.mensagem_reply_id),
      status: row.status || null,
    },
    conversation: {
      id: Number(row.cliente_conversa_id),
      status_id:
        row.conversa_status_id === null || row.conversa_status_id === undefined
          ? null
          : Number(row.conversa_status_id),
      number_phone_id: row.number_phone_id || null,
      empresa_meta_param_id:
        row.empresa_meta_param_id === null || row.empresa_meta_param_id === undefined
          ? null
          : Number(row.empresa_meta_param_id),
    },
    customer: {
      id: row.cliente_id === null || row.cliente_id === undefined ? null : Number(row.cliente_id),
      nome: row.cliente_nome || "",
      telefone: row.cliente_telefone || "",
      email: row.cliente_email || "",
    },
  });
}

function buildDealEnvelope(eventKey, row) {
  return buildEnvelope(
    eventKey,
    row.empresa_id,
    row.data_fechamento_real || row.data_fechamento_prevista || row.data_criacao,
    {
      deal: {
        id: Number(row.id),
        crm_id: row.crm_id === null || row.crm_id === undefined ? null : Number(row.crm_id),
        crm_nome: row.crm_nome || "",
        etapa_id: row.etapa_id === null || row.etapa_id === undefined ? null : Number(row.etapa_id),
        etapa_codigo: row.etapa_codigo || null,
        etapa_nome: row.etapa_nome || null,
        title: row.titulo || "",
        amount:
          eventKey === "deal.closed_won"
            ? Number(row.valor_fechamento || row.valor_estimado || 0)
            : 0,
        quantidade_itens:
          row.quantidade_itens === null || row.quantidade_itens === undefined
            ? null
            : Number(row.quantidade_itens),
        sale_origin: row.origem_venda || null,
        created_at: row.data_criacao ? new Date(row.data_criacao).toISOString() : null,
        entry_date:
          row.data_entrada_pipeline ? new Date(row.data_entrada_pipeline).toISOString() : null,
        closing_date:
          row.data_fechamento_real || row.data_fechamento_prevista
            ? new Date(row.data_fechamento_real || row.data_fechamento_prevista).toISOString()
            : null,
        payment_method: row.forma_pagamento_codigo
          ? {
              codigo: row.forma_pagamento_codigo,
              nome: row.forma_pagamento_nome || row.forma_pagamento_codigo,
            }
          : null,
        installments: row.parcelas === null || row.parcelas === undefined ? null : Number(row.parcelas),
        refusal_reason: row.motivo_perda_codigo
          ? {
              codigo: row.motivo_perda_codigo,
              nome: row.motivo_perda_nome || row.motivo_perda_codigo,
            }
          : null,
        owner: {
          id:
            row.responsavel_usuario_id === null || row.responsavel_usuario_id === undefined
              ? null
              : Number(row.responsavel_usuario_id),
          nome: row.responsavel_nome || null,
        },
        customer: {
          id: row.cliente_id === null || row.cliente_id === undefined ? null : Number(row.cliente_id),
          nome: row.cliente_nome || row.nome_contato || "",
          telefone: row.cliente_telefone || row.telefone || "",
          email: row.cliente_email || row.email || "",
          origem: row.cliente_origem || null,
        },
        quote: row.quote || null,
      },
    }
  );
}

async function deliverWebhook(webhook, envelope) {
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "orbita-crm-webhook/1.0",
    "X-Orbita-Event": envelope.event,
    "X-Orbita-Company-Id": String(envelope.company.id),
    "X-Orbita-Webhook-Id": String(webhook.id),
  };

  let targetUrl = webhook.url;
  let body = envelope;
  const securityLocation = normalizeSecurityLocation(webhook.security_location);
  const securityFieldName = normalizeSecurityFieldName(webhook.security_field_name);
  const securityKey = String(webhook.security_key || "").trim();
  const maskedSecurityKey = maskSecretValue(securityKey);
  const historyHeaders = normalizeObject(headers);
  let historyBody = normalizeObject(body);
  let historyUrl = targetUrl;

  if (securityKey) {
    if (securityLocation === "header") {
      headers[securityFieldName] = securityKey;
      historyHeaders[securityFieldName] = maskedSecurityKey;
    } else if (securityLocation === "query") {
      const parsedUrl = new URL(targetUrl);
      parsedUrl.searchParams.set(securityFieldName, securityKey);
      targetUrl = parsedUrl.toString();
      parsedUrl.searchParams.set(securityFieldName, maskedSecurityKey);
      historyUrl = parsedUrl.toString();
    } else {
      body = {
        [securityFieldName]: securityKey,
        ...envelope,
      };
      historyBody = {
        [securityFieldName]: maskedSecurityKey,
        ...normalizeObject(envelope),
      };
    }
  }

  await assertPublicHttpUrl(targetUrl);
  const response = await axios.post(targetUrl, body, {
    timeout: 10000,
    headers,
    maxBodyLength: Infinity,
    maxRedirects: 0,
  });

  return {
    response,
    historySnapshot: {
      request_url: historyUrl,
      request_headers: historyHeaders,
      request_body: historyBody,
    },
  };
}

async function claimWebhookHistory({
  empresaId,
  webhookId,
  eventKey,
  entityId,
  dispatchKey,
  requestUrl,
  requestHeaders,
  requestBody,
}) {
  const client = await postgres.connect();
  try {
    const ret = await client.query(models.claim_webhook_history(), [
      empresaId,
      webhookId,
      eventKey,
      entityId,
      dispatchKey,
      requestUrl,
      JSON.stringify(requestHeaders || {}),
      JSON.stringify(requestBody || {}),
      INSTANCE_ID,
    ]);

    return ret.rows?.[0]?.id ? Number(ret.rows[0].id) : null;
  } finally {
    client.release();
  }
}

async function finishWebhookHistorySuccess(historyId, response) {
  const client = await postgres.connect();
  try {
    await client.query(models.finish_webhook_history_success(), [
      historyId,
      response?.status || null,
      JSON.stringify(normalizeObject(response?.headers)),
      serializeResponseBody(response?.data),
    ]);
  } finally {
    client.release();
  }
}

async function finishWebhookHistoryError(historyId, error) {
  const client = await postgres.connect();
  try {
    await client.query(models.finish_webhook_history_error(), [
      historyId,
      error?.response?.status || null,
      JSON.stringify(normalizeObject(error?.response?.headers)),
      serializeResponseBody(error?.response?.data),
      truncateText(error?.message || error),
    ]);
  } finally {
    client.release();
  }
}

function normalizeWebhookHistoryRow(row = {}) {
  return {
    id: Number(row.id),
    empresa_id: Number(row.empresa_id),
    webhook_id: Number(row.webhook_id),
    webhook_nome: row.webhook_nome || "",
    event_key: row.event_key || "",
    entity_id: row.entity_id === null || row.entity_id === undefined ? null : Number(row.entity_id),
    dispatch_key: row.dispatch_key || "",
    request_url: row.request_url || "",
    request_headers: normalizeObject(row.request_headers),
    request_body: normalizeObject(row.request_body),
    response_status:
      row.response_status === null || row.response_status === undefined
        ? null
        : Number(row.response_status),
    response_headers: normalizeObject(row.response_headers),
    response_body: row.response_body || null,
    status: row.status || "processing",
    error_message: row.error_message || null,
    instance_id: row.instance_id || null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    finished_at: row.finished_at ? new Date(row.finished_at).toISOString() : null,
  };
}

async function dispatchByQuery(entityId, eventKey, queryFactory, buildEnvelopeFn) {
  if (!entityId || !VALID_EVENT_KEYS.has(eventKey)) return;

  const client = await postgres.connect();
  let row = null;
  let hooks = [];
  try {
    const payloadRet = await client.query(queryFactory(), [entityId]);
    row = payloadRet.rows?.[0] || null;
    if (!row?.empresa_id) return;

    const hooksRet = await client.query(models.list_active_webhooks_by_event(), [
      row.empresa_id,
      eventKey,
    ]);
    hooks = (hooksRet.rows || []).map(normalizeWebhookRow);
  } finally {
    client.release();
  }

  if (!row?.empresa_id || !hooks.length) return;

  const envelope = buildEnvelopeFn(row);

  for (const webhook of hooks) {
    let historyId = null;

    try {
      const dispatchKey = buildDispatchKey(webhook.id, eventKey, entityId, envelope.occurred_at);
      const preview = await deliverWebhookPreview(webhook, envelope);
      historyId = await claimWebhookHistory({
        empresaId: row.empresa_id,
        webhookId: webhook.id,
        eventKey,
        entityId,
        dispatchKey,
        requestUrl: preview.historySnapshot.request_url,
        requestHeaders: preview.historySnapshot.request_headers,
        requestBody: preview.historySnapshot.request_body,
      });

      if (!historyId) continue;

      const sent = await deliverWebhook(webhook, envelope);
      await finishWebhookHistorySuccess(historyId, sent.response);
    } catch (error) {
      if (historyId) {
        await finishWebhookHistoryError(historyId, error);
      }

      console.error("[developer-webhook] falha ao enviar evento:", {
        webhook_id: webhook.id,
        webhook_nome: webhook.nome,
        event: eventKey,
        url: webhook.url,
        error: error?.message || error,
      });
    }
  }
}

async function deliverWebhookPreview(webhook, envelope) {
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "orbita-crm-webhook/1.0",
    "X-Orbita-Event": envelope.event,
    "X-Orbita-Company-Id": String(envelope.company.id),
    "X-Orbita-Webhook-Id": String(webhook.id),
  };

  let targetUrl = webhook.url;
  let body = normalizeObject(envelope);
  const securityLocation = normalizeSecurityLocation(webhook.security_location);
  const securityFieldName = normalizeSecurityFieldName(webhook.security_field_name);
  const securityKey = String(webhook.security_key || "").trim();
  const maskedSecurityKey = maskSecretValue(securityKey);
  const historyHeaders = normalizeObject(headers);

  if (securityKey) {
    if (securityLocation === "header") {
      historyHeaders[securityFieldName] = maskedSecurityKey;
    } else if (securityLocation === "query") {
      const parsedUrl = new URL(targetUrl);
      parsedUrl.searchParams.set(securityFieldName, maskedSecurityKey);
      targetUrl = parsedUrl.toString();
    } else {
      body = {
        [securityFieldName]: maskedSecurityKey,
        ...normalizeObject(envelope),
      };
    }
  }

  return {
    historySnapshot: {
      request_url: targetUrl,
      request_headers: historyHeaders,
      request_body: body,
    },
  };
}

function fireAndForget(task) {
  setImmediate(() => {
    task().catch((error) => {
      console.error("[developer-webhook] erro ao processar fila:", error);
    });
  });
}

const execute = {
  getEventCatalog,

  listWebhooks: async (empresaId) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_webhooks_by_empresa(), [empresaId]);
      return (ret.rows || []).map(normalizeWebhookRow);
    } finally {
      client.release();
    }
  },

  saveWebhook: async ({
    empresaId,
    id = null,
    nome,
    url,
    securityKey,
    securityLocation,
    securityFieldName,
    eventos,
    ativo = true,
  }) => {
    const normalizedName = normalizeText(nome);
    if (!normalizedName) throw new Error("Informe o nome do webhook.");

    const normalizedUrl = validateUrl(url);
    const normalizedSecurityKey = normalizeText(securityKey);
    if (!normalizedSecurityKey) {
      throw new Error("Informe a chave de seguranca do webhook.");
    }
    const normalizedSecurityLocation = normalizeSecurityLocation(securityLocation);
    const normalizedSecurityFieldName = normalizeSecurityFieldName(securityFieldName);
    if (!normalizedSecurityFieldName) {
      throw new Error("Informe como a chave deve ser enviada ao destino.");
    }
    const normalizedEvents = normalizeEvents(eventos);
    if (!normalizedEvents.length) {
      throw new Error("Selecione ao menos um tipo de evento para o webhook.");
    }

    const client = await postgres.connect();
    try {
      if (id) {
        const ret = await client.query(models.update_webhook(), [
          id,
          empresaId,
          normalizedName,
          normalizedUrl,
          normalizedSecurityKey,
          normalizedSecurityLocation,
          normalizedSecurityFieldName,
          JSON.stringify(normalizedEvents),
          normalizeBoolean(ativo, true),
        ]);
        if (!ret.rows?.length) {
          throw new Error("Webhook de desenvolvedor nao encontrado para esta empresa.");
        }
        return normalizeWebhookRow(ret.rows[0]);
      }

      const ret = await client.query(models.insert_webhook(), [
        empresaId,
        normalizedName,
        normalizedUrl,
        normalizedSecurityKey,
        normalizedSecurityLocation,
        normalizedSecurityFieldName,
        JSON.stringify(normalizedEvents),
        normalizeBoolean(ativo, true),
      ]);
      return normalizeWebhookRow(ret.rows[0]);
    } finally {
      client.release();
    }
  },

  deleteWebhook: async (empresaId, id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.delete_webhook(), [id, empresaId]);
      return Boolean(ret.rows?.length);
    } finally {
      client.release();
    }
  },

  listWebhookHistory: async (empresaId, webhookId, limit = 50) => {
    const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_webhook_history(), [
        empresaId,
        webhookId,
        normalizedLimit,
      ]);
      return (ret.rows || []).map(normalizeWebhookHistoryRow);
    } finally {
      client.release();
    }
  },

  queueCustomerCreated: (customerId) => {
    fireAndForget(async () => {
      await dispatchByQuery(
        customerId,
        "customer.created",
        models.get_customer_payload_by_id,
        buildCustomerEnvelope
      );
    });
  },

  queueConversationCreated: (conversationId) => {
    fireAndForget(async () => {
      await dispatchByQuery(
        conversationId,
        "conversation.created",
        models.get_conversation_payload_by_id,
        buildConversationEnvelope
      );
    });
  },

  queueMessageCreated: (messageId) => {
    fireAndForget(async () => {
      await dispatchByQuery(
        messageId,
        "message.created",
        models.get_message_payload_by_id,
        buildMessageEnvelope
      );
    });
  },

  queueDealClosed: (dealId, eventKey) => {
    if (!["deal.closed_won", "deal.closed_lost"].includes(eventKey)) return;

    fireAndForget(async () => {
      await dispatchByQuery(dealId, eventKey, models.get_deal_payload_by_id, (row) =>
        buildDealEnvelope(eventKey, row)
      );
    });
  },
};

module.exports = execute;
