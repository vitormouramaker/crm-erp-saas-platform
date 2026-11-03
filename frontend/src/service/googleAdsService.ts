import { API_BASE } from "../config/api";
import { decrypt, encrypt } from "../utils/cripto";

type ApiEnvelope<T> = {
  boleano?: boolean;
  boll?: boolean;
  boolean?: boolean;
  success?: boolean;
  ok?: boolean;
  obj?: T;
  mensagem?: string;
  message?: string;
  msg?: string;
};

type RawGoogleAdsAccount = {
  id?: number;
  empresa_id?: number;
  customer_id?: string | null;
  customer_name?: string | null;
  currency_code?: string | null;
  time_zone?: string | null;
  status?: string | null;
  manager?: boolean;
  test_account?: boolean;
  resource_name?: string | null;
  login_customer_id?: string | null;
  token_expires_at?: string | null;
  last_oauth_at?: string | null;
  google_customer_id?: string | null;
  google_customer_name?: string | null;
  google_currency_code?: string | null;
  google_time_zone?: string | null;
  google_status?: string | null;
  google_manager?: boolean;
  google_test_account?: boolean;
  google_resource_name?: string | null;
  google_login_customer_id?: string | null;
  google_access_token_expires_at?: string | null;
  google_last_oauth_at?: string | null;
};

type GoogleAdsAccount = {
  id?: number;
  empresa_id?: number;
  customer_id?: string | null;
  customer_name?: string | null;
  currency_code?: string | null;
  time_zone?: string | null;
  status?: string | null;
  manager?: boolean;
  test_account?: boolean;
  resource_name?: string | null;
  login_customer_id?: string | null;
  token_expires_at?: string | null;
  last_oauth_at?: string | null;
};

type GoogleAdsTokenData = {
  access_token?: string | null;
  refresh_token?: string | null;
  token_type?: string | null;
  scope?: string | null;
  expires_in?: number | null;
};

type GoogleAdsStatusData = {
  conectado?: boolean;
  pronto_para_uso?: boolean;
  total_contas?: number;
  contas?: GoogleAdsAccount[];
};

type GoogleAdsOauthUrlResult = {
  auth_url?: string;
  state?: string;
  redirect_uri?: string;
  scope?: string[] | string;
};

type ValidateGoogleAdsAssetsResult = {
  liberado?: boolean;
  total_contas?: number;
  token_type?: string | null;
  expires_in?: number | null;
  scope?: string | null;
  oauth_token?: GoogleAdsTokenData | null;
  available_accounts?: GoogleAdsAccount[];
  selected_accounts?: GoogleAdsAccount[];
};

type SaveGoogleAdsIntegrationResult = {
  status?: GoogleAdsStatusData;
  available_accounts?: GoogleAdsAccount[];
};

type RemoveGoogleAdsAccountResult = {
  status?: GoogleAdsStatusData;
  contas?: GoogleAdsAccount[];
};

type GoogleAdsMetricSummary = {
  impressions: number;
  clicks: number;
  interactions: number;
  conversions: number;
  all_conversions: number;
  conversions_value: number;
  cost_micros: number;
  cost: number;
  ctr: number;
  average_cpc: number;
  average_cpm: number;
  cost_per_conversion: number;
};

type GoogleAdsAccountMetricsSummary = GoogleAdsAccount & {
  summary: GoogleAdsMetricSummary;
  total_campaigns: number;
  total_ad_groups?: number;
  total_keywords?: number;
};

type GoogleAdsCampaignMetricsRow = {
  customer_id: string;
  customer_name?: string | null;
  currency_code?: string | null;
  time_zone?: string | null;
  campaign_id: string;
  campaign_name: string;
  campaign_status?: string | null;
  channel_type?: string | null;
  channel_sub_type?: string | null;
  impressions: number;
  clicks: number;
  interactions: number;
  conversions: number;
  all_conversions: number;
  conversions_value: number;
  cost_micros: number;
  cost: number;
  ctr: number;
  average_cpc: number;
  average_cpm: number;
  cost_per_conversion: number;
};

