const models = require("../models/models_user");
const { postgres } = require("../server/connect");
const security = require("../security/cypher");
const crypto = require("crypto");
const developerWebhooks = require("./execute_developer_webhooks");
const {
  buildTemplateDispatchContext,
  getMetaParametrosOrFail,
  validateMetaIntegrationReady,
} = require("../functions/function_meta");
const { isRuntimeSchemaEnsureEnabled } = require("../utils/runtime_schema");

const BIRTHDAY_TEMPLATE_MIN_PLAN_ID = 1;
const NPS_REPORT_PERMISSION = "reports.nps.view";
const RUNTIME_SCHEMA_ENSURE_CLIENTE_DOCUMENTO = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SCHEMA_ENSURE_CLIENTE_DOCUMENTO"
);

function normalizeDashboardDateFilter(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function buildDashboardDateFilterParams(filters = {}) {
  let dateStart = normalizeDashboardDateFilter(
    filters?.dateStart || filters?.date_start || filters?.inicio
  );
  let dateEnd = normalizeDashboardDateFilter(
    filters?.dateEnd || filters?.date_end || filters?.fim
  );

  if (dateStart && dateEnd && dateStart > dateEnd) {
    [dateStart, dateEnd] = [dateEnd, dateStart];
  }

  return [dateStart, dateEnd];
}

function normalizeDashboardFilialFilter(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function buildDashboardFilterParams(filters = {}) {
  const [dateStart, dateEnd] = buildDashboardDateFilterParams(filters);
  const filialId = normalizeDashboardFilialFilter(
    filters?.filial_id ??
      filters?.filialId ??
      filters?.branchId ??
      filters?.branch_id
  );

  return [dateStart, dateEnd, filialId];
}

function isMissingClienteDocumentoDashboardError(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return (
    ["42P01", "42703"].includes(code) &&
    message.includes("cliente_documento")
  );
}

async function ensureClienteDocumentoDashboardSchema(client) {
  if (!RUNTIME_SCHEMA_ENSURE_CLIENTE_DOCUMENTO) {
    return;
  }

  await client.query(`
    create table if not exists public.cliente_documento (
      id bigserial primary key,
      empresa_id bigint not null,
      cliente_id bigint not null,
      usuario_id bigint,
      nome_arquivo character varying(255) not null,
      url text not null,
      path_bunny text,
      mime_type character varying(120),
      tamanho_bytes bigint,
      origem character varying(80) not null default 'contato',
      ativo boolean not null default true,
      data_criacao timestamp without time zone not null default (current_timestamp - interval '3 hours')
    )
  `);

  await client.query(`
    alter table public.cliente_documento
    add column if not exists usuario_id bigint
  `);

  await client.query(`
    create index if not exists idx_cliente_documento_empresa_usuario_ativo
      on public.cliente_documento (empresa_id, usuario_id, ativo, data_criacao desc, id desc)
  `);
}

function normalizeNullableDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeNullableText(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeAttendanceColor(value) {
  const normalized = normalizeNullableText(value);
  if (!normalized) return null;
  if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error("A cor do atendente deve estar no formato hexadecimal (#RRGGBB).");
  }
  return normalized.toUpperCase();
}

function normalizeNullableCurrency(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized =
    typeof value === "string" ? value.replace(/\s/g, "").replace(",", ".") : value;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? Number(numericValue.toFixed(2)) : null;
}

function normalizeNullablePositiveInt(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function resolveAutoMessageToggleValue(configRow, tipo_id) {
  switch (Number(tipo_id)) {
    case 1:
      return Boolean(configRow?.whatsapp_auto_message_boas_vindas_ativa ?? true);
    case 2:
      return Boolean(configRow?.whatsapp_auto_message_final_atendimento_ativa ?? true);
    case 3:
      return Boolean(configRow?.whatsapp_auto_message_nps_ativa ?? true);
    case 4:
      return Boolean(configRow?.whatsapp_auto_message_aniversario_ativa ?? true);
    case 5:
      return Boolean(configRow?.whatsapp_auto_message_inicio_atendimento_ativa ?? true);
    case 6:
      return Boolean(
        configRow?.whatsapp_auto_message_followup_venda_realizada_ativa ?? true
      );
    case 7:
      return Boolean(
        configRow?.whatsapp_auto_message_followup_venda_recusada_ativa ?? true
      );
    case 8:
      return Boolean(configRow?.whatsapp_auto_message_sem_resposta_6h_ativa ?? false);
    default:
      return true;
  }
}

async function resolveAutoMessageGalleryImageId(client, empresa_id, galeria_imagem_id) {
  const normalizedImageId = normalizeNullablePositiveInt(galeria_imagem_id);
  if (!normalizedImageId) return null;

  const ret = await client.query(models.get_galeria_imagem_by_id_empresa(), [
    normalizedImageId,
    empresa_id,
  ]);

  if (!ret.rows?.length) {
    throw new Error("Imagem complementar nao encontrada na galeria da empresa.");
  }

  return normalizedImageId;
}

async function enrichAutoMessageRow(client, row) {
  if (!row) return row;

  const normalizedImageId = normalizeNullablePositiveInt(row.galeria_imagem_id);
  if (!normalizedImageId) {
    return {
      ...row,
      galeria_imagem_id: null,
      galeria_imagem_url: null,
      galeria_imagem_nome_arquivo: null,
      galeria_imagem_origem: null,
      galeria_imagem_mime_type: null,
    };
  }

  const ret = await client.query(models.get_galeria_imagem_by_id_empresa(), [
    normalizedImageId,
    row.empresa_id,
  ]);
  const imagem = ret.rows?.[0] || null;

  return {
    ...row,
    galeria_imagem_id: normalizedImageId,
    galeria_imagem_url: imagem?.url || null,
    galeria_imagem_nome_arquivo: imagem?.nome_arquivo || null,
    galeria_imagem_origem: imagem?.origem || null,
    galeria_imagem_mime_type: imagem?.mime_type || null,
  };
}

async function getAutoMessageToggleConfig(client, empresa_id, meta_param_id) {
  const scopedMetaParamId = await resolveAutoMessageMetaParamId(
    client,
    empresa_id,
    meta_param_id
  );

  if (!scopedMetaParamId) {
    throw new Error(
      "Selecione um numero da Meta valido para configurar o toggle da mensagem automatica."
    );
  }

  const ret = await client.query(
    models.get_empresa_meta_numero_auto_message_toggles(),
    [scopedMetaParamId, empresa_id]
  );

  if (!ret.rows?.length) {
    throw new Error("Numero da Meta selecionado nao encontrado para esta empresa.");
  }

  return ret.rows[0];
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

function buildImportPhoneLookupCandidates(value) {
  const normalized = normalizeImportPhone(value);
  if (!normalized) return [];

  const candidates = new Set([normalized]);

  // Meta pode enviar o numero BR sem o nono digito; aceitamos as duas variacoes
  // para evitar duplicidade na importacao.
  if (/^55\d{2}9\d{8}$/.test(normalized)) {
    candidates.add(`${normalized.slice(0, 4)}${normalized.slice(5)}`);
  } else if (/^55\d{10}$/.test(normalized)) {
    candidates.add(`${normalized.slice(0, 4)}9${normalized.slice(4)}`);
  }

  return [...candidates];
}

const CLIENTE_ORIGENS_PERMITIDAS = new Set([
  "manual",
  "whatsapp",
  "meta_ads",
  "importacao",
  "comercial",
]);

function normalizeClienteOrigem(value, fallback = "manual") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (CLIENTE_ORIGENS_PERMITIDAS.has(normalized)) {
    return normalized;
  }

  return fallback;
}

function normalizeEmail(value) {
  const normalized = normalizeNullableText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function createPublicError(message) {
  const error = new Error(message);
  error.publicMessage = message;
  return error;
}

function normalizeImportTags(tags = []) {
  if (!Array.isArray(tags)) return [];

  return [...new Set(
    tags
      .map((tag) => {
        if (typeof tag === "string") return tag.trim();
        if (tag && typeof tag === "object") {
          return String(tag.nome || tag.name || "").trim();
        }
        return "";
      })
      .filter(Boolean)
  )];
}

function normalizeImportUtms(utms = []) {
  if (!Array.isArray(utms)) return [];

  const nowIso = new Date().toISOString();
  return utms
    .map((utm) => {
      if (utm && typeof utm === "object" && !Array.isArray(utm)) {
        return {
          ...utm,
          data_recebimento: utm.data_recebimento || nowIso,
        };
      }

      const value = String(utm || "").trim();
      if (!value) return null;

      return {
        valor: value,
        data_recebimento: nowIso,
      };
    })
    .filter(Boolean);
}

async function ensureTagForImport(client, nome, empresa_id) {
  const normalized = normalizeNullableText(nome);
  if (!normalized) return null;

  const createRet = await client.query(models.create_tag(), [normalized, empresa_id]);
  if (createRet.rows?.[0]) {
    return createRet.rows[0];
  }

  const existingRet = await client.query(models.get_tag_by_nome(), [normalized, empresa_id]);
  return existingRet.rows?.[0] || null;
}

async function ensureUsuarioEmailDisponivel(client, email, usuarioId = null) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Informe um email valido para o usuario.");
  }

  const existingRet = await client.query(models.get_usuario_by_email(), [
    normalizedEmail,
    usuarioId,
  ]);

  if (existingRet.rows?.length) {
    throw new Error("Ja existe um usuario cadastrado com este email.");
  }

  return normalizedEmail;
}

const PASSWORD_SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9]/;
const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
const PASSWORD_LOWERCASE_REGEX = /[a-z]/;
const PASSWORD_NUMBER_REGEX = /\d/;

function validatePasswordPolicy(password) {
  const normalizedPassword = String(password || "");

  if (normalizedPassword.length < 8) {
    throw new Error("A senha deve atender a regra: Pelo menos 8 caracteres.");
  }

  if (!PASSWORD_SPECIAL_CHARACTER_REGEX.test(normalizedPassword)) {
    throw new Error("A senha deve atender a regra: Pelo menos 1 caractere especial.");
  }

  if (!PASSWORD_UPPERCASE_REGEX.test(normalizedPassword)) {
    throw new Error("A senha deve atender a regra: Pelo menos 1 letra maiuscula.");
  }

  if (!PASSWORD_LOWERCASE_REGEX.test(normalizedPassword)) {
    throw new Error("A senha deve atender a regra: Pelo menos 1 letra minuscula.");
  }

  if (!PASSWORD_NUMBER_REGEX.test(normalizedPassword)) {
    throw new Error("A senha deve atender a regra: Pelo menos 1 numero.");
  }

  return normalizedPassword;
}

async function getUsuarioAuthPayload(client, usuarioId, empresaId) {
  const ret = await client.query(models.get_login_payload_by_usuario_id(), [
    usuarioId,
    empresaId,
  ]);

  const usuario = ret.rows?.[0] || null;
  if (!usuario) {
    throw new Error("Usuario nao encontrado para esta empresa.");
  }

  const permissoesPlano = Array.isArray(usuario.permissoes_plano)
    ? usuario.permissoes_plano
    : [];
  const permissoesUsuario = Array.isArray(usuario.permissoes_customizadas)
    ? usuario.permissoes_customizadas
    : [];

  usuario.permissions = usuario.is_master
    ? [...permissoesPlano]
    : permissoesUsuario.filter((permission) => permissoesPlano.includes(permission));

  if (
    permissoesUsuario.includes(NPS_REPORT_PERMISSION) &&
    !usuario.permissions.includes(NPS_REPORT_PERMISSION)
  ) {
    usuario.permissions.push(NPS_REPORT_PERMISSION);
  }

  if (usuario.pdv) {
    if (!usuario.permissions.includes("sales.view")) {
      usuario.permissions.push("sales.view");
    }
    if (!usuario.permissions.includes("sales.create")) {
      usuario.permissions.push("sales.create");
    }
  }

  delete usuario.permissoes_plano;
  delete usuario.permissoes_customizadas;

  return usuario;
}

function canUseBirthdayTemplate(planRow) {
  return Number(planRow?.assinatura_id || 0) >= BIRTHDAY_TEMPLATE_MIN_PLAN_ID;
}

const TEMPLATE_AUTOMATION_CONFIG = {
  birthday: {
    tipoId: 4,
    title: "aniversario",
  },
  sale_completed: {
    tipoId: 6,
    title: "follow-up de venda realizada",
  },
  sale_refused: {
    tipoId: 7,
    title: "follow-up de venda recusada",
  },
};

function normalizeTemplateAutomationType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return TEMPLATE_AUTOMATION_CONFIG[normalized] ? normalized : null;
}

