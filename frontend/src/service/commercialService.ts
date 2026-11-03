import { API_BASE } from "../config/api";
import { readStoredSession } from "../utils/authSession";
import { decrypt, encrypt } from "../utils/cripto";
import type { MetaDispatchButtonParameter } from "./metaService";

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

export type DealStage = string;

export type DealProduct = {
  id?: number | string;
  comercialProdutoId?: number | string;
  name: string;
  quantity: number;
  price: number;
  subtotal?: number;
  status?: string | null;
  soldQuantity?: number;
  lostQuantity?: number;
};

export type DealQuote = {
  id?: string;
  title: string;
  subtotal: number;
  discount: number;
  total: number;
  notes?: string | null;
  status?: string | null;
  items: DealProduct[];
};

export type Deal = {
  id: string;
  crmName?: string;
  filialId?: number;
  filialName?: string;
  title: string;
  amount: number;
  order?: number;
  companyName: string;
  contactName: string;
  customerPhone?: string;
  stage: DealStage;
  probability: number;
  createdAt: string | null;
  entryDate?: string | null;
  closingDate?: string | null;
  ownerId: string;
  ownerName?: string;
  customerEmail?: string;
  customerDocument?: string;
  temperature?: "quente" | "morno" | "frio";
  saleOrigin?: string;
  itemQuantity?: number;
  saleDate?: string | null;
  saleNotes?: string;
  paymentMethod?: string;
  installments?: number;
  refusalReason?: string;
  refusalNotes?: string;
  hasScheduledInteractionToday?: boolean;
  scheduledInteractionTodayAt?: string | null;
  scheduledInteractionTodayCount?: number;
  hasOpenInteraction?: boolean;
  openInteractionStartedAt?: string | null;
  openInteractionCount?: number;
  cliente_id?: number | string;
  clienteId?: number | string;
  chatConversationId?: number | null;
  chatConversationStatus?: string | null;
  tags?: string[];
  quote?: DealQuote | null;
  products?: DealProduct[];
};

export type Interaction = {
  id: string;
  type: string;
  category?: "interacao" | "agendamento";
  typeName?: string | null;
  date: string | null;
  endDate?: string;
  description: string;
  attendantName: string;
  duration?: string;
  value?: number;
  isCurrent?: boolean;
};

export type CommercialAppointment = {
  id: string;
  dealId?: string | null;
  dealTitle?: string;
  customerName: string;
  customerPhone?: string;
  ownerName: string;
  type: string;
  typeName?: string | null;
  category: "agendamento";
  description: string;
  startDate: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
};

export type HistoryEntry = {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string | null;
  attendantName: string;
  interactionId?: string;
  data?: Record<string, unknown>;
};

export type CustomerProfile = {
  id: string | null;
  name: string;
  email?: string;
  phone?: string;
  entryDate: string | null;
  totalPurchases: number;
  totalSpent: number;
  averageTicket: number;
  lastInteraction: string | null;
  interactions: Interaction[];
  appointments: Interaction[];
  history: HistoryEntry[];
};

export type CommercialStats = {
  updatedAt?: string | null;
  crm_id?: number;
  overview: CommercialDashboardOverview;
  salesBySource: CommercialDashboardSalesSource[];
  leadsNew: CommercialDashboardLeadBlock;
  leadsInProgress: CommercialDashboardInProgressBlock;
  serviceVelocity: CommercialDashboardServiceVelocity;
  contactCadence: CommercialDashboardContactCadence;
  funnel: CommercialDashboardFunnel;
  sellerPerformance: CommercialDashboardSellerPerformanceEntry[];
  leadOrigins: CommercialDashboardOriginPanel;
  leadArrivalPatterns: CommercialDashboardLeadArrivalPatterns;
  unattendedLeads: CommercialDashboardUnattendedLeads;
  totalQuotesInPipeline: number;
  activeQuotesCount: number;
  wonQuotesValue: number;
  quoteConversionRate: number;
  averageWonQuote: number;
  lostQuotesValue: number;
  monthlyWonQuotesRevenue: CommercialDashboardMonthlyRevenuePoint[];
  quotesByStage: CommercialDashboardStageValueEntry[];
  totalPipelineValue: number;
  activeDealsCount: number;
  winRate: number;
  averageTicket: number;
  lostAmount: number;
  monthlyRevenue: CommercialDashboardMonthlyRevenuePoint[];
  dealsByStage: CommercialDashboardStageValueEntry[];
  lossRadar: CommercialLossRadar;
  customerDocumentsCount?: number;
  documentsByAttendant?: CommercialDocumentsByAttendantEntry[];
};

export type CommercialDashboardSalesSource = {
  source: "crm" | "hotmart" | "hubla" | string;
  salesCount: number;
  revenue: number;
};

export type CommercialDashboardOverview = {
  leadsReceived: number;
  firstResponseAverageSeconds: number;
  contactedLeads: number;
  totalContacts: number;
  contactsPerLead: number;
  pendingFollowUps: number;
  pendingFollowUpsPercent: number;
  salesCount: number;
  revenue: number;
};

export type CommercialDashboardSeriesPoint = {
  key: string;
  label: string;
  count: number;
};

export type CommercialDashboardOriginEntry = {
  origin: string;
  count: number;
  percent: number;
};

export type CommercialDashboardLeadBlock = {
  total: number;
  percentOfTotal: number;
  byDay: CommercialDashboardSeriesPoint[];
  byOrigin: CommercialDashboardOriginEntry[];
};

export type CommercialDashboardAgingBucket = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

export type CommercialDashboardInProgressBlock = {
  total: number;
  percentOfActive: number;
  byOrigin: CommercialDashboardOriginEntry[];
  agingBuckets: CommercialDashboardAgingBucket[];
};

export type CommercialDashboardServiceVelocity = {
  totalLeads: number;
  contactedLeads: number;
  leadsWithoutResponse: number;
  respondedWithin5Min: number;
  respondedWithin15Min: number;
  respondedAfter15Min: number;
  averageFirstResponseSeconds: number;
  responseRate: number;
  leadsWithoutResponsePercent: number;
};

export type CommercialDashboardContactBucket = {
  key: string;
  label: string;
  leadsCount: number;
  leadsPercent: number;
  totalContacts: number;
};

export type CommercialDashboardContactCadence = {
  totalContacts: number;
  averageContactsPerLead: number;
  leadsWithoutContact: number;
  leadsWithoutContactPercent: number;
  buckets: CommercialDashboardContactBucket[];
};

export type CommercialDashboardFunnelItem = {
  id: number;
  code: string;
  name: string;
  color?: string | null;
  count: number;
  percentOfTotal: number;
  percentFromPrevious: number;
  isClosing?: boolean;
  isWon?: boolean;
};

export type CommercialDashboardFunnel = {
  totalLeads: number;
  overallConversionRate: number;
  items: CommercialDashboardFunnelItem[];
};

export type CommercialDashboardSellerPerformanceEntry = {
  sellerId: number;
  sellerName: string;
  leadsNew: number;
  leadsInProgress: number;
  contactsMade: number;
  averageContactsPerLead: number;
  conversionRate: number;
  salesCount: number;
  lostSalesCount: number;
  revenue: number;
};

export type CommercialDashboardOriginPanel = {
  total: number;
  items: CommercialDashboardOriginEntry[];
};

export type CommercialDashboardTimingEntry = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

export type CommercialDashboardLeadArrivalPatterns = {
  weekdays: CommercialDashboardTimingEntry[];
  hours: CommercialDashboardTimingEntry[];
};

export type CommercialDashboardUnattendedLeads = {
  total: number;
  percent: number;
  totalLeads: number;
};

export type CommercialDashboardMonthlyRevenuePoint = {
  month: string;
  value: number;
};

export type CommercialDashboardStageValueEntry = {
  stage: string;
  stageName?: string;
  color?: string | null;
  count: number;
  value: number;
};

export type CommercialDocumentsByAttendantEntry = {
  usuario_id: number | null;
  usuario_nome: string | null;
  total_documentos: number;
  total_clientes?: number;
};

export type CommercialLossRadarEntry = {
  code?: string;
  label?: string;
  name?: string;
  count?: number;
  quantity?: number;
  value: number;
};

export type CommercialLossRadar = {
  totalLostRevenue: number;
  fullLostRevenue: number;
  partialLostRevenue: number;
  lostDealsCount: number;
  partialLossDealsCount: number;
  topReasons: CommercialLossRadarEntry[];
  topProducts: CommercialLossRadarEntry[];
  topSellers: CommercialLossRadarEntry[];
};

export type CommercialReportMetrics = {
  totalQuoteSales?: number;
  quoteCount?: number;
  generatedQuotesCount?: number;
  avgQuoteTicket?: number;
  totalSales: number;
  count: number;
  avgTicket: number;
  activeSellers: number;
  totalLostRevenue?: number;
  fullLostRevenue?: number;
  partialLostRevenue?: number;
  lostQuotesCount?: number;
  partialLossDealsCount?: number;
  customerDocumentsCount?: number;
};

