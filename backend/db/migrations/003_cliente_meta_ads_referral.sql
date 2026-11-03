begin;

alter table public.cliente
  add column if not exists meta_ads_source_url text,
  add column if not exists meta_ads_source_type varchar(50),
  add column if not exists meta_ads_source_id varchar(255),
  add column if not exists meta_ads_headline text,
  add column if not exists meta_ads_body text,
  add column if not exists meta_ads_media_type varchar(50),
  add column if not exists meta_ads_image_url text,
  add column if not exists meta_ads_video_url text,
  add column if not exists meta_ads_thumbnail_url text,
  add column if not exists meta_ads_ctwa_clid varchar(255),
  add column if not exists meta_ads_referral jsonb,
  add column if not exists meta_ads_utm jsonb,
  add column if not exists meta_ads_message_id varchar(255),
  add column if not exists meta_ads_phone_number_id varchar(255),
  add column if not exists meta_ads_attributed_at timestamptz;

create index if not exists idx_cliente_empresa_meta_ads_source
  on public.cliente (empresa_id, meta_ads_source_id)
  where meta_ads_source_id is not null;

create index if not exists idx_cliente_empresa_meta_ads_attributed
  on public.cliente (empresa_id, meta_ads_attributed_at desc)
  where meta_ads_attributed_at is not null;

commit;
