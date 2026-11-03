const crypto = require("crypto");
const axios = require("axios");
const security = require("../security/cypher");
const execute = require("../services/execute_meta");
const executeVendas = require("../services/execute_vendas");
const executeAtendimento = require("../services/execute_atendimento");
const executeAppSafety = require("../services/execute_app_safety");
const utils = require("../utils/templates");
const bunny = require("../utils/bunny_config");
const { notifyChatUpdate, notifyPushMessage } = require("../server/realtime");
const { normalizeWebhookUrl, resolveWebhookBaseUrl } = require("../utils/webhook_url");

const DEFAULT_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v25.0";

function getMetaSystemAccessToken() {
  const accessToken = String(process.env.META_ACCESS_TOKEN || "").trim();
  return accessToken || null;
}

function normalizeTemplateMediaSampleType(value) {
  const normalized = String(value || "NONE")
    .trim()
    .toUpperCase();

  return ["IMAGE", "VIDEO", "DOCUMENT"].includes(normalized)
    ? normalized
    : "NONE";
}

function validateTemplateMediaSampleFile(file, mediaSampleType) {
  if (!file || mediaSampleType === "NONE") return;

  const mimeType = String(file.mimetype || "").toLowerCase();

  if (mediaSampleType === "IMAGE" && !mimeType.startsWith("image/")) {
    throw new Error(
      "Voce escolheu um header IMAGE, mas o arquivo enviado nao e uma imagem. Envie um arquivo JPG, PNG ou outro formato de imagem suportado pela Meta."
    );
  }

  if (mediaSampleType === "VIDEO" && !mimeType.startsWith("video/")) {
    throw new Error(
      "Voce escolheu um header VIDEO, mas o arquivo enviado nao e um video. Envie um arquivo de video compativel com a Meta."
    );
  }

  if (
    mediaSampleType === "DOCUMENT" &&
    mimeType !== "application/pdf"
  ) {
    throw new Error(
      "Voce escolheu um header DOCUMENT, mas o arquivo enviado nao e PDF. Para este tipo de template, a Meta aceita PDF como arquivo de amostra."
    );
  }
}

async function uploadMetaResumableFileHandle(file, accessToken) {
  const appId = process.env.META_APP_ID || "";
  if (!appId) {
    throw new Error("META_APP_ID nao configurado para upload de arquivo na Meta.");
  }

  const fileName = encodeURIComponent(file.originalname || "sample-media");
  const fileType = encodeURIComponent(file.mimetype || "application/octet-stream");
  const startResponse = await axios.post(
    `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${appId}/uploads` +
      `?file_name=${fileName}&file_length=${Number(file.size || 0)}&file_type=${fileType}`,
    null,
    {
      headers: {
        Authorization: `OAuth ${accessToken}`,
      },
    }
  );

  const uploadSessionId = String(startResponse.data?.id || "").trim();
  if (!uploadSessionId) {
    throw new Error(
      "A Meta nao aceitou iniciar o upload do arquivo de amostra. Verifique o tipo do arquivo e tente novamente."
    );
  }

  const uploadResponse = await axios.post(
    `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${uploadSessionId}`,
    file.buffer,
    {
      headers: {
        Authorization: `OAuth ${accessToken}`,
        "Content-Type": "application/octet-stream",
        file_offset: "0",
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );

  const headerHandle = String(uploadResponse.data?.h || "").trim();
  if (!headerHandle) {
    throw new Error(
      "A Meta nao concluiu o upload do arquivo de amostra. Tente reenviar o arquivo."
    );
  }

  return headerHandle;
}

async function buildTemplateCreatePayload(data, sampleFile, accessToken) {
  const mediaSampleType = normalizeTemplateMediaSampleType(data.media_sample_type);
  const sourceComponents = Array.isArray(data.components) ? data.components : [];
  const components = [];

  if (mediaSampleType !== "NONE") {
    if (!sampleFile) {
      throw new Error(
        "Voce escolheu um header com midia, mas nao enviou o arquivo de amostra. A Meta exige esse arquivo para criar e revisar o template."
      );
    }

    validateTemplateMediaSampleFile(sampleFile, mediaSampleType);
    const headerHandle = await uploadMetaResumableFileHandle(sampleFile, accessToken);

    components.push({
      type: "HEADER",
      format: mediaSampleType,
      example: {
        header_handle: [headerHandle],
      },
    });
  }

  sourceComponents.forEach((component) => {
    const componentType = String(component?.type || "").trim().toUpperCase();
    if (!componentType) return;

    if (componentType === "HEADER" && mediaSampleType !== "NONE") {
      return;
    }

    components.push(component);
  });

  return {
    name: data.name,
    category: data.category,
    language: data.language,
    components,
    ...(data.allow_category_change !== undefined
      ? { allow_category_change: data.allow_category_change }
      : {}),
    ...(data.parameter_format ? { parameter_format: data.parameter_format } : {}),
  };
}

function normalizeWhatsAppProfileResponse(rawProfile, parametros = null) {
  const source =
    Array.isArray(rawProfile?.data) ? rawProfile.data[0] || {} :
    rawProfile?.data && typeof rawProfile.data === "object" ? rawProfile.data :
    rawProfile?.profile && typeof rawProfile.profile === "object" ? rawProfile.profile :
    rawProfile && typeof rawProfile === "object" ? rawProfile :
    {};

  const websites = Array.isArray(source?.websites)
    ? source.websites
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

  return {
    about: source?.about ? String(source.about).trim() : "",
    address: source?.address ? String(source.address).trim() : "",
    description: source?.description ? String(source.description).trim() : "",
    email: source?.email ? String(source.email).trim() : "",
    vertical: source?.vertical ? String(source.vertical).trim() : "",
    profile_picture_url:
      source?.profile_picture_url ? String(source.profile_picture_url).trim() : "",
    websites,
    display_name: String(
      source?.verified_name ||
        parametros?.meta_verified_name ||
        parametros?.verified_name ||
        ""
    ).trim(),
    verified_name: String(
      source?.verified_name ||
        parametros?.meta_verified_name ||
        parametros?.verified_name ||
        ""
    ).trim(),
    display_phone_number: String(
      source?.display_phone_number ||
        parametros?.meta_display_phone_number ||
        parametros?.display_phone_number ||
        ""
    ).trim(),
    phone_number_id: String(
      parametros?.meta_phone_number_id ||
        parametros?.phone_number_id ||
        parametros?.numero ||
        ""
    ).trim(),
    whatsapp_account_id: String(
      parametros?.whatsapp_account_id || ""
    ).trim(),
    meta_param_id: Number(parametros?.id || 0) || null,
  };
}

function parseWhatsAppProfileWebsites(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateWhatsAppProfileFieldLength(label, value, maxLength) {
  if (String(value || "").length > maxLength) {
    throw new Error(`${label} excede o limite de ${maxLength} caracteres.`);
  }
}

function validateWhatsAppProfilePictureFile(file) {
  if (!file) return;

  const mimeType = String(file.mimetype || "").toLowerCase();
  const allowedMimeTypes = ["image/jpeg", "image/jpg"];

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error(
      "A foto de perfil do WhatsApp precisa estar em JPG/JPEG para a Meta aceitar o upload."
    );
  }
}

function normalizeProfileComparableValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join("\n");
  }

  return String(value || "").trim();
}

function buildWhatsAppProfileUpdatePayload(
  data = {},
  currentProfile = {},
  profilePictureHandle = null
) {
  const payload = {
    messaging_product: "whatsapp",
  };
  const hasOwn = (field) =>
    Object.prototype.hasOwnProperty.call(data || {}, field);
  const current = currentProfile || {};

  if (hasOwn("about")) {
    const about = String(data.about || "").trim();
    if (about) {
      validateWhatsAppProfileFieldLength("Sobre", about, 139);
    }
    if (about !== normalizeProfileComparableValue(current.about)) {
      payload.about = about;
    }
  }

  if (hasOwn("address")) {
    const address = String(data.address || "").trim();
    if (address) {
      validateWhatsAppProfileFieldLength("Endereco", address, 256);
    }
    if (address !== normalizeProfileComparableValue(current.address)) {
      payload.address = address;
    }
  }

  if (hasOwn("description")) {
    const description = String(data.description || "").trim();
    if (description) {
      validateWhatsAppProfileFieldLength("Descricao", description, 512);
    }
    if (description !== normalizeProfileComparableValue(current.description)) {
      payload.description = description;
    }
  }

  if (hasOwn("email")) {
    const email = String(data.email || "").trim();
    if (email) {
      validateWhatsAppProfileFieldLength("Email", email, 128);
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        throw new Error("Informe um email valido para o perfil.");
      }
    }
    if (email !== normalizeProfileComparableValue(current.email)) {
      payload.email = email;
    }
  }

  if (hasOwn("websites")) {
    const websites = parseWhatsAppProfileWebsites(data.websites).slice(0, 2);
    websites.forEach((website) => {
      validateWhatsAppProfileFieldLength("Site", website, 256);
      if (!/^https?:\/\//i.test(website)) {
        throw new Error("Cada site deve comecar com http:// ou https://.");
      }
    });
    if (
      normalizeProfileComparableValue(websites) !==
      normalizeProfileComparableValue(current.websites)
    ) {
      payload.websites = websites;
    }
  }

  if (profilePictureHandle) {
    payload.profile_picture_handle = profilePictureHandle;
  }

  const editableFieldCount = Object.keys(payload).filter(
    (key) => key !== "messaging_product"
  ).length;

  if (editableFieldCount === 0) {
    throw new Error("Informe ao menos um campo do perfil para atualizar.");
  }

  return payload;
}

function getUploadedTemplateFile(files = {}) {
  return (
    files.header_image_file?.[0] ||
    files.header_document_file?.[0] ||
    files.header_video_file?.[0] ||
    files.header_file?.[0] ||
    null
  );
}

function buildTemplatePayloadForDispatch(data, uploadedHeaderMedia = null) {
  const templateName = data.template_name;
  const languageCode = data.language_code || data.language || "pt_BR";
  const templatePayload = {
    ...data,
    name: templateName,
    language_code: languageCode
  };

  if (uploadedHeaderMedia?.mediaType === "image") {
    templatePayload.header_image = { link: uploadedHeaderMedia.url };
  }

  if (uploadedHeaderMedia?.mediaType === "document") {
    templatePayload.header_document = { link: uploadedHeaderMedia.url };
  }

  if (uploadedHeaderMedia?.mediaType === "video") {
    templatePayload.header_video = { link: uploadedHeaderMedia.url };
  }

  return {
    templateName,
    languageCode,
    templatePayload
  };
}

function normalizeTemplateDynamicParameterDescriptor(parameter) {
  if (!parameter || typeof parameter !== "object") {
    return null;
  }

  const parameterSource = String(
    parameter.parameter_source || parameter.value_source || parameter.source || ""
  )
    .trim()
    .toLowerCase();

  if (parameterSource !== "contact_field") {
    return null;
  }

  const field = String(parameter.field || parameter.contact_field || "")
    .trim()
    .toLowerCase();

  if (!field) {
    return null;
  }

  return {
    field,
    nameFormat: String(parameter.name_format || parameter.format || "full_name")
      .trim()
      .toLowerCase(),
  };
}

function getFirstNameFromFullName(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized.split(/\s+/)[0] || normalized;
}

