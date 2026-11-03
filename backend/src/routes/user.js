const express = require("express");
const rota = express.Router();
const execute = require("../services/execute_user");
const security = require("../security/cypher");
const { requireTenantOwnership, requireMasterOrPermission } = require("../security/tenant_guard");
const utils = require("../utils/templates");
const upload = require("../utils/multer_config");
const bunny = require("../utils/bunny_config");
const { getDefaultPromptAnaliseAtendimento } = require("../functions/function_atendimento");

const QUICK_MESSAGE_DOCUMENT_LIMIT = 5;
const QUICK_MESSAGE_AUDIO_LIMIT = 60;
const QUICK_MESSAGE_IMAGE_FILE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
const QUICK_MESSAGE_DOCUMENT_FILE_SIZE_LIMIT_BYTES = 100 * 1024 * 1024;
const QUICK_MESSAGE_AUDIO_FILE_SIZE_LIMIT_BYTES = 16 * 1024 * 1024;
const QUICK_MESSAGE_VIDEO_LIMIT = 10;
const QUICK_MESSAGE_VIDEO_FILE_SIZE_LIMIT_BYTES = 16 * 1024 * 1024;
const PROFILE_PHOTO_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function normalizePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildWelcomeAutoMessageOptions(data = {}) {
  return {
    meta_param_id: normalizePositiveInt(data?.meta_param_id),
    mensagem_complementar_texto: data?.mensagem_complementar_texto,
    galeria_imagem_id: normalizePositiveInt(data?.galeria_imagem_id),
  };
}

function buildAutoMessageScopeOptions(data = {}) {
  return {
    meta_param_id: normalizePositiveInt(data?.meta_param_id),
  };
}

function buildBirthdayTemplateConfigOptions(data = {}) {
  return {
    meta_param_id: normalizePositiveInt(data?.meta_param_id),
    template_name: data?.template_name,
    template_language: data?.template_language || data?.language,
    horario: data?.horario,
    is_default_dispatch_number: parseBooleanFlag(
      data?.is_default_dispatch_number
    ),
    header_media_type: data?.header_media_type,
    header_media_url: data?.header_media_url,
    header_parameters: Array.isArray(data?.header_parameters)
      ? data.header_parameters
      : [],
    body_parameters: Array.isArray(data?.body_parameters)
      ? data.body_parameters
      : [],
    button_parameters: Array.isArray(data?.button_parameters)
      ? data.button_parameters
      : [],
  };
}

function buildTemplateAutomationConfigOptions(data = {}) {
  return {
    automation_type: data?.automation_type,
    meta_param_id: normalizePositiveInt(data?.meta_param_id),
    template_name: data?.template_name,
    template_language: data?.template_language || data?.language,
    horario: data?.horario,
    delay_days:
      data?.delay_days === undefined || data?.delay_days === null || data?.delay_days === ""
        ? null
        : Number(data.delay_days),
    is_default_dispatch_number: parseBooleanFlag(
      data?.is_default_dispatch_number
    ),
    header_media_type: data?.header_media_type,
    header_media_url: data?.header_media_url,
    header_parameters: Array.isArray(data?.header_parameters)
      ? data.header_parameters
      : [],
    body_parameters: Array.isArray(data?.body_parameters)
      ? data.body_parameters
      : [],
    button_parameters: Array.isArray(data?.button_parameters)
      ? data.button_parameters
      : [],
  };
}

function parseBooleanFlag(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

const QUICK_MESSAGE_MEDIA_TYPES = ["image", "document", "audio", "video"];

function normalizeQuickMessageMediaOrder(value, availableTypes) {
  let requested = value;
  if (typeof requested === "string") {
    try {
      requested = JSON.parse(requested);
    } catch {
      requested = requested.split(",");
    }
  }

  const available = new Set(
    (Array.isArray(availableTypes) ? availableTypes : [])
      .map((item) => String(item || "").trim().toLowerCase())
      .filter((item) => QUICK_MESSAGE_MEDIA_TYPES.includes(item))
  );
  const normalized = [];

  for (const item of Array.isArray(requested) ? requested : []) {
    const type = String(item || "").trim().toLowerCase();
    if (available.has(type) && !normalized.includes(type)) normalized.push(type);
  }
  for (const type of QUICK_MESSAGE_MEDIA_TYPES) {
    if (available.has(type) && !normalized.includes(type)) normalized.push(type);
  }
  return normalized;
}

async function getQuickMessageActor(data) {
  const empresaId = normalizePositiveInt(data?.empresa_id);
  const usuarioId = normalizePositiveInt(data?.usuario_id ?? data?.user_id ?? data?.id_usuario);
  if (!empresaId || !usuarioId) throw new Error("Informe usuario e empresa validos.");

  const actor = await execute.execute_get_quick_message_user_context(usuarioId, empresaId);
  if (!actor) throw new Error("Usuario ativo nao encontrado nesta empresa.");
  return actor;
}

async function resolveQuickMessageOwner(data, actor, currentOwnerId = undefined) {
  if (!actor.is_master) return Number(actor.id);
  if (String(data?.escopo || "").trim().toLowerCase() === "global") return null;

  const requestedOwnerId = normalizePositiveInt(data?.mensagem_usuario_id);
  const ownerId = requestedOwnerId ?? currentOwnerId ?? Number(actor.id);
  const owner = await execute.execute_get_quick_message_user_context(ownerId, actor.empresa_id);
  if (!owner) throw new Error("Usuario selecionado nao pertence a esta empresa.");
  return Number(owner.id);
}

function normalizeDashboardDate(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
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
    message.includes("ordem_midias") ||
    message.includes("mensagens_rapidas.usuario_id") ||
    message.includes("mr.usuario_id") ||
    message.includes("usar_texto_como_legenda") ||
    message.includes("comercial_produto_documento")
  );
}

function getQuickMessagesGalleryMigrationMessage() {
  return "A estrutura de arquivos das mensagens rapidas ainda nao foi criada no banco. Execute o alter_db.txt para liberar imagens, documentos, audios e galeria.";
}

function validateQuickMessageImage(file) {
  if (!file) {
    throw new Error("Nenhuma imagem foi enviada.");
  }
  if (!["image/jpeg", "image/png"].includes(String(file.mimetype || "").toLowerCase())) {
    throw new Error("A Meta aceita apenas imagens JPEG ou PNG.");
  }
  if (Number(file.size || 0) > QUICK_MESSAGE_IMAGE_FILE_SIZE_LIMIT_BYTES) {
    throw new Error("A imagem deve ter no maximo 5MB, limite da Meta.");
  }
}

function validateQuickMessageDocument(file) {
  if (!file) {
    throw new Error("Nenhum documento foi enviado.");
  }
  if (String(file.mimetype || "").toLowerCase() !== "application/pdf") {
    throw new Error("Apenas arquivos PDF sao permitidos.");
  }
  if (Number(file.size || 0) > QUICK_MESSAGE_DOCUMENT_FILE_SIZE_LIMIT_BYTES) {
    throw new Error("O documento deve ter no maximo 100MB, limite da Meta.");
  }
}

function validateQuickMessageAudio(file) {
  if (!file) {
    throw new Error("Nenhum audio foi enviado.");
  }
  if (!["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"].includes(String(file.mimetype || "").toLowerCase())) {
    throw new Error("Formato de audio nao aceito pela Meta. Use AAC, M4A, MP3, AMR ou OGG/Opus.");
  }
  if (Number(file.size || 0) > QUICK_MESSAGE_AUDIO_FILE_SIZE_LIMIT_BYTES) {
    throw new Error("O audio deve ter no maximo 16MB.");
  }
}

function validateQuickMessageVideo(file) {
  if (!file) throw new Error("Selecione um video para enviar.");
  if (!["video/mp4", "video/3gpp"].includes(String(file.mimetype || "").toLowerCase())) {
    throw new Error("A Meta aceita apenas videos MP4 ou 3GP com H.264 e AAC.");
  }
  if (Number(file.size || 0) > QUICK_MESSAGE_VIDEO_FILE_SIZE_LIMIT_BYTES) {
    throw new Error("Cada video deve ter no maximo 16MB, limite da Meta.");
  }
}

function parseQuickMessageContent(value) {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeIdList(value, limit = Number.MAX_SAFE_INTEGER) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizePositiveInt).filter(Boolean))].slice(0, limit);
}

function galleryItem(record) {
  return {
    id: Number(record.id),
    url: String(record.url || ""),
    name: String(record.nome_arquivo || "arquivo"),
    mime_type: record.mime_type || null,
    size: Number(record.tamanho_bytes || 0) || null,
  };
}

