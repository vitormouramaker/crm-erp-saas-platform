const crypto = require("crypto");
const { postgres } = require("../server/connect");
const models = require("../models/models_commercial_scheduled_dispatch");
const modelsVendas = require("../models/models_vendas");
const executeUser = require("./execute_user");
const executeMeta = require("./execute_meta");
const utils = require("../utils/templates");
const {
  buildTemplateChatPayload,
  buildTemplateDispatchContext,
  buildTemplatePreviewMessage,
  getMetaParametrosOrFail,
  resolveTemplateDispatchPayloadForRecipient,
  validateMetaIntegrationReady,
} = require("../functions/function_meta");

const PROCESSING_TIMEOUT_MINUTES = Math.max(
  Number(process.env.COMMERCIAL_SCHEDULED_DISPATCH_PROCESSING_TIMEOUT_MINUTES || 15) || 15,
  5
);
const CLAIM_BATCH_SIZE = Math.max(
  Number(process.env.COMMERCIAL_SCHEDULED_DISPATCH_CLAIM_BATCH_SIZE || 5) || 5,
  1
);

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

function getRequesterContext(payload = {}) {
  const rawIsMaster = payload.is_master;
  const isMaster =
    rawIsMaster === true ||
    rawIsMaster === 1 ||
    rawIsMaster === "1" ||
    String(rawIsMaster || "").toLowerCase() === "true";

  return {
    usuarioId: toNumber(
      payload.usuario_id ||
        payload.user_id ||
        payload.userId ||
        payload.id_usuario ||
        payload.id
    ),
    isMaster,
  };
}

function getSaoPauloDateTimeParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find((item) => item.type === type)?.value || "00";

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
    dateIso: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
  };
}

function createPermanentError(message) {
  const error = new Error(message);
  error.permanent = true;
  return error;
}

function createLockToken() {
  return crypto.randomBytes(16).toString("hex");
}

