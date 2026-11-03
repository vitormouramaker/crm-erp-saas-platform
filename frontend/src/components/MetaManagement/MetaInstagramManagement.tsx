import { useCallback, useEffect, useMemo, useState } from "react";
import { FaHeart } from "react-icons/fa";
import { FiExternalLink, FiMessageCircle, FiX } from "react-icons/fi";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  MetaIgService,
  type MetaIgAccountSummaryResult,
  type MetaIgAccount,
  type MetaIgCommentItem,
  type MetaIgInsightMetric,
  type MetaIgMediaCommentsResult,
  type MetaIgMediaItem,
  type ValidateMetaIgAssetsResult,
} from "../../service/metaIgService";
import "../ApiMetaSettings/ApiMetaSettings.css";

type FacebookLoginResponse = {
  status?: string;
  authResponse?: {
    accessToken?: string;
    expiresIn?: number;
  };
};

type FacebookLoginOptions = {
  scope?: string;
  return_scopes?: boolean;
  display?: "popup";
};

type MetaIgModuleMode = "integration" | "management";
type MetaIgInsightsMediaView = "summary"| "insights" | "media" | null;
type MetaIgInsightsViewMode = "analytics" | "cards";
const MEDIA_PAGE_SIZE = 12;
const MEDIA_CAPTION_PREVIEW_LENGTH = 700;

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

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

function getSortedInsightValues(metric: MetaIgInsightMetric) {
  if (!Array.isArray(metric.values) || metric.values.length === 0) {
    return [];
  }

  return [...metric.values].sort((a, b) => {
    const timeA = a?.end_time ? new Date(a.end_time).getTime() : Number.MIN_SAFE_INTEGER;
    const timeB = b?.end_time ? new Date(b.end_time).getTime() : Number.MIN_SAFE_INTEGER;
    return timeB - timeA;
  });
}

function getInsightLatestValue(metric: MetaIgInsightMetric): string {
  const fromValues = getMostRecentInsightValue(metric);
  if (fromValues !== undefined && fromValues !== null) {
    return JSON.stringify(fromValues);
  }

  const fromTotalValue = (metric as { total_value?: { value?: unknown } })
    ?.total_value?.value;
  if (fromTotalValue !== undefined && fromTotalValue !== null) {
    return JSON.stringify(fromTotalValue);
  }

  return "-";
}

function getInsightRawValue(metric: MetaIgInsightMetric): unknown {
  const fromValues = getMostRecentInsightValue(metric);
  if (fromValues !== undefined && fromValues !== null) {
    return fromValues;
  }

  const fromTotalValue = (metric as { total_value?: { value?: unknown } })
    ?.total_value?.value;
  if (fromTotalValue !== undefined && fromTotalValue !== null) {
    return fromTotalValue;
  }

  return null;
}

function getMostRecentInsightValue(metric: MetaIgInsightMetric): unknown {
  return getSortedInsightValues(metric)[0]?.value ?? null;
}

