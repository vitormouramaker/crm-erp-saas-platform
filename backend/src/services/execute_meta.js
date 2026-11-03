const models = require("../models/models_meta");
const atendimentoModels = require("../models/models_atendimento");
const { postgres } = require("../server/connect");
const developerWebhooks = require("./execute_developer_webhooks");

function normalizeQueueUserId(value) {
    const parsed = Number(value || 0);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildPhoneLookupCandidates(telefone) {
    const digits = String(telefone || "").replace(/\D/g, "");
    if (!digits) return [];

    const candidates = new Set([digits]);
    const withoutPrefix = digits.startsWith("00") ? digits.slice(2) : digits;

    if (withoutPrefix) {
        candidates.add(withoutPrefix);
    }

    const withCountryCode = withoutPrefix.startsWith("55")
        ? withoutPrefix
        : `55${withoutPrefix}`;
    const localBrazil = withCountryCode.startsWith("55")
        ? withCountryCode.slice(2)
        : withoutPrefix;

    if (withCountryCode) {
        candidates.add(withCountryCode);
    }

    if (localBrazil) {
        candidates.add(localBrazil);
    }

    // Accept BR mobile variations with and without the ninth digit after DDD.
    if (localBrazil.length === 11 && localBrazil[2] === "9") {
        const withoutNinthDigit = `${localBrazil.slice(0, 2)}${localBrazil.slice(3)}`;
        candidates.add(withoutNinthDigit);
        candidates.add(`55${withoutNinthDigit}`);
    }

    if (localBrazil.length === 10) {
        const withNinthDigit = `${localBrazil.slice(0, 2)}9${localBrazil.slice(2)}`;
        candidates.add(withNinthDigit);
        candidates.add(`55${withNinthDigit}`);
    }

    return [...candidates].filter(Boolean);
}

async function resolveAtendimentoFilaUsuarioAtribuido(
    client,
    empresa_id,
    empresa_meta_param_id
) {
    const queueConfigResult = await client.query(
        atendimentoModels.lock_empresa_atendimento_queue_config(),
        [empresa_id]
    );
    const queueConfig = queueConfigResult.rows?.[0] || null;

    if (!Boolean(queueConfig?.atendimento_fila_automatica_ativa)) {
        return null;
    }

    const eligibleUsersResult = await client.query(
        atendimentoModels.list_empresa_atendimento_fila_usuarios_elegiveis(),
        [empresa_id, empresa_meta_param_id]
    );
    const eligibleUsers = Array.isArray(eligibleUsersResult.rows)
        ? eligibleUsersResult.rows
        : [];
    const eligibleUserIds = eligibleUsers
        .map((row) => normalizeQueueUserId(row?.usuario_id))
        .filter((value) => Number.isInteger(value) && value > 0);
    let lastUserId = normalizeQueueUserId(
        queueConfig?.atendimento_fila_ultimo_usuario_id
    );

    if (
        eligibleUserIds.length &&
        (!lastUserId || !eligibleUserIds.includes(lastUserId))
    ) {
        const localLastAssignedRows = await client.query(
            atendimentoModels.get_last_fila_usuario_elegivel_por_numero(),
            [empresa_id, empresa_meta_param_id, eligibleUserIds]
        );
        lastUserId = normalizeQueueUserId(
            localLastAssignedRows.rows?.[0]?.usuario_id
        );
    }

    if (!eligibleUsers.length) {
        return null;
    }

    let nextIndex = 0;
    if (lastUserId) {
        const lastAssignedIndex = eligibleUsers.findIndex(
            (row) => normalizeQueueUserId(row?.usuario_id) === lastUserId
        );
        if (lastAssignedIndex >= 0) {
            nextIndex = (lastAssignedIndex + 1) % eligibleUsers.length;
        }
    }

    return normalizeQueueUserId(eligibleUsers[nextIndex]?.usuario_id);
}

const execute = {
    execute_get_paramentros_whats: async (empresa_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.get_paramentros_whats(), [empresa_id]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_list_paramentros_whats_empresa: async (empresa_id, includeInactive = false) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.list_paramentros_whats_empresa(), [
                empresa_id,
                Boolean(includeInactive),
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_paramentros_whats_by_id: async (metaParamId, empresa_id = null) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.get_paramentros_whats_by_id(), [
                metaParamId,
                empresa_id,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_paramentros_whats_by_conversa_id: async (conversa_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.get_paramentros_whats_by_conversa_id(), [
                conversa_id,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_paramentros: async () =>{
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.get_paramentros(), []);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_paramentros_whats_by_identifiers: async (phone_number_id, wa_id, whatsapp_account_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.get_paramentros_whats_by_identifiers(),
                [phone_number_id, wa_id, whatsapp_account_id]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_upsert_paramentros_whats: async (payload) => {
        const client = await postgres.connect();
        try {
            await client.query("BEGIN");

            if (payload.empresa_id && payload.api_key) {
                await client.query(
                    models.upsert_parametros_whats_global(),
                    [
                        payload.empresa_id,
                        payload.api_key,
                        payload.whatsapp_account_id || null,
                    ]
                );
            }

            const currentRet = await client.query(
                models.find_empresa_meta_parametros_by_match(),
                [
                    payload.empresa_id,
                    payload.meta_phone_number_id || null,
                ]
            );
            const current = currentRet.rows?.[0] || null;

            const metaParams = [
                payload.whatsapp_account_id,
                payload.meta_phone_number_id,
                payload.meta_business_id,
                payload.meta_business_name,
                payload.meta_business_manager_id,
                payload.meta_business_manager_name,
                payload.meta_waba_name,
                payload.meta_display_phone_number,
                payload.meta_verified_name,
                payload.meta_webhook_verify_token,
                payload.meta_webhook_url,
                payload.meta_graph_api_version,
                payload.meta_app_scoped_user_id,
                payload.meta_wa_id,
                payload.meta_access_token_type,
                payload.meta_token_expires_in,
                payload.meta_access_token_expires_at,
                payload.meta_payload,
            ];

            let ret;

            if (current?.id) {
                ret = await client.query(
                    models.update_empresa_meta_parametros(),
                    [...metaParams, current.id]
                );
            } else {
                ret = await client.query(
                    models.insert_empresa_meta_parametros(),
                    [
                        payload.empresa_id,
                        payload.whatsapp_account_id,
                        payload.meta_phone_number_id,
                        payload.meta_business_id,
                        payload.meta_business_name,
                        payload.meta_business_manager_id,
                        payload.meta_business_manager_name,
                        payload.meta_waba_name,
                        payload.meta_display_phone_number,
                        payload.meta_verified_name,
                        payload.meta_webhook_verify_token,
                        payload.meta_webhook_url,
                        payload.meta_graph_api_version,
                        payload.meta_app_scoped_user_id,
                        payload.meta_wa_id,
                        payload.meta_access_token_type,
                        payload.meta_token_expires_in,
                        payload.meta_access_token_expires_at,
                        payload.meta_payload,
                    ]
                );
            }

            await client.query("COMMIT");
            return ret.rows;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    },

    execute_desativar_paramentros_whats: async (empresa_id, meta_param_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.deactivate_empresa_meta_parametro(), [
                meta_param_id,
                empresa_id,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_find_cliente_by_phone: async (empresa_id, telefone) => {
        const client = await postgres.connect();
        try {
            const telefones = buildPhoneLookupCandidates(telefone);
            console.log(
                "[meta][find_cliente_by_phone] lookup",
                JSON.stringify({
                    empresa_id,
                    telefone_original: telefone || null,
                    telefone_candidates: telefones,
                })
            );
            const ret = await client.query(models.find_cliente_by_phone(), [empresa_id, telefones]);
            console.log(
                "[meta][find_cliente_by_phone] result",
                JSON.stringify({
                    empresa_id,
                    telefone_original: telefone || null,
                    matched_count: ret.rows?.length || 0,
                    matched_cliente: ret.rows?.[0]
                        ? {
                            id: ret.rows[0].id || null,
                            nome: ret.rows[0].nome || null,
                            telefone: ret.rows[0].telefone || null,
                            email: ret.rows[0].email || null,
                            ativo: ret.rows[0].ativo ?? null,
                            origem: ret.rows[0].origem || null,
                        }
                        : null,
                })
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_insert_cliente: async (nome, telefone, empresa_id, origem = "whatsapp") => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.insert_cliente(), [
                nome,
                telefone,
                empresa_id,
                origem,
            ]);
            if (ret.rows?.[0]?.id) {
                developerWebhooks.queueCustomerCreated(ret.rows[0].id);
            }
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_update_cliente_nome: async (cliente_id, nome) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.update_cliente_nome(), [cliente_id, nome]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_find_conversa_aberta_by_cliente: async (cliente_id, empresa_id, empresa_meta_param_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.find_conversa_aberta_by_cliente(), [
                cliente_id,
                empresa_id,
                empresa_meta_param_id,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_update_cliente_meta_ads_referral: async ({
        cliente_id,
        empresa_id,
        referral,
        utm,
        message_id,
        phone_number_id,
        attributed_at,
    }) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.update_cliente_meta_ads_referral(), [
                cliente_id,
                empresa_id,
                referral?.source_url || null,
                referral?.source_type || null,
                referral?.source_id || null,
                referral?.headline || null,
                referral?.body || null,
                referral?.media_type || null,
                referral?.image_url || null,
                referral?.video_url || null,
                referral?.thumbnail_url || null,
                referral?.ctwa_clid || null,
                JSON.stringify(referral || {}),
                JSON.stringify(utm || {}),
                message_id || null,
                phone_number_id || null,
                attributed_at || null,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_insert_conversa: async (number_phone_id, cliente_id, empresa_id, empresa_meta_param_id) => {
        const client = await postgres.connect();
        try {
            await client.query("BEGIN");
            const usuarioAtribuidoId = await resolveAtendimentoFilaUsuarioAtribuido(
                client,
                empresa_id,
                empresa_meta_param_id
            );

            const ret = await client.query(models.insert_conversa(), [
                number_phone_id,
                cliente_id,
                empresa_id,
                empresa_meta_param_id,
                usuarioAtribuidoId,
            ]);

            if (usuarioAtribuidoId) {
                await client.query(
                    atendimentoModels.update_empresa_atendimento_fila_ultimo_usuario(),
                    [empresa_id, usuarioAtribuidoId]
                );
            }

            await client.query("COMMIT");
            if (ret.rows?.[0]?.id) {
                developerWebhooks.queueConversationCreated(ret.rows[0].id);
            }
            return ret.rows;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    },

    execute_update_paramentros_whats_cor: async (empresa_id, meta_param_id, cor) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.update_empresa_meta_parametro_cor(), [
                meta_param_id,
                empresa_id,
                cor,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_update_conversa_number_phone: async (conversa_id, number_phone_id, empresa_meta_param_id = null) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.update_conversa_number_phone(), [
                conversa_id,
                number_phone_id,
                empresa_meta_param_id,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_insert_mensagem_recebida: async (
        conversa_id,
        mensagem,
        tipo_id,
        reply,
        mensagem_reply_id,
        mensagem_whats_id,
        midia_id,
        media_tipe
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.insert_mensagem_recebida(), [
                conversa_id,
                mensagem,
                tipo_id,
                reply,
                mensagem_reply_id,
                mensagem_whats_id,
                midia_id,
                media_tipe
            ]);
            if (ret.rows?.[0]?.id) {
                developerWebhooks.queueMessageCreated(ret.rows[0].id);
            }
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_insert_mensagem_echo: async (
        conversa_id,
        mensagem,
        tipo_id,
        reply,
        mensagem_reply_id,
        mensagem_whats_id,
        midia_id,
        media_tipe
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.insert_mensagem_echo(), [
                conversa_id,
                mensagem,
                tipo_id,
                reply,
                mensagem_reply_id,
                mensagem_whats_id,
                midia_id,
                media_tipe
            ]);
            if (ret.rows?.[0]?.id) {
                developerWebhooks.queueMessageCreated(ret.rows[0].id);
            }
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_insert_meta_referral_message: async (
        conversa_id,
        mensagem,
        mensagem_whats_id,
        midia_id,
        media_tipe
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.insert_meta_referral_message(), [
                conversa_id,
                mensagem,
                mensagem_whats_id,
                midia_id,
                media_tipe
            ]);
            if (ret.rows?.[0]?.id) {
                developerWebhooks.queueMessageCreated(ret.rows[0].id);
            }
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_mensagem_conversa_by_whats_id: async (
        conversa_id,
        mensagem_whats_id
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.get_mensagem_conversa_by_whats_id(), [
                conversa_id,
                mensagem_whats_id
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_update_incoming_message_content: async (
        conversa_id,
        mensagem_whats_id,
        mensagem,
        tipo_id,
        midia_id,
        media_tipe
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.update_incoming_message_content(), [
                conversa_id,
                mensagem_whats_id,
                mensagem,
                tipo_id,
                midia_id,
                media_tipe
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_update_incoming_message_media_url: async (
        conversa_id,
        mensagem_whats_id,
        media_url
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.update_incoming_message_media_url(), [
                conversa_id,
                mensagem_whats_id,
                media_url
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_update_message_revoked: async (
        conversa_id,
        mensagem_whats_id
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.update_message_revoked(), [
                conversa_id,
                mensagem_whats_id,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_update_message_status: async (mensagem_whats_id, status) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.update_message_status(), [mensagem_whats_id, status]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_mensagem_automatica_boas_vindas: async (
        empresa_id,
        empresa_meta_param_id = null
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.get_mensagem_automatica_boas_vindas(), [
                empresa_id,
                empresa_meta_param_id,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_empresa_template_header_image_by_origin: async (empresa_id, origem) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.get_empresa_template_header_image_by_origin(), [
                empresa_id,
                origem,
            ]);
            return ret.rows[0] || null;
        } finally {
            client.release();
        }
    },

    execute_list_empresa_template_header_images_by_origin_prefix: async (empresa_id, prefixoOrigem) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.list_empresa_template_header_images_by_origin_prefix(), [
                empresa_id,
                prefixoOrigem,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_create_template_dispatch_batch_history: async (payload) => {
        const client = await postgres.connect();
        try {
            await client.query("BEGIN");

            const batchRet = await client.query(
                models.insert_template_dispatch_batch_history(),
                [
                    payload.empresa_id,
                    payload.usuario_id || null,
                    payload.empresa_meta_param_id || null,
                    payload.template_id,
                    payload.template_name,
                    payload.template_language || null,
                    payload.template_category || null,
                    payload.lista_transmissao_id || null,
                    payload.total_clientes || 0,
                    payload.processados || 0,
                    payload.enviados || 0,
                    payload.recebidos || 0,
                    payload.erros || 0,
                    Boolean(payload.parar_no_primeiro_erro),
                    Boolean(payload.interrompido_no_erro),
                    payload.custo_unitario || 0,
                    payload.valor_total || 0,
                    payload.moeda || "USD",
                    payload.data_inicio || new Date(),
                    payload.data_fim === undefined ? new Date() : payload.data_fim,
                    payload.duracao_ms || 0,
                    JSON.stringify(payload.metadata || {}),
                ]
            );

            const batch = batchRet.rows[0] || null;
            const items = Array.isArray(payload.results) ? payload.results : [];

            for (const item of items) {
                await client.query(
                    models.insert_template_dispatch_batch_item_history(),
                    [
                        batch?.id || null,
                        payload.empresa_id,
                        payload.empresa_meta_param_id || null,
                        item.cliente_id || null,
                        payload.template_id,
                        payload.template_name,
                        payload.template_language || null,
                        item.numero_original || null,
                        item.numero || null,
                        item.contato_nome || null,
                        item.email || null,
                        item.conversa_id || null,
                        item.message_id || null,
                        item.message_status || null,
                        Boolean(item.success),
                        item.custo_unitario || 0,
                        item.valor_cobrado || 0,
                        item.enviado_em || null,
                        item.recebido_em || null,
                        item.erro_em || null,
                        item.error_message || null,
                        item.error_code === undefined || item.error_code === null
                            ? null
                            : String(item.error_code),
                        item.error_subcode === undefined || item.error_subcode === null
                            ? null
                            : String(item.error_subcode),
                        item.error_type || null,
                        JSON.stringify(item.metadata || {}),
                    ]
                );
            }

            await client.query("COMMIT");
            return batch;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    },

    execute_insert_template_dispatch_batch_item_history: async (payload) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.insert_template_dispatch_batch_item_history(),
                [
                    payload.disparo_lote_id || null,
                    payload.empresa_id,
                    payload.empresa_meta_param_id || null,
                    payload.cliente_id || null,
                    payload.template_id,
                    payload.template_name,
                    payload.template_language || null,
                    payload.numero_original || null,
                    payload.numero_normalizado || null,
                    payload.contato_nome || null,
                    payload.email || null,
                    payload.conversa_id || null,
                    payload.message_id || null,
                    payload.message_status || null,
                    Boolean(payload.sucesso),
                    payload.custo_unitario || 0,
                    payload.valor_cobrado || 0,
                    payload.enviado_em || null,
                    payload.recebido_em || null,
                    payload.erro_em || null,
                    payload.erro_mensagem || null,
                    payload.erro_codigo === undefined || payload.erro_codigo === null
                        ? null
                        : String(payload.erro_codigo),
                    payload.erro_subcodigo === undefined || payload.erro_subcodigo === null
                        ? null
                        : String(payload.erro_subcodigo),
                    payload.erro_tipo || null,
                    JSON.stringify(payload.metadata || {}),
                ]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_update_template_dispatch_batch_history: async (payload) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.update_template_dispatch_batch_history(),
                [
                    payload.id,
                    payload.processados ?? null,
                    payload.enviados ?? null,
                    payload.recebidos ?? null,
                    payload.erros ?? null,
                    payload.interrompido_no_erro === undefined
                        ? null
                        : Boolean(payload.interrompido_no_erro),
                    payload.valor_total ?? null,
                    payload.data_fim === undefined ? null : payload.data_fim,
                    payload.duracao_ms ?? null,
                    JSON.stringify(payload.metadata || {}),
                ]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_template_dispatch_batch_history_by_client_token: async (
        empresa_id,
        client_batch_token
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.get_template_dispatch_batch_history_by_client_token(),
                [empresa_id, client_batch_token]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_arquivar_template_meta: async ({
        empresa_id,
        empresa_meta_param_id,
        template_id,
        template_name,
        language_code,
        usuario_id,
    }) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                `INSERT INTO public.empresa_meta_template_arquivado (
                    empresa_id,
                    empresa_meta_param_id,
                    template_id,
                    template_name,
                    language_code,
                    arquivado_por
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (empresa_id, empresa_meta_param_id, template_id)
                DO UPDATE SET
                    template_name = EXCLUDED.template_name,
                    language_code = EXCLUDED.language_code,
                    arquivado_por = EXCLUDED.arquivado_por,
                    arquivado_em = CURRENT_TIMESTAMP
                RETURNING *`,
                [
                    empresa_id,
                    empresa_meta_param_id,
                    template_id,
                    template_name,
                    language_code || null,
                    usuario_id || null,
                ]
            );
            return ret.rows[0] || null;
        } finally {
            client.release();
        }
    },

    execute_list_template_meta_arquivados: async (empresa_id, empresa_meta_param_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                `SELECT template_id
                   FROM public.empresa_meta_template_arquivado
                  WHERE empresa_id = $1
                    AND empresa_meta_param_id = $2`,
                [empresa_id, empresa_meta_param_id]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_latest_template_dispatch_item_for_lead_auto_message_rule: async ({
        empresa_id,
        cliente_id = null,
        numero = null,
        empresa_meta_param_id = null,
    }) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.get_latest_template_dispatch_item_for_lead_auto_message_rule(),
                [
                    empresa_id,
                    cliente_id || null,
                    numero || null,
                    empresa_meta_param_id || null,
                ]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_update_template_dispatch_item_status_by_message_id: async ({
        message_id,
        message_status,
        received_at = null,
        error_at = null,
        error_message = null,
        error_code = null,
        error_subcode = null,
        error_type = null,
        metadata = {},
    }) => {
        const client = await postgres.connect();
        try {
            await client.query("BEGIN");

            const ret = await client.query(
                models.update_template_dispatch_item_status_by_message_id(),
                [
                    message_id,
                    message_status || null,
                    received_at,
                    error_at,
                    error_message,
                    error_code === undefined || error_code === null ? null : String(error_code),
                    error_subcode === undefined || error_subcode === null
                        ? null
                        : String(error_subcode),
                    error_type,
                    JSON.stringify(metadata || {}),
                ]
            );

            const updatedItem = ret.rows[0] || null;
            if (updatedItem?.disparo_lote_id) {
                await client.query(models.refresh_template_dispatch_batch_counters(), [
                    updatedItem.disparo_lote_id,
                ]);
            }

            await client.query("COMMIT");
            return updatedItem;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    },

    execute_get_template_dispatch_cost_history_summary: async ({
        empresa_id,
        empresa_meta_param_id = null,
        start,
        end,
        granularity = "day",
    }) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.get_template_dispatch_cost_history_summary(),
                [
                    empresa_id,
                    empresa_meta_param_id,
                    start,
                    end,
                    granularity,
                ]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_list_template_dispatch_history_report: async ({
        empresa_id,
        allowed_meta_param_ids = [],
        start,
        end,
        dispatch_type = "all",
        empresa_meta_param_id = null,
        usuario_filtro_id = null,
        status = "all",
        limit = 100,
        offset = 0,
    }) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.list_template_dispatch_history_report(),
                [
                    empresa_id,
                    Array.isArray(allowed_meta_param_ids) ? allowed_meta_param_ids : [],
                    start,
                    end,
                    dispatch_type,
                    empresa_meta_param_id,
                    usuario_filtro_id,
                    status,
                    limit,
                    offset,
                ]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_template_dispatch_history_report_by_id: async ({
        empresa_id,
        dispatch_history_id,
        allowed_meta_param_ids = [],
    }) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.get_template_dispatch_history_report_by_id(),
                [
                    empresa_id,
                    dispatch_history_id,
                    Array.isArray(allowed_meta_param_ids) ? allowed_meta_param_ids : [],
                ]
            );
            return ret.rows[0] || null;
        } finally {
            client.release();
        }
    },

    execute_list_template_dispatch_history_report_items: async ({
        empresa_id,
        dispatch_history_id,
    }) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.list_template_dispatch_history_report_items(),
                [empresa_id, dispatch_history_id]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_list_template_dispatch_quick_suggestions: async ({
        empresa_id,
        empresa_meta_param_id = null,
        limit = 5,
    }) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.list_template_dispatch_quick_suggestions(),
                [
                    empresa_id,
                    empresa_meta_param_id,
                    Math.min(Math.max(Number(limit || 5) || 5, 1), 10),
                ]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    }
};

module.exports = execute;
