const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const execute = require("../services/execute_hubla");
const { resolveWebhookBaseUrl } = require("../utils/webhook_url");

function resolveHublaWebhookBaseUrl(req) {
  return resolveWebhookBaseUrl(req, [
    process.env.HUBLA_WEBHOOK_BASE_URL,
    process.env.CLIENTE_WEBHOOK_BASE_URL,
    process.env.WEBHOOK_BASE_URL,
  ]);
}

function buildWebhookUrl(req, webhookPublicId) {
  const baseUrl = resolveHublaWebhookBaseUrl(req);
  return `${baseUrl}/hubla/webhook/${webhookPublicId}`;
}

function getHublaToken(req) {
  return (
    req.headers["x-hubla-token"] ||
    req.body?.hubla_token ||
    req.body?.secret ||
    null
  );
}

function normalizeSummary(summary = {}) {
  return {
    total_eventos: Number(summary.total_eventos || 0),
    total_processados: Number(summary.total_processados || 0),
    total_clientes_vinculados: Number(summary.total_clientes_vinculados || 0),
    ultimo_evento_em: summary.ultimo_evento_em || null,
    ultima_sincronizacao_em: summary.ultima_sincronizacao_em || null,
  };
}

function normalizeEventos(eventos = []) {
  return Array.isArray(eventos)
    ? eventos.map((item) => ({
        id: Number(item.id || 0),
        cliente_id:
          item.cliente_id === null || item.cliente_id === undefined
            ? null
            : Number(item.cliente_id),
        tipo_evento: item.tipo_evento || "",
        categoria_evento: item.categoria_evento || "",
        status_compra: item.status_compra || "",
        transacao_id: item.transacao_id || "",
        produto_nome: item.produto_nome || "",
        produto_codigo: item.produto_codigo || "",
        cliente_nome: item.cliente_nome || "",
        cliente_email: item.cliente_email || "",
        cliente_telefone: item.cliente_telefone || "",
        cliente_telefone_normalizado: item.cliente_telefone_normalizado || "",
        processado: Boolean(item.processado),
        mensagem_processamento: item.mensagem_processamento || "",
        vinculado_por_telefone: Boolean(item.vinculado_por_telefone),
        criou_cliente: Boolean(item.criou_cliente),
        recebido_em: item.recebido_em || null,
      }))
    : [];
}

function normalizeProdutosDetectados(produtos = []) {
  return Array.isArray(produtos)
    ? produtos.map((item) => ({
        hubla_product_key: item.hubla_product_key || "",
        hubla_product_id: item.hubla_product_id || "",
        hubla_offer_code: item.hubla_offer_code || "",
        hubla_product_name: item.hubla_product_name || "",
        total_eventos: Number(item.total_eventos || 0),
        ultimo_recebimento_em: item.ultimo_recebimento_em || null,
        ultimo_tipo_evento: item.ultimo_tipo_evento || "",
        ultimo_status_compra: item.ultimo_status_compra || "",
        comercial_produto_id:
          item.comercial_produto_id === null || item.comercial_produto_id === undefined
            ? null
            : Number(item.comercial_produto_id),
        comercial_produto_nome: item.comercial_produto_nome || "",
        comercial_produto_preco_base:
          item.comercial_produto_preco_base === null ||
          item.comercial_produto_preco_base === undefined
            ? null
            : Number(item.comercial_produto_preco_base),
      }))
    : [];
}

function normalizeVendedores(vendedores = []) {
  return Array.isArray(vendedores)
    ? vendedores.map((item) => ({
        id: Number(item.id || 0),
        nome: item.nome || "",
      }))
    : [];
}

function normalizeRegrasUtmVendedor(regras = []) {
  return Array.isArray(regras)
    ? regras.map((item) => ({
        id: Number(item.id || 0),
        vendedor_usuario_id: Number(item.vendedor_usuario_id || 0),
        vendedor_nome: item.vendedor_nome || "",
        utm_campo: item.utm_campo || "",
        utm_valor: item.utm_valor || "",
        created_at: item.created_at || null,
      }))
    : [];
}

function buildOverviewData(req, overview, integrationOverride = null) {
  const sourceIntegration = integrationOverride || overview.integracao;
  return {
    integracao: execute.mapIntegrationRow(
      sourceIntegration,
      buildWebhookUrl(req, sourceIntegration?.webhook_public_id || "")
    ),
    summary: normalizeSummary(overview.summary || {}),
    eventos_recentes: normalizeEventos(overview.eventos || []),
    produtos_detectados: normalizeProdutosDetectados(overview.produtosDetectados || []),
    vendedores: normalizeVendedores(overview.vendedores || []),
    utm_vendedor_regras: normalizeRegrasUtmVendedor(
      overview.regrasUtmVendedor || []
    ),
    official_header_name: "X-Hubla-Token",
  };
}

rota.post("/configuracao", async (req, res) => {
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

    const overview = await execute.execute_get_hubla_integracao_overview(empresaId);
    return res.status(200).json({
      success: true,
      message: "",
      data: buildOverviewData(req, overview),
    });
  } catch (error) {
    console.error("Erro na rota /hubla/configuracao:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno ao carregar configuracao da Hubla.",
    });
  }
});