async function normalizeQuickMessageContent(value, empresaId) {
  const input = parseQuickMessageContent(value);
  if (!input) return null;

  const texts = (Array.isArray(input.texts) ? input.texts : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const imageIds = normalizeIdList(input.image_ids ?? input.images);
  const documentIds = normalizeIdList(input.document_ids ?? input.documents);
  const audioIds = normalizeIdList(input.audio_ids ?? input.audios);
  const videoIds = normalizeIdList(input.video_ids ?? input.videos, QUICK_MESSAGE_VIDEO_LIMIT + 1);

  if (videoIds.length > QUICK_MESSAGE_VIDEO_LIMIT) {
    throw new Error(`Limite de ${QUICK_MESSAGE_VIDEO_LIMIT} videos por mensagem rapida atingido.`);
  }

  const resolve = async (ids, getter, label, mimePrefix = "") => Promise.all(ids.map(async (id) => {
    const record = await getter(id, empresaId);
    if (!record?.id || (mimePrefix && !String(record.mime_type || "").toLowerCase().startsWith(mimePrefix))) {
      throw new Error(`${label} da galeria nao encontrado ou invalido.`);
    }
    return galleryItem(record);
  }));

  const [images, documents, audios, videos] = await Promise.all([
    resolve(imageIds, execute.execute_get_galeria_imagem_by_id_empresa, "Imagem", "image/"),
    resolve(documentIds, execute.execute_get_galeria_documento_by_id_empresa, "Documento"),
    resolve(audioIds, execute.execute_get_galeria_audio_by_id_empresa, "Audio", "audio/"),
    resolve(videoIds, execute.execute_get_galeria_imagem_by_id_empresa, "Video", "video/"),
  ]);
  const validateStoredItems = (items, maxBytes, label, allowedMimes = null) => {
    for (const item of items) {
      const mime = String(item.mime_type || "").toLowerCase();
      if (allowedMimes && !allowedMimes.includes(mime)) {
        throw new Error(`${label} "${item.name}" possui formato nao aceito pela Meta.`);
      }
      if (Number(item.size || 0) > maxBytes) {
        throw new Error(`${label} "${item.name}" ultrapassa o limite de ${maxBytes / 1024 / 1024}MB da Meta.`);
      }
    }
  };
  validateStoredItems(images, QUICK_MESSAGE_IMAGE_FILE_SIZE_LIMIT_BYTES, "Imagem", ["image/jpeg", "image/png"]);
  validateStoredItems(documents, QUICK_MESSAGE_DOCUMENT_FILE_SIZE_LIMIT_BYTES, "Documento");
  validateStoredItems(audios, QUICK_MESSAGE_AUDIO_FILE_SIZE_LIMIT_BYTES, "Audio", ["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"]);
  validateStoredItems(videos, QUICK_MESSAGE_VIDEO_FILE_SIZE_LIMIT_BYTES, "Video", ["video/mp4", "video/3gpp"]);
  const available = [
    ...(images.length ? ["image"] : []),
    ...(documents.length ? ["document"] : []),
    ...(audios.length ? ["audio"] : []),
    ...(videos.length ? ["video"] : []),
  ];
  const collections = { image: images, document: documents, audio: audios, video: videos };
  const sequence = [];
  const usedTexts = new Set();
  const usedMedia = new Set();
  for (const rawItem of Array.isArray(input.sequence) ? input.sequence : []) {
    const type = String(rawItem?.type || "").toLowerCase();
    if (type === "text") {
      const textIndex = Number(rawItem?.text_index);
      if (Number.isInteger(textIndex) && texts[textIndex] && !usedTexts.has(textIndex)) {
        sequence.push({ type: "text", text_index: textIndex });
        usedTexts.add(textIndex);
      }
      continue;
    }
    if (!QUICK_MESSAGE_MEDIA_TYPES.includes(type)) continue;
    const id = normalizePositiveInt(rawItem?.id);
    const record = collections[type]?.find((item) => Number(item.id) === id);
    const mediaKey = `${type}:${id}`;
    if (!record || usedMedia.has(mediaKey)) continue;
    const supportsCaption = ["image", "video", "document"].includes(type);
    const captionIndex = supportsCaption ? Number(rawItem?.caption_text_index) : NaN;
    const hasCaption = Number.isInteger(captionIndex) && Boolean(texts[captionIndex]);
    if (hasCaption && texts[captionIndex].length > 1024) {
      throw new Error("Legenda da midia deve ter no maximo 1024 caracteres.");
    }
    sequence.push({
      type,
      id,
      ...(hasCaption ? { caption_text_index: captionIndex } : {}),
    });
    usedMedia.add(mediaKey);
  }
  texts.forEach((_, index) => {
    if (!usedTexts.has(index)) sequence.push({ type: "text", text_index: index });
  });
  for (const type of QUICK_MESSAGE_MEDIA_TYPES) {
    for (const item of collections[type] || []) {
      if (!usedMedia.has(`${type}:${item.id}`)) sequence.push({ type, id: item.id });
    }
  }

  return {
    version: 2,
    texts,
    order: normalizeQuickMessageMediaOrder(input.order, available),
    images,
    documents,
    audios,
    videos,
    sequence,
  };
}

async function ensureQuickMessageDocumentLimit(empresaId) {
  const total = await execute.execute_contar_galeria_documentos_empresa(empresaId);
  if (total >= QUICK_MESSAGE_DOCUMENT_LIMIT) {
    throw new Error(
      `A galeria de mensagens rapidas permite no maximo ${QUICK_MESSAGE_DOCUMENT_LIMIT} documentos ativos. Remova um documento sem uso antes de enviar outro.`
    );
  }
}

async function ensureQuickMessageAudioLimit(empresaId) {
  const total = await execute.execute_contar_galeria_audios_empresa(empresaId);
  if (total >= QUICK_MESSAGE_AUDIO_LIMIT) {
    throw new Error(
      `A galeria de mensagens rapidas permite no maximo ${QUICK_MESSAGE_AUDIO_LIMIT} audios ativos. Remova um audio sem uso antes de enviar outro.`
    );
  }
}

function validateProfilePhoto(file) {
  if (!file) {
    throw new Error("Envie uma foto de perfil.");
  }

  if (!PROFILE_PHOTO_ALLOWED_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
    throw new Error("Envie uma imagem JPG, PNG, WEBP ou GIF para foto de perfil.");
  }

  if (Number(file.size || 0) > PROFILE_PHOTO_MAX_SIZE_BYTES) {
    throw new Error("A foto de perfil pode ter no maximo 5MB.");
  }
}

async function salvarFotoPerfilUsuario({ empresaId, usuarioId, file }) {
  validateProfilePhoto(file);

  const filePath = bunny.generateFileName(
    file.originalname,
    `perfil_usuario_${empresaId}_${usuarioId}`
  );
  const uploaded = await bunny.uploadFile(filePath, file.buffer);

  return execute.execute_salvar_foto_perfil({
    usuario_id: usuarioId,
    empresa_id: empresaId,
    nome_arquivo: file.originalname || "foto-perfil",
    url: uploaded.file,
    path_bunny: filePath,
    mime_type: file.mimetype || null,
    tamanho_bytes: file.size || null,
  });
}

async function criarImagemGaleriaEmpresa({ empresaId, file, origem }) {
  validateQuickMessageImage(file);

  const filePath = bunny.generateFileName(
    file.originalname,
    `${origem || "empresa"}_${empresaId}`
  );
  const uploaded = await bunny.uploadFile(filePath, file.buffer);

  return execute.execute_criar_galeria_imagem_empresa({
    empresa_id: empresaId,
    nome_arquivo: file.originalname || "imagem",
    url: uploaded.file,
    path_bunny: filePath,
    mime_type: file.mimetype || null,
    tamanho_bytes: file.size || null,
    origem: origem || "manual",
  });
}

async function criarDocumentoGaleriaEmpresa({ empresaId, file, origem }) {
  validateQuickMessageDocument(file);
  await ensureQuickMessageDocumentLimit(empresaId);

  const filePath = bunny.generateFileName(
    file.originalname,
    `${origem || "empresa_documento"}_${empresaId}`
  );
  const uploaded = await bunny.uploadFile(filePath, file.buffer);

  return execute.execute_criar_galeria_documento_empresa({
    empresa_id: empresaId,
    nome_arquivo: file.originalname || "documento.pdf",
    url: uploaded.file,
    path_bunny: filePath,
    mime_type: file.mimetype || null,
    tamanho_bytes: file.size || null,
    origem: origem || "manual",
  });
}

async function criarAudioGaleriaEmpresa({ empresaId, file, origem }) {
  validateQuickMessageAudio(file);
  await ensureQuickMessageAudioLimit(empresaId);

  const filePath = bunny.generateFileName(
    file.originalname,
    `${origem || "empresa_audio"}_${empresaId}`
  );
  const uploaded = await bunny.uploadFile(filePath, file.buffer);

  return execute.execute_criar_galeria_audio_empresa({
    empresa_id: empresaId,
    nome_arquivo: file.originalname || "audio",
    url: uploaded.file,
    path_bunny: filePath,
    mime_type: file.mimetype || null,
    tamanho_bytes: file.size || null,
    origem: origem || "manual",
  });
}

async function criarVideoGaleriaEmpresa({ empresaId, file, origem }) {
  validateQuickMessageVideo(file);
  const filePath = bunny.generateFileName(file.originalname, `${origem || "empresa_video"}_${empresaId}`);
  const uploaded = await bunny.uploadFile(filePath, file.buffer);
  return execute.execute_criar_galeria_imagem_empresa({
    empresa_id: empresaId,
    nome_arquivo: file.originalname || "video",
    url: uploaded.file,
    path_bunny: filePath,
    mime_type: file.mimetype || null,
    tamanho_bytes: file.size || null,
    origem: origem || "mensagem_rapida_video",
  });
}

///////////////clientes////////////////////////////////////////////////////////////////////////////////////////////////

rota.post("/dados_contato", requireTenantOwnership([["cliente_id", "cliente"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const cliente = await execute.execute_get_dados_cliente(data.cliente_id);
    const tags = await execute.execute_get_clientes_tags(data.cliente_id);
    const anotacoes = await execute.execute_get_notas(data.cliente_id);
    const retorno = {
      cliente: cliente[0],
      tags: tags,
      anotacoees: anotacoes,
    };
    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/dados_contato"));
  }
});

rota.post("/lista_clientes", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const pagina = Math.max(Number(data.pagina) || 1, 1);
    const limiteSolicitado = Math.max(Number(data.limite) || 12, 1);
    const limite = Math.min(limiteSolicitado, 50);
    const busca = String(data.busca || "").trim();
    const filtroInformado = String(data.filtro || "all").trim().toLowerCase();
    const filtrosPermitidos = new Set(["all", "birthday_5_days", "with_crm", "without_crm"]);
    const filtro = filtrosPermitidos.has(filtroInformado) ? filtroInformado : "all";
    const filtrosCompostosInformados =
      data.filtros_compostos && typeof data.filtros_compostos === "object"
        ? data.filtros_compostos
        : {};
    const origemCompostaInformada = String(filtrosCompostosInformados.origem || "")
      .trim()
      .toLowerCase();
    const origensCompostasPermitidas = new Set([
      "",
      "manual",
      "whatsapp",
      "meta_ads",
      "importacao",
      "comercial",
    ]);
    const normalizeDateFilter = (value) => {
      const normalized = String(value || "").trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
    };
    const normalizePositiveIntArrayFilter = (value) => {
      if (!Array.isArray(value)) return [];
      return [...new Set(
        value
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item > 0)
      )];
    };

    let dataEntradaInicial = normalizeDateFilter(
      filtrosCompostosInformados.data_entrada_inicial
    );
    let dataEntradaFinal = normalizeDateFilter(
      filtrosCompostosInformados.data_entrada_final
    );

    if (dataEntradaInicial && dataEntradaFinal && dataEntradaInicial > dataEntradaFinal) {
      [dataEntradaInicial, dataEntradaFinal] = [dataEntradaFinal, dataEntradaInicial];
    }

    const filtrosCompostos = {
      utm: String(filtrosCompostosInformados.utm || "").trim(),
      origem: origensCompostasPermitidas.has(origemCompostaInformada)
        ? origemCompostaInformada
        : "",
      tag_ids: normalizePositiveIntArrayFilter(filtrosCompostosInformados.tag_ids),
      data_entrada_inicial: dataEntradaInicial,
      data_entrada_final: dataEntradaFinal,
    };

    const [cliente, totalRet] = await Promise.all([
      execute.execute_get_lista_clientes({
        pagina,
        empresa_id: data.empresa_id,
        usuario_id: data.usuario_id ?? data.id,
        limite,
        busca,
        filtro,
        filtros_compostos: filtrosCompostos,
      }),
      execute.execute_count_lista_clientes({
        empresa_id: data.empresa_id,
        usuario_id: data.usuario_id ?? data.id,
        busca,
        filtro,
        filtros_compostos: filtrosCompostos,
      }),
    ]);
    const total = Number(totalRet?.[0]?.total || 0);
    return res.json(
      utils.jsonMount(
        true,
        {
          items: cliente,
          total,
          pagina,
          limite,
          total_paginas: Math.ceil(total / limite),
          filtro,
          filtros_compostos: filtrosCompostos,
          busca,
        },
        ""
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/lista_clientes"));
  }
});

rota.post("/alterar_cliente", requireTenantOwnership([["cliente_id", "cliente"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    await execute.execute_alterar_cliente(
      data.nome,
      data.email,
      data.cpf,
      data.data_aniversario,
      data.cliente_id,
      data.origem,
      data.logradouro,
      data.numero,
      data.complemento,
      data.bairro,
      data.cidade,
      data.uf,
      data.cep,
      data.empresa,
      data.cargo,
      data.faturamento
    );
    return res.json(utils.jsonMount(true, {}, "Cliente alterado com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/alterar_cliente"));
  }
});

rota.post("/criar_cliente", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const cliente = await execute.execute_criar_cliente(
      data.empresa_id,
      data.nome,
      data.email,
      data.telefone,
      data.cpf,
      data.data_aniversario,
      data.origem,
      data.logradouro,
      data.numero,
      data.complemento,
      data.bairro,
      data.cidade,
      data.uf,
      data.cep,
      data.empresa,
      data.cargo,
      data.faturamento
    );

    return res.json(utils.jsonMount(true, cliente || {}, "Cliente criado com sucesso!"));
  } catch (error) {
    if (error?.publicMessage) {
      return res.json(utils.jsonMount(false, {}, error.publicMessage));
    }
    return res.json(utils.errorHandle(error, "/criar_cliente"));
  }
});

