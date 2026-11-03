const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const { requireTenantOwnership, requireMasterOrPermission } = require("../security/tenant_guard");
const execute = require("../services/execute_atendimento");
const executeUser = require("../services/execute_user");
const executeVendas = require("../services/execute_vendas");
const executeAppSafety = require("../services/execute_app_safety");
const utils = require("../utils/templates");
const sendEmail = require("../server/email");
const { notifyChatUpdate } = require("../server/realtime");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const bunny = require("../utils/bunny_config");
const {
  buildNpsLink,
  getExtension,
  buildConversaTranscript,
  gerarAnaliseAtendimentoComOpenAI,
  gerarAssistenciaConversaoComOpenAI,
  corrigirTextoChatComOpenAI,
  selectRelevantProductsForConversation,
} = require("../functions/function_atendimento");
const {
  shouldSendLeadStartedAutoMessage,
} = require("../functions/function_meta");

const META_WINDOW_EXPIRED_MESSAGE =
  "A janela de 24h da Meta expirou para esta conversa. Reative o atendimento com um template antes de enviar novas mensagens.";
const TEMPLATE_REPLY_PENDING_MESSAGE =
  "Aguarde o cliente responder ao template para continuar o atendimento.";
const CHAT_MANAGER_PERMISSION = "chat.manager";
const CHAT_VIEW_ALL_MESSAGES_PERMISSION = "chat.view_all_messages";
const USER_ATTENDANCE_ACCESS_CACHE_TTL_MS = Math.max(
  Number(process.env.USER_ATTENDANCE_ACCESS_CACHE_TTL_MS || 15000) || 15000,
  1000
);
const USER_ATTENDANCE_ACCESS_STALE_TTL_MS = Math.max(
  Number(process.env.USER_ATTENDANCE_ACCESS_STALE_TTL_MS || 300000) || 300000,
  USER_ATTENDANCE_ACCESS_CACHE_TTL_MS
);
const userAttendanceAccessCache = new Map();
const META_CHAT_DOWNLOAD_LINK_EXTENSIONS = new Set(["zip", "rar", "7z", "dwg"]);
const META_CHAT_DOWNLOAD_LINK_MIME_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/x-rar",
  "application/x-7z-compressed",
  "application/x-7zip-compressed",
  "application/acad",
  "application/x-acad",
  "application/autocad_dwg",
  "application/dwg",
  "application/x-dwg",
  "image/vnd.dwg",
]);
const META_CHAT_MAX_HOSTED_FILE_BYTES = 100 * 1024 * 1024;
const META_CHAT_DIRECT_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const META_CHAT_DIRECT_VIDEO_MIMES = new Set(["video/mp4", "video/3gpp"]);
const META_CHAT_DIRECT_AUDIO_MIMES = new Set(["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"]);
const META_CHAT_DIRECT_DOCUMENT_MIMES = new Set([
  "text/plain", "application/pdf", "application/vnd.ms-powerpoint", "application/msword",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function getMetaChatMediaSizeLimit(file) {
  const mime = String(file?.mimetype || "").trim().toLowerCase();
  if (mime === "image/webp") return 100 * 1024;
  if (mime.startsWith("image/")) return 5 * 1024 * 1024;
  if (mime.startsWith("video/") || mime.startsWith("audio/")) return 16 * 1024 * 1024;
  return 100 * 1024 * 1024;
}

function buildForbiddenResponse(message) {
  return utils.jsonMount(
    false,
    {},
    message || "Voce nao tem permissao para acessar este atendimento."
  );
}

function normalizeAllowedMetaParamIds(rows = []) {
  return [...new Set(
    (rows || [])
      .map((row) => Number(row?.empresa_meta_param_id))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
}

function getUserAttendanceAccessCacheKey(
  empresaId,
  usuarioId,
  payloadPermissions = []
) {
  const hasManagerPermission = Array.isArray(payloadPermissions)
    ? payloadPermissions.includes(CHAT_MANAGER_PERMISSION)
    : false;
  return `${Number(empresaId) || 0}:${Number(usuarioId) || 0}:${
    hasManagerPermission ? 1 : 0
  }`;
}

function cloneUserAttendanceAccessCacheValue(value = null) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    ...value,
    userContext:
      value.userContext && typeof value.userContext === "object"
        ? { ...value.userContext }
        : value.userContext,
    allowedMetaParamIds: Array.isArray(value.allowedMetaParamIds)
      ? [...value.allowedMetaParamIds]
      : [],
  };
}

function readUserAttendanceAccessCache(cacheKey, { allowStale = false } = {}) {
  const cached = userAttendanceAccessCache.get(cacheKey);
  if (!cached) return null;

  const ageMs = Date.now() - Number(cached.cachedAt || 0);
  const maxAgeMs = allowStale
    ? USER_ATTENDANCE_ACCESS_STALE_TTL_MS
    : USER_ATTENDANCE_ACCESS_CACHE_TTL_MS;

  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeMs) {
    userAttendanceAccessCache.delete(cacheKey);
    return null;
  }

  return cloneUserAttendanceAccessCacheValue(cached.value);
}

function writeUserAttendanceAccessCache(cacheKey, value) {
  userAttendanceAccessCache.set(cacheKey, {
    cachedAt: Date.now(),
    value: cloneUserAttendanceAccessCacheValue(value),
  });

  if (userAttendanceAccessCache.size <= 1000) {
    return;
  }

  const now = Date.now();
  for (const [key, entry] of userAttendanceAccessCache.entries()) {
    if (
      !entry?.cachedAt ||
      now - Number(entry.cachedAt) > USER_ATTENDANCE_ACCESS_STALE_TTL_MS
    ) {
      userAttendanceAccessCache.delete(key);
    }
  }
}

function isTransientAttendanceAccessConnectionError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toUpperCase();

  return (
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("server closed the connection unexpectedly") ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "57P01"
  );
}

function normalizeAtendimentoConfig(row = null) {
  const queueActive = Boolean(row?.atendimento_fila_automatica_ativa);
  const queueUsers = Array.isArray(row?.atendimento_fila_usuarios)
    ? [...new Set(
        row.atendimento_fila_usuarios
          .map((value) => Number(value || 0))
          .filter((value) => Number.isInteger(value) && value > 0)
      )]
    : [];

  return {
    atendimento_lista_atribuida_adm: queueActive
      ? false
      : Boolean(row?.atendimento_lista_atribuida_adm),
    atendimento_mensagens_rapidas_ativas:
      row?.atendimento_mensagens_rapidas_ativas === undefined
        ? true
        : Boolean(row?.atendimento_mensagens_rapidas_ativas),
    atendimento_disparo_nps_ativo:
      row?.atendimento_disparo_nps_ativo === undefined
        ? true
        : Boolean(row?.atendimento_disparo_nps_ativo),
    atendimento_fila_automatica_ativa: queueActive,
    atendimento_fila_usuarios: queueUsers,
  };
}

function normalizeQueueUserIds(values = []) {
  if (!Array.isArray(values)) return [];

  return [...new Set(
    values
      .map((value) => Number(value || 0))
      .filter((value) => Number.isInteger(value) && value > 0)
  )];
}

function isQuickMessagesGalleryMigrationMissing(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();

  if (!["42P01", "42703"].includes(code)) {
    return false;
  }

  return (
    message.includes("empresa_galeria_imagem") ||
    message.includes("galeria_imagem_id") ||
    message.includes("empresa_galeria_documento") ||
    message.includes("galeria_documento_id") ||
    message.includes("empresa_galeria_audio") ||
    message.includes("galeria_audio_id") ||
    message.includes("usar_texto_como_legenda")
  );
}

function isContactDocumentMigrationMissing(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();

  if (!["42P01", "42703"].includes(code)) {
    return false;
  }

  return message.includes("cliente_documento");
}

function getContactDocumentMigrationMessage() {
  return "A estrutura de documentos do contato ainda nao foi criada no banco. Execute o alter_db.txt para liberar anexos por cliente.";
}

function validateContactDocumentFile(file) {
  if (!file) {
    throw new Error("Nenhum documento foi enviado.");
  }
  if (Number(file.size || 0) > 20 * 1024 * 1024) {
    throw new Error("O documento deve ter no maximo 20MB.");
  }
}

async function ensureContactDocumentLimit(empresaId, clienteId) {
  const total = await execute.execute_count_cliente_documentos(clienteId, empresaId);
  if (total >= 3) {
    throw new Error(
      "Cada cliente pode ter no maximo 3 documentos ativos. Remova um documento antes de enviar outro."
    );
  }
}

function buildStartAttendanceMessage(attendantName, customText = null) {
  const normalizedAttendantName = String(attendantName || "").trim() || "atendente";
  const fallbackMessage = `Olá, sou ${normalizedAttendantName} e irei lhe atender hoje. Como posso ajuda-lo?`;
  const normalizedCustomText = String(customText || "").trim();

  if (!normalizedCustomText) {
    return fallbackMessage;
  }

  return normalizedCustomText.replace(
    /\{\{\s*(nome_atendente|atendente)\s*\}\}|\{\s*(nome_atendente|atendente)\s*\}/gi,
    normalizedAttendantName
  );
}

function hasEffectiveUserPermission(
  userContext = null,
  permission,
  payloadPermissions = []
) {
  if (!permission) return false;
  if (Boolean(userContext?.is_master)) return true;
  if (
    Array.isArray(payloadPermissions) &&
    payloadPermissions.includes(permission)
  ) {
    return true;
  }

  const userPermissions = Array.isArray(userContext?.permissoes_customizadas)
    ? userContext.permissoes_customizadas
    : [];
  const planPermissions = Array.isArray(userContext?.permissoes_plano)
    ? userContext.permissoes_plano
    : [];

  return (
    userPermissions.includes(permission) || planPermissions.includes(permission)
  );
}

function isAttendanceManager(userContext = null, payloadPermissions = []) {
  return hasEffectiveUserPermission(
    userContext,
    CHAT_MANAGER_PERMISSION,
    payloadPermissions
  );
}

function getFileExtensionFromName(filename) {
  const normalized = String(filename || "").trim().toLowerCase();
  const ext = path.extname(normalized).replace(/^\./, "");
  return ext;
}

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function buildPublicSystemBaseUrl(req) {
  const configuredBaseUrl = normalizeBaseUrl(
    process.env.PUBLIC_WEB_BASE_URL ||
      process.env.APP_WEB_BASE_URL ||
      process.env.PORTAL_BASE_URL
  );

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const host = String(req.get("host") || "").trim();
  if (host) {
    return `${req.protocol}://${host}`;
  }

  return "http://localhost:5173"; // APP_WEB_BASE_URL acima tem prioridade
}

function buildChatMediaProxyLink(req, filePath, fileName, mimeType) {
  const token = security.generateChatMediaPublicToken({
    path_bunny: filePath,
    file_name: fileName,
  });
  return `${buildPublicSystemBaseUrl(req)}/web/m/${encodeURIComponent(token)}`;
}

function isAllowedMetaReferralMediaUrl(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return false;

  try {
    const parsedUrl = new URL(normalizedValue);
    const protocol = String(parsedUrl.protocol || "").toLowerCase();
    const host = String(parsedUrl.hostname || "").toLowerCase();

    if (!["http:", "https:"].includes(protocol)) {
      return false;
    }

    return (
      host.endsWith(".fbcdn.net") ||
      host === "fbcdn.net" ||
      host.endsWith(".facebook.com") ||
      host === "facebook.com"
    );
  } catch (_error) {
    return false;
  }
}

function getAllowedExternalMediaHosts() {
  const configuredHosts = String(
    process.env.BUNNY_CDN_ALLOWED_HOSTS || process.env.BUNNY_CDN_HOST || ""
  )
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return new Set([
    String(bunny.hostGet || "").trim().toLowerCase(),
    ...configuredHosts,
  ].filter(Boolean));
}

function isAllowedExternalMediaUrl(value, empresaId) {
  const normalizedValue = String(value || "").trim();
  const normalizedEmpresaId = Number(empresaId);
  if (
    !normalizedValue ||
    !Number.isInteger(normalizedEmpresaId) ||
    normalizedEmpresaId <= 0
  ) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    const host = String(parsedUrl.hostname || "").toLowerCase();
    const companyPathMarker = `/empresa_${normalizedEmpresaId}/`;

    return (
      parsedUrl.protocol === "https:" &&
      !parsedUrl.username &&
      !parsedUrl.password &&
      (!parsedUrl.port || parsedUrl.port === "443") &&
      getAllowedExternalMediaHosts().has(host) &&
      decodeURIComponent(parsedUrl.pathname).includes(companyPathMarker)
    );
  } catch (_error) {
    return false;
  }
}

function validateChatMediaUploadFile(file) {
  if (Number(file?.size || 0) > META_CHAT_MAX_HOSTED_FILE_BYTES) {
    throw new Error("O arquivo deve ter no maximo 100MB.");
  }
  const mime = String(file?.mimetype || "").trim().toLowerCase();
  if (
    mime === "image/webp" ||
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/")
  ) {
    return;
  }
}

function resolveUploadMediaErrorMessage(error) {
  const explicitMessage = String(error?.message || "").trim();

  const metaMessage =
    error?.response?.data?.error?.error_user_msg ||
    error?.response?.data?.error?.error_data?.details ||
    error?.response?.data?.error?.message ||
    "";
  if (String(metaMessage || "").trim()) {
    return String(metaMessage).trim();
  }

  const jsonStart = explicitMessage.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(explicitMessage.slice(jsonStart));
      const parsedMessage =
        parsed?.error?.error_user_msg ||
        parsed?.error?.error_data?.details ||
        parsed?.error?.message ||
        "";
      if (String(parsedMessage || "").trim()) {
        return String(parsedMessage).trim();
      }
    } catch (_error) {
      // Ignore JSON parsing failures and fall back to the generic message.
    }
  }

  return "Nao foi possivel enviar o arquivo pelo WhatsApp. Verifique se o formato e suportado pela Meta.";
}

