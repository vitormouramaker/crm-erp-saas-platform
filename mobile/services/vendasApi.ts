import { postEncrypted, postEncryptedMultipart, type RNFile } from './apiClient';
import type { MetaAccount } from './metaApi';
import type { User } from '@/types';

export interface Crm {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  master: boolean;
  filial_id: number | null;
  filial_nome: string | null;
  meta_numeros: MetaAccount[];
  acesso_restrito?: boolean;
  usuarios_vinculados?: CrmResponsavel[];
  [key: string]: any;
}

export interface CrmEtapa {
  id: number;
  crm_id: number;
  codigo: string;
  nome: string;
  ordem: number;
  cor: string | null;
  eh_inicial: boolean;
  eh_fechamento: boolean;
  eh_ganho: boolean;
  ativo: boolean;
}

export interface CrmResponsavel {
  id: number;
  nome: string;
}

export interface CrmTag {
  id: number;
  nome: string;
  cor: string | null;
}

export interface CrmProduto {
  id: number;
  nome: string;
  descricao: string | null;
  preco_base: number;
  ativo: boolean;
}

export interface CrmFilial {
  id: number;
  nome: string;
  primaria: boolean;
  ativo: boolean;
}

export interface CrmDominios {
  crm_id: number;
  etapas: CrmEtapa[];
  responsaveis: CrmResponsavel[];
  produtos: CrmProduto[];
  tags: CrmTag[];
  filiais: CrmFilial[];
  meta_numeros: MetaAccount[];
  meta_numeros_vinculados: MetaAccount[];
  usuarios_vinculados: CrmResponsavel[];
  acesso_restrito: boolean;
  filial_id: number | null;
  filial_nome: string | null;
  [key: string]: any;
}

export interface NegocioQuoteItem {
  id: number;
  comercialProdutoId?: number;
  name: string;
  quantity: number;
  price: number;
  status: string | null;
}

export interface Negocio {
  id: string;
  crm_id?: number;
  title: string;
  amount: number;
  companyName: string | null;
  contactName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  stage: string;
  probability: number;
  createdAt: string | null;
  entryDate: string | null;
  closingDate: string | null;
  ownerId: string;
  ownerName: string;
  temperature: string | null;
  tags: string[];
  products: NegocioQuoteItem[];
  hasOpenInteraction: boolean;
  hasScheduledInteractionToday: boolean;
  saleOrigin: string | null;
  paymentMethod: string | null;
  saleDate: string | null;
  [key: string]: any;
}

export async function getCrms(user: User): Promise<Crm[]> {
  const { obj } = await postEncrypted<Crm[]>('/vendas', '/crm_crms', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function createCrm(
  user: User,
  params: {
    nome: string;
    descricao?: string;
    filialId?: number;
    metaParamIds?: number[];
    assignedUserIds?: number[];
  }
): Promise<Crm> {
  const { obj } = await postEncrypted<Crm>('/vendas', '/crm_criar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    nome: params.nome,
    descricao: params.descricao,
    filial_id: params.filialId,
    meta_param_ids: params.metaParamIds,
    usuarios_vinculados_ids: params.assignedUserIds,
  });
  return obj;
}

export async function editCrm(
  user: User,
  params: {
    crmId: number;
    nome?: string;
    descricao?: string;
    filialId?: number | null;
    metaParamIds?: number[];
    assignedUserIds?: number[];
    ativo?: boolean;
  }
): Promise<Crm> {
  const { obj } = await postEncrypted<Crm>('/vendas', '/crm_editar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: params.crmId,
    nome: params.nome,
    descricao: params.descricao,
    filial_id: params.filialId,
    meta_param_ids: params.metaParamIds,
    usuarios_vinculados_ids: params.assignedUserIds,
    ativo: params.ativo,
  });
  return obj;
}

export async function getCrmDominios(user: User, crmId: number): Promise<CrmDominios> {
  const { obj } = await postEncrypted<CrmDominios>('/vendas', '/crm_dominios', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: crmId,
  });
  return obj;
}

export async function criarColunaCrm(
  user: User,
  params: { crmId: number; nome: string; cor?: string; ordem?: number }
): Promise<CrmEtapa> {
  const { obj } = await postEncrypted<CrmEtapa>('/vendas', '/crm_coluna_criar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: params.crmId,
    nome: params.nome,
    cor: params.cor,
    ordem: params.ordem,
  });
  return obj;
}

