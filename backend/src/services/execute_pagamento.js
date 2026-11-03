const crypto = require("crypto");
const models = require("../models/models_pagamento");
const { postgres } = require("../server/connect");
const security = require("../security/cypher");
const emailService = require("../server/email");
const { isRuntimeSchemaEnsureEnabled } = require("../utils/runtime_schema");

const STRIPE_API_BASE = process.env.STRIPE_API_BASE || "https://api.stripe.com/v1";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || "2025-07-30.basil";
const FRONTEND_SUCCESS_URL =
  process.env.STRIPE_SUCCESS_URL ||
  process.env.FRONTEND_SUCCESS_URL ||
  `${process.env.APP_WEB_BASE_URL || "http://localhost:5173"}/assinatura`;
const FRONTEND_CANCEL_URL =
  process.env.STRIPE_CANCEL_URL ||
  process.env.FRONTEND_CANCEL_URL ||
  `${process.env.APP_WEB_BASE_URL || "http://localhost:5173"}/assinatura`;
const FRONTEND_ONBOARDING_URL =
  process.env.STRIPE_ONBOARDING_URL ||
  process.env.FRONTEND_ONBOARDING_URL ||
  `${process.env.APP_WEB_BASE_URL || "http://localhost:5173"}/finalizar-cadastro`;
const FRONTEND_BILLING_PORTAL_RETURN_URL =
  process.env.STRIPE_BILLING_PORTAL_RETURN_URL ||
  process.env.FRONTEND_BILLING_PORTAL_RETURN_URL ||
  FRONTEND_SUCCESS_URL;
const STRIPE_BILLING_PORTAL_CONFIGURATION_ID =
  process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID || "";
// Integracao Gestao 360: plano concedido ao assinante (padrao 2 = Business).
const GESTAO360_ASSINATURA_ID = Number(process.env.GESTAO360_ASSINATURA_ID || 2) || 2;
const GESTAO360_ORIGEM = "gestao360";
const GESTAO360_LOCK_KEY = 360360;
const RUNTIME_SCHEMA_ENSURE_GESTAO360 = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SCHEMA_ENSURE_GESTAO360"
);
let gestao360SchemaEnsured = false;

function ensureStripeConfigured() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY nao configurada.");
  }
}

function mapStripeStatusToActive(status) {
  return ["active", "trialing", "past_due"].includes(status);
}

function unixToDateOrNull(unixValue) {
  if (unixValue === undefined || unixValue === null || unixValue === "") {
    return null;
  }

  if (unixValue instanceof Date && !Number.isNaN(unixValue.getTime())) {
    return unixValue;
  }

  // Stripe usually sends Unix (seconds), but some payloads may arrive as ISO strings.
  if (typeof unixValue === "string" && Number.isNaN(Number(unixValue))) {
    const isoDate = new Date(unixValue);
    return Number.isNaN(isoDate.getTime()) ? null : isoDate;
  }

  const numericValue = Number(unixValue);
  if (Number.isNaN(numericValue)) {
    return null;
  }

  // Heuristic: values > 1e12 are likely milliseconds, otherwise seconds.
  const milliseconds = numericValue > 1e12 ? numericValue : numericValue * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

function coerceDateOrNull(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    return unixToDateOrNull(value);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractStripePeriodEnd(stripeSubscription, fallback = {}) {
  return (
    unixToDateOrNull(stripeSubscription?.current_period_end) ||
    unixToDateOrNull(stripeSubscription?.items?.data?.[0]?.current_period_end) ||
    unixToDateOrNull(stripeSubscription?.current_period_end_at) ||
    unixToDateOrNull(stripeSubscription?.trial_end) ||
    unixToDateOrNull(fallback?.current_period_end) ||
    null
  );
}

function extractInvoicePeriodBounds(invoice = {}) {
  const linePeriods = Array.isArray(invoice?.lines?.data)
    ? invoice.lines.data
        .map((line) => ({
          start: Number(line?.period?.start || 0),
          end: Number(line?.period?.end || 0),
        }))
        .filter((period) => period.start > 0 || period.end > 0)
    : [];

  const periodStartUnix =
    linePeriods.length > 0
      ? Math.min(...linePeriods.map((period) => period.start).filter(Boolean))
      : null;
  const periodEndUnix =
    linePeriods.length > 0
      ? Math.max(...linePeriods.map((period) => period.end).filter(Boolean))
      : null;

  return {
    periodStart: unixToDateOrNull(periodStartUnix),
    periodEnd:
      unixToDateOrNull(periodEndUnix) ||
      unixToDateOrNull(invoice?.period_end) ||
      null,
  };
}

function centsToDecimal(value) {
  if (value === undefined || value === null) {
    return 0;
  }
  return Number(value) / 100;
}

function formatMoneyFromCents(value, currency = "BRL") {
  const amount = centsToDecimal(value);
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: String(currency || "BRL").toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount);
  } catch (_) {
    return `R$ ${amount.toFixed(2)}`;
  }
}

function normalizeBillingCycle(value) {
  return value === "yearly" ? "yearly" : "monthly";
}

function normalizeUiMode(value) {
  return value === "embedded" ? "embedded" : "hosted";
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function resolveStripePriceIdByCycle(plano, billingCycle) {
  const cycle = normalizeBillingCycle(billingCycle);

  if (cycle === "yearly") {
    return plano?.stripe_price_id_yearly || plano?.stripe_price_id || null;
  }

  return plano?.stripe_price_id_monthly || plano?.stripe_price_id || null;
}

function normalizeAddonQuantity(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return Math.max(0, Number(fallback || 0));
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Number(fallback || 0));
  }
  return Math.max(0, Math.floor(parsed));
}

function normalizeAddonBillingCycle(value, fallback = "monthly") {
  if (value === "yearly" || value === "monthly") {
    return value;
  }
  return normalizeBillingCycle(fallback);
}

function hasMixedIntervals(planCycle, addonQuantities = {}, addonCycles = {}) {
  const normalizedPlanCycle = normalizeBillingCycle(planCycle);
  const addonKeys = ["additional_user", "additional_crm", "additional_leads"];
  return addonKeys.some((key) => {
    const quantity = normalizeAddonQuantity(addonQuantities[key], 0);
    if (quantity <= 0) return false;
    const cycle = normalizeAddonBillingCycle(addonCycles[key], normalizedPlanCycle);
    return cycle !== normalizedPlanCycle;
  });
}

