const models = {
  ensure_hubla_integracao_table: () => {
    return `
      create table if not exists public.empresa_hubla_integracao (
        id bigserial primary key,
        empresa_id bigint not null,
        webhook_public_id character varying(64) not null,
        hubla_token character varying,
        ativo boolean not null default false,
        sincronizar_vendas boolean not null default true,
        sincronizar_carrinho_abandonado boolean not null default true,
        sincronizar_assinaturas boolean not null default false,
        sincronizar_reembolsos boolean not null default false,
        vincular_clientes_existentes boolean not null default true,
        criar_clientes_automaticamente boolean not null default true,
        ultimo_evento_em timestamptz,
        ultimo_evento_tipo character varying,
        ultima_sincronizacao_em timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `;
  },

  ensure_hubla_integracao_empresa_unique: () => {
    return `
      create unique index if not exists idx_empresa_hubla_integracao_empresa
      on public.empresa_hubla_integracao (empresa_id);
    `;
  },

  ensure_hubla_integracao_webhook_unique: () => {
    return `
      create unique index if not exists idx_empresa_hubla_integracao_webhook_public_id
      on public.empresa_hubla_integracao (webhook_public_id);
    `;
  },

  ensure_hubla_integracao_empresa_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'empresa_hubla_integracao_empresa_id_fkey'
        ) then
          alter table public.empresa_hubla_integracao
            add constraint empresa_hubla_integracao_empresa_id_fkey
            foreign key (empresa_id) references public.empresa(id) on delete cascade;
        end if;
      end
      $$;
    `;
  },

  ensure_hubla_evento_table: () => {
    return `
      create table if not exists public.hubla_evento (
        id bigserial primary key,
        empresa_id bigint not null,
        integracao_id bigint not null,
        cliente_id bigint,
        vendedor_usuario_id bigint references public.usuario(id) on delete set null,
        tipo_evento character varying not null,
        categoria_evento character varying,
        status_compra character varying,
        transacao_id character varying,
        produto_nome character varying,
        produto_codigo character varying,
        cliente_nome character varying,
        cliente_email character varying,
        cliente_telefone character varying,
        cliente_telefone_normalizado character varying,
        payload_hash character varying(64) not null,
        payload jsonb not null,
        processado boolean not null default false,
        mensagem_processamento text,
        vinculado_por_telefone boolean not null default false,
        criou_cliente boolean not null default false,
        recebido_em timestamptz not null default now(),
        created_at timestamptz not null default now()
      );
    `;
  },

  ensure_hubla_evento_unique: () => {
    return `
      create unique index if not exists idx_hubla_evento_integracao_payload_hash
      on public.hubla_evento (integracao_id, payload_hash);
    `;
  },

  ensure_hubla_evento_empresa_idx: () => {
    return `
      create index if not exists idx_hubla_evento_empresa_recebido_em
      on public.hubla_evento (empresa_id, recebido_em desc);
    `;
  },

  ensure_hubla_evento_cliente_idx: () => {
    return `
      create index if not exists idx_hubla_evento_cliente_id
      on public.hubla_evento (cliente_id);
    `;
  },

  ensure_hubla_evento_vendedor_column: () => {
    return `
      alter table public.hubla_evento
        add column if not exists vendedor_usuario_id bigint;
    `;
  },

  ensure_hubla_evento_vendedor_idx: () => {
    return `
      create index if not exists idx_hubla_evento_empresa_vendedor
      on public.hubla_evento (empresa_id, vendedor_usuario_id);
    `;
  },

  ensure_hubla_evento_vendedor_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'hubla_evento_vendedor_usuario_id_fkey'
        ) then
          alter table public.hubla_evento
            add constraint hubla_evento_vendedor_usuario_id_fkey
            foreign key (vendedor_usuario_id) references public.usuario(id) on delete set null;
        end if;
      end
      $$;
    `;
  },

  ensure_hubla_evento_empresa_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'hubla_evento_empresa_id_fkey'
        ) then
          alter table public.hubla_evento
            add constraint hubla_evento_empresa_id_fkey
            foreign key (empresa_id) references public.empresa(id) on delete cascade;
        end if;
      end
      $$;
    `;
  },

  ensure_hubla_evento_integracao_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'hubla_evento_integracao_id_fkey'
        ) then
          alter table public.hubla_evento
            add constraint hubla_evento_integracao_id_fkey
            foreign key (integracao_id) references public.empresa_hubla_integracao(id) on delete cascade;
        end if;
      end
      $$;
    `;
  },

  ensure_hubla_evento_cliente_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'hubla_evento_cliente_id_fkey'
        ) then
          alter table public.hubla_evento
            add constraint hubla_evento_cliente_id_fkey
            foreign key (cliente_id) references public.cliente(id) on delete set null;
        end if;
      end
      $$;
    `;
  },

  ensure_hubla_produto_map_table: () => {
    return `
      create table if not exists public.empresa_hubla_produto_map (
        id bigserial primary key,
        empresa_id bigint not null,
        hubla_product_key character varying(255) not null,
        hubla_product_id character varying(255),
        hubla_offer_code character varying(255),
        hubla_product_name character varying(255) not null,
        comercial_produto_id bigint not null,
        ativo boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `;
  },

  ensure_hubla_produto_map_unique: () => {
    return `
      create unique index if not exists idx_hubla_produto_map_unique
      on public.empresa_hubla_produto_map (empresa_id, hubla_product_key);
    `;
  },

  ensure_hubla_produto_map_empresa_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'empresa_hubla_produto_map_empresa_id_fkey'
        ) then
          alter table public.empresa_hubla_produto_map
            add constraint empresa_hubla_produto_map_empresa_id_fkey
            foreign key (empresa_id) references public.empresa(id) on delete cascade;
        end if;
      end
      $$;
    `;
  },

  ensure_hubla_produto_map_comercial_produto_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'empresa_hubla_produto_map_comercial_produto_id_fkey'
        ) then
          alter table public.empresa_hubla_produto_map
            add constraint empresa_hubla_produto_map_comercial_produto_id_fkey
            foreign key (comercial_produto_id) references public.comercial_produto(id) on delete cascade;
        end if;
      end
      $$;
    `;
  },

  ensure_hubla_utm_vendedor_table: () => {
    return `
      create table if not exists public.empresa_hubla_utm_vendedor (
        id bigserial primary key,
        empresa_id bigint not null references public.empresa(id) on delete cascade,
        vendedor_usuario_id bigint not null references public.usuario(id) on delete cascade,
        utm_campo character varying(20) not null,
        utm_valor character varying(255) not null,
        utm_valor_normalizado character varying(255) not null,
        ativo boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint empresa_hubla_utm_vendedor_campo_check
          check (utm_campo in ('source', 'medium', 'campaign', 'content', 'term'))
      );
    `;
  },

  ensure_hubla_utm_vendedor_unique: () => {
    return `
      create unique index if not exists idx_hubla_utm_vendedor_unique
      on public.empresa_hubla_utm_vendedor (
        empresa_id,
        utm_campo,
        utm_valor_normalizado
      );
    `;
  },

  ensure_hubla_utm_vendedor_lookup_idx: () => {
    return `
      create index if not exists idx_hubla_utm_vendedor_lookup
      on public.empresa_hubla_utm_vendedor (
        empresa_id,
        utm_campo,
        utm_valor_normalizado,
        id
      )
      where ativo = true;
    `;
  },

  ensure_hubla_integracao: () => {
    return `
      insert into public.empresa_hubla_integracao (
        empresa_id,
        webhook_public_id,
        ativo,
        sincronizar_vendas,
        sincronizar_carrinho_abandonado,
        sincronizar_assinaturas,
        sincronizar_reembolsos,
        vincular_clientes_existentes,
        criar_clientes_automaticamente,
        updated_at
      )
      values (
        $1::bigint,
        substring(md5(random()::text || clock_timestamp()::text || $1::text || 'hubla'), 1, 32),
        false,
        true,
        true,
        false,
        false,
        true,
        true,
        now()
      )
      on conflict (empresa_id)
      do update set
        webhook_public_id = coalesce(
          nullif(public.empresa_hubla_integracao.webhook_public_id, ''),
          excluded.webhook_public_id
        ),
        updated_at = now()
      returning *
    `;
  },

  get_hubla_integracao_by_empresa: () => {
    return `
      select *
      from public.empresa_hubla_integracao
      where empresa_id = $1::bigint
      limit 1
    `;
  },

  get_hubla_integracao_by_webhook_public_id: () => {
    return `
      select
        i.*,
        e.ativo as empresa_ativa
      from public.empresa_hubla_integracao i
      inner join public.empresa e
        on e.id = i.empresa_id
      where i.webhook_public_id = $1
      limit 1
    `;
  },

  update_hubla_integracao: () => {
    return `
      update public.empresa_hubla_integracao
      set
        hubla_token = $2,
        ativo = $3,
        sincronizar_vendas = $4,
        sincronizar_carrinho_abandonado = $5,
        sincronizar_assinaturas = $6,
        sincronizar_reembolsos = $7,
        vincular_clientes_existentes = $8,
        criar_clientes_automaticamente = $9,
        updated_at = now()
      where empresa_id = $1::bigint
      returning *
    `;
  },

  update_hubla_integracao_last_event: () => {
    return `
      update public.empresa_hubla_integracao
      set
        ultimo_evento_em = now(),
        ultimo_evento_tipo = $2,
        ultima_sincronizacao_em = case when $3::boolean then now() else ultima_sincronizacao_em end,
        updated_at = now()
      where id = $1
      returning *
    `;
  },

  insert_hubla_evento: () => {
    return `
      insert into public.hubla_evento (
        empresa_id,
        integracao_id,
        cliente_id,
        tipo_evento,
        categoria_evento,
        status_compra,
        transacao_id,
        produto_nome,
        produto_codigo,
        cliente_nome,
        cliente_email,
        cliente_telefone,
        cliente_telefone_normalizado,
        payload_hash,
        payload,
        processado,
        mensagem_processamento,
        vinculado_por_telefone,
        criou_cliente,
        recebido_em
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
        $14,
        $15::jsonb,
        $16,
        $17,
        $18,
        $19,
        now()
      )
      on conflict (integracao_id, payload_hash) do nothing
      returning *
    `;
  },

  get_hubla_evento_by_hash: () => {
    return `
      select *
      from public.hubla_evento
      where integracao_id = $1
        and payload_hash = $2
      limit 1
    `;
  },

  reconcile_hubla_refunded_sale: () => {
    return `
      update public.hubla_evento sale
      set status_compra = 'REFUNDED'
      where sale.integracao_id = $1
        and sale.transacao_id = $2
        and sale.tipo_evento = 'INVOICE.PAYMENT_SUCCEEDED'
        and exists (
          select 1
          from public.hubla_evento refund
          where refund.integracao_id = sale.integracao_id
            and refund.transacao_id = sale.transacao_id
            and refund.tipo_evento = 'INVOICE.REFUNDED'
        )
      returning sale.id
    `;
  },

  get_hubla_eventos_recentes: () => {
    return `
      select
        id,
        cliente_id,
        tipo_evento,
        categoria_evento,
        status_compra,
        transacao_id,
        produto_nome,
        produto_codigo,
        cliente_nome,
        cliente_email,
        cliente_telefone,
        cliente_telefone_normalizado,
        processado,
        mensagem_processamento,
        vinculado_por_telefone,
        criou_cliente,
        recebido_em
      from public.hubla_evento
      where empresa_id = $1::bigint
      order by recebido_em desc, id desc
      limit $2::int
    `;
  },

  get_hubla_eventos_summary: () => {
    return `
      select
        count(*)::int as total_eventos,
        count(*) filter (where processado = true)::int as total_processados,
        count(*) filter (where cliente_id is not null)::int as total_clientes_vinculados,
        max(recebido_em) as ultimo_evento_em,
        max(recebido_em) filter (where processado = true) as ultima_sincronizacao_em
      from public.hubla_evento
      where empresa_id = $1::bigint
    `;
  },

  get_comercial_produto_by_id: () => {
    return `
      select
        id,
        empresa_id,
        nome,
        descricao,
        preco_base,
        ativo
      from public.comercial_produto
      where id = $1::bigint
        and empresa_id = $2::bigint
      limit 1
    `;
  },

  get_hubla_produto_map_by_key: () => {
    return `
      select
        map.id,
        map.empresa_id,
        map.hubla_product_key,
        map.hubla_product_id,
        map.hubla_offer_code,
        map.hubla_product_name,
        map.comercial_produto_id,
        map.ativo,
        map.created_at,
        map.updated_at,
        cp.nome as comercial_produto_nome,
        cp.preco_base as comercial_produto_preco_base
      from public.empresa_hubla_produto_map map
      inner join public.comercial_produto cp
        on cp.id = map.comercial_produto_id
      where map.empresa_id = $1::bigint
        and map.hubla_product_key = $2
        and map.ativo = true
      limit 1
    `;
  },

  upsert_hubla_produto_map: () => {
    return `
      insert into public.empresa_hubla_produto_map (
        empresa_id,
        hubla_product_key,
        hubla_product_id,
        hubla_offer_code,
        hubla_product_name,
        comercial_produto_id,
        ativo,
        updated_at
      )
      values (
        $1::bigint,
        $2,
        $3,
        $4,
        $5,
        $6::bigint,
        true,
        now()
      )
      on conflict (empresa_id, hubla_product_key)
      do update set
        hubla_product_id = excluded.hubla_product_id,
        hubla_offer_code = excluded.hubla_offer_code,
        hubla_product_name = excluded.hubla_product_name,
        comercial_produto_id = excluded.comercial_produto_id,
        ativo = true,
        updated_at = now()
      returning *
    `;
  },

  deactivate_hubla_produto_map: () => {
    return `
      update public.empresa_hubla_produto_map
      set
        ativo = false,
        updated_at = now()
      where empresa_id = $1::bigint
        and hubla_product_key = $2
      returning *
    `;
  },

  list_hubla_vendedores: () => {
    return `
      select id, nome
      from public.usuario
      where empresa_id = $1::bigint
        and ativo = true
      order by nome asc, id asc
    `;
  },

  list_hubla_utm_vendedor_rules: () => {
    return `
      select
        rule.id,
        rule.vendedor_usuario_id,
        usuario.nome as vendedor_nome,
        rule.utm_campo,
        rule.utm_valor,
        rule.created_at
      from public.empresa_hubla_utm_vendedor rule
      inner join public.usuario usuario
        on usuario.id = rule.vendedor_usuario_id
       and usuario.empresa_id = rule.empresa_id
      where rule.empresa_id = $1::bigint
        and rule.ativo = true
      order by rule.id asc
    `;
  },

  get_hubla_vendedor_for_utm: () => {
    return `
      select
        rule.id,
        rule.vendedor_usuario_id,
        usuario.nome as vendedor_nome,
        rule.utm_campo,
        rule.utm_valor
      from public.empresa_hubla_utm_vendedor rule
      inner join public.usuario usuario
        on usuario.id = rule.vendedor_usuario_id
       and usuario.empresa_id = rule.empresa_id
       and usuario.ativo = true
      where rule.empresa_id = $1::bigint
        and rule.ativo = true
        and rule.utm_valor_normalizado = case rule.utm_campo
          when 'source' then lower(btrim(coalesce($2, '')))
          when 'medium' then lower(btrim(coalesce($3, '')))
          when 'campaign' then lower(btrim(coalesce($4, '')))
          when 'content' then lower(btrim(coalesce($5, '')))
          when 'term' then lower(btrim(coalesce($6, '')))
        end
      order by rule.id asc
      limit 1
    `;
  },

  get_hubla_vendedor_by_id: () => {
    return `
      select id, nome
      from public.usuario
      where id = $1::bigint
        and empresa_id = $2::bigint
        and ativo = true
      limit 1
    `;
  },

  upsert_hubla_utm_vendedor_rule: () => {
    return `
      insert into public.empresa_hubla_utm_vendedor (
        empresa_id,
        vendedor_usuario_id,
        utm_campo,
        utm_valor,
        utm_valor_normalizado,
        ativo,
        updated_at
      )
      values ($1::bigint, $2::bigint, $3, $4, $5, true, now())
      on conflict (empresa_id, utm_campo, utm_valor_normalizado)
      do update set
        vendedor_usuario_id = excluded.vendedor_usuario_id,
        utm_valor = excluded.utm_valor,
        ativo = true,
        updated_at = now()
      returning *
    `;
  },

  deactivate_hubla_utm_vendedor_rule: () => {
    return `
      update public.empresa_hubla_utm_vendedor
      set ativo = false, updated_at = now()
      where id = $1::bigint
        and empresa_id = $2::bigint
      returning id
    `;
  },

  assign_hubla_evento_vendedor_if_empty: () => {
    return `
      update public.hubla_evento
      set vendedor_usuario_id = coalesce(vendedor_usuario_id, $2::bigint)
      where id = $1::bigint
      returning *
    `;
  },

  list_hubla_produtos_detectados: () => {
    return `
      with latest_events as (
        select distinct on (
          coalesce(
            nullif(trim(coalesce(e.produto_codigo, '')), ''),
            upper(trim(coalesce(e.produto_nome, '')))
          )
        )
          coalesce(
            nullif(trim(coalesce(e.produto_codigo, '')), ''),
            upper(trim(coalesce(e.produto_nome, '')))
          ) as hubla_product_key,
          nullif(trim(coalesce(e.produto_codigo, '')), '') as hubla_product_id,
          nullif(trim(coalesce(e.produto_nome, '')), '') as hubla_product_name,
          e.tipo_evento as ultimo_tipo_evento,
          e.status_compra as ultimo_status_compra,
          e.recebido_em as ultimo_recebimento_em
        from public.hubla_evento e
        where e.empresa_id = $1::bigint
          and coalesce(
            nullif(trim(coalesce(e.produto_codigo, '')), ''),
            nullif(trim(coalesce(e.produto_nome, '')), '')
          ) is not null
        order by
          coalesce(
            nullif(trim(coalesce(e.produto_codigo, '')), ''),
            upper(trim(coalesce(e.produto_nome, '')))
          ),
          e.recebido_em desc,
          e.id desc
      ),
      aggregates as (
        select
          coalesce(
            nullif(trim(coalesce(e.produto_codigo, '')), ''),
            upper(trim(coalesce(e.produto_nome, '')))
          ) as hubla_product_key,
          count(*)::int as total_eventos
        from public.hubla_evento e
        where e.empresa_id = $1::bigint
          and coalesce(
            nullif(trim(coalesce(e.produto_codigo, '')), ''),
            nullif(trim(coalesce(e.produto_nome, '')), '')
          ) is not null
        group by 1
      )
      select
        latest.hubla_product_key,
        latest.hubla_product_id,
        null::varchar as hubla_offer_code,
        latest.hubla_product_name,
        aggregates.total_eventos,
        latest.ultimo_recebimento_em,
        latest.ultimo_tipo_evento,
        latest.ultimo_status_compra,
        map.comercial_produto_id,
        cp.nome as comercial_produto_nome,
        cp.preco_base as comercial_produto_preco_base
      from latest_events latest
      inner join aggregates
        on aggregates.hubla_product_key = latest.hubla_product_key
      left join public.empresa_hubla_produto_map map
        on map.empresa_id = $1::bigint
       and map.hubla_product_key = latest.hubla_product_key
       and map.ativo = true
      left join public.comercial_produto cp
        on cp.id = map.comercial_produto_id
      order by latest.ultimo_recebimento_em desc nulls last, latest.hubla_product_name asc nulls last
    `;
  },
};

module.exports = models;
