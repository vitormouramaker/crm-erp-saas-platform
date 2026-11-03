const express = require("express");
const rota = express.Router();
const { postgres } = require("../server/connect");
const execute = require("../services/execute_vendas");
const executeScheduledDispatch = require("../services/execute_commercial_scheduled_dispatch");
const userModels = require("../models/models_user");
const security = require("../security/cypher");
const utils = require("../utils/templates");
const upload = require("../utils/multer_config");
const bunny = require("../utils/bunny_config");

const PDV_PERMISSIONS = [
  "sales.view",
  "sales.create",
  "stock.view",
  "stock.products.manage",
  "stock.suppliers.view",
  "stock.orders.view",
  "stock.orders.create",
];

const COMMERCIAL_MANAGER_IMPLIED_PERMISSIONS = [
  "commercial.view",
  "commercial.pipeline",
  "commercial.scheduled_dispatches",
  "commercial.dashbord",
  "commercial.report",
];

const COMMERCIAL_MANAGER_PERMISSION = "commercial.manager";
const COMMERCIAL_PERMISSION_CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.COMMERCIAL_PERMISSION_CACHE_TTL_MS || 15000) || 15000
);
const COMMERCIAL_PERMISSION_CACHE_STALE_TTL_MS = Math.max(
  COMMERCIAL_PERMISSION_CACHE_TTL_MS,
  Number(process.env.COMMERCIAL_PERMISSION_CACHE_STALE_TTL_MS || 300000) || 300000
);
const commercialPermissionCache = new Map();

function getPayload(req) {
  const data = security.jwtdecript(req.body);
  if (!data) {
    return null;
  }
  return data;
}

function forbidden(res, message) {
  return res.status(403).json(utils.jsonMount(false, {}, message));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildEffectivePermissions(contexto = {}) {
  const planoPerms = Array.isArray(contexto.permissoes_plano)
    ? contexto.permissoes_plano
    : [];
  const userPerms = Array.isArray(contexto.permissoes_customizadas)
    ? contexto.permissoes_customizadas
    : [];
  const isMaster = Boolean(contexto.is_master);
  const hasPdv = Boolean(contexto.has_pdv);

  let effectivePermissions = isMaster
    ? [...planoPerms]
    : userPerms.filter(
        (permission) =>
          planoPerms.includes(permission) || permission === COMMERCIAL_MANAGER_PERMISSION
      );

  if (hasPdv) {
    effectivePermissions = [...new Set([...effectivePermissions, ...PDV_PERMISSIONS])];
  }

  if (effectivePermissions.includes(COMMERCIAL_MANAGER_PERMISSION)) {
    effectivePermissions = [
      ...new Set([
        ...effectivePermissions,
        ...COMMERCIAL_MANAGER_IMPLIED_PERMISSIONS,
      ]),
    ];
  }

  return effectivePermissions;
}

function buildPayloadPermissions(payload = {}) {
  const payloadPermissions = Array.isArray(payload?.permissions)
    ? payload.permissions
    : [];

  let effectivePermissions = [...payloadPermissions];

  if (effectivePermissions.includes(COMMERCIAL_MANAGER_PERMISSION)) {
    effectivePermissions = [
      ...new Set([
        ...effectivePermissions,
        ...COMMERCIAL_MANAGER_IMPLIED_PERMISSIONS,
      ]),
    ];
  }

  return effectivePermissions;
}

function buildCommercialPermissionCacheKey(empresaId, usuarioId) {
  return `${Number(empresaId) || 0}:${Number(usuarioId) || 0}`;
}

function clonePermissionCacheEntry(entry) {
  if (!entry) return null;

  return {
    permissions: Array.isArray(entry.permissions) ? [...entry.permissions] : [],
    found: entry.found !== false,
    isMaster: Boolean(entry.isMaster),
    expiresAt: Number(entry.expiresAt) || 0,
    staleUntil: Number(entry.staleUntil) || 0,
  };
}

function readCommercialPermissionCache(empresaId, usuarioId, includeStale = false) {
  const key = buildCommercialPermissionCacheKey(empresaId, usuarioId);
  const entry = commercialPermissionCache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (entry.staleUntil <= now) {
    commercialPermissionCache.delete(key);
    return null;
  }

  if (!includeStale && entry.expiresAt <= now) {
    return null;
  }

  return clonePermissionCacheEntry(entry);
}

function writeCommercialPermissionCache(empresaId, usuarioId, value = {}) {
  if (!COMMERCIAL_PERMISSION_CACHE_STALE_TTL_MS) return;

  commercialPermissionCache.set(buildCommercialPermissionCacheKey(empresaId, usuarioId), {
    permissions: Array.isArray(value.permissions) ? [...value.permissions] : [],
    found: value.found !== false,
    isMaster: Boolean(value.isMaster),
    expiresAt: Date.now() + COMMERCIAL_PERMISSION_CACHE_TTL_MS,
    staleUntil: Date.now() + COMMERCIAL_PERMISSION_CACHE_STALE_TTL_MS,
  });
}

function isTransientCommercialConnectionError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();

  if (["ETIMEDOUT", "ECONNRESET", "EPIPE", "57P01"].includes(code)) {
    return true;
  }

  return (
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("server closed the connection unexpectedly") ||
    message.includes("terminating connection due to administrator command")
  );
}

