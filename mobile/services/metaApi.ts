import { postEncrypted, postEncryptedMultipart, type RNFile } from './apiClient';
import type { User } from '@/types';

export interface MetaAccount {
  id: number;
  display_phone_number: string | null;
  phone_number_id: string | null;
  verified_name: string | null;
  whatsapp_account_id: string | null;
  whatsapp_account_name: string | null;
  ativo: boolean;
}

export interface MetaBusinessIntegrationStatus {
  conectado: boolean;
  pronto_para_uso: boolean;
  campos_faltantes: string[];
  accounts: MetaAccount[];
}

export async function getMetaBusinessStatus(user: User): Promise<MetaBusinessIntegrationStatus> {
  const { obj } = await postEncrypted<MetaBusinessIntegrationStatus>('/meta', '/status_integracao', {
    empresa_id: user.empresa_id,
  });
  return {
    conectado: Boolean(obj?.conectado),
    pronto_para_uso: Boolean(obj?.pronto_para_uso),
    campos_faltantes: Array.isArray(obj?.campos_faltantes) ? obj.campos_faltantes : [],
    accounts: Array.isArray(obj?.accounts) ? obj.accounts : [],
  };
}

export async function getContasMeta(user: User): Promise<MetaAccount[]> {
  const status = await getMetaBusinessStatus(user);
  return status.accounts.filter((account) => account.ativo !== false);
}

export interface WhatsAppProfile {
  about: string;
  address: string;
  description: string;
  email: string;
  vertical: string;
  profile_picture_url: string;
  websites: string[];
  display_name: string;
  verified_name: string;
  display_phone_number: string;
  phone_number_id: string;
  whatsapp_account_id: string;
  meta_param_id: number | null;
}

export async function getWhatsAppProfile(
  user: User,
  metaParamId?: number
): Promise<WhatsAppProfile> {
  const { obj } = await postEncrypted<WhatsAppProfile>('/meta', '/perfil_whatsapp', {
    empresa_id: user.empresa_id,
    meta_param_id: metaParamId,
  });
  return obj;
}

export interface WhatsAppProfileUpdate {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  websites?: string[];
}

export async function atualizarWhatsAppProfile(
  user: User,
  metaParamId: number | undefined,
  data: WhatsAppProfileUpdate,
  profilePictureFile?: RNFile
): Promise<{ obj: any; message: string }> {
  const payload = {
    empresa_id: user.empresa_id,
    meta_param_id: metaParamId,
    ...data,
  };

  return profilePictureFile
    ? postEncryptedMultipart('/meta', '/atualizar_perfil_whatsapp', payload, {
        profile_picture_file: profilePictureFile,
      })
    : postEncrypted('/meta', '/atualizar_perfil_whatsapp', payload);
}

export interface MetaTemplateComponents {
  header: { type: string; text: string; parameter_indexes: number[]; examples: any[] } | null;
  body: { text: string; parameter_indexes: number[]; examples: any[] } | null;
  footer: { text: string } | null;
  buttons: any[];
}

export interface MetaTemplate {
  id?: string;
  name: string;
  language: string;
  status: string;
  category?: string;
  has_parameters?: boolean;
  parameters?: any[];
  components?: MetaTemplateComponents;
}

export function templateHasVariables(template: MetaTemplate): boolean {
  return !!template.has_parameters;
}

export type TemplateHeaderFormat = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export function getTemplateHeaderFormat(template: MetaTemplate): TemplateHeaderFormat | null {
  const format = String(template.components?.header?.type || '').toUpperCase();
  return format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT' ? format : null;
}

export async function getTemplates(user: User, metaParamId: number): Promise<MetaTemplate[]> {
  const { obj } = await postEncrypted<{ total: number; templates: MetaTemplate[] }>(
    '/meta',
    '/get_templates',
    {
      empresa_id: user.empresa_id,
      meta_param_id: metaParamId,
    }
  );
  return Array.isArray(obj?.templates) ? obj.templates : [];
}

export async function dispararTemplate(
  user: User,
  params: {
    template_name: string;
    language: string;
    numero: string;
    cliente_id: number;
    meta_param_id: number;
    contact_name?: string;
  },
  headerFile?: RNFile
): Promise<string> {
  const payload = {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    ...params,
  };

  if (headerFile) {
    const { message } = await postEncryptedMultipart('/meta', '/disparar_template', payload, {
      header_file: headerFile,
    });
    return message;
  }

  const { message } = await postEncrypted('/meta', '/disparar_template', payload);
  return message;
}

export interface DispatchBatchItem {
  numero?: string;
  cliente_id?: number;
  contato_nome?: string;
  email?: string;
  conversa_id?: number;
}

