const axios = require("axios");
const { DEFAULT_GRAPH_VERSION, exchangeCodeForAccessToken } = require("./function_meta");

async function getMetaAdsAccounts(accessToken) {
  if (!accessToken) {
    throw new Error("Token de acesso da Meta Ads não informado.");
  }

  const response = await axios.get(
    `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/me/adaccounts`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      params: {
        fields: [
          "id",
          "name",
          "account_id",
          "account_status",
          "currency",
          "timezone_id",
          "timezone_name",
          "disable_reason",
          "business{id,name}"
        ].join(","),
        limit: 500
      }
    }
  );

  return response.data;
}

async function getMetaPages(accessToken) {
  if (!accessToken) {
    throw new Error("Token de acesso da Meta Ads nao informado.");
  }

  const response = await axios.get(
    `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/me/accounts`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      params: {
        fields: [
          "id",
          "name",
          "access_token",
          "category"
        ].join(","),
        limit: 200
      }
    }
  );

  return Array.isArray(response?.data?.data) ? response.data.data : [];
}

async function getMetaAdAccountPromotePages(accessToken, adAccountId) {
  if (!accessToken) {
    throw new Error("Token de acesso da Meta Ads nao informado.");
  }

  if (!adAccountId) {
    return [];
  }

  const normalizedAdAccountId = String(adAccountId).trim();
  if (!normalizedAdAccountId) {
    return [];
  }

  const response = await axios.get(
    `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${normalizedAdAccountId}/promote_pages`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      params: {
        fields: [
          "id",
          "name",
          "access_token",
          "category"
        ].join(","),
        limit: 200
      }
    }
  );

  return Array.isArray(response?.data?.data) ? response.data.data : [];
}

async function fetchMetaAdsCollection(accessToken, path, fields, limit = 200, maxPages = 5) {
  if (!accessToken) {
    throw new Error("Token de acesso da Meta Ads nao informado.");
  }

  const items = [];
  let nextUrl = `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${path}`;
  let page = 0;

  while (nextUrl && page < maxPages) {
    const response = await axios.get(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      params:
        page === 0
          ? {
              fields,
              limit
            }
          : undefined
    });

    const data = response?.data;
    if (Array.isArray(data?.data)) {
      items.push(...data.data);
    }

    nextUrl = data?.paging?.next || null;
    page += 1;
  }

  return items;
}

async function getMetaAdsLeadForms(accessToken, adAccountId) {
  const pages = await getMetaPages(accessToken);
  const promotedPages = await getMetaAdAccountPromotePages(accessToken, adAccountId);
  const forms = [];
  const promotedPageIds = new Set(
    (promotedPages || [])
      .map((page) => String(page?.id || "").trim())
      .filter(Boolean)
  );
  const allowedPages =
    promotedPageIds.size > 0
      ? pages.filter((page) => promotedPageIds.has(String(page?.id || "").trim()))
      : [];

  for (const page of allowedPages) {
    const pageId = String(page?.id || "").trim();
    if (!pageId) continue;

    const pageToken = String(page?.access_token || "").trim() || accessToken;
    const pageForms = await fetchMetaAdsCollection(
      pageToken,
      `${pageId}/leadgen_forms`,
      [
        "id",
        "name",
        "status",
        "locale",
        "created_time",
        "leads_count",
        "page_id",
        "follow_up_action_url"
      ].join(","),
      200,
      5
    );

    pageForms.forEach((form) => {
      forms.push({
        ...form,
        page_id: form?.page_id || pageId,
        page_name: page?.name || null,
        source_ad_account_id: adAccountId || null,
      });
    });
  }

  const deduped = new Map();
  forms.forEach((form) => {
    const formId = String(form?.id || "").trim();
    if (!formId || deduped.has(formId)) return;
    deduped.set(formId, form);
  });

  return [...deduped.values()];
}

async function getMetaAdsFormLeads(accessToken, formId, limit = 100) {
  return fetchMetaAdsCollection(
    accessToken,
    `${formId}/leads`,
    [
      "id",
      "created_time",
      "ad_id",
      "ad_name",
      "adset_id",
      "adset_name",
      "campaign_id",
      "campaign_name",
      "form_id",
      "is_organic",
      "field_data",
      "custom_disclaimer_responses"
    ].join(","),
    Math.max(1, Math.min(Number(limit) || 100, 200)),
    5
  );
}

function normalizeMetaLeadFieldValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          return String(item.text || item.value || item.name || "").trim();
        }
        return String(item || "").trim();
      })
      .filter(Boolean)
      .join(", ");
  }

  if (value && typeof value === "object") {
    return String(value.text || value.value || value.name || "").trim();
  }

  return String(value || "").trim();
}

function normalizeMetaLeadFieldKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapMetaLeadFields(fieldData = []) {
  if (!Array.isArray(fieldData)) return [];

  return fieldData
    .map((field) => {
      const originalKey = String(field?.name || "").trim();
      const key = normalizeMetaLeadFieldKey(originalKey);
      const value = normalizeMetaLeadFieldValue(field?.values);
      if (!key || !value) return null;

      return {
        key,
        originalKey,
        label: originalKey || key.replace(/_/g, " "),
        value
      };
    })
    .filter(Boolean);
}

function getMetaLeadFieldValue(mappedFields, aliases = []) {
  const normalizedAliases = aliases.map((alias) =>
    normalizeMetaLeadFieldKey(alias)
  );

  const match = (mappedFields || []).find((field) =>
    normalizedAliases.includes(normalizeMetaLeadFieldKey(field?.key || ""))
  );

  return match?.value || null;
}

function getMetaLeadFieldValueByPredicate(mappedFields, predicate) {
  const match = (mappedFields || []).find((field) => {
    const key = normalizeMetaLeadFieldKey(field?.key || "");
    return key && predicate(key, field);
  });

  return match?.value || null;
}

function normalizeMetaLead(rawLead, formContext = null, mapping = null) {
  const fields = mapMetaLeadFields(rawLead?.field_data || []);
  const normalizedMapping = mapping && typeof mapping === "object" ? mapping : {};
  const nomeMapeado =
    getMetaLeadFieldValue(fields, [normalizedMapping.campo_nome]) || null;
  const telefoneMapeado =
    getMetaLeadFieldValue(fields, [normalizedMapping.campo_telefone]) || null;
  const emailMapeado =
    getMetaLeadFieldValue(fields, [normalizedMapping.campo_email]) || null;
  const nomeDireto =
    getMetaLeadFieldValue(fields, [
      "full_name",
      "name",
      "nome_completo",
      "nome",
      "nome_do_cliente",
      "nome_cliente",
      "nome_para_contato",
      "nome_contato",
      "seu_nome",
      "first_name",
      "last_name",
      "nome_sobrenome"
    ]) || null;
  const telefoneDireto =
    getMetaLeadFieldValue(fields, [
      "phone_number",
      "phone",
      "telefone",
      "telefone_para_contato",
      "telefone_para_contato_whatsapp",
      "telefone_celular",
      "celular",
      "mobile_phone",
      "mobile_number",
      "numero_de_telefone",
      "numero_para_contato",
      "numero_whatsapp",
      "whatsapp_number",
      "whatsapp"
    ]) || null;
  const nome =
    nomeMapeado ||
    nomeDireto ||
    getMetaLeadFieldValueByPredicate(fields, (key) =>
      key.includes("nome") && (
        key.includes("contato") ||
        key.includes("cliente") ||
        key.includes("responsavel")
      )
    ) ||
    null;
  const telefone =
    telefoneMapeado ||
    telefoneDireto ||
    getMetaLeadFieldValueByPredicate(fields, (key) =>
      (
        key.includes("telefone") ||
        key.includes("celular") ||
        key.includes("whatsapp") ||
        key.includes("phone")
      ) && (
        key.includes("contato") ||
        key.includes("cliente") ||
        key.includes("responsavel") ||
        key.includes("numero")
      )
    ) ||
    null;
  const email =
    emailMapeado ||
    getMetaLeadFieldValue(fields, [
      "email",
      "email_address",
      "endereco_de_email"
    ]) || null;
  const empresa =
    getMetaLeadFieldValue(fields, ["company_name", "company", "empresa"]) || null;
  const cidade =
    getMetaLeadFieldValue(fields, ["city", "cidade"]) || null;
  const estado =
    getMetaLeadFieldValue(fields, ["state", "estado"]) || null;
  const cargo =
    getMetaLeadFieldValue(fields, ["job_title", "cargo"]) || null;

  return {
    id: rawLead?.id ? String(rawLead.id) : null,
    created_time: rawLead?.created_time || null,
    form_id: rawLead?.form_id || formContext?.id || null,
    form_name: formContext?.name || null,
    ad_id: rawLead?.ad_id ? String(rawLead.ad_id) : null,
    ad_name: rawLead?.ad_name || null,
    adset_id: rawLead?.adset_id ? String(rawLead.adset_id) : null,
    adset_name: rawLead?.adset_name || null,
    campaign_id: rawLead?.campaign_id ? String(rawLead.campaign_id) : null,
    campaign_name: rawLead?.campaign_name || null,
    is_organic: Boolean(rawLead?.is_organic),
    nome,
    telefone,
    email,
    empresa,
    cidade,
    estado,
    cargo,
    fields,
    payload: rawLead || {}
  };
}