async function ensureUserPermission(payload, requiredPermission) {
  const empresaId = toNumber(payload?.empresa_id || payload?.empresaId);
  const usuarioId = toNumber(
    payload?.usuario_id ||
      payload?.user_id ||
      payload?.userId ||
      payload?.id_usuario ||
      payload?.id
  );

  if (!empresaId || !usuarioId) {
    return {
      allowed: false,
      message: "Informe empresa e usuario validos.",
    };
  }

  if (Boolean(payload?.is_master)) {
    return {
      allowed: true,
      permissions: buildPayloadPermissions(payload),
    };
  }

  const payloadPermissions = buildPayloadPermissions(payload);
  if (payloadPermissions.includes(requiredPermission)) {
    return {
      allowed: true,
      permissions: payloadPermissions,
    };
  }

  const cachedContext = readCommercialPermissionCache(empresaId, usuarioId);
  if (cachedContext?.found && cachedContext.permissions.includes(requiredPermission)) {
    return {
      allowed: true,
      permissions: cachedContext.permissions,
    };
  }

  let client = null;
  try {
    client = await postgres.connect();
    const contextoRet = await client.query(
      userModels.get_dashboard_contexto_usuario(),
      [usuarioId, empresaId]
    );
    const contexto = contextoRet.rows?.[0] || null;

    if (!contexto) {
      writeCommercialPermissionCache(empresaId, usuarioId, {
        found: false,
        permissions: [],
      });
      return {
        allowed: false,
        message: "Usuario nao encontrado para esta empresa.",
      };
    }

    const permissions = buildEffectivePermissions(contexto);
    writeCommercialPermissionCache(empresaId, usuarioId, {
      found: true,
      permissions,
      isMaster: Boolean(contexto.is_master),
    });

    if (!permissions.includes(requiredPermission)) {
      return {
        allowed: false,
        message: "Voce nao tem permissao para acessar este recurso.",
      };
    }

    return {
      allowed: true,
      permissions,
    };
  } catch (error) {
    const staleContext = readCommercialPermissionCache(empresaId, usuarioId, true);
    if (
      isTransientCommercialConnectionError(error) &&
      staleContext?.found &&
      staleContext.permissions.includes(requiredPermission)
    ) {
      console.warn("[vendas][ensureUserPermission] using stale permission cache", {
        empresa_id: empresaId,
        usuario_id: usuarioId,
        required_permission: requiredPermission,
        error: error?.message || String(error),
      });
      return {
        allowed: true,
        permissions: staleContext.permissions,
      };
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

function unauthorized(res) {
  return res
    .status(401)
    .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
}

function applyResolvedPermissions(payload, permissions = []) {
  if (!payload || !Array.isArray(permissions)) return payload;
  payload.permissions = permissions;
  return payload;
}

function has_error_message(error) {
  return Boolean(error?.message && String(error.message).trim());
}

function isPdfFile(file) {
  return String(file?.mimetype || "").toLowerCase() === "application/pdf";
}

rota.post("/crm_crms", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const permissionCheck = await ensureUserPermission(data, "commercial.view");
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }
    applyResolvedPermissions(data, permissionCheck.permissions);

    const crms = await execute.execute_listar_crms(data);
    return res.json(utils.jsonMount(true, crms, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_crms"));
  }
});

rota.post("/crm_criar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const crm = await execute.execute_criar_crm(data);
    return res.json(utils.jsonMount(true, crm, "CRM criado com sucesso!"));
  } catch (error) {
    if (has_error_message(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/vendas/crm_criar"));
  }
});

rota.post("/crm_editar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    if (!data.crm_id && !data.crmId && !data.id) {
      return res.json(utils.jsonMount(false, {}, "Informe o CRM para editar."));
    }

    const crm = await execute.execute_editar_crm(data);
    return res.json(utils.jsonMount(true, crm, "CRM atualizado com sucesso!"));
  } catch (error) {
    if (has_error_message(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/vendas/crm_editar"));
  }
});

rota.post("/crm_coluna_criar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const etapa = await execute.execute_criar_coluna_crm(data);
    return res.json(utils.jsonMount(true, etapa, "Coluna criada com sucesso!"));
  } catch (error) {
    console.error("[/vendas/crm_coluna_criar] erro", {
      code: error?.code || null,
      constraint: error?.constraint || null,
      detail: error?.detail || null,
      message: error?.message || String(error),
    });
    if (has_error_message(error)) {
      return res.json(utils.jsonMount(false, {}, error.message));
    }
    return res.json(utils.errorHandle(error, "/vendas/crm_coluna_criar"));
  }
});

