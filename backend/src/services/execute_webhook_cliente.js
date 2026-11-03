const models = require("../models/models_webhook_cliente");
const { postgres } = require("../server/connect");
const developerWebhooks = require("./execute_developer_webhooks");

function isMissingN8nIaNameColumnError(error) {
  return String(error?.message || "").toLowerCase().includes("cliente_n8n_ia_nome");
}

function normalizeTags(tags = []) {
  return [...new Set(
    tags
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          return String(item.nome || item.name || "").trim();
        }
        return "";
      })
      .filter(Boolean)
  )];
}

function normalizeUtmsHistorico(utms = []) {
  const nowIso = new Date().toISOString();
  return utms.map((utm) => {
    if (utm && typeof utm === "object" && !Array.isArray(utm)) {
      return {
        ...utm,
        data_recebimento: utm.data_recebimento || nowIso,
      };
    }

    return {
      valor: utm,
      data_recebimento: nowIso,
    };
  });
}

const execute = {
  execute_ensure_empresa_webhook_secrets: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.ensure_empresa_webhook_secrets(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_empresa_webhook_config: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_empresa_webhook_config(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_empresa_webhook_config_by_public_id: async (webhook_public_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_empresa_webhook_config_by_public_id(), [
        webhook_public_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_empresa_webhook_config_by_code: async (webhook_code) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_empresa_webhook_config_by_code(), [
        webhook_code,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_processar_webhook_cliente: async ({
    empresa_id,
    cliente,
    utms,
    tags,
  }) => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");

      const clienteRet = await client.query(models.upsert_cliente_webhook(), [
        cliente.nome,
        cliente.telefone,
        cliente.email,
        empresa_id,
        JSON.stringify(tags || []),
      ]);

      const clienteAtual = clienteRet.rows[0];
      const utmsHistorico = normalizeUtmsHistorico(utms || []);

      if (utmsHistorico.length > 0) {
        const utmRet = await client.query(models.append_cliente_utms_historico(), [
          clienteAtual.id,
          JSON.stringify(utmsHistorico),
        ]);
        clienteAtual.utms = utmRet.rows?.[0]?.utms || clienteAtual.utms || [];
      }

      const tagsNormalizadas = normalizeTags(tags || []);
      const tagsVinculadas = [];

      for (const tagNome of tagsNormalizadas) {
        const tagRet = await client.query(models.upsert_tag_por_nome(), [
          tagNome,
          empresa_id,
        ]);
        const tag = tagRet.rows[0];
        if (!tag) continue;

        await client.query(models.vincular_tag_cliente(), [tag.id, clienteAtual.id]);
        tagsVinculadas.push({
          id: tag.id,
          nome: tag.nome,
        });
      }

      await client.query("COMMIT");
      if (clienteAtual?.created && clienteAtual?.id) {
        developerWebhooks.queueCustomerCreated(clienteAtual.id);
      }
      return {
        cliente: clienteAtual,
        tags_vinculadas: tagsVinculadas,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_get_empresa_utms_urls: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_empresa_utms_urls(), [empresa_id]);
      const rows = ret.rows || [];
      const unique = [];
      const seen = new Set();

      for (const row of rows) {
        const url = String(row.url || "").trim();
        if (!url) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        unique.push({
          url,
          data_recebimento: row.data_recebimento || null,
        });
      }

      return {
        url_empresa: unique[0]?.url || null,
        urls: unique,
      };
    } finally {
      client.release();
    }
  },

  execute_list_usuarios_webhook: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_usuarios_webhook(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_update_empresa_webhook_status: async (empresa_id, ativo) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.update_empresa_webhook_status(), [
        empresa_id,
        Boolean(ativo),
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_update_empresa_n8n_ia_nome: async (empresa_id, nome) => {
    const client = await postgres.connect();
    try {
      try {
        await client.query(models.ensure_empresa_n8n_ia_nome_column());
      } catch (error) {
        if (!isMissingN8nIaNameColumnError(error) && String(error?.code || "") !== "42701") {
          throw error;
        }
      }

      const ret = await client.query(models.update_empresa_n8n_ia_nome(), [
        empresa_id,
        nome,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_latest_open_conversation_by_cliente: async (empresa_id, cliente_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_latest_open_conversation_by_cliente(), [
        empresa_id,
        cliente_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_list_open_conversations_by_cliente: async (
    empresa_id,
    cliente_id,
    empresa_meta_param_id = null
  ) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_open_conversations_by_cliente(), [
        empresa_id,
        cliente_id,
        empresa_meta_param_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_insert_mensagem_n8n_ia: async ({
    conversa_id,
    message,
    send_date,
    mensagem_whats_id,
  }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.insert_mensagem_n8n_ia(), [
        conversa_id,
        message,
        send_date || null,
        mensagem_whats_id,
      ]);
      if (ret.rows?.[0]?.id) {
        developerWebhooks.queueMessageCreated(ret.rows[0].id);
      }
      return ret.rows;
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
