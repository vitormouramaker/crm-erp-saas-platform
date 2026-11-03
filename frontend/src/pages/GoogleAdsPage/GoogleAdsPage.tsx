import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiActivity,
  FiBarChart2,
  FiDownload,
  FiDollarSign,
  FiEye,
  FiMousePointer,
  FiTarget,
  FiX,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import * as XLSX from "xlsx";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import {
  GoogleAdsService,
  type GoogleAdsAccount,
  type GoogleAdsAdGroupMetricsRow,
  type GoogleAdsCampaignMetricsRow,
  type GoogleAdsDailyPerformanceRow,
  type GoogleAdsKeywordMetricsRow,
  type GoogleAdsMetricSummary,
  type GoogleAdsMetricsResult,
} from "../../service/googleAdsService";
import "./GoogleAdsPage.css";

const EMPTY_SUMMARY: GoogleAdsMetricSummary = {
  impressions: 0,
  clicks: 0,
  interactions: 0,
  conversions: 0,
  all_conversions: 0,
  conversions_value: 0,
  cost_micros: 0,
  cost: 0,
  ctr: 0,
  average_cpc: 0,
  average_cpm: 0,
  cost_per_conversion: 0,
};

const ALL_ACCOUNTS_VALUE = "__all_accounts__";

function formatDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return formatDateInput(date);
}