export type CommercialReportResult = {
  metrics: CommercialReportMetrics;
  topSellers: { name: string; value: number }[];
  topQuotedProducts?: { name: string; quantity: number; value: number }[];
  topProducts: { name: string; quantity: number; value: number }[];
  lossRadar: CommercialLossRadar;
  documentsByAttendant?: CommercialDocumentsByAttendantEntry[];
  quotes?: Deal[];
  deals: Deal[];
};

export type CommercialConversationExportRow = {
  id: number;
  clienteId: number | null;
  clienteNome: string;
  clienteTelefone: string;
  origemCliente: string;
  utms?: unknown;
  status: string;
  statusId: number | null;
  dataInicio: string | null;
  filaDesde: string | null;
  dataFim: string | null;
  ultimaAtualizacao: string | null;
  ultimaMensagemClienteEm: string | null;
  janelaMetaExpiraEm: string | null;
  janelaMetaAberta: boolean;
  filaMais24h: boolean;
  atendenteNome: string | null;
  usuarioAtribuidoNome: string | null;
  metaNumeroConta: string;
  metaNomeConta: string;
  funilNome: string;
  aguardandoRespostaTemplate: boolean;
  totalMensagens: number;
  totalMensagensCliente: number;
  totalMensagensUsuario: number;
  mensagens: {
    id: number;
    mensagemWhatsId: string | null;
    mensagem: string;
    dataMensagem: string | null;
    sendBy: number | null;
    autor: string;
    mediaType: string | null;
    apagada: boolean;
    status: string | null;
  }[];
  ultimaMensagem: string | null;
  ultimaMensagemSendBy: number | null;
  ultimaMensagemAutor: string;
};

export type PaginatedDealsResult = {
  items: Deal[];
  total: number;
  pagina: number;
  limite: number;
  total_paginas: number;
  total_valor?: number;
};

export type ConsolidatedSale = {
  id: string;
  fonte: "crm" | "hotmart" | "hubla" | "importada";
  vendaId: string;
  crmId: number | null;
  funilNome: string | null;
  clienteId: number | null;
  clienteNome: string;
  descricao: string;
  valor: number | null;
  origem: string;
  vendidoEm: string | null;
  vendedorId: number | null;
  vendedorNome: string | null;
  transacaoId: string | null;
  status: string | null;
};

export type PaginatedConsolidatedSalesResult = {
  items: ConsolidatedSale[];
  total: number;
  pagina: number;
  limite: number;
  total_paginas: number;
};

export type CommercialStage = {
  id: number;
  crm_id: number;
  codigo: string;
  nome: string;
  ordem: number;
  cor?: string | null;
  eh_inicial?: boolean;
  eh_fechamento?: boolean;
  eh_ganho?: boolean;
  ativo?: boolean;
};

export type CommercialDomainOption = {
  id: number;
  codigo: string;
  nome: string;
  categoria?: "interacao" | "agendamento";
  permite_parcelamento?: boolean;
  ativo?: boolean;
};

export type CommercialTag = {
  id: number;
  nome: string;
  cor?: string | null;
  ativo?: boolean;
};

export type CommercialDomainProduct = {
  imagens?: CommercialProductImage[];
  documento?: CommercialProductDocument | null;
  id: number;
  nome: string;
  descricao?: string | null;
  preco_base?: number;
  ativo?: boolean;
};

export type CommercialProductImage = {
  id: number;
  url: string;
  path_bunny?: string;
  nome_arquivo?: string | null;
  mime_type?: string | null;
  tamanho_bytes?: number | null;
  ordem?: number | null;
};

export type CommercialProductDocument = {
  id: number;
  url: string;
  path_bunny?: string;
  nome_arquivo?: string | null;
  mime_type?: string | null;
  tamanho_bytes?: number | null;
  criado_em?: string | null;
};

export type CommercialResponsible = {
  id: number;
  nome: string;
};

export type CommercialBranch = {
  id: number;
  nome: string;
  primaria?: boolean;
  ativo?: boolean;
};

export type CommercialMetaNumber = {
  id: number;
  display_phone_number?: string | null;
  verified_name?: string | null;
  phone_number_id?: string | null;
  ativo?: boolean;
  crm_vinculado_id?: number | null;
  crm_vinculado_nome?: string | null;
};

export type CommercialOriginOption = {
  valor: string;
  label: string;
};

export type CommercialDomains = {
  crm_id: number;
  etapas: CommercialStage[];
  formas_pagamento: CommercialDomainOption[];
  motivos_perda: CommercialDomainOption[];
  tipos_interacao: CommercialDomainOption[];
  tags: CommercialTag[];
  produtos: CommercialDomainProduct[];
  responsaveis: CommercialResponsible[];
  filiais: CommercialBranch[];
  meta_numeros: CommercialMetaNumber[];
  origens_venda: CommercialOriginOption[];
  filial_id?: number | null;
  filial_nome?: string | null;
  automacao_etapa_atendimento_iniciado_id?: number | null;
  automacao_etapa_orcamento_enviado_id?: number | null;
  financeiro_gerar_conta_receber?: boolean;
  financeiro_conta_financeira_id?: number | null;
  financeiro_categoria_id?: number | null;
  financeiro_centro_custo_id?: number | null;
  financeiro_empresa_grupo_id?: number | null;
  financeiro_vencimento_dias?: number;
  meta_numeros_vinculados?: CommercialMetaNumber[];
  usuarios_vinculados?: CommercialResponsible[];
  acesso_restrito?: boolean;
};

export type CommercialCrm = {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
  master?: boolean;
  criado_em?: string;
  acesso_restrito?: boolean;
  filial_id?: number | null;
  filial_nome?: string | null;
  automacao_etapa_atendimento_iniciado_id?: number | null;
  automacao_etapa_orcamento_enviado_id?: number | null;
  financeiro_gerar_conta_receber?: boolean;
  financeiro_conta_financeira_id?: number | null;
  financeiro_categoria_id?: number | null;
  financeiro_centro_custo_id?: number | null;
  financeiro_empresa_grupo_id?: number | null;
  financeiro_vencimento_dias?: number;
  meta_numeros?: CommercialMetaNumber[];
  usuarios_vinculados?: CommercialResponsible[];
};

export type CommercialScheduledDispatchAudience = "lista_transmissao" | "crm";

export type CommercialScheduledDispatchStatus =
  | "pending"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "canceled";

export type CommercialScheduledDispatch = {
  id: number;
  empresa_id: number;
  usuario_id?: number | null;
  usuario_nome?: string | null;
  empresa_meta_param_id: number | null;
  display_phone_number?: string | null;
  verified_name?: string | null;
  template_name: string;
  template_language: string;
  audience_type: CommercialScheduledDispatchAudience;
  lista_transmissao_id?: number | null;
  lista_nome?: string | null;
  crm_id?: number | null;
  crm_nome?: string | null;
  etapa_id?: number | null;
  etapa_nome?: string | null;
  scheduled_date: string | null;
  scheduled_hour: number;
  scheduled_time: string;
  header_media_type?: string | null;
  header_media_url?: string | null;
  header_parameters: unknown[];
  body_parameters: unknown[];
  button_parameters: MetaDispatchButtonParameter[];
  status: CommercialScheduledDispatchStatus;
  total_recipients: number;
  processed_recipients: number;
  sent_recipients: number;
  error_recipients: number;
  dispatch_history_id?: number | null;
  processing_started_at?: string | null;
  completed_at?: string | null;
  canceled_at?: string | null;
  last_error_message?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateCommercialScheduledDispatchInput = {
  metaParamId: number;
  templateName: string;
  templateLanguage?: string;
  audienceType: CommercialScheduledDispatchAudience;
  listaTransmissaoId?: number | null;
  crmId?: number | null;
  etapaId?: number | null;
  scheduledDate: string;
  scheduledHour: number | string;
  headerMediaType?: string | null;
  headerMediaUrl?: string | null;
  headerParameters?: unknown[];
  bodyParameters?: unknown[];
  buttonParameters?: MetaDispatchButtonParameter[];
};

export type CommercialCustomerSuggestion = {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  data_aniversario?: string | null;
};

export type RegisterCommercialInteractionInput = {
  dealId: string;
  type: string;
  category?: "interacao" | "agendamento";
  description: string;
  date?: string;
  endDate?: string;
  isCurrent?: boolean;
  value?: number;
  durationSeconds?: number;
};

type SessionContext = {
  empresaId: number;
  userId: number;
  userName: string;
  isMaster: boolean;
  isCommercialMaster: boolean;
  permissions: string[];
};

type DealsFilters = {
  crmId?: number | null;
  ownerId?: string;
  origin?: string;
  stage?: string;
  search?: string;
  dateStart?: string;
  dateEnd?: string;
  tag?: string;
  product?: string;
  filialId?: number | null;
  withoutFilial?: boolean;
  page?: number;
  limit?: number;
  paginated?: boolean;
};


const COMMERCIAL_DATA_CHANGED_EVENT = "commercial:data-changed";

function dispatchCommercialDataChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMMERCIAL_DATA_CHANGED_EVENT));
}

export function subscribeToCommercialDataChanged(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => listener();
  window.addEventListener(COMMERCIAL_DATA_CHANGED_EVENT, handler);
  return () => window.removeEventListener(COMMERCIAL_DATA_CHANGED_EVENT, handler);
}

