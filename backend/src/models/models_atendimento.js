function buildFinalizedConversationListQuery({ scopedToUser = false } = {}) {
  const usuarioIdParam = scopedToUser ? "$1" : "$2";
  const empresaIdParam = scopedToUser ? "$2" : "$1";
  const allowedMetaFilter = scopedToUser
    ? `
        and ccw.empresa_meta_param_id = any($3::int[])`
    : "";
  const offsetParam = scopedToUser ? "$4" : "$3";
  const limitParam = scopedToUser ? "$5" : "$4";
  const dateStartParam = scopedToUser ? "$6" : "$5";
  const dateEndParam = scopedToUser ? "$7" : "$6";
  const ownerFilter = scopedToUser
    ? `
        and ccw.usuario_id = ${usuarioIdParam}`
    : "";
  const unreadCountExpression = scopedToUser
    ? `
        (
          select count(1)::int
          from cliente_conversa_whats_mensagem ccm
          where ccm.cliente_conversa_id = paged.id
            and ccm.send_by = 1
            and ccm.id > coalesce((
              select cl.ultima_mensagem_lida_id
              from cliente_conversa_whats_usuario_leitura cl
              where cl.cliente_conversa_id = paged.id
                and cl.usuario_id = ${usuarioIdParam}
              limit 1
            ), 0)
        )`
    : `
        case
          when ${usuarioIdParam}::int is null then 0
          else (
            select count(1)::int
            from cliente_conversa_whats_mensagem ccm
            where ccm.cliente_conversa_id = paged.id
              and ccm.send_by = 1
              and ccm.id > coalesce((
                select cl.ultima_mensagem_lida_id
                from cliente_conversa_whats_usuario_leitura cl
                where cl.cliente_conversa_id = paged.id
                  and cl.usuario_id = ${usuarioIdParam}
                limit 1
              ), 0)
          )
        end`;

  return `
    with base as (
      select
        ccw.id,
        c.nome,
        c.telefone,
        c.utms,
        ccw.cliente_id,
        ccw.usuario_id,
        ccw.empresa_meta_param_id,
        ccw.usuario_atribuido_id,
        ua.nome as nome_usuario_atribuido,
        u.nome as nome_atendente,
        coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id::varchar, '') as meta_numero_conta,
        coalesce(emp.meta_verified_name, emp.meta_waba_name, '') as meta_nome_conta,
        emp.cor as meta_cor,
        ccw.data_inicio,
        ccw.data_fim,
        ccw.ultima_atualizacao,
        coalesce(ccw.data_inicio, ccw.ultima_atualizacao) as fila_desde,
        coalesce(
          coalesce(ccw.data_inicio, ccw.ultima_atualizacao) <= current_timestamp - interval '24 hours',
          false
        ) as fila_mais_24h,
        row_number() over (
          partition by ccw.cliente_id, coalesce(ccw.empresa_meta_param_id, 0)
          order by ccw.data_fim desc nulls last, ccw.id desc
        ) as rn
      from cliente_conversa_whats ccw
      inner join cliente c
        on c.id = ccw.cliente_id
       and c.empresa_id = ccw.empresa_id
       and c.ativo = true
      left join usuario u
        on u.id = ccw.usuario_id
      left join usuario ua
        on ua.id = ccw.usuario_atribuido_id
      left join empresa_meta_parans emp
        on emp.id = ccw.empresa_meta_param_id
      where ccw.empresa_id = ${empresaIdParam}
        and ccw.status_id = 2
        and ccw.data_fim is not null${ownerFilter}${allowedMetaFilter}
        and (${dateStartParam}::date is null or ccw.data_fim >= ${dateStartParam}::date::timestamp)
        and (${dateEndParam}::date is null or ccw.data_fim < (${dateEndParam}::date::timestamp + interval '1 day'))
    ),
    deduped as (
      select
        id,
        nome,
        telefone,
        utms,
        cliente_id,
        usuario_id,
        empresa_meta_param_id,
        usuario_atribuido_id,
        nome_usuario_atribuido,
        nome_atendente,
        meta_numero_conta,
        meta_nome_conta,
        meta_cor,
        data_inicio,
        data_fim,
        ultima_atualizacao,
        fila_desde,
        fila_mais_24h
      from base
      where rn = 1
    ),
    paged as (
      select
        deduped.*,
        count(*) over ()::int as status_total
      from deduped
      order by data_fim desc nulls last, id desc
      limit ${limitParam}
      offset ${offsetParam}
    )
    select
      paged.id,
      paged.nome,
      paged.telefone,
      paged.utms,
      paged.cliente_id,
      paged.usuario_id,
      paged.empresa_meta_param_id,
      paged.usuario_atribuido_id,
      paged.nome_usuario_atribuido,
      paged.nome_atendente,
      paged.meta_numero_conta,
      paged.meta_nome_conta,
      paged.meta_cor,
      coalesce(
        template_lock.total_templates > 0
        and template_lock.total_mensagens_cliente = 0
        and template_lock.total_mensagens_agente_nao_template = 0,
        false
      ) as aguardando_resposta_template,
      'finished' as status,
      paged.data_inicio,
      paged.fila_desde,
      paged.fila_mais_24h,
      paged.data_fim,
      paged.ultima_atualizacao,
      meta_window.ultima_mensagem_cliente_em,
      case
        when meta_window.ultima_mensagem_cliente_em is not null
          then meta_window.ultima_mensagem_cliente_em + interval '24 hours'
        else null
      end as janela_meta_expira_em,
      coalesce(
        meta_window.ultima_mensagem_cliente_em >= current_timestamp - interval '24 hours',
        false
      ) as janela_meta_aberta,
      last_message.ultima_mensagem,
      last_message.ultima_mensagem_send_by,
      ${unreadCountExpression} as unread_count,
      paged.status_total
    from paged
    left join lateral (
      select
        coalesce(count(*) filter (where ccm.send_by = 1), 0)::int as total_mensagens_cliente,
        coalesce(
          count(*) filter (
            where ccm.send_by in (2, 3, 4)
              and not exists (
                select 1
                from whatsapp_template_disparo_item item
                where item.message_id is not null
                  and item.message_id = ccm.mensagem_whats_id
              )
          ),
          0
        )::int as total_mensagens_agente_nao_template,
        (
          select count(1)::int
          from whatsapp_template_disparo_item item
          where item.conversa_id = paged.id
            and item.sucesso = true
        ) as total_templates
      from cliente_conversa_whats_mensagem ccm
      where ccm.cliente_conversa_id = paged.id
    ) template_lock on true
    left join lateral (
      select max(ccm.data_mensagem) as ultima_mensagem_cliente_em
      from cliente_conversa_whats_mensagem ccm
      where ccm.cliente_conversa_id = paged.id
        and ccm.send_by = 1
    ) meta_window on true
    left join lateral (
      select
        ccm.mensagem as ultima_mensagem,
        ccm.send_by as ultima_mensagem_send_by
      from cliente_conversa_whats_mensagem ccm
      where ccm.cliente_conversa_id = paged.id
      order by ccm.id desc
      limit 1
    ) last_message on true
    order by paged.data_fim desc nulls last, paged.id desc
  `;
}

