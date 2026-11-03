import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export interface TransacaoPdv {
  pdv_id: number;
  data_hora: string;
  valor_total: number;
  desconto_valor: number;
  desconto_percentual: number;
  forma_pagamento: string | null;
  status: 'Pago' | 'Pendente' | 'Cancelado' | string;
  valor_recebido: number | null;
  troco: number | null;
  nome_caixa: string | null;
  numero_caixa: string | null;
}

export async function listarTransacoesPdv(user: User): Promise<TransacaoPdv[]> {
  const { obj } = await postEncrypted<TransacaoPdv[]>('/user', '/listar_transacoes_pdv', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}
