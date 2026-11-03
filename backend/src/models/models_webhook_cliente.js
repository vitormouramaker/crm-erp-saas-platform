const models = {
  get_empresa_webhook_config: () => {
    return `
      SELECT
        id,
        cliente_webhook_public_id,
        cliente_webhook_codigo,
        COALESCE(cliente_webhook_ativo, true) AS cliente_webhook_ativo,
        COALESCE(
          NULLIF(BTRIM(to_jsonb(empresa)->>'cliente_n8n_ia_nome'), ''),
          'n8n IA'
        ) AS n8n_ia_nome
      FROM empresa
      WHERE id = $1
        AND ativo = true
      LIMIT 1
    `;
  },

  get_empresa_webhook_config_by_public_id: () => {
    return `
      SELECT
        id,
        cliente_webhook_public_id,
        cliente_webhook_codigo,
        COALESCE(cliente_webhook_ativo, true) AS cliente_webhook_ativo,
        COALESCE(
          NULLIF(BTRIM(to_jsonb(empresa)->>'cliente_n8n_ia_nome'), ''),
          'n8n IA'
        ) AS n8n_ia_nome
      FROM empresa
      WHERE cliente_webhook_public_id = $1
        AND ativo = true
      LIMIT 1
    `;
  },

  get_empresa_webhook_config_by_code: () => {
    return `
      SELECT
        id,
        cliente_webhook_public_id,
        cliente_webhook_codigo,
        COALESCE(cliente_webhook_ativo, true) AS cliente_webhook_ativo,
        COALESCE(
          NULLIF(BTRIM(to_jsonb(empresa)->>'cliente_n8n_ia_nome'), ''),
          'n8n IA'
        ) AS n8n_ia_nome
      FROM empresa
      WHERE cliente_webhook_codigo = $1
        AND ativo = true
      LIMIT 1
    `;
  },

  ensure_empresa_webhook_secrets: () => {
    return `
      UPDATE empresa
      SET
        cliente_webhook_public_id = COALESCE(
          NULLIF(BTRIM(cliente_webhook_public_id), ''),
          SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text || id::text), 1, 32)
        ),
        cliente_webhook_codigo = COALESCE(
          NULLIF(BTRIM(cliente_webhook_codigo), ''),
          SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text || id::text || 'webhook'), 1, 40)
        ),
        cliente_webhook_ativo = COALESCE(cliente_webhook_ativo, true)
      WHERE id = $1
        AND ativo = true
      RETURNING
        id,
        cliente_webhook_public_id,
        cliente_webhook_codigo,
        COALESCE(cliente_webhook_ativo, true) AS cliente_webhook_ativo,
        COALESCE(
          NULLIF(BTRIM(to_jsonb(empresa)->>'cliente_n8n_ia_nome'), ''),
          'n8n IA'
        ) AS n8n_ia_nome
    `;
  },

  ensure_empresa_n8n_ia_nome_column: () => {
    return `
      alter table empresa
      add column if not exists cliente_n8n_ia_nome varchar(120)
    `;
  },

  upsert_cliente_webhook: () => {
    return `
      INSERT INTO cliente (
        nome,
        telefone,
        email,
        ativo,
        empresa_id,
        tags_webhook
      )
      VALUES (
        $1,
        $2,
        $3,
        true,
        $4,
        $5::jsonb
      )
      ON CONFLICT (telefone, empresa_id)
      DO UPDATE SET
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        ativo = true,
        tags_webhook = EXCLUDED.tags_webhook
      RETURNING
        id,
        nome,
        telefone,
        email,
        empresa_id,
        utms,
        tags_webhook,
        (xmax = 0) as created
    `;
  },

  append_cliente_utms_historico: () => {
    return `
      UPDATE cliente
      SET utms = COALESCE(utms, '[]'::jsonb) || $2::jsonb
      WHERE id = $1
      RETURNING utms
    `;
  },

  get_empresa_utms_urls: () => {
    return `
      SELECT
        COALESCE(
          utm_item->>'url',
          utm_item->>'url_origem',
          utm_item->>'landing_page',
          utm_item->>'page_url',
          utm_item->>'utm_url',
          utm_item->>'link'
        ) AS url,
        NULLIF(utm_item->>'data_recebimento', '')::timestamptz AS data_recebimento
      FROM cliente c
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.utms, '[]'::jsonb)) AS utm_item
      WHERE c.empresa_id = $1
        AND c.ativo = true
        AND COALESCE(
          utm_item->>'url',
          utm_item->>'url_origem',
          utm_item->>'landing_page',
          utm_item->>'page_url',
          utm_item->>'utm_url',
          utm_item->>'link'
        ) IS NOT NULL
        AND BTRIM(
          COALESCE(
            utm_item->>'url',
            utm_item->>'url_origem',
            utm_item->>'landing_page',
            utm_item->>'page_url',
            utm_item->>'utm_url',
            utm_item->>'link'
          )
        ) <> ''
      ORDER BY data_recebimento DESC NULLS LAST
      LIMIT 500
    `;
  },

  list_usuarios_webhook: () => {
    return `
      SELECT
        id,
        nome,
        email
      FROM usuario
      WHERE empresa_id = $1
        AND ativo = true
      ORDER BY nome ASC, email ASC, id ASC
    `;
  },

  update_empresa_webhook_status: () => {
    return `
      UPDATE empresa
      SET cliente_webhook_ativo = $2
      WHERE id = $1
        AND ativo = true
      RETURNING
        id,
        cliente_webhook_public_id,
        cliente_webhook_codigo,
        COALESCE(cliente_webhook_ativo, true) AS cliente_webhook_ativo,
        COALESCE(
          NULLIF(BTRIM(to_jsonb(empresa)->>'cliente_n8n_ia_nome'), ''),
          'n8n IA'
        ) AS n8n_ia_nome
    `;
  },

  update_empresa_n8n_ia_nome: () => {
    return `
      UPDATE empresa
      SET cliente_n8n_ia_nome = NULLIF(BTRIM($2), '')
      WHERE id = $1
        AND ativo = true
      RETURNING
        id,
        cliente_webhook_public_id,
        cliente_webhook_codigo,
        COALESCE(cliente_webhook_ativo, true) AS cliente_webhook_ativo,
        COALESCE(
          NULLIF(BTRIM(to_jsonb(empresa)->>'cliente_n8n_ia_nome'), ''),
          'n8n IA'
        ) AS n8n_ia_nome
    `;
  },

  get_latest_open_conversation_by_cliente: () => {
    return `
      select
        id,
        empresa_id,
        cliente_id,
        status_id,
        empresa_meta_param_id,
        number_phone_id,
        usuario_id,
        usuario_atribuido_id
      from cliente_conversa_whats
      where empresa_id = $1
        and cliente_id = $2
        and data_fim is null
      order by
        case
          when status_id = 1 then 0
          when status_id = 0 then 1
          else 2
        end,
        coalesce(ultima_atualizacao, data_inicio) desc nulls last,
        id desc
      limit 1
    `;
  },

  list_open_conversations_by_cliente: () => {
    return `
      select
        id,
        empresa_id,
        cliente_id,
        status_id,
        empresa_meta_param_id,
        number_phone_id,
        usuario_id,
        usuario_atribuido_id
      from cliente_conversa_whats
      where empresa_id = $1
        and cliente_id = $2
        and data_fim is null
        and (
          $3::bigint is null
          or empresa_meta_param_id = $3::bigint
        )
      order by
        case
          when status_id = 1 then 0
          when status_id = 0 then 1
          else 2
        end,
        coalesce(ultima_atualizacao, data_inicio) desc nulls last,
        id desc
    `;
  },

  insert_mensagem_n8n_ia: () => {
    return `
      insert into cliente_conversa_whats_mensagem (
        cliente_conversa_id,
        mensagem,
        tipo_id,
        data_mensagem,
        status,
        reply,
        mensagem_reply_id,
        mensagem_whats_id,
        send_by
      )
      values (
        $1,
        $2,
        0,
        coalesce($3::timestamp without time zone + interval '3 hours', current_timestamp),
        1,
        false,
        null,
        $4,
        3
      )
      on conflict on constraint mensagem_unica do nothing
      returning id, cliente_conversa_id, mensagem_whats_id, data_mensagem
    `;
  },

  upsert_tag_por_nome: () => {
    return `
      INSERT INTO tag (nome, empresa_id)
      VALUES ($1, $2)
      ON CONFLICT (nome)
      DO UPDATE SET
        nome = EXCLUDED.nome
      RETURNING id, nome
    `;
  },

  vincular_tag_cliente: () => {
    return `
      INSERT INTO cliente_tag (tag_id, cliente_id)
      VALUES ($1, $2)
      ON CONFLICT ON CONSTRAINT unique_cliente_id_tag
      DO NOTHING
    `;
  },
};

module.exports = models;
