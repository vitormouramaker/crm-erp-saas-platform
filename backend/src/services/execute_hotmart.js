const crypto = require("crypto");
const security = require("../security/cypher");
const hotmartModels = require("../models/models_hotmart");
const userModels = require("../models/models_user");
const webhookClienteModels = require("../models/models_webhook_cliente");
const { postgres } = require("../server/connect");
const developerWebhooks = require("./execute_developer_webhooks");
const financeiro = require("./execute_financeiro");
const { notifyCommercialIntegrationUpdate } = require("../server/realtime");
const { isRuntimeSchemaEnsureEnabled } = require("../utils/runtime_schema");

const RUNTIME_SCHEMA_ENSURE_HOTMART = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SCHEMA_ENSURE_HOTMART"
);
const RUNTIME_SEED_HOTMART_INTEGRATION = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SEED_HOTMART_INTEGRATION"
);

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

function detectEventType(payload = {}) {
  const raw =
    normalizeNullableText(payload?.event) ||
    normalizeNullableText(payload?.event_type) ||
    normalizeNullableText(payload?.type) ||
    normalizeNullableText(payload?.topic) ||
    normalizeNullableText(payload?.name) ||
    normalizeNullableText(payload?.subscription_event) ||
    null;

  return raw ? raw.toUpperCase().replace(/\s+/g, "_") : "UNKNOWN_EVENT";
}

