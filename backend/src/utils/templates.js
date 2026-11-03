const security = require('../security/cypher')
const execute = require('../services/execute_atendimento')
const executeMeta = require('../services/execute_meta')
const executeMetaAds = require('../services/execute_meta_ads')
const executeAppSafety = require('../services/execute_app_safety')
const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const bunny = require("./bunny_config");
const { notifyChatUpdate } = require("../server/realtime");

const META_MEDIA_NEGATIVE_CACHE_TTL_MS = Math.max(
    Number(process.env.META_MEDIA_NEGATIVE_CACHE_TTL_MS || 6 * 60 * 60 * 1000) || 0,
    60 * 1000
);
const metaMediaNegativeCache = new Map();

function createPermanentMetaMediaError(message, details = {}) {
    const error = new Error(message);
    error.code = "META_MEDIA_PERMANENTLY_UNAVAILABLE";
    error.httpStatus = 410;
    error.metaError = details;
    return error;
}

function getCachedPermanentMetaMediaError(cacheKey) {
    const cached = metaMediaNegativeCache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
        metaMediaNegativeCache.delete(cacheKey);
        return null;
    }
    return createPermanentMetaMediaError(cached.message, cached.details);
}

function cachePermanentMetaMediaError(cacheKey, message, details = {}) {
    if (metaMediaNegativeCache.size >= 5000) {
        const now = Date.now();
        for (const [key, cached] of metaMediaNegativeCache.entries()) {
            if (cached.expiresAt <= now) metaMediaNegativeCache.delete(key);
        }
        if (metaMediaNegativeCache.size >= 5000) {
            const oldestKey = metaMediaNegativeCache.keys().next().value;
            if (oldestKey) metaMediaNegativeCache.delete(oldestKey);
        }
    }
    metaMediaNegativeCache.set(cacheKey, {
        message,
        details,
        expiresAt: Date.now() + META_MEDIA_NEGATIVE_CACHE_TTL_MS,
    });
}

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

let executeUserInstance = null;

function getExecuteUser() {
    if (!executeUserInstance) {
        executeUserInstance = require('../services/execute_user');
    }

    return executeUserInstance;
}

function emitChatMessageUpdate({
    empresa_id,
    conversa_id,
    origem,
}) {
    notifyChatUpdate({
        empresa_id,
        conversa_id,
        tipo: "message",
        origem,
    });
}


function buildInsightsField(inicio, fim) {
    if (inicio && fim) {
        return `insights.time_range({since:'${inicio}',until:'${fim}'}){spend,impressions,actions,results,objective_results}`
    }

    if (inicio && !fim) {
        const hoje = new Date().toISOString().split('T')[0]
        return `insights.time_range({since:'${inicio}',until:'${hoje}'}){spend,impressions,actions,results,objective_results}`
    }

    if (!inicio && fim) {
        return `insights.time_range({since:'${fim}',until:'${fim}'}){spend,impressions,actions,results,objective_results}`
    }

    return `insights{spend,impressions,actions,results}`
}

function formatMetaInsightDate(date) {
    return date.toISOString().split('T')[0]
}

function fillMissingDays(insights = [], days = 7) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const insightMap = new Map(
        (insights || []).map((item) => [
            String(item?.date_start || item?.date || ''),
            item
        ])
    )

    const filled = []

    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const currentDate = new Date(today)
        currentDate.setDate(today.getDate() - offset)
        const currentKey = formatMetaInsightDate(currentDate)
        const existingInsight = insightMap.get(currentKey)

        filled.push(
            existingInsight || {
                date_start: currentKey,
                date_stop: currentKey,
                spend: 0,
                impressions: 0
            }
        )
    }

    return filled
}

function createMetaClient(accessToken) {
    return axios.create({
        baseURL: `${process.env.META_BASE_URL || 'https://graph.facebook.com'}/${process.env.META_API_VERSION || process.env.META_GRAPH_API_VERSION || 'v25.0'}`,
        timeout: 30000,
        params: {
            access_token: accessToken
        }
    })
}

