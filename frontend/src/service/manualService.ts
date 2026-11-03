import { API_BASE } from "../config/api";
import { MANUAL_ARTICLES, MANUAL_MODULES } from "../data/manualSeed";
import type { User } from "../contexts/AuthContext";
import type { ManualArticle, ManualArticleInput, ManualModule } from "../types/manual";
import { decrypt, encrypt } from "../utils/cripto";

const STORAGE_KEY = "orbita.manual.articles.v1";

type ManualApiPayload = {
  payload?: string;
  boleano?: boolean;
  mensagem?: string;
  obj?: unknown;
};

type ManualUserContext = Pick<
  User,
  "id" | "empresa_id" | "is_master" | "permissions"
>;

async function parseApiPayload(raw: ManualApiPayload) {
  if (raw?.payload) {
    const decoded = await decrypt(raw.payload);
    if (decoded) return decoded as { boleano?: boolean; mensagem?: string; obj?: unknown };
  }

  return {
    boleano: raw?.boleano ?? false,
    mensagem: raw?.mensagem ?? "",
    obj: raw?.obj,
  };
}

function userPayload(user: ManualUserContext) {
  return {
    id: user.id,
    empresa_id: user.empresa_id,
    is_master: user.is_master,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

function canManageManual(user: ManualUserContext) {
  if (user.is_master) return true;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return permissions.includes("settings.view") || permissions.includes("users.manage");
}

async function postManual<T>(
  endpoint: string,
  user: ManualUserContext,
  payload: Record<string, unknown> = {},
): Promise<{ obj: T; message: string }> {
  const token = await encrypt({
    ...userPayload(user),
    ...payload,
  });

  const response = await fetch(`${API_BASE}/manual${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: token }),
  });

  const raw = (await response.json()) as ManualApiPayload;
  const body = await parseApiPayload(raw);

  if (!response.ok || !body?.boleano) {
    throw new Error(body?.mensagem || "Nao foi possivel concluir a operacao.");
  }

  return {
    obj: body.obj as T,
    message: String(body.mensagem || ""),
  };
}

function readStoredArticles(): ManualArticle[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeArticle) : null;
  } catch {
    return null;
  }
}

function writeStoredArticles(articles: ManualArticle[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
}

function normalizeSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function ensureUniqueSlug(baseSlug: string, articles: ManualArticle[], currentId?: string) {
  const base = normalizeSlug(baseSlug) || "artigo";
  let candidate = base;
  let counter = 2;

  while (
    articles.some((article) => article.slug === candidate && article.id !== currentId)
  ) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function normalizeArticle(raw: any): ManualArticle {
  return {
    id: String(raw?.id || ""),
    moduleId: String(raw?.moduleId || raw?.module_id || ""),
    title: String(raw?.title || ""),
    slug: String(raw?.slug || ""),
    summary: String(raw?.summary || ""),
    content: String(raw?.content || ""),
    steps: Array.isArray(raw?.steps) ? raw.steps.map(String) : [],
    keywords: Array.isArray(raw?.keywords) ? raw.keywords.map(String) : [],
    relatedRoute: raw?.relatedRoute || raw?.related_route || undefined,
    requiredPermissions: Array.isArray(raw?.requiredPermissions)
      ? raw.requiredPermissions.map(String)
      : Array.isArray(raw?.required_permissions)
        ? raw.required_permissions.map(String)
        : [],
    minPlanId: raw?.minPlanId || raw?.min_plan_id || undefined,
    featured: Boolean(raw?.featured),
    order: Number(raw?.order || raw?.ordem || 1),
    status: raw?.status || "draft",
    updatedAt: String(raw?.updatedAt || raw?.updated_at || new Date().toISOString()),
  };
}

function localArticles(): ManualArticle[] {
  const stored = readStoredArticles();
  const articles = stored && stored.length > 0 ? stored : MANUAL_ARTICLES;
  return [...articles].sort((a, b) => {
    if (a.moduleId !== b.moduleId) return a.moduleId.localeCompare(b.moduleId);
    return a.order - b.order || a.title.localeCompare(b.title);
  });
}

function localSaveArticle(input: ManualArticleInput): ManualArticle {
  const articles = localArticles();
  const now = new Date().toISOString();
  const slug = ensureUniqueSlug(input.slug || input.title, articles, input.id);

  if (input.id) {
    const nextArticle: ManualArticle = {
      ...input,
      id: input.id,
      slug,
      updatedAt: now,
    };
    writeStoredArticles(
      articles.map((article) => (article.id === input.id ? nextArticle : article)),
    );
    return nextArticle;
  }

  const nextArticle: ManualArticle = {
    ...input,
    id: `manual-${Date.now()}`,
    slug,
    updatedAt: now,
  };
  writeStoredArticles([...articles, nextArticle]);
  return nextArticle;
}

export const manualService = {
  listModules(): ManualModule[] {
    return [...MANUAL_MODULES].sort((a, b) => a.order - b.order);
  },

  async listArticles(user?: ManualUserContext | null): Promise<ManualArticle[]> {
    if (user?.empresa_id) {
      try {
        const { obj } = await postManual<unknown[]>("/listar", user);
        const articles = Array.isArray(obj) ? obj.map(normalizeArticle) : [];
        if (articles.length > 0) return articles;

        if (canManageManual(user)) {
          const created = await this.resetToSeed(user);
          if (created.length > 0) return created;
        }

        return localArticles();
      } catch {
        return localArticles();
      }
    }

    return localArticles();
  },

  async saveArticle(
    input: ManualArticleInput,
    user?: ManualUserContext | null,
  ): Promise<ManualArticle> {
    if (user?.empresa_id) {
      const { obj } = await postManual<unknown>("/salvar", user, { article: input });
      return normalizeArticle(obj);
    }

    return localSaveArticle(input);
  },

  async duplicateArticle(
    articleId: string,
    user?: ManualUserContext | null,
  ): Promise<ManualArticle> {
    if (user?.empresa_id && Number.isInteger(Number(articleId))) {
      const { obj } = await postManual<unknown>("/duplicar", user, {
        article_id: Number(articleId),
      });
      return normalizeArticle(obj);
    }

    const articles = localArticles();
    const source = articles.find((article) => article.id === articleId);
    if (!source) throw new Error("Artigo nao encontrado.");

    const duplicate: ManualArticle = {
      ...source,
      id: `manual-${Date.now()}`,
      title: `${source.title} (copia)`,
      slug: ensureUniqueSlug(`${source.slug}-copia`, articles),
      status: "draft",
      featured: false,
      updatedAt: new Date().toISOString(),
    };

    writeStoredArticles([...articles, duplicate]);
    return duplicate;
  },

  async deleteArticle(articleId: string, user?: ManualUserContext | null) {
    if (user?.empresa_id && Number.isInteger(Number(articleId))) {
      await postManual("/apagar", user, { article_id: Number(articleId) });
      return;
    }

    writeStoredArticles(localArticles().filter((article) => article.id !== articleId));
  },

  async resetToSeed(user?: ManualUserContext | null): Promise<ManualArticle[]> {
    if (user?.empresa_id) {
      const { obj } = await postManual<unknown[]>("/restaurar_base", user, {
        articles: MANUAL_ARTICLES,
      });
      return Array.isArray(obj) ? obj.map(normalizeArticle) : [];
    }

    writeStoredArticles(MANUAL_ARTICLES);
    return MANUAL_ARTICLES;
  },
};
