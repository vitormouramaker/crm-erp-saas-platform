const models = require("../models/models_novidades");
const { postgres } = require("../server/connect");

const VALID_TYPES = new Set(["feature", "improvement", "fix", "warning", "notice"]);
const VALID_MEDIA_TYPES = new Set(["image", "video"]);

function normalizeText(value, maxLength) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "notice";
  return VALID_TYPES.has(normalized) ? normalized : "notice";
}

function inferMediaTypeFromUrl(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .split("?")[0]
    .split("#")[0];

  if (!normalized) return null;
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(normalized)) return "image";
  if (/\.(mp4|webm|mov|m4v|ogg)$/.test(normalized)) return "video";
  return null;
}

function normalizeMediaUrl(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeMediaType(value, mediaUrl) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (VALID_MEDIA_TYPES.has(normalized)) {
    return normalized;
  }

  if (mediaUrl) {
    return inferMediaTypeFromUrl(mediaUrl);
  }

  return null;
}

function normalizeDateTime(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Informe uma data de publicacao valida.");
  }
  return parsed.toISOString();
}

function normalizeNewsRow(row = {}) {
  return {
    id: Number(row.id || 0),
    empresa_id: Number(row.empresa_id || 0),
    titulo: String(row.titulo || ""),
    resumo: row.resumo ? String(row.resumo) : "",
    conteudo: String(row.conteudo || ""),
    media_url: row.media_url ? String(row.media_url) : "",
    media_type: row.media_type ? String(row.media_type) : null,
    tipo: String(row.tipo || "notice"),
    destaque: Boolean(row.destaque),
    modal_destaque: Boolean(row.modal_destaque),
    apenas_master: Boolean(row.apenas_master),
    ativo: row.ativo === undefined ? true : Boolean(row.ativo),
    lida: Boolean(row.lida),
    data_publicacao: row.data_publicacao || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    visualizado_em: row.visualizado_em || null,
    lida_em: row.lida_em || null,
    modal_dispensado_em: row.modal_dispensado_em || null,
    criado_por_usuario_id: row.criado_por_usuario_id
      ? Number(row.criado_por_usuario_id)
      : null,
    atualizado_por_usuario_id: row.atualizado_por_usuario_id
      ? Number(row.atualizado_por_usuario_id)
      : null,
  };
}

function mapSchemaError(error) {
  if (String(error?.code || "").toUpperCase() === "42P01") {
    const schemaError = new Error(
      "Schema de Novidades nao encontrado. Execute o arquivo docs/sql/novidades_runtime_schema.sql no banco."
    );
    schemaError.code = error.code;
    throw schemaError;
  }

  throw error;
}