async function fetchAllWhatsAppTemplates(whatsappAccountId, accessToken) {
    const templates = [];
    const visitedPages = new Set();
    let nextUrl =
        `https://graph.facebook.com/v25.0/${whatsappAccountId}/message_templates?limit=100`;

    while (nextUrl && !visitedPages.has(nextUrl)) {
        visitedPages.add(nextUrl);

        const response = await axios.get(nextUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const pageTemplates = Array.isArray(response.data?.data)
            ? response.data.data
            : [];
        templates.push(...pageTemplates);
        nextUrl = String(response.data?.paging?.next || "").trim() || null;
    }

    return templates;
}

function getMetaSystemAccessToken() {
    const accessToken = String(process.env.META_ACCESS_TOKEN || "").trim();
    return accessToken || null;
}

function getTemplateHeaderImageOrigin(metaParamId, templateName, languageCode = "pt_BR") {
    const normalizedMetaParamId = Number(metaParamId);
    const normalizedTemplateName = String(templateName || "").trim();
    const normalizedLanguageCode = String(languageCode || "").trim() || "pt_BR";

    if (!Number.isInteger(normalizedMetaParamId) || normalizedMetaParamId <= 0) {
        throw new Error("Meta param_id invalido para salvar imagem do template.");
    }

    if (!normalizedTemplateName) {
        throw new Error("Nome do template nao informado para salvar imagem.");
    }

    return `meta_template_header:${normalizedMetaParamId}:${encodeURIComponent(normalizedTemplateName)}:${encodeURIComponent(normalizedLanguageCode)}`;
}

function parseTemplateHeaderImageOrigin(origin = "") {
    const parts = String(origin || "").split(":");
    if (parts.length < 4 || parts[0] !== "meta_template_header") {
        return null;
    }

    const metaParamId = Number(parts[1]);
    if (!Number.isInteger(metaParamId) || metaParamId <= 0) {
        return null;
    }

    return {
        meta_param_id: metaParamId,
        template_name: decodeURIComponent(parts[2] || ""),
        language_code: decodeURIComponent(parts.slice(3).join(":") || "pt_BR") || "pt_BR",
    };
}

function buildTemplateHeaderMediaLookupKey(templateName, languageCode = "pt_BR") {
    return `${String(templateName || "").trim().toLowerCase()}::${String(languageCode || "pt_BR").trim().toLowerCase()}`;
}

function mapGalleryImageToTemplateHeaderMedia(row) {
    if (!row?.url) {
        return null;
    }

    const originInfo = parseTemplateHeaderImageOrigin(row.origem || "");

    return {
        id: row.id || null,
        mediaType: "image",
        media_type: "image",
        url: row.url,
        path_bunny: row.path_bunny || null,
        nome_arquivo: row.nome_arquivo || null,
        mime_type: row.mime_type || null,
        tamanho_bytes: row.tamanho_bytes || null,
        origem: row.origem || null,
        template_name: originInfo?.template_name || null,
        language_code: originInfo?.language_code || "pt_BR",
        meta_param_id: originInfo?.meta_param_id || null,
        persisted: true,
    };
}

async function getWhatsappSenderParams(contextOrEmpresaId, conversa_id = null, meta_param_id = null) {
    const empresa_id =
        typeof contextOrEmpresaId === "object" && contextOrEmpresaId !== null
            ? Number(contextOrEmpresaId.empresa_id)
            : Number(contextOrEmpresaId);
    const normalizedMetaParamId =
        typeof contextOrEmpresaId === "object" && contextOrEmpresaId !== null
            ? Number(contextOrEmpresaId.meta_param_id)
            : Number(meta_param_id);
    const normalizedConversaId =
        typeof contextOrEmpresaId === "object" && contextOrEmpresaId !== null
            ? Number(contextOrEmpresaId.conversa_id)
            : Number(conversa_id);
    if (
        Number.isInteger(normalizedConversaId) &&
        normalizedConversaId > 0 &&
        await executeAppSafety.execute_conversa_cliente_bloqueado(normalizedConversaId)
    ) {
        const error = new Error("Este cliente esta bloqueado. O envio foi recusado.");
        error.code = "CLIENT_BLOCKED";
        throw error;
    }
    const rows =
        Number.isInteger(normalizedMetaParamId) && normalizedMetaParamId > 0
            ? await executeMeta.execute_get_paramentros_whats_by_id(normalizedMetaParamId, empresa_id)
            : Number.isInteger(normalizedConversaId) && normalizedConversaId > 0
                ? await executeMeta.execute_get_paramentros_whats_by_conversa_id(normalizedConversaId)
                : await executeMeta.execute_get_paramentros_whats(empresa_id);

    const sender = rows?.[0] || null;

    if (!sender?.numero) {
        throw new Error("Numero da conta Meta nao encontrado para esta conversa/empresa.");
    }

    const accessToken = getMetaSystemAccessToken();
    if (!accessToken) {
        throw new Error("META_ACCESS_TOKEN nao configurado no .env.");
    }
    return {
        ...sender,
                api_key: accessToken
    };
}

async function uploadTemplateHeaderFileToBunnyInternal(file, ownerId = 'meta') {
    if (!file) {
        return null;
    }

    const mediaType =
        inferTemplateMediaTypeFromFieldname(file.fieldname || '') ||
        inferTemplateMediaTypeFromMime(file.mimetype || '');

    if (!mediaType) {
        throw new Error('Tipo de arquivo nao suportado para header do template.');
    }

    const filePath = bunny.generateFileName(file.originalname, ownerId);
    const uploaded = await bunny.uploadFile(filePath, file.buffer);

    return {
        mediaType,
        filePath,
        url: uploaded.file,
        originalname: file.originalname,
        mimetype: file.mimetype || null,
        size: file.size || null
    };
}

function extractSafeErrorForLog(error) {
    if (error?.response?.data) {
        return {
            message: error.message,
            status: error.response.status || null,
            data: error.response.data
        };
    }

    return {
        message: error?.message || String(error),
        code: error?.code || null
    };
}

function getMetaAdsIntegrationErrorMessage(error) {
    const metaError = error?.response?.data?.error || null;
    const errorCode = Number(metaError?.code || 0);
    const errorSubcode = Number(metaError?.error_subcode || 0);
    const errorMessage = String(metaError?.message || error?.message || '');
    const normalizedErrorMessage = errorMessage.toLowerCase();

    if (error?.meta_ads_reconnect_required) {
        return error.user_message || 'A integração da Meta Ads expirou. Refaça a conexão da conta para continuar.';
    }

    if (
        metaError?.type === 'OAuthException' &&
        errorCode === 190 &&
        errorSubcode === 463
    ) {
        return 'A sessão da Meta Ads expirou. Refaça a integração da conta de anúncio para gerar um novo token de acesso.';
    }

    if (
        metaError?.type === 'OAuthException' &&
        errorCode === 190
    ) {
        return 'O token da Meta Ads é inválido ou expirou. Refaça a integração da conta de anúncio.';
    }

    if (
        metaError?.type === 'OAuthException' &&
        errorCode === 200 &&
        normalizedErrorMessage.includes('pages_manage_ads')
    ) {
        return 'A integração da Meta Ads não tem a permissão pages_manage_ads. Refaça a conexão da conta liberando pages_manage_ads, pages_show_list, pages_read_engagement e leads_retrieval.';
    }

    if (
        metaError?.type === 'OAuthException' &&
        errorCode === 200 &&
        normalizedErrorMessage.includes('leads_retrieval')
    ) {
        return 'A integração da Meta Ads não tem a permissão leads_retrieval. Refaça a conexão da conta liberando leads_retrieval para consultar os leads dos formulários.';
    }

    if (
        metaError?.type === 'OAuthException' &&
        errorCode === 200 &&
        (
            normalizedErrorMessage.includes('pages_show_list') ||
            normalizedErrorMessage.includes('pages_read_engagement')
        )
    ) {
        return 'A integração da Meta Ads não tem permissão suficiente para acessar as páginas e os formulários. Refaça a conexão liberando pages_show_list, pages_read_engagement, pages_manage_ads e leads_retrieval.';
    }

    if (errorMessage.includes('Token da integração Meta Ads não encontrado')) {
        return errorMessage;
    }

    return null;
}

async function getMetaAdsAccessTokenForAccount(empresaId, actAdAccountId) {
    const accounts = await executeMetaAds.execute_get_meta_ads_account_by_ad_account_id(
        empresaId,
        actAdAccountId
    );

    const account = accounts?.[0] || null;
    const accessToken =
        account?.meta_access_token ||
        account?.meta_payload?.access_token ||
        account?.meta_payload?.accessToken ||
        process.env.META_ADS_ACESS_TOKEN ||
        null;

    if (!accessToken) {
        throw new Error(
            'Token da integração Meta Ads não encontrado para a conta selecionada. Refaça a vinculação da conta ou configure META_ADS_ACESS_TOKEN.'
        );
    }

    const expiresAt = account?.meta_access_token_expires_at
        ? new Date(account.meta_access_token_expires_at)
        : null;

    if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
        const integrationError = new Error(
            'A integração da Meta Ads expirou. Refaça a conexão da conta de anúncio para gerar um novo token de acesso.'
        );
        integrationError.meta_ads_reconnect_required = true;
        integrationError.user_message =
            'A integração da Meta Ads expirou. Refaça a conexão da conta de anúncio para gerar um novo token de acesso.';
        integrationError.meta_access_token_expires_at = expiresAt.toISOString();
        throw integrationError;
    }

    return accessToken;
}


function getParameterIndexesFromText(text = '') {
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    const indexes = [...new Set(matches.map((item) => Number(item.replace(/[{}]/g, ''))))];
    return indexes.sort((a, b) => a - b);
}

function normalizeTemplate(template) {
    const components = template.components || [];
    const payload = {
        id: template.id || null,
        name: template.name,
        category: template.category,
        status: template.status,
        language: template.language,
        has_parameters: false,
        parameters: [],
        components: {
            header: null,
            body: null,
            footer: null,
            buttons: []
        }
    };

    components.forEach((component) => {
        const componentType = (component.type || '').toUpperCase();

        if (componentType === 'HEADER') {
            const text = component.text || '';
            const indexes = getParameterIndexesFromText(text);
            payload.components.header = {
                type: component.format || 'TEXT',
                text,
                parameter_indexes: indexes,
                examples: component.example?.header_text || []
            };
            indexes.forEach((index) => {
                payload.parameters.push({
                    key: `header.${index}`,
                    component: 'HEADER',
                    index,
                    placeholder: `{{${index}}}`
                });
            });
        }

        if (componentType === 'BODY') {
            const text = component.text || '';
            const indexes = getParameterIndexesFromText(text);
            payload.components.body = {
                text,
                parameter_indexes: indexes,
                examples: component.example?.body_text?.[0] || []
            };
            indexes.forEach((index) => {
                payload.parameters.push({
                    key: `body.${index}`,
                    component: 'BODY',
                    index,
                    placeholder: `{{${index}}}`
                });
            });
        }

        if (componentType === 'FOOTER') {
            payload.components.footer = {
                text: component.text || ''
            };
        }

        if (componentType === 'BUTTONS' && Array.isArray(component.buttons)) {
            payload.components.buttons = component.buttons.map((button, buttonIndex) => {
                const indexes = getParameterIndexesFromText(button.url || button.text || '');

                indexes.forEach((index) => {
                    payload.parameters.push({
                        key: `button.${buttonIndex + 1}.${index}`,
                        component: 'BUTTON',
                        button_index: buttonIndex + 1,
                        index,
                        placeholder: `{{${index}}}`
                    });
                });

                return {
                    index: buttonIndex + 1,
                    type: button.type,
                    sub_type: button.sub_type || null,
                    text: button.text || null,
                    url: button.url || null,
                    phone_number: button.phone_number || null,
                    parameter_indexes: indexes
                };
            });
        }
    });

    payload.has_parameters = payload.parameters.length > 0;
    return payload;
}

