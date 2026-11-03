module.exports = {
  list_candidates: () => `
    select
      ccw.id as conversa_id,
      ccw.empresa_id,
      ccw.usuario_id,
      ccw.number_phone_id,
      c.telefone,
      auto_message.texto,
      last_message.id as mensagem_gatilho_id,
      last_message.data_mensagem
    from cliente_conversa_whats ccw
    join cliente c on c.id = ccw.cliente_id and c.ativo = true
    join empresa_meta_parans empm
      on empm.id = ccw.empresa_meta_param_id
     and empm.empresa_id = ccw.empresa_id
     and coalesce(empm.ativo, true) = true
     and coalesce(empm.whatsapp_auto_message_sem_resposta_6h_ativa, false) = true
    join lateral (
      select wam.texto
      from whatsapp_auto_message wam
      where wam.empresa_id = ccw.empresa_id
        and wam.whatsapp_auto_message_tipo_id = 8
        and wam.ativo = true
        and (wam.empresa_meta_param_id = ccw.empresa_meta_param_id or wam.empresa_meta_param_id is null)
        and nullif(trim(wam.texto), '') is not null
      order by
        case when wam.empresa_meta_param_id = ccw.empresa_meta_param_id then 0 else 1 end,
        wam.id desc
      limit 1
    ) auto_message on true
    join lateral (
      select m.id, m.send_by, m.data_mensagem
      from cliente_conversa_whats_mensagem m
      where m.cliente_conversa_id = ccw.id
      order by m.data_mensagem desc, m.id desc
      limit 1
    ) last_message on true
    where ccw.status_id = 1
      and ccw.data_fim is null
      and last_message.send_by = 2
      and last_message.data_mensagem <= now() - ($1::int * interval '1 hour')
      and last_message.data_mensagem >= now() - interval '24 hours'
      and exists (
        select 1
        from cliente_conversa_whats_mensagem customer_window
        where customer_window.cliente_conversa_id = ccw.id
          and customer_window.send_by = 1
          and customer_window.data_mensagem >= now() - interval '24 hours'
      )
      and not exists (
        select 1
        from whatsapp_no_reply_followup_envio sent
        where sent.conversa_id = ccw.id
          and sent.status = 'sent'
          and not exists (
            select 1
            from cliente_conversa_whats_mensagem reply
            where reply.cliente_conversa_id = ccw.id
              and reply.send_by = 1
              and reply.data_mensagem > sent.enviado_em
          )
      )
    order by last_message.data_mensagem
    limit $2::int
  `,

  claim: () => `
    insert into whatsapp_no_reply_followup_envio (
      conversa_id, mensagem_gatilho_id, empresa_id, status, lock_token, tentativas
    ) values ($1, $2, $3, 'processing', $4, 1)
    on conflict (mensagem_gatilho_id) do update
    set status = 'processing',
        lock_token = excluded.lock_token,
        tentativas = whatsapp_no_reply_followup_envio.tentativas + 1,
        erro = null,
        atualizado_em = now()
    where whatsapp_no_reply_followup_envio.status = 'error'
       or (
         whatsapp_no_reply_followup_envio.status = 'processing'
         and whatsapp_no_reply_followup_envio.atualizado_em < now() - interval '30 minutes'
       )
    returning id
  `,

  still_eligible: () => `
    select exists (
      select 1
      from cliente_conversa_whats ccw
      join lateral (
        select m.id, m.send_by, m.data_mensagem
        from cliente_conversa_whats_mensagem m
        where m.cliente_conversa_id = ccw.id
        order by m.data_mensagem desc, m.id desc
        limit 1
      ) last_message on true
      where ccw.id = $1
        and ccw.status_id = 1
        and ccw.data_fim is null
        and last_message.id = $2
        and last_message.send_by = 2
        and last_message.data_mensagem <= now() - ($3::int * interval '1 hour')
        and last_message.data_mensagem >= now() - interval '24 hours'
        and exists (
          select 1
          from cliente_conversa_whats_mensagem customer_window
          where customer_window.cliente_conversa_id = ccw.id
            and customer_window.send_by = 1
            and customer_window.data_mensagem >= now() - interval '24 hours'
        )
    ) as eligible
  `,

  mark_sent: () => `
    update whatsapp_no_reply_followup_envio
    set status = 'sent', mensagem_whats_id = $2, enviado_em = now(), atualizado_em = now()
    where id = $1 and lock_token = $3
  `,

  mark_error: () => `
    update whatsapp_no_reply_followup_envio
    set status = 'error', erro = left($2, 2000), atualizado_em = now()
    where id = $1 and lock_token = $3
  `,
};
