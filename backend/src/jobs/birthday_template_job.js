const { postgres } = require("../server/connect");
const executeUser = require("../services/execute_user");
const executeMeta = require("../services/execute_meta");
const utils = require("../utils/templates");
const {
  buildTemplateChatPayload,
  buildTemplateDispatchContext,
  buildTemplatePreviewMessage,
  getMetaParametrosOrFail,
  resolveTemplateDispatchPayloadForRecipient,
  validateMetaIntegrationReady,
} = require("../functions/function_meta");

const JOB_TIMEZONE = "America/Sao_Paulo";
const JOB_LOCK_KEY = 982451653;
const JOB_INTERVAL_MS = Math.max(
  Number(process.env.WHATSAPP_BIRTHDAY_TEMPLATE_JOB_INTERVAL_MS || 60000) || 60000,
  30000
);
const JOB_ENABLED = String(
  process.env.WHATSAPP_BIRTHDAY_TEMPLATE_JOB_ENABLED || "true"
)
  .trim()
  .toLowerCase() !== "false";

let intervalRef = null;
let isRunning = false;

function getTimeZoneParts(date = new Date(), timeZone = JOB_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce((acc, item) => {
    if (item.type !== "literal") {
      acc[item.type] = item.value;
    }
    return acc;
  }, {});

  const year = Number(parts.year || 0);
  const month = Number(parts.month || 0);
  const day = Number(parts.day || 0);
  const hour = Number(parts.hour || 0);
  const minute = Number(parts.minute || 0);
  const second = Number(parts.second || 0);

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateIso: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`,
  };
}

function normalizeScheduledTime(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "09:00:00";
  }

  const match = normalized.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return "09:00:00";
  }

  return `${match[1]}:${match[2]}:${match[3] || "00"}`;
}

function timeToMinutes(value) {
  const normalized = normalizeScheduledTime(value);
  const [hour, minute] = normalized.split(":").map((item) => Number(item));
  return hour * 60 + minute;
}

function isBirthdayConfigDue(config, nowParts) {
  const currentMinutes = Number(nowParts.hour) * 60 + Number(nowParts.minute);
  return timeToMinutes(config?.horario) <= currentMinutes;
}

function normalizeRecipientPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

async function registerBirthdayDispatchHistory({
  empresaId,
  empresaMetaParamId,
  templateId,
  templateName,
  templateLanguage,
  recipient,
  sentAt,
  success,
  response = null,
  error = null,
  previewMessage = null,
  templateChatPayload = null,
  referenceDate,
}) {
  try {
    await executeMeta.execute_insert_template_dispatch_batch_item_history({
      disparo_lote_id: null,
      empresa_id: empresaId,
      empresa_meta_param_id: empresaMetaParamId,
      cliente_id: recipient.cliente_id || null,
      template_id: templateId,
      template_name: templateName,
      template_language: templateLanguage || null,
      numero_original: recipient.telefone || null,
      numero_normalizado: normalizeRecipientPhone(recipient.telefone),
      contato_nome: recipient.contato_nome || null,
      email: recipient.email || null,
      conversa_id: recipient.conversa_id || null,
      message_id: response?.messages?.[0]?.id || null,
      message_status: response?.messages?.[0]?.message_status || null,
      sucesso: Boolean(success),
      custo_unitario: 0,
      valor_cobrado: 0,
      enviado_em: sentAt || new Date(),
      recebido_em: null,
      erro_em: success ? null : sentAt || new Date(),
      erro_mensagem: success ? null : error?.message || "Falha no disparo de aniversario.",
      erro_codigo: error?.code || null,
      erro_subcodigo: error?.subcode || null,
      erro_tipo: error?.type || null,
      metadata: {
        source: "birthday_template_automation",
        birthday_reference_date: referenceDate,
        request_payload: response?.request_payload || null,
        chat_preview_text: previewMessage || null,
        chat_preview_kind: "template",
        chat_template: templateChatPayload || null,
      },
    });
  } catch (historyError) {
    console.warn(
      "[birthday-template-job] nao foi possivel registrar historico local:",
      historyError?.message || historyError
    );
  }
}

async function processBirthdayConfig(config, nowParts) {
  const empresaId = Number(config?.empresa_id || 0);
  const empresaMetaParamId = Number(config?.empresa_meta_param_id || 0);

  if (!empresaId || !empresaMetaParamId) {
    return;
  }

  if (!isBirthdayConfigDue(config, nowParts)) {
    return;
  }

  const parametros = await getMetaParametrosOrFail({
    empresa_id: empresaId,
    meta_param_id: empresaMetaParamId,
  });
  const integrationError = validateMetaIntegrationReady(parametros);
  if (integrationError) {
    console.warn(
      `[birthday-template-job] configuracao ${empresaId}/${empresaMetaParamId} ignorada: ${integrationError}`
    );
    return;
  }

  const dispatchContext = await buildTemplateDispatchContext(
    { files: {} },
    {
      empresa_id: empresaId,
      meta_param_id: empresaMetaParamId,
      template_name: config.template_name,
      language: config.template_language || "pt_BR",
      header_image: config.header_image || null,
      header_document: config.header_document || null,
      header_video: config.header_video || null,
      header_parameters: config.header_parameters || [],
      body_parameters: config.body_parameters || [],
      button_parameters: config.button_parameters || [],
    },
    parametros
  );

  if (!dispatchContext?.selectedTemplate || !dispatchContext.validation?.valid) {
    const validationError =
      dispatchContext?.validation?.errors?.[0] ||
      "Template de aniversario invalido para o numero selecionado.";
    console.warn(
      `[birthday-template-job] configuracao ${empresaId}/${empresaMetaParamId} invalida: ${validationError}`
    );
    return;
  }

  const recipients = await executeUser.execute_list_clientes_aniversario_por_meta_numero({
    empresa_id: empresaId,
    empresa_meta_param_id: empresaMetaParamId,
    mes: nowParts.month,
    dia: nowParts.day,
  });

  if (!recipients.length) {
    return;
  }

  const templateId = String(
    dispatchContext.selectedTemplate?.id ||
      config.template_name ||
      "birthday_template"
  ).trim();

  for (const recipient of recipients) {
    const normalizedPhone = normalizeRecipientPhone(recipient.telefone);
    if (!normalizedPhone) {
      continue;
    }

    const sendLog = await executeUser.execute_claim_birthday_template_send_log({
      empresa_id: empresaId,
      empresa_meta_param_id: empresaMetaParamId,
      cliente_id: recipient.cliente_id,
      referencia_data: nowParts.dateIso,
      template_name: config.template_name,
      template_language: config.template_language || "pt_BR",
      numero: normalizedPhone,
      conversa_id: recipient.conversa_id || null,
      metadata: {
        source: "birthday_template_automation",
        selected_meta_number: config.display_phone_number || null,
      },
    });

    if (!sendLog?.id || !sendLog?.lock_token) {
      continue;
    }

    const sentAt = new Date();

    try {
      const resolvedDispatchContext = await resolveTemplateDispatchPayloadForRecipient({
        ...dispatchContext.templatePayload,
        cliente_id: recipient.cliente_id || null,
        contato_nome: recipient.contato_nome || null,
        contact_name: recipient.contato_nome || null,
        email: recipient.email || null,
        data_aniversario: recipient.data_aniversario || null,
      });

      if (resolvedDispatchContext.errors?.length) {
        throw new Error(
          resolvedDispatchContext.errors[0] ||
            "Nao foi possivel preencher os parametros do template de aniversario."
        );
      }

      const resolvedTemplatePayload = resolvedDispatchContext.templatePayload;
      const resolvedPreviewMessage = buildTemplatePreviewMessage(
        dispatchContext.selectedTemplate,
        resolvedTemplatePayload
      );
      const resolvedTemplateChatPayload = buildTemplateChatPayload(
        dispatchContext.selectedTemplate,
        resolvedTemplatePayload,
        dispatchContext.uploadedHeaderMedia
      );

      const response = await utils.sendWhatsappTemplateMessage(
        normalizedPhone,
        resolvedTemplatePayload,
        null,
        empresaId,
        empresaMetaParamId
      );

      await executeUser.execute_mark_birthday_template_send_log_sent({
        id: sendLog.id,
        lock_token: sendLog.lock_token,
        mensagem_whats_id: response?.messages?.[0]?.id || null,
        metadata: {
          message_status: response?.messages?.[0]?.message_status || null,
        },
      });

      await registerBirthdayDispatchHistory({
        empresaId,
        empresaMetaParamId,
        templateId,
        templateName: config.template_name,
        templateLanguage: config.template_language || "pt_BR",
        recipient,
        sentAt,
        success: true,
        response,
        previewMessage:
          resolvedPreviewMessage || dispatchContext.previewMessage || null,
        templateChatPayload:
          resolvedTemplateChatPayload || dispatchContext.templateChatPayload || null,
        referenceDate: nowParts.dateIso,
      });
    } catch (error) {
      await executeUser.execute_mark_birthday_template_send_log_error({
        id: sendLog.id,
        lock_token: sendLog.lock_token,
        erro_mensagem:
          error?.message || "Falha nao detalhada no disparo de aniversario.",
        metadata: {
          error_stack: error?.stack || null,
        },
      });

      await registerBirthdayDispatchHistory({
        empresaId,
        empresaMetaParamId,
        templateId,
        templateName: config.template_name,
        templateLanguage: config.template_language || "pt_BR",
        recipient,
        sentAt,
        success: false,
        error,
        previewMessage: dispatchContext.previewMessage || null,
        templateChatPayload: dispatchContext.templateChatPayload || null,
        referenceDate: nowParts.dateIso,
      });

      console.warn(
        `[birthday-template-job] falha ao enviar aniversario ${empresaId}/${empresaMetaParamId}/cliente ${recipient.cliente_id}:`,
        error?.message || error
      );
    }
  }
}

async function runBirthdayTemplateJobCycle(trigger = "interval") {
  if (!JOB_ENABLED || isRunning) {
    return;
  }

  isRunning = true;
  let client = null;
  let locked = false;

  try {
    client = await postgres.connect();
    const lockRet = await client.query(
      "select pg_try_advisory_lock($1) as locked",
      [JOB_LOCK_KEY]
    );
    locked = Boolean(lockRet.rows?.[0]?.locked);

    if (!locked) {
      return;
    }

    const nowParts = getTimeZoneParts(new Date(), JOB_TIMEZONE);
    const configs =
      await executeUser.execute_list_birthday_template_configs_for_processing();

    for (const config of configs) {
      await processBirthdayConfig(config, nowParts);
    }
  } catch (error) {
    console.error(
      `[birthday-template-job] erro no ciclo (${trigger}):`,
      error?.message || error
    );
  } finally {
    if (client && locked) {
      try {
        await client.query("select pg_advisory_unlock($1)", [JOB_LOCK_KEY]);
      } catch (unlockError) {
        console.warn(
          `[birthday-template-job] falha ao liberar lock (${trigger}):`,
          unlockError?.message || unlockError
        );
      }
    }
    if (client) {
      client.release();
    }
    isRunning = false;
  }
}

function startBirthdayTemplateAutomationJob() {
  if (!JOB_ENABLED || intervalRef) {
    return;
  }

  void runBirthdayTemplateJobCycle("startup");
  intervalRef = setInterval(() => {
    void runBirthdayTemplateJobCycle("interval");
  }, JOB_INTERVAL_MS);

  console.info(
    `[birthday-template-job] iniciado com intervalo de ${JOB_INTERVAL_MS}ms e lock distribuido no Postgres.`
  );
}

module.exports = {
  startBirthdayTemplateAutomationJob,
  runBirthdayTemplateJobCycle,
};