function shouldSendChatMediaAsDownloadLink(file) {
  const mime = String(file?.mimetype || "").trim().toLowerCase();
  const extension = getFileExtensionFromName(file?.originalname);
  const unsupportedDirectMedia = mime.startsWith("image/")
    ? !META_CHAT_DIRECT_IMAGE_MIMES.has(mime)
    : mime.startsWith("video/")
      ? !META_CHAT_DIRECT_VIDEO_MIMES.has(mime)
      : mime.startsWith("audio/")
        ? !META_CHAT_DIRECT_AUDIO_MIMES.has(mime)
        : !META_CHAT_DIRECT_DOCUMENT_MIMES.has(mime);
  return (
    Number(file?.size || 0) > getMetaChatMediaSizeLimit(file) ||
    unsupportedDirectMedia ||
    META_CHAT_DOWNLOAD_LINK_EXTENSIONS.has(extension) ||
    META_CHAT_DOWNLOAD_LINK_MIME_TYPES.has(mime)
  );
}

function buildChatDownloadLinkMessage(fileName) {
  return (
    String(fileName || "arquivo")
      .replace(/\.[^/.]+$/, "")
      .trim() || "arquivo"
  );
}

async function uploadChatFileAndSendDownloadLink({
  req,
  file,
  numero,
  caption,
  conversaId,
  empresaId,
  usuarioId,
}) {
  const absolutePath = path.resolve(file.path);
  const fallbackPath = bunny.generateFileName(
    file.originalname || "arquivo",
    `chat_media_${conversaId}`
  );
  let uploaded = null;

  try {
    const fileBuffer = fs.readFileSync(absolutePath);
    uploaded = await bunny.uploadFile(fallbackPath, fileBuffer);
    const proxyUrl = buildChatMediaProxyLink(
      req,
      fallbackPath,
      file.originalname || "arquivo",
      file.mimetype || null
    );
    const message = buildChatDownloadLinkMessage(
      file.originalname || "arquivo"
    );
    const sendResult = await utils.sendWhatsappButtonMessage(
      numero,
      message,
      proxyUrl,
      conversaId,
      empresaId,
      usuarioId,
      "Baixar"
    );
    if (!sendResult?.messages?.[0]?.id) {
      throw new Error("Nao foi possivel enviar a mensagem com o botao de download.");
    }
  } catch (error) {
    if (uploaded?.file) {
      await bunny.deleteFile(fallbackPath).catch(() => null);
    }
    throw error;
  } finally {
    fs.unlink(absolutePath, (unlinkError) => {
      if (unlinkError && unlinkError.code !== "ENOENT") {
        console.error("Erro ao apagar arquivo local do fallback por link:", unlinkError);
      }
    });
  }
}

async function shouldSendConversationAutoMessages(conversa = null) {
  if (!conversa) {
    return true;
  }

  try {
    return await shouldSendLeadStartedAutoMessage({
      empresaId: conversa.empresa_id,
      clienteId: conversa.cliente_id || null,
      numero: conversa.cliente_telefone || conversa.telefone || null,
      empresaMetaParamId: conversa.empresa_meta_param_id || null,
      conversaId: conversa.id || null,
    });
  } catch (error) {
    console.warn(
      "[atendimento] falha ao validar regra de mensagens automaticas do disparo:",
      error?.message || error
    );
    return true;
  }
}

async function getEmpresaAtendimentoConfig(empresaId) {
  const normalizedEmpresaId = Number(empresaId);
  if (!Number.isInteger(normalizedEmpresaId) || normalizedEmpresaId <= 0) {
    return normalizeAtendimentoConfig();
  }

  const rows = await execute.execute_get_empresa_atendimento_config(
    normalizedEmpresaId
  );
  return normalizeAtendimentoConfig(rows?.[0] || null);
}

function hasWaitingConversationExceeded24Hours(conversa = null) {
  return (
    Number(conversa?.status_id) === 0 &&
    conversa?.data_fim === null &&
    Boolean(conversa?.fila_mais_24h)
  );
}

function normalizeConversationSearchStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["active", "waiting", "finished"].includes(normalized)
    ? normalized
    : null;
}

function normalizeConversationSearchOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function normalizeConversationFinishedFilterDate(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function parseConversationSearchDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveConversationSearchAttendantId(conversa = null) {
  if (!conversa) return null;
  const rawId =
    conversa.status === "waiting"
      ? conversa.usuario_atribuido_id ?? conversa.usuario_id ?? null
      : conversa.usuario_id ?? conversa.usuario_atribuido_id ?? null;
  const normalizedId = Number(rawId);
  return Number.isInteger(normalizedId) && normalizedId > 0 ? normalizedId : null;
}

function matchesConversationSearchAttendant(conversa = null, selectedFilter = "") {
  const normalizedFilter = String(selectedFilter || "").trim();
  if (!normalizedFilter) return true;

  const attendantId = resolveConversationSearchAttendantId(conversa);
  if (normalizedFilter === "unassigned") {
    return attendantId === null;
  }

  const selectedId = Number(normalizedFilter);
  if (Number.isInteger(selectedId) && selectedId > 0) {
    return attendantId === selectedId;
  }

  return true;
}

function matchesConversationSearchMetaNumber(
  conversa = null,
  selectedMetaNumberFilter = ""
) {
  const normalizedFilter = String(selectedMetaNumberFilter || "").trim();
  if (!normalizedFilter) return true;
  return String(conversa?.meta_numero_conta || "").trim() === normalizedFilter;
}

function buildConversationSearchTimestamp(conversa = null, matchedMessage = null) {
  return (
    matchedMessage?.data_mensagem ||
    conversa?.ultima_atualizacao ||
    conversa?.data_inicio ||
    conversa?.fila_desde ||
    null
  );
}

function compareConversationSearchResults(left, right) {
  const leftTimestamp = parseConversationSearchDate(
    left?.search_match_timestamp || left?.ultima_atualizacao
  );
  const rightTimestamp = parseConversationSearchDate(
    right?.search_match_timestamp || right?.ultima_atualizacao
  );
  const leftTime = leftTimestamp ? leftTimestamp.getTime() : 0;
  const rightTime = rightTimestamp ? rightTimestamp.getTime() : 0;

  if (rightTime !== leftTime) {
    return rightTime - leftTime;
  }

  return Number(right?.id || 0) - Number(left?.id || 0);
}

async function getUsuarioAtendimentoAccessByEmpresa(
  empresaId,
  usuarioId,
  payloadPermissions = []
) {
  const normalizedEmpresaId = Number(empresaId);
  const normalizedUsuarioId = Number(usuarioId);

  if (!Number.isInteger(normalizedEmpresaId) || normalizedEmpresaId <= 0) {
    return {
      blocked: true,
      response: utils.jsonMount(false, {}, "Informe empresa_id valido."),
    };
  }

  if (!Number.isInteger(normalizedUsuarioId) || normalizedUsuarioId <= 0) {
    return {
      blocked: true,
      response: utils.jsonMount(false, {}, "Informe usuario_id valido."),
    };
  }

  const cacheKey = getUserAttendanceAccessCacheKey(
    normalizedEmpresaId,
    normalizedUsuarioId,
    payloadPermissions
  );
  const cachedAccess = readUserAttendanceAccessCache(cacheKey);
  if (cachedAccess) {
    return cachedAccess;
  }

  let userRows;
  try {
    userRows = await execute.execute_get_usuario_atendimento_contexto(
      normalizedUsuarioId,
      normalizedEmpresaId
    );
  } catch (error) {
    const staleCachedAccess = readUserAttendanceAccessCache(cacheKey, {
      allowStale: true,
    });
    if (staleCachedAccess && isTransientAttendanceAccessConnectionError(error)) {
      console.warn(
        "[atendimento/access] usando cache local por indisponibilidade temporaria do pool:",
        {
          empresa_id: normalizedEmpresaId,
          usuario_id: normalizedUsuarioId,
          message: error?.message || String(error),
        }
      );
      return staleCachedAccess;
    }
    throw error;
  }

  const userContext = userRows?.[0] || null;

  if (!userContext) {
    const notFoundResponse = {
      blocked: true,
      response: utils.jsonMount(
        false,
        {},
        "Usuario nao encontrado para esta empresa."
      ),
    };
    writeUserAttendanceAccessCache(cacheKey, notFoundResponse);
    return notFoundResponse;
  }

  const attendanceManager = isAttendanceManager(
    userContext,
    payloadPermissions
  );

  if (Boolean(userContext.is_master) || attendanceManager) {
    const managerAccess = {
      blocked: false,
      userContext,
      empresaId: normalizedEmpresaId,
      usuarioId: normalizedUsuarioId,
      isAttendanceManager: true,
      allowedMetaParamIds: [],
    };
    writeUserAttendanceAccessCache(cacheKey, managerAccess);
    return managerAccess;
  }

  const allowedRows = await execute.execute_list_usuario_meta_numero_ids(
    normalizedUsuarioId,
    normalizedEmpresaId
  );

  const scopedAccess = {
    blocked: false,
    userContext,
    empresaId: normalizedEmpresaId,
    usuarioId: normalizedUsuarioId,
    isAttendanceManager: false,
    allowedMetaParamIds: normalizeAllowedMetaParamIds(allowedRows),
  };
  writeUserAttendanceAccessCache(cacheKey, scopedAccess);
  return scopedAccess;
}

async function getConversaAccessContext(conversaId, usuarioId, options = {}) {
  const skipMetaNumberAccessCheck = Boolean(
    options?.skipMetaNumberAccessCheck
  );
  const payloadPermissions = Array.isArray(options?.payloadPermissions)
    ? options.payloadPermissions
    : [];
  const normalizedConversaId = Number(conversaId);
  if (!Number.isInteger(normalizedConversaId) || normalizedConversaId <= 0) {
    return {
      blocked: true,
      response: utils.jsonMount(false, {}, "Informe conversa_id valido."),
    };
  }

  const conversaRows = await execute.execute_get_conversa_contexto_acesso(
    normalizedConversaId
  );
  const conversa = conversaRows?.[0] || null;

  if (!conversa) {
    return {
      blocked: true,
      response: utils.jsonMount(false, {}, "Conversa nao encontrada."),
    };
  }

  const userAccess = await getUsuarioAtendimentoAccessByEmpresa(
    conversa.empresa_id,
    usuarioId,
    payloadPermissions
  );

  if (userAccess.blocked) {
    return userAccess;
  }

  if (Boolean(userAccess.isAttendanceManager)) {
    return {
      blocked: false,
      conversa,
      ...userAccess,
    };
  }

  if (!skipMetaNumberAccessCheck && !userAccess.allowedMetaParamIds.length) {
    return {
      blocked: true,
      response: buildForbiddenResponse(
        "Este usuario nao possui numeros da Meta liberados para atendimento."
      ),
    };
  }

  if (
    !skipMetaNumberAccessCheck &&
    !userAccess.allowedMetaParamIds.includes(Number(conversa.empresa_meta_param_id))
  ) {
    return {
      blocked: true,
      response: buildForbiddenResponse(
        "Voce nao pode atender conversas deste numero da Meta."
      ),
    };
  }

  if (
    Boolean(conversa.atendimento_lista_atribuida_adm) &&
    Number(conversa.status_id) === 0 &&
    Number(conversa.usuario_atribuido_id || 0) <= 0
  ) {
    return {
      blocked: true,
      response: buildForbiddenResponse(
        "Este atendimento ainda nao foi atribuido."
      ),
    };
  }

  if (
    Boolean(conversa.atendimento_lista_atribuida_adm) &&
    Number(conversa.status_id) === 0 &&
    Number(conversa.usuario_atribuido_id || 0) > 0 &&
    Number(conversa.usuario_atribuido_id) !== Number(userAccess.usuarioId)
  ) {
    return {
      blocked: true,
      response: buildForbiddenResponse(
        "Este atendimento foi atribuido para outro usuario."
      ),
    };
  }

  if (
    Number(conversa.status_id) === 1 &&
    conversa.usuario_id !== null &&
    Number(conversa.usuario_id) !== Number(userAccess.usuarioId)
  ) {
    return {
      blocked: true,
      response: buildForbiddenResponse(
        "Esta conversa ja esta em atendimento por outro usuario."
      ),
    };
  }

  if (
    Number(conversa.status_id) === 2 &&
    conversa.usuario_id !== null &&
    Number(conversa.usuario_id) !== Number(userAccess.usuarioId)
  ) {
    return {
      blocked: true,
      response: buildForbiddenResponse(
        "Voce nao pode acessar um atendimento finalizado por outro usuario."
      ),
    };
  }

  return {
    blocked: false,
    conversa,
    ...userAccess,
  };
}

async function getMetaWindowLockResponse(conversaId) {
  const normalizedConversaId = Number(conversaId);
  if (!Number.isInteger(normalizedConversaId) || normalizedConversaId <= 0) {
    return {
      blocked: true,
      response: utils.jsonMount(false, {}, "Informe conversa_id valido."),
    };
  }

  const rows = await execute.execute_get_conversa_janela_meta_envio(
    normalizedConversaId
  );
  const metaWindow = rows?.[0] || null;

  if (!metaWindow) {
    return {
      blocked: true,
      response: utils.jsonMount(false, {}, "Conversa nao encontrada."),
    };
  }

  if (metaWindow.janela_meta_aberta) {
    return { blocked: false, metaWindow };
  }

  const awaitingTemplateReply =
    Boolean(metaWindow.aguardando_resposta_template) &&
    !metaWindow.ultima_mensagem_cliente_em;

  return {
    blocked: true,
    response: utils.jsonMount(
      false,
      {
        conversa_id: normalizedConversaId,
        janela_meta_aberta: false,
        aguardando_resposta_template: awaitingTemplateReply,
        ultima_mensagem_cliente_em:
          metaWindow.ultima_mensagem_cliente_em || null,
        janela_meta_expira_em: metaWindow.janela_meta_expira_em || null,
      },
      awaitingTemplateReply
        ? TEMPLATE_REPLY_PENDING_MESSAGE
        : META_WINDOW_EXPIRED_MESSAGE
    ),
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "src/uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.CHAT_UPLOAD_MAX_BYTES || 100 * 1024 * 1024), files: 10 },
});
const contactDocumentUpload = multer({
  storage: multer.memoryStorage(),
});

rota.post("/finalizar_atendimento", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const access = await getConversaAccessContext(
      data.conversa_id,
      data.usuario_id
    );
    if (access.blocked) {
      return res.json(access.response);
    }

    const isWaitingConversation =
      Number(access.conversa?.status_id) === 0 && access.conversa?.data_fim === null;
    const waitingConversationExceeded24Hours =
      hasWaitingConversationExceeded24Hours(access.conversa);

    if (isWaitingConversation) {
      if (!Boolean(access.isAttendanceManager)) {
        return res.json(
          buildForbiddenResponse(
            "Apenas administradores podem finalizar atendimentos ainda aguardando na fila."
          )
        );
      }

      if (!waitingConversationExceeded24Hours) {
        return res.json(
          utils.jsonMount(
            false,
            {},
            "Somente atendimentos aguardando ha mais de 24 horas podem ser finalizados pela fila."
          )
        );
      }
    } else if (Number(access.conversa?.status_id) !== 1) {
      return res.json(
        utils.jsonMount(false, {}, "Somente atendimentos ativos podem ser finalizados.")
      );
    }

    if (waitingConversationExceeded24Hours) {
      await execute.execute_finalizar_atendimento(data.conversa_id);
      notifyChatUpdate({
        empresa_id: access.empresaId,
        conversa_id: data.conversa_id,
        tipo: "status",
        origem: "atendimento:finalizar:fila",
      });
      return res.json(
        utils.jsonMount(
          true,
          {},
          "Atendimento aguardando ha mais de 24 horas finalizado com sucesso."
        )
      );
    }

    const number = await execute.execute_get_number(data.conversa_id);
    const parametrosWhats = await execute.execute_get_paramentros_whats(
      access.empresaId
    );
    const atendimentoConfig = await getEmpresaAtendimentoConfig(access.empresaId);
    const shouldSendAutoMessages = await shouldSendConversationAutoMessages(
      access.conversa
    );

    await execute.execute_finalizar_atendimento(data.conversa_id);
    notifyChatUpdate({
      empresa_id: access.empresaId,
      conversa_id: data.conversa_id,
      tipo: "status",
      origem: "atendimento:finalizar",
    });

    if (shouldSendAutoMessages) {
      const mensagemFinal = await execute.execute_get_mensagem_automatica_whatsapp(
        access.empresaId,
        2,
        access.conversa?.empresa_meta_param_id || null
      );
      const mensagemFinalConfig = mensagemFinal?.[0] || null;

      if (mensagemFinalConfig?.habilitada === false) {
        console.log(
          "[/finalizar_atendimento] mensagem final desativada",
          JSON.stringify({
            empresa_id: access.empresaId,
            conversa_id: data.conversa_id,
            cliente_id: access.conversa?.cliente_id || null,
            empresa_meta_param_id: access.conversa?.empresa_meta_param_id || null,
          })
        );
      } else {
        const textoFinal =
          mensagemFinalConfig?.texto ||
          `Atendimento finalizado com sucesso. A equipe da ${
            parametrosWhats[0]?.empresa_nome || "nossa empresa"
          } agradece o seu contato!`;

        await utils.sendWhatsappMessage(
          number[0].number_phone_id,
          textoFinal,
          data.conversa_id,
          textoFinal,
          access.empresaId
        );
      }

      if (atendimentoConfig.atendimento_disparo_nps_ativo) {
        const mensagemNps = await execute.execute_get_mensagem_automatica_whatsapp(
          access.empresaId,
          3,
          access.conversa?.empresa_meta_param_id || null
        );
        const mensagemNpsConfig = mensagemNps?.[0] || null;
        if (mensagemNpsConfig?.habilitada === false) {
          console.log(
            "[/finalizar_atendimento] mensagem NPS desativada",
            JSON.stringify({
              empresa_id: access.empresaId,
              conversa_id: data.conversa_id,
              cliente_id: access.conversa?.cliente_id || null,
              empresa_meta_param_id:
                access.conversa?.empresa_meta_param_id || null,
            })
          );
        } else {
          const textoNps =
            mensagemNpsConfig?.texto ||
            `Sua opinião é muito importante para nós. Avalie seu atendimento no botão abaixo.`;
          const npsLink = buildNpsLink(req, data.conversa_id);
          await utils.sendWhatsappButtonMessage(
            number[0].number_phone_id,
            textoNps,
            npsLink,
            data.conversa_id,
            access.empresaId
          );
        }
      }
    } else {
      console.log(
        "[/finalizar_atendimento] mensagens automaticas ignoradas por configuracao do disparo",
        JSON.stringify({
          empresa_id: access.empresaId,
          conversa_id: data.conversa_id,
          cliente_id: access.conversa?.cliente_id || null,
        })
      );
    }
    return res.json(utils.jsonMount(true, {}, "Atendimento finalizado"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/finalizar_atendimento"));
  }
});

rota.post("/finalizar_atendimento_fila", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const access = await getConversaAccessContext(
      data.conversa_id,
      data.usuario_id
    );
    if (access.blocked) {
      return res.json(access.response);
    }

    if (!Boolean(access.isAttendanceManager)) {
      return res.json(
        buildForbiddenResponse(
          "Apenas administradores podem finalizar atendimentos da fila."
        )
      );
    }

    const isWaitingConversation =
      Number(access.conversa?.status_id) === 0 && access.conversa?.data_fim === null;
    if (!isWaitingConversation) {
      return res.json(
        utils.jsonMount(false, {}, "Somente atendimentos aguardando podem ser finalizados pela fila.")
      );
    }

    await execute.execute_finalizar_atendimento(data.conversa_id);
    notifyChatUpdate({
      empresa_id: access.empresaId,
      conversa_id: data.conversa_id,
      tipo: "status",
      origem: "atendimento:finalizar:fila:silencioso",
    });
    return res.json(
      utils.jsonMount(true, {}, "Atendimento da fila finalizado com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/finalizar_atendimento_fila"));
  }
});