function buildDefaultEndDate(): string {
  return formatDateInput(new Date());
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatPercent(value: number): string {
  return `${formatDecimal(value)}%`;
}

function slugifyFilenamePart(value: string): string {
  return (
    String(value || "dados")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "dados"
  );
}

function exportRowsToWorkbook(
  filterRows: Array<Record<string, string | number>>,
  rows: Array<Record<string, string | number>>,
  sheetName: string,
  filename: string,
) {
  const workbook = XLSX.utils.book_new();
  const filtersWorksheet = XLSX.utils.json_to_sheet(filterRows);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, filtersWorksheet, "Filtros");
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

function getStatusClass(status?: string | null): string {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();
  if (!normalized)
    return "google-ads-page-status google-ads-page-status--neutral";
  if (
    normalized.includes("ENABLED") ||
    normalized.includes("ACTIVE") ||
    normalized.includes("ATIVO")
  ) {
    return "google-ads-page-status google-ads-page-status--success";
  }
  if (
    normalized.includes("PAUSED") ||
    normalized.includes("CANCELED") ||
    normalized.includes("CANCELLED") ||
    normalized.includes("REMOVED") ||
    normalized.includes("INACTIVE")
  ) {
    return "google-ads-page-status google-ads-page-status--warning";
  }
  return "google-ads-page-status google-ads-page-status--neutral";
}

function formatStatusLabel(status?: string | null): string {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();
  if (!normalized) return "Sem status";

  const statusMap: Record<string, string> = {
    ENABLED: "Ativo",
    ACTIVE: "Ativo",
    ATIVO: "Ativo",
    ELIGIBLE: "Qualificado",
    LIMITED: "Limitado",
    PAUSED: "Pausado",
    INACTIVE: "Inativo",
    REMOVED: "Removido",
    CANCELED: "Cancelado",
    CANCELLED: "Cancelado",
    ENDED: "Encerrado",
    PENDING: "Pendente",
    UNKNOWN: "Desconhecido",
    UNSPECIFIED: "Nao especificado",
  };

  if (statusMap[normalized]) {
    return statusMap[normalized];
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatAccountName(account?: GoogleAdsAccount | null): string {
  if (!account) return "-";
  return account.customer_name || account.customer_id || "Conta sem nome";
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: IconType;
}) {
  return (
    <article className="google-ads-summary-card">
      <div className="google-ads-summary-card__content">
        <div>
          <span className="google-ads-summary-card__label">{label}</span>
          <strong className="google-ads-summary-card__value">{value}</strong>
          <span className="google-ads-summary-card__helper">{helper}</span>
        </div>

        <div className="google-ads-summary-card__icon">
          <Icon size={22} />
        </div>
      </div>

      <div className="google-ads-summary-card__bar" />
    </article>
  );
}

export function GoogleAdsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [linkedAccounts, setLinkedAccounts] = useState<GoogleAdsAccount[]>([]);
  const [startDate, setStartDate] = useState(buildDefaultStartDate);
  const [endDate, setEndDate] = useState(buildDefaultEndDate);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [metricsData, setMetricsData] = useState<GoogleAdsMetricsResult | null>(
    null,
  );
  const [activeCampaignId, setActiveCampaignId] = useState("");
  const [activeAdGroupId, setActiveAdGroupId] = useState("");
  const [activeCampaignStatusFilter, setActiveCampaignStatusFilter] =
    useState("");
  const [campaignViewMode, setCampaignViewMode] = useState<"cards" | "table">(
    "cards",
  );
  const [campaignDetailsView, setCampaignDetailsView] = useState<
    "adgroups" | "daily"
  >("adgroups");
  const campaignDetailsRef = useRef<HTMLHeadingElement | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!user?.empresa_id) {
      setLinkedAccounts([]);
      return;
    }

    try {
      setIsLoadingAccounts(true);
      const accounts = await GoogleAdsService.listAccounts(user.empresa_id);
      setLinkedAccounts(accounts);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar contas",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as contas vinculadas do Google Ads.",
      });
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [addToast, user?.empresa_id]);

  const loadMetrics = useCallback(async () => {
    if (!user?.empresa_id || !selectedCustomerId) return;

    try {
      setIsLoading(true);
      const result = await GoogleAdsService.getMetrics({
        empresaId: user.empresa_id,
        customerId:
          selectedCustomerId === ALL_ACCOUNTS_VALUE
            ? undefined
            : selectedCustomerId,
        startDate,
        endDate,
      });
      setMetricsData(result);

      if (Array.isArray(result.warnings) && result.warnings.length > 0) {
        addToast({
          type: "warning",
          title: "Algumas contas nao responderam",
          description:
            result.warnings[0]?.message ||
            "Parte das contas Google Ads nao retornou metricas neste carregamento.",
        });
      }
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar Google Ads",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as metricas do Google Ads.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast, endDate, selectedCustomerId, startDate, user?.empresa_id]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const campaigns = metricsData?.campaigns || [];
  const adGroups = metricsData?.ad_groups || [];
  const keywords = metricsData?.keywords || [];
  const dailyPerformance = metricsData?.daily_performance || [];
  const summary = metricsData?.summary || EMPTY_SUMMARY;

  const campaignStatusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          campaigns
            .map((campaign) => String(campaign.campaign_status || "").trim())
            .filter(Boolean),
        ),
      ),
    [campaigns],
  );

  const visibleCampaigns = useMemo(() => {
    if (!activeCampaignStatusFilter) return campaigns;

    return campaigns.filter(
      (campaign) =>
        String(campaign.campaign_status || "")
          .trim()
          .toUpperCase() === activeCampaignStatusFilter,
    );
  }, [activeCampaignStatusFilter, campaigns]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setMetricsData(null);
      setActiveCampaignId("");
      setActiveAdGroupId("");
      setActiveCampaignStatusFilter("");
      return;
    }

    void loadMetrics();
  }, [loadMetrics, selectedCustomerId]);

  const selectedAccount = useMemo(
    () =>
      selectedCustomerId === ALL_ACCOUNTS_VALUE
        ? null
        : linkedAccounts.find(
            (account) =>
              String(account.customer_id || "") ===
              String(selectedCustomerId || ""),
          ) || null,
    [linkedAccounts, selectedCustomerId],
  );

  const exportScopeLabel = selectedAccount
    ? formatAccountName(selectedAccount)
    : selectedCustomerId === ALL_ACCOUNTS_VALUE
      ? "todas_as_contas"
      : "google_ads";

  const exportFilterRows = useMemo(
    () => [
      {
        Conta: selectedAccount
          ? formatAccountName(selectedAccount)
          : selectedCustomerId === ALL_ACCOUNTS_VALUE
            ? "Todas as contas"
            : "-",
        Data_Inicial: startDate,
        Data_Final: endDate,
      },
    ],
    [endDate, selectedAccount, selectedCustomerId, startDate],
  );

  const headlineText = selectedAccount
    ? `Visão detalhada da conta ${formatAccountName(selectedAccount)}`
    : selectedCustomerId === ALL_ACCOUNTS_VALUE
      ? "Visão consolidada de todas as contas vinculadas"
      : "Selecione uma conta para carregar as metricas";

  useEffect(() => {
    if (!visibleCampaigns.length) {
      setActiveCampaignId("");
      setActiveAdGroupId("");
      return;
    }

    if (
      activeCampaignId &&
      visibleCampaigns.some(
        (campaign) => campaign.campaign_id === activeCampaignId,
      )
    ) {
      return;
    }

    setActiveCampaignId("");
    setActiveAdGroupId("");
  }, [activeCampaignId, visibleCampaigns]);

  const activeCampaign = useMemo(
    () =>
      visibleCampaigns.find(
        (campaign) => campaign.campaign_id === activeCampaignId,
      ) || null,
    [activeCampaignId, visibleCampaigns],
  );

  const filteredAdGroups = useMemo(
    () =>
      adGroups.filter((adGroup) => adGroup.campaign_id === activeCampaignId),
    [activeCampaignId, adGroups],
  );

  useEffect(() => {
    if (!filteredAdGroups.length) {
      setActiveAdGroupId("");
      return;
    }

    if (
      activeAdGroupId &&
      filteredAdGroups.some(
        (adGroup) => adGroup.ad_group_id === activeAdGroupId,
      )
    ) {
      return;
    }

    setActiveAdGroupId("");
  }, [activeAdGroupId, filteredAdGroups]);

  const filteredKeywords = useMemo(() => {
    const byCampaign = keywords.filter(
      (keyword) => keyword.campaign_id === activeCampaignId,
    );

    if (!activeAdGroupId) return byCampaign;
    return byCampaign.filter(
      (keyword) => keyword.ad_group_id === activeAdGroupId,
    );
  }, [activeAdGroupId, activeCampaignId, keywords]);

  const activeAdGroup = useMemo(
    () =>
      filteredAdGroups.find(
        (adGroup) => adGroup.ad_group_id === activeAdGroupId,
      ) || null,
    [activeAdGroupId, filteredAdGroups],
  );

  const filteredDailyPerformance = useMemo(
    () =>
      dailyPerformance.filter(
        (dayRow) => dayRow.campaign_id === activeCampaignId,
      ),
    [activeCampaignId, dailyPerformance],
  );

  const handleResetFilters = useCallback(() => {
    setSelectedCustomerId("");
    setStartDate(buildDefaultStartDate());
    setEndDate(buildDefaultEndDate());
    setMetricsData(null);
    setActiveCampaignId("");
    setActiveAdGroupId("");
    setActiveCampaignStatusFilter("");
    setCampaignViewMode("cards");
    setCampaignDetailsView("adgroups");
  }, []);

  const handleToggleCampaignSelection = useCallback((campaignId: string) => {
    setActiveCampaignId((currentCampaignId) => {
      const nextCampaignId = currentCampaignId === campaignId ? "" : campaignId;
      setActiveAdGroupId("");
      setCampaignDetailsView("adgroups");
      return nextCampaignId;
    });
  }, []);

  const handleExportCampaigns = useCallback(() => {
    if (!visibleCampaigns.length) {
      addToast({
        type: "warning",
        title: "Nenhum dado para exportar",
        description: "Nao ha campanhas carregadas para exportacao.",
      });
      return;
    }

    try {
      exportRowsToWorkbook(
        exportFilterRows,
        visibleCampaigns.map((campaign) => ({
          Conta: campaign.customer_name || campaign.customer_id || "-",
          Campanha: campaign.campaign_name || "-",
          ID_Campanha: campaign.campaign_id || "-",
          Status: campaign.campaign_status || "-",
          Canal: campaign.channel_type || "-",
          Impressões: Number(campaign.impressions || 0),
          Cliques: Number(campaign.clicks || 0),
          CTR: formatPercent(campaign.ctr),
          Custo: Number(campaign.cost || 0),
          CPC_Médio: Number(campaign.average_cpc || 0),
          Conversões: Number(campaign.conversions || 0),
          Valor_Conversão: Number(campaign.conversions_value || 0),
          Custo_por_Conversão: Number(campaign.cost_per_conversion || 0),
        })),
        "Campanhas",
        `google_ads_campanhas_${slugifyFilenamePart(exportScopeLabel)}_${startDate}_${endDate}.xlsx`,
      );
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao exportar campanhas",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel exportar as campanhas.",
      });
    }
  }, [
    addToast,
    endDate,
    exportFilterRows,
    exportScopeLabel,
    startDate,
    visibleCampaigns,
  ]);

  const handleExportAdGroups = useCallback(() => {
    if (!filteredAdGroups.length || !activeCampaign) {
      addToast({
        type: "warning",
        title: "Nenhum dado para exportar",
        description: "Nao ha conjuntos carregados para exportacao.",
      });
      return;
    }

    try {
      exportRowsToWorkbook(
        exportFilterRows,
        filteredAdGroups.map((adGroup) => ({
          Conta: adGroup.customer_name || adGroup.customer_id || "-",
          Campanha: adGroup.campaign_name || "-",
          ID_Campanha: adGroup.campaign_id || "-",
          Conjunto: adGroup.ad_group_name || "-",
          ID_Conjunto: adGroup.ad_group_id || "-",
          Status: adGroup.ad_group_status || "-",
          Tipo: adGroup.ad_group_type || adGroup.channel_type || "-",
          Impressões: Number(adGroup.impressions || 0),
          Cliques: Number(adGroup.clicks || 0),
          CTR: formatPercent(adGroup.ctr),
          Custo: Number(adGroup.cost || 0),
          CPC_Médio: Number(adGroup.average_cpc || 0),
          Conversões: Number(adGroup.conversions || 0),
          Custo_por_Conversão: Number(adGroup.cost_per_conversion || 0),
        })),
        "Conjuntos",
        `google_ads_conjuntos_${slugifyFilenamePart(activeCampaign.campaign_name)}_${startDate}_${endDate}.xlsx`,
      );
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao exportar conjuntos",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel exportar os conjuntos.",
      });
    }
  }, [
    activeCampaign,
    addToast,
    endDate,
    exportFilterRows,
    filteredAdGroups,
    startDate,
  ]);

  const handleExportDailyPerformance = useCallback(() => {
    if (!filteredDailyPerformance.length || !activeCampaign) {
      addToast({
        type: "warning",
        title: "Nenhum dado para exportar",
        description: "Nao ha performance diaria carregada para exportacao.",
      });
      return;
    }

    try {
      exportRowsToWorkbook(
        exportFilterRows,
        filteredDailyPerformance.map((dayRow) => ({
          Data: dayRow.date || "-",
          Campanha: dayRow.campaign_name || "-",
          ID_Campanha: dayRow.campaign_id || "-",
          Status: dayRow.campaign_status || "-",
          Impressões: Number(dayRow.impressions || 0),
          Cliques: Number(dayRow.clicks || 0),
          CTR: formatPercent(dayRow.ctr),
          Custo: Number(dayRow.cost || 0),
          CPC_Médio: Number(dayRow.average_cpc || 0),
          Conversões: Number(dayRow.conversions || 0),
          Valor_Conversão: Number(dayRow.conversions_value || 0),
        })),
        "Performance_Diaria",
        `google_ads_performance_diaria_${slugifyFilenamePart(activeCampaign.campaign_name)}_${startDate}_${endDate}.xlsx`,
      );
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao exportar performance",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel exportar a performance por dia.",
      });
    }
  }, [
    activeCampaign,
    addToast,
    endDate,
    exportFilterRows,
    filteredDailyPerformance,
    startDate,
  ]);

  const handleExportKeywords = useCallback(() => {
    if (!filteredKeywords.length || !activeAdGroup) {
      addToast({
        type: "warning",
        title: "Nenhum dado para exportar",
        description: "Nao ha palavras-chave carregadas para exportacao.",
      });
      return;
    }

    try {
      exportRowsToWorkbook(
        exportFilterRows,
        filteredKeywords.map((keyword) => ({
          Conta: keyword.customer_name || keyword.customer_id || "-",
          Campanha: keyword.campaign_name || "-",
          ID_Campanha: keyword.campaign_id || "-",
          Conjunto: keyword.ad_group_name || "-",
          ID_Conjunto: keyword.ad_group_id || "-",
          Palavra_chave: keyword.keyword_text || "-",
          ID_Palavra_chave: keyword.keyword_id || "-",
          Match_Type: keyword.keyword_match_type || "-",
          Status: keyword.keyword_status || "-",
          Impressões: Number(keyword.impressions || 0),
          Cliques: Number(keyword.clicks || 0),
          CTR: formatPercent(keyword.ctr),
          Custo: Number(keyword.cost || 0),
          Conversões: Number(keyword.conversions || 0),
          Custo_por_Conversão: Number(keyword.cost_per_conversion || 0),
        })),
        "Palavras_Chave",
        `google_ads_palavras_chave_${slugifyFilenamePart(activeAdGroup.ad_group_name)}_${startDate}_${endDate}.xlsx`,
      );
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao exportar palavras-chave",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel exportar as palavras-chave.",
      });
    }
  }, [
    activeAdGroup,
    addToast,
    endDate,
    exportFilterRows,
    filteredKeywords,
    startDate,
  ]);

  useEffect(() => {
    if (!activeCampaign) return;

    const timeoutId = window.setTimeout(() => {
      campaignDetailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [activeCampaign]);

  useEffect(() => {
    if (!activeAdGroupId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveAdGroupId("");
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeAdGroupId]);

  return (
    <div className="google-ads-page-layout">
      <MobileHeader title="Google Ads" />

      <div className="google-ads-page-hero">
        <header className="google-ads-page-header">
          <div>
            <p className="google-ads-page-header__eyebrow">Google Ads</p>
            <h1>Metricas e desempenho</h1>
            <p>{headlineText}</p>
          </div>
        </header>

        <section className="google-ads-toolbar">
          <label className="google-ads-toolbar__field">
            <span>Conta</span>
            <select
              value={selectedCustomerId}
              onChange={(event) => {
                setSelectedCustomerId(event.target.value);
                setActiveCampaignId("");
                setActiveAdGroupId("");
                setActiveCampaignStatusFilter("");
              }}
              disabled={isLoadingAccounts}
            >
              <option value="">Selecionar conta</option>
              <option value={ALL_ACCOUNTS_VALUE}>Todas as contas</option>
              {linkedAccounts.map((account) => (
                <option
                  key={String(account.customer_id || account.id || "")}
                  value={String(account.customer_id || "")}
                >
                  {formatAccountName(account)}
                </option>
              ))}
            </select>
          </label>

          <label className="google-ads-toolbar__field">
            <span>Data inicial</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label className="google-ads-toolbar__field">
            <span>Data final</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <div className="google-ads-toolbar__actions">
            <button
              type="button"
              className="google-ads-toolbar__button google-ads-toolbar__button--secondary"
              onClick={handleResetFilters}
              disabled={isLoading}
            >
              Limpar filtro
            </button>
          </div>
        </section>
      </div>

      {!isLoadingAccounts && linkedAccounts.length === 0 && (
        <section className="google-ads-empty-state">
          <h2>Nenhuma conta vinculada</h2>
          <p>
            Conclua o OAuth em <strong>Configurações &gt; Google Ads</strong>{" "}
            para liberar a visualização das metricas neste modulo.
          </p>
        </section>
      )}

      {isLoadingAccounts && (
        <section className="google-ads-screen-loading" aria-live="polite">
          <div
            className="google-ads-screen-loading__spinner"
            aria-hidden="true"
          />
          <div className="google-ads-screen-loading__text">
            <strong>Carregando contas...</strong>
            <span>
              O sistema esta consultando as contas Google Ads vinculadas.
            </span>
          </div>
        </section>
      )}

      {!isLoadingAccounts &&
        linkedAccounts.length > 0 &&
        !selectedCustomerId && (
          <section className="google-ads-empty-state">
            <h2>Selecione uma conta</h2>
            <p>
              Escolha uma conta especifica ou <strong>Todas as contas</strong>{" "}
              para carregar o resumo e as tabelas de desempenho.
            </p>
          </section>
        )}

      {!isLoadingAccounts &&
        linkedAccounts.length > 0 &&
        selectedCustomerId &&
        isLoading && (
          <section className="google-ads-screen-loading" aria-live="polite">
            <div
              className="google-ads-screen-loading__spinner"
              aria-hidden="true"
            />
            <div className="google-ads-screen-loading__text">
              <strong>Carregando métricas...</strong>
              <span>
                O sistema esta consultando os dados da conta selecionada.
              </span>
            </div>
          </section>
        )}

      {!isLoadingAccounts &&
        linkedAccounts.length > 0 &&
        selectedCustomerId &&
        !isLoading &&
        metricsData && (
          <>
            <section className="google-ads-summary-grid">
              <SummaryCard
                label="Impressões"
                value={formatInteger(summary.impressions)}
                helper={`${formatInteger(metricsData?.total_campaigns || 0)} campanha(s) no periodo`}
                icon={FiEye}
              />
              <SummaryCard
                label="Cliques"
                value={formatInteger(summary.clicks)}
                helper={`CTR medio de ${formatPercent(summary.ctr)}`}
                icon={FiMousePointer}
              />
              <SummaryCard
                label="Interações"
                value={formatInteger(summary.interactions)}
                helper="Soma das interações registradas"
                icon={FiActivity}
              />
              <SummaryCard
                label="Custo"
                value={formatCurrency(summary.cost)}
                helper={`CPC médio de ${formatCurrency(summary.average_cpc)}`}
                icon={FiDollarSign}
              />
              <SummaryCard
                label="Conversões"
                value={formatDecimal(summary.conversions)}
                helper={`Custo por conversão de ${formatCurrency(summary.cost_per_conversion)}`}
                icon={FiTarget}
              />
              <SummaryCard
                label="Valor de conversão"
                value={formatCurrency(summary.conversions_value)}
                helper={`Todas as conversoes: ${formatDecimal(summary.all_conversions)}`}
                icon={FiBarChart2}
              />
            </section>

            {/* COMENTADO TEMPORARIAMENTEEEE NAO APAGAR <section className="google-ads-accounts-section">
            <div className="google-ads-section-heading">
              <div>
                <h2>Resumo por conta</h2>
                <p>Leitura rapida das contas vinculadas no periodo filtrado.</p>
              </div>
              <span className="google-ads-section-heading__badge">
                {formatInteger(metricsData?.total_accounts || 0)} conta(s)
              </span>
            </div>

            <div className="google-ads-account-grid">
              {accountSummaries.map((account: GoogleAdsAccountMetricsSummary) => (
                <article
                  key={String(account.customer_id || account.id || account.customer_name)}
                  className="google-ads-account-card"
                >
                  <div className="google-ads-account-card__header">
                    <div>
                      <h3>{formatAccountName(account)}</h3>
                      <p>ID {account.customer_id || "-"}</p>
                    </div>
                    <span className={getStatusClass(account.status)}>
                      {formatStatusLabel(account.status)}
                    </span>
                  </div>

                  <div className="google-ads-account-card__metrics">
                    <span>Custo: {formatCurrency(account.summary.cost)}</span>
                    <span>Cliques: {formatInteger(account.summary.clicks)}</span>
                    <span>Conversoes: {formatDecimal(account.summary.conversions)}</span>
                    <span>CTR: {formatPercent(account.summary.ctr)}</span>
                  </div>

                  <div className="google-ads-account-card__footer">
                    <span>{formatInteger(account.total_campaigns)} campanha(s)</span>
                    <span>{formatInteger(account.total_ad_groups || 0)} conjunto(s)</span>
                    <span>{formatInteger(account.total_keywords || 0)} palavra(s)-chave</span>
                    <span>{account.currency_code || "Moeda nao informada"}</span>
                  </div>
                </article>
              ))}
            </div>
          </section> */}

            <section className="google-ads-campaigns-section">
              <div className="google-ads-section-heading">
                <div>
                  <h2>Campanhas</h2>
                  <p>Escolha uma campanha para abrir os detalhes abaixo.</p>
                  {campaignStatusOptions.length > 0 && (
                    <div className="google-ads-subfilter-row google-ads-subfilter-row--compact">
                      {campaignStatusOptions.map((status) => {
                        const normalizedStatus = status.toUpperCase();
                        const isActive =
                          activeCampaignStatusFilter === normalizedStatus;

                        return (
                          <button
                            key={status}
                            type="button"
                            className={
                              isActive
                                ? "google-ads-subfilter-chip google-ads-subfilter-chip--active"
                                : "google-ads-subfilter-chip"
                            }
                            onClick={() =>
                              setActiveCampaignStatusFilter((currentStatus) =>
                                currentStatus === normalizedStatus
                                  ? ""
                                  : normalizedStatus,
                              )
                            }
                          >
                            {formatStatusLabel(status)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="google-ads-section-heading__actions">
                  <button
                    type="button"
                    className="google-ads-export-button"
                    onClick={handleExportCampaigns}
                    disabled={!visibleCampaigns.length}
                    aria-label="Exportar campanhas"
                  >
                    <FiDownload size={14} />
                    <span>Exportar</span>
                  </button>
                  <div
                    className="google-ads-view-toggle"
                    role="tablist"
                    aria-label="Modo de visualizacao das campanhas"
                  >
                    <button
                      type="button"
                      className={
                        campaignViewMode === "cards"
                          ? "google-ads-view-toggle__button google-ads-view-toggle__button--active"
                          : "google-ads-view-toggle__button"
                      }
                      onClick={() => setCampaignViewMode("cards")}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      className={
                        campaignViewMode === "table"
                          ? "google-ads-view-toggle__button google-ads-view-toggle__button--active"
                          : "google-ads-view-toggle__button"
                      }
                      onClick={() => setCampaignViewMode("table")}
                    >
                      Tabela
                    </button>
                  </div>
                </div>
              </div>

              {visibleCampaigns.length === 0 ? (
                <div className="google-ads-empty-state google-ads-empty-state--compact">
                  <p>Nenhuma campanha corresponde aos filtros selecionados.</p>
                </div>
              ) : campaignViewMode === "cards" ? (
                <div className="google-ads-campaign-card-grid">
                  {visibleCampaigns.map(
                    (campaign: GoogleAdsCampaignMetricsRow) => (
                      <button
                        key={`${campaign.customer_id}-${campaign.campaign_id}`}
                        type="button"
                        className={
                          campaign.campaign_id === activeCampaignId
                            ? "google-ads-campaign-card google-ads-campaign-card--active"
                            : "google-ads-campaign-card"
                        }
                        onClick={() =>
                          handleToggleCampaignSelection(campaign.campaign_id)
                        }
                      >
                        <div className="google-ads-campaign-card__header">
                          <div className="google-ads-campaign-card__title">
                            <strong>{campaign.campaign_name}</strong>
                            <div className="google-ads-campaign-card__title-meta">
                              <span>
                                {campaign.customer_name || campaign.customer_id}
                              </span>
                              <span>ID {campaign.campaign_id}</span>
                              <span>{campaign.channel_type || "-"}</span>
                            </div>
                          </div>
                          <span
                            className={getStatusClass(campaign.campaign_status)}
                          >
                            {formatStatusLabel(campaign.campaign_status)}
                          </span>
                        </div>

                        <div className="google-ads-campaign-card__grid">
                          <div>
                            <span>Impressões</span>
                            <strong>
                              {formatInteger(campaign.impressions)}
                            </strong>
                          </div>
                          <div>
                            <span>Cliques</span>
                            <strong>{formatInteger(campaign.clicks)}</strong>
                          </div>
                          <div>
                            <span>CTR</span>
                            <strong>{formatPercent(campaign.ctr)}</strong>
                          </div>
                          <div>
                            <span>Custo</span>
                            <strong>{formatCurrency(campaign.cost)}</strong>
                          </div>
                          <div>
                            <span>CPC médio</span>
                            <strong>
                              {formatCurrency(campaign.average_cpc)}
                            </strong>
                          </div>
                          <div>
                            <span>Conversões</span>
                            <strong>
                              {formatDecimal(campaign.conversions)}
                            </strong>
                          </div>
                          <div>
                            <span>Valor conv.</span>
                            <strong>
                              {formatCurrency(campaign.conversions_value)}
                            </strong>
                          </div>
                          <div>
                            <span>Custo/conv.</span>
                            <strong>
                              {formatCurrency(campaign.cost_per_conversion)}
                            </strong>
                          </div>
                        </div>
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <div className="google-ads-table-wrap google-ads-table-wrap--adgroups">
                  <table className="google-ads-table google-ads-table--adgroups">
                    <thead>
                      <tr>
                        <th>Conta</th>
                        <th>Campanha</th>
                        <th>Status</th>
                        <th>Canal</th>
                        <th>Impressões</th>
                        <th>Cliques</th>
                        <th>CTR</th>
                        <th>Custo</th>
                        <th>CPC médio</th>
                        <th>Conversões</th>
                        <th>Valor conv.</th>
                        <th>Custo/conv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCampaigns.map(
                        (campaign: GoogleAdsCampaignMetricsRow) => (
                          <tr
                            key={`${campaign.customer_id}-${campaign.campaign_id}`}
                            className={
                              campaign.campaign_id === activeCampaignId
                                ? "google-ads-table__row google-ads-table__row--interactive google-ads-table__row--active"
                                : "google-ads-table__row google-ads-table__row--interactive"
                            }
                            onClick={() =>
                              handleToggleCampaignSelection(
                                campaign.campaign_id,
                              )
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleToggleCampaignSelection(
                                  campaign.campaign_id,
                                );
                              }
                            }}
                            tabIndex={0}
                          >
                            <td>
                              {campaign.customer_name || campaign.customer_id}
                            </td>
                            <td>
                              <div className="google-ads-table__campaign">
                                <strong>{campaign.campaign_name}</strong>
                                <span>
                                  ID {campaign.campaign_id} • clique para abrir
                                  conjuntos
                                </span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={getStatusClass(
                                  campaign.campaign_status,
                                )}
                              >
                                {formatStatusLabel(campaign.campaign_status)}
                              </span>
                            </td>
                            <td>{campaign.channel_type || "-"}</td>
                            <td>{formatInteger(campaign.impressions)}</td>
                            <td>{formatInteger(campaign.clicks)}</td>
                            <td>{formatPercent(campaign.ctr)}</td>
                            <td>{formatCurrency(campaign.cost)}</td>
                            <td>{formatCurrency(campaign.average_cpc)}</td>
                            <td>{formatDecimal(campaign.conversions)}</td>
                            <td>
                              {formatCurrency(campaign.conversions_value)}
                            </td>
                            <td>
                              {formatCurrency(campaign.cost_per_conversion)}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {activeCampaign && (
              <>
                <h1
                  className="google-ads-campaign-details-title"
                  ref={campaignDetailsRef}
                  style={{ scrollMarginTop: "40px", marginTop: "40px" }}
                >
                  {activeCampaign.campaign_name}
                </h1>
                <div
                  className="google-ads-detail-tabs meta-ads-campaigns-actions meta-ig-insights-media-tabs meta-management-view-tabs"
                  role="tablist"
                  aria-label="Visualizacao dos detalhes da campanha"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={campaignDetailsView === "adgroups"}
                    className={
                      campaignDetailsView === "adgroups"
                        ? "meta-secondary-button meta-ig-insights-media-tab meta-ig-insights-media-tab--active"
                        : "meta-secondary-button meta-ig-insights-media-tab"
                    }
                    onClick={() => setCampaignDetailsView("adgroups")}
                  >
                    Conjuntos da campanha
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={campaignDetailsView === "daily"}
                    className={
                      campaignDetailsView === "daily"
                        ? "meta-secondary-button meta-ig-insights-media-tab meta-ig-insights-media-tab--active"
                        : "meta-secondary-button meta-ig-insights-media-tab"
                    }
                    onClick={() => setCampaignDetailsView("daily")}
                  >
                    Performance por dia
                  </button>
                </div>

                {campaignDetailsView === "adgroups" && (
                  <section className="google-ads-campaigns-section">
                    <div className="google-ads-section-heading">
                      <div>
                        <h2>Conjuntos da campanha</h2>
                        <p>
                          {activeCampaign
                            ? `Campanha selecionada: ${activeCampaign.campaign_name}`
                            : "Clique em uma campanha para listar os conjuntos."}
                        </p>
                        <p>Clique para filtrar palavras-chave</p>
                      </div>
                      <div className="google-ads-section-heading__actions">
                        <button
                          type="button"
                          className="google-ads-export-button"
                          onClick={handleExportAdGroups}
                          disabled={!filteredAdGroups.length}
                          aria-label="Exportar conjuntos da campanha"
                        >
                          <FiDownload size={14} />
                          <span>Exportar</span>
                        </button>
                        <span className="google-ads-section-heading__badge">
                          {formatInteger(filteredAdGroups.length)} conjunto(s)
                        </span>
                      </div>
                    </div>

                    {filteredAdGroups.length === 0 ? (
                      <div className="google-ads-empty-state google-ads-empty-state--compact">
                        <p>
                          Nenhum conjunto retornou metricas para a campanha
                          selecionada.
                        </p>
                      </div>
                    ) : (
                      <div className="google-ads-table-wrap google-ads-table-wrap--campaign-adgroups">
                        <table className="google-ads-table google-ads-table--campaign-adgroups">
                          <thead>
                            <tr>
                              <th>Campanha</th>
                              <th>Conjunto</th>
                              <th>Status</th>
                              <th>Tipo</th>
                              <th>Impressões</th>
                              <th>Cliques</th>
                              <th>CTR</th>
                              <th>Custo</th>
                              <th>CPC médio</th>
                              <th>Conversões</th>
                              <th>Custo/conv.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAdGroups.map(
                              (adGroup: GoogleAdsAdGroupMetricsRow) => (
                                <tr
                                  key={`${adGroup.customer_id}-${adGroup.ad_group_id}`}
                                  className={
                                    adGroup.ad_group_id === activeAdGroupId
                                      ? "google-ads-table__row google-ads-table__row--interactive google-ads-table__row--active"
                                      : "google-ads-table__row google-ads-table__row--interactive"
                                  }
                                  onClick={() =>
                                    setActiveAdGroupId(adGroup.ad_group_id)
                                  }
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      setActiveAdGroupId(adGroup.ad_group_id);
                                    }
                                  }}
                                  tabIndex={0}
                                >
                                  <td>
                                    <div className="google-ads-table__campaign">
                                      <strong>{adGroup.campaign_name}</strong>
                                      <span>ID {adGroup.campaign_id}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="google-ads-table__campaign">
                                      <strong>{adGroup.ad_group_name}</strong>
                                      <span>ID {adGroup.ad_group_id}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <span
                                      className={getStatusClass(
                                        adGroup.ad_group_status,
                                      )}
                                    >
                                      {formatStatusLabel(
                                        adGroup.ad_group_status,
                                      )}
                                    </span>
                                  </td>
                                  <td>
                                    {adGroup.ad_group_type ||
                                      adGroup.channel_type ||
                                      "-"}
                                  </td>
                                  <td>{formatInteger(adGroup.impressions)}</td>
                                  <td>{formatInteger(adGroup.clicks)}</td>
                                  <td>{formatPercent(adGroup.ctr)}</td>
                                  <td>{formatCurrency(adGroup.cost)}</td>
                                  <td>{formatCurrency(adGroup.average_cpc)}</td>
                                  <td>{formatDecimal(adGroup.conversions)}</td>
                                  <td>
                                    {formatCurrency(
                                      adGroup.cost_per_conversion,
                                    )}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                {campaignDetailsView === "daily" && (
                  <section className="google-ads-campaigns-section">
                    <div className="google-ads-section-heading">
                      <div>
                        <h2>Performance por dia</h2>
                        <p>
                          {activeCampaign
                            ? `Serie diaria da campanha ${activeCampaign.campaign_name}`
                            : "Selecione uma campanha para ver a performance diaria."}
                        </p>
                      </div>
                      <div className="google-ads-section-heading__actions">
                        <button
                          type="button"
                          className="google-ads-export-button"
                          onClick={handleExportDailyPerformance}
                          disabled={!filteredDailyPerformance.length}
                          aria-label="Exportar performance por dia"
                        >
                          <FiDownload size={14} />
                          <span>Exportar</span>
                        </button>
                        <span className="google-ads-section-heading__badge">
                          {formatInteger(filteredDailyPerformance.length)}{" "}
                          dia(s)
                        </span>
                      </div>
                    </div>

                    {filteredDailyPerformance.length === 0 ? (
                      <div className="google-ads-empty-state google-ads-empty-state--compact">
                        <p>
                          Nenhuma linha diaria retornou metricas para a campanha
                          selecionada.
                        </p>
                      </div>
                    ) : (
                      <div className="google-ads-table-wrap">
                        <table className="google-ads-table">
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Campanha</th>
                              <th>Status</th>
                              <th>Impressões</th>
                              <th>Cliques</th>
                              <th>CTR</th>
                              <th>Custo</th>
                              <th>CPC médio</th>
                              <th>Conversões</th>
                              <th>Valor conv.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDailyPerformance.map(
                              (dayRow: GoogleAdsDailyPerformanceRow) => (
                                <tr
                                  key={`${dayRow.campaign_id}-${dayRow.date}`}
                                >
                                  <td>{dayRow.date}</td>
                                  <td>
                                    <div className="google-ads-table__campaign">
                                      <strong>{dayRow.campaign_name}</strong>
                                      <span>ID {dayRow.campaign_id}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <span
                                      className={getStatusClass(
                                        dayRow.campaign_status,
                                      )}
                                    >
                                      {formatStatusLabel(
                                        dayRow.campaign_status,
                                      )}
                                    </span>
                                  </td>
                                  <td>{formatInteger(dayRow.impressions)}</td>
                                  <td>{formatInteger(dayRow.clicks)}</td>
                                  <td>{formatPercent(dayRow.ctr)}</td>
                                  <td>{formatCurrency(dayRow.cost)}</td>
                                  <td>{formatCurrency(dayRow.average_cpc)}</td>
                                  <td>{formatDecimal(dayRow.conversions)}</td>
                                  <td>
                                    {formatCurrency(dayRow.conversions_value)}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                {activeAdGroup && (
                  <div
                    className="google-ads-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="google-ads-keywords-modal-title"
                    onClick={() => setActiveAdGroupId("")}
                  >
                    <div
                      className="google-ads-modal__dialog"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="google-ads-modal__header">
                        <div>
                          <p className="google-ads-modal__eyebrow">
                            Palavras-chave
                          </p>
                          <h2 id="google-ads-keywords-modal-title">
                            {activeAdGroup.ad_group_name}
                          </h2>
                          <p className="google-ads-modal__description">
                            {activeCampaign?.campaign_name || "-"} •{" "}
                            {formatInteger(filteredKeywords.length)}{" "}
                            palavra(s)-chave
                          </p>
                        </div>

                        <div className="google-ads-modal__actions">
                          <button
                            type="button"
                            className="google-ads-export-button"
                            onClick={handleExportKeywords}
                            disabled={!filteredKeywords.length}
                            aria-label="Exportar palavras-chave"
                          >
                            <FiDownload size={14} />
                            <span>Exportar</span>
                          </button>
                          <button
                            type="button"
                            className="google-ads-modal__close"
                            onClick={() => setActiveAdGroupId("")}
                            aria-label="Fechar modal de palavras-chave"
                          >
                            <FiX size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="google-ads-modal__body">
                        {filteredKeywords.length === 0 ? (
                          <div className="google-ads-empty-state google-ads-empty-state--compact">
                            <p>
                              Nenhuma palavra-chave retornou metricas para este
                              conjunto.
                            </p>
                          </div>
                        ) : (
                          <div className="google-ads-table-wrap google-ads-modal__table-wrap">
                            <table className="google-ads-table">
                              <thead>
                                <tr>
                                  <th>Conta</th>
                                  <th>Campanha</th>
                                  <th>Conjunto</th>
                                  <th>Palavra-chave</th>
                                  <th>Match type</th>
                                  <th>Status</th>
                                  <th>Impressões</th>
                                  <th>Cliques</th>
                                  <th>CTR</th>
                                  <th>Custo</th>
                                  <th>Conversões</th>
                                  <th>Custo/conv.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredKeywords.map(
                                  (keyword: GoogleAdsKeywordMetricsRow) => (
                                    <tr
                                      key={`${keyword.customer_id}-${keyword.keyword_id}`}
                                    >
                                      <td>
                                        {keyword.customer_name ||
                                          keyword.customer_id}
                                      </td>
                                      <td>
                                        <div className="google-ads-table__campaign">
                                          <strong>
                                            {keyword.campaign_name}
                                          </strong>
                                          <span>ID {keyword.campaign_id}</span>
                                        </div>
                                      </td>
                                      <td>
                                        <div className="google-ads-table__campaign">
                                          <strong>
                                            {keyword.ad_group_name}
                                          </strong>
                                          <span>ID {keyword.ad_group_id}</span>
                                        </div>
                                      </td>
                                      <td>
                                        <div className="google-ads-table__campaign">
                                          <strong>
                                            {keyword.keyword_text}
                                          </strong>
                                          <span>ID {keyword.keyword_id}</span>
                                        </div>
                                      </td>
                                      <td>
                                        {keyword.keyword_match_type || "-"}
                                      </td>
                                      <td>
                                        <span
                                          className={getStatusClass(
                                            keyword.keyword_status,
                                          )}
                                        >
                                          {formatStatusLabel(
                                            keyword.keyword_status,
                                          )}
                                        </span>
                                      </td>
                                      <td>
                                        {formatInteger(keyword.impressions)}
                                      </td>
                                      <td>{formatInteger(keyword.clicks)}</td>
                                      <td>{formatPercent(keyword.ctr)}</td>
                                      <td>{formatCurrency(keyword.cost)}</td>
                                      <td>
                                        {formatDecimal(keyword.conversions)}
                                      </td>
                                      <td>
                                        {formatCurrency(
                                          keyword.cost_per_conversion,
                                        )}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
    </div>
  );
}
