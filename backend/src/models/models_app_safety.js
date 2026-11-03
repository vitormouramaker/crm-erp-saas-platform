const models = {
  get_cliente_empresa: () => `
    select id, empresa_id, nome, telefone, email
    from cliente
    where id = $1 and empresa_id = $2 and ativo = true
    limit 1
  `,

  get_conversa_cliente_contexto: () => `
    select ccw.id as conversa_id, ccw.empresa_id, ccw.cliente_id, c.nome as cliente_nome
    from cliente_conversa_whats ccw
    inner join cliente c on c.id = ccw.cliente_id and c.empresa_id = ccw.empresa_id
    where ccw.id = $1
    limit 1
  `,

  bloquear_cliente: () => `
    insert into app_cliente_bloqueio (
      empresa_id, cliente_id, bloqueado_por_usuario_id, motivo, ativo, criado_em, atualizado_em
    ) values ($1, $2, $3, $4, true, current_timestamp, current_timestamp)
    on conflict (empresa_id, cliente_id)
    do update set
      bloqueado_por_usuario_id = excluded.bloqueado_por_usuario_id,
      motivo = excluded.motivo,
      ativo = true,
      desbloqueado_por_usuario_id = null,
      desbloqueado_em = null,
      atualizado_em = current_timestamp
    returning *
  `,

  desbloquear_cliente: () => `
    update app_cliente_bloqueio
    set ativo = false,
        desbloqueado_por_usuario_id = $3,
        desbloqueado_em = current_timestamp,
        atualizado_em = current_timestamp
    where empresa_id = $1 and cliente_id = $2 and ativo = true
    returning *
  `,

  cliente_bloqueado: () => `
    select exists (
      select 1 from app_cliente_bloqueio
      where empresa_id = $1 and cliente_id = $2 and ativo = true
    ) as bloqueado
  `,

  conversa_cliente_bloqueado: () => `
    select exists (
      select 1
      from cliente_conversa_whats ccw
      inner join app_cliente_bloqueio b
        on b.empresa_id = ccw.empresa_id
       and b.cliente_id = ccw.cliente_id
       and b.ativo = true
      where ccw.id = $1
    ) as bloqueado
  `,

  listar_clientes_bloqueados: () => `
    select
      b.id, b.empresa_id, b.cliente_id, c.nome, c.telefone, c.email,
      b.motivo, b.bloqueado_por_usuario_id, u.nome as bloqueado_por_nome,
      b.criado_em, b.atualizado_em
    from app_cliente_bloqueio b
    inner join cliente c on c.id = b.cliente_id and c.empresa_id = b.empresa_id
    left join usuario u on u.id = b.bloqueado_por_usuario_id
    where b.empresa_id = $1 and b.ativo = true
    order by b.atualizado_em desc, b.id desc
  `,

  criar_denuncia: () => `
    insert into app_denuncia (
      empresa_id, usuario_id, cliente_id, conversa_id, mensagem_id,
      tipo, motivo, descricao, dados, status, criado_em
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'pendente',current_timestamp)
    returning *
  `,

  apagar_mensagem_plataforma: () => `
    update cliente_conversa_whats_mensagem m
    set apagada = true,
        apagada_em = current_timestamp
    from cliente_conversa_whats ccw
    where m.id = $1
      and m.cliente_conversa_id = $2
      and ccw.id = m.cliente_conversa_id
      and ccw.empresa_id = $3
    returning m.id, m.cliente_conversa_id, m.apagada, m.apagada_em
  `,

  listar_palavras_bloqueadas: () => `
    select palavra
    from app_palavra_bloqueada
    where ativo = true and (empresa_id is null or empresa_id = $1)
    order by length(palavra) desc
  `,
};

module.exports = models;
