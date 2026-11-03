import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarGrid,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  FiActivity,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiFilter,
  FiMessageCircle,
  FiPhoneCall,
  FiRefreshCw,
  FiTarget,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { useToast } from "../../../contexts/ToastContext";
import {
  getCommercialDashboard,
  getCommercialDomains,
  subscribeToCommercialDataChanged,
  type CommercialDomains,
  type CommercialStats,
} from "../../../service/commercialService";
import {
  PeriodRangePicker,
  type PeriodRangeValue,
} from "../../common/PeriodRangePicker/PeriodRangePicker";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../../ui/chart";
import "./CommercialDashboard.css";

const initialStats: CommercialStats = {
  updatedAt: null,
  crm_id: undefined,
  overview: {
    leadsReceived: 0,
    firstResponseAverageSeconds: 0,
    contactedLeads: 0,
    totalContacts: 0,
    contactsPerLead: 0,
    pendingFollowUps: 0,
    pendingFollowUpsPercent: 0,
    salesCount: 0,
    revenue: 0,
  },
  salesBySource: [],
  leadsNew: {
    total: 0,
    percentOfTotal: 0,
    byDay: [],
    byOrigin: [],
  },
  leadsInProgress: {
    total: 0,
    percentOfActive: 0,
    byOrigin: [],
    agingBuckets: [],
  },
  serviceVelocity: {
    totalLeads: 0,
    contactedLeads: 0,
    leadsWithoutResponse: 0,
    respondedWithin5Min: 0,
    respondedWithin15Min: 0,
    respondedAfter15Min: 0,
    averageFirstResponseSeconds: 0,
    responseRate: 0,
    leadsWithoutResponsePercent: 0,
  },
  contactCadence: {
    totalContacts: 0,
    averageContactsPerLead: 0,
    leadsWithoutContact: 0,
    leadsWithoutContactPercent: 0,
    buckets: [],
  },
  funnel: {
    totalLeads: 0,
    overallConversionRate: 0,
    items: [],
  },
  sellerPerformance: [],
  leadOrigins: {
    total: 0,
    items: [],
  },
  leadArrivalPatterns: {
    weekdays: [],
    hours: [],
  },
  unattendedLeads: {
    total: 0,
    percent: 0,
    totalLeads: 0,
  },
  totalQuotesInPipeline: 0,
  activeQuotesCount: 0,
  wonQuotesValue: 0,
  quoteConversionRate: 0,
  averageWonQuote: 0,
  lostQuotesValue: 0,
  monthlyWonQuotesRevenue: [],
  quotesByStage: [],
  totalPipelineValue: 0,
  activeDealsCount: 0,
  winRate: 0,
  averageTicket: 0,
  lostAmount: 0,
  monthlyRevenue: [],
  dealsByStage: [],
  lossRadar: {
    totalLostRevenue: 0,
    fullLostRevenue: 0,
    partialLostRevenue: 0,
    lostDealsCount: 0,
    partialLossDealsCount: 0,
    topReasons: [],
    topProducts: [],
    topSellers: [],
  },
  customerDocumentsCount: 0,
  documentsByAttendant: [],
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("pt-BR");
const decimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const donutPalette = [
  "var(--dashboard-brand-green)",
  "var(--dashboard-blue)",
  "var(--dashboard-rose)",
  "var(--dashboard-green)",
];

const leadsLineChartConfig = {
  count: {
    label: "Leads",
    color: "var(--dashboard-blue)",
  },
} satisfies ChartConfig;

type CommercialDashboardProps = {
  crmId?: number | null;
};

type MetricCardProps = {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: "green" | "blue" | "violet" | "orange" | "pink";
};

function getDefaultDateRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  return {
    start: start.toISOString().split("T")[0],
    end: today.toISOString().split("T")[0],
  };
}

