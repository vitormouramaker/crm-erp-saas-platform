const tituloNegocioSincronizado = `
  case
    when c.id is null or nullif(btrim(c.nome), '') is null then n.titulo
    when btrim(coalesce(n.titulo, '')) = btrim(coalesce(n.nome_contato, ''))
      then btrim(c.nome)
    when btrim(coalesce(n.titulo, '')) = 'WhatsApp - ' || btrim(coalesce(n.nome_contato, ''))
      then 'WhatsApp - ' || btrim(c.nome)
    when btrim(coalesce(n.titulo, '')) = 'Orçamento - ' || btrim(coalesce(n.nome_contato, ''))
      then 'Orçamento - ' || btrim(c.nome)
    when btrim(coalesce(n.titulo, '')) = 'Orcamento - ' || btrim(coalesce(n.nome_contato, ''))
      then 'Orcamento - ' || btrim(c.nome)
    else n.titulo
  end
`;

const models = {
  get_default_crm: () => {
    return `
      select
        crm.id,
        crm.nome,
        crm.descricao,
        crm.ativo,
        crm.master,
        crm.criado_em,
        crm.filial_id,
        ef.nome as filial_nome,
        coalesce(meta.meta_numeros, '[]'::json) as meta_numeros
      from comercial_crm crm
      left join empresa_filial ef
        on ef.id = crm.filial_id
      left join lateral (
        select json_agg(
          json_build_object(
            'id', emp.id,
            'display_phone_number', emp.meta_display_phone_number,
            'verified_name', emp.meta_verified_name,
            'phone_number_id', emp.meta_phone_number_id,
            'ativo', coalesce(emp.ativo, true)
          )
          order by
            coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id) asc,
            emp.id asc
        ) as meta_numeros
        from comercial_crm_meta_numero cmm
        inner join empresa_meta_parans emp
          on emp.id = cmm.empresa_meta_param_id
        where cmm.crm_id = crm.id
      ) meta on true
      where crm.empresa_id = $1
        and crm.ativo = true
      order by crm.master desc, crm.id
      limit 1
    `;
  },

  list_crms: () => {
    return `
      select
        crm.id,
        crm.nome,
        crm.descricao,
        crm.ativo,
        crm.master,
        crm.criado_em,
        crm.filial_id,
        crm.automacao_etapa_atendimento_iniciado_id,
        crm.automacao_etapa_orcamento_enviado_id,
        crm.financeiro_gerar_conta_receber,
        crm.financeiro_conta_financeira_id,
        crm.financeiro_categoria_id,
        crm.financeiro_centro_custo_id,
        crm.financeiro_empresa_grupo_id,
        crm.financeiro_vencimento_dias,
        ef.nome as filial_nome,
        coalesce(meta.meta_numeros, '[]'::json) as meta_numeros
      from comercial_crm crm
      left join empresa_filial ef
        on ef.id = crm.filial_id
      left join lateral (
        select json_agg(
          json_build_object(
            'id', emp.id,
            'display_phone_number', emp.meta_display_phone_number,
            'verified_name', emp.meta_verified_name,
            'phone_number_id', emp.meta_phone_number_id,
            'ativo', coalesce(emp.ativo, true)
          )
          order by
            coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id) asc,
            emp.id asc
        ) as meta_numeros
        from comercial_crm_meta_numero cmm
        inner join empresa_meta_parans emp
          on emp.id = cmm.empresa_meta_param_id
        where cmm.crm_id = crm.id
      ) meta on true
      where crm.empresa_id = $1
        and crm.ativo = true
      order by crm.ativo desc, crm.master desc, crm.id
    `;
  },

  ensure_crm_automation_columns: () => {
    return `
      alter table comercial_crm
      add column if not exists automacao_etapa_atendimento_iniciado_id bigint,
      add column if not exists automacao_etapa_orcamento_enviado_id bigint
    `;
  },

  list_crm_usuario_vinculos_empresa: () => {
    return `
      select
        cu.crm_id,
        cu.usuario_id,
        u.nome
      from comercial_crm_usuario cu
      inner join comercial_crm crm on crm.id = cu.crm_id
      inner join usuario u on u.id = cu.usuario_id
      where crm.empresa_id = $1
        and crm.ativo = true
        and u.empresa_id = $1
        and u.ativo = true
      order by cu.crm_id, u.nome, u.id
    `;
  },

  list_crm_usuario_vinculos_by_crm: () => {
    return `
      select
        cu.crm_id,
        cu.usuario_id,
        u.nome
      from comercial_crm_usuario cu
      inner join usuario u on u.id = cu.usuario_id
      where cu.crm_id = $1
        and u.empresa_id = $2
        and u.ativo = true
      order by u.nome, u.id
    `;
  },

  get_conversa_pipeline_access_context: () => {
    return `
      select
        ccw.id,
        ccw.empresa_id,
        ccw.cliente_id,
        ccw.usuario_id,
        ccw.usuario_atribuido_id
      from cliente_conversa_whats ccw
      where ccw.id = $1
        and ccw.empresa_id = $2
      limit 1
    `;
  },

  delete_crm_usuario_vinculos_by_crm: () => {
    return `delete from comercial_crm_usuario where crm_id = $1`;
  },

  insert_crm_usuario_vinculo: () => {
    return `
      insert into comercial_crm_usuario (crm_id, usuario_id)
      values ($1, $2)
      on conflict (crm_id, usuario_id) do nothing
    `;
  },

  delete_crm_meta_numero_vinculos_by_crm: () => {
    return `delete from comercial_crm_meta_numero where crm_id = $1`;
  },

  insert_crm_meta_numero_vinculo: () => {
    return `
      insert into comercial_crm_meta_numero (crm_id, empresa_meta_param_id)
      values ($1, $2)
      on conflict (crm_id, empresa_meta_param_id) do nothing
    `;
  },

  find_crm_by_meta_numero_id: () => {
    return `
      select
        crm.id,
        crm.nome
      from comercial_crm_meta_numero cmm
      inner join comercial_crm crm
        on crm.id = cmm.crm_id
      where crm.empresa_id = $1
        and cmm.empresa_meta_param_id = $2
        and crm.ativo = true
        and ($3::bigint is null or crm.id <> $3)
      limit 1
    `;
  },

  find_crm_by_meta_numero_entrada: () => {
    return `
      select
        crm.id,
        crm.nome,
        crm.master,
        crm.filial_id
      from comercial_crm_meta_numero cmm
      inner join comercial_crm crm
        on crm.id = cmm.crm_id
      where crm.empresa_id = $1
        and cmm.empresa_meta_param_id = $2
        and crm.ativo = true
      order by crm.master desc, crm.id asc
      limit 1
    `;
  },

  count_crms_ativos_empresa: () => {
    return `
      select count(*)::integer as total
      from comercial_crm
      where empresa_id = $1
        and ativo = true
    `;
  },

  get_limite_crm_assinatura_empresa: () => {
    return `
      select
        a.id as assinatura_id,
        a.nome as assinatura_nome,
        a.max_crm,
        ea.additional_crm,
        coalesce(a.max_crm, 0) + coalesce(ea.additional_crm, 0) as max_crm_total
      from empresa_assinatura ea
      inner join assinatura a on a.id = ea.assinatura_id
      where ea.empresa_id = $1
        and ea.ativo = true
        and ea.validade >= current_date
      order by ea.id desc
      limit 1
    `;
  },

  get_crm_by_id: () => {
    return `
      select
        crm.id,
        crm.empresa_id,
        crm.nome,
        crm.descricao,
        crm.ativo,
        crm.master,
        crm.criado_em,
        crm.filial_id,
        crm.automacao_etapa_atendimento_iniciado_id,
        crm.automacao_etapa_orcamento_enviado_id,
        crm.financeiro_gerar_conta_receber,
        crm.financeiro_conta_financeira_id,
        crm.financeiro_categoria_id,
        crm.financeiro_centro_custo_id,
        crm.financeiro_empresa_grupo_id,
        crm.financeiro_vencimento_dias,
        ef.nome as filial_nome,
        coalesce(meta.meta_numeros, '[]'::json) as meta_numeros
      from comercial_crm crm
      left join empresa_filial ef
        on ef.id = crm.filial_id
      left join lateral (
        select json_agg(
          json_build_object(
            'id', emp.id,
            'display_phone_number', emp.meta_display_phone_number,
            'verified_name', emp.meta_verified_name,
            'phone_number_id', emp.meta_phone_number_id,
            'ativo', coalesce(emp.ativo, true)
          )
          order by
            coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id) asc,
            emp.id asc
        ) as meta_numeros
        from comercial_crm_meta_numero cmm
        inner join empresa_meta_parans emp
          on emp.id = cmm.empresa_meta_param_id
        where cmm.crm_id = crm.id
      ) meta on true
      where crm.id = $1
        and crm.empresa_id = $2
      limit 1
    `;
  },

  insert_crm: () => {
    return `
      insert into comercial_crm (empresa_id, nome, descricao, filial_id, ativo, master)
      values ($1, $2, $3, $4, true, false)
      returning
        id,
        empresa_id,
        nome,
        descricao,
        filial_id,
        automacao_etapa_atendimento_iniciado_id,
        automacao_etapa_orcamento_enviado_id,
        financeiro_gerar_conta_receber,
        financeiro_conta_financeira_id,
        financeiro_categoria_id,
        financeiro_centro_custo_id,
        financeiro_empresa_grupo_id,
        financeiro_vencimento_dias,
        ativo,
        master,
        criado_em
    `;
  },

  update_crm: () => {
    return `
      update comercial_crm
      set nome = $2,
          descricao = $3,
          filial_id = $4,
          automacao_etapa_atendimento_iniciado_id = $5,
          automacao_etapa_orcamento_enviado_id = $6,
          financeiro_gerar_conta_receber = $7,
          financeiro_conta_financeira_id = $8,
          financeiro_categoria_id = $9,
          financeiro_centro_custo_id = $10,
          financeiro_empresa_grupo_id = $11,
          financeiro_vencimento_dias = $12
      where id = $1
        and empresa_id = $13
      returning
        id,
        empresa_id,
        nome,
        descricao,
        filial_id,
        automacao_etapa_atendimento_iniciado_id,
        automacao_etapa_orcamento_enviado_id,
        financeiro_gerar_conta_receber,
        financeiro_conta_financeira_id,
        financeiro_categoria_id,
        financeiro_centro_custo_id,
        financeiro_empresa_grupo_id,
        financeiro_vencimento_dias,
        ativo,
        master,
        criado_em
    `;
  },

  soft_delete_crm: () => {
    return `
      update comercial_crm
      set ativo = false
      where id = $1
        and empresa_id = $2
        and master = false
      returning id, empresa_id, nome, descricao, ativo, master, criado_em
    `;
  },

  list_etapas: () => {
    return `
      select
        id,
        crm_id,
        codigo,
        nome,
        ordem,
        cor,
        eh_inicial,
        eh_fechamento,
        eh_ganho,
        ativo
      from comercial_etapa
      where crm_id = $1
        and ativo = true
      order by ordem, id
    `;
  },

  list_formas_pagamento: () => {
    return `
      select
        id,
        empresa_id,
        codigo,
        nome,
        permite_parcelamento,
        ativo
      from comercial_forma_pagamento
      where ativo = true
        and (empresa_id = $1 or empresa_id is null)
      order by case when empresa_id = $1 then 0 else 1 end, nome
    `;
  },

  list_motivos_perda: () => {
    return `
      select
        id,
        empresa_id,
        codigo,
        nome,
        ativo
      from comercial_motivo_perda
      where ativo = true
        and (empresa_id = $1 or empresa_id is null)
      order by case when empresa_id = $1 then 0 else 1 end, nome
    `;
  },

  ensure_default_motivos_perda: () => {
    return `
      insert into comercial_motivo_perda (
        empresa_id,
        codigo,
        nome,
        ativo
      )
      select
        null::integer,
        defaults.codigo,
        defaults.nome,
        true
      from (
        values
          ('nao_possui_interesse_valor', 'Nao possui interesse - Valor'),
          ('nao_possui_interesse_data', 'Nao possui interesse - Data'),
          ('nao_possui_interesse_concorrencia', 'Nao possui interesse - Concorrencia')
      ) as defaults(codigo, nome)
      where not exists (
        select 1
        from comercial_motivo_perda motivo
        where motivo.empresa_id is null
          and motivo.codigo = defaults.codigo
      )
    `;
  },

  list_tipos_interacao: () => {
    return `
      select
        id,
        empresa_id,
        codigo,
        nome,
        coalesce(categoria, 'interacao') as categoria,
        ativo
      from comercial_tipo_interacao
      where ativo = true
        and (empresa_id = $1 or empresa_id is null)
      order by case when empresa_id = $1 then 0 else 1 end, nome
    `;
  },

  list_tags: () => {
    return `
      select id, nome, cor, ativo
      from comercial_tag
      where empresa_id = $1
        and ativo = true
      order by nome
    `;
  },

  list_produtos: () => {
    return `
      select
        cp.id,
        cp.nome,
        cp.descricao,
        cp.preco_base,
        cp.ativo,
        cp.criado_em,
        coalesce(img.imagens, '[]'::json) as imagens,
        doc.documento
      from comercial_produto cp
      left join lateral (
        select json_agg(
          json_build_object(
            'id', cpi.id,
            'url', cpi.url,
            'path_bunny', cpi.path_bunny,
            'nome_arquivo', cpi.nome_arquivo,
            'mime_type', cpi.mime_type,
            'tamanho_bytes', cpi.tamanho_bytes,
            'ordem', cpi.ordem
          )
          order by cpi.ordem asc, cpi.id asc
        ) as imagens
        from comercial_produto_imagem cpi
        where cpi.comercial_produto_id = cp.id
          and cpi.ativo = true
      ) img on true
      left join lateral (
        select json_build_object(
          'id', cpd.id,
          'url', cpd.url,
          'path_bunny', cpd.path_bunny,
          'nome_arquivo', cpd.nome_arquivo,
          'mime_type', cpd.mime_type,
          'tamanho_bytes', cpd.tamanho_bytes,
          'criado_em', cpd.criado_em
        ) as documento
        from comercial_produto_documento cpd
        where cpd.comercial_produto_id = cp.id
          and cpd.ativo = true
        order by cpd.id desc
        limit 1
      ) doc on true
      where cp.empresa_id = $1
        and cp.ativo = true
      order by cp.nome
    `;
  },

  get_produto_by_id: () => {
    return `
      select
        cp.id,
        cp.empresa_id,
        cp.nome,
        cp.descricao,
        cp.preco_base,
        cp.ativo,
        cp.criado_em,
        coalesce(img.imagens, '[]'::json) as imagens,
        doc.documento
      from comercial_produto cp
      left join lateral (
        select json_agg(
          json_build_object(
            'id', cpi.id,
            'url', cpi.url,
            'path_bunny', cpi.path_bunny,
            'nome_arquivo', cpi.nome_arquivo,
            'mime_type', cpi.mime_type,
            'tamanho_bytes', cpi.tamanho_bytes,
            'ordem', cpi.ordem
          )
          order by cpi.ordem asc, cpi.id asc
        ) as imagens
        from comercial_produto_imagem cpi
        where cpi.comercial_produto_id = cp.id
          and cpi.ativo = true
      ) img on true
      left join lateral (
        select json_build_object(
          'id', cpd.id,
          'url', cpd.url,
          'path_bunny', cpd.path_bunny,
          'nome_arquivo', cpd.nome_arquivo,
          'mime_type', cpd.mime_type,
          'tamanho_bytes', cpd.tamanho_bytes,
          'criado_em', cpd.criado_em
        ) as documento
        from comercial_produto_documento cpd
        where cpd.comercial_produto_id = cp.id
          and cpd.ativo = true
        order by cpd.id desc
        limit 1
      ) doc on true
      where cp.id = $1
        and cp.empresa_id = $2
      limit 1
    `;
  },

  list_responsaveis: () => {
    return `
      select id, nome
      from usuario
      where empresa_id = $1
        and ativo = true
      order by nome
    `;
  },

  list_filiais_empresa: () => {
    return `
      select
        id,
        nome,
        primaria,
        coalesce(ativo, true) as ativo
      from empresa_filial
      where empresa_id = $1
        and coalesce(ativo, true) = true
      order by
        coalesce(primaria, false) desc,
        nome asc,
        id asc
    `;
  },

  list_meta_numeros_empresa: () => {
    return `
      select
        emp.id,
        emp.empresa_id,
        emp.meta_display_phone_number as display_phone_number,
        emp.meta_verified_name as verified_name,
        emp.meta_phone_number_id as phone_number_id,
        coalesce(emp.ativo, true) as ativo,
        vinculo.crm_id as crm_vinculado_id,
        vinculo.crm_nome as crm_vinculado_nome
      from empresa_meta_parans emp
      left join lateral (
        select
          crm.id as crm_id,
          crm.nome as crm_nome
        from comercial_crm_meta_numero cmm
        inner join comercial_crm crm
          on crm.id = cmm.crm_id
         and crm.empresa_id = emp.empresa_id
         and crm.ativo = true
        where cmm.empresa_meta_param_id = emp.id
        order by crm.id
        limit 1
      ) vinculo on true
      where emp.empresa_id = $1
      order by
        coalesce(emp.ativo, true) desc,
        emp.meta_display_phone_number asc nulls last,
        emp.meta_phone_number_id asc nulls last,
        emp.id asc
    `;
  },

  list_origens_venda_crm: () => {
    return `
      select distinct
        trim(n.origem_venda) as valor
      from comercial_negocio n
      where n.empresa_id = $1
        and n.ativo = true
        and ($2::bigint is null or n.crm_id = $2)
        and nullif(trim(coalesce(n.origem_venda, '')), '') is not null
      order by trim(n.origem_venda) asc
    `;
  },

  search_clientes_empresa: () => {
    return `
      select
        id,
        nome,
        telefone,
        email,
        data_aniversario
      from cliente
      where empresa_id = $1
        and ativo = true
        and (
          $2::varchar is null
          or lower(coalesce(nome, '')) like lower($2)
          or lower(coalesce(telefone, '')) like lower($2)
          or lower(coalesce(email, '')) like lower($2)
        )
      order by nome, id
      limit $3
    `;
  },

  get_etapa_by_codigo: () => {
    return `
      select id, crm_id, codigo, nome, ordem, eh_fechamento, eh_ganho
      from comercial_etapa
      where crm_id = $1
        and codigo = $2
        and ativo = true
      limit 1
    `;
  },

  get_etapa_by_codigo_any: () => {
    return `
      select id, crm_id, codigo, nome, ordem, eh_inicial, eh_fechamento, eh_ganho, ativo
      from comercial_etapa
      where crm_id = $1
        and codigo = $2
      limit 1
    `;
  },

  get_etapa_by_id: () => {
    return `
      select id, crm_id, codigo, nome, ordem, eh_fechamento, eh_ganho
      from comercial_etapa
      where id = $1
      limit 1
    `;
  },

  get_etapa_by_id_and_crm: () => {
    return `
      select id, crm_id, codigo, nome, ordem, cor, eh_inicial, eh_fechamento, eh_ganho, ativo
      from comercial_etapa
      where id = $1
        and crm_id = $2
      limit 1
    `;
  },

  clear_crm_automation_stage_references: () => {
    return `
      update comercial_crm
      set
        automacao_etapa_atendimento_iniciado_id = case
          when automacao_etapa_atendimento_iniciado_id = $2 then null
          else automacao_etapa_atendimento_iniciado_id
        end,
        automacao_etapa_orcamento_enviado_id = case
          when automacao_etapa_orcamento_enviado_id = $2 then null
          else automacao_etapa_orcamento_enviado_id
        end
      where id = $1
    `;
  },

  get_etapa_by_nome_any: () => {
    return `
      select id, crm_id, codigo, nome, ordem, ativo
      from comercial_etapa
      where crm_id = $1
        and upper(nome) = upper($2)
      limit 1
    `;
  },

  get_next_ordem_etapa: () => {
    return `
      select coalesce(max(ordem), -1) + 1 as proxima_ordem
      from comercial_etapa
      where crm_id = $1
        and ativo = true
    `;
  },

  list_etapas_any: () => {
    return `
      select id, crm_id, ordem, ativo
      from comercial_etapa
      where crm_id = $1
      order by case when ativo = true then 0 else 1 end, ordem, id
    `;
  },

  move_all_etapas_to_temporary_order: () => {
    return `
      update comercial_etapa
      set ordem = ordem + $2
      where crm_id = $1
    `;
  },

  insert_etapa: () => {
    return `
      insert into comercial_etapa (
        crm_id,
        codigo,
        nome,
        ordem,
        cor,
        eh_inicial,
        eh_fechamento,
        eh_ganho,
        ativo
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, true)
      returning id, crm_id, codigo, nome, ordem, cor, eh_inicial, eh_fechamento, eh_ganho, ativo
    `;
  },

  update_etapa_meta: () => {
    return `
      update comercial_etapa
      set nome = $2,
          cor = $3
      where id = $1
        and crm_id = $4
      returning id, crm_id, codigo, nome, ordem, cor, eh_inicial, eh_fechamento, eh_ganho, ativo
    `;
  },

  update_etapa_ordem: () => {
    return `
      update comercial_etapa
      set ordem = $3
      where id = $1
        and crm_id = $2
      returning id
    `;
  },

  shift_etapas_ordem_from: () => {
    return `
      update comercial_etapa
      set ordem = ordem + 1
      where crm_id = $1
        and ativo = true
        and ordem >= $2
    `;
  },

  shift_etapas_ordem_up_range: () => {
    return `
      update comercial_etapa
      set ordem = ordem + 1
      where crm_id = $1
        and ativo = true
        and ordem >= $2
        and ordem < $3
    `;
  },

  shift_etapas_ordem_down_range: () => {
    return `
      update comercial_etapa
      set ordem = ordem - 1
      where crm_id = $1
        and ativo = true
        and ordem > $2
        and ordem <= $3
    `;
  },

  soft_delete_etapa: () => {
    return `
      update comercial_etapa
      set ativo = false
      where id = $1
        and crm_id = $2
      returning id
    `;
  },

  move_active_negocios_to_waiting: () => {
    return `
      with movidos as (
        select
          n.id,
          row_number() over (
            order by coalesce(n.posicao_kanban, 999999), n.data_entrada_pipeline, n.id
          ) - 1 as rn
        from comercial_negocio n
        inner join comercial_etapa e on e.id = n.etapa_id
        where n.crm_id = $1
          and n.etapa_id = $2
          and n.ativo = true
          and coalesce(e.eh_fechamento, false) = false
      ),
      base as (
        select coalesce(max(posicao_kanban), -1) + 1 as base_pos
        from comercial_negocio
        where crm_id = $1
          and etapa_id = $3
          and ativo = true
      )
      update comercial_negocio n
      set etapa_id = $3,
          posicao_kanban = base.base_pos + movidos.rn,
          data_fechamento_real = null
      from movidos, base
      where n.id = movidos.id
      returning n.id
    `;
  },

  get_forma_pagamento_by_codigo: () => {
    return `
      select id, empresa_id, codigo, nome, permite_parcelamento
      from comercial_forma_pagamento
      where codigo = $2
        and ativo = true
        and (empresa_id = $1 or empresa_id is null)
      order by case when empresa_id = $1 then 0 else 1 end
      limit 1
    `;
  },

  get_motivo_perda_by_codigo: () => {
    return `
      select id, empresa_id, codigo, nome
      from comercial_motivo_perda
      where codigo = $2
        and ativo = true
        and (empresa_id = $1 or empresa_id is null)
      order by case when empresa_id = $1 then 0 else 1 end
      limit 1
    `;
  },

  get_tipo_interacao_by_codigo: () => {
    return `
      select
        id,
        empresa_id,
        codigo,
        nome,
        coalesce(categoria, 'interacao') as categoria
      from comercial_tipo_interacao
      where codigo = $2
        and ativo = true
        and (empresa_id = $1 or empresa_id is null)
      order by case when empresa_id = $1 then 0 else 1 end
      limit 1
    `;
  },

  get_usuario_by_nome: () => {
    return `
      select id, nome
      from usuario
      where empresa_id = $1
        and ativo = true
        and upper(nome) = upper($2)
      limit 1
    `;
  },

  get_tag_by_nome: () => {
    return `
      select id, nome, cor
      from comercial_tag
      where empresa_id = $1
        and upper(nome) = upper($2)
      limit 1
    `;
  },

  insert_tag: () => {
    return `
      insert into comercial_tag (empresa_id, nome, cor, ativo)
      values ($1, $2, $3, true)
      returning id, nome, cor
    `;
  },

  get_produto_by_nome: () => {
    return `
      select id, nome, descricao, preco_base, ativo, criado_em
      from comercial_produto
      where empresa_id = $1
        and upper(nome) = upper($2)
      limit 1
    `;
  },

  insert_produto: () => {
    return `
      insert into comercial_produto (empresa_id, nome, descricao, preco_base, ativo)
      values ($1, $2, $3, $4, true)
      returning id, nome, descricao, preco_base
    `;
  },

  update_produto: () => {
    return `
      update comercial_produto
      set nome = $3,
          descricao = $4,
          preco_base = $5
      where id = $1
        and empresa_id = $2
      returning id, nome, descricao, preco_base, ativo, criado_em
    `;
  },

  reactivate_produto: () => {
    return `
      update comercial_produto
      set nome = $3,
          descricao = $4,
          preco_base = $5,
          ativo = true
      where id = $1
        and empresa_id = $2
      returning id, nome, descricao, preco_base, ativo, criado_em
    `;
  },

  soft_delete_produto: () => {
    return `
      update comercial_produto
      set ativo = false
      where id = $1
        and empresa_id = $2
        and ativo = true
      returning id, nome
    `;
  },

  find_cliente_by_email_or_phone: () => {
    return `
      select id, nome, telefone, email, origem
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

  insert_cliente: () => {
    return `
      insert into cliente (nome, telefone, email, ativo, empresa_id, origem)
      values ($1, $2, $3, true, $4, 'comercial')
      returning id, nome, telefone, email, origem
    `;
  },

  update_cliente: () => {
    return `
      update cliente
      set nome = $2,
          telefone = $3,
          email = $4
      where id = $1
      returning id, nome, telefone, email, origem
    `;
  },

  count_produto_imagens_ativas: () => {
    return `
      select count(*)::int as total
      from comercial_produto_imagem
      where comercial_produto_id = $1
        and empresa_id = $2
        and ativo = true
    `;
  },

  get_next_produto_imagem_ordem: () => {
    return `
      select coalesce(max(ordem), 0)::int + 1 as proxima_ordem
      from comercial_produto_imagem
      where comercial_produto_id = $1
        and empresa_id = $2
        and ativo = true
    `;
  },

  insert_produto_imagem: () => {
    return `
      insert into comercial_produto_imagem (
        comercial_produto_id,
        empresa_id,
        url,
        path_bunny,
        nome_arquivo,
        mime_type,
        tamanho_bytes,
        ordem,
        ativo
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, true)
      returning
        id,
        comercial_produto_id,
        empresa_id,
        url,
        path_bunny,
        nome_arquivo,
        mime_type,
        tamanho_bytes,
        ordem,
        ativo,
        criado_em
    `;
  },

  get_produto_imagem_by_id: () => {
    return `
      select
        id,
        comercial_produto_id,
        empresa_id,
        url,
        path_bunny,
        nome_arquivo,
        mime_type,
        tamanho_bytes,
        ordem,
        ativo,
        criado_em
      from comercial_produto_imagem
      where id = $1
        and empresa_id = $2
      limit 1
    `;
  },

  soft_delete_produto_imagem: () => {
    return `
      update comercial_produto_imagem
      set ativo = false
      where id = $1
        and empresa_id = $2
        and ativo = true
      returning id, path_bunny, url
    `;
  },

  count_produto_documentos_ativos: () => {
    return `
      select count(*)::int as total
      from comercial_produto_documento
      where comercial_produto_id = $1
        and empresa_id = $2
        and ativo = true
    `;
  },

  insert_produto_documento: () => {
    return `
      insert into comercial_produto_documento (
        comercial_produto_id,
        empresa_id,
        url,
        path_bunny,
        nome_arquivo,
        mime_type,
        tamanho_bytes,
        ativo
      )
      values ($1, $2, $3, $4, $5, $6, $7, true)
      returning
        id,
        comercial_produto_id,
        empresa_id,
        url,
        path_bunny,
        nome_arquivo,
        mime_type,
        tamanho_bytes,
        ativo,
        criado_em
    `;
  },

  get_produto_documento_by_id: () => {
    return `
      select
        id,
        comercial_produto_id,
        empresa_id,
        url,
        path_bunny,
        nome_arquivo,
        mime_type,
        tamanho_bytes,
        ativo,
        criado_em
      from comercial_produto_documento
      where id = $1
        and empresa_id = $2
      limit 1
    `;
  },

  soft_delete_produto_documento: () => {
    return `
      update comercial_produto_documento
      set ativo = false
      where id = $1
        and empresa_id = $2
        and ativo = true
      returning id, path_bunny, url, comercial_produto_id
    `;
  },

  list_produto_imagens_by_ids: () => {
    return `
      select
        id,
        comercial_produto_id,
        empresa_id,
        url,
        path_bunny,
        nome_arquivo,
        mime_type,
        tamanho_bytes,
        ordem
      from comercial_produto_imagem
      where empresa_id = $1
        and ativo = true
        and id = any($2::bigint[])
      order by ordem asc, id asc
    `;
  },

  get_cliente_by_id: () => {
    return `
      select id, nome, telefone, email
      from cliente
      where id = $1
        and empresa_id = $2
      limit 1
    `;
  },

  get_next_posicao: () => {
    return `
      select coalesce(max(posicao_kanban), -1) + 1 as proxima_posicao
      from comercial_negocio
      where crm_id = $1
        and etapa_id = $2
        and ativo = true
    `;
  },

  find_open_negocio_by_cliente_crm: () => {
    return `
      select
        n.id,
        n.cliente_id,
        n.crm_id,
        n.etapa_id,
        n.responsavel_usuario_id
      from comercial_negocio n
      inner join comercial_etapa e on e.id = n.etapa_id
      where n.empresa_id = $1
        and n.crm_id = $2
        and n.cliente_id = $3
        and n.ativo = true
        and coalesce(e.eh_fechamento, false) = false
      order by coalesce(n.data_entrada_pipeline, n.data_criacao) desc, n.id desc
      limit 1
    `;
  },

  find_open_negocio_by_cliente_any: () => {
    return `
      select
        n.id,
        n.cliente_id,
        n.crm_id,
        n.etapa_id,
        n.responsavel_usuario_id
      from comercial_negocio n
      inner join comercial_etapa e on e.id = n.etapa_id
      where n.empresa_id = $1
        and n.cliente_id = $2
        and n.ativo = true
        and coalesce(e.eh_fechamento, false) = false
      order by coalesce(n.data_entrada_pipeline, n.data_criacao) desc, n.id desc
      limit 1
    `;
  },

  insert_negocio: () => {
    return `
      insert into comercial_negocio (
        empresa_id,
        crm_id,
        cliente_id,
        responsavel_usuario_id,
        etapa_id,
        titulo,
        nome_empresa,
        nome_contato,
        telefone,
        email,
        documento,
        temperatura,
        probabilidade,
        valor_estimado,
        valor_fechamento,
        quantidade_itens,
        origem_venda,
        forma_pagamento_id,
        parcelas,
        motivo_perda_id,
        observacoes_venda,
        observacoes_perda,
        data_criacao,
        data_entrada_pipeline,
        data_fechamento_prevista,
        data_fechamento_real,
        posicao_kanban,
        ativo
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, true
      )
      returning id
    `;
  },

  update_negocio: () => {
    return `
      update comercial_negocio
      set crm_id = $2,
          cliente_id = $3,
          responsavel_usuario_id = $4,
          etapa_id = $5,
          titulo = $6,
          nome_empresa = $7,
          nome_contato = $8,
          telefone = $9,
          email = $10,
          documento = $11,
          temperatura = $12,
          probabilidade = $13,
          valor_estimado = $14,
          valor_fechamento = $15,
          quantidade_itens = $16,
          origem_venda = $17,
          forma_pagamento_id = $18,
          parcelas = $19,
          motivo_perda_id = $20,
          observacoes_venda = $21,
          observacoes_perda = $22,
          data_entrada_pipeline = $23,
          data_fechamento_prevista = $24,
          data_fechamento_real = $25,
          posicao_kanban = $26
      where id = $1
      returning id
    `;
  },

  update_negocio_etapa_posicao: () => {
    return `
      update comercial_negocio
      set etapa_id = $2,
          posicao_kanban = $3,
          data_fechamento_real = $4
      where id = $1
        and empresa_id = $5
      returning id
    `;
  },

  soft_delete_negocio: () => {
    return `
      update comercial_negocio
      set ativo = false
      where id = $1
        and empresa_id = $2
      returning id
    `;
  },

  soft_delete_negocios_by_stage: () => {
    return `
      update comercial_negocio
      set ativo = false
      where empresa_id = $1
        and crm_id = $2
        and etapa_id = $3
        and ativo = true
      returning id
    `;
  },

  update_negocio_responsavel: () => {
    return `
      update comercial_negocio
      set responsavel_usuario_id = $1
      where id = $2
        and empresa_id = $3
        and ativo = true
      returning id, responsavel_usuario_id, crm_id
    `;
  },

  update_negocios_cliente_responsavel: () => {
    return `
      update comercial_negocio n
      set responsavel_usuario_id = $1
      where n.empresa_id = $2
        and n.cliente_id = $3
        and n.ativo = true
        and exists (
          select 1
          from comercial_etapa e
          where e.id = n.etapa_id
            and coalesce(e.eh_fechamento, false) = false
        )
      returning n.id, n.responsavel_usuario_id, n.crm_id
    `;
  },

  insert_negocio_tag: () => {
    return `
      insert into comercial_negocio_tag (negocio_id, tag_id)
      values ($1, $2)
    `;
  },

  delete_negocio_tags: () => {
    return `delete from comercial_negocio_tag where negocio_id = $1`;
  },

  insert_negocio_produto: () => {
    return `
      insert into comercial_negocio_produto (
        negocio_id,
        comercial_produto_id,
        nome_produto,
        quantidade,
        preco_unitario
      )
      values ($1, $2, $3, $4, $5)
    `;
  },

  delete_negocio_produtos: () => {
    return `delete from comercial_negocio_produto where negocio_id = $1`;
  },

  get_orcamento_principal_by_negocio: () => {
    return `
      select *
      from comercial_orcamento
      where negocio_id = $1
        and empresa_id = $2
        and ativo = true
        and principal = true
      order by id desc
      limit 1
    `;
  },

  insert_orcamento: () => {
    return `
      insert into comercial_orcamento (
        empresa_id,
        negocio_id,
        titulo,
        observacoes,
        subtotal,
        desconto,
        total,
        status,
        principal,
        ativo,
        criado_em,
        atualizado_em
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, true, true, current_timestamp, current_timestamp)
      returning id
    `;
  },

  update_orcamento: () => {
    return `
      update comercial_orcamento
      set titulo = $2,
          observacoes = $3,
          subtotal = $4,
          desconto = $5,
          total = $6,
          status = $7,
          atualizado_em = current_timestamp
      where id = $1
      returning id
    `;
  },

  delete_orcamento_itens: () => {
    return `
      update comercial_orcamento_item
      set ativo = false
      where orcamento_id = $1
    `;
  },

  insert_orcamento_item: () => {
    return `
      insert into comercial_orcamento_item (
        orcamento_id,
        comercial_produto_id,
        nome_produto,
        quantidade,
        preco_unitario,
        status,
        quantidade_ganha,
        quantidade_perdida,
        ativo,
        criado_em
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, true, current_timestamp)
    `;
  },

  insert_movimentacao: () => {
    return `
      insert into comercial_negocio_movimentacao (
        negocio_id,
        usuario_id,
        etapa_origem_id,
        etapa_destino_id,
        observacao
      )
      values ($1, $2, $3, $4, $5)
    `;
  },

  insert_interacao: () => {
    return `
      insert into comercial_interacao (
        empresa_id,
        negocio_id,
        cliente_id,
        usuario_id,
        tipo_interacao_id,
        categoria,
        descricao,
        data_inicio,
        data_fim,
        duracao_segundos,
        valor,
        em_andamento,
        criado_em
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, current_timestamp)
      returning id
    `;
  },

  insert_historico_cliente: () => {
    return `
      insert into comercial_historico_cliente (
        empresa_id,
        negocio_id,
        cliente_id,
        usuario_id,
        interacao_id,
        tipo,
        titulo,
        descricao,
        dados,
        criado_em
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, current_timestamp)
      returning id
    `;
  },

  close_open_interactions_for_negocio: () => {
    return `
      update comercial_interacao
      set em_andamento = false,
          data_fim = $3
      where empresa_id = $1
        and negocio_id = $2
        and em_andamento = true
    `;
  },

  get_interacao_by_id: () => {
    return `
      select
        id,
        empresa_id,
        negocio_id,
        cliente_id,
        usuario_id,
        tipo_interacao_id,
        coalesce(categoria, 'interacao') as categoria,
        descricao,
        data_inicio,
        data_fim,
        duracao_segundos,
        valor,
        em_andamento
      from comercial_interacao
      where id = $1
        and empresa_id = $2
      limit 1
    `;
  },

  close_interacao_by_id: () => {
    return `
      update comercial_interacao
      set em_andamento = false,
          data_fim = $2
      where id = $1
        and empresa_id = $3
        and em_andamento = true
      returning id, negocio_id
    `;
  },

  resequence_stage: () => {
    return `
      with ordenados as (
        select
          id,
          row_number() over (
            order by coalesce(posicao_kanban, 999999), data_entrada_pipeline, id
          ) - 1 as nova_posicao
        from comercial_negocio
        where crm_id = $1
          and etapa_id = $2
          and ativo = true
      )
      update comercial_negocio n
      set posicao_kanban = o.nova_posicao
      from ordenados o
      where n.id = o.id
    `;
  },

  get_negocio_raw: () => {
    return `
      select *
      from comercial_negocio
      where id = $1
        and empresa_id = $2
      limit 1
    `;
  },

  list_negocios: () => {
    return `
      select
        n.id,
        n.empresa_id,
        n.crm_id,
        crm.nome as crm_nome,
        crm.filial_id as filial_id,
        ef.nome as filial_nome,
        n.cliente_id,
        n.responsavel_usuario_id,
        n.etapa_id,
        e.codigo as stage,
        e.nome as stage_name,
        coalesce(e.eh_fechamento, false) as "isClosingStage",
        coalesce(e.eh_ganho, false) as "isWonStage",
        ${tituloNegocioSincronizado} as title,
        coalesce(n.valor_fechamento, n.valor_estimado, 0) as amount,
        n.posicao_kanban as "order",
        coalesce(n.nome_empresa, c.nome, n.nome_contato) as "companyName",
        n.nome_contato as "contactName",
        coalesce(n.telefone, c.telefone) as "customerPhone",
        coalesce(n.email, c.email) as "customerEmail",
        n.documento as "customerDocument",
        c.origem as "customerOrigin",
        case
          when coalesce(cliente_meta_ads.has_meta_ads, false) = true then 'meta_ads'
          when coalesce(cliente_meta_referral.has_meta_referral, false) = true then 'meta_ads'
          else c.origem
        end as "leadOrigin",
        n.temperatura as temperature,
        n.probabilidade as probability,
        n.data_criacao as "createdAt",
        n.data_entrada_pipeline as "entryDate",
        coalesce(
          n.data_fechamento_real::timestamp,
          fechamento.closed_at,
          n.data_fechamento_prevista::timestamp
        ) as "closingDate",
        n.origem_venda as "saleOrigin",
        n.quantidade_itens as "itemQuantity",
        coalesce(n.data_fechamento_real::timestamp, fechamento.closed_at) as "saleDate",
        n.observacoes_venda as "saleNotes",
        fp.codigo as "paymentMethod",
        n.parcelas as installments,
        mp.codigo as "refusalReason",
        n.observacoes_perda as "refusalNotes",
        coalesce(interacoes.total_interacoes_hoje, 0) as "scheduledInteractionTodayCount",
        interacoes.proxima_interacao_hoje as "scheduledInteractionTodayAt",
        coalesce(interacoes.total_interacoes_hoje, 0) > 0 as "hasScheduledInteractionToday",
        coalesce(interacao_aberta.total_abertas, 0) as "openInteractionCount",
        interacao_aberta.aberta_desde as "openInteractionStartedAt",
        coalesce(interacao_aberta.total_abertas, 0) > 0 as "hasOpenInteraction",
        conversa_preferencial.conversa_id as "chatConversationId",
        conversa_preferencial.conversa_status as "chatConversationStatus",
        u.id as "ownerId",
        u.nome as "ownerName",
        coalesce(tags.tags, '[]'::json) as tags,
        coalesce(orcamento.quote, json_build_object(
          'id', null,
          'title', n.titulo,
          'subtotal', coalesce(n.valor_estimado, 0),
          'discount', 0,
          'total', coalesce(n.valor_fechamento, n.valor_estimado, 0),
          'notes', n.observacoes_venda,
          'status', case when coalesce(e.eh_fechamento, false) then e.codigo else 'ativo' end,
          'items', '[]'::json
        )) as quote,
        coalesce(orcamento.items, '[]'::json) as products
      from comercial_negocio n
      left join cliente c on c.id = n.cliente_id
      left join usuario u on u.id = n.responsavel_usuario_id
      left join comercial_etapa e on e.id = n.etapa_id
      left join comercial_crm crm on crm.id = n.crm_id
      left join empresa_filial ef on ef.id = crm.filial_id
      left join comercial_forma_pagamento fp on fp.id = n.forma_pagamento_id
      left join comercial_motivo_perda mp on mp.id = n.motivo_perda_id
      left join lateral (
        select max(m.data_movimentacao) as closed_at
        from comercial_negocio_movimentacao m
        inner join comercial_etapa efch
          on efch.id = m.etapa_destino_id
        where m.negocio_id = n.id
          and coalesce(efch.eh_fechamento, false) = true
      ) fechamento on true
      left join lateral (
        select json_agg(t.nome order by t.nome) as tags
        from comercial_negocio_tag nt
        inner join comercial_tag t on t.id = nt.tag_id
        where nt.negocio_id = n.id
      ) tags on true
      left join lateral (
        select
          count(*)::int as total_interacoes_hoje,
          min(ci.data_inicio) as proxima_interacao_hoje
        from comercial_interacao ci
        where ci.empresa_id = n.empresa_id
          and ci.negocio_id = n.id
          and coalesce(ci.categoria, 'interacao') = 'agendamento'
          and ci.data_inicio::date = current_date
      ) interacoes on true
      left join lateral (
        select
          count(*)::int as total_abertas,
          min(ci.data_inicio) as aberta_desde
        from comercial_interacao ci
        where ci.empresa_id = n.empresa_id
          and ci.negocio_id = n.id
          and coalesce(ci.categoria, 'interacao') = 'interacao'
          and ci.em_andamento = true
      ) interacao_aberta on true
      left join lateral (
        select
          ccw.id as conversa_id,
          case
            when ccw.status_id = 0 then 'waiting'
            when ccw.status_id = 1 then 'active'
            else 'finished'
          end as conversa_status
        from cliente_conversa_whats ccw
        where ccw.empresa_id = n.empresa_id
          and ccw.cliente_id = n.cliente_id
        order by
          case
            when ccw.status_id = 1 then 1
            when ccw.status_id = 0 then 2
            else 3
          end,
          coalesce(ccw.data_fim, ccw.ultima_atualizacao, ccw.data_inicio) desc,
          ccw.id desc
        limit 1
      ) conversa_preferencial on true
      left join lateral (
        select true as has_meta_ads
        from cliente_meta_ads_lead cmal
        where cmal.empresa_id = n.empresa_id
          and cmal.cliente_id = n.cliente_id
        limit 1
      ) cliente_meta_ads on true
      left join lateral (
        select true as has_meta_referral
        from cliente_conversa_whats ccw
        inner join cliente_conversa_whats_mensagem ccm
          on ccm.cliente_conversa_id = ccw.id
        where ccw.empresa_id = n.empresa_id
          and ccw.cliente_id = n.cliente_id
          and (
            lower(coalesce(ccm.media_tipe, '')) = 'meta_referral'
            or ccm.mensagem like '[Meta Ads] Lead originado por anuncio%'
          )
        limit 1
      ) cliente_meta_referral on true
      left join lateral (
        select
          json_build_object(
            'id', co.id,
            'title', coalesce(co.titulo, n.titulo),
            'subtotal', coalesce(co.subtotal, 0),
            'discount', coalesce(co.desconto, 0),
            'total', coalesce(co.total, 0),
            'notes', co.observacoes,
            'status', co.status,
            'items', coalesce(itens.items, '[]'::json)
          ) as quote,
          coalesce(itens.items, '[]'::json) as items
        from comercial_orcamento co
        left join lateral (
          select json_agg(
            json_build_object(
              'id', coi.id,
              'comercialProdutoId', coi.comercial_produto_id,
              'name', coi.nome_produto,
              'quantity', coi.quantidade,
              'price', coi.preco_unitario,
              'subtotal', coi.total_item,
              'status', coi.status,
              'soldQuantity', coi.quantidade_ganha,
              'lostQuantity', coi.quantidade_perdida
            )
            order by coi.id
          ) as items
          from comercial_orcamento_item coi
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
      where n.empresa_id = $1
        and n.ativo = true
        and ($2::bigint is null or n.crm_id = $2)
        and ($3::integer is null or n.responsavel_usuario_id = $3)
        and ($4::varchar is null or e.codigo = $4)
        and (
          $5::varchar is null
          or n.titulo ilike $5
          or coalesce(n.nome_empresa, '') ilike $5
          or n.nome_contato ilike $5
          or coalesce(n.telefone, '') ilike $5
          or coalesce(n.email, '') ilike $5
        )
        and ($6::timestamp is null or n.data_criacao >= $6)
        and ($7::timestamp is null or n.data_criacao <= $7)
        and (
          $8::varchar is null
          or exists (
            select 1
            from comercial_negocio_tag ntf
            inner join comercial_tag tf on tf.id = ntf.tag_id
            where ntf.negocio_id = n.id
              and upper(tf.nome) = upper($8)
          )
        )
        and (
          $9::varchar is null
          or exists (
            select 1
            from comercial_orcamento co_filter
            inner join comercial_orcamento_item coi_filter
              on coi_filter.orcamento_id = co_filter.id
             and coi_filter.ativo = true
            where co_filter.negocio_id = n.id
              and co_filter.empresa_id = n.empresa_id
              and co_filter.ativo = true
              and co_filter.principal = true
              and upper(coalesce(coi_filter.nome_produto, '')) = upper($9)
          )
        )
        and (
          ($10::integer is null and coalesce($11::boolean, false) = false)
          or ($10::integer is not null and crm.filial_id = $10)
          or (coalesce($11::boolean, false) = true and crm.filial_id is null)
        )
        and ($12::varchar is null or upper(coalesce(n.origem_venda, '')) = upper($12))
      order by e.ordem, coalesce(n.posicao_kanban, 999999), n.data_criacao, n.id
    `;
  },

  list_negocios_dashboard: () => {
    return `
      select
        n.id,
        n.empresa_id,
        n.crm_id,
        crm.nome as crm_nome,
        crm.filial_id as filial_id,
        ef.nome as filial_nome,
        n.cliente_id,
        n.responsavel_usuario_id,
        n.etapa_id,
        e.codigo as stage,
        e.nome as stage_name,
        coalesce(e.eh_fechamento, false) as "isClosingStage",
        coalesce(e.eh_ganho, false) as "isWonStage",
        ${tituloNegocioSincronizado} as title,
        coalesce(n.valor_fechamento, n.valor_estimado, 0) as amount,
        n.posicao_kanban as "order",
        coalesce(n.nome_empresa, c.nome, n.nome_contato) as "companyName",
        n.nome_contato as "contactName",
        coalesce(n.telefone, c.telefone) as "customerPhone",
        coalesce(n.email, c.email) as "customerEmail",
        n.documento as "customerDocument",
        c.origem as "customerOrigin",
        case
          when coalesce(cliente_meta_ads.has_meta_ads, false) = true then 'meta_ads'
          when coalesce(cliente_meta_referral.has_meta_referral, false) = true then 'meta_ads'
          else c.origem
        end as "leadOrigin",
        n.temperatura as temperature,
        n.probabilidade as probability,
        n.data_criacao as "createdAt",
        n.data_entrada_pipeline as "entryDate",
        coalesce(
          n.data_fechamento_real::timestamp,
          fechamento.closed_at,
          n.data_fechamento_prevista::timestamp
        ) as "closingDate",
        n.origem_venda as "saleOrigin",
        n.quantidade_itens as "itemQuantity",
        coalesce(n.data_fechamento_real::timestamp, fechamento.closed_at) as "saleDate",
        u.id as "ownerId",
        u.nome as "ownerName"
      from comercial_negocio n
      left join cliente c on c.id = n.cliente_id
      left join usuario u on u.id = n.responsavel_usuario_id
      left join comercial_etapa e on e.id = n.etapa_id
      left join comercial_crm crm on crm.id = n.crm_id
      left join empresa_filial ef on ef.id = crm.filial_id
      left join lateral (
        select max(m.data_movimentacao) as closed_at
        from comercial_negocio_movimentacao m
        inner join comercial_etapa efch
          on efch.id = m.etapa_destino_id
        where m.negocio_id = n.id
          and coalesce(efch.eh_fechamento, false) = true
      ) fechamento on true
      left join lateral (
        select true as has_meta_ads
        from cliente_meta_ads_lead cmal
        where cmal.empresa_id = n.empresa_id
          and cmal.cliente_id = n.cliente_id
        limit 1
      ) cliente_meta_ads on true
      left join lateral (
        select true as has_meta_referral
        from cliente_conversa_whats ccw
        inner join cliente_conversa_whats_mensagem ccm
          on ccm.cliente_conversa_id = ccw.id
        where ccw.empresa_id = n.empresa_id
          and ccw.cliente_id = n.cliente_id
          and (
            lower(coalesce(ccm.media_tipe, '')) = 'meta_referral'
            or ccm.mensagem like '[Meta Ads] Lead originado por anuncio%'
          )
        limit 1
      ) cliente_meta_referral on true
      where n.empresa_id = $1
        and n.ativo = true
        and ($2::bigint is null or n.crm_id = $2)
        and ($3::integer is null or n.responsavel_usuario_id = $3)
        and ($4::varchar is null or e.codigo = $4)
        and (
          $5::varchar is null
          or n.titulo ilike $5
          or coalesce(n.nome_empresa, '') ilike $5
          or n.nome_contato ilike $5
          or coalesce(n.telefone, '') ilike $5
          or coalesce(n.email, '') ilike $5
        )
        and ($6::timestamp is null or n.data_criacao >= $6)
        and ($7::timestamp is null or n.data_criacao <= $7)
        and (
          $8::varchar is null
          or exists (
            select 1
            from comercial_negocio_tag ntf
            inner join comercial_tag tf on tf.id = ntf.tag_id
            where ntf.negocio_id = n.id
              and upper(tf.nome) = upper($8)
          )
        )
        and (
          $9::varchar is null
          or exists (
            select 1
            from comercial_orcamento co_filter
            inner join comercial_orcamento_item coi_filter
              on coi_filter.orcamento_id = co_filter.id
             and coi_filter.ativo = true
            where co_filter.negocio_id = n.id
              and co_filter.empresa_id = n.empresa_id
              and co_filter.ativo = true
              and co_filter.principal = true
              and upper(coalesce(coi_filter.nome_produto, '')) = upper($9)
          )
        )
        and (
          ($10::integer is null and coalesce($11::boolean, false) = false)
          or ($10::integer is not null and crm.filial_id = $10)
          or (coalesce($11::boolean, false) = true and crm.filial_id is null)
        )
        and ($12::varchar is null or upper(coalesce(n.origem_venda, '')) = upper($12))
      order by e.ordem, coalesce(n.posicao_kanban, 999999), n.data_criacao, n.id
    `;
  },

  list_negocios_paginados: () => {
    return `
      select
        n.id,
        n.empresa_id,
        n.crm_id,
        crm.nome as crm_nome,
        crm.filial_id as filial_id,
        ef.nome as filial_nome,
        n.cliente_id,
        n.responsavel_usuario_id,
        n.etapa_id,
        e.codigo as stage,
        e.nome as stage_name,
        coalesce(e.eh_fechamento, false) as "isClosingStage",
        coalesce(e.eh_ganho, false) as "isWonStage",
        ${tituloNegocioSincronizado} as title,
        coalesce(n.valor_fechamento, n.valor_estimado, 0) as amount,
        n.posicao_kanban as "order",
        coalesce(n.nome_empresa, c.nome, n.nome_contato) as "companyName",
        n.nome_contato as "contactName",
        coalesce(n.telefone, c.telefone) as "customerPhone",
        coalesce(n.email, c.email) as "customerEmail",
        n.documento as "customerDocument",
        c.origem as "customerOrigin",
        case
          when coalesce(cliente_meta_ads.has_meta_ads, false) = true then 'meta_ads'
          when coalesce(cliente_meta_referral.has_meta_referral, false) = true then 'meta_ads'
          else c.origem
        end as "leadOrigin",
        n.temperatura as temperature,
        n.probabilidade as probability,
        n.data_criacao as "createdAt",
        n.data_entrada_pipeline as "entryDate",
        coalesce(
          n.data_fechamento_real::timestamp,
          fechamento.closed_at,
          n.data_fechamento_prevista::timestamp
        ) as "closingDate",
        n.origem_venda as "saleOrigin",
        n.quantidade_itens as "itemQuantity",
        coalesce(n.data_fechamento_real::timestamp, fechamento.closed_at) as "saleDate",
        n.observacoes_venda as "saleNotes",
        fp.codigo as "paymentMethod",
        n.parcelas as installments,
        mp.codigo as "refusalReason",
        n.observacoes_perda as "refusalNotes",
        coalesce(interacoes.total_interacoes_hoje, 0) as "scheduledInteractionTodayCount",
        interacoes.proxima_interacao_hoje as "scheduledInteractionTodayAt",
        coalesce(interacoes.total_interacoes_hoje, 0) > 0 as "hasScheduledInteractionToday",
        coalesce(interacao_aberta.total_abertas, 0) as "openInteractionCount",
        interacao_aberta.aberta_desde as "openInteractionStartedAt",
        coalesce(interacao_aberta.total_abertas, 0) > 0 as "hasOpenInteraction",
        conversa_preferencial.conversa_id as "chatConversationId",
        conversa_preferencial.conversa_status as "chatConversationStatus",
        u.id as "ownerId",
        u.nome as "ownerName",
        coalesce(tags.tags, '[]'::json) as tags,
        coalesce(orcamento.quote, json_build_object(
          'id', null,
          'title', n.titulo,
          'subtotal', coalesce(n.valor_estimado, 0),
          'discount', 0,
          'total', coalesce(n.valor_fechamento, n.valor_estimado, 0),
          'notes', n.observacoes_venda,
          'status', case when coalesce(e.eh_fechamento, false) then e.codigo else 'ativo' end,
          'items', '[]'::json
        )) as quote,
        coalesce(orcamento.items, '[]'::json) as products
      from comercial_negocio n
      left join cliente c on c.id = n.cliente_id
      left join usuario u on u.id = n.responsavel_usuario_id
      left join comercial_etapa e on e.id = n.etapa_id
      left join comercial_crm crm on crm.id = n.crm_id
      left join empresa_filial ef on ef.id = crm.filial_id
      left join comercial_forma_pagamento fp on fp.id = n.forma_pagamento_id
      left join comercial_motivo_perda mp on mp.id = n.motivo_perda_id
      left join lateral (
        select max(m.data_movimentacao) as closed_at
        from comercial_negocio_movimentacao m
        inner join comercial_etapa efch
          on efch.id = m.etapa_destino_id
        where m.negocio_id = n.id
          and coalesce(efch.eh_fechamento, false) = true
      ) fechamento on true
      left join lateral (
        select json_agg(t.nome order by t.nome) as tags
        from comercial_negocio_tag nt
        inner join comercial_tag t on t.id = nt.tag_id
        where nt.negocio_id = n.id
      ) tags on true
      left join lateral (
        select
          count(*)::int as total_interacoes_hoje,
          min(ci.data_inicio) as proxima_interacao_hoje
        from comercial_interacao ci
        where ci.empresa_id = n.empresa_id
          and ci.negocio_id = n.id
          and coalesce(ci.categoria, 'interacao') = 'agendamento'
          and ci.data_inicio::date = current_date
      ) interacoes on true
      left join lateral (
        select
          count(*)::int as total_abertas,
          min(ci.data_inicio) as aberta_desde
        from comercial_interacao ci
        where ci.empresa_id = n.empresa_id
          and ci.negocio_id = n.id
          and coalesce(ci.categoria, 'interacao') = 'interacao'
          and ci.em_andamento = true
      ) interacao_aberta on true
      left join lateral (
        select
          ccw.id as conversa_id,
          case
            when ccw.status_id = 0 then 'waiting'
            when ccw.status_id = 1 then 'active'
            else 'finished'
          end as conversa_status
        from cliente_conversa_whats ccw
        where ccw.empresa_id = n.empresa_id
          and ccw.cliente_id = n.cliente_id
        order by
          case
            when ccw.status_id = 1 then 1
            when ccw.status_id = 0 then 2
            else 3
          end,
          coalesce(ccw.data_fim, ccw.ultima_atualizacao, ccw.data_inicio) desc,
          ccw.id desc
        limit 1
      ) conversa_preferencial on true
      left join lateral (
        select true as has_meta_ads
        from cliente_meta_ads_lead cmal
        where cmal.empresa_id = n.empresa_id
          and cmal.cliente_id = n.cliente_id
        limit 1
      ) cliente_meta_ads on true
      left join lateral (
        select true as has_meta_referral
        from cliente_conversa_whats ccw
        inner join cliente_conversa_whats_mensagem ccm
          on ccm.cliente_conversa_id = ccw.id
        where ccw.empresa_id = n.empresa_id
          and ccw.cliente_id = n.cliente_id
          and (
            lower(coalesce(ccm.media_tipe, '')) = 'meta_referral'
            or ccm.mensagem like '[Meta Ads] Lead originado por anuncio%'
          )
        limit 1
      ) cliente_meta_referral on true
      left join lateral (
        select
          json_build_object(
            'id', co.id,
            'title', coalesce(co.titulo, n.titulo),
            'subtotal', coalesce(co.subtotal, 0),
            'discount', coalesce(co.desconto, 0),
            'total', coalesce(co.total, 0),
            'notes', co.observacoes,
            'status', co.status,
            'items', coalesce(itens.items, '[]'::json)
          ) as quote,
          coalesce(itens.items, '[]'::json) as items
        from comercial_orcamento co
        left join lateral (
          select json_agg(
            json_build_object(
              'id', coi.id,
              'comercialProdutoId', coi.comercial_produto_id,
              'name', coi.nome_produto,
              'quantity', coi.quantidade,
              'price', coi.preco_unitario,
              'subtotal', coi.total_item,
              'status', coi.status,
              'soldQuantity', coi.quantidade_ganha,
              'lostQuantity', coi.quantidade_perdida
            )
            order by coi.id
          ) as items
          from comercial_orcamento_item coi
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
      where n.empresa_id = $1
        and n.ativo = true
        and ($2::bigint is null or n.crm_id = $2)
        and ($3::integer is null or n.responsavel_usuario_id = $3)
        and ($4::varchar is null or e.codigo = $4)
        and (
          $5::varchar is null
          or n.titulo ilike $5
          or coalesce(n.nome_empresa, '') ilike $5
          or n.nome_contato ilike $5
          or coalesce(n.telefone, '') ilike $5
          or coalesce(n.email, '') ilike $5
        )
        and ($6::timestamp is null or n.data_criacao >= $6)
        and ($7::timestamp is null or n.data_criacao <= $7)
        and (
          $8::varchar is null
          or exists (
            select 1
            from comercial_negocio_tag ntf
            inner join comercial_tag tf on tf.id = ntf.tag_id
            where ntf.negocio_id = n.id
              and upper(tf.nome) = upper($8)
          )
        )
        and (
          $9::varchar is null
          or exists (
            select 1
            from comercial_orcamento co_filter
            inner join comercial_orcamento_item coi_filter
              on coi_filter.orcamento_id = co_filter.id
             and coi_filter.ativo = true
            where co_filter.negocio_id = n.id
              and co_filter.empresa_id = n.empresa_id
              and co_filter.ativo = true
              and co_filter.principal = true
              and upper(coalesce(coi_filter.nome_produto, '')) = upper($9)
          )
        )
        and (
          ($10::integer is null and coalesce($11::boolean, false) = false)
          or ($10::integer is not null and crm.filial_id = $10)
          or (coalesce($11::boolean, false) = true and crm.filial_id is null)
        )
        and ($12::varchar is null or upper(coalesce(n.origem_venda, '')) = upper($12))
      order by e.ordem, coalesce(n.posicao_kanban, 999999), n.data_criacao, n.id
      limit $13
      offset $14
    `;
  },

  count_negocios: () => {
    return `
      select
        count(*)::integer as total,
        coalesce(sum(coalesce(n.valor_fechamento, n.valor_estimado, 0)), 0)::numeric as total_valor
      from comercial_negocio n
      left join comercial_etapa e on e.id = n.etapa_id
      left join comercial_crm crm on crm.id = n.crm_id
      where n.empresa_id = $1
        and n.ativo = true
        and ($2::bigint is null or n.crm_id = $2)
        and ($3::integer is null or n.responsavel_usuario_id = $3)
        and ($4::varchar is null or e.codigo = $4)
        and (
          $5::varchar is null
          or n.titulo ilike $5
          or coalesce(n.nome_empresa, '') ilike $5
          or n.nome_contato ilike $5
          or coalesce(n.telefone, '') ilike $5
          or coalesce(n.email, '') ilike $5
        )
        and ($6::timestamp is null or n.data_criacao >= $6)
        and ($7::timestamp is null or n.data_criacao <= $7)
        and (
          $8::varchar is null
          or exists (
            select 1
            from comercial_negocio_tag ntf
            inner join comercial_tag tf on tf.id = ntf.tag_id
            where ntf.negocio_id = n.id
              and upper(tf.nome) = upper($8)
          )
        )
        and (
          $9::varchar is null
          or exists (
            select 1
            from comercial_orcamento co_filter
            inner join comercial_orcamento_item coi_filter
              on coi_filter.orcamento_id = co_filter.id
             and coi_filter.ativo = true
            where co_filter.negocio_id = n.id
              and co_filter.empresa_id = n.empresa_id
              and co_filter.ativo = true
              and co_filter.principal = true
              and upper(coalesce(coi_filter.nome_produto, '')) = upper($9)
          )
        )
        and (
          ($10::integer is null and coalesce($11::boolean, false) = false)
          or ($10::integer is not null and crm.filial_id = $10)
          or (coalesce($11::boolean, false) = true and crm.filial_id is null)
        )
        and ($12::varchar is null or upper(coalesce(n.origem_venda, '')) = upper($12))
    `;
  },

  list_negocios_fechados: () => {
    return `
      select
        n.id,
        n.empresa_id,
        n.crm_id,
        crm.nome as crm_nome,
        crm.filial_id as filial_id,
        ef.nome as filial_nome,
        n.cliente_id,
        n.responsavel_usuario_id,
        n.etapa_id,
        e.codigo as stage,
        e.nome as stage_name,
        coalesce(e.eh_fechamento, false) as "isClosingStage",
        coalesce(e.eh_ganho, false) as "isWonStage",
        ${tituloNegocioSincronizado} as title,
        coalesce(n.valor_fechamento, n.valor_estimado, 0) as amount,
        n.posicao_kanban as "order",
        coalesce(n.nome_empresa, c.nome, n.nome_contato) as "companyName",
        n.nome_contato as "contactName",
        coalesce(n.telefone, c.telefone) as "customerPhone",
        coalesce(n.email, c.email) as "customerEmail",
        n.documento as "customerDocument",
        n.temperatura as temperature,
        n.probabilidade as probability,
        n.data_criacao as "createdAt",
        n.data_entrada_pipeline as "entryDate",
        coalesce(
          n.data_fechamento_real::timestamp,
          fechamento.closed_at,
          n.data_fechamento_prevista::timestamp
        ) as "closingDate",
        n.origem_venda as "saleOrigin",
        n.quantidade_itens as "itemQuantity",
        coalesce(n.data_fechamento_real::timestamp, fechamento.closed_at) as "saleDate",
        n.observacoes_venda as "saleNotes",
        fp.codigo as "paymentMethod",
        n.parcelas as installments,
        mp.codigo as "refusalReason",
        n.observacoes_perda as "refusalNotes",
        u.id as "ownerId",
        u.nome as "ownerName",
        coalesce(orcamento.quote, json_build_object(
          'id', null,
          'title', n.titulo,
          'subtotal', coalesce(n.valor_estimado, 0),
          'discount', 0,
          'total', coalesce(n.valor_fechamento, n.valor_estimado, 0),
          'notes', n.observacoes_venda,
          'status', e.codigo,
          'items', '[]'::json
        )) as quote,
        coalesce(orcamento.items, '[]'::json) as products
      from comercial_negocio n
      left join cliente c on c.id = n.cliente_id
      left join usuario u on u.id = n.responsavel_usuario_id
      left join comercial_etapa e on e.id = n.etapa_id
      left join comercial_crm crm on crm.id = n.crm_id
      left join empresa_filial ef on ef.id = crm.filial_id
      left join comercial_forma_pagamento fp on fp.id = n.forma_pagamento_id
      left join comercial_motivo_perda mp on mp.id = n.motivo_perda_id
      left join lateral (
        select max(m.data_movimentacao) as closed_at
        from comercial_negocio_movimentacao m
        inner join comercial_etapa efch
          on efch.id = m.etapa_destino_id
        where m.negocio_id = n.id
          and coalesce(efch.eh_fechamento, false) = true
      ) fechamento on true
      left join lateral (
        select
          json_build_object(
            'id', co.id,
            'title', coalesce(co.titulo, n.titulo),
            'subtotal', coalesce(co.subtotal, 0),
            'discount', coalesce(co.desconto, 0),
            'total', coalesce(co.total, 0),
            'notes', co.observacoes,
            'status', co.status,
            'items', coalesce(itens.items, '[]'::json)
          ) as quote,
          coalesce(itens.items, '[]'::json) as items
        from comercial_orcamento co
        left join lateral (
          select json_agg(
            json_build_object(
              'id', coi.id,
              'comercialProdutoId', coi.comercial_produto_id,
              'name', coi.nome_produto,
              'quantity', coi.quantidade,
              'price', coi.preco_unitario,
              'subtotal', coi.total_item,
              'status', coi.status,
              'soldQuantity', coi.quantidade_ganha,
              'lostQuantity', coi.quantidade_perdida
            )
            order by coi.id
          ) as items
          from comercial_orcamento_item coi
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
      where n.empresa_id = $1
        and n.ativo = true
        and coalesce(e.eh_fechamento, false) = true
        and ($2::bigint is null or n.crm_id = $2)
        and ($3::integer is null or n.responsavel_usuario_id = $3)
        and ($4::varchar is null or e.codigo = $4)
        and (
          $5::varchar is null
          or n.titulo ilike $5
          or coalesce(n.nome_empresa, '') ilike $5
          or n.nome_contato ilike $5
          or coalesce(n.telefone, '') ilike $5
          or coalesce(n.email, '') ilike $5
        )
        and (
          $6::timestamp is null
          or coalesce(
            n.data_fechamento_real::timestamp,
            fechamento.closed_at,
            n.data_fechamento_prevista::timestamp,
            n.data_criacao
          ) >= $6
        )
        and (
          $7::timestamp is null
          or coalesce(
            n.data_fechamento_real::timestamp,
            fechamento.closed_at,
            n.data_fechamento_prevista::timestamp,
            n.data_criacao
          ) <= $7
        )
        and (
          $8::varchar is null
          or exists (
            select 1
            from comercial_orcamento co_filter
            inner join comercial_orcamento_item coi_filter
              on coi_filter.orcamento_id = co_filter.id
             and coi_filter.ativo = true
            where co_filter.negocio_id = n.id
              and co_filter.empresa_id = n.empresa_id
              and co_filter.ativo = true
              and co_filter.principal = true
              and upper(coalesce(coi_filter.nome_produto, '')) = upper($8)
          )
        )
        and (
          ($9::integer is null and coalesce($10::boolean, false) = false)
          or ($9::integer is not null and crm.filial_id = $9)
          or (coalesce($10::boolean, false) = true and crm.filial_id is null)
        )
        and ($11::varchar is null or upper(coalesce(n.origem_venda, '')) = upper($11))
      order by
        coalesce(
          n.data_fechamento_real::timestamp,
          fechamento.closed_at,
          n.data_fechamento_prevista::timestamp,
          n.data_criacao
        ) desc,
        n.id desc
      limit $12
      offset $13
    `;
  },

  count_negocios_fechados: () => {
    return `
      select count(*)::integer as total
      from comercial_negocio n
      left join comercial_etapa e on e.id = n.etapa_id
      left join comercial_crm crm on crm.id = n.crm_id
      where n.empresa_id = $1
        and n.ativo = true
        and coalesce(e.eh_fechamento, false) = true
        and ($2::bigint is null or n.crm_id = $2)
        and ($3::integer is null or n.responsavel_usuario_id = $3)
        and ($4::varchar is null or e.codigo = $4)
        and (
          $5::varchar is null
          or n.titulo ilike $5
          or coalesce(n.nome_empresa, '') ilike $5
          or n.nome_contato ilike $5
          or coalesce(n.telefone, '') ilike $5
          or coalesce(n.email, '') ilike $5
        )
        and (
          $6::timestamp is null
          or coalesce(
            n.data_fechamento_real::timestamp,
            (
              select max(m.data_movimentacao)
              from comercial_negocio_movimentacao m
              inner join comercial_etapa efch
                on efch.id = m.etapa_destino_id
              where m.negocio_id = n.id
                and coalesce(efch.eh_fechamento, false) = true
            ),
            n.data_fechamento_prevista::timestamp,
            n.data_criacao
          ) >= $6
        )
        and (
          $7::timestamp is null
          or coalesce(
            n.data_fechamento_real::timestamp,
            (
              select max(m.data_movimentacao)
              from comercial_negocio_movimentacao m
              inner join comercial_etapa efch
                on efch.id = m.etapa_destino_id
              where m.negocio_id = n.id
                and coalesce(efch.eh_fechamento, false) = true
            ),
            n.data_fechamento_prevista::timestamp,
            n.data_criacao
          ) <= $7
        )
        and (
          $8::varchar is null
          or exists (
            select 1
            from comercial_orcamento co_filter
            inner join comercial_orcamento_item coi_filter
              on coi_filter.orcamento_id = co_filter.id
             and coi_filter.ativo = true
            where co_filter.negocio_id = n.id
              and co_filter.empresa_id = n.empresa_id
              and co_filter.ativo = true
              and co_filter.principal = true
              and upper(coalesce(coi_filter.nome_produto, '')) = upper($8)
          )
        )
        and (
          ($9::integer is null and coalesce($10::boolean, false) = false)
          or ($9::integer is not null and crm.filial_id = $9)
          or (coalesce($10::boolean, false) = true and crm.filial_id is null)
        )
        and ($11::varchar is null or upper(coalesce(n.origem_venda, '')) = upper($11))
    `;
  },

  list_cliente_documentos_por_atendente: () => {
    return `
      select
        cd.usuario_id,
        u.nome as usuario_nome,
        count(*)::int as total_documentos,
        count(distinct cd.cliente_id)::int as total_clientes
      from cliente_documento cd
      left join usuario u
        on u.id = cd.usuario_id
      where cd.empresa_id = $1
        and cd.ativo = true
        and cd.cliente_id = any($2::bigint[])
        and ($3::timestamp is null or cd.data_criacao >= $3)
        and ($4::timestamp is null or cd.data_criacao <= $4)
      group by cd.usuario_id, u.nome
      order by total_documentos desc, u.nome asc nulls last, cd.usuario_id asc nulls last
    `;
  },

  get_customer_profile: () => {
    return `
      select
        c.id,
        c.nome,
        c.email,
        c.telefone,
        c.data_cadastro as "entryDate",
        coalesce(stats.total_purchases, 0) as "totalPurchases",
        coalesce(stats.total_spent, 0) as "totalSpent",
        coalesce(stats.average_ticket, 0) as "averageTicket",
        (
          select max(h.criado_em)
          from comercial_historico_cliente h
          where h.empresa_id = $2
            and h.cliente_id = $1
        ) as "lastInteraction"
      from cliente c
      left join (
        select
          n.cliente_id,
          count(*) filter (where e.codigo = 'closed-won') as total_purchases,
          coalesce(sum(case when e.codigo = 'closed-won' then coalesce(n.valor_fechamento, n.valor_estimado, 0) else 0 end), 0) as total_spent,
          coalesce(avg(case when e.codigo = 'closed-won' then coalesce(n.valor_fechamento, n.valor_estimado, 0) end), 0) as average_ticket
        from comercial_negocio n
        left join comercial_etapa e on e.id = n.etapa_id
        where n.empresa_id = $2
          and n.cliente_id = $1
          and n.ativo = true
        group by n.cliente_id
      ) stats on stats.cliente_id = c.id
      where c.id = $1
      limit 1
    `;
  },

  list_customer_interactions: () => {
    return `
      select
        ci.id,
        ti.codigo as type,
        coalesce(ci.categoria, coalesce(ti.categoria, 'interacao')) as category,
        ti.nome as "typeName",
        ci.data_inicio as date,
        ci.data_fim as "endDate",
        ci.descricao as description,
        coalesce(u.nome, 'Sistema') as "attendantName",
        ci.duracao_segundos,
        ci.valor as value,
        ci.em_andamento as "isCurrent"
      from comercial_interacao ci
      inner join comercial_tipo_interacao ti on ti.id = ci.tipo_interacao_id
      left join usuario u on u.id = ci.usuario_id
      where ci.empresa_id = $1
        and ci.cliente_id = $2
      order by ci.data_inicio desc, ci.id desc
    `;
  },

  list_dashboard_interacoes_by_negocios: () => {
    return `
      select
        ci.id,
        ci.negocio_id,
        ci.usuario_id,
        coalesce(ti.codigo, 'interaction') as tipo_codigo,
        coalesce(ci.categoria, coalesce(ti.categoria, 'interacao')) as categoria,
        ci.data_inicio,
        ci.data_fim,
        ci.duracao_segundos,
        ci.valor,
        ci.em_andamento
      from comercial_interacao ci
      left join comercial_tipo_interacao ti
        on ti.id = ci.tipo_interacao_id
      where ci.empresa_id = $1
        and ci.negocio_id = any($2::bigint[])
      order by ci.negocio_id asc, ci.data_inicio asc nulls last, ci.id asc
    `;
  },

  list_dashboard_primeira_resposta_por_negocios: () => {
    return `
      with selected_deals as (
        select
          n.id as negocio_id,
          n.cliente_id,
          n.crm_id,
          coalesce(n.data_entrada_pipeline, n.data_criacao) as waiting_started_at,
          waiting_stage.id as waiting_stage_id
        from comercial_negocio n
        left join comercial_etapa waiting_stage
          on waiting_stage.crm_id = n.crm_id
         and waiting_stage.codigo = 'waiting'
         and waiting_stage.ativo = true
        where n.empresa_id = $1
          and n.id = any($2::bigint[])
          and n.cliente_id is not null
      ),
      waiting_reference as (
        select
          d.negocio_id,
          coalesce(
            min(m.data_movimentacao) filter (
              where d.waiting_stage_id is not null
                and m.etapa_destino_id = d.waiting_stage_id
            ),
            d.waiting_started_at
          ) as queue_started_at
        from selected_deals d
        left join comercial_negocio_movimentacao m
          on m.negocio_id = d.negocio_id
        group by d.negocio_id, d.waiting_started_at
      ),
      response_candidates as (
        select
          d.negocio_id,
          ccw.id as conversa_id,
          waiting.queue_started_at,
          min(m.data_mensagem) as first_response_at
        from selected_deals d
        inner join waiting_reference waiting
          on waiting.negocio_id = d.negocio_id
        inner join cliente_conversa_whats ccw
          on ccw.empresa_id = $1
         and ccw.cliente_id = d.cliente_id
        inner join cliente_conversa_whats_mensagem m
          on m.cliente_conversa_id = ccw.id
         and m.send_by in (2, 4)
         and coalesce(m.apagada, false) = false
         and waiting.queue_started_at is not null
         and m.data_mensagem >= waiting.queue_started_at
        where (
          coalesce(array_length($3::bigint[], 1), 0) = 0
          or ccw.empresa_meta_param_id = any($3::bigint[])
        )
        group by d.negocio_id, ccw.id, waiting.queue_started_at
      ),
      ranked as (
        select
          candidate.*,
          row_number() over (
            partition by candidate.negocio_id
            order by
              candidate.first_response_at asc nulls last,
              candidate.queue_started_at asc,
              candidate.conversa_id asc
          ) as rn
        from response_candidates candidate
      )
      select
        ranked.negocio_id,
        ranked.conversa_id,
        ranked.queue_started_at,
        ranked.first_response_at,
        case
          when ranked.first_response_at is not null
            and ranked.queue_started_at is not null
            and ranked.first_response_at >= ranked.queue_started_at
          then extract(epoch from (ranked.first_response_at - ranked.queue_started_at))::bigint
          else null
        end as first_response_seconds
      from ranked
      where ranked.rn = 1
    `;
  },

  list_dashboard_contatos_por_negocios: () => {
    return `
      with selected_deals as (
        select
          n.id as negocio_id,
          n.cliente_id,
          n.crm_id,
          coalesce(n.data_entrada_pipeline, n.data_criacao) as waiting_started_at,
          waiting_stage.id as waiting_stage_id
        from comercial_negocio n
        left join comercial_etapa waiting_stage
          on waiting_stage.crm_id = n.crm_id
         and waiting_stage.codigo = 'waiting'
         and waiting_stage.ativo = true
        where n.empresa_id = $1
          and n.id = any($2::bigint[])
          and n.cliente_id is not null
      ),
      waiting_reference as (
        select
          d.negocio_id,
          coalesce(
            min(m.data_movimentacao) filter (
              where d.waiting_stage_id is not null
                and m.etapa_destino_id = d.waiting_stage_id
            ),
            d.waiting_started_at
          ) as queue_started_at
        from selected_deals d
        left join comercial_negocio_movimentacao m
          on m.negocio_id = d.negocio_id
        group by d.negocio_id, d.waiting_started_at
      )
      select
        d.negocio_id,
        count(m.id)::int as contacts_count
      from selected_deals d
      left join waiting_reference waiting
        on waiting.negocio_id = d.negocio_id
      left join cliente_conversa_whats ccw
        on ccw.empresa_id = $1
       and ccw.cliente_id = d.cliente_id
       and (
         coalesce(array_length($3::bigint[], 1), 0) = 0
         or ccw.empresa_meta_param_id = any($3::bigint[])
       )
      left join cliente_conversa_whats_mensagem m
        on m.cliente_conversa_id = ccw.id
       and m.send_by in (2, 4)
       and coalesce(m.apagada, false) = false
       and waiting.queue_started_at is not null
       and m.data_mensagem >= waiting.queue_started_at
      group by d.negocio_id
      order by d.negocio_id asc
    `;
  },

  list_crm_calendar_appointments: () => {
    return `
      select
        ci.id,
        ci.negocio_id as "dealId",
        n.titulo as "dealTitle",
        c.nome as "customerName",
        c.telefone as "customerPhone",
        coalesce(u.nome, 'Sistema') as "ownerName",
        coalesce(ti.codigo, 'meeting') as type,
        ti.nome as "typeName",
        coalesce(ci.categoria, coalesce(ti.categoria, 'interacao')) as category,
        ci.descricao as description,
        ci.data_inicio as "startDate",
        ci.data_fim as "endDate",
        ci.em_andamento as "isCurrent"
      from comercial_interacao ci
      inner join comercial_negocio n
        on n.id = ci.negocio_id
       and n.empresa_id = ci.empresa_id
      left join cliente c
        on c.id = ci.cliente_id
      left join usuario u
        on u.id = ci.usuario_id
      left join comercial_tipo_interacao ti
        on ti.id = ci.tipo_interacao_id
      where ci.empresa_id = $1
        and n.crm_id = $2
        and coalesce(ci.categoria, coalesce(ti.categoria, 'interacao')) = 'agendamento'
        and ci.data_inicio >= $3
        and ci.data_inicio < $4
        and ($5::bigint is null or ci.usuario_id = $5::bigint)
      order by ci.data_inicio asc, ci.id asc
    `;
  },

  list_company_conversations_report: () => {
    return `
      select
        ccw.id,
        c.id as cliente_id,
        c.nome as cliente_nome,
        c.telefone as cliente_telefone,
        coalesce(nullif(trim(c.origem), ''), 'whatsapp') as origem_cliente,
        c.utms,
        ccw.status_id,
        case
          when ccw.status_id = 0 then 'waiting'
          when ccw.status_id = 1 then 'active'
          else 'finished'
        end as status,
        ccw.data_inicio,
        ccw.data_fim,
        ccw.ultima_atualizacao,
        coalesce(ccw.data_inicio, ccw.ultima_atualizacao) as fila_desde,
        coalesce(
          coalesce(ccw.data_inicio, ccw.ultima_atualizacao) <= current_timestamp - interval '24 hours',
          false
        ) as fila_mais_24h,
        u.nome as nome_atendente,
        ua.nome as nome_usuario_atribuido,
        coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id::varchar, '') as meta_numero_conta,
        coalesce(emp.meta_verified_name, emp.meta_waba_name, '') as meta_nome_conta,
        coalesce(funis.funil_nome, 'Sem funil') as funil_nome,
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
        coalesce(message_stats.total_mensagens, 0)::int as total_mensagens,
        coalesce(message_stats.total_mensagens_cliente, 0)::int as total_mensagens_cliente,
        coalesce(message_stats.total_mensagens_usuario, 0)::int as total_mensagens_usuario,
        coalesce(conversation_messages.mensagens, '[]'::json) as mensagens,
        last_message.ultima_mensagem,
        last_message.ultima_mensagem_send_by
      from cliente_conversa_whats ccw
      inner join cliente c
        on c.id = ccw.cliente_id
       and c.empresa_id = ccw.empresa_id
      left join usuario u on u.id = ccw.usuario_id
      left join usuario ua on ua.id = ccw.usuario_atribuido_id
      left join empresa_meta_parans emp on emp.id = ccw.empresa_meta_param_id
      left join lateral (
        select string_agg(distinct crm.nome, ' | ') as funil_nome
        from comercial_negocio n
        inner join comercial_crm crm on crm.id = n.crm_id
        where n.empresa_id = ccw.empresa_id
          and n.cliente_id = ccw.cliente_id
          and n.ativo = true
          and crm.ativo = true
      ) funis on true
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
          count(*)::int as total_mensagens,
          count(*) filter (where ccm.send_by = 1)::int as total_mensagens_cliente,
          count(*) filter (where ccm.send_by in (2, 3, 4))::int as total_mensagens_usuario
        from cliente_conversa_whats_mensagem ccm
        where ccm.cliente_conversa_id = ccw.id
      ) message_stats on true
      left join lateral (
        select coalesce(
          json_agg(
            json_build_object(
              'id', ccm.id,
              'mensagem_whats_id', ccm.mensagem_whats_id,
              'mensagem', case
                when coalesce(ccm.apagada, false) = true then 'Mensagem apagada'
                else ccm.mensagem
              end,
              'data_mensagem', ccm.data_mensagem,
              'send_by', ccm.send_by,
              'media_tipe', coalesce(
                nullif(btrim(ccm.media_tipe), ''),
                case
                  when ccm.mensagem like '[Meta Ads] Lead originado por anuncio%' then 'meta_referral'
                  else null
                end
              ),
              'apagada', coalesce(ccm.apagada, false),
              'status', ccm.status
            )
            order by ccm.data_mensagem asc nulls last, ccm.id asc
          ),
          '[]'::json
        ) as mensagens
        from cliente_conversa_whats_mensagem ccm
        where ccm.cliente_conversa_id = ccw.id
      ) conversation_messages on true
      left join lateral (
        select
          ccm.mensagem as ultima_mensagem,
          ccm.send_by as ultima_mensagem_send_by
        from cliente_conversa_whats_mensagem ccm
        where ccm.cliente_conversa_id = ccw.id
        order by ccm.id desc
        limit 1
      ) last_message on true
      where ccw.empresa_id = $1
        and c.ativo = true
        and (
          $2::bigint is null
          or ccw.usuario_id = $2::bigint
          or ccw.usuario_atribuido_id = $2::bigint
        )
        and (
          $3::date is null
          or coalesce(ccw.data_inicio, ccw.ultima_atualizacao)::date >= $3::date
        )
        and (
          $4::date is null
          or coalesce(ccw.data_inicio, ccw.ultima_atualizacao)::date <= $4::date
        )
      order by
        coalesce(ccw.data_fim, ccw.ultima_atualizacao, ccw.data_inicio) desc nulls last,
        ccw.id desc
    `;
  },

  count_generated_quotes_report: () => {
    return `
      select count(*)::int as total_orcamentos_gerados
      from comercial_orcamento co
      inner join comercial_negocio n
        on n.id = co.negocio_id
       and n.empresa_id = co.empresa_id
      inner join comercial_crm crm
        on crm.id = n.crm_id
       and crm.empresa_id = n.empresa_id
      where co.empresa_id = $1
        and n.crm_id = $2
        and ($3::bigint is null or n.responsavel_usuario_id = $3::bigint)
        and ($4::timestamp is null or co.criado_em >= $4::timestamp)
        and ($5::timestamp is null or co.criado_em <= $5::timestamp)
        and ($6::bigint is null or crm.filial_id = $6::bigint)
        and ($7::boolean = false or crm.filial_id is null)
    `;
  },

  list_customer_history: () => {
    return `
      select
        h.id,
        h.tipo as type,
        h.titulo as title,
        h.descricao as description,
        h.criado_em as date,
        coalesce(u.nome, 'Sistema') as "attendantName",
        h.interacao_id as "interactionId",
        h.dados as data
      from comercial_historico_cliente h
      left join usuario u on u.id = h.usuario_id
      where h.empresa_id = $1
        and h.cliente_id = $2
      order by h.criado_em desc, h.id desc
    `;
  },
  list_vendas_consolidadas: ({
    includeHotmart = false,
    includeHubla = false,
    includeImported = false,
    hotmartHasSeller = false,
    hublaHasSeller = false,
  } = {}) => {
    const sources = [
      `
        select
          'crm'::varchar as fonte,
          n.id::text as venda_id,
          n.crm_id,
          crm.nome as funil_nome,
          n.cliente_id,
          coalesce(c.nome, n.nome_contato, n.nome_empresa, 'Cliente nao informado') as cliente_nome,
          n.titulo as descricao,
          coalesce(n.valor_fechamento, n.valor_estimado, 0)::numeric as valor,
          n.origem_venda as origem,
          coalesce(n.data_fechamento_real::timestamptz, n.data_fechamento_prevista::timestamptz, n.data_criacao) as vendido_em,
          n.responsavel_usuario_id as vendedor_id,
          u.nome as vendedor_nome,
          null::varchar as transacao_id,
          'GANHO'::varchar as status
        from public.comercial_negocio n
        inner join public.comercial_etapa etapa on etapa.id = n.etapa_id
        left join public.comercial_crm crm on crm.id = n.crm_id
        left join public.cliente c on c.id = n.cliente_id
        left join public.usuario u on u.id = n.responsavel_usuario_id
        where n.empresa_id = $1::bigint
          and n.ativo = true
          and coalesce(etapa.eh_fechamento, false) = true
          and coalesce(etapa.eh_ganho, false) = true
          and ($2::bigint is null or n.responsavel_usuario_id = $2::bigint)
          and ($4::timestamptz is null or coalesce(n.data_fechamento_real::timestamptz, n.data_fechamento_prevista::timestamptz, n.data_criacao) >= $4::timestamptz)
          and ($5::timestamptz is null or coalesce(n.data_fechamento_real::timestamptz, n.data_fechamento_prevista::timestamptz, n.data_criacao) <= $5::timestamptz)
          and (
            $3::varchar is null
            or n.titulo ilike $3
            or coalesce(c.nome, '') ilike $3
            or coalesce(n.nome_contato, '') ilike $3
            or coalesce(n.nome_empresa, '') ilike $3
          )
      `,
    ];

    if (includeHotmart) {
      sources.push(`
        select
          'hotmart'::varchar as fonte,
          e.id::text as venda_id,
          null::bigint as crm_id,
          null::varchar as funil_nome,
          e.cliente_id,
          coalesce(e.cliente_nome, c.nome, e.cliente_email, e.cliente_telefone, 'Cliente nao informado') as cliente_nome,
          coalesce(e.produto_nome, 'Venda Hotmart') as descricao,
          null::numeric as valor,
          'hotmart'::varchar as origem,
          e.recebido_em as vendido_em,
          ${hotmartHasSeller ? "e.vendedor_usuario_id" : "null::bigint"} as vendedor_id,
          ${hotmartHasSeller ? "u.nome" : "null::varchar"} as vendedor_nome,
          e.transacao_id,
          e.status_compra as status
        from public.hotmart_evento e
        left join public.cliente c on c.id = e.cliente_id
        ${hotmartHasSeller ? "left join public.usuario u on u.id = e.vendedor_usuario_id" : ""}
        where e.empresa_id = $1::bigint
          and e.categoria_evento = 'vendas'
          and ${hotmartHasSeller ? "($2::bigint is null or e.vendedor_usuario_id = $2::bigint)" : "$2::bigint is null"}
          and ($4::timestamptz is null or e.recebido_em >= $4::timestamptz)
          and ($5::timestamptz is null or e.recebido_em <= $5::timestamptz)
          and (
            $3::varchar is null
            or coalesce(e.cliente_nome, '') ilike $3
            or coalesce(e.cliente_email, '') ilike $3
            or coalesce(e.cliente_telefone, '') ilike $3
            or coalesce(e.produto_nome, '') ilike $3
            or coalesce(e.transacao_id, '') ilike $3
          )
      `);
    }

    if (includeHubla) {
      sources.push(`
        select
          'hubla'::varchar as fonte,
          e.id::text as venda_id,
          null::bigint as crm_id,
          null::varchar as funil_nome,
          e.cliente_id,
          coalesce(e.cliente_nome, c.nome, e.cliente_email, e.cliente_telefone, 'Cliente nao informado') as cliente_nome,
          coalesce(e.produto_nome, 'Venda Hubla') as descricao,
          case
            when coalesce(e.payload #>> '{event,invoice,amount,subtotalCents}', '') ~ '^\\d+(\\.\\d+)?$'
              then (e.payload #>> '{event,invoice,amount,subtotalCents}')::numeric / 100
            when coalesce(e.payload #>> '{event,invoice,amount,totalCents}', '') ~ '^\\d+(\\.\\d+)?$'
              then (e.payload #>> '{event,invoice,amount,totalCents}')::numeric / 100
            else null::numeric
          end as valor,
          'hubla'::varchar as origem,
          coalesce(
            case
              when coalesce(e.payload #>> '{event,invoice,saleDate}', '') ~ '^\\d{4}-\\d{2}-\\d{2}T'
                then (e.payload #>> '{event,invoice,saleDate}')::timestamptz
              else null::timestamptz
            end,
            e.recebido_em
          ) as vendido_em,
          ${hublaHasSeller ? "e.vendedor_usuario_id" : "null::bigint"} as vendedor_id,
          ${hublaHasSeller ? "u.nome" : "null::varchar"} as vendedor_nome,
          e.transacao_id,
          case
            when exists (
              select 1
              from public.hubla_evento refund
              where refund.integracao_id = e.integracao_id
                and refund.transacao_id = e.transacao_id
                and refund.tipo_evento = 'INVOICE.REFUNDED'
            ) then 'REEMBOLSADO'::varchar
            else e.status_compra
          end as status
        from public.hubla_evento e
        left join public.cliente c on c.id = e.cliente_id
        ${hublaHasSeller ? "left join public.usuario u on u.id = e.vendedor_usuario_id" : ""}
        where e.empresa_id = $1::bigint
          and e.categoria_evento = 'vendas'
          and e.tipo_evento = 'INVOICE.PAYMENT_SUCCEEDED'
          and ${hublaHasSeller ? "($2::bigint is null or e.vendedor_usuario_id = $2::bigint)" : "$2::bigint is null"}
          and ($4::timestamptz is null or e.recebido_em >= $4::timestamptz)
          and ($5::timestamptz is null or e.recebido_em <= $5::timestamptz)
          and (
            $3::varchar is null
            or coalesce(e.cliente_nome, '') ilike $3
            or coalesce(e.cliente_email, '') ilike $3
            or coalesce(e.cliente_telefone, '') ilike $3
            or coalesce(e.produto_nome, '') ilike $3
            or coalesce(e.transacao_id, '') ilike $3
          )
      `);
    }

    if (includeImported) {
      sources.push(`
        select
          'importada'::varchar as fonte, i.id::text as venda_id, null::bigint as crm_id,
          null::varchar as funil_nome, null::bigint as cliente_id, i.cliente_nome,
          coalesce(i.produto_nome, 'Venda importada') as descricao, i.valor, i.origem,
          i.data_venda::timestamptz as vendido_em, i.vendedor_usuario_id as vendedor_id,
          u.nome as vendedor_nome,
          null::varchar as transacao_id, 'IMPORTADA'::varchar as status
        from public.venda_importada i
        left join public.usuario u on u.id = i.vendedor_usuario_id
        where i.empresa_id = $1::bigint and i.ativo = true
          and ($2::bigint is null or i.vendedor_usuario_id = $2::bigint)
          and ($4::timestamptz is null or i.data_venda::timestamptz >= $4::timestamptz)
          and ($5::timestamptz is null or i.data_venda::timestamptz <= $5::timestamptz)
          and ($3::varchar is null or i.cliente_nome ilike $3 or coalesce(i.produto_nome, '') ilike $3)
      `);
    }

    return `
      with vendas as (${sources.join(" union all ")})
      select *
      from vendas
      where ($6::varchar is null or fonte = $6::varchar)
      order by vendido_em desc nulls last, venda_id desc
      limit $7::int offset $8::int
    `;
  },

  count_vendas_consolidadas: (options = {}) => {
    const listQuery = models
      .list_vendas_consolidadas(options)
      .replace(/select \*\n      from vendas[\s\S]*$/, "select count(*)::int as total from vendas");
    return listQuery;
  },
};

module.exports = models;