rota.post("/crm_coluna_editar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    if (!data.etapa_id && !data.etapaId && !data.id) {
      return res.json(utils.jsonMount(false, {}, "Informe a coluna para editar."));
    }

    const etapa = await execute.execute_editar_coluna_crm(data);
    return res.json(utils.jsonMount(true, etapa, "Coluna atualizada com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_coluna_editar"));
  }
});

rota.post("/crm_coluna_reordenar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const etapas = await execute.execute_reordenar_colunas_crm(data);
    return res.json(utils.jsonMount(true, etapas, "Colunas reordenadas com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_coluna_reordenar"));
  }
});

rota.post("/crm_coluna_deletar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    if (!data.etapa_id && !data.etapaId && !data.id) {
      return res.json(utils.jsonMount(false, {}, "Informe a coluna para apagar."));
    }

    const etapas = await execute.execute_deletar_coluna_crm(data);
    return res.json(utils.jsonMount(true, etapas, "Coluna removida com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_coluna_deletar"));
  }
});

rota.post("/crm_dominios", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const permissionCheck = await ensureUserPermission(data, "commercial.pipeline");
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }
    applyResolvedPermissions(data, permissionCheck.permissions);

    const dominios = await execute.execute_obter_dominios_crm(data);
    return res.json(utils.jsonMount(true, dominios, ""));
  } catch (error) {
    console.error("[/vendas/crm_dominios] erro:", error);
    return res.json(utils.errorHandle(error, "/vendas/crm_dominios"));
  }
});

rota.post("/crm_buscar_clientes", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const clientes = await execute.execute_buscar_clientes(data);
    return res.json(utils.jsonMount(true, clientes, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_buscar_clientes"));
  }
});

rota.post("/crm_produtos", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const produtos = await execute.execute_listar_produtos_crm(data);
    return res.json(utils.jsonMount(true, produtos, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_produtos"));
  }
});

rota.post("/crm_produto_criar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const produto = await execute.execute_criar_produto_crm(data);
    return res.json(utils.jsonMount(true, produto, "Produto criado com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_produto_criar"));
  }
});

rota.post("/crm_produto_editar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    if (!data.produto_id && !data.produtoId && !data.id) {
      return res.json(utils.jsonMount(false, {}, "Informe o produto para editar."));
    }

    const produto = await execute.execute_editar_produto_crm(data);
    return res.json(utils.jsonMount(true, produto, "Produto atualizado com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_produto_editar"));
  }
});

rota.post("/crm_produto_deletar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    if (!data.produto_id && !data.produtoId && !data.id) {
      return res.json(utils.jsonMount(false, {}, "Informe o produto para apagar."));
    }

    await execute.execute_deletar_produto_crm(data);
    return res.json(utils.jsonMount(true, {}, "Produto removido com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_produto_deletar"));
  }
});