async function ensureFlexibleBillingModeForSubscription(subscription) {
  const subscriptionId = subscription?.id;
  if (!subscriptionId) return subscription;

  const mode = String(subscription?.billing_mode?.type || "").toLowerCase();
  if (mode === "flexible") return subscription;

  try {
    await stripeRequest("POST", `/subscriptions/${subscriptionId}/migrate`, {
      "billing_mode[type]": "flexible",
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (
      message.includes("already") &&
      message.includes("flexible")
    ) {
      return subscription;
    }
    throw new Error(
      "Nao foi possivel migrar a assinatura para flexible billing mode na Stripe. Verifique API version >= 2025-06-30.basil."
    );
  }

  return stripeRequest(
    "GET",
    `/subscriptions/${subscriptionId}?expand[]=items.data.price`
  );
}

function normalizeAddonCode(rawCode) {
  const code = String(rawCode || "").trim().toLowerCase();
  if (
    [
      "additional_user",
      "usuario_adicional",
      "usuarios_adicionais",
      "usuarios",
      "users",
    ].includes(code)
  ) {
    return "additional_user";
  }

  if (
    [
      "additional_crm",
      "crm_adicional",
      "crms_adicionais",
      "crm",
      "crms",
    ].includes(code)
  ) {
    return "additional_crm";
  }

  if (
    [
      "additional_leads",
      "lead_adicional",
      "leads_adicionais",
      "lead",
      "leads",
    ].includes(code)
  ) {
    return "additional_leads";
  }

  return null;
}

function resolveAddonPriceIdByCycle(addon, billingCycle) {
  const cycle = normalizeAddonBillingCycle(billingCycle);
  if (cycle === "yearly") {
    return addon?.price_id_yearly || addon?.price_id_monthly || addon?.price_id_default || null;
  }
  return addon?.price_id_monthly || addon?.price_id_default || addon?.price_id_yearly || null;
}

async function loadAddonConfigs(client) {
  const ret = await client.query(models.get_addons_ativos());
  const rows = ret.rows || [];
  const map = {
    additional_user: null,
    additional_crm: null,
    additional_leads: null,
  };

  rows.forEach((row) => {
    const normalizedCode = normalizeAddonCode(row.codigo);
    if (!normalizedCode) return;

    const allPriceIds = [
      row.stripe_price_id,
      row.stripe_price_id_monthly,
      row.stripe_price_id_yearly,
    ].filter(Boolean);

    map[normalizedCode] = {
      id: row.id,
      codigo: normalizedCode,
      nome: row.nome,
      price_id_default: row.stripe_price_id || null,
      price_id_monthly: row.stripe_price_id_monthly || row.stripe_price_id || null,
      price_id_yearly:
        row.stripe_price_id_yearly ||
        row.stripe_price_id_monthly ||
        row.stripe_price_id ||
        null,
      all_price_ids: allPriceIds,
    };
  });

  return map;
}

function resolveAddonCycleFromSubscriptionItem(item, config) {
  const priceId = item?.price?.id || null;
  if (priceId && priceId === config?.price_id_yearly) return "yearly";
  if (priceId && priceId === config?.price_id_monthly) return "monthly";

  const interval = String(item?.price?.recurring?.interval || "").toLowerCase();
  if (interval === "year") return "yearly";
  if (interval === "month") return "monthly";
  return "monthly";
}

function extractAddonStatesFromSubscription(stripeSubscription, addonConfigByCode = {}) {
  const items = Array.isArray(stripeSubscription?.items?.data)
    ? stripeSubscription.items.data
    : [];

  const getStateByConfig = (config) => {
    if (!config) return { quantity: 0, billing_cycle: "monthly" };
    const ids = new Set((config.all_price_ids || []).filter(Boolean));
    if (!ids.size) return { quantity: 0, billing_cycle: "monthly" };

    const matchingItems = items.filter((item) => {
      const priceId = item?.price?.id || null;
      return Boolean(priceId && ids.has(priceId));
    });

    if (!matchingItems.length) return { quantity: 0, billing_cycle: "monthly" };

    const quantity = matchingItems.reduce(
      (acc, item) => acc + normalizeAddonQuantity(item?.quantity, 0),
      0
    );
    const billing_cycle = resolveAddonCycleFromSubscriptionItem(
      matchingItems[0],
      config
    );

    return { quantity, billing_cycle };
  };

  return {
    additional_user: getStateByConfig(addonConfigByCode.additional_user),
    additional_crm: getStateByConfig(addonConfigByCode.additional_crm),
    additional_leads: getStateByConfig(addonConfigByCode.additional_leads),
  };
}

async function resolveStripeDiscount({
  coupon_code,
  promotion_code,
  coupon_id,
}) {
  const explicitPromotionCode = normalizeOptionalText(promotion_code);
  if (explicitPromotionCode) {
    return {
      type: "promotion_code",
      value: explicitPromotionCode,
      source: "promotion_code",
    };
  }

  const explicitCouponId = normalizeOptionalText(coupon_id);
  if (explicitCouponId) {
    return {
      type: "coupon",
      value: explicitCouponId,
      source: "coupon_id",
    };
  }

  const code = normalizeOptionalText(coupon_code);
  if (!code) return null;

  const promotionCodeList = await stripeRequest(
    "GET",
    `/promotion_codes?code=${encodeURIComponent(code)}&active=true&limit=1`
  );
  const promotionCode = promotionCodeList?.data?.[0];

  if (!promotionCode?.id) {
    throw new Error(
      "Cupom/codigo promocional invalido ou inativo na Stripe."
    );
  }

  return {
    type: "promotion_code",
    value: promotionCode.id,
    source: "coupon_code",
    entered_code: code,
  };
}

function parseStripeSignatureHeader(signatureHeader) {
  const chunks = String(signatureHeader || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const parsed = { t: null, v1: [] };
  chunks.forEach((chunk) => {
    const [key, value] = chunk.split("=");
    if (key === "t") {
      parsed.t = value;
    }
    if (key === "v1" && value) {
      parsed.v1.push(value);
    }
  });

  return parsed;
}

function secureCompareHex(a, b) {
  try {
    const aBuffer = Buffer.from(String(a || ""), "hex");
    const bBuffer = Buffer.from(String(b || ""), "hex");

    if (
      aBuffer.length === 0 ||
      bBuffer.length === 0 ||
      aBuffer.length !== bBuffer.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(aBuffer, bBuffer);
  } catch (error) {
    return false;
  }
}

function verifyStripeWebhookSignature(rawBodyBuffer, signatureHeader) {
  // Sem segredo configurado, nenhum evento e aceito (antes aceitava tudo).
  if (!STRIPE_WEBHOOK_SECRET) {
    return false;
  }

  const { t, v1 } = parseStripeSignatureHeader(signatureHeader);
  if (!t || v1.length === 0) {
    return false;
  }

  const rawBody = rawBodyBuffer.toString("utf8");
  const signedPayload = `${t}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(signedPayload, "utf8")
    .digest("hex");

  const timestampAgeSeconds = Math.abs(
    Math.floor(Date.now() / 1000) - Number(t)
  );
  if (Number.isNaN(timestampAgeSeconds) || timestampAgeSeconds > 300) {
    return false;
  }

  return v1.some((sig) => secureCompareHex(sig, expectedSignature));
}

function buildStripeFormBody(payload = {}) {
  const params = new URLSearchParams();

  const appendValue = (key, value) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        appendValue(`${key}[${index}]`, item);
      });
      return;
    }

    if (typeof value === "object") {
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        appendValue(`${key}[${nestedKey}]`, nestedValue);
      });
      return;
    }

    params.append(key, String(value));
  };

  Object.entries(payload).forEach(([key, value]) => appendValue(key, value));

  return params.toString();
}

async function stripeRequest(method, path, body = null) {
  ensureStripeConfigured();

  const headers = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
  };
  if (STRIPE_API_VERSION) {
    headers["Stripe-Version"] = STRIPE_API_VERSION;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.body = buildStripeFormBody(body);
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, options);
  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { raw: text };
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Erro Stripe (${response.status}) na chamada ${method} ${path}`;
    const err = new Error(message);
    err.status = response.status;
    err.response = data;
    throw err;
  }

  return data;
}

async function previewSubscriptionProration({
  customerId,
  subscriptionId,
  subscriptionItemId,
  targetPriceId,
}) {
  if (!customerId || !subscriptionId || !subscriptionItemId || !targetPriceId) {
    return null;
  }

  try {
    const upcoming = await stripeRequest(
      "GET",
      `/invoices/upcoming?customer=${encodeURIComponent(
        customerId
      )}&subscription=${encodeURIComponent(
        subscriptionId
      )}&subscription_items[0][id]=${encodeURIComponent(
        subscriptionItemId
      )}&subscription_items[0][price]=${encodeURIComponent(targetPriceId)}`
    );

    const amountDue = Number(upcoming?.amount_due || 0);
    const total = Number(upcoming?.total || 0);
    const currency = String(upcoming?.currency || "BRL").toUpperCase();

    return {
      invoice_id: upcoming?.id || null,
      currency,
      amount_due: amountDue,
      total,
      amount_due_formatted: formatMoneyFromCents(amountDue, currency),
      total_formatted: formatMoneyFromCents(total, currency),
    };
  } catch (error) {
    // Falha na prévia não deve bloquear a troca de plano.
    return null;
  }
}

function normalizeSubscriptionPayload(stripeSubscription, fallback = {}) {
  const stripeItems = Array.isArray(stripeSubscription?.items?.data)
    ? stripeSubscription.items.data
    : [];
  const stripePriceIds = stripeItems
    .map((item) => item?.price?.id || null)
    .filter(Boolean);
  const priceId =
    fallback.stripe_price_id ||
    stripePriceIds[0] ||
    stripeSubscription?.plan?.id ||
    null;

  const currentPeriodEndDate = extractStripePeriodEnd(
    stripeSubscription,
    fallback
  );

  const metadata = stripeSubscription?.metadata || {};
  const status =
    stripeSubscription?.status || fallback.stripe_status || fallback.status || null;

  return {
    stripe_customer_id:
      stripeSubscription?.customer || fallback.stripe_customer_id || null,
    stripe_subscription_id:
      stripeSubscription?.id || fallback.stripe_subscription_id || null,
    stripe_status: status,
    stripe_price_id: priceId,
    stripe_price_ids: stripePriceIds,
    stripe_current_period_end: currentPeriodEndDate,
    stripe_cancel_at_period_end:
      stripeSubscription?.cancel_at_period_end ??
      fallback.stripe_cancel_at_period_end ??
      false,
    empresa_id: Number(metadata.empresa_id || fallback.empresa_id || 0) || null,
    assinatura_id:
      Number(metadata.assinatura_id || fallback.assinatura_id || 0) || null,
    billing_cycle: normalizeBillingCycle(
      metadata.billing_cycle || fallback.billing_cycle || "monthly"
    ),
    additional_user: normalizeAddonQuantity(
      metadata.additional_user,
      fallback.additional_user || 0
    ),
    additional_user_cycle: normalizeAddonBillingCycle(
      metadata.additional_user_cycle,
      fallback.additional_user_cycle || "monthly"
    ),
    additional_crm: normalizeAddonQuantity(
      metadata.additional_crm,
      fallback.additional_crm || 0
    ),
    additional_crm_cycle: normalizeAddonBillingCycle(
      metadata.additional_crm_cycle,
      fallback.additional_crm_cycle || "monthly"
    ),
    additional_leads: normalizeAddonQuantity(
      metadata.additional_leads,
      fallback.additional_leads || 0
    ),
    additional_leads_cycle: normalizeAddonBillingCycle(
      metadata.additional_leads_cycle,
      fallback.additional_leads_cycle || "monthly"
    ),
    ativo: mapStripeStatusToActive(status),
    validade: currentPeriodEndDate
      ? currentPeriodEndDate.toISOString().slice(0, 10)
      : null,
  };
}

// Link de "finalizar cadastro": JWT assinado, com validade e de uso unico (ver
// security.generateOnboardingToken). O hash de senha atual entra no token so
// como resumo HMAC, para o link morrer quando a senha for definida.
async function buildOnboardingUrl({ empresaId, email, stripeCustomerId }) {
  const senhaRet = await postgres.query(
    "SELECT senha FROM usuario WHERE empresa_id = $1 AND lower(email) = lower($2) ORDER BY is_master DESC, id ASC LIMIT 1",
    [empresaId, email]
  );
  const params = new URLSearchParams();
  if (email) params.set("email", String(email));
  const token = security.generateOnboardingToken({
    empresa_id: empresaId,
    email,
    stripe_customer_id: stripeCustomerId || null,
    senha_hash: senhaRet.rows[0]?.senha || "",
  });
  params.set("token", token);
  return `${FRONTEND_ONBOARDING_URL}?${params.toString()}`;
}

function buildOnboardingPayload({
  usuario_email,
  usuario_nome,
  empresa_nome,
  empresa_id,
  stripe_customer_id,
}) {
  if (!usuario_email || !empresa_id) return null;

  return {
    usuario_email,
    usuario_nome: usuario_nome || "Administrador",
    empresa_nome: empresa_nome || "Nova empresa",
    empresa_id,
    stripe_customer_id: stripe_customer_id || null,
  };
}

function shouldSendOnboardingForUsuarioEmpresa(usuario = {}) {
  if (!usuario) return false;
  if (!Boolean(usuario.usuario_ativo) || !Boolean(usuario.empresa_ativo)) {
    return true;
  }

  const requiredEmpresaFields = [
    usuario.cnpj,
    usuario.logradouro,
    usuario.numero,
    usuario.bairro,
    usuario.cidade,
    usuario.uf,
    usuario.cep,
  ];

  return requiredEmpresaFields.some((value) => !normalizeOptionalText(value));
}

async function loadOnboardingPayloadIfNeeded(
  client,
  { empresaId, email, userName, companyName, stripeCustomerId }
) {
  if (!empresaId || !email) return null;

  const existingUser = await client.query(
    models.get_usuario_empresa_por_empresa_email_checkout(),
    [empresaId, email]
  );
  const usuario = existingUser.rows[0] || null;
  if (!usuario) return null;

  const shouldSendOnboarding = shouldSendOnboardingForUsuarioEmpresa(usuario);
  if (!shouldSendOnboarding) return null;

  return buildOnboardingPayload({
    usuario_email: normalizeOptionalText(usuario.email || email),
    usuario_nome: usuario.usuario_nome || userName,
    empresa_nome: usuario.empresa_nome || companyName,
    empresa_id: Number(usuario.empresa_id || empresaId),
    stripe_customer_id: stripeCustomerId,
  });
}

async function sendOnboardingEmailSafely(onboardingPayload) {
  if (!onboardingPayload?.usuario_email) return;

  try {
    const onboardingUrl = await buildOnboardingUrl({
      empresaId: onboardingPayload.empresa_id,
      email: onboardingPayload.usuario_email,
      stripeCustomerId: onboardingPayload.stripe_customer_id,
    });
    await emailService.send_onboarding_empresa(onboardingPayload.usuario_email, {
      nome: onboardingPayload.usuario_nome,
      nomeEmpresa: onboardingPayload.empresa_nome,
      onboardingUrl,
    });
  } catch (mailError) {
    console.error(
      "[pagamento/webhook] falha ao enviar e-mail de onboarding:",
      mailError
    );
  }
}

function extractCheckoutIdentity(session = {}) {
  const customerDetails = session?.customer_details || {};
  const collected = session?.collected_information || {};
  const metadata = session?.metadata || {};

  const email = normalizeOptionalText(
    customerDetails?.email ||
      session?.customer_email ||
      metadata?.email ||
      null
  );
  const businessName = normalizeOptionalText(
    customerDetails?.business_name ||
      collected?.business_name ||
      metadata?.company_name ||
      metadata?.business_name ||
      customerDetails?.name ||
      null
  );
  const individualName = normalizeOptionalText(
    customerDetails?.individual_name ||
      collected?.individual_name ||
      metadata?.user_name ||
      null
  );

  const userName = individualName || businessName || "Administrador";
  const companyName = businessName || userName || "Nova empresa";

  return {
    email,
    userName,
    companyName,
  };
}

function extractStripeCustomerIdentity(stripeCustomer = {}, fallback = {}) {
  const metadata = stripeCustomer?.metadata || {};
  const email = normalizeOptionalText(
    stripeCustomer?.email || metadata?.email || fallback?.email || null
  );
  const baseName = normalizeOptionalText(
    stripeCustomer?.name ||
      metadata?.business_name ||
      metadata?.company_name ||
      fallback?.companyName ||
      null
  );
  const userName = normalizeOptionalText(fallback?.userName || baseName || "Administrador");
  const companyName = normalizeOptionalText(baseName || userName || "Nova empresa");

  return {
    email,
    userName,
    companyName,
  };
}

async function ensureDefaultCrmForEmpresa(client, empresaId) {
  if (!empresaId) return null;

  const crmAtualRet = await client.query(models.get_default_crm_empresa(), [empresaId]);
  let crm = crmAtualRet.rows[0] || null;

  if (!crm?.id) {
    const crmInsertRet = await client.query(models.insert_crm_master_checkout(), [
      empresaId,
      "Pipeline Principal",
      "CRM padrao criado automaticamente no onboarding de assinatura.",
    ]);
    crm = crmInsertRet.rows[0] || null;
  }

  if (!crm?.id) {
    return null;
  }

  const defaultStages = [
    {
      codigo: "waiting",
      nome: "Aguardando Atendimento",
      ordem: 0,
      cor: "#4299e1",
      eh_inicial: true,
      eh_fechamento: false,
      eh_ganho: false,
    },
    {
      codigo: "closed-won",
      nome: "Fechado Ganho",
      ordem: 1,
      cor: "#48bb78",
      eh_inicial: false,
      eh_fechamento: true,
      eh_ganho: true,
    },
    {
      codigo: "closed-lost",
      nome: "Fechado Perdido",
      ordem: 2,
      cor: "#f56565",
      eh_inicial: false,
      eh_fechamento: true,
      eh_ganho: false,
    },
  ];

  for (const etapa of defaultStages) {
    const etapaRet = await client.query(models.get_etapa_by_codigo_crm(), [crm.id, etapa.codigo]);
    if (etapaRet.rows.length) continue;

    await client.query(models.insert_etapa_crm(), [
      crm.id,
      etapa.codigo,
      etapa.nome,
      etapa.ordem,
      etapa.cor,
      etapa.eh_inicial,
      etapa.eh_fechamento,
      etapa.eh_ganho,
    ]);
  }

  return crm.id;
}

// Cria empresa + usuario master (senha aleatoria) + CRM padrao.
// Nao abre transacao: quem chama controla BEGIN/COMMIT.
async function createEmpresaComUsuarioMaster(client, identity = {}) {
  const generatedPassword = crypto.randomBytes(18).toString("hex");
  const hashedPassword = security.hashPassword(generatedPassword);

  const empresaInsert = await client.query(models.insert_empresa_checkout(), [
    identity.companyName,
    identity.companyName,
  ]);
  const empresa = empresaInsert.rows[0];
  if (!empresa?.id) {
    throw new Error("Falha ao criar empresa no webhook de checkout Stripe.");
  }

  const usuarioInsert = await client.query(models.insert_usuario_master_checkout(), [
    identity.userName,
    identity.email,
    hashedPassword,
    empresa.id,
  ]);

  await ensureDefaultCrmForEmpresa(client, Number(empresa.id));

  return {
    empresa,
    usuario: usuarioInsert.rows[0] || null,
    senha_inicial: hashedPassword,
  };
}

async function resolveOrCreateEmpresaByIdentity(client, identity = {}) {
  if (!identity.email) {
    throw new Error(
      "Nao foi possivel identificar o email do cliente para vincular a empresa."
    );
  }

  const existingUser = await client.query(models.get_usuario_empresa_por_email_checkout(), [
    identity.email,
  ]);
  const usuario = existingUser.rows[0] || null;

  if (usuario?.empresa_id) {
    await ensureDefaultCrmForEmpresa(client, Number(usuario.empresa_id));

    return {
      empresa_id: Number(usuario.empresa_id),
      usuario_email: identity.email,
      usuario_nome: usuario.usuario_nome || identity.userName,
      empresa_nome: usuario.empresa_nome || identity.companyName,
      created: false,
      should_send_onboarding: shouldSendOnboardingForUsuarioEmpresa(usuario),
    };
  }

  await client.query("BEGIN");
  try {
    const { empresa } = await createEmpresaComUsuarioMaster(client, identity);

    await client.query("COMMIT");

    return {
      empresa_id: Number(empresa.id),
      usuario_email: identity.email,
      usuario_nome: identity.userName,
      empresa_nome: empresa.nome_fantasia || identity.companyName,
      created: true,
      should_send_onboarding: true,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // noop
    }
    throw error;
  }
}

async function resolveOrCreateEmpresaByCheckoutSession(client, session = {}) {
  return resolveOrCreateEmpresaByIdentity(client, extractCheckoutIdentity(session));
}

async function resolveOrCreateEmpresaByStripeCustomer(
  client,
  stripeCustomer = {},
  fallbackIdentity = {}
) {
  return resolveOrCreateEmpresaByIdentity(
    client,
    extractStripeCustomerIdentity(stripeCustomer, fallbackIdentity)
  );
}

async function resolveCheckoutFallbackForSubscription(client, stripeSubscription = {}) {
  const subscriptionId = normalizeOptionalText(stripeSubscription?.id);
  const customerId = normalizeOptionalText(stripeSubscription?.customer);
  if (!subscriptionId && !customerId) {
    return { fallback: {}, onboardingPayload: null };
  }

  let session = null;

  if (subscriptionId) {
    const bySubscription = await stripeRequest(
      "GET",
      `/checkout/sessions?subscription=${encodeURIComponent(
        subscriptionId
      )}&limit=1`
    );
    if (Array.isArray(bySubscription?.data) && bySubscription.data.length) {
      session = bySubscription.data[0];
    }
  }

  if (!session && customerId) {
    const byCustomer = await stripeRequest(
      "GET",
      `/checkout/sessions?customer=${encodeURIComponent(
        customerId
      )}&status=complete&limit=5`
    );
    if (Array.isArray(byCustomer?.data) && byCustomer.data.length) {
      session =
        byCustomer.data.find(
          (item) =>
            String(item?.mode || "").toLowerCase() === "subscription" &&
            String(item?.subscription || "") === String(subscriptionId || "")
        ) ||
        byCustomer.data.find(
          (item) => String(item?.mode || "").toLowerCase() === "subscription"
        ) ||
        byCustomer.data[0];
    }
  }

  if (!session) {
    const stripeCustomer = customerId
      ? await stripeRequest(
          "GET",
          `/customers/${encodeURIComponent(customerId)}`
        )
      : null;
    const fallbackIdentity = {
      email: normalizeOptionalText(stripeSubscription?.metadata?.email || null),
      userName: normalizeOptionalText(stripeSubscription?.metadata?.user_name || null),
      companyName: normalizeOptionalText(stripeSubscription?.metadata?.company_name || null),
    };

    if (!stripeCustomer && !fallbackIdentity.email) {
      return { fallback: {}, onboardingPayload: null };
    }

    const empresaResultado = await resolveOrCreateEmpresaByStripeCustomer(
      client,
      stripeCustomer || {},
      fallbackIdentity
    );

    return {
      fallback: {
        empresa_id: empresaResultado?.empresa_id || null,
        assinatura_id:
          Number(stripeSubscription?.metadata?.assinatura_id || 0) || null,
        stripe_customer_id: customerId || null,
        billing_cycle:
          stripeSubscription?.metadata?.billing_cycle || "monthly",
        additional_user: normalizeAddonQuantity(
          stripeSubscription?.metadata?.additional_user,
          0
        ),
        additional_user_cycle: normalizeAddonBillingCycle(
          stripeSubscription?.metadata?.additional_user_cycle,
          stripeSubscription?.metadata?.billing_cycle || "monthly"
        ),
        additional_crm: normalizeAddonQuantity(
          stripeSubscription?.metadata?.additional_crm,
          0
        ),
        additional_crm_cycle: normalizeAddonBillingCycle(
          stripeSubscription?.metadata?.additional_crm_cycle,
          stripeSubscription?.metadata?.billing_cycle || "monthly"
        ),
        additional_leads: normalizeAddonQuantity(
          stripeSubscription?.metadata?.additional_leads,
          0
        ),
        additional_leads_cycle: normalizeAddonBillingCycle(
          stripeSubscription?.metadata?.additional_leads_cycle,
          stripeSubscription?.metadata?.billing_cycle || "monthly"
        ),
      },
      onboardingPayload: empresaResultado?.should_send_onboarding
        ? buildOnboardingPayload({
            ...empresaResultado,
            stripe_customer_id: customerId || null,
          })
        : null,
    };
  }

  const identity = extractCheckoutIdentity(session);
  let empresaId =
    Number(session?.metadata?.empresa_id || session?.client_reference_id || 0) ||
    null;
  let onboardingPayload = null;

  if (!empresaId) {
    const empresaResultado = await resolveOrCreateEmpresaByCheckoutSession(
      client,
      session
    );
    empresaId = empresaResultado?.empresa_id || null;
    if (empresaResultado?.should_send_onboarding) {
      onboardingPayload = buildOnboardingPayload({
        ...empresaResultado,
        stripe_customer_id: stripeSubscription?.customer || session?.customer || null,
      });
    }
  } else {
    onboardingPayload = await loadOnboardingPayloadIfNeeded(client, {
      empresaId,
      email: identity.email,
      userName: identity.userName,
      companyName: identity.companyName,
      stripeCustomerId: stripeSubscription?.customer || session?.customer || null,
    });
  }

  return {
    fallback: {
      empresa_id: empresaId,
      assinatura_id: Number(session?.metadata?.assinatura_id || 0) || null,
      stripe_customer_id: stripeSubscription?.customer || session?.customer || null,
      billing_cycle: session?.metadata?.billing_cycle || "monthly",
      additional_user: normalizeAddonQuantity(session?.metadata?.additional_user, 0),
      additional_user_cycle: normalizeAddonBillingCycle(
        session?.metadata?.additional_user_cycle,
        session?.metadata?.billing_cycle || "monthly"
      ),
      additional_crm: normalizeAddonQuantity(session?.metadata?.additional_crm, 0),
      additional_crm_cycle: normalizeAddonBillingCycle(
        session?.metadata?.additional_crm_cycle,
        session?.metadata?.billing_cycle || "monthly"
      ),
      additional_leads: normalizeAddonQuantity(session?.metadata?.additional_leads, 0),
      additional_leads_cycle: normalizeAddonBillingCycle(
        session?.metadata?.additional_leads_cycle,
        session?.metadata?.billing_cycle || "monthly"
      ),
    },
    onboardingPayload,
  };
}

async function loadOnboardingPayloadFromSubscriptionContext(
  client,
  stripeSubscription = {}
) {
  const normalized = normalizeSubscriptionPayload(stripeSubscription);
  const stripeCustomerId = normalizeOptionalText(
    stripeSubscription?.customer || null
  );

  let email = normalizeOptionalText(
    stripeSubscription?.metadata?.email || null
  );
  let userName = normalizeOptionalText(
    stripeSubscription?.metadata?.user_name || null
  );
  let companyName = normalizeOptionalText(
    stripeSubscription?.metadata?.company_name ||
      stripeSubscription?.metadata?.business_name ||
      null
  );

  if ((!email || !userName || !companyName) && stripeCustomerId) {
    try {
      const stripeCustomer = await stripeRequest(
        "GET",
        `/customers/${encodeURIComponent(stripeCustomerId)}`
      );
      const identity = extractStripeCustomerIdentity(stripeCustomer, {
        email,
        userName,
        companyName,
      });
      email = email || identity.email;
      userName = userName || identity.userName;
      companyName = companyName || identity.companyName;
    } catch (error) {
      console.warn(
        "[pagamento/webhook] nao foi possivel carregar customer da Stripe para onboarding:",
        error?.message || error
      );
    }
  }

  if (!normalized.empresa_id || !email) {
    return null;
  }

  return loadOnboardingPayloadIfNeeded(client, {
    empresaId: normalized.empresa_id,
    email,
    userName,
    companyName,
    stripeCustomerId,
  });
}

function createGestao360Error(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function ensureGestao360Schema(client) {
  if (!RUNTIME_SCHEMA_ENSURE_GESTAO360 || gestao360SchemaEnsured) {
    return;
  }

  await client.query(models.ensure_empresa_origem_gestao360_columns());
  gestao360SchemaEnsured = true;
}

async function loadPlanoGestao360(client) {
  const planoQuery = await client.query(models.get_plano_por_id(), [
    GESTAO360_ASSINATURA_ID,
  ]);
  const plano = planoQuery.rows[0] || null;

  if (!plano) {
    throw createGestao360Error(
      `Plano da integracao Gestão 360 (assinatura ${GESTAO360_ASSINATURA_ID}) inexistente ou inativo. Verifique GESTAO360_ASSINATURA_ID.`,
      500
    );
  }

  return plano;
}

// Localiza as contas do e-mail e separa a empresa criada pela integracao
// (origem gestao360, usuario master) das demais, que a integracao nunca altera.
async function resolveContaGestao360(client, email) {
  const contasQuery = await client.query(
    models.get_usuarios_empresa_por_email_gestao360(),
    [email]
  );
  const contas = contasQuery.rows;
  const gerenciada =
    contas.find(
      (conta) => conta.empresa_origem === GESTAO360_ORIGEM && conta.is_master
    ) || null;
  const outras = contas.filter((conta) => conta !== gerenciada);

  return {
    gerenciada,
    outra: outras[0] || null,
    cliente_ativo:
      outras.find((conta) => conta.usuario_ativo && conta.empresa_ativo) || null,
  };
}

// Ativa/renova a assinatura criada pela integracao. Retorna false, sem alterar
// nada, quando a empresa ja possui assinatura propria ativa (ex.: Stripe).
async function ativarAssinaturaGestao360(client, empresaId, validade, plano = null) {
  const propriaQuery = await client.query(
    models.get_assinatura_propria_ativa_empresa(),
    [empresaId]
  );
  if (propriaQuery.rows.length) {
    return false;
  }

  const atualQuery = await client.query(models.get_assinatura_gestao360_empresa(), [
    empresaId,
  ]);
  const atual = atualQuery.rows[0] || null;

  if (atual) {
    await client.query(models.update_assinatura_gestao360_por_id(), [
      atual.id,
      validade,
    ]);
    return true;
  }

  const planoGestao360 = plano || (await loadPlanoGestao360(client));
  await client.query(models.insert_assinatura_pendente(), [
    GESTAO360_ORIGEM,
    null,
    validade,
    null,
    true,
    empresaId,
    planoGestao360.id,
    false,
    0,
    "monthly",
    0,
    0,
    "monthly",
    0,
    "monthly",
    null,
    null,
    null,
    null,
    null,
    null,
    false,
    null,
  ]);
  return true;
}

const execute = {
  criar_checkout_assinatura: async ({
    email,
    assinatura_id,
    billing_cycle,
    additional_user,
    additional_crm,
    additional_leads,
    additional_user_cycle,
    additional_crm_cycle,
    additional_leads_cycle,
    ui_mode,
    success_url,
    cancel_url,
    has_pdv,
    coupon_code,
    promotion_code,
    coupon_id,
    allow_promotion_codes,
  }) => {
    const client = await postgres.connect();

    try {
      ensureStripeConfigured();

      const usuarioQuery = await client.query(
        models.get_usuario_empresa_por_email(),
        [email]
      );
      const usuario = usuarioQuery.rows[0];

      if (!usuario) {
        throw new Error("Usuario nao encontrado para criar assinatura.");
      }

      const planoQuery = await client.query(models.get_plano_por_id(), [
        assinatura_id,
      ]);
      const plano = planoQuery.rows[0];

      if (!plano) {
        throw new Error("Plano invalido ou inativo.");
      }

      const normalizedCycle = normalizeBillingCycle(billing_cycle);
      const normalizedUiMode = normalizeUiMode(ui_mode);
      const stripePriceId = resolveStripePriceIdByCycle(plano, normalizedCycle);
      const stripeDiscount = await resolveStripeDiscount({
        coupon_code,
        promotion_code,
        coupon_id,
      });

      if (!stripePriceId) {
        throw new Error(
          `Plano sem Stripe Price configurado para o ciclo ${normalizedCycle}.`
        );
      }

      const assinaturaAtualQuery = await client.query(
        models.get_assinatura_empresa_atual(),
        [usuario.empresa_id]
      );
      const assinaturaAtual = assinaturaAtualQuery.rows[0] || null;
      const addonQuantities = {
        additional_user: normalizeAddonQuantity(
          additional_user,
          assinaturaAtual?.additional_user || 0
        ),
        additional_crm: normalizeAddonQuantity(
          additional_crm,
          assinaturaAtual?.additional_crm || 0
        ),
        additional_leads: normalizeAddonQuantity(
          additional_leads,
          assinaturaAtual?.additional_leads || 0
        ),
      };
      const addonCycles = {
        additional_user: normalizeAddonBillingCycle(
          additional_user_cycle,
          assinaturaAtual?.additional_user_cycle || normalizedCycle
        ),
        additional_crm: normalizeAddonBillingCycle(
          additional_crm_cycle,
          assinaturaAtual?.additional_crm_cycle || normalizedCycle
        ),
        additional_leads: normalizeAddonBillingCycle(
          additional_leads_cycle,
          assinaturaAtual?.additional_leads_cycle || normalizedCycle
        ),
      };
      const addonConfigByCode = await loadAddonConfigs(client);

      if (assinaturaAtual?.stripe_subscription_id) {
        let stripeSubscriptionAtual = await stripeRequest(
          "GET",
          `/subscriptions/${assinaturaAtual.stripe_subscription_id}?expand[]=items.data.price`
        );
        const statusAtual = String(stripeSubscriptionAtual?.status || "").toLowerCase();
        const switchableStatuses = [
          "active",
          "trialing",
          "past_due",
          "unpaid",
          "incomplete",
        ];

        if (switchableStatuses.includes(statusAtual)) {
          const stripeItems = Array.isArray(stripeSubscriptionAtual?.items?.data)
            ? stripeSubscriptionAtual.items.data
            : [];

          const addonPriceIds = new Set(
            [
              ...(addonConfigByCode.additional_user?.all_price_ids || []),
              ...(addonConfigByCode.additional_crm?.all_price_ids || []),
              ...(addonConfigByCode.additional_leads?.all_price_ids || []),
            ].filter(Boolean)
          );

          const itemAtual =
            stripeItems.find((item) => !addonPriceIds.has(item?.price?.id || "")) ||
            stripeItems[0] ||
            null;

          if (!itemAtual?.id || !itemAtual?.price?.id) {
            throw new Error(
              "Nao foi possivel identificar o item da assinatura Stripe para aplicar proration."
            );
          }

          const stripePriceAtual = itemAtual?.price?.id || assinaturaAtual?.stripe_price_id || null;
          const semMudancaDePreco =
            Boolean(stripePriceAtual) && stripePriceAtual === stripePriceId;
          const currentInterval = String(
            itemAtual?.price?.recurring?.interval || ""
          ).toLowerCase();
          const targetInterval = normalizedCycle === "yearly" ? "year" : "month";
          const isIntervalChange =
            Boolean(currentInterval) && currentInterval !== targetInterval;
          const addonsAtuais = extractAddonStatesFromSubscription(
            stripeSubscriptionAtual,
            addonConfigByCode
          );
          const houveMudancaAddons =
            addonsAtuais.additional_user.quantity !== addonQuantities.additional_user ||
            addonsAtuais.additional_crm.quantity !== addonQuantities.additional_crm ||
            addonsAtuais.additional_leads.quantity !== addonQuantities.additional_leads ||
            addonsAtuais.additional_user.billing_cycle !== addonCycles.additional_user ||
            addonsAtuais.additional_crm.billing_cycle !== addonCycles.additional_crm ||
            addonsAtuais.additional_leads.billing_cycle !== addonCycles.additional_leads;
          const semMudancas = semMudancaDePreco && !houveMudancaAddons;

          if (semMudancas) {
            if (stripeSubscriptionAtual?.cancel_at_period_end) {
              const stripeSubscriptionReativada = await stripeRequest(
                "POST",
                `/subscriptions/${assinaturaAtual.stripe_subscription_id}`,
                {
                  cancel_at_period_end: false,
                  "metadata[empresa_id]": String(usuario.empresa_id),
                  "metadata[assinatura_id]": String(plano.id),
                  "metadata[billing_cycle]": normalizedCycle,
                  "metadata[email]": String(usuario.email),
                  "metadata[additional_user]": String(addonQuantities.additional_user),
                  "metadata[additional_user_cycle]": String(addonCycles.additional_user),
                  "metadata[additional_crm]": String(addonQuantities.additional_crm),
                  "metadata[additional_crm_cycle]": String(addonCycles.additional_crm),
                  "metadata[additional_leads]": String(addonQuantities.additional_leads),
                  "metadata[additional_leads_cycle]": String(addonCycles.additional_leads),
                }
              );

              await execute.sincronizar_assinatura_stripe({
                stripeSubscription: stripeSubscriptionReativada,
                fallback: {
                  empresa_id: usuario.empresa_id,
                  assinatura_id: plano.id,
                  stripe_customer_id:
                    stripeSubscriptionReativada?.customer ||
                    assinaturaAtual?.stripe_customer_id ||
                    null,
                  stripe_subscription_id: assinaturaAtual.stripe_subscription_id,
                  stripe_price_id: stripePriceId,
                  stripe_cancel_at_period_end: false,
                  billing_cycle: normalizedCycle,
                  additional_user: addonQuantities.additional_user,
                  additional_user_cycle: addonCycles.additional_user,
                  additional_crm: addonQuantities.additional_crm,
                  additional_crm_cycle: addonCycles.additional_crm,
                  additional_leads: addonQuantities.additional_leads,
                  additional_leads_cycle: addonCycles.additional_leads,
                  current_period_end:
                    stripeSubscriptionReativada?.current_period_end ||
                    assinaturaAtual?.stripe_current_period_end ||
                    null,
                },
              });

              return {
                ui_mode: normalizedUiMode,
                empresa_id: usuario.empresa_id,
                assinatura_id: plano.id,
                billing_cycle: normalizedCycle,
                stripe_price_id: stripePriceId,
                stripe_subscription_id: stripeSubscriptionReativada.id,
                modo_alteracao: "proration",
                sem_alteracao: false,
                reativada: true,
                mensagem:
                  "Assinatura reativada com sucesso. O acesso continuara ativo normalmente.",
                additional_user: addonQuantities.additional_user,
                additional_user_cycle: addonCycles.additional_user,
                additional_crm: addonQuantities.additional_crm,
                additional_crm_cycle: addonCycles.additional_crm,
                additional_leads: addonQuantities.additional_leads,
                additional_leads_cycle: addonCycles.additional_leads,
                desconto_aplicado: stripeDiscount
                  ? {
                      tipo: stripeDiscount.type,
                      valor: stripeDiscount.value,
                      origem: stripeDiscount.source,
                      codigo_informado: stripeDiscount.entered_code || null,
                      ignorado_na_troca_prorata: true,
                    }
                  : null,
              };
            }

            return {
              ui_mode: normalizedUiMode,
              empresa_id: usuario.empresa_id,
              assinatura_id: plano.id,
              billing_cycle: normalizedCycle,
              stripe_price_id: stripePriceId,
              stripe_subscription_id: stripeSubscriptionAtual.id,
              modo_alteracao: "proration",
              sem_alteracao: true,
              mensagem:
                "A assinatura ja esta no plano/ciclo solicitado. Nenhuma cobranca adicional foi gerada.",
              additional_user: addonQuantities.additional_user,
              additional_user_cycle: addonCycles.additional_user,
              additional_crm: addonQuantities.additional_crm,
              additional_crm_cycle: addonCycles.additional_crm,
              additional_leads: addonQuantities.additional_leads,
              additional_leads_cycle: addonCycles.additional_leads,
              desconto_aplicado: stripeDiscount
                ? {
                    tipo: stripeDiscount.type,
                    valor: stripeDiscount.value,
                    origem: stripeDiscount.source,
                    codigo_informado: stripeDiscount.entered_code || null,
                    ignorado_na_troca_prorata: true,
                  }
                : null,
            };
          }

          const plannedItems = [
            {
              existingItem: itemAtual,
              targetPriceId: stripePriceId,
              targetQuantity: 1,
              mode: "base",
            },
          ];

          const addonSpecs = [
            { key: "additional_user", label: "usuarios adicionais" },
            { key: "additional_crm", label: "CRMs adicionais" },
            { key: "additional_leads", label: "pacotes adicionais de 1.000 leads" },
          ];
          const mixedIntervals = hasMixedIntervals(
            normalizedCycle,
            addonQuantities,
            addonCycles
          );

          if (mixedIntervals) {
            stripeSubscriptionAtual = await ensureFlexibleBillingModeForSubscription(
              stripeSubscriptionAtual
            );
          }

          addonSpecs.forEach(({ key, label }) => {
            const config = addonConfigByCode[key];
            const targetQuantity = addonQuantities[key];
            const targetCycle = addonCycles[key];
            const existingItem = stripeItems.find((item) => {
              const priceId = item?.price?.id || null;
              if (!priceId) return false;
              const ids = new Set((config?.all_price_ids || []).filter(Boolean));
              return ids.has(priceId);
            });
            const targetAddonPriceId = resolveAddonPriceIdByCycle(config, targetCycle);

            if (targetQuantity > 0 && !targetAddonPriceId) {
              throw new Error(
                `Addon de ${label} sem Stripe Price configurado para o ciclo ${targetCycle}.`
              );
            }

            if (!existingItem && targetQuantity <= 0) {
              return;
            }

            plannedItems.push({
              existingItem,
              targetPriceId: targetAddonPriceId || existingItem?.price?.id || null,
              targetQuantity,
              mode: "addon",
            });
          });

          const updatePayload = {
            // Evita limite diário de invoices da Stripe em trocas frequentes.
            // A diferença proporcional fica para a próxima fatura.
            proration_behavior: "create_prorations",
            cancel_at_period_end: false,
            "metadata[empresa_id]": String(usuario.empresa_id),
            "metadata[assinatura_id]": String(plano.id),
            "metadata[billing_cycle]": normalizedCycle,
            "metadata[email]": String(usuario.email),
            "metadata[additional_user]": String(addonQuantities.additional_user),
            "metadata[additional_user_cycle]": String(addonCycles.additional_user),
            "metadata[additional_crm]": String(addonQuantities.additional_crm),
            "metadata[additional_crm_cycle]": String(addonCycles.additional_crm),
            "metadata[additional_leads]": String(addonQuantities.additional_leads),
            "metadata[additional_leads_cycle]": String(addonCycles.additional_leads),
          };
          updatePayload.billing_cycle_anchor = isIntervalChange
            ? "now"
            : "unchanged";

          plannedItems.forEach((itemPlan, index) => {
            if (itemPlan.existingItem?.id) {
              updatePayload[`items[${index}][id]`] = itemPlan.existingItem.id;

              if (itemPlan.targetQuantity <= 0) {
                updatePayload[`items[${index}][deleted]`] = true;
                return;
              }
            }

            if (!itemPlan.targetPriceId || itemPlan.targetQuantity <= 0) return;

            updatePayload[`items[${index}][price]`] = itemPlan.targetPriceId;
            updatePayload[`items[${index}][quantity]`] = itemPlan.targetQuantity;
          });

          const prorationPreview = !houveMudancaAddons && !isIntervalChange
            ? await previewSubscriptionProration({
                customerId:
                  stripeSubscriptionAtual?.customer || assinaturaAtual?.stripe_customer_id || null,
                subscriptionId:
                  stripeSubscriptionAtual?.id || assinaturaAtual?.stripe_subscription_id,
                subscriptionItemId: itemAtual.id,
                targetPriceId: stripePriceId,
              })
            : null;

          const stripeSubscriptionAtualizada = await stripeRequest(
            "POST",
            `/subscriptions/${assinaturaAtual.stripe_subscription_id}`,
            updatePayload
          );

          const faturaProracao = null;

          await execute.sincronizar_assinatura_stripe({
            stripeSubscription: stripeSubscriptionAtualizada,
            fallback: {
              empresa_id: usuario.empresa_id,
              assinatura_id: plano.id,
              stripe_customer_id:
                stripeSubscriptionAtualizada?.customer || assinaturaAtual?.stripe_customer_id || null,
              stripe_subscription_id: assinaturaAtual.stripe_subscription_id,
              stripe_price_id: stripePriceId,
              stripe_cancel_at_period_end: false,
              billing_cycle: normalizedCycle,
              additional_user: addonQuantities.additional_user,
              additional_user_cycle: addonCycles.additional_user,
              additional_crm: addonQuantities.additional_crm,
              additional_crm_cycle: addonCycles.additional_crm,
              additional_leads: addonQuantities.additional_leads,
              additional_leads_cycle: addonCycles.additional_leads,
              current_period_end:
                stripeSubscriptionAtualizada?.current_period_end ||
                assinaturaAtual?.stripe_current_period_end ||
                null,
            },
          });

          return {
            ui_mode: normalizedUiMode,
            empresa_id: usuario.empresa_id,
            assinatura_id: plano.id,
            billing_cycle: normalizedCycle,
            stripe_price_id: stripePriceId,
            stripe_subscription_id: stripeSubscriptionAtualizada.id,
            modo_alteracao: "proration",
            sem_alteracao: false,
            additional_user: addonQuantities.additional_user,
            additional_user_cycle: addonCycles.additional_user,
            additional_crm: addonQuantities.additional_crm,
            additional_crm_cycle: addonCycles.additional_crm,
            additional_leads: addonQuantities.additional_leads,
            additional_leads_cycle: addonCycles.additional_leads,
            proration_preview: prorationPreview,
            fatura_proracao: faturaProracao,
            checkout_url: faturaProracao?.hosted_invoice_url || null,
            mensagem: isIntervalChange
              ? "Troca de plano/ciclo aplicada com sucesso."
              : "Troca de plano aplicada com sucesso. O ajuste proporcional sera refletido na proxima fatura.",
            desconto_aplicado: stripeDiscount
              ? {
                  tipo: stripeDiscount.type,
                  valor: stripeDiscount.value,
                  origem: stripeDiscount.source,
                  codigo_informado: stripeDiscount.entered_code || null,
                  ignorado_na_troca_prorata: true,
                }
              : null,
          };
        }
      }

      const checkoutPayload = {
        mode: "subscription",
        client_reference_id: String(usuario.empresa_id),
        customer_email: usuario.email,
        customer_name: usuario.nome,
        "metadata[empresa_id]": String(usuario.empresa_id),
        "metadata[assinatura_id]": String(plano.id),
        "metadata[billing_cycle]": normalizedCycle,
        "metadata[email]": String(usuario.email),
        "metadata[additional_user]": String(addonQuantities.additional_user),
        "metadata[additional_user_cycle]": String(addonCycles.additional_user),
        "metadata[additional_crm]": String(addonQuantities.additional_crm),
        "metadata[additional_crm_cycle]": String(addonCycles.additional_crm),
        "metadata[additional_leads]": String(addonQuantities.additional_leads),
        "metadata[additional_leads_cycle]": String(addonCycles.additional_leads),
        "subscription_data[metadata][empresa_id]": String(usuario.empresa_id),
        "subscription_data[metadata][assinatura_id]": String(plano.id),
        "subscription_data[metadata][billing_cycle]": normalizedCycle,
        "subscription_data[metadata][email]": String(usuario.email),
        "subscription_data[metadata][additional_user]": String(addonQuantities.additional_user),
        "subscription_data[metadata][additional_user_cycle]": String(addonCycles.additional_user),
        "subscription_data[metadata][additional_crm]": String(addonQuantities.additional_crm),
        "subscription_data[metadata][additional_crm_cycle]": String(addonCycles.additional_crm),
        "subscription_data[metadata][additional_leads]": String(addonQuantities.additional_leads),
        "subscription_data[metadata][additional_leads_cycle]": String(addonCycles.additional_leads),
        // "subscription_data[trial_period_days]": 7,
        allow_promotion_codes:
          allow_promotion_codes === undefined ? true : Boolean(allow_promotion_codes),
      };
      const mixedIntervalsOnCreate = hasMixedIntervals(
        normalizedCycle,
        addonQuantities,
        addonCycles
      );
      if (mixedIntervalsOnCreate) {
        checkoutPayload["subscription_data[billing_mode][type]"] = "flexible";
      }

      const lineItems = [{ price: stripePriceId, quantity: 1 }];
      const addonSpecs = [
        { key: "additional_user", label: "usuarios adicionais" },
        { key: "additional_crm", label: "CRMs adicionais" },
        { key: "additional_leads", label: "pacotes adicionais de 1.000 leads" },
      ];

      addonSpecs.forEach(({ key, label }) => {
        const quantity = addonQuantities[key];
        if (quantity <= 0) return;
        const config = addonConfigByCode[key];
        const cycle = addonCycles[key];
        const addonPriceId = resolveAddonPriceIdByCycle(config, cycle);
        if (!addonPriceId) {
          throw new Error(
            `Addon de ${label} sem Stripe Price configurado para o ciclo ${cycle}.`
          );
        }
        lineItems.push({
          price: addonPriceId,
          quantity,
        });
      });

      lineItems.forEach((lineItem, index) => {
        checkoutPayload[`line_items[${index}][price]`] = lineItem.price;
        checkoutPayload[`line_items[${index}][quantity]`] = lineItem.quantity;
      });

      if (stripeDiscount) {
        checkoutPayload[`discounts[0][${stripeDiscount.type}]`] = stripeDiscount.value;
        checkoutPayload.allow_promotion_codes = false;
      }

      if (normalizedUiMode === "embedded") {
        checkoutPayload.ui_mode = "embedded";
        checkoutPayload.return_url = success_url || FRONTEND_SUCCESS_URL;
      } else {
        checkoutPayload.success_url = success_url || FRONTEND_SUCCESS_URL;
        checkoutPayload.cancel_url = cancel_url || FRONTEND_CANCEL_URL;
      }

      if (assinaturaAtual?.stripe_customer_id) {
        checkoutPayload.customer = assinaturaAtual.stripe_customer_id;
        delete checkoutPayload.customer_email;
      }

      const session = await stripeRequest(
        "POST",
        "/checkout/sessions",
        checkoutPayload
      );

      let resolvedSession = session;
      let resolvedUiMode = normalizedUiMode;

      // Fallback defensivo: em alguns cenários a Stripe pode não retornar client_secret no embedded.
      // Nesse caso, abrimos checkout hosted para não travar o fluxo no front.
      if (normalizedUiMode === "embedded" && !session?.client_secret) {
        const hostedPayload = { ...checkoutPayload };
        delete hostedPayload.ui_mode;
        delete hostedPayload.return_url;
        hostedPayload.success_url = success_url || FRONTEND_SUCCESS_URL;
        hostedPayload.cancel_url = cancel_url || FRONTEND_CANCEL_URL;

        resolvedSession = await stripeRequest(
          "POST",
          "/checkout/sessions",
          hostedPayload
        );
        resolvedUiMode = "hosted";
      }

      await client.query("BEGIN");

      const pendingQuery = await client.query(
        models.get_assinatura_pendente_empresa(),
        [usuario.empresa_id]
      );
      const assinaturaPendente = pendingQuery.rows[0] || null;

      if (assinaturaPendente) {
        await client.query(models.update_assinatura_empresa_por_id(), [
          assinaturaPendente.id,
          resolvedSession.id,
          null,
          null,
          null,
          false,
          plano.id,
          assinaturaPendente.has_pdv ?? Boolean(has_pdv),
          addonQuantities.additional_user,
          addonCycles.additional_user,
          assinaturaPendente.additional_filial || 0,
          addonQuantities.additional_crm,
          addonCycles.additional_crm,
          addonQuantities.additional_leads,
          addonCycles.additional_leads,
          resolvedSession.customer || assinaturaAtual?.stripe_customer_id || null,
          null,
          resolvedSession.id,
          "checkout_pending",
          stripePriceId,
          null,
          false,
          null,
        ]);
      } else {
        await client.query(models.insert_assinatura_pendente(), [
          resolvedSession.id,
          null,
          null,
          null,
          false,
          usuario.empresa_id,
          plano.id,
          Boolean(has_pdv),
          addonQuantities.additional_user,
          addonCycles.additional_user,
          0,
          addonQuantities.additional_crm,
          addonCycles.additional_crm,
          addonQuantities.additional_leads,
          addonCycles.additional_leads,
          resolvedSession.customer || assinaturaAtual?.stripe_customer_id || null,
          null,
          resolvedSession.id,
          "checkout_pending",
          stripePriceId,
          null,
          false,
          null,
        ]);
      }

      await client.query("COMMIT");

      return {
        ui_mode: resolvedUiMode,
        checkout_url: resolvedSession.url || null,
        checkout_session_id: resolvedSession.id,
        checkout_client_secret: resolvedSession.client_secret || null,
        empresa_id: usuario.empresa_id,
        assinatura_id: plano.id,
        billing_cycle: normalizedCycle,
        stripe_price_id: stripePriceId,
        additional_user: addonQuantities.additional_user,
        additional_user_cycle: addonCycles.additional_user,
        additional_crm: addonQuantities.additional_crm,
        additional_crm_cycle: addonCycles.additional_crm,
        additional_leads: addonQuantities.additional_leads,
        additional_leads_cycle: addonCycles.additional_leads,
        desconto_aplicado: stripeDiscount
          ? {
              tipo: stripeDiscount.type,
              valor: stripeDiscount.value,
              origem: stripeDiscount.source,
              codigo_informado: stripeDiscount.entered_code || null,
            }
          : null,
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // noop
      }
      throw error;
    } finally {
      client.release();
    }
  },

  obter_assinatura_usuario: async (email) => {
    const client = await postgres.connect();

    try {
      const usuarioQuery = await client.query(
        models.get_usuario_empresa_por_email(),
        [email]
      );
      const usuario = usuarioQuery.rows[0];

      if (!usuario) {
        return null;
      }

      const assinaturaQuery = await client.query(
        models.get_assinatura_empresa_atual(),
        [usuario.empresa_id]
      );
      const assinatura = assinaturaQuery.rows[0] || null;

      return {
        email: usuario.email,
        empresa_id: usuario.empresa_id,
        assinatura,
      };
    } finally {
      client.release();
    }
  },

  criar_sessao_portal_forma_pagamento: async ({
    email,
    stripe_customer_id,
    return_url,
  }) => {
    const normalizedEmail = normalizeOptionalText(email);
    const providedCustomerId = normalizeOptionalText(stripe_customer_id);
    const resolvedReturnUrl =
      normalizeOptionalText(return_url) || FRONTEND_BILLING_PORTAL_RETURN_URL;

    if (!normalizedEmail && !providedCustomerId) {
      throw new Error("Informe email ou stripe_customer_id para abrir o portal.");
    }

    let assinatura = null;

    if (normalizedEmail) {
      const assinaturaData = await execute.obter_assinatura_usuario(normalizedEmail);
      assinatura = assinaturaData?.assinatura || null;
    }

    const customerId =
      providedCustomerId ||
      normalizeOptionalText(assinatura?.stripe_customer_id) ||
      null;

    if (!customerId) {
      throw new Error(
        "Nao foi possivel localizar o cliente Stripe da assinatura atual."
      );
    }

    const payload = {
      customer: customerId,
      return_url: resolvedReturnUrl,
      flow_data: {
        type: "payment_method_update",
        after_completion: {
          type: "redirect",
          redirect: {
            return_url: resolvedReturnUrl,
          },
        },
      },
      locale: "pt-BR",
    };

    if (STRIPE_BILLING_PORTAL_CONFIGURATION_ID) {
      payload.configuration = STRIPE_BILLING_PORTAL_CONFIGURATION_ID;
    }

    const session = await stripeRequest("POST", "/billing_portal/sessions", payload);

    return {
      customer_id: customerId,
      url: session?.url || null,
      return_url: resolvedReturnUrl,
    };
  },

  listar_historico_pagamentos: async (email, limit = 30) => {
    const client = await postgres.connect();

    try {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 200));
      const usuarioQuery = await client.query(
        models.get_usuario_empresa_por_email(),
        [email]
      );
      const usuario = usuarioQuery.rows[0];

      if (!usuario) {
        return [];
      }

      const historicoQuery = await client.query(
        models.get_historico_pagamentos_empresa(),
        [usuario.empresa_id, safeLimit]
      );

      return historicoQuery.rows;
    } finally {
      client.release();
    }
  },

  cancelar_assinatura: async ({ email, stripe_subscription_id, imediato = false }) => {
    const client = await postgres.connect();

    try {
      ensureStripeConfigured();

      let assinaturaAtual = null;

      if (stripe_subscription_id) {
        const bySubscription = await client.query(
          models.get_assinatura_empresa_por_subscription_id(),
          [stripe_subscription_id]
        );
        assinaturaAtual = bySubscription.rows[0] || null;
      }

      if (!assinaturaAtual && email) {
        const usuarioQuery = await client.query(
          models.get_usuario_empresa_por_email(),
          [email]
        );
        const usuario = usuarioQuery.rows[0] || null;

        if (!usuario) {
          throw new Error("Usuario nao encontrado.");
        }

        const assinaturaQuery = await client.query(
          models.get_assinatura_empresa_atual(),
          [usuario.empresa_id]
        );
        assinaturaAtual = assinaturaQuery.rows[0] || null;
      }

      if (!assinaturaAtual?.stripe_subscription_id) {
        throw new Error("Assinatura Stripe nao encontrada para cancelamento.");
      }

      // Regra de negócio: cancelamento é sempre "ao fim do período".
      // Mantém acesso ativo até a validade e apenas marca solicitação de saída.
      const stripeSubscription = await stripeRequest(
        "POST",
        `/subscriptions/${assinaturaAtual.stripe_subscription_id}`,
        {
          cancel_at_period_end: true,
        }
      );

      await execute.sincronizar_assinatura_stripe({
        stripeSubscription,
        fallback: {
          empresa_id: assinaturaAtual.empresa_id,
          assinatura_id: assinaturaAtual.assinatura_id,
          stripe_customer_id: assinaturaAtual.stripe_customer_id || null,
          stripe_subscription_id: assinaturaAtual.stripe_subscription_id,
          stripe_price_id: assinaturaAtual.stripe_price_id || null,
          stripe_cancel_at_period_end: true,
          billing_cycle: assinaturaAtual.billing_cycle || "monthly",
          additional_user: assinaturaAtual.additional_user || 0,
          additional_user_cycle: assinaturaAtual.additional_user_cycle || "monthly",
          additional_crm: assinaturaAtual.additional_crm || 0,
          additional_crm_cycle: assinaturaAtual.additional_crm_cycle || "monthly",
          additional_leads: assinaturaAtual.additional_leads || 0,
          additional_leads_cycle: assinaturaAtual.additional_leads_cycle || "monthly",
          current_period_end: assinaturaAtual.stripe_current_period_end || null,
        },
      });

      await client.query(models.update_request_unsubscribe_by_id(), [
        assinaturaAtual.id,
        true,
      ]);

      return {
        sucesso: true,
        cancelamento_imediato: false,
        stripe_status: stripeSubscription?.status || null,
        cancel_at_period_end:
          stripeSubscription?.cancel_at_period_end ?? true,
        request_unsubscribe: true,
      };
    } finally {
      client.release();
    }
  },

  sincronizar_assinatura_stripe: async ({
    stripeSubscription,
    stripeEventId = null,
    fallback = {},
  }) => {
    const client = await postgres.connect();

    try {
      const normalized = normalizeSubscriptionPayload(stripeSubscription, fallback);

      let assinaturaExistente = null;
      if (normalized.stripe_subscription_id) {
        const assinaturaPorSub = await client.query(
          models.get_assinatura_empresa_por_subscription_id(),
          [normalized.stripe_subscription_id]
        );
        assinaturaExistente = assinaturaPorSub.rows[0] || null;
      }

      if (!assinaturaExistente && normalized.stripe_customer_id) {
        const assinaturaPorCliente = await client.query(
          models.get_assinatura_empresa_por_customer_id(),
          [normalized.stripe_customer_id]
        );
        assinaturaExistente = assinaturaPorCliente.rows[0] || null;
      }

      let assinaturaId =
        normalized.assinatura_id || assinaturaExistente?.assinatura_id || null;
      if (!assinaturaId && Array.isArray(normalized.stripe_price_ids) && normalized.stripe_price_ids.length) {
        const planoPorAnyPrice = await client.query(
          models.get_plano_por_qualquer_stripe_price_ids(),
          [normalized.stripe_price_ids]
        );
        assinaturaId = planoPorAnyPrice.rows[0]?.id || null;
      }
      if (!assinaturaId && normalized.stripe_price_id) {
        const planoPorPrice = await client.query(
          models.get_plano_por_stripe_price_id(),
          [normalized.stripe_price_id]
        );
        assinaturaId = planoPorPrice.rows[0]?.id || null;
      }

      const empresaId = normalized.empresa_id || assinaturaExistente?.empresa_id || null;

      if (!empresaId || !assinaturaId) {
        throw new Error(
          "Nao foi possivel identificar empresa/plano para sincronizar assinatura Stripe."
        );
      }

      const validade = normalized.validade;
      const explicitPaymentDate =
        coerceDateOrNull(fallback.invoice_paid_at) ||
        coerceDateOrNull(fallback.last_payment_at) ||
        null;
      const hasExplicitPaidInvoice =
        fallback.invoice_paid === true ||
        fallback.paid === true ||
        Boolean(explicitPaymentDate);
      const ultimoPagamento = hasExplicitPaidInvoice
        ? explicitPaymentDate || new Date()
        : assinaturaExistente?.ultimo_pagamento || null;
      const addonConfigByCode = await loadAddonConfigs(client);
      const addonsFromSubscription = extractAddonStatesFromSubscription(
        stripeSubscription,
        addonConfigByCode
      );
      const additionalUser = normalizeAddonQuantity(
        normalized.additional_user,
        addonsFromSubscription.additional_user?.quantity ??
          assinaturaExistente?.additional_user ??
          0
      );
      const additionalUserCycle = normalizeAddonBillingCycle(
        normalized.additional_user_cycle,
        addonsFromSubscription.additional_user?.billing_cycle ??
          assinaturaExistente?.additional_user_cycle ??
          normalized.billing_cycle ??
          "monthly"
      );
      const additionalCrm = normalizeAddonQuantity(
        normalized.additional_crm,
        addonsFromSubscription.additional_crm?.quantity ??
          assinaturaExistente?.additional_crm ??
          0
      );
      const additionalCrmCycle = normalizeAddonBillingCycle(
        normalized.additional_crm_cycle,
        addonsFromSubscription.additional_crm?.billing_cycle ??
          assinaturaExistente?.additional_crm_cycle ??
          normalized.billing_cycle ??
          "monthly"
      );
      const additionalLeads = normalizeAddonQuantity(
        normalized.additional_leads,
        addonsFromSubscription.additional_leads?.quantity ??
          assinaturaExistente?.additional_leads ??
          0
      );
      const additionalLeadsCycle = normalizeAddonBillingCycle(
        normalized.additional_leads_cycle,
        addonsFromSubscription.additional_leads?.billing_cycle ??
          assinaturaExistente?.additional_leads_cycle ??
          normalized.billing_cycle ??
          "monthly"
      );

      await client.query("BEGIN");

      if (normalized.ativo) {
        await client.query(models.desativar_assinaturas_ativas_empresa(), [
          empresaId,
        ]);
      }

      if (assinaturaExistente) {
        await client.query(models.update_assinatura_empresa_por_id(), [
          assinaturaExistente.id,
          assinaturaExistente.assinatua_hash || normalized.stripe_customer_id,
          normalized.stripe_subscription_id,
          ultimoPagamento,
          validade,
          normalized.ativo,
          assinaturaId,
          assinaturaExistente.has_pdv,
          additionalUser,
          additionalUserCycle,
          assinaturaExistente.additional_filial || 0,
          additionalCrm,
          additionalCrmCycle,
          additionalLeads,
          additionalLeadsCycle,
          normalized.stripe_customer_id,
          normalized.stripe_subscription_id,
          assinaturaExistente.stripe_checkout_session_id,
          normalized.stripe_status,
          normalized.stripe_price_id,
          normalized.stripe_current_period_end,
          normalized.stripe_cancel_at_period_end,
          stripeEventId,
        ]);
      } else {
        await client.query(models.insert_assinatura_pendente(), [
          normalized.stripe_customer_id,
          normalized.stripe_subscription_id,
          validade,
          ultimoPagamento,
          normalized.ativo,
          empresaId,
          assinaturaId,
          false,
          additionalUser,
          additionalUserCycle,
          0,
          additionalCrm,
          additionalCrmCycle,
          additionalLeads,
          additionalLeadsCycle,
          normalized.stripe_customer_id,
          normalized.stripe_subscription_id,
          null,
          normalized.stripe_status,
          normalized.stripe_price_id,
          normalized.stripe_current_period_end,
          normalized.stripe_cancel_at_period_end,
          stripeEventId,
        ]);
      }

      // Se a assinatura estiver ativa e sem cancelamento pendente na Stripe,
      // consideramos a inscrição reativada e limpamos a flag de solicitação.
      if (
        normalized.stripe_subscription_id &&
        normalized.ativo &&
        normalized.stripe_cancel_at_period_end === false
      ) {
        await client.query(models.update_request_unsubscribe_by_subscription_id(), [
          normalized.stripe_subscription_id,
          false,
        ]);
      }

      await client.query("COMMIT");

      return { ok: true, empresa_id: empresaId, assinatura_id: assinaturaId };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // noop
      }
      throw error;
    } finally {
      client.release();
    }
  },

  registrar_historico_pagamento_invoice: async ({
    invoice,
    eventType,
    eventId,
  }) => {
    const client = await postgres.connect();

    try {
      if (!invoice?.id) {
        return null;
      }

      let assinaturaEmpresa = null;

      if (invoice.subscription) {
        const bySubscription = await client.query(
          models.get_assinatura_empresa_por_subscription_id(),
          [invoice.subscription]
        );
        assinaturaEmpresa = bySubscription.rows[0] || null;
      }

      if (!assinaturaEmpresa && invoice.customer) {
        const byCustomer = await client.query(
          models.get_assinatura_empresa_por_customer_id(),
          [invoice.customer]
        );
        assinaturaEmpresa = byCustomer.rows[0] || null;
      }

      // Fallback para cenários em que a invoice (ex.: addons) chega antes de
      // termos a assinatura sincronizada no banco.
      if (!assinaturaEmpresa?.empresa_id && invoice.subscription) {
        try {
          const stripeSubscription = await stripeRequest(
            "GET",
            `/subscriptions/${invoice.subscription}?expand[]=items.data.price`
          );
          await execute.sincronizar_assinatura_stripe({
            stripeSubscription,
            stripeEventId: eventId,
            fallback: {
              stripe_customer_id: invoice.customer || null,
              stripe_subscription_id: invoice.subscription || null,
              stripe_price_id:
                invoice?.lines?.data?.[0]?.price?.id ||
                invoice?.lines?.data?.[0]?.plan?.id ||
                null,
              current_period_end:
                invoice?.lines?.data?.[0]?.period?.end ||
                invoice?.period_end ||
                null,
            },
          });
        } catch (syncErr) {
          console.error(
            "[pagamento/registrar_historico_pagamento_invoice] falha no fallback de sincronizacao:",
            syncErr?.message || syncErr
          );
        }

        const bySubscriptionRetry = await client.query(
          models.get_assinatura_empresa_por_subscription_id(),
          [invoice.subscription]
        );
        assinaturaEmpresa = bySubscriptionRetry.rows[0] || null;

        if (!assinaturaEmpresa && invoice.customer) {
          const byCustomerRetry = await client.query(
            models.get_assinatura_empresa_por_customer_id(),
            [invoice.customer]
          );
          assinaturaEmpresa = byCustomerRetry.rows[0] || null;
        }
      }

      if (!assinaturaEmpresa?.empresa_id) {
        console.warn("[pagamento/registrar_historico_pagamento_invoice] invoice sem assinatura vinculada:", {
          invoice_id: invoice?.id || null,
          subscription_id: invoice?.subscription || null,
          customer_id: invoice?.customer || null,
          event_type: eventType || null,
        });
        return null;
      }

      const { periodStart, periodEnd } = extractInvoicePeriodBounds(invoice);

      const status = String(invoice.status || eventType || "unknown");
      const paid =
        Boolean(invoice.paid) ||
        eventType === "invoice.paid" ||
        eventType === "invoice.payment_succeeded" ||
        false;
      const paidAt =
        unixToDateOrNull(invoice.status_transitions?.paid_at) ||
        (paid ? new Date() : null);

      const valorTotal = centsToDecimal(
        invoice.amount_paid ?? invoice.amount_due ?? invoice.total ?? 0
      );

      const lineDescriptions = Array.isArray(invoice?.lines?.data)
        ? invoice.lines.data
            .map((line) => String(line?.description || "").trim())
            .filter(Boolean)
        : [];

      const descricaoNormalizada =
        invoice.description ||
        (lineDescriptions.length ? lineDescriptions.join(" | ").slice(0, 1000) : null);

      const payloadJson = JSON.stringify(invoice || {});

      const historico = await client.query(models.insert_historico_pagamento(), [
        assinaturaEmpresa.empresa_id,
        assinaturaEmpresa.id,
        assinaturaEmpresa.assinatura_id,
        invoice.id,
        invoice.payment_intent || null,
        invoice.subscription || null,
        invoice.customer || null,
        status,
        valorTotal,
        String(invoice.currency || "").toUpperCase() || null,
        paid,
        paidAt,
        unixToDateOrNull(invoice.due_date) || null,
        periodStart,
        periodEnd,
        invoice.hosted_invoice_url || null,
        invoice.invoice_pdf || null,
        Number(invoice.attempt_count || 0),
        descricaoNormalizada,
        eventId || null,
        eventType || null,
        payloadJson,
      ]);

      if (paid) {
        await client.query(models.update_assinatura_empresa_invoice_snapshot_by_id(), [
          assinaturaEmpresa.id,
          paidAt,
          periodEnd ? periodEnd.toISOString().slice(0, 10) : null,
          periodEnd,
          true,
          assinaturaEmpresa.stripe_status || null,
          eventId || null,
        ]);
      }

      return historico.rows[0] || null;
    } finally {
      client.release();
    }
  },

  processar_evento_webhook: async (rawBodyBuffer, signatureHeader) => {
    ensureStripeConfigured();

    const rawBuffer = Buffer.isBuffer(rawBodyBuffer)
      ? rawBodyBuffer
      : Buffer.from(JSON.stringify(rawBodyBuffer || {}));

    const signatureValida = verifyStripeWebhookSignature(
      rawBuffer,
      signatureHeader
    );
    if (!signatureValida) {
      const error = new Error("Assinatura do webhook Stripe invalida.");
      error.status = 400;
      throw error;
    }

    const payload = JSON.parse(rawBuffer.toString("utf8"));
    const eventType = payload?.type;
    const eventId = payload?.id || null;

    if (!eventType) {
      throw new Error("Evento Stripe invalido: tipo nao informado.");
    }

    if (eventType === "checkout.session.completed") {
      const session = payload?.data?.object || {};
      if (session.mode === "subscription" && session.subscription) {
        let empresaId =
          Number(session?.metadata?.empresa_id || session?.client_reference_id || 0) ||
          null;

        let onboardingPayload = null;

        if (!empresaId) {
          const client = await postgres.connect();
          try {
            const empresaResultado = await resolveOrCreateEmpresaByCheckoutSession(
              client,
              session
            );
            empresaId = empresaResultado?.empresa_id || null;

            if (empresaResultado?.should_send_onboarding) {
              onboardingPayload = buildOnboardingPayload({
                ...empresaResultado,
                stripe_customer_id: session.customer || null,
              });
            }
          } finally {
            client.release();
          }
        } else {
          const identity = extractCheckoutIdentity(session);
          if (identity.email) {
            const client = await postgres.connect();
            try {
              onboardingPayload = await loadOnboardingPayloadIfNeeded(client, {
                empresaId,
                email: identity.email,
                userName: identity.userName,
                companyName: identity.companyName,
                stripeCustomerId: session.customer || null,
              });
            } finally {
              client.release();
            }
          }
        }

        const stripeSubscription = await stripeRequest(
          "GET",
          `/subscriptions/${session.subscription}?expand[]=items.data.price`
        );
        await execute.sincronizar_assinatura_stripe({
          stripeSubscription,
          stripeEventId: eventId,
          fallback: {
            empresa_id: empresaId,
            assinatura_id: Number(session?.metadata?.assinatura_id || 0) || null,
            stripe_customer_id: session.customer || null,
            stripe_price_id: null,
            billing_cycle: session?.metadata?.billing_cycle || "monthly",
            additional_user: normalizeAddonQuantity(session?.metadata?.additional_user, 0),
            additional_user_cycle: normalizeAddonBillingCycle(
              session?.metadata?.additional_user_cycle,
              session?.metadata?.billing_cycle || "monthly"
            ),
            additional_crm: normalizeAddonQuantity(session?.metadata?.additional_crm, 0),
            additional_crm_cycle: normalizeAddonBillingCycle(
              session?.metadata?.additional_crm_cycle,
              session?.metadata?.billing_cycle || "monthly"
            ),
            additional_leads: normalizeAddonQuantity(session?.metadata?.additional_leads, 0),
            additional_leads_cycle: normalizeAddonBillingCycle(
              session?.metadata?.additional_leads_cycle,
              session?.metadata?.billing_cycle || "monthly"
            ),
          },
        });

        await sendOnboardingEmailSafely(onboardingPayload);
      }

      return { processed: true, type: eventType };
    }

    if (
      eventType === "customer.subscription.created" ||
      eventType === "customer.subscription.updated" ||
      eventType === "customer.subscription.deleted"
    ) {
      const stripeSubscriptionEvent = payload?.data?.object || {};
      let stripeSubscription = stripeSubscriptionEvent;

      if (stripeSubscriptionEvent?.id) {
        stripeSubscription = await stripeRequest(
          "GET",
          `/subscriptions/${stripeSubscriptionEvent.id}?expand[]=items.data.price`
        );
      }

      let fallback = {};
      let onboardingPayload = null;
      try {
        const normalized = normalizeSubscriptionPayload(stripeSubscription);
        if (!normalized.empresa_id || !normalized.assinatura_id) {
          const client = await postgres.connect();
          try {
            const recovered = await resolveCheckoutFallbackForSubscription(
              client,
              stripeSubscription
            );
            fallback = recovered?.fallback || {};
            onboardingPayload = recovered?.onboardingPayload || null;
          } finally {
            client.release();
          }
        }

        if (
          !onboardingPayload &&
          eventType === "customer.subscription.created"
        ) {
          const client = await postgres.connect();
          try {
            onboardingPayload =
              await loadOnboardingPayloadFromSubscriptionContext(
                client,
                stripeSubscription
              );
          } finally {
            client.release();
          }
        }

        await execute.sincronizar_assinatura_stripe({
          stripeSubscription,
          stripeEventId: eventId,
          fallback,
        });
        await sendOnboardingEmailSafely(onboardingPayload);
        return { processed: true, type: eventType };
      } catch (error) {
        if (
          String(error?.message || "").includes(
            "Nao foi possivel identificar empresa/plano para sincronizar assinatura Stripe."
          )
        ) {
          console.warn(
            "[pagamento/webhook] evento Stripe ignorado por falta de contexto de empresa/plano:",
            {
              eventType,
              eventId,
              stripe_subscription_id: stripeSubscription?.id || null,
              stripe_customer_id: stripeSubscription?.customer || null,
            }
          );
          return {
            processed: false,
            ignored: true,
            type: eventType,
            message: error.message,
          };
        }
        throw error;
      }
    }

    if (
      eventType === "invoice.paid" ||
      eventType === "invoice.payment_succeeded" ||
      eventType === "invoice.payment_failed"
    ) {
      const invoice = payload?.data?.object || {};
      await execute.registrar_historico_pagamento_invoice({
        invoice,
        eventType,
        eventId,
      });
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        const { periodEnd } = extractInvoicePeriodBounds(invoice);
        try {
          const stripeSubscription = await stripeRequest(
            "GET",
            `/subscriptions/${subscriptionId}?expand[]=items.data.price`
          );
          await execute.sincronizar_assinatura_stripe({
            stripeSubscription,
            stripeEventId: eventId,
            fallback: {
              current_period_end:
                periodEnd ||
                unixToDateOrNull(invoice?.period_end) ||
                null,
              invoice_paid:
                Boolean(invoice.paid) ||
                eventType === "invoice.paid" ||
                eventType === "invoice.payment_succeeded",
              invoice_paid_at:
                unixToDateOrNull(invoice?.status_transitions?.paid_at) || null,
            },
          });
        } catch (syncError) {
          console.error("[pagamento/webhook] falha ao sincronizar assinatura a partir da invoice:", {
            event_type: eventType,
            event_id: eventId,
            invoice_id: invoice?.id || null,
            subscription_id: subscriptionId,
            message: syncError?.message || syncError,
          });
        }
      }
      return { processed: true, type: eventType };
    }

    return { processed: false, type: eventType };
  },

  // Integracao Gestao 360 (rotas /integracao/gestao360).
  gestao360_provisionar: async ({
    email,
    nome,
    telefone,
    empresa_nome,
    validade,
    referencia,
  }) => {
    const client = await postgres.connect();
    let resultado = null;
    let onboardingPayload = null;

    try {
      await ensureGestao360Schema(client);
      const plano = await loadPlanoGestao360(client);

      await client.query("BEGIN");
      await client.query("select pg_advisory_xact_lock($1, hashtext($2))", [
        GESTAO360_LOCK_KEY,
        email,
      ]);

      const { gerenciada, cliente_ativo } = await resolveContaGestao360(client, email);

      if (gerenciada) {
        const empresaId = Number(gerenciada.empresa_id);
        const ativada = await ativarAssinaturaGestao360(
          client,
          empresaId,
          validade,
          plano
        );

        if (ativada) {
          await client.query(models.update_empresa_origem_gestao360(), [
            empresaId,
            referencia,
            null,
          ]);
          if (gerenciada.onboarding_pendente) {
            onboardingPayload = buildOnboardingPayload({
              usuario_email: email,
              usuario_nome: gerenciada.usuario_nome || nome,
              empresa_nome: gerenciada.empresa_nome || empresa_nome || nome,
              empresa_id: empresaId,
            });
          }
        }

        resultado = {
          status: ativada ? "reativado" : "ja_cliente",
          empresa_id: empresaId,
        };
      } else if (cliente_ativo) {
        // Regra de negocio: cliente ÓRBITA existente nunca tem a assinatura alterada.
        resultado = {
          status: "ja_cliente",
          empresa_id: Number(cliente_ativo.empresa_id),
        };
      } else {
        const companyName = empresa_nome || nome;
        const criada = await createEmpresaComUsuarioMaster(client, {
          email,
          userName: nome,
          companyName,
        });
        const empresaId = Number(criada.empresa.id);

        await client.query(models.update_empresa_origem_gestao360(), [
          empresaId,
          referencia,
          criada.senha_inicial,
        ]);
        if (telefone && criada.usuario?.id) {
          await client.query(models.update_usuario_telefone_por_id(), [
            criada.usuario.id,
            telefone,
          ]);
        }
        await ativarAssinaturaGestao360(client, empresaId, validade, plano);

        onboardingPayload = buildOnboardingPayload({
          usuario_email: email,
          usuario_nome: nome,
          empresa_nome: criada.empresa.nome_fantasia || companyName,
          empresa_id: empresaId,
        });
        resultado = { status: "criado", empresa_id: empresaId };
      }

      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // noop
      }
      throw error;
    } finally {
      client.release();
    }

    // E-mail "Finalize seu cadastro" so depois do commit, fora da conexao.
    await sendOnboardingEmailSafely(onboardingPayload);

    return resultado;
  },

  gestao360_renovar: async ({ email, validade }) => {
    const client = await postgres.connect();

    try {
      await ensureGestao360Schema(client);

      await client.query("BEGIN");
      await client.query("select pg_advisory_xact_lock($1, hashtext($2))", [
        GESTAO360_LOCK_KEY,
        email,
      ]);

      const { gerenciada, outra } = await resolveContaGestao360(client, email);
      let status = outra ? "nao_gerenciado" : "nao_encontrado";

      if (gerenciada) {
        const ativada = await ativarAssinaturaGestao360(
          client,
          Number(gerenciada.empresa_id),
          validade
        );
        status = ativada ? "renovado" : "nao_gerenciado";
      }

      await client.query("COMMIT");

      return { status };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // noop
      }
      throw error;
    } finally {
      client.release();
    }
  },

  gestao360_bloquear: async ({ email }) => {
    const client = await postgres.connect();

    try {
      await ensureGestao360Schema(client);

      await client.query("BEGIN");
      await client.query("select pg_advisory_xact_lock($1, hashtext($2))", [
        GESTAO360_LOCK_KEY,
        email,
      ]);

      const { gerenciada, outra } = await resolveContaGestao360(client, email);
      let status = outra ? "nao_gerenciado" : "nao_encontrado";

      if (gerenciada) {
        const empresaId = Number(gerenciada.empresa_id);
        const propriaQuery = await client.query(
          models.get_assinatura_propria_ativa_empresa(),
          [empresaId]
        );

        if (propriaQuery.rows.length) {
          // Empresa assinou por conta propria: a integracao nao bloqueia.
          status = "nao_gerenciado";
        } else {
          // So desativa a assinatura criada pela integracao (assinatua_hash = 'gestao360').
          await client.query(models.desativar_assinatura_gestao360_empresa(), [
            empresaId,
          ]);
          status = "bloqueado";
        }
      }

      await client.query("COMMIT");

      return { status };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // noop
      }
      throw error;
    } finally {
      client.release();
    }
  },

  gestao360_status: async ({ email }) => {
    const client = await postgres.connect();

    try {
      await ensureGestao360Schema(client);

      const { gerenciada, outra } = await resolveContaGestao360(client, email);
      const conta = gerenciada || outra;

      if (!conta) {
        return {
          existe: false,
          origem_gestao360: false,
          ativo: false,
          validade: null,
          empresa_id: null,
        };
      }

      const assinaturaQuery = await client.query(
        models.get_assinatura_resumo_empresa(),
        [conta.empresa_id]
      );
      const assinatura = assinaturaQuery.rows[0] || null;

      return {
        existe: true,
        origem_gestao360: Boolean(gerenciada),
        ativo:
          Boolean(conta.usuario_ativo) &&
          Boolean(conta.empresa_ativo) &&
          Boolean(assinatura?.ativo),
        validade: assinatura?.validade || null,
        empresa_id: Number(conta.empresa_id),
        gerenciado_gestao360: Boolean(gerenciada) && Boolean(assinatura?.gerenciada_gestao360),
      };
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
