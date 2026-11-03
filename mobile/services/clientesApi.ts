import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export interface ClienteTag {
  id: number;
  name: string;
}

export interface Cliente {
  id: number;
  cliente_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  origem: string | null;
  utms: any;
  data_cadastro: string | null;
  data_aniversario: string | null;
  last_contact: string | null;
  total_purchases: number;
  total_spent: number;
  average_ticket: number;
  total_whatsapp_attendances: number;
  crm_nome: string | null;
  crm_stage_name: string | null;
  crm_title: string | null;
  crm_responsible_name: string | null;
  tags: ClienteTag[];
}

export type ClienteFiltro = 'all' | 'birthday_5_days' | 'with_crm' | 'without_crm';

export interface ClienteFiltrosCompostos {
  utm: string;
  origem: string;
  tag_ids: number[];
  data_entrada_inicial: string;
  data_entrada_final: string;
}

export const EMPTY_FILTROS_COMPOSTOS: ClienteFiltrosCompostos = {
  utm: '',
  origem: '',
  tag_ids: [],
  data_entrada_inicial: '',
  data_entrada_final: '',
};

export interface ClientePage {
  items: Cliente[];
  total: number;
  pagina: number;
  limite: number;
  total_paginas: number;
}

export async function getClientes(
  user: User,
  params: {
    pagina: number;
    limite: number;
    busca?: string;
    filtro?: ClienteFiltro;
    filtros_compostos?: ClienteFiltrosCompostos;
  }
): Promise<ClientePage> {
  const { obj } = await postEncrypted<ClientePage>('/user', '/lista_clientes', {
    empresa_id: user.empresa_id,
    pagina: params.pagina,
    limite: params.limite,
    busca: params.busca || '',
    filtro: params.filtro || 'all',
    filtros_compostos: params.filtros_compostos || EMPTY_FILTROS_COMPOSTOS,
  });
  return {
    items: Array.isArray(obj?.items) ? obj.items : [],
    total: Number(obj?.total || 0),
    pagina: Number(obj?.pagina || params.pagina),
    limite: Number(obj?.limite || params.limite),
    total_paginas: Number(obj?.total_paginas || 0),
  };
}

export interface ClientePayload {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  data_aniversario: string | null;
  origem: string;
}

export async function criarCliente(user: User, payload: ClientePayload): Promise<void> {
  await postEncrypted('/user', '/criar_cliente', {
    empresa_id: user.empresa_id,
    ...payload,
  });
}

export async function alterarCliente(clienteId: number, payload: ClientePayload): Promise<void> {
  await postEncrypted('/user', '/alterar_cliente', {
    cliente_id: clienteId,
    nome: payload.nome,
    email: payload.email,
    cpf: payload.cpf,
    data_aniversario: payload.data_aniversario,
    origem: payload.origem,
  });
}

export async function removerCliente(clienteId: number): Promise<void> {
  await postEncrypted('/user', '/remover_cliente', { cliente_id: clienteId });
}

export interface ImportarClientesRow {
  linha: number;
  nome: string;
  telefone: string;
  email: string;
  data_aniversario: string;
  tags: string[];
}

export interface ImportarClientesErro {
  linha: number;
  mensagem: string;
}

export interface ImportarClientesResultado {
  total: number;
  criados: number;
  atualizados: number;
  tags_adicionadas: number;
  ignorados: number;
  erros: ImportarClientesErro[];
}

export async function importarClientes(
  user: User,
  rows: ImportarClientesRow[]
): Promise<ImportarClientesResultado> {
  const { obj } = await postEncrypted<ImportarClientesResultado>('/user', '/importar_clientes', {
    empresa_id: user.empresa_id,
    rows,
  });
  return obj;
}

export interface ListaTransmissao {
  id: number;
  empresa_meta_param_id: number | null;
  nome: string;
  descricao: string | null;
  tag_logic: string | null;
  utm_filters: any;
  created_at: string | null;
  meta_display_phone_number: string | null;
  meta_verified_name: string | null;
  total_contatos: number;
  tags: ClienteTag[];
}

export interface ListaContato {
  id: number;
  origem: string | null;
  added_at: string | null;
  cliente_id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  data_aniversario?: string | null;
  data_cadastro?: string | null;
}

export async function getListasTransmissao(user: User, metaParamId?: number): Promise<ListaTransmissao[]> {
  const { obj } = await postEncrypted<ListaTransmissao[]>('/user', '/listar_listas_transmissao', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    meta_param_id: metaParamId ?? null,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function criarListaTransmissao(
  user: User,
  params: { meta_param_id: number; nome: string; descricao: string }
): Promise<void> {
  await postEncrypted('/user', '/criar_lista_transmissao', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    ...params,
  });
}

export interface ListaTransmissaoUtmFilters {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_id?: string;
}

export async function editarListaTransmissao(
  user: User,
  params: {
    lista_id: number;
    meta_param_id: number | null;
    nome: string;
    descricao: string;
    tag_logic?: 'or' | 'and';
    tag_ids?: number[];
    utm_filters?: ListaTransmissaoUtmFilters;
  }
): Promise<void> {
  await postEncrypted('/user', '/editar_lista_transmissao', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    ...params,
  });
}

export async function deletarListaTransmissao(user: User, listaId: number): Promise<void> {
  await postEncrypted('/user', '/deletar_lista_transmissao', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    lista_id: listaId,
  });
}

export async function getContatosLista(user: User, listaId: number): Promise<ListaContato[]> {
  const { obj } = await postEncrypted<ListaContato[]>('/user', '/contatos_lista_transmissao', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    lista_id: listaId,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function adicionarContatoLista(user: User, listaId: number, clienteId: number): Promise<void> {
  await postEncrypted('/user', '/adicionar_contato_lista_transmissao', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    lista_id: listaId,
    cliente_id: clienteId,
  });
}

export async function removerContatoLista(user: User, listaId: number, clienteId: number): Promise<void> {
  await postEncrypted('/user', '/remover_contato_lista_transmissao', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    lista_id: listaId,
    cliente_id: clienteId,
  });
}

export async function sincronizarLista(user: User, listaId: number): Promise<string> {
  const { message } = await postEncrypted('/user', '/sincronizar_lista_transmissao', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    lista_id: listaId,
  });
  return message;
}

export async function getTags(user: User): Promise<ClienteTag[]> {
  try {
    const { obj } = await postEncrypted<ClienteTag[]>('/user', '/lista_tags', {
      empresa_id: user.empresa_id,
    });
    return Array.isArray(obj) ? obj : [];
  } catch (err: any) {
    // Back responde boleano=false com "Nenhuma tag registrada!" quando vazio
    if (String(err?.message || '').toLowerCase().includes('nenhuma tag')) {
      return [];
    }
    throw err;
  }
}

export async function criarTag(user: User, nome: string): Promise<ClienteTag> {
  const { obj } = await postEncrypted<ClienteTag>('/user', '/criar_tag', {
    nome,
    empresa_id: user.empresa_id,
  });
  return obj;
}

export async function alterarTag(tagId: number, nome: string): Promise<void> {
  await postEncrypted('/user', '/alterar_tag', { tag_id: tagId, nome });
}

export async function deletarTag(tagId: number): Promise<void> {
  await postEncrypted('/user', '/deletar_tag', { tag_id: tagId });
}