async function getSessionContext(): Promise<SessionContext> {
  const session = await readStoredSession();
  if (!session?.user?.empresa_id || !session.user.id) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  const rawIsMaster = session.user.is_master as unknown;
  const isMaster =
    rawIsMaster === true ||
    rawIsMaster === 1 ||
    rawIsMaster === "1" ||
    String(rawIsMaster || "").toLowerCase() === "true";
  const permissions = Array.isArray(session.user.permissions) ? session.user.permissions : [];
  const isCommercialManager = permissions.includes("commercial.manager");

  return {
    empresaId: session.user.empresa_id,
    userId: session.user.id,
    userName: session.user.name,
    isMaster,
    isCommercialMaster: isMaster || isCommercialManager,
    permissions,
  };
}

async function postEncrypted<T>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<{ obj: T; message?: string }> {
  const encrypted = await encrypt(payload);
  const response = await fetch(`${API_BASE}/vendas${endpoint}`, {
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
    console.error("[commercialService] request failed", {
      endpoint,
      payload,
      responseData,
      decryptedPayload,
      message,
    });
    throw new Error(message);
  }

  return {
    obj: (data?.obj as T) ?? ({} as T),
    message,
  };
}

function normalizeStage(stage: string): DealStage {
  const normalized = String(stage || "").trim();
  return normalized || "waiting";
}

function normalizeDealProduct(item: DealProduct): DealProduct {
  return {
    ...item,
    quantity: Number(item.quantity || 0),
    price: Number(item.price || 0),
    subtotal:
      item.subtotal === null || item.subtotal === undefined
        ? undefined
        : Number(item.subtotal || 0),
    status: item.status || null,
    soldQuantity:
      item.soldQuantity === null || item.soldQuantity === undefined
        ? undefined
        : Number(item.soldQuantity || 0),
    lostQuantity:
      item.lostQuantity === null || item.lostQuantity === undefined
        ? undefined
        : Number(item.lostQuantity || 0),
  };
}

function normalizeQuote(quote: DealQuote | null | undefined, dealAmount: number): DealQuote | null {
  if (!quote) return null;

  return {
    ...quote,
    subtotal: Number(quote.subtotal || 0),
    discount: Number(quote.discount || 0),
    total: Number(quote.total || dealAmount || 0),
    items: Array.isArray(quote.items) ? quote.items.map(normalizeDealProduct) : [],
  };
}

function normalizeLossRadarEntry(
  entry: CommercialLossRadarEntry | null | undefined
): CommercialLossRadarEntry {
  return {
    code: entry?.code || undefined,
    label: entry?.label || undefined,
    name: entry?.name || undefined,
    count:
      entry?.count === null || entry?.count === undefined
        ? undefined
        : Number(entry.count || 0),
    quantity:
      entry?.quantity === null || entry?.quantity === undefined
        ? undefined
        : Number(entry.quantity || 0),
    value: Number(entry?.value || 0),
  };
}

function normalizeLossRadar(lossRadar: CommercialLossRadar | null | undefined): CommercialLossRadar {
  return {
    totalLostRevenue: Number(lossRadar?.totalLostRevenue || 0),
    fullLostRevenue: Number(lossRadar?.fullLostRevenue || 0),
    partialLostRevenue: Number(lossRadar?.partialLostRevenue || 0),
    lostDealsCount: Number(lossRadar?.lostDealsCount || 0),
    partialLossDealsCount: Number(lossRadar?.partialLossDealsCount || 0),
    topReasons: Array.isArray(lossRadar?.topReasons)
      ? lossRadar.topReasons.map(normalizeLossRadarEntry)
      : [],
    topProducts: Array.isArray(lossRadar?.topProducts)
      ? lossRadar.topProducts.map(normalizeLossRadarEntry)
      : [],
    topSellers: Array.isArray(lossRadar?.topSellers)
      ? lossRadar.topSellers.map(normalizeLossRadarEntry)
      : [],
  };
}

function normalizeDeal(deal: Deal): Deal {
  return {
    ...deal,
    stage: normalizeStage(deal.stage),
    tags: Array.isArray(deal.tags) ? deal.tags : [],
    quote: normalizeQuote(deal.quote, Number(deal.amount || 0)),
    products: Array.isArray(deal.products) ? deal.products.map(normalizeDealProduct) : [],
  };
}

function normalizeCommercialResponsible(
  responsible: CommercialResponsible | null | undefined
): CommercialResponsible {
  return {
    id: Number(responsible?.id || 0),
    nome: String(responsible?.nome || ""),
  };
}

function normalizeCommercialBranch(
  branch: CommercialBranch | null | undefined
): CommercialBranch {
  return {
    id: Number(branch?.id || 0),
    nome: String(branch?.nome || ""),
    primaria: branch?.primaria === true,
    ativo: branch?.ativo !== false,
  };
}

function normalizeCommercialMetaNumber(
  metaNumber: CommercialMetaNumber | null | undefined
): CommercialMetaNumber {
  return {
    id: Number(metaNumber?.id || 0),
    display_phone_number: metaNumber?.display_phone_number
      ? String(metaNumber.display_phone_number)
      : null,
    verified_name: metaNumber?.verified_name
      ? String(metaNumber.verified_name)
      : null,
    phone_number_id: metaNumber?.phone_number_id
      ? String(metaNumber.phone_number_id)
      : null,
    ativo: metaNumber?.ativo !== false,
    crm_vinculado_id:
      metaNumber?.crm_vinculado_id === null || metaNumber?.crm_vinculado_id === undefined
        ? null
        : Number(metaNumber.crm_vinculado_id || 0) || null,
    crm_vinculado_nome: metaNumber?.crm_vinculado_nome
      ? String(metaNumber.crm_vinculado_nome)
      : null,
  };
}

function normalizeCommercialCrm(
  crm: CommercialCrm | null | undefined
): CommercialCrm {
  return {
    id: Number(crm?.id || 0),
    nome: String(crm?.nome || ""),
    descricao: crm?.descricao ? String(crm.descricao) : null,
    ativo: crm?.ativo !== false,
    master: crm?.master === true,
    criado_em: crm?.criado_em ? String(crm.criado_em) : undefined,
    acesso_restrito: crm?.acesso_restrito === true,
    filial_id:
      crm?.filial_id === null || crm?.filial_id === undefined
        ? null
        : Number(crm.filial_id || 0),
    filial_nome: crm?.filial_nome ? String(crm.filial_nome) : null,
    automacao_etapa_atendimento_iniciado_id:
      crm?.automacao_etapa_atendimento_iniciado_id === null ||
      crm?.automacao_etapa_atendimento_iniciado_id === undefined
        ? null
        : Number(crm.automacao_etapa_atendimento_iniciado_id || 0),
    automacao_etapa_orcamento_enviado_id:
      crm?.automacao_etapa_orcamento_enviado_id === null ||
      crm?.automacao_etapa_orcamento_enviado_id === undefined
        ? null
        : Number(crm.automacao_etapa_orcamento_enviado_id || 0),
    financeiro_gerar_conta_receber: crm?.financeiro_gerar_conta_receber === true,
    financeiro_conta_financeira_id: crm?.financeiro_conta_financeira_id == null ? null : Number(crm.financeiro_conta_financeira_id) || null,
    financeiro_categoria_id: crm?.financeiro_categoria_id == null ? null : Number(crm.financeiro_categoria_id) || null,
    financeiro_centro_custo_id: crm?.financeiro_centro_custo_id == null ? null : Number(crm.financeiro_centro_custo_id) || null,
    financeiro_empresa_grupo_id: crm?.financeiro_empresa_grupo_id == null ? null : Number(crm.financeiro_empresa_grupo_id) || null,
    financeiro_vencimento_dias: Math.max(0, Number(crm?.financeiro_vencimento_dias || 0)),
    meta_numeros: Array.isArray(crm?.meta_numeros)
      ? crm.meta_numeros.map(normalizeCommercialMetaNumber)
      : [],
    usuarios_vinculados: Array.isArray(crm?.usuarios_vinculados)
      ? crm.usuarios_vinculados.map(normalizeCommercialResponsible)
      : [],
  };
}

function normalizeCommercialDomains(
  domains: CommercialDomains | null | undefined
): CommercialDomains {
  return {
    crm_id: Number(domains?.crm_id || 0),
    etapas: Array.isArray(domains?.etapas) ? domains.etapas : [],
    formas_pagamento: Array.isArray(domains?.formas_pagamento)
      ? domains.formas_pagamento
      : [],
    motivos_perda: Array.isArray(domains?.motivos_perda)
      ? domains.motivos_perda
      : [],
    tipos_interacao: Array.isArray(domains?.tipos_interacao)
      ? domains.tipos_interacao
      : [],
    tags: Array.isArray(domains?.tags) ? domains.tags : [],
    produtos: Array.isArray(domains?.produtos) ? domains.produtos : [],
    responsaveis: Array.isArray(domains?.responsaveis)
      ? domains.responsaveis.map(normalizeCommercialResponsible)
      : [],
    filiais: Array.isArray(domains?.filiais)
      ? domains.filiais.map(normalizeCommercialBranch)
      : [],
    meta_numeros: Array.isArray(domains?.meta_numeros)
      ? domains.meta_numeros.map(normalizeCommercialMetaNumber)
      : [],
    origens_venda: Array.isArray(domains?.origens_venda)
      ? domains.origens_venda.map((origin) => ({
          valor: String(origin?.valor || ""),
          label: String(origin?.label || origin?.valor || ""),
        }))
      : [],
    filial_id:
      domains?.filial_id === null || domains?.filial_id === undefined
        ? null
        : Number(domains.filial_id || 0),
    filial_nome: domains?.filial_nome ? String(domains.filial_nome) : null,
    automacao_etapa_atendimento_iniciado_id:
      domains?.automacao_etapa_atendimento_iniciado_id === null ||
      domains?.automacao_etapa_atendimento_iniciado_id === undefined
        ? null
        : Number(domains.automacao_etapa_atendimento_iniciado_id || 0),
    automacao_etapa_orcamento_enviado_id:
      domains?.automacao_etapa_orcamento_enviado_id === null ||
      domains?.automacao_etapa_orcamento_enviado_id === undefined
        ? null
        : Number(domains.automacao_etapa_orcamento_enviado_id || 0),
    financeiro_gerar_conta_receber: domains?.financeiro_gerar_conta_receber === true,
    financeiro_conta_financeira_id: domains?.financeiro_conta_financeira_id == null ? null : Number(domains.financeiro_conta_financeira_id) || null,
    financeiro_categoria_id: domains?.financeiro_categoria_id == null ? null : Number(domains.financeiro_categoria_id) || null,
    financeiro_centro_custo_id: domains?.financeiro_centro_custo_id == null ? null : Number(domains.financeiro_centro_custo_id) || null,
    financeiro_empresa_grupo_id: domains?.financeiro_empresa_grupo_id == null ? null : Number(domains.financeiro_empresa_grupo_id) || null,
    financeiro_vencimento_dias: Math.max(0, Number(domains?.financeiro_vencimento_dias || 0)),
    meta_numeros_vinculados: Array.isArray(domains?.meta_numeros_vinculados)
      ? domains.meta_numeros_vinculados.map(normalizeCommercialMetaNumber)
      : [],
    usuarios_vinculados: Array.isArray(domains?.usuarios_vinculados)
      ? domains.usuarios_vinculados.map(normalizeCommercialResponsible)
      : [],
    acesso_restrito: domains?.acesso_restrito === true,
  };
}

function normalizeCommercialScheduledDispatch(
  dispatch: CommercialScheduledDispatch | null | undefined,
): CommercialScheduledDispatch {
  return {
    id: Number(dispatch?.id || 0),
    empresa_id: Number(dispatch?.empresa_id || 0),
    usuario_id:
      dispatch?.usuario_id === null || dispatch?.usuario_id === undefined
        ? null
        : Number(dispatch.usuario_id || 0),
    usuario_nome: dispatch?.usuario_nome ? String(dispatch.usuario_nome) : null,
    empresa_meta_param_id:
      dispatch?.empresa_meta_param_id === null || dispatch?.empresa_meta_param_id === undefined
        ? null
        : Number(dispatch.empresa_meta_param_id || 0),
    display_phone_number: dispatch?.display_phone_number
      ? String(dispatch.display_phone_number)
      : null,
    verified_name: dispatch?.verified_name ? String(dispatch.verified_name) : null,
    template_name: String(dispatch?.template_name || ""),
    template_language: dispatch?.template_language
      ? String(dispatch.template_language)
      : "pt_BR",
    audience_type:
      String(dispatch?.audience_type || "").trim().toLowerCase() === "crm"
        ? "crm"
        : "lista_transmissao",
    lista_transmissao_id:
      dispatch?.lista_transmissao_id === null || dispatch?.lista_transmissao_id === undefined
        ? null
        : Number(dispatch.lista_transmissao_id || 0),
    lista_nome: dispatch?.lista_nome ? String(dispatch.lista_nome) : null,
    crm_id:
      dispatch?.crm_id === null || dispatch?.crm_id === undefined
        ? null
        : Number(dispatch.crm_id || 0),
    crm_nome: dispatch?.crm_nome ? String(dispatch.crm_nome) : null,
    etapa_id:
      dispatch?.etapa_id === null || dispatch?.etapa_id === undefined
        ? null
        : Number(dispatch.etapa_id || 0),
    etapa_nome: dispatch?.etapa_nome ? String(dispatch.etapa_nome) : null,
    scheduled_date: dispatch?.scheduled_date ? String(dispatch.scheduled_date) : null,
    scheduled_hour: Number(dispatch?.scheduled_hour || 0),
    scheduled_time: dispatch?.scheduled_time
      ? String(dispatch.scheduled_time)
      : `${String(Number(dispatch?.scheduled_hour || 0)).padStart(2, "0")}:00`,
    header_media_type: dispatch?.header_media_type
      ? String(dispatch.header_media_type)
      : null,
    header_media_url: dispatch?.header_media_url ? String(dispatch.header_media_url) : null,
    header_parameters: Array.isArray(dispatch?.header_parameters)
      ? dispatch.header_parameters
      : [],
    body_parameters: Array.isArray(dispatch?.body_parameters)
      ? dispatch.body_parameters
      : [],
    button_parameters: Array.isArray(dispatch?.button_parameters)
      ? (dispatch.button_parameters as MetaDispatchButtonParameter[])
      : [],
    status: (dispatch?.status || "pending") as CommercialScheduledDispatchStatus,
    total_recipients: Number(dispatch?.total_recipients || 0),
    processed_recipients: Number(dispatch?.processed_recipients || 0),
    sent_recipients: Number(dispatch?.sent_recipients || 0),
    error_recipients: Number(dispatch?.error_recipients || 0),
    dispatch_history_id:
      dispatch?.dispatch_history_id === null || dispatch?.dispatch_history_id === undefined
        ? null
        : Number(dispatch.dispatch_history_id || 0),
    processing_started_at: dispatch?.processing_started_at
      ? String(dispatch.processing_started_at)
      : null,
    completed_at: dispatch?.completed_at ? String(dispatch.completed_at) : null,
    canceled_at: dispatch?.canceled_at ? String(dispatch.canceled_at) : null,
    last_error_message: dispatch?.last_error_message
      ? String(dispatch.last_error_message)
      : null,
    metadata:
      dispatch?.metadata && typeof dispatch.metadata === "object"
        ? dispatch.metadata
        : {},
    created_at: dispatch?.created_at ? String(dispatch.created_at) : null,
    updated_at: dispatch?.updated_at ? String(dispatch.updated_at) : null,
  };
}

function normalizeStats(stats: CommercialStats | null | undefined): CommercialStats {
  return {
    updatedAt: stats?.updatedAt ? String(stats.updatedAt) : null,
    crm_id:
      stats?.crm_id === null || stats?.crm_id === undefined
        ? undefined
        : Number(stats.crm_id || 0),
    overview: {
      leadsReceived: Number(stats?.overview?.leadsReceived || 0),
      firstResponseAverageSeconds: Number(stats?.overview?.firstResponseAverageSeconds || 0),
      contactedLeads: Number(stats?.overview?.contactedLeads || 0),
      totalContacts: Number(stats?.overview?.totalContacts || 0),
      contactsPerLead: Number(stats?.overview?.contactsPerLead || 0),
      pendingFollowUps: Number(stats?.overview?.pendingFollowUps || 0),
      pendingFollowUpsPercent: Number(stats?.overview?.pendingFollowUpsPercent || 0),
      salesCount: Number(stats?.overview?.salesCount || 0),
      revenue: Number(stats?.overview?.revenue || 0),
    },
    salesBySource: Array.isArray(stats?.salesBySource)
      ? stats.salesBySource.map((item) => ({
          source: String(item?.source || ""),
          salesCount: Number(item?.salesCount || 0),
          revenue: Number(item?.revenue || 0),
        }))
      : [],
    leadsNew: {
      total: Number(stats?.leadsNew?.total || 0),
      percentOfTotal: Number(stats?.leadsNew?.percentOfTotal || 0),
      byDay: Array.isArray(stats?.leadsNew?.byDay)
        ? stats.leadsNew.byDay.map((item) => ({
            key: String(item?.key || ""),
            label: String(item?.label || ""),
            count: Number(item?.count || 0),
          }))
        : [],
      byOrigin: Array.isArray(stats?.leadsNew?.byOrigin)
        ? stats.leadsNew.byOrigin.map((item) => ({
            origin: String(item?.origin || "Sem origem"),
            count: Number(item?.count || 0),
            percent: Number(item?.percent || 0),
          }))
        : [],
    },
    leadsInProgress: {
      total: Number(stats?.leadsInProgress?.total || 0),
      percentOfActive: Number(stats?.leadsInProgress?.percentOfActive || 0),
      byOrigin: Array.isArray(stats?.leadsInProgress?.byOrigin)
        ? stats.leadsInProgress.byOrigin.map((item) => ({
            origin: String(item?.origin || "Sem origem"),
            count: Number(item?.count || 0),
            percent: Number(item?.percent || 0),
          }))
        : [],
      agingBuckets: Array.isArray(stats?.leadsInProgress?.agingBuckets)
        ? stats.leadsInProgress.agingBuckets.map((item) => ({
            key: String(item?.key || ""),
            label: String(item?.label || ""),
            count: Number(item?.count || 0),
            percent: Number(item?.percent || 0),
          }))
        : [],
    },
    serviceVelocity: {
      totalLeads: Number(stats?.serviceVelocity?.totalLeads || 0),
      contactedLeads: Number(stats?.serviceVelocity?.contactedLeads || 0),
      leadsWithoutResponse: Number(stats?.serviceVelocity?.leadsWithoutResponse || 0),
      respondedWithin5Min: Number(stats?.serviceVelocity?.respondedWithin5Min || 0),
      respondedWithin15Min: Number(stats?.serviceVelocity?.respondedWithin15Min || 0),
      respondedAfter15Min: Number(stats?.serviceVelocity?.respondedAfter15Min || 0),
      averageFirstResponseSeconds: Number(
        stats?.serviceVelocity?.averageFirstResponseSeconds || 0
      ),
      responseRate: Number(stats?.serviceVelocity?.responseRate || 0),
      leadsWithoutResponsePercent: Number(
        stats?.serviceVelocity?.leadsWithoutResponsePercent || 0
      ),
    },
    contactCadence: {
      totalContacts: Number(stats?.contactCadence?.totalContacts || 0),
      averageContactsPerLead: Number(stats?.contactCadence?.averageContactsPerLead || 0),
      leadsWithoutContact: Number(stats?.contactCadence?.leadsWithoutContact || 0),
      leadsWithoutContactPercent: Number(stats?.contactCadence?.leadsWithoutContactPercent || 0),
      buckets: Array.isArray(stats?.contactCadence?.buckets)
        ? stats.contactCadence.buckets.map((item) => ({
            key: String(item?.key || ""),
            label: String(item?.label || ""),
            leadsCount: Number(item?.leadsCount || 0),
            leadsPercent: Number(item?.leadsPercent || 0),
            totalContacts: Number(item?.totalContacts || 0),
          }))
        : [],
    },
    funnel: {
      totalLeads: Number(stats?.funnel?.totalLeads || 0),
      overallConversionRate: Number(stats?.funnel?.overallConversionRate || 0),
      items: Array.isArray(stats?.funnel?.items)
        ? stats.funnel.items.map((item) => ({
            id: Number(item?.id || 0),
            code: String(item?.code || ""),
            name: String(item?.name || "Etapa"),
            color: item?.color || null,
            count: Number(item?.count || 0),
            percentOfTotal: Number(item?.percentOfTotal || 0),
            percentFromPrevious: Number(item?.percentFromPrevious || 0),
            isClosing: item?.isClosing === true,
            isWon: item?.isWon === true,
          }))
        : [],
    },
    sellerPerformance: Array.isArray(stats?.sellerPerformance)
      ? stats.sellerPerformance.map((item) => ({
          sellerId: Number(item?.sellerId || 0),
          sellerName: String(item?.sellerName || "Sem responsável"),
          leadsNew: Number(item?.leadsNew || 0),
          leadsInProgress: Number(item?.leadsInProgress || 0),
          contactsMade: Number(item?.contactsMade || 0),
          averageContactsPerLead: Number(item?.averageContactsPerLead || 0),
          conversionRate: Number(item?.conversionRate || 0),
          salesCount: Number(item?.salesCount || 0),
          lostSalesCount: Number(item?.lostSalesCount || 0),
          revenue: Number(item?.revenue || 0),
        }))
      : [],
    leadOrigins: {
      total: Number(stats?.leadOrigins?.total || 0),
      items: Array.isArray(stats?.leadOrigins?.items)
        ? stats.leadOrigins.items.map((item) => ({
            origin: String(item?.origin || "Sem origem"),
            count: Number(item?.count || 0),
            percent: Number(item?.percent || 0),
          }))
        : [],
    },
    leadArrivalPatterns: {
      weekdays: Array.isArray(stats?.leadArrivalPatterns?.weekdays)
        ? stats.leadArrivalPatterns.weekdays.map((item) => ({
            key: String(item?.key || ""),
            label: String(item?.label || ""),
            count: Number(item?.count || 0),
            percent: Number(item?.percent || 0),
          }))
        : [],
      hours: Array.isArray(stats?.leadArrivalPatterns?.hours)
        ? stats.leadArrivalPatterns.hours.map((item) => ({
            key: String(item?.key || ""),
            label: String(item?.label || ""),
            count: Number(item?.count || 0),
            percent: Number(item?.percent || 0),
          }))
        : [],
    },
    unattendedLeads: {
      total: Number(stats?.unattendedLeads?.total || 0),
      percent: Number(stats?.unattendedLeads?.percent || 0),
      totalLeads: Number(stats?.unattendedLeads?.totalLeads || 0),
    },
    totalQuotesInPipeline: Number(stats?.totalQuotesInPipeline || 0),
    activeQuotesCount: Number(stats?.activeQuotesCount || 0),
    wonQuotesValue: Number(stats?.wonQuotesValue || 0),
    quoteConversionRate: Number(stats?.quoteConversionRate || 0),
    averageWonQuote: Number(stats?.averageWonQuote || 0),
    lostQuotesValue: Number(stats?.lostQuotesValue || 0),
    monthlyWonQuotesRevenue: Array.isArray(stats?.monthlyWonQuotesRevenue)
      ? stats.monthlyWonQuotesRevenue.map((item) => ({
          month: String(item.month || ""),
          value: Number(item.value || 0),
        }))
      : [],
    quotesByStage: Array.isArray(stats?.quotesByStage)
      ? stats.quotesByStage.map((item) => ({
          stage: String(item.stage || ""),
          stageName: item.stageName ? String(item.stageName) : undefined,
          color: item.color || null,
          count: Number(item.count || 0),
          value: Number(item.value || 0),
        }))
      : [],
    totalPipelineValue: Number(stats?.totalPipelineValue || 0),
    activeDealsCount: Number(stats?.activeDealsCount || 0),
    winRate: Number(stats?.winRate || 0),
    averageTicket: Number(stats?.averageTicket || 0),
    lostAmount: Number(stats?.lostAmount || 0),
    monthlyRevenue: Array.isArray(stats?.monthlyRevenue)
      ? stats.monthlyRevenue.map((item) => ({
          month: String(item.month || ""),
          value: Number(item.value || 0),
        }))
      : [],
    dealsByStage: Array.isArray(stats?.dealsByStage)
      ? stats.dealsByStage.map((item) => ({
          stage: String(item.stage || ""),
          stageName: item.stageName ? String(item.stageName) : undefined,
          color: item.color || null,
          count: Number(item.count || 0),
          value: Number(item.value || 0),
        }))
      : [],
    lossRadar: normalizeLossRadar(stats?.lossRadar),
    customerDocumentsCount: Number(stats?.customerDocumentsCount || 0),
    documentsByAttendant: Array.isArray(stats?.documentsByAttendant)
      ? stats.documentsByAttendant.map((item) => ({
          usuario_id:
            item?.usuario_id === null || item?.usuario_id === undefined
              ? null
              : Number(item.usuario_id || 0),
          usuario_nome: item?.usuario_nome ? String(item.usuario_nome) : null,
          total_documentos: Number(item?.total_documentos || 0),
          total_clientes:
            item?.total_clientes === null || item?.total_clientes === undefined
              ? undefined
              : Number(item.total_clientes || 0),
        }))
      : [],
  };
}

function normalizeReport(report: CommercialReportResult | null | undefined): CommercialReportResult {
  return {
    metrics: {
      totalQuoteSales:
        report?.metrics?.totalQuoteSales === null || report?.metrics?.totalQuoteSales === undefined
          ? undefined
          : Number(report.metrics.totalQuoteSales || 0),
      quoteCount:
        report?.metrics?.quoteCount === null || report?.metrics?.quoteCount === undefined
          ? undefined
          : Number(report.metrics.quoteCount || 0),
      generatedQuotesCount:
        report?.metrics?.generatedQuotesCount === null ||
        report?.metrics?.generatedQuotesCount === undefined
          ? undefined
          : Number(report.metrics.generatedQuotesCount || 0),
      avgQuoteTicket:
        report?.metrics?.avgQuoteTicket === null || report?.metrics?.avgQuoteTicket === undefined
          ? undefined
          : Number(report.metrics.avgQuoteTicket || 0),
      totalSales: Number(report?.metrics?.totalSales || 0),
      count: Number(report?.metrics?.count || 0),
      avgTicket: Number(report?.metrics?.avgTicket || 0),
      activeSellers: Number(report?.metrics?.activeSellers || 0),
      totalLostRevenue:
        report?.metrics?.totalLostRevenue === null || report?.metrics?.totalLostRevenue === undefined
          ? undefined
          : Number(report.metrics.totalLostRevenue || 0),
      fullLostRevenue:
        report?.metrics?.fullLostRevenue === null || report?.metrics?.fullLostRevenue === undefined
          ? undefined
          : Number(report.metrics.fullLostRevenue || 0),
      partialLostRevenue:
        report?.metrics?.partialLostRevenue === null || report?.metrics?.partialLostRevenue === undefined
          ? undefined
          : Number(report.metrics.partialLostRevenue || 0),
      lostQuotesCount:
        report?.metrics?.lostQuotesCount === null || report?.metrics?.lostQuotesCount === undefined
          ? undefined
          : Number(report.metrics.lostQuotesCount || 0),
      partialLossDealsCount:
        report?.metrics?.partialLossDealsCount === null ||
        report?.metrics?.partialLossDealsCount === undefined
          ? undefined
          : Number(report.metrics.partialLossDealsCount || 0),
      customerDocumentsCount:
        report?.metrics?.customerDocumentsCount === null ||
        report?.metrics?.customerDocumentsCount === undefined
          ? undefined
          : Number(report.metrics.customerDocumentsCount || 0),
    },
    topSellers: Array.isArray(report?.topSellers)
      ? report.topSellers.map((item) => ({
          name: item.name,
          value: Number(item.value || 0),
        }))
      : [],
    topQuotedProducts: Array.isArray(report?.topQuotedProducts)
      ? report.topQuotedProducts.map((item) => ({
          name: item.name,
          quantity: Number(item.quantity || 0),
          value: Number(item.value || 0),
        }))
      : [],
    topProducts: Array.isArray(report?.topProducts)
      ? report.topProducts.map((item) => ({
          name: item.name,
          quantity: Number(item.quantity || 0),
          value: Number(item.value || 0),
        }))
      : [],
    lossRadar: normalizeLossRadar(report?.lossRadar),
    documentsByAttendant: Array.isArray(report?.documentsByAttendant)
      ? report.documentsByAttendant.map((item) => ({
          usuario_id:
            item?.usuario_id === null || item?.usuario_id === undefined
              ? null
              : Number(item.usuario_id || 0),
          usuario_nome: item?.usuario_nome ? String(item.usuario_nome) : null,
          total_documentos: Number(item?.total_documentos || 0),
          total_clientes:
            item?.total_clientes === null || item?.total_clientes === undefined
              ? undefined
              : Number(item.total_clientes || 0),
        }))
      : [],
    quotes: Array.isArray(report?.quotes) ? report.quotes.map(normalizeDeal) : [],
    deals: Array.isArray(report?.deals) ? report.deals.map(normalizeDeal) : [],
  };
}

function normalizePaginatedDealsResult(
  result: PaginatedDealsResult | null | undefined
): PaginatedDealsResult {
  return {
    items: Array.isArray(result?.items) ? result.items.map(normalizeDeal) : [],
    total: Number(result?.total || 0),
    pagina: Math.max(Number(result?.pagina || 1), 1),
    limite: Math.max(Number(result?.limite || 20), 1),
    total_paginas: Math.max(Number(result?.total_paginas || 1), 1),
    total_valor:
      result?.total_valor === null || result?.total_valor === undefined
        ? undefined
        : Number(result.total_valor || 0),
  };
}

export async function getCommercialCrms(): Promise<CommercialCrm[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialCrm[]>("/crm_crms", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
  });
  return Array.isArray(obj) ? obj.map(normalizeCommercialCrm) : [];
}

