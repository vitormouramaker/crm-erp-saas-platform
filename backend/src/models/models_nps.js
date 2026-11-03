const models = {
  create_nps_pergunta: () => {
    return `
      INSERT INTO public.nps_pergunta (
        empresa_id,
        pergunta,
        ordem,
        ativo
      )
      VALUES ($1, $2, $3, true)
      RETURNING
        id,
        empresa_id,
        pergunta,
        ordem,
        ativo,
        data_criacao,
        data_atualizacao
    `;
  },

  list_nps_perguntas: () => {
    return `
      SELECT
        id,
        empresa_id,
        pergunta,
        ordem,
        ativo,
        data_criacao,
        data_atualizacao
      FROM public.nps_pergunta
      WHERE empresa_id = $1 and ativo = true
      ORDER BY ordem ASC, id ASC
    `;
  },

  get_nps_pergunta_by_id: () => {
    return `
      SELECT
        id,
        empresa_id,
        pergunta,
        ordem,
        ativo,
        data_criacao,
        data_atualizacao
      FROM public.nps_pergunta
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1
    `;
  },

  update_nps_pergunta: () => {
    return `
      UPDATE public.nps_pergunta
      SET
        pergunta = $3,
        ordem = $4,
        data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = $1
        AND empresa_id = $2
      RETURNING
        id,
        empresa_id,
        pergunta,
        ordem,
        ativo,
        data_criacao,
        data_atualizacao
    `;
  },

  delete_nps_pergunta: () => {
    return `
      UPDATE public.nps_pergunta
      SET
        ativo = false,
        data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = $1
        AND empresa_id = $2
      RETURNING
        id,
        empresa_id,
        pergunta,
        ordem,
        ativo,
        data_criacao,
        data_atualizacao
    `;
  },

  get_empresa_id_by_atendimento: () => {
    return `
      SELECT
        id AS atendimento_id,
        empresa_id
      FROM public.cliente_conversa_whats
      WHERE id = $1
      LIMIT 1
    `;
  },

  list_nps_perguntas_ativas_empresa: () => {
    return `
      SELECT
        id,
        pergunta,
        ordem
      FROM public.nps_pergunta
      WHERE empresa_id = $1
        AND ativo = true
      ORDER BY ordem ASC, id ASC
    `;
  },

  upsert_nps_resposta: () => {
    return `
      INSERT INTO public.nps_resposta (
        empresa_id,
        atendimento_id,
        pergunta_id,
        nota,
        resposta_texto
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (atendimento_id, pergunta_id)
      DO UPDATE SET
        nota = EXCLUDED.nota,
        resposta_texto = EXCLUDED.resposta_texto,
        data_resposta = CURRENT_TIMESTAMP
      RETURNING
        id,
        empresa_id,
        atendimento_id,
        pergunta_id,
        nota,
        resposta_texto,
        data_resposta
    `;
  },

  list_nps_respostas_atendimento: () => {
    return `
      SELECT
        r.id,
        r.empresa_id,
        r.atendimento_id,
        r.pergunta_id,
        p.pergunta,
        r.nota,
        r.resposta_texto,
        r.data_resposta
      FROM public.nps_resposta r
      LEFT JOIN public.nps_pergunta p
        ON p.id = r.pergunta_id
      WHERE r.atendimento_id = $1
        AND r.empresa_id = $2
      ORDER BY r.id ASC
    `;
  },

  relatorio_nps_resumo: () => {
    return `
      WITH base AS (
        SELECT
          nr.atendimento_id,
          nr.nota,
          nr.data_resposta
        FROM public.nps_resposta nr
        INNER JOIN public.cliente_conversa_whats ccw
          ON ccw.id = nr.atendimento_id
         AND ccw.empresa_id = nr.empresa_id
        LEFT JOIN public.usuario uf
          ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
        WHERE nr.empresa_id = $1
          AND ($2::date IS NULL OR nr.data_resposta::date >= $2::date)
          AND ($3::date IS NULL OR nr.data_resposta::date <= $3::date)
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
      ),
      nota_por_atendimento AS (
        SELECT
          atendimento_id,
          AVG(nota)::numeric AS nota_media
        FROM base
        GROUP BY atendimento_id
      )
      SELECT
        COUNT(*)::int AS total_avaliacoes,
        (SELECT COUNT(*)::int FROM base) AS total_respostas,
        COUNT(*) FILTER (WHERE nota_media >= 9)::int AS promotores,
        COUNT(*) FILTER (WHERE nota_media BETWEEN 7 AND 8)::int AS neutros,
        COUNT(*) FILTER (WHERE nota_media <= 6)::int AS detratores,
        COALESCE(AVG(nota_media), 0)::numeric AS media_nota,
        COALESCE(
          (
            (
              COUNT(*) FILTER (WHERE nota_media >= 9)::numeric
              - COUNT(*) FILTER (WHERE nota_media <= 6)::numeric
            ) / NULLIF(COUNT(*)::numeric, 0)
          ) * 100,
          0
        )::numeric AS nps_geral
      FROM nota_por_atendimento
    `;
  },

  relatorio_nps_evolucao_diaria: () => {
    return `
      WITH base AS (
        SELECT
          nr.atendimento_id,
          nr.data_resposta::date AS data_referencia,
          nr.nota
        FROM public.nps_resposta nr
        INNER JOIN public.cliente_conversa_whats ccw
          ON ccw.id = nr.atendimento_id
         AND ccw.empresa_id = nr.empresa_id
        LEFT JOIN public.usuario uf
          ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
        WHERE nr.empresa_id = $1
          AND ($2::date IS NULL OR nr.data_resposta::date >= $2::date)
          AND ($3::date IS NULL OR nr.data_resposta::date <= $3::date)
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
      ),
      nota_por_atendimento_dia AS (
        SELECT
          atendimento_id,
          data_referencia,
          AVG(nota)::numeric AS nota_media
        FROM base
        GROUP BY atendimento_id, data_referencia
      )
      SELECT
        data_referencia,
        COUNT(*)::int AS total_avaliacoes,
        COALESCE(AVG(nota_media), 0)::numeric AS media_nota,
        COALESCE(
          (
            (
              COUNT(*) FILTER (WHERE nota_media >= 9)::numeric
              - COUNT(*) FILTER (WHERE nota_media <= 6)::numeric
            ) / NULLIF(COUNT(*)::numeric, 0)
          ) * 100,
          0
        )::numeric AS nps
      FROM nota_por_atendimento_dia
      GROUP BY data_referencia
      ORDER BY data_referencia ASC
    `;
  },

  relatorio_nps_por_atendente: () => {
    return `
      WITH nota_por_atendimento AS (
        SELECT
          nr.atendimento_id,
          ccw.usuario_id,
          AVG(nr.nota)::numeric AS nota_media
        FROM public.nps_resposta nr
        INNER JOIN public.cliente_conversa_whats ccw
          ON ccw.id = nr.atendimento_id
         AND ccw.empresa_id = nr.empresa_id
        LEFT JOIN public.usuario uf
          ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
        WHERE nr.empresa_id = $1
          AND ccw.usuario_id IS NOT NULL
          AND ($2::date IS NULL OR nr.data_resposta::date >= $2::date)
          AND ($3::date IS NULL OR nr.data_resposta::date <= $3::date)
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
        GROUP BY nr.atendimento_id, ccw.usuario_id
      )
      SELECT
        u.id AS usuario_id,
        u.nome AS usuario_nome,
        COUNT(*)::int AS total_avaliacoes,
        COALESCE(AVG(nota_media), 0)::numeric AS media_nota,
        COUNT(*) FILTER (WHERE nota_media >= 9)::int AS promotores,
        COUNT(*) FILTER (WHERE nota_media BETWEEN 7 AND 8)::int AS neutros,
        COUNT(*) FILTER (WHERE nota_media <= 6)::int AS detratores,
        COALESCE(
          (
            (
              COUNT(*) FILTER (WHERE nota_media >= 9)::numeric
              - COUNT(*) FILTER (WHERE nota_media <= 6)::numeric
            ) / NULLIF(COUNT(*)::numeric, 0)
          ) * 100,
          0
        )::numeric AS nps
      FROM nota_por_atendimento npa
      INNER JOIN public.usuario u
        ON u.id = npa.usuario_id
      GROUP BY u.id, u.nome
      ORDER BY nps DESC, media_nota DESC, u.nome ASC
    `;
  },

  relatorio_nps_distribuicao_notas: () => {
    return `
      WITH notas AS (
        SELECT generate_series(1, 10) AS nota
      ),
      base AS (
        SELECT
          nr.nota
        FROM public.nps_resposta nr
        INNER JOIN public.cliente_conversa_whats ccw
          ON ccw.id = nr.atendimento_id
         AND ccw.empresa_id = nr.empresa_id
        LEFT JOIN public.usuario uf
          ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
        WHERE nr.empresa_id = $1
          AND ($2::date IS NULL OR nr.data_resposta::date >= $2::date)
          AND ($3::date IS NULL OR nr.data_resposta::date <= $3::date)
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
      )
      SELECT
        notas.nota,
        COUNT(base.nota)::int AS total
      FROM notas
      LEFT JOIN base
        ON base.nota = notas.nota
      GROUP BY notas.nota
      ORDER BY notas.nota ASC
    `;
  },

  relatorio_nps_respostas_detalhadas: () => {
    return `
      WITH base AS (
        SELECT
          nr.atendimento_id,
          nr.pergunta_id,
          np.pergunta,
          np.ordem AS pergunta_ordem,
          nr.nota,
          NULLIF(BTRIM(nr.resposta_texto), '') AS resposta_texto,
          nr.data_resposta,
          ccw.data_fim,
          ccw.data_inicio,
          ccw.usuario_id,
          c.id AS cliente_id,
          c.nome AS cliente_nome,
          c.telefone AS cliente_telefone,
          u.nome AS atendente_nome
        FROM public.nps_resposta nr
        INNER JOIN public.cliente_conversa_whats ccw
          ON ccw.id = nr.atendimento_id
         AND ccw.empresa_id = nr.empresa_id
        INNER JOIN public.cliente c
          ON c.id = ccw.cliente_id
        LEFT JOIN public.nps_pergunta np
          ON np.id = nr.pergunta_id
        LEFT JOIN public.usuario u
          ON u.id = ccw.usuario_id
        LEFT JOIN public.usuario uf
          ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
        WHERE nr.empresa_id = $1
          AND ($2::date IS NULL OR nr.data_resposta::date >= $2::date)
          AND ($3::date IS NULL OR nr.data_resposta::date <= $3::date)
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
      )
      SELECT
        atendimento_id,
        cliente_id,
        cliente_nome,
        cliente_telefone,
        usuario_id,
        atendente_nome,
        MAX(data_resposta) AS data_resposta,
        MAX(data_fim) AS data_fim,
        MAX(data_inicio) AS data_inicio,
        COUNT(*)::int AS total_respostas,
        COALESCE(AVG(nota), 0)::numeric AS nota_media,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT resposta_texto), NULL) AS comentarios,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'pergunta_id', pergunta_id,
              'pergunta', pergunta,
              'nota', nota,
              'resposta_texto', resposta_texto,
              'data_resposta', data_resposta
            )
            ORDER BY pergunta_ordem ASC NULLS LAST, pergunta_id ASC
          ),
          '[]'::json
        ) AS perguntas
      FROM base
      GROUP BY
        atendimento_id,
        cliente_id,
        cliente_nome,
        cliente_telefone,
        usuario_id,
        atendente_nome
      ORDER BY MAX(data_resposta) DESC, atendimento_id DESC
      LIMIT $5
    `;
  },
};

module.exports = models;
