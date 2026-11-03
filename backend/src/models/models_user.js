function getListaClientesProximoAniversarioSql(alias = "c") {
  return `
    CASE
      WHEN ${alias}.data_aniversario IS NULL THEN NULL
      WHEN make_date(
        EXTRACT(YEAR FROM current_date)::int,
        EXTRACT(MONTH FROM ${alias}.data_aniversario)::int,
        LEAST(
          EXTRACT(DAY FROM ${alias}.data_aniversario)::int,
          EXTRACT(
            DAY FROM (
              date_trunc(
                'month',
                make_date(
                  EXTRACT(YEAR FROM current_date)::int,
                  EXTRACT(MONTH FROM ${alias}.data_aniversario)::int,
                  1
                )
              ) + interval '1 month - 1 day'
            )
          )::int
        )
      ) >= current_date THEN make_date(
        EXTRACT(YEAR FROM current_date)::int,
        EXTRACT(MONTH FROM ${alias}.data_aniversario)::int,
        LEAST(
          EXTRACT(DAY FROM ${alias}.data_aniversario)::int,
          EXTRACT(
            DAY FROM (
              date_trunc(
                'month',
                make_date(
                  EXTRACT(YEAR FROM current_date)::int,
                  EXTRACT(MONTH FROM ${alias}.data_aniversario)::int,
                  1
                )
              ) + interval '1 month - 1 day'
            )
          )::int
        )
      )
      ELSE make_date(
        EXTRACT(YEAR FROM current_date)::int + 1,
        EXTRACT(MONTH FROM ${alias}.data_aniversario)::int,
        LEAST(
          EXTRACT(DAY FROM ${alias}.data_aniversario)::int,
          EXTRACT(
            DAY FROM (
              date_trunc(
                'month',
                make_date(
                  EXTRACT(YEAR FROM current_date)::int + 1,
                  EXTRACT(MONTH FROM ${alias}.data_aniversario)::int,
                  1
                )
              ) + interval '1 month - 1 day'
            )
          )::int
        )
      )
    END
  `;
}

function getListaClientesBuscaSql(
  alias = "c",
  empresaPlaceholder = "$2",
  buscaPlaceholder = "$4"
) {
  return `
    (
      ${buscaPlaceholder} = ''
      OR ${alias}.nome ILIKE '%' || ${buscaPlaceholder} || '%'
      OR COALESCE(${alias}.email, '') ILIKE '%' || ${buscaPlaceholder} || '%'
      OR COALESCE(${alias}.telefone, '') ILIKE '%' || ${buscaPlaceholder} || '%'
      OR EXISTS (
        SELECT 1
        FROM comercial_negocio n
        LEFT JOIN comercial_crm crm
          ON crm.id = n.crm_id
        LEFT JOIN comercial_etapa e
          ON e.id = n.etapa_id
        LEFT JOIN usuario u
          ON u.id = n.responsavel_usuario_id
        WHERE n.empresa_id = ${empresaPlaceholder}
          AND n.cliente_id = ${alias}.id
          AND n.ativo = true
          AND (
            COALESCE(crm.nome, '') ILIKE '%' || ${buscaPlaceholder} || '%'
            OR COALESCE(e.nome, '') ILIKE '%' || ${buscaPlaceholder} || '%'
            OR COALESCE(n.titulo, '') ILIKE '%' || ${buscaPlaceholder} || '%'
            OR COALESCE(u.nome, '') ILIKE '%' || ${buscaPlaceholder} || '%'
          )
      )
    )
  `;
}

function getListaClientesFiltroSql(
  alias = "c",
  empresaPlaceholder = "$2",
  filtroPlaceholder = "$5"
) {
  return `
    (
      ${filtroPlaceholder} = 'all'
      OR (
        ${filtroPlaceholder} = 'birthday_5_days'
        AND ${alias}.data_aniversario IS NOT NULL
        AND ${getListaClientesProximoAniversarioSql(alias)} <= current_date + 5
      )
      OR (
        ${filtroPlaceholder} = 'with_crm'
        AND EXISTS (
          SELECT 1
          FROM comercial_negocio n
          WHERE n.empresa_id = ${empresaPlaceholder}
            AND n.cliente_id = ${alias}.id
            AND n.ativo = true
        )
      )
      OR (
        ${filtroPlaceholder} = 'without_crm'
        AND NOT EXISTS (
          SELECT 1
          FROM comercial_negocio n
          WHERE n.empresa_id = ${empresaPlaceholder}
            AND n.cliente_id = ${alias}.id
            AND n.ativo = true
        )
      )
    )
  `;
}

function getListaClientesFiltrosCompostosSql(
  alias = "c",
  empresaPlaceholder = "$2",
  utmPlaceholder = "$6",
  origemPlaceholder = "$7",
  tagIdsPlaceholder = "$8",
  dataEntradaInicialPlaceholder = "$9",
  dataEntradaFinalPlaceholder = "$10"
) {
  return `
    (
      (${utmPlaceholder} = '' OR COALESCE(${alias}.utms::text, '') ILIKE '%' || ${utmPlaceholder} || '%')
      AND (${origemPlaceholder} = '' OR lower(COALESCE(${alias}.origem, '')) = lower(${origemPlaceholder}))
      AND (
        coalesce(array_length(${tagIdsPlaceholder}::int[], 1), 0) = 0
        OR (
          SELECT count(distinct ct.tag_id)
          FROM cliente_tag ct
          INNER JOIN tag t
            ON t.id = ct.tag_id
          WHERE ct.cliente_id = ${alias}.id
            AND ct.tag_id = any(${tagIdsPlaceholder}::int[])
            AND t.empresa_id = ${empresaPlaceholder}
        ) = coalesce(array_length(${tagIdsPlaceholder}::int[], 1), 0)
      )
      AND (${dataEntradaInicialPlaceholder}::date IS NULL OR ${alias}.data_cadastro::date >= ${dataEntradaInicialPlaceholder}::date)
      AND (${dataEntradaFinalPlaceholder}::date IS NULL OR ${alias}.data_cadastro::date <= ${dataEntradaFinalPlaceholder}::date)
    )
  `;
}

const SALES_FOLLOWUP_TEMPLATE_SQL_CONFIG = {
  sale_completed: {
    enabledColumn: "whatsapp_auto_message_followup_venda_realizada_ativa",
    defaultDispatchColumn: "whatsapp_followup_venda_realizada_template_default_dispatch",
    templateNameColumn: "whatsapp_followup_venda_realizada_template_name",
    templateLanguageColumn: "whatsapp_followup_venda_realizada_template_language",
    scheduleColumn: "whatsapp_followup_venda_realizada_template_horario",
    delayDaysColumn: "whatsapp_followup_venda_realizada_template_delay_days",
    headerMediaTypeColumn: "whatsapp_followup_venda_realizada_template_header_media_type",
    headerMediaUrlColumn: "whatsapp_followup_venda_realizada_template_header_media_url",
    headerParametersColumn: "whatsapp_followup_venda_realizada_template_header_parameters",
    bodyParametersColumn: "whatsapp_followup_venda_realizada_template_body_parameters",
    buttonParametersColumn: "whatsapp_followup_venda_realizada_template_button_parameters",
    expectedGainLiteral: "true",
  },
  sale_refused: {
    enabledColumn: "whatsapp_auto_message_followup_venda_recusada_ativa",
    defaultDispatchColumn: "whatsapp_followup_venda_recusada_template_default_dispatch",
    templateNameColumn: "whatsapp_followup_venda_recusada_template_name",
    templateLanguageColumn: "whatsapp_followup_venda_recusada_template_language",
    scheduleColumn: "whatsapp_followup_venda_recusada_template_horario",
    delayDaysColumn: "whatsapp_followup_venda_recusada_template_delay_days",
    headerMediaTypeColumn: "whatsapp_followup_venda_recusada_template_header_media_type",
    headerMediaUrlColumn: "whatsapp_followup_venda_recusada_template_header_media_url",
    headerParametersColumn: "whatsapp_followup_venda_recusada_template_header_parameters",
    bodyParametersColumn: "whatsapp_followup_venda_recusada_template_body_parameters",
    buttonParametersColumn: "whatsapp_followup_venda_recusada_template_button_parameters",
    expectedGainLiteral: "false",
  },
};

function getSalesFollowupTemplateSqlConfig(automationType) {
  return SALES_FOLLOWUP_TEMPLATE_SQL_CONFIG[String(automationType || "").trim()] || null;
}

function buildSalesFollowupTemplateConfigProjection(config, alias = "empm") {
  return `
            ${alias}.id AS empresa_meta_param_id,
            ${alias}.empresa_id,
            ${alias}.meta_display_phone_number AS display_phone_number,
            ${alias}.meta_verified_name AS verified_name,
            ${alias}.meta_phone_number_id AS phone_number_id,
            ${alias}.whatsapp_account_id,
            COALESCE(${alias}.${config.enabledColumn}, true) AS habilitada,
            COALESCE(${alias}.${config.defaultDispatchColumn}, false)
                AS is_default_dispatch_number,
            NULLIF(trim(COALESCE(${alias}.${config.templateNameColumn}, '')), '') AS template_name,
            COALESCE(NULLIF(trim(COALESCE(${alias}.${config.templateLanguageColumn}, '')), ''), 'pt_BR')
                AS template_language,
            to_char(
                COALESCE(${alias}.${config.scheduleColumn}, '09:00:00'::time),
                'HH24:MI:SS'
            ) AS horario,
            GREATEST(COALESCE(${alias}.${config.delayDaysColumn}, 3), 0) AS delay_days,
            NULLIF(trim(COALESCE(${alias}.${config.headerMediaTypeColumn}, '')), '')
                AS header_media_type,
            NULLIF(trim(COALESCE(${alias}.${config.headerMediaUrlColumn}, '')), '')
                AS header_media_url,
            COALESCE(${alias}.${config.headerParametersColumn}, '[]'::jsonb)
                AS header_parameters,
            COALESCE(${alias}.${config.bodyParametersColumn}, '[]'::jsonb)
                AS body_parameters,
            COALESCE(${alias}.${config.buttonParametersColumn}, '[]'::jsonb)
                AS button_parameters
  `;
}

function buildSalesFollowupTemplateFallbackProjection(config, tableAlias = "empresa_meta_parans") {
  return `
            (
                SELECT empm_default.id
                FROM empresa_meta_parans empm_default
                WHERE empm_default.empresa_id = ${tableAlias}.empresa_id
                  AND COALESCE(empm_default.ativo, true) = true
                  AND COALESCE(empm_default.${config.defaultDispatchColumn}, false) = true
                ORDER BY empm_default.id ASC
                LIMIT 1
            ) AS default_dispatch_meta_param_id,
            (
                SELECT empm_default.meta_display_phone_number
                FROM empresa_meta_parans empm_default
                WHERE empm_default.empresa_id = ${tableAlias}.empresa_id
                  AND COALESCE(empm_default.ativo, true) = true
                  AND COALESCE(empm_default.${config.defaultDispatchColumn}, false) = true
                ORDER BY empm_default.id ASC
                LIMIT 1
            ) AS default_dispatch_display_phone_number
  `;
}

