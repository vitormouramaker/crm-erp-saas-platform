const models = {
  ensure_manual_schema: () => {
    return `
      CREATE TABLE IF NOT EXISTS public.manual_artigo (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        module_id TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        summary TEXT NOT NULL,
        content TEXT DEFAULT '',
        steps JSONB DEFAULT '[]'::jsonb,
        keywords JSONB DEFAULT '[]'::jsonb,
        related_route TEXT,
        required_permissions JSONB DEFAULT '[]'::jsonb,
        min_plan_id INTEGER,
        featured BOOLEAN DEFAULT false,
        ordem INTEGER DEFAULT 1,
        status TEXT DEFAULT 'draft',
        ativo BOOLEAN DEFAULT true,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_manual_artigo_empresa
        ON public.manual_artigo (empresa_id, ativo, status);

      CREATE INDEX IF NOT EXISTS idx_manual_artigo_slug
        ON public.manual_artigo (empresa_id, slug);
    `;
  },

  list_manual_articles: () => {
    return `
      SELECT
        id,
        empresa_id,
        module_id,
        title,
        slug,
        summary,
        content,
        steps,
        keywords,
        related_route,
        required_permissions,
        min_plan_id,
        featured,
        ordem,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      FROM public.manual_artigo
      WHERE empresa_id = $1
        AND ativo = true
      ORDER BY module_id ASC, ordem ASC, title ASC
    `;
  },

  get_manual_article_by_id: () => {
    return `
      SELECT *
      FROM public.manual_artigo
      WHERE id = $1
        AND empresa_id = $2
        AND ativo = true
      LIMIT 1
    `;
  },

  get_manual_article_by_slug: () => {
    return `
      SELECT id
      FROM public.manual_artigo
      WHERE empresa_id = $1
        AND slug = $2
        AND ativo = true
        AND ($3::INTEGER IS NULL OR id <> $3::INTEGER)
      LIMIT 1
    `;
  },

  insert_manual_article: () => {
    return `
      INSERT INTO public.manual_artigo (
        empresa_id,
        module_id,
        title,
        slug,
        summary,
        content,
        steps,
        keywords,
        related_route,
        required_permissions,
        min_plan_id,
        featured,
        ordem,
        status,
        created_by,
        updated_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb,
        $9, $10::jsonb, $11, $12, $13, $14, $15, $15
      )
      RETURNING *
    `;
  },

  update_manual_article: () => {
    return `
      UPDATE public.manual_artigo
      SET
        module_id = $3,
        title = $4,
        slug = $5,
        summary = $6,
        content = $7,
        steps = $8::jsonb,
        keywords = $9::jsonb,
        related_route = $10,
        required_permissions = $11::jsonb,
        min_plan_id = $12,
        featured = $13,
        ordem = $14,
        status = $15,
        updated_by = $16,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND empresa_id = $2
        AND ativo = true
      RETURNING *
    `;
  },

  delete_manual_article: () => {
    return `
      UPDATE public.manual_artigo
      SET
        ativo = false,
        updated_by = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND empresa_id = $2
        AND ativo = true
      RETURNING id
    `;
  },

  clear_manual_articles: () => {
    return `
      UPDATE public.manual_artigo
      SET
        ativo = false,
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE empresa_id = $1
        AND ativo = true
    `;
  },
};

module.exports = models;
