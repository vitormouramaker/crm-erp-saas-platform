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

type RawMetaIgAccount = {
  id?: number;
  empresa_id?: number;
  business_id?: string | null;
  business_name?: string | null;
  page_id?: string | null;
  page_name?: string | null;
  instagram_business_account_id?: string | null;
  instagram_username?: string | null;
  instagram_name?: string | null;
  instagram_profile_picture_url?: string | null;
  graph_api_version?: string | null;
  token_expires_at?: string | null;
  last_embedded_signup_at?: string | null;
  meta_business_id?: string | null;
  meta_business_name?: string | null;
  meta_page_id?: string | null;
  meta_page_name?: string | null;
  meta_instagram_business_account_id?: string | null;
  meta_instagram_username?: string | null;
  meta_instagram_name?: string | null;
  meta_instagram_profile_picture_url?: string | null;
  meta_graph_api_version?: string | null;
  meta_access_token_expires_at?: string | null;
  meta_last_embedded_signup_at?: string | null;
};

type MetaIgAccount = {
  id?: number;
  empresa_id?: number;
  business_id?: string | null;
  business_name?: string | null;
  page_id?: string | null;
  page_name?: string | null;
  instagram_business_account_id?: string | null;
  instagram_username?: string | null;
  instagram_name?: string | null;
  instagram_profile_picture_url?: string | null;
  graph_api_version?: string | null;
  token_expires_at?: string | null;
  last_embedded_signup_at?: string | null;
};

type MetaIgStatusData = {
  conectado?: boolean;
  pronto_para_uso?: boolean;
  total_contas?: number;
  contas?: MetaIgAccount[];
};

type IntegrationStatusResult = {
  statusText: string;
  isActive: boolean;
  data: MetaIgStatusData;
};

type SaveMetaIgIntegrationResult = {
  status?: MetaIgStatusData;
  available_accounts?: Array<{
    page_id?: string;
    page_name?: string;
    business_id?: string | null;
    business_name?: string | null;
    instagram_business_account_id?: string;
    instagram_username?: string | null;
    instagram_name?: string | null;
  }>;
};

type ValidateMetaIgAssetsResult = {
  liberado?: boolean;
  total_contas?: number;
  token_type?: string | null;
  expires_in?: number | null;
  available_accounts?: Array<{
    page_id?: string;
    page_name?: string;
    business_id?: string | null;
    business_name?: string | null;
    instagram_business_account_id?: string;
    instagram_username?: string | null;
    instagram_name?: string | null;
    instagram_profile_picture_url?: string | null;
  }>;
  selected_accounts?: Array<{
    page_id?: string;
    page_name?: string;
    business_id?: string | null;
    business_name?: string | null;
    instagram_business_account_id?: string;
    instagram_username?: string | null;
    instagram_name?: string | null;
    instagram_profile_picture_url?: string | null;
  }>;
};

type MetaIgInsightMetric = {
  name?: string;
  period?: string;
  values?: Array<{
    value?: number | string | Record<string, unknown> | null;
    end_time?: string;
  }>;
  title?: string;
  description?: string;
  id?: string;
};

type MetaIgMediaItem = {
  id?: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  children?: {
    data?: Array<{
      id?: string;
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
    }>;
  };
};

type MetaIgCommentItem = {
  id?: string;
  text?: string;
  timestamp?: string;
  username?: string;
  display_username?: string;
  from?: {
    id?: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
  };
  like_count?: number;
  replies?: {
    data?: Array<{
      id?: string;
      text?: string;
      timestamp?: string;
      username?: string;
      display_username?: string;
      from?: {
        id?: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
      };
      like_count?: number;
    }>;
  };
};

type MetaIgMediaCommentsResult = {
  media_id?: string;
  total?: number;
  items?: MetaIgCommentItem[];
  paging?: Record<string, unknown> | null;
};

type MetaIgAccountSummaryResult = {
  account?: {
    id?: string;
    username?: string;
    name?: string;
    biography?: string;
    profile_picture_url?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
    website?: string;
  };
  insights?: MetaIgInsightMetric[];
};

