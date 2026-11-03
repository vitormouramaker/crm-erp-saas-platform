import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiDownload } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  type MetaAdsAd,
  type MetaAdsAdInsight,
  MetaAdsService,
  type MetaAdsCampaign,
  type MetaAdsCampaignInsight,
  type MetaAdsCampaignsResult,
  type MetaAdsAccount,
  type MetaAdsFilteredCampaignResult,
  type ValidateMetaAdsAssetsResult,
} from "../../service/metaAdsService";
import {
  exportMetaAdsAccountOverview,
  exportMetaAdsCampaignDetail,
} from "../../utils/metaAdsExport";
import "../ApiMetaSettings/ApiMetaSettings.css";

type FacebookLoginResponse = {
  status?: string;
  authResponse?: {
    code?: string;
    accessToken?: string;
    expiresIn?: number;
  };
};

type FacebookLoginOptions = {
  config_id: string;
  response_type?: "code";
  override_default_response_type?: boolean;
  scope?: string;
  return_scopes?: boolean;
  display?: "popup";
  extras?: {
    feature?: "whatsapp_embedded_signup";
    featureType?: "whatsapp_business_app_onboarding";
    sessionInfoVersion: number | string;
    version?: "v3";
    setup?: Record<string, unknown>;
  };
};

type MetaAdsModuleMode = "integration" | "management";

function normalizeTone(statusText: string, isLoading: boolean): string {
  if (isLoading) return "loading";

  const normalized = statusText.toLowerCase();
  if (
    normalized.includes("erro") ||
    normalized.includes("invalido") ||
    normalized.includes("falha")
  ) {
    return "danger";
  }

  if (
    normalized.includes("vinculada") ||
    normalized.includes("vinculadas") ||
    normalized.includes("conectado")
  ) {
    return "success";
  }

  if (
    normalized.includes("nenhuma") ||
    normalized.includes("aguardando") ||
    normalized.includes("nao")
  ) {
    return "warning";
  }

  return "neutral";
}