function normalizeScheduledHour(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23) {
    return value;
  }

  const normalized = String(value || "").trim();
  const hourMatch = normalized.match(/^(\d{1,2})(?::00)?$/);
  if (!hourMatch) return null;

  const hour = Number(hourMatch[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

function normalizeScheduleDate(value) {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function validateScheduleSlotOrThrow(scheduledDate, scheduledHour) {
  const normalizedDate = normalizeScheduleDate(scheduledDate);
  const normalizedHour = normalizeScheduledHour(scheduledHour);
  if (!normalizedDate) {
    throw new Error("Informe uma data valida para o agendamento.");
  }
  if (normalizedHour === null) {
    throw new Error("Selecione um horario inteiro entre 00:00 e 23:00.");
  }

  const nowParts = getSaoPauloDateTimeParts(new Date());
  if (normalizedDate < nowParts.dateIso) {
    throw new Error("Nao e permitido agendar disparos para datas passadas.");
  }

  if (
    normalizedDate === nowParts.dateIso &&
    normalizedHour <= Number(nowParts.hour || 0)
  ) {
    throw new Error("Para hoje, selecione uma hora futura em relacao ao horario atual de Sao Paulo.");
  }

  return {
    scheduledDate: normalizedDate,
    scheduledHour: normalizedHour,
  };
}

function normalizeAudienceType(value) {
  return String(value || "").trim().toLowerCase() === "crm"
    ? "crm"
    : "lista_transmissao";
}

function buildHeaderMediaFields(headerMediaType, headerMediaUrl) {
  const mediaType = String(headerMediaType || "").trim().toUpperCase();
  const mediaUrl = normalizeText(headerMediaUrl);
  return {
    header_media_type: mediaType || null,
    header_media_url: mediaUrl,
    header_image: mediaType === "IMAGE" ? mediaUrl : null,
    header_document: mediaType === "DOCUMENT" ? mediaUrl : null,
    header_video: mediaType === "VIDEO" ? mediaUrl : null,
  };
}

function sanitizeParametersArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeButtonParameters(value) {
  return Array.isArray(value) ? value : [];
}

function decorateCrmsWithAccess(crms, assignmentRows, usuarioId, isMaster) {
  const assignmentsByCrm = new Map();

  for (const row of assignmentRows || []) {
    const crmId = Number(row.crm_id);
    const user = {
      id: Number(row.usuario_id),
      nome: row.nome,
    };

    if (!assignmentsByCrm.has(crmId)) {
      assignmentsByCrm.set(crmId, []);
    }
    assignmentsByCrm.get(crmId).push(user);
  }

  return (crms || []).map((crm) => {
    const assignedUsers = assignmentsByCrm.get(Number(crm.id)) || [];
    const acessoRestrito = assignedUsers.length > 0;
    const temAcesso =
      Boolean(isMaster) ||
      !acessoRestrito ||
      assignedUsers.some((user) => Number(user.id) === Number(usuarioId));

    return {
      ...crm,
      acesso_restrito: acessoRestrito,
      usuarios_vinculados: assignedUsers,
      tem_acesso: temAcesso,
    };
  });
}

async function listAccessibleCrms(client, empresaId, usuarioId, isMaster) {
  const [crmsRet, assignmentsRet] = await Promise.all([
    client.query(modelsVendas.list_crms(), [empresaId]),
    client.query(modelsVendas.list_crm_usuario_vinculos_empresa(), [empresaId]),
  ]);

  const decorated = decorateCrmsWithAccess(
    crmsRet.rows,
    assignmentsRet.rows,
    usuarioId,
    isMaster
  );

  return isMaster ? decorated : decorated.filter((crm) => crm.tem_acesso);
}

async function ensureCrmAccess(client, empresaId, crmId, usuarioId, isMaster) {
  const crmRet = await client.query(modelsVendas.get_crm_by_id(), [crmId, empresaId]);
  if (!crmRet.rows.length) {
    throw new Error("Pipeline nao encontrado para esta empresa.");
  }

  const assignmentsRet = await client.query(
    modelsVendas.list_crm_usuario_vinculos_by_crm(),
    [crmId, empresaId]
  );
  const assignedUsers = assignmentsRet.rows.map((row) => Number(row.usuario_id));
  const restricted = assignedUsers.length > 0;
  const hasAccess =
    Boolean(isMaster) ||
    !restricted ||
    assignedUsers.includes(Number(usuarioId));

  if (!hasAccess) {
    throw new Error("Voce nao tem acesso ao pipeline selecionado.");
  }

  return crmRet.rows[0];
}

async function resolveStage(client, crmId, etapaId) {
  const numericStageId = toNumber(etapaId);
  if (!numericStageId) {
    throw new Error("Selecione a coluna do pipeline.");
  }

  const etapaRet = await client.query(modelsVendas.get_etapa_by_id_and_crm(), [
    numericStageId,
    crmId,
  ]);
  if (!etapaRet.rows.length || etapaRet.rows[0].ativo === false) {
    throw new Error("Coluna do pipeline nao encontrada.");
  }

  return etapaRet.rows[0];
}

function normalizeScheduleRow(row) {
  if (!row) return null;

  const hour = Number(row.scheduled_hour || 0);
  return {
    id: Number(row.id),
    empresa_id: Number(row.empresa_id),
    usuario_id: row.usuario_id === null || row.usuario_id === undefined ? null : Number(row.usuario_id),
    usuario_nome: row.usuario_nome || null,
    empresa_meta_param_id: row.empresa_meta_param_id === null || row.empresa_meta_param_id === undefined
      ? null
      : Number(row.empresa_meta_param_id),
    display_phone_number: row.display_phone_number || null,
    verified_name: row.verified_name || null,
    template_name: row.template_name || "",
    template_language: row.template_language || "pt_BR",
    audience_type: row.audience_type || "lista_transmissao",
    lista_transmissao_id: row.lista_transmissao_id === null || row.lista_transmissao_id === undefined
      ? null
      : Number(row.lista_transmissao_id),
    lista_nome: row.lista_nome || null,
    crm_id: row.crm_id === null || row.crm_id === undefined ? null : Number(row.crm_id),
    crm_nome: row.crm_nome || null,
    etapa_id: row.etapa_id === null || row.etapa_id === undefined ? null : Number(row.etapa_id),
    etapa_nome: row.etapa_nome || null,
    scheduled_date: row.scheduled_date
      ? String(row.scheduled_date).slice(0, 10)
      : null,
    scheduled_hour: hour,
    scheduled_time: `${String(hour).padStart(2, "0")}:00`,
    header_media_type: row.header_media_type || null,
    header_media_url: row.header_media_url || null,
    header_parameters: sanitizeParametersArray(row.header_parameters),
    body_parameters: sanitizeParametersArray(row.body_parameters),
    button_parameters: sanitizeButtonParameters(row.button_parameters),
    status: row.status || "pending",
    total_recipients: Number(row.total_recipients || 0),
    processed_recipients: Number(row.processed_recipients || 0),
    sent_recipients: Number(row.sent_recipients || 0),
    error_recipients: Number(row.error_recipients || 0),
    dispatch_history_id: row.dispatch_history_id === null || row.dispatch_history_id === undefined
      ? null
      : Number(row.dispatch_history_id),
    processing_started_at: row.processing_started_at ? new Date(row.processing_started_at).toISOString() : null,
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    canceled_at: row.canceled_at ? new Date(row.canceled_at).toISOString() : null,
    last_error_message: row.last_error_message || null,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function buildScheduleVisibilityFilter(rows, accessContext, accessibleCrmIds) {
  if (accessContext.isMaster) {
    return rows;
  }

  const allowedMetaParamIds = new Set((accessContext.allowedMetaParamIds || []).map((item) => Number(item)));
  const allowedCrmIds = new Set((accessibleCrmIds || []).map((item) => Number(item)));

  return (rows || []).filter((row) => {
    const metaParamId = Number(row.empresa_meta_param_id || 0);
    if (!allowedMetaParamIds.has(metaParamId)) {
      return false;
    }

    if (String(row.audience_type || "").trim().toLowerCase() !== "crm") {
      return true;
    }

    return allowedCrmIds.has(Number(row.crm_id || 0));
  });
}

async function loadUserAccessContext(empresaId, usuarioId, isMaster) {
  const metaNumbers = await executeUser.execute_list_empresa_meta_numeros_ativos(
    empresaId,
    usuarioId
  );
  const client = await postgres.connect();

  try {
    const accessibleCrms = await listAccessibleCrms(client, empresaId, usuarioId, isMaster);
    return {
      isMaster: Boolean(isMaster),
      allowedMetaParamIds: (metaNumbers || []).map((item) => Number(item.id)).filter(Boolean),
      accessibleCrmIds: accessibleCrms.map((item) => Number(item.id)).filter(Boolean),
    };
  } finally {
    client.release();
  }
}

async function ensureMetaNumberAccess(empresaId, usuarioId, metaParamId) {
  const numericMetaParamId = toNumber(metaParamId);
  if (!numericMetaParamId) {
    throw new Error("Selecione um numero Meta valido.");
  }

  const availableNumbers = await executeUser.execute_list_empresa_meta_numeros_ativos(
    empresaId,
    usuarioId
  );
  const selectedNumber = (availableNumbers || []).find(
    (item) => Number(item.id) === numericMetaParamId
  );

  if (!selectedNumber) {
    throw new Error("Voce nao pode usar o numero Meta selecionado.");
  }

  return selectedNumber;
}

async function ensureBroadcastListAccess(empresaId, usuarioId, metaParamId, listaId) {
  const numericListId = toNumber(listaId);
  if (!numericListId) {
    throw new Error("Selecione uma lista de transmissao.");
  }

  const availableLists = await executeUser.execute_listar_listas_transmissao(
    empresaId,
    usuarioId,
    metaParamId
  );
  const selectedList = (availableLists || []).find(
    (item) => Number(item.id) === numericListId
  );

  if (!selectedList) {
    throw new Error("Lista de transmissao nao encontrada para o numero selecionado.");
  }

  if (Number(selectedList.empresa_meta_param_id || 0) !== Number(metaParamId || 0)) {
    throw new Error("A lista escolhida pertence a outro numero Meta.");
  }

  return selectedList;
}

async function validateTemplateSelection({
  empresaId,
  metaParamId,
  templateName,
  templateLanguage,
  headerMediaType,
  headerMediaUrl,
  headerParameters,
  bodyParameters,
  buttonParameters,
}) {
  const template_name = normalizeText(templateName);
  if (!template_name) {
    throw new Error("Selecione um template Meta.");
  }

  const language = normalizeText(templateLanguage) || "pt_BR";
  const mediaFields = buildHeaderMediaFields(headerMediaType, headerMediaUrl);
  const parametros = await getMetaParametrosOrFail({
    empresa_id: empresaId,
    meta_param_id: metaParamId,
  });
  const integrationError = validateMetaIntegrationReady(parametros);
  if (integrationError) {
    throw new Error(integrationError);
  }

  const dispatchContext = await buildTemplateDispatchContext(
    { files: {} },
    {
      empresa_id: empresaId,
      meta_param_id: metaParamId,
      template_name,
      language,
      header_parameters: sanitizeParametersArray(headerParameters),
      body_parameters: sanitizeParametersArray(bodyParameters),
      button_parameters: sanitizeButtonParameters(buttonParameters),
      header_image: mediaFields.header_image,
      header_document: mediaFields.header_document,
      header_video: mediaFields.header_video,
    },
    parametros
  );

  if (!dispatchContext?.selectedTemplate) {
    throw new Error("Template nao encontrado no numero Meta selecionado.");
  }

  if (!dispatchContext.validation?.valid) {
    throw new Error(
      dispatchContext.validation?.errors?.[0] ||
        "Os parametros informados nao correspondem ao template selecionado."
    );
  }

  return {
    template_name,
    language,
    dispatchContext,
    mediaFields,
  };
}

function buildRecipientSeedKey(recipient) {
  const normalizedPhone = normalizePhone(recipient.telefone);
  if (normalizedPhone) return normalizedPhone;
  if (recipient.cliente_id) return `cliente-${recipient.cliente_id}`;
  if (recipient.negocio_id) return `negocio-${recipient.negocio_id}`;
  return `sem-telefone-${createLockToken()}`;
}

function dedupeRecipients(recipients) {
  const byKey = new Map();

  for (const recipient of recipients || []) {
    const key = recipient.cliente_id
      ? `cliente-${recipient.cliente_id}`
      : normalizePhone(recipient.telefone) || buildRecipientSeedKey(recipient);

    if (!byKey.has(key)) {
      byKey.set(key, recipient);
    }
  }

  return [...byKey.values()];
}

async function loadRecipientsForSchedule(client, schedule) {
  if (schedule.audience_type === "crm") {
    const ret = await client.query(models.list_crm_stage_schedule_recipients(), [
      schedule.empresa_id,
      schedule.crm_id,
      schedule.etapa_id,
      schedule.empresa_meta_param_id,
    ]);
    return dedupeRecipients(ret.rows || []);
  }

  const ret = await client.query(models.list_broadcast_list_schedule_recipients(), [
    schedule.lista_transmissao_id,
    schedule.empresa_id,
    schedule.empresa_meta_param_id,
  ]);
  return dedupeRecipients(ret.rows || []);
}

async function seedRecipientItems(client, schedule, recipients) {
  for (const recipient of recipients || []) {
    const itemKey = buildRecipientSeedKey(recipient);
    await client.query(models.upsert_scheduled_dispatch_recipient_item(), [
      schedule.id,
      schedule.empresa_id,
      recipient.cliente_id || null,
      recipient.telefone || null,
      itemKey,
      recipient.contato_nome || null,
      recipient.email || null,
      recipient.data_aniversario || null,
      recipient.conversa_id || null,
      recipient.negocio_id || null,
      recipient.negocio_titulo || null,
      JSON.stringify({
        audience_type: schedule.audience_type,
      }),
    ]);
  }
}

async function countRecipientItems(client, scheduleId) {
  const ret = await client.query(models.count_scheduled_dispatch_recipient_items(), [scheduleId]);
  return {
    total_recipients: Number(ret.rows?.[0]?.total_recipients || 0),
    processed_recipients: Number(ret.rows?.[0]?.processed_recipients || 0),
    sent_recipients: Number(ret.rows?.[0]?.sent_recipients || 0),
    error_recipients: Number(ret.rows?.[0]?.error_recipients || 0),
  };
}

function resolveFinalStatus(counts) {
  if (Number(counts.total_recipients || 0) === 0) {
    return "completed";
  }
  if (Number(counts.error_recipients || 0) > 0 && Number(counts.sent_recipients || 0) === 0) {
    return "failed";
  }
  if (Number(counts.error_recipients || 0) > 0) {
    return "completed_with_errors";
  }
  return "completed";
}

async function ensureDispatchHistory(schedule, dispatchContext, totalRecipients) {
  if (schedule.dispatch_history_id) {
    return Number(schedule.dispatch_history_id);
  }

  const batchHistory = await executeMeta.execute_create_template_dispatch_batch_history({
    empresa_id: schedule.empresa_id,
    usuario_id: schedule.usuario_id || null,
    empresa_meta_param_id: schedule.empresa_meta_param_id,
    template_id: String(
      dispatchContext.selectedTemplate?.id || schedule.template_name || "commercial_scheduled_dispatch"
    ).trim(),
    template_name: schedule.template_name,
    template_language: schedule.template_language || "pt_BR",
    template_category: dispatchContext.selectedTemplate?.category || null,
    lista_transmissao_id:
      schedule.audience_type === "lista_transmissao" ? schedule.lista_transmissao_id : null,
    total_clientes: totalRecipients,
    processados: 0,
    enviados: 0,
    recebidos: 0,
    erros: 0,
    parar_no_primeiro_erro: false,
    interrompido_no_erro: false,
    custo_unitario: 0,
    valor_total: 0,
    moeda: "USD",
    data_inicio: new Date(),
    data_fim: null,
    duracao_ms: 0,
    metadata: {
      status: "processing",
      source: "commercial_scheduled_dispatch",
      schedule_id: schedule.id,
      audience_type: schedule.audience_type,
      crm_id: schedule.crm_id || null,
      etapa_id: schedule.etapa_id || null,
      lista_transmissao_id: schedule.lista_transmissao_id || null,
    },
    results: [],
  });

  if (!batchHistory?.id) {
    throw createPermanentError("Nao foi possivel criar o historico do disparo agendado.");
  }

  await execute.attachDispatchHistoryId(
    schedule.id,
    schedule.empresa_id,
    Number(batchHistory.id)
  );

  return Number(batchHistory.id);
}

async function registerBatchItemHistory({
  schedule,
  batchHistoryId,
  dispatchContext,
  item,
  success,
  sentAt,
  response = null,
  error = null,
  previewMessage = null,
  templateChatPayload = null,
}) {
  await executeMeta.execute_insert_template_dispatch_batch_item_history({
    disparo_lote_id: batchHistoryId || null,
    empresa_id: schedule.empresa_id,
    empresa_meta_param_id: schedule.empresa_meta_param_id,
    cliente_id: item.cliente_id || null,
    template_id: String(
      dispatchContext.selectedTemplate?.id || schedule.template_name || "commercial_scheduled_dispatch"
    ).trim(),
    template_name: schedule.template_name,
    template_language: schedule.template_language || "pt_BR",
    numero_original: item.numero_original || null,
    numero_normalizado: normalizePhone(item.numero_original) || null,
    contato_nome: item.contato_nome || null,
    email: item.email || null,
    conversa_id: item.conversa_id || null,
    message_id: response?.messages?.[0]?.id || null,
    message_status: response?.messages?.[0]?.message_status || null,
    sucesso: Boolean(success),
    custo_unitario: 0,
    valor_cobrado: 0,
    enviado_em: success ? sentAt : null,
    recebido_em: null,
    erro_em: success ? null : sentAt,
    erro_mensagem: success ? null : error?.message || "Falha nao detalhada no disparo agendado.",
    erro_codigo: error?.code || null,
    erro_subcodigo: error?.subcode || null,
    erro_tipo: error?.type || null,
    metadata: {
      source: "commercial_scheduled_dispatch",
      schedule_id: schedule.id,
      audience_type: schedule.audience_type,
      crm_id: schedule.crm_id || null,
      etapa_id: schedule.etapa_id || null,
      lista_transmissao_id: schedule.lista_transmissao_id || null,
      negocio_id: item.negocio_id || null,
      negocio_titulo: item.negocio_titulo || null,
      request_payload: response?.request_payload || null,
      chat_preview_text: previewMessage || null,
      chat_preview_kind: "template",
      chat_template: templateChatPayload || null,
    },
  });
}

async function updateBatchHistorySummary(batchHistoryId, counts, status, startedAt) {
  if (!batchHistoryId) return;

  await executeMeta.execute_update_template_dispatch_batch_history({
    id: batchHistoryId,
    processados: counts.processed_recipients,
    enviados: counts.sent_recipients,
    erros: counts.error_recipients,
    interrompido_no_erro: false,
    data_fim: new Date(),
    duracao_ms: Math.max(Date.now() - startedAt.getTime(), 0),
    metadata: {
      status,
      source: "commercial_scheduled_dispatch",
    },
  });
}

const execute = {
  listScheduledDispatches: async (payload) => {
    const empresaId = toNumber(payload.empresa_id || payload.empresaId);
    const { usuarioId, isMaster } = getRequesterContext(payload);
    if (!empresaId || !usuarioId) {
      throw new Error("Informe empresa e usuario para listar os agendamentos.");
    }

    const accessContext = await loadUserAccessContext(empresaId, usuarioId, isMaster);
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_scheduled_dispatches(), [empresaId]);
      const visibleRows = buildScheduleVisibilityFilter(
        ret.rows,
        accessContext,
        accessContext.accessibleCrmIds
      );
      return visibleRows.map(normalizeScheduleRow);
    } finally {
      client.release();
    }
  },

  createScheduledDispatch: async (payload) => {
    const empresaId = toNumber(payload.empresa_id || payload.empresaId);
    const { usuarioId, isMaster } = getRequesterContext(payload);
    if (!empresaId || !usuarioId) {
      throw new Error("Informe empresa e usuario para criar o agendamento.");
    }

    const audienceType = normalizeAudienceType(payload.audience_type || payload.tipo_publico);
    const metaParamId = toNumber(
      payload.empresa_meta_param_id || payload.meta_param_id || payload.metaParamId
    );
    const { scheduledDate, scheduledHour } = validateScheduleSlotOrThrow(
      payload.scheduled_date || payload.data_agendada,
      payload.scheduled_hour || payload.hora_agendada || payload.horario
    );
    const selectedNumber = await ensureMetaNumberAccess(empresaId, usuarioId, metaParamId);

    const headerParameters = sanitizeParametersArray(payload.header_parameters);
    const bodyParameters = sanitizeParametersArray(payload.body_parameters);
    const buttonParameters = sanitizeButtonParameters(payload.button_parameters);

    const {
      template_name,
      language,
      dispatchContext,
      mediaFields,
    } = await validateTemplateSelection({
      empresaId,
      metaParamId,
      templateName: payload.template_name,
      templateLanguage: payload.template_language || payload.language,
      headerMediaType: payload.header_media_type,
      headerMediaUrl: payload.header_media_url,
      headerParameters,
      bodyParameters,
      buttonParameters,
    });

    let crmId = null;
    let etapaId = null;
    let listaTransmissaoId = null;
    let crmNome = null;
    let etapaNome = null;
    let listaNome = null;

    if (audienceType === "crm") {
      const client = await postgres.connect();
      try {
        crmId = toNumber(payload.crm_id || payload.crmId);
        if (!crmId) {
          throw new Error("Selecione um pipeline para o disparo do CRM.");
        }
        const crm = await ensureCrmAccess(client, empresaId, crmId, usuarioId, isMaster);
        const etapa = await resolveStage(
          client,
          crmId,
          payload.etapa_id || payload.etapaId || payload.stageId
        );
        crmNome = crm.nome || null;
        etapaId = Number(etapa.id);
        etapaNome = etapa.nome || null;
      } finally {
        client.release();
      }
    } else {
      const list = await ensureBroadcastListAccess(
        empresaId,
        usuarioId,
        metaParamId,
        payload.lista_transmissao_id || payload.listaId || payload.lista_id
      );
      listaTransmissaoId = Number(list.id);
      listaNome = list.nome || null;
    }

    const client = await postgres.connect();
    try {
      const insertRet = await client.query(models.insert_scheduled_dispatch(), [
        empresaId,
        usuarioId,
        metaParamId,
        template_name,
        language,
        audienceType,
        listaTransmissaoId,
        crmId,
        etapaId,
        scheduledDate,
        scheduledHour,
        mediaFields.header_media_type,
        mediaFields.header_media_url,
        JSON.stringify(headerParameters),
        JSON.stringify(bodyParameters),
        JSON.stringify(buttonParameters),
        JSON.stringify({
          source: "commercial_tab",
          template_category: dispatchContext.selectedTemplate?.category || null,
          template_status: dispatchContext.selectedTemplate?.status || null,
          display_phone_number: selectedNumber.display_phone_number || null,
          verified_name: selectedNumber.verified_name || null,
          crm_nome: crmNome,
          etapa_nome: etapaNome,
          lista_nome: listaNome,
        }),
      ]);

      const createdId = Number(insertRet.rows?.[0]?.id || 0);
      const createdRet = await client.query(models.get_scheduled_dispatch_by_id(), [
        createdId,
        empresaId,
      ]);
      return normalizeScheduleRow(createdRet.rows?.[0] || null);
    } catch (error) {
      if (error?.code === "23505") {
        throw new Error("Ja existe um agendamento ativo desta empresa para a mesma data e hora.");
      }
      throw error;
    } finally {
      client.release();
    }
  },

  cancelScheduledDispatch: async (payload) => {
    const empresaId = toNumber(payload.empresa_id || payload.empresaId);
    const scheduleId = toNumber(payload.id || payload.agendamento_id || payload.scheduleId);
    const { usuarioId, isMaster } = getRequesterContext(payload);
    if (!empresaId || !scheduleId || !usuarioId) {
      throw new Error("Informe empresa, usuario e agendamento para cancelar.");
    }

    const accessContext = await loadUserAccessContext(empresaId, usuarioId, isMaster);
    const client = await postgres.connect();
    try {
      const existingRet = await client.query(models.get_scheduled_dispatch_by_id(), [
        scheduleId,
        empresaId,
      ]);
      const existing = existingRet.rows?.[0] || null;
      if (!existing) {
        throw new Error("Agendamento nao encontrado.");
      }

      const visible = buildScheduleVisibilityFilter(
        [existing],
        accessContext,
        accessContext.accessibleCrmIds
      );
      if (!visible.length) {
        throw new Error("Voce nao pode cancelar este agendamento.");
      }

      const cancelRet = await client.query(models.cancel_scheduled_dispatch(), [
        scheduleId,
        empresaId,
      ]);
      if (!cancelRet.rows.length) {
        throw new Error("Somente agendamentos pendentes podem ser cancelados.");
      }

      const updatedRet = await client.query(models.get_scheduled_dispatch_by_id(), [
        scheduleId,
        empresaId,
      ]);
      return normalizeScheduleRow(updatedRet.rows?.[0] || null);
    } finally {
      client.release();
    }
  },

  claimDueScheduledDispatches: async ({
    dateIso,
    hour,
    limit = CLAIM_BATCH_SIZE,
    processingTimeoutMinutes = PROCESSING_TIMEOUT_MINUTES,
  }) => {
    const client = await postgres.connect();
    try {
      const claimToken = createLockToken();
      const ret = await client.query(models.claim_due_scheduled_dispatches(), [
        dateIso,
        hour,
        processingTimeoutMinutes,
        limit,
        claimToken,
      ]);
      return ret.rows || [];
    } finally {
      client.release();
    }
  },

  attachDispatchHistoryId: async (scheduleId, empresaId, dispatchHistoryId) => {
    const client = await postgres.connect();
    try {
      await client.query(models.attach_dispatch_history_id(), [
        scheduleId,
        empresaId,
        dispatchHistoryId,
      ]);
    } finally {
      client.release();
    }
  },

  processClaimedScheduledDispatch: async (claimedSchedule) => {
    const scheduleId = Number(claimedSchedule?.id || 0);
    const empresaId = Number(claimedSchedule?.empresa_id || 0);
    const processingToken = String(claimedSchedule?.processing_token || "").trim();
    if (!scheduleId || !empresaId || !processingToken) {
      return;
    }

    const startedAt = new Date();
    const client = await postgres.connect();
    let batchHistoryId = claimedSchedule.dispatch_history_id
      ? Number(claimedSchedule.dispatch_history_id)
      : null;

    try {
      const scheduleRet = await client.query(models.get_scheduled_dispatch_by_id(), [
        scheduleId,
        empresaId,
      ]);
      const schedule = scheduleRet.rows?.[0] || null;
      if (!schedule || schedule.status !== "processing") {
        return;
      }

      const parametros = await getMetaParametrosOrFail({
        empresa_id: empresaId,
        meta_param_id: schedule.empresa_meta_param_id,
      });
      const integrationError = validateMetaIntegrationReady(parametros);
      if (integrationError) {
        throw createPermanentError(integrationError);
      }

      const mediaFields = buildHeaderMediaFields(
        schedule.header_media_type,
        schedule.header_media_url
      );
      const dispatchContext = await buildTemplateDispatchContext(
        { files: {} },
        {
          empresa_id: empresaId,
          meta_param_id: schedule.empresa_meta_param_id,
          template_name: schedule.template_name,
          language: schedule.template_language || "pt_BR",
          header_parameters: sanitizeParametersArray(schedule.header_parameters),
          body_parameters: sanitizeParametersArray(schedule.body_parameters),
          button_parameters: sanitizeButtonParameters(schedule.button_parameters),
          header_image: mediaFields.header_image,
          header_document: mediaFields.header_document,
          header_video: mediaFields.header_video,
        },
        parametros
      );

      if (!dispatchContext?.selectedTemplate || !dispatchContext.validation?.valid) {
        throw createPermanentError(
          dispatchContext?.validation?.errors?.[0] ||
            "Template agendado nao esta mais valido para o numero selecionado."
        );
      }

      const recipients = await loadRecipientsForSchedule(client, schedule);
      await seedRecipientItems(client, schedule, recipients);

      const countsAfterSeed = await countRecipientItems(client, schedule.id);
      batchHistoryId = await ensureDispatchHistory(
        schedule,
        dispatchContext,
        countsAfterSeed.total_recipients
      );

      while (true) {
        const itemLockToken = createLockToken();
        const itemRet = await client.query(models.claim_next_scheduled_dispatch_recipient_item(), [
          schedule.id,
          PROCESSING_TIMEOUT_MINUTES,
          itemLockToken,
        ]);
        const item = itemRet.rows?.[0] || null;
        if (!item) {
          break;
        }

        const sentAt = new Date();

        try {
          const normalizedPhone = normalizePhone(item.numero_original);
          if (!normalizedPhone) {
            throw new Error("Contato sem telefone valido para disparo.");
          }

          const resolvedDispatchContext = await resolveTemplateDispatchPayloadForRecipient({
            ...dispatchContext.templatePayload,
            cliente_id: item.cliente_id || null,
            contato_nome: item.contato_nome || null,
            contact_name: item.contato_nome || null,
            email: item.email || null,
            data_aniversario: item.data_aniversario || null,
          });

          if (resolvedDispatchContext.errors?.length) {
            throw new Error(
              resolvedDispatchContext.errors[0] ||
                "Nao foi possivel preencher os parametros dinamicos do template."
            );
          }

          const resolvedTemplatePayload = resolvedDispatchContext.templatePayload;
          const previewMessage = buildTemplatePreviewMessage(
            dispatchContext.selectedTemplate,
            resolvedTemplatePayload
          );
          const templateChatPayload = buildTemplateChatPayload(
            dispatchContext.selectedTemplate,
            resolvedTemplatePayload,
            dispatchContext.uploadedHeaderMedia
          );

          const response = await utils.sendWhatsappTemplateMessage(
            normalizedPhone,
            resolvedTemplatePayload,
            item.conversa_id || null,
            empresaId,
            schedule.empresa_meta_param_id
          );

          await client.query(models.mark_scheduled_dispatch_recipient_item_sent(), [
            item.id,
            itemLockToken,
            sentAt,
            response?.messages?.[0]?.id || null,
            response?.messages?.[0]?.message_status || null,
            JSON.stringify({
              request_payload: response?.request_payload || null,
            }),
          ]);

          try {
            await registerBatchItemHistory({
              schedule,
              batchHistoryId,
              dispatchContext,
              item,
              success: true,
              sentAt,
              response,
              previewMessage,
              templateChatPayload,
            });
          } catch (historyError) {
            console.warn(
              `[commercial-scheduled-dispatch] falha ao registrar historico de sucesso do item ${item.id}:`,
              historyError?.message || historyError
            );
          }
        } catch (error) {
          await client.query(models.mark_scheduled_dispatch_recipient_item_error(), [
            item.id,
            itemLockToken,
            error?.message || "Falha nao detalhada no disparo agendado.",
            JSON.stringify({
              error_stack: error?.stack || null,
            }),
          ]);

          try {
            await registerBatchItemHistory({
              schedule,
              batchHistoryId,
              dispatchContext,
              item,
              success: false,
              sentAt,
              error,
              previewMessage: dispatchContext.previewMessage || null,
              templateChatPayload: dispatchContext.templateChatPayload || null,
            });
          } catch (historyError) {
            console.warn(
              `[commercial-scheduled-dispatch] falha ao registrar historico de erro do item ${item.id}:`,
              historyError?.message || historyError
            );
          }
        }
      }

      const counts = await countRecipientItems(client, schedule.id);
      const finalStatus = resolveFinalStatus(counts);
      await updateBatchHistorySummary(batchHistoryId, counts, finalStatus, startedAt);

      await client.query(models.complete_scheduled_dispatch(), [
        schedule.id,
        processingToken,
        finalStatus,
        counts.total_recipients,
        counts.processed_recipients,
        counts.sent_recipients,
        counts.error_recipients,
        finalStatus === "failed"
          ? "Todos os destinatarios falharam no disparo agendado."
          : null,
        batchHistoryId,
      ]);
    } catch (error) {
      if (error?.permanent) {
        if (batchHistoryId) {
          await updateBatchHistorySummary(
            batchHistoryId,
            {
              total_recipients: 0,
              processed_recipients: 0,
              sent_recipients: 0,
              error_recipients: 0,
            },
            "failed",
            startedAt
          );
        }

        await client.query(models.fail_scheduled_dispatch(), [
          scheduleId,
          processingToken,
          error.message || "Falha permanente no processamento do agendamento.",
          batchHistoryId,
        ]);
        return;
      }

      console.error(
        `[commercial-scheduled-dispatch] erro transitorio no agendamento ${scheduleId}:`,
        error?.message || error
      );
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
