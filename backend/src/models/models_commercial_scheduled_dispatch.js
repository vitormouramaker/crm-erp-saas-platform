const models = {
  list_scheduled_dispatches: () => {
    return `
      select
        sd.id,
        sd.empresa_id,
        sd.usuario_id,
        sd.empresa_meta_param_id,
        sd.template_name,
        sd.template_language,
        sd.audience_type,
        sd.lista_transmissao_id,
        sd.crm_id,
        sd.etapa_id,
        sd.scheduled_date,
        sd.scheduled_hour,
        sd.header_media_type,
        sd.header_media_url,
        coalesce(sd.header_parameters, '[]'::jsonb) as header_parameters,
        coalesce(sd.body_parameters, '[]'::jsonb) as body_parameters,
        coalesce(sd.button_parameters, '[]'::jsonb) as button_parameters,
        sd.status,
        sd.total_recipients,
        sd.processed_recipients,
        sd.sent_recipients,
        sd.error_recipients,
        sd.dispatch_history_id,
        sd.processing_started_at,
        sd.completed_at,
        sd.canceled_at,
        sd.last_error_message,
        coalesce(sd.metadata, '{}'::jsonb) as metadata,
        sd.created_at,
        sd.updated_at,
        emp.meta_display_phone_number as display_phone_number,
        emp.meta_verified_name as verified_name,
        lt.nome as lista_nome,
        crm.nome as crm_nome,
        etapa.nome as etapa_nome,
        usuario.nome as usuario_nome
      from comercial_disparo_agendado sd
      left join empresa_meta_parans emp
        on emp.id = sd.empresa_meta_param_id
       and emp.empresa_id = sd.empresa_id
      left join cliente_lista_transmissao lt
        on lt.id = sd.lista_transmissao_id
       and lt.empresa_id = sd.empresa_id
      left join comercial_crm crm
        on crm.id = sd.crm_id
       and crm.empresa_id = sd.empresa_id
      left join comercial_etapa etapa
        on etapa.id = sd.etapa_id
       and etapa.crm_id = sd.crm_id
      left join usuario
        on usuario.id = sd.usuario_id
      where sd.empresa_id = $1
      order by
        case when sd.status in ('pending', 'processing') then 0 else 1 end,
        sd.scheduled_date desc,
        sd.scheduled_hour desc,
        sd.id desc
    `;
  },

  get_scheduled_dispatch_by_id: () => {
    return `
      select
        sd.id,
        sd.empresa_id,
        sd.usuario_id,
        sd.empresa_meta_param_id,
        sd.template_name,
        sd.template_language,
        sd.audience_type,
        sd.lista_transmissao_id,
        sd.crm_id,
        sd.etapa_id,
        sd.scheduled_date,
        sd.scheduled_hour,
        sd.header_media_type,
        sd.header_media_url,
        coalesce(sd.header_parameters, '[]'::jsonb) as header_parameters,
        coalesce(sd.body_parameters, '[]'::jsonb) as body_parameters,
        coalesce(sd.button_parameters, '[]'::jsonb) as button_parameters,
        sd.status,
        sd.total_recipients,
        sd.processed_recipients,
        sd.sent_recipients,
        sd.error_recipients,
        sd.dispatch_history_id,
        sd.processing_started_at,
        sd.completed_at,
        sd.canceled_at,
        sd.last_error_message,
        coalesce(sd.metadata, '{}'::jsonb) as metadata,
        sd.created_at,
        sd.updated_at,
        emp.meta_display_phone_number as display_phone_number,
        emp.meta_verified_name as verified_name,
        lt.nome as lista_nome,
        crm.nome as crm_nome,
        etapa.nome as etapa_nome,
        usuario.nome as usuario_nome
      from comercial_disparo_agendado sd
      left join empresa_meta_parans emp
        on emp.id = sd.empresa_meta_param_id
       and emp.empresa_id = sd.empresa_id
      left join cliente_lista_transmissao lt
        on lt.id = sd.lista_transmissao_id
       and lt.empresa_id = sd.empresa_id
      left join comercial_crm crm
        on crm.id = sd.crm_id
       and crm.empresa_id = sd.empresa_id
      left join comercial_etapa etapa
        on etapa.id = sd.etapa_id
       and etapa.crm_id = sd.crm_id
      left join usuario
        on usuario.id = sd.usuario_id
      where sd.id = $1
        and sd.empresa_id = $2
      limit 1
    `;
  },

  insert_scheduled_dispatch: () => {
    return `
      insert into comercial_disparo_agendado (
        empresa_id,
        usuario_id,
        empresa_meta_param_id,
        template_name,
        template_language,
        audience_type,
        lista_transmissao_id,
        crm_id,
        etapa_id,
        scheduled_date,
        scheduled_hour,
        header_media_type,
        header_media_url,
        header_parameters,
        body_parameters,
        button_parameters,
        metadata
      )
      values (
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
        $11,
        $12,
        $13,
        $14::jsonb,
        $15::jsonb,
        $16::jsonb,
        $17::jsonb
      )
      returning id
    `;
  },

  cancel_scheduled_dispatch: () => {
    return `
      update comercial_disparo_agendado
      set
        status = 'canceled',
        canceled_at = now(),
        updated_at = now()
      where id = $1
        and empresa_id = $2
        and status = 'pending'
      returning id
    `;
  },

  claim_due_scheduled_dispatches: () => {
    return `
      with due as (
        select sd.id
        from comercial_disparo_agendado sd
        where (
          sd.status = 'pending'
          and (
            sd.scheduled_date < $1::date
            or (sd.scheduled_date = $1::date and sd.scheduled_hour <= $2::int)
          )
        ) or (
          sd.status = 'processing'
          and sd.processing_started_at is not null
          and sd.processing_started_at <= now() - make_interval(mins => $3::int)
          and (
            sd.scheduled_date < $1::date
            or (sd.scheduled_date = $1::date and sd.scheduled_hour <= $2::int)
          )
        )
        order by sd.scheduled_date asc, sd.scheduled_hour asc, sd.id asc
        for update skip locked
        limit $4
      )
      update comercial_disparo_agendado sd
      set
        status = 'processing',
        processing_token = $5,
        processing_started_at = now(),
        last_error_message = null,
        updated_at = now()
      from due
      where sd.id = due.id
      returning sd.*
    `;
  },

  attach_dispatch_history_id: () => {
    return `
      update comercial_disparo_agendado
      set
        dispatch_history_id = $3,
        updated_at = now()
      where id = $1
        and empresa_id = $2
      returning id, dispatch_history_id
    `;
  },

  complete_scheduled_dispatch: () => {
    return `
      update comercial_disparo_agendado
      set
        status = $3,
        total_recipients = $4,
        processed_recipients = $5,
        sent_recipients = $6,
        error_recipients = $7,
        completed_at = now(),
        processing_started_at = null,
        processing_token = null,
        last_error_message = $8,
        updated_at = now(),
        dispatch_history_id = coalesce($9, dispatch_history_id)
      where id = $1
        and processing_token = $2
      returning *
    `;
  },

  fail_scheduled_dispatch: () => {
    return `
      update comercial_disparo_agendado
      set
        status = 'failed',
        completed_at = now(),
        processing_started_at = null,
        processing_token = null,
        last_error_message = $3,
        updated_at = now(),
        dispatch_history_id = coalesce($4, dispatch_history_id)
      where id = $1
        and processing_token = $2
      returning *
    `;
  },

  upsert_scheduled_dispatch_recipient_item: () => {
    return `
      insert into comercial_disparo_agendado_item (
        agendamento_id,
        empresa_id,
        cliente_id,
        numero_original,
        numero_normalizado,
        contato_nome,
        email,
        data_aniversario,
        conversa_id,
        negocio_id,
        negocio_titulo,
        metadata
      )
      values (
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
        $11,
        $12::jsonb
      )
      on conflict (agendamento_id, numero_normalizado)
      do update set
        cliente_id = excluded.cliente_id,
        numero_original = excluded.numero_original,
        contato_nome = excluded.contato_nome,
        email = excluded.email,
        data_aniversario = excluded.data_aniversario,
        conversa_id = excluded.conversa_id,
        negocio_id = excluded.negocio_id,
        negocio_titulo = excluded.negocio_titulo,
        metadata = excluded.metadata,
        updated_at = now()
      returning *
    `;
  },

  claim_next_scheduled_dispatch_recipient_item: () => {
    return `
      with candidate as (
        select item.id
        from comercial_disparo_agendado_item item
        where item.agendamento_id = $1
          and (
            item.status = 'pending'
            or (
              item.status = 'processing'
              and item.processing_started_at is not null
              and item.processing_started_at <= now() - make_interval(mins => $2::int)
            )
          )
        order by item.id asc
        for update skip locked
        limit 1
      )
      update comercial_disparo_agendado_item item
      set
        status = 'processing',
        lock_token = $3,
        processing_started_at = now(),
        erro_mensagem = null,
        updated_at = now()
      from candidate
      where item.id = candidate.id
      returning item.*
    `;
  },

  mark_scheduled_dispatch_recipient_item_sent: () => {
    return `
      update comercial_disparo_agendado_item
      set
        status = 'sent',
        lock_token = null,
        processing_started_at = null,
        dispatched_at = $3,
        mensagem_whats_id = $4,
        message_status = $5,
        erro_mensagem = null,
        metadata = coalesce(metadata, '{}'::jsonb) || $6::jsonb,
        updated_at = now()
      where id = $1
        and lock_token = $2
      returning *
    `;
  },

  mark_scheduled_dispatch_recipient_item_error: () => {
    return `
      update comercial_disparo_agendado_item
      set
        status = 'error',
        lock_token = null,
        processing_started_at = null,
        erro_mensagem = $3,
        metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
        updated_at = now()
      where id = $1
        and lock_token = $2
      returning *
    `;
  },

  count_scheduled_dispatch_recipient_items: () => {
    return `
      select
        count(*)::int as total_recipients,
        count(*) filter (
          where status in ('sent', 'error', 'skipped', 'canceled')
        )::int as processed_recipients,
        count(*) filter (where status = 'sent')::int as sent_recipients,
        count(*) filter (where status = 'error')::int as error_recipients
      from comercial_disparo_agendado_item
      where agendamento_id = $1
    `;
  },

  list_broadcast_list_schedule_recipients: () => {
    return `
      select
        c.id as cliente_id,
        c.nome as contato_nome,
        c.telefone,
        c.email,
        c.data_aniversario,
        conversa.id as conversa_id,
        null::bigint as negocio_id,
        null::varchar as negocio_titulo
      from cliente_lista_transmissao_contato ltc
      inner join cliente_lista_transmissao lt
        on lt.id = ltc.lista_transmissao_id
      inner join cliente c
        on c.id = ltc.cliente_id
      left join lateral (
        select ccw.id
        from cliente_conversa_whats ccw
        where ccw.empresa_id = lt.empresa_id
          and ccw.cliente_id = c.id
          and ($3::bigint is null or ccw.empresa_meta_param_id = $3::bigint)
        order by
          coalesce(ccw.ultima_atualizacao, ccw.data_inicio) desc nulls last,
          ccw.id desc
        limit 1
      ) conversa on true
      where ltc.lista_transmissao_id = $1
        and lt.empresa_id = $2
        and lt.ativo = true
        and c.ativo = true
      order by c.nome asc, c.id asc
    `;
  },

  list_crm_stage_schedule_recipients: () => {
    return `
      select
        n.id as negocio_id,
        n.titulo as negocio_titulo,
        c.id as cliente_id,
        coalesce(c.nome, n.nome_contato, n.nome_empresa, n.titulo) as contato_nome,
        coalesce(n.telefone, c.telefone) as telefone,
        coalesce(n.email, c.email) as email,
        c.data_aniversario,
        conversa.id as conversa_id
      from comercial_negocio n
      left join cliente c
        on c.id = n.cliente_id
      left join lateral (
        select ccw.id
        from cliente_conversa_whats ccw
        where ccw.empresa_id = n.empresa_id
          and ccw.cliente_id = n.cliente_id
          and ($4::bigint is null or ccw.empresa_meta_param_id = $4::bigint)
        order by
          coalesce(ccw.ultima_atualizacao, ccw.data_inicio) desc nulls last,
          ccw.id desc
        limit 1
      ) conversa on true
      where n.empresa_id = $1
        and n.crm_id = $2
        and n.etapa_id = $3
        and n.ativo = true
      order by n.data_criacao desc, n.id desc
    `;
  },
};

module.exports = models;
