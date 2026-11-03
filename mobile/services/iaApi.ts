import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export async function getPromptIA(user: User): Promise<string> {
  const { obj } = await postEncrypted<{ prompt_ia_atendimento: string }>(
    '/user',
    '/get_prompt_ia_atendimento',
    { empresa_id: user.empresa_id }
  );
  return obj?.prompt_ia_atendimento || '';
}

export async function salvarPromptIA(user: User, prompt: string): Promise<string> {
  const { obj } = await postEncrypted<{ prompt_ia_atendimento: string }>(
    '/user',
    '/salvar_prompt_ia_atendimento',
    { empresa_id: user.empresa_id, prompt_ia_atendimento: prompt }
  );
  return obj?.prompt_ia_atendimento || '';
}
