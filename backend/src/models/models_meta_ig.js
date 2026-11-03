const models = {
  ensure_empresa_meta_instagram_accounts_table: () => {
    return `
      create table if not exists public.empresa_meta_instagram_accounts (
        id serial primary key,
        empresa_id integer not null,
        meta_business_id character varying,
        meta_business_name character varying,
        meta_page_id character varying,
        meta_page_name character varying,
        meta_instagram_business_account_id character varying not null,
        meta_instagram_username character varying,
        meta_instagram_name character varying,
        meta_instagram_profile_picture_url text,
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

  ensure_empresa_meta_instagram_accounts_unique: () => {
    return `
      create unique index if not exists idx_empresa_meta_instagram_accounts_unique
      on public.empresa_meta_instagram_accounts (empresa_id, meta_instagram_business_account_id);
    `;
  },

  ensure_empresa_meta_instagram_accounts_empresa_index: () => {
    return `
      create index if not exists idx_empresa_meta_instagram_accounts_empresa
      on public.empresa_meta_instagram_accounts (empresa_id);
    `;
  },

  get_meta_instagram_accounts: () => {
    return `
      select
        id,
        empresa_id,
        meta_business_id,
        meta_business_name,
        meta_page_id,
        meta_page_name,
        meta_instagram_business_account_id,
        meta_instagram_username,
        meta_instagram_name,
        meta_instagram_profile_picture_url,
        meta_graph_api_version,
        meta_access_token,
        meta_access_token_type,
        meta_token_expires_in,
        meta_access_token_expires_at,
        meta_last_embedded_signup_at,
        meta_payload,
        created_at,
        updated_at
      from public.empresa_meta_instagram_accounts
      where empresa_id = $1
      order by meta_instagram_username nulls last, id desc
    `;
  },

  get_meta_instagram_account_by_ig_id: () => {
    return `
      select
        id,
        empresa_id,
        meta_business_id,
        meta_business_name,
        meta_page_id,
        meta_page_name,
        meta_instagram_business_account_id,
        meta_instagram_username,
        meta_instagram_name,
        meta_instagram_profile_picture_url,
        meta_graph_api_version,
        meta_access_token,
        meta_access_token_type,
        meta_token_expires_in,
        meta_access_token_expires_at,
        meta_last_embedded_signup_at,
        meta_payload,
        created_at,
        updated_at
      from public.empresa_meta_instagram_accounts
      where empresa_id = $1
        and meta_instagram_business_account_id = $2
      limit 1
    `;
  },

  delete_meta_instagram_accounts_not_in: () => {
    return `
      delete from public.empresa_meta_instagram_accounts
      where empresa_id = $1
        and not (meta_instagram_business_account_id = any($2::varchar[]))
    `;
  },

  delete_all_meta_instagram_accounts: () => {
    return `
      delete from public.empresa_meta_instagram_accounts
      where empresa_id = $1
    `;
  },

  upsert_meta_instagram_account: () => {
    return `
      insert into public.empresa_meta_instagram_accounts (
        empresa_id,
        meta_business_id,
        meta_business_name,
        meta_page_id,
        meta_page_name,
        meta_instagram_business_account_id,
        meta_instagram_username,
        meta_instagram_name,
        meta_instagram_profile_picture_url,
        meta_graph_api_version,
        meta_access_token,
        meta_access_token_type,
        meta_token_expires_in,
        meta_access_token_expires_at,
        meta_last_embedded_signup_at,
        meta_payload,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, current_timestamp, $15, current_timestamp
      )
      on conflict (empresa_id, meta_instagram_business_account_id)
      do update set
        meta_business_id = excluded.meta_business_id,
        meta_business_name = excluded.meta_business_name,
        meta_page_id = excluded.meta_page_id,
        meta_page_name = excluded.meta_page_name,
        meta_instagram_username = excluded.meta_instagram_username,
        meta_instagram_name = excluded.meta_instagram_name,
        meta_instagram_profile_picture_url = excluded.meta_instagram_profile_picture_url,
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