export async function createCommercialCrm(name: string, description?: string): Promise<CommercialCrm> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialCrm>("/crm_criar", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    nome: name,
    descricao: description || undefined,
  });
  dispatchCommercialDataChanged();
  return normalizeCommercialCrm(obj);
}

export async function updateCommercialCrm(
  crmId: number,
  updates: {
    name?: string;
    description?: string | null;
    active?: boolean;
    assignedUserIds?: number[];
    branchId?: number | null;
    metaParamIds?: number[];
    automacaoEtapaAtendimentoIniciadoId?: number | null;
    automacaoEtapaOrcamentoEnviadoId?: number | null;
    financeiroGerarContaReceber?: boolean;
    financeiroContaFinanceiraId?: number | null;
    financeiroCategoriaId?: number | null;
    financeiroCentroCustoId?: number | null;
    financeiroEmpresaGrupoId?: number | null;
    financeiroVencimentoDias?: number;
  }
): Promise<CommercialCrm> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialCrm>("/crm_editar", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    crm_id: crmId,
    nome: updates.name,
    descricao: updates.description,
    ativo: updates.active,
    usuarios_vinculados_ids: updates.assignedUserIds,
    filial_id:
      updates.branchId === undefined ? undefined : updates.branchId,
    meta_param_ids: updates.metaParamIds,
    automacao_etapa_atendimento_iniciado_id:
      updates.automacaoEtapaAtendimentoIniciadoId,
    automacao_etapa_orcamento_enviado_id:
      updates.automacaoEtapaOrcamentoEnviadoId,
    financeiro_gerar_conta_receber: updates.financeiroGerarContaReceber,
    financeiro_conta_financeira_id: updates.financeiroContaFinanceiraId,
    financeiro_categoria_id: updates.financeiroCategoriaId,
    financeiro_centro_custo_id: updates.financeiroCentroCustoId,
    financeiro_empresa_grupo_id: updates.financeiroEmpresaGrupoId,
    financeiro_vencimento_dias: updates.financeiroVencimentoDias,
  });
  dispatchCommercialDataChanged();
  return normalizeCommercialCrm(obj);
}