function getTodayDateInput(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

function toNumber(value?: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value?: string | number): string {
  return toNumber(value).toLocaleString("pt-BR");
}

function formatCurrency(value?: string | number): string {
  return toNumber(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0,00%";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function normalizeCampaignStatusLabel(status?: string | null): string {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();

  const labels: Record<string, string> = {
    ACTIVE: "Ativo",
    PAUSED: "Pausado",
    IN_PROCESS: "Em processamento",
    WITH_ISSUES: "Com problemas",
    DELETED: "Excluido",
    ARCHIVED: "Arquivado",
    CAMPAIGN_PAUSED: "Pausado",
    ADSET_PAUSED: "Pausado",
    AD_PAUSED: "Pausado",
    PENDING_REVIEW: "Em analise",
    DISAPPROVED: "Reprovado",
    PREAPPROVED: "Preaprovado",
    PENDING_BILLING_INFO: "Pendente de cobranca",
    INACTIVE: "Inativo",
  };

  if (labels[normalized]) return labels[normalized];
  if (normalized.includes("ACTIVE")) return "Ativo";
  if (normalized.includes("PAUSED")) return "Pausado";
  if (normalized.includes("INACTIVE")) return "Inativo";
  if (normalized.includes("REVIEW")) return "Em analise";

  return status?.trim() || "-";
}

function resolveCampaignStatus(campaign: MetaAdsCampaign): string {
  return normalizeCampaignStatusLabel(
    String(campaign.effective_status || campaign.status || "-"),
  );
}

function getStatusToneClass(status?: string): string {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();

  if (
    normalized.includes("ACTIVE") ||
    normalized.includes("ATIVA") ||
    normalized.includes("ATIVO")
  ) {
    return "meta-ads-dashboard-status-pill--active";
  }

  if (
    normalized.includes("PAUSED") ||
    normalized.includes("PAUSADA") ||
    normalized.includes("PAUSADO") ||
    normalized.includes("INACTIVE") ||
    normalized.includes("INATIVO") ||
    normalized.includes("DESATIV")
  ) {
    return "meta-ads-dashboard-status-pill--inactive";
  }

  return "meta-ads-dashboard-status-pill--neutral";
}

function getCampaignInsights(
  campaign: MetaAdsCampaign,
): MetaAdsCampaignInsight[] {
  const directInsights = Array.isArray(campaign.insights?.data)
    ? campaign.insights.data
    : [];
  if (directInsights.length > 0) return directInsights;
  return Array.isArray(campaign.week_insights) ? campaign.week_insights : [];
}

function getMetricType(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const source = raw as Record<string, unknown>;
  return String(
    source.action_type ||
      source.type ||
      source.result_type ||
      source.name ||
      source.key ||
      "",
  )
    .trim()
    .toLowerCase();
}

function getMetricValue(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const source = raw as Record<string, unknown>;
  return toNumber(
    source.value ??
      source.count ??
      source.total ??
      source.result ??
      source.amount ??
      0,
  );
}

function sumMetricFromEntries(
  entries: unknown,
  actionTypes: Set<string>,
): number {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  return entries.reduce((sum, current) => {
    const metricType = getMetricType(current);
    if (!actionTypes.has(metricType)) return sum;
    return sum + getMetricValue(current);
  }, 0);
}

function getCampaignBaseMetrics(campaign: MetaAdsCampaign): {
  spend: number;
  impressions: number;
  clicks: number;
  insight: MetaAdsCampaignInsight | undefined;
} {
  const insights = getCampaignInsights(campaign);
  if (insights.length === 0) {
    return { spend: 0, impressions: 0, clicks: 0, insight: undefined };
  }

  if (insights.length === 1) {
    const first = insights[0];
    return {
      spend: toNumber(first?.spend),
      impressions: toNumber(first?.impressions),
      clicks: toNumber(first?.clicks),
      insight: first,
    };
  }

  return insights.reduce(
    (acc, insight) => ({
      spend: acc.spend + toNumber(insight?.spend),
      impressions: acc.impressions + toNumber(insight?.impressions),
      clicks: acc.clicks + toNumber(insight?.clicks),
      insight: acc.insight || insight,
    }),
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      insight: insights[0],
    } as {
      spend: number;
      impressions: number;
      clicks: number;
      insight: MetaAdsCampaignInsight | undefined;
    },
  );
}

function getCampaignActionsTotal(
  campaign: MetaAdsCampaign,
  actionTypes: string[],
): number {
  const allowed = new Set(
    actionTypes.map((action) => action.toLowerCase().trim()),
  );
  const insights = getCampaignInsights(campaign);
  if (insights.length === 0) return 0;

  return insights.reduce((sum, insight) => {
    const byActions = sumMetricFromEntries(insight?.actions, allowed);
    const byResults = sumMetricFromEntries(insight?.results, allowed);
    return sum + byActions + byResults;
  }, 0);
}

function getAdInsight(ad: MetaAdsAd): MetaAdsAdInsight | undefined {
  if (!ad.insights) return undefined;
  if (Array.isArray(ad.insights)) return ad.insights[0];
  if (typeof ad.insights === "object" && "data" in ad.insights) {
    return Array.isArray(ad.insights.data) ? ad.insights.data[0] : undefined;
  }
  return ad.insights as MetaAdsAdInsight;
}

type ApiMetaAdsSettingsModuleProps = {
  mode: MetaAdsModuleMode;
  onInitialLoadChange?: (loading: boolean) => void;
};

function ApiMetaAdsSettingsModule({
  mode,
  onInitialLoadChange,
}: ApiMetaAdsSettingsModuleProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const isIntegrationModule = mode === "integration";
  const isManagementModule = mode === "management";

  const [isMetaSdkReady, setIsMetaSdkReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState(
    "Aguardando consulta...",
  );
  const [isIntegrationActive, setIsIntegrationActive] = useState(false);
  const [accounts, setAccounts] = useState<MetaAdsAccount[]>([]);
  const [availableAccountsAfterApproval, setAvailableAccountsAfterApproval] =
    useState<
      Array<{
        id?: string;
        name?: string;
        account_status?: string | number | null;
        business?: { id?: string; name?: string } | null;
      }>
    >([]);
  const [validationResult, setValidationResult] =
    useState<ValidateMetaAdsAssetsResult | null>(null);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState("");
  const [campaignStartDate, setCampaignStartDate] = useState("");
  const [campaignEndDate, setCampaignEndDate] = useState("");
  const [draftCampaignStartDate, setDraftCampaignStartDate] = useState("");
  const [draftCampaignEndDate, setDraftCampaignEndDate] = useState("");
  const [onlyActiveCampaigns, setOnlyActiveCampaigns] = useState(false);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [campaignsResult, setCampaignsResult] =
    useState<MetaAdsCampaignsResult | null>(null);
  const [campaignsError, setCampaignsError] = useState("");
  const [campaignSearchTerm] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("all");
  const [campaignObjectiveFilter, setCampaignObjectiveFilter] = useState("all");
  const [selectedCampaign, setSelectedCampaign] =
    useState<MetaAdsCampaign | null>(null);
  const [campaignAds, setCampaignAds] = useState<MetaAdsAd[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [campaignAdsError, setCampaignAdsError] = useState("");
  const [campaignFilterStartDate, setCampaignFilterStartDate] = useState("");
  const [campaignFilterEndDate, setCampaignFilterEndDate] = useState("");
  const [filteredCampaignResult, setFilteredCampaignResult] =
    useState<MetaAdsFilteredCampaignResult | null>(null);
  const [filteredCampaignError, setFilteredCampaignError] = useState("");
  const [isLoadingFilteredCampaign, setIsLoadingFilteredCampaign] =
    useState(false);
  const [isExportingSelectedCampaign, setIsExportingSelectedCampaign] =
    useState(false);
  const [isExportingAccountOverview, setIsExportingAccountOverview] =
    useState(false);
  const [hasFetchedStatusOnce, setHasFetchedStatusOnce] = useState(false);
  const [hasFetchedAccountsOnce, setHasFetchedAccountsOnce] = useState(false);
  const [isAccountSelectionLoading, setIsAccountSelectionLoading] =
    useState(false);
  const [isCampaignDateModalOpen, setIsCampaignDateModalOpen] = useState(false);
  const trackingSectionRef = useRef<HTMLElement | null>(null);

  const metaAppId = String(
    import.meta.env.VITE_META_ADS_APP_ID || "",
  ).trim();
  const metaApiVersion = String(
    import.meta.env.VITE_META_API_VERSION || "v25.0",
  ).trim();
  const metaAdsConfigId = String(
    import.meta.env.VITE_META_ADS_CONFIG_ID || "",
  ).trim();
  const metaAdsDefaultRedirectUri = String(
    import.meta.env.VITE_META_ADS_REDIRECT_URI ||
      import.meta.env.VITE_META_REDIRECT_URI ||
      "",
  ).trim();
  const metaBusinessName = String(
    import.meta.env.VITE_META_BUSINESS_NAME || "Sua Empresa",
  ).trim();
  const metaBusinessId = String(
    import.meta.env.VITE_META_BUSINESS_ID || "",
  ).trim();
  const businessSettingsUrl =
    "https://business.facebook.com/settings/ad-accounts";

  const statusTone = useMemo(
    () => normalizeTone(integrationStatus, isLoadingStatus),
    [integrationStatus, isLoadingStatus],
  );

  const hasLinkedAccounts = accounts.length > 0;
  const hasAccountsAfterApproval = availableAccountsAfterApproval.length > 0;

  const metaEmbeddedSignupOptions: FacebookLoginOptions = useMemo(
    () => ({
      config_id: metaAdsConfigId,
      response_type: "code",
      override_default_response_type: true,
      scope: "ads_management,ads_read,business_management",
      return_scopes: true,
      display: "popup",
      extras: {
        sessionInfoVersion: "3",
      },
    }),
    [metaAdsConfigId],
  );

  const fetchIntegrationStatus = useCallback(async () => {
    if (!user?.empresa_id) {
      setIntegrationStatus("Usuario sem empresa vinculada.");
      setIsIntegrationActive(false);
      setHasFetchedStatusOnce(true);
      return;
    }

    try {
      setIsLoadingStatus(true);
      const result = await MetaAdsService.getIntegrationStatus(user.empresa_id);
      setIntegrationStatus(result.statusText);
      setIsIntegrationActive(result.isActive);
    } catch (error) {
      console.error("[MetaAdsSettings] erro ao consultar status:", error);
      setIntegrationStatus("Erro ao consultar status.");
      setIsIntegrationActive(false);
    } finally {
      setIsLoadingStatus(false);
      setHasFetchedStatusOnce(true);
    }
  }, [user?.empresa_id]);

  const fetchAccounts = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setIsLoadingAccounts(true);
      const nextAccounts = await MetaAdsService.listAccounts(user.empresa_id);
      setAccounts(nextAccounts);
    } catch (error) {
      console.error("[MetaAdsSettings] erro ao listar contas:", error);
      addToast({
        type: "error",
        title: "Erro ao carregar contas",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as contas de anuncio.",
      });
    } finally {
      setIsLoadingAccounts(false);
      setHasFetchedAccountsOnce(true);
    }
  }, [addToast, user?.empresa_id]);

  useEffect(() => {
    if (!accounts.length) {
      setSelectedAdAccountId("");
      return;
    }

    const hasSelectedAccount = accounts.some(
      (account) => account.ad_account_id === selectedAdAccountId,
    );
    if (selectedAdAccountId && !hasSelectedAccount) {
      setSelectedAdAccountId("");
    }
  }, [accounts, selectedAdAccountId]);

  useEffect(() => {
    if (!selectedAdAccountId) {
      setCampaignsResult(null);
      setCampaignsError("");
      setSelectedCampaign(null);
      setCampaignAds([]);
      setCampaignAdsError("");
      setFilteredCampaignResult(null);
      setFilteredCampaignError("");
      setIsAccountSelectionLoading(false);
      setCampaignStartDate("");
      setCampaignEndDate("");
      setDraftCampaignStartDate("");
      setDraftCampaignEndDate("");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      trackingSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [selectedAdAccountId]);

  useEffect(() => {
    void fetchIntegrationStatus();
  }, [fetchIntegrationStatus]);

  useEffect(() => {
    if (!isManagementModule) return;

    if (!isIntegrationActive) {
      setAccounts([]);
      return;
    }

    void fetchAccounts();
  }, [fetchAccounts, isIntegrationActive, isManagementModule]);

  const isInitialManagementLoading =
    isManagementModule &&
    (!hasFetchedStatusOnce || (isIntegrationActive && !hasFetchedAccountsOnce));

  useEffect(() => {
    onInitialLoadChange?.(isInitialManagementLoading);
  }, [isInitialManagementLoading, onInitialLoadChange]);

  useEffect(() => {
    window.fbAsyncInit = () => {
      (
        window as typeof window & {
          FB?: {
            init: (options: {
              appId: string;
              cookie: boolean;
              xfbml: boolean;
              version: string;
            }) => void;
          };
        }
      ).FB?.init({
        appId: metaAppId,
        cookie: true,
        xfbml: true,
        version: metaApiVersion,
      });

      setIsMetaSdkReady(true);
    };

    const existingScript = document.getElementById("facebook-jssdk");
    if (existingScript) {
      if (window.FB) {
        window.fbAsyncInit?.();
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [metaApiVersion, metaAppId]);

  const waitForMetaSdk = useCallback(async (timeoutMs = 5000) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (window.FB) {
        setIsMetaSdkReady(true);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    return Boolean(window.FB);
  }, []);

  const handleMetaAdsLogin = useCallback(() => {
    if (!user?.empresa_id) return;

    if (!metaAdsConfigId) {
      addToast({
        type: "warning",
        title: "Configuracao pendente",
        description:
          "Defina VITE_META_ADS_CONFIG_ID no front para habilitar o Embedded Signup da Meta Ads.",
      });
      return;
    }

    const metaWindow = window as typeof window & {
      FB?: {
        login: (
          callback: (response: FacebookLoginResponse) => void,
          options?: FacebookLoginOptions,
        ) => void;
      };
    };

    void (async () => {
      const sdkAvailable =
        metaWindow.FB || isMetaSdkReady || (await waitForMetaSdk());

      if (!sdkAvailable || !metaWindow.FB) {
        addToast({
          type: "warning",
          title: "SDK indisponivel",
          description:
            "A SDK da Meta ainda nao foi carregada. Aguarde alguns segundos e tente novamente.",
        });
        return;
      }

      setIsConnecting(true);

      metaWindow.FB.login((response) => {
        void (async () => {
          try {
            const signupCode = response?.authResponse?.code;
            const accessToken = response?.authResponse?.accessToken;

            if (!signupCode && !accessToken) {
              throw new Error(
                "A Meta nao retornou code/access token para concluir a vinculacao.",
              );
            }

            const validation = await MetaAdsService.validateAssets({
              empresaId: user.empresa_id,
              signupCode,
              accessToken,
              redirectUri: metaAdsDefaultRedirectUri || undefined,
            });

            setValidationResult(validation);
            setAvailableAccountsAfterApproval(
              validation.available_accounts || [],
            );

            if (!(validation.available_accounts || []).length) {
              addToast({
                type: "warning",
                title: "Aprovacao concluida, mas sem ativos liberados",
                description:
                  "A autenticacao foi concluida, mas a Meta ainda nao retornou contas acessiveis. O dono da conta precisa compartilhar o ativo com o business parceiro antes da importação aparecer aqui.",
              });
              await fetchIntegrationStatus();
              await fetchAccounts();
              return;
            }

            setValidationResult(null);

            const selectedAdAccountIds = (validation.available_accounts || [])
              .map((account) => String(account.id || ""))
              .filter(Boolean);

            const result = await MetaAdsService.saveIntegration({
              empresaId: user.empresa_id,
              signupCode,
              accessToken,
              redirectUri: metaAdsDefaultRedirectUri || undefined,
              selectedAdAccountIds,
            });

            setAvailableAccountsAfterApproval(result.available_accounts || []);

            addToast({
              type: "success",
              title: "Ativos liberados e importados",
              description:
                "A Meta retornou contas acessiveis e a plataforma salvou automaticamente as contas liberadas para esta empresa.",
            });

            await fetchIntegrationStatus();
            await fetchAccounts();
          } catch (error) {
            console.error(
              "[MetaAdsSettings] erro ao salvar integracao:",
              error,
            );
            addToast({
              type: "error",
              title: "Erro ao vincular contas",
              description:
                error instanceof Error
                  ? error.message
                  : "Nao foi possivel vincular as contas de anuncio.",
            });
          } finally {
            setIsConnecting(false);
          }
        })();
      }, metaEmbeddedSignupOptions);
    })();
  }, [
    addToast,
    fetchAccounts,
    fetchIntegrationStatus,
    isMetaSdkReady,
    metaAdsConfigId,
    metaAdsDefaultRedirectUri,
    metaEmbeddedSignupOptions,
    user?.empresa_id,
    waitForMetaSdk,
  ]);

  const handleLoadCampaigns = useCallback(async () => {
    if (!selectedAdAccountId) {
      setCampaignsError("Selecione uma conta de anuncio para consultar.");
      return;
    }

    if (
      campaignStartDate &&
      campaignEndDate &&
      campaignStartDate > campaignEndDate
    ) {
      setCampaignsError("A data inicial nao pode ser maior que a data final.");
      setIsAccountSelectionLoading(false);
      return;
    }

    try {
      setIsLoadingCampaigns(true);
      setCampaignsError("");
      const result = await MetaAdsService.listCampaigns({
        empresaId: user?.empresa_id || 0,
        actAdAccount: selectedAdAccountId,
        onlyActive: onlyActiveCampaigns,
        startDate: campaignStartDate || undefined,
        endDate: campaignEndDate || undefined,
      });
      setCampaignsResult(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel consultar campanhas.";
      setCampaignsError(message);
      addToast({
        type: "error",
        title: "Erro ao consultar campanhas",
        description: message,
      });
    } finally {
      setIsLoadingCampaigns(false);
      setIsAccountSelectionLoading(false);
    }
  }, [
    addToast,
    campaignEndDate,
    campaignStartDate,
    onlyActiveCampaigns,
    selectedAdAccountId,
  ]);

  const campaigns = campaignsResult?.data || [];
  const totalSpend = campaignsResult?.total_spend;
  const partnerLabel = `${metaBusinessName}${metaBusinessId ? ` (${metaBusinessId})` : ""}`;

  const campaignRows = useMemo(
    () =>
      campaigns.map((campaign) => {
        const baseMetrics = getCampaignBaseMetrics(campaign);
        const spend = baseMetrics.spend;
        const impressions = baseMetrics.impressions;
        const clicks = baseMetrics.clicks;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const status = resolveCampaignStatus(campaign);
        const objective = String(campaign.objective || "-");
        const leads = getCampaignActionsTotal(campaign, [
          "lead",
          "onsite_conversion.lead_grouped",
          "onsite_conversion.lead",
          "offsite_conversion.fb_pixel_lead",
          "qualified_lead",
        ]);
        const purchases = getCampaignActionsTotal(campaign, [
          "purchase",
          "omni_purchase",
          "offsite_conversion.fb_pixel_purchase",
        ]);

        return {
          campaign,
          id: String(campaign.id || "-"),
          name: String(campaign.name || "-"),
          status,
          objective,
          spend,
          impressions,
          clicks,
          ctr,
          cpc,
          leads,
          purchases,
        };
      }),
    [campaigns],
  );

  const campaignStatusOptions = useMemo(() => {
    const unique = new Set<string>();
    campaignRows.forEach((row) => unique.add(row.status));
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [campaignRows]);

  const campaignObjectiveOptions = useMemo(() => {
    const unique = new Set<string>();
    campaignRows.forEach((row) => unique.add(row.objective));
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [campaignRows]);

  useEffect(() => {
    if (
      campaignStatusFilter !== "all" &&
      !campaignStatusOptions.includes(campaignStatusFilter)
    ) {
      setCampaignStatusFilter("all");
    }
  }, [campaignStatusFilter, campaignStatusOptions]);

  useEffect(() => {
    if (
      campaignObjectiveFilter !== "all" &&
      !campaignObjectiveOptions.includes(campaignObjectiveFilter)
    ) {
      setCampaignObjectiveFilter("all");
    }
  }, [campaignObjectiveFilter, campaignObjectiveOptions]);

  const filteredCampaignRows = useMemo(() => {
    const normalizedSearch = campaignSearchTerm.trim().toLowerCase();

    return campaignRows.filter((row) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.id.toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        campaignStatusFilter === "all" || row.status === campaignStatusFilter;
      const matchesObjective =
        campaignObjectiveFilter === "all" ||
        row.objective === campaignObjectiveFilter;

      return matchesSearch && matchesStatus && matchesObjective;
    });
  }, [
    campaignObjectiveFilter,
    campaignRows,
    campaignSearchTerm,
    campaignStatusFilter,
  ]);

  const dashboardMetrics = useMemo(() => {
    const totals = filteredCampaignRows.reduce(
      (acc, row) => ({
        spend: acc.spend + row.spend,
        impressions: acc.impressions + row.impressions,
        clicks: acc.clicks + row.clicks,
        leads: acc.leads + row.leads,
        purchases: acc.purchases + row.purchases,
      }),
      { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0 },
    );

    return {
      totalCampaigns: filteredCampaignRows.length,
      ...totals,
      ctr:
        totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    };
  }, [filteredCampaignRows]);

  const handleOpenCampaignAds = useCallback(
    async (campaign: MetaAdsCampaign) => {
      if (!user?.empresa_id) {
        setCampaignAdsError(
          "Usuario sem empresa vinculada para consultar anuncios.",
        );
        setSelectedCampaign(campaign);
        return;
      }

      if (!campaign.id) {
        setCampaignAdsError("Campanha sem ID valido para consultar anuncios.");
        setSelectedCampaign(campaign);
        return;
      }

      setSelectedCampaign(campaign);
      setCampaignAds([]);
      setCampaignAdsError("");
      setFilteredCampaignResult(null);
      setFilteredCampaignError("");
      setCampaignFilterStartDate(campaignStartDate || getTodayDateInput());
      setCampaignFilterEndDate(campaignEndDate || getTodayDateInput());

      try {
        setIsLoadingAds(true);
        const ads = await MetaAdsService.listAds({
          empresaId: user.empresa_id,
          campaignId: campaign.id,
          actAdAccount: selectedAdAccountId || undefined,
        });
        setCampaignAds(ads);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Nao foi possivel consultar anuncios da campanha.";
        setCampaignAdsError(message);
        addToast({
          type: "error",
          title: "Erro ao carregar anuncios",
          description: message,
        });
      } finally {
        setIsLoadingAds(false);
      }
    },
    [
      addToast,
      campaignEndDate,
      campaignStartDate,
      selectedAdAccountId,
      user?.empresa_id,
    ],
  );

  const handleLoadFilteredCampaign = useCallback(async () => {
    if (!user?.empresa_id || !selectedCampaign?.id) {
      return;
    }

    if (
      campaignFilterStartDate &&
      campaignFilterEndDate &&
      campaignFilterStartDate > campaignFilterEndDate
    ) {
      setFilteredCampaignError(
        "A data inicial nao pode ser maior que a data final.",
      );
      return;
    }

    try {
      setIsLoadingFilteredCampaign(true);
      setFilteredCampaignError("");
      const result = await MetaAdsService.getCampaignFilteredMetrics({
        empresaId: user.empresa_id,
        campaignId: selectedCampaign.id,
        startDate: campaignFilterStartDate || undefined,
        endDate: campaignFilterEndDate || undefined,
      });
      setFilteredCampaignResult(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel consultar a campanha no periodo.";
      setFilteredCampaignError(message);
      addToast({
        type: "error",
        title: "Erro ao consultar campanha",
        description: message,
      });
    } finally {
      setIsLoadingFilteredCampaign(false);
    }
  }, [
    addToast,
    campaignFilterEndDate,
    campaignFilterStartDate,
    selectedCampaign?.id,
    user?.empresa_id,
  ]);

  const handleCloseCampaignAdsModal = useCallback(() => {
    setSelectedCampaign(null);
    setCampaignAds([]);
    setCampaignAdsError("");
    setIsLoadingAds(false);
    setCampaignFilterStartDate("");
    setCampaignFilterEndDate("");
    setFilteredCampaignResult(null);
    setFilteredCampaignError("");
    setIsLoadingFilteredCampaign(false);
  }, []);

  useEffect(() => {
    if (!isManagementModule) return;
    if (!isIntegrationActive) return;
    if (!selectedAdAccountId) {
      setCampaignsResult(null);
      return;
    }

    const debounceId = window.setTimeout(() => {
      void handleLoadCampaigns();
    }, 200);

    return () => window.clearTimeout(debounceId);
  }, [
    campaignEndDate,
    campaignStartDate,
    handleLoadCampaigns,
    isIntegrationActive,
    isManagementModule,
    onlyActiveCampaigns,
    selectedAdAccountId,
  ]);

  const campaignAdsRows = useMemo(
    () =>
      campaignAds.map((ad, index) => {
        const insight = getAdInsight(ad);
        const impressions = toNumber(insight?.impressions);
        const reach = toNumber(insight?.reach);
        const spend = toNumber(insight?.spend);
        const clicks = toNumber((insight as { clicks?: unknown })?.clicks);
        const ctr = toNumber(insight?.ctr);
        const cpc = toNumber(insight?.cpc);
        const cpm = toNumber(insight?.cpm);

        return {
          key: ad.id || `campaign-ad-${index}`,
          name: ad.name || "-",
          id: ad.id || "-",
          status: ad.status || "-",
          spend,
          impressions,
          reach,
          clicks,
          ctr,
          cpc,
          cpm,
        };
      }),
    [campaignAds],
  );

  const selectedCampaignRow = useMemo(
    () =>
      campaignRows.find(
        (row) => row.campaign.id && row.campaign.id === selectedCampaign?.id,
      ) || null,
    [campaignRows, selectedCampaign?.id],
  );

  const filteredCampaignLeads = useMemo(
    () =>
      getCampaignActionsTotal(
        {
          insights: {
            data: filteredCampaignResult
              ? [
                  {
                    actions: filteredCampaignResult.actions,
                  },
                ]
              : [],
          },
        } as MetaAdsCampaign,
        [
          "lead",
          "onsite_conversion.lead_grouped",
          "onsite_conversion.lead",
          "offsite_conversion.fb_pixel_lead",
          "qualified_lead",
        ],
      ),
    [filteredCampaignResult],
  );

  const filteredCampaignPurchases = useMemo(
    () =>
      getCampaignActionsTotal(
        {
          insights: {
            data: filteredCampaignResult
              ? [
                  {
                    actions: filteredCampaignResult.actions,
                  },
                ]
              : [],
          },
        } as MetaAdsCampaign,
        ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"],
      ),
    [filteredCampaignResult],
  );
  const hasSelectedAccount = Boolean(selectedAdAccountId);
  const selectedAccount = accounts.find(
    (account) => account.ad_account_id === selectedAdAccountId,
  );
  const hasPendingCampaignDateRange =
    draftCampaignStartDate !== campaignStartDate ||
    draftCampaignEndDate !== campaignEndDate;
  const isCampaignContentLoading =
    isLoadingCampaigns && !isAccountSelectionLoading;
  const hasActiveCampaignFilters = Boolean(
    draftCampaignStartDate ||
    draftCampaignEndDate ||
    campaignStatusFilter !== "all" ||
    campaignObjectiveFilter !== "all",
  );
  const campaignDateRangeLabel =
    campaignStartDate || campaignEndDate
      ? `${campaignStartDate || "-"} ate ${campaignEndDate || "-"}`
      : "Periodo completo";

  const handleExportSelectedCampaign = useCallback(() => {
    if (!selectedCampaign) {
      addToast({
        type: "warning",
        title: "Campanha nao selecionada",
        description: "Selecione uma campanha para exportar os detalhes.",
      });
      return;
    }

    setIsExportingSelectedCampaign(true);

    try {
      const summaryRows = [
        {
          "Campanha": selectedCampaign.name || selectedCampaignRow?.name || "-",
          "Periodo consultado":
            filteredCampaignResult
              ? `${filteredCampaignResult.data_inicio || "-"} ate ${filteredCampaignResult.data_fim || "-"}`
              : `${campaignFilterStartDate || "-"} ate ${campaignFilterEndDate || "-"}`,
          "Status":
            filteredCampaignResult?.status ||
            selectedCampaignRow?.status ||
            resolveCampaignStatus(selectedCampaign),
          "Objetivo":
            filteredCampaignResult?.objective ||
            selectedCampaignRow?.objective ||
            selectedCampaign.objective ||
            "-",
          "Investimento":
            filteredCampaignResult
              ? formatCurrency(filteredCampaignResult.spend)
              : formatCurrency(selectedCampaignRow?.spend || 0),
          "Impressoes":
            filteredCampaignResult
              ? formatNumber(filteredCampaignResult.impressions)
              : formatNumber(selectedCampaignRow?.impressions || 0),
          "Cliques":
            filteredCampaignResult
              ? formatNumber(filteredCampaignResult.clicks)
              : formatNumber(selectedCampaignRow?.clicks || 0),
          "CTR":
            filteredCampaignResult
              ? formatPercent(
                  toNumber(filteredCampaignResult.impressions) > 0
                    ? (toNumber(filteredCampaignResult.clicks) /
                        toNumber(filteredCampaignResult.impressions)) *
                        100
                    : 0,
                )
              : formatPercent(selectedCampaignRow?.ctr || 0),
          "CPC":
            filteredCampaignResult
              ? formatCurrency(
                  toNumber(filteredCampaignResult.clicks) > 0
                    ? toNumber(filteredCampaignResult.spend) /
                        toNumber(filteredCampaignResult.clicks)
                    : 0,
                )
              : formatCurrency(selectedCampaignRow?.cpc || 0),
          "Leads": formatNumber(
            filteredCampaignResult
              ? filteredCampaignLeads
              : selectedCampaignRow?.leads || 0,
          ),
          "Compras": formatNumber(
            filteredCampaignResult
              ? filteredCampaignPurchases
              : selectedCampaignRow?.purchases || 0,
          ),
          "Status efetivo":
            filteredCampaignResult?.effective_status ||
            selectedCampaign.effective_status ||
            "-",
          "Status configurado":
            filteredCampaignResult?.configured_status ||
            selectedCampaign.configured_status ||
            "-",
          "Inicio da campanha":
            filteredCampaignResult?.start_time ||
            selectedCampaign.start_time ||
            "-",
          "Criada em":
            filteredCampaignResult?.created_time ||
            selectedCampaign.created_time ||
            "-",
          "Orcamento diario": formatCurrency(
            filteredCampaignResult?.daily_budget ||
              selectedCampaign.daily_budget ||
              0,
          ),
        },
      ];

      const adsRows = campaignAdsRows.map((row) => ({
        "Anuncio": row.name,
        "Status": row.status,
        "Investimento": formatCurrency(row.spend),
        "Impressoes": formatNumber(row.impressions),
        "Alcance": formatNumber(row.reach),
        "Cliques": formatNumber(row.clicks),
        "CTR": formatPercent(row.ctr),
        "CPC": formatCurrency(row.cpc),
        "CPM": formatCurrency(row.cpm),
      }));

      exportMetaAdsCampaignDetail({
        campaignName: selectedCampaign.name || selectedCampaignRow?.name || "campanha",
        summaryRows,
        adsRows,
      });

      addToast({
        type: "success",
        title: "Exportacao concluida",
        description: "Os detalhes da campanha foram exportados com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao exportar",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel exportar os detalhes da campanha.",
      });
    } finally {
      setIsExportingSelectedCampaign(false);
    }
  }, [
    addToast,
    campaignAdsRows,
    campaignFilterEndDate,
    campaignFilterStartDate,
    filteredCampaignLeads,
    filteredCampaignPurchases,
    filteredCampaignResult,
    selectedCampaign,
    selectedCampaignRow,
  ]);

  const handleExportAccountOverview = useCallback(() => {
    if (!selectedAccount) {
      addToast({
        type: "warning",
        title: "Conta nao selecionada",
        description: "Selecione uma conta para exportar as informacoes gerais.",
      });
      return;
    }

    setIsExportingAccountOverview(true);

    try {
      const summaryRows = [
        {
          "Conta": selectedAccount.ad_account_name || "Sem nome",
          "Conta ID": selectedAccount.ad_account_id || "-",
          "Business": selectedAccount.business_name || "-",
          "Status da conta": selectedAccount.ad_account_status || "-",
          "Periodo atual": campaignDateRangeLabel,
          "Status da campanha":
            campaignStatusFilter === "all" ? "Todos os status" : campaignStatusFilter,
          "Objetivo":
            campaignObjectiveFilter === "all" ? "Todos os objetivos" : campaignObjectiveFilter,
          "Somente campanhas ativas": onlyActiveCampaigns ? "Sim" : "Nao",
          "Total de campanhas": dashboardMetrics.totalCampaigns,
          "Investimento": formatCurrency(dashboardMetrics.spend),
          "Impressoes": formatNumber(dashboardMetrics.impressions),
          "Cliques": formatNumber(dashboardMetrics.clicks),
          "CTR medio": formatPercent(dashboardMetrics.ctr),
          "CPC medio": formatCurrency(dashboardMetrics.cpc),
          "Leads": formatNumber(dashboardMetrics.leads),
          "Compras": formatNumber(dashboardMetrics.purchases),
          "Resumo API - Investimento": formatCurrency(totalSpend?.spend),
          "Resumo API - Cliques": formatNumber(totalSpend?.clicks),
          "Resumo API - Alcance": formatNumber(totalSpend?.reach),
          "Resumo API - CPC": formatCurrency(totalSpend?.cpc),
          "Resumo API - CPM": formatCurrency(totalSpend?.cpm),
        },
      ];

      const campaignRows = filteredCampaignRows.map((row) => ({
        "Campanha": row.name,
        "Status": row.status,
        "Objetivo": row.objective,
        "Investimento": formatCurrency(row.spend),
        "Impressoes": formatNumber(row.impressions),
        "Cliques": formatNumber(row.clicks),
        "CTR": formatPercent(row.ctr),
        "CPC": formatCurrency(row.cpc),
        "Leads": formatNumber(row.leads),
        "Compras": formatNumber(row.purchases),
      }));

      exportMetaAdsAccountOverview({
        accountName: selectedAccount.ad_account_name || selectedAccount.ad_account_id || "conta",
        summaryRows,
        campaignRows,
      });

      addToast({
        type: "success",
        title: "Exportacao concluida",
        description: "As informacoes gerais da conta foram exportadas com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao exportar",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel exportar as informacoes gerais da conta.",
      });
    } finally {
      setIsExportingAccountOverview(false);
    }
  }, [
    addToast,
    campaignDateRangeLabel,
    campaignObjectiveFilter,
    campaignStatusFilter,
    dashboardMetrics,
    filteredCampaignRows,
    onlyActiveCampaigns,
    selectedAccount,
    totalSpend,
  ]);

  return (
    <div className="api-meta-settings-container">
      {isIntegrationModule && (
        <header className="api-meta-hero">
          <div className="page-actions">
            <span className="api-meta-eyebrow">Meta Ads</span>
            <h2>Aprove o acesso e importe as contas liberadas</h2>
            {/* comentado temporariamente <p>
              O fluxo correto e mais automatico e: a empresa aprova o acesso na
              Meta, o sistema valida quais contas de anuncio ficaram realmente
              acessiveis e salva apenas essas contas para uso na plataforma.
            </p> */}
            {/* <div className="meta-ads-partner-card">
              <div className="meta-ads-partner-card__header">
                <span className="meta-ads-partner-card__eyebrow">
                  Parceiro que deve ser aprovado
                </span>
                <h3>{metaBusinessName}</h3>
              </div>
              <div className="meta-ads-partner-card__grid">
                <div className="meta-ads-partner-card__item">
                  <span>Business ID</span>
                  <strong>{metaBusinessId}</strong>
                </div>
                <div className="meta-ads-partner-card__item">
                  <span>Acesso esperado</span>
                  <strong>Ads Read / Ads Management</strong>
                </div>
              </div>
            </div> */}
            <div className="meta-integration-status-field">
              <label htmlFor="meta-ads-integration-status">
                Status da integração:
              </label>
              <input
                id="meta-ads-integration-status"
                type="text"
                className={`meta-integration-status-input meta-integration-status-input--${statusTone}`}
                value={
                  isLoadingStatus ? "Consultando status..." : integrationStatus
                }
                readOnly
              />
            </div>
            <button
              type="button"
              className="add-button meta-connect-button"
              onClick={handleMetaAdsLogin}
              // disabled={!isMetaSdkReady || isConnecting}
            >
              {isConnecting
                ? "Solicitando aprovacao..."
                : "Aprovar acesso na Meta Ads"}
            </button>
          </div>
        </header>
      )}

      {isIntegrationModule && (
        <section className="meta-config-section">
          {/* <div className="meta-ads-onboarding-card">
            <div className="meta-ads-onboarding-card__header">
              <div>
                <h3>Tutorial de aprovacao</h3>
                <p>
                  A tela nao tenta forcar ativos. Primeiro o cliente aprova o
                  parceiro na Meta. Depois a plataforma importa apenas o que a
                  API devolver como acessivel.
                </p>
              </div>
              <a
                className="meta-secondary-button meta-ads-onboarding-link"
                href={businessSettingsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir Business Manager
              </a>
            </div>

            <div className="meta-ads-onboarding-steps">
              <article className="meta-ads-onboarding-step">
                <span className="meta-ads-onboarding-step__number">1</span>
                <div>
                  <h4>Solicite a aprovacao</h4>
                  <p>
                    Clique em <strong>Aprovar acesso na Meta Ads</strong> para
                    abrir o fluxo oficial da Meta.
                  </p>
                </div>
              </article>

              <article className="meta-ads-onboarding-step">
                <span className="meta-ads-onboarding-step__number">2</span>
                <div>
                  <h4>O cliente aprova o parceiro</h4>
                  <p>
                    No lado da Meta, o cliente deve localizar o parceiro{" "}
                    <strong>{partnerLabel}</strong> e concluir a aprovacao do
                    business e dos ativos de anuncios.
                  </p>
                </div>
              </article>

              <article className="meta-ads-onboarding-step">
                <span className="meta-ads-onboarding-step__number">3</span>
                <div>
                  <h4>As contas liberadas sao importadas</h4>
                  <p>
                    Quando a Meta devolver as contas acessiveis, elas aparecem
                    automaticamente na lista da empresa.
                  </p>
                </div>
              </article>
            </div>

            <div className="meta-ads-onboarding-help">
              <h4>Se a conta nao aparecer depois da aprovacao</h4>
              <p>
                O dono da conta ainda precisa compartilhar o ativo com{" "}
                <strong>{partnerLabel}</strong> no portifolio da Meta.
              </p>
              <p>
                Depois disso, volte aqui e use <strong>Atualizar lista</strong>
                para importar as contas acessiveis.
              </p>
            </div>
          </div> */}
        </section>
      )}

      {isIntegrationModule &&
        validationResult &&
        !validationResult.liberado && (
          <section className="meta-config-section">
            <div className="meta-ads-onboarding-help">
              <h4>Aprovacao concluida, mas a Meta ainda nao liberou contas</h4>
              <p>
                O acesso foi aprovado, porem o endpoint da Meta ainda nao
                retornou contas em <strong>/me/adaccounts</strong> para este
                fluxo.
              </p>
              <p>
                O dono da conta de anuncio precisa compartilhar o ativo com{" "}
                <strong>{partnerLabel}</strong> e depois voce pode repetir a
                validacao.
              </p>
            </div>
          </section>
        )}

      {isIntegrationModule &&
        hasAccountsAfterApproval &&
        !hasLinkedAccounts && (
          <section className="meta-config-section">
            <h3>Contas aprovadas pela Meta</h3>
            <p>
              A Meta retornou estas contas no fluxo de aprovacao. Se a lista
              salva abaixo ainda nao refletiu isso, atualize a tela em alguns
              instantes.
            </p>
            <div className="meta-template-list">
              {availableAccountsAfterApproval.map((account, index) => (
                <article
                  key={account.id || `approved-account-${index}`}
                  className="meta-template-item"
                >
                  <div className="meta-template-item-meta">
                    <p>
                      <strong>Conta:</strong> {account.name || "Sem nome"}
                    </p>
                    <p>
                      <strong>ID:</strong> {account.id || "-"}
                    </p>
                    <p>
                      <strong>Business:</strong> {account.business?.name || "-"}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      {account.account_status == null
                        ? "-"
                        : String(account.account_status)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

      {isManagementModule && (
        <section className="meta-config-section">
          {!isIntegrationActive && (
            <div className="meta-template-list-section">
              <section className="meta-config-section">
                <h3>Recursos da integracao</h3>
                <p>
                  O traqueamento so fica disponivel quando a Meta realmente
                  liberar pelo menos uma conta de anuncio para este business.
                </p>
                <p>
                  Se a aprovacao ja foi feita e a lista ainda esta vazia, o dono
                  da conta de anuncio precisa compartilhar o ativo com{" "}
                  <strong>{metaBusinessName}</strong>
                  {metaBusinessId ? ` (${metaBusinessId})` : ""}.
                </p>
                <p>
                  Depois disso, use <strong>Atualizar lista</strong> para
                  importar as contas acessiveis.
                </p>
                <p>
                  <a
                    href={businessSettingsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir configuracoes do Business Manager
                  </a>
                </p>
              </section>
            </div>
          )}

          {isIntegrationActive && (
            <div className="meta-template-list-section">
              <div className="meta-template-list-header">
                <div>
                  <h3>Contas vinculadas</h3>
                  <p>
                    Veja abaixo as contas de anuncio salvas para a empresa
                    atual.
                  </p>
                  <p>
                    Clique em uma conta para carregar as informações e liberar
                    os filtros de tracking.
                  </p>
                </div>
                <div className="meta-template-actions">
                  <button
                    type="button"
                    className="meta-secondary-button"
                    onClick={() => {
                      void fetchIntegrationStatus();
                      void fetchAccounts();
                    }}
                    disabled={isLoadingStatus || isLoadingAccounts}
                  >
                    {isLoadingAccounts ? "Atualizando..." : "Atualizar lista"}
                  </button>
                </div>
              </div>

              {isLoadingAccounts ? (
                <p>Carregando contas de anuncio...</p>
              ) : accounts.length === 0 ? (
                <div>
                  <p>Nenhuma conta de anuncio salva para esta empresa.</p>
                  <p>
                    Isso normalmente significa que a autenticacao foi feita, mas
                    a Meta ainda nao liberou nenhum ativo para o business
                    parceiro.
                  </p>
                </div>
              ) : (
                <div className="meta-template-list">
                  {accounts.map((account, index) => {
                    const accountId = account.ad_account_id || "";
                    const isSelected =
                      accountId !== "" && accountId === selectedAdAccountId;
                    const cardStateClass = !hasSelectedAccount
                      ? "meta-ads-account-card--initial"
                      : isSelected
                        ? "meta-ads-account-card--selected meta-template-item--active"
                        : "meta-ads-account-card--muted";

                    return (
                      <button
                        key={
                          account.id ||
                          `${account.ad_account_id || "ad-account"}-${index}`
                        }
                        type="button"
                        className={`meta-template-item meta-template-item--interactive meta-ads-account-card ${cardStateClass}`}
                        onClick={() => {
                          setSelectedAdAccountId((current) => {
                            const nextValue =
                              current === accountId ? "" : accountId;
                            setIsAccountSelectionLoading(nextValue !== "");
                            return nextValue;
                          });
                        }}
                        aria-pressed={isSelected}
                      >
                        <div className="meta-template-item-meta meta-ads-account-card-meta">
                          <div className="meta-ads-account-card-header">
                            <p className="meta-ads-account-card-name">
                              {account.ad_account_name || "Sem nome"}
                            </p>
                          </div>
                          <p>
                            <strong>ID:</strong> {account.ad_account_id || "-"}
                          </p>
                          <p>
                            <strong>Business:</strong>{" "}
                            {account.business_name || "-"}
                          </p>
                          <p>
                            <strong>Status:</strong>{" "}
                            {account.ad_account_status || "-"}
                          </p>
                          <p>
                            <strong>Moeda:</strong> {account.currency || "-"}
                          </p>
                          <p>
                            <strong>Fuso:</strong>{" "}
                            {account.timezone_name ||
                              account.timezone_id ||
                              "-"}
                          </p>
                        </div>
                        <span className="meta-template-card-footer">
                          <span className="meta-template-card-cta">
                            Ver métricas
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {hasSelectedAccount && selectedAccount && (
                <section
                  ref={trackingSectionRef}
                  className="meta-ads-campaigns-section"
                >
                  <div className="meta-template-list-header meta-ads-dashboard-header">
                    <div>
                      <h3>Tracking de campanhas</h3>
                      <p>
                        <strong>Conta:</strong>{" "}
                        {selectedAccount.ad_account_name || "Sem nome"}
                      </p>
                    </div>
                  </div>

                  {isAccountSelectionLoading ? (
                    <div
                      className="meta-insights-media-loading"
                      aria-live="polite"
                    >
                      <div
                        className="meta-insights-media-loading__spinner"
                        aria-hidden="true"
                      />
                      <div className="meta-insights-media-loading__text">
                        <strong>Carregando tracking da conta...</strong>
                        <span>
                          Aguarde enquanto a Meta prepara campanhas, filtros e
                          indicadores.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="meta-ads-dashboard-controls">
                        <div className="meta-ads-dashboard-controls-left">
                          <div className="meta-ads-campaigns-filters">
                            <div className="meta-ads-period-filter-group">
                              <span className="meta-ads-period-filter-label">
                                Periodo atual: {campaignDateRangeLabel}
                              </span>
                              <button
                                type="button"
                                className="meta-secondary-button-periodo"
                                onClick={() => {
                                  setDraftCampaignStartDate(campaignStartDate);
                                  setDraftCampaignEndDate(campaignEndDate);
                                  setIsCampaignDateModalOpen(true);
                                }}
                                disabled={isLoadingCampaigns}
                              >
                                Selecione um periodo
                              </button>
                            </div>
                            <label>
                              Status da campanha
                              <select
                                value={campaignStatusFilter}
                                onChange={(event) =>
                                  setCampaignStatusFilter(event.target.value)
                                }
                              >
                                <option value="all">Todos os status</option>
                                {campaignStatusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              Objetivo
                              <select
                                value={campaignObjectiveFilter}
                                onChange={(event) =>
                                  setCampaignObjectiveFilter(event.target.value)
                                }
                              >
                                <option value="all">Todos os objetivos</option>
                                {campaignObjectiveOptions.map((objective) => (
                                  <option key={objective} value={objective}>
                                    {objective}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <button
                              type="button"
                              className={
                                hasActiveCampaignFilters
                                  ? "meta-secondary-button meta-secondary-button--highlighted"
                                  : "meta-secondary-button"
                              }
                              onClick={() => {
                                setCampaignStartDate("");
                                setCampaignEndDate("");
                                setDraftCampaignStartDate("");
                                setDraftCampaignEndDate("");
                                setCampaignStatusFilter("all");
                                setCampaignObjectiveFilter("all");
                                setOnlyActiveCampaigns(false);
                              }}
                              disabled={
                                isLoadingCampaigns || !hasActiveCampaignFilters
                              }
                            >
                              Limpar filtros
                            </button>
                            <button
                              type="button"
                              className="add-button"
                              onClick={handleExportAccountOverview}
                              disabled={
                                isLoadingCampaigns ||
                                isExportingAccountOverview ||
                                !selectedAccount
                              }
                            >
                              <FiDownload size={14} />
                              {isExportingAccountOverview
                                ? "Exportando..."
                                : "Exportar conta"}
                            </button>
                          </div>

                          <div className="meta-ads-campaigns-filters meta-ads-campaigns-filters--secondary"></div>

                          <div className="meta-ads-campaigns-actions" />
                        </div>
                      </div>

                      {isCampaignContentLoading ? (
                        <div
                          className="meta-insights-media-loading"
                          aria-live="polite"
                        >
                          <div
                            className="meta-insights-media-loading__spinner"
                            aria-hidden="true"
                          />
                          <div className="meta-insights-media-loading__text">
                            <strong>Atualizando conteudo...</strong>
                            <span>
                              Aguarde enquanto os cards e campanhas sao
                              recalculados com os filtros aplicados.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          {campaignsError && (
                            <p className="meta-template-metrics-error">
                              {campaignsError}
                            </p>
                          )}

                          {campaignsResult && (
                            <div className="meta-ads-dashboard-kpis">
                              <article className="meta-ads-dashboard-kpi-card">
                                <p className="meta-ads-dashboard-kpi-label">
                                  Investimento
                                </p>
                                <strong>
                                  {formatCurrency(dashboardMetrics.spend)}
                                </strong>
                                <span>
                                  {dashboardMetrics.totalCampaigns} campanha(s)
                                  no filtro
                                </span>
                              </article>
                              <article className="meta-ads-dashboard-kpi-card">
                                <p className="meta-ads-dashboard-kpi-label">
                                  Impressoes
                                </p>
                                <strong>
                                  {formatNumber(dashboardMetrics.impressions)}
                                </strong>
                                <span>
                                  Cliques:{" "}
                                  {formatNumber(dashboardMetrics.clicks)}
                                </span>
                              </article>
                              <article className="meta-ads-dashboard-kpi-card">
                                <p className="meta-ads-dashboard-kpi-label">
                                  CTR medio
                                </p>
                                <strong>
                                  {formatPercent(dashboardMetrics.ctr)}
                                </strong>
                                <span>
                                  CPC medio:{" "}
                                  {formatCurrency(dashboardMetrics.cpc)}
                                </span>
                              </article>
                              <article className="meta-ads-dashboard-kpi-card">
                                <p className="meta-ads-dashboard-kpi-label">
                                  Leads / Compras
                                </p>
                                <strong>
                                  {formatNumber(dashboardMetrics.leads)} /{" "}
                                  {formatNumber(dashboardMetrics.purchases)}
                                </strong>
                                <span>Acoes de conversao consolidadas</span>
                              </article>
                            </div>
                          )}

                          {totalSpend && (
                            <div className="meta-ads-campaigns-summary">
                              {(totalSpend.date_start ||
                                totalSpend.date_stop) && (
                                <p>
                                  <strong>Periodo:</strong>{" "}
                                  {totalSpend.date_start || "-"} ate{" "}
                                  {totalSpend.date_stop || "-"}
                                </p>
                              )}
                              <p>
                                <strong>Resumo da API:</strong> Investimento{" "}
                                {formatCurrency(totalSpend.spend)}
                              </p>
                              <p>
                                <strong>Cliques:</strong>{" "}
                                {formatNumber(totalSpend.clicks)}
                              </p>
                              <p>
                                <strong>Alcance:</strong>{" "}
                                {formatNumber(totalSpend.reach)}
                              </p>
                              <p>
                                <strong>CPC:</strong>{" "}
                                {formatCurrency(totalSpend.cpc)}
                              </p>
                              <p>
                                <strong>CPM:</strong>{" "}
                                {formatCurrency(totalSpend.cpm)}
                              </p>
                            </div>
                          )}

                          {/* Temporariamente mantido apenas o modo Pipeline. */}
                          {filteredCampaignRows.length > 0 && (
                            <div className="meta-ads-dashboard-table-wrap meta-ads-dashboard-table-wrap--campaigns">
                              <table className="meta-ads-dashboard-table">
                                <thead>
                                  <tr>
                                    <th>Campanha</th>
                                    <th>Status</th>
                                    <th>Objetivo</th>
                                    <th>Investimento</th>
                                    <th>Impressoes</th>
                                    <th>Cliques</th>
                                    <th>CTR</th>
                                    <th>CPC</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredCampaignRows.map((row) => (
                                    <tr
                                      key={
                                        row.campaign.id ||
                                        `campaign-${row.name}`
                                      }
                                      role="button"
                                      tabIndex={0}
                                      className="meta-ads-dashboard-table-row"
                                      onClick={() => {
                                        void handleOpenCampaignAds(
                                          row.campaign,
                                        );
                                      }}
                                      onKeyDown={(event) => {
                                        if (
                                          event.key === "Enter" ||
                                          event.key === " "
                                        ) {
                                          event.preventDefault();
                                          void handleOpenCampaignAds(
                                            row.campaign,
                                          );
                                        }
                                      }}
                                    >
                                      <td>
                                        <div className="meta-ads-dashboard-campaign-cell">
                                          <strong>{row.name}</strong>
                                          <span>{row.id}</span>
                                        </div>
                                      </td>
                                      <td>
                                        <span
                                          className={`meta-ads-dashboard-status-pill ${getStatusToneClass(row.status)}`}
                                        >
                                          {row.status}
                                        </span>
                                      </td>
                                      <td>{row.objective}</td>
                                      <td>{formatCurrency(row.spend)}</td>
                                      <td>{formatNumber(row.impressions)}</td>
                                      <td>{formatNumber(row.clicks)}</td>
                                      <td>{formatPercent(row.ctr)}</td>
                                      <td>{formatCurrency(row.cpc)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {!campaignsError &&
                            campaignsResult &&
                            filteredCampaignRows.length === 0 && (
                              <p>
                                Nenhuma campanha encontrada para os filtros
                                informados.
                              </p>
                            )}
                        </>
                      )}
                    </>
                  )}
                </section>
              )}

              {selectedCampaign && (
                <div
                  className="meta-template-metrics-modal-backdrop"
                  role="presentation"
                  onClick={handleCloseCampaignAdsModal}
                >
                  <section
                    className="meta-template-metrics-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Anuncios da campanha ${selectedCampaign.name || ""}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <header className="meta-template-metrics-modal-header">
                      <div>
                        <h4>{selectedCampaign.name || "Campanha sem nome"}</h4>
                        <p>
                          <strong>ID:</strong> {selectedCampaign.id || "-"}
                        </p>
                      </div>
                      <div className="meta-template-actions">
                        <button
                          type="button"
                          className="add-button"
                          onClick={handleExportSelectedCampaign}
                          disabled={isExportingSelectedCampaign}
                        >
                          <FiDownload size={14} />
                          {isExportingSelectedCampaign
                            ? "Exportando..."
                            : "Exportar"}
                        </button>
                        <button
                          type="button"
                          className="meta-secondary-button"
                          onClick={handleCloseCampaignAdsModal}
                        >
                          Fechar
                        </button>
                      </div>
                    </header>

                    <div className="meta-template-metrics-modal-content">
                      <div className="meta-template-block">
                        <div className="meta-template-list-header">
                          <div>
                            <h3>Campanha no periodo</h3>
                            <p>
                              Periodo consultado:{" "}
                              {campaignFilterStartDate || "-"} ate{" "}
                              {campaignFilterEndDate || "-"}
                            </p>
                          </div>
                        </div>

                        <div className="meta-template-metrics-filters">
                          <label>
                            Data inicial
                            <input
                              type="date"
                              value={campaignFilterStartDate}
                              onChange={(event) =>
                                setCampaignFilterStartDate(event.target.value)
                              }
                            />
                          </label>
                          <label>
                            Data final
                            <input
                              type="date"
                              value={campaignFilterEndDate}
                              onChange={(event) =>
                                setCampaignFilterEndDate(event.target.value)
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="add-button"
                            onClick={() => {
                              void handleLoadFilteredCampaign();
                            }}
                            disabled={isLoadingFilteredCampaign}
                          >
                            {isLoadingFilteredCampaign
                              ? "Aplicando..."
                              : "Aplicar filtro"}
                          </button>
                        </div>

                        {filteredCampaignError && (
                          <p className="meta-template-metrics-error">
                            {filteredCampaignError}
                          </p>
                        )}

                        {isLoadingFilteredCampaign && (
                          <div
                            className="meta-insights-media-loading"
                            aria-live="polite"
                          >
                            <div
                              className="meta-insights-media-loading__spinner"
                              aria-hidden="true"
                            />
                            <div className="meta-insights-media-loading__text">
                              <strong>Carregando campanha no periodo...</strong>
                              <span>
                                Aguarde enquanto a Meta retorna os dados
                                detalhados da campanha selecionada.
                              </span>
                            </div>
                          </div>
                        )}

                        {filteredCampaignResult && (
                          <>
                            <div className="meta-ads-dashboard-kpis">
                              <article className="meta-ads-dashboard-kpi-card">
                                <p className="meta-ads-dashboard-kpi-label">
                                  Investimento
                                </p>
                                <strong>
                                  {formatCurrency(filteredCampaignResult.spend)}
                                </strong>
                                <span>
                                  Periodo:{" "}
                                  {filteredCampaignResult.data_inicio || "-"}{" "}
                                  ate {filteredCampaignResult.data_fim || "-"}
                                </span>
                              </article>
                              <article className="meta-ads-dashboard-kpi-card">
                                <p className="meta-ads-dashboard-kpi-label">
                                  Impressoes
                                </p>
                                <strong>
                                  {formatNumber(
                                    filteredCampaignResult.impressions,
                                  )}
                                </strong>
                                <span>
                                  Cliques:{" "}
                                  {formatNumber(filteredCampaignResult.clicks)}
                                </span>
                              </article>
                              <article className="meta-ads-dashboard-kpi-card">
                                <p className="meta-ads-dashboard-kpi-label">
                                  Leads / Compras
                                </p>
                                <strong>
                                  {formatNumber(filteredCampaignLeads)} /{" "}
                                  {formatNumber(filteredCampaignPurchases)}
                                </strong>
                                <span>
                                  Status: {filteredCampaignResult.status || "-"}
                                </span>
                              </article>
                            </div>

                            <div className="meta-ads-campaigns-summary">
                              <p>
                                <strong>Objetivo:</strong>{" "}
                                {filteredCampaignResult.objective || "-"}
                              </p>
                              <p>
                                <strong>Status efetivo:</strong>{" "}
                                {filteredCampaignResult.effective_status || "-"}
                              </p>
                              <p>
                                <strong>Status configurado:</strong>{" "}
                                {filteredCampaignResult.configured_status ||
                                  "-"}
                              </p>
                              <p>
                                <strong>Inicio da campanha:</strong>{" "}
                                {filteredCampaignResult.start_time || "-"}
                              </p>
                              <p>
                                <strong>Criada em:</strong>{" "}
                                {filteredCampaignResult.created_time || "-"}
                              </p>
                              <p>
                                <strong>Orcamento diario:</strong>{" "}
                                {formatCurrency(
                                  filteredCampaignResult.daily_budget,
                                )}
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {isLoadingAds && (
                        <div
                          className="meta-insights-media-loading"
                          aria-live="polite"
                        >
                          <div
                            className="meta-insights-media-loading__spinner"
                            aria-hidden="true"
                          />
                          <div className="meta-insights-media-loading__text">
                            <strong>Carregando anuncios da campanha...</strong>
                            <span>
                              Aguarde enquanto a Meta retorna os anuncios e os
                              indicadores detalhados da campanha.
                            </span>
                          </div>
                        </div>
                      )}

                      {!isLoadingAds && campaignAdsError && (
                        <p className="meta-template-metrics-error">
                          {campaignAdsError}
                        </p>
                      )}

                      {!isLoadingAds &&
                        !campaignAdsError &&
                        campaignAds.length === 0 && (
                          <p>Nenhum anuncio encontrado para esta campanha.</p>
                        )}

                      {!isLoadingAds &&
                        !campaignAdsError &&
                        campaignAds.length > 0 && (
                          <div className="meta-ads-modal-pipeline-table-wrap">
                            <table className="meta-ads-dashboard-table">
                              <thead>
                                <tr>
                                  <th>Anuncio</th>
                                  <th>Status</th>

                                  <th>Investimento</th>
                                  <th>Impressoes</th>
                                  <th>Alcance</th>
                                  <th>CTR</th>
                                  <th>CPC</th>
                                  <th>CPM</th>
                                </tr>
                              </thead>
                              <tbody>
                                {campaignAdsRows.map((row) => {
                                  return (
                                    <tr
                                      key={row.key}
                                      className="meta-ads-dashboard-table-row"
                                    >
                                      <td>
                                        <div className="meta-ads-dashboard-campaign-cell">
                                          <strong>{row.name}</strong>
                                          <span>{row.id}</span>
                                        </div>
                                      </td>
                                      <td>
                                        <span
                                          className={`meta-ads-dashboard-status-pill ${getStatusToneClass(row.status)}`}
                                        >
                                          {row.status}
                                        </span>
                                      </td>

                                      <td>{formatCurrency(row.spend)}</td>
                                      <td>{formatNumber(row.impressions)}</td>
                                      <td>{formatNumber(row.reach)}</td>
                                      <td>{formatPercent(row.ctr)}</td>
                                      <td>{formatCurrency(row.cpc)}</td>
                                      <td>{formatCurrency(row.cpm)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                    </div>
                  </section>
                </div>
              )}

              {isCampaignDateModalOpen && (
                <div
                  className="meta-template-metrics-modal-backdrop"
                  role="presentation"
                  onClick={() => setIsCampaignDateModalOpen(false)}
                >
                  <section
                    className="meta-template-metrics-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Definir periodo das campanhas"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <header className="meta-template-metrics-modal-header">
                      <div>
                        <h4>Buscar periodo</h4>
                        <p>
                          Defina a data inicial e final para consultar as
                          campanhas.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="meta-secondary-button"
                        onClick={() => setIsCampaignDateModalOpen(false)}
                      >
                        Fechar
                      </button>
                    </header>

                    <div className="meta-template-metrics-modal-content">
                      <div className="meta-template-metrics-filters">
                        <label>
                          Data inicial
                          <input
                            type="date"
                            value={draftCampaignStartDate}
                            onChange={(event) =>
                              setDraftCampaignStartDate(event.target.value)
                            }
                          />
                        </label>

                        <label>
                          Data final
                          <input
                            type="date"
                            value={draftCampaignEndDate}
                            onChange={(event) =>
                              setDraftCampaignEndDate(event.target.value)
                            }
                          />
                        </label>
                      </div>

                      <div className="meta-template-actions">
                        <button
                          type="button"
                          className="meta-secondary-button"
                          onClick={() => setIsCampaignDateModalOpen(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="add-button"
                          onClick={() => {
                            setCampaignStartDate(draftCampaignStartDate);
                            setCampaignEndDate(draftCampaignEndDate);
                            setIsCampaignDateModalOpen(false);
                          }}
                          disabled={!hasPendingCampaignDateRange}
                        >
                          Aplicar periodo
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function ApiMetaAdsSettings() {
  return <ApiMetaAdsSettingsModule mode="integration" />;
}

export function MetaAdsManagementSettings({
  onInitialLoadChange,
}: {
  onInitialLoadChange?: (loading: boolean) => void;
}) {
  return (
    <ApiMetaAdsSettingsModule
      mode="management"
      onInitialLoadChange={onInitialLoadChange}
    />
  );
}
