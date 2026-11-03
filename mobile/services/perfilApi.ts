import { postEncrypted, postEncryptedMultipart, type RNFile } from './apiClient';
import type { User } from '@/types';

export interface MeuPerfil {
  id: number;
  empresa_id: number;
  name: string;
  email: string;
  telefone: string | null;
  foto_perfil_url: string | null;
  foto_perfil_path_bunny: string | null;
  foto_perfil_nome_arquivo: string | null;
  foto_perfil_mime_type: string | null;
  foto_perfil_tamanho_bytes: number | null;
}

export async function getMeuPerfil(user: User): Promise<MeuPerfil> {
  const { obj } = await postEncrypted<MeuPerfil>('/user', '/meu_perfil', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
  });
  return obj;
}

export interface SalvarMeuPerfilPayload {
  name: string;
  email: string;
  telefone: string;
}

export async function salvarMeuPerfil(user: User, payload: SalvarMeuPerfilPayload): Promise<User> {
  const { obj } = await postEncrypted<User>('/user', '/salvar_meu_perfil', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
    ...payload,
  });
  return obj;
}

export async function alterarMinhaSenha(
  user: User,
  currentPassword: string,
  newPassword: string
): Promise<User> {
  const { obj } = await postEncrypted<User>('/user', '/alterar_minha_senha', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
    current_password: currentPassword,
    new_password: newPassword,
  });
  return obj;
}

// Exclusão definitiva (exigida pelas lojas). Rota ainda a ser criada no back —
// contrato em docs/exclusao-de-conta.md.
export async function excluirMinhaConta(user: User, currentPassword: string): Promise<void> {
  await postEncrypted('/user', '/excluir_minha_conta', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
    current_password: currentPassword,
  });
}

export async function uploadMinhaFotoPerfil(user: User, file: RNFile): Promise<User> {
  const { obj } = await postEncryptedMultipart<User>(
    '/user',
    '/upload_minha_foto_perfil',
    { usuario_id: user.id, empresa_id: user.empresa_id },
    { file }
  );
  return obj;
}

export async function removerMinhaFotoPerfil(user: User): Promise<User> {
  const { obj } = await postEncrypted<User>('/user', '/remover_minha_foto_perfil', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
  });
  return obj;
}