export async function deleteCommercialCrm(crmId: number): Promise<void> {
  const session = await getSessionContext();
  await postEncrypted("/crm_editar", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    crm_id: crmId,
    ativo: false,
  });
  dispatchCommercialDataChanged();
}

export async function createCommercialStage(
  crmId: number,
  payload: { name: string; color?: string; order?: number }
): Promise<CommercialStage> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialStage>("/crm_coluna_criar", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    crm_id: crmId,
    nome: payload.name,
    cor: payload.color || undefined,
    ordem: payload.order,
  });
  dispatchCommercialDataChanged();
  return obj;
}

export async function updateCommercialStage(
  crmId: number,
  stageId: number,
  payload: { name?: string; color?: string; order?: number }
): Promise<CommercialStage> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialStage>("/crm_coluna_editar", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    crm_id: crmId,
    etapa_id: stageId,
    nome: payload.name,
    cor: payload.color,
    ordem: payload.order,
  });
  dispatchCommercialDataChanged();
  return obj;
}

export async function reorderCommercialStages(crmId: number, stageIds: number[]): Promise<CommercialStage[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialStage[]>("/crm_coluna_reordenar", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    crm_id: crmId,
    etapa_ids: stageIds,
  });
  dispatchCommercialDataChanged();
  return Array.isArray(obj) ? obj : [];
}

