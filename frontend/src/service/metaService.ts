import { API_BASE } from "../config/api";
import { decrypt, encrypt } from "../utils/cripto";
import type { QuickMessageGalleryImage } from "../types/quickMessages";

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

export type IntegrationStatusData = {
  id?: number;
  status?: string;
  situacao?: string;
  status_integracao?: string;
  integration_status?: string;
  integrado?: boolean;
  conectado?: boolean;
  pronto_para_uso?: boolean;
  campos_faltantes?: string[];
  empresa_id?: number;
  business_id?: string | null;
  business_name?: string | null;
  business_manager_id?: string | null;
  business_manager_name?: string | null;
  whatsapp_account_id?: string | null;
  whatsapp_account_name?: string | null;
  phone_number_id?: string | null;
  display_phone_number?: string | null;
  verified_name?: string | null;
  wa_id?: string | null;
  webhook_verify_token?: string | null;
  webhook_url?: string | null;
  graph_api_version?: string | null;
  token_expires_at?: string | null;
  last_embedded_signup_at?: string | null;
  ativo?: boolean;
  accounts?: MetaIntegrationAccount[];
};

export type MetaIntegrationAccount = {
  id?: number | null;
  empresa_id?: number | null;
  business_id?: string | null;
  business_name?: string | null;
  business_manager_id?: string | null;
  business_manager_name?: string | null;
  whatsapp_account_id?: string | null;
  whatsapp_account_name?: string | null;
  phone_number_id?: string | null;
  display_phone_number?: string | null;
  verified_name?: string | null;
  wa_id?: string | null;
  webhook_verify_token?: string | null;
  webhook_url?: string | null;
  graph_api_version?: string | null;
  token_expires_at?: string | null;
  last_embedded_signup_at?: string | null;
  color?: string | null;
  ativo?: boolean;
};

export type MetaCompanyUser = {
  id?: number | string | null;
  name?: string | null;
  email?: string | null;
};

export type IntegrationStatusResult = {
  statusText: string;
  isActive: boolean;
  data: IntegrationStatusData;
};

export type WhatsAppProfileData = {
  about?: string | null;
  address?: string | null;
  description?: string | null;
  email?: string | null;
  vertical?: string | null;
  profile_picture_url?: string | null;
  websites?: string[];
  display_name?: string | null;
  verified_name?: string | null;
  display_phone_number?: string | null;
  phone_number_id?: string | null;
  whatsapp_account_id?: string | null;
  meta_param_id?: number | null;
  meta_response?: Record<string, unknown>;
};

