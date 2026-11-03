const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const utils = require("../utils/templates");
const execute = require("../services/execute_financeiro");
const fn = require("../functions/function_financeiro");
const upload = require("../utils/multer_config");
const bunny = require("../utils/bunny_config");
const { postgres } = require("../server/connect");
const userModels = require("../models/models_user");

const FINANCIAL_PERMISSION = "financial.manage";
const FINANCIAL_PERMISSION_CACHE_TTL_MS = 15000;
const financialPermissionCache = new Map();

function is_validation_error(error) {
  return Boolean(error?.message);
}

function payload_or_unauthorized(req, res) {
  const data = req.financeiroPayload || fn.get_payload(req, security);
  if (!data) {
    fn.unauthorized(res, utils);
    return null;
  }
  return data;
}

async function authorizeFinanceiro(req, res, next) {
  if (req.is("multipart/form-data") && !req.body?.payload) return next();

  const data = fn.get_payload(req, security);
  if (!data) return fn.unauthorized(res, utils);

  const empresaId = Number(data.empresa_id || 0);
  // Permissao conferida para o usuario da SESSAO. Antes vinha de campos do
  // corpo (usuario_autenticado_id...), e um usuario sem acesso ao financeiro
  // podia informar o id do master da propria empresa.
  const usuarioId = Number(req.auth?.usuario_id || 0);
  if (!Number.isInteger(empresaId) || empresaId <= 0 || !Number.isInteger(usuarioId) || usuarioId <= 0) {
    return res.status(403).json(
      utils.jsonMount(false, {}, "Empresa ou usuario autenticado invalido.")
    );
  }

  const cacheKey = `${empresaId}:${usuarioId}`;
  const cached = financialPermissionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.allowed) {
      return res.status(403).json(
        utils.jsonMount(false, {}, "Voce nao tem permissao para acessar o financeiro.")
      );
    }
    req.financeiroPayload = data;
    return next();
  }

  const client = await postgres.connect();
  try {
    const contextRet = await client.query(userModels.get_dashboard_contexto_usuario(), [
      usuarioId,
      empresaId,
    ]);
    const context = contextRet.rows?.[0] || null;
    const planPermissions = Array.isArray(context?.permissoes_plano)
      ? context.permissoes_plano
      : [];
    const userPermissions = Array.isArray(context?.permissoes_customizadas)
      ? context.permissoes_customizadas
      : [];
    const allowed = Boolean(
      context &&
        planPermissions.includes(FINANCIAL_PERMISSION) &&
        (context.is_master || userPermissions.includes(FINANCIAL_PERMISSION))
    );

    financialPermissionCache.set(cacheKey, {
      allowed,
      expiresAt: Date.now() + FINANCIAL_PERMISSION_CACHE_TTL_MS,
    });
    if (!allowed) {
      return res.status(403).json(
        utils.jsonMount(false, {}, "Voce nao tem permissao para acessar o financeiro.")
      );
    }

    req.financeiroPayload = data;
    return next();
  } catch (error) {
    return next(error);
  } finally {
    client.release();
  }
}

rota.use(authorizeFinanceiro);

async function apply_attachment_if_present(data, req) {
  if (!req.file) {
    return data;
  }

  const filePath = bunny.generateFileName(
    req.file.originalname,
    data.usuario_id || data.criado_por || data.empresa_id || "financeiro"
  );
  const uploaded = await bunny.uploadFile(filePath, req.file.buffer);

  return {
    ...data,
    anexo_url: uploaded.file,
    anexo_nome_arquivo: req.file.originalname || null,
    anexo_mimetype: req.file.mimetype || null,
  };
}

rota.post("/dominios", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const rows = await execute.execute_dominios();
    return res.json(utils.jsonMount(true, rows, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/dominios"));
  }
});

rota.post("/categorias/listar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const rows = await execute.execute_listar_categorias(empresaId);
    return res.json(utils.jsonMount(true, rows, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/categorias/listar"));
  }
});

rota.post("/categorias/criar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const row = await execute.execute_criar_categoria({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Categoria criada com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/categorias/criar"));
  }
});