export async function deleteCommercialStage(crmId: number, stageId: number): Promise<CommercialStage[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialStage[]>("/crm_coluna_deletar", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    crm_id: crmId,
    etapa_id: stageId,
  });
  dispatchCommercialDataChanged();
  return Array.isArray(obj) ? obj : [];
}

export async function getCommercialDomains(crmId?: number | null): Promise<CommercialDomains> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialDomains>("/crm_dominios", {
    empresa_id: session.empresaId,
    crm_id: crmId ?? undefined,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    permissions: session.permissions,
  });
  return normalizeCommercialDomains(obj);
}

export async function getCommercialProducts(): Promise<CommercialDomainProduct[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialDomainProduct[]>("/crm_produtos", {
    empresa_id: session.empresaId,
  });
  return Array.isArray(obj) ? obj : [];
}

async function postEncryptedMultipart<T>(
  endpoint: string,
  payload: Record<string, unknown>,
  files: File[],
  fieldName = "files"
): Promise<{ obj: T; message?: string }> {
  const encrypted = await encrypt(payload);
  const formData = new FormData();
  formData.append("payload", encrypted);
  files.forEach((file) => formData.append(fieldName, file));

  const response = await fetch(`${API_BASE}/vendas${endpoint}`, {
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
    throw new Error(message);
  }

  return {
    obj: (data?.obj as T) ?? ({} as T),
    message,
  };
}

export async function createCommercialProduct(payload: {
  name: string;
  description?: string;
  price?: number;
}): Promise<CommercialDomainProduct> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialDomainProduct>("/crm_produto_criar", {
    empresa_id: session.empresaId,
    nome: payload.name,
    descricao: payload.description || undefined,
    preco_base: payload.price ?? 0,
  });
  dispatchCommercialDataChanged();
  return obj;
}

export async function updateCommercialProduct(
  productId: number,
  payload: { name: string; description?: string; price?: number }
): Promise<CommercialDomainProduct> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialDomainProduct>("/crm_produto_editar", {
    empresa_id: session.empresaId,
    produto_id: productId,
    nome: payload.name,
    descricao: payload.description || undefined,
    preco_base: payload.price ?? 0,
  });
  dispatchCommercialDataChanged();
  return obj;
}

export async function deleteCommercialProduct(productId: number): Promise<void> {
  const session = await getSessionContext();
  await postEncrypted("/crm_produto_deletar", {
    empresa_id: session.empresaId,
    produto_id: productId,
  });
  dispatchCommercialDataChanged();
}

