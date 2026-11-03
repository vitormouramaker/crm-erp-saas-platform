const models = require("../models/models_vendas");
const userModels = require("../models/models_user");
const { postgres } = require("../server/connect");
const developerWebhooks = require("./execute_developer_webhooks");
const executeMetaAds = require("./execute_meta_ads");
const financeiro = require("./execute_financeiro");
const { isRuntimeSchemaEnsureEnabled } = require("../utils/runtime_schema");

const CRM_DASHBOARD_CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.CRM_DASHBOARD_CACHE_TTL_MS || 10000) || 10000
);
const CRM_LIST_CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.CRM_LIST_CACHE_TTL_MS || 15000) || 15000
);
const CRM_LIST_CACHE_STALE_TTL_MS = Math.max(
  CRM_LIST_CACHE_TTL_MS,
  Number(process.env.CRM_LIST_CACHE_STALE_TTL_MS || 300000) || 300000
);
const RUNTIME_SCHEMA_ENSURE_CRM_AUTOMATION = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SCHEMA_ENSURE_CRM_AUTOMATION"
);
const RUNTIME_SEED_DEFAULT_MOTIVOS_PERDA = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SEED_DEFAULT_MOTIVOS_PERDA"
);

async function syncCrmReceivable(client, { empresaId, negocioId, values, usuarioId }) {
  try {
    const configRet = await client.query(
      `select crm.financeiro_gerar_conta_receber,
              crm.financeiro_conta_financeira_id,
              crm.financeiro_categoria_id,
              crm.financeiro_centro_custo_id,
              crm.financeiro_empresa_grupo_id,
              coalesce(crm.financeiro_vencimento_dias, 0) as financeiro_vencimento_dias
         from comercial_negocio negocio
         join comercial_crm crm on crm.id = negocio.crm_id
        where negocio.id = $1 and negocio.empresa_id = $2 and crm.empresa_id = $2
        limit 1`,
      [negocioId, empresaId]
    );
    const config = configRet.rows[0];
    if (!config?.financeiro_gerar_conta_receber) {
      return { created: false, skipped: true, reason: "crm_financeiro_desativado" };
    }
    if (!config.financeiro_conta_financeira_id || !config.financeiro_categoria_id) {
      throw new Error("Configuracao financeira do CRM incompleta.");
    }
    const saleDate = formatDateOnly(values.data_fechamento_real) || getSaoPauloTodayDate();
    const dueDate = new Date(`${saleDate}T12:00:00Z`);
    dueDate.setUTCDate(
      dueDate.getUTCDate() + Math.max(0, Number(config.financeiro_vencimento_dias) || 0)
    );
    return await financeiro.execute_sincronizar_recebivel_venda(
      {
        empresa_id: empresaId,
        cliente_id: values.cliente_id,
        comercial_negocio_id: negocioId,
        usuario_id: usuarioId || values.responsavel_usuario_id,
        origem: "crm",
        referencia: negocioId,
        descricao: `Venda CRM - ${values.titulo || values.nome_contato || negocioId}`,
        valor: values.valor_fechamento ?? values.valor_estimado,
        data_venda: saleDate,
        vencimento: dueDate.toISOString().slice(0, 10),
        categoria_id: config.financeiro_categoria_id,
        centro_custo_id: config.financeiro_centro_custo_id,
        conta_financeira_id: config.financeiro_conta_financeira_id,
        empresa_grupo_id: config.financeiro_empresa_grupo_id,
        recebido: false,
      },
      client
    );
  } catch (error) {
    console.error("[crm][financeiro] falha ao sincronizar conta a receber:", {
      empresa_id: empresaId,
      negocio_id: negocioId,
      message: error.message,
    });
    return null;
  }
}

async function resolveCrmFinancialConfig(client, empresaId, current, payload) {
  const value = (snake, camel, fallback) =>
    payload[snake] !== undefined
      ? payload[snake]
      : payload[camel] !== undefined
        ? payload[camel]
        : fallback;
  const enabled = toBoolean(
    value(
      "financeiro_gerar_conta_receber",
      "financeiroGerarContaReceber",
      current.financeiro_gerar_conta_receber
    )
  );
  const config = {
    enabled,
    contaId: toNumber(value("financeiro_conta_financeira_id", "financeiroContaFinanceiraId", current.financeiro_conta_financeira_id)),
    categoriaId: toNumber(value("financeiro_categoria_id", "financeiroCategoriaId", current.financeiro_categoria_id)),
    centroCustoId: toNumber(value("financeiro_centro_custo_id", "financeiroCentroCustoId", current.financeiro_centro_custo_id)),
    empresaGrupoId: toNumber(value("financeiro_empresa_grupo_id", "financeiroEmpresaGrupoId", current.financeiro_empresa_grupo_id)),
    vencimentoDias: Math.max(0, Math.min(3650, toNumber(value("financeiro_vencimento_dias", "financeiroVencimentoDias", current.financeiro_vencimento_dias)) || 0)),
  };
  if (!enabled) return config;
  if (!config.contaId || !config.categoriaId) {
    throw new Error("Selecione a conta financeira e a categoria para gerar contas a receber.");
  }
  const checks = await Promise.all([
    client.query(`select 1 from financeiro_conta_financeira where id = $1 and empresa_id = $2 and ativo = true`, [config.contaId, empresaId]),
    client.query(`select 1 from financeiro_categoria where id = $1 and empresa_id = $2 and ativo = true`, [config.categoriaId, empresaId]),
    config.centroCustoId
      ? client.query(`select 1 from financeiro_centro_custo where id = $1 and empresa_id = $2 and ativo = true`, [config.centroCustoId, empresaId])
      : Promise.resolve({ rowCount: 1 }),
    config.empresaGrupoId
      ? client.query(`select 1 from financeiro_empresa_grupo where id = $1 and empresa_id = $2 and ativo = true`, [config.empresaGrupoId, empresaId])
      : Promise.resolve({ rowCount: 1 }),
  ]);
  if (checks.some((check) => !check.rowCount)) {
    throw new Error("Uma das configuracoes financeiras nao pertence a empresa ou esta inativa.");
  }
  return config;
}
const crmDashboardInflightByKey = new Map();
const crmDashboardCacheByKey = new Map();
const crmListCacheByKey = new Map();
const CRM_TRANSACTION_LOCK_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.CRM_TRANSACTION_LOCK_TIMEOUT_MS || 5000) || 5000
);
const CRM_TRANSACTION_IDLE_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.CRM_TRANSACTION_IDLE_TIMEOUT_MS || 15000) || 15000
);

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value) {
  if (value === true || value === false) return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return false;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeEmail(value) {
  const normalized = normalizeText(value);
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

function nonNegativeNumberOrNull(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function uniqueNumberList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => toNumber(value)).filter(Boolean))];
}

