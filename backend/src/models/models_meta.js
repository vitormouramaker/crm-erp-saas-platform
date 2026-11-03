const models = {
    get_paramentros_whats: () => {
        return `
        select
            emp.id,
            emp.empresa_id,
            coalesce(e.nome_fantasia, e.razao_social) as empresa_nome,
            p.api_key as api_key,
            emp.meta_phone_number_id as numero,
            coalesce(emp.whatsapp_account_id, p.whatsapp_account_id) as whatsapp_account_id,
            emp.meta_phone_number_id as phone_number_id,
            emp.meta_business_id,
            emp.meta_business_name,
            emp.meta_business_manager_id,
            emp.meta_business_manager_name,
            emp.meta_waba_name,
            emp.meta_display_phone_number,
            emp.meta_verified_name,
            emp.meta_webhook_verify_token,
            emp.meta_webhook_url,
            emp.meta_graph_api_version,
            emp.meta_app_scoped_user_id,
            emp.meta_wa_id,
            emp.meta_access_token_type,
            emp.meta_token_expires_in,
            emp.meta_access_token_expires_at,
            emp.meta_last_embedded_signup_at,
            emp.meta_payload,
            emp.cor as meta_cor,
            coalesce(emp.ativo, true) as ativo
        from empresa_meta_parans emp
        left join empresa e on e.id = emp.empresa_id
        left join lateral (
            select p_inner.api_key, p_inner.whatsapp_account_id
            from parametros p_inner
            where p_inner.empresa_id = emp.empresa_id
            order by p_inner.id desc
            limit 1
        ) p on true
        where emp.empresa_id = $1
          and coalesce(emp.ativo, true) = true
        order by emp.meta_last_embedded_signup_at desc nulls last, emp.id desc
        limit 1
        `;
    },

    list_paramentros_whats_empresa: () => {
        return `
        select
            emp.id,
            emp.empresa_id,
            coalesce(e.nome_fantasia, e.razao_social) as empresa_nome,
            p.api_key as api_key,
            emp.meta_phone_number_id as numero,
            coalesce(emp.whatsapp_account_id, p.whatsapp_account_id) as whatsapp_account_id,
            emp.meta_phone_number_id as phone_number_id,
            emp.meta_business_id,
            emp.meta_business_name,
            emp.meta_business_manager_id,
            emp.meta_business_manager_name,
            emp.meta_waba_name,
            emp.meta_display_phone_number,
            emp.meta_verified_name,
            emp.meta_webhook_verify_token,
            emp.meta_webhook_url,
            emp.meta_graph_api_version,
            emp.meta_app_scoped_user_id,
            emp.meta_wa_id,
            emp.meta_access_token_type,
            emp.meta_token_expires_in,
            emp.meta_access_token_expires_at,
            emp.meta_last_embedded_signup_at,
            emp.meta_payload,
            emp.cor as meta_cor,
            coalesce(emp.ativo, true) as ativo
        from empresa_meta_parans emp
        left join empresa e on e.id = emp.empresa_id
        left join lateral (
            select p_inner.api_key, p_inner.whatsapp_account_id
            from parametros p_inner
            where p_inner.empresa_id = emp.empresa_id
            order by p_inner.id desc
            limit 1
        ) p on true
        where emp.empresa_id = $1
          and ($2::boolean = true or coalesce(emp.ativo, true) = true)
        order by
            coalesce(emp.ativo, true) desc,
            emp.meta_display_phone_number asc nulls last,
            emp.id desc
        `;
    },

    get_paramentros_whats_by_id: () => {
        return `
        select
            emp.id,
            emp.empresa_id,
            coalesce(e.nome_fantasia, e.razao_social) as empresa_nome,
            p.api_key as api_key,
            emp.meta_phone_number_id as numero,
            coalesce(emp.whatsapp_account_id, p.whatsapp_account_id) as whatsapp_account_id,
            emp.meta_phone_number_id as phone_number_id,
            emp.meta_business_id,
            emp.meta_business_name,
            emp.meta_business_manager_id,
            emp.meta_business_manager_name,
            emp.meta_waba_name,
            emp.meta_display_phone_number,
            emp.meta_verified_name,
            emp.meta_webhook_verify_token,
            emp.meta_webhook_url,
            emp.meta_graph_api_version,
            emp.meta_app_scoped_user_id,
            emp.meta_wa_id,
            emp.meta_access_token_type,
            emp.meta_token_expires_in,
            emp.meta_access_token_expires_at,
            emp.meta_last_embedded_signup_at,
            emp.meta_payload,
            emp.cor as meta_cor,
            coalesce(emp.ativo, true) as ativo
        from empresa_meta_parans emp
        left join empresa e on e.id = emp.empresa_id
        left join lateral (
            select p_inner.api_key, p_inner.whatsapp_account_id
            from parametros p_inner
            where p_inner.empresa_id = emp.empresa_id
            order by p_inner.id desc
            limit 1
        ) p on true
        where emp.id = $1
          and ($2::integer is null or emp.empresa_id = $2)
        limit 1
        `;
    },

    get_paramentros_whats_by_conversa_id: () => {
        return `
        select
            emp.id,
            emp.empresa_id,
            coalesce(e.nome_fantasia, e.razao_social) as empresa_nome,
            p.api_key as api_key,
            emp.meta_phone_number_id as numero,
            coalesce(emp.whatsapp_account_id, p.whatsapp_account_id) as whatsapp_account_id,
            emp.meta_phone_number_id as phone_number_id,
            emp.meta_business_id,
            emp.meta_business_name,
            emp.meta_business_manager_id,
            emp.meta_business_manager_name,
            emp.meta_waba_name,
            emp.meta_display_phone_number,
            emp.meta_verified_name,
            emp.meta_webhook_verify_token,
            emp.meta_webhook_url,
            emp.meta_graph_api_version,
            emp.meta_app_scoped_user_id,
            emp.meta_wa_id,
            emp.meta_access_token_type,
            emp.meta_token_expires_in,
            emp.meta_access_token_expires_at,
            emp.meta_last_embedded_signup_at,
            emp.meta_payload,
            emp.cor as meta_cor,
            coalesce(emp.ativo, true) as ativo
        from cliente_conversa_whats ccw
        left join lateral (
            select emp_inner.*
            from empresa_meta_parans emp_inner
            where (
                ccw.empresa_meta_param_id is not null
                and emp_inner.id = ccw.empresa_meta_param_id
            ) or (
                ccw.empresa_meta_param_id is null
                and emp_inner.empresa_id = ccw.empresa_id
                and coalesce(emp_inner.ativo, true) = true
            )
            order by
                case when emp_inner.id = ccw.empresa_meta_param_id then 0 else 1 end,
                emp_inner.meta_last_embedded_signup_at desc nulls last,
                emp_inner.id desc
            limit 1
        ) emp on true
        left join empresa e on e.id = ccw.empresa_id
        left join lateral (
            select p_inner.api_key, p_inner.whatsapp_account_id
            from parametros p_inner
            where p_inner.empresa_id = ccw.empresa_id
            order by p_inner.id desc
            limit 1
        ) p on true
        where ccw.id = $1
        limit 1
        `;
    },

    get_paramentros: () => {
        return `select * from parametros`;
    },

    get_paramentros_whats_by_identifiers: () => {
        return `
        select
            emp.id,
            emp.empresa_id,
            coalesce(e.nome_fantasia, e.razao_social) as empresa_nome,
            p.api_key as api_key,
            emp.meta_phone_number_id as numero,
            coalesce(emp.whatsapp_account_id, p.whatsapp_account_id) as whatsapp_account_id,
            emp.meta_phone_number_id as phone_number_id,
            emp.meta_business_id,
            emp.meta_business_name,
            emp.meta_business_manager_id,
            emp.meta_business_manager_name,
            emp.meta_waba_name,
            emp.meta_display_phone_number,
            emp.meta_verified_name,
            emp.meta_webhook_verify_token,
            emp.meta_webhook_url,
            emp.meta_graph_api_version,
            emp.meta_app_scoped_user_id,
            emp.meta_wa_id,
            emp.meta_access_token_type,
            emp.meta_token_expires_in,
            emp.meta_access_token_expires_at,
            emp.meta_last_embedded_signup_at,
            emp.meta_payload,
            coalesce(emp.ativo, true) as ativo
        from empresa_meta_parans emp
        left join empresa e on e.id = emp.empresa_id
        left join lateral (
            select p_inner.api_key, p_inner.whatsapp_account_id
            from parametros p_inner
            where p_inner.empresa_id = emp.empresa_id
            order by p_inner.id desc
            limit 1
        ) p on true
        where coalesce(emp.ativo, true) = true
          and (
            ($1::varchar is not null and emp.meta_phone_number_id = $1::varchar)
            or ($2::varchar is not null and emp.meta_wa_id = $2::varchar)
            or ($3::varchar is not null and emp.whatsapp_account_id = $3::varchar)
          )
        order by
            case
                when $1::varchar is not null and emp.meta_phone_number_id = $1::varchar then 0
                when $2::varchar is not null and emp.meta_wa_id = $2::varchar then 1
                when $3::varchar is not null and emp.whatsapp_account_id = $3::varchar then 2
                else 3
            end,
            emp.id desc
        limit 1
        `;
    },

    find_empresa_meta_parametros_by_match: () => {
        return `
        select
            id,
            empresa_id,
            meta_phone_number_id,
            meta_display_phone_number,
            whatsapp_account_id,
            coalesce(ativo, true) as ativo
        from empresa_meta_parans
        where empresa_id = $1
          and $2::varchar is not null
          and meta_phone_number_id = $2::varchar
        order by id desc
        limit 1
        `;
    },

    upsert_parametros_whats_global: () => {
        return `
        with updated as (
            update parametros
            set
                api_key = $2,
                whatsapp_account_id = coalesce($3, whatsapp_account_id)
            where empresa_id = $1
            returning id
        )
        insert into parametros (
            empresa_id,
            api_key,
            whatsapp_account_id
        )
        select
            $1,
            $2,
            $3
        where not exists (select 1 from updated)
        returning id
        `;
    },

    update_empresa_meta_parametros: () => {
        return `
        update empresa_meta_parans
        set
            whatsapp_account_id = $1,
            meta_phone_number_id = $2,
            meta_business_id = $3,
            meta_business_name = $4,
            meta_business_manager_id = $5,
            meta_business_manager_name = $6,
            meta_waba_name = $7,
            meta_display_phone_number = $8,
            meta_verified_name = $9,
            meta_webhook_verify_token = $10,
            meta_webhook_url = $11,
            meta_graph_api_version = $12,
            meta_app_scoped_user_id = $13,
            meta_wa_id = $14,
            meta_access_token_type = $15,
            meta_token_expires_in = $16,
            meta_access_token_expires_at = $17,
            meta_last_embedded_signup_at = current_timestamp,
            meta_payload = $18,
            ativo = true
        where id = $19
        returning *
        `;
    },

    insert_empresa_meta_parametros: () => {
        return `
        insert into empresa_meta_parans (
            empresa_id,
            whatsapp_account_id,
            meta_phone_number_id,
            meta_business_id,
            meta_business_name,
            meta_business_manager_id,
            meta_business_manager_name,
            meta_waba_name,
            meta_display_phone_number,
            meta_verified_name,
            meta_webhook_verify_token,
            meta_webhook_url,
            meta_graph_api_version,
            meta_app_scoped_user_id,
            meta_wa_id,
            meta_access_token_type,
            meta_token_expires_in,
            meta_access_token_expires_at,
            meta_last_embedded_signup_at,
            meta_payload,
            ativo
        ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, $17, $18, current_timestamp, $19, true
        )
        returning *
        `;
    },

    deactivate_empresa_meta_parametro: () => {
        return `
        update empresa_meta_parans
        set ativo = false
        where id = $1
          and empresa_id = $2
        returning *
        `;
    },

    update_empresa_meta_parametro_cor: () => {
        return `
        update empresa_meta_parans
        set cor = $3
        where id = $1
          and empresa_id = $2
        returning *
        `;
    },

    find_cliente_by_phone: () => {
        return `
        select id, nome, telefone, email, ativo, origem
        from cliente
        where empresa_id = $1
          and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = any($2::varchar[])
        order by
          case when coalesce(ativo, true) = true then 0 else 1 end,
          case when lower(coalesce(origem, '')) = 'manual' then 0 else 1 end,
          id
        limit 1
        `;
    },

    insert_cliente: () => {
        return `
        INSERT INTO cliente (nome, telefone, email, ativo, empresa_id, origem)
VALUES (
  $1,
  $2,
  null,
  true,
  $3,
  coalesce(nullif(trim($4), ''), 'whatsapp')
)
ON CONFLICT (telefone, empresa_id)
DO UPDATE SET
  nome = case
    when nullif(trim(coalesce(cliente.nome, '')), '') is null then EXCLUDED.nome
    when lower(trim(coalesce(cliente.nome, ''))) = 'cliente' then EXCLUDED.nome
    when regexp_replace(coalesce(cliente.nome, ''), '\D', '', 'g') <> ''
      and regexp_replace(coalesce(cliente.nome, ''), '\D', '', 'g') =
          regexp_replace(coalesce(EXCLUDED.telefone, ''), '\D', '', 'g')
      then EXCLUDED.nome
    else cliente.nome
  end,
  origem = case
    when nullif(trim(coalesce(cliente.origem, '')), '') is null then excluded.origem
    else cliente.origem
  end,
  ativo = true
RETURNING id, nome, telefone, email, ativo, origem;
        `;
    },

    update_cliente_nome: () => {
        return `
        update cliente
        set nome = $2,
            ativo = true
        where id = $1
        returning id, nome, telefone, email, ativo, origem
        `;
    },

    find_conversa_aberta_by_cliente: () => {
        return `
        select id, cliente_id, number_phone_id, empresa_id, status_id, empresa_meta_param_id
        from cliente_conversa_whats
        where cliente_id = $1
          and empresa_id = $2
          and data_fim is null
          and (
            ($3::integer is not null and empresa_meta_param_id = $3)
            or ($3::integer is null and empresa_meta_param_id is null)
          )
        order by
            id desc
        limit 1
        `;
    },

    update_cliente_meta_ads_referral: () => {
        return `
        update public.cliente
        set meta_ads_source_url = $3,
            meta_ads_source_type = $4,
            meta_ads_source_id = $5,
            meta_ads_headline = $6,
            meta_ads_body = $7,
            meta_ads_media_type = $8,
            meta_ads_image_url = $9,
            meta_ads_video_url = $10,
            meta_ads_thumbnail_url = $11,
            meta_ads_ctwa_clid = $12,
            meta_ads_referral = $13::jsonb,
            meta_ads_utm = $14::jsonb,
            meta_ads_message_id = $15,
            meta_ads_phone_number_id = $16,
            meta_ads_attributed_at = coalesce($17::timestamptz, now()),
            origem = 'meta_ads'
        where id = $1
          and empresa_id = $2
        returning id
        `;
    },

    insert_conversa: () => {
        return `
        insert into cliente_conversa_whats (
            number_phone_id,
            cliente_id,
            usuario_id,
            usuario_atribuido_id,
            status_id,
            setor_id,
            empresa_id,
            empresa_meta_param_id
        )
        values ($1, $2, null, $5, 0, null, $3, $4)
        returning id, cliente_id, number_phone_id, empresa_id, status_id, empresa_meta_param_id, usuario_atribuido_id
        `;
    },

    update_conversa_number_phone: () => {
        return `
        update cliente_conversa_whats
        set
            number_phone_id = $2,
            empresa_meta_param_id = coalesce($3, empresa_meta_param_id)
        where id = $1
        returning id, cliente_id, number_phone_id, empresa_id, status_id, empresa_meta_param_id
        `;
    },

    insert_mensagem_recebida: () => {
        return `
        insert into cliente_conversa_whats_mensagem (
            cliente_conversa_id,
            mensagem,
            tipo_id,
            data_mensagem,
            status,
            reply,
            mensagem_reply_id,
            mensagem_whats_id,
            send_by,
            midia_id,
            media_tipe
        )
        values ($1, $2, $3, current_timestamp, 3, $4, $5, $6, 1, $7, $8)
        on conflict on constraint mensagem_unica do nothing
        returning id, cliente_conversa_id, mensagem_whats_id
        `;
    },

    insert_mensagem_echo: () => {
        return `
        insert into cliente_conversa_whats_mensagem (
            cliente_conversa_id,
            mensagem,
            tipo_id,
            data_mensagem,
            status,
            reply,
            mensagem_reply_id,
            mensagem_whats_id,
            send_by,
            midia_id,
            media_tipe
        )
        values ($1, $2, $3, current_timestamp, 1, $4, $5, $6, 4, $7, $8)
        on conflict on constraint mensagem_unica do nothing
        returning id, cliente_conversa_id, mensagem_whats_id
        `;
    },

    insert_meta_referral_message: () => {
        return `
        insert into cliente_conversa_whats_mensagem (
            cliente_conversa_id,
            mensagem,
            tipo_id,
            data_mensagem,
            status,
            reply,
            mensagem_reply_id,
            mensagem_whats_id,
            send_by,
            midia_id,
            media_tipe
        )
        values ($1, $2, 1, current_timestamp, 3, false, null, $3, 0, $4, $5)
        on conflict on constraint mensagem_unica do nothing
        returning id, cliente_conversa_id, mensagem_whats_id
        `;
    },

    get_mensagem_conversa_by_whats_id: () => {
        return `
        select
            id,
            cliente_conversa_id,
            mensagem,
            tipo_id,
            midia_id,
            media_tipe,
            mensagem_whats_id
        from cliente_conversa_whats_mensagem
        where cliente_conversa_id = $1
          and mensagem_whats_id = $2
        order by id desc
        limit 1
        `;
    },

    update_incoming_message_content: () => {
        return `
        update cliente_conversa_whats_mensagem
        set
            mensagem = $3,
            tipo_id = $4,
            midia_id = $5,
            media_tipe = $6,
            editado = true,
            editado_em = current_timestamp
        where cliente_conversa_id = $1
          and mensagem_whats_id = $2
        returning id, cliente_conversa_id, mensagem_whats_id
        `;
    },

    update_incoming_message_media_url: () => {
        return `
        update cliente_conversa_whats_mensagem
        set midia_id = $3
        where cliente_conversa_id = $1
          and mensagem_whats_id = $2
        returning id, cliente_conversa_id, mensagem_whats_id, midia_id
        `;
    },

    update_message_revoked: () => {
        return `
        update cliente_conversa_whats_mensagem
        set
            mensagem = 'Mensagem apagada',
            tipo_id = 0,
            midia_id = null,
            media_tipe = null,
            reply = false,
            mensagem_reply_id = null,
            apagada = true,
            apagada_em = current_timestamp,
            editado = false,
            editado_em = null
        where cliente_conversa_id = $1
          and mensagem_whats_id = $2
        returning id, cliente_conversa_id, mensagem_whats_id
        `;
    },

    update_message_status: () => {
        return `
        update cliente_conversa_whats_mensagem
        set status = case
            when $2::integer is null then status
            when coalesce(status, 0) = 4 and $2::integer <> 4 then status
            when coalesce(status, 0) = 3 and $2::integer in (1, 2) then status
            when coalesce(status, 0) = 2 and $2::integer = 1 then status
            else greatest(coalesce(status, 0), $2::integer)
        end
        where mensagem_whats_id = $1
        returning id, cliente_conversa_id, mensagem_whats_id, status
        `;
    },

    get_mensagem_automatica_boas_vindas: () => {
        return `
        with toggle_config as (
            select
                coalesce(empm.whatsapp_auto_message_boas_vindas_ativa, true) as habilitada
            from empresa_meta_parans empm
            where empm.id = $2
              and empm.empresa_id = $1
              and coalesce(empm.ativo, true) = true
            limit 1
        ),
        scoped as (
            select
                wam.id,
                wam.texto,
                wam.mensagem_complementar_texto,
                wam.galeria_imagem_id,
                wam.ativo,
                wam.empresa_id,
                wam.empresa_meta_param_id
            from whatsapp_auto_message wam
            where wam.empresa_id = $1
              and wam.whatsapp_auto_message_tipo_id = 1
              and (
                ($2::bigint is not null and wam.empresa_meta_param_id = $2::bigint)
                or ($2::bigint is null and wam.empresa_meta_param_id is null)
              )
            order by wam.id desc
            limit 1
        ),
        fallback as (
            select
                wam.id,
                wam.texto,
                wam.mensagem_complementar_texto,
                wam.galeria_imagem_id,
                wam.ativo,
                wam.empresa_id,
                wam.empresa_meta_param_id
            from whatsapp_auto_message wam
            where $2::bigint is not null
              and wam.empresa_id = $1
              and wam.whatsapp_auto_message_tipo_id = 1
              and wam.empresa_meta_param_id is null
            order by wam.id desc
            limit 1
        ),
        candidate as (
            select * from scoped
            union all
            select * from fallback
            where not exists (select 1 from scoped)
        )
        select
            candidate.id,
            candidate.texto,
            candidate.mensagem_complementar_texto,
            candidate.galeria_imagem_id,
            gi.url as galeria_imagem_url,
            gi.nome_arquivo as galeria_imagem_nome_arquivo,
            gi.origem as galeria_imagem_origem,
            gi.mime_type as galeria_imagem_mime_type,
            candidate.ativo,
            candidate.empresa_id,
            candidate.empresa_meta_param_id,
            cfg.habilitada
        from (
            select coalesce((select habilitada from toggle_config), true) as habilitada
        ) cfg
        left join candidate
          on cfg.habilitada = true
         and candidate.ativo = true
        left join empresa_galeria_imagem gi
          on gi.id = candidate.galeria_imagem_id
         and gi.empresa_id = candidate.empresa_id
         and gi.ativo = true
        limit 1
        `;
    },

    get_empresa_template_header_image_by_origin: () => {
        return `
        select
            gi.id,
            gi.empresa_id,
            gi.nome_arquivo,
            gi.url,
            gi.path_bunny,
            gi.mime_type,
            gi.tamanho_bytes,
            gi.origem,
            gi.data_criacao,
            gi.ativo
        from empresa_galeria_imagem gi
        where gi.empresa_id = $1
          and gi.origem = $2
          and gi.ativo = true
        order by gi.data_criacao desc nulls last, gi.id desc
        limit 1
        `;
    },

    list_empresa_template_header_images_by_origin_prefix: () => {
        return `
        select distinct on (gi.origem)
            gi.id,
            gi.empresa_id,
            gi.nome_arquivo,
            gi.url,
            gi.path_bunny,
            gi.mime_type,
            gi.tamanho_bytes,
            gi.origem,
            gi.data_criacao,
            gi.ativo
        from empresa_galeria_imagem gi
        where gi.empresa_id = $1
          and gi.origem like $2
          and gi.ativo = true
        order by gi.origem asc, gi.data_criacao desc nulls last, gi.id desc
        `;
    },

    insert_template_dispatch_batch_history: () => {
        return `
        insert into whatsapp_template_disparo_lote (
            empresa_id,
            usuario_id,
            empresa_meta_param_id,
            template_id,
            template_name,
            template_language,
            template_category,
            lista_transmissao_id,
            total_clientes,
            processados,
            enviados,
            recebidos,
            erros,
            parar_no_primeiro_erro,
            interrompido_no_erro,
            custo_unitario,
            valor_total,
            moeda,
            data_inicio,
            data_fim,
            duracao_ms,
            metadata
        )
        values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb
        )
        returning *
        `;
    },

    insert_template_dispatch_batch_item_history: () => {
        return `
        insert into whatsapp_template_disparo_item (
            disparo_lote_id,
            empresa_id,
            empresa_meta_param_id,
            cliente_id,
            template_id,
            template_name,
            template_language,
            numero_original,
            numero_normalizado,
            contato_nome,
            email,
            conversa_id,
            message_id,
            message_status,
            sucesso,
            custo_unitario,
            valor_cobrado,
            enviado_em,
            recebido_em,
            erro_em,
            erro_mensagem,
            erro_codigo,
            erro_subcodigo,
            erro_tipo,
            metadata
        )
        values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25::jsonb
        )
        returning *
        `;
    },

    update_template_dispatch_batch_history: () => {
        return `
        update whatsapp_template_disparo_lote
        set
            processados = coalesce($2, processados),
            enviados = coalesce($3, enviados),
            recebidos = coalesce($4, recebidos),
            erros = coalesce($5, erros),
            interrompido_no_erro = coalesce($6, interrompido_no_erro),
            valor_total = coalesce($7, valor_total),
            data_fim = coalesce($8, data_fim),
            duracao_ms = coalesce($9, duracao_ms),
            metadata = coalesce(metadata, '{}'::jsonb) || coalesce($10::jsonb, '{}'::jsonb)
        where id = $1
        returning *
        `;
    },

    get_template_dispatch_batch_history_by_client_token: () => {
        return `
        select
            id,
            empresa_id,
            usuario_id,
            empresa_meta_param_id,
            template_id,
            template_name,
            template_language,
            template_category,
            lista_transmissao_id,
            total_clientes,
            processados,
            enviados,
            recebidos,
            erros,
            parar_no_primeiro_erro,
            interrompido_no_erro,
            custo_unitario,
            valor_total,
            moeda,
            data_inicio,
            data_fim,
            duracao_ms,
            metadata
        from whatsapp_template_disparo_lote
        where empresa_id = $1
          and coalesce(metadata->>'client_batch_token', '') = $2
        order by id desc
        limit 1
        `;
    },

    get_latest_template_dispatch_item_for_lead_auto_message_rule: () => {
        return `
        with latest_dispatch as (
            select
                id,
                empresa_id,
                empresa_meta_param_id,
                cliente_id,
                numero_normalizado,
                numero_original,
                conversa_id,
                template_id,
                template_name,
                message_id,
                enviado_em,
                data_criacao,
                metadata
            from whatsapp_template_disparo_item
            where empresa_id = $1
              and sucesso = true
              and (
                    ($2::integer is not null and cliente_id = $2)
                    or (
                        coalesce($3::varchar, '') <> ''
                        and regexp_replace(coalesce(numero_normalizado, numero_original, ''), '\D', '', 'g') =
                            regexp_replace($3::varchar, '\D', '', 'g')
                    )
              )
              and ($4::integer is null or empresa_meta_param_id = $4)
            order by coalesce(enviado_em, data_criacao) desc, id desc
            limit 1
        )
        select
            ld.*,
            first_customer.conversa_id as first_customer_conversa_id_after_dispatch,
            first_customer.primeira_mensagem_cliente_em as first_customer_message_at_after_dispatch
        from latest_dispatch ld
        left join lateral (
            select
                ccw.id as conversa_id,
                ccm.data_mensagem as primeira_mensagem_cliente_em
            from cliente_conversa_whats ccw
            inner join cliente c
              on c.id = ccw.cliente_id
            inner join cliente_conversa_whats_mensagem ccm
              on ccm.cliente_conversa_id = ccw.id
             and ccm.send_by = 1
            where ccw.empresa_id = ld.empresa_id
              and (
                    (ld.cliente_id is not null and ccw.cliente_id = ld.cliente_id)
                    or (
                        coalesce($3::varchar, '') <> ''
                        and regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') =
                            regexp_replace($3::varchar, '\D', '', 'g')
                    )
              )
              and ($4::integer is null or ccw.empresa_meta_param_id = $4)
              and ccm.data_mensagem >= coalesce(ld.enviado_em, ld.data_criacao)
            order by ccm.data_mensagem asc, ccm.id asc
            limit 1
        ) first_customer on true
        `;
    },

    update_template_dispatch_item_status_by_message_id: () => {
        return `
        update whatsapp_template_disparo_item
        set
            message_status = coalesce($2, message_status),
            sucesso = case
                when lower(coalesce($2, '')) = 'failed' then false
                else sucesso
            end,
            recebido_em = case
                when lower(coalesce($2, '')) in ('delivered', 'read')
                    then coalesce(recebido_em, $3)
                else recebido_em
            end,
            erro_em = case
                when lower(coalesce($2, '')) = 'failed'
                    then coalesce($4, erro_em, now())
                else erro_em
            end,
            erro_mensagem = case
                when lower(coalesce($2, '')) = 'failed'
                    then coalesce($5, erro_mensagem)
                else erro_mensagem
            end,
            erro_codigo = case
                when lower(coalesce($2, '')) = 'failed'
                    then coalesce($6, erro_codigo)
                else erro_codigo
            end,
            erro_subcodigo = case
                when lower(coalesce($2, '')) = 'failed'
                    then coalesce($7, erro_subcodigo)
                else erro_subcodigo
            end,
            erro_tipo = case
                when lower(coalesce($2, '')) = 'failed'
                    then coalesce($8, erro_tipo)
                else erro_tipo
            end,
            metadata = coalesce(metadata, '{}'::jsonb) || coalesce($9::jsonb, '{}'::jsonb)
        where message_id = $1
        returning id, disparo_lote_id, message_id, message_status, sucesso, recebido_em, erro_em
        `;
    },

    refresh_template_dispatch_batch_counters: () => {
        return `
        update whatsapp_template_disparo_lote lote
        set
            enviados = agg.enviados,
            recebidos = agg.recebidos,
            erros = agg.erros
        from (
            select
                disparo_lote_id,
                count(*) filter (where sucesso = true) as enviados,
                count(*) filter (where recebido_em is not null) as recebidos,
                count(*) filter (
                    where sucesso = false
                       or lower(coalesce(message_status, '')) = 'failed'
                ) as erros
            from whatsapp_template_disparo_item
            where disparo_lote_id = $1
            group by disparo_lote_id
        ) agg
        where lote.id = agg.disparo_lote_id
        returning lote.*
        `;
    },

    get_template_dispatch_cost_history_summary: () => {
        return `
        with base as (
            select
                date_trunc($5::text, coalesce(item.enviado_em, item.data_criacao)) as bucket_start,
                coalesce(item.valor_cobrado, 0) as valor_cobrado,
                coalesce(item.sucesso, false) as sucesso
            from whatsapp_template_disparo_item item
            where item.empresa_id = $1
              and ($2::integer is null or item.empresa_meta_param_id = $2)
              and coalesce(item.enviado_em, item.data_criacao) >= to_timestamp($3)
              and coalesce(item.enviado_em, item.data_criacao) <= to_timestamp($4)
        )
        select
            extract(epoch from bucket_start)::bigint as start,
            extract(
                epoch from (
                    bucket_start + case
                        when $5::text = 'hour' then interval '1 hour'
                        when $5::text = 'week' then interval '1 week'
                        when $5::text = 'month' then interval '1 month'
                        else interval '1 day'
                    end
                )
            )::bigint as "end",
            round(sum(valor_cobrado)::numeric, 6) as cost,
            count(*) filter (where sucesso = true) as volume,
            'USD'::varchar as currency,
            null::varchar as country,
            null::varchar as phone_number,
            'template_dispatch_history'::varchar as pricing_category,
            'local_history'::varchar as pricing_type
        from base
        group by bucket_start
        order by bucket_start asc
        `;
    },

    list_template_dispatch_history_report: () => {
        return `
        with filtered_batches as (
            select
                lote.id,
                lote.empresa_id,
                lote.empresa_meta_param_id,
                lote.usuario_id,
                lote.template_id,
                lote.template_name,
                lote.template_language,
                lote.template_category,
                lote.lista_transmissao_id,
                lote.total_clientes,
                lote.processados,
                lote.enviados,
                lote.recebidos,
                lote.erros,
                lote.parar_no_primeiro_erro,
                lote.interrompido_no_erro,
                lote.custo_unitario,
                lote.valor_total,
                lote.moeda,
                lote.data_inicio,
                lote.data_fim,
                lote.duracao_ms,
                coalesce(lote.metadata, '{}'::jsonb) as metadata,
                case
                    when lote.lista_transmissao_id is not null then 'list'
                    when coalesce(lote.metadata->>'source', '') = 'single_template_dispatch' then 'single'
                    else 'single'
                end as dispatch_type
            from whatsapp_template_disparo_lote lote
            where lote.empresa_id = $1
              and (
                    cardinality(coalesce($2::int[], '{}'::int[])) = 0
                    or lote.empresa_meta_param_id = any($2::int[])
              )
              and lote.data_inicio >= to_timestamp($3)
              and lote.data_inicio <= to_timestamp($4)
              and ($5::text = 'all' or (
                    $5::text = 'list' and lote.lista_transmissao_id is not null
                  ) or (
                    $5::text = 'single' and lote.lista_transmissao_id is null
                  ))
              and ($6::integer is null or lote.empresa_meta_param_id = $6)
              and ($7::integer is null or lote.usuario_id = $7)
              and (
                    $8::text = 'all'
                    or coalesce(nullif(lote.metadata->>'status', ''), case
                        when lote.data_fim is not null and lote.interrompido_no_erro = true then 'stopped_on_error'
                        when lote.data_fim is not null then 'completed'
                        else 'processing'
                    end) = $8::text
              )
        ),
        total_rows as (
            select count(*)::int as total_registros
            from filtered_batches
        ),
        paged_batches as (
            select *
            from filtered_batches
            order by data_inicio desc, id desc
            limit $9
            offset $10
        ),
        enriched_batches as (
            select
                batch.id,
                batch.empresa_id,
                batch.usuario_id,
                coalesce(usuario.nome, 'Sistema') as usuario_nome,
                batch.empresa_meta_param_id,
                coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id::varchar, '') as meta_numero_conta,
                coalesce(emp.meta_verified_name, emp.meta_waba_name, '') as meta_nome_conta,
                batch.template_id,
                batch.template_name,
                batch.template_language,
                batch.template_category,
                batch.lista_transmissao_id,
                lt.nome as lista_nome,
                lt.descricao as lista_descricao,
                coalesce(lista_contatos.total_contatos, 0) as lista_total_contatos,
                batch.total_clientes,
                batch.processados,
                batch.enviados,
                batch.recebidos,
                batch.erros,
                batch.parar_no_primeiro_erro,
                batch.interrompido_no_erro,
                batch.custo_unitario,
                batch.valor_total,
                batch.moeda,
                batch.data_inicio,
                batch.data_fim,
                batch.duracao_ms,
                batch.metadata,
                batch.dispatch_type
            from paged_batches batch
            left join usuario
              on usuario.id = batch.usuario_id
            left join empresa_meta_parans emp
              on emp.id = batch.empresa_meta_param_id
             and emp.empresa_id = batch.empresa_id
            left join cliente_lista_transmissao lt
              on lt.id = batch.lista_transmissao_id
             and lt.empresa_id = batch.empresa_id
            left join lateral (
                select count(*)::int as total_contatos
                from cliente_lista_transmissao_contato ltc
                where ltc.lista_transmissao_id = lt.id
            ) lista_contatos on true
        ),
        item_base as (
            select
                item.*,
                coalesce(
                    nullif(item.cliente_id::text, ''),
                    nullif(
                        regexp_replace(
                            coalesce(item.numero_normalizado, item.numero_original, ''),
                            '\D',
                            '',
                            'g'
                        ),
                        ''
                    ),
                    nullif(item.conversa_id::text, ''),
                    'item:' || item.id::text
                ) as destinatario_unico_key,
                response.respondido_em
            from whatsapp_template_disparo_item item
            inner join paged_batches batch
              on batch.id = item.disparo_lote_id
            left join lateral (
                select min(ccm.data_mensagem) as respondido_em
                from cliente_conversa_whats ccw
                inner join cliente c
                  on c.id = ccw.cliente_id
                inner join cliente_conversa_whats_mensagem ccm
                  on ccm.cliente_conversa_id = ccw.id
                 and ccm.send_by = 1
                where ccw.empresa_id = item.empresa_id
                  and (
                        (item.conversa_id is not null and ccw.id = item.conversa_id)
                        or (
                            item.conversa_id is null
                            and (
                                (item.cliente_id is not null and ccw.cliente_id = item.cliente_id)
                                or (
                                    regexp_replace(
                                        coalesce(item.numero_normalizado, item.numero_original, ''),
                                        '\D',
                                        '',
                                        'g'
                                    ) <> ''
                                    and regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') =
                                        regexp_replace(
                                            coalesce(item.numero_normalizado, item.numero_original, ''),
                                            '\D',
                                            '',
                                            'g'
                                        )
                                )
                            )
                        )
                  )
                  and (
                        item.empresa_meta_param_id is null
                        or ccw.empresa_meta_param_id = item.empresa_meta_param_id
                  )
                  and item.enviado_em is not null
                  and ccm.data_mensagem >= item.enviado_em
            ) response on true
            where item.empresa_id = $1
        ),
        item_metrics as (
            select
                item.disparo_lote_id,
                count(*) filter (where item.sucesso = true) as enviados_itens,
                count(*) filter (where item.recebido_em is not null) as recebidos_itens,
                count(distinct item.destinatario_unico_key) filter (
                    where item.recebido_em is not null
                ) as recebidos_unicos_itens,
                count(*) filter (where lower(coalesce(item.message_status, '')) = 'read') as visualizados_itens,
                count(*) filter (where item.respondido_em is not null) as respondidos_itens,
                count(distinct item.destinatario_unico_key) filter (
                    where item.respondido_em is not null
                ) as respondidos_unicos_itens,
                round(sum(coalesce(item.valor_cobrado, 0))::numeric, 6) as valor_total_itens
            from item_base item
            group by item.disparo_lote_id
        ),
        final_rows as (
            select
                batch.id,
                batch.empresa_id,
                batch.usuario_id,
                batch.usuario_nome,
                batch.empresa_meta_param_id,
                batch.meta_numero_conta,
                batch.meta_nome_conta,
                batch.template_id,
                batch.template_name,
                batch.template_language,
                batch.template_category,
                batch.lista_transmissao_id,
                batch.lista_nome,
                batch.lista_descricao,
                batch.lista_total_contatos,
                batch.total_clientes,
                batch.processados,
                coalesce(metrics.enviados_itens, batch.enviados, 0) as enviados,
                coalesce(metrics.recebidos_itens, batch.recebidos, 0) as recebidos,
                coalesce(metrics.recebidos_unicos_itens, 0) as recebidos_unicos,
                coalesce(metrics.visualizados_itens, 0) as visualizados,
                coalesce(metrics.respondidos_itens, 0) as respondidos,
                coalesce(metrics.respondidos_unicos_itens, 0) as respondidos_unicos,
                batch.erros,
                batch.parar_no_primeiro_erro,
                batch.interrompido_no_erro,
                batch.custo_unitario,
                coalesce(metrics.valor_total_itens, batch.valor_total, 0) as valor_total,
                batch.moeda,
                batch.data_inicio,
                batch.data_fim,
                batch.duracao_ms,
                batch.metadata,
                batch.dispatch_type,
                coalesce(nullif(batch.metadata->>'status', ''), case
                    when batch.data_fim is not null and batch.interrompido_no_erro = true then 'stopped_on_error'
                    when batch.data_fim is not null then 'completed'
                    else 'processing'
                end) as status
            from enriched_batches batch
            left join item_metrics metrics
              on metrics.disparo_lote_id = batch.id
        )
        select
            final_rows.*,
            total_rows.total_registros
        from final_rows
        cross join total_rows
        order by final_rows.data_inicio desc, final_rows.id desc
        `;
    },

    get_template_dispatch_history_report_by_id: () => {
        return `
        with batch_base as (
            select
                lote.id,
                lote.empresa_id,
                lote.usuario_id,
                coalesce(usuario.nome, 'Sistema') as usuario_nome,
                lote.empresa_meta_param_id,
                coalesce(emp.meta_display_phone_number, emp.meta_phone_number_id::varchar, '') as meta_numero_conta,
                coalesce(emp.meta_verified_name, emp.meta_waba_name, '') as meta_nome_conta,
                lote.template_id,
                lote.template_name,
                lote.template_language,
                lote.template_category,
                lote.lista_transmissao_id,
                lt.nome as lista_nome,
                lt.descricao as lista_descricao,
                coalesce(lista_contatos.total_contatos, 0) as lista_total_contatos,
                lote.total_clientes,
                lote.processados,
                lote.enviados,
                lote.recebidos,
                lote.erros,
                lote.parar_no_primeiro_erro,
                lote.interrompido_no_erro,
                lote.custo_unitario,
                lote.valor_total,
                lote.moeda,
                lote.data_inicio,
                lote.data_fim,
                lote.duracao_ms,
                coalesce(lote.metadata, '{}'::jsonb) as metadata,
                case
                    when lote.lista_transmissao_id is not null then 'list'
                    when coalesce(lote.metadata->>'source', '') = 'single_template_dispatch' then 'single'
                    else 'single'
                end as dispatch_type
            from whatsapp_template_disparo_lote lote
            left join usuario
              on usuario.id = lote.usuario_id
            left join empresa_meta_parans emp
              on emp.id = lote.empresa_meta_param_id
             and emp.empresa_id = lote.empresa_id
            left join cliente_lista_transmissao lt
              on lt.id = lote.lista_transmissao_id
             and lt.empresa_id = lote.empresa_id
            left join lateral (
                select count(*)::int as total_contatos
                from cliente_lista_transmissao_contato ltc
                where ltc.lista_transmissao_id = lt.id
            ) lista_contatos on true
            where lote.empresa_id = $1
              and lote.id = $2
              and (
                    cardinality(coalesce($3::int[], '{}'::int[])) = 0
                    or lote.empresa_meta_param_id = any($3::int[])
              )
        ),
        item_base as (
            select
                item.*,
                coalesce(
                    nullif(item.cliente_id::text, ''),
                    nullif(
                        regexp_replace(
                            coalesce(item.numero_normalizado, item.numero_original, ''),
                            '\D',
                            '',
                            'g'
                        ),
                        ''
                    ),
                    nullif(item.conversa_id::text, ''),
                    'item:' || item.id::text
                ) as destinatario_unico_key,
                response.respondido_em
            from whatsapp_template_disparo_item item
            left join lateral (
                select min(ccm.data_mensagem) as respondido_em
                from cliente_conversa_whats ccw
                inner join cliente c
                  on c.id = ccw.cliente_id
                inner join cliente_conversa_whats_mensagem ccm
                  on ccm.cliente_conversa_id = ccw.id
                 and ccm.send_by = 1
                where ccw.empresa_id = item.empresa_id
                  and (
                        (item.conversa_id is not null and ccw.id = item.conversa_id)
                        or (
                            item.conversa_id is null
                            and (
                                (item.cliente_id is not null and ccw.cliente_id = item.cliente_id)
                                or (
                                    regexp_replace(
                                        coalesce(item.numero_normalizado, item.numero_original, ''),
                                        '\D',
                                        '',
                                        'g'
                                    ) <> ''
                                    and regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') =
                                        regexp_replace(
                                            coalesce(item.numero_normalizado, item.numero_original, ''),
                                            '\D',
                                            '',
                                            'g'
                                        )
                                )
                            )
                        )
                  )
                  and (
                        item.empresa_meta_param_id is null
                        or ccw.empresa_meta_param_id = item.empresa_meta_param_id
                  )
                  and item.enviado_em is not null
                  and ccm.data_mensagem >= item.enviado_em
            ) response on true
            where item.empresa_id = $1
              and item.disparo_lote_id = $2
        ),
        item_metrics as (
            select
                item.disparo_lote_id,
                count(*) filter (where item.sucesso = true) as enviados_itens,
                count(*) filter (where item.recebido_em is not null) as recebidos_itens,
                count(distinct item.destinatario_unico_key) filter (
                    where item.recebido_em is not null
                ) as recebidos_unicos_itens,
                count(*) filter (where lower(coalesce(item.message_status, '')) = 'read') as visualizados_itens,
                count(*) filter (where item.respondido_em is not null) as respondidos_itens,
                count(distinct item.destinatario_unico_key) filter (
                    where item.respondido_em is not null
                ) as respondidos_unicos_itens,
                round(sum(coalesce(item.valor_cobrado, 0))::numeric, 6) as valor_total_itens
            from item_base item
            group by item.disparo_lote_id
        )
        select
            batch.id,
            batch.empresa_id,
            batch.usuario_id,
            batch.usuario_nome,
            batch.empresa_meta_param_id,
            batch.meta_numero_conta,
            batch.meta_nome_conta,
            batch.template_id,
            batch.template_name,
            batch.template_language,
            batch.template_category,
            batch.lista_transmissao_id,
            batch.lista_nome,
            batch.lista_descricao,
            batch.lista_total_contatos,
            batch.total_clientes,
            batch.processados,
            coalesce(metrics.enviados_itens, batch.enviados, 0) as enviados,
            coalesce(metrics.recebidos_itens, batch.recebidos, 0) as recebidos,
            coalesce(metrics.recebidos_unicos_itens, 0) as recebidos_unicos,
            coalesce(metrics.visualizados_itens, 0) as visualizados,
            coalesce(metrics.respondidos_itens, 0) as respondidos,
            coalesce(metrics.respondidos_unicos_itens, 0) as respondidos_unicos,
            batch.erros,
            batch.parar_no_primeiro_erro,
            batch.interrompido_no_erro,
            batch.custo_unitario,
            coalesce(metrics.valor_total_itens, batch.valor_total, 0) as valor_total,
            batch.moeda,
            batch.data_inicio,
            batch.data_fim,
            batch.duracao_ms,
            batch.metadata,
            batch.dispatch_type,
            coalesce(nullif(batch.metadata->>'status', ''), case
                when batch.data_fim is not null and batch.interrompido_no_erro = true then 'stopped_on_error'
                when batch.data_fim is not null then 'completed'
                else 'processing'
            end) as status
        from batch_base batch
        left join item_metrics metrics
          on metrics.disparo_lote_id = batch.id
        limit 1
        `;
    },

    list_template_dispatch_history_report_items: () => {
        return `
        select
            item.id,
            item.disparo_lote_id,
            item.empresa_id,
            item.empresa_meta_param_id,
            item.cliente_id,
            item.template_id,
            item.template_name,
            item.template_language,
            item.numero_original,
            item.numero_normalizado,
            item.contato_nome,
            item.email,
            item.conversa_id,
            item.message_id,
            item.message_status,
            item.sucesso,
            item.custo_unitario,
            item.valor_cobrado,
            item.enviado_em,
            item.recebido_em,
            item.erro_em,
            item.erro_mensagem,
            item.erro_codigo,
            item.erro_subcodigo,
            item.erro_tipo,
            coalesce(item.metadata, '{}'::jsonb) as metadata,
            response.respondido_em,
            (item.recebido_em is not null) as recebido,
            (lower(coalesce(item.message_status, '')) = 'read') as visualizado,
            (response.respondido_em is not null) as respondeu
        from whatsapp_template_disparo_item item
        left join lateral (
            select min(ccm.data_mensagem) as respondido_em
            from cliente_conversa_whats ccw
            inner join cliente c
              on c.id = ccw.cliente_id
            inner join cliente_conversa_whats_mensagem ccm
              on ccm.cliente_conversa_id = ccw.id
             and ccm.send_by = 1
            where ccw.empresa_id = item.empresa_id
              and (
                    (item.conversa_id is not null and ccw.id = item.conversa_id)
                    or (
                        item.conversa_id is null
                        and (
                            (item.cliente_id is not null and ccw.cliente_id = item.cliente_id)
                            or (
                                regexp_replace(
                                    coalesce(item.numero_normalizado, item.numero_original, ''),
                                    '\D',
                                    '',
                                    'g'
                                ) <> ''
                                and regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') =
                                    regexp_replace(
                                        coalesce(item.numero_normalizado, item.numero_original, ''),
                                        '\D',
                                        '',
                                        'g'
                                    )
                            )
                        )
                    )
              )
              and (
                    item.empresa_meta_param_id is null
                    or ccw.empresa_meta_param_id = item.empresa_meta_param_id
              )
              and item.enviado_em is not null
              and ccm.data_mensagem >= item.enviado_em
        ) response on true
        where item.empresa_id = $1
          and item.disparo_lote_id = $2
        order by coalesce(item.enviado_em, item.erro_em) asc nulls last, item.id asc
        `;
    },

    list_template_dispatch_quick_suggestions: () => {
        return `
        with base as (
            select
                nullif(trim(lote.template_name), '') as template_name,
                coalesce(nullif(trim(lote.template_language), ''), 'pt_BR') as template_language,
                max(lote.data_inicio) as last_used_at,
                count(*)::int as usage_count
            from whatsapp_template_disparo_lote lote
            where lote.empresa_id = $1
              and ($2::integer is null or lote.empresa_meta_param_id = $2)
              and lote.lista_transmissao_id is null
              and nullif(trim(coalesce(lote.template_name, '')), '') is not null
            group by 1, 2
        ),
        recent_ranked as (
            select
                base.template_name,
                base.template_language,
                base.last_used_at,
                base.usage_count,
                'recent'::varchar as source,
                row_number() over (
                    order by
                        base.last_used_at desc nulls last,
                        base.usage_count desc,
                        base.template_name asc
                ) as source_rank,
                0 as source_priority
            from base
        ),
        popular_ranked as (
            select
                base.template_name,
                base.template_language,
                base.last_used_at,
                base.usage_count,
                'popular'::varchar as source,
                row_number() over (
                    order by
                        base.usage_count desc,
                        base.last_used_at desc nulls last,
                        base.template_name asc
                ) as source_rank,
                1 as source_priority
            from base
        ),
        merged as (
            select *
            from recent_ranked
            where source_rank <= $3

            union all

            select *
            from popular_ranked
            where source_rank <= $3
        ),
        dedup as (
            select
                merged.*,
                row_number() over (
                    partition by merged.template_name, merged.template_language
                    order by merged.source_priority asc, merged.source_rank asc
                ) as dedupe_rank
            from merged
        )
        select
            dedup.template_name,
            dedup.template_language,
            dedup.last_used_at,
            dedup.usage_count,
            dedup.source
        from dedup
        where dedup.dedupe_rank = 1
        order by
            dedup.source_priority asc,
            dedup.source_rank asc,
            dedup.last_used_at desc nulls last
        limit $3
        `;
    },
};

module.exports = models;
