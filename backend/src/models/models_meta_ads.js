const models = {
  ensure_empresa_meta_ads_accounts_table: () => {
    return `
      create table if not exists public.empresa_meta_ads_accounts (
        id serial primary key,
        empresa_id integer not null,
        meta_business_id character varying,
        meta_business_name character varying,
        meta_ad_account_id character varying not null,
        meta_ad_account_name character varying,
        meta_ad_account_status character varying,
        meta_currency character varying,
        meta_timezone_id character varying,
        meta_timezone_name character varying,
        meta_account_id character varying,
        meta_disable_reason character varying,
        meta_graph_api_version character varying,
        meta_access_token text,
        meta_access_token_type character varying,
        meta_token_expires_in integer,
        meta_access_token_expires_at timestamp without time zone,
        meta_last_embedded_signup_at timestamp without time zone,
        meta_payload jsonb,
        created_at timestamp without time zone default current_timestamp,
        updated_at timestamp without time zone default current_timestamp
      );
    `;
  },

  ensure_empresa_meta_ads_accounts_unique: () => {
    return `
      create unique index if not exists idx_empresa_meta_ads_accounts_unique
      on public.empresa_meta_ads_accounts (empresa_id, meta_ad_account_id);
    `;
  },

  ensure_empresa_meta_ads_access_token_column: () => {
    return `
      alter table public.empresa_meta_ads_accounts
      add column if not exists meta_access_token text;
    `;
  },

  ensure_cliente_meta_ads_leads_table: () => {
    return `
      create table if not exists public.cliente_meta_ads_lead (
        id serial primary key,
        empresa_id integer not null,
        cliente_id integer not null,
        meta_ads_account_id character varying not null,
        meta_lead_id character varying not null,
        meta_form_id character varying,
        meta_form_name character varying,
        meta_campaign_id character varying,
        meta_campaign_name character varying,
        meta_ad_id character varying,
        meta_ad_name character varying,
        payload jsonb,
        created_at timestamp without time zone default current_timestamp not null,
        updated_at timestamp without time zone default current_timestamp not null
      );
    `;
  },

  ensure_cliente_meta_ads_leads_unique: () => {
    return `
      create unique index if not exists idx_cliente_meta_ads_lead_unique
      on public.cliente_meta_ads_lead (empresa_id, meta_lead_id);
    `;
  },

  ensure_cliente_meta_ads_leads_cliente_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'cliente_meta_ads_lead_cliente_id_fkey'
        ) then
          alter table public.cliente_meta_ads_lead
            add constraint cliente_meta_ads_lead_cliente_id_fkey
            foreign key (cliente_id) references public.cliente(id) on delete cascade;
        end if;
      end $$;
    `;
  },

  ensure_cliente_meta_ads_leads_empresa_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'cliente_meta_ads_lead_empresa_id_fkey'
        ) then
          alter table public.cliente_meta_ads_lead
            add constraint cliente_meta_ads_lead_empresa_id_fkey
            foreign key (empresa_id) references public.empresa(id) on delete cascade;
        end if;
      end $$;
    `;
  },

  ensure_meta_ads_field_mapping_table: () => {
    return `
      create table if not exists public.empresa_meta_ads_field_mapping (
        id serial primary key,
        empresa_id integer not null,
        escopo_tipo character varying(20) not null,
        escopo_id character varying not null,
        escopo_nome character varying,
        campo_nome character varying,
        campo_telefone character varying,
        campo_email character varying,
        created_at timestamp without time zone default current_timestamp not null,
        updated_at timestamp without time zone default current_timestamp not null
      );
    `;
  },

  ensure_meta_ads_field_mapping_unique: () => {
    return `
      create unique index if not exists idx_empresa_meta_ads_field_mapping_unique
      on public.empresa_meta_ads_field_mapping (empresa_id, escopo_tipo, escopo_id);
    `;
  },

  ensure_meta_ads_field_mapping_empresa_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'empresa_meta_ads_field_mapping_empresa_id_fkey'
        ) then
          alter table public.empresa_meta_ads_field_mapping
            add constraint empresa_meta_ads_field_mapping_empresa_id_fkey
            foreign key (empresa_id) references public.empresa(id) on delete cascade;
        end if;
      end $$;
    `;
  },

  get_meta_ads_accounts: () => {
    return `
      select
        id,
        empresa_id,
        meta_business_id,
        meta_business_name,
        meta_ad_account_id,
        meta_ad_account_name,
        meta_ad_account_status,
        meta_currency,
        meta_timezone_id,
        meta_timezone_name,
        meta_account_id,
        meta_disable_reason,
        meta_graph_api_version,
        meta_access_token,
        meta_access_token_type,
        meta_token_expires_in,
        meta_access_token_expires_at,
        meta_last_embedded_signup_at,
        meta_payload,
        created_at,
        updated_at
      from public.empresa_meta_ads_accounts
      where empresa_id = $1
      order by meta_ad_account_name nulls last, id desc
    `;
  },

  get_meta_ads_account_by_ad_account_id: () => {
    return `
      select
        id,
        empresa_id,
        meta_business_id,
        meta_business_name,
        meta_ad_account_id,
        meta_ad_account_name,
        meta_ad_account_status,
        meta_currency,
        meta_timezone_id,
        meta_timezone_name,
        meta_account_id,
        meta_disable_reason,
        meta_graph_api_version,
        meta_access_token,
        meta_access_token_type,
        meta_token_expires_in,
        meta_access_token_expires_at,
        meta_last_embedded_signup_at,
        meta_payload,
        created_at,
        updated_at
      from public.empresa_meta_ads_accounts
      where empresa_id = $1
        and meta_ad_account_id = $2
      limit 1
    `;
  },

  get_cliente_meta_ads_leads_by_ids: () => {
    return `
      select
        id,
        empresa_id,
        cliente_id,
        meta_ads_account_id,
        meta_lead_id,
        meta_form_id,
        meta_form_name,
        meta_campaign_id,
        meta_campaign_name,
        meta_ad_id,
        meta_ad_name,
        payload,
        created_at,
        updated_at
      from public.cliente_meta_ads_lead
      where empresa_id = $1
        and meta_lead_id = any($2::varchar[])
    `;
  },

  get_cliente_meta_ads_lead_by_lead_id: () => {
    return `
      select
        id,
        empresa_id,
        cliente_id,
        meta_ads_account_id,
        meta_lead_id,
        meta_form_id,
        meta_form_name,
        meta_campaign_id,
        meta_campaign_name,
        meta_ad_id,
        meta_ad_name,
        payload,
        created_at,
        updated_at
      from public.cliente_meta_ads_lead
      where empresa_id = $1
        and meta_lead_id = $2
      limit 1
    `;
  },

  get_meta_ads_field_mapping_by_scope: () => {
    return `
      select
        id,
        empresa_id,
        escopo_tipo,
        escopo_id,
        escopo_nome,
        campo_nome,
        campo_telefone,
        campo_email,
        created_at,
        updated_at
      from public.empresa_meta_ads_field_mapping
      where empresa_id = $1
        and escopo_tipo = $2
        and escopo_id = $3
      limit 1
    `;
  },

  get_meta_ads_field_mappings_by_scope_ids: () => {
    return `
      select
        id,
        empresa_id,
        escopo_tipo,
        escopo_id,
        escopo_nome,
        campo_nome,
        campo_telefone,
        campo_email,
        created_at,
        updated_at
      from public.empresa_meta_ads_field_mapping
      where empresa_id = $1
        and (
          ($2::varchar[] is not null and escopo_tipo = 'form' and escopo_id = any($2::varchar[]))
          or ($3::varchar[] is not null and escopo_tipo = 'campaign' and escopo_id = any($3::varchar[]))
        )
      order by escopo_tipo, escopo_id
    `;
  },

  upsert_meta_ads_field_mapping: () => {
    return `
      insert into public.empresa_meta_ads_field_mapping (
        empresa_id,
        escopo_tipo,
        escopo_id,
        escopo_nome,
        campo_nome,
        campo_telefone,
        campo_email,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, current_timestamp
      )
      on conflict (empresa_id, escopo_tipo, escopo_id)
      do update set
        escopo_nome = excluded.escopo_nome,
        campo_nome = excluded.campo_nome,
        campo_telefone = excluded.campo_telefone,
        campo_email = excluded.campo_email,
        updated_at = current_timestamp
      returning *
    `;
  },

  upsert_cliente_meta_ads_lead: () => {
    return `
      insert into public.cliente_meta_ads_lead (
        empresa_id,
        cliente_id,
        meta_ads_account_id,
        meta_lead_id,
        meta_form_id,
        meta_form_name,
        meta_campaign_id,
        meta_campaign_name,
        meta_ad_id,
        meta_ad_name,
        payload,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, current_timestamp
      )
      on conflict (empresa_id, meta_lead_id)
      do update set
        cliente_id = excluded.cliente_id,
        meta_ads_account_id = excluded.meta_ads_account_id,
        meta_form_id = excluded.meta_form_id,
        meta_form_name = excluded.meta_form_name,
        meta_campaign_id = excluded.meta_campaign_id,
        meta_campaign_name = excluded.meta_campaign_name,
        meta_ad_id = excluded.meta_ad_id,
        meta_ad_name = excluded.meta_ad_name,
        payload = excluded.payload,
        updated_at = current_timestamp
      returning *
    `;
  },

  delete_meta_ads_accounts_not_in: () => {
    return `
      delete from public.empresa_meta_ads_accounts
      where empresa_id = $1
        and not (meta_ad_account_id = any($2::varchar[]))
    `;
  },

  delete_all_meta_ads_accounts: () => {
    return `
      delete from public.empresa_meta_ads_accounts
      where empresa_id = $1
    `;
  },

  upsert_meta_ads_account: () => {
    return `
      insert into public.empresa_meta_ads_accounts (
        empresa_id,
        meta_business_id,
        meta_business_name,
        meta_ad_account_id,
        meta_ad_account_name,
        meta_ad_account_status,
        meta_currency,
        meta_timezone_id,
        meta_timezone_name,
        meta_account_id,
        meta_disable_reason,
        meta_graph_api_version,
        meta_access_token,
        meta_access_token_type,
        meta_token_expires_in,
        meta_access_token_expires_at,
        meta_last_embedded_signup_at,
        meta_payload,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, current_timestamp, $17, current_timestamp
      )
      on conflict (empresa_id, meta_ad_account_id)
      do update set
        meta_business_id = excluded.meta_business_id,
        meta_business_name = excluded.meta_business_name,
        meta_ad_account_name = excluded.meta_ad_account_name,
        meta_ad_account_status = excluded.meta_ad_account_status,
        meta_currency = excluded.meta_currency,
        meta_timezone_id = excluded.meta_timezone_id,
        meta_timezone_name = excluded.meta_timezone_name,
        meta_account_id = excluded.meta_account_id,
        meta_disable_reason = excluded.meta_disable_reason,
        meta_graph_api_version = excluded.meta_graph_api_version,
        meta_access_token = excluded.meta_access_token,
        meta_access_token_type = excluded.meta_access_token_type,
        meta_token_expires_in = excluded.meta_token_expires_in,
        meta_access_token_expires_at = excluded.meta_access_token_expires_at,
        meta_last_embedded_signup_at = current_timestamp,
        meta_payload = excluded.meta_payload,
        updated_at = current_timestamp
      returning *
    `;
  }
};

module.exports = models;