function normalizeTemplateParameter(parameter) {
    if (parameter == null) {
        return null;
    }

    if (typeof parameter === 'string' || typeof parameter === 'number' || typeof parameter === 'boolean') {
        return {
            type: 'text',
            text: String(parameter)
        };
    }

    if (typeof parameter !== 'object') {
        return null;
    }

    const normalizedType = String(parameter.type || 'text').toLowerCase();
    const payload = { ...parameter, type: normalizedType };

    if (normalizedType === 'text' && payload.text === undefined && payload.value !== undefined) {
        payload.text = String(payload.value);
    }

    if (['image', 'document', 'video'].includes(normalizedType)) {
        const existingMedia = payload[normalizedType] && typeof payload[normalizedType] === 'object'
            ? payload[normalizedType]
            : {};

        const mediaLinkRaw =
            existingMedia.link ||
            existingMedia.url ||
            existingMedia.href ||
            payload.link ||
            payload.url ||
            payload.href;
        const mediaLink =
            typeof mediaLinkRaw === 'string' && mediaLinkRaw.trim()
                ? encodeURI(mediaLinkRaw.trim())
                : null;
        const mediaId =
            existingMedia.id ||
            existingMedia.media_id ||
            payload.id ||
            payload.media_id;

        delete payload.url;
        delete payload.href;
        delete payload.media_id;
        delete payload.link;
        delete payload.id;

        if (mediaLink) {
            payload[normalizedType] = {
                link: mediaLink
            };
        } else if (mediaId) {
            payload[normalizedType] = {
                id: mediaId
            };
        }
    }

    return payload;
}

function getHeaderMediaParameter(data = {}) {
    const image = data.header_image || data.image;
    if (image) {
        return normalizeTemplateParameter(
            typeof image === 'object'
                ? { type: 'image', ...image }
                : { type: 'image', link: image }
        );
    }

    const document = data.header_document || data.document;
    if (document) {
        return normalizeTemplateParameter(
            typeof document === 'object'
                ? { type: 'document', ...document }
                : { type: 'document', link: document }
        );
    }

    const video = data.header_video || data.video;
    if (video) {
        return normalizeTemplateParameter(
            typeof video === 'object'
                ? { type: 'video', ...video }
                : { type: 'video', link: video }
        );
    }

    return null;
}

function inferTemplateMediaTypeFromMime(mimetype = '') {
    if (mimetype.startsWith('image/')) {
        return 'image';
    }

    if (mimetype.startsWith('video/')) {
        return 'video';
    }

    if (mimetype === 'application/pdf' || mimetype.startsWith('application/')) {
        return 'document';
    }

    return null;
}

function inferTemplateMediaTypeFromFieldname(fieldname = '') {
    if (fieldname.includes('image')) {
        return 'image';
    }

    if (fieldname.includes('video')) {
        return 'video';
    }

    if (fieldname.includes('document')) {
        return 'document';
    }

    return null;
}

function getBunnyPathFromUrl(fileUrl) {
    if (!fileUrl) {
        return null;
    }

    try {
        const parsed = new URL(fileUrl);
        return parsed.pathname.replace(/^\/+/, '');
    } catch (error) {
        return String(fileUrl).replace(/^https?:\/\/[^/]+\//i, '');
    }
}

function normalizeTemplateComponent(component) {
    if (!component || typeof component !== 'object') {
        return null;
    }

    const type = String(component.type || '').toLowerCase();
    if (!type) {
        return null;
    }

    const normalizedComponent = { type };

    if (component.sub_type !== undefined) {
        normalizedComponent.sub_type = String(component.sub_type).toLowerCase();
    }

    if (component.index !== undefined) {
        normalizedComponent.index = String(component.index);
    }

    if (Array.isArray(component.parameters)) {
        const parameters = component.parameters
            .map(normalizeTemplateParameter)
            .filter(Boolean);

        if (parameters.length) {
            normalizedComponent.parameters = parameters;
        }
    }

    return normalizedComponent;
}

function buildTemplateComponents(data = {}) {
    if (Array.isArray(data.components) && data.components.length) {
        return data.components
            .map(normalizeTemplateComponent)
            .filter(Boolean);
    }

    const components = [];
    const headerParameters = Array.isArray(data.header_parameters) ? data.header_parameters : [];
    const bodyParameters = Array.isArray(data.body_parameters) ? data.body_parameters : [];
    const buttonParameters = Array.isArray(data.button_parameters) ? data.button_parameters : [];
    const headerMediaParameter = getHeaderMediaParameter(data);

    if (headerParameters.length || headerMediaParameter) {
        const normalizedHeaderParameters = headerParameters
            .map(normalizeTemplateParameter)
            .filter(Boolean);

        if (headerMediaParameter) {
            normalizedHeaderParameters.push(headerMediaParameter);
        }

        components.push({
            type: 'header',
            parameters: normalizedHeaderParameters
        });
    }

    if (bodyParameters.length) {
        components.push({
            type: 'body',
            parameters: bodyParameters
                .map(normalizeTemplateParameter)
                .filter(Boolean)
        });
    }

    const hasZeroBasedButtonIndex = buttonParameters.some(
        (button) => Number(button?.index) === 0
    );

    buttonParameters.forEach((button) => {
        const parsedIndex = Number(button?.index);
        const normalizedIndex = Number.isFinite(parsedIndex)
            ? (hasZeroBasedButtonIndex ? parsedIndex : Math.max(parsedIndex - 1, 0))
            : 0;

        const normalizedButton = normalizeTemplateComponent({
            type: 'button',
            sub_type: button?.sub_type || button?.type || 'quick_reply',
            index: normalizedIndex,
            parameters: button?.parameters || []
        });

        if (normalizedButton) {
            components.push(normalizedButton);
        }
    });

    return components.filter((component) => {
        return !Array.isArray(component.parameters) || component.parameters.length > 0;
    });
}

function convertToOgg(inputPath, options = {}) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(
            os.tmpdir(),
            `whatsapp-voice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.ogg`
        );
        const durationSeconds = Math.max(parsePositiveNumber(options?.durationSeconds, 0), 1);
        const targetBytes = parsePositiveNumber(options?.targetBytes, 480 * 1024);
        const targetBitrateKbps = Math.floor((targetBytes * 8 * 0.92) / durationSeconds / 1000);
        const audioBitrateKbps = clampNumber(
            parsePositiveNumber(options?.audioBitrateKbps, targetBitrateKbps || 24),
            12,
            32
        );

        ffmpeg(inputPath)
            .noVideo()
            .audioCodec('libopus')
            .audioChannels(1)
            .audioFrequency(16000)
            .audioBitrate(`${audioBitrateKbps}k`)
            .outputOptions([
                '-application voip',
                '-vbr on',
                '-compression_level 10',
                '-frame_duration 20',
                '-map_metadata -1',
                '-vn',
                '-sn',
                '-dn'
            ])
            .format('ogg')
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .save(outputPath);
    });
}

function convertToM4a(inputPath, options = {}) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(
            os.tmpdir(),
            `whatsapp-audio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.m4a`
        );
        const durationSeconds = Math.max(parsePositiveNumber(options?.durationSeconds, 0), 1);
        const targetBitrateKbps = Math.floor((16 * 1024 * 1024 * 8 * 0.92) / durationSeconds / 1000);
        const audioBitrateKbps = clampNumber(
            parsePositiveNumber(options?.audioBitrateKbps, targetBitrateKbps || 64),
            48,
            96
        );

        ffmpeg(inputPath)
            .noVideo()
            .audioCodec('aac')
            .audioChannels(1)
            .audioFrequency(44100)
            .audioBitrate(`${audioBitrateKbps}k`)
            .outputOptions([
                '-movflags +faststart',
                '-map_metadata -1',
                '-vn',
                '-sn',
                '-dn'
            ])
            .format('mp4')
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .save(outputPath);
    });
}

function convertToMp3File(inputPath, options = {}) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(
            os.tmpdir(),
            `whatsapp-audio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.mp3`
        );
        const audioBitrateKbps = clampNumber(
            parsePositiveNumber(options?.audioBitrateKbps, 128),
            64,
            192
        );

        ffmpeg(inputPath)
            .noVideo()
            .audioCodec('libmp3lame')
            .audioChannels(1)
            .audioFrequency(44100)
            .audioBitrate(`${audioBitrateKbps}k`)
            .outputOptions([
                '-map_metadata -1',
                '-vn',
                '-sn',
                '-dn'
            ])
            .format('mp3')
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .save(outputPath);
    });
}

function probeMediaStreams(inputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (error, metadata) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(metadata || {});
        });
    });
}

function readPrimaryAudioStream(metadata = {}) {
    const streams = Array.isArray(metadata?.streams) ? metadata.streams : [];
    return streams.find(
        (stream) => String(stream?.codec_type || "").toLowerCase() === "audio"
    ) || null;
}