rota.post("/salvar_integracao", async (req, res) => {
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

    const saved = await execute.execute_save_hubla_integracao({
      empresa_id: empresaId,
      hubla_token: data.hubla_token || data.hublaToken,
      ativo: data.ativo,
      sincronizar_vendas: data.sincronizar_vendas,
      sincronizar_carrinho_abandonado: data.sincronizar_carrinho_abandonado,
      sincronizar_assinaturas: data.sincronizar_assinaturas,
      sincronizar_reembolsos: data.sincronizar_reembolsos,
      vincular_clientes_existentes: data.vincular_clientes_existentes,
      criar_clientes_automaticamente: data.criar_clientes_automaticamente,
    });

    const overview = await execute.execute_get_hubla_integracao_overview(empresaId);
    const integracao = execute.mapIntegrationRow(saved || overview.integracao);

    return res.status(200).json({
      success: true,
      message: integracao?.ativo
        ? "Integracao Hubla salva com sucesso."
        : "Configuracao da Hubla atualizada.",
      data: buildOverviewData(req, overview, saved || overview.integracao),
    });
  } catch (error) {
    console.error("Erro na rota /hubla/salvar_integracao:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Erro interno ao salvar integracao da Hubla.",
    });
  }
});

rota.post("/vincular_produto", async (req, res) => {
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

    await execute.execute_save_hubla_product_map({
      empresa_id: empresaId,
      hubla_product_key: data.hubla_product_key,
      hubla_product_id: data.hubla_product_id,
      hubla_offer_code: data.hubla_offer_code,
      hubla_product_name: data.hubla_product_name,
      comercial_produto_id: data.comercial_produto_id,
    });

    const overview = await execute.execute_get_hubla_integracao_overview(empresaId);
    return res.status(200).json({
      success: true,
      message: "Produto Hubla vinculado com sucesso.",
      data: buildOverviewData(req, overview),
    });
  } catch (error) {
    console.error("Erro na rota /hubla/vincular_produto:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Erro interno ao vincular produto Hubla.",
    });
  }
});

rota.post("/desvincular_produto", async (req, res) => {
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

    await execute.execute_remove_hubla_product_map({
      empresa_id: empresaId,
      hubla_product_key: data.hubla_product_key,
    });

    const overview = await execute.execute_get_hubla_integracao_overview(empresaId);
    return res.status(200).json({
      success: true,
      message: "Produto Hubla desvinculado com sucesso.",
      data: buildOverviewData(req, overview),
    });
  } catch (error) {
    console.error("Erro na rota /hubla/desvincular_produto:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Erro interno ao desvincular produto Hubla.",
    });
  }
});

rota.post("/vincular_utm_vendedor", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json({ success: false, message: "Token invalido ou expirado." });
    }

    const empresaId = Number(data.empresa_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.status(400).json({ success: false, message: "empresa_id invalido." });
    }

    await execute.execute_save_hubla_utm_vendedor_rule({
      empresa_id: empresaId,
      vendedor_usuario_id: data.vendedor_usuario_id,
      utm_campo: data.utm_campo,
      utm_valor: data.utm_valor,
    });
    const overview = await execute.execute_get_hubla_integracao_overview(empresaId);
    return res.status(200).json({
      success: true,
      message: "Regra de vendedor por UTM salva com sucesso.",
      data: buildOverviewData(req, overview),
    });
  } catch (error) {
    console.error("Erro na rota /hubla/vincular_utm_vendedor:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Erro interno ao vincular vendedor por UTM.",
    });
  }
});

rota.post("/desvincular_utm_vendedor", async (req, res) => {
  try {
    const data = security.jwtdecript(req.body);
    if (!data) {
      return res.status(401).json({ success: false, message: "Token invalido ou expirado." });
    }

    const empresaId = Number(data.empresa_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.status(400).json({ success: false, message: "empresa_id invalido." });
    }

    await execute.execute_remove_hubla_utm_vendedor_rule({
      empresa_id: empresaId,
      regra_id: data.regra_id,
    });
    const overview = await execute.execute_get_hubla_integracao_overview(empresaId);
    return res.status(200).json({
      success: true,
      message: "Regra de vendedor por UTM removida.",
      data: buildOverviewData(req, overview),
    });
  } catch (error) {
    console.error("Erro na rota /hubla/desvincular_utm_vendedor:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Erro interno ao remover regra UTM.",
    });
  }
});

rota.post("/webhook/:webhook_public_id", async (req, res) => {
  try {
    const webhookPublicId = String(req.params.webhook_public_id || "").trim();
    if (!webhookPublicId) {
      return res.status(400).json({
        success: false,
        message: "Webhook publico da Hubla nao informado.",
      });
    }

    const hubla_token = String(getHublaToken(req) || "").trim();
    if (!hubla_token) {
      return res.status(400).json({
        success: false,
        message: "Header X-Hubla-Token nao informado.",
      });
    }

    const result = await execute.execute_processar_webhook_hubla({
      webhookPublicId,
      hubla_token,
      idempotencyKey: req.headers["x-hubla-idempotency"] || null,
      payload: req.body || {},
    });

    return res.status(200).json({
      success: true,
      message: result.mensagem,
      data: {
        duplicate: Boolean(result.duplicate),
        processado: Boolean(result.processado),
        cliente_id: result.cliente?.id || result.evento?.cliente_id || null,
        evento_id: result.evento?.id ? Number(result.evento.id) : null,
        categoria_evento: result.summary?.categoriaEvento || null,
        tipo_evento: result.summary?.tipoEvento || null,
      },
    });
  } catch (error) {
    const statusCode =
      Number.isInteger(error?.statusCode) && error.statusCode >= 400
        ? error.statusCode
        : 500;
    console.error("Erro na rota /hubla/webhook/:webhook_public_id:", error);
    return res.status(statusCode).json({
      success: false,
      message: error?.message || "Erro interno ao processar webhook da Hubla.",
    });
  }
});

module.exports = rota;