function formatTemplateBirthday(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = String(parsed.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

function getTemplateDynamicParameterLabel(descriptor) {
  if (!descriptor) {
    return "campo dinamico";
  }

  if (descriptor.field === "contact_name") {
    return descriptor.nameFormat === "first_name"
      ? "primeiro nome do cliente"
      : "nome completo do cliente";
  }

  if (descriptor.field === "birthday") {
    return "data de aniversario do cliente";
  }

  if (descriptor.field === "email") {
    return "email do cliente";
  }

  return "campo dinamico do cliente";
}

async function loadTemplateDispatchRecipientContext(data = {}) {
  const fallbackName = String(
    data.contato_nome || data.contact_name || data.nome || ""
  ).trim();
  const fallbackEmail = String(data.email || "").trim();
  const fallbackBirthday = String(data.data_aniversario || data.birthday || "").trim();
  const clienteId =
    data.cliente_id === undefined || data.cliente_id === null
      ? null
      : Number(data.cliente_id) || data.cliente_id;

  let cliente = null;

  if (clienteId) {
    const rows = await executeAtendimento.execute_get_cliente_info(clienteId);
    cliente = rows?.[0] || null;
  } else if (data.conversa_id) {
    const clienteRows = await executeAtendimento.execute_get_cliente(data.conversa_id);
    const conversaClienteId = clienteRows?.[0]?.id || null;
    if (conversaClienteId) {
      const rows = await executeAtendimento.execute_get_cliente_info(conversaClienteId);
      cliente = rows?.[0] || null;
    }
  }

  return {
    cliente_id: cliente?.cliente_id || clienteId || null,
    contato_nome:
      fallbackName ||
      String(cliente?.nome || "").trim() ||
      "",
    email:
      fallbackEmail ||
      String(cliente?.email || "").trim() ||
      "",
    data_aniversario:
      fallbackBirthday ||
      String(cliente?.data_aniversario || "").trim() ||
      "",
  };
}

function resolveTemplateDynamicParameterValue(parameter, recipientContext, parameterPath) {
  const descriptor = normalizeTemplateDynamicParameterDescriptor(parameter);
  if (!descriptor) {
    return {
      resolved: parameter,
      error: null,
    };
  }

  let value = "";

  if (descriptor.field === "contact_name") {
    const fullName = String(recipientContext?.contato_nome || "").trim();
    value =
      descriptor.nameFormat === "first_name"
        ? getFirstNameFromFullName(fullName)
        : fullName;
  } else if (descriptor.field === "birthday") {
    value = formatTemplateBirthday(recipientContext?.data_aniversario || "");
  } else if (descriptor.field === "email") {
    value = String(recipientContext?.email || "").trim();
  }

  if (!value) {
    return {
      resolved: {
        type: "text",
        text: "",
      },
      error: `Destinatario sem ${getTemplateDynamicParameterLabel(descriptor)} para preencher ${parameterPath}.`,
    };
  }

  return {
    resolved: {
      type: "text",
      text: value,
    },
    error: null,
  };
}

function resolveTemplateDynamicParameterCollection(parameters, recipientContext, parameterPathPrefix) {
  if (!Array.isArray(parameters)) {
    return {
      parameters: [],
      errors: [],
    };
  }

  const errors = [];
  const resolvedParameters = parameters.map((parameter, index) => {
    const parameterPath = `${parameterPathPrefix} {{${index + 1}}}`;
    const resolved = resolveTemplateDynamicParameterValue(
      parameter,
      recipientContext,
      parameterPath
    );

    if (resolved.error) {
      errors.push(resolved.error);
    }

    return resolved.resolved;
  });

  return {
    parameters: resolvedParameters,
    errors,
  };
}

async function resolveTemplateDispatchPayloadForRecipient(data = {}) {
  const recipientContext = await loadTemplateDispatchRecipientContext(data);
  const headerResolution = resolveTemplateDynamicParameterCollection(
    data.header_parameters,
    recipientContext,
    "Header"
  );
  const bodyResolution = resolveTemplateDynamicParameterCollection(
    data.body_parameters,
    recipientContext,
    "Body"
  );
  const buttonGroups = Array.isArray(data.button_parameters) ? data.button_parameters : [];
  const buttonErrors = [];
  const resolvedButtonParameters = buttonGroups.map((button) => {
    const buttonIndex = Number(button?.index);
    const normalizedButtonIndex = Number.isFinite(buttonIndex) ? buttonIndex : 0;
    const resolution = resolveTemplateDynamicParameterCollection(
      button?.parameters,
      recipientContext,
      `Botao ${normalizedButtonIndex + 1}`
    );

    if (resolution.errors.length) {
      buttonErrors.push(...resolution.errors);
    }

    return {
      ...button,
      parameters: resolution.parameters,
    };
  });

  return {
    recipientContext,
    templatePayload: {
      ...data,
      header_parameters: headerResolution.parameters,
      body_parameters: bodyResolution.parameters,
      button_parameters: resolvedButtonParameters,
    },
    errors: [
      ...headerResolution.errors,
      ...bodyResolution.errors,
      ...buttonErrors,
    ],
  };
}

function normalizeTemplatePreviewParameterValue(parameter) {
  if (parameter === null || parameter === undefined) {
    return null;
  }

  if (
    typeof parameter === "string" ||
    typeof parameter === "number" ||
    typeof parameter === "boolean"
  ) {
    return String(parameter);
  }

  if (typeof parameter !== "object") {
    return null;
  }

  const dynamicDescriptor = normalizeTemplateDynamicParameterDescriptor(parameter);
  if (dynamicDescriptor) {
    return `[${getTemplateDynamicParameterLabel(dynamicDescriptor)}]`;
  }

  const normalizedType = String(parameter.type || "text").trim().toLowerCase();

  if (normalizedType === "text") {
    if (parameter.text !== undefined && parameter.text !== null) {
      return String(parameter.text);
    }

    if (parameter.value !== undefined && parameter.value !== null) {
      return String(parameter.value);
    }
  }

  if (normalizedType === "image") {
    return "[Imagem do template]";
  }

  if (normalizedType === "document") {
    return "[Documento do template]";
  }

  if (normalizedType === "video") {
    return "[Video do template]";
  }

  if (normalizedType === "currency" && parameter.currency?.fallback_value) {
    return String(parameter.currency.fallback_value);
  }

  if (normalizedType === "date_time" && parameter.date_time?.fallback_value) {
    return String(parameter.date_time.fallback_value);
  }

  if (parameter.text !== undefined && parameter.text !== null) {
    return String(parameter.text);
  }

  return null;
}

function renderTemplatePreviewText(text, parameters = []) {
  const normalizedText = String(text || "").trim();
  if (!normalizedText) {
    return "";
  }

  return normalizedText.replace(/{{\s*(\d+)\s*}}/g, (_, rawIndex) => {
    const parameterIndex = Number(rawIndex) - 1;
    const parameterValue = normalizeTemplatePreviewParameterValue(
      Array.isArray(parameters) ? parameters[parameterIndex] : null
    );

    return parameterValue !== null && parameterValue !== ""
      ? parameterValue
      : `{{${rawIndex}}}`;
  });
}

function getTemplateButtonPreviewParameters(buttonParameters, buttonIndex) {
  const groups = Array.isArray(buttonParameters) ? buttonParameters : [];

  const exactMatch = groups.find((group) => Number(group?.index) === buttonIndex);
  if (exactMatch?.parameters) {
    return exactMatch.parameters;
  }

  const oneBasedMatch = groups.find((group) => Number(group?.index) === buttonIndex + 1);
  if (oneBasedMatch?.parameters) {
    return oneBasedMatch.parameters;
  }

  return [];
}

function buildTemplatePreviewMessage(template, requestData = {}) {
  if (!template) {
    return "";
  }

  const sections = [];
  const headerParameters = Array.isArray(requestData.header_parameters)
    ? requestData.header_parameters
    : [];
  const bodyParameters = Array.isArray(requestData.body_parameters)
    ? requestData.body_parameters
    : [];
  const buttonParameters = Array.isArray(requestData.button_parameters)
    ? requestData.button_parameters
    : [];
  const headerType = String(template.components?.header?.type || "").trim().toUpperCase();
  const templateName = String(template.name || requestData.template_name || "").trim();
  const renderedHeaderText = renderTemplatePreviewText(
    template.components?.header?.text,
    headerParameters
  );
  const renderedBodyText = renderTemplatePreviewText(
    template.components?.body?.text,
    bodyParameters
  );
  const footerText = String(template.components?.footer?.text || "").trim();

  if (templateName) {
    sections.push(`[Template: ${templateName}]`);
  }

  if (headerType && headerType !== "TEXT") {
    if (headerType === "IMAGE") {
      sections.push("[Imagem do template]");
    } else if (headerType === "DOCUMENT") {
      sections.push("[Documento do template]");
    } else if (headerType === "VIDEO") {
      sections.push("[Video do template]");
    } else {
      sections.push(`[Header ${headerType}]`);
    }
  } else if (renderedHeaderText) {
    sections.push(renderedHeaderText);
  }

  if (renderedBodyText) {
    sections.push(renderedBodyText);
  }

  if (footerText) {
    sections.push(`Rodape: ${footerText}`);
  }

  const buttons = Array.isArray(template.components?.buttons)
    ? template.components.buttons
    : [];

  buttons.forEach((button, buttonIndex) => {
    const buttonText = String(button?.text || "").trim();
    const buttonType = String(button?.type || "").trim().toUpperCase();
    const renderedButtonUrl = renderTemplatePreviewText(
      button?.url,
      getTemplateButtonPreviewParameters(buttonParameters, buttonIndex)
    );

    if (buttonType === "URL") {
      const urlText = renderedButtonUrl || String(button?.url || "").trim();
      sections.push(
        `Botao: ${buttonText || "Abrir link"}${urlText ? ` - ${urlText}` : ""}`
      );
      return;
    }

    if (buttonType === "PHONE_NUMBER") {
      const phoneText = String(button?.phone_number || "").trim();
      sections.push(
        `Botao: ${buttonText || "Ligar"}${phoneText ? ` - ${phoneText}` : ""}`
      );
      return;
    }

    if (buttonText) {
      sections.push(`Botao: ${buttonText}`);
    }
  });

  return sections.filter(Boolean).join("\n").trim();
}

function resolveTemplateHeaderMediaSource(requestData = {}, uploadedHeaderMedia = null) {
  if (uploadedHeaderMedia?.url) {
    return {
      mediaType: uploadedHeaderMedia.mediaType || null,
      mediaUrl: uploadedHeaderMedia.url,
    };
  }

  const imageLink =
    requestData?.header_image?.link ||
    requestData?.header_image?.url ||
    requestData?.image?.link ||
    requestData?.image?.url ||
    requestData?.header_image ||
    requestData?.image;
  if (typeof imageLink === "string" && imageLink.trim()) {
    return {
      mediaType: "image",
      mediaUrl: imageLink.trim(),
    };
  }

  const documentLink =
    requestData?.header_document?.link ||
    requestData?.header_document?.url ||
    requestData?.document?.link ||
    requestData?.document?.url ||
    requestData?.header_document ||
    requestData?.document;
  if (typeof documentLink === "string" && documentLink.trim()) {
    return {
      mediaType: "document",
      mediaUrl: documentLink.trim(),
    };
  }

  const videoLink =
    requestData?.header_video?.link ||
    requestData?.header_video?.url ||
    requestData?.video?.link ||
    requestData?.video?.url ||
    requestData?.header_video ||
    requestData?.video;
  if (typeof videoLink === "string" && videoLink.trim()) {
    return {
      mediaType: "video",
      mediaUrl: videoLink.trim(),
    };
  }

  return {
    mediaType: null,
    mediaUrl: null,
  };
}

function buildTemplateChatPayload(
  template,
  requestData = {},
  uploadedHeaderMedia = null
) {
  if (!template) {
    return null;
  }

  const headerText = renderTemplatePreviewText(
    template.components?.header?.text,
    Array.isArray(requestData.header_parameters) ? requestData.header_parameters : []
  );
  const bodyText = renderTemplatePreviewText(
    template.components?.body?.text,
    Array.isArray(requestData.body_parameters) ? requestData.body_parameters : []
  );
  const footerText = String(template.components?.footer?.text || "").trim();
  const headerType = String(template.components?.header?.type || "").trim().toUpperCase();
  const headerMedia = resolveTemplateHeaderMediaSource(requestData, uploadedHeaderMedia);
  const buttons = Array.isArray(template.components?.buttons)
    ? template.components.buttons.map((button, buttonIndex) => {
        const buttonType = String(button?.type || "").trim().toUpperCase();
        const buttonText = String(button?.text || "").trim();
        const buttonUrl = renderTemplatePreviewText(
          button?.url,
          getTemplateButtonPreviewParameters(requestData.button_parameters, buttonIndex)
        );
        const phoneNumber = String(button?.phone_number || "").trim();

        return {
          index: buttonIndex + 1,
          type: buttonType || "QUICK_REPLY",
          text: buttonText || null,
          url: buttonType === "URL" ? buttonUrl || String(button?.url || "").trim() || null : null,
          phoneNumber:
            buttonType === "PHONE_NUMBER" ? phoneNumber || null : null,
        };
      })
    : [];

  return {
    kind: "template",
    templateName: String(template.name || requestData.template_name || "").trim() || null,
    language:
      String(
        template.language ||
          requestData.language_code ||
          requestData.language ||
          "pt_BR"
      ).trim() || "pt_BR",
    previewMessage: buildTemplatePreviewMessage(template, requestData) || null,
    header: {
      type: headerType || null,
      text: headerText || null,
      mediaType: headerMedia.mediaType || null,
      mediaUrl: headerMedia.mediaUrl || null,
    },
    bodyText: bodyText || null,
    footerText: footerText || null,
    buttons,
  };
}

function findTemplateDefinition(templates, templateName) {
  return (templates?.templates || []).find((template) => {
    return String(template?.name || "") === String(templateName);
  }) || null;
}

function hasExplicitTemplateHeaderMedia(data = {}) {
  return Boolean(
    data.header_image ||
      data.image ||
      data.header_document ||
      data.document ||
      data.header_video ||
      data.video
  );
}

async function resolveTemplateHeaderMedia(req, data, parametros = null) {
  const uploadedFile = getUploadedTemplateFile(req.files || {});
  const resolvedParametros = parametros || (await getMetaParametrosOrFail(data));
  const templateName = String(data.template_name || "").trim();
  const languageCode = String(data.language_code || data.language || "pt_BR").trim() || "pt_BR";
  const ownerId = data.usuario_id || data.empresa_id || "meta";

  if (uploadedFile) {
    return utils.saveTemplateHeaderImageToGallery({
      empresa_id: resolvedParametros.empresa_id || data.empresa_id,
      meta_param_id: resolvedParametros.id || data.meta_param_id,
      template_name: templateName,
      language_code: languageCode,
      file: uploadedFile,
      ownerId,
    });
  }

  if (hasExplicitTemplateHeaderMedia(data)) {
    return null;
  }

  return utils.findSavedTemplateHeaderImage({
    empresa_id: resolvedParametros.empresa_id || data.empresa_id,
    meta_param_id: resolvedParametros.id || data.meta_param_id,
    template_name: templateName,
    language_code: languageCode,
  });
}

async function buildTemplateDispatchContext(req, data, parametros = null) {
  const resolvedParametros =
    parametros || (await getMetaParametrosOrFail(data, { preferMetaParamId: true }));
  const uploadedHeaderMedia = await resolveTemplateHeaderMedia(req, data, resolvedParametros);

  const {
    templateName,
    languageCode,
    templatePayload
  } = buildTemplatePayloadForDispatch(data, uploadedHeaderMedia);

  const templates = await utils.getTemplates({
    empresa_id: data.empresa_id,
    meta_param_id: resolvedParametros.id || data.meta_param_id,
    conversa_id: data.conversa_id,
  });
  const selectedTemplate = findTemplateDefinition(templates, templateName);

  const validation = validateTemplateForDispatch(
    selectedTemplate,
    templatePayload,
    templates?.templates || []
  );
  const previewMessage = buildTemplatePreviewMessage(selectedTemplate, templatePayload);
  const templateChatPayload = buildTemplateChatPayload(
    selectedTemplate,
    templatePayload,
    uploadedHeaderMedia
  );

  return {
    templateName,
    languageCode,
    uploadedHeaderMedia,
    templatePayload: previewMessage
      ? {
          ...templatePayload,
          preview_message: previewMessage
        }
      : templatePayload,
    validation,
    selectedTemplate,
    previewMessage,
    templateChatPayload
  };
}

async function cleanupUploadedTemplateMedia(uploadedHeaderMedia) {
  if (uploadedHeaderMedia?.persisted) {
    return;
  }

  if (uploadedHeaderMedia?.url) {
    await utils.deleteBunnyFileByUrl(uploadedHeaderMedia.url);
  }
}


async function getMetaParametrosOrFail(context, options = {}) {
  const empresaId =
    typeof context === "object" && context !== null
      ? Number(context.empresa_id)
      : Number(context);
  const metaParamId =
    typeof context === "object" && context !== null
      ? Number(context.meta_param_id)
      : null;
  const conversaId =
    typeof context === "object" && context !== null
      ? Number(context.conversa_id)
      : null;
  const preferMetaParamId = options?.preferMetaParamId === true;

  let parametros = null;

  if (preferMetaParamId && Number.isInteger(metaParamId) && metaParamId > 0) {
    parametros = await execute.execute_get_paramentros_whats_by_id(
      metaParamId,
      Number.isInteger(empresaId) && empresaId > 0 ? empresaId : null,
    );
  } else if (Number.isInteger(conversaId) && conversaId > 0) {
    parametros = await execute.execute_get_paramentros_whats_by_conversa_id(
      conversaId,
    );
  } else if (Number.isInteger(metaParamId) && metaParamId > 0) {
    parametros = await execute.execute_get_paramentros_whats_by_id(
      metaParamId,
      Number.isInteger(empresaId) && empresaId > 0 ? empresaId : null,
    );
  } else {
    parametros = await execute.execute_get_paramentros_whats(empresaId);
  }

  if (!parametros || !parametros.length) {
    return null;
  }
  return parametros[0];
}

async function getMetaParametros(){
  const parametros = await execute.execute_get_paramentros();
  if (!parametros || !parametros.length) {
    return null;
  }
  return parametros[0];
}


function toUnix(value, fallbackDate) {
  if (!value) return Math.floor(fallbackDate.getTime() / 1000);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return Math.floor(fallbackDate.getTime() / 1000);
  }
  return Math.floor(date.getTime() / 1000);
}

function parseCostValue(cost) {
  if (typeof cost === "number") return cost;
  if (typeof cost === "string") return Number(cost) || 0;
  if (cost && typeof cost === "object") {
    return Number(cost.value || cost.amount || 0) || 0;
  }
  return 0;
}

function parseVolumeValue(volume) {
  if (typeof volume === "number") return volume;
  if (typeof volume === "string") return Number(volume) || 0;
  return 0;
}

function normalizePricingRows(rawData) {
  const rows = [];

  (rawData || []).forEach((entry) => {
    const points = Array.isArray(entry.data_points) && entry.data_points.length
      ? entry.data_points
      : [entry];

    points.forEach((point) => {
      const cost = parseCostValue(point.cost);
      const volume = parseVolumeValue(point.volume);
      const currency = point.cost?.currency || entry.currency || null;

      if (cost === 0 && volume === 0) return;

      rows.push({
        start: point.start || entry.start || null,
        end: point.end || entry.end || null,
        cost,
        volume,
        currency,
        cost_per_message: volume > 0 ? Number((cost / volume).toFixed(6)) : 0,
        country: point.country || entry.country || null,
        phone_number: point.phone_number || entry.phone_number || null,
        pricing_category: point.pricing_category || entry.pricing_category || null,
        pricing_type: point.pricing_type || entry.pricing_type || null
      });
    });
  });

  return rows;
}

function buildWebhookVerifyToken(empresaId) {
  return `meta_${empresaId}_${crypto.randomBytes(12).toString("hex")}`;
}

function normalizeRedirectUri(url) {
  const value = String(url || "").trim();
  return value || null;
}

function buildWebhookUrl(req, explicitUrl = null) {
  const resolvedExplicitUrl = String(explicitUrl || "").trim() || null;

  if (resolvedExplicitUrl) {
    return normalizeWebhookUrl(resolvedExplicitUrl);
  }

  const baseUrl = resolveWebhookBaseUrl(req, [process.env.META_WEBHOOK_BASE_URL]);
  return baseUrl ? `${baseUrl}/meta/webhook` : null;
}

function extractWebhookIdentifiers(body) {
  const identifiers = {
    phone_number_id: null,
    wa_id: null,
    whatsapp_account_id: null
  };

  const entries = Array.isArray(body?.entry) ? body.entry : [];

  for (const entry of entries) {
    if (!identifiers.whatsapp_account_id && entry?.id) {
      identifiers.whatsapp_account_id = String(entry.id);
    }

    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const metadata = change?.value?.metadata || {};
      const contacts = Array.isArray(change?.value?.contacts) ? change.value.contacts : [];
      const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];

      if (!identifiers.phone_number_id && metadata.phone_number_id) {
        identifiers.phone_number_id = String(metadata.phone_number_id);
      }

      if (!identifiers.wa_id) {
        const contactWaId = contacts.find((contact) => contact?.wa_id)?.wa_id;
        const statusRecipientId = statuses.find((status) => status?.recipient_id)?.recipient_id;
        identifiers.wa_id = String(contactWaId || statusRecipientId || "");
      }

      if (identifiers.phone_number_id || identifiers.wa_id || identifiers.whatsapp_account_id) {
        return {
          phone_number_id: identifiers.phone_number_id || null,
          wa_id: identifiers.wa_id || null,
          whatsapp_account_id: identifiers.whatsapp_account_id || null
        };
      }
    }
  }

  return identifiers;
}