export async function editarColunaCrm(
  user: User,
  params: { crmId: number; etapaId: number; nome?: string; cor?: string }
): Promise<CrmEtapa> {
  const { obj } = await postEncrypted<CrmEtapa>('/vendas', '/crm_coluna_editar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: params.crmId,
    etapa_id: params.etapaId,
    nome: params.nome,
    cor: params.cor,
  });
  return obj;
}

export async function reordenarColunasCrm(
  user: User,
  params: { crmId: number; etapaIds: number[] }
): Promise<CrmEtapa[]> {
  const { obj } = await postEncrypted<CrmEtapa[]>('/vendas', '/crm_coluna_reordenar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: params.crmId,
    etapa_ids: params.etapaIds,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function deletarColunaCrm(
  user: User,
  params: { crmId: number; etapaId: number }
): Promise<CrmEtapa[]> {
  const { obj } = await postEncrypted<CrmEtapa[]>('/vendas', '/crm_coluna_deletar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: params.crmId,
    etapa_id: params.etapaId,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function getNegocios(user: User, crmId: number): Promise<Negocio[]> {
  const { obj } = await postEncrypted<Negocio[]>('/vendas', '/crm_negocios', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: crmId,
    skip_meta_ads_schema_ensure: true,
  });
  return Array.isArray(obj) ? obj : [];
}

export interface NegociosFiltro {
  stage?: string;
  ownerId?: number;
  tag?: string;
  search?: string;
  dateStart?: string;
  dateEnd?: string;
}

export interface NegociosPagina {
  items: Negocio[];
  total: number;
  pagina: number;
  limite: number;
  total_paginas: number;
  total_valor: number;
}

/**
 * Listagem paginada por etapa do funil. O back (`/crm_negocios` modo `paginado`)
 * aplica LIMIT/OFFSET antes das subconsultas pesadas, então trazer 20 cards por
 * coluna é ordens de grandeza mais barato que a listagem completa.
 */
export async function getNegociosPaginados(
  user: User,
  crmId: number,
  params: NegociosFiltro & { pagina: number; limite: number }
): Promise<NegociosPagina> {
  const t0 = Date.now();
  const { obj } = await postEncrypted<any>('/vendas', '/crm_negocios', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: crmId,
    skip_meta_ads_schema_ensure: true,
    paginado: true,
    pagina: params.pagina,
    limite: params.limite,
    stage: params.stage,
    ownerId: params.ownerId,
    tag: params.tag,
    search: params.search,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
  });
  const paginado = !Array.isArray(obj) && Array.isArray(obj?.items);
  if (__DEV__) {
    // Diagnóstico: se `paginado=false` o back de produção não tem o modo
    // paginado e está devolvendo o funil inteiro (causa do delay de ~25s).
    console.log(
      `[crm_negocios] etapa=${params.stage ?? '-'} pág=${params.pagina} ` +
        `${Date.now() - t0}ms paginado=${paginado} ` +
        `recebidos=${Array.isArray(obj) ? obj.length : obj?.items?.length ?? 0} ` +
        `total=${obj?.total ?? '-'}`
    );
  }
  return {
    items: paginado ? obj.items : Array.isArray(obj) ? obj : [],
    total: Number(obj?.total || (Array.isArray(obj) ? obj.length : 0)),
    pagina: Number(obj?.pagina || params.pagina),
    limite: Number(obj?.limite || params.limite),
    total_paginas: Number(obj?.total_paginas || (Array.isArray(obj) ? 1 : 0)),
    total_valor: Number(obj?.total_valor || 0),
  };
}

export async function createNegocio(
  user: User,
  params: {
    crmId: number;
    etapaId?: number;
    contactName: string;
    companyName?: string;
    customerPhone: string;
    customerEmail?: string;
    customerDocument?: string;
    amount?: number;
    temperature?: string;
    ownerId?: number;
    saleNotes?: string;
    products?: { name: string; quantity: number; price: number; comercialProdutoId?: number }[];
  }
): Promise<Negocio> {
  const { obj } = await postEncrypted<Negocio>('/vendas', '/crm_criar_negocio', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: params.crmId,
    etapa_id: params.etapaId,
    contactName: params.contactName,
    companyName: params.companyName,
    customerPhone: params.customerPhone,
    customerEmail: params.customerEmail,
    customerDocument: params.customerDocument,
    amount: params.amount,
    temperature: params.temperature,
    ownerId: params.ownerId,
    saleNotes: params.saleNotes,
    products: params.products,
  });
  return obj;
}

export async function editNegocio(
  user: User,
  params: {
    negocioId: string;
    crmId: number;
    etapaId?: number;
    contactName: string;
    companyName?: string;
    customerPhone: string;
    customerEmail?: string;
    customerDocument?: string;
    amount?: number;
    temperature?: string;
    ownerId?: number;
    saleNotes?: string;
    products?: { name: string; quantity: number; price: number; comercialProdutoId?: number }[];
  }
): Promise<Negocio> {
  const { obj } = await postEncrypted<Negocio>('/vendas', '/crm_editar_negocio', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    negocio_id: params.negocioId,
    crm_id: params.crmId,
    etapa_id: params.etapaId,
    contactName: params.contactName,
    companyName: params.companyName,
    customerPhone: params.customerPhone,
    customerEmail: params.customerEmail,
    customerDocument: params.customerDocument,
    amount: params.amount,
    temperature: params.temperature,
    ownerId: params.ownerId,
    saleNotes: params.saleNotes,
    products: params.products,
  });
  return obj;
}