export interface DispatchBatchProgress {
  found: boolean;
  dispatch_history_id: number | null;
  template_id: string | null;
  template_name: string | null;
  template_category: string | null;
  lista_transmissao_id: number | null;
  total_items: number;
  processed_items: number;
  success_count: number;
  error_count: number;
  remaining_items: number;
  progress_percent: number;
  stopped_on_error: boolean;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number;
  status: string;
  metadata: Record<string, any>;
  cost_summary: any;
}

export async function dispararTemplateLote(
  user: User,
  params: {
    template_name: string;
    language: string;
    meta_param_id: number;
    items: DispatchBatchItem[];
    lista_id?: number;
    stop_on_error?: boolean;
  },
  headerFile?: RNFile
): Promise<{ clientBatchToken: string; progress: DispatchBatchProgress }> {
  const clientBatchToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    client_batch_token: clientBatchToken,
    ...params,
  };

  const { obj } = headerFile
    ? await postEncryptedMultipart<DispatchBatchProgress>(
        '/meta',
        '/disparar_template_lote',
        payload,
        { header_file: headerFile }
      )
    : await postEncrypted<DispatchBatchProgress>('/meta', '/disparar_template_lote', payload);

  return { clientBatchToken, progress: obj };
}

export async function statusDisparoLote(
  user: User,
  clientBatchToken: string
): Promise<DispatchBatchProgress> {
  const { obj } = await postEncrypted<DispatchBatchProgress>(
    '/meta',
    '/status_disparo_template_lote',
    {
      empresa_id: user.empresa_id,
      client_batch_token: clientBatchToken,
    }
  );
  return obj;
}

export interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: any[];
  example?: any;
}

export type TemplateMediaSampleType = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'NONE';

export interface CriarTemplateParams {
  name: string;
  category: string;
  language: string;
  components: TemplateComponent[];
  media_sample_type?: TemplateMediaSampleType;
  allow_category_change?: boolean;
  parameter_format?: string;
}

export async function criarTemplate(
  user: User,
  metaParamId: number,
  params: CriarTemplateParams,
  mediaSampleFile?: RNFile
): Promise<{ obj: any; message: string }> {
  const payload = {
    empresa_id: user.empresa_id,
    meta_param_id: metaParamId,
    usuario_id: user.id,
    ...params,
  };

  return mediaSampleFile
    ? postEncryptedMultipart('/meta', '/criar_template', payload, {
        media_sample_file: mediaSampleFile,
      })
    : postEncrypted('/meta', '/criar_template', payload);
}

export async function deletarTemplate(
  user: User,
  templateName: string,
  metaParamId?: number
): Promise<string> {
  const { message } = await postEncrypted('/meta', '/deletar_template', {
    empresa_id: user.empresa_id,
    meta_param_id: metaParamId,
    template_name: templateName,
  });
  return message;
}

export interface TemplateMetrics {
  filters: { template_id: string; start: number; end: number; granularity: string };
  metrics: any[];
  raw: any;
  insights_enabled?: boolean;
}

export async function metricasTemplate(
  user: User,
  templateId: string,
  metaParamId?: number,
  options: { start_date?: string; end_date?: string; granularity?: string } = {}
): Promise<TemplateMetrics> {
  const { obj } = await postEncrypted<TemplateMetrics>('/meta', '/metricas_template', {
    empresa_id: user.empresa_id,
    meta_param_id: metaParamId,
    template_id: templateId,
    ...options,
  });
  return obj;
}

export function summarizeTemplateMetrics(metrics: any[]): {
  sent: number;
  delivered: number;
  read: number;
} {
  let sent = 0;
  let delivered = 0;
  let read = 0;

  for (const entry of Array.isArray(metrics) ? metrics : []) {
    const points = Array.isArray(entry?.data_points) ? entry.data_points : [entry];
    for (const point of points) {
      sent += Number(point?.sent || 0);
      delivered += Number(point?.delivered || 0);
      read += Number(point?.read || 0);
    }
  }

  return { sent, delivered, read };
}

export interface DispatchCostSummary {
  total_cost: number;
  total_volume: number;
  cost_per_message: number;
}

export interface DispatchCostMetrics {
  filters: { start: number; end: number; granularity: string };
  summary: DispatchCostSummary;
  rows: any[];
  cost_source: string;
  message: string;
}

export async function metricasCustoDisparo(
  user: User,
  metaParamId?: number,
  options: { start_date?: string; end_date?: string; granularity?: string } = {}
): Promise<DispatchCostMetrics> {
  const { obj } = await postEncrypted<DispatchCostMetrics>('/meta', '/metricas_custo_disparo', {
    empresa_id: user.empresa_id,
    meta_param_id: metaParamId,
    ...options,
  });
  return obj;
}

export type DispatchReportType = 'all' | 'single' | 'list';
export type DispatchReportStatus = 'all' | 'processing' | 'completed' | 'stopped_on_error' | 'failed';

