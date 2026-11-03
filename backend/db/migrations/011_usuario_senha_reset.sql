-- Codigos de redefinicao de senha: um por pedido e por usuario, guardado so
-- como HMAC, com validade e limite de tentativas. Substitui o TOTP global
-- (mesma chave para todas as contas) usado antes.
CREATE TABLE IF NOT EXISTS public.usuario_senha_reset (
  id bigserial PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  codigo_hash varchar(64) NOT NULL,
  expira_em timestamp with time zone NOT NULL,
  usado_em timestamp with time zone,
  tentativas integer NOT NULL DEFAULT 0,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_usuario_senha_reset_usuario_ativo
  ON public.usuario_senha_reset (usuario_id)
  WHERE usado_em IS NULL;