export async function deleteNegocio(user: User, negocioId: string): Promise<void> {
  await postEncrypted('/vendas', '/crm_deletar_negocio', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    negocio_id: negocioId,
  });
}

export interface NegociosFechadosResult {
  items: Negocio[];
  total: number;
  pagina: number;
  limite: number;
  total_paginas: number;
}

export async function getNegociosFechados(
  user: User,
  params: {
    crmId: number;
    ownerId?: number;
    stage?: string;
    search?: string;
    dateStart?: string;
    dateEnd?: string;
    pagina?: number;
    limite?: number;
  }
): Promise<NegociosFechadosResult> {
  const { obj } = await postEncrypted<NegociosFechadosResult>('/vendas', '/crm_negocios_fechados', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: params.crmId,
    ownerId: params.ownerId,
    stage: params.stage,
    search: params.search,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    pagina: params.pagina,
    limite: params.limite,
  });
  return obj;
}

export interface CrmInteracao {
  id: string;
  type: string;
  category: string;
  typeName: string | null;
  date: string | null;
  endDate?: string;
  description: string;
  attendantName: string;
  duration: string;
  value?: number;
  isCurrent: boolean;
}

export interface CrmHistoricoItem {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string | null;
  attendantName: string;
  interactionId?: string;
}

export interface CrmHistoricoCliente {
  id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  entryDate: string | null;
  totalPurchases: number;
  totalSpent: number;
  averageTicket: number;
  lastInteraction: string | null;
  interactions: CrmInteracao[];
  appointments: CrmInteracao[];
  history: CrmHistoricoItem[];
}

export async function getHistoricoCliente(user: User, negocioId: string): Promise<CrmHistoricoCliente> {
  const { obj } = await postEncrypted<CrmHistoricoCliente>('/vendas', '/crm_historico_cliente', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    negocio_id: negocioId,
  });
  return obj;
}

export async function registrarInteracao(
  user: User,
  params: {
    negocioId: string;
    type: string;
    description?: string;
    date?: string;
    category?: 'interacao' | 'agendamento';
  }
): Promise<{ id: string }> {
  const { obj } = await postEncrypted<{ id: string }>('/vendas', '/crm_registrar_interacao', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    negocio_id: params.negocioId,
    type: params.type,
    description: params.description,
    date: params.date,
    category: params.category,
  });
  return obj;
}

export async function moveNegocio(
  user: User,
  params: { crmId: number; negocioId: string; etapaId: number }
): Promise<void> {
  await postEncrypted('/vendas', '/crm_mover_negocio', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: params.crmId,
    negocio_id: params.negocioId,
    etapa_id: params.etapaId,
  });
}

