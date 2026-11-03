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

type MetaAdsAccount = {
  id?: number;
  empresa_id?: number;
  business_id?: string | null;
  business_name?: string | null;
  ad_account_id?: string | null;
  ad_account_name?: string | null;
  ad_account_status?: string | null;
  currency?: string | null;
  timezone_id?: string | null;
  timezone_name?: string | null;
  account_id?: string | null;
  disable_reason?: string | null;
  graph_api_version?: string | null;
  token_expires_at?: string | null;
  last_embedded_signup_at?: string | null;
};

type RawMetaAdsAccount = {
  id?: number;
  empresa_id?: number;
  business_id?: string | null;
  business_name?: string | null;
  ad_account_id?: string | null;
  ad_account_name?: string | null;
  ad_account_status?: string | number | null;
  currency?: string | null;
  timezone_id?: string | number | null;
  timezone_name?: string | null;
  account_id?: string | null;
  disable_reason?: string | number | null;
  graph_api_version?: string | null;
  token_expires_at?: string | null;
  last_embedded_signup_at?: string | null;
  meta_business_id?: string | null;
  meta_business_name?: string | null;
  meta_ad_account_id?: string | null;
  meta_ad_account_name?: string | null;
  meta_ad_account_status?: string | number | null;
  meta_currency?: string | null;
  meta_timezone_id?: string | number | null;
  meta_timezone_name?: string | null;
  meta_account_id?: string | null;
  meta_disable_reason?: string | number | null;
  meta_graph_api_version?: string | null;
  meta_access_token_expires_at?: string | null;
  meta_last_embedded_signup_at?: string | null;
};

type MetaAdsStatusData = {
  conectado?: boolean;
  pronto_para_uso?: boolean;
  total_contas?: number;
  contas?: MetaAdsAccount[];
};

type SaveMetaAdsIntegrationResult = {
  status?: MetaAdsStatusData;
  available_accounts?: Array<{
    id?: string;
    name?: string;
    account_status?: string | number | null;
    business?: { id?: string; name?: string } | null;
  }>;
};

type ValidateMetaAdsAssetsResult = {
  liberado?: boolean;
  total_contas?: number;
  token_type?: string | null;
  expires_in?: number | null;
  available_accounts?: Array<{
    id?: string;
    name?: string;
    account_status?: string | number | null;
    currency?: string | null;
    timezone_name?: string | null;
    business?: { id?: string; name?: string } | null;
  }>;
  selected_accounts?: Array<{
    id?: string;
    name?: string;
    account_status?: string | number | null;
    currency?: string | null;
    timezone_name?: string | null;
    business?: { id?: string; name?: string } | null;
  }>;
};

type MetaAdsCampaignInsightAction = {
  action_type?: string;
  type?: string;
  result_type?: string;
  name?: string;
  key?: string;
  value?: string | number;
  count?: string | number;
  total?: string | number;
  result?: string | number;
  amount?: string | number;
};

type MetaAdsCampaignInsight = {
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  reach?: string | number;
  ctr?: string | number;
  cpc?: string | number;
  cpm?: string | number;
  cpp?: string | number;
  actions?: MetaAdsCampaignInsightAction[];
  results?: MetaAdsCampaignInsightAction[];
  date_start?: string;
  date_stop?: string;
};

type MetaAdsCampaign = {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  start_time?: string;
  budget_remaining?: string | number;
  daily_budget?: string | number;
  configured_status?: string;
  objective?: string;
  created_time?: string;
  insights?: {
    data?: MetaAdsCampaignInsight[];
  };
  week_insights?: MetaAdsCampaignInsight[];
};

type MetaAdsCampaignsResult = {
  data?: MetaAdsCampaign[];
  total_spend?: {
    spend?: string | number;
    clicks?: string | number;
    reach?: string | number;
    cpc?: string | number;
    cpm?: string | number;
    cpp?: string | number;
    date_start?: string;
    date_stop?: string;
  };
};