rota.post("/crm_produto_upload_imagens", upload.array("files", 3), async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const empresaId = Number(data.empresa_id || data.empresaId);
    const produtoId = Number(data.produto_id || data.produtoId || data.id);
    const files = Array.isArray(req.files) ? req.files : [];

    if (!Number.isInteger(empresaId) || empresaId <= 0 || !Number.isInteger(produtoId) || produtoId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa e produto validos."));
    }

    if (!files.length) {
      return res.json(utils.jsonMount(false, {}, "Nenhuma imagem foi enviada."));
    }

    const produto = await execute.execute_get_produto_crm_by_id(empresaId, produtoId);
    if (!produto || produto.ativo === false) {
      return res.json(utils.jsonMount(false, {}, "Produto comercial nao encontrado."));
    }

    const totalAtual = await execute.execute_contar_imagens_produto_crm(empresaId, produtoId);
    if (totalAtual + files.length > 3) {
      return res.json(
        utils.jsonMount(false, {}, "Cada produto comercial pode ter no maximo 3 imagens.")
      );
    }

    for (const file of files) {
      if (!String(file.mimetype || "").startsWith("image/")) {
        return res.json(
          utils.jsonMount(false, {}, "Apenas arquivos de imagem sao permitidos.")
        );
      }
      if (Number(file.size || 0) > 10 * 1024 * 1024) {
        return res.json(
          utils.jsonMount(false, {}, "Cada imagem deve ter no maximo 10MB.")
        );
      }
    }

    for (const file of files) {
      const filePath = bunny.generateFileName(
        file.originalname,
        `crm_produto_${produtoId}`
      );
      const uploaded = await bunny.uploadFile(filePath, file.buffer);
      await execute.execute_adicionar_imagem_produto_crm({
        empresaId,
        produtoId,
        url: uploaded.file,
        pathBunny: filePath,
        nomeArquivo: file.originalname,
        mimeType: file.mimetype || null,
        tamanhoBytes: file.size || null,
      });
    }

    const atualizado = await execute.execute_get_produto_crm_by_id(empresaId, produtoId);
    return res.json(
      utils.jsonMount(true, atualizado, "Imagens do produto atualizadas com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_produto_upload_imagens"));
  }
});

rota.post("/crm_produto_imagem_deletar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const empresaId = Number(data.empresa_id || data.empresaId);
    const imagemId = Number(data.imagem_id || data.imagemId || data.id);

    if (!Number.isInteger(empresaId) || empresaId <= 0 || !Number.isInteger(imagemId) || imagemId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa e imagem validas."));
    }

    const imagem = await execute.execute_get_produto_imagem_by_id(imagemId, empresaId);
    if (!imagem || imagem.ativo === false) {
      return res.json(utils.jsonMount(false, {}, "Imagem nao encontrada."));
    }

    await execute.execute_deletar_imagem_produto_crm(imagemId, empresaId);
    if (imagem.path_bunny) {
      await bunny.deleteFile(imagem.path_bunny);
    }

    const atualizado = await execute.execute_get_produto_crm_by_id(
      empresaId,
      Number(imagem.comercial_produto_id)
    );
    return res.json(
      utils.jsonMount(true, atualizado, "Imagem removida com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_produto_imagem_deletar"));
  }
});

rota.post("/crm_produto_upload_documento", upload.single("document"), async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const empresaId = Number(data.empresa_id || data.empresaId);
    const produtoId = Number(data.produto_id || data.produtoId || data.id);
    const file = req.file || null;

    if (!Number.isInteger(empresaId) || empresaId <= 0 || !Number.isInteger(produtoId) || produtoId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa e produto validos."));
    }

    if (!file) {
      return res.json(utils.jsonMount(false, {}, "Nenhum documento foi enviado."));
    }

    const produto = await execute.execute_get_produto_crm_by_id(empresaId, produtoId);
    if (!produto || produto.ativo === false) {
      return res.json(utils.jsonMount(false, {}, "Produto comercial nao encontrado."));
    }

    if (!isPdfFile(file)) {
      return res.json(utils.jsonMount(false, {}, "Apenas arquivos PDF sao permitidos."));
    }

    if (Number(file.size || 0) > PRODUCT_DOCUMENT_FILE_SIZE_LIMIT_BYTES) {
      return res.json(utils.jsonMount(false, {}, "O documento deve ter no maximo 60MB."));
    }

    const totalAtual = await execute.execute_contar_documentos_produto_crm(empresaId, produtoId);
    if (totalAtual >= 1) {
      return res.json(
        utils.jsonMount(false, {}, "Cada produto comercial pode ter no maximo 1 documento PDF.")
      );
    }

    const filePath = bunny.generateFileName(
      file.originalname,
      `crm_produto_documento_${produtoId}`
    );
    const uploaded = await bunny.uploadFile(filePath, file.buffer);
    await execute.execute_adicionar_documento_produto_crm({
      empresaId,
      produtoId,
      url: uploaded.file,
      pathBunny: filePath,
      nomeArquivo: file.originalname,
      mimeType: file.mimetype || null,
      tamanhoBytes: file.size || null,
    });

    const atualizado = await execute.execute_get_produto_crm_by_id(empresaId, produtoId);
    return res.json(
      utils.jsonMount(true, atualizado, "Documento do produto atualizado com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_produto_upload_documento"));
  }
});

