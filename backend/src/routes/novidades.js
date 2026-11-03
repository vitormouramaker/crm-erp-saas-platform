const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const execute = require("../services/execute_novidades");
const utils = require("../utils/templates");

function getAuthData(req) {
  return security.jwtdecript(req.body);
}

function getEmpresaId(data) {
  const empresaId = Number(data?.empresa_id || 0);
  return Number.isInteger(empresaId) && empresaId > 0 ? empresaId : null;
}

function getUsuarioId(data) {
  const usuarioId = Number(data?.usuario_id || data?.user_id || data?.id || 0);
  return Number.isInteger(usuarioId) && usuarioId > 0 ? usuarioId : null;
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "sim", "yes"].includes(normalized)) return true;
  if (["false", "0", "nao", "no"].includes(normalized)) return false;
  return fallback;
}

function getExternalNewsToken(req) {
  const headerToken =
    req.headers["x-novidades-token"] ||
    req.headers["x-news-token"] ||
    req.headers.authorization;

  const raw = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  const normalized = String(raw || "").trim();

  if (normalized.toLowerCase().startsWith("bearer ")) {
    return normalized.slice(7).trim();
  }

  return normalized;
}

function canPublishExternalNews(req, body = {}) {
  const configuredToken = String(process.env.NOVIDADES_EXTERNAL_TOKEN || "").trim();
  if (!configuredToken) {
    return {
      allowed: false,
      message: "NOVIDADES_EXTERNAL_TOKEN nao configurado no backend.",
    };
  }

  const requestToken =
    getExternalNewsToken(req) || String(body?.token || body?.external_token || "").trim();

  if (!requestToken || !security.timingSafeEqualText(requestToken, configuredToken)) {
    return {
      allowed: false,
      message: "Token externo de novidades invalido.",
    };
  }

  return { allowed: true };
}

function canManageNews(data) {
  return Boolean(data?.is_master);
}

rota.post("/publicar_externa", async (req, res) => {
  try {
    const auth = canPublishExternalNews(req, req.body);
    if (!auth.allowed) {
      return res.status(401).json(utils.jsonMount(false, {}, auth.message));
    }

    const empresaId = Number(req.body?.empresa_id || 0);
    if (!Number.isInteger(empresaId) || empresaId < 0) {
      return res.json(
        utils.jsonMount(false, {}, "Informe empresa_id valido. Use 0 para notificacao global.")
      );
    }

    const ret = await execute.execute_criar_novidade_externa({
      empresa_id: empresaId,
      titulo: req.body?.titulo,
      resumo: req.body?.resumo,
      conteudo: req.body?.conteudo,
      media_url: req.body?.media_url,
      media_type: req.body?.media_type,
      tipo: req.body?.tipo,
      destaque: normalizeBoolean(req.body?.destaque, false),
      modal_destaque: normalizeBoolean(req.body?.modal_destaque, false),
      apenas_master: normalizeBoolean(req.body?.apenas_master, false),
      data_publicacao: req.body?.data_publicacao,
    });

    return res.json(utils.jsonMount(true, ret, "Novidade externa publicada com sucesso."));
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel publicar a novidade externa.")
    );
  }
});

rota.post("/listar", async (req, res) => {
  try {
    const data = getAuthData(req);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);
    const page = Number(data?.page || 1);
    const limit = Number(data?.limit || 20);
    const onlyUnread = normalizeBoolean(data?.only_unread, false);
    const includeHighlight = normalizeBoolean(data?.include_highlight, true);
    const isMaster = canManageNews(data);

    if (!empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    if (!usuarioId) {
      return res.json(utils.jsonMount(false, {}, "Informe usuario_id valido."));
    }

    const ret = await execute.execute_listar_novidades_usuario(empresaId, usuarioId, {
      page,
      limit,
      onlyUnread,
      includeHighlight,
      isMaster,
    });

    return res.json(utils.jsonMount(true, ret, ""));
  } catch (error) {
    return res.json(utils.jsonMount(false, {}, error?.message || "Nao foi possivel listar as novidades."));
  }
});

rota.post("/visualizar", async (req, res) => {
  try {
    const data = getAuthData(req);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);
    const novidadeId = Number(data?.novidade_id || 0);
    const isMaster = canManageNews(data);

    if (!empresaId || !usuarioId || !Number.isInteger(novidadeId) || novidadeId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe a novidade corretamente."));
    }

    const ret = await execute.execute_registrar_visualizacao(
      novidadeId,
      usuarioId,
      empresaId,
      isMaster
    );
    return res.json(utils.jsonMount(true, ret || {}, "Visualizacao registrada."));
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel registrar a visualizacao.")
    );
  }
});

