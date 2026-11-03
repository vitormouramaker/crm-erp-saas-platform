import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export type WebhookSecurityLocation = 'header' | 'body' | 'query';

export interface DeveloperWebhookEvent {
  key: string;
  label: string;
  description: string;
  payload_example: Record<string, unknown>;
}

export interface DeveloperWebhook {
  id: number;
  empresa_id: number;
  nome: string;
  url: string;
  security_key: string;
  security_location: WebhookSecurityLocation;
  security_field_name: string;
  eventos: string[];
  ativo: boolean;
  criado_em: string | null;
  atualizado_em: string | null;
}

export interface DeveloperWebhookPayload {
  id?: number | null;
  nome: string;
  url: string;
  security_key: string;
  security_location: WebhookSecurityLocation;
  security_field_name: string;
  eventos: string[];
  ativo: boolean;
}

export async function listarDeveloperWebhooks(
  user: User
): Promise<{ webhooks: DeveloperWebhook[]; eventCatalog: DeveloperWebhookEvent[] }> {
  const { obj } = await postEncrypted<{ webhooks: DeveloperWebhook[]; event_catalog: DeveloperWebhookEvent[] }>(
    '/developer_webhooks',
    '/listar',
    { empresa_id: user.empresa_id }
  );

  return {
    webhooks: Array.isArray(obj?.webhooks) ? obj.webhooks : [],
    eventCatalog: Array.isArray(obj?.event_catalog) ? obj.event_catalog : [],
  };
}

export async function salvarDeveloperWebhook(
  user: User,
  payload: DeveloperWebhookPayload
): Promise<DeveloperWebhook> {
  const { obj } = await postEncrypted<DeveloperWebhook>('/developer_webhooks', '/salvar', {
    empresa_id: user.empresa_id,
    id: payload.id || null,
    nome: payload.nome,
    url: payload.url,
    security_key: payload.security_key,
    security_location: payload.security_location,
    security_field_name: payload.security_field_name,
    eventos: payload.eventos,
    ativo: payload.ativo,
  });
  return obj;
}

export async function deletarDeveloperWebhook(user: User, id: number): Promise<void> {
  await postEncrypted('/developer_webhooks', '/deletar', {
    empresa_id: user.empresa_id,
    id,
  });
}