rota.post("/finalizar_atendimentos_fila_expirados", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const userAccess = await getUsuarioAtendimentoAccessByEmpresa(
      data.empresa_id,
      data.usuario_id
    );
    if (userAccess.blocked) {
      return res.json(userAccess.response);
    }

    if (!Boolean(userAccess.isAttendanceManager)) {
      return res.json(
        buildForbiddenResponse(
          "Apenas administradores podem finalizar em lote os atendimentos da fila."
        )
      );
    }

    const finalizedRows =
      await execute.execute_finalize_waiting_atendimentos_older_than_hours_by_empresa(
        userAccess.empresaId,
        48
      );
    const finalizedIds = Array.isArray(finalizedRows)
      ? finalizedRows
          .map((row) => Number(row?.id || 0))
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];

    finalizedIds.forEach((conversaId) => {
      notifyChatUpdate({
        empresa_id: userAccess.empresaId,
        conversa_id: conversaId,
        tipo: "status",
        origem: "atendimento:finalizar:fila:48h:lote",
      });
    });

    return res.json(
      utils.jsonMount(
        true,
        {
          total_finalizados: finalizedIds.length,
          conversa_ids: finalizedIds,
        },
        finalizedIds.length
          ? "Atendimentos aguardando ha mais de 48 horas finalizados com sucesso."
          : "Nenhum atendimento aguardando ha mais de 48 horas foi encontrado."
      )
    );
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/finalizar_atendimentos_fila_expirados")
    );
  }
});

rota.post("/iniciar_atendimento", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const access = await getConversaAccessContext(
      data.conversa_id,
      data.usuario_id
    );
    if (access.blocked) {
      return res.json(access.response);
    }

    const number = await execute.execute_iniciar_atendimento(
      data.conversa_id,
      data.usuario_id
    );
    if (!number?.length) {
      return res.json(
        utils.jsonMount(false, {}, "Nao foi possivel iniciar este atendimento.")
      );
    }
    if (Number.isInteger(Number(data.usuario_id)) && Number(data.usuario_id) > 0) {
      await execute.execute_marcar_conversa_lida_usuario(
        data.conversa_id,
        Number(data.usuario_id)
      );
    }
    if (Number.isInteger(Number(access.conversa?.cliente_id)) && Number(access.conversa?.cliente_id) > 0) {
      try {
        const crmAssumido = await executeVendas.execute_assumir_responsavel_cliente_crm({
          empresa_id: access.empresaId,
          cliente_id: access.conversa.cliente_id,
          usuario_id: data.usuario_id,
          userId: data.usuario_id,
        });
        if (!crmAssumido?.updated) {
          console.warn(
            "[/iniciar_atendimento] CRM nao atualizado para cliente:",
            access.conversa.cliente_id,
            crmAssumido?.reason || "no_rows"
          );
        }
      } catch (crmError) {
        console.warn("[/iniciar_atendimento] nao foi possivel assumir CRM:", crmError?.message || crmError);
      }

      try {
        await executeVendas.execute_aplicar_automacao_crm({
          empresa_id: access.empresaId,
          cliente_id: access.conversa.cliente_id,
          empresa_meta_param_id: access.conversa?.empresa_meta_param_id || null,
          usuario_id: data.usuario_id,
          action: "atendimento_iniciado",
        });
      } catch (crmAutomationError) {
        console.warn(
          "[/iniciar_atendimento] nao foi possivel aplicar automacao de CRM:",
          crmAutomationError?.message || crmAutomationError
        );
      }
    }
    notifyChatUpdate({
      empresa_id: access.empresaId,
      conversa_id: data.conversa_id,
      tipo: "status",
      origem: "atendimento:iniciar",
    });
    const numberPhoneId = String(number?.[0]?.number_phone_id || "").trim();

    if (numberPhoneId) {
      try {
        const shouldSendAutoMessages = await shouldSendConversationAutoMessages(
          access.conversa
        );

        if (shouldSendAutoMessages) {
          const mensagemInicioAtendimento =
            await execute.execute_get_mensagem_automatica_whatsapp(
              access.empresaId,
              5,
              access.conversa?.empresa_meta_param_id || null
            );
          const mensagemInicioConfig = mensagemInicioAtendimento?.[0] || null;
          if (mensagemInicioConfig?.habilitada === false) {
            console.log(
              "[/iniciar_atendimento] mensagem de inicio desativada",
              JSON.stringify({
                empresa_id: access.empresaId,
                conversa_id: data.conversa_id,
                cliente_id: access.conversa?.cliente_id || null,
                empresa_meta_param_id:
                  access.conversa?.empresa_meta_param_id || null,
              })
            );
          } else {
            const textoAtendimento = buildStartAttendanceMessage(
              data.nome_usuario,
              mensagemInicioConfig?.texto || null
            );
            await utils.sendWhatsappMessage(
              numberPhoneId,
              textoAtendimento,
              data.conversa_id,
              textoAtendimento,
              access.empresaId
            );
          }
        } else {
          console.log(
            "[/iniciar_atendimento] mensagem automatica ignorada por configuracao do disparo",
            JSON.stringify({
              empresa_id: access.empresaId,
              conversa_id: data.conversa_id,
              cliente_id: access.conversa?.cliente_id || null,
            })
          );
        }
      } catch (messageError) {
        console.warn(
          "[/iniciar_atendimento] atendimento iniciado sem mensagem automatica:",
          messageError?.message || messageError
        );
      }
    } else {
      console.warn(
        "[/iniciar_atendimento] atendimento iniciado sem number_phone_id para conversa:",
        data.conversa_id
      );
    }

    return res.json(utils.jsonMount(true, {}, "Atendimento iniciado"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/iniciar_atendimento"));
  }
});

