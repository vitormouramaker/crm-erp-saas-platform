const axios = require("axios");
const crypto = require("crypto");


const url = `${process.env.APP_WEB_BASE_URL || 'http://localhost:5173'}/oauth/google-ads/callback`

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ADS_API_BASE_URL = "https://googleads.googleapis.com";
const GOOGLE_ADS_API_VERSION = String(
  process.env.GOOGLE_ADS_API_VERSION || "v24"
).trim();
const GOOGLE_ADS_DEFAULT_SCOPE = "https://www.googleapis.com/auth/adwords";

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeCustomerId(value) {
  const normalized = String(value || "").replace(/\D/g, "");
  return normalized || null;
}

function parseCustomerIdFromResourceName(resourceName) {
  const match = String(resourceName || "").match(/customers\/(\d+)/i);
  return match ? match[1] : null;
}

function getGoogleAdsErrorPayload(error) {
  return error?.response?.data || error || null;
}

function isGoogleAdsPermissionDeniedError(error) {
  const payload = getGoogleAdsErrorPayload(error);

  if (Array.isArray(payload)) {
    return payload.some((item) => {
      const nestedError = item?.error || {};
      return (
        Number(nestedError?.code || 0) === 403 ||
        String(nestedError?.status || "").trim().toUpperCase() ===
          "PERMISSION_DENIED"
      );
    });
  }

  const nestedError = payload?.error || {};
  return (
    Number(nestedError?.code || 0) === 403 ||
    String(nestedError?.status || "").trim().toUpperCase() ===
      "PERMISSION_DENIED"
  );
}

function buildMinimalGoogleAdsAccountFromResourceName(resourceName) {
  const customerId = parseCustomerIdFromResourceName(resourceName);
  if (!customerId) return null;

  return {
    customer_id: customerId,
    customer_name: null,
    currency_code: null,
    time_zone: null,
    status: null,
    manager: false,
    test_account: false,
    resource_name: `customers/${customerId}`,
    login_customer_id: null,
    payload: {
      resource_name: `customers/${customerId}`,
      partial: true,
      reason: "permission_denied_on_customer_lookup",
    },
  };
}

function getGoogleAdsClientId() {
  return normalizeText(process.env.GOOGLE_ADS_CLIENT_ID || '');
}

function getGoogleAdsClientSecret() {
  return normalizeText(process.env.GOOGLE_ADS_CLIENT_SECRET || "");
}

