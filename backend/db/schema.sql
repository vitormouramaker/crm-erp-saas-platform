--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4 (Debian 17.4-1.pgdg120+2)
-- Dumped by pg_dump version 17.4

-- Started on 2026-08-31 11:52:07

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 143050)
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- TOC entry 481 (class 1255 OID 26745)
-- Name: atualizar_ultima_conversa_whats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_ultima_conversa_whats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE cliente_conversa_whats
  SET ultima_atualizacao = CURRENT_TIMESTAMP - interval '3 hours'
  WHERE id = NEW.cliente_conversa_id;

  RETURN NEW;
END;
$$;


--
-- TOC entry 492 (class 1255 OID 40056)
-- Name: fn_fin_alerta_status_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_alerta_status_id(p_codigo text) RETURNS smallint
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM financeiro_alerta_status_tipo WHERE codigo = p_codigo LIMIT 1
$$;


--
-- TOC entry 491 (class 1255 OID 40055)
-- Name: fn_fin_alerta_tipo_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_alerta_tipo_id(p_codigo text) RETURNS smallint
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM financeiro_alerta_tipo WHERE codigo = p_codigo LIMIT 1
$$;


--
-- TOC entry 493 (class 1255 OID 40803)
-- Name: fn_fin_assinatura_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_assinatura_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- TOC entry 487 (class 1255 OID 40051)
-- Name: fn_fin_natureza_lancamento_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_natureza_lancamento_id(p_codigo text) RETURNS smallint
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM financeiro_natureza_lancamento_tipo WHERE codigo = p_codigo LIMIT 1
$$;


--
-- TOC entry 488 (class 1255 OID 40052)
-- Name: fn_fin_origem_lancamento_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_origem_lancamento_id(p_codigo text) RETURNS smallint
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM financeiro_origem_lancamento_tipo WHERE codigo = p_codigo LIMIT 1
$$;


--
-- TOC entry 538 (class 1255 OID 40554)
-- Name: fn_fin_recalcular_status_conta_pagar(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_recalcular_status_conta_pagar(p_conta_id bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_pago NUMERIC(14,2) := 0;
  v_total NUMERIC(14,2) := 0;
  v_vencimento DATE;
  v_status_id SMALLINT;
BEGIN
  SELECT COALESCE(SUM(valor), 0)
  INTO v_pago
  FROM financeiro_pagamento_pagar
  WHERE conta_pagar_id = p_conta_id
    AND ativo = true;

  SELECT
    GREATEST((valor_original - desconto + juros + multa), 0),
    vencimento
  INTO v_total, v_vencimento
  FROM financeiro_conta_pagar
  WHERE id = p_conta_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_pago >= v_total AND v_total > 0 THEN
    v_status_id := fn_fin_status_titulo_id('pago');
  ELSIF v_pago > 0 AND v_pago < v_total THEN
    v_status_id := fn_fin_status_titulo_id('parcial');
  ELSE
    IF v_vencimento < CURRENT_DATE THEN
      v_status_id := fn_fin_status_titulo_id('vencido');
    ELSE
      v_status_id := fn_fin_status_titulo_id('aberto');
    END IF;
  END IF;

  UPDATE financeiro_conta_pagar
  SET
    valor_pago_acumulado = v_pago,
    status_id = CASE
      WHEN status_id = fn_fin_status_titulo_id('cancelado') THEN status_id
      ELSE v_status_id
    END
  WHERE id = p_conta_id;
END;
$$;


--
-- TOC entry 539 (class 1255 OID 40555)
-- Name: fn_fin_recalcular_status_conta_receber(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_recalcular_status_conta_receber(p_conta_id bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_recebido NUMERIC(14,2) := 0;
  v_total NUMERIC(14,2) := 0;
  v_vencimento DATE;
  v_status_id SMALLINT;
BEGIN
  SELECT COALESCE(SUM(valor), 0)
  INTO v_recebido
  FROM financeiro_recebimento
  WHERE conta_receber_id = p_conta_id
    AND ativo = true;

  SELECT
    GREATEST((valor_original - desconto + juros + multa), 0),
    vencimento
  INTO v_total, v_vencimento
  FROM financeiro_conta_receber
  WHERE id = p_conta_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_recebido >= v_total AND v_total > 0 THEN
    v_status_id := fn_fin_status_titulo_id('pago');
  ELSIF v_recebido > 0 AND v_recebido < v_total THEN
    v_status_id := fn_fin_status_titulo_id('parcial');
  ELSE
    IF v_vencimento < CURRENT_DATE THEN
      v_status_id := fn_fin_status_titulo_id('vencido');
    ELSE
      v_status_id := fn_fin_status_titulo_id('aberto');
    END IF;
  END IF;

  UPDATE financeiro_conta_receber
  SET
    valor_recebido_acumulado = v_recebido,
    status_id = CASE
      WHEN status_id = fn_fin_status_titulo_id('cancelado') THEN status_id
      ELSE v_status_id
    END
  WHERE id = p_conta_id;
END;
$$;


--
-- TOC entry 529 (class 1255 OID 40553)
-- Name: fn_fin_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- TOC entry 486 (class 1255 OID 40050)
-- Name: fn_fin_status_lancamento_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_status_lancamento_id(p_codigo text) RETURNS smallint
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM financeiro_status_lancamento_tipo WHERE codigo = p_codigo LIMIT 1
$$;


--
-- TOC entry 485 (class 1255 OID 40049)
-- Name: fn_fin_status_titulo_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_status_titulo_id(p_codigo text) RETURNS smallint
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM financeiro_status_titulo_tipo WHERE codigo = p_codigo LIMIT 1
$$;


--
-- TOC entry 530 (class 1255 OID 40556)
-- Name: fn_fin_sync_lancamento_pagamento(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_sync_lancamento_pagamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_categoria_id BIGINT;
  v_centro_custo_id BIGINT;
  v_descricao TEXT;
  v_doc TEXT;
  v_comp DATE;
  v_lancamento_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.lancamento_id IS NOT NULL THEN
      DELETE FROM financeiro_lancamento WHERE id = OLD.lancamento_id;
    END IF;
    PERFORM fn_fin_recalcular_status_conta_pagar(OLD.conta_pagar_id);
    RETURN OLD;
  END IF;

  SELECT
    categoria_id,
    centro_custo_id,
    descricao,
    documento_numero,
    competencia
  INTO
    v_categoria_id,
    v_centro_custo_id,
    v_descricao,
    v_doc,
    v_comp
  FROM financeiro_conta_pagar
  WHERE id = NEW.conta_pagar_id;

  IF NEW.ativo = false THEN
    IF NEW.lancamento_id IS NOT NULL THEN
      DELETE FROM financeiro_lancamento WHERE id = NEW.lancamento_id;
      NEW.lancamento_id := NULL;
    END IF;
    PERFORM fn_fin_recalcular_status_conta_pagar(NEW.conta_pagar_id);
    RETURN NEW;
  END IF;

  IF NEW.lancamento_id IS NULL THEN
    INSERT INTO financeiro_lancamento (
      empresa_id,
      natureza_id,
      status_id,
      origem_id,
      origem_registro_id,
      conta_financeira_id,
      categoria_id,
      centro_custo_id,
      data_lancamento,
      competencia,
      valor,
      descricao,
      documento_numero,
      metadata,
      criado_por
    ) VALUES (
      NEW.empresa_id,
      fn_fin_natureza_lancamento_id('saida'),
      fn_fin_status_lancamento_id('realizado'),
      fn_fin_origem_lancamento_id('conta_pagar'),
      NEW.id,
      NEW.conta_financeira_id,
      v_categoria_id,
      v_centro_custo_id,
      NEW.data_pagamento,
      v_comp,
      NEW.valor,
      COALESCE(v_descricao, 'Pagamento conta a pagar'),
      v_doc,
      jsonb_build_object('conta_pagar_id', NEW.conta_pagar_id, 'pagamento_id', NEW.id),
      NEW.criado_por
    )
    RETURNING id INTO v_lancamento_id;

    NEW.lancamento_id := v_lancamento_id;
  ELSE
    UPDATE financeiro_lancamento
    SET
      conta_financeira_id = NEW.conta_financeira_id,
      categoria_id = v_categoria_id,
      centro_custo_id = v_centro_custo_id,
      data_lancamento = NEW.data_pagamento,
      competencia = v_comp,
      valor = NEW.valor,
      descricao = COALESCE(v_descricao, 'Pagamento conta a pagar'),
      documento_numero = v_doc,
      status_id = CASE
        WHEN NEW.ativo THEN fn_fin_status_lancamento_id('realizado')
        ELSE fn_fin_status_lancamento_id('cancelado')
      END
    WHERE id = NEW.lancamento_id;
  END IF;

  PERFORM fn_fin_recalcular_status_conta_pagar(NEW.conta_pagar_id);
  RETURN NEW;
END;
$$;


--
-- TOC entry 540 (class 1255 OID 40557)
-- Name: fn_fin_sync_lancamento_recebimento(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_sync_lancamento_recebimento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_categoria_id BIGINT;
  v_centro_custo_id BIGINT;
  v_descricao TEXT;
  v_doc TEXT;
  v_comp DATE;
  v_lancamento_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.lancamento_id IS NOT NULL THEN
      DELETE FROM financeiro_lancamento WHERE id = OLD.lancamento_id;
    END IF;
    PERFORM fn_fin_recalcular_status_conta_receber(OLD.conta_receber_id);
    RETURN OLD;
  END IF;

  SELECT
    categoria_id,
    centro_custo_id,
    descricao,
    documento_numero,
    competencia
  INTO
    v_categoria_id,
    v_centro_custo_id,
    v_descricao,
    v_doc,
    v_comp
  FROM financeiro_conta_receber
  WHERE id = NEW.conta_receber_id;

  IF NEW.ativo = false THEN
    IF NEW.lancamento_id IS NOT NULL THEN
      DELETE FROM financeiro_lancamento WHERE id = NEW.lancamento_id;
      NEW.lancamento_id := NULL;
    END IF;
    PERFORM fn_fin_recalcular_status_conta_receber(NEW.conta_receber_id);
    RETURN NEW;
  END IF;

  IF NEW.lancamento_id IS NULL THEN
    INSERT INTO financeiro_lancamento (
      empresa_id,
      natureza_id,
      status_id,
      origem_id,
      origem_registro_id,
      conta_financeira_id,
      categoria_id,
      centro_custo_id,
      data_lancamento,
      competencia,
      valor,
      descricao,
      documento_numero,
      metadata,
      criado_por
    ) VALUES (
      NEW.empresa_id,
      fn_fin_natureza_lancamento_id('entrada'),
      fn_fin_status_lancamento_id('realizado'),
      fn_fin_origem_lancamento_id('conta_receber'),
      NEW.id,
      NEW.conta_financeira_id,
      v_categoria_id,
      v_centro_custo_id,
      NEW.data_recebimento,
      v_comp,
      NEW.valor,
      COALESCE(v_descricao, 'Recebimento conta a receber'),
      v_doc,
      jsonb_build_object('conta_receber_id', NEW.conta_receber_id, 'recebimento_id', NEW.id),
      NEW.criado_por
    )
    RETURNING id INTO v_lancamento_id;

    NEW.lancamento_id := v_lancamento_id;
  ELSE
    UPDATE financeiro_lancamento
    SET
      conta_financeira_id = NEW.conta_financeira_id,
      categoria_id = v_categoria_id,
      centro_custo_id = v_centro_custo_id,
      data_lancamento = NEW.data_recebimento,
      competencia = v_comp,
      valor = NEW.valor,
      descricao = COALESCE(v_descricao, 'Recebimento conta a receber'),
      documento_numero = v_doc,
      status_id = CASE
        WHEN NEW.ativo THEN fn_fin_status_lancamento_id('realizado')
        ELSE fn_fin_status_lancamento_id('cancelado')
      END
    WHERE id = NEW.lancamento_id;
  END IF;

  PERFORM fn_fin_recalcular_status_conta_receber(NEW.conta_receber_id);
  RETURN NEW;
END;
$$;


--
-- TOC entry 490 (class 1255 OID 40054)
-- Name: fn_fin_tipo_categoria_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_tipo_categoria_id(p_codigo text) RETURNS smallint
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM financeiro_categoria_tipo WHERE codigo = p_codigo LIMIT 1
$$;


--
-- TOC entry 489 (class 1255 OID 40053)
-- Name: fn_fin_tipo_recorrencia_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_fin_tipo_recorrencia_id(p_codigo text) RETURNS smallint
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM financeiro_recorrencia_tipo WHERE codigo = p_codigo LIMIT 1
$$;


--
-- TOC entry 483 (class 1255 OID 39581)
-- Name: fn_set_empresa_cliente_webhook_codigo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_set_empresa_cliente_webhook_codigo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.cliente_webhook_codigo IS NULL OR BTRIM(NEW.cliente_webhook_codigo) = '' THEN
    NEW.cliente_webhook_codigo := SUBSTRING(
      MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text || COALESCE(NEW.cnpj, '') || COALESCE(NEW.nome_fantasia, '')),
      1,
      40
    );
  END IF;

  IF NEW.cliente_webhook_ativo IS NULL THEN
    NEW.cliente_webhook_ativo := true;
  END IF;

  RETURN NEW;
END;
$$;


--
-- TOC entry 484 (class 1255 OID 39660)
-- Name: fn_set_empresa_cliente_webhook_public_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_set_empresa_cliente_webhook_public_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.cliente_webhook_public_id IS NULL OR BTRIM(NEW.cliente_webhook_public_id) = '' THEN
    NEW.cliente_webhook_public_id := SUBSTRING(
      MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text || COALESCE(NEW.cnpj, '') || COALESCE(NEW.nome_fantasia, '') || 'public'),
      1,
      32
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- TOC entry 482 (class 1255 OID 39345)
-- Name: set_updated_at_empresa_meta_instagram_accounts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_empresa_meta_instagram_accounts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- TOC entry 364 (class 1259 OID 39941)
-- Name: addos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addos (
    id integer NOT NULL,
    codigo character varying(60) NOT NULL,
    nome character varying(120) NOT NULL,
    descricao text,
    stripe_price_id character varying(120),
    stripe_price_id_monthly character varying(120),
    stripe_price_id_yearly character varying(120),
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 363 (class 1259 OID 39940)
-- Name: addos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.addos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5389 (class 0 OID 0)
-- Dependencies: 363
-- Name: addos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.addos_id_seq OWNED BY public.addos.id;


--
-- TOC entry 317 (class 1259 OID 34585)
-- Name: apuracao_ponto_diaria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apuracao_ponto_diaria (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    data_referencia date NOT NULL,
    minutos_previstos integer DEFAULT 0 NOT NULL,
    minutos_trabalhados integer DEFAULT 0 NOT NULL,
    minutos_abonados integer DEFAULT 0 NOT NULL,
    minutos_extras integer DEFAULT 0 NOT NULL,
    minutos_falta integer DEFAULT 0 NOT NULL,
    saldo_minutos integer DEFAULT 0 NOT NULL,
    status character varying(30) DEFAULT 'pendente'::character varying NOT NULL
);


--
-- TOC entry 316 (class 1259 OID 34584)
-- Name: apuracao_ponto_diaria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.apuracao_ponto_diaria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5390 (class 0 OID 0)
-- Dependencies: 316
-- Name: apuracao_ponto_diaria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.apuracao_ponto_diaria_id_seq OWNED BY public.apuracao_ponto_diaria.id;


--
-- TOC entry 275 (class 1259 OID 28824)
-- Name: assinatura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assinatura (
    id integer NOT NULL,
    nome character varying,
    preco double precision,
    permissoes jsonb DEFAULT '[]'::jsonb NOT NULL,
    ativo boolean,
    max_user integer,
    max_filial integer,
    stripe_price_id character varying,
    stripe_price_id_monthly character varying,
    stripe_price_id_yearly character varying,
    max_crm integer,
    max_leads integer
);


--
-- TOC entry 222 (class 1259 OID 26746)
-- Name: empresa_assinatura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_assinatura (
    id integer NOT NULL,
    assinatua_hash character varying,
    recurrency_id character varying,
    data_inicial timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ultimo_pagamento timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    validade date,
    ativo boolean,
    empresa_id integer,
    assinatura_id integer NOT NULL,
    has_pdv boolean,
    additional_user integer DEFAULT 0,
    additional_filial integer DEFAULT 0,
    stripe_customer_id character varying,
    stripe_subscription_id character varying,
    stripe_checkout_session_id character varying,
    stripe_status character varying,
    stripe_price_id character varying,
    stripe_current_period_end timestamp without time zone,
    stripe_cancel_at_period_end boolean DEFAULT false,
    stripe_last_event_id character varying,
    stripe_last_event_at timestamp without time zone,
    additional_crm integer DEFAULT 0 NOT NULL,
    additional_leads integer DEFAULT 0 NOT NULL,
    additional_user_cycle character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    additional_crm_cycle character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    additional_leads_cycle character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    request_unsubscribe boolean DEFAULT false NOT NULL,
    CONSTRAINT empresa_assinatura_additional_crm_cycle_chk CHECK (((additional_crm_cycle)::text = ANY ((ARRAY['monthly'::character varying, 'yearly'::character varying])::text[]))),
    CONSTRAINT empresa_assinatura_additional_leads_cycle_chk CHECK (((additional_leads_cycle)::text = ANY ((ARRAY['monthly'::character varying, 'yearly'::character varying])::text[]))),
    CONSTRAINT empresa_assinatura_additional_user_cycle_chk CHECK (((additional_user_cycle)::text = ANY ((ARRAY['monthly'::character varying, 'yearly'::character varying])::text[])))
);


--
-- TOC entry 223 (class 1259 OID 26753)
-- Name: assinatura_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assinatura_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5391 (class 0 OID 0)
-- Dependencies: 223
-- Name: assinatura_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assinatura_id_seq OWNED BY public.empresa_assinatura.id;


--
-- TOC entry 274 (class 1259 OID 28823)
-- Name: assinatura_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assinatura_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5392 (class 0 OID 0)
-- Dependencies: 274
-- Name: assinatura_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assinatura_id_seq1 OWNED BY public.assinatura.id;


--
-- TOC entry 454 (class 1259 OID 63724)
-- Name: atendimento_fila_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atendimento_fila_usuario (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    ordem integer NOT NULL,
    data_cadastro timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 453 (class 1259 OID 63723)
-- Name: atendimento_fila_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.atendimento_fila_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5393 (class 0 OID 0)
-- Dependencies: 453
-- Name: atendimento_fila_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.atendimento_fila_usuario_id_seq OWNED BY public.atendimento_fila_usuario.id;


--
-- TOC entry 307 (class 1259 OID 34458)
-- Name: banco_horas_lancamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banco_horas_lancamento (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    data_referencia date NOT NULL,
    tipo character varying(20) NOT NULL,
    minutos integer NOT NULL,
    origem character varying(30) NOT NULL,
    referencia_id bigint,
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 306 (class 1259 OID 34457)
-- Name: banco_horas_lancamento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.banco_horas_lancamento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5394 (class 0 OID 0)
-- Dependencies: 306
-- Name: banco_horas_lancamento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.banco_horas_lancamento_id_seq OWNED BY public.banco_horas_lancamento.id;


--
-- TOC entry 269 (class 1259 OID 27981)
-- Name: caixa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caixa (
    id integer NOT NULL,
    descricao character varying,
    data_abertura date DEFAULT CURRENT_DATE,
    status character varying,
    empresa_id integer,
    filial_id integer,
    terminal_id character varying
);


--
-- TOC entry 285 (class 1259 OID 30932)
-- Name: caixa_abertura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caixa_abertura (
    id integer NOT NULL,
    usuario_id integer,
    caixa_id integer,
    filial_id integer,
    empresa_id integer,
    valor_abertura double precision,
    data_abertura timestamp without time zone,
    valor_fechamento_especie double precision,
    valor_fechamento_total double precision,
    data_fechamento timestamp without time zone
);


--
-- TOC entry 284 (class 1259 OID 30931)
-- Name: caixa_abertura_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caixa_abertura_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5395 (class 0 OID 0)
-- Dependencies: 284
-- Name: caixa_abertura_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caixa_abertura_id_seq OWNED BY public.caixa_abertura.id;


--
-- TOC entry 268 (class 1259 OID 27980)
-- Name: caixa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caixa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5396 (class 0 OID 0)
-- Dependencies: 268
-- Name: caixa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caixa_id_seq OWNED BY public.caixa.id;


--
-- TOC entry 283 (class 1259 OID 30923)
-- Name: caixa_ruptura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caixa_ruptura (
    id integer NOT NULL,
    caixa_id integer,
    usuario_id integer,
    filial_id integer,
    empresa_id integer,
    valor_ruptura double precision,
    motivo_ruptura character varying,
    data_ruptura timestamp without time zone
);


--
-- TOC entry 282 (class 1259 OID 30922)
-- Name: caixa_ruptura_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caixa_ruptura_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5397 (class 0 OID 0)
-- Dependencies: 282
-- Name: caixa_ruptura_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caixa_ruptura_id_seq OWNED BY public.caixa_ruptura.id;


--
-- TOC entry 255 (class 1259 OID 26939)
-- Name: categoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categoria (
    id integer NOT NULL,
    nome character varying,
    descricao character varying,
    empresa_id integer
);


--
-- TOC entry 254 (class 1259 OID 26938)
-- Name: categoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5398 (class 0 OID 0)
-- Dependencies: 254
-- Name: categoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categoria_id_seq OWNED BY public.categoria.id;


--
-- TOC entry 224 (class 1259 OID 26754)
-- Name: cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente (
    id integer NOT NULL,
    nome character varying,
    telefone character varying,
    email character varying,
    data_cadastro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ativo boolean,
    empresa_id integer DEFAULT 1,
    utms jsonb DEFAULT '[]'::jsonb NOT NULL,
    tags_webhook jsonb DEFAULT '[]'::jsonb NOT NULL,
    data_aniversario date,
    origem character varying(40) DEFAULT 'manual'::character varying NOT NULL,
    cpf character varying(20),
    logradouro character varying(180),
    numero character varying(30),
    complemento character varying(120),
    bairro character varying(120),
    cidade character varying(120),
    uf character varying(2),
    cep character varying(12),
    empresa character varying(180),
    cargo character varying(120),
    faturamento numeric(14,2),
    CONSTRAINT cliente_tags_webhook_array_chk CHECK ((jsonb_typeof(tags_webhook) = 'array'::text)),
    CONSTRAINT cliente_utms_array_chk CHECK ((jsonb_typeof(utms) = 'array'::text))
);


--
-- TOC entry 225 (class 1259 OID 26760)
-- Name: cliente_anotacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_anotacao (
    id integer NOT NULL,
    usuario_id integer,
    cliente_id integer,
    texto text,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 226 (class 1259 OID 26766)
-- Name: cliente_anotacao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_anotacao_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5399 (class 0 OID 0)
-- Dependencies: 226
-- Name: cliente_anotacao_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_anotacao_id_seq OWNED BY public.cliente_anotacao.id;


--
-- TOC entry 227 (class 1259 OID 26767)
-- Name: cliente_conversa_whats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_conversa_whats (
    id integer NOT NULL,
    number_phone_id bigint,
    cliente_id integer,
    usuario_id integer,
    status_id integer DEFAULT 0,
    data_inicio timestamp without time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval),
    data_fim timestamp without time zone,
    ultima_atualizacao timestamp without time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval),
    setor_id integer,
    empresa_id integer DEFAULT 4,
    empresa_meta_param_id integer,
    usuario_atribuido_id integer
);


--
-- TOC entry 228 (class 1259 OID 26773)
-- Name: cliente_conversa_whats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_conversa_whats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5400 (class 0 OID 0)
-- Dependencies: 228
-- Name: cliente_conversa_whats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_conversa_whats_id_seq OWNED BY public.cliente_conversa_whats.id;


--
-- TOC entry 229 (class 1259 OID 26774)
-- Name: cliente_conversa_whats_mensagem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_conversa_whats_mensagem (
    id integer NOT NULL,
    cliente_conversa_id integer,
    mensagem text,
    tipo_id integer,
    data_mensagem timestamp without time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval),
    status integer,
    reply boolean,
    mensagem_reply_id integer,
    mensagem_whats_id text,
    send_by integer,
    midia_id character varying,
    media_tipe character varying,
    apagada boolean DEFAULT false,
    apagada_em timestamp without time zone,
    apagada_por_usuario_id integer,
    editado boolean DEFAULT false NOT NULL,
    editado_em timestamp without time zone,
    usuario_id bigint
);


--
-- TOC entry 230 (class 1259 OID 26780)
-- Name: cliente_conversa_whats_mensagem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_conversa_whats_mensagem_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5401 (class 0 OID 0)
-- Dependencies: 230
-- Name: cliente_conversa_whats_mensagem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_conversa_whats_mensagem_id_seq OWNED BY public.cliente_conversa_whats_mensagem.id;


--
-- TOC entry 362 (class 1259 OID 39775)
-- Name: cliente_conversa_whats_usuario_leitura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_conversa_whats_usuario_leitura (
    id bigint NOT NULL,
    cliente_conversa_id integer NOT NULL,
    usuario_id integer NOT NULL,
    ultima_mensagem_lida_id integer,
    ultima_leitura_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 361 (class 1259 OID 39774)
-- Name: cliente_conversa_whats_usuario_leitura_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_conversa_whats_usuario_leitura_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5402 (class 0 OID 0)
-- Dependencies: 361
-- Name: cliente_conversa_whats_usuario_leitura_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_conversa_whats_usuario_leitura_id_seq OWNED BY public.cliente_conversa_whats_usuario_leitura.id;


--
-- TOC entry 452 (class 1259 OID 59141)
-- Name: cliente_documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_documento (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    cliente_id bigint NOT NULL,
    nome_arquivo character varying(255) NOT NULL,
    url text NOT NULL,
    path_bunny text,
    mime_type character varying(120),
    tamanho_bytes bigint,
    origem character varying(80) DEFAULT 'contato'::character varying NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    data_criacao timestamp without time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval) NOT NULL,
    usuario_id bigint
);


--
-- TOC entry 451 (class 1259 OID 59140)
-- Name: cliente_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_documento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5403 (class 0 OID 0)
-- Dependencies: 451
-- Name: cliente_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_documento_id_seq OWNED BY public.cliente_documento.id;


--
-- TOC entry 231 (class 1259 OID 26781)
-- Name: cliente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5404 (class 0 OID 0)
-- Dependencies: 231
-- Name: cliente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_id_seq OWNED BY public.cliente.id;


--
-- TOC entry 418 (class 1259 OID 42770)
-- Name: cliente_lista_transmissao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_lista_transmissao (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(160) NOT NULL,
    descricao text,
    tag_logic character varying(3) DEFAULT 'or'::character varying NOT NULL,
    utm_filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_por_usuario_id integer,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    empresa_meta_param_id bigint,
    CONSTRAINT cliente_lista_transmissao_tag_logic_chk CHECK (((tag_logic)::text = ANY ((ARRAY['and'::character varying, 'or'::character varying])::text[]))),
    CONSTRAINT cliente_lista_transmissao_utm_filters_obj_chk CHECK ((jsonb_typeof(utm_filters) = 'object'::text))
);


--
-- TOC entry 422 (class 1259 OID 42820)
-- Name: cliente_lista_transmissao_contato; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_lista_transmissao_contato (
    id bigint NOT NULL,
    lista_transmissao_id bigint NOT NULL,
    cliente_id integer NOT NULL,
    origem character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    added_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT cliente_lista_transmissao_contato_origem_chk CHECK (((origem)::text = ANY ((ARRAY['manual'::character varying, 'segmento'::character varying])::text[])))
);


--
-- TOC entry 421 (class 1259 OID 42819)
-- Name: cliente_lista_transmissao_contato_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_lista_transmissao_contato_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5405 (class 0 OID 0)
-- Dependencies: 421
-- Name: cliente_lista_transmissao_contato_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_lista_transmissao_contato_id_seq OWNED BY public.cliente_lista_transmissao_contato.id;


--
-- TOC entry 417 (class 1259 OID 42769)
-- Name: cliente_lista_transmissao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_lista_transmissao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5406 (class 0 OID 0)
-- Dependencies: 417
-- Name: cliente_lista_transmissao_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_lista_transmissao_id_seq OWNED BY public.cliente_lista_transmissao.id;


--
-- TOC entry 420 (class 1259 OID 42798)
-- Name: cliente_lista_transmissao_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_lista_transmissao_tag (
    id bigint NOT NULL,
    lista_transmissao_id bigint NOT NULL,
    tag_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 419 (class 1259 OID 42797)
-- Name: cliente_lista_transmissao_tag_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_lista_transmissao_tag_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5407 (class 0 OID 0)
-- Dependencies: 419
-- Name: cliente_lista_transmissao_tag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_lista_transmissao_tag_id_seq OWNED BY public.cliente_lista_transmissao_tag.id;


--
-- TOC entry 436 (class 1259 OID 44847)
-- Name: cliente_meta_ads_lead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_meta_ads_lead (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    cliente_id integer NOT NULL,
    meta_ads_account_id character varying NOT NULL,
    meta_lead_id character varying NOT NULL,
    meta_form_id character varying,
    meta_form_name character varying,
    meta_campaign_id character varying,
    meta_campaign_name character varying,
    meta_ad_id character varying,
    meta_ad_name character varying,
    payload jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 435 (class 1259 OID 44846)
-- Name: cliente_meta_ads_lead_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_meta_ads_lead_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5408 (class 0 OID 0)
-- Dependencies: 435
-- Name: cliente_meta_ads_lead_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_meta_ads_lead_id_seq OWNED BY public.cliente_meta_ads_lead.id;


--
-- TOC entry 232 (class 1259 OID 26782)
-- Name: cliente_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_tag (
    id integer NOT NULL,
    cliente_id integer,
    tag_id integer
);


--
-- TOC entry 233 (class 1259 OID 26785)
-- Name: cliente_tag_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_tag_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5409 (class 0 OID 0)
-- Dependencies: 233
-- Name: cliente_tag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_tag_id_seq OWNED BY public.cliente_tag.id;


--
-- TOC entry 319 (class 1259 OID 35563)
-- Name: comercial_crm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_crm (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(120) NOT NULL,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval) NOT NULL,
    master boolean DEFAULT false,
    filial_id integer,
    automacao_etapa_atendimento_iniciado_id bigint,
    automacao_etapa_orcamento_enviado_id bigint,
    financeiro_gerar_conta_receber boolean DEFAULT false NOT NULL,
    financeiro_conta_financeira_id bigint,
    financeiro_categoria_id bigint,
    financeiro_centro_custo_id bigint,
    financeiro_empresa_grupo_id bigint,
    financeiro_vencimento_dias integer DEFAULT 0 NOT NULL
);


--
-- TOC entry 318 (class 1259 OID 35562)
-- Name: comercial_crm_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_crm_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5410 (class 0 OID 0)
-- Dependencies: 318
-- Name: comercial_crm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_crm_id_seq OWNED BY public.comercial_crm.id;


--
-- TOC entry 464 (class 1259 OID 76539)
-- Name: comercial_crm_meta_numero; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_crm_meta_numero (
    id bigint NOT NULL,
    crm_id bigint NOT NULL,
    empresa_meta_param_id integer NOT NULL,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 463 (class 1259 OID 76538)
-- Name: comercial_crm_meta_numero_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_crm_meta_numero_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5411 (class 0 OID 0)
-- Dependencies: 463
-- Name: comercial_crm_meta_numero_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_crm_meta_numero_id_seq OWNED BY public.comercial_crm_meta_numero.id;


--
-- TOC entry 416 (class 1259 OID 42729)
-- Name: comercial_crm_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_crm_usuario (
    id bigint NOT NULL,
    crm_id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 415 (class 1259 OID 42728)
-- Name: comercial_crm_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_crm_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5412 (class 0 OID 0)
-- Dependencies: 415
-- Name: comercial_crm_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_crm_usuario_id_seq OWNED BY public.comercial_crm_usuario.id;


--
-- TOC entry 460 (class 1259 OID 70059)
-- Name: comercial_disparo_agendado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_disparo_agendado (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    usuario_id bigint,
    empresa_meta_param_id bigint NOT NULL,
    template_name character varying(255) NOT NULL,
    template_language character varying(20) DEFAULT 'pt_BR'::character varying NOT NULL,
    audience_type character varying(30) NOT NULL,
    lista_transmissao_id bigint,
    crm_id bigint,
    etapa_id bigint,
    scheduled_date date NOT NULL,
    scheduled_hour smallint NOT NULL,
    header_media_type character varying(20),
    header_media_url text,
    header_parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
    body_parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
    button_parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(40) DEFAULT 'pending'::character varying NOT NULL,
    total_recipients integer DEFAULT 0 NOT NULL,
    processed_recipients integer DEFAULT 0 NOT NULL,
    sent_recipients integer DEFAULT 0 NOT NULL,
    error_recipients integer DEFAULT 0 NOT NULL,
    dispatch_history_id bigint,
    processing_token character varying(80),
    processing_started_at timestamp with time zone,
    completed_at timestamp with time zone,
    canceled_at timestamp with time zone,
    last_error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comercial_disparo_agendado_audience_type_check CHECK (((audience_type)::text = ANY ((ARRAY['lista_transmissao'::character varying, 'crm'::character varying])::text[]))),
    CONSTRAINT comercial_disparo_agendado_scheduled_hour_check CHECK (((scheduled_hour >= 0) AND (scheduled_hour <= 23))),
    CONSTRAINT comercial_disparo_agendado_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'completed_with_errors'::character varying, 'failed'::character varying, 'canceled'::character varying])::text[]))),
    CONSTRAINT comercial_disparo_agendado_target_check CHECK (((((audience_type)::text = 'lista_transmissao'::text) AND (lista_transmissao_id IS NOT NULL) AND (crm_id IS NULL) AND (etapa_id IS NULL)) OR (((audience_type)::text = 'crm'::text) AND (lista_transmissao_id IS NULL) AND (crm_id IS NOT NULL) AND (etapa_id IS NOT NULL))))
);


--
-- TOC entry 459 (class 1259 OID 70058)
-- Name: comercial_disparo_agendado_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_disparo_agendado_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5413 (class 0 OID 0)
-- Dependencies: 459
-- Name: comercial_disparo_agendado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_disparo_agendado_id_seq OWNED BY public.comercial_disparo_agendado.id;


--
-- TOC entry 462 (class 1259 OID 70122)
-- Name: comercial_disparo_agendado_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_disparo_agendado_item (
    id bigint NOT NULL,
    agendamento_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    cliente_id bigint,
    numero_original character varying(255),
    numero_normalizado character varying(255) NOT NULL,
    contato_nome character varying(255),
    email character varying(255),
    data_aniversario date,
    conversa_id bigint,
    negocio_id bigint,
    negocio_titulo character varying(255),
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    lock_token character varying(80),
    processing_started_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    mensagem_whats_id character varying(255),
    message_status character varying(80),
    erro_mensagem text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comercial_disparo_agendado_item_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'sent'::character varying, 'error'::character varying, 'skipped'::character varying, 'canceled'::character varying])::text[])))
);


--
-- TOC entry 461 (class 1259 OID 70121)
-- Name: comercial_disparo_agendado_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_disparo_agendado_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5414 (class 0 OID 0)
-- Dependencies: 461
-- Name: comercial_disparo_agendado_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_disparo_agendado_item_id_seq OWNED BY public.comercial_disparo_agendado_item.id;


--
-- TOC entry 321 (class 1259 OID 35582)
-- Name: comercial_etapa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_etapa (
    id bigint NOT NULL,
    crm_id bigint NOT NULL,
    codigo character varying(30) NOT NULL,
    nome character varying(80) NOT NULL,
    ordem smallint NOT NULL,
    cor character varying(20),
    eh_inicial boolean DEFAULT false NOT NULL,
    eh_fechamento boolean DEFAULT false NOT NULL,
    eh_ganho boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL
);


--
-- TOC entry 320 (class 1259 OID 35581)
-- Name: comercial_etapa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_etapa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5415 (class 0 OID 0)
-- Dependencies: 320
-- Name: comercial_etapa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_etapa_id_seq OWNED BY public.comercial_etapa.id;


--
-- TOC entry 323 (class 1259 OID 35606)
-- Name: comercial_forma_pagamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_forma_pagamento (
    id bigint NOT NULL,
    empresa_id integer,
    codigo character varying(40) NOT NULL,
    nome character varying(100) NOT NULL,
    permite_parcelamento boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL
);


--
-- TOC entry 322 (class 1259 OID 35605)
-- Name: comercial_forma_pagamento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_forma_pagamento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5416 (class 0 OID 0)
-- Dependencies: 322
-- Name: comercial_forma_pagamento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_forma_pagamento_id_seq OWNED BY public.comercial_forma_pagamento.id;