const models = {
  iniciar_atendimento: () => {
    return `
	update cliente_conversa_whats 
	set usuario_id = $2, usuario_atribuido_id = null, status_id = 1, ultima_atualizacao = current_timestamp 
	where id = $1
	  and usuario_id is null
	  and status_id = 0
	  and data_fim is null
	returning number_phone_id
	`;
  },

  lista_aguardando_atendimento: () => {
    return `select 
		ccw.id,
		c.nome,
		c.telefone,
		c.utms,
		ccw.cliente_id as cliente_id,
		ccw.empresa_meta_param_id,
		ccw.usuario_atribuido_id,
		ua.nome as nome_usuario_atribuido,
		coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id::varchar, '') as meta_numero_conta,
		coalesce(emp.meta_verified_name, emp.meta_waba_name, '') as meta_nome_conta,
		emp.cor as meta_cor,
		'waiting' as status,
		ccw.data_inicio,
		coalesce(ccw.data_inicio, ccw.ultima_atualizacao) as fila_desde,
		coalesce(
			coalesce(ccw.data_inicio, ccw.ultima_atualizacao) <= current_timestamp - interval '24 hours',
			false
		) as fila_mais_24h,
		ccw.ultima_atualizacao,
		meta_window.ultima_mensagem_cliente_em,
		case
			when meta_window.ultima_mensagem_cliente_em is not null
				then meta_window.ultima_mensagem_cliente_em + interval '24 hours'
			else null
		end as janela_meta_expira_em,
		coalesce(
			meta_window.ultima_mensagem_cliente_em >= current_timestamp - interval '24 hours',
			false
		) as janela_meta_aberta,
		last_message.ultima_mensagem,
		last_message.ultima_mensagem_send_by,
		(
			select count(1)::int
			from cliente_conversa_whats_mensagem ccm
			where ccm.cliente_conversa_id = ccw.id
			  and ccm.send_by = 1
		) as unread_count
		from cliente_conversa_whats  ccw 
		left join cliente c on c.id = ccw.cliente_id
		left join usuario ua on ua.id = ccw.usuario_atribuido_id
		left join empresa_meta_parans emp on emp.id = ccw.empresa_meta_param_id
		left join empresa e on e.id = ccw.empresa_id
		left join lateral (
			select max(ccm.data_mensagem) as ultima_mensagem_cliente_em
			from cliente_conversa_whats_mensagem ccm
			where ccm.cliente_conversa_id = ccw.id
			  and ccm.send_by = 1
		) meta_window on true
		left join lateral (
			select
				ccm.mensagem as ultima_mensagem,
				ccm.send_by as ultima_mensagem_send_by
			from cliente_conversa_whats_mensagem ccm
			where ccm.cliente_conversa_id = ccw.id
			order by ccm.id desc
			limit 1
		) last_message on true
		where ccw.usuario_id is null 
		and ccw.status_id = 0 
		and ccw.data_fim is null
		and c.ativo = true
		and c.empresa_id = $1
		and ccw.empresa_meta_param_id = any($2::int[])
		and (
			(
				coalesce(e.atendimento_lista_atribuida_adm, false) = false
				and coalesce(e.atendimento_fila_automatica_ativa, false) = false
			)
			or ccw.usuario_atribuido_id = $3
		)
		order by ccw.ultima_atualizacao desc`;
  },

  lista_conversas_usuario: () => {
    return `
		WITH conversas AS (
    SELECT
        ccw.id,
        c.nome,
        c.telefone,
        c.utms,
        ccw.cliente_id,
        ccw.usuario_id,
        ccw.empresa_meta_param_id,
        ccw.usuario_atribuido_id,
        ua.nome AS nome_usuario_atribuido,
        u.nome AS nome_atendente,
        ua.cor_atendimento AS cor_usuario_atribuido,
        u.cor_atendimento AS cor_atendente,
        ccw.status_id,
        coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id::varchar, '') as meta_numero_conta,
        coalesce(emp.meta_verified_name, emp.meta_waba_name, '') as meta_nome_conta,
        emp.cor as meta_cor,
        coalesce(
            template_lock.total_templates > 0
            and template_lock.total_mensagens_cliente = 0
            and template_lock.total_mensagens_agente_nao_template = 0,
            false
        ) as aguardando_resposta_template,
        meta_window.ultima_mensagem_cliente_em,
        case
            when meta_window.ultima_mensagem_cliente_em is not null
                then meta_window.ultima_mensagem_cliente_em + interval '24 hours'
            else null
        end as janela_meta_expira_em,
        coalesce(
            meta_window.ultima_mensagem_cliente_em >= current_timestamp - interval '24 hours',
            false
        ) as janela_meta_aberta,
        CASE 
            WHEN ccw.status_id = 0 THEN 'waiting'
            WHEN ccw.status_id = 1 THEN 'active'
            ELSE 'finished'
        END AS status,
        ccw.data_inicio,
        coalesce(ccw.data_inicio, ccw.ultima_atualizacao) as fila_desde,
        coalesce(
            coalesce(ccw.data_inicio, ccw.ultima_atualizacao) <= current_timestamp - interval '24 hours',
            false
        ) as fila_mais_24h,
        ccw.data_fim,
        ccw.ultima_atualizacao,
		(
			select count(1)::int
			from cliente_conversa_whats_mensagem ccm
			where ccm.cliente_conversa_id = ccw.id
			  and ccm.send_by = 1
			  and ccm.id > coalesce((
				select cl.ultima_mensagem_lida_id
				from cliente_conversa_whats_usuario_leitura cl
				where cl.cliente_conversa_id = ccw.id
				  and cl.usuario_id = $1
				limit 1
			  ), 0)
		) as unread_count,
        last_message.ultima_mensagem,
        last_message.ultima_mensagem_send_by,
        ROW_NUMBER() OVER (
            PARTITION BY ccw.cliente_id, coalesce(ccw.empresa_meta_param_id, 0)
            ORDER BY 
                CASE 
                    WHEN ccw.status_id = 1 THEN 1
                    WHEN ccw.status_id = 0 THEN 2
                    ELSE 3
                END,
                coalesce(ccw.data_fim, ccw.ultima_atualizacao) DESC
        ) AS rn
    FROM cliente_conversa_whats ccw
    LEFT JOIN cliente c ON c.id = ccw.cliente_id
    LEFT JOIN usuario u ON u.id = ccw.usuario_id
    LEFT JOIN usuario ua ON ua.id = ccw.usuario_atribuido_id
    LEFT JOIN empresa_meta_parans emp ON emp.id = ccw.empresa_meta_param_id
    left join lateral (
        select
            coalesce(count(*) filter (where ccm.send_by = 1), 0)::int as total_mensagens_cliente,
            coalesce(
                count(*) filter (
                    where ccm.send_by in (2, 3, 4)
                      and not exists (
                        select 1
                        from whatsapp_template_disparo_item item
                        where item.message_id is not null
                          and item.message_id = ccm.mensagem_whats_id
                      )
                ),
                0
            )::int as total_mensagens_agente_nao_template,
            (
                select count(1)::int
                from whatsapp_template_disparo_item item
                where item.conversa_id = ccw.id
                  and item.sucesso = true
            ) as total_templates
        from cliente_conversa_whats_mensagem ccm
        where ccm.cliente_conversa_id = ccw.id
    ) template_lock on true
    left join lateral (
        select max(ccm.data_mensagem) as ultima_mensagem_cliente_em
        from cliente_conversa_whats_mensagem ccm
        where ccm.cliente_conversa_id = ccw.id
          and ccm.send_by = 1
    ) meta_window on true
    left join lateral (
        select
            ccm.mensagem as ultima_mensagem,
            ccm.send_by as ultima_mensagem_send_by
        from cliente_conversa_whats_mensagem ccm
        where ccm.cliente_conversa_id = ccw.id
        order by ccm.id desc
        limit 1
    ) last_message on true
    WHERE ccw.usuario_id = $1
      AND ccw.empresa_id = $2
      AND ccw.empresa_meta_param_id = any($3::int[])
      AND c.ativo = true
),
resultados AS (
    SELECT
        id,
        nome,
        telefone,
        utms,
        cliente_id,
        usuario_id,
        empresa_meta_param_id,
        usuario_atribuido_id,
        nome_usuario_atribuido,
        nome_atendente,
        cor_usuario_atribuido,
        cor_atendente,
        meta_numero_conta,
        meta_nome_conta,
        meta_cor,
        aguardando_resposta_template,
        status,
        data_inicio,
        fila_desde,
        fila_mais_24h,
        data_fim,
        ultima_atualizacao,
        ultima_mensagem_cliente_em,
        janela_meta_expira_em,
        janela_meta_aberta,
        ultima_mensagem,
        ultima_mensagem_send_by,
	unread_count,
        row_number() over (
            partition by status
            order by coalesce(data_fim, ultima_atualizacao) desc
        ) as status_row_num,
        count(*) over (
            partition by status
        ) as status_total
    FROM conversas
    WHERE rn = 1
)
SELECT
    id,
    nome,
    telefone,
    utms,
    cliente_id,
    usuario_id,
    empresa_meta_param_id,
    usuario_atribuido_id,
    nome_usuario_atribuido,
    nome_atendente,
    cor_usuario_atribuido,
    cor_atendente,
    meta_numero_conta,
    meta_nome_conta,
    meta_cor,
    aguardando_resposta_template,
    status,
    data_inicio,
    fila_desde,
    fila_mais_24h,
    ultima_atualizacao,
    ultima_mensagem_cliente_em,
    janela_meta_expira_em,
    janela_meta_aberta,
    ultima_mensagem,
    ultima_mensagem_send_by,
	unread_count,
    status_total
FROM resultados
WHERE status <> 'finished' OR status_row_num <= $4
ORDER BY
    CASE 
        WHEN status = 'active' THEN 1
        WHEN status = 'waiting' THEN 2
        ELSE 3
    END,
    coalesce(data_fim, ultima_atualizacao) DESC;
            `;
  },

  lista_conversas_usuario_busca: () => {
    return models
      .lista_conversas_usuario()
      .replace(/WHERE status <> 'finished' OR status_row_num <= \$4\s*ORDER BY/, "ORDER BY");
  },

  lista_conversas_usuario_ativas: () => {
    return models
      .lista_conversas_usuario()
      .replace(
        /AND c\.ativo = true\s*\n\),/,
        `AND c.ativo = true
      AND ccw.status_id in (0, 1)
      AND ccw.data_fim is null
),
`
      )
      .replace(/WHERE status <> 'finished' OR status_row_num <= \$4/, "WHERE status <> 'finished'");
  },

  lista_conversas_usuario_finalizadas: () => {
    return buildFinalizedConversationListQuery({ scopedToUser: true });
  },

  lista_conversas_empresa: () => {
    return `
		WITH conversas AS (
    SELECT
        ccw.id,
        c.nome,
        c.telefone,
        c.utms,
        ccw.cliente_id,
        ccw.usuario_id,
        ccw.empresa_meta_param_id,
        ccw.usuario_atribuido_id,
        ua.nome AS nome_usuario_atribuido,
        ccw.status_id,
        u.nome AS nome_atendente,
        ua.cor_atendimento AS cor_usuario_atribuido,
        u.cor_atendimento AS cor_atendente,
        coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id::varchar, '') as meta_numero_conta,
        coalesce(emp.meta_verified_name, emp.meta_waba_name, '') as meta_nome_conta,
        emp.cor as meta_cor,
        coalesce(
            template_lock.total_templates > 0
            and template_lock.total_mensagens_cliente = 0
            and template_lock.total_mensagens_agente_nao_template = 0,
            false
        ) as aguardando_resposta_template,
        meta_window.ultima_mensagem_cliente_em,
        case
            when meta_window.ultima_mensagem_cliente_em is not null
                then meta_window.ultima_mensagem_cliente_em + interval '24 hours'
            else null
        end as janela_meta_expira_em,
        coalesce(
            meta_window.ultima_mensagem_cliente_em >= current_timestamp - interval '24 hours',
            false
        ) as janela_meta_aberta,
        CASE 
            WHEN ccw.status_id = 0 THEN 'waiting'
            WHEN ccw.status_id = 1 THEN 'active'
            ELSE 'finished'
        END AS status,
        ccw.data_inicio,
        coalesce(ccw.data_inicio, ccw.ultima_atualizacao) as fila_desde,
        coalesce(
            coalesce(ccw.data_inicio, ccw.ultima_atualizacao) <= current_timestamp - interval '24 hours',
            false
        ) as fila_mais_24h,
        ccw.data_fim,
        ccw.ultima_atualizacao,
		CASE
			WHEN $2::int IS NULL THEN 0
			ELSE (
				select count(1)::int
				from cliente_conversa_whats_mensagem ccm
				where ccm.cliente_conversa_id = ccw.id
				  and ccm.send_by = 1
				  and ccm.id > coalesce((
					select cl.ultima_mensagem_lida_id
					from cliente_conversa_whats_usuario_leitura cl
					where cl.cliente_conversa_id = ccw.id
					  and cl.usuario_id = $2
					limit 1
				  ), 0)
			)
		END as unread_count,
        last_message.ultima_mensagem,
        last_message.ultima_mensagem_send_by,
        ROW_NUMBER() OVER (
            PARTITION BY ccw.cliente_id, coalesce(ccw.empresa_meta_param_id, 0)
            ORDER BY 
                CASE 
                    WHEN ccw.status_id = 1 THEN 1
                    WHEN ccw.status_id = 0 THEN 2
                    ELSE 3
                END,
                coalesce(ccw.data_fim, ccw.ultima_atualizacao) DESC
        ) AS rn
    FROM cliente_conversa_whats ccw
    LEFT JOIN cliente c ON c.id = ccw.cliente_id
    LEFT JOIN usuario u ON u.id = ccw.usuario_id
    LEFT JOIN usuario ua ON ua.id = ccw.usuario_atribuido_id
    LEFT JOIN empresa_meta_parans emp ON emp.id = ccw.empresa_meta_param_id
    left join lateral (
        select
            coalesce(count(*) filter (where ccm.send_by = 1), 0)::int as total_mensagens_cliente,
            coalesce(
                count(*) filter (
                    where ccm.send_by in (2, 3, 4)
                      and not exists (
                        select 1
                        from whatsapp_template_disparo_item item
                        where item.message_id is not null
                          and item.message_id = ccm.mensagem_whats_id
                      )
                ),
                0
            )::int as total_mensagens_agente_nao_template,
            (
                select count(1)::int
                from whatsapp_template_disparo_item item
                where item.conversa_id = ccw.id
                  and item.sucesso = true
            ) as total_templates
        from cliente_conversa_whats_mensagem ccm
        where ccm.cliente_conversa_id = ccw.id
    ) template_lock on true
    left join lateral (
        select max(ccm.data_mensagem) as ultima_mensagem_cliente_em
        from cliente_conversa_whats_mensagem ccm
        where ccm.cliente_conversa_id = ccw.id
          and ccm.send_by = 1
    ) meta_window on true
    left join lateral (
        select
            ccm.mensagem as ultima_mensagem,
            ccm.send_by as ultima_mensagem_send_by
        from cliente_conversa_whats_mensagem ccm
        where ccm.cliente_conversa_id = ccw.id
        order by ccm.id desc
        limit 1
    ) last_message on true
    WHERE c.ativo = true
      AND c.empresa_id = $1
),
resultados AS (
    SELECT
        id,
        nome,
        telefone,
        utms,
        cliente_id,
        usuario_id,
        empresa_meta_param_id,
        usuario_atribuido_id,
        nome_usuario_atribuido,
        nome_atendente,
        cor_usuario_atribuido,
        cor_atendente,
        meta_numero_conta,
        meta_nome_conta,
        meta_cor,
        aguardando_resposta_template,
        status,
        data_inicio,
        fila_desde,
        fila_mais_24h,
        data_fim,
        ultima_atualizacao,
        ultima_mensagem_cliente_em,
        janela_meta_expira_em,
        janela_meta_aberta,
        ultima_mensagem,
        ultima_mensagem_send_by,
	    unread_count,
        row_number() over (
            partition by status
            order by coalesce(data_fim, ultima_atualizacao) desc
        ) as status_row_num,
        count(*) over (
            partition by status
        ) as status_total
    FROM conversas
    WHERE rn = 1
)
SELECT
    id,
    nome,
    telefone,
    utms,
    cliente_id,
    usuario_id,
    empresa_meta_param_id,
    usuario_atribuido_id,
    nome_usuario_atribuido,
    nome_atendente,
    cor_usuario_atribuido,
    cor_atendente,
    meta_numero_conta,
    meta_nome_conta,
    meta_cor,
    aguardando_resposta_template,
    status,
    data_inicio,
    fila_desde,
    fila_mais_24h,
    ultima_atualizacao,
    ultima_mensagem_cliente_em,
    janela_meta_expira_em,
    janela_meta_aberta,
    ultima_mensagem,
    ultima_mensagem_send_by,
	unread_count,
    status_total
FROM resultados
WHERE status <> 'finished' OR status_row_num <= $3
ORDER BY
    CASE 
        WHEN status = 'active' THEN 1
        WHEN status = 'waiting' THEN 2
        ELSE 3
    END,
    coalesce(data_fim, ultima_atualizacao) DESC;
            `;
  },

  lista_conversas_empresa_busca: () => {
    return models
      .lista_conversas_empresa()
      .replace(/WHERE status <> 'finished' OR status_row_num <= \$3\s*ORDER BY/, "ORDER BY");
  },

  lista_conversas_empresa_ativas: () => {
    return models
      .lista_conversas_empresa()
      .replace(
        /WHERE c\.ativo = true\s*\n\s*AND c\.empresa_id = \$1/,
        `WHERE c.ativo = true
      AND c.empresa_id = $1
      AND ccw.status_id in (0, 1)
      AND ccw.data_fim is null`
      )
      .replace(/WHERE status <> 'finished' OR status_row_num <= \$3/, "WHERE status <> 'finished'");
  },

  lista_conversas_empresa_finalizadas: () => {
    return buildFinalizedConversationListQuery({ scopedToUser: false });
  },

  buscar_ultima_mensagem_por_conversas_pesquisa: () => {
    return `
      with matches as (
        select
          ccm.cliente_conversa_id,
          ccm.mensagem,
          ccm.data_mensagem,
          ccm.id,
          row_number() over (
            partition by ccm.cliente_conversa_id
            order by ccm.data_mensagem desc nulls last, ccm.id desc
          ) as rn
        from cliente_conversa_whats_mensagem ccm
        where ccm.cliente_conversa_id = any($1::int[])
          and lower(coalesce(ccm.mensagem, '')) like lower($2)
      )
      select
        cliente_conversa_id,
        mensagem,
        data_mensagem
      from matches
      where rn = 1
      order by data_mensagem desc nulls last, cliente_conversa_id desc
    `;
  },

  get_cliente_info: () => {
    return `
            select
			id as cliente_id,
			nome,
			telefone,
			email,
			cpf,
			origem,
			utms,
			meta_ads_referral,
			meta_ads_utm,
			meta_ads_attributed_at,
			data_aniversario,
			logradouro,
			numero,
			complemento,
			bairro,
			cidade,
			uf,
			cep,
			empresa,
			cargo,
			faturamento
		from cliente
		where id = $1
		limit 1
		`;
  },

  list_cliente_documentos: () => {
    return `
		select
			id,
			empresa_id,
			cliente_id,
			usuario_id,
			nome_arquivo,
			url,
			path_bunny,
			mime_type,
			tamanho_bytes,
			origem,
			data_criacao,
			ativo
		from cliente_documento
		where cliente_id = $1
		  and empresa_id = $2
		  and ativo = true
		order by data_criacao desc, id desc
		`;
  },

  count_cliente_documentos: () => {
    return `
		select count(*)::int as total
		from cliente_documento
		where cliente_id = $1
		  and empresa_id = $2
		  and ativo = true
		`;
  },

  get_cliente_documento_by_id: () => {
    return `
		select
			id,
			empresa_id,
			cliente_id,
			usuario_id,
			nome_arquivo,
			url,
			path_bunny,
			mime_type,
			tamanho_bytes,
			origem,
			data_criacao,
			ativo
		from cliente_documento
		where id = $1
		  and empresa_id = $2
		  and ativo = true
		limit 1
		`;
  },

  insert_cliente_documento: () => {
    return `
		insert into cliente_documento (
			empresa_id,
			cliente_id,
			usuario_id,
			nome_arquivo,
			url,
			path_bunny,
			mime_type,
			tamanho_bytes,
			origem,
			ativo
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
		returning
			id,
			empresa_id,
			cliente_id,
			usuario_id,
			nome_arquivo,
			url,
			path_bunny,
			mime_type,
			tamanho_bytes,
			origem,
			data_criacao,
			ativo
		`;
  },

  soft_delete_cliente_documento: () => {
    return `
		update cliente_documento
		set ativo = false
		where id = $1
		  and empresa_id = $2
		returning id, path_bunny
		`;
  },

  get_dados_conversa: () => {
    return `
      select
        ccw.cliente_id,
        ccw.usuario_id,
        ccw.usuario_atribuido_id,
        ccw.empresa_id,
        ccw.status_id,
        ccw.empresa_meta_param_id,
        u.nome as atendente,
        ua.nome as nome_usuario_atribuido,
        coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id::varchar, '') as meta_numero_conta,
        coalesce(emp.meta_verified_name, emp.meta_waba_name, '') as meta_nome_conta,
        coalesce(
          template_lock.total_templates > 0
          and template_lock.total_mensagens_cliente = 0
          and template_lock.total_mensagens_agente_nao_template = 0,
          false
        ) as aguardando_resposta_template
      from cliente_conversa_whats ccw
      left join usuario u on u.id = ccw.usuario_id
      left join usuario ua on ua.id = ccw.usuario_atribuido_id
      left join empresa_meta_parans emp on emp.id = ccw.empresa_meta_param_id
      left join lateral (
        select
          coalesce(count(*) filter (where ccm.send_by = 1), 0)::int as total_mensagens_cliente,
          coalesce(
            count(*) filter (
              where ccm.send_by in (2, 3, 4)
                and not exists (
                  select 1
                  from whatsapp_template_disparo_item item
                  where item.message_id is not null
                    and item.message_id = ccm.mensagem_whats_id
                )
            ),
            0
          )::int as total_mensagens_agente_nao_template,
          (
            select count(1)::int
            from whatsapp_template_disparo_item item
            where item.conversa_id = ccw.id
              and item.sucesso = true
          ) as total_templates
        from cliente_conversa_whats_mensagem ccm
        where ccm.cliente_conversa_id = ccw.id
      ) template_lock on true
      where ccw.id = $1
    `;
  },

  get_conversa_janela_meta_envio: () => {
    return `
		select
                        ccw.id as conversa_id,
                        ccw.status_id,
                        coalesce(
                                template_lock.total_templates > 0
                                and template_lock.total_mensagens_cliente = 0
                                and template_lock.total_mensagens_agente_nao_template = 0,
                                false
                        ) as aguardando_resposta_template,
                        meta_window.ultima_mensagem_cliente_em,
                        case
                                when meta_window.ultima_mensagem_cliente_em is not null
					then meta_window.ultima_mensagem_cliente_em + interval '24 hours'
				else null
			end as janela_meta_expira_em,
			coalesce(
				meta_window.ultima_mensagem_cliente_em >= current_timestamp - interval '24 hours',
				false
			) as janela_meta_aberta
                from cliente_conversa_whats ccw
                left join lateral (
                        select
                                coalesce(count(*) filter (where ccm.send_by = 1), 0)::int as total_mensagens_cliente,
                                coalesce(
                                        count(*) filter (
                                                where ccm.send_by in (2, 3, 4)
                                                  and not exists (
                                                        select 1
                                                        from whatsapp_template_disparo_item item
                                                        where item.message_id is not null
                                                          and item.message_id = ccm.mensagem_whats_id
                                                  )
                                        ),
                                        0
                                )::int as total_mensagens_agente_nao_template,
                                (
                                        select count(1)::int
                                        from whatsapp_template_disparo_item item
                                        where item.conversa_id = ccw.id
                                          and item.sucesso = true
                                ) as total_templates
                        from cliente_conversa_whats_mensagem ccm
                        where ccm.cliente_conversa_id = ccw.id
                ) template_lock on true
                left join lateral (
                        select max(ccm.data_mensagem) as ultima_mensagem_cliente_em
                        from cliente_conversa_whats_mensagem ccm
			where ccm.cliente_conversa_id = ccw.id
			  and ccm.send_by = 1
		) meta_window on true
		where ccw.id = $1
		limit 1
		`;
  },

  marcar_conversa_lida_usuario: () => {
    return `
		INSERT INTO cliente_conversa_whats_usuario_leitura (
			cliente_conversa_id,
			usuario_id,
			ultima_mensagem_lida_id,
			ultima_leitura_em
		)
		SELECT
			$1,
			$2,
			(
				SELECT max(m.id)
				FROM cliente_conversa_whats_mensagem m
				WHERE m.cliente_conversa_id = $1
				  AND m.send_by = 1
			),
			current_timestamp
		ON CONFLICT (cliente_conversa_id, usuario_id)
		DO UPDATE SET
			ultima_mensagem_lida_id = GREATEST(
				coalesce(cliente_conversa_whats_usuario_leitura.ultima_mensagem_lida_id, 0),
				coalesce(EXCLUDED.ultima_mensagem_lida_id, 0)
			),
			ultima_leitura_em = current_timestamp
		RETURNING cliente_conversa_id, usuario_id, ultima_mensagem_lida_id, ultima_leitura_em
	`;
  },

  lista_mensagens_conversa: () => {
    return `
        with ref as (
                select
                        ccw.id,
                        ccw.cliente_id,
                        ccw.empresa_id,
                        ccw.empresa_meta_param_id,
                        ccw.number_phone_id
                from cliente_conversa_whats ccw
                where ccw.id = $1
                limit 1
        ),
	conversas_cliente as (
		select
			ccw.id as conversa_id,
			ccw.usuario_id,
			ccw.status_id,
			ccw.data_inicio,
			ccw.data_fim,
			ccw.ultima_atualizacao,
			u.nome as atendente_nome
		from cliente_conversa_whats ccw
		left join usuario u on u.id = ccw.usuario_id
		inner join ref r
			on r.cliente_id = ccw.cliente_id
			and r.empresa_id = ccw.empresa_id
			and (
				(
					r.empresa_meta_param_id is not null
					and ccw.empresa_meta_param_id = r.empresa_meta_param_id
				)
				or (
					r.empresa_meta_param_id is null
					and ccw.empresa_meta_param_id is null
					and ccw.number_phone_id is not distinct from r.number_phone_id
				)
			)
		where
			coalesce($7::boolean, false) = true
			or ccw.id = r.id
			or (
				$8::int is not null
				and ccw.usuario_id = $8::int
			)
	),
		msgs as (
				select
						m.id::bigint as sort_id,
						m.id,
                    case
                            when coalesce(nullif(btrim(m.media_tipe), ''), case when m.mensagem like '[Meta Ads] Lead originado por anuncio%' then 'meta_referral' else null end) = 'meta_referral' then 'Meta Ads'
                            when m.send_by = 3 then 'n8n IA'
                            when m.send_by = 4 then 'WhatsApp celular'
                            else coalesce(mu.nome, cc.atendente_nome)
                    end as user_bubble,
			m.usuario_id as "messageUserId",
			mu.foto_perfil_url as "messageUserPhotoUrl",
			case
				when coalesce(nullif(btrim(m.media_tipe), ''), case when m.mensagem like '[Meta Ads] Lead originado por anuncio%' then 'meta_referral' else null end) = 'meta_referral' then 'media'
				when m.tipo_id = 0 then 'text'
				when m.tipo_id = 1 then 'media'
				else 'chat'
			end as type,
                    case
                            when coalesce(nullif(btrim(m.media_tipe), ''), case when m.mensagem like '[Meta Ads] Lead originado por anuncio%' then 'meta_referral' else null end) = 'meta_referral' then 'other'
                            when m.send_by = 1 then 'me'
                            when m.send_by in (2, 3, 4) then 'other'
                            else 'system'
                    end as sender,
			coalesce(m.data_mensagem, cc.ultima_atualizacao, cc.data_inicio, current_timestamp) as timestamp,
			'Arquivo ' || to_char(m.data_mensagem, 'DD/MM/YYYY HH24:MI:SS') as "fileName",
                                                case
                                                        when coalesce(m.apagada, false) = true then 'Mensagem apagada'
                                                        else m.mensagem
                                                end as mensagem,
                                                m.midia_id,
                                                coalesce(nullif(btrim(m.media_tipe), ''), case when m.mensagem like '[Meta Ads] Lead originado por anuncio%' then 'meta_referral' else null end) as "mediaType",
						m.status as "messageStatusId",
						case
								when m.status = 0 then 'pending'
								when m.status = 1 then 'sent'
								when m.status = 2 then 'delivered'
								when m.status = 3 then 'read'
								when m.status = 4 then 'failed'
								else null
						end as "messageStatus",
						case
								when m.status = 0 then 'Enviando'
								when m.status = 1 then 'Enviado'
								when m.status = 2 then 'Recebido'
								when m.status = 3 then 'Visto'
								when m.status = 4 then 'Falhou'
								else null
                                                end as "messageStatusLabel",
                                                coalesce(m.apagada, false) as deleted,
                                                coalesce(m.apagada, false) as apagada,
                                                m.apagada_em as "deletedAt",
                                                coalesce(m.editado, false) as edited,
                                                m.editado_em as "editedAt",
						m.reply,
						m.mensagem_reply_id,
						rm.mensagem as "replyText",
						rm.media_tipe as "replyMediaType",
						template_item.template_data as "templateData"
		from cliente_conversa_whats_mensagem m
		inner join conversas_cliente cc on cc.conversa_id = m.cliente_conversa_id
		left join usuario mu on mu.id = m.usuario_id
		left join cliente_conversa_whats_mensagem rm on rm.id = m.mensagem_reply_id
		left join lateral (
			select item.metadata -> 'chat_template' as template_data
			from whatsapp_template_disparo_item item
			where
				item.empresa_id = (select empresa_id from ref limit 1)
				and item.message_id is not null
				and item.message_id = m.mensagem_whats_id
			order by item.id desc
			limit 1
		) template_item on true
	),
	template_msgs as (
		select
			(1000000000000::bigint + item.id::bigint) as sort_id,
			(1000000000000::bigint + item.id::bigint) as id,
			null::varchar as user_bubble,
			null::integer as "messageUserId",
			null::text as "messageUserPhotoUrl",
			'text' as type,
			'other' as sender,
			item.data_criacao as timestamp,
			null::varchar as "fileName",
			coalesce(
				nullif(btrim(coalesce(item.metadata ->> 'chat_preview_text', '')), ''),
				'Template enviado: ' || coalesce(item.template_name, 'sem_nome')
			) as mensagem,
			null::varchar as midia_id,
			null::varchar as "mediaType",
			case
				when lower(coalesce(item.message_status, '')) = 'read' then 3
				when lower(coalesce(item.message_status, '')) = 'delivered' then 2
				when lower(coalesce(item.message_status, '')) in ('accepted', 'sent') then 1
				when lower(coalesce(item.message_status, '')) = 'failed' then 4
				when item.sucesso = true then 1
				else null
			end as "messageStatusId",
			case
				when lower(coalesce(item.message_status, '')) = 'read' then 'read'
				when lower(coalesce(item.message_status, '')) = 'delivered' then 'delivered'
				when lower(coalesce(item.message_status, '')) in ('accepted', 'sent') then 'sent'
				when lower(coalesce(item.message_status, '')) = 'failed' then 'failed'
				when item.sucesso = true then 'sent'
				else null
			end as "messageStatus",
			case
				when lower(coalesce(item.message_status, '')) = 'read' then 'Visto'
				when lower(coalesce(item.message_status, '')) = 'delivered' then 'Recebido'
				when lower(coalesce(item.message_status, '')) in ('accepted', 'sent') then 'Enviado'
				when lower(coalesce(item.message_status, '')) = 'failed' then 'Falhou'
				when item.sucesso = true then 'Enviado'
				else null
                        end as "messageStatusLabel",
                        false as deleted,
                        false as apagada,
                        null::timestamp without time zone as "deletedAt",
                        false as edited,
                        null::timestamp without time zone as "editedAt",
			false as reply,
			null::integer as mensagem_reply_id,
			null::text as "replyText",
			null::varchar as "replyMediaType",
			item.metadata -> 'chat_template' as "templateData"
		from whatsapp_template_disparo_item item
		inner join ref r on r.empresa_id = item.empresa_id
		where
			item.sucesso = true
			and item.conversa_id in (select conversa_id from conversas_cliente)
			and not exists (
				select 1
				from cliente_conversa_whats_mensagem m
				where
					m.mensagem_whats_id = item.message_id
					and m.cliente_conversa_id in (select conversa_id from conversas_cliente)
			)
	),
	eventos as (
		select
			-(cc.conversa_id::bigint * 1000 + 1) as sort_id,
			-(cc.conversa_id::bigint * 1000 + 1) as id,
			cc.atendente_nome as user_bubble,
			null::integer as "messageUserId",
			null::text as "messageUserPhotoUrl",
			'event' as type,
			'system' as sender,
			cc.data_inicio as timestamp,
			null::varchar as "fileName",
			'Atendimento iniciado em ' || to_char(cc.data_inicio, 'DD/MM/YYYY HH24:MI') ||
			case
				when cc.atendente_nome is not null and btrim(cc.atendente_nome) <> '' then ' por ' || cc.atendente_nome
				else ''
						end as mensagem,
						null::varchar as midia_id,
						null::varchar as "mediaType",
						null::integer as "messageStatusId",
                                                null::varchar as "messageStatus",
                                                null::varchar as "messageStatusLabel",
                                                false as deleted,
                                                false as apagada,
                                                null::timestamp without time zone as "deletedAt",
                                                false as edited,
                                                null::timestamp without time zone as "editedAt",
						false as reply,
						null::integer as mensagem_reply_id,
						null::text as "replyText",
						null::varchar as "replyMediaType",
						null::jsonb as "templateData"
		from conversas_cliente cc
		where cc.data_inicio is not null

		union all

		select
			-(cc.conversa_id::bigint * 1000 + 2) as sort_id,
			-(cc.conversa_id::bigint * 1000 + 2) as id,
			cc.atendente_nome as user_bubble,
			null::integer as "messageUserId",
			null::text as "messageUserPhotoUrl",
			'event' as type,
			'system' as sender,
			cc.data_fim as timestamp,
			null::varchar as "fileName",
			'Atendimento finalizado em ' || to_char(cc.data_fim, 'DD/MM/YYYY HH24:MI') ||
			case
				when cc.atendente_nome is not null and btrim(cc.atendente_nome) <> '' then ' por ' || cc.atendente_nome
				else ''
						end as mensagem,
						null::varchar as midia_id,
						null::varchar as "mediaType",
						null::integer as "messageStatusId",
                                                null::varchar as "messageStatus",
                                                null::varchar as "messageStatusLabel",
                                                false as deleted,
                                                false as apagada,
                                                null::timestamp without time zone as "deletedAt",
                                                false as edited,
                                                null::timestamp without time zone as "editedAt",
						false as reply,
						null::integer as mensagem_reply_id,
						null::text as "replyText",
						null::varchar as "replyMediaType",
						null::jsonb as "templateData"
		from conversas_cliente cc
		where cc.data_fim is not null
	),
	timeline as (
		select * from msgs
		union all
		select * from template_msgs
		union all
		select * from eventos
	),
	filtered as (
		select *
		from timeline t
		where
			(
				$2::timestamptz is null
				or t.timestamp > $2::timestamptz
				or (
					t.timestamp = $2::timestamptz
					and t.sort_id > coalesce($3::bigint, -9223372036854775808::bigint)
				)
			)
			and (
				$4::timestamptz is null
				or t.timestamp < $4::timestamptz
				or (
					t.timestamp = $4::timestamptz
					and t.sort_id < coalesce($5::bigint, 9223372036854775807::bigint)
				)
			)
		order by t.timestamp desc nulls last, t.sort_id desc
		limit greatest(coalesce($6::int, 100), 1)
	)
	select
		t.id,
		t.user_bubble,
		t."messageUserId",
		t."messageUserPhotoUrl",
		t.type,
		t.sender,
		t.timestamp,
		t."fileName",
		t.mensagem,
                t.midia_id,
                t."mediaType",
                t."messageStatusId",
                t."messageStatus",
                t."messageStatusLabel",
                t.deleted,
                t.apagada,
                t."deletedAt",
                t.edited,
                t."editedAt",
                t.reply,
                t.mensagem_reply_id,
                t."replyText",
		t."replyMediaType",
		t."templateData",
		t.sort_id
	from filtered t
	order by t.timestamp nulls last, t.sort_id
                `;
  },

  get_conversa_n8n_ia_nome: () => {
    return `
      select
        coalesce(
          nullif(btrim(to_jsonb(e)->>'cliente_n8n_ia_nome'), ''),
          'n8n IA'
        ) as n8n_ia_nome
      from cliente_conversa_whats ccw
      inner join empresa e on e.id = ccw.empresa_id
      where ccw.id = $1
      limit 1
    `;
  },

  send_mensagem: () => {
    return `
                INSERT INTO public.cliente_conversa_whats_mensagem(
	cliente_conversa_id, mensagem, tipo_id, data_mensagem, status, reply, mensagem_reply_id, mensagem_whats_id, send_by)
	VALUES ($1, $2, 1, current_timestamp, 1, false, null, $3, 2);
		`;
  },

  get_mensagem_rapida: () => {
        return `
		select
			mr.id,
			mr.comando as nome,
			mr.descricao as descricao,
			mr.texto,
			coalesce(mr.usar_texto_como_legenda, false) as use_text_as_image_caption,
			coalesce(mr.ordem_midias, '["image", "document", "audio"]'::jsonb) as media_order,
			mr.usuario_id,
			gi.id as gallery_image_id,
			gi.url as image_url,
			gi.nome_arquivo as image_name,
			gi.mime_type as image_mime_type,
			gd.id as gallery_document_id,
			gd.url as document_url,
			gd.nome_arquivo as document_name,
			gd.mime_type as document_mime_type,
			ga.id as gallery_audio_id,
			ga.url as audio_url,
			ga.nome_arquivo as audio_name,
			ga.mime_type as audio_mime_type
		from mensagens_rapidas mr
		left join empresa_galeria_imagem gi
		  on gi.id = mr.galeria_imagem_id
		 and gi.ativo = true
		left join empresa_galeria_documento gd
		  on gd.id = mr.galeria_documento_id
		 and gd.ativo = true
		left join empresa_galeria_audio ga
		  on ga.id = mr.galeria_audio_id
		 and ga.ativo = true
		where mr.comando ilike $1
		and mr.empresa_id = $2
		and (mr.usuario_id is null or mr.usuario_id = $3)
		and mr.ativo = true
		order by mr.comando asc
    		`;
  },

  get_mensagem_rapida_legacy: () => {
    return `
		select
			mr.id,
			mr.comando as nome,
			mr.descricao as descricao,
			mr.texto,
			false as use_text_as_image_caption,
			'["image", "document", "audio"]'::jsonb as media_order,
			null::bigint as usuario_id,
			null::integer as gallery_image_id,
			null::text as image_url,
			null::character varying as image_name,
			null::character varying as image_mime_type,
			null::integer as gallery_document_id,
			null::text as document_url,
			null::character varying as document_name,
			null::character varying as document_mime_type,
			null::integer as gallery_audio_id,
			null::text as audio_url,
			null::character varying as audio_name,
			null::character varying as audio_mime_type
		from mensagens_rapidas mr
		where mr.comando ilike $1
		and mr.empresa_id = $2
		and mr.ativo = true
		order by mr.comando asc
    		`;
  },

	get_paramentros_whats: () => {
    return `
		select
			emp.meta_phone_number_id as numero,
			p.api_key as api_key,
			coalesce(emp.whatsapp_account_id, p.whatsapp_account_id) as whatsapp_account_id,
			coalesce(e.nome_fantasia, e.razao_social, 'nossa empresa') as empresa_nome
		from empresa e
		left join empresa_meta_parans emp
		  on emp.empresa_id = e.id
		 and coalesce(emp.ativo, true) = true
		left join lateral (
			select p_inner.api_key, p_inner.whatsapp_account_id
			from parametros p_inner
			where p_inner.empresa_id = e.id
			order by p_inner.id desc
			limit 1
		) p on true
		where e.id = $1
		order by emp.meta_last_embedded_signup_at desc nulls last, emp.id desc
		limit 1
		`;
  },

  get_usuario_atendimento_contexto: () => {
    return `
      select
        u.id,
        u.nome,
        u.empresa_id,
        coalesce(u.is_master, false) as is_master,
        coalesce(u.permissoes_customizadas, '[]'::jsonb) as permissoes_customizadas,
        coalesce(pl.permissoes, '[]'::jsonb) as permissoes_plano
      from usuario u
      left join lateral (
        select ea.assinatura_id
        from empresa_assinatura ea
        where ea.empresa_id = u.empresa_id
          and ea.ativo = true
          and ea.validade >= current_date
        order by ea.id desc
        limit 1
      ) ea on true
      left join assinatura pl on pl.id = ea.assinatura_id
      where u.id = $1
        and u.empresa_id = $2
        and u.ativo = true
      limit 1
    `;
  },

  list_usuario_meta_numero_ids: () => {
    return `
      select
        umn.empresa_meta_param_id
      from usuario_meta_numero umn
      inner join empresa_meta_parans emp
        on emp.id = umn.empresa_meta_param_id
      where umn.usuario_id = $1
        and emp.empresa_id = $2
        and coalesce(emp.ativo, true) = true
      order by umn.empresa_meta_param_id asc
    `;
  },

  get_conversa_contexto_acesso: () => {
    return `
      select
        ccw.id,
        ccw.empresa_id,
        ccw.cliente_id,
        ccw.usuario_id,
        ccw.usuario_atribuido_id,
        ccw.status_id,
        ccw.empresa_meta_param_id,
        ccw.data_inicio,
        coalesce(ccw.data_inicio, ccw.ultima_atualizacao) as fila_desde,
        coalesce(
          coalesce(ccw.data_inicio, ccw.ultima_atualizacao) <= current_timestamp - interval '24 hours',
          false
        ) as fila_mais_24h,
        ccw.data_fim,
        (
          coalesce(e.atendimento_lista_atribuida_adm, false)
          or coalesce(e.atendimento_fila_automatica_ativa, false)
        ) as atendimento_lista_atribuida_adm
      from cliente_conversa_whats ccw
      left join empresa e on e.id = ccw.empresa_id
      where ccw.id = $1
      limit 1
    `;
  },

  get_empresa_atendimento_config: () => {
    return `
      select
        e.id as empresa_id,
        coalesce(e.atendimento_lista_atribuida_adm, false) as atendimento_lista_atribuida_adm,
        coalesce(e.atendimento_mensagens_rapidas_ativas, true) as atendimento_mensagens_rapidas_ativas,
        coalesce(e.atendimento_disparo_nps_ativo, true) as atendimento_disparo_nps_ativo,
        coalesce(e.atendimento_fila_automatica_ativa, false) as atendimento_fila_automatica_ativa,
        coalesce(
          (
            select json_agg(afu.usuario_id order by afu.ordem asc, afu.id asc)
            from atendimento_fila_usuario afu
            inner join usuario u
              on u.id = afu.usuario_id
             and u.empresa_id = e.id
             and u.ativo = true
            where afu.empresa_id = e.id
          ),
          '[]'::json
        ) as atendimento_fila_usuarios
      from empresa e
      where e.id = $1
      limit 1
    `;
  },

  update_empresa_atendimento_config: () => {
    return `
      update empresa
      set
        atendimento_lista_atribuida_adm = $2,
        atendimento_mensagens_rapidas_ativas = $3,
        atendimento_disparo_nps_ativo = $4,
        atendimento_fila_automatica_ativa = $5
      where id = $1
      returning
        id as empresa_id,
        coalesce(atendimento_lista_atribuida_adm, false) as atendimento_lista_atribuida_adm,
        coalesce(atendimento_mensagens_rapidas_ativas, true) as atendimento_mensagens_rapidas_ativas,
        coalesce(atendimento_disparo_nps_ativo, true) as atendimento_disparo_nps_ativo,
        coalesce(atendimento_fila_automatica_ativa, false) as atendimento_fila_automatica_ativa
    `;
  },

  delete_empresa_atendimento_fila_usuarios: () => {
    return `
      delete from atendimento_fila_usuario
      where empresa_id = $1
    `;
  },

  insert_empresa_atendimento_fila_usuario: () => {
    return `
      insert into atendimento_fila_usuario (
        empresa_id,
        usuario_id,
        ordem
      )
      values ($1, $2, $3)
      returning id, empresa_id, usuario_id, ordem
    `;
  },

  lock_empresa_atendimento_queue_config: () => {
    return `
      select
        e.id as empresa_id,
        coalesce(e.atendimento_lista_atribuida_adm, false) as atendimento_lista_atribuida_adm,
        coalesce(e.atendimento_fila_automatica_ativa, false) as atendimento_fila_automatica_ativa,
        e.atendimento_fila_ultimo_usuario_id
      from empresa e
      where e.id = $1
      limit 1
      for update
    `;
  },

  list_empresa_atendimento_fila_usuarios_elegiveis: () => {
    return `
      select
        afu.usuario_id,
        afu.ordem,
        coalesce(u.is_master, false) as is_master
      from atendimento_fila_usuario afu
      inner join usuario u
        on u.id = afu.usuario_id
       and u.empresa_id = $1
       and u.ativo = true
      left join usuario_meta_numero umn
        on umn.usuario_id = u.id
       and umn.empresa_meta_param_id = $2
      where afu.empresa_id = $1
        and (
          coalesce(u.is_master, false) = true
          or umn.usuario_id is not null
        )
      order by afu.ordem asc, afu.id asc
    `;
  },

  get_last_fila_usuario_elegivel_por_numero: () => {
    return `
      select
        coalesce(ccw.usuario_atribuido_id, ccw.usuario_id) as usuario_id
      from cliente_conversa_whats ccw
      where ccw.empresa_id = $1
        and ccw.empresa_meta_param_id = $2
        and coalesce(ccw.usuario_atribuido_id, ccw.usuario_id) = any($3::int[])
      order by
        coalesce(ccw.ultima_atualizacao, ccw.data_inicio, ccw.data_fim) desc nulls last,
        ccw.id desc
      limit 1
    `;
  },

  update_empresa_atendimento_fila_ultimo_usuario: () => {
    return `
      update empresa
      set atendimento_fila_ultimo_usuario_id = $2
      where id = $1
      returning id, atendimento_fila_ultimo_usuario_id
    `;
  },

  update_conversa_usuario_atribuido: () => {
    return `
      update cliente_conversa_whats
      set
        usuario_atribuido_id = $2,
        ultima_atualizacao = current_timestamp
      where id = $1
        and empresa_id = $3
        and status_id = 0
        and usuario_id is null
        and data_fim is null
      returning id, usuario_atribuido_id
    `;
  },

  transferir_atendimento_usuario: () => {
    return `
      update cliente_conversa_whats
      set
        usuario_id = $2,
        usuario_atribuido_id = null,
        ultima_atualizacao = current_timestamp
      where id = $1
        and empresa_id = $3
        and status_id = 1
        and data_fim is null
      returning id, usuario_id
    `;
  },

  get_cliente: () => {
    return `
		select
cliente_id as id
from cliente_conversa_whats
where id = $1
		`;
  },

  detalhes_cliente: () => {
    return `
		select 
t.id,
t.nome as name
from cliente_tag ct
left join tag t on 
t.id = ct.tag_id
where ct.cliente_id = $1
		`;
  },

  get_notas: () => {
    return `
		select 
			ca.texto as content,
			u.nome as author,
			 to_char(ca.data_criacao, 'DD/MM/YYYY HH24:MI') as "createdAt",
			ca.usuario_id as user_id
		from cliente_anotacao ca 
		left join usuario u on
			u.id = ca.usuario_id
		where ca.cliente_id = $1
		`;
  },

  get_cliente_crm_atendimento: () => {
    return `
		select
			n.id as negocio_id,
			n.crm_id,
			crm.nome as crm_nome,
			n.etapa_id,
			e.codigo as etapa_codigo,
			e.nome as etapa_nome,
			coalesce(e.eh_fechamento, false) as etapa_fechamento,
			n.titulo,
			n.valor_estimado,
			n.valor_fechamento,
			n.data_criacao,
			n.data_entrada_pipeline,
			n.data_fechamento_real,
			produtos.produto_principal,
			produtos.produtos,
			u.id as responsavel_id,
			u.nome as responsavel_nome
		from comercial_negocio n
		inner join comercial_crm crm on crm.id = n.crm_id
		inner join comercial_etapa e on e.id = n.etapa_id
		left join lateral (
			select
				(
					array_agg(coi.nome_produto order by coi.id)
				)[1] as produto_principal,
				coalesce(
					json_agg(
						json_build_object(
							'id', coi.id,
							'produto_id', coi.comercial_produto_id,
							'nome', coi.nome_produto,
							'quantidade', coi.quantidade,
							'preco_unitario', coi.preco_unitario,
							'status', coi.status,
							'quantidade_ganha', coi.quantidade_ganha,
							'quantidade_perdida', coi.quantidade_perdida
						)
						order by coi.id
					),
					'[]'::json
				) as produtos
			from comercial_orcamento co
			inner join comercial_orcamento_item coi
				on coi.orcamento_id = co.id
			   and coi.ativo = true
			where co.negocio_id = n.id
			  and co.empresa_id = n.empresa_id
			  and co.ativo = true
			  and co.principal = true
		) produtos on true
		left join usuario u on u.id = n.responsavel_usuario_id
		where n.cliente_id = $1
		  and n.empresa_id = $2
		  and n.ativo = true
		order by
			case when coalesce(e.eh_fechamento, false) = false then 0 else 1 end,
			coalesce(n.data_entrada_pipeline, n.data_criacao) desc,
			n.id desc
		limit 1
		`;
  },

  list_cliente_crm_interacoes: () => {
    return `
		select
			ci.id,
			ti.codigo as tipo_codigo,
			ti.nome as tipo_nome,
			ci.descricao,
			ci.data_inicio,
			ci.data_fim,
			ci.em_andamento,
			ci.valor,
			u.nome as atendente_nome
		from comercial_interacao ci
		left join comercial_tipo_interacao ti on ti.id = ci.tipo_interacao_id
		left join usuario u on u.id = ci.usuario_id
		where ci.empresa_id = $1
		  and ci.cliente_id = $2
		order by ci.data_inicio desc, ci.id desc
		limit 30
		`;
  },

  list_cliente_crm_historico: () => {
    return `
		select
			h.id,
			h.tipo,
			h.titulo,
			h.descricao,
			h.criado_em,
			h.dados,
			coalesce(u.nome, 'Sistema') as atendente_nome
		from comercial_historico_cliente h
		left join usuario u on u.id = h.usuario_id
		where h.empresa_id = $1
		  and h.cliente_id = $2
		order by h.criado_em desc, h.id desc
		limit 50
		`;
  },

	list_cliente_atendimentos_whatsapp: () => {
    return `
		select
			ccw.id as conversa_id,
			ccw.status_id,
			ccw.data_inicio,
			ccw.data_fim,
			ccw.ultima_atualizacao,
			u.nome as atendente_nome,
			coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id::varchar, '') as meta_numero_conta
		from cliente_conversa_whats ccw
		left join usuario u on u.id = ccw.usuario_id
		left join empresa_meta_parans emp on emp.id = ccw.empresa_meta_param_id
		where ccw.empresa_id = $1
		  and ccw.cliente_id = $2
		order by coalesce(ccw.data_inicio, ccw.ultima_atualizacao) desc, ccw.id desc
		limit 30
		`;
  },

  insert_mensagem_enviada: () => {
    return `
		INSERT INTO public.cliente_conversa_whats_mensagem(
	cliente_conversa_id, mensagem, tipo_id, data_mensagem, status, reply, mensagem_reply_id, mensagem_whats_id, send_by, usuario_id)
	VALUES ( $1, $2, 0, current_timestamp, 0, $5, $6, $3, 2, $4)
	returning id;
		`;
  },

  insert_mensagem_enviada_media: () => {
    return `
		INSERT INTO public.cliente_conversa_whats_mensagem(
	cliente_conversa_id, mensagem, tipo_id, data_mensagem, status, reply, mensagem_whats_id, send_by, midia_id, media_tipe, usuario_id)
	VALUES ($1, $2, 1, current_timestamp, 0, false, $3, 2, $4, $5, $6)
	returning id;
		 `;
  },

  get_number: () => {
    return `
		select number_phone_id from cliente_conversa_whats where id = $1
		`;
  },

  get_mensagem_conversa_by_id: () => {
    return `
		select
			id,
			cliente_conversa_id,
			mensagem,
			tipo_id,
			midia_id,
			media_tipe,
			mensagem_whats_id
		from cliente_conversa_whats_mensagem
		where cliente_conversa_id = $1
		  and id = $2
		limit 1
		`;
  },

  get_mensagem_automatica_whatsapp: () => {
    return `
		with toggle_config as (
			select
				case $2::integer
					when 1 then coalesce(empm.whatsapp_auto_message_boas_vindas_ativa, true)
					when 2 then coalesce(empm.whatsapp_auto_message_final_atendimento_ativa, true)
					when 3 then coalesce(empm.whatsapp_auto_message_nps_ativa, true)
					when 4 then coalesce(empm.whatsapp_auto_message_aniversario_ativa, true)
					when 5 then coalesce(empm.whatsapp_auto_message_inicio_atendimento_ativa, true)
					else true
				end as habilitada
			from empresa_meta_parans empm
			where empm.id = $3
			  and empm.empresa_id = $1
			  and coalesce(empm.ativo, true) = true
			limit 1
		),
		scoped as (
			select
				id,
				texto,
				ativo,
				empresa_id,
				empresa_meta_param_id,
				whatsapp_auto_message_tipo_id as tipo_id
			from whatsapp_auto_message
			where empresa_id = $1
			  and whatsapp_auto_message_tipo_id = $2
			  and (
			  	($3::bigint is not null and empresa_meta_param_id = $3::bigint)
			  	or ($3::bigint is null and empresa_meta_param_id is null)
			  )
			order by id desc
			limit 1
		),
		fallback as (
			select
				id,
				texto,
				ativo,
				empresa_id,
				empresa_meta_param_id,
				whatsapp_auto_message_tipo_id as tipo_id
			from whatsapp_auto_message
			where $3::bigint is not null
			  and empresa_id = $1
			  and whatsapp_auto_message_tipo_id = $2
			  and empresa_meta_param_id is null
			order by id desc
			limit 1
		),
		candidate as (
			select * from scoped
			union all
			select * from fallback
			where not exists (select 1 from scoped)
		)
		select
			candidate.id,
			candidate.texto,
			candidate.ativo,
			candidate.empresa_id,
			candidate.empresa_meta_param_id,
			candidate.tipo_id,
			cfg.habilitada
		from (
			select coalesce((select habilitada from toggle_config), true) as habilitada
		) cfg
		left join candidate
			on cfg.habilitada = true
		   and candidate.ativo = true
		limit 1
		`;
  },

  executefinalizar_atendimento: () => {
    return `update cliente_conversa_whats set status_id = 2, data_fim = current_timestamp, usuario_atribuido_id = null where id = $1`;
  },

  finalize_waiting_atendimentos_older_than_hours_by_empresa: () => {
    return `
      update cliente_conversa_whats
      set
        status_id = 2,
        data_fim = current_timestamp,
        usuario_atribuido_id = null
      where empresa_id = $1
        and usuario_id is null
        and status_id = 0
        and data_fim is null
        and coalesce(data_inicio, ultima_atualizacao) <= current_timestamp - make_interval(hours => $2::int)
      returning id
    `;
  },

  finalize_stale_atendimentos_by_last_customer_message: () => {
    return `
      with stale_conversations as (
        select
          ccw.id,
          ccw.empresa_id,
          ccw.status_id,
          ccw.data_inicio,
          ccw.ultima_atualizacao,
          max(ccm.data_mensagem) as ultima_mensagem_chat_em,
          max(case when ccm.send_by = 1 then ccm.data_mensagem end) as ultima_mensagem_cliente_em
        from cliente_conversa_whats ccw
        left join cliente_conversa_whats_mensagem ccm
          on ccm.cliente_conversa_id = ccw.id
        where ccw.status_id in (0, 1)
          and ccw.data_fim is null
        group by
          ccw.id,
          ccw.empresa_id,
          ccw.status_id,
          ccw.data_inicio,
          ccw.ultima_atualizacao
        having coalesce(
          max(case when ccm.send_by = 1 then ccm.data_mensagem end),
          max(ccm.data_mensagem),
          ccw.data_inicio,
          ccw.ultima_atualizacao
        ) <= current_timestamp - make_interval(hours => $1::int)
      )
      update cliente_conversa_whats ccw
      set
        status_id = 2,
        data_fim = current_timestamp
      from stale_conversations stale
      where ccw.id = stale.id
      returning
        ccw.id,
        stale.empresa_id,
        stale.status_id as status_anterior,
        stale.ultima_mensagem_cliente_em,
        stale.ultima_mensagem_chat_em
    `;
  },

  get_conversa_para_analise_ia: () => {
    return `
      with conversa_base as (
        select id, empresa_id, cliente_id
        from cliente_conversa_whats
        where id = $1
          and empresa_id = $2
        limit 1
      ),
      conversa_alvo as (
        select ccw.id
        from cliente_conversa_whats ccw
        inner join conversa_base cb on cb.cliente_id = ccw.cliente_id and cb.empresa_id = ccw.empresa_id
        where ccw.status_id = 1
          and ccw.data_fim is null
        order by coalesce(ccw.ultima_atualizacao, ccw.data_inicio) desc, ccw.id desc
        limit 1
      ),
      conversa_final as (
        select id from conversa_alvo
        union all
        select fallback.id
        from (
          select ccw.id
          from cliente_conversa_whats ccw
          inner join conversa_base cb on cb.cliente_id = ccw.cliente_id and cb.empresa_id = ccw.empresa_id
          where not exists (select 1 from conversa_alvo)
          order by coalesce(ccw.data_inicio, ccw.ultima_atualizacao) desc, ccw.id desc
          limit 1
        ) fallback
      )
      select
        ccw.id as conversa_id,
        ccw.empresa_id,
        ccw.status_id,
        ccw.data_inicio,
        ccw.data_fim,
        c.id as cliente_id,
        c.nome as cliente_nome,
        c.telefone as cliente_telefone,
        u.nome as atendente_nome,
        m.id as mensagem_id,
        m.mensagem,
        m.tipo_id,
        m.send_by,
        m.data_mensagem
      from cliente_conversa_whats ccw
      inner join cliente c on c.id = ccw.cliente_id
      left join usuario u on u.id = ccw.usuario_id
      left join cliente_conversa_whats_mensagem m on m.cliente_conversa_id = ccw.id
      where ccw.id = (select id from conversa_final limit 1)
        and ccw.empresa_id = $2
      order by m.id
    `;
  },

  get_prompt_ia_atendimento_empresa: () => {
    return `
      SELECT
        prompt_ia_atendimento
      FROM empresa
      WHERE id = $1
      LIMIT 1
    `;
  },

  mark_message_media_unavailable: () => {
    return `
      update cliente_conversa_whats_mensagem mensagem
      set midia_id = null
      from cliente_conversa_whats conversa_origem,
           cliente_conversa_whats conversa_mensagem
      where conversa_origem.id = $1
        and conversa_mensagem.id = mensagem.cliente_conversa_id
        and conversa_mensagem.empresa_id = conversa_origem.empresa_id
        and conversa_mensagem.cliente_id = conversa_origem.cliente_id
        and (
          (
            conversa_origem.empresa_meta_param_id is not null
            and conversa_mensagem.empresa_meta_param_id = conversa_origem.empresa_meta_param_id
          )
          or (
            conversa_origem.empresa_meta_param_id is null
            and conversa_mensagem.empresa_meta_param_id is null
            and conversa_mensagem.number_phone_id is not distinct from conversa_origem.number_phone_id
          )
        )
        and mensagem.midia_id = $2
      returning mensagem.id
    `;
  },
};

module.exports = models;