export interface Agendamento {
  id: string;
  dealId: string | null;
  dealTitle: string;
  customerName: string;
  customerPhone: string;
  ownerName: string;
  type: string;
  typeName: string;
  category: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
}

export async function getAgendamentos(
  user: User,
  params: { crmId: number; dateStart: string; dateEnd: string; ownerId?: number }
): Promise<Agendamento[]> {
  const { obj } = await postEncrypted<Agendamento[]>('/vendas', '/crm_agendamentos_calendario', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: params.crmId,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    ownerId: params.ownerId,
  });
  return Array.isArray(obj) ? obj : [];
}

export type ScheduledDispatchAudienceType = 'lista_transmissao' | 'crm';

export interface ScheduledDispatch {
  id: number;
  empresa_id: number;
  usuario_id: number | null;
  usuario_nome: string | null;
  empresa_meta_param_id: number | null;
  display_phone_number: string | null;
  verified_name: string | null;
  template_name: string;
  template_language: string;
  audience_type: ScheduledDispatchAudienceType;
  lista_transmissao_id: number | null;
  lista_nome: string | null;
  crm_id: number | null;
  crm_nome: string | null;
  etapa_id: number | null;
  etapa_nome: string | null;
  scheduled_date: string | null;
  scheduled_hour: number;
  scheduled_time: string;
  header_media_type: string | null;
  header_media_url: string | null;
  header_parameters: any[];
  body_parameters: any[];
  button_parameters: any[];
  status: string;
  total_recipients: number;
  processed_recipients: number;
  sent_recipients: number;
  error_recipients: number;
  last_error_message: string | null;
  created_at: string | null;
}

export async function getScheduledDispatches(user: User): Promise<ScheduledDispatch[]> {
  const { obj } = await postEncrypted<ScheduledDispatch[]>('/vendas', '/crm_agendamentos_disparo', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function createScheduledDispatch(
  user: User,
  params: {
    empresaMetaParamId: number;
    templateName: string;
    templateLanguage: string;
    audienceType: ScheduledDispatchAudienceType;
    listaTransmissaoId?: number;
    crmId?: number;
    etapaId?: number;
    scheduledDate: string;
    scheduledHour: number;
    headerMediaType?: string | null;
    headerMediaUrl?: string | null;
    headerParameters?: any[];
    bodyParameters?: any[];
    buttonParameters?: any[];
  }
): Promise<ScheduledDispatch> {
  const { obj } = await postEncrypted<ScheduledDispatch>('/vendas', '/crm_agendamento_disparo_criar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    empresa_meta_param_id: params.empresaMetaParamId,
    template_name: params.templateName,
    template_language: params.templateLanguage,
    audience_type: params.audienceType,
    lista_transmissao_id: params.listaTransmissaoId,
    crm_id: params.crmId,
    etapa_id: params.etapaId,
    scheduled_date: params.scheduledDate,
    scheduled_hour: params.scheduledHour,
    header_media_type: params.headerMediaType,
    header_media_url: params.headerMediaUrl,
    header_parameters: params.headerParameters || [],
    body_parameters: params.bodyParameters || [],
    button_parameters: params.buttonParameters || [],
  });
  return obj;
}

export async function cancelScheduledDispatch(user: User, scheduleId: number): Promise<ScheduledDispatch> {
  const { obj } = await postEncrypted<ScheduledDispatch>('/vendas', '/crm_agendamento_disparo_cancelar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    id: scheduleId,
  });
  return obj;
}

export interface CrmLossRadarReason {
  code: string;
  label: string;
  count: number;
  value: number;
}

export interface CrmLossRadarProduct {
  name: string;
  quantity: number;
  value: number;
}

export interface CrmLossRadarSeller {
  name: string;
  count: number;
  value: number;
}

export interface CrmLossRadar {
  totalLostRevenue: number;
  fullLostRevenue: number;
  partialLostRevenue: number;
  lostDealsCount: number;
  partialLossDealsCount: number;
  topReasons: CrmLossRadarReason[];
  topProducts: CrmLossRadarProduct[];
  topSellers: CrmLossRadarSeller[];
}

export interface CrmMonthlyRevenuePoint {
  month: string;
  value: number;
}

export interface CrmStageMetric {
  stage: string;
  count: number;
  value: number;
}

