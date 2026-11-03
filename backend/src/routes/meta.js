const express = require("express");
const axios = require("axios");
const rota = express.Router();
const security = require("../security/cypher");
const { verifyMetaWebhookSignature } = require("../security/meta_signature");
const execute = require("../services/execute_meta");
const executeAtendimento = require("../services/execute_atendimento");
const executeUser = require("../services/execute_user");
const utils = require("../utils/templates");
const upload = require("../utils/multer_config");
const {
  DEFAULT_GRAPH_VERSION,
  buildWebhookUrl,
  exchangeCodeForAccessToken,
  extractWebhookIdentifiers,
  findPhoneNumberInfo,
  resolveMetaSignupContext,
  getMetaParametrosOrFail,
  getPrimaryWebhookChanges,
  getRequestedPhoneNumber,
  getRequestedPhoneNumberId,
  handleGetTemplates,
  isWebhookChangeForMetaMessages,
  mapWebhookStatus,
  mountMetaStatus,
  normalizeMetaPayload,
  normalizePricingRows,
  persistIncomingMetaMessage,
  persistMetaMessageEcho,
  subscribeMetaWebhook,
  toUnix,
  validateMetaIntegrationReady,
  buildWhatsAppProfileUpdatePayload,
  validateTemplateForDispatch,
  buildTemplateCreatePayload,
  buildTemplatePayloadForDispatch,
  resolveTemplateDispatchPayloadForRecipient,
  buildTemplatePreviewMessage,
  buildTemplateChatPayload,
  findTemplateDefinition,
  buildTemplateDispatchContext,
  cleanupUploadedTemplateMedia,
  getMetaSystemAccessToken,
  normalizeWhatsAppProfileResponse,
  resolveTemplateHeaderMedia,
  validateWhatsAppProfilePictureFile,
  uploadMetaResumableFileHandle
} = require("../functions/function_meta");

const DEFAULT_WEBHOOK_VERIFY_TOKEN =
  process.env.META_WEBHOOK_VERIFY_TOKEN || "";

async function resolveDispatchNumber(item) {
  let numero =
    item.numero ||
    item.telefone ||
    item.phone_number ||
    item.to ||
    null;

  if (!numero && item.conversa_id) {
    const numberRows = await executeAtendimento.execute_get_number(item.conversa_id);
    numero = numberRows?.[0]?.number_phone_id || null;
  }

  return normalizeRecipientNumber(numero);
}

function normalizeRecipientNumber(value) {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("00") ? digits.slice(2) : digits;
  const defaultCountryCode = String(process.env.META_DEFAULT_COUNTRY_CODE || "55").replace(
    /\D/g,
    ""
  );

  if (!defaultCountryCode) return normalized;

  // If user sends local number (e.g. 11 digits in BR), prepend default DDI.
  if (normalized.length <= 11 && !normalized.startsWith(defaultCountryCode)) {
    return `${defaultCountryCode}${normalized}`;
  }

  return normalized;
}

function normalizeIntegerId(value) {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "sim", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "nao", "não", "off", ""].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
}

function normalizeMetaColor(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null;
}

function resolveRequestUsuarioId(data) {
  return normalizeIntegerId(
    data?.usuario_id || data?.usuarioId || data?.id_usuario || data?.user_id || data?.id
  );
}

async function ensureSingleDispatchConversation({
  data,
  parametros,
  numero,
  clienteId,
}) {
  const providedConversationId = normalizeIntegerId(data.conversa_id);
  const usuarioId = resolveRequestUsuarioId(data);
  const empresaMetaParamId =
    normalizeIntegerId(parametros?.id) || normalizeIntegerId(data.meta_param_id);
  let resolvedClientId = normalizeIntegerId(clienteId);

  if (providedConversationId) {
    const providedConversationRows =
      await executeAtendimento.execute_get_conversa_contexto_acesso(
        providedConversationId
      );
    const providedConversation = providedConversationRows?.[0] || null;

    if (
      providedConversation &&
      Number(providedConversation.empresa_id) === Number(data.empresa_id)
    ) {
      resolvedClientId =
        resolvedClientId || normalizeIntegerId(providedConversation.cliente_id);

      const providedStatusId =
        normalizeIntegerId(providedConversation.status_id) || 0;
      const isFinishedConversation =
        providedStatusId === 2 || providedConversation.data_fim !== null;

      const providedConversationMetaParamId =
        normalizeIntegerId(providedConversation.empresa_meta_param_id);
      const providedConversationNumber = normalizeRecipientNumber(
        providedConversation.number_phone_id || null
      );
      const selectedDispatchMatchesProvidedConversation =
        (!empresaMetaParamId || providedConversationMetaParamId === empresaMetaParamId) &&
        (!numero || providedConversationNumber === numero);

      if (!isFinishedConversation && selectedDispatchMatchesProvidedConversation) {
        return {
          conversaId: providedConversationId,
          chatOpenedAutomatically: false,
          assignedToUser: false,
        };
      }
    } else {
      return {
        conversaId: providedConversationId,
        chatOpenedAutomatically: false,
        assignedToUser: false,
      };
    }
  }

  if (!resolvedClientId) {
    return {
      conversaId: null,
      chatOpenedAutomatically: false,
      assignedToUser: false,
    };
  }

  const openConversationRows = await execute.execute_find_conversa_aberta_by_cliente(
    resolvedClientId,
    data.empresa_id,
    empresaMetaParamId
  );

  let conversation = openConversationRows?.[0] || null;
  let createdConversation = false;
  let assignedToUser = false;

  if (!conversation?.id) {
    const insertedConversationRows = await execute.execute_insert_conversa(
      numero,
      resolvedClientId,
      data.empresa_id,
      empresaMetaParamId
    );
    conversation = insertedConversationRows?.[0] || null;
    createdConversation = Boolean(conversation?.id);
  } else {
    const currentNumber = normalizeRecipientNumber(conversation.number_phone_id || null);
    const currentMetaParamId = normalizeIntegerId(conversation.empresa_meta_param_id);
    const shouldRefreshConversation =
      (numero && currentNumber !== numero) ||
      (empresaMetaParamId && currentMetaParamId !== empresaMetaParamId);

    if (shouldRefreshConversation) {
      const updatedConversationRows = await execute.execute_update_conversa_number_phone(
        conversation.id,
        numero,
        empresaMetaParamId
      );
      conversation = updatedConversationRows?.[0] || conversation;
    }
  }

  const conversaId = normalizeIntegerId(conversation?.id);
  if (!conversaId) {
    return {
      conversaId: null,
      chatOpenedAutomatically: false,
      assignedToUser: false,
    };
  }

  const statusId = normalizeIntegerId(conversation?.status_id) || 0;
  const existingUserId = normalizeIntegerId(conversation?.usuario_id);

  if (usuarioId && statusId === 0 && !existingUserId) {
    await executeAtendimento.execute_iniciar_atendimento(conversaId, usuarioId);
    assignedToUser = true;
  }

  return {
    conversaId,
    chatOpenedAutomatically: createdConversation || assignedToUser,
    assignedToUser,
  };
}

function mapDispatchCostGranularity(granularity = "DAILY") {
  const normalized = String(granularity || "DAILY").trim().toUpperCase();

  switch (normalized) {
    case "HOURLY":
      return "hour";
    case "WEEKLY":
      return "week";
    case "MONTHLY":
      return "month";
    case "DAILY":
    default:
      return "day";
  }
}

function buildDispatchCostSummaryFromRows(rows = []) {
  const total_cost = rows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const total_volume = rows.reduce((sum, row) => sum + Number(row.volume || 0), 0);

  return {
    total_cost: Number(total_cost.toFixed(6)),
    total_volume,
    cost_per_message:
      total_volume > 0 ? Number((total_cost / total_volume).toFixed(6)) : 0,
  };
}

function normalizeAllowedMetaParamIds(rows = []) {
  return [...new Set(
    (rows || [])
      .map((row) => Number(row?.id || row?.empresa_meta_param_id || 0))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
}

async function loadLocalDispatchCostMetrics({
  empresa_id,
  empresa_meta_param_id = null,
  start,
  end,
  granularity,
}) {
  const rows = await execute.execute_get_template_dispatch_cost_history_summary({
    empresa_id,
    empresa_meta_param_id,
    start,
    end,
    granularity: mapDispatchCostGranularity(granularity),
  });

  return {
    rows: Array.isArray(rows) ? rows : [],
    summary: buildDispatchCostSummaryFromRows(Array.isArray(rows) ? rows : []),
  };
}

async function resolveTemplateBatchItems(data) {
  const payloadItems = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.lote)
      ? data.lote
      : [];
  const listaId = normalizeIntegerId(
    data.lista_id || data.lista_transmissao_id || data.listaTransmissaoId
  );
  const usuarioId = resolveRequestUsuarioId(data);
  const shouldLoadFromList =
    Boolean(listaId) &&
    (
      payloadItems.length === 0 ||
      parseBooleanFlag(data.load_items_from_list, false) ||
      parseBooleanFlag(data.usar_lista_id_como_fonte, false)
    );

  if (!shouldLoadFromList) {
    return payloadItems;
  }

  const contatos = await executeUser.execute_get_contatos_lista_transmissao(
    data.empresa_id,
    usuarioId,
    listaId
  );

  return (contatos || []).map((contato) => ({
    cliente_id: contato.cliente_id || null,
    contato_nome: contato.nome || null,
    nome: contato.nome || null,
    telefone: contato.telefone || null,
    email: contato.email || null,
  }));
}

function parseStructuredMetaError(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return null;
  }
}

function normalizeBatchError(error, fallbackMessage) {
  const rawError =
    error?.response?.data ||
    parseStructuredMetaError(error?.message) ||
    error?.message ||
    error ||
    null;

  const metaError =
    rawError && typeof rawError === "object" && rawError.error && typeof rawError.error === "object"
      ? rawError.error
      : rawError;

  const message = String(
    metaError?.error_user_msg ||
      metaError?.message ||
      error?.message ||
      fallbackMessage ||
      "Falha ao processar o destinatario."
  ).trim();

  return {
    message,
    code:
      metaError?.code === undefined || metaError?.code === null
        ? null
        : Number(metaError.code) || metaError.code,
    error_subcode:
      metaError?.error_subcode === undefined || metaError?.error_subcode === null
        ? null
        : Number(metaError.error_subcode) || metaError.error_subcode,
    type: metaError?.type ? String(metaError.type) : null,
    raw: rawError,
  };
}

function normalizeMetaErrorSnapshot(error, fallbackMessage = "") {
  const rawError =
    error?.response?.data ||
    parseStructuredMetaError(error?.message) ||
    error?.message ||
    error ||
    null;

  const metaError =
    rawError && typeof rawError === "object" && rawError.error && typeof rawError.error === "object"
      ? rawError.error
      : rawError;

  return {
    rawError,
    metaError,
    code:
      metaError?.code === undefined || metaError?.code === null
        ? null
        : Number(metaError.code) || metaError.code,
    errorSubcode:
      metaError?.error_subcode === undefined || metaError?.error_subcode === null
        ? null
        : Number(metaError.error_subcode) || metaError.error_subcode,
    type: metaError?.type ? String(metaError.type) : null,
    title: String(metaError?.error_user_title || metaError?.title || "").trim(),
    userMessage: String(metaError?.error_user_msg || "").trim(),
    details: String(metaError?.error_data?.details || "").trim(),
    message: String(
      metaError?.message ||
        error?.message ||
        fallbackMessage ||
        "Tente novamente mais tarde!"
    ).trim(),
  };
}

function buildTemplateDispatchValidationMessage(baseMessage, errors = []) {
  const normalizedErrors = Array.isArray(errors)
    ? errors
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

  if (!normalizedErrors.length) {
    return baseMessage;
  }

  return `${baseMessage} ${normalizedErrors.join(" | ")}`;
}

