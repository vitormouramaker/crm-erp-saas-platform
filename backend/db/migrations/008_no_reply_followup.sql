create table if not exists public.whatsapp_no_reply_followup_envio (
  id bigserial primary key,
  conversa_id bigint not null references public.cliente_conversa_whats(id) on delete cascade,
  mensagem_gatilho_id bigint not null references public.cliente_conversa_whats_mensagem(id) on delete cascade,
  empresa_id bigint not null references public.empresa(id) on delete cascade,
  status varchar(20) not null default 'processing',
  lock_token uuid,
  tentativas integer not null default 1,
  mensagem_whats_id varchar,
  erro text,
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint whatsapp_no_reply_followup_envio_gatilho_key unique (mensagem_gatilho_id),
  constraint whatsapp_no_reply_followup_envio_status_check
    check (status in ('processing', 'sent', 'error'))
);

alter table public.empresa_meta_parans
  add column if not exists whatsapp_auto_message_sem_resposta_6h_ativa boolean not null default false;

insert into public.whatsapp_auto_message_tipo (id, descricao)
values (
  8,
  'Enviada quando o cliente não responde à última mensagem do atendente por 6 horas.'
)
on conflict (id) do update
set descricao = excluded.descricao;

create index if not exists idx_no_reply_followup_conversa_status
  on public.whatsapp_no_reply_followup_envio (conversa_id, status, enviado_em desc);

create index if not exists idx_conversa_mensagem_no_reply_lookup
  on public.cliente_conversa_whats_mensagem
  (cliente_conversa_id, data_mensagem desc, id desc)
  include (send_by);