type MetaAdsFilteredCampaignResult = {
  campaign_id?: string;
  campaign_name?: string;
  status?: string;
  effective_status?: string;
  configured_status?: string;
  objective?: string;
  start_time?: string;
  created_time?: string;
  budget_remaining?: string | number;
  daily_budget?: string | number;
  data_inicio?: string;
  data_fim?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  actions?: Array<{ action_type?: string; value?: string | number }>;
};

type MetaAdsAdInsight = {
  campaign_name?: string;
  ad_name?: string;
  spend?: string | number;
  impressions?: string | number;
  reach?: string | number;
  cpc?: string | number;
  ctr?: string | number;
  cpm?: string | number;
  actions?: Array<{ action_type?: string; value?: string | number }>;
  action_values?: Array<{ action_type?: string; value?: string | number }>;
};

type MetaAdsAd = {
  id?: string;
  name?: string;
  status?: string;
  creative?: {
    id?: string;
    instagram_permalink_url?: string | null;
  };
  insights?: MetaAdsAdInsight[] | { data?: MetaAdsAdInsight[] } | MetaAdsAdInsight;
};

type MetaAdsForm = {
  id?: string;
  name?: string;
  status?: string;
  locale?: string | null;
  created_time?: string | null;
  leads_count?: number | string | null;
  page_id?: string | null;
  page_name?: string | null;
  follow_up_action_url?: string | null;
};

type MetaAdsLeadField = {
  key?: string;
  originalKey?: string;
  label?: string;
  value?: string;
};