--
-- TOC entry 360 (class 1259 OID 39723)
-- Name: comercial_historico_cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_historico_cliente (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    negocio_id bigint,
    cliente_id integer NOT NULL,
    usuario_id integer,
    interacao_id bigint,
    tipo character varying(50) NOT NULL,
    titulo character varying(120) NOT NULL,
    descricao text,
    dados jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 359 (class 1259 OID 39722)
-- Name: comercial_historico_cliente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.comercial_historico_cliente ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.comercial_historico_cliente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 338 (class 1259 OID 35790)
-- Name: comercial_interacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_interacao (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    negocio_id bigint,
    cliente_id integer,
    usuario_id integer,
    tipo_interacao_id bigint NOT NULL,
    descricao text NOT NULL,
    data_inicio timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    data_fim timestamp without time zone,
    duracao_segundos integer,
    valor numeric(14,2),
    em_andamento boolean DEFAULT false NOT NULL,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    categoria character varying(20) DEFAULT 'interacao'::character varying NOT NULL,
    CONSTRAINT comercial_interacao_categoria_chk CHECK (((categoria)::text = ANY ((ARRAY['interacao'::character varying, 'agendamento'::character varying])::text[]))),
    CONSTRAINT comercial_interacao_duracao_chk CHECK (((duracao_segundos IS NULL) OR (duracao_segundos >= 0)))
);


--
-- TOC entry 337 (class 1259 OID 35789)
-- Name: comercial_interacao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_interacao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5417 (class 0 OID 0)
-- Dependencies: 337
-- Name: comercial_interacao_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_interacao_id_seq OWNED BY public.comercial_interacao.id;


--
-- TOC entry 325 (class 1259 OID 35620)
-- Name: comercial_motivo_perda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_motivo_perda (
    id bigint NOT NULL,
    empresa_id integer,
    codigo character varying(40) NOT NULL,
    nome character varying(100) NOT NULL,
    ativo boolean DEFAULT true NOT NULL
);


--
-- TOC entry 324 (class 1259 OID 35619)
-- Name: comercial_motivo_perda_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_motivo_perda_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5418 (class 0 OID 0)
-- Dependencies: 324
-- Name: comercial_motivo_perda_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_motivo_perda_id_seq OWNED BY public.comercial_motivo_perda.id;


--
-- TOC entry 327 (class 1259 OID 35633)
-- Name: comercial_negocio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_negocio (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    crm_id bigint NOT NULL,
    cliente_id integer,
    responsavel_usuario_id integer,
    etapa_id bigint NOT NULL,
    titulo character varying(200) NOT NULL,
    nome_empresa character varying(200),
    nome_contato character varying(150) NOT NULL,
    telefone character varying(30),
    email character varying(150),
    documento character varying(30),
    temperatura character varying(10),
    probabilidade smallint DEFAULT 0 NOT NULL,
    valor_estimado numeric(14,2) DEFAULT 0 NOT NULL,
    valor_fechamento numeric(14,2),
    quantidade_itens integer,
    origem_venda character varying(100),
    forma_pagamento_id bigint,
    parcelas smallint,
    motivo_perda_id bigint,
    observacoes_venda text,
    observacoes_perda text,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    data_entrada_pipeline timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    data_fechamento_prevista date,
    data_fechamento_real date,
    posicao_kanban integer,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT comercial_negocio_parcelas_chk CHECK (((parcelas IS NULL) OR (parcelas >= 1))),
    CONSTRAINT comercial_negocio_probabilidade_check CHECK (((probabilidade >= 0) AND (probabilidade <= 100))),
    CONSTRAINT comercial_negocio_quantidade_chk CHECK (((quantidade_itens IS NULL) OR (quantidade_itens >= 1))),
    CONSTRAINT comercial_negocio_temperatura_check CHECK (((temperatura)::text = ANY ((ARRAY['quente'::character varying, 'morno'::character varying, 'frio'::character varying])::text[])))
);


--
-- TOC entry 326 (class 1259 OID 35632)
-- Name: comercial_negocio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_negocio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5419 (class 0 OID 0)
-- Dependencies: 326
-- Name: comercial_negocio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_negocio_id_seq OWNED BY public.comercial_negocio.id;


--
-- TOC entry 340 (class 1259 OID 35829)
-- Name: comercial_negocio_movimentacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_negocio_movimentacao (
    id bigint NOT NULL,
    negocio_id bigint NOT NULL,
    usuario_id integer,
    etapa_origem_id bigint,
    etapa_destino_id bigint NOT NULL,
    data_movimentacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    observacao text
);


--
-- TOC entry 339 (class 1259 OID 35828)
-- Name: comercial_negocio_movimentacao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_negocio_movimentacao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5420 (class 0 OID 0)
-- Dependencies: 339
-- Name: comercial_negocio_movimentacao_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_negocio_movimentacao_id_seq OWNED BY public.comercial_negocio_movimentacao.id;


--
-- TOC entry 334 (class 1259 OID 35755)
-- Name: comercial_negocio_produto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_negocio_produto (
    id bigint NOT NULL,
    negocio_id bigint NOT NULL,
    comercial_produto_id bigint,
    nome_produto character varying(200) NOT NULL,
    quantidade numeric(12,2) DEFAULT 1 NOT NULL,
    preco_unitario numeric(14,2) DEFAULT 0 NOT NULL,
    total_item numeric(14,2) GENERATED ALWAYS AS ((quantidade * preco_unitario)) STORED,
    CONSTRAINT comercial_negocio_produto_preco_chk CHECK ((preco_unitario >= (0)::numeric)),
    CONSTRAINT comercial_negocio_produto_quantidade_chk CHECK ((quantidade > (0)::numeric))
);


--
-- TOC entry 333 (class 1259 OID 35754)
-- Name: comercial_negocio_produto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_negocio_produto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5421 (class 0 OID 0)
-- Dependencies: 333
-- Name: comercial_negocio_produto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_negocio_produto_id_seq OWNED BY public.comercial_negocio_produto.id;


--
-- TOC entry 330 (class 1259 OID 35700)
-- Name: comercial_negocio_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_negocio_tag (
    negocio_id bigint NOT NULL,
    tag_id bigint NOT NULL
);


--
-- TOC entry 440 (class 1259 OID 44972)
-- Name: comercial_orcamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_orcamento (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    negocio_id bigint NOT NULL,
    titulo character varying(200) NOT NULL,
    observacoes text,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    desconto numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    status character varying(30) DEFAULT 'ativo'::character varying NOT NULL,
    principal boolean DEFAULT true NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT comercial_orcamento_desconto_chk CHECK ((desconto >= (0)::numeric)),
    CONSTRAINT comercial_orcamento_subtotal_chk CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT comercial_orcamento_total_chk CHECK ((total >= (0)::numeric))
);


--
-- TOC entry 439 (class 1259 OID 44971)
-- Name: comercial_orcamento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.comercial_orcamento ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.comercial_orcamento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 442 (class 1259 OID 44993)
-- Name: comercial_orcamento_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_orcamento_item (
    id bigint NOT NULL,
    orcamento_id bigint NOT NULL,
    comercial_produto_id bigint,
    nome_produto character varying(200) NOT NULL,
    quantidade numeric(12,2) DEFAULT 1 NOT NULL,
    preco_unitario numeric(14,2) DEFAULT 0 NOT NULL,
    total_item numeric(14,2) GENERATED ALWAYS AS ((quantidade * preco_unitario)) STORED,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    quantidade_ganha numeric(12,2) DEFAULT 0 NOT NULL,
    quantidade_perdida numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT comercial_orcamento_item_preco_chk CHECK ((preco_unitario >= (0)::numeric)),
    CONSTRAINT comercial_orcamento_item_quantidade_chk CHECK ((quantidade > (0)::numeric)),
    CONSTRAINT comercial_orcamento_item_quantidade_ganha_chk CHECK ((quantidade_ganha >= (0)::numeric)),
    CONSTRAINT comercial_orcamento_item_quantidade_perdida_chk CHECK ((quantidade_perdida >= (0)::numeric)),
    CONSTRAINT comercial_orcamento_item_resultado_chk CHECK (((quantidade_ganha + quantidade_perdida) <= quantidade))
);


--
-- TOC entry 441 (class 1259 OID 44992)
-- Name: comercial_orcamento_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.comercial_orcamento_item ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.comercial_orcamento_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 332 (class 1259 OID 35738)
-- Name: comercial_produto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_produto (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(200) NOT NULL,
    descricao text,
    preco_base numeric(14,2) DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 434 (class 1259 OID 44807)
-- Name: comercial_produto_documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_produto_documento (
    id integer NOT NULL,
    comercial_produto_id integer NOT NULL,
    empresa_id integer NOT NULL,
    url text NOT NULL,
    path_bunny text NOT NULL,
    nome_arquivo character varying(255) NOT NULL,
    mime_type character varying(100),
    tamanho_bytes integer,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 433 (class 1259 OID 44806)
-- Name: comercial_produto_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_produto_documento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5422 (class 0 OID 0)
-- Dependencies: 433
-- Name: comercial_produto_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_produto_documento_id_seq OWNED BY public.comercial_produto_documento.id;


--
-- TOC entry 331 (class 1259 OID 35737)
-- Name: comercial_produto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_produto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5423 (class 0 OID 0)
-- Dependencies: 331
-- Name: comercial_produto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_produto_id_seq OWNED BY public.comercial_produto.id;


--
-- TOC entry 428 (class 1259 OID 44482)
-- Name: comercial_produto_imagem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_produto_imagem (
    id bigint NOT NULL,
    comercial_produto_id bigint NOT NULL,
    empresa_id integer NOT NULL,
    url text NOT NULL,
    path_bunny text NOT NULL,
    nome_arquivo character varying(255),
    mime_type character varying(120),
    tamanho_bytes bigint,
    ordem smallint DEFAULT 1 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 427 (class 1259 OID 44481)
-- Name: comercial_produto_imagem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.comercial_produto_imagem ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.comercial_produto_imagem_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 329 (class 1259 OID 35686)
-- Name: comercial_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_tag (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(60) NOT NULL,
    cor character varying(20),
    ativo boolean DEFAULT true NOT NULL
);


--
-- TOC entry 328 (class 1259 OID 35685)
-- Name: comercial_tag_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_tag_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5424 (class 0 OID 0)
-- Dependencies: 328
-- Name: comercial_tag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_tag_id_seq OWNED BY public.comercial_tag.id;


--
-- TOC entry 336 (class 1259 OID 35777)
-- Name: comercial_tipo_interacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_tipo_interacao (
    id bigint NOT NULL,
    empresa_id integer,
    codigo character varying(40) NOT NULL,
    nome character varying(100) NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    categoria character varying(20) DEFAULT 'interacao'::character varying NOT NULL,
    CONSTRAINT comercial_tipo_interacao_categoria_chk CHECK (((categoria)::text = ANY ((ARRAY['interacao'::character varying, 'agendamento'::character varying])::text[])))
);


--
-- TOC entry 335 (class 1259 OID 35776)
-- Name: comercial_tipo_interacao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comercial_tipo_interacao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5425 (class 0 OID 0)
-- Dependencies: 335
-- Name: comercial_tipo_interacao_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comercial_tipo_interacao_id_seq OWNED BY public.comercial_tipo_interacao.id;


--
-- TOC entry 311 (class 1259 OID 34499)
-- Name: day_off; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.day_off (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    data_referencia date NOT NULL,
    tipo character varying(30) NOT NULL,
    observacao text,
    status character varying(20) DEFAULT 'aprovado'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval) NOT NULL
);


--
-- TOC entry 310 (class 1259 OID 34498)
-- Name: day_off_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.day_off_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5426 (class 0 OID 0)
-- Dependencies: 310
-- Name: day_off_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.day_off_id_seq OWNED BY public.day_off.id;


--
-- TOC entry 466 (class 1259 OID 80586)
-- Name: developer_webhook; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.developer_webhook (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(160) NOT NULL,
    url text NOT NULL,
    eventos jsonb DEFAULT '[]'::jsonb NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    security_key text DEFAULT ''::text NOT NULL,
    security_location character varying(20) DEFAULT 'header'::character varying NOT NULL,
    security_field_name character varying(120) DEFAULT 'x-webhook-codigo'::character varying NOT NULL,
    CONSTRAINT developer_webhook_eventos_array_chk CHECK ((jsonb_typeof(eventos) = 'array'::text)),
    CONSTRAINT developer_webhook_security_location_chk CHECK (((security_location)::text = ANY ((ARRAY['header'::character varying, 'body'::character varying, 'query'::character varying])::text[])))
);


--
-- TOC entry 468 (class 1259 OID 80699)
-- Name: developer_webhook_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.developer_webhook_history (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    webhook_id bigint NOT NULL,
    event_key character varying(80) NOT NULL,
    entity_id bigint,
    dispatch_key character varying(64) NOT NULL,
    request_url text,
    request_headers jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_body jsonb DEFAULT '{}'::jsonb NOT NULL,
    response_status integer,
    response_headers jsonb DEFAULT '{}'::jsonb NOT NULL,
    response_body text,
    status character varying(20) DEFAULT 'processing'::character varying NOT NULL,
    error_message text,
    instance_id character varying(160),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    finished_at timestamp without time zone,
    CONSTRAINT developer_webhook_history_status_chk CHECK (((status)::text = ANY ((ARRAY['processing'::character varying, 'success'::character varying, 'error'::character varying])::text[])))
);


--
-- TOC entry 467 (class 1259 OID 80698)
-- Name: developer_webhook_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.developer_webhook_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5427 (class 0 OID 0)
-- Dependencies: 467
-- Name: developer_webhook_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.developer_webhook_history_id_seq OWNED BY public.developer_webhook_history.id;


--
-- TOC entry 465 (class 1259 OID 80585)
-- Name: developer_webhook_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.developer_webhook_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5428 (class 0 OID 0)
-- Dependencies: 465
-- Name: developer_webhook_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.developer_webhook_id_seq OWNED BY public.developer_webhook.id;


--
-- TOC entry 234 (class 1259 OID 26786)
-- Name: empresa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa (
    id integer NOT NULL,
    nome_fantasia character varying,
    razao_social character varying,
    cnpj character varying,
    logradouro character varying,
    numero character varying,
    bairro character varying,
    uf character varying,
    cidade character varying,
    cep character varying,
    ativo boolean,
    data_cadastro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    token_api character varying,
    cliente_webhook_codigo character varying(64) NOT NULL,
    cliente_webhook_ativo boolean DEFAULT true NOT NULL,
    cliente_webhook_public_id character varying(64) NOT NULL,
    prompt_ia_atendimento text,
    atendimento_lista_atribuida_adm boolean DEFAULT false NOT NULL,
    atendimento_mensagens_rapidas_ativas boolean DEFAULT true NOT NULL,
    atendimento_disparo_nps_ativo boolean DEFAULT true NOT NULL,
    nfc_emition boolean DEFAULT false NOT NULL,
    nfeio_api_key character varying(255),
    nfeio_company_id character varying(120),
    atendimento_fila_automatica_ativa boolean DEFAULT false NOT NULL,
    atendimento_fila_ultimo_usuario_id bigint,
    cliente_n8n_ia_nome character varying(120)
);


--
-- TOC entry 354 (class 1259 OID 39508)
-- Name: empresa_assinatura_pagamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_assinatura_pagamento (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    empresa_assinatura_id integer,
    assinatura_id integer,
    stripe_invoice_id character varying NOT NULL,
    stripe_payment_intent_id character varying,
    stripe_subscription_id character varying,
    stripe_customer_id character varying,
    status character varying(40) NOT NULL,
    valor_total numeric(14,2) DEFAULT 0 NOT NULL,
    moeda character varying(10),
    paid boolean DEFAULT false NOT NULL,
    paid_at timestamp without time zone,
    due_date timestamp without time zone,
    period_start timestamp without time zone,
    period_end timestamp without time zone,
    hosted_invoice_url text,
    invoice_pdf text,
    tentativa integer DEFAULT 0 NOT NULL,
    descricao text,
    stripe_event_id character varying,
    stripe_event_type character varying(60),
    stripe_event_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 353 (class 1259 OID 39507)
-- Name: empresa_assinatura_pagamento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_assinatura_pagamento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5429 (class 0 OID 0)
-- Dependencies: 353
-- Name: empresa_assinatura_pagamento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_assinatura_pagamento_id_seq OWNED BY public.empresa_assinatura_pagamento.id;


--
-- TOC entry 251 (class 1259 OID 26919)
-- Name: empresa_filial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_filial (
    id integer NOT NULL,
    empresa_id integer,
    nome character varying,
    telefone character varying,
    cnpj character varying,
    logradouro character varying,
    ativo boolean DEFAULT true,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    responsavel character varying,
    primaria boolean,
    latitude numeric(10,7),
    longitude numeric(10,7),
    tolerancia_metros integer,
    numero character varying(30),
    bairro character varying(120),
    cidade character varying(120),
    uf character varying(2),
    cep character varying(12),
    codigo_ibge_cidade character varying(10),
    inscricao_estadual character varying(30),
    nfeio_enabled boolean DEFAULT false NOT NULL,
    nfeio_company_id character varying(120),
    nfeio_environment character varying(20) DEFAULT 'Production'::character varying,
    nfeio_series integer,
    default_cfop integer,
    default_ncm character varying(20),
    default_cest character varying(20),
    default_gtin character varying(20) DEFAULT 'SEM GTIN'::character varying,
    default_icms_origin character varying(2) DEFAULT '0'::character varying,
    default_icms_csosn character varying(4) DEFAULT '102'::character varying,
    default_pis_cst character varying(4) DEFAULT '01'::character varying,
    default_pis_rate numeric(10,4) DEFAULT 0,
    default_cofins_cst character varying(4) DEFAULT '01'::character varying,
    default_cofins_rate numeric(10,4) DEFAULT 0
);


--
-- TOC entry 250 (class 1259 OID 26918)
-- Name: empresa_filial_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_filial_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5430 (class 0 OID 0)
-- Dependencies: 250
-- Name: empresa_filial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_filial_id_seq OWNED BY public.empresa_filial.id;


--
-- TOC entry 432 (class 1259 OID 44797)
-- Name: empresa_galeria_documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_galeria_documento (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome_arquivo character varying(255) NOT NULL,
    url text NOT NULL,
    path_bunny text NOT NULL,
    mime_type character varying(100),
    tamanho_bytes integer,
    origem text DEFAULT 'galeria_empresa_documento'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 431 (class 1259 OID 44796)
-- Name: empresa_galeria_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_galeria_documento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5431 (class 0 OID 0)
-- Dependencies: 431
-- Name: empresa_galeria_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_galeria_documento_id_seq OWNED BY public.empresa_galeria_documento.id;


--
-- TOC entry 430 (class 1259 OID 44759)
-- Name: empresa_galeria_imagem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_galeria_imagem (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome_arquivo character varying(255) NOT NULL,
    url text NOT NULL,
    path_bunny text NOT NULL,
    mime_type character varying(100),
    tamanho_bytes integer,
    origem text DEFAULT 'galeria_empresa'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 429 (class 1259 OID 44758)
-- Name: empresa_galeria_imagem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_galeria_imagem_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5432 (class 0 OID 0)
-- Dependencies: 429
-- Name: empresa_galeria_imagem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_galeria_imagem_id_seq OWNED BY public.empresa_galeria_imagem.id;


--
-- TOC entry 446 (class 1259 OID 45652)
-- Name: empresa_google_ads_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_google_ads_accounts (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    google_customer_id character varying NOT NULL,
    google_customer_name character varying,
    google_currency_code character varying(20),
    google_time_zone character varying(120),
    google_status character varying(40),
    google_manager boolean DEFAULT false NOT NULL,
    google_test_account boolean DEFAULT false NOT NULL,
    google_resource_name character varying,
    google_login_customer_id character varying,
    google_access_token text,
    google_refresh_token text,
    google_token_type character varying(40),
    google_token_scope text,
    google_token_expires_in integer,
    google_access_token_expires_at timestamp without time zone,
    google_last_oauth_at timestamp without time zone,
    google_payload jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 445 (class 1259 OID 45651)
-- Name: empresa_google_ads_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_google_ads_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5433 (class 0 OID 0)
-- Dependencies: 445
-- Name: empresa_google_ads_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_google_ads_accounts_id_seq OWNED BY public.empresa_google_ads_accounts.id;


--
-- TOC entry 472 (class 1259 OID 117270)
-- Name: empresa_hotmart_integracao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_hotmart_integracao (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    webhook_public_id character varying(64) NOT NULL,
    hottok character varying,
    ativo boolean DEFAULT false NOT NULL,
    sincronizar_vendas boolean DEFAULT true NOT NULL,
    sincronizar_carrinho_abandonado boolean DEFAULT true NOT NULL,
    sincronizar_assinaturas boolean DEFAULT false NOT NULL,
    sincronizar_reembolsos boolean DEFAULT false NOT NULL,
    vincular_clientes_existentes boolean DEFAULT true NOT NULL,
    criar_clientes_automaticamente boolean DEFAULT true NOT NULL,
    ultimo_evento_em timestamp with time zone,
    ultimo_evento_tipo character varying,
    ultima_sincronizacao_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 471 (class 1259 OID 117268)
-- Name: empresa_hotmart_integracao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_hotmart_integracao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5434 (class 0 OID 0)
-- Dependencies: 471
-- Name: empresa_hotmart_integracao_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_hotmart_integracao_id_seq OWNED BY public.empresa_hotmart_integracao.id;


--
-- TOC entry 476 (class 1259 OID 117327)
-- Name: empresa_hotmart_produto_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_hotmart_produto_map (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    hotmart_product_key character varying(255) NOT NULL,
    hotmart_product_id character varying(255),
    hotmart_offer_code character varying(255),
    hotmart_product_name character varying(255) NOT NULL,
    comercial_produto_id bigint NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 475 (class 1259 OID 117326)
-- Name: empresa_hotmart_produto_map_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_hotmart_produto_map_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5435 (class 0 OID 0)
-- Dependencies: 475
-- Name: empresa_hotmart_produto_map_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_hotmart_produto_map_id_seq OWNED BY public.empresa_hotmart_produto_map.id;


--
-- TOC entry 235 (class 1259 OID 26792)
-- Name: empresa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5436 (class 0 OID 0)
-- Dependencies: 235
-- Name: empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_id_seq OWNED BY public.empresa.id;


--
-- TOC entry 350 (class 1259 OID 37714)
-- Name: empresa_meta_ads_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_meta_ads_accounts (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    meta_business_id character varying,
    meta_business_name character varying,
    meta_ad_account_id character varying NOT NULL,
    meta_ad_account_name character varying,
    meta_ad_account_status character varying,
    meta_currency character varying,
    meta_timezone_id character varying,
    meta_timezone_name character varying,
    meta_account_id character varying,
    meta_disable_reason character varying,
    meta_graph_api_version character varying,
    meta_access_token_type character varying,
    meta_token_expires_in integer,
    meta_access_token_expires_at timestamp without time zone,
    meta_last_embedded_signup_at timestamp without time zone,
    meta_payload jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    meta_access_token text
);


--
-- TOC entry 349 (class 1259 OID 37712)
-- Name: empresa_meta_ads_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_meta_ads_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5437 (class 0 OID 0)
-- Dependencies: 349
-- Name: empresa_meta_ads_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_meta_ads_accounts_id_seq OWNED BY public.empresa_meta_ads_accounts.id;


--
-- TOC entry 438 (class 1259 OID 44874)
-- Name: empresa_meta_ads_field_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_meta_ads_field_mapping (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    escopo_tipo character varying(20) NOT NULL,
    escopo_id character varying NOT NULL,
    escopo_nome character varying,
    campo_nome character varying,
    campo_telefone character varying,
    campo_email character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 437 (class 1259 OID 44873)
-- Name: empresa_meta_ads_field_mapping_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_meta_ads_field_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5438 (class 0 OID 0)
-- Dependencies: 437
-- Name: empresa_meta_ads_field_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_meta_ads_field_mapping_id_seq OWNED BY public.empresa_meta_ads_field_mapping.id;


--
-- TOC entry 352 (class 1259 OID 39333)
-- Name: empresa_meta_instagram_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_meta_instagram_accounts (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    meta_business_id character varying,
    meta_business_name character varying,
    meta_page_id character varying,
    meta_page_name character varying,
    meta_instagram_business_account_id character varying NOT NULL,
    meta_instagram_username character varying,
    meta_instagram_name character varying,
    meta_instagram_profile_picture_url text,
    meta_graph_api_version character varying,
    meta_access_token text,
    meta_access_token_type character varying,
    meta_token_expires_in integer,
    meta_access_token_expires_at timestamp without time zone,
    meta_last_embedded_signup_at timestamp without time zone,
    meta_payload jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 351 (class 1259 OID 39332)
-- Name: empresa_meta_instagram_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_meta_instagram_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5439 (class 0 OID 0)
-- Dependencies: 351
-- Name: empresa_meta_instagram_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_meta_instagram_accounts_id_seq OWNED BY public.empresa_meta_instagram_accounts.id;


--
-- TOC entry 344 (class 1259 OID 36068)
-- Name: empresa_meta_parans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_meta_parans (
    id integer NOT NULL,
    empresa_id integer,
    whatsapp_account_id character varying,
    meta_phone_number_id character varying,
    meta_business_id character varying,
    meta_business_name character varying,
    meta_business_manager_id character varying,
    meta_business_manager_name character varying,
    meta_waba_name character varying,
    meta_display_phone_number character varying,
    meta_verified_name character varying,
    meta_webhook_verify_token character varying,
    meta_webhook_url character varying,
    meta_graph_api_version character varying,
    meta_app_scoped_user_id character varying,
    meta_wa_id character varying,
    meta_access_token_type character varying,
    meta_token_expires_in integer,
    meta_access_token_expires_at timestamp without time zone,
    meta_last_embedded_signup_at timestamp without time zone,
    meta_payload jsonb,
    ativo boolean DEFAULT true NOT NULL,
    whatsapp_auto_message_boas_vindas_ativa boolean DEFAULT true,
    whatsapp_auto_message_final_atendimento_ativa boolean DEFAULT true,
    whatsapp_auto_message_nps_ativa boolean DEFAULT true,
    whatsapp_auto_message_aniversario_ativa boolean DEFAULT true,
    whatsapp_auto_message_inicio_atendimento_ativa boolean DEFAULT true,
    whatsapp_birthday_template_name character varying(255),
    whatsapp_birthday_template_language character varying(20) DEFAULT 'pt_BR'::character varying,
    whatsapp_birthday_template_horario time without time zone DEFAULT '09:00:00'::time without time zone,
    whatsapp_birthday_template_header_parameters jsonb DEFAULT '[]'::jsonb,
    whatsapp_birthday_template_body_parameters jsonb DEFAULT '[]'::jsonb,
    whatsapp_birthday_template_button_parameters jsonb DEFAULT '[]'::jsonb,
    whatsapp_birthday_template_header_media_type character varying(20),
    whatsapp_birthday_template_header_media_url text,
    whatsapp_birthday_template_default_dispatch boolean DEFAULT false,
    whatsapp_auto_message_followup_venda_realizada_ativa boolean DEFAULT true NOT NULL,
    whatsapp_followup_venda_realizada_template_default_dispatch boolean DEFAULT false NOT NULL,
    whatsapp_followup_venda_realizada_template_name character varying,
    whatsapp_followup_venda_realizada_template_language character varying,
    whatsapp_followup_venda_realizada_template_horario time without time zone DEFAULT '09:00:00'::time without time zone,
    whatsapp_followup_venda_realizada_template_delay_days integer DEFAULT 3 NOT NULL,
    whatsapp_followup_venda_realizada_template_header_media_type character varying,
    whatsapp_followup_venda_realizada_template_header_media_url text,
    whatsapp_followup_venda_realizada_template_header_parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
    whatsapp_followup_venda_realizada_template_body_parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
    whatsapp_followup_venda_realizada_template_button_parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
    whatsapp_auto_message_followup_venda_recusada_ativa boolean DEFAULT true NOT NULL,
    whatsapp_auto_message_sem_resposta_6h_ativa boolean DEFAULT false NOT NULL,
    whatsapp_followup_venda_recusada_template_default_dispatch boolean DEFAULT false NOT NULL,
    whatsapp_followup_venda_recusada_template_name character varying,
    whatsapp_followup_venda_recusada_template_language character varying,
    whatsapp_followup_venda_recusada_template_horario time without time zone DEFAULT '09:00:00'::time without time zone,
    whatsapp_followup_venda_recusada_template_delay_days integer DEFAULT 3 NOT NULL,
    whatsapp_followup_venda_recusada_template_header_media_type character varying,
    whatsapp_followup_venda_recusada_template_header_media_url text,
    whatsapp_followup_venda_recusada_template_header_parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
    whatsapp_followup_venda_recusada_template_body_parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
    whatsapp_followup_venda_recusada_template_button_parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
    cor character varying(7)
);


--
-- TOC entry 343 (class 1259 OID 36067)
-- Name: empresa_meta_parans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_meta_parans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5440 (class 0 OID 0)
-- Dependencies: 343
-- Name: empresa_meta_parans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_meta_parans_id_seq OWNED BY public.empresa_meta_parans.id;


--
-- TOC entry 444 (class 1259 OID 45627)
-- Name: empresa_tiktok_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_tiktok_accounts (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tiktok_open_id character varying NOT NULL,
    tiktok_union_id character varying,
    tiktok_display_name character varying,
    tiktok_username character varying,
    tiktok_avatar_url text,
    tiktok_avatar_large_url text,
    tiktok_bio_description text,
    tiktok_profile_deep_link text,
    tiktok_is_verified boolean,
    tiktok_follower_count bigint,
    tiktok_following_count bigint,
    tiktok_likes_count bigint,
    tiktok_video_count bigint,
    tiktok_access_token text,
    tiktok_refresh_token text,
    tiktok_scope text,
    tiktok_token_type character varying,
    tiktok_token_expires_in integer,
    tiktok_token_expires_at timestamp without time zone,
    tiktok_refresh_token_expires_in integer,
    tiktok_refresh_token_expires_at timestamp without time zone,
    tiktok_last_oauth_at timestamp without time zone,
    tiktok_payload jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 443 (class 1259 OID 45626)
-- Name: empresa_tiktok_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_tiktok_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5441 (class 0 OID 0)
-- Dependencies: 443
-- Name: empresa_tiktok_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_tiktok_accounts_id_seq OWNED BY public.empresa_tiktok_accounts.id;


--
-- TOC entry 277 (class 1259 OID 28841)
-- Name: entrada; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entrada (
    id integer NOT NULL,
    usuario_id integer,
    filial_id integer,
    data_criacao timestamp without time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval),
    usuario_recebedor_id integer,
    data_recebimento timestamp without time zone,
    empresa_id integer,
    status character varying
);


--
-- TOC entry 276 (class 1259 OID 28840)
-- Name: entrada_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entrada_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5442 (class 0 OID 0)
-- Dependencies: 276
-- Name: entrada_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entrada_id_seq OWNED BY public.entrada.id;


--
-- TOC entry 293 (class 1259 OID 31494)
-- Name: equipe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipe (
    id integer NOT NULL,
    nome character varying,
    ativo boolean
);


--
-- TOC entry 292 (class 1259 OID 31493)
-- Name: equipe_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipe_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5443 (class 0 OID 0)
-- Dependencies: 292
-- Name: equipe_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipe_id_seq OWNED BY public.equipe.id;


--
-- TOC entry 259 (class 1259 OID 26955)
-- Name: fabricante; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fabricante (
    id integer NOT NULL,
    nome character varying,
    cnpj_cpf character varying,
    telefone character varying,
    email character varying,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    empresa_id integer,
    contato character varying
);


--
-- TOC entry 258 (class 1259 OID 26954)
-- Name: fabricante_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fabricante_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5444 (class 0 OID 0)
-- Dependencies: 258
-- Name: fabricante_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fabricante_id_seq OWNED BY public.fabricante.id;


--
-- TOC entry 309 (class 1259 OID 34473)
-- Name: feriado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feriado (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    data_referencia date NOT NULL,
    descricao character varying(200) NOT NULL,
    tipo character varying(20) DEFAULT 'nacional'::character varying,
    ativo boolean DEFAULT true NOT NULL
);


--
-- TOC entry 308 (class 1259 OID 34472)
-- Name: feriado_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feriado_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5445 (class 0 OID 0)
-- Dependencies: 308
-- Name: feriado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feriado_id_seq OWNED BY public.feriado.id;


--
-- TOC entry 406 (class 1259 OID 40504)
-- Name: financeiro_alerta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_alerta (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    tipo_id smallint NOT NULL,
    status_id smallint DEFAULT public.fn_fin_alerta_status_id('novo'::text) NOT NULL,
    titulo character varying(180) NOT NULL,
    descricao text,
    referencia_id bigint,
    referencia_tabela character varying(80),
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    data_alerta timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    lido_por integer,
    lido_em timestamp without time zone,
    resolvido_por integer,
    resolvido_em timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 404 (class 1259 OID 40482)
-- Name: financeiro_alerta_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_alerta_config (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    dias_alerta_vencimento integer DEFAULT 3 NOT NULL,
    limite_inadimplencia_percentual numeric(8,2) DEFAULT 15 NOT NULL,
    limite_queda_receita_percentual numeric(8,2) DEFAULT 20 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT financeiro_alerta_config_dias_alerta_vencimento_check CHECK ((dias_alerta_vencimento >= 0)),
    CONSTRAINT financeiro_alerta_config_limite_inadimplencia_percentual_check CHECK ((limite_inadimplencia_percentual >= (0)::numeric)),
    CONSTRAINT financeiro_alerta_config_limite_queda_receita_percentual_check CHECK ((limite_queda_receita_percentual >= (0)::numeric))
);


--
-- TOC entry 403 (class 1259 OID 40481)
-- Name: financeiro_alerta_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_alerta_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5446 (class 0 OID 0)
-- Dependencies: 403
-- Name: financeiro_alerta_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_alerta_config_id_seq OWNED BY public.financeiro_alerta_config.id;


--
-- TOC entry 405 (class 1259 OID 40503)
-- Name: financeiro_alerta_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_alerta_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5447 (class 0 OID 0)
-- Dependencies: 405
-- Name: financeiro_alerta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_alerta_id_seq OWNED BY public.financeiro_alerta.id;


--
-- TOC entry 380 (class 1259 OID 40041)
-- Name: financeiro_alerta_status_tipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_alerta_status_tipo (
    id smallint NOT NULL,
    codigo character varying(40) NOT NULL,
    nome character varying(80) NOT NULL
);


--
-- TOC entry 379 (class 1259 OID 40040)
-- Name: financeiro_alerta_status_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_alerta_status_tipo_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5448 (class 0 OID 0)
-- Dependencies: 379
-- Name: financeiro_alerta_status_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_alerta_status_tipo_id_seq OWNED BY public.financeiro_alerta_status_tipo.id;


--
-- TOC entry 378 (class 1259 OID 40032)
-- Name: financeiro_alerta_tipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_alerta_tipo (
    id smallint NOT NULL,
    codigo character varying(60) NOT NULL,
    nome character varying(120) NOT NULL
);


--
-- TOC entry 377 (class 1259 OID 40031)
-- Name: financeiro_alerta_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_alerta_tipo_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5449 (class 0 OID 0)
-- Dependencies: 377
-- Name: financeiro_alerta_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_alerta_tipo_id_seq OWNED BY public.financeiro_alerta_tipo.id;


--
-- TOC entry 414 (class 1259 OID 40766)
-- Name: financeiro_assinatura_empresa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_assinatura_empresa (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(120) NOT NULL,
    fornecedor character varying(120) NOT NULL,
    plano character varying(120),
    valor numeric(14,2) DEFAULT 0 NOT NULL,
    ciclo_cobranca character varying(20) DEFAULT 'mensal'::character varying NOT NULL,
    dia_vencimento integer,
    proximo_vencimento date,
    categoria_id bigint,
    conta_financeira_id bigint,
    observacao text,
    ativo boolean DEFAULT true NOT NULL,
    criado_por integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT financeiro_assinatura_empresa_dia_vencimento_check CHECK (((dia_vencimento IS NULL) OR ((dia_vencimento >= 1) AND (dia_vencimento <= 31)))),
    CONSTRAINT financeiro_assinatura_empresa_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- TOC entry 413 (class 1259 OID 40765)
-- Name: financeiro_assinatura_empresa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_assinatura_empresa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5450 (class 0 OID 0)
-- Dependencies: 413
-- Name: financeiro_assinatura_empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_assinatura_empresa_id_seq OWNED BY public.financeiro_assinatura_empresa.id;


--
-- TOC entry 382 (class 1259 OID 40059)
-- Name: financeiro_categoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_categoria (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(120) NOT NULL,
    tipo_id smallint DEFAULT public.fn_fin_tipo_categoria_id('ambos'::text) NOT NULL,
    categoria_pai_id bigint,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 381 (class 1259 OID 40058)
-- Name: financeiro_categoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_categoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5451 (class 0 OID 0)
-- Dependencies: 381
-- Name: financeiro_categoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_categoria_id_seq OWNED BY public.financeiro_categoria.id;


--
-- TOC entry 376 (class 1259 OID 40023)
-- Name: financeiro_categoria_tipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_categoria_tipo (
    id smallint NOT NULL,
    codigo character varying(40) NOT NULL,
    nome character varying(80) NOT NULL
);


--
-- TOC entry 375 (class 1259 OID 40022)
-- Name: financeiro_categoria_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_categoria_tipo_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5452 (class 0 OID 0)
-- Dependencies: 375
-- Name: financeiro_categoria_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_categoria_tipo_id_seq OWNED BY public.financeiro_categoria_tipo.id;


--
-- TOC entry 384 (class 1259 OID 40086)
-- Name: financeiro_centro_custo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_centro_custo (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    codigo character varying(40),
    nome character varying(120) NOT NULL,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 383 (class 1259 OID 40085)
-- Name: financeiro_centro_custo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_centro_custo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5453 (class 0 OID 0)
-- Dependencies: 383
-- Name: financeiro_centro_custo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_centro_custo_id_seq OWNED BY public.financeiro_centro_custo.id;


--
-- TOC entry 402 (class 1259 OID 40439)
-- Name: financeiro_comissao_lancamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_comissao_lancamento (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    usuario_id integer NOT NULL,
    comercial_negocio_id bigint,
    conta_receber_id bigint,
    base_calculo numeric(14,2) NOT NULL,
    percentual_aplicado numeric(8,4) DEFAULT 0 NOT NULL,
    valor_comissao numeric(14,2) NOT NULL,
    status_id smallint DEFAULT public.fn_fin_status_titulo_id('aberto'::text) NOT NULL,
    observacao text,
    competencia date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT financeiro_comissao_lancamento_base_calculo_check CHECK ((base_calculo >= (0)::numeric)),
    CONSTRAINT financeiro_comissao_lancamento_percentual_aplicado_check CHECK ((percentual_aplicado >= (0)::numeric)),
    CONSTRAINT financeiro_comissao_lancamento_valor_comissao_check CHECK ((valor_comissao >= (0)::numeric))
);


--
-- TOC entry 401 (class 1259 OID 40438)
-- Name: financeiro_comissao_lancamento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_comissao_lancamento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5454 (class 0 OID 0)
-- Dependencies: 401
-- Name: financeiro_comissao_lancamento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_comissao_lancamento_id_seq OWNED BY public.financeiro_comissao_lancamento.id;


--
-- TOC entry 386 (class 1259 OID 40106)
-- Name: financeiro_conta_financeira; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_conta_financeira (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(120) NOT NULL,
    tipo character varying(40) DEFAULT 'conta_corrente'::character varying NOT NULL,
    banco character varying(80),
    agencia character varying(20),
    conta character varying(30),
    pix_chave character varying(120),
    saldo_inicial numeric(14,2) DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 385 (class 1259 OID 40105)
-- Name: financeiro_conta_financeira_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_conta_financeira_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5455 (class 0 OID 0)
-- Dependencies: 385
-- Name: financeiro_conta_financeira_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_conta_financeira_id_seq OWNED BY public.financeiro_conta_financeira.id;


--
-- TOC entry 390 (class 1259 OID 40141)
-- Name: financeiro_conta_pagar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_conta_pagar (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    categoria_id bigint,
    centro_custo_id bigint,
    conta_financeira_id bigint,
    contraparte_id bigint,
    descricao character varying(255) NOT NULL,
    documento_numero character varying(60),
    competencia date,
    emissao date DEFAULT CURRENT_DATE NOT NULL,
    vencimento date NOT NULL,
    valor_original numeric(14,2) NOT NULL,
    desconto numeric(14,2) DEFAULT 0 NOT NULL,
    juros numeric(14,2) DEFAULT 0 NOT NULL,
    multa numeric(14,2) DEFAULT 0 NOT NULL,
    valor_pago_acumulado numeric(14,2) DEFAULT 0 NOT NULL,
    recorrencia_id smallint DEFAULT public.fn_fin_tipo_recorrencia_id('unico'::text) NOT NULL,
    recorrencia_grupo uuid,
    status_id smallint DEFAULT public.fn_fin_status_titulo_id('aberto'::text) NOT NULL,
    observacao text,
    criado_por integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    grupo_parcelamento_id uuid,
    parcela_numero integer DEFAULT 1 NOT NULL,
    parcela_total integer DEFAULT 1 NOT NULL,
    anexo_url text,
    anexo_nome_arquivo character varying(255),
    anexo_mimetype character varying(120),
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT financeiro_conta_pagar_desconto_check CHECK ((desconto >= (0)::numeric)),
    CONSTRAINT financeiro_conta_pagar_juros_check CHECK ((juros >= (0)::numeric)),
    CONSTRAINT financeiro_conta_pagar_multa_check CHECK ((multa >= (0)::numeric)),
    CONSTRAINT financeiro_conta_pagar_parcela_numero_chk CHECK (((parcela_numero >= 1) AND (parcela_total >= 1) AND (parcela_numero <= parcela_total))),
    CONSTRAINT financeiro_conta_pagar_valor_original_check CHECK ((valor_original > (0)::numeric)),
    CONSTRAINT financeiro_conta_pagar_valor_pago_acumulado_check CHECK ((valor_pago_acumulado >= (0)::numeric))
);


--
-- TOC entry 389 (class 1259 OID 40140)
-- Name: financeiro_conta_pagar_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_conta_pagar_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5456 (class 0 OID 0)
-- Dependencies: 389
-- Name: financeiro_conta_pagar_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_conta_pagar_id_seq OWNED BY public.financeiro_conta_pagar.id;


--
-- TOC entry 394 (class 1259 OID 40243)
-- Name: financeiro_conta_receber; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_conta_receber (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    cliente_id integer,
    comercial_negocio_id bigint,
    categoria_id bigint,
    centro_custo_id bigint,
    conta_financeira_id bigint,
    contraparte_id bigint,
    descricao character varying(255) NOT NULL,
    documento_numero character varying(60),
    competencia date,
    emissao date DEFAULT CURRENT_DATE NOT NULL,
    vencimento date NOT NULL,
    valor_original numeric(14,2) NOT NULL,
    desconto numeric(14,2) DEFAULT 0 NOT NULL,
    juros numeric(14,2) DEFAULT 0 NOT NULL,
    multa numeric(14,2) DEFAULT 0 NOT NULL,
    valor_recebido_acumulado numeric(14,2) DEFAULT 0 NOT NULL,
    recorrencia_id smallint DEFAULT public.fn_fin_tipo_recorrencia_id('unico'::text) NOT NULL,
    recorrencia_grupo uuid,
    status_id smallint DEFAULT public.fn_fin_status_titulo_id('aberto'::text) NOT NULL,
    observacao text,
    criado_por integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    grupo_parcelamento_id uuid,
    parcela_numero integer DEFAULT 1 NOT NULL,
    parcela_total integer DEFAULT 1 NOT NULL,
    anexo_url text,
    anexo_nome_arquivo character varying(255),
    anexo_mimetype character varying(120),
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT financeiro_conta_receber_desconto_check CHECK ((desconto >= (0)::numeric)),
    CONSTRAINT financeiro_conta_receber_juros_check CHECK ((juros >= (0)::numeric)),
    CONSTRAINT financeiro_conta_receber_multa_check CHECK ((multa >= (0)::numeric)),
    CONSTRAINT financeiro_conta_receber_parcela_numero_chk CHECK (((parcela_numero >= 1) AND (parcela_total >= 1) AND (parcela_numero <= parcela_total))),
    CONSTRAINT financeiro_conta_receber_valor_original_check CHECK ((valor_original > (0)::numeric)),
    CONSTRAINT financeiro_conta_receber_valor_recebido_acumulado_check CHECK ((valor_recebido_acumulado >= (0)::numeric))
);


--
-- TOC entry 393 (class 1259 OID 40242)
-- Name: financeiro_conta_receber_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_conta_receber_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5457 (class 0 OID 0)
-- Dependencies: 393
-- Name: financeiro_conta_receber_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_conta_receber_id_seq OWNED BY public.financeiro_conta_receber.id;


--
-- TOC entry 388 (class 1259 OID 40124)
-- Name: financeiro_contraparte; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_contraparte (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(180) NOT NULL,
    documento character varying(30),
    email character varying(180),
    telefone character varying(40),
    tipo character varying(40) DEFAULT 'outros'::character varying NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 387 (class 1259 OID 40123)
-- Name: financeiro_contraparte_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_contraparte_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5458 (class 0 OID 0)
-- Dependencies: 387
-- Name: financeiro_contraparte_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_contraparte_id_seq OWNED BY public.financeiro_contraparte.id;


--
-- TOC entry 398 (class 1259 OID 40355)
-- Name: financeiro_lancamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_lancamento (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    natureza_id smallint NOT NULL,
    status_id smallint DEFAULT public.fn_fin_status_lancamento_id('realizado'::text) NOT NULL,
    origem_id smallint NOT NULL,
    origem_registro_id bigint,
    conta_financeira_id bigint,
    categoria_id bigint,
    centro_custo_id bigint,
    data_lancamento timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    competencia date,
    valor numeric(14,2) NOT NULL,
    descricao character varying(255) NOT NULL,
    documento_numero character varying(60),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_por integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT financeiro_lancamento_valor_check CHECK ((valor > (0)::numeric))
);


--
-- TOC entry 397 (class 1259 OID 40354)
-- Name: financeiro_lancamento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_lancamento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5459 (class 0 OID 0)
-- Dependencies: 397
-- Name: financeiro_lancamento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_lancamento_id_seq OWNED BY public.financeiro_lancamento.id;


--
-- TOC entry 400 (class 1259 OID 40413)
-- Name: financeiro_meta_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_meta_usuario (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    usuario_id integer NOT NULL,
    mes_referencia date NOT NULL,
    valor_meta numeric(14,2) NOT NULL,
    percentual_comissao numeric(8,4) DEFAULT 0 NOT NULL,
    valor_comissao_fixa numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT financeiro_meta_usuario_percentual_comissao_check CHECK ((percentual_comissao >= (0)::numeric)),
    CONSTRAINT financeiro_meta_usuario_valor_comissao_fixa_check CHECK ((valor_comissao_fixa >= (0)::numeric)),
    CONSTRAINT financeiro_meta_usuario_valor_meta_check CHECK ((valor_meta >= (0)::numeric))
);


--
-- TOC entry 399 (class 1259 OID 40412)
-- Name: financeiro_meta_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_meta_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5460 (class 0 OID 0)
-- Dependencies: 399
-- Name: financeiro_meta_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_meta_usuario_id_seq OWNED BY public.financeiro_meta_usuario.id;


--
-- TOC entry 370 (class 1259 OID 39996)
-- Name: financeiro_natureza_lancamento_tipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_natureza_lancamento_tipo (
    id smallint NOT NULL,
    codigo character varying(40) NOT NULL,
    nome character varying(80) NOT NULL
);


--
-- TOC entry 369 (class 1259 OID 39995)
-- Name: financeiro_natureza_lancamento_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_natureza_lancamento_tipo_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5461 (class 0 OID 0)
-- Dependencies: 369
-- Name: financeiro_natureza_lancamento_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_natureza_lancamento_tipo_id_seq OWNED BY public.financeiro_natureza_lancamento_tipo.id;


--
-- TOC entry 372 (class 1259 OID 40005)
-- Name: financeiro_origem_lancamento_tipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_origem_lancamento_tipo (
    id smallint NOT NULL,
    codigo character varying(40) NOT NULL,
    nome character varying(120) NOT NULL
);


--
-- TOC entry 371 (class 1259 OID 40004)
-- Name: financeiro_origem_lancamento_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_origem_lancamento_tipo_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5462 (class 0 OID 0)
-- Dependencies: 371
-- Name: financeiro_origem_lancamento_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_origem_lancamento_tipo_id_seq OWNED BY public.financeiro_origem_lancamento_tipo.id;


--
-- TOC entry 392 (class 1259 OID 40207)
-- Name: financeiro_pagamento_pagar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_pagamento_pagar (
    id bigint NOT NULL,
    conta_pagar_id bigint NOT NULL,
    empresa_id integer NOT NULL,
    conta_financeira_id bigint,
    data_pagamento timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    valor numeric(14,2) NOT NULL,
    meio_pagamento character varying(40),
    referencia_externa character varying(120),
    observacao text,
    ativo boolean DEFAULT true NOT NULL,
    lancamento_id bigint,
    criado_por integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    anexo_url text,
    anexo_nome_arquivo character varying(255),
    anexo_mimetype character varying(120),
    CONSTRAINT financeiro_pagamento_pagar_valor_check CHECK ((valor > (0)::numeric))
);


--
-- TOC entry 391 (class 1259 OID 40206)
-- Name: financeiro_pagamento_pagar_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_pagamento_pagar_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5463 (class 0 OID 0)
-- Dependencies: 391
-- Name: financeiro_pagamento_pagar_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_pagamento_pagar_id_seq OWNED BY public.financeiro_pagamento_pagar.id;


--
-- TOC entry 396 (class 1259 OID 40319)
-- Name: financeiro_recebimento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_recebimento (
    id bigint NOT NULL,
    conta_receber_id bigint NOT NULL,
    empresa_id integer NOT NULL,
    conta_financeira_id bigint,
    data_recebimento timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    valor numeric(14,2) NOT NULL,
    meio_pagamento character varying(40),
    referencia_externa character varying(120),
    observacao text,
    ativo boolean DEFAULT true NOT NULL,
    lancamento_id bigint,
    criado_por integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT financeiro_recebimento_valor_check CHECK ((valor > (0)::numeric))
);


--
-- TOC entry 395 (class 1259 OID 40318)
-- Name: financeiro_recebimento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_recebimento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5464 (class 0 OID 0)
-- Dependencies: 395
-- Name: financeiro_recebimento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_recebimento_id_seq OWNED BY public.financeiro_recebimento.id;


--
-- TOC entry 374 (class 1259 OID 40014)
-- Name: financeiro_recorrencia_tipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_recorrencia_tipo (
    id smallint NOT NULL,
    codigo character varying(40) NOT NULL,
    nome character varying(80) NOT NULL
);


--
-- TOC entry 373 (class 1259 OID 40013)
-- Name: financeiro_recorrencia_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_recorrencia_tipo_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5465 (class 0 OID 0)
-- Dependencies: 373
-- Name: financeiro_recorrencia_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_recorrencia_tipo_id_seq OWNED BY public.financeiro_recorrencia_tipo.id;


--
-- TOC entry 368 (class 1259 OID 39987)
-- Name: financeiro_status_lancamento_tipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_status_lancamento_tipo (
    id smallint NOT NULL,
    codigo character varying(40) NOT NULL,
    nome character varying(80) NOT NULL
);


--
-- TOC entry 367 (class 1259 OID 39986)
-- Name: financeiro_status_lancamento_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_status_lancamento_tipo_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5466 (class 0 OID 0)
-- Dependencies: 367
-- Name: financeiro_status_lancamento_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_status_lancamento_tipo_id_seq OWNED BY public.financeiro_status_lancamento_tipo.id;


--
-- TOC entry 366 (class 1259 OID 39978)
-- Name: financeiro_status_titulo_tipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_status_titulo_tipo (
    id smallint NOT NULL,
    codigo character varying(40) NOT NULL,
    nome character varying(80) NOT NULL
);


--
-- TOC entry 365 (class 1259 OID 39977)
-- Name: financeiro_status_titulo_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_status_titulo_tipo_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5467 (class 0 OID 0)
-- Dependencies: 365
-- Name: financeiro_status_titulo_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_status_titulo_tipo_id_seq OWNED BY public.financeiro_status_titulo_tipo.id;


--
-- TOC entry 295 (class 1259 OID 34363)
-- Name: horario_trabalho; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horario_trabalho (
    id integer NOT NULL,
    empresa_id integer,
    nome character varying,
    descricao character varying,
    carga_horaria_diaria_minutos integer NOT NULL,
    carga_horaria_semanal_minutos integer,
    tolerancia_entrada_minutos integer DEFAULT 0 NOT NULL,
    tolerancia_saida_minutos integer DEFAULT 0 NOT NULL,
    tolerancia_extra_minutos integer DEFAULT 0 NOT NULL,
    flexivel boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 297 (class 1259 OID 34379)
-- Name: horario_trabalho_dia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horario_trabalho_dia (
    id bigint NOT NULL,
    horario_trabalho_id bigint NOT NULL,
    dia_semana integer NOT NULL,
    entrada_1 time without time zone,
    saida_1 time without time zone,
    entrada_2 time without time zone,
    saida_2 time without time zone,
    carga_prevista_minutos integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL
);


--
-- TOC entry 296 (class 1259 OID 34378)
-- Name: horario_trabalho_dia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.horario_trabalho_dia_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5468 (class 0 OID 0)
-- Dependencies: 296
-- Name: horario_trabalho_dia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.horario_trabalho_dia_id_seq OWNED BY public.horario_trabalho_dia.id;


--
-- TOC entry 294 (class 1259 OID 34362)
-- Name: horario_trabalho_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.horario_trabalho_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5469 (class 0 OID 0)
-- Dependencies: 294
-- Name: horario_trabalho_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.horario_trabalho_id_seq OWNED BY public.horario_trabalho.id;


--
-- TOC entry 474 (class 1259 OID 117295)
-- Name: hotmart_evento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotmart_evento (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    integracao_id bigint NOT NULL,
    cliente_id bigint,
    tipo_evento character varying NOT NULL,
    categoria_evento character varying,
    status_compra character varying,
    transacao_id character varying,
    produto_nome character varying,
    produto_codigo character varying,
    cliente_nome character varying,
    cliente_email character varying,
    cliente_telefone character varying,
    cliente_telefone_normalizado character varying,
    payload_hash character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    processado boolean DEFAULT false NOT NULL,
    mensagem_processamento text,
    vinculado_por_telefone boolean DEFAULT false NOT NULL,
    criou_cliente boolean DEFAULT false NOT NULL,
    recebido_em timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 473 (class 1259 OID 117294)
-- Name: hotmart_evento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotmart_evento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5470 (class 0 OID 0)
-- Dependencies: 473
-- Name: hotmart_evento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotmart_evento_id_seq OWNED BY public.hotmart_evento.id;


--
-- TOC entry 303 (class 1259 OID 34427)
-- Name: justificativa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.justificativa (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    data_inicio timestamp with time zone NOT NULL,
    data_fim timestamp with time zone NOT NULL,
    descricao text,
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    aprovado_por bigint,
    aprovado_em timestamp with time zone,
    motivo_recusa text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tipo_justificativa_id integer
);


--
-- TOC entry 305 (class 1259 OID 34443)
-- Name: justificativa_anexo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.justificativa_anexo (
    id bigint NOT NULL,
    justificativa_id bigint NOT NULL,
    nome_arquivo character varying(255) NOT NULL,
    url text NOT NULL,
    mime_type character varying(100),
    created_at timestamp with time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval) NOT NULL
);


--
-- TOC entry 304 (class 1259 OID 34442)
-- Name: justificativa_anexo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.justificativa_anexo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5471 (class 0 OID 0)
-- Dependencies: 304
-- Name: justificativa_anexo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.justificativa_anexo_id_seq OWNED BY public.justificativa_anexo.id;


--
-- TOC entry 302 (class 1259 OID 34426)
-- Name: justificativa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.justificativa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5472 (class 0 OID 0)
-- Dependencies: 302
-- Name: justificativa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.justificativa_id_seq OWNED BY public.justificativa.id;


--
-- TOC entry 342 (class 1259 OID 35882)
-- Name: justificativa_tipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.justificativa_tipo (
    id integer NOT NULL,
    descricao character varying,
    has_text boolean DEFAULT false,
    ativo boolean DEFAULT true,
    has_anexo boolean DEFAULT false
);


--
-- TOC entry 341 (class 1259 OID 35881)
-- Name: justificativa_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.justificativa_tipo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5473 (class 0 OID 0)
-- Dependencies: 341
-- Name: justificativa_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.justificativa_tipo_id_seq OWNED BY public.justificativa_tipo.id;


--
-- TOC entry 424 (class 1259 OID 43049)
-- Name: manual_artigo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_artigo (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    module_id text NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    summary text NOT NULL,
    content text DEFAULT ''::text,
    steps jsonb DEFAULT '[]'::jsonb,
    keywords jsonb DEFAULT '[]'::jsonb,
    related_route text,
    required_permissions jsonb DEFAULT '[]'::jsonb,
    min_plan_id integer,
    featured boolean DEFAULT false,
    ordem integer DEFAULT 1,
    status text DEFAULT 'draft'::text,
    ativo boolean DEFAULT true,
    created_by integer,
    updated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 423 (class 1259 OID 43047)
-- Name: manual_artigo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.manual_artigo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5474 (class 0 OID 0)
-- Dependencies: 423
-- Name: manual_artigo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.manual_artigo_id_seq OWNED BY public.manual_artigo.id;


--
-- TOC entry 236 (class 1259 OID 26793)
-- Name: mensagens_rapidas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensagens_rapidas (
    id integer NOT NULL,
    comando character varying,
    descricao character varying,
    texto text,
    data_criacao date DEFAULT CURRENT_DATE,
    ativo boolean,
    empresa_id integer,
    galeria_imagem_id integer,
    galeria_documento_id integer
);


--
-- TOC entry 237 (class 1259 OID 26799)
-- Name: mensagens_rapidas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mensagens_rapidas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5475 (class 0 OID 0)
-- Dependencies: 237
-- Name: mensagens_rapidas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mensagens_rapidas_id_seq OWNED BY public.mensagens_rapidas.id;


--
-- TOC entry 356 (class 1259 OID 39663)
-- Name: nps_pergunta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nps_pergunta (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    pergunta text NOT NULL,
    ordem integer DEFAULT 1 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    data_atualizacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT nps_pergunta_ordem_chk CHECK ((ordem > 0))
);


--
-- TOC entry 355 (class 1259 OID 39662)
-- Name: nps_pergunta_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nps_pergunta_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5476 (class 0 OID 0)
-- Dependencies: 355
-- Name: nps_pergunta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nps_pergunta_id_seq OWNED BY public.nps_pergunta.id;


--
-- TOC entry 358 (class 1259 OID 39683)
-- Name: nps_resposta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nps_resposta (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    atendimento_id integer NOT NULL,
    pergunta_id bigint NOT NULL,
    nota integer NOT NULL,
    resposta_texto text,
    data_resposta timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT nps_resposta_nota_chk CHECK (((nota >= 1) AND (nota <= 10)))
);


--
-- TOC entry 357 (class 1259 OID 39682)
-- Name: nps_resposta_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nps_resposta_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5477 (class 0 OID 0)
-- Dependencies: 357
-- Name: nps_resposta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nps_resposta_id_seq OWNED BY public.nps_resposta.id;


--
-- TOC entry 238 (class 1259 OID 26800)
-- Name: parametros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parametros (
    email character varying,
    senha character varying,
    provider character varying,
    api_key character varying,
    id integer NOT NULL,
    empresa_id integer,
    whatsapp_account_id character varying
);


--
-- TOC entry 239 (class 1259 OID 26805)
-- Name: parametros_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.parametros_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5478 (class 0 OID 0)
-- Dependencies: 239
-- Name: parametros_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.parametros_id_seq OWNED BY public.parametros.id;


--
-- TOC entry 287 (class 1259 OID 31059)
-- Name: pdv_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_version (
    id integer NOT NULL,
    version character varying,
    notes text,
    pub_date timestamp without time zone DEFAULT now(),
    active boolean DEFAULT true
);


--
-- TOC entry 286 (class 1259 OID 31058)
-- Name: pdv_version_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pdv_version_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5479 (class 0 OID 0)
-- Dependencies: 286
-- Name: pdv_version_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pdv_version_id_seq OWNED BY public.pdv_version.id;


--
-- TOC entry 289 (class 1259 OID 31077)
-- Name: pdv_version_sistem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_version_sistem (
    id integer NOT NULL,
    version_id integer,
    system character varying,
    link character varying,
    signature character varying
);


--
-- TOC entry 288 (class 1259 OID 31076)
-- Name: pdv_version_sistem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pdv_version_sistem_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5480 (class 0 OID 0)
-- Dependencies: 288
-- Name: pdv_version_sistem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pdv_version_sistem_id_seq OWNED BY public.pdv_version_sistem.id;


--
-- TOC entry 240 (class 1259 OID 26806)
-- Name: perfil; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perfil (
    id integer NOT NULL,
    nome character varying,
    data_criacao date DEFAULT CURRENT_DATE,
    ativo boolean,
    empresa_id integer
);


--
-- TOC entry 241 (class 1259 OID 26812)
-- Name: perfil_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.perfil_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5481 (class 0 OID 0)
-- Dependencies: 241
-- Name: perfil_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.perfil_id_seq OWNED BY public.perfil.id;


--
-- TOC entry 313 (class 1259 OID 34515)
-- Name: periodo_ferias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.periodo_ferias (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    periodo_aquisitivo_inicio date NOT NULL,
    periodo_aquisitivo_fim date NOT NULL,
    saldo_dias integer NOT NULL,
    status character varying(20) DEFAULT 'disponivel'::character varying NOT NULL
);


--
-- TOC entry 312 (class 1259 OID 34514)
-- Name: periodo_ferias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.periodo_ferias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5482 (class 0 OID 0)
-- Dependencies: 312
-- Name: periodo_ferias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.periodo_ferias_id_seq OWNED BY public.periodo_ferias.id;


--
-- TOC entry 253 (class 1259 OID 26929)
-- Name: produto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produto (
    id integer NOT NULL,
    nome character varying,
    cd_barra character varying,
    descricao character varying,
    preco double precision,
    preco_venda double precision,
    unidade_medida character varying,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    empresa_id integer,
    fabricante_id integer,
    preco_promocional numeric(10,2),
    inicio_promocao timestamp without time zone,
    fim_promocao timestamp without time zone,
    usuario_promocao integer,
    ncm character varying(20),
    cfop integer,
    cest character varying(20),
    gtin character varying(20),
    gtin_tributavel character varying(20),
    origem_fiscal character varying(2) DEFAULT '0'::character varying,
    icms_csosn character varying(4) DEFAULT '102'::character varying,
    pis_cst character varying(4) DEFAULT '01'::character varying,
    pis_rate numeric(10,4) DEFAULT 0,
    cofins_cst character varying(4) DEFAULT '01'::character varying,
    cofins_rate numeric(10,4) DEFAULT 0,
    carga_tributaria_percentual numeric(10,4) DEFAULT 0
);


--
-- TOC entry 257 (class 1259 OID 26948)
-- Name: produto_categoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produto_categoria (
    id integer NOT NULL,
    produto_id integer,
    categoria_id integer
);


--
-- TOC entry 256 (class 1259 OID 26947)
-- Name: produto_categoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.produto_categoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5483 (class 0 OID 0)
-- Dependencies: 256
-- Name: produto_categoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.produto_categoria_id_seq OWNED BY public.produto_categoria.id;


--
-- TOC entry 279 (class 1259 OID 28851)
-- Name: produto_entrada; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produto_entrada (
    id integer NOT NULL,
    produto_id integer,
    entrada_id integer,
    fornecedor_id integer,
    quantidade integer,
    custo_unitario double precision
);


--
-- TOC entry 278 (class 1259 OID 28850)
-- Name: produto_entrada_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.produto_entrada_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5484 (class 0 OID 0)
-- Dependencies: 278
-- Name: produto_entrada_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.produto_entrada_id_seq OWNED BY public.produto_entrada.id;


--
-- TOC entry 261 (class 1259 OID 26965)
-- Name: produto_estoque; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produto_estoque (
    id integer NOT NULL,
    produto_id integer,
    filial_id integer,
    empresa_id integer,
    tot_it integer,
    qt_estoque integer,
    qt_vitrine integer,
    ultima_att timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 260 (class 1259 OID 26964)
-- Name: produto_estoque_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.produto_estoque_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5485 (class 0 OID 0)
-- Dependencies: 260
-- Name: produto_estoque_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.produto_estoque_id_seq OWNED BY public.produto_estoque.id;


--
-- TOC entry 263 (class 1259 OID 26973)
-- Name: produto_estoque_movimentacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produto_estoque_movimentacao (
    id integer NOT NULL,
    produto_id integer,
    movimentacao_tipo_id integer,
    quantidade integer,
    filial_id integer,
    usuario_id integer,
    observacao character varying,
    data_movimentacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status_id integer DEFAULT 1,
    filial_id_destino integer,
    usuario_aprovador_id integer
);


--
-- TOC entry 262 (class 1259 OID 26972)
-- Name: produto_estoque_movimentacao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.produto_estoque_movimentacao_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5486 (class 0 OID 0)
-- Dependencies: 262
-- Name: produto_estoque_movimentacao_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.produto_estoque_movimentacao_id_seq OWNED BY public.produto_estoque_movimentacao.id;


--
-- TOC entry 267 (class 1259 OID 27316)
-- Name: produto_estoque_movimentacao_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produto_estoque_movimentacao_status (
    id integer NOT NULL,
    descricao character varying
);


--
-- TOC entry 266 (class 1259 OID 27315)
-- Name: produto_estoque_movimentacao_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.produto_estoque_movimentacao_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5487 (class 0 OID 0)
-- Dependencies: 266
-- Name: produto_estoque_movimentacao_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.produto_estoque_movimentacao_status_id_seq OWNED BY public.produto_estoque_movimentacao_status.id;


--
-- TOC entry 265 (class 1259 OID 26983)
-- Name: produto_estoque_movimentacao_tipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produto_estoque_movimentacao_tipo (
    id integer NOT NULL,
    descricao character varying
);


--
-- TOC entry 264 (class 1259 OID 26982)
-- Name: produto_estoque_movimentacao_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.produto_estoque_movimentacao_tipo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5488 (class 0 OID 0)
-- Dependencies: 264
-- Name: produto_estoque_movimentacao_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.produto_estoque_movimentacao_tipo_id_seq OWNED BY public.produto_estoque_movimentacao_tipo.id;


--
-- TOC entry 252 (class 1259 OID 26928)
-- Name: produto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.produto_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5489 (class 0 OID 0)
-- Dependencies: 252
-- Name: produto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.produto_id_seq OWNED BY public.produto.id;


--
-- TOC entry 281 (class 1259 OID 30815)
-- Name: promocao_produto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promocao_produto (
    id integer NOT NULL,
    produto_id integer,
    usuario_id integer,
    data_inicio timestamp without time zone,
    data_fim timestamp without time zone,
    valor double precision,
    data_cadastro date DEFAULT CURRENT_DATE
);


--
-- TOC entry 280 (class 1259 OID 30814)
-- Name: promocao_produto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promocao_produto_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5490 (class 0 OID 0)
-- Dependencies: 280
-- Name: promocao_produto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promocao_produto_id_seq OWNED BY public.promocao_produto.id;


--
-- TOC entry 470 (class 1259 OID 87713)
-- Name: push_token; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_token (
    id bigint NOT NULL,
    usuario_id integer NOT NULL,
    empresa_id integer NOT NULL,
    expo_push_token text NOT NULL,
    platform character varying(10) NOT NULL,
    device_id text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    atualizado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 469 (class 1259 OID 87712)
-- Name: push_token_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.push_token ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.push_token_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 301 (class 1259 OID 34413)
-- Name: registro_ponto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registro_ponto (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    data_hora timestamp with time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval) NOT NULL,
    tipo character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval) NOT NULL,
    latitude double precision,
    longitude double precision,
    precisao_metros double precision,
    localizacao_capturada_em timestamp with time zone,
    geolocalizacao_status character varying(40),
    geolocalizacao_autorizada boolean,
    timezone_cliente character varying(80),
    idioma_cliente character varying(40),
    plataforma_cliente character varying(80),
    user_agent text,
    dispositivo_mobile boolean,
    origem_registro character varying(40) DEFAULT 'web_colaborador'::character varying,
    registrado_por_usuario_id integer,
    ip_publico inet,
    faixa_ip cidr
);


--
-- TOC entry 300 (class 1259 OID 34412)
-- Name: registro_ponto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.registro_ponto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5491 (class 0 OID 0)
-- Dependencies: 300
-- Name: registro_ponto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.registro_ponto_id_seq OWNED BY public.registro_ponto.id;


--
-- TOC entry 242 (class 1259 OID 26813)
-- Name: setor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setor (
    id integer NOT NULL,
    nome character varying,
    empresa_id integer
);


--
-- TOC entry 243 (class 1259 OID 26818)
-- Name: setor_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.setor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5492 (class 0 OID 0)
-- Dependencies: 243
-- Name: setor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.setor_id_seq OWNED BY public.setor.id;


--
-- TOC entry 478 (class 1259 OID 145625)
-- Name: sistema_novidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sistema_novidade (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    titulo character varying(180) NOT NULL,
    resumo character varying(320),
    conteudo text NOT NULL,
    tipo character varying(30) DEFAULT 'notice'::character varying NOT NULL,
    destaque boolean DEFAULT false NOT NULL,
    modal_destaque boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    data_publicacao timestamp with time zone,
    criado_por_usuario_id bigint,
    atualizado_por_usuario_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    media_url text,
    media_type character varying(20),
    apenas_master boolean DEFAULT false NOT NULL
);


--
-- TOC entry 477 (class 1259 OID 145624)
-- Name: sistema_novidade_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sistema_novidade_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5493 (class 0 OID 0)
-- Dependencies: 477
-- Name: sistema_novidade_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sistema_novidade_id_seq OWNED BY public.sistema_novidade.id;


--
-- TOC entry 480 (class 1259 OID 145655)
-- Name: sistema_novidade_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sistema_novidade_usuario (
    id bigint NOT NULL,
    novidade_id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    visualizado_em timestamp with time zone,
    lida_em timestamp with time zone,
    modal_dispensado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 479 (class 1259 OID 145654)
-- Name: sistema_novidade_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sistema_novidade_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5494 (class 0 OID 0)
-- Dependencies: 479
-- Name: sistema_novidade_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sistema_novidade_usuario_id_seq OWNED BY public.sistema_novidade_usuario.id;


--
-- TOC entry 315 (class 1259 OID 34528)
-- Name: solicitacao_ferias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitacao_ferias (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    periodo_ferias_id bigint NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    quantidade_dias integer NOT NULL,
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    aprovado_por bigint,
    aprovado_em timestamp with time zone,
    observacao text,
    created_at timestamp with time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval) NOT NULL
);


--
-- TOC entry 314 (class 1259 OID 34527)
-- Name: solicitacao_ferias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitacao_ferias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5495 (class 0 OID 0)
-- Dependencies: 314
-- Name: solicitacao_ferias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitacao_ferias_id_seq OWNED BY public.solicitacao_ferias.id;


--
-- TOC entry 244 (class 1259 OID 26819)
-- Name: tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tag (
    id integer NOT NULL,
    nome character varying,
    empresa_id integer
);


--
-- TOC entry 245 (class 1259 OID 26824)
-- Name: tag_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tag_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5496 (class 0 OID 0)
-- Dependencies: 245
-- Name: tag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tag_id_seq OWNED BY public.tag.id;


--
-- TOC entry 291 (class 1259 OID 31417)
-- Name: tipo_acessos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipo_acessos (
    id integer NOT NULL,
    nome character varying
);


--
-- TOC entry 290 (class 1259 OID 31416)
-- Name: tipo_acessos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tipo_acessos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5497 (class 0 OID 0)
-- Dependencies: 290
-- Name: tipo_acessos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tipo_acessos_id_seq OWNED BY public.tipo_acessos.id;


--
-- TOC entry 246 (class 1259 OID 26825)
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    id integer NOT NULL,
    nome character varying,
    email character varying,
    senha character varying,
    data_criacao date DEFAULT CURRENT_DATE,
    ativo boolean,
    perfil_id integer,
    empresa_id integer,
    is_master boolean DEFAULT false,
    permissoes_customizadas jsonb DEFAULT '[]'::jsonb,
    pre_approval_id character varying,
    next_payment timestamp without time zone,
    status_assinatura_id integer,
    plano character varying,
    data_aniversairo date,
    telefone character varying(30),
    filial_id integer,
    foto_perfil_url text,
    foto_perfil_path_bunny text,
    foto_perfil_nome_arquivo character varying(255),
    foto_perfil_mime_type character varying(120),
    foto_perfil_tamanho_bytes bigint
);


--
-- TOC entry 299 (class 1259 OID 34395)
-- Name: usuario_horario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_horario (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    horario_trabalho_id bigint NOT NULL,
    ativo boolean DEFAULT true NOT NULL
);


--
-- TOC entry 298 (class 1259 OID 34394)
-- Name: usuario_horario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_horario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5498 (class 0 OID 0)
-- Dependencies: 298
-- Name: usuario_horario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_horario_id_seq OWNED BY public.usuario_horario.id;


--
-- TOC entry 247 (class 1259 OID 26831)
-- Name: usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5499 (class 0 OID 0)
-- Dependencies: 247
-- Name: usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_id_seq OWNED BY public.usuario.id;


--
-- TOC entry 426 (class 1259 OID 43244)
-- Name: usuario_meta_numero; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_meta_numero (
    id bigint NOT NULL,
    usuario_id integer NOT NULL,
    empresa_meta_param_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 425 (class 1259 OID 43243)
-- Name: usuario_meta_numero_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_meta_numero_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5500 (class 0 OID 0)
-- Dependencies: 425
-- Name: usuario_meta_numero_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_meta_numero_id_seq OWNED BY public.usuario_meta_numero.id;


--
-- TOC entry 248 (class 1259 OID 26832)
-- Name: usuario_setor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_setor (
    id integer NOT NULL,
    usuario_id integer,
    setor_id integer
);


--
-- TOC entry 249 (class 1259 OID 26835)
-- Name: usuario_setor_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_setor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5501 (class 0 OID 0)
-- Dependencies: 249
-- Name: usuario_setor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_setor_id_seq OWNED BY public.usuario_setor.id;


--
-- TOC entry 271 (class 1259 OID 27991)
-- Name: venda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venda (
    id integer NOT NULL,
    caixa_id integer,
    usuario_id integer,
    pagamento character varying,
    valor_venda double precision,
    data_venda timestamp without time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval),
    data_pagamento timestamp without time zone,
    external_id character varying,
    status_venda character varying,
    empresa_id integer,
    filial_id integer,
    troco double precision DEFAULT 0,
    recebido double precision DEFAULT 0,
    old_id character varying,
    desconto double precision,
    desconto_porcentagem double precision,
    estoque_baixado boolean DEFAULT false NOT NULL,
    nfce_id character varying(120),
    nfce_status character varying(40),
    nfce_numero character varying(30),
    nfce_chave character varying(60),
    nfce_pdf_url text,
    nfce_xml_url text,
    nfce_email_destinatario character varying(180),
    nfce_delivery_mode character varying(20),
    nfce_emitida_em timestamp without time zone,
    nfce_payload jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- TOC entry 270 (class 1259 OID 27990)
-- Name: venda_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venda_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5502 (class 0 OID 0)
-- Dependencies: 270
-- Name: venda_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venda_id_seq OWNED BY public.venda.id;


--
-- TOC entry 273 (class 1259 OID 28002)
-- Name: venda_produto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venda_produto (
    id integer NOT NULL,
    venda_id integer,
    produto_id integer,
    qt_it double precision,
    valor double precision
);


--
-- TOC entry 272 (class 1259 OID 28001)
-- Name: venda_produto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venda_produto_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5503 (class 0 OID 0)
-- Dependencies: 272
-- Name: venda_produto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venda_produto_id_seq OWNED BY public.venda_produto.id;


--
-- TOC entry 410 (class 1259 OID 40588)
-- Name: vw_financeiro_assinatura_cobrancas; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_financeiro_assinatura_cobrancas AS
 SELECT empresa_id,
    assinatura_id,
    stripe_invoice_id,
    status,
    valor_total,
    moeda,
    paid,
    paid_at,
    due_date,
    period_start,
    period_end,
    tentativa,
    stripe_event_type,
    created_at
   FROM public.empresa_assinatura_pagamento h;


--
-- TOC entry 408 (class 1259 OID 40578)
-- Name: vw_financeiro_dre_mensal; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_financeiro_dre_mensal AS
 SELECT fl.empresa_id,
    (date_trunc('month'::text, fl.data_lancamento))::date AS mes_referencia,
    (sum(
        CASE
            WHEN ((dnl.codigo)::text = 'entrada'::text) THEN fl.valor
            ELSE (0)::numeric
        END))::numeric(14,2) AS receita_bruta,
    (sum(
        CASE
            WHEN ((dnl.codigo)::text = 'saida'::text) THEN fl.valor
            ELSE (0)::numeric
        END))::numeric(14,2) AS despesas_totais,
    ((sum(
        CASE
            WHEN ((dnl.codigo)::text = 'entrada'::text) THEN fl.valor
            ELSE (0)::numeric
        END) - sum(
        CASE
            WHEN ((dnl.codigo)::text = 'saida'::text) THEN fl.valor
            ELSE (0)::numeric
        END)))::numeric(14,2) AS resultado_operacional
   FROM ((public.financeiro_lancamento fl
     JOIN public.financeiro_status_lancamento_tipo dsl ON ((dsl.id = fl.status_id)))
     JOIN public.financeiro_natureza_lancamento_tipo dnl ON ((dnl.id = fl.natureza_id)))
  WHERE ((dsl.codigo)::text = 'realizado'::text)
  GROUP BY fl.empresa_id, (date_trunc('month'::text, fl.data_lancamento));


--
-- TOC entry 407 (class 1259 OID 40573)
-- Name: vw_financeiro_fluxo_caixa_diario; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_financeiro_fluxo_caixa_diario AS
 WITH realizado AS (
         SELECT fl.empresa_id,
            date(fl.data_lancamento) AS dia,
            sum(
                CASE
                    WHEN ((dnl.codigo)::text = 'entrada'::text) THEN fl.valor
                    ELSE (0)::numeric
                END) AS entradas_realizadas,
            sum(
                CASE
                    WHEN ((dnl.codigo)::text = 'saida'::text) THEN fl.valor
                    ELSE (0)::numeric
                END) AS saidas_realizadas
           FROM ((public.financeiro_lancamento fl
             JOIN public.financeiro_status_lancamento_tipo dsl ON ((dsl.id = fl.status_id)))
             JOIN public.financeiro_natureza_lancamento_tipo dnl ON ((dnl.id = fl.natureza_id)))
          WHERE ((dsl.codigo)::text = 'realizado'::text)
          GROUP BY fl.empresa_id, (date(fl.data_lancamento))
        ), previsto_receber AS (
         SELECT cr.empresa_id,
            cr.vencimento AS dia,
            sum(GREATEST(((((cr.valor_original - cr.desconto) + cr.juros) + cr.multa) - cr.valor_recebido_acumulado), (0)::numeric)) AS entradas_previstas
           FROM (public.financeiro_conta_receber cr
             JOIN public.financeiro_status_titulo_tipo dst ON ((dst.id = cr.status_id)))
          WHERE ((dst.codigo)::text = ANY ((ARRAY['aberto'::character varying, 'parcial'::character varying, 'vencido'::character varying])::text[]))
          GROUP BY cr.empresa_id, cr.vencimento
        ), previsto_pagar AS (
         SELECT cp.empresa_id,
            cp.vencimento AS dia,
            sum(GREATEST(((((cp.valor_original - cp.desconto) + cp.juros) + cp.multa) - cp.valor_pago_acumulado), (0)::numeric)) AS saidas_previstas
           FROM (public.financeiro_conta_pagar cp
             JOIN public.financeiro_status_titulo_tipo dst ON ((dst.id = cp.status_id)))
          WHERE ((dst.codigo)::text = ANY ((ARRAY['aberto'::character varying, 'parcial'::character varying, 'vencido'::character varying])::text[]))
          GROUP BY cp.empresa_id, cp.vencimento
        )
 SELECT COALESCE(r.empresa_id, pr.empresa_id, pp.empresa_id) AS empresa_id,
    COALESCE(r.dia, pr.dia, pp.dia) AS dia,
    (COALESCE(r.entradas_realizadas, (0)::numeric))::numeric(14,2) AS entradas_realizadas,
    (COALESCE(r.saidas_realizadas, (0)::numeric))::numeric(14,2) AS saidas_realizadas,
    (COALESCE(pr.entradas_previstas, (0)::numeric))::numeric(14,2) AS entradas_previstas,
    (COALESCE(pp.saidas_previstas, (0)::numeric))::numeric(14,2) AS saidas_previstas,
    ((COALESCE(r.entradas_realizadas, (0)::numeric) - COALESCE(r.saidas_realizadas, (0)::numeric)))::numeric(14,2) AS saldo_realizado,
    ((COALESCE(pr.entradas_previstas, (0)::numeric) - COALESCE(pp.saidas_previstas, (0)::numeric)))::numeric(14,2) AS saldo_projetado
   FROM ((realizado r
     FULL JOIN previsto_receber pr ON (((pr.empresa_id = r.empresa_id) AND (pr.dia = r.dia))))
     FULL JOIN previsto_pagar pp ON (((pp.empresa_id = COALESCE(r.empresa_id, pr.empresa_id)) AND (pp.dia = COALESCE(r.dia, pr.dia)))));


--
-- TOC entry 412 (class 1259 OID 40597)
-- Name: vw_financeiro_inadimplencia_resumo; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_financeiro_inadimplencia_resumo AS
 SELECT cr.empresa_id,
    (count(*) FILTER (WHERE ((dst.codigo)::text = 'vencido'::text)))::integer AS total_titulos_vencidos,
    (sum(
        CASE
            WHEN ((dst.codigo)::text = 'vencido'::text) THEN GREATEST(((((cr.valor_original - cr.desconto) + cr.juros) + cr.multa) - cr.valor_recebido_acumulado), (0)::numeric)
            ELSE (0)::numeric
        END))::numeric(14,2) AS valor_total_vencido,
    (count(*) FILTER (WHERE ((dst.codigo)::text = ANY ((ARRAY['aberto'::character varying, 'parcial'::character varying, 'vencido'::character varying])::text[]))))::integer AS total_titulos_em_aberto
   FROM (public.financeiro_conta_receber cr
     JOIN public.financeiro_status_titulo_tipo dst ON ((dst.id = cr.status_id)))
  GROUP BY cr.empresa_id;


--
-- TOC entry 411 (class 1259 OID 40592)
-- Name: vw_financeiro_mrr_estimado; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_financeiro_mrr_estimado AS
 WITH base_plano AS (
         SELECT ea.empresa_id,
            ea.id AS empresa_assinatura_id,
            ea.ativo,
            ea.validade,
            COALESCE(a.preco, (0)::double precision) AS preco_plano,
                CASE
                    WHEN ((ea.stripe_price_id)::text = (a.stripe_price_id_yearly)::text) THEN 'yearly'::text
                    WHEN ((ea.stripe_price_id)::text = (a.stripe_price_id_monthly)::text) THEN 'monthly'::text
                    ELSE 'monthly'::text
                END AS ciclo
           FROM (public.empresa_assinatura ea
             LEFT JOIN public.assinatura a ON ((a.id = ea.assinatura_id)))
        ), mrr AS (
         SELECT base_plano.empresa_id,
            base_plano.empresa_assinatura_id,
            (
                CASE
                    WHEN (base_plano.ciclo = 'yearly'::text) THEN (base_plano.preco_plano / (12.0)::double precision)
                    ELSE base_plano.preco_plano
                END)::numeric(14,2) AS mrr_plano
           FROM base_plano
          WHERE ((base_plano.ativo = true) AND ((base_plano.validade IS NULL) OR (base_plano.validade >= CURRENT_DATE)))
        )
 SELECT empresa_id,
    (sum(mrr_plano))::numeric(14,2) AS mrr_estimado
   FROM mrr
  GROUP BY empresa_id;


--
-- TOC entry 409 (class 1259 OID 40583)
-- Name: vw_financeiro_receita_crm_prevista; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_financeiro_receita_crm_prevista AS
 SELECT n.empresa_id,
    COALESCE(n.data_fechamento_prevista, CURRENT_DATE) AS data_prevista,
    (count(*))::integer AS total_negocios,
    (sum(COALESCE(n.valor_estimado, (0)::numeric)))::numeric(14,2) AS valor_bruto_pipeline,
    (sum(((COALESCE(n.valor_estimado, (0)::numeric) * (COALESCE((n.probabilidade)::integer, 0))::numeric) / 100.0)))::numeric(14,2) AS valor_ponderado_pipeline
   FROM (public.comercial_negocio n
     LEFT JOIN public.comercial_etapa e ON ((e.id = n.etapa_id)))
  WHERE ((n.ativo = true) AND (COALESCE(e.eh_fechamento, false) = false))
  GROUP BY n.empresa_id, COALESCE(n.data_fechamento_prevista, CURRENT_DATE);


--
-- TOC entry 346 (class 1259 OID 37547)
-- Name: whatsapp_auto_message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_auto_message (
    id integer NOT NULL,
    texto text,
    whatsapp_auto_message_tipo_id integer,
    data_criacao timestamp without time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval),
    ativo boolean DEFAULT true,
    empresa_id integer,
    mensagem_complementar_texto text,
    galeria_imagem_id bigint,
    empresa_meta_param_id bigint
);


--
-- TOC entry 345 (class 1259 OID 37546)
-- Name: whatsapp_auto_message_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.whatsapp_auto_message_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5504 (class 0 OID 0)
-- Dependencies: 345
-- Name: whatsapp_auto_message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.whatsapp_auto_message_id_seq OWNED BY public.whatsapp_auto_message.id;


--
-- TOC entry 348 (class 1259 OID 37559)
-- Name: whatsapp_auto_message_tipo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_auto_message_tipo (
    id integer NOT NULL,
    descricao character varying
);


--
-- TOC entry 347 (class 1259 OID 37558)
-- Name: whatsapp_auto_message_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.whatsapp_auto_message_tipo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5505 (class 0 OID 0)
-- Dependencies: 347
-- Name: whatsapp_auto_message_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.whatsapp_auto_message_tipo_id_seq OWNED BY public.whatsapp_auto_message_tipo.id;


--
-- TOC entry 456 (class 1259 OID 67805)
-- Name: whatsapp_template_aniversario_envio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_template_aniversario_envio (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    empresa_meta_param_id integer NOT NULL,
    cliente_id integer NOT NULL,
    referencia_data date NOT NULL,
    template_name character varying(255) NOT NULL,
    template_language character varying(20),
    numero character varying(40),
    conversa_id integer,
    status character varying(20) DEFAULT 'processing'::character varying NOT NULL,
    tentativas integer DEFAULT 1 NOT NULL,
    lock_token character varying(64),
    mensagem_whats_id character varying(255),
    erro_mensagem text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    iniciado_em timestamp without time zone DEFAULT now() NOT NULL,
    processado_em timestamp without time zone,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 455 (class 1259 OID 67804)
-- Name: whatsapp_template_aniversario_envio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.whatsapp_template_aniversario_envio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5506 (class 0 OID 0)
-- Dependencies: 455
-- Name: whatsapp_template_aniversario_envio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.whatsapp_template_aniversario_envio_id_seq OWNED BY public.whatsapp_template_aniversario_envio.id;


--
-- TOC entry 450 (class 1259 OID 48249)
-- Name: whatsapp_template_disparo_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_template_disparo_item (
    id bigint NOT NULL,
    disparo_lote_id bigint NOT NULL,
    empresa_id integer NOT NULL,
    empresa_meta_param_id integer,
    cliente_id integer,
    template_id character varying NOT NULL,
    template_name character varying NOT NULL,
    template_language character varying,
    numero_original character varying,
    numero_normalizado character varying,
    contato_nome character varying,
    email character varying,
    conversa_id integer,
    message_id character varying,
    message_status character varying,
    sucesso boolean DEFAULT false NOT NULL,
    custo_unitario numeric(14,6) DEFAULT 0 NOT NULL,
    valor_cobrado numeric(14,6) DEFAULT 0 NOT NULL,
    enviado_em timestamp without time zone,
    recebido_em timestamp without time zone,
    erro_em timestamp without time zone,
    erro_mensagem text,
    erro_codigo character varying,
    erro_subcodigo character varying,
    erro_tipo character varying,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    data_criacao timestamp without time zone DEFAULT (CURRENT_TIMESTAMP - '03:00:00'::interval) NOT NULL
);


--
-- TOC entry 449 (class 1259 OID 48248)
-- Name: whatsapp_template_disparo_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.whatsapp_template_disparo_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5507 (class 0 OID 0)
-- Dependencies: 449
-- Name: whatsapp_template_disparo_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.whatsapp_template_disparo_item_id_seq OWNED BY public.whatsapp_template_disparo_item.id;


--
-- TOC entry 448 (class 1259 OID 48209)
-- Name: whatsapp_template_disparo_lote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_template_disparo_lote (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    empresa_meta_param_id integer,
    template_id character varying NOT NULL,
    template_name character varying NOT NULL,
    template_language character varying,
    template_category character varying,
    lista_transmissao_id integer,
    total_clientes integer DEFAULT 0 NOT NULL,
    processados integer DEFAULT 0 NOT NULL,
    enviados integer DEFAULT 0 NOT NULL,
    recebidos integer DEFAULT 0 NOT NULL,
    erros integer DEFAULT 0 NOT NULL,
    parar_no_primeiro_erro boolean DEFAULT false NOT NULL,
    interrompido_no_erro boolean DEFAULT false NOT NULL,
    custo_unitario numeric(14,6) DEFAULT 0 NOT NULL,
    valor_total numeric(14,6) DEFAULT 0 NOT NULL,
    moeda character varying(8) DEFAULT 'USD'::character varying NOT NULL,
    data_inicio timestamp without time zone DEFAULT now() NOT NULL,
    data_fim timestamp without time zone,
    duracao_ms integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    data_criacao timestamp without time zone DEFAULT now() NOT NULL,
    usuario_id bigint
);


--
-- TOC entry 447 (class 1259 OID 48208)
-- Name: whatsapp_template_disparo_lote_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.whatsapp_template_disparo_lote_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5508 (class 0 OID 0)
-- Dependencies: 447
-- Name: whatsapp_template_disparo_lote_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.whatsapp_template_disparo_lote_id_seq OWNED BY public.whatsapp_template_disparo_lote.id;


--
-- TOC entry 458 (class 1259 OID 68120)
-- Name: whatsapp_template_followup_venda_envio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_template_followup_venda_envio (
    id bigint NOT NULL,
    automacao_tipo character varying(40) NOT NULL,
    empresa_id integer NOT NULL,
    empresa_meta_param_id integer NOT NULL,
    cliente_id integer,
    comercial_negocio_id bigint NOT NULL,
    evento_data date NOT NULL,
    template_name character varying(255),
    template_language character varying(20),
    numero character varying(30),
    conversa_id integer,
    status character varying(30) DEFAULT 'processing'::character varying NOT NULL,
    tentativas integer DEFAULT 1 NOT NULL,
    lock_token character varying(64),
    mensagem_whats_id character varying(120),
    erro_mensagem text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    iniciado_em timestamp without time zone DEFAULT now() NOT NULL,
    processado_em timestamp without time zone,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT whatsapp_template_followup_venda_envio_tipo_chk CHECK (((automacao_tipo)::text = ANY ((ARRAY['sale_completed'::character varying, 'sale_refused'::character varying])::text[])))
);


--
-- TOC entry 457 (class 1259 OID 68119)
-- Name: whatsapp_template_followup_venda_envio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.whatsapp_template_followup_venda_envio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5509 (class 0 OID 0)
-- Dependencies: 457
-- Name: whatsapp_template_followup_venda_envio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.whatsapp_template_followup_venda_envio_id_seq OWNED BY public.whatsapp_template_followup_venda_envio.id;


--
-- TOC entry 4185 (class 2604 OID 39944)
-- Name: addos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addos ALTER COLUMN id SET DEFAULT nextval('public.addos_id_seq'::regclass);


--
-- TOC entry 4076 (class 2604 OID 34588)
-- Name: apuracao_ponto_diaria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apuracao_ponto_diaria ALTER COLUMN id SET DEFAULT nextval('public.apuracao_ponto_diaria_id_seq'::regclass);


--
-- TOC entry 4026 (class 2604 OID 28827)
-- Name: assinatura id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinatura ALTER COLUMN id SET DEFAULT nextval('public.assinatura_id_seq1'::regclass);


--
-- TOC entry 4384 (class 2604 OID 63727)
-- Name: atendimento_fila_usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento_fila_usuario ALTER COLUMN id SET DEFAULT nextval('public.atendimento_fila_usuario_id_seq'::regclass);


--
-- TOC entry 4063 (class 2604 OID 34461)
-- Name: banco_horas_lancamento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banco_horas_lancamento ALTER COLUMN id SET DEFAULT nextval('public.banco_horas_lancamento_id_seq'::regclass);


--
-- TOC entry 4017 (class 2604 OID 27984)
-- Name: caixa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa ALTER COLUMN id SET DEFAULT nextval('public.caixa_id_seq'::regclass);


--
-- TOC entry 4034 (class 2604 OID 30935)
-- Name: caixa_abertura id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_abertura ALTER COLUMN id SET DEFAULT nextval('public.caixa_abertura_id_seq'::regclass);


--
-- TOC entry 4033 (class 2604 OID 30926)
-- Name: caixa_ruptura id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_ruptura ALTER COLUMN id SET DEFAULT nextval('public.caixa_ruptura_id_seq'::regclass);


--
-- TOC entry 4006 (class 2604 OID 26942)
-- Name: categoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria ALTER COLUMN id SET DEFAULT nextval('public.categoria_id_seq'::regclass);


--
-- TOC entry 3947 (class 2604 OID 26837)
-- Name: cliente id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente ALTER COLUMN id SET DEFAULT nextval('public.cliente_id_seq'::regclass);


--
-- TOC entry 3953 (class 2604 OID 26838)
-- Name: cliente_anotacao id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_anotacao ALTER COLUMN id SET DEFAULT nextval('public.cliente_anotacao_id_seq'::regclass);


--
-- TOC entry 3955 (class 2604 OID 26839)
-- Name: cliente_conversa_whats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats ALTER COLUMN id SET DEFAULT nextval('public.cliente_conversa_whats_id_seq'::regclass);


--
-- TOC entry 3960 (class 2604 OID 26840)
-- Name: cliente_conversa_whats_mensagem id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats_mensagem ALTER COLUMN id SET DEFAULT nextval('public.cliente_conversa_whats_mensagem_id_seq'::regclass);


--
-- TOC entry 4182 (class 2604 OID 39778)
-- Name: cliente_conversa_whats_usuario_leitura id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats_usuario_leitura ALTER COLUMN id SET DEFAULT nextval('public.cliente_conversa_whats_usuario_leitura_id_seq'::regclass);


--
-- TOC entry 4380 (class 2604 OID 59144)
-- Name: cliente_documento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_documento ALTER COLUMN id SET DEFAULT nextval('public.cliente_documento_id_seq'::regclass);


--
-- TOC entry 4291 (class 2604 OID 42773)
-- Name: cliente_lista_transmissao id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao ALTER COLUMN id SET DEFAULT nextval('public.cliente_lista_transmissao_id_seq'::regclass);


--
-- TOC entry 4299 (class 2604 OID 42823)
-- Name: cliente_lista_transmissao_contato id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao_contato ALTER COLUMN id SET DEFAULT nextval('public.cliente_lista_transmissao_contato_id_seq'::regclass);


--
-- TOC entry 4297 (class 2604 OID 42801)
-- Name: cliente_lista_transmissao_tag id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao_tag ALTER COLUMN id SET DEFAULT nextval('public.cliente_lista_transmissao_tag_id_seq'::regclass);


--
-- TOC entry 4329 (class 2604 OID 44850)
-- Name: cliente_meta_ads_lead id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_meta_ads_lead ALTER COLUMN id SET DEFAULT nextval('public.cliente_meta_ads_lead_id_seq'::regclass);


--
-- TOC entry 3964 (class 2604 OID 26841)
-- Name: cliente_tag id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_tag ALTER COLUMN id SET DEFAULT nextval('public.cliente_tag_id_seq'::regclass);


--
-- TOC entry 4084 (class 2604 OID 35566)
-- Name: comercial_crm id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm ALTER COLUMN id SET DEFAULT nextval('public.comercial_crm_id_seq'::regclass);


--
-- TOC entry 4416 (class 2604 OID 76542)
-- Name: comercial_crm_meta_numero id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm_meta_numero ALTER COLUMN id SET DEFAULT nextval('public.comercial_crm_meta_numero_id_seq'::regclass);


--
-- TOC entry 4289 (class 2604 OID 42732)
-- Name: comercial_crm_usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm_usuario ALTER COLUMN id SET DEFAULT nextval('public.comercial_crm_usuario_id_seq'::regclass);


--
-- TOC entry 4398 (class 2604 OID 70062)
-- Name: comercial_disparo_agendado id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado ALTER COLUMN id SET DEFAULT nextval('public.comercial_disparo_agendado_id_seq'::regclass);


--
-- TOC entry 4411 (class 2604 OID 70125)
-- Name: comercial_disparo_agendado_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado_item ALTER COLUMN id SET DEFAULT nextval('public.comercial_disparo_agendado_item_id_seq'::regclass);


--
-- TOC entry 4088 (class 2604 OID 35585)
-- Name: comercial_etapa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_etapa ALTER COLUMN id SET DEFAULT nextval('public.comercial_etapa_id_seq'::regclass);


--
-- TOC entry 4093 (class 2604 OID 35609)
-- Name: comercial_forma_pagamento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_forma_pagamento ALTER COLUMN id SET DEFAULT nextval('public.comercial_forma_pagamento_id_seq'::regclass);


--
-- TOC entry 4117 (class 2604 OID 35793)
-- Name: comercial_interacao id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_interacao ALTER COLUMN id SET DEFAULT nextval('public.comercial_interacao_id_seq'::regclass);


--
-- TOC entry 4096 (class 2604 OID 35623)
-- Name: comercial_motivo_perda id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_motivo_perda ALTER COLUMN id SET DEFAULT nextval('public.comercial_motivo_perda_id_seq'::regclass);


--
-- TOC entry 4098 (class 2604 OID 35636)
-- Name: comercial_negocio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio ALTER COLUMN id SET DEFAULT nextval('public.comercial_negocio_id_seq'::regclass);


--
-- TOC entry 4122 (class 2604 OID 35832)
-- Name: comercial_negocio_movimentacao id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_movimentacao ALTER COLUMN id SET DEFAULT nextval('public.comercial_negocio_movimentacao_id_seq'::regclass);


--
-- TOC entry 4110 (class 2604 OID 35758)
-- Name: comercial_negocio_produto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_produto ALTER COLUMN id SET DEFAULT nextval('public.comercial_negocio_produto_id_seq'::regclass);


--
-- TOC entry 4106 (class 2604 OID 35741)
-- Name: comercial_produto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_produto ALTER COLUMN id SET DEFAULT nextval('public.comercial_produto_id_seq'::regclass);


--
-- TOC entry 4326 (class 2604 OID 44810)
-- Name: comercial_produto_documento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_produto_documento ALTER COLUMN id SET DEFAULT nextval('public.comercial_produto_documento_id_seq'::regclass);


--
-- TOC entry 4104 (class 2604 OID 35689)
-- Name: comercial_tag id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_tag ALTER COLUMN id SET DEFAULT nextval('public.comercial_tag_id_seq'::regclass);


--
-- TOC entry 4114 (class 2604 OID 35780)
-- Name: comercial_tipo_interacao id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_tipo_interacao ALTER COLUMN id SET DEFAULT nextval('public.comercial_tipo_interacao_id_seq'::regclass);


--
-- TOC entry 4068 (class 2604 OID 34502)
-- Name: day_off id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_off ALTER COLUMN id SET DEFAULT nextval('public.day_off_id_seq'::regclass);


--
-- TOC entry 4418 (class 2604 OID 80589)
-- Name: developer_webhook id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.developer_webhook ALTER COLUMN id SET DEFAULT nextval('public.developer_webhook_id_seq'::regclass);


--
-- TOC entry 4426 (class 2604 OID 80702)
-- Name: developer_webhook_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.developer_webhook_history ALTER COLUMN id SET DEFAULT nextval('public.developer_webhook_history_id_seq'::regclass);


--
-- TOC entry 3965 (class 2604 OID 26842)
-- Name: empresa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa ALTER COLUMN id SET DEFAULT nextval('public.empresa_id_seq'::regclass);


--
-- TOC entry 3935 (class 2604 OID 26836)
-- Name: empresa_assinatura id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_assinatura ALTER COLUMN id SET DEFAULT nextval('public.assinatura_id_seq'::regclass);


--
-- TOC entry 4165 (class 2604 OID 39511)
-- Name: empresa_assinatura_pagamento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_assinatura_pagamento ALTER COLUMN id SET DEFAULT nextval('public.empresa_assinatura_pagamento_id_seq'::regclass);


--
-- TOC entry 3985 (class 2604 OID 26922)
-- Name: empresa_filial id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_filial ALTER COLUMN id SET DEFAULT nextval('public.empresa_filial_id_seq'::regclass);


--
-- TOC entry 4322 (class 2604 OID 44800)
-- Name: empresa_galeria_documento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_galeria_documento ALTER COLUMN id SET DEFAULT nextval('public.empresa_galeria_documento_id_seq'::regclass);


--
-- TOC entry 4318 (class 2604 OID 44762)
-- Name: empresa_galeria_imagem id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_galeria_imagem ALTER COLUMN id SET DEFAULT nextval('public.empresa_galeria_imagem_id_seq'::regclass);


--
-- TOC entry 4354 (class 2604 OID 45655)
-- Name: empresa_google_ads_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_google_ads_accounts ALTER COLUMN id SET DEFAULT nextval('public.empresa_google_ads_accounts_id_seq'::regclass);


--
-- TOC entry 4435 (class 2604 OID 117273)
-- Name: empresa_hotmart_integracao id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_hotmart_integracao ALTER COLUMN id SET DEFAULT nextval('public.empresa_hotmart_integracao_id_seq'::regclass);


--
-- TOC entry 4451 (class 2604 OID 117330)
-- Name: empresa_hotmart_produto_map id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_hotmart_produto_map ALTER COLUMN id SET DEFAULT nextval('public.empresa_hotmart_produto_map_id_seq'::regclass);


--
-- TOC entry 4159 (class 2604 OID 37717)
-- Name: empresa_meta_ads_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_meta_ads_accounts ALTER COLUMN id SET DEFAULT nextval('public.empresa_meta_ads_accounts_id_seq'::regclass);


--
-- TOC entry 4332 (class 2604 OID 44877)
-- Name: empresa_meta_ads_field_mapping id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_meta_ads_field_mapping ALTER COLUMN id SET DEFAULT nextval('public.empresa_meta_ads_field_mapping_id_seq'::regclass);


--
-- TOC entry 4162 (class 2604 OID 39336)
-- Name: empresa_meta_instagram_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_meta_instagram_accounts ALTER COLUMN id SET DEFAULT nextval('public.empresa_meta_instagram_accounts_id_seq'::regclass);


--
-- TOC entry 4128 (class 2604 OID 36071)
-- Name: empresa_meta_parans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_meta_parans ALTER COLUMN id SET DEFAULT nextval('public.empresa_meta_parans_id_seq'::regclass);


--
-- TOC entry 4351 (class 2604 OID 45630)
-- Name: empresa_tiktok_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_tiktok_accounts ALTER COLUMN id SET DEFAULT nextval('public.empresa_tiktok_accounts_id_seq'::regclass);


--
-- TOC entry 4028 (class 2604 OID 28844)
-- Name: entrada id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrada ALTER COLUMN id SET DEFAULT nextval('public.entrada_id_seq'::regclass);


--
-- TOC entry 4040 (class 2604 OID 31497)
-- Name: equipe id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipe ALTER COLUMN id SET DEFAULT nextval('public.equipe_id_seq'::regclass);


--
-- TOC entry 4008 (class 2604 OID 26958)
-- Name: fabricante id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fabricante ALTER COLUMN id SET DEFAULT nextval('public.fabricante_id_seq'::regclass);


--
-- TOC entry 4065 (class 2604 OID 34476)
-- Name: feriado id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feriado ALTER COLUMN id SET DEFAULT nextval('public.feriado_id_seq'::regclass);


--
-- TOC entry 4277 (class 2604 OID 40507)
-- Name: financeiro_alerta id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta ALTER COLUMN id SET DEFAULT nextval('public.financeiro_alerta_id_seq'::regclass);


--
-- TOC entry 4271 (class 2604 OID 40485)
-- Name: financeiro_alerta_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta_config ALTER COLUMN id SET DEFAULT nextval('public.financeiro_alerta_config_id_seq'::regclass);


--
-- TOC entry 4196 (class 2604 OID 40044)
-- Name: financeiro_alerta_status_tipo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta_status_tipo ALTER COLUMN id SET DEFAULT nextval('public.financeiro_alerta_status_tipo_id_seq'::regclass);


--
-- TOC entry 4195 (class 2604 OID 40035)
-- Name: financeiro_alerta_tipo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta_tipo ALTER COLUMN id SET DEFAULT nextval('public.financeiro_alerta_tipo_id_seq'::regclass);


--
-- TOC entry 4283 (class 2604 OID 40769)
-- Name: financeiro_assinatura_empresa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_assinatura_empresa ALTER COLUMN id SET DEFAULT nextval('public.financeiro_assinatura_empresa_id_seq'::regclass);


--
-- TOC entry 4197 (class 2604 OID 40062)
-- Name: financeiro_categoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_categoria ALTER COLUMN id SET DEFAULT nextval('public.financeiro_categoria_id_seq'::regclass);


--
-- TOC entry 4194 (class 2604 OID 40026)
-- Name: financeiro_categoria_tipo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_categoria_tipo ALTER COLUMN id SET DEFAULT nextval('public.financeiro_categoria_tipo_id_seq'::regclass);


--
-- TOC entry 4202 (class 2604 OID 40089)
-- Name: financeiro_centro_custo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_centro_custo ALTER COLUMN id SET DEFAULT nextval('public.financeiro_centro_custo_id_seq'::regclass);


--
-- TOC entry 4265 (class 2604 OID 40442)
-- Name: financeiro_comissao_lancamento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_comissao_lancamento ALTER COLUMN id SET DEFAULT nextval('public.financeiro_comissao_lancamento_id_seq'::regclass);


--
-- TOC entry 4206 (class 2604 OID 40109)
-- Name: financeiro_conta_financeira id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_financeira ALTER COLUMN id SET DEFAULT nextval('public.financeiro_conta_financeira_id_seq'::regclass);


--
-- TOC entry 4217 (class 2604 OID 40144)
-- Name: financeiro_conta_pagar id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_pagar ALTER COLUMN id SET DEFAULT nextval('public.financeiro_conta_pagar_id_seq'::regclass);


--
-- TOC entry 4235 (class 2604 OID 40246)
-- Name: financeiro_conta_receber id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber ALTER COLUMN id SET DEFAULT nextval('public.financeiro_conta_receber_id_seq'::regclass);


--
-- TOC entry 4212 (class 2604 OID 40127)
-- Name: financeiro_contraparte id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_contraparte ALTER COLUMN id SET DEFAULT nextval('public.financeiro_contraparte_id_seq'::regclass);


--
-- TOC entry 4253 (class 2604 OID 40358)
-- Name: financeiro_lancamento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamento ALTER COLUMN id SET DEFAULT nextval('public.financeiro_lancamento_id_seq'::regclass);


--
-- TOC entry 4260 (class 2604 OID 40416)
-- Name: financeiro_meta_usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_meta_usuario ALTER COLUMN id SET DEFAULT nextval('public.financeiro_meta_usuario_id_seq'::regclass);


--
-- TOC entry 4191 (class 2604 OID 39999)
-- Name: financeiro_natureza_lancamento_tipo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_natureza_lancamento_tipo ALTER COLUMN id SET DEFAULT nextval('public.financeiro_natureza_lancamento_tipo_id_seq'::regclass);


--
-- TOC entry 4192 (class 2604 OID 40008)
-- Name: financeiro_origem_lancamento_tipo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_origem_lancamento_tipo ALTER COLUMN id SET DEFAULT nextval('public.financeiro_origem_lancamento_tipo_id_seq'::regclass);


--
-- TOC entry 4230 (class 2604 OID 40210)
-- Name: financeiro_pagamento_pagar id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_pagamento_pagar ALTER COLUMN id SET DEFAULT nextval('public.financeiro_pagamento_pagar_id_seq'::regclass);


--
-- TOC entry 4248 (class 2604 OID 40322)
-- Name: financeiro_recebimento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_recebimento ALTER COLUMN id SET DEFAULT nextval('public.financeiro_recebimento_id_seq'::regclass);


--
-- TOC entry 4193 (class 2604 OID 40017)
-- Name: financeiro_recorrencia_tipo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_recorrencia_tipo ALTER COLUMN id SET DEFAULT nextval('public.financeiro_recorrencia_tipo_id_seq'::regclass);


--
-- TOC entry 4190 (class 2604 OID 39990)
-- Name: financeiro_status_lancamento_tipo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_status_lancamento_tipo ALTER COLUMN id SET DEFAULT nextval('public.financeiro_status_lancamento_tipo_id_seq'::regclass);


--
-- TOC entry 4189 (class 2604 OID 39981)
-- Name: financeiro_status_titulo_tipo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_status_titulo_tipo ALTER COLUMN id SET DEFAULT nextval('public.financeiro_status_titulo_tipo_id_seq'::regclass);


--
-- TOC entry 4041 (class 2604 OID 34366)
-- Name: horario_trabalho id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_trabalho ALTER COLUMN id SET DEFAULT nextval('public.horario_trabalho_id_seq'::regclass);


--
-- TOC entry 4049 (class 2604 OID 34382)
-- Name: horario_trabalho_dia id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_trabalho_dia ALTER COLUMN id SET DEFAULT nextval('public.horario_trabalho_dia_id_seq'::regclass);


--
-- TOC entry 4445 (class 2604 OID 117298)
-- Name: hotmart_evento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotmart_evento ALTER COLUMN id SET DEFAULT nextval('public.hotmart_evento_id_seq'::regclass);


--
-- TOC entry 4058 (class 2604 OID 34430)
-- Name: justificativa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativa ALTER COLUMN id SET DEFAULT nextval('public.justificativa_id_seq'::regclass);


--
-- TOC entry 4061 (class 2604 OID 34446)
-- Name: justificativa_anexo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativa_anexo ALTER COLUMN id SET DEFAULT nextval('public.justificativa_anexo_id_seq'::regclass);


--
-- TOC entry 4124 (class 2604 OID 35885)
-- Name: justificativa_tipo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativa_tipo ALTER COLUMN id SET DEFAULT nextval('public.justificativa_tipo_id_seq'::regclass);


--
-- TOC entry 4302 (class 2604 OID 43052)
-- Name: manual_artigo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_artigo ALTER COLUMN id SET DEFAULT nextval('public.manual_artigo_id_seq'::regclass);


--
-- TOC entry 3973 (class 2604 OID 26843)
-- Name: mensagens_rapidas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_rapidas ALTER COLUMN id SET DEFAULT nextval('public.mensagens_rapidas_id_seq'::regclass);


--
-- TOC entry 4173 (class 2604 OID 39666)
-- Name: nps_pergunta id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_pergunta ALTER COLUMN id SET DEFAULT nextval('public.nps_pergunta_id_seq'::regclass);


--
-- TOC entry 4178 (class 2604 OID 39686)
-- Name: nps_resposta id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_resposta ALTER COLUMN id SET DEFAULT nextval('public.nps_resposta_id_seq'::regclass);


--
-- TOC entry 3975 (class 2604 OID 26844)
-- Name: parametros id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametros ALTER COLUMN id SET DEFAULT nextval('public.parametros_id_seq'::regclass);


--
-- TOC entry 4035 (class 2604 OID 31062)
-- Name: pdv_version id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_version ALTER COLUMN id SET DEFAULT nextval('public.pdv_version_id_seq'::regclass);


--
-- TOC entry 4038 (class 2604 OID 31080)
-- Name: pdv_version_sistem id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_version_sistem ALTER COLUMN id SET DEFAULT nextval('public.pdv_version_sistem_id_seq'::regclass);


--
-- TOC entry 3976 (class 2604 OID 26845)
-- Name: perfil id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfil ALTER COLUMN id SET DEFAULT nextval('public.perfil_id_seq'::regclass);


--
-- TOC entry 4071 (class 2604 OID 34518)
-- Name: periodo_ferias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodo_ferias ALTER COLUMN id SET DEFAULT nextval('public.periodo_ferias_id_seq'::regclass);


--
-- TOC entry 3997 (class 2604 OID 26932)
-- Name: produto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto ALTER COLUMN id SET DEFAULT nextval('public.produto_id_seq'::regclass);


--
-- TOC entry 4007 (class 2604 OID 26951)
-- Name: produto_categoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_categoria ALTER COLUMN id SET DEFAULT nextval('public.produto_categoria_id_seq'::regclass);


--
-- TOC entry 4030 (class 2604 OID 28854)
-- Name: produto_entrada id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_entrada ALTER COLUMN id SET DEFAULT nextval('public.produto_entrada_id_seq'::regclass);


--
-- TOC entry 4010 (class 2604 OID 26968)
-- Name: produto_estoque id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_estoque ALTER COLUMN id SET DEFAULT nextval('public.produto_estoque_id_seq'::regclass);


--
-- TOC entry 4012 (class 2604 OID 26976)
-- Name: produto_estoque_movimentacao id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_estoque_movimentacao ALTER COLUMN id SET DEFAULT nextval('public.produto_estoque_movimentacao_id_seq'::regclass);


--
-- TOC entry 4016 (class 2604 OID 27319)
-- Name: produto_estoque_movimentacao_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_estoque_movimentacao_status ALTER COLUMN id SET DEFAULT nextval('public.produto_estoque_movimentacao_status_id_seq'::regclass);


--
-- TOC entry 4015 (class 2604 OID 26986)
-- Name: produto_estoque_movimentacao_tipo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_estoque_movimentacao_tipo ALTER COLUMN id SET DEFAULT nextval('public.produto_estoque_movimentacao_tipo_id_seq'::regclass);


--
-- TOC entry 4031 (class 2604 OID 30818)
-- Name: promocao_produto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promocao_produto ALTER COLUMN id SET DEFAULT nextval('public.promocao_produto_id_seq'::regclass);


--
-- TOC entry 4054 (class 2604 OID 34416)
-- Name: registro_ponto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_ponto ALTER COLUMN id SET DEFAULT nextval('public.registro_ponto_id_seq'::regclass);


--
-- TOC entry 3978 (class 2604 OID 26846)
-- Name: setor id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setor ALTER COLUMN id SET DEFAULT nextval('public.setor_id_seq'::regclass);


--
-- TOC entry 4455 (class 2604 OID 145628)
-- Name: sistema_novidade id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_novidade ALTER COLUMN id SET DEFAULT nextval('public.sistema_novidade_id_seq'::regclass);


--
-- TOC entry 4463 (class 2604 OID 145658)
-- Name: sistema_novidade_usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_novidade_usuario ALTER COLUMN id SET DEFAULT nextval('public.sistema_novidade_usuario_id_seq'::regclass);


--
-- TOC entry 4073 (class 2604 OID 34531)
-- Name: solicitacao_ferias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitacao_ferias ALTER COLUMN id SET DEFAULT nextval('public.solicitacao_ferias_id_seq'::regclass);


--
-- TOC entry 3979 (class 2604 OID 26847)
-- Name: tag id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag ALTER COLUMN id SET DEFAULT nextval('public.tag_id_seq'::regclass);


--
-- TOC entry 4039 (class 2604 OID 31420)
-- Name: tipo_acessos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipo_acessos ALTER COLUMN id SET DEFAULT nextval('public.tipo_acessos_id_seq'::regclass);


--
-- TOC entry 3980 (class 2604 OID 26848)
-- Name: usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id SET DEFAULT nextval('public.usuario_id_seq'::regclass);


--
-- TOC entry 4052 (class 2604 OID 34398)
-- Name: usuario_horario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_horario ALTER COLUMN id SET DEFAULT nextval('public.usuario_horario_id_seq'::regclass);


--
-- TOC entry 4313 (class 2604 OID 43247)
-- Name: usuario_meta_numero id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_meta_numero ALTER COLUMN id SET DEFAULT nextval('public.usuario_meta_numero_id_seq'::regclass);


--
-- TOC entry 3984 (class 2604 OID 26849)
-- Name: usuario_setor id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_setor ALTER COLUMN id SET DEFAULT nextval('public.usuario_setor_id_seq'::regclass);


--
-- TOC entry 4019 (class 2604 OID 27994)
-- Name: venda id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda ALTER COLUMN id SET DEFAULT nextval('public.venda_id_seq'::regclass);


--
-- TOC entry 4025 (class 2604 OID 28005)
-- Name: venda_produto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda_produto ALTER COLUMN id SET DEFAULT nextval('public.venda_produto_id_seq'::regclass);


--
-- TOC entry 4155 (class 2604 OID 37550)
-- Name: whatsapp_auto_message id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_auto_message ALTER COLUMN id SET DEFAULT nextval('public.whatsapp_auto_message_id_seq'::regclass);


--
-- TOC entry 4158 (class 2604 OID 37562)
-- Name: whatsapp_auto_message_tipo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_auto_message_tipo ALTER COLUMN id SET DEFAULT nextval('public.whatsapp_auto_message_tipo_id_seq'::regclass);


--
-- TOC entry 4386 (class 2604 OID 67808)
-- Name: whatsapp_template_aniversario_envio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_aniversario_envio ALTER COLUMN id SET DEFAULT nextval('public.whatsapp_template_aniversario_envio_id_seq'::regclass);


--
-- TOC entry 4374 (class 2604 OID 48252)
-- Name: whatsapp_template_disparo_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_disparo_item ALTER COLUMN id SET DEFAULT nextval('public.whatsapp_template_disparo_item_id_seq'::regclass);


--
-- TOC entry 4359 (class 2604 OID 48212)
-- Name: whatsapp_template_disparo_lote id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_disparo_lote ALTER COLUMN id SET DEFAULT nextval('public.whatsapp_template_disparo_lote_id_seq'::regclass);


--
-- TOC entry 4392 (class 2604 OID 68123)
-- Name: whatsapp_template_followup_venda_envio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_followup_venda_envio ALTER COLUMN id SET DEFAULT nextval('public.whatsapp_template_followup_venda_envio_id_seq'::regclass);


--
-- TOC entry 4771 (class 2606 OID 39953)
-- Name: addos addos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addos
    ADD CONSTRAINT addos_codigo_key UNIQUE (codigo);


--
-- TOC entry 4773 (class 2606 OID 39951)
-- Name: addos addos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addos
    ADD CONSTRAINT addos_pkey PRIMARY KEY (id);


--
-- TOC entry 4681 (class 2606 OID 34597)
-- Name: apuracao_ponto_diaria apuracao_ponto_diaria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apuracao_ponto_diaria
    ADD CONSTRAINT apuracao_ponto_diaria_pkey PRIMARY KEY (id);


--
-- TOC entry 4683 (class 2606 OID 34599)
-- Name: apuracao_ponto_diaria apuracao_ponto_diaria_usuario_id_data_referencia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apuracao_ponto_diaria
    ADD CONSTRAINT apuracao_ponto_diaria_usuario_id_data_referencia_key UNIQUE (usuario_id, data_referencia);


--
-- TOC entry 4531 (class 2606 OID 26851)
-- Name: empresa_assinatura assinatura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_assinatura
    ADD CONSTRAINT assinatura_pkey PRIMARY KEY (id);


--
-- TOC entry 4628 (class 2606 OID 28832)
-- Name: assinatura assinatura_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinatura
    ADD CONSTRAINT assinatura_pkey1 PRIMARY KEY (id);


--
-- TOC entry 4949 (class 2606 OID 63730)
-- Name: atendimento_fila_usuario atendimento_fila_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento_fila_usuario
    ADD CONSTRAINT atendimento_fila_usuario_pkey PRIMARY KEY (id);


--
-- TOC entry 4951 (class 2606 OID 63732)
-- Name: atendimento_fila_usuario atendimento_fila_usuario_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento_fila_usuario
    ADD CONSTRAINT atendimento_fila_usuario_uk UNIQUE (empresa_id, usuario_id);


--
-- TOC entry 4670 (class 2606 OID 34466)
-- Name: banco_horas_lancamento banco_horas_lancamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banco_horas_lancamento
    ADD CONSTRAINT banco_horas_lancamento_pkey PRIMARY KEY (id);


--
-- TOC entry 4641 (class 2606 OID 30937)
-- Name: caixa_abertura caixa_abertura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_abertura
    ADD CONSTRAINT caixa_abertura_pkey PRIMARY KEY (id);


--
-- TOC entry 4621 (class 2606 OID 27989)
-- Name: caixa caixa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa
    ADD CONSTRAINT caixa_pkey PRIMARY KEY (id);


--
-- TOC entry 4639 (class 2606 OID 30930)
-- Name: caixa_ruptura caixa_ruptura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_ruptura
    ADD CONSTRAINT caixa_ruptura_pkey PRIMARY KEY (id);


--
-- TOC entry 4603 (class 2606 OID 26946)
-- Name: categoria categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria
    ADD CONSTRAINT categoria_pkey PRIMARY KEY (id);


--
-- TOC entry 4545 (class 2606 OID 26853)
-- Name: cliente_anotacao cliente_anotacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_anotacao
    ADD CONSTRAINT cliente_anotacao_pkey PRIMARY KEY (id);


--
-- TOC entry 4560 (class 2606 OID 26855)
-- Name: cliente_conversa_whats_mensagem cliente_conversa_whats_mensagem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats_mensagem
    ADD CONSTRAINT cliente_conversa_whats_mensagem_pkey PRIMARY KEY (id);


--
-- TOC entry 4547 (class 2606 OID 26857)
-- Name: cliente_conversa_whats cliente_conversa_whats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats
    ADD CONSTRAINT cliente_conversa_whats_pkey PRIMARY KEY (id);


--
-- TOC entry 4765 (class 2606 OID 39782)
-- Name: cliente_conversa_whats_usuario_leitura cliente_conversa_whats_usuario_leitura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats_usuario_leitura
    ADD CONSTRAINT cliente_conversa_whats_usuario_leitura_pkey PRIMARY KEY (id);


--
-- TOC entry 4767 (class 2606 OID 39784)
-- Name: cliente_conversa_whats_usuario_leitura cliente_conversa_whats_usuario_leitura_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats_usuario_leitura
    ADD CONSTRAINT cliente_conversa_whats_usuario_leitura_uk UNIQUE (cliente_conversa_id, usuario_id);


--
-- TOC entry 4944 (class 2606 OID 59151)
-- Name: cliente_documento cliente_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_documento
    ADD CONSTRAINT cliente_documento_pkey PRIMARY KEY (id);


--
-- TOC entry 4882 (class 2606 OID 42830)
-- Name: cliente_lista_transmissao_contato cliente_lista_transmissao_con_lista_transmissao_id_cliente__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao_contato
    ADD CONSTRAINT cliente_lista_transmissao_con_lista_transmissao_id_cliente__key UNIQUE (lista_transmissao_id, cliente_id);


--
-- TOC entry 4884 (class 2606 OID 42828)
-- Name: cliente_lista_transmissao_contato cliente_lista_transmissao_contato_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao_contato
    ADD CONSTRAINT cliente_lista_transmissao_contato_pkey PRIMARY KEY (id);


--
-- TOC entry 4871 (class 2606 OID 42784)
-- Name: cliente_lista_transmissao cliente_lista_transmissao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao
    ADD CONSTRAINT cliente_lista_transmissao_pkey PRIMARY KEY (id);


--
-- TOC entry 4876 (class 2606 OID 42806)
-- Name: cliente_lista_transmissao_tag cliente_lista_transmissao_tag_lista_transmissao_id_tag_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao_tag
    ADD CONSTRAINT cliente_lista_transmissao_tag_lista_transmissao_id_tag_id_key UNIQUE (lista_transmissao_id, tag_id);


--
-- TOC entry 4878 (class 2606 OID 42804)
-- Name: cliente_lista_transmissao_tag cliente_lista_transmissao_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao_tag
    ADD CONSTRAINT cliente_lista_transmissao_tag_pkey PRIMARY KEY (id);


--
-- TOC entry 4907 (class 2606 OID 44856)
-- Name: cliente_meta_ads_lead cliente_meta_ads_lead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_meta_ads_lead
    ADD CONSTRAINT cliente_meta_ads_lead_pkey PRIMARY KEY (id);


--
-- TOC entry 4535 (class 2606 OID 26859)
-- Name: cliente cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_pkey PRIMARY KEY (id);


--
-- TOC entry 4572 (class 2606 OID 26861)
-- Name: cliente_tag cliente_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_tag
    ADD CONSTRAINT cliente_tag_pkey PRIMARY KEY (id);


--
-- TOC entry 4537 (class 2606 OID 37513)
-- Name: cliente cliente_unico; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_unico UNIQUE (telefone, empresa_id);


--
-- TOC entry 4685 (class 2606 OID 35574)
-- Name: comercial_crm comercial_crm_empresa_nome_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm
    ADD CONSTRAINT comercial_crm_empresa_nome_uk UNIQUE (empresa_id, nome);


--
-- TOC entry 4975 (class 2606 OID 76545)
-- Name: comercial_crm_meta_numero comercial_crm_meta_numero_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm_meta_numero
    ADD CONSTRAINT comercial_crm_meta_numero_pkey PRIMARY KEY (id);


--
-- TOC entry 4687 (class 2606 OID 35572)
-- Name: comercial_crm comercial_crm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm
    ADD CONSTRAINT comercial_crm_pkey PRIMARY KEY (id);


--
-- TOC entry 4865 (class 2606 OID 42737)
-- Name: comercial_crm_usuario comercial_crm_usuario_crm_id_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm_usuario
    ADD CONSTRAINT comercial_crm_usuario_crm_id_usuario_id_key UNIQUE (crm_id, usuario_id);


--
-- TOC entry 4867 (class 2606 OID 42735)
-- Name: comercial_crm_usuario comercial_crm_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm_usuario
    ADD CONSTRAINT comercial_crm_usuario_pkey PRIMARY KEY (id);


--
-- TOC entry 4972 (class 2606 OID 70134)
-- Name: comercial_disparo_agendado_item comercial_disparo_agendado_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado_item
    ADD CONSTRAINT comercial_disparo_agendado_item_pkey PRIMARY KEY (id);


--
-- TOC entry 4968 (class 2606 OID 70082)
-- Name: comercial_disparo_agendado comercial_disparo_agendado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado
    ADD CONSTRAINT comercial_disparo_agendado_pkey PRIMARY KEY (id);


--
-- TOC entry 4690 (class 2606 OID 35595)
-- Name: comercial_etapa comercial_etapa_crm_codigo_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_etapa
    ADD CONSTRAINT comercial_etapa_crm_codigo_uk UNIQUE (crm_id, codigo);


--
-- TOC entry 4692 (class 2606 OID 35597)
-- Name: comercial_etapa comercial_etapa_crm_nome_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_etapa
    ADD CONSTRAINT comercial_etapa_crm_nome_uk UNIQUE (crm_id, nome);


--
-- TOC entry 4694 (class 2606 OID 35599)
-- Name: comercial_etapa comercial_etapa_crm_ordem_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_etapa
    ADD CONSTRAINT comercial_etapa_crm_ordem_uk UNIQUE (crm_id, ordem);


--
-- TOC entry 4696 (class 2606 OID 35593)
-- Name: comercial_etapa comercial_etapa_id_crm_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_etapa
    ADD CONSTRAINT comercial_etapa_id_crm_uk UNIQUE (id, crm_id);


--
-- TOC entry 4698 (class 2606 OID 35591)
-- Name: comercial_etapa comercial_etapa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_etapa
    ADD CONSTRAINT comercial_etapa_pkey PRIMARY KEY (id);


--
-- TOC entry 4700 (class 2606 OID 35613)
-- Name: comercial_forma_pagamento comercial_forma_pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_forma_pagamento
    ADD CONSTRAINT comercial_forma_pagamento_pkey PRIMARY KEY (id);


--
-- TOC entry 4760 (class 2606 OID 39731)
-- Name: comercial_historico_cliente comercial_historico_cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_historico_cliente
    ADD CONSTRAINT comercial_historico_cliente_pkey PRIMARY KEY (id);


--
-- TOC entry 4724 (class 2606 OID 35801)
-- Name: comercial_interacao comercial_interacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_interacao
    ADD CONSTRAINT comercial_interacao_pkey PRIMARY KEY (id);


--
-- TOC entry 4702 (class 2606 OID 35626)
-- Name: comercial_motivo_perda comercial_motivo_perda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_motivo_perda
    ADD CONSTRAINT comercial_motivo_perda_pkey PRIMARY KEY (id);


--
-- TOC entry 4728 (class 2606 OID 35837)
-- Name: comercial_negocio_movimentacao comercial_negocio_movimentacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_movimentacao
    ADD CONSTRAINT comercial_negocio_movimentacao_pkey PRIMARY KEY (id);


--
-- TOC entry 4704 (class 2606 OID 35649)
-- Name: comercial_negocio comercial_negocio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio
    ADD CONSTRAINT comercial_negocio_pkey PRIMARY KEY (id);


--
-- TOC entry 4720 (class 2606 OID 35765)
-- Name: comercial_negocio_produto comercial_negocio_produto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_produto
    ADD CONSTRAINT comercial_negocio_produto_pkey PRIMARY KEY (id);


--
-- TOC entry 4715 (class 2606 OID 35704)
-- Name: comercial_negocio_tag comercial_negocio_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_tag
    ADD CONSTRAINT comercial_negocio_tag_pkey PRIMARY KEY (negocio_id, tag_id);


--
-- TOC entry 4919 (class 2606 OID 45004)
-- Name: comercial_orcamento_item comercial_orcamento_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_orcamento_item
    ADD CONSTRAINT comercial_orcamento_item_pkey PRIMARY KEY (id);


--
-- TOC entry 4914 (class 2606 OID 44989)
-- Name: comercial_orcamento comercial_orcamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_orcamento
    ADD CONSTRAINT comercial_orcamento_pkey PRIMARY KEY (id);


--
-- TOC entry 4905 (class 2606 OID 44828)
-- Name: comercial_produto_documento comercial_produto_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_produto_documento
    ADD CONSTRAINT comercial_produto_documento_pkey PRIMARY KEY (id);


--
-- TOC entry 4898 (class 2606 OID 44491)
-- Name: comercial_produto_imagem comercial_produto_imagem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_produto_imagem
    ADD CONSTRAINT comercial_produto_imagem_pkey PRIMARY KEY (id);


--
-- TOC entry 4718 (class 2606 OID 35748)
-- Name: comercial_produto comercial_produto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_produto
    ADD CONSTRAINT comercial_produto_pkey PRIMARY KEY (id);


--
-- TOC entry 4711 (class 2606 OID 35694)
-- Name: comercial_tag comercial_tag_empresa_nome_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_tag
    ADD CONSTRAINT comercial_tag_empresa_nome_uk UNIQUE (empresa_id, nome);


--
-- TOC entry 4713 (class 2606 OID 35692)
-- Name: comercial_tag comercial_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_tag
    ADD CONSTRAINT comercial_tag_pkey PRIMARY KEY (id);


--
-- TOC entry 4722 (class 2606 OID 35783)
-- Name: comercial_tipo_interacao comercial_tipo_interacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_tipo_interacao
    ADD CONSTRAINT comercial_tipo_interacao_pkey PRIMARY KEY (id);


--
-- TOC entry 4674 (class 2606 OID 34508)
-- Name: day_off day_off_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_off
    ADD CONSTRAINT day_off_pkey PRIMARY KEY (id);


--
-- TOC entry 4984 (class 2606 OID 80712)
-- Name: developer_webhook_history developer_webhook_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.developer_webhook_history
    ADD CONSTRAINT developer_webhook_history_pkey PRIMARY KEY (id);


--
-- TOC entry 4980 (class 2606 OID 80598)
-- Name: developer_webhook developer_webhook_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.developer_webhook
    ADD CONSTRAINT developer_webhook_pkey PRIMARY KEY (id);


--
-- TOC entry 4747 (class 2606 OID 39522)
-- Name: empresa_assinatura_pagamento empresa_assinatura_pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_assinatura_pagamento
    ADD CONSTRAINT empresa_assinatura_pagamento_pkey PRIMARY KEY (id);


--
-- TOC entry 4576 (class 2606 OID 39580)
-- Name: empresa empresa_cliente_webhook_codigo_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_cliente_webhook_codigo_uk UNIQUE (cliente_webhook_codigo);


--
-- TOC entry 4578 (class 2606 OID 39659)
-- Name: empresa empresa_cliente_webhook_public_id_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_cliente_webhook_public_id_uk UNIQUE (cliente_webhook_public_id);


--
-- TOC entry 4599 (class 2606 OID 26927)
-- Name: empresa_filial empresa_filial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_filial
    ADD CONSTRAINT empresa_filial_pkey PRIMARY KEY (id);


--
-- TOC entry 4903 (class 2606 OID 44816)
-- Name: empresa_galeria_documento empresa_galeria_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_galeria_documento
    ADD CONSTRAINT empresa_galeria_documento_pkey PRIMARY KEY (id);


--
-- TOC entry 4901 (class 2606 OID 44769)
-- Name: empresa_galeria_imagem empresa_galeria_imagem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_galeria_imagem
    ADD CONSTRAINT empresa_galeria_imagem_pkey PRIMARY KEY (id);


--
-- TOC entry 4927 (class 2606 OID 45663)
-- Name: empresa_google_ads_accounts empresa_google_ads_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_google_ads_accounts
    ADD CONSTRAINT empresa_google_ads_accounts_pkey PRIMARY KEY (id);


--
-- TOC entry 4994 (class 2606 OID 117286)
-- Name: empresa_hotmart_integracao empresa_hotmart_integracao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_hotmart_integracao
    ADD CONSTRAINT empresa_hotmart_integracao_pkey PRIMARY KEY (id);


--
-- TOC entry 5003 (class 2606 OID 117337)
-- Name: empresa_hotmart_produto_map empresa_hotmart_produto_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_hotmart_produto_map
    ADD CONSTRAINT empresa_hotmart_produto_map_pkey PRIMARY KEY (id);


--
-- TOC entry 4740 (class 2606 OID 37723)
-- Name: empresa_meta_ads_accounts empresa_meta_ads_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_meta_ads_accounts
    ADD CONSTRAINT empresa_meta_ads_accounts_pkey PRIMARY KEY (id);


--
-- TOC entry 4911 (class 2606 OID 44883)
-- Name: empresa_meta_ads_field_mapping empresa_meta_ads_field_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_meta_ads_field_mapping
    ADD CONSTRAINT empresa_meta_ads_field_mapping_pkey PRIMARY KEY (id);


--
-- TOC entry 4743 (class 2606 OID 39342)
-- Name: empresa_meta_instagram_accounts empresa_meta_instagram_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_meta_instagram_accounts
    ADD CONSTRAINT empresa_meta_instagram_accounts_pkey PRIMARY KEY (id);


--
-- TOC entry 4480 (class 2606 OID 68117)
-- Name: empresa_meta_parans empresa_meta_parans_followup_venda_realizada_delay_chk; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.empresa_meta_parans
    ADD CONSTRAINT empresa_meta_parans_followup_venda_realizada_delay_chk CHECK ((whatsapp_followup_venda_realizada_template_delay_days >= 0)) NOT VALID;


--
-- TOC entry 4481 (class 2606 OID 68118)
-- Name: empresa_meta_parans empresa_meta_parans_followup_venda_recusada_delay_chk; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.empresa_meta_parans
    ADD CONSTRAINT empresa_meta_parans_followup_venda_recusada_delay_chk CHECK ((whatsapp_followup_venda_recusada_template_delay_days >= 0)) NOT VALID;


--
-- TOC entry 4733 (class 2606 OID 36075)
-- Name: empresa_meta_parans empresa_meta_parans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_meta_parans
    ADD CONSTRAINT empresa_meta_parans_pkey PRIMARY KEY (id);


--
-- TOC entry 4580 (class 2606 OID 26865)
-- Name: empresa empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_pkey PRIMARY KEY (id);


--
-- TOC entry 4923 (class 2606 OID 45636)
-- Name: empresa_tiktok_accounts empresa_tiktok_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_tiktok_accounts
    ADD CONSTRAINT empresa_tiktok_accounts_pkey PRIMARY KEY (id);


--
-- TOC entry 4633 (class 2606 OID 28849)
-- Name: entrada entrada_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrada
    ADD CONSTRAINT entrada_pkey PRIMARY KEY (id);


--
-- TOC entry 4649 (class 2606 OID 31501)
-- Name: equipe equipe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipe
    ADD CONSTRAINT equipe_pkey PRIMARY KEY (id);


--
-- TOC entry 4609 (class 2606 OID 26963)
-- Name: fabricante fabricante_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fabricante
    ADD CONSTRAINT fabricante_pkey PRIMARY KEY (id);


--
-- TOC entry 4672 (class 2606 OID 34480)
-- Name: feriado feriado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feriado
    ADD CONSTRAINT feriado_pkey PRIMARY KEY (id);


--
-- TOC entry 4854 (class 2606 OID 40497)
-- Name: financeiro_alerta_config financeiro_alerta_config_empresa_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta_config
    ADD CONSTRAINT financeiro_alerta_config_empresa_id_key UNIQUE (empresa_id);


--
-- TOC entry 4856 (class 2606 OID 40495)
-- Name: financeiro_alerta_config financeiro_alerta_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta_config
    ADD CONSTRAINT financeiro_alerta_config_pkey PRIMARY KEY (id);


--
-- TOC entry 4858 (class 2606 OID 40516)
-- Name: financeiro_alerta financeiro_alerta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta
    ADD CONSTRAINT financeiro_alerta_pkey PRIMARY KEY (id);


--
-- TOC entry 4803 (class 2606 OID 40048)
-- Name: financeiro_alerta_status_tipo financeiro_alerta_status_tipo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta_status_tipo
    ADD CONSTRAINT financeiro_alerta_status_tipo_codigo_key UNIQUE (codigo);


--
-- TOC entry 4805 (class 2606 OID 40046)
-- Name: financeiro_alerta_status_tipo financeiro_alerta_status_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta_status_tipo
    ADD CONSTRAINT financeiro_alerta_status_tipo_pkey PRIMARY KEY (id);


--
-- TOC entry 4799 (class 2606 OID 40039)
-- Name: financeiro_alerta_tipo financeiro_alerta_tipo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta_tipo
    ADD CONSTRAINT financeiro_alerta_tipo_codigo_key UNIQUE (codigo);


--
-- TOC entry 4801 (class 2606 OID 40037)
-- Name: financeiro_alerta_tipo financeiro_alerta_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta_tipo
    ADD CONSTRAINT financeiro_alerta_tipo_pkey PRIMARY KEY (id);


--
-- TOC entry 4861 (class 2606 OID 40780)
-- Name: financeiro_assinatura_empresa financeiro_assinatura_empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_assinatura_empresa
    ADD CONSTRAINT financeiro_assinatura_empresa_pkey PRIMARY KEY (id);


--
-- TOC entry 4807 (class 2606 OID 40068)
-- Name: financeiro_categoria financeiro_categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_categoria
    ADD CONSTRAINT financeiro_categoria_pkey PRIMARY KEY (id);


--
-- TOC entry 4795 (class 2606 OID 40030)
-- Name: financeiro_categoria_tipo financeiro_categoria_tipo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_categoria_tipo
    ADD CONSTRAINT financeiro_categoria_tipo_codigo_key UNIQUE (codigo);


--
-- TOC entry 4797 (class 2606 OID 40028)
-- Name: financeiro_categoria_tipo financeiro_categoria_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_categoria_tipo
    ADD CONSTRAINT financeiro_categoria_tipo_pkey PRIMARY KEY (id);


--
-- TOC entry 4810 (class 2606 OID 40096)
-- Name: financeiro_centro_custo financeiro_centro_custo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_centro_custo
    ADD CONSTRAINT financeiro_centro_custo_pkey PRIMARY KEY (id);


--
-- TOC entry 4851 (class 2606 OID 40454)
-- Name: financeiro_comissao_lancamento financeiro_comissao_lancamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_comissao_lancamento
    ADD CONSTRAINT financeiro_comissao_lancamento_pkey PRIMARY KEY (id);


--
-- TOC entry 4814 (class 2606 OID 40116)
-- Name: financeiro_conta_financeira financeiro_conta_financeira_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_financeira
    ADD CONSTRAINT financeiro_conta_financeira_pkey PRIMARY KEY (id);


--
-- TOC entry 4820 (class 2606 OID 40162)
-- Name: financeiro_conta_pagar financeiro_conta_pagar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_pagar
    ADD CONSTRAINT financeiro_conta_pagar_pkey PRIMARY KEY (id);


--
-- TOC entry 4831 (class 2606 OID 40264)
-- Name: financeiro_conta_receber financeiro_conta_receber_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber
    ADD CONSTRAINT financeiro_conta_receber_pkey PRIMARY KEY (id);


--
-- TOC entry 4817 (class 2606 OID 40133)
-- Name: financeiro_contraparte financeiro_contraparte_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_contraparte
    ADD CONSTRAINT financeiro_contraparte_pkey PRIMARY KEY (id);


--
-- TOC entry 4842 (class 2606 OID 40368)
-- Name: financeiro_lancamento financeiro_lancamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamento
    ADD CONSTRAINT financeiro_lancamento_pkey PRIMARY KEY (id);


--
-- TOC entry 4847 (class 2606 OID 40427)
-- Name: financeiro_meta_usuario financeiro_meta_usuario_empresa_id_usuario_id_mes_referenci_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_meta_usuario
    ADD CONSTRAINT financeiro_meta_usuario_empresa_id_usuario_id_mes_referenci_key UNIQUE (empresa_id, usuario_id, mes_referencia);


--
-- TOC entry 4849 (class 2606 OID 40425)
-- Name: financeiro_meta_usuario financeiro_meta_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_meta_usuario
    ADD CONSTRAINT financeiro_meta_usuario_pkey PRIMARY KEY (id);


--
-- TOC entry 4783 (class 2606 OID 40003)
-- Name: financeiro_natureza_lancamento_tipo financeiro_natureza_lancamento_tipo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_natureza_lancamento_tipo
    ADD CONSTRAINT financeiro_natureza_lancamento_tipo_codigo_key UNIQUE (codigo);


--
-- TOC entry 4785 (class 2606 OID 40001)
-- Name: financeiro_natureza_lancamento_tipo financeiro_natureza_lancamento_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_natureza_lancamento_tipo
    ADD CONSTRAINT financeiro_natureza_lancamento_tipo_pkey PRIMARY KEY (id);


--
-- TOC entry 4787 (class 2606 OID 40012)
-- Name: financeiro_origem_lancamento_tipo financeiro_origem_lancamento_tipo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_origem_lancamento_tipo
    ADD CONSTRAINT financeiro_origem_lancamento_tipo_codigo_key UNIQUE (codigo);


--
-- TOC entry 4789 (class 2606 OID 40010)
-- Name: financeiro_origem_lancamento_tipo financeiro_origem_lancamento_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_origem_lancamento_tipo
    ADD CONSTRAINT financeiro_origem_lancamento_tipo_pkey PRIMARY KEY (id);


--
-- TOC entry 4827 (class 2606 OID 40219)
-- Name: financeiro_pagamento_pagar financeiro_pagamento_pagar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_pagamento_pagar
    ADD CONSTRAINT financeiro_pagamento_pagar_pkey PRIMARY KEY (id);


--
-- TOC entry 4838 (class 2606 OID 40331)
-- Name: financeiro_recebimento financeiro_recebimento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_recebimento
    ADD CONSTRAINT financeiro_recebimento_pkey PRIMARY KEY (id);


--
-- TOC entry 4791 (class 2606 OID 40021)
-- Name: financeiro_recorrencia_tipo financeiro_recorrencia_tipo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_recorrencia_tipo
    ADD CONSTRAINT financeiro_recorrencia_tipo_codigo_key UNIQUE (codigo);


--
-- TOC entry 4793 (class 2606 OID 40019)
-- Name: financeiro_recorrencia_tipo financeiro_recorrencia_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_recorrencia_tipo
    ADD CONSTRAINT financeiro_recorrencia_tipo_pkey PRIMARY KEY (id);


--
-- TOC entry 4779 (class 2606 OID 39994)
-- Name: financeiro_status_lancamento_tipo financeiro_status_lancamento_tipo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_status_lancamento_tipo
    ADD CONSTRAINT financeiro_status_lancamento_tipo_codigo_key UNIQUE (codigo);


--
-- TOC entry 4781 (class 2606 OID 39992)
-- Name: financeiro_status_lancamento_tipo financeiro_status_lancamento_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_status_lancamento_tipo
    ADD CONSTRAINT financeiro_status_lancamento_tipo_pkey PRIMARY KEY (id);


--
-- TOC entry 4775 (class 2606 OID 39985)
-- Name: financeiro_status_titulo_tipo financeiro_status_titulo_tipo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_status_titulo_tipo
    ADD CONSTRAINT financeiro_status_titulo_tipo_codigo_key UNIQUE (codigo);


--
-- TOC entry 4777 (class 2606 OID 39983)
-- Name: financeiro_status_titulo_tipo financeiro_status_titulo_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_status_titulo_tipo
    ADD CONSTRAINT financeiro_status_titulo_tipo_pkey PRIMARY KEY (id);


--
-- TOC entry 4653 (class 2606 OID 34388)
-- Name: horario_trabalho_dia horario_trabalho_dia_horario_trabalho_id_dia_semana_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_trabalho_dia
    ADD CONSTRAINT horario_trabalho_dia_horario_trabalho_id_dia_semana_key UNIQUE (horario_trabalho_id, dia_semana);


--
-- TOC entry 4655 (class 2606 OID 34386)
-- Name: horario_trabalho_dia horario_trabalho_dia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_trabalho_dia
    ADD CONSTRAINT horario_trabalho_dia_pkey PRIMARY KEY (id);


--
-- TOC entry 4651 (class 2606 OID 34377)
-- Name: horario_trabalho horario_trabalho_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_trabalho
    ADD CONSTRAINT horario_trabalho_pkey PRIMARY KEY (id);


--
-- TOC entry 4998 (class 2606 OID 117307)
-- Name: hotmart_evento hotmart_evento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotmart_evento
    ADD CONSTRAINT hotmart_evento_pkey PRIMARY KEY (id);


--
-- TOC entry 4668 (class 2606 OID 34451)
-- Name: justificativa_anexo justificativa_anexo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativa_anexo
    ADD CONSTRAINT justificativa_anexo_pkey PRIMARY KEY (id);


--
-- TOC entry 4666 (class 2606 OID 34436)
-- Name: justificativa justificativa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativa
    ADD CONSTRAINT justificativa_pkey PRIMARY KEY (id);


--
-- TOC entry 4731 (class 2606 OID 35890)
-- Name: justificativa_tipo justificativa_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativa_tipo
    ADD CONSTRAINT justificativa_tipo_pkey PRIMARY KEY (id);


--
-- TOC entry 4890 (class 2606 OID 43066)
-- Name: manual_artigo manual_artigo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_artigo
    ADD CONSTRAINT manual_artigo_pkey PRIMARY KEY (id);


--
-- TOC entry 4570 (class 2606 OID 26867)
-- Name: cliente_conversa_whats_mensagem mensagem_unica; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats_mensagem
    ADD CONSTRAINT mensagem_unica UNIQUE (mensagem_whats_id);


--
-- TOC entry 4582 (class 2606 OID 26869)
-- Name: mensagens_rapidas mensagens_rapidas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_rapidas
    ADD CONSTRAINT mensagens_rapidas_pkey PRIMARY KEY (id);


--
-- TOC entry 4753 (class 2606 OID 39675)
-- Name: nps_pergunta nps_pergunta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_pergunta
    ADD CONSTRAINT nps_pergunta_pkey PRIMARY KEY (id);


--
-- TOC entry 4756 (class 2606 OID 39694)
-- Name: nps_resposta nps_resposta_atendimento_pergunta_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_resposta
    ADD CONSTRAINT nps_resposta_atendimento_pergunta_uk UNIQUE (atendimento_id, pergunta_id);


--
-- TOC entry 4758 (class 2606 OID 39692)
-- Name: nps_resposta nps_resposta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_resposta
    ADD CONSTRAINT nps_resposta_pkey PRIMARY KEY (id);


--
-- TOC entry 4585 (class 2606 OID 26871)
-- Name: parametros parametros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametros
    ADD CONSTRAINT parametros_pkey PRIMARY KEY (id);


--
-- TOC entry 4643 (class 2606 OID 31068)
-- Name: pdv_version pdv_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_version
    ADD CONSTRAINT pdv_version_pkey PRIMARY KEY (id);


--
-- TOC entry 4645 (class 2606 OID 31084)
-- Name: pdv_version_sistem pdv_version_sistem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_version_sistem
    ADD CONSTRAINT pdv_version_sistem_pkey PRIMARY KEY (id);


--
-- TOC entry 4587 (class 2606 OID 26873)
-- Name: perfil perfil_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfil
    ADD CONSTRAINT perfil_pkey PRIMARY KEY (id);


--
-- TOC entry 4677 (class 2606 OID 34521)
-- Name: periodo_ferias periodo_ferias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodo_ferias
    ADD CONSTRAINT periodo_ferias_pkey PRIMARY KEY (id);


--
-- TOC entry 4605 (class 2606 OID 26953)
-- Name: produto_categoria produto_categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_categoria
    ADD CONSTRAINT produto_categoria_pkey PRIMARY KEY (id);


--
-- TOC entry 4635 (class 2606 OID 28856)
-- Name: produto_entrada produto_entrada_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_entrada
    ADD CONSTRAINT produto_entrada_pkey PRIMARY KEY (id);


--
-- TOC entry 4615 (class 2606 OID 26981)
-- Name: produto_estoque_movimentacao produto_estoque_movimentacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_estoque_movimentacao
    ADD CONSTRAINT produto_estoque_movimentacao_pkey PRIMARY KEY (id);


--
-- TOC entry 4619 (class 2606 OID 27323)
-- Name: produto_estoque_movimentacao_status produto_estoque_movimentacao_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_estoque_movimentacao_status
    ADD CONSTRAINT produto_estoque_movimentacao_status_pkey PRIMARY KEY (id);


--
-- TOC entry 4617 (class 2606 OID 26990)
-- Name: produto_estoque_movimentacao_tipo produto_estoque_movimentacao_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_estoque_movimentacao_tipo
    ADD CONSTRAINT produto_estoque_movimentacao_tipo_pkey PRIMARY KEY (id);


--
-- TOC entry 4611 (class 2606 OID 26971)
-- Name: produto_estoque produto_estoque_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_estoque
    ADD CONSTRAINT produto_estoque_pkey PRIMARY KEY (id);


--
-- TOC entry 4613 (class 2606 OID 28869)
-- Name: produto_estoque produto_estoque_prod_filial_empresa_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_estoque
    ADD CONSTRAINT produto_estoque_prod_filial_empresa_unique UNIQUE (produto_id, filial_id, empresa_id);


--
-- TOC entry 4601 (class 2606 OID 26936)
-- Name: produto produto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto
    ADD CONSTRAINT produto_pkey PRIMARY KEY (id);


--
-- TOC entry 4637 (class 2606 OID 30821)
-- Name: promocao_produto promocao_produto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promocao_produto
    ADD CONSTRAINT promocao_produto_pkey PRIMARY KEY (id);


--
-- TOC entry 4990 (class 2606 OID 87722)
-- Name: push_token push_token_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_token
    ADD CONSTRAINT push_token_pkey PRIMARY KEY (id);


--
-- TOC entry 4992 (class 2606 OID 87724)
-- Name: push_token push_token_usuario_id_expo_push_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_token
    ADD CONSTRAINT push_token_usuario_id_expo_push_token_key UNIQUE (usuario_id, expo_push_token);


--
-- TOC entry 4664 (class 2606 OID 34420)
-- Name: registro_ponto registro_ponto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_ponto
    ADD CONSTRAINT registro_ponto_pkey PRIMARY KEY (id);


--
-- TOC entry 4589 (class 2606 OID 26875)
-- Name: setor setor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setor
    ADD CONSTRAINT setor_pkey PRIMARY KEY (id);


--
-- TOC entry 5008 (class 2606 OID 145638)
-- Name: sistema_novidade sistema_novidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_novidade
    ADD CONSTRAINT sistema_novidade_pkey PRIMARY KEY (id);


--
-- TOC entry 5012 (class 2606 OID 145662)
-- Name: sistema_novidade_usuario sistema_novidade_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_novidade_usuario
    ADD CONSTRAINT sistema_novidade_usuario_pkey PRIMARY KEY (id);


--
-- TOC entry 5014 (class 2606 OID 145664)
-- Name: sistema_novidade_usuario sistema_novidade_usuario_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_novidade_usuario
    ADD CONSTRAINT sistema_novidade_usuario_unique UNIQUE (novidade_id, usuario_id);


--
-- TOC entry 4679 (class 2606 OID 34537)
-- Name: solicitacao_ferias solicitacao_ferias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitacao_ferias
    ADD CONSTRAINT solicitacao_ferias_pkey PRIMARY KEY (id);


--
-- TOC entry 4591 (class 2606 OID 26877)
-- Name: tag tag_nome_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_nome_unique UNIQUE (nome);


--
-- TOC entry 4593 (class 2606 OID 26879)
-- Name: tag tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);


--
-- TOC entry 4647 (class 2606 OID 31424)
-- Name: tipo_acessos tipo_acessos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipo_acessos
    ADD CONSTRAINT tipo_acessos_pkey PRIMARY KEY (id);


--
-- TOC entry 4574 (class 2606 OID 26881)
-- Name: cliente_tag unique_cliente_id_tag; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_tag
    ADD CONSTRAINT unique_cliente_id_tag UNIQUE (cliente_id, tag_id);


--
-- TOC entry 4607 (class 2606 OID 27336)
-- Name: produto_categoria uq_produto_categoria; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_categoria
    ADD CONSTRAINT uq_produto_categoria UNIQUE (produto_id, categoria_id);


--
-- TOC entry 4657 (class 2606 OID 34401)
-- Name: usuario_horario usuario_horario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_horario
    ADD CONSTRAINT usuario_horario_pkey PRIMARY KEY (id);


--
-- TOC entry 4894 (class 2606 OID 43250)
-- Name: usuario_meta_numero usuario_meta_numero_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_meta_numero
    ADD CONSTRAINT usuario_meta_numero_pkey PRIMARY KEY (id);


--
-- TOC entry 4896 (class 2606 OID 43252)
-- Name: usuario_meta_numero usuario_meta_numero_usuario_id_empresa_meta_param_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_meta_numero
    ADD CONSTRAINT usuario_meta_numero_usuario_id_empresa_meta_param_id_key UNIQUE (usuario_id, empresa_meta_param_id);


--
-- TOC entry 4595 (class 2606 OID 26883)
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id);


--
-- TOC entry 4597 (class 2606 OID 26885)
-- Name: usuario_setor usuario_setor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_setor
    ADD CONSTRAINT usuario_setor_pkey PRIMARY KEY (id);


--
-- TOC entry 4624 (class 2606 OID 27999)
-- Name: venda venda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda
    ADD CONSTRAINT venda_pkey PRIMARY KEY (id);


--
-- TOC entry 4626 (class 2606 OID 28007)
-- Name: venda_produto venda_produto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venda_produto
    ADD CONSTRAINT venda_produto_pkey PRIMARY KEY (id);


--
-- TOC entry 4736 (class 2606 OID 37556)
-- Name: whatsapp_auto_message whatsapp_auto_message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_auto_message
    ADD CONSTRAINT whatsapp_auto_message_pkey PRIMARY KEY (id);


--
-- TOC entry 4738 (class 2606 OID 37566)
-- Name: whatsapp_auto_message_tipo whatsapp_auto_message_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_auto_message_tipo
    ADD CONSTRAINT whatsapp_auto_message_tipo_pkey PRIMARY KEY (id);


--
-- TOC entry 4956 (class 2606 OID 67817)
-- Name: whatsapp_template_aniversario_envio whatsapp_template_aniversario_envio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_aniversario_envio
    ADD CONSTRAINT whatsapp_template_aniversario_envio_pkey PRIMARY KEY (id);


--
-- TOC entry 4958 (class 2606 OID 67819)
-- Name: whatsapp_template_aniversario_envio whatsapp_template_aniversario_envio_unq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_aniversario_envio
    ADD CONSTRAINT whatsapp_template_aniversario_envio_unq UNIQUE (empresa_meta_param_id, cliente_id, referencia_data);


--
-- TOC entry 4942 (class 2606 OID 48261)
-- Name: whatsapp_template_disparo_item whatsapp_template_disparo_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_disparo_item
    ADD CONSTRAINT whatsapp_template_disparo_item_pkey PRIMARY KEY (id);


--
-- TOC entry 4932 (class 2606 OID 48230)
-- Name: whatsapp_template_disparo_lote whatsapp_template_disparo_lote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_disparo_lote
    ADD CONSTRAINT whatsapp_template_disparo_lote_pkey PRIMARY KEY (id);


--
-- TOC entry 4963 (class 2606 OID 68133)
-- Name: whatsapp_template_followup_venda_envio whatsapp_template_followup_venda_envio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_followup_venda_envio
    ADD CONSTRAINT whatsapp_template_followup_venda_envio_pkey PRIMARY KEY (id);


--
-- TOC entry 4964 (class 1259 OID 70119)
-- Name: comercial_disparo_agendado_claim_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comercial_disparo_agendado_claim_idx ON public.comercial_disparo_agendado USING btree (status, scheduled_date, scheduled_hour, id);


--
-- TOC entry 4965 (class 1259 OID 70118)
-- Name: comercial_disparo_agendado_empresa_slot_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX comercial_disparo_agendado_empresa_slot_unique_idx ON public.comercial_disparo_agendado USING btree (empresa_id, scheduled_date, scheduled_hour) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying])::text[]));


--
-- TOC entry 4969 (class 1259 OID 70161)
-- Name: comercial_disparo_agendado_item_claim_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comercial_disparo_agendado_item_claim_idx ON public.comercial_disparo_agendado_item USING btree (agendamento_id, status, id);


--
-- TOC entry 4970 (class 1259 OID 70162)
-- Name: comercial_disparo_agendado_item_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comercial_disparo_agendado_item_cliente_idx ON public.comercial_disparo_agendado_item USING btree (empresa_id, cliente_id);


--
-- TOC entry 4973 (class 1259 OID 70160)
-- Name: comercial_disparo_agendado_item_unique_dest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX comercial_disparo_agendado_item_unique_dest_idx ON public.comercial_disparo_agendado_item USING btree (agendamento_id, numero_normalizado);


--
-- TOC entry 4966 (class 1259 OID 70120)
-- Name: comercial_disparo_agendado_meta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comercial_disparo_agendado_meta_idx ON public.comercial_disparo_agendado USING btree (empresa_meta_param_id, status, scheduled_date, scheduled_hour);


--
-- TOC entry 4629 (class 1259 OID 39502)
-- Name: idx_assinatura_stripe_price_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinatura_stripe_price_id ON public.assinatura USING btree (stripe_price_id);


--
-- TOC entry 4630 (class 1259 OID 39526)
-- Name: idx_assinatura_stripe_price_id_monthly; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinatura_stripe_price_id_monthly ON public.assinatura USING btree (stripe_price_id_monthly);


--
-- TOC entry 4631 (class 1259 OID 39527)
-- Name: idx_assinatura_stripe_price_id_yearly; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinatura_stripe_price_id_yearly ON public.assinatura USING btree (stripe_price_id_yearly);


--
-- TOC entry 4952 (class 1259 OID 63743)
-- Name: idx_atendimento_fila_usuario_empresa_ordem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimento_fila_usuario_empresa_ordem ON public.atendimento_fila_usuario USING btree (empresa_id, ordem, id);


--
-- TOC entry 4953 (class 1259 OID 63744)
-- Name: idx_atendimento_fila_usuario_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimento_fila_usuario_usuario ON public.atendimento_fila_usuario USING btree (usuario_id);


--
-- TOC entry 4561 (class 1259 OID 142967)
-- Name: idx_ccm_conversa_data_id_visible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccm_conversa_data_id_visible ON public.cliente_conversa_whats_mensagem USING btree (cliente_conversa_id, data_mensagem, id) WHERE (COALESCE(apagada, false) = false);


--
-- TOC entry 4562 (class 1259 OID 142968)
-- Name: idx_ccm_conversa_id_desc_visible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccm_conversa_id_desc_visible ON public.cliente_conversa_whats_mensagem USING btree (cliente_conversa_id, id DESC) WHERE (COALESCE(apagada, false) = false);


--
-- TOC entry 4563 (class 1259 OID 142969)
-- Name: idx_ccm_conversa_sendby_data_id_visible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccm_conversa_sendby_data_id_visible ON public.cliente_conversa_whats_mensagem USING btree (cliente_conversa_id, send_by, data_mensagem, id) WHERE (COALESCE(apagada, false) = false);


--
-- TOC entry 4564 (class 1259 OID 143141)
-- Name: idx_ccm_mensagem_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccm_mensagem_trgm ON public.cliente_conversa_whats_mensagem USING gin (lower(COALESCE(mensagem, ''::text)) public.gin_trgm_ops);


--
-- TOC entry 4565 (class 1259 OID 142970)
-- Name: idx_ccm_mensagem_whats_id_conversa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccm_mensagem_whats_id_conversa ON public.cliente_conversa_whats_mensagem USING btree (mensagem_whats_id, cliente_conversa_id) WHERE (mensagem_whats_id IS NOT NULL);


--
-- TOC entry 4548 (class 1259 OID 142965)
-- Name: idx_ccw_empresa_cliente_meta_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccw_empresa_cliente_meta_numero ON public.cliente_conversa_whats USING btree (empresa_id, cliente_id, empresa_meta_param_id, id);


--
-- TOC entry 4549 (class 1259 OID 142966)
-- Name: idx_ccw_empresa_cliente_number_phone_sem_meta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccw_empresa_cliente_number_phone_sem_meta ON public.cliente_conversa_whats USING btree (empresa_id, cliente_id, number_phone_id, id) WHERE (empresa_meta_param_id IS NULL);


--
-- TOC entry 4550 (class 1259 OID 64174)
-- Name: idx_ccw_empresa_cliente_status_ultima; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccw_empresa_cliente_status_ultima ON public.cliente_conversa_whats USING btree (empresa_id, cliente_id, status_id, ultima_atualizacao DESC);


--
-- TOC entry 4551 (class 1259 OID 142964)
-- Name: idx_ccw_empresa_finalizadas_data_fim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccw_empresa_finalizadas_data_fim ON public.cliente_conversa_whats USING btree (empresa_id, data_fim DESC, id DESC) WHERE ((status_id = 2) AND (data_fim IS NOT NULL));


--
-- TOC entry 4552 (class 1259 OID 64173)
-- Name: idx_ccw_empresa_status_atribuido_ultima; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccw_empresa_status_atribuido_ultima ON public.cliente_conversa_whats USING btree (empresa_id, status_id, usuario_atribuido_id, ultima_atualizacao DESC) WHERE (data_fim IS NULL);


--
-- TOC entry 4553 (class 1259 OID 64172)
-- Name: idx_ccw_empresa_status_usuario_ultima; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccw_empresa_status_usuario_ultima ON public.cliente_conversa_whats USING btree (empresa_id, status_id, usuario_id, ultima_atualizacao DESC) WHERE (data_fim IS NULL);


--
-- TOC entry 4554 (class 1259 OID 142961)
-- Name: idx_ccw_empresa_usuario_abertas_update; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccw_empresa_usuario_abertas_update ON public.cliente_conversa_whats USING btree (empresa_id, usuario_id, status_id, ultima_atualizacao DESC, id DESC) WHERE ((data_fim IS NULL) AND (status_id = ANY (ARRAY[0, 1])) AND (usuario_id IS NOT NULL));


--
-- TOC entry 4555 (class 1259 OID 142963)
-- Name: idx_ccw_empresa_usuario_atribuido_abertas_update; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccw_empresa_usuario_atribuido_abertas_update ON public.cliente_conversa_whats USING btree (empresa_id, usuario_atribuido_id, status_id, ultima_atualizacao DESC, id DESC) WHERE ((data_fim IS NULL) AND (status_id = ANY (ARRAY[0, 1])) AND (usuario_atribuido_id IS NOT NULL));


--
-- TOC entry 4556 (class 1259 OID 142960)
-- Name: idx_ccw_empresa_waiting_numero_update; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccw_empresa_waiting_numero_update ON public.cliente_conversa_whats USING btree (empresa_id, empresa_meta_param_id, ultima_atualizacao DESC, id DESC) WHERE ((status_id = 0) AND (data_fim IS NULL) AND (usuario_id IS NULL));


--
-- TOC entry 4768 (class 1259 OID 39796)
-- Name: idx_ccw_leitura_conversa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccw_leitura_conversa ON public.cliente_conversa_whats_usuario_leitura USING btree (cliente_conversa_id);


--
-- TOC entry 4769 (class 1259 OID 39795)
-- Name: idx_ccw_leitura_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccw_leitura_usuario ON public.cliente_conversa_whats_usuario_leitura USING btree (usuario_id);


--
-- TOC entry 4566 (class 1259 OID 64175)
-- Name: idx_ccwm_conversa_data_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccwm_conversa_data_desc ON public.cliente_conversa_whats_mensagem USING btree (cliente_conversa_id, data_mensagem DESC, id DESC);


--
-- TOC entry 4567 (class 1259 OID 64176)
-- Name: idx_ccwm_conversa_sendby_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccwm_conversa_sendby_id ON public.cliente_conversa_whats_mensagem USING btree (cliente_conversa_id, send_by, id DESC);


--
-- TOC entry 4568 (class 1259 OID 80748)
-- Name: idx_ccwm_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ccwm_usuario_id ON public.cliente_conversa_whats_mensagem USING btree (usuario_id, id DESC);


--
-- TOC entry 4945 (class 1259 OID 143032)
-- Name: idx_cd_empresa_usuario_ativo_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cd_empresa_usuario_ativo_data ON public.cliente_documento USING btree (empresa_id, usuario_id, data_criacao DESC, id DESC) WHERE (ativo = true);


--
-- TOC entry 4557 (class 1259 OID 43265)
-- Name: idx_cliente_conversa_whats_empresa_meta_param_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_conversa_whats_empresa_meta_param_id ON public.cliente_conversa_whats USING btree (empresa_meta_param_id);


--
-- TOC entry 4558 (class 1259 OID 44480)
-- Name: idx_cliente_conversa_whats_usuario_atribuido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_conversa_whats_usuario_atribuido ON public.cliente_conversa_whats USING btree (usuario_atribuido_id);


--
-- TOC entry 4946 (class 1259 OID 59152)
-- Name: idx_cliente_documento_empresa_cliente_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_documento_empresa_cliente_ativo ON public.cliente_documento USING btree (empresa_id, cliente_id, ativo, data_criacao DESC, id DESC);


--
-- TOC entry 4947 (class 1259 OID 76572)
-- Name: idx_cliente_documento_empresa_usuario_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_documento_empresa_usuario_ativo ON public.cliente_documento USING btree (empresa_id, usuario_id, ativo, data_criacao DESC, id DESC);


--
-- TOC entry 4538 (class 1259 OID 143144)
-- Name: idx_cliente_email_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_email_trgm ON public.cliente USING gin (lower((COALESCE(email, ''::character varying))::text) public.gin_trgm_ops);


--
-- TOC entry 4539 (class 1259 OID 143015)
-- Name: idx_cliente_empresa_ativo_data_cadastro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_empresa_ativo_data_cadastro ON public.cliente USING btree (empresa_id, data_cadastro DESC, id DESC) WHERE (ativo = true);


--
-- TOC entry 4540 (class 1259 OID 143014)
-- Name: idx_cliente_empresa_telefone_digits; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_empresa_telefone_digits ON public.cliente USING btree (empresa_id, regexp_replace((COALESCE(telefone, ''::character varying))::text, '\D'::text, ''::text, 'g'::text));


--
-- TOC entry 4541 (class 1259 OID 143005)
-- Name: idx_cliente_empresa_upper_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_empresa_upper_email ON public.cliente USING btree (empresa_id, upper((email)::text)) WHERE (email IS NOT NULL);


--
-- TOC entry 4872 (class 1259 OID 42796)
-- Name: idx_cliente_lista_transmissao_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_lista_transmissao_ativo ON public.cliente_lista_transmissao USING btree (empresa_id, ativo);


--
-- TOC entry 4885 (class 1259 OID 42842)
-- Name: idx_cliente_lista_transmissao_contato_cliente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_lista_transmissao_contato_cliente_id ON public.cliente_lista_transmissao_contato USING btree (cliente_id);


--
-- TOC entry 4886 (class 1259 OID 42841)
-- Name: idx_cliente_lista_transmissao_contato_lista_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_lista_transmissao_contato_lista_id ON public.cliente_lista_transmissao_contato USING btree (lista_transmissao_id);


--
-- TOC entry 4873 (class 1259 OID 42795)
-- Name: idx_cliente_lista_transmissao_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_lista_transmissao_empresa_id ON public.cliente_lista_transmissao USING btree (empresa_id);


--
-- TOC entry 4874 (class 1259 OID 51872)
-- Name: idx_cliente_lista_transmissao_empresa_meta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_lista_transmissao_empresa_meta ON public.cliente_lista_transmissao USING btree (empresa_id, empresa_meta_param_id, ativo, updated_at DESC, id DESC);


--
-- TOC entry 4879 (class 1259 OID 42817)
-- Name: idx_cliente_lista_transmissao_tag_lista_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_lista_transmissao_tag_lista_id ON public.cliente_lista_transmissao_tag USING btree (lista_transmissao_id);


--
-- TOC entry 4880 (class 1259 OID 42818)
-- Name: idx_cliente_lista_transmissao_tag_tag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_lista_transmissao_tag_tag_id ON public.cliente_lista_transmissao_tag USING btree (tag_id);


--
-- TOC entry 4908 (class 1259 OID 44857)
-- Name: idx_cliente_meta_ads_lead_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cliente_meta_ads_lead_unique ON public.cliente_meta_ads_lead USING btree (empresa_id, meta_lead_id);


--
-- TOC entry 4542 (class 1259 OID 143142)
-- Name: idx_cliente_nome_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_nome_trgm ON public.cliente USING gin (lower((COALESCE(nome, ''::character varying))::text) public.gin_trgm_ops);


--
-- TOC entry 4543 (class 1259 OID 143143)
-- Name: idx_cliente_telefone_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_telefone_trgm ON public.cliente USING gin (lower((COALESCE(telefone, ''::character varying))::text) public.gin_trgm_ops);


--
-- TOC entry 4909 (class 1259 OID 143029)
-- Name: idx_cmal_empresa_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmal_empresa_cliente ON public.cliente_meta_ads_lead USING btree (empresa_id, cliente_id);


--
-- TOC entry 4705 (class 1259 OID 143022)
-- Name: idx_cn_empresa_cliente_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cn_empresa_cliente_ativo ON public.comercial_negocio USING btree (empresa_id, cliente_id, id DESC) WHERE ((ativo = true) AND (cliente_id IS NOT NULL));


--
-- TOC entry 4706 (class 1259 OID 143017)
-- Name: idx_cn_empresa_crm_etapa_kanban; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cn_empresa_crm_etapa_kanban ON public.comercial_negocio USING btree (empresa_id, crm_id, etapa_id, posicao_kanban, data_criacao, id) WHERE (ativo = true);


--
-- TOC entry 4707 (class 1259 OID 143018)
-- Name: idx_cn_empresa_crm_etapa_resp_entry_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cn_empresa_crm_etapa_resp_entry_ref ON public.comercial_negocio USING btree (empresa_id, crm_id, etapa_id, responsavel_usuario_id, COALESCE(data_entrada_pipeline, data_criacao) DESC, id DESC) WHERE (ativo = true);


--
-- TOC entry 4708 (class 1259 OID 143019)
-- Name: idx_cn_empresa_crm_resp_close_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cn_empresa_crm_resp_close_ref ON public.comercial_negocio USING btree (empresa_id, crm_id, responsavel_usuario_id, COALESCE((data_fechamento_real)::timestamp without time zone, (data_fechamento_prevista)::timestamp without time zone, data_criacao) DESC, id DESC) WHERE (ativo = true);


--
-- TOC entry 4709 (class 1259 OID 143020)
-- Name: idx_cn_empresa_origem_venda_upper; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cn_empresa_origem_venda_upper ON public.comercial_negocio USING btree (empresa_id, upper((COALESCE(origem_venda, ''::character varying))::text), id DESC) WHERE (ativo = true);


--
-- TOC entry 4729 (class 1259 OID 143023)
-- Name: idx_cnm_negocio_etapa_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cnm_negocio_etapa_data ON public.comercial_negocio_movimentacao USING btree (negocio_id, etapa_destino_id, data_movimentacao DESC);


--
-- TOC entry 4716 (class 1259 OID 143026)
-- Name: idx_cnt_negocio_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cnt_negocio_tag ON public.comercial_negocio_tag USING btree (negocio_id, tag_id);


--
-- TOC entry 4915 (class 1259 OID 143024)
-- Name: idx_co_negocio_empresa_principal_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_co_negocio_empresa_principal_ativo ON public.comercial_orcamento USING btree (negocio_id, empresa_id, id DESC) WHERE ((ativo = true) AND (principal = true));


--
-- TOC entry 4920 (class 1259 OID 143025)
-- Name: idx_coi_orcamento_upper_nome_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coi_orcamento_upper_nome_ativo ON public.comercial_orcamento_item USING btree (orcamento_id, upper((COALESCE(nome_produto, ''::character varying))::text), id) WHERE (ativo = true);


--
-- TOC entry 4688 (class 1259 OID 76537)
-- Name: idx_comercial_crm_filial_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_crm_filial_id ON public.comercial_crm USING btree (filial_id);


--
-- TOC entry 4976 (class 1259 OID 76558)
-- Name: idx_comercial_crm_meta_numero_crm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_crm_meta_numero_crm_id ON public.comercial_crm_meta_numero USING btree (crm_id);


--
-- TOC entry 4868 (class 1259 OID 42748)
-- Name: idx_comercial_crm_usuario_crm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_crm_usuario_crm_id ON public.comercial_crm_usuario USING btree (crm_id);


--
-- TOC entry 4869 (class 1259 OID 42749)
-- Name: idx_comercial_crm_usuario_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_crm_usuario_usuario_id ON public.comercial_crm_usuario USING btree (usuario_id);


--
-- TOC entry 4761 (class 1259 OID 39732)
-- Name: idx_comercial_historico_cliente_empresa_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_historico_cliente_empresa_cliente ON public.comercial_historico_cliente USING btree (empresa_id, cliente_id, criado_em DESC);


--
-- TOC entry 4762 (class 1259 OID 39733)
-- Name: idx_comercial_historico_cliente_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_historico_cliente_negocio ON public.comercial_historico_cliente USING btree (negocio_id, criado_em DESC);


--
-- TOC entry 4725 (class 1259 OID 63910)
-- Name: idx_comercial_interacao_empresa_categoria_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_interacao_empresa_categoria_data ON public.comercial_interacao USING btree (empresa_id, categoria, data_inicio);


--
-- TOC entry 4726 (class 1259 OID 63911)
-- Name: idx_comercial_interacao_negocio_categoria_andamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_interacao_negocio_categoria_andamento ON public.comercial_interacao USING btree (negocio_id, categoria, em_andamento, data_inicio);


--
-- TOC entry 4921 (class 1259 OID 45005)
-- Name: idx_comercial_orcamento_item_orcamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_orcamento_item_orcamento ON public.comercial_orcamento_item USING btree (orcamento_id, ativo);


--
-- TOC entry 4916 (class 1259 OID 44990)
-- Name: idx_comercial_orcamento_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_orcamento_negocio ON public.comercial_orcamento USING btree (negocio_id, empresa_id);


--
-- TOC entry 4899 (class 1259 OID 44502)
-- Name: idx_comercial_produto_imagem_produto_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_produto_imagem_produto_ativo ON public.comercial_produto_imagem USING btree (comercial_produto_id, ativo, ordem, id);


--
-- TOC entry 4675 (class 1259 OID 43241)
-- Name: idx_day_off_usuario_data_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_day_off_usuario_data_unico ON public.day_off USING btree (usuario_id, data_referencia);


--
-- TOC entry 4981 (class 1259 OID 80604)
-- Name: idx_developer_webhook_empresa_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_developer_webhook_empresa_ativo ON public.developer_webhook USING btree (empresa_id, ativo, id DESC);


--
-- TOC entry 4982 (class 1259 OID 80605)
-- Name: idx_developer_webhook_eventos; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_developer_webhook_eventos ON public.developer_webhook USING gin (eventos);


--
-- TOC entry 4985 (class 1259 OID 80725)
-- Name: idx_developer_webhook_history_empresa_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_developer_webhook_history_empresa_created ON public.developer_webhook_history USING btree (empresa_id, created_at DESC, id DESC);


--
-- TOC entry 4986 (class 1259 OID 80724)
-- Name: idx_developer_webhook_history_webhook_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_developer_webhook_history_webhook_created ON public.developer_webhook_history USING btree (webhook_id, created_at DESC, id DESC);


--
-- TOC entry 4748 (class 1259 OID 39524)
-- Name: idx_empresa_assinatura_pagamento_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresa_assinatura_pagamento_empresa ON public.empresa_assinatura_pagamento USING btree (empresa_id, created_at DESC);


--
-- TOC entry 4749 (class 1259 OID 39523)
-- Name: idx_empresa_assinatura_pagamento_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_empresa_assinatura_pagamento_invoice ON public.empresa_assinatura_pagamento USING btree (stripe_invoice_id);


--
-- TOC entry 4750 (class 1259 OID 39525)
-- Name: idx_empresa_assinatura_pagamento_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresa_assinatura_pagamento_subscription ON public.empresa_assinatura_pagamento USING btree (stripe_subscription_id);


--
-- TOC entry 4532 (class 1259 OID 39504)
-- Name: idx_empresa_assinatura_stripe_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresa_assinatura_stripe_customer_id ON public.empresa_assinatura USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);


--
-- TOC entry 4533 (class 1259 OID 39503)
-- Name: idx_empresa_assinatura_stripe_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_empresa_assinatura_stripe_subscription_id ON public.empresa_assinatura USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);


--
-- TOC entry 4928 (class 1259 OID 45664)
-- Name: idx_empresa_google_ads_accounts_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_empresa_google_ads_accounts_unique ON public.empresa_google_ads_accounts USING btree (empresa_id, google_customer_id);


--
-- TOC entry 4995 (class 1259 OID 117287)
-- Name: idx_empresa_hotmart_integracao_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_empresa_hotmart_integracao_empresa ON public.empresa_hotmart_integracao USING btree (empresa_id);


--
-- TOC entry 4996 (class 1259 OID 117288)
-- Name: idx_empresa_hotmart_integracao_webhook_public_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_empresa_hotmart_integracao_webhook_public_id ON public.empresa_hotmart_integracao USING btree (webhook_public_id);


--
-- TOC entry 4741 (class 1259 OID 37724)
-- Name: idx_empresa_meta_ads_accounts_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_empresa_meta_ads_accounts_unique ON public.empresa_meta_ads_accounts USING btree (empresa_id, meta_ad_account_id);


--
-- TOC entry 4912 (class 1259 OID 44884)
-- Name: idx_empresa_meta_ads_field_mapping_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_empresa_meta_ads_field_mapping_unique ON public.empresa_meta_ads_field_mapping USING btree (empresa_id, escopo_tipo, escopo_id);


--
-- TOC entry 4744 (class 1259 OID 39344)
-- Name: idx_empresa_meta_instagram_accounts_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresa_meta_instagram_accounts_empresa ON public.empresa_meta_instagram_accounts USING btree (empresa_id);


--
-- TOC entry 4745 (class 1259 OID 39343)
-- Name: idx_empresa_meta_instagram_accounts_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_empresa_meta_instagram_accounts_unique ON public.empresa_meta_instagram_accounts USING btree (empresa_id, meta_instagram_business_account_id);


--
-- TOC entry 4924 (class 1259 OID 45638)
-- Name: idx_empresa_tiktok_accounts_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresa_tiktok_accounts_empresa ON public.empresa_tiktok_accounts USING btree (empresa_id);


--
-- TOC entry 4925 (class 1259 OID 45637)
-- Name: idx_empresa_tiktok_accounts_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_empresa_tiktok_accounts_unique ON public.empresa_tiktok_accounts USING btree (empresa_id, tiktok_open_id);


--
-- TOC entry 4999 (class 1259 OID 117310)
-- Name: idx_hotmart_evento_cliente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotmart_evento_cliente_id ON public.hotmart_evento USING btree (cliente_id);


--
-- TOC entry 5000 (class 1259 OID 117309)
-- Name: idx_hotmart_evento_empresa_recebido_em; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotmart_evento_empresa_recebido_em ON public.hotmart_evento USING btree (empresa_id, recebido_em DESC);


--
-- TOC entry 5001 (class 1259 OID 117308)
-- Name: idx_hotmart_evento_integracao_payload_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_hotmart_evento_integracao_payload_hash ON public.hotmart_evento USING btree (integracao_id, payload_hash);


--
-- TOC entry 5004 (class 1259 OID 117338)
-- Name: idx_hotmart_produto_map_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_hotmart_produto_map_unique ON public.empresa_hotmart_produto_map USING btree (empresa_id, hotmart_product_key);


--
-- TOC entry 4887 (class 1259 OID 43067)
-- Name: idx_manual_artigo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manual_artigo_empresa ON public.manual_artigo USING btree (empresa_id, ativo, status);


--
-- TOC entry 4888 (class 1259 OID 43068)
-- Name: idx_manual_artigo_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manual_artigo_slug ON public.manual_artigo USING btree (empresa_id, slug);


--
-- TOC entry 4751 (class 1259 OID 39681)
-- Name: idx_nps_pergunta_empresa_ativo_ordem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nps_pergunta_empresa_ativo_ordem ON public.nps_pergunta USING btree (empresa_id, ativo, ordem);


--
-- TOC entry 4754 (class 1259 OID 39710)
-- Name: idx_nps_resposta_empresa_atendimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nps_resposta_empresa_atendimento ON public.nps_resposta USING btree (empresa_id, atendimento_id);


--
-- TOC entry 4583 (class 1259 OID 35161)
-- Name: idx_parametros_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parametros_empresa_id ON public.parametros USING btree (empresa_id);


--
-- TOC entry 4988 (class 1259 OID 87726)
-- Name: idx_push_token_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_token_usuario ON public.push_token USING btree (usuario_id) WHERE (ativo = true);


--
-- TOC entry 4658 (class 1259 OID 43196)
-- Name: idx_registro_ponto_data_hora; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_registro_ponto_data_hora ON public.registro_ponto USING btree (data_hora);


--
-- TOC entry 4659 (class 1259 OID 43200)
-- Name: idx_registro_ponto_faixa_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_registro_ponto_faixa_ip ON public.registro_ponto USING btree (faixa_ip);


--
-- TOC entry 4660 (class 1259 OID 43199)
-- Name: idx_registro_ponto_ip_publico; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_registro_ponto_ip_publico ON public.registro_ponto USING btree (ip_publico);


--
-- TOC entry 4661 (class 1259 OID 43197)
-- Name: idx_registro_ponto_origem_registro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_registro_ponto_origem_registro ON public.registro_ponto USING btree (origem_registro);


--
-- TOC entry 4662 (class 1259 OID 43198)
-- Name: idx_registro_ponto_registrado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_registro_ponto_registrado_por ON public.registro_ponto USING btree (registrado_por_usuario_id);


--
-- TOC entry 5005 (class 1259 OID 145676)
-- Name: idx_sistema_novidade_empresa_destaque; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sistema_novidade_empresa_destaque ON public.sistema_novidade USING btree (empresa_id, modal_destaque, ativo, id DESC);


--
-- TOC entry 5006 (class 1259 OID 145675)
-- Name: idx_sistema_novidade_empresa_publicacao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sistema_novidade_empresa_publicacao ON public.sistema_novidade USING btree (empresa_id, ativo, data_publicacao DESC, id DESC);


--
-- TOC entry 5009 (class 1259 OID 145678)
-- Name: idx_sistema_novidade_usuario_lida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sistema_novidade_usuario_lida ON public.sistema_novidade_usuario USING btree (usuario_id, lida_em, modal_dispensado_em);


--
-- TOC entry 5010 (class 1259 OID 145677)
-- Name: idx_sistema_novidade_usuario_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sistema_novidade_usuario_usuario ON public.sistema_novidade_usuario USING btree (usuario_id, novidade_id);


--
-- TOC entry 4891 (class 1259 OID 43264)
-- Name: idx_usuario_meta_numero_empresa_meta_param_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_meta_numero_empresa_meta_param_id ON public.usuario_meta_numero USING btree (empresa_meta_param_id);


--
-- TOC entry 4892 (class 1259 OID 43263)
-- Name: idx_usuario_meta_numero_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_meta_numero_usuario_id ON public.usuario_meta_numero USING btree (usuario_id);


--
-- TOC entry 4622 (class 1259 OID 47033)
-- Name: idx_venda_nfce_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venda_nfce_id ON public.venda USING btree (nfce_id);


--
-- TOC entry 4734 (class 1259 OID 51866)
-- Name: idx_whatsapp_auto_message_empresa_tipo_meta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_auto_message_empresa_tipo_meta ON public.whatsapp_auto_message USING btree (empresa_id, whatsapp_auto_message_tipo_id, empresa_meta_param_id, id DESC);


--
-- TOC entry 4954 (class 1259 OID 67833)
-- Name: idx_whatsapp_template_aniversario_envio_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_template_aniversario_envio_lookup ON public.whatsapp_template_aniversario_envio USING btree (empresa_meta_param_id, referencia_data, status);


--
-- TOC entry 4933 (class 1259 OID 48284)
-- Name: idx_whatsapp_template_disparo_item_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_template_disparo_item_cliente ON public.whatsapp_template_disparo_item USING btree (cliente_id, data_criacao DESC);


--
-- TOC entry 4934 (class 1259 OID 48283)
-- Name: idx_whatsapp_template_disparo_item_empresa_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_template_disparo_item_empresa_template ON public.whatsapp_template_disparo_item USING btree (empresa_id, template_id, data_criacao DESC);


--
-- TOC entry 4935 (class 1259 OID 48282)
-- Name: idx_whatsapp_template_disparo_item_lote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_template_disparo_item_lote ON public.whatsapp_template_disparo_item USING btree (disparo_lote_id);


--
-- TOC entry 4936 (class 1259 OID 48285)
-- Name: idx_whatsapp_template_disparo_item_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_whatsapp_template_disparo_item_message_id ON public.whatsapp_template_disparo_item USING btree (message_id) WHERE (message_id IS NOT NULL);


--
-- TOC entry 4929 (class 1259 OID 48246)
-- Name: idx_whatsapp_template_disparo_lote_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_template_disparo_lote_empresa ON public.whatsapp_template_disparo_lote USING btree (empresa_id, data_inicio DESC);


--
-- TOC entry 4930 (class 1259 OID 48247)
-- Name: idx_whatsapp_template_disparo_lote_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_template_disparo_lote_template ON public.whatsapp_template_disparo_lote USING btree (empresa_id, template_id, data_inicio DESC);


--
-- TOC entry 4959 (class 1259 OID 68160)
-- Name: idx_whatsapp_template_followup_venda_envio_empresa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_template_followup_venda_envio_empresa_status ON public.whatsapp_template_followup_venda_envio USING btree (empresa_id, empresa_meta_param_id, status);


--
-- TOC entry 4960 (class 1259 OID 68161)
-- Name: idx_whatsapp_template_followup_venda_envio_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_template_followup_venda_envio_negocio ON public.whatsapp_template_followup_venda_envio USING btree (comercial_negocio_id, evento_data DESC);


--
-- TOC entry 4937 (class 1259 OID 64177)
-- Name: idx_wtdi_conversa_sucesso_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wtdi_conversa_sucesso_data ON public.whatsapp_template_disparo_item USING btree (conversa_id, sucesso, data_criacao DESC);


--
-- TOC entry 4938 (class 1259 OID 142972)
-- Name: idx_wtdi_conversa_sucesso_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wtdi_conversa_sucesso_id ON public.whatsapp_template_disparo_item USING btree (conversa_id, sucesso, id DESC);


--
-- TOC entry 4939 (class 1259 OID 142973)
-- Name: idx_wtdi_empresa_cliente_meta_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wtdi_empresa_cliente_meta_data ON public.whatsapp_template_disparo_item USING btree (empresa_id, cliente_id, empresa_meta_param_id, data_criacao DESC, id DESC) WHERE (sucesso = true);


--
-- TOC entry 4940 (class 1259 OID 142971)
-- Name: idx_wtdi_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wtdi_message_id ON public.whatsapp_template_disparo_item USING btree (message_id) WHERE (message_id IS NOT NULL);


--
-- TOC entry 4859 (class 1259 OID 40542)
-- Name: ix_financeiro_alerta_empresa_status_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_alerta_empresa_status_data ON public.financeiro_alerta USING btree (empresa_id, status_id, data_alerta DESC);


--
-- TOC entry 4862 (class 1259 OID 40801)
-- Name: ix_financeiro_assinatura_empresa_empresa_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_assinatura_empresa_empresa_ativo ON public.financeiro_assinatura_empresa USING btree (empresa_id, ativo);


--
-- TOC entry 4863 (class 1259 OID 40802)
-- Name: ix_financeiro_assinatura_empresa_empresa_proximo_venc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_assinatura_empresa_empresa_proximo_venc ON public.financeiro_assinatura_empresa USING btree (empresa_id, proximo_vencimento);


--
-- TOC entry 4852 (class 1259 OID 40480)
-- Name: ix_financeiro_comissao_empresa_usuario_comp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_comissao_empresa_usuario_comp ON public.financeiro_comissao_lancamento USING btree (empresa_id, usuario_id, competencia);


--
-- TOC entry 4821 (class 1259 OID 40204)
-- Name: ix_financeiro_conta_pagar_empresa_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_conta_pagar_empresa_categoria ON public.financeiro_conta_pagar USING btree (empresa_id, categoria_id);


--
-- TOC entry 4822 (class 1259 OID 40205)
-- Name: ix_financeiro_conta_pagar_empresa_competencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_conta_pagar_empresa_competencia ON public.financeiro_conta_pagar USING btree (empresa_id, competencia);


--
-- TOC entry 4823 (class 1259 OID 40203)
-- Name: ix_financeiro_conta_pagar_empresa_status_vencimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_conta_pagar_empresa_status_vencimento ON public.financeiro_conta_pagar USING btree (empresa_id, status_id, vencimento);


--
-- TOC entry 4824 (class 1259 OID 40666)
-- Name: ix_financeiro_conta_pagar_grupo_parcelamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_conta_pagar_grupo_parcelamento ON public.financeiro_conta_pagar USING btree (empresa_id, grupo_parcelamento_id);


--
-- TOC entry 4832 (class 1259 OID 40316)
-- Name: ix_financeiro_conta_receber_empresa_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_conta_receber_empresa_cliente ON public.financeiro_conta_receber USING btree (empresa_id, cliente_id);


--
-- TOC entry 4833 (class 1259 OID 40317)
-- Name: ix_financeiro_conta_receber_empresa_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_conta_receber_empresa_negocio ON public.financeiro_conta_receber USING btree (empresa_id, comercial_negocio_id);


--
-- TOC entry 4834 (class 1259 OID 40315)
-- Name: ix_financeiro_conta_receber_empresa_status_vencimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_conta_receber_empresa_status_vencimento ON public.financeiro_conta_receber USING btree (empresa_id, status_id, vencimento);


--
-- TOC entry 4835 (class 1259 OID 40671)
-- Name: ix_financeiro_conta_receber_grupo_parcelamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_conta_receber_grupo_parcelamento ON public.financeiro_conta_receber USING btree (empresa_id, grupo_parcelamento_id);


--
-- TOC entry 4818 (class 1259 OID 40139)
-- Name: ix_financeiro_contraparte_empresa_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_contraparte_empresa_nome ON public.financeiro_contraparte USING btree (empresa_id, nome);


--
-- TOC entry 4843 (class 1259 OID 40409)
-- Name: ix_financeiro_lancamento_empresa_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_lancamento_empresa_data ON public.financeiro_lancamento USING btree (empresa_id, data_lancamento);


--
-- TOC entry 4844 (class 1259 OID 40410)
-- Name: ix_financeiro_lancamento_empresa_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_lancamento_empresa_origem ON public.financeiro_lancamento USING btree (empresa_id, origem_id, origem_registro_id);


--
-- TOC entry 4845 (class 1259 OID 40411)
-- Name: ix_financeiro_lancamento_empresa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_lancamento_empresa_status ON public.financeiro_lancamento USING btree (empresa_id, status_id);


--
-- TOC entry 4828 (class 1259 OID 40240)
-- Name: ix_financeiro_pagamento_pagar_conta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_pagamento_pagar_conta ON public.financeiro_pagamento_pagar USING btree (conta_pagar_id, ativo);


--
-- TOC entry 4829 (class 1259 OID 40241)
-- Name: ix_financeiro_pagamento_pagar_empresa_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_pagamento_pagar_empresa_data ON public.financeiro_pagamento_pagar USING btree (empresa_id, data_pagamento);


--
-- TOC entry 4839 (class 1259 OID 40352)
-- Name: ix_financeiro_recebimento_conta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_recebimento_conta ON public.financeiro_recebimento USING btree (conta_receber_id, ativo);


--
-- TOC entry 4840 (class 1259 OID 40353)
-- Name: ix_financeiro_recebimento_empresa_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_financeiro_recebimento_empresa_data ON public.financeiro_recebimento USING btree (empresa_id, data_recebimento);


--
-- TOC entry 4763 (class 1259 OID 39734)
-- Name: uk_comercial_historico_cliente_interacao; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_comercial_historico_cliente_interacao ON public.comercial_historico_cliente USING btree (interacao_id) WHERE (interacao_id IS NOT NULL);


--
-- TOC entry 4977 (class 1259 OID 76556)
-- Name: uq_comercial_crm_meta_numero_crm_meta_param; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_comercial_crm_meta_numero_crm_meta_param ON public.comercial_crm_meta_numero USING btree (crm_id, empresa_meta_param_id);


--
-- TOC entry 4978 (class 1259 OID 76557)
-- Name: uq_comercial_crm_meta_numero_meta_param; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_comercial_crm_meta_numero_meta_param ON public.comercial_crm_meta_numero USING btree (empresa_meta_param_id);


--
-- TOC entry 4987 (class 1259 OID 80723)
-- Name: uq_developer_webhook_history_dispatch; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_developer_webhook_history_dispatch ON public.developer_webhook_history USING btree (webhook_id, dispatch_key);


--
-- TOC entry 4961 (class 1259 OID 68159)
-- Name: uq_whatsapp_template_followup_venda_envio_evento; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_whatsapp_template_followup_venda_envio_evento ON public.whatsapp_template_followup_venda_envio USING btree (automacao_tipo, comercial_negocio_id, evento_data);


--
-- TOC entry 4917 (class 1259 OID 44991)
-- Name: ux_comercial_orcamento_principal_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_comercial_orcamento_principal_ativo ON public.comercial_orcamento USING btree (negocio_id) WHERE ((principal = true) AND (ativo = true));


--
-- TOC entry 4808 (class 1259 OID 40084)
-- Name: ux_financeiro_categoria_empresa_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_financeiro_categoria_empresa_nome ON public.financeiro_categoria USING btree (empresa_id, nome, COALESCE(categoria_pai_id, (0)::bigint));


--
-- TOC entry 4811 (class 1259 OID 40102)
-- Name: ux_financeiro_centro_custo_empresa_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_financeiro_centro_custo_empresa_codigo ON public.financeiro_centro_custo USING btree (empresa_id, codigo) WHERE (codigo IS NOT NULL);


--
-- TOC entry 4812 (class 1259 OID 40103)
-- Name: ux_financeiro_centro_custo_empresa_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_financeiro_centro_custo_empresa_nome ON public.financeiro_centro_custo USING btree (empresa_id, nome);


--
-- TOC entry 4815 (class 1259 OID 40122)
-- Name: ux_financeiro_conta_financeira_empresa_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_financeiro_conta_financeira_empresa_nome ON public.financeiro_conta_financeira USING btree (empresa_id, nome);


--
-- TOC entry 4825 (class 1259 OID 40667)
-- Name: ux_financeiro_conta_pagar_grupo_parcela; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_financeiro_conta_pagar_grupo_parcela ON public.financeiro_conta_pagar USING btree (empresa_id, grupo_parcelamento_id, parcela_numero) WHERE (grupo_parcelamento_id IS NOT NULL);


--
-- TOC entry 4836 (class 1259 OID 40672)
-- Name: ux_financeiro_conta_receber_grupo_parcela; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_financeiro_conta_receber_grupo_parcela ON public.financeiro_conta_receber USING btree (empresa_id, grupo_parcelamento_id, parcela_numero) WHERE (grupo_parcelamento_id IS NOT NULL);


--
-- TOC entry 5230 (class 2620 OID 40653)
-- Name: financeiro_alerta_config trg_financeiro_alerta_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_alerta_config_updated_at BEFORE UPDATE ON public.financeiro_alerta_config FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5231 (class 2620 OID 40654)
-- Name: financeiro_alerta trg_financeiro_alerta_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_alerta_updated_at BEFORE UPDATE ON public.financeiro_alerta FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5232 (class 2620 OID 40805)
-- Name: financeiro_assinatura_empresa trg_financeiro_assinatura_empresa_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_assinatura_empresa_updated_at BEFORE UPDATE ON public.financeiro_assinatura_empresa FOR EACH ROW EXECUTE FUNCTION public.fn_fin_assinatura_set_updated_at();


--
-- TOC entry 5217 (class 2620 OID 40642)
-- Name: financeiro_categoria trg_financeiro_categoria_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_categoria_updated_at BEFORE UPDATE ON public.financeiro_categoria FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5218 (class 2620 OID 40643)
-- Name: financeiro_centro_custo trg_financeiro_centro_custo_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_centro_custo_updated_at BEFORE UPDATE ON public.financeiro_centro_custo FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5229 (class 2620 OID 40652)
-- Name: financeiro_comissao_lancamento trg_financeiro_comissao_lancamento_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_comissao_lancamento_updated_at BEFORE UPDATE ON public.financeiro_comissao_lancamento FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5219 (class 2620 OID 40644)
-- Name: financeiro_conta_financeira trg_financeiro_conta_financeira_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_conta_financeira_updated_at BEFORE UPDATE ON public.financeiro_conta_financeira FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5221 (class 2620 OID 40646)
-- Name: financeiro_conta_pagar trg_financeiro_conta_pagar_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_conta_pagar_updated_at BEFORE UPDATE ON public.financeiro_conta_pagar FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5224 (class 2620 OID 40648)
-- Name: financeiro_conta_receber trg_financeiro_conta_receber_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_conta_receber_updated_at BEFORE UPDATE ON public.financeiro_conta_receber FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5220 (class 2620 OID 40645)
-- Name: financeiro_contraparte trg_financeiro_contraparte_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_contraparte_updated_at BEFORE UPDATE ON public.financeiro_contraparte FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5227 (class 2620 OID 40650)
-- Name: financeiro_lancamento trg_financeiro_lancamento_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_lancamento_updated_at BEFORE UPDATE ON public.financeiro_lancamento FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5228 (class 2620 OID 40651)
-- Name: financeiro_meta_usuario trg_financeiro_meta_usuario_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_meta_usuario_updated_at BEFORE UPDATE ON public.financeiro_meta_usuario FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5222 (class 2620 OID 40655)
-- Name: financeiro_pagamento_pagar trg_financeiro_pagamento_pagar_sync_lancamento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_pagamento_pagar_sync_lancamento BEFORE INSERT OR DELETE OR UPDATE ON public.financeiro_pagamento_pagar FOR EACH ROW EXECUTE FUNCTION public.fn_fin_sync_lancamento_pagamento();


--
-- TOC entry 5223 (class 2620 OID 40647)
-- Name: financeiro_pagamento_pagar trg_financeiro_pagamento_pagar_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_pagamento_pagar_updated_at BEFORE UPDATE ON public.financeiro_pagamento_pagar FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5225 (class 2620 OID 40656)
-- Name: financeiro_recebimento trg_financeiro_recebimento_sync_lancamento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_recebimento_sync_lancamento BEFORE INSERT OR DELETE OR UPDATE ON public.financeiro_recebimento FOR EACH ROW EXECUTE FUNCTION public.fn_fin_sync_lancamento_recebimento();


--
-- TOC entry 5226 (class 2620 OID 40649)
-- Name: financeiro_recebimento trg_financeiro_recebimento_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_recebimento_updated_at BEFORE UPDATE ON public.financeiro_recebimento FOR EACH ROW EXECUTE FUNCTION public.fn_fin_set_updated_at();


--
-- TOC entry 5214 (class 2620 OID 39582)
-- Name: empresa trg_set_empresa_cliente_webhook_codigo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_empresa_cliente_webhook_codigo BEFORE INSERT ON public.empresa FOR EACH ROW EXECUTE FUNCTION public.fn_set_empresa_cliente_webhook_codigo();


--
-- TOC entry 5215 (class 2620 OID 39661)
-- Name: empresa trg_set_empresa_cliente_webhook_public_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_empresa_cliente_webhook_public_id BEFORE INSERT ON public.empresa FOR EACH ROW EXECUTE FUNCTION public.fn_set_empresa_cliente_webhook_public_id();


--
-- TOC entry 5216 (class 2620 OID 39346)
-- Name: empresa_meta_instagram_accounts trg_set_updated_at_empresa_meta_instagram_accounts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_empresa_meta_instagram_accounts BEFORE UPDATE ON public.empresa_meta_instagram_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_empresa_meta_instagram_accounts();


--
-- TOC entry 5213 (class 2620 OID 26886)
-- Name: cliente_conversa_whats_mensagem trigger_atualizar_ultima_conversa_whats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_atualizar_ultima_conversa_whats AFTER INSERT OR UPDATE ON public.cliente_conversa_whats_mensagem FOR EACH ROW EXECUTE FUNCTION public.atualizar_ultima_conversa_whats();


--
-- TOC entry 5045 (class 2606 OID 34600)
-- Name: apuracao_ponto_diaria apuracao_ponto_diaria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apuracao_ponto_diaria
    ADD CONSTRAINT apuracao_ponto_diaria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5178 (class 2606 OID 63733)
-- Name: atendimento_fila_usuario atendimento_fila_usuario_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento_fila_usuario
    ADD CONSTRAINT atendimento_fila_usuario_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5179 (class 2606 OID 63738)
-- Name: atendimento_fila_usuario atendimento_fila_usuario_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento_fila_usuario
    ADD CONSTRAINT atendimento_fila_usuario_usuario_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- TOC entry 5039 (class 2606 OID 34467)
-- Name: banco_horas_lancamento banco_horas_lancamento_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banco_horas_lancamento
    ADD CONSTRAINT banco_horas_lancamento_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5017 (class 2606 OID 43267)
-- Name: cliente_conversa_whats cliente_conversa_whats_empresa_meta_param_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats
    ADD CONSTRAINT cliente_conversa_whats_empresa_meta_param_id_fkey FOREIGN KEY (empresa_meta_param_id) REFERENCES public.empresa_meta_parans(id);


--
-- TOC entry 5019 (class 2606 OID 80743)
-- Name: cliente_conversa_whats_mensagem cliente_conversa_whats_mensagem_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats_mensagem
    ADD CONSTRAINT cliente_conversa_whats_mensagem_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5018 (class 2606 OID 44475)
-- Name: cliente_conversa_whats cliente_conversa_whats_usuario_atribuido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats
    ADD CONSTRAINT cliente_conversa_whats_usuario_atribuido_fkey FOREIGN KEY (usuario_atribuido_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5084 (class 2606 OID 39785)
-- Name: cliente_conversa_whats_usuario_leitura cliente_conversa_whats_usuario_leitura_cliente_conversa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats_usuario_leitura
    ADD CONSTRAINT cliente_conversa_whats_usuario_leitura_cliente_conversa_id_fkey FOREIGN KEY (cliente_conversa_id) REFERENCES public.cliente_conversa_whats(id) ON DELETE CASCADE;


--
-- TOC entry 5085 (class 2606 OID 39790)
-- Name: cliente_conversa_whats_usuario_leitura cliente_conversa_whats_usuario_leitura_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_conversa_whats_usuario_leitura
    ADD CONSTRAINT cliente_conversa_whats_usuario_leitura_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- TOC entry 5177 (class 2606 OID 76567)
-- Name: cliente_documento cliente_documento_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_documento
    ADD CONSTRAINT cliente_documento_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5016 (class 2606 OID 26887)
-- Name: cliente cliente_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5152 (class 2606 OID 42836)
-- Name: cliente_lista_transmissao_contato cliente_lista_transmissao_contato_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao_contato
    ADD CONSTRAINT cliente_lista_transmissao_contato_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id) ON DELETE CASCADE;


--
-- TOC entry 5153 (class 2606 OID 42831)
-- Name: cliente_lista_transmissao_contato cliente_lista_transmissao_contato_lista_transmissao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao_contato
    ADD CONSTRAINT cliente_lista_transmissao_contato_lista_transmissao_id_fkey FOREIGN KEY (lista_transmissao_id) REFERENCES public.cliente_lista_transmissao(id) ON DELETE CASCADE;


--
-- TOC entry 5147 (class 2606 OID 42790)
-- Name: cliente_lista_transmissao cliente_lista_transmissao_criado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao
    ADD CONSTRAINT cliente_lista_transmissao_criado_por_usuario_id_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5148 (class 2606 OID 42785)
-- Name: cliente_lista_transmissao cliente_lista_transmissao_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao
    ADD CONSTRAINT cliente_lista_transmissao_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5149 (class 2606 OID 51867)
-- Name: cliente_lista_transmissao cliente_lista_transmissao_empresa_meta_param_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao
    ADD CONSTRAINT cliente_lista_transmissao_empresa_meta_param_id_fkey FOREIGN KEY (empresa_meta_param_id) REFERENCES public.empresa_meta_parans(id) ON DELETE SET NULL;


--
-- TOC entry 5150 (class 2606 OID 42807)
-- Name: cliente_lista_transmissao_tag cliente_lista_transmissao_tag_lista_transmissao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao_tag
    ADD CONSTRAINT cliente_lista_transmissao_tag_lista_transmissao_id_fkey FOREIGN KEY (lista_transmissao_id) REFERENCES public.cliente_lista_transmissao(id) ON DELETE CASCADE;


--
-- TOC entry 5151 (class 2606 OID 42812)
-- Name: cliente_lista_transmissao_tag cliente_lista_transmissao_tag_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_lista_transmissao_tag
    ADD CONSTRAINT cliente_lista_transmissao_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE CASCADE;


--
-- TOC entry 5162 (class 2606 OID 44858)
-- Name: cliente_meta_ads_lead cliente_meta_ads_lead_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_meta_ads_lead
    ADD CONSTRAINT cliente_meta_ads_lead_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id) ON DELETE CASCADE;


--
-- TOC entry 5163 (class 2606 OID 44863)
-- Name: cliente_meta_ads_lead cliente_meta_ads_lead_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_meta_ads_lead
    ADD CONSTRAINT cliente_meta_ads_lead_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5046 (class 2606 OID 35575)
-- Name: comercial_crm comercial_crm_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm
    ADD CONSTRAINT comercial_crm_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5047 (class 2606 OID 76532)
-- Name: comercial_crm comercial_crm_filial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm
    ADD CONSTRAINT comercial_crm_filial_id_fkey FOREIGN KEY (filial_id) REFERENCES public.empresa_filial(id) ON DELETE SET NULL;


--
-- TOC entry 5197 (class 2606 OID 76546)
-- Name: comercial_crm_meta_numero comercial_crm_meta_numero_crm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm_meta_numero
    ADD CONSTRAINT comercial_crm_meta_numero_crm_id_fkey FOREIGN KEY (crm_id) REFERENCES public.comercial_crm(id) ON DELETE CASCADE;


--
-- TOC entry 5198 (class 2606 OID 76551)
-- Name: comercial_crm_meta_numero comercial_crm_meta_numero_empresa_meta_param_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm_meta_numero
    ADD CONSTRAINT comercial_crm_meta_numero_empresa_meta_param_id_fkey FOREIGN KEY (empresa_meta_param_id) REFERENCES public.empresa_meta_parans(id) ON DELETE CASCADE;


--
-- TOC entry 5145 (class 2606 OID 42738)
-- Name: comercial_crm_usuario comercial_crm_usuario_crm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm_usuario
    ADD CONSTRAINT comercial_crm_usuario_crm_id_fkey FOREIGN KEY (crm_id) REFERENCES public.comercial_crm(id) ON DELETE CASCADE;


--
-- TOC entry 5146 (class 2606 OID 42743)
-- Name: comercial_crm_usuario comercial_crm_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_crm_usuario
    ADD CONSTRAINT comercial_crm_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- TOC entry 5185 (class 2606 OID 70103)
-- Name: comercial_disparo_agendado comercial_disparo_agendado_crm_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado
    ADD CONSTRAINT comercial_disparo_agendado_crm_fk FOREIGN KEY (crm_id) REFERENCES public.comercial_crm(id);


--
-- TOC entry 5186 (class 2606 OID 70083)
-- Name: comercial_disparo_agendado comercial_disparo_agendado_empresa_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado
    ADD CONSTRAINT comercial_disparo_agendado_empresa_fk FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5187 (class 2606 OID 70108)
-- Name: comercial_disparo_agendado comercial_disparo_agendado_etapa_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado
    ADD CONSTRAINT comercial_disparo_agendado_etapa_fk FOREIGN KEY (etapa_id) REFERENCES public.comercial_etapa(id);


--
-- TOC entry 5188 (class 2606 OID 70113)
-- Name: comercial_disparo_agendado comercial_disparo_agendado_history_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado
    ADD CONSTRAINT comercial_disparo_agendado_history_fk FOREIGN KEY (dispatch_history_id) REFERENCES public.whatsapp_template_disparo_lote(id) ON DELETE SET NULL;


--
-- TOC entry 5192 (class 2606 OID 70145)
-- Name: comercial_disparo_agendado_item comercial_disparo_agendado_item_cliente_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado_item
    ADD CONSTRAINT comercial_disparo_agendado_item_cliente_fk FOREIGN KEY (cliente_id) REFERENCES public.cliente(id) ON DELETE SET NULL;


--
-- TOC entry 5193 (class 2606 OID 70150)
-- Name: comercial_disparo_agendado_item comercial_disparo_agendado_item_conversa_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado_item
    ADD CONSTRAINT comercial_disparo_agendado_item_conversa_fk FOREIGN KEY (conversa_id) REFERENCES public.cliente_conversa_whats(id) ON DELETE SET NULL;


--
-- TOC entry 5194 (class 2606 OID 70140)
-- Name: comercial_disparo_agendado_item comercial_disparo_agendado_item_empresa_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado_item
    ADD CONSTRAINT comercial_disparo_agendado_item_empresa_fk FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5195 (class 2606 OID 70155)
-- Name: comercial_disparo_agendado_item comercial_disparo_agendado_item_negocio_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado_item
    ADD CONSTRAINT comercial_disparo_agendado_item_negocio_fk FOREIGN KEY (negocio_id) REFERENCES public.comercial_negocio(id) ON DELETE SET NULL;


--
-- TOC entry 5196 (class 2606 OID 70135)
-- Name: comercial_disparo_agendado_item comercial_disparo_agendado_item_schedule_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado_item
    ADD CONSTRAINT comercial_disparo_agendado_item_schedule_fk FOREIGN KEY (agendamento_id) REFERENCES public.comercial_disparo_agendado(id) ON DELETE CASCADE;


--
-- TOC entry 5189 (class 2606 OID 70098)
-- Name: comercial_disparo_agendado comercial_disparo_agendado_lista_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado
    ADD CONSTRAINT comercial_disparo_agendado_lista_fk FOREIGN KEY (lista_transmissao_id) REFERENCES public.cliente_lista_transmissao(id);


--
-- TOC entry 5190 (class 2606 OID 70093)
-- Name: comercial_disparo_agendado comercial_disparo_agendado_meta_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado
    ADD CONSTRAINT comercial_disparo_agendado_meta_fk FOREIGN KEY (empresa_meta_param_id) REFERENCES public.empresa_meta_parans(id);


--
-- TOC entry 5191 (class 2606 OID 70088)
-- Name: comercial_disparo_agendado comercial_disparo_agendado_usuario_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_disparo_agendado
    ADD CONSTRAINT comercial_disparo_agendado_usuario_fk FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5048 (class 2606 OID 35600)
-- Name: comercial_etapa comercial_etapa_crm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_etapa
    ADD CONSTRAINT comercial_etapa_crm_id_fkey FOREIGN KEY (crm_id) REFERENCES public.comercial_crm(id) ON DELETE CASCADE;


--
-- TOC entry 5049 (class 2606 OID 35614)
-- Name: comercial_forma_pagamento comercial_forma_pagamento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_forma_pagamento
    ADD CONSTRAINT comercial_forma_pagamento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5079 (class 2606 OID 39745)
-- Name: comercial_historico_cliente comercial_historico_cliente_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_historico_cliente
    ADD CONSTRAINT comercial_historico_cliente_cliente_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id);


--
-- TOC entry 5080 (class 2606 OID 39735)
-- Name: comercial_historico_cliente comercial_historico_cliente_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_historico_cliente
    ADD CONSTRAINT comercial_historico_cliente_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5081 (class 2606 OID 39755)
-- Name: comercial_historico_cliente comercial_historico_cliente_interacao_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_historico_cliente
    ADD CONSTRAINT comercial_historico_cliente_interacao_fkey FOREIGN KEY (interacao_id) REFERENCES public.comercial_interacao(id) ON DELETE SET NULL;


--
-- TOC entry 5082 (class 2606 OID 39740)
-- Name: comercial_historico_cliente comercial_historico_cliente_negocio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_historico_cliente
    ADD CONSTRAINT comercial_historico_cliente_negocio_fkey FOREIGN KEY (negocio_id) REFERENCES public.comercial_negocio(id) ON DELETE SET NULL;


--
-- TOC entry 5083 (class 2606 OID 39750)
-- Name: comercial_historico_cliente comercial_historico_cliente_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_historico_cliente
    ADD CONSTRAINT comercial_historico_cliente_usuario_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5065 (class 2606 OID 35812)
-- Name: comercial_interacao comercial_interacao_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_interacao
    ADD CONSTRAINT comercial_interacao_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id);


--
-- TOC entry 5066 (class 2606 OID 35802)
-- Name: comercial_interacao comercial_interacao_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_interacao
    ADD CONSTRAINT comercial_interacao_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5067 (class 2606 OID 35807)
-- Name: comercial_interacao comercial_interacao_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_interacao
    ADD CONSTRAINT comercial_interacao_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.comercial_negocio(id) ON DELETE CASCADE;


--
-- TOC entry 5068 (class 2606 OID 35822)
-- Name: comercial_interacao comercial_interacao_tipo_interacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_interacao
    ADD CONSTRAINT comercial_interacao_tipo_interacao_id_fkey FOREIGN KEY (tipo_interacao_id) REFERENCES public.comercial_tipo_interacao(id);


--
-- TOC entry 5069 (class 2606 OID 35817)
-- Name: comercial_interacao comercial_interacao_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_interacao
    ADD CONSTRAINT comercial_interacao_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5050 (class 2606 OID 35627)
-- Name: comercial_motivo_perda comercial_motivo_perda_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_motivo_perda
    ADD CONSTRAINT comercial_motivo_perda_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5051 (class 2606 OID 35660)
-- Name: comercial_negocio comercial_negocio_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio
    ADD CONSTRAINT comercial_negocio_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id);


--
-- TOC entry 5052 (class 2606 OID 35655)
-- Name: comercial_negocio comercial_negocio_crm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio
    ADD CONSTRAINT comercial_negocio_crm_id_fkey FOREIGN KEY (crm_id) REFERENCES public.comercial_crm(id) ON DELETE CASCADE;


--
-- TOC entry 5053 (class 2606 OID 35650)
-- Name: comercial_negocio comercial_negocio_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio
    ADD CONSTRAINT comercial_negocio_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5054 (class 2606 OID 35680)
-- Name: comercial_negocio comercial_negocio_etapa_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio
    ADD CONSTRAINT comercial_negocio_etapa_fk FOREIGN KEY (etapa_id, crm_id) REFERENCES public.comercial_etapa(id, crm_id);


--
-- TOC entry 5055 (class 2606 OID 35670)
-- Name: comercial_negocio comercial_negocio_forma_pagamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio
    ADD CONSTRAINT comercial_negocio_forma_pagamento_id_fkey FOREIGN KEY (forma_pagamento_id) REFERENCES public.comercial_forma_pagamento(id);


--
-- TOC entry 5056 (class 2606 OID 35675)
-- Name: comercial_negocio comercial_negocio_motivo_perda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio
    ADD CONSTRAINT comercial_negocio_motivo_perda_id_fkey FOREIGN KEY (motivo_perda_id) REFERENCES public.comercial_motivo_perda(id);


--
-- TOC entry 5070 (class 2606 OID 35853)
-- Name: comercial_negocio_movimentacao comercial_negocio_movimentacao_etapa_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_movimentacao
    ADD CONSTRAINT comercial_negocio_movimentacao_etapa_destino_id_fkey FOREIGN KEY (etapa_destino_id) REFERENCES public.comercial_etapa(id);


--
-- TOC entry 5071 (class 2606 OID 35848)
-- Name: comercial_negocio_movimentacao comercial_negocio_movimentacao_etapa_origem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_movimentacao
    ADD CONSTRAINT comercial_negocio_movimentacao_etapa_origem_id_fkey FOREIGN KEY (etapa_origem_id) REFERENCES public.comercial_etapa(id);


--
-- TOC entry 5072 (class 2606 OID 35838)
-- Name: comercial_negocio_movimentacao comercial_negocio_movimentacao_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_movimentacao
    ADD CONSTRAINT comercial_negocio_movimentacao_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.comercial_negocio(id) ON DELETE CASCADE;


--
-- TOC entry 5073 (class 2606 OID 35843)
-- Name: comercial_negocio_movimentacao comercial_negocio_movimentacao_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_movimentacao
    ADD CONSTRAINT comercial_negocio_movimentacao_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5062 (class 2606 OID 35771)
-- Name: comercial_negocio_produto comercial_negocio_produto_comercial_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_produto
    ADD CONSTRAINT comercial_negocio_produto_comercial_produto_id_fkey FOREIGN KEY (comercial_produto_id) REFERENCES public.comercial_produto(id);


--
-- TOC entry 5063 (class 2606 OID 35766)
-- Name: comercial_negocio_produto comercial_negocio_produto_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_produto
    ADD CONSTRAINT comercial_negocio_produto_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.comercial_negocio(id) ON DELETE CASCADE;


--
-- TOC entry 5057 (class 2606 OID 35665)
-- Name: comercial_negocio comercial_negocio_responsavel_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio
    ADD CONSTRAINT comercial_negocio_responsavel_usuario_id_fkey FOREIGN KEY (responsavel_usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5059 (class 2606 OID 35705)
-- Name: comercial_negocio_tag comercial_negocio_tag_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_tag
    ADD CONSTRAINT comercial_negocio_tag_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.comercial_negocio(id) ON DELETE CASCADE;


--
-- TOC entry 5060 (class 2606 OID 35710)
-- Name: comercial_negocio_tag comercial_negocio_tag_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_negocio_tag
    ADD CONSTRAINT comercial_negocio_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.comercial_tag(id) ON DELETE CASCADE;


--
-- TOC entry 5160 (class 2606 OID 44829)
-- Name: comercial_produto_documento comercial_produto_documento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_produto_documento
    ADD CONSTRAINT comercial_produto_documento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5161 (class 2606 OID 44834)
-- Name: comercial_produto_documento comercial_produto_documento_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_produto_documento
    ADD CONSTRAINT comercial_produto_documento_produto_id_fkey FOREIGN KEY (comercial_produto_id) REFERENCES public.comercial_produto(id) ON DELETE CASCADE;


--
-- TOC entry 5061 (class 2606 OID 35749)
-- Name: comercial_produto comercial_produto_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_produto
    ADD CONSTRAINT comercial_produto_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5156 (class 2606 OID 44497)
-- Name: comercial_produto_imagem comercial_produto_imagem_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_produto_imagem
    ADD CONSTRAINT comercial_produto_imagem_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5157 (class 2606 OID 44492)
-- Name: comercial_produto_imagem comercial_produto_imagem_produto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_produto_imagem
    ADD CONSTRAINT comercial_produto_imagem_produto_fkey FOREIGN KEY (comercial_produto_id) REFERENCES public.comercial_produto(id) ON DELETE CASCADE;


--
-- TOC entry 5058 (class 2606 OID 35695)
-- Name: comercial_tag comercial_tag_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_tag
    ADD CONSTRAINT comercial_tag_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5064 (class 2606 OID 35784)
-- Name: comercial_tipo_interacao comercial_tipo_interacao_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_tipo_interacao
    ADD CONSTRAINT comercial_tipo_interacao_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5041 (class 2606 OID 34509)
-- Name: day_off day_off_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_off
    ADD CONSTRAINT day_off_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5199 (class 2606 OID 80599)
-- Name: developer_webhook developer_webhook_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.developer_webhook
    ADD CONSTRAINT developer_webhook_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5200 (class 2606 OID 80713)
-- Name: developer_webhook_history developer_webhook_history_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.developer_webhook_history
    ADD CONSTRAINT developer_webhook_history_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5201 (class 2606 OID 80718)
-- Name: developer_webhook_history developer_webhook_history_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.developer_webhook_history
    ADD CONSTRAINT developer_webhook_history_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.developer_webhook(id) ON DELETE CASCADE;


--
-- TOC entry 5015 (class 2606 OID 28833)
-- Name: empresa_assinatura empresa_assinatura_assinatura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_assinatura
    ADD CONSTRAINT empresa_assinatura_assinatura_id_fkey FOREIGN KEY (assinatura_id) REFERENCES public.assinatura(id);


--
-- TOC entry 5020 (class 2606 OID 63745)
-- Name: empresa empresa_atendimento_fila_ultimo_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_atendimento_fila_ultimo_usuario_id_fkey FOREIGN KEY (atendimento_fila_ultimo_usuario_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5159 (class 2606 OID 44817)
-- Name: empresa_galeria_documento empresa_galeria_documento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_galeria_documento
    ADD CONSTRAINT empresa_galeria_documento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5158 (class 2606 OID 44770)
-- Name: empresa_galeria_imagem empresa_galeria_imagem_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_galeria_imagem
    ADD CONSTRAINT empresa_galeria_imagem_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5169 (class 2606 OID 45665)
-- Name: empresa_google_ads_accounts empresa_google_ads_accounts_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_google_ads_accounts
    ADD CONSTRAINT empresa_google_ads_accounts_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5202 (class 2606 OID 117289)
-- Name: empresa_hotmart_integracao empresa_hotmart_integracao_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_hotmart_integracao
    ADD CONSTRAINT empresa_hotmart_integracao_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5206 (class 2606 OID 117344)
-- Name: empresa_hotmart_produto_map empresa_hotmart_produto_map_comercial_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_hotmart_produto_map
    ADD CONSTRAINT empresa_hotmart_produto_map_comercial_produto_id_fkey FOREIGN KEY (comercial_produto_id) REFERENCES public.comercial_produto(id) ON DELETE CASCADE;


--
-- TOC entry 5207 (class 2606 OID 117339)
-- Name: empresa_hotmart_produto_map empresa_hotmart_produto_map_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_hotmart_produto_map
    ADD CONSTRAINT empresa_hotmart_produto_map_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5164 (class 2606 OID 44885)
-- Name: empresa_meta_ads_field_mapping empresa_meta_ads_field_mapping_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_meta_ads_field_mapping
    ADD CONSTRAINT empresa_meta_ads_field_mapping_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5168 (class 2606 OID 45639)
-- Name: empresa_tiktok_accounts empresa_tiktok_accounts_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_tiktok_accounts
    ADD CONSTRAINT empresa_tiktok_accounts_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5040 (class 2606 OID 34481)
-- Name: feriado feriado_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feriado
    ADD CONSTRAINT feriado_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5135 (class 2606 OID 40498)
-- Name: financeiro_alerta_config financeiro_alerta_config_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta_config
    ADD CONSTRAINT financeiro_alerta_config_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5136 (class 2606 OID 40517)
-- Name: financeiro_alerta financeiro_alerta_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta
    ADD CONSTRAINT financeiro_alerta_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5137 (class 2606 OID 40532)
-- Name: financeiro_alerta financeiro_alerta_lido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta
    ADD CONSTRAINT financeiro_alerta_lido_por_fkey FOREIGN KEY (lido_por) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5138 (class 2606 OID 40537)
-- Name: financeiro_alerta financeiro_alerta_resolvido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta
    ADD CONSTRAINT financeiro_alerta_resolvido_por_fkey FOREIGN KEY (resolvido_por) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5139 (class 2606 OID 40527)
-- Name: financeiro_alerta financeiro_alerta_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta
    ADD CONSTRAINT financeiro_alerta_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.financeiro_alerta_status_tipo(id);


--
-- TOC entry 5140 (class 2606 OID 40522)
-- Name: financeiro_alerta financeiro_alerta_tipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_alerta
    ADD CONSTRAINT financeiro_alerta_tipo_id_fkey FOREIGN KEY (tipo_id) REFERENCES public.financeiro_alerta_tipo(id);


--
-- TOC entry 5141 (class 2606 OID 40786)
-- Name: financeiro_assinatura_empresa financeiro_assinatura_empresa_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_assinatura_empresa
    ADD CONSTRAINT financeiro_assinatura_empresa_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.financeiro_categoria(id) ON DELETE SET NULL;


--
-- TOC entry 5142 (class 2606 OID 40791)
-- Name: financeiro_assinatura_empresa financeiro_assinatura_empresa_conta_financeira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_assinatura_empresa
    ADD CONSTRAINT financeiro_assinatura_empresa_conta_financeira_id_fkey FOREIGN KEY (conta_financeira_id) REFERENCES public.financeiro_conta_financeira(id) ON DELETE SET NULL;


--
-- TOC entry 5143 (class 2606 OID 40796)
-- Name: financeiro_assinatura_empresa financeiro_assinatura_empresa_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_assinatura_empresa
    ADD CONSTRAINT financeiro_assinatura_empresa_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5144 (class 2606 OID 40781)
-- Name: financeiro_assinatura_empresa financeiro_assinatura_empresa_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_assinatura_empresa
    ADD CONSTRAINT financeiro_assinatura_empresa_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5086 (class 2606 OID 40079)
-- Name: financeiro_categoria financeiro_categoria_categoria_pai_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_categoria
    ADD CONSTRAINT financeiro_categoria_categoria_pai_id_fkey FOREIGN KEY (categoria_pai_id) REFERENCES public.financeiro_categoria(id) ON DELETE SET NULL;


--
-- TOC entry 5087 (class 2606 OID 40069)
-- Name: financeiro_categoria financeiro_categoria_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_categoria
    ADD CONSTRAINT financeiro_categoria_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5088 (class 2606 OID 40074)
-- Name: financeiro_categoria financeiro_categoria_tipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_categoria
    ADD CONSTRAINT financeiro_categoria_tipo_id_fkey FOREIGN KEY (tipo_id) REFERENCES public.financeiro_categoria_tipo(id);


--
-- TOC entry 5089 (class 2606 OID 40097)
-- Name: financeiro_centro_custo financeiro_centro_custo_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_centro_custo
    ADD CONSTRAINT financeiro_centro_custo_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5130 (class 2606 OID 40465)
-- Name: financeiro_comissao_lancamento financeiro_comissao_lancamento_comercial_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_comissao_lancamento
    ADD CONSTRAINT financeiro_comissao_lancamento_comercial_negocio_id_fkey FOREIGN KEY (comercial_negocio_id) REFERENCES public.comercial_negocio(id) ON DELETE SET NULL;


--
-- TOC entry 5131 (class 2606 OID 40470)
-- Name: financeiro_comissao_lancamento financeiro_comissao_lancamento_conta_receber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_comissao_lancamento
    ADD CONSTRAINT financeiro_comissao_lancamento_conta_receber_id_fkey FOREIGN KEY (conta_receber_id) REFERENCES public.financeiro_conta_receber(id) ON DELETE SET NULL;


--
-- TOC entry 5132 (class 2606 OID 40455)
-- Name: financeiro_comissao_lancamento financeiro_comissao_lancamento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_comissao_lancamento
    ADD CONSTRAINT financeiro_comissao_lancamento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5133 (class 2606 OID 40475)
-- Name: financeiro_comissao_lancamento financeiro_comissao_lancamento_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_comissao_lancamento
    ADD CONSTRAINT financeiro_comissao_lancamento_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.financeiro_status_titulo_tipo(id);


--
-- TOC entry 5134 (class 2606 OID 40460)
-- Name: financeiro_comissao_lancamento financeiro_comissao_lancamento_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_comissao_lancamento
    ADD CONSTRAINT financeiro_comissao_lancamento_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- TOC entry 5090 (class 2606 OID 40117)
-- Name: financeiro_conta_financeira financeiro_conta_financeira_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_financeira
    ADD CONSTRAINT financeiro_conta_financeira_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5092 (class 2606 OID 40168)
-- Name: financeiro_conta_pagar financeiro_conta_pagar_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_pagar
    ADD CONSTRAINT financeiro_conta_pagar_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.financeiro_categoria(id) ON DELETE SET NULL;


--
-- TOC entry 5093 (class 2606 OID 40173)
-- Name: financeiro_conta_pagar financeiro_conta_pagar_centro_custo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_pagar
    ADD CONSTRAINT financeiro_conta_pagar_centro_custo_id_fkey FOREIGN KEY (centro_custo_id) REFERENCES public.financeiro_centro_custo(id) ON DELETE SET NULL;


--
-- TOC entry 5094 (class 2606 OID 40178)
-- Name: financeiro_conta_pagar financeiro_conta_pagar_conta_financeira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_pagar
    ADD CONSTRAINT financeiro_conta_pagar_conta_financeira_id_fkey FOREIGN KEY (conta_financeira_id) REFERENCES public.financeiro_conta_financeira(id) ON DELETE SET NULL;


--
-- TOC entry 5095 (class 2606 OID 40183)
-- Name: financeiro_conta_pagar financeiro_conta_pagar_contraparte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_pagar
    ADD CONSTRAINT financeiro_conta_pagar_contraparte_id_fkey FOREIGN KEY (contraparte_id) REFERENCES public.financeiro_contraparte(id) ON DELETE SET NULL;


--
-- TOC entry 5096 (class 2606 OID 40198)
-- Name: financeiro_conta_pagar financeiro_conta_pagar_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_pagar
    ADD CONSTRAINT financeiro_conta_pagar_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5097 (class 2606 OID 40163)
-- Name: financeiro_conta_pagar financeiro_conta_pagar_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_pagar
    ADD CONSTRAINT financeiro_conta_pagar_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5098 (class 2606 OID 40188)
-- Name: financeiro_conta_pagar financeiro_conta_pagar_recorrencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_pagar
    ADD CONSTRAINT financeiro_conta_pagar_recorrencia_id_fkey FOREIGN KEY (recorrencia_id) REFERENCES public.financeiro_recorrencia_tipo(id);


--
-- TOC entry 5099 (class 2606 OID 40193)
-- Name: financeiro_conta_pagar financeiro_conta_pagar_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_pagar
    ADD CONSTRAINT financeiro_conta_pagar_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.financeiro_status_titulo_tipo(id);


--
-- TOC entry 5105 (class 2606 OID 40280)
-- Name: financeiro_conta_receber financeiro_conta_receber_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber
    ADD CONSTRAINT financeiro_conta_receber_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.financeiro_categoria(id) ON DELETE SET NULL;


--
-- TOC entry 5106 (class 2606 OID 40285)
-- Name: financeiro_conta_receber financeiro_conta_receber_centro_custo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber
    ADD CONSTRAINT financeiro_conta_receber_centro_custo_id_fkey FOREIGN KEY (centro_custo_id) REFERENCES public.financeiro_centro_custo(id) ON DELETE SET NULL;


--
-- TOC entry 5107 (class 2606 OID 40270)
-- Name: financeiro_conta_receber financeiro_conta_receber_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber
    ADD CONSTRAINT financeiro_conta_receber_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id) ON DELETE SET NULL;


--
-- TOC entry 5108 (class 2606 OID 40275)
-- Name: financeiro_conta_receber financeiro_conta_receber_comercial_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber
    ADD CONSTRAINT financeiro_conta_receber_comercial_negocio_id_fkey FOREIGN KEY (comercial_negocio_id) REFERENCES public.comercial_negocio(id) ON DELETE SET NULL;


--
-- TOC entry 5109 (class 2606 OID 40290)
-- Name: financeiro_conta_receber financeiro_conta_receber_conta_financeira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber
    ADD CONSTRAINT financeiro_conta_receber_conta_financeira_id_fkey FOREIGN KEY (conta_financeira_id) REFERENCES public.financeiro_conta_financeira(id) ON DELETE SET NULL;


--
-- TOC entry 5110 (class 2606 OID 40295)
-- Name: financeiro_conta_receber financeiro_conta_receber_contraparte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber
    ADD CONSTRAINT financeiro_conta_receber_contraparte_id_fkey FOREIGN KEY (contraparte_id) REFERENCES public.financeiro_contraparte(id) ON DELETE SET NULL;


--
-- TOC entry 5111 (class 2606 OID 40310)
-- Name: financeiro_conta_receber financeiro_conta_receber_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber
    ADD CONSTRAINT financeiro_conta_receber_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5112 (class 2606 OID 40265)
-- Name: financeiro_conta_receber financeiro_conta_receber_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber
    ADD CONSTRAINT financeiro_conta_receber_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5113 (class 2606 OID 40300)
-- Name: financeiro_conta_receber financeiro_conta_receber_recorrencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber
    ADD CONSTRAINT financeiro_conta_receber_recorrencia_id_fkey FOREIGN KEY (recorrencia_id) REFERENCES public.financeiro_recorrencia_tipo(id);


--
-- TOC entry 5114 (class 2606 OID 40305)
-- Name: financeiro_conta_receber financeiro_conta_receber_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_conta_receber
    ADD CONSTRAINT financeiro_conta_receber_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.financeiro_status_titulo_tipo(id);


--
-- TOC entry 5091 (class 2606 OID 40134)
-- Name: financeiro_contraparte financeiro_contraparte_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_contraparte
    ADD CONSTRAINT financeiro_contraparte_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5120 (class 2606 OID 40394)
-- Name: financeiro_lancamento financeiro_lancamento_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamento
    ADD CONSTRAINT financeiro_lancamento_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.financeiro_categoria(id) ON DELETE SET NULL;


--
-- TOC entry 5121 (class 2606 OID 40399)
-- Name: financeiro_lancamento financeiro_lancamento_centro_custo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamento
    ADD CONSTRAINT financeiro_lancamento_centro_custo_id_fkey FOREIGN KEY (centro_custo_id) REFERENCES public.financeiro_centro_custo(id) ON DELETE SET NULL;


--
-- TOC entry 5122 (class 2606 OID 40389)
-- Name: financeiro_lancamento financeiro_lancamento_conta_financeira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamento
    ADD CONSTRAINT financeiro_lancamento_conta_financeira_id_fkey FOREIGN KEY (conta_financeira_id) REFERENCES public.financeiro_conta_financeira(id) ON DELETE SET NULL;


--
-- TOC entry 5123 (class 2606 OID 40404)
-- Name: financeiro_lancamento financeiro_lancamento_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamento
    ADD CONSTRAINT financeiro_lancamento_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5124 (class 2606 OID 40369)
-- Name: financeiro_lancamento financeiro_lancamento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamento
    ADD CONSTRAINT financeiro_lancamento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5125 (class 2606 OID 40374)
-- Name: financeiro_lancamento financeiro_lancamento_natureza_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamento
    ADD CONSTRAINT financeiro_lancamento_natureza_id_fkey FOREIGN KEY (natureza_id) REFERENCES public.financeiro_natureza_lancamento_tipo(id);


--
-- TOC entry 5126 (class 2606 OID 40384)
-- Name: financeiro_lancamento financeiro_lancamento_origem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamento
    ADD CONSTRAINT financeiro_lancamento_origem_id_fkey FOREIGN KEY (origem_id) REFERENCES public.financeiro_origem_lancamento_tipo(id);


--
-- TOC entry 5127 (class 2606 OID 40379)
-- Name: financeiro_lancamento financeiro_lancamento_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamento
    ADD CONSTRAINT financeiro_lancamento_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.financeiro_status_lancamento_tipo(id);


--
-- TOC entry 5128 (class 2606 OID 40428)
-- Name: financeiro_meta_usuario financeiro_meta_usuario_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_meta_usuario
    ADD CONSTRAINT financeiro_meta_usuario_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5129 (class 2606 OID 40433)
-- Name: financeiro_meta_usuario financeiro_meta_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_meta_usuario
    ADD CONSTRAINT financeiro_meta_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- TOC entry 5100 (class 2606 OID 40230)
-- Name: financeiro_pagamento_pagar financeiro_pagamento_pagar_conta_financeira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_pagamento_pagar
    ADD CONSTRAINT financeiro_pagamento_pagar_conta_financeira_id_fkey FOREIGN KEY (conta_financeira_id) REFERENCES public.financeiro_conta_financeira(id) ON DELETE SET NULL;


--
-- TOC entry 5101 (class 2606 OID 40220)
-- Name: financeiro_pagamento_pagar financeiro_pagamento_pagar_conta_pagar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_pagamento_pagar
    ADD CONSTRAINT financeiro_pagamento_pagar_conta_pagar_id_fkey FOREIGN KEY (conta_pagar_id) REFERENCES public.financeiro_conta_pagar(id) ON DELETE CASCADE;


--
-- TOC entry 5102 (class 2606 OID 40235)
-- Name: financeiro_pagamento_pagar financeiro_pagamento_pagar_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_pagamento_pagar
    ADD CONSTRAINT financeiro_pagamento_pagar_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5103 (class 2606 OID 40225)
-- Name: financeiro_pagamento_pagar financeiro_pagamento_pagar_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_pagamento_pagar
    ADD CONSTRAINT financeiro_pagamento_pagar_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5104 (class 2606 OID 40543)
-- Name: financeiro_pagamento_pagar financeiro_pagamento_pagar_lancamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_pagamento_pagar
    ADD CONSTRAINT financeiro_pagamento_pagar_lancamento_id_fkey FOREIGN KEY (lancamento_id) REFERENCES public.financeiro_lancamento(id) ON DELETE SET NULL;


--
-- TOC entry 5115 (class 2606 OID 40342)
-- Name: financeiro_recebimento financeiro_recebimento_conta_financeira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_recebimento
    ADD CONSTRAINT financeiro_recebimento_conta_financeira_id_fkey FOREIGN KEY (conta_financeira_id) REFERENCES public.financeiro_conta_financeira(id) ON DELETE SET NULL;


--
-- TOC entry 5116 (class 2606 OID 40332)
-- Name: financeiro_recebimento financeiro_recebimento_conta_receber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_recebimento
    ADD CONSTRAINT financeiro_recebimento_conta_receber_id_fkey FOREIGN KEY (conta_receber_id) REFERENCES public.financeiro_conta_receber(id) ON DELETE CASCADE;


--
-- TOC entry 5117 (class 2606 OID 40347)
-- Name: financeiro_recebimento financeiro_recebimento_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_recebimento
    ADD CONSTRAINT financeiro_recebimento_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5118 (class 2606 OID 40337)
-- Name: financeiro_recebimento financeiro_recebimento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_recebimento
    ADD CONSTRAINT financeiro_recebimento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5119 (class 2606 OID 40548)
-- Name: financeiro_recebimento financeiro_recebimento_lancamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_recebimento
    ADD CONSTRAINT financeiro_recebimento_lancamento_id_fkey FOREIGN KEY (lancamento_id) REFERENCES public.financeiro_lancamento(id) ON DELETE SET NULL;


--
-- TOC entry 5029 (class 2606 OID 27325)
-- Name: produto_categoria fk_categoria; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_categoria
    ADD CONSTRAINT fk_categoria FOREIGN KEY (categoria_id) REFERENCES public.categoria(id) ON DELETE CASCADE;


--
-- TOC entry 5166 (class 2606 OID 45011)
-- Name: comercial_orcamento_item fk_comercial_orcamento_item_orcamento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_orcamento_item
    ADD CONSTRAINT fk_comercial_orcamento_item_orcamento FOREIGN KEY (orcamento_id) REFERENCES public.comercial_orcamento(id);


--
-- TOC entry 5167 (class 2606 OID 45016)
-- Name: comercial_orcamento_item fk_comercial_orcamento_item_produto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_orcamento_item
    ADD CONSTRAINT fk_comercial_orcamento_item_produto FOREIGN KEY (comercial_produto_id) REFERENCES public.comercial_produto(id);


--
-- TOC entry 5165 (class 2606 OID 45006)
-- Name: comercial_orcamento fk_comercial_orcamento_negocio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_orcamento
    ADD CONSTRAINT fk_comercial_orcamento_negocio FOREIGN KEY (negocio_id) REFERENCES public.comercial_negocio(id);


--
-- TOC entry 5031 (class 2606 OID 27021)
-- Name: produto_estoque fk_produto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_estoque
    ADD CONSTRAINT fk_produto FOREIGN KEY (produto_id) REFERENCES public.produto(id) ON DELETE CASCADE;


--
-- TOC entry 5030 (class 2606 OID 28012)
-- Name: produto_categoria fk_produto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_categoria
    ADD CONSTRAINT fk_produto FOREIGN KEY (produto_id) REFERENCES public.produto(id) ON DELETE CASCADE;


--
-- TOC entry 5032 (class 2606 OID 28857)
-- Name: produto_entrada fk_produto_entrada_entrada; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_entrada
    ADD CONSTRAINT fk_produto_entrada_entrada FOREIGN KEY (entrada_id) REFERENCES public.entrada(id) ON DELETE CASCADE;


--
-- TOC entry 5033 (class 2606 OID 34389)
-- Name: horario_trabalho_dia horario_trabalho_dia_horario_trabalho_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_trabalho_dia
    ADD CONSTRAINT horario_trabalho_dia_horario_trabalho_id_fkey FOREIGN KEY (horario_trabalho_id) REFERENCES public.horario_trabalho(id) ON DELETE CASCADE;


--
-- TOC entry 5203 (class 2606 OID 117321)
-- Name: hotmart_evento hotmart_evento_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotmart_evento
    ADD CONSTRAINT hotmart_evento_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id) ON DELETE SET NULL;


--
-- TOC entry 5204 (class 2606 OID 117311)
-- Name: hotmart_evento hotmart_evento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotmart_evento
    ADD CONSTRAINT hotmart_evento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5205 (class 2606 OID 117316)
-- Name: hotmart_evento hotmart_evento_integracao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotmart_evento
    ADD CONSTRAINT hotmart_evento_integracao_id_fkey FOREIGN KEY (integracao_id) REFERENCES public.empresa_hotmart_integracao(id) ON DELETE CASCADE;


--
-- TOC entry 5038 (class 2606 OID 34452)
-- Name: justificativa_anexo justificativa_anexo_justificativa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativa_anexo
    ADD CONSTRAINT justificativa_anexo_justificativa_id_fkey FOREIGN KEY (justificativa_id) REFERENCES public.justificativa(id) ON DELETE CASCADE;


--
-- TOC entry 5037 (class 2606 OID 34437)
-- Name: justificativa justificativa_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativa
    ADD CONSTRAINT justificativa_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5021 (class 2606 OID 26892)
-- Name: mensagens_rapidas mensagens_rapidas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_rapidas
    ADD CONSTRAINT mensagens_rapidas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5022 (class 2606 OID 44822)
-- Name: mensagens_rapidas mensagens_rapidas_galeria_documento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_rapidas
    ADD CONSTRAINT mensagens_rapidas_galeria_documento_id_fkey FOREIGN KEY (galeria_documento_id) REFERENCES public.empresa_galeria_documento(id);


--
-- TOC entry 5023 (class 2606 OID 44775)
-- Name: mensagens_rapidas mensagens_rapidas_galeria_imagem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_rapidas
    ADD CONSTRAINT mensagens_rapidas_galeria_imagem_id_fkey FOREIGN KEY (galeria_imagem_id) REFERENCES public.empresa_galeria_imagem(id);


--
-- TOC entry 5075 (class 2606 OID 39676)
-- Name: nps_pergunta nps_pergunta_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_pergunta
    ADD CONSTRAINT nps_pergunta_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5076 (class 2606 OID 39700)
-- Name: nps_resposta nps_resposta_atendimento_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_resposta
    ADD CONSTRAINT nps_resposta_atendimento_fkey FOREIGN KEY (atendimento_id) REFERENCES public.cliente_conversa_whats(id) ON DELETE CASCADE;


--
-- TOC entry 5077 (class 2606 OID 39695)
-- Name: nps_resposta nps_resposta_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_resposta
    ADD CONSTRAINT nps_resposta_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5078 (class 2606 OID 39705)
-- Name: nps_resposta nps_resposta_pergunta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_resposta
    ADD CONSTRAINT nps_resposta_pergunta_fkey FOREIGN KEY (pergunta_id) REFERENCES public.nps_pergunta(id) ON DELETE RESTRICT;


--
-- TOC entry 5024 (class 2606 OID 26897)
-- Name: perfil perfil_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfil
    ADD CONSTRAINT perfil_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5042 (class 2606 OID 34522)
-- Name: periodo_ferias periodo_ferias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodo_ferias
    ADD CONSTRAINT periodo_ferias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5036 (class 2606 OID 34421)
-- Name: registro_ponto registro_ponto_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_ponto
    ADD CONSTRAINT registro_ponto_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5025 (class 2606 OID 26902)
-- Name: setor setor_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setor
    ADD CONSTRAINT setor_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5208 (class 2606 OID 145649)
-- Name: sistema_novidade sistema_novidade_atualizado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_novidade
    ADD CONSTRAINT sistema_novidade_atualizado_por_usuario_id_fkey FOREIGN KEY (atualizado_por_usuario_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5209 (class 2606 OID 145644)
-- Name: sistema_novidade sistema_novidade_criado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_novidade
    ADD CONSTRAINT sistema_novidade_criado_por_usuario_id_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- TOC entry 5210 (class 2606 OID 145639)
-- Name: sistema_novidade sistema_novidade_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_novidade
    ADD CONSTRAINT sistema_novidade_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5211 (class 2606 OID 145665)
-- Name: sistema_novidade_usuario sistema_novidade_usuario_novidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_novidade_usuario
    ADD CONSTRAINT sistema_novidade_usuario_novidade_id_fkey FOREIGN KEY (novidade_id) REFERENCES public.sistema_novidade(id) ON DELETE CASCADE;


--
-- TOC entry 5212 (class 2606 OID 145670)
-- Name: sistema_novidade_usuario sistema_novidade_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_novidade_usuario
    ADD CONSTRAINT sistema_novidade_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- TOC entry 5043 (class 2606 OID 34543)
-- Name: solicitacao_ferias solicitacao_ferias_periodo_ferias_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitacao_ferias
    ADD CONSTRAINT solicitacao_ferias_periodo_ferias_id_fkey FOREIGN KEY (periodo_ferias_id) REFERENCES public.periodo_ferias(id);


--
-- TOC entry 5044 (class 2606 OID 34538)
-- Name: solicitacao_ferias solicitacao_ferias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitacao_ferias
    ADD CONSTRAINT solicitacao_ferias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5026 (class 2606 OID 26907)
-- Name: tag tag_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5027 (class 2606 OID 26912)
-- Name: usuario usuario_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- TOC entry 5028 (class 2606 OID 44569)
-- Name: usuario usuario_filial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_filial_id_fkey FOREIGN KEY (filial_id) REFERENCES public.empresa_filial(id) ON DELETE SET NULL;


--
-- TOC entry 5034 (class 2606 OID 34407)
-- Name: usuario_horario usuario_horario_horario_trabalho_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_horario
    ADD CONSTRAINT usuario_horario_horario_trabalho_id_fkey FOREIGN KEY (horario_trabalho_id) REFERENCES public.horario_trabalho(id);


--
-- TOC entry 5035 (class 2606 OID 34402)
-- Name: usuario_horario usuario_horario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_horario
    ADD CONSTRAINT usuario_horario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- TOC entry 5154 (class 2606 OID 43258)
-- Name: usuario_meta_numero usuario_meta_numero_empresa_meta_param_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_meta_numero
    ADD CONSTRAINT usuario_meta_numero_empresa_meta_param_id_fkey FOREIGN KEY (empresa_meta_param_id) REFERENCES public.empresa_meta_parans(id) ON DELETE CASCADE;


--
-- TOC entry 5155 (class 2606 OID 43253)
-- Name: usuario_meta_numero usuario_meta_numero_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_meta_numero
    ADD CONSTRAINT usuario_meta_numero_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- TOC entry 5074 (class 2606 OID 51861)
-- Name: whatsapp_auto_message whatsapp_auto_message_empresa_meta_param_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_auto_message
    ADD CONSTRAINT whatsapp_auto_message_empresa_meta_param_id_fkey FOREIGN KEY (empresa_meta_param_id) REFERENCES public.empresa_meta_parans(id) ON DELETE SET NULL;


--
-- TOC entry 5173 (class 2606 OID 48277)
-- Name: whatsapp_template_disparo_item whatsapp_template_disparo_item_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_disparo_item
    ADD CONSTRAINT whatsapp_template_disparo_item_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id) ON DELETE SET NULL;


--
-- TOC entry 5174 (class 2606 OID 48262)
-- Name: whatsapp_template_disparo_item whatsapp_template_disparo_item_disparo_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_disparo_item
    ADD CONSTRAINT whatsapp_template_disparo_item_disparo_lote_id_fkey FOREIGN KEY (disparo_lote_id) REFERENCES public.whatsapp_template_disparo_lote(id) ON DELETE CASCADE;


--
-- TOC entry 5175 (class 2606 OID 48267)
-- Name: whatsapp_template_disparo_item whatsapp_template_disparo_item_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_disparo_item
    ADD CONSTRAINT whatsapp_template_disparo_item_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5176 (class 2606 OID 48272)
-- Name: whatsapp_template_disparo_item whatsapp_template_disparo_item_empresa_meta_param_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_disparo_item
    ADD CONSTRAINT whatsapp_template_disparo_item_empresa_meta_param_id_fkey FOREIGN KEY (empresa_meta_param_id) REFERENCES public.empresa_meta_parans(id) ON DELETE SET NULL;


--
-- TOC entry 5170 (class 2606 OID 48231)
-- Name: whatsapp_template_disparo_lote whatsapp_template_disparo_lote_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_disparo_lote
    ADD CONSTRAINT whatsapp_template_disparo_lote_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- TOC entry 5171 (class 2606 OID 48236)
-- Name: whatsapp_template_disparo_lote whatsapp_template_disparo_lote_empresa_meta_param_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_disparo_lote
    ADD CONSTRAINT whatsapp_template_disparo_lote_empresa_meta_param_id_fkey FOREIGN KEY (empresa_meta_param_id) REFERENCES public.empresa_meta_parans(id) ON DELETE SET NULL;


--
-- TOC entry 5172 (class 2606 OID 48241)
-- Name: whatsapp_template_disparo_lote whatsapp_template_disparo_lote_lista_transmissao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_disparo_lote
    ADD CONSTRAINT whatsapp_template_disparo_lote_lista_transmissao_id_fkey FOREIGN KEY (lista_transmissao_id) REFERENCES public.cliente_lista_transmissao(id) ON DELETE SET NULL;


--
-- TOC entry 5180 (class 2606 OID 68139)
-- Name: whatsapp_template_followup_venda_envio whatsapp_template_followup_venda_env_empresa_meta_param_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_followup_venda_envio
    ADD CONSTRAINT whatsapp_template_followup_venda_env_empresa_meta_param_id_fkey FOREIGN KEY (empresa_meta_param_id) REFERENCES public.empresa_meta_parans(id) ON DELETE CASCADE;


--
-- TOC entry 5181 (class 2606 OID 68149)
-- Name: whatsapp_template_followup_venda_envio whatsapp_template_followup_venda_envi_comercial_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_followup_venda_envio
    ADD CONSTRAINT whatsapp_template_followup_venda_envi_comercial_negocio_id_fkey FOREIGN KEY (comercial_negocio_id) REFERENCES public.comercial_negocio(id) ON DELETE CASCADE;


--
-- TOC entry 5182 (class 2606 OID 68144)
-- Name: whatsapp_template_followup_venda_envio whatsapp_template_followup_venda_envio_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_followup_venda_envio
    ADD CONSTRAINT whatsapp_template_followup_venda_envio_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id) ON DELETE SET NULL;


--
-- TOC entry 5183 (class 2606 OID 68154)
-- Name: whatsapp_template_followup_venda_envio whatsapp_template_followup_venda_envio_conversa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_followup_venda_envio
    ADD CONSTRAINT whatsapp_template_followup_venda_envio_conversa_id_fkey FOREIGN KEY (conversa_id) REFERENCES public.cliente_conversa_whats(id) ON DELETE SET NULL;


--
-- TOC entry 5184 (class 2606 OID 68134)
-- Name: whatsapp_template_followup_venda_envio whatsapp_template_followup_venda_envio_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_template_followup_venda_envio
    ADD CONSTRAINT whatsapp_template_followup_venda_envio_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


-- Completed on 2026-08-31 11:52:17

--
-- PostgreSQL database dump complete
--