rota.post("/crm_produto_documento_deletar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const empresaId = Number(data.empresa_id || data.empresaId);
    const documentoId = Number(data.documento_id || data.documentoId || data.id);

    if (!Number.isInteger(empresaId) || empresaId <= 0 || !Number.isInteger(documentoId) || documentoId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa e documento validos."));
    }

    const documento = await execute.execute_get_produto_documento_by_id(documentoId, empresaId);
    if (!documento || documento.ativo === false) {
      return res.json(utils.jsonMount(false, {}, "Documento nao encontrado."));
    }

    await execute.execute_deletar_documento_produto_crm(documentoId, empresaId);
    if (documento.path_bunny) {
      await bunny.deleteFile(documento.path_bunny);
    }

    const atualizado = await execute.execute_get_produto_crm_by_id(
      empresaId,
      Number(documento.comercial_produto_id)
    );
    return res.json(
      utils.jsonMount(true, atualizado, "Documento removido com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_produto_documento_deletar"));
  }
});

rota.post("/crm_negocios", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const permissionCheck = await ensureUserPermission(data, "commercial.pipeline");
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }
    applyResolvedPermissions(data, permissionCheck.permissions);

    const negocios = await execute.execute_listar_negocios(data);
    return res.json(utils.jsonMount(true, negocios, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_negocios"));
  }
});

rota.post("/crm_negocios_fechados", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const permissionCheck = await ensureUserPermission(
      data,
      "commercial.pipeline"
    );
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }
    applyResolvedPermissions(data, permissionCheck.permissions);

    const negocios = await execute.execute_listar_negocios_fechados(data);
    return res.json(utils.jsonMount(true, negocios, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_negocios_fechados"));
  }
});

rota.post("/vendas_consolidadas", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const permissionCheck = await ensureUserPermission(data, "commercial.pipeline");
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }
    applyResolvedPermissions(data, permissionCheck.permissions);

    const vendas = await execute.execute_listar_vendas_consolidadas(data);
    return res.json(utils.jsonMount(true, vendas, ""));
  } catch (error) {
    console.error("[/vendas/vendas_consolidadas] erro:", error);
    return res.json(utils.errorHandle(error, "/vendas/vendas_consolidadas"));
  }
});

rota.post("/vendas_consolidadas_importar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);
    const permissionCheck = await ensureUserPermission(data, "commercial.manager");
    if (!permissionCheck.allowed) return forbidden(res, permissionCheck.message);
    applyResolvedPermissions(data, permissionCheck.permissions);
    return res.json(utils.jsonMount(true, await execute.execute_importar_vendas_consolidadas(data), "Vendas importadas com sucesso."));
  } catch (error) {
    console.error("[/vendas/vendas_consolidadas_importar] erro:", error);
    return res.json(utils.errorHandle(error, "/vendas/vendas_consolidadas_importar"));
  }
});

rota.post("/venda_importada_editar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);
    const permissionCheck = await ensureUserPermission(data, "commercial.manager");
    if (!permissionCheck.allowed) return forbidden(res, permissionCheck.message);
    applyResolvedPermissions(data, permissionCheck.permissions);
    const venda = await execute.execute_editar_venda_importada(data);
    return res.json(utils.jsonMount(true, venda, "Venda importada atualizada com sucesso."));
  } catch (error) {
    console.error("[/vendas/venda_importada_editar] erro:", error);
    return res.json(utils.errorHandle(error, "/vendas/venda_importada_editar"));
  }
});

