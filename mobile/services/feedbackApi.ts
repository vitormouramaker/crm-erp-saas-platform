import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export type FeedbackTipo = 'support' | 'suggestion';

// POST /web/enviar_feedback: o back manda o e-mail para o contato de suporte.
export async function enviarFeedback(
  user: User,
  tipo: FeedbackTipo,
  assunto: string,
  mensagem: string
): Promise<string> {
  const { message } = await postEncrypted('/web', '/enviar_feedback', {
    tipo,
    assunto: assunto.trim(),
    mensagem: mensagem.trim(),
    email_usuario: user.email || '',
    usuario_id: user.id,
    empresa_id: user.empresa_id,
  });
  return message;
}
