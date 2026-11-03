const { postgres } = require("../server/connect");
const models = require("../models/models_app_safety");

const WORD_CACHE_TTL_MS = 60000;
const wordCache = new Map();

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeForMatch(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function withClient(callback) {
  const client = await postgres.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

const execute = {
  execute_get_cliente_empresa: (clienteId, empresaId) =>
    withClient(async (client) => {
      const ret = await client.query(models.get_cliente_empresa(), [clienteId, empresaId]);
      return ret.rows[0] || null;
    }),

  execute_get_conversa_cliente_contexto: (conversaId) =>
    withClient(async (client) => {
      const ret = await client.query(models.get_conversa_cliente_contexto(), [conversaId]);
      return ret.rows[0] || null;
    }),

  execute_bloquear_cliente: ({ empresa_id, cliente_id, usuario_id, motivo }) =>
    withClient(async (client) => {
      const ret = await client.query(models.bloquear_cliente(), [
        empresa_id, cliente_id, usuario_id || null, normalizeText(motivo) || null,
      ]);
      return ret.rows[0] || null;
    }),

  execute_desbloquear_cliente: ({ empresa_id, cliente_id, usuario_id }) =>
    withClient(async (client) => {
      const ret = await client.query(models.desbloquear_cliente(), [
        empresa_id, cliente_id, usuario_id || null,
      ]);
      return ret.rows[0] || null;
    }),

  execute_cliente_bloqueado: (empresaId, clienteId) =>
    withClient(async (client) => {
      const ret = await client.query(models.cliente_bloqueado(), [empresaId, clienteId]);
      return Boolean(ret.rows[0]?.bloqueado);
    }),

  execute_conversa_cliente_bloqueado: (conversaId) =>
    withClient(async (client) => {
      const ret = await client.query(models.conversa_cliente_bloqueado(), [conversaId]);
      return Boolean(ret.rows[0]?.bloqueado);
    }),

  execute_listar_clientes_bloqueados: (empresaId) =>
    withClient(async (client) => {
      const ret = await client.query(models.listar_clientes_bloqueados(), [empresaId]);
      return ret.rows;
    }),

  execute_criar_denuncia: (payload) =>
    withClient(async (client) => {
      const ret = await client.query(models.criar_denuncia(), [
        payload.empresa_id,
        payload.usuario_id || null,
        payload.cliente_id || null,
        payload.conversa_id || null,
        payload.mensagem_id || null,
        normalizeText(payload.tipo) || "abuso",
        normalizeText(payload.motivo),
        normalizeText(payload.descricao) || null,
        JSON.stringify(payload.dados || {}),
      ]);
      return ret.rows[0] || null;
    }),

  execute_apagar_mensagem_plataforma: ({ mensagem_id, conversa_id, empresa_id }) =>
    withClient(async (client) => {
      const ret = await client.query(models.apagar_mensagem_plataforma(), [
        mensagem_id, conversa_id, empresa_id,
      ]);
      return ret.rows[0] || null;
    }),

  execute_listar_palavras_bloqueadas: async (empresaId) => {
    const key = Number(empresaId) || 0;
    const cached = wordCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.words;
    const words = await withClient(async (client) => {
      const ret = await client.query(models.listar_palavras_bloqueadas(), [key]);
      return ret.rows.map((row) => normalizeText(row.palavra)).filter(Boolean);
    });
    wordCache.set(key, { words, expiresAt: Date.now() + WORD_CACHE_TTL_MS });
    return words;
  },

  execute_validar_conteudo_envio: async (empresaId, content) => {
    const normalizedContent = normalizeForMatch(content);
    if (!normalizedContent) return true;
    const words = await execute.execute_listar_palavras_bloqueadas(empresaId);
    const blockedWord = words.find((word) => normalizedContent.includes(normalizeForMatch(word)));
    if (blockedWord) {
      const error = new Error("A mensagem possui conteudo bloqueado pela politica da plataforma.");
      error.code = "CONTENT_BLOCKED";
      throw error;
    }
    return true;
  },
};

module.exports = execute;