rota.post("/remover_cliente", requireTenantOwnership([["cliente_id", "cliente"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    await execute.execute_remover_cliente(data.cliente_id);
    return res.json(utils.jsonMount(true, {}, "Cliente removido com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/alterar_cliente"));
  }
});

rota.post("/importar_clientes", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const resultado = await execute.execute_importar_clientes(
      data.rows,
      data.empresa_id
    );

    return res.json(
      utils.jsonMount(true, resultado, "Importacao de clientes concluida.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/importar_clientes"));
  }
});

rota.post("/listar_listas_transmissao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const listas = await execute.execute_listar_listas_transmissao(
      data.empresa_id,
      data.usuario_id,
      data.meta_param_id
    );
    return res.json(utils.jsonMount(true, listas, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/listar_listas_transmissao"));
  }
});

rota.post("/listar_numeros_meta_lista_transmissao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const numeros = await execute.execute_list_empresa_meta_numeros_ativos(
      data.empresa_id,
      data.usuario_id
    );
    return res.json(utils.jsonMount(true, numeros, ""));
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/listar_numeros_meta_lista_transmissao")
    );
  }
});

rota.post("/criar_lista_transmissao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const lista = await execute.execute_criar_lista_transmissao({
      empresa_id: data.empresa_id,
      usuario_id: data.usuario_id,
      meta_param_id: data.meta_param_id,
      nome: data.nome,
      descricao: data.descricao,
    });

    return res.json(
      utils.jsonMount(true, lista || {}, "Lista de transmissao criada com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/criar_lista_transmissao"));
  }
});

rota.post("/editar_lista_transmissao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const lista = await execute.execute_editar_lista_transmissao({
      empresa_id: data.empresa_id,
      usuario_id: data.usuario_id,
      lista_id: data.lista_id,
      meta_param_id: data.meta_param_id,
      nome: data.nome,
      descricao: data.descricao,
      tag_logic: data.tag_logic,
      tag_ids: data.tag_ids,
      utm_filters: data.utm_filters,
    });

    return res.json(
      utils.jsonMount(true, lista || {}, "Lista de transmissao atualizada com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_lista_transmissao"));
  }
});

rota.post("/deletar_lista_transmissao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    await execute.execute_deletar_lista_transmissao(
      data.empresa_id,
      data.usuario_id,
      data.lista_id
    );
    return res.json(
      utils.jsonMount(true, {}, "Lista de transmissao removida com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/deletar_lista_transmissao"));
  }
});

rota.post("/contatos_lista_transmissao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const contatos = await execute.execute_get_contatos_lista_transmissao(
      data.empresa_id,
      data.usuario_id,
      data.lista_id
    );
    return res.json(utils.jsonMount(true, contatos, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/contatos_lista_transmissao"));
  }
});

rota.post("/adicionar_contato_lista_transmissao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const resultado = await execute.execute_adicionar_contato_lista_transmissao({
      empresa_id: data.empresa_id,
      usuario_id: data.usuario_id,
      lista_id: data.lista_id,
      cliente_id: data.cliente_id,
    });

    return res.json(
      utils.jsonMount(true, resultado, "Contato adicionado a lista com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/adicionar_contato_lista_transmissao"));
  }
});

rota.post("/remover_contato_lista_transmissao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const resultado = await execute.execute_remover_contato_lista_transmissao({
      empresa_id: data.empresa_id,
      usuario_id: data.usuario_id,
      lista_id: data.lista_id,
      cliente_id: data.cliente_id,
    });

    return res.json(
      utils.jsonMount(true, resultado, "Contato removido da lista com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/remover_contato_lista_transmissao"));
  }
});

rota.post("/sincronizar_lista_transmissao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const resultado = await execute.execute_sincronizar_lista_transmissao({
      empresa_id: data.empresa_id,
      usuario_id: data.usuario_id,
      lista_id: data.lista_id,
    });

    return res.json(
      utils.jsonMount(
        true,
        resultado,
        "Lista de transmissao sincronizada com sucesso!"
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/sincronizar_lista_transmissao"));
  }
});

//////////////tags////////////////////////////////////////////////////////////////////////////////////////////////////////

rota.post("/busca_tag", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const tag = await execute.execute_get_busca_tag(data.pesquisa, data.empresa_id);
    return res.json(utils.jsonMount(true, tag, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/busca_tag"));
  }
});

rota.post("/criar_tag", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const nome = String(data.nome || "").trim();
    const criada = await execute.execute_create_tag(nome, data.empresa_id);
    const tag =
      criada[0] ||
      (await execute.execute_get_tag_by_nome(nome, data.empresa_id))[0] ||
      null;

    if (!tag) {
      return res.json(utils.jsonMount(false, {}, "Nao foi possivel criar a tag."));
    }

    return res.json(utils.jsonMount(true, tag, "Tag criada com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/alterar_cliente"));
  }
});

rota.post("/vincular_tag", requireTenantOwnership([["cliente_id", "cliente"], ["tag_id", "tag"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    await execute.execute_create_vinculo(data.tag_id, data.cliente_id);
    return res.json(utils.jsonMount(true, {}, "Tag vinculada com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vincular_tag"));
  }
});

rota.post("/remover_vinculo_tag", requireTenantOwnership([["cliente_id", "cliente"], ["tag_id", "tag"]]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    await execute.execute_remover_vinculo(data.cliente_id, data.tag_id);
    return res.json(utils.jsonMount(true, {}, "Tag removida com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/remover_vinculo_tag"));
  }
});

rota.post("/criar_vincular_tag", requireTenantOwnership([["cliente_id", "cliente"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const nome = String(data.nome || "").trim();
    const criada = await execute.execute_create_tag(nome, data.empresa_id);
    const tag =
      criada[0] ||
      (await execute.execute_get_tag_by_nome(nome, data.empresa_id))[0] ||
      null;

    if (!tag?.id) {
      return res.json(
        utils.jsonMount(false, {}, "Nao foi possivel criar ou localizar a tag."),
      );
    }

    await execute.execute_create_vinculo(tag.id, data.cliente_id);
    return res.json(utils.jsonMount(true, tag, "Tag vinculada com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/alterar_cliente"));
  }
});

rota.post("/remover_vinculo", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    await execute.execute_remover_vinculo(data.usuario_id, data.tag_id);
    return res.json(utils.jsonMount(true, {}, "Tag removida com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/alterar_cliente"));
  }
});

rota.post("/deletar_tag", requireTenantOwnership([["tag_id", "tag"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    await execute.execute_deletar_tag(data.tag_id);
    await execute.execute_remover_vinculo_em_massa(data.tag_id);
    return res.json(utils.jsonMount(true, {}, "Tag removida com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/alterar_cliente"));
  }
});

rota.post("/lista_tags", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }
    const tags = await execute.execute_get_lista_tags(data.empresa_id);
    if (tags.length <= 0) {
      return res.json(utils.jsonMount(false, [], "Nenhuma tag registrada!"));
    }
    return res.json(utils.jsonMount(true, tags, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/alterar_cliente"));
  }
});

rota.post("/alterar_tag", requireTenantOwnership([["tag_id", "tag"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const nome = String(data.nome || data.name || "").trim();
    if (!nome) {
      return res.json(utils.jsonMount(false, {}, "Informe o nome da tag."));
    }

    await execute.execute_update_tag(data.tag_id, nome);
    return res.json(utils.jsonMount(true, {}, "Tag alterada com sucesso"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/alterar_cliente"));
  }
});

////////////////mensagens rapidas/////////////////////////////////////////////////////

rota.post("/mensagens_rapidas", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }
    try {
      const actor = await getQuickMessageActor(data);
      const includeAll = Boolean(actor.is_master) && parseBooleanFlag(data.incluir_todas);
      const mensagens = await execute.execute_get_mensagens_rapidas(
        actor.empresa_id,
        actor.id,
        includeAll
      );
      return res.json(utils.jsonMount(true, mensagens, ""));
    } catch (error) {
      if (!isQuickMessagesGalleryMigrationMissing(error)) {
        throw error;
      }

      const mensagens = await execute.execute_get_mensagens_rapidas_legacy(data.empresa_id);
      return res.json(
        utils.jsonMount(true, mensagens, getQuickMessagesGalleryMigrationMessage())
      );
    }
  } catch (error) {
    return res.json(utils.errorHandle(error, "/mensagens_rapidas"));
  }
});

rota.post("/galeria_empresa_imagens", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    try {
      const imagens = await execute.execute_listar_galeria_imagens_empresa(data.empresa_id);
      return res.json(utils.jsonMount(true, imagens, ""));
    } catch (error) {
      if (isQuickMessagesGalleryMigrationMissing(error)) {
        return res.json(
          utils.jsonMount(false, [], getQuickMessagesGalleryMigrationMessage())
        );
      }
      throw error;
    }
  } catch (error) {
    return res.json(utils.errorHandle(error, "/galeria_empresa_imagens"));
  }
});

