const models = {
  list_webhooks_by_empresa: () => {
    return `
      select
        id,
        empresa_id,
        nome,
        url,
        security_key,
        security_location,
        security_field_name,
        coalesce(eventos, '[]'::jsonb) as eventos,
        coalesce(ativo, true) as ativo,
        criado_em,
        atualizado_em
      from public.developer_webhook
      where empresa_id = $1
      order by coalesce(ativo, true) desc, id desc
    `;
  },

  insert_webhook: () => {
    return `
      insert into public.developer_webhook (
        empresa_id,
        nome,
        url,
        security_key,
        security_location,
        security_field_name,
        eventos,
        ativo
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      returning
        id,
        empresa_id,
        nome,
        url,
        security_key,
        security_location,
        security_field_name,
        coalesce(eventos, '[]'::jsonb) as eventos,
        coalesce(ativo, true) as ativo,
        criado_em,
        atualizado_em
    `;
  },

  update_webhook: () => {
    return `
      update public.developer_webhook
      set nome = $3,
          url = $4,
          security_key = $5,
          security_location = $6,
          security_field_name = $7,
          eventos = $8::jsonb,
          ativo = $9,
          atualizado_em = current_timestamp
      where id = $1
        and empresa_id = $2
      returning
        id,
        empresa_id,
        nome,
        url,
        security_key,
        security_location,
        security_field_name,
        coalesce(eventos, '[]'::jsonb) as eventos,
        coalesce(ativo, true) as ativo,
        criado_em,
        atualizado_em
    `;
  },

  delete_webhook: () => {
    return `
      delete from public.developer_webhook
      where id = $1
        and empresa_id = $2
      returning id
    `;
  },

  list_active_webhooks_by_event: () => {
    return `
      select
        id,
        empresa_id,
        nome,
        url,
        security_key,
        security_location,
        security_field_name,
        coalesce(eventos, '[]'::jsonb) as eventos,
        coalesce(ativo, true) as ativo
      from public.developer_webhook
      where empresa_id = $1
        and coalesce(ativo, true) = true
        and coalesce(eventos, '[]'::jsonb) ? $2
      order by id asc
    `;
  },

  claim_webhook_history: () => {
    return `
      insert into public.developer_webhook_history (
        empresa_id,
        webhook_id,
        event_key,
        entity_id,
        dispatch_key,
        request_url,
        request_headers,
        request_body,
        instance_id,
        status
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, 'processing')
      on conflict (webhook_id, dispatch_key) do nothing
      returning id
    `;
  },

  finish_webhook_history_success: () => {
    return `
      update public.developer_webhook_history
      set status = 'success',
          response_status = $2,
          response_headers = $3::jsonb,
          response_body = $4,
          error_message = null,
          finished_at = current_timestamp
      where id = $1
    `;
  },

  finish_webhook_history_error: () => {
    return `
      update public.developer_webhook_history
      set status = 'error',
          response_status = $2,
          response_headers = $3::jsonb,
          response_body = $4,
          error_message = $5,
          finished_at = current_timestamp
      where id = $1
    `;
  },

  list_webhook_history: () => {
    return `
      select
        h.id,
        h.empresa_id,
        h.webhook_id,
        w.nome as webhook_nome,
        h.event_key,
        h.entity_id,
        h.dispatch_key,
        h.request_url,
        coalesce(h.request_headers, '{}'::jsonb) as request_headers,
        coalesce(h.request_body, '{}'::jsonb) as request_body,
        h.response_status,
        coalesce(h.response_headers, '{}'::jsonb) as response_headers,
        h.response_body,
        h.status,
        h.error_message,
        h.instance_id,
        h.created_at,
        h.finished_at
      from public.developer_webhook_history h
      inner join public.developer_webhook w
        on w.id = h.webhook_id
      where h.empresa_id = $1
        and h.webhook_id = $2
      order by h.id desc
      limit $3
    `;
  },

  get_customer_payload_by_id: () => {
    return `
      select
        c.id,
        c.empresa_id,
        c.nome,
        c.telefone,
        c.email,
        c.cpf,
        c.origem,
        c.data_aniversario,
        c.data_cadastro,
        coalesce(c.utms, '[]'::jsonb) as utms,
        coalesce(c.tags_webhook, '[]'::jsonb) as tags_webhook,
        coalesce(tags.tags, '[]'::jsonb) as tags
      from public.cliente c
      left join lateral (
        select json_agg(
          json_build_object(
            'id', t.id,
            'nome', t.nome,
            'cor', null
          )
          order by t.nome asc, t.id asc
        ) as tags
        from public.cliente_tag ct
        inner join public.tag t
          on t.id = ct.tag_id
        where ct.cliente_id = c.id
      ) tags on true
      where c.id = $1
      limit 1
    `;
  },

  get_conversation_payload_by_id: () => {
    return `
      select
        ccw.id,
        ccw.empresa_id,
        ccw.cliente_id,
        ccw.usuario_id,
        ccw.usuario_atribuido_id,
        ccw.status_id,
        ccw.number_phone_id,
        ccw.empresa_meta_param_id,
        ccw.data_inicio,
        ccw.data_fim,
        c.nome as cliente_nome,
        c.telefone as cliente_telefone,
        c.email as cliente_email,
        c.origem as cliente_origem,
        u.nome as usuario_nome,
        ua.nome as usuario_atribuido_nome
      from public.cliente_conversa_whats ccw
      left join public.cliente c
        on c.id = ccw.cliente_id
      left join public.usuario u
        on u.id = ccw.usuario_id
      left join public.usuario ua
        on ua.id = ccw.usuario_atribuido_id
      where ccw.id = $1
      limit 1
    `;
  },

  get_message_payload_by_id: () => {
    return `
      select
        m.id,
        m.cliente_conversa_id,
        m.mensagem,
        m.tipo_id,
        m.data_mensagem,
        m.status,
        coalesce(m.reply, false) as reply,
        m.mensagem_reply_id,
        m.mensagem_whats_id,
        m.send_by,
        m.midia_id,
        m.media_tipe,
        ccw.empresa_id,
        ccw.cliente_id,
        ccw.status_id as conversa_status_id,
        ccw.number_phone_id,
        ccw.empresa_meta_param_id,
        c.nome as cliente_nome,
        c.telefone as cliente_telefone,
        c.email as cliente_email,
        u.nome as usuario_nome,
        ua.nome as usuario_atribuido_nome
      from public.cliente_conversa_whats_mensagem m
      inner join public.cliente_conversa_whats ccw
        on ccw.id = m.cliente_conversa_id
      left join public.cliente c
        on c.id = ccw.cliente_id
      left join public.usuario u
        on u.id = ccw.usuario_id
      left join public.usuario ua
        on ua.id = ccw.usuario_atribuido_id
      where m.id = $1
      limit 1
    `;
  },

  get_deal_payload_by_id: () => {
    return `
      select
        n.id,
        n.empresa_id,
        n.crm_id,
        crm.nome as crm_nome,
        n.etapa_id,
        e.codigo as etapa_codigo,
        e.nome as etapa_nome,
        e.eh_fechamento,
        e.eh_ganho,
        n.cliente_id,
        n.responsavel_usuario_id,
        u.nome as responsavel_nome,
        n.titulo,
        n.nome_empresa,
        n.nome_contato,
        n.telefone,
        n.email,
        n.documento,
        n.valor_estimado,
        n.valor_fechamento,
        n.quantidade_itens,
        n.origem_venda,
        fp.codigo as forma_pagamento_codigo,
        fp.nome as forma_pagamento_nome,
        n.parcelas,
        mp.codigo as motivo_perda_codigo,
        mp.nome as motivo_perda_nome,
        n.data_criacao,
        n.data_entrada_pipeline,
        n.data_fechamento_prevista,
        n.data_fechamento_real,
        c.nome as cliente_nome,
        c.telefone as cliente_telefone,
        c.email as cliente_email,
        c.origem as cliente_origem,
        coalesce(orcamento.quote, json_build_object(
          'id', null,
          'title', n.titulo,
          'subtotal', coalesce(n.valor_estimado, 0),
          'discount', 0,
          'total', coalesce(n.valor_fechamento, n.valor_estimado, 0),
          'status', case when coalesce(e.eh_fechamento, false) then e.codigo else 'ativo' end,
          'notes', null,
          'items', '[]'::json
        )) as quote
      from public.comercial_negocio n
      left join public.comercial_crm crm
        on crm.id = n.crm_id
      left join public.comercial_etapa e
        on e.id = n.etapa_id
      left join public.usuario u
        on u.id = n.responsavel_usuario_id
      left join public.comercial_forma_pagamento fp
        on fp.id = n.forma_pagamento_id
      left join public.comercial_motivo_perda mp
        on mp.id = n.motivo_perda_id
      left join public.cliente c
        on c.id = n.cliente_id
      left join lateral (
        select json_build_object(
          'id', co.id,
          'title', coalesce(co.titulo, n.titulo),
          'subtotal', coalesce(co.subtotal, 0),
          'discount', coalesce(co.desconto, 0),
          'total', coalesce(co.total, 0),
          'status', co.status,
          'notes', co.observacoes,
          'items', coalesce(itens.items, '[]'::json)
        ) as quote
        from public.comercial_orcamento co
        left join lateral (
          select json_agg(
            json_build_object(
              'id', coi.id,
              'name', coi.nome_produto,
              'quantity', coi.quantidade,
              'price', coi.preco_unitario,
              'subtotal', coi.total_item,
              'status', coi.status,
              'sold_quantity', coi.quantidade_ganha,
              'lost_quantity', coi.quantidade_perdida
            )
            order by coi.id asc
          ) as items
          from public.comercial_orcamento_item coi
          where coi.orcamento_id = co.id
            and coi.ativo = true
        ) itens on true
        where co.negocio_id = n.id
          and co.empresa_id = n.empresa_id
          and co.ativo = true
          and co.principal = true
        order by co.id desc
        limit 1
      ) orcamento on true
      where n.id = $1
      limit 1
    `;
  },
};

module.exports = models;
