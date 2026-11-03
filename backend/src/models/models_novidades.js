const models = {
  listar_novidades_usuario: () => {
    return `
      WITH leitura AS (
        SELECT
          novidade_id,
          visualizado_em,
          lida_em,
          modal_dispensado_em
        FROM public.sistema_novidade_usuario
        WHERE usuario_id = $2
      ),
      base AS (
        SELECT
          n.id,
          n.empresa_id,
          n.titulo,
          n.resumo,
          n.conteudo,
          n.media_url,
          n.media_type,
          n.tipo,
          COALESCE(n.destaque, false) AS destaque,
          COALESCE(n.modal_destaque, false) AS modal_destaque,
          COALESCE(n.apenas_master, false) AS apenas_master,
          COALESCE(n.ativo, true) AS ativo,
          n.data_publicacao,
          n.created_at,
          n.updated_at,
          n.criado_por_usuario_id,
          n.atualizado_por_usuario_id,
          l.visualizado_em,
          l.lida_em,
          l.modal_dispensado_em,
          CASE WHEN l.lida_em IS NOT NULL THEN true ELSE false END AS lida,
          COUNT(*) OVER()::int AS total_count
        FROM public.sistema_novidade n
        LEFT JOIN leitura l
          ON l.novidade_id = n.id
        WHERE n.empresa_id IN (0, $1)
          AND COALESCE(n.ativo, true) = true
          AND (COALESCE(n.apenas_master, false) = false OR $3::boolean = true)
          AND ($4::boolean IS NULL OR (CASE WHEN l.lida_em IS NOT NULL THEN true ELSE false END) = $4::boolean)
      )
      SELECT *
      FROM base
      ORDER BY
        destaque DESC,
        COALESCE(data_publicacao, created_at) DESC,
        id DESC
      LIMIT $5
      OFFSET $6
    `;
  },

  contar_novidades_nao_lidas: () => {
    return `
      SELECT COUNT(*)::int AS total
      FROM public.sistema_novidade n
      LEFT JOIN public.sistema_novidade_usuario nu
        ON nu.novidade_id = n.id
       AND nu.usuario_id = $2
      WHERE n.empresa_id IN (0, $1)
        AND COALESCE(n.ativo, true) = true
        AND (COALESCE(n.apenas_master, false) = false OR $3::boolean = true)
        AND nu.lida_em IS NULL
    `;
  },

  obter_modal_destaque_usuario: () => {
    return `
      SELECT
        n.id,
        n.empresa_id,
        n.titulo,
        n.resumo,
        n.conteudo,
        n.media_url,
        n.media_type,
        n.tipo,
        COALESCE(n.destaque, false) AS destaque,
        COALESCE(n.modal_destaque, false) AS modal_destaque,
        COALESCE(n.apenas_master, false) AS apenas_master,
        COALESCE(n.ativo, true) AS ativo,
        n.data_publicacao,
        n.created_at,
        n.updated_at,
        n.criado_por_usuario_id,
        n.atualizado_por_usuario_id,
        nu.visualizado_em,
        nu.lida_em,
        nu.modal_dispensado_em,
        CASE WHEN nu.lida_em IS NOT NULL THEN true ELSE false END AS lida
      FROM public.sistema_novidade n
      LEFT JOIN public.sistema_novidade_usuario nu
        ON nu.novidade_id = n.id
       AND nu.usuario_id = $2
      WHERE n.empresa_id IN (0, $1)
        AND COALESCE(n.ativo, true) = true
        AND (COALESCE(n.apenas_master, false) = false OR $3::boolean = true)
        AND COALESCE(n.modal_destaque, false) = true
        AND nu.lida_em IS NULL
        AND nu.modal_dispensado_em IS NULL
      ORDER BY
        COALESCE(n.data_publicacao, n.created_at) DESC,
        n.id DESC
      LIMIT 1
    `;
  },

  get_novidade_by_id: () => {
    return `
      SELECT
        id,
        empresa_id,
        titulo,
        resumo,
        conteudo,
        media_url,
        media_type,
        tipo,
        COALESCE(destaque, false) AS destaque,
        COALESCE(modal_destaque, false) AS modal_destaque,
        COALESCE(apenas_master, false) AS apenas_master,
        COALESCE(ativo, true) AS ativo,
        data_publicacao,
        created_at,
        updated_at,
        criado_por_usuario_id,
        atualizado_por_usuario_id
      FROM public.sistema_novidade
      WHERE id = $1
        AND empresa_id IN (0, $2)
        AND (COALESCE(apenas_master, false) = false OR $3::boolean = true)
      LIMIT 1
    `;
  },

  registrar_visualizacao_usuario: () => {
    return `
      INSERT INTO public.sistema_novidade_usuario (
        novidade_id,
        usuario_id,
        visualizado_em
      )
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (novidade_id, usuario_id)
      DO UPDATE SET
        visualizado_em = COALESCE(public.sistema_novidade_usuario.visualizado_em, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        novidade_id,
        usuario_id,
        visualizado_em,
        lida_em,
        modal_dispensado_em
    `;
  },

  marcar_novidade_lida: () => {
    return `
      INSERT INTO public.sistema_novidade_usuario (
        novidade_id,
        usuario_id,
        visualizado_em,
        lida_em
      )
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (novidade_id, usuario_id)
      DO UPDATE SET
        visualizado_em = COALESCE(public.sistema_novidade_usuario.visualizado_em, CURRENT_TIMESTAMP),
        lida_em = COALESCE(public.sistema_novidade_usuario.lida_em, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        novidade_id,
        usuario_id,
        visualizado_em,
        lida_em,
        modal_dispensado_em
    `;
  },

  marcar_todas_novidades_lidas: () => {
    return `
      INSERT INTO public.sistema_novidade_usuario (
        novidade_id,
        usuario_id,
        visualizado_em,
        lida_em
      )
      SELECT
        n.id,
        $2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM public.sistema_novidade n
      WHERE n.empresa_id IN (0, $1)
        AND COALESCE(n.ativo, true) = true
        AND (COALESCE(n.apenas_master, false) = false OR $3::boolean = true)
      ON CONFLICT (novidade_id, usuario_id)
      DO UPDATE SET
        visualizado_em = COALESCE(public.sistema_novidade_usuario.visualizado_em, CURRENT_TIMESTAMP),
        lida_em = COALESCE(public.sistema_novidade_usuario.lida_em, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      RETURNING novidade_id
    `;
  },

  dispensar_modal_destaque_usuario: () => {
    return `
      INSERT INTO public.sistema_novidade_usuario (
        novidade_id,
        usuario_id,
        visualizado_em,
        modal_dispensado_em
      )
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (novidade_id, usuario_id)
      DO UPDATE SET
        visualizado_em = COALESCE(public.sistema_novidade_usuario.visualizado_em, CURRENT_TIMESTAMP),
        modal_dispensado_em = COALESCE(public.sistema_novidade_usuario.modal_dispensado_em, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        novidade_id,
        usuario_id,
        visualizado_em,
        lida_em,
        modal_dispensado_em
    `;
  },

  listar_novidades_admin: () => {
    return `
      SELECT
        id,
        empresa_id,
        titulo,
        resumo,
        conteudo,
        media_url,
        media_type,
        tipo,
        COALESCE(destaque, false) AS destaque,
        COALESCE(modal_destaque, false) AS modal_destaque,
        COALESCE(apenas_master, false) AS apenas_master,
        COALESCE(ativo, true) AS ativo,
        data_publicacao,
        created_at,
        updated_at,
        criado_por_usuario_id,
        atualizado_por_usuario_id
      FROM public.sistema_novidade
      WHERE empresa_id IN (0, $1)
      ORDER BY
        COALESCE(ativo, true) DESC,
        COALESCE(data_publicacao, created_at) DESC,
        id DESC
      LIMIT $2
    `;
  },

  criar_novidade: () => {
    return `
      INSERT INTO public.sistema_novidade (
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
        ativo,
        data_publicacao,
        criado_por_usuario_id,
        atualizado_por_usuario_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        true,
        $11,
        $12,
        $12
      )
      RETURNING
        id,
        empresa_id,
        titulo,
        resumo,
        conteudo,
        media_url,
        media_type,
        tipo,
        COALESCE(destaque, false) AS destaque,
        COALESCE(modal_destaque, false) AS modal_destaque,
        COALESCE(apenas_master, false) AS apenas_master,
        COALESCE(ativo, true) AS ativo,
        data_publicacao,
        created_at,
        updated_at,
        criado_por_usuario_id,
        atualizado_por_usuario_id
    `;
  },

  editar_novidade: () => {
    return `
      UPDATE public.sistema_novidade
      SET
        titulo = $3,
        resumo = $4,
        conteudo = $5,
        media_url = $6,
        media_type = $7,
        tipo = $8,
        destaque = $9,
        modal_destaque = $10,
        apenas_master = $11,
        data_publicacao = $12,
        atualizado_por_usuario_id = $13,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND empresa_id = $2
      RETURNING
        id,
        empresa_id,
        titulo,
        resumo,
        conteudo,
        media_url,
        media_type,
        tipo,
        COALESCE(destaque, false) AS destaque,
        COALESCE(modal_destaque, false) AS modal_destaque,
        COALESCE(apenas_master, false) AS apenas_master,
        COALESCE(ativo, true) AS ativo,
        data_publicacao,
        created_at,
        updated_at,
        criado_por_usuario_id,
        atualizado_por_usuario_id
    `;
  },

  inativar_novidade: () => {
    return `
      UPDATE public.sistema_novidade
      SET
        ativo = false,
        atualizado_por_usuario_id = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND empresa_id = $2
      RETURNING
        id,
        empresa_id,
        titulo,
        resumo,
        conteudo,
        media_url,
        media_type,
        tipo,
        COALESCE(destaque, false) AS destaque,
        COALESCE(modal_destaque, false) AS modal_destaque,
        COALESCE(apenas_master, false) AS apenas_master,
        COALESCE(ativo, true) AS ativo,
        data_publicacao,
        created_at,
        updated_at,
        criado_por_usuario_id,
        atualizado_por_usuario_id
    `;
  },
};

module.exports = models;
