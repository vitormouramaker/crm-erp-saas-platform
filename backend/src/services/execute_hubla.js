const crypto = require("crypto");
const security = require("../security/cypher");
const hublaModels = require("../models/models_hubla");
const userModels = require("../models/models_user");
const webhookClienteModels = require("../models/models_webhook_cliente");
const { postgres } = require("../server/connect");
const developerWebhooks = require("./execute_developer_webhooks");
const financeiro = require("./execute_financeiro");
const { notifyCommercialIntegrationUpdate } = require("../server/realtime");
const { isRuntimeSchemaEnsureEnabled } = require("../utils/runtime_schema");

const RUNTIME_SCHEMA_ENSURE_HUBLA = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SCHEMA_ENSURE_HUBLA"
);
const RUNTIME_SEED_HUBLA_INTEGRATION = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SEED_HUBLA_INTEGRATION"
);
const HUBLA_UTM_FIELDS = new Set([
  "source",
  "medium",
  "campaign",
  "content",
  "term",
]);

function normalizeNullableText(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeEmail(value) {
  const normalized = normalizeNullableText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeImportPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;

  const withoutInternationalPrefix = digits.startsWith("00")
    ? digits.slice(2)
    : digits;
  const normalized = withoutInternationalPrefix.startsWith("55")
    ? withoutInternationalPrefix
    : `55${withoutInternationalPrefix}`;

  return normalized || null;
}

function buildPhoneLookupCandidates(value) {
  const normalized = normalizeImportPhone(value);
  if (!normalized) return [];

  const candidates = new Set([normalized]);

  if (/^55\d{2}9\d{8}$/.test(normalized)) {
    candidates.add(`${normalized.slice(0, 4)}${normalized.slice(5)}`);
  } else if (/^55\d{10}$/.test(normalized)) {
    candidates.add(`${normalized.slice(0, 4)}9${normalized.slice(4)}`);
  }

  return [...candidates];
}

function normalizeTagList(tags = []) {
  return [...new Set(
    tags
      .map((item) => normalizeNullableText(item))
      .filter(Boolean)
  )];
}

function normalizeLookupKey(value) {
  const normalized = normalizeNullableText(value);
  return normalized ? normalized.trim().toUpperCase() : null;
}

function getNestedValue(input, path) {
  let current = input;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

function pickFirstValue(input, paths = []) {
  for (const path of paths) {
    const value = getNestedValue(input, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function joinPersonName(firstName, lastName) {
  return [normalizeNullableText(firstName), normalizeNullableText(lastName)]
    .filter(Boolean)
    .join(" ") || null;
}

function extractHublaUtm(payload = {}) {
  const pathsFor = (field) => [
    ["event", "invoice", "paymentSession", "utm", field],
    ["event", "lead", "session", "utm", field],
    ["event", "session", "utm", field],
    ["event", "utm", field],
    ["data", "utm", field],
    ["utm", field],
    [`utm_${field}`],
  ];

  return Object.fromEntries(
    [...HUBLA_UTM_FIELDS].map((field) => [
      field,
      normalizeNullableText(pickFirstValue(payload, pathsFor(field))),
    ])
  );
}

function detectEventType(payload = {}) {
  const raw =
    normalizeNullableText(payload?.type) ||
    normalizeNullableText(payload?.event_type) ||
    normalizeNullableText(payload?.topic) ||
    normalizeNullableText(payload?.name) ||
    normalizeNullableText(payload?.subscription_event) ||
    normalizeNullableText(payload?.event?.type) ||
    normalizeNullableText(payload?.event?.event_type) ||
    normalizeNullableText(payload?.event?.name) ||
    null;

  return raw ? raw.toUpperCase().replace(/\s+/g, "_") : "UNKNOWN_EVENT";
}

function detectPurchaseStatus(payload = {}) {
  const raw = pickFirstValue(payload, [
    ["event", "subscription", "status"],
    ["event", "invoice", "status"],
    ["event", "payment", "status"],
    ["data", "purchase", "status"],
    ["purchase", "status"],
    ["data", "subscription", "status"],
    ["subscription", "status"],
    ["status"],
  ]);

  return normalizeNullableText(raw)
    ? String(raw).trim().toUpperCase().replace(/\s+/g, "_")
    : null;
}

function classifyHublaEvent(eventType, purchaseStatus) {
  const normalizedEvent = String(eventType || "UNKNOWN_EVENT").toUpperCase();
  const normalizedStatus = String(purchaseStatus || "").toUpperCase();

  if (normalizedEvent.includes("CART") || normalizedEvent.includes("ABANDON")) {
    return "carrinho_abandonado";
  }

  if (
    ["REFUNDED", "CHARGEBACK", "CANCELLED", "CANCELED", "EXPIRED"].includes(
      normalizedStatus
    ) ||
    normalizedEvent.includes("REFUND") ||
    normalizedEvent.includes("CHARGEBACK")
  ) {
    return "reembolsos";
  }

  if (
    ["OVERDUE", "NO_FUNDS", "BLOCKED"].includes(normalizedStatus) ||
    normalizedEvent.includes("SUBSCRIPTION") ||
    normalizedEvent.includes("PLAN") ||
    normalizedEvent.includes("BILLING")
  ) {
    return "assinaturas";
  }

  if (
    normalizedEvent === "INVOICE.PAYMENT_SUCCEEDED" ||
    normalizedEvent === "INVOICE.PAYMENT_FAILED"
  ) {
    return "vendas";
  }

  return "outros";
}

function shouldProcessCategory(integracao, categoriaEvento) {
  if (categoriaEvento === "carrinho_abandonado") {
    return Boolean(integracao.sincronizar_carrinho_abandonado);
  }
  if (categoriaEvento === "assinaturas") {
    return Boolean(integracao.sincronizar_assinaturas);
  }
  if (categoriaEvento === "reembolsos") {
    return Boolean(integracao.sincronizar_reembolsos);
  }
  if (categoriaEvento === "vendas") {
    return Boolean(integracao.sincronizar_vendas);
  }
  return false;
}

function shouldNotifyHublaEvent(summary) {
  if (summary?.categoriaEvento === "carrinho_abandonado") return true;
  return (
    summary?.categoriaEvento === "vendas" &&
    summary?.tipoEvento === "INVOICE.PAYMENT_SUCCEEDED"
  );
}

async function syncHublaReceivable(client, integracao, evento, summary, shouldProcess) {
  if (
    !shouldProcess ||
    summary?.tipoEvento !== "INVOICE.PAYMENT_SUCCEEDED" ||
    summary?.categoriaEvento !== "vendas"
  ) {
    return;
  }

  try {
    await financeiro.execute_sincronizar_recebivel_venda(
      {
        empresa_id: integracao.empresa_id,
        cliente_id: evento?.cliente_id,
        usuario_id: evento?.vendedor_usuario_id,
        origem: "hubla",
        referencia: summary.transacaoId || evento?.id,
        descricao: `Venda Hubla - ${summary.produtoNome || summary.clienteNome}`,
        valor:
          summary.valorCentavos === null ? null : Number(summary.valorCentavos) / 100,
        data_venda: summary.dataEvento,
        recebido: true,
        meio_pagamento: "hubla",
      },
      client
    );
  } catch (error) {
    console.error("[hubla][financeiro] falha ao sincronizar conta a receber:", {
      empresa_id: integracao.empresa_id,
      evento_id: evento?.id,
      transacao_id: summary.transacaoId,
      message: error.message,
    });
  }
}

function extractHublaSummary(payload = {}) {
  const eventType = detectEventType(payload);
  const purchaseStatus = detectPurchaseStatus(payload);
  const categoriaEvento = classifyHublaEvent(eventType, purchaseStatus);

  const clienteTelefone = pickFirstValue(payload, [
    ["event", "invoice", "payer", "phone"],
    ["event", "user", "phone"],
    ["event", "lead", "phone"],
    ["event", "customer", "phone"],
    ["event", "buyer", "phone"],
    ["event", "member", "phone"],
    ["event", "subscription", "customer", "phone"],
    ["data", "buyer", "phone"],
    ["data", "purchase", "buyer", "phone"],
    ["data", "purchase", "shopper", "phone"],
    ["data", "subscriber", "phone"],
    ["buyer", "phone"],
    ["phone"],
  ]);
  const clienteEmail = pickFirstValue(payload, [
    ["event", "invoice", "payer", "email"],
    ["event", "user", "email"],
    ["event", "lead", "email"],
    ["event", "customer", "email"],
    ["event", "buyer", "email"],
    ["event", "member", "email"],
    ["event", "subscription", "customer", "email"],
    ["data", "buyer", "email"],
    ["data", "purchase", "buyer", "email"],
    ["data", "purchase", "shopper", "email"],
    ["data", "subscriber", "email"],
    ["buyer", "email"],
    ["email"],
  ]);
  const clienteNomeDireto = pickFirstValue(payload, [
    ["event", "invoice", "payer", "fullName"],
    ["event", "user", "fullName"],
    ["event", "lead", "fullName"],
    ["event", "customer", "name"],
    ["event", "buyer", "name"],
    ["event", "member", "name"],
    ["event", "subscription", "customer", "name"],
    ["data", "buyer", "name"],
    ["data", "purchase", "buyer", "name"],
    ["data", "purchase", "shopper", "name"],
    ["data", "subscriber", "name"],
    ["buyer", "name"],
    ["name"],
  ]);
  const clienteNome =
    clienteNomeDireto ||
    joinPersonName(
      pickFirstValue(payload, [
        ["event", "invoice", "payer", "firstName"],
        ["event", "user", "firstName"],
        ["event", "lead", "firstName"],
      ]),
      pickFirstValue(payload, [
        ["event", "invoice", "payer", "lastName"],
        ["event", "user", "lastName"],
        ["event", "lead", "lastName"],
      ])
    );
  const produtoNome = pickFirstValue(payload, [
    ["event", "product", "name"],
    ["event", "products", 0, "name"],
    ["event", "products", 0, "offers", 0, "name"],
    ["event", "offer", "name"],
    ["event", "subscription", "product", "name"],
    ["data", "product", "name"],
    ["data", "purchase", "product", "name"],
    ["product", "name"],
    ["data", "offer", "name"],
    ["offer", "name"],
  ]);
  const produtoCodigo = pickFirstValue(payload, [
    ["event", "product", "id"],
    ["event", "products", 0, "id"],
    ["event", "product", "code"],
    ["event", "offer", "id"],
    ["event", "subscription", "product", "id"],
    ["data", "product", "id"],
    ["data", "product", "ucode"],
    ["data", "purchase", "product", "id"],
    ["data", "offer", "code"],
    ["offer", "code"],
    ["product", "id"],
  ]);
  const ofertaCodigo = pickFirstValue(payload, [
    ["event", "products", 0, "offers", 0, "id"],
    ["event", "products", 0, "offers", 0, "code"],
    ["event", "offer", "code"],
    ["event", "offer", "id"],
    ["data", "offer", "code"],
    ["offer", "code"],
    ["data", "purchase", "offer", "code"],
  ]);
  const transacaoId = pickFirstValue(payload, [
    ["event", "invoice", "id"],
    ["event", "refund", "invoice", "id"],
    ["event", "refund", "invoiceId"],
    ["event", "refund", "originalInvoiceId"],
    ["event", "refundRequest", "invoiceId"],
    ["event", "invoiceId"],
    ["event", "payment", "id"],
    ["event", "order", "id"],
    ["event", "subscription", "id"],
    ["event", "lead", "id"],
    ["data", "purchase", "transaction"],
    ["data", "purchase", "order_id"],
    ["data", "purchase", "id"],
    ["purchase", "transaction"],
    ["purchase", "order_id"],
    ["id"],
  ]);
  const valorCentavos = pickFirstValue(payload, [
    ["event", "invoice", "amount", "subtotalCents"],
    ["event", "invoice", "amount", "totalCents"],
    ["event", "lead", "amount", "totalCents"],
    ["event", "products", 0, "offers", 0, "amountCents"],
  ]);
  const dataEvento = pickFirstValue(payload, [
    ["event", "invoice", "saleDate"],
    ["event", "invoice", "modifiedAt"],
    ["event", "lead", "createdAt"],
    ["event", "createdAt"],
  ]);
  const utm = extractHublaUtm(payload);
  const origemUtm = utm.source;

  return {
    tipoEvento: eventType,
    categoriaEvento,
    statusCompra: purchaseStatus,
    clienteNome:
      normalizeNullableText(clienteNome) ||
      normalizeEmail(clienteEmail) ||
      normalizeImportPhone(clienteTelefone) ||
      "Cliente Hubla",
    clienteEmail: normalizeEmail(clienteEmail),
    clienteTelefone: normalizeNullableText(clienteTelefone),
    clienteTelefoneNormalizado: normalizeImportPhone(clienteTelefone),
    produtoNome: normalizeNullableText(produtoNome),
    produtoCodigo: normalizeNullableText(produtoCodigo),
    ofertaCodigo: normalizeNullableText(ofertaCodigo),
    produtoChave:
      normalizeNullableText(produtoCodigo) ||
      normalizeLookupKey(produtoNome),
    transacaoId: normalizeNullableText(transacaoId),
    valorCentavos:
      valorCentavos === null || !Number.isFinite(Number(valorCentavos))
        ? null
        : Number(valorCentavos),
    dataEvento: normalizeNullableText(dataEvento),
    utm,
    origemUtm: normalizeNullableText(origemUtm),
    origemLead: normalizeNullableText(origemUtm) || "hubla",
  };
}

function buildPayloadHash(payload = {}, idempotencyKey = null) {
  const idempotency = normalizeNullableText(idempotencyKey);
  return crypto
    .createHash("sha256")
    .update(idempotency || JSON.stringify(payload || {}))
    .digest("hex");
}

function buildHublaHistoryItem(summary, payload = {}) {
  return {
    source: "hubla",
    event_type: summary.tipoEvento,
    event_category: summary.categoriaEvento,
    purchase_status: summary.statusCompra,
    transaction_id: summary.transacaoId,
    product_name: summary.produtoNome,
    product_code: summary.produtoCodigo,
    offer_code: summary.ofertaCodigo,
    product_key: summary.produtoChave,
    amount_cents: summary.valorCentavos,
    event_date: summary.dataEvento,
    lead_origin: summary.origemLead,
    payload_reference: {
      buyer_email: summary.clienteEmail,
      buyer_phone: summary.clienteTelefoneNormalizado || summary.clienteTelefone,
    },
    raw_event: payload?.event || payload?.type || null,
    data_recebimento: new Date().toISOString(),
  };
}

function buildHublaTags(summary) {
  return normalizeTagList([
    "hubla",
    `hubla:${summary.categoriaEvento}`,
    summary.categoriaEvento === "carrinho_abandonado"
      ? "carrinho abandonado"
      : null,
    summary.statusCompra ? `hubla:${String(summary.statusCompra).toLowerCase()}` : null,
  ]);
}

async function ensureClienteTags(client, empresaId, clienteId, tags = []) {
  const normalizedTags = normalizeTagList(tags);
  for (const tagName of normalizedTags) {
    const tagRet = await client.query(webhookClienteModels.upsert_tag_por_nome(), [
      tagName,
      empresaId,
    ]);
    const tag = tagRet.rows?.[0] || null;
    if (!tag?.id) continue;

    await client.query(webhookClienteModels.vincular_tag_cliente(), [tag.id, clienteId]);
  }
}

async function appendClienteHistory(client, clienteId, item) {
  if (!clienteId || !item) return;
  await client.query(webhookClienteModels.append_cliente_utms_historico(), [
    clienteId,
    JSON.stringify([item]),
  ]);
}

async function upsertClienteFromHubla(client, integracao, summary, payload) {
  const email = normalizeEmail(summary.clienteEmail);
  const telefone = summary.clienteTelefoneNormalizado;
  const origemLead = normalizeNullableText(summary.origemLead) || "hubla";
  const telefoneCandidates = buildPhoneLookupCandidates(telefone || summary.clienteTelefone);

  if (!email && !telefoneCandidates.length) {
    return {
      cliente: null,
      linked: false,
      created: false,
      message: "Telefone e e-mail nao encontrados no payload da Hubla.",
    };
  }

  const existingRet = await client.query(userModels.get_cliente_by_email_or_phone_importacao(), [
    integracao.empresa_id,
    email,
    telefoneCandidates.length ? telefoneCandidates : null,
  ]);
  let cliente = existingRet.rows?.[0] || null;

  if (cliente) {
    if (!integracao.vincular_clientes_existentes) {
      return {
        cliente: null,
        linked: false,
        created: false,
        message: "Evento recebido, mas o vinculo automatico com clientes existentes esta desativado.",
      };
    }

    const telefoneAtualNormalizado = normalizeImportPhone(cliente.telefone);
    const manterTelefoneAtual =
      telefoneAtualNormalizado && telefoneCandidates.includes(telefoneAtualNormalizado);
    const updatedRet = await client.query(userModels.update_cliente_importacao(), [
      cliente.id,
      summary.clienteNome || cliente.nome,
      manterTelefoneAtual ? cliente.telefone : telefone || cliente.telefone,
      email || cliente.email,
      cliente.data_aniversario || null,
      origemLead,
    ]);
    cliente = updatedRet.rows?.[0] || cliente;
    if (summary.origemUtm) {
      const originRet = await client.query(userModels.update_cliente_origem_integracao(), [
        cliente.id,
        summary.origemUtm,
        integracao.empresa_id,
      ]);
      cliente = originRet.rows?.[0] || cliente;
    }
  } else {
    if (!integracao.criar_clientes_automaticamente) {
      return {
        cliente: null,
        linked: false,
        created: false,
        message: "Cliente nao encontrado e a criacao automatica esta desativada.",
      };
    }

    const createdRet = await client.query(userModels.create_cliente_importacao(), [
      summary.clienteNome || "Cliente Hubla",
      telefone,
      email,
      integracao.empresa_id,
      JSON.stringify([]),
      null,
      origemLead,
    ]);
    cliente = createdRet.rows?.[0] || null;
    if (cliente?.id) {
      developerWebhooks.queueCustomerCreated(cliente.id);
    }
  }

  if (cliente?.id) {
    await appendClienteHistory(
      client,
      cliente.id,
      buildHublaHistoryItem(summary, payload)
    );
    await ensureClienteTags(
      client,
      integracao.empresa_id,
      cliente.id,
      buildHublaTags(summary)
    );
  }

  return {
    cliente,
    linked: Boolean(cliente?.id),
    created: Boolean(cliente?.id && !existingRet.rows?.[0]),
    message: cliente?.id
      ? existingRet.rows?.[0]
        ? "Cliente existente vinculado com sucesso."
        : "Novo cliente criado a partir do evento Hubla."
      : "Nao foi possivel vincular o cliente.",
  };
}

async function resolveHublaProductMap(client, empresaId, summary) {
  if (!summary?.produtoChave) return null;
  const ret = await client.query(hublaModels.get_hubla_produto_map_by_key(), [
    empresaId,
    summary.produtoChave,
  ]);
  return ret.rows?.[0] || null;
}

async function hasHublaUtmSellerTable(client) {
  const ret = await client.query(
    "select to_regclass('public.empresa_hubla_utm_vendedor') as table_name"
  );
  return Boolean(ret.rows?.[0]?.table_name);
}

async function resolveHublaUtmSeller(client, empresaId, summary) {
  if (summary?.categoriaEvento !== "vendas" || !summary?.utm) return null;
  if (!(await hasHublaUtmSellerTable(client))) return null;

  const ret = await client.query(hublaModels.get_hubla_vendedor_for_utm(), [
    empresaId,
    summary.utm.source,
    summary.utm.medium,
    summary.utm.campaign,
    summary.utm.content,
    summary.utm.term,
  ]);
  return ret.rows?.[0] || null;
}

function mapDetectedProduct(row) {
  return {
    hubla_product_key: row.hubla_product_key || "",
    hubla_product_id: row.hubla_product_id || "",
    hubla_offer_code: row.hubla_offer_code || "",
    hubla_product_name: row.hubla_product_name || "",
    total_eventos: Number(row.total_eventos || 0),
    ultimo_recebimento_em: row.ultimo_recebimento_em || null,
    ultimo_tipo_evento: row.ultimo_tipo_evento || "",
    ultimo_status_compra: row.ultimo_status_compra || "",
    comercial_produto_id:
      row.comercial_produto_id === null || row.comercial_produto_id === undefined
        ? null
        : Number(row.comercial_produto_id),
    comercial_produto_nome: row.comercial_produto_nome || "",
    comercial_produto_preco_base:
      row.comercial_produto_preco_base === null ||
      row.comercial_produto_preco_base === undefined
        ? null
        : Number(row.comercial_produto_preco_base),
  };
}

function mapIntegrationRow(row, webhookUrl = null) {
  if (!row) return null;

  return {
    id: Number(row.id),
    empresa_id: Number(row.empresa_id),
    webhook_public_id: String(row.webhook_public_id || ""),
    webhook_url: webhookUrl || null,
    ativo: Boolean(row.ativo),
    hubla_token_configurado: Boolean(normalizeNullableText(row.hubla_token)),
    sincronizar_vendas: Boolean(row.sincronizar_vendas),
    sincronizar_carrinho_abandonado: Boolean(row.sincronizar_carrinho_abandonado),
    sincronizar_assinaturas: Boolean(row.sincronizar_assinaturas),
    sincronizar_reembolsos: Boolean(row.sincronizar_reembolsos),
    vincular_clientes_existentes: Boolean(row.vincular_clientes_existentes),
    criar_clientes_automaticamente: Boolean(row.criar_clientes_automaticamente),
    ultimo_evento_em: row.ultimo_evento_em || null,
    ultimo_evento_tipo: row.ultimo_evento_tipo || null,
    ultima_sincronizacao_em: row.ultima_sincronizacao_em || null,
    updated_at: row.updated_at || null,
  };
}

const execute = {
  execute_ensure_hubla_schema: async (client) => {
    if (!RUNTIME_SCHEMA_ENSURE_HUBLA) {
      return;
    }

    await client.query(hublaModels.ensure_hubla_integracao_table());
    await client.query(hublaModels.ensure_hubla_integracao_empresa_unique());
    await client.query(hublaModels.ensure_hubla_integracao_webhook_unique());
    await client.query(hublaModels.ensure_hubla_integracao_empresa_fk());
    await client.query(hublaModels.ensure_hubla_evento_table());
    await client.query(hublaModels.ensure_hubla_evento_unique());
    await client.query(hublaModels.ensure_hubla_evento_empresa_idx());
    await client.query(hublaModels.ensure_hubla_evento_cliente_idx());
    await client.query(hublaModels.ensure_hubla_evento_vendedor_column());
    await client.query(hublaModels.ensure_hubla_evento_vendedor_idx());
    await client.query(hublaModels.ensure_hubla_evento_empresa_fk());
    await client.query(hublaModels.ensure_hubla_evento_integracao_fk());
    await client.query(hublaModels.ensure_hubla_evento_cliente_fk());
    await client.query(hublaModels.ensure_hubla_evento_vendedor_fk());
    await client.query(hublaModels.ensure_hubla_produto_map_table());
    await client.query(hublaModels.ensure_hubla_produto_map_unique());
    await client.query(hublaModels.ensure_hubla_produto_map_empresa_fk());
    await client.query(hublaModels.ensure_hubla_produto_map_comercial_produto_fk());
    await client.query(hublaModels.ensure_hubla_utm_vendedor_table());
    await client.query(hublaModels.ensure_hubla_utm_vendedor_unique());
    await client.query(hublaModels.ensure_hubla_utm_vendedor_lookup_idx());
  },

  execute_ensure_hubla_integracao: async (empresaId) => {
    const client = await postgres.connect();
    try {
      await execute.execute_ensure_hubla_schema(client);
      if (!RUNTIME_SEED_HUBLA_INTEGRATION) {
        const existingRet = await client.query(
          hublaModels.get_hubla_integracao_by_empresa(),
          [empresaId]
        );
        return existingRet.rows?.[0] || null;
      }
      const ret = await client.query(hublaModels.ensure_hubla_integracao(), [empresaId]);
      return ret.rows?.[0] || null;
    } finally {
      client.release();
    }
  },

  execute_get_hubla_integracao_overview: async (empresaId) => {
    const client = await postgres.connect();
    try {
      await execute.execute_ensure_hubla_schema(client);

      const integrationRet = await client.query(
        hublaModels.get_hubla_integracao_by_empresa(),
        [empresaId]
      );
      if (!integrationRet.rows?.[0]) {
        await client.query(hublaModels.ensure_hubla_integracao(), [empresaId]);
      }
      const resolvedIntegrationRet = integrationRet.rows?.[0]
        ? integrationRet
        : await client.query(hublaModels.get_hubla_integracao_by_empresa(), [empresaId]);
      const summaryRet = await client.query(hublaModels.get_hubla_eventos_summary(), [
        empresaId,
      ]);
      const eventsRet = await client.query(hublaModels.get_hubla_eventos_recentes(), [
        empresaId,
        20,
      ]);
      const produtosRet = await client.query(hublaModels.list_hubla_produtos_detectados(), [
        empresaId,
      ]);
      const vendedoresRet = await client.query(hublaModels.list_hubla_vendedores(), [
        empresaId,
      ]);
      const regrasUtmRet = (await hasHublaUtmSellerTable(client))
        ? await client.query(hublaModels.list_hubla_utm_vendedor_rules(), [empresaId])
        : { rows: [] };

      return {
        integracao: resolvedIntegrationRet.rows?.[0] || null,
        summary: summaryRet.rows?.[0] || null,
        eventos: eventsRet.rows || [],
        produtosDetectados: (produtosRet.rows || []).map(mapDetectedProduct),
        vendedores: vendedoresRet.rows || [],
        regrasUtmVendedor: regrasUtmRet.rows || [],
      };
    } finally {
      client.release();
    }
  },

  execute_save_hubla_product_map: async ({
    empresa_id,
    hubla_product_key,
    hubla_product_id,
    hubla_offer_code,
    hubla_product_name,
    comercial_produto_id,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      await execute.execute_ensure_hubla_schema(client);

      const empresaId = Number(empresa_id || 0);
      const comercialProdutoId = Number(comercial_produto_id || 0);
      const productKey =
        normalizeNullableText(hubla_product_key) ||
        normalizeLookupKey(hubla_product_name);
      const productName =
        normalizeNullableText(hubla_product_name) ||
        normalizeNullableText(hubla_product_id) ||
        productKey;

      if (!empresaId) throw new Error("Empresa invalida para vincular produto Hubla.");
      if (!productKey) throw new Error("Produto Hubla invalido para vinculacao.");
      if (!comercialProdutoId) {
        throw new Error("Selecione um produto comercial valido para o vinculo.");
      }

      const productRet = await client.query(hublaModels.get_comercial_produto_by_id(), [
        comercialProdutoId,
        empresaId,
      ]);
      const comercialProduto = productRet.rows?.[0] || null;
      if (!comercialProduto?.id || comercialProduto.ativo === false) {
        throw new Error("Produto comercial nao encontrado para esta empresa.");
      }

      await client.query(hublaModels.upsert_hubla_produto_map(), [
        empresaId,
        productKey,
        normalizeNullableText(hubla_product_id),
        normalizeNullableText(hubla_offer_code),
        productName,
        comercialProdutoId,
      ]);

      await client.query("COMMIT");
      return comercialProduto;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_remove_hubla_product_map: async ({
    empresa_id,
    hubla_product_key,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      await execute.execute_ensure_hubla_schema(client);

      const empresaId = Number(empresa_id || 0);
      const productKey = normalizeNullableText(hubla_product_key);
      if (!empresaId || !productKey) {
        throw new Error("Informe a empresa e o produto Hubla para desvincular.");
      }

      await client.query(hublaModels.deactivate_hubla_produto_map(), [
        empresaId,
        productKey,
      ]);

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_save_hubla_utm_vendedor_rule: async ({
    empresa_id,
    vendedor_usuario_id,
    utm_campo,
    utm_valor,
  }) => {
    const client = await postgres.connect();
    try {
      const empresaId = Number(empresa_id || 0);
      const vendedorId = Number(vendedor_usuario_id || 0);
      const utmCampo = String(utm_campo || "").trim().toLowerCase();
      const utmValor = normalizeNullableText(utm_valor);

      if (!empresaId || !vendedorId || !utmValor || !HUBLA_UTM_FIELDS.has(utmCampo)) {
        throw new Error("Informe um campo UTM, valor e vendedor validos.");
      }
      if (!(await hasHublaUtmSellerTable(client))) {
        throw new Error("Execute a migration de regras UTM da Hubla antes de salvar.");
      }

      const vendedorRet = await client.query(hublaModels.get_hubla_vendedor_by_id(), [
        vendedorId,
        empresaId,
      ]);
      if (!vendedorRet.rows?.[0]) {
        throw new Error("Vendedor ativo nao encontrado nesta empresa.");
      }

      const ret = await client.query(hublaModels.upsert_hubla_utm_vendedor_rule(), [
        empresaId,
        vendedorId,
        utmCampo,
        utmValor,
        utmValor.toLowerCase(),
      ]);
      return ret.rows?.[0] || null;
    } finally {
      client.release();
    }
  },

  execute_remove_hubla_utm_vendedor_rule: async ({ empresa_id, regra_id }) => {
    const client = await postgres.connect();
    try {
      const empresaId = Number(empresa_id || 0);
      const regraId = Number(regra_id || 0);
      if (!empresaId || !regraId) {
        throw new Error("Regra UTM invalida para remocao.");
      }
      if (!(await hasHublaUtmSellerTable(client))) {
        throw new Error("Execute a migration de regras UTM da Hubla antes de remover.");
      }

      const ret = await client.query(
        hublaModels.deactivate_hubla_utm_vendedor_rule(),
        [regraId, empresaId]
      );
      if (!ret.rows?.[0]) throw new Error("Regra UTM nao encontrada.");
      return true;
    } finally {
      client.release();
    }
  },

  execute_save_hubla_integracao: async ({
    empresa_id,
    hubla_token,
    ativo,
    sincronizar_vendas,
    sincronizar_carrinho_abandonado,
    sincronizar_assinaturas,
    sincronizar_reembolsos,
    vincular_clientes_existentes,
    criar_clientes_automaticamente,
  }) => {
    const client = await postgres.connect();
    try {
      await execute.execute_ensure_hubla_schema(client);
      const currentRet = await client.query(
        hublaModels.get_hubla_integracao_by_empresa(),
        [empresa_id]
      );
      const current = currentRet.rows?.[0] || null;

      if (!current) {
        await client.query(hublaModels.ensure_hubla_integracao(), [empresa_id]);
      }

      const effectiveCurrent = current || (
        await client.query(hublaModels.get_hubla_integracao_by_empresa(), [empresa_id])
      ).rows?.[0] || null;

      const normalizedHublaToken = normalizeNullableText(hubla_token);
      const effectiveHublaToken = normalizedHublaToken || normalizeNullableText(effectiveCurrent?.hubla_token);
      if (ativo && !effectiveHublaToken) {
        throw new Error("Informe o token do webhook da Hubla para ativar a integracao.");
      }

      const ret = await client.query(hublaModels.update_hubla_integracao(), [
        empresa_id,
        effectiveHublaToken,
        Boolean(ativo),
        Boolean(sincronizar_vendas),
        Boolean(sincronizar_carrinho_abandonado),
        Boolean(sincronizar_assinaturas),
        Boolean(sincronizar_reembolsos),
        Boolean(vincular_clientes_existentes),
        Boolean(criar_clientes_automaticamente),
      ]);

      return ret.rows?.[0] || null;
    } finally {
      client.release();
    }
  },

  execute_processar_webhook_hubla: async ({
    webhookPublicId,
    hubla_token,
    idempotencyKey,
    payload,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      await execute.execute_ensure_hubla_schema(client);

      const integrationRet = await client.query(
        hublaModels.get_hubla_integracao_by_webhook_public_id(),
        [webhookPublicId]
      );
      const integracao = integrationRet.rows?.[0] || null;
      if (!integracao || !integracao.empresa_ativa) {
        throw Object.assign(new Error("Integracao Hubla nao encontrada."), {
          statusCode: 404,
        });
      }

      if (!integracao.ativo) {
        throw Object.assign(new Error("Integracao Hubla desativada para esta empresa."), {
          statusCode: 403,
        });
      }

      const configuredHublaToken = normalizeNullableText(integracao.hubla_token);
      if (!configuredHublaToken) {
        throw Object.assign(new Error("Token do webhook nao configurado para esta integracao."), {
          statusCode: 409,
        });
      }

      if (!security.timingSafeEqualText(configuredHublaToken || "", normalizeNullableText(hubla_token) || "")) {
        throw Object.assign(new Error("Token do webhook da Hubla invalido."), {
          statusCode: 403,
        });
      }

      const summary = extractHublaSummary(payload);
      const shouldProcess = shouldProcessCategory(integracao, summary.categoriaEvento);
      const payloadHash = buildPayloadHash(payload, idempotencyKey);
      const produtoMapeado = await resolveHublaProductMap(
        client,
        integracao.empresa_id,
        summary
      );
      const vendedorUtm = await resolveHublaUtmSeller(
        client,
        integracao.empresa_id,
        summary
      );

      let clienteResult = {
        cliente: null,
        linked: false,
        created: false,
        message: "Evento registrado sem sincronizacao de cliente.",
      };
      let processado = false;
      let mensagemProcessamento = "Evento ignorado pela configuracao atual.";

      if (shouldProcess) {
        clienteResult = await upsertClienteFromHubla(
          client,
          integracao,
          summary,
          payload
        );

        processado = Boolean(clienteResult.linked);
        mensagemProcessamento = clienteResult.message;
      }

      if (produtoMapeado?.comercial_produto_id) {
        mensagemProcessamento = shouldProcess
          ? `${mensagemProcessamento} Produto vinculado ao catalogo comercial.`
          : "Evento registrado com produto vinculado ao catalogo comercial.";
      }

      const insertRet = await client.query(hublaModels.insert_hubla_evento(), [
        integracao.empresa_id,
        integracao.id,
        clienteResult.cliente?.id || null,
        summary.tipoEvento,
        summary.categoriaEvento,
        summary.statusCompra,
        summary.transacaoId,
        summary.produtoNome,
        summary.produtoCodigo,
        summary.clienteNome,
        summary.clienteEmail,
        summary.clienteTelefone,
        summary.clienteTelefoneNormalizado,
        payloadHash,
        JSON.stringify(payload || {}),
        processado,
        mensagemProcessamento,
        Boolean(clienteResult.linked),
        Boolean(clienteResult.created),
      ]);

      let evento = insertRet.rows?.[0] || null;
      let duplicate = false;
      if (!evento) {
        const duplicateRet = await client.query(hublaModels.get_hubla_evento_by_hash(), [
          integracao.id,
          payloadHash,
        ]);
        evento = duplicateRet.rows?.[0] || null;
        duplicate = Boolean(evento);
      }

      if (evento?.id && vendedorUtm?.vendedor_usuario_id) {
        const assignedRet = await client.query(
          hublaModels.assign_hubla_evento_vendedor_if_empty(),
          [evento.id, vendedorUtm.vendedor_usuario_id]
        );
        evento = assignedRet.rows?.[0] || evento;
      }

      if (summary.transacaoId) {
        await client.query(hublaModels.reconcile_hubla_refunded_sale(), [
          integracao.id,
          summary.transacaoId,
        ]);
      }

      if (!duplicate) {
        await client.query(hublaModels.update_hubla_integracao_last_event(), [
          integracao.id,
          summary.tipoEvento,
          Boolean(processado),
        ]);
      }

      await client.query("COMMIT");
      await syncHublaReceivable(client, integracao, evento, summary, shouldProcess);
      if (!duplicate && shouldProcess && shouldNotifyHublaEvent(summary)) {
        notifyCommercialIntegrationUpdate({
          empresa_id: integracao.empresa_id,
          tipo:
            summary.categoriaEvento === "carrinho_abandonado"
              ? "abandoned_cart"
              : "sale",
          plataforma: "hubla",
          cliente_nome: summary.clienteNome,
          produto_nome: summary.produtoNome,
          transacao_id: summary.transacaoId,
        });
      }
      return {
        integracao,
        evento,
        summary,
        produtoMapeado,
        vendedorUtm,
        duplicate,
        cliente: clienteResult.cliente || null,
        processado,
        mensagem: duplicate
          ? "Evento Hubla ja registrado anteriormente."
          : mensagemProcessamento,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  mapIntegrationRow,
};

module.exports = execute;