const execute = {
  execute_listar_novidades_usuario: async (
    empresa_id,
    usuario_id,
    { page = 1, limit = 20, onlyUnread = null, includeHighlight = true, isMaster = false } = {}
  ) => {
    const client = await postgres.connect();
    try {
      const safePage = Math.max(Number(page) || 1, 1);
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
      const offset = (safePage - 1) * safeLimit;

      const listRet = await client.query(models.listar_novidades_usuario(), [
        empresa_id,
        usuario_id,
        Boolean(isMaster),
        onlyUnread === true ? false : null,
        safeLimit,
        offset,
      ]);

      const unreadRet = await client.query(models.contar_novidades_nao_lidas(), [
        empresa_id,
        usuario_id,
        Boolean(isMaster),
      ]);

      const highlightRet = includeHighlight
        ? await client.query(models.obter_modal_destaque_usuario(), [
            empresa_id,
            usuario_id,
            Boolean(isMaster),
          ])
        : { rows: [] };

      const rows = Array.isArray(listRet.rows) ? listRet.rows : [];
      const total = Number(rows[0]?.total_count || 0);

      return {
        items: rows.map(normalizeNewsRow),
        unread_count: Number(unreadRet.rows?.[0]?.total || 0),
        highlight: highlightRet.rows?.[0] ? normalizeNewsRow(highlightRet.rows[0]) : null,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          total_pages: total > 0 ? Math.ceil(total / safeLimit) : 1,
          has_next: offset + rows.length < total,
        },
      };
    } catch (error) {
      mapSchemaError(error);
    } finally {
      client.release();
    }
  },

  execute_registrar_visualizacao: async (novidade_id, usuario_id, empresa_id, is_master = false) => {
    const client = await postgres.connect();
    try {
      const existsRet = await client.query(models.get_novidade_by_id(), [
        novidade_id,
        empresa_id,
        Boolean(is_master),
      ]);
      if (!existsRet.rows?.length) {
        throw new Error("Novidade nao encontrada.");
      }

      const ret = await client.query(models.registrar_visualizacao_usuario(), [
        novidade_id,
        usuario_id,
      ]);
      return ret.rows?.[0] || null;
    } catch (error) {
      mapSchemaError(error);
    } finally {
      client.release();
    }
  },

  execute_marcar_novidade_lida: async (novidade_id, usuario_id, empresa_id, is_master = false) => {
    const client = await postgres.connect();
    try {
      const existsRet = await client.query(models.get_novidade_by_id(), [
        novidade_id,
        empresa_id,
        Boolean(is_master),
      ]);
      if (!existsRet.rows?.length) {
        throw new Error("Novidade nao encontrada.");
      }

      const ret = await client.query(models.marcar_novidade_lida(), [novidade_id, usuario_id]);
      return ret.rows?.[0] || null;
    } catch (error) {
      mapSchemaError(error);
    } finally {
      client.release();
    }
  },

  execute_marcar_todas_lidas: async (empresa_id, usuario_id, is_master = false) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.marcar_todas_novidades_lidas(), [
        empresa_id,
        usuario_id,
        Boolean(is_master),
      ]);
      return {
        total: Array.isArray(ret.rows) ? ret.rows.length : 0,
      };
    } catch (error) {
      mapSchemaError(error);
    } finally {
      client.release();
    }
  },

  execute_dispensar_modal_destaque: async (novidade_id, usuario_id, empresa_id, is_master = false) => {
    const client = await postgres.connect();
    try {
      const existsRet = await client.query(models.get_novidade_by_id(), [
        novidade_id,
        empresa_id,
        Boolean(is_master),
      ]);
      if (!existsRet.rows?.length) {
        throw new Error("Novidade nao encontrada.");
      }

      const ret = await client.query(models.dispensar_modal_destaque_usuario(), [
        novidade_id,
        usuario_id,
      ]);
      return ret.rows?.[0] || null;
    } catch (error) {
      mapSchemaError(error);
    } finally {
      client.release();
    }
  },

  execute_listar_novidades_admin: async (empresa_id, limit = 100) => {
    const client = await postgres.connect();
    try {
      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
      const ret = await client.query(models.listar_novidades_admin(), [empresa_id, safeLimit]);
      return Array.isArray(ret.rows) ? ret.rows.map(normalizeNewsRow) : [];
    } catch (error) {
      mapSchemaError(error);
    } finally {
      client.release();
    }
  },

  execute_criar_novidade: async ({
    empresa_id,
    usuario_id,
    titulo,
    resumo,
    conteudo,
    media_url,
    media_type,
    tipo,
    destaque,
    modal_destaque,
    apenas_master,
    data_publicacao,
  }) => {
    const safeTitulo = normalizeText(titulo, 180);
    const safeResumo = normalizeText(resumo, 320);
    const safeConteudo = normalizeText(conteudo, 12000);
    const safeMediaUrl = normalizeMediaUrl(media_url);
    const safeMediaType = normalizeMediaType(media_type, safeMediaUrl);

    if (!safeTitulo) {
      throw new Error("Informe o titulo da novidade.");
    }

    if (!safeConteudo) {
      throw new Error("Informe o conteudo da novidade.");
    }

    if (safeMediaUrl && !safeMediaType) {
      throw new Error("Informe um media_type valido: image ou video.");
    }

    const client = await postgres.connect();
    try {
      const ret = await client.query(models.criar_novidade(), [
        empresa_id,
        safeTitulo,
        safeResumo,
        safeConteudo,
        safeMediaUrl,
        safeMediaType,
        normalizeType(tipo),
        Boolean(destaque),
        Boolean(modal_destaque),
        Boolean(apenas_master),
        normalizeDateTime(data_publicacao),
        usuario_id || null,
      ]);
      return normalizeNewsRow(ret.rows?.[0] || {});
    } catch (error) {
      mapSchemaError(error);
    } finally {
      client.release();
    }
  },

  execute_criar_novidade_externa: async ({
    empresa_id,
    titulo,
    resumo,
    conteudo,
    media_url,
    media_type,
    tipo,
    destaque,
    modal_destaque,
    apenas_master,
    data_publicacao,
  }) => {
    return execute.execute_criar_novidade({
      empresa_id,
      usuario_id: null,
      titulo,
      resumo,
      conteudo,
      media_url,
      media_type,
      tipo,
      destaque,
      modal_destaque,
      apenas_master,
      data_publicacao,
    });
  },

  execute_editar_novidade: async ({
    id,
    empresa_id,
    usuario_id,
    titulo,
    resumo,
    conteudo,
    media_url,
    media_type,
    tipo,
    destaque,
    modal_destaque,
    apenas_master,
    data_publicacao,
  }) => {
    const safeTitulo = normalizeText(titulo, 180);
    const safeResumo = normalizeText(resumo, 320);
    const safeConteudo = normalizeText(conteudo, 12000);
    const safeMediaUrl = normalizeMediaUrl(media_url);
    const safeMediaType = normalizeMediaType(media_type, safeMediaUrl);

    if (!safeTitulo) {
      throw new Error("Informe o titulo da novidade.");
    }

    if (!safeConteudo) {
      throw new Error("Informe o conteudo da novidade.");
    }

    if (safeMediaUrl && !safeMediaType) {
      throw new Error("Informe um media_type valido: image ou video.");
    }

    const client = await postgres.connect();
    try {
      const ret = await client.query(models.editar_novidade(), [
        id,
        empresa_id,
        safeTitulo,
        safeResumo,
        safeConteudo,
        safeMediaUrl,
        safeMediaType,
        normalizeType(tipo),
        Boolean(destaque),
        Boolean(modal_destaque),
        Boolean(apenas_master),
        normalizeDateTime(data_publicacao),
        usuario_id,
      ]);

      if (!ret.rows?.length) {
        throw new Error("Novidade nao encontrada.");
      }

      return normalizeNewsRow(ret.rows[0]);
    } catch (error) {
      mapSchemaError(error);
    } finally {
      client.release();
    }
  },

  execute_inativar_novidade: async ({ id, empresa_id, usuario_id }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.inativar_novidade(), [id, empresa_id, usuario_id]);
      if (!ret.rows?.length) {
        throw new Error("Novidade nao encontrada.");
      }
      return normalizeNewsRow(ret.rows[0]);
    } catch (error) {
      mapSchemaError(error);
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