rota.post("/venda_integracao_atribuir_vendedor", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);
    const permissionCheck = await ensureUserPermission(data, "commercial.manager");
    if (!permissionCheck.allowed) return forbidden(res, permissionCheck.message);
    applyResolvedPermissions(data, permissionCheck.permissions);
    const venda = await execute.execute_atribuir_vendedor_venda_integracao(data);
    return res.json(utils.jsonMount(true, venda, "Vendedor atribuido com sucesso."));
  } catch (error) {
    console.error("[/vendas/venda_integracao_atribuir_vendedor] erro:", error);
    return res.json(utils.errorHandle(error, "/vendas/venda_integracao_atribuir_vendedor"));
  }
});

rota.post("/venda_consolidada_excluir", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);
    const permissionCheck = await ensureUserPermission(data, "commercial.manager");
    if (!permissionCheck.allowed) return forbidden(res, permissionCheck.message);
    applyResolvedPermissions(data, permissionCheck.permissions);
    const venda = await execute.execute_excluir_venda_consolidada(data);
    return res.json(utils.jsonMount(true, venda, "Venda excluida com sucesso."));
  } catch (error) {
    console.error("[/vendas/venda_consolidada_excluir] erro:", error);
    return res.json(utils.errorHandle(error, "/vendas/venda_consolidada_excluir"));
  }
});

rota.post("/crm_dashboard", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const permissionCheck = await ensureUserPermission(data, "commercial.dashbord");
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }
    applyResolvedPermissions(data, permissionCheck.permissions);

    const dashboard = await execute.execute_dashboard_crm(data);
    return res.json(utils.jsonMount(true, dashboard, ""));
  } catch (error) {
    console.error("[/vendas/crm_dashboard] erro:", error);
    return res.json(utils.errorHandle(error, "/vendas/crm_dashboard"));
  }
});

rota.post("/crm_relatorios", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const permissionCheck = await ensureUserPermission(data, "commercial.report");
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }
    applyResolvedPermissions(data, permissionCheck.permissions);

    const relatorio = await execute.execute_relatorio_crm(data);
    return res.json(utils.jsonMount(true, relatorio, ""));
  } catch (error) {
    console.error("[/vendas/crm_relatorios] erro:", error);
    return res.json(utils.errorHandle(error, "/vendas/crm_relatorios"));
  }
});

rota.post("/crm_relatorios_conversas_empresa", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const permissionCheck = await ensureUserPermission(data, "commercial.report");
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }
    applyResolvedPermissions(data, permissionCheck.permissions);

    if (!Boolean(data.is_master)) {
      return forbidden(
        res,
        "A exportacao completa das conversas da empresa esta disponivel apenas para administradores."
      );
    }

    const conversas = await execute.execute_relatorio_conversas_empresa(data);
    return res.json(utils.jsonMount(true, conversas, ""));
  } catch (error) {
    console.error("[/vendas/crm_relatorios_conversas_empresa] erro:", error);
    return res.json(
      utils.errorHandle(error, "/vendas/crm_relatorios_conversas_empresa")
    );
  }
});

rota.post("/crm_historico_cliente", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    if (!data.negocio_id && !data.dealId && !data.id) {
      return res.json(
        utils.jsonMount(false, {}, "Informe o negócio para carregar o histórico.")
      );
    }

    const historico = await execute.execute_historico_cliente(data);
    return res.json(utils.jsonMount(true, historico, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_historico_cliente"));
  }
});

rota.post("/crm_registrar_interacao", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const interacao = await execute.execute_registrar_interacao(data);
    return res.json(utils.jsonMount(true, interacao, "Interação registrada com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_registrar_interacao"));
  }
});

rota.post("/crm_agendamentos_calendario", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const permissionCheck = await ensureUserPermission(data, "commercial.pipeline");
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }
    applyResolvedPermissions(data, permissionCheck.permissions);

    const agenda = await execute.execute_listar_agendamentos_calendario(data);
    return res.json(utils.jsonMount(true, agenda, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_agendamentos_calendario"));
  }
});