function normalizeMetaAdsAccount(account, tokenData = {}) {
  const tokenExpiresIn = Number(
    tokenData.expires_in || tokenData.token_expires_in || 0
  ) || null;
  const accessToken = tokenData.access_token || tokenData.accessToken || null;

  return {
    meta_business_id: account?.business?.id || null,
    meta_business_name: account?.business?.name || null,
    meta_ad_account_id: String(account?.id || ""),
    meta_ad_account_name: account?.name || null,
    meta_ad_account_status: account?.account_status != null
      ? String(account.account_status)
      : null,
    meta_currency: account?.currency || null,
    meta_timezone_id: account?.timezone_id != null
      ? String(account.timezone_id)
      : null,
    meta_timezone_name: account?.timezone_name || null,
    meta_account_id: account?.account_id != null
      ? String(account.account_id)
      : null,
    meta_disable_reason: account?.disable_reason != null
      ? String(account.disable_reason)
      : null,
    meta_graph_api_version: DEFAULT_GRAPH_VERSION,
    meta_access_token: accessToken,
    meta_access_token_type: tokenData.token_type || null,
    meta_token_expires_in: tokenExpiresIn,
    meta_access_token_expires_at: tokenExpiresIn
      ? new Date(Date.now() + tokenExpiresIn * 1000)
      : null,
    meta_payload: {
      ...account,
      access_token: accessToken,
      token_type: tokenData.token_type || null,
      expires_in: tokenExpiresIn
    }
  };
}

function normalizeMetaAdsAccounts(accounts, tokenData = {}) {
  return (accounts || [])
    .map((account) => normalizeMetaAdsAccount(account, tokenData))
    .filter((account) => account.meta_ad_account_id);
}

function filterSelectedAdAccounts(accounts, payload) {
  const selectedIds = Array.isArray(payload?.selected_ad_account_ids)
    ? payload.selected_ad_account_ids.map((item) => String(item))
    : [];

  if (!selectedIds.length) {
    return accounts || [];
  }

  return (accounts || []).filter((account) =>
    selectedIds.includes(String(account?.id || ""))
  );
}

function mountMetaAdsStatus(accounts) {
  const rows = accounts || [];

  return {
    conectado: rows.length > 0,
    pronto_para_uso: rows.length > 0,
    total_contas: rows.length,
    contas: rows.map((row) => ({
      id: row.id,
      empresa_id: row.empresa_id,
      business_id: row.meta_business_id,
      business_name: row.meta_business_name,
      ad_account_id: row.meta_ad_account_id,
      ad_account_name: row.meta_ad_account_name,
      ad_account_status: row.meta_ad_account_status,
      currency: row.meta_currency,
      timezone_id: row.meta_timezone_id,
      timezone_name: row.meta_timezone_name,
      account_id: row.meta_account_id,
      disable_reason: row.meta_disable_reason,
      graph_api_version: row.meta_graph_api_version,
      token_expires_at: row.meta_access_token_expires_at,
      last_embedded_signup_at: row.meta_last_embedded_signup_at
    }))
  };
}

module.exports = {
  DEFAULT_GRAPH_VERSION,
  exchangeCodeForAccessToken,
  fetchMetaAdsCollection,
  filterSelectedAdAccounts,
  getMetaAdsAccounts,
  getMetaAdsFormLeads,
  getMetaAdsLeadForms,
  getMetaPages,
  normalizeMetaLead,
  mountMetaAdsStatus,
  normalizeMetaAdsAccounts
};