export async function uploadCommercialProductImages(
  productId: number,
  files: File[]
): Promise<CommercialDomainProduct> {
  const session = await getSessionContext();
  const { obj } = await postEncryptedMultipart<CommercialDomainProduct>(
    "/crm_produto_upload_imagens",
    {
      empresa_id: session.empresaId,
      produto_id: productId,
    },
    files,
    "files"
  );
  dispatchCommercialDataChanged();
  return obj;
}

export async function deleteCommercialProductImage(
  imageId: number
): Promise<CommercialDomainProduct> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialDomainProduct>(
    "/crm_produto_imagem_deletar",
    {
      empresa_id: session.empresaId,
      imagem_id: imageId,
    }
  );
  dispatchCommercialDataChanged();
  return obj;
}

export async function uploadCommercialProductDocument(
  productId: number,
  file: File
): Promise<CommercialDomainProduct> {
  const session = await getSessionContext();
  const { obj } = await postEncryptedMultipart<CommercialDomainProduct>(
    "/crm_produto_upload_documento",
    {
      empresa_id: session.empresaId,
      produto_id: productId,
    },
    [file],
    "document"
  );
  dispatchCommercialDataChanged();
  return obj;
}

export async function deleteCommercialProductDocument(
  documentId: number
): Promise<CommercialDomainProduct> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialDomainProduct>(
    "/crm_produto_documento_deletar",
    {
      empresa_id: session.empresaId,
      documento_id: documentId,
    }
  );
  dispatchCommercialDataChanged();
  return obj;
}

export async function searchCommercialCustomers(
  term: string,
  limit = 10
): Promise<CommercialCustomerSuggestion[]> {
  const session = await getSessionContext();
  const normalized = String(term || "").trim();
  if (!normalized || normalized.length < 2) return [];

  const { obj } = await postEncrypted<CommercialCustomerSuggestion[]>("/crm_buscar_clientes", {
    empresa_id: session.empresaId,
    search: normalized,
    limit,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function getCommercialDeals(filters: DealsFilters = {}): Promise<Deal[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<Deal[]>("/crm_negocios", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    permissions: session.permissions,
    crm_id: filters.crmId ?? undefined,
    ownerId: filters.ownerId || undefined,
    stage: filters.stage || undefined,
    search: filters.search || undefined,
    dateStart: filters.dateStart || undefined,
    dateEnd: filters.dateEnd || undefined,
    tag: filters.tag || undefined,
    product: filters.product || undefined,
    filial_id: filters.withoutFilial ? undefined : filters.filialId ?? undefined,
    sem_filial: filters.withoutFilial === true,
  });

  return (obj || []).map(normalizeDeal);
}

export async function getCommercialDealsPage(
  filters: DealsFilters = {}
): Promise<PaginatedDealsResult> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<PaginatedDealsResult>("/crm_negocios", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    permissions: session.permissions,
    crm_id: filters.crmId ?? undefined,
    ownerId: filters.ownerId || undefined,
    stage: filters.stage || undefined,
    search: filters.search || undefined,
    dateStart: filters.dateStart || undefined,
    dateEnd: filters.dateEnd || undefined,
    tag: filters.tag || undefined,
    product: filters.product || undefined,
    filial_id: filters.withoutFilial ? undefined : filters.filialId ?? undefined,
    sem_filial: filters.withoutFilial === true,
    pagina: filters.page ?? 1,
    limite: filters.limit ?? 20,
    paginado: filters.paginated ?? true,
  });

  return normalizePaginatedDealsResult(obj);
}

export async function getCommercialClosedDeals(
  filters: DealsFilters = {}
): Promise<PaginatedDealsResult> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<PaginatedDealsResult>("/crm_negocios_fechados", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    permissions: session.permissions,
    crm_id: filters.crmId ?? undefined,
    ownerId: filters.ownerId || undefined,
    stage: filters.stage || undefined,
    origin: filters.origin || undefined,
    search: filters.search || undefined,
    dateStart: filters.dateStart || undefined,
    dateEnd: filters.dateEnd || undefined,
    pagina: filters.page ?? 1,
    limite: filters.limit ?? 20,
  });
  return normalizePaginatedDealsResult(obj);
}

export async function getCommercialConsolidatedSales(filters: {
  source?: "crm" | "hotmart" | "hubla" | "importada";
  ownerId?: number | string;
  product?: string;
  search?: string;
  dateStart?: string;
  dateEnd?: string;
  page?: number;
  limit?: number;
} = {}): Promise<PaginatedConsolidatedSalesResult> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<PaginatedConsolidatedSalesResult>(
    "/vendas_consolidadas",
    {
      empresa_id: session.empresaId,
      usuario_id: session.userId,
      is_master: session.isCommercialMaster,
      permissions: session.permissions,
      source: filters.source || undefined,
      ownerId: filters.ownerId || undefined,
      product: filters.product || undefined,
      search: filters.search || undefined,
      dateStart: filters.dateStart || undefined,
      dateEnd: filters.dateEnd || undefined,
      pagina: filters.page ?? 1,
      limite: filters.limit ?? 20,
    }
  );

  return {
    items: Array.isArray(obj?.items) ? obj.items : [],
    total: Number(obj?.total || 0),
    pagina: Number(obj?.pagina || 1),
    limite: Number(obj?.limite || 20),
    total_paginas: Math.max(1, Number(obj?.total_paginas || 1)),
  };
}

export async function importCommercialConsolidatedSales(vendas: Array<Record<string, unknown>>) {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<{ imported: number; errors: Array<{ linha: number; mensagem: string }> }>("/vendas_consolidadas_importar", {
    empresa_id: session.empresaId, usuario_id: session.userId, is_master: session.isCommercialMaster, permissions: session.permissions, vendas,
  });
  return obj;
}

export async function updateImportedCommercialSale(
  vendaId: string,
  updates: {
    clienteNome: string;
    descricao: string;
    valor: number;
    vendidoEm: string;
    origem: string;
    vendedorId: number | null;
  }
) {
  const session = await getSessionContext();
  const { obj } = await postEncrypted("/venda_importada_editar", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    permissions: session.permissions,
    venda_id: Number(vendaId),
    ...updates,
  });
  dispatchCommercialDataChanged();
  return obj;
}

export async function assignIntegratedCommercialSaleSeller(
  fonte: "hotmart" | "hubla",
  vendaId: string,
  vendedorId: number | null
) {
  const session = await getSessionContext();
  const { obj } = await postEncrypted("/venda_integracao_atribuir_vendedor", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    permissions: session.permissions,
    fonte,
    venda_id: Number(vendaId),
    vendedorId,
  });
  dispatchCommercialDataChanged();
  return obj;
}

export async function deleteCommercialConsolidatedSale(
  fonte: "crm" | "importada",
  vendaId: string
) {
  const session = await getSessionContext();
  await postEncrypted("/venda_consolidada_excluir", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    permissions: session.permissions,
    fonte,
    venda_id: Number(vendaId),
  });
  dispatchCommercialDataChanged();
}

export async function getCommercialDashboard(
  filters: DealsFilters = {}
): Promise<CommercialStats> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialStats>("/crm_dashboard", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    permissions: session.permissions,
    crm_id: filters.crmId ?? undefined,
    ownerId: filters.ownerId || undefined,
    origin: filters.origin || undefined,
    search: filters.search || undefined,
    dateStart: filters.dateStart || undefined,
    dateEnd: filters.dateEnd || undefined,
    product: filters.product || undefined,
    filial_id: filters.withoutFilial ? undefined : filters.filialId ?? undefined,
    sem_filial: filters.withoutFilial === true,
  });
  return normalizeStats(obj);
}

export async function getCommercialReports(
  filters: DealsFilters = {}
): Promise<CommercialReportResult> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialReportResult>("/crm_relatorios", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    permissions: session.permissions,
    crm_id: filters.crmId ?? undefined,
    ownerId: filters.ownerId || undefined,
    stage: filters.stage || undefined,
    search: filters.search || undefined,
    dateStart: filters.dateStart || undefined,
    dateEnd: filters.dateEnd || undefined,
    tag: filters.tag || undefined,
    product: filters.product || undefined,
    filial_id: filters.withoutFilial ? undefined : filters.filialId ?? undefined,
    sem_filial: filters.withoutFilial === true,
  });
  return normalizeReport(obj);
}

export async function getCommercialCompanyConversationsExport(filters: {
  attendantId?: string | number | null;
  dateStart?: string | null;
  dateEnd?: string | null;
} = {}): Promise<
  CommercialConversationExportRow[]
> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialConversationExportRow[]>(
    "/crm_relatorios_conversas_empresa",
    {
      empresa_id: session.empresaId,
      usuario_id: session.userId,
      is_master: session.isMaster,
      permissions: session.permissions,
      attendantId: filters.attendantId || undefined,
      dateStart: filters.dateStart || undefined,
      dateEnd: filters.dateEnd || undefined,
    }
  );

  return Array.isArray(obj)
    ? obj.map((item) => ({
        id: Number(item?.id || 0),
        clienteId:
          item?.clienteId === null || item?.clienteId === undefined
            ? null
            : Number(item.clienteId || 0),
        clienteNome: item?.clienteNome ? String(item.clienteNome) : "",
        clienteTelefone: item?.clienteTelefone ? String(item.clienteTelefone) : "",
        origemCliente: item?.origemCliente ? String(item.origemCliente) : "whatsapp",
        utms: item?.utms ?? null,
        status: item?.status ? String(item.status) : "finished",
        statusId:
          item?.statusId === null || item?.statusId === undefined
            ? null
            : Number(item.statusId || 0),
        dataInicio: item?.dataInicio ? String(item.dataInicio) : null,
        filaDesde: item?.filaDesde ? String(item.filaDesde) : null,
        dataFim: item?.dataFim ? String(item.dataFim) : null,
        ultimaAtualizacao: item?.ultimaAtualizacao ? String(item.ultimaAtualizacao) : null,
        ultimaMensagemClienteEm: item?.ultimaMensagemClienteEm
          ? String(item.ultimaMensagemClienteEm)
          : null,
        janelaMetaExpiraEm: item?.janelaMetaExpiraEm ? String(item.janelaMetaExpiraEm) : null,
        janelaMetaAberta: Boolean(item?.janelaMetaAberta),
        filaMais24h: Boolean(item?.filaMais24h),
        atendenteNome: item?.atendenteNome ? String(item.atendenteNome) : null,
        usuarioAtribuidoNome: item?.usuarioAtribuidoNome
          ? String(item.usuarioAtribuidoNome)
          : null,
        metaNumeroConta: item?.metaNumeroConta ? String(item.metaNumeroConta) : "",
        metaNomeConta: item?.metaNomeConta ? String(item.metaNomeConta) : "",
        funilNome: item?.funilNome ? String(item.funilNome) : "Sem funil",
        aguardandoRespostaTemplate: Boolean(item?.aguardandoRespostaTemplate),
        totalMensagens: Number(item?.totalMensagens || 0),
        totalMensagensCliente: Number(item?.totalMensagensCliente || 0),
        totalMensagensUsuario: Number(item?.totalMensagensUsuario || 0),
        mensagens: Array.isArray(item?.mensagens)
          ? item.mensagens.map((message) => ({
              id: Number(message?.id || 0),
              mensagemWhatsId: message?.mensagemWhatsId
                ? String(message.mensagemWhatsId)
                : null,
              mensagem: message?.mensagem ? String(message.mensagem) : "",
              dataMensagem: message?.dataMensagem ? String(message.dataMensagem) : null,
              sendBy:
                message?.sendBy === null || message?.sendBy === undefined
                  ? null
                  : Number(message.sendBy || 0),
              autor: message?.autor ? String(message.autor) : "Sistema",
              mediaType: message?.mediaType ? String(message.mediaType) : null,
              apagada: Boolean(message?.apagada),
              status: message?.status ? String(message.status) : null,
            }))
          : [],
        ultimaMensagem: item?.ultimaMensagem ? String(item.ultimaMensagem) : null,
        ultimaMensagemSendBy:
          item?.ultimaMensagemSendBy === null || item?.ultimaMensagemSendBy === undefined
            ? null
            : Number(item.ultimaMensagemSendBy || 0),
        ultimaMensagemAutor: item?.ultimaMensagemAutor
          ? String(item.ultimaMensagemAutor)
          : "Sistema",
      }))
    : [];
}

export async function getCommercialCustomerHistory(dealId: string): Promise<CustomerProfile> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CustomerProfile>("/crm_historico_cliente", {
    empresa_id: session.empresaId,
    negocio_id: Number(dealId),
  });
  return obj;
}

export async function registerCommercialInteraction(
  payload: RegisterCommercialInteractionInput
): Promise<{ id?: string }> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<{ id?: string }>("/crm_registrar_interacao", {
    empresa_id: session.empresaId,
    negocio_id: Number(payload.dealId),
    type: payload.type,
    category: payload.category || "interacao",
    description: payload.description,
    date: payload.date || undefined,
    endDate: payload.endDate || undefined,
    isCurrent: payload.isCurrent ?? false,
    value: payload.value,
    durationSeconds: payload.durationSeconds,
  });
  dispatchCommercialDataChanged();
  return obj || {};
}

export async function getCommercialCalendarAppointments(params: {
  crmId: number;
  dateStart: string;
  dateEnd: string;
  ownerId?: string;
}): Promise<CommercialAppointment[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialAppointment[]>("/crm_agendamentos_calendario", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    permissions: session.permissions,
    crm_id: params.crmId,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    ownerId: params.ownerId || undefined,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function getCommercialScheduledDispatches(): Promise<CommercialScheduledDispatch[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialScheduledDispatch[]>("/crm_agendamentos_disparo", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
  });
  return Array.isArray(obj) ? obj.map(normalizeCommercialScheduledDispatch) : [];
}

export async function createCommercialScheduledDispatch(
  payload: CreateCommercialScheduledDispatchInput,
): Promise<CommercialScheduledDispatch> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialScheduledDispatch>(
    "/crm_agendamento_disparo_criar",
    {
      empresa_id: session.empresaId,
      usuario_id: session.userId,
      is_master: session.isCommercialMaster,
      meta_param_id: payload.metaParamId,
      template_name: payload.templateName,
      template_language: payload.templateLanguage || "pt_BR",
      audience_type: payload.audienceType,
      lista_transmissao_id: payload.listaTransmissaoId ?? undefined,
      crm_id: payload.crmId ?? undefined,
      etapa_id: payload.etapaId ?? undefined,
      scheduled_date: payload.scheduledDate,
      scheduled_hour:
        typeof payload.scheduledHour === "string"
          ? Number(String(payload.scheduledHour).split(":")[0] || 0)
          : payload.scheduledHour,
      header_media_type: payload.headerMediaType || null,
      header_media_url: payload.headerMediaUrl || null,
      header_parameters: payload.headerParameters || [],
      body_parameters: payload.bodyParameters || [],
      button_parameters: payload.buttonParameters || [],
    },
  );
  dispatchCommercialDataChanged();
  return normalizeCommercialScheduledDispatch(obj);
}

export async function cancelCommercialScheduledDispatch(
  scheduleId: number,
): Promise<CommercialScheduledDispatch> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<CommercialScheduledDispatch>(
    "/crm_agendamento_disparo_cancelar",
    {
      empresa_id: session.empresaId,
      usuario_id: session.userId,
      is_master: session.isCommercialMaster,
      agendamento_id: scheduleId,
    },
  );
  dispatchCommercialDataChanged();
  return normalizeCommercialScheduledDispatch(obj);
}

export async function finalizeCommercialInteraction(dealId: string): Promise<{ negocio_id?: number; closedAt?: string }> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<{ negocio_id?: number; interaction_id?: number; closedAt?: string }>("/crm_finalizar_interacao", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    interaction_id: Number(dealId),
  });
  dispatchCommercialDataChanged();
  return obj || {};
}

export async function createCommercialDeal(
  deal: Partial<Deal>,
  crmId?: number | null
): Promise<Deal> {
  const session = await getSessionContext();
  const requestPayload = {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    crm_id: crmId ?? undefined,
    ...deal,
    ownerId: deal.ownerId || String(session.userId),
    ownerName: deal.ownerName || session.userName,
  };

  console.log("[commercialService] createCommercialDeal payload", requestPayload);

  const { obj } = await postEncrypted<Deal>("/crm_criar_negocio", requestPayload);
  dispatchCommercialDataChanged();
  return normalizeDeal(obj);
}

export async function updateCommercialDeal(
  dealId: string,
  updates: Partial<Deal>,
  crmId?: number | null
): Promise<Deal> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<Deal>("/crm_editar_negocio", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    crm_id: crmId ?? undefined,
    negocio_id: Number(dealId),
    ...updates,
  });
  dispatchCommercialDataChanged();
  return normalizeDeal(obj);
}

export async function moveCommercialDeal(
  dealId: string,
  newStage: DealStage,
  newOrder: number,
  stageId?: number | null,
  crmId?: number | null
): Promise<void> {
  const session = await getSessionContext();
  await postEncrypted("/crm_mover_negocio", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
    crm_id: crmId ?? undefined,
    negocio_id: Number(dealId),
    etapa_id: stageId ?? undefined,
    newStage,
    nova_posicao: newOrder,
  });
  dispatchCommercialDataChanged();
}

export async function deleteCommercialDeal(dealId: string): Promise<void> {
  const session = await getSessionContext();
  await postEncrypted("/crm_deletar_negocio", {
    empresa_id: session.empresaId,
    negocio_id: Number(dealId),
    usuario_id: session.userId,
    is_master: session.isCommercialMaster,
  });
  dispatchCommercialDataChanged();
}

export async function deleteCommercialDealsByStage(
  stageId: number,
  crmId?: number | null
): Promise<{ deletedCount: number; negocioIds: number[] }> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<{ deletedCount?: number; negocioIds?: number[] }>(
    "/crm_deletar_negocios_coluna",
    {
      empresa_id: session.empresaId,
      usuario_id: session.userId,
      is_master: session.isCommercialMaster,
      crm_id: crmId ?? undefined,
      etapa_id: stageId,
    }
  );
  dispatchCommercialDataChanged();
  return {
    deletedCount: Number(obj?.deletedCount || 0),
    negocioIds: Array.isArray(obj?.negocioIds) ? obj.negocioIds.map((item) => Number(item)) : [],
  };
}
