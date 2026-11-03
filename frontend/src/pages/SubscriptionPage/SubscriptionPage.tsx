import { useState, useEffect, useRef } from "react";
import {
  FiCheck,
  FiX,
  FiHeadphones,
  FiMessageSquare,
  FiBriefcase,
  FiUserPlus,
  FiHelpCircle,
} from "react-icons/fi";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { FeedbackModal } from "../../components/FeedbackModals/FeedbackModals";
import { PDVInterestModal } from "../../components/PDVInterestModal/PDVInterestModal";
import { API_BASE } from "../../config/api";
import { decrypt, encrypt } from "../../utils/cripto";
import { useAuth } from "../../contexts/AuthContext";
import { useSubscriptionAccess } from "../../contexts/SubscriptionAccessContext";
import "./SubscriptionPage.css";
import { Link, useLocation, useNavigate } from "react-router-dom";

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => any;
  }
}

interface Plan {
  id: string;
  assinaturaId: number;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: { name: string; included: boolean; tooltip?: string }[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "basic",
    assinaturaId: 1,
    name: "Básico",
    priceMonthly: 99.0,
    priceYearly: 990.0,
    features: [
      { name: "1 Funil", included: true },
      { name: "Até 3 usuários (fora o ADM)", included: true },
      { name: "Gestão de leads, até 5.000", included: true },
      {
        name: "Integração com serviços Meta (WhatsApp, Meta Ads e Instagram)",
        included: false,
      },
      { name: "Gestor de atendimentos via IA", included: false },
      { name: "NPS pós-atendimento", included: false },
      { name: "Gestão de ponto e RH", included: false },
      {
        name: "Webhook para integração com serviços externos",
        included: false,
      },
      { name: "Módulo de controle financeiro", included: false },
      { name: "Gerente de contas exclusivo", included: false },
      { name: "Suporte preferencial", included: false },
      { name: "Treinamento de equipe", included: false },
    ],
  },
  {
    id: "business",
    assinaturaId: 2,
    name: "Business",
    priceMonthly: 199.0,
    priceYearly: 1990.0,
    highlight: true,
    features: [
      { name: "3 Funis", included: true },
      { name: "Até 5 usuários (fora o ADM)", included: true },
      { name: "Até 7 mil leads", included: true },
      {
        name: "Integração com serviços Meta (WhatsApp, Meta Ads e Instagram)",
        included: true,
      },
      {
        name: "Gestor de atendimentos via IA",
        included: true,
        tooltip:
          "Avalie o desempenho dos seus closers e atendentes com apoio de inteligência artificial.",
      },
      { name: "NPS pós-atendimento", included: true },
      { name: "Gestão de ponto e RH", included: false },
      {
        name: "Webhook para integração com serviços externos",
        included: false,
      },
      { name: "Módulo de controle financeiro", included: false },
      { name: "Gerente de contas exclusivo", included: false },
      { name: "Suporte preferencial", included: false },
      { name: "Treinamento de equipe", included: false },
    ],
  },
  {
    id: "enterprise",
    assinaturaId: 3,
    name: "Enterprise",
    priceMonthly: 399.0,
    priceYearly: 3990.0,
    features: [
      { name: "5 Funis", included: true },
      { name: "Até 15 usuários (fora o ADM)", included: true },
      { name: "Até 10 mil leads", included: true },
      {
        name: "Integração com serviços Meta (WhatsApp, Meta Ads e Instagram)",
        included: true,
      },
      {
        name: "Gestor de atendimentos via IA",
        included: true,
        tooltip:
          "Avalie o desempenho dos seus closers e atendentes com apoio de inteligência artificial.",
      },
      { name: "NPS pós-atendimento", included: true },
      { name: "Gestão de ponto e RH", included: true },
      {
        name: "Webhook para integração com serviços externos",
        included: true,
        tooltip:
          "Possibilidade de integrar nossa plataforma com serviços e sistemas externos.",
      },
      { name: "Módulo de controle financeiro", included: true },
      {
        name: "Gerente de contas exclusivo",
        included: true,
        tooltip:
          "Atendimento dedicado para acompanhar sua operação e apoiar a evolução do uso da plataforma.",
      },
      { name: "Suporte preferencial", included: true },
      { name: "Treinamento de equipe", included: true },
    ],
  },
];

type ApiEnvelope<T> = {
  boleano?: boolean;
  obj?: T;
  mensagem?: string;
  msg?: string;
};

type PlanChangePopupState = {
  isOpen: boolean;
  title: string;
  message: string;
  checkoutUrl: string | null;
};

type ConfirmPlanChangeState = {
  isOpen: boolean;
  planId: string | null;
  planName: string;
  billingCycle: "monthly" | "yearly";
};

function calculateRemainingDays(endDateValue?: string | null): number | null {
  if (!endDateValue) return null;
  const endDate = new Date(endDateValue);
  if (Number.isNaN(endDate.getTime())) return null;

  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  if (diffMs <= 0) return 0;

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function loadStripeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Stripe) {
      resolve();
      return;
    }

    const currentScript = document.querySelector(
      'script[src="https://js.stripe.com/v3/"]',
    ) as HTMLScriptElement | null;

    if (currentScript) {
      currentScript.addEventListener("load", () => resolve());
      currentScript.addEventListener("error", () =>
        reject(new Error("Falha ao carregar Stripe.js")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Stripe.js"));
    document.body.appendChild(script);
  });
}

