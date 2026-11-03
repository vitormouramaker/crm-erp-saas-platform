import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiBell,
  FiBookOpen,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiStar,
  FiTool,
  FiZap,
} from "react-icons/fi";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { useAuth } from "../../contexts/AuthContext";
import { useNews } from "../../contexts/NewsContext";
import {
  listNews,
  markNewsRead,
  type NewsItem,
  type NewsType,
} from "../../service/newsService";
import { useToast } from "../../contexts/ToastContext";
import "./NewsPage.css";

function formatDateTime(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Agora";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;
  return date.toLocaleString("pt-BR");
}

function getTypeMeta(type: NewsType) {
  switch (type) {
    case "feature":
      return { label: "Nova funcionalidade", icon: <FiZap size={16} /> };
    case "improvement":
      return { label: "Melhoria", icon: <FiRefreshCw size={16} /> };
    case "fix":
      return { label: "Correcao", icon: <FiTool size={16} /> };
    case "warning":
      return { label: "Aviso", icon: <FiAlertCircle size={16} /> };
    default:
      return { label: "Comunicado", icon: <FiBell size={16} /> };
  }
}

export function NewsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const {
    unreadCount,
    refreshPreview,
    markAllAsRead,
    openHighlight,
  } = useNews();
  const [loading, setLoading] = useState(true);
  const [markingNewsId, setMarkingNewsId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [page, setPage] = useState(1);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const loadPage = useCallback(async () => {
    if (!user?.empresa_id || !user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await listNews({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        page,
        limit: 12,
        onlyUnread,
        includeHighlight: true,
      });
      setItems(response.items);
      setTotalPages(Math.max(response.pagination.totalPages, 1));
      setTotalItems(response.pagination.total);
    } catch (loadError) {
      console.error("Erro ao carregar novidades:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel carregar as novidades.",
      );
    } finally {
      setLoading(false);
    }
  }, [onlyUnread, page, user?.empresa_id, user?.id]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const reloadEverything = useCallback(async () => {
    await Promise.all([loadPage(), refreshPreview({ silent: true })]);
  }, [loadPage, refreshPreview]);

  const handleMarkRead = useCallback(
    async (item: NewsItem) => {
      if (!user?.empresa_id || !user?.id) return;

      try {
        setMarkingNewsId(item.id);
        await markNewsRead({
          empresaId: user.empresa_id,
          usuarioId: user.id,
          newsId: item.id,
        });
        await reloadEverything();
      } catch (markError) {
        addToast({
          type: "error",
          title: "Erro ao marcar novidade",
          description:
            markError instanceof Error
              ? markError.message
              : "Nao foi possivel atualizar a leitura.",
        });
      } finally {
        setMarkingNewsId(null);
      }
    },
    [addToast, reloadEverything, user?.empresa_id, user?.id]
  );

  const summaryLabel = useMemo(() => {
    if (onlyUnread) {
      return `${totalItems} novidade(s) nao lida(s) nesta pagina.`;
    }
    return `${totalItems} novidade(s) disponivel(is) para este usuario.`;
  }, [onlyUnread, totalItems]);

  return (
    <div className="news-page">
      <MobileHeader title="Novidades" />

      <header className="news-page__hero">
        <div>
          <p className="news-page__eyebrow">Central de atualizacoes</p>
          <h1>Novidades do sistema</h1>
          <p className="news-page__subtitle">
            Acompanhe novas funcionalidades, melhorias, correcoes e avisos importantes da sua operacao.
          </p>
          <p className="news-page__external-note">
            Esse painel e alimentado por um sistema externo. Aqui os usuarios apenas visualizam as atualizacoes publicadas.
          </p>
        </div>

        <div className="news-page__hero-actions">
          <div className="news-page__stat">
            <span>Nao lidas</span>
            <strong>{unreadCount}</strong>
          </div>
          <button
            type="button"
            className="news-page__ghost-button"
            onClick={() => {
              void markAllAsRead()
                .then(() => reloadEverything())
                .catch((error) => {
                  addToast({
                    type: "error",
                    title: "Erro ao marcar novidades",
                    description:
                      error instanceof Error
                        ? error.message
                        : "Nao foi possivel atualizar as leituras.",
                  });
                });
            }}
          >
            <FiEye size={16} />
            <span>Marcar todas como lidas</span>
          </button>
        </div>
      </header>

      <section className="news-page__toolbar">
        <div className="news-page__filter-group" role="tablist" aria-label="Filtro de novidades">
          <button
            type="button"
            className={onlyUnread ? "news-page__tab" : "news-page__tab is-active"}
            onClick={() => {
              setOnlyUnread(false);
              setPage(1);
            }}
          >
            Todas
          </button>
          <button
            type="button"
            className={onlyUnread ? "news-page__tab is-active" : "news-page__tab"}
            onClick={() => {
              setOnlyUnread(true);
              setPage(1);
            }}
          >
            Nao lidas
          </button>
        </div>

        <div className="news-page__toolbar-actions">
          <span className="news-page__summary-label">{summaryLabel}</span>
          <button
            type="button"
            className="news-page__ghost-button"
            onClick={() => void reloadEverything()}
          >
            <FiRefreshCw size={16} />
            <span>Atualizar</span>
          </button>
        </div>
      </section>

      {loading ? (
        <div className="news-page__state">
          <FiRefreshCw className="news-page__spinner" />
          <span>Carregando novidades...</span>
        </div>
      ) : error ? (
        <div className="news-page__state news-page__state--error">{error}</div>
      ) : items.length === 0 ? (
        <div className="news-page__empty">
          <FiBookOpen size={28} />
          <strong>Nenhuma novidade encontrada</strong>
          <span>Tente ajustar o filtro ou publique um novo comunicado.</span>
        </div>
      ) : (
        <>
          <section className="news-feed">
            {items.map((item) => {
              const typeMeta = getTypeMeta(item.type);
              return (
                <article
                  key={item.id}
                  className={`news-card ${item.read ? "is-read" : "is-unread"} ${
                    item.featured ? "is-featured" : ""
                  }`}
                >
                  <div className="news-card__top">
                    <div className="news-card__type">
                      {typeMeta.icon}
                      <span>{typeMeta.label}</span>
                    </div>
                    <div className="news-card__badges">
                      {item.highlightModal ? <span>Modal</span> : null}
                      {item.featured ? <span>Destaque</span> : null}
                      {!item.read ? <span className="news-card__badge-unread">Nao lida</span> : null}
                    </div>
                  </div>

                  <div className="news-card__header">
                    <h2>{item.title}</h2>
                    <small>{formatDateTime(item.publishedAt || item.createdAt)}</small>
                  </div>

                  {item.summary ? <p className="news-card__summary">{item.summary}</p> : null}

                  <div className="news-card__content">
                    {item.content.split(/\r?\n/).filter(Boolean).map((paragraph, index) => (
                      <p key={`${item.id}-${index}`}>{paragraph}</p>
                    ))}
                  </div>

                  <div className="news-card__actions">
                    {!item.read ? (
                      <button
                        type="button"
                        className="news-page__primary-button"
                        onClick={() => void handleMarkRead(item)}
                        disabled={markingNewsId === item.id}
                      >
                        <FiEye size={16} />
                        <span>{markingNewsId === item.id ? "Salvando..." : "Marcar como lida"}</span>
                      </button>
                    ) : (
                      <button type="button" className="news-page__ghost-button" disabled>
                        <FiEyeOff size={16} />
                        <span>Lida</span>
                      </button>
                    )}

                    {item.highlightModal ? (
                      <button
                        type="button"
                        className="news-page__ghost-button"
                        onClick={() => openHighlight(item)}
                      >
                        <FiStar size={16} />
                        <span>Abrir destaque</span>
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>

          <section className="news-pagination" aria-label="Paginacao de novidades">
            <button
              type="button"
              className="news-page__ghost-button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page <= 1}
            >
              <FiChevronLeft size={16} />
              <span>Anterior</span>
            </button>

            <div className="news-pagination__status">
              <strong>
                Pagina {page} de {Math.max(totalPages, 1)}
              </strong>
              <span>{totalItems} registro(s)</span>
            </div>

            <button
              type="button"
              className="news-page__ghost-button"
              onClick={() => setPage((current) => Math.min(current + 1, Math.max(totalPages, 1)))}
              disabled={page >= totalPages}
            >
              <span>Proxima</span>
              <FiChevronRight size={16} />
            </button>
          </section>
        </>
      )}
    </div>
  );
}
