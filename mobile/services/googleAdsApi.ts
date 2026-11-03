import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export interface GoogleAdsLinkedAccount {
  id: number;
  empresa_id: number;
  customer_id: string;
  customer_name: string | null;
  currency_code: string | null;
  time_zone: string | null;
  status: string | null;
  manager: boolean;
  test_account: boolean;
  resource_name: string | null;
  login_customer_id: string | null;
  token_expires_at: string | null;
  last_oauth_at: string | null;
}

export interface GoogleAdsMetricsSummary {
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
}

export interface GoogleAdsAccountSummary extends GoogleAdsLinkedAccount {
  summary: GoogleAdsMetricsSummary;
  total_campaigns: number;
  total_ad_groups: number;
  total_keywords: number;
}

export interface GoogleAdsCampaign extends GoogleAdsMetricsSummary {
  customer_id: string;
  customer_name: string | null;
  currency_code: string | null;
  time_zone: string | null;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string | null;
  channel_type: string | null;
  channel_sub_type: string | null;
}

export interface GoogleAdsWarning {
  customer_id: string;
  message: string;
}

export interface GoogleAdsMetricsFilters {
  customer_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface GoogleAdsMetrics {
  period: { start_date: string; end_date: string };
  linked_accounts: GoogleAdsLinkedAccount[];
  account_summaries: GoogleAdsAccountSummary[];
  campaigns: GoogleAdsCampaign[];
  ad_groups: any[];
  keywords: any[];
  daily_performance: any[];
  summary: GoogleAdsMetricsSummary;
  warnings: GoogleAdsWarning[];
  total_accounts: number;
  total_campaigns: number;
  total_ad_groups: number;
  total_keywords: number;
  total_daily_rows: number;
}

export async function getGoogleAdsContas(user: User): Promise<GoogleAdsLinkedAccount[]> {
  const { obj } = await postEncrypted<GoogleAdsLinkedAccount[]>('/google_ads', '/listar_contas', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export interface GoogleAdsIntegrationStatus {
  conectado: boolean;
  pronto_para_uso: boolean;
  total_contas: number;
  contas: GoogleAdsLinkedAccount[];
}

export async function getGoogleAdsStatusIntegracao(user: User): Promise<GoogleAdsIntegrationStatus> {
  const { obj } = await postEncrypted<GoogleAdsIntegrationStatus>('/google_ads', '/status_integracao', {
    empresa_id: user.empresa_id,
  });
  return {
    conectado: Boolean(obj?.conectado),
    pronto_para_uso: Boolean(obj?.pronto_para_uso),
    total_contas: Number(obj?.total_contas || 0),
    contas: Array.isArray(obj?.contas) ? obj.contas : [],
  };
}

export async function removerContaGoogleAds(user: User, customerId: string): Promise<void> {
  await postEncrypted('/google_ads', '/remover_conta', {
    empresa_id: user.empresa_id,
    customer_id: customerId,
  });
}

export async function getGoogleAdsMetricas(
  user: User,
  filters: GoogleAdsMetricsFilters = {}
): Promise<GoogleAdsMetrics> {
  const { obj } = await postEncrypted<GoogleAdsMetrics>('/google_ads', '/metricas', {
    empresa_id: user.empresa_id,
    ...filters,
  });
  return obj;
}