function getGoogleAdsDeveloperToken() {
  return normalizeText(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
}

function getGoogleAdsDefaultRedirectUri() {
  return normalizeText(process.env.GOOGLE_ADS_REDIRECT_URI || url);
}

function getGoogleAdsScopeList() {
  const configuredScopes = normalizeText(process.env.GOOGLE_ADS_AUTH_SCOPES);
  return (configuredScopes || GOOGLE_ADS_DEFAULT_SCOPE)
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function ensureGoogleAdsOauthEnv() {
  if (!getGoogleAdsClientId() || !getGoogleAdsClientSecret()) {
    throw new Error(
      "Configure GOOGLE_ADS_CLIENT_ID e GOOGLE_ADS_CLIENT_SECRET para usar o login OAuth do Google Ads."
    );
  }
}

function ensureGoogleAdsDeveloperToken() {
  if (!getGoogleAdsDeveloperToken()) {
    throw new Error(
      "Configure GOOGLE_ADS_DEVELOPER_TOKEN para consultar as contas do Google Ads."
    );
  }
}

function generateGoogleAdsOauthState() {
  return `google_ads_${crypto.randomBytes(18).toString("hex")}`;
}

function buildGoogleAdsOauthUrl({
  state,
  redirectUri,
  loginHint = null,
}) {
  ensureGoogleAdsOauthEnv();

  const finalRedirectUri = normalizeText(redirectUri) || getGoogleAdsDefaultRedirectUri();
  if (!finalRedirectUri) {
    throw new Error(
      "Informe redirect_uri ou configure GOOGLE_ADS_REDIRECT_URI para iniciar o OAuth do Google Ads."
    );
  }

  const url = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", getGoogleAdsClientId());
  url.searchParams.set("redirect_uri", finalRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getGoogleAdsScopeList().join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");

  if (state) {
    url.searchParams.set("state", state);
  }

  const normalizedLoginHint = normalizeText(loginHint);
  if (normalizedLoginHint) {
    url.searchParams.set("login_hint", normalizedLoginHint);
  }

  return {
    auth_url: url.toString(),
    state: state || null,
    redirect_uri: finalRedirectUri,
    scope: getGoogleAdsScopeList(),
  };
}

async function exchangeGoogleAdsCodeForTokens(code, redirectUri) {
  ensureGoogleAdsOauthEnv();

  const normalizedCode = normalizeText(code);
  const finalRedirectUri = normalizeText(redirectUri) || getGoogleAdsDefaultRedirectUri();

  if (!normalizedCode) {
    throw new Error("Codigo OAuth do Google Ads nao informado.");
  }

  if (!finalRedirectUri) {
    throw new Error(
      "Informe redirect_uri ou configure GOOGLE_ADS_REDIRECT_URI para trocar o codigo OAuth do Google Ads."
    );
  }

  const body = new URLSearchParams({
    code: normalizedCode,
    client_id: getGoogleAdsClientId(),
    client_secret: getGoogleAdsClientSecret(),
    redirect_uri: finalRedirectUri,
    grant_type: "authorization_code",
  });

  const response = await axios.post(GOOGLE_OAUTH_TOKEN_URL, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return normalizeGoogleAdsTokenData(response.data);
}

async function refreshGoogleAdsAccessToken(refreshToken) {
  ensureGoogleAdsOauthEnv();

  const normalizedRefreshToken = normalizeText(refreshToken);
  if (!normalizedRefreshToken) {
    throw new Error("Refresh token do Google Ads nao informado.");
  }

  const body = new URLSearchParams({
    client_id: getGoogleAdsClientId(),
    client_secret: getGoogleAdsClientSecret(),
    refresh_token: normalizedRefreshToken,
    grant_type: "refresh_token",
  });

  const response = await axios.post(GOOGLE_OAUTH_TOKEN_URL, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return normalizeGoogleAdsTokenData({
    ...response.data,
    refresh_token: normalizedRefreshToken,
  });
}

function normalizeGoogleAdsTokenData(tokenData = {}) {
  const expiresIn = Number(
    tokenData.expires_in || tokenData.expiresIn || tokenData.token_expires_in || 0
  ) || null;
  const accessToken = normalizeText(
    tokenData.access_token || tokenData.accessToken
  );
  const refreshToken = normalizeText(
    tokenData.refresh_token || tokenData.refreshToken
  );
  const scope = normalizeText(tokenData.scope) || getGoogleAdsScopeList().join(" ");

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: normalizeText(tokenData.token_type || tokenData.tokenType),
    scope,
    expires_in: expiresIn,
    access_token_expires_at: expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null,
  };
}

function buildGoogleAdsHeaders(accessToken, loginCustomerId = null) {
  ensureGoogleAdsDeveloperToken();

  const normalizedAccessToken = normalizeText(accessToken);
  if (!normalizedAccessToken) {
    throw new Error("Token de acesso do Google Ads nao informado.");
  }

  const headers = {
    Authorization: `Bearer ${normalizedAccessToken}`,
    "developer-token": getGoogleAdsDeveloperToken(),
  };

  const normalizedLoginCustomerId = normalizeCustomerId(loginCustomerId);
  if (normalizedLoginCustomerId) {
    headers["login-customer-id"] = normalizedLoginCustomerId;
  }

  return headers;
}

async function listAccessibleCustomers(accessToken) {
  const response = await axios.get(
    `${GOOGLE_ADS_API_BASE_URL}/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`,
    {
      headers: buildGoogleAdsHeaders(accessToken),
    }
  );

  return Array.isArray(response?.data?.resourceNames)
    ? response.data.resourceNames
    : [];
}

async function executeGoogleAdsSearchStream({
  customerId,
  accessToken,
  query,
  loginCustomerId = null,
}) {
  const normalizedCustomerId = normalizeCustomerId(customerId);
  if (!normalizedCustomerId) {
    throw new Error("Customer ID do Google Ads nao informado.");
  }

  const response = await axios.post(
    `${GOOGLE_ADS_API_BASE_URL}/${GOOGLE_ADS_API_VERSION}/customers/${normalizedCustomerId}/googleAds:searchStream`,
    {
      query,
    },
    {
      headers: buildGoogleAdsHeaders(accessToken, loginCustomerId),
    }
  );

  const chunks = Array.isArray(response?.data)
    ? response.data
    : response?.data
      ? [response.data]
      : [];

  return chunks.flatMap((chunk) =>
    Array.isArray(chunk?.results) ? chunk.results : []
  );
}

function normalizeGoogleAdsCustomerRow(rawRow, fallbackLoginCustomerId = null) {
  const customer = rawRow?.customer || rawRow?.customerClient || rawRow || {};
  const customerId =
    normalizeCustomerId(customer.id) ||
    parseCustomerIdFromResourceName(customer.resourceName || customer.resource_name);

  if (!customerId) return null;

  return {
    customer_id: customerId,
    customer_name: normalizeText(
      customer.descriptiveName || customer.descriptive_name
    ),
    currency_code: normalizeText(
      customer.currencyCode || customer.currency_code
    ),
    time_zone: normalizeText(customer.timeZone || customer.time_zone),
    status: normalizeText(customer.status),
    manager: Boolean(customer.manager),
    test_account: Boolean(customer.testAccount || customer.test_account),
    resource_name:
      normalizeText(customer.resourceName || customer.resource_name) ||
      `customers/${customerId}`,
    login_customer_id: normalizeCustomerId(
      fallbackLoginCustomerId || customer.loginCustomerId || customer.login_customer_id
    ),
    payload: rawRow || customer,
  };
}

async function getGoogleAdsCustomer(accessToken, customerId, loginCustomerId = null) {
  const rows = await executeGoogleAdsSearchStream({
    customerId,
    accessToken,
    loginCustomerId,
    query: `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.manager,
        customer.test_account,
        customer.status
      FROM customer
      LIMIT 1
    `,
  });

  return normalizeGoogleAdsCustomerRow(rows?.[0] || null, loginCustomerId);
}

async function getGoogleAdsManagerClients(accessToken, managerCustomerId) {
  const rows = await executeGoogleAdsSearchStream({
    customerId: managerCustomerId,
    accessToken,
    loginCustomerId: managerCustomerId,
    query: `
      SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.time_zone,
        customer_client.manager,
        customer_client.test_account,
        customer_client.status
      FROM customer_client
      WHERE customer_client.level = 1
        AND customer_client.hidden = false
    `,
  });

  return rows
    .map((row) => normalizeGoogleAdsCustomerRow(row, managerCustomerId))
    .filter(Boolean);
}

async function getGoogleAdsAvailableAccounts(tokenData = {}) {
  const normalizedTokenData = normalizeGoogleAdsTokenData(tokenData);
  if (!normalizedTokenData.access_token) {
    throw new Error("Token de acesso do Google Ads nao informado.");
  }

  const accessibleResources = await listAccessibleCustomers(
    normalizedTokenData.access_token
  );
  const accountsMap = new Map();

  for (const resourceName of accessibleResources) {
    const accessibleCustomerId = parseCustomerIdFromResourceName(resourceName);
    if (!accessibleCustomerId) continue;

    let rootCustomer = null;

    try {
      // When authenticated user lands on a manager account, Google often expects
      // the same manager ID in the login-customer-id header for detail queries.
      rootCustomer = await getGoogleAdsCustomer(
        normalizedTokenData.access_token,
        accessibleCustomerId,
        accessibleCustomerId
      );
    } catch (error) {
      if (!isGoogleAdsPermissionDeniedError(error)) {
        throw error;
      }

      rootCustomer = buildMinimalGoogleAdsAccountFromResourceName(resourceName);
    }

    if (!rootCustomer) continue;

    accountsMap.set(rootCustomer.customer_id, rootCustomer);

    if (!rootCustomer.manager) continue;

    let childAccounts = [];

    try {
      childAccounts = await getGoogleAdsManagerClients(
        normalizedTokenData.access_token,
        rootCustomer.customer_id
      );
    } catch (error) {
      if (!isGoogleAdsPermissionDeniedError(error)) {
        throw error;
      }

      childAccounts = [];
    }

    for (const childAccount of childAccounts) {
      if (!childAccount?.customer_id) continue;
      accountsMap.set(childAccount.customer_id, childAccount);
    }
  }

  return [...accountsMap.values()].sort((left, right) =>
    String(left?.customer_name || left?.customer_id || "").localeCompare(
      String(right?.customer_name || right?.customer_id || ""),
      "pt-BR",
      { sensitivity: "base" }
    )
  );
}

function normalizeGoogleAdsAccount(account, tokenData = {}) {
  const normalizedTokenData = normalizeGoogleAdsTokenData(tokenData);

  return {
    google_customer_id: normalizeCustomerId(account?.customer_id),
    google_customer_name: normalizeText(account?.customer_name),
    google_currency_code: normalizeText(account?.currency_code),
    google_time_zone: normalizeText(account?.time_zone),
    google_status: normalizeText(account?.status),
    google_manager: Boolean(account?.manager),
    google_test_account: Boolean(account?.test_account),
    google_resource_name:
      normalizeText(account?.resource_name) ||
      (account?.customer_id ? `customers/${normalizeCustomerId(account.customer_id)}` : null),
    google_login_customer_id: normalizeCustomerId(account?.login_customer_id),
    google_access_token: normalizedTokenData.access_token,
    google_refresh_token: normalizedTokenData.refresh_token,
    google_token_type: normalizedTokenData.token_type,
    google_token_scope: normalizedTokenData.scope,
    google_token_expires_in: normalizedTokenData.expires_in,
    google_access_token_expires_at: normalizedTokenData.access_token_expires_at,
    google_payload: {
      ...account,
      token_type: normalizedTokenData.token_type,
      scope: normalizedTokenData.scope,
      expires_in: normalizedTokenData.expires_in,
    },
  };
}

function normalizeGoogleAdsAccounts(accounts, tokenData = {}) {
  return (accounts || [])
    .map((account) => normalizeGoogleAdsAccount(account, tokenData))
    .filter((account) => account.google_customer_id);
}

function filterSelectedGoogleAdsAccounts(accounts, payload) {
  const selectedIds = Array.isArray(payload?.selected_customer_ids)
    ? payload.selected_customer_ids
        .map((item) => normalizeCustomerId(item))
        .filter(Boolean)
    : [];

  if (!selectedIds.length) {
    return accounts || [];
  }

  return (accounts || []).filter((account) =>
    selectedIds.includes(normalizeCustomerId(account?.customer_id))
  );
}

function mountGoogleAdsStatus(accounts) {
  const rows = accounts || [];

  return {
    conectado: rows.length > 0,
    pronto_para_uso: rows.length > 0,
    total_contas: rows.length,
    contas: rows.map((row) => ({
      id: row.id,
      empresa_id: row.empresa_id,
      customer_id: row.google_customer_id,
      customer_name: row.google_customer_name,
      currency_code: row.google_currency_code,
      time_zone: row.google_time_zone,
      status: row.google_status,
      manager: row.google_manager,
      test_account: row.google_test_account,
      resource_name: row.google_resource_name,
      login_customer_id: row.google_login_customer_id,
      token_expires_at: row.google_access_token_expires_at,
      last_oauth_at: row.google_last_oauth_at,
    })),
  };
}

function parseGoogleAdsNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundGoogleAdsMetric(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(parseGoogleAdsNumber(value) * factor) / factor;
}

function formatGoogleAdsDatePart(value) {
  return String(value).padStart(2, "0");
}

function formatGoogleAdsDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return [
    date.getFullYear(),
    formatGoogleAdsDatePart(date.getMonth() + 1),
    formatGoogleAdsDatePart(date.getDate()),
  ].join("-");
}

function normalizeGoogleAdsDateInput(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function resolveGoogleAdsDateRange({ startDate, endDate } = {}) {
  const today = new Date();
  const defaultEndDate = formatGoogleAdsDate(today);

  const initialEndDate = normalizeGoogleAdsDateInput(endDate) || defaultEndDate;
  const parsedEndDate = new Date(`${initialEndDate}T00:00:00`);

  const defaultStartSource = new Date(parsedEndDate);
  defaultStartSource.setDate(defaultStartSource.getDate() - 29);

  const initialStartDate =
    normalizeGoogleAdsDateInput(startDate) || formatGoogleAdsDate(defaultStartSource);

  if (!initialStartDate || !initialEndDate) {
    throw new Error("Periodo do Google Ads invalido.");
  }

  if (initialStartDate > initialEndDate) {
    throw new Error("Data inicial do Google Ads nao pode ser maior que a data final.");
  }

  return {
    start_date: initialStartDate,
    end_date: initialEndDate,
  };
}

function convertGoogleAdsMicrosToCurrency(value) {
  return roundGoogleAdsMetric(parseGoogleAdsNumber(value) / 1000000, 2);
}

function buildGoogleAdsDerivedMetrics(rawTotals = {}) {
  const impressions = parseGoogleAdsNumber(rawTotals.impressions);
  const clicks = parseGoogleAdsNumber(rawTotals.clicks);
  const interactions = parseGoogleAdsNumber(rawTotals.interactions);
  const conversions = parseGoogleAdsNumber(rawTotals.conversions);
  const allConversions = parseGoogleAdsNumber(rawTotals.all_conversions);
  const conversionsValue = roundGoogleAdsMetric(rawTotals.conversions_value, 2);
  const cost = convertGoogleAdsMicrosToCurrency(rawTotals.cost_micros);
  const ctr = impressions > 0 ? roundGoogleAdsMetric((clicks / impressions) * 100, 2) : 0;
  const averageCpc = clicks > 0 ? roundGoogleAdsMetric(cost / clicks, 2) : 0;
  const averageCpm =
    impressions > 0 ? roundGoogleAdsMetric((cost / impressions) * 1000, 2) : 0;
  const costPerConversion =
    conversions > 0 ? roundGoogleAdsMetric(cost / conversions, 2) : 0;

  return {
    impressions,
    clicks,
    interactions,
    conversions: roundGoogleAdsMetric(conversions, 2),
    all_conversions: roundGoogleAdsMetric(allConversions, 2),
    conversions_value: conversionsValue,
    cost_micros: Math.round(parseGoogleAdsNumber(rawTotals.cost_micros)),
    cost,
    ctr,
    average_cpc: averageCpc,
    average_cpm: averageCpm,
    cost_per_conversion: costPerConversion,
  };
}

function summarizeGoogleAdsMetricRows(rows = []) {
  const totals = rows.reduce(
    (accumulator, row) => {
      accumulator.impressions += parseGoogleAdsNumber(row?.impressions);
      accumulator.clicks += parseGoogleAdsNumber(row?.clicks);
      accumulator.interactions += parseGoogleAdsNumber(row?.interactions);
      accumulator.conversions += parseGoogleAdsNumber(row?.conversions);
      accumulator.all_conversions += parseGoogleAdsNumber(row?.all_conversions);
      accumulator.conversions_value += parseGoogleAdsNumber(row?.conversions_value);
      accumulator.cost_micros += parseGoogleAdsNumber(row?.cost_micros);
      return accumulator;
    },
    {
      impressions: 0,
      clicks: 0,
      interactions: 0,
      conversions: 0,
      all_conversions: 0,
      conversions_value: 0,
      cost_micros: 0,
    }
  );

  return buildGoogleAdsDerivedMetrics(totals);
}

function normalizeGoogleAdsCampaignMetricsRow(rawRow = {}) {
  const customer = rawRow.customer || {};
  const campaign = rawRow.campaign || {};
  const metrics = rawRow.metrics || {};

  const customerId = normalizeCustomerId(customer.id);
  const campaignId = normalizeText(campaign.id);

  if (!customerId || !campaignId) return null;

  return {
    customer_id: customerId,
    customer_name: normalizeText(customer.descriptiveName || customer.descriptive_name),
    campaign_id: campaignId,
    campaign_name: normalizeText(campaign.name) || `Campanha ${campaignId}`,
    campaign_status: normalizeText(campaign.status),
    channel_type: normalizeText(
      campaign.advertisingChannelType || campaign.advertising_channel_type
    ),
    channel_sub_type: normalizeText(
      campaign.advertisingChannelSubType || campaign.advertising_channel_sub_type
    ),
    ...buildGoogleAdsDerivedMetrics({
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      interactions: metrics.interactions,
      conversions: metrics.conversions,
      all_conversions: metrics.allConversions || metrics.all_conversions,
      conversions_value: metrics.conversionsValue || metrics.conversions_value,
      cost_micros: metrics.costMicros || metrics.cost_micros,
    }),
  };
}

function normalizeGoogleAdsAdGroupMetricsRow(rawRow = {}) {
  const customer = rawRow.customer || {};
  const campaign = rawRow.campaign || {};
  const adGroup = rawRow.adGroup || rawRow.ad_group || {};
  const metrics = rawRow.metrics || {};

  const customerId = normalizeCustomerId(customer.id);
  const campaignId = normalizeText(campaign.id);
  const adGroupId = normalizeText(adGroup.id);

  if (!customerId || !campaignId || !adGroupId) return null;

  return {
    customer_id: customerId,
    customer_name: normalizeText(customer.descriptiveName || customer.descriptive_name),
    campaign_id: campaignId,
    campaign_name: normalizeText(campaign.name) || `Campanha ${campaignId}`,
    ad_group_id: adGroupId,
    ad_group_name: normalizeText(adGroup.name) || `Conjunto ${adGroupId}`,
    ad_group_status: normalizeText(adGroup.status),
    ad_group_type: normalizeText(adGroup.type),
    campaign_status: normalizeText(campaign.status),
    channel_type: normalizeText(
      campaign.advertisingChannelType || campaign.advertising_channel_type
    ),
    ...buildGoogleAdsDerivedMetrics({
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      interactions: metrics.interactions,
      conversions: metrics.conversions,
      all_conversions: metrics.allConversions || metrics.all_conversions,
      conversions_value: metrics.conversionsValue || metrics.conversions_value,
      cost_micros: metrics.costMicros || metrics.cost_micros,
    }),
  };
}

function normalizeGoogleAdsKeywordMetricsRow(rawRow = {}) {
  const customer = rawRow.customer || {};
  const campaign = rawRow.campaign || {};
  const adGroup = rawRow.adGroup || rawRow.ad_group || {};
  const criterion = rawRow.adGroupCriterion || rawRow.ad_group_criterion || {};
  const keyword = criterion.keyword || {};
  const metrics = rawRow.metrics || {};

  const customerId = normalizeCustomerId(customer.id);
  const campaignId = normalizeText(campaign.id);
  const adGroupId = normalizeText(adGroup.id);
  const criterionId = normalizeText(criterion.criterionId || criterion.criterion_id);
  const keywordText = normalizeText(keyword.text);

  if (!customerId || !campaignId || !adGroupId || !criterionId || !keywordText) {
    return null;
  }

  return {
    customer_id: customerId,
    customer_name: normalizeText(customer.descriptiveName || customer.descriptive_name),
    campaign_id: campaignId,
    campaign_name: normalizeText(campaign.name) || `Campanha ${campaignId}`,
    ad_group_id: adGroupId,
    ad_group_name: normalizeText(adGroup.name) || `Conjunto ${adGroupId}`,
    keyword_id: criterionId,
    keyword_text: keywordText,
    keyword_match_type: normalizeText(keyword.matchType || keyword.match_type),
    keyword_status: normalizeText(criterion.status),
    ...buildGoogleAdsDerivedMetrics({
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      interactions: metrics.interactions,
      conversions: metrics.conversions,
      all_conversions: metrics.allConversions || metrics.all_conversions,
      conversions_value: metrics.conversionsValue || metrics.conversions_value,
      cost_micros: metrics.costMicros || metrics.cost_micros,
    }),
  };
}

function normalizeGoogleAdsDailyMetricsRow(rawRow = {}) {
  const customer = rawRow.customer || {};
  const campaign = rawRow.campaign || {};
  const segments = rawRow.segments || {};
  const metrics = rawRow.metrics || {};

  const customerId = normalizeCustomerId(customer.id);
  const campaignId = normalizeText(campaign.id);
  const day = normalizeText(segments.date);

  if (!customerId || !campaignId || !day) return null;

  return {
    customer_id: customerId,
    customer_name: normalizeText(customer.descriptiveName || customer.descriptive_name),
    campaign_id: campaignId,
    campaign_name: normalizeText(campaign.name) || `Campanha ${campaignId}`,
    campaign_status: normalizeText(campaign.status),
    date: day,
    ...buildGoogleAdsDerivedMetrics({
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      interactions: metrics.interactions,
      conversions: metrics.conversions,
      all_conversions: metrics.allConversions || metrics.all_conversions,
      conversions_value: metrics.conversionsValue || metrics.conversions_value,
      cost_micros: metrics.costMicros || metrics.cost_micros,
    }),
  };
}

async function getGoogleAdsCampaignMetrics({
  accessToken,
  customerId,
  loginCustomerId = null,
  startDate,
  endDate,
}) {
  const period = resolveGoogleAdsDateRange({ startDate, endDate });

  const rows = await executeGoogleAdsSearchStream({
    customerId,
    accessToken,
    loginCustomerId,
    query: `
      SELECT
        customer.id,
        customer.descriptive_name,
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.advertising_channel_sub_type,
        metrics.impressions,
        metrics.clicks,
        metrics.interactions,
        metrics.cost_micros,
        metrics.conversions,
        metrics.all_conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${period.start_date}' AND '${period.end_date}'
      ORDER BY metrics.cost_micros DESC
    `,
  });

  const campaigns = rows
    .map((row) => normalizeGoogleAdsCampaignMetricsRow(row))
    .filter(Boolean)
    .sort((left, right) => {
      const costDiff = parseGoogleAdsNumber(right?.cost) - parseGoogleAdsNumber(left?.cost);
      if (costDiff !== 0) return costDiff;
      return parseGoogleAdsNumber(right?.clicks) - parseGoogleAdsNumber(left?.clicks);
    });

  return {
    period,
    campaigns,
    summary: summarizeGoogleAdsMetricRows(campaigns),
  };
}

async function getGoogleAdsAdGroupMetrics({
  accessToken,
  customerId,
  loginCustomerId = null,
  startDate,
  endDate,
}) {
  const period = resolveGoogleAdsDateRange({ startDate, endDate });

  const rows = await executeGoogleAdsSearchStream({
    customerId,
    accessToken,
    loginCustomerId,
    query: `
      SELECT
        customer.id,
        customer.descriptive_name,
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.type,
        metrics.impressions,
        metrics.clicks,
        metrics.interactions,
        metrics.cost_micros,
        metrics.conversions,
        metrics.all_conversions,
        metrics.conversions_value
      FROM ad_group
      WHERE segments.date BETWEEN '${period.start_date}' AND '${period.end_date}'
      ORDER BY metrics.cost_micros DESC
    `,
  });

  const adGroups = rows
    .map((row) => normalizeGoogleAdsAdGroupMetricsRow(row))
    .filter(Boolean)
    .sort((left, right) => {
      const costDiff = parseGoogleAdsNumber(right?.cost) - parseGoogleAdsNumber(left?.cost);
      if (costDiff !== 0) return costDiff;
      return parseGoogleAdsNumber(right?.clicks) - parseGoogleAdsNumber(left?.clicks);
    });

  return {
    period,
    ad_groups: adGroups,
    summary: summarizeGoogleAdsMetricRows(adGroups),
  };
}

async function getGoogleAdsKeywordMetrics({
  accessToken,
  customerId,
  loginCustomerId = null,
  startDate,
  endDate,
}) {
  const period = resolveGoogleAdsDateRange({ startDate, endDate });

  const rows = await executeGoogleAdsSearchStream({
    customerId,
    accessToken,
    loginCustomerId,
    query: `
      SELECT
        customer.id,
        customer.descriptive_name,
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad_group_criterion.criterion_id,
        ad_group_criterion.status,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        metrics.impressions,
        metrics.clicks,
        metrics.interactions,
        metrics.cost_micros,
        metrics.conversions,
        metrics.all_conversions,
        metrics.conversions_value
      FROM keyword_view
      WHERE segments.date BETWEEN '${period.start_date}' AND '${period.end_date}'
      ORDER BY metrics.cost_micros DESC
    `,
  });

  const keywords = rows
    .map((row) => normalizeGoogleAdsKeywordMetricsRow(row))
    .filter(Boolean)
    .sort((left, right) => {
      const costDiff = parseGoogleAdsNumber(right?.cost) - parseGoogleAdsNumber(left?.cost);
      if (costDiff !== 0) return costDiff;
      return parseGoogleAdsNumber(right?.clicks) - parseGoogleAdsNumber(left?.clicks);
    });

  return {
    period,
    keywords,
    summary: summarizeGoogleAdsMetricRows(keywords),
  };
}

async function getGoogleAdsDailyCampaignMetrics({
  accessToken,
  customerId,
  loginCustomerId = null,
  startDate,
  endDate,
}) {
  const period = resolveGoogleAdsDateRange({ startDate, endDate });

  const rows = await executeGoogleAdsSearchStream({
    customerId,
    accessToken,
    loginCustomerId,
    query: `
      SELECT
        customer.id,
        customer.descriptive_name,
        campaign.id,
        campaign.name,
        campaign.status,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.interactions,
        metrics.cost_micros,
        metrics.conversions,
        metrics.all_conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${period.start_date}' AND '${period.end_date}'
      ORDER BY segments.date DESC, metrics.cost_micros DESC
    `,
  });

  const dailyPerformance = rows
    .map((row) => normalizeGoogleAdsDailyMetricsRow(row))
    .filter(Boolean)
    .sort((left, right) => {
      const dateDiff = String(right?.date || "").localeCompare(String(left?.date || ""));
      if (dateDiff !== 0) return dateDiff;
      return parseGoogleAdsNumber(right?.cost) - parseGoogleAdsNumber(left?.cost);
    });

  return {
    period,
    daily_performance: dailyPerformance,
    summary: summarizeGoogleAdsMetricRows(dailyPerformance),
  };
}

function shouldRefreshGoogleAdsAccessToken(account = {}) {
  const expiresAt = account.google_access_token_expires_at || account.token_expires_at;
  if (!expiresAt) return false;

  const expirationDate = new Date(expiresAt);
  if (Number.isNaN(expirationDate.getTime())) return false;

  return expirationDate.getTime() <= Date.now() + 2 * 60 * 1000;
}

module.exports = {
  GOOGLE_ADS_API_VERSION,
  buildGoogleAdsOauthUrl,
  exchangeGoogleAdsCodeForTokens,
  filterSelectedGoogleAdsAccounts,
  generateGoogleAdsOauthState,
  getGoogleAdsAdGroupMetrics,
  getGoogleAdsAvailableAccounts,
  getGoogleAdsCampaignMetrics,
  getGoogleAdsDailyCampaignMetrics,
  getGoogleAdsKeywordMetrics,
  mountGoogleAdsStatus,
  normalizeGoogleAdsAccounts,
  normalizeGoogleAdsDateInput,
  normalizeGoogleAdsTokenData,
  resolveGoogleAdsDateRange,
  refreshGoogleAdsAccessToken,
  shouldRefreshGoogleAdsAccessToken,
  summarizeGoogleAdsMetricRows,
};