export interface CrmDocumentsByAttendant {
  usuario_id: number | null;
  usuario_nome: string | null;
  total_documentos: number;
  total_clientes: number;
}

export interface CrmDashboardOverview {
  leadsReceived: number;
  firstResponseAverageSeconds: number;
  contactedLeads: number;
  totalContacts: number;
  contactsPerLead: number;
  pendingFollowUps: number;
  pendingFollowUpsPercent: number;
  salesCount: number;
  revenue: number;
}

export interface CrmDashboardOriginBreakdown {
  origin: string;
  count: number;
  percent: number;
}

export interface CrmDashboardPeriodPoint {
  key: string;
  label: string;
  count: number;
}

export interface CrmDashboardAgingBucket {
  key: string;
  label: string;
  count: number;
  percent: number;
}

export interface CrmDashboardLeadsNew {
  total: number;
  percentOfTotal: number;
  byDay: CrmDashboardPeriodPoint[];
  byOrigin: CrmDashboardOriginBreakdown[];
}

export interface CrmDashboardLeadsInProgress {
  total: number;
  percentOfActive: number;
  byOrigin: CrmDashboardOriginBreakdown[];
  agingBuckets: CrmDashboardAgingBucket[];
}

export interface CrmDashboardServiceVelocity {
  totalLeads: number;
  contactedLeads: number;
  leadsWithoutResponse: number;
  respondedWithin5Min: number;
  respondedWithin15Min: number;
  respondedAfter15Min: number;
  averageFirstResponseSeconds: number;
  responseRate: number;
  leadsWithoutResponsePercent: number;
}

export interface CrmDashboardContactBucket {
  key: string;
  label: string;
  leadsCount: number;
  leadsPercent: number;
  totalContacts: number;
}

export interface CrmDashboardContactCadence {
  totalContacts: number;
  averageContactsPerLead: number;
  leadsWithoutContact: number;
  leadsWithoutContactPercent: number;
  buckets: CrmDashboardContactBucket[];
}

export interface CrmDashboardFunnelItem {
  id: number;
  code: string;
  name: string;
  color: string | null;
  count: number;
  percentOfTotal: number;
  percentFromPrevious: number;
  isClosing: boolean;
  isWon: boolean;
}

export interface CrmDashboardFunnel {
  totalLeads: number;
  overallConversionRate: number;
  items: CrmDashboardFunnelItem[];
}

export interface CrmDashboardSellerPerformance {
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
}

export interface CrmDashboardLeadOrigins {
  total: number;
  items: CrmDashboardOriginBreakdown[];
}

export interface CrmDashboardArrivalPoint {
  key: string;
  label: string;
  count: number;
  percent: number;
}

export interface CrmDashboardLeadArrivalPatterns {
  weekdays: CrmDashboardArrivalPoint[];
  hours: CrmDashboardArrivalPoint[];
}

export interface CrmDashboardUnattendedLeads {
  total: number;
  percent: number;
  totalLeads: number;
}

export interface CrmDashboard {
  overview: CrmDashboardOverview;
  leadsNew: CrmDashboardLeadsNew;
  leadsInProgress: CrmDashboardLeadsInProgress;
  serviceVelocity: CrmDashboardServiceVelocity;
  contactCadence: CrmDashboardContactCadence;
  funnel: CrmDashboardFunnel;
  sellerPerformance: CrmDashboardSellerPerformance[];
  leadOrigins: CrmDashboardLeadOrigins;
  leadArrivalPatterns: CrmDashboardLeadArrivalPatterns;
  unattendedLeads: CrmDashboardUnattendedLeads;
  totalPipelineValue: number;
  activeDealsCount: number;
  wonQuotesValue: number;
  winRate: number;
  averageTicket: number;
  lostAmount: number;
  monthlyRevenue: CrmMonthlyRevenuePoint[];
  dealsByStage: CrmStageMetric[];
  lossRadar: CrmLossRadar;
  customerDocumentsCount: number;
  documentsByAttendant: CrmDocumentsByAttendant[];
}

export async function getDashboardCrm(
  user: User,
  params: {
    crmId: number;
    dateStart?: string;
    dateEnd?: string;
    ownerId?: number;
    search?: string;
    filialId?: number;
  }
): Promise<CrmDashboard> {
  const { obj } = await postEncrypted<CrmDashboard>('/vendas', '/crm_dashboard', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: params.crmId,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    ownerId: params.ownerId,
    search: params.search,
    filial_id: params.filialId,
  });
  return obj;
}