async function postEncrypted<T>(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<{ obj: T; message?: string; raw: unknown; ok: boolean }> {
  const encrypted = await encrypt(payload);
  const response = await fetch(`${API_BASE}/meta_ig${endpoint}`, {
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

function normalizeStatusText(data: MetaIgStatusData, fallback?: string): string {
  if (typeof data?.total_contas === "number") {
    if (data.total_contas > 0) {
      return `${data.total_contas} conta(s) Instagram vinculada(s)`;
    }
    return "Nenhuma conta Instagram vinculada";
  }

  return fallback || "Status nao informado";
}

function normalizeMetaIgAccount(raw: RawMetaIgAccount): MetaIgAccount {
  return {
    id: raw.id,
    empresa_id: raw.empresa_id,
    business_id: raw.business_id ?? raw.meta_business_id ?? null,
    business_name: raw.business_name ?? raw.meta_business_name ?? null,
    page_id: raw.page_id ?? raw.meta_page_id ?? null,
    page_name: raw.page_name ?? raw.meta_page_name ?? null,
    instagram_business_account_id:
      raw.instagram_business_account_id ??
      raw.meta_instagram_business_account_id ??
      null,
    instagram_username:
      raw.instagram_username ?? raw.meta_instagram_username ?? null,
    instagram_name: raw.instagram_name ?? raw.meta_instagram_name ?? null,
    instagram_profile_picture_url:
      raw.instagram_profile_picture_url ??
      raw.meta_instagram_profile_picture_url ??
      null,
    graph_api_version: raw.graph_api_version ?? raw.meta_graph_api_version ?? null,
    token_expires_at:
      raw.token_expires_at ?? raw.meta_access_token_expires_at ?? null,
    last_embedded_signup_at:
      raw.last_embedded_signup_at ?? raw.meta_last_embedded_signup_at ?? null,
  };
}

export const MetaIgService = {
  async getIntegrationStatus(empresaId: number): Promise<IntegrationStatusResult> {
    const { obj, message } = await postEncrypted<MetaIgStatusData>(
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

  async listAccounts(empresaId: number): Promise<MetaIgAccount[]> {
    const { obj } = await postEncrypted<RawMetaIgAccount[]>("/listar_contas", {
      empresa_id: empresaId,
    });

    if (!Array.isArray(obj)) return [];
    return obj.map(normalizeMetaIgAccount);
  },

  async validateAssets(params: {
    empresaId: number;
    accessToken?: string;
    signupCode?: string;
    redirectUri?: string;
    selectedInstagramAccountIds?: string[];
  }): Promise<ValidateMetaIgAssetsResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
    };

    if (params.accessToken) payload.access_token = params.accessToken;
    if (params.signupCode) payload.signupCode = params.signupCode;
    if (params.redirectUri) payload.redirect_uri = params.redirectUri;
    if (params.selectedInstagramAccountIds?.length) {
      payload.selected_instagram_account_ids = params.selectedInstagramAccountIds;
    }

    const { obj } = await postEncrypted<ValidateMetaIgAssetsResult>(
      "/validar_ativos",
      payload,
    );
    return obj;
  },

  async saveIntegration(params: {
    empresaId: number;
    accessToken?: string;
    signupCode?: string;
    redirectUri?: string;
    selectedInstagramAccountIds?: string[];
  }): Promise<SaveMetaIgIntegrationResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
    };

    if (params.accessToken) payload.access_token = params.accessToken;
    if (params.signupCode) payload.signupCode = params.signupCode;
    if (params.redirectUri) payload.redirect_uri = params.redirectUri;
    if (params.selectedInstagramAccountIds?.length) {
      payload.selected_instagram_account_ids = params.selectedInstagramAccountIds;
    }

    const { obj } = await postEncrypted<SaveMetaIgIntegrationResult>(
      "/salvar_integracao",
      payload,
    );
    return obj;
  },

  async getAccountInsights(params: {
    empresaId: number;
    instagramBusinessAccountId: string;
    metrics?: string[];
    period?: "day" | "week" | "days_28" | "lifetime";
  }): Promise<MetaIgInsightMetric[]> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
      instagram_business_account_id: params.instagramBusinessAccountId,
    };

    if (params.metrics?.length) payload.metrics = params.metrics;
    if (params.period) payload.period = params.period;

    const { obj } = await postEncrypted<{ insights?: MetaIgInsightMetric[] }>(
      "/conta_insights",
      payload,
    );

    return Array.isArray(obj?.insights) ? obj.insights : [];
  },

  async listMedia(params: {
    empresaId: number;
    instagramBusinessAccountId: string;
    limit?: number;
  }): Promise<MetaIgMediaItem[]> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
      instagram_business_account_id: params.instagramBusinessAccountId,
    };

    if (params.limit) payload.limit = params.limit;

    const { obj } = await postEncrypted<{ items?: MetaIgMediaItem[] }>(
      "/midias",
      payload,
    );

    return Array.isArray(obj?.items) ? obj.items : [];
  },

  async getMediaComments(params: {
    empresaId: number;
    instagramBusinessAccountId: string;
    mediaId: string;
    limit?: number;
  }): Promise<MetaIgMediaCommentsResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
      instagram_business_account_id: params.instagramBusinessAccountId,
      media_id: params.mediaId,
    };

    if (params.limit) payload.limit = params.limit;

    const { obj } = await postEncrypted<MetaIgMediaCommentsResult>(
      "/midia_comentarios",
      payload,
    );

    return obj || {};
  },

  async getAccountSummary(params: {
    empresaId: number;
    instagramBusinessAccountId: string;
  }): Promise<MetaIgAccountSummaryResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
      instagram_business_account_id: params.instagramBusinessAccountId,
    };

    const { obj } = await postEncrypted<MetaIgAccountSummaryResult>(
      "/conta_resumo",
      payload,
    );

    return obj || {};
  },
};

export type {
  MetaIgAccountSummaryResult,
  IntegrationStatusResult as MetaIgIntegrationStatusResult,
  MetaIgAccount,
  MetaIgCommentItem,
  MetaIgInsightMetric,
  MetaIgMediaCommentsResult,
  MetaIgMediaItem,
  MetaIgStatusData,
  SaveMetaIgIntegrationResult,
  ValidateMetaIgAssetsResult,
};