function mapMetaAccountSummary(parametros) {
  if (!parametros) return null;

  return {
    id: parametros.id || null,
    empresa_id: parametros.empresa_id || null,
    business_id: parametros.meta_business_id || null,
    business_name: parametros.meta_business_name || null,
    business_manager_id: parametros.meta_business_manager_id || null,
    business_manager_name: parametros.meta_business_manager_name || null,
    whatsapp_account_id: parametros.whatsapp_account_id || null,
    whatsapp_account_name: parametros.meta_waba_name || null,
    phone_number_id:
      parametros.meta_phone_number_id || parametros.phone_number_id || parametros.numero || null,
    display_phone_number: parametros.meta_display_phone_number || null,
    verified_name: parametros.meta_verified_name || null,
    wa_id: parametros.meta_wa_id || null,
    webhook_verify_token: parametros.meta_webhook_verify_token || null,
    webhook_url: parametros.meta_webhook_url || null,
    graph_api_version: parametros.meta_graph_api_version || DEFAULT_GRAPH_VERSION,
    token_expires_at: parametros.meta_access_token_expires_at || null,
    last_embedded_signup_at: parametros.meta_last_embedded_signup_at || null,
    color: parametros.meta_cor || parametros.cor || null,
    ativo: parametros.ativo !== false
  };
}

function mountMetaStatus(parametros, contas = []) {
  const accounts = Array.isArray(contas)
    ? contas.map(mapMetaAccountSummary).filter(Boolean)
    : [];
  const accessToken = getMetaSystemAccessToken();

  if (!parametros) {
    const missingFields = [
      "whatsapp_account_id",
      "phone_number_id"
    ];
    if (!accessToken) missingFields.unshift("META_ACCESS_TOKEN");

    return {
      conectado: false,
      pronto_para_uso: false,
      campos_faltantes: missingFields,
      accounts
    };
  }

  const phoneNumberId = parametros.meta_phone_number_id || parametros.numero;
  const missingFields = [];

  if (!accessToken) missingFields.push("META_ACCESS_TOKEN");
  if (!parametros.whatsapp_account_id) missingFields.push("whatsapp_account_id");
  if (!phoneNumberId) missingFields.push("phone_number_id");

  return {
    conectado: missingFields.length === 0,
    pronto_para_uso: missingFields.length === 0,
    campos_faltantes: missingFields,
    ...mapMetaAccountSummary({
      ...parametros,
      meta_phone_number_id: phoneNumberId || null,
    }),
    accounts
  };
}

function normalizePhoneMatchValue(value) {
  return String(value || "").replace(/\D/g, "");
}

function buildCompanyWelcomeMessage(parametros) {
  const companyName =
    parametros?.empresa_nome ||
    parametros?.meta_business_name ||
    parametros?.meta_waba_name ||
    "nossa empresa";

  return `Bem-vindo(a) a ${companyName}! Recebemos sua mensagem e vamos continuar seu atendimento por aqui.`;
}

function normalizeOptionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function shouldLeadStartedMessageGenerateAutoMessage(metadata = null) {
  const rawValue =
    metadata &&
    typeof metadata === "object" &&
    Object.prototype.hasOwnProperty.call(
      metadata,
      "lead_started_messages_generate_auto_message"
    )
      ? metadata.lead_started_messages_generate_auto_message
      : true;

  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (typeof rawValue === "number") {
    return rawValue === 1;
  }

  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    if (["1", "true", "yes", "sim", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "nao", "não", "off"].includes(normalized)) {
      return false;
    }
  }

  return true;
}

