import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export type NovidadeTipoConhecido = 'feature' | 'improvement' | 'fix' | 'warning' | 'notice' | 'novidade';
// back normaliza pra esses via API, mas rows inseridas por SQL seed trazem string livre
export type NovidadeTipo = NovidadeTipoConhecido | (string & {});
export type NovidadeMediaType = 'image' | 'video';

export interface Novidade {
  id: number;
  empresa_id: number;
  titulo: string;
  resumo: string;
  conteudo: string;
  media_url: string;
  media_type: NovidadeMediaType | null;
  tipo: NovidadeTipo;
  destaque: boolean;
  modal_destaque: boolean;
  apenas_master: boolean;
  ativo: boolean;
  lida: boolean;
  data_publicacao: string | null;
  created_at: string | null;
  updated_at: string | null;
  visualizado_em: string | null;
  lida_em: string | null;
  modal_dispensado_em: string | null;
  criado_por_usuario_id: number | null;
  atualizado_por_usuario_id: number | null;
}

export interface NovidadesPaginacao {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
}

export interface NovidadesListagem {
  items: Novidade[];
  unread_count: number;
  highlight: Novidade | null;
  pagination: NovidadesPaginacao;
}

export interface ListarNovidadesParams {
  page?: number;
  limit?: number;
  onlyUnread?: boolean;
  includeHighlight?: boolean;
}

function authFields(user: User) {
  return {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    is_master: user.is_master,
  };
}

export async function listarNovidades(
  user: User,
  { page = 1, limit = 20, onlyUnread = false, includeHighlight = true }: ListarNovidadesParams = {}
): Promise<NovidadesListagem> {
  const { obj } = await postEncrypted<NovidadesListagem>('/novidades', '/listar', {
    ...authFields(user),
    page,
    limit,
    only_unread: onlyUnread,
    include_highlight: includeHighlight,
  });

  return {
    items: Array.isArray(obj?.items) ? obj.items : [],
    unread_count: Number(obj?.unread_count || 0),
    highlight: obj?.highlight ?? null,
    pagination: obj?.pagination ?? {
      page,
      limit,
      total: 0,
      total_pages: 1,
      has_next: false,
    },
  };
}

export async function registrarVisualizacaoNovidade(user: User, novidadeId: number): Promise<void> {
  await postEncrypted('/novidades', '/visualizar', {
    ...authFields(user),
    novidade_id: novidadeId,
  });
}

export async function marcarNovidadeLida(user: User, novidadeId: number): Promise<void> {
  await postEncrypted('/novidades', '/marcar_lida', {
    ...authFields(user),
    novidade_id: novidadeId,
  });
}

export async function marcarTodasNovidadesLidas(user: User): Promise<number> {
  const { obj } = await postEncrypted<{ total: number }>('/novidades', '/marcar_todas_lidas', {
    ...authFields(user),
  });
  return Number(obj?.total || 0);
}

export async function dispensarDestaqueNovidade(user: User, novidadeId: number): Promise<void> {
  await postEncrypted('/novidades', '/dispensar_destaque', {
    ...authFields(user),
    novidade_id: novidadeId,
  });
}
