import { postEncrypted } from './apiClient';
import type { User } from '@/types';

// Contrato com o back em docs/pendencias-back.md. As rotas ainda não existem no
// back: enquanto isso, as chamadas falham e a UI mostra a mensagem de erro.

export type MotivoDenuncia =
  | 'spam'
  | 'assedio'
  | 'conteudo_ofensivo'
  | 'conteudo_sexual'
  | 'golpe'
  | 'outro';

export const MOTIVOS_DENUNCIA: { value: MotivoDenuncia; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'assedio', label: 'Assédio ou ameaça' },
  { value: 'conteudo_ofensivo', label: 'Conteúdo ofensivo' },
  { value: 'conteudo_sexual', label: 'Conteúdo sexual' },
  { value: 'golpe', label: 'Golpe ou fraude' },
  { value: 'outro', label: 'Outro' },
];

export interface ClienteBloqueado {
  cliente_id: number;
  nome: string | null;
  telefone: string | null;
  bloqueado_em: string | null;
}

export async function bloquearCliente(
  user: User,
  clienteId: number,
  conversaId: number
): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/bloquear_cliente', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
    cliente_id: clienteId,
    conversa_id: conversaId,
  });
  return message;
}

export async function desbloquearCliente(user: User, clienteId: number): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/desbloquear_cliente', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
    cliente_id: clienteId,
  });
  return message;
}

export async function listarClientesBloqueados(user: User): Promise<ClienteBloqueado[]> {
  const { obj } = await postEncrypted<ClienteBloqueado[] | { items: ClienteBloqueado[] }>(
    '/atendimento',
    '/listar_clientes_bloqueados',
    {
      usuario_id: user.id,
      empresa_id: user.empresa_id,
    }
  );
  if (Array.isArray(obj)) return obj;
  return Array.isArray(obj?.items) ? obj.items : [];
}

export interface DenunciaParams {
  conversaId: number;
  clienteId: number;
  // Ausente = denúncia do contato; presente = denúncia da mensagem.
  mensagemId?: number;
  motivo: MotivoDenuncia;
  descricao?: string;
}

export async function denunciar(user: User, params: DenunciaParams): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/denunciar', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
    conversa_id: params.conversaId,
    cliente_id: params.clienteId,
    mensagem_id: params.mensagemId ?? null,
    motivo: params.motivo,
    descricao: params.descricao?.trim() || null,
  });
  return message;
}

export async function apagarMensagem(
  user: User,
  conversaId: number,
  mensagemId: number
): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/apagar_mensagem', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
    conversa_id: conversaId,
    mensagem_id: mensagemId,
  });
  return message;
}
