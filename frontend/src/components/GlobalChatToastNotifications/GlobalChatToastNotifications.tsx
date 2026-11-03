import { useCallback, useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getServerSessionToken } from "../../utils/authenticatedFetch";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { encrypt, decrypt } from "../../utils/cripto";
import {
  playAbandonedCartTone,
  playIncomingMessageTone,
  playIntegrationSaleBellTone,
} from "../../utils/chatNotificationTone";
import { API_BASE } from "../../config/api";

type ConversationStatus = "waiting" | "active" | "finished";

type NotificationConversation = {
  id: number;
  nome: string;
  telefone: string;
  status: ConversationStatus;
  ultima_mensagem: string | null;
  unread_count?: number;
};

type CommercialIntegrationNotification = {
  event_id?: string;
  tipo?: "sale" | "abandoned_cart";
  plataforma?: string;
  cliente_nome?: string | null;
  produto_nome?: string | null;
};

export function GlobalChatToastNotifications() {
  const { isAuthenticated, user, hasPermission } = useAuth();
  const { addToast } = useToast();
  const isFetchingConversationsRef = useRef(false);
  const pendingConversationsRefreshRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const scheduledConversationRefreshRef = useRef<number | null>(null);
  const previousConversationsSnapshotRef = useRef<Map<number, NotificationConversation>>(
    new Map()
  );
  const hasPrimedConversationToastsRef = useRef(false);
  const commercialEventIdsRef = useRef<Set<string>>(new Set());

  const canListenChatNotifications = Boolean(
    isAuthenticated && user?.empresa_id && user?.id && hasPermission("chat.view")
  );
  const canListenCommercialNotifications = Boolean(
    isAuthenticated &&
      user?.empresa_id &&
      user?.id &&
      hasPermission("commercial.view")
  );
  const canListenRealtimeNotifications =
    canListenChatNotifications || canListenCommercialNotifications;

  const pushConversationToastNotifications = useCallback(
    (conversations: NotificationConversation[]) => {
      const nextSnapshot = new Map<number, NotificationConversation>();
      conversations.forEach((conversation) => {
        nextSnapshot.set(Number(conversation.id), conversation);
      });

      if (!hasPrimedConversationToastsRef.current) {
        previousConversationsSnapshotRef.current = nextSnapshot;
        hasPrimedConversationToastsRef.current = true;
        return;
      }

      const previousSnapshot = previousConversationsSnapshotRef.current;
      previousConversationsSnapshotRef.current = nextSnapshot;

      conversations.forEach((conversation) => {
        const conversationId = Number(conversation.id);
        const previousConversation = previousSnapshot.get(conversationId);
        const customerName = String(conversation.nome || "").trim() || "Cliente";
        const customerPhone = String(conversation.telefone || "").trim();
        const messagePreview = String(conversation.ultima_mensagem || "")
          .replace(/\s+/g, " ")
          .trim();

        if (!previousConversation) {
          if (conversation.status === "waiting") {
            addToast({
              type: "info",
              title: "Novo atendimento aguardando",
              description: customerPhone
                ? `${customerName} entrou na fila (${customerPhone}).`
                : `${customerName} entrou na fila de aguardando atendimento.`,
              duration: 7000,
            });
            if (document.visibilityState === "visible") {
              void playIncomingMessageTone();
            }
          }
          return;
        }

        const previousUnreadCount = Math.max(Number(previousConversation.unread_count || 0), 0);
        const nextUnreadCount = Math.max(Number(conversation.unread_count || 0), 0);
        if (nextUnreadCount <= previousUnreadCount) {
          return;
        }

        addToast({
          type: conversation.status === "waiting" ? "warning" : "info",
          title:
            conversation.status === "waiting"
              ? "Nova mensagem na fila"
              : "Nova mensagem recebida",
          description: messagePreview
            ? `${customerName}: ${messagePreview}`
            : `${customerName} enviou uma nova mensagem.`,
          duration: 7000,
        });
        if (document.visibilityState === "visible") {
          void playIncomingMessageTone();
        }
      });
    },
    [addToast]
  );

  const loadConversationsFromApi = useCallback(async () => {
    if (!user?.empresa_id || !user?.id) return [];

    const payload: Record<string, unknown> = {
      empresa_id: user.empresa_id,
      usuario_id: user.id,
    };

    if (user.is_master) {
      payload.is_master = true;
      payload.visualizar_todos_atendentes = true;
      payload.visualizar_todas_conversas = true;
    }

    const encrypted = await encrypt(payload);
    const response = await fetch(`${API_BASE}/atendimento/carregar_conversas_usuario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: encrypted }),
    });
    const respData = await response.json();
    const resp = (await decrypt(respData.payload)) as {
      boleano?: boolean;
      obj?:
        | NotificationConversation[]
        | {
            items?: NotificationConversation[];
          };
      mensagem?: string;
    };

    if (!resp?.boleano) {
      throw new Error(resp?.mensagem || "Falha ao carregar conversas para notificações.");
    }

    if (Array.isArray(resp.obj)) {
      return resp.obj;
    }

    return Array.isArray(resp.obj?.items) ? resp.obj.items : [];
  }, [user?.empresa_id, user?.id, user?.is_master]);

  const fetchConversations = useCallback(async () => {
    if (!canListenChatNotifications) {
      previousConversationsSnapshotRef.current = new Map();
      hasPrimedConversationToastsRef.current = false;
      return;
    }

    if (isFetchingConversationsRef.current) {
      pendingConversationsRefreshRef.current = true;
      return;
    }

    try {
      isFetchingConversationsRef.current = true;
      const conversations = await loadConversationsFromApi();
      pushConversationToastNotifications(conversations);
    } catch (error) {
      console.error("Erro ao carregar conversas para toast global:", error);
    } finally {
      isFetchingConversationsRef.current = false;
      if (pendingConversationsRefreshRef.current) {
        pendingConversationsRefreshRef.current = false;
        void fetchConversations();
      }
    }
  }, [canListenChatNotifications, loadConversationsFromApi, pushConversationToastNotifications]);

  const scheduleConversationRefresh = useCallback(() => {
    if (scheduledConversationRefreshRef.current !== null) return;
    scheduledConversationRefreshRef.current = window.setTimeout(() => {
      scheduledConversationRefreshRef.current = null;
      void fetchConversations();
    }, 250);
  }, [fetchConversations]);

  useEffect(() => {
    previousConversationsSnapshotRef.current = new Map();
    hasPrimedConversationToastsRef.current = false;
  }, [user?.empresa_id, user?.id]);

  useEffect(() => {
    if (!canListenChatNotifications) {
      return;
    }

    void fetchConversations();
  }, [canListenChatNotifications, fetchConversations]);

  useEffect(() => {
    if (!canListenChatNotifications) {
      return;
    }

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        void fetchConversations();
      }
    };

    window.addEventListener("focus", handleVisibilityRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    return () => {
      window.removeEventListener("focus", handleVisibilityRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [canListenChatNotifications, fetchConversations]);

  useEffect(() => {
    if (!canListenChatNotifications) {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchConversations();
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [canListenChatNotifications, fetchConversations]);

  useEffect(() => {
    if (!canListenRealtimeNotifications || !user?.empresa_id) {
      return;
    }

    const socket =
      socketRef.current ||
      io(API_BASE, {
        auth: { token: getServerSessionToken() },
        transports: ["websocket", "polling"],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

    socketRef.current = socket;

    const handleConnect = () => {
      socket.emit("join_empresa", { empresa_id: user.empresa_id });
      if (canListenChatNotifications) scheduleConversationRefresh();
    };

    const handleChatUpdate = () => {
      if (canListenChatNotifications) scheduleConversationRefresh();
    };

    const handleCommercialIntegrationUpdate = (
      payload: CommercialIntegrationNotification,
    ) => {
      if (!canListenCommercialNotifications) return;

      const eventId = String(payload?.event_id || "").trim();
      if (eventId && commercialEventIdsRef.current.has(eventId)) return;
      if (eventId) {
        commercialEventIdsRef.current.add(eventId);
        if (commercialEventIdsRef.current.size > 100) {
          const oldestId = commercialEventIdsRef.current.values().next().value;
          if (oldestId) commercialEventIdsRef.current.delete(oldestId);
        }
      }

      const platform = String(payload?.plataforma || "integracao");
      const platformLabel =
        platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
      const customerName = String(payload?.cliente_nome || "Cliente").trim();
      const productName = String(payload?.produto_nome || "").trim();

      if (payload?.tipo === "sale") {
        addToast({
          type: "success",
          title: `Nova venda na ${platformLabel}`,
          description: productName
            ? `${customerName} comprou ${productName}.`
            : `${customerName} realizou uma nova compra.`,
          duration: 9000,
        });
        void playIntegrationSaleBellTone();
        return;
      }

      if (payload?.tipo === "abandoned_cart") {
        addToast({
          type: "warning",
          title: `Carrinho abandonado na ${platformLabel}`,
          description: productName
            ? `${customerName} abandonou o carrinho de ${productName}.`
            : `${customerName} abandonou um carrinho.`,
          duration: 9000,
        });
        void playAbandonedCartTone();
      }
    };

    const handleConnectError = (error: unknown) => {
      if (import.meta.env.DEV) {
        console.error("[global-chat-toast] connect_error", error);
      }
    };

    const handleDisconnect = (reason: unknown) => {
      if (import.meta.env.DEV) {
        console.warn("[global-chat-toast] disconnect", reason);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("chat:update", handleChatUpdate);
    socket.on("commercial:integration-update", handleCommercialIntegrationUpdate);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.emit("leave_empresa", { empresa_id: user.empresa_id });
      socket.off("connect", handleConnect);
      socket.off("chat:update", handleChatUpdate);
      socket.off("commercial:integration-update", handleCommercialIntegrationUpdate);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      if (scheduledConversationRefreshRef.current !== null) {
        window.clearTimeout(scheduledConversationRefreshRef.current);
        scheduledConversationRefreshRef.current = null;
      }
    };
  }, [
    addToast,
    canListenChatNotifications,
    canListenCommercialNotifications,
    canListenRealtimeNotifications,
    scheduleConversationRefresh,
    user?.empresa_id,
  ]);

  return null;
}
