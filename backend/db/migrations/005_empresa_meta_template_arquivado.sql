BEGIN;

CREATE TABLE IF NOT EXISTS public.empresa_meta_template_arquivado (
    id bigserial PRIMARY KEY,
    empresa_id integer NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
    empresa_meta_param_id integer NOT NULL REFERENCES public.empresa_meta_parans(id) ON DELETE CASCADE,
    template_id character varying(100) NOT NULL,
    template_name character varying(512) NOT NULL,
    language_code character varying(20),
    arquivado_por integer REFERENCES public.usuario(id) ON DELETE SET NULL,
    arquivado_em timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT empresa_meta_template_arquivado_uk
        UNIQUE (empresa_id, empresa_meta_param_id, template_id)
);

CREATE INDEX IF NOT EXISTS empresa_meta_template_arquivado_lookup_idx
    ON public.empresa_meta_template_arquivado
    (empresa_id, empresa_meta_param_id, template_id);

COMMIT;