async function getPlanoEmpresaAtual(client, empresa_id) {
  const ret = await client.query(models.get_plano_empresa_atual(), [empresa_id]);
  return ret.rows[0] || null;
}

async function ensureTemplateAutomationAllowed(client, tipo_id, empresa_id) {
  if (![4, 6, 7].includes(Number(tipo_id))) return;
  const plano = await getPlanoEmpresaAtual(client, empresa_id);
  if (!canUseBirthdayTemplate(plano)) {
    throw new Error(
      "As automacoes por template do WhatsApp estao disponiveis apenas para planos Business ou superiores."
    );
  }
}

async function ensureBirthdayTemplateAllowed(client, tipo_id, empresa_id) {
  return ensureTemplateAutomationAllowed(client, tipo_id, empresa_id);
}

function normalizeBirthdayTemplateTime(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "09:00:00";
  }

  const match = normalized.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error("Informe um horario valido no formato HH:MM.");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || "00");

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    throw new Error("Informe um horario valido no formato HH:MM.");
  }

  return [
    String(hour).padStart(2, "0"),
    String(minute).padStart(2, "0"),
    String(second).padStart(2, "0"),
  ].join(":");
}

function normalizeTemplateAutomationDelayDays(value, fallback = 3) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(numericValue));
}

function normalizeTemplateParameterArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (item === null || item === undefined) return null;
      if (
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
      ) {
        return item;
      }
      if (typeof item === "object" && !Array.isArray(item)) {
        return item;
      }
      return null;
    })
    .filter((item) => item !== null);
}

function normalizeTemplateButtonParameterArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const index = Number(item?.index);
      if (!Number.isInteger(index) || index < 0) {
        return null;
      }

      return {
        index,
        parameters: normalizeTemplateParameterArray(item?.parameters),
      };
    })
    .filter((item) => item !== null);
}

function normalizeBirthdayHeaderMediaType(value) {
  const normalized = normalizeNullableText(value)?.toLowerCase();

  if (normalized === "image") return "image";
  if (normalized === "document") return "document";
  if (normalized === "video") return "video";
  return null;
}

function normalizeBirthdayHeaderMediaUrl(value) {
  return normalizeNullableText(value);
}

function appendBirthdayTemplateHeaderMediaConfig(config = {}) {
  const headerMediaType = normalizeBirthdayHeaderMediaType(
    config?.header_media_type
  );
  const headerMediaUrl = normalizeBirthdayHeaderMediaUrl(
    config?.header_media_url
  );

  const normalizedConfig = {
    ...config,
    header_media_type: headerMediaType && headerMediaUrl ? headerMediaType : null,
    header_media_url: headerMediaType && headerMediaUrl ? headerMediaUrl : null,
  };

  if (!headerMediaType || !headerMediaUrl) {
    return normalizedConfig;
  }

  if (headerMediaType === "image") {
    normalizedConfig.header_image = { link: headerMediaUrl };
  }

  if (headerMediaType === "document") {
    normalizedConfig.header_document = { link: headerMediaUrl };
  }

  if (headerMediaType === "video") {
    normalizedConfig.header_video = { link: headerMediaUrl };
  }

  return normalizedConfig;
}

function normalizeBirthdayTemplateConfigRow(row) {
  if (!row) return null;

  return appendBirthdayTemplateHeaderMediaConfig({
    ...row,
    is_default_dispatch_number: Boolean(row.is_default_dispatch_number ?? false),
    default_dispatch_meta_param_id: normalizeOptionalPositiveInt(
      row.default_dispatch_meta_param_id
    ),
    default_dispatch_display_phone_number: normalizeNullableText(
      row.default_dispatch_display_phone_number
    ),
    template_name: normalizeNullableText(row.template_name),
    template_language:
      normalizeNullableText(row.template_language) || "pt_BR",
    horario: normalizeBirthdayTemplateTime(row.horario || "09:00:00"),
    delay_days: normalizeTemplateAutomationDelayDays(row.delay_days, 3),
    header_parameters: normalizeTemplateParameterArray(row.header_parameters),
    body_parameters: normalizeTemplateParameterArray(row.body_parameters),
    button_parameters: normalizeTemplateButtonParameterArray(row.button_parameters),
    habilitada: Boolean(row.habilitada ?? true),
  });
}

async function validateBirthdayTemplateDispatchConfiguration(
  client,
  {
    empresa_id,
    meta_param_id,
    template_name,
    template_language,
    header_media_type,
    header_media_url,
    header_parameters,
    body_parameters,
    button_parameters,
  },
  requestContext = { files: {} }
) {
  const normalizedTemplateName = normalizeNullableText(template_name);
  if (!normalizedTemplateName) {
    return null;
  }

  const parametros = await getMetaParametrosOrFail({
    empresa_id,
    meta_param_id,
  });
  const integrationError = validateMetaIntegrationReady(parametros);
  if (integrationError) {
    throw new Error(integrationError);
  }

  const payloadWithHeaderMedia = appendBirthdayTemplateHeaderMediaConfig({
    empresa_id,
    meta_param_id,
    template_name: normalizedTemplateName,
    template_language,
    header_media_type,
    header_media_url,
    header_parameters,
    body_parameters,
    button_parameters,
  });

  const dispatchContext = await buildTemplateDispatchContext(
    requestContext,
    {
      ...payloadWithHeaderMedia,
      language: normalizeNullableText(template_language) || "pt_BR",
    },
    parametros
  );

  if (!dispatchContext?.selectedTemplate) {
    throw new Error("O template selecionado nao foi encontrado na conta da Meta.");
  }

  if (!dispatchContext.validation?.valid) {
    throw new Error(
      dispatchContext.validation.errors?.[0] ||
        "A configuracao do template de aniversario esta invalida."
    );
  }

  return {
    parametros,
    dispatchContext,
  };
}

async function resolveAutoMessageMetaParamId(client, empresa_id, meta_param_id) {
  const normalizedMetaParamId = normalizeOptionalPositiveInt(meta_param_id);
  if (!normalizedMetaParamId) {
    return null;
  }

  const ret = await client.query(models.get_empresa_meta_numero_ativo_by_id(), [
    normalizedMetaParamId,
    empresa_id,
  ]);
  if (!ret.rows?.length) {
    throw new Error("Numero da Meta selecionado nao encontrado para esta empresa.");
  }

  return normalizedMetaParamId;
}

async function resolveListaTransmissaoMetaParamId(client, empresa_id, meta_param_id) {
  const normalizedMetaParamId = normalizeOptionalPositiveInt(meta_param_id);
  if (!normalizedMetaParamId) {
    throw createPublicError(
      "Selecione o numero da Meta vinculado a esta lista de transmissao."
    );
  }

  const ret = await client.query(models.get_empresa_meta_numero_ativo_by_id(), [
    normalizedMetaParamId,
    empresa_id,
  ]);
  if (!ret.rows?.length) {
    throw createPublicError(
      "Numero da Meta selecionado nao encontrado para esta empresa."
    );
  }

  return normalizedMetaParamId;
}

async function getUsuarioListaTransmissaoAccessContext(client, empresa_id, usuario_id) {
  const normalizedUsuarioId = normalizeOptionalPositiveInt(usuario_id);
  if (!normalizedUsuarioId) {
    throw createPublicError("Usuario nao informado para validar a lista de transmissao.");
  }

  const userContextRet = await client.query(models.get_usuario_empresa_contexto(), [
    normalizedUsuarioId,
    empresa_id,
  ]);
  const userContext = userContextRet.rows?.[0] || null;

  if (!userContext) {
    throw createPublicError("Usuario nao encontrado para esta empresa.");
  }

  if (Boolean(userContext.is_master)) {
    return {
      usuario_id: normalizedUsuarioId,
      userContext,
      isMaster: true,
      allowedMetaParamIds: [],
    };
  }

  const allowedRet = await client.query(models.list_usuario_meta_numero_ids(), [
    normalizedUsuarioId,
    empresa_id,
  ]);

  return {
    usuario_id: normalizedUsuarioId,
    userContext,
    isMaster: false,
    allowedMetaParamIds: normalizeAllowedMetaParamIds(
      (allowedRet.rows || []).map((row) => row?.empresa_meta_param_id)
    ),
  };
}

async function getUsuarioContatoAccessContext(client, empresa_id, usuario_id) {
  const normalizedUsuarioId = normalizeOptionalPositiveInt(usuario_id);
  if (!normalizedUsuarioId) {
    return {
      isMaster: false,
      canViewAllContacts: true,
    };
  }

  const userContextRet = await client.query(models.get_usuario_empresa_contexto(), [
    normalizedUsuarioId,
    empresa_id,
  ]);
  const userContext = userContextRet.rows?.[0] || null;

  if (!userContext) {
    throw createPublicError("Usuario nao encontrado para esta empresa.");
  }

  const permissions = Array.isArray(userContext.permissoes_customizadas)
    ? userContext.permissoes_customizadas
    : [];
  const isMaster = Boolean(userContext.is_master);
  const hasContactsAccess = permissions.includes("contacts.view");

  return {
    isMaster,
    canViewAllContacts:
      isMaster || (hasContactsAccess && permissions.includes("contacts.view_all")),
  };
}

function canAccessListaTransmissao(row, accessContext) {
  if (!row) return false;
  if (Boolean(accessContext?.isMaster)) return true;

  const metaParamId = normalizeOptionalPositiveInt(row.empresa_meta_param_id);
  if (!metaParamId) {
    return false;
  }

  return accessContext.allowedMetaParamIds.includes(metaParamId);
}

function ensureUsuarioPodeUsarNumeroMetaListaTransmissao(metaParamId, accessContext) {
  if (Boolean(accessContext?.isMaster)) {
    return;
  }

  if (!accessContext?.allowedMetaParamIds?.length) {
    throw createPublicError(
      "Este usuario nao possui numeros da Meta liberados para listas de transmissao."
    );
  }

  if (!accessContext.allowedMetaParamIds.includes(Number(metaParamId))) {
    throw createPublicError(
      "Voce nao possui acesso ao numero da Meta selecionado para esta lista de transmissao."
    );
  }
}

function normalizeListaTransmissaoRow(row) {
  if (!row) return row;

  return {
    ...row,
    empresa_meta_param_id: normalizeOptionalPositiveInt(row.empresa_meta_param_id),
    tags: Array.isArray(row.tags) ? row.tags : [],
    utm_filters:
      row.utm_filters && typeof row.utm_filters === "object" ? row.utm_filters : {},
  };
}

function filterListasTransmissaoByAccess(rows, accessContext, metaParamId = null) {
  const normalizedMetaParamId = normalizeOptionalPositiveInt(metaParamId);

  return (rows || []).filter((row) => {
    const rowMetaParamId = normalizeOptionalPositiveInt(row?.empresa_meta_param_id);

    if (normalizedMetaParamId) {
      return rowMetaParamId === normalizedMetaParamId;
    }

    if (Boolean(accessContext?.isMaster)) {
      return true;
    }

    return Boolean(
      rowMetaParamId && accessContext.allowedMetaParamIds.includes(rowMetaParamId)
    );
  });
}

async function ensureListaTransmissaoAccessible(client, {
  empresa_id,
  lista_id,
  accessContext,
}) {
  const listaRet = await client.query(models.get_lista_transmissao_by_id(), [
    lista_id,
    empresa_id,
  ]);
  const lista = listaRet.rows?.[0] || null;

  if (!lista) {
    throw createPublicError("Lista de transmissao nao encontrada.");
  }

  if (!canAccessListaTransmissao(lista, accessContext)) {
    throw createPublicError("Voce nao possui acesso a esta lista de transmissao.");
  }

  return normalizeListaTransmissaoRow(lista);
}