export type TemplateComponent = {
  type: "BODY" | "HEADER" | "FOOTER" | "BUTTONS";
  text?: string;
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  buttons?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type TemplateStoredHeaderMedia = {
  id?: number | null;
  media_type?: string | null;
  url?: string | null;
  path_bunny?: string | null;
  nome_arquivo?: string | null;
  mime_type?: string | null;
  tamanho_bytes?: number | null;
  origem?: string | null;
  template_name?: string | null;
  language_code?: string | null;
  meta_param_id?: number | null;
};

export type MetaTemplateItem = {
  id?: string;
  name?: string;
  status?: string;
  language?: string;
  category?: string;
  components?: TemplateComponent[];
  saved_header_media?: TemplateStoredHeaderMedia | null;
  [key: string]: unknown;
};

export type MetaTemplateQuickSuggestion = {
  template_name?: string;
  template_language?: string;
  usage_count?: number;
  last_used_at?: string | null;
  source?: "recent" | "popular" | string;
};

export type CreateMetaTemplateInput = {
  name: string;
  category: string;
  language: string;
  components: TemplateComponent[];
  allow_category_change?: boolean;
  parameter_format?: string;
  media_sample_type?: "NONE" | "IMAGE" | "VIDEO" | "DOCUMENT";
  media_sample_file?: File | null;
};

export type WhatsAutoMessage = {
  tipo_id: number;
  descricao: string;
  id: number | null;
  texto: string | null;
  mensagem_complementar_texto?: string | null;
  galeria_imagem_id?: number | null;
  galeria_imagem_url?: string | null;
  galeria_imagem_nome_arquivo?: string | null;
  galeria_imagem_origem?: string | null;
  galeria_imagem_mime_type?: string | null;
  empresa_meta_param_id?: number | null;
  ativo: boolean;
  habilitada?: boolean;
};

export type TemplateAutomationType =
  | "birthday"
  | "sale_completed"
  | "sale_refused";

export type BirthdayTemplateConfig = {
  automation_type?: TemplateAutomationType | null;
  empresa_meta_param_id?: number | null;
  empresa_id?: number | null;
  display_phone_number?: string | null;
  verified_name?: string | null;
  phone_number_id?: string | null;
  whatsapp_account_id?: string | null;
  habilitada?: boolean;
  is_default_dispatch_number?: boolean;
  default_dispatch_meta_param_id?: number | null;
  default_dispatch_display_phone_number?: string | null;
  template_name?: string | null;
  template_language?: string | null;
  horario?: string | null;
  delay_days?: number | null;
  header_media_type?: string | null;
  header_media_url?: string | null;
  header_parameters?: unknown[];
  body_parameters?: unknown[];
  button_parameters?: MetaDispatchButtonParameter[];
};

export type TemplateAutomationConfig = BirthdayTemplateConfig;

export type TemplateMetricCost = {
  type?: string;
  value?: number | string;
  amount?: number | string;
  currency?: string;
  [key: string]: unknown;
};

export type TemplateMetricDataPoint = {
  template_id?: string;
  start?: number;
  end?: number;
  sent?: number;
  delivered?: number;
  read?: number;
  replied?: number;
  cost?: TemplateMetricCost[];
  [key: string]: unknown;
};

export type TemplateMetricEntry = {
  granularity?: string;
  product_type?: string;
  data_points?: TemplateMetricDataPoint[];
  [key: string]: unknown;
};

export type TemplateMetricsFilters = {
  template_id: string;
  start: number;
  end: number;
  granularity: string;
};

export type TemplateMetricsResult = {
  filters: TemplateMetricsFilters;
  metrics: TemplateMetricEntry[];
  raw?: Record<string, unknown>;
};

export type SaveMetaIntegrationInput = {
  empresaId: number;
  accessToken?: string;
  signupCode?: string;
  redirectUri?: string;
  webhookUrl?: string;
  whatsappAccountId?: string;
  wabaId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  businessId?: string;
  businessName?: string;
  businessManagerId?: string;
  businessManagerName?: string;
  whatsappAccountName?: string;
  embeddedSignupEvent?: string;
  isWaLoginUser?: boolean;
};

export type MetaDispatchButtonParameter = {
  index: number;
  parameters?: unknown[];
};

export type TemplateDispatchPayloadInput = {
  templateName: string;
  language?: string;
  headerMediaType?: string | null;
  headerMediaUrl?: string | null;
  headerParameters?: unknown[];
  bodyParameters?: unknown[];
  buttonParameters?: MetaDispatchButtonParameter[];
  headerFile?: File | null;
};

export type TemplateValidationSummary = {
  name?: string;
  language?: string;
  status?: string | null;
  category?: string | null;
  header_type?: string | null;
  header_parameter_count?: number;
  body_parameter_count?: number;
  footer_text?: string | null;
  buttons?: Array<{
    index?: number;
    type?: string;
    sub_type?: string;
    parameter_count?: number;
    text?: string | null;
    url?: string | null;
    phone_number?: string | null;
  }>;
};

export type TemplateValidationPreview = {
  expected?: {
    header_type?: string | null;
    header_parameter_count?: number;
    accepts_header_media?: boolean;
    body_parameter_count?: number;
    buttons?: Array<{
      index?: number;
      type?: string;
      sub_type?: string;
      parameter_count?: number;
    }>;
  };
  received?: {
    header_parameter_count?: number;
    has_header_image?: boolean;
    has_header_document?: boolean;
    has_header_video?: boolean;
    body_parameter_count?: number;
    buttons?: Array<{
      index?: number;
      parameter_count?: number;
    }>;
  };
};

export type PreviewTemplateDispatchResult = {
  valid?: boolean;
  template_name?: string;
  language_code?: string;
  uploaded_media_type?: string | null;
  saved_header_media?: TemplateStoredHeaderMedia | null;
  errors?: string[];
  template?: TemplateValidationSummary | null;
  preview?: TemplateValidationPreview | null;
};

export type DispatchTemplateInput = TemplateDispatchPayloadInput & {
  empresaId: number;
  usuarioId?: number | string | null;
  numero?: string;
  conversaId?: number | string;
  metaParamId?: number | string;
  clienteId?: number | string;
  contactName?: string;
  email?: string;
  birthday?: string | null;
};

export type DispatchTemplateResult = {
  numero?: string;
  conversa_id?: number | string | null;
  template_name?: string;
  language?: string;
  message_id?: string | null;
  message_status?: string | null;
  uploaded_media_url?: string | null;
  uploaded_media_type?: string | null;
  saved_header_media?: TemplateStoredHeaderMedia | null;
  preview?: TemplateValidationPreview | null;
  meta_response?: Record<string, unknown>;
  chat_opened_automatically?: boolean;
  assigned_to_user?: boolean;
  wait_for_customer_reply?: boolean;
  guidance_message?: string | null;
};

export type BatchDispatchItem = {
  numero?: string;
  telefone?: string;
  to?: string;
  conversa_id?: number | string;
  cliente_id?: number | string;
  contato_nome?: string;
  contact_name?: string;
  email?: string;
  data_aniversario?: string | null;
  header_parameters?: unknown[];
  body_parameters?: unknown[];
  button_parameters?: MetaDispatchButtonParameter[];
};

export type BatchDispatchResultItem = {
  index?: number;
  cliente_id?: number | string | null;
  contato_nome?: string | null;
  email?: string | null;
  numero_original?: string | null;
  numero?: string | null;
  conversa_id?: number | string | null;
  success?: boolean;
  message_id?: string | null;
  message_status?: string | null;
  enviado_em?: string | null;
  recebido_em?: string | null;
  erro_em?: string | null;
  custo_unitario?: number;
  valor_cobrado?: number;
  error?: unknown;
  error_message?: string | null;
  error_code?: number | string | null;
  error_subcode?: number | string | null;
  error_type?: string | null;
  errors?: string[];
  preview?: TemplateValidationPreview | null;
  meta_response?: Record<string, unknown>;
};

export type BatchDispatchTemplateInput = TemplateDispatchPayloadInput & {
  empresaId: number;
  usuarioId?: number | string | null;
  items?: BatchDispatchItem[];
  stopOnError?: boolean;
  leadStartedMessagesGenerateAutoMessage?: boolean;
  listaTransmissaoId?: number;
  clientBatchToken?: string;
  metaParamId?: number | string;
  conversaId?: number | string;
};

export type BatchDispatchTemplateResult = {
  dispatch_history_id?: number | string | null;
  template_id?: string | null;
  template_name?: string;
  language?: string;
  template_category?: string | null;
  lista_transmissao_id?: number | string | null;
  total_items?: number;
  processed_items?: number;
  success_count?: number;
  error_count?: number;
  stopped_on_error?: boolean;
  remaining_items?: number;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number;
  uploaded_media_type?: string | null;
  saved_header_media?: TemplateStoredHeaderMedia | null;
  cost_summary?: DispatchCostMetricsResult | null;
  progress_percent?: number;
  batch_status?: string | null;
  lead_started_messages_generate_auto_message?: boolean;
  results?: BatchDispatchResultItem[];
};

export type BatchDispatchProgressResult = {
  found?: boolean;
  dispatch_history_id?: number | string | null;
  template_id?: string | null;
  template_name?: string | null;
  template_category?: string | null;
  lista_transmissao_id?: number | string | null;
  total_items?: number;
  processed_items?: number;
  success_count?: number;
  error_count?: number;
  remaining_items?: number;
  progress_percent?: number;
  stopped_on_error?: boolean;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number;
  status?: string | null;
  metadata?: Record<string, unknown>;
  cost_summary?: DispatchCostMetricsResult | null;
};

export type DispatchCostRow = {
  start?: number | null;
  end?: number | null;
  cost?: number;
  volume?: number;
  currency?: string | null;
  cost_per_message?: number;
  country?: string | null;
  phone_number?: string | null;
  pricing_category?: string | null;
  pricing_type?: string | null;
};

export type DispatchCostMetricsResult = {
  pricing_source?: string;
  currency?: string | null;
  category?: string | null;
  filters?: {
    start?: number;
    end?: number;
    granularity?: string;
  };
  summary?: {
    total_cost?: number;
    total_volume?: number;
    cost_per_message?: number;
    unit_cost?: number;
  };
  rows?: DispatchCostRow[];
  cost_available?: boolean | null;
  phone_number_filter?: string | null;
  message?: string;
  raw?: Record<string, unknown>;
};

export type TemplateDispatchHistoryReportRow = {
  dispatch_history_id?: number | string | null;
  empresa_meta_param_id?: number | string | null;
  meta_numero_conta?: string;
  meta_nome_conta?: string;
  usuario_id?: number | string | null;
  usuario_nome?: string;
  template_id?: string | null;
  template_name?: string;
  template_language?: string;
  template_category?: string;
  lista_transmissao_id?: number | string | null;
  lista_nome?: string | null;
  lista_descricao?: string | null;
  lista_total_contatos?: number;
  total_clientes?: number;
  processados?: number;
  enviados?: number;
  recebidos?: number;
  recebidos_unicos?: number;
  visualizados?: number;
  respondidos?: number;
  respondidos_unicos?: number;
  erros?: number;
  custo_unitario?: number;
  valor_total?: number;
  moeda?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  duracao_ms?: number;
  dispatch_type?: "list" | "single" | string;
  status?: string | null;
  metadata?: Record<string, unknown>;
};

export type TemplateDispatchHistoryReportItem = {
  item_id?: number | string | null;
  dispatch_history_id?: number | string | null;
  empresa_meta_param_id?: number | string | null;
  cliente_id?: number | string | null;
  conversa_id?: number | string | null;
  contato_nome?: string | null;
  email?: string | null;
  numero_original?: string | null;
  numero_normalizado?: string | null;
  message_id?: string | null;
  message_status?: string | null;
  sucesso?: boolean;
  custo_unitario?: number;
  valor_cobrado?: number;
  enviado_em?: string | null;
  recebido_em?: string | null;
  erro_em?: string | null;
  erro_mensagem?: string | null;
  erro_codigo?: number | string | null;
  erro_subcodigo?: number | string | null;
  erro_tipo?: string | null;
  respondido_em?: string | null;
  recebido?: boolean;
  visualizado?: boolean;
  respondeu?: boolean;
  metadata?: Record<string, unknown>;
};

export type TemplateDispatchHistoryReportResult = {
  filters?: {
    start?: number;
    end?: number;
    dispatch_type?: string;
    empresa_meta_param_id?: number | string | null;
    usuario_filtro_id?: number | string | null;
    status?: string;
  };
  summary?: {
    total_disparos?: number;
    total_clientes?: number;
    total_enviados?: number;
    total_recebidos?: number;
    total_recebidos_unicos?: number;
    total_visualizados?: number;
    total_respondidos?: number;
    total_respondidos_unicos?: number;
    total_erros?: number;
    total_custo?: number;
  };
  pagination?: {
    limit?: number;
    offset?: number;
    total?: number;
    has_more?: boolean;
  };
  items?: TemplateDispatchHistoryReportRow[];
};

export type TemplateDispatchHistoryReportDetailResult = {
  dispatch?: TemplateDispatchHistoryReportRow | null;
  items?: TemplateDispatchHistoryReportItem[];
};

export type GetTemplateMetricsInput = {
  templateId: string;
  startDate?: string;
  endDate?: string;
  granularity?: "DAILY" | "HOURLY" | "MONTHLY";
  metricTypes?: string[];
  countryCodes?: string[];
  phoneNumbers?: string[];
  metaParamId?: number | string;
  conversaId?: number | string;
};

type MetaScopeInput = {
  metaParamId?: number | string;
  conversaId?: number | string;
};

export type UpdateWhatsAppProfileInput = MetaScopeInput & {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  vertical?: string;
  websites?: string[] | string;
  profilePictureFile?: File | null;
};

type Scope = "meta" | "user";

function dateInputToUnixSeconds(value: string, boundary: "start" | "end") {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(
    year,
    month - 1,
    day,
    boundary === "start" ? 0 : 23,
    boundary === "start" ? 0 : 59,
    boundary === "start" ? 0 : 59,
    boundary === "start" ? 0 : 999,
  );

  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

async function postEncrypted<T>(
  scope: Scope,
  endpoint: string,
  payload: Record<string, unknown>
): Promise<{ obj: T; message?: string; raw: unknown; ok: boolean }> {
  const encrypted = await encrypt(payload);
  const response = await fetch(`${API_BASE}/${scope}${endpoint}`, {
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
    throw new Error(buildApiEnvelopeErrorMessage(data, message));
  }

  return {
    obj: (data?.obj as T) ?? ({} as T),
    message,
    raw: data,
    ok,
  };
}

function buildApiEnvelopeErrorMessage(
  data: (ApiEnvelope<unknown> & Record<string, unknown>) | null | undefined,
  fallbackMessage?: string,
) {
  const baseMessage = String(
    data?.mensagem ||
      data?.message ||
      data?.msg ||
      fallbackMessage ||
      "Nao foi possivel concluir a operacao."
  ).trim();

  const detailsSource =
    data?.obj && typeof data.obj === "object" && !Array.isArray(data.obj)
      ? (data.obj as Record<string, unknown>)
      : null;
  const errors = Array.isArray(detailsSource?.errors)
    ? detailsSource.errors
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];
  const details = String(detailsSource?.details || "").trim();

  const normalizedBaseMessage = baseMessage.toLowerCase();
  const suffixParts = [...errors].filter(
    (item, index, source) =>
      item.toLowerCase() !== normalizedBaseMessage &&
      source.findIndex(
        (candidate) => candidate.toLowerCase() === item.toLowerCase(),
      ) === index,
  );
  if (details) {
    const normalizedDetails = details.toLowerCase();
    if (
      normalizedDetails !== normalizedBaseMessage &&
      !suffixParts.some((item) => item.toLowerCase() === normalizedDetails)
    ) {
      suffixParts.push(details);
    }
  }

  if (!suffixParts.length) {
    return baseMessage;
  }

  return `${baseMessage} ${suffixParts.join(" | ")}`;
}

async function postEncryptedMultipart<T>(
  scope: Scope,
  endpoint: string,
  payload: Record<string, unknown>,
  files: Record<string, File | null | undefined>,
): Promise<{ obj: T; message?: string; raw: unknown; ok: boolean }> {
  const encrypted = await encrypt(payload);
  const formData = new FormData();
  formData.append("payload", encrypted);

  Object.entries(files).forEach(([fieldName, file]) => {
    if (file) {
      formData.append(fieldName, file);
    }
  });

  const response = await fetch(`${API_BASE}/${scope}${endpoint}`, {
    method: "POST",
    body: formData,
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
    throw new Error(buildApiEnvelopeErrorMessage(data, message));
  }

  return {
    obj: (data?.obj as T) ?? ({} as T),
    message,
    raw: data,
    ok,
  };
}

function normalizeStatusText(obj: IntegrationStatusData, fallback?: string): string {
  const status =
    obj?.status ??
    obj?.situacao ??
    obj?.status_integracao ??
    obj?.integration_status;

  if (status) return String(status);
  if (typeof obj?.pronto_para_uso === "boolean") {
    return obj.pronto_para_uso ? "Integração ativa" : "Não integrado";
  }
  if (typeof obj?.conectado === "boolean") {
    return obj.conectado ? "Conectado" : "Não integrado";
  }
  if (typeof obj?.integrado === "boolean") return obj.integrado ? "Integrado" : "Não integrado";
  return fallback || "Status não informado";
}

function isStatusActive(statusText: string, integratedFlag?: boolean): boolean {
  if (typeof integratedFlag === "boolean") {
    return integratedFlag;
  }

  const normalized = statusText.toLowerCase();
  return (
    normalized.includes("integrado") ||
    normalized.includes("ativa") ||
    normalized.includes("ativo") ||
    normalized.includes("conectado")
  );
}

function resolveActiveFromData(obj: IntegrationStatusData, statusText: string): boolean {
  if (typeof obj?.pronto_para_uso === "boolean") {
    return obj.pronto_para_uso;
  }

  if (typeof obj?.conectado === "boolean") {
    return obj.conectado;
  }

  if (typeof obj?.integrado === "boolean") {
    return obj.integrado;
  }

  return isStatusActive(statusText, undefined);
}

function normalizeTemplates(obj: unknown): MetaTemplateItem[] {
  if (Array.isArray(obj)) return obj as MetaTemplateItem[];
  if (!obj || typeof obj !== "object") return [];

  const maybeData = (obj as Record<string, unknown>).data;
  if (Array.isArray(maybeData)) return maybeData as MetaTemplateItem[];

  const maybeTemplates = (obj as Record<string, unknown>).templates;
  if (Array.isArray(maybeTemplates)) return maybeTemplates as MetaTemplateItem[];

  return [];
}

function buildDispatchPayload(
  params: TemplateDispatchPayloadInput,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    template_name: params.templateName,
  };
  const normalizedHeaderMediaType = String(params.headerMediaType || "")
    .trim()
    .toLowerCase();
  const normalizedHeaderMediaUrl = String(params.headerMediaUrl || "").trim();

  if (params.language) payload.language = params.language;
  if (normalizedHeaderMediaUrl) {
    if (normalizedHeaderMediaType === "image") {
      payload.header_image = { link: normalizedHeaderMediaUrl };
    } else if (normalizedHeaderMediaType === "document") {
      payload.header_document = { link: normalizedHeaderMediaUrl };
    } else if (normalizedHeaderMediaType === "video") {
      payload.header_video = { link: normalizedHeaderMediaUrl };
    }
  }
  if (params.headerParameters?.length) {
    payload.header_parameters = params.headerParameters;
  }
  if (params.bodyParameters?.length) {
    payload.body_parameters = params.bodyParameters;
  }
  if (params.buttonParameters?.length) {
    payload.button_parameters = params.buttonParameters;
  }

  return payload;
}

function appendMetaScope(
  payload: Record<string, unknown>,
  scope?: MetaScopeInput,
) {
  if (!scope) return payload;

  if (
    scope.metaParamId !== undefined &&
    scope.metaParamId !== null &&
    scope.metaParamId !== ""
  ) {
    payload.meta_param_id = scope.metaParamId;
  }

  if (
    scope.conversaId !== undefined &&
    scope.conversaId !== null &&
    scope.conversaId !== ""
  ) {
    payload.conversa_id = scope.conversaId;
  }

  return payload;
}

function normalizeAutoMessages(obj: unknown, raw: unknown): WhatsAutoMessage[] {
  if (Array.isArray(obj)) return obj as WhatsAutoMessage[];
  if (obj && typeof obj === "object") {
    const objRecord = obj as Record<string, unknown>;
    const candidates = [objRecord.data, objRecord.rows, objRecord.mensagens];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as WhatsAutoMessage[];
    }
  }

  if (raw && typeof raw === "object") {
    const rawRecord = raw as Record<string, unknown>;
    const rawObj = rawRecord.obj as Record<string, unknown> | undefined;

    if (Array.isArray(rawObj)) return rawObj as WhatsAutoMessage[];
    if (rawObj && typeof rawObj === "object") {
      const candidates = [rawObj.data, rawObj.rows, rawObj.mensagens];
      for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate as WhatsAutoMessage[];
      }
    }
  }

  return [];
}

