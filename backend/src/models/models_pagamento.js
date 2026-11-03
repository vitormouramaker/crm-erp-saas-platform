const models = {
  get_usuario_empresa_por_email: () => {
    return `
      SELECT
        u.id AS usuario_id,
        u.nome AS usuario_nome,
        u.email,
        u.empresa_id,
        e.nome_fantasia AS empresa_nome
      FROM usuario u
      INNER JOIN empresa e ON e.id = u.empresa_id
      WHERE u.email = $1
        AND u.ativo = true
        AND e.ativo = true
      ORDER BY u.is_master DESC, u.id ASC
      LIMIT 1
    `;
  },

  get_usuario_empresa_por_email_checkout: () => {
    return `
      SELECT
        u.id AS usuario_id,
        u.nome AS usuario_nome,
        u.email,
        u.ativo AS usuario_ativo,
        u.empresa_id,
        e.nome_fantasia AS empresa_nome,
        e.ativo AS empresa_ativo,
        e.cnpj,
        e.logradouro,
        e.numero,
        e.bairro,
        e.cidade,
        e.uf,
        e.cep
      FROM usuario u
      INNER JOIN empresa e ON e.id = u.empresa_id
      WHERE LOWER(u.email) = LOWER($1)
      ORDER BY u.ativo DESC, e.ativo DESC, u.is_master DESC, u.id ASC
      LIMIT 1
    `;
  },

  get_usuario_empresa_por_empresa_email_checkout: () => {
    return `
      SELECT
        u.id AS usuario_id,
        u.nome AS usuario_nome,
        u.email,
        u.ativo AS usuario_ativo,
        u.empresa_id,
        e.nome_fantasia AS empresa_nome,
        e.ativo AS empresa_ativo,
        e.cnpj,
        e.logradouro,
        e.numero,
        e.bairro,
        e.cidade,
        e.uf,
        e.cep
      FROM usuario u
      INNER JOIN empresa e ON e.id = u.empresa_id
      WHERE u.empresa_id = $1
        AND LOWER(u.email) = LOWER($2)
      ORDER BY u.is_master DESC, u.id ASC
      LIMIT 1
    `;
  },

  get_plano_por_id: () => {
    return `
      SELECT
        id,
        nome,
        preco,
        ativo,
        max_user,
        max_filial,
        max_crm,
        max_leads,
        stripe_price_id,
        stripe_price_id_monthly,
        stripe_price_id_yearly
      FROM assinatura
      WHERE id = $1
        AND ativo = true
      LIMIT 1
    `;
  },

  get_assinatura_empresa_atual: () => {
    return `
      SELECT
        ea.id,
        ea.empresa_id,
        ea.assinatura_id,
        ea.ativo,
        ea.validade,
        ea.request_unsubscribe,
        ea.has_pdv,
        ea.additional_user,
        ea.additional_user_cycle,
        ea.additional_filial,
        ea.additional_crm,
        ea.additional_crm_cycle,
        ea.additional_leads,
        ea.additional_leads_cycle,
        ea.data_inicial,
        ea.ultimo_pagamento,
        ea.recurrency_id,
        ea.stripe_customer_id,
        ea.stripe_subscription_id,
        ea.stripe_checkout_session_id,
        ea.stripe_status,
        ea.stripe_price_id,
        ea.stripe_current_period_end,
        ea.stripe_cancel_at_period_end,
        ea.stripe_last_event_id,
        ea.stripe_last_event_at,
        a.nome AS plano_nome,
        CASE
          WHEN ea.stripe_price_id = a.stripe_price_id_yearly THEN 'yearly'
          WHEN ea.stripe_price_id = a.stripe_price_id_monthly THEN 'monthly'
          WHEN ea.stripe_price_id = a.stripe_price_id THEN 'monthly'
          ELSE NULL
        END AS billing_cycle,
        a.max_user,
        a.max_filial,
        NULLIF(BTRIM(to_jsonb(e)->>'origem'), '') AS empresa_origem
      FROM empresa_assinatura ea
      LEFT JOIN assinatura a ON a.id = ea.assinatura_id
      LEFT JOIN empresa e ON e.id = ea.empresa_id
      WHERE ea.empresa_id = $1
      ORDER BY ea.ativo DESC, ea.id DESC
      LIMIT 1
    `;
  },

  get_assinatura_pendente_empresa: () => {
    return `
      SELECT *
      FROM empresa_assinatura
      WHERE empresa_id = $1
        AND stripe_status = 'checkout_pending'
      ORDER BY id DESC
      LIMIT 1
    `;
  },

  get_assinatura_empresa_por_subscription_id: () => {
    return `
      SELECT *
      FROM empresa_assinatura
      WHERE stripe_subscription_id = $1
      ORDER BY id DESC
      LIMIT 1
    `;
  },

  update_request_unsubscribe_by_id: () => {
    return `
      UPDATE empresa_assinatura
      SET request_unsubscribe = $2
      WHERE id = $1
      RETURNING id, empresa_id, request_unsubscribe
    `;
  },

  update_request_unsubscribe_by_subscription_id: () => {
    return `
      UPDATE empresa_assinatura
      SET request_unsubscribe = $2
      WHERE stripe_subscription_id = $1
      RETURNING id, empresa_id, request_unsubscribe
    `;
  },

  get_assinatura_empresa_por_customer_id: () => {
    return `
      SELECT *
      FROM empresa_assinatura
      WHERE stripe_customer_id = $1
      ORDER BY ativo DESC, id DESC
      LIMIT 1
    `;
  },

  insert_historico_pagamento: () => {
    return `
      INSERT INTO empresa_assinatura_pagamento (
        empresa_id,
        empresa_assinatura_id,
        assinatura_id,
        stripe_invoice_id,
        stripe_payment_intent_id,
        stripe_subscription_id,
        stripe_customer_id,
        status,
        valor_total,
        moeda,
        paid,
        paid_at,
        due_date,
        period_start,
        period_end,
        hosted_invoice_url,
        invoice_pdf,
        tentativa,
        descricao,
        stripe_event_id,
        stripe_event_type,
        stripe_event_at,
        payload
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, CURRENT_TIMESTAMP, $22::jsonb
      )
      ON CONFLICT (stripe_invoice_id) DO UPDATE SET
        empresa_id = EXCLUDED.empresa_id,
        empresa_assinatura_id = EXCLUDED.empresa_assinatura_id,
        assinatura_id = EXCLUDED.assinatura_id,
        stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        status = EXCLUDED.status,
        valor_total = EXCLUDED.valor_total,
        moeda = EXCLUDED.moeda,
        paid = EXCLUDED.paid,
        paid_at = EXCLUDED.paid_at,
        due_date = EXCLUDED.due_date,
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        hosted_invoice_url = EXCLUDED.hosted_invoice_url,
        invoice_pdf = EXCLUDED.invoice_pdf,
        tentativa = EXCLUDED.tentativa,
        descricao = EXCLUDED.descricao,
        stripe_event_id = EXCLUDED.stripe_event_id,
        stripe_event_type = EXCLUDED.stripe_event_type,
        stripe_event_at = CURRENT_TIMESTAMP,
        payload = EXCLUDED.payload,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
  },

  get_historico_pagamentos_empresa: () => {
    return `
      SELECT
        h.id,
        h.empresa_id,
        h.empresa_assinatura_id,
        h.assinatura_id,
        a.nome AS plano_nome,
        h.stripe_invoice_id,
        h.stripe_payment_intent_id,
        h.stripe_subscription_id,
        h.status,
        h.valor_total,
        h.moeda,
        h.paid,
        h.paid_at,
        h.due_date,
        h.period_start,
        h.period_end,
        h.hosted_invoice_url,
        h.invoice_pdf,
        h.tentativa,
        h.descricao,
        h.stripe_event_id,
        h.stripe_event_type,
        h.stripe_event_at,
        h.created_at,
        h.updated_at
      FROM empresa_assinatura_pagamento h
      LEFT JOIN assinatura a ON a.id = h.assinatura_id
      WHERE h.empresa_id = $1
      ORDER BY h.created_at DESC
      LIMIT $2
    `;
  },

  insert_assinatura_pendente: () => {
    return `
      INSERT INTO empresa_assinatura (
        assinatua_hash,
        recurrency_id,
        data_inicial,
        ultimo_pagamento,
        validade,
        ativo,
        empresa_id,
        assinatura_id,
        has_pdv,
        additional_user,
        additional_user_cycle,
        additional_filial,
        additional_crm,
        additional_crm_cycle,
        additional_leads,
        additional_leads_cycle,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_checkout_session_id,
        stripe_status,
        stripe_price_id,
        stripe_current_period_end,
        stripe_cancel_at_period_end,
        stripe_last_event_id,
        stripe_last_event_at
      ) VALUES (
        $1, $2, CURRENT_TIMESTAMP, $4,
        COALESCE($3, CAST($21 AS date)), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
  },

  desativar_assinaturas_ativas_empresa: () => {
    return `
      UPDATE empresa_assinatura
      SET ativo = false
      WHERE empresa_id = $1
        AND ativo = true
    `;
  },

  update_assinatura_empresa_por_id: () => {
    return `
      UPDATE empresa_assinatura
      SET
        assinatua_hash = $2,
        recurrency_id = $3,
        ultimo_pagamento = $4,
        validade = COALESCE($5, CAST($21 AS date), validade),
        ativo = $6,
        assinatura_id = $7,
        has_pdv = $8,
        additional_user = $9,
        additional_user_cycle = $10,
        additional_filial = $11,
        additional_crm = $12,
        additional_crm_cycle = $13,
        additional_leads = $14,
        additional_leads_cycle = $15,
        stripe_customer_id = $16,
        stripe_subscription_id = $17,
        stripe_checkout_session_id = $18,
        stripe_status = $19,
        stripe_price_id = $20,
        stripe_current_period_end = $21,
        stripe_cancel_at_period_end = $22,
        stripe_last_event_id = $23,
        stripe_last_event_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
  },

  update_assinatura_empresa_invoice_snapshot_by_id: () => {
    return `
      UPDATE empresa_assinatura
      SET
        ultimo_pagamento = COALESCE($2, ultimo_pagamento),
        validade = COALESCE($3, validade),
        stripe_current_period_end = COALESCE($4, stripe_current_period_end),
        ativo = CASE
          WHEN $5::boolean = true THEN true
          ELSE ativo
        END,
        stripe_status = COALESCE($6, stripe_status),
        stripe_last_event_id = COALESCE($7, stripe_last_event_id),
        stripe_last_event_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
  },

  get_addons_ativos: () => {
    return `
      SELECT
        id,
        codigo,
        nome,
        ativo,
        stripe_price_id,
        stripe_price_id_monthly,
        stripe_price_id_yearly
      FROM addos
      WHERE ativo = true
      ORDER BY id ASC
    `;
  },

  get_plano_por_stripe_price_id: () => {
    return `
      SELECT
        id,
        nome,
        ativo,
        stripe_price_id,
        stripe_price_id_monthly,
        stripe_price_id_yearly
      FROM assinatura
      WHERE
        stripe_price_id = $1
        OR stripe_price_id_monthly = $1
        OR stripe_price_id_yearly = $1
      LIMIT 1
    `;
  },

  get_plano_por_qualquer_stripe_price_ids: () => {
    return `
      SELECT
        id,
        nome,
        ativo
      FROM assinatura
      WHERE
        stripe_price_id = ANY($1::text[])
        OR stripe_price_id_monthly = ANY($1::text[])
        OR stripe_price_id_yearly = ANY($1::text[])
      LIMIT 1
    `;
  },

  insert_empresa_checkout: () => {
    return `
      INSERT INTO empresa (
        nome_fantasia,
        razao_social,
        ativo
      ) VALUES (
        $1,
        $2,
        true
      )
      RETURNING id, nome_fantasia
    `;
  },

  insert_usuario_master_checkout: () => {
    return `
      INSERT INTO usuario (
        nome,
        email,
        senha,
        data_criacao,
        ativo,
        perfil_id,
        empresa_id,
        permissoes_customizadas,
        is_master
      ) VALUES (
        $1,
        $2,
        $3,
        current_date,
        true,
        NULL,
        $4,
        '[]'::jsonb,
        true
      )
      RETURNING id, nome, email, empresa_id
    `;
  },

  get_default_crm_empresa: () => {
    return `
      SELECT
        id,
        empresa_id,
        nome,
        descricao,
        ativo,
        master
      FROM comercial_crm
      WHERE empresa_id = $1
        AND ativo = true
      ORDER BY master DESC, id ASC
      LIMIT 1
    `;
  },

  insert_crm_master_checkout: () => {
    return `
      INSERT INTO comercial_crm (
        empresa_id,
        nome,
        descricao,
        ativo,
        master
      ) VALUES (
        $1,
        $2,
        $3,
        true,
        true
      )
      RETURNING id, empresa_id, nome, master
    `;
  },

  get_etapa_by_codigo_crm: () => {
    return `
      SELECT
        id,
        crm_id,
        codigo,
        ativo
      FROM comercial_etapa
      WHERE crm_id = $1
        AND codigo = $2
      LIMIT 1
    `;
  },

  insert_etapa_crm: () => {
    return `
      INSERT INTO comercial_etapa (
        crm_id,
        codigo,
        nome,
        ordem,
        cor,
        eh_inicial,
        eh_fechamento,
        eh_ganho,
        ativo
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, true
      )
      RETURNING id
    `;
  },

  // Integracao Gestao 360: colunas de origem da empresa (docs/sql/empresa_origem_gestao360.sql).
  ensure_empresa_origem_gestao360_columns: () => {
    return `
      ALTER TABLE empresa
        ADD COLUMN IF NOT EXISTS origem varchar(30),
        ADD COLUMN IF NOT EXISTS gestao360_referencia varchar(120),
        ADD COLUMN IF NOT EXISTS gestao360_senha_inicial varchar(64)
    `;
  },

  get_usuarios_empresa_por_email_gestao360: () => {
    return `
      SELECT
        u.id AS usuario_id,
        u.nome AS usuario_nome,
        u.email,
        u.ativo AS usuario_ativo,
        COALESCE(u.is_master, false) AS is_master,
        u.empresa_id,
        e.nome_fantasia AS empresa_nome,
        e.ativo AS empresa_ativo,
        e.origem AS empresa_origem,
        (
          e.gestao360_senha_inicial IS NOT NULL
          AND u.senha = e.gestao360_senha_inicial
        ) AS onboarding_pendente
      FROM usuario u
      INNER JOIN empresa e ON e.id = u.empresa_id
      WHERE LOWER(u.email) = LOWER($1)
      ORDER BY u.ativo DESC, e.ativo DESC, u.is_master DESC, u.id ASC
    `;
  },

  update_empresa_origem_gestao360: () => {
    return `
      UPDATE empresa
      SET
        origem = 'gestao360',
        gestao360_referencia = $2,
        gestao360_senha_inicial = COALESCE($3, gestao360_senha_inicial)
      WHERE id = $1
      RETURNING id
    `;
  },

  update_usuario_telefone_por_id: () => {
    return `
      UPDATE usuario
      SET telefone = $2
      WHERE id = $1
    `;
  },

  get_assinatura_gestao360_empresa: () => {
    return `
      SELECT id, ativo
      FROM empresa_assinatura
      WHERE empresa_id = $1
        AND assinatua_hash = 'gestao360'
      ORDER BY id DESC
      LIMIT 1
    `;
  },

  // Assinatura ativa que nao foi criada pela integracao (ex.: checkout Stripe feito dentro do ÓRBITA).
  get_assinatura_propria_ativa_empresa: () => {
    return `
      SELECT id
      FROM empresa_assinatura
      WHERE empresa_id = $1
        AND ativo = true
        AND assinatua_hash IS DISTINCT FROM 'gestao360'
      LIMIT 1
    `;
  },

  update_assinatura_gestao360_por_id: () => {
    return `
      UPDATE empresa_assinatura
      SET
        ativo = true,
        validade = CAST($2 AS date)
      WHERE id = $1
        AND assinatua_hash = 'gestao360'
      RETURNING id
    `;
  },

  desativar_assinatura_gestao360_empresa: () => {
    return `
      UPDATE empresa_assinatura
      SET ativo = false
      WHERE empresa_id = $1
        AND assinatua_hash = 'gestao360'
        AND ativo = true
    `;
  },

  get_assinatura_resumo_empresa: () => {
    return `
      SELECT
        id,
        ativo,
        to_char(validade, 'YYYY-MM-DD') AS validade,
        (assinatua_hash IS NOT DISTINCT FROM 'gestao360') AS gerenciada_gestao360
      FROM empresa_assinatura
      WHERE empresa_id = $1
      ORDER BY ativo DESC, id DESC
      LIMIT 1
    `;
  },
};

module.exports = models;