rota.post("/galeria_empresa_imagens_upload", upload.single("image"), async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    if (!req.file) {
      return res.json(utils.jsonMount(false, {}, "Nenhuma imagem foi enviada."));
    }

    const empresaId = normalizePositiveInt(data.empresa_id);
    if (!empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    const imagem = await criarImagemGaleriaEmpresa({
      empresaId,
      file: req.file,
      origem: "galeria_empresa",
    });

    return res.json(utils.jsonMount(true, imagem, "Imagem salva com sucesso."));
  } catch (error) {
    if (isQuickMessagesGalleryMigrationMissing(error)) {
      return res.json(utils.jsonMount(false, {}, getQuickMessagesGalleryMigrationMessage()));
    }
    if (error?.message) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/galeria_empresa_imagens_upload"));
  }
});

rota.post("/galeria_empresa_imagens_deletar", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const imagemId = normalizePositiveInt(data.id || data.imagem_id);
    const empresaId = normalizePositiveInt(data.empresa_id);
    if (!imagemId || !empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe imagem e empresa validas."));
    }

    const imagem = await execute.execute_get_galeria_imagem_by_id_empresa(imagemId, empresaId);
    if (!imagem) {
      return res.json(utils.jsonMount(false, {}, "Imagem nao encontrada."));
    }

    const totalMensagens = await execute.execute_contar_mensagens_rapidas_por_galeria_imagem(
      imagemId
    );
    if (totalMensagens > 0) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Esta imagem esta vinculada a uma ou mais mensagens rapidas ativas. Para apagar a imagem, primeiro remova a mensagem rapida vinculada."
        )
      );
    }

    await execute.execute_deletar_galeria_imagem_empresa(imagemId, empresaId);
    if (imagem.path_bunny) {
      await bunny.deleteFile(imagem.path_bunny);
    }

    return res.json(utils.jsonMount(true, {}, "Imagem removida com sucesso."));
  } catch (error) {
    if (isQuickMessagesGalleryMigrationMissing(error)) {
      return res.json(utils.jsonMount(false, {}, getQuickMessagesGalleryMigrationMessage()));
    }
    return res.json(utils.errorHandle(error, "/galeria_empresa_imagens_deletar"));
  }
});

rota.post("/galeria_empresa_documentos", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    try {
      const documentos = await execute.execute_listar_galeria_documentos_empresa(
        data.empresa_id
      );
      return res.json(utils.jsonMount(true, documentos, ""));
    } catch (error) {
      if (isQuickMessagesGalleryMigrationMissing(error)) {
        return res.json(
          utils.jsonMount(false, [], getQuickMessagesGalleryMigrationMessage())
        );
      }
      throw error;
    }
  } catch (error) {
    return res.json(utils.errorHandle(error, "/galeria_empresa_documentos"));
  }
});

rota.post("/galeria_empresa_documentos_upload", upload.single("document"), async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    if (!req.file) {
      return res.json(utils.jsonMount(false, {}, "Nenhum documento foi enviado."));
    }

    const empresaId = normalizePositiveInt(data.empresa_id);
    if (!empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    const documento = await criarDocumentoGaleriaEmpresa({
      empresaId,
      file: req.file,
      origem: "galeria_empresa_documento",
    });

    return res.json(utils.jsonMount(true, documento, "Documento salvo com sucesso."));
  } catch (error) {
    if (isQuickMessagesGalleryMigrationMissing(error)) {
      return res.json(utils.jsonMount(false, {}, getQuickMessagesGalleryMigrationMessage()));
    }
    if (error?.message) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/galeria_empresa_documentos_upload"));
  }
});

rota.post("/galeria_empresa_documentos_deletar", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const documentoId = normalizePositiveInt(data.id || data.documento_id);
    const empresaId = normalizePositiveInt(data.empresa_id);
    if (!documentoId || !empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe documento e empresa validos."));
    }

    const documento = await execute.execute_get_galeria_documento_by_id_empresa(
      documentoId,
      empresaId
    );
    if (!documento) {
      return res.json(utils.jsonMount(false, {}, "Documento nao encontrado."));
    }

    const totalMensagens =
      await execute.execute_contar_mensagens_rapidas_por_galeria_documento(documentoId);
    if (totalMensagens > 0) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Este documento esta vinculado a uma ou mais mensagens rapidas ativas. Para apagar o documento, primeiro remova a mensagem rapida vinculada."
        )
      );
    }

    await execute.execute_deletar_galeria_documento_empresa(documentoId, empresaId);
    if (documento.path_bunny) {
      await bunny.deleteFile(documento.path_bunny);
    }

    return res.json(utils.jsonMount(true, {}, "Documento removido com sucesso."));
  } catch (error) {
    if (isQuickMessagesGalleryMigrationMissing(error)) {
      return res.json(utils.jsonMount(false, {}, getQuickMessagesGalleryMigrationMessage()));
    }
    return res.json(utils.errorHandle(error, "/galeria_empresa_documentos_deletar"));
  }
});

rota.post("/galeria_empresa_videos_upload", upload.single("video"), async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }
    const empresaId = normalizePositiveInt(data.empresa_id);
    if (!empresaId) return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    if (!req.file) return res.json(utils.jsonMount(false, {}, "Nenhum video foi enviado."));

    const video = await criarVideoGaleriaEmpresa({
      empresaId,
      file: req.file,
      origem: "mensagem_rapida_video",
    });
    return res.json(utils.jsonMount(true, video, "Video salvo com sucesso."));
  } catch (error) {
    if (error?.message) return res.json(utils.jsonMount(false, {}, error.message));
    return res.json(utils.errorHandle(error, "/galeria_empresa_videos_upload"));
  }
});

rota.post("/galeria_empresa_audios", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }
    const audios = await execute.execute_listar_galeria_audios_empresa(data.empresa_id);
    return res.json(utils.jsonMount(true, audios, ""));
  } catch (error) {
    if (isQuickMessagesGalleryMigrationMissing(error)) {
      return res.json(utils.jsonMount(false, [], getQuickMessagesGalleryMigrationMessage()));
    }
    return res.json(utils.errorHandle(error, "/galeria_empresa_audios"));
  }
});

rota.post("/galeria_empresa_audios_upload", upload.single("audio"), async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }
    const empresaId = normalizePositiveInt(data.empresa_id);
    if (!empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }
    const audio = await criarAudioGaleriaEmpresa({
      empresaId,
      file: req.file,
      origem: "galeria_empresa_audio",
    });
    return res.json(utils.jsonMount(true, audio, "Audio salvo com sucesso."));
  } catch (error) {
    if (isQuickMessagesGalleryMigrationMissing(error)) {
      return res.json(utils.jsonMount(false, {}, getQuickMessagesGalleryMigrationMessage()));
    }
    if (error?.message) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/galeria_empresa_audios_upload"));
  }
});

rota.post("/galeria_empresa_audios_deletar", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }
    const audioId = normalizePositiveInt(data.id || data.audio_id);
    const empresaId = normalizePositiveInt(data.empresa_id);
    if (!audioId || !empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe audio e empresa validos."));
    }
    const audio = await execute.execute_get_galeria_audio_by_id_empresa(audioId, empresaId);
    if (!audio) {
      return res.json(utils.jsonMount(false, {}, "Audio nao encontrado."));
    }
    const totalMensagens =
      await execute.execute_contar_mensagens_rapidas_por_galeria_audio(audioId);
    if (totalMensagens > 0) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Este audio esta vinculado a uma ou mais mensagens rapidas ativas. Remova primeiro a mensagem rapida vinculada."
        )
      );
    }
    await execute.execute_deletar_galeria_audio_empresa(audioId, empresaId);
    if (audio.path_bunny) {
      await bunny.deleteFile(audio.path_bunny);
    }
    return res.json(utils.jsonMount(true, {}, "Audio removido com sucesso."));
  } catch (error) {
    if (isQuickMessagesGalleryMigrationMissing(error)) {
      return res.json(utils.jsonMount(false, {}, getQuickMessagesGalleryMigrationMessage()));
    }
    return res.json(utils.errorHandle(error, "/galeria_empresa_audios_deletar"));
  }
});

rota.post("/deletar_mensagens_rapidas", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const actor = await getQuickMessageActor(data);
    const mensagem = await execute.execute_get_mensagem_rapida_by_id(data.id, actor.empresa_id);
    if (!mensagem) return res.json(utils.jsonMount(false, {}, "Mensagem rapida nao encontrada."));
    if (!actor.is_master && Number(mensagem.usuario_id) !== Number(actor.id)) {
      return res.json(utils.jsonMount(false, {}, "Voce nao pode excluir esta mensagem rapida."));
    }
    await execute.execute_delete_mensagem_rapida(data.id, actor.empresa_id);
    return res.json(utils.jsonMount(true, {}, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/mensagens_rapidas"));
  }
});