function formatTemplateCreateError(error) {
  const snapshot = normalizeMetaErrorSnapshot(
    error,
    "A Meta recusou a criacao do template."
  );
  const combined = [
    snapshot.title,
    snapshot.userMessage,
    snapshot.details,
    snapshot.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    combined.includes("nao enviou o arquivo de amostra") ||
    combined.includes("nao enviou arquivo de amostra") ||
    combined.includes("header com midia")
  ) {
    return "Voce escolheu um cabecalho com midia, mas nao enviou o arquivo de amostra. A Meta exige esse arquivo para criar e revisar o template.";
  }

  if (
    combined.includes("nao e uma imagem") ||
    (combined.includes("header image") && combined.includes("arquivo"))
  ) {
    return "O arquivo de amostra nao combina com o cabecalho escolhido. Para header IMAGE, envie uma imagem valida como JPG ou PNG.";
  }

  if (
    combined.includes("nao e um video") ||
    (combined.includes("header video") && combined.includes("arquivo"))
  ) {
    return "O arquivo de amostra nao combina com o cabecalho escolhido. Para header VIDEO, envie um arquivo de video suportado pela Meta.";
  }

  if (
    combined.includes("nao e pdf") ||
    (combined.includes("header document") && combined.includes("pdf"))
  ) {
    return "O arquivo de amostra nao combina com o cabecalho escolhido. Para header DOCUMENT, envie um arquivo PDF.";
  }

  if (
    combined.includes("upload do arquivo de amostra") ||
    combined.includes("upload session") ||
    combined.includes("file handle") ||
    combined.includes("header_handle")
  ) {
    return "Nao foi possivel enviar o arquivo de amostra para a Meta. Isso costuma acontecer quando o arquivo esta em formato invalido ou o upload foi recusado pela Meta.";
  }

  if (
    combined.includes("already exists") ||
    combined.includes("ja existe") ||
    combined.includes("duplicate") ||
    combined.includes("existing template")
  ) {
    return "Ja existe um template com esse nome nesta conta da Meta. Use um nome unico para criar um novo template.";
  }

  if (
    combined.includes("invalid parameter") &&
    combined.includes("name")
  ) {
    return "O nome do template foi recusado pela Meta. Use apenas letras minusculas, numeros e underscore, sem espacos, acentos ou caracteres especiais.";
  }

  if (
    combined.includes("template name") &&
    (
      combined.includes("invalid") ||
      combined.includes("match the required pattern") ||
      combined.includes("letters, numbers and underscores")
    )
  ) {
    return "O nome do template foi recusado pela Meta. Use apenas letras minusculas, numeros e underscore, sem espacos, acentos ou caracteres especiais.";
  }

  if (combined.includes("language")) {
    return "O idioma informado foi recusado pela Meta. Escolha um codigo suportado, como pt_BR, en_US ou es_ES.";
  }

  if (combined.includes("category")) {
    return "A categoria do template foi recusada pela Meta. Revise se o conteudo realmente pertence a Utilitario, Marketing ou Autenticacao.";
  }

  if (
    combined.includes("example") ||
    combined.includes("sample")
  ) {
    return "A Meta pediu exemplos validos para analisar o template. Revise as variaveis do texto e envie um arquivo de amostra quando o cabecalho for de midia.";
  }

  if (
    combined.includes("component") ||
    combined.includes("button") ||
    combined.includes("footer") ||
    combined.includes("header") ||
    combined.includes("body")
  ) {
    return "A estrutura do template foi recusada pela Meta. Revise cabecalho, corpo, rodape, botoes e as variaveis usadas em cada parte.";
  }

  if (
    snapshot.type === "OAuthException" &&
    snapshot.code === 190
  ) {
    return "A conexao com a Meta expirou ou ficou invalida. Reconecte a integracao e tente criar o template novamente.";
  }

  if (
    snapshot.type === "OAuthException" &&
    (snapshot.code === 10 || snapshot.code === 200)
  ) {
    return "A conta conectada na Meta nao tem permissao para criar templates nesta conta do WhatsApp Business. Verifique o acesso da conta no Business Manager.";
  }

  if (
    snapshot.code === 4 ||
    snapshot.code === 80007 ||
    combined.includes("rate limit") ||
    combined.includes("too many calls") ||
    combined.includes("temporarily blocked")
  ) {
    return "A Meta bloqueou temporariamente novas tentativas por excesso de requisicoes. Aguarde alguns minutos e tente novamente.";
  }

  if (snapshot.userMessage) {
    return `A Meta recusou a criacao do template. Causa informada: ${snapshot.userMessage}`;
  }

  if (snapshot.message) {
    return `Nao foi possivel criar o template. Detalhe: ${snapshot.message}`;
  }

  return "Nao foi possivel criar o template na Meta. Revise nome, categoria, idioma, estrutura e exemplos preenchidos.";
}

function buildBatchRecipientContext(item) {
  const contato_nome = String(
    item.contato_nome || item.contact_name || item.nome || ""
  ).trim();
  const email = String(item.email || "").trim();
  const numero_original =
    item.numero ||
    item.telefone ||
    item.phone_number ||
    item.to ||
    null;

  return {
    cliente_id:
      item.cliente_id === undefined || item.cliente_id === null
        ? null
        : Number(item.cliente_id) || item.cliente_id,
    contato_nome: contato_nome || null,
    email: email || null,
    numero_original: numero_original ? String(numero_original) : null,
  };
}