rota.post("/carregar_conversas_usuario", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const userAccess = await getUsuarioAtendimentoAccessByEmpresa(
      data.empresa_id,
      data.usuario_id
    );
    if (userAccess.blocked) {
      return res.json(userAccess.response);
    }

    const finishedLimit = Math.min(
      Math.max(Number(data.finished_limit || 20) || 20, 1),
      1000
    );
    const finishedOffset = normalizeConversationSearchOffset(
      data.finished_offset
    );
    let finishedDateStart = normalizeConversationFinishedFilterDate(
      data.finished_date_start || data.finishedDateStart || data.data_inicio_finalizados
    );
    let finishedDateEnd = normalizeConversationFinishedFilterDate(
      data.finished_date_end || data.finishedDateEnd || data.data_fim_finalizados
    );
    if (finishedDateStart && finishedDateEnd && finishedDateStart > finishedDateEnd) {
      [finishedDateStart, finishedDateEnd] = [finishedDateEnd, finishedDateStart];
    }
    let result = [];
    let finishedRows = [];

    if (Boolean(userAccess.isAttendanceManager)) {
      const [openRows, finalizedRows] = await Promise.all([
        execute.execute_lista_conversas_empresa_ativas(
          userAccess.empresaId,
          userAccess.usuarioId
        ),
        execute.execute_lista_conversas_empresa_finalizadas(
          userAccess.empresaId,
          userAccess.usuarioId,
          finishedOffset,
          finishedLimit,
          finishedDateStart,
          finishedDateEnd
        ),
      ]);
      finishedRows = finalizedRows;
      result = openRows.concat(finalizedRows);
    } else {
      if (!userAccess.allowedMetaParamIds.length) {
        return res.json(
          utils.jsonMount(
            true,
            {
              items: [],
              finished_pagination: {
                limit: finishedLimit,
                offset: finishedOffset,
                loaded: 0,
                total: 0,
                has_more: false,
              },
            },
            ""
          )
        );
      }

      const [lista, openRows, finalizedRows] = await Promise.all([
        execute.execute_lista_aguardando_atendimento(
          userAccess.empresaId,
          userAccess.allowedMetaParamIds,
          userAccess.usuarioId
        ),
        execute.execute_lista_conversas_usuario_ativas(
          userAccess.usuarioId,
          userAccess.empresaId,
          userAccess.allowedMetaParamIds
        ),
        execute.execute_lista_conversas_usuario_finalizadas(
          userAccess.usuarioId,
          userAccess.empresaId,
          userAccess.allowedMetaParamIds,
          finishedOffset,
          finishedLimit,
          finishedDateStart,
          finishedDateEnd
        )
      ]);
      finishedRows = finalizedRows;
      result = openRows.concat(lista, finalizedRows);
    }

    const finishedTotal = Math.max(
      Number(
        finishedRows.find((conversation) =>
          Number.isInteger(Number(conversation?.status_total))
        )?.status_total || 0
      ),
      finishedRows.length
    );
    const sanitizedItems = result.map((conversation) => {
      const { status_total, ...conversationData } = conversation || {};
      return conversationData;
    });

    return res.json(
      utils.jsonMount(
        true,
        {
          items: sanitizedItems,
          finished_pagination: {
            limit: finishedLimit,
            offset: finishedOffset,
            loaded: finishedOffset + finishedRows.length,
            total: finishedTotal,
            has_more: finishedTotal > finishedOffset + finishedRows.length,
          },
        },
        ""
      )
    );
  } catch (error) {
    console.error(error);
    return res.json(utils.errorHandle(error, "/carregar_conversas_usuario"));
  }
});

rota.post("/buscar_conversas_usuario", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const pesquisa = String(data.pesquisa || "").trim();
    if (!pesquisa) {
      return res.json(
        utils.jsonMount(
          true,
          {
            items: [],
            has_more: false,
            next_offset: 0,
            limit: 20,
            total: 0,
          },
          ""
        )
      );
    }

    const userAccess = await getUsuarioAtendimentoAccessByEmpresa(
      data.empresa_id,
      data.usuario_id
    );
    if (userAccess.blocked) {
      return res.json(userAccess.response);
    }

    let conversations = [];
    if (Boolean(userAccess.isAttendanceManager)) {
      conversations = await execute.execute_lista_conversas_empresa_busca(
        userAccess.empresaId,
        userAccess.usuarioId
      );
    } else {
      if (!userAccess.allowedMetaParamIds.length) {
        return res.json(
          utils.jsonMount(
            true,
            {
              items: [],
              has_more: false,
              next_offset: 0,
              limit: 20,
              total: 0,
            },
            ""
          )
        );
      }

      const [waitingList, ownedList] = await Promise.all([
        execute.execute_lista_aguardando_atendimento(
          userAccess.empresaId,
          userAccess.allowedMetaParamIds,
          userAccess.usuarioId
        ),
        execute.execute_lista_conversas_usuario_busca(
          userAccess.usuarioId,
          userAccess.empresaId,
          userAccess.allowedMetaParamIds
        ),
      ]);
      conversations = ownedList.concat(waitingList);
    }

    const statusFilter = normalizeConversationSearchStatus(data.status);
    const selectedAttendantFilter = String(
      data.selected_attendant_filter || ""
    ).trim();
    const selectedMetaNumberFilter = String(
      data.selected_meta_number_filter || ""
    ).trim();
    const showUnreadOnly = Boolean(data.show_unread_only);
    const offset = normalizeConversationSearchOffset(data.offset);
    const pageLimit = 20;
    const searchTerm = pesquisa.toLowerCase();

    const filteredConversations = (Array.isArray(conversations) ? conversations : [])
      .filter((conversation) =>
        statusFilter ? conversation.status === statusFilter : true
      )
      .filter((conversation) =>
        matchesConversationSearchAttendant(conversation, selectedAttendantFilter)
      )
      .filter((conversation) =>
        matchesConversationSearchMetaNumber(conversation, selectedMetaNumberFilter)
      )
      .filter(
        (conversation) =>
          !showUnreadOnly || Number(conversation.unread_count || 0) > 0
      );

    const conversationIds = filteredConversations
      .map((conversation) => Number(conversation.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const matchedMessages =
      await execute.execute_buscar_ultima_mensagem_por_conversas_pesquisa(
        conversationIds,
        `%${pesquisa}%`
      );
    const matchedMessageMap = new Map(
      (Array.isArray(matchedMessages) ? matchedMessages : []).map((row) => [
        Number(row.cliente_conversa_id),
        row,
      ])
    );

    const matchedConversations = filteredConversations
      .filter((conversation) => {
        const directMatch =
          String(conversation.nome || "").toLowerCase().includes(searchTerm) ||
          String(conversation.telefone || "").includes(pesquisa) ||
          String(conversation.ultima_mensagem || "")
            .toLowerCase()
            .includes(searchTerm);
        return directMatch || matchedMessageMap.has(Number(conversation.id));
      })
      .map((conversation) => {
        const matchedMessage = matchedMessageMap.get(Number(conversation.id)) || null;
        return {
          ...conversation,
          search_match_preview:
            matchedMessage?.mensagem || conversation.ultima_mensagem || null,
          search_match_timestamp: buildConversationSearchTimestamp(
            conversation,
            matchedMessage
          ),
        };
      })
      .sort(compareConversationSearchResults);

    const items = matchedConversations.slice(offset, offset + pageLimit);
    const nextOffset = offset + items.length;

    return res.json(
      utils.jsonMount(
        true,
        {
          items,
          has_more: nextOffset < matchedConversations.length,
          next_offset: nextOffset,
          limit: pageLimit,
          total: matchedConversations.length,
        },
        ""
      )
    );
  } catch (error) {
    console.error(error);
    return res.json(utils.errorHandle(error, "/buscar_conversas_usuario"));
  }
});

rota.post("/configuracoes", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const userAccess = await getUsuarioAtendimentoAccessByEmpresa(
      data.empresa_id,
      data.usuario_id
    );
    if (userAccess.blocked) {
      return res.json(userAccess.response);
    }

    const config = await getEmpresaAtendimentoConfig(userAccess.empresaId);
    return res.json(utils.jsonMount(true, config, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/configuracoes"));
  }
});

rota.post("/salvar_configuracoes", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const userAccess = await getUsuarioAtendimentoAccessByEmpresa(
      data.empresa_id,
      data.usuario_id
    );
    if (userAccess.blocked) {
      return res.json(userAccess.response);
    }

    if (!Boolean(userAccess.isAttendanceManager)) {
      return res.json(
        buildForbiddenResponse(
          "Apenas administradores podem alterar as configuracoes de atendimento."
        )
      );
    }

    const queueUserIds = normalizeQueueUserIds(data.atendimento_fila_usuarios);
    const queueActive = Boolean(data.atendimento_fila_automatica_ativa);
    const manualAssignmentActive = Boolean(data.atendimento_lista_atribuida_adm);

    if (queueActive && manualAssignmentActive) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Escolha apenas um modo de distribuicao: fila automatica ou atribuicao manual do administrador."
        )
      );
    }

    if (queueActive && !queueUserIds.length) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Selecione ao menos um atendente para ativar a fila automatica."
        )
      );
    }

    for (const queueUserId of queueUserIds) {
      const queueUserRows = await execute.execute_get_usuario_atendimento_contexto(
        queueUserId,
        userAccess.empresaId
      );
      if (!queueUserRows?.length) {
        return res.json(
          utils.jsonMount(
            false,
            {},
            "Um dos usuarios selecionados para a fila nao foi encontrado."
          )
        );
      }

      const queueUser = queueUserRows[0];
      if (!isAttendanceManager(queueUser)) {
        const allowedRows = await execute.execute_list_usuario_meta_numero_ids(
          queueUserId,
          userAccess.empresaId
        );
        const allowedMetaParamIds = normalizeAllowedMetaParamIds(allowedRows);
        if (!allowedMetaParamIds.length) {
          return res.json(
            utils.jsonMount(
              false,
              {},
              `O usuario ${queueUser.nome || queueUserId} nao possui numeros da Meta vinculados e nao pode entrar na fila automatica.`
            )
          );
        }
      }
    }

    const updated = await execute.execute_update_empresa_atendimento_config(
      userAccess.empresaId,
      manualAssignmentActive,
      Boolean(data.atendimento_mensagens_rapidas_ativas),
      Boolean(data.atendimento_disparo_nps_ativo),
      queueActive,
      queueUserIds
    );

    return res.json(
      utils.jsonMount(
        true,
        normalizeAtendimentoConfig(updated?.[0] || null),
        "Configuracoes de atendimento atualizadas com sucesso."
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/salvar_configuracoes"));
  }
});

rota.post("/atribuir_conversa", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const userAccess = await getUsuarioAtendimentoAccessByEmpresa(
      data.empresa_id,
      data.usuario_id
    );
    if (userAccess.blocked) {
      return res.json(userAccess.response);
    }

    if (!Boolean(userAccess.isAttendanceManager)) {
      return res.json(
        buildForbiddenResponse(
          "Apenas administradores podem atribuir atendimentos."
        )
      );
    }

    const atendimentoConfig = await getEmpresaAtendimentoConfig(
      userAccess.empresaId
    );
    if (
      !atendimentoConfig.atendimento_lista_atribuida_adm ||
      atendimentoConfig.atendimento_fila_automatica_ativa
    ) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Ative somente o modo de atribuicao manual do administrador para atribuir atendimentos."
        )
      );
    }

    const conversaRows = await execute.execute_get_conversa_contexto_acesso(
      data.conversa_id
    );
    const conversa = conversaRows?.[0] || null;
    if (!conversa || Number(conversa.empresa_id) !== Number(userAccess.empresaId)) {
      return res.json(utils.jsonMount(false, {}, "Conversa nao encontrada."));
    }
    if (
      Number(conversa.status_id) !== 0 ||
      conversa.usuario_id !== null ||
      conversa.data_fim !== null
    ) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Somente atendimentos aguardando podem ser atribuidos."
        )
      );
    }

    let usuarioAtribuidoId = null;
    let usuarioAtribuidoNome = null;
    if (data.usuario_atribuido_id !== null && data.usuario_atribuido_id !== undefined && data.usuario_atribuido_id !== "") {
      usuarioAtribuidoId = Number(data.usuario_atribuido_id);
      if (!Number.isInteger(usuarioAtribuidoId) || usuarioAtribuidoId <= 0) {
        return res.json(
          utils.jsonMount(false, {}, "Informe um usuario_atribuido_id valido.")
        );
      }

      const usuarioDestinoRows = await execute.execute_get_usuario_atendimento_contexto(
        usuarioAtribuidoId,
        userAccess.empresaId
      );
      const usuarioDestino = usuarioDestinoRows?.[0] || null;
      if (!usuarioDestino) {
        return res.json(
          utils.jsonMount(false, {}, "Usuario de destino nao encontrado.")
        );
      }

      if (!isAttendanceManager(usuarioDestino)) {
        const allowedRows = await execute.execute_list_usuario_meta_numero_ids(
          usuarioAtribuidoId,
          userAccess.empresaId
        );
        const allowedMetaParamIds = normalizeAllowedMetaParamIds(allowedRows);
        if (
          !allowedMetaParamIds.length ||
          !allowedMetaParamIds.includes(Number(conversa.empresa_meta_param_id))
        ) {
          return res.json(
            utils.jsonMount(
              false,
              {},
              "Este usuario nao possui acesso ao numero da Meta desta conversa."
            )
          );
        }
      }

      usuarioAtribuidoNome = usuarioDestino.nome || null;
    }

    const updated = await execute.execute_update_conversa_usuario_atribuido(
      Number(data.conversa_id),
      usuarioAtribuidoId,
      userAccess.empresaId
    );
    if (!updated?.length) {
      return res.json(
        utils.jsonMount(false, {}, "Nao foi possivel atualizar a atribuicao.")
      );
    }

    notifyChatUpdate({
      empresa_id: userAccess.empresaId,
      conversa_id: Number(data.conversa_id),
      tipo: "assignment",
      origem: "atendimento:atribuir",
    });

    return res.json(
      utils.jsonMount(
        true,
        {
          conversa_id: Number(data.conversa_id),
          usuario_atribuido_id: usuarioAtribuidoId,
          nome_usuario_atribuido: usuarioAtribuidoNome,
        },
        usuarioAtribuidoId
          ? "Atendimento atribuido com sucesso."
          : "A atribuicao do atendimento foi removida."
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/atribuir_conversa"));
  }
});