rota.post(
  "/alterar_mensagens_rapidas",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "document", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const empresaId = normalizePositiveInt(data.empresa_id);
    if (!empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    const mensagemId = normalizePositiveInt(data.id);
    if (!mensagemId) {
      return res.json(utils.jsonMount(false, {}, "Informe a mensagem rapida valida."));
    }

    const removeImage = parseBooleanFlag(data.remove_image);
    const galeriaImagemIdInformada = normalizePositiveInt(data.galeria_imagem_id);
    const removeDocument = parseBooleanFlag(data.remove_document);
    const galeriaDocumentoIdInformada = normalizePositiveInt(data.galeria_documento_id);
    const removeAudio = parseBooleanFlag(data.remove_audio);
    const galeriaAudioIdInformada = normalizePositiveInt(data.galeria_audio_id);
    let mensagemAtual = null;
    try {
      mensagemAtual = await execute.execute_get_mensagem_rapida_by_id(mensagemId, empresaId);
    } catch (error) {
      if (!isQuickMessagesGalleryMigrationMissing(error)) {
        throw error;
      }
      mensagemAtual = await execute.execute_get_mensagem_rapida_by_id_legacy(
        mensagemId,
        empresaId
      );
    }
    if (!mensagemAtual?.id) {
      return res.json(utils.jsonMount(false, {}, "Mensagem rapida nao encontrada."));
    }

    let galeriaImagemId = galeriaImagemIdInformada;
    let galeriaDocumentoId = galeriaDocumentoIdInformada;
    let galeriaAudioId = galeriaAudioIdInformada;
    const imageFile = Array.isArray(req.files?.image) ? req.files.image[0] : null;
    const documentFile = Array.isArray(req.files?.document) ? req.files.document[0] : null;
    const audioFile = Array.isArray(req.files?.audio) ? req.files.audio[0] : null;
    if (imageFile) {
      const imagem = await criarImagemGaleriaEmpresa({
        empresaId,
        file: imageFile,
        origem: "mensagem_rapida",
      });
      galeriaImagemId = Number(imagem?.id || 0) || null;
    } else if (removeImage) {
      galeriaImagemId = null;
    } else if (galeriaImagemId) {
      const imagemExistente = await execute.execute_get_galeria_imagem_by_id_empresa(
        galeriaImagemId,
        empresaId
      );
      if (!imagemExistente) {
        return res.json(utils.jsonMount(false, {}, "Imagem da galeria nao encontrada."));
      }
    }

    if (documentFile) {
      const documento = await criarDocumentoGaleriaEmpresa({
        empresaId,
        file: documentFile,
        origem: "mensagem_rapida_documento",
      });
      galeriaDocumentoId = Number(documento?.id || 0) || null;
    } else if (removeDocument) {
      galeriaDocumentoId = null;
    } else if (galeriaDocumentoId) {
      const documentoExistente = await execute.execute_get_galeria_documento_by_id_empresa(
        galeriaDocumentoId,
        empresaId
      );
      if (!documentoExistente) {
        return res.json(utils.jsonMount(false, {}, "Documento da galeria nao encontrado."));
      }
    }
    const actor = await getQuickMessageActor(data);
    if (!actor.is_master && Number(mensagemAtual.usuario_id) !== Number(actor.id)) {
      return res.json(utils.jsonMount(false, {}, "Voce nao pode editar esta mensagem rapida."));
    }
    const mensagemUsuarioId = await resolveQuickMessageOwner(
      data,
      actor,
      mensagemAtual.usuario_id === null ? null : normalizePositiveInt(mensagemAtual.usuario_id)
    );

    if (audioFile) {
      const audio = await criarAudioGaleriaEmpresa({
        empresaId,
        file: audioFile,
        origem: "mensagem_rapida_audio",
      });
      galeriaAudioId = Number(audio?.id || 0) || null;
    } else if (removeAudio) {
      galeriaAudioId = null;
    } else if (galeriaAudioId) {
      const audioExistente = await execute.execute_get_galeria_audio_by_id_empresa(
        galeriaAudioId,
        empresaId
      );
      if (!audioExistente) {
        return res.json(utils.jsonMount(false, {}, "Audio da galeria nao encontrado."));
      }
    }

    const conteudo = await normalizeQuickMessageContent(data.conteudo, empresaId);
    if (conteudo) {
      galeriaImagemId = conteudo.images[0]?.id || null;
      galeriaDocumentoId = conteudo.documents[0]?.id || null;
      galeriaAudioId = conteudo.audios[0]?.id || null;
    }
    const texto = conteudo?.texts?.[0] || String(data.texto || "").trim();
    const possuiConteudo = Boolean(
      conteudo && (conteudo.texts.length || conteudo.images.length || conteudo.documents.length || conteudo.audios.length || conteudo.videos.length)
    );
    if (!texto && !galeriaImagemId && !galeriaDocumentoId && !galeriaAudioId && !possuiConteudo) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Informe um texto ou selecione ao menos uma midia para a mensagem."
        )
      );
    }

    const ordemMidias = conteudo || normalizeQuickMessageMediaOrder(data.ordem_midias, [
      ...(galeriaImagemId ? ["image"] : []),
      ...(galeriaDocumentoId ? ["document"] : []),
      ...(galeriaAudioId ? ["audio"] : []),
    ]);

    const updated = await execute.execute_alterar_mensagem_rapida(
      data.comando,
      data.descricao,
      texto,
      galeriaImagemId,
      galeriaDocumentoId,
      galeriaAudioId,
      Boolean(galeriaImagemId) && (
        Boolean(conteudo?.sequence?.some((item) => ["image", "video", "document"].includes(item.type) && Number.isInteger(item.caption_text_index)))
        || (!conteudo && parseBooleanFlag(data.usar_texto_como_legenda))
      ),
      ordemMidias,
      mensagemUsuarioId,
      mensagemId,
      empresaId
    );
    let mensagem = null;
    try {
      mensagem = await execute.execute_get_mensagem_rapida_by_id(
        updated?.id || mensagemId,
        empresaId
      );
    } catch (error) {
      if (!isQuickMessagesGalleryMigrationMissing(error)) {
        throw error;
      }
      mensagem = await execute.execute_get_mensagem_rapida_by_id_legacy(
        updated?.id || mensagemId,
        empresaId
      );
    }
    return res.json(utils.jsonMount(true, mensagem || {}, ""));
  } catch (error) {
    if (isQuickMessagesGalleryMigrationMissing(error)) {
      return res.json(utils.jsonMount(false, {}, getQuickMessagesGalleryMigrationMessage()));
    }
    if (error?.message) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/mensagens_rapidas"));
  }
});

rota.post(
  "/criar_mensagens_rapidas",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "document", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const empresaId = normalizePositiveInt(data.empresa_id);
    if (!empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    const galeriaImagemIdInformada = normalizePositiveInt(data.galeria_imagem_id);
    const galeriaDocumentoIdInformada = normalizePositiveInt(data.galeria_documento_id);
    const galeriaAudioIdInformada = normalizePositiveInt(data.galeria_audio_id);
    let galeriaImagemId = galeriaImagemIdInformada;
    let galeriaDocumentoId = galeriaDocumentoIdInformada;
    let galeriaAudioId = galeriaAudioIdInformada;
    const imageFile = Array.isArray(req.files?.image) ? req.files.image[0] : null;
    const documentFile = Array.isArray(req.files?.document) ? req.files.document[0] : null;
    const audioFile = Array.isArray(req.files?.audio) ? req.files.audio[0] : null;

    if (imageFile) {
      const imagem = await criarImagemGaleriaEmpresa({
        empresaId,
        file: imageFile,
        origem: "mensagem_rapida",
      });
      galeriaImagemId = Number(imagem?.id || 0) || null;
    } else if (galeriaImagemId) {
      const imagemExistente = await execute.execute_get_galeria_imagem_by_id_empresa(
        galeriaImagemId,
        empresaId
      );
      if (!imagemExistente) {
        return res.json(utils.jsonMount(false, {}, "Imagem da galeria nao encontrada."));
      }
    }

    if (documentFile) {
      const documento = await criarDocumentoGaleriaEmpresa({
        empresaId,
        file: documentFile,
        origem: "mensagem_rapida_documento",
      });
      galeriaDocumentoId = Number(documento?.id || 0) || null;
    } else if (galeriaDocumentoId) {
      const documentoExistente = await execute.execute_get_galeria_documento_by_id_empresa(
        galeriaDocumentoId,
        empresaId
      );
      if (!documentoExistente) {
        return res.json(utils.jsonMount(false, {}, "Documento da galeria nao encontrado."));
      }
    }
    const actor = await getQuickMessageActor(data);
    const mensagemUsuarioId = await resolveQuickMessageOwner(data, actor);


    if (audioFile) {
      const audio = await criarAudioGaleriaEmpresa({
        empresaId,
        file: audioFile,
        origem: "mensagem_rapida_audio",
      });
      galeriaAudioId = Number(audio?.id || 0) || null;
    } else if (galeriaAudioId) {
      const audioExistente = await execute.execute_get_galeria_audio_by_id_empresa(
        galeriaAudioId,
        empresaId
      );
      if (!audioExistente) {
        return res.json(utils.jsonMount(false, {}, "Audio da galeria nao encontrado."));
      }
    }

    const conteudo = await normalizeQuickMessageContent(data.conteudo, empresaId);
    if (conteudo) {
      galeriaImagemId = conteudo.images[0]?.id || null;
      galeriaDocumentoId = conteudo.documents[0]?.id || null;
      galeriaAudioId = conteudo.audios[0]?.id || null;
    }
    const texto = conteudo?.texts?.[0] || String(data.texto || "").trim();
    const possuiConteudo = Boolean(
      conteudo && (conteudo.texts.length || conteudo.images.length || conteudo.documents.length || conteudo.audios.length || conteudo.videos.length)
    );
    if (!texto && !galeriaImagemId && !galeriaDocumentoId && !galeriaAudioId && !possuiConteudo) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Informe um texto ou selecione ao menos uma midia para a mensagem."
        )
      );
    }

    const ordemMidias = conteudo || normalizeQuickMessageMediaOrder(data.ordem_midias, [
      ...(galeriaImagemId ? ["image"] : []),
      ...(galeriaDocumentoId ? ["document"] : []),
      ...(galeriaAudioId ? ["audio"] : []),
    ]);

    const created = await execute.execute_criar_mensagem_rapida(
      data.comando,
      data.descricao,
      texto,
      empresaId,
      galeriaImagemId,
      galeriaDocumentoId,
      galeriaAudioId,
      Boolean(galeriaImagemId) && (
        Boolean(conteudo?.sequence?.some((item) => ["image", "video", "document"].includes(item.type) && Number.isInteger(item.caption_text_index)))
        || (!conteudo && parseBooleanFlag(data.usar_texto_como_legenda))
      ),
      ordemMidias,
      mensagemUsuarioId
    );
    let mensagem = null;
    try {
      mensagem = await execute.execute_get_mensagem_rapida_by_id(created?.id, empresaId);
    } catch (error) {
      if (!isQuickMessagesGalleryMigrationMissing(error)) {
        throw error;
      }
      mensagem = await execute.execute_get_mensagem_rapida_by_id_legacy(
        created?.id,
        empresaId
      );
    }
    return res.json(utils.jsonMount(true, mensagem || {}, ""));
  } catch (error) {
    if (isQuickMessagesGalleryMigrationMissing(error)) {
      return res.json(utils.jsonMount(false, {}, getQuickMessagesGalleryMigrationMessage()));
    }
    if (error?.message) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/mensagens_rapidas"));
  }
});

////////////////mensagens automaticas whatsapp//////////////////////////////////////////

rota.post("/listar_mensagens_automaticas_whatsapp", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagens = await execute.execute_listar_mensagens_automaticas_whatsapp(
      data.empresa_id,
      normalizePositiveInt(data.meta_param_id)
    );
    return res.json(utils.jsonMount(true, mensagens, ""));
  } catch (error) {
    console.error("[/listar_mensagens_automaticas_whatsapp] erro", {
      code: error?.code || null,
      constraint: error?.constraint || null,
      message: error?.message || String(error),
      detail: error?.detail || null,
    });
    if (error?.message) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(
      utils.errorHandle(error, "/listar_mensagens_automaticas_whatsapp")
    );
  }
});

rota.post("/alterar_status_mensagem_automatica_whatsapp", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const tipoId = normalizePositiveInt(data.tipo_id);
    if (!tipoId || ![1, 2, 3, 4, 5, 6, 7, 8].includes(tipoId)) {
      return res.json(
        utils.jsonMount(false, {}, "Informe um tipo_id valido para a mensagem automatica.")
      );
    }

    const mensagem = await execute.execute_alterar_status_mensagem_automatica_whatsapp(
      tipoId,
      data.empresa_id,
      parseBooleanFlag(data.habilitada),
      buildAutoMessageScopeOptions(data)
    );

    return res.json(
      utils.jsonMount(true, mensagem, "Status da mensagem automatica atualizado com sucesso!")
    );
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/alterar_status_mensagem_automatica_whatsapp")
    );
  }
});

