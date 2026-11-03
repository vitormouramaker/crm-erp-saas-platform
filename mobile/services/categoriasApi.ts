import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export interface Categoria {
  id: number;
  name: string;
}

export async function getCategorias(user: User): Promise<Categoria[]> {
  const { obj } = await postEncrypted<Categoria[]>('/user', '/listar_categoria', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function criarCategoria(user: User, name: string): Promise<Categoria> {
  const { obj } = await postEncrypted<Categoria>('/user', '/cadastro_categoria', {
    name,
    empresa_id: user.empresa_id,
  });
  return obj;
}

export async function alterarCategoria(id: number, name: string): Promise<void> {
  await postEncrypted('/user', '/editar_categoria', { id, name });
}

export async function deletarCategoria(id: number): Promise<void> {
  await postEncrypted('/user', '/deletar_categoria', { id });
}