rota.post("/transferir_atendimento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const userAccess = await getUsuarioAtendimentoAccessByEmpresa(
      data.empresa_id,
      data.usuario_id
    );
    if (userAccess.blocked) {
      return res.json(userAccess.response);
    }

    const access = await getConversaAccessContext(
      data.conversa_id,
      data.usuario_id,
      { skipMetaNumberAccessCheck: true }
    );
    if (access.blocked) {
      return res.json(access.response);
    }
    const conversa = access.conversa;
    const isManagerUser = Boolean(access.isAttendanceManager);
    const isAttendantInitiatedTransfer = !isManagerUser;

    const isActiveConversation =
      Number(conversa.status_id) === 1 && conversa.data_fim === null;
    const isAssignedWaitingConversation =
      Number(conversa.status_id) === 0 &&
      conversa.data_fim === null &&
      conversa.usuario_id === null &&
      Number(conversa.usuario_atribuido_id || 0) > 0 &&
      (isManagerUser ||
        Number(conversa.usuario_atribuido_id) === Number(userAccess.usuarioId));

    if (!isActiveConversation && !isAssignedWaitingConversation) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Somente atendimentos ativos ou aguardando ja atribuidos podem trocar de atendente."
        )
      );
    }

    const novoUsuarioId = Number(data.novo_usuario_id);
    if (!Number.isInteger(novoUsuarioId) || novoUsuarioId <= 0) {
      return res.json(
        utils.jsonMount(false, {}, "Informe um novo_usuario_id valido.")
      );
    }

    const usuarioDestinoRows = await execute.execute_get_usuario_atendimento_contexto(
      novoUsuarioId,
      userAccess.empresaId
    );
    const usuarioDestino = usuarioDestinoRows?.[0] || null;
    if (!usuarioDestino) {
      return res.json(
        utils.jsonMount(false, {}, "Usuario de destino nao encontrado.")
      );
    }

    if (!isAttendanceManager(usuarioDestino) && !isAttendantInitiatedTransfer) {
      const allowedRows = await execute.execute_list_usuario_meta_numero_ids(
        novoUsuarioId,
        userAccess.empresaId
      );
      const allowedMetaParamIds = normalizeAllowedMetaParamIds(allowedRows);
      if (
        !allowedMetaParamIds.length ||
        !allowedMetaParamIds.includes(Number(conversa.empresa_meta_param_id))
      ) {
        return res.json(
          utils.jsonMount(
            false,
            {},
            "Este usuario nao possui acesso ao numero da Meta desta conversa."
          )
        );
      }
    }

    const updated = isAssignedWaitingConversation
      ? await execute.execute_update_conversa_usuario_atribuido(
          Number(data.conversa_id),
          novoUsuarioId,
          access.empresaId
        )
      : await execute.execute_transferir_atendimento_usuario(
          Number(data.conversa_id),
          novoUsuarioId,
          access.empresaId
        );
    if (!updated?.length) {
      return res.json(
        utils.jsonMount(false, {}, "Nao foi possivel trocar o atendente.")
      );
    }

    notifyChatUpdate({
      empresa_id: access.empresaId,
      conversa_id: Number(data.conversa_id),
      tipo: isAssignedWaitingConversation ? "assignment" : "ownership",
      origem: isAssignedWaitingConversation
        ? "atendimento:transferir_aguardando"
        : "atendimento:transferir",
    });

    return res.json(
      utils.jsonMount(
        true,
        {
          conversa_id: Number(data.conversa_id),
          usuario_id: isAssignedWaitingConversation ? null : novoUsuarioId,
          usuario_atribuido_id: isAssignedWaitingConversation
            ? novoUsuarioId
            : null,
          nome_atendente: usuarioDestino.nome || null,
        },
        isAssignedWaitingConversation
          ? "Atendimento aguardando transferido com sucesso."
          : "Atendente alterado com sucesso."
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/transferir_atendimento"));
  }
});

rota.post("/carregar_conversa", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const access = await getConversaAccessContext(
      data.conversa_id,
      data.usuario_id,
      {
        payloadPermissions: Array.isArray(data.permissions)
          ? data.permissions
          : [],
      }
    );
    if (access.blocked) {
      return res.json(access.response);
    }

    const normalizeCursorTimestamp = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return null;
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    };

    const normalizeCursorSortId = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    };

    const requestedLimit = Number(data.limit);
    const pageLimit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 200)
      : 80;
    const afterTimestamp = normalizeCursorTimestamp(data.after_timestamp);
    const afterSortId = normalizeCursorSortId(data.after_sort_id);
    const beforeTimestamp = normalizeCursorTimestamp(data.before_timestamp);
    const beforeSortId = normalizeCursorSortId(data.before_sort_id);
    const isDeltaRequest = !!afterTimestamp && !beforeTimestamp;
    const fetchLimit = isDeltaRequest ? Math.max(pageLimit, 200) : pageLimit + 1;
    const sessionPermissions = Array.isArray(data.permissions)
      ? data.permissions
      : [];
    const canViewAllConversationMessages = hasEffectiveUserPermission(
      access.userContext,
      CHAT_VIEW_ALL_MESSAGES_PERMISSION,
      sessionPermissions
    ) || Boolean(access.isAttendanceManager);
    const shouldLoadFullNumberHistory =
      canViewAllConversationMessages ||
      Number(access.conversa?.status_id) === 2;

    const dados = await execute.execute_get_dados_conversa(data.conversa_id);
    const clienteBloqueado = await executeAppSafety.execute_conversa_cliente_bloqueado(
      data.conversa_id
    );
    const mensagensBrutas = await execute.execute_lista_mensagens_conversa(
      data.conversa_id,
      {
        afterTimestamp,
        afterSortId,
        beforeTimestamp,
        beforeSortId,
        limit: fetchLimit,
        includeCustomerHistory: shouldLoadFullNumberHistory,
        historicalUserId: shouldLoadFullNumberHistory
          ? null
          : Number(access.usuarioId) || null,
      }
    );

    let mensagens = Array.isArray(mensagensBrutas) ? mensagensBrutas : [];
    const hasMoreBefore = !isDeltaRequest && mensagens.length > pageLimit;
    if (hasMoreBefore) {
      mensagens = mensagens.slice(1);
    }

    if (
      !beforeTimestamp &&
      Number.isInteger(Number(data.usuario_id)) &&
      Number(data.usuario_id) > 0
    ) {
      await execute.execute_marcar_conversa_lida_usuario(
        data.conversa_id,
        Number(data.usuario_id)
      );
    }

    const earliestMessage = mensagens[0] || null;
    const latestMessage = mensagens[mensagens.length - 1] || null;
    const final_return = {
      mensagens,
      dados: {
        ...(dados[0] || {}),
        cliente_bloqueado: clienteBloqueado,
      },
      cliente_bloqueado: clienteBloqueado,
      page: {
        mode: isDeltaRequest
          ? "delta"
          : beforeTimestamp
            ? "before"
            : "initial",
        limit: pageLimit,
        has_more_before: hasMoreBefore,
        earliest_cursor: earliestMessage
          ? {
              timestamp: earliestMessage.timestamp,
              sort_id: earliestMessage.sort_id,
            }
          : null,
        latest_cursor: latestMessage
          ? {
              timestamp: latestMessage.timestamp,
              sort_id: latestMessage.sort_id,
            }
          : null,
      },
    };
    return res.json(utils.jsonMount(true, final_return, ""));
  } catch (error) {
    console.error("[/carregar_conversa] erro:", error);
    return res.json(utils.errorHandle(error, "/carregar_conversa"));
  }
});

rota.post("/bloquear_cliente", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    const empresaId = Number(data.empresa_id);
    const usuarioId = Number(data.usuario_id) || null;
    let clienteId = Number(data.cliente_id) || null;

    if (data.conversa_id) {
      const access = await getConversaAccessContext(data.conversa_id, data.usuario_id);
      if (access.blocked) return res.json(access.response);
      clienteId = Number(access.conversa?.cliente_id) || clienteId;
    }
    const cliente = await executeAppSafety.execute_get_cliente_empresa(clienteId, empresaId);
    if (!cliente) return res.json(utils.jsonMount(false, {}, "Cliente nao encontrado nesta empresa."));

    const bloqueio = await executeAppSafety.execute_bloquear_cliente({
      empresa_id: empresaId,
      cliente_id: clienteId,
      usuario_id: usuarioId,
      motivo: data.motivo,
    });
    return res.json(utils.jsonMount(true, bloqueio, "Cliente bloqueado com sucesso."));
  } catch (error) {
    return res.json(utils.jsonMount(false, {}, error?.message || "Nao foi possivel bloquear o cliente."));
  }
});

rota.post("/desbloquear_cliente", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    const empresaId = Number(data.empresa_id);
    const clienteId = Number(data.cliente_id);
    const cliente = await executeAppSafety.execute_get_cliente_empresa(clienteId, empresaId);
    if (!cliente) return res.json(utils.jsonMount(false, {}, "Cliente nao encontrado nesta empresa."));
    const bloqueio = await executeAppSafety.execute_desbloquear_cliente({
      empresa_id: empresaId,
      cliente_id: clienteId,
      usuario_id: Number(data.usuario_id) || null,
    });
    return res.json(utils.jsonMount(true, bloqueio || {}, "Cliente desbloqueado com sucesso."));
  } catch (error) {
    return res.json(utils.jsonMount(false, {}, error?.message || "Nao foi possivel desbloquear o cliente."));
  }
});

rota.post("/listar_clientes_bloqueados", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    const rows = await executeAppSafety.execute_listar_clientes_bloqueados(Number(data.empresa_id));
    return res.json(utils.jsonMount(true, rows, ""));
  } catch (error) {
    return res.json(utils.jsonMount(false, {}, error?.message || "Nao foi possivel listar os bloqueios."));
  }
});

rota.post("/denunciar", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    const motivo = String(data.motivo || "").trim();
    if (!motivo) return res.json(utils.jsonMount(false, {}, "Informe o motivo da denuncia."));
    let contexto = null;
    if (data.conversa_id) {
      const access = await getConversaAccessContext(data.conversa_id, data.usuario_id);
      if (access.blocked) return res.json(access.response);
      contexto = await executeAppSafety.execute_get_conversa_cliente_contexto(data.conversa_id);
    }
    const denuncia = await executeAppSafety.execute_criar_denuncia({
      empresa_id: Number(data.empresa_id),
      usuario_id: Number(data.usuario_id) || null,
      cliente_id: Number(data.cliente_id || contexto?.cliente_id) || null,
      conversa_id: Number(data.conversa_id) || null,
      mensagem_id: Number(data.mensagem_id) || null,
      tipo: data.tipo || "abuso",
      motivo,
      descricao: data.descricao,
      dados: data.dados,
    });

    let emailEnviado = true;
    try {
      await sendEmail.send_feedback_email({
        tipo: "support",
        assunto: `Denuncia no app #${denuncia.id}`,
        mensagem: `${motivo}\n\n${String(data.descricao || "").trim()}`,
        email_usuario: data.email_usuario || null,
        usuario_id: Number(data.usuario_id) || null,
        empresa_id: Number(data.empresa_id),
        dados_formulario: { denuncia_id: denuncia.id, conversa_id: denuncia.conversa_id, mensagem_id: denuncia.mensagem_id },
      });
    } catch (emailError) {
      emailEnviado = false;
      console.error("[/atendimento/denunciar] denuncia gravada, mas email falhou", emailError);
    }
    return res.json(utils.jsonMount(true, { ...denuncia, email_enviado: emailEnviado }, "Denuncia registrada."));
  } catch (error) {
    return res.json(utils.jsonMount(false, {}, error?.message || "Nao foi possivel registrar a denuncia."));
  }
});

rota.post("/apagar_mensagem", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    const access = await getConversaAccessContext(data.conversa_id, data.usuario_id);
    if (access.blocked) return res.json(access.response);
    const mensagem = await executeAppSafety.execute_apagar_mensagem_plataforma({
      mensagem_id: Number(data.mensagem_id),
      conversa_id: Number(data.conversa_id),
      empresa_id: Number(data.empresa_id),
    });
    if (!mensagem) return res.json(utils.jsonMount(false, {}, "Mensagem nao encontrada."));
    return res.json(utils.jsonMount(true, mensagem, "Mensagem ocultada na plataforma."));
  } catch (error) {
    return res.json(utils.jsonMount(false, {}, error?.message || "Nao foi possivel ocultar a mensagem."));
  }
});

rota.post("/enviar_mensagem", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const access = await getConversaAccessContext(
      data.conversa_id,
      data.usuario_id
    );
    if (access.blocked) {
      return res.json(access.response);
    }

    if (await executeAppSafety.execute_conversa_cliente_bloqueado(data.conversa_id)) {
      return res.json(utils.jsonMount(false, {}, "Este cliente esta bloqueado. O envio foi recusado."));
    }
    await executeAppSafety.execute_validar_conteudo_envio(
      Number(data.empresa_id || access.empresaId),
      data.mensagem
    );

    const metaWindowGuard = await getMetaWindowLockResponse(data.conversa_id);
    if (metaWindowGuard.blocked) {
      return res.json(metaWindowGuard.response);
    }

    const number = await execute.execute_get_number(data.conversa_id);
    const msg = `*${data.nome}* :\n ${data.mensagem}`;
    const mensagemReplyId = Number(data.mensagem_reply_id);
    let replyContext = null;

    if (Number.isInteger(mensagemReplyId) && mensagemReplyId > 0) {
      const replyRows = await execute.execute_get_mensagem_conversa_by_id(
        data.conversa_id,
        mensagemReplyId
      );
      const replyMessage = replyRows?.[0] || null;
      const replyWhatsappId = String(replyMessage?.mensagem_whats_id || "").trim();

      if (replyMessage?.id) {
        replyContext = {
          mensagem_id: replyMessage.id,
          mensagem_whats_id: replyWhatsappId || null,
        };
      }
    }

    await utils.sendWhatsappMessage(
      number[0].number_phone_id,
      msg,
      data.conversa_id,
      data.mensagem,
      access.empresaId,
      Number(data.usuario_id) || null,
      replyContext
    );
    if (Number.isInteger(Number(data.usuario_id)) && Number(data.usuario_id) > 0) {
      await execute.execute_marcar_conversa_lida_usuario(
        data.conversa_id,
        Number(data.usuario_id)
      );
    }
    return res.json(utils.jsonMount(true, {}, ""));
  } catch (error) {
    if (["CLIENT_BLOCKED", "CONTENT_BLOCKED"].includes(String(error?.code || ""))) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/enviar_mensagem"));
  }
});

