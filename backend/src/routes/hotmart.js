const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const execute = require("../services/execute_hotmart");
const { resolveWebhookBaseUrl } = require("../utils/webhook_url");

function resolveHotmartWebhookBaseUrl(req) {
  return resolveWebhookBaseUrl(req, [
    process.env.HOTMART_WEBHOOK_BASE_URL,
    process.env.CLIENTE_WEBHOOK_BASE_URL,
    process.env.WEBHOOK_BASE_URL,
  ]);
}

function buildWebhookUrl(req, webhookPublicId) {
  const baseUrl = resolveHotmartWebhookBaseUrl(req);
  return `${baseUrl}/hotmart/webhook/${webhookPublicId}`;
}

function getHotmartHottok(req) {
  return (
    req.headers["x-hotmart-hottok"] ||
    req.headers["x-hotmart-hottok".toLowerCase()] ||
    req.body?.hottok ||
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
        hotmart_product_key: item.hotmart_product_key || "",
        hotmart_product_id: item.hotmart_product_id || "",
        hotmart_offer_code: item.hotmart_offer_code || "",
        hotmart_product_name: item.hotmart_product_name || "",
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

    const overview = await execute.execute_get_hotmart_integracao_overview(empresaId);
    const integracao = execute.mapIntegrationRow(
      overview.integracao,
      buildWebhookUrl(req, overview.integracao?.webhook_public_id || "")
    );

    return res.status(200).json({
      success: true,
      message: "",
      data: {
        integracao,
        summary: normalizeSummary(overview.summary || {}),
        eventos_recentes: normalizeEventos(overview.eventos || []),
        produtos_detectados: normalizeProdutosDetectados(overview.produtosDetectados || []),
        official_header_name: "X-HOTMART-HOTTOK",
      },
    });
  } catch (error) {
    console.error("Erro na rota /hotmart/configuracao:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno ao carregar configuracao da Hotmart.",
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

    const saved = await execute.execute_save_hotmart_integracao({
      empresa_id: empresaId,
      hottok: data.hottok,
      ativo: data.ativo,
      sincronizar_vendas: data.sincronizar_vendas,
      sincronizar_carrinho_abandonado: data.sincronizar_carrinho_abandonado,
      sincronizar_assinaturas: data.sincronizar_assinaturas,
      sincronizar_reembolsos: data.sincronizar_reembolsos,
      vincular_clientes_existentes: data.vincular_clientes_existentes,
      criar_clientes_automaticamente: data.criar_clientes_automaticamente,
    });

    const overview = await execute.execute_get_hotmart_integracao_overview(empresaId);
    const integracao = execute.mapIntegrationRow(
      saved || overview.integracao,
      buildWebhookUrl(req, (saved || overview.integracao)?.webhook_public_id || "")
    );

    return res.status(200).json({
      success: true,
      message: integracao?.ativo
        ? "Integracao Hotmart salva com sucesso."
        : "Configuracao da Hotmart atualizada.",
      data: {
        integracao,
        summary: normalizeSummary(overview.summary || {}),
        eventos_recentes: normalizeEventos(overview.eventos || []),
        produtos_detectados: normalizeProdutosDetectados(overview.produtosDetectados || []),
        official_header_name: "X-HOTMART-HOTTOK",
      },
    });
  } catch (error) {
    console.error("Erro na rota /hotmart/salvar_integracao:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Erro interno ao salvar integracao da Hotmart.",
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

    await execute.execute_save_hotmart_product_map({
      empresa_id: empresaId,
      hotmart_product_key: data.hotmart_product_key,
      hotmart_product_id: data.hotmart_product_id,
      hotmart_offer_code: data.hotmart_offer_code,
      hotmart_product_name: data.hotmart_product_name,
      comercial_produto_id: data.comercial_produto_id,
    });

    const overview = await execute.execute_get_hotmart_integracao_overview(empresaId);
    const integracao = execute.mapIntegrationRow(
      overview.integracao,
      buildWebhookUrl(req, overview.integracao?.webhook_public_id || "")
    );

    return res.status(200).json({
      success: true,
      message: "Produto Hotmart vinculado com sucesso.",
      data: {
        integracao,
        summary: normalizeSummary(overview.summary || {}),
        eventos_recentes: normalizeEventos(overview.eventos || []),
        produtos_detectados: normalizeProdutosDetectados(overview.produtosDetectados || []),
        official_header_name: "X-HOTMART-HOTTOK",
      },
    });
  } catch (error) {
    console.error("Erro na rota /hotmart/vincular_produto:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Erro interno ao vincular produto Hotmart.",
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

    await execute.execute_remove_hotmart_product_map({
      empresa_id: empresaId,
      hotmart_product_key: data.hotmart_product_key,
    });

    const overview = await execute.execute_get_hotmart_integracao_overview(empresaId);
    const integracao = execute.mapIntegrationRow(
      overview.integracao,
      buildWebhookUrl(req, overview.integracao?.webhook_public_id || "")
    );

    return res.status(200).json({
      success: true,
      message: "Produto Hotmart desvinculado com sucesso.",
      data: {
        integracao,
        summary: normalizeSummary(overview.summary || {}),
        eventos_recentes: normalizeEventos(overview.eventos || []),
        produtos_detectados: normalizeProdutosDetectados(overview.produtosDetectados || []),
        official_header_name: "X-HOTMART-HOTTOK",
      },
    });
  } catch (error) {
    console.error("Erro na rota /hotmart/desvincular_produto:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Erro interno ao desvincular produto Hotmart.",
    });
  }
});

rota.post("/webhook/:webhook_public_id", async (req, res) => {
  try {
    const webhookPublicId = String(req.params.webhook_public_id || "").trim();
    if (!webhookPublicId) {
      return res.status(400).json({
        success: false,
        message: "Webhook publico da Hotmart nao informado.",
      });
    }

    const hottok = String(getHotmartHottok(req) || "").trim();
    if (!hottok) {
      return res.status(400).json({
        success: false,
        message: "Header X-HOTMART-HOTTOK nao informado.",
      });
    }

    const result = await execute.execute_processar_webhook_hotmart({
      webhookPublicId,
      hottok,
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
    console.error("Erro na rota /hotmart/webhook/:webhook_public_id:", error);
    return res.status(statusCode).json({
      success: false,
      message: error?.message || "Erro interno ao processar webhook da Hotmart.",
    });
  }
});

module.exports = rota;
