import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import {
  dismissNewsHighlight,
  listNews,
  markAllNewsRead,
  markNewsRead,
  markNewsViewed,
  type NewsItem,
} from "../service/newsService";
import { NewsHighlightModal } from "../components/news/NewsHighlightModal/NewsHighlightModal";

type NewsContextData = {
  previewItems: NewsItem[];
  unreadCount: number;
  highlightItem: NewsItem | null;
  isHighlightOpen: boolean;
  isLoadingPreview: boolean;
  refreshPreview: (options?: { silent?: boolean }) => Promise<void>;
  markAsRead: (newsId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissHighlight: () => Promise<void>;
  openHighlight: (item?: NewsItem | null) => void;
  closeHighlight: () => void;
};

const NewsContext = createContext<NewsContextData | undefined>(undefined);

function getHighlightSessionKey(usuarioId: number, novidadeId: number) {
  return `orbita.news.highlight.dismissed.${usuarioId}.${novidadeId}`;
}

export function NewsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const { addToast } = useToast();
  const [previewItems, setPreviewItems] = useState<NewsItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [highlightItem, setHighlightItem] = useState<NewsItem | null>(null);
  const [isHighlightOpen, setIsHighlightOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const refreshPreview = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!isAuthenticated || !user?.empresa_id || !user?.id) {
        setPreviewItems([]);
        setUnreadCount(0);
        setHighlightItem(null);
        setIsHighlightOpen(false);
        return;
      }

      try {
        if (!silent) {
          setIsLoadingPreview(true);
        }

        const response = await listNews({
          empresaId: user.empresa_id,
          usuarioId: user.id,
          page: 1,
          limit: 20,
          includeHighlight: true,
        });

        setPreviewItems(response.items);
        setUnreadCount(response.unreadCount);
        setHighlightItem(response.highlight);

        if (response.highlight) {
          const sessionKey = getHighlightSessionKey(user.id, response.highlight.id);
          const alreadyDismissedThisSession = window.sessionStorage.getItem(sessionKey) === "1";
          if (!alreadyDismissedThisSession) {
            setIsHighlightOpen(true);
            void markNewsViewed({
              empresaId: user.empresa_id,
              usuarioId: user.id,
              newsId: response.highlight.id,
            }).catch(() => undefined);
          }
        } else {
          setIsHighlightOpen(false);
        }
      } catch (error) {
        console.error("Erro ao carregar novidades:", error);
        if (!silent) {
          addToast({
            type: "warning",
            title: "Novidades indisponiveis",
            description:
              error instanceof Error
                ? error.message
                : "Nao foi possivel carregar as novidades no momento.",
          });
        }
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [addToast, isAuthenticated, user?.empresa_id, user?.id]
  );

  useEffect(() => {
    if (!isAuthReady) return;
    void refreshPreview();
  }, [isAuthReady, refreshPreview]);

  useEffect(() => {
    if (!isAuthenticated || !user?.empresa_id) return undefined;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshPreview({ silent: true });
      }
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAuthenticated, refreshPreview, user?.empresa_id]);

  const markAsRead = useCallback(
    async (newsId: number) => {
      if (!user?.empresa_id || !user?.id) return;

      await markNewsRead({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        newsId,
      });

      setPreviewItems((current) =>
        current.map((item) =>
          item.id === newsId
            ? {
                ...item,
                read: true,
                readAt: new Date().toISOString(),
              }
            : item
        )
      );
      setUnreadCount((current) => Math.max(current - 1, 0));
      setHighlightItem((current) =>
        current?.id === newsId
          ? {
              ...current,
              read: true,
              readAt: new Date().toISOString(),
            }
          : current
      );
    },
    [user?.empresa_id, user?.id]
  );

  const markAllAsReadHandler = useCallback(async () => {
    if (!user?.empresa_id || !user?.id) return;

    await markAllNewsRead({
      empresaId: user.empresa_id,
      usuarioId: user.id,
    });

    setPreviewItems((current) =>
      current.map((item) => ({
        ...item,
        read: true,
        readAt: item.readAt || new Date().toISOString(),
      }))
    );
    setUnreadCount(0);
    setHighlightItem((current) =>
      current
        ? {
            ...current,
            read: true,
            readAt: current.readAt || new Date().toISOString(),
          }
        : current
    );
  }, [user?.empresa_id, user?.id]);

  const dismissHighlight = useCallback(async () => {
    if (!user?.empresa_id || !user?.id || !highlightItem) {
      setIsHighlightOpen(false);
      return;
    }

    const sessionKey = getHighlightSessionKey(user.id, highlightItem.id);
    window.sessionStorage.setItem(sessionKey, "1");

    await dismissNewsHighlight({
      empresaId: user.empresa_id,
      usuarioId: user.id,
      newsId: highlightItem.id,
    });

    setHighlightItem((current) =>
      current
        ? {
            ...current,
            highlightDismissedAt: current.highlightDismissedAt || new Date().toISOString(),
          }
        : current
    );
    setIsHighlightOpen(false);
  }, [highlightItem, user?.empresa_id, user?.id]);

  const openHighlight = useCallback((item?: NewsItem | null) => {
    if (item) {
      setHighlightItem(item);
    }
    setIsHighlightOpen(true);
  }, []);

  const closeHighlight = useCallback(() => {
    setIsHighlightOpen(false);
  }, []);

  const value = useMemo<NewsContextData>(
    () => ({
      previewItems,
      unreadCount,
      highlightItem,
      isHighlightOpen,
      isLoadingPreview,
      refreshPreview,
      markAsRead,
      markAllAsRead: markAllAsReadHandler,
      dismissHighlight,
      openHighlight,
      closeHighlight,
    }),
    [
      previewItems,
      unreadCount,
      highlightItem,
      isHighlightOpen,
      isLoadingPreview,
      refreshPreview,
      markAsRead,
      markAllAsReadHandler,
      dismissHighlight,
      openHighlight,
      closeHighlight,
    ]
  );

  return (
    <NewsContext.Provider value={value}>
      {children}
      <NewsHighlightModal
        item={highlightItem}
        isOpen={isHighlightOpen && Boolean(highlightItem)}
        onClose={() => {
          void dismissHighlight().catch((error) => {
            console.error("Erro ao dispensar destaque de novidades:", error);
            setIsHighlightOpen(false);
          });
        }}
        onMarkRead={() => {
          if (!highlightItem?.id) return;

          void markAsRead(highlightItem.id)
            .then(() => {
              setIsHighlightOpen(false);
            })
            .catch((error) => {
              addToast({
                type: "error",
                title: "Erro ao marcar novidade",
                description:
                  error instanceof Error
                    ? error.message
                    : "Nao foi possivel marcar a novidade como lida.",
              });
            });
        }}
      />
    </NewsContext.Provider>
  );
}

export function useNews() {
  const context = useContext(NewsContext);
  if (!context) {
    throw new Error("useNews deve ser usado dentro de um NewsProvider");
  }
  return context;
}