type GoogleAdsAdGroupMetricsRow = {
  customer_id: string;
  customer_name?: string | null;
  currency_code?: string | null;
  time_zone?: string | null;
  campaign_id: string;
  campaign_name: string;
  campaign_status?: string | null;
  channel_type?: string | null;
  ad_group_id: string;
  ad_group_name: string;
  ad_group_status?: string | null;
  ad_group_type?: string | null;
  impressions: number;
  clicks: number;
  interactions: number;
  conversions: number;
  all_conversions: number;
  conversions_value: number;
  cost_micros: number;
  cost: number;
  ctr: number;
  average_cpc: number;
  average_cpm: number;
  cost_per_conversion: number;
};

type GoogleAdsMetricsResult = {
  period?: {
    start_date?: string;
    end_date?: string;
  };
  linked_accounts?: GoogleAdsAccount[];
  account_summaries?: GoogleAdsAccountMetricsSummary[];
  campaigns?: GoogleAdsCampaignMetricsRow[];
  ad_groups?: GoogleAdsAdGroupMetricsRow[];
  keywords?: GoogleAdsKeywordMetricsRow[];
  daily_performance?: GoogleAdsDailyPerformanceRow[];
  summary?: GoogleAdsMetricSummary;
  warnings?: Array<{ customer_id?: string; message?: string }>;
  total_accounts?: number;
  total_campaigns?: number;
  total_ad_groups?: number;
  total_keywords?: number;
  total_daily_rows?: number;
};

type GoogleAdsKeywordMetricsRow = {
  customer_id: string;
  customer_name?: string | null;
  currency_code?: string | null;
  time_zone?: string | null;
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  keyword_id: string;
  keyword_text: string;
  keyword_match_type?: string | null;
  keyword_status?: string | null;
  impressions: number;
  clicks: number;
  interactions: number;
  conversions: number;
  all_conversions: number;
  conversions_value: number;
  cost_micros: number;
  cost: number;
  ctr: number;
  average_cpc: number;
  average_cpm: number;
  cost_per_conversion: number;
};

type GoogleAdsDailyPerformanceRow = {
  customer_id: string;
  customer_name?: string | null;
  currency_code?: string | null;
  time_zone?: string | null;
  campaign_id: string;
  campaign_name: string;
  campaign_status?: string | null;
  date: string;
  impressions: number;
  clicks: number;
  interactions: number;
  conversions: number;
  all_conversions: number;
  conversions_value: number;
  cost_micros: number;
  cost: number;
  ctr: number;
  average_cpc: number;
  average_cpm: number;
  cost_per_conversion: number;
};

type IntegrationStatusResult = {
  statusText: string;
  isActive: boolean;
  data: GoogleAdsStatusData;
};