function registerFinancialRegistryRoutes(path, listExecutor, saveExecutor) {
  rota.post(`/${path}/listar`, async (req, res) => {
    try {
      const data = payload_or_unauthorized(req, res);
      if (!data) return;
      const empresaId = fn.require_empresa(data, res, utils);
      if (!empresaId) return;
      const rows = await listExecutor({ ...data, empresa_id: empresaId });
      return res.json(utils.jsonMount(true, rows, ""));
    } catch (error) {
      return res.json(utils.errorHandle(error, `/financeiro/${path}/listar`));
    }
  });

  rota.post(`/${path}/salvar`, async (req, res) => {
    try {
      const data = payload_or_unauthorized(req, res);
      if (!data) return;
      const empresaId = fn.require_empresa(data, res, utils);
      if (!empresaId) return;
      const row = await saveExecutor({ ...data, empresa_id: empresaId });
      if (!row) throw new Error("Registro financeiro nao encontrado.");
      return res.json(utils.jsonMount(true, row, "Registro salvo com sucesso."));
    } catch (error) {
      if (is_validation_error(error)) {
        return res.json(utils.jsonMount(false, {}, error.message));
      }
      return res.json(utils.errorHandle(error, `/financeiro/${path}/salvar`));
    }
  });
}

registerFinancialRegistryRoutes(
  "centros_custo",
  execute.execute_listar_centros_custo,
  execute.execute_salvar_centro_custo
);
registerFinancialRegistryRoutes(
  "contas_financeiras",
  execute.execute_listar_contas_financeiras,
  execute.execute_salvar_conta_financeira
);
registerFinancialRegistryRoutes(
  "contrapartes",
  execute.execute_listar_contrapartes,
  execute.execute_salvar_contraparte
);
registerFinancialRegistryRoutes(
  "empresas_grupo",
  execute.execute_listar_empresas_grupo,
  execute.execute_salvar_empresa_grupo
);
registerFinancialRegistryRoutes(
  "formas_pagamento",
  execute.execute_listar_formas_pagamento,
  execute.execute_salvar_forma_pagamento
);

rota.post("/transferencias/criar", upload.single("file"), async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;
    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    if (req.file) {
      const allowedTypes = new Set([
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);
      if (!allowedTypes.has(String(req.file.mimetype || "").toLowerCase())) {
        return res.json(utils.jsonMount(false, {}, "O comprovante deve ser PDF, JPG, PNG ou WEBP."));
      }
      if (Number(req.file.size || 0) > 10 * 1024 * 1024) {
        return res.json(utils.jsonMount(false, {}, "O comprovante deve ter no maximo 10 MB."));
      }
    }

    const payload = await apply_attachment_if_present(data, req);
    const row = await execute.execute_criar_transferencia({ ...payload, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Transferencia registrada com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) return res.json(utils.jsonMount(false, {}, error.message));
    return res.json(utils.errorHandle(error, "/financeiro/transferencias/criar"));
  }
});

rota.post("/contas_pagar/criar", upload.single("file"), authorizeFinanceiro, async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const payload = await apply_attachment_if_present(data, req);
    const row = await execute.execute_criar_conta_pagar({ ...payload, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Conta a pagar criada com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/contas_pagar/criar"));
  }
});

rota.post("/contas_pagar/criar_parcelado", upload.single("file"), authorizeFinanceiro, async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const payload = await apply_attachment_if_present(data, req);
    const ret = await execute.execute_criar_conta_pagar_parcelado({
      ...payload,
      empresa_id: empresaId,
    });
    return res.json(utils.jsonMount(true, ret, "Parcelamento de contas a pagar criado com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/contas_pagar/criar_parcelado"));
  }
});

rota.post("/contas_pagar/listar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const rows = await execute.execute_listar_contas_pagar({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, rows, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/contas_pagar/listar"));
  }
});

rota.post("/contas_pagar/registrar_pagamento", upload.single("file"), authorizeFinanceiro, async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const payload = await apply_attachment_if_present(data, req);
    const row = await execute.execute_registrar_pagamento({ ...payload, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Pagamento registrado com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/contas_pagar/registrar_pagamento"));
  }
});

rota.post("/contas_pagar/deletar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const ret = await execute.execute_deletar_conta_pagar({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, ret, "Conta(s) a pagar removida(s) com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/contas_pagar/deletar"));
  }
});

rota.post("/contas_receber/criar", upload.single("file"), authorizeFinanceiro, async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const payload = await apply_attachment_if_present(data, req);
    const row = await execute.execute_criar_conta_receber({ ...payload, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Conta a receber criada com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/contas_receber/criar"));
  }
});

