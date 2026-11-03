const models = require('../models/models_atendimento')
const {postgres} = require('../server/connect')
const developerWebhooks = require("./execute_developer_webhooks");
const { isRuntimeSchemaEnsureEnabled } = require("../utils/runtime_schema");

const RUNTIME_SCHEMA_ENSURE_CLIENTE_DOCUMENTO = isRuntimeSchemaEnsureEnabled(
    "RUNTIME_SCHEMA_ENSURE_CLIENTE_DOCUMENTO"
);

function isMissingClienteDocumentoTableError(error) {
    const code = String(error?.code || "").trim();
    const message = String(error?.message || "").toLowerCase();
    return (
        ["42P01", "42703"].includes(code) &&
        message.includes("cliente_documento")
    );
}

function formatTimestampForClient(value) {
    if (!value) return value ?? null;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const pad = (input, size = 2) => String(input).padStart(size, '0');
    return [
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
    ].join(' ');
}

function normalizeDateFields(rows, fields) {
    return rows.map((row) => {
        const next = { ...row };
        fields.forEach((field) => {
            if (next[field] !== undefined && next[field] !== null) {
                next[field] = formatTimestampForClient(next[field]);
            }
        });
        return next;
    });
}

function normalizeQueueUserIds(values = []) {
    if (!Array.isArray(values)) return [];

    return [...new Set(
        values
            .map((value) => Number(value || 0))
            .filter((value) => Number.isInteger(value) && value > 0)
    )];
}

async function ensureClienteDocumentoSchema(client) {
    if (!RUNTIME_SCHEMA_ENSURE_CLIENTE_DOCUMENTO) {
        return;
    }

    await client.query(`
        create table if not exists public.cliente_documento (
            id bigserial primary key,
            empresa_id bigint not null,
            cliente_id bigint not null,
            usuario_id bigint,
            nome_arquivo character varying(255) not null,
            url text not null,
            path_bunny text,
            mime_type character varying(120),
            tamanho_bytes bigint,
            origem character varying(80) not null default 'contato',
            ativo boolean not null default true,
            data_criacao timestamp without time zone not null default (current_timestamp - interval '3 hours')
        )
    `);

    await client.query(`
        create index if not exists idx_cliente_documento_empresa_cliente_ativo
            on public.cliente_documento (empresa_id, cliente_id, ativo, data_criacao desc, id desc)
    `);

    await client.query(`
        alter table public.cliente_documento
        add column if not exists usuario_id bigint
    `);

    await client.query(`
        create index if not exists idx_cliente_documento_empresa_usuario_ativo
            on public.cliente_documento (empresa_id, usuario_id, ativo, data_criacao desc, id desc)
    `);
}

