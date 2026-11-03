const express = require("express");
const rota = express.Router();
const execute = require("../services/execute_webhook_cliente");
const executeMeta = require("../services/execute_meta");
const executeAtendimento = require("../services/execute_atendimento");
const security = require("../security/cypher");
const { notifyChatUpdate } = require("../server/realtime");
const { resolveWebhookBaseUrl } = require("../utils/webhook_url");

const N8N_WEBHOOK_PATH = "/webhook/n8n/c0a5f5d21725b4437d5a2df74902bf1d";
const CHAT_MANAGER_PERMISSION = "chat.manager";

function getWebhookCode(req) {
  return (
    req.headers["x-webhook-codigo"] ||
    req.headers["x-webhook-code"] ||
    req.body?.secret ||
    req.body?.codigo_validacao ||
    req.query?.codigo_validacao ||
    null
  );
}

function normalizePhoneLookupValue(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePositiveInt(value) {
  const normalized = Number(value || 0);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function normalizeN8nSendDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const pad = (input, size = 2) => String(input).padStart(size, "0");
  return [
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}.${pad(parsed.getMilliseconds(), 3)}`,
  ].join(" ");
}

function getClientePayload(body = {}) {
  if (body.cliente && typeof body.cliente === "object") {
    return body.cliente;
  }
  return body;
}

function buildMissingFields(cliente = {}) {
  const missing = [];
  if (!cliente.nome) missing.push("cliente.nome");
  if (!cliente.telefone) missing.push("cliente.telefone");
  if (!cliente.email) missing.push("cliente.email");
  return missing;
}

function parseBooleanLike(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "sim", "ativo", "ativar", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "nao", "não", "inativo", "desativar", "off"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

function normalizeN8nIaName(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return normalized.slice(0, 120);
}

function normalizePermissionList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function isAttendanceManager(user = null) {
  if (Boolean(user?.is_master)) return true;

  return [
    ...normalizePermissionList(user?.permissoes_customizadas),
    ...normalizePermissionList(user?.permissoes_plano),
  ].includes(CHAT_MANAGER_PERMISSION);
}

async function resolveN8nCompany(req) {
  const webhookCode = String(getWebhookCode(req) || "").trim();
  if (!webhookCode) {
    return { status: 400, message: "Secret da integracao nao informado." };
  }

  const empresaRows = await execute.execute_get_empresa_webhook_config_by_code(webhookCode);
  const empresa = empresaRows?.[0] || null;
  if (!empresa) {
    return { status: 403, message: "Secret da integracao invalido." };
  }
  if (!empresa.cliente_webhook_ativo) {
    return { status: 403, message: "Integracao N8N desativada para esta empresa." };
  }

  return { empresa };
}

async function validateN8nAttendanceTarget(empresaId, conversaId, usuarioId) {
  const [conversationRows, userRows] = await Promise.all([
    executeAtendimento.execute_get_conversa_contexto_acesso(conversaId),
    executeAtendimento.execute_get_usuario_atendimento_contexto(usuarioId, empresaId),
  ]);
  const conversa = conversationRows?.[0] || null;
  const usuario = userRows?.[0] || null;

  if (!conversa || Number(conversa.empresa_id) !== Number(empresaId)) {
    return { status: 404, message: "Atendimento nao encontrado nesta empresa." };
  }
  if (!usuario) {
    return { status: 404, message: "Usuario de destino nao encontrado ou inativo." };
  }

  if (!isAttendanceManager(usuario)) {
    const numberRows = await executeAtendimento.execute_list_usuario_meta_numero_ids(
      usuarioId,
      empresaId
    );
    const allowedMetaParamIds = new Set(
      (numberRows || [])
        .map((row) => Number(row?.empresa_meta_param_id))
        .filter((id) => Number.isInteger(id) && id > 0)
    );
    if (!allowedMetaParamIds.has(Number(conversa.empresa_meta_param_id))) {
      return {
        status: 409,
        message: "O usuario de destino nao possui acesso ao numero da Meta deste atendimento.",
      };
    }
  }

  return { conversa, usuario };
}

function resolveClienteWebhookBaseUrl(req) {
  return resolveWebhookBaseUrl(req, [
    process.env.CLIENTE_WEBHOOK_BASE_URL,
    process.env.WEBHOOK_BASE_URL,
  ]);
}

async function resolveEmpresaByWebhookPublicId(webhookPublicId) {
  const normalized = String(webhookPublicId || "").trim();
  if (!normalized) return null;
  const configRows = await execute.execute_get_empresa_webhook_config_by_public_id(normalized);
  return configRows[0] || null;
}

async function buildLegacyWebhookUrlHint(req, webhookPublicIdParam) {
  const maybeEmpresaId = Number(webhookPublicIdParam);
  if (!Number.isInteger(maybeEmpresaId) || maybeEmpresaId <= 0) return null;

  const ensuredRows = await execute.execute_ensure_empresa_webhook_secrets(maybeEmpresaId);
  const empresa = ensuredRows[0];
  if (!empresa) return null;

  const baseUrl = resolveClienteWebhookBaseUrl(req);
  return {
    empresa_id: empresa.id,
    webhook_public_id: empresa.cliente_webhook_public_id,
    webhook_url: `${baseUrl}/webhook/cliente/${empresa.cliente_webhook_public_id}`,
  };
}

rota.post("/cliente/:webhook_public_id", async (req, res, next) => {
  try {
    const webhookPublicIdParam = String(req.params.webhook_public_id || "").trim();
    if (webhookPublicIdParam.toLowerCase() === "configuracao") {
      return next();
    }

    const empresa = await resolveEmpresaByWebhookPublicId(webhookPublicIdParam);
    if (!empresa) {
      const legacyHint = await buildLegacyWebhookUrlHint(req, webhookPublicIdParam);
      if (legacyHint) {
        return res.status(410).json({
          success: false,
          message:
            "Webhook antigo detectado. Atualize a URL para o webhook_public_id informado em data.webhook_url.",
          data: legacyHint,
        });
      }

      return res.status(404).json({
        success: false,
        message: "Webhook nao encontrado.",
      });
    }

    const webhookCode = getWebhookCode(req);
    if (!webhookCode) {
      return res.status(400).json({
        success: false,
        message: "Codigo de validacao do webhook nao informado.",
      });
    }

    if (!empresa.cliente_webhook_ativo) {
      return res.status(403).json({
        success: false,
        message: "Webhook de cliente desativado para esta empresa.",
      });
    }

    if (String(empresa.cliente_webhook_codigo || "") !== String(webhookCode)) {
      return res.status(403).json({
        success: false,
        message: "Codigo de validacao do webhook invalido.",
      });
    }

    const cliente = getClientePayload(req.body);
    const utms = req.body?.utms;
    const tags = req.body?.tags;

    const missingFields = buildMissingFields(cliente);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Campos obrigatorios do cliente nao informados.",
        missing_fields: missingFields,
      });
    }

    if (!Array.isArray(utms)) {
      return res.status(400).json({
        success: false,
        message: "O campo utms deve ser um array.",
      });
    }

    if (!Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: "O campo tags deve ser um array.",
      });
    }

    const result = await execute.execute_processar_webhook_cliente({
      empresa_id: empresa.id,
      cliente: {
        nome: String(cliente.nome).trim(),
        telefone: String(cliente.telefone).trim(),
        email: String(cliente.email).trim(),
      },
      utms,
      tags,
    });

    return res.status(200).json({
      success: true,
      message: "Webhook processado com sucesso.",
      data: result,
    });
  } catch (error) {
    console.error("Erro na rota /webhook/cliente/:webhook_public_id:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno ao processar webhook de cliente.",
    });
  }
});

rota.post("/cliente/configuracao", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json({
        success: false,
        message: "Token invalido ou expirado.",
      });
    }

    const empresaId = Number(data.empresa_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.status(400).json({
        success: false,
        message: "empresa_id invalido.",
      });
    }

    const ensuredRows = await execute.execute_ensure_empresa_webhook_secrets(empresaId);
    const empresa = ensuredRows[0];
    if (!empresa) {
      return res.status(404).json({
        success: false,
        message: "Empresa nao encontrada ou inativa.",
      });
    }

    const baseUrl = resolveClienteWebhookBaseUrl(req);
    const webhookUrl = `${baseUrl}/webhook/cliente/${empresa.cliente_webhook_public_id}`;
    const usuariosWebhookUrl = `${webhookUrl}/usuarios`;
    const n8nWebhookUrl = `${baseUrl}${N8N_WEBHOOK_PATH}`;

    return res.status(200).json({
      success: true,
      message: "",
      data: {
        empresa_id: empresa.id,
        webhook_public_id: empresa.cliente_webhook_public_id,
        webhook_url: webhookUrl,
        webhook_metodo: "POST",
        webhook_ativo: empresa.cliente_webhook_ativo,
        webhook_codigo_validacao: empresa.cliente_webhook_codigo,
        endpoints: [
          {
            id: "clientes_upsert",
            metodo: "POST",
            titulo: "Criar ou atualizar cliente",
            descricao: "Cadastra um cliente ou atualiza seus dados, tags e UTMs pelo telefone.",
            url: webhookUrl,
          },
          {
            id: "usuarios_listar",
            metodo: "GET",
            titulo: "Consultar usuários",
            descricao: "Lista os usuários ativos da empresa com id, nome e email.",
            url: usuariosWebhookUrl,
          },
        ],
        n8n_ia_nome: empresa.n8n_ia_nome || "n8n IA",
        n8n_webhook_url: n8nWebhookUrl,
        n8n_webhook_metodo: "POST",
        n8n_webhook_secret_field: "secret",
        n8n_webhook_header_validacao: "x-webhook-codigo",
        n8n_endpoints: [
          {
            id: "n8n_mensagem",
            metodo: "POST",
            titulo: "Registrar mensagem da IA",
            descricao: "Registra na conversa aberta uma mensagem enviada pelo fluxo do N8N.",
            url: n8nWebhookUrl,
          },
          {
            id: "n8n_atribuir_atendimento",
            metodo: "POST",
            titulo: "Atribuir atendimento aguardando",
            descricao: "Atribui uma conversa da fila a um usuario ativo sem iniciar o atendimento.",
            url: `${n8nWebhookUrl}/atribuir_atendimento`,
          },
          {
            id: "n8n_transferir_atendimento",
            metodo: "POST",
            titulo: "Transferir atendimento ativo",
            descricao: "Transfere uma conversa em atendimento para outro usuario ativo.",
            url: `${n8nWebhookUrl}/transferir_atendimento`,
          },
        ],
      },
    });
  } catch (error) {
    console.error("Erro na rota /webhook/cliente/configuracao:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno ao carregar configuracao do webhook de cliente.",
    });
  }
});

rota.patch("/cliente/configuracao", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json({
        success: false,
        message: "Token invalido ou expirado.",
      });
    }

    const empresaId = Number(data.empresa_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.status(400).json({
        success: false,
        message: "empresa_id invalido.",
      });
    }

    if (!Object.prototype.hasOwnProperty.call(data, "n8n_ia_nome")) {
      return res.status(400).json({
        success: false,
        message: "Informe o campo n8n_ia_nome.",
      });
    }

    const updatedRows = await execute.execute_update_empresa_n8n_ia_nome(
      empresaId,
      normalizeN8nIaName(data.n8n_ia_nome)
    );
    const updated = updatedRows?.[0] || null;

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Empresa nao encontrada ou inativa.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Nome da IA atualizado com sucesso.",
      data: {
        empresa_id: updated.id,
        n8n_ia_nome: updated.n8n_ia_nome || "n8n IA",
      },
    });
  } catch (error) {
    console.error("Erro na rota /webhook/cliente/configuracao:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno ao atualizar configuracao da integracao N8N.",
    });
  }
});

rota.get("/cliente/:webhook_public_id/usuarios", async (req, res) => {
  try {
    const webhookPublicIdParam = String(req.params.webhook_public_id || "").trim();
    const empresa = await resolveEmpresaByWebhookPublicId(webhookPublicIdParam);

    if (!empresa) {
      return res.status(404).json({
        success: false,
        message: "Webhook nao encontrado.",
      });
    }

    const webhookCode = String(getWebhookCode(req) || "").trim();
    if (!webhookCode) {
      return res.status(400).json({
        success: false,
        message: "Codigo de validacao do webhook nao informado.",
      });
    }

    if (!empresa.cliente_webhook_ativo) {
      return res.status(403).json({
        success: false,
        message: "Webhook de cliente desativado para esta empresa.",
      });
    }

    if (!security.timingSafeEqualText(String(empresa.cliente_webhook_codigo || ""), webhookCode)) {
      return res.status(403).json({
        success: false,
        message: "Codigo de validacao do webhook invalido.",
      });
    }

    const usuarios = await execute.execute_list_usuarios_webhook(empresa.id);
    return res.status(200).json({
      success: true,
      message: "",
      data: {
        usuarios,
        total: usuarios.length,
      },
    });
  } catch (error) {
    console.error("Erro na rota /webhook/cliente/:webhook_public_id/usuarios:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno ao consultar usuarios.",
    });
  }
});

rota.get("/cliente/:webhook_public_id/utm_url", async (req, res) => {
  try {
    const webhookPublicIdParam = String(req.params.webhook_public_id || "").trim();
    const empresa = await resolveEmpresaByWebhookPublicId(webhookPublicIdParam);
    if (!empresa) {
      const legacyHint = await buildLegacyWebhookUrlHint(req, webhookPublicIdParam);
      if (legacyHint) {
        return res.status(410).json({
          success: false,
          message:
            "Webhook antigo detectado. Atualize a URL para o webhook_public_id informado em data.webhook_url.",
          data: legacyHint,
        });
      }

      return res.status(404).json({
        success: false,
        message: "Webhook nao encontrado.",
      });
    }

    const webhookCode = getWebhookCode(req);
    if (!webhookCode) {
      return res.status(400).json({
        success: false,
        message: "Codigo de validacao do webhook nao informado.",
      });
    }

    if (!empresa.cliente_webhook_ativo) {
      return res.status(403).json({
        success: false,
        message: "Webhook de cliente desativado para esta empresa.",
      });
    }

    if (String(empresa.cliente_webhook_codigo || "") !== String(webhookCode)) {
      return res.status(403).json({
        success: false,
        message: "Codigo de validacao do webhook invalido.",
      });
    }

    const result = await execute.execute_get_empresa_utms_urls(empresa.id);
    return res.status(200).json({
      success: true,
      message: "",
      data: result,
    });
  } catch (error) {
    console.error("Erro na rota /webhook/cliente/:webhook_public_id/utm_url:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno ao buscar URL de UTM da empresa.",
    });
  }
});

rota.patch("/cliente/status", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json({
        success: false,
        message: "Token invalido ou expirado.",
      });
    }

    const empresaId = Number(data.empresa_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.status(400).json({
        success: false,
        message: "empresa_id invalido.",
      });
    }

    const webhookCode = String(data.webhook_codigo || getWebhookCode(req) || "").trim();
    if (!webhookCode) {
      return res.status(400).json({
        success: false,
        message: "Codigo de validacao do webhook nao informado.",
      });
    }

    const ensuredRows = await execute.execute_ensure_empresa_webhook_secrets(empresaId);
    const empresa = ensuredRows[0];
    if (!empresa) {
      return res.status(404).json({
        success: false,
        message: "Empresa nao encontrada ou inativa.",
      });
    }

    if (!security.timingSafeEqualText(String(empresa.cliente_webhook_codigo || ""), webhookCode)) {
      return res.status(403).json({
        success: false,
        message: "Codigo de validacao do webhook invalido.",
      });
    }

    const ativo = parseBooleanLike(data.ativo);
    if (ativo === null) {
      return res.status(400).json({
        success: false,
        message: "Informe o campo ativo (true/false).",
      });
    }

    const updatedRows = await execute.execute_update_empresa_webhook_status(empresaId, ativo);
    const updated = updatedRows[0];

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Empresa nao encontrada ou inativa.",
      });
    }

    return res.status(200).json({
      success: true,
      message: ativo
        ? "Webhook de cliente ativado com sucesso."
        : "Webhook de cliente desativado com sucesso.",
      data: {
        empresa_id: updated.id,
        cliente_webhook_ativo: updated.cliente_webhook_ativo,
      },
    });
  } catch (error) {
    console.error("Erro na rota /webhook/cliente/status:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno ao atualizar status do webhook de cliente.",
    });
  }
});

rota.post(
  "/n8n/c0a5f5d21725b4437d5a2df74902bf1d/atribuir_atendimento",
  async (req, res) => {
    try {
      const auth = await resolveN8nCompany(req);
      if (!auth.empresa) {
        return res.status(auth.status).json({ success: false, message: auth.message });
      }

      const conversaId = normalizePositiveInt(req.body?.conversa_id);
      const usuarioId = normalizePositiveInt(req.body?.usuario_id);
      if (!conversaId || !usuarioId) {
        return res.status(400).json({
          success: false,
          message: "Informe conversa_id e usuario_id como numeros inteiros positivos.",
        });
      }

      const target = await validateN8nAttendanceTarget(
        auth.empresa.id,
        conversaId,
        usuarioId
      );
      if (!target.conversa || !target.usuario) {
        return res.status(target.status).json({ success: false, message: target.message });
      }

      const isWaiting =
        Number(target.conversa.status_id) === 0 &&
        target.conversa.usuario_id === null &&
        target.conversa.data_fim === null;
      if (!isWaiting) {
        return res.status(409).json({
          success: false,
          message: "Este atendimento nao esta aguardando na fila.",
        });
      }

      const updatedRows = await executeAtendimento.execute_update_conversa_usuario_atribuido(
        conversaId,
        usuarioId,
        auth.empresa.id
      );
      if (!updatedRows?.length) {
        return res.status(409).json({
          success: false,
          message: "O atendimento mudou de estado antes da atribuicao. Consulte e tente novamente.",
        });
      }

      notifyChatUpdate({
        empresa_id: auth.empresa.id,
        conversa_id: conversaId,
        tipo: "assignment",
        origem: "webhook:n8n_atribuir_atendimento",
      });

      return res.status(200).json({
        success: true,
        message: "Atendimento aguardando atribuido com sucesso.",
        data: {
          empresa_id: Number(auth.empresa.id),
          conversa_id: conversaId,
          cliente_id: Number(target.conversa.cliente_id),
          usuario_id: usuarioId,
          usuario_nome: target.usuario.nome || null,
          status: "aguardando_atendimento",
        },
      });
    } catch (error) {
      console.error("Erro na rota N8N de atribuicao de atendimento:", error);
      return res.status(500).json({
        success: false,
        message: "Erro interno ao atribuir atendimento pelo N8N.",
      });
    }
  }
);

rota.post(
  "/n8n/c0a5f5d21725b4437d5a2df74902bf1d/transferir_atendimento",
  async (req, res) => {
    try {
      const auth = await resolveN8nCompany(req);
      if (!auth.empresa) {
        return res.status(auth.status).json({ success: false, message: auth.message });
      }

      const conversaId = normalizePositiveInt(req.body?.conversa_id);
      const usuarioId = normalizePositiveInt(req.body?.usuario_id);
      if (!conversaId || !usuarioId) {
        return res.status(400).json({
          success: false,
          message: "Informe conversa_id e usuario_id como numeros inteiros positivos.",
        });
      }

      const target = await validateN8nAttendanceTarget(
        auth.empresa.id,
        conversaId,
        usuarioId
      );
      if (!target.conversa || !target.usuario) {
        return res.status(target.status).json({ success: false, message: target.message });
      }

      const isActive =
        Number(target.conversa.status_id) === 1 && target.conversa.data_fim === null;
      if (!isActive) {
        return res.status(409).json({
          success: false,
          message: "Este atendimento nao esta ativo e nao pode ser transferido.",
        });
      }

      const previousUserId = normalizePositiveInt(target.conversa.usuario_id);
      const updatedRows = await executeAtendimento.execute_transferir_atendimento_usuario(
        conversaId,
        usuarioId,
        auth.empresa.id
      );
      if (!updatedRows?.length) {
        return res.status(409).json({
          success: false,
          message: "O atendimento mudou de estado antes da transferencia. Consulte e tente novamente.",
        });
      }

      notifyChatUpdate({
        empresa_id: auth.empresa.id,
        conversa_id: conversaId,
        tipo: "ownership",
        origem: "webhook:n8n_transferir_atendimento",
      });

      return res.status(200).json({
        success: true,
        message: "Atendimento transferido com sucesso.",
        data: {
          empresa_id: Number(auth.empresa.id),
          conversa_id: conversaId,
          cliente_id: Number(target.conversa.cliente_id),
          usuario_anterior_id: previousUserId,
          usuario_id: usuarioId,
          usuario_nome: target.usuario.nome || null,
          status: "em_atendimento",
        },
      });
    } catch (error) {
      console.error("Erro na rota N8N de transferencia de atendimento:", error);
      return res.status(500).json({
        success: false,
        message: "Erro interno ao transferir atendimento pelo N8N.",
      });
    }
  }
);

rota.post("/n8n/c0a5f5d21725b4437d5a2df74902bf1d", async (req, res) => {
  try {
    const webhookCode = String(getWebhookCode(req) || "").trim();
    if (!webhookCode) {
      return res.status(400).json({
        success: false,
        message: "Secret da integracao nao informado.",
      });
    }

    const empresaRows = await execute.execute_get_empresa_webhook_config_by_code(webhookCode);
    const empresa = empresaRows?.[0] || null;
    if (!empresa) {
      return res.status(403).json({
        success: false,
        message: "Secret da integracao invalido.",
      });
    }

    if (!empresa.cliente_webhook_ativo) {
      return res.status(403).json({
        success: false,
        message: "Webhook de integracao desativado para esta empresa.",
      });
    }

    const clienteNumber = normalizePhoneLookupValue(req.body?.cliente_number);
    const message = String(req.body?.message || "").trim();
    let sendDate = null;
    if(req.body?.send_date != null){
      sendDate = normalizeN8nSendDate(req.body?.send_date);
    }
    const mensagemWhatsId = String(
      req.body?.mensagem_whats_id ||
      req.body?.message_id ||
      req.body?.messga_id ||
      ""
    ).trim();

    if (!clienteNumber) {
      return res.status(400).json({
        success: false,
        message: "cliente_number nao informado.",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "message nao informada.",
      });
    }

    if (!mensagemWhatsId) {
      return res.status(400).json({
        success: false,
        message: "mensagem_whats_id nao informado.",
      });
    }

    const clienteRows = await executeMeta.execute_find_cliente_by_phone(
      empresa.id,
      clienteNumber
    );
    const cliente = clienteRows?.[0] || null;
    if (!cliente?.id) {
      return res.status(404).json({
        success: false,
        message: "Cliente nao encontrado para este numero.",
      });
    }

    const selectedMetaParamId = normalizePositiveInt(
      req.body?.empresa_meta_param_id || req.body?.meta_param_id
    );
    const conversaRows = await execute.execute_list_open_conversations_by_cliente(
      empresa.id,
      cliente.id,
      selectedMetaParamId
    );
    const openConversations = Array.isArray(conversaRows) ? conversaRows : [];
    const uniqueOpenMetaParamIds = [
      ...new Set(
        openConversations
          .map((row) => Number(row?.empresa_meta_param_id || 0))
          .filter((value) => Number.isInteger(value) && value > 0)
      ),
    ];
    const conversa = openConversations[0] || null;

    if (!selectedMetaParamId && uniqueOpenMetaParamIds.length > 1) {
      return res.status(409).json({
        success: false,
        message:
          "O cliente possui mais de um chat aberto em numeros Meta diferentes. Informe empresa_meta_param_id no webhook para identificar o chat correto.",
        data: {
          empresa_id: empresa.id,
          cliente_id: cliente.id,
          open_conversations: openConversations.map((row) => ({
            conversa_id: Number(row?.id || 0) || null,
            empresa_meta_param_id: Number(row?.empresa_meta_param_id || 0) || null,
            status_id: Number(row?.status_id || 0) || null,
          })),
        },
      });
    }

    if (!conversa?.id) {
      return res.status(404).json({
        success: false,
        message: selectedMetaParamId
          ? "Nenhuma conversa aberta foi encontrada para este cliente nesse numero Meta."
          : "Nenhuma conversa aberta foi encontrada para este cliente.",
      });
    }

    let insertedRows = await execute.execute_insert_mensagem_n8n_ia({
      conversa_id: conversa.id,
      message,
      send_date: sendDate,
      mensagem_whats_id: mensagemWhatsId,
    });

    let duplicate = false;
    if (!insertedRows?.length) {
      const existingRows = await executeMeta.execute_get_mensagem_conversa_by_whats_id(
        conversa.id,
        mensagemWhatsId
      );
      if (existingRows?.length) {
        insertedRows = existingRows;
        duplicate = true;
      }
    }

    if (!insertedRows?.length) {
      return res.status(500).json({
        success: false,
        message: "Nao foi possivel registrar a mensagem da n8n IA.",
      });
    }

    notifyChatUpdate({
      empresa_id: empresa.id,
      conversa_id: conversa.id,
      tipo: "message",
      origem: "webhook:n8n_ia",
    });

    return res.status(200).json({
      success: true,
      message: duplicate
        ? `Mensagem da ${empresa.n8n_ia_nome || "n8n IA"} ja estava registrada.`
        : `Mensagem da ${empresa.n8n_ia_nome || "n8n IA"} registrada com sucesso.`,
      data: {
        empresa_id: empresa.id,
        cliente_id: cliente.id,
        conversa_id: conversa.id,
        mensagem_whats_id: mensagemWhatsId,
        duplicate,
      },
    });
  } catch (error) {
    console.error(
      "Erro na rota /webhook/n8n/c0a5f5d21725b4437d5a2df74902bf1d:",
      error
    );
    return res.status(500).json({
      success: false,
      message: "Erro interno ao processar webhook da integracao N8N.",
    });
  }
});

module.exports = rota;