rota.post("/reagir_mensagem", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }

    const conversaId = Number(data.conversa_id);
    const mensagemId = Number(data.mensagem_id);
    const hasEmojiField =
      Object.prototype.hasOwnProperty.call(data, "emoji") &&
      data.emoji !== null &&
      data.emoji !== undefined;
    const emoji = hasEmojiField ? String(data.emoji).trim() : "";

    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Conversa inválida."));
    }

    if (!Number.isInteger(mensagemId) || mensagemId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Mensagem inválida."));
    }

    if (!hasEmojiField) {
      return res.json(utils.jsonMount(false, {}, "Reação inválida."));
    }

    const access = await getConversaAccessContext(
      conversaId,
      data.usuario_id
    );
    if (access.blocked) {
      return res.json(access.response);
    }

    const metaWindowGuard = await getMetaWindowLockResponse(conversaId);
    if (metaWindowGuard.blocked) {
      return res.json(metaWindowGuard.response);
    }

    const mensagens = await execute.execute_get_mensagem_conversa_by_id(
      conversaId,
      mensagemId
    );
    const mensagemOriginal = mensagens?.[0] || null;
    const mensagemWhatsId = String(
      mensagemOriginal?.mensagem_whats_id || ""
    ).trim();

    if (!mensagemWhatsId) {
      return res.json(
        utils.jsonMount(false, {}, "Esta mensagem ainda não possui ID do WhatsApp para receber reação.")
      );
    }

    const number = await execute.execute_get_number(conversaId);
    if (!number?.[0]?.number_phone_id) {
      return res.json(
        utils.jsonMount(false, {}, "Telefone do cliente não encontrado para enviar reação.")
      );
    }

    const response = await utils.sendWhatsappReaction(
      number[0].number_phone_id,
      conversaId,
      access.empresaId,
      mensagemWhatsId,
      emoji
    );

    return res.json(utils.jsonMount(true, { response }, "Reação enviada."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/reagir_mensagem"));
  }
});

rota.post("/mensagem_busca", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }

    const userAccess = await getUsuarioAtendimentoAccessByEmpresa(
      data.empresa_id,
      data.usuario_id
    );
    if (userAccess.blocked) {
      return res.json(userAccess.response);
    }

    const atendimentoConfig = await getEmpresaAtendimentoConfig(
      userAccess.empresaId
    );
    if (!atendimentoConfig.atendimento_mensagens_rapidas_ativas) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "As mensagens rapidas estao desativadas para esta empresa."
        )
      );
    }

    let mensagem_rapida = [];
    try {
      mensagem_rapida = await execute.execute_get_mensagem_rapida(
        data.pesquisa,
        userAccess.empresaId,
        userAccess.usuarioId
      );
    } catch (error) {
      if (!isQuickMessagesGalleryMigrationMissing(error)) {
        throw error;
      }
      mensagem_rapida = await execute.execute_get_mensagem_rapida_legacy(
        data.pesquisa,
        userAccess.empresaId
      );
    }
    return res.json(utils.jsonMount(true, mensagem_rapida, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/mensagem_busca"));
  }
});

rota.post("/enviar_imagem_url", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }

    const access = await getConversaAccessContext(data.conversa_id, data.usuario_id);
    if (access.blocked) {
      return res.json(access.response);
    }

    const imageUrl = String(data.image_url || "").trim();
    if (!/^https?:\/\//i.test(imageUrl)) {
      return res.json(utils.jsonMount(false, {}, "Informe uma URL de imagem valida."));
    }

    await utils.sendWhatsappImageByUrl(
      data.numero,
      imageUrl,
      String(data.caption || ""),
      data.conversa_id,
      access.empresaId,
      Number(data.usuario_id) || null
    );

    return res.json(utils.jsonMount(true, {}, "Imagem enviada com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/enviar_imagem_url"));
  }
});

rota.post("/enviar_documento_url", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const access = await getConversaAccessContext(data.conversa_id, data.usuario_id);
    if (access.blocked) {
      return res.json(access.response);
    }

    const metaWindowGuard = await getMetaWindowLockResponse(data.conversa_id);
    if (metaWindowGuard.blocked) {
      return res.json(metaWindowGuard.response);
    }

    const documentUrl = String(data.document_url || "").trim();
    if (!/^https?:\/\//i.test(documentUrl)) {
      return res.json(utils.jsonMount(false, {}, "Informe uma URL de documento valida."));
    }

    await utils.sendWhatsappDocumentByUrl(
      data.numero,
      documentUrl,
      String(data.filename || data.document_name || ""),
      String(data.caption || ""),
      data.conversa_id,
      access.empresaId,
      Number(data.usuario_id) || null
    );

    return res.json(utils.jsonMount(true, {}, "Documento enviado com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/enviar_documento_url"));
  }
});

rota.post("/enviar_audio_url", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }
    const access = await getConversaAccessContext(data.conversa_id, data.usuario_id);
    if (access.blocked) {
      return res.json(access.response);
    }
    const metaWindowGuard = await getMetaWindowLockResponse(data.conversa_id);
    if (metaWindowGuard.blocked) {
      return res.json(metaWindowGuard.response);
    }
    const galleryAudioId = Number(data.galeria_audio_id);
    if (!Number.isInteger(galleryAudioId) || galleryAudioId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe um audio valido da galeria."));
    }
    const galleryAudio = await executeUser.execute_get_galeria_audio_by_id_empresa(
      galleryAudioId,
      access.empresaId
    );
    if (!galleryAudio?.url) {
      return res.json(utils.jsonMount(false, {}, "Audio da galeria nao encontrado."));
    }
    await utils.sendAudioByUrl(
      data.numero,
      galleryAudio.url,
      data.conversa_id,
      access.empresaId,
      Number(data.usuario_id) || null,
      { messageLabel: String(galleryAudio.nome_arquivo || data.audio_name || "audio") }
    );
    return res.json(utils.jsonMount(true, {}, "Audio enviado com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/enviar_audio_url"));
  }
});

rota.post("/enviar_video_url", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    const access = await getConversaAccessContext(data.conversa_id, data.usuario_id);
    if (access.blocked) return res.json(access.response);
    const metaWindowGuard = await getMetaWindowLockResponse(data.conversa_id);
    if (metaWindowGuard.blocked) return res.json(metaWindowGuard.response);

    const videoUrl = String(data.video_url || "").trim();
    if (!/^https?:\/\//i.test(videoUrl)) {
      return res.json(utils.jsonMount(false, {}, "Informe uma URL de video valida."));
    }
    await utils.sendWhatsappVideoByUrl(
      data.numero,
      videoUrl,
      String(data.caption || ""),
      data.conversa_id,
      access.empresaId,
      Number(data.usuario_id) || null
    );
    return res.json(utils.jsonMount(true, {}, "Video enviado com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/enviar_video_url"));
  }
});

rota.post("/enviar_localizacao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const access = await getConversaAccessContext(data.conversa_id, data.usuario_id);
    if (access.blocked) {
      return res.json(access.response);
    }

    const metaWindowGuard = await getMetaWindowLockResponse(data.conversa_id);
    if (metaWindowGuard.blocked) {
      return res.json(metaWindowGuard.response);
    }

    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.json(
        utils.jsonMount(false, {}, "Informe latitude e longitude validas.")
      );
    }

    const locationPayload = {
      latitude,
      longitude,
      ...(String(data.name || "").trim()
        ? { name: String(data.name || "").trim() }
        : {}),
      ...(String(data.address || "").trim()
        ? { address: String(data.address || "").trim() }
        : {})
    };

    await utils.sendWhatsappLocation(
      data.numero,
      locationPayload,
      data.conversa_id,
      access.empresaId,
      Number(data.usuario_id) || null
    );

    return res.json(utils.jsonMount(true, {}, "Localizacao enviada com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/enviar_localizacao"));
  }
});

rota.post("/enviar_contato", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const access = await getConversaAccessContext(data.conversa_id, data.usuario_id);
    if (access.blocked) {
      return res.json(access.response);
    }

    const metaWindowGuard = await getMetaWindowLockResponse(data.conversa_id);
    if (metaWindowGuard.blocked) {
      return res.json(metaWindowGuard.response);
    }

    const contactName = String(data.name || data.contact_name || "").trim();
    const firstName =
      contactName.split(" ").filter(Boolean)[0] || contactName || "Contato";
    const phone = String(data.phone || data.telefone || "").trim();
    const email = String(data.email || "").trim();

    if (!contactName) {
      return res.json(
        utils.jsonMount(false, {}, "Informe o nome do contato.")
      );
    }

    if (!phone && !email) {
      return res.json(
        utils.jsonMount(false, {}, "Informe ao menos telefone ou email do contato.")
      );
    }

    const contactsPayload = [
      {
        name: {
          formatted_name: contactName,
          first_name: firstName
        },
        ...(phone
          ? {
              phones: [
                {
                  phone,
                  type: "CELL"
                }
              ]
            }
          : {}),
        ...(email
          ? {
              emails: [
                {
                  email,
                  type: "WORK"
                }
              ]
            }
          : {}),
        ...(String(data.company || "").trim() ||
        String(data.department || "").trim() ||
        String(data.title || "").trim()
          ? {
              org: {
                ...(String(data.company || "").trim()
                  ? { company: String(data.company || "").trim() }
                  : {}),
                ...(String(data.department || "").trim()
                  ? { department: String(data.department || "").trim() }
                  : {}),
                ...(String(data.title || "").trim()
                  ? { title: String(data.title || "").trim() }
                  : {})
              }
            }
          : {})
      }
    ];

    await utils.sendWhatsappContacts(
      data.numero,
      contactsPayload,
      data.conversa_id,
      access.empresaId,
      Number(data.usuario_id) || null
    );

    return res.json(utils.jsonMount(true, {}, "Contato enviado com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/enviar_contato"));
  }
});

rota.post("/buscar_detalhes_cliente", requireTenantOwnership([["cliente_id", "cliente"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const clienteId = Number(data.cliente_id);
    const empresaId = Number(data.empresa_id);
    const detalhes = await execute.execute_detalhes_cliente(clienteId);
    const notas = await execute.execute_get_notas(clienteId);
    const clienteInfo = await execute.execute_get_cliente_info(clienteId);
    const crmAtendimento =
      Number.isInteger(empresaId) && empresaId > 0
        ? await execute.execute_get_cliente_crm_atendimento(clienteId, empresaId)
        : [];
    const crmInteracoes =
      Number.isInteger(empresaId) && empresaId > 0
        ? await execute.execute_list_cliente_crm_interacoes(clienteId, empresaId)
        : [];
    const crmHistorico =
      Number.isInteger(empresaId) && empresaId > 0
        ? await execute.execute_list_cliente_crm_historico(clienteId, empresaId)
        : [];
    const documentos =
      Number.isInteger(empresaId) && empresaId > 0
        ? await execute.execute_list_cliente_documentos(clienteId, empresaId)
        : [];
    const historicoAtendimentosWhatsapp =
      Number.isInteger(empresaId) && empresaId > 0
        ? await execute.execute_list_cliente_atendimentos_whatsapp(clienteId, empresaId)
        : [];

    return res.json(
      utils.jsonMount(
        true,
        {
          tags: detalhes,
          notes: notas,
          cliente: clienteInfo[0] || null,
          crm: {
            atendimento: crmAtendimento[0] || null,
            interacoes: crmInteracoes,
            historico: crmHistorico,
          },
          documentos,
          historico_atendimentos_whatsapp: historicoAtendimentosWhatsapp,
        },
        ""
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/mensagem_busca"));
  }
});

rota.post("/garantir_crm_atendimento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const access = await getConversaAccessContext(data.conversa_id, data.usuario_id);
    if (access.blocked) {
      return res.json(access.response);
    }

    if (!access.conversa?.cliente_id) {
      return res.json(utils.jsonMount(false, {}, "Cliente da conversa nao encontrado."));
    }

    const result = await executeVendas.execute_criar_negocio_entrada_whatsapp({
      empresa_id: access.empresaId,
      cliente_id: access.conversa.cliente_id,
      conversa_id: access.conversa.id,
      empresa_meta_param_id: access.conversa.empresa_meta_param_id || null,
      status_id: access.conversa.status_id,
      allow_manual_binding: true,
    });

    if (result?.reason === "crm_not_linked_to_meta_number") {
      return res.json(
        utils.jsonMount(
          false,
          result,
          "Este numero da Meta ainda nao esta vinculado a nenhum pipeline."
        )
      );
    }

    if (result?.reason === "conversation_closed") {
      return res.json(
        utils.jsonMount(
          false,
          result,
          "Este atendimento ja foi finalizado e nao pode mais ser vinculado ao funil."
        )
      );
    }

    if (result?.reason === "status_not_waiting") {
      return res.json(
        utils.jsonMount(
          false,
          result,
          "Este atendimento nao esta elegivel para criacao automatica no funil."
        )
      );
    }

    if (result?.created || result?.reason === "open_deal_exists") {
      return res.json(
        utils.jsonMount(
          true,
          result,
          result?.created
            ? "Atendimento vinculado ao funil com sucesso."
            : "O cliente ja possui um atendimento ativo no funil deste numero."
        )
      );
    }

    return res.json(
      utils.jsonMount(
        false,
        result || {},
        "Nao foi possivel vincular este atendimento ao funil."
      )
    );
  } catch (error) {
    console.error("[/atendimento/garantir_crm_atendimento] erro:", error);
    return res.json(utils.errorHandle(error, "/atendimento/garantir_crm_atendimento"));
  }
});

rota.post("/analisar_atendimento_ia", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃƒÂ¡lido ou expirado."));
    }

    const conversaId = Number(data.conversa_id);
    const empresaId = Number(data.empresa_id);

    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe conversa_id valido."));
    }

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    const rows = await execute.execute_get_conversa_para_analise_ia(
      conversaId,
      empresaId
    );
    const promptIaRet = await execute.execute_get_prompt_ia_atendimento_empresa(empresaId);
    const promptIaEmpresa = String(promptIaRet?.[0]?.prompt_ia_atendimento || "");

    if (!rows || !rows.length) {
      return res.json(
        utils.jsonMount(false, {}, "Conversa nao encontrada para esta empresa.")
      );
    }

    const base = rows[0];
    const transcricao = buildConversaTranscript(rows);

    const analise = await gerarAnaliseAtendimentoComOpenAI({
      cliente_nome: base.cliente_nome,
      cliente_telefone: base.cliente_telefone,
      atendente_nome: base.atendente_nome,
      transcricao,
      contexto_comercial: data.contexto_comercial || {},
      prompt_empresa: promptIaEmpresa,
    });

    return res.json(
      utils.jsonMount(
        true,
        {
          conversa_id: Number(base.conversa_id || conversaId),
          cliente: {
            id: base.cliente_id,
            nome: base.cliente_nome,
            telefone: base.cliente_telefone,
          },
          atendente: {
            nome: base.atendente_nome || null,
          },
          total_mensagens: rows.filter((row) => row.mensagem_id).length,
          analise,
        },
        "Analise de atendimento gerada com sucesso."
      )
    );
  } catch (error) {
    console.error("Erro em /analisar_atendimento_ia:", error?.response?.data || error);
    const message = String(error?.message || "").trim();
    if (message) {
      return res.json(utils.jsonMount(false, {}, message));
    }
    return res.json(utils.errorHandle(error, "/analisar_atendimento_ia"));
  }
});