const execute = {
    execute_iniciar_atendimento: async (
        conversa_id,usuario_id
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.iniciar_atendimento(),[conversa_id,usuario_id]);
                return ret.rows
            } finally {
                client.release();
            }
    },
    execute_lista_aguardando_atendimento: async (
            empresa_id, allowedMetaParamIds = [], usuario_id = null
        ) => {
            const client = await postgres.connect();
            try {
                const ret = await client.query(models.lista_aguardando_atendimento(),[
                    empresa_id,
                    allowedMetaParamIds,
                    usuario_id
                ]);
                return normalizeDateFields(ret.rows, [
                    'data_inicio',
                    'fila_desde',
                    'ultima_atualizacao',
                    'ultima_mensagem_cliente_em',
                    'janela_meta_expira_em'
                ]);
            } finally {
                client.release();
            }
        },

    execute_lista_conversas_usuario:  async (
        usuario_id, empresa_id, allowedMetaParamIds = [], finishedLimit = 20
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.lista_conversas_usuario(),[
                    usuario_id,
                    empresa_id,
                    allowedMetaParamIds,
                    finishedLimit
                ]);
                return normalizeDateFields(ret.rows, [
                    'data_inicio',
                    'fila_desde',
                    'data_fim',
                    'ultima_atualizacao',
                    'ultima_mensagem_cliente_em',
                    'janela_meta_expira_em'
                ]);
            } finally {
                client.release();
            }
        },

    execute_lista_conversas_usuario_busca:  async (
        usuario_id, empresa_id, allowedMetaParamIds = []
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.lista_conversas_usuario_busca(),[
                    usuario_id,
                    empresa_id,
                    allowedMetaParamIds
                ]);
                return normalizeDateFields(ret.rows, [
                    'data_inicio',
                    'fila_desde',
                    'data_fim',
                    'ultima_atualizacao',
                    'ultima_mensagem_cliente_em',
                    'janela_meta_expira_em'
                ]);
            } finally {
                client.release();
            }
        },

    execute_lista_conversas_usuario_ativas: async (
        usuario_id,
        empresa_id,
        allowedMetaParamIds = []
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.lista_conversas_usuario_ativas(), [
                usuario_id,
                empresa_id,
                allowedMetaParamIds
            ]);
            return normalizeDateFields(ret.rows, [
                'data_inicio',
                'fila_desde',
                'data_fim',
                'ultima_atualizacao',
                'ultima_mensagem_cliente_em',
                'janela_meta_expira_em'
            ]);
        } finally {
            client.release();
        }
    },

    execute_lista_conversas_usuario_finalizadas: async (
        usuario_id,
        empresa_id,
        allowedMetaParamIds = [],
        finishedOffset = 0,
        finishedLimit = 20,
        finishedDateStart = null,
        finishedDateEnd = null
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.lista_conversas_usuario_finalizadas(), [
                usuario_id,
                empresa_id,
                allowedMetaParamIds,
                finishedOffset,
                finishedLimit,
                finishedDateStart,
                finishedDateEnd
            ]);
            return normalizeDateFields(ret.rows, [
                'data_inicio',
                'fila_desde',
                'data_fim',
                'ultima_atualizacao',
                'ultima_mensagem_cliente_em',
                'janela_meta_expira_em'
            ]);
        } finally {
            client.release();
        }
    },

    execute_lista_conversas_empresa: async (
        empresa_id, usuario_id = null, finishedLimit = 20
    ) => {
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.lista_conversas_empresa(), [
                    empresa_id,
                    usuario_id,
                    finishedLimit
                ]);
                return normalizeDateFields(ret.rows, [
                    'data_inicio',
                    'fila_desde',
                    'data_fim',
                    'ultima_atualizacao',
                    'ultima_mensagem_cliente_em',
                    'janela_meta_expira_em'
                ]);
            } finally {
                client.release();
            }
        },

    execute_lista_conversas_empresa_busca: async (
        empresa_id, usuario_id = null
    ) => {
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.lista_conversas_empresa_busca(), [empresa_id, usuario_id]);
                return normalizeDateFields(ret.rows, [
                    'data_inicio',
                    'fila_desde',
                    'data_fim',
                    'ultima_atualizacao',
                    'ultima_mensagem_cliente_em',
                    'janela_meta_expira_em'
                ]);
            } finally {
                client.release();
            }
        },

    execute_lista_conversas_empresa_ativas: async (
        empresa_id,
        usuario_id = null
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.lista_conversas_empresa_ativas(), [
                empresa_id,
                usuario_id
            ]);
            return normalizeDateFields(ret.rows, [
                'data_inicio',
                'fila_desde',
                'data_fim',
                'ultima_atualizacao',
                'ultima_mensagem_cliente_em',
                'janela_meta_expira_em'
            ]);
        } finally {
            client.release();
        }
    },

    execute_lista_conversas_empresa_finalizadas: async (
        empresa_id,
        usuario_id = null,
        finishedOffset = 0,
        finishedLimit = 20,
        finishedDateStart = null,
        finishedDateEnd = null
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.lista_conversas_empresa_finalizadas(), [
                empresa_id,
                usuario_id,
                finishedOffset,
                finishedLimit,
                finishedDateStart,
                finishedDateEnd
            ]);
            return normalizeDateFields(ret.rows, [
                'data_inicio',
                'fila_desde',
                'data_fim',
                'ultima_atualizacao',
                'ultima_mensagem_cliente_em',
                'janela_meta_expira_em'
            ]);
        } finally {
            client.release();
        }
    },

    execute_buscar_ultima_mensagem_por_conversas_pesquisa: async (
        conversa_ids = [],
        pesquisaLike
    ) => {
        const normalizedConversaIds = Array.isArray(conversa_ids)
            ? conversa_ids
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
            : [];
        if (!normalizedConversaIds.length) {
            return [];
        }

        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.buscar_ultima_mensagem_por_conversas_pesquisa(),
                [normalizedConversaIds, pesquisaLike]
            );
            return normalizeDateFields(ret.rows, ['data_mensagem']);
        } finally {
            client.release();
        }
    },

    
    execute_get_dados_conversa: async (conversa_id) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.get_dados_conversa(),[conversa_id]);
                return normalizeDateFields(ret.rows, [
                    'data_inicio',
                    'data_fim',
                    'ultima_atualizacao',
                    'ultima_mensagem_cliente_em',
                    'janela_meta_expira_em'
                ]);
            } finally {
                client.release();
            }
    },

    execute_get_conversa_janela_meta_envio: async (conversa_id) => {
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.get_conversa_janela_meta_envio(), [conversa_id]);
                return normalizeDateFields(ret.rows, [
                    'ultima_mensagem_cliente_em',
                    'janela_meta_expira_em'
                ]);
            } finally {
                client.release();
            }
    },

    execute_marcar_conversa_lida_usuario: async (conversa_id, usuario_id) => {
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.marcar_conversa_lida_usuario(), [conversa_id, usuario_id]);
                return ret.rows;
            } finally {
                client.release();
            }
    },
    
    execute_lista_mensagens_conversa: async (
        conversa_id,
        {
            afterTimestamp = null,
            afterSortId = null,
            beforeTimestamp = null,
            beforeSortId = null,
            limit = 100,
            includeCustomerHistory = false,
            historicalUserId = null
        } = {}
    ) =>{
         const client = await postgres.connect();
            try {
                const ret = await client.query(models.lista_mensagens_conversa(),[
                    conversa_id,
                    afterTimestamp,
                    afterSortId,
                    beforeTimestamp,
                    beforeSortId,
                    limit,
                    includeCustomerHistory,
                    historicalUserId
                ]);
                const rows = normalizeDateFields(ret.rows, ['timestamp']);
                const hasN8nMessages = Array.isArray(rows)
                    && rows.some((row) => String(row?.user_bubble || '').trim() === 'n8n IA');

                if (!hasN8nMessages) {
                    return rows;
                }

                try {
                    const companyConfig = await client.query(
                        models.get_conversa_n8n_ia_nome(),
                        [conversa_id]
                    );
                    const n8nIaNome = String(
                        companyConfig.rows?.[0]?.n8n_ia_nome || 'n8n IA'
                    ).trim() || 'n8n IA';

                    return rows.map((row) =>
                        String(row?.user_bubble || '').trim() === 'n8n IA'
                            ? {
                                ...row,
                                user_bubble: n8nIaNome
                            }
                            : row
                    );
                } catch (nameError) {
                    console.warn(
                        '[execute_lista_mensagens_conversa] falha ao resolver nome customizado da n8n IA:',
                        nameError?.message || nameError
                    );
                    return rows;
                }
            } finally {
                client.release();
            }
    },

    execute_send_mensagem: async (
        conversa_id, mensagem, whats_id
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.send_mensagem(),[conversa_id, mensagem, whats_id]);
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_get_mensagem_rapida: async (
        pesquisa, empresa_id, usuario_id
    ) => {
        const client = await postgres.connect();
            try {
                let like = '%' + pesquisa + '%'
                const ret = await client.query(models.get_mensagem_rapida(),[like, empresa_id, usuario_id]);
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_get_mensagem_rapida_legacy: async (
        pesquisa, empresa_id
    ) => {
        const client = await postgres.connect();
            try {
                let like = '%' + pesquisa + '%'
                const ret = await client.query(models.get_mensagem_rapida_legacy(),[like, empresa_id]);
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_get_paramentros_whats: async (
        empresa_id
    ) => {
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.get_paramentros_whats(),[empresa_id]);
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_get_cliente: async (
        conversa_id
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.get_cliente(),[conversa_id]);
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_detalhes_cliente: async (
        cliente_id
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.detalhes_cliente(),[cliente_id]);
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_get_cliente_info: async (
        cliente_id
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.get_cliente_info(),[cliente_id]);
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_list_cliente_documentos: async (cliente_id, empresa_id) => {
        const client = await postgres.connect();
        try {
            await ensureClienteDocumentoSchema(client);
            const ret = await client.query(models.list_cliente_documentos(), [cliente_id, empresa_id]);
            return ret.rows;
        } catch (error) {
            if (isMissingClienteDocumentoTableError(error)) {
                return [];
            }
            throw error;
        } finally {
            client.release();
        }
    },

    execute_count_cliente_documentos: async (cliente_id, empresa_id) => {
        const client = await postgres.connect();
        try {
            await ensureClienteDocumentoSchema(client);
            const ret = await client.query(models.count_cliente_documentos(), [cliente_id, empresa_id]);
            return Number(ret.rows?.[0]?.total || 0);
        } catch (error) {
            if (isMissingClienteDocumentoTableError(error)) {
                return 0;
            }
            throw error;
        } finally {
            client.release();
        }
    },

    execute_get_cliente_documento_by_id: async (documento_id, empresa_id) => {
        const client = await postgres.connect();
        try {
            await ensureClienteDocumentoSchema(client);
            const ret = await client.query(models.get_cliente_documento_by_id(), [documento_id, empresa_id]);
            return ret.rows[0] || null;
        } catch (error) {
            if (isMissingClienteDocumentoTableError(error)) {
                return null;
            }
            throw error;
        } finally {
            client.release();
        }
    },

    execute_criar_cliente_documento: async ({
        empresa_id,
        cliente_id,
        usuario_id,
        nome_arquivo,
        url,
        path_bunny,
        mime_type,
        tamanho_bytes,
        origem,
    }) => {
        const client = await postgres.connect();
        try {
            await ensureClienteDocumentoSchema(client);
            const ret = await client.query(models.insert_cliente_documento(), [
                empresa_id,
                cliente_id,
                usuario_id,
                nome_arquivo,
                url,
                path_bunny,
                mime_type,
                tamanho_bytes,
                origem,
            ]);
            return ret.rows[0] || null;
        } finally {
            client.release();
        }
    },

    execute_deletar_cliente_documento: async (documento_id, empresa_id) => {
        const client = await postgres.connect();
        try {
            await ensureClienteDocumentoSchema(client);
            const ret = await client.query(models.soft_delete_cliente_documento(), [documento_id, empresa_id]);
            return ret.rows[0] || null;
        } finally {
            client.release();
        }
    },

    execute_get_notas: async (
        cliente_id
    ) =>{
            const client = await postgres.connect();
            try {
                const ret = await client.query(models.get_notas(),[cliente_id]);
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_insert_mensagem_enviada: async (
        conversa_id,
        mensagem,
        mensagem_whats_id,
        usuario_id = null,
        reply = false,
        mensagem_reply_id = null
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.insert_mensagem_enviada(),[
                    conversa_id,
                    mensagem,
                    mensagem_whats_id,
                    usuario_id,
                    Boolean(reply),
                    mensagem_reply_id
                ]);
                if (ret.rows?.[0]?.id) {
                    developerWebhooks.queueMessageCreated(ret.rows[0].id);
                }
                return ret.rows
            } finally {
                client.release();
            }
    },


    execute_insert_mensagem_enviada_media: async (
        conversa_id, mensagem, mensagem_whats_id, media_id, type, usuario_id = null
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.insert_mensagem_enviada_media(),[
                    conversa_id,
                    mensagem,
                    mensagem_whats_id,
                    media_id,
                    type,
                    usuario_id
                ]);
                if (ret.rows?.[0]?.id) {
                    developerWebhooks.queueMessageCreated(ret.rows[0].id);
                }
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_get_number: async (
        conversa_id
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.get_number(),[conversa_id]);
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_get_mensagem_conversa_by_id: async (
        conversa_id,
        mensagem_id
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.get_mensagem_conversa_by_id(),[
                    conversa_id,
                    mensagem_id
                ]);
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_get_cliente_crm_atendimento: async (cliente_id, empresa_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.get_cliente_crm_atendimento(), [cliente_id, empresa_id]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_list_cliente_crm_interacoes: async (cliente_id, empresa_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.list_cliente_crm_interacoes(), [empresa_id, cliente_id]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_list_cliente_crm_historico: async (cliente_id, empresa_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.list_cliente_crm_historico(), [empresa_id, cliente_id]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_list_cliente_atendimentos_whatsapp: async (cliente_id, empresa_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.list_cliente_atendimentos_whatsapp(), [empresa_id, cliente_id]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_mensagem_automatica_whatsapp: async (
        empresa_id, tipo_id, empresa_meta_param_id = null
    ) =>{
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.get_mensagem_automatica_whatsapp(),[
                    empresa_id,
                    tipo_id,
                    empresa_meta_param_id,
                ]);
                return ret.rows
            } finally {
                client.release();
            }
    },

    execute_finalizar_atendimento: async (
        conversa_id
    ) =>{
        const client = await postgres.connect();
            try {
                await client.query(models.executefinalizar_atendimento(),[conversa_id]);
            } finally {
                client.release();
            }
    },

    execute_finalize_waiting_atendimentos_older_than_hours_by_empresa: async (
        empresa_id,
        hours
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.finalize_waiting_atendimentos_older_than_hours_by_empresa(),
                [empresa_id, hours]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_finalize_stale_atendimentos_by_last_customer_message: async (
        hours
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.finalize_stale_atendimentos_by_last_customer_message(),
                [hours]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_conversa_para_analise_ia: async (conversa_id, empresa_id) => {
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.get_conversa_para_analise_ia(), [conversa_id, empresa_id]);
                return ret.rows;
            } finally {
                client.release();
            }
    },

    execute_get_prompt_ia_atendimento_empresa: async (empresa_id) => {
        const client = await postgres.connect();
            try {
                const ret = await client.query(models.get_prompt_ia_atendimento_empresa(), [empresa_id]);
                return ret.rows;
            } finally {
                client.release();
            }
    },

    execute_get_usuario_atendimento_contexto: async (usuario_id, empresa_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.get_usuario_atendimento_contexto(), [
                usuario_id,
                empresa_id,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_list_usuario_meta_numero_ids: async (usuario_id, empresa_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.list_usuario_meta_numero_ids(), [
                usuario_id,
                empresa_id,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_conversa_contexto_acesso: async (conversa_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.get_conversa_contexto_acesso(), [conversa_id]);
            return normalizeDateFields(ret.rows, [
                'data_inicio',
                'fila_desde',
                'data_fim'
            ]);
        } finally {
            client.release();
        }
    },

    execute_get_empresa_atendimento_config: async (empresa_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.get_empresa_atendimento_config(), [empresa_id]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_get_last_fila_usuario_elegivel_por_numero: async (
        empresa_id,
        empresa_meta_param_id,
        usuario_ids = []
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(
                models.get_last_fila_usuario_elegivel_por_numero(),
                [empresa_id, empresa_meta_param_id, usuario_ids]
            );
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_update_empresa_atendimento_config: async (
        empresa_id,
        atendimento_lista_atribuida_adm,
        atendimento_mensagens_rapidas_ativas,
        atendimento_disparo_nps_ativo,
        atendimento_fila_automatica_ativa,
        atendimento_fila_usuarios = []
    ) => {
        const client = await postgres.connect();
        try {
            await client.query("BEGIN");

            const ret = await client.query(models.update_empresa_atendimento_config(), [
                empresa_id,
                atendimento_lista_atribuida_adm,
                atendimento_mensagens_rapidas_ativas,
                atendimento_disparo_nps_ativo,
                atendimento_fila_automatica_ativa,
            ]);

            await client.query(
                models.delete_empresa_atendimento_fila_usuarios(),
                [empresa_id]
            );

            const queueUserIds = normalizeQueueUserIds(atendimento_fila_usuarios);
            for (let index = 0; index < queueUserIds.length; index += 1) {
                await client.query(models.insert_empresa_atendimento_fila_usuario(), [
                    empresa_id,
                    queueUserIds[index],
                    index + 1,
                ]);
            }

            const configRows = await client.query(
                models.get_empresa_atendimento_config(),
                [empresa_id]
            );

            await client.query("COMMIT");
            return configRows.rows;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    },

    execute_update_conversa_usuario_atribuido: async (
        conversa_id,
        usuario_atribuido_id,
        empresa_id
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.update_conversa_usuario_atribuido(), [
                conversa_id,
                usuario_atribuido_id,
                empresa_id,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_transferir_atendimento_usuario: async (
        conversa_id,
        usuario_id,
        empresa_id
    ) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.transferir_atendimento_usuario(), [
                conversa_id,
                usuario_id,
                empresa_id,
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

    execute_mark_message_media_unavailable: async (conversa_id, media_id) => {
        const client = await postgres.connect();
        try {
            const ret = await client.query(models.mark_message_media_unavailable(), [
                conversa_id,
                String(media_id || "").trim(),
            ]);
            return ret.rows;
        } finally {
            client.release();
        }
    },

}

module.exports = execute
