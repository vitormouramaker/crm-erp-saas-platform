alter table public.comercial_crm
  drop column if exists automacao_perda_entrada_dias,
  drop column if exists automacao_etapa_entrada_id;

delete from public.comercial_motivo_perda
where codigo = 'parou_de_responder_expirou_no_crm';
