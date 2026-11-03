import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export interface Crm {
  id: number;
  nome: string;
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

export interface MetaAdsAccount {
  id: number;
  meta_ad_account_id: string;
  meta_ad_account_name: string | null;
  meta_business_name: string | null;
  [key: string]: any;
}

export async function getMetaAdsContas(user: User): Promise<MetaAdsAccount[]> {
  const { obj } = await postEncrypted<MetaAdsAccount[]>('/meta_ads', '/listar_contas', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export interface MetaAdsAccountSummary {
  id: number;
  empresa_id: number;
  business_id: string | null;
  business_name: string | null;
  ad_account_id: string;
  ad_account_name: string | null;
  ad_account_status: string | null;
  currency: string | null;
  timezone_id: string | null;
  timezone_name: string | null;
  account_id: string | null;
  disable_reason: string | null;
  graph_api_version: string | null;
  token_expires_at: string | null;
  last_embedded_signup_at: string | null;
}

export interface MetaAdsIntegrationStatus {
  conectado: boolean;
  pronto_para_uso: boolean;
  total_contas: number;
  contas: MetaAdsAccountSummary[];
}

export async function getMetaAdsStatusIntegracao(user: User): Promise<MetaAdsIntegrationStatus> {
  const { obj } = await postEncrypted<MetaAdsIntegrationStatus>('/meta_ads', '/status_integracao', {
    empresa_id: user.empresa_id,
  });
  return obj;
}

export interface MetaLeadForm {
  id: string;
  name: string;
  status?: string;
  leads_count?: number;
  [key: string]: any;
}

export async function getMetaAdsFormularios(user: User, adAccountId: string): Promise<MetaLeadForm[]> {
  const { obj } = await postEncrypted<MetaLeadForm[]>('/meta_ads', '/formularios', {
    empresa_id: user.empresa_id,
    ad_account_id: adAccountId,
  });
  return Array.isArray(obj) ? obj : [];
}

export interface MetaLead {
  id: string;
  created_time: string | null;
  form_id: string | null;
  form_name: string | null;
  campaign_name: string | null;
  is_organic: boolean;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  empresa: string | null;
  cidade: string | null;
  estado: string | null;
  cargo: string | null;
  fields: { key: string; label: string; value: string }[];
  imported: boolean;
  imported_cliente_id: number | null;
  imported_at: string | null;
  [key: string]: any;
}

export async function getMetaAdsLeads(
  user: User,
  params: { ad_account_id: string; form_id: string; form_name?: string; limit?: number }
): Promise<MetaLead[]> {
  const { obj } = await postEncrypted<MetaLead[]>('/meta_ads', '/formularios/leads', {
    empresa_id: user.empresa_id,
    ad_account_id: params.ad_account_id,
    form_id: params.form_id,
    form_name: params.form_name || null,
    limit: params.limit || 200,
  });
  return Array.isArray(obj) ? obj : [];
}

export interface FieldMapping {
  escopo_tipo: 'form' | 'campaign';
  escopo_id: string;
  escopo_nome: string | null;
  campo_nome: string | null;
  campo_telefone: string | null;
  campo_email: string | null;
  [key: string]: any;
}

export async function getFieldMapping(
  user: User,
  params: { escopo_tipo: 'form' | 'campaign'; escopo_id: string }
): Promise<FieldMapping | null> {
  const { obj } = await postEncrypted<FieldMapping | null>('/meta_ads', '/mapeamento_campos', {
    empresa_id: user.empresa_id,
    escopo_tipo: params.escopo_tipo,
    escopo_id: params.escopo_id,
  });
  return obj || null;
}

export async function saveFieldMapping(
  user: User,
  params: {
    escopo_tipo: 'form' | 'campaign';
    escopo_id: string;
    escopo_nome: string | null;
    campo_nome: string | null;
    campo_telefone: string | null;
    campo_email: string | null;
  }
): Promise<FieldMapping | null> {
  const { obj } = await postEncrypted<FieldMapping | null>('/meta_ads', '/salvar_mapeamento_campos', {
    empresa_id: user.empresa_id,
    ...params,
  });
  return obj || null;
}

export interface ImportResult {
  total: number;
  criados: number;
  atualizados: number;
  ignorados: number;
  negocios_criados: number;
  erros: any[];
}

export async function importarLeads(
  user: User,
  params: {
    ad_account_id: string;
    crm_id: number | null;
    form_id: string;
    form_name: string | null;
    leads: MetaLead[];
  }
): Promise<ImportResult> {
  const { obj } = await postEncrypted<ImportResult>('/meta_ads', '/importar_leads', {
    empresa_id: user.empresa_id,
    ...params,
  });
  return obj;
}