async function loadBatchDispatchCostSummary(parametros, metaAccessToken) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);

  const start = Math.floor(startDate.getTime() / 1000);
  const end = Math.floor(now.getTime() / 1000);
  const granularity = "DAILY";

  const queryParams = {
    start,
    end,
    granularity,
    metric_types: JSON.stringify(["COST", "VOLUME"]),
  };

  const displayPhoneNumber = String(parametros?.display_phone_number || "").trim();
  if (displayPhoneNumber) {
    queryParams.phone_numbers = JSON.stringify([displayPhoneNumber]);
  }

  try {
    const response = await axios.get(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${parametros.whatsapp_account_id}/pricing_analytics`,
      {
        headers: {
          Authorization: `Bearer ${metaAccessToken}`,
        },
        params: queryParams,
      }
    );

    const sourceRows = response.data?.data || response.data?.pricing_analytics?.data || [];
    const rows = normalizePricingRows(sourceRows);
    const total_cost = rows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
    const total_volume = rows.reduce((sum, row) => sum + Number(row.volume || 0), 0);

    return {
      filters: {
        start,
        end,
        granularity,
      },
      summary: {
        total_cost: Number(total_cost.toFixed(6)),
        total_volume,
        cost_per_message:
          total_volume > 0 ? Number((total_cost / total_volume).toFixed(6)) : 0,
      },
      rows,
      cost_available: true,
      phone_number_filter: displayPhoneNumber || null,
      message: displayPhoneNumber
        ? "Custo agregado consultado para o periodo de hoje no numero selecionado."
        : "Custo agregado consultado para o periodo de hoje na conta atual.",
      raw: response.data || null,
    };
  } catch (error) {
    const metaError = error?.response?.data?.error || {};
    const isCostNotAvailable =
      Number(metaError?.error_subcode) === 2388184 ||
      (Number(metaError?.code) === 10 &&
        String(metaError?.error_user_title || "")
          .toLowerCase()
          .includes("custo não disponível")) ||
      String(metaError?.error_user_msg || "")
        .toLowerCase()
        .includes("custo não é mostrado para empresas que fazem cobranças por meio de um parceiro");

    if (isCostNotAvailable) {
      return {
        filters: {
          start,
          end,
          granularity,
        },
        summary: {
          total_cost: 0,
          total_volume: 0,
          cost_per_message: 0,
        },
        rows: [],
        cost_available: false,
        phone_number_filter: displayPhoneNumber || null,
        message:
          metaError?.error_user_msg ||
          "Custo indisponivel para esta conta. Consulte o parceiro de cobranca.",
        raw: error?.response?.data || null,
      };
    }

    console.warn(
      "Nao foi possivel consultar o custo agregado apos o lote:",
      error?.response?.data || error
    );

    return {
      filters: {
        start,
        end,
        granularity,
      },
      summary: {
        total_cost: 0,
        total_volume: 0,
        cost_per_message: 0,
      },
      rows: [],
      cost_available: null,
      phone_number_filter: displayPhoneNumber || null,
      message: "Nao foi possivel consultar o custo agregado deste lote agora.",
      raw: error?.response?.data || null,
    };
  }
}

function parseDispatchCostEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeTemplateCategoryForBilling(value) {
  return String(value || "").trim().toUpperCase() || "UTILITY";
}

function getTemplateDispatchUnitCostUsd(templateCategory) {
  const normalizedCategory = normalizeTemplateCategoryForBilling(templateCategory);
  const marketingCost = parseDispatchCostEnv(
    process.env.META_TEMPLATE_UNIT_COST_MARKETING_USD,
    0.06
  );
  const defaultCost = parseDispatchCostEnv(
    process.env.META_TEMPLATE_UNIT_COST_OTHERS_USD,
    0.004
  );

  return normalizedCategory === "MARKETING" ? marketingCost : defaultCost;
}

function buildTemplateBatchCostSummary({ templateCategory, successCount }) {
  const normalizedCategory = normalizeTemplateCategoryForBilling(templateCategory);
  const unitCost = getTemplateDispatchUnitCostUsd(normalizedCategory);
  const totalCost = Number((unitCost * Math.max(Number(successCount || 0), 0)).toFixed(6));

  return {
    pricing_source: "env",
    currency: "USD",
    category: normalizedCategory,
    message:
      normalizedCategory === "MARKETING"
        ? "Custo calculado pela tabela interna de marketing definida no .env."
        : "Custo calculado pela tabela interna de templates nao marketing definida no .env.",
    summary: {
      total_cost: totalCost,
      total_volume: Math.max(Number(successCount || 0), 0),
      cost_per_message: unitCost,
      unit_cost: unitCost,
    },
    rows: [
      {
        pricing_category: normalizedCategory,
        cost: totalCost,
        volume: Math.max(Number(successCount || 0), 0),
        currency: "USD",
        cost_per_message: unitCost,
      },
    ],
    cost_available: true,
  };
}

function buildTemplateBatchProgressPayload(batch) {
  if (!batch) {
    return {
      found: false,
    };
  }

  const totalItems = Math.max(Number(batch.total_clientes || 0), 0);
  const processedItems = Math.max(Number(batch.processados || 0), 0);
  const successCount = Math.max(Number(batch.enviados || 0), 0);
  const errorCount = Math.max(Number(batch.erros || 0), 0);
  const remainingItems = Math.max(totalItems - processedItems, 0);
  const metadata = batch.metadata && typeof batch.metadata === "object"
    ? batch.metadata
    : {};
  const costSummary = batch.template_category
    ? buildTemplateBatchCostSummary({
        templateCategory: batch.template_category,
        successCount,
      })
    : null;
  const explicitStatus = String(metadata.status || "").trim().toLowerCase();
  const status = explicitStatus || (
    batch.data_fim
      ? batch.interrompido_no_erro
        ? "stopped_on_error"
        : "completed"
      : "processing"
  );

    return {
      found: true,
      dispatch_history_id: batch.id || null,
      usuario_id: batch.usuario_id || null,
      template_id: batch.template_id || null,
      template_name: batch.template_name || null,
      template_category: batch.template_category || null,
    lista_transmissao_id: batch.lista_transmissao_id || null,
    total_items: totalItems,
    processed_items: processedItems,
    success_count: successCount,
    error_count: errorCount,
    remaining_items: remainingItems,
    progress_percent:
      totalItems > 0
        ? Number(((processedItems / totalItems) * 100).toFixed(2))
        : 0,
    stopped_on_error: Boolean(batch.interrompido_no_erro),
    started_at: batch.data_inicio ? new Date(batch.data_inicio).toISOString() : null,
    finished_at: batch.data_fim ? new Date(batch.data_fim).toISOString() : null,
    duration_ms: batch.duracao_ms || 0,
    status,
    metadata,
    cost_summary: costSummary,
  };
}

function buildTemplateBatchDispatchStartPayload({
  batchHistory,
  templateId,
  templateName,
  languageCode,
  templateCategory,
  listaTransmissaoId,
  uploadedHeaderMedia,
  leadStartedMessagesGenerateAutoMessage,
}) {
  const progressPayload = buildTemplateBatchProgressPayload(batchHistory);

  return {
    ...progressPayload,
    dispatch_history_id: batchHistory?.id || null,
    template_id: templateId,
    template_name: templateName,
    language: languageCode,
    template_category: templateCategory,
    lista_transmissao_id: listaTransmissaoId,
    batch_status: progressPayload.status,
    uploaded_media_type: uploadedHeaderMedia?.mediaType || null,
    lead_started_messages_generate_auto_message: Boolean(
      leadStartedMessagesGenerateAutoMessage
    ),
    saved_header_media:
      uploadedHeaderMedia?.mediaType === "image" ? uploadedHeaderMedia : null,
    results: [],
  };
}

function normalizeTemplateDispatchReportType(value) {
  const normalized = String(value || "all").trim().toLowerCase();
  return normalized === "list" || normalized === "single" ? normalized : "all";
}

function normalizeTemplateDispatchReportStatus(value) {
  const normalized = String(value || "all").trim().toLowerCase();
  return [
    "all",
    "processing",
    "completed",
    "stopped_on_error",
    "failed",
  ].includes(normalized)
    ? normalized
    : "all";
}

async function resolveTemplateDispatchReportAllowedMetaParamIds(data) {
  const usuarioId = normalizeIntegerId(data?.usuario_id);
  if (!usuarioId || !data?.empresa_id) {
    return [];
  }

  const allowedRows = await executeAtendimento.execute_list_usuario_meta_numero_ids(
    usuarioId,
    data.empresa_id
  );
  return normalizeAllowedMetaParamIds(allowedRows);
}

function serializeTemplateDispatchReportSummary(row) {
  if (!row) return null;

  const metadata = row.metadata && typeof row.metadata === "object"
    ? row.metadata
    : {};

  return {
    dispatch_history_id: row.id || null,
    empresa_meta_param_id: row.empresa_meta_param_id || null,
    meta_numero_conta: row.meta_numero_conta || "",
    meta_nome_conta: row.meta_nome_conta || "",
    usuario_id: row.usuario_id || null,
    usuario_nome: row.usuario_nome || "Sistema",
    template_id: row.template_id || null,
    template_name: row.template_name || "",
    template_language: row.template_language || "",
    template_category: row.template_category || "",
    lista_transmissao_id: row.lista_transmissao_id || null,
    lista_nome: row.lista_nome || null,
    lista_descricao: row.lista_descricao || null,
    lista_total_contatos: Number(row.lista_total_contatos || 0),
    total_clientes: Number(row.total_clientes || 0),
    processados: Number(row.processados || 0),
    enviados: Number(row.enviados || 0),
    recebidos: Number(row.recebidos || 0),
    recebidos_unicos: Number(row.recebidos_unicos || 0),
    visualizados: Number(row.visualizados || 0),
    respondidos: Number(row.respondidos || 0),
    respondidos_unicos: Number(row.respondidos_unicos || 0),
    erros: Number(row.erros || 0),
    custo_unitario: Number(row.custo_unitario || 0),
    valor_total: Number(row.valor_total || 0),
    moeda: row.moeda || "USD",
    data_inicio: row.data_inicio ? new Date(row.data_inicio).toISOString() : null,
    data_fim: row.data_fim ? new Date(row.data_fim).toISOString() : null,
    duracao_ms: Number(row.duracao_ms || 0),
    dispatch_type: row.dispatch_type || "single",
    status: row.status || "processing",
    metadata,
  };
}

function serializeTemplateQuickSuggestion(row) {
  if (!row) return null;

  const source = String(row.source || "").trim().toLowerCase() === "popular"
    ? "popular"
    : "recent";

  return {
    template_name: String(row.template_name || "").trim(),
    template_language: String(row.template_language || "pt_BR").trim() || "pt_BR",
    usage_count: Math.max(0, Number(row.usage_count || 0)),
    last_used_at: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
    source,
  };
}

function serializeTemplateDispatchReportItem(row) {
  if (!row) return null;

  const metadata = row.metadata && typeof row.metadata === "object"
    ? row.metadata
    : {};

  return {
    item_id: row.id || null,
    dispatch_history_id: row.disparo_lote_id || null,
    empresa_meta_param_id: row.empresa_meta_param_id || null,
    cliente_id: row.cliente_id || null,
    conversa_id: row.conversa_id || null,
    contato_nome: row.contato_nome || null,
    email: row.email || null,
    numero_original: row.numero_original || null,
    numero_normalizado: row.numero_normalizado || null,
    message_id: row.message_id || null,
    message_status: row.message_status || null,
    sucesso: Boolean(row.sucesso),
    custo_unitario: Number(row.custo_unitario || 0),
    valor_cobrado: Number(row.valor_cobrado || 0),
    enviado_em: row.enviado_em ? new Date(row.enviado_em).toISOString() : null,
    recebido_em: row.recebido_em ? new Date(row.recebido_em).toISOString() : null,
    erro_em: row.erro_em ? new Date(row.erro_em).toISOString() : null,
    erro_mensagem: row.erro_mensagem || null,
    erro_codigo: row.erro_codigo || null,
    erro_subcodigo: row.erro_subcodigo || null,
    erro_tipo: row.erro_tipo || null,
    respondido_em: row.respondido_em ? new Date(row.respondido_em).toISOString() : null,
    recebido: Boolean(row.recebido),
    visualizado: Boolean(row.visualizado),
    respondeu: Boolean(row.respondeu),
    metadata,
  };
}

function buildTemplateDispatchReportSummaryTotals(items = []) {
  return items.reduce((acc, item) => {
    acc.total_disparos += 1;
    acc.total_clientes += Number(item?.total_clientes || 0);
    acc.total_enviados += Number(item?.enviados || 0);
    acc.total_recebidos += Number(item?.recebidos || 0);
    acc.total_recebidos_unicos += Number(item?.recebidos_unicos || 0);
    acc.total_visualizados += Number(item?.visualizados || 0);
    acc.total_respondidos += Number(item?.respondidos || 0);
    acc.total_respondidos_unicos += Number(item?.respondidos_unicos || 0);
    acc.total_erros += Number(item?.erros || 0);
    acc.total_custo = Number((acc.total_custo + Number(item?.valor_total || 0)).toFixed(6));
    return acc;
  }, {
    total_disparos: 0,
    total_clientes: 0,
    total_enviados: 0,
    total_recebidos: 0,
    total_recebidos_unicos: 0,
    total_visualizados: 0,
    total_respondidos: 0,
    total_respondidos_unicos: 0,
    total_erros: 0,
    total_custo: 0,
  });
}

async function processTemplateDispatchBatchJob({
  data,
  items,
  stopOnError,
  parametros,
  templateName,
  languageCode,
  selectedTemplate,
  uploadedHeaderMedia,
  batchHistory,
  templateId,
  templateCategory,
  startedAt,
  progressMetadataBase,
}) {
  let currentBatchHistory = batchHistory;
  const dispatchUnitCost = getTemplateDispatchUnitCostUsd(templateCategory);
  const results = [];

  const persistBatchProgress = async (status, interrupted = false, extraMetadata = {}) => {
    if (!currentBatchHistory?.id) return null;
    const successCount = results.filter((entry) => entry.success).length;
    const errorCount = results.length - successCount;
    const partialCostSummary = buildTemplateBatchCostSummary({
      templateCategory,
      successCount,
    });

    const rows = await execute.execute_update_template_dispatch_batch_history({
      id: currentBatchHistory.id,
      processados: results.length,
      enviados: successCount,
      erros: errorCount,
      interrompido_no_erro: interrupted,
      valor_total: Number(partialCostSummary?.summary?.total_cost || 0),
      data_fim: status === "processing" ? null : new Date(),
      duracao_ms:
        status === "processing"
          ? null
          : Math.max(Date.now() - startedAt.getTime(), 0),
      metadata: {
        ...progressMetadataBase,
        ...extraMetadata,
        status,
      },
    });

    currentBatchHistory = rows?.[0] || currentBatchHistory;
    return currentBatchHistory;
  };

  const persistBatchItem = async (itemResult) => {
    if (!currentBatchHistory?.id) return;
    await execute.execute_insert_template_dispatch_batch_item_history({
      disparo_lote_id: currentBatchHistory.id,
      empresa_id: data.empresa_id,
      empresa_meta_param_id: parametros.id || data.meta_param_id || null,
      cliente_id: itemResult.cliente_id || null,
      template_id: templateId,
      template_name: templateName,
      template_language: languageCode,
      numero_original: itemResult.numero_original || null,
      numero_normalizado: itemResult.numero || null,
      contato_nome: itemResult.contato_nome || null,
      email: itemResult.email || null,
      conversa_id: itemResult.conversa_id || null,
      message_id: itemResult.message_id || null,
      message_status: itemResult.message_status || null,
      sucesso: Boolean(itemResult.success),
      custo_unitario: itemResult.custo_unitario || 0,
      valor_cobrado: itemResult.valor_cobrado || 0,
      enviado_em: itemResult.enviado_em || null,
      recebido_em: itemResult.recebido_em || null,
      erro_em: itemResult.erro_em || null,
      erro_mensagem: itemResult.error_message || null,
      erro_codigo: itemResult.error_code ?? null,
      erro_subcodigo: itemResult.error_subcode ?? null,
      erro_tipo: itemResult.error_type || null,
      metadata: itemResult.metadata || {},
    });
  };

  try {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index] || {};
      const recipientContext = buildBatchRecipientContext(item);
      const mergedItem = {
        ...data,
        ...item,
        empresa_id: data.empresa_id,
        template_name: templateName,
        language_code: languageCode,
      };

      const numero = await resolveDispatchNumber(mergedItem);
      if (!numero) {
        const failedItem = {
          index,
          ...recipientContext,
          numero: null,
          conversa_id: mergedItem.conversa_id || null,
          success: false,
          enviado_em: null,
          recebido_em: null,
          erro_em: new Date().toISOString(),
          custo_unitario: 0,
          valor_cobrado: 0,
          error_message:
            "Informe numero/telefone/to ou conversa_id para localizar o destinatario.",
          error_code: null,
          error_subcode: null,
          error_type: null,
          metadata: {
            reason: "missing_recipient_number",
          },
        };
        results.push(failedItem);
        await persistBatchItem(failedItem);
        await persistBatchProgress(
          stopOnError ? "stopped_on_error" : "processing",
          Boolean(stopOnError)
        );

        if (stopOnError) {
          break;
        }

        continue;
      }
      const clienteId =
        mergedItem.cliente_id === undefined || mergedItem.cliente_id === null
          ? null
          : Number(mergedItem.cliente_id) || mergedItem.cliente_id;
      const conversaId = normalizeIntegerId(mergedItem.conversa_id) || null;

      const { templatePayload } = buildTemplatePayloadForDispatch(
        mergedItem,
        uploadedHeaderMedia
      );
      const resolvedDispatchContext = await resolveTemplateDispatchPayloadForRecipient(
        {
          ...templatePayload,
          ...mergedItem,
          cliente_id: clienteId || mergedItem.cliente_id || null,
          conversa_id: conversaId || mergedItem.conversa_id || null,
        }
      );
      if (resolvedDispatchContext.errors.length) {
        const failedItem = {
          index,
          ...recipientContext,
          numero,
          conversa_id: conversaId,
          success: false,
          enviado_em: null,
          recebido_em: null,
          erro_em: new Date().toISOString(),
          custo_unitario: 0,
          valor_cobrado: 0,
          error_message:
            "Nao foi possivel preencher todos os parametros dinamicos do template.",
          error_code: null,
          error_subcode: null,
          error_type: null,
          errors: resolvedDispatchContext.errors,
          metadata: {
            reason: "missing_dynamic_template_field",
            lead_started_messages_generate_auto_message: parseBooleanFlag(
              data.lead_started_messages_generate_auto_message,
              true
            ),
          },
        };
        results.push(failedItem);
        await persistBatchItem(failedItem);
        await persistBatchProgress(
          stopOnError ? "stopped_on_error" : "processing",
          Boolean(stopOnError)
        );

        if (stopOnError) {
          break;
        }

        continue;
      }

      const resolvedTemplatePayload = resolvedDispatchContext.templatePayload;
      const previewMessage = buildTemplatePreviewMessage(
        selectedTemplate,
        resolvedTemplatePayload
      );
      const templateChatPayload = buildTemplateChatPayload(
        selectedTemplate,
        resolvedTemplatePayload,
        uploadedHeaderMedia
      );
      const validation = validateTemplateForDispatch(
        selectedTemplate,
        resolvedTemplatePayload
      );

      if (!validation.valid) {
        const failedItem = {
          index,
          ...recipientContext,
          numero,
          conversa_id: conversaId,
          success: false,
          enviado_em: null,
          recebido_em: null,
          erro_em: new Date().toISOString(),
          custo_unitario: 0,
          valor_cobrado: 0,
          error_message:
            "Os dados enviados nao correspondem a estrutura do template.",
          error_code: null,
          error_subcode: null,
          error_type: null,
          errors: validation.errors,
          template: validation.template || null,
          preview: validation.preview || null,
          metadata: {
            reason: "template_validation_failed",
            chat_preview_text: previewMessage || null,
            chat_preview_kind: "template",
            chat_template: templateChatPayload || null,
            lead_started_messages_generate_auto_message: parseBooleanFlag(
              data.lead_started_messages_generate_auto_message,
              true
            ),
          },
        };
        results.push(failedItem);
        await persistBatchItem(failedItem);
        await persistBatchProgress(
          stopOnError ? "stopped_on_error" : "processing",
          Boolean(stopOnError)
        );

        if (stopOnError) {
          break;
        }

        continue;
      }

      try {
        const sentAt = new Date();
        const response = await utils.sendWhatsappTemplateMessage(
          numero,
          resolvedTemplatePayload,
          conversaId,
          data.empresa_id,
          mergedItem.meta_param_id || data.meta_param_id || null,
          resolveRequestUsuarioId(data)
        );

        const successItem = {
          index,
          ...recipientContext,
          numero,
          conversa_id: conversaId,
          success: true,
          message_id: response?.messages?.[0]?.id || null,
          message_status: response?.messages?.[0]?.message_status || null,
          enviado_em: sentAt.toISOString(),
          recebido_em: null,
          erro_em: null,
          custo_unitario: dispatchUnitCost,
          valor_cobrado: dispatchUnitCost,
          preview: validation.preview || null,
          meta_response: response,
          metadata: {
            request_payload: response?.request_payload || null,
            chat_preview_text:
              previewMessage ||
              resolvedTemplatePayload.preview_message ||
              null,
            chat_preview_kind: "template",
            chat_template: templateChatPayload || null,
            lead_started_messages_generate_auto_message: parseBooleanFlag(
              data.lead_started_messages_generate_auto_message,
              true
            ),
          },
        };
        results.push(successItem);
        await persistBatchItem(successItem);
        await persistBatchProgress("processing", false);
      } catch (error) {
        const failedAt = new Date();
        const normalizedError = normalizeBatchError(
          error,
          "Falha ao enviar template para o destinatario."
        );
        const failedItem = {
          index,
          ...recipientContext,
          numero,
          conversa_id: conversaId,
          success: false,
          enviado_em: null,
          recebido_em: null,
          erro_em: failedAt.toISOString(),
          custo_unitario: 0,
          valor_cobrado: 0,
          error_message: normalizedError.message,
          error_code: normalizedError.code,
          error_subcode: normalizedError.error_subcode,
          error_type: normalizedError.type,
          error: normalizedError.raw,
          preview: validation.preview || null,
          metadata: {
            reason: "meta_send_failed",
            chat_preview_text: previewMessage || null,
            chat_preview_kind: "template",
            chat_template: templateChatPayload || null,
            lead_started_messages_generate_auto_message: parseBooleanFlag(
              data.lead_started_messages_generate_auto_message,
              true
            ),
          },
        };
        results.push(failedItem);
        await persistBatchItem(failedItem);
        await persistBatchProgress(
          stopOnError ? "stopped_on_error" : "processing",
          Boolean(stopOnError)
        );

        if (stopOnError) {
          break;
        }
      }
    }

    const successCount = results.filter((item) => item.success).length;
    const errorCount = results.length - successCount;
    const finishedAt = new Date();
    const costSummary = buildTemplateBatchCostSummary({
      templateCategory,
      successCount,
    });

    await execute.execute_update_template_dispatch_batch_history({
      id: currentBatchHistory.id,
      processados: results.length,
      enviados: successCount,
      erros: errorCount,
      interrompido_no_erro: Boolean(stopOnError && results.length < items.length),
      valor_total: Number(costSummary?.summary?.total_cost || 0),
      data_fim: finishedAt,
      duracao_ms: Math.max(finishedAt.getTime() - startedAt.getTime(), 0),
      metadata: {
        ...progressMetadataBase,
        status:
          stopOnError && results.length < items.length
            ? "stopped_on_error"
            : "completed",
      },
    });
  } catch (sendError) {
    if (currentBatchHistory?.id) {
      try {
        await execute.execute_update_template_dispatch_batch_history({
          id: currentBatchHistory.id,
          processados: currentBatchHistory.processados ?? null,
          enviados: currentBatchHistory.enviados ?? null,
          erros: currentBatchHistory.erros ?? null,
          interrompido_no_erro: false,
          data_fim: new Date(),
          duracao_ms: Math.max(Date.now() - startedAt.getTime(), 0),
          metadata: {
            ...progressMetadataBase,
            status: "failed",
            fatal_error: sendError?.message || String(sendError),
          },
        });
      } catch (historyError) {
        console.warn(
          "Nao foi possivel atualizar o historico do lote com erro fatal:",
          historyError?.message || historyError
        );
      }
    }

    console.error(
      "Erro no processamento em background de /disparar_template_lote:",
      sendError?.response?.data || sendError
    );
  } finally {
    await cleanupUploadedTemplateMedia(uploadedHeaderMedia);
  }
}

////////////////////////////rotas//////////////////////////////////////////////

rota.post("/get_templates", async (req, res) =>
  handleGetTemplates(req, res, "/get_templates")
);

rota.post("/get_teemplate", async (req, res) =>
  handleGetTemplates(req, res, "/get_teemplate")
);

rota.post("/status_integracao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }

    const contas = await execute.execute_list_paramentros_whats_empresa(
      data.empresa_id,
      true
    );
    const parametros =
      contas.find((item) => item.ativo !== false) ||
      contas[0] ||
      null;
    return res.json(
      utils.jsonMount(true, mountMetaStatus(parametros, contas), "")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/status_integracao"));
  }
});

rota.post("/lista_numeros_vinculados", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const contas = await execute.execute_list_paramentros_whats_empresa(
      data.empresa_id,
      true
    );
    let accounts = mountMetaStatus(null, contas).accounts || [];

    const usuarioId = resolveRequestUsuarioId(data);
    if (usuarioId > 0) {
      const allowedRows = await executeUser.execute_list_empresa_meta_numeros_ativos(
        data.empresa_id,
        usuarioId
      );
      const allowedMetaParamIds = normalizeAllowedMetaParamIds(allowedRows);
      accounts = accounts.filter((account) =>
        allowedMetaParamIds.includes(Number(account?.id || 0))
      );
    }

    return res.json(
      utils.jsonMount(
        true,
        accounts,
        ""
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/lista_numeros_vinculados"));
  }
});

rota.post("/perfil_whatsapp", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const parametros = await getMetaParametrosOrFail(data, {
      preferMetaParamId: true,
    });
    const integrationError = validateMetaIntegrationReady(parametros);
    if (integrationError) {
      return res.json(utils.jsonMount(false, {}, integrationError));
    }

    const phoneNumberId =
      parametros.meta_phone_number_id ||
      parametros.phone_number_id ||
      parametros.numero ||
      null;

    if (!phoneNumberId) {
      return res.json(
        utils.jsonMount(false, {}, "Phone Number ID nao encontrado para a conta Meta.")
      );
    }

    const metaAccessToken = getMetaSystemAccessToken();
    const response = await axios.get(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${phoneNumberId}/whatsapp_business_profile`,
      {
        headers: {
          Authorization: `Bearer ${metaAccessToken}`,
        },
        params: {
          fields: [
            "about",
            "address",
            "description",
            "email",
            "profile_picture_url",
            "websites",
            "vertical",
          ].join(","),
        },
      }
    );

    return res.json(
      utils.jsonMount(
        true,
        normalizeWhatsAppProfileResponse(response.data, parametros),
        ""
      )
    );
  } catch (error) {
    console.error("Erro na rota /perfil_whatsapp:", error?.response?.data || error);
    return res.json(utils.errorHandle(error, "/perfil_whatsapp"));
  }
});

