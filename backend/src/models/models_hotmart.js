const models = {
  ensure_hotmart_integracao_table: () => {
    return `
      create table if not exists public.empresa_hotmart_integracao (
        id bigserial primary key,
        empresa_id bigint not null,
        webhook_public_id character varying(64) not null,
        hottok character varying,
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

  ensure_hotmart_integracao_empresa_unique: () => {
    return `
      create unique index if not exists idx_empresa_hotmart_integracao_empresa
      on public.empresa_hotmart_integracao (empresa_id);
    `;
  },

  ensure_hotmart_integracao_webhook_unique: () => {
    return `
      create unique index if not exists idx_empresa_hotmart_integracao_webhook_public_id
      on public.empresa_hotmart_integracao (webhook_public_id);
    `;
  },

  ensure_hotmart_integracao_empresa_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'empresa_hotmart_integracao_empresa_id_fkey'
        ) then
          alter table public.empresa_hotmart_integracao
            add constraint empresa_hotmart_integracao_empresa_id_fkey
            foreign key (empresa_id) references public.empresa(id) on delete cascade;
        end if;
      end
      $$;
    `;
  },

  ensure_hotmart_evento_table: () => {
    return `
      create table if not exists public.hotmart_evento (
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

  ensure_hotmart_evento_unique: () => {
    return `
      create unique index if not exists idx_hotmart_evento_integracao_payload_hash
      on public.hotmart_evento (integracao_id, payload_hash);
    `;
  },

  ensure_hotmart_evento_empresa_idx: () => {
    return `
      create index if not exists idx_hotmart_evento_empresa_recebido_em
      on public.hotmart_evento (empresa_id, recebido_em desc);
    `;
  },

  ensure_hotmart_evento_cliente_idx: () => {
    return `
      create index if not exists idx_hotmart_evento_cliente_id
      on public.hotmart_evento (cliente_id);
    `;
  },

  ensure_hotmart_evento_empresa_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'hotmart_evento_empresa_id_fkey'
        ) then
          alter table public.hotmart_evento
            add constraint hotmart_evento_empresa_id_fkey
            foreign key (empresa_id) references public.empresa(id) on delete cascade;
        end if;
      end
      $$;
    `;
  },

  ensure_hotmart_evento_integracao_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'hotmart_evento_integracao_id_fkey'
        ) then
          alter table public.hotmart_evento
            add constraint hotmart_evento_integracao_id_fkey
            foreign key (integracao_id) references public.empresa_hotmart_integracao(id) on delete cascade;
        end if;
      end
      $$;
    `;
  },

  ensure_hotmart_evento_cliente_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'hotmart_evento_cliente_id_fkey'
        ) then
          alter table public.hotmart_evento
            add constraint hotmart_evento_cliente_id_fkey
            foreign key (cliente_id) references public.cliente(id) on delete set null;
        end if;
      end
      $$;
    `;
  },

  ensure_hotmart_produto_map_table: () => {
    return `
      create table if not exists public.empresa_hotmart_produto_map (
        id bigserial primary key,
        empresa_id bigint not null,
        hotmart_product_key character varying(255) not null,
        hotmart_product_id character varying(255),
        hotmart_offer_code character varying(255),
        hotmart_product_name character varying(255) not null,
        comercial_produto_id bigint not null,
        ativo boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `;
  },

  ensure_hotmart_produto_map_unique: () => {
    return `
      create unique index if not exists idx_hotmart_produto_map_unique
      on public.empresa_hotmart_produto_map (empresa_id, hotmart_product_key);
    `;
  },

  ensure_hotmart_produto_map_empresa_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'empresa_hotmart_produto_map_empresa_id_fkey'
        ) then
          alter table public.empresa_hotmart_produto_map
            add constraint empresa_hotmart_produto_map_empresa_id_fkey
            foreign key (empresa_id) references public.empresa(id) on delete cascade;
        end if;
      end
      $$;
    `;
  },

  ensure_hotmart_produto_map_comercial_produto_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'empresa_hotmart_produto_map_comercial_produto_id_fkey'
        ) then
          alter table public.empresa_hotmart_produto_map
            add constraint empresa_hotmart_produto_map_comercial_produto_id_fkey
            foreign key (comercial_produto_id) references public.comercial_produto(id) on delete cascade;
        end if;
      end
      $$;
    `;
  },

  ensure_hotmart_integracao: () => {
    return `
      insert into public.empresa_hotmart_integracao (
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
        substring(md5(random()::text || clock_timestamp()::text || $1::text || 'hotmart'), 1, 32),
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
          nullif(public.empresa_hotmart_integracao.webhook_public_id, ''),
          excluded.webhook_public_id
        ),
        updated_at = now()
      returning *
    `;
  },

  get_hotmart_integracao_by_empresa: () => {
    return `
      select *
      from public.empresa_hotmart_integracao
      where empresa_id = $1::bigint
      limit 1
    `;
  },

  get_hotmart_integracao_by_webhook_public_id: () => {
    return `
      select
        i.*,
        e.ativo as empresa_ativa
      from public.empresa_hotmart_integracao i
      inner join public.empresa e
        on e.id = i.empresa_id
      where i.webhook_public_id = $1
      limit 1
    `;
  },

  update_hotmart_integracao: () => {
    return `
      update public.empresa_hotmart_integracao
      set
        hottok = $2,
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

  update_hotmart_integracao_last_event: () => {
    return `
      update public.empresa_hotmart_integracao
      set
        ultimo_evento_em = now(),
        ultimo_evento_tipo = $2,
        ultima_sincronizacao_em = case when $3::boolean then now() else ultima_sincronizacao_em end,
        updated_at = now()
      where id = $1
      returning *
    `;
  },

  insert_hotmart_evento: () => {
    return `
      insert into public.hotmart_evento (
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

  get_hotmart_evento_by_hash: () => {
    return `
      select *
      from public.hotmart_evento
      where integracao_id = $1
        and payload_hash = $2
      limit 1
    `;
  },

  get_hotmart_eventos_recentes: () => {
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
      from public.hotmart_evento
      where empresa_id = $1::bigint
      order by recebido_em desc, id desc
      limit $2::int
    `;
  },

  get_hotmart_eventos_summary: () => {
    return `
      select
        count(*)::int as total_eventos,
        count(*) filter (where processado = true)::int as total_processados,
        count(*) filter (where cliente_id is not null)::int as total_clientes_vinculados,
        max(recebido_em) as ultimo_evento_em,
        max(recebido_em) filter (where processado = true) as ultima_sincronizacao_em
      from public.hotmart_evento
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

  get_hotmart_produto_map_by_key: () => {
    return `
      select
        map.id,
        map.empresa_id,
        map.hotmart_product_key,
        map.hotmart_product_id,
        map.hotmart_offer_code,
        map.hotmart_product_name,
        map.comercial_produto_id,
        map.ativo,
        map.created_at,
        map.updated_at,
        cp.nome as comercial_produto_nome,
        cp.preco_base as comercial_produto_preco_base
      from public.empresa_hotmart_produto_map map
      inner join public.comercial_produto cp
        on cp.id = map.comercial_produto_id
      where map.empresa_id = $1::bigint
        and map.hotmart_product_key = $2
        and map.ativo = true
      limit 1
    `;
  },

  upsert_hotmart_produto_map: () => {
    return `
      insert into public.empresa_hotmart_produto_map (
        empresa_id,
        hotmart_product_key,
        hotmart_product_id,
        hotmart_offer_code,
        hotmart_product_name,
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
      on conflict (empresa_id, hotmart_product_key)
      do update set
        hotmart_product_id = excluded.hotmart_product_id,
        hotmart_offer_code = excluded.hotmart_offer_code,
        hotmart_product_name = excluded.hotmart_product_name,
        comercial_produto_id = excluded.comercial_produto_id,
        ativo = true,
        updated_at = now()
      returning *
    `;
  },

  deactivate_hotmart_produto_map: () => {
    return `
      update public.empresa_hotmart_produto_map
      set
        ativo = false,
        updated_at = now()
      where empresa_id = $1::bigint
        and hotmart_product_key = $2
      returning *
    `;
  },

  list_hotmart_produtos_detectados: () => {
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
          ) as hotmart_product_key,
          nullif(trim(coalesce(e.produto_codigo, '')), '') as hotmart_product_id,
          nullif(trim(coalesce(e.produto_nome, '')), '') as hotmart_product_name,
          e.tipo_evento as ultimo_tipo_evento,
          e.status_compra as ultimo_status_compra,
          e.recebido_em as ultimo_recebimento_em
        from public.hotmart_evento e
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
          ) as hotmart_product_key,
          count(*)::int as total_eventos
        from public.hotmart_evento e
        where e.empresa_id = $1::bigint
          and coalesce(
            nullif(trim(coalesce(e.produto_codigo, '')), ''),
            nullif(trim(coalesce(e.produto_nome, '')), '')
          ) is not null
        group by 1
      )
      select
        latest.hotmart_product_key,
        latest.hotmart_product_id,
        null::varchar as hotmart_offer_code,
        latest.hotmart_product_name,
        aggregates.total_eventos,
        latest.ultimo_recebimento_em,
        latest.ultimo_tipo_evento,
        latest.ultimo_status_compra,
        map.comercial_produto_id,
        cp.nome as comercial_produto_nome,
        cp.preco_base as comercial_produto_preco_base
      from latest_events latest
      inner join aggregates
        on aggregates.hotmart_product_key = latest.hotmart_product_key
      left join public.empresa_hotmart_produto_map map
        on map.empresa_id = $1::bigint
       and map.hotmart_product_key = latest.hotmart_product_key
       and map.ativo = true
      left join public.comercial_produto cp
        on cp.id = map.comercial_produto_id
      order by latest.ultimo_recebimento_em desc nulls last, latest.hotmart_product_name asc nulls last
    `;
  },
};

module.exports = models;