rota.post("/criar_mensagem_boas_vindas", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_criar_mensagem_automatica_whatsapp(
      data.texto,
      1,
      data.empresa_id,
      buildWelcomeAutoMessageOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0], "Mensagem criada com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/criar_mensagem_boas_vindas"));
  }
});

rota.post("/editar_mensagem_boas_vindas", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_editar_mensagem_automatica_whatsapp(
      data.id,
      data.texto,
      1,
      data.empresa_id,
      buildWelcomeAutoMessageOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0] || {}, "Mensagem alterada com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_mensagem_boas_vindas"));
  }
});

rota.post("/deletar_mensagem_boas_vindas", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_deletar_mensagem_automatica_whatsapp(
      data.id,
      1,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0] || {}, "Mensagem removida com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/deletar_mensagem_boas_vindas"));
  }
});

rota.post("/criar_mensagem_final_atendimento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_criar_mensagem_automatica_whatsapp(
      data.texto,
      2,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0], "Mensagem criada com sucesso!")
    );
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/criar_mensagem_final_atendimento")
    );
  }
});

rota.post("/criar_mensagem_inicio_atendimento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_criar_mensagem_automatica_whatsapp(
      data.texto,
      5,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0], "Mensagem criada com sucesso!")
    );
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/criar_mensagem_inicio_atendimento")
    );
  }
});

rota.post("/editar_mensagem_inicio_atendimento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_editar_mensagem_automatica_whatsapp(
      data.id,
      data.texto,
      5,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0] || {}, "Mensagem alterada com sucesso!")
    );
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/editar_mensagem_inicio_atendimento")
    );
  }
});

rota.post("/deletar_mensagem_inicio_atendimento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_deletar_mensagem_automatica_whatsapp(
      data.id,
      5,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0] || {}, "Mensagem removida com sucesso!")
    );
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/deletar_mensagem_inicio_atendimento")
    );
  }
});

rota.post("/editar_mensagem_final_atendimento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_editar_mensagem_automatica_whatsapp(
      data.id,
      data.texto,
      2,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0] || {}, "Mensagem alterada com sucesso!")
    );
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/editar_mensagem_final_atendimento")
    );
  }
});

rota.post("/deletar_mensagem_final_atendimento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_deletar_mensagem_automatica_whatsapp(
      data.id,
      2,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0] || {}, "Mensagem removida com sucesso!")
    );
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/deletar_mensagem_final_atendimento")
    );
  }
});

rota.post("/criar_texto_nps", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_criar_mensagem_automatica_whatsapp(
      data.texto,
      3,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0], "Mensagem criada com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/criar_texto_nps"));
  }
});

rota.post("/criar_mensagem_aniversario", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_criar_mensagem_automatica_whatsapp(
      data.texto,
      4,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0], "Mensagem criada com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/criar_mensagem_aniversario"));
  }
});

rota.post("/editar_mensagem_aniversario", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_editar_mensagem_automatica_whatsapp(
      data.id,
      data.texto,
      4,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0] || {}, "Mensagem alterada com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_mensagem_aniversario"));
  }
});

rota.post("/deletar_mensagem_aniversario", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_deletar_mensagem_automatica_whatsapp(
      data.id,
      4,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0] || {}, "Mensagem removida com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/deletar_mensagem_aniversario"));
  }
});

rota.post("/configuracao_template_aniversario", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const configuracao = await execute.execute_get_birthday_template_config({
      empresa_id: data.empresa_id,
      meta_param_id: normalizePositiveInt(data?.meta_param_id),
    });

    return res.json(utils.jsonMount(true, configuracao || {}, ""));
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/configuracao_template_aniversario")
    );
  }
});

rota.post("/salvar_configuracao_template_aniversario", upload.fields([
  { name: "header_image_file", maxCount: 1 },
  { name: "header_document_file", maxCount: 1 },
  { name: "header_video_file", maxCount: 1 },
  { name: "header_file", maxCount: 1 }
]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const configuracao = await execute.execute_save_birthday_template_config({
      empresa_id: data.empresa_id,
      ...buildBirthdayTemplateConfigOptions(data),
      requestContext: req,
    });

    return res.json(
      utils.jsonMount(
        true,
        configuracao || {},
        "Configuracao de aniversario salva com sucesso!"
      )
    );
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/salvar_configuracao_template_aniversario")
    );
  }
});

rota.post("/configuracao_template_automacao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const configuracao = await execute.execute_get_template_automation_config({
      empresa_id: data.empresa_id,
      automation_type: data.automation_type,
      meta_param_id: normalizePositiveInt(data?.meta_param_id),
    });

    return res.json(utils.jsonMount(true, configuracao || {}, ""));
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/configuracao_template_automacao")
    );
  }
});

rota.post("/salvar_configuracao_template_automacao", upload.fields([
  { name: "header_image_file", maxCount: 1 },
  { name: "header_document_file", maxCount: 1 },
  { name: "header_video_file", maxCount: 1 },
  { name: "header_file", maxCount: 1 }
]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const configuracao = await execute.execute_save_template_automation_config({
      empresa_id: data.empresa_id,
      ...buildTemplateAutomationConfigOptions(data),
      requestContext: req,
    });

    return res.json(
      utils.jsonMount(
        true,
        configuracao || {},
        "Configuracao da automacao salva com sucesso!"
      )
    );
  } catch (error) {
    return res.json(
      utils.errorHandle(error, "/salvar_configuracao_template_automacao")
    );
  }
});

rota.post("/editar_texto_nps", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_editar_mensagem_automatica_whatsapp(
      data.id,
      data.texto,
      3,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0] || {}, "Mensagem alterada com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_texto_nps"));
  }
});

rota.post("/deletar_texto_nps", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mensagem = await execute.execute_deletar_mensagem_automatica_whatsapp(
      data.id,
      3,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(
      utils.jsonMount(true, mensagem[0] || {}, "Mensagem removida com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/deletar_texto_nps"));
  }
});

///////////////////////////notas///////////////////////////////////////////////////////

rota.post("/salvar_nota", requireTenantOwnership([["cliente_id", "cliente"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const anotacao = await execute.execute_insert_nota(
      req.auth.usuario_id,
      data.cliente_id,
      data.note_content.createdAt,
      data.note_content.content
    );

    if (!anotacao || anotacao.length === 0) {
      return res.json(
        utils.jsonMount(false, {}, "Falha ao inserir a nota no banco de dados.")
      );
    }

    const novaNota = anotacao[0];
    novaNota.author = data.note_content.author;

    return res.json(
      utils.jsonMount(true, novaNota, "Nota criada com sucesso!")
    );
  } catch (error) {
    console.error("ERRO DETALHADO AO SALVAR NOTA:", error);
    return res.json(utils.errorHandle(error, "/salvar_nota"));
  }
});

/////////////////////////filial//////////////////////////////////////////////////////////

rota.post("/cadastro_filial", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const verify = await execute.execute_verify_filial(data.cnpj, data.empresa_id);
    if (verify.length > 0) {
      return res.json(utils.jsonMount(false, {}, "CNPJ ja cadastrado!"));
    }
    const filial = await execute.execute_create_filial(
      data.empresa_id,
      data.name,
      data.contact,
      data.cnpj,
      data.address,
      data.manager,
      data.isPrimary,
      data.latitude,
      data.longitude,
      data.toleranceMeters
    );
    return res.json(
      utils.jsonMount(true, filial[0], "fabricante criado com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/cadastro_filial"));
  }
});

rota.post("/lista_filial", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const filiais = await execute.execute_listar_filial(data.empresa_id);
    return res.json(utils.jsonMount(true, filiais, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/lista_filial"));
  }
});

rota.post("/editar_filial", requireMasterOrPermission("settings.branches"), requireTenantOwnership([["id", "empresa_filial"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const filial = await execute.execute_update_filial(
      data.id,
      data.name,
      data.contact,
      data.address,
      data.manager,
      data.isPrimary,
      data.latitude,
      data.longitude,
      data.toleranceMeters
    );
    return res.json(
      utils.jsonMount(true, filial[0] || {}, "filial atualizado com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/home"));
  }
});

rota.post("/deletar_filial", requireMasterOrPermission("settings.branches"), requireTenantOwnership([["filial_id", "empresa_filial"], ["filial_alvo_id", "empresa_filial"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }
    await execute.execute_delete_fabricante(data.filial_id);
    if (data.delete_all === false) {
      await execute.execute_migrate_estoque(
        data.filial_id,
        data.filial_alvo_id
      );
    }
    await execute.execute_expurgar_produtos(data.filial_id);
    return res.json(
      utils.jsonMount(true, {}, "fabricante removido com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/home"));
  }
});

/////////////////////////categorias///////////////////////////////////////////////////////

rota.post("/cadastro_categoria", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const verify = await execute.execute_verify_categoria(
      data.name,
      data.empresa_id
    );
    if (verify.length > 0) {
      return res.json(
        utils.jsonMount(
          true,
          { id: verify[0].id, name: verify[0].nome },
          "Categoria ja cadastrada!"
        )
      );
    }
    const created = await execute.execute_create_categoria(data.name, data.empresa_id);
    return res.json(
      utils.jsonMount(
        true,
        created?.[0] || {},
        "Categoria criada com sucesso!"
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/cadastro_filial"));
  }
});

rota.post("/listar_categoria", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const categorias = await execute.execute_listar_categorias(data.empresa_id);
    return res.json(utils.jsonMount(true, categorias, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/lista_filial"));
  }
});

rota.post("/editar_categoria", requireTenantOwnership([["id", "categoria"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    await execute.execute_update_categoria(data.id, data.name);
    return res.json(
      utils.jsonMount(true, {}, "Categoria atualizado com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/home"));
  }
});

rota.post("/deletar_categoria", requireTenantOwnership([["id", "categoria"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }
    await execute.execute_deletar_categoria(data.id);
    return res.json(
      utils.jsonMount(true, {}, "categoria removido com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/deletar_categoria"));
  }
});


///////////////////////adm/////////////////////////////////////////////////////////////////

rota.post("/lista_usuarios", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }
    const usuarios = await execute.execute_get_usuarios(data.empresa_id);
    return res.json(utils.jsonMount(true, usuarios, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/lista_usuarios"));
  }
});

rota.post("/criar_usuario", requireMasterOrPermission("users.manage"), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }
    const raw = security.decodeRawPayload(payload) || {};
    await execute.execute_criar_usuarios(
      data.name,
      data.email,
      data.telefone,
      data.filial_id,
      data.password,
      data.cargo_id,
      data.empresa_id,
      raw.permissions,
      data.allowed_meta_param_ids,
      data.cor_atendimento
    );
    const current_user = await execute.execute_get_number_users(data.empresa_id)
    return res.json(utils.jsonMount(true, { usuarios: current_user[0].usuarios }, ""));
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Tente novamente mais tarde!")
    );
  }
});

