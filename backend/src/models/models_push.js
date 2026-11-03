const models = {
  upsert_push_token: () => {
    return `
      insert into public.push_token (
        usuario_id,
        empresa_id,
        expo_push_token,
        platform,
        device_id,
        ativo,
        criado_em,
        atualizado_em
      )
      values ($1, $2, $3, $4, $5, true, current_timestamp, current_timestamp)
      on conflict (usuario_id, expo_push_token)
      do update set
        empresa_id = excluded.empresa_id,
        platform = excluded.platform,
        device_id = excluded.device_id,
        ativo = true,
        atualizado_em = current_timestamp
      returning
        id,
        usuario_id,
        empresa_id,
        expo_push_token,
        platform,
        device_id,
        ativo,
        criado_em,
        atualizado_em
    `;
  },

  deactivate_push_token_by_user: () => {
    return `
      update public.push_token
      set
        ativo = false,
        atualizado_em = current_timestamp
      where usuario_id = $1
        and empresa_id = $2
        and expo_push_token = $3
        and ativo = true
      returning id
    `;
  },

  deactivate_push_tokens_by_values: () => {
    return `
      update public.push_token
      set
        ativo = false,
        atualizado_em = current_timestamp
      where expo_push_token = any($1::text[])
      returning expo_push_token
    `;
  },

  get_push_dispatch_context: () => {
    return `
      select
        ccw.id as conversa_id,
        ccw.empresa_id,
        ccw.empresa_meta_param_id,
        ccw.usuario_id,
        ccw.usuario_atribuido_id,
        ccw.status_id,
        ccw.setor_id,
        c.id as cliente_id,
        c.nome as cliente_nome
      from public.cliente_conversa_whats ccw
      left join public.cliente c
        on c.id = ccw.cliente_id
      where ccw.id = $1
      limit 1
    `;
  },

  get_empresa_push_dispatch_config: () => {
    return `
      select
        e.id as empresa_id,
        coalesce(e.atendimento_lista_atribuida_adm, false) as atendimento_lista_atribuida_adm,
        coalesce(e.atendimento_fila_automatica_ativa, false) as atendimento_fila_automatica_ativa
      from public.empresa e
      where e.id = $1
      limit 1
    `;
  },

  list_push_target_user_ids_by_sector: () => {
    return `
      select distinct
        u.id as usuario_id
      from public.usuario u
      inner join public.usuario_setor us
        on us.usuario_id = u.id
      where u.empresa_id = $1
        and us.setor_id = $2
        and u.ativo = true
    `;
  },

  list_push_target_user_ids_for_waiting_meta_number: () => {
    return `
      with assinatura_ativa as (
        select ea.assinatura_id
        from public.empresa_assinatura ea
        where ea.empresa_id = $1
          and ea.ativo = true
          and ea.validade >= current_date
        order by ea.id desc
        limit 1
      )
      select distinct
        u.id as usuario_id
      from public.usuario u
      left join assinatura_ativa aa on true
      left join public.assinatura pl
        on pl.id = aa.assinatura_id
      left join public.usuario_meta_numero umn
        on umn.usuario_id = u.id
       and umn.empresa_meta_param_id = $2
      where u.empresa_id = $1
        and u.ativo = true
        and (
          coalesce(u.is_master, false) = true
          or coalesce(u.permissoes_customizadas, '[]'::jsonb) ? 'chat.manager'
          or coalesce(pl.permissoes, '[]'::jsonb) ? 'chat.manager'
          or (
            coalesce($3::boolean, false) = false
            and coalesce($4::boolean, false) = false
            and $2::bigint is not null
            and umn.usuario_id is not null
            and (
              coalesce(u.permissoes_customizadas, '[]'::jsonb) ? 'chat.view'
              or coalesce(pl.permissoes, '[]'::jsonb) ? 'chat.view'
            )
          )
        )
      order by u.id asc
    `;
  },

  list_active_push_tokens_by_users: () => {
    return `
      select
        pt.id,
        pt.usuario_id,
        pt.empresa_id,
        pt.expo_push_token,
        pt.platform,
        pt.device_id
      from public.push_token pt
      where pt.empresa_id = $1
        and pt.ativo = true
        and pt.usuario_id = any($2::int[])
      order by pt.id asc
    `;
  },
};

module.exports = models;