rota.post("/contas_receber/criar_parcelado", upload.single("file"), authorizeFinanceiro, async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const payload = await apply_attachment_if_present(data, req);
    const ret = await execute.execute_criar_conta_receber_parcelado({
      ...payload,
      empresa_id: empresaId,
    });
    return res.json(utils.jsonMount(true, ret, "Parcelamento de contas a receber criado com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/contas_receber/criar_parcelado"));
  }
});

rota.post("/contas_receber/listar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const rows = await execute.execute_listar_contas_receber({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, rows, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/contas_receber/listar"));
  }
});

rota.post("/contas_receber/registrar_recebimento", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const row = await execute.execute_registrar_recebimento({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Recebimento registrado com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/contas_receber/registrar_recebimento"));
  }
});

rota.post("/contas_receber/deletar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const ret = await execute.execute_deletar_conta_receber({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, ret, "Conta(s) a receber removida(s) com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/contas_receber/deletar"));
  }
});

rota.post("/lancamentos/listar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const rows = await execute.execute_listar_lancamentos({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, rows, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/lancamentos/listar"));
  }
});

rota.post("/lancamentos/deletar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const row = await execute.execute_deletar_lancamento({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Lancamento removido com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/lancamentos/deletar"));
  }
});

rota.post("/comissoes/meta_salvar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const row = await execute.execute_salvar_meta_usuario({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Meta salva com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/comissoes/meta_salvar"));
  }
});

rota.post("/comissoes/lancar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const row = await execute.execute_lancar_comissao({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Comissao lancada com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/comissoes/lancar"));
  }
});

rota.post("/comissoes/meta_finalizar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const ret = await execute.execute_finalizar_meta_usuario({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, ret, "Meta finalizada e comissao gerada com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/comissoes/meta_finalizar"));
  }
});

rota.post("/comissoes/metas_listar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const rows = await execute.execute_listar_metas_mes({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, rows, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/comissoes/metas_listar"));
  }
});

rota.post("/comissoes/lancamentos_listar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const rows = await execute.execute_listar_comissoes_lancadas_mes({
      ...data,
      empresa_id: empresaId,
    });
    return res.json(utils.jsonMount(true, rows, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/comissoes/lancamentos_listar"));
  }
});

rota.post("/alertas/listar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const rows = await execute.execute_listar_alertas({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, rows, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/alertas/listar"));
  }
});

rota.post("/alertas/marcar_lido", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const row = await execute.execute_marcar_alerta_lido({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row || {}, "Alerta marcado como lido."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/alertas/marcar_lido"));
  }
});

rota.post("/dashboard", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const dashboard = await execute.execute_dashboard(empresaId);
    return res.json(utils.jsonMount(true, dashboard, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/dashboard"));
  }
});

rota.post("/assinaturas/listar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const rows = await execute.execute_listar_assinaturas_empresa({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, rows, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/assinaturas/listar"));
  }
});

rota.post("/assinaturas/criar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const row = await execute.execute_criar_assinatura_empresa({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Assinatura cadastrada com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/assinaturas/criar"));
  }
});

rota.post("/assinaturas/editar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const row = await execute.execute_editar_assinatura_empresa({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Assinatura atualizada com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/assinaturas/editar"));
  }
});

rota.post("/assinaturas/inativar", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const row = await execute.execute_inativar_assinatura_empresa({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, row, "Assinatura inativada com sucesso."));
  } catch (error) {
    if (is_validation_error(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/financeiro/assinaturas/inativar"));
  }
});

rota.post("/assinaturas/cobrancas", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const rows = await execute.execute_listar_assinaturas_cobrancas({ ...data, empresa_id: empresaId });
    return res.json(utils.jsonMount(true, rows, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/assinaturas/cobrancas"));
  }
});

rota.post("/healthcheck", async (req, res) => {
  try {
    const data = payload_or_unauthorized(req, res);
    if (!data) return;

    const empresaId = fn.require_empresa(data, res, utils);
    if (!empresaId) return;

    const checks = await execute.execute_healthcheck(empresaId);
    return res.json(utils.jsonMount(true, checks, "Modulo financeiro ativo."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/financeiro/healthcheck"));
  }
});

module.exports = rota;
