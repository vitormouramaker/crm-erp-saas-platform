const models = {
  ensure_empresa_google_ads_accounts_table: () => {
    return `
      create table if not exists public.empresa_google_ads_accounts (
        id serial primary key,
        empresa_id integer not null,
        google_customer_id character varying not null,
        google_customer_name character varying,
        google_currency_code character varying(20),
        google_time_zone character varying(120),
        google_status character varying(40),
        google_manager boolean default false not null,
        google_test_account boolean default false not null,
        google_resource_name character varying,
        google_login_customer_id character varying,
        google_access_token text,
        google_refresh_token text,
        google_token_type character varying(40),
        google_token_scope text,
        google_token_expires_in integer,
        google_access_token_expires_at timestamp without time zone,
        google_last_oauth_at timestamp without time zone,
        google_payload jsonb,
        created_at timestamp without time zone default current_timestamp not null,
        updated_at timestamp without time zone default current_timestamp not null
      );
    `;
  },

  ensure_empresa_google_ads_accounts_unique: () => {
    return `
      create unique index if not exists idx_empresa_google_ads_accounts_unique
      on public.empresa_google_ads_accounts (empresa_id, google_customer_id);
    `;
  },

  ensure_empresa_google_ads_accounts_empresa_fk: () => {
    return `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'empresa_google_ads_accounts_empresa_id_fkey'
        ) then
          alter table public.empresa_google_ads_accounts
            add constraint empresa_google_ads_accounts_empresa_id_fkey
            foreign key (empresa_id) references public.empresa(id) on delete cascade;
        end if;
      end $$;
    `;
  },

  get_google_ads_accounts: () => {
    return `
      select
        id,
        empresa_id,
        google_customer_id,
        google_customer_name,
        google_currency_code,
        google_time_zone,
        google_status,
        google_manager,
        google_test_account,
        google_resource_name,
        google_login_customer_id,
        google_access_token,
        google_refresh_token,
        google_token_type,
        google_token_scope,
        google_token_expires_in,
        google_access_token_expires_at,
        google_last_oauth_at,
        google_payload,
        created_at,
        updated_at
      from public.empresa_google_ads_accounts
      where empresa_id = $1
      order by google_customer_name nulls last, google_customer_id, id desc
    `;
  },

  get_google_ads_account_by_customer_id: () => {
    return `
      select
        id,
        empresa_id,
        google_customer_id,
        google_customer_name,
        google_currency_code,
        google_time_zone,
        google_status,
        google_manager,
        google_test_account,
        google_resource_name,
        google_login_customer_id,
        google_access_token,
        google_refresh_token,
        google_token_type,
        google_token_scope,
        google_token_expires_in,
        google_access_token_expires_at,
        google_last_oauth_at,
        google_payload,
        created_at,
        updated_at
      from public.empresa_google_ads_accounts
      where empresa_id = $1
        and google_customer_id = $2
      limit 1
    `;
  },

  delete_google_ads_accounts_not_in: () => {
    return `
      delete from public.empresa_google_ads_accounts
      where empresa_id = $1
        and not (google_customer_id = any($2::varchar[]))
    `;
  },

  delete_all_google_ads_accounts: () => {
    return `
      delete from public.empresa_google_ads_accounts
      where empresa_id = $1
    `;
  },

  delete_google_ads_account_by_customer_id: () => {
    return `
      delete from public.empresa_google_ads_accounts
      where empresa_id = $1
        and google_customer_id = $2
      returning *
    `;
  },

  upsert_google_ads_account: () => {
    return `
      insert into public.empresa_google_ads_accounts (
        empresa_id,
        google_customer_id,
        google_customer_name,
        google_currency_code,
        google_time_zone,
        google_status,
        google_manager,
        google_test_account,
        google_resource_name,
        google_login_customer_id,
        google_access_token,
        google_refresh_token,
        google_token_type,
        google_token_scope,
        google_token_expires_in,
        google_access_token_expires_at,
        google_last_oauth_at,
        google_payload,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, current_timestamp, $17, current_timestamp
      )
      on conflict (empresa_id, google_customer_id)
      do update set
        google_customer_name = excluded.google_customer_name,
        google_currency_code = excluded.google_currency_code,
        google_time_zone = excluded.google_time_zone,
        google_status = excluded.google_status,
        google_manager = excluded.google_manager,
        google_test_account = excluded.google_test_account,
        google_resource_name = excluded.google_resource_name,
        google_login_customer_id = excluded.google_login_customer_id,
        google_access_token = excluded.google_access_token,
        google_refresh_token = coalesce(
          excluded.google_refresh_token,
          public.empresa_google_ads_accounts.google_refresh_token
        ),
        google_token_type = excluded.google_token_type,
        google_token_scope = excluded.google_token_scope,
        google_token_expires_in = excluded.google_token_expires_in,
        google_access_token_expires_at = excluded.google_access_token_expires_at,
        google_last_oauth_at = current_timestamp,
        google_payload = excluded.google_payload,
        updated_at = current_timestamp
      returning *
    `;
  },

  update_google_ads_account_tokens: () => {
    return `
      update public.empresa_google_ads_accounts
      set
        google_access_token = $3,
        google_refresh_token = coalesce($4::text, google_refresh_token),
        google_token_type = $5::character varying(40),
        google_token_scope = $6::text,
        google_token_expires_in = $7::integer,
        google_access_token_expires_at = $8::timestamp without time zone,
        google_payload = coalesce(
          google_payload,
          '{}'::jsonb
        ) || jsonb_build_object(
          'token_type', $5::text,
          'scope', $6::text,
          'expires_in', $7::integer
        ),
        updated_at = current_timestamp
      where empresa_id = $1
        and google_customer_id = $2
      returning *
    `;
  },
};

module.exports = models;
