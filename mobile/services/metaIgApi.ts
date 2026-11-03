import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export interface InstagramAccountSummary {
  id: number;
  empresa_id: number;
  business_id: string | null;
  business_name: string | null;
  page_id: string | null;
  page_name: string | null;
  instagram_business_account_id: string;
  instagram_username: string | null;
  instagram_name: string | null;
  instagram_profile_picture_url: string | null;
  graph_api_version: string | null;
  token_expires_at: string | null;
  last_embedded_signup_at: string | null;
}

export interface InstagramIntegrationStatus {
  conectado: boolean;
  pronto_para_uso: boolean;
  total_contas: number;
  contas: InstagramAccountSummary[];
}

export async function getInstagramStatusIntegracao(user: User): Promise<InstagramIntegrationStatus> {
  const { obj } = await postEncrypted<InstagramIntegrationStatus>('/meta_ig', '/status_integracao', {
    empresa_id: user.empresa_id,
  });
  return obj;
}