export interface DispatchReportItem {
  dispatch_history_id: number | null;
  empresa_meta_param_id: number | null;
  meta_numero_conta: string;
  meta_nome_conta: string;
  usuario_id: number | null;
  usuario_nome: string;
  template_id: string | null;
  template_name: string;
  template_language: string;
  template_category: string;
  lista_transmissao_id: number | null;
  lista_nome: string | null;
  lista_descricao: string | null;
  lista_total_contatos: number;
  total_clientes: number;
  processados: number;
  enviados: number;
  recebidos: number;
  recebidos_unicos: number;
  visualizados: number;
  respondidos: number;
  respondidos_unicos: number;
  erros: number;
  custo_unitario: number;
  valor_total: number;
  moeda: string;
  data_inicio: string | null;
  data_fim: string | null;
  duracao_ms: number;
  dispatch_type: 'single' | 'list' | string;
  status: string;
}

export interface DispatchReportSummary {
  total_disparos: number;
  total_clientes: number;
  total_enviados: number;
  total_recebidos: number;
  total_recebidos_unicos: number;
  total_visualizados: number;
  total_respondidos: number;
  total_respondidos_unicos: number;
  total_erros: number;
  total_custo: number;
}

export function buildDispatchReportSummary(items: DispatchReportItem[]): DispatchReportSummary {
  return items.reduce(
    (acc, item) => {
      acc.total_disparos += 1;
      acc.total_clientes += Number(item.total_clientes || 0);
      acc.total_enviados += Number(item.enviados || 0);
      acc.total_recebidos += Number(item.recebidos || 0);
      acc.total_recebidos_unicos += Number(item.recebidos_unicos || 0);
      acc.total_visualizados += Number(item.visualizados || 0);
      acc.total_respondidos += Number(item.respondidos || 0);
      acc.total_respondidos_unicos += Number(item.respondidos_unicos || 0);
      acc.total_erros += Number(item.erros || 0);
      acc.total_custo = Number((acc.total_custo + Number(item.valor_total || 0)).toFixed(6));
      return acc;
    },
    {
      total_disparos: 0,
      total_clientes: 0,
      total_enviados: 0,
      total_recebidos: 0,
      total_recebidos_unicos: 0,
      total_visualizados: 0,
      total_respondidos: 0,
      total_respondidos_unicos: 0,
      total_erros: 0,
      total_custo: 0,
    }
  );
}

export interface DispatchReportPagination {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
}

export interface DispatchReportResponse {
  summary: DispatchReportSummary;
  pagination: DispatchReportPagination;
  items: DispatchReportItem[];
}

export interface DispatchReportFilters {
  start_date?: string;
  end_date?: string;
  dispatch_type?: DispatchReportType;
  status?: DispatchReportStatus;
  meta_param_id?: number | null;
  usuario_filtro_id?: number | null;
  limit?: number;
  offset?: number;
}

export async function relatorioEnvios(
  user: User,
  filters: DispatchReportFilters = {}
): Promise<DispatchReportResponse> {
  const { obj } = await postEncrypted<DispatchReportResponse>('/meta', '/relatorio_envios', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    ...filters,
  });
  return {
    summary:
      obj?.summary ||
      buildDispatchReportSummary([]),
    pagination: obj?.pagination || {
      limit: filters.limit ?? 20,
      offset: filters.offset ?? 0,
      total: 0,
      has_more: false,
    },
    items: Array.isArray(obj?.items) ? obj.items : [],
  };
}

export interface DispatchReportDetailItem {
  item_id: number | null;
  dispatch_history_id: number | null;
  cliente_id: number | null;
  conversa_id: number | null;
  contato_nome: string | null;
  email: string | null;
  numero_original: string | null;
  numero_normalizado: string | null;
  message_id: string | null;
  message_status: string | null;
  sucesso: boolean;
  custo_unitario: number;
  valor_cobrado: number;
  enviado_em: string | null;
  recebido_em: string | null;
  erro_em: string | null;
  erro_mensagem: string | null;
  erro_codigo: number | string | null;
  erro_subcodigo: number | string | null;
  erro_tipo: string | null;
  respondido_em: string | null;
  recebido: boolean;
  visualizado: boolean;
  respondeu: boolean;
}

export interface DispatchReportDetail {
  dispatch: DispatchReportItem | null;
  items: DispatchReportDetailItem[];
}

export async function relatorioEnviosDetalhe(
  user: User,
  dispatchHistoryId: number
): Promise<DispatchReportDetail> {
  const { obj } = await postEncrypted<DispatchReportDetail>('/meta', '/relatorio_envios_detalhe', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    dispatch_history_id: dispatchHistoryId,
  });
  return {
    dispatch: obj?.dispatch || null,
    items: Array.isArray(obj?.items) ? obj.items : [],
  };
}
