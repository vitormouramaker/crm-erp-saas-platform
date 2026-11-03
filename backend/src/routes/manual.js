const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const execute = require("../services/execute_manual");
const utils = require("../utils/templates");

function parseTokenPayload(req) {
  return security.jwtdecript(req.body);
}

function canManageManual(data) {
  if (data?.is_master) return true;
  const permissions = Array.isArray(data?.permissions) ? data.permissions : [];
  return permissions.includes("settings.view") || permissions.includes("users.manage");
}

function getEmpresaId(data) {
  const empresaId = Number(data?.empresa_id);
  return Number.isInteger(empresaId) && empresaId > 0 ? empresaId : null;
}

function getUsuarioId(data) {
  const usuarioId = Number(data?.id || data?.usuario_id);
  return Number.isInteger(usuarioId) && usuarioId > 0 ? usuarioId : null;
}

rota.post("/listar", async (req, res) => {
  try {
    const data = parseTokenPayload(req);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = getEmpresaId(data);
    if (!empresaId) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    const articles = await execute.execute_list_manual_articles(empresaId);
    return res.json(utils.jsonMount(true, articles, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/manual/listar"));
  }
});

rota.post("/salvar", async (req, res) => {
  try {
    const data = parseTokenPayload(req);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!canManageManual(data)) {
      return res.status(403).json(utils.jsonMount(false, {}, "Acesso negado."));
    }

    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);
    if (!empresaId || !usuarioId) {
      return res.json(utils.jsonMount(false, {}, "Sessao invalida."));
    }

    const article = await execute.execute_save_manual_article(
      empresaId,
      usuarioId,
      data.article || data.artigo || data
    );
    return res.json(utils.jsonMount(true, article, "Artigo salvo com sucesso."));
  } catch (error) {
    return res.json(
      utils.jsonMount(
        false,
        {},
        error instanceof Error ? error.message : "Nao foi possivel salvar o artigo."
      )
    );
  }
});

rota.post("/duplicar", async (req, res) => {
  try {
    const data = parseTokenPayload(req);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!canManageManual(data)) {
      return res.status(403).json(utils.jsonMount(false, {}, "Acesso negado."));
    }

    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);
    const articleId = Number(data.article_id || data.id);
    if (!empresaId || !usuarioId || !Number.isInteger(articleId) || articleId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe artigo valido."));
    }

    const article = await execute.execute_duplicate_manual_article(
      empresaId,
      usuarioId,
      articleId
    );
    return res.json(utils.jsonMount(true, article, "Artigo duplicado com sucesso."));
  } catch (error) {
    return res.json(
      utils.jsonMount(
        false,
        {},
        error instanceof Error ? error.message : "Nao foi possivel duplicar o artigo."
      )
    );
  }
});

rota.post("/apagar", async (req, res) => {
  try {
    const data = parseTokenPayload(req);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!canManageManual(data)) {
      return res.status(403).json(utils.jsonMount(false, {}, "Acesso negado."));
    }

    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);
    const articleId = Number(data.article_id || data.id);
    if (!empresaId || !usuarioId || !Number.isInteger(articleId) || articleId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe artigo valido."));
    }

    const deleted = await execute.execute_delete_manual_article(
      empresaId,
      usuarioId,
      articleId
    );
    if (!deleted.length) {
      return res.json(utils.jsonMount(false, {}, "Artigo nao encontrado."));
    }

    return res.json(utils.jsonMount(true, { id: articleId }, "Artigo excluido."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/manual/apagar"));
  }
});

rota.post("/restaurar_base", async (req, res) => {
  try {
    const data = parseTokenPayload(req);
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!canManageManual(data)) {
      return res.status(403).json(utils.jsonMount(false, {}, "Acesso negado."));
    }

    const empresaId = getEmpresaId(data);
    const usuarioId = getUsuarioId(data);
    if (!empresaId || !usuarioId) {
      return res.json(utils.jsonMount(false, {}, "Sessao invalida."));
    }

    const articles = Array.isArray(data.articles) ? data.articles : [];
    if (!articles.length) {
      return res.json(utils.jsonMount(false, {}, "Informe artigos para restaurar."));
    }

    const created = await execute.execute_reset_manual_articles(
      empresaId,
      usuarioId,
      articles
    );
    return res.json(utils.jsonMount(true, created, "Base do manual restaurada."));
  } catch (error) {
    return res.json(
      utils.jsonMount(
        false,
        {},
        error instanceof Error ? error.message : "Nao foi possivel restaurar a base."
      )
    );
  }
});

module.exports = rota;