export function SubscriptionPage() {
  const { user, logout, hasPermission } = useAuth();
  const {
    subscription: activeSubscription,
    refreshStatus,
    status: subscriptionAccessStatus,
  } = useSubscriptionAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const stripePublishableKey =
    import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY ||
    "pk_live_51UDq4rRpnrFEXRNRBduSx8SNFnvBWSh3OZzKBvjn5xG5BSVXt2pQpRMXA7ax0hEeeIZ7MMGGavKd9btSbm4nt3SJ00RRxdiuZN";

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [embeddedClientSecret, setEmbeddedClientSecret] = useState<
    string | null
  >(null);
  const [embeddedError, setEmbeddedError] = useState<string | null>(null);
  const [hostedCheckoutUrl, setHostedCheckoutUrl] = useState<string | null>(
    null,
  );
  const [planChangePopup, setPlanChangePopup] = useState<PlanChangePopupState>({
    isOpen: false,
    title: "",
    message: "",
    checkoutUrl: null,
  });
  const [confirmPlanChange, setConfirmPlanChange] =
    useState<ConfirmPlanChangeState>({
      isOpen: false,
      planId: null,
      planName: "",
      billingCycle: "monthly",
    });

  const embeddedCheckoutRef = useRef<any>(null);
  const hasHandledCheckoutReturnReloginRef = useRef(false);
  const checkoutCompletionModeRef = useRef<"logout" | "refresh">("logout");
  const checkoutSuccessMessageRef = useRef("");
  const plansSectionRef = useRef<HTMLElement | null>(null);

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [addonQuantities, setAddonQuantities] = useState({
    additional_user: 0,
    additional_crm: 0,
    additional_leads: 0,
  });
  const [addonCycles, setAddonCycles] = useState({
    additional_user: "monthly" as "monthly" | "yearly",
    additional_crm: "monthly" as "monthly" | "yearly",
    additional_leads: "monthly" as "monthly" | "yearly",
  });

  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [isPDVModalOpen, setIsPDVModalOpen] = useState(false);
  const isCheckoutModalOpen = Boolean(
    embeddedClientSecret || hostedCheckoutUrl,
  );
  const currentStripeStatus = String(
    activeSubscription?.stripe_status || "",
  ).toLowerCase();
  const isCanceledStripeStatus =
    currentStripeStatus === "canceled" ||
    currentStripeStatus === "cancel_at_period_end";
  const hasPendingCancellation =
    Boolean(activeSubscription?.request_unsubscribe) ||
    Boolean(activeSubscription?.stripe_cancel_at_period_end) ||
    isCanceledStripeStatus;
  const isGestao360Account = activeSubscription?.empresa_origem === "gestao360";
  // Sem assinatura Stripe propria, o plano e mantido pela assinatura do Gestao 360.
  const isManagedByGestao360 =
    isGestao360Account && !activeSubscription?.stripe_subscription_id;
  const canManageSubscription = hasPermission("subscription.manage");
  const isRegularizationView =
    new URLSearchParams(location.search).get("view") === "regularizar";
  const remainingDays = calculateRemainingDays(activeSubscription?.validade);

  useEffect(() => {
    setAddonQuantities({
      additional_user: Number(activeSubscription?.additional_user || 0),
      additional_crm: Number(activeSubscription?.additional_crm || 0),
      additional_leads: Number(activeSubscription?.additional_leads || 0),
    });
    setAddonCycles({
      additional_user:
        activeSubscription?.additional_user_cycle === "yearly"
          ? "yearly"
          : "monthly",
      additional_crm:
        activeSubscription?.additional_crm_cycle === "yearly"
          ? "yearly"
          : "monthly",
      additional_leads:
        activeSubscription?.additional_leads_cycle === "yearly"
          ? "yearly"
          : "monthly",
    });
  }, [
    activeSubscription?.additional_user,
    activeSubscription?.additional_user_cycle,
    activeSubscription?.additional_crm,
    activeSubscription?.additional_crm_cycle,
    activeSubscription?.additional_leads,
    activeSubscription?.additional_leads_cycle,
  ]);

  useEffect(() => {
    if (location.state?.section === "usuarios") {
      const el = document.getElementById("section-usuarios");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [location]);

  useEffect(() => {
    if (hasHandledCheckoutReturnReloginRef.current) return;

    const searchParams = new URLSearchParams(location.search);
    const shouldRefreshSubscription =
      searchParams.get("refresh_subscription") === "1";
    const shouldForceRelogin =
      searchParams.get("force_relogin") === "1" ||
      searchParams.has("session_id");

    if (shouldRefreshSubscription) {
      hasHandledCheckoutReturnReloginRef.current = true;
      void (async () => {
        await refreshStatus();
        window.alert("Assinatura regularizada. Seu acesso foi restaurado.");
        navigate("/assinatura?view=regularizar", { replace: true });
      })();
      return;
    }

    if (!shouldForceRelogin) return;

    hasHandledCheckoutReturnReloginRef.current = true;
    forceLogoutForPlanRefresh(
      "Pagamento confirmado. Faca login novamente para aplicar os modulos e permissoes do seu plano.",
    );
  }, [location.search, navigate, refreshStatus]);

  useEffect(() => {
    if (!isCheckoutModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEmbeddedClientSecret(null);
        setHostedCheckoutUrl(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isCheckoutModalOpen]);

  useEffect(() => {
    if (!embeddedClientSecret) {
      if (embeddedCheckoutRef.current) {
        try {
          embeddedCheckoutRef.current.destroy?.();
          embeddedCheckoutRef.current.unmount?.();
        } catch {
          // noop
        }
      }
      embeddedCheckoutRef.current = null;
      return;
    }

    let disposed = false;

    (async () => {
      try {
        setEmbeddedError(null);

        if (!stripePublishableKey) {
          throw new Error(
            "VITE_STRIPE_PUBLISHABLE_KEY nao configurada no front-end.",
          );
        }

        await loadStripeScript();
        if (disposed) return;

        const stripe = window.Stripe?.(stripePublishableKey);
        if (!stripe) {
          throw new Error("Stripe.js nao inicializado corretamente.");
        }

        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret: embeddedClientSecret,
          onComplete: async () => {
            setEmbeddedClientSecret(null);
            await refreshStatus();
            if (checkoutCompletionModeRef.current === "refresh") {
              window.alert(
                checkoutSuccessMessageRef.current ||
                  "Assinatura regularizada. Seu acesso foi restaurado.",
              );
              return;
            }
            forceLogoutForPlanRefresh(
              "Assinatura atualizada com sucesso. Faca login novamente para aplicar os modulos do novo plano.",
            );
          },
        });

        if (disposed) {
          checkout.destroy?.();
          return;
        }

        embeddedCheckoutRef.current = checkout;
        checkout.mount("#stripe-embedded-checkout");
      } catch (error: any) {
        setEmbeddedError(error?.message || "Erro ao abrir checkout embutido.");
      }
    })();

    return () => {
      disposed = true;
      if (embeddedCheckoutRef.current) {
        try {
          embeddedCheckoutRef.current.destroy?.();
          embeddedCheckoutRef.current.unmount?.();
        } catch {
          // noop
        }
      }
      embeddedCheckoutRef.current = null;
    };
  }, [embeddedClientSecret, stripePublishableKey]);

  const decodeApiEnvelope = async <T,>(
    respData: any,
  ): Promise<ApiEnvelope<T> | null> => {
    if (!respData?.payload) return null;
    return (await decrypt(respData.payload)) as ApiEnvelope<T> | null;
  };

  function forceLogoutForPlanRefresh(reason: string) {
    const prefillEmail =
      user?.email || localStorage.getItem("rememberedEmail") || "";

    logout();
    navigate("/", {
      replace: true,
      state: {
        forceReloginMessage: reason,
        prefillEmail,
      },
    });
  }

  const executeSubscribe = async (
    planId: string,
    cycleOverride?: "monthly" | "yearly",
    addonOverride?: {
      additional_user?: number;
      additional_user_cycle?: "monthly" | "yearly";
      additional_crm?: number;
      additional_crm_cycle?: "monthly" | "yearly";
      additional_leads?: number;
      additional_leads_cycle?: "monthly" | "yearly";
    },
    options?: {
      successUrl?: string;
      cancelUrl?: string;
      completionMode?: "logout" | "refresh";
      successMessage?: string;
      loadingKey?: string;
    },
  ) => {
    setLoadingPlan(options?.loadingKey || planId);
    checkoutCompletionModeRef.current = options?.completionMode || "logout";
    checkoutSuccessMessageRef.current = options?.successMessage || "";

    try {
      const selectedPlan = PLANS.find((plan) => plan.id === planId);
      if (!selectedPlan || !user?.email) {
        alert("Nao foi possivel iniciar a assinatura.");
        return;
      }

      const payload = {
        assinatura_id: selectedPlan.assinaturaId,
        email: user.email,
        billing_cycle: cycleOverride || billingCycle,
        additional_user: Number(
          addonOverride?.additional_user ??
            addonQuantities.additional_user ??
            0,
        ),
        additional_user_cycle:
          addonOverride?.additional_user_cycle ?? addonCycles.additional_user,
        additional_crm: Number(
          addonOverride?.additional_crm ?? addonQuantities.additional_crm ?? 0,
        ),
        additional_crm_cycle:
          addonOverride?.additional_crm_cycle ?? addonCycles.additional_crm,
        additional_leads: Number(
          addonOverride?.additional_leads ??
            addonQuantities.additional_leads ??
            0,
        ),
        additional_leads_cycle:
          addonOverride?.additional_leads_cycle ?? addonCycles.additional_leads,
        ui_mode: "embedded",
        success_url:
          options?.successUrl ||
          `${window.location.origin}/assinatura?force_relogin=1`,
        cancel_url:
          options?.cancelUrl ||
          `${window.location.origin}/assinatura?checkout_cancelled=1`,
      };

      const encrypted = await encrypt(payload);

      const response = await fetch(`${API_BASE}/pagamento/criar_assinatura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const responseData = await response.json();
      const respData = await decodeApiEnvelope<{
        ui_mode?: string;
        checkout_url?: string;
        checkout_client_secret?: string;
        subscription_updated?: boolean;
        stripe_status?: string;
        modo_alteracao?: string;
        sem_alteracao?: boolean;
        mensagem?: string;
        proration_preview?: {
          amount_due?: number;
          total?: number;
          amount_due_formatted?: string;
          total_formatted?: string;
          currency?: string;
        };
        fatura_proracao?: {
          hosted_invoice_url?: string | null;
          amount_due?: number;
          amount_due_formatted?: string;
          total?: number;
          total_formatted?: string;
        };
      }>(responseData);

      if (!respData?.boleano || !respData.obj) {
        alert(
          respData?.mensagem ||
            respData?.msg ||
            "Erro ao iniciar pagamento. Tente novamente.",
        );
        return;
      }

      if (
        respData.obj.ui_mode === "embedded" &&
        respData.obj.checkout_client_secret
      ) {
        setHostedCheckoutUrl(null);
        setEmbeddedClientSecret(respData.obj.checkout_client_secret);
        return;
      }

      if (respData.obj.subscription_updated) {
        await refreshStatus();
        if (options?.completionMode === "refresh") {
          window.alert(
            options?.successMessage ||
              "Assinatura regularizada. Seu acesso foi restaurado.",
          );
          return;
        }
        forceLogoutForPlanRefresh(
          "Plano atualizado com sucesso. Faca login novamente para aplicar os modulos liberados no seu acesso.",
        );
        return;
      }

      if (respData.obj.modo_alteracao === "proration") {
        const adicionalTexto =
          respData.obj.proration_preview?.amount_due_formatted ||
          respData.obj.fatura_proracao?.amount_due_formatted ||
          null;

        const popupMessage =
          respData.obj.mensagem ||
          (respData.obj.sem_alteracao
            ? "Sua assinatura ja esta no plano selecionado."
            : adicionalTexto
              ? `Plano atualizado com cobranca proporcional. Valor adicional: ${adicionalTexto}.`
              : "Plano atualizado com sucesso com cobranca proporcional.");

        setPlanChangePopup({
          isOpen: true,
          title: "Troca de plano concluida",
          message: popupMessage,
          checkoutUrl: respData.obj.checkout_url || null,
        });

        await refreshStatus();
        return;
      }

      if (respData.obj.checkout_url) {
        setEmbeddedClientSecret(null);
        setHostedCheckoutUrl(respData.obj.checkout_url);
        return;
      }

      alert(
        respData.obj.mensagem ||
          respData.mensagem ||
          respData.msg ||
          "Nao foi possivel iniciar o checkout da Stripe.",
      );
      await refreshStatus();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Erro de comunicacao com o servidor de pagamento.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleSubscribe = async (planId: string) => {
    const selectedPlan = PLANS.find((plan) => plan.id === planId);
    if (!selectedPlan) {
      alert("Nao foi possivel iniciar a assinatura.");
      return;
    }

    const activeBillingCycle =
      activeSubscription?.billing_cycle === "yearly"
        ? "yearly"
        : activeSubscription?.billing_cycle === "monthly"
          ? "monthly"
          : null;

    const isCurrentPlan =
      activeSubscription?.assinatura_id === selectedPlan.assinaturaId &&
      activeBillingCycle === billingCycle &&
      activeSubscription?.ativo;

    if (isCurrentPlan) return;

    if (activeSubscription?.ativo) {
      setConfirmPlanChange({
        isOpen: true,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        billingCycle,
      });
      return;
    }

    await executeSubscribe(planId);
  };

  const updateAddonQuantity = (
    key: "additional_user" | "additional_crm" | "additional_leads",
    nextValue: number,
  ) => {
    setAddonQuantities((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.floor(Number(nextValue) || 0)),
    }));
  };

  const updateAddonCycle = (
    key: "additional_user" | "additional_crm" | "additional_leads",
    nextValue: "monthly" | "yearly",
  ) => {
    setAddonCycles((prev) => ({
      ...prev,
      [key]: nextValue === "yearly" ? "yearly" : "monthly",
    }));
  };

  const handleApplyAddons = async () => {
    if (!activeSubscription?.ativo || !activeSubscription?.assinatura_id) {
      alert("Ative um plano antes de contratar addons.");
      return;
    }

    const currentPlan = PLANS.find(
      (plan) => plan.assinaturaId === activeSubscription.assinatura_id,
    );
    if (!currentPlan) {
      alert("Nao foi possivel identificar o plano atual para aplicar addons.");
      return;
    }

    const selectedCycle =
      activeSubscription.billing_cycle === "yearly" ? "yearly" : "monthly";

    await executeSubscribe(currentPlan.id, selectedCycle, {
      additional_user: addonQuantities.additional_user,
      additional_user_cycle: addonCycles.additional_user,
      additional_crm: addonQuantities.additional_crm,
      additional_crm_cycle: addonCycles.additional_crm,
      additional_leads: addonQuantities.additional_leads,
      additional_leads_cycle: addonCycles.additional_leads,
    });
  };

  const handleCancelSubscription = async () => {
    if (!activeSubscription?.stripe_subscription_id && !user?.email) return;

    if (
      !window.confirm(
        "Tem certeza que deseja cancelar sua assinatura ao fim do período vigente?",
      )
    )
      return;

    setLoadingPlan("cancel");
    try {
      const payload = {
        email: user?.email,
        stripe_subscription_id: activeSubscription?.stripe_subscription_id,
        imediato: false,
      };
      const encrypted = await encrypt(payload);

      const response = await fetch(
        `${API_BASE}/pagamento/cancelar_assinatura`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        },
      );

      const responseData = await response.json();
      const data = await decodeApiEnvelope(responseData);

      if (data?.boleano) {
        alert("Cancelamento solicitado com sucesso.");
        void refreshStatus();
      } else {
        alert("Erro ao cancelar: " + (data?.mensagem || data?.msg || ""));
      }
    } catch (error) {
      console.error("Erro cancelamento:", error);
      alert("Erro ao processar cancelamento.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleChangePaymentMethod = async () => {
    if (!user?.email && !activeSubscription?.stripe_customer_id) return;

    setLoadingPlan("payment-method");

    try {
      const payload = {
        email: user?.email,
        stripe_customer_id: activeSubscription?.stripe_customer_id,
        return_url: `${window.location.origin}/assinatura`,
      };
      const encrypted = await encrypt(payload);

      const response = await fetch(
        `${API_BASE}/pagamento/alterar_forma_pagamento`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        },
      );

      const responseData = await response.json();
      const data = await decodeApiEnvelope<{
        url?: string | null;
      }>(responseData);

      if (!data?.boleano || !data.obj?.url) {
        alert(
          data?.mensagem ||
            data?.msg ||
            "Nao foi possivel abrir o portal da Stripe para alterar o pagamento.",
        );
        return;
      }

      window.open(data.obj.url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("Erro ao abrir portal Stripe:", error);
      alert(
        error?.message ||
          "Erro ao abrir o portal para alterar a forma de pagamento.",
      );
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!activeSubscription?.ativo || !activeSubscription?.assinatura_id)
      return;

    const currentPlan = PLANS.find(
      (plan) => plan.assinaturaId === activeSubscription.assinatura_id,
    );
    if (!currentPlan) {
      alert("Nao foi possivel identificar o plano atual para reativacao.");
      return;
    }

    const selectedCycle =
      activeSubscription.billing_cycle === "yearly" ? "yearly" : "monthly";

    await executeSubscribe(
      currentPlan.id,
      selectedCycle,
      {
        additional_user: addonQuantities.additional_user,
        additional_user_cycle: addonCycles.additional_user,
        additional_crm: addonQuantities.additional_crm,
        additional_crm_cycle: addonCycles.additional_crm,
        additional_leads: addonQuantities.additional_leads,
        additional_leads_cycle: addonCycles.additional_leads,
      },
      {
        successUrl: `${window.location.origin}/assinatura?refresh_subscription=1&view=regularizar`,
        cancelUrl: `${window.location.origin}/assinatura?checkout_cancelled=1&view=regularizar`,
        completionMode: "refresh",
        successMessage: "Assinatura regularizada. Seu acesso foi restaurado.",
        loadingKey: "regularize",
      },
    );
  };

  const scrollToPlans = () => {
    plansSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleContactCustom = () => {
    window.open(
      "https://wa.me/5511999999999?text=Olá! Tenho interesse no Plano Personalizado para minha empresa.",
      "_blank",
    );
  };

  const handleClosePlanChangePopup = () => {
    setPlanChangePopup({
      isOpen: false,
      title: "",
      message: "",
      checkoutUrl: null,
    });
    forceLogoutForPlanRefresh(
      "Plano alterado com sucesso. Faca login novamente para atualizar os modulos e permissões.",
    );
  };

  const handleContinuePlanChangePopup = () => {
    if (planChangePopup.checkoutUrl) {
      window.location.assign(planChangePopup.checkoutUrl);
    }
    setPlanChangePopup({
      isOpen: false,
      title: "",
      message: "",
      checkoutUrl: null,
    });
    forceLogoutForPlanRefresh(
      "Plano alterado com sucesso. Faca login novamente para atualizar os modulos e permissões.",
    );
  };

  const handleConfirmPlanChange = async () => {
    if (loadingPlan) return;

    const planId = confirmPlanChange.planId;
    const planCycle = confirmPlanChange.billingCycle;
    setConfirmPlanChange({
      isOpen: false,
      planId: null,
      planName: "",
      billingCycle: "monthly",
    });
    if (!planId) return;
    await executeSubscribe(planId, planCycle);
  };

  const handleCancelPlanChange = () => {
    setConfirmPlanChange({
      isOpen: false,
      planId: null,
      planName: "",
      billingCycle: "monthly",
    });
  };

  return (
    <div className="subscription-page-layout">
      {confirmPlanChange.isOpen && (
        <div className="stripe-modal-overlay" role="dialog" aria-modal="true">
          <div className="stripe-modal-card" style={{ maxWidth: "620px" }}>
            <div className="stripe-modal-header">
              <div>
                <p className="stripe-modal-kicker">Confirmação</p>
                <h3>Confirmar troca de plano</h3>
                <span>
                  Deseja realmente trocar para o plano{" "}
                  <strong>{confirmPlanChange.planName}</strong> (
                  {confirmPlanChange.billingCycle === "monthly"
                    ? "mensal"
                    : "anual"}
                  )?
                </span>
              </div>
              <button
                type="button"
                className="stripe-modal-close"
                onClick={handleCancelPlanChange}
              >
                <FiX size={18} />
              </button>
            </div>
            <div
              className="stripe-modal-footer"
              style={{ justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="stripe-modal-secondary"
                onClick={handleCancelPlanChange}
                disabled={!!loadingPlan}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="stripe-modal-secondary"
                onClick={() => void handleConfirmPlanChange()}
                disabled={!!loadingPlan}
              >
                {loadingPlan ? "Processando..." : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {planChangePopup.isOpen && (
        <div className="stripe-modal-overlay" role="dialog" aria-modal="true">
          <div className="stripe-modal-card" style={{ maxWidth: "620px" }}>
            <div className="stripe-modal-header">
              <div>
                <p className="stripe-modal-kicker">Assinatura</p>
                <h3>{planChangePopup.title}</h3>
                <span>{planChangePopup.message}</span>
              </div>
              <button
                type="button"
                className="stripe-modal-close"
                onClick={handleClosePlanChangePopup}
              >
                <FiX size={18} />
              </button>
            </div>
            <div
              className="stripe-modal-footer"
              style={{ justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="stripe-modal-secondary"
                onClick={handleClosePlanChangePopup}
              >
                Fechar
              </button>
              {planChangePopup.checkoutUrl && (
                <button
                  type="button"
                  className="stripe-modal-secondary"
                  onClick={handleContinuePlanChangePopup}
                >
                  Ir para pagamento
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isCheckoutModalOpen && (
        <div className="stripe-modal-overlay" role="dialog" aria-modal="true">
          <div className="stripe-modal-card">
            <div className="stripe-modal-header">
              <div>
                <p className="stripe-modal-kicker">Pagamento seguro</p>
                <h3>Finalizar assinatura</h3>
                <span>
                  Leva menos de 1 minuto. Você pode fechar quando quiser.
                </span>
              </div>
              <button
                type="button"
                className="stripe-modal-close"
                onClick={() => {
                  setEmbeddedClientSecret(null);
                  setHostedCheckoutUrl(null);
                }}
              >
                <FiX size={18} />
              </button>
            </div>

            {embeddedError && (
              <div className="stripe-modal-error">{embeddedError}</div>
            )}

            <div className="stripe-modal-body">
              {embeddedClientSecret ? (
                <div id="stripe-embedded-checkout" />
              ) : hostedCheckoutUrl ? (
                <div
                  style={{
                    minHeight: "320px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: "0.75rem",
                    textAlign: "center",
                    padding: "2rem 1rem",
                  }}
                >
                  <strong>Pagamento externo da Stripe</strong>
                  <span style={{ maxWidth: "680px", color: "#475569" }}>
                    Em alguns casos, a Stripe exige redirecionamento para
                    concluir o pagamento com segurança. Clique em "Ir para
                    pagamento".
                  </span>
                </div>
              ) : null}
            </div>

            <div className="stripe-modal-footer">
              <p>Checkout protegido por Stripe</p>
              {hostedCheckoutUrl && (
                <button
                  type="button"
                  className="stripe-modal-secondary"
                  onClick={() => {
                    window.location.assign(hostedCheckoutUrl);
                  }}
                >
                  Ir para pagamento
                </button>
              )}
              <button
                type="button"
                className="stripe-modal-secondary"
                onClick={() => {
                  setEmbeddedClientSecret(null);
                  setHostedCheckoutUrl(null);
                }}
              >
                Continuar depois
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileHeader title="Planos e Suporte" />

      <div className="subscription-hero">
        <h1>Evolua seu negócio hoje</h1>
        <p>Escolha o plano ideal e libere todo o potencial da plataforma.</p>
      </div>

      {(subscriptionAccessStatus !== "ok" || isRegularizationView) && (
        <section
          className={`subscription-recovery-panel ${
            subscriptionAccessStatus === "blocked"
              ? "subscription-recovery-panel--blocked"
              : "subscription-recovery-panel--warning"
          }`}
        >
          <div className="subscription-recovery-panel__content">
            <span className="subscription-recovery-panel__eyebrow">
              Regularizacao de assinatura
            </span>
            <h2>
              {subscriptionAccessStatus === "blocked"
                ? "Seu acesso esta em modo de consulta"
                : "Existe uma acao pendente na sua assinatura"}
            </h2>
            <p>
              {canManageSubscription
                ? "Use esta area para atualizar o cartao, pagar a pendencia no checkout da Stripe ou trocar de plano. A restauracao do acesso acontece automaticamente apos a confirmacao do pagamento."
                : "Seu usuario nao possui permissao para gerenciar cobranca. Solicite a regularizacao para um usuario master ou responsavel financeiro da empresa."}
            </p>
            {canManageSubscription ? (
              <small>
                O checkout da Stripe pode oferecer Pix ou cartao conforme a
                configuracao disponivel para a cobranca.
              </small>
            ) : null}
          </div>
          {canManageSubscription ? (
            <div className="subscription-recovery-panel__actions">
              <button
                type="button"
                className="subscription-recovery-panel__primary"
                onClick={() => void handleReactivateSubscription()}
                disabled={!!loadingPlan}
              >
                {loadingPlan === "regularize"
                  ? "Abrindo checkout..."
                  : "Regularizar assinatura"}
              </button>
              <button
                type="button"
                className="subscription-recovery-panel__secondary"
                onClick={() => void handleChangePaymentMethod()}
                disabled={!!loadingPlan}
              >
                {loadingPlan === "payment-method"
                  ? "Abrindo portal..."
                  : "Atualizar cartao"}
              </button>
              <button
                type="button"
                className="subscription-recovery-panel__secondary"
                onClick={scrollToPlans}
              >
                Trocar de plano
              </button>
            </div>
          ) : null}
        </section>
      )}

      {activeSubscription && (
        <div className="active-subscription-section">
          <div className="active-subscription-content">
            <h3 className="active-subscription-title">Assinatura Vigente</h3>

            <p className="active-subscription-text">
              Você está inscrito no plano:{" "}
              <strong className="active-subscription-plan">
                {String(activeSubscription.plano_nome || "").toUpperCase()}
              </strong>
            </p>
            {isGestao360Account && (
              <p className="active-subscription-meta">
                Conta vinculada ao Gestão 360
              </p>
            )}
            {activeSubscription.validade && !hasPendingCancellation && (
              <p className="active-subscription-meta">
                Validade do acesso:{" "}
                {new Date(
                  `${String(activeSubscription.validade).slice(0, 10)}T23:59:59`,
                ).toLocaleDateString("pt-BR")}
              </p>
            )}
            {hasPendingCancellation && (
              <p className="active-subscription-meta">
                Assinatura cancelada ao fim do período. Você ainda pode usar
                normalmente até a validade.
              </p>
            )}
            {Number(activeSubscription.additional_leads || 0) > 0 && (
              <p className="active-subscription-meta">
                Addon de leads ativo:{" "}
                {Number(activeSubscription.additional_leads || 0)} pacote(s) de
                1.000 leads.
              </p>
            )}

            <p className="active-subscription-meta">
              <Link to="/assinatura/historico">
                Ver histórico de pagamentos
              </Link>
            </p>
          </div>

          <div className="active-subscription-actions">
            {isManagedByGestao360 && (
              <div className="active-subscription-status">
                Plano gerenciado pela sua assinatura Gestão 360
              </div>
            )}

            {activeSubscription.ativo &&
              !isManagedByGestao360 &&
              (hasPendingCancellation ? (
                <div className="active-subscription-status">
                  {remainingDays !== null
                    ? `Acesso por mais ${remainingDays} dia(s)`
                    : "Acesso ativo ate o fim do periodo"}
                </div>
              ) : (
                <button
                  className="active-subscription-cancel-btn"
                  onClick={handleCancelSubscription}
                  disabled={
                    loadingPlan === "cancel" || loadingPlan === "payment-method"
                  }
                >
                  {loadingPlan === "cancel"
                    ? "Processando..."
                    : "Cancelar Assinatura"}
                </button>
              ))}

            {activeSubscription.ativo && !isManagedByGestao360 && (
              <button
                className="active-subscription-secondary-btn"
                onClick={() => void handleChangePaymentMethod()}
                disabled={!!loadingPlan}
              >
                {loadingPlan === "payment-method"
                  ? "Abrindo portal..."
                  : "Alterar forma de pagamento"}
              </button>
            )}

            {activeSubscription.ativo && hasPendingCancellation && (
              <button
                className="active-subscription-cancel-btn"
                onClick={() => void handleReactivateSubscription()}
                disabled={!!loadingPlan}
              >
                {loadingPlan ? "Processando..." : "Reativar Assinatura"}
              </button>
            )}
          </div>
        </div>
      )}

      <main className="subscription-content" ref={plansSectionRef}>
        <div className="billing-toggle-container">
          <button
            className={`billing-toggle-btn ${billingCycle === "monthly" ? "active" : ""}`}
            onClick={() => setBillingCycle("monthly")}
          >
            Mensal
          </button>
          <button
            className={`billing-toggle-btn ${billingCycle === "yearly" ? "active" : ""}`}
            onClick={() => setBillingCycle("yearly")}
          >
            Anual <span className="discount-badge">-20%</span>
          </button>
        </div>

        <div className="plans-container">
          {PLANS.map((plan) => {
            const currentPrice =
              billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;

            const activeBillingCycle =
              activeSubscription?.billing_cycle === "yearly"
                ? "yearly"
                : activeSubscription?.billing_cycle === "monthly"
                  ? "monthly"
                  : null;

            const isCurrentPlan =
              activeSubscription?.assinatura_id === plan.assinaturaId &&
              activeBillingCycle === billingCycle &&
              activeSubscription?.ativo;

            return (
              <div
                key={plan.id}
                className={`plan-card ${plan.highlight ? "highlight" : ""} ${isCurrentPlan ? "current-plan" : ""}`}
                style={
                  isCurrentPlan
                    ? {
                        borderColor: "var(--primary-color)",
                        borderWidth: "2px",
                      }
                    : {}
                }
              >
                {plan.highlight && !isCurrentPlan && (
                  <div className="badge-popular">Mais Popular</div>
                )}
                <div className="plan-header">
                  <h3>{plan.name}</h3>
                  <div className="price">
                    <span className="currency">R$</span>
                    <span className="amount">{currentPrice}</span>
                    <span className="period">
                      /{billingCycle === "monthly" ? "mês" : "ano"}
                    </span>
                  </div>
                </div>

                <ul className="features-list">
                  {plan.features.map((feature, idx) => (
                    <li
                      key={idx}
                      className={feature.included ? "" : "excluded"}
                    >
                      {feature.included ? (
                        <FiCheck className="check-icon" />
                      ) : (
                        <FiX className="x-icon" />
                      )}
                      {feature.name}
                      {feature.tooltip && (
                        <div className="tooltip-container">
                          <FiHelpCircle className="tooltip-icon" />
                          <div className="tooltip-text">{feature.tooltip}</div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                <button
                  className={`subscribe-btn ${plan.highlight ? "primary" : "secondary"}`}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={!!loadingPlan || isCurrentPlan}
                  style={
                    isCurrentPlan
                      ? {
                          opacity: 0.7,
                          cursor: "not-allowed",
                          background: "var(--text-secondary)",
                        }
                      : {}
                  }
                >
                  {isCurrentPlan
                    ? "Plano Atual"
                    : loadingPlan === plan.id
                      ? "Processando..."
                      : "Assinar Agora"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="addons-section" id="section-usuarios">
          <h2>Soluções Adicionais</h2>
          <div className="addons-grid">
            {/* comentado temporariamente <div className="addon-card pdv-card">
              <div className="addon-icon-wrapper">
                <FiMonitor size={32} />
              </div>
              <div className="addon-content">
                <h3>Precisa de um PDV (Frente de Caixa)?</h3>
                <h4>Automatize suas vendas físicas com total integração.</h4>
                <p>
                  O PDV (Ponto de Venda) é o sistema essencial para o caixa da
                  sua loja. Ele emite cupons, controla o troco, fecha o caixa e
                  dá baixa no estoque em tempo real. Tudo integrado com nossa
                  plataforma.
                </p>
                <div className="addon-price">
                  + R$ 49,90 <span className="period">/mês (adicional)</span>
                </div>
                <button
                  className="addon-btn"
                  onClick={() => setIsPDVModalOpen(true)}
                >
                  Tenho Interesse <FiArrowRight />
                </button>
              </div>
            </div> */}

            <div className="addon-card custom-plan-card">
              <div className="addon-icon-wrapper dark">
                <FiBriefcase size={32} />
              </div>
              <div className="addon-content">
                <h3>Plano Enterprise Personalizado</h3>
                <h4>Sua empresa precisa de algo sob medida?</h4>
                <p>
                  Se você tem uma grande operação e necessita de funcionalidades
                  exclusivas, servidores dedicados, API aberta para integrações
                  complexas ou white-label, fale com nosso time comercial.
                </p>
                <div className="addon-price">Sob Consulta</div>
                <button
                  className="addon-btn dark"
                  onClick={handleContactCustom}
                >
                  Falar com Consultor <FiMessageSquare />
                </button>
              </div>
            </div>

            <div className="addon-card custom-plan-card custom-plan-card--addons">
              <div className="addon-content-upgrade">
                <div className="addon-icon-wrapper">
                  <FiUserPlus size={32} />
                </div>
                <div>
                  <h3>Upgrade de limites</h3>
                  <h4>Adicione usuários, funis e leads ao seu plano atual</h4>
                  <p>
                    Personalize os limites do seu plano adicionando usuários,
                    funis ou pacotes de leads.
                  </p>
                </div>
              </div>

              <div className="addon-controls">
                <div className="addon-option-card">
                  <div className="addon-option-card__header">
                    <strong>Usuários adicionais</strong>
                  </div>
                  <p className="addon-option-card__description">
                    Novos acessos ao plano.
                  </p>
                  <div className="addon-quantidade-ciclo">
                    <div className="addon-field">
                      <label htmlFor="addon-additional_user">Quantidade</label>
                      <div className="addon-quantity-stepper">
                        <button
                          type="button"
                          aria-label="Diminuir usuários adicionais"
                          disabled={addonQuantities.additional_user <= 0}
                          onClick={() =>
                            updateAddonQuantity(
                              "additional_user",
                              addonQuantities.additional_user - 1,
                            )
                          }
                        >
                          -
                        </button>
                        <input
                          id="addon-additional_user"
                          type="number"
                          min={0}
                          value={addonQuantities.additional_user}
                          onChange={(event) =>
                            updateAddonQuantity(
                              "additional_user",
                              Number(event.target.value),
                            )
                          }
                        />
                        <button
                          type="button"
                          aria-label="Aumentar usuários adicionais"
                          onClick={() =>
                            updateAddonQuantity(
                              "additional_user",
                              addonQuantities.additional_user + 1,
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <label className="addon-field">
                      <span>Ciclo</span>
                      <select
                        value={addonCycles.additional_user}
                        onChange={(event) =>
                          updateAddonCycle(
                            "additional_user",
                            event.target.value === "yearly"
                              ? "yearly"
                              : "monthly",
                          )
                        }
                      >
                        <option value="monthly">Mensal</option>
                        <option value="yearly">Anual</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="addon-option-card">
                  <div className="addon-option-card__header">
                    <strong>Funis adicionais</strong>
                  </div>
                  <p className="addon-option-card__description">
                    Novos pipelines.
                  </p>
                  <div className="addon-quantidade-ciclo">
                    <div className="addon-field">
                      <label htmlFor="addon-additional_crm">Quantidade</label>
                      <div className="addon-quantity-stepper">
                        <button
                          type="button"
                          aria-label="Diminuir funis adicionais"
                          disabled={addonQuantities.additional_crm <= 0}
                          onClick={() =>
                            updateAddonQuantity(
                              "additional_crm",
                              addonQuantities.additional_crm - 1,
                            )
                          }
                        >
                          -
                        </button>
                        <input
                          id="addon-additional_crm"
                          type="number"
                          min={0}
                          value={addonQuantities.additional_crm}
                          onChange={(event) =>
                            updateAddonQuantity(
                              "additional_crm",
                              Number(event.target.value),
                            )
                          }
                        />
                        <button
                          type="button"
                          aria-label="Aumentar funis adicionais"
                          onClick={() =>
                            updateAddonQuantity(
                              "additional_crm",
                              addonQuantities.additional_crm + 1,
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <label className="addon-field">
                      <span>Ciclo</span>
                      <select
                        value={addonCycles.additional_crm}
                        onChange={(event) =>
                          updateAddonCycle(
                            "additional_crm",
                            event.target.value === "yearly"
                              ? "yearly"
                              : "monthly",
                          )
                        }
                      >
                        <option value="monthly">Mensal</option>
                        <option value="yearly">Anual</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="addon-option-card">
                  <div className="addon-option-card__header">
                    <strong>Pacotes de leads</strong>
                  </div>
                  <p className="addon-option-card__description">
                    +1.000 leads por pacote.
                  </p>
                  <div className="addon-quantidade-ciclo">
                    <div className="addon-field">
                      <label htmlFor="addon-additional_leads">Quantidade</label>
                      <div className="addon-quantity-stepper">
                        <button
                          type="button"
                          aria-label="Diminuir pacotes de leads"
                          disabled={addonQuantities.additional_leads <= 0}
                          onClick={() =>
                            updateAddonQuantity(
                              "additional_leads",
                              addonQuantities.additional_leads - 1,
                            )
                          }
                        >
                          -
                        </button>
                        <input
                          id="addon-additional_leads"
                          type="number"
                          min={0}
                          value={addonQuantities.additional_leads}
                          onChange={(event) =>
                            updateAddonQuantity(
                              "additional_leads",
                              Number(event.target.value),
                            )
                          }
                        />
                        <button
                          type="button"
                          aria-label="Aumentar pacotes de leads"
                          onClick={() =>
                            updateAddonQuantity(
                              "additional_leads",
                              addonQuantities.additional_leads + 1,
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <label className="addon-field">
                      <span>Ciclo</span>
                      <select
                        value={addonCycles.additional_leads}
                        onChange={(event) =>
                          updateAddonCycle(
                            "additional_leads",
                            event.target.value === "yearly"
                              ? "yearly"
                              : "monthly",
                          )
                        }
                      >
                        <option value="monthly">Mensal</option>
                        <option value="yearly">Anual</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
              <div className="addon-actions">
                <button
                  className="addon-btn"
                  onClick={() => void handleApplyAddons()}
                  disabled={!!loadingPlan || !activeSubscription?.ativo}
                >
                  {loadingPlan ? "Processando..." : "Aplicar alterações"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="help-section">
          <h2>Precisa de Ajuda?</h2>
          <div className="help-buttons">
            <button
              className="help-card-btn"
              onClick={() => setIsSupportOpen(true)}
            >
              <div className="icon-wrapper support">
                <FiHeadphones size={24} />
              </div>
              <div className="text-wrapper">
                <strong>Suporte Técnico</strong>
                <span>Relatar um problema ou erro</span>
              </div>
            </button>

            <button
              className="help-card-btn"
              onClick={() => setIsSuggestionOpen(true)}
            >
              <div className="icon-wrapper suggestion">
                <FiMessageSquare size={24} />
              </div>
              <div className="text-wrapper">
                <strong>Sugestões</strong>
                <span>Envie ideias de melhoria</span>
              </div>
            </button>
          </div>
        </div>
      </main>

      <FeedbackModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        type="support"
      />
      <FeedbackModal
        isOpen={isSuggestionOpen}
        onClose={() => setIsSuggestionOpen(false)}
        type="suggestion"
      />

      <PDVInterestModal
        isOpen={isPDVModalOpen}
        onClose={() => setIsPDVModalOpen(false)}
      />
    </div>
  );
}