export interface CrmReportMetrics {
  totalQuoteSales: number;
  quoteCount: number;
  avgQuoteTicket: number;
  activeSellers: number;
  totalLostRevenue: number;
  fullLostRevenue: number;
  partialLostRevenue: number;
  lostQuotesCount: number;
  partialLossDealsCount: number;
  customerDocumentsCount: number;
}

export interface CrmReportTopSeller {
  name: string;
  value: number;
}

export interface CrmReport {
  metrics: CrmReportMetrics;
  topSellers: CrmReportTopSeller[];
  topQuotedProducts: CrmLossRadarProduct[];
  lossRadar: CrmLossRadar;
  documentsByAttendant: CrmDocumentsByAttendant[];
  deals: Negocio[];
}

export async function getRelatorioCrm(
  user: User,
  params: {
    crmId: number;
    dateStart?: string;
    dateEnd?: string;
    ownerId?: number;
    search?: string;
    filialId?: number;
    product?: string;
  }
): Promise<CrmReport> {
  const { obj } = await postEncrypted<CrmReport>('/vendas', '/crm_relatorios', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    crm_id: params.crmId,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    ownerId: params.ownerId,
    search: params.search,
    filial_id: params.filialId,
    product: params.product,
  });
  return obj;
}

export interface CrmProdutoArquivo {
  id: number;
  url: string;
  path_bunny: string;
  nome_arquivo: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  ordem?: number | null;
  criado_em?: string;
}

export interface CrmProdutoDetalhado {
  id: number;
  nome: string;
  descricao: string | null;
  preco_base: number;
  ativo: boolean;
  criado_em?: string;
  imagens: CrmProdutoArquivo[];
  documento: CrmProdutoArquivo | null;
}

export async function getProdutosCrm(user: User): Promise<CrmProdutoDetalhado[]> {
  const { obj } = await postEncrypted<CrmProdutoDetalhado[]>('/vendas', '/crm_produtos', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function criarProdutoCrm(
  user: User,
  params: { nome: string; descricao?: string; precoBase: number }
): Promise<CrmProdutoDetalhado> {
  const { obj } = await postEncrypted<CrmProdutoDetalhado>('/vendas', '/crm_produto_criar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    nome: params.nome,
    descricao: params.descricao,
    preco_base: params.precoBase,
  });
  return obj;
}

export async function editarProdutoCrm(
  user: User,
  params: { produtoId: number; nome: string; descricao?: string; precoBase: number }
): Promise<CrmProdutoDetalhado> {
  const { obj } = await postEncrypted<CrmProdutoDetalhado>('/vendas', '/crm_produto_editar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    produto_id: params.produtoId,
    nome: params.nome,
    descricao: params.descricao,
    preco_base: params.precoBase,
  });
  return obj;
}

export async function deletarProdutoCrm(user: User, produtoId: number): Promise<void> {
  await postEncrypted('/vendas', '/crm_produto_deletar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    produto_id: produtoId,
  });
}

export async function uploadProdutoImagem(
  user: User,
  produtoId: number,
  file: RNFile
): Promise<CrmProdutoDetalhado> {
  const { obj } = await postEncryptedMultipart<CrmProdutoDetalhado>(
    '/vendas',
    '/crm_produto_upload_imagens',
    { empresa_id: user.empresa_id, usuario_id: user.id, is_master: user.is_master, produto_id: produtoId },
    { files: file }
  );
  return obj;
}

export async function deletarProdutoImagem(user: User, imagemId: number): Promise<CrmProdutoDetalhado> {
  const { obj } = await postEncrypted<CrmProdutoDetalhado>('/vendas', '/crm_produto_imagem_deletar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    imagem_id: imagemId,
  });
  return obj;
}

export async function uploadProdutoDocumento(
  user: User,
  produtoId: number,
  file: RNFile
): Promise<CrmProdutoDetalhado> {
  const { obj } = await postEncryptedMultipart<CrmProdutoDetalhado>(
    '/vendas',
    '/crm_produto_upload_documento',
    { empresa_id: user.empresa_id, usuario_id: user.id, is_master: user.is_master, produto_id: produtoId },
    { document: file }
  );
  return obj;
}