rota.post("/corrigir_texto_chat_ia", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const texto = String(data.texto || data.text || "").trim();
    if (!texto) {
      return res.json(utils.jsonMount(false, {}, "Informe um texto para corrigir."));
    }

    if (texto.length > 4000) {
      return res.json(
        utils.jsonMount(false, {}, "O texto para correcao deve ter no maximo 4000 caracteres.")
      );
    }

    const access = await getConversaAccessContext(data.conversa_id, data.usuario_id, {
      payloadPermissions: Array.isArray(data.permissions) ? data.permissions : [],
    });
    if (access.blocked) {
      return res.json(access.response);
    }

    const correcao = await corrigirTextoChatComOpenAI({
      texto,
    });

    return res.json(
      utils.jsonMount(
        true,
        {
          original_text: texto,
          corrected_text: String(correcao?.corrected_text || texto),
          changed: Boolean(correcao?.changed),
        },
        correcao?.changed
          ? "Texto corrigido com sucesso."
          : "O texto ja estava adequado."
      )
    );
  } catch (error) {
    console.error("Erro em /corrigir_texto_chat_ia:", error?.response?.data || error);
    const message = String(error?.message || "").trim();
    if (message) {
      return res.json(utils.jsonMount(false, {}, message));
    }
    return res.json(utils.errorHandle(error, "/corrigir_texto_chat_ia"));
  }
});

rota.post("/assistente_conversao_ia", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃƒÂ¡lido ou expirado."));
    }

    const conversaId = Number(data.conversa_id);
    const empresaId = Number(data.empresa_id);

    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe conversa_id valido."));
    }

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    const rows = await execute.execute_get_conversa_para_analise_ia(
      conversaId,
      empresaId
    );
    const promptIaRet = await execute.execute_get_prompt_ia_atendimento_empresa(empresaId);
    const promptIaEmpresa = String(promptIaRet?.[0]?.prompt_ia_atendimento || "");

    if (!rows || !rows.length) {
      return res.json(
        utils.jsonMount(false, {}, "Conversa nao encontrada para esta empresa.")
      );
    }

    const base = rows[0];
    if (Number(base.status_id) !== 1) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "A assistencia de conversao via IA esta disponivel apenas para atendimentos ativos."
        )
      );
    }

    const crmAtendimentoRows = base?.cliente_id
      ? await execute.execute_get_cliente_crm_atendimento(base.cliente_id, empresaId)
      : [];
    const crmAtendimento = Array.isArray(crmAtendimentoRows)
      ? crmAtendimentoRows[0] || null
      : crmAtendimentoRows || null;
    const produtosComerciais =
      (await executeVendas.execute_listar_produtos_crm({ empresa_id: empresaId })) || [];

    const transcricao = buildConversaTranscript(rows);
    const produtosCatalogoRelevantes = selectRelevantProductsForConversation(
      produtosComerciais,
      {
        transcricao,
        cliente_nome: base.cliente_nome,
        produto_atual: crmAtendimento?.produto_principal,
        produtos_negocio_atual: crmAtendimento?.produtos || [],
      }
    );
    const assistencia = await gerarAssistenciaConversaoComOpenAI({
      cliente_nome: base.cliente_nome,
      cliente_telefone: base.cliente_telefone,
      atendente_nome: base.atendente_nome,
      crm_nome: crmAtendimento?.crm_nome,
      etapa_nome: crmAtendimento?.etapa_nome,
      produto_atual: crmAtendimento?.produto_principal,
      produtos_negocio_atual: crmAtendimento?.produtos || [],
      produtos_catalogo: produtosCatalogoRelevantes,
      transcricao,
      prompt_empresa: promptIaEmpresa,
    });

    return res.json(
      utils.jsonMount(
        true,
        {
          conversa_id: Number(base.conversa_id || conversaId),
          cliente: {
            id: base.cliente_id,
            nome: base.cliente_nome,
            telefone: base.cliente_telefone,
          },
          atendente: {
            nome: base.atendente_nome || null,
          },
          crm: crmAtendimento
            ? {
                negocio_id: crmAtendimento.negocio_id || null,
                crm_id: crmAtendimento.crm_id || null,
                crm_nome: crmAtendimento.crm_nome || null,
                etapa_id: crmAtendimento.etapa_id || null,
                etapa_nome: crmAtendimento.etapa_nome || null,
                etapa_fechamento: Boolean(crmAtendimento.etapa_fechamento),
                produto_atual: crmAtendimento.produto_principal || null,
              }
            : null,
          produtos_catalogo: Array.isArray(produtosComerciais)
            ? produtosComerciais.map((item) => ({
                id: item.id,
                nome: item.nome,
                descricao: item.descricao || null,
                preco_base: item.preco_base ?? null,
                imagens: Array.isArray(item.imagens) ? item.imagens : [],
                documento: item.documento || null,
              }))
            : [],
          produtos_catalogo_consultado_ia: Array.isArray(produtosCatalogoRelevantes)
            ? produtosCatalogoRelevantes.map((item) => ({
                id: item.id,
                nome: item.nome,
                descricao: item.descricao || null,
                preco_base: item.preco_base ?? null,
                total_imagens: item.total_imagens || 0,
                tem_documento: Boolean(item.tem_documento),
                relevancia: item.relevancia || 0,
              }))
            : [],
          assistencia,
        },
        "Assistencia de conversao gerada com sucesso."
      )
    );
  } catch (error) {
    console.error("Erro em /assistente_conversao_ia:", error?.response?.data || error);
    const message = String(error?.message || "").trim();
    if (message) {
      return res.json(utils.jsonMount(false, {}, message));
    }
    return res.json(utils.errorHandle(error, "/assistente_conversao_ia"));
  }
});

rota.get("/download/:empresa_id/:id", async (req, res) => {
  const startedAt = Date.now();
  const { id, empresa_id } = req.params;
  const conversaId = Number(req.query.conversa_id || 0) || null;
  const requestedFormat = String(req.query.format || "").trim().toLowerCase();

  console.log("[/atendimento/download] requisicao recebida", {
    empresa_id,
    midia_id: id,
    conversa_id: conversaId,
    requested_format: requestedFormat || null,
    range: req.headers.range || null,
    user_agent: req.get("user-agent") || null,
  });

  try {
    const { file, midia } = await utils.downloadmidia(id, empresa_id, conversaId);

    const originalMimeType = String(midia?.mime_type || "").trim().toLowerCase();
    const shouldNormalizeAudioToMp3 = requestedFormat === "mp3";
    const originalLooksLikeMp3 =
      originalMimeType === "audio/mpeg" || originalMimeType === "audio/mp3";

    let fileToSend = file;
    let mimeType = originalMimeType || "application/octet-stream";
    let ext = getExtension(mimeType);

    if (shouldNormalizeAudioToMp3) {
      try {
        fileToSend = originalLooksLikeMp3
          ? file
          : await utils.convertAudioBufferToMp3(file, ext || "bin");
        mimeType = "audio/mpeg";
        ext = "mp3";
      } catch (audioNormalizationError) {
        console.error("[/atendimento/download] falha ao normalizar audio para mp3:", {
          empresa_id,
          midia_id: id,
          conversa_id: conversaId,
          requested_format: requestedFormat,
          original_mime_type: originalMimeType || null,
          message: audioNormalizationError?.message || null,
        });

        if (originalLooksLikeMp3 || !originalMimeType || mimeType === "application/octet-stream") {
          mimeType = "audio/mpeg";
          ext = "mp3";
        }
      }
    }

    const totalSize = Buffer.byteLength(fileToSend);
    const rangeHeader = String(req.headers.range || "").trim();

    console.log("[/atendimento/download] midia carregada", {
      empresa_id,
      midia_id: id,
      conversa_id: conversaId,
      mime_type: mimeType,
      original_mime_type: originalMimeType || null,
      bytes: totalSize,
      normalized: shouldNormalizeAudioToMp3 && !originalLooksLikeMp3,
      elapsed_ms: Date.now() - startedAt,
    });

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="arquivo.${ext}"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Accept-Ranges", "bytes");

    if (rangeHeader && /^bytes=\d*-\d*$/i.test(rangeHeader)) {
      const [rawStart, rawEnd] = rangeHeader.replace(/bytes=/i, "").split("-");
      const parsedStart = rawStart === "" ? 0 : Number(rawStart);
      const parsedEnd =
        rawEnd === "" ? totalSize - 1 : Number(rawEnd);

      if (
        !Number.isInteger(parsedStart) ||
        !Number.isInteger(parsedEnd) ||
        parsedStart < 0 ||
        parsedEnd < parsedStart ||
        parsedStart >= totalSize
      ) {
        res.status(416);
        res.setHeader("Content-Range", `bytes */${totalSize}`);
        return res.end();
      }

      const end = Math.min(parsedEnd, totalSize - 1);
      const chunk = fileToSend.subarray(parsedStart, end + 1);

      res.status(206);
      res.setHeader("Content-Range", `bytes ${parsedStart}-${end}/${totalSize}`);
      res.setHeader("Content-Length", String(chunk.length));
      console.log("[/atendimento/download] resposta parcial enviada", {
        empresa_id,
        midia_id: id,
        status: 206,
        bytes: chunk.length,
        content_range: `${parsedStart}-${end}/${totalSize}`,
        elapsed_ms: Date.now() - startedAt,
      });
      return res.end(chunk);
    }

    res.setHeader("Content-Length", String(totalSize));
    console.log("[/atendimento/download] resposta enviada", {
      empresa_id,
      midia_id: id,
      status: 200,
      mime_type: mimeType,
      bytes: totalSize,
      elapsed_ms: Date.now() - startedAt,
    });
    return res.end(fileToSend);
  } catch (error) {
    if (error?.code === "META_MEDIA_PERMANENTLY_UNAVAILABLE" && conversaId) {
      try {
        const marked = await execute.execute_mark_message_media_unavailable(
          conversaId,
          id
        );
        console.warn("[/atendimento/download] midia marcada como indisponivel", {
          empresa_id,
          conversa_id: conversaId,
          midia_id: id,
          mensagens_atualizadas: marked.length,
          meta_error: error?.metaError || null,
        });
      } catch (markError) {
        console.error("[/atendimento/download] falha ao marcar midia indisponivel", {
          empresa_id,
          conversa_id: conversaId,
          midia_id: id,
          message: markError?.message || String(markError),
        });
      }
    }
    console.error("[/atendimento/download] falha ao baixar midia", {
      empresa_id,
      midia_id: id,
      conversa_id: conversaId,
      requested_format: requestedFormat || null,
      message: error?.message || String(error),
      status: error?.response?.status || null,
      response_data: error?.response?.data || null,
      code: error?.code || null,
      stack: error?.stack || null,
      elapsed_ms: Date.now() - startedAt,
    });
    if (error?.code === "META_MEDIA_PERMANENTLY_UNAVAILABLE") {
      return res.status(410).json(
        utils.jsonMount(false, {}, "Esta midia nao esta mais disponivel.")
      );
    }
    return res.json(utils.errorHandle(error, "/atendimento/download"));
  }
});