rota.post(
  "/atualizar_perfil_whatsapp",
  upload.fields([{ name: "profile_picture_file", maxCount: 1 }]),
  async (req, res) => {
    try {
      const payload = req.body;
      const data = security.jwtdecript(payload);

      if (!data) {
        return res
          .status(401)
          .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
      }

      const parametros = await getMetaParametrosOrFail(data, {
        preferMetaParamId: true,
      });
      const integrationError = validateMetaIntegrationReady(parametros);
      if (integrationError) {
        return res.json(utils.jsonMount(false, {}, integrationError));
      }

      const phoneNumberId =
        parametros.meta_phone_number_id ||
        parametros.phone_number_id ||
        parametros.numero ||
        null;

      if (!phoneNumberId) {
        return res.json(
          utils.jsonMount(false, {}, "Phone Number ID nao encontrado para a conta Meta.")
        );
      }

      const metaAccessToken = getMetaSystemAccessToken();
      const profilePictureFile = req.files?.profile_picture_file?.[0] || null;
      validateWhatsAppProfilePictureFile(profilePictureFile);

      const currentProfileResponse = await axios.get(
        `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${phoneNumberId}/whatsapp_business_profile`,
        {
          headers: {
            Authorization: `Bearer ${metaAccessToken}`,
          },
          params: {
            fields: [
              "about",
              "address",
              "description",
              "email",
              "profile_picture_url",
              "websites",
              "vertical",
            ].join(","),
          },
        }
      );
      const currentProfile = normalizeWhatsAppProfileResponse(
        currentProfileResponse.data,
        parametros
      );

      const profilePictureHandle = profilePictureFile
        ? await uploadMetaResumableFileHandle(profilePictureFile, metaAccessToken)
        : null;

      const updatePayload = buildWhatsAppProfileUpdatePayload(
        data,
        currentProfile,
        profilePictureHandle
      );

      const updateResponse = await axios.post(
        `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${phoneNumberId}/whatsapp_business_profile`,
        updatePayload,
        {
          headers: {
            Authorization: `Bearer ${metaAccessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      let normalizedProfile = normalizeWhatsAppProfileResponse(updatePayload, parametros);

      try {
        const profileResponse = await axios.get(
          `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${phoneNumberId}/whatsapp_business_profile`,
          {
            headers: {
              Authorization: `Bearer ${metaAccessToken}`,
            },
            params: {
              fields: [
                "about",
                "address",
                "description",
                "email",
                "profile_picture_url",
                "websites",
                "vertical",
              ].join(","),
            },
          }
        );

        normalizedProfile = normalizeWhatsAppProfileResponse(
          profileResponse.data,
          parametros
        );
      } catch (profileFetchError) {
        console.warn(
          "Nao foi possivel recarregar o perfil WhatsApp apos salvar:",
          profileFetchError?.response?.data || profileFetchError
        );
      }

      return res.json(
        utils.jsonMount(
          true,
          {
            ...normalizedProfile,
            meta_response: updateResponse.data,
          },
          "Perfil do WhatsApp atualizado com sucesso."
        )
      );
    } catch (error) {
      console.error(
        "Erro na rota /atualizar_perfil_whatsapp:",
        error?.response?.data || error
      );
      return res.json(utils.errorHandle(error, "/atualizar_perfil_whatsapp"));
    }
  }
);

rota.post("/salvar_integracao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    const normalizedPayload = { ...data };
    let payloadsToPersist = [normalizedPayload];
    const webhookVerifyToken = DEFAULT_WEBHOOK_VERIFY_TOKEN;
    const webhookUrl = buildWebhookUrl(req, normalizedPayload.webhook_url);
    normalizedPayload.webhook_verify_token = webhookVerifyToken;
    normalizedPayload.meta_webhook_verify_token = webhookVerifyToken;
    normalizedPayload.webhook_url = webhookUrl;
    normalizedPayload.meta_webhook_url = webhookUrl;

    if (normalizedPayload.signupCode) {
      const isWhatsappBusinessAppFlow =
        normalizedPayload.embedded_signup_event ===
          "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" ||
        normalizedPayload.is_wa_login_user === true;
      const tokenData = await exchangeCodeForAccessToken(
        normalizedPayload.signupCode,
        normalizedPayload.redirect_uri
      );
      normalizedPayload.access_token = tokenData.access_token;
      normalizedPayload.token_type = tokenData.token_type || normalizedPayload.type;
      normalizedPayload.token_expires_in = tokenData.expires_in || normalizedPayload.token_expires_in;
      const signupContext = await resolveMetaSignupContext(
        tokenData.access_token,
        normalizedPayload.wabaId || normalizedPayload.whatsapp_account_id,
        normalizedPayload.phoneNumberId || normalizedPayload.phone_number_id || null,
        normalizedPayload.businessId || null
      );
      const phoneNumbers = Array.isArray(signupContext?.phone_numbers)
        ? signupContext.phone_numbers
        : [];

      const selectedPhoneInfo = findPhoneNumberInfo(
        phoneNumbers,
        normalizedPayload,
        { requireExactPhoneNumberId: isWhatsappBusinessAppFlow }
      );
      normalizedPayload.wabaId =
        signupContext.whatsapp_account_id ||
        normalizedPayload.wabaId ||
        normalizedPayload.whatsapp_account_id ||
        null;
      normalizedPayload.whatsapp_account_id =
        normalizedPayload.whatsapp_account_id || normalizedPayload.wabaId || null;
      normalizedPayload.whatsapp_account_name =
        normalizedPayload.whatsapp_account_name ||
        signupContext.whatsapp_account_name ||
        null;
      normalizedPayload.businessId =
        normalizedPayload.businessId || signupContext.business_id || null;
      normalizedPayload.business_name =
        normalizedPayload.business_name || signupContext.business_name || null;
      normalizedPayload.phoneNumberId =
        normalizedPayload.phoneNumberId ||
        normalizedPayload.phone_number_id ||
        normalizedPayload.number_phone_id ||
        null;

      if (phoneNumbers.length) {
        payloadsToPersist = phoneNumbers
          .filter((phoneInfo) => String(phoneInfo?.id || "").trim())
          .map((phoneInfo) => ({
            ...normalizedPayload,
            phoneNumberId: String(phoneInfo.id),
            phone_number_id: String(phoneInfo.id),
            display_phone_number:
              phoneInfo.display_phone_number ||
              normalizedPayload.display_phone_number ||
              null,
            meta_display_phone_number:
              phoneInfo.display_phone_number ||
              normalizedPayload.meta_display_phone_number ||
              null,
            verified_name:
              phoneInfo.verified_name || normalizedPayload.verified_name || null,
            meta_verified_name:
              phoneInfo.verified_name ||
              normalizedPayload.meta_verified_name ||
              null,
            meta_phone_number_details: phoneInfo,
          }));

        normalizedPayload.phoneNumberId =
          normalizedPayload.phoneNumberId ||
          selectedPhoneInfo?.id ||
          payloadsToPersist[0]?.phoneNumberId ||
          null;
        normalizedPayload.phone_number_id =
          normalizedPayload.phone_number_id ||
          normalizedPayload.phoneNumberId ||
          null;
      } else if (!selectedPhoneInfo) {
        if (
          normalizedPayload.phoneNumberId &&
          !isWhatsappBusinessAppFlow
        ) {
          normalizedPayload.phone_number_id = normalizedPayload.phoneNumberId;
        } else {
          return res.json(
            utils.jsonMount(
              false,
              {
                phone_number_id_informado: getRequestedPhoneNumberId(normalizedPayload),
                numero_informado: getRequestedPhoneNumber(normalizedPayload),
                whatsapp_account_id: normalizedPayload.whatsapp_account_id || null,
                phone_numbers: phoneNumbers
              },
              isWhatsappBusinessAppFlow
                ? "A Meta nao retornou o phone_number_id exato do numero escaneado no app WhatsApp Business. O sistema nao salvou para evitar vincular outro numero da empresa."
                : "Nenhum numero retornado pela Meta corresponde ao identificador enviado pelo front."
            )
          );
        }
      }

      if (!phoneNumbers.length) {
        normalizedPayload.phoneNumberId =
          normalizedPayload.phoneNumberId || selectedPhoneInfo?.id || null;
        normalizedPayload.phone_number_id =
          normalizedPayload.phone_number_id || selectedPhoneInfo?.id || normalizedPayload.phoneNumberId;
        normalizedPayload.display_phone_number =
          selectedPhoneInfo?.display_phone_number ||
          normalizedPayload.display_phone_number ||
          null;
        normalizedPayload.meta_display_phone_number =
          selectedPhoneInfo?.display_phone_number ||
          normalizedPayload.meta_display_phone_number ||
          null;
        normalizedPayload.verified_name =
          selectedPhoneInfo?.verified_name ||
          normalizedPayload.verified_name ||
          null;
        normalizedPayload.meta_verified_name =
          selectedPhoneInfo?.verified_name ||
          normalizedPayload.meta_verified_name ||
          null;
        normalizedPayload.meta_phone_number_details =
          selectedPhoneInfo ||
          {
            id: normalizedPayload.phone_number_id,
            platform_type:
              normalizedPayload.is_wa_login_user ||
              normalizedPayload.embedded_signup_event ===
                "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
                ? "WHATSAPP_BUSINESS_APP"
                : null
          };
        payloadsToPersist = [normalizedPayload];
      }
    }

    const requiredFields = [];
    if (!normalizedPayload.access_token) {
      requiredFields.push("access_token");
    }
    if (
      !payloadsToPersist.some(
        (item) => item.phoneNumberId || item.phone_number_id
      )
    ) {
      requiredFields.push("phone_number_id");
    }
    if (
      !normalizedPayload.wabaId
    ) {
      requiredFields.push("whatsapp_account_id");
    }

    if (requiredFields.length) {
      return res.json(
        utils.jsonMount(
          false,
          { campos_faltantes: requiredFields },
          "Dados insuficientes para salvar a integração da Meta."
        )
      );
    }

    if (!webhookUrl) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Nao foi possivel montar a URL do webhook. Configure META_WEBHOOK_BASE_URL ou envie webhook_url no payload."
        )
      );
    }

    const webhookSubscription = await subscribeMetaWebhook(
      normalizedPayload.wabaId || normalizedPayload.whatsapp_account_id,
      normalizedPayload.access_token,
      webhookUrl,
      webhookVerifyToken
    );

    normalizedPayload.meta_webhook_subscription = webhookSubscription;

    for (const payloadItem of payloadsToPersist) {
      await execute.execute_upsert_paramentros_whats(
        normalizeMetaPayload({
          ...payloadItem,
          meta_webhook_subscription: webhookSubscription,
        })
      );
    }
    const contas = await execute.execute_list_paramentros_whats_empresa(
      normalizedPayload.empresa_id,
      true
    );
    const parametros =
      contas.find((item) => item.ativo !== false) ||
      contas[0] ||
      null;

    return res.json(
      utils.jsonMount(
        true,
        mountMetaStatus(parametros, contas),
        "Integração da Meta salva com sucesso."
      )
    );
  } catch (error) {
    console.error("Erro na rota /salvar_integracao:", error?.response?.data || error);
    const metaError = error?.response?.data?.error || {};
    const message =
      String(
        metaError?.error_user_msg ||
          metaError?.message ||
          error?.message ||
          ""
      ).trim() || "Tente novamente mais tarde!";
    return res.json(utils.jsonMount(false, {}, message));
  }
});

rota.post("/desvincular_numero", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    const metaParamId = Number(
      data.meta_param_id || data.id || data.empresa_meta_param_id
    );

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    if (!Number.isInteger(metaParamId) || metaParamId <= 0) {
      return res.json(
        utils.jsonMount(false, {}, "Informe meta_param_id valido.")
      );
    }

    const ret = await execute.execute_desativar_paramentros_whats(
      empresaId,
      metaParamId
    );

    if (!ret?.length) {
      return res.json(
        utils.jsonMount(false, {}, "Numero Meta nao encontrado para a empresa.")
      );
    }

    const contas = await execute.execute_list_paramentros_whats_empresa(
      empresaId,
      true
    );
    const parametros =
      contas.find((item) => item.ativo !== false) ||
      contas[0] ||
      null;

    return res.json(
      utils.jsonMount(
        true,
        mountMetaStatus(parametros, contas),
        "Numero desvinculado com sucesso."
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/desvincular_numero"));
  }
});

rota.get("/webhook", async (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode !== "subscribe" || !token || !challenge) {
      return res.sendStatus(400);
    }

    if (token !== DEFAULT_WEBHOOK_VERIFY_TOKEN) {
      return res.sendStatus(403);
    }

    return res.status(200).send(challenge);
  } catch (error) {
    console.error("Erro na validação do webhook Meta:", error);
    return res.sendStatus(500);
  }
});

rota.post("/webhook", async (req, res) => {
  try {
    if (!verifyMetaWebhookSignature(req)) {
      return res.sendStatus(401);
    }
    const identifiers = extractWebhookIdentifiers(req.body);
    const parametros = await execute.execute_get_paramentros_whats_by_identifiers(
      identifiers.phone_number_id,
      identifiers.wa_id,
      identifiers.whatsapp_account_id
    );

    if (!parametros || !parametros.length) {
      console.warn(
        "Webhook Meta recebido sem empresa correspondente:",
        JSON.stringify({ identifiers, body: req.body })
      );
      return res.sendStatus(200);
    }

    console.log(
      "Webhook Meta recebido:",
      JSON.stringify({
        empresa_id: parametros[0].empresa_id,
        phone_number_id: identifiers.phone_number_id,
        wa_id: identifiers.wa_id,
        whatsapp_account_id: identifiers.whatsapp_account_id,
        body: req.body
      })
    );

    const changes = getPrimaryWebhookChanges(req.body);

    for (const change of changes) {
      if (!isWebhookChangeForMetaMessages(change)) {
        continue;
      }

      if (Array.isArray(change?.value?.messages) && change.value.messages.length) {
        await persistIncomingMetaMessage(change, parametros[0]);
      }

      if (
        Array.isArray(change?.value?.message_echoes) &&
        change.value.message_echoes.length
      ) {
        await persistMetaMessageEcho(change, parametros[0]);
      }

      if (Array.isArray(change?.value?.statuses) && change.value.statuses.length) {
        for (const statusEntry of change.value.statuses) {
          const statusId = mapWebhookStatus(statusEntry?.status);
          if (!statusEntry?.id || !statusId) {
            continue;
          }

          if (String(statusEntry?.status || "").toLowerCase() === "failed") {
            console.warn(
              "Meta status failed:",
              JSON.stringify(
                {
                  empresa_id: parametros[0].empresa_id,
                  message_id: statusEntry.id,
                  recipient_id: statusEntry.recipient_id || null,
                  status: statusEntry.status,
                  errors: statusEntry.errors || [],
                  pricing: statusEntry.pricing || null
                },
                null,
                2
              )
            );
          }

          await execute.execute_update_message_status(statusEntry.id, statusId);
          await execute.execute_update_template_dispatch_item_status_by_message_id({
            message_id: statusEntry.id,
            message_status: String(statusEntry?.status || "").toLowerCase() || null,
            received_at: ["delivered", "read"].includes(
              String(statusEntry?.status || "").toLowerCase()
            )
              ? new Date()
              : null,
            error_at:
              String(statusEntry?.status || "").toLowerCase() === "failed"
                ? new Date()
                : null,
            error_message: statusEntry?.errors?.[0]?.error_data?.details ||
              statusEntry?.errors?.[0]?.title ||
              statusEntry?.errors?.[0]?.message ||
              null,
            error_code: statusEntry?.errors?.[0]?.code || null,
            error_subcode: statusEntry?.errors?.[0]?.error_subcode || null,
            error_type: statusEntry?.errors?.[0]?.type || null,
            metadata: {
              webhook_status: statusEntry?.status || null,
              conversation: statusEntry?.conversation || null,
              pricing: statusEntry?.pricing || null,
              errors: statusEntry?.errors || [],
            },
          });
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Erro na rota /meta/webhook:", error);
    return res.sendStatus(500);
  }
});

rota.post("/metricas_template", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }

    if (!data.template_id) {
      return res.json(
        utils.jsonMount(false, {}, "Informe o campo template_id.")
      );
    }

    const parametros = await getMetaParametrosOrFail(data, {
      preferMetaParamId: true,
    });
    const integrationError = validateMetaIntegrationReady(parametros);
    if (integrationError) {
      return res.json(utils.jsonMount(false, {}, integrationError));
    }
    const metaAccessToken = getMetaSystemAccessToken();

    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(now.getDate() - 7);

    const start = toUnix(data.start_date, defaultStart);
    const end = toUnix(data.end_date, now);
    const granularity = (data.granularity || "DAILY").toUpperCase();
    const selectedMetaParamId =
      Number(parametros.id || data.meta_param_id || 0) > 0
        ? Number(parametros.id || data.meta_param_id || 0)
        : null;

    const queryParams = {
      start,
      end,
      granularity,
      template_ids: JSON.stringify([String(data.template_id)])
    };

    if (Array.isArray(data.metric_types) && data.metric_types.length) {
      queryParams.metric_types = JSON.stringify(data.metric_types);
    }

    if (Array.isArray(data.country_codes) && data.country_codes.length) {
      queryParams.country_codes = JSON.stringify(data.country_codes);
    }

    if (Array.isArray(data.phone_numbers) && data.phone_numbers.length) {
      queryParams.phone_numbers = JSON.stringify(data.phone_numbers);
    }

    const response = await axios.get(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${parametros.whatsapp_account_id}/template_analytics`,
      {
        headers: {
          Authorization: `Bearer ${metaAccessToken}`
        },
        params: queryParams
      }
    );

    const apiData =
      response.data?.data ||
      response.data?.template_analytics?.data ||
      [];

    return res.json(
      utils.jsonMount(
        true,
        {
          filters: {
            template_id: String(data.template_id),
            start,
            end,
            granularity
          },
          metrics: apiData,
          raw: response.data
        },
        ""
      )
    );
  } catch (error) {
    const metaError = error?.response?.data?.error || {};
    const isTemplateInsightsDisabled =
      Number(metaError?.error_subcode) === 4182004 ||
      String(metaError?.error_data || "")
        .toLowerCase()
        .includes("template insights have not been enabled");

    if (isTemplateInsightsDisabled) {
      const payload = req.body;
      const data = security.jwtdecript(payload) || {};
      const now = new Date();
      const defaultStart = new Date(now);
      defaultStart.setDate(now.getDate() - 7);

      const start = toUnix(data.start_date, defaultStart);
      const end = toUnix(data.end_date, now);
      const granularity = String(data.granularity || "DAILY").toUpperCase();

      return res.json(
        utils.jsonMount(
          true,
          {
            filters: {
              template_id: String(data.template_id || ""),
              start,
              end,
              granularity
            },
            metrics: [],
            insights_enabled: false,
            raw: error?.response?.data || null
          },
          metaError?.error_user_msg ||
            "Os insights de template ainda nao estao habilitados para esta conta do WhatsApp Business."
        )
      );
    }

    console.error("Erro na rota /metricas_template:", error?.response?.data || error);
    return res.json(utils.errorHandle(error, "/metricas_template"));
  }
});

rota.post("/criar_template", upload.fields([
  { name: "media_sample_file", maxCount: 1 }
]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }

    const parametros = await getMetaParametrosOrFail(data, {
      preferMetaParamId: true,
    });
    const integrationError = validateMetaIntegrationReady(parametros);
    if (integrationError) {
      return res.json(utils.jsonMount(false, {}, integrationError));
    }
    const metaAccessToken = getMetaSystemAccessToken();

    if (!data.name || !data.category || !data.language || !Array.isArray(data.components)) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Informe name, category, language e components para criar o template."
        )
      );
    }

    const sampleFile = req.files?.media_sample_file?.[0] || null;
    const templatePayload = await buildTemplateCreatePayload(
      data,
      sampleFile,
      metaAccessToken
    );

    const response = await axios.post(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${parametros.whatsapp_account_id}/message_templates`,
      templatePayload,
      {
        headers: {
          Authorization: `Bearer ${metaAccessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (
      sampleFile &&
      String(data.media_sample_type || "").trim().toUpperCase() === "IMAGE"
    ) {
      await utils.saveTemplateHeaderImageToGallery({
        empresa_id: parametros.empresa_id || data.empresa_id,
        meta_param_id: parametros.id || data.meta_param_id,
        template_name: data.name,
        language_code: data.language,
        file: sampleFile,
        ownerId: resolveRequestUsuarioId(data) || data.empresa_id || "meta_create",
      }).catch((galleryError) => {
        console.warn("[/meta/criar_template] template criado, mas a amostra nao foi salva na galeria:", {
          message: galleryError?.message,
          code: galleryError?.code,
          template_name: data.name,
        });
      });
    }

    return res.json(
      utils.jsonMount(true, response.data, "Template criado com sucesso.")
    );
  } catch (error) {
    console.error("Erro na rota /criar_template:", error?.response?.data || error);
    return res.json(
      utils.jsonMount(false, {}, formatTemplateCreateError(error))
    );
  }
});

