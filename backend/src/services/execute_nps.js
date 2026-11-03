const models = require("../models/models_nps");
const { postgres } = require("../server/connect");

function normalizeDashboardDateFilter(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function buildDashboardFilterParams(filters = {}) {
  let dateStart = normalizeDashboardDateFilter(
    filters?.dateStart || filters?.date_start || filters?.inicio
  );
  let dateEnd = normalizeDashboardDateFilter(
    filters?.dateEnd || filters?.date_end || filters?.fim
  );

  if (dateStart && dateEnd && dateStart > dateEnd) {
    [dateStart, dateEnd] = [dateEnd, dateStart];
  }

  const filialIdRaw =
    filters?.filial_id ??
    filters?.filialId ??
    filters?.branchId ??
    filters?.branch_id ??
    null;
  const filialId = Number.isInteger(Number(filialIdRaw)) && Number(filialIdRaw) > 0
    ? Number(filialIdRaw)
    : null;

  return [dateStart, dateEnd, filialId];
}

const execute = {
  execute_create_nps_pergunta: async (empresa_id, pergunta, ordem) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.create_nps_pergunta(), [
        empresa_id,
        pergunta,
        ordem,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_list_nps_perguntas: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_nps_perguntas(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_nps_pergunta_by_id: async (id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_nps_pergunta_by_id(), [id, empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_update_nps_pergunta: async (id, empresa_id, pergunta, ordem) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.update_nps_pergunta(), [
        id,
        empresa_id,
        pergunta,
        ordem,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_delete_nps_pergunta: async (id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.delete_nps_pergunta(), [id, empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_empresa_id_by_atendimento: async (atendimento_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_empresa_id_by_atendimento(), [atendimento_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_list_nps_perguntas_ativas_empresa: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_nps_perguntas_ativas_empresa(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_upsert_nps_resposta: async (empresa_id, atendimento_id, pergunta_id, nota, resposta_texto) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.upsert_nps_resposta(), [
        empresa_id,
        atendimento_id,
        pergunta_id,
        nota,
        resposta_texto,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_list_nps_respostas_atendimento: async (atendimento_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_nps_respostas_atendimento(), [
        atendimento_id,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_relatorio_nps_resumo: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.relatorio_nps_resumo(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_relatorio_nps_evolucao_diaria: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.relatorio_nps_evolucao_diaria(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_relatorio_nps_por_atendente: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.relatorio_nps_por_atendente(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_relatorio_nps_distribuicao_notas: async (empresa_id, filters = {}) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const ret = await client.query(models.relatorio_nps_distribuicao_notas(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_relatorio_nps_respostas_detalhadas: async (
    empresa_id,
    filters = {},
    limit = 100
  ) => {
    const client = await postgres.connect();
    try {
      const [dateStart, dateEnd, filialId] = buildDashboardFilterParams(filters);
      const normalizedLimit = Math.min(Math.max(Number(limit || 100) || 100, 1), 200);
      const ret = await client.query(models.relatorio_nps_respostas_detalhadas(), [
        empresa_id,
        dateStart,
        dateEnd,
        filialId,
        normalizedLimit,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
