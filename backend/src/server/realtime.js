const crypto = require("crypto");
const { Client } = require("pg");
const { postgres, getPoolConfig } = require("./connect");

let ioInstance = null;
let initialized = false;
let commercialListener = null;
let commercialListenerReconnectTimer = null;
const realtimeInstanceId = crypto.randomUUID();
const COMMERCIAL_NOTIFICATION_CHANNEL = "commercial_integration_update";
const realtimeDebug = String(process.env.REALTIME_DEBUG || "").trim() === "1";
const EXPO_PUSH_URL = String(
  process.env.EXPO_PUSH_URL || "https://exp.host/--/api/v2/push/send"
).trim();
const EXPO_MAX_BATCH_SIZE = 100;

let executePushInstance = null;
let executeAppSafetyInstance = null;

function getExecutePush() {
  if (!executePushInstance) {
    executePushInstance = require("../services/execute_push");
  }
  return executePushInstance;
}

function getExecuteAppSafety() {
  if (!executeAppSafetyInstance) {
    executeAppSafetyInstance = require("../services/execute_app_safety");
  }
  return executeAppSafetyInstance;
}

function toInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function truncateText(value, maxLength) {
  const normalized = normalizeText(value).replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function chunkArray(items = [], chunkSize = EXPO_MAX_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function buildPushTitle(title, context = null) {
  const explicitTitle = truncateText(title, 80);
  if (explicitTitle) return explicitTitle;

  const customerName = truncateText(context?.cliente_nome, 50);
  if (customerName) {
    return `Nova mensagem de ${customerName}`;
  }

  return "Nova mensagem no atendimento";
}

function buildPushBody(body) {
  const explicitBody = truncateText(body, 180);
  if (explicitBody) return explicitBody;
  return "Voce recebeu uma nova atualizacao no atendimento.";
}

async function notifyPushMessage({
  empresa_id,
  conversa_id,
  usuario_ids = [],
  title,
  body,
} = {}) {
  try {
    const empresaId = toInt(empresa_id);
    const conversaId = toInt(conversa_id);
    if (!empresaId) {
      return null;
    }

    if (
      conversaId &&
      await getExecuteAppSafety().execute_conversa_cliente_bloqueado(conversaId)
    ) {
      if (realtimeDebug) {
        console.log("[realtime] push skip: cliente bloqueado", {
          empresa_id: empresaId,
          conversa_id: conversaId,
        });
      }
      return { sent: 0, target_user_ids: [], blocked_customer: true };
    }

    const executePush = getExecutePush();
    const targetUserIds = await executePush.execute_list_push_target_user_ids({
      empresa_id: empresaId,
      conversa_id: conversaId,
      usuario_ids,
    });

    if (!targetUserIds.length) {
      if (realtimeDebug) {
        console.log("[realtime] push skip: nenhum usuario alvo", {
          empresa_id: empresaId,
          conversa_id: conversaId,
        });
      }
      return {
        sent: 0,
        target_user_ids: [],
      };
    }

    const tokenRows = await executePush.execute_list_active_push_tokens_by_users({
      empresa_id: empresaId,
      usuario_ids: targetUserIds,
    });

    const uniqueTokens = [];
    const seenTokens = new Set();
    for (const row of tokenRows) {
      const token = normalizeText(row?.expo_push_token);
      if (!token || seenTokens.has(token)) continue;
      seenTokens.add(token);
      uniqueTokens.push({
        token,
        usuario_id: toInt(row?.usuario_id),
      });
    }

    if (!uniqueTokens.length) {
      if (realtimeDebug) {
        console.log("[realtime] push skip: nenhum token ativo", {
          empresa_id: empresaId,
          conversa_id: conversaId,
          usuarios: targetUserIds,
        });
      }
      return {
        sent: 0,
        target_user_ids: targetUserIds,
      };
    }

    const context = conversaId
      ? await executePush.execute_get_push_dispatch_context(conversaId)
      : null;

    const payloadTitle = buildPushTitle(title, context);
    const payloadBody = buildPushBody(body);
    const messagePayloads = uniqueTokens.map((item) => ({
      to: item.token,
      title: payloadTitle,
      body: payloadBody,
      sound: "default",
      data: {
        conversa_id: conversaId,
        empresa_id: empresaId,
      },
    }));

    const invalidTokens = new Set();
    let sent = 0;

    for (const batch of chunkArray(messagePayloads, EXPO_MAX_BATCH_SIZE)) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });

      const responseJson = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("[realtime] erro ao enviar push Expo:", {
          status: response.status,
          body: responseJson,
        });
        continue;
      }

      const results = Array.isArray(responseJson?.data)
        ? responseJson.data
        : [];

      sent += batch.length;

      results.forEach((result, index) => {
        const currentMessage = batch[index];
        const errorCode = String(result?.details?.error || "").trim();
        if (
          result?.status === "error" &&
          currentMessage?.to &&
          (errorCode === "DeviceNotRegistered" ||
            /device.*not.*registered/i.test(String(result?.message || "")))
        ) {
          invalidTokens.add(currentMessage.to);
        }
      });
    }

    if (invalidTokens.size > 0) {
      await executePush.execute_deactivate_push_tokens_by_values(
        Array.from(invalidTokens)
      );
    }

    console.log("[realtime] push enviado", {
      empresa_id: empresaId,
      conversa_id: conversaId,
      usuarios: targetUserIds,
      total_tokens: uniqueTokens.length,
      invalid_tokens: invalidTokens.size,
    });

    return {
      sent,
      target_user_ids: targetUserIds,
      total_tokens: uniqueTokens.length,
    };
  } catch (error) {
    console.error("[realtime] falha no notifyPushMessage:", error);
    return null;
  }
}