function detectPurchaseStatus(payload = {}) {
  const raw = pickFirstValue(payload, [
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

function classifyHotmartEvent(eventType, purchaseStatus) {
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

  return "vendas";
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
  return Boolean(integracao.sincronizar_vendas);
}

function shouldNotifyHotmartEvent(summary) {
  if (summary?.categoriaEvento === "carrinho_abandonado") return true;
  if (summary?.categoriaEvento !== "vendas") return false;

  const eventAndStatus = `${summary.tipoEvento || ""} ${
    summary.statusCompra || ""
  }`.toUpperCase();
  return /(APPROVED|COMPLETE|COMPLETED|PAID|SUCCEEDED)/.test(eventAndStatus);
}

async function syncHotmartReceivable(client, integracao, evento, summary, shouldProcess) {
  if (!shouldProcess || !shouldNotifyHotmartEvent(summary) || summary.categoriaEvento !== "vendas") {
    return;
  }

  try {
    await financeiro.execute_sincronizar_recebivel_venda(
      {
        empresa_id: integracao.empresa_id,
        cliente_id: evento?.cliente_id,
        usuario_id: evento?.vendedor_usuario_id,
        origem: "hotmart",
        referencia: summary.transacaoId || evento?.id,
        descricao: `Venda Hotmart - ${summary.produtoNome || summary.clienteNome}`,
        valor: summary.valorVenda,
        data_venda: summary.dataEvento,
        recebido: true,
        meio_pagamento: "hotmart",
      },
      client
    );
  } catch (error) {
    console.error("[hotmart][financeiro] falha ao sincronizar conta a receber:", {
      empresa_id: integracao.empresa_id,
      evento_id: evento?.id,
      transacao_id: summary.transacaoId,
      message: error.message,
    });
  }
}

function extractHotmartSummary(payload = {}) {
  const eventType = detectEventType(payload);
  const purchaseStatus = detectPurchaseStatus(payload);
  const categoriaEvento = classifyHotmartEvent(eventType, purchaseStatus);

  const clienteTelefone = pickFirstValue(payload, [
    ["data", "buyer", "phone"],
    ["data", "purchase", "buyer", "phone"],
    ["data", "purchase", "shopper", "phone"],
    ["data", "subscriber", "phone"],
    ["buyer", "phone"],
    ["phone"],
  ]);
  const clienteEmail = pickFirstValue(payload, [
    ["data", "buyer", "email"],
    ["data", "purchase", "buyer", "email"],
    ["data", "purchase", "shopper", "email"],
    ["data", "subscriber", "email"],
    ["buyer", "email"],
    ["email"],
  ]);
  const clienteNome = pickFirstValue(payload, [
    ["data", "buyer", "name"],
    ["data", "purchase", "buyer", "name"],
    ["data", "purchase", "shopper", "name"],
    ["data", "subscriber", "name"],
    ["buyer", "name"],
    ["name"],
  ]);
  const produtoNome = pickFirstValue(payload, [
    ["data", "product", "name"],
    ["data", "purchase", "product", "name"],
    ["product", "name"],
    ["data", "offer", "name"],
    ["offer", "name"],
  ]);
  const produtoCodigo = pickFirstValue(payload, [
    ["data", "product", "id"],
    ["data", "product", "ucode"],
    ["data", "purchase", "product", "id"],
    ["data", "offer", "code"],
    ["offer", "code"],
    ["product", "id"],
  ]);
  const ofertaCodigo = pickFirstValue(payload, [
    ["data", "offer", "code"],
    ["offer", "code"],
    ["data", "purchase", "offer", "code"],
  ]);
  const transacaoId = pickFirstValue(payload, [
    ["data", "purchase", "transaction"],
    ["data", "purchase", "order_id"],
    ["data", "purchase", "id"],
    ["purchase", "transaction"],
    ["purchase", "order_id"],
    ["id"],
  ]);
  const valorVenda = pickFirstValue(payload, [
    ["data", "purchase", "price", "value"],
    ["data", "purchase", "full_price", "value"],
    ["data", "purchase", "payment", "total_value"],
    ["data", "purchase", "offer", "price", "value"],
    ["purchase", "price", "value"],
    ["price", "value"],
  ]);
  const dataEvento = pickFirstValue(payload, [
    ["data", "purchase", "approved_date"],
    ["data", "purchase", "order_date"],
    ["data", "purchase", "purchase_date"],
    ["data", "purchase", "date"],
    ["purchase", "approved_date"],
    ["creation_date"],
  ]);

  return {
    tipoEvento: eventType,
    categoriaEvento,
    statusCompra: purchaseStatus,
    clienteNome:
      normalizeNullableText(clienteNome) ||
      normalizeEmail(clienteEmail) ||
      normalizeImportPhone(clienteTelefone) ||
      "Cliente Hotmart",
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
    valorVenda:
      valorVenda === null || !Number.isFinite(Number(valorVenda))
        ? null
        : Number(valorVenda),
    dataEvento: normalizeNullableText(dataEvento),
  };
}

function buildPayloadHash(payload = {}) {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify(payload || {}))
    .digest("hex");
}

function buildHotmartHistoryItem(summary, payload = {}) {
  return {
    source: "hotmart",
    event_type: summary.tipoEvento,
    event_category: summary.categoriaEvento,
    purchase_status: summary.statusCompra,
    transaction_id: summary.transacaoId,
    product_name: summary.produtoNome,
    product_code: summary.produtoCodigo,
    offer_code: summary.ofertaCodigo,
    product_key: summary.produtoChave,
    payload_reference: {
      buyer_email: summary.clienteEmail,
      buyer_phone: summary.clienteTelefoneNormalizado || summary.clienteTelefone,
    },
    raw_event: payload?.event || payload?.type || null,
    data_recebimento: new Date().toISOString(),
  };
}

function buildHotmartTags(summary) {
  return normalizeTagList([
    "hotmart",
    `hotmart:${summary.categoriaEvento}`,
    summary.statusCompra ? `hotmart:${String(summary.statusCompra).toLowerCase()}` : null,
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

async function upsertClienteFromHotmart(client, integracao, summary, payload) {
  const email = normalizeEmail(summary.clienteEmail);
  const telefone = summary.clienteTelefoneNormalizado;
  const telefoneCandidates = buildPhoneLookupCandidates(telefone || summary.clienteTelefone);

  if (!email && !telefoneCandidates.length) {
    return {
      cliente: null,
      linked: false,
      created: false,
      message: "Telefone e e-mail nao encontrados no payload da Hotmart.",
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
      cliente.origem || "hotmart",
    ]);
    cliente = updatedRet.rows?.[0] || cliente;
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
      summary.clienteNome || "Cliente Hotmart",
      telefone,
      email,
      integracao.empresa_id,
      JSON.stringify([]),
      null,
      "hotmart",
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
      buildHotmartHistoryItem(summary, payload)
    );
    await ensureClienteTags(
      client,
      integracao.empresa_id,
      cliente.id,
      buildHotmartTags(summary)
    );
  }

  return {
    cliente,
    linked: Boolean(cliente?.id),
    created: Boolean(cliente?.id && !existingRet.rows?.[0]),
    message: cliente?.id
      ? existingRet.rows?.[0]
        ? "Cliente existente vinculado com sucesso."
        : "Novo cliente criado a partir do evento Hotmart."
      : "Nao foi possivel vincular o cliente.",
  };
}

async function resolveHotmartProductMap(client, empresaId, summary) {
  if (!summary?.produtoChave) return null;
  const ret = await client.query(hotmartModels.get_hotmart_produto_map_by_key(), [
    empresaId,
    summary.produtoChave,
  ]);
  return ret.rows?.[0] || null;
}

function mapDetectedProduct(row) {
  return {
    hotmart_product_key: row.hotmart_product_key || "",
    hotmart_product_id: row.hotmart_product_id || "",
    hotmart_offer_code: row.hotmart_offer_code || "",
    hotmart_product_name: row.hotmart_product_name || "",
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
    hottok_configurado: Boolean(normalizeNullableText(row.hottok)),
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
  execute_ensure_hotmart_schema: async (client) => {
    if (!RUNTIME_SCHEMA_ENSURE_HOTMART) {
      return;
    }

    await client.query(hotmartModels.ensure_hotmart_integracao_table());
    await client.query(hotmartModels.ensure_hotmart_integracao_empresa_unique());
    await client.query(hotmartModels.ensure_hotmart_integracao_webhook_unique());
    await client.query(hotmartModels.ensure_hotmart_integracao_empresa_fk());
    await client.query(hotmartModels.ensure_hotmart_evento_table());
    await client.query(hotmartModels.ensure_hotmart_evento_unique());
    await client.query(hotmartModels.ensure_hotmart_evento_empresa_idx());
    await client.query(hotmartModels.ensure_hotmart_evento_cliente_idx());
    await client.query(hotmartModels.ensure_hotmart_evento_empresa_fk());
    await client.query(hotmartModels.ensure_hotmart_evento_integracao_fk());
    await client.query(hotmartModels.ensure_hotmart_evento_cliente_fk());
    await client.query(hotmartModels.ensure_hotmart_produto_map_table());
    await client.query(hotmartModels.ensure_hotmart_produto_map_unique());
    await client.query(hotmartModels.ensure_hotmart_produto_map_empresa_fk());
    await client.query(hotmartModels.ensure_hotmart_produto_map_comercial_produto_fk());
  },

  execute_ensure_hotmart_integracao: async (empresaId) => {
    const client = await postgres.connect();
    try {
      await execute.execute_ensure_hotmart_schema(client);
      if (!RUNTIME_SEED_HOTMART_INTEGRATION) {
        const existingRet = await client.query(
          hotmartModels.get_hotmart_integracao_by_empresa(),
          [empresaId]
        );
        return existingRet.rows?.[0] || null;
      }
      const ret = await client.query(hotmartModels.ensure_hotmart_integracao(), [empresaId]);
      return ret.rows?.[0] || null;
    } finally {
      client.release();
    }
  },

  execute_get_hotmart_integracao_overview: async (empresaId) => {
    const client = await postgres.connect();
    try {
      await execute.execute_ensure_hotmart_schema(client);

      const integrationRet = await client.query(
        hotmartModels.get_hotmart_integracao_by_empresa(),
        [empresaId]
      );
      const summaryRet = await client.query(hotmartModels.get_hotmart_eventos_summary(), [
        empresaId,
      ]);
      const eventsRet = await client.query(hotmartModels.get_hotmart_eventos_recentes(), [
        empresaId,
        20,
      ]);
      const produtosRet = await client.query(hotmartModels.list_hotmart_produtos_detectados(), [
        empresaId,
      ]);

      return {
        integracao: integrationRet.rows?.[0] || null,
        summary: summaryRet.rows?.[0] || null,
        eventos: eventsRet.rows || [],
        produtosDetectados: (produtosRet.rows || []).map(mapDetectedProduct),
      };
    } finally {
      client.release();
    }
  },

  execute_save_hotmart_product_map: async ({
    empresa_id,
    hotmart_product_key,
    hotmart_product_id,
    hotmart_offer_code,
    hotmart_product_name,
    comercial_produto_id,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      await execute.execute_ensure_hotmart_schema(client);

      const empresaId = Number(empresa_id || 0);
      const comercialProdutoId = Number(comercial_produto_id || 0);
      const productKey =
        normalizeNullableText(hotmart_product_key) ||
        normalizeLookupKey(hotmart_product_name);
      const productName =
        normalizeNullableText(hotmart_product_name) ||
        normalizeNullableText(hotmart_product_id) ||
        productKey;

      if (!empresaId) throw new Error("Empresa invalida para vincular produto Hotmart.");
      if (!productKey) throw new Error("Produto Hotmart invalido para vinculacao.");
      if (!comercialProdutoId) {
        throw new Error("Selecione um produto comercial valido para o vinculo.");
      }

      const productRet = await client.query(hotmartModels.get_comercial_produto_by_id(), [
        comercialProdutoId,
        empresaId,
      ]);
      const comercialProduto = productRet.rows?.[0] || null;
      if (!comercialProduto?.id || comercialProduto.ativo === false) {
        throw new Error("Produto comercial nao encontrado para esta empresa.");
      }

      await client.query(hotmartModels.upsert_hotmart_produto_map(), [
        empresaId,
        productKey,
        normalizeNullableText(hotmart_product_id),
        normalizeNullableText(hotmart_offer_code),
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

  execute_remove_hotmart_product_map: async ({
    empresa_id,
    hotmart_product_key,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      await execute.execute_ensure_hotmart_schema(client);

      const empresaId = Number(empresa_id || 0);
      const productKey = normalizeNullableText(hotmart_product_key);
      if (!empresaId || !productKey) {
        throw new Error("Informe a empresa e o produto Hotmart para desvincular.");
      }

      await client.query(hotmartModels.deactivate_hotmart_produto_map(), [
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

  execute_save_hotmart_integracao: async ({
    empresa_id,
    hottok,
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
      await execute.execute_ensure_hotmart_schema(client);
      const currentRet = await client.query(
        hotmartModels.get_hotmart_integracao_by_empresa(),
        [empresa_id]
      );
      const current = currentRet.rows?.[0] || null;

      if (!current) {
        await client.query(hotmartModels.ensure_hotmart_integracao(), [empresa_id]);
      }

      const effectiveCurrent = current || (
        await client.query(hotmartModels.get_hotmart_integracao_by_empresa(), [empresa_id])
      ).rows?.[0] || null;

      const normalizedHottok = normalizeNullableText(hottok);
      const effectiveHottok = normalizedHottok || normalizeNullableText(effectiveCurrent?.hottok);
      if (ativo && !effectiveHottok) {
        throw new Error("Informe o Hottok da Hotmart para ativar a integracao.");
      }

      const ret = await client.query(hotmartModels.update_hotmart_integracao(), [
        empresa_id,
        effectiveHottok,
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

  execute_processar_webhook_hotmart: async ({
    webhookPublicId,
    hottok,
    payload,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      await execute.execute_ensure_hotmart_schema(client);

      const integrationRet = await client.query(
        hotmartModels.get_hotmart_integracao_by_webhook_public_id(),
        [webhookPublicId]
      );
      const integracao = integrationRet.rows?.[0] || null;
      if (!integracao || !integracao.empresa_ativa) {
        throw Object.assign(new Error("Integracao Hotmart nao encontrada."), {
          statusCode: 404,
        });
      }

      if (!integracao.ativo) {
        throw Object.assign(new Error("Integracao Hotmart desativada para esta empresa."), {
          statusCode: 403,
        });
      }

      const configuredHottok = normalizeNullableText(integracao.hottok);
      if (!configuredHottok) {
        throw Object.assign(new Error("Hottok nao configurado para esta integracao."), {
          statusCode: 409,
        });
      }

      if (!security.timingSafeEqualText(configuredHottok || "", normalizeNullableText(hottok) || "")) {
        throw Object.assign(new Error("Hottok da Hotmart invalido."), {
          statusCode: 403,
        });
      }

      const summary = extractHotmartSummary(payload);
      const shouldProcess = shouldProcessCategory(integracao, summary.categoriaEvento);
      const payloadHash = buildPayloadHash(payload);
      const produtoMapeado = await resolveHotmartProductMap(
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
        clienteResult = await upsertClienteFromHotmart(
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

      const insertRet = await client.query(hotmartModels.insert_hotmart_evento(), [
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
        const duplicateRet = await client.query(hotmartModels.get_hotmart_evento_by_hash(), [
          integracao.id,
          payloadHash,
        ]);
        evento = duplicateRet.rows?.[0] || null;
        duplicate = Boolean(evento);
      }

      if (!duplicate) {
        await client.query(hotmartModels.update_hotmart_integracao_last_event(), [
          integracao.id,
          summary.tipoEvento,
          Boolean(processado),
        ]);
      }

      await client.query("COMMIT");
      await syncHotmartReceivable(client, integracao, evento, summary, shouldProcess);
      if (!duplicate && shouldProcess && shouldNotifyHotmartEvent(summary)) {
        notifyCommercialIntegrationUpdate({
          empresa_id: integracao.empresa_id,
          tipo:
            summary.categoriaEvento === "carrinho_abandonado"
              ? "abandoned_cart"
              : "sale",
          plataforma: "hotmart",
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
        duplicate,
        cliente: clienteResult.cliente || null,
        processado,
        mensagem: duplicate
          ? "Evento Hotmart ja registrado anteriormente."
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