rota.post("/editar_template", upload.fields([
  { name: "media_sample_file", maxCount: 1 }
]), async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const templateId = String(data.template_id || "").trim();
    if (!templateId || !data.name || !data.category || !data.language || !Array.isArray(data.components)) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Informe template_id, name, category, language e components para editar o template."
        )
      );
    }

    const parametros = await getMetaParametrosOrFail(data, {
      preferMetaParamId: true,
    });
    const integrationError = validateMetaIntegrationReady(parametros);
    if (integrationError) {
      return res.json(utils.jsonMount(false, {}, integrationError));
    }

    const metaAccessToken = getMetaSystemAccessToken();
    const ownedTemplatesResponse = await axios.get(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${parametros.whatsapp_account_id}/message_templates`,
      {
        headers: { Authorization: `Bearer ${metaAccessToken}` },
        params: {
          fields: "id,name,language,status,category",
          name: String(data.name).trim(),
          limit: 100,
        },
      }
    );
    const ownedTemplates = Array.isArray(ownedTemplatesResponse.data?.data)
      ? ownedTemplatesResponse.data.data
      : [];
    const ownedTemplate = ownedTemplates.find(
      (template) =>
        String(template?.id || "") === templateId &&
        String(template?.name || "") === String(data.name).trim() &&
        String(template?.language || "") === String(data.language).trim()
    );

    if (!ownedTemplate) {
      return res.status(403).json(
        utils.jsonMount(
          false,
          {},
          "O template informado nao pertence a conta Meta selecionada."
        )
      );
    }

    const sampleFile = req.files?.media_sample_file?.[0] || null;
    const completePayload = await buildTemplateCreatePayload(
      data,
      sampleFile,
      metaAccessToken
    );
    const currentStatus = String(ownedTemplate.status || "").trim().toUpperCase();
    if (!["APPROVED", "REJECTED", "PAUSED"].includes(currentStatus)) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          `Templates com status ${currentStatus || "desconhecido"} nao podem ser editados. Aguarde a revisao atual terminar.`
        )
      );
    }

    const updatePayload = {
      components: completePayload.components,
      ...(currentStatus !== "APPROVED"
        ? {
            category: completePayload.category,
            ...(completePayload.allow_category_change !== undefined
              ? { allow_category_change: completePayload.allow_category_change }
              : {}),
          }
        : {}),
    };
    const response = await axios.post(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${templateId}`,
      updatePayload,
      {
        headers: {
          Authorization: `Bearer ${metaAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (
      sampleFile &&
      String(data.media_sample_type || "").trim().toUpperCase() === "IMAGE"
    ) {
      await utils.saveTemplateHeaderImageToGallery({
        empresa_id: parametros.empresa_id || data.empresa_id,
        meta_param_id: parametros.id || data.meta_param_id,
        template_name: data.name,
        language_code: data.language,
        file: sampleFile,
        ownerId: resolveRequestUsuarioId(data) || data.empresa_id || "meta_edit",
      }).catch((galleryError) => {
        console.warn("[/meta/editar_template] template editado, mas a amostra nao foi salva na galeria:", {
          message: galleryError?.message,
          code: galleryError?.code,
          template_name: data.name,
        });
      });
    }

    return res.json(
      utils.jsonMount(true, response.data, "Template enviado para revisao com sucesso.")
    );
  } catch (error) {
    console.error("Erro na rota /editar_template:", error?.response?.data || error);
    return res.json(utils.jsonMount(false, {}, formatTemplateCreateError(error)));
  }
});

rota.post("/atualizar_numero_vinculado", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃƒÂ¡lido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    const metaParamId = Number(
      data.meta_param_id || data.id || data.empresa_meta_param_id
    );
    const cor = normalizeMetaColor(data.cor);

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    if (!Number.isInteger(metaParamId) || metaParamId <= 0) {
      return res.json(
        utils.jsonMount(false, {}, "Informe meta_param_id valido.")
      );
    }

    if (!cor) {
      return res.json(
        utils.jsonMount(false, {}, "Informe uma cor hexadecimal valida, como #16A34A.")
      );
    }

    const ret = await execute.execute_update_paramentros_whats_cor(
      empresaId,
      metaParamId,
      cor
    );

    if (!ret?.length) {
      return res.json(
        utils.jsonMount(false, {}, "Numero Meta nao encontrado para a empresa.")
      );
    }

    const contas = await execute.execute_list_paramentros_whats_empresa(
      empresaId,
      true
    );
    const parametros =
      contas.find((item) => item.ativo !== false) ||
      contas[0] ||
      null;

    return res.json(
      utils.jsonMount(
        true,
        mountMetaStatus(parametros, contas),
        "Cor do numero Meta atualizada com sucesso."
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/atualizar_numero_vinculado"));
  }
});

rota.post("/deletar_template", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const templateName = String(
      data.template_name || data.name || ""
    ).trim();
    const templateId = String(data.template_id || "").trim();

    if (!templateName) {
      return res.json(
        utils.jsonMount(false, {}, "Informe template_name para excluir o template.")
      );
    }

    const parametros = await getMetaParametrosOrFail(data, {
      preferMetaParamId: true,
    });
    const integrationError = validateMetaIntegrationReady(parametros);
    if (integrationError) {
      return res.json(utils.jsonMount(false, {}, integrationError));
    }
    const metaAccessToken = getMetaSystemAccessToken();

    const ownedTemplatesResponse = await axios.get(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${parametros.whatsapp_account_id}/message_templates`,
      {
        headers: { Authorization: `Bearer ${metaAccessToken}` },
        params: {
          fields: "id,name,language,status",
          name: templateName,
          limit: 100,
        },
      }
    );
    const ownedTemplates = Array.isArray(ownedTemplatesResponse.data?.data)
      ? ownedTemplatesResponse.data.data
      : [];
    const ownedTemplate = ownedTemplates.find((template) =>
      templateId
        ? String(template?.id || "") === templateId &&
          String(template?.name || "") === templateName
        : String(template?.name || "") === templateName
    );

    if (!ownedTemplate) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Template nao encontrado na conta Meta selecionada. Atualize a lista e tente novamente."
        )
      );
    }

    const response = await axios.delete(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${parametros.whatsapp_account_id}/message_templates`,
      {
        headers: {
          Authorization: `Bearer ${metaAccessToken}`,
        },
        params: {
          name: templateName,
          ...(templateId ? { hsm_id: templateId } : {}),
        },
      }
    );

    return res.json(
      utils.jsonMount(
        true,
        {
          template_name: templateName,
          template_id: templateId || ownedTemplate.id,
          meta_response: response.data,
        },
        "Template removido com sucesso."
      )
    );
  } catch (error) {
    const metaError = error?.response?.data?.error || null;
    console.error("Erro na rota /deletar_template:", {
      meta_error: error?.response?.data || error?.message || error,
      empresa_id: security.jwtdecript(req.body)?.empresa_id || null,
    });

    if (
      Number(metaError?.code) === 100 &&
      String(metaError?.message || "").toLowerCase().includes("need permission")
    ) {
      return res.status(403).json(
        utils.jsonMount(
          false,
          {
            meta_code: metaError.code,
            fbtrace_id: metaError.fbtrace_id || null,
          },
          "A Meta recusou a exclusao porque o token global nao possui controle administrativo desta conta do WhatsApp. No Business Manager, atribua ao usuario de sistema que gerou o META_ACCESS_TOKEN o ativo da conta WhatsApp com controle total e a permissao whatsapp_business_management; depois gere um novo token e atualize o backend."
        )
      );
    }

    return res.json(utils.errorHandle(error, "/deletar_template"));
  }
});

rota.post("/arquivar_template", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const templateId = String(data.template_id || "").trim();
    const templateName = String(data.template_name || data.name || "").trim();
    const languageCode = String(data.language || data.language_code || "").trim() || null;
    if (!templateId || !templateName) {
      return res.json(
        utils.jsonMount(false, {}, "Informe template_id e template_name para arquivar o template.")
      );
    }

    const parametros = await getMetaParametrosOrFail(data, {
      preferMetaParamId: true,
    });
    if (!parametros?.id || Number(parametros.empresa_id) !== Number(data.empresa_id)) {
      return res.status(403).json(
        utils.jsonMount(false, {}, "Conta Meta invalida para esta empresa.")
      );
    }

    const archived = await execute.execute_arquivar_template_meta({
      empresa_id: Number(data.empresa_id),
      empresa_meta_param_id: Number(parametros.id),
      template_id: templateId,
      template_name: templateName,
      language_code: languageCode,
      usuario_id: Number(data.usuario_id) || null,
    });

    return res.json(
      utils.jsonMount(true, archived, "Template arquivado com sucesso.")
    );
  } catch (error) {
    console.error("Erro na rota /arquivar_template:", error);
    if (error?.code === "42P01") {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "A estrutura de arquivamento ainda nao foi instalada no banco. Execute a migracao empresa_meta_template_arquivado.sql."
        )
      );
    }
    return res.json(utils.errorHandle(error, "/arquivar_template"));
  }
});

rota.post(
  "/preview_validacao_template",
  upload.fields([
    { name: "header_image_file", maxCount: 1 },
    { name: "header_document_file", maxCount: 1 },
    { name: "header_video_file", maxCount: 1 },
    { name: "header_file", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const payload =  req.body;
      const data = security.jwtdecript(payload);

      if (!data) {
        return res
          .status(401)
          .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
      }

      const parametros = await getMetaParametrosOrFail(data, {
        preferMetaParamId: true,
      });
      const integrationError = validateMetaIntegrationReady(parametros);
      if (integrationError) {
        return res.json(utils.jsonMount(false, {}, integrationError));
      }
      const metaAccessToken = getMetaSystemAccessToken();

      const templateName = data.template_name;
      const languageCode = data.language || "pt_BR";
      if (!templateName) {
        return res.json(
          utils.jsonMount(false, {}, "Informe o nome do template em template_name.")
        );
      }

      const {
        uploadedHeaderMedia,
        validation
      } = await buildTemplateDispatchContext(req, data, parametros);

      await cleanupUploadedTemplateMedia(uploadedHeaderMedia);

      return res.json(
        utils.jsonMount(
          true,
          {
            valid: validation.valid,
            template_name: templateName,
            language_code: languageCode,
            uploaded_media_type: uploadedHeaderMedia?.mediaType || null,
            saved_header_media:
              uploadedHeaderMedia?.mediaType === "image" ? uploadedHeaderMedia : null,
            errors: validation.errors,
            template: validation.template || null,
            preview: validation.preview || null
          },
          validation.valid
            ? "Preview de validação gerado com sucesso."
            : "O payload informado não corresponde à estrutura do template."
        )
      );
    } catch (error) {
      console.error(
        "Erro na rota /preview_validacao_template:",
        error?.response?.data || error
      );
      return res.json(utils.errorHandle(error, "/preview_validacao_template"));
    }
  }
);

rota.post(
  "/disparar_template",
  upload.fields([
    { name: "header_image_file", maxCount: 1 },
    { name: "header_document_file", maxCount: 1 },
    { name: "header_video_file", maxCount: 1 },
    { name: "header_file", maxCount: 1 }
  ]),
  async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }

    const parametros = await getMetaParametrosOrFail(data, {
      preferMetaParamId: true,
    });
    const integrationError = validateMetaIntegrationReady(parametros);
    if (integrationError) {
      return res.json(utils.jsonMount(false, {}, integrationError));
    }

    const templateName = data.template_name;
    const languageCode = data.language  || "pt_BR";

    if (!templateName) {
      return res.json(
        utils.jsonMount(false, {}, "Informe o nome do template em template_name.")
      );
    }

    const numeroOriginal = data.numero || null;
    let numero = normalizeRecipientNumber(data.numero);

    if (!numero && data.conversa_id) {
      const numberRows = await executeAtendimento.execute_get_number(data.conversa_id);
      numero = normalizeRecipientNumber(numberRows?.[0]?.number_phone_id || null);
    }

    if (!numero) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Informe numero/telefone/to ou conversa_id para localizar o destinatário."
        )
      );
    }

    const {
      uploadedHeaderMedia,
      templatePayload,
      validation,
      previewMessage,
      selectedTemplate,
      templateChatPayload
    } = await buildTemplateDispatchContext(req, data, parametros);

    if (!validation.valid) {
      await cleanupUploadedTemplateMedia(uploadedHeaderMedia);
      const validationMessage = buildTemplateDispatchValidationMessage(
        "Os dados enviados nao correspondem a estrutura do template.",
        validation.errors
      );
      const availableTemplateNames = Array.isArray(validation?.available_templates)
        ? validation.available_templates
        : [];
      console.error("[/meta/disparar_template] validacao do template falhou:", {
        empresa_id: data.empresa_id,
        usuario_id: resolveRequestUsuarioId(data),
        conversa_id: data.conversa_id || null,
        cliente_id: data.cliente_id || null,
        requested_meta_param_id: data.meta_param_id || null,
        resolved_meta_param_id: parametros.id || null,
        template_name: templateName,
        language: languageCode,
        errors: validation.errors,
        template: validation.template || null,
        preview: validation.preview || null,
        available_templates_count: availableTemplateNames.length,
        available_templates_sample: availableTemplateNames.slice(0, 20),
      });

      return res.json(
        utils.jsonMount(
          false,
          {
            template_name: templateName,
            language: languageCode,
            errors: validation.errors,
            template: validation.template || null,
            preview: validation.preview || null,
            requested_meta_param_id: data.meta_param_id || null,
            resolved_meta_param_id: parametros.id || null,
            available_templates: availableTemplateNames
          },
          validationMessage
        )
      );
    }

    const explicitClientId =
      data.cliente_id === undefined || data.cliente_id === null
        ? null
        : Number(data.cliente_id) || data.cliente_id;
    let clienteId = explicitClientId;

    if (!clienteId && data.conversa_id) {
      const clienteRows = await executeAtendimento.execute_get_cliente(data.conversa_id);
      clienteId = clienteRows?.[0]?.id || null;
    }

    const ensuredConversation = await ensureSingleDispatchConversation({
      data,
      parametros,
      numero,
      clienteId,
    });
    const conversaId = ensuredConversation.conversaId || null;
    const waitForCustomerReplyMessage =
      "Template enviado. Aguarde o cliente responder para continuar o atendimento.";
    const resolvedDispatchContext = await resolveTemplateDispatchPayloadForRecipient({
      ...templatePayload,
      ...data,
      cliente_id: clienteId || data.cliente_id || null,
      conversa_id: conversaId || data.conversa_id || null,
      contato_nome:
        data.contact_name || data.contato_nome || templatePayload.contato_nome || null,
    });

    if (resolvedDispatchContext.errors.length) {
      await cleanupUploadedTemplateMedia(uploadedHeaderMedia);
      const resolvedMessage = buildTemplateDispatchValidationMessage(
        "Nao foi possivel preencher todos os parametros dinamicos do template.",
        resolvedDispatchContext.errors
      );
      console.error("[/meta/disparar_template] falha ao resolver parametros dinamicos:", {
        empresa_id: data.empresa_id,
        usuario_id: resolveRequestUsuarioId(data),
        conversa_id: conversaId,
        cliente_id: clienteId || data.cliente_id || null,
        requested_meta_param_id: data.meta_param_id || null,
        resolved_meta_param_id: parametros.id || null,
        template_name: templateName,
        language: languageCode,
        errors: resolvedDispatchContext.errors,
        template_payload: resolvedDispatchContext.templatePayload || null,
        template: validation.template || null,
        preview: validation.preview || null,
      });
      return res.json(
        utils.jsonMount(
          false,
          {
            template_name: templateName,
            language: languageCode,
            errors: resolvedDispatchContext.errors,
            template: validation.template || null,
            preview: validation.preview || null
          },
          resolvedMessage
        )
      );
    }

    const resolvedTemplatePayload = resolvedDispatchContext.templatePayload;
    const resolvedPreviewMessage = buildTemplatePreviewMessage(
      selectedTemplate,
      resolvedTemplatePayload
    );
    const resolvedTemplateChatPayload = buildTemplateChatPayload(
      selectedTemplate,
      resolvedTemplatePayload,
      uploadedHeaderMedia
    );

    const response = await utils.sendWhatsappTemplateMessage(
      numero,
      resolvedTemplatePayload,
      conversaId,
      data.empresa_id,
      parametros.id || data.meta_param_id || null,
      resolveRequestUsuarioId(data)
    );
    const sentAt = new Date();

    const templateId = String(
      selectedTemplate?.id || data.template_id || templateName
    ).trim();

    const singleDispatchHistory = await execute.execute_create_template_dispatch_batch_history({
      empresa_id: data.empresa_id,
      usuario_id: resolveRequestUsuarioId(data),
      empresa_meta_param_id: parametros.id || data.meta_param_id || null,
      template_id: templateId,
      template_name: templateName,
      template_language: languageCode,
      template_category: selectedTemplate?.category || null,
      lista_transmissao_id: null,
      total_clientes: 1,
      processados: 1,
      enviados: 1,
      recebidos: 0,
      erros: 0,
      parar_no_primeiro_erro: false,
      interrompido_no_erro: false,
      custo_unitario: 0,
      valor_total: 0,
      moeda: "USD",
      data_inicio: sentAt,
      data_fim: sentAt,
      duracao_ms: 0,
      metadata: {
        status: "completed",
        source: "single_template_dispatch",
        chat_preview_kind: "template",
      },
      results: [],
    });

    await execute.execute_insert_template_dispatch_batch_item_history({
      disparo_lote_id: singleDispatchHistory?.id,
      empresa_id: data.empresa_id,
      empresa_meta_param_id: parametros.id || data.meta_param_id || null,
      cliente_id: clienteId || null,
      template_id: templateId,
      template_name: templateName,
      template_language: languageCode,
      numero_original: numeroOriginal || null,
      numero_normalizado: numero || null,
      contato_nome: data.contact_name || data.contato_nome || null,
      email: data.email || null,
      conversa_id: conversaId,
      message_id: response?.messages?.[0]?.id || null,
      message_status: response?.messages?.[0]?.message_status || null,
      sucesso: true,
      custo_unitario: 0,
      valor_cobrado: 0,
      enviado_em: sentAt,
      recebido_em: null,
      erro_em: null,
      erro_mensagem: null,
      erro_codigo: null,
      erro_subcodigo: null,
      erro_tipo: null,
      metadata: {
        request_payload: response?.request_payload || null,
        chat_preview_text: resolvedPreviewMessage || previewMessage || null,
        chat_preview_kind: "template",
        chat_template: resolvedTemplateChatPayload || templateChatPayload || null,
      },
    });

    return res.json(
      utils.jsonMount(
        true,
        {
          numero_original: numeroOriginal,
          numero,
          conversa_id: conversaId,
          template_name: templateName,
          language: languageCode,
          message_id: response?.messages?.[0]?.id || null,
          message_status: response?.messages?.[0]?.message_status || null,
          uploaded_media_url: uploadedHeaderMedia?.url || null,
          uploaded_media_type: uploadedHeaderMedia?.mediaType || null,
          saved_header_media:
            uploadedHeaderMedia?.mediaType === "image" ? uploadedHeaderMedia : null,
          preview_message: resolvedPreviewMessage || previewMessage || null,
          template_data: resolvedTemplateChatPayload || templateChatPayload || null,
          preview: validation.preview || null,
          meta_response: response,
          chat_opened_automatically: ensuredConversation.chatOpenedAutomatically,
          assigned_to_user: ensuredConversation.assignedToUser,
          wait_for_customer_reply: true,
          guidance_message: waitForCustomerReplyMessage
        },
        "Template enviado para processamento na Meta. A entrega final depende do status do webhook."
      )
    );
  } catch (error) {
    const metaErrorSnapshot = normalizeMetaErrorSnapshot(
      error,
      "Falha ao enviar template para o destinatario."
    );
    console.error("Erro na rota /disparar_template:", {
      snapshot: metaErrorSnapshot,
      raw: error?.response?.data || error,
    });
    return res.json(utils.errorHandle(error, "/disparar_template"));
  }
}
);

rota.post(
  "/disparar_template_lote",
  upload.fields([
    { name: "header_image_file", maxCount: 1 },
    { name: "header_document_file", maxCount: 1 },
    { name: "header_video_file", maxCount: 1 },
    { name: "header_file", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const payload = req.body;
      const data = security.jwtdecript(payload);

      if (!data) {
        return res
          .status(401)
          .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
      }

      const parametros = await getMetaParametrosOrFail(data, {
        preferMetaParamId: true,
      });
      const integrationError = validateMetaIntegrationReady(parametros);
      if (integrationError) {
        return res.json(utils.jsonMount(false, {}, integrationError));
      }

      const templateName = data.template_name;
      const languageCode = data.language || "pt_BR";
      const items = await resolveTemplateBatchItems(data);
      const stopOnError = Boolean(data.stop_on_error);
      const leadStartedMessagesGenerateAutoMessage = parseBooleanFlag(
        data.lead_started_messages_generate_auto_message,
        true
      );
      const clientBatchToken = String(data.client_batch_token || "").trim() || null;

      if (!templateName) {
        return res.json(
          utils.jsonMount(false, {}, "Informe o nome do template em template_name.")
        );
      }

      if (!items.length) {
        return res.json(
          utils.jsonMount(
            false,
            {},
            "Informe uma lista em items ou lote para realizar o disparo em lote."
          )
        );
      }

      let uploadedHeaderMedia = null;
      const startedAt = new Date();
      let batchHistory = null;
      let progressMetadataBase = {};

      try {
        uploadedHeaderMedia = await resolveTemplateHeaderMedia(req, data, parametros);

        const templates = await utils.getTemplates({
          empresa_id: data.empresa_id,
          meta_param_id: data.meta_param_id,
          conversa_id: data.conversa_id,
        });
        const selectedTemplate = findTemplateDefinition(templates, templateName);
        const templateId = String(
          selectedTemplate?.id || data.template_id || templateName
        ).trim();
        const templateCategory = normalizeTemplateCategoryForBilling(
          selectedTemplate?.category || data.template_category || null
        );
        const dispatchUnitCost = getTemplateDispatchUnitCostUsd(templateCategory);
        progressMetadataBase = {
          uploaded_media_type: uploadedHeaderMedia?.mediaType || null,
          selected_template_id: templateId,
          selected_template_category: templateCategory,
          client_batch_token: clientBatchToken,
          lead_started_messages_generate_auto_message:
            leadStartedMessagesGenerateAutoMessage,
        };

        batchHistory = await execute.execute_create_template_dispatch_batch_history({
          empresa_id: data.empresa_id,
          usuario_id: resolveRequestUsuarioId(data),
          empresa_meta_param_id: parametros.id || data.meta_param_id || null,
          template_id: templateId,
          template_name: templateName,
          template_language: languageCode,
          template_category: templateCategory,
          lista_transmissao_id:
            data.lista_id === undefined || data.lista_id === null
              ? null
              : Number(data.lista_id) || data.lista_id,
          total_clientes: items.length,
          processados: 0,
          enviados: 0,
          recebidos: 0,
          erros: 0,
          parar_no_primeiro_erro: Boolean(stopOnError),
          interrompido_no_erro: false,
          custo_unitario: dispatchUnitCost,
          valor_total: 0,
          moeda: "USD",
          data_inicio: startedAt,
          data_fim: null,
          duracao_ms: 0,
          metadata: {
            ...progressMetadataBase,
            status: "processing",
          },
          results: [],
        });
        const listaTransmissaoId =
          data.lista_id === undefined || data.lista_id === null
            ? null
            : Number(data.lista_id) || data.lista_id;

        setImmediate(() => {
          void processTemplateDispatchBatchJob({
            data,
            items,
            stopOnError,
            parametros,
            templateName,
            languageCode,
            selectedTemplate,
            uploadedHeaderMedia,
            batchHistory,
            templateId,
            templateCategory,
            startedAt,
            progressMetadataBase,
          });
        });

        return res.json(
          utils.jsonMount(
            true,
            buildTemplateBatchDispatchStartPayload({
              batchHistory,
              templateId,
              templateName,
              languageCode,
              templateCategory,
              listaTransmissaoId,
              uploadedHeaderMedia,
              leadStartedMessagesGenerateAutoMessage,
            }),
            "Disparo em lote iniciado."
          )
        );
      } catch (sendError) {
        if (batchHistory?.id) {
          try {
            await execute.execute_update_template_dispatch_batch_history({
              id: batchHistory.id,
              processados: batchHistory.processados ?? null,
              enviados: batchHistory.enviados ?? null,
              erros: batchHistory.erros ?? null,
              interrompido_no_erro: false,
              data_fim: new Date(),
              duracao_ms: Math.max(Date.now() - startedAt.getTime(), 0),
              metadata: {
                ...progressMetadataBase,
                status: "failed",
                fatal_error: sendError?.message || String(sendError),
              },
            });
          } catch (historyError) {
            console.warn(
              "Nao foi possivel atualizar o historico do lote com erro fatal:",
              historyError?.message || historyError
            );
          }
        }
      await cleanupUploadedTemplateMedia(uploadedHeaderMedia);
      const resolvedMessage = buildTemplateDispatchValidationMessage(
        "Nao foi possivel preencher todos os parametros dinamicos do template.",
        resolvedDispatchContext.errors
      );
      console.error("[/meta/disparar_template] falha ao resolver parametros dinamicos:", {
        empresa_id: data.empresa_id,
        usuario_id: resolveRequestUsuarioId(data),
        conversa_id: conversaId,
        cliente_id: clienteId || data.cliente_id || null,
        meta_param_id: parametros.id || data.meta_param_id || null,
        template_name: templateName,
        language: languageCode,
        errors: resolvedDispatchContext.errors,
        template_payload: resolvedDispatchContext.templatePayload || null,
        template: validation.template || null,
        preview: validation.preview || null,
      });
        throw sendError;
      }
    } catch (error) {
      console.error(
        "Erro na rota /disparar_template_lote:",
        error?.response?.data || error
      );
      return res.json(utils.errorHandle(error, "/disparar_template_lote"));
    }
  }
);

rota.post("/status_disparo_template_lote", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const clientBatchToken = String(data.client_batch_token || "").trim();
    if (!clientBatchToken) {
      return res.json(
        utils.jsonMount(false, {}, "Informe client_batch_token para consultar o progresso.")
      );
    }

    const rows = await execute.execute_get_template_dispatch_batch_history_by_client_token(
      data.empresa_id,
      clientBatchToken
    );
    const batch = rows?.[0] || null;
    const progress = buildTemplateBatchProgressPayload(batch);

    return res.json(
      utils.jsonMount(
        true,
        progress,
        progress.found
          ? "Progresso do lote consultado."
          : "Lote ainda nao iniciou o processamento."
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /status_disparo_template_lote:",
      error?.response?.data || error
    );
    return res.json(utils.errorHandle(error, "/status_disparo_template_lote"));
  }
});

rota.post("/relatorio_envios", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(now.getDate() - 30);
    defaultStart.setHours(0, 0, 0, 0);

    const start = toUnix(data.start_date, defaultStart);
    const end = toUnix(data.end_date, now);
    const dispatchType = normalizeTemplateDispatchReportType(data.dispatch_type);
    const selectedStatus = normalizeTemplateDispatchReportStatus(data.status);
    const selectedMetaParamId = normalizeIntegerId(data.meta_param_id);
    const selectedUsuarioFiltroId = normalizeIntegerId(data.usuario_filtro_id);
    const limit = Math.min(Math.max(Number(data.limit || 10), 1), 500);
    const offset = Math.max(Number(data.offset || 0), 0);
    const allowedMetaParamIds = await resolveTemplateDispatchReportAllowedMetaParamIds(data);

    if (
      selectedMetaParamId &&
      allowedMetaParamIds.length &&
      !allowedMetaParamIds.includes(selectedMetaParamId)
    ) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Voce nao possui acesso ao numero da Meta selecionado para este relatorio."
        )
      );
    }

    const rows = await execute.execute_list_template_dispatch_history_report({
      empresa_id: data.empresa_id,
      allowed_meta_param_ids: allowedMetaParamIds,
      start,
      end,
      dispatch_type: dispatchType,
      empresa_meta_param_id: selectedMetaParamId,
      usuario_filtro_id: selectedUsuarioFiltroId,
      status: selectedStatus,
      limit,
      offset,
    });

    const items = (rows || []).map(serializeTemplateDispatchReportSummary);
    const total = Number(rows?.[0]?.total_registros || 0);

    return res.json(
      utils.jsonMount(
        true,
        {
          filters: {
            start,
            end,
            dispatch_type: dispatchType,
            empresa_meta_param_id: selectedMetaParamId || null,
            usuario_filtro_id: selectedUsuarioFiltroId || null,
            status: selectedStatus,
          },
          summary: buildTemplateDispatchReportSummaryTotals(items),
          pagination: {
            limit,
            offset,
            total,
            has_more: offset + items.length < total,
          },
          items,
        },
        "Relatorio de envios carregado com sucesso."
      )
    );
  } catch (error) {
    console.error("Erro na rota /relatorio_envios:", error?.response?.data || error);
    return res.json(utils.errorHandle(error, "/relatorio_envios"));
  }
});

rota.post("/templates_sugeridos_numero", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const selectedMetaParamId = normalizeIntegerId(data.meta_param_id);
    if (!selectedMetaParamId) {
      return res.json(
        utils.jsonMount(false, {}, "Informe meta_param_id valido para carregar os templates sugeridos.")
      );
    }

    const allowedMetaParamIds = await resolveTemplateDispatchReportAllowedMetaParamIds(data);
    if (
      allowedMetaParamIds.length &&
      !allowedMetaParamIds.includes(selectedMetaParamId)
    ) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Voce nao possui acesso ao numero da Meta selecionado para carregar os templates sugeridos."
        )
      );
    }

    const limit = Math.min(Math.max(Number(data.limit || 5) || 5, 1), 10);
    const rows = await execute.execute_list_template_dispatch_quick_suggestions({
      empresa_id: data.empresa_id,
      empresa_meta_param_id: selectedMetaParamId,
      limit,
    });

    return res.json(
      utils.jsonMount(
        true,
        {
          items: (rows || [])
            .map(serializeTemplateQuickSuggestion)
            .filter((item) => Boolean(item?.template_name)),
        },
        "Templates sugeridos carregados com sucesso."
      )
    );
  } catch (error) {
    console.error("Erro na rota /templates_sugeridos_numero:", error?.response?.data || error);
    return res.json(utils.errorHandle(error, "/templates_sugeridos_numero"));
  }
});

rota.post("/relatorio_envios_detalhe", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const dispatchHistoryId = normalizeIntegerId(data.dispatch_history_id);
    if (!dispatchHistoryId) {
      return res.json(
        utils.jsonMount(false, {}, "Informe dispatch_history_id para consultar o disparo.")
      );
    }

    const allowedMetaParamIds = await resolveTemplateDispatchReportAllowedMetaParamIds(data);
    const dispatch = await execute.execute_get_template_dispatch_history_report_by_id({
      empresa_id: data.empresa_id,
      dispatch_history_id: dispatchHistoryId,
      allowed_meta_param_ids: allowedMetaParamIds,
    });

    if (!dispatch) {
      return res.json(
        utils.jsonMount(false, {}, "Historico de disparo nao encontrado para este usuario.")
      );
    }

    const items = await execute.execute_list_template_dispatch_history_report_items({
      empresa_id: data.empresa_id,
      dispatch_history_id: dispatchHistoryId,
    });

    return res.json(
      utils.jsonMount(
        true,
        {
          dispatch: serializeTemplateDispatchReportSummary(dispatch),
          items: (items || []).map(serializeTemplateDispatchReportItem),
        },
        "Detalhes do disparo carregados com sucesso."
      )
    );
  } catch (error) {
    console.error("Erro na rota /relatorio_envios_detalhe:", error?.response?.data || error);
    return res.json(utils.errorHandle(error, "/relatorio_envios_detalhe"));
  }
});

rota.post("/metricas_custo_disparo", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    // const data = {empresa_id: 4 }

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }

    const parametros = await getMetaParametrosOrFail(data);
    const metaAccessToken = getMetaSystemAccessToken();
    if (!metaAccessToken) {
      return res.json(utils.jsonMount(false, {}, "META_ACCESS_TOKEN nao configurado no .env."));
    }
    if (!parametros) {
      return res.json(utils.jsonMount(false, {}, "Parâmetros da Meta não encontrados."));
    }
    const integrationError = validateMetaIntegrationReady(parametros);
    if (integrationError) {
      return res.json(utils.jsonMount(false, {}, integrationError));
    }
    if (!String(parametros.whatsapp_account_id || "").trim()) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "A conta do WhatsApp da Meta nao esta vinculada ao parametro selecionado."
        )
      );
    }

    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(now.getDate() - 7);

    const start = toUnix(data.start_date, defaultStart);
    const end = toUnix(data.end_date, now);
    const granularity = (data.granularity || "DAILY").toUpperCase();

    const queryParams = {
      start,
      end,
      granularity,
      metric_types: JSON.stringify(["COST", "VOLUME"])
    };

    if (Array.isArray(data.phone_numbers) && data.phone_numbers.length) {
      queryParams.phone_numbers = JSON.stringify(data.phone_numbers);
    }

    if (Array.isArray(data.country_codes) && data.country_codes.length) {
      queryParams.country_codes = JSON.stringify(data.country_codes);
    }

    const response = await axios.get(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${parametros.whatsapp_account_id}/pricing_analytics`,
      {
        headers: {
          Authorization: `Bearer ${metaAccessToken}`
        },
        params: queryParams
      }
    );
    const sourceRows = response.data?.data || response.data?.pricing_analytics?.data || [];
    let rows = normalizePricingRows(sourceRows);
    let summary = buildDispatchCostSummaryFromRows(rows);
    let costSource = "meta_pricing_analytics";
    let message =
      "Custo consultado diretamente na Meta para a conta selecionada.";

    if (!rows.length) {
      const localMetrics = await loadLocalDispatchCostMetrics({
        empresa_id: data.empresa_id,
        empresa_meta_param_id: selectedMetaParamId,
        start,
        end,
        granularity,
      });

      if (localMetrics.rows.length) {
        rows = localMetrics.rows;
        summary = localMetrics.summary;
        costSource = "local_template_dispatch_history";
        message =
          "A Meta nao retornou linhas para o periodo; exibindo o historico local de disparos salvo no sistema.";
      }
    }

    return res.json(
      utils.jsonMount(
        true,
        {
          filters: {
            start,
            end,
            granularity
          },
          summary,
          rows,
          cost_source: costSource,
          message,
          raw: response.data
        },
        ""
      )
    );
  } catch (error) {
    const metaError = error?.response?.data?.error || {};
    const isCostNotAvailable =
      Number(metaError?.error_subcode) === 2388184 ||
      (Number(metaError?.code) === 10 &&
        String(metaError?.error_user_title || "")
          .toLowerCase()
          .includes("custo não disponível")) ||
      String(metaError?.error_user_msg || "")
        .toLowerCase()
        .includes("custo não é mostrado para empresas que fazem cobranças por meio de um parceiro");

    if (isCostNotAvailable) {
      const payload = req.body;
      const data = security.jwtdecript(payload) || {};
      const now = new Date();
      const defaultStart = new Date(now);
      defaultStart.setDate(now.getDate() - 7);

      const start = toUnix(data.start_date, defaultStart);
      const end = toUnix(data.end_date, now);
      const granularity = String(data.granularity || "DAILY").toUpperCase();
      const selectedMetaParamId =
        Number(data.meta_param_id || 0) > 0 ? Number(data.meta_param_id || 0) : null;
      const localMetrics = await loadLocalDispatchCostMetrics({
        empresa_id: data.empresa_id,
        empresa_meta_param_id: selectedMetaParamId,
        start,
        end,
        granularity,
      });

      return res.json(
        utils.jsonMount(
          true,
          {
            filters: {
              start,
              end,
              granularity
            },
            summary: localMetrics.summary,
            rows: localMetrics.rows,
            cost_available: false,
            cost_source: localMetrics.rows.length
              ? "local_template_dispatch_history"
              : "meta_pricing_unavailable",
            message: localMetrics.rows.length
              ? "A Meta nao disponibiliza custo para esta conta; exibindo o historico local salvo no sistema."
              : "A Meta nao disponibiliza custo para esta conta e nao ha historico local no periodo.",
            raw: error?.response?.data || null
          },
          metaError?.error_user_msg ||
            "Custo indisponivel para esta conta. Consulte o parceiro de cobranca."
        )
      );
    }

    console.error("Erro na rota /metricas_custo_disparo:", error?.response?.data || error);
    return res.json(utils.errorHandle(error, "/metricas_custo_disparo"));
  }
});

module.exports = rota;