const META_VIDEO_PRIMARY_TARGET_BYTES = 16 * 1024 * 1024;
const META_VIDEO_FALLBACK_TARGET_BYTES = 10 * 1024 * 1024;

function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function parsePositiveNumber(value, fallback = 0) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

async function removeTemporaryMediaFile(filePath) {
    if (!filePath) {
        return;
    }

    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (error?.code !== "ENOENT") {
            console.warn("Falha ao remover arquivo temporario de video:", error);
        }
    }
}

async function transcodeVideoForWhatsApp(inputPath, metadata, options = {}) {
    const parsedPath = path.parse(inputPath);
    const suffix = options?.suffix || "meta";
    const outputPath = path.join(
        parsedPath.dir,
        `${parsedPath.name}-${suffix}-${Date.now()}.mp4`
    );
    const streams = Array.isArray(metadata?.streams) ? metadata.streams : [];
    const videoStream = streams.find(
        (stream) => String(stream?.codec_type || "").toLowerCase() === "video"
    );
    const hasAudioStream = streams.some(
        (stream) => String(stream?.codec_type || "").toLowerCase() === "audio"
    );
    const durationSeconds = Math.max(
        parsePositiveNumber(metadata?.format?.duration),
        parsePositiveNumber(videoStream?.duration),
        1
    );
    const audioBitrateKbps = hasAudioStream
        ? clampNumber(parsePositiveNumber(options?.audioBitrateKbps, 96), 48, 128)
        : 0;
    const totalBitrateKbps = Math.max(
        Math.floor((Number(options?.targetBytes || META_VIDEO_PRIMARY_TARGET_BYTES) * 8 * 0.94) / durationSeconds / 1000),
        audioBitrateKbps + 180
    );
    const videoBitrateKbps = clampNumber(totalBitrateKbps - audioBitrateKbps, 180, 2500);
    const maxrateKbps = Math.max(Math.round(videoBitrateKbps * 1.15), videoBitrateKbps);
    const bufferSizeKbps = Math.max(videoBitrateKbps * 2, 256);

    await new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath)
            .videoCodec("libx264")
            .fps(30)
            .outputOptions([
                "-pix_fmt yuv420p",
                "-movflags +faststart",
                "-preset veryfast",
                "-profile:v baseline",
                "-level 3.1",
                "-bf 0",
                "-tag:v avc1",
                `-b:v ${videoBitrateKbps}k`,
                `-maxrate ${maxrateKbps}k`,
                `-bufsize ${bufferSizeKbps}k`,
            ])
            .format("mp4")
            .on("end", resolve)
            .on("error", reject);

        if (parsePositiveNumber(videoStream?.width) > parsePositiveNumber(options?.maxWidth)) {
            command.size(`${Number(options.maxWidth)}x?`);
        }

        if (hasAudioStream) {
            command
                .audioCodec("aac")
                .audioBitrate(`${audioBitrateKbps}k`)
                .audioChannels(2)
                .audioFrequency(44100);
        } else {
            command.noAudio();
        }

        command.save(outputPath);
    });

    const outputStats = await fs.promises.stat(outputPath);

    return {
        outputPath,
        outputSizeBytes: outputStats.size
    };
}

async function normalizeVideoForWhatsApp(inputPath) {
    const metadata = await probeMediaStreams(inputPath).catch(() => ({}));
    const attempts = [
        {
            targetBytes: META_VIDEO_PRIMARY_TARGET_BYTES,
            audioBitrateKbps: 96,
            maxWidth: 1280,
            suffix: "meta"
        },
        {
            targetBytes: META_VIDEO_FALLBACK_TARGET_BYTES,
            audioBitrateKbps: 64,
            maxWidth: 960,
            suffix: "meta-lite"
        }
    ];
    let lastOutputPath = null;

    for (let index = 0; index < attempts.length; index += 1) {
        const attempt = attempts[index];
        const result = await transcodeVideoForWhatsApp(inputPath, metadata, attempt);
        const sizeLimitWithTolerance = attempt.targetBytes + 512 * 1024;

        lastOutputPath = result.outputPath;

        if (result.outputSizeBytes <= sizeLimitWithTolerance || index === attempts.length - 1) {
            return result.outputPath;
        }

        await removeTemporaryMediaFile(result.outputPath);
        lastOutputPath = null;
    }

    return lastOutputPath || inputPath;
}

async function convertAudioBufferToMp3(inputBuffer, inputExtension = "bin") {
    const tempToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const safeInputExtension = String(inputExtension || "bin").replace(/[^a-z0-9]/gi, "") || "bin";
    const inputPath = path.join(os.tmpdir(), `chat-audio-${tempToken}.${safeInputExtension}`);
    const outputPath = path.join(os.tmpdir(), `chat-audio-${tempToken}.mp3`);

    await fs.promises.writeFile(inputPath, inputBuffer);

    try {
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .audioCodec("libmp3lame")
                .audioChannels(1)
                .audioFrequency(44100)
                .audioBitrate("128k")
                .format("mp3")
                .on("end", resolve)
                .on("error", reject)
                .save(outputPath);
        });

        return await fs.promises.readFile(outputPath);
    } finally {
        await Promise.allSettled([
            fs.promises.unlink(inputPath),
            fs.promises.unlink(outputPath),
        ]);
    }
}

function extractMetaApiErrorPayload(error) {
    const responseData = error?.response?.data;
    if (responseData?.error) {
        return responseData.error;
    }

    const explicitMessage = String(error?.message || "").trim();
    const jsonStart = explicitMessage.indexOf("{");
    if (jsonStart < 0) {
        return null;
    }

    try {
        const parsed = JSON.parse(explicitMessage.slice(jsonStart));
        return parsed?.error || null;
    } catch (_error) {
        return null;
    }
}

function isMetaInvalidParameterError(error) {
    const payload = extractMetaApiErrorPayload(error);
    return Number(payload?.code) === 100;
}

function stringifyStructuredWhatsappPayload(payload) {
    try {
        return JSON.stringify(payload);
    } catch (error) {
        console.error("Erro ao serializar payload estruturado do WhatsApp:", error);
        return null;
    }
}

function buildLocationSummary(location = {}) {
    const label =
        String(location?.name || "").trim() ||
        String(location?.address || "").trim() ||
        [location?.latitude, location?.longitude].filter((value) => value !== undefined && value !== null && value !== "").join(", ") ||
        "Localizacao compartilhada";

    return `[location] ${label}`.trim();
}

function buildContactsSummary(contacts = []) {
    if (!Array.isArray(contacts) || !contacts.length) {
        return "[contacts]";
    }

    const firstContact = contacts[0] || {};
    const firstPhone = Array.isArray(firstContact.phones)
        ? firstContact.phones.find((phone) => phone?.phone)?.phone
        : null;
    const firstName =
        firstContact?.name?.formatted_name ||
        firstContact?.name?.first_name ||
        firstContact?.org?.company ||
        "Contato compartilhado";
    const label = [firstName, firstPhone].filter(Boolean).join(" - ");

    if (contacts.length === 1) {
        return `[contact] ${label}`.trim();
    }

    return `[contacts] ${contacts.length} contatos - ${label}`.trim();
}