export const MetaService = {
  async getIntegrationStatus(empresaId: number): Promise<IntegrationStatusResult> {
    const { obj, message, ok } = await postEncrypted<IntegrationStatusData>(
      "meta",
      "/status_integracao",
      { empresa_id: empresaId }
    );

    const statusText =
      normalizeStatusText(obj, message) ||
      (ok ? "Integracao ativa" : "Nao integrado");
    const isActive = resolveActiveFromData(obj, statusText);

    return {
      statusText,
      isActive,
      data: obj,
    };
  },

  async getIntegrationNumbers(
    empresaId: number,
    usuarioId?: number | null,
  ): Promise<MetaIntegrationAccount[]> {
    const { obj } = await postEncrypted<MetaIntegrationAccount[]>(
      "meta",
      "/lista_numeros_vinculados",
      {
        empresa_id: empresaId,
        usuario_id: usuarioId || undefined,
      }
    );

    return Array.isArray(obj) ? obj : [];
  },

  async listCompanyUsers(empresaId: number): Promise<MetaCompanyUser[]> {
    const { obj } = await postEncrypted<MetaCompanyUser[]>(
      "user",
      "/lista_usuarios",
      {
        empresa_id: empresaId,
      },
    );

    return Array.isArray(obj) ? obj : [];
  },

  async getTemplates(
    empresaId: number,
    scope?: MetaScopeInput,
  ): Promise<MetaTemplateItem[]> {
    const { obj } = await postEncrypted<unknown>(
      "meta",
      "/get_teemplate",
      appendMetaScope(
        {
          empresa_id: empresaId,
        },
        scope,
      ),
    );
    return normalizeTemplates(obj);
  },

  async getTemplateQuickSuggestions(
    empresaId: number,
    params: {
      metaParamId: number;
      usuarioId?: number | null;
      limit?: number;
    }
  ): Promise<MetaTemplateQuickSuggestion[]> {
    const { obj } = await postEncrypted<{
      items?: MetaTemplateQuickSuggestion[];
    }>(
      "meta",
      "/templates_sugeridos_numero",
      {
        empresa_id: empresaId,
        meta_param_id: params.metaParamId,
        usuario_id: params.usuarioId || undefined,
        limit: params.limit || 5,
      }
    );

    return Array.isArray(obj?.items) ? obj.items : [];
  },

  async getWhatsAppProfile(
    empresaId: number,
    scope?: MetaScopeInput,
  ): Promise<WhatsAppProfileData> {
    const { obj } = await postEncrypted<WhatsAppProfileData>(
      "meta",
      "/perfil_whatsapp",
      appendMetaScope(
        {
          empresa_id: empresaId,
        },
        scope,
      ),
    );

    return obj || {};
  },

  async saveIntegration(
    params: SaveMetaIntegrationInput,
  ): Promise<IntegrationStatusData> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
    };

    if (params.accessToken) payload.access_token = params.accessToken;
    if (params.signupCode) payload.signupCode = params.signupCode;
    if (params.redirectUri) payload.redirect_uri = params.redirectUri;
    if (params.webhookUrl) payload.webhook_url = params.webhookUrl;
    if (params.whatsappAccountId) {
      payload.whatsapp_account_id = params.whatsappAccountId;
    }
    if (params.wabaId) payload.wabaId = params.wabaId;
    if (params.phoneNumberId) payload.phone_number_id = params.phoneNumberId;
    if (params.displayPhoneNumber) {
      payload.display_phone_number = params.displayPhoneNumber;
    }
    if (params.verifiedName) payload.verified_name = params.verifiedName;
    if (params.businessId) payload.businessId = params.businessId;
    if (params.businessName) payload.business_name = params.businessName;
    if (params.businessManagerId) {
      payload.business_manager_id = params.businessManagerId;
    }
    if (params.businessManagerName) {
      payload.business_manager_name = params.businessManagerName;
    }
    if (params.whatsappAccountName) {
      payload.whatsapp_account_name = params.whatsappAccountName;
    }
    if (params.embeddedSignupEvent) {
      payload.embedded_signup_event = params.embeddedSignupEvent;
    }
    if (typeof params.isWaLoginUser === "boolean") {
      payload.is_wa_login_user = params.isWaLoginUser;
    }

    const { obj } = await postEncrypted<IntegrationStatusData>(
      "meta",
      "/salvar_integracao",
      payload,
    );

    return obj;
  },

  async unlinkIntegrationNumber(
    empresaId: number,
    metaParamId: number,
  ): Promise<IntegrationStatusData> {
    const { obj } = await postEncrypted<IntegrationStatusData>(
      "meta",
      "/desvincular_numero",
      {
        empresa_id: empresaId,
        meta_param_id: metaParamId,
      }
    );

    return obj;
  },

  async updateIntegrationNumberColor(
    empresaId: number,
    metaParamId: number,
    color: string,
  ): Promise<IntegrationStatusData> {
    const { obj } = await postEncrypted<IntegrationStatusData>(
      "meta",
      "/atualizar_numero_vinculado",
      {
        empresa_id: empresaId,
        meta_param_id: metaParamId,
        cor: color,
      }
    );

    return obj;
  },
  async createTemplate(
    empresaId: number,
    payload: CreateMetaTemplateInput & MetaScopeInput
  ): Promise<Record<string, unknown>> {
    const { media_sample_file, ...payloadWithoutFile } = payload;
    const { obj } = await postEncryptedMultipart<Record<string, unknown>>(
      "meta",
      "/criar_template",
      appendMetaScope(
        {
          empresa_id: empresaId,
          ...payloadWithoutFile,
        },
        payloadWithoutFile,
      ),
      { media_sample_file },
    );
    return obj;
  },

  async updateTemplate(
    empresaId: number,
    templateId: string,
    payload: CreateMetaTemplateInput & MetaScopeInput
  ): Promise<Record<string, unknown>> {
    const { media_sample_file, ...payloadWithoutFile } = payload;
    const { obj } = await postEncryptedMultipart<Record<string, unknown>>(
      "meta",
      "/editar_template",
      appendMetaScope(
        {
          empresa_id: empresaId,
          template_id: templateId,
          ...payloadWithoutFile,
        },
        payload,
      ),
      { media_sample_file },
    );

    return obj;
  },

  async deleteTemplate(
    empresaId: number,
    templateName: string,
    templateId?: string,
    scope?: MetaScopeInput,
  ): Promise<Record<string, unknown>> {
    const { obj } = await postEncrypted<Record<string, unknown>>(
      "meta",
      "/deletar_template",
      appendMetaScope(
        {
          empresa_id: empresaId,
          template_name: templateName,
          template_id: templateId,
        },
        scope,
      )
    );
    return obj;
  },

  async archiveTemplate(
    empresaId: number,
    template: Pick<MetaTemplateItem, "id" | "name" | "language">,
    scope?: MetaScopeInput,
  ): Promise<Record<string, unknown>> {
    const { obj } = await postEncrypted<Record<string, unknown>>(
      "meta",
      "/arquivar_template",
      appendMetaScope(
        {
          empresa_id: empresaId,
          template_id: template.id,
          template_name: template.name,
          language: template.language,
        },
        scope,
      ),
    );
    return obj;
  },

  async updateWhatsAppProfile(
    empresaId: number,
    params: UpdateWhatsAppProfileInput,
  ): Promise<WhatsAppProfileData> {
    const { profilePictureFile, ...payloadWithoutFile } = params;
    const { obj } = await postEncryptedMultipart<WhatsAppProfileData>(
      "meta",
      "/atualizar_perfil_whatsapp",
      appendMetaScope(
        {
          empresa_id: empresaId,
          ...payloadWithoutFile,
        },
        payloadWithoutFile,
      ),
      {
        profile_picture_file: profilePictureFile,
      },
    );

    return obj || {};
  },

  async getTemplateMetrics(
    empresaId: number,
    params: GetTemplateMetricsInput
  ): Promise<TemplateMetricsResult> {
    const requestPayload: Record<string, unknown> = {
      empresa_id: empresaId,
      template_id: params.templateId,
    };

    if (params.startDate) requestPayload.start_date = params.startDate;
    if (params.endDate) requestPayload.end_date = params.endDate;
    if (params.granularity) requestPayload.granularity = params.granularity;
    if (params.metricTypes?.length) requestPayload.metric_types = params.metricTypes;
    if (params.countryCodes?.length) requestPayload.country_codes = params.countryCodes;
    if (params.phoneNumbers?.length) requestPayload.phone_numbers = params.phoneNumbers;
    appendMetaScope(requestPayload, params);

    const { obj, raw } = await postEncrypted<TemplateMetricsResult>(
      "meta",
      "/metricas_template",
      requestPayload
    );

    console.log("[MetaService] getTemplateMetrics:response", {
      empresaId,
      requestPayload,
      raw,
      obj,
    });

    return {
      filters: obj?.filters || {
        template_id: params.templateId,
        start: 0,
        end: 0,
        granularity: "DAILY",
      },
      metrics: Array.isArray(obj?.metrics) ? obj.metrics : [],
      raw: obj?.raw,
    };
  },

  async previewTemplateDispatch(
    empresaId: number,
    params: TemplateDispatchPayloadInput & MetaScopeInput,
  ): Promise<PreviewTemplateDispatchResult> {
    const payload = appendMetaScope(
      {
        empresa_id: empresaId,
        ...buildDispatchPayload(params),
      },
      params,
    );

    const { obj } = await postEncryptedMultipart<PreviewTemplateDispatchResult>(
      "meta",
      "/preview_validacao_template",
      payload,
      { header_file: params.headerFile },
    );

    return obj;
  },

  async dispatchTemplate(
    params: DispatchTemplateInput,
  ): Promise<DispatchTemplateResult> {
    const payload = appendMetaScope(
      {
        empresa_id: params.empresaId,
        ...buildDispatchPayload(params),
      },
      params,
    );

    if (params.numero) payload.numero = params.numero;
    if (params.usuarioId !== undefined && params.usuarioId !== null) {
      payload.usuario_id = params.usuarioId;
    }
    if (params.conversaId !== undefined && params.conversaId !== null) {
      payload.conversa_id = params.conversaId;
    }
    if (params.clienteId !== undefined && params.clienteId !== null) {
      payload.cliente_id = params.clienteId;
    }
    if (params.contactName) {
      payload.contact_name = params.contactName;
    }
    if (params.email) {
      payload.email = params.email;
    }
    if (params.birthday) {
      payload.data_aniversario = params.birthday;
    }

    const { obj } = await postEncryptedMultipart<DispatchTemplateResult>(
      "meta",
      "/disparar_template",
      payload,
      { header_file: params.headerFile },
    );

    return obj;
  },

  async dispatchTemplateBatch(
    params: BatchDispatchTemplateInput,
  ): Promise<BatchDispatchTemplateResult> {
    const payload = appendMetaScope(
      {
        empresa_id: params.empresaId,
        ...buildDispatchPayload(params),
      },
      params,
    );

    if (Array.isArray(params.items) && params.items.length > 0) {
      payload.items = params.items;
    }
    if (params.usuarioId !== undefined && params.usuarioId !== null) {
      payload.usuario_id = params.usuarioId;
    }
    if (params.stopOnError) payload.stop_on_error = params.stopOnError;
    if (params.leadStartedMessagesGenerateAutoMessage !== undefined) {
      payload.lead_started_messages_generate_auto_message =
        params.leadStartedMessagesGenerateAutoMessage;
    }
    if (params.listaTransmissaoId) payload.lista_id = params.listaTransmissaoId;
    if (params.listaTransmissaoId && (!Array.isArray(params.items) || !params.items.length)) {
      payload.usar_lista_id_como_fonte = true;
    }
    if (params.clientBatchToken) payload.client_batch_token = params.clientBatchToken;

    const { obj } = await postEncryptedMultipart<BatchDispatchTemplateResult>(
      "meta",
      "/disparar_template_lote",
      payload,
      { header_file: params.headerFile },
    );

    return obj;
  },

  async getTemplateBatchProgress(params: {
    empresaId: number;
    clientBatchToken: string;
  }): Promise<BatchDispatchProgressResult> {
    const { obj } = await postEncrypted<BatchDispatchProgressResult>(
      "meta",
      "/status_disparo_template_lote",
      {
        empresa_id: params.empresaId,
        client_batch_token: params.clientBatchToken,
      },
    );

    return obj;
  },

  async getDispatchCostMetrics(params: {
    empresaId: number;
    startDate?: string;
    endDate?: string;
    granularity?: "DAILY" | "HOURLY" | "MONTHLY";
    phoneNumbers?: string[];
    countryCodes?: string[];
    metaParamId?: number | string;
    conversaId?: number | string;
  }): Promise<DispatchCostMetricsResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
    };

    if (params.startDate) payload.start_date = params.startDate;
    if (params.endDate) payload.end_date = params.endDate;
    if (params.granularity) payload.granularity = params.granularity;
    if (params.phoneNumbers?.length) payload.phone_numbers = params.phoneNumbers;
    if (params.countryCodes?.length) payload.country_codes = params.countryCodes;
    appendMetaScope(payload, params);

    const { obj } = await postEncrypted<DispatchCostMetricsResult>(
      "meta",
      "/metricas_custo_disparo",
      payload,
    );

    return obj;
  },

  async listAutoMessages(
    empresaId: number,
    scope?: MetaScopeInput,
  ): Promise<WhatsAutoMessage[]> {
    const { obj, raw } = await postEncrypted<WhatsAutoMessage[]>(
      "user",
      "/listar_mensagens_automaticas_whatsapp",
      appendMetaScope(
        { empresa_id: empresaId },
        scope,
      )
    );
    const normalized = normalizeAutoMessages(obj, raw);
    console.log("[MetaService] listar_mensagens_automaticas_whatsapp", {
      empresaId,
      scope,
      raw,
      normalized,
    });
    return normalized;
  },

  async listReusableGalleryImages(
    empresaId: number,
  ): Promise<QuickMessageGalleryImage[]> {
    const { obj } = await postEncrypted<QuickMessageGalleryImage[]>(
      "user",
      "/galeria_empresa_imagens",
      { empresa_id: empresaId }
    );

    return Array.isArray(obj)
      ? obj.filter((image) => image?.disponivel_para_mensagem_rapida !== false)
      : [];
  },

  async uploadReusableGalleryImage(
    empresaId: number,
    file: File,
  ): Promise<QuickMessageGalleryImage> {
    const { obj } = await postEncryptedMultipart<QuickMessageGalleryImage>(
      "user",
      "/galeria_empresa_imagens_upload",
      { empresa_id: empresaId },
      { image: file }
    );

    return obj;
  },

  async createAutoMessage(params: {
    empresaId: number;
    tipoId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    texto: string;
    mensagemComplementarTexto?: string;
    galeriaImagemId?: number | null;
    metaParamId?: number | string;
  }): Promise<WhatsAutoMessage> {
    const endpointByType = {
      1: "/criar_mensagem_boas_vindas",
      2: "/criar_mensagem_final_atendimento",
      3: "/criar_texto_nps",
      4: "/criar_mensagem_aniversario",
      5: "/criar_mensagem_inicio_atendimento",
      6: "/criar_mensagem_aniversario",
      7: "/criar_mensagem_aniversario",
      8: "/criar_mensagem_sem_resposta_6h",
    } as const;

    console.log("[MetaService] criar mensagem automatica:request", params);
    const { obj, raw } = await postEncrypted<WhatsAutoMessage>(
      "user",
      endpointByType[params.tipoId],
      appendMetaScope(
        {
          empresa_id: params.empresaId,
          texto: params.texto,
          mensagem_complementar_texto: params.mensagemComplementarTexto,
          galeria_imagem_id: params.galeriaImagemId ?? null,
        },
        params,
      )
    );
    console.log("[MetaService] criar mensagem automatica:response", {
      params,
      raw,
      obj,
    });
    return obj;
  },

  async editAutoMessage(params: {
    empresaId: number;
    tipoId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    id: number;
    texto: string;
    mensagemComplementarTexto?: string;
    galeriaImagemId?: number | null;
    metaParamId?: number | string;
  }): Promise<WhatsAutoMessage> {
    const endpointByType = {
      1: "/editar_mensagem_boas_vindas",
      2: "/editar_mensagem_final_atendimento",
      3: "/editar_texto_nps",
      4: "/editar_mensagem_aniversario",
      5: "/editar_mensagem_inicio_atendimento",
      6: "/editar_mensagem_aniversario",
      7: "/editar_mensagem_aniversario",
      8: "/editar_mensagem_sem_resposta_6h",
    } as const;

    console.log("[MetaService] editar mensagem automatica:request", params);
    const { obj, raw } = await postEncrypted<WhatsAutoMessage>(
      "user",
      endpointByType[params.tipoId],
      appendMetaScope(
        {
          empresa_id: params.empresaId,
          id: params.id,
          texto: params.texto,
          mensagem_complementar_texto: params.mensagemComplementarTexto,
          galeria_imagem_id: params.galeriaImagemId ?? null,
        },
        params,
      )
    );
    console.log("[MetaService] editar mensagem automatica:response", {
      params,
      raw,
      obj,
    });
    return obj;
  },

  async deleteAutoMessage(params: {
    empresaId: number;
    tipoId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    id: number;
    metaParamId?: number | string;
  }): Promise<WhatsAutoMessage> {
    const endpointByType = {
      1: "/deletar_mensagem_boas_vindas",
      2: "/deletar_mensagem_final_atendimento",
      3: "/deletar_texto_nps",
      4: "/deletar_mensagem_aniversario",
      5: "/deletar_mensagem_inicio_atendimento",
      6: "/deletar_mensagem_aniversario",
      7: "/deletar_mensagem_aniversario",
      8: "/deletar_mensagem_sem_resposta_6h",
    } as const;

    const { obj } = await postEncrypted<WhatsAutoMessage>(
      "user",
      endpointByType[params.tipoId],
      appendMetaScope(
        {
          empresa_id: params.empresaId,
          id: params.id,
        },
        params,
      )
    );
    return obj;
  },

  async updateAutoMessageToggle(params: {
    empresaId: number;
    tipoId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    habilitada: boolean;
    metaParamId?: number | string;
  }): Promise<WhatsAutoMessage> {
    const { obj } = await postEncrypted<WhatsAutoMessage>(
      "user",
      "/alterar_status_mensagem_automatica_whatsapp",
      appendMetaScope(
        {
          empresa_id: params.empresaId,
          tipo_id: params.tipoId,
          habilitada: params.habilitada,
        },
        params,
      )
    );

    return obj;
  },

  async getDispatchHistoryReport(params: {
    empresaId: number;
    usuarioId?: number | string | null;
    startDate?: string;
    endDate?: string;
    dispatchType?: "all" | "list" | "single";
    metaParamId?: number | string;
    usuarioFiltroId?: number | string;
    status?: "all" | "processing" | "completed" | "stopped_on_error" | "failed";
    limit?: number;
    offset?: number;
  }): Promise<TemplateDispatchHistoryReportResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
    };

    if (params.usuarioId !== undefined && params.usuarioId !== null) {
      payload.usuario_id = params.usuarioId;
    }
    if (params.startDate) {
      payload.start_date = params.startDate;
      const start = dateInputToUnixSeconds(params.startDate, "start");
      if (start !== null) payload.start = start;
    }
    if (params.endDate) {
      payload.end_date = params.endDate;
      const end = dateInputToUnixSeconds(params.endDate, "end");
      if (end !== null) payload.end = end;
    }
    if (params.dispatchType && params.dispatchType !== "all") {
      payload.dispatch_type = params.dispatchType;
    }
    if (params.metaParamId !== undefined && params.metaParamId !== null) {
      payload.meta_param_id = params.metaParamId;
    }
    if (params.usuarioFiltroId !== undefined && params.usuarioFiltroId !== null) {
      payload.usuario_filtro_id = params.usuarioFiltroId;
    }
    if (params.status && params.status !== "all") payload.status = params.status;
    if (params.limit !== undefined) payload.limit = params.limit;
    if (params.offset !== undefined) payload.offset = params.offset;

    const { obj } = await postEncrypted<TemplateDispatchHistoryReportResult>(
      "meta",
      "/relatorio_envios",
      payload,
    );

    return obj;
  },

  async getDispatchHistoryReportDetail(params: {
    empresaId: number;
    usuarioId?: number | string | null;
    dispatchHistoryId: number | string;
  }): Promise<TemplateDispatchHistoryReportDetailResult> {
    const payload: Record<string, unknown> = {
      empresa_id: params.empresaId,
      dispatch_history_id: params.dispatchHistoryId,
    };

    if (params.usuarioId !== undefined && params.usuarioId !== null) {
      payload.usuario_id = params.usuarioId;
    }

    const { obj } = await postEncrypted<TemplateDispatchHistoryReportDetailResult>(
      "meta",
      "/relatorio_envios_detalhe",
      payload,
    );

    return obj;
  },

  async getBirthdayTemplateConfig(
    empresaId: number,
    scope?: MetaScopeInput,
  ): Promise<BirthdayTemplateConfig> {
    const { obj } = await postEncrypted<BirthdayTemplateConfig>(
      "user",
      "/configuracao_template_aniversario",
      appendMetaScope(
        {
          empresa_id: empresaId,
        },
        scope,
      ),
    );

    return {
      ...obj,
      is_default_dispatch_number: obj?.is_default_dispatch_number === true,
      default_dispatch_meta_param_id:
        typeof obj?.default_dispatch_meta_param_id === "number"
          ? obj.default_dispatch_meta_param_id
          : obj?.default_dispatch_meta_param_id
            ? Number(obj.default_dispatch_meta_param_id) || null
            : null,
      default_dispatch_display_phone_number: obj?.default_dispatch_display_phone_number
        ? String(obj.default_dispatch_display_phone_number)
        : null,
      template_name: obj?.template_name ? String(obj.template_name) : null,
      template_language: obj?.template_language
        ? String(obj.template_language)
        : "pt_BR",
      horario: obj?.horario ? String(obj.horario) : "09:00:00",
      header_media_type: obj?.header_media_type
        ? String(obj.header_media_type)
        : null,
      header_media_url: obj?.header_media_url
        ? String(obj.header_media_url)
        : null,
      header_parameters: Array.isArray(obj?.header_parameters)
        ? obj.header_parameters
        : [],
      body_parameters: Array.isArray(obj?.body_parameters)
        ? obj.body_parameters
        : [],
      button_parameters: Array.isArray(obj?.button_parameters)
        ? obj.button_parameters
        : [],
      habilitada: obj?.habilitada !== false,
      delay_days:
        typeof obj?.delay_days === "number"
          ? obj.delay_days
          : obj?.delay_days
            ? Number(obj.delay_days) || 0
            : null,
      automation_type: "birthday",
    };
  },

  async getTemplateAutomationConfig(
    empresaId: number,
    automationType: TemplateAutomationType,
    scope?: MetaScopeInput,
  ): Promise<TemplateAutomationConfig> {
    const { obj } = await postEncrypted<TemplateAutomationConfig>(
      "user",
      "/configuracao_template_automacao",
      appendMetaScope(
        {
          empresa_id: empresaId,
          automation_type: automationType,
        },
        scope,
      ),
    );

    return {
      ...obj,
      automation_type: automationType,
      is_default_dispatch_number: obj?.is_default_dispatch_number === true,
      default_dispatch_meta_param_id:
        typeof obj?.default_dispatch_meta_param_id === "number"
          ? obj.default_dispatch_meta_param_id
          : obj?.default_dispatch_meta_param_id
            ? Number(obj.default_dispatch_meta_param_id) || null
            : null,
      default_dispatch_display_phone_number: obj?.default_dispatch_display_phone_number
        ? String(obj.default_dispatch_display_phone_number)
        : null,
      template_name: obj?.template_name ? String(obj.template_name) : null,
      template_language: obj?.template_language
        ? String(obj.template_language)
        : "pt_BR",
      horario: obj?.horario ? String(obj.horario) : "09:00:00",
      delay_days:
        typeof obj?.delay_days === "number"
          ? obj.delay_days
          : obj?.delay_days
            ? Number(obj.delay_days) || 0
            : null,
      header_media_type: obj?.header_media_type
        ? String(obj.header_media_type)
        : null,
      header_media_url: obj?.header_media_url
        ? String(obj.header_media_url)
        : null,
      header_parameters: Array.isArray(obj?.header_parameters)
        ? obj.header_parameters
        : [],
      body_parameters: Array.isArray(obj?.body_parameters)
        ? obj.body_parameters
        : [],
      button_parameters: Array.isArray(obj?.button_parameters)
        ? obj.button_parameters
        : [],
      habilitada: obj?.habilitada !== false,
    };
  },

  async saveBirthdayTemplateConfig(params: {
    empresaId: number;
    metaParamId?: number | string;
    templateName?: string | null;
    language?: string | null;
    horario?: string | null;
    isDefaultDispatchNumber?: boolean;
    headerMediaType?: string | null;
    headerMediaUrl?: string | null;
    headerParameters?: unknown[];
    bodyParameters?: unknown[];
    buttonParameters?: MetaDispatchButtonParameter[];
    headerFile?: File | null;
  }): Promise<BirthdayTemplateConfig> {
    const payload = appendMetaScope(
      {
        empresa_id: params.empresaId,
        template_name: params.templateName || null,
        template_language: params.language || null,
        horario: params.horario || null,
        is_default_dispatch_number: params.isDefaultDispatchNumber === true,
        header_media_type: params.headerMediaType || null,
        header_media_url: params.headerMediaUrl || null,
        header_parameters: params.headerParameters || [],
        body_parameters: params.bodyParameters || [],
        button_parameters: params.buttonParameters || [],
      },
      params,
    );

    const { obj } = params.headerFile
      ? await postEncryptedMultipart<BirthdayTemplateConfig>(
          "user",
          "/salvar_configuracao_template_aniversario",
          payload,
          {
            header_file: params.headerFile,
          },
        )
      : await postEncrypted<BirthdayTemplateConfig>(
          "user",
          "/salvar_configuracao_template_aniversario",
          payload,
        );

    return {
      ...obj,
      is_default_dispatch_number: obj?.is_default_dispatch_number === true,
      default_dispatch_meta_param_id:
        typeof obj?.default_dispatch_meta_param_id === "number"
          ? obj.default_dispatch_meta_param_id
          : obj?.default_dispatch_meta_param_id
            ? Number(obj.default_dispatch_meta_param_id) || null
            : null,
      default_dispatch_display_phone_number: obj?.default_dispatch_display_phone_number
        ? String(obj.default_dispatch_display_phone_number)
        : null,
      template_name: obj?.template_name ? String(obj.template_name) : null,
      template_language: obj?.template_language
        ? String(obj.template_language)
        : "pt_BR",
      horario: obj?.horario ? String(obj.horario) : "09:00:00",
      header_media_type: obj?.header_media_type
        ? String(obj.header_media_type)
        : null,
      header_media_url: obj?.header_media_url
        ? String(obj.header_media_url)
        : null,
      header_parameters: Array.isArray(obj?.header_parameters)
        ? obj.header_parameters
        : [],
      body_parameters: Array.isArray(obj?.body_parameters)
        ? obj.body_parameters
        : [],
      button_parameters: Array.isArray(obj?.button_parameters)
        ? obj.button_parameters
        : [],
      habilitada: obj?.habilitada !== false,
      delay_days:
        typeof obj?.delay_days === "number"
          ? obj.delay_days
          : obj?.delay_days
            ? Number(obj.delay_days) || 0
            : null,
      automation_type: "birthday",
    };
  },

  async saveTemplateAutomationConfig(params: {
    empresaId: number;
    automationType: TemplateAutomationType;
    metaParamId?: number | string;
    templateName?: string | null;
    language?: string | null;
    horario?: string | null;
    delayDays?: number | null;
    isDefaultDispatchNumber?: boolean;
    headerMediaType?: string | null;
    headerMediaUrl?: string | null;
    headerParameters?: unknown[];
    bodyParameters?: unknown[];
    buttonParameters?: MetaDispatchButtonParameter[];
    headerFile?: File | null;
  }): Promise<TemplateAutomationConfig> {
    const payload = appendMetaScope(
      {
        empresa_id: params.empresaId,
        automation_type: params.automationType,
        template_name: params.templateName || null,
        template_language: params.language || null,
        horario: params.horario || null,
        delay_days:
          params.delayDays === undefined || params.delayDays === null
            ? null
            : params.delayDays,
        is_default_dispatch_number: params.isDefaultDispatchNumber === true,
        header_media_type: params.headerMediaType || null,
        header_media_url: params.headerMediaUrl || null,
        header_parameters: params.headerParameters || [],
        body_parameters: params.bodyParameters || [],
        button_parameters: params.buttonParameters || [],
      },
      params,
    );

    const { obj } = params.headerFile
      ? await postEncryptedMultipart<TemplateAutomationConfig>(
          "user",
          "/salvar_configuracao_template_automacao",
          payload,
          {
            header_file: params.headerFile,
          },
        )
      : await postEncrypted<TemplateAutomationConfig>(
          "user",
          "/salvar_configuracao_template_automacao",
          payload,
        );

    return {
      ...obj,
      automation_type: params.automationType,
      is_default_dispatch_number: obj?.is_default_dispatch_number === true,
      default_dispatch_meta_param_id:
        typeof obj?.default_dispatch_meta_param_id === "number"
          ? obj.default_dispatch_meta_param_id
          : obj?.default_dispatch_meta_param_id
            ? Number(obj.default_dispatch_meta_param_id) || null
            : null,
      default_dispatch_display_phone_number: obj?.default_dispatch_display_phone_number
        ? String(obj.default_dispatch_display_phone_number)
        : null,
      template_name: obj?.template_name ? String(obj.template_name) : null,
      template_language: obj?.template_language
        ? String(obj.template_language)
        : "pt_BR",
      horario: obj?.horario ? String(obj.horario) : "09:00:00",
      delay_days:
        typeof obj?.delay_days === "number"
          ? obj.delay_days
          : obj?.delay_days
            ? Number(obj.delay_days) || 0
            : null,
      header_media_type: obj?.header_media_type
        ? String(obj.header_media_type)
        : null,
      header_media_url: obj?.header_media_url
        ? String(obj.header_media_url)
        : null,
      header_parameters: Array.isArray(obj?.header_parameters)
        ? obj.header_parameters
        : [],
      body_parameters: Array.isArray(obj?.body_parameters)
        ? obj.body_parameters
        : [],
      button_parameters: Array.isArray(obj?.button_parameters)
        ? obj.button_parameters
        : [],
      habilitada: obj?.habilitada !== false,
    };
  },
};