function positiveIntegerOrNull(value) {
  const parsed = toNumber(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function buildCrmDashboardCacheKey(payload = {}) {
  const requester = getRequesterContext(payload);
  const empresaId = toNumber(payload.empresa_id || payload.empresaId) || 0;
  const crmId = toNumber(payload.crm_id || payload.crmId) || 0;
  const ownerId = normalizeText(
    payload.ownerId || payload.usuario_id_filtro || payload.usuarioIdFiltro
  );
  const origin = normalizeText(payload.origin || payload.origem);
  const product = normalizeText(payload.product || payload.produto);
  const filialId = toNumber(
    payload.filial_id || payload.filialId || payload.branchId || payload.branch_id
  );
  const withoutFilial = toBoolean(
    payload.sem_filial ?? payload.withoutFilial ?? payload.without_filial
  );
  const dateStart =
    formatDateOnly(startOfDay(payload.dateStart || payload.data_inicio || payload.start)) || "";
  const dateEnd =
    formatDateOnly(endOfDay(payload.dateEnd || payload.data_fim || payload.end)) || "";

  return JSON.stringify({
    empresaId,
    crmId,
    usuarioId: requester.usuarioId || 0,
    isMaster: Boolean(requester.isMaster),
    ownerId: ownerId || "",
    origin: origin || "",
    product: product || "",
    filial: withoutFilial ? "none" : filialId || 0,
    dateStart,
    dateEnd,
  });
}

function getCachedCrmDashboard(cacheKey) {
  if (!CRM_DASHBOARD_CACHE_TTL_MS) return null;

  const cached = crmDashboardCacheByKey.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    crmDashboardCacheByKey.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedCrmDashboard(cacheKey, value) {
  if (!CRM_DASHBOARD_CACHE_TTL_MS) return;

  crmDashboardCacheByKey.set(cacheKey, {
    value,
    expiresAt: Date.now() + CRM_DASHBOARD_CACHE_TTL_MS,
  });
}

function buildCrmListCacheKey(payload = {}) {
  const requester = getRequesterContext(payload);
  const empresaId = toNumber(payload.empresa_id || payload.empresaId) || 0;
  return JSON.stringify({
    empresaId,
    usuarioId: requester.usuarioId || 0,
    isMaster: Boolean(requester.isMaster),
    permissions: getPayloadPermissions(payload).sort(),
  });
}

function cloneCrmList(crms) {
  if (!Array.isArray(crms)) return [];

  return crms.map((crm) => ({
    ...crm,
    usuarios_vinculados: Array.isArray(crm.usuarios_vinculados)
      ? crm.usuarios_vinculados.map((usuario) => ({ ...usuario }))
      : [],
  }));
}

function getCachedCrmList(cacheKey, includeStale = false) {
  if (!CRM_LIST_CACHE_STALE_TTL_MS) return null;

  const cached = crmListCacheByKey.get(cacheKey);
  if (!cached) return null;

  const now = Date.now();
  if (cached.staleUntil <= now) {
    crmListCacheByKey.delete(cacheKey);
    return null;
  }

  if (!includeStale && cached.expiresAt <= now) {
    return null;
  }

  return cloneCrmList(cached.value);
}

function setCachedCrmList(cacheKey, value) {
  if (!CRM_LIST_CACHE_STALE_TTL_MS) return;

  crmListCacheByKey.set(cacheKey, {
    value: cloneCrmList(value),
    expiresAt: Date.now() + CRM_LIST_CACHE_TTL_MS,
    staleUntil: Date.now() + CRM_LIST_CACHE_STALE_TTL_MS,
  });
}

function isTransientCrmConnectionError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();

  if (["ETIMEDOUT", "ECONNRESET", "EPIPE", "57P01"].includes(code)) {
    return true;
  }

  return (
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("server closed the connection unexpectedly") ||
    message.includes("terminating connection due to administrator command")
  );
}

async function beginManagedCrmTransaction(client) {
  await client.query("BEGIN");
  await client.query(
    `SET LOCAL lock_timeout = '${Math.max(1, Math.floor(CRM_TRANSACTION_LOCK_TIMEOUT_MS / 1000))}s'`
  );
  await client.query(
    `SET LOCAL idle_in_transaction_session_timeout = '${Math.max(
      1,
      Math.floor(CRM_TRANSACTION_IDLE_TIMEOUT_MS / 1000)
    )}s'`
  );
}

async function safeRollback(client, contextLabel) {
  if (!client) return;

  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    const code = String(rollbackError?.code || "").toUpperCase();
    const message = String(rollbackError?.message || "").toLowerCase();
    if (
      code === "25P01" ||
      code === "57P01" ||
      message.includes("there is no transaction in progress") ||
      message.includes("connection terminated unexpectedly") ||
      message.includes("server closed the connection unexpectedly")
    ) {
      return;
    }

    console.warn(`[execute_vendas] rollback falhou em ${contextLabel}:`, rollbackError);
  }
}

function formatMetaNumberLabel(row = {}, fallbackId = null) {
  return (
    normalizeText(row.display_phone_number) ||
    normalizeText(row.meta_display_phone_number) ||
    normalizeText(row.verified_name) ||
    normalizeText(row.meta_verified_name) ||
    normalizeText(row.phone_number_id) ||
    normalizeText(row.meta_phone_number_id) ||
    (fallbackId ? `ID ${fallbackId}` : "Numero Meta")
  );
}

function startOfDay(value) {
  if (!value) return null;
  const text = String(value).includes("T")
    ? String(value)
    : `${String(value)}T00:00:00`;
  return new Date(text);
}

function endOfDay(value) {
  if (!value) return null;
  const text = String(value).includes("T")
    ? String(value)
    : `${String(value)}T23:59:59.999`;
  return new Date(text);
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return undefined;
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return undefined;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0 && secs > 0) {
    return `${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${secs}s`;
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
  return {
    year: parts.find((part) => part.type === "year")?.value,
    month: parts.find((part) => part.type === "month")?.value,
    day: parts.find((part) => part.type === "day")?.value,
    hour: parts.find((part) => part.type === "hour")?.value,
    minute: parts.find((part) => part.type === "minute")?.value,
    second: parts.find((part) => part.type === "second")?.value,
  };
}

function applyLeadTimeSqlOffsetToNegociosQuery(query) {
  return String(query || "")
    .replace(
      'n.data_criacao as "createdAt",',
      `(n.data_criacao - interval '3 hours') as "createdAt",`
    )
    .replace(
      'n.data_entrada_pipeline as "entryDate",',
      `(n.data_entrada_pipeline - interval '3 hours') as "entryDate",`
    )
    .replace(
      "and ($6::timestamp is null or n.data_criacao >= $6)",
      "and ($6::timestamp is null or (n.data_criacao - interval '3 hours') >= $6)"
    )
    .replace(
      "and ($7::timestamp is null or n.data_criacao <= $7)",
      "and ($7::timestamp is null or (n.data_criacao - interval '3 hours') <= $7)"
    );
}

function getSaoPauloHour(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const hour = Number(getSaoPauloDateTimeParts(date).hour || 0);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function getSaoPauloWeekdayIndex(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(date);
  const map = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return Object.prototype.hasOwnProperty.call(map, weekday) ? map[weekday] : null;
}

function buildSaoPauloOffsetDateTime(parts) {
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;
}

function getSaoPauloNow() {
  return buildSaoPauloOffsetDateTime(getSaoPauloDateTimeParts(new Date()));
}

function getSaoPauloTodayDate() {
  const nowParts = getSaoPauloDateTimeParts(new Date());
  return `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
}

function combineDateWithSaoPauloCurrentTime(value) {
  if (!value) return getSaoPauloNow();

  const normalized = normalizeText(value);
  if (!normalized) return getSaoPauloNow();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const nowParts = getSaoPauloDateTimeParts(new Date());
    return `${normalized}T${nowParts.hour}:${nowParts.minute}:${nowParts.second}-03:00`;
  }

  const parsedIso = toIsoOrNull(value);
  if (parsedIso) {
    return parsedIso;
  }

  return getSaoPauloNow();
}

function normalizeInteractionCategory(value) {
  return String(value || "").trim().toLowerCase() === "agendamento"
    ? "agendamento"
    : "interacao";
}

function getInteractionTitleByCode(typeCode, category = "interacao") {
  const normalizedCategory = normalizeInteractionCategory(category);
  if (normalizedCategory === "agendamento") {
    if (typeCode === "meeting") return "Reuniao agendada";
    return "Agendamento registrado";
  }
  if (typeCode === "sale") return "Venda concluida";
  if (typeCode === "refusal") return "Venda recusada";
  if (typeCode === "call") return "Ligacao registrada";
  if (typeCode === "meeting") return "Reuniao registrada";
  if (typeCode === "whatsapp") return "Interacao via WhatsApp";
  if (typeCode === "email") return "Interacao por e-mail";
  return "Interacao registrada";
}

const REQUIRED_STAGE_CODES = new Set(["waiting", "closed-won", "closed-lost"]);

function slugifyStageCode(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "stage";
}

async function ensureCrmOwnedByEmpresa(client, empresaId, crmId) {
  const crmRet = await client.query(models.get_crm_by_id(), [crmId, empresaId]);
  if (!crmRet.rows.length) {
    throw new Error("CRM não encontrado para a empresa.");
  }
  return crmRet.rows[0];
}

async function ensureCrmAutomationSchema(client = postgres) {
  if (!RUNTIME_SCHEMA_ENSURE_CRM_AUTOMATION) {
    return;
  }

  await client.query(models.ensure_crm_automation_columns());
}

async function resolveWaitingStage(client, crmId) {
  const waitingRet = await client.query(models.get_etapa_by_codigo(), [crmId, "waiting"]);
  if (!waitingRet.rows.length) {
    throw new Error('A coluna "Aguardando Atendimento" não foi encontrada neste CRM.');
  }
  return waitingRet.rows[0];
}

function getAutomationFieldByAction(actionKey) {
  const normalized = normalizeText(actionKey);
  if (normalized === "atendimento_iniciado") {
    return "automacao_etapa_atendimento_iniciado_id";
  }
  if (normalized === "orcamento_enviado") {
    return "automacao_etapa_orcamento_enviado_id";
  }
  throw new Error("Ação de automação do CRM inválida.");
}

async function resolveAutomationStageSelection(client, crmId, stageId, actionLabel) {
  const numericStageId = toNumber(stageId);
  if (!numericStageId) return null;

  const ret = await client.query(models.get_etapa_by_id_and_crm(), [numericStageId, crmId]);
  if (!ret.rows.length || ret.rows[0]?.ativo === false) {
    throw new Error(`A coluna selecionada para ${actionLabel} não foi encontrada neste funil.`);
  }
  if (ret.rows[0]?.eh_fechamento) {
    throw new Error(`A coluna selecionada para ${actionLabel} não pode ser uma etapa de fechamento.`);
  }

  return numericStageId;
}

async function resolveConfiguredAutomationStage(client, crmRow, actionKey) {
  const field = getAutomationFieldByAction(actionKey);
  const stageId = toNumber(crmRow?.[field]);
  if (!stageId) return null;

  const ret = await client.query(models.get_etapa_by_id_and_crm(), [stageId, crmRow.id]);
  const stage = ret.rows[0] || null;
  if (!stage || stage.ativo === false || stage.eh_fechamento) {
    return null;
  }

  return stage;
}

async function moveNegocioToStageWithinCrm(
  client,
  { empresaId, negocioId, current, etapaAtual, etapaDestino, usuarioId, observacao }
) {
  if (!current || !etapaAtual || !etapaDestino) {
    return { moved: false, reason: "invalid_context" };
  }
  if (Number(etapaAtual.id) === Number(etapaDestino.id)) {
    return { moved: false, reason: "already_in_stage", etapa: etapaAtual };
  }

  const posRet = await client.query(models.get_next_posicao(), [current.crm_id, etapaDestino.id]);
  const nextPosition = Math.max(0, Number(posRet.rows[0]?.proxima_posicao || 0));
  const actorUserId = toNumber(usuarioId) || toNumber(current.responsavel_usuario_id) || null;

  await client.query(models.update_negocio_etapa_posicao(), [
    negocioId,
    etapaDestino.id,
    nextPosition,
    null,
    empresaId,
  ]);

  await client.query(models.insert_movimentacao(), [
    negocioId,
    actorUserId,
    etapaAtual.id,
    etapaDestino.id,
    observacao || "Movimentação automática",
  ]);

  await registrarHistoricoMovimentacaoEtapa(client, {
    empresaId,
    negocioId,
    clienteId: current.cliente_id,
    usuarioId: actorUserId,
    etapaOrigem: etapaAtual,
    etapaDestino: etapaDestino,
  });

  await client.query(models.resequence_stage(), [current.crm_id, etapaAtual.id]);
  await client.query(models.resequence_stage(), [current.crm_id, etapaDestino.id]);

  return {
    moved: true,
    etapa_origem_id: Number(etapaAtual.id),
    etapa_destino_id: Number(etapaDestino.id),
  };
}

async function applyCrmAutomationToNegocio(
  client,
  { empresaId, negocioId, usuarioId, actionKey, currentNegocio = null }
) {
  const currentRet = currentNegocio
    ? { rows: [currentNegocio] }
    : await client.query(models.get_negocio_raw(), [negocioId, empresaId]);
  const current = currentRet.rows[0] || null;

  if (!current || current.ativo === false) {
    return { moved: false, reason: "negocio_not_found" };
  }

  const etapaAtual = await resolveEtapa(client, current.crm_id, current.etapa_id, null);
  if (etapaAtual?.eh_fechamento) {
    return { moved: false, reason: "closing_stage" };
  }

  const crm = await ensureCrmOwnedByEmpresa(client, empresaId, current.crm_id);
  const etapaDestino = await resolveConfiguredAutomationStage(client, crm, actionKey);
  if (!etapaDestino) {
    return { moved: false, reason: "automation_not_configured" };
  }

  const observacao =
    normalizeText(actionKey) === "atendimento_iniciado"
      ? "Movimentação automática: atendimento iniciado"
      : "Movimentação automática: orçamento criado";

  return moveNegocioToStageWithinCrm(client, {
    empresaId,
    negocioId,
    current,
    etapaAtual,
    etapaDestino,
    usuarioId,
    observacao,
  });
}

async function generateUniqueStageCode(client, crmId, baseName, providedCode = null) {
  const seed = normalizeText(providedCode) || slugifyStageCode(baseName);
  let code = seed;
  let suffix = 2;

  // The DB enforces uniqueness for (crm_id, codigo), including inactive rows.
  // Keep incrementing until we find a free code.
  while (true) {
    const existing = await client.query(models.get_etapa_by_codigo_any(), [crmId, code]);
    if (!existing.rows.length) return code;
    code = `${seed}-${suffix}`;
    suffix += 1;
  }
}

async function resequenceEtapas(client, crmId, requestedActiveIds = null) {
  const etapas = (await client.query(models.list_etapas_any(), [crmId])).rows;
  if (!etapas.length) return [];

  const activeIds = Array.isArray(requestedActiveIds)
    ? requestedActiveIds.map(Number)
    : etapas.filter((etapa) => etapa.ativo).map((etapa) => Number(etapa.id));
  const inactiveIds = etapas
    .filter((etapa) => !etapa.ativo)
    .map((etapa) => Number(etapa.id));
  const currentOrders = etapas.map((etapa) => Number(etapa.ordem) || 0);
  const minOrder = Math.min(...currentOrders);
  const maxOrder = Math.max(...currentOrders);
  const temporaryOffset = Math.max(0, maxOrder) - minOrder + etapas.length + 1000;

  // The unique constraint includes inactive stages, so move every row away first.
  await client.query(models.move_all_etapas_to_temporary_order(), [
    crmId,
    temporaryOffset,
  ]);

  const orderedIds = [...activeIds, ...inactiveIds];
  for (let index = 0; index < orderedIds.length; index += 1) {
    await client.query(models.update_etapa_ordem(), [orderedIds[index], crmId, index]);
  }

  return (await client.query(models.list_etapas(), [crmId])).rows;
}

async function createDefaultCrmStages(client, crmId) {
  const defaults = [
    {
      codigo: "waiting",
      nome: "Aguardando Atendimento",
      ordem: 0,
      cor: "#4299e1",
      eh_inicial: true,
      eh_fechamento: false,
      eh_ganho: false,
    },
    {
      codigo: "closed-won",
      nome: "Fechado Ganho",
      ordem: 1,
      cor: "#48bb78",
      eh_inicial: false,
      eh_fechamento: true,
      eh_ganho: true,
    },
    {
      codigo: "closed-lost",
      nome: "Fechado Perdido",
      ordem: 2,
      cor: "#f56565",
      eh_inicial: false,
      eh_fechamento: true,
      eh_ganho: false,
    },
  ];

  for (const stage of defaults) {
    await client.query(models.insert_etapa(), [
      crmId,
      stage.codigo,
      stage.nome,
      stage.ordem,
      stage.cor,
      stage.eh_inicial,
      stage.eh_fechamento,
      stage.eh_ganho,
    ]);
  }
}

async function resolveCrmId(client, empresaId, crmId) {
  const numeric = toNumber(crmId);
  if (numeric) return numeric;

  const ret = await client.query(models.get_default_crm(), [empresaId]);
  if (!ret.rows.length) {
    throw new Error("Nenhum CRM ativo encontrado para a empresa.");
  }

  return ret.rows[0].id;
}

async function resolveCrmIdForIncomingWhatsapp(client, empresaId, empresaMetaParamId) {
  const metaParamId = toNumber(empresaMetaParamId);
  if (!metaParamId) {
    return null;
  }

  const ret = await client.query(models.find_crm_by_meta_numero_entrada(), [
    empresaId,
    metaParamId,
  ]);
  return ret.rows[0] || null;
}

function getRequesterContext(payload = {}) {
  const rawIsMaster = payload.is_master;
  const isExplicitMaster =
    rawIsMaster === true ||
    rawIsMaster === 1 ||
    rawIsMaster === "1" ||
    String(rawIsMaster || "").toLowerCase() === "true";
  const isCommercialManager = hasCommercialManagerAccess(payload);

  return {
    usuarioId: toNumber(
      payload.usuario_id ||
        payload.user_id ||
        payload.userId ||
        payload.id_usuario ||
        payload.id
    ),
    isMaster: isExplicitMaster || isCommercialManager,
  };
}

function getPayloadPermissions(payload = {}) {
  if (Array.isArray(payload.permissions)) {
    return payload.permissions.filter((permission) => typeof permission === "string");
  }

  if (Array.isArray(payload.permissoes)) {
    return payload.permissoes.filter((permission) => typeof permission === "string");
  }

  return [];
}

function hasCommercialManagerAccess(payload = {}) {
  return getPayloadPermissions(payload).includes("commercial.manager");
}

async function hasCommercialManagerAccessInDb(
  client,
  payload = {},
  empresaId = null,
  usuarioId = null
) {
  if (hasCommercialManagerAccess(payload)) {
    return true;
  }

  const empresaIdResolved = toNumber(empresaId || payload.empresa_id || payload.empresaId);
  const usuarioIdResolved = toNumber(
    usuarioId ||
      payload.usuario_id ||
      payload.user_id ||
      payload.userId ||
      payload.id_usuario ||
      payload.id
  );

  if (!empresaIdResolved || !usuarioIdResolved) {
    return false;
  }

  const contextoRet = await client.query(userModels.get_dashboard_contexto_usuario(), [
    usuarioIdResolved,
    empresaIdResolved,
  ]);
  const contexto = contextoRet.rows?.[0] || null;
  const customPermissions = Array.isArray(contexto?.permissoes_customizadas)
    ? contexto.permissoes_customizadas
    : [];

  return customPermissions.includes("commercial.manager");
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
    client.query(models.list_crms(), [empresaId]),
    client.query(models.list_crm_usuario_vinculos_empresa(), [empresaId]),
  ]);

  const decorated = decorateCrmsWithAccess(
    crmsRet.rows,
    assignmentsRet.rows,
    usuarioId,
    isMaster
  );

  return isMaster ? decorated : decorated.filter((crm) => crm.tem_acesso);
}

async function ensureCrmAccess(
  client,
  empresaId,
  crmId,
  usuarioId,
  isMaster,
  options = {}
) {
  const crm = await ensureCrmOwnedByEmpresa(client, empresaId, crmId);
  const assignmentsRet = await client.query(
    models.list_crm_usuario_vinculos_by_crm(),
    [crmId, empresaId]
  );

  const assignedUsers = assignmentsRet.rows.map((row) => ({
    id: Number(row.usuario_id),
    nome: row.nome,
  }));
  const acessoRestrito = assignedUsers.length > 0;
  const temAcesso =
    Boolean(isMaster) ||
    !acessoRestrito ||
    assignedUsers.some((user) => Number(user.id) === Number(usuarioId));

  if (!temAcesso) {
    const numericConversaId = toNumber(options.conversaId);
    const numericUsuarioId = toNumber(usuarioId);
    const negocio = options.negocio || null;

    if (numericConversaId && numericUsuarioId && negocio) {
      const conversaRet = await client.query(models.get_conversa_pipeline_access_context(), [
        numericConversaId,
        empresaId,
      ]);

      if (conversaRet.rows.length) {
        const conversa = conversaRet.rows[0];
        const atendimentoAtribuidoAoUsuario =
          Number(conversa.usuario_id) === numericUsuarioId ||
          Number(conversa.usuario_atribuido_id) === numericUsuarioId;

        if (
          atendimentoAtribuidoAoUsuario &&
          Number(conversa.cliente_id) === Number(negocio.cliente_id)
        ) {
          return {
            ...crm,
            acesso_restrito: acessoRestrito,
            usuarios_vinculados: assignedUsers,
          };
        }
      }
    }

    throw new Error("Voce nao tem acesso a este pipeline.");
  }

  return {
    ...crm,
    acesso_restrito: acessoRestrito,
    usuarios_vinculados: assignedUsers,
  };
}

async function resolveCrmIdWithAccess(
  client,
  empresaId,
  requestedCrmId,
  usuarioId,
  isMaster,
  options = {}
) {
  const numeric = toNumber(requestedCrmId);
  if (numeric) {
    const crm = await ensureCrmAccess(
      client,
      empresaId,
      numeric,
      usuarioId,
      isMaster,
      options
    );
    return Number(crm.id);
  }

  const accessibleCrms = await listAccessibleCrms(client, empresaId, usuarioId, isMaster);
  if (!accessibleCrms.length) {
    throw new Error("Nenhum pipeline disponivel para este usuario.");
  }

  return Number(accessibleCrms[0].id);
}

async function syncCrmAssignedUsers(client, empresaId, crmId, assignedUserIds) {
  const nextIds = uniqueNumberList(assignedUserIds);
  const responsaveisRet = await client.query(models.list_responsaveis(), [empresaId]);
  const activeUserIds = new Set(responsaveisRet.rows.map((row) => Number(row.id)));

  for (const userId of nextIds) {
    if (!activeUserIds.has(Number(userId))) {
      throw new Error("Foi informado um usuario invalido para o pipeline.");
    }
  }

  await client.query(models.delete_crm_usuario_vinculos_by_crm(), [crmId]);

  for (const userId of nextIds) {
    await client.query(models.insert_crm_usuario_vinculo(), [crmId, userId]);
  }
}

async function resolveFilialIdForCrm(client, empresaId, filialId) {
  const nextFilialId = toNumber(filialId);
  if (!nextFilialId) {
    return null;
  }

  const filiaisRet = await client.query(models.list_filiais_empresa(), [empresaId]);
  const hasFilial = filiaisRet.rows.some((row) => Number(row.id) === Number(nextFilialId));
  if (!hasFilial) {
    throw new Error("Foi informada uma filial invalida para o pipeline.");
  }

  return nextFilialId;
}

async function syncCrmMetaNumbers(client, empresaId, crmId, metaNumberIds) {
  const nextIds = uniqueNumberList(metaNumberIds);
  const metaNumbersRet = await client.query(models.list_meta_numeros_empresa(), [empresaId]);
  const availableById = new Map(
    metaNumbersRet.rows.map((row) => [Number(row.id), row])
  );

  for (const metaNumberId of nextIds) {
    if (!availableById.has(Number(metaNumberId))) {
      throw new Error("Foi informado um numero da Meta invalido para o pipeline.");
    }

    const linkedRet = await client.query(models.find_crm_by_meta_numero_id(), [
      empresaId,
      metaNumberId,
      crmId,
    ]);
    if (linkedRet.rows.length) {
      const currentMetaNumber = availableById.get(Number(metaNumberId)) || {};
      throw new Error(
        `Numero da Meta "${formatMetaNumberLabel(currentMetaNumber, metaNumberId)}" ja esta vinculado ao funil "${linkedRet.rows[0].nome}".`
      );
    }
  }

  await client.query(models.delete_crm_meta_numero_vinculos_by_crm(), [crmId]);

  for (const metaNumberId of nextIds) {
    await client.query(models.insert_crm_meta_numero_vinculo(), [crmId, metaNumberId]);
  }
}

async function filterVisibleResponsiblesForCrm(client, empresaId, crmId, responsaveis, usuarioId, isMaster) {
  if (Boolean(isMaster)) {
    return responsaveis;
  }

  const vinculosRet = await client.query(models.list_crm_usuario_vinculos_empresa(), [empresaId]);
  const linkedUsers = new Map();
  const linkedToCurrentCrm = new Set();
  const numericCrmId = toNumber(crmId);

  for (const row of vinculosRet.rows || []) {
    const userId = Number(row.usuario_id);
    const rowCrmId = Number(row.crm_id);
    if (!linkedUsers.has(userId)) {
      linkedUsers.set(userId, new Set());
    }
    linkedUsers.get(userId).add(rowCrmId);
    if (numericCrmId && Number(rowCrmId) === Number(numericCrmId)) {
      linkedToCurrentCrm.add(userId);
    }
  }

  return (responsaveis || []).filter((responsavel) => {
    const id = Number(responsavel.id);
    const crmsDoUsuario = linkedUsers.get(id);
    if (!crmsDoUsuario || crmsDoUsuario.size === 0) return true;
    return linkedToCurrentCrm.has(id);
  });
}

async function resolveEtapa(client, crmId, etapaId, stageCode) {
  const etapaNumeric = toNumber(etapaId);
  if (etapaNumeric) {
    const ret = await client.query(models.get_etapa_by_id_and_crm(), [etapaNumeric, crmId]);
    if (!ret.rows.length) {
      throw new Error("Etapa não encontrada.");
    }
    return ret.rows[0];
  }

  const code = normalizeText(stageCode) || "waiting";
  const ret = await client.query(models.get_etapa_by_codigo(), [crmId, code]);
  if (!ret.rows.length) {
    throw new Error(`Etapa não encontrada para o código ${code}.`);
  }
  return ret.rows[0];
}

async function resolveEtapaDestinoNegocio(client, currentCrmId, currentEtapaId, targetCrmId, etapaId, stageCode) {
  const hasExplicitStage =
    toNumber(etapaId) ||
    (typeof stageCode === "string" && normalizeText(stageCode));

  if (hasExplicitStage) {
    return resolveEtapa(client, targetCrmId, etapaId, stageCode);
  }

  if (Number(currentCrmId) !== Number(targetCrmId)) {
    return resolveWaitingStage(client, targetCrmId);
  }

  return resolveEtapa(client, targetCrmId, currentEtapaId, null);
}

async function resolveUsuarioId(client, empresaId, ownerId, ownerName) {
  const numeric = toNumber(ownerId);
  if (numeric) return numeric;

  const name = normalizeText(ownerName) || normalizeText(ownerId);
  if (!name) return null;

  const ret = await client.query(models.get_usuario_by_nome(), [empresaId, name]);
  return ret.rows[0]?.id || null;
}

async function resolveFormaPagamentoId(client, empresaId, formaPagamentoId, paymentMethod) {
  const numeric = toNumber(formaPagamentoId);
  if (numeric) return numeric;

  const code = normalizeText(paymentMethod);
  if (!code) return null;

  const ret = await client.query(models.get_forma_pagamento_by_codigo(), [empresaId, code]);
  return ret.rows[0]?.id || null;
}

async function ensureDefaultMotivosPerda(client) {
  if (!RUNTIME_SEED_DEFAULT_MOTIVOS_PERDA) {
    return;
  }

  await client.query(models.ensure_default_motivos_perda());
}

async function resolveMotivoPerdaId(client, empresaId, motivoPerdaId, refusalReason) {
  const numeric = toNumber(motivoPerdaId);
  if (numeric) return numeric;

  const code = normalizeText(refusalReason);
  if (!code) return null;

  await ensureDefaultMotivosPerda(client);
  const ret = await client.query(models.get_motivo_perda_by_codigo(), [empresaId, code]);
  return ret.rows[0]?.id || null;
}

async function resolveTipoInteracaoId(client, empresaId, codigo) {
  const ret = await client.query(models.get_tipo_interacao_by_codigo(), [empresaId, codigo]);
  const row = ret.rows[0] || null;
  if (!row?.id) return null;

  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    categoria: normalizeInteractionCategory(row.categoria),
  };
}

async function resolveClienteId(
  client,
  payload,
  empresaId,
  currentClienteId = null,
  onCreated = null
) {
  const explicitClienteId = toNumber(payload.cliente_id || payload.clienteId);
  if (explicitClienteId) {
    // O cliente informado precisa ser da mesma empresa (antes era alterado e
    // vinculado ao negocio sem essa checagem).
    const owner = await client.query(
      "SELECT 1 FROM cliente WHERE id = $1 AND empresa_id = $2",
      [explicitClienteId, empresaId]
    );
    if (!owner.rows.length) {
      throw new Error("Cliente nao encontrado para esta empresa.");
    }
    const nome = normalizeText(payload.contactName || payload.nome_contato);
    const telefone = normalizeText(payload.customerPhone || payload.telefone);
    const email = normalizeEmail(payload.customerEmail || payload.email);
    if (nome || telefone || email) {
      await client.query(models.update_cliente(), [
        explicitClienteId,
        nome || payload.companyName || payload.nome_empresa || payload.title || "Cliente",
        telefone,
        email,
      ]);
    }
    return explicitClienteId;
  }

  if (currentClienteId) {
    const nome = normalizeText(payload.contactName || payload.nome_contato);
    const telefone = normalizeText(payload.customerPhone || payload.telefone);
    const email = normalizeEmail(payload.customerEmail || payload.email);
    if (nome || telefone || email) {
      await client.query(models.update_cliente(), [
        currentClienteId,
        nome || payload.companyName || payload.nome_empresa || payload.title || "Cliente",
        telefone,
        email,
      ]);
    }
    return currentClienteId;
  }

  const telefone = normalizeText(payload.customerPhone || payload.telefone);
  const email = normalizeEmail(payload.customerEmail || payload.email);
  const telefoneLookupCandidates = buildPhoneLookupCandidates(telefone);
  const nome =
    normalizeText(payload.contactName || payload.nome_contato) ||
    normalizeText(payload.companyName || payload.nome_empresa) ||
    "Cliente";

  if (!telefone && !email && !nome) return null;

  const existing = await client.query(models.find_cliente_by_email_or_phone(), [
    empresaId,
    email,
    telefoneLookupCandidates.length ? telefoneLookupCandidates : null,
  ]);

  if (existing.rows.length) {
    const clienteExistente = existing.rows[0];
    const telefoneAtualNormalizado = normalizeImportPhone(clienteExistente.telefone);
    const manterTelefoneAtual =
      telefoneAtualNormalizado &&
      telefoneLookupCandidates.includes(telefoneAtualNormalizado);

    await client.query(models.update_cliente(), [
      clienteExistente.id,
      nome || clienteExistente.nome || "Cliente",
      manterTelefoneAtual ? clienteExistente.telefone : telefone || clienteExistente.telefone,
      email || clienteExistente.email,
    ]);
    return existing.rows[0].id;
  }

  const inserted = await client.query(models.insert_cliente(), [
    nome,
    telefone,
    email,
    empresaId,
  ]);

  if (typeof onCreated === "function") {
    onCreated(inserted.rows?.[0] || null);
  }
  return inserted.rows[0]?.id || null;
}

async function registrarInteracao(
  client,
  {
    empresaId,
    negocioId,
    clienteId,
    usuarioId,
    tipoCodigo,
    descricao,
    dataInicio = null,
    dataFim = undefined,
    duracaoSegundos = null,
    valor = null,
    emAndamento = false,
    categoria = null,
  }
) {
  if (!empresaId || !negocioId || !clienteId || !tipoCodigo) return null;

  const tipoInteracao = await resolveTipoInteracaoId(client, empresaId, tipoCodigo);
  if (!tipoInteracao?.id) return null;

  const categoriaSolicitada =
    categoria === null || categoria === undefined
      ? null
      : normalizeInteractionCategory(categoria);
  const categoriaTipo = normalizeInteractionCategory(tipoInteracao.categoria);
  if (categoriaSolicitada && categoriaSolicitada !== categoriaTipo) {
    throw new Error("O tipo selecionado nao pertence a categoria informada.");
  }

  const inicio = dataInicio || new Date();
  const fim = dataFim === undefined ? (emAndamento ? null : inicio) : dataFim;
  const categoriaFinal = categoriaTipo;

  const ret = await client.query(models.insert_interacao(), [
    empresaId,
    negocioId,
    clienteId,
    usuarioId,
    tipoInteracao.id,
    categoriaFinal,
    descricao || "InteraÃ§Ã£o registrada.",
    inicio,
    fim,
    duracaoSegundos,
    valor,
    emAndamento,
  ]);
  const interactionId = ret.rows[0]?.id || null;
  if (interactionId) {
    await client.query(models.insert_historico_cliente(), [
      empresaId,
      negocioId,
      clienteId,
      usuarioId,
      interactionId,
      tipoCodigo,
      getInteractionTitleByCode(tipoCodigo, categoriaFinal),
      descricao || "Interacao registrada.",
      JSON.stringify({
        category: categoriaFinal,
        startDate: toIsoOrNull(inicio),
        endDate: toIsoOrNull(fim),
        durationSeconds: duracaoSegundos,
        value: valor,
        isCurrent: emAndamento,
      }),
    ]);
  }

  return interactionId;
}

async function registrarHistoricoMovimentacaoEtapa(
  client,
  { empresaId, negocioId, clienteId, usuarioId, etapaOrigem, etapaDestino }
) {
  if (!empresaId || !negocioId || !clienteId || !etapaOrigem || !etapaDestino) return null;

  const origemNome = etapaOrigem.nome || "Etapa anterior";
  const destinoNome = etapaDestino.nome || "Nova etapa";
  const descricao = `Negocio movido de "${origemNome}" para "${destinoNome}".`;

  const ret = await client.query(models.insert_historico_cliente(), [
    empresaId,
    negocioId,
    clienteId,
    usuarioId,
    null,
    "stage-change",
    "Etapa alterada",
    descricao,
    JSON.stringify({
      fromStageId: Number(etapaOrigem.id),
      fromStageCode: etapaOrigem.codigo || null,
      fromStageName: origemNome,
      toStageId: Number(etapaDestino.id),
      toStageCode: etapaDestino.codigo || null,
      toStageName: destinoNome,
      movedAt: new Date().toISOString(),
    }),
  ]);

  return ret.rows[0]?.id || null;
}

async function syncTags(client, empresaId, negocioId, tags) {
  if (!Array.isArray(tags)) return;

  await client.query(models.delete_negocio_tags(), [negocioId]);

  for (const rawTag of tags) {
    const nome = normalizeText(rawTag);
    if (!nome) continue;

    let tagId = null;
    const current = await client.query(models.get_tag_by_nome(), [empresaId, nome]);
    if (current.rows.length) {
      tagId = current.rows[0].id;
    } else {
      const inserted = await client.query(models.insert_tag(), [empresaId, nome, null]);
      tagId = inserted.rows[0]?.id || null;
    }

    if (tagId) {
      await client.query(models.insert_negocio_tag(), [negocioId, tagId]);
    }
  }
}

async function syncProdutos(client, empresaId, negocioId, products) {
  if (!Array.isArray(products)) return;

  await client.query(models.delete_negocio_produtos(), [negocioId]);

  for (const item of products) {
    const nome =
      normalizeText(item?.name) ||
      normalizeText(item?.nome) ||
      normalizeText(item?.productName);
    if (!nome) continue;

    const quantidade = Number(item?.quantity ?? item?.quantidade ?? 1) || 1;
    const preco = Number(item?.price ?? item?.preco ?? 0) || 0;
    const descricao = normalizeText(item?.description || item?.descricao);

    let comercialProdutoId = toNumber(item?.comercial_produto_id || item?.comercialProdutoId);
    if (!comercialProdutoId) {
      const existing = await client.query(models.get_produto_by_nome(), [empresaId, nome]);
      if (existing.rows.length) {
        comercialProdutoId = existing.rows[0].id;
      } else {
        const inserted = await client.query(models.insert_produto(), [
          empresaId,
          nome,
          descricao,
          preco,
        ]);
        comercialProdutoId = inserted.rows[0]?.id || null;
      }
    }

    await client.query(models.insert_negocio_produto(), [
      negocioId,
      comercialProdutoId,
      nome,
      quantidade,
      preco,
    ]);
  }
}

function normalizeQuoteItems(items = [], stage = null) {
  if (!Array.isArray(items)) return [];

  const isClosingStage = stage === "closed-won" || stage === "closed-lost";

  return items
    .map((item) => {
      const nome =
        normalizeText(item?.name) ||
        normalizeText(item?.nome) ||
        normalizeText(item?.productName);
      if (!nome) return null;

      const quantidade = Number(item?.quantity ?? item?.quantidade ?? 1) || 1;
      const preco = Number(item?.price ?? item?.preco ?? item?.unitPrice ?? 0) || 0;
      const explicitSoldQuantity = nonNegativeNumberOrNull(
        item?.soldQuantity ?? item?.quantidade_ganha ?? item?.wonQuantity
      );
      const explicitLostQuantity = nonNegativeNumberOrNull(
        item?.lostQuantity ?? item?.quantidade_perdida ?? item?.lostItemsQuantity
      );

      let soldQuantity = 0;
      if (explicitSoldQuantity !== null) {
        soldQuantity = explicitSoldQuantity;
      } else if (explicitLostQuantity !== null) {
        soldQuantity = Math.max(0, quantidade - explicitLostQuantity);
      } else if (stage === "closed-won") {
        soldQuantity = quantidade;
      }

      soldQuantity = Math.min(quantidade, Math.max(0, soldQuantity));
      const lostQuantity =
        explicitSoldQuantity !== null || explicitLostQuantity !== null || isClosingStage
          ? Math.max(0, quantidade - soldQuantity)
          : 0;
      const status =
        normalizeText(item?.status) ||
        (soldQuantity > 0 && lostQuantity > 0
          ? "parcial"
          : soldQuantity >= quantidade && quantidade > 0
          ? "ganho"
          : lostQuantity >= quantidade && quantidade > 0
          ? "perdido"
          : "pendente");

      return {
        id: toNumber(item?.id),
        comercialProdutoId: toNumber(
          item?.comercial_produto_id || item?.comercialProdutoId || item?.productId
        ),
        nome,
        descricao: normalizeText(item?.description || item?.descricao),
        quantidade,
        preco,
        subtotal: quantidade * preco,
        soldQuantity,
        lostQuantity,
        status,
      };
    })
    .filter(Boolean);
}

function normalizeQuotePayload(payload, current) {
  const rawQuote = payload?.quote || payload?.orcamento || null;
  const items = normalizeQuoteItems(
    rawQuote?.items || rawQuote?.itens || payload?.products || current?.products || [],
    payload?.stage || current?.stage || null
  );

  const subtotalCalculado = items.reduce(
    (sum, item) => sum + Number(item.subtotal || 0),
    0
  );
  const desconto = Math.max(
    0,
    Number(
      rawQuote?.discount ??
        rawQuote?.desconto ??
        payload?.quoteDiscount ??
        payload?.desconto_orcamento ??
        0
    ) || 0
  );
  const subtotal =
    rawQuote?.subtotal !== undefined && rawQuote?.subtotal !== null
      ? Number(rawQuote.subtotal) || 0
      : subtotalCalculado;
  const totalBase =
    rawQuote?.total ??
    payload?.valor_estimado ??
    payload?.valor_fechamento ??
    payload?.amount ??
    payload?.saleValue;
  const total =
    totalBase !== undefined && totalBase !== null
      ? Number(totalBase) || 0
      : Math.max(0, subtotal - desconto);

  return {
    title:
      normalizeText(rawQuote?.title || rawQuote?.titulo || payload?.quoteTitle) ||
      normalizeText(payload?.title || payload?.titulo) ||
      current?.title ||
      current?.titulo ||
      null,
    notes:
      normalizeText(rawQuote?.notes || rawQuote?.observacoes || payload?.quoteNotes) ||
      normalizeText(payload?.saleNotes || payload?.observacoes_venda) ||
      current?.saleNotes ||
      current?.observacoes_venda ||
      null,
    status:
      normalizeText(rawQuote?.status) ||
      (payload?.stage === "closed-won"
        ? "ganho"
        : payload?.stage === "closed-lost"
        ? "perdido"
        : "ativo"),
    subtotal,
    desconto,
    total,
    items,
  };
}

async function syncOrcamento(client, empresaId, negocioId, payload, current = null) {
  const existingRet = await client.query(models.get_orcamento_principal_by_negocio(), [
    negocioId,
    empresaId,
  ]);
  const existing = existingRet.rows[0] || null;
  const created = !existing?.id;
  const quote = normalizeQuotePayload(payload, current);

  if (!existing?.id && !quote.items.length) {
    return null;
  }

  const quoteTitle =
    quote.title ||
    normalizeText(payload?.title || payload?.titulo) ||
    current?.titulo ||
    `Orcamento do negocio ${negocioId}`;
  const quoteNotes =
    quote.notes ||
    normalizeText(payload?.saleNotes || payload?.observacoes_venda) ||
    null;

  let orcamentoId = existing?.id || null;
  if (orcamentoId) {
    await client.query(models.update_orcamento(), [
      orcamentoId,
      quoteTitle,
      quoteNotes,
      quote.subtotal,
      quote.desconto,
      quote.total,
      quote.status,
    ]);
  } else {
    const inserted = await client.query(models.insert_orcamento(), [
      empresaId,
      negocioId,
      quoteTitle,
      quoteNotes,
      quote.subtotal,
      quote.desconto,
      quote.total,
      quote.status,
    ]);
    orcamentoId = inserted.rows[0]?.id || null;
  }

  if (!orcamentoId) return null;

  await client.query(models.delete_orcamento_itens(), [orcamentoId]);

  for (const item of quote.items) {
    let comercialProdutoId = item.comercialProdutoId;
    if (!comercialProdutoId) {
      const existingProductRet = await client.query(models.get_produto_by_nome(), [
        empresaId,
        item.nome,
      ]);
      if (existingProductRet.rows.length) {
        comercialProdutoId = existingProductRet.rows[0].id;
      } else {
        const insertedProductRet = await client.query(models.insert_produto(), [
          empresaId,
          item.nome,
          item.descricao,
          item.preco,
        ]);
        comercialProdutoId = insertedProductRet.rows[0]?.id || null;
      }
    }

    await client.query(models.insert_orcamento_item(), [
      orcamentoId,
      comercialProdutoId,
      item.nome,
      item.quantidade,
      item.preco,
      item.status,
      item.soldQuantity,
      item.lostQuantity,
    ]);
  }

  await syncProdutos(
    client,
    empresaId,
    negocioId,
    quote.items.map((item) => ({
      comercialProdutoId: item.comercialProdutoId,
      name: item.nome,
      quantity: item.quantidade,
      price: item.preco,
      description: item.descricao,
    }))
  );

  return {
    id: orcamentoId,
    created,
    title: quoteTitle,
    notes: quoteNotes,
    subtotal: quote.subtotal,
    discount: quote.desconto,
    total: quote.total,
    status: quote.status,
    items: quote.items,
  };
}

function buildNegocioValues(payload, current, contexto) {
  const quote = normalizeQuotePayload(payload, current);
  const quoteItemQuantity = quote.items.reduce(
    (sum, item) => sum + Number(item.quantidade || 0),
    0
  );
  const quoteSoldItemQuantity = quote.items.reduce(
    (sum, item) => sum + Number(item.soldQuantity || 0),
    0
  );
  const companyName = normalizeText(payload.companyName || payload.nome_empresa);
  const contactName =
    normalizeText(payload.contactName || payload.nome_contato) ||
    current?.nome_contato ||
    companyName ||
    "Cliente";
  const title =
    quote.title ||
    normalizeText(payload.title || payload.titulo) ||
    current?.titulo ||
    (companyName ? `${companyName} - ${contactName}` : `Negócio - ${contactName}`);

  const createdAt = toIsoOrNull(payload.createdAt || payload.data_criacao) || current?.data_criacao || new Date().toISOString();
  const entryDate =
    toIsoOrNull(payload.entryDate || payload.data_entrada_pipeline) ||
    current?.data_entrada_pipeline ||
    createdAt;

  const saleDate = formatDateOnly(payload.saleDate || payload.data_fechamento_real);
  const closingDate = formatDateOnly(payload.closingDate || payload.data_fechamento_prevista);

  const valorEstimado = Number(
    payload.valor_estimado ??
      quote.total ??
      payload.amount ??
      current?.valor_estimado ??
      current?.valor_fechamento ??
      0
  ) || 0;

  const valorFechamento = (() => {
    if (payload.valor_fechamento !== undefined) return Number(payload.valor_fechamento) || 0;
    if (payload.amount !== undefined && contexto.etapa.eh_fechamento) return Number(payload.amount) || 0;
    if (payload.saleValue !== undefined) return Number(payload.saleValue) || 0;
    if (contexto.etapa.eh_ganho && quote.total !== undefined && quote.total !== null) {
      return Number(quote.total) || 0;
    }
    if (contexto.etapa.eh_fechamento && !contexto.etapa.eh_ganho) return 0;
    if (current?.valor_fechamento !== null && current?.valor_fechamento !== undefined) return Number(current.valor_fechamento);
    return contexto.etapa.eh_ganho ? valorEstimado : null;
  })();

  const quantidadeItensPayload =
    payload.itemQuantity ??
    payload.quantidade_itens ??
    (contexto.etapa.eh_fechamento ? quoteSoldItemQuantity : quoteItemQuantity) ??
    current?.quantidade_itens;

  return {
    cliente_id: contexto.clienteId,
    responsavel_usuario_id: contexto.usuarioId,
    etapa_id: contexto.etapa.id,
    titulo: title,
    nome_empresa: companyName || current?.nome_empresa || contactName,
    nome_contato: contactName,
    telefone: normalizeText(payload.customerPhone || payload.telefone) || current?.telefone || null,
    email: normalizeText(payload.customerEmail || payload.email) || current?.email || null,
    documento: normalizeText(payload.customerDocument || payload.documento) || current?.documento || null,
    temperatura: normalizeText(payload.temperature || payload.temperatura) || current?.temperatura || null,
    probabilidade:
      Number(payload.probability ?? payload.probabilidade ?? current?.probabilidade ?? 0) || 0,
    valor_estimado: valorEstimado,
    valor_fechamento: valorFechamento,
    quantidade_itens:
      quantidadeItensPayload === undefined || quantidadeItensPayload === null
        ? null
        : Number(quantidadeItensPayload) || null,
    origem_venda:
      normalizeText(payload.saleOrigin || payload.origem_venda) || current?.origem_venda || null,
    forma_pagamento_id: contexto.formaPagamentoId,
    parcelas: Number(payload.installments ?? payload.parcelas ?? current?.parcelas) || null,
    motivo_perda_id: contexto.motivoPerdaId,
    observacoes_venda:
      normalizeText(payload.saleNotes || payload.observacoes_venda) || current?.observacoes_venda || null,
    observacoes_perda:
      normalizeText(payload.refusalNotes || payload.observacoes_perda) || current?.observacoes_perda || null,
    data_criacao: createdAt,
    data_entrada_pipeline: entryDate,
    data_fechamento_prevista: closingDate,
    data_fechamento_real:
      contexto.etapa.eh_fechamento
        ? saleDate || closingDate || current?.data_fechamento_real || getSaoPauloTodayDate()
        : null,
    posicao_kanban:
      toNumber(payload.order ?? payload.posicao_kanban) ??
      current?.posicao_kanban ??
      contexto.posicaoPadrao,
  };
}

function mapDeal(row) {
  const resolvedAmount =
    row?.amount !== null && row?.amount !== undefined
      ? Number(row.amount || 0)
      : row?.valor_fechamento !== null && row?.valor_fechamento !== undefined
      ? Number(row.valor_fechamento || 0)
      : row?.valor_estimado !== null && row?.valor_estimado !== undefined
      ? Number(row.valor_estimado || 0)
      : 0;
  const quoteItems = Array.isArray(row?.quote?.items)
    ? row.quote.items.map((item) => ({
        id: item.id,
        comercialProdutoId:
          item.comercialProdutoId === null || item.comercialProdutoId === undefined
            ? undefined
            : Number(item.comercialProdutoId),
        name: item.name,
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        subtotal:
          item.subtotal === null || item.subtotal === undefined
            ? undefined
            : Number(item.subtotal || 0),
        status: item.status || null,
        soldQuantity:
          item.soldQuantity === null || item.soldQuantity === undefined
            ? undefined
            : Number(item.soldQuantity || 0),
        lostQuantity:
          item.lostQuantity === null || item.lostQuantity === undefined
            ? undefined
            : Number(item.lostQuantity || 0),
      }))
    : Array.isArray(row.products)
    ? row.products.map((item) => ({
        id: item.id,
        comercialProdutoId:
          item.comercialProdutoId === null || item.comercialProdutoId === undefined
            ? undefined
            : Number(item.comercialProdutoId),
        name: item.name,
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        status: item.status || null,
        soldQuantity:
          item.soldQuantity === null || item.soldQuantity === undefined
            ? undefined
            : Number(item.soldQuantity || 0),
        lostQuantity:
          item.lostQuantity === null || item.lostQuantity === undefined
            ? undefined
            : Number(item.lostQuantity || 0),
      }))
    : [];

  return {
    id: String(row.id),
    crm_id: row.crm_id === null || row.crm_id === undefined ? undefined : Number(row.crm_id),
    crmName: row.crm_nome || undefined,
    filialId:
      row.filial_id === null || row.filial_id === undefined
        ? undefined
        : Number(row.filial_id),
    filialName: row.filial_nome || undefined,
    title: row.title,
    amount: resolvedAmount,
    order: row.order === null || row.order === undefined ? undefined : Number(row.order),
    companyName: row.companyName,
    contactName: row.contactName,
    customerPhone: row.customerPhone,
    stage: row.stage,
    stageName: row.stage_name || row.stageName || "",
    isClosingStage: Boolean(row.isClosingStage),
    isWonStage: Boolean(row.isWonStage),
    probability: Number(row.probability || 0),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    entryDate: row.entryDate ? new Date(row.entryDate).toISOString() : null,
    closingDate: row.closingDate ? formatDateOnly(row.closingDate) : null,
    ownerId: row.ownerId === null || row.ownerId === undefined ? "" : String(row.ownerId),
    ownerName: row.ownerName || "",
    customerEmail: row.customerEmail,
    customerDocument: row.customerDocument,
    temperature: row.temperature,
    customerOrigin: row.customerOrigin || null,
    leadOrigin: row.leadOrigin || null,
    chatConversationId:
      row.chatConversationId === null || row.chatConversationId === undefined
        ? null
        : Number(row.chatConversationId || 0),
    chatConversationStatus: row.chatConversationStatus || null,
    saleOrigin: row.saleOrigin,
    itemQuantity: row.itemQuantity === null || row.itemQuantity === undefined ? undefined : Number(row.itemQuantity),
    saleDate: row.saleDate ? formatDateOnly(row.saleDate) : null,
    saleNotes: row.saleNotes,
    paymentMethod: row.paymentMethod,
    installments: row.installments === null || row.installments === undefined ? undefined : Number(row.installments),
    refusalReason: row.refusalReason,
    refusalNotes: row.refusalNotes,
    hasScheduledInteractionToday: Boolean(row.hasScheduledInteractionToday),
    scheduledInteractionTodayAt: row.scheduledInteractionTodayAt
      ? new Date(row.scheduledInteractionTodayAt).toISOString()
      : null,
    scheduledInteractionTodayCount:
      row.scheduledInteractionTodayCount === null || row.scheduledInteractionTodayCount === undefined
        ? 0
        : Number(row.scheduledInteractionTodayCount || 0),
    hasOpenInteraction: Boolean(row.hasOpenInteraction),
    openInteractionStartedAt: row.openInteractionStartedAt
      ? new Date(row.openInteractionStartedAt).toISOString()
      : null,
    openInteractionCount:
      row.openInteractionCount === null || row.openInteractionCount === undefined
        ? 0
        : Number(row.openInteractionCount || 0),
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
    quote: row.quote
      ? {
          id:
            row.quote.id === null || row.quote.id === undefined
              ? undefined
              : String(row.quote.id),
          title: row.quote.title || row.title,
          subtotal: Number(row.quote.subtotal || 0),
          discount: Number(row.quote.discount || 0),
          total:
            row.quote.total === null || row.quote.total === undefined
              ? resolvedAmount
              : Number(row.quote.total || 0),
          notes: row.quote.notes || null,
          status: row.quote.status || null,
          items: quoteItems,
        }
      : null,
    products: quoteItems,
  };
}

function getDealQuoteItems(deal) {
  if (Array.isArray(deal?.quote?.items) && deal.quote.items.length) {
    return deal.quote.items;
  }
  if (Array.isArray(deal?.products)) {
    return deal.products;
  }
  return [];
}

function getItemLostQuantity(deal, item) {
  if (item?.lostQuantity !== null && item?.lostQuantity !== undefined) {
    return Math.max(0, Number(item.lostQuantity || 0));
  }

  if (
    (deal?.isClosingStage === true && deal?.isWonStage === false) ||
    deal?.stage === "closed-lost"
  ) {
    return Math.max(0, Number(item?.quantity || 0));
  }

  return 0;
}

function buildLossRadar(deals = []) {
  const reasonMap = new Map();
  const productMap = new Map();
  const sellerMap = new Map();

  let totalLostRevenue = 0;
  let fullLostRevenue = 0;
  let partialLostRevenue = 0;
  let lostDealsCount = 0;
  let partialLossDealsCount = 0;

  for (const deal of deals) {
    const items = getDealQuoteItems(deal);
    let dealLossValue = 0;

    for (const item of items) {
      const lostQuantity = getItemLostQuantity(deal, item);
      if (lostQuantity <= 0) continue;

      const price = Number(item?.price || 0);
      const lossValue = lostQuantity * price;
      dealLossValue += lossValue;

      const productKey = normalizeText(item?.name) || "Item sem nome";
      const currentProduct = productMap.get(productKey) || {
        name: productKey,
        quantity: 0,
        value: 0,
      };
      currentProduct.quantity += lostQuantity;
      currentProduct.value += lossValue;
      productMap.set(productKey, currentProduct);
    }

    if (
      !items.length &&
      ((deal?.isClosingStage === true && deal?.isWonStage === false) ||
        deal?.stage === "closed-lost")
    ) {
      dealLossValue = Number(deal?.amount || 0);
    }

    if (dealLossValue <= 0) continue;

    totalLostRevenue += dealLossValue;

    const sellerKey =
      normalizeText(deal?.ownerName) ||
      normalizeText(deal?.ownerId) ||
      "Sem responsavel";
    const currentSeller = sellerMap.get(sellerKey) || {
      name: sellerKey,
      count: 0,
      value: 0,
    };
    currentSeller.count += 1;
    currentSeller.value += dealLossValue;
    sellerMap.set(sellerKey, currentSeller);

    const reasonCode =
      ((deal?.isClosingStage === true && deal?.isWonStage === false) ||
      deal?.stage === "closed-lost")
        ? normalizeText(deal?.refusalReason) || "sem-motivo"
        : "venda-parcial";
    const reasonLabel =
      reasonCode === "venda-parcial"
        ? "Itens nao vendidos em orcamentos ganhos"
        : reasonCode === "sem-motivo"
        ? "Sem motivo informado"
        : reasonCode;
    const currentReason = reasonMap.get(reasonCode) || {
      code: reasonCode,
      label: reasonLabel,
      count: 0,
      value: 0,
    };
    currentReason.count += 1;
    currentReason.value += dealLossValue;
    reasonMap.set(reasonCode, currentReason);

    if (
      (deal?.isClosingStage === true && deal?.isWonStage === false) ||
      deal?.stage === "closed-lost"
    ) {
      fullLostRevenue += dealLossValue;
      lostDealsCount += 1;
    } else {
      partialLostRevenue += dealLossValue;
      partialLossDealsCount += 1;
    }
  }

  const topReasons = Array.from(reasonMap.values())
    .sort((a, b) => b.value - a.value || b.count - a.count)
    .slice(0, 10);
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.value - a.value || b.quantity - a.quantity)
    .slice(0, 10);
  const topSellers = Array.from(sellerMap.values())
    .sort((a, b) => b.value - a.value || b.count - a.count)
    .slice(0, 10);

  return {
    totalLostRevenue,
    fullLostRevenue,
    partialLostRevenue,
    lostDealsCount,
    partialLossDealsCount,
    topReasons,
    topProducts,
    topSellers,
  };
}

function isMissingClienteDocumentoMetricError(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return (
    ["42P01", "42703", "42501"].includes(code) &&
    (
      message.includes("cliente_documento") ||
      message.includes("permission denied") ||
      message.includes("permiss") ||
      message.includes("usuario")
    )
  );
}

async function buildCustomerDocumentsMetric(client, empresaId, deals = [], payload = {}) {
  const clienteIds = [...new Set(
    (deals || [])
      .map((deal) => toNumber(deal?.clienteId ?? deal?.cliente_id ?? null))
      .filter(Boolean)
  )];

  if (!empresaId || !clienteIds.length) {
    return {
      totalDocuments: 0,
      documentsByAttendant: [],
    };
  }

  try {
    const dataInicio = startOfDay(payload.data_inicio || payload.dateStart || payload.start);
    const dataFim = endOfDay(payload.data_fim || payload.dateEnd || payload.end);

    const ret = await client.query(models.list_cliente_documentos_por_atendente(), [
      empresaId,
      clienteIds,
      dataInicio,
      dataFim,
    ]);

    const documentsByAttendant = ret.rows.map((row) => ({
      usuario_id: row.usuario_id === null || row.usuario_id === undefined ? null : Number(row.usuario_id),
      usuario_nome: row.usuario_nome || null,
      total_documentos: Number(row.total_documentos || 0),
      total_clientes: Number(row.total_clientes || 0),
    }));

    return {
      totalDocuments: documentsByAttendant.reduce(
        (sum, item) => sum + Number(item.total_documentos || 0),
        0
      ),
      documentsByAttendant,
    };
  } catch (error) {
    if (isMissingClienteDocumentoMetricError(error)) {
      return {
        totalDocuments: 0,
        documentsByAttendant: [],
      };
    }
    throw error;
  }
}

function parseDateOrNull(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDealReferenceDate(deal) {
  return parseDateOrNull(deal?.entryDate || deal?.createdAt || null);
}

function getDealClosedDate(deal) {
  return parseDateOrNull(deal?.saleDate || deal?.closingDate || deal?.createdAt || null);
}

function isDateWithinRange(date, startDate = null, endDate = null) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return !startDate && !endDate;
  }
  if (startDate instanceof Date && !Number.isNaN(startDate.getTime()) && date < startDate) {
    return false;
  }
  if (endDate instanceof Date && !Number.isNaN(endDate.getTime()) && date > endDate) {
    return false;
  }
  return true;
}

function normalizeOriginLabel(value) {
  const normalized = normalizeText(value);
  return normalized || "Sem origem";
}

function resolveLeadOrigin(deal) {
  return (
    normalizeText(deal?.leadOrigin) ||
    normalizeText(deal?.customerOrigin) ||
    normalizeText(deal?.saleOrigin) ||
    null
  );
}

function roundToOneDecimal(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 10) / 10;
}

function calculatePercent(part, total) {
  if (!total) return 0;
  return roundToOneDecimal((Number(part || 0) / Number(total || 0)) * 100);
}

function getConversationLastSenderLabel(sendBy) {
  const normalized = toNumber(sendBy);
  if (normalized === 1) return "Cliente";
  if (normalized === 2) return "Usuario";
  if (normalized === 3) return "n8n";
  if (normalized === 4) return "WhatsApp celular";
  return "Sistema";
}

function normalizeConversationExportMessages(messages = []) {
  if (!Array.isArray(messages)) return [];

  return messages.map((message) => {
    const sendBy =
      message?.send_by === null || message?.send_by === undefined
        ? null
        : Number(message.send_by || 0);

    return {
      id: Number(message?.id || 0),
      mensagemWhatsId: message?.mensagem_whats_id
        ? String(message.mensagem_whats_id)
        : null,
      mensagem: message?.mensagem ? String(message.mensagem) : "",
      dataMensagem: toIsoOrNull(message?.data_mensagem),
      sendBy,
      autor: getConversationLastSenderLabel(sendBy),
      mediaType: message?.media_tipe ? String(message.media_tipe) : null,
      apagada: Boolean(message?.apagada),
      status: message?.status ? String(message.status) : null,
    };
  });
}

function calculateAverage(numbers = []) {
  const validNumbers = (numbers || []).filter((item) => Number.isFinite(Number(item)));
  if (!validNumbers.length) return 0;
  return validNumbers.reduce((sum, item) => sum + Number(item), 0) / validNumbers.length;
}

function formatDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatMonthKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}

function buildPeriodSeries(deals = [], startDate = null, endDate = null) {
  const normalizedDeals = Array.isArray(deals) ? deals : [];
  const start = startDate instanceof Date && !Number.isNaN(startDate.getTime()) ? new Date(startDate) : null;
  const end = endDate instanceof Date && !Number.isNaN(endDate.getTime()) ? new Date(endDate) : null;

  if (!start || !end || start > end) {
    return [];
  }

  const dayDiff = Math.floor((end.getTime() - start.getTime()) / 86400000);
  const useMonthlyBuckets = dayDiff > 45;
  const buckets = new Map();
  const cursor = new Date(start);

  if (useMonthlyBuckets) {
    cursor.setDate(1);
    while (cursor <= end) {
      const key = formatMonthKey(cursor);
      buckets.set(key, {
        key,
        label: formatMonthLabel(cursor),
        count: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    while (cursor <= end) {
      const key = formatDateKey(cursor);
      buckets.set(key, {
        key,
        label: formatDateLabel(cursor),
        count: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  for (const deal of normalizedDeals) {
    const referenceDate = getDealReferenceDate(deal);
    if (!referenceDate || referenceDate < start || referenceDate > end) {
      continue;
    }

    const bucketKey = useMonthlyBuckets
      ? formatMonthKey(referenceDate)
      : formatDateKey(referenceDate);
    const bucket = bucketKey ? buckets.get(bucketKey) : null;
    if (bucket) {
      bucket.count += 1;
    }
  }

  return Array.from(buckets.values());
}

function buildOriginBreakdown(deals = []) {
  const total = Array.isArray(deals) ? deals.length : 0;
  const grouped = new Map();

  for (const deal of deals || []) {
    const label = normalizeOriginLabel(resolveLeadOrigin(deal));
    grouped.set(label, (grouped.get(label) || 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([origin, count]) => ({
      origin,
      count,
      percent: calculatePercent(count, total),
    }))
    .sort((a, b) => b.count - a.count || a.origin.localeCompare(b.origin, "pt-BR"));
}

function buildLeadWeekdayDistribution(deals = []) {
  const total = Array.isArray(deals) ? deals.length : 0;
  const buckets = [
    { key: "seg", label: "Seg", count: 0 },
    { key: "ter", label: "Ter", count: 0 },
    { key: "qua", label: "Qua", count: 0 },
    { key: "qui", label: "Qui", count: 0 },
    { key: "sex", label: "Sex", count: 0 },
    { key: "sab", label: "Sab", count: 0 },
    { key: "dom", label: "Dom", count: 0 },
  ];

  for (const deal of deals || []) {
    const referenceDate = getDealReferenceDate(deal);
    if (!(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) {
      continue;
    }
    const bucketIndex = getSaoPauloWeekdayIndex(referenceDate);
    const bucket = buckets[bucketIndex];
    if (bucket) {
      bucket.count += 1;
    }
  }

  return buckets.map((bucket) => ({
    ...bucket,
    percent: calculatePercent(bucket.count, total),
  }));
}

function buildLeadHourDistribution(deals = []) {
  const total = Array.isArray(deals) ? deals.length : 0;
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    key: String(hour).padStart(2, "0"),
    label: `${String(hour).padStart(2, "0")}h`,
    count: 0,
  }));

  for (const deal of deals || []) {
    const referenceDate = getDealReferenceDate(deal);
    if (!(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) {
      continue;
    }
    const hour = getSaoPauloHour(referenceDate);
    const bucket = buckets[hour];
    if (bucket) {
      bucket.count += 1;
    }
  }

  return buckets.map((bucket) => ({
    ...bucket,
    percent: calculatePercent(bucket.count, total),
  }));
}

function buildAgingBuckets(deals = [], now = new Date()) {
  const buckets = [
    { key: "ate_3", label: "Até 3 dias", min: 0, max: 3 },
    { key: "de_4_a_7", label: "4 a 7 dias", min: 4, max: 7 },
    { key: "de_8_a_15", label: "8 a 15 dias", min: 8, max: 15 },
    { key: "de_16_a_30", label: "16 a 30 dias", min: 16, max: 30 },
    { key: "mais_30", label: "+ de 30 dias", min: 31, max: Number.POSITIVE_INFINITY },
  ].map((bucket) => ({ ...bucket, count: 0 }));

  for (const deal of deals || []) {
    const referenceDate = getDealReferenceDate(deal);
    if (!referenceDate) continue;
    const diffDays = Math.max(
      0,
      Math.floor((now.getTime() - referenceDate.getTime()) / 86400000)
    );
    const matchedBucket = buckets.find(
      (bucket) => diffDays >= bucket.min && diffDays <= bucket.max
    );
    if (matchedBucket) {
      matchedBucket.count += 1;
    }
  }

  const total = Array.isArray(deals) ? deals.length : 0;
  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: bucket.count,
    percent: calculatePercent(bucket.count, total),
  }));
}

function buildDealInteractionsIndex(rows = []) {
  const interactionsByDealId = new Map();

  for (const row of rows || []) {
    const dealId = Number(row?.negocio_id || 0);
    if (!dealId) continue;

    if (!interactionsByDealId.has(dealId)) {
      interactionsByDealId.set(dealId, {
        all: [],
        contacts: [],
        appointments: [],
      });
    }

    const current = interactionsByDealId.get(dealId);
    const interaction = {
      id: Number(row?.id || 0) || null,
      dealId,
      userId: row?.usuario_id === null || row?.usuario_id === undefined
        ? null
        : Number(row.usuario_id || 0),
      type: normalizeText(row?.tipo_codigo) || "interaction",
      category: normalizeInteractionCategory(row?.categoria),
      startDate: parseDateOrNull(row?.data_inicio),
      endDate: parseDateOrNull(row?.data_fim),
      durationSeconds:
        row?.duracao_segundos === null || row?.duracao_segundos === undefined
          ? null
          : Number(row.duracao_segundos || 0),
      value: row?.valor === null || row?.valor === undefined ? null : Number(row.valor || 0),
      isCurrent: Boolean(row?.em_andamento),
    };

    current.all.push(interaction);
    if (interaction.category === "agendamento") {
      current.appointments.push(interaction);
    } else {
      current.contacts.push(interaction);
    }
  }

  return interactionsByDealId;
}

function buildDealContactCountsIndex(rows = []) {
  return new Map(
    (rows || []).map((row) => [
      Number(row?.negocio_id || 0),
      {
        contactsCount: Number(row?.contacts_count || 0),
      },
    ])
  );
}

function buildDashboardVelocityMetrics(
  deals = [],
  firstResponseByDealId = new Map()
) {
  const firstResponseSeconds = [];
  let contactedLeads = 0;
  let leadsWithoutResponse = 0;
  let respondedWithin5Min = 0;
  let respondedWithin15Min = 0;
  let respondedAfter15Min = 0;

  for (const deal of deals || []) {
    const dealId = Number(deal?.id || 0);
    const firstResponseMetric = firstResponseByDealId.get(dealId) || null;
    const responseSeconds = Number(firstResponseMetric?.firstResponseSeconds);
    if (!Number.isFinite(responseSeconds) || responseSeconds < 0) {
      leadsWithoutResponse += 1;
      continue;
    }

    contactedLeads += 1;
    firstResponseSeconds.push(responseSeconds);

    if (responseSeconds <= 5 * 60) {
      respondedWithin5Min += 1;
    } else if (responseSeconds <= 15 * 60) {
      respondedWithin15Min += 1;
    } else {
      respondedAfter15Min += 1;
    }
  }

  return {
    contactedLeads,
    leadsWithoutResponse,
    respondedWithin5Min,
    respondedWithin15Min,
    respondedAfter15Min,
    averageFirstResponseSeconds: Math.round(calculateAverage(firstResponseSeconds)),
  };
}

function buildDashboardContactBuckets(deals = [], contactCountsByDealId = new Map()) {
  const buckets = [
    { key: "1", label: "Leads com 1 contato", min: 1, max: 1 },
    { key: "2", label: "Leads com 2 contatos", min: 2, max: 2 },
    { key: "3", label: "Leads com 3 contatos", min: 3, max: 3 },
    { key: "4_plus", label: "Leads com 4+ contatos", min: 4, max: Number.POSITIVE_INFINITY },
  ].map((bucket) => ({
    ...bucket,
    leadsCount: 0,
    totalContacts: 0,
  }));

  let totalContacts = 0;
  let leadsWithoutContact = 0;

  for (const deal of deals || []) {
    const dealId = Number(deal?.id || 0);
    const contactsCount = Number(contactCountsByDealId.get(dealId)?.contactsCount || 0);
    totalContacts += contactsCount;

    if (contactsCount <= 0) {
      leadsWithoutContact += 1;
      continue;
    }

    const matchedBucket = buckets.find(
      (bucket) => contactsCount >= bucket.min && contactsCount <= bucket.max
    );
    if (matchedBucket) {
      matchedBucket.leadsCount += 1;
      matchedBucket.totalContacts += contactsCount;
    }
  }

  const totalLeads = Array.isArray(deals) ? deals.length : 0;
  return {
    buckets: buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      leadsCount: bucket.leadsCount,
      leadsPercent: calculatePercent(bucket.leadsCount, totalLeads),
      totalContacts: bucket.totalContacts,
    })),
    leadsWithoutContact,
    leadsWithoutContactPercent: calculatePercent(leadsWithoutContact, totalLeads),
    totalContacts,
    averageContactsPerLead: roundToOneDecimal(totalLeads ? totalContacts / totalLeads : 0),
  };
}

function buildDynamicDashboardFunnel(deals = [], stages = []) {
  const totalLeads = Array.isArray(deals) ? deals.length : 0;
  const orderedStages = [...(stages || [])].sort(
    (left, right) => Number(left?.ordem || 0) - Number(right?.ordem || 0)
  );
  const countsByStageCode = new Map();

  for (const deal of deals || []) {
    const code = String(deal?.stage || "");
    if (!code) continue;
    countsByStageCode.set(code, Number(countsByStageCode.get(code) || 0) + 1);
  }

  let previousCount = totalLeads;

  const items = orderedStages.map((stage) => {
    const count = Number(countsByStageCode.get(String(stage?.codigo || "")) || 0);

    const item = {
      id: Number(stage?.id || 0),
      code: String(stage?.codigo || ""),
      name: stage?.nome || "Etapa",
      color: stage?.cor || null,
      count,
      percentOfTotal: calculatePercent(count, totalLeads),
      percentFromPrevious: calculatePercent(count, previousCount),
      isClosing: Boolean(stage?.eh_fechamento),
      isWon: Boolean(stage?.eh_ganho),
    };

    previousCount = count;
    return item;
  });

  const wonCount = items.find((item) => item.isWon)?.count || 0;

  return {
    totalLeads,
    overallConversionRate: calculatePercent(wonCount, totalLeads),
    items,
  };
}

function buildSellerPerformance({
  dealsNew = [],
  dealsInProgress = [],
  salesDeals = [],
  contactCountsByDealId = new Map(),
  responsaveis = [],
  isDealWon = (deal) => String(deal?.stage || "") === "closed-won",
  isDealLost = (deal) => String(deal?.stage || "") === "closed-lost",
}) {
  const sellerMap = new Map();

  for (const seller of responsaveis || []) {
    const sellerId = Number(seller?.id || 0);
    if (!sellerId) continue;
    sellerMap.set(sellerId, {
      sellerId,
      sellerName: seller?.nome || `Usuario ${sellerId}`,
      leadsNew: 0,
      leadsInProgress: 0,
      contactsMade: 0,
      averageContactsPerLead: 0,
      conversionRate: 0,
      salesCount: 0,
      lostSalesCount: 0,
      revenue: 0,
    });
  }

  const ensureSeller = (deal) => {
    const sellerId = Number(deal?.ownerId || 0);
    if (!sellerId) return null;
    if (!sellerMap.has(sellerId)) {
      sellerMap.set(sellerId, {
        sellerId,
        sellerName: deal?.ownerName || `Usuario ${sellerId}`,
        leadsNew: 0,
        leadsInProgress: 0,
        contactsMade: 0,
        averageContactsPerLead: 0,
        conversionRate: 0,
        salesCount: 0,
        lostSalesCount: 0,
        revenue: 0,
      });
    }
    return sellerMap.get(sellerId);
  };

  for (const deal of dealsNew || []) {
    const seller = ensureSeller(deal);
    if (!seller) continue;
    seller.leadsNew += 1;
    seller.contactsMade += Number(
      contactCountsByDealId.get(Number(deal?.id || 0))?.contactsCount || 0
    );
  }

  for (const deal of salesDeals || []) {
    const seller = ensureSeller(deal);
    if (!seller) continue;

    if (isDealWon(deal)) {
      seller.salesCount += 1;
      seller.revenue += Number(deal?.amount || 0);
    } else if (isDealLost(deal)) {
      seller.lostSalesCount += 1;
    }
  }

  for (const deal of dealsInProgress || []) {
    const seller = ensureSeller(deal);
    if (!seller) continue;
    seller.leadsInProgress += 1;
  }

  return Array.from(sellerMap.values())
    .map((seller) => ({
      ...seller,
      averageContactsPerLead: roundToOneDecimal(
        seller.leadsNew ? seller.contactsMade / seller.leadsNew : 0
      ),
      conversionRate: calculatePercent(seller.salesCount, seller.leadsNew),
      revenue: Number(seller.revenue || 0),
    }))
    .filter(
      (seller) =>
        seller.leadsNew > 0 ||
        seller.leadsInProgress > 0 ||
        seller.contactsMade > 0 ||
        seller.salesCount > 0 ||
        seller.lostSalesCount > 0 ||
        seller.revenue > 0
    )
    .sort((left, right) => {
      if (right.leadsNew !== left.leadsNew) return right.leadsNew - left.leadsNew;
      if (right.revenue !== left.revenue) return right.revenue - left.revenue;
      return String(left.sellerName || "").localeCompare(String(right.sellerName || ""), "pt-BR");
    });
}

function mapProduct(row) {
  const imagens = Array.isArray(row.imagens)
    ? row.imagens
        .map((item) => ({
          id: Number(item?.id),
          url: item?.url || "",
          path_bunny: item?.path_bunny || "",
          nome_arquivo: item?.nome_arquivo || null,
          mime_type: item?.mime_type || null,
          tamanho_bytes:
            item?.tamanho_bytes === null || item?.tamanho_bytes === undefined
              ? null
              : Number(item.tamanho_bytes),
          ordem:
            item?.ordem === null || item?.ordem === undefined
              ? null
              : Number(item.ordem),
        }))
        .filter((item) => item.id && item.url)
    : [];

  const documento =
    row.documento && typeof row.documento === "object" && Number(row.documento.id)
      ? {
          id: Number(row.documento.id),
          url: row.documento.url || "",
          path_bunny: row.documento.path_bunny || "",
          nome_arquivo: row.documento.nome_arquivo || null,
          mime_type: row.documento.mime_type || null,
          tamanho_bytes:
            row.documento.tamanho_bytes === null ||
            row.documento.tamanho_bytes === undefined
              ? null
              : Number(row.documento.tamanho_bytes),
          criado_em: row.documento.criado_em
            ? new Date(row.documento.criado_em).toISOString()
            : null,
        }
      : null;

  return {
    id: Number(row.id),
    nome: row.nome,
    descricao: row.descricao,
    preco_base:
      row.preco_base === null || row.preco_base === undefined
        ? 0
        : Number(row.preco_base),
    ativo: row.ativo !== false,
    criado_em: row.criado_em
      ? new Date(row.criado_em).toISOString()
      : undefined,
    imagens,
    documento,
  };
}

async function loadExternalDashboardSales(client, payload, empresaId, rangeStart, rangeEnd) {
  const { usuarioId, isMaster } = getRequesterContext(payload);
  const hasManagerScope =
    isMaster ||
    (await hasCommercialManagerAccessInDb(client, payload, empresaId, usuarioId));
  const requestedSellerId = toNumber(
    payload.ownerId || payload.owner_id || payload.vendedor_id || payload.vendedorId
  );
  const sellerId = hasManagerScope ? requestedSellerId || null : usuarioId || null;
  const productFilter = normalizeText(
    payload.product || payload.productName || payload.produto_nome || payload.productFilter
  );
  const productPattern = productFilter ? `%${productFilter}%` : null;

  const availabilityRet = await client.query(`
    select
      to_regclass('public.hotmart_evento') is not null as has_hotmart,
      to_regclass('public.hubla_evento') is not null as has_hubla,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'hotmart_evento'
          and column_name = 'vendedor_usuario_id'
      ) as hotmart_has_seller,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'hubla_evento'
          and column_name = 'vendedor_usuario_id'
      ) as hubla_has_seller
  `);
  const availability = availabilityRet.rows?.[0] || {};
  const sources = [];

  if (availability.has_hotmart && (hasManagerScope || availability.hotmart_has_seller)) {
    sources.push(`
      select distinct on (coalesce(nullif(e.transacao_id, ''), e.id::text))
        'hotmart'::varchar as source,
        ${availability.hotmart_has_seller ? "e.vendedor_usuario_id" : "null::bigint"} as seller_id,
        coalesce(
          case when coalesce(e.payload #>> '{data,purchase,price,value}', '') ~ '^[0-9]+([.,][0-9]+)?$'
            then replace(e.payload #>> '{data,purchase,price,value}', ',', '.')::numeric end,
          case when coalesce(e.payload #>> '{data,purchase,full_price,value}', '') ~ '^[0-9]+([.,][0-9]+)?$'
            then replace(e.payload #>> '{data,purchase,full_price,value}', ',', '.')::numeric end,
          case when coalesce(e.payload #>> '{data,purchase,payment,total_value}', '') ~ '^[0-9]+([.,][0-9]+)?$'
            then replace(e.payload #>> '{data,purchase,payment,total_value}', ',', '.')::numeric end,
          0::numeric
        ) as value,
        coalesce(
          case when coalesce(e.payload #>> '{data,purchase,approved_date}', '') ~ '^\\d{4}-\\d{2}-\\d{2}'
            then (e.payload #>> '{data,purchase,approved_date}')::timestamptz end,
          e.recebido_em
        ) as sold_at
      from public.hotmart_evento e
      where e.empresa_id = $1::bigint
        and e.categoria_evento = 'vendas'
        and upper(coalesce(e.status_compra, 'APPROVED')) not in ('REFUNDED', 'CHARGEBACK', 'CANCELLED', 'CANCELED', 'EXPIRED')
        and ($4::bigint is null or ${availability.hotmart_has_seller ? "e.vendedor_usuario_id" : "null::bigint"} = $4::bigint)
        and ($5::varchar is null or coalesce(e.produto_nome, '') ilike $5::varchar)
      order by coalesce(nullif(e.transacao_id, ''), e.id::text), e.recebido_em desc, e.id desc
    `);
  }

  if (availability.has_hubla && (hasManagerScope || availability.hubla_has_seller)) {
    sources.push(`
      select distinct on (coalesce(nullif(e.transacao_id, ''), e.id::text))
        'hubla'::varchar as source,
        ${availability.hubla_has_seller ? "e.vendedor_usuario_id" : "null::bigint"} as seller_id,
        coalesce(
          case when coalesce(e.payload #>> '{event,invoice,amount,subtotalCents}', '') ~ '^\\d+([.]\\d+)?$'
            then (e.payload #>> '{event,invoice,amount,subtotalCents}')::numeric / 100 end,
          case when coalesce(e.payload #>> '{event,invoice,amount,totalCents}', '') ~ '^\\d+([.]\\d+)?$'
            then (e.payload #>> '{event,invoice,amount,totalCents}')::numeric / 100 end,
          0::numeric
        ) as value,
        coalesce(
          case when coalesce(e.payload #>> '{event,invoice,saleDate}', '') ~ '^\\d{4}-\\d{2}-\\d{2}'
            then (e.payload #>> '{event,invoice,saleDate}')::timestamptz end,
          e.recebido_em
        ) as sold_at
      from public.hubla_evento e
      where e.empresa_id = $1::bigint
        and e.tipo_evento = 'INVOICE.PAYMENT_SUCCEEDED'
        and not exists (
          select 1 from public.hubla_evento refund
          where refund.integracao_id = e.integracao_id
            and refund.transacao_id = e.transacao_id
            and refund.tipo_evento = 'INVOICE.REFUNDED'
        )
        and ($4::bigint is null or ${availability.hubla_has_seller ? "e.vendedor_usuario_id" : "null::bigint"} = $4::bigint)
        and ($5::varchar is null or coalesce(e.produto_nome, '') ilike $5::varchar)
      order by coalesce(nullif(e.transacao_id, ''), e.id::text), e.recebido_em desc, e.id desc
    `);
  }

  if (!sources.length) return [];
  const result = await client.query(
    `select source, seller_id, value, sold_at from (${sources
      .map((source) => `(${source})`)
      .join(" union all ")}) external_sales
      where ($2::timestamptz is null or sold_at >= $2::timestamptz)
        and ($3::timestamptz is null or sold_at <= $3::timestamptz)`,
    [empresaId, rangeStart, rangeEnd, sellerId, productPattern]
  );
  return result.rows || [];
}

const execute = {
  execute_ensure_crm_automation_schema: async (client = postgres) => {
    await ensureCrmAutomationSchema(client);
  },

  execute_listar_crms: async (payload) => {
    const cacheKey = buildCrmListCacheKey(payload);
    const cachedCrms = getCachedCrmList(cacheKey);
    if (cachedCrms) {
      return cachedCrms;
    }

    let client = null;
    try {
      client = await postgres.connect();
      const empresaId = toNumber(payload.empresa_id || payload.empresaId || payload);
      if (!empresaId) throw new Error("Empresa invalida para listar os pipelines.");

      const { usuarioId, isMaster } = getRequesterContext(payload);
      const hasManagerScope = await hasCommercialManagerAccessInDb(
        client,
        payload,
        empresaId,
        usuarioId
      );
      const crms = await listAccessibleCrms(
        client,
        empresaId,
        usuarioId,
        Boolean(isMaster) || hasManagerScope
      );
      setCachedCrmList(cacheKey, crms);
      return crms;
    } catch (error) {
      const staleCrms = getCachedCrmList(cacheKey, true);
      if (isTransientCrmConnectionError(error) && staleCrms) {
        console.warn("[vendas][execute_listar_crms] using stale CRM cache", {
          empresa_id: payload?.empresa_id || payload?.empresaId || payload || null,
          usuario_id:
            payload?.usuario_id ||
            payload?.user_id ||
            payload?.userId ||
            payload?.id_usuario ||
            payload?.id ||
            null,
          error: error?.message || String(error),
        });
        return staleCrms;
      }
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  },

  execute_criar_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const nome = normalizeText(payload.nome || payload.name);
      const descricao = normalizeText(payload.descricao || payload.description);
      const filialPayload =
        payload.filial_id !== undefined
          ? payload.filial_id
          : payload.filialId !== undefined
          ? payload.filialId
          : payload.branchId !== undefined
          ? payload.branchId
          : payload.branch_id;
      const filialId = await resolveFilialIdForCrm(client, empresaId, filialPayload);
      const metaNumberIds =
        payload.meta_param_ids !== undefined
          ? payload.meta_param_ids
          : payload.metaParamIds !== undefined
          ? payload.metaParamIds
          : payload.empresa_meta_param_ids;

      if (!empresaId) throw new Error("Empresa inválida para criação do CRM.");
      if (!nome) throw new Error("Informe o nome do CRM.");

      const assinaturaRet = await client.query(models.get_limite_crm_assinatura_empresa(), [empresaId]);
      const assinatura = assinaturaRet.rows[0] || null;
      const maxCrm = toNumber(assinatura?.max_crm_total ?? assinatura?.max_crm);
      if (maxCrm !== null && maxCrm >= 0) {
        const countRet = await client.query(models.count_crms_ativos_empresa(), [empresaId]);
        const totalCrms = toNumber(countRet.rows[0]?.total) || 0;
        if (totalCrms >= maxCrm) {
          throw new Error(
            `Limite de CRMs da assinatura atingido (${totalCrms}/${maxCrm}).`
          );
        }
      }

      const createdRet = await client.query(models.insert_crm(), [
        empresaId,
        nome,
        descricao,
        filialId,
      ]);
      const crm = createdRet.rows[0];

      const assignedUserIds = payload.usuarios_vinculados_ids || payload.assignedUserIds;
      if (Array.isArray(assignedUserIds) && assignedUserIds.length) {
        await syncCrmAssignedUsers(client, empresaId, crm.id, assignedUserIds);
      }

      if (metaNumberIds !== undefined) {
        await syncCrmMetaNumbers(client, empresaId, crm.id, metaNumberIds);
      }

      await createDefaultCrmStages(client, crm.id);
      await client.query("COMMIT");

      return await ensureCrmAccess(
        client,
        empresaId,
        crm.id,
        getRequesterContext(payload).usuarioId,
        true
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_editar_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const crmId = toNumber(payload.crm_id || payload.crmId || payload.id);
      const nome = normalizeText(payload.nome || payload.name);
      const descricao = normalizeText(payload.descricao || payload.description);
      const assignedUserIds = payload.usuarios_vinculados_ids || payload.assignedUserIds;
      const metaNumberIds =
        payload.meta_param_ids !== undefined
          ? payload.meta_param_ids
          : payload.metaParamIds !== undefined
          ? payload.metaParamIds
          : payload.empresa_meta_param_ids;
      const filialPayload =
        payload.filial_id !== undefined
          ? payload.filial_id
          : payload.filialId !== undefined
          ? payload.filialId
          : payload.branchId !== undefined
          ? payload.branchId
          : payload.branch_id;
      const automacaoEtapaAtendimentoIniciadoPayload =
        payload.automacao_etapa_atendimento_iniciado_id !== undefined
          ? payload.automacao_etapa_atendimento_iniciado_id
          : payload.automacaoEtapaAtendimentoIniciadoId;
      const automacaoEtapaOrcamentoEnviadoPayload =
        payload.automacao_etapa_orcamento_enviado_id !== undefined
          ? payload.automacao_etapa_orcamento_enviado_id
          : payload.automacaoEtapaOrcamentoEnviadoId;
      const ativoSolicitado =
        payload.ativo === undefined && payload.active === undefined
          ? null
          : Boolean(payload.ativo ?? payload.active);
      const { usuarioId, isMaster } = getRequesterContext(payload);

      if (!empresaId || !crmId) throw new Error("Informe a empresa e o CRM.");

      const current = await ensureCrmAccess(client, empresaId, crmId, usuarioId, isMaster);
      const automacaoEtapaAtendimentoIniciadoId =
        automacaoEtapaAtendimentoIniciadoPayload !== undefined
          ? await resolveAutomationStageSelection(
              client,
              crmId,
              automacaoEtapaAtendimentoIniciadoPayload,
              "atendimento iniciado"
            )
          : toNumber(current.automacao_etapa_atendimento_iniciado_id);
      const automacaoEtapaOrcamentoEnviadoId =
        automacaoEtapaOrcamentoEnviadoPayload !== undefined
          ? await resolveAutomationStageSelection(
              client,
              crmId,
              automacaoEtapaOrcamentoEnviadoPayload,
              "orçamento criado"
            )
          : toNumber(current.automacao_etapa_orcamento_enviado_id);
      const financialConfig = await resolveCrmFinancialConfig(
        client,
        empresaId,
        current,
        payload
      );
      if (current.master && ativoSolicitado === false) {
        throw new Error("O pipeline master não pode ser apagado.");
      }

      if (ativoSolicitado === false) {
        const deletedRet = await client.query(models.soft_delete_crm(), [crmId, empresaId]);
        if (!deletedRet.rows.length) {
          throw new Error("Não foi possível apagar o CRM informado.");
        }
        await client.query("COMMIT");
        return deletedRet.rows[0];
      }

      const currentFilialId = Number(current.filial_id || 0);
      const resolvedFilialId =
        filialPayload !== undefined
          ? await resolveFilialIdForCrm(client, empresaId, filialPayload)
          : currentFilialId > 0
          ? currentFilialId
          : null;

      const updatedRet = await client.query(models.update_crm(), [
        crmId,
        nome || current.nome,
        descricao === null ? null : descricao ?? current.descricao,
        resolvedFilialId,
        automacaoEtapaAtendimentoIniciadoId,
        automacaoEtapaOrcamentoEnviadoId,
        financialConfig.enabled,
        financialConfig.contaId,
        financialConfig.categoriaId,
        financialConfig.centroCustoId,
        financialConfig.empresaGrupoId,
        financialConfig.vencimentoDias,
        empresaId,
      ]);

      if (!updatedRet.rows.length) {
        throw new Error("Não foi possível atualizar o CRM.");
      }

      if (assignedUserIds !== undefined) {
        await syncCrmAssignedUsers(client, empresaId, crmId, assignedUserIds);
      }

      if (metaNumberIds !== undefined) {
        await syncCrmMetaNumbers(client, empresaId, crmId, metaNumberIds);
      }

      const updated = await ensureCrmAccess(client, empresaId, crmId, usuarioId, true);
      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_criar_coluna_crm: async (payload) => {
    const client = await postgres.connect();
    let operation = "begin";
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const crmId = toNumber(payload.crm_id || payload.crmId);
      const nome = normalizeText(payload.nome || payload.name);
      const cor = normalizeText(payload.cor || payload.color);
      const ordemSolicitada = toNumber(payload.ordem ?? payload.order);
      const codigoSolicitado = normalizeText(payload.codigo || payload.code);
      const { usuarioId, isMaster } = getRequesterContext(payload);

      if (!empresaId || !crmId) throw new Error("Informe a empresa e o CRM.");
      if (!nome) throw new Error("Informe o nome da coluna.");

      await client.query("select pg_advisory_xact_lock($1, $2)", [918273, crmId]);
      operation = "validate_access";
      await ensureCrmAccess(client, empresaId, crmId, usuarioId, isMaster);

      if (codigoSolicitado && REQUIRED_STAGE_CODES.has(codigoSolicitado)) {
        throw new Error("Este código de coluna é reservado pelo sistema.");
      }

      operation = "validate_name";
      const existingName = await client.query(models.get_etapa_by_nome_any(), [crmId, nome]);
      if (existingName.rows.length) {
        throw new Error("Já existe uma coluna com este nome neste CRM.");
      }
      operation = "generate_code";
      const codigo = await generateUniqueStageCode(client, crmId, nome, codigoSolicitado);
      operation = "resolve_order";
      const nextOrdRet = await client.query(models.get_next_ordem_etapa(), [crmId]);
      const maxOrder = Math.max(0, Number(nextOrdRet.rows[0]?.proxima_ordem || 0));
      const allStages = (await client.query(models.list_etapas_any(), [crmId])).rows;
      const temporaryOrder = allStages.length
        ? Math.max(...allStages.map((stage) => Number(stage.ordem) || 0)) + 1
        : 0;
      const finalOrder =
        ordemSolicitada === null || ordemSolicitada < 0
          ? maxOrder
          : Math.min(ordemSolicitada, maxOrder);

      operation = "insert_stage";
      const inserted = await client.query(models.insert_etapa(), [
        crmId,
        codigo,
        nome,
        temporaryOrder,
        cor,
        false,
        false,
        false,
      ]);

      const etapaCriada = inserted.rows[0];
      operation = "resequence_stages";
      const orderedIds = (await client.query(models.list_etapas(), [crmId])).rows
        .map((row) => Number(row.id))
        .filter((id) => id !== Number(etapaCriada.id));
      orderedIds.splice(finalOrder, 0, Number(etapaCriada.id));
      await resequenceEtapas(client, crmId, orderedIds);

      await client.query("COMMIT");
      return (await client.query(models.get_etapa_by_id_and_crm(), [etapaCriada.id, crmId])).rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[execute_criar_coluna_crm] falha", {
        operation,
        empresa_id: payload?.empresa_id || payload?.empresaId || null,
        crm_id: payload?.crm_id || payload?.crmId || null,
        usuario_id: payload?.usuario_id || payload?.usuarioId || null,
        nome: payload?.nome || payload?.name || null,
        code: error?.code || null,
        constraint: error?.constraint || null,
        detail: error?.detail || null,
        message: error?.message || String(error),
        stack: error?.stack || null,
      });
      throw error;
    } finally {
      client.release();
    }
  },

  execute_editar_coluna_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const crmId = toNumber(payload.crm_id || payload.crmId);
      const etapaId = toNumber(payload.etapa_id || payload.etapaId || payload.id);
      const nome = normalizeText(payload.nome || payload.name);
      const cor = normalizeText(payload.cor || payload.color);
      const ordemSolicitada = toNumber(payload.ordem ?? payload.order);
      const { usuarioId, isMaster } = getRequesterContext(payload);

      if (!empresaId || !crmId || !etapaId) {
        throw new Error("Informe a empresa, CRM e coluna.");
      }

      await client.query("select pg_advisory_xact_lock($1, $2)", [918273, crmId]);
      await ensureCrmAccess(client, empresaId, crmId, usuarioId, isMaster);

      const etapaRet = await client.query(models.get_etapa_by_id_and_crm(), [etapaId, crmId]);
      if (!etapaRet.rows.length || !etapaRet.rows[0].ativo) {
        throw new Error("Coluna não encontrada.");
      }
      const etapaAtual = etapaRet.rows[0];
      const nomeFinal = nome || etapaAtual.nome;

      const existingName = await client.query(models.get_etapa_by_nome_any(), [crmId, nomeFinal]);
      if (existingName.rows.length && Number(existingName.rows[0].id) !== Number(etapaId)) {
        throw new Error("Já existe outra coluna com este nome neste CRM.");
      }

      await client.query(models.update_etapa_meta(), [etapaId, nomeFinal, cor, crmId]);

      if (ordemSolicitada !== null && ordemSolicitada >= 0) {
        const etapasRet = await client.query(models.list_etapas(), [crmId]);
        const stageIds = etapasRet.rows.map((row) => Number(row.id));
        const currentIndex = stageIds.findIndex((id) => id === Number(etapaId));
        const maxOrder = Math.max(0, stageIds.length - 1);
        const targetOrder = Math.min(ordemSolicitada, maxOrder);
        if (currentIndex >= 0 && currentIndex !== targetOrder) {
          const reorderedIds = [...stageIds];
          const [moved] = reorderedIds.splice(currentIndex, 1);
          reorderedIds.splice(targetOrder, 0, moved);
          await resequenceEtapas(client, crmId, reorderedIds);
        }
      }

      const updatedRet = await client.query(models.get_etapa_by_id_and_crm(), [etapaId, crmId]);
      await resequenceEtapas(client, crmId);
      await client.query("COMMIT");
      return updatedRet.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_reordenar_colunas_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const crmId = toNumber(payload.crm_id || payload.crmId);
      const etapaIds = Array.isArray(payload.etapa_ids || payload.etapaIds)
        ? (payload.etapa_ids || payload.etapaIds).map((id) => toNumber(id)).filter(Boolean)
        : [];
      const { usuarioId, isMaster } = getRequesterContext(payload);

      if (!empresaId || !crmId) throw new Error("Informe a empresa e o CRM.");
      if (!etapaIds.length) throw new Error("Informe a nova ordem das colunas.");

      await client.query("select pg_advisory_xact_lock($1, $2)", [918273, crmId]);
      await ensureCrmAccess(client, empresaId, crmId, usuarioId, isMaster);

      const activeRet = await client.query(models.list_etapas(), [crmId]);
      const activeIds = activeRet.rows.map((row) => Number(row.id));
      if (activeIds.length !== etapaIds.length) {
        throw new Error("A ordenação precisa conter todas as colunas ativas do CRM.");
      }

      const activeSet = new Set(activeIds);
      for (const etapaId of etapaIds) {
        if (!activeSet.has(Number(etapaId))) {
          throw new Error("Foi informada uma coluna inválida na ordenação.");
        }
      }

      await resequenceEtapas(client, crmId, etapaIds);

      await client.query("COMMIT");
      return (await client.query(models.list_etapas(), [crmId])).rows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_deletar_coluna_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const crmId = toNumber(payload.crm_id || payload.crmId);
      const etapaId = toNumber(payload.etapa_id || payload.etapaId || payload.id);
      const { usuarioId, isMaster } = getRequesterContext(payload);

      if (!empresaId || !crmId || !etapaId) {
        throw new Error("Informe a empresa, CRM e coluna.");
      }

      await client.query("select pg_advisory_xact_lock($1, $2)", [918273, crmId]);
      await ensureCrmAccess(client, empresaId, crmId, usuarioId, isMaster);

      const etapaRet = await client.query(models.get_etapa_by_id_and_crm(), [etapaId, crmId]);
      if (!etapaRet.rows.length || !etapaRet.rows[0].ativo) {
        throw new Error("Coluna não encontrada.");
      }
      const etapa = etapaRet.rows[0];

      if (REQUIRED_STAGE_CODES.has(etapa.codigo)) {
        throw new Error("Não é permitido apagar colunas obrigatórias do CRM.");
      }

      const waitingStage = await resolveWaitingStage(client, crmId);
      await client.query(models.move_active_negocios_to_waiting(), [crmId, etapaId, waitingStage.id]);
      await client.query(models.clear_crm_automation_stage_references(), [crmId, etapaId]);
      await client.query(models.soft_delete_etapa(), [etapaId, crmId]);
      await resequenceEtapas(client, crmId);
      await client.query(models.resequence_stage(), [crmId, waitingStage.id]);

      await client.query("COMMIT");
      return (await client.query(models.list_etapas(), [crmId])).rows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_listar_produtos_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      if (!empresaId) throw new Error("Empresa inválida para listar produtos.");

      const ret = await client.query(models.list_produtos(), [empresaId]);
      return ret.rows.map(mapProduct);
    } finally {
      client.release();
    }
  },

  execute_get_produto_crm_by_id: async (empresaId, produtoId) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_produto_by_id(), [produtoId, empresaId]);
      return ret.rows.length ? mapProduct(ret.rows[0]) : null;
    } finally {
      client.release();
    }
  },

  execute_criar_produto_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const nome = normalizeText(payload.nome || payload.name);
      const descricao = normalizeText(payload.descricao || payload.description);
      const precoBase = Number(payload.preco_base ?? payload.price ?? payload.precoBase ?? 0);

      if (!empresaId) throw new Error("Empresa inválida para criar produto.");
      if (!nome) throw new Error("Informe o nome do produto.");
      if (!Number.isFinite(precoBase) || precoBase < 0) {
        throw new Error("Informe um preço válido para o produto.");
      }

      const existingRet = await client.query(models.get_produto_by_nome(), [empresaId, nome]);
      if (existingRet.rows.length) {
        const existing = existingRet.rows[0];
        const query = existing.ativo ? models.update_produto() : models.reactivate_produto();
        const updatedRet = await client.query(query, [existing.id, empresaId, nome, descricao, precoBase]);
        await client.query("COMMIT");
        return mapProduct(updatedRet.rows[0]);
      }

      const createdRet = await client.query(models.insert_produto(), [
        empresaId,
        nome,
        descricao,
        precoBase,
      ]);

      await client.query("COMMIT");
      return mapProduct(createdRet.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_editar_produto_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const produtoId = toNumber(payload.produto_id || payload.produtoId || payload.id);
      const nome = normalizeText(payload.nome || payload.name);
      const descricao = normalizeText(payload.descricao || payload.description);
      const precoBase = Number(payload.preco_base ?? payload.price ?? payload.precoBase ?? 0);

      if (!empresaId || !produtoId) throw new Error("Informe empresa e produto.");
      if (!nome) throw new Error("Informe o nome do produto.");
      if (!Number.isFinite(precoBase) || precoBase < 0) {
        throw new Error("Informe um preço válido para o produto.");
      }

      const currentRet = await client.query(models.get_produto_by_id(), [produtoId, empresaId]);
      if (!currentRet.rows.length || !currentRet.rows[0].ativo) {
        throw new Error("Produto não encontrado.");
      }

      const existingNameRet = await client.query(models.get_produto_by_nome(), [empresaId, nome]);
      if (
        existingNameRet.rows.length &&
        Number(existingNameRet.rows[0].id) !== Number(produtoId) &&
        existingNameRet.rows[0].ativo
      ) {
        throw new Error("Já existe outro produto ativo com este nome.");
      }

      const updatedRet = await client.query(models.update_produto(), [
        produtoId,
        empresaId,
        nome,
        descricao,
        precoBase,
      ]);

      await client.query("COMMIT");
      return mapProduct(updatedRet.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_deletar_produto_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const produtoId = toNumber(payload.produto_id || payload.produtoId || payload.id);
      if (!empresaId || !produtoId) throw new Error("Informe empresa e produto.");

      const deletedRet = await client.query(models.soft_delete_produto(), [produtoId, empresaId]);
      if (!deletedRet.rows.length) {
        throw new Error("Produto não encontrado ou já removido.");
      }

      await client.query("COMMIT");
      return { id: produtoId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_contar_imagens_produto_crm: async (empresaId, produtoId) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.count_produto_imagens_ativas(), [
        produtoId,
        empresaId,
      ]);
      return Number(ret.rows?.[0]?.total || 0);
    } finally {
      client.release();
    }
  },

  execute_adicionar_imagem_produto_crm: async ({
    empresaId,
    produtoId,
    url,
    pathBunny,
    nomeArquivo,
    mimeType,
    tamanhoBytes,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      const ordemRet = await client.query(models.get_next_produto_imagem_ordem(), [
        produtoId,
        empresaId,
      ]);
      const ordem = Number(ordemRet.rows?.[0]?.proxima_ordem || 1);
      const inserted = await client.query(models.insert_produto_imagem(), [
        produtoId,
        empresaId,
        url,
        pathBunny,
        nomeArquivo,
        mimeType,
        tamanhoBytes,
        ordem,
      ]);
      await client.query("COMMIT");
      return inserted.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_get_produto_imagem_by_id: async (imagemId, empresaId) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_produto_imagem_by_id(), [
        imagemId,
        empresaId,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_deletar_imagem_produto_crm: async (imagemId, empresaId) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.soft_delete_produto_imagem(), [
        imagemId,
        empresaId,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_contar_documentos_produto_crm: async (empresaId, produtoId) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.count_produto_documentos_ativos(), [
        produtoId,
        empresaId,
      ]);
      return Number(ret.rows?.[0]?.total || 0);
    } finally {
      client.release();
    }
  },

  execute_adicionar_documento_produto_crm: async ({
    empresaId,
    produtoId,
    url,
    pathBunny,
    nomeArquivo,
    mimeType,
    tamanhoBytes,
  }) => {
    const client = await postgres.connect();
    try {
      const inserted = await client.query(models.insert_produto_documento(), [
        produtoId,
        empresaId,
        url,
        pathBunny,
        nomeArquivo,
        mimeType,
        tamanhoBytes,
      ]);
      return inserted.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_get_produto_documento_by_id: async (documentoId, empresaId) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_produto_documento_by_id(), [
        documentoId,
        empresaId,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_deletar_documento_produto_crm: async (documentoId, empresaId) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.soft_delete_produto_documento(), [
        documentoId,
        empresaId,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_listar_imagens_produto_crm_por_ids: async (empresaId, imagemIds) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_produto_imagens_by_ids(), [
        empresaId,
        imagemIds,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_obter_dominios_crm: async (payloadOrEmpresaId, crmId = null, sharedClient = null) => {
    const client = sharedClient || (await postgres.connect());
    const shouldRelease = !sharedClient;
    try {
      const payload =
        typeof payloadOrEmpresaId === "object" && payloadOrEmpresaId !== null
          ? payloadOrEmpresaId
          : { empresa_id: payloadOrEmpresaId, crm_id: crmId };
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const { usuarioId, isMaster } = getRequesterContext(payload);
      const hasManagerScope = await hasCommercialManagerAccessInDb(
        client,
        payload,
        empresaId,
        usuarioId
      );
      const hasGlobalCommercialScope = Boolean(isMaster) || hasManagerScope;
      const crmResolved = await resolveCrmIdWithAccess(
        client,
        empresaId,
        payload.crm_id || payload.crmId || crmId,
        usuarioId,
        hasGlobalCommercialScope
      );
      const crmAccess = await ensureCrmAccess(
        client,
        empresaId,
        crmResolved,
        usuarioId,
        hasGlobalCommercialScope
      );
      await ensureDefaultMotivosPerda(client);

      const [
        etapas,
        formas,
        motivos,
        tipos,
        tags,
        produtos,
        responsaveis,
        filiais,
        metaNumeros,
        origensVenda,
      ] =
        await Promise.all([
        client.query(models.list_etapas(), [crmResolved]),
        client.query(models.list_formas_pagamento(), [empresaId]),
        client.query(models.list_motivos_perda(), [empresaId]),
        client.query(models.list_tipos_interacao(), [empresaId]),
        client.query(models.list_tags(), [empresaId]),
        client.query(models.list_produtos(), [empresaId]),
        client.query(models.list_responsaveis(), [empresaId]),
        client.query(models.list_filiais_empresa(), [empresaId]),
        client.query(models.list_meta_numeros_empresa(), [empresaId]),
        client.query(models.list_origens_venda_crm(), [empresaId, crmResolved]),
      ]);
      const visibleResponsaveis = await filterVisibleResponsiblesForCrm(
        client,
        empresaId,
        crmResolved,
        responsaveis.rows,
        usuarioId,
        hasGlobalCommercialScope
      );

      return {
        crm_id: crmResolved,
        etapas: etapas.rows,
        formas_pagamento: formas.rows,
        motivos_perda: motivos.rows,
        tipos_interacao: tipos.rows,
        tags: tags.rows,
        produtos: produtos.rows,
        responsaveis: visibleResponsaveis,
        filiais: filiais.rows,
        meta_numeros: metaNumeros.rows,
        origens_venda: (origensVenda.rows || []).map((row) => ({
          valor: row.valor,
          label: row.valor,
        })),
        filial_id: crmAccess.filial_id === null || crmAccess.filial_id === undefined
          ? null
          : Number(crmAccess.filial_id),
        automacao_etapa_atendimento_iniciado_id:
          crmAccess.automacao_etapa_atendimento_iniciado_id === null ||
          crmAccess.automacao_etapa_atendimento_iniciado_id === undefined
            ? null
            : Number(crmAccess.automacao_etapa_atendimento_iniciado_id),
        automacao_etapa_orcamento_enviado_id:
          crmAccess.automacao_etapa_orcamento_enviado_id === null ||
          crmAccess.automacao_etapa_orcamento_enviado_id === undefined
            ? null
            : Number(crmAccess.automacao_etapa_orcamento_enviado_id),
        financeiro_gerar_conta_receber: crmAccess.financeiro_gerar_conta_receber === true,
        financeiro_conta_financeira_id: toNumber(crmAccess.financeiro_conta_financeira_id),
        financeiro_categoria_id: toNumber(crmAccess.financeiro_categoria_id),
        financeiro_centro_custo_id: toNumber(crmAccess.financeiro_centro_custo_id),
        financeiro_empresa_grupo_id: toNumber(crmAccess.financeiro_empresa_grupo_id),
        financeiro_vencimento_dias: Math.max(0, toNumber(crmAccess.financeiro_vencimento_dias) || 0),
        filial_nome: crmAccess.filial_nome || null,
        meta_numeros_vinculados: Array.isArray(crmAccess.meta_numeros)
          ? crmAccess.meta_numeros
          : [],
        usuarios_vinculados: crmAccess.usuarios_vinculados || [],
        acesso_restrito: crmAccess.acesso_restrito === true,
      };
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  },

  execute_buscar_clientes: async (payload) => {
    const client = await postgres.connect();
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const termoBase = normalizeText(payload.search || payload.busca || payload.term || payload.query);
      const termo = termoBase ? `%${termoBase}%` : null;
      const limite = Math.min(50, Math.max(1, toNumber(payload.limit || payload.limite) || 10));

      if (!empresaId) {
        throw new Error("Empresa inválida para busca de clientes.");
      }

      const ret = await client.query(models.search_clientes_empresa(), [
        empresaId,
        termo,
        limite,
      ]);

      return ret.rows.map((row) => ({
        id: String(row.id),
        nome: row.nome,
        telefone: row.telefone,
        email: row.email,
        data_aniversario: row.data_aniversario,
      }));
    } finally {
      client.release();
    }
  },

  execute_listar_negocios: async (payload, sharedClient = null) => {
    const client = sharedClient || (await postgres.connect());
    const shouldRelease = !sharedClient;
    try {
      const skipMetaAdsSchemaEnsure = toBoolean(
        payload.skip_meta_ads_schema_ensure ?? payload.skipMetaAdsSchemaEnsure
      );
      if (!skipMetaAdsSchemaEnsure) {
        await executeMetaAds.execute_ensure_meta_ads_schema(client);
      }
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const { usuarioId, isMaster } = getRequesterContext(payload);
      const hasManagerScope = await hasCommercialManagerAccessInDb(
        client,
        payload,
        empresaId,
        usuarioId
      );
      const hasGlobalCommercialScope = Boolean(isMaster) || hasManagerScope;
      const canViewAllOwners = hasGlobalCommercialScope;
      const requestedCrmId = toNumber(payload.crm_id || payload.crmId);
      const accessibleCrms =
        !requestedCrmId && !hasGlobalCommercialScope
          ? await listAccessibleCrms(
              client,
              empresaId,
              usuarioId,
              hasGlobalCommercialScope
            )
          : null;
      const crmId = requestedCrmId
        ? await resolveCrmIdWithAccess(
            client,
            empresaId,
            requestedCrmId,
            usuarioId,
            hasGlobalCommercialScope
          )
        : null;
      const responsavelFiltroSolicitado = toNumber(
        payload.responsavel_usuario_id || payload.ownerId || payload.sellerId
      );
      const responsavelId = canViewAllOwners
        ? responsavelFiltroSolicitado
        : usuarioId || responsavelFiltroSolicitado;
      const etapaCodigo = normalizeText(payload.stage || payload.etapa_codigo || payload.status);
      const buscaBase = normalizeText(payload.search || payload.busca || payload.globalSearch || payload.searchTerm);
      const busca = buscaBase ? `%${buscaBase}%` : null;
      const dataInicio = startOfDay(payload.data_inicio || payload.dateStart || payload.start);
      const dataFim = endOfDay(payload.data_fim || payload.dateEnd || payload.end);
      const tag = normalizeText(payload.tag || payload.tagName || payload.selectedTag);
      const product = normalizeText(
        payload.product || payload.productName || payload.produto_nome || payload.productFilter
      );
      const origin = normalizeText(
        payload.origin || payload.origem || payload.saleOrigin || payload.originFilter
      );
      const withoutFilial = toBoolean(
        payload.sem_filial ?? payload.withoutFilial ?? payload.withoutBranch
      );
      const filialFiltroPayload =
        payload.filial_id !== undefined
          ? payload.filial_id
          : payload.filialId !== undefined
          ? payload.filialId
          : payload.branchId !== undefined
          ? payload.branchId
          : payload.branch_id;
      const filialId = withoutFilial ? null : toNumber(filialFiltroPayload);
      const paginaSolicitada = toNumber(payload.pagina || payload.page);
      const limiteSolicitado = toNumber(payload.limite || payload.limit);
      const paginado = toBoolean(
        payload.paginado ?? payload.paginated ?? payload.comPaginas
      ) || limiteSolicitado !== null;
      const applyLeadTimeSqlOffset = toBoolean(
        payload.apply_dashboard_lead_time_offset_sql ??
          payload.applyLeadTimeSqlOffsetSql ??
          payload.dashboardLeadTimeSqlOffset
      );
      const dashboardCompactMode = toBoolean(
        payload.dashboard_compact_mode ?? payload.dashboardCompactMode
      );
      const baseParams = [
        empresaId,
        crmId,
        responsavelId,
        etapaCodigo,
        busca,
        dataInicio,
        dataFim,
        tag,
        product,
        filialId,
        withoutFilial,
        origin,
      ];
      const allowedCrmIds = accessibleCrms
        ? new Set(accessibleCrms.map((crm) => Number(crm.id)))
        : null;

      if (paginado) {
        const pagina = Math.max(paginaSolicitada || 1, 1);
        const limite = Math.min(100, Math.max(limiteSolicitado || 20, 1));
        const offset = (pagina - 1) * limite;
        const listNegociosPaginadosQuery = applyLeadTimeSqlOffset
          ? applyLeadTimeSqlOffsetToNegociosQuery(models.list_negocios_paginados())
          : models.list_negocios_paginados();
        const countNegociosQuery = applyLeadTimeSqlOffset
          ? applyLeadTimeSqlOffsetToNegociosQuery(models.count_negocios())
          : models.count_negocios();

        const [ret, totalRet] = await Promise.all([
          client.query(listNegociosPaginadosQuery, [
            ...baseParams,
            limite,
            offset,
          ]),
          client.query(countNegociosQuery, baseParams),
        ]);

        const items = ret.rows
          .filter((row) => !allowedCrmIds || allowedCrmIds.has(Number(row.crm_id)))
          .map(mapDeal);
        const total = Number(totalRet.rows[0]?.total || 0);
        const totalValor = Number(totalRet.rows[0]?.total_valor || 0);

        return {
          items,
          total,
          pagina,
          limite,
          total_paginas: Math.max(1, Math.ceil(total / limite)),
          total_valor: totalValor,
        };
      }

      const listNegociosBaseQuery = dashboardCompactMode
        ? models.list_negocios_dashboard()
        : models.list_negocios();
      const listNegociosQuery = applyLeadTimeSqlOffset
        ? applyLeadTimeSqlOffsetToNegociosQuery(listNegociosBaseQuery)
        : listNegociosBaseQuery;
      const ret = await client.query(listNegociosQuery, baseParams);

      return ret.rows
        .filter((row) => !allowedCrmIds || allowedCrmIds.has(Number(row.crm_id)))
        .map(mapDeal);
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  },

  execute_listar_negocios_fechados: async (payload, sharedClient = null) => {
    const client = sharedClient || (await postgres.connect());
    const shouldRelease = !sharedClient;
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const { usuarioId, isMaster } = getRequesterContext(payload);
      const hasManagerScope = await hasCommercialManagerAccessInDb(
        client,
        payload,
        empresaId,
        usuarioId
      );
      const hasGlobalCommercialScope = Boolean(isMaster) || hasManagerScope;
      const canViewAllOwners = hasGlobalCommercialScope;
      const requestedCrmId = toNumber(payload.crm_id || payload.crmId);
      const accessibleCrms =
        !requestedCrmId && !hasGlobalCommercialScope
          ? await listAccessibleCrms(
              client,
              empresaId,
              usuarioId,
              hasGlobalCommercialScope
            )
          : null;
      const crmId = requestedCrmId
        ? await resolveCrmIdWithAccess(
            client,
            empresaId,
            requestedCrmId,
            usuarioId,
            hasGlobalCommercialScope
          )
        : null;
      const responsavelFiltroSolicitado = toNumber(
        payload.responsavel_usuario_id || payload.ownerId || payload.sellerId
      );
      const responsavelId = canViewAllOwners
        ? responsavelFiltroSolicitado
        : usuarioId || responsavelFiltroSolicitado;
      const etapaCodigo = normalizeText(payload.stage || payload.etapa_codigo || payload.status);
      const buscaBase = normalizeText(
        payload.search || payload.busca || payload.globalSearch || payload.searchTerm
      );
      const busca = buscaBase ? `%${buscaBase}%` : null;
      const dataInicio = startOfDay(payload.data_inicio || payload.dateStart || payload.start);
      const dataFim = endOfDay(payload.data_fim || payload.dateEnd || payload.end);
      const product = normalizeText(
        payload.product || payload.productName || payload.produto_nome || payload.productFilter
      );
      const origin = normalizeText(
        payload.origin || payload.origem || payload.saleOrigin || payload.originFilter
      );
      const withoutFilial = toBoolean(
        payload.sem_filial ?? payload.withoutFilial ?? payload.withoutBranch
      );
      const filialFiltroPayload =
        payload.filial_id !== undefined
          ? payload.filial_id
          : payload.filialId !== undefined
          ? payload.filialId
          : payload.branchId !== undefined
          ? payload.branchId
          : payload.branch_id;
      const filialId = withoutFilial ? null : toNumber(filialFiltroPayload);
      const pagina = Math.max(toNumber(payload.pagina || payload.page) || 1, 1);
      const allowLargeLimit = toBoolean(
        payload.allow_large_limit ?? payload.allowLargeLimit ?? payload.exportAll
      );
      const limiteMaximo = allowLargeLimit ? 100000 : 100;
      const limite = Math.min(
        limiteMaximo,
        Math.max(toNumber(payload.limite || payload.limit) || 20, 1)
      );
      const offset = (pagina - 1) * limite;

      const [ret, totalRet] = await Promise.all([
        client.query(models.list_negocios_fechados(), [
          empresaId,
          crmId,
          responsavelId,
          etapaCodigo,
          busca,
          dataInicio,
          dataFim,
          product,
          filialId,
          withoutFilial,
          origin,
          limite,
          offset,
        ]),
        client.query(models.count_negocios_fechados(), [
          empresaId,
          crmId,
          responsavelId,
          etapaCodigo,
          busca,
          dataInicio,
          dataFim,
          product,
          filialId,
          withoutFilial,
          origin,
        ]),
      ]);

      const allowedCrmIds = accessibleCrms
        ? new Set(accessibleCrms.map((crm) => Number(crm.id)))
        : null;
      const items = ret.rows
        .filter((row) => !allowedCrmIds || allowedCrmIds.has(Number(row.crm_id)))
        .map(mapDeal);
      const total = Number(totalRet.rows[0]?.total || 0);

      return {
        items,
        total,
        pagina,
        limite,
        total_paginas: Math.max(1, Math.ceil(total / limite)),
      };
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  },

  execute_listar_vendas_consolidadas: async (payload) => {
    const client = await postgres.connect();
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      if (!empresaId) throw new Error("Empresa invalida para listar vendas.");

      const { usuarioId, isMaster } = getRequesterContext(payload);
      const hasManagerScope = await hasCommercialManagerAccessInDb(
        client,
        payload,
        empresaId,
        usuarioId
      );
      const hasGlobalCommercialScope = Boolean(isMaster) || hasManagerScope;
      const requestedOwnerId = toNumber(
        payload.responsavel_usuario_id || payload.ownerId || payload.sellerId
      );
      const responsavelId = hasGlobalCommercialScope
        ? requestedOwnerId
        : usuarioId || requestedOwnerId;
      const buscaBase = normalizeText(
        payload.product || payload.produto || payload.productName ||
          payload.search || payload.busca || payload.globalSearch || payload.searchTerm
      );
      const busca = buscaBase ? `%${buscaBase}%` : null;
      const dataInicio = startOfDay(payload.data_inicio || payload.dateStart || payload.start);
      const dataFim = endOfDay(payload.data_fim || payload.dateEnd || payload.end);
      const fonteSolicitada = normalizeText(payload.fonte || payload.source);
      const fonte = ["crm", "hotmart", "hubla", "importada"].includes(String(fonteSolicitada || "").toLowerCase())
        ? String(fonteSolicitada).toLowerCase()
        : null;
      const pagina = Math.max(toNumber(payload.pagina || payload.page) || 1, 1);
      const limite = Math.min(100, Math.max(toNumber(payload.limite || payload.limit) || 20, 1));
      const offset = (pagina - 1) * limite;

      const tablesRet = hasGlobalCommercialScope
        ? await client.query(
            `select
               to_regclass('public.hotmart_evento') as hotmart,
               to_regclass('public.hubla_evento') as hubla,
               to_regclass('public.venda_importada') as importada,
               exists (
                 select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'hotmart_evento'
                   and column_name = 'vendedor_usuario_id'
               ) as hotmart_has_seller,
               exists (
                 select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'hubla_evento'
                   and column_name = 'vendedor_usuario_id'
               ) as hubla_has_seller`
          )
        : { rows: [{}] };
      const availableTables = tablesRet.rows?.[0] || {};
      const includeHotmart = Boolean(availableTables.hotmart);
      const includeHubla = Boolean(availableTables.hubla);
      const includeImported = Boolean(availableTables.importada);
      const includeExternalSales = hasGlobalCommercialScope;
      const sourceForQuery = includeExternalSales
        ? fonte
        : fonte
        ? fonte === "crm"
          ? "crm"
          : "__sem_acesso__"
        : null;

      const queryOptions = {
        includeHotmart: includeExternalSales && includeHotmart,
        includeHubla: includeExternalSales && includeHubla,
        includeImported: hasGlobalCommercialScope && includeImported,
        hotmartHasSeller: Boolean(availableTables.hotmart_has_seller),
        hublaHasSeller: Boolean(availableTables.hubla_has_seller),
      };
      const queryParams = [
        empresaId,
        responsavelId,
        busca,
        dataInicio,
        dataFim,
        sourceForQuery,
        limite,
        offset,
      ];
      const [rowsRet, totalRet] = await Promise.all([
        client.query(models.list_vendas_consolidadas(queryOptions), queryParams),
        client.query(models.count_vendas_consolidadas(queryOptions), queryParams.slice(0, 5)),
      ]);
      const total = Number(totalRet.rows?.[0]?.total || 0);

      return {
        items: (rowsRet.rows || []).map((row) => ({
          id: `${row.fonte}-${row.venda_id}`,
          fonte: row.fonte,
          vendaId: row.venda_id,
          crmId: row.crm_id === null || row.crm_id === undefined ? null : Number(row.crm_id),
          funilNome: row.funil_nome || null,
          clienteId:
            row.cliente_id === null || row.cliente_id === undefined
              ? null
              : Number(row.cliente_id),
          clienteNome: row.cliente_nome || "Cliente nao informado",
          descricao: row.descricao || "Venda",
          valor: row.valor === null || row.valor === undefined ? null : Number(row.valor),
          origem: row.origem || row.fonte,
          vendidoEm: row.vendido_em || null,
          vendedorId:
            row.vendedor_id === null || row.vendedor_id === undefined
              ? null
              : Number(row.vendedor_id),
          vendedorNome: row.vendedor_nome || null,
          transacaoId: row.transacao_id || null,
          status: row.status || null,
        })),
        total,
        pagina,
        limite,
        total_paginas: Math.max(1, Math.ceil(total / limite)),
      };
    } finally {
      client.release();
    }
  },

  execute_importar_vendas_consolidadas: async (payload) => {
    const client = await postgres.connect();
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const rows = Array.isArray(payload.vendas) ? payload.vendas.slice(0, 500) : [];
      if (!empresaId || !rows.length) throw new Error("Informe ao menos uma venda para importar.");
      const tableRet = await client.query("select to_regclass('public.venda_importada') as tabela");
      if (!tableRet.rows?.[0]?.tabela) {
        throw new Error("Execute o SQL runtime_vendas_importadas_schema.sql antes de importar vendas.");
      }
      await client.query("BEGIN");
      let imported = 0;
      const errors = [];
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index] || {};
        const clienteNome = normalizeText(row.cliente_nome || row.cliente || row.nome);
        const dataVenda = formatDateOnly(row.data_venda || row.data || row.fechamento);
        if (!clienteNome || !dataVenda) {
          errors.push({ linha: index + 2, mensagem: "Cliente e data da venda sao obrigatorios." });
          continue;
        }
        await client.query(
          `insert into public.venda_importada (empresa_id, cliente_nome, cliente_telefone, cliente_email, produto_nome, valor, data_venda, origem, vendedor_usuario_id, observacoes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [empresaId, clienteNome, normalizeText(row.telefone), normalizeText(row.email), normalizeText(row.produto || row.produto_nome), Number(row.valor || 0) || 0, dataVenda, normalizeText(row.origem) || "importacao", toNumber(row.vendedor_id || row.vendedor_usuario_id), normalizeText(row.observacoes)]
        );
        imported += 1;
      }
      await client.query("COMMIT");
      return { imported, errors };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  },

  execute_editar_venda_importada: async (payload) => {
    const client = await postgres.connect();
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const vendaId = toNumber(payload.venda_id || payload.vendaId || payload.id);
      const clienteNome = normalizeText(payload.clienteNome || payload.cliente_nome);
      const produtoNome = normalizeText(payload.descricao || payload.produto || payload.produto_nome);
      const dataVenda = formatDateOnly(payload.vendidoEm || payload.data_venda);
      const valor = Number(payload.valor ?? payload.amount);
      const origem = normalizeText(payload.origem || payload.saleOrigin) || "importacao";
      const vendedorId = toNumber(payload.vendedorId ?? payload.ownerId ?? payload.vendedor_usuario_id);

      if (!empresaId || !vendaId) throw new Error("Venda importada nao encontrada.");
      if (!clienteNome) throw new Error("Informe o nome do cliente.");
      if (!dataVenda) throw new Error("Informe uma data de venda valida.");
      if (!Number.isFinite(valor) || valor < 0) throw new Error("Informe um valor de venda valido.");

      if (vendedorId) {
        const usuarioRet = await client.query(
          "select 1 from public.usuario where id = $1 and empresa_id = $2 and ativo = true",
          [vendedorId, empresaId]
        );
        if (!usuarioRet.rows.length) throw new Error("Vendedor nao encontrado nesta empresa.");
      }

      const updated = await client.query(
        `update public.venda_importada
            set cliente_nome = $3,
                produto_nome = $4,
                valor = $5,
                data_venda = $6,
                origem = $7,
                vendedor_usuario_id = $8,
                atualizado_em = now()
          where id = $1
            and empresa_id = $2
            and ativo = true
          returning id, cliente_nome, produto_nome, valor, data_venda, origem, vendedor_usuario_id`,
        [vendaId, empresaId, clienteNome, produtoNome || null, valor, dataVenda, origem, vendedorId]
      );

      if (!updated.rows.length) throw new Error("Venda importada nao encontrada.");
      return updated.rows[0];
    } finally {
      client.release();
    }
  },

  execute_atribuir_vendedor_venda_integracao: async (payload) => {
    const client = await postgres.connect();
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const vendaId = toNumber(payload.venda_id || payload.vendaId || payload.id);
      const fonte = String(payload.fonte || payload.source || "").toLowerCase();
      const vendedorId = toNumber(payload.vendedorId ?? payload.ownerId ?? payload.vendedor_usuario_id);
      const tableName = fonte === "hotmart" ? "hotmart_evento" : fonte === "hubla" ? "hubla_evento" : null;

      if (!empresaId || !vendaId || !tableName) throw new Error("Venda de integracao invalida.");
      const columnRet = await client.query(
        `select exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = $1
             and column_name = 'vendedor_usuario_id'
         ) as existe`,
        [tableName]
      );
      if (!columnRet.rows?.[0]?.existe) {
        throw new Error("Execute o SQL runtime_vendas_integracoes_vendedor_schema.sql antes de atribuir vendedores.");
      }

      if (vendedorId) {
        const usuarioRet = await client.query(
          "select 1 from public.usuario where id = $1 and empresa_id = $2 and ativo = true",
          [vendedorId, empresaId]
        );
        if (!usuarioRet.rows.length) throw new Error("Vendedor nao encontrado nesta empresa.");
      }

      const updated = await client.query(
        `update public.${tableName}
            set vendedor_usuario_id = $3
          where id = $1 and empresa_id = $2
          returning id, vendedor_usuario_id`,
        [vendaId, empresaId, vendedorId]
      );
      if (!updated.rows.length) throw new Error("Venda de integracao nao encontrada.");
      return updated.rows[0];
    } finally {
      client.release();
    }
  },

  execute_excluir_venda_consolidada: async (payload) => {
    const client = await postgres.connect();
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const vendaId = toNumber(payload.venda_id || payload.vendaId || payload.id);
      const fonte = String(payload.fonte || payload.source || "").toLowerCase();
      const { usuarioId, isMaster } = getRequesterContext(payload);
      if (!empresaId || !vendaId || !["crm", "importada"].includes(fonte)) {
        throw new Error("Venda invalida para exclusao.");
      }

      if (fonte === "crm") {
        const currentRet = await client.query(models.get_negocio_raw(), [vendaId, empresaId]);
        if (!currentRet.rows.length) throw new Error("Negocio nao encontrado.");
        await ensureCrmAccess(
          client,
          empresaId,
          currentRet.rows[0].crm_id,
          usuarioId,
          isMaster
        );
        await client.query(models.soft_delete_negocio(), [vendaId, empresaId]);
      } else {
        const deleted = await client.query(
          `update public.venda_importada
              set ativo = false, atualizado_em = now()
            where id = $1 and empresa_id = $2 and ativo = true
            returning id`,
          [vendaId, empresaId]
        );
        if (!deleted.rows.length) throw new Error("Venda importada nao encontrada.");
      }
      return { id: vendaId, fonte };
    } finally {
      client.release();
    }
  },

  execute_criar_negocio: async (payload) => {
    const client = await postgres.connect();
    let transactionCommitted = false;
    try {
      await client.query("BEGIN");
      let createdCustomerId = null;

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const { usuarioId: requesterUserId, isMaster } = getRequesterContext(payload);
      const crmId = await resolveCrmIdWithAccess(
        client,
        empresaId,
        payload.crm_id || payload.crmId,
        requesterUserId,
        isMaster
      );
      const etapa = await resolveEtapa(client, crmId, payload.etapa_id, payload.stage);
      const usuarioId = await resolveUsuarioId(
        client,
        empresaId,
        payload.ownerId || payload.responsavel_usuario_id,
        payload.ownerName || payload.responsavel_nome
      );
      const clienteId = await resolveClienteId(client, payload, empresaId, null, (cliente) => {
        createdCustomerId = cliente?.id || null;
      });
      const formaPagamentoId = await resolveFormaPagamentoId(
        client,
        empresaId,
        payload.forma_pagamento_id,
        payload.paymentMethod
      );
      const motivoPerdaId = await resolveMotivoPerdaId(
        client,
        empresaId,
        payload.motivo_perda_id,
        payload.refusalReason
      );
      const posRet = await client.query(models.get_next_posicao(), [crmId, etapa.id]);

      const values = buildNegocioValues(payload, null, {
        etapa,
        clienteId,
        usuarioId,
        formaPagamentoId,
        motivoPerdaId,
        posicaoPadrao: posRet.rows[0]?.proxima_posicao || 0,
      });

      const created = await client.query(models.insert_negocio(), [
        empresaId,
        crmId,
        values.cliente_id,
        values.responsavel_usuario_id,
        values.etapa_id,
        values.titulo,
        values.nome_empresa,
        values.nome_contato,
        values.telefone,
        values.email,
        values.documento,
        values.temperatura,
        values.probabilidade,
        values.valor_estimado,
        values.valor_fechamento,
        values.quantidade_itens,
        values.origem_venda,
        values.forma_pagamento_id,
        values.parcelas,
        values.motivo_perda_id,
        values.observacoes_venda,
        values.observacoes_perda,
        values.data_criacao,
        values.data_entrada_pipeline,
        values.data_fechamento_prevista,
        values.data_fechamento_real,
        values.posicao_kanban,
      ]);

      const negocioId = created.rows[0].id;

      await syncTags(client, empresaId, negocioId, payload.tags || []);
      const syncedOrcamento = await syncOrcamento(client, empresaId, negocioId, payload, values);
      await client.query(models.insert_movimentacao(), [
        negocioId,
        usuarioId,
        null,
        etapa.id,
        "Negócio criado",
      ]);

      await client.query(models.resequence_stage(), [crmId, etapa.id]);
      if (syncedOrcamento?.created) {
        await applyCrmAutomationToNegocio(client, {
          empresaId,
          negocioId,
          usuarioId,
          actionKey: "orcamento_enviado",
        });
      }

      await client.query("COMMIT");
      transactionCommitted = true;
      if (etapa.eh_ganho) {
        await syncCrmReceivable(client, { empresaId, negocioId, values, usuarioId });
      }
      if (createdCustomerId) {
        developerWebhooks.queueCustomerCreated(createdCustomerId);
      }

      const deals = await execute.execute_listar_negocios({
        ...payload,
        empresa_id: empresaId,
        crm_id: crmId,
        usuario_id: requesterUserId,
        is_master: isMaster,
      }, client);
      return deals.find((deal) => deal.id === String(negocioId));
    } catch (error) {
      if (!transactionCommitted) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  },

  execute_atualizar_negocio: async (payload) => {
    const client = await postgres.connect();
    let transactionCommitted = false;
    try {
      await client.query("BEGIN");
      let createdCustomerId = null;

      const empresaId = toNumber(payload.empresa_id);
      const negocioId = toNumber(payload.negocio_id);
      const { usuarioId: requesterUserId, isMaster } = getRequesterContext(payload);
      const currentRet = await client.query(models.get_negocio_raw(), [negocioId, empresaId]);

      if (!currentRet.rows.length) {
        throw new Error("Negócio não encontrado.");
      }

      const current = currentRet.rows[0];
      const chatCrmAccessOptions = {
        conversaId: payload.conversa_id || payload.conversation_id,
        negocio: current,
      };
      await ensureCrmAccess(
        client,
        empresaId,
        current.crm_id,
        requesterUserId,
        isMaster,
        chatCrmAccessOptions
      );
      const crmId = await resolveCrmIdWithAccess(
        client,
        empresaId,
        payload.crm_id || payload.crmId || current.crm_id,
        requesterUserId,
        isMaster,
        chatCrmAccessOptions
      );
      const etapaAtual = await resolveEtapa(client, current.crm_id, current.etapa_id, null);
      const etapa = await resolveEtapaDestinoNegocio(
        client,
        current.crm_id,
        current.etapa_id,
        crmId,
        payload.etapa_id || payload.etapaId,
        payload.stage
      );
      const usuarioId = await resolveUsuarioId(
        client,
        empresaId,
        payload.ownerId || payload.responsavel_usuario_id || current.responsavel_usuario_id,
        payload.ownerName || payload.responsavel_nome
      );
      const clienteId = await resolveClienteId(
        client,
        payload,
        empresaId,
        current.cliente_id,
        (cliente) => {
          createdCustomerId = cliente?.id || null;
        }
      );
      const formaPagamentoId = await resolveFormaPagamentoId(
        client,
        empresaId,
        payload.forma_pagamento_id || current.forma_pagamento_id,
        payload.paymentMethod
      );
      const motivoPerdaId = await resolveMotivoPerdaId(
        client,
        empresaId,
        payload.motivo_perda_id || current.motivo_perda_id,
        payload.refusalReason
      );

      const values = buildNegocioValues(payload, current, {
        etapa,
        clienteId,
        usuarioId,
        formaPagamentoId,
        motivoPerdaId,
        posicaoPadrao: current.posicao_kanban,
      });

      await client.query(models.update_negocio(), [
        negocioId,
        crmId,
        values.cliente_id,
        values.responsavel_usuario_id,
        values.etapa_id,
        values.titulo,
        values.nome_empresa,
        values.nome_contato,
        values.telefone,
        values.email,
        values.documento,
        values.temperatura,
        values.probabilidade,
        values.valor_estimado,
        values.valor_fechamento,
        values.quantidade_itens,
        values.origem_venda,
        values.forma_pagamento_id,
        values.parcelas,
        values.motivo_perda_id,
        values.observacoes_venda,
        values.observacoes_perda,
        values.data_entrada_pipeline,
        values.data_fechamento_prevista,
        values.data_fechamento_real,
        values.posicao_kanban,
      ]);

      if (Array.isArray(payload.tags)) {
        await syncTags(client, empresaId, negocioId, payload.tags);
      }

      let syncedOrcamento = null;
      if (
        payload.quote !== undefined ||
        payload.orcamento !== undefined ||
        Array.isArray(payload.products) ||
        payload.amount !== undefined ||
        payload.valor_estimado !== undefined ||
        payload.valor_fechamento !== undefined ||
        payload.saleValue !== undefined ||
        payload.itemQuantity !== undefined ||
        payload.quantidade_itens !== undefined ||
        payload.title !== undefined ||
        payload.titulo !== undefined ||
        payload.saleNotes !== undefined ||
        payload.observacoes_venda !== undefined
      ) {
        syncedOrcamento = await syncOrcamento(client, empresaId, negocioId, payload, values);
      }

      if (Number(current.etapa_id) !== Number(etapa.id)) {
        await client.query(models.insert_movimentacao(), [
          negocioId,
          usuarioId,
          current.etapa_id,
          etapa.id,
          "Etapa alterada",
        ]);
        await registrarHistoricoMovimentacaoEtapa(client, {
          empresaId,
          negocioId,
          clienteId: values.cliente_id || current.cliente_id,
          usuarioId,
          etapaOrigem: etapaAtual,
          etapaDestino: etapa,
        });
        await client.query(models.resequence_stage(), [current.crm_id, current.etapa_id]);
        await client.query(models.resequence_stage(), [crmId, etapa.id]);
      }

      if (etapa.eh_fechamento && Number(current.etapa_id) !== Number(etapa.id)) {
        const fechamentoEm = combineDateWithSaoPauloCurrentTime(values.data_fechamento_real);

        await client.query(models.close_open_interactions_for_negocio(), [
          empresaId,
          negocioId,
          fechamentoEm,
        ]);
      }

      if (syncedOrcamento?.created) {
        await applyCrmAutomationToNegocio(client, {
          empresaId,
          negocioId,
          usuarioId,
          actionKey: "orcamento_enviado",
        });
      }

      await client.query("COMMIT");
      transactionCommitted = true;
      if (etapa.eh_ganho && Number(current.etapa_id) !== Number(etapa.id)) {
        await syncCrmReceivable(client, { empresaId, negocioId, values, usuarioId });
      }
      if (createdCustomerId) {
        developerWebhooks.queueCustomerCreated(createdCustomerId);
      }
      if (etapa.eh_fechamento && Number(current.etapa_id) !== Number(etapa.id)) {
        developerWebhooks.queueDealClosed(
          negocioId,
          etapa.eh_ganho ? "deal.closed_won" : "deal.closed_lost"
        );
      }

      const deals = await execute.execute_listar_negocios({
        ...payload,
        empresa_id: empresaId,
        crm_id: crmId,
        id: negocioId,
        usuario_id: requesterUserId,
        is_master: isMaster,
      }, client);
      return deals.find((deal) => deal.id === String(negocioId));
    } catch (error) {
      if (!transactionCommitted) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  },

  execute_mover_negocio: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id);
      const negocioId = toNumber(payload.negocio_id);
      const newOrder = Math.max(0, toNumber( payload.nova_posicao ) || 0);
      const { usuarioId: requesterUserId, isMaster } = getRequesterContext(payload);
      const currentRet = await client.query(models.get_negocio_raw(), [negocioId, empresaId]);

      if (!currentRet.rows.length) {
        throw new Error("Negócio não encontrado.");
      }

      const current = currentRet.rows[0];
      const chatCrmAccessOptions = {
        conversaId: payload.conversa_id || payload.conversation_id,
        negocio: current,
      };
      await ensureCrmAccess(
        client,
        empresaId,
        current.crm_id,
        requesterUserId,
        isMaster,
        chatCrmAccessOptions
      );
      const crmId = await resolveCrmIdWithAccess(
        client,
        empresaId,
        payload.crm_id || payload.crmId || current.crm_id,
        requesterUserId,
        isMaster,
        chatCrmAccessOptions
      );
      const etapaAtual = await resolveEtapa(client, current.crm_id, current.etapa_id, null);
      const etapa = await resolveEtapaDestinoNegocio(
        client,
        current.crm_id,
        current.etapa_id,
        crmId,
        payload.etapa_id || payload.etapaId,
        payload.newStage || payload.stage
      );
      const movedIntoClosing =
        Boolean(etapa?.eh_fechamento) && Number(current.etapa_id) !== Number(etapa.id);
      const movedOutOfClosing = !Boolean(etapa?.eh_fechamento) && Boolean(etapaAtual?.eh_fechamento);
      const movedSaleDate = formatDateOnly(payload.saleDate || payload.data_fechamento_real);
      const effectiveSaleDate = movedIntoClosing
        ? movedSaleDate ||
          current.data_fechamento_real ||
          current.data_fechamento_prevista ||
          getSaoPauloTodayDate()
        : movedOutOfClosing
        ? null
        : current.data_fechamento_real;

      await client.query(models.update_negocio(), [
        negocioId,
        crmId,
        current.cliente_id,
        current.responsavel_usuario_id,
        etapa.id,
        current.titulo,
        current.nome_empresa,
        current.nome_contato,
        current.telefone,
        current.email,
        current.documento,
        current.temperatura,
        current.probabilidade,
        current.valor_estimado,
        current.valor_fechamento,
        current.quantidade_itens,
        current.origem_venda,
        current.forma_pagamento_id,
        current.parcelas,
        current.motivo_perda_id,
        current.observacoes_venda,
        current.observacoes_perda,
        current.data_entrada_pipeline,
        current.data_fechamento_prevista,
        effectiveSaleDate,
        newOrder,
      ]);

      const usuarioId = toNumber(payload.usuario_id || payload.userId) || current.responsavel_usuario_id;

      await client.query(models.insert_movimentacao(), [
        negocioId,
        usuarioId,
        current.etapa_id,
        etapa.id,
        "Movimentação no pipeline",
      ]);

      if (Number(current.etapa_id) !== Number(etapa.id)) {
        await registrarHistoricoMovimentacaoEtapa(client, {
          empresaId,
          negocioId,
          clienteId: current.cliente_id,
          usuarioId,
          etapaOrigem: etapaAtual,
          etapaDestino: etapa,
        });
      }

      await client.query(models.resequence_stage(), [current.crm_id, current.etapa_id]);
      await client.query(models.resequence_stage(), [crmId, etapa.id]);
      await client.query("COMMIT");
      if (movedIntoClosing && etapa.eh_ganho) {
        await syncCrmReceivable(client, {
          empresaId,
          negocioId,
          usuarioId,
          values: {
            ...current,
            data_fechamento_real: effectiveSaleDate,
          },
        });
      }
      if (etapa.eh_fechamento && Number(current.etapa_id) !== Number(etapa.id)) {
        developerWebhooks.queueDealClosed(
          negocioId,
          etapa.eh_ganho ? "deal.closed_won" : "deal.closed_lost"
        );
      }
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_deletar_negocio: async (payloadOrNegocioId, empresaId = null) => {
    const client = await postgres.connect();
    try {
      const payload =
        typeof payloadOrNegocioId === "object" && payloadOrNegocioId !== null
          ? payloadOrNegocioId
          : { negocio_id: payloadOrNegocioId, empresa_id: empresaId };
      const negocioId = toNumber(payload.negocio_id);
      const empresaIdResolved = toNumber(payload.empresa_id);
      const { usuarioId, isMaster } = getRequesterContext(payload);

      const currentRet = await client.query(models.get_negocio_raw(), [negocioId, empresaIdResolved]);
      if (!currentRet.rows.length) {
        throw new Error("Negocio nao encontrado.");
      }

      await ensureCrmAccess(
        client,
        empresaIdResolved,
        currentRet.rows[0].crm_id,
        usuarioId,
        isMaster
      );

      const ret = await client.query(models.soft_delete_negocio(), [negocioId, empresaIdResolved]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_deletar_negocios_coluna: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const crmId = toNumber(payload.crm_id || payload.crmId);
      const etapaId = toNumber(payload.etapa_id || payload.etapaId || payload.stageId);
      const { usuarioId, isMaster } = getRequesterContext(payload);

      if (!empresaId || !crmId || !etapaId) {
        throw new Error("Informe a empresa, o CRM e a coluna.");
      }

      if (!isMaster) {
        throw new Error("Apenas o usuario master pode excluir todos os cards da coluna.");
      }

      await ensureCrmAccess(client, empresaId, crmId, usuarioId, isMaster);

      const etapaRet = await client.query(models.get_etapa_by_id_and_crm(), [etapaId, crmId]);
      if (!etapaRet.rows.length || etapaRet.rows[0].ativo === false) {
        throw new Error("Coluna nao encontrada para este CRM.");
      }

      const deleteRet = await client.query(models.soft_delete_negocios_by_stage(), [
        empresaId,
        crmId,
        etapaId,
      ]);

      await client.query("COMMIT");
      return {
        deletedCount: deleteRet.rowCount || 0,
        negocioIds: deleteRet.rows.map((row) => Number(row.id)),
        etapa: etapaRet.rows[0],
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_aplicar_automacao_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const negocioIdPayload = toNumber(payload.negocio_id || payload.negocioId);
      const clienteId = toNumber(payload.cliente_id || payload.clienteId);
      const empresaMetaParamId = toNumber(
        payload.empresa_meta_param_id || payload.meta_param_id || payload.metaParamId
      );
      const usuarioId = toNumber(
        payload.usuario_id || payload.userId || payload.responsavel_usuario_id
      );
      const actionKey = normalizeText(payload.acao || payload.action);

      if (!empresaId || !actionKey) {
        throw new Error("Informe a empresa e a ação da automação do CRM.");
      }

      let negocioId = negocioIdPayload;
      if (!negocioId) {
        if (!clienteId) {
          throw new Error("Informe um negócio ou cliente para aplicar a automação do CRM.");
        }

        let openDeal = null;
        const crmFromMeta = await resolveCrmIdForIncomingWhatsapp(
          client,
          empresaId,
          empresaMetaParamId
        );

        if (crmFromMeta?.id) {
          const openByCrmRet = await client.query(models.find_open_negocio_by_cliente_crm(), [
            empresaId,
            crmFromMeta.id,
            clienteId,
          ]);
          openDeal = openByCrmRet.rows[0] || null;
        }

        if (!openDeal) {
          const openAnyRet = await client.query(models.find_open_negocio_by_cliente_any(), [
            empresaId,
            clienteId,
          ]);
          openDeal = openAnyRet.rows[0] || null;
        }

        negocioId = toNumber(openDeal?.id);
      }

      if (!negocioId) {
        await client.query("ROLLBACK");
        return { moved: false, reason: "no_open_deal" };
      }

      const result = await applyCrmAutomationToNegocio(client, {
        empresaId,
        negocioId,
        usuarioId,
        actionKey,
      });

      await client.query("COMMIT");
      return {
        ...result,
        negocio_id: negocioId,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_atribuir_responsavel_negocio: async (payload) => {
    const client = await postgres.connect();
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const clienteId = toNumber(payload.cliente_id || payload.clienteId);
      const usuarioResponsavelId = toNumber(
        payload.usuario_id || payload.userId || payload.responsavel_usuario_id
      );
      const { usuarioId: requesterUserId, isMaster } = getRequesterContext(payload);

      if (!empresaId || !clienteId || !usuarioResponsavelId) {
        throw new Error("Informe empresa, cliente e usuario responsavel.");
      }

      const crmAtendimentoRet = await client.query(models.get_cliente_crm_atendimento(), [
        clienteId,
        empresaId,
      ]);
      const crmAtendimento = crmAtendimentoRet.rows[0] || null;
      if (!crmAtendimento?.negocio_id) {
        return { updated: false, reason: "no_open_deal" };
      }

      const ret = await client.query(models.update_negocio_responsavel(), [
        usuarioResponsavelId,
        crmAtendimento.negocio_id,
        empresaId,
      ]);

      return {
        updated: Boolean(ret.rows.length),
        negocio_id: crmAtendimento.negocio_id,
        crm_id: crmAtendimento.crm_id,
        responsavel_usuario_id: usuarioResponsavelId,
      };
    } finally {
      client.release();
    }
  },

  execute_assumir_responsavel_cliente_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const clienteId = toNumber(payload.cliente_id || payload.clienteId);
      const usuarioResponsavelId = toNumber(
        payload.usuario_id || payload.userId || payload.responsavel_usuario_id
      );

      if (!empresaId || !clienteId || !usuarioResponsavelId) {
        return { updated: false, reason: "invalid_payload" };
      }

      const ret = await client.query(models.update_negocios_cliente_responsavel(), [
        usuarioResponsavelId,
        empresaId,
        clienteId,
      ]);

      return {
        updated: (ret.rowCount || 0) > 0,
        updatedCount: ret.rowCount || 0,
        negocioIds: ret.rows.map((row) => Number(row.id)),
        responsavel_usuario_id: usuarioResponsavelId,
      };
    } finally {
      client.release();
    }
  },

  execute_criar_negocio_entrada_whatsapp: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const clienteId = toNumber(payload.cliente_id || payload.clienteId);
      const conversaId = toNumber(payload.conversa_id || payload.conversaId);
      const empresaMetaParamId = toNumber(
        payload.empresa_meta_param_id || payload.meta_param_id || payload.metaParamId
      );
      const statusConversa = toNumber(payload.status_id || payload.statusId);
      const allowManualBinding = toBoolean(
        payload.allow_manual_binding ?? payload.allowManualBinding
      );
      const telefoneConversa = normalizeText(payload.telefone || payload.number_phone_id || payload.numberPhoneId);
      const nomeContatoPayload = normalizeText(payload.nome_contato || payload.contactName || payload.nome);

      if (!empresaId || !clienteId || !conversaId) {
        throw new Error("Dados inválidos para criar entrada de WhatsApp no CRM.");
      }

      if (
        allowManualBinding &&
        statusConversa !== null &&
        ![0, 1].includes(Number(statusConversa))
      ) {
        await client.query("ROLLBACK");
        return { created: false, reason: "conversation_closed" };
      }

      // Somente conversas na fila de aguardando atendimento quando for criacao automatica.
      if (!allowManualBinding && statusConversa !== null && statusConversa !== 0) {
        await client.query("ROLLBACK");
        return { created: false, reason: "status_not_waiting" };
      }

      const crm = await resolveCrmIdForIncomingWhatsapp(
        client,
        empresaId,
        empresaMetaParamId
      );
      if (!crm?.id) {
        await client.query("ROLLBACK");
        return { created: false, reason: "crm_not_linked_to_meta_number" };
      }

      const crmId = Number(crm.id);
      const openNegocioRet = await client.query(models.find_open_negocio_by_cliente_crm(), [
        empresaId,
        crmId,
        clienteId,
      ]);
      const openNegocio = openNegocioRet.rows[0] || null;

      if (openNegocio?.id) {
        const interactionId = await registrarInteracao(client, {
          empresaId,
          negocioId: openNegocio.id,
          clienteId,
          usuarioId: openNegocio.responsavel_usuario_id || null,
          tipoCodigo: "whatsapp",
          descricao: "Novo atendimento via WhatsApp.",
          dataInicio: new Date().toISOString(),
          dataFim: new Date().toISOString(),
          emAndamento: false,
        });

        await client.query("COMMIT");
        return {
          created: false,
          reason: "open_deal_exists",
          negocio_id: Number(openNegocio.id),
          interaction_id: interactionId || null,
        };
      }

      const etapa = await resolveEtapa(client, crmId, null, "waiting");
      const posRet = await client.query(models.get_next_posicao(), [crmId, etapa.id]);
      const clienteRet = await client.query(models.get_cliente_by_id(), [clienteId, empresaId]);
      const cliente = clienteRet.rows[0] || {};
      const nomeContato =
        nomeContatoPayload ||
        normalizeText(cliente.nome) ||
        "Cliente";
      const telefone = telefoneConversa || normalizeText(cliente.telefone);

      const createdAt = new Date().toISOString();
      const observacaoEntrada = "Lead recebido via WhatsApp.";

      const created = await client.query(models.insert_negocio(), [
        empresaId,
        crmId,
        clienteId,
        null,
        etapa.id,
        `WhatsApp - ${nomeContato}`,
        nomeContato,
        nomeContato,
        telefone,
        normalizeText(cliente.email),
        null,
        "morno",
        50,
        0,
        null,
        null,
        "whatsapp",
        null,
        null,
        null,
        null,
        null,
        createdAt,
        createdAt,
        null,
        null,
        posRet.rows[0]?.proxima_posicao || 0,
      ]);

      const negocioId = created.rows[0].id;

      await client.query(models.insert_movimentacao(), [
        negocioId,
        null,
        null,
        etapa.id,
        observacaoEntrada,
      ]);

      await client.query(models.insert_historico_cliente(), [
        empresaId,
        negocioId,
        clienteId,
        null,
        null,
        "whatsapp-entry",
        "Entrada via WhatsApp",
        observacaoEntrada,
        JSON.stringify({
          conversaId,
          crmId,
          etapaId: etapa.id,
          etapaCodigo: etapa.codigo,
          etapaNome: etapa.nome,
          createdAt,
        }),
      ]);

      await client.query(models.resequence_stage(), [crmId, etapa.id]);
      await client.query("COMMIT");
      return { created: true, negocio_id: negocioId, crm_id: crmId, etapa_id: etapa.id };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_registrar_interacao: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const negocioId = toNumber(payload.negocio_id || payload.negocioId || payload.dealId || payload.id);
      if (!empresaId || !negocioId) {
        throw new Error("Informe a empresa e o negócio da interação.");
      }

      const tipoCodigo = normalizeText(payload.type || payload.tipo || payload.tipo_codigo || payload.codigo);
      if (!tipoCodigo) {
        throw new Error("Informe o tipo da interação.");
      }

      const negocioRet = await client.query(models.get_negocio_raw(), [negocioId, empresaId]);
      if (!negocioRet.rows.length) {
        throw new Error("Negócio não encontrado.");
      }

      const negocio = negocioRet.rows[0];
      const { usuarioId: requesterUserId, isMaster } = getRequesterContext(payload);
      await ensureCrmAccess(client, empresaId, negocio.crm_id, requesterUserId, isMaster);
      const clienteId = toNumber(payload.cliente_id || payload.clienteId || negocio.cliente_id);
      if (!clienteId) {
        throw new Error("O negócio informado não possui cliente vinculado.");
      }

      const usuarioId = await resolveUsuarioId(
        client,
        empresaId,
        payload.usuario_id || payload.userId || negocio.responsavel_usuario_id,
        payload.ownerName || payload.responsavel_nome
      );

      const dataInicio = toIsoOrNull(payload.date || payload.data_inicio || payload.startDate) || new Date().toISOString();
      const emAndamento = Boolean(payload.isCurrent ?? payload.em_andamento);
      const categoria = normalizeInteractionCategory(
        payload.category || payload.categoria
      );
      const dataFim =
        payload.endDate !== undefined || payload.data_fim !== undefined
          ? toIsoOrNull(payload.endDate || payload.data_fim)
          : emAndamento
          ? null
          : dataInicio;

      const interactionId = await registrarInteracao(client, {
        empresaId,
        negocioId,
        clienteId,
        usuarioId,
        tipoCodigo,
        descricao: normalizeText(payload.description || payload.descricao) || "InteraÃ§Ã£o registrada manualmente.",
        dataInicio,
        dataFim,
        duracaoSegundos: toNumber(payload.durationSeconds || payload.duracao_segundos),
        valor: payload.value === undefined ? null : Number(payload.value) || 0,
        emAndamento,
        categoria,
      });

      await client.query("COMMIT");
      return { id: interactionId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_finalizar_interacao: async (payload) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const interactionId = toNumber(
        payload.interaction_id || payload.interactionId || payload.id_interacao || payload.id
      );
      if (!empresaId || !interactionId) {
        throw new Error("Informe a empresa e a interacao.");
      }

      const interacaoRet = await client.query(models.get_interacao_by_id(), [interactionId, empresaId]);
      if (!interacaoRet.rows.length) {
        throw new Error("Interacao nao encontrada.");
      }

      const interacao = interacaoRet.rows[0];
      const { usuarioId: requesterUserId, isMaster } = getRequesterContext(payload);
      const negocioRet = await client.query(models.get_negocio_raw(), [
        interacao.negocio_id,
        empresaId,
      ]);
      if (!negocioRet.rows.length) {
        throw new Error("Negócio não encontrado.");
      }

      await ensureCrmAccess(client, empresaId, negocioRet.rows[0].crm_id, requesterUserId, isMaster);

      const now = new Date().toISOString();
      const closeRet = await client.query(models.close_interacao_by_id(), [interactionId, now, empresaId]);
      if (!closeRet.rows.length) {
        throw new Error("Interacao ja encerrada.");
      }
      await client.query("COMMIT");
      return {
        negocio_id: Number(closeRet.rows[0].negocio_id),
        interaction_id: interactionId,
        closedAt: now,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_historico_cliente: async (payloadOrEmpresaId, negocioId = null) => {
    const client = await postgres.connect();
    try {
      const payload =
        typeof payloadOrEmpresaId === "object" && payloadOrEmpresaId !== null
          ? payloadOrEmpresaId
          : { empresa_id: payloadOrEmpresaId, negocio_id: negocioId };
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const negocioIdResolved = toNumber(payload.negocio_id || payload.dealId || payload.id || negocioId);
      const { usuarioId, isMaster } = getRequesterContext(payload);
      const negocioRet = await client.query(models.get_negocio_raw(), [negocioIdResolved, empresaId]);
      if (!negocioRet.rows.length) {
        throw new Error("Negócio não encontrado.");
      }

      await ensureCrmAccess(client, empresaId, negocioRet.rows[0].crm_id, usuarioId, isMaster);

      const clienteId = negocioRet.rows[0].cliente_id;
      if (!clienteId) {
        return {
          id: null,
          name: negocioRet.rows[0].nome_contato,
          email: negocioRet.rows[0].email,
          phone: negocioRet.rows[0].telefone,
          entryDate: negocioRet.rows[0].data_criacao,
          totalPurchases: 0,
          totalSpent: 0,
          averageTicket: 0,
          lastInteraction: null,
          interactions: [],
          appointments: [],
          history: [],
        };
      }

        const [profileRet, interactionsRet, historyRet] = await Promise.all([
          client.query(models.get_customer_profile(), [clienteId, empresaId]),
          client.query(models.list_customer_interactions(), [empresaId, clienteId]),
          client.query(models.list_customer_history(), [empresaId, clienteId]),
        ]);

        const profile = profileRet.rows[0];
        const interactions = interactionsRet.rows.map((row) => ({
          id: String(row.id),
          type: row.type,
          category: normalizeInteractionCategory(row.category),
          typeName: row.typeName || null,
          date: row.date ? new Date(row.date).toISOString() : null,
          endDate: row.endDate ? new Date(row.endDate).toISOString() : undefined,
          description: row.description,
          attendantName: row.attendantName,
          duration: formatDuration(row.duracao_segundos),
          value: row.value === null || row.value === undefined ? undefined : Number(row.value),
          isCurrent: !!row.isCurrent,
        }));

        return {
          id: String(profile.id),
          name: profile.nome,
          email: profile.email,
          phone: profile.telefone,
        entryDate: profile.entryDate ? new Date(profile.entryDate).toISOString() : null,
          totalPurchases: Number(profile.totalPurchases || 0),
          totalSpent: Number(profile.totalSpent || 0),
          averageTicket: Number(profile.averageTicket || 0),
          lastInteraction: profile.lastInteraction ? new Date(profile.lastInteraction).toISOString() : null,
          interactions: interactions.filter((row) => row.category === "interacao"),
          appointments: interactions.filter((row) => row.category === "agendamento"),
          history: historyRet.rows.map((row) => ({
            id: String(row.id),
            type: row.type || "system",
            title: row.title || "Registro",
            description: row.description || "",
          date: row.date ? new Date(row.date).toISOString() : null,
          attendantName: row.attendantName || "Sistema",
          interactionId:
            row.interactionId === null || row.interactionId === undefined
              ? undefined
              : String(row.interactionId),
          data: row.data || {},
        })),
      };
    } finally {
      client.release();
    }
  },

  execute_listar_agendamentos_calendario: async (payload) => {
    const client = await postgres.connect();
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const crmId = toNumber(payload.crm_id || payload.crmId);
      if (!empresaId || !crmId) {
        throw new Error("Informe a empresa e o CRM para carregar os agendamentos.");
      }

      const { usuarioId, isMaster } = getRequesterContext(payload);
      await ensureCrmAccess(client, empresaId, crmId, usuarioId, isMaster);

      const start =
        toIsoOrNull(payload.dateStart || payload.startDate || payload.inicio) ||
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const end =
        toIsoOrNull(payload.dateEnd || payload.endDate || payload.fim) ||
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();
      const ownerId = toNumber(payload.ownerId || payload.usuario_id_filtro || payload.usuarioIdFiltro);

      const ret = await client.query(models.list_crm_calendar_appointments(), [
        empresaId,
        crmId,
        start,
        end,
        ownerId || null,
      ]);

      return ret.rows.map((row) => ({
        id: String(row.id),
        dealId: row.dealId ? String(row.dealId) : null,
        dealTitle: row.dealTitle || "",
        customerName: row.customerName || "",
        customerPhone: row.customerPhone || "",
        ownerName: row.ownerName || "Sistema",
        type: row.type || "meeting",
        typeName: row.typeName || "Agendamento",
        category: normalizeInteractionCategory(row.category),
        description: row.description || "",
        startDate: row.startDate ? new Date(row.startDate).toISOString() : null,
        endDate: row.endDate ? new Date(row.endDate).toISOString() : null,
        isCurrent: Boolean(row.isCurrent),
      }));
    } finally {
      client.release();
    }
  },

  execute_dashboard_crm: async (payload) => {
    const cacheKey = buildCrmDashboardCacheKey(payload);
    const cachedDashboard = getCachedCrmDashboard(cacheKey);
    if (cachedDashboard) {
      return cachedDashboard;
    }

    const inflightDashboard = crmDashboardInflightByKey.get(cacheKey);
    if (inflightDashboard) {
      return inflightDashboard;
    }

    const dashboardPromise = (async () => {
      const client = await postgres.connect();
      try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const domains = await execute.execute_obter_dominios_crm(payload, null, client);
      const requestedCrmId = toNumber(payload.crm_id || payload.crmId);
      const basePayload = {
        ...payload,
        ...(requestedCrmId ? { crm_id: domains.crm_id } : {}),
        dashboardLeadTimeSqlOffset: true,
        dashboardCompactMode: true,
        skipMetaAdsSchemaEnsure: true,
      };
      const allDealsPayload = {
        ...basePayload,
        data_inicio: null,
        data_fim: null,
        dateStart: null,
        dateEnd: null,
        start: null,
        end: null,
      };
      const closedDealsPayload = {
        ...basePayload,
        pagina: 1,
        limite: 100000,
        allowLargeLimit: true,
      };
      const deals = await execute.execute_listar_negocios(basePayload, client);
      const allScopedDeals = await execute.execute_listar_negocios(allDealsPayload, client);
      const closedDealsResult = await execute.execute_listar_negocios_fechados(
        closedDealsPayload,
        client
      );

      const relevantDealIds = uniqueNumberList([
        ...deals.map((deal) => deal.id),
        ...allScopedDeals.map((deal) => deal.id),
      ]);
      const filteredDealIds = uniqueNumberList(deals.map((deal) => deal.id));
      const linkedMetaNumberIds = Array.isArray(domains.meta_numeros_vinculados)
        ? uniqueNumberList(
            domains.meta_numeros_vinculados.map((item) =>
              Number(item?.empresa_meta_param_id || item?.id || 0)
            )
          )
        : [];
      const dashboardInteractionsRet = relevantDealIds.length
        ? await client.query(models.list_dashboard_interacoes_by_negocios(), [
            empresaId,
            relevantDealIds,
          ])
        : { rows: [] };
      const dashboardContactsRet = filteredDealIds.length
        ? await client.query(models.list_dashboard_contatos_por_negocios(), [
            empresaId,
            filteredDealIds,
            linkedMetaNumberIds.length ? linkedMetaNumberIds : null,
          ])
        : { rows: [] };
      const dashboardFirstResponseRet = filteredDealIds.length
        ? await client.query(models.list_dashboard_primeira_resposta_por_negocios(), [
            empresaId,
            filteredDealIds,
            linkedMetaNumberIds.length ? linkedMetaNumberIds : null,
          ])
        : { rows: [] };
      const interactionsByDealId = buildDealInteractionsIndex(
        dashboardInteractionsRet.rows || []
      );
      const contactCountsByDealId = buildDealContactCountsIndex(
        dashboardContactsRet.rows || []
      );
      const firstResponseByDealId = new Map(
        (dashboardFirstResponseRet.rows || []).map((row) => [
          Number(row?.negocio_id || 0),
          {
            conversationId:
              row?.conversa_id === null || row?.conversa_id === undefined
                ? null
                : Number(row.conversa_id || 0),
            queueStartedAt: parseDateOrNull(row?.queue_started_at),
            firstResponseAt: parseDateOrNull(row?.first_response_at),
            firstResponseSeconds:
              row?.first_response_seconds === null ||
              row?.first_response_seconds === undefined
                ? null
                : Number(row.first_response_seconds),
          },
        ])
      );
      const stageByCode = new Map(
        (domains.etapas || []).map((stage) => [String(stage?.codigo || ""), stage])
      );
      const isDealWon = (deal) => {
        if (deal?.isWonStage !== undefined && deal?.isWonStage !== null) {
          return Boolean(deal.isWonStage);
        }
        const stage = stageByCode.get(String(deal?.stage || ""));
        return stage ? Boolean(stage.eh_ganho) : String(deal?.stage || "") === "closed-won";
      };
      const isDealClosed = (deal) => {
        if (deal?.isClosingStage !== undefined && deal?.isClosingStage !== null) {
          return Boolean(deal.isClosingStage);
        }
        const stage = stageByCode.get(String(deal?.stage || ""));
        return stage ? Boolean(stage.eh_fechamento) : ["closed-won", "closed-lost"].includes(String(deal?.stage || ""));
      };
      const isDealLost = (deal) => isDealClosed(deal) && !isDealWon(deal);

      const activeDeals = allScopedDeals.filter((deal) => !isDealClosed(deal));
      const startDate = startOfDay(payload.data_inicio || payload.dateStart || payload.start);
      const endDate = endOfDay(payload.data_fim || payload.dateEnd || payload.end);
      const rangeStart = startDate instanceof Date && !Number.isNaN(startDate.getTime()) ? startDate : null;
      const rangeEnd = endDate instanceof Date && !Number.isNaN(endDate.getTime()) ? endDate : null;
      const externalSales = await loadExternalDashboardSales(
        client,
        payload,
        empresaId,
        rangeStart,
        rangeEnd
      );
      const closedDealsInRange = Array.isArray(closedDealsResult)
        ? closedDealsResult
        : Array.isArray(closedDealsResult?.items)
        ? closedDealsResult.items
        : [];
      const wonDeals = closedDealsInRange.filter(isDealWon);
      const lostDeals = closedDealsInRange.filter(isDealLost);
      const previousActiveDeals = activeDeals.filter((deal) => {
        const receivedAt = getDealReferenceDate(deal);
        return rangeStart ? receivedAt instanceof Date && receivedAt < rangeStart : true;
      });
      const velocityMetrics = buildDashboardVelocityMetrics(
        deals,
        firstResponseByDealId
      );
      const contactMetrics = buildDashboardContactBuckets(
        deals,
        contactCountsByDealId
      );
      const pendingFollowUpDealIds = new Set();
      const now = new Date();
      const agingReferenceDate =
        rangeEnd instanceof Date && !Number.isNaN(rangeEnd.getTime())
          ? rangeEnd
          : now;

      for (const deal of deals) {
        const dealId = Number(deal?.id || 0);
        const appointments = interactionsByDealId.get(dealId)?.appointments || [];
        const hasPendingFollowUp = appointments.some((appointment) => {
          if (!(appointment.startDate instanceof Date)) return false;
          return appointment.startDate >= now;
        });
        if (hasPendingFollowUp) {
          pendingFollowUpDealIds.add(dealId);
        }
      }

      const lossRadar = buildLossRadar(closedDealsInRange);
      const customerDocumentsMetric = await buildCustomerDocumentsMetric(
        client,
        empresaId,
        deals,
        payload
      );

      const totalPipelineValue = activeDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const crmWonValue = wonDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const externalSalesValue = externalSales.reduce(
        (sum, sale) => sum + Number(sale.value || 0),
        0
      );
      const totalSalesCount = wonDeals.length + externalSales.length;
      const totalWonValue = crmWonValue + externalSalesValue;
      const lostAmount = lostDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const totalClosed = wonDeals.length + lostDeals.length;
      const averageTicket = totalSalesCount ? totalWonValue / totalSalesCount : 0;
      const winRate = totalClosed ? Math.round((wonDeals.length / totalClosed) * 100) : 0;

      const byMonth = new Map();
      wonDeals.forEach((deal) => {
        const date = deal.saleDate || deal.closingDate || deal.createdAt;
        if (!date) return;
        const ref = new Date(date);
        const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
        const label = ref.toLocaleDateString("pt-BR", { month: "short" });
        const current = byMonth.get(key) || { month: label, value: 0 };
        current.value += Number(deal.amount || 0);
        byMonth.set(key, current);
      });
      externalSales.forEach((sale) => {
        if (!sale.sold_at) return;
        const ref = new Date(sale.sold_at);
        if (Number.isNaN(ref.getTime())) return;
        const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
        const label = ref.toLocaleDateString("pt-BR", { month: "short" });
        const current = byMonth.get(key) || { month: label, value: 0 };
        current.value += Number(sale.value || 0);
        byMonth.set(key, current);
      });

      const externalBySource = ["hotmart", "hubla"].map((source) => {
        const sourceSales = externalSales.filter((sale) => sale.source === source);
        return {
          source,
          salesCount: sourceSales.length,
          revenue: sourceSales.reduce((sum, sale) => sum + Number(sale.value || 0), 0),
        };
      });

      const orderedStages = [...(domains.etapas || [])].sort(
        (left, right) => Number(left?.ordem || 0) - Number(right?.ordem || 0)
      );
      const dealsByStage = orderedStages.map((stage) => {
        const stageDeals = allScopedDeals.filter(
          (deal) => String(deal.stage || "") === String(stage.codigo || "")
        );
        return {
          stage: stage.codigo,
          stageName: stage.nome,
          color: stage.cor || null,
          count: stageDeals.length,
          value: stageDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0),
        };
      });

      const leadsOriginBreakdown = buildOriginBreakdown(deals);
      const inProgressOriginBreakdown = buildOriginBreakdown(previousActiveDeals);
      const leadsInProgressCount = previousActiveDeals.length;
      const totalActiveScopedDeals = activeDeals.length;
      const funnel = buildDynamicDashboardFunnel(deals, domains.etapas || []);
      const sellerPerformance = buildSellerPerformance({
        dealsNew: deals,
        dealsInProgress: previousActiveDeals,
        salesDeals: closedDealsInRange,
        contactCountsByDealId,
        responsaveis: domains.responsaveis || [],
        isDealWon,
        isDealLost,
      });
      const sellerPerformanceById = new Map(
        sellerPerformance.map((seller) => [Number(seller.sellerId), seller])
      );
      const responsibleById = new Map(
        (domains.responsaveis || []).map((seller) => [Number(seller?.id || 0), seller])
      );
      externalSales.forEach((sale) => {
        const sellerId = Number(sale?.seller_id || 0);
        let seller = sellerPerformanceById.get(sellerId);
        if (!seller) {
          const responsible = sellerId ? responsibleById.get(sellerId) : null;
          seller = {
            sellerId,
            sellerName: responsible?.nome || (sellerId ? `Usuario ${sellerId}` : "Sem vendedor"),
            leadsNew: 0,
            leadsInProgress: 0,
            contactsMade: 0,
            averageContactsPerLead: 0,
            conversionRate: 0,
            salesCount: 0,
            lostSalesCount: 0,
            revenue: 0,
          };
          sellerPerformance.push(seller);
          sellerPerformanceById.set(sellerId, seller);
        }
        seller.salesCount += 1;
        seller.revenue += Number(sale.value || 0);
      });
      sellerPerformance.sort((left, right) =>
        Number(right.revenue || 0) - Number(left.revenue || 0) ||
        String(left.sellerName || "").localeCompare(String(right.sellerName || ""), "pt-BR")
      );
      const seriesByPeriod = buildPeriodSeries(deals, rangeStart, rangeEnd);
      const leadsWithoutResponse = velocityMetrics.leadsWithoutResponse;
      const unattendedLeadsPercent = calculatePercent(leadsWithoutResponse, deals.length);

      const dashboardResult = {
        updatedAt: new Date().toISOString(),
        crm_id: domains.crm_id,
        overview: {
          leadsReceived: deals.length,
          firstResponseAverageSeconds: velocityMetrics.averageFirstResponseSeconds,
          contactedLeads: velocityMetrics.contactedLeads,
          totalContacts: contactMetrics.totalContacts,
          contactsPerLead: contactMetrics.averageContactsPerLead,
          pendingFollowUps: pendingFollowUpDealIds.size,
          pendingFollowUpsPercent: calculatePercent(
            pendingFollowUpDealIds.size,
            deals.length
          ),
          salesCount: totalSalesCount,
          revenue: totalWonValue,
        },
        salesBySource: [
          { source: "crm", salesCount: wonDeals.length, revenue: crmWonValue },
          ...externalBySource,
        ],
        leadsNew: {
          total: deals.length,
          percentOfTotal: deals.length ? 100 : 0,
          byDay: seriesByPeriod,
          byOrigin: leadsOriginBreakdown,
        },
        leadsInProgress: {
          total: leadsInProgressCount,
          percentOfActive: calculatePercent(
            leadsInProgressCount,
            totalActiveScopedDeals
          ),
          byOrigin: inProgressOriginBreakdown,
          agingBuckets: buildAgingBuckets(previousActiveDeals, agingReferenceDate),
        },
        serviceVelocity: {
          totalLeads: deals.length,
          contactedLeads: velocityMetrics.contactedLeads,
          leadsWithoutResponse,
          respondedWithin5Min: velocityMetrics.respondedWithin5Min,
          respondedWithin15Min:
            velocityMetrics.respondedWithin5Min +
            velocityMetrics.respondedWithin15Min,
          respondedAfter15Min: velocityMetrics.respondedAfter15Min,
          averageFirstResponseSeconds:
            velocityMetrics.averageFirstResponseSeconds,
          responseRate: calculatePercent(
            velocityMetrics.contactedLeads,
            deals.length
          ),
          leadsWithoutResponsePercent: unattendedLeadsPercent,
        },
        contactCadence: {
          totalContacts: contactMetrics.totalContacts,
          averageContactsPerLead: contactMetrics.averageContactsPerLead,
          leadsWithoutContact: contactMetrics.leadsWithoutContact,
          leadsWithoutContactPercent:
            contactMetrics.leadsWithoutContactPercent,
          buckets: contactMetrics.buckets,
        },
        funnel,
        sellerPerformance,
        leadOrigins: {
          total: deals.length,
          items: leadsOriginBreakdown,
        },
        leadArrivalPatterns: {
          weekdays: buildLeadWeekdayDistribution(deals),
          hours: buildLeadHourDistribution(deals),
        },
        unattendedLeads: {
          total: leadsWithoutResponse,
          percent: unattendedLeadsPercent,
          totalLeads: deals.length,
        },
        totalQuotesInPipeline: totalPipelineValue,
        activeQuotesCount: activeDeals.length,
        wonQuotesValue: crmWonValue,
        quoteConversionRate: winRate,
        averageWonQuote: averageTicket,
        lostQuotesValue: lostAmount,
        monthlyWonQuotesRevenue: Array.from(byMonth.values()),
        quotesByStage: dealsByStage,
        lossRadar,
        totalPipelineValue,
        activeDealsCount: activeDeals.length,
        winRate,
        averageTicket,
        lostAmount,
        monthlyRevenue: Array.from(byMonth.values()),
        dealsByStage,
        customerDocumentsCount: customerDocumentsMetric.totalDocuments,
        documentsByAttendant: customerDocumentsMetric.documentsByAttendant,
      };

      setCachedCrmDashboard(cacheKey, dashboardResult);
      return dashboardResult;
      } finally {
        client.release();
      }
    })();

    crmDashboardInflightByKey.set(cacheKey, dashboardPromise);

    try {
      return await dashboardPromise;
    } finally {
      if (crmDashboardInflightByKey.get(cacheKey) === dashboardPromise) {
        crmDashboardInflightByKey.delete(cacheKey);
      }
    }
  },

  execute_relatorio_crm: async (payload) => {
    const client = await postgres.connect();
    try {
      const closedDealsResult = await execute.execute_listar_negocios_fechados(
        {
          ...payload,
          pagina: 1,
          limite: 100000,
          allowLargeLimit: true,
        },
        client
      );
      const domains = await execute.execute_obter_dominios_crm(payload, null, client);
      const deals = Array.isArray(closedDealsResult)
        ? closedDealsResult
        : Array.isArray(closedDealsResult?.items)
        ? closedDealsResult.items
        : [];
      const stageByCode = new Map(
        (domains.etapas || []).map((stage) => [String(stage?.codigo || ""), stage])
      );
      const isDealWon = (deal) => {
        if (deal?.isWonStage !== undefined && deal?.isWonStage !== null) {
          return Boolean(deal.isWonStage);
        }
        const stage = stageByCode.get(String(deal?.stage || ""));
        return stage ? Boolean(stage.eh_ganho) : String(deal?.stage || "") === "closed-won";
      };
      const closedWon = deals.filter(isDealWon);
      const lossRadar = buildLossRadar(deals);
      const customerDocumentsMetric = await buildCustomerDocumentsMetric(
        client,
        toNumber(payload.empresa_id),
        deals,
        payload
      );
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const { usuarioId, isMaster } = getRequesterContext(payload);
      const hasManagerScope = await hasCommercialManagerAccessInDb(
        client,
        payload,
        empresaId,
        usuarioId
      );
      const requestedOwnerId = toNumber(
        payload.responsavel_usuario_id || payload.ownerId || payload.sellerId
      );
      const quoteOwnerId = isMaster || hasManagerScope ? requestedOwnerId : usuarioId;
      const withoutFilial = toBoolean(
        payload.sem_filial ?? payload.withoutFilial ?? payload.withoutBranch
      );
      const filialId = withoutFilial
        ? null
        : toNumber(payload.filial_id ?? payload.filialId ?? payload.branchId ?? payload.branch_id);
      const generatedQuotesResult = await client.query(models.count_generated_quotes_report(), [
        empresaId,
        toNumber(domains.crm_id || payload.crm_id || payload.crmId),
        quoteOwnerId,
        startOfDay(payload.data_inicio || payload.dateStart || payload.start),
        endOfDay(payload.data_fim || payload.dateEnd || payload.end),
        filialId,
        withoutFilial,
      ]);
      const generatedQuotesCount = Number(
        generatedQuotesResult.rows[0]?.total_orcamentos_gerados || 0
      );
      const totalSales = closedWon.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const avgTicket = closedWon.length ? totalSales / closedWon.length : 0;
      const activeSellers = new Set(deals.map((d) => d.ownerId).filter(Boolean)).size;

      const sellersMap = new Map();
      closedWon.forEach((deal) => {
        const key = deal.ownerName || deal.ownerId || "Sem responsável";
        sellersMap.set(key, (sellersMap.get(key) || 0) + Number(deal.amount || 0));
      });

      const productsMap = new Map();
      closedWon.forEach((deal) => {
        ((deal.quote && Array.isArray(deal.quote.items) ? deal.quote.items : deal.products) || []).forEach((item) => {
          const current = productsMap.get(item.name) || { quantity: 0, value: 0 };
          const soldQuantity =
            item.soldQuantity === null || item.soldQuantity === undefined
              ? Number(item.quantity || 0)
              : Number(item.soldQuantity || 0);
          current.quantity += soldQuantity;
          current.value += soldQuantity * Number(item.price || 0);
          productsMap.set(item.name, current);
        });
      });

      const topQuotedProducts = Array.from(productsMap.entries())
        .map(([name, metrics]) => ({
          name,
          quantity: metrics.quantity,
          value: metrics.value,
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      return {
        metrics: {
          totalQuoteSales: totalSales,
          quoteCount: closedWon.length,
          generatedQuotesCount,
          avgQuoteTicket: avgTicket,
          totalSales,
          count: closedWon.length,
          avgTicket,
          activeSellers,
          totalLostRevenue: lossRadar.totalLostRevenue,
          fullLostRevenue: lossRadar.fullLostRevenue,
          partialLostRevenue: lossRadar.partialLostRevenue,
          lostQuotesCount: lossRadar.lostDealsCount,
          partialLossDealsCount: lossRadar.partialLossDealsCount,
          customerDocumentsCount: customerDocumentsMetric.totalDocuments,
        },
        topSellers: Array.from(sellersMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10),
        topQuotedProducts,
        topProducts: topQuotedProducts,
        lossRadar,
        documentsByAttendant: customerDocumentsMetric.documentsByAttendant,
        total: Number(closedDealsResult?.total || deals.length || 0),
        pagina: Number(closedDealsResult?.pagina || payload.pagina || payload.page || 1),
        limite: Number(closedDealsResult?.limite || payload.limite || payload.limit || deals.length || 0),
        total_paginas: Number(closedDealsResult?.total_paginas || 1),
        quotes: deals,
        deals,
      };
    } finally {
      client.release();
    }
  },

  execute_relatorio_conversas_empresa: async (payload) => {
    const client = await postgres.connect();
    try {
      const empresaId = toNumber(payload.empresa_id || payload.empresaId);
      const attendantId = toNumber(
        payload.attendantId ||
          payload.atendente_id ||
          payload.usuario_atendente_id ||
          payload.ownerId
      );
      const dateStart =
        formatDateOnly(startOfDay(payload.dateStart || payload.data_inicio || payload.start)) ||
        null;
      const dateEnd =
        formatDateOnly(endOfDay(payload.dateEnd || payload.data_fim || payload.end)) || null;

      if (!empresaId) {
        throw new Error("Informe a empresa para exportar as conversas.");
      }

      const ret = await client.query(models.list_company_conversations_report(), [
        empresaId,
        attendantId,
        dateStart,
        dateEnd,
      ]);

      return (ret.rows || []).map((row) => {
        const lastSenderCode =
          row?.ultima_mensagem_send_by === null || row?.ultima_mensagem_send_by === undefined
            ? null
            : Number(row.ultima_mensagem_send_by || 0);

        return {
          id: Number(row?.id || 0),
          clienteId:
            row?.cliente_id === null || row?.cliente_id === undefined
              ? null
              : Number(row.cliente_id || 0),
          clienteNome: row?.cliente_nome ? String(row.cliente_nome) : "",
          clienteTelefone: row?.cliente_telefone ? String(row.cliente_telefone) : "",
          origemCliente: row?.origem_cliente ? String(row.origem_cliente) : "whatsapp",
          utms: row?.utms ?? null,
          status: row?.status ? String(row.status) : "finished",
          statusId:
            row?.status_id === null || row?.status_id === undefined
              ? null
              : Number(row.status_id || 0),
          dataInicio: toIsoOrNull(row?.data_inicio),
          filaDesde: toIsoOrNull(row?.fila_desde),
          dataFim: toIsoOrNull(row?.data_fim),
          ultimaAtualizacao: toIsoOrNull(row?.ultima_atualizacao),
          ultimaMensagemClienteEm: toIsoOrNull(row?.ultima_mensagem_cliente_em),
          janelaMetaExpiraEm: toIsoOrNull(row?.janela_meta_expira_em),
          janelaMetaAberta: Boolean(row?.janela_meta_aberta),
          filaMais24h: Boolean(row?.fila_mais_24h),
          atendenteNome: row?.nome_atendente ? String(row.nome_atendente) : null,
          usuarioAtribuidoNome: row?.nome_usuario_atribuido
            ? String(row.nome_usuario_atribuido)
            : null,
          metaNumeroConta: row?.meta_numero_conta ? String(row.meta_numero_conta) : "",
          metaNomeConta: row?.meta_nome_conta ? String(row.meta_nome_conta) : "",
          funilNome: row?.funil_nome ? String(row.funil_nome) : "Sem funil",
          aguardandoRespostaTemplate: Boolean(row?.aguardando_resposta_template),
          totalMensagens: Number(row?.total_mensagens || 0),
          totalMensagensCliente: Number(row?.total_mensagens_cliente || 0),
          totalMensagensUsuario: Number(row?.total_mensagens_usuario || 0),
          mensagens: normalizeConversationExportMessages(row?.mensagens),
          ultimaMensagem: row?.ultima_mensagem ? String(row.ultima_mensagem) : null,
          ultimaMensagemSendBy: lastSenderCode,
          ultimaMensagemAutor: getConversationLastSenderLabel(lastSenderCode),
        };
      });
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