export async function deletarProdutoDocumento(user: User, documentoId: number): Promise<CrmProdutoDetalhado> {
  const { obj } = await postEncrypted<CrmProdutoDetalhado>('/vendas', '/crm_produto_documento_deletar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    documento_id: documentoId,
  });
  return obj;
}

export type VendaFonte = 'crm' | 'hotmart' | 'hubla' | 'importada';

const FONTE_LABELS: Record<VendaFonte, string> = {
  crm: 'CRM',
  hotmart: 'Hotmart',
  hubla: 'Hubla',
  importada: 'Importada',
};

export function fonteLabel(fonte: VendaFonte): string {
  return FONTE_LABELS[fonte] || fonte;
}

export interface VendaConsolidada {
  id: string;
  fonte: VendaFonte;
  vendaId: number;
  crmId: number | null;
  funilNome: string | null;
  clienteId: number | null;
  clienteNome: string;
  descricao: string;
  valor: number | null;
  origem: string | null;
  vendidoEm: string | null;
  vendedorId: number | null;
  vendedorNome: string | null;
  transacaoId: string | null;
  status: string | null;
}

export interface VendasConsolidadasResult {
  items: VendaConsolidada[];
  total: number;
  pagina: number;
  limite: number;
  total_paginas: number;
}

export async function getVendasConsolidadas(
  user: User,
  params: {
    search?: string;
    fonte?: VendaFonte;
    ownerId?: number;
    dateStart?: string;
    dateEnd?: string;
    pagina?: number;
    limite?: number;
  }
): Promise<VendasConsolidadasResult> {
  const { obj } = await postEncrypted<VendasConsolidadasResult>('/vendas', '/vendas_consolidadas', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    permissions: user.permissions,
    search: params.search,
    fonte: params.fonte,
    ownerId: params.ownerId,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    pagina: params.pagina,
    limite: params.limite,
  });
  return obj;
}

export async function editarVendaImportada(
  user: User,
  params: {
    vendaId: number;
    clienteNome: string;
    descricao?: string;
    vendidoEm: string;
    valor: number;
    origem?: string;
    vendedorId?: number | null;
  }
): Promise<any> {
  const { obj } = await postEncrypted<any>('/vendas', '/venda_importada_editar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    permissions: user.permissions,
    venda_id: params.vendaId,
    clienteNome: params.clienteNome,
    descricao: params.descricao,
    vendidoEm: params.vendidoEm,
    valor: params.valor,
    origem: params.origem,
    vendedorId: params.vendedorId ?? null,
  });
  return obj;
}

export async function atribuirVendedorVendaIntegracao(
  user: User,
  params: { vendaId: number; fonte: 'hotmart' | 'hubla'; vendedorId: number | null }
): Promise<any> {
  const { obj } = await postEncrypted<any>('/vendas', '/venda_integracao_atribuir_vendedor', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    permissions: user.permissions,
    venda_id: params.vendaId,
    fonte: params.fonte,
    vendedorId: params.vendedorId,
  });
  return obj;
}

export async function excluirVendaConsolidada(
  user: User,
  params: { vendaId: number; fonte: 'crm' | 'importada' }
): Promise<void> {
  await postEncrypted('/vendas', '/venda_consolidada_excluir', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    permissions: user.permissions,
    venda_id: params.vendaId,
    fonte: params.fonte,
  });
}

export interface ImportarVendasRow {
  cliente_nome: string;
  telefone?: string;
  email?: string;
  produto?: string;
  valor?: number;
  data_venda: string;
  origem?: string;
  observacoes?: string;
  vendedor_id?: number | null;
}

export interface ImportarVendasResult {
  imported: number;
  errors: { linha: number; mensagem: string }[];
}

export async function importarVendasConsolidadas(
  user: User,
  vendas: ImportarVendasRow[]
): Promise<ImportarVendasResult> {
  const { obj } = await postEncrypted<ImportarVendasResult>('/vendas', '/vendas_consolidadas_importar', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
    permissions: user.permissions,
    vendas: vendas.slice(0, 500),
  });
  return obj;
}