function formatDashboardDate(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

function formatDashboardDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercent(value?: number | null) {
  return `${decimalFormatter.format(Number(value || 0))}%`;
}

function formatCurrency(value?: number | null) {
  return currencyFormatter.format(Number(value || 0));
}

function formatCount(value?: number | null) {
  return numberFormatter.format(Number(value || 0));
}

function formatResponseTime(seconds?: number | null) {
  const totalSeconds = Math.max(Number(seconds || 0), 0);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function getPeakDistributionItem<T extends { count: number }>(items: T[]) {
  return items.reduce<T | null>((best, item) => {
    if (!best || Number(item.count || 0) > Number(best.count || 0)) {
      return item;
    }
    return best;
  }, null);
}

function getInitials(name?: string | null) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "SC";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

function buildConicGradient(items: Array<{ count: number }>) {
  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0);
  if (!total) {
    return "conic-gradient(var(--dashboard-track) 0 100%)";
  }

  let current = 0;
  const segments = items
    .filter((item) => Number(item.count || 0) > 0)
    .map((item, index) => {
      const start = current;
      current += (Number(item.count || 0) / total) * 100;
      return `${donutPalette[index % donutPalette.length]} ${start}% ${current}%`;
    });

  return `conic-gradient(${segments.join(", ")})`;
}

function DashboardMetricCard({ title, value, hint, icon, tone }: MetricCardProps) {
  return (
    <article className={`dashboard-metric-card tone-${tone}`}>
      <div className="dashboard-metric-card__icon">{icon}</div>
      <div className="dashboard-metric-card__content">
        <span className="dashboard-metric-card__title">{title}</span>
        <strong className="dashboard-metric-card__value">{value}</strong>
        <span className="dashboard-metric-card__hint">{hint}</span>
      </div>
    </article>
  );
}

function DistributionLegend({
  items,
}: {
  items: Array<{ label: string; count: number; percent: number }>;
}) {
  if (!items.length) {
    return <p className="dashboard-empty">Nenhum dado encontrado para o período.</p>;
  }

  return (
    <div className="dashboard-legend-list">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="dashboard-legend-row">
          <div className="dashboard-legend-row__label">
            <span
              className="dashboard-legend-row__dot"
              style={{ backgroundColor: donutPalette[index % donutPalette.length] }}
            />
            <span>{item.label}</span>
          </div>
          <div className="dashboard-legend-row__value">
            <strong>{formatCount(item.count)}</strong>
            <span>{formatPercent(item.percent)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressList({
  items,
  totalBase,
}: {
  items: Array<{
    label: string;
    value: number;
    percent: number;
    accent?: "danger" | "warning" | "success" | "info";
  }>;
  totalBase?: number;
}) {
  if (!items.length) {
    return <p className="dashboard-empty">Nenhum dado encontrado para o período.</p>;
  }

  return (
    <div className="dashboard-progress-list">
      {items.map((item) => (
        <div key={item.label} className="dashboard-progress-row">
          <div className="dashboard-progress-row__header">
            <span>{item.label}</span>
            <strong>{formatCount(item.value)}</strong>
          </div>
          <div className="dashboard-progress-row__body">
            <div className="dashboard-progress-bar">
              <div
                className={`dashboard-progress-bar__fill accent-${item.accent || "success"}`}
                style={{ width: `${Math.min(Number(item.percent || 0), 100)}%` }}
              />
            </div>
            <span>{formatPercent(totalBase ? item.percent : item.percent)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DistributionHistogram({
  items,
  accent = "info",
}: {
  items: Array<{ key: string; label: string; count: number; percent: number }>;
  accent?: "success" | "info" | "warning" | "danger";
}) {
  if (!items.length) {
    return <p className="dashboard-empty">Nenhum dado encontrado para o periodo.</p>;
  }

  const maxCount = Math.max(...items.map((item) => Number(item.count || 0)), 0);

  return (
    <div className="dashboard-histogram">
      {items.map((item) => {
        const count = Number(item.count || 0);
        const heightPercent =
          maxCount > 0 && count > 0 ? Math.max((count / maxCount) * 100, 10) : 0;

        return (
          <div
            key={item.key}
            className="dashboard-histogram__item"
            title={`${item.label}: ${formatCount(item.count)} lead(s) (${formatPercent(item.percent)})`}
          >
            <div className="dashboard-histogram__track">
              <div
                className={`dashboard-histogram__fill accent-${accent}`}
                style={{ height: `${heightPercent}%` }}
              />
            </div>
            <span className="dashboard-histogram__label">{item.label}</span>
            <small className="dashboard-histogram__value">{formatCount(item.count)}</small>
          </div>
        );
      })}
    </div>
  );
}

export function CommercialDashboard({ crmId }: CommercialDashboardProps) {
  const { addToast } = useToast();
  const [domains, setDomains] = useState<CommercialDomains | null>(null);
  const [stats, setStats] = useState<CommercialStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [sellerFilter, setSellerFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [isPeriodFilterOpen, setIsPeriodFilterOpen] = useState(false);
  const hasLoadedRef = useRef(false);
  const domainsRef = useRef<CommercialDomains | null>(null);
  const requestIdRef = useRef(0);
  const periodFilterRef = useRef<HTMLDivElement | null>(null);
  const hasCompletedInitialLoadRef = useRef(false);

  useEffect(() => {
    domainsRef.current = domains;
  }, [domains]);

  const loadDashboard = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!crmId) {
      setDomains(null);
      domainsRef.current = null;
      setStats(initialStats);
      setLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!silent) {
      setLoading(true);
    }
    try {
      let nextDomains = domainsRef.current;
      if (!nextDomains || Number(nextDomains.crm_id) !== Number(crmId || nextDomains.crm_id)) {
        nextDomains = await getCommercialDomains(crmId);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setDomains(nextDomains);
        domainsRef.current = nextDomains;
      }
      if (!nextDomains) throw new Error("Funil nao encontrado.");

      const nextStats = await getCommercialDashboard({
        crmId: nextDomains.crm_id,
        ownerId: sellerFilter !== "all" ? sellerFilter : undefined,
        origin: originFilter !== "all" ? originFilter : undefined,
        dateStart: dateRange.start,
        dateEnd: dateRange.end,
        product: productFilter !== "all" ? productFilter : undefined,
        filialId:
          branchFilter !== "all" && branchFilter !== "none"
            ? Number(branchFilter)
            : undefined,
        withoutFilial: branchFilter === "none",
      });
      if (requestId !== requestIdRef.current) {
        return;
      }
      setStats(nextStats);
      hasCompletedInitialLoadRef.current = true;
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (!silent || !hasCompletedInitialLoadRef.current) {
        addToast({
          type: "error",
          title: "Erro",
          description:
            error instanceof Error ? error.message : "Nao foi possivel carregar o dashboard.",
        });
      }
    } finally {
      if (!silent && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    addToast,
    branchFilter,
    crmId,
    dateRange.end,
    dateRange.start,
    originFilter,
    productFilter,
    sellerFilter,
  ]);

  useEffect(() => {
    setDomains(null);
    domainsRef.current = null;
    setOriginFilter("all");
    setProductFilter("all");
    setBranchFilter("all");
    hasLoadedRef.current = false;
    requestIdRef.current += 1;
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crmId]);

  useEffect(() => subscribeToCommercialDataChanged(() => void loadDashboard()), [loadDashboard]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      return;
    }

    void loadDashboard();
  }, [branchFilter, dateRange.end, dateRange.start, loadDashboard, originFilter, productFilter, sellerFilter]);

  useEffect(() => {
    if (!crmId) return undefined;

    const intervalId = window.setInterval(() => {
      void loadDashboard({ silent: true });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [crmId, loadDashboard]);

  useEffect(() => {
    if (!isPeriodFilterOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!periodFilterRef.current?.contains(event.target as Node)) {
        setIsPeriodFilterOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPeriodFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPeriodFilterOpen]);

  const sellers = useMemo(() => domains?.responsaveis || [], [domains]);
  const products = useMemo(
    () =>
      [...(domains?.produtos || [])].sort((a, b) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
      ),
    [domains]
  );
  const origins = useMemo(
    () =>
      [...(domains?.origens_venda || [])].sort((a, b) =>
        String(a.label || "").localeCompare(String(b.label || ""), "pt-BR")
      ),
    [domains]
  );
  const salesSourceSummary = useMemo(() => {
    const labels: Record<string, string> = { crm: "CRM", hubla: "Hubla", hotmart: "Hotmart" };
    return stats.salesBySource
      .map((item) => `${labels[item.source] || item.source}: ${formatCount(item.salesCount)}`)
      .join(" · ");
  }, [stats.salesBySource]);
  const revenueSourceSummary = useMemo(() => {
    const labels: Record<string, string> = { crm: "CRM", hubla: "Hubla", hotmart: "Hotmart" };
    return stats.salesBySource
      .map((item) => `${labels[item.source] || item.source}: ${formatCurrency(item.revenue)}`)
      .join(" · ");
  }, [stats.salesBySource]);

  const defaultDateRange = useMemo(() => getDefaultDateRange(), []);
  const hasCustomPeriodFilter =
    dateRange.start !== defaultDateRange.start || dateRange.end !== defaultDateRange.end;
  const hasActiveFilters =
    sellerFilter !== "all" ||
    originFilter !== "all" ||
    productFilter !== "all" ||
    branchFilter !== "all" ||
    hasCustomPeriodFilter;

  const periodFilterLabel = useMemo(() => {
    if (dateRange.start && dateRange.end) {
      return `${formatDashboardDate(dateRange.start)} - ${formatDashboardDate(dateRange.end)}`;
    }
    if (dateRange.start) return `A partir de ${formatDashboardDate(dateRange.start)}`;
    if (dateRange.end) return `Até ${formatDashboardDate(dateRange.end)}`;
    return "Definir periodo";
  }, [dateRange.end, dateRange.start]);

  const applyPeriodFilter = (nextPeriod: PeriodRangeValue) => {
    setDateRange({
      start: nextPeriod.dateStart,
      end: nextPeriod.dateEnd,
    });
    setIsPeriodFilterOpen(false);
  };

  const clearFilters = () => {
    setSellerFilter("all");
    setOriginFilter("all");
    setProductFilter("all");
    setBranchFilter("all");
    setDateRange(getDefaultDateRange());
    setIsPeriodFilterOpen(false);
  };

  const leadsSeries = stats.leadsNew.byDay || [];
  const sparklineMax = useMemo(
    () => Math.max(...leadsSeries.map((point) => Number(point.count || 0)), 1),
    [leadsSeries]
  );
  const agingBuckets = stats.leadsInProgress.agingBuckets || [];
  const funnelItems = stats.funnel.items || [];
  const funnelChartData = useMemo(
    () =>
      funnelItems.map((item, index) => ({
        stage: item.name,
        count: Number(item.count || 0),
        fill: donutPalette[index % donutPalette.length],
      })),
    [funnelItems]
  );
  const sellerRows = stats.sellerPerformance || [];

  const leadOriginLegend = useMemo(
    () =>
      (stats.leadOrigins.items || []).map((item) => ({
        label: item.origin,
        count: item.count,
        percent: item.percent,
      })),
    [stats.leadOrigins.items]
  );

  const inProgressOriginSummary = useMemo(
    () => (stats.leadsInProgress.byOrigin || []).slice(0, 2),
    [stats.leadsInProgress.byOrigin]
  );
  const newLeadOriginSummary = useMemo(
    () => (stats.leadsNew.byOrigin || []).slice(0, 2),
    [stats.leadsNew.byOrigin]
  );
  const weekdayArrivalItems = useMemo(
    () => stats.leadArrivalPatterns.weekdays || [],
    [stats.leadArrivalPatterns.weekdays]
  );
  const hourArrivalItems = useMemo(
    () => stats.leadArrivalPatterns.hours || [],
    [stats.leadArrivalPatterns.hours]
  );
  const peakWeekdayArrival = useMemo(
    () => getPeakDistributionItem(weekdayArrivalItems),
    [weekdayArrivalItems]
  );
  const peakHourArrival = useMemo(
    () => getPeakDistributionItem(hourArrivalItems),
    [hourArrivalItems]
  );

  const agingGradient = useMemo(() => buildConicGradient(agingBuckets), [agingBuckets]);
  const originGradient = useMemo(() => buildConicGradient(stats.leadOrigins.items || []), [stats.leadOrigins.items]);
  const unattendedProgress = Math.min(Math.max(Number(stats.unattendedLeads.percent || 0), 0), 100);

  const serviceVelocityItems = useMemo(
    () => [
      {
        label: "Leads recebidos",
        value: stats.serviceVelocity.totalLeads,
        percent: 100,
        accent: "info" as const,
      },
      {
        label: "Leads respondidos",
        value: stats.serviceVelocity.contactedLeads,
        percent: stats.serviceVelocity.responseRate,
        accent: "success" as const,
      },
      {
        label: "Leads sem resposta",
        value: stats.serviceVelocity.leadsWithoutResponse,
        percent: stats.serviceVelocity.leadsWithoutResponsePercent,
        accent: "danger" as const,
      },
      {
        label: "Respondidos em até 5 min",
        value: stats.serviceVelocity.respondedWithin5Min,
        percent:
          stats.serviceVelocity.totalLeads > 0
            ? (stats.serviceVelocity.respondedWithin5Min / stats.serviceVelocity.totalLeads) * 100
            : 0,
        accent: "success" as const,
      },
      {
        label: "Respondidos em até 15 min",
        value: stats.serviceVelocity.respondedWithin15Min,
        percent:
          stats.serviceVelocity.totalLeads > 0
            ? (stats.serviceVelocity.respondedWithin15Min / stats.serviceVelocity.totalLeads) * 100
            : 0,
        accent: "info" as const,
      },
      {
        label: "Respondidos após 15 min",
        value: stats.serviceVelocity.respondedAfter15Min,
        percent:
          stats.serviceVelocity.totalLeads > 0
            ? (stats.serviceVelocity.respondedAfter15Min / stats.serviceVelocity.totalLeads) * 100
            : 0,
        accent: "warning" as const,
      },
    ],
    [stats.serviceVelocity]
  );

  const contactCadenceItems = useMemo(
    () =>
      (stats.contactCadence.buckets || []).map((bucket) => ({
        label: bucket.label,
        value: bucket.leadsCount,
        percent: bucket.leadsPercent,
        accent: "info" as const,
      })),
    [stats.contactCadence.buckets]
  );

  if (!crmId) {
    return (
      <div className="dashboard-loading">
        Crie um funil na aba Configuracoes para visualizar o dashboard.
      </div>
    );
  }

  if (loading) {
    return <div className="dashboard-loading">Carregando indicadores...</div>;
  }

  return (
    <div className="commercial-dashboard commercial-dashboard--overview">
      <section className="commercial-dashboard__hero">
        <div>
          <h2>Visão geral do desempenho comercial</h2>
          <span>
            Indicadores do funil selecionado com funil dinamico conforme as colunas do CRM.
          </span>
        </div>
        <div className="commercial-dashboard__updated-at">
          <span>Última atualização</span>
          <strong>{formatDashboardDateTime(stats.updatedAt)}</strong>
        </div>
      </section>

      <section className="dashboard-overview-filters">
        <div
          className={`dashboard-period-menu-wrapper ${isPeriodFilterOpen ? "open" : ""}`}
          ref={periodFilterRef}
        >
          <button
            type="button"
            className={`dashboard-overview-filter dashboard-date-filter-trigger ${
              hasCustomPeriodFilter ? "is-active" : ""
            }`}
            onClick={() => setIsPeriodFilterOpen((current) => !current)}
            aria-haspopup="dialog"
            aria-expanded={isPeriodFilterOpen}
          >
            <FiCalendar />
            <span>{periodFilterLabel}</span>
          </button>

          {isPeriodFilterOpen ? (
            <div className="dashboard-period-dropdown">
              <PeriodRangePicker
                presetVariant="rolling"
                value={{
                  dateStart: dateRange.start,
                  dateEnd: dateRange.end,
                }}
                onApply={applyPeriodFilter}
                onCancel={() => setIsPeriodFilterOpen(false)}
                showActivePreset={hasCustomPeriodFilter}
              />
            </div>
          ) : null}
        </div>

        <select
          className="dashboard-overview-filter dashboard-filter-select compact"
          value={sellerFilter}
          onChange={(event) => setSellerFilter(event.target.value)}
        >
          <option value="all">Vendedor: Todos</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={String(seller.id)}>
              {seller.nome}
            </option>
          ))}
        </select>

        <select
          className="dashboard-overview-filter dashboard-filter-select compact"
          value={originFilter}
          onChange={(event) => setOriginFilter(event.target.value)}
        >
          <option value="all">Origem: Todas</option>
          {origins.map((origin) => (
            <option key={origin.valor} value={origin.valor}>
              {origin.label}
            </option>
          ))}
        </select>

        <select
          className="dashboard-overview-filter dashboard-filter-select compact"
          value={productFilter}
          onChange={(event) => setProductFilter(event.target.value)}
        >
          <option value="all">Produto: Todos</option>
          {products.map((product) => (
            <option key={product.id} value={product.nome}>
              {product.nome}
            </option>
          ))}
        </select>

        <select
          className="dashboard-overview-filter dashboard-filter-select compact"
          value={branchFilter}
          onChange={(event) => setBranchFilter(event.target.value)}
        >
          <option value="all">Filial: Todas</option>
          <option value="none">Sem filial</option>
          {(domains?.filiais || []).map((branch) => (
            <option key={branch.id} value={String(branch.id)}>
              {branch.nome}
            </option>
          ))}
        </select>

        {hasActiveFilters ? (
          <button
            type="button"
            className="dashboard-overview-clear"
            onClick={clearFilters}
          >
            <FiRefreshCw />
            <span>Limpar filtros</span>
          </button>
        ) : null}
      </section>

      <section className="dashboard-metric-grid">
        <DashboardMetricCard
          title="Leads recebidos"
          value={formatCount(stats.overview.leadsReceived)}
          hint="Volume de leads no periodo selecionado"
          icon={<FiUsers />}
          tone="green"
        />
        <DashboardMetricCard
          title="Tempo medio 1ª resposta"
          value={formatResponseTime(stats.overview.firstResponseAverageSeconds)}
          hint="Meta sugerida: até 5 minutos"
          icon={<FiClock />}
          tone="blue"
        />
        <DashboardMetricCard
          title="Leads contatados"
          value={formatCount(stats.overview.contactedLeads)}
          hint={`${formatPercent(stats.serviceVelocity.responseRate)} do total`}
          icon={<FiMessageCircle />}
          tone="violet"
        />
        <DashboardMetricCard
          title="Total de contatos"
          value={formatCount(stats.overview.totalContacts)}
          hint="Interações registradas com os leads"
          icon={<FiPhoneCall />}
          tone="orange"
        />
        <DashboardMetricCard
          title="Media contatos / lead"
          value={decimalFormatter.format(stats.overview.contactsPerLead || 0)}
          hint="Intensidade media do atendimento"
          icon={<FiTrendingUp />}
          tone="orange"
        />
        <DashboardMetricCard
          title="Follow-ups pendentes"
          value={formatCount(stats.overview.pendingFollowUps)}
          hint={`${formatPercent(stats.overview.pendingFollowUpsPercent)} dos leads`}
          icon={<FiActivity />}
          tone="pink"
        />
        <DashboardMetricCard
          title="Vendas"
          value={formatCount(stats.overview.salesCount)}
          hint={salesSourceSummary || "CRM + Hubla + Hotmart"}
          icon={<FiCheckCircle />}
          tone="green"
        />
        <DashboardMetricCard
          title="Faturamento"
          value={formatCurrency(stats.overview.revenue)}
          hint={revenueSourceSummary || "Faturamento CRM + vendas externas"}
          icon={<FiDollarSign />}
          tone="green"
        />
      </section>

      <section className="dashboard-overview-grid dashboard-overview-grid--top">
        <article className="dashboard-panel dashboard-panel--highlight">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Leads novos</span>
              <h3>Recebidos no periodo</h3>
            </div>
            <div className="dashboard-panel__badge">{formatPercent(stats.leadsNew.percentOfTotal)}</div>
          </div>
          <div className="dashboard-panel__split">
            <div className="dashboard-panel__summary">
              <strong className="dashboard-panel__big-number">{formatCount(stats.leadsNew.total)}</strong>
              <span className="dashboard-panel__muted">100% do total filtrado</span>
              <div className="dashboard-origin-mini-grid">
                {newLeadOriginSummary.length ? (
                  newLeadOriginSummary.map((item) => (
                    <div key={item.origin} className="dashboard-origin-mini-card">
                      <span>{item.origin}</span>
                      <strong>{formatCount(item.count)}</strong>
                      <small>{formatPercent(item.percent)}</small>
                    </div>
                  ))
                ) : (
                  <p className="dashboard-empty">Sem origem predominante no periodo.</p>
                )}
              </div>
            </div>
            <div className="dashboard-panel__chart">
              <div className="dashboard-chart-head">
                <span>Leads novos por periodo</span>
                <strong>Pico de {formatCount(sparklineMax)}</strong>
              </div>
              {leadsSeries.length ? (
                <div className="dashboard-sparkline">
                  <ChartContainer
                    config={leadsLineChartConfig}
                    className="dashboard-line-chart"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        accessibilityLayer
                        data={leadsSeries}
                        margin={{
                          top: 18,
                          right: 18,
                          bottom: 8,
                          left: 18,
                        }}
                      >
                        <CartesianGrid
                          vertical={false}
                          stroke="var(--color-border)"
                          strokeDasharray="2 4"
                        />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          minTickGap={24}
                          tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
                        />
                        <YAxis
                          width={28}
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
                        />
                        <ChartTooltip
                          cursor={{ stroke: "var(--dashboard-blue)", strokeDasharray: "4 4" }}
                          content={
                            <ChartTooltipContent
                              labelFormatter={(value) => String(value)}
                              valueFormatter={(value) => `${formatCount(Number(value || 0))} lead(s)`}
                            />
                          }
                        />
                        <Line
                          dataKey="count"
                          name="Leads"
                          type="monotone"
                          stroke="var(--color-count)"
                          strokeWidth={2.5}
                          dot={{
                            r: 4,
                            strokeWidth: 2,
                            fill: "var(--dashboard-panel)",
                            stroke: "var(--color-count)",
                          }}
                          activeDot={{
                            r: 6,
                            strokeWidth: 2,
                            fill: "var(--color-count)",
                            stroke: "var(--dashboard-panel)",
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              ) : (
                <p className="dashboard-empty">Nenhum lead novo encontrado nesse recorte.</p>
              )}
            </div>
          </div>
        </article>

        <article className="dashboard-panel dashboard-panel--highlight">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow dashboard-panel__eyebrow--violet">
                Leads em andamento
              </span>
              <h3>Recebidos antes do periodo e ainda não fechados</h3>
            </div>
            <div className="dashboard-panel__badge dashboard-panel__badge--violet">
              {formatPercent(stats.leadsInProgress.percentOfActive)}
            </div>
          </div>
          <div className="dashboard-panel__split">
            <div className="dashboard-panel__summary">
              <strong className="dashboard-panel__big-number dashboard-panel__big-number--violet">
                {formatCount(stats.leadsInProgress.total)}
              </strong>
              <span className="dashboard-panel__muted">Percentual sobre os leads ativos</span>
              <div className="dashboard-origin-mini-grid">
                {inProgressOriginSummary.length ? (
                  inProgressOriginSummary.map((item) => (
                    <div key={item.origin} className="dashboard-origin-mini-card">
                      <span>{item.origin}</span>
                      <strong>{formatCount(item.count)}</strong>
                      <small>{formatPercent(item.percent)}</small>
                    </div>
                  ))
                ) : (
                  <p className="dashboard-empty">Sem leads herdados de periodos anteriores.</p>
                )}
              </div>
            </div>
            <div className="dashboard-panel__chart">
              <div className="dashboard-donut-block">
                <div className="dashboard-donut">
                  <div
                    className="dashboard-donut__ring"
                    style={{ backgroundImage: agingGradient }}
                  >
                    <div className="dashboard-donut__center">
                      <strong>{formatCount(stats.leadsInProgress.total)}</strong>
                      <span>leads ativos</span>
                    </div>
                  </div>
                </div>
                <DistributionLegend
                  items={agingBuckets.map((bucket) => ({
                    label: bucket.label,
                    count: bucket.count,
                    percent: bucket.percent,
                  }))}
                />
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-overview-grid dashboard-overview-grid--middle">
        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Velocidade de atendimento</span>
              <h3>Tempo de resposta e cobertura do comercial</h3>
            </div>
          </div>
          <ProgressList items={serviceVelocityItems} totalBase={stats.serviceVelocity.totalLeads} />
          <div className="dashboard-stat-footer">
            <div className="dashboard-stat-footer__box">
              <span>Tempo medio da primeira resposta</span>
              <strong>{formatResponseTime(stats.serviceVelocity.averageFirstResponseSeconds)}</strong>
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Contatos por lead</span>
              <h3>Cadencia de atendimento do comercial</h3>
            </div>
          </div>
          <ProgressList items={contactCadenceItems} />
          <div className="dashboard-stat-footer dashboard-stat-footer--double">
            <div className="dashboard-stat-footer__box">
              <span>Total de contatos realizados</span>
              <strong>{formatCount(stats.contactCadence.totalContacts)}</strong>
            </div>
            <div className="dashboard-stat-footer__box">
              <span>Media de contatos por lead</span>
              <strong>{decimalFormatter.format(stats.contactCadence.averageContactsPerLead || 0)}</strong>
            </div>
          </div>
          <div className="dashboard-inline-alert">
            <FiFilter />
            <span>
              {formatCount(stats.contactCadence.leadsWithoutContact)} lead(s) sem contato
              registrado(s) ({formatPercent(stats.contactCadence.leadsWithoutContactPercent)}).
            </span>
          </div>
        </article>

        <article className="dashboard-panel dashboard-panel--funnel">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Funil comercial</span>
              <h3>Etapas dinamicas conforme as colunas do pipeline</h3>
            </div>
            <div className="dashboard-panel__badge dashboard-panel__badge--success">
              {formatPercent(stats.funnel.overallConversionRate)}
            </div>
          </div>

          {funnelItems.length ? (
            <div className="dashboard-funnel-layout">
              <div className="dashboard-funnel-table">
                <div className="dashboard-funnel-table__head">
                  <span>Etapa</span>
                  <span>Quantidade</span>
                  <span>% etapa anterior</span>
                  <span>% total</span>
                </div>
                <div className="dashboard-funnel-table__body">
                  {funnelItems.map((item) => (
                    <div key={item.code} className="dashboard-funnel-table__row">
                      <span className="dashboard-funnel-table__stage">
                        <span
                          className="dashboard-funnel-table__stage-dot"
                          style={{ backgroundColor: item.color || "#3b82f6" }}
                        />
                        {item.name}
                      </span>
                      <strong>{formatCount(item.count)}</strong>
                      <span>{formatPercent(item.percentFromPrevious)}</span>
                      <span>{formatPercent(item.percentOfTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dashboard-funnel-visual">
                <ChartContainer
                  config={{
                    count: { label: "Leads" },
                    stage: { label: "Etapa" },
                  }}
                  className="dashboard-funnel-radial-chart"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      data={funnelChartData}
                      innerRadius={28}
                      outerRadius={104}
                      barSize={14}
                    >
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            hideLabel
                            nameKey="stage"
                            valueFormatter={(value) => `${formatCount(Number(value || 0))} lead(s)`}
                          />
                        }
                      />
                      <PolarGrid gridType="circle" radialLines={false} stroke="var(--color-border)" />
                      <RadialBar dataKey="count" background cornerRadius={8} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="dashboard-funnel-visual__summary">
                  <span>Taxa de conversão geral</span>
                  <strong>{formatPercent(stats.funnel.overallConversionRate)}</strong>
                  <small>Leads para vendas</small>
                </div>
              </div>
            </div>
          ) : (
            <p className="dashboard-empty">Nenhuma etapa disponivel para montar o funil.</p>
          )}
        </article>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <span className="dashboard-panel__eyebrow">Desempenho por vendedor</span>
            <h3>Distribuição de leads, contatos, vendas, perdas e faturamento</h3>
          </div>
        </div>
        {sellerRows.length ? (
          <div className="dashboard-seller-table">
            <div className="dashboard-seller-table__head">
              <span>Vendedor</span>
              <span>Leads novos</span>
              <span>Em andamento</span>
              <span>Contatos</span>
              <span>Media / lead</span>
              <span>Conversão</span>
              <span>Vendas</span>
              <span>Perdidas</span>
              <span>Faturamento</span>
            </div>
            <div className="dashboard-seller-table__body">
              {sellerRows.map((seller) => (
                <div key={seller.sellerId} className="dashboard-seller-table__row">
                  <span className="dashboard-seller-table__seller">
                    <span className="dashboard-seller-table__avatar">
                      {getInitials(seller.sellerName)}
                    </span>
                    <span>{seller.sellerName}</span>
                  </span>
                  <strong>{formatCount(seller.leadsNew)}</strong>
                  <span>{formatCount(seller.leadsInProgress)}</span>
                  <span>{formatCount(seller.contactsMade)}</span>
                  <span>{decimalFormatter.format(seller.averageContactsPerLead || 0)}</span>
                  <span>{formatPercent(seller.conversionRate)}</span>
                  <span>{formatCount(seller.salesCount)}</span>
                  <span>{formatCount(seller.lostSalesCount)}</span>
                  <strong>{formatCurrency(seller.revenue)}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="dashboard-empty">Nenhum vendedor com dados no periodo selecionado.</p>
        )}
      </section>

      <section className="dashboard-overview-grid dashboard-overview-grid--bottom">
        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Origem dos leads</span>
              <h3>Participação por canal de entrada</h3>
            </div>
          </div>
          <div className="dashboard-donut-block">
            <div className="dashboard-donut">
              <div
                className="dashboard-donut__ring"
                style={{ backgroundImage: originGradient }}
              >
                <div className="dashboard-donut__center">
                  <strong>{formatCount(stats.leadOrigins.total)}</strong>
                  <span>leads</span>
                </div>
              </div>
            </div>
            <DistributionLegend items={leadOriginLegend} />
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Leads sem atendimento</span>
              <h3>Leads recebidos que ainda não tiveram resposta</h3>
            </div>
          </div>
          <div className="dashboard-unattended">
            <div className="dashboard-unattended__gauge">
              <div
                className="dashboard-unattended__ring"
                style={{
                  backgroundImage: `conic-gradient(var(--dashboard-danger) 0 ${unattendedProgress}%, var(--dashboard-track) ${unattendedProgress}% 100%)`,
                }}
              >
                <div className="dashboard-unattended__center">
                  <strong>{formatCount(stats.unattendedLeads.total)}</strong>
                  <span>{formatPercent(stats.unattendedLeads.percent)}</span>
                </div>
              </div>
            </div>
            <div className="dashboard-unattended__meta">
              <div className="dashboard-unattended__meta-row">
                <span>Leads recebidos</span>
                <strong>{formatCount(stats.unattendedLeads.totalLeads)}</strong>
              </div>
              <div className="dashboard-unattended__meta-row">
                <span>Leads sem resposta</span>
                <strong>{formatCount(stats.unattendedLeads.total)}</strong>
              </div>
              <div className="dashboard-inline-alert dashboard-inline-alert--danger">
                <FiTarget />
                <span>
                  O ideal é reduzir esse indicador aumentando a resposta inicial dentro de 5
                  minutos.
                </span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-overview-grid dashboard-overview-grid--timing">
        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Chegada dos leads</span>
              <h3>Dia da semana com maior entrada</h3>
            </div>
            <div className="dashboard-panel__badge">
              {peakWeekdayArrival ? peakWeekdayArrival.label : "-"}
            </div>
          </div>
          <div className="dashboard-timing-summary">
            <strong>
              {peakWeekdayArrival ? formatCount(peakWeekdayArrival.count) : "0"} lead(s)
            </strong>
            <span>
              {peakWeekdayArrival
                ? `${peakWeekdayArrival.label} concentra ${formatPercent(
                    peakWeekdayArrival.percent
                  )} do total filtrado.`
                : "Sem leads no periodo selecionado."}
            </span>
          </div>
          <DistributionHistogram items={weekdayArrivalItems} accent="success" />
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Chegada dos leads</span>
              <h3>Horario do dia com maior entrada</h3>
            </div>
            <div className="dashboard-panel__badge">
              {peakHourArrival ? peakHourArrival.label : "-"}
            </div>
          </div>
          <div className="dashboard-timing-summary">
            <strong>{peakHourArrival ? formatCount(peakHourArrival.count) : "0"} lead(s)</strong>
            <span>
              {peakHourArrival
                ? `${peakHourArrival.label} concentra ${formatPercent(
                    peakHourArrival.percent
                  )} do total filtrado.`
                : "Sem leads no periodo selecionado."}
            </span>
          </div>
          <DistributionHistogram items={hourArrivalItems} accent="warning" />
        </article>
      </section>
    </div>
  );
}