rota.get("/download_external/:empresa_id", async (req, res) => {
  const startedAt = Date.now();
  const empresaId = Number(req.params.empresa_id);
  const conversaId = Number(req.query.conversa_id || 0) || null;
  const requestedFormat = String(req.query.format || "mp3").trim().toLowerCase();
  const externalUrl = String(req.query.url || "").trim();
  const rangeHeader = String(req.headers.range || "").trim();

  if (!isAllowedExternalMediaUrl(externalUrl, empresaId)) {
    return res
      .status(400)
      .json(utils.jsonMount(false, {}, "URL externa de midia invalida ou nao autorizada."));
  }

  if (requestedFormat !== "mp3") {
    return res
      .status(400)
      .json(utils.jsonMount(false, {}, "O unico formato de saida suportado e mp3."));
  }

  const sourcePath = new URL(externalUrl).pathname;
  const sourceExtension = path.extname(sourcePath).replace(/^\./, "").toLowerCase() || "bin";
  const allowedAudioExtensions = new Set(["ogg", "opus", "oga", "mp3", "m4a", "mp4", "aac", "amr", "wav"]);

  if (!allowedAudioExtensions.has(sourceExtension)) {
    return res
      .status(400)
      .json(utils.jsonMount(false, {}, "O arquivo externo informado nao e um audio suportado."));
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 30000);

  try {
    const upstreamResponse = await fetch(externalUrl, {
      method: "GET",
      headers: { Accept: "audio/*,application/octet-stream;q=0.8" },
      signal: abortController.signal,
    });

    if (!upstreamResponse.ok) {
      return res
        .status(upstreamResponse.status || 502)
        .json(utils.jsonMount(false, {}, "Nao foi possivel baixar o audio externo."));
    }

    const declaredSize = Number(upstreamResponse.headers.get("content-length") || 0);
    const maxAudioBytes = 32 * 1024 * 1024;
    if (declaredSize > maxAudioBytes) {
      return res
        .status(413)
        .json(utils.jsonMount(false, {}, "O audio externo ultrapassa o limite de 32MB."));
    }

    const sourceBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
    if (sourceBuffer.length > maxAudioBytes) {
      return res
        .status(413)
        .json(utils.jsonMount(false, {}, "O audio externo ultrapassa o limite de 32MB."));
    }

    const mp3Buffer = ["mp3"].includes(sourceExtension)
      ? sourceBuffer
      : await utils.convertAudioBufferToMp3(sourceBuffer, sourceExtension);
    const totalSize = Buffer.byteLength(mp3Buffer);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", 'inline; filename="audio.mp3"');
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Accept-Ranges", "bytes");

    if (rangeHeader && /^bytes=\d*-\d*$/i.test(rangeHeader)) {
      const [rawStart, rawEnd] = rangeHeader.replace(/bytes=/i, "").split("-");
      const parsedStart = rawStart === "" ? 0 : Number(rawStart);
      const parsedEnd = rawEnd === "" ? totalSize - 1 : Number(rawEnd);

      if (
        !Number.isInteger(parsedStart) ||
        !Number.isInteger(parsedEnd) ||
        parsedStart < 0 ||
        parsedEnd < parsedStart ||
        parsedStart >= totalSize
      ) {
        res.status(416);
        res.setHeader("Content-Range", `bytes */${totalSize}`);
        return res.end();
      }

      const end = Math.min(parsedEnd, totalSize - 1);
      const chunk = mp3Buffer.subarray(parsedStart, end + 1);
      res.status(206);
      res.setHeader("Content-Range", `bytes ${parsedStart}-${end}/${totalSize}`);
      res.setHeader("Content-Length", String(chunk.length));
      return res.end(chunk);
    }

    res.setHeader("Content-Length", String(totalSize));
    return res.end(mp3Buffer);
  } catch (error) {
    const aborted = error?.name === "AbortError";
    console.error("[/atendimento/download_external] falha", {
      empresa_id: empresaId,
      conversa_id: conversaId,
      host: (() => {
        try { return new URL(externalUrl).hostname; } catch (_error) { return null; }
      })(),
      source_extension: sourceExtension,
      requested_format: requestedFormat,
      range: rangeHeader || null,
      elapsed_ms: Date.now() - startedAt,
      message: error?.message || String(error),
    });
    return res
      .status(aborted ? 504 : 500)
      .json(utils.jsonMount(false, {}, aborted
        ? "Tempo limite ao baixar o audio externo."
        : "Nao foi possivel converter o audio externo."));
  } finally {
    clearTimeout(timeoutId);
  }
});

rota.get("/meta_referral_media/:empresa_id", async (req, res) => {
  try {
    const mediaUrl = String(req.query.url || "").trim();

    if (!isAllowedMetaReferralMediaUrl(mediaUrl)) {
      return res
        .status(400)
        .json(utils.jsonMount(false, {}, "URL de midia do Meta Ads invalida."));
    }

    const rangeHeader = String(req.headers.range || "").trim();
    const upstreamHeaders = {
      Accept: "*/*",
      "User-Agent":
        req.get("user-agent") || "Mozilla/5.0 (compatible; CRM Meta Referral Preview)",
    };

    if (rangeHeader && /^bytes=\d*-\d*$/i.test(rangeHeader)) {
      upstreamHeaders.Range = rangeHeader;
    }

    const upstreamResponse = await fetch(mediaUrl, {
      method: "GET",
      headers: upstreamHeaders,
    });

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      return res
        .status(upstreamResponse.status || 502)
        .json(utils.jsonMount(false, {}, "Nao foi possivel carregar a midia do anuncio."));
    }

    const arrayBuffer = await upstreamResponse.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const remoteContentType = String(
      upstreamResponse.headers.get("content-type") || ""
    ).trim();
    const mimeType = remoteContentType || "video/mp4";
    const ext = getExtension(mimeType);
    const totalSize = fileBuffer.length;

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="meta-ad.${ext}"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Accept-Ranges", "bytes");

    if (upstreamResponse.status === 206) {
      const upstreamContentRange = upstreamResponse.headers.get("content-range");
      if (upstreamContentRange) {
        res.status(206);
        res.setHeader("Content-Range", upstreamContentRange);
      }

      res.setHeader("Content-Length", String(totalSize));
      return res.end(fileBuffer);
    }

    if (rangeHeader && /^bytes=\d*-\d*$/i.test(rangeHeader)) {
      const [rawStart, rawEnd] = rangeHeader.replace(/bytes=/i, "").split("-");
      const parsedStart = rawStart === "" ? 0 : Number(rawStart);
      const parsedEnd = rawEnd === "" ? totalSize - 1 : Number(rawEnd);

      if (
        !Number.isInteger(parsedStart) ||
        !Number.isInteger(parsedEnd) ||
        parsedStart < 0 ||
        parsedEnd < parsedStart ||
        parsedStart >= totalSize
      ) {
        res.status(416);
        res.setHeader("Content-Range", `bytes */${totalSize}`);
        return res.end();
      }

      const end = Math.min(parsedEnd, totalSize - 1);
      const chunk = fileBuffer.subarray(parsedStart, end + 1);

      res.status(206);
      res.setHeader("Content-Range", `bytes ${parsedStart}-${end}/${totalSize}`);
      res.setHeader("Content-Length", String(chunk.length));
      return res.end(chunk);
    }

    res.setHeader("Content-Length", String(totalSize));
    return res.end(fileBuffer);
  } catch (error) {
    console.error("Erro na rota /atendimento/meta_referral_media:", error);
    return res
      .status(500)
      .json(utils.errorHandle(error, "/atendimento/meta_referral_media"));
  }
});

rota.post("/upload_media", upload.array("file"), async (req, res) => {
  try {
    // multipart: nao passa pelo jwtdecript. O usuario e sempre o da sessao
    // (antes vinha do formulario e permitia enviar como outro usuario).
    const data = { ...req.body, usuario_id: req.auth.usuario_id };
    const files = Array.isArray(req.files) ? req.files : [];

    const access = await getConversaAccessContext(
      data.conversa_id,
      data.usuario_id
    );
    if (access.blocked) {
      return res.json(access.response);
    }

    const metaWindowGuard = await getMetaWindowLockResponse(data.conversa_id);
    if (metaWindowGuard.blocked) {
      return res.json(metaWindowGuard.response);
    }

    if (!files.length) {
      return res.json(
        utils.jsonMount(false, {}, "Nenhum arquivo foi enviado.")
      );
    }

    for (const [index, file] of files.entries()) {
      validateChatMediaUploadFile(file);

      if (shouldSendChatMediaAsDownloadLink(file)) {
        await uploadChatFileAndSendDownloadLink({
          req,
          file,
          numero: data.numero,
          caption: index === 0 ? data.caption : "",
          conversaId: data.conversa_id,
          empresaId: access.empresaId,
          usuarioId: Number(data.usuario_id) || null,
        });
        continue;
      }

      const absolutePath = path.resolve(file.path);
      const mime = file.mimetype || "";
      let fileType;

      if (mime === "image/webp") fileType = "sticker";
      else if (mime.startsWith("image/")) fileType = "image";
      else if (mime.startsWith("video/")) fileType = "video";
      else if (mime.startsWith("audio/")) fileType = "audio";
      else fileType = "document";

      await utils.sendmidia(
        data.numero,
        absolutePath,
        fileType,
        index === 0 ? data.caption : "",
        data.conversa_id,
        access.empresaId,
        {
          mimeType: file.mimetype,
          originalname: file.originalname,
          usuario_id: Number(data.usuario_id) || null,
        }
      );
    }

    return res.json(
      utils.jsonMount(true, { total: files.length }, "Arquivos enviados com sucesso!")
    );
  } catch (error) {
    for (const file of Array.isArray(req.files) ? req.files : []) {
      if (!file?.path) continue;
      fs.unlink(path.resolve(file.path), (unlinkError) => {
        if (unlinkError && unlinkError.code !== "ENOENT") {
          console.error("Erro ao limpar anexo rejeitado:", unlinkError.message);
        }
      });
    }
    return res.json(
      utils.jsonMount(false, {}, resolveUploadMediaErrorMessage(error))
    );
  }
});

rota.post("/enviar_imagens_produto_comercial", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const access = await getConversaAccessContext(
      data.conversa_id,
      data.usuario_id
    );
    if (access.blocked) {
      return res.json(access.response);
    }

    const metaWindowGuard = await getMetaWindowLockResponse(data.conversa_id);
    if (metaWindowGuard.blocked) {
      return res.json(metaWindowGuard.response);
    }

    const imageIds = Array.isArray(data.image_ids)
      ? data.image_ids
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];

    if (!imageIds.length) {
      return res.json(
        utils.jsonMount(false, {}, "Selecione ao menos uma imagem do produto.")
      );
    }

    const imagens = await executeVendas.execute_listar_imagens_produto_crm_por_ids(
      access.empresaId,
      imageIds
    );

    if (imagens.length !== imageIds.length) {
      return res.json(
        utils.jsonMount(false, {}, "Uma ou mais imagens selecionadas sao invalidas.")
      );
    }

    for (const [index, imagem] of imagens.entries()) {
      await utils.sendWhatsappImageByUrl(
        data.numero,
        imagem.url,
        index === 0 ? String(data.caption || "") : "",
        data.conversa_id,
        access.empresaId,
        Number(data.usuario_id) || null
      );
    }

    return res.json(
      utils.jsonMount(
        true,
        { total: imagens.length },
        "Imagens do produto enviadas com sucesso."
      )
    );
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/enviar_imagens_produto_comercial")
    );
  }
});

rota.post("/documento_cliente_upload", contactDocumentUpload.single("document"), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    const clienteId = Number(data.cliente_id);
    const file = req.file || null;

    if (!Number.isInteger(empresaId) || empresaId <= 0 || !Number.isInteger(clienteId) || clienteId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa e cliente validos."));
    }

    validateContactDocumentFile(file);
    await ensureContactDocumentLimit(empresaId, clienteId);

    const filePath = bunny.generateFileName(
      file.originalname || "documento",
      `cliente_documento_${clienteId}`
    );
    const uploaded = await bunny.uploadFile(filePath, file.buffer);
    const documento = await execute.execute_criar_cliente_documento({
      empresa_id: empresaId,
      cliente_id: clienteId,
      usuario_id: Number(data.usuario_id || data.user_id || data.id) || null,
      nome_arquivo: file.originalname || "documento",
      url: uploaded.file,
      path_bunny: filePath,
      mime_type: file.mimetype || null,
      tamanho_bytes: file.size || null,
      origem: "contato",
    });

    return res.json(utils.jsonMount(true, documento, "Documento salvo com sucesso."));
  } catch (error) {
    if (isContactDocumentMigrationMissing(error)) {
      return res.json(utils.jsonMount(false, {}, getContactDocumentMigrationMessage()));
    }
    return res.json(utils.errorHandle(error, "/documento_cliente_upload"));
  }
});

rota.post("/documento_cliente_deletar", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    const documentoId = Number(data.documento_id || data.documentoId || data.id);

    if (!Number.isInteger(empresaId) || empresaId <= 0 || !Number.isInteger(documentoId) || documentoId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa e documento validos."));
    }

    const documento = await execute.execute_get_cliente_documento_by_id(documentoId, empresaId);
    if (!documento || documento.ativo === false) {
      return res.json(utils.jsonMount(false, {}, "Documento nao encontrado."));
    }

    await execute.execute_deletar_cliente_documento(documentoId, empresaId);
    if (documento.path_bunny) {
      await bunny.deleteFile(documento.path_bunny);
    }

    return res.json(utils.jsonMount(true, {}, "Documento removido com sucesso."));
  } catch (error) {
    if (isContactDocumentMigrationMissing(error)) {
      return res.json(utils.jsonMount(false, {}, getContactDocumentMigrationMessage()));
    }
    return res.json(utils.errorHandle(error, "/documento_cliente_deletar"));
  }
});


rota.post("/upload_audio", upload.single('file'), async (req, res) => {
    try {
        const { conversa_id, numero, duration } = req.body;
        const usuario_id = req.auth.usuario_id;
        const access = await getConversaAccessContext(conversa_id, usuario_id);
        if (access.blocked) {
          return res.json(access.response);
        }
        const metaWindowGuard = await getMetaWindowLockResponse(conversa_id);
        if (metaWindowGuard.blocked) {
          return res.json(metaWindowGuard.response);
        }
        await utils.sendAudio(
            numero,
            req.file.path,
            conversa_id,
            'audio',
            access.empresaId,
            Number(usuario_id) || null,
            {
              durationSeconds: Number(duration) || 0
            }
        );
        res.json(utils.jsonMount(true, {}, "Ãudio enviado com sucesso"));
    } catch (error) {
        res.json(utils.errorHandle(error, "/upload_audio"));
    }
});

module.exports = rota;
