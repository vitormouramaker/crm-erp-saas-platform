BEGIN;

ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS cor_atendimento varchar(7);

ALTER TABLE public.usuario
  DROP CONSTRAINT IF EXISTS usuario_cor_atendimento_check;

ALTER TABLE public.usuario
  ADD CONSTRAINT usuario_cor_atendimento_check
  CHECK (cor_atendimento IS NULL OR cor_atendimento ~ '^#[0-9A-Fa-f]{6}$');

COMMIT;