function normalizeBroadcastTagLogic(value) {
  return String(value || "").trim().toLowerCase() === "and" ? "and" : "or";
}

function normalizeBroadcastUtmFilters(filters = {}) {
  const source = filters && typeof filters === "object" ? filters : {};
  const allowedKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
  ];

  return allowedKeys.reduce((acc, key) => {
    const normalized = normalizeNullableText(source[key]);
    if (normalized) {
      acc[key] = normalized;
    }
    return acc;
  }, {});
}

function normalizeListaClientesFiltrosCompostos(filters = {}) {
  const source = filters && typeof filters === "object" ? filters : {};
  let dataEntradaInicial = normalizeNullableDate(source.data_entrada_inicial);
  let dataEntradaFinal = normalizeNullableDate(source.data_entrada_final);

  if (dataEntradaInicial && dataEntradaFinal && dataEntradaInicial > dataEntradaFinal) {
    [dataEntradaInicial, dataEntradaFinal] = [dataEntradaFinal, dataEntradaInicial];
  }

  return {
    utm: normalizeNullableText(source.utm) || "",
    origem: normalizeClienteOrigem(source.origem, ""),
    tag_ids: normalizeBroadcastTagIds(source.tag_ids),
    data_entrada_inicial: dataEntradaInicial,
    data_entrada_final: dataEntradaFinal,
  };
}

function normalizeBroadcastTagIds(tag_ids = []) {
  if (!Array.isArray(tag_ids)) return [];

  return [...new Set(
    tag_ids
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  )];
}

function normalizeAllowedMetaParamIds(metaParamIds = []) {
  if (!Array.isArray(metaParamIds)) return [];

  return [...new Set(
    metaParamIds
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  )];
}