async function shouldSendLeadStartedAutoMessage({
  empresaId,
  clienteId,
  numero,
  empresaMetaParamId,
  conversaId = null,
}) {
  if (!empresaId || (!clienteId && !numero)) {
    return true;
  }

  const rows =
    await execute.execute_get_latest_template_dispatch_item_for_lead_auto_message_rule({
      empresa_id: empresaId,
      cliente_id: clienteId || null,
      numero: numero || null,
      empresa_meta_param_id: empresaMetaParamId || null,
    });
  const latestDispatch = rows?.[0] || null;
  const shouldGenerateAutoMessage = shouldLeadStartedMessageGenerateAutoMessage(
    latestDispatch?.metadata || null
  );

  if (shouldGenerateAutoMessage) {
    return true;
  }

  const firstConversationId = Number(
    latestDispatch?.first_customer_conversa_id_after_dispatch || 0
  );
  const currentConversationId = Number(conversaId || 0);

  if (!firstConversationId || !currentConversationId) {
    return false;
  }

  return firstConversationId !== currentConversationId;
}

async function getWelcomeMessageForCompany(parametros) {
  const mensagem =
    await execute.execute_get_mensagem_automatica_boas_vindas(
      parametros.empresa_id,
      parametros.id || null
    );
  const mensagemConfigurada = mensagem?.[0] || null;
  const habilitada = mensagemConfigurada?.habilitada !== false;

  if (!habilitada) {
    return {
      habilitada: false,
      texto: null,
      mensagem_complementar_texto: null,
      galeria_imagem_url: null,
    };
  }

  const textoPrincipal =
    normalizeOptionalText(mensagemConfigurada?.texto) ||
    buildCompanyWelcomeMessage(parametros);

  return {
    habilitada: true,
    texto: textoPrincipal,
    mensagem_complementar_texto: normalizeOptionalText(
      mensagemConfigurada?.mensagem_complementar_texto
    ),
    galeria_imagem_url: normalizeOptionalText(
      mensagemConfigurada?.galeria_imagem_url
    ),
  };
}

function getPrimaryWebhookChanges(body) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  return entries.flatMap((entry) =>
    Array.isArray(entry?.changes) ? entry.changes : []
  );
}

function normalizeContactPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeIncomingMessageType(type) {
  if (!type) return null;
  if (type === "contact") return "contacts";
  return String(type);
}

function isIncomingEditEvent(message) {
  return normalizeIncomingMessageType(message?.type) === "edit";
}

function isIncomingRevokeEvent(message) {
  return normalizeIncomingMessageType(message?.type) === "revoke";
}

function getIncomingEditOriginalMessageId(message) {
  if (!isIncomingEditEvent(message)) return null;
  return String(message?.edit?.original_message_id || "").trim() || null;
}

function getIncomingRevokeOriginalMessageId(message) {
  if (!isIncomingRevokeEvent(message)) return null;
  return String(message?.revoke?.original_message_id || "").trim() || null;
}

function getIncomingMessagePayload(message) {
  if (!isIncomingEditEvent(message)) return message;
  const payload = message?.edit?.message;
  return payload && typeof payload === "object" ? payload : null;
}

function stringifyIncomingStructuredPayload(payload) {
  if (!payload) return null;

  try {
    return JSON.stringify(payload);
  } catch (error) {
    console.error("[meta/webhook] erro ao serializar payload estruturado", error);
    return null;
  }
}

function buildIncomingLocationPayload(location = {}) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  return {
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    name: location?.name ? String(location.name).trim() : null,
    address: location?.address ? String(location.address).trim() : null,
    url: location?.url ? String(location.url).trim() : null,
  };
}

function buildIncomingContactsPayload(contacts = []) {
  if (!Array.isArray(contacts)) return { contacts: [] };

  return {
    contacts: contacts.map((contact) => ({
      name:
        contact?.name?.formatted_name ||
        contact?.name?.first_name ||
        contact?.org?.company ||
        null,
      first_name: contact?.name?.first_name || null,
      formatted_name: contact?.name?.formatted_name || null,
      phones: Array.isArray(contact?.phones)
        ? contact.phones.map((phone) => ({
            phone: phone?.phone || null,
            wa_id: phone?.wa_id || null,
            type: phone?.type || null,
          }))
        : [],
      emails: Array.isArray(contact?.emails)
        ? contact.emails.map((email) => ({
            email: email?.email || null,
            type: email?.type || null,
          }))
        : [],
      addresses: Array.isArray(contact?.addresses)
        ? contact.addresses.map((address) => ({
            street: address?.street || null,
            city: address?.city || null,
            state: address?.state || null,
            zip: address?.zip || null,
            country: address?.country || null,
            country_code: address?.country_code || null,
            type: address?.type || null,
          }))
        : [],
      urls: Array.isArray(contact?.urls)
        ? contact.urls.map((url) => ({
            url: url?.url || null,
            type: url?.type || null,
          }))
        : [],
      org: contact?.org
        ? {
            company: contact.org.company || null,
            department: contact.org.department || null,
            title: contact.org.title || null,
          }
        : null,
    })),
  };
}

function buildIncomingLocationSummary(location = {}) {
  const payload = buildIncomingLocationPayload(location);
  const label =
    payload.name ||
    payload.address ||
    [payload.latitude, payload.longitude].filter((value) => value !== null).join(", ") ||
    "Localizacao compartilhada";

  return `[location] ${label}`.trim();
}

function buildIncomingContactsSummary(contacts = []) {
  const payload = buildIncomingContactsPayload(contacts);
  const [firstContact] = payload.contacts;

  if (!firstContact) {
    return "[contacts]";
  }

  const firstPhone = firstContact.phones.find((phone) => phone?.phone)?.phone || null;
  const label = [firstContact.name || "Contato compartilhado", firstPhone]
    .filter(Boolean)
    .join(" - ");

  if (payload.contacts.length === 1) {
    return `[contact] ${label}`.trim();
  }

  return `[contacts] ${payload.contacts.length} contatos - ${label}`.trim();
}

function buildReplyPreviewText(messageRow) {
  if (!messageRow) return "";

  const text = String(messageRow?.mensagem || "").trim();
  if (text) return text;

  const mediaType = String(messageRow?.media_tipe || "").trim();
  if (mediaType) return `[${mediaType}]`;

  return "Mensagem";
}

async function resolveIncomingReplyContext(conversaId, message) {
  const referencedWhatsappId =
    String(
      message?.reaction?.message_id ||
      message?.context?.id ||
      ""
    ).trim() || null;

  if (!conversaId || !referencedWhatsappId) {
    return {
      reply: false,
      mensagem_reply_id: null,
      referenced_whatsapp_id: referencedWhatsappId,
      preview_text: "",
    };
  }

  const rows = await execute.execute_get_mensagem_conversa_by_whats_id(
    conversaId,
    referencedWhatsappId
  );
  const originalMessage = rows?.[0] || null;

  return {
    reply: Boolean(originalMessage?.id),
    mensagem_reply_id: originalMessage?.id || null,
    referenced_whatsapp_id: referencedWhatsappId,
    preview_text: buildReplyPreviewText(originalMessage),
  };
}

function getIncomingMessageTypeId(message) {
  switch (normalizeIncomingMessageType(message?.type)) {
    case "text":
    case "button":
    case "interactive":
    case "reaction":
      return 0;
    default:
      return 1;
  }
}

function getIncomingMessageBody(message, replyContext = null) {
  if (!message) return "";

  switch (normalizeIncomingMessageType(message.type)) {
    case "text":
      return message.text?.body || "";
    case "button":
      return message.button?.text || "";
    case "interactive":
      return (
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        ""
      );
    case "image":
    case "video":
    case "document":
      return message[message.type]?.caption || `[${message.type}]`;
    case "audio":
    case "sticker":
      return `[${message.type}]`;
    case "location": {
      return buildIncomingLocationSummary(message.location);
    }
    case "contacts": {
      return buildIncomingContactsSummary(message.contacts);
    }
    case "reaction": {
      const emoji = String(message.reaction?.emoji || "").trim();
      const replyPreview = String(replyContext?.preview_text || "").trim();
      if (!emoji) return replyPreview ? `[reaction] em resposta a: ${replyPreview}` : "[reaction]";
      return replyPreview
        ? `[reaction] ${emoji} em resposta a: ${replyPreview}`
        : `[reaction] ${emoji}`;
    }
    default:
      return `[${message.type || "message"}]`;
  }
}

function getIncomingMediaId(message) {
  const normalizedType = normalizeIncomingMessageType(message?.type);
  if (!normalizedType) return null;

  if (normalizedType === "location") {
    return stringifyIncomingStructuredPayload(
      buildIncomingLocationPayload(message.location)
    );
  }

  if (normalizedType === "contacts") {
    return stringifyIncomingStructuredPayload(
      buildIncomingContactsPayload(message.contacts)
    );
  }

  return message[normalizedType]?.id || message[message.type]?.id || null;
}

const INCOMING_BINARY_MEDIA_TYPES = new Set([
  "image",
  "video",
  "audio",
  "document",
  "sticker",
]);

function getIncomingMediaFileName(message, media) {
  const type = normalizeIncomingMessageType(message?.type) || "file";
  const mimeType = String(media?.mime_type || message?.[type]?.mime_type || "").toLowerCase();
  const mimeExtensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "application/pdf": "pdf",
  };
  const providedName = String(message?.document?.filename || "").trim();
  if (providedName) return providedName;
  return `${type}-${message?.[type]?.id || Date.now()}.${mimeExtensions[mimeType] || "bin"}`;
}

function buildIncomingMediaBunnyPath(message, media, empresaId) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const mediaType = normalizeIncomingMessageType(message?.type) || "file";
  const generatedPath = bunny.generateFileName(
    `${message?.[mediaType]?.id || Date.now()}-${getIncomingMediaFileName(message, media)}`,
    `empresa_${empresaId}`
  );
  const generatedFileName = generatedPath.split("/").pop();

  return `media/whatsapp/empresa_${empresaId}/${year}/${month}/${mediaType}/${generatedFileName}`;
}

async function persistIncomingMediaToBunny(message, parametros, conversaId) {
  const mediaType = normalizeIncomingMessageType(message?.type);
  const metaMediaId = getIncomingMediaId(message);

  if (!INCOMING_BINARY_MEDIA_TYPES.has(mediaType) || !metaMediaId) {
    return metaMediaId;
  }

  try {
    const { file, midia } = await utils.downloadmidia(
      metaMediaId,
      parametros.empresa_id,
      conversaId
    );
    const filePath = buildIncomingMediaBunnyPath(
      message,
      midia,
      parametros.empresa_id
    );
    const uploaded = await bunny.uploadFile(filePath, file);

    if (!uploaded?.file) {
      throw new Error("Bunny nao retornou a URL do arquivo.");
    }

    console.log(
      "[meta/webhook] midia recebida persistida na Bunny",
      JSON.stringify({
        empresa_id: parametros.empresa_id,
        conversa_id: conversaId,
        message_id: message?.id || null,
        meta_media_id: metaMediaId,
        media_type: mediaType,
        mime_type: midia?.mime_type || null,
        bytes: file.length,
        path_bunny: filePath,
      })
    );

    return uploaded.file;
  } catch (error) {
    console.error(
      "[meta/webhook] falha ao persistir midia recebida na Bunny; usando ID Meta",
      {
        empresa_id: parametros?.empresa_id || null,
        conversa_id: conversaId,
        message_id: message?.id || null,
        meta_media_id: metaMediaId,
        media_type: mediaType,
        message: error?.message || String(error),
      }
    );
    return metaMediaId;
  }
}