async function postEncrypted<T>(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<{ obj: T; message?: string; raw: unknown; ok: boolean }> {
  const encrypted = await encrypt(payload);
  const response = await fetch(`${API_BASE}/google_ads${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: encrypted }),
  });

  if (!response.ok) {
    throw new Error("Falha de comunicacao com o servidor.");
  }

  const responseData = await response.json();
  const decryptedPayload = responseData?.payload
    ? await decrypt(responseData.payload)
    : responseData;

  const data = decryptedPayload as ApiEnvelope<T> & Record<string, unknown>;
  const ok =
    Boolean(data?.boleano) ||
    Boolean(data?.boll) ||
    Boolean(data?.boolean) ||
    Boolean(data?.ok) ||
    Boolean(data?.success);

  const message =
    data?.mensagem ||
    data?.message ||
    data?.msg ||
    (ok ? undefined : "Nao foi possivel concluir a operacao.");

  if (!ok) {
    throw new Error(message);
  }

  return {
    obj: (data?.obj as T) ?? ({} as T),
    message,
    raw: data,
    ok,
  };
}

function normalizeStatusText(data: GoogleAdsStatusData, fallback?: string): string {
  if (typeof data?.total_contas === "number") {
    if (data.total_contas > 0) {
      return `${data.total_contas} conta(s) Google Ads vinculada(s)`;
    }
    return "Nenhuma conta Google Ads vinculada";
  }

  return fallback || "Status nao informado";
}

function normalizeGoogleAdsAccount(raw: RawGoogleAdsAccount): GoogleAdsAccount {
  return {
    id: raw.id,
    empresa_id: raw.empresa_id,
    customer_id: raw.customer_id ?? raw.google_customer_id ?? null,
    customer_name: raw.customer_name ?? raw.google_customer_name ?? null,
    currency_code: raw.currency_code ?? raw.google_currency_code ?? null,
    time_zone: raw.time_zone ?? raw.google_time_zone ?? null,
    status: raw.status ?? raw.google_status ?? null,
    manager:
      raw.manager === undefined ? Boolean(raw.google_manager) : Boolean(raw.manager),
    test_account:
      raw.test_account === undefined
        ? Boolean(raw.google_test_account)
        : Boolean(raw.test_account),
    resource_name: raw.resource_name ?? raw.google_resource_name ?? null,
    login_customer_id:
      raw.login_customer_id ?? raw.google_login_customer_id ?? null,
    token_expires_at:
      raw.token_expires_at ?? raw.google_access_token_expires_at ?? null,
    last_oauth_at: raw.last_oauth_at ?? raw.google_last_oauth_at ?? null,
  };
}

function normalizeMetricNumber(value: unknown, digits = 2): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const factor = 10 ** digits;
  return Math.round(parsed * factor) / factor;
}

function normalizeGoogleAdsMetricSummary(
  raw: Partial<GoogleAdsMetricSummary> | null | undefined,
): GoogleAdsMetricSummary {
  return {
    impressions: normalizeMetricNumber(raw?.impressions ?? 0, 0),
    clicks: normalizeMetricNumber(raw?.clicks ?? 0, 0),
    interactions: normalizeMetricNumber(raw?.interactions ?? 0, 0),
    conversions: normalizeMetricNumber(raw?.conversions ?? 0),
    all_conversions: normalizeMetricNumber(raw?.all_conversions ?? 0),
    conversions_value: normalizeMetricNumber(raw?.conversions_value ?? 0),
    cost_micros: normalizeMetricNumber(raw?.cost_micros ?? 0, 0),
    cost: normalizeMetricNumber(raw?.cost ?? 0),
    ctr: normalizeMetricNumber(raw?.ctr ?? 0),
    average_cpc: normalizeMetricNumber(raw?.average_cpc ?? 0),
    average_cpm: normalizeMetricNumber(raw?.average_cpm ?? 0),
    cost_per_conversion: normalizeMetricNumber(raw?.cost_per_conversion ?? 0),
  };
}

function normalizeGoogleAdsCampaignMetricsRow(
  raw: Partial<GoogleAdsCampaignMetricsRow> & Record<string, unknown>,
): GoogleAdsCampaignMetricsRow {
  return {
    customer_id: String(raw.customer_id || ""),
    customer_name: typeof raw.customer_name === "string" ? raw.customer_name : null,
    currency_code: typeof raw.currency_code === "string" ? raw.currency_code : null,
    time_zone: typeof raw.time_zone === "string" ? raw.time_zone : null,
    campaign_id: String(raw.campaign_id || ""),
    campaign_name: String(raw.campaign_name || raw.campaign_id || "Campanha"),
    campaign_status:
      typeof raw.campaign_status === "string" ? raw.campaign_status : null,
    channel_type: typeof raw.channel_type === "string" ? raw.channel_type : null,
    channel_sub_type:
      typeof raw.channel_sub_type === "string" ? raw.channel_sub_type : null,
    ...normalizeGoogleAdsMetricSummary(raw),
  };
}

function normalizeGoogleAdsAdGroupMetricsRow(
  raw: Partial<GoogleAdsAdGroupMetricsRow> & Record<string, unknown>,
): GoogleAdsAdGroupMetricsRow {
  return {
    customer_id: String(raw.customer_id || ""),
    customer_name: typeof raw.customer_name === "string" ? raw.customer_name : null,
    currency_code: typeof raw.currency_code === "string" ? raw.currency_code : null,
    time_zone: typeof raw.time_zone === "string" ? raw.time_zone : null,
    campaign_id: String(raw.campaign_id || ""),
    campaign_name: String(raw.campaign_name || raw.campaign_id || "Campanha"),
    campaign_status:
      typeof raw.campaign_status === "string" ? raw.campaign_status : null,
    channel_type: typeof raw.channel_type === "string" ? raw.channel_type : null,
    ad_group_id: String(raw.ad_group_id || ""),
    ad_group_name: String(raw.ad_group_name || raw.ad_group_id || "Conjunto"),
    ad_group_status:
      typeof raw.ad_group_status === "string" ? raw.ad_group_status : null,
    ad_group_type:
      typeof raw.ad_group_type === "string" ? raw.ad_group_type : null,
    ...normalizeGoogleAdsMetricSummary(raw),
  };
}

function normalizeGoogleAdsKeywordMetricsRow(
  raw: Partial<GoogleAdsKeywordMetricsRow> & Record<string, unknown>,
): GoogleAdsKeywordMetricsRow {
  return {
    customer_id: String(raw.customer_id || ""),
    customer_name: typeof raw.customer_name === "string" ? raw.customer_name : null,
    currency_code: typeof raw.currency_code === "string" ? raw.currency_code : null,
    time_zone: typeof raw.time_zone === "string" ? raw.time_zone : null,
    campaign_id: String(raw.campaign_id || ""),
    campaign_name: String(raw.campaign_name || raw.campaign_id || "Campanha"),
    ad_group_id: String(raw.ad_group_id || ""),
    ad_group_name: String(raw.ad_group_name || raw.ad_group_id || "Conjunto"),
    keyword_id: String(raw.keyword_id || ""),
    keyword_text: String(raw.keyword_text || ""),
    keyword_match_type:
      typeof raw.keyword_match_type === "string" ? raw.keyword_match_type : null,
    keyword_status:
      typeof raw.keyword_status === "string" ? raw.keyword_status : null,
    ...normalizeGoogleAdsMetricSummary(raw),
  };
}

function normalizeGoogleAdsDailyPerformanceRow(
  raw: Partial<GoogleAdsDailyPerformanceRow> & Record<string, unknown>,
): GoogleAdsDailyPerformanceRow {
  return {
    customer_id: String(raw.customer_id || ""),
    customer_name: typeof raw.customer_name === "string" ? raw.customer_name : null,
    currency_code: typeof raw.currency_code === "string" ? raw.currency_code : null,
    time_zone: typeof raw.time_zone === "string" ? raw.time_zone : null,
    campaign_id: String(raw.campaign_id || ""),
    campaign_name: String(raw.campaign_name || raw.campaign_id || "Campanha"),
    campaign_status:
      typeof raw.campaign_status === "string" ? raw.campaign_status : null,
    date: String(raw.date || ""),
    ...normalizeGoogleAdsMetricSummary(raw),
  };
}

export const GoogleAdsService = {
  async getIntegrationStatus(empresaId: number): Promise<IntegrationStatusResult> {
    const { obj, message } = await postEncrypted<GoogleAdsStatusData>(
      "/status_integracao",
      { empresa_id: empresaId },
    );

    const statusText = normalizeStatusText(obj, message);
    const isActive = Boolean(obj?.conectado || obj?.pronto_para_uso);

    return {
      statusText,
      isActive,
      data: obj,
    };
  },

  async listAccounts(empresaId: number): Promise<GoogleAdsAccount[]> {
    const { obj } = await postEncrypted<RawGoogleAdsAccount[]>("/listar_contas", {
      empresa_id: empresaId,
    });

    if (!Array.isArray(obj)) return [];
    return obj.map(normalizeGoogleAdsAccount);
  },

  async getOauthUrl(params: {
    empresaId: number;
    redirectUri: string;
    loginHint?: string;
  }): Promise<GoogleAdsOauthUrlResult> {
    const { obj } = await postEncrypted<GoogleAdsOauthUrlResult>("/oauth_url", {
      empresa_id: params.empresaId,
      redirect_uri: params.redirectUri,
      login_hint: params.loginHint || undefined,
    });

    return obj || {};
  },

  async validateAssets(params: {
    empresaId: number;
    code?: string;
    redirectUri?: string;
    oauthToken?: GoogleAdsTokenData | null;
    selectedCustomerIds?: string[];
  }): Promise<ValidateGoogleAdsAssetsResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
    };

    if (params.code) payload.code = params.code;
    if (params.redirectUri) payload.redirect_uri = params.redirectUri;
    if (params.oauthToken?.access_token) payload.access_token = params.oauthToken.access_token;
    if (params.oauthToken?.refresh_token) {
      payload.refresh_token = params.oauthToken.refresh_token;
    }
    if (params.oauthToken?.token_type) payload.token_type = params.oauthToken.token_type;
    if (params.oauthToken?.scope) payload.scope = params.oauthToken.scope;
    if (params.oauthToken?.expires_in) payload.expires_in = params.oauthToken.expires_in;
    if (params.selectedCustomerIds?.length) {
      payload.selected_customer_ids = params.selectedCustomerIds;
    }

    const { obj } = await postEncrypted<ValidateGoogleAdsAssetsResult>(
      "/validar_ativos",
      payload,
    );

    return {
      ...obj,
      available_accounts: Array.isArray(obj?.available_accounts)
        ? obj.available_accounts.map(normalizeGoogleAdsAccount)
        : [],
      selected_accounts: Array.isArray(obj?.selected_accounts)
        ? obj.selected_accounts.map(normalizeGoogleAdsAccount)
        : [],
    };
  },

  async saveIntegration(params: {
    empresaId: number;
    code?: string;
    redirectUri?: string;
    oauthToken?: GoogleAdsTokenData | null;
    selectedCustomerIds?: string[];
  }): Promise<SaveGoogleAdsIntegrationResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
    };

    if (params.code) payload.code = params.code;
    if (params.redirectUri) payload.redirect_uri = params.redirectUri;
    if (params.oauthToken?.access_token) payload.access_token = params.oauthToken.access_token;
    if (params.oauthToken?.refresh_token) {
      payload.refresh_token = params.oauthToken.refresh_token;
    }
    if (params.oauthToken?.token_type) payload.token_type = params.oauthToken.token_type;
    if (params.oauthToken?.scope) payload.scope = params.oauthToken.scope;
    if (params.oauthToken?.expires_in) payload.expires_in = params.oauthToken.expires_in;
    if (params.selectedCustomerIds?.length) {
      payload.selected_customer_ids = params.selectedCustomerIds;
    }

    const { obj } = await postEncrypted<SaveGoogleAdsIntegrationResult>(
      "/salvar_integracao",
      payload,
    );

    return {
      ...obj,
      available_accounts: Array.isArray(obj?.available_accounts)
        ? obj.available_accounts.map(normalizeGoogleAdsAccount)
        : [],
    };
  },

  async getMetrics(params: {
    empresaId: number;
    customerId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<GoogleAdsMetricsResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
    };

    if (params.customerId) payload.customer_id = params.customerId;
    if (params.startDate) payload.start_date = params.startDate;
    if (params.endDate) payload.end_date = params.endDate;

    const { obj } = await postEncrypted<GoogleAdsMetricsResult>("/metricas", payload);

    return {
      ...obj,
      linked_accounts: Array.isArray(obj?.linked_accounts)
        ? obj.linked_accounts.map(normalizeGoogleAdsAccount)
        : [],
      account_summaries: Array.isArray(obj?.account_summaries)
        ? obj.account_summaries.map((item) => ({
            ...normalizeGoogleAdsAccount(item),
            summary: normalizeGoogleAdsMetricSummary(item?.summary),
            total_campaigns: normalizeMetricNumber(item?.total_campaigns ?? 0, 0),
            total_ad_groups: normalizeMetricNumber(item?.total_ad_groups ?? 0, 0),
            total_keywords: normalizeMetricNumber(item?.total_keywords ?? 0, 0),
          }))
        : [],
      campaigns: Array.isArray(obj?.campaigns)
        ? obj.campaigns.map((item) =>
            normalizeGoogleAdsCampaignMetricsRow(
              item as Partial<GoogleAdsCampaignMetricsRow> & Record<string, unknown>,
            ),
          )
        : [],
      ad_groups: Array.isArray(obj?.ad_groups)
        ? obj.ad_groups.map((item) =>
            normalizeGoogleAdsAdGroupMetricsRow(
              item as Partial<GoogleAdsAdGroupMetricsRow> & Record<string, unknown>,
            ),
          )
        : [],
      keywords: Array.isArray(obj?.keywords)
        ? obj.keywords.map((item) =>
            normalizeGoogleAdsKeywordMetricsRow(
              item as Partial<GoogleAdsKeywordMetricsRow> & Record<string, unknown>,
            ),
          )
        : [],
      daily_performance: Array.isArray(obj?.daily_performance)
        ? obj.daily_performance.map((item) =>
            normalizeGoogleAdsDailyPerformanceRow(
              item as Partial<GoogleAdsDailyPerformanceRow> & Record<string, unknown>,
            ),
          )
        : [],
      summary: normalizeGoogleAdsMetricSummary(obj?.summary),
      warnings: Array.isArray(obj?.warnings) ? obj.warnings : [],
      total_accounts: normalizeMetricNumber(obj?.total_accounts ?? 0, 0),
      total_campaigns: normalizeMetricNumber(obj?.total_campaigns ?? 0, 0),
      total_ad_groups: normalizeMetricNumber(obj?.total_ad_groups ?? 0, 0),
      total_keywords: normalizeMetricNumber(obj?.total_keywords ?? 0, 0),
      total_daily_rows: normalizeMetricNumber(obj?.total_daily_rows ?? 0, 0),
    };
  },

  async removeAccount(params: {
    empresaId: number;
    customerId: string;
  }): Promise<RemoveGoogleAdsAccountResult> {
    const { obj } = await postEncrypted<RemoveGoogleAdsAccountResult>(
      "/remover_conta",
      {
        empresa_id: params.empresaId,
        customer_id: params.customerId,
      },
    );

    return {
      ...obj,
      contas: Array.isArray(obj?.contas)
        ? obj.contas.map(normalizeGoogleAdsAccount)
        : [],
    };
  },
};

export type {
  GoogleAdsAccount,
  GoogleAdsAccountMetricsSummary,
  GoogleAdsAdGroupMetricsRow,
  GoogleAdsCampaignMetricsRow,
  GoogleAdsDailyPerformanceRow,
  GoogleAdsKeywordMetricsRow,
  GoogleAdsMetricSummary,
  GoogleAdsMetricsResult,
  GoogleAdsOauthUrlResult,
  RemoveGoogleAdsAccountResult,
  GoogleAdsStatusData,
  GoogleAdsTokenData,
  IntegrationStatusResult as GoogleAdsIntegrationStatusResult,
  SaveGoogleAdsIntegrationResult,
  ValidateGoogleAdsAssetsResult,
};
