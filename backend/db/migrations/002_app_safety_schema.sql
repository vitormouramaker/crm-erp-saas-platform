BEGIN;

CREATE TABLE IF NOT EXISTS public.app_cliente_bloqueio (
  id bigserial PRIMARY KEY,
  empresa_id bigint NOT NULL REFERENCES public.empresa(id),
  cliente_id bigint NOT NULL REFERENCES public.cliente(id),
  bloqueado_por_usuario_id bigint REFERENCES public.usuario(id),
  desbloqueado_por_usuario_id bigint REFERENCES public.usuario(id),
  motivo text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp without time zone NOT NULL DEFAULT current_timestamp,
  atualizado_em timestamp without time zone NOT NULL DEFAULT current_timestamp,
  desbloqueado_em timestamp without time zone,
  CONSTRAINT app_cliente_bloqueio_empresa_cliente_uk UNIQUE (empresa_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_app_cliente_bloqueio_ativos
  ON public.app_cliente_bloqueio (empresa_id, cliente_id) WHERE ativo = true;

CREATE TABLE IF NOT EXISTS public.app_denuncia (
  id bigserial PRIMARY KEY,
  empresa_id bigint NOT NULL REFERENCES public.empresa(id),
  usuario_id bigint REFERENCES public.usuario(id),
  cliente_id bigint REFERENCES public.cliente(id),
  conversa_id bigint REFERENCES public.cliente_conversa_whats(id),
  mensagem_id bigint REFERENCES public.cliente_conversa_whats_mensagem(id),
  tipo varchar(50) NOT NULL DEFAULT 'abuso',
  motivo varchar(255) NOT NULL,
  descricao text,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(30) NOT NULL DEFAULT 'pendente',
  criado_em timestamp without time zone NOT NULL DEFAULT current_timestamp,
  resolvido_em timestamp without time zone
);

CREATE INDEX IF NOT EXISTS idx_app_denuncia_empresa_status
  ON public.app_denuncia (empresa_id, status, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.app_palavra_bloqueada (
  id bigserial PRIMARY KEY,
  empresa_id bigint REFERENCES public.empresa(id),
  palavra varchar(255) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp without time zone NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS app_palavra_bloqueada_global_uk
  ON public.app_palavra_bloqueada (lower(palavra)) WHERE empresa_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_palavra_bloqueada_empresa_uk
  ON public.app_palavra_bloqueada (empresa_id, lower(palavra)) WHERE empresa_id IS NOT NULL;

INSERT INTO public.app_palavra_bloqueada (empresa_id, palavra)
VALUES
  (NULL, 'pornografia infantil'),
  (NULL, 'material de abuso sexual infantil'),
  (NULL, 'exploracao sexual infantil')
ON CONFLICT DO NOTHING;

COMMIT;
