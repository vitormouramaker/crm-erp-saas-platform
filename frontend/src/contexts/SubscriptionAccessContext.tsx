import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  fetchCurrentSubscription,
  type AssinaturaAtual,
} from "../service/subscriptionService";

type SubscriptionAccessStatus = "ok" | "warning" | "blocked";

type SubscriptionAccessContextValue = {
  subscription: AssinaturaAtual | null;
  loading: boolean;
  hasValidated: boolean;
  error: string;
  status: SubscriptionAccessStatus;
  isActionRequired: boolean;
  isLimitedMode: boolean;
  sessionModalOpen: boolean;
  bannerTitle: string;
  bannerDescription: string;
  regularizePath: string;
  dismissSessionModal: () => void;
  refreshStatus: () => Promise<void>;
};

const SubscriptionAccessContext = createContext<
  SubscriptionAccessContextValue | undefined
>(undefined);

function buildSessionKey(
  empresaId: number | null | undefined,
  userId: number | null | undefined,
  signature: string
) {
  return `subscription-access-modal:${empresaId || 0}:${userId || 0}:${signature}`;
}

function parseSubscriptionValidity(validade?: string | null) {
  const normalized = String(validade || "").trim();
  if (!normalized) return null;

  const dateOnlyMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnlyMatch?.[1]) {
    const parsed = new Date(`${dateOnlyMatch[1]}T23:59:59.999`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatValidityDate(validade?: string | null) {
  const parsed = parseSubscriptionValidity(validade);
  if (!parsed) return "";
  return parsed.toLocaleDateString("pt-BR");
}

function getRemainingValidityDays(validade?: string | null) {
  const validityDate = parseSubscriptionValidity(validade);
  if (!validityDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expirationDay = new Date(validityDate);
  expirationDay.setHours(0, 0, 0, 0);

  return Math.round((expirationDay.getTime() - today.getTime()) / 86_400_000);
}

function hasPendingCancellation(subscription: AssinaturaAtual | null) {
  const stripeStatus = String(subscription?.stripe_status || "").trim().toLowerCase();

  return (
    Boolean(subscription?.request_unsubscribe) ||
    Boolean(subscription?.stripe_cancel_at_period_end) ||
    stripeStatus === "canceled" ||
    stripeStatus === "cancel_at_period_end"
  );
}

function getSubscriptionStatus(subscription: AssinaturaAtual | null): SubscriptionAccessStatus {
  if (!subscription) return "blocked";

  const validityDate = parseSubscriptionValidity(subscription.validade);
  if (!validityDate) {
    return "blocked";
  }

  if (validityDate.getTime() < Date.now()) {
    return "blocked";
  }

  const remainingDays = getRemainingValidityDays(subscription.validade);
  if (hasPendingCancellation(subscription) && remainingDays !== null && remainingDays >= 1 && remainingDays <= 5) {
    return "warning";
  }

  return "ok";
}

function formatSubscriptionCopy(subscription: AssinaturaAtual | null, status: SubscriptionAccessStatus) {
  if (status === "blocked") {
    const formattedValidity = formatValidityDate(subscription?.validade);

    return {
      title: "Assinatura vencida ou indisponivel",
      description:
        formattedValidity
          ? `Seu acesso esta em modo de consulta. A validade atual da assinatura encerrou em ${formattedValidity}.`
          : "Seu acesso esta em modo de consulta. Defina ou regularize a validade da assinatura para voltar a usar a plataforma normalmente.",
    };
  }

  if (status === "warning") {
    const remainingDays = getRemainingValidityDays(subscription?.validade);
    const formattedValidity = formatValidityDate(subscription?.validade);
    const dayLabel = remainingDays === 1 ? "dia" : "dias";

    return {
      title: "Sua assinatura sera finalizada em breve",
      description: `A conta esta programada para cancelamento e sera finalizada em ${remainingDays} ${dayLabel}${formattedValidity ? `, em ${formattedValidity}` : ""}. Reative a assinatura para manter o acesso sem interrupcoes.`,
    };
  }

  return {
    title: "",
    description: "",
  };
}

export function SubscriptionAccessProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [subscription, setSubscription] = useState<AssinaturaAtual | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [error, setError] = useState("");
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const previousStatusRef = useRef<SubscriptionAccessStatus>("ok");

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated || !user?.email) {
      setSubscription(null);
      setError("");
      setHasValidated(true);
      setSessionModalOpen(false);
      previousStatusRef.current = "ok";
      return;
    }

    try {
      setLoading(true);
      setError("");
      const nextSubscription = await fetchCurrentSubscription(user.email);
      const previousStatus = previousStatusRef.current;
      const nextStatus = getSubscriptionStatus(nextSubscription);

      setSubscription(nextSubscription);
      setHasValidated(true);
      previousStatusRef.current = nextStatus;

      if (previousStatus !== "ok" && nextStatus === "ok") {
        setSessionModalOpen(false);
        window.alert("Assinatura regularizada. Seu acesso foi restaurado.");
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Nao foi possivel validar a assinatura."
      );
      setHasValidated(true);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.email]);

  useEffect(() => {
    if (isAuthenticated && user?.email) {
      setHasValidated(false);
    }
    void refreshStatus();
  }, [isAuthenticated, refreshStatus, user?.email]);

  useEffect(() => {
    if (!isAuthenticated || !user?.email) return undefined;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshStatus();
      }
    }, 60000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAuthenticated, refreshStatus, user?.email]);

  const status = useMemo(
    () => (error ? previousStatusRef.current : getSubscriptionStatus(subscription)),
    [error, subscription]
  );
  const statusSignature = useMemo(() => {
    return [
      status,
      String(subscription?.validade || ""),
      String(subscription?.request_unsubscribe || false),
      String(subscription?.stripe_cancel_at_period_end || false),
      String(subscription?.stripe_status || ""),
    ].join(":");
  }, [
    status,
    subscription?.request_unsubscribe,
    subscription?.stripe_cancel_at_period_end,
    subscription?.stripe_status,
    subscription?.validade,
  ]);

  useEffect(() => {
    if (!hasValidated || !isAuthenticated || !user?.empresa_id || !user?.id || status === "ok") {
      setSessionModalOpen(false);
      return;
    }

    const storageKey = buildSessionKey(user.empresa_id, user.id, statusSignature);
    const alreadyShown = window.sessionStorage.getItem(storageKey) === "1";
    if (!alreadyShown) {
      window.sessionStorage.setItem(storageKey, "1");
      setSessionModalOpen(true);
    }
  }, [hasValidated, isAuthenticated, status, statusSignature, user?.empresa_id, user?.id]);

  const copy = useMemo(() => formatSubscriptionCopy(subscription, status), [subscription, status]);

  const value = useMemo<SubscriptionAccessContextValue>(
    () => ({
      subscription,
      loading,
      hasValidated,
      error,
      status,
      isActionRequired: hasValidated && status !== "ok",
      isLimitedMode: hasValidated && status === "blocked",
      sessionModalOpen,
      bannerTitle: copy.title,
      bannerDescription: error || copy.description,
      regularizePath: "/assinatura?view=regularizar",
      dismissSessionModal: () => setSessionModalOpen(false),
      refreshStatus,
    }),
    [copy.description, copy.title, error, hasValidated, loading, refreshStatus, sessionModalOpen, status, subscription]
  );

  return (
    <SubscriptionAccessContext.Provider value={value}>
      {children}
    </SubscriptionAccessContext.Provider>
  );
}

export function useSubscriptionAccess() {
  const context = useContext(SubscriptionAccessContext);
  if (!context) {
    throw new Error("useSubscriptionAccess deve ser usado dentro de SubscriptionAccessProvider");
  }
  return context;
}
