import { API_BASE, authFetch } from './apiClient';
import { encrypt } from './security';
import type { User } from '@/types';

export interface WebhookConfig {
  empresaId: number;
  webhookPublicId: string;
  webhookUrl: string;
  webhookMetodo: string;
  webhookAtivo: boolean;
  webhookCodigoValidacao: string;
  n8nWebhookUrl: string;
  n8nWebhookMetodo: string;
  n8nWebhookSecretField: string;
  n8nWebhookHeaderValidacao: string;
}

export async function getWebhookConfig(user: User): Promise<WebhookConfig> {
  const encrypted = encrypt({ empresa_id: user.empresa_id });

  const response = await authFetch(`${API_BASE}/webhook/cliente/configuracao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: encrypted }),
  });

  const data = await response.json();
  if (!data?.success) {
    throw new Error(data?.message || 'Não foi possível carregar a configuração de integração.');
  }

  const obj = data.data || {};
  return {
    empresaId: Number(obj.empresa_id),
    webhookPublicId: String(obj.webhook_public_id || ''),
    webhookUrl: String(obj.webhook_url || ''),
    webhookMetodo: String(obj.webhook_metodo || 'POST'),
    webhookAtivo: Boolean(obj.webhook_ativo),
    webhookCodigoValidacao: String(obj.webhook_codigo_validacao || ''),
    n8nWebhookUrl: String(obj.n8n_webhook_url || ''),
    n8nWebhookMetodo: String(obj.n8n_webhook_metodo || 'POST'),
    n8nWebhookSecretField: String(obj.n8n_webhook_secret_field || ''),
    n8nWebhookHeaderValidacao: String(obj.n8n_webhook_header_validacao || ''),
  };
}
