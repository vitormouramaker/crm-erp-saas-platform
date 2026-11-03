const models = require("../models/models_push");
const { postgres } = require("../server/connect");

function normalizePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizePushToken(value) {
  const token = String(value || "").trim();
  return token || null;
}

const execute = {
  execute_upsert_push_token: async ({
    usuario_id,
    empresa_id,
    expo_push_token,
    platform,
    device_id = null,
  }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.upsert_push_token(), [
        usuario_id,
        empresa_id,
        expo_push_token,
        platform,
        device_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_deactivate_push_token_by_user: async ({
    usuario_id,
    empresa_id,
    expo_push_token,
  }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.deactivate_push_token_by_user(), [
        usuario_id,
        empresa_id,
        expo_push_token,
      ]);
      return ret.rowCount || 0;
    } finally {
      client.release();
    }
  },

  execute_deactivate_push_tokens_by_values: async (tokens = []) => {
    const normalizedTokens = [...new Set(
      (tokens || []).map(normalizePushToken).filter(Boolean)
    )];

    if (!normalizedTokens.length) {
      return [];
    }

    const client = await postgres.connect();
    try {
      const ret = await client.query(
        models.deactivate_push_tokens_by_values(),
        [normalizedTokens]
      );
      return ret.rows || [];
    } finally {
      client.release();
    }
  },

  execute_get_push_dispatch_context: async (conversa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_push_dispatch_context(), [
        conversa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_get_empresa_push_dispatch_config: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_empresa_push_dispatch_config(), [
        empresa_id,
      ]);
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_list_push_target_user_ids_for_waiting_meta_number: async ({
    empresa_id,
    empresa_meta_param_id = null,
    atendimento_lista_atribuida_adm = false,
    atendimento_fila_automatica_ativa = false,
  }) => {
    const normalizedEmpresaId = normalizePositiveInt(empresa_id);
    const normalizedMetaParamId = normalizePositiveInt(empresa_meta_param_id);
    if (!normalizedEmpresaId) {
      return [];
    }

    const client = await postgres.connect();
    try {
      const ret = await client.query(
        models.list_push_target_user_ids_for_waiting_meta_number(),
        [
          normalizedEmpresaId,
          normalizedMetaParamId,
          Boolean(atendimento_lista_atribuida_adm),
          Boolean(atendimento_fila_automatica_ativa),
        ]
      );
      return [...new Set(
        (ret.rows || [])
          .map((row) => normalizePositiveInt(row?.usuario_id))
          .filter(Boolean)
      )];
    } finally {
      client.release();
    }
  },

  execute_list_push_target_user_ids: async ({
    empresa_id,
    conversa_id = null,
    usuario_ids = [],
  }) => {
    const normalizedEmpresaId = normalizePositiveInt(empresa_id);
    const explicitUserIds = [...new Set(
      (usuario_ids || [])
        .map(normalizePositiveInt)
        .filter(Boolean)
    )];

    if (explicitUserIds.length) {
      return explicitUserIds;
    }

    const normalizedConversaId = normalizePositiveInt(conversa_id);
    if (!normalizedEmpresaId || !normalizedConversaId) {
      return [];
    }

    const context = await execute.execute_get_push_dispatch_context(
      normalizedConversaId
    );
    if (!context || Number(context.empresa_id) !== normalizedEmpresaId) {
      return [];
    }

    const assignedUserId = normalizePositiveInt(
      context.usuario_atribuido_id || context.usuario_id
    );
    if (assignedUserId) {
      return [assignedUserId];
    }

    if (Number(context.status_id) === 0) {
      const empresaConfig =
        await execute.execute_get_empresa_push_dispatch_config(normalizedEmpresaId);
      const waitingTargets =
        await execute.execute_list_push_target_user_ids_for_waiting_meta_number({
          empresa_id: normalizedEmpresaId,
          empresa_meta_param_id: context.empresa_meta_param_id,
          atendimento_lista_atribuida_adm: Boolean(
            empresaConfig?.atendimento_lista_atribuida_adm
          ),
          atendimento_fila_automatica_ativa: Boolean(
            empresaConfig?.atendimento_fila_automatica_ativa
          ),
        });
      if (waitingTargets.length) {
        return waitingTargets;
      }
    }

    if (
      Number(context.status_id) === 0 &&
      normalizePositiveInt(context.setor_id)
    ) {
      const client = await postgres.connect();
      try {
        const ret = await client.query(
          models.list_push_target_user_ids_by_sector(),
          [normalizedEmpresaId, Number(context.setor_id)]
        );
        return [...new Set(
          (ret.rows || [])
            .map((row) => normalizePositiveInt(row.usuario_id))
            .filter(Boolean)
        )];
      } finally {
        client.release();
      }
    }

    return [];
  },

  execute_list_active_push_tokens_by_users: async ({
    empresa_id,
    usuario_ids = [],
  }) => {
    const normalizedEmpresaId = normalizePositiveInt(empresa_id);
    const normalizedUserIds = [...new Set(
      (usuario_ids || [])
        .map(normalizePositiveInt)
        .filter(Boolean)
    )];

    if (!normalizedEmpresaId || !normalizedUserIds.length) {
      return [];
    }

    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_active_push_tokens_by_users(), [
        normalizedEmpresaId,
        normalizedUserIds,
      ]);
      return ret.rows || [];
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
