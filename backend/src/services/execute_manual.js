const models = require("../models/models_manual");
const { postgres } = require("../server/connect");
const { isRuntimeSchemaEnsureEnabled } = require("../utils/runtime_schema");

const RUNTIME_SCHEMA_ENSURE_MANUAL = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SCHEMA_ENSURE_MANUAL"
);

function normalizeJsonArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeArticle(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    moduleId: row.module_id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content || "",
    steps: Array.isArray(row.steps) ? row.steps : [],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    relatedRoute: row.related_route || undefined,
    requiredPermissions: Array.isArray(row.required_permissions)
      ? row.required_permissions
      : [],
    minPlanId: row.min_plan_id || undefined,
    featured: Boolean(row.featured),
    order: Number(row.ordem || 1),
    status: row.status || "draft",
    updatedAt: row.updated_at,
  };
}

async function ensureSchema(client) {
  if (!RUNTIME_SCHEMA_ENSURE_MANUAL) {
    return;
  }

  await client.query(models.ensure_manual_schema());
}

async function ensureUniqueSlug(client, empresaId, rawSlug, currentId = null) {
  const base = normalizeSlug(rawSlug) || "artigo";
  let candidate = base;
  let counter = 2;

  while (true) {
    const existing = await client.query(models.get_manual_article_by_slug(), [
      empresaId,
      candidate,
      currentId,
    ]);

    if (!existing.rows.length) return candidate;

    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

function buildPayload(data) {
  const title = String(data.title || "").trim();
  const moduleId = String(data.moduleId || data.module_id || "").trim();
  const summary = String(data.summary || "").trim();
  const steps = normalizeJsonArray(data.steps);
  const status = String(data.status || "draft").trim();

  if (!title) throw new Error("Informe o titulo do artigo.");
  if (!moduleId) throw new Error("Informe o modulo do artigo.");
  if (!summary) throw new Error("Informe o resumo do artigo.");
  if (!steps.length) throw new Error("Informe ao menos um passo.");
  if (!["draft", "published", "inactive"].includes(status)) {
    throw new Error("Status do artigo invalido.");
  }

  return {
    moduleId,
    title,
    slug: String(data.slug || title).trim(),
    summary,
    content: String(data.content || "").trim(),
    steps,
    keywords: normalizeJsonArray(data.keywords),
    relatedRoute: String(data.relatedRoute || data.related_route || "").trim() || null,
    requiredPermissions: normalizeJsonArray(
      data.requiredPermissions || data.required_permissions
    ),
    minPlanId: data.minPlanId || data.min_plan_id ? Number(data.minPlanId || data.min_plan_id) : null,
    featured: Boolean(data.featured),
    order: Number(data.order || data.ordem || 1),
    status,
  };
}

const execute = {
  execute_list_manual_articles: async (empresaId) => {
    const client = await postgres.connect();
    try {
      await ensureSchema(client);
      const ret = await client.query(models.list_manual_articles(), [empresaId]);
      return ret.rows.map(normalizeArticle);
    } finally {
      client.release();
    }
  },

  execute_save_manual_article: async (empresaId, usuarioId, data) => {
    const client = await postgres.connect();
    try {
      await ensureSchema(client);
      const payload = buildPayload(data);
      const articleId = Number(data.id || 0);
      const slug = await ensureUniqueSlug(
        client,
        empresaId,
        payload.slug || payload.title,
        Number.isInteger(articleId) && articleId > 0 ? articleId : null
      );

      if (Number.isInteger(articleId) && articleId > 0) {
        const exists = await client.query(models.get_manual_article_by_id(), [
          articleId,
          empresaId,
        ]);
        if (!exists.rows.length) throw new Error("Artigo nao encontrado.");

        const ret = await client.query(models.update_manual_article(), [
          articleId,
          empresaId,
          payload.moduleId,
          payload.title,
          slug,
          payload.summary,
          payload.content,
          JSON.stringify(payload.steps),
          JSON.stringify(payload.keywords),
          payload.relatedRoute,
          JSON.stringify(payload.requiredPermissions),
          payload.minPlanId,
          payload.featured,
          payload.order,
          payload.status,
          usuarioId,
        ]);

        return normalizeArticle(ret.rows[0]);
      }

      const ret = await client.query(models.insert_manual_article(), [
        empresaId,
        payload.moduleId,
        payload.title,
        slug,
        payload.summary,
        payload.content,
        JSON.stringify(payload.steps),
        JSON.stringify(payload.keywords),
        payload.relatedRoute,
        JSON.stringify(payload.requiredPermissions),
        payload.minPlanId,
        payload.featured,
        payload.order,
        payload.status,
        usuarioId,
      ]);

      return normalizeArticle(ret.rows[0]);
    } finally {
      client.release();
    }
  },

  execute_duplicate_manual_article: async (empresaId, usuarioId, articleId) => {
    const client = await postgres.connect();
    try {
      await ensureSchema(client);
      const sourceRet = await client.query(models.get_manual_article_by_id(), [
        articleId,
        empresaId,
      ]);
      const source = sourceRet.rows[0];
      if (!source) throw new Error("Artigo nao encontrado.");

      const title = `${source.title} (copia)`;
      const slug = await ensureUniqueSlug(client, empresaId, `${source.slug}-copia`);
      const ret = await client.query(models.insert_manual_article(), [
        empresaId,
        source.module_id,
        title,
        slug,
        source.summary,
        source.content,
        JSON.stringify(Array.isArray(source.steps) ? source.steps : []),
        JSON.stringify(Array.isArray(source.keywords) ? source.keywords : []),
        source.related_route,
        JSON.stringify(
          Array.isArray(source.required_permissions) ? source.required_permissions : []
        ),
        source.min_plan_id,
        false,
        source.ordem,
        "draft",
        usuarioId,
      ]);

      return normalizeArticle(ret.rows[0]);
    } finally {
      client.release();
    }
  },

  execute_delete_manual_article: async (empresaId, usuarioId, articleId) => {
    const client = await postgres.connect();
    try {
      await ensureSchema(client);
      const ret = await client.query(models.delete_manual_article(), [
        articleId,
        empresaId,
        usuarioId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_reset_manual_articles: async (empresaId, usuarioId, articles) => {
    const client = await postgres.connect();
    try {
      await ensureSchema(client);
      await client.query("BEGIN");
      await client.query(models.clear_manual_articles(), [empresaId, usuarioId]);

      const created = [];
      for (const item of Array.isArray(articles) ? articles : []) {
        const payload = buildPayload(item);
        const slug = await ensureUniqueSlug(
          client,
          empresaId,
          payload.slug || payload.title
        );
        const ret = await client.query(models.insert_manual_article(), [
          empresaId,
          payload.moduleId,
          payload.title,
          slug,
          payload.summary,
          payload.content,
          JSON.stringify(payload.steps),
          JSON.stringify(payload.keywords),
          payload.relatedRoute,
          JSON.stringify(payload.requiredPermissions),
          payload.minPlanId,
          payload.featured,
          payload.order,
          payload.status,
          usuarioId,
        ]);
        created.push(normalizeArticle(ret.rows[0]));
      }

      await client.query("COMMIT");
      return created;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // noop
      }
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