async function archiveIncomingMedia(message, parametros, conversaId) {
  const originalMediaId = getIncomingMediaId(message);
  if (!originalMediaId || !message?.id) return;

  const persistedMediaUrl = await persistIncomingMediaToBunny(
    message,
    parametros,
    conversaId
  );
  if (!/^https?:\/\//i.test(String(persistedMediaUrl || ""))) return;

  const updated = await execute.execute_update_incoming_message_media_url(
    conversaId,
    message.id,
    persistedMediaUrl
  );
  if (updated.length) {
    notifyChatUpdate({
      empresa_id: parametros.empresa_id,
      conversa_id: conversaId,
      tipo: "message",
      origem: "meta:webhook_media_archived",
    });
  }
}

function mapWebhookStatus(status) {
  switch (status) {
    case "sent":
      return 1;
    case "delivered":
      return 2;
    case "read":
      return 3;
    case "failed":
      return 4;
    default:
      return 0;
  }
}

function isWebhookChangeForMetaMessages(change) {
  const field = String(change?.field || "").trim().toLowerCase();
  return field === "messages" || field === "message_echoes" || field === "smb_message_echoes";
}

function hasPhoneIdMismatch(value, parametros) {
  const metadataPhoneId = String(value?.metadata?.phone_number_id || "");
  const expectedPhoneId = String(parametros?.phone_number_id || parametros?.numero || "");

  if (!expectedPhoneId || !metadataPhoneId || metadataPhoneId === expectedPhoneId) {
    return false;
  }

  console.log(
    "[meta/webhook] phone_id_mismatch_skip",
    JSON.stringify({
      empresa_id: parametros?.empresa_id || null,
      meta_param_id: parametros?.id || null,
      metadata_phone_id: metadataPhoneId || null,
      expected_phone_id: expectedPhoneId || null,
    })
  );
  return true;
}

function normalizeComparableClienteNome(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isFallbackClienteNome(nomeAtual, telefone) {
  const normalizedNome = normalizeComparableClienteNome(nomeAtual);
  if (!normalizedNome) return true;
  if (normalizedNome === "cliente") return true;

  const nomeDigits = onlyDigits(nomeAtual);
  const telefoneDigits = onlyDigits(telefone);

  return Boolean(
    nomeDigits &&
    telefoneDigits &&
    nomeDigits === telefoneDigits
  );
}

function shouldReplaceClienteNomeWithMeta(nomeAtual, nomeMeta, telefone) {
  const normalizedNomeMeta = normalizeComparableClienteNome(nomeMeta);
  if (!normalizedNomeMeta) return false;

  return isFallbackClienteNome(nomeAtual, telefone);
}

function normalizeMetaReferralValue(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function extractMetaReferralUtm(sourceUrl) {
  const normalizedUrl = normalizeMetaReferralValue(sourceUrl);
  if (!normalizedUrl) return {};

  try {
    const url = new URL(normalizedUrl);
    const fields = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "gclid",
    ];
    return Object.fromEntries(
      fields
        .map((field) => [field, normalizeMetaReferralValue(url.searchParams.get(field))])
        .filter(([, value]) => Boolean(value))
    );
  } catch (_error) {
    return {};
  }
}

function extractIncomingReferral(message) {
  const referral =
    message?.referral && typeof message.referral === "object"
      ? message.referral
      : null;

  if (!referral) return null;

  const normalized = {
    source_url: normalizeMetaReferralValue(referral.source_url),
    source_type: normalizeMetaReferralValue(referral.source_type),
    source_id: normalizeMetaReferralValue(referral.source_id),
    headline: normalizeMetaReferralValue(referral.headline),
    body: normalizeMetaReferralValue(referral.body),
    media_type: normalizeMetaReferralValue(referral.media_type),
    image_url: normalizeMetaReferralValue(referral.image_url),
    video_url: normalizeMetaReferralValue(referral.video_url),
    thumbnail_url: normalizeMetaReferralValue(referral.thumbnail_url),
    ctwa_clid: normalizeMetaReferralValue(referral.ctwa_clid),
  };

  const hasContent = Object.values(normalized).some(Boolean);
  if (!hasContent) return null;

  return { ...normalized, raw: referral };
}

async function persistClienteMetaAdsReferral({
  clienteId,
  empresaId,
  parametros,
  message,
  referral,
}) {
  if (!clienteId || !empresaId || !isMetaAdsReferral(referral)) return;

  try {
    await execute.execute_update_cliente_meta_ads_referral({
      cliente_id: clienteId,
      empresa_id: empresaId,
      referral,
      utm: extractMetaReferralUtm(referral.source_url),
      message_id: message?.id || null,
      phone_number_id:
        parametros?.meta_phone_number_id || parametros?.phone_number_id || parametros?.numero || null,
      attributed_at: message?.timestamp
        ? new Date(Number(message.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
    });
  } catch (error) {
    console.error("[meta/webhook] falha ao salvar referral no cliente", {
      empresa_id: empresaId,
      cliente_id: clienteId,
      source_id: referral?.source_id || null,
      message: error?.message || String(error),
      migration_required: error?.code === "42703",
    });
  }
}

function isMetaAdsReferral(referral) {
  if (!referral) return false;

  return Boolean(
    String(referral.source_type || "").trim().toLowerCase() === "ad" ||
    referral.source_id ||
    referral.source_url ||
    referral.image_url ||
    referral.video_url
  );
}

function buildMetaReferralCaption(referral) {
  if (!referral) return "";

  const lines = ["Lead originado por anuncio do Meta Ads"];

  if (referral.headline) {
    lines.push(referral.headline);
  }

  if (referral.body) {
    lines.push(referral.body);
  }

  if (referral.video_url) {
    lines.push(`Video: ${referral.video_url}`);
  }

  return lines.join("\n");
}

function buildMetaReferralStructuredPayload(referral) {
  if (!referral) return null;

  return {
    kind: "meta_referral",
    source_url: referral.source_url || null,
    source_type: referral.source_type || null,
    source_id: referral.source_id || null,
    headline: referral.headline || null,
    body: referral.body || null,
    media_type: referral.media_type || null,
    image_url: referral.image_url || null,
    video_url: referral.video_url || null,
    thumbnail_url: referral.thumbnail_url || null,
    ctwa_clid: referral.ctwa_clid || null,
  };
}

async function insertMetaReferralContextMessage(conversaId, messageId, referral) {
  const referralMessage = buildMetaReferralCaption(referral);
  const referralPayload = buildMetaReferralStructuredPayload(referral);
  const referralMessageId = String(messageId || "").trim()
    ? `${String(messageId).trim()}::referral`
    : null;

  if (!conversaId || !referralPayload || !referralMessageId) {
    return [];
  }

  return execute.execute_insert_meta_referral_message(
    conversaId,
    referralMessage,
    referralMessageId,
    JSON.stringify(referralPayload),
    "meta_referral"
  );
}

async function ensureMetaCliente(parametros, contatoNome, telefone, options = {}) {
  const nome = String(contatoNome || telefone || "Cliente").trim();
  const origemNovoCliente = normalizeMetaReferralValue(options?.origemNovoCliente) || "whatsapp";
  console.log(
    "[meta/webhook][ensureMetaCliente] start",
    JSON.stringify({
      empresa_id: parametros?.empresa_id || null,
      meta_param_id: parametros?.id || null,
      contato_nome: nome || null,
      telefone_recebido: telefone || null,
    })
  );
  const clienteAtual = await execute.execute_find_cliente_by_phone(
    parametros.empresa_id,
    telefone
  );

  if (clienteAtual.length) {
    const cliente = clienteAtual[0];
    console.log(
      "[meta/webhook][ensureMetaCliente] existing_cliente_found",
      JSON.stringify({
        empresa_id: parametros?.empresa_id || null,
        cliente_id: cliente.id || null,
        cliente_nome: cliente.nome || null,
        cliente_telefone: cliente.telefone || null,
        cliente_origem: cliente.origem || null,
      })
    );
    const nomeAtual = String(cliente.nome || "").trim();
    const substituirNomePelaMeta = shouldReplaceClienteNomeWithMeta(
      nomeAtual,
      nome,
      telefone
    );
    const nomeAtualizado = substituirNomePelaMeta
      ? nome || nomeAtual || telefone
      : nomeAtual || nome || telefone;
    const precisaAtualizar =
      nomeAtualizado !== nomeAtual || cliente.ativo !== true;

    if (precisaAtualizar) {
      const atualizado = await execute.execute_update_cliente_nome(
        cliente.id,
        nomeAtualizado
      );
      console.log(
        "[meta/webhook][ensureMetaCliente] cliente_updated",
        JSON.stringify({
          empresa_id: parametros?.empresa_id || null,
          cliente_id: atualizado?.[0]?.id || cliente.id || null,
          cliente_nome: atualizado?.[0]?.nome || nomeAtualizado || null,
          cliente_telefone: atualizado?.[0]?.telefone || cliente.telefone || null,
        })
      );
      return atualizado[0] || cliente;
    }
    return cliente;
  }

  const criado = await execute.execute_insert_cliente(
    nome,
    telefone,
    parametros.empresa_id,
    origemNovoCliente
  );
  console.log(
    "[meta/webhook][ensureMetaCliente] cliente_created",
    JSON.stringify({
      empresa_id: parametros?.empresa_id || null,
      cliente_id: criado?.[0]?.id || null,
      cliente_nome: criado?.[0]?.nome || nome || null,
      cliente_telefone: criado?.[0]?.telefone || telefone || null,
      cliente_origem: criado?.[0]?.origem || "whatsapp",
    })
  );
  return criado[0] || null;
}

async function ensureMetaConversa(clienteId, empresaId, numberPhoneId, empresaMetaParamId) {
  const conversaAtual = await execute.execute_find_conversa_aberta_by_cliente(
    clienteId,
    empresaId,
    empresaMetaParamId
  );

  if (conversaAtual.length) {
    const conversa = conversaAtual[0];
    if (
      numberPhoneId &&
      (
        String(conversa.number_phone_id || "") !== String(numberPhoneId) ||
        Number(conversa.empresa_meta_param_id || 0) !== Number(empresaMetaParamId || 0)
      )
    ) {
      const atualizada = await execute.execute_update_conversa_number_phone(
        conversa.id,
        numberPhoneId,
        empresaMetaParamId
      );
      return { conversa: atualizada[0] || conversa, created: false };
    }
    return { conversa, created: false };
  }

  const criada = await execute.execute_insert_conversa(
    numberPhoneId,
    clienteId,
    empresaId,
    empresaMetaParamId
  );

  return { conversa: criada[0] || null, created: true };
}

async function persistIncomingMetaMessage(change, parametros) {
  const value = change?.value || {};
  const contact = Array.isArray(value.contacts) ? value.contacts[0] : null;
  const messages = Array.isArray(value.messages) ? value.messages : [];
  const metadataPhoneId = String(value?.metadata?.phone_number_id || "");
  const expectedPhoneId = String(parametros.phone_number_id || parametros.numero || "");

  console.log(
    "[meta/webhook][persistIncomingMetaMessage] start",
    JSON.stringify({
      empresa_id: parametros?.empresa_id || null,
      meta_param_id: parametros?.id || null,
      metadata_phone_id: metadataPhoneId || null,
      expected_phone_id: expectedPhoneId || null,
      messages_count: messages.length,
      contact_wa_id: contact?.wa_id || null,
      contact_name: contact?.profile?.name || null,
    })
  );

  if (expectedPhoneId && metadataPhoneId && metadataPhoneId !== expectedPhoneId) {
    console.log(
      "[meta/webhook][persistIncomingMetaMessage] phone_id_mismatch_skip",
      JSON.stringify({
        empresa_id: parametros?.empresa_id || null,
        meta_param_id: parametros?.id || null,
        metadata_phone_id: metadataPhoneId || null,
        expected_phone_id: expectedPhoneId || null,
      })
    );
    return;
  }

  for (const message of messages) {
    const isEditEvent = isIncomingEditEvent(message);
    const isRevokeEvent = isIncomingRevokeEvent(message);
    const messagePayload = getIncomingMessagePayload(message);
    const referral = extractIncomingReferral(messagePayload);
    const originalEditedMessageId = getIncomingEditOriginalMessageId(message);
    const originalRevokedMessageId = getIncomingRevokeOriginalMessageId(message);
    const telefone = normalizeContactPhone(
      message?.from || contact?.wa_id || contact?.profile?.phone
    );

    console.log(
      "[meta/webhook][persistIncomingMetaMessage] incoming_message",
      JSON.stringify({
        empresa_id: parametros?.empresa_id || null,
        meta_param_id: parametros?.id || null,
        message_id: message?.id || null,
        message_type: message?.type || null,
        message_payload_type: messagePayload?.type || null,
        referral_detected: Boolean(referral),
        is_edit_event: isEditEvent,
        is_revoke_event: isRevokeEvent,
        original_edited_message_id: originalEditedMessageId,
        original_revoked_message_id: originalRevokedMessageId,
        from_raw: message?.from || null,
        contact_wa_id: contact?.wa_id || null,
        telefone_normalizado: telefone || null,
      })
    );

    if (!telefone) {
      continue;
    }

    const cliente = await ensureMetaCliente(
      parametros,
      contact?.profile?.name,
      telefone,
      {
        origemNovoCliente: isMetaAdsReferral(referral) ? "meta_ads" : "whatsapp",
      }
    );

    if (!cliente?.id) {
      continue;
    }

    if (
      await executeAppSafety.execute_cliente_bloqueado(
        parametros.empresa_id,
        cliente.id
      )
    ) {
      console.log("[meta/webhook] mensagem ignorada: cliente bloqueado", {
        empresa_id: parametros.empresa_id,
        cliente_id: cliente.id,
        message_id: message?.id || null,
      });
      continue;
    }

    await persistClienteMetaAdsReferral({
      clienteId: cliente.id,
      empresaId: parametros.empresa_id,
      parametros,
      message,
      referral,
    });

    const { conversa, created } = await ensureMetaConversa(
      cliente.id,
      parametros.empresa_id,
      telefone,
      parametros.id
    );

    console.log(
      "[meta/webhook][persistIncomingMetaMessage] conversa_resolution",
      JSON.stringify({
        empresa_id: parametros?.empresa_id || null,
        cliente_id: cliente?.id || null,
        conversa_id: conversa?.id || null,
        conversa_created: created,
        conversa_number_phone_id: conversa?.number_phone_id || null,
        conversa_meta_param_id: conversa?.empresa_meta_param_id || null,
      })
    );

    if (!conversa?.id) {
      continue;
    }

    if (isEditEvent) {
      if (!originalEditedMessageId || !messagePayload) {
        console.log(
          "[meta/webhook][persistIncomingMetaMessage] edit_event_skip_invalid_payload",
          JSON.stringify({
            empresa_id: parametros?.empresa_id || null,
            meta_param_id: parametros?.id || null,
            conversa_id: conversa.id,
            message_id: message?.id || null,
            original_edited_message_id: originalEditedMessageId,
          })
        );
        continue;
      }

      const editedMessageBody = getIncomingMessageBody(messagePayload);
      const updated = await execute.execute_update_incoming_message_content(
        conversa.id,
        originalEditedMessageId,
        editedMessageBody,
        getIncomingMessageTypeId(messagePayload),
        getIncomingMediaId(messagePayload),
        normalizeIncomingMessageType(messagePayload.type)
      );

      if (updated.length) {
        const emitted = notifyChatUpdate({
          empresa_id: parametros.empresa_id,
          conversa_id: conversa.id,
          tipo: "message",
          origem: "meta:webhook_edit",
        });
        console.log(
          "[meta/webhook][persistIncomingMetaMessage] edit_event_updated",
          JSON.stringify({
            empresa_id: parametros?.empresa_id || null,
            conversa_id: conversa.id,
            message_id: message?.id || null,
            original_edited_message_id: originalEditedMessageId,
            updated_count: updated.length,
            event_id: emitted?.event_id || null,
          })
        );
      } else {
        console.log(
          "[meta/webhook][persistIncomingMetaMessage] edit_event_original_message_not_found",
          JSON.stringify({
            empresa_id: parametros?.empresa_id || null,
            conversa_id: conversa.id,
            message_id: message?.id || null,
            original_edited_message_id: originalEditedMessageId,
          })
        );
      }
      continue;
    }

    if (isRevokeEvent) {
      if (!originalRevokedMessageId) {
        console.log(
          "[meta/webhook][persistIncomingMetaMessage] revoke_event_skip_invalid_payload",
          JSON.stringify({
            empresa_id: parametros?.empresa_id || null,
            meta_param_id: parametros?.id || null,
            conversa_id: conversa.id,
            message_id: message?.id || null,
            original_revoked_message_id: originalRevokedMessageId,
          })
        );
        continue;
      }

      const updated = await execute.execute_update_message_revoked(
        conversa.id,
        originalRevokedMessageId
      );

      if (updated.length) {
        const emitted = notifyChatUpdate({
          empresa_id: parametros.empresa_id,
          conversa_id: conversa.id,
          tipo: "message",
          origem: "meta:webhook_revoke",
        });
        console.log(
          "[meta/webhook][persistIncomingMetaMessage] revoke_event_updated",
          JSON.stringify({
            empresa_id: parametros?.empresa_id || null,
            conversa_id: conversa.id,
            message_id: message?.id || null,
            original_revoked_message_id: originalRevokedMessageId,
            updated_count: updated.length,
            event_id: emitted?.event_id || null,
          })
        );
      } else {
        console.log(
          "[meta/webhook][persistIncomingMetaMessage] revoke_event_original_message_not_found",
          JSON.stringify({
            empresa_id: parametros?.empresa_id || null,
            conversa_id: conversa.id,
            message_id: message?.id || null,
            original_revoked_message_id: originalRevokedMessageId,
          })
        );
      }
      continue;
    }

    if (isMetaAdsReferral(referral)) {
      await insertMetaReferralContextMessage(conversa.id, message.id || null, referral);
    }

    const replyContext = await resolveIncomingReplyContext(conversa.id, messagePayload);
    const incomingMessageBody = getIncomingMessageBody(messagePayload, replyContext);
    const incomingMediaId = getIncomingMediaId(messagePayload);
    const inserted = await execute.execute_insert_mensagem_recebida(
      conversa.id,
      incomingMessageBody,
      getIncomingMessageTypeId(messagePayload),
      replyContext.reply,
      replyContext.mensagem_reply_id,
      message.id || null,
      incomingMediaId,
      normalizeIncomingMessageType(messagePayload?.type)
    );

    if (inserted.length) {
      if (INCOMING_BINARY_MEDIA_TYPES.has(normalizeIncomingMessageType(messagePayload?.type))) {
        void archiveIncomingMedia(messagePayload, parametros, conversa.id).catch((error) => {
          console.error("[meta/webhook] erro inesperado ao arquivar midia", {
            empresa_id: parametros?.empresa_id || null,
            conversa_id: conversa.id,
            message_id: messagePayload?.id || null,
            message: error?.message || String(error),
          });
        });
      }
      const emitted = notifyChatUpdate({
        empresa_id: parametros.empresa_id,
        conversa_id: conversa.id,
        tipo: created ? "conversation_created" : "message",
        origem: "meta:webhook_incoming",
      });
      void notifyPushMessage({
        empresa_id: parametros.empresa_id,
        conversa_id: conversa.id,
        title: created ? "Novo atendimento aguardando" : undefined,
        body:
          incomingMessageBody ||
          (created
            ? "Um cliente entrou na fila de atendimento."
            : undefined),
      });
      console.log(
        "[meta/webhook] chat:update emit",
        JSON.stringify({
          empresa_id: parametros.empresa_id,
          conversa_id: conversa.id,
          inserted_count: inserted.length,
          event_id: emitted?.event_id || null,
          tipo: emitted?.tipo || null,
          origem: emitted?.origem || null,
          emitted_at: emitted?.emitted_at || null,
        })
      );
    }

    if (created && inserted.length) {
      try {
        await executeVendas.execute_criar_negocio_entrada_whatsapp({
          empresa_id: parametros.empresa_id,
          cliente_id: cliente.id,
          conversa_id: conversa.id,
          empresa_meta_param_id: parametros.id || null,
          status_id: conversa.status_id,
          telefone,
          nome_contato: contact?.profile?.name || cliente?.nome || null,
        });
      } catch (crmError) {
        console.error(
          "[meta/webhook] erro ao criar entrada automatica no funil via WhatsApp:",
          crmError
        );
      }

      const shouldSendAutoMessage = await shouldSendLeadStartedAutoMessage({
        empresaId: parametros.empresa_id,
        clienteId: cliente.id,
        numero: telefone,
        empresaMetaParamId: parametros.id || null,
        conversaId: conversa.id,
      });

      if (!shouldSendAutoMessage) {
        console.log(
          "[meta/webhook] mensagem automatica ignorada por configuracao do disparo",
          JSON.stringify({
            empresa_id: parametros.empresa_id,
            cliente_id: cliente.id,
            conversa_id: conversa.id,
            telefone,
          })
        );
        continue;
      }

      const welcomeMessage = await getWelcomeMessageForCompany(parametros);
      if (!welcomeMessage.habilitada) {
        console.log(
          "[meta/webhook] mensagem de boas-vindas desativada",
          JSON.stringify({
            empresa_id: parametros.empresa_id,
            cliente_id: cliente.id,
            conversa_id: conversa.id,
            telefone,
            empresa_meta_param_id: parametros.id || null,
          })
        );
      } else {
        await utils.sendWhatsappMessage(
          telefone,
          welcomeMessage.texto,
          conversa.id,
          welcomeMessage.texto,
          parametros.empresa_id
        );

        if (welcomeMessage.galeria_imagem_url) {
          await utils.sendWhatsappImageByUrl(
            telefone,
            welcomeMessage.galeria_imagem_url,
            welcomeMessage.mensagem_complementar_texto || "",
            conversa.id,
            parametros.empresa_id
          );
        } else if (welcomeMessage.mensagem_complementar_texto) {
          await utils.sendWhatsappMessage(
            telefone,
            welcomeMessage.mensagem_complementar_texto,
            conversa.id,
            welcomeMessage.mensagem_complementar_texto,
            parametros.empresa_id
          );
        }
      }
    }
  }
}

async function persistMetaMessageEcho(change, parametros) {
  const value = change?.value || {};
  const echoes = Array.isArray(value.message_echoes) ? value.message_echoes : [];

  console.log(
    "[meta/webhook][persistMetaMessageEcho] start",
    JSON.stringify({
      empresa_id: parametros?.empresa_id || null,
      meta_param_id: parametros?.id || null,
      metadata_phone_id: value?.metadata?.phone_number_id || null,
      field: change?.field || null,
      echoes_count: echoes.length,
    })
  );

  if (hasPhoneIdMismatch(value, parametros)) {
    return;
  }

  for (const message of echoes) {
    const isRevokeEvent = isIncomingRevokeEvent(message);
    const originalRevokedMessageId = getIncomingRevokeOriginalMessageId(message);
    const telefone = normalizeContactPhone(
      message?.to || message?.recipient_id || null
    );

    console.log(
      "[meta/webhook][persistMetaMessageEcho] echo_message",
      JSON.stringify({
        empresa_id: parametros?.empresa_id || null,
        meta_param_id: parametros?.id || null,
        message_id: message?.id || null,
        message_type: message?.type || null,
        is_revoke_event: isRevokeEvent,
        original_revoked_message_id: originalRevokedMessageId,
        from_raw: message?.from || null,
        to_raw: message?.to || null,
        telefone_normalizado: telefone || null,
      })
    );

    if (!telefone || !String(message?.id || "").trim()) {
      continue;
    }

    const cliente = await ensureMetaCliente(parametros, null, telefone);
    if (!cliente?.id) {
      continue;
    }

    if (
      await executeAppSafety.execute_cliente_bloqueado(
        parametros.empresa_id,
        cliente.id
      )
    ) {
      console.log("[meta/webhook][persistMetaMessageEcho] ignorado: cliente bloqueado", {
        empresa_id: parametros.empresa_id,
        cliente_id: cliente.id,
        message_id: message?.id || null,
      });
      continue;
    }

    const { conversa, created } = await ensureMetaConversa(
      cliente.id,
      parametros.empresa_id,
      telefone,
      parametros.id
    );

    if (!conversa?.id) {
      continue;
    }

    if (isRevokeEvent) {
      if (!originalRevokedMessageId) {
        console.log(
          "[meta/webhook][persistMetaMessageEcho] revoke_event_skip_invalid_payload",
          JSON.stringify({
            empresa_id: parametros?.empresa_id || null,
            meta_param_id: parametros?.id || null,
            conversa_id: conversa.id,
            message_id: message?.id || null,
            original_revoked_message_id: originalRevokedMessageId,
          })
        );
        continue;
      }

      const updated = await execute.execute_update_message_revoked(
        conversa.id,
        originalRevokedMessageId
      );

      if (!updated.length) {
        console.log(
          "[meta/webhook][persistMetaMessageEcho] revoke_event_original_message_not_found",
          JSON.stringify({
            empresa_id: parametros?.empresa_id || null,
            conversa_id: conversa.id,
            message_id: message?.id || null,
            original_revoked_message_id: originalRevokedMessageId,
          })
        );
        continue;
      }

      const emitted = notifyChatUpdate({
        empresa_id: parametros.empresa_id,
        conversa_id: conversa.id,
        tipo: "message",
        origem: "meta:webhook_echo_revoke",
      });

      console.log(
        "[meta/webhook][persistMetaMessageEcho] revoke_event_updated",
        JSON.stringify({
          empresa_id: parametros?.empresa_id || null,
          cliente_id: cliente?.id || null,
          conversa_id: conversa.id,
          message_id: message?.id || null,
          original_revoked_message_id: originalRevokedMessageId,
          updated_count: updated.length,
          event_id: emitted?.event_id || null,
        })
      );
      continue;
    }

    const replyContext = await resolveIncomingReplyContext(conversa.id, message);
    const echoMessageBody = getIncomingMessageBody(message, replyContext);
    const inserted = await execute.execute_insert_mensagem_echo(
      conversa.id,
      echoMessageBody,
      getIncomingMessageTypeId(message),
      replyContext.reply,
      replyContext.mensagem_reply_id,
      message.id || null,
      getIncomingMediaId(message),
      normalizeIncomingMessageType(message?.type)
    );

    if (!inserted.length) {
      console.log(
        "[meta/webhook][persistMetaMessageEcho] duplicate_skip",
        JSON.stringify({
          empresa_id: parametros?.empresa_id || null,
          conversa_id: conversa.id,
          message_id: message?.id || null,
        })
      );
      continue;
    }

    if (INCOMING_BINARY_MEDIA_TYPES.has(normalizeIncomingMessageType(message?.type))) {
      void archiveIncomingMedia(message, parametros, conversa.id).catch((error) => {
        console.error("[meta/webhook] erro ao arquivar midia de echo", {
          empresa_id: parametros?.empresa_id || null,
          conversa_id: conversa.id,
          message_id: message?.id || null,
          message: error?.message || String(error),
        });
      });
    }

    const emitted = notifyChatUpdate({
      empresa_id: parametros.empresa_id,
      conversa_id: conversa.id,
      tipo: created ? "conversation_created" : "message",
      origem: "meta:webhook_echo",
    });

    console.log(
      "[meta/webhook][persistMetaMessageEcho] inserted",
      JSON.stringify({
        empresa_id: parametros?.empresa_id || null,
        cliente_id: cliente?.id || null,
        conversa_id: conversa.id,
        message_id: message?.id || null,
        inserted_count: inserted.length,
        event_id: emitted?.event_id || null,
      })
    );
  }
}

function getRequestedPhoneNumberId(data) {
  return (
    data.phoneNumberId ||
    data.phone_number_id ||
    data.numero ||
    data.number_phone_id ||
    null
  );
}

function getRequestedPhoneNumber(data) {
  return (
    data.display_phone_number ||
    data.phone_number ||
    data.numero_front ||
    data.phoneNumber ||
    null
  );
}

function findPhoneNumberInfo(phoneNumbers, requestedNumber, options = {}) {
  const requireExactPhoneNumberId = options.requireExactPhoneNumberId === true;
  const requestedPhoneNumberId = getRequestedPhoneNumberId(requestedNumber);
  const normalizedRequestedNumber = normalizePhoneMatchValue(requestedNumber);

  if (requestedPhoneNumberId) {
    const matchedById = (phoneNumbers || []).find((item) => {
      return String(item?.id || "") === String(requestedPhoneNumberId);
    });

    if (matchedById) {
      return matchedById;
    }

    if (requireExactPhoneNumberId) {
      return null;
    }
  }

  if (requireExactPhoneNumberId) {
    return null;
  }

  if (!normalizedRequestedNumber) {
    return (phoneNumbers || [])[0] || null;
  }

  return (phoneNumbers || []).find((item) => {
    const itemNumber = normalizePhoneMatchValue(item?.display_phone_number);
    return itemNumber === normalizedRequestedNumber;
  }) || null;
}

function createResolvedMetaSignupAccount({
  whatsapp_account_id = null,
  whatsapp_account_name = null,
  business_id = null,
  business_name = null,
  phone_numbers = []
} = {}) {
  return {
    whatsapp_account_id: whatsapp_account_id || null,
    whatsapp_account_name: whatsapp_account_name || null,
    business_id: business_id || null,
    business_name: business_name || null,
    phone_numbers: Array.isArray(phone_numbers) ? phone_numbers : []
  };
}

function extractWabaIdsFromDebugToken(debugData = null) {
  const granularScopes = Array.isArray(debugData?.granular_scopes)
    ? debugData.granular_scopes
    : [];
  const acceptedScopes = new Set([
    "whatsapp_business_management",
    "whatsapp_business_messaging"
  ]);
  const ids = new Set();

  granularScopes.forEach((scope) => {
    if (!acceptedScopes.has(String(scope?.scope || ""))) {
      return;
    }

    const targetIds = Array.isArray(scope?.target_ids) ? scope.target_ids : [];
    targetIds.forEach((targetId) => {
      const normalized = String(targetId || "").trim();
      if (normalized) {
        ids.add(normalized);
      }
    });
  });

  return [...ids];
}

function selectMetaSignupAccount(
  accounts,
  preferredWhatsappAccountId = null,
  preferredPhoneNumberId = null,
  preferredBusinessId = null
) {
  const preferredWabaId = String(preferredWhatsappAccountId || "").trim();
  const preferredPhoneId = String(preferredPhoneNumberId || "").trim();
  const preferredBizId = String(preferredBusinessId || "").trim();
  const normalizedAccounts = Array.isArray(accounts) ? accounts : [];

  if (preferredPhoneId) {
    const matchedByPhone = normalizedAccounts.find((account) =>
      (Array.isArray(account?.phone_numbers) ? account.phone_numbers : []).some(
        (phone) => String(phone?.id || "").trim() === preferredPhoneId
      )
    );
    if (matchedByPhone) {
      return matchedByPhone;
    }
  }

  if (preferredWabaId) {
    const matchedByWaba = normalizedAccounts.find(
      (account) => String(account?.whatsapp_account_id || "").trim() === preferredWabaId
    );
    if (matchedByWaba) {
      return matchedByWaba;
    }
  }

  if (preferredBizId) {
    const matchedByBusiness = normalizedAccounts.find(
      (account) => String(account?.business_id || "").trim() === preferredBizId
    );
    if (matchedByBusiness) {
      return matchedByBusiness;
    }
  }

  return (
    normalizedAccounts.find(
      (account) => account?.whatsapp_account_id && account.phone_numbers?.length
    ) ||
    normalizedAccounts.find((account) => account?.whatsapp_account_id) ||
    null
  );
}

async function resolveMetaSignupContext(
  accessToken,
  preferredWhatsappAccountId = null,
  preferredPhoneNumberId = null,
  preferredBusinessId = null
) {
  const preferredId = String(preferredWhatsappAccountId || "").trim() || null;

  if (preferredId) {
    try {
      const displayInfo = await getMetaDisplayInfo(preferredId, accessToken);
      return createResolvedMetaSignupAccount({
        whatsapp_account_id: preferredId,
        phone_numbers: displayInfo?.data || []
      });
    } catch (error) {
      const isInvalidOrInaccessibleObject =
        Number(error?.response?.data?.error?.code) === 100 &&
        Number(error?.response?.data?.error?.error_subcode) === 33;

      if (!isInvalidOrInaccessibleObject) {
        throw error;
      }
      // Fallback: when preferred ID is not a valid WABA (or inaccessible), try resolving via /me context.
    }
  }

  const debugData = await debugMetaAccessToken(accessToken).catch(() => null);
  const debugTargetWabaIds = extractWabaIdsFromDebugToken(debugData);
  const resolvedFromDebugToken = [];

  for (const wabaId of debugTargetWabaIds) {
    try {
      const displayInfo = await getMetaDisplayInfo(wabaId, accessToken);
      resolvedFromDebugToken.push(
        createResolvedMetaSignupAccount({
          whatsapp_account_id: wabaId,
          phone_numbers: displayInfo?.data || []
        })
      );
    } catch (error) {
      // noop
    }
  }

  const selectedFromDebugToken = selectMetaSignupAccount(
    resolvedFromDebugToken,
    preferredWhatsappAccountId,
    preferredPhoneNumberId,
    preferredBusinessId
  );

  if (selectedFromDebugToken) {
    return selectedFromDebugToken;
  }

  const response = await axios.get(
    `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/me`,
    {
      params: {
        fields:
          "id,name,businesses{id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,cc,country_dial_code,display_phone_number,verified_name,status,quality_rating,search_visibility,platform_type,code_verification_status}},client_whatsapp_business_accounts{id,name,phone_numbers{id,cc,country_dial_code,display_phone_number,verified_name,status,quality_rating,search_visibility,platform_type,code_verification_status}}}",
        access_token: accessToken,
      },
    }
  );

  const businesses = Array.isArray(response?.data?.businesses?.data)
    ? response.data.businesses.data
    : [];

  const accounts = [];

  businesses.forEach((business) => {
    const ownedAccounts = Array.isArray(business?.owned_whatsapp_business_accounts?.data)
      ? business.owned_whatsapp_business_accounts.data
      : [];
    const clientAccounts = Array.isArray(business?.client_whatsapp_business_accounts?.data)
      ? business.client_whatsapp_business_accounts.data
      : [];

    [...ownedAccounts, ...clientAccounts].forEach((account) => {
      accounts.push({
        business_id: business?.id || null,
        business_name: business?.name || null,
        whatsapp_account_id: account?.id || null,
        whatsapp_account_name: account?.name || null,
        phone_numbers: Array.isArray(account?.phone_numbers?.data)
          ? account.phone_numbers.data
          : [],
      });
    });
  });

  const selectedAccount = selectMetaSignupAccount(
    accounts,
    preferredWhatsappAccountId,
    preferredPhoneNumberId,
    preferredBusinessId
  );

  return (
    selectedAccount ||
    createResolvedMetaSignupAccount()
  );
}

function normalizeMetaPayload(data) {
  const graphApiVersion = data.graph_api_version || DEFAULT_GRAPH_VERSION;
  const phoneNumberId =
    data.phone_number_id ||
    data.phoneNumberId ||
    data.numero ||
    data.number_phone_id ||
    null;

  const accessToken = data.access_token || data.accessToken || data.api_key || null;
  const tokenExpiresIn = Number(data.token_expires_in || data.expires_in || 0) || null;

  return {
    empresa_id: data.empresa_id,
    numero: phoneNumberId,
    api_key: accessToken,
    whatsapp_account_id:
      data.whatsapp_account_id ||
      data.wabaId ||
      data.whatsappBusinessAccountId ||
      null,
    meta_phone_number_id: phoneNumberId,
    meta_business_id: data.businessId || data.meta_business_id || null,
    meta_business_name: data.business_name || data.meta_business_name || null,
    meta_business_manager_id:
      data.business_manager_id || data.bm_id || data.meta_business_manager_id || null,
    meta_business_manager_name:
      data.business_manager_name || data.bm_name || data.meta_business_manager_name || null,
    meta_waba_name:
      data.whatsapp_account_name || data.waba_name || data.meta_waba_name || null,
    meta_display_phone_number:
      data.display_phone_number || data.phone_number || data.meta_display_phone_number || null,
    meta_verified_name: data.verified_name || data.meta_verified_name || null,
    meta_webhook_verify_token:
      data.webhook_verify_token || buildWebhookVerifyToken(data.empresa_id),
    meta_webhook_url: data.webhook_url || null,
    meta_graph_api_version: graphApiVersion,
    meta_app_scoped_user_id:
      data.app_scoped_user_id || data.appScopedUserId || data.meta_app_scoped_user_id || null,
    meta_wa_id: data.wa_id || data.waId || null,
    meta_access_token_type: data.token_type || null,
    meta_token_expires_in: tokenExpiresIn,
    meta_access_token_expires_at: tokenExpiresIn
      ? new Date(Date.now() + tokenExpiresIn * 1000)
      : null,
    meta_payload: data
  };
}

async function exchangeCodeForAccessToken(code, redirectUri) {
  const clientId = process.env.META_APP_ID || "";
  const clientSecret = process.env.META_APP_SECRET || "";
  const resolvedRedirectUri = normalizeRedirectUri(
    redirectUri || process.env.META_REDIRECT_URI
  );

  if (!clientId || !clientSecret) {
    throw new Error(
      "Para trocar o code da Meta, defina META_APP_ID, META_APP_SECRET e META_REDIRECT_URI."
    );
  }

  const requestAccessToken = async (redirectUriValue = null) => {
    const response = await axios.get(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/oauth/access_token`,
      {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          ...(redirectUriValue ? { redirect_uri: redirectUriValue } : {})
        }
      }
    );

    return response.data;
  };

  try {
    return await requestAccessToken(resolvedRedirectUri);
  } catch (error) {
    const metaError = error?.response?.data?.error || {};
    const errorCode = Number(metaError?.code || 0);
    const errorSubcode = Number(metaError?.error_subcode || 0);

    if (resolvedRedirectUri && errorCode === 100 && errorSubcode === 36008) {
      console.warn(
        "[meta/oauth] redirect_uri rejeitado pela Meta. Tentando nova troca sem redirect_uri."
      );
      return await requestAccessToken(null);
    }

    throw error;
  }
}

async function exchangeAccessTokenForLongLivedToken(accessToken) {
  const clientId = process.env.META_APP_ID || "";
  const clientSecret = process.env.META_APP_SECRET || "";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Para estender o token da Meta, defina META_APP_ID e META_APP_SECRET."
    );
  }

  const response = await axios.get(
    `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/oauth/access_token`,
    {
      params: {
        grant_type: "fb_exchange_token",
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: accessToken
      }
    }
  );

  return response.data;
}

async function debugMetaAccessToken(accessToken) {
  const clientId = process.env.META_APP_ID || "";
  const clientSecret = process.env.META_APP_SECRET || "";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Para inspecionar o token da Meta, defina META_APP_ID e META_APP_SECRET."
    );
  }

  const appAccessToken = `${clientId}|${clientSecret}`;

  const response = await axios.get(
    `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/debug_token`,
    {
      params: {
        input_token: accessToken,
        access_token: appAccessToken
      }
    }
  );

  return response.data?.data || null;
}

async function normalizeMetaAccessTokenData(tokenData = {}) {
  const normalizedTokenData = {
    ...tokenData,
    access_token: tokenData.access_token || tokenData.accessToken || null,
    token_type: tokenData.token_type || null,
    expires_in: Number(tokenData.expires_in || tokenData.token_expires_in || 0) || null
  };

  if (!normalizedTokenData.access_token) {
    return normalizedTokenData;
  }

  if (!normalizedTokenData.expires_in) {
    try {
      const longLivedTokenData = await exchangeAccessTokenForLongLivedToken(
        normalizedTokenData.access_token
      );

      normalizedTokenData.access_token =
        longLivedTokenData?.access_token || normalizedTokenData.access_token;
      normalizedTokenData.token_type =
        longLivedTokenData?.token_type || normalizedTokenData.token_type || null;
      normalizedTokenData.expires_in =
        Number(longLivedTokenData?.expires_in || 0) || normalizedTokenData.expires_in;
    } catch (error) {
      // noop
    }
  }

  if (!normalizedTokenData.expires_in || !normalizedTokenData.token_type) {
    try {
      const debugData = await debugMetaAccessToken(normalizedTokenData.access_token);

      if (!normalizedTokenData.token_type && debugData?.type) {
        normalizedTokenData.token_type = debugData.type;
      }

      if (!normalizedTokenData.expires_in && debugData?.expires_at) {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        normalizedTokenData.expires_in = Math.max(
          Number(debugData.expires_at) - nowInSeconds,
          0
        );
      }

      normalizedTokenData.debug_token = debugData;
    } catch (error) {
      // noop
    }
  }

  return normalizedTokenData;
}

async function getMetaDisplayInfo(wa_id, token) {
  if (!wa_id || !token) {
    throw new Error(
      "Para trocar o code da Meta, defina META_APP_ID, META_APP_SECRET e META_REDIRECT_URI."
    );
  }
  const response = await axios.get(
    `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${wa_id}/phone_numbers` +
    "?fields=id,cc,country_dial_code,display_phone_number,verified_name,status,quality_rating,search_visibility,platform_type,code_verification_status" +
    `&access_token=${token}`
  );

  return response.data;
}

async function subscribeMetaWebhook(whatsappAccountId, accessToken, webhookUrl, verifyToken) {
  if (!whatsappAccountId || !accessToken || !webhookUrl || !verifyToken) {
    throw new Error("Dados insuficientes para registrar o webhook da Meta.");
  }

  const response = await axios.post(
    `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${whatsappAccountId}/subscribed_apps`,
    "",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  return response.data;
}

function validateMetaIntegrationReadyLegacy(parametros) {
  if (!parametros) {
    return "Integração da Meta não encontrada para a empresa.";
  }

  if (!parametros.api_key) {
    return "Token da integração Meta não encontrado para a empresa.";
  }

  if (!parametros.whatsapp_account_id) {
    return "WhatsApp Account ID não encontrado na integração Meta.";
  }

  return null;
}

function getTemplateButtonParameterCount(button) {
  return Array.isArray(button?.parameter_indexes)
    ? button.parameter_indexes.length
    : 0;
}

function getRequestButtonParameterCount(button) {
  return Array.isArray(button?.parameters) ? button.parameters.length : 0;
}

function getRequestButtonByTemplateIndex(requestButtons, templateButtonIndex) {
  const templateIndex = Number(templateButtonIndex);
  if (!Number.isFinite(templateIndex)) return null;

  const byZeroBased = requestButtons.find(
    (item) => Number(item?.index) === templateIndex - 1
  );
  if (byZeroBased) return byZeroBased;

  const byOneBased = requestButtons.find(
    (item) => Number(item?.index) === templateIndex
  );
  if (byOneBased) return byOneBased;

  return null;
}

function validateTemplateForDispatch(template, requestData, availableTemplates = []) {
  if (!template) {
    return {
      valid: false,
      errors: ["Template não encontrado na conta da Meta."],
      available_templates: (availableTemplates || [])
        .map((item) => String(item?.name || "").trim())
        .filter(Boolean)
    };
  }

  const errors = [];
  const requestLanguage =
    requestData.language_code ||
    requestData.language?.code ||
    requestData.language ||
    "pt_BR";

  if (template.language && String(template.language) !== String(requestLanguage)) {
    errors.push(
      `Template ${template.name} encontrado, mas no idioma ${template.language}.`
    );
  }

  const headerType = String(template.components?.header?.type || "TEXT").toUpperCase();
  const headerParameterIndexes = Array.isArray(template.components?.header?.parameter_indexes)
    ? template.components.header.parameter_indexes
    : [];
  const headerParameters = Array.isArray(requestData.header_parameters)
    ? requestData.header_parameters
    : [];

  const hasHeaderImage = !!requestData.header_image;
  const hasHeaderDocument = !!requestData.header_document;
  const hasHeaderVideo = !!requestData.header_video;
  const headerMediaCount = [hasHeaderImage, hasHeaderDocument, hasHeaderVideo].filter(Boolean).length;

  if (headerType === "TEXT") {
    if (headerMediaCount > 0) {
      errors.push("O template possui header de texto e não aceita mídia no header.");
    }

    if (headerParameterIndexes.length !== headerParameters.length) {
      errors.push(
        `O header do template exige ${headerParameterIndexes.length} parâmetro(s), mas foram enviados ${headerParameters.length}.`
      );
    }
  }

  if (headerType === "IMAGE") {
    if (!hasHeaderImage) {
      errors.push("O template exige header do tipo image.");
    }
    if (hasHeaderDocument || hasHeaderVideo) {
      errors.push("O template exige header image; não envie document ou video.");
    }
  }

  if (headerType === "DOCUMENT") {
    if (!hasHeaderDocument) {
      errors.push("O template exige header do tipo document.");
    }
    if (hasHeaderImage || hasHeaderVideo) {
      errors.push("O template exige header document; não envie image ou video.");
    }
  }

  if (headerType === "VIDEO") {
    if (!hasHeaderVideo) {
      errors.push("O template exige header do tipo video.");
    }
    if (hasHeaderImage || hasHeaderDocument) {
      errors.push("O template exige header video; não envie image ou document.");
    }
  }

  const expectedBodyCount = Array.isArray(template.components?.body?.parameter_indexes)
    ? template.components.body.parameter_indexes.length
    : 0;
  const bodyParameters = Array.isArray(requestData.body_parameters)
    ? requestData.body_parameters
    : [];

  if (expectedBodyCount !== bodyParameters.length) {
    errors.push(
      `O body do template exige ${expectedBodyCount} parâmetro(s), mas foram enviados ${bodyParameters.length}.`
    );
  }

  const expectedButtons = Array.isArray(template.components?.buttons)
    ? template.components.buttons
    : [];
  const requestButtons = Array.isArray(requestData.button_parameters)
    ? requestData.button_parameters
    : [];

  expectedButtons.forEach((button) => {
    const expectedCount = getTemplateButtonParameterCount(button);
    const requestButton = getRequestButtonByTemplateIndex(
      requestButtons,
      button.index
    );
    const receivedCount = getRequestButtonParameterCount(requestButton);

    if (expectedCount !== receivedCount) {
      errors.push(
        `O botão ${button.index} do template exige ${expectedCount} parâmetro(s), mas foram enviados ${receivedCount}.`
      );
    }
  });

  const templateHeaderExists = !!template.components?.header;
  if (!templateHeaderExists && headerParameters.length) {
    errors.push("O template não possui header com parâmetros.");
  }

  if (!templateHeaderExists && headerMediaCount > 0) {
    errors.push("O template não possui header de mídia.");
  }

  return {
    valid: errors.length === 0,
    errors,
    template: {
      name: template.name,
      language: template.language,
      status: template.status || null,
      category: template.category || null,
      header_type: template.components?.header?.type || null,
      header_parameter_count: headerParameterIndexes.length,
      body_parameter_count: expectedBodyCount,
      footer_text: template.components?.footer?.text || null,
      buttons: expectedButtons.map((button) => ({
        index: button.index,
        type: button.type,
        sub_type: button.sub_type,
        parameter_count: getTemplateButtonParameterCount(button),
        text: button.text || null,
        url: button.url || null,
        phone_number: button.phone_number || null
      }))
    },
    preview: {
      expected: {
        header_type: template.components?.header?.type || null,
        header_parameter_count: headerParameterIndexes.length,
        accepts_header_media:
          ["IMAGE", "DOCUMENT", "VIDEO"].includes(headerType),
        body_parameter_count: expectedBodyCount,
        buttons: expectedButtons.map((button) => ({
          index: button.index,
          type: button.type,
          sub_type: button.sub_type,
          parameter_count: getTemplateButtonParameterCount(button)
        }))
      },
      received: {
        header_parameter_count: headerParameters.length,
        has_header_image: hasHeaderImage,
        has_header_document: hasHeaderDocument,
        has_header_video: hasHeaderVideo,
        body_parameter_count: bodyParameters.length,
        buttons: requestButtons.map((button) => ({
          index: Number(button?.index ?? 0),
          parameter_count: getRequestButtonParameterCount(button)
        }))
      }
    }
  };
}

async function handleGetTemplates(req, res, routeName) {
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

    const templates = await utils.getTemplates({
      empresa_id: data.empresa_id,
      meta_param_id: data.meta_param_id,
      conversa_id: data.conversa_id,
    });

    return res.json(utils.jsonMount(true, templates, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, routeName));
  }
}

function validateMetaIntegrationReady(parametros) {
  if (!parametros) {
    return "Integracao da Meta nao encontrada para a empresa.";
  }

  if (!getMetaSystemAccessToken()) {
    return "META_ACCESS_TOKEN nao configurado no .env.";
  }

  if (!parametros.whatsapp_account_id) {
    return "WhatsApp Account ID nao encontrado na integracao Meta.";
  }

  return null;
}

module.exports = {
  DEFAULT_GRAPH_VERSION,
  buildWebhookUrl,
  debugMetaAccessToken,
  exchangeAccessTokenForLongLivedToken,
  exchangeCodeForAccessToken,
  extractWebhookIdentifiers,
  findPhoneNumberInfo,
  resolveMetaSignupContext,
  getMetaDisplayInfo,
  getMetaParametrosOrFail,
  getPrimaryWebhookChanges,
  getRequestedPhoneNumber,
  getRequestedPhoneNumberId,
  handleGetTemplates,
  isWebhookChangeForMetaMessages,
  mapWebhookStatus,
  mountMetaStatus,
  normalizeMetaAccessTokenData,
  normalizeMetaPayload,
  normalizePricingRows,
  persistIncomingMetaMessage,
  persistMetaMessageEcho,
  subscribeMetaWebhook,
  toUnix,
  buildTemplateCreatePayload,
  buildWhatsAppProfileUpdatePayload,
  buildTemplatePayloadForDispatch,
  resolveTemplateDispatchPayloadForRecipient,
  buildTemplatePreviewMessage,
  buildTemplateChatPayload,
  findTemplateDefinition,
  validateTemplateForDispatch,
  validateMetaIntegrationReady,
  buildTemplateDispatchContext,
  normalizeWhatsAppProfileResponse,
  resolveTemplateHeaderMedia,
  cleanupUploadedTemplateMedia,
  getMetaParametros,
  getMetaSystemAccessToken,
  shouldSendLeadStartedAutoMessage,
  validateWhatsAppProfilePictureFile,
  uploadMetaResumableFileHandle
};
