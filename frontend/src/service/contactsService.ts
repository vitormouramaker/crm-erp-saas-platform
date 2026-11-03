import { API_BASE } from "../config/api";
import { encrypt, decrypt } from "../utils/cripto";
import type { MetaIntegrationAccount } from "./metaService";

export type ContactTagOption = {
  id: number;
  name: string;
};

export type BroadcastUtmFilters = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_id?: string;
};

export type BroadcastList = {
  id: number;
  empresa_id?: number | null;
  empresa_meta_param_id?: number | null;
  nome: string;
  descricao: string | null;
  tag_logic: "and" | "or";
  utm_filters: BroadcastUtmFilters;
  tags: ContactTagOption[];
  total_contatos: number;
  meta_display_phone_number?: string | null;
  meta_phone_number_id?: string | null;
  meta_verified_name?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type BroadcastListContact = {
  id: number;
  origem: string;
  added_at: string | null;
  cliente_id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  data_aniversario: string | null;
  data_cadastro: string | null;
};

type EncryptedResponse<T> = {
  boleano?: boolean;
  obj?: T;
  mensagem?: string;
  msg?: string;
};

async function postEncrypted<T>(endpoint: string, payload: Record<string, unknown>) {
  const encrypted = await encrypt(payload);
  const response = await fetch(`${API_BASE}/user${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: encrypted }),
  });

  const responseData = await response.json();
  const decrypted = (await decrypt(responseData.payload)) as EncryptedResponse<T>;

  if (!decrypted?.boleano) {
    throw new Error(
      String(decrypted?.mensagem || decrypted?.msg || "Nao foi possivel concluir a operacao.")
    );
  }

  return {
    obj: decrypted.obj as T,
    message: String(decrypted?.mensagem || decrypted?.msg || ""),
  };
}

function normalizeBroadcastList(raw: any): BroadcastList {
  return {
    id: Number(raw?.id || 0),
    empresa_id: Number(raw?.empresa_id || 0) || null,
    empresa_meta_param_id: Number(raw?.empresa_meta_param_id || 0) || null,
    nome: String(raw?.nome || ""),
    descricao: raw?.descricao ? String(raw.descricao) : null,
    tag_logic: String(raw?.tag_logic || "or").toLowerCase() === "and" ? "and" : "or",
    utm_filters:
      raw?.utm_filters && typeof raw.utm_filters === "object" ? raw.utm_filters : {},
    tags: Array.isArray(raw?.tags)
      ? raw.tags
          .map((tag: any) => ({
            id: Number(tag?.id || 0),
            name: String(tag?.name || ""),
          }))
          .filter((tag: ContactTagOption) => tag.id > 0 && tag.name)
      : [],
    total_contatos: Number(raw?.total_contatos || 0),
    meta_display_phone_number: raw?.meta_display_phone_number
      ? String(raw.meta_display_phone_number)
      : null,
    meta_phone_number_id: raw?.meta_phone_number_id
      ? String(raw.meta_phone_number_id)
      : null,
    meta_verified_name: raw?.meta_verified_name ? String(raw.meta_verified_name) : null,
    created_at: raw?.created_at ? String(raw.created_at) : null,
    updated_at: raw?.updated_at ? String(raw.updated_at) : null,
  };
}

function normalizeBroadcastListContact(raw: any): BroadcastListContact {
  return {
    id: Number(raw?.id || 0),
    origem: String(raw?.origem || "manual"),
    added_at: raw?.added_at ? String(raw.added_at) : null,
    cliente_id: Number(raw?.cliente_id || 0),
    nome: String(raw?.nome || "Contato"),
    telefone: raw?.telefone ? String(raw.telefone) : null,
    email: raw?.email ? String(raw.email) : null,
    data_aniversario: raw?.data_aniversario ? String(raw.data_aniversario) : null,
    data_cadastro: raw?.data_cadastro ? String(raw.data_cadastro) : null,
  };
}

export async function fetchBroadcastLists(
  empresaId: number,
  usuarioId: number,
  metaParamId?: number | null
): Promise<BroadcastList[]> {
  const { obj } = await postEncrypted<any[]>("/listar_listas_transmissao", {
    empresa_id: empresaId,
    usuario_id: usuarioId,
    meta_param_id: metaParamId || undefined,
  });
  return Array.isArray(obj) ? obj.map(normalizeBroadcastList) : [];
}

export async function createBroadcastList(payload: {
  empresaId: number;
  usuarioId: number;
  metaParamId: number;
  nome: string;
  descricao?: string;
}): Promise<BroadcastList> {
  const { obj } = await postEncrypted<any>("/criar_lista_transmissao", {
    empresa_id: payload.empresaId,
    usuario_id: payload.usuarioId,
    meta_param_id: payload.metaParamId,
    nome: payload.nome,
    descricao: payload.descricao || "",
  });
  return normalizeBroadcastList(obj);
}

export async function updateBroadcastList(payload: {
  empresaId: number;
  usuarioId: number;
  listaId: number;
  metaParamId: number;
  nome: string;
  descricao?: string;
  tagLogic: "and" | "or";
  tagIds: number[];
  utmFilters: BroadcastUtmFilters;
}): Promise<BroadcastList> {
  const { obj } = await postEncrypted<any>("/editar_lista_transmissao", {
    empresa_id: payload.empresaId,
    usuario_id: payload.usuarioId,
    lista_id: payload.listaId,
    meta_param_id: payload.metaParamId,
    nome: payload.nome,
    descricao: payload.descricao || "",
    tag_logic: payload.tagLogic,
    tag_ids: payload.tagIds,
    utm_filters: payload.utmFilters,
  });
  return normalizeBroadcastList(obj);
}

export async function deleteBroadcastList(
  empresaId: number,
  usuarioId: number,
  listaId: number
): Promise<void> {
  await postEncrypted("/deletar_lista_transmissao", {
    empresa_id: empresaId,
    usuario_id: usuarioId,
    lista_id: listaId,
  });
}

export async function fetchBroadcastListContacts(
  empresaId: number,
  usuarioId: number,
  listaId: number
): Promise<BroadcastListContact[]> {
  const { obj } = await postEncrypted<any[]>("/contatos_lista_transmissao", {
    empresa_id: empresaId,
    usuario_id: usuarioId,
    lista_id: listaId,
  });
  return Array.isArray(obj) ? obj.map(normalizeBroadcastListContact) : [];
}

export async function addContactToBroadcastList(payload: {
  empresaId: number;
  usuarioId: number;
  listaId: number;
  clienteId: number;
}): Promise<{ total_contatos: number }> {
  const { obj } = await postEncrypted<{ total_contatos?: number }>(
    "/adicionar_contato_lista_transmissao",
    {
      empresa_id: payload.empresaId,
      usuario_id: payload.usuarioId,
      lista_id: payload.listaId,
      cliente_id: payload.clienteId,
    }
  );
  return {
    total_contatos: Number(obj?.total_contatos || 0),
  };
}

export async function removeContactFromBroadcastList(payload: {
  empresaId: number;
  usuarioId: number;
  listaId: number;
  clienteId: number;
}): Promise<{ total_contatos: number }> {
  const { obj } = await postEncrypted<{ total_contatos?: number }>(
    "/remover_contato_lista_transmissao",
    {
      empresa_id: payload.empresaId,
      usuario_id: payload.usuarioId,
      lista_id: payload.listaId,
      cliente_id: payload.clienteId,
    }
  );
  return {
    total_contatos: Number(obj?.total_contatos || 0),
  };
}

export async function syncBroadcastList(payload: {
  empresaId: number;
  usuarioId: number;
  listaId: number;
}): Promise<{
  contatos_encontrados: number;
  contatos_adicionados: number;
  total_contatos: number;
}> {
  const { obj } = await postEncrypted<{
    contatos_encontrados?: number;
    contatos_adicionados?: number;
    total_contatos?: number;
  }>("/sincronizar_lista_transmissao", {
    empresa_id: payload.empresaId,
    usuario_id: payload.usuarioId,
    lista_id: payload.listaId,
  });

  return {
    contatos_encontrados: Number(obj?.contatos_encontrados || 0),
    contatos_adicionados: Number(obj?.contatos_adicionados || 0),
    total_contatos: Number(obj?.total_contatos || 0),
  };
}

export async function fetchBroadcastMetaNumbers(
  empresaId: number,
  usuarioId: number
): Promise<MetaIntegrationAccount[]> {
  const { obj } = await postEncrypted<MetaIntegrationAccount[]>(
    "/listar_numeros_meta_lista_transmissao",
    {
      empresa_id: empresaId,
      usuario_id: usuarioId,
    }
  );

  return Array.isArray(obj) ? obj : [];
}

export async function fetchContactTags(empresaId: number): Promise<ContactTagOption[]> {
  const encrypted = await encrypt({ empresa_id: empresaId });
  const response = await fetch(`${API_BASE}/user/lista_tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: encrypted }),
  });
  const responseData = await response.json();
  const decrypted = (await decrypt(responseData.payload)) as EncryptedResponse<any[]>;
  const tags = Array.isArray(decrypted?.obj) ? decrypted.obj : [];

  return tags
    .map((tag) => ({
      id: Number(tag?.id || 0),
      name: String(tag?.name || ""),
    }))
    .filter((tag) => tag.id > 0 && tag.name);
}

export async function searchContactTags(
  empresaId: number,
  pesquisa: string
): Promise<ContactTagOption[]> {
  const normalizedSearch = String(pesquisa || "").trim();
  if (!normalizedSearch) return [];

  const encrypted = await encrypt({ empresa_id: empresaId, pesquisa: normalizedSearch });
  const response = await fetch(`${API_BASE}/user/busca_tag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: encrypted }),
  });
  const responseData = await response.json();
  const decrypted = (await decrypt(responseData.payload)) as EncryptedResponse<any[]>;
  const tags = Array.isArray(decrypted?.obj) ? decrypted.obj : [];

  return tags
    .map((tag) => ({
      id: Number(tag?.id || 0),
      name: String(tag?.name || ""),
    }))
    .filter((tag) => tag.id > 0 && tag.name);
}