rota.post("/editar_usuario", requireMasterOrPermission("users.manage"), requireTenantOwnership([["id", "usuario"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }
    const raw = security.decodeRawPayload(payload) || {};
    // So o master edita outro master (e-mail/senha do dono da conta).
    if (!req.auth.is_master) {
      const alvo = await execute.execute_get_usuario_is_master(data.id, req.auth.empresa_id);
      if (alvo) {
        return res.status(403).json(utils.jsonMount(false, {}, "Apenas o master pode editar este usuario."));
      }
    }
    await execute.execute_alterar_usuarios(
      data.id,
      data.name,
      data.email,
      data.telefone,
      data.filial_id,
      data.cargo_id,
      data.password,
      raw.permissions,
      data.allowed_meta_param_ids,
      data.empresa_id,
      data.cor_atendimento
    );
    return res.json(utils.jsonMount(true, {}, ""));
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Tente novamente mais tarde!")
    );
  }
});

rota.post("/deletar_usuario", requireMasterOrPermission("users.manage"), requireTenantOwnership([["usuario_id", "usuario"]]), async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }
    const raw = security.decodeRawPayload(payload) || {};
    const alvoId = Number(raw.usuario_id);
    if (!req.auth.is_master && (await execute.execute_get_usuario_is_master(alvoId, req.auth.empresa_id))) {
      return res.status(403).json(utils.jsonMount(false, {}, "Apenas o master pode remover este usuario."));
    }
    const empresa_id = await execute.execute_deletar_usuarios(alvoId);
    const usuarios = await execute.execute_get_number_users(empresa_id[0].empresa_id)
    return res.json(utils.jsonMount(true, { usuarios: usuarios[0].usuarios }, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/deletar_usuario"));
  }
});

rota.get("/get_cargos", async (req, res) => {
  try {
    const cargos = await execute.execute_get_cargos();
    return res.json(utils.jsonMount(true, cargos, ''))
  } catch (error) {
    return res.json(utils.errorHandle(error, "/deletar_usuario"));
  }
})

///////////////////////IA/////////////////////////////////////////////////////////////////

rota.post("/get_prompt_ia_atendimento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃƒÂ¡lido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    const ret = await execute.execute_get_prompt_ia_atendimento_empresa(empresaId);
    const promptSalvo = String(ret?.[0]?.prompt_ia_atendimento || "").trim();
    const promptFinal = promptSalvo || getDefaultPromptAnaliseAtendimento();

    return res.json(
      utils.jsonMount(
        true,
        {
          empresa_id: empresaId,
          prompt_ia_atendimento: promptFinal,
        },
        ""
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/get_prompt_ia_atendimento"));
  }
});

rota.post("/salvar_prompt_ia_atendimento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃƒÂ¡lido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    const prompt = String(data.prompt_ia_atendimento || "").trim();
    if (prompt.length > 12000) {
      return res.json(
        utils.jsonMount(false, {}, "O prompt deve ter no maximo 12000 caracteres.")
      );
    }

    const ret = await execute.execute_update_prompt_ia_atendimento_empresa(
      empresaId,
      prompt
    );
    if (!ret?.length) {
      return res.json(utils.jsonMount(false, {}, "Empresa nao encontrada."));
    }

    return res.json(
      utils.jsonMount(
        true,
        {
          empresa_id: ret[0].empresa_id,
          prompt_ia_atendimento: String(ret[0].prompt_ia_atendimento || ""),
        },
        "Prompt da IA salvo com sucesso."
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/salvar_prompt_ia_atendimento"));
  }
});

///////////////////////dashboard/////////////////////////////////////////////////////////////////

rota.post("/dashboard_stats", async (req, res) => {
  let dashboardLogContext = null;
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    const usuarioId = Number(data.usuario_id || data.user_id || data.id);
    let dateStart = normalizeDashboardDate(
      data.date_start || data.dateStart || data.data_inicio
    );
    let dateEnd = normalizeDashboardDate(
      data.date_end || data.dateEnd || data.data_fim
    );
    const filialIdRaw =
      data.filial_id !== undefined
        ? data.filial_id
        : data.filialId !== undefined
        ? data.filialId
        : data.branchId;
    const filialId = Number.isInteger(Number(filialIdRaw)) && Number(filialIdRaw) > 0
      ? Number(filialIdRaw)
      : null;
    dashboardLogContext = {
      empresa_id: empresaId,
      usuario_id: usuarioId,
      date_start: dateStart,
      date_end: dateEnd,
      filial_id: filialId,
    };
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe usuario_id valido."));
    }
    if (dateStart && dateEnd && dateStart > dateEnd) {
      [dateStart, dateEnd] = [dateEnd, dateStart];
    }

    const dashboardFilters = {
      dateStart,
      dateEnd,
      filial_id: filialId,
    };

    const contextoRows = await execute.execute_get_dashboard_contexto_usuario(
      usuarioId,
      empresaId
    );
    if (!contextoRows.length) {
      return res.json(
        utils.jsonMount(false, {}, "Usuario nao encontrado para esta empresa.")
      );
    }

    const contexto = contextoRows[0];
    const planoPerms = Array.isArray(contexto.permissoes_plano)
      ? contexto.permissoes_plano
      : [];
    const userPerms = Array.isArray(contexto.permissoes_customizadas)
      ? contexto.permissoes_customizadas
      : [];
    const isMaster = Boolean(contexto.is_master);
    const hasPdv = Boolean(contexto.has_pdv);

    let permissoesFinais = [];
    if (isMaster) {
      permissoesFinais = planoPerms;
    } else {
      permissoesFinais = userPerms.filter((perm) => planoPerms.includes(perm));
    }
    if (hasPdv) {
      permissoesFinais = [...new Set([...permissoesFinais, "sales.view", "sales.create"])];
    }

    const hasPerm = (perm) => permissoesFinais.includes(perm);
    let canSeeFinanceiro = hasPdv && hasPerm("sales.view");
    let canSeeEstoque = hasPdv && hasPerm("stock.view");
    let canSeeFornecedores = hasPdv && hasPerm("stock.suppliers.view");
    let canSeeAtendimento = hasPerm("chat.view") || hasPerm("contacts.view");
    let canSeeCrm = hasPerm("commercial.view");

    // Evita deixar administradores sem nenhuma métrica quando o plano/permissões
    // vierem vazios ou inconsistentes na consulta de contexto do dashboard.
    if (
      isMaster &&
      !canSeeFinanceiro &&
      !canSeeEstoque &&
      !canSeeFornecedores &&
      !canSeeAtendimento &&
      !canSeeCrm
    ) {
      canSeeFinanceiro = hasPdv;
      canSeeEstoque = hasPdv;
      canSeeFornecedores = hasPdv;
      canSeeAtendimento = true;
      canSeeCrm = true;
      permissoesFinais = [
        ...new Set([
          ...permissoesFinais,
          "chat.view",
          "contacts.view",
          "commercial.view",
          ...(hasPdv
            ? ["sales.view", "sales.create", "stock.view", "stock.suppliers.view"]
            : []),
        ]),
      ];
    }

    let financeiro = null;
    let estoque = null;
    let atendimento = null;
    let crm = null;
    let geral = { totalFornecedores: null };

    if (canSeeFinanceiro) {
      const dados_venda = await execute.execute_get_dados_venda(empresaId, dashboardFilters);
      const vendas_hora = await execute.execute_get_vendas_horas(empresaId, dashboardFilters);
      financeiro = {
        totalVendas: Number(dados_venda?.[0]?.totalVendas || 0),
        totalPedidos: Number(dados_venda?.[0]?.totalPedidos || 0),
        ticketMedio: Number(dados_venda?.[0]?.ticketMedio || 0),
        graficoVendas: Array.isArray(vendas_hora) ? vendas_hora : [],
      };
    }

    if (canSeeEstoque) {
      const valor_estoque = await execute.execute_valor_estqoue(empresaId, dashboardFilters);
      estoque = {
        valorTotal: Number(valor_estoque?.[0]?.valorTotal || 0),
        produtosBaixoEstoque: 0,
        produtosTotal: 0,
      };
    }

    if (canSeeFornecedores) {
      const fornecedores = await execute.execute_get_fornecedores(empresaId);
      geral = {
        totalFornecedores: Number(fornecedores?.[0]?.totalFornecedores || 0),
      };
    }

    if (canSeeAtendimento) {
      const atendimentoStats = await execute.execute_get_dashboard_atendimento_stats(
        empresaId,
        dashboardFilters
      );
      const topTags = await execute.execute_get_dashboard_top_tags(empresaId, dashboardFilters);
      const ultimosClientesNovos = await execute.execute_get_dashboard_ultimos_clientes_novos(
        empresaId,
        dashboardFilters
      );
      const npsGeralRet = await execute.execute_get_dashboard_nps_geral(
        empresaId,
        dashboardFilters
      );
      const npsMediaUltimos5Ret =
        await execute.execute_get_dashboard_nps_media_ultimos_5_atendimentos(
          empresaId,
          dashboardFilters
        );
      const npsPorAtendenteRet = await execute.execute_get_dashboard_nps_por_atendente(
        empresaId,
        dashboardFilters
      );
      const npsNotasUltimos5Ret =
        await execute.execute_get_dashboard_nps_notas_ultimos_5_por_pergunta(
          empresaId,
          dashboardFilters
        );
      let atendimentoPorUsuario = [];
      let tempoMedioAtendimentoMinutos = 0;
      let documentosPorAtendente = [];

      if (isMaster) {
        const atendimentoPorUsuarioRet =
          await execute.execute_get_dashboard_atendimento_por_usuario(
            empresaId,
            dashboardFilters
          );
        const tempoMedioAtendimentoRet =
          await execute.execute_get_dashboard_tempo_medio_atendimento(
            empresaId,
            dashboardFilters
          );
        const documentosPorAtendenteRet =
          await execute.execute_get_dashboard_documentos_cliente_por_atendente(
            empresaId,
            dashboardFilters
          );
        atendimentoPorUsuario = Array.isArray(atendimentoPorUsuarioRet)
          ? atendimentoPorUsuarioRet
          : [];
        tempoMedioAtendimentoMinutos = Number(
          tempoMedioAtendimentoRet?.[0]?.tempo_medio_minutos || 0
        );
        documentosPorAtendente = Array.isArray(documentosPorAtendenteRet)
          ? documentosPorAtendenteRet
          : [];
      }

      atendimento = {
        filaEspera: Number(atendimentoStats?.[0]?.fila_espera || 0),
        ativos: Number(atendimentoStats?.[0]?.ativos || 0),
        finalizados: Number(atendimentoStats?.[0]?.finalizados || 0),
        leads30Dias: Number(atendimentoStats?.[0]?.leads_30_dias || 0),
        topTags: Array.isArray(topTags) ? topTags : [],
        ultimosClientesNovos: Array.isArray(ultimosClientesNovos)
          ? ultimosClientesNovos
          : [],
        nps: {
          geral: {
            totalAvaliacoes: Number(npsGeralRet?.[0]?.total_avaliacoes || 0),
            promotores: Number(npsGeralRet?.[0]?.promotores || 0),
            neutros: Number(npsGeralRet?.[0]?.neutros || 0),
            detratores: Number(npsGeralRet?.[0]?.detratores || 0),
            mediaNota: Number(npsGeralRet?.[0]?.media_nota || 0),
            npsGeral: Number(npsGeralRet?.[0]?.nps_geral || 0),
          },
          mediaUltimos5: {
            totalAtendimentosConsiderados: Number(
              npsMediaUltimos5Ret?.[0]?.total_atendimentos_considerados || 0
            ),
            mediaNotaUltimos5: Number(npsMediaUltimos5Ret?.[0]?.media_nota_ultimos_5 || 0),
          },
          porAtendente: Array.isArray(npsPorAtendenteRet) ? npsPorAtendenteRet : [],
          notasUltimos5PorPergunta: Array.isArray(npsNotasUltimos5Ret)
            ? npsNotasUltimos5Ret
            : [],
        },
        tempoMedioAtendimentoMinutos,
        atendimentoPorUsuario,
        documentosPorAtendente,
      };
    }

    if (canSeeCrm) {
      const crmResumoRet = await execute.execute_get_dashboard_crm_resumo(
        empresaId,
        dashboardFilters
      );
      const crmFunilRet = await execute.execute_get_dashboard_crm_funil_por_etapa(
        empresaId,
        dashboardFilters
      );
      const crmTopResponsaveisRet =
        await execute.execute_get_dashboard_crm_top_responsaveis(
          empresaId,
          dashboardFilters
        );

      const resumo = crmResumoRet?.[0] || {};
      const ganhos30 = Number(resumo.ganhos_30_dias || 0);
      const fechados30 = Number(resumo.fechados_30_dias || 0);
      const taxaConversao30 = fechados30 > 0 ? (ganhos30 / fechados30) * 100 : 0;

      crm = {
        pipelineAtivos: Number(resumo.pipeline_ativos || 0),
        valorPipelineAberto: Number(resumo.valor_pipeline_aberto || 0),
        ganhos30Dias: ganhos30,
        perdidos30Dias: Number(resumo.perdidos_30_dias || 0),
        fechados30Dias: fechados30,
        taxaConversao30Dias: Number(taxaConversao30 || 0),
        valorGanho30Dias: Number(resumo.valor_ganho_30_dias || 0),
        valorPerdido30Dias: Number(resumo.valor_perdido_30_dias || 0),
        ticketMedioGanho30Dias: Number(resumo.ticket_medio_ganho_30_dias || 0),
        tempoMedioFechamentoDias: Number(resumo.tempo_medio_fechamento_dias || 0),
        funilPorEtapa: Array.isArray(crmFunilRet)
          ? crmFunilRet.map((item) => ({
              codigo: String(item.codigo || ""),
              nome: String(item.nome || "Sem etapa"),
              ordem: item.ordem === null || item.ordem === undefined ? null : Number(item.ordem),
              total: Number(item.total || 0),
              valorTotal: Number(item.valor_total || 0),
            }))
          : [],
        topResponsaveis: Array.isArray(crmTopResponsaveisRet)
          ? crmTopResponsaveisRet.map((item) => ({
              usuario_nome: String(item.usuario_nome || "Sem responsavel"),
              pipeline_ativos: Number(item.pipeline_ativos || 0),
              ganhos_30_dias: Number(item.ganhos_30_dias || 0),
              valor_ganho_30_dias: Number(item.valor_ganho_30_dias || 0),
            }))
          : [],
      };
    }

    const return_payload = {
      filiais: await execute.execute_listar_filial(empresaId),
      visibilidade: {
        financeiro: canSeeFinanceiro,
        estoque: canSeeEstoque,
        atendimento: canSeeAtendimento,
        fornecedores: canSeeFornecedores,
        crm: canSeeCrm,
      },
      financeiro,
      estoque,
      atendimento,
      crm,
      geral,
      filtros: {
        date_start: dateStart,
        date_end: dateEnd,
        filial_id: filialId,
      },
      permissions_aplicadas: permissoesFinais,
      has_pdv: hasPdv,
    };

    return res.json(utils.jsonMount(true, return_payload, ""));
  } catch (error) {
    console.error("[/dashboard_stats] erro:", {
      message: error?.message || null,
      stack: error?.stack || null,
      context: dashboardLogContext,
    });
    return res.json(utils.errorHandle(error, "/dashboard_stats"));
  }
});

