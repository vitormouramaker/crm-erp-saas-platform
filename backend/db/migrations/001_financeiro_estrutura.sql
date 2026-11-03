-- Expansao da estrutura financeira: empresas do grupo, formas de pagamento e transferencias.
ALTER TABLE financeiro_contraparte
  ADD COLUMN IF NOT EXISTS cpf varchar(20),
  ADD COLUMN IF NOT EXISTS cnpj varchar(24),
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS cep varchar(12),
  ADD COLUMN IF NOT EXISTS uf varchar(2),
  ADD COLUMN IF NOT EXISTS cidade varchar(120);

CREATE TABLE IF NOT EXISTS financeiro_empresa_grupo (
  id bigserial PRIMARY KEY,
  empresa_id integer NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  nome varchar(180) NOT NULL,
  razao_social varchar(180),
  cnpj varchar(24),
  email varchar(180),
  telefone varchar(40),
  endereco text,
  cep varchar(12),
  uf varchar(2),
  cidade varchar(120),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_fin_empresa_grupo_empresa_nome
  ON financeiro_empresa_grupo (empresa_id, ativo, nome);

CREATE TABLE IF NOT EXISTS financeiro_conta_financeira_empresa_grupo (
  empresa_id integer NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  conta_financeira_id bigint NOT NULL REFERENCES financeiro_conta_financeira(id) ON DELETE CASCADE,
  empresa_grupo_id bigint NOT NULL REFERENCES financeiro_empresa_grupo(id) ON DELETE CASCADE,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conta_financeira_id, empresa_grupo_id)
);

CREATE INDEX IF NOT EXISTS ix_fin_conta_empresa_grupo_tenant
  ON financeiro_conta_financeira_empresa_grupo (empresa_id, empresa_grupo_id, conta_financeira_id);

ALTER TABLE financeiro_conta_pagar
  ADD COLUMN IF NOT EXISTS empresa_grupo_id bigint REFERENCES financeiro_empresa_grupo(id) ON DELETE SET NULL;
ALTER TABLE financeiro_conta_receber
  ADD COLUMN IF NOT EXISTS empresa_grupo_id bigint REFERENCES financeiro_empresa_grupo(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS financeiro_forma_pagamento (
  id bigserial PRIMARY KEY,
  empresa_id integer NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  nome varchar(120) NOT NULL,
  taxa_percentual numeric(8,4) NOT NULL DEFAULT 0 CHECK (taxa_percentual >= 0),
  taxa_fixa numeric(14,2) NOT NULL DEFAULT 0 CHECK (taxa_fixa >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fin_forma_pagamento_empresa_nome
  ON financeiro_forma_pagamento (empresa_id, lower(nome));

ALTER TABLE financeiro_pagamento_pagar
  ADD COLUMN IF NOT EXISTS forma_pagamento_id bigint REFERENCES financeiro_forma_pagamento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS taxa_percentual numeric(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_fixa numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_taxa numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_liquido numeric(14,2);
ALTER TABLE financeiro_recebimento
  ADD COLUMN IF NOT EXISTS forma_pagamento_id bigint REFERENCES financeiro_forma_pagamento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS taxa_percentual numeric(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_fixa numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_taxa numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_liquido numeric(14,2);

UPDATE financeiro_pagamento_pagar SET valor_liquido = valor WHERE valor_liquido IS NULL;
UPDATE financeiro_recebimento SET valor_liquido = valor WHERE valor_liquido IS NULL;

CREATE TABLE IF NOT EXISTS financeiro_transferencia (
  id bigserial PRIMARY KEY,
  empresa_id integer NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  conta_origem_id bigint NOT NULL REFERENCES financeiro_conta_financeira(id),
  conta_destino_id bigint NOT NULL REFERENCES financeiro_conta_financeira(id),
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  data_transferencia timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observacao text,
  anexo_url text,
  anexo_nome_arquivo text,
  anexo_mimetype varchar(150),
  criado_por integer REFERENCES usuario(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT financeiro_transferencia_contas_diferentes CHECK (conta_origem_id <> conta_destino_id)
);

ALTER TABLE financeiro_transferencia
  ADD COLUMN IF NOT EXISTS anexo_url text,
  ADD COLUMN IF NOT EXISTS anexo_nome_arquivo text,
  ADD COLUMN IF NOT EXISTS anexo_mimetype varchar(150);

INSERT INTO financeiro_origem_lancamento_tipo (codigo, nome)
VALUES ('transferencia', 'Transferência entre contas')
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome;

CREATE INDEX IF NOT EXISTS ix_fin_conta_pagar_filtros
  ON financeiro_conta_pagar (empresa_id, conta_financeira_id, contraparte_id, empresa_grupo_id, vencimento)
  WHERE ativo = true;
CREATE INDEX IF NOT EXISTS ix_fin_conta_receber_filtros
  ON financeiro_conta_receber (empresa_id, conta_financeira_id, contraparte_id, empresa_grupo_id, vencimento)
  WHERE ativo = true;
CREATE INDEX IF NOT EXISTS ix_fin_transferencia_empresa_data
  ON financeiro_transferencia (empresa_id, data_transferencia DESC) WHERE ativo = true;
-- Integracao opcional CRM -> Financeiro ao fechar negocio como ganho.
ALTER TABLE comercial_crm
  DROP COLUMN IF EXISTS automacao_perda_entrada_dias,
  DROP COLUMN IF EXISTS automacao_etapa_entrada_id;

DELETE FROM comercial_motivo_perda
WHERE codigo = 'parou_de_responder_expirou_no_crm';

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

-- Integracao Gestao 360: origem das empresas criadas pela integracao (docs/sql/empresa_origem_gestao360.sql).
ALTER TABLE empresa
  ADD COLUMN IF NOT EXISTS origem varchar(30),
  ADD COLUMN IF NOT EXISTS gestao360_referencia varchar(120),
  ADD COLUMN IF NOT EXISTS gestao360_senha_inicial varchar(64);