rota.post("/crm_agendamentos_disparo", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);
    const permissionCheck = await ensureUserPermission(
      data,
      "commercial.scheduled_dispatches"
    );
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }

    const agendamentos = await executeScheduledDispatch.listScheduledDispatches(data);
    return res.json(utils.jsonMount(true, agendamentos, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_agendamentos_disparo"));
  }
});

rota.post("/crm_agendamento_disparo_criar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);
    const permissionCheck = await ensureUserPermission(
      data,
      "commercial.scheduled_dispatches"
    );
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }

    const agendamento = await executeScheduledDispatch.createScheduledDispatch(data);
    return res.json(
      utils.jsonMount(true, agendamento, "Agendamento de disparo criado com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_agendamento_disparo_criar"));
  }
});

rota.post("/crm_agendamento_disparo_cancelar", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);
    const permissionCheck = await ensureUserPermission(
      data,
      "commercial.scheduled_dispatches"
    );
    if (!permissionCheck.allowed) {
      return forbidden(res, permissionCheck.message);
    }

    const agendamento = await executeScheduledDispatch.cancelScheduledDispatch(data);
    return res.json(
      utils.jsonMount(true, agendamento, "Agendamento de disparo cancelado com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_agendamento_disparo_cancelar"));
  }
});

rota.post("/crm_finalizar_interacao", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const resultado = await execute.execute_finalizar_interacao(data);
    return res.json(utils.jsonMount(true, resultado, "InteraÃ§Ã£o finalizada com sucesso!"));
  } catch (error) {
    console.error("[/vendas/crm_finalizar_interacao] erro:", error);
    return res.json(utils.errorHandle(error, "/vendas/crm_finalizar_interacao"));
  }
});

rota.post("/crm_criar_negocio", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    const negocio = await execute.execute_criar_negocio(data);
    return res.json(utils.jsonMount(true, negocio, "Negócio criado com sucesso!"));
  } catch (error) {
    console.error("[/vendas/crm_criar_negocio] erro:", error);
    return res.json(utils.errorHandle(error, "/vendas/crm_criar_negocio"));
  }
});

rota.post("/crm_editar_negocio", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    if (!data.id && !data.negocio_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o ID do negócio."));
    }

    const negocio = await execute.execute_atualizar_negocio(data);
    return res.json(
      utils.jsonMount(true, negocio, "Negócio atualizado com sucesso!")
    );
  } catch (error) {
    console.error("[/vendas/crm_editar_negocio] erro:", error);
    return res.json(utils.errorHandle(error, "/vendas/crm_editar_negocio"));
  }
});

rota.post("/crm_mover_negocio", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);
    if (!(data.negocio_id  || data.etapa_id)) {
      return res.json(
        utils.jsonMount(false, {}, "Informe o negócio e a etapa de destino.")
      );
    }
    await execute.execute_mover_negocio(data);
    return res.json(utils.jsonMount(true, {}, "Negócio movido com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_mover_negocio"));
  }
});

rota.post("/crm_deletar_negocio", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    if (!data.negocio_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o ID do negócio."));
    }

    await execute.execute_deletar_negocio(data);
    return res.json(utils.jsonMount(true, {}, "Negócio removido com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_deletar_negocio"));
  }
});

rota.post("/crm_deletar_negocios_coluna", async (req, res) => {
  try {
    const data = getPayload(req);
    if (!data) return unauthorized(res);

    if (!data.crm_id && !data.crmId) {
      return res.json(utils.jsonMount(false, {}, "Informe o CRM da coluna."));
    }

    if (!data.etapa_id && !data.etapaId && !data.stageId) {
      return res.json(utils.jsonMount(false, {}, "Informe a coluna a ser esvaziada."));
    }

    const result = await execute.execute_deletar_negocios_coluna(data);
    const deletedCount = Number(result?.deletedCount || 0);

    return res.json(
      utils.jsonMount(
        true,
        result,
        deletedCount > 0
          ? `${deletedCount} card(s) removido(s) da coluna com sucesso!`
          : "Nenhum card ativo foi encontrado nesta coluna."
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/vendas/crm_deletar_negocios_coluna"));
  }
});

module.exports = rota;
const PRODUCT_DOCUMENT_FILE_SIZE_LIMIT_BYTES = 60 * 1024 * 1024;