const models = {
  get_notas: () => {
    return `
        select 
            u.nome,
            ca.texto,
            ca.data_criacao
        from 
            cliente_anotacao ca 
        left join usuario u
            on u.id = ca.usuario_id
        where cliente_id = $1
        `;
  },

  get_dados_cliente: () => {
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
        `;
  },

  get_clientes_tags: () => {
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

  get_lista_clientes: () => {
    return `
        with clientes_paginados as (
            select
                c.id,
                c.nome,
                c.telefone,
                c.email,
                c.cpf,
                c.origem,
                c.utms,
                c.meta_ads_referral,
                c.meta_ads_utm,
                c.meta_ads_attributed_at,
                c.meta_ads_source_url,
                c.meta_ads_source_type,
                c.meta_ads_source_id,
                c.meta_ads_headline,
                c.meta_ads_body,
                c.meta_ads_media_type,
                c.meta_ads_image_url,
                c.meta_ads_video_url,
                c.meta_ads_thumbnail_url,
                c.meta_ads_ctwa_clid,
                c.meta_ads_message_id,
                c.meta_ads_phone_number_id,
                c.data_cadastro,
                c.data_aniversario,
                c.logradouro,
                c.numero,
                c.complemento,
                c.bairro,
                c.cidade,
                c.uf,
                c.cep,
                c.empresa,
                c.cargo,
                c.faturamento
            from cliente c
            where c.ativo = true
              and c.empresa_id = $2
              and ${getListaClientesBuscaSql("c")}
              and ${getListaClientesFiltroSql("c")}
              and ${getListaClientesFiltrosCompostosSql("c", "$2")}
              and (
                $11::boolean = true
                or exists (
                    select 1
                    from cliente_conversa_whats ccw
                    where ccw.empresa_id = $2
                      and ccw.cliente_id = c.id
                )
                or exists (
                    select 1
                    from comercial_interacao ci
                    where ci.empresa_id = $2
                      and ci.cliente_id = c.id
                )
                or exists (
                    select 1
                    from comercial_historico_cliente chc
                    where chc.empresa_id = $2
                      and chc.cliente_id = c.id
                )
              )
            order by c.data_cadastro desc, c.id desc
            limit $3 offset ($1 - 1) * $3
        )
        select
            cp.id,
            cp.id as cliente_id,
            cp.nome as name,
            cp.telefone as phone,
            cp.email as email,
            cp.cpf as cpf,
            cp.origem,
            cp.utms,
            cp.meta_ads_referral,
            cp.meta_ads_utm,
            cp.meta_ads_attributed_at,
            cp.meta_ads_source_url,
            cp.meta_ads_source_type,
            cp.meta_ads_source_id,
            cp.meta_ads_headline,
            cp.meta_ads_body,
            cp.meta_ads_media_type,
            cp.meta_ads_image_url,
            cp.meta_ads_video_url,
            cp.meta_ads_thumbnail_url,
            cp.meta_ads_ctwa_clid,
            cp.meta_ads_message_id,
            cp.meta_ads_phone_number_id,
            cp.data_cadastro,
            cp.data_aniversario,
            cp.logradouro,
            cp.numero,
            cp.complemento,
            cp.bairro,
            cp.cidade,
            cp.uf,
            cp.cep,
            cp.empresa,
            cp.cargo,
            cp.faturamento,
            coalesce(tags.tags, '[]'::json) as tags,
            ultimo_contato.last_contact,
            coalesce(compras.total_purchases, 0) as total_purchases,
            coalesce(compras.total_spent, 0) as total_spent,
            coalesce(compras.average_ticket, 0) as average_ticket,
            compras.last_purchase_at,
            coalesce(interacoes.total_interactions, 0) as total_interactions,
            interacoes.last_interaction,
            coalesce(historico.total_history_entries, 0) as total_history_entries,
            coalesce(atendimentos.total_whatsapp_attendances, 0) as total_whatsapp_attendances,
            atendimentos.last_whatsapp_attendance,
            crm.crm_nome,
            crm.crm_stage_name,
            crm.crm_title,
            crm.crm_responsible_name
        from clientes_paginados cp
        left join lateral (
            select max(ccw.ultima_atualizacao) as last_contact
            from cliente_conversa_whats ccw
            where ccw.cliente_id = cp.id
        ) ultimo_contato on true
        left join lateral (
            select
                coalesce(
                    json_agg(
                        json_build_object(
                            'id', t.id,
                            'name', t.nome
                        )
                        order by t.nome
                    ) filter (where t.id is not null),
                    '[]'::json
                ) as tags
            from cliente_tag ct
            inner join tag t
                on t.id = ct.tag_id
            where ct.cliente_id = cp.id
              and t.empresa_id = $2
        ) tags on true
        left join lateral (
            select
                count(*) filter (where e.codigo = 'closed-won') as total_purchases,
                coalesce(
                    sum(
                        case
                            when e.codigo = 'closed-won'
                                then coalesce(n.valor_fechamento, n.valor_estimado, 0)
                            else 0
                        end
                    ),
                    0
                ) as total_spent,
                coalesce(
                    avg(
                        case
                            when e.codigo = 'closed-won'
                                then coalesce(n.valor_fechamento, n.valor_estimado, 0)
                        end
                    ),
                    0
                ) as average_ticket,
                max(
                    case
                        when e.codigo = 'closed-won'
                            then coalesce(n.data_fechamento_real, n.data_entrada_pipeline, n.data_criacao)
                    end
                ) as last_purchase_at
            from comercial_negocio n
            left join comercial_etapa e on e.id = n.etapa_id
            where n.empresa_id = $2
              and n.cliente_id = cp.id
              and n.ativo = true
        ) compras on true
        left join lateral (
            select
                count(*) as total_interactions,
                max(ci.data_inicio) as last_interaction
            from comercial_interacao ci
            where ci.empresa_id = $2
              and ci.cliente_id = cp.id
        ) interacoes on true
        left join lateral (
            select count(*) as total_history_entries
            from comercial_historico_cliente h
            where h.empresa_id = $2
              and h.cliente_id = cp.id
        ) historico on true
        left join lateral (
            select
                count(*) as total_whatsapp_attendances,
                max(coalesce(ccw.data_inicio, ccw.ultima_atualizacao)) as last_whatsapp_attendance
            from cliente_conversa_whats ccw
            where ccw.empresa_id = $2
              and ccw.cliente_id = cp.id
        ) atendimentos on true
        left join lateral (
            select
                crm.nome as crm_nome,
                e.nome as crm_stage_name,
                n.titulo as crm_title,
                u.nome as crm_responsible_name
            from comercial_negocio n
            inner join comercial_crm crm on crm.id = n.crm_id
            inner join comercial_etapa e on e.id = n.etapa_id
            left join usuario u on u.id = n.responsavel_usuario_id
            where n.empresa_id = $2
              and n.cliente_id = cp.id
              and n.ativo = true
            order by
                case when coalesce(e.eh_fechamento, false) = false then 0 else 1 end,
                coalesce(n.data_entrada_pipeline, n.data_criacao) desc,
                n.id desc
            limit 1
        ) crm on true
        order by cp.data_cadastro desc;
        `;
  },

  count_lista_clientes: () => {
    return `
      select count(*)::int as total
      from cliente c
      where c.ativo = true
        and c.empresa_id = $1
        and ${getListaClientesBuscaSql("c", "$1", "$2")}
        and ${getListaClientesFiltroSql("c", "$1", "$3")}
        and ${getListaClientesFiltrosCompostosSql("c", "$1", "$4", "$5", "$6", "$7", "$8")}
        and (
          $9::boolean = true
          or exists (
              select 1
              from cliente_conversa_whats ccw
              where ccw.empresa_id = $1
                and ccw.cliente_id = c.id
          )
          or exists (
              select 1
              from comercial_interacao ci
              where ci.empresa_id = $1
                and ci.cliente_id = c.id
          )
          or exists (
              select 1
              from comercial_historico_cliente chc
              where chc.empresa_id = $1
                and chc.cliente_id = c.id
          )
        )
    `;
  },

  alterar_cliente: () => {
    return `
        with cliente_anterior as (
          select id, nome
          from cliente
          where id = $16
          for update
        ), cliente_atualizado as (
          update cliente c
          set
            nome = $1,
            email = $2,
            cpf = $3,
            data_aniversario = $4,
            origem = $5,
            logradouro = $6,
            numero = $7,
            complemento = $8,
            bairro = $9,
            cidade = $10,
            uf = $11,
            cep = $12,
            empresa = $13,
            cargo = $14,
            faturamento = $15
          from cliente_anterior ca
          where c.id = ca.id
          returning c.id, c.nome, ca.nome as nome_anterior
        ), negocios_sincronizados as (
          update comercial_negocio n
          set
            titulo = case
              when nullif(btrim(ca.nome_anterior), '') is null then n.titulo
              when btrim(coalesce(n.titulo, '')) = btrim(ca.nome_anterior)
                then ca.nome
              when btrim(coalesce(n.titulo, '')) = 'WhatsApp - ' || btrim(ca.nome_anterior)
                then 'WhatsApp - ' || ca.nome
              when btrim(coalesce(n.titulo, '')) = 'Orçamento - ' || btrim(ca.nome_anterior)
                then 'Orçamento - ' || ca.nome
              when btrim(coalesce(n.titulo, '')) = 'Orcamento - ' || btrim(ca.nome_anterior)
                then 'Orcamento - ' || ca.nome
              else n.titulo
            end,
            nome_contato = ca.nome,
            nome_empresa = case
              when btrim(coalesce(n.nome_empresa, '')) = btrim(coalesce(ca.nome_anterior, ''))
                then ca.nome
              else n.nome_empresa
            end
          from cliente_atualizado ca
          where n.cliente_id = ca.id
            and nullif(btrim(ca.nome), '') is not null
          returning n.id
        )
        select id from cliente_atualizado
        `;
  },

  criar_cliente: () => {
    return `
        insert into cliente (
            nome,
            telefone,
            email,
            cpf,
            ativo,
            empresa_id,
            data_aniversario,
            origem,
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
        )
        values ($1, $2, $3, $4, true, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        returning
            id,
            nome,
            telefone,
            email,
            cpf,
            origem,
            data_aniversario,
            data_cadastro,
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
        `;
  },

  remover_cliente: () => {
    return `update cliente set ativo = false where id = $1`;
  },

  get_cliente_by_email_or_phone: () => {
    return `
        select
            id,
            nome,
            telefone,
            email,
            origem,
            utms,
            data_aniversario
        from cliente
        where empresa_id = $1
          and ativo = true
          and (
            ($2::varchar is not null and email is not null and upper(email) = upper($2::varchar))
            or ($3::varchar[] is not null and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = any($3::varchar[]))
          )
        order by id
        limit 1
        `;
  },

  get_cliente_by_email_or_phone_importacao: () => {
    return `
        select
            id,
            nome,
            telefone,
            email,
            origem,
            utms,
            data_aniversario,
            ativo
        from cliente
        where empresa_id = $1
          and (
            ($2::varchar is not null and email is not null and upper(email) = upper($2::varchar))
            or ($3::varchar[] is not null and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = any($3::varchar[]))
          )
        order by ativo desc, id
        limit 1
        `;
  },

  create_cliente_importacao: () => {
    return `
        insert into cliente (
            nome,
            telefone,
            email,
            ativo,
            empresa_id,
            utms,
            data_aniversario,
            origem
        )
        values ($1, $2, $3, true, $4, coalesce($5::jsonb, '[]'::jsonb), $6, $7)
        returning id, nome, telefone, email, origem, utms, data_aniversario
        `;
  },

  update_cliente_importacao: () => {
    return `
        update cliente
        set
            nome = $2,
            telefone = $3,
            email = $4,
            data_aniversario = $5,
            ativo = true,
            origem = coalesce(origem, $6)
        where id = $1
        returning id, nome, telefone, email, origem, utms, data_aniversario, ativo
        `;
  },

  update_cliente_origem_integracao: () => {
    return `
        update cliente
        set origem = $2
        where id = $1
          and empresa_id = $3
        returning id, nome, telefone, email, origem, utms, data_aniversario, ativo
        `;
  },

  reativar_cliente_criacao_manual: () => {
    return `
        update cliente
        set
            nome = $2,
            telefone = $3,
            email = $4,
            cpf = $5,
            data_aniversario = $6,
            origem = $7,
            logradouro = $8,
            numero = $9,
            complemento = $10,
            bairro = $11,
            cidade = $12,
            uf = $13,
            cep = $14,
            empresa = $15,
            cargo = $16,
            faturamento = $17,
            ativo = true
        where id = $1
        returning
            id,
            nome,
            telefone,
            email,
            cpf,
            origem,
            data_aniversario,
            data_cadastro,
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
        `;
  },

  append_cliente_utms: () => {
    return `
      update cliente
      set utms = coalesce(utms, '[]'::jsonb) || $2::jsonb
      where id = $1
      returning utms
    `;
  },

  create_tag: () => {
    return `
        INSERT INTO tag (nome, empresa_id)
            VALUES ($1, $2)
        ON CONFLICT (nome) DO NOTHING
        RETURNING id, nome as name;
        `;
  },

  get_tag_by_nome: () => {
    return `
        select
            id,
            nome as name
        from tag
        where upper(nome) = upper($1) and empresa_id = $2
        limit 1
        `;
  },

  create_vinculo: () => {
    return `
        insert into cliente_tag (tag_id, cliente_id) values ($1,$2)
        `;
  },

  create_vinculo_importacao: () => {
    return `
        insert into cliente_tag (tag_id, cliente_id)
        select $1, $2
        where not exists (
            select 1
            from cliente_tag
            where tag_id = $1
              and cliente_id = $2
        )
        `;
  },

  get_cliente_tag_ids_for_import: () => {
    return `
        select tag_id
        from cliente_tag
        where cliente_id = $1
        `;
  },

  remove_vinculo: () => {
    return `
        delete from cliente_tag where cliente_id = $1 and tag_id = $2
        `;
  },

  deletar_tag: () => {
    return `
        delete from tag where id = $1
        `;
  },

  update_tag: () => {
    return `
        update tag set nome = $2 where id = $1
        `;
  },

  remover_vinculo_em_massa: () => {
    return `
        delete from cliente_tag where tag_id = $1
        `;
  },

  clientes_tag: () => {
    return `
        SELECT 
            c.*
        FROM tag t
        JOIN cliente_tag ct 
            ON ct.tag_id = t.id
        JOIN cliente c 
            ON c.id = ct.cliente_id
        WHERE t.nome ILIKE $1 and c.empresa_id = $2;
        `;
  },

  get_lista_tags: () => {
    return `
        select 
            id,
            nome as name
        from tag where empresa_id = $1
        `;
  },

  create_lista_transmissao: () => {
    return `
        insert into cliente_lista_transmissao (
            empresa_id,
            empresa_meta_param_id,
            nome,
            descricao,
            tag_logic,
            utm_filters,
            criado_por_usuario_id,
            ativo
        )
        values ($1, $2, $3, $4, $5, coalesce($6::jsonb, '{}'::jsonb), $7, true)
        returning
            id,
            empresa_id,
            empresa_meta_param_id,
            nome,
            descricao,
            tag_logic,
            utm_filters,
            criado_por_usuario_id,
            created_at,
            updated_at
        `;
  },

  update_lista_transmissao: () => {
    return `
        update cliente_lista_transmissao
        set
            nome = $2,
            descricao = $3,
            tag_logic = $4,
            utm_filters = coalesce($5::jsonb, '{}'::jsonb),
            empresa_meta_param_id = $6,
            updated_at = current_timestamp
        where id = $1
          and empresa_id = $7
          and ativo = true
        returning
            id,
            empresa_id,
            empresa_meta_param_id,
            nome,
            descricao,
            tag_logic,
            utm_filters,
            criado_por_usuario_id,
            created_at,
            updated_at
        `;
  },

  delete_lista_transmissao: () => {
    return `
        update cliente_lista_transmissao
        set
            ativo = false,
            updated_at = current_timestamp
        where id = $1
          and empresa_id = $2
          and ativo = true
        returning id
        `;
  },

  get_lista_transmissao_by_id: () => {
    return `
        select
            lt.id,
            lt.empresa_id,
            lt.empresa_meta_param_id,
            lt.nome,
            lt.descricao,
            lt.tag_logic,
            coalesce(lt.utm_filters, '{}'::jsonb) as utm_filters,
            lt.criado_por_usuario_id,
            lt.created_at,
            lt.updated_at,
            emp.meta_display_phone_number as meta_display_phone_number,
            emp.meta_phone_number_id as meta_phone_number_id,
            emp.meta_verified_name as meta_verified_name
        from cliente_lista_transmissao lt
        left join empresa_meta_parans emp
          on emp.id = lt.empresa_meta_param_id
         and emp.empresa_id = lt.empresa_id
        where lt.id = $1
          and lt.empresa_id = $2
          and lt.ativo = true
        limit 1
        `;
  },

  list_listas_transmissao: () => {
    return `
        select
            lt.id,
            lt.empresa_id,
            lt.empresa_meta_param_id,
            lt.nome,
            lt.descricao,
            lt.tag_logic,
            coalesce(lt.utm_filters, '{}'::jsonb) as utm_filters,
            lt.created_at,
            lt.updated_at,
            emp.meta_display_phone_number as meta_display_phone_number,
            emp.meta_phone_number_id as meta_phone_number_id,
            emp.meta_verified_name as meta_verified_name,
            coalesce(contatos.total_contatos, 0) as total_contatos,
            coalesce(
                json_agg(
                    distinct jsonb_build_object(
                        'id', t.id,
                        'name', t.nome
                    )
                ) filter (where t.id is not null),
                '[]'::json
            ) as tags
        from cliente_lista_transmissao lt
        left join lateral (
            select count(*)::int as total_contatos
            from cliente_lista_transmissao_contato ltc
            where ltc.lista_transmissao_id = lt.id
        ) contatos on true
        left join empresa_meta_parans emp
            on emp.id = lt.empresa_meta_param_id
           and emp.empresa_id = lt.empresa_id
        left join cliente_lista_transmissao_tag ltt
            on ltt.lista_transmissao_id = lt.id
        left join tag t
            on t.id = ltt.tag_id
        where lt.empresa_id = $1
          and lt.ativo = true
        group by
            lt.id,
            lt.nome,
            lt.descricao,
            lt.tag_logic,
            lt.utm_filters,
            lt.created_at,
            lt.updated_at,
            emp.meta_display_phone_number,
            emp.meta_phone_number_id,
            emp.meta_verified_name,
            contatos.total_contatos
        order by lt.updated_at desc, lt.id desc
        `;
  },

  delete_lista_transmissao_tags: () => {
    return `
        delete from cliente_lista_transmissao_tag
        where lista_transmissao_id = $1
        `;
  },

  insert_lista_transmissao_tag: () => {
    return `
        insert into cliente_lista_transmissao_tag (lista_transmissao_id, tag_id)
        values ($1, $2)
        on conflict (lista_transmissao_id, tag_id) do nothing
        `;
  },

  get_lista_transmissao_contatos: () => {
    return `
        select
            ltc.id,
            ltc.origem,
            ltc.added_at,
            c.id as cliente_id,
            c.nome,
            c.telefone,
            c.email,
            c.data_aniversario,
            c.data_cadastro
        from cliente_lista_transmissao_contato ltc
        inner join cliente_lista_transmissao lt
            on lt.id = ltc.lista_transmissao_id
        inner join cliente c
            on c.id = ltc.cliente_id
        where ltc.lista_transmissao_id = $1
          and lt.empresa_id = $2
          and lt.ativo = true
          and c.ativo = true
        order by
            case when ltc.origem = 'manual' then 0 else 1 end,
            c.nome asc,
            c.id asc
        `;
  },

  delete_contatos_automaticos_lista_transmissao: () => {
    return `
        delete from cliente_lista_transmissao_contato
        where lista_transmissao_id = $1
          and origem <> 'manual'
        `;
  },

  insert_contato_lista_transmissao_manual: () => {
    return `
        insert into cliente_lista_transmissao_contato (
            lista_transmissao_id,
            cliente_id,
            origem
        )
        values ($1, $2, 'manual')
        on conflict (lista_transmissao_id, cliente_id)
        do update set
            origem = 'manual',
            added_at = current_timestamp
        returning id
        `;
  },

  insert_contato_lista_transmissao_segmento: () => {
    return `
        insert into cliente_lista_transmissao_contato (
            lista_transmissao_id,
            cliente_id,
            origem
        )
        values ($1, $2, 'segmento')
        on conflict (lista_transmissao_id, cliente_id) do nothing
        returning id
        `;
  },

  delete_contato_lista_transmissao: () => {
    return `
        delete from cliente_lista_transmissao_contato
        where lista_transmissao_id = $1
          and cliente_id = $2
        returning id
        `;
  },

  get_cliente_by_id_empresa: () => {
    return `
        select
            id,
            nome,
            telefone,
            email
        from cliente
        where id = $1
          and empresa_id = $2
          and ativo = true
        limit 1
        `;
  },

  get_tag_ids_validos_empresa: () => {
    return `
        select
            id,
            nome as name
        from tag
        where empresa_id = $1
          and id = any($2::int[])
        order by nome asc
        `;
  },

  count_contatos_lista_transmissao: () => {
    return `
        select count(*)::int as total_contatos
        from cliente_lista_transmissao_contato
        where lista_transmissao_id = $1
        `;
  },

  get_mensagens_rapidas: () => {
    return `
        select 
            mr.id,
            mr.comando as command,
            mr.descricao as description,
            mr.texto as text,
            coalesce(mr.usar_texto_como_legenda, false) as use_text_as_image_caption,
            coalesce(mr.ordem_midias, '["image", "document", "audio"]'::jsonb) as media_order,
            mr.usuario_id,
            u.nome as usuario_nome,
            ($3::boolean or coalesce(mr.usuario_id = $2::bigint, false)) as can_edit,
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
        left join usuario u on u.id = mr.usuario_id
        where mr.ativo = true
          and mr.empresa_id = $1
          and ($3::boolean or mr.usuario_id is null or mr.usuario_id = $2::bigint)
        order by mr.comando asc
        `;
  },

  get_mensagens_rapidas_legacy: () => {
    return `
        select
            mr.id,
            mr.comando as command,
            mr.descricao as description,
            mr.texto as text,
            false as use_text_as_image_caption,
            '["image", "document", "audio"]'::jsonb as media_order,
            null::bigint as usuario_id,
            null::varchar as usuario_nome,
            true as can_edit,
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
        where mr.ativo = true
          and mr.empresa_id = $1
        order by mr.comando asc
        `;
  },

  get_mensagem_rapida_by_id: () => {
    return `
        select 
            mr.id,
            mr.comando as command,
            mr.descricao as description,
            mr.texto as text,
            coalesce(mr.usar_texto_como_legenda, false) as use_text_as_image_caption,
            coalesce(mr.ordem_midias, '["image", "document", "audio"]'::jsonb) as media_order,
            mr.usuario_id,
            u.nome as usuario_nome,
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
        left join usuario u on u.id = mr.usuario_id
        where mr.id = $1
          and mr.empresa_id = $2
        limit 1
        `;
  },

  get_mensagem_rapida_by_id_legacy: () => {
    return `
        select
            mr.id,
            mr.comando as command,
            mr.descricao as description,
            mr.texto as text,
            false as use_text_as_image_caption,
            '["image", "document", "audio"]'::jsonb as media_order,
            null::bigint as usuario_id,
            null::varchar as usuario_nome,
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
        where mr.id = $1
          and mr.empresa_id = $2
        limit 1
        `;
  },

  listar_galeria_imagens_empresa: () => {
    return `
        select
            items.id,
            items.empresa_id,
            items.nome_arquivo,
            items.url,
            items.path_bunny,
            items.mime_type,
            items.tamanho_bytes,
            items.origem,
            items.data_criacao,
            items.mensagens_vinculadas,
            items.referencia_nome,
            items.produto_descricao,
            items.produto_preco_base,
            items.permite_exclusao,
            items.disponivel_para_mensagem_rapida
        from (
            select
                gi.id,
                gi.empresa_id,
                gi.nome_arquivo,
                gi.url,
                gi.path_bunny,
                gi.mime_type,
                gi.tamanho_bytes,
                gi.origem,
                gi.data_criacao,
                count(mr.id)::int as mensagens_vinculadas,
                null::character varying as referencia_nome,
                null::text as produto_descricao,
                null::numeric as produto_preco_base,
                true as permite_exclusao,
                true as disponivel_para_mensagem_rapida
            from empresa_galeria_imagem gi
            left join mensagens_rapidas mr
              on mr.ativo = true
             and (
               mr.galeria_imagem_id = gi.id
               or (jsonb_typeof(mr.ordem_midias) = 'object' and exists (
                 select 1 from jsonb_array_elements(coalesce(mr.ordem_midias->'images', '[]'::jsonb)) item
                 where (item->>'id')::bigint = gi.id
               ))
             )
            where gi.empresa_id = $1
              and gi.ativo = true
              and coalesce(gi.mime_type, '') not ilike 'video/%'
            group by
                gi.id,
                gi.empresa_id,
                gi.nome_arquivo,
                gi.url,
                gi.path_bunny,
                gi.mime_type,
                gi.tamanho_bytes,
                gi.origem,
                gi.data_criacao

            union all

            select
                cpi.id,
                cpi.empresa_id,
                cpi.nome_arquivo,
                cpi.url,
                cpi.path_bunny,
                cpi.mime_type,
                cpi.tamanho_bytes,
                'produto_comercial'::character varying as origem,
                cpi.criado_em as data_criacao,
                0::int as mensagens_vinculadas,
                cp.nome as referencia_nome,
                cp.descricao as produto_descricao,
                cp.preco_base as produto_preco_base,
                false as permite_exclusao,
                false as disponivel_para_mensagem_rapida
            from comercial_produto_imagem cpi
            inner join comercial_produto cp
              on cp.id = cpi.comercial_produto_id
             and cp.empresa_id = cpi.empresa_id
             and cp.ativo = true
            where cpi.empresa_id = $1
              and cpi.ativo = true
        ) items
        order by items.data_criacao desc nulls last, items.id desc
        `;
  },

  get_galeria_imagem_by_id_empresa: () => {
    return `
        select
            id,
            empresa_id,
            nome_arquivo,
            url,
            path_bunny,
            mime_type,
            tamanho_bytes,
            origem,
            data_criacao,
            ativo
        from empresa_galeria_imagem
        where id = $1
          and empresa_id = $2
          and ativo = true
        limit 1
        `;
  },

  contar_galeria_imagens_empresa: () => {
    return `
        select count(*)::int as total
        from empresa_galeria_imagem
        where empresa_id = $1
          and ativo = true
        `;
  },

  listar_galeria_documentos_empresa: () => {
    return `
        select
            items.id,
            items.empresa_id,
            items.nome_arquivo,
            items.url,
            items.path_bunny,
            items.mime_type,
            items.tamanho_bytes,
            items.origem,
            items.data_criacao,
            items.mensagens_vinculadas,
            items.referencia_nome,
            items.permite_exclusao,
            items.disponivel_para_mensagem_rapida
        from (
            select
                gd.id,
                gd.empresa_id,
                gd.nome_arquivo,
                gd.url,
                gd.path_bunny,
                gd.mime_type,
                gd.tamanho_bytes,
                gd.origem,
                gd.data_criacao,
                count(mr.id)::int as mensagens_vinculadas,
                null::character varying as referencia_nome,
                true as permite_exclusao,
                true as disponivel_para_mensagem_rapida
            from empresa_galeria_documento gd
            left join mensagens_rapidas mr
              on mr.galeria_documento_id = gd.id
             and mr.ativo = true
            where gd.empresa_id = $1
              and gd.ativo = true
            group by
                gd.id,
                gd.empresa_id,
                gd.nome_arquivo,
                gd.url,
                gd.path_bunny,
                gd.mime_type,
                gd.tamanho_bytes,
                gd.origem,
                gd.data_criacao

            union all

            select
                cpd.id,
                cpd.empresa_id,
                cpd.nome_arquivo,
                cpd.url,
                cpd.path_bunny,
                cpd.mime_type,
                cpd.tamanho_bytes,
                'produto_comercial_documento'::character varying as origem,
                cpd.criado_em as data_criacao,
                0::int as mensagens_vinculadas,
                cp.nome as referencia_nome,
                false as permite_exclusao,
                false as disponivel_para_mensagem_rapida
            from comercial_produto_documento cpd
            inner join comercial_produto cp
              on cp.id = cpd.comercial_produto_id
             and cp.empresa_id = cpd.empresa_id
             and cp.ativo = true
            where cpd.empresa_id = $1
              and cpd.ativo = true
        ) items
        order by items.data_criacao desc nulls last, items.id desc
        `;
  },

  get_galeria_documento_by_id_empresa: () => {
    return `
        select
            id,
            empresa_id,
            nome_arquivo,
            url,
            path_bunny,
            mime_type,
            tamanho_bytes,
            origem,
            data_criacao,
            ativo
        from empresa_galeria_documento
        where id = $1
          and empresa_id = $2
          and ativo = true
        limit 1
        `;
  },

  contar_galeria_documentos_empresa: () => {
    return `
        select count(*)::int as total
        from empresa_galeria_documento
        where empresa_id = $1
          and ativo = true
        `;
  },

  criar_galeria_documento_empresa: () => {
    return `
        insert into public.empresa_galeria_documento (
            empresa_id,
            nome_arquivo,
            url,
            path_bunny,
            mime_type,
            tamanho_bytes,
            origem,
            ativo
        )
        values ($1, $2, $3, $4, $5, $6, $7, true)
        returning
            id,
            empresa_id,
            nome_arquivo,
            url,
            path_bunny,
            mime_type,
            tamanho_bytes,
            origem,
            data_criacao
        `;
  },

  deletar_galeria_documento_empresa: () => {
    return `
        update empresa_galeria_documento
        set ativo = false
        where id = $1
          and empresa_id = $2
        returning id, path_bunny
        `;
  },

  contar_mensagens_rapidas_por_galeria_documento: () => {
    return `
        select count(*)::int as total
        from mensagens_rapidas
        where (galeria_documento_id = $1 or (jsonb_typeof(ordem_midias) = 'object' and exists (
          select 1 from jsonb_array_elements(coalesce(ordem_midias->'documents', '[]'::jsonb)) item
          where (item->>'id')::bigint = $1
        )))
          and ativo = true
        `;
  },

  listar_galeria_audios_empresa: () => {
    return `
        select
            ga.id,
            ga.empresa_id,
            ga.nome_arquivo,
            ga.url,
            ga.path_bunny,
            ga.mime_type,
            ga.tamanho_bytes,
            ga.origem,
            ga.data_criacao,
            count(mr.id)::int as mensagens_vinculadas,
            true as permite_exclusao,
            true as disponivel_para_mensagem_rapida
        from empresa_galeria_audio ga
        left join mensagens_rapidas mr
          on mr.galeria_audio_id = ga.id
         and mr.ativo = true
        where ga.empresa_id = $1
          and ga.ativo = true
        group by ga.id
        order by ga.data_criacao desc, ga.id desc
        `;
  },

  get_galeria_audio_by_id_empresa: () => {
    return `
        select id, empresa_id, nome_arquivo, url, path_bunny, mime_type,
               tamanho_bytes, origem, data_criacao, ativo
        from empresa_galeria_audio
        where id = $1 and empresa_id = $2 and ativo = true
        limit 1
        `;
  },

  contar_galeria_audios_empresa: () => {
    return `select count(*)::int as total from empresa_galeria_audio
            where empresa_id = $1 and ativo = true`;
  },

  criar_galeria_audio_empresa: () => {
    return `
        insert into public.empresa_galeria_audio (
          empresa_id, nome_arquivo, url, path_bunny, mime_type,
          tamanho_bytes, origem, ativo
        ) values ($1, $2, $3, $4, $5, $6, $7, true)
        returning id, empresa_id, nome_arquivo, url, path_bunny, mime_type,
                  tamanho_bytes, origem, data_criacao
        `;
  },

  deletar_galeria_audio_empresa: () => {
    return `update empresa_galeria_audio set ativo = false
            where id = $1 and empresa_id = $2 returning id, path_bunny`;
  },

  contar_mensagens_rapidas_por_galeria_audio: () => {
    return `select count(*)::int as total from mensagens_rapidas
            where (galeria_audio_id = $1 or (jsonb_typeof(ordem_midias) = 'object' and exists (
              select 1 from jsonb_array_elements(coalesce(ordem_midias->'audios', '[]'::jsonb)) item
              where (item->>'id')::bigint = $1
            ))) and ativo = true`;
  },

  criar_galeria_imagem_empresa: () => {
    return `
        insert into public.empresa_galeria_imagem (
            empresa_id,
            nome_arquivo,
            url,
            path_bunny,
            mime_type,
            tamanho_bytes,
            origem,
            ativo
        )
        values ($1, $2, $3, $4, $5, $6, $7, true)
        returning
            id,
            empresa_id,
            nome_arquivo,
            url,
            path_bunny,
            mime_type,
            tamanho_bytes,
            origem,
            data_criacao
        `;
  },

  deletar_galeria_imagem_empresa: () => {
    return `
        update empresa_galeria_imagem
        set ativo = false
        where id = $1
          and empresa_id = $2
        returning id, path_bunny
        `;
  },

  contar_mensagens_rapidas_por_galeria_imagem: () => {
    return `
        select count(*)::int as total
        from mensagens_rapidas
        where (galeria_imagem_id = $1 or (jsonb_typeof(ordem_midias) = 'object' and (
          exists (select 1 from jsonb_array_elements(coalesce(ordem_midias->'images', '[]'::jsonb)) item where (item->>'id')::bigint = $1)
          or exists (select 1 from jsonb_array_elements(coalesce(ordem_midias->'videos', '[]'::jsonb)) item where (item->>'id')::bigint = $1)
        )))
          and ativo = true
        `;
  },

  listar_mensagens_automaticas_whatsapp: () => {
    return `
        SELECT
            t.id AS tipo_id,
            t.descricao,
            m.id,
            m.texto,
            m.mensagem_complementar_texto,
            m.galeria_imagem_id,
            m.empresa_meta_param_id,
            gi.url AS galeria_imagem_url,
            gi.nome_arquivo AS galeria_imagem_nome_arquivo,
            gi.origem AS galeria_imagem_origem,
            gi.mime_type AS galeria_imagem_mime_type,
            COALESCE(m.ativo, false) AS ativo,
            CASE t.id
                WHEN 1 THEN COALESCE(empm.whatsapp_auto_message_boas_vindas_ativa, true)
                WHEN 2 THEN COALESCE(empm.whatsapp_auto_message_final_atendimento_ativa, true)
                WHEN 3 THEN COALESCE(empm.whatsapp_auto_message_nps_ativa, true)
                WHEN 4 THEN COALESCE(empm.whatsapp_auto_message_aniversario_ativa, true)
                WHEN 5 THEN COALESCE(empm.whatsapp_auto_message_inicio_atendimento_ativa, true)
                WHEN 6 THEN COALESCE(empm.whatsapp_auto_message_followup_venda_realizada_ativa, true)
                WHEN 7 THEN COALESCE(empm.whatsapp_auto_message_followup_venda_recusada_ativa, true)
                WHEN 8 THEN COALESCE((to_jsonb(empm)->>'whatsapp_auto_message_sem_resposta_6h_ativa')::boolean, false)
                ELSE true
            END AS habilitada
        FROM whatsapp_auto_message_tipo t
        LEFT JOIN LATERAL (
            SELECT
                wam.id,
                wam.texto,
                wam.mensagem_complementar_texto,
                wam.galeria_imagem_id,
                wam.ativo,
                wam.empresa_meta_param_id
            FROM whatsapp_auto_message wam
            WHERE wam.whatsapp_auto_message_tipo_id = t.id
              AND wam.empresa_id = $1
              AND (
                ($2::bigint IS NOT NULL AND (wam.empresa_meta_param_id = $2::bigint OR wam.empresa_meta_param_id IS NULL))
                OR ($2::bigint IS NULL AND wam.empresa_meta_param_id IS NULL)
              )
            ORDER BY
                CASE
                    WHEN $2::bigint IS NOT NULL AND wam.empresa_meta_param_id = $2::bigint THEN 0
                    WHEN wam.empresa_meta_param_id IS NULL THEN 1
                    ELSE 2
                END,
                wam.id DESC
            LIMIT 1
        ) m ON true
        LEFT JOIN empresa_galeria_imagem gi
          ON gi.id = m.galeria_imagem_id
         AND gi.empresa_id = $1
         AND gi.ativo = true
        LEFT JOIN empresa_meta_parans empm
          ON empm.id = $2
         AND empm.empresa_id = $1
         AND COALESCE(empm.ativo, true) = true
        WHERE t.id IN (1, 2, 3, 4, 5, 6, 7, 8)
        ORDER BY t.id
        `;
  },

  get_empresa_meta_numero_auto_message_toggles: () => {
    return `
        SELECT
            id,
            empresa_id,
            COALESCE(whatsapp_auto_message_boas_vindas_ativa, true) AS whatsapp_auto_message_boas_vindas_ativa,
            COALESCE(whatsapp_auto_message_final_atendimento_ativa, true) AS whatsapp_auto_message_final_atendimento_ativa,
            COALESCE(whatsapp_auto_message_nps_ativa, true) AS whatsapp_auto_message_nps_ativa,
            COALESCE(whatsapp_auto_message_aniversario_ativa, true) AS whatsapp_auto_message_aniversario_ativa,
            COALESCE(whatsapp_auto_message_inicio_atendimento_ativa, true) AS whatsapp_auto_message_inicio_atendimento_ativa,
            COALESCE(whatsapp_auto_message_followup_venda_realizada_ativa, true) AS whatsapp_auto_message_followup_venda_realizada_ativa,
            COALESCE(whatsapp_auto_message_followup_venda_recusada_ativa, true) AS whatsapp_auto_message_followup_venda_recusada_ativa,
            COALESCE((to_jsonb(empresa_meta_parans)->>'whatsapp_auto_message_sem_resposta_6h_ativa')::boolean, false) AS whatsapp_auto_message_sem_resposta_6h_ativa
        FROM empresa_meta_parans
        WHERE id = $1
          AND empresa_id = $2
          AND COALESCE(ativo, true) = true
        LIMIT 1
        `;
  },

  update_empresa_meta_numero_auto_message_toggle: () => {
    return `
        UPDATE empresa_meta_parans
        SET
            whatsapp_auto_message_boas_vindas_ativa =
                CASE WHEN $3::integer = 1 THEN $4 ELSE COALESCE(whatsapp_auto_message_boas_vindas_ativa, true) END,
            whatsapp_auto_message_final_atendimento_ativa =
                CASE WHEN $3::integer = 2 THEN $4 ELSE COALESCE(whatsapp_auto_message_final_atendimento_ativa, true) END,
            whatsapp_auto_message_nps_ativa =
                CASE WHEN $3::integer = 3 THEN $4 ELSE COALESCE(whatsapp_auto_message_nps_ativa, true) END,
            whatsapp_auto_message_aniversario_ativa =
                CASE WHEN $3::integer = 4 THEN $4 ELSE COALESCE(whatsapp_auto_message_aniversario_ativa, true) END,
            whatsapp_auto_message_inicio_atendimento_ativa =
                CASE WHEN $3::integer = 5 THEN $4 ELSE COALESCE(whatsapp_auto_message_inicio_atendimento_ativa, true) END,
            whatsapp_auto_message_followup_venda_realizada_ativa =
                CASE WHEN $3::integer = 6 THEN $4 ELSE COALESCE(whatsapp_auto_message_followup_venda_realizada_ativa, true) END,
            whatsapp_auto_message_followup_venda_recusada_ativa =
                CASE WHEN $3::integer = 7 THEN $4 ELSE COALESCE(whatsapp_auto_message_followup_venda_recusada_ativa, true) END,
            whatsapp_auto_message_sem_resposta_6h_ativa =
                CASE WHEN $3::integer = 8 THEN $4 ELSE COALESCE(whatsapp_auto_message_sem_resposta_6h_ativa, false) END
        WHERE id = $1
          AND empresa_id = $2
          AND COALESCE(ativo, true) = true
        RETURNING
            id,
            empresa_id,
            CASE $3::integer
                WHEN 1 THEN COALESCE(whatsapp_auto_message_boas_vindas_ativa, true)
                WHEN 2 THEN COALESCE(whatsapp_auto_message_final_atendimento_ativa, true)
                WHEN 3 THEN COALESCE(whatsapp_auto_message_nps_ativa, true)
                WHEN 4 THEN COALESCE(whatsapp_auto_message_aniversario_ativa, true)
                WHEN 5 THEN COALESCE(whatsapp_auto_message_inicio_atendimento_ativa, true)
                WHEN 6 THEN COALESCE(whatsapp_auto_message_followup_venda_realizada_ativa, true)
                WHEN 7 THEN COALESCE(whatsapp_auto_message_followup_venda_recusada_ativa, true)
                WHEN 8 THEN COALESCE(whatsapp_auto_message_sem_resposta_6h_ativa, false)
                ELSE true
            END AS habilitada
        `;
  },

  update_empresa_meta_numero_auto_message_toggle_legacy: () => {
    return `
        UPDATE empresa_meta_parans
        SET
            whatsapp_auto_message_boas_vindas_ativa =
                CASE WHEN $3::integer = 1 THEN $4 ELSE COALESCE(whatsapp_auto_message_boas_vindas_ativa, true) END,
            whatsapp_auto_message_final_atendimento_ativa =
                CASE WHEN $3::integer = 2 THEN $4 ELSE COALESCE(whatsapp_auto_message_final_atendimento_ativa, true) END,
            whatsapp_auto_message_nps_ativa =
                CASE WHEN $3::integer = 3 THEN $4 ELSE COALESCE(whatsapp_auto_message_nps_ativa, true) END,
            whatsapp_auto_message_aniversario_ativa =
                CASE WHEN $3::integer = 4 THEN $4 ELSE COALESCE(whatsapp_auto_message_aniversario_ativa, true) END,
            whatsapp_auto_message_inicio_atendimento_ativa =
                CASE WHEN $3::integer = 5 THEN $4 ELSE COALESCE(whatsapp_auto_message_inicio_atendimento_ativa, true) END,
            whatsapp_auto_message_followup_venda_realizada_ativa =
                CASE WHEN $3::integer = 6 THEN $4 ELSE COALESCE(whatsapp_auto_message_followup_venda_realizada_ativa, true) END,
            whatsapp_auto_message_followup_venda_recusada_ativa =
                CASE WHEN $3::integer = 7 THEN $4 ELSE COALESCE(whatsapp_auto_message_followup_venda_recusada_ativa, true) END
        WHERE id = $1
          AND empresa_id = $2
          AND COALESCE(ativo, true) = true
        RETURNING id, empresa_id
        `;
  },

  get_empresa_meta_numero_birthday_template_config: () => {
    return `
        SELECT
            empm.id AS empresa_meta_param_id,
            empm.empresa_id,
            empm.meta_display_phone_number AS display_phone_number,
            empm.meta_verified_name AS verified_name,
            empm.meta_phone_number_id AS phone_number_id,
            empm.whatsapp_account_id,
            COALESCE(empm.whatsapp_auto_message_aniversario_ativa, true) AS habilitada,
            COALESCE(empm.whatsapp_birthday_template_default_dispatch, false)
                AS is_default_dispatch_number,
            NULLIF(trim(COALESCE(empm.whatsapp_birthday_template_name, '')), '') AS template_name,
            COALESCE(NULLIF(trim(COALESCE(empm.whatsapp_birthday_template_language, '')), ''), 'pt_BR')
                AS template_language,
            to_char(
                COALESCE(empm.whatsapp_birthday_template_horario, '09:00:00'::time),
                'HH24:MI:SS'
            ) AS horario,
            NULLIF(trim(COALESCE(empm.whatsapp_birthday_template_header_media_type, '')), '')
                AS header_media_type,
            NULLIF(trim(COALESCE(empm.whatsapp_birthday_template_header_media_url, '')), '')
                AS header_media_url,
            COALESCE(empm.whatsapp_birthday_template_header_parameters, '[]'::jsonb)
                AS header_parameters,
            COALESCE(empm.whatsapp_birthday_template_body_parameters, '[]'::jsonb)
                AS body_parameters,
            COALESCE(empm.whatsapp_birthday_template_button_parameters, '[]'::jsonb)
                AS button_parameters,
            fallback.id AS default_dispatch_meta_param_id,
            fallback.meta_display_phone_number AS default_dispatch_display_phone_number
        FROM empresa_meta_parans empm
        LEFT JOIN LATERAL (
            SELECT
                empm_default.id,
                empm_default.meta_display_phone_number
            FROM empresa_meta_parans empm_default
            WHERE empm_default.empresa_id = empm.empresa_id
              AND COALESCE(empm_default.ativo, true) = true
              AND COALESCE(empm_default.whatsapp_birthday_template_default_dispatch, false) = true
            ORDER BY empm_default.id ASC
            LIMIT 1
        ) fallback ON true
        WHERE empm.id = $1
          AND empm.empresa_id = $2
          AND COALESCE(empm.ativo, true) = true
        LIMIT 1
        `;
  },

  update_empresa_meta_numero_birthday_template_config: () => {
    return `
        UPDATE empresa_meta_parans
        SET
            whatsapp_birthday_template_name = NULLIF(trim($3::text), ''),
            whatsapp_birthday_template_language =
                COALESCE(NULLIF(trim($4::text), ''), 'pt_BR'),
            whatsapp_birthday_template_horario =
                COALESCE($5::time, '09:00:00'::time),
            whatsapp_birthday_template_header_media_type =
                NULLIF(trim($6::text), ''),
            whatsapp_birthday_template_header_media_url =
                NULLIF(trim($7::text), ''),
            whatsapp_birthday_template_default_dispatch =
                COALESCE($8::boolean, false),
            whatsapp_birthday_template_header_parameters =
                COALESCE($9::jsonb, '[]'::jsonb),
            whatsapp_birthday_template_body_parameters =
                COALESCE($10::jsonb, '[]'::jsonb),
            whatsapp_birthday_template_button_parameters =
                COALESCE($11::jsonb, '[]'::jsonb)
        WHERE id = $1
          AND empresa_id = $2
          AND COALESCE(ativo, true) = true
        RETURNING
            id AS empresa_meta_param_id,
            empresa_id,
            meta_display_phone_number AS display_phone_number,
            meta_verified_name AS verified_name,
            meta_phone_number_id AS phone_number_id,
            whatsapp_account_id,
            COALESCE(whatsapp_auto_message_aniversario_ativa, true) AS habilitada,
            COALESCE(whatsapp_birthday_template_default_dispatch, false)
                AS is_default_dispatch_number,
            NULLIF(trim(COALESCE(whatsapp_birthday_template_name, '')), '') AS template_name,
            COALESCE(NULLIF(trim(COALESCE(whatsapp_birthday_template_language, '')), ''), 'pt_BR')
                AS template_language,
            to_char(
                COALESCE(whatsapp_birthday_template_horario, '09:00:00'::time),
                'HH24:MI:SS'
            ) AS horario,
            NULLIF(trim(COALESCE(whatsapp_birthday_template_header_media_type, '')), '')
                AS header_media_type,
            NULLIF(trim(COALESCE(whatsapp_birthday_template_header_media_url, '')), '')
                AS header_media_url,
            COALESCE(whatsapp_birthday_template_header_parameters, '[]'::jsonb)
                AS header_parameters,
            COALESCE(whatsapp_birthday_template_body_parameters, '[]'::jsonb)
                AS body_parameters,
            COALESCE(whatsapp_birthday_template_button_parameters, '[]'::jsonb)
                AS button_parameters,
            (
                SELECT empm_default.id
                FROM empresa_meta_parans empm_default
                WHERE empm_default.empresa_id = empresa_meta_parans.empresa_id
                  AND COALESCE(empm_default.ativo, true) = true
                  AND COALESCE(empm_default.whatsapp_birthday_template_default_dispatch, false) = true
                ORDER BY empm_default.id ASC
                LIMIT 1
            ) AS default_dispatch_meta_param_id,
            (
                SELECT empm_default.meta_display_phone_number
                FROM empresa_meta_parans empm_default
                WHERE empm_default.empresa_id = empresa_meta_parans.empresa_id
                  AND COALESCE(empm_default.ativo, true) = true
                  AND COALESCE(empm_default.whatsapp_birthday_template_default_dispatch, false) = true
                ORDER BY empm_default.id ASC
                LIMIT 1
            ) AS default_dispatch_display_phone_number
        `;
  },

  clear_empresa_birthday_template_default_dispatch: () => {
    return `
        UPDATE empresa_meta_parans
        SET whatsapp_birthday_template_default_dispatch = false
        WHERE empresa_id = $1
          AND COALESCE(ativo, true) = true
          AND id <> $2
        `;
  },

  list_empresa_meta_numeros_birthday_template_configs_for_processing: () => {
    return `
        SELECT
            empm.id AS empresa_meta_param_id,
            empm.empresa_id,
            empm.meta_display_phone_number AS display_phone_number,
            empm.meta_verified_name AS verified_name,
            empm.meta_phone_number_id AS phone_number_id,
            empm.whatsapp_account_id,
            COALESCE(empm.whatsapp_birthday_template_default_dispatch, false)
                AS is_default_dispatch_number,
            NULLIF(trim(COALESCE(empm.whatsapp_birthday_template_name, '')), '') AS template_name,
            COALESCE(NULLIF(trim(COALESCE(empm.whatsapp_birthday_template_language, '')), ''), 'pt_BR')
                AS template_language,
            to_char(
                COALESCE(empm.whatsapp_birthday_template_horario, '09:00:00'::time),
                'HH24:MI:SS'
            ) AS horario,
            NULLIF(trim(COALESCE(empm.whatsapp_birthday_template_header_media_type, '')), '')
                AS header_media_type,
            NULLIF(trim(COALESCE(empm.whatsapp_birthday_template_header_media_url, '')), '')
                AS header_media_url,
            COALESCE(empm.whatsapp_birthday_template_header_parameters, '[]'::jsonb)
                AS header_parameters,
            COALESCE(empm.whatsapp_birthday_template_body_parameters, '[]'::jsonb)
                AS body_parameters,
            COALESCE(empm.whatsapp_birthday_template_button_parameters, '[]'::jsonb)
                AS button_parameters,
            COALESCE(empm.whatsapp_auto_message_aniversario_ativa, true) AS habilitada
        FROM empresa_meta_parans empm
        LEFT JOIN LATERAL (
            SELECT
                ea.assinatura_id
            FROM empresa_assinatura ea
            WHERE ea.empresa_id = empm.empresa_id
              AND ea.ativo = true
              AND ea.validade >= current_date
            ORDER BY ea.id DESC
            LIMIT 1
        ) plano ON true
        WHERE COALESCE(empm.ativo, true) = true
          AND COALESCE(empm.whatsapp_auto_message_aniversario_ativa, true) = true
          AND COALESCE(plano.assinatura_id, 0) >= $1
          AND NULLIF(trim(COALESCE(empm.whatsapp_birthday_template_name, '')), '') IS NOT NULL
        ORDER BY empm.empresa_id ASC, empm.id ASC
        `;
  },

  get_empresa_meta_numero_sales_followup_template_config: (automationType) => {
    const config = getSalesFollowupTemplateSqlConfig(automationType);
    if (!config) {
      throw new Error("Tipo de automacao de follow-up invalido para leitura.");
    }

    return `
        SELECT
${buildSalesFollowupTemplateConfigProjection(config)}
            ,
            fallback.id AS default_dispatch_meta_param_id,
            fallback.meta_display_phone_number AS default_dispatch_display_phone_number
        FROM empresa_meta_parans empm
        LEFT JOIN LATERAL (
            SELECT
                empm_default.id,
                empm_default.meta_display_phone_number
            FROM empresa_meta_parans empm_default
            WHERE empm_default.empresa_id = empm.empresa_id
              AND COALESCE(empm_default.ativo, true) = true
              AND COALESCE(empm_default.${config.defaultDispatchColumn}, false) = true
            ORDER BY empm_default.id ASC
            LIMIT 1
        ) fallback ON true
        WHERE empm.id = $1
          AND empm.empresa_id = $2
          AND COALESCE(empm.ativo, true) = true
        LIMIT 1
        `;
  },

  update_empresa_meta_numero_sales_followup_template_config: (automationType) => {
    const config = getSalesFollowupTemplateSqlConfig(automationType);
    if (!config) {
      throw new Error("Tipo de automacao de follow-up invalido para escrita.");
    }

    return `
        UPDATE empresa_meta_parans
        SET
            ${config.templateNameColumn} = NULLIF(trim($3::text), ''),
            ${config.templateLanguageColumn} =
                COALESCE(NULLIF(trim($4::text), ''), 'pt_BR'),
            ${config.scheduleColumn} =
                COALESCE($5::time, '09:00:00'::time),
            ${config.delayDaysColumn} =
                GREATEST(COALESCE($6::integer, 3), 0),
            ${config.headerMediaTypeColumn} =
                NULLIF(trim($7::text), ''),
            ${config.headerMediaUrlColumn} =
                NULLIF(trim($8::text), ''),
            ${config.defaultDispatchColumn} =
                COALESCE($9::boolean, false),
            ${config.headerParametersColumn} =
                COALESCE($10::jsonb, '[]'::jsonb),
            ${config.bodyParametersColumn} =
                COALESCE($11::jsonb, '[]'::jsonb),
            ${config.buttonParametersColumn} =
                COALESCE($12::jsonb, '[]'::jsonb)
        WHERE id = $1
          AND empresa_id = $2
          AND COALESCE(ativo, true) = true
        RETURNING
${buildSalesFollowupTemplateConfigProjection(config, "empresa_meta_parans")}
            ,
${buildSalesFollowupTemplateFallbackProjection(config)}
        `;
  },

  clear_empresa_sales_followup_template_default_dispatch: (automationType) => {
    const config = getSalesFollowupTemplateSqlConfig(automationType);
    if (!config) {
      throw new Error("Tipo de automacao de follow-up invalido para limpar padrao.");
    }

    return `
        UPDATE empresa_meta_parans
        SET ${config.defaultDispatchColumn} = false
        WHERE empresa_id = $1
          AND COALESCE(ativo, true) = true
          AND id <> $2
        `;
  },

  list_empresa_meta_numeros_sales_followup_template_configs_for_processing: (automationType) => {
    const config = getSalesFollowupTemplateSqlConfig(automationType);
    if (!config) {
      throw new Error("Tipo de automacao de follow-up invalido para processamento.");
    }

    return `
        SELECT
${buildSalesFollowupTemplateConfigProjection(config)}
        FROM empresa_meta_parans empm
        LEFT JOIN LATERAL (
            SELECT
                ea.assinatura_id
            FROM empresa_assinatura ea
            WHERE ea.empresa_id = empm.empresa_id
              AND ea.ativo = true
              AND ea.validade >= current_date
            ORDER BY ea.id DESC
            LIMIT 1
        ) plano ON true
        WHERE COALESCE(empm.ativo, true) = true
          AND COALESCE(empm.${config.enabledColumn}, true) = true
          AND COALESCE(plano.assinatura_id, 0) >= $1
          AND NULLIF(trim(COALESCE(empm.${config.templateNameColumn}, '')), '') IS NOT NULL
        ORDER BY empm.empresa_id ASC, empm.id ASC
        `;
  },

  list_clientes_sales_followup_por_meta_numero: (automationType) => {
    const config = getSalesFollowupTemplateSqlConfig(automationType);
    if (!config) {
      throw new Error("Tipo de automacao de follow-up invalido para listar clientes.");
    }

    return `
        WITH configuracao_atual AS (
            SELECT
                empm.id,
                COALESCE(empm.${config.defaultDispatchColumn}, false)
                    AS is_default_dispatch_number,
                GREATEST(COALESCE(empm.${config.delayDaysColumn}, 3), 0) AS delay_days
            FROM empresa_meta_parans empm
            WHERE empm.empresa_id = $1
              AND empm.id = $2
              AND COALESCE(empm.ativo, true) = true
            LIMIT 1
        ),
        ultima_conversa AS (
            SELECT DISTINCT ON (ccw.cliente_id)
                ccw.cliente_id,
                ccw.id AS conversa_id,
                ccw.empresa_meta_param_id
            FROM cliente_conversa_whats ccw
            WHERE ccw.empresa_id = $1
            ORDER BY
                ccw.cliente_id,
                COALESCE(ccw.ultima_atualizacao, ccw.data_inicio, ccw.data_fim) DESC NULLS LAST,
                ccw.id DESC
        )
        SELECT
            c.id AS cliente_id,
            c.nome AS contato_nome,
            c.telefone,
            c.email,
            c.data_aniversario,
            uc.conversa_id,
            uc.empresa_meta_param_id AS ultima_conversa_empresa_meta_param_id,
            n.id AS negocio_id,
            n.titulo AS negocio_titulo,
            n.data_fechamento_real::date AS event_date,
            e.id AS etapa_id,
            e.nome AS etapa_nome,
            e.codigo AS etapa_codigo
        FROM comercial_negocio n
        INNER JOIN cliente c
            ON c.id = n.cliente_id
        INNER JOIN comercial_etapa e
            ON e.id = n.etapa_id
        CROSS JOIN configuracao_atual cfg
        LEFT JOIN ultima_conversa uc
            ON uc.cliente_id = c.id
        WHERE n.empresa_id = $1
          AND n.ativo = true
          AND c.empresa_id = $1
          AND c.ativo = true
          AND regexp_replace(COALESCE(c.telefone, ''), '\\D', '', 'g') <> ''
          AND COALESCE(e.eh_fechamento, false) = true
          AND COALESCE(e.eh_ganho, false) = ${config.expectedGainLiteral}
          AND n.data_fechamento_real IS NOT NULL
          AND n.data_fechamento_real::date = ($3::date - cfg.delay_days)
          AND (
                uc.empresa_meta_param_id = cfg.id
                OR (
                    cfg.is_default_dispatch_number = true
                    AND (
                        uc.cliente_id IS NULL
                        OR uc.empresa_meta_param_id IS NULL
                    )
                )
          )
        ORDER BY n.data_fechamento_real ASC, c.nome ASC, c.id ASC, n.id ASC
        `;
  },

  list_clientes_aniversario_por_meta_numero: () => {
    return `
        WITH configuracao_atual AS (
            SELECT
                empm.id,
                COALESCE(empm.whatsapp_birthday_template_default_dispatch, false)
                    AS is_default_dispatch_number
            FROM empresa_meta_parans empm
            WHERE empm.empresa_id = $1
              AND empm.id = $2
              AND COALESCE(empm.ativo, true) = true
            LIMIT 1
        ),
        ultima_conversa AS (
            SELECT DISTINCT ON (ccw.cliente_id)
                ccw.cliente_id,
                ccw.id AS conversa_id,
                ccw.empresa_meta_param_id
            FROM cliente_conversa_whats ccw
            WHERE ccw.empresa_id = $1
            ORDER BY
                ccw.cliente_id,
                COALESCE(ccw.ultima_atualizacao, ccw.data_inicio, ccw.data_fim) DESC NULLS LAST,
                ccw.id DESC
        )
        SELECT
            c.id AS cliente_id,
            c.nome AS contato_nome,
            c.telefone,
            c.email,
            c.data_aniversario,
            uc.conversa_id,
            uc.empresa_meta_param_id AS ultima_conversa_empresa_meta_param_id
        FROM cliente c
        CROSS JOIN configuracao_atual cfg
        LEFT JOIN ultima_conversa uc
            ON uc.cliente_id = c.id
        WHERE c.empresa_id = $1
          AND c.ativo = true
          AND c.data_aniversario IS NOT NULL
          AND EXTRACT(MONTH FROM c.data_aniversario)::int = $3
          AND EXTRACT(DAY FROM c.data_aniversario)::int = $4
          AND regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g') <> ''
          AND (
                uc.empresa_meta_param_id = cfg.id
                OR (
                    cfg.is_default_dispatch_number = true
                    AND (
                        uc.cliente_id IS NULL
                        OR uc.empresa_meta_param_id IS NULL
                    )
                )
          )
        ORDER BY c.nome ASC, c.id ASC
        `;
  },

  claim_birthday_template_send_log: () => {
    return `
        INSERT INTO whatsapp_template_aniversario_envio (
            empresa_id,
            empresa_meta_param_id,
            cliente_id,
            referencia_data,
            template_name,
            template_language,
            numero,
            conversa_id,
            status,
            tentativas,
            lock_token,
            metadata,
            iniciado_em,
            atualizado_em
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            'processing', 1, $9, COALESCE($10::jsonb, '{}'::jsonb), now(), now()
        )
        ON CONFLICT (empresa_meta_param_id, cliente_id, referencia_data)
        DO UPDATE
        SET
            template_name = EXCLUDED.template_name,
            template_language = EXCLUDED.template_language,
            numero = EXCLUDED.numero,
            conversa_id = EXCLUDED.conversa_id,
            status = 'processing',
            tentativas = COALESCE(whatsapp_template_aniversario_envio.tentativas, 0) + 1,
            lock_token = EXCLUDED.lock_token,
            erro_mensagem = NULL,
            metadata =
                COALESCE(whatsapp_template_aniversario_envio.metadata, '{}'::jsonb)
                || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
            iniciado_em = now(),
            processado_em = NULL,
            atualizado_em = now()
        WHERE NOT (
                whatsapp_template_aniversario_envio.status = 'sent'
                AND COALESCE(whatsapp_template_aniversario_envio.mensagem_whats_id, '') <> ''
            )
          AND (
                whatsapp_template_aniversario_envio.status <> 'processing'
                OR whatsapp_template_aniversario_envio.atualizado_em < now() - interval '30 minutes'
                OR whatsapp_template_aniversario_envio.lock_token = $9
            )
        RETURNING
            id,
            empresa_id,
            empresa_meta_param_id,
            cliente_id,
            referencia_data,
            template_name,
            template_language,
            numero,
            conversa_id,
            status,
            tentativas,
            lock_token,
            mensagem_whats_id,
            erro_mensagem,
            metadata,
            iniciado_em,
            processado_em,
            atualizado_em
        `;
  },

  mark_birthday_template_send_log_sent: () => {
    return `
        UPDATE whatsapp_template_aniversario_envio
        SET
            status = 'sent',
            mensagem_whats_id = $3,
            erro_mensagem = NULL,
            metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($4::jsonb, '{}'::jsonb),
            processado_em = now(),
            atualizado_em = now()
        WHERE id = $1
          AND lock_token = $2
        RETURNING
            id,
            empresa_id,
            empresa_meta_param_id,
            cliente_id,
            referencia_data,
            status,
            mensagem_whats_id
        `;
  },

  mark_birthday_template_send_log_error: () => {
    return `
        UPDATE whatsapp_template_aniversario_envio
        SET
            status = 'error',
            erro_mensagem = $3,
            metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($4::jsonb, '{}'::jsonb),
            processado_em = now(),
            atualizado_em = now()
        WHERE id = $1
          AND lock_token = $2
        RETURNING
            id,
            empresa_id,
            empresa_meta_param_id,
            cliente_id,
            referencia_data,
            status,
            erro_mensagem
        `;
  },

  claim_sales_followup_template_send_log: () => {
    return `
        INSERT INTO whatsapp_template_followup_venda_envio (
            automacao_tipo,
            empresa_id,
            empresa_meta_param_id,
            cliente_id,
            comercial_negocio_id,
            evento_data,
            template_name,
            template_language,
            numero,
            conversa_id,
            status,
            tentativas,
            lock_token,
            metadata,
            iniciado_em,
            atualizado_em
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            'processing', 1, $11, COALESCE($12::jsonb, '{}'::jsonb), now(), now()
        )
        ON CONFLICT (automacao_tipo, comercial_negocio_id, evento_data)
        DO UPDATE
        SET
            empresa_meta_param_id = EXCLUDED.empresa_meta_param_id,
            cliente_id = EXCLUDED.cliente_id,
            template_name = EXCLUDED.template_name,
            template_language = EXCLUDED.template_language,
            numero = EXCLUDED.numero,
            conversa_id = EXCLUDED.conversa_id,
            status = 'processing',
            tentativas = COALESCE(whatsapp_template_followup_venda_envio.tentativas, 0) + 1,
            lock_token = EXCLUDED.lock_token,
            erro_mensagem = NULL,
            metadata =
                COALESCE(whatsapp_template_followup_venda_envio.metadata, '{}'::jsonb)
                || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
            iniciado_em = now(),
            processado_em = NULL,
            atualizado_em = now()
        WHERE NOT (
                whatsapp_template_followup_venda_envio.status = 'sent'
                AND COALESCE(whatsapp_template_followup_venda_envio.mensagem_whats_id, '') <> ''
            )
          AND (
                whatsapp_template_followup_venda_envio.status <> 'processing'
                OR whatsapp_template_followup_venda_envio.atualizado_em < now() - interval '30 minutes'
                OR whatsapp_template_followup_venda_envio.lock_token = $11
            )
        RETURNING
            id,
            automacao_tipo,
            empresa_id,
            empresa_meta_param_id,
            cliente_id,
            comercial_negocio_id,
            evento_data,
            template_name,
            template_language,
            numero,
            conversa_id,
            status,
            tentativas,
            lock_token,
            mensagem_whats_id,
            erro_mensagem,
            metadata,
            iniciado_em,
            processado_em,
            atualizado_em
        `;
  },

  mark_sales_followup_template_send_log_sent: () => {
    return `
        UPDATE whatsapp_template_followup_venda_envio
        SET
            status = 'sent',
            mensagem_whats_id = $3,
            erro_mensagem = NULL,
            metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($4::jsonb, '{}'::jsonb),
            processado_em = now(),
            atualizado_em = now()
        WHERE id = $1
          AND lock_token = $2
        RETURNING
            id,
            automacao_tipo,
            empresa_id,
            empresa_meta_param_id,
            cliente_id,
            comercial_negocio_id,
            evento_data,
            status,
            mensagem_whats_id
        `;
  },

  mark_sales_followup_template_send_log_error: () => {
    return `
        UPDATE whatsapp_template_followup_venda_envio
        SET
            status = 'error',
            erro_mensagem = $3,
            metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($4::jsonb, '{}'::jsonb),
            processado_em = now(),
            atualizado_em = now()
        WHERE id = $1
          AND lock_token = $2
        RETURNING
            id,
            automacao_tipo,
            empresa_id,
            empresa_meta_param_id,
            cliente_id,
            comercial_negocio_id,
            evento_data,
            status,
            erro_mensagem
        `;
  },

  desativar_mensagem_automatica_whatsapp_por_tipo: () => {
    return `
        UPDATE whatsapp_auto_message
        SET ativo = false
        WHERE whatsapp_auto_message_tipo_id = $1
          AND empresa_id = $2
          AND (
            ($3::bigint IS NULL AND empresa_meta_param_id IS NULL)
            OR empresa_meta_param_id = $3::bigint
          )
          AND ativo = true
        `;
  },

  criar_mensagem_automatica_whatsapp: () => {
    return `
        INSERT INTO whatsapp_auto_message (
            texto,
            mensagem_complementar_texto,
            galeria_imagem_id,
            whatsapp_auto_message_tipo_id,
            empresa_id,
            empresa_meta_param_id,
            ativo
        )
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING
            id,
            texto,
            mensagem_complementar_texto,
            galeria_imagem_id,
            whatsapp_auto_message_tipo_id AS tipo_id,
            empresa_id,
            empresa_meta_param_id,
            ativo
        `;
  },

  editar_mensagem_automatica_whatsapp: () => {
    return `
        UPDATE whatsapp_auto_message
        SET
            texto = $1,
            mensagem_complementar_texto = $2,
            galeria_imagem_id = $3
        WHERE id = $4
          AND whatsapp_auto_message_tipo_id = $5
          AND empresa_id = $6
          AND (
            ($7::bigint IS NULL AND empresa_meta_param_id IS NULL)
            OR empresa_meta_param_id = $7::bigint
          )
        RETURNING
            id,
            texto,
            mensagem_complementar_texto,
            galeria_imagem_id,
            whatsapp_auto_message_tipo_id AS tipo_id,
            empresa_id,
            empresa_meta_param_id,
            ativo
        `;
  },

  deletar_mensagem_automatica_whatsapp: () => {
    return `
        UPDATE whatsapp_auto_message
        SET ativo = false
        WHERE id = $1
          AND whatsapp_auto_message_tipo_id = $2
          AND empresa_id = $3
          AND (
            ($4::bigint IS NULL AND empresa_meta_param_id IS NULL)
            OR empresa_meta_param_id = $4::bigint
          )
        RETURNING
            id,
            texto,
            mensagem_complementar_texto,
            galeria_imagem_id,
            whatsapp_auto_message_tipo_id AS tipo_id,
            empresa_id,
            empresa_meta_param_id,
            ativo
        `;
  },

  get_empresa_meta_numero_ativo_by_id: () => {
    return `
        select
            id,
            empresa_id
        from empresa_meta_parans
        where id = $1
          and empresa_id = $2
          and coalesce(ativo, true) = true
        limit 1
        `;
  },

  delete_mensagem_rapida: () => {
    return `
        update mensagens_rapidas
        set ativo = false
        where id = $1 and empresa_id = $2
        returning id
        `;
  },

  criar_mensagem_rapida: () => {
    return `
          INSERT INTO public.mensagens_rapidas (
    comando, descricao, texto, ativo, empresa_id, galeria_imagem_id, galeria_documento_id, galeria_audio_id, usar_texto_como_legenda, ordem_midias, usuario_id
  )
  VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9::jsonb, $10)
  RETURNING id;
          `;
  },

  alterar_mensagem_rapida: () => {
    return `
      update mensagens_rapidas
        set comando = $1,
            descricao = $2,
            texto = $3,
            galeria_imagem_id = $4,
            galeria_documento_id = $5,
            galeria_audio_id = $6,
            usar_texto_como_legenda = $7,
            ordem_midias = $8::jsonb,
            usuario_id = $9
        where id = $10
          and empresa_id = $11
        returning id
      `;
    },

  get_quick_message_user_context: () => {
    return `
      select id, empresa_id, coalesce(is_master, false) as is_master
      from usuario
      where id = $1 and empresa_id = $2 and ativo = true
      limit 1
    `;
  },

  get_busca_tag: () => {
    return `select id, nome as name from tag where upper(nome) like upper($1) and empresa_id = $2`;
  },

  insert_nota: () => {
    return `INSERT INTO public.cliente_anotacao(
	usuario_id, cliente_id, texto, data_criacao)
	VALUES ( $1, $2, $4, $3)
    RETURNING texto,data_criacao
    ;`;
  },

  verify_filial: () => {
    return `
        select * from empresa_filial where cnpj = $1 and empresa_id = $2
        `;
  },

  create_filial: () => {
    return `
        INSERT INTO public.empresa_filial(
	        empresa_id, nome, telefone, cnpj, logradouro, responsavel, primaria, latitude, longitude, tolerancia_metros)
	    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning id, nome as name,
        logradouro as address,
        responsavel as manager,
        telefone as contact,
        primaria as "isPrimary",
        cnpj,
        latitude,
        longitude,
        tolerancia_metros as "toleranceMeters";
        `;
  },

  listar_filial: () => {
    return `
        select 
        id,
        nome as name,
        logradouro as address,
        responsavel as manager,
        telefone as contact,
        primaria as "isPrimary",
        cnpj,
        latitude,
        longitude,
        tolerancia_metros as "toleranceMeters"
        from empresa_filial where empresa_id = $1
        `;
  },

  update_filial: () => {
    return `
            UPDATE public.empresa_filial
	SET  nome=$2, telefone=$3, logradouro=$4, responsavel = $5, primaria = $6, latitude = $7, longitude = $8, tolerancia_metros = $9
	WHERE id = $1
        returning
            id,
            nome as name,
            logradouro as address,
            responsavel as manager,
            telefone as contact,
            primaria as "isPrimary",
            cnpj,
            latitude,
            longitude,
            tolerancia_metros as "toleranceMeters";
        `;
  },

  expurgar_produtos: () => {
    return `
        delete from produto_estoque where filial_id = $1
        `;
  },

  migrate_estoque: () => {
    return `UPDATE estoque dest
SET 
    qt_estoque = dest.qt_estoque + src.qt_estoque,
    qt_vitrine = dest.qt_vitrine + src.qt_vitrine,
    ultima_att = NOW()
FROM estoque src
WHERE src.filial_id = $1       -- filial origem
  AND dest.filial_id = $2      -- filial destino
  AND dest.empresa_id = src.empresa_id
  AND dest.produto_id = src.produto_id;`;
  },

  verify_categoria: () => {
    return `
        select * from categoria where upper(nome) = upper($1) and empresa_id = $2
        `;
  },

  create_categoria: () => {
    return `
        insert into categoria (nome, empresa_id) values ($1, $2)
        returning id, nome as name
        `;
  },

  listar_categorias: () => {
    return `
        select id, nome as name from categoria where empresa_id = $1
        `;
  },

  update_categoria: () => {
    return `
        update categoria set nome = $2 where id = $1
        `;
  },

  deletar_categoria: () => {
    return `
        delete from categoria where id = $1
        `;
  },

  get_usuarios: () => {
    return `
        select
            u.id,
            u.nome as name,
            u.email,
            u.telefone,
            u.cor_atendimento,
            u.foto_perfil_url,
            u.filial_id,
            ef.nome as filial_nome,
            coalesce(u.is_master, false) as is_master,
            coalesce(u.permissoes_customizadas, '[]'::jsonb) as permissions,
            coalesce(
                json_agg(
                    distinct jsonb_build_object(
                        'id', emp.id,
                        'display_phone_number', emp.meta_display_phone_number,
                        'phone_number_id', emp.meta_phone_number_id,
                        'verified_name', emp.meta_verified_name,
                        'whatsapp_account_id', emp.whatsapp_account_id,
                        'whatsapp_account_name', emp.meta_waba_name,
                        'ativo', coalesce(emp.ativo, true)
                    )
                ) filter (where emp.id is not null and coalesce(emp.ativo, true) = true),
                '[]'::json
            ) as allowed_meta_numbers,
            coalesce(
                array_agg(distinct emp.id) filter (where emp.id is not null and coalesce(emp.ativo, true) = true),
                '{}'::int[]
            ) as allowed_meta_param_ids
        from usuario u
        left join empresa_filial ef
            on ef.id = u.filial_id
           and ef.empresa_id = u.empresa_id
        left join usuario_meta_numero umn
            on umn.usuario_id = u.id
        left join empresa_meta_parans emp
            on emp.id = umn.empresa_meta_param_id
           and emp.empresa_id = u.empresa_id
        where u.empresa_id = $1
          and u.ativo = true
        group by
            u.id,
            u.nome,
            u.email,
            u.telefone,
            u.cor_atendimento,
            u.foto_perfil_url,
            u.filial_id,
            ef.nome,
            u.is_master,
            u.permissoes_customizadas
        order by u.nome asc`;
  },

  criar_usuarios: () => {
    return `
        INSERT INTO public.usuario(
	nome, email, telefone, filial_id, senha, data_criacao, ativo, perfil_id, empresa_id, permissoes_customizadas, cor_atendimento)
	VALUES ( $1, $2, $3, $4, $5, current_date, true, $6, $7, $8, $9)
        returning id, empresa_id, coalesce(is_master, false) as is_master;
        `;
  },

  get_usuario_by_email: () => {
    return `
        select
            id,
            email,
            empresa_id
        from usuario
        where lower(email) = lower($1)
          and ativo = true
          and ($2::int is null or id <> $2)
        limit 1
        `;
  },

  get_meu_perfil: () => {
    return `
        select
            u.id,
            u.empresa_id,
            u.nome as name,
            u.email,
            u.telefone,
            u.foto_perfil_url,
            u.foto_perfil_path_bunny,
            u.foto_perfil_nome_arquivo,
            u.foto_perfil_mime_type,
            u.foto_perfil_tamanho_bytes
        from usuario u
        where u.id = $1
          and u.empresa_id = $2
          and u.ativo = true
        limit 1
        `;
  },

  update_meu_perfil: () => {
    return `
        update usuario
        set
            nome = $3,
            email = $4,
            telefone = $5
        where id = $1
          and empresa_id = $2
          and ativo = true
        returning
            id,
            empresa_id,
            nome as name,
            email,
            telefone,
            foto_perfil_url,
            foto_perfil_path_bunny,
            foto_perfil_nome_arquivo,
            foto_perfil_mime_type,
            foto_perfil_tamanho_bytes
        `;
  },

  get_usuario_senha_hash: () => {
    return `
        select
            id,
            empresa_id,
            senha
        from usuario
        where id = $1
          and empresa_id = $2
          and ativo = true
        limit 1
        `;
  },

  update_minha_senha: () => {
    return `
        update usuario
        set senha = $3
        where id = $1
          and empresa_id = $2
          and ativo = true
        returning id
        `;
  },

  desativar_minha_conta: () => {
    return `
        update usuario
        set ativo = false
        where id = $1
          and empresa_id = $2
          and ativo = true
        returning id, empresa_id
        `;
  },

  get_exclusao_conta_contexto: () => {
    return `
      select
        u.id,
        u.empresa_id,
        u.senha,
        u.nome,
        u.email,
        u.foto_perfil_path_bunny,
        coalesce(u.is_master, false) as is_master,
        (select count(*)::int from usuario ux where ux.empresa_id = u.empresa_id and ux.ativo = true) as usuarios_ativos,
        (select count(*)::int from usuario um where um.empresa_id = u.empresa_id and um.ativo = true and coalesce(um.is_master, false) = true) as masters_ativos,
        exists (
          select 1 from empresa_assinatura ea
          where ea.empresa_id = u.empresa_id
            and ea.ativo = true
            and ea.validade >= current_date
        ) as assinatura_ativa
      from usuario u
      where u.id = $1 and u.empresa_id = $2 and u.ativo = true
      limit 1
    `;
  },

  anonimizar_excluir_minha_conta: () => {
    return `
      update usuario
      set nome = 'Usuario excluido #' || id,
          email = 'excluido+' || id || '@anonimo.invalid',
          telefone = null,
          senha = $3,
          ativo = false,
          permissoes_customizadas = '[]'::jsonb,
          filial_id = null,
          cor_atendimento = null,
          foto_perfil_url = null,
          foto_perfil_path_bunny = null,
          foto_perfil_nome_arquivo = null,
          foto_perfil_mime_type = null,
          foto_perfil_tamanho_bytes = null
      where id = $1 and empresa_id = $2 and ativo = true
      returning id, empresa_id
    `;
  },

  delete_push_tokens_usuario: () => {
    return `delete from push_token where usuario_id = $1 and empresa_id = $2`;
  },

  delete_usuario_meta_numeros_exclusao: () => {
    return `delete from usuario_meta_numero where usuario_id = $1`;
  },

  update_foto_perfil_usuario: () => {
    return `
        update usuario
        set
            foto_perfil_url = $3,
            foto_perfil_path_bunny = $4,
            foto_perfil_nome_arquivo = $5,
            foto_perfil_mime_type = $6,
            foto_perfil_tamanho_bytes = $7
        where id = $1
          and empresa_id = $2
          and ativo = true
        returning
            id,
            empresa_id,
            nome as name,
            email,
            telefone,
            foto_perfil_url,
            foto_perfil_path_bunny,
            foto_perfil_nome_arquivo,
            foto_perfil_mime_type,
            foto_perfil_tamanho_bytes
        `;
  },

  limpar_foto_perfil_usuario: () => {
    return `
        update usuario
        set
            foto_perfil_url = null,
            foto_perfil_path_bunny = null,
            foto_perfil_nome_arquivo = null,
            foto_perfil_mime_type = null,
            foto_perfil_tamanho_bytes = null
        where id = $1
          and empresa_id = $2
          and ativo = true
        returning
            id,
            empresa_id,
            nome as name,
            email,
            telefone,
            foto_perfil_url,
            foto_perfil_path_bunny,
            foto_perfil_nome_arquivo,
            foto_perfil_mime_type,
            foto_perfil_tamanho_bytes
        `;
  },

  get_login_payload_by_usuario_id: () => {
    return `
        SELECT
            u.id,
            u.nome,
            u.email,
            u.telefone,
            u.ativo,
            u.empresa_id,
            u.is_master,
            u.permissoes_customizadas,
            u.foto_perfil_url,
            e.nome_fantasia as empresa,
            u.perfil_id as cargo_id,
            p.nome as cargo,
            ea.has_pdv as pdv,
            (select count(*) from usuario where empresa_id = u.empresa_id and is_master = false and ativo = true) as curr_user,
            pl.max_user,
            (select count(*) from empresa_filial where empresa_id = u.empresa_id and ativo = true) as curr_filial,
            pl.max_filial,
            ea.additional_user,
            ea.additional_filial,
            pl.max_crm,
            pl.max_leads,
            ea.additional_crm,
            ea.additional_leads,
            pl.id as id_plano,
            pl.nome as nome_plano,
            pl.permissoes as permissoes_plano
        FROM usuario u
        LEFT JOIN empresa e ON e.id = u.empresa_id
        LEFT JOIN empresa_assinatura ea ON ea.empresa_id = e.id
        LEFT JOIN assinatura pl ON pl.id = ea.assinatura_id
        LEFT JOIN perfil p on p.id = u.perfil_id
        WHERE u.id = $1
          AND u.empresa_id = $2
          AND u.ativo = true
          AND e.ativo = true
          AND ea.ativo = true
          AND ea.validade >= current_date
        ORDER BY ea.id desc
        LIMIT 1
        `;
  },

  list_empresa_meta_numeros_ativos: () => {
    return `
        select
            id,
            empresa_id,
            meta_display_phone_number as display_phone_number,
            meta_phone_number_id as phone_number_id,
            meta_verified_name as verified_name,
            whatsapp_account_id,
            meta_waba_name as whatsapp_account_name,
            coalesce(ativo, true) as ativo
        from empresa_meta_parans
        where empresa_id = $1
          and coalesce(ativo, true) = true
        order by
            meta_display_phone_number asc nulls last,
            meta_phone_number_id asc nulls last,
            id asc
        `;
  },

  get_usuario_empresa_contexto: () => {
    return `
        select
            id,
            empresa_id,
            coalesce(is_master, false) as is_master,
            coalesce(permissoes_customizadas, '[]'::jsonb) as permissoes_customizadas
        from usuario
        where id = $1
          and empresa_id = $2
          and ativo = true
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

  list_empresa_meta_numeros_validos_by_ids: () => {
    return `
        select
            id
        from empresa_meta_parans
        where empresa_id = $1
          and coalesce(ativo, true) = true
          and id = any($2::int[])
        order by id asc
        `;
  },

  get_filial_by_id_empresa: () => {
    return `
        select
            id,
            empresa_id,
            nome,
            primaria
        from empresa_filial
        where id = $1
          and empresa_id = $2
        limit 1
        `;
  },

  delete_usuario_meta_numeros: () => {
    return `
        delete from usuario_meta_numero
        where usuario_id = $1
        `;
  },

  insert_usuario_meta_numero: () => {
    return `
        insert into usuario_meta_numero (
            usuario_id,
            empresa_meta_param_id
        )
        values ($1, $2)
        on conflict (usuario_id, empresa_meta_param_id) do nothing
        returning id
        `;
  },
  deletar_usuarios: () => {
    return `
         UPDATE usuario SET ativo = false WHERE id = $1 returning empresa_id
        `;
  },

  get_dados_venda: () => {
    return `
        select
coalesce(sum(valor_venda),0)  as "totalVendas",
coalesce(count(id),0) as "totalPedidos",
coalesce(sum(valor_venda)/count(id), 0) as "ticketMedio"
from
venda
where status_venda = 'processed'
  and empresa_id = $1
  and ($2::date is null or data_venda::date >= $2::date)
  and ($3::date is null or data_venda::date <= $3::date)
  and ($4::int is null or filial_id = $4::int)
        `;
  },

  valor_estqoue: () => {
    return `
        select
sum(t1.valor_item) as "valorTotal"
from(
select
p.preco * pe.tot_it as valor_item
from produto p
left join produto_estoque pe on
pe.produto_id = p.id
where p.empresa_id = $1
  and pe.empresa_id = $1
  and ($2::int is null or pe.filial_id = $2::int)) t1
        `;
  },

  get_fornecedores: () => {
    return `
        select count(id) as "totalFornecedores" from fabricante where empresa_id = $1 
        `;
  },

  get_vendas_horas: () => {
    return `
        with filtros as (
          select
            $1::bigint as empresa_id,
            $2::date as data_inicio,
            $3::date as data_fim,
            $4::int as filial_id
        )
        select
          case
            when filtros.data_inicio is not null
              and filtros.data_fim is not null
              and filtros.data_inicio <> filtros.data_fim
            then to_char(v.data_venda, 'DD/MM')
            else to_char(v.data_venda, 'HH24:00')
          end as name,
          sum(v.valor_venda) as valor
        from venda v
        cross join filtros
        where v.empresa_id = filtros.empresa_id
          and v.status_venda = 'processed'
          and (filtros.filial_id is null or v.filial_id = filtros.filial_id)
          and (
            (
              filtros.data_inicio is null
              and filtros.data_fim is null
              and v.data_venda >= current_date
              and v.data_venda < current_date + interval '1 day'
            )
            or
            (
              (filtros.data_inicio is not null or filtros.data_fim is not null)
              and (filtros.data_inicio is null or v.data_venda::date >= filtros.data_inicio)
              and (filtros.data_fim is null or v.data_venda::date <= filtros.data_fim)
            )
          )
        group by 1
        order by min(
          case
            when filtros.data_inicio is not null
              and filtros.data_fim is not null
              and filtros.data_inicio <> filtros.data_fim
            then date_trunc('day', v.data_venda)
            else date_trunc('hour', v.data_venda)
          end
        );
        `;
  },

  get_vendas_relatorio: () => {
    return `
        select
v.id as pdv_id,
v.data_venda as data_hora,
v.valor_venda as valor_total,
coalesce(v.desconto, 0) as desconto_valor,
case
  when (coalesce(v.valor_venda, 0) + coalesce(v.desconto, 0)) > 0
    then round(((coalesce(v.desconto, 0) / (coalesce(v.valor_venda, 0) + coalesce(v.desconto, 0))) * 100)::numeric, 2)
  else 0
end as desconto_percentual,
case when v.pagamento = 'qr' then 'pix' else v.pagamento end as forma_pagamento,
case when v.status_venda = 'processed' then 'Pago' when v.status_venda = 'pending' then 'Pendente' else 'Cancelado' end as status,
v.recebido as valor_recebido,
v.troco as troco,
u.nome as nome_caixa,
'caixa ' || v.caixa_id as numero_caixa 
from 
venda v 
left join usuario u on
u.id = v.usuario_id
where v.empresa_id = $1

        `;
  },

  get_cargos: () => {
    return `
    select
    id,
    nome
    from perfil where ativo = true
    `
  },

  get_number_users: () => {
    return `
    select 
count(*) as usuarios
from usuario where empresa_id = $1
and ativo = true
and is_master = false
    `
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

  update_prompt_ia_atendimento_empresa: () => {
    return `
      UPDATE empresa
      SET prompt_ia_atendimento = $2
      WHERE id = $1
      RETURNING
        id AS empresa_id,
        COALESCE(prompt_ia_atendimento, '') AS prompt_ia_atendimento
    `;
  },

  get_plano_empresa_atual: () => {
    return `
      SELECT
        ea.assinatura_id,
        pl.nome AS nome_plano
      FROM empresa_assinatura ea
      LEFT JOIN assinatura pl
        ON pl.id = ea.assinatura_id
      WHERE ea.empresa_id = $1
        AND ea.ativo = true
        AND ea.validade >= current_date
      ORDER BY ea.id DESC
      LIMIT 1
    `;
  },

  get_dashboard_contexto_usuario: () => {
    return `
      SELECT
        u.id AS usuario_id,
        u.empresa_id,
        u.is_master,
        COALESCE(u.permissoes_customizadas, '[]'::jsonb) AS permissoes_customizadas,
        COALESCE(pl.permissoes, '[]'::jsonb) AS permissoes_plano,
        COALESCE(ea.has_pdv, false) AS has_pdv
      FROM usuario u
      LEFT JOIN LATERAL (
        SELECT
          ea.assinatura_id,
          ea.has_pdv
        FROM empresa_assinatura ea
        WHERE ea.empresa_id = u.empresa_id
          AND ea.ativo = true
          AND ea.validade >= current_date
        ORDER BY ea.id DESC
        LIMIT 1
      ) ea ON true
      LEFT JOIN assinatura pl
        ON pl.id = ea.assinatura_id
      WHERE u.id = $1
        AND u.empresa_id = $2
        AND u.ativo = true
      LIMIT 1
    `;
  },

  get_dashboard_atendimento_stats: () => {
    return `
      SELECT
        COUNT(*) FILTER (
          WHERE ccw.status_id = 0
            AND ccw.data_fim IS NULL
            AND (
              ($2::date IS NULL AND $3::date IS NULL)
              OR (
                ($2::date IS NULL OR ccw.data_inicio::date >= $2::date)
                AND ($3::date IS NULL OR ccw.data_inicio::date <= $3::date)
              )
            )
        ) AS fila_espera,
        COUNT(*) FILTER (
          WHERE ccw.status_id = 1
            AND ccw.data_fim IS NULL
            AND (
              ($2::date IS NULL AND $3::date IS NULL)
              OR (
                ($2::date IS NULL OR ccw.data_inicio::date >= $2::date)
                AND ($3::date IS NULL OR ccw.data_inicio::date <= $3::date)
              )
            )
        ) AS ativos,
        COUNT(*) FILTER (
          WHERE ccw.status_id = 2
            AND (
              ($2::date IS NULL AND $3::date IS NULL)
              OR (
                ($2::date IS NULL OR ccw.data_inicio::date >= $2::date)
                AND ($3::date IS NULL OR ccw.data_inicio::date <= $3::date)
              )
            )
        ) AS finalizados,
        COUNT(DISTINCT c.id) FILTER (
          WHERE (
            (
              $2::date IS NULL
              AND $3::date IS NULL
              AND c.data_cadastro >= current_date - interval '30 day'
            )
            OR (
              ($2::date IS NOT NULL OR $3::date IS NOT NULL)
              AND ($2::date IS NULL OR c.data_cadastro::date >= $2::date)
              AND ($3::date IS NULL OR c.data_cadastro::date <= $3::date)
            )
          )
        ) AS leads_30_dias
      FROM cliente_conversa_whats ccw
      INNER JOIN cliente c
        ON c.id = ccw.cliente_id
      LEFT JOIN usuario uf
        ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
      WHERE ccw.empresa_id = $1
        AND ($4::int IS NULL OR uf.filial_id = $4::int)
    `;
  },

  get_dashboard_top_tags: () => {
    return `
      SELECT
        t.nome AS name,
        COUNT(*)::int AS count
      FROM cliente_tag ct
      INNER JOIN tag t
        ON t.id = ct.tag_id
      INNER JOIN cliente c
        ON c.id = ct.cliente_id
      WHERE c.empresa_id = $1
        and ($2::date is null or c.data_cadastro::date >= $2::date)
        and ($3::date is null or c.data_cadastro::date <= $3::date)
        and (
          $4::int is null
          or exists (
            select 1
            from cliente_conversa_whats ccw
            inner join usuario uf
              on uf.id = coalesce(ccw.usuario_id, ccw.usuario_atribuido_id)
            where ccw.empresa_id = c.empresa_id
              and ccw.cliente_id = c.id
              and uf.filial_id = $4::int
          )
        )
      GROUP BY t.nome
      ORDER BY count DESC, t.nome ASC
      LIMIT 7
    `;
  },

  get_dashboard_tempo_medio_atendimento: () => {
    return `
      WITH base AS (
        SELECT
          ccw.data_inicio,
          CASE
            WHEN ccw.data_fim IS NOT NULL AND ccw.data_fim >= ccw.data_inicio THEN ccw.data_fim
            WHEN ccw.ultima_atualizacao IS NOT NULL AND ccw.ultima_atualizacao >= ccw.data_inicio THEN ccw.ultima_atualizacao
            ELSE NULL
          END AS data_fim_corrigida
        FROM cliente_conversa_whats ccw
        INNER JOIN cliente c
          ON c.id = ccw.cliente_id
        LEFT JOIN usuario uf
          ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
        WHERE ccw.empresa_id = $1
          AND ccw.status_id = 2
          AND ccw.usuario_id IS NOT NULL
          AND ccw.data_inicio IS NOT NULL
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
          AND (
            (
              $2::date IS NULL
              AND $3::date IS NULL
              AND ccw.data_inicio >= current_date - interval '30 day'
            )
            OR (
              ($2::date IS NOT NULL OR $3::date IS NOT NULL)
              AND ($2::date IS NULL OR ccw.data_inicio::date >= $2::date)
              AND ($3::date IS NULL OR ccw.data_inicio::date <= $3::date)
            )
          )
      )
      SELECT
        COALESCE(
          AVG(
            EXTRACT(EPOCH FROM (base.data_fim_corrigida - base.data_inicio)) / 60.0
          ),
          0
        ) AS tempo_medio_minutos
      FROM base
      WHERE base.data_fim_corrigida IS NOT NULL
    `;
  },

  get_dashboard_atendimento_por_usuario: () => {
    return `
      WITH base AS (
        SELECT
          ccw.*,
          CASE
            WHEN ccw.data_fim IS NOT NULL AND ccw.data_fim >= ccw.data_inicio THEN ccw.data_fim
            WHEN ccw.ultima_atualizacao IS NOT NULL AND ccw.ultima_atualizacao >= ccw.data_inicio THEN ccw.ultima_atualizacao
            ELSE NULL
          END AS data_fim_corrigida
        FROM cliente_conversa_whats ccw
        INNER JOIN cliente c
          ON c.id = ccw.cliente_id
        LEFT JOIN usuario uf
          ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
        WHERE ccw.empresa_id = $1
          AND ccw.usuario_id IS NOT NULL
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
          AND (
            (
              $2::date IS NULL
              AND $3::date IS NULL
              AND ccw.data_inicio >= current_date - interval '30 day'
            )
            OR (
              ($2::date IS NOT NULL OR $3::date IS NOT NULL)
              AND ($2::date IS NULL OR ccw.data_inicio::date >= $2::date)
              AND ($3::date IS NULL OR ccw.data_inicio::date <= $3::date)
            )
          )
      )
      SELECT
        u.id AS usuario_id,
        u.nome AS usuario_nome,
        COUNT(*)::int AS total_atendimentos,
        COUNT(*) FILTER (WHERE base.status_id = 1 AND base.data_fim IS NULL)::int AS ativos,
        COUNT(*) FILTER (WHERE base.status_id = 2)::int AS finalizados,
        COALESCE(
          AVG(
            EXTRACT(EPOCH FROM (base.data_fim_corrigida - base.data_inicio)) / 60.0
          ) FILTER (
            WHERE base.status_id = 2
              AND base.data_inicio IS NOT NULL
              AND base.data_fim_corrigida IS NOT NULL
          ),
          0
        ) AS tempo_medio_minutos
      FROM base
      INNER JOIN usuario u
        ON u.id = base.usuario_id
      GROUP BY u.id, u.nome
      ORDER BY total_atendimentos DESC, u.nome ASC
    `;
  },

  get_dashboard_documentos_cliente_por_atendente: () => {
    return `
      WITH base AS (
        SELECT
          cd.id,
          cd.usuario_id,
          cd.data_criacao
        FROM cliente_documento cd
        INNER JOIN cliente c
          ON c.id = cd.cliente_id
        LEFT JOIN usuario uf
          ON uf.id = cd.usuario_id
        WHERE cd.empresa_id = $1
          AND cd.ativo = true
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
          AND (
            (
              $2::date IS NULL
              AND $3::date IS NULL
              AND cd.data_criacao >= current_date - interval '30 day'
            )
            OR (
              ($2::date IS NOT NULL OR $3::date IS NOT NULL)
              AND ($2::date IS NULL OR cd.data_criacao::date >= $2::date)
              AND ($3::date IS NULL OR cd.data_criacao::date <= $3::date)
            )
          )
      )
      SELECT
        base.usuario_id,
        u.nome AS usuario_nome,
        COUNT(*)::int AS total_documentos
      FROM base
      LEFT JOIN usuario u
        ON u.id = base.usuario_id
      GROUP BY base.usuario_id, u.nome
      ORDER BY total_documentos DESC, u.nome ASC NULLS LAST, base.usuario_id ASC NULLS LAST
    `;
  },

  get_dashboard_ultimos_clientes_novos: () => {
    return `
      SELECT
        c.id AS cliente_id,
        c.nome AS cliente_nome,
        c.telefone AS cliente_telefone,
        c.email AS cliente_email,
        c.data_cadastro
      FROM cliente c
      WHERE c.empresa_id = $1
        AND c.ativo = true
        and ($2::date is null or c.data_cadastro::date >= $2::date)
        and ($3::date is null or c.data_cadastro::date <= $3::date)
        and (
          $4::int is null
          or exists (
            select 1
            from cliente_conversa_whats ccw
            inner join usuario uf
              on uf.id = coalesce(ccw.usuario_id, ccw.usuario_atribuido_id)
            where ccw.empresa_id = c.empresa_id
              and ccw.cliente_id = c.id
              and uf.filial_id = $4::int
          )
        )
      ORDER BY c.data_cadastro DESC, c.id DESC
      LIMIT 10
    `;
  },

  get_dashboard_nps_geral: () => {
    return `
      WITH nota_por_atendimento AS (
        SELECT
          nr.atendimento_id,
          AVG(nr.nota)::numeric AS nota_media
        FROM nps_resposta nr
        INNER JOIN cliente_conversa_whats ccw
          ON ccw.id = nr.atendimento_id
        INNER JOIN cliente c
          ON c.id = ccw.cliente_id
        LEFT JOIN usuario uf
          ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
        WHERE nr.empresa_id = $1
          AND ccw.empresa_id = $1
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
          AND (
            (
              $2::date IS NULL
              AND $3::date IS NULL
              AND ccw.data_inicio >= current_date - interval '30 day'
            )
            OR (
              ($2::date IS NOT NULL OR $3::date IS NOT NULL)
              AND ($2::date IS NULL OR ccw.data_inicio::date >= $2::date)
              AND ($3::date IS NULL OR ccw.data_inicio::date <= $3::date)
            )
          )
        GROUP BY nr.atendimento_id
      )
      SELECT
        COUNT(*)::int AS total_avaliacoes,
        COUNT(*) FILTER (WHERE nota_media >= 9)::int AS promotores,
        COUNT(*) FILTER (WHERE nota_media BETWEEN 7 AND 8)::int AS neutros,
        COUNT(*) FILTER (WHERE nota_media <= 6)::int AS detratores,
        COALESCE(AVG(nota_media), 0)::numeric AS media_nota,
        COALESCE(
          ((COUNT(*) FILTER (WHERE nota_media >= 9)::numeric
            - COUNT(*) FILTER (WHERE nota_media <= 6)::numeric)
            / NULLIF(COUNT(*)::numeric, 0)) * 100,
          0
        )::numeric AS nps_geral
      FROM nota_por_atendimento
    `;
  },

  get_dashboard_nps_media_ultimos_5_atendimentos: () => {
    return `
      WITH nota_por_atendimento AS (
        SELECT
          nr.atendimento_id,
          MAX(nr.data_resposta) AS data_referencia,
          AVG(nr.nota)::numeric AS nota_media
        FROM nps_resposta nr
        INNER JOIN cliente_conversa_whats ccw
          ON ccw.id = nr.atendimento_id
        INNER JOIN cliente c
          ON c.id = ccw.cliente_id
        LEFT JOIN usuario uf
          ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
        WHERE nr.empresa_id = $1
          AND ccw.empresa_id = $1
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
          AND (
            ($2::date IS NULL AND $3::date IS NULL)
            OR (
              ($2::date IS NULL OR ccw.data_inicio::date >= $2::date)
              AND ($3::date IS NULL OR ccw.data_inicio::date <= $3::date)
            )
          )
        GROUP BY nr.atendimento_id
      ),
      ultimos_5 AS (
        SELECT *
        FROM nota_por_atendimento
        ORDER BY data_referencia DESC, atendimento_id DESC
        LIMIT 5
      )
      SELECT
        COUNT(*)::int AS total_atendimentos_considerados,
        COALESCE(AVG(nota_media), 0)::numeric AS media_nota_ultimos_5
      FROM ultimos_5
    `;
  },

  get_dashboard_nps_por_atendente: () => {
    return `
      WITH nota_por_atendimento AS (
        SELECT
          nr.atendimento_id,
          ccw.usuario_id,
          AVG(nr.nota)::numeric AS nota_media
        FROM nps_resposta nr
        INNER JOIN cliente_conversa_whats ccw
          ON ccw.id = nr.atendimento_id
        INNER JOIN cliente c
          ON c.id = ccw.cliente_id
        LEFT JOIN usuario uf
          ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
        WHERE nr.empresa_id = $1
          AND ccw.empresa_id = $1
          AND ccw.usuario_id IS NOT NULL
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
          AND (
            (
              $2::date IS NULL
              AND $3::date IS NULL
              AND ccw.data_inicio >= current_date - interval '30 day'
            )
            OR (
              ($2::date IS NOT NULL OR $3::date IS NOT NULL)
              AND ($2::date IS NULL OR ccw.data_inicio::date >= $2::date)
              AND ($3::date IS NULL OR ccw.data_inicio::date <= $3::date)
            )
          )
        GROUP BY nr.atendimento_id, ccw.usuario_id
      )
      SELECT
        u.id AS usuario_id,
        u.nome AS usuario_nome,
        COUNT(*)::int AS total_avaliacoes,
        COALESCE(AVG(npa.nota_media), 0)::numeric AS media_nota,
        COUNT(*) FILTER (WHERE npa.nota_media >= 9)::int AS promotores,
        COUNT(*) FILTER (WHERE npa.nota_media BETWEEN 7 AND 8)::int AS neutros,
        COUNT(*) FILTER (WHERE npa.nota_media <= 6)::int AS detratores,
        COALESCE(
          ((COUNT(*) FILTER (WHERE npa.nota_media >= 9)::numeric
            - COUNT(*) FILTER (WHERE npa.nota_media <= 6)::numeric)
            / NULLIF(COUNT(*)::numeric, 0)) * 100,
          0
        )::numeric AS nps
      FROM nota_por_atendimento npa
      INNER JOIN usuario u
        ON u.id = npa.usuario_id
      GROUP BY u.id, u.nome
      ORDER BY nps DESC, media_nota DESC, u.nome ASC
    `;
  },

  get_dashboard_nps_notas_ultimos_5_por_pergunta: () => {
    return `
      WITH ultimos_5 AS (
        SELECT
          ccw.id AS atendimento_id,
          ccw.usuario_id,
          ccw.data_fim,
          MAX(nr.data_resposta) AS data_resposta_referencia
        FROM cliente_conversa_whats ccw
        INNER JOIN nps_resposta nr
          ON nr.atendimento_id = ccw.id
        INNER JOIN cliente c
          ON c.id = ccw.cliente_id
        LEFT JOIN usuario uf
          ON uf.id = COALESCE(ccw.usuario_id, ccw.usuario_atribuido_id)
        WHERE ccw.empresa_id = $1
          AND nr.empresa_id = $1
          AND ($4::int IS NULL OR uf.filial_id = $4::int)
          AND (
            ($2::date IS NULL AND $3::date IS NULL)
            OR (
              ($2::date IS NULL OR ccw.data_inicio::date >= $2::date)
              AND ($3::date IS NULL OR ccw.data_inicio::date <= $3::date)
            )
          )
        GROUP BY ccw.id, ccw.usuario_id, ccw.data_fim
        ORDER BY data_resposta_referencia DESC, ccw.id DESC
        LIMIT 5
      )
      SELECT
        u5.atendimento_id,
        u5.data_fim,
        u.id AS atendente_id,
        u.nome AS atendente_nome,
        nr.pergunta_id,
        np.pergunta,
        nr.nota,
        nr.resposta_texto,
        nr.data_resposta
      FROM ultimos_5 u5
      INNER JOIN nps_resposta nr
        ON nr.atendimento_id = u5.atendimento_id
      LEFT JOIN nps_pergunta np
        ON np.id = nr.pergunta_id
      LEFT JOIN usuario u
        ON u.id = u5.usuario_id
      WHERE nr.empresa_id = $1
      ORDER BY u5.data_resposta_referencia DESC, u5.atendimento_id DESC, nr.pergunta_id ASC
    `;
  },

  get_dashboard_crm_resumo: () => {
    return `
      WITH base AS (
        SELECT
          n.id,
          COALESCE(e.codigo, 'waiting') AS codigo_etapa,
          COALESCE(e.eh_fechamento, false) AS eh_fechamento,
          COALESCE(n.valor_fechamento, n.valor_estimado, 0) AS valor,
          COALESCE(n.data_entrada_pipeline, n.data_criacao) AS data_inicio,
          COALESCE(
            n.data_fechamento_real,
            n.data_fechamento_prevista,
            n.data_criacao
          ) AS data_referencia
        FROM comercial_negocio n
        LEFT JOIN comercial_etapa e
          ON e.id = n.etapa_id
        LEFT JOIN comercial_crm crm
          ON crm.id = n.crm_id
        WHERE n.empresa_id = $1
          AND n.ativo = true
          AND ($4::int IS NULL OR crm.filial_id = $4::int)
      )
      SELECT
        COUNT(*) FILTER (WHERE base.eh_fechamento = false)::int AS pipeline_ativos,
        COALESCE(
          SUM(base.valor) FILTER (WHERE base.eh_fechamento = false),
          0
        )::numeric AS valor_pipeline_aberto,
        COUNT(*) FILTER (
          WHERE base.codigo_etapa = 'closed-won'
            AND (
              (
                $2::date IS NULL
                AND $3::date IS NULL
                AND base.data_referencia >= current_date - interval '30 day'
              )
              OR (
                ($2::date IS NOT NULL OR $3::date IS NOT NULL)
                AND ($2::date IS NULL OR base.data_referencia::date >= $2::date)
                AND ($3::date IS NULL OR base.data_referencia::date <= $3::date)
              )
            )
        )::int AS ganhos_30_dias,
        COUNT(*) FILTER (
          WHERE base.codigo_etapa = 'closed-lost'
            AND (
              (
                $2::date IS NULL
                AND $3::date IS NULL
                AND base.data_referencia >= current_date - interval '30 day'
              )
              OR (
                ($2::date IS NOT NULL OR $3::date IS NOT NULL)
                AND ($2::date IS NULL OR base.data_referencia::date >= $2::date)
                AND ($3::date IS NULL OR base.data_referencia::date <= $3::date)
              )
            )
        )::int AS perdidos_30_dias,
        COUNT(*) FILTER (
          WHERE base.codigo_etapa IN ('closed-won', 'closed-lost')
            AND (
              (
                $2::date IS NULL
                AND $3::date IS NULL
                AND base.data_referencia >= current_date - interval '30 day'
              )
              OR (
                ($2::date IS NOT NULL OR $3::date IS NOT NULL)
                AND ($2::date IS NULL OR base.data_referencia::date >= $2::date)
                AND ($3::date IS NULL OR base.data_referencia::date <= $3::date)
              )
            )
        )::int AS fechados_30_dias,
        COALESCE(
          SUM(base.valor) FILTER (
            WHERE base.codigo_etapa = 'closed-won'
              AND (
                (
                  $2::date IS NULL
                  AND $3::date IS NULL
                  AND base.data_referencia >= current_date - interval '30 day'
                )
                OR (
                  ($2::date IS NOT NULL OR $3::date IS NOT NULL)
                  AND ($2::date IS NULL OR base.data_referencia::date >= $2::date)
                  AND ($3::date IS NULL OR base.data_referencia::date <= $3::date)
                )
              )
          ),
          0
        )::numeric AS valor_ganho_30_dias,
        COALESCE(
          SUM(base.valor) FILTER (
            WHERE base.codigo_etapa = 'closed-lost'
              AND (
                (
                  $2::date IS NULL
                  AND $3::date IS NULL
                  AND base.data_referencia >= current_date - interval '30 day'
                )
                OR (
                  ($2::date IS NOT NULL OR $3::date IS NOT NULL)
                  AND ($2::date IS NULL OR base.data_referencia::date >= $2::date)
                  AND ($3::date IS NULL OR base.data_referencia::date <= $3::date)
                )
              )
          ),
          0
        )::numeric AS valor_perdido_30_dias,
        COALESCE(
          AVG(base.valor) FILTER (
            WHERE base.codigo_etapa = 'closed-won'
              AND (
                (
                  $2::date IS NULL
                  AND $3::date IS NULL
                  AND base.data_referencia >= current_date - interval '30 day'
                )
                OR (
                  ($2::date IS NOT NULL OR $3::date IS NOT NULL)
                  AND ($2::date IS NULL OR base.data_referencia::date >= $2::date)
                  AND ($3::date IS NULL OR base.data_referencia::date <= $3::date)
                )
              )
          ),
          0
        )::numeric AS ticket_medio_ganho_30_dias,
        COALESCE(
          AVG(
            EXTRACT(EPOCH FROM (base.data_referencia - base.data_inicio)) / 86400.0
          ) FILTER (
            WHERE base.codigo_etapa = 'closed-won'
              AND (
                (
                  $2::date IS NULL
                  AND $3::date IS NULL
                  AND base.data_referencia >= current_date - interval '30 day'
                )
                OR (
                  ($2::date IS NOT NULL OR $3::date IS NOT NULL)
                  AND ($2::date IS NULL OR base.data_referencia::date >= $2::date)
                  AND ($3::date IS NULL OR base.data_referencia::date <= $3::date)
                )
              )
              AND base.data_inicio IS NOT NULL
              AND base.data_referencia IS NOT NULL
              AND base.data_referencia >= base.data_inicio
          ),
          0
        )::numeric AS tempo_medio_fechamento_dias
      FROM base
    `;
  },

  get_dashboard_crm_funil_por_etapa: () => {
    return `
      SELECT
        COALESCE(e.codigo, 'sem-etapa') AS codigo,
        COALESCE(e.nome, 'Sem etapa') AS nome,
        MIN(e.ordem) AS ordem,
        COUNT(*)::int AS total,
        COALESCE(SUM(COALESCE(n.valor_fechamento, n.valor_estimado, 0)), 0)::numeric AS valor_total
      FROM comercial_negocio n
      LEFT JOIN comercial_etapa e
        ON e.id = n.etapa_id
      LEFT JOIN comercial_crm crm
        ON crm.id = n.crm_id
      WHERE n.empresa_id = $1
        AND n.ativo = true
        AND ($4::int IS NULL OR crm.filial_id = $4::int)
        and (
          ($2::date is null and $3::date is null)
          or (
            ($2::date is null or coalesce(n.data_entrada_pipeline, n.data_criacao)::date >= $2::date)
            and ($3::date is null or coalesce(n.data_entrada_pipeline, n.data_criacao)::date <= $3::date)
          )
        )
      GROUP BY COALESCE(e.codigo, 'sem-etapa'), COALESCE(e.nome, 'Sem etapa')
      ORDER BY MIN(e.ordem) NULLS LAST, total DESC, nome ASC
      LIMIT 10
    `;
  },

  get_dashboard_crm_top_responsaveis: () => {
    return `
      SELECT
        COALESCE(u.nome, 'Sem responsavel') AS usuario_nome,
        COUNT(*) FILTER (WHERE COALESCE(e.eh_fechamento, false) = false)::int AS pipeline_ativos,
        COUNT(*) FILTER (
          WHERE COALESCE(e.codigo, '') = 'closed-won'
            AND (
              (
                $2::date IS NULL
                AND $3::date IS NULL
                AND COALESCE(
                  n.data_fechamento_real,
                  n.data_fechamento_prevista,
                  n.data_criacao
                ) >= current_date - interval '30 day'
              )
              OR (
                ($2::date IS NOT NULL OR $3::date IS NOT NULL)
                AND (
                  $2::date IS NULL
                  OR COALESCE(
                    n.data_fechamento_real,
                    n.data_fechamento_prevista,
                    n.data_criacao
                  )::date >= $2::date
                )
                AND (
                  $3::date IS NULL
                  OR COALESCE(
                    n.data_fechamento_real,
                    n.data_fechamento_prevista,
                    n.data_criacao
                  )::date <= $3::date
                )
              )
            )
        )::int AS ganhos_30_dias,
        COALESCE(
          SUM(COALESCE(n.valor_fechamento, n.valor_estimado, 0)) FILTER (
            WHERE COALESCE(e.codigo, '') = 'closed-won'
              AND (
                (
                  $2::date IS NULL
                  AND $3::date IS NULL
                  AND COALESCE(
                    n.data_fechamento_real,
                    n.data_fechamento_prevista,
                    n.data_criacao
                  ) >= current_date - interval '30 day'
                )
                OR (
                  ($2::date IS NOT NULL OR $3::date IS NOT NULL)
                  AND (
                    $2::date IS NULL
                    OR COALESCE(
                      n.data_fechamento_real,
                      n.data_fechamento_prevista,
                      n.data_criacao
                    )::date >= $2::date
                  )
                  AND (
                    $3::date IS NULL
                    OR COALESCE(
                      n.data_fechamento_real,
                      n.data_fechamento_prevista,
                      n.data_criacao
                    )::date <= $3::date
                  )
                )
              )
          ),
          0
        )::numeric AS valor_ganho_30_dias
      FROM comercial_negocio n
      LEFT JOIN comercial_etapa e
        ON e.id = n.etapa_id
      LEFT JOIN comercial_crm crm
        ON crm.id = n.crm_id
      LEFT JOIN usuario u
        ON u.id = n.responsavel_usuario_id
      WHERE n.empresa_id = $1
        AND n.ativo = true
        AND ($4::int IS NULL OR crm.filial_id = $4::int)
      GROUP BY COALESCE(u.nome, 'Sem responsavel')
      ORDER BY ganhos_30_dias DESC, pipeline_ativos DESC, usuario_nome ASC
      LIMIT 7
    `;
  }
};

module.exports = models;