function getInsightNumericValue(metric: MetaIgInsightMetric): number | null {
  const rawValue = getInsightRawValue(metric);
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatInsightMetricLabel(name?: string | null): string {
  const labels: Record<string, string> = {
    reach: "Alcance",
    follower_count: "Seguidores",
    accounts_engaged: "Contas engajadas",
    total_interactions: "Interacoes",
    website_clicks: "Cliques no site",
    profile_links_taps: "Toques em links",
    follows_and_unfollows: "Seguiram e deixaram de seguir",
    views: "Visualizacoes",
    profile_views: "Visualizacoes do perfil",
  };

  if (!name) return "-";
  return labels[name] || name.replaceAll("_", " ");
}

function formatInsightNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function normalizeCommentText(comment?: MetaIgCommentItem): string {
  const text = (comment?.text || "").trim();
  return text || "Comentario sem texto.";}
function formatInsightDelta(deltaPercentage: number | null): string {
  if (deltaPercentage === null || Number.isNaN(deltaPercentage)) return "-";
  return `${deltaPercentage > 0 ? "+" : ""}${deltaPercentage.toFixed(1)}%`;
}

function isVideoMedia(mediaType?: string): boolean {
  return mediaType === "VIDEO" || mediaType === "REEL";
}

type ApiMetaIgSettingsModuleProps = {
  mode: MetaIgModuleMode;
  onInitialLoadChange?: (loading: boolean) => void;
};

function ApiMetaIgSettingsModule({
  mode,
  onInitialLoadChange,
}: ApiMetaIgSettingsModuleProps) {
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
  const [accounts, setAccounts] = useState<MetaIgAccount[]>([]);
  const [availableAccountsAfterApproval, setAvailableAccountsAfterApproval] =
    useState<
      Array<{
        page_id?: string;
        page_name?: string;
        business_id?: string | null;
        business_name?: string | null;
        instagram_business_account_id?: string;
        instagram_username?: string | null;
        instagram_name?: string | null;
        instagram_profile_picture_url?: string | null;
      }>
    >([]);
  const [validationResult, setValidationResult] =
    useState<ValidateMetaIgAssetsResult | null>(null);
  const [selectedIgAccountId, setSelectedIgAccountId] = useState("");
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [insights, setInsights] = useState<MetaIgInsightMetric[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [mediaItems, setMediaItems] = useState<MetaIgMediaItem[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [accountSummary, setAccountSummary] =
    useState<MetaIgAccountSummaryResult | null>(null);
  const [activeMediaId, setActiveMediaId] = useState("");
  const [isLoadingMediaDetails, setIsLoadingMediaDetails] = useState(false);
  const [mediaDetailsError, setMediaDetailsError] = useState("");
  const [mediaCommentsById, setMediaCommentsById] = useState<
    Record<string, MetaIgMediaCommentsResult>
  >({});
  const [carouselIndexByMediaKey, setCarouselIndexByMediaKey] = useState<
    Record<string, number>
  >({});
  const [hasFetchedStatusOnce, setHasFetchedStatusOnce] = useState(false);
  const [hasFetchedAccountsOnce, setHasFetchedAccountsOnce] = useState(false);
  const [activeInsightsMediaView, setActiveInsightsMediaView] =
    useState<MetaIgInsightsMediaView>(null);
  const [insightsViewMode, setInsightsViewMode] =
    useState<MetaIgInsightsViewMode>("analytics");
  const [visibleMediaCount, setVisibleMediaCount] = useState(MEDIA_PAGE_SIZE);
  const [expandedMediaCaptions, setExpandedMediaCaptions] = useState<
    Record<string, boolean>
  >({});

  const metaAppId = String(
    import.meta.env.VITE_META_APP_ID || "",
  ).trim();
  const metaApiVersion = String(
    import.meta.env.VITE_META_API_VERSION || "v25.0",
  ).trim();

  const statusTone = useMemo(
    () => normalizeTone(integrationStatus, isLoadingStatus),
    [integrationStatus, isLoadingStatus],
  );

  const insightVisualization = useMemo(() => {
    const normalized = insights.map((metric) => {
      const numericValue = getInsightNumericValue(metric);
      const sortedValues = getSortedInsightValues(metric);
      const latestPoint = sortedValues[0];
      const previousPoint = sortedValues[1];
      const previousNumericValue =
        typeof previousPoint?.value === "number"
          ? previousPoint.value
          : typeof previousPoint?.value === "string"
            ? Number(previousPoint.value)
            : null;
      const deltaPercentage =
        numericValue !== null &&
        previousNumericValue !== null &&
        previousNumericValue !== 0
          ? ((numericValue - previousNumericValue) / previousNumericValue) * 100
          : null;

      return {
        id: metric.id || metric.name || "metric",
        name: metric.name || "-",
        label: metric.title || formatInsightMetricLabel(metric.name),
        period: metric.period || "-",
        description: metric.description || "",
        updatedAt: latestPoint?.end_time || null,
        numericValue,
        previousNumericValue,
        deltaPercentage,
        displayValue:
          numericValue !== null
            ? formatInsightNumber(numericValue)
            : getInsightLatestValue(metric),
      };
    });

    const ranked = normalized.filter((item) => item.numericValue !== null);
    const positiveMetrics = ranked.filter((item) => (item.numericValue || 0) > 0);
    const secondaryMetrics = normalized.filter(
      (item) => item.numericValue === null || item.numericValue <= 0,
    );

    const kpiPriority = [
      "views",
      "reach",
      "accounts_engaged",
      "total_interactions",
      "website_clicks",
      "profile_views",
      "follower_count",
    ];

    const prioritizedKpis = kpiPriority
      .map((metricName) =>
        positiveMetrics.find((item) => item.name === metricName),
      )
      .filter((item): item is (typeof normalized)[number] => Boolean(item));

    const fallbackKpis = [...positiveMetrics]
      .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
      .filter(
        (item) => !prioritizedKpis.some((prioritized) => prioritized.id === item.id),
      );

    const kpis = [...prioritizedKpis, ...fallbackKpis].slice(0, 4);
    const chartData = [...positiveMetrics]
      .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
      .slice(0, 6);

    return {
      allMetrics: normalized,
      kpis,
      chartData,
      secondaryMetrics,
    };
  }, [insights]);

  const metaLoginOptions: FacebookLoginOptions = useMemo(
    () => ({
      scope:
        "public_profile,pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights,business_management",
      return_scopes: true,
      display: "popup",
    }),
    [],
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
      const result = await MetaIgService.getIntegrationStatus(user.empresa_id);
      setIntegrationStatus(result.statusText);
      setIsIntegrationActive(result.isActive);
    } catch (error) {
      console.error("[MetaIgSettings] erro ao consultar status:", error);
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
      const nextAccounts = await MetaIgService.listAccounts(user.empresa_id);
      setAccounts(nextAccounts);
    } catch (error) {
      console.error("[MetaIgSettings] erro ao listar contas:", error);
      addToast({
        type: "error",
        title: "Erro ao carregar contas",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as contas Instagram.",
      });
    } finally {
      setIsLoadingAccounts(false);
      setHasFetchedAccountsOnce(true);
    }
  }, [addToast, user?.empresa_id]);

  useEffect(() => {
    if (!accounts.length) {
      setSelectedIgAccountId("");
      setActiveInsightsMediaView(null);
      return;
    }

    const hasSelectedAccount = accounts.some(
      (account) => account.instagram_business_account_id === selectedIgAccountId,
    );
    if (selectedIgAccountId && !hasSelectedAccount) {
      setSelectedIgAccountId("");
    }
  }, [accounts, selectedIgAccountId]);

  useEffect(() => {
    if (!selectedIgAccountId) {
      setActiveInsightsMediaView(null);
    }
    setAccountSummary(null);
    setSummaryError("");
    setActiveMediaId("");
    setMediaDetailsError("");
    setMediaCommentsById({});
  }, [selectedIgAccountId]);

  useEffect(() => {
    setVisibleMediaCount(MEDIA_PAGE_SIZE);
  }, [mediaItems, selectedIgAccountId]);

  useEffect(() => {
    setExpandedMediaCaptions({});
  }, [mediaItems, selectedIgAccountId]);

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
  const isInsightsMediaLoading =
    isLoadingInsights || isLoadingMedia || isLoadingSummary;
  const hasSelectedAccount = Boolean(selectedIgAccountId);
  const selectedAccount = accounts.find(
    (account) => account.instagram_business_account_id === selectedIgAccountId,
  );
  const activeMediaComments = activeMediaId
    ? mediaCommentsById[activeMediaId]
    : null;
  const activeMediaItem = activeMediaId
    ? mediaItems.find((item) => item.id === activeMediaId) || null
    : null;
  const getInsightsMediaTabClass = (
    view: Exclude<MetaIgInsightsMediaView, null>,
  ) =>
    activeInsightsMediaView === view
      ? "meta-secondary-button meta-ig-insights-media-tab meta-ig-insights-media-tab--active"
      : "meta-secondary-button meta-ig-insights-media-tab";

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

  const handleMetaIgLogin = useCallback(() => {
    if (!user?.empresa_id) return;

    const metaWindow = window as typeof window & {
      FB?: {
        login: (
          callback: (response: FacebookLoginResponse) => void,
          options?: FacebookLoginOptions,
        ) => void;
      };
    };

    void (async () => {
      const sdkAvailable = metaWindow.FB || isMetaSdkReady || (await waitForMetaSdk());

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
          const accessToken = response?.authResponse?.accessToken;

          if (!accessToken) {
            throw new Error(
              "A Meta nao retornou access token para concluir a vinculacao.",
            );
          }

          const validation = await MetaIgService.validateAssets({
            empresaId: user.empresa_id,
            accessToken,
          });

          setValidationResult(validation);
          setAvailableAccountsAfterApproval(validation.available_accounts || []);

          if (!(validation.available_accounts || []).length) {
            addToast({
              type: "warning",
              title: "Aprovacao concluida, mas sem ativos liberados",
              description:
                "A autenticacao foi concluida, mas a Meta ainda nao retornou contas Instagram acessiveis.",
            });
            await fetchIntegrationStatus();
            await fetchAccounts();
            return;
          }

          const selectedIds = (validation.available_accounts || [])
            .map((item) => item.instagram_business_account_id)
            .filter((item): item is string => Boolean(item));

          await MetaIgService.saveIntegration({
            empresaId: user.empresa_id,
            accessToken,
            selectedInstagramAccountIds: selectedIds,
          });

          addToast({
            type: "success",
            title: "Instagram vinculado",
            description:
              "As contas Instagram acessiveis foram validadas e salvas para esta empresa.",
          });

          await fetchIntegrationStatus();
          await fetchAccounts();
        } catch (error) {
          console.error("[MetaIgSettings] erro ao salvar integracao:", error);
          addToast({
            type: "error",
            title: "Erro ao vincular Instagram",
            description:
              error instanceof Error
                ? error.message
                : "Nao foi possivel vincular as contas Instagram.",
          });
        } finally {
          setIsConnecting(false);
        }
        })();
      }, metaLoginOptions);
    })();
  }, [
    addToast,
    fetchAccounts,
    fetchIntegrationStatus,
    isMetaSdkReady,
    metaLoginOptions,
    user?.empresa_id,
    waitForMetaSdk,
  ]);

  const handleLoadInsights = useCallback(async () => {
    if (!user?.empresa_id || !selectedIgAccountId) return;

    try {
      setIsLoadingInsights(true);
      setInsightsError("");
      const result = await MetaIgService.getAccountInsights({
        empresaId: user.empresa_id,
        instagramBusinessAccountId: selectedIgAccountId,
      });
      console.log("[MetaIgSettings] insights brutos:", result);
      setInsights(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar os insights da conta.";
      setInsightsError(message);
      addToast({
        type: "error",
        title: "Erro ao consultar insights",
        description: message,
      });
    } finally {
      setIsLoadingInsights(false);
    }
  }, [addToast, selectedIgAccountId, user?.empresa_id]);

  const handleLoadMedia = useCallback(async () => {
    if (!user?.empresa_id || !selectedIgAccountId) return;

    try {
      setIsLoadingMedia(true);
      setMediaError("");
      const result = await MetaIgService.listMedia({
        empresaId: user.empresa_id,
        instagramBusinessAccountId: selectedIgAccountId,
        limit: 25,
      });
      setMediaItems(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar as midias da conta.";
      setMediaError(message);
      addToast({
        type: "error",
        title: "Erro ao consultar midias",
        description: message,
      });
    } finally {
      setIsLoadingMedia(false);
    }
  }, [addToast, selectedIgAccountId, user?.empresa_id]);

  const handleLoadSummary = useCallback(async () => {
    if (!user?.empresa_id || !selectedIgAccountId) return;

    try {
      setIsLoadingSummary(true);
      setSummaryError("");
      const result = await MetaIgService.getAccountSummary({
        empresaId: user.empresa_id,
        instagramBusinessAccountId: selectedIgAccountId,
      });
      setAccountSummary(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar o resumo da conta.";
      setSummaryError(message);
      addToast({
        type: "error",
        title: "Erro ao consultar resumo da conta",
        description: message,
      });
    } finally {
      setIsLoadingSummary(false);
    }
  }, [addToast, selectedIgAccountId, user?.empresa_id]);

  const handleLoadMediaComments = useCallback(
    async (mediaId?: string) => {
      if (!user?.empresa_id || !selectedIgAccountId || !mediaId) return;

      try {
        setIsLoadingMediaDetails(true);
        setMediaDetailsError("");
        setActiveMediaId(mediaId);
        const result = await MetaIgService.getMediaComments({
          empresaId: user.empresa_id,
          instagramBusinessAccountId: selectedIgAccountId,
          mediaId,
          limit: 20,
        });

        setMediaCommentsById((current) => ({
          ...current,
          [mediaId]: result,
        }));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os comentarios da midia.";
        setMediaDetailsError(message);
        addToast({
          type: "error",
          title: "Erro ao consultar comentarios da midia",
          description: message,
        });
      } finally {
        setIsLoadingMediaDetails(false);
      }
    },
    [addToast, selectedIgAccountId, user?.empresa_id],
  );

  const handleCloseMediaCommentsModal = useCallback(() => {
    setActiveMediaId("");
    setMediaDetailsError("");
  }, []);

  useEffect(() => {
    if (!selectedIgAccountId) return;

    setActiveInsightsMediaView("summary");
    void handleLoadSummary();
  }, [handleLoadSummary, selectedIgAccountId]);

  const changeCarouselIndex = useCallback(
    (mediaKey: string, nextIndex: number, total: number) => {
      if (!total) return;

      setCarouselIndexByMediaKey((current) => {
        const normalized = ((nextIndex % total) + total) % total;
        return {
          ...current,
          [mediaKey]: normalized,
        };
      });
    },
    [],
  );

  const renderMediaPreview = useCallback(
    (item: MetaIgMediaItem, fallbackKey: string) => {
      const mediaKey = item.id || fallbackKey;
      const children = item.children?.data || [];

      if (item.media_type === "CAROUSEL_ALBUM" && children.length > 0) {
        const currentIndex = carouselIndexByMediaKey[mediaKey] || 0;
        const activeChild = children[currentIndex];
        const childIsVideo = isVideoMedia(activeChild?.media_type);
        const childVideoUrl = activeChild?.media_url || null;
        const childPosterUrl = activeChild?.thumbnail_url || activeChild?.media_url || null;

        return (
          <div style={{ marginTop: 8 }}>
            {childIsVideo && childVideoUrl ? (
              <video
                src={childVideoUrl}
                poster={childPosterUrl || undefined}
                controls
                muted
                playsInline
                preload="metadata"
                style={{
                  width: "100%",
                  maxHeight: 320,
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-background)",
                }}
              />
            ) : childPosterUrl ? (
              <img
                src={childPosterUrl}
                alt="Midia do carrossel"
                loading="lazy"
                style={{
                  width: "100%",
                  maxHeight: 320,
                  objectFit: "cover",
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-background)",
                }}
              />
            ) : (
              <div
                style={{
                  height: 180,
                  borderRadius: 12,
                  border: "1px dashed var(--color-border)",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--color-text-secondary)",
                }}
              >
                Preview indisponivel
              </div>
            )}

            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <button
                type="button"
                className="meta-secondary-button"
                onClick={() =>
                  changeCarouselIndex(mediaKey, currentIndex - 1, children.length)
                }
                disabled={children.length <= 1}
              >
                Anterior
              </button>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {currentIndex + 1} de {children.length}
              </span>
              <button
                type="button"
                className="meta-secondary-button"
                onClick={() =>
                  changeCarouselIndex(mediaKey, currentIndex + 1, children.length)
                }
                disabled={children.length <= 1}
              >
                Proximo
              </button>
            </div>
          </div>
        );
      }

      const isVideo = isVideoMedia(item.media_type);
      const videoUrl = item.media_url || null;
      const imageUrl = item.media_url || item.thumbnail_url || null;
      const posterUrl = item.thumbnail_url || item.media_url || undefined;

      if (isVideo && videoUrl) {
        return (
          <video
            src={videoUrl}
            poster={posterUrl}
            controls
            muted
            playsInline
            preload="metadata"
            style={{
              marginTop: 8,
              width: "100%",
              maxHeight: 320,
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              background: "var(--color-background)",
            }}
          />
        );
      }

      if (imageUrl) {
        return (
          <img
            src={imageUrl}
            alt="Preview da publicacao do Instagram"
            loading="lazy"
            style={{
              marginTop: 8,
              width: "100%",
              maxHeight: 320,
              objectFit: "cover",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              background: "var(--color-background)",
            }}
          />
        );
      }

      return (
        <div
          style={{
            marginTop: 8,
            height: 180,
            borderRadius: 12,
            border: "1px dashed var(--color-border)",
            display: "grid",
            placeItems: "center",
            color: "var(--color-text-secondary)",
          }}
        >
          Preview indisponivel
        </div>
      );
    },
    [carouselIndexByMediaKey, changeCarouselIndex],
  );

  return (
    <div className="api-meta-settings-container">
      {isIntegrationModule && (
        <header className="api-meta-hero">
          <div className="page-actions">
            <span className="api-meta-eyebrow">Meta Instagram</span>
            <h2>Conecte e sincronize contas Instagram profissionais</h2>
            {/* comentado temporariamente <p>
              A empresa aprova o acesso na Meta e a plataforma importa apenas as
              contas Instagram que ficaram realmente acessiveis para uso.
            </p> */}
            <div className="meta-integration-status-field">
              <label htmlFor="meta-ig-integration-status">
                Status da integração:
              </label>
              <input
                id="meta-ig-integration-status"
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
              onClick={handleMetaIgLogin}
              disabled={!isMetaSdkReady || isConnecting}
            >
              {isConnecting
                ? "Solicitando aprovacao..."
                : "Aprovar acesso Instagram"}
            </button>
          </div>
        </header>
      )}

      {isIntegrationModule && validationResult && !validationResult.liberado && (
        <section className="meta-config-section">
          <div className="meta-ads-onboarding-help">
            <h4>Aprovacao concluida, mas sem conta Instagram retornada</h4>
            <p>
              Verifique se o Instagram e profissional, esta vinculado a uma
              pagina Facebook e se o usuario tem permissao no business.
            </p>
          </div>
        </section>
      )}

      {isIntegrationModule && availableAccountsAfterApproval.length > 0 && (
        <section className="meta-config-section">
          <h3>Contas Instagram retornadas pela Meta</h3>
          <div className="meta-template-list">
            {availableAccountsAfterApproval.map((account, index) => (
              <article
                key={
                  account.instagram_business_account_id ||
                  `approved-instagram-${index}`
                }
                className="meta-template-item"
              >
                <div className="meta-template-item-meta">
                  <p>
                    <strong>Instagram:</strong>{" "}
                    {account.instagram_username || account.instagram_name || "-"}
                  </p>
                  <p>
                    <strong>IG ID:</strong>{" "}
                    {account.instagram_business_account_id || "-"}
                  </p>
                  <p>
                    <strong>Pagina:</strong> {account.page_name || "-"}
                  </p>
                  <p>
                    <strong>Business:</strong> {account.business_name || "-"}
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
              <p>
                A integracao ainda nao esta ativa. Faca a aprovacao na aba de
                integracao para liberar as consultas.
              </p>
            </div>
          )}

          {isIntegrationActive && (
                <div className="meta-template-list-section">
                  <div className="meta-template-list-header">
                    <div>
                      <h3>Contas Instagram vinculadas</h3>
                      <p>Consulte as contas salvas para a empresa atual.</p>
                  <p>
                    Selecione uma conta para carregar dados de desempenho e
                    publicações.
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

                  <div className="meta-template-list">
                    {isLoadingAccounts ? (
                      <p>Carregando contas Instagram...</p>
                    ) : accounts.length === 0 ? (
                      <p>Nenhuma conta Instagram salva para esta empresa.</p>
                    ) : (
                  accounts.map((account, index) => {
                    const accountId = account.instagram_business_account_id || "";
                    const isSelected = accountId !== "" && accountId === selectedIgAccountId;
                    const cardStateClass = !hasSelectedAccount
                      ? "meta-ig-account-card--initial"
                      : isSelected
                        ? "meta-ig-account-card--selected meta-template-item--active"
                        : "meta-ig-account-card--muted";

                    return (
                      <button
                          key={
                            account.id ||
                            account.instagram_business_account_id ||
                            `instagram-account-${index}`
                          }
                        type="button"
                        className={`meta-template-item meta-template-item--interactive meta-ig-account-card ${cardStateClass}`}
                        onClick={() => setSelectedIgAccountId(accountId)}
                        aria-pressed={isSelected}
                        >
                        <div className="meta-template-item-meta meta-ig-account-meta">
                          <div className="meta-ig-account-header">
                            {account.instagram_profile_picture_url ? (
                              <img
                                src={account.instagram_profile_picture_url}
                                alt={`Perfil da conta ${account.instagram_username || account.instagram_name || "Instagram"}`}
                                loading="lazy"
                                className="meta-ig-account-avatar"
                              />
                            ) : (
                              <div
                                className="meta-ig-account-avatar meta-ig-account-avatar--placeholder"
                                aria-hidden="true"
                              >
                                IG
                              </div>
                            )}
                            <div className="meta-ig-account-identity">
                              <span className="meta-ig-account-badge">
                                Conta do Instagram
                              </span>
                              <p className="meta-ig-account-name">
                              {account.instagram_username ||
                                account.instagram_name ||
                                "-"}
                            </p>
                            </div>
                          </div>
                            <p>
                              <strong>IG ID:</strong>{" "}
                              {account.instagram_business_account_id || "-"}
                            </p>
                            <p>
                              <strong>Pagina:</strong> {account.page_name || "-"}
                            </p>
                            <p>
                              <strong>Business:</strong>{" "}
                              {account.business_name || "-"}
                            </p>
                            <p>
                              <strong>Ultima vinculacao:</strong>{" "}
                              {formatDate(account.last_embedded_signup_at)}
                            </p>
                          </div>
                          <span className="meta-template-card-footer">
                            <span className="meta-template-card-cta">
                              Ver métricas
                            </span>
                          </span>
                      </button>
                    );
                  })
                    )}
                  </div>

              {accounts.length > 0 && hasSelectedAccount && (
                <section className="meta-ads-campaigns-section meta-ig-account-actions-section">
                      <div className="meta-ads-campaigns-actions meta-ig-insights-media-tabs">
                        <button
                          type="button"
                          className={getInsightsMediaTabClass("summary")}
                          onClick={() => {
                            setActiveInsightsMediaView("summary");
                            void handleLoadSummary();
                          }}
                          disabled={isLoadingSummary || !selectedIgAccountId}
                        >
                          {isLoadingSummary
                            ? "Consultando..."
                            : "Carregar resumo da conta"}
                        </button>
                        <button
                          type="button"
                          className={getInsightsMediaTabClass("insights")}
                          onClick={() => {
                            setActiveInsightsMediaView("insights");
                            void handleLoadInsights();
                          }}
                          disabled={isLoadingInsights || !selectedIgAccountId}
                        >
                          {isLoadingInsights
                            ? "Consultando..."
                            : "Carregar insights"}
                        </button>
                        <button
                          type="button"
                          className={getInsightsMediaTabClass("media")}
                          onClick={() => {
                            setActiveInsightsMediaView("media");
                            void handleLoadMedia();
                          }}
                          disabled={isLoadingMedia || !selectedIgAccountId}
                        >
                          {isLoadingMedia ? "Consultando..." : "Carregar midias"}
                        </button>
                      </div>

                      {activeInsightsMediaView === "insights" && (
                        <div
                          className="meta-insights-view-toggle"
                          role="tablist"
                          aria-label="Selecione o formato de visualizacao dos insights"
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={insightsViewMode === "analytics"}
                            className={
                              insightsViewMode === "analytics"
                                ? "meta-insights-view-toggle-button meta-insights-view-toggle-button--active"
                                : "meta-insights-view-toggle-button"
                            }
                            onClick={() => setInsightsViewMode("analytics")}
                          >
                            Analitico
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={insightsViewMode === "cards"}
                            className={
                              insightsViewMode === "cards"
                                ? "meta-insights-view-toggle-button meta-insights-view-toggle-button--active"
                                : "meta-insights-view-toggle-button"
                            }
                            onClick={() => setInsightsViewMode("cards")}
                          >
                            Cards
                          </button>
                        </div>
                      )}

                      {activeInsightsMediaView !== null && isInsightsMediaLoading && (
                        <div
                          className="meta-insights-media-loading"
                          aria-live="polite"
                        >
                          <div
                            className="meta-insights-media-loading__spinner"
                            aria-hidden="true"
                          />
                          <div className="meta-insights-media-loading__text">
                            <strong>
                              {activeInsightsMediaView === "insights"
                                ? "Carregando insights..."
                                : activeInsightsMediaView === "summary"
                                  ? "Carregando resumo da conta..."
                                  : "Carregando midias..."}
                            </strong>
                            <span>
                              Aguarde enquanto a Meta termina de preparar os dados.
                            </span>
                          </div>
                        </div>
                      )}

                      {activeInsightsMediaView === "insights" &&
                        !isInsightsMediaLoading && (
                        <>
                          {insightsError && (
                            <p className="meta-template-metrics-error">
                              {insightsError}
                            </p>
                          )}

                          {!insightsError && insights.length > 0 && (
                            <>
                              {insightsViewMode === "analytics" && (
                                <div className="meta-insights-dashboard">
                                  {insightVisualization.kpis.length > 0 && (
                                    <div className="meta-insights-kpi-grid">
                                      {insightVisualization.kpis.map((metric) => (
                                        <article
                                          key={`kpi-${metric.id}`}
                                          className="meta-insights-kpi-card"
                                          title={metric.description}
                                        >
                                          <span className="meta-insights-kpi-label">
                                            {metric.label}
                                          </span>
                                          <strong className="meta-insights-kpi-value">
                                            {metric.displayValue}
                                          </strong>
                                          <div className="meta-insights-kpi-meta">
                                            {metric.deltaPercentage !== null && (
                                              <span
                                                className={`meta-insights-delta ${
                                                  metric.deltaPercentage >= 0
                                                    ? "meta-insights-delta--positive"
                                                    : "meta-insights-delta--negative"
                                                }`}
                                              >
                                                {`${formatInsightDelta(metric.deltaPercentage)} vs anterior`}
                                              </span>
                                            )}
                                            {metric.updatedAt && (
                                              <span className="meta-insights-kpi-date">
                                                {`Atualizado em ${formatDate(metric.updatedAt)}`}
                                              </span>
                                            )}
                                          </div>
                                          <span className="meta-insights-kpi-period">
                                            Periodo: {metric.period}
                                          </span>
                                        </article>
                                      ))}
                                    </div>
                                  )}

                                  {insightVisualization.chartData.length > 0 && (
                                    <section className="meta-insights-chart-card">
                                      <div className="meta-insights-chart-header">
                                        <div>
                                          <h4>Comparativo de performance</h4>
                                          <p>
                                            Principais metricas do periodo atual para
                                            a conta selecionada.
                                          </p>
                                        </div>
                                      </div>

                                      <div className="meta-insights-chart-container">
                                        <ResponsiveContainer
                                          width="100%"
                                          height={Math.max(
                                            320,
                                            insightVisualization.chartData.length * 60,
                                          )}
                                        >
                                          <BarChart
                                            data={insightVisualization.chartData}
                                            layout="vertical"
                                            margin={{
                                              top: 8,
                                              right: 12,
                                              left: 12,
                                              bottom: 8,
                                            }}
                                          >
                                            <CartesianGrid
                                              strokeDasharray="3 3"
                                              horizontal={false}
                                            />
                                            <XAxis
                                              type="number"
                                              axisLine={false}
                                              tickLine={false}
                                              tickFormatter={(value) =>
                                                new Intl.NumberFormat("pt-BR", {
                                                  notation: "compact",
                                                }).format(Number(value))
                                              }
                                            />
                                            <YAxis
                                              type="category"
                                              dataKey="label"
                                              axisLine={false}
                                              tickLine={false}
                                              width={150}
                                            />
                                            <Tooltip
                                              cursor={{
                                                fill: "rgba(15, 118, 110, 0.08)",
                                              }}
                                              content={({ active, payload }) => {
                                                if (!active || !payload?.length) return null;
                                                const metric = payload[0]
                                                  ?.payload as (typeof insightVisualization.chartData)[number];
                                                return (
                                                  <div className="meta-insights-chart-tooltip">
                                                    <strong>{metric.label}</strong>
                                                    <span>
                                                      Valor: {metric.displayValue}
                                                    </span>
                                                    {metric.updatedAt && (
                                                      <span>
                                                        {`Data: ${formatDate(metric.updatedAt)}`}
                                                      </span>
                                                    )}
                                                    {metric.deltaPercentage !== null && (
                                                      <span>
                                                        Variacao:{" "}
                                                        {formatInsightDelta(
                                                          metric.deltaPercentage,
                                                        )}
                                                      </span>
                                                    )}
                                                    {metric.description && (
                                                      <p>{metric.description}</p>
                                                    )}
                                                  </div>
                                                );
                                              }}
                                            />
                                            <Bar
                                              dataKey="numericValue"
                                              fill="#C5D200"
                                              radius={[0, 8, 8, 0]}
                                              barSize={24}
                                            />
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </div>
                                    </section>
                                  )}

                                  {insightVisualization.secondaryMetrics.length > 0 && (
                                    <section className="meta-insights-secondary-card">
                                      <div className="meta-insights-chart-header">
                                        <div>
                                          <h4>Sem movimento no periodo</h4>
                                          <p>
                                            Metricas que vieram zeradas ou sem valor
                                            disponivel na consulta.
                                          </p>
                                        </div>
                                      </div>
                                      <div className="meta-insights-secondary-grid">
                                        {insightVisualization.secondaryMetrics.map(
                                          (metric) => (
                                            <article
                                              key={`secondary-${metric.id}`}
                                              className="meta-insights-secondary-item"
                                              title={metric.description}
                                            >
                                              <span>{metric.label}</span>
                                              <strong>{metric.displayValue}</strong>
                                            </article>
                                          ),
                                        )}
                                      </div>
                                    </section>
                                  )}
                                </div>
                              )}

                              {insightsViewMode === "cards" && (
                                <div className="meta-template-list">
                                  {insightVisualization.allMetrics.map((metric, index) => (
                                    <article
                                      key={`${metric.id}-${index}`}
                                      className="meta-template-item"
                                      title={metric.description}
                                    >
                                      <div className="meta-template-item-meta">
                                        <p>
                                          <strong>Metrica:</strong>{" "}
                                          {metric.label}
                                        </p>
                                        {metric.description && <p>{metric.description}</p>}
                                        <p>
                                          <strong>Periodo:</strong>{" "}
                                          {metric.period}
                                        </p>
                                        <p>
                                          <strong>Ultimo valor:</strong>{" "}
                                          {metric.displayValue}
                                        </p>
                                        {metric.updatedAt && (
                                          <p>
                                            <strong>Atualizado em:</strong>{" "}
                                            {formatDate(metric.updatedAt)}
                                          </p>
                                        )}
                                        {metric.deltaPercentage !== null && (
                                          <p>
                                            <strong>Variacao:</strong>{" "}
                                            {`${formatInsightDelta(metric.deltaPercentage)} vs anterior`}
                                          </p>
                                        )}
                                      </div>
                                    </article>
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          {!insightsError && insights.length === 0 && (
                              <p>Nenhum insight encontrado para esta conta.</p>
                            )}
                        </>
                      )}

                      {activeInsightsMediaView === "summary" &&
                        !isInsightsMediaLoading && (
                        <>
                          {summaryError && (
                            <p className="meta-template-metrics-error">
                              {summaryError}
                            </p>
                          )}

                          {!summaryError && accountSummary?.account && (
                            <section className="meta-insights-chart-card meta-ig-summary-card">
                              <div className="meta-insights-chart-header">
                                <div>
                                  <h4>Resumo da conta Instagram</h4>
                                  <p>
                                    Visão geral da conta selecionada com dados
                                    basicos e indicadores recentes.
                                  </p>
                                </div>
                              </div>

                              <div className="meta-ig-summary-grid">
                                <div className="meta-ig-summary-profile">
                                  <div className="meta-ig-summary-avatar-wrap">
                                    {selectedAccount?.instagram_profile_picture_url ||
                                    accountSummary.account.profile_picture_url ? (
                                      <img
                                        src={
                                          selectedAccount?.instagram_profile_picture_url ||
                                          accountSummary.account.profile_picture_url ||
                                          ""
                                        }
                                        alt={`Perfil ${accountSummary.account.username || accountSummary.account.name || selectedAccount?.instagram_username || selectedAccount?.instagram_name || "Instagram"}`}
                                        loading="lazy"
                                        className="meta-ig-account-avatar meta-ig-summary-avatar"
                                      />
                                    ) : (
                                      <div
                                        className="meta-ig-account-avatar meta-ig-account-avatar--placeholder meta-ig-summary-avatar"
                                        aria-hidden="true"
                                      >
                                        IG
                                      </div>
                                    )}
                                  </div>

                                  <div className="meta-ig-summary-profile-copy">
                                    <span className="meta-ig-summary-profile-label">
                                      Perfil
                                    </span>
                                    <strong className="meta-ig-summary-profile-handle">
                                      {accountSummary.account.username || "-"}
                                    </strong>
                                    <p className="meta-ig-summary-profile-name">
                                      Usuario:{" "}
                                      <strong>
                                        {accountSummary.account.username || "-"}
                                      </strong>
                                    </p>
                                    <p className="meta-ig-summary-profile-name">
                                      Nome:{" "}
                                      <strong>
                                        {accountSummary.account.name || "-"}
                                      </strong>
                                    </p>
                                  </div>
                                </div>

                                <div className="meta-ig-summary-stats" role="list" aria-label="Metricas principais da conta">
                                  <article className="meta-ig-summary-stat" role="listitem">
                                    <strong>
                                      {formatInsightNumber(
                                        accountSummary.account.media_count ?? null,
                                      )}
                                    </strong>
                                    <span>Publicacoes</span>
                                  </article>
                                  <article className="meta-ig-summary-stat" role="listitem">
                                    <strong>
                                      {formatInsightNumber(
                                        accountSummary.account.followers_count ?? null,
                                      )}
                                    </strong>
                                    <span>Seguidores</span>
                                  </article>
                                  <article className="meta-ig-summary-stat" role="listitem">
                                    <strong>
                                      {formatInsightNumber(
                                        accountSummary.account.follows_count ?? null,
                                      )}
                                    </strong>
                                    <span>Seguindo</span>
                                  </article>
                                </div>
                              </div>

                              <div className="meta-ig-summary-details">
                                <p>
                                  <strong>Site:</strong>{" "}
                                  {accountSummary.account.website || "-"}
                                </p>
                              </div>

                              {accountSummary.account.biography && (
                                <p className="meta-ig-summary-bio">
                                  <strong>Bio:</strong>{" "}
                                  {accountSummary.account.biography}
                                </p>
                              )}

                              {Array.isArray(accountSummary.insights) &&
                                accountSummary.insights.length > 0 && (
                                <div className="meta-ig-summary-insights">
                                  {accountSummary.insights.map((metric, index) => (
                                    <article
                                      key={metric.id || `${metric.name}-${index}`}
                                      className="meta-insights-secondary-item"
                                    >
                                      <span>
                                        {formatInsightMetricLabel(metric.name)}
                                      </span>
                                      <strong>{getInsightLatestValue(metric)}</strong>
                                    </article>
                                  ))}
                                </div>
                              )}
                            </section>
                          )}

                          {!summaryError && !accountSummary?.account && (
                            <p>Nenhum resumo encontrado para esta conta.</p>
                          )}
                        </>
                      )}

                      {activeInsightsMediaView === "media" &&
                        !isInsightsMediaLoading && (
                        <>
                          {mediaError && (
                            <p className="meta-template-metrics-error">
                              {mediaError}
                            </p>
                          )}

                          {!mediaError && mediaItems.length > 0 && (
                            <>
                              <div className="meta-template-list">
                                {mediaItems
                                  .slice(0, visibleMediaCount)
                                  .map((item, index) => (
                                    (() => {
                                      const mediaKey = item.id || `media-item-${index}`;
                                      const hasLongCaption =
                                        (item.caption?.length || 0) >
                                        MEDIA_CAPTION_PREVIEW_LENGTH;
                                      const isCaptionExpanded =
                                        expandedMediaCaptions[mediaKey] || false;
                                      const visibleCaption =
                                        hasLongCaption && !isCaptionExpanded
                                          ? `${item.caption?.slice(0, MEDIA_CAPTION_PREVIEW_LENGTH)}...`
                                          : item.caption;
                                      const totalComments = Number(
                                        item.comments_count ?? 0,
                                      );
                                      const hasComments = Number.isFinite(totalComments)
                                        ? totalComments > 0
                                        : false;

                                      return (
                                        <article
                                          key={mediaKey}
                                          className="meta-template-item meta-media-item"
                                        >
                                          <div className="meta-template-item-meta meta-media-item-meta">
                                        {renderMediaPreview(
                                          item,
                                          `media-item-${index}`,
                                        )}
                                        <p>
                                          <strong>Tipo:</strong>{" "}
                                          {item.media_type || "-"}
                                        </p>
                                        <p>
                                          <strong>ID:</strong> {item.id || "-"}
                                        </p>
                                        {item.caption && (
                                              <div className="meta-media-caption">
                                          <p>
                                                  <strong>Legenda:</strong>{" "}
                                                  {visibleCaption}
                                          </p>
                                                {hasLongCaption && (
                                                  <button
                                                    type="button"
                                                    className="meta-media-caption-toggle"
                                                    onClick={() =>
                                                      setExpandedMediaCaptions(
                                                        (current) => ({
                                                          ...current,
                                                          [mediaKey]:
                                                            !current[mediaKey],
                                                        }),
                                                      )
                                                    }
                                                  >
                                                    {isCaptionExpanded
                                                      ? "Ocultar"
                                                      : "Ver mais"}
                                                  </button>
                                                )}
                                              </div>
                                        )}
                                        <div className="meta-media-footer">
                                        <div className="meta-media-insights">
                                          <div className="meta-media-insight-item">
                                            <FaHeart
                                              aria-hidden="true"
                                              className="meta-media-insight-icon"
                                            />
                                            <span>
                                              {item.like_count == null
                                                ? "-"
                                                : item.like_count}
                                            </span>
                                          </div>
                                          <div className="meta-media-insight-item">
                                            <FiMessageCircle
                                              aria-hidden="true"
                                              className="meta-media-insight-icon"
                                            />
                                            <span>
                                              {item.comments_count == null
                                                ? "-"
                                                : item.comments_count}
                                            </span>
                                          </div>
                                        </div>
                                          {hasComments && (
                                        <div className="meta-media-actions">
                                          <button
                                            type="button"
                                            className="meta-secondary-button"
                                            onClick={() =>
                                              void handleLoadMediaComments(item.id)
                                            }
                                            disabled={isLoadingMediaDetails || !item.id}
                                          >
                                            Ver comentarios
                                          </button>
                                        </div>
                                          )}
                                        </div>
                                        {item.permalink && (
                                          <a
                                            href={item.permalink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="add-button meta-media-link-button"
                                          >
                                            <FiExternalLink aria-hidden="true" />
                                            <span>Abrir publicacao</span>
                                          </a>
                                        )}
                                          </div>
                                        </article>
                                      );
                                    })()
                                  ))}
                              </div>

                              {mediaItems.length > visibleMediaCount && (
                                <div className="meta-media-load-more">
                                  <button
                                    type="button"
                                    className="meta-secondary-button"
                                    onClick={() =>
                                      setVisibleMediaCount((current) =>
                                        Math.min(
                                          current + MEDIA_PAGE_SIZE,
                                          mediaItems.length,
                                        ),
                                      )
                                    }
                                  >
                                    Carregar mais
                                  </button>
                                </div>
                              )}

                              {activeMediaId && (
                                <div
                                  className="meta-media-comments-modal-backdrop"
                                  onClick={handleCloseMediaCommentsModal}
                                  role="presentation"
                                >
                                  <section
                                    className="meta-media-comments-modal"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby="meta-media-comments-modal-title"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <div className="meta-media-comments-modal-header">
                                      <div>
                                        <h5 id="meta-media-comments-modal-title">
                                          Comentarios da midia
                                        </h5>
                                        <p>
                                          {activeMediaItem?.media_type || "Midia"}{" "}
                                          {activeMediaComments?.total != null
                                            ? `• ${activeMediaComments.total} comentario(s)`
                                            : ""}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        className="meta-secondary-button meta-media-comments-modal-close"
                                        onClick={handleCloseMediaCommentsModal}
                                        aria-label="Fechar modal de comentarios"
                                      >
                                        <FiX aria-hidden="true" />
                                      </button>
                                    </div>

                                    <div className="meta-media-comments-modal-content">
                                            {isLoadingMediaDetails && (
                                              <p>Consultando detalhes da midia...</p>
                                            )}

                                      {!isLoadingMediaDetails && mediaDetailsError && (
                                                <p className="meta-template-metrics-error">
                                                  {mediaDetailsError}
                                                </p>
                                              )}

                                            {!isLoadingMediaDetails &&
                                              !mediaDetailsError &&
                                        activeMediaComments &&
                                        (activeMediaComments.items || []).length > 0 && (
                                                <div className="meta-media-detail-block">
                                            {(activeMediaComments.items || []).map(
                                              (comment, commentIndex) => (
                                                      <article
                                                        key={
                                                          comment.id ||
                                                          `comment-${commentIndex}`
                                                        }
                                                        className="meta-media-comment-item"
                                                      >
                                                        <header>
                                                          <strong>
                                                            {comment.display_username ||
                                                              comment.username ||
                                                        comment.from?.username ||
                                                        comment.from?.name ||
                                                              "Usuario"}
                                                          </strong>
                                                          <span>
                                                      {formatDate(comment.timestamp)}
                                                          </span>
                                                        </header>
                                                        <p>
                                                    {normalizeCommentText(comment)}
                                                        </p>
                                                        <small>
                                                    Curtidas: {comment.like_count ?? 0} |
                                                          Respostas:{" "}
                                                    {comment.replies?.data?.length ?? 0}
                                                        </small>
                                                      </article>
                                              ),
                                            )}
                                                </div>
                                              )}

                                      {!isLoadingMediaDetails &&
                                        !mediaDetailsError &&
                                        activeMediaComments &&
                                        (activeMediaComments.items || []).length === 0 && (
                                          <p>Nenhum comentario encontrado para esta midia.</p>
                                        )}
                                      </div>
                                  </section>
                                </div>
                              )}
                            </>
                          )}

                          {!mediaError && mediaItems.length === 0 && (
                              <p>Nenhuma midia encontrada para esta conta.</p>
                            )}
                        </>
                      )}
                </section>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function ApiMetaIgSettings() {
  return <ApiMetaIgSettingsModule mode="integration" />;
}

export function MetaIgManagementSettings({
  onInitialLoadChange,
}: {
  onInitialLoadChange?: (loading: boolean) => void;
}) {
  return (
    <ApiMetaIgSettingsModule
      mode="management"
      onInitialLoadChange={onInitialLoadChange}
    />
  );
}
