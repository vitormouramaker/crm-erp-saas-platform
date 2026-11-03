BEGIN;

ALTER TABLE public.empresa_galeria_imagem
    ALTER COLUMN origem TYPE text;

ALTER TABLE public.empresa_galeria_documento
    ALTER COLUMN origem TYPE text;

COMMIT;