function normalizeOptionalPositiveInt(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeCoordinate(value, fieldLabel) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldLabel} invalida.`);
  }

  return Number(numeric.toFixed(7));
}

function normalizeLatitude(value) {
  const latitude = normalizeCoordinate(value, "Latitude");
  if (latitude === null) return null;
  if (latitude < -90 || latitude > 90) {
    throw new Error("Latitude deve estar entre -90 e 90.");
  }
  return latitude;
}

function normalizeLongitude(value) {
  const longitude = normalizeCoordinate(value, "Longitude");
  if (longitude === null) return null;
  if (longitude < -180 || longitude > 180) {
    throw new Error("Longitude deve estar entre -180 e 180.");
  }
  return longitude;
}

function normalizeToleranceMeters(value) {
  if (value === undefined || value === null || value === "") {
    return 100;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error("Tolerancia deve ser um numero inteiro positivo em metros.");
  }

  return numeric;
}

async function ensureFilialPertenceEmpresa(client, filialId, empresaId) {
  const normalizedFilialId = normalizeOptionalPositiveInt(filialId);
  if (!normalizedFilialId) return null;

  const ret = await client.query(models.get_filial_by_id_empresa(), [
    normalizedFilialId,
    empresaId,
  ]);
  const filial = ret.rows?.[0] || null;

  if (!filial) {
    throw new Error("Filial selecionada nao pertence a empresa.");
  }

  return filial;
}

async function syncUsuarioMetaNumeros(client, usuarioId, empresaId, allowedMetaParamIds, isMaster = false) {
  await client.query(models.delete_usuario_meta_numeros(), [usuarioId]);

  if (isMaster) {
    return [];
  }

  const normalizedIds = normalizeAllowedMetaParamIds(allowedMetaParamIds);
  if (!normalizedIds.length) {
    return [];
  }

  const validRet = await client.query(
    models.list_empresa_meta_numeros_validos_by_ids(),
    [empresaId, normalizedIds]
  );

  const validIds = (validRet.rows || [])
    .map((row) => Number(row.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (validIds.length !== normalizedIds.length) {
    throw new Error("Um ou mais numeros selecionados nao pertencem a empresa ou estao inativos.");
  }

  for (const metaParamId of validIds) {
    await client.query(models.insert_usuario_meta_numero(), [usuarioId, metaParamId]);
  }

  return validIds;
}

function buildBroadcastSegmentClientQuery(empresa_id, tagIds = [], tagLogic = "or", utmFilters = {}) {
  const params = [empresa_id];
  const where = [
    "c.empresa_id = $1",
    "c.ativo = true",
  ];

  if (tagIds.length > 0) {
    params.push(tagIds);
    const tagArrayIndex = params.length;

    if (tagLogic === "and") {
      where.push(`(
        select count(distinct ct.tag_id)
        from cliente_tag ct
        where ct.cliente_id = c.id
          and ct.tag_id = any($${tagArrayIndex}::int[])
      ) = ${tagIds.length}`);
    } else {
      where.push(`exists (
        select 1
        from cliente_tag ct
        where ct.cliente_id = c.id
          and ct.tag_id = any($${tagArrayIndex}::int[])
      )`);
    }
  }

  const utmConditions = [];
  for (const [key, value] of Object.entries(utmFilters)) {
    if (!value) continue;
    params.push(value);
    utmConditions.push(
      `upper(coalesce(utm ->> '${key}', '')) = upper($${params.length}::text)`
    );
  }

  if (utmConditions.length > 0) {
    where.push(`exists (
      select 1
      from jsonb_array_elements(coalesce(c.utms, '[]'::jsonb)) utm
      where ${utmConditions.join(" and ")}
    )`);
  }

  return {
    query: `
      select c.id
      from cliente c
      where ${where.join("\n        and ")}
      order by c.id asc
    `,
    params,
  };
}

function getTemplateAutomationDefinition(automationType) {
  const normalizedType = normalizeTemplateAutomationType(automationType);
  if (!normalizedType) return null;

  return {
    key: normalizedType,
    ...TEMPLATE_AUTOMATION_CONFIG[normalizedType],
  };
}

async function getSalesFollowupTemplateConfigByType(
  client,
  { automation_type, empresa_id, meta_param_id }
) {
  const definition = getTemplateAutomationDefinition(automation_type);
  if (!definition || definition.key === "birthday") {
    throw new Error("Tipo de automacao invalido.");
  }

  await ensureTemplateAutomationAllowed(client, definition.tipoId, empresa_id);
  const scopedMetaParamId = await resolveAutoMessageMetaParamId(
    client,
    empresa_id,
    meta_param_id
  );

  if (!scopedMetaParamId) {
    throw new Error(
      `Selecione um numero da Meta valido para configurar a automacao de ${definition.title}.`
    );
  }

  const ret = await client.query(
    models.get_empresa_meta_numero_sales_followup_template_config(definition.key),
    [scopedMetaParamId, empresa_id]
  );

  const row = normalizeBirthdayTemplateConfigRow(ret.rows?.[0] || null);
  if (!row) {
    throw new Error("Numero da Meta selecionado nao encontrado para esta empresa.");
  }

  return row;
}

async function saveSalesFollowupTemplateConfigByType(
  client,
  {
    automation_type,
    empresa_id,
    meta_param_id,
    template_name,
    template_language,
    horario,
    delay_days,
    is_default_dispatch_number,
    header_media_type,
    header_media_url,
    header_parameters,
    body_parameters,
    button_parameters,
    requestContext,
  }
) {
  const definition = getTemplateAutomationDefinition(automation_type);
  if (!definition || definition.key === "birthday") {
    throw new Error("Tipo de automacao invalido.");
  }

  await ensureTemplateAutomationAllowed(client, definition.tipoId, empresa_id);
  const scopedMetaParamId = await resolveAutoMessageMetaParamId(
    client,
    empresa_id,
    meta_param_id
  );

  if (!scopedMetaParamId) {
    throw new Error(
      `Selecione um numero da Meta valido para configurar a automacao de ${definition.title}.`
    );
  }

  const normalizedTemplateName = normalizeNullableText(template_name);
  const normalizedTemplateLanguage =
    normalizeNullableText(template_language) || "pt_BR";
  const normalizedScheduleTime = normalizeBirthdayTemplateTime(horario);
  const normalizedDelayDays = normalizeTemplateAutomationDelayDays(
    delay_days,
    3
  );
  const normalizedDefaultDispatchNumber = Boolean(is_default_dispatch_number);
  const hasHeaderUpload = Boolean(
    requestContext?.files?.header_image_file?.[0] ||
      requestContext?.files?.header_document_file?.[0] ||
      requestContext?.files?.header_video_file?.[0] ||
      requestContext?.files?.header_file?.[0]
  );
  const rawHeaderMediaUrl = hasHeaderUpload
    ? null
    : normalizeBirthdayHeaderMediaUrl(header_media_url);
  const normalizedHeaderMediaType = rawHeaderMediaUrl
    ? normalizeBirthdayHeaderMediaType(header_media_type)
    : null;
  const normalizedHeaderMediaUrl = normalizedHeaderMediaType
    ? rawHeaderMediaUrl
    : null;
  const normalizedHeaderParameters =
    normalizeTemplateParameterArray(header_parameters);
  const normalizedBodyParameters =
    normalizeTemplateParameterArray(body_parameters);
  const normalizedButtonParameters =
    normalizeTemplateButtonParameterArray(button_parameters);

  if (normalizedTemplateName) {
    await validateBirthdayTemplateDispatchConfiguration(
      client,
      {
        empresa_id,
        meta_param_id: scopedMetaParamId,
        template_name: normalizedTemplateName,
        template_language: normalizedTemplateLanguage,
        header_media_type: normalizedHeaderMediaType,
        header_media_url: normalizedHeaderMediaUrl,
        header_parameters: normalizedHeaderParameters,
        body_parameters: normalizedBodyParameters,
        button_parameters: normalizedButtonParameters,
      },
      requestContext
    );
  }

  if (normalizedDefaultDispatchNumber) {
    await client.query(
      models.clear_empresa_sales_followup_template_default_dispatch(
        definition.key
      ),
      [empresa_id, scopedMetaParamId]
    );
  }

  const ret = await client.query(
    models.update_empresa_meta_numero_sales_followup_template_config(
      definition.key
    ),
    [
      scopedMetaParamId,
      empresa_id,
      normalizedTemplateName,
      normalizedTemplateLanguage,
      normalizedScheduleTime,
      normalizedDelayDays,
      normalizedHeaderMediaType,
      normalizedHeaderMediaUrl,
      normalizedDefaultDispatchNumber,
      JSON.stringify(normalizedHeaderParameters),
      JSON.stringify(normalizedBodyParameters),
      JSON.stringify(normalizedButtonParameters),
    ]
  );

  const row = normalizeBirthdayTemplateConfigRow(ret.rows?.[0] || null);
  if (!row) {
    throw new Error(
      `Nao foi possivel salvar a configuracao de ${definition.title}.`
    );
  }

  return row;
}

const execute = {
  // true se o usuario existe nesta empresa e e master.
  execute_get_usuario_is_master: async (usuario_id, empresa_id) => {
    const ret = await postgres.query(
      "SELECT is_master FROM usuario WHERE id = $1 AND empresa_id = $2",
      [Number(usuario_id) || 0, Number(empresa_id) || 0]
    );
    return Boolean(ret.rows[0]?.is_master);
  },

  execute_get_notas: async (cliente_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_notas(), [cliente_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dados_cliente: async (cliente_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_dados_cliente(), [cliente_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_clientes_tags: async (cliente_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_clientes_tags(), [cliente_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_lista_clientes: async ({
    pagina,
    empresa_id,
    usuario_id,
    limite,
    busca,
    filtro,
    filtros_compostos,
  }) => {
    const client = await postgres.connect();
    try {
      const { canViewAllContacts } = await getUsuarioContatoAccessContext(
        client,
        empresa_id,
        usuario_id
      );
      const filtrosCompostosNormalizados =
        normalizeListaClientesFiltrosCompostos(filtros_compostos);
      const ret = await client.query(models.get_lista_clientes(), [
        pagina,
        empresa_id,
        limite,
        busca,
        filtro,
        filtrosCompostosNormalizados.utm,
        filtrosCompostosNormalizados.origem,
        filtrosCompostosNormalizados.tag_ids,
        filtrosCompostosNormalizados.data_entrada_inicial,
        filtrosCompostosNormalizados.data_entrada_final,
        canViewAllContacts,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_count_lista_clientes: async ({
    empresa_id,
    usuario_id,
    busca,
    filtro,
    filtros_compostos,
  }) => {
    const client = await postgres.connect();
    try {
      const { canViewAllContacts } = await getUsuarioContatoAccessContext(
        client,
        empresa_id,
        usuario_id
      );
      const filtrosCompostosNormalizados =
        normalizeListaClientesFiltrosCompostos(filtros_compostos);
      const ret = await client.query(models.count_lista_clientes(), [
        empresa_id,
        busca,
        filtro,
        filtrosCompostosNormalizados.utm,
        filtrosCompostosNormalizados.origem,
        filtrosCompostosNormalizados.tag_ids,
        filtrosCompostosNormalizados.data_entrada_inicial,
        filtrosCompostosNormalizados.data_entrada_final,
        canViewAllContacts,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_alterar_cliente: async (
    nome,
    email,
    cpf,
    data_aniversario,
    cliente_id,
    origem,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    cep,
    empresa,
    cargo,
    faturamento
  ) => {
    const client = await postgres.connect();
    try {
      await client.query(models.alterar_cliente(), [
        normalizeNullableText(nome),
        normalizeNullableText(email),
        normalizeNullableText(cpf),
        normalizeNullableDate(data_aniversario),
        normalizeClienteOrigem(origem),
        normalizeNullableText(logradouro),
        normalizeNullableText(numero),
        normalizeNullableText(complemento),
        normalizeNullableText(bairro),
        normalizeNullableText(cidade),
        normalizeNullableText(uf)?.toUpperCase() || null,
        normalizeNullableText(cep),
        normalizeNullableText(empresa),
        normalizeNullableText(cargo),
        normalizeNullableCurrency(faturamento),
        cliente_id,
      ]);
    } finally {
      client.release();
    }
  },

  execute_criar_cliente: async (
    empresa_id,
    nome,
    email,
    telefone,
    cpf,
    data_aniversario,
    origem,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    cep,
    empresa,
    cargo,
    faturamento
  ) => {
    const client = await postgres.connect();
    try {
      const nomeNormalizado = normalizeNullableText(nome);
      const telefoneNormalizado = normalizeNullableText(telefone);
      const emailNormalizado = normalizeEmail(email);
      const cpfNormalizado = normalizeNullableText(cpf);
      const dataAniversarioNormalizada = normalizeNullableDate(data_aniversario);
      const origemNormalizada = normalizeClienteOrigem(origem);
      const logradouroNormalizado = normalizeNullableText(logradouro);
      const numeroNormalizado = normalizeNullableText(numero);
      const complementoNormalizado = normalizeNullableText(complemento);
      const bairroNormalizado = normalizeNullableText(bairro);
      const cidadeNormalizada = normalizeNullableText(cidade);
      const ufNormalizada = normalizeNullableText(uf)?.toUpperCase() || null;
      const cepNormalizado = normalizeNullableText(cep);
      const empresaNormalizada = normalizeNullableText(empresa);
      const cargoNormalizado = normalizeNullableText(cargo);
      const faturamentoNormalizado = normalizeNullableCurrency(faturamento);

      if (!empresa_id) {
        throw new Error("Empresa invalida para criar contato.");
      }

      if (!nomeNormalizado) {
        throw new Error("Nome obrigatorio para criar contato.");
      }

      if (!telefoneNormalizado) {
        throw new Error("Telefone obrigatorio para criar contato.");
      }

      const telefoneLookupCandidates = buildImportPhoneLookupCandidates(
        telefoneNormalizado
      );
      const duplicateRet = await client.query(
        models.get_cliente_by_email_or_phone_importacao(),
        [empresa_id, emailNormalizado, telefoneLookupCandidates]
      );
      const existingCustomer = duplicateRet.rows?.[0] || null;

      if (existingCustomer) {
        const telefoneAtualNormalizado = normalizeImportPhone(existingCustomer.telefone);
        const emailAtualNormalizado = normalizeEmail(existingCustomer.email);
        const matchedPhone =
          Boolean(telefoneAtualNormalizado) &&
          telefoneLookupCandidates.includes(telefoneAtualNormalizado);
        const matchedEmail =
          Boolean(emailNormalizado) && Boolean(emailAtualNormalizado) && emailNormalizado === emailAtualNormalizado;

        if (existingCustomer.ativo === true) {
          if (matchedPhone && matchedEmail) {
            throw createPublicError("Ja existe um contato cadastrado com este numero e e-mail.");
          }
          if (matchedPhone) {
            throw createPublicError("Ja existe um contato cadastrado com este numero.");
          }
          if (matchedEmail) {
            throw createPublicError("Ja existe um contato cadastrado com este e-mail.");
          }
        }

        const reactivatedRet = await client.query(models.reativar_cliente_criacao_manual(), [
          existingCustomer.id,
          nomeNormalizado,
          telefoneNormalizado,
          emailNormalizado,
          cpfNormalizado,
          dataAniversarioNormalizada,
          origemNormalizada,
          logradouroNormalizado,
          numeroNormalizado,
          complementoNormalizado,
          bairroNormalizado,
          cidadeNormalizada,
          ufNormalizada,
          cepNormalizado,
          empresaNormalizada,
          cargoNormalizado,
          faturamentoNormalizado,
        ]);

        return reactivatedRet.rows?.[0] || null;
      }

      const ret = await client.query(models.criar_cliente(), [
        nomeNormalizado,
        telefoneNormalizado,
        emailNormalizado,
        cpfNormalizado,
        empresa_id,
        dataAniversarioNormalizada,
        origemNormalizada,
        logradouroNormalizado,
        numeroNormalizado,
        complementoNormalizado,
        bairroNormalizado,
        cidadeNormalizada,
        ufNormalizada,
        cepNormalizado,
        empresaNormalizada,
        cargoNormalizado,
        faturamentoNormalizado,
      ]);

      if (ret.rows?.[0]?.id) {
        developerWebhooks.queueCustomerCreated(ret.rows[0].id);
      }
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_remover_cliente: async (cliente_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.remover_cliente(), [cliente_id]);
    } finally {
      client.release();
    }
  },

  execute_importar_clientes: async (rows, empresa_id) => {
    const client = await postgres.connect();
    try {
      if (!empresa_id) {
        throw new Error("Empresa invalida para importacao.");
      }

      const resultado = {
        total: Array.isArray(rows) ? rows.length : 0,
        criados: 0,
        atualizados: 0,
        tags_adicionadas: 0,
        ignorados: 0,
        erros: [],
      };

      if (!Array.isArray(rows) || !rows.length) {
        return resultado;
      }

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index] || {};
        const linha = Number(row.linha || index + 2);
        let createdCustomerId = null;

        try {
          await client.query("BEGIN");

          const nome =
            normalizeNullableText(row.nome || row.name) ||
            normalizeNullableText(row.email) ||
            normalizeNullableText(row.telefone || row.phone) ||
            "Cliente importado";
          const telefone = normalizeImportPhone(
            row.telefone || row.phone || row.celular || row.whatsapp
          );
          const telefoneCandidates = buildImportPhoneLookupCandidates(
            row.telefone || row.phone || row.celular || row.whatsapp
          );
          const email = normalizeNullableText(row.email);
          const dataAniversario = normalizeNullableDate(row.data_aniversario || row.birthday);
          const tags = normalizeImportTags(row.tags || []);
          const utms = normalizeImportUtms(row.utms || []);

          if (!telefone) {
            throw new Error("Telefone obrigatorio para importar o contato.");
          }

          const existingRet = await client.query(models.get_cliente_by_email_or_phone_importacao(), [
            empresa_id,
            email,
            telefoneCandidates,
          ]);

          let cliente = existingRet.rows?.[0] || null;

          if (cliente) {
            const telefoneAtualNormalizado = normalizeImportPhone(cliente.telefone);
            const manterTelefoneAtual =
              telefoneAtualNormalizado &&
              telefoneCandidates.includes(telefoneAtualNormalizado);
            const updatedRet = await client.query(models.update_cliente_importacao(), [
              cliente.id,
              nome || cliente.nome,
              manterTelefoneAtual ? cliente.telefone : telefone || cliente.telefone,
              email || cliente.email,
              dataAniversario || cliente.data_aniversario || null,
              cliente.origem || "importacao",
            ]);
            cliente = updatedRet.rows?.[0] || cliente;
            resultado.atualizados += 1;
          } else {
            const createdRet = await client.query(models.create_cliente_importacao(), [
              nome,
              telefone,
              email,
              empresa_id,
              JSON.stringify(utms),
              dataAniversario,
              "importacao",
            ]);
            cliente = createdRet.rows?.[0] || null;
            createdCustomerId = cliente?.id || null;
            resultado.criados += 1;
          }

          if (!cliente?.id) {
            throw new Error("Nao foi possivel criar ou atualizar o cliente.");
          }

          if (cliente && utms.length > 0 && existingRet.rows?.length) {
            await client.query(models.append_cliente_utms(), [
              cliente.id,
              JSON.stringify(utms),
            ]);
          }

          const existingTagsRet = await client.query(models.get_cliente_tag_ids_for_import(), [
            cliente.id,
          ]);
          const existingTagIds = new Set(
            (existingTagsRet.rows || [])
              .map((item) => Number(item.tag_id))
              .filter((item) => Number.isInteger(item) && item > 0)
          );

          for (const tagNome of tags) {
            const tag = await ensureTagForImport(client, tagNome, empresa_id);
            if (!tag?.id) continue;

            const tagId = Number(tag.id);
            if (!Number.isInteger(tagId) || tagId <= 0 || existingTagIds.has(tagId)) {
              continue;
            }

            await client.query(models.create_vinculo_importacao(), [tagId, cliente.id]);
            existingTagIds.add(tagId);
            resultado.tags_adicionadas += 1;
          }

          await client.query("COMMIT");
          if (createdCustomerId) {
            developerWebhooks.queueCustomerCreated(createdCustomerId);
          }
        } catch (error) {
          await client.query("ROLLBACK");
          resultado.erros.push({
            linha,
            mensagem:
              error instanceof Error
                ? error.message
                : "Erro desconhecido ao importar o contato.",
          });
        }
      }

      return resultado;
    } finally {
      client.release();
    }
  },

  execute_create_tag: async (nome, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.create_tag(), [nome, empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_tag_by_nome: async (nome, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_tag_by_nome(), [nome, empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_create_vinculo: async (tag_id, cliente_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.create_vinculo(), [tag_id, cliente_id]);
    } finally {
      client.release();
    }
  },

  execute_remover_vinculo: async (usuario_id, tag_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.remove_vinculo(), [usuario_id, tag_id]);
    } finally {
      client.release();
    }
  },

  execute_get_busca_tag: async (pesquisa, empresa_id) => {
    const client = await postgres.connect();
    try {
      const like = "%" + pesquisa + "%";
      const ret = await client.query(models.get_busca_tag(), [
        like,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_deletar_tag: async (tag_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.deletar_tag(), [tag_id]);
    } finally {
      client.release();
    }
  },

  execute_remover_vinculo_em_massa: async (tag_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.remover_vinculo_em_massa(), [tag_id]);
    } finally {
      client.release();
    }
  },

  busca_clientes_tag: async (pesquisa, empresa_id) => {
    const client = await postgres.connect();
    try {
      const like = "%" + pesquisa + "%";
      const ret = await client.query(models.clientes_tag(), [like, empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_lista_tags: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_lista_tags(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_listar_listas_transmissao: async (empresa_id, usuario_id, meta_param_id = null) => {
    const client = await postgres.connect();
    try {
      const accessContext = await getUsuarioListaTransmissaoAccessContext(
        client,
        empresa_id,
        usuario_id
      );
      const normalizedMetaParamId = normalizeOptionalPositiveInt(meta_param_id);

      if (normalizedMetaParamId) {
        await resolveListaTransmissaoMetaParamId(client, empresa_id, normalizedMetaParamId);
        ensureUsuarioPodeUsarNumeroMetaListaTransmissao(
          normalizedMetaParamId,
          accessContext
        );
      }

      const ret = await client.query(models.list_listas_transmissao(), [empresa_id]);
      return filterListasTransmissaoByAccess(
        ret.rows,
        accessContext,
        normalizedMetaParamId
      ).map(normalizeListaTransmissaoRow);
    } finally {
      client.release();
    }
  },

  execute_criar_lista_transmissao: async ({
    empresa_id,
    usuario_id,
    meta_param_id,
    nome,
    descricao,
  }) => {
    const client = await postgres.connect();
    try {
      const normalizedName = normalizeNullableText(nome);
      if (!normalizedName) {
        throw new Error("Informe o nome da lista de transmissao.");
      }

      const accessContext = await getUsuarioListaTransmissaoAccessContext(
        client,
        empresa_id,
        usuario_id
      );
      const scopedMetaParamId = await resolveListaTransmissaoMetaParamId(
        client,
        empresa_id,
        meta_param_id
      );
      ensureUsuarioPodeUsarNumeroMetaListaTransmissao(scopedMetaParamId, accessContext);

      const ret = await client.query(models.create_lista_transmissao(), [
        empresa_id,
        scopedMetaParamId,
        normalizedName,
        normalizeNullableText(descricao),
        "or",
        JSON.stringify({}),
        usuario_id || null,
      ]);
      return normalizeListaTransmissaoRow(ret.rows?.[0] || null);
    } finally {
      client.release();
    }
  },

  execute_editar_lista_transmissao: async ({
    empresa_id,
    usuario_id,
    lista_id,
    meta_param_id,
    nome,
    descricao,
    tag_logic,
    tag_ids,
    utm_filters,
  }) => {
    const client = await postgres.connect();
    try {
      const normalizedName = normalizeNullableText(nome);
      if (!normalizedName) {
        throw new Error("Informe o nome da lista de transmissao.");
      }

      const normalizedTagLogic = normalizeBroadcastTagLogic(tag_logic);
      const normalizedTagIds = normalizeBroadcastTagIds(tag_ids);
      const normalizedUtmFilters = normalizeBroadcastUtmFilters(utm_filters);

      await client.query("BEGIN");

      const accessContext = await getUsuarioListaTransmissaoAccessContext(
        client,
        empresa_id,
        usuario_id
      );
      await ensureListaTransmissaoAccessible(client, {
        empresa_id,
        lista_id,
        accessContext,
      });
      const scopedMetaParamId = await resolveListaTransmissaoMetaParamId(
        client,
        empresa_id,
        meta_param_id
      );
      ensureUsuarioPodeUsarNumeroMetaListaTransmissao(scopedMetaParamId, accessContext);

      const validTagsRet = normalizedTagIds.length
        ? await client.query(models.get_tag_ids_validos_empresa(), [
            empresa_id,
            normalizedTagIds,
          ])
        : { rows: [] };

      const ret = await client.query(models.update_lista_transmissao(), [
        lista_id,
        normalizedName,
        normalizeNullableText(descricao),
        normalizedTagLogic,
        JSON.stringify(normalizedUtmFilters),
        scopedMetaParamId,
        empresa_id,
      ]);

      if (!ret.rows?.length) {
        throw createPublicError("Lista de transmissao nao encontrada.");
      }

      await client.query(models.delete_lista_transmissao_tags(), [lista_id]);

      for (const tag of validTagsRet.rows || []) {
        await client.query(models.insert_lista_transmissao_tag(), [lista_id, tag.id]);
      }

      await client.query("COMMIT");
      return normalizeListaTransmissaoRow(ret.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_deletar_lista_transmissao: async (empresa_id, usuario_id, lista_id) => {
    const client = await postgres.connect();
    try {
      const accessContext = await getUsuarioListaTransmissaoAccessContext(
        client,
        empresa_id,
        usuario_id
      );
      await ensureListaTransmissaoAccessible(client, {
        empresa_id,
        lista_id,
        accessContext,
      });

      const ret = await client.query(models.delete_lista_transmissao(), [
        lista_id,
        empresa_id,
      ]);
      if (!ret.rows?.length) {
        throw createPublicError("Lista de transmissao nao encontrada.");
      }
      return ret.rows[0];
    } finally {
      client.release();
    }
  },

  execute_get_contatos_lista_transmissao: async (empresa_id, usuario_id, lista_id) => {
    const client = await postgres.connect();
    try {
      const accessContext = await getUsuarioListaTransmissaoAccessContext(
        client,
        empresa_id,
        usuario_id
      );
      await ensureListaTransmissaoAccessible(client, {
        empresa_id,
        lista_id,
        accessContext,
      });

      const ret = await client.query(models.get_lista_transmissao_contatos(), [
        lista_id,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_adicionar_contato_lista_transmissao: async ({
    empresa_id,
    usuario_id,
    lista_id,
    cliente_id,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const accessContext = await getUsuarioListaTransmissaoAccessContext(
        client,
        empresa_id,
        usuario_id
      );
      await ensureListaTransmissaoAccessible(client, {
        empresa_id,
        lista_id,
        accessContext,
      });

      const clienteRet = await client.query(models.get_cliente_by_id_empresa(), [
        cliente_id,
        empresa_id,
      ]);
      if (!clienteRet.rows?.length) {
        throw createPublicError("Contato nao encontrado para esta empresa.");
      }

      await client.query(models.insert_contato_lista_transmissao_manual(), [
        lista_id,
        cliente_id,
      ]);

      const countRet = await client.query(models.count_contatos_lista_transmissao(), [
        lista_id,
      ]);

      await client.query("COMMIT");
      return {
        cliente: clienteRet.rows[0],
        total_contatos: Number(countRet.rows?.[0]?.total_contatos || 0),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_remover_contato_lista_transmissao: async ({
    empresa_id,
    usuario_id,
    lista_id,
    cliente_id,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const accessContext = await getUsuarioListaTransmissaoAccessContext(
        client,
        empresa_id,
        usuario_id
      );
      await ensureListaTransmissaoAccessible(client, {
        empresa_id,
        lista_id,
        accessContext,
      });

      const ret = await client.query(models.delete_contato_lista_transmissao(), [
        lista_id,
        cliente_id,
      ]);
      if (!ret.rows?.length) {
        throw new Error("Contato nao encontrado nesta lista.");
      }

      const countRet = await client.query(models.count_contatos_lista_transmissao(), [
        lista_id,
      ]);

      await client.query("COMMIT");
      return {
        total_contatos: Number(countRet.rows?.[0]?.total_contatos || 0),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_sincronizar_lista_transmissao: async ({
    empresa_id,
    usuario_id,
    lista_id,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const accessContext = await getUsuarioListaTransmissaoAccessContext(
        client,
        empresa_id,
        usuario_id
      );
      const lista = await ensureListaTransmissaoAccessible(client, {
        empresa_id,
        lista_id,
        accessContext,
      });

      const tagsRet = await client.query(
        `
          select tag_id
          from cliente_lista_transmissao_tag
          where lista_transmissao_id = $1
        `,
        [lista_id]
      );

      const tagIds = normalizeBroadcastTagIds(
        (tagsRet.rows || []).map((row) => row.tag_id)
      );
      const tagLogic = normalizeBroadcastTagLogic(lista.tag_logic);
      const utmFilters = normalizeBroadcastUtmFilters(lista.utm_filters);

      if (!tagIds.length && !Object.keys(utmFilters).length) {
        throw new Error(
          "Configure ao menos uma tag ou um filtro de UTM antes de sincronizar a lista."
        );
      }

      const { query, params } = buildBroadcastSegmentClientQuery(
        empresa_id,
        tagIds,
        tagLogic,
        utmFilters
      );

      const contatosRet = await client.query(query, params);
      const contatoIds = [...new Set((contatosRet.rows || []).map((row) => Number(row.id)).filter(Boolean))];

      await client.query(models.delete_contatos_automaticos_lista_transmissao(), [lista_id]);

      let adicionados = 0;
      for (const clienteId of contatoIds) {
        const insertRet = await client.query(models.insert_contato_lista_transmissao_segmento(), [
          lista_id,
          clienteId,
        ]);
        if (insertRet.rows?.length) {
          adicionados += 1;
        }
      }

      const countRet = await client.query(models.count_contatos_lista_transmissao(), [
        lista_id,
      ]);

      await client.query("COMMIT");
      return {
        contatos_encontrados: contatoIds.length,
        contatos_adicionados: adicionados,
        total_contatos: Number(countRet.rows?.[0]?.total_contatos || 0),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_busca_clientes_outros: async (filtro, pesquisa, empresa_id) => {
    const client = await postgres.connect();
    try {
      const like = "%" + pesquisa + "%";
      let query = "";
      switch (filtro) {
        case "nome":
          query = `SELECT *
                         FROM cliente 
                         WHERE nome ILIKE $1 and empresa_id = $2`;
          break;

        case "telefone":
          query = `SELECT * 
                         FROM cliente 
                         WHERE telefone ILIKE $1 and empresa_id = $2`;
          break;

        case "email":
          query = `SELECT *
                         FROM cliente 
                         WHERE email ILIKE $1 and empresa_id = $2`;
          break;

        default:
          throw new Error("Filtro inválido");
      }
      const ret = await client.query(query, [like, empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_mensagens_rapidas: async (empresa_id, usuario_id, include_all = false) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_mensagens_rapidas(), [
        empresa_id,
        usuario_id,
        Boolean(include_all),
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_mensagens_rapidas_legacy: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_mensagens_rapidas_legacy(), [
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_mensagem_rapida_by_id: async (id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_mensagem_rapida_by_id(), [
        id,
        empresa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_get_mensagem_rapida_by_id_legacy: async (id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_mensagem_rapida_by_id_legacy(), [
        id,
        empresa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_listar_galeria_imagens_empresa: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.listar_galeria_imagens_empresa(), [
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_galeria_imagem_by_id_empresa: async (imagem_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_galeria_imagem_by_id_empresa(), [
        imagem_id,
        empresa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_contar_galeria_imagens_empresa: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.contar_galeria_imagens_empresa(), [empresa_id]);
      return Number(ret.rows?.[0]?.total || 0);
    } finally {
      client.release();
    }
  },

  execute_criar_galeria_imagem_empresa: async ({
    empresa_id,
    nome_arquivo,
    url,
    path_bunny,
    mime_type,
    tamanho_bytes,
    origem,
  }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.criar_galeria_imagem_empresa(), [
        empresa_id,
        nome_arquivo,
        url,
        path_bunny,
        mime_type,
        tamanho_bytes,
        origem,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_deletar_galeria_imagem_empresa: async (imagem_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.deletar_galeria_imagem_empresa(), [
        imagem_id,
        empresa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_contar_mensagens_rapidas_por_galeria_imagem: async (imagem_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.contar_mensagens_rapidas_por_galeria_imagem(), [
        imagem_id,
      ]);
      return Number(ret.rows?.[0]?.total || 0);
    } finally {
      client.release();
    }
  },

  execute_listar_galeria_documentos_empresa: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.listar_galeria_documentos_empresa(), [
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_galeria_documento_by_id_empresa: async (documento_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_galeria_documento_by_id_empresa(), [
        documento_id,
        empresa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_contar_galeria_documentos_empresa: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.contar_galeria_documentos_empresa(), [empresa_id]);
      return Number(ret.rows?.[0]?.total || 0);
    } finally {
      client.release();
    }
  },

  execute_criar_galeria_documento_empresa: async ({
    empresa_id,
    nome_arquivo,
    url,
    path_bunny,
    mime_type,
    tamanho_bytes,
    origem,
  }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.criar_galeria_documento_empresa(), [
        empresa_id,
        nome_arquivo,
        url,
        path_bunny,
        mime_type,
        tamanho_bytes,
        origem,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_deletar_galeria_documento_empresa: async (documento_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.deletar_galeria_documento_empresa(), [
        documento_id,
        empresa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_contar_mensagens_rapidas_por_galeria_documento: async (documento_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.contar_mensagens_rapidas_por_galeria_documento(), [
        documento_id,
      ]);
      return Number(ret.rows?.[0]?.total || 0);
    } finally {
      client.release();
    }
  },

  execute_listar_galeria_audios_empresa: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.listar_galeria_audios_empresa(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_galeria_audio_by_id_empresa: async (audio_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_galeria_audio_by_id_empresa(), [
        audio_id,
        empresa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_contar_galeria_audios_empresa: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.contar_galeria_audios_empresa(), [empresa_id]);
      return Number(ret.rows?.[0]?.total || 0);
    } finally {
      client.release();
    }
  },

  execute_criar_galeria_audio_empresa: async ({
    empresa_id,
    nome_arquivo,
    url,
    path_bunny,
    mime_type,
    tamanho_bytes,
    origem,
  }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.criar_galeria_audio_empresa(), [
        empresa_id,
        nome_arquivo,
        url,
        path_bunny,
        mime_type,
        tamanho_bytes,
        origem,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_deletar_galeria_audio_empresa: async (audio_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.deletar_galeria_audio_empresa(), [
        audio_id,
        empresa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_contar_mensagens_rapidas_por_galeria_audio: async (audio_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.contar_mensagens_rapidas_por_galeria_audio(), [
        audio_id,
      ]);
      return Number(ret.rows?.[0]?.total || 0);
    } finally {
      client.release();
    }
  },

  execute_listar_mensagens_automaticas_whatsapp: async (
    empresa_id,
    meta_param_id = null
  ) => {
    const client = await postgres.connect();
    try {
      const plano = await getPlanoEmpresaAtual(client, empresa_id);
      const scopedMetaParamId = await resolveAutoMessageMetaParamId(
        client,
        empresa_id,
        meta_param_id
      );
      const ret = await client.query(
        models.listar_mensagens_automaticas_whatsapp(),
        [empresa_id, scopedMetaParamId]
      );
      return canUseBirthdayTemplate(plano)
        ? ret.rows
        : ret.rows.filter((row) => ![4, 6, 7].includes(Number(row.tipo_id)));
    } finally {
      client.release();
    }
  },

  execute_criar_mensagem_automatica_whatsapp: async (
    texto,
    tipo_id,
    empresa_id,
    options = {}
  ) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      await ensureBirthdayTemplateAllowed(client, tipo_id, empresa_id);
      const scopedMetaParamId = await resolveAutoMessageMetaParamId(
        client,
        empresa_id,
        options?.meta_param_id
      );
      const shouldAllowComplementaryContent = Number(tipo_id) === 1;
      const mensagemComplementarTexto = shouldAllowComplementaryContent
        ? normalizeNullableText(options?.mensagem_complementar_texto)
        : null;
      const galeriaImagemId = shouldAllowComplementaryContent
        ? await resolveAutoMessageGalleryImageId(
            client,
            empresa_id,
            options?.galeria_imagem_id
          )
        : null;
      await client.query(
        models.desativar_mensagem_automatica_whatsapp_por_tipo(),
        [tipo_id, empresa_id, scopedMetaParamId]
      );
      const ret = await client.query(
        models.criar_mensagem_automatica_whatsapp(),
        [
          texto,
          mensagemComplementarTexto,
          galeriaImagemId,
          tipo_id,
          empresa_id,
          scopedMetaParamId,
        ]
      );
      await client.query("COMMIT");
      const mensagens = await Promise.all(
        ret.rows.map((row) => enrichAutoMessageRow(client, row))
      );
      return mensagens;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_editar_mensagem_automatica_whatsapp: async (
    id,
    texto,
    tipo_id,
    empresa_id,
    options = {}
  ) => {
    const client = await postgres.connect();
    try {
      await ensureBirthdayTemplateAllowed(client, tipo_id, empresa_id);
      const scopedMetaParamId = await resolveAutoMessageMetaParamId(
        client,
        empresa_id,
        options?.meta_param_id
      );
      const shouldAllowComplementaryContent = Number(tipo_id) === 1;
      const mensagemComplementarTexto = shouldAllowComplementaryContent
        ? normalizeNullableText(options?.mensagem_complementar_texto)
        : null;
      const galeriaImagemId = shouldAllowComplementaryContent
        ? await resolveAutoMessageGalleryImageId(
            client,
            empresa_id,
            options?.galeria_imagem_id
          )
        : null;
      const ret = await client.query(
        models.editar_mensagem_automatica_whatsapp(),
        [
          texto,
          mensagemComplementarTexto,
          galeriaImagemId,
          id,
          tipo_id,
          empresa_id,
          scopedMetaParamId,
        ]
      );
      const mensagens = await Promise.all(
        ret.rows.map((row) => enrichAutoMessageRow(client, row))
      );
      return mensagens;
    } finally {
      client.release();
    }
  },

  execute_deletar_mensagem_automatica_whatsapp: async (
    id,
    tipo_id,
    empresa_id,
    options = {}
  ) => {
    const client = await postgres.connect();
    try {
      await ensureBirthdayTemplateAllowed(client, tipo_id, empresa_id);
      const scopedMetaParamId = await resolveAutoMessageMetaParamId(
        client,
        empresa_id,
        options?.meta_param_id
      );
      const ret = await client.query(
        models.deletar_mensagem_automatica_whatsapp(),
        [id, tipo_id, empresa_id, scopedMetaParamId]
      );
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_alterar_status_mensagem_automatica_whatsapp: async (
    tipo_id,
    empresa_id,
    habilitada,
    options = {}
  ) => {
    const client = await postgres.connect();
    try {
      await ensureBirthdayTemplateAllowed(client, tipo_id, empresa_id);
      const scopedMetaParamId = await resolveAutoMessageMetaParamId(
        client,
        empresa_id,
        options?.meta_param_id
      );

      if (!scopedMetaParamId) {
        throw new Error(
          "Selecione um numero da Meta valido para alterar o status da mensagem automatica."
        );
      }

      let ret;
      try {
        const toggleQuery = Number(tipo_id) === 8
          ? models.update_empresa_meta_numero_auto_message_toggle()
          : models.update_empresa_meta_numero_auto_message_toggle_legacy();
        ret = await client.query(toggleQuery, [
          scopedMetaParamId,
          empresa_id,
          tipo_id,
          Boolean(habilitada),
        ]);
      } catch (error) {
        if (
          Number(tipo_id) === 8 &&
          error?.code === "42703" &&
          String(error?.message || "").includes("whatsapp_auto_message_sem_resposta_6h_ativa")
        ) {
          throw new Error(
            "A configuracao de 6 horas ainda nao foi instalada no banco. Execute docs/sql/no_reply_followup.sql."
          );
        }
        throw error;
      }

      const row = ret.rows?.[0] || null;
      if (!row) {
        throw new Error("Nao foi possivel atualizar o toggle da mensagem automatica.");
      }

      const configRow = await getAutoMessageToggleConfig(
        client,
        empresa_id,
        scopedMetaParamId
      );

      return {
        tipo_id: Number(tipo_id),
        empresa_id,
        empresa_meta_param_id: scopedMetaParamId,
        habilitada: resolveAutoMessageToggleValue(configRow, tipo_id),
      };
    } finally {
      client.release();
    }
  },

  execute_get_birthday_template_config: async ({
    empresa_id,
    meta_param_id,
  }) => {
    const client = await postgres.connect();
    try {
      await ensureBirthdayTemplateAllowed(client, 4, empresa_id);
      const scopedMetaParamId = await resolveAutoMessageMetaParamId(
        client,
        empresa_id,
        meta_param_id
      );

      if (!scopedMetaParamId) {
        throw new Error(
          "Selecione um numero da Meta valido para configurar a automacao de aniversario."
        );
      }

      const ret = await client.query(
        models.get_empresa_meta_numero_birthday_template_config(),
        [scopedMetaParamId, empresa_id]
      );

      const row = normalizeBirthdayTemplateConfigRow(ret.rows?.[0] || null);
      if (!row) {
        throw new Error("Numero da Meta selecionado nao encontrado para esta empresa.");
      }

      return row;
    } finally {
      client.release();
    }
  },

  execute_save_birthday_template_config: async ({
    empresa_id,
    meta_param_id,
    template_name,
    template_language,
    horario,
    is_default_dispatch_number,
    header_media_type,
    header_media_url,
    header_parameters,
    body_parameters,
    button_parameters,
    requestContext,
  }) => {
    const client = await postgres.connect();
    try {
      await ensureBirthdayTemplateAllowed(client, 4, empresa_id);
      const scopedMetaParamId = await resolveAutoMessageMetaParamId(
        client,
        empresa_id,
        meta_param_id
      );

      if (!scopedMetaParamId) {
        throw new Error(
          "Selecione um numero da Meta valido para configurar a automacao de aniversario."
        );
      }

      const normalizedTemplateName = normalizeNullableText(template_name);
      const normalizedTemplateLanguage =
        normalizeNullableText(template_language) || "pt_BR";
      const normalizedScheduleTime = normalizeBirthdayTemplateTime(horario);
      const normalizedDefaultDispatchNumber = Boolean(
        is_default_dispatch_number
      );
      const hasHeaderUpload = Boolean(
        requestContext?.files?.header_image_file?.[0] ||
          requestContext?.files?.header_document_file?.[0] ||
          requestContext?.files?.header_video_file?.[0] ||
          requestContext?.files?.header_file?.[0]
      );
      const rawHeaderMediaUrl = hasHeaderUpload
        ? null
        : normalizeBirthdayHeaderMediaUrl(header_media_url);
      const normalizedHeaderMediaType = rawHeaderMediaUrl
        ? normalizeBirthdayHeaderMediaType(header_media_type)
        : null;
      const normalizedHeaderMediaUrl = normalizedHeaderMediaType
        ? rawHeaderMediaUrl
        : null;
      const normalizedHeaderParameters =
        normalizeTemplateParameterArray(header_parameters);
      const normalizedBodyParameters =
        normalizeTemplateParameterArray(body_parameters);
      const normalizedButtonParameters =
        normalizeTemplateButtonParameterArray(button_parameters);

      if (normalizedTemplateName) {
        await validateBirthdayTemplateDispatchConfiguration(client, {
          empresa_id,
          meta_param_id: scopedMetaParamId,
          template_name: normalizedTemplateName,
          template_language: normalizedTemplateLanguage,
          header_media_type: normalizedHeaderMediaType,
          header_media_url: normalizedHeaderMediaUrl,
          header_parameters: normalizedHeaderParameters,
          body_parameters: normalizedBodyParameters,
          button_parameters: normalizedButtonParameters,
        }, requestContext);
      }

      if (normalizedDefaultDispatchNumber) {
        await client.query(
          models.clear_empresa_birthday_template_default_dispatch(),
          [empresa_id, scopedMetaParamId]
        );
      }

      const ret = await client.query(
        models.update_empresa_meta_numero_birthday_template_config(),
        [
          scopedMetaParamId,
          empresa_id,
          normalizedTemplateName,
          normalizedTemplateLanguage,
          normalizedScheduleTime,
          normalizedHeaderMediaType,
          normalizedHeaderMediaUrl,
          normalizedDefaultDispatchNumber,
          JSON.stringify(normalizedHeaderParameters),
          JSON.stringify(normalizedBodyParameters),
          JSON.stringify(normalizedButtonParameters),
        ]
      );

      const row = normalizeBirthdayTemplateConfigRow(ret.rows?.[0] || null);
      if (!row) {
        throw new Error("Nao foi possivel salvar a configuracao de aniversario.");
      }

      return row;
    } finally {
      client.release();
    }
  },

  execute_list_birthday_template_configs_for_processing: async () => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(
        models.list_empresa_meta_numeros_birthday_template_configs_for_processing(),
        [BIRTHDAY_TEMPLATE_MIN_PLAN_ID]
      );
      return (ret.rows || [])
        .map((row) => normalizeBirthdayTemplateConfigRow(row))
        .filter(Boolean);
    } finally {
      client.release();
    }
  },

  execute_get_template_automation_config: async ({
    automation_type,
    empresa_id,
    meta_param_id,
  }) => {
    const normalizedType = normalizeTemplateAutomationType(automation_type);
    if (!normalizedType) {
      throw new Error("Tipo de automacao invalido.");
    }

    if (normalizedType === "birthday") {
      return execute.execute_get_birthday_template_config({
        empresa_id,
        meta_param_id,
      });
    }

    const client = await postgres.connect();
    try {
      return await getSalesFollowupTemplateConfigByType(client, {
        automation_type: normalizedType,
        empresa_id,
        meta_param_id,
      });
    } finally {
      client.release();
    }
  },

  execute_save_template_automation_config: async ({
    automation_type,
    empresa_id,
    meta_param_id,
    template_name,
    template_language,
    horario,
    delay_days,
    is_default_dispatch_number,
    header_media_type,
    header_media_url,
    header_parameters,
    body_parameters,
    button_parameters,
    requestContext,
  }) => {
    const normalizedType = normalizeTemplateAutomationType(automation_type);
    if (!normalizedType) {
      throw new Error("Tipo de automacao invalido.");
    }

    if (normalizedType === "birthday") {
      return execute.execute_save_birthday_template_config({
        empresa_id,
        meta_param_id,
        template_name,
        template_language,
        horario,
        is_default_dispatch_number,
        header_media_type,
        header_media_url,
        header_parameters,
        body_parameters,
        button_parameters,
        requestContext,
      });
    }

    const client = await postgres.connect();
    try {
      return await saveSalesFollowupTemplateConfigByType(client, {
        automation_type: normalizedType,
        empresa_id,
        meta_param_id,
        template_name,
        template_language,
        horario,
        delay_days,
        is_default_dispatch_number,
        header_media_type,
        header_media_url,
        header_parameters,
        body_parameters,
        button_parameters,
        requestContext,
      });
    } finally {
      client.release();
    }
  },

  execute_list_sales_followup_template_configs_for_processing: async (
    automation_type
  ) => {
    const definition = getTemplateAutomationDefinition(automation_type);
    if (!definition || definition.key === "birthday") {
      throw new Error("Tipo de automacao invalido.");
    }

    const client = await postgres.connect();
    try {
      const ret = await client.query(
        models.list_empresa_meta_numeros_sales_followup_template_configs_for_processing(
          definition.key
        ),
        [BIRTHDAY_TEMPLATE_MIN_PLAN_ID]
      );
      return (ret.rows || [])
        .map((row) => normalizeBirthdayTemplateConfigRow(row))
        .filter(Boolean);
    } finally {
      client.release();
    }
  },

  execute_list_clientes_aniversario_por_meta_numero: async ({
    empresa_id,
    empresa_meta_param_id,
    mes,
    dia,
  }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(
        models.list_clientes_aniversario_por_meta_numero(),
        [empresa_id, empresa_meta_param_id, mes, dia]
      );
      return ret.rows || [];
    } finally {
      client.release();
    }
  },

  execute_list_clientes_sales_followup_por_meta_numero: async ({
    automation_type,
    empresa_id,
    empresa_meta_param_id,
    reference_date,
  }) => {
    const definition = getTemplateAutomationDefinition(automation_type);
    if (!definition || definition.key === "birthday") {
      throw new Error("Tipo de automacao invalido.");
    }

    const client = await postgres.connect();
    try {
      const ret = await client.query(
        models.list_clientes_sales_followup_por_meta_numero(definition.key),
        [empresa_id, empresa_meta_param_id, reference_date]
      );
      return ret.rows || [];
    } finally {
      client.release();
    }
  },

  execute_claim_birthday_template_send_log: async ({
    empresa_id,
    empresa_meta_param_id,
    cliente_id,
    referencia_data,
    template_name,
    template_language,
    numero,
    conversa_id = null,
    metadata = {},
  }) => {
    const client = await postgres.connect();
    try {
      const lockToken = crypto.randomBytes(16).toString("hex");
      const ret = await client.query(models.claim_birthday_template_send_log(), [
        empresa_id,
        empresa_meta_param_id,
        cliente_id,
        referencia_data,
        template_name,
        template_language || null,
        numero || null,
        conversa_id || null,
        lockToken,
        JSON.stringify(metadata || {}),
      ]);

      const row = ret.rows?.[0] || null;
      if (!row) {
        return null;
      }

      return {
        ...row,
        lock_token: lockToken,
      };
    } finally {
      client.release();
    }
  },

  execute_mark_birthday_template_send_log_sent: async ({
    id,
    lock_token,
    mensagem_whats_id = null,
    metadata = {},
  }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.mark_birthday_template_send_log_sent(), [
        id,
        lock_token,
        mensagem_whats_id,
        JSON.stringify(metadata || {}),
      ]);
      return ret.rows?.[0] || null;
    } finally {
      client.release();
    }
  },

  execute_mark_birthday_template_send_log_error: async ({
    id,
    lock_token,
    erro_mensagem,
    metadata = {},
  }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.mark_birthday_template_send_log_error(), [
        id,
        lock_token,
        erro_mensagem || "Falha nao detalhada no disparo de aniversario.",
        JSON.stringify(metadata || {}),
      ]);
      return ret.rows?.[0] || null;
    } finally {
      client.release();
    }
  },

  execute_claim_sales_followup_template_send_log: async ({
    automation_type,
    empresa_id,
    empresa_meta_param_id,
    cliente_id,
    comercial_negocio_id,
    evento_data,
    template_name,
    template_language,
    numero,
    conversa_id = null,
    metadata = {},
  }) => {
    const definition = getTemplateAutomationDefinition(automation_type);
    if (!definition || definition.key === "birthday") {
      throw new Error("Tipo de automacao invalido.");
    }

    const client = await postgres.connect();
    try {
      const lockToken = crypto.randomBytes(16).toString("hex");
      const ret = await client.query(
        models.claim_sales_followup_template_send_log(),
        [
          definition.key,
          empresa_id,
          empresa_meta_param_id,
          cliente_id,
          comercial_negocio_id,
          evento_data,
          template_name,
          template_language || null,
          numero || null,
          conversa_id || null,
          lockToken,
          JSON.stringify(metadata || {}),
        ]
      );

      const row = ret.rows?.[0] || null;
      if (!row) {
        return null;
      }

      return {
        ...row,
        lock_token: lockToken,
      };
    } finally {
      client.release();
    }
  },

  execute_mark_sales_followup_template_send_log_sent: async ({
    id,
    lock_token,
    mensagem_whats_id = null,
    metadata = {},
  }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(
        models.mark_sales_followup_template_send_log_sent(),
        [id, lock_token, mensagem_whats_id, JSON.stringify(metadata || {})]
      );
      return ret.rows?.[0] || null;
    } finally {
      client.release();
    }
  },

  execute_mark_sales_followup_template_send_log_error: async ({
    id,
    lock_token,
    erro_mensagem,
    metadata = {},
  }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(
        models.mark_sales_followup_template_send_log_error(),
        [
          id,
          lock_token,
          erro_mensagem || "Falha nao detalhada no disparo de follow-up.",
          JSON.stringify(metadata || {}),
        ]
      );
      return ret.rows?.[0] || null;
    } finally {
      client.release();
    }
  },

  execute_get_plano_empresa_atual: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      return await getPlanoEmpresaAtual(client, empresa_id);
    } finally {
      client.release();
    }
  },

  execute_delete_mensagem_rapida: async (id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.delete_mensagem_rapida(), [id, empresa_id]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_alterar_mensagem_rapida: async (
    comando,
    descricao,
    texto,
    galeria_imagem_id,
    galeria_documento_id,
    galeria_audio_id,
    usar_texto_como_legenda,
    ordem_midias,
    usuario_id,
    id,
    empresa_id
  ) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.alterar_mensagem_rapida(), [
        comando,
        descricao,
        texto,
        galeria_imagem_id,
        galeria_documento_id,
        galeria_audio_id,
        Boolean(usar_texto_como_legenda),
        JSON.stringify(ordem_midias),
        usuario_id,
        id,
        empresa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_criar_mensagem_rapida: async (
    comando,
    descricao,
    texto,
    empresa_id,
    galeria_imagem_id,
    galeria_documento_id,
    galeria_audio_id,
    usar_texto_como_legenda,
    ordem_midias,
    usuario_id
  ) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.criar_mensagem_rapida(), [
        comando,
        descricao,
        texto,
        empresa_id,
        galeria_imagem_id,
        galeria_documento_id,
        galeria_audio_id,
        Boolean(usar_texto_como_legenda),
        JSON.stringify(ordem_midias),
        usuario_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_get_quick_message_user_context: async (usuario_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_quick_message_user_context(), [
        usuario_id,
        empresa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_update_tag: async (tag_id, nome) => {
    const client = await postgres.connect();
    try {
      const normalizedName = normalizeNullableText(nome);
      if (!normalizedName) {
        throw new Error("Informe o nome da tag.");
      }

      await client.query(models.update_tag(), [tag_id, normalizedName]);
    } finally {
      client.release();
    }
  },

  execute_insert_nota: async (user_id, cliente_id, createdAt, content) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.insert_nota(), [
        user_id,
        cliente_id,
        createdAt,
        content,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_verify_filial: async (cnpj, filial) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.verify_filial(), [cnpj, filial]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_create_filial: async (
    empresa_id,
    nome,
    telefone,
    cnpj,
    logradouro,
    gerente,
    primaria,
    latitude,
    longitude,
    tolerancia_metros
  ) => {
    const client = await postgres.connect();
    try {
      const normalizedLatitude = normalizeLatitude(latitude);
      const normalizedLongitude = normalizeLongitude(longitude);
      const normalizedTolerance = normalizeToleranceMeters(tolerancia_metros);
      const ret = await client.query(models.create_filial(), [
        empresa_id,
        nome,
        telefone,
        cnpj,
        logradouro,
        gerente,
        primaria,
        normalizedLatitude,
        normalizedLongitude,
        normalizedTolerance,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_listar_filial: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.listar_filial(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_update_filial: async (
    filial_id,
    nome,
    telefone,
    logradouro,
    gerente,
    primaria,
    latitude,
    longitude,
    tolerancia_metros
  ) => {
    const client = await postgres.connect();
    try {
      const normalizedLatitude = normalizeLatitude(latitude);
      const normalizedLongitude = normalizeLongitude(longitude);
      const normalizedTolerance = normalizeToleranceMeters(tolerancia_metros);
      const ret = await client.query(models.update_filial(), [
        filial_id,
        nome,
        telefone,
        logradouro,
        gerente,
        primaria,
        normalizedLatitude,
        normalizedLongitude,
        normalizedTolerance,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_expurgar_produtos: async (filial_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.expurgar_produtos(), [filial_id]);
    } finally {
      client.release();
    }
  },

  execute_migrate_estoque: async (filial_id, filial_alvo_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.migrate_estoque(), [filial_id, filial_alvo_id]);
    } finally {
      client.release();
    }
  },

  execute_verify_categoria: async (nome, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.verify_categoria(), [
        nome,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_create_categoria: async (nome, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.create_categoria(), [nome, empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_listar_categorias: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.listar_categorias(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_update_categoria: async (id, name) => {
    const client = await postgres.connect();
    try {
      await client.query(models.update_categoria(), [id, name]);
    } finally {
      client.release();
    }
  },

  execute_deletar_categoria: async (id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.deletar_categoria(), [id]);
    } finally {
      client.release();
    }
  },

  execute_get_usuarios: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_usuarios(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_criar_usuarios: async (
    nome,
    email,
    telefone,
    filial_id,
    senha,
    cargo_id,
    empresa_id,
    permissions,
    allowed_meta_param_ids = [],
    cor_atendimento = null
  ) => {
    const client = await postgres.connect();
    const permissions_string = JSON.stringify(permissions);
    try {
      await client.query("BEGIN");
      const normalizedEmail = await ensureUsuarioEmailDisponivel(client, email);
      const normalizedTelefone = normalizeNullableText(telefone);
      const normalizedFilialId = normalizeOptionalPositiveInt(filial_id);
      const normalizedAttendanceColor = normalizeAttendanceColor(cor_atendimento);
      const normalizedPassword = validatePasswordPolicy(senha);
      await ensureFilialPertenceEmpresa(client, normalizedFilialId, empresa_id);
      const ret = await client.query(models.criar_usuarios(), [
        nome,
        normalizedEmail,
        normalizedTelefone,
        normalizedFilialId,
        security.hashPassword(normalizedPassword),
        cargo_id,
        empresa_id,
        permissions_string,
        normalizedAttendanceColor,
      ]);
      const usuario = ret.rows?.[0] || null;
      if (!usuario?.id) {
        throw new Error("Nao foi possivel criar o usuario.");
      }

      await syncUsuarioMetaNumeros(
        client,
        Number(usuario.id),
        Number(empresa_id),
        allowed_meta_param_ids,
        Boolean(usuario.is_master)
      );

      await client.query("COMMIT");
      return usuario;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_alterar_usuarios: async (
    id,
    nome,
    email,
    telefone,
    filial_id,
    cargo_id,
    senha,
    permissions,
    allowed_meta_param_ids = [],
    empresa_id,
    cor_atendimento = null
  ) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      const permissions_string = JSON.stringify(permissions);
      const normalizedEmail = await ensureUsuarioEmailDisponivel(client, email, id);
      const normalizedTelefone = normalizeNullableText(telefone);
      const normalizedFilialId = normalizeOptionalPositiveInt(filial_id);
      const normalizedAttendanceColor = normalizeAttendanceColor(cor_atendimento);
      await ensureFilialPertenceEmpresa(client, normalizedFilialId, empresa_id);
      const userContextRet = await client.query(models.get_usuario_empresa_contexto(), [
        id,
        empresa_id,
      ]);
      const userContext = userContextRet.rows?.[0] || null;

      if (!userContext) {
        throw new Error("Usuario nao encontrado para esta empresa.");
      }

      if (senha) {
        const normalizedPassword = validatePasswordPolicy(senha);
        await client.query(
          `
                    UPDATE public.usuario
	SET  nome=$2, email=$3, telefone=$4, filial_id=$5, senha=$6,  perfil_id=$7, permissoes_customizadas = $8, cor_atendimento = $9
	WHERE id = $1;
          `,
          [
            id,
            nome,
            normalizedEmail,
            normalizedTelefone,
            normalizedFilialId,
            security.hashPassword(normalizedPassword),
            cargo_id,
            permissions_string,
            normalizedAttendanceColor,
          ]
        );
      } else {
        await client.query(
          `
                    UPDATE public.usuario
	SET  nome=$2, email=$3, telefone=$4, filial_id=$5, perfil_id=$6, permissoes_customizadas = $7, cor_atendimento = $8
	WHERE id = $1;
          `,
          [
            id,
            nome,
            normalizedEmail,
            normalizedTelefone,
            normalizedFilialId,
            cargo_id,
            permissions_string,
            normalizedAttendanceColor,
          ]
        );
      }

      await syncUsuarioMetaNumeros(
        client,
        Number(id),
        Number(empresa_id),
        allowed_meta_param_ids,
        Boolean(userContext.is_master)
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_list_empresa_meta_numeros_ativos: async (empresa_id, usuario_id = null) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_empresa_meta_numeros_ativos(), [empresa_id]);
      if (!normalizeOptionalPositiveInt(usuario_id)) {
        return ret.rows;
      }

      const accessContext = await getUsuarioListaTransmissaoAccessContext(
        client,
        empresa_id,
        usuario_id
      );

      if (Boolean(accessContext.isMaster)) {
        return ret.rows;
      }

      if (!accessContext.allowedMetaParamIds.length) {
        return [];
      }

      return (ret.rows || []).filter((row) =>
        accessContext.allowedMetaParamIds.includes(Number(row?.id || 0))
      );
    } finally {
      client.release();
    }
  },

  execute_deletar_usuarios: async (usuario_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.deletar_usuarios(), [usuario_id]);
      return ret.rows
    } finally {
      client.release();
    }
  },

  execute_get_dados_venda: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dados_venda(), [empresa_id, dateStart, dateEnd, filialId]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_valor_estqoue: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [, , filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.valor_estqoue(), [empresa_id, filialId]);
      return ret.rows;
    } finally {
      client.release();
    }
  },
  execute_get_fornecedores: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_fornecedores(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_vendas_horas: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_vendas_horas(), [empresa_id, dateStart, dateEnd, filialId]);
      return ret.rows;
    } finally {
      client.release();
    }
  },
  execute_get_vendas_relatorio: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_vendas_relatorio(), [
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_cargos: async () => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_cargos(), []);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_number_users: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_number_users(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_prompt_ia_atendimento_empresa: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_prompt_ia_atendimento_empresa(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_update_prompt_ia_atendimento_empresa: async (empresa_id, prompt) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.update_prompt_ia_atendimento_empresa(), [
        empresa_id,
        prompt,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_contexto_usuario: async (usuario_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_dashboard_contexto_usuario(), [
        usuario_id,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_atendimento_stats: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_atendimento_stats(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_top_tags: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_top_tags(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_tempo_medio_atendimento: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_tempo_medio_atendimento(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_atendimento_por_usuario: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_atendimento_por_usuario(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_documentos_cliente_por_atendente: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      await ensureClienteDocumentoDashboardSchema(client);
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_documentos_cliente_por_atendente(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } catch (error) {
      if (isMissingClienteDocumentoDashboardError(error)) {
        return [];
      }
      throw error;
    } finally {
      client.release();
    }
  },

  execute_get_meu_perfil: async (usuario_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_meu_perfil(), [usuario_id, empresa_id]);
      return ret.rows?.[0] || null;
    } finally {
      client.release();
    }
  },

  execute_salvar_meu_perfil: async ({
    usuario_id,
    empresa_id,
    nome,
    email,
    telefone,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      const normalizedName = String(nome || "").trim();
      if (!normalizedName) {
        throw new Error("Informe o nome do usuario.");
      }
      const normalizedEmail = await ensureUsuarioEmailDisponivel(
        client,
        email,
        usuario_id
      );
      const normalizedTelefone = normalizeNullableText(telefone);
      const ret = await client.query(models.update_meu_perfil(), [
        usuario_id,
        empresa_id,
        normalizedName,
        normalizedEmail,
        normalizedTelefone,
      ]);
      const perfil = ret.rows?.[0] || null;

      if (!perfil) {
        throw new Error("Usuario nao encontrado para esta empresa.");
      }

      const auth = await getUsuarioAuthPayload(client, usuario_id, empresa_id);
      await client.query("COMMIT");

      return { perfil, auth };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_alterar_minha_senha: async ({
    usuario_id,
    empresa_id,
    senha_atual,
    nova_senha,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      const currentPasswordRet = await client.query(models.get_usuario_senha_hash(), [
        usuario_id,
        empresa_id,
      ]);
      const usuario = currentPasswordRet.rows?.[0] || null;

      if (!usuario) {
        throw new Error("Usuario nao encontrado para esta empresa.");
      }

      if (!security.verifyPassword(String(senha_atual || ""), usuario.senha).ok) {
        throw new Error("Senha atual incorreta.");
      }

      const normalizedPassword = validatePasswordPolicy(nova_senha);
      await client.query(models.update_minha_senha(), [
        usuario_id,
        empresa_id,
        security.hashPassword(normalizedPassword),
      ]);

      const auth = await getUsuarioAuthPayload(client, usuario_id, empresa_id);
      await client.query("COMMIT");
      return { auth };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_desativar_minha_conta: async ({ usuario_id, empresa_id, senha_atual }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      const currentPasswordRet = await client.query(models.get_usuario_senha_hash(), [
        usuario_id,
        empresa_id,
      ]);
      const usuario = currentPasswordRet.rows?.[0] || null;

      if (!usuario) {
        throw new Error("Usuario nao encontrado para esta empresa.");
      }

      if (!security.verifyPassword(String(senha_atual || ""), usuario.senha).ok) {
        throw new Error("Senha atual incorreta.");
      }

      const ret = await client.query(models.desativar_minha_conta(), [usuario_id, empresa_id]);
      const usuarioDesativado = ret.rows?.[0] || null;

      if (!usuarioDesativado) {
        throw new Error("Nao foi possivel desativar a conta.");
      }

      await client.query("COMMIT");
      return usuarioDesativado;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_excluir_minha_conta: async ({ usuario_id, empresa_id, senha_atual }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      const contextRet = await client.query(models.get_exclusao_conta_contexto(), [
        usuario_id,
        empresa_id,
      ]);
      const usuario = contextRet.rows?.[0] || null;
      if (!usuario) throw new Error("Usuario nao encontrado para esta empresa.");
      if (!security.verifyPassword(String(senha_atual || ""), usuario.senha).ok) {
        throw new Error("Senha atual incorreta.");
      }

      const isLastMaster = Boolean(usuario.is_master) && Number(usuario.masters_ativos) <= 1;
      if (isLastMaster && Boolean(usuario.assinatura_ativa)) {
        throw new Error("O ultimo usuario master nao pode excluir a conta enquanto houver assinatura ativa. Cancele a assinatura ou transfira o perfil master.");
      }
      if (isLastMaster && Number(usuario.usuarios_ativos) > 1) {
        throw new Error("Transfira o perfil master para outro usuario antes de excluir sua conta.");
      }

      await client.query(models.delete_push_tokens_usuario(), [usuario_id, empresa_id]);
      await client.query(models.delete_usuario_meta_numeros_exclusao(), [usuario_id]);
      const randomPassword = security.hashPassword(crypto.randomBytes(32).toString("hex"));
      const deletedRet = await client.query(models.anonimizar_excluir_minha_conta(), [
        usuario_id,
        empresa_id,
        randomPassword,
      ]);
      if (!deletedRet.rows.length) throw new Error("Nao foi possivel excluir a conta.");
      await client.query("COMMIT");
      return {
        ...deletedRet.rows[0],
        foto_perfil_path_bunny: usuario.foto_perfil_path_bunny || null,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_salvar_foto_perfil: async ({
    usuario_id,
    empresa_id,
    nome_arquivo,
    url,
    path_bunny,
    mime_type,
    tamanho_bytes,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      const atual = await client.query(models.get_meu_perfil(), [usuario_id, empresa_id]);
      const perfilAtual = atual.rows?.[0] || null;
      if (!perfilAtual) {
        throw new Error("Usuario nao encontrado para esta empresa.");
      }

      const ret = await client.query(models.update_foto_perfil_usuario(), [
        usuario_id,
        empresa_id,
        url,
        path_bunny,
        nome_arquivo,
        mime_type,
        tamanho_bytes,
      ]);
      const perfil = ret.rows?.[0] || null;
      const auth = await getUsuarioAuthPayload(client, usuario_id, empresa_id);
      await client.query("COMMIT");

      return {
        perfil,
        auth,
        previous_path_bunny: perfilAtual.foto_perfil_path_bunny || null,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_remover_foto_perfil: async ({ usuario_id, empresa_id }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      const atual = await client.query(models.get_meu_perfil(), [usuario_id, empresa_id]);
      const perfilAtual = atual.rows?.[0] || null;
      if (!perfilAtual) {
        throw new Error("Usuario nao encontrado para esta empresa.");
      }

      const ret = await client.query(models.limpar_foto_perfil_usuario(), [
        usuario_id,
        empresa_id,
      ]);
      const perfil = ret.rows?.[0] || null;
      const auth = await getUsuarioAuthPayload(client, usuario_id, empresa_id);
      await client.query("COMMIT");

      return {
        perfil,
        auth,
        previous_path_bunny: perfilAtual.foto_perfil_path_bunny || null,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_ultimos_clientes_novos: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_ultimos_clientes_novos(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_nps_geral: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_nps_geral(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_nps_media_ultimos_5_atendimentos: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_nps_media_ultimos_5_atendimentos(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_nps_por_atendente: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_nps_por_atendente(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_nps_notas_ultimos_5_por_pergunta: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_nps_notas_ultimos_5_por_pergunta(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_crm_resumo: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_crm_resumo(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_crm_funil_por_etapa: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_crm_funil_por_etapa(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dashboard_crm_top_responsaveis: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.get_dashboard_crm_top_responsaveis(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },
};
module.exports = execute;
