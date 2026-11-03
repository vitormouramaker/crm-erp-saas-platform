BEGIN;

ALTER TABLE comercial_crm
  ADD COLUMN IF NOT EXISTS financeiro_gerar_conta_receber boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS financeiro_conta_financeira_id bigint REFERENCES financeiro_conta_financeira(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS financeiro_categoria_id bigint REFERENCES financeiro_categoria(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS financeiro_centro_custo_id bigint REFERENCES financeiro_centro_custo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS financeiro_empresa_grupo_id bigint REFERENCES financeiro_empresa_grupo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS financeiro_vencimento_dias integer NOT NULL DEFAULT 0;

ALTER TABLE comercial_crm DROP CONSTRAINT IF EXISTS comercial_crm_financeiro_vencimento_dias_chk;
ALTER TABLE comercial_crm
  ADD CONSTRAINT comercial_crm_financeiro_vencimento_dias_chk
  CHECK (financeiro_vencimento_dias BETWEEN 0 AND 3650);

COMMIT;