function roomEmpresa(empresaId) {
  return `empresa:${empresaId}`;
}

function roomConversa(conversaId) {
  return `conversa:${conversaId}`;
}

function emitCommercialIntegrationUpdate(payload) {
  const empresaId = toInt(payload?.empresa_id);
  if (!ioInstance || !empresaId) return null;

  ioInstance
    .to(roomEmpresa(empresaId))
    .emit("commercial:integration-update", payload);
  console.log("[realtime] emit commercial:integration-update", payload);
  return payload;
}

function scheduleCommercialListenerReconnect() {
  if (commercialListenerReconnectTimer) return;
  commercialListenerReconnectTimer = setTimeout(() => {
    commercialListenerReconnectTimer = null;
    void startCommercialNotificationListener();
  }, 5000);
  commercialListenerReconnectTimer.unref?.();
}

async function startCommercialNotificationListener() {
  if (commercialListener) return;

  const client = new Client({
    ...getPoolConfig(),
    application_name: `${process.env.DB_APPLICATION_NAME || "orbita_crm_api"}_realtime`,
  });
  commercialListener = client;

  const handleDisconnect = (error) => {
    if (commercialListener !== client) return;
    commercialListener = null;
    console.error("[realtime] canal comercial PostgreSQL desconectado:", error?.message || error);
    scheduleCommercialListenerReconnect();
  };

  client.once("error", handleDisconnect);
  client.once("end", () => handleDisconnect(new Error("conexao encerrada")));
  client.on("notification", (message) => {
    if (message.channel !== COMMERCIAL_NOTIFICATION_CHANNEL || !message.payload) return;
    try {
      const envelope = JSON.parse(message.payload);
      if (envelope.publisher_id === realtimeInstanceId) return;
      emitCommercialIntegrationUpdate(envelope.payload);
    } catch (error) {
      console.error("[realtime] notificacao comercial invalida:", error.message);
    }
  });

  try {
    await client.connect();
    await client.query(`LISTEN ${COMMERCIAL_NOTIFICATION_CHANNEL}`);
    console.log("[realtime] canal comercial PostgreSQL conectado");
  } catch (error) {
    if (commercialListener === client) commercialListener = null;
    client.end().catch(() => undefined);
    console.error("[realtime] falha ao conectar canal comercial PostgreSQL:", error.message);
    scheduleCommercialListenerReconnect();
  }
}

