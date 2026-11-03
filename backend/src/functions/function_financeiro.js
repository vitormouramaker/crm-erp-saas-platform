function get_payload(req, security) {
  return security.jwtdecript(req.body);
}

function unauthorized(res, utils) {
  return res
    .status(401)
    .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
}

function to_int(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" && value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return n;
}

function to_number(value, fallback = 0) {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return n;
}

function to_date(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function to_iso_date_only(value) {
  const d = to_date(value);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function add_months_to_iso_date(isoDate, monthsToAdd) {
  const base = to_date(isoDate);
  if (!base) return null;
  const d = new Date(base);
  d.setMonth(d.getMonth() + Number(monthsToAdd || 0));
  return d.toISOString().slice(0, 10);
}

function split_installments(totalValue, totalInstallments) {
  const installments = Math.max(1, to_int(totalInstallments, 1));
  const totalCents = Math.round(to_number(totalValue, 0) * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainder = totalCents - baseCents * installments;
  const values = [];

  for (let i = 0; i < installments; i += 1) {
    const cents = baseCents + (i < remainder ? 1 : 0);
    values.push(cents / 100);
  }

  return values;
}

function to_boolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "sim", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "nao", "no", "n", "off", ""].includes(normalized)) return false;
  }

  return fallback;
}

function to_month_reference(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function require_empresa(data, res, utils) {
  const empresaId = to_int(data?.empresa_id);
  if (!empresaId || empresaId <= 0) {
    res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    return null;
  }
  return empresaId;
}

module.exports = {
  get_payload,
  unauthorized,
  to_int,
  to_number,
  to_date,
  to_iso_date_only,
  add_months_to_iso_date,
  split_installments,
  to_boolean,
  to_month_reference,
  require_empresa,
};
