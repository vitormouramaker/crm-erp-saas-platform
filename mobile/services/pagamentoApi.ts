import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export interface AssinaturaAtual {
  id: number;
  empresa_id: number;
  assinatura_id: number | null;
  ativo: boolean;
  validade: string | null;
  request_unsubscribe: boolean;
  has_pdv: boolean;
  plano_nome: string | null;
  billing_cycle: 'monthly' | 'yearly' | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  stripe_current_period_end: string | null;
  stripe_cancel_at_period_end: boolean;
  max_user: number | null;
  max_filial: number | null;
}

export interface HistoricoPagamento {
  id: number;
  plano_nome: string | null;
  status: string;
  valor_total: number;
  moeda: string;
  paid: boolean;
  paid_at: string | null;
  due_date: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  descricao: string | null;
  created_at: string;
}

export async function getAssinaturaAtual(user: User): Promise<AssinaturaAtual | null> {
  const { obj } = await postEncrypted<{ assinatura: AssinaturaAtual | null }>(
    '/pagamento',
    '/get_assinatura',
    { email: user.email }
  );
  return obj?.assinatura || null;
}

export async function listarHistoricoPagamentos(
  user: User,
  limit = 30
): Promise<HistoricoPagamento[]> {
  const { obj } = await postEncrypted<HistoricoPagamento[]>('/pagamento', '/historico_pagamentos', {
    email: user.email,
    limit,
  });
  return Array.isArray(obj) ? obj : [];
}

