import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FiArrowRight,
  FiBookOpen,
  FiExternalLink,
  FiSearch,
  FiStar,
} from "react-icons/fi";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { useAuth } from "../../contexts/AuthContext";
import { manualService } from "../../service/manualService";
import type { ManualArticle, ManualModule } from "../../types/manual";
import "./ManualPage.css";

function canAccessArticle(
  article: ManualArticle,
  userPlanId: number | undefined,
  hasPermission: (permission: string) => boolean,
) {
  if (article.status !== "published") return false;
  if (article.minPlanId && Number(userPlanId || 0) < article.minPlanId) return false;
  const permissions = article.requiredPermissions || [];
  return permissions.every((permission) => hasPermission(permission));
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function articleMatches(article: ManualArticle, module: ManualModule | undefined, query: string) {
  const term = normalize(query.trim());
  if (!term) return true;

  const haystack = normalize(
    [
      article.title,
      article.summary,
      article.content,
      article.steps.join(" "),
      article.keywords.join(" "),
      module?.title || "",
    ].join(" "),
  );

  return haystack.includes(term);
}

export function ManualPage() {
  const { articleSlug } = useParams<{ articleSlug?: string }>();
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const [search, setSearch] = useState("");
  const [modules] = useState(() => manualService.listModules());
  const [articles, setArticles] = useState<ManualArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadArticles() {
      try {
        setLoadingArticles(true);
        const result = await manualService.listArticles(user);
        if (!cancelled) setArticles(result);
      } finally {
        if (!cancelled) setLoadingArticles(false);
      }
    }

    void loadArticles();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const moduleById = useMemo(
    () => new Map(modules.map((module) => [module.id, module])),
    [modules],
  );

  const visibleArticles = useMemo(
    () =>
      articles
        .filter((article) =>
          canAccessArticle(article, user?.id_plano, hasPermission),
        )
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    [articles, hasPermission, user?.id_plano],
  );

  const filteredArticles = useMemo(
    () =>
      visibleArticles.filter((article) =>
        articleMatches(article, moduleById.get(article.moduleId), search),
      ),
    [moduleById, search, visibleArticles],
  );

  const articlesByModule = useMemo(() => {
    const grouped = new Map<string, ManualArticle[]>();
    for (const article of filteredArticles) {
      const current = grouped.get(article.moduleId) || [];
      current.push(article);
      grouped.set(article.moduleId, current);
    }
    return grouped;
  }, [filteredArticles]);

  const selectedArticle = useMemo(
    () =>
      articleSlug
        ? visibleArticles.find((article) => article.slug === articleSlug) || null
        : null,
    [articleSlug, visibleArticles],
  );

  const featuredArticles = useMemo(
    () => visibleArticles.filter((article) => article.featured).slice(0, 8),
    [visibleArticles],
  );

  useEffect(() => {
    if (articleSlug && !selectedArticle && visibleArticles.length > 0) {
      navigate("/manual", { replace: true });
    }
  }, [articleSlug, navigate, selectedArticle, visibleArticles.length]);

  return (
    <div className="manual-page">
      <MobileHeader title="Manual Operacional" />

      <aside className="manual-sidebar">
        <div className="manual-sidebar__header">
          <h1>Manual</h1>
          <p>Guias operacionais por módulo</p>
        </div>

        <label className="manual-search" htmlFor="manual-search-input">
          <FiSearch size={16} />
          <input
            id="manual-search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar no manual..."
            type="search"
          />
        </label>

        <nav className="manual-nav" aria-label="Artigos do manual">
          <Link
            to="/manual"
            className={!articleSlug ? "manual-nav__home active" : "manual-nav__home"}
          >
            Início
          </Link>

          {modules.map((module) => {
            const moduleArticles = articlesByModule.get(module.id) || [];
            if (moduleArticles.length === 0) return null;

            return (
              <section className="manual-nav__group" key={module.id}>
                <h2>{module.title}</h2>
                <div className="manual-nav__items">
                  {moduleArticles.map((article) => (
                    <Link
                      key={article.id}
                      to={`/manual/${article.slug}`}
                      className={
                        selectedArticle?.id === article.id
                          ? "manual-nav__item active"
                          : "manual-nav__item"
                      }
                    >
                      {article.title}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          {filteredArticles.length === 0 && (
            <p className="manual-nav__empty">Nenhum artigo encontrado.</p>
          )}
        </nav>
      </aside>

      <main className="manual-content">
        {loadingArticles ? (
          <section className="manual-loading">
            <FiBookOpen size={26} />
            <h1>Carregando manual</h1>
            <p>Estamos preparando os artigos disponíveis para o seu usuário.</p>
          </section>
        ) : selectedArticle ? (
          <div className="manual-article-shell">
            <article className="manual-article">
              <div className="manual-article__module">
                {moduleById.get(selectedArticle.moduleId)?.title || "Manual"}
              </div>
              <header className="manual-article__header">
                <h1>{selectedArticle.title}</h1>
                <p>{selectedArticle.summary}</p>
              </header>

              <section className="manual-article__section">
                <h2>Quando usar</h2>
                {selectedArticle.content
                  .split(/\n+/)
                  .filter(Boolean)
                  .map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
              </section>

              <section className="manual-article__section">
                <h2>Passo a passo</h2>
                <ol className="manual-steps">
                  {selectedArticle.steps.map((step, index) => (
                    <li key={`${step}-${index}`}>
                      <span>{index + 1}</span>
                      <p>{step}</p>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="manual-article__section manual-article__meta">
                <h2>Informações úteis</h2>
                <div className="manual-meta-grid">
                  <div>
                    <strong>Módulo</strong>
                    <span>{moduleById.get(selectedArticle.moduleId)?.title || "-"}</span>
                  </div>
                  <div>
                    <strong>Palavras-chave</strong>
                    <span>{selectedArticle.keywords.join(", ") || "-"}</span>
                  </div>
                  <div>
                    <strong>Atualizado em</strong>
                    <span>
                      {new Intl.DateTimeFormat("pt-BR").format(
                        new Date(selectedArticle.updatedAt),
                      )}
                    </span>
                  </div>
                </div>
              </section>
            </article>

            {selectedArticle.relatedRoute && (
              <div className="manual-action-bar">
                <Link className="manual-open-route" to={selectedArticle.relatedRoute}>
                  Abrir tela relacionada
                  <FiExternalLink size={16} />
                </Link>
              </div>
            )}
          </div>
        ) : (
          <section className="manual-home">
            <div className="manual-home__hero">
              <div className="manual-home__icon">
                <FiBookOpen size={28} />
              </div>
              <div>
                <span>Manual operacional</span>
                <h1>Encontre o passo a passo de cada módulo do sistema.</h1>
                <p>
                  Use a busca ou navegue pela sidebar. Os artigos exibidos são
                  filtrados conforme as permissões do seu usuário.
                </p>
              </div>
            </div>

            <section className="manual-home__section">
              <div className="manual-home__section-header">
                <FiStar size={18} />
                <h2>Atalhos rápidos</h2>
              </div>

              <div className="manual-featured-grid">
                {featuredArticles.map((article) => (
                  <Link
                    className="manual-featured-card"
                    to={`/manual/${article.slug}`}
                    key={article.id}
                  >
                    <span>{moduleById.get(article.moduleId)?.title}</span>
                    <strong>{article.title}</strong>
                    <p>{article.summary}</p>
                    <i>
                      Abrir guia
                      <FiArrowRight size={14} />
                    </i>
                  </Link>
                ))}
              </div>
            </section>

            <section className="manual-home__section">
              <h2>Módulos disponíveis para você</h2>
              <div className="manual-module-grid">
                {modules.map((module) => {
                  const count = visibleArticles.filter(
                    (article) => article.moduleId === module.id,
                  ).length;
                  if (count === 0) return null;

                  return (
                    <div className="manual-module-card" key={module.id}>
                      <strong>{module.title}</strong>
                      <p>{module.description}</p>
                      <span>{count} artigo(s)</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
