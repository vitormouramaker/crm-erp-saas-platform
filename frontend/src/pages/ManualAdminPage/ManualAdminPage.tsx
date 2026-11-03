import { useEffect, useMemo, useState } from "react";
import {
  FiCopy,
  FiEdit2,
  FiEye,
  FiFilePlus,
  FiRefreshCw,
  FiSave,
  FiTrash2,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { useAuth } from "../../contexts/AuthContext";
import { manualService } from "../../service/manualService";
import type {
  ManualArticle,
  ManualArticleInput,
  ManualArticleStatus,
} from "../../types/manual";
import "./ManualAdminPage.css";

type ArticleForm = {
  id?: string;
  moduleId: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  stepsText: string;
  keywordsText: string;
  relatedRoute: string;
  requiredPermissionsText: string;
  minPlanId: string;
  featured: boolean;
  order: string;
  status: ManualArticleStatus;
};

function emptyForm(defaultModuleId: string): ArticleForm {
  return {
    moduleId: defaultModuleId,
    title: "",
    slug: "",
    summary: "",
    content: "",
    stepsText: "",
    keywordsText: "",
    relatedRoute: "",
    requiredPermissionsText: "",
    minPlanId: "",
    featured: false,
    order: "1",
    status: "draft",
  };
}

function formFromArticle(article: ManualArticle): ArticleForm {
  return {
    id: article.id,
    moduleId: article.moduleId,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    content: article.content,
    stepsText: article.steps.join("\n"),
    keywordsText: article.keywords.join(", "),
    relatedRoute: article.relatedRoute || "",
    requiredPermissionsText: (article.requiredPermissions || []).join(", "),
    minPlanId: article.minPlanId ? String(article.minPlanId) : "",
    featured: article.featured,
    order: String(article.order || 1),
    status: article.status,
  };
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function ManualAdminPage() {
  const { user, hasPermission } = useAuth();
  const modules = useMemo(() => manualService.listModules(), []);
  const [articles, setArticles] = useState<ManualArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [form, setForm] = useState<ArticleForm>(() => emptyForm(modules[0]?.id || ""));
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");

  const canManageManual =
    Boolean(user?.is_master) || hasPermission("settings.view") || hasPermission("users.manage");

  const moduleById = useMemo(
    () => new Map(modules.map((module) => [module.id, module])),
    [modules],
  );

  const filteredArticles = useMemo(() => {
    const term = normalizeQuery(search.trim());

    return articles
      .filter((article) => {
        if (moduleFilter && article.moduleId !== moduleFilter) return false;
        if (statusFilter && article.status !== statusFilter) return false;
        if (!term) return true;

        const haystack = normalizeQuery(
          [
            article.title,
            article.summary,
            article.keywords.join(" "),
            moduleById.get(article.moduleId)?.title || "",
          ].join(" "),
        );
        return haystack.includes(term);
      })
      .sort((a, b) => {
        if (a.moduleId !== b.moduleId) return a.moduleId.localeCompare(b.moduleId);
        return a.order - b.order || a.title.localeCompare(b.title);
      });
  }, [articles, moduleById, moduleFilter, search, statusFilter]);

  const refreshArticles = async () => {
    setLoadingArticles(true);
    try {
      setArticles(await manualService.listArticles(user));
    } finally {
      setLoadingArticles(false);
    }
  };

  useEffect(() => {
    void refreshArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleNewArticle = () => {
    setForm(emptyForm(moduleFilter || modules[0]?.id || ""));
    setMessage("");
  };

  const handleEditArticle = (article: ManualArticle) => {
    setForm(formFromArticle(article));
    setMessage("");
  };

  const handleSave = async () => {
    const title = form.title.trim();
    const moduleId = form.moduleId;
    const summary = form.summary.trim();
    const steps = splitList(form.stepsText);

    if (!title || !moduleId || !summary) {
      setMessage("Preencha titulo, modulo e resumo.");
      return;
    }

    if (steps.length === 0) {
      setMessage("Informe ao menos um passo.");
      return;
    }

    const payload: ManualArticleInput = {
      id: form.id,
      moduleId,
      title,
      slug: form.slug.trim() || title,
      summary,
      content: form.content.trim(),
      steps,
      keywords: splitList(form.keywordsText),
      relatedRoute: form.relatedRoute.trim() || undefined,
      requiredPermissions: splitList(form.requiredPermissionsText),
      minPlanId: form.minPlanId ? Number(form.minPlanId) : undefined,
      featured: form.featured,
      order: Number(form.order || 1),
      status: form.status,
    };

    const saved = await manualService.saveArticle(payload, user);
    await refreshArticles();
    setForm(formFromArticle(saved));
    setMessage("Artigo salvo com sucesso.");
  };

  const handleDuplicate = async (articleId: string) => {
    try {
      const duplicate = await manualService.duplicateArticle(articleId, user);
      await refreshArticles();
      setForm(formFromArticle(duplicate));
      setMessage("Artigo duplicado como rascunho.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel duplicar.");
    }
  };

  const handleDelete = (articleId: string) => {
    const confirmed = window.confirm("Deseja excluir este artigo do manual?");
    if (!confirmed) return;

    void manualService.deleteArticle(articleId, user).then(async () => {
      await refreshArticles();
      if (form.id === articleId) {
        setForm(emptyForm(modules[0]?.id || ""));
      }
      setMessage("Artigo excluido.");
    });
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      "Deseja restaurar o conteudo inicial do manual? Alteracoes locais serao substituidas.",
    );
    if (!confirmed) return;

    await manualService.resetToSeed(user);
    await refreshArticles();
    setForm(emptyForm(modules[0]?.id || ""));
    setMessage("Conteudo inicial restaurado.");
  };

  if (!canManageManual) {
    return (
      <div className="manual-admin-page">
        <MobileHeader title="Admin Manual" />
        <section className="manual-admin-denied">
          <h1>Acesso restrito</h1>
          <p>Somente administradores podem gerenciar o conteúdo do manual.</p>
          <Link to="/manual">Voltar para o manual</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="manual-admin-page">
      <MobileHeader title="Admin Manual" />

      <header className="manual-admin-header">
        <div>
          <span>Administração</span>
          <h1>Manual Operacional</h1>
          <p>Cadastre e mantenha os textos que aparecem para os usuários finais.</p>
        </div>
        <div className="manual-admin-header__actions">
          <Link to="/manual" className="manual-admin-button manual-admin-button--secondary">
            <FiEye size={16} />
            Ver manual
          </Link>
          <button
            type="button"
            className="manual-admin-button manual-admin-button--secondary"
            onClick={() => void handleReset()}
          >
            <FiRefreshCw size={16} />
            Restaurar base
          </button>
        </div>
      </header>

      <main className="manual-admin-layout">
        <section className="manual-admin-list-panel">
          <div className="manual-admin-list-panel__top">
            <h2>Artigos</h2>
            <button
              type="button"
              className="manual-admin-button manual-admin-button--primary"
              onClick={handleNewArticle}
            >
              <FiFilePlus size={16} />
              Novo
            </button>
          </div>

          <div className="manual-admin-filters">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar artigos..."
            />
            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
            >
              <option value="">Todos os módulos</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>

          <div className="manual-admin-article-list">
              {loadingArticles ? (
              <p className="manual-admin-empty">Carregando artigos...</p>
            ) : filteredArticles.length === 0 ? (
              <p className="manual-admin-empty">Nenhum artigo encontrado.</p>
            ) : (
              filteredArticles.map((article) => (
                <article
                  className={
                    form.id === article.id
                      ? "manual-admin-article-item active"
                      : "manual-admin-article-item"
                  }
                  key={article.id}
                >
                  <button type="button" onClick={() => handleEditArticle(article)}>
                    <span>{moduleById.get(article.moduleId)?.title || "Manual"}</span>
                    <strong>{article.title}</strong>
                    <small>{article.status}</small>
                  </button>
                  <div className="manual-admin-article-item__actions">
                    <button
                      type="button"
                      title="Duplicar"
                      onClick={() => void handleDuplicate(article.id)}
                    >
                      <FiCopy size={15} />
                    </button>
                    <button
                      type="button"
                      title="Excluir"
                      onClick={() => handleDelete(article.id)}
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="manual-admin-editor">
          <div className="manual-admin-editor__header">
            <div>
              <h2>{form.id ? "Editar artigo" : "Novo artigo"}</h2>
              <p>O conteúdo salvo como publicado fica disponível no manual do usuário.</p>
            </div>
            {form.id && form.status === "published" && (
              <Link to={`/manual/${form.slug}`} className="manual-admin-preview-link">
                Abrir no manual
              </Link>
            )}
          </div>

          {message && <p className="manual-admin-message">{message}</p>}

          <div className="manual-admin-form-grid">
            <label>
              Módulo
              <select
                value={form.moduleId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, moduleId: event.target.value }))
                }
              >
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as ManualArticleStatus,
                  }))
                }
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>

            <label>
              Ordem
              <input
                type="number"
                min={1}
                value={form.order}
                onChange={(event) =>
                  setForm((current) => ({ ...current, order: event.target.value }))
                }
              />
            </label>

            <label>
              Plano mínimo
              <input
                type="number"
                min={1}
                max={3}
                value={form.minPlanId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, minPlanId: event.target.value }))
                }
                placeholder="Opcional"
              />
            </label>
          </div>

          <label className="manual-admin-field">
            Título
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Ex.: Como cadastrar um produto"
            />
          </label>

          <label className="manual-admin-field">
            Slug
            <input
              value={form.slug}
              onChange={(event) =>
                setForm((current) => ({ ...current, slug: event.target.value }))
              }
              placeholder="Gerado automaticamente se ficar vazio"
            />
          </label>

          <label className="manual-admin-field">
            Resumo
            <input
              value={form.summary}
              onChange={(event) =>
                setForm((current) => ({ ...current, summary: event.target.value }))
              }
              placeholder="Descrição curta exibida na listagem"
            />
          </label>

          <label className="manual-admin-field">
            Quando usar / explicação
            <textarea
              rows={7}
              value={form.content}
              onChange={(event) =>
                setForm((current) => ({ ...current, content: event.target.value }))
              }
              placeholder="Explique o objetivo, cuidados, campos importantes e resultado esperado."
            />
          </label>

          <label className="manual-admin-field">
            Passo a passo
            <textarea
              rows={7}
              value={form.stepsText}
              onChange={(event) =>
                setForm((current) => ({ ...current, stepsText: event.target.value }))
              }
              placeholder="Um passo por linha"
            />
          </label>

          <div className="manual-admin-form-grid manual-admin-form-grid--wide">
            <label>
              Palavras-chave
              <textarea
                rows={4}
                value={form.keywordsText}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    keywordsText: event.target.value,
                  }))
                }
                placeholder="Separadas por vírgula ou linha"
              />
            </label>

            <label>
              Permissões necessárias
              <textarea
                rows={4}
                value={form.requiredPermissionsText}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requiredPermissionsText: event.target.value,
                  }))
                }
                placeholder="Ex.: stock.view, stock.products.manage"
              />
            </label>
          </div>

          <div className="manual-admin-form-grid manual-admin-form-grid--footer">
            <label>
              Rota relacionada
              <input
                value={form.relatedRoute}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    relatedRoute: event.target.value,
                  }))
                }
                placeholder="/estoque"
              />
            </label>

            <label className="manual-admin-checkbox">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    featured: event.target.checked,
                  }))
                }
              />
              Destacar na tela inicial
            </label>
          </div>

          <div className="manual-admin-editor__actions">
            <button
              type="button"
              className="manual-admin-button manual-admin-button--secondary"
              onClick={handleNewArticle}
            >
              <FiEdit2 size={16} />
              Limpar
            </button>
            <button
              type="button"
              className="manual-admin-button manual-admin-button--primary"
              onClick={() => void handleSave()}
            >
              <FiSave size={16} />
              Salvar artigo
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