const utils = {


    jsonMount: (
        boll, data, msg
    ) => {
        return { "payload": security.jwtencript({ boleano: boll, obj: data, mensagem: msg }) }
    },

    errorHandle: (
        error, rota
    ) => {
        return utils.jsonMount(false, {}, 'Tente novamente mais tarde!')
    },

    metaAdsErrorHandle: (
        error, rota
    ) => {

        const integrationMessage = getMetaAdsIntegrationErrorMessage(error)
        if (integrationMessage) {
            return utils.jsonMount(false, {}, integrationMessage)
        }

        return utils.jsonMount(false, {}, 'Tente novamente mais tarde!')
    },

    uploadTemplateHeaderFileToBunny: async (file, ownerId = 'meta') => {
        return uploadTemplateHeaderFileToBunnyInternal(file, ownerId);
    },

    saveTemplateHeaderImageToGallery: async ({
        empresa_id,
        meta_param_id,
        template_name,
        language_code,
        file,
        ownerId = 'meta'
    }) => {
        const uploadedHeaderMedia = await uploadTemplateHeaderFileToBunnyInternal(file, ownerId);
        if (!uploadedHeaderMedia) {
            return null;
        }

        if (uploadedHeaderMedia.mediaType !== 'image') {
            return uploadedHeaderMedia;
        }

        try {
            const origem = getTemplateHeaderImageOrigin(meta_param_id, template_name, language_code);
            const imagemAnterior = await executeMeta.execute_get_empresa_template_header_image_by_origin(
                empresa_id,
                origem
            );

            const executeUser = getExecuteUser();
            const imagemSalva = await executeUser.execute_criar_galeria_imagem_empresa({
                empresa_id,
                nome_arquivo: uploadedHeaderMedia.originalname || 'template-header-image',
                url: uploadedHeaderMedia.url,
                path_bunny: uploadedHeaderMedia.filePath,
                mime_type: uploadedHeaderMedia.mimetype || null,
                tamanho_bytes: uploadedHeaderMedia.size || null,
                origem,
            });

            if (imagemAnterior?.id && imagemAnterior.id !== imagemSalva?.id) {
                await executeUser.execute_deletar_galeria_imagem_empresa(imagemAnterior.id, empresa_id);
                if (imagemAnterior.path_bunny) {
                    await bunny.deleteFile(imagemAnterior.path_bunny).catch(() => null);
                }
            }

            return {
                mediaType: 'image',
                filePath: imagemSalva?.path_bunny || uploadedHeaderMedia.filePath,
                url: imagemSalva?.url || uploadedHeaderMedia.url,
                originalname: imagemSalva?.nome_arquivo || uploadedHeaderMedia.originalname,
                mimetype: imagemSalva?.mime_type || uploadedHeaderMedia.mimetype || null,
                size: imagemSalva?.tamanho_bytes || uploadedHeaderMedia.size || null,
                gallery_image_id: imagemSalva?.id || null,
                origem,
                template_name,
                language_code: String(language_code || 'pt_BR').trim() || 'pt_BR',
                persisted: true
            };
        } catch (error) {
            await bunny.deleteFile(uploadedHeaderMedia.filePath).catch(() => null);
            throw error;
        }
    },

    findSavedTemplateHeaderImage: async ({
        empresa_id,
        meta_param_id,
        template_name,
        language_code
    }) => {
        if (!empresa_id || !meta_param_id || !template_name) {
            return null;
        }

        const origem = getTemplateHeaderImageOrigin(meta_param_id, template_name, language_code);
        const row = await executeMeta.execute_get_empresa_template_header_image_by_origin(
            empresa_id,
            origem
        );

        return mapGalleryImageToTemplateHeaderMedia(row);
    },

    listSavedTemplateHeaderImages: async ({
        empresa_id,
        meta_param_id
    }) => {
        if (!empresa_id || !meta_param_id) {
            return [];
        }

        const prefixoOrigem = `meta_template_header:${Number(meta_param_id)}:%`;
        const rows = await executeMeta.execute_list_empresa_template_header_images_by_origin_prefix(
            empresa_id,
            prefixoOrigem
        );

        return (rows || [])
            .map(mapGalleryImageToTemplateHeaderMedia)
            .filter(Boolean);
    },

    deleteBunnyFileByUrl: async (fileUrl) => {
        const filePath = getBunnyPathFromUrl(fileUrl);
        if (!filePath) {
            return { success: false };
        }

        return bunny.deleteFile(filePath);
    },

    sendWhatsappMessage: async (
        numero,
        mensagem,
        conversa_id,
        msg,
        empresa_id,
        usuario_id = null,
        replyContext = null
    ) => {
        try {
            await executeAppSafety.execute_validar_conteudo_envio(empresa_id, mensagem);
            const dados_whats = await getWhatsappSenderParams(empresa_id, conversa_id)
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual", // Adicione isso para garantir
                to: numero,
                type: "text",
                text: {
                    preview_url: false,
                    body: mensagem
                }
            };
            const replyWhatsappMessageId = String(replyContext?.mensagem_whats_id || "").trim();
            if (replyWhatsappMessageId) {
                payload.context = {
                    message_id: replyWhatsappMessageId
                };
            }
            const response = await fetch(`https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${dados_whats.api_key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(`Erro ao enviar mensagem: ${JSON.stringify(data)}`);
            }
            await execute.execute_insert_mensagem_enviada(
                conversa_id,
                msg,
                data.messages[0].id,
                usuario_id,
                Boolean(replyContext?.mensagem_id),
                replyContext?.mensagem_id || null
            )
            emitChatMessageUpdate({
                empresa_id: empresa_id,
                conversa_id: conversa_id,
                origem: "whatsapp:send_text",
                pushBody: msg
            });
            return data;
        } catch (err) {
            console.error("Erro ao enviar mensagem automática:", err);
        }
    },

    sendWhatsappReaction: async (numero, conversa_id, empresa_id, mensagem_whats_id, emoji) => {
        try {
            const dados_whats = await getWhatsappSenderParams(empresa_id, conversa_id);
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: numero,
                type: "reaction",
                reaction: {
                    message_id: mensagem_whats_id,
                    emoji
                }
            };
            const response = await fetch(`https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${dados_whats.api_key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(`Erro ao enviar reacao: ${JSON.stringify(data)}`);
            }
            return data;
        } catch (err) {
            console.error("Erro ao enviar reacao:", err);
            throw err;
        }
    },

    sendWhatsappButtonMessage: async (
        numero,
        texto,
        link,
        conversa_id,
        empresa_id,
        usuario_id = null,
        displayText = "Avaliar atendimento"
    ) => {
        try {
            await executeAppSafety.execute_validar_conteudo_envio(empresa_id, texto);
            const dados_whats = await getWhatsappSenderParams(empresa_id, conversa_id);
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: numero,
                type: "interactive",
                interactive: {
                    type: "cta_url",
                    body: {
                        text: texto
                    },
                    action: {
                        name: "cta_url",
                        parameters: {
                            display_text: displayText,
                            url: link
                        }
                    }
                }
            };

            const response = await fetch(`https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${dados_whats.api_key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(`Erro ao enviar mensagem com botão: ${JSON.stringify(data)}`);
            }

            await execute.execute_insert_mensagem_enviada(conversa_id, texto, data.messages[0].id, usuario_id);
            emitChatMessageUpdate({
                empresa_id: empresa_id,
                conversa_id: conversa_id,
                origem: "whatsapp:send_button",
                pushBody: texto
            });
            return data;
        } catch (err) {
            console.error("Erro ao enviar mensagem com botão:", err);
        }
    },

    sendWhatsappImageByUrl: async (
        numero,
        imageUrl,
        caption,
        conversa_id,
        empresa_id,
        usuario_id = null
    ) => {
        try {
            await executeAppSafety.execute_validar_conteudo_envio(empresa_id, caption);
            const dados_whats = await getWhatsappSenderParams(empresa_id, conversa_id);
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: numero,
                type: "image",
                image: {
                    link: encodeURI(String(imageUrl || "").trim()),
                    ...(caption ? { caption: caption || "" } : {})
                }
            };

            const response = await fetch(`https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${dados_whats.api_key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(`Erro ao enviar imagem por URL: ${JSON.stringify(data)}`);
            }

            await execute.execute_insert_mensagem_enviada_media(
                conversa_id,
                caption || "",
                data.messages[0].id,
                String(imageUrl || "").trim(),
                "image",
                usuario_id
            );
            emitChatMessageUpdate({
                empresa_id: empresa_id,
                conversa_id: conversa_id,
                origem: "whatsapp:send_image_url",
                pushBody: caption || "Imagem enviada no atendimento."
            });
            return data;
        } catch (err) {
            console.error("Erro ao enviar imagem por URL:", err);
            throw err;
        }
    },

    sendWhatsappDocumentByUrl: async (
        numero,
        documentUrl,
        filename,
        caption,
        conversa_id,
        empresa_id,
        usuario_id = null
    ) => {
        try {
            await executeAppSafety.execute_validar_conteudo_envio(empresa_id, caption);
            const dados_whats = await getWhatsappSenderParams(empresa_id, conversa_id);
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: numero,
                type: "document",
                document: {
                    link: encodeURI(String(documentUrl || "").trim()),
                    ...(filename ? { filename: String(filename || "").trim() } : {}),
                    ...(caption ? { caption: caption || "" } : {})
                }
            };

            const response = await fetch(`https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${dados_whats.api_key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(`Erro ao enviar documento por URL: ${JSON.stringify(data)}`);
            }

            await execute.execute_insert_mensagem_enviada_media(
                conversa_id,
                caption || filename || "",
                data.messages[0].id,
                String(documentUrl || "").trim(),
                "document",
                usuario_id
            );
            emitChatMessageUpdate({
                empresa_id: empresa_id,
                conversa_id: conversa_id,
                origem: "whatsapp:send_document_url",
                pushBody: caption || filename || "Documento enviado no atendimento."
            });
            return data;
        } catch (err) {
            console.error("Erro ao enviar documento por URL:", err);
            throw err;
        }
    },

    sendWhatsappLocation: async (
        numero,
        locationPayload,
        conversa_id,
        empresa_id,
        usuario_id = null
    ) => {
        try {
            const dados_whats = await getWhatsappSenderParams(empresa_id, conversa_id);
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: numero,
                type: "location",
                location: locationPayload
            };

            const response = await fetch(`https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${dados_whats.api_key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(`Erro ao enviar localizacao: ${JSON.stringify(data)}`);
            }

            await execute.execute_insert_mensagem_enviada_media(
                conversa_id,
                buildLocationSummary(locationPayload),
                data.messages[0].id,
                stringifyStructuredWhatsappPayload(locationPayload),
                "location",
                usuario_id
            );
            emitChatMessageUpdate({
                empresa_id: empresa_id,
                conversa_id: conversa_id,
                origem: "whatsapp:send_location",
                pushBody: buildLocationSummary(locationPayload)
            });
            return data;
        } catch (err) {
            console.error("Erro ao enviar localizacao:", err);
            throw err;
        }
    },

    sendWhatsappContacts: async (
        numero,
        contacts,
        conversa_id,
        empresa_id,
        usuario_id = null
    ) => {
        try {
            const dados_whats = await getWhatsappSenderParams(empresa_id, conversa_id);
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: numero,
                type: "contacts",
                contacts
            };

            const response = await fetch(`https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${dados_whats.api_key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(`Erro ao enviar contato: ${JSON.stringify(data)}`);
            }

            await execute.execute_insert_mensagem_enviada_media(
                conversa_id,
                buildContactsSummary(contacts),
                data.messages[0].id,
                stringifyStructuredWhatsappPayload({ contacts }),
                "contacts",
                usuario_id
            );
            emitChatMessageUpdate({
                empresa_id: empresa_id,
                conversa_id: conversa_id,
                origem: "whatsapp:send_contacts",
                pushBody: buildContactsSummary(contacts)
            });
            return data;
        } catch (err) {
            console.error("Erro ao enviar contato:", err);
            throw err;
        }
    },

    downloadmidia: async (midia_id, empresa_id, conversa_id = null) => {
        const normalizedMediaId = String(midia_id || "").trim();
        const cacheKey = `${Number(empresa_id) || 0}:${normalizedMediaId}`;
        const cachedError = getCachedPermanentMetaMediaError(cacheKey);
        if (cachedError) throw cachedError;

        if (!/^\d+$/.test(normalizedMediaId)) {
            const message = "ID de midia da Meta invalido ou indisponivel.";
            cachePermanentMetaMediaError(cacheKey, message, { media_id: normalizedMediaId });
            throw createPermanentMetaMediaError(message, { media_id: normalizedMediaId });
        }

        const dados_whats = await getWhatsappSenderParams(empresa_id, conversa_id);

        console.log("[downloadmidia] consultando metadados na Meta", {
            empresa_id,
            conversa_id,
            midia_id,
            meta_phone_number_id: dados_whats.numero || null
        });

        // 1. Pegar metadados da mídia
        const metaResponse = await fetch(`https://graph.facebook.com/v25.0/${normalizedMediaId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${dados_whats.api_key}`
            }
        });
        const midia = await metaResponse.json();

        if (!metaResponse.ok || !midia?.url) {
            console.error("[downloadmidia] Meta nao retornou a URL da midia", {
                empresa_id,
                conversa_id,
                midia_id,
                meta_phone_number_id: dados_whats.numero || null,
                status: metaResponse.status,
                status_text: metaResponse.statusText || null,
                meta_error: midia?.error || midia || null
            });
            const metaMessage = String(midia?.error?.message || "").trim();
            const metaErrorCode = Number(midia?.error?.code || 0) || null;
            const metaErrorSubcode = Number(midia?.error?.error_subcode || 0) || null;
            const isPermanentInvalidId = metaResponse.status === 400 && metaErrorCode === 100;
            if (isPermanentInvalidId) {
                const message = metaMessage
                    ? `Meta nao disponibilizou a midia: ${metaMessage}`
                    : "A midia nao existe mais na Meta.";
                const details = {
                    media_id: normalizedMediaId,
                    meta_error_code: metaErrorCode,
                    meta_error_subcode: metaErrorSubcode,
                };
                cachePermanentMetaMediaError(cacheKey, message, details);
                throw createPermanentMetaMediaError(message, details);
            }
            throw new Error(
                metaMessage
                    ? `Meta nao disponibilizou a midia: ${metaMessage}`
                    : `Meta nao retornou a URL da midia (HTTP ${metaResponse.status}).`
            );
        }

        // 2. Baixar o arquivo (binário)
        const fileResponse = await fetch(midia.url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${dados_whats.api_key}`
            }
        });

        if (!fileResponse.ok) {
            const responseText = await fileResponse.text();
            console.error("[downloadmidia] falha ao baixar binario da Meta", {
                empresa_id,
                conversa_id,
                midia_id,
                meta_phone_number_id: dados_whats.numero || null,
                status: fileResponse.status,
                status_text: fileResponse.statusText || null,
                content_type: fileResponse.headers.get("content-type") || null,
                response: responseText.slice(0, 1000) || null
            });
            throw new Error(`Falha ao baixar o arquivo da Meta (HTTP ${fileResponse.status}).`);
        }

        const buffer = Buffer.from(await fileResponse.arrayBuffer());

        console.log("[downloadmidia] arquivo baixado da Meta", {
            empresa_id,
            conversa_id,
            midia_id,
            meta_phone_number_id: dados_whats.numero || null,
            mime_type: midia.mime_type || fileResponse.headers.get("content-type") || null,
            bytes: buffer.length
        });

        return { file: buffer, midia };
    },
    convertAudioBufferToMp3,

    sendmidia: async (
        numero,
        filePath,
        fileType,
        caption,
        conversa_id,
        empresa_id,
        options = {}
    ) => {
        const axios = require('axios');
        const FormData = require('form-data');
        const fs = require('fs');
        const path = require('path');
        const cleanupPaths = new Set([filePath]);
        let uploadFilePath = filePath;
        let mimeType = options?.mimeType || null;
        let originalname = options?.originalname || path.basename(filePath);

        try {
            if (fileType === "video") {
                uploadFilePath = await normalizeVideoForWhatsApp(filePath);
                cleanupPaths.add(uploadFilePath);
                mimeType = "video/mp4";
                originalname = `${path.parse(originalname).name || "video"}.mp4`;
            }

            const dados_whats = await getWhatsappSenderParams(empresa_id, conversa_id);
            const formData = new FormData();
            formData.append('file', fs.createReadStream(uploadFilePath), {
                filename: originalname,
                ...(mimeType ? { contentType: mimeType } : {})
            });
            formData.append('messaging_product', 'whatsapp');
            if (mimeType) {
                formData.append('type', mimeType);
            }

            const uploadResponse = await axios.post(
                `https://graph.facebook.com/v25.0/${dados_whats.numero}/media`,
                formData,
                {
                    headers: {
                        'Authorization': `Bearer ${dados_whats.api_key}`,
                        ...formData.getHeaders()
                    }
                }
            );
            const mediaId = uploadResponse.data.id;
            if (uploadResponse.status !== 200) {
                throw new Error(`Erro no upload da mídia: ${JSON.stringify(uploadResponse.data)}`);
            }

            // 2️⃣ Envio da mensagem de mídia usando o media_id
            const buildMediaPayload = (includeCaption = true) => (
                fileType === "audio" || fileType === "sticker"
                    ? { id: mediaId }
                    : {
                        id: mediaId,
                        ...(includeCaption && caption ? { caption: caption || "" } : {}),
                        ...(fileType === "document" && originalname
                            ? { filename: originalname }
                            : {})
                    }
            );
            const buildMessagePayload = (includeCaption = true) => ({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: numero,
                type: fileType,
                [fileType]: buildMediaPayload(includeCaption)
            });

            let data = null;
            try {
                const response = await fetch(`https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${dados_whats.api_key}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(buildMessagePayload(true))
                });

                data = await response.json();
                if (!response.ok) {
                    throw new Error(`Erro ao enviar mídia: ${JSON.stringify(data)}`);
                }
            } catch (error) {
                const canRetryWithoutCaption =
                    fileType === "video" &&
                    Boolean(caption) &&
                    isMetaInvalidParameterError(error);

                if (!canRetryWithoutCaption) {
                    throw error;
                }

                const retryResponse = await fetch(`https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${dados_whats.api_key}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(buildMessagePayload(false))
                });

                data = await retryResponse.json();
                if (!retryResponse.ok) {
                    throw new Error(`Erro ao enviar mídia: ${JSON.stringify(data)}`);
                }
            }

            await execute.execute_insert_mensagem_enviada_media(
                conversa_id,
                caption,
                data.messages[0].id,
                mediaId,
                fileType,
                options?.usuario_id ?? null
            );
            emitChatMessageUpdate({
                empresa_id: empresa_id,
                conversa_id: conversa_id,
                origem: "whatsapp:send_media",
                pushBody: caption || `Midia enviada (${fileType}).`
            });
            return data;
        } finally {
            cleanupPaths.forEach((currentPath) => {
                fs.unlink(currentPath, (err) => {
                    if (err && err.code !== 'ENOENT') {
                        console.error("Erro ao apagar arquivo local:", err.message);
                    }
                });
            });
        }
    },

    sendWhatsappVideoByUrl: async (
        numero,
        videoUrl,
        caption,
        conversa_id,
        empresa_id,
        usuario_id = null
    ) => {
        try {
            await executeAppSafety.execute_validar_conteudo_envio(empresa_id, caption);
            const dados_whats = await getWhatsappSenderParams(empresa_id, conversa_id);
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: numero,
                type: "video",
                video: {
                    link: encodeURI(String(videoUrl || "").trim()),
                    ...(caption ? { caption: String(caption) } : {})
                }
            };
            const response = await fetch(`https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${dados_whats.api_key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(`Erro ao enviar video por URL: ${JSON.stringify(data)}`);

            await execute.execute_insert_mensagem_enviada_media(
                conversa_id,
                caption || "",
                data.messages[0].id,
                String(videoUrl || "").trim(),
                "video",
                usuario_id
            );
            emitChatMessageUpdate({
                empresa_id,
                conversa_id,
                origem: "whatsapp:send_video_url",
                pushBody: caption || "Video enviado no atendimento."
            });
            return data;
        } catch (err) {
            console.error("Erro ao enviar video por URL:", err);
            throw err;
        }
    },

    sendAudioByUrl: async (numero, audioUrl, conversa_id, empresa_id, usuario_id = null, options = {}) => {
        const parsedUrl = new URL(audioUrl);
        const sourceExtension = path.extname(parsedUrl.pathname).replace(/[^.a-z0-9]/gi, '') || '.bin';
        const tempFilePath = path.join(
            os.tmpdir(),
            `quick-audio-${empresa_id}-${conversa_id}-${Date.now()}${sourceExtension}`
        );

        try {
            const response = await axios.get(audioUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                maxContentLength: 16 * 1024 * 1024,
                maxBodyLength: 16 * 1024 * 1024
            });
            const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
            if (contentType && !contentType.startsWith('audio/') && contentType !== 'application/octet-stream') {
                throw new Error('A URL informada nao retornou um arquivo de audio valido.');
            }
            fs.writeFileSync(tempFilePath, Buffer.from(response.data));
            return await module.exports.sendAudio(
                numero,
                tempFilePath,
                conversa_id,
                options?.messageLabel || 'audio',
                empresa_id,
                usuario_id,
                options
            );
        } catch (error) {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            throw error;
        }
    },

    sendAudio: async (numero, inputFilePath, conversa_id, msg = 'audio', empresa_id, usuario_id = null, options = {}) => {
        let fileToSend = inputFilePath;
        let uploadFilename = `audio-${Date.now()}.mp3`;
        let uploadContentType = 'audio/mpeg';
        const generatedFiles = new Set();

        try {

            const dados_whats = await getWhatsappSenderParams(empresa_id, conversa_id);
            const axios = require('axios');
            const FormData = require('form-data');
            const fs = require('fs');
            const durationSeconds = parsePositiveNumber(options?.durationSeconds, 0);

            // iPhone tem sido o cliente mais sensível; para maximizar compatibilidade,
            // normalizamos o áudio do chat para MP3 antes do upload para a Meta.
            fileToSend = await convertToMp3File(inputFilePath, {
                durationSeconds,
                audioBitrateKbps: 128
            });
            if (fileToSend !== inputFilePath) {
                generatedFiles.add(fileToSend);
            }

            let stats = fs.statSync(fileToSend);
            let audioMetadata = await probeMediaStreams(fileToSend).catch(() => ({}));
            let primaryAudioStream = readPrimaryAudioStream(audioMetadata);
            uploadFilename = `audio-${Date.now()}.mp3`;
            uploadContentType = 'audio/mpeg';

            if (stats.size > 16 * 1024 * 1024) {
                throw new Error('Arquivo de áudio maior que 16MB.');
            }

            // upload da mídia
            const formData = new FormData();
            formData.append('file', fs.createReadStream(fileToSend), {
                filename: uploadFilename,
                contentType: uploadContentType
            });

            formData.append('messaging_product', 'whatsapp');
            formData.append('type', 'audio/mpeg');

            const uploadResponse = await axios.post(
                `https://graph.facebook.com/v25.0/${dados_whats.numero}/media`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${dados_whats.api_key}`,
                        ...formData.getHeaders()
                    }
                }
            );

            const mediaId = uploadResponse.data.id;

            // envia mensagem de áudio
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: numero,
                type: "audio",
                audio: {
                    id: mediaId
                }
            };

            const response = await fetch(
                `https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${dados_whats.api_key}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(`Erro ao enviar áudio: ${JSON.stringify(data)}`);
            }

            console.log("[whatsapp:send_audio] audio normalizado para compatibilidade:", {
                conversa_id,
                empresa_id,
                codec: String(primaryAudioStream?.codec_name || "").toLowerCase() || null,
                channels: Number(primaryAudioStream?.channels || 0) || null,
                sample_rate: Number(primaryAudioStream?.sample_rate || 0) || null,
                upload_content_type: uploadContentType,
                upload_filename: uploadFilename,
                size_bytes: stats.size || null
            });

            // salva no banco
            await execute.execute_insert_mensagem_enviada_media(
                conversa_id,
                msg,
                data.messages[0].id,
                mediaId,
                'audio',
                usuario_id
            );
            emitChatMessageUpdate({
                empresa_id: empresa_id,
                conversa_id: conversa_id,
                origem: "whatsapp:send_audio",
                pushBody: msg || "Audio enviado no atendimento."
            });

            return data;

        } catch (err) {

            console.error("Erro ao enviar áudio:", err);
            throw err;
        } finally {
            const fs = require('fs');
            const filesToDelete = [inputFilePath].filter(Boolean);
            generatedFiles.forEach((filePath) => filesToDelete.push(filePath));
            filesToDelete.forEach((file) => {
                fs.unlink(file, (unlinkError) => {
                    if (unlinkError && unlinkError.code !== 'ENOENT') {
                        console.error("Erro ao apagar arquivo de áudio local:", unlinkError.message);
                    }
                });
            });
        }
    },

    sendWhatsappTemplateMessage: async (
        numero,
        templateData,
        conversa_id,
        empresa_id,
        meta_param_id = null,
        usuario_id = null
    ) => {
        try {
            const dados_whats = await getWhatsappSenderParams(
                empresa_id,
                conversa_id,
                meta_param_id
            );
            console.log(dados_whats)
            const templateName = templateData.name || templateData.template_name;
            const languageCode =
                templateData.language?.code ||
                templateData.language_code ||
                templateData.language ||
                'pt_BR';

            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: numero,
                type: "template",
                template: {
                    name: templateName,
                    language: {
                        code: languageCode
                    }
                }
            };

            const components = buildTemplateComponents(templateData);
            if (components.length) {
                payload.template.components = components;
            }

            const response = await fetch(
                `https://graph.facebook.com/v25.0/${dados_whats.numero}/messages`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${dados_whats.api_key}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();
            if (!response.ok) {
                throw new Error(`Erro ao enviar template: ${JSON.stringify(data)}`);
            }

            if (conversa_id) {
                const previewMessage =
                    templateData.preview_message ||
                    templateData.mensagem ||
                    `Template enviado: ${templateName}`;

                await execute.execute_insert_mensagem_enviada(
                    conversa_id,
                    previewMessage,
                    data.messages[0].id,
                    usuario_id
                );
                emitChatMessageUpdate({
                    empresa_id: empresa_id,
                    conversa_id: conversa_id,
                    origem: "whatsapp:send_template",
                    pushBody: previewMessage
                });
            }

            return {
                ...data,
                request_payload: payload
            };
        } catch (err) {
            console.error("Erro ao enviar template WhatsApp:", err);
            throw err;
        }
    },

    getTemplates: async (context) => {
        try {
            const empresa_id =
                typeof context === "object" && context !== null
                    ? Number(context.empresa_id)
                    : Number(context);
            const meta_param_id =
                typeof context === "object" && context !== null
                    ? Number(context.meta_param_id)
                    : null;
            const conversa_id =
                typeof context === "object" && context !== null
                    ? Number(context.conversa_id)
                    : null;

            const dados_whats = await getWhatsappSenderParams({
                empresa_id,
                conversa_id,
                meta_param_id
            });
            if (!dados_whats) {
                return {
                    total: 0,
                    templates: []
                };
            }

            const accessToken = dados_whats.api_key || getMetaSystemAccessToken();
            if (!accessToken) {
                throw new Error("META_ACCESS_TOKEN nao configurado no .env.");
            }

            if (!dados_whats.whatsapp_account_id) {
                throw new Error("WABA nao configurada para o numero Meta selecionado.");
            }

            const rawTemplates = await fetchAllWhatsAppTemplates(
                dados_whats.whatsapp_account_id,
                accessToken
            );
            const normalizedTemplates = rawTemplates.map(normalizeTemplate);
            const archivedRows = await executeMeta.execute_list_template_meta_arquivados(
                dados_whats.empresa_id || empresa_id,
                dados_whats.id || meta_param_id
            );
            const archivedTemplateIds = new Set(
                (archivedRows || []).map((item) => String(item.template_id || "").trim())
            );
            const templates = normalizedTemplates.filter(
                (template) => !archivedTemplateIds.has(String(template.id || "").trim())
            );
            const savedHeaderImages = await utils.listSavedTemplateHeaderImages({
                empresa_id: dados_whats.empresa_id || empresa_id,
                meta_param_id: dados_whats.id || meta_param_id
            });
            const savedHeaderImagesMap = new Map(
                savedHeaderImages.map((item) => [
                    buildTemplateHeaderMediaLookupKey(item.template_name, item.language_code),
                    item
                ])
            );

            templates.forEach((template) => {
                const lookupKey = buildTemplateHeaderMediaLookupKey(template.name, template.language);
                template.saved_header_media = savedHeaderImagesMap.get(lookupKey) || null;
            });

            return {
                total: templates.length,
                templates
            };
        } catch (err) {
            const metaError = err?.response?.data?.error;
            console.error("Erro ao carregar templates:", {
                status: err?.response?.status || null,
                code: metaError?.code || null,
                subcode: metaError?.error_subcode || null,
                message: metaError?.message || err?.message || "Erro desconhecido",
            });
            throw new Error(
                metaError?.message || "Nao foi possivel carregar os templates da conta Meta selecionada."
            );
        }
    },


    getCampaigns: async (empresaId, act_adAccountId, filtro, inicio, fim) => {
        const accessToken = await getMetaAdsAccessTokenForAccount(empresaId, act_adAccountId);
        const metaClient = createMetaClient(accessToken);

        const insightsField = buildInsightsField(inicio, fim)
        const params = {
            fields: `
      id,name,status,effective_status,start_time,
      budget_remaining,daily_budget,
      configured_status,objective,created_time,${insightsField}
    `
        }

        if (filtro) {
            params.effective_status = ['ACTIVE']
        }

        const campaignsResp = await metaClient.get(
            `${act_adAccountId}/campaigns`,
            { params: { ...params } }
        )

        const campaigns = campaignsResp.data?.data || []

        const campaignsWithInsights = await Promise.all(
            campaigns.map(async (campaign) => {

                const insightsResp = await metaClient.get(
                    `${campaign.id}/insights`,
                    {
                        params: {
                            fields: 'spend,impressions',
                            time_increment: 1,
                            date_preset: 'last_7d'
                        }
                    }
                )

                const filledInsights = fillMissingDays(
                    insightsResp.data?.data || [],
                    7
                )

                return {
                    ...campaign,
                    week_insights: filledInsights
                }
            })

        )

        const insightsParams = {
            fields: 'spend,clicks,reach,cpc,cpm,cpp'
        };

        if (inicio && fim) {
            insightsParams.time_range = {
                since: inicio,
                until: fim
            };
        } else {
            insightsParams.date_preset = 'maximum';
        }

        const spend = await metaClient.get(
            `${act_adAccountId}/insights`,
            { params: { ...insightsParams } }
        )
        return { data: campaignsWithInsights, total_spend: spend.data?.data?.[0] || null }
    },


    getAds: async (empresaId, adAccountId, campaing) => {
        const accessToken = await getMetaAdsAccessTokenForAccount(empresaId, adAccountId);
        const metaClient = createMetaClient(accessToken);

                // 1️⃣ Buscar anúncios
                const adsResponse = await metaClient.get(
                        `${adAccountId}/ads`,
                        {
                                params: {
                                        fields: 'id,name,status,creative{id,instagram_permalink_url}'
                                }
                        }
                )

                const ads = adsResponse.data?.data || []

                // 2️⃣ Buscar insights para cada ad
                const adsWithInsights = await Promise.all(
                        ads.map(async (ad) => {
                                const insightsResponse = await metaClient.get(
                                        `${ad.id}/insights`,
                                        {
                                                params: {
                                                        fields: 'campaign_name,ad_name,spend,impressions,reach,cpc,ctr,cpm,actions,action_values'
                                                }
                                        }
                                )

                                return {
                                        ...ad,
                                        insights: insightsResponse.data?.data || []
                                }
                        })
                )

		return adsWithInsights
	},


        getCampaignsMinusOne: async (campaignId, inicio, fim) => {
                const metaClient = createMetaClient(process.env.META_ADS_ACESS_TOKEN);
                if (!process.env.META_ADS_ACESS_TOKEN) {
                        throw new Error('META_ADS_ACESS_TOKEN não configurado.')
                }

                const campaignResponse = await metaClient.get(
                        `${campaignId}`,
                        {
                                params: {
                                        fields: 'id,name,status,effective_status,objective,start_time,created_time,budget_remaining,daily_budget,configured_status'
                                }
                        }
                )

                const campaign = campaignResponse.data

                // 🔹 insights do D-1 (ou período selecionado)
                const insightsResponse = await metaClient.get(
                        `${campaignId}/insights`,
                        {
                                params: {
                                        time_range: { since: inicio, until: fim },
                                        level: 'campaign',
                                        fields: 'spend,impressions,clicks,actions,action_values'
                                }
                        }
                )

                const insight = insightsResponse.data?.data?.[0]
		// Se não houver insight para o dia, retornamos 0/null para as métricas, mas mantemos dados da campanha

		const response = {
			campaign_id: campaign.id,
			campaign_name: campaign.name,
			status: campaign.status,
			effective_status: campaign.effective_status,
			configured_status: campaign.configured_status,
			objective: campaign.objective,
			start_time: campaign.start_time,
			created_time: campaign.created_time,
			budget_remaining: campaign.budget_remaining,
			daily_budget: campaign.daily_budget,

			// Dados do Filtro
			data_inicio: inicio,
			data_fim: fim,

			// Métricas
			spend: insight ? Number(insight.spend) : 0,
			impressions: insight ? Number(insight.impressions) : 0,
			clicks: insight ? Number(insight.clicks) : 0,
			actions: insight && insight.actions ? insight.actions : []
		}
		return response;
	}


}

module.exports = utils
