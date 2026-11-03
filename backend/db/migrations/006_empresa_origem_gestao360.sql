-- Integracao Gestao 360: marca a origem das empresas criadas pela integracao.
-- origem               = 'gestao360' quando a empresa foi criada pelas rotas /integracao/gestao360.
-- gestao360_referencia    = id do cliente no Gestao 360.
-- gestao360_senha_inicial = hash da senha aleatoria gerada na criacao; enquanto for igual a
--                        usuario.senha do master, o responsavel ainda nao definiu a propria senha
--                        (onboarding pendente) e o e-mail "Finalize seu cadastro" pode ser reenviado.
-- Colunas anulaveis e sem default: nao alteram as empresas existentes.
BEGIN;

ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS origem varchar(30),
  ADD COLUMN IF NOT EXISTS gestao360_referencia varchar(120),
  ADD COLUMN IF NOT EXISTS gestao360_senha_inicial varchar(64);

COMMIT;