function configureRealtime(io) {
  ioInstance = io;
  if (!ioInstance || initialized) return;
  initialized = true;
  void startCommercialNotificationListener();

  const security = require("../security/cypher");
  ioInstance.use((socket, next) => {
    const token = String(socket.handshake.auth?.token || "").trim();
    const auth = security.verifySessionToken(token);
    if (!auth) return next(new Error("Sessao invalida ou expirada."));
    socket.data.auth = auth;
    return next();
  });

  ioInstance.on("connection", (socket) => {
    console.log("[realtime] client connected", socket.id);

    socket.on("join_empresa", (payload = {}) => {
      const empresaId = toInt(socket.data.auth?.empresa_id);
      if (!empresaId) return;
      socket.join(roomEmpresa(empresaId));
      console.log("[realtime] join_empresa", { socket_id: socket.id, empresa_id: empresaId });
    });

    socket.on("leave_empresa", (payload = {}) => {
      const empresaId = toInt(socket.data.auth?.empresa_id);
      if (!empresaId) return;
      socket.leave(roomEmpresa(empresaId));
      console.log("[realtime] leave_empresa", { socket_id: socket.id, empresa_id: empresaId });
    });

    socket.on("join_conversa", async (payload = {}) => {
      const conversaId = toInt(payload.conversa_id);
      if (!conversaId) return;
      const empresaId = toInt(socket.data.auth?.empresa_id);
      const access = await postgres.query(
        `select 1 from cliente_conversa_whats where id = $1 and empresa_id = $2 limit 1`,
        [conversaId, empresaId]
      ).catch(() => ({ rows: [] }));
      if (!access.rows.length) return;
      socket.join(roomConversa(conversaId));
      console.log("[realtime] join_conversa", { socket_id: socket.id, conversa_id: conversaId });
    });

    socket.on("leave_conversa", (payload = {}) => {
      const conversaId = toInt(payload.conversa_id);
      if (!conversaId) return;
      socket.leave(roomConversa(conversaId));
      console.log("[realtime] leave_conversa", { socket_id: socket.id, conversa_id: conversaId });
    });

    socket.on("disconnect", (reason) => {
      console.log("[realtime] client disconnected", { socket_id: socket.id, reason });
    });
  });
}

function notifyChatUpdate({
  empresa_id,
  conversa_id,
  tipo = "message",
  origem = "app",
} = {}) {
  if (!ioInstance) {
    if (realtimeDebug) {
      console.log("[realtime] skip emit: io indisponivel");
    }
    return null;
  }

  const empresaId = toInt(empresa_id);
  const conversaId = toInt(conversa_id);
  if (!empresaId && !conversaId) return null;

  const emittedAt = new Date().toISOString();
  const payload = {
    event_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo,
    origem,
    empresa_id: empresaId,
    conversa_id: conversaId,
    emitted_at: emittedAt,
    timestamp: emittedAt,
  };

  if (empresaId) {
    ioInstance.to(roomEmpresa(empresaId)).emit("chat:update", payload);
  }
  if (conversaId) {
    ioInstance.to(roomConversa(conversaId)).emit("chat:update", payload);
  }

  console.log("[realtime] emit chat:update", payload);
  return payload;
}

function notifyCommercialIntegrationUpdate({
  empresa_id,
  tipo,
  plataforma,
  cliente_nome,
  produto_nome,
  transacao_id,
} = {}) {
  if (!ioInstance) return null;

  const empresaId = toInt(empresa_id);
  const normalizedType = String(tipo || "").trim().toLowerCase();
  if (!empresaId || !["sale", "abandoned_cart"].includes(normalizedType)) {
    return null;
  }

  const emittedAt = new Date().toISOString();
  const payload = {
    event_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo: normalizedType,
    plataforma: String(plataforma || "integracao").trim().toLowerCase(),
    empresa_id: empresaId,
    cliente_nome: String(cliente_nome || "").trim() || null,
    produto_nome: String(produto_nome || "").trim() || null,
    transacao_id: String(transacao_id || "").trim() || null,
    emitted_at: emittedAt,
  };

  emitCommercialIntegrationUpdate(payload);
  postgres
    .query("select pg_notify($1, $2)", [
      COMMERCIAL_NOTIFICATION_CHANNEL,
      JSON.stringify({ publisher_id: realtimeInstanceId, payload }),
    ])
    .catch((error) => {
      console.error("[realtime] falha ao publicar notificacao comercial:", error.message);
    });
  return payload;
}

module.exports = {
  configureRealtime,
  notifyCommercialIntegrationUpdate,
  notifyChatUpdate,
  notifyPushMessage,
};