rota.post("/marcar_lida", async (req, res) => {
  try {
    const data = getAuthData(req);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);
    const novidadeId = Number(data?.novidade_id || 0);
    const isMaster = canManageNews(data);

    if (!empresaId || !usuarioId || !Number.isInteger(novidadeId) || novidadeId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe a novidade corretamente."));
    }

    const ret = await execute.execute_marcar_novidade_lida(
      novidadeId,
      usuarioId,
      empresaId,
      isMaster
    );
    return res.json(utils.jsonMount(true, ret || {}, "Novidade marcada como lida."));
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel marcar a novidade como lida.")
    );
  }
});

rota.post("/marcar_todas_lidas", async (req, res) => {
  try {
    const data = getAuthData(req);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);
    const isMaster = canManageNews(data);

    if (!empresaId || !usuarioId) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa e usuario validos."));
    }

    const ret = await execute.execute_marcar_todas_lidas(empresaId, usuarioId, isMaster);
    return res.json(utils.jsonMount(true, ret, "Todas as novidades foram marcadas como lidas."));
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel marcar todas as novidades como lidas.")
    );
  }
});

rota.post("/dispensar_destaque", async (req, res) => {
  try {
    const data = getAuthData(req);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);
    const novidadeId = Number(data?.novidade_id || 0);
    const isMaster = canManageNews(data);

    if (!empresaId || !usuarioId || !Number.isInteger(novidadeId) || novidadeId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe a novidade corretamente."));
    }

    const ret = await execute.execute_dispensar_modal_destaque(
      novidadeId,
      usuarioId,
      empresaId,
      isMaster
    );
    return res.json(utils.jsonMount(true, ret || {}, "Destaque dispensado."));
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel dispensar este destaque.")
    );
  }
});

rota.post("/gerenciar_listar", async (req, res) => {
  try {
    const data = getAuthData(req);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!canManageNews(data)) {
      return res.status(403).json(utils.jsonMount(false, {}, "Voce nao possui acesso para gerenciar novidades."));
    }

    const empresaId = getEmpresaId(data);
    const limit = Number(data?.limit || 100);

    if (!empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    const ret = await execute.execute_listar_novidades_admin(empresaId, limit);
    return res.json(utils.jsonMount(true, ret, ""));
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel listar as novidades.")
    );
  }
});

rota.post("/criar", async (req, res) => {
  try {
    const data = getAuthData(req);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!canManageNews(data)) {
      return res.status(403).json(utils.jsonMount(false, {}, "Voce nao possui acesso para criar novidades."));
    }

    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);

    if (!empresaId || !usuarioId) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa e usuario validos."));
    }

    const ret = await execute.execute_criar_novidade({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      titulo: data?.titulo,
      resumo: data?.resumo,
      conteudo: data?.conteudo,
      media_url: data?.media_url,
      media_type: data?.media_type,
      tipo: data?.tipo,
      destaque: normalizeBoolean(data?.destaque, false),
      modal_destaque: normalizeBoolean(data?.modal_destaque, false),
      apenas_master: normalizeBoolean(data?.apenas_master, false),
      data_publicacao: data?.data_publicacao,
    });

    return res.json(utils.jsonMount(true, ret, "Novidade publicada com sucesso."));
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel publicar a novidade.")
    );
  }
});

rota.post("/editar", async (req, res) => {
  try {
    const data = getAuthData(req);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!canManageNews(data)) {
      return res.status(403).json(utils.jsonMount(false, {}, "Voce nao possui acesso para editar novidades."));
    }

    const id = Number(data?.id || 0);
    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);

    if (!empresaId || !usuarioId || !Number.isInteger(id) || id <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe a novidade corretamente."));
    }

    const ret = await execute.execute_editar_novidade({
      id,
      empresa_id: empresaId,
      usuario_id: usuarioId,
      titulo: data?.titulo,
      resumo: data?.resumo,
      conteudo: data?.conteudo,
      media_url: data?.media_url,
      media_type: data?.media_type,
      tipo: data?.tipo,
      destaque: normalizeBoolean(data?.destaque, false),
      modal_destaque: normalizeBoolean(data?.modal_destaque, false),
      apenas_master: normalizeBoolean(data?.apenas_master, false),
      data_publicacao: data?.data_publicacao,
    });

    return res.json(utils.jsonMount(true, ret, "Novidade atualizada com sucesso."));
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel atualizar a novidade.")
    );
  }
});

rota.post("/inativar", async (req, res) => {
  try {
    const data = getAuthData(req);
    if (!data) {
      return res.status(401).json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!canManageNews(data)) {
      return res.status(403).json(utils.jsonMount(false, {}, "Voce nao possui acesso para inativar novidades."));
    }

    const id = Number(data?.id || 0);
    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);

    if (!empresaId || !usuarioId || !Number.isInteger(id) || id <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe a novidade corretamente."));
    }

    const ret = await execute.execute_inativar_novidade({
      id,
      empresa_id: empresaId,
      usuario_id: usuarioId,
    });

    return res.json(utils.jsonMount(true, ret, "Novidade inativada com sucesso."));
  } catch (error) {
    return res.json(
      utils.jsonMount(false, {}, error?.message || "Nao foi possivel inativar a novidade.")
    );
  }
});

module.exports = rota;
