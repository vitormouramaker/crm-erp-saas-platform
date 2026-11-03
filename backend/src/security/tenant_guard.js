const { postgres } = require("../server/connect");
const security = require("./cypher");
const utils = require("../utils/templates");

// Tabelas que podem ser checadas (o nome nunca vem do cliente).
const TENANT_TABLES = new Set([
  "cliente",
  "tag",
  "categoria",
  "empresa_filial",
  "fabricante",
  "produto",
  "entrada",
  "usuario",
]);

function collectIds(data, field) {
  // "items[].productId" -> todos os productId da lista items
  const listMatch = /^([a-zA-Z0-9_]+)\[\]\.([a-zA-Z0-9_]+)$/.exec(field);
  if (listMatch) {
    const list = Array.isArray(data?.[listMatch[1]]) ? data[listMatch[1]] : [];
    return list.map((item) => item?.[listMatch[2]]);
  }
  return [data?.[field]];
}

/**
 * Garante que os ids enviados no corpo pertencem a empresa da sessao.
 * As consultas antigas filtravam so por id; sem esta checagem, um usuario de
 * uma empresa alterava ou apagava registros de outra (IDOR entre tenants).
 *
 *   rota.post("/alterar_cliente", requireTenantOwnership([["cliente_id", "cliente"]]), ...)
 *
 * Campos vazios sao ignorados (a rota decide se sao obrigatorios).
 */
function requireTenantOwnership(rules) {
  for (const [, table] of rules) {
    if (!TENANT_TABLES.has(table)) throw new Error(`tabela nao permitida no tenant guard: ${table}`);
  }

  return async function tenantOwnershipMiddleware(req, res, next) {
    try {
      const empresaId = Number(req.auth?.empresa_id);
      if (!empresaId) {
        return res.status(401).json(utils.jsonMount(false, {}, "Sessao invalida ou expirada."));
      }
      // Corpo cru: confere exatamente os ids que o cliente mandou.
      const data = security.decodeRawPayload(req.body) || {};

      for (const [field, table] of rules) {
        const ids = collectIds(data, field)
          .filter((v) => v !== undefined && v !== null && v !== "")
          .map((v) => Number(v));
        if (!ids.length) continue;
        if (ids.some((v) => !Number.isInteger(v) || v <= 0)) {
          return res.json(utils.jsonMount(false, {}, "Registro nao encontrado."));
        }
        const unique = [...new Set(ids)];
        const ret = await postgres.query(
          `SELECT count(*)::int AS total FROM ${table} WHERE id = ANY($1::bigint[]) AND empresa_id = $2`,
          [unique, empresaId]
        );
        if (Number(ret.rows[0]?.total || 0) !== unique.length) {
          return res.json(utils.jsonMount(false, {}, "Registro nao encontrado."));
        }
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

// Apenas o usuario master (dono da conta) ou quem tem uma das permissoes.
function requireMasterOrPermission(...permissions) {
  return function masterOrPermissionMiddleware(req, res, next) {
    const auth = req.auth || {};
    const granted = Array.isArray(auth.permissions) ? auth.permissions : [];
    if (auth.is_master || permissions.some((p) => granted.includes(p))) {
      return next();
    }
    return res.status(403).json(utils.jsonMount(false, {}, "Voce nao tem permissao para esta acao."));
  };
}

module.exports = { requireTenantOwnership, requireMasterOrPermission };