rota.post("/listar_transacoes_pdv", async (req, res) => {
  try {
    const payload = req.body; // <-- CORRIGIDO
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }
    const vendas = await execute.execute_get_vendas_relatorio(data.empresa_id);
    return res.json(utils.jsonMount(true, vendas, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/dashboard_stats"));
  }
});

rota.post("/meu_perfil", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const perfil = await execute.execute_get_meu_perfil(
      Number(data.usuario_id),
      Number(data.empresa_id)
    );

    if (!perfil) {
      return res.json(utils.jsonMount(false, {}, "Usuario nao encontrado."));
    }

    return res.json(utils.jsonMount(true, perfil, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/meu_perfil"));
  }
});

rota.post("/salvar_meu_perfil", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const resultado = await execute.execute_salvar_meu_perfil({
      usuario_id: Number(data.usuario_id),
      empresa_id: Number(data.empresa_id),
      nome: data.name,
      email: data.email,
      telefone: data.telefone,
    });

    return res.json(
      utils.jsonMount(true, resultado.auth, "Perfil atualizado com sucesso.")
    );
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel salvar o perfil.")
    );
  }
});

rota.post("/alterar_minha_senha", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const resultado = await execute.execute_alterar_minha_senha({
      usuario_id: Number(data.usuario_id),
      empresa_id: Number(data.empresa_id),
      senha_atual: data.current_password,
      nova_senha: data.new_password,
    });

    return res.json(
      utils.jsonMount(true, resultado.auth, "Senha atualizada com sucesso.")
    );
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel atualizar a senha.")
    );
  }
});

rota.post("/criar_mensagem_sem_resposta_6h", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }
    const mensagem = await execute.execute_criar_mensagem_automatica_whatsapp(
      data.texto,
      8,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(utils.jsonMount(true, mensagem[0], "Mensagem criada com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/criar_mensagem_sem_resposta_6h"));
  }
});

rota.post("/editar_mensagem_sem_resposta_6h", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }
    const mensagem = await execute.execute_editar_mensagem_automatica_whatsapp(
      data.id,
      data.texto,
      8,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(utils.jsonMount(true, mensagem[0] || {}, "Mensagem alterada com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_mensagem_sem_resposta_6h"));
  }
});

rota.post("/deletar_mensagem_sem_resposta_6h", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }
    const mensagem = await execute.execute_deletar_mensagem_automatica_whatsapp(
      data.id,
      8,
      data.empresa_id,
      buildAutoMessageScopeOptions(data)
    );
    return res.json(utils.jsonMount(true, mensagem[0] || {}, "Mensagem removida com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/deletar_mensagem_sem_resposta_6h"));
  }
});

rota.post("/desativar_minha_conta", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    await execute.execute_desativar_minha_conta({
      usuario_id: Number(data.usuario_id),
      empresa_id: Number(data.empresa_id),
      senha_atual: data.current_password,
    });

    return res.json(utils.jsonMount(true, {}, "Conta desativada com sucesso."));
  } catch (error) {
    console.error("[/alterar_status_mensagem_automatica_whatsapp] erro", {
      code: error?.code || null,
      constraint: error?.constraint || null,
      message: error?.message || String(error),
      detail: error?.detail || null,
    });
    if (error?.message) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel desativar a conta.")
    );
  }
});

rota.post("/excluir_minha_conta", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }
    const resultado = await execute.execute_excluir_minha_conta({
      usuario_id: Number(data.usuario_id),
      empresa_id: Number(data.empresa_id),
      senha_atual: data.current_password || data.senha_atual || data.senha,
    });
    if (resultado.foto_perfil_path_bunny) {
      await bunny
        .deleteFile(resultado.foto_perfil_path_bunny)
        .then((deleteResult) => {
          if (!deleteResult?.success) {
            console.error(
              "[/user/excluir_minha_conta] Bunny recusou a remocao da foto",
              deleteResult
            );
          }
        })
        .catch((error) => {
          console.error("[/user/excluir_minha_conta] falha ao apagar foto na Bunny", error);
        });
    }
    return res.json(utils.jsonMount(true, {}, "Conta excluida e dados pessoais anonimizados."));
  } catch (error) {
    console.error("[/user/excluir_minha_conta] erro", error);
    return res.json(utils.jsonMount(false, {}, error?.message || "Nao foi possivel excluir a conta."));
  }
});

rota.post("/upload_minha_foto_perfil", upload.single("file"), async (req, res) => {
  try {
    const data = security.jwtdecript({ payload: req.body?.payload });
    const empresaId = Number(data?.empresa_id);
    const usuarioId = Number(data?.usuario_id);
    const file = req.file;

    if (!data || !empresaId || !usuarioId) {
      return res.json(utils.jsonMount(false, {}, "Informe usuario e empresa validos."));
    }

    const resultado = await salvarFotoPerfilUsuario({
      empresaId,
      usuarioId,
      file,
    });

    if (
      resultado?.previous_path_bunny &&
      resultado.previous_path_bunny !== resultado?.perfil?.foto_perfil_path_bunny
    ) {
      await bunny.deleteFile(resultado.previous_path_bunny);
    }

    return res.json(
      utils.jsonMount(true, resultado.auth, "Foto de perfil atualizada com sucesso.")
    );
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel enviar a foto de perfil.")
    );
  }
});

rota.post("/remover_minha_foto_perfil", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const resultado = await execute.execute_remover_foto_perfil({
      usuario_id: Number(data.usuario_id),
      empresa_id: Number(data.empresa_id),
    });

    if (resultado?.previous_path_bunny) {
      await bunny.deleteFile(resultado.previous_path_bunny);
    }

    return res.json(
      utils.jsonMount(true, resultado.auth, "Foto de perfil removida com sucesso.")
    );
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel remover a foto de perfil.")
    );
  }
});

module.exports = rota;

