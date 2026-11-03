const express = require("express");
const rota = express.Router();
const execute = require("../services/execute_developer_webhooks");
const security = require("../security/cypher");
const utils = require("../utils/templates");

function getPayload(req) {
  return security.jwtdecript(req.body) || null;
}

function unauthorized(res) {
  return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

rota.post("/listar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const empresaId = parsePositiveInt(data.empresa_id || data.empresaId);
    if (!empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe uma empresa valida."));
    }

    const webhooks = await execute.listWebhooks(empresaId);
    return res.json(
      utils.jsonMount(
        true,
        {
          webhooks,
          event_catalog: execute.getEventCatalog(),
        },
        ""
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/developer_webhooks/listar"));
  }
});

rota.post("/salvar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const empresaId = parsePositiveInt(data.empresa_id || data.empresaId);
    if (!empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe uma empresa valida."));
    }

    const webhook = await execute.saveWebhook({
      empresaId,
      id: parsePositiveInt(data.id),
      nome: data.nome,
      url: data.url,
      securityKey: data.security_key,
      securityLocation: data.security_location,
      securityFieldName: data.security_field_name,
      eventos: data.eventos,
      ativo: data.ativo,
    });

    return res.json(
      utils.jsonMount(
        true,
        webhook,
        data.id
          ? "Webhook de desenvolvedor atualizado com sucesso!"
          : "Webhook de desenvolvedor criado com sucesso!"
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/developer_webhooks/salvar"));
  }
});

rota.post("/historico", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const empresaId = parsePositiveInt(data.empresa_id || data.empresaId);
    const webhookId = parsePositiveInt(data.webhook_id || data.webhookId);
    if (!empresaId || !webhookId) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa e webhook validos."));
    }

    const historico = await execute.listWebhookHistory(
      empresaId,
      webhookId,
      Number(data.limit || data.limite || 50)
    );

    return res.json(utils.jsonMount(true, { historico }, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/developer_webhooks/historico"));
  }
});

rota.post("/deletar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const empresaId = parsePositiveInt(data.empresa_id || data.empresaId);
    const webhookId = parsePositiveInt(data.id);
    if (!empresaId || !webhookId) {
      return res.json(utils.jsonMount(false, {}, "Informe o webhook a ser removido."));
    }

    const deleted = await execute.deleteWebhook(empresaId, webhookId);
    if (!deleted) {
      return res.json(utils.jsonMount(false, {}, "Webhook de desenvolvedor nao encontrado."));
    }

    return res.json(utils.jsonMount(true, {}, "Webhook de desenvolvedor removido com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/developer_webhooks/deletar"));
  }
});

module.exports = rota;
