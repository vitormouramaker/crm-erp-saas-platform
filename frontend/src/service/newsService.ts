import { API_BASE } from "../config/api";
import { decrypt, encrypt } from "../utils/cripto";

export type NewsType = "feature" | "improvement" | "fix" | "warning" | "notice";

export type NewsItem = {
  id: number;
  empresaId: number;
  title: string;
  summary: string;
  content: string;
  mediaUrl: string;
  mediaType: "image" | "video" | null;
  type: NewsType;
  featured: boolean;
  highlightModal: boolean;
  onlyMaster: boolean;
  active: boolean;
  read: boolean;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  viewedAt: string | null;
  readAt: string | null;
  highlightDismissedAt: string | null;
};

export type NewsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
};

export type NewsListResponse = {
  items: NewsItem[];
  unreadCount: number;
  highlight: NewsItem | null;
  pagination: NewsPagination;
};

export type ManageNewsInput = {
  id?: number;
  empresaId: number;
  usuarioId: number;
  title: string;
  summary?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | null;
  type: NewsType;
  featured: boolean;
  highlightModal: boolean;
  onlyMaster?: boolean;
  publishedAt?: string | null;
};

type ApiRawResponse = {
  payload?: string;
  boleano?: boolean;
  mensagem?: string;
  obj?: any;
  success?: boolean;
  message?: string;
  data?: any;
};

type ApiBody = {
  boleano?: boolean;
  mensagem?: string;
  obj?: any;
};

async function parseApiPayload(raw: ApiRawResponse): Promise<ApiBody> {
  if (raw?.payload) {
    const decoded = await decrypt(raw.payload);
    if (decoded) {
      return decoded as ApiBody;
    }
  }

  return {
    boleano: raw?.boleano ?? raw?.success ?? false,
    mensagem: raw?.mensagem ?? raw?.message ?? "",
    obj: raw?.obj ?? raw?.data,
  };
}

function normalizeNewsType(value: unknown): NewsType {
  const normalized = String(value || "notice").trim().toLowerCase();
  if (
    normalized === "feature" ||
    normalized === "improvement" ||
    normalized === "fix" ||
    normalized === "warning"
  ) {
    return normalized;
  }
  return "notice";
}

function normalizeNewsItem(data: any): NewsItem {
  return {
    id: Number(data?.id || 0),
    empresaId: Number(data?.empresa_id || 0),
    title: String(data?.titulo || ""),
    summary: String(data?.resumo || ""),
    content: String(data?.conteudo || ""),
    mediaUrl: String(data?.media_url || ""),
    mediaType:
      data?.media_type === "image" || data?.media_type === "video"
        ? data.media_type
        : null,
    type: normalizeNewsType(data?.tipo),
    featured: Boolean(data?.destaque),
    highlightModal: Boolean(data?.modal_destaque),
    onlyMaster: Boolean(data?.apenas_master),
    active: data?.ativo === undefined ? true : Boolean(data?.ativo),
    read: Boolean(data?.lida),
    publishedAt: data?.data_publicacao ? String(data.data_publicacao) : null,
    createdAt: data?.created_at ? String(data.created_at) : null,
    updatedAt: data?.updated_at ? String(data.updated_at) : null,
    viewedAt: data?.visualizado_em ? String(data.visualizado_em) : null,
    readAt: data?.lida_em ? String(data.lida_em) : null,
    highlightDismissedAt: data?.modal_dispensado_em
      ? String(data.modal_dispensado_em)
      : null,
  };
}

async function postEncrypted<T = any>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
  const encrypted = await encrypt(payload);
  const response = await fetch(`${API_BASE}/novidades${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: encrypted }),
  });

  const raw = (await response.json()) as ApiRawResponse;
  const body = await parseApiPayload(raw);

  if (!response.ok || !body?.boleano) {
    throw new Error(body?.mensagem || "Nao foi possivel processar a solicitacao de novidades.");
  }

  return body.obj as T;
}

export async function listNews(params: {
  empresaId: number;
  usuarioId: number;
  page?: number;
  limit?: number;
  onlyUnread?: boolean;
  includeHighlight?: boolean;
}): Promise<NewsListResponse> {
  const obj = await postEncrypted<any>("/listar", {
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    only_unread: params.onlyUnread ?? false,
    include_highlight: params.includeHighlight ?? true,
  });

  return {
    items: Array.isArray(obj?.items) ? obj.items.map(normalizeNewsItem) : [],
    unreadCount: Number(obj?.unread_count || 0),
    highlight: obj?.highlight ? normalizeNewsItem(obj.highlight) : null,
    pagination: {
      page: Number(obj?.pagination?.page || 1),
      limit: Number(obj?.pagination?.limit || 20),
      total: Number(obj?.pagination?.total || 0),
      totalPages: Number(obj?.pagination?.total_pages || 1),
      hasNext: Boolean(obj?.pagination?.has_next),
    },
  };
}

export async function markNewsViewed(params: {
  empresaId: number;
  usuarioId: number;
  newsId: number;
}): Promise<void> {
  await postEncrypted("/visualizar", {
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
    novidade_id: params.newsId,
  });
}

export async function markNewsRead(params: {
  empresaId: number;
  usuarioId: number;
  newsId: number;
}): Promise<void> {
  await postEncrypted("/marcar_lida", {
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
    novidade_id: params.newsId,
  });
}

export async function markAllNewsRead(params: {
  empresaId: number;
  usuarioId: number;
}): Promise<{ total: number }> {
  return postEncrypted<{ total: number }>("/marcar_todas_lidas", {
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
  });
}

export async function dismissNewsHighlight(params: {
  empresaId: number;
  usuarioId: number;
  newsId: number;
}): Promise<void> {
  await postEncrypted("/dispensar_destaque", {
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
    novidade_id: params.newsId,
  });
}

export async function listManageNews(params: {
  empresaId: number;
  usuarioId: number;
  limit?: number;
}): Promise<NewsItem[]> {
  const obj = await postEncrypted<any[]>("/gerenciar_listar", {
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
    limit: params.limit ?? 100,
  });

  return Array.isArray(obj) ? obj.map(normalizeNewsItem) : [];
}

export async function createNews(params: ManageNewsInput): Promise<NewsItem> {
  const obj = await postEncrypted<any>("/criar", {
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
    titulo: params.title,
    resumo: params.summary || "",
    conteudo: params.content,
    media_url: params.mediaUrl || "",
    media_type: params.mediaType || null,
    tipo: params.type,
    destaque: params.featured,
    modal_destaque: params.highlightModal,
    apenas_master: params.onlyMaster ?? false,
    data_publicacao: params.publishedAt || null,
  });

  return normalizeNewsItem(obj);
}

export async function updateNews(params: ManageNewsInput): Promise<NewsItem> {
  const obj = await postEncrypted<any>("/editar", {
    id: params.id,
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
    titulo: params.title,
    resumo: params.summary || "",
    conteudo: params.content,
    media_url: params.mediaUrl || "",
    media_type: params.mediaType || null,
    tipo: params.type,
    destaque: params.featured,
    modal_destaque: params.highlightModal,
    apenas_master: params.onlyMaster ?? false,
    data_publicacao: params.publishedAt || null,
  });

  return normalizeNewsItem(obj);
}

export async function archiveNews(params: {
  id: number;
  empresaId: number;
  usuarioId: number;
}): Promise<NewsItem> {
  const obj = await postEncrypted<any>("/inativar", {
    id: params.id,
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
  });

  return normalizeNewsItem(obj);
}