type MetaAdsFieldMapping = {
  id?: number;
  empresa_id?: number;
  escopo_tipo?: "form" | "campaign";
  escopo_id?: string;
  escopo_nome?: string | null;
  campo_nome?: string | null;
  campo_telefone?: string | null;
  campo_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MetaAdsRetrievedLead = {
  id?: string;
  created_time?: string | null;
  form_id?: string | null;
  form_name?: string | null;
  ad_id?: string | null;
  ad_name?: string | null;
  adset_id?: string | null;
  adset_name?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  is_organic?: boolean;
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cargo?: string | null;
  imported?: boolean;
  imported_cliente_id?: number | null;
  imported_at?: string | null;
  fields?: MetaAdsLeadField[];
};

type MetaAdsLeadImportResult = {
  total?: number;
  criados?: number;
  atualizados?: number;
  ignorados?: number;
  negocios_criados?: number;
  erros?: Array<{
    linha?: number;
    lead_id?: string | null;
    mensagem?: string;
  }>;
  vinculados?: Array<{
    lead_id?: string;
    cliente_id?: number;
    nome?: string;
    vinculo_id?: number | null;
  }>;
};

type IntegrationStatusResult = {
  statusText: string;
  isActive: boolean;
  data: MetaAdsStatusData;
};

async function postEncrypted<T>(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<{ obj: T; message?: string; raw: unknown; ok: boolean }> {
  const encrypted = await encrypt(payload);
  const response = await fetch(`${API_BASE}/meta_ads${endpoint}`, {
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

function normalizeStatusText(data: MetaAdsStatusData, fallback?: string): string {
  if (typeof data?.total_contas === "number") {
    if (data.total_contas > 0) {
      return `${data.total_contas} conta(s) de anuncio vinculada(s)`;
    }
    return "Nenhuma conta de anuncio vinculada";
  }

  return fallback || "Status nao informado";
}

function normalizeMetaAdsAccount(raw: RawMetaAdsAccount): MetaAdsAccount {
  const timezoneId = raw.timezone_id ?? raw.meta_timezone_id;
  const adAccountStatus = raw.ad_account_status ?? raw.meta_ad_account_status;
  const disableReason = raw.disable_reason ?? raw.meta_disable_reason;

  return {
    id: raw.id,
    empresa_id: raw.empresa_id,
    business_id: raw.business_id ?? raw.meta_business_id ?? null,
    business_name: raw.business_name ?? raw.meta_business_name ?? null,
    ad_account_id: raw.ad_account_id ?? raw.meta_ad_account_id ?? null,
    ad_account_name: raw.ad_account_name ?? raw.meta_ad_account_name ?? null,
    ad_account_status:
      adAccountStatus === undefined || adAccountStatus === null
        ? null
        : String(adAccountStatus),
    currency: raw.currency ?? raw.meta_currency ?? null,
    timezone_id:
      timezoneId === undefined || timezoneId === null ? null : String(timezoneId),
    timezone_name: raw.timezone_name ?? raw.meta_timezone_name ?? null,
    account_id: raw.account_id ?? raw.meta_account_id ?? null,
    disable_reason:
      disableReason === undefined || disableReason === null
        ? null
        : String(disableReason),
    graph_api_version: raw.graph_api_version ?? raw.meta_graph_api_version ?? null,
    token_expires_at:
      raw.token_expires_at ?? raw.meta_access_token_expires_at ?? null,
    last_embedded_signup_at:
      raw.last_embedded_signup_at ?? raw.meta_last_embedded_signup_at ?? null,
  };
}

export const MetaAdsService = {
  async getIntegrationStatus(empresaId: number): Promise<IntegrationStatusResult> {
    const { obj, message } = await postEncrypted<MetaAdsStatusData>(
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

  async listAccounts(empresaId: number): Promise<MetaAdsAccount[]> {
    const { obj } = await postEncrypted<RawMetaAdsAccount[]>("/listar_contas", {
      empresa_id: empresaId,
    });

    if (!Array.isArray(obj)) return [];
    return obj.map(normalizeMetaAdsAccount);
  },

  async saveIntegration(params: {
    empresaId: number;
    signupCode?: string;
    redirectUri?: string;
    accessToken?: string;
    selectedAdAccountIds?: string[];
  }): Promise<SaveMetaAdsIntegrationResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
    };

    if (params.signupCode) payload.signupCode = params.signupCode;
    if (params.redirectUri) payload.redirect_uri = params.redirectUri;
    if (params.accessToken) payload.access_token = params.accessToken;
    if (params.selectedAdAccountIds?.length) {
      payload.selected_ad_account_ids = params.selectedAdAccountIds;
    }

    const { obj } = await postEncrypted<SaveMetaAdsIntegrationResult>(
      "/salvar_integracao",
      payload,
    );

    return obj;
  },

  async validateAssets(params: {
    empresaId: number;
    signupCode?: string;
    redirectUri?: string;
    accessToken?: string;
    selectedAdAccountIds?: string[];
  }): Promise<ValidateMetaAdsAssetsResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
    };

    if (params.signupCode) payload.signupCode = params.signupCode;
    if (params.redirectUri) payload.redirect_uri = params.redirectUri;
    if (params.accessToken) payload.access_token = params.accessToken;
    if (params.selectedAdAccountIds?.length) {
      payload.selected_ad_account_ids = params.selectedAdAccountIds;
    }

    const { obj } = await postEncrypted<ValidateMetaAdsAssetsResult>(
      "/validar_ativos",
      payload,
    );

    return obj;
  },

  async listCampaigns(params: {
    empresaId: number;
    actAdAccount: string;
    onlyActive?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<MetaAdsCampaignsResult> {
    console.log("[MetaAdsService.listCampaigns] params recebidos:", params);

    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
      act_ad_account: params.actAdAccount,
    };

    if (params.onlyActive) payload.filtro = true;
    if (params.startDate) payload.inicio = params.startDate;
    if (params.endDate) payload.fim = params.endDate;

    console.log("[MetaAdsService.listCampaigns] payload enviado:", payload);

    const { obj } = await postEncrypted<MetaAdsCampaignsResult>(
      "/campanhas",
      payload,
    );

    return obj;
  },

  async listAds(params: {
    empresaId: number;
    campaignId: string;
    actAdAccount?: string;
  }): Promise<MetaAdsAd[]> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
      campanha_id: params.campaignId,
    };

    if (params.actAdAccount) payload.act_ad_account = params.actAdAccount;

    const { obj } = await postEncrypted<MetaAdsAd[]>("/ads", payload);
    return Array.isArray(obj) ? obj : [];
  },

  async getCampaignFilteredMetrics(params: {
    empresaId: number;
    campaignId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<MetaAdsFilteredCampaignResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
      campanha_id: params.campaignId,
    };

    if (params.startDate) payload.inicio = params.startDate;
    if (params.endDate) payload.fim = params.endDate;

    const { obj } = await postEncrypted<MetaAdsFilteredCampaignResult>(
      "/campanhas/filtro",
      payload,
    );

    return obj;
  },

  async listLeadForms(params: {
    empresaId: number;
    adAccountId: string;
  }): Promise<MetaAdsForm[]> {
    const { obj } = await postEncrypted<MetaAdsForm[]>("/formularios", {
      empresa_id: params.empresaId,
      ad_account_id: params.adAccountId,
    });

    return Array.isArray(obj) ? obj : [];
  },

  async listFormLeads(params: {
    empresaId: number;
    adAccountId: string;
    formId: string;
    formName?: string;
    pageId?: string;
    limit?: number;
  }): Promise<MetaAdsRetrievedLead[]> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
      ad_account_id: params.adAccountId,
      form_id: params.formId,
    };

    if (params.formName) payload.form_name = params.formName;
    if (params.pageId) payload.page_id = params.pageId;
    if (params.limit) payload.limit = params.limit;

    const { obj } = await postEncrypted<MetaAdsRetrievedLead[]>(
      "/formularios/leads",
      payload,
    );

    return Array.isArray(obj) ? obj : [];
  },

  async importLeads(params: {
    empresaId: number;
    adAccountId: string;
    crmId?: number | null;
    formId?: string;
    formName?: string;
    leads: MetaAdsRetrievedLead[];
  }): Promise<MetaAdsLeadImportResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
      ad_account_id: params.adAccountId,
      leads: params.leads,
    };

    if (params.crmId) payload.crm_id = params.crmId;
    if (params.formId) payload.form_id = params.formId;
    if (params.formName) payload.form_name = params.formName;

    const { obj } = await postEncrypted<MetaAdsLeadImportResult>(
      "/importar_leads",
      payload,
    );

    return obj || {};
  },

  async getFieldMapping(params: {
    empresaId: number;
    scopeType: "form" | "campaign";
    scopeId: string;
  }): Promise<MetaAdsFieldMapping | null> {
    const { obj } = await postEncrypted<MetaAdsFieldMapping>("/mapeamento_campos", {
      empresa_id: params.empresaId,
      escopo_tipo: params.scopeType,
      escopo_id: params.scopeId,
    });

    if (!obj || !obj.escopo_id) return null;
    return obj;
  },

  async saveFieldMapping(params: {
    empresaId: number;
    scopeType: "form" | "campaign";
    scopeId: string;
    scopeName?: string;
    campoNome?: string | null;
    campoTelefone?: string | null;
    campoEmail?: string | null;
  }): Promise<MetaAdsFieldMapping | null> {
    const { obj } = await postEncrypted<MetaAdsFieldMapping>(
      "/salvar_mapeamento_campos",
      {
        empresa_id: params.empresaId,
        escopo_tipo: params.scopeType,
        escopo_id: params.scopeId,
        escopo_nome: params.scopeName,
        campo_nome: params.campoNome || null,
        campo_telefone: params.campoTelefone || null,
        campo_email: params.campoEmail || null,
      },
    );

    if (!obj || !obj.escopo_id) return null;
    return obj;
  },
};

export type {
  IntegrationStatusResult as MetaAdsIntegrationStatusResult,
  MetaAdsCampaign,
  MetaAdsCampaignsResult,
  MetaAdsFilteredCampaignResult,
  MetaAdsAd,
  MetaAdsAdInsight,
  MetaAdsAccount,
  MetaAdsCampaignInsight,
  MetaAdsStatusData,
  SaveMetaAdsIntegrationResult,
  ValidateMetaAdsAssetsResult,
  MetaAdsForm,
  MetaAdsRetrievedLead,
  MetaAdsLeadField,
  MetaAdsLeadImportResult,
  MetaAdsFieldMapping,
};
