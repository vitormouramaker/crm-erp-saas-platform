import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiCalendar,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEdit2,
  FiEye,
  FiFilter,
  FiSearch,
} from "react-icons/fi";
import { Modal } from "../../common/Modal/Modal";
import { PeriodRangePicker } from "../../common/PeriodRangePicker/PeriodRangePicker";
import { FinishServiceModal } from "../Pipeline/FinishServiceModal";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  getCommercialClosedDeals,
  getCommercialDomains,
  subscribeToCommercialDataChanged,
  updateCommercialDeal,
  type CommercialDomainOption,
  type CommercialDomains,
  type Deal,
  type PaginatedDealsResult,
} from "../../../service/commercialService";
import { exportClosedDealsWorkbook } from "../../../utils/closedDealsExport";
import "./CommercialClosedDeals.css";

type CommercialClosedDealsProps = {
  crmId?: number | null;
};

type ClosedDealsFilters = {
  search: string;
  ownerId: string;
  stage: string;
  origin: string;
  dateStart: string;
  dateEnd: string;
};

type DealQuoteModalContentProps = {
  deal: Deal;
};

const EMPTY_FILTERS: ClosedDealsFilters = {
  search: "",
  ownerId: "",
  stage: "",
  origin: "",
  dateStart: "",
  dateEnd: "",
};

const EMPTY_RESULT: PaginatedDealsResult = {
  items: [],
  total: 0,
  pagina: 1,
  limite: 20,
  total_paginas: 1,
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function titleizeWords(value: string) {
  return value.replace(/\b([a-zA-ZÀ-ÿ])([a-zA-ZÀ-ÿ]*)/g, (_, first: string, rest: string) => {
    return `${first.toUpperCase()}${rest.toLowerCase()}`;
  });
}

function formatCodeLabel(value?: string | null, replacements: Array<[RegExp, string]> = []) {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";

  const withSpaces = normalized.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const replaced = replacements.reduce((current, [pattern, replacement]) => {
    return current.replace(pattern, replacement);
  }, withSpaces);
  const titled = titleizeWords(replaced.replace(/\s+/g, " ").trim());

  return titled
    .replace(/\bWhatsapp\b/g, "WhatsApp")
    .replace(/\bUtm\b/g, "UTM")
    .replace(/\bTed\b/g, "TED")
    .replace(/\bDoc\b/g, "DOC")
    .replace(/\bPix\b/g, "Pix");
}

function formatSaleOriginLabel(value?: string | null) {
  return formatCodeLabel(value, [
    [/\breferral\b/gi, "indicacao"],
    [/\borganic\b/gi, "organico"],
    [/\bads?\b/gi, "trafego pago"],
    [/\butm\b/gi, "UTM"],
    [/\bwhats\b/gi, "WhatsApp"],
    [/\big\b/gi, "Instagram"],
  ]);
}

function formatPaymentLabel(
  value?: string | null,
  paymentOptions: CommercialDomainOption[] = []
) {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";

  const matchedOption = paymentOptions.find(
    (option) => String(option.codigo || "").trim().toLowerCase() === normalized.toLowerCase()
  );
  if (matchedOption?.nome) return matchedOption.nome;

  return formatCodeLabel(normalized, [
    [/\bcredito\b/gi, "cartao de credito"],
    [/\bdebito\b/gi, "cartao de debito"],
    [/\btransferencia\b/gi, "transferencia"],
    [/\bted\b/gi, "TED"],
    [/\bdoc\b/gi, "DOC"],
    [/\bpix\b/gi, "Pix"],
  ]);
}

function getStageLabel(stage?: string) {
  return stage === "closed-lost" ? "Perdido" : "Ganho";
}

function buildClosedDealsCacheKey(params: {
  crmId?: number | null;
  ownerId?: string;
  stage?: string;
  origin?: string;
  search?: string;
  dateStart?: string;
  dateEnd?: string;
  page: number;
  limit: number;
}) {
  return JSON.stringify({
    crmId: Number(params.crmId || 0) || 0,
    ownerId: String(params.ownerId || "").trim(),
    stage: String(params.stage || "").trim(),
    origin: String(params.origin || "").trim().toLowerCase(),
    search: String(params.search || "").trim().toLowerCase(),
    dateStart: String(params.dateStart || "").trim(),
    dateEnd: String(params.dateEnd || "").trim(),
    page: Number(params.page || 1) || 1,
    limit: Number(params.limit || 20) || 20,
  });
}

function getDealQuoteItems(deal: Deal) {
  if (Array.isArray(deal.quote?.items) && deal.quote.items.length) {
    return deal.quote.items;
  }
  if (Array.isArray(deal.products) && deal.products.length) {
    return deal.products;
  }
  return [];
}

function getDealQuoteSummary(deal: Deal) {
  const items = getDealQuoteItems(deal);
  const subtotal = items.reduce((sum, item) => {
    return sum + Number(item.subtotal ?? Number(item.quantity || 0) * Number(item.price || 0));
  }, 0);
  const total = Number(deal.quote?.total ?? subtotal ?? deal.amount ?? 0);
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return {
    items,
    total,
    totalQuantity,
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildClosedDealsPdfHtml(params: {
  rows: Deal[];
  filters: ClosedDealsFilters;
  paymentOptions: CommercialDomainOption[];
}) {
  const { rows, filters, paymentOptions } = params;
  const generatedAt = new Date().toLocaleString("pt-BR");

  const activeFilters = [
    filters.search ? `Busca: ${filters.search}` : "",
    filters.ownerId ? "Vendedor filtrado" : "",
    filters.stage ? `Status: ${getStageLabel(filters.stage)}` : "",
    filters.origin ? `Origem: ${formatSaleOriginLabel(filters.origin)}` : "",
    filters.dateStart ? `De: ${formatDate(filters.dateStart)}` : "",
    filters.dateEnd ? `Ate: ${formatDate(filters.dateEnd)}` : "",
  ].filter(Boolean);

  const cardsHtml = rows
    .map((deal) => {
      const summary = getDealQuoteSummary(deal);
      const itemsHtml = summary.items.length
        ? summary.items
            .map((item) => {
              const subtotal = Number(
                item.subtotal ?? Number(item.quantity || 0) * Number(item.price || 0)
              );
              return `
                <tr>
                  <td>${escapeHtml(item.name || "-")}</td>
                  <td>${Number(item.quantity || 0)}</td>
                  <td>${escapeHtml(formatCurrency(item.price))}</td>
                  <td>${escapeHtml(formatCurrency(subtotal))}</td>
                  <td>${Number(item.soldQuantity || 0)}</td>
                  <td>${Number(item.lostQuantity || 0)}</td>
                </tr>
              `;
            })
            .join("")
        : `
          <tr>
            <td colspan="6">Nenhum item registrado neste orcamento.</td>
          </tr>
        `;

      return `
        <section class="deal-card">
          <div class="deal-card__header">
            <div>
              <h2>${escapeHtml(deal.quote?.title || deal.title || "Orcamento")}</h2>
              <p>${escapeHtml(deal.contactName || deal.companyName || "-")} • ${escapeHtml(
                getStageLabel(deal.stage)
              )}</p>
            </div>
            <div class="deal-card__amounts">
              <span>Venda: ${escapeHtml(formatCurrency(deal.amount))}</span>
              <span>Orcamento: ${escapeHtml(formatCurrency(summary.total))}</span>
            </div>
          </div>

          <div class="deal-card__meta">
            <span><strong>Fechamento:</strong> ${escapeHtml(
              formatDate(deal.saleDate || deal.closingDate || deal.createdAt)
            )}</span>
            <span><strong>Vendedor:</strong> ${escapeHtml(deal.ownerName || "-")}</span>
            <span><strong>Origem:</strong> ${escapeHtml(formatSaleOriginLabel(deal.saleOrigin))}</span>
            <span><strong>Pagamento:</strong> ${escapeHtml(
              formatPaymentLabel(deal.paymentMethod, paymentOptions)
            )}</span>
          </div>

          ${
            deal.quote?.notes
              ? `<p class="deal-card__notes">${escapeHtml(deal.quote.notes)}</p>`
              : ""
          }

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qtd</th>
                <th>Unitario</th>
                <th>Subtotal</th>
                <th>Vendida</th>
                <th>Perdida</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </section>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Fechamentos comerciais</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, sans-serif;
            color: #0f172a;
            background: #f8fafc;
          }
          .page-header {
            margin-bottom: 20px;
            padding: 20px 22px;
            border-radius: 16px;
            background: linear-gradient(135deg, #eff6ff, #e0f2fe);
            border: 1px solid #cbd5e1;
          }
          .page-header h1 {
            margin: 0 0 8px;
            font-size: 24px;
          }
          .page-header p,
          .page-header small {
            margin: 0;
            color: #475569;
          }
          .filters {
            margin-top: 10px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          .filters span {
            padding: 6px 10px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid #cbd5e1;
            font-size: 12px;
          }
          .deal-card {
            margin-bottom: 18px;
            padding: 18px;
            border-radius: 16px;
            background: #ffffff;
            border: 1px solid #dbe2ea;
            page-break-inside: avoid;
          }
          .deal-card__header,
          .deal-card__meta {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
          }
          .deal-card__header h2 {
            margin: 0 0 6px;
            font-size: 18px;
          }
          .deal-card__header p,
          .deal-card__meta span,
          .deal-card__notes {
            margin: 0;
            color: #475569;
          }
          .deal-card__amounts {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          .deal-card__amounts span {
            padding: 8px 12px;
            border-radius: 999px;
            background: #f8fafc;
            border: 1px solid #dbe2ea;
            font-weight: 700;
          }
          .deal-card__meta {
            margin: 14px 0 12px;
          }
          .deal-card__notes {
            margin-bottom: 12px;
            line-height: 1.5;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
          }
          .items-table th,
          .items-table td {
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
          }
          .items-table th {
            background: #f8fafc;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #64748b;
          }
          @media print {
            body { background: #ffffff; padding: 12px; }
            .page-header { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <header class="page-header">
          <h1>Fechamentos comerciais</h1>
          <p>${rows.length} registro(s) exportado(s)</p>
          <small>Gerado em ${escapeHtml(generatedAt)}</small>
          ${
            activeFilters.length
              ? `<div class="filters">${activeFilters
                  .map((item) => `<span>${escapeHtml(item)}</span>`)
                  .join("")}</div>`
              : ""
          }
        </header>
        ${cardsHtml}
      </body>
    </html>
  `;
}

function DealQuoteModalContent({ deal }: DealQuoteModalContentProps) {
  const summary = getDealQuoteSummary(deal);

  return (
    <div className="closed-deals-details closed-deals-details--modal">
      <div className="closed-deals-details__header">
        <div>
          <strong>{deal.quote?.title || deal.title || "Orcamento"}</strong>
          <span>
            {summary.items.length} item(ns) • {summary.totalQuantity} unidade(s)
          </span>
        </div>
        <div className="closed-deals-details__totals">
          <span>Orcamento: {formatCurrency(summary.total)}</span>
          <span>Venda: {formatCurrency(deal.amount)}</span>
        </div>
      </div>

      {deal.quote?.notes ? (
        <p className="closed-deals-details__notes">{deal.quote.notes}</p>
      ) : null}

      {summary.items.length ? (
        <div className="closed-deals-items-wrap">
          <table className="closed-deals-items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qtd</th>
                <th>Unitario</th>
                <th>Subtotal</th>
                <th>Vendida</th>
                <th>Perdida</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((item, index) => (
                <tr key={`${deal.id}-quote-item-${index}-${item.name}`}>
                  <td>{item.name || "-"}</td>
                  <td>{Number(item.quantity || 0)}</td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>
                    {formatCurrency(
                      item.subtotal ?? Number(item.quantity || 0) * Number(item.price || 0)
                    )}
                  </td>
                  <td>{Number(item.soldQuantity || 0)}</td>
                  <td>{Number(item.lostQuantity || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="closed-deals-details__empty">Nenhum item registrado neste orcamento.</div>
      )}
    </div>
  );
}

function buildVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 1) return [1];

  const pages = new Set<number>([1, totalPages, currentPage]);
  for (let offset = -1; offset <= 1; offset += 1) {
    const nextPage = currentPage + offset;
    if (nextPage >= 1 && nextPage <= totalPages) {
      pages.add(nextPage);
    }
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  sorted.forEach((page, index) => {
    const previousPage = sorted[index - 1];
    if (typeof previousPage === "number" && page - previousPage > 1) {
      result.push("ellipsis");
    }
    result.push(page);
  });

  return result;
}

export function CommercialClosedDeals({ crmId }: CommercialClosedDealsProps) {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();
  const [domains, setDomains] = useState<CommercialDomains | null>(null);
  const [filters, setFilters] = useState<ClosedDealsFilters>(EMPTY_FILTERS);
  const [result, setResult] = useState<PaginatedDealsResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [isPeriodFilterOpen, setIsPeriodFilterOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isSavingDealEdit, setIsSavingDealEdit] = useState(false);
  const hasLoadedRef = useRef(false);
  const domainsRef = useRef<CommercialDomains | null>(null);
  const periodFilterRef = useRef<HTMLDivElement | null>(null);
  const cacheRef = useRef<Map<string, PaginatedDealsResult>>(new Map());
  const requestIdRef = useRef(0);
  const resultRef = useRef<PaginatedDealsResult>(EMPTY_RESULT);
  const canViewAllClosedDeals = Boolean(user?.is_master) || hasPermission("commercial.manager");
  const canEditClosedDeals = canViewAllClosedDeals;
  const effectiveOwnerId = canViewAllClosedDeals ? filters.ownerId : String(user?.id || "");

  useEffect(() => {
    domainsRef.current = domains;
  }, [domains]);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  const loadClosedDeals = useCallback(
    async (
      nextFilters: ClosedDealsFilters,
      page = 1,
      options?: { forceRefresh?: boolean }
    ) => {
      if (!crmId) {
        setDomains(null);
        setResult(EMPTY_RESULT);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      const forceRefresh = Boolean(options?.forceRefresh);
      const resolvedOwnerId =
        (canViewAllClosedDeals ? nextFilters.ownerId : String(user?.id || "")) || "";
      const cacheKey = buildClosedDealsCacheKey({
        crmId,
        ownerId: resolvedOwnerId,
        stage: nextFilters.stage,
        origin: nextFilters.origin,
        search: nextFilters.search,
        dateStart: nextFilters.dateStart,
        dateEnd: nextFilters.dateEnd,
        page,
        limit: 20,
      });

      if (!forceRefresh) {
        const cachedResult = cacheRef.current.get(cacheKey);
        if (cachedResult) {
          setResult(cachedResult);
          return;
        }
      }

      const currentDomains = domainsRef.current;
      const isInitialLoad = !currentDomains && !(resultRef.current.items || []).length;
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      try {
        let nextDomains = currentDomains;
        if (!nextDomains || Number(nextDomains.crm_id) !== Number(crmId || nextDomains.crm_id)) {
          nextDomains = await getCommercialDomains(crmId);
          setDomains(nextDomains);
          domainsRef.current = nextDomains;
        }
        if (!nextDomains) throw new Error("Funil nao encontrado.");

        const nextResult = await getCommercialClosedDeals({
          crmId: nextDomains.crm_id,
          ownerId: resolvedOwnerId || undefined,
          stage: nextFilters.stage || undefined,
          origin: nextFilters.origin || undefined,
          search: nextFilters.search || undefined,
          dateStart: nextFilters.dateStart || undefined,
          dateEnd: nextFilters.dateEnd || undefined,
          page,
          limit: 20,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        cacheRef.current.set(cacheKey, nextResult);
        setResult(nextResult);

        const totalPages = Math.max(Number(nextResult.total_paginas || 1), 1);
        const nextPage = page + 1;
        if (nextPage <= totalPages) {
          const nextPageCacheKey = buildClosedDealsCacheKey({
            crmId: nextDomains.crm_id,
            ownerId: resolvedOwnerId,
            stage: nextFilters.stage,
            origin: nextFilters.origin,
            search: nextFilters.search,
            dateStart: nextFilters.dateStart,
            dateEnd: nextFilters.dateEnd,
            page: nextPage,
            limit: 20,
          });

          if (!cacheRef.current.has(nextPageCacheKey)) {
            void getCommercialClosedDeals({
              crmId: nextDomains.crm_id,
              ownerId: resolvedOwnerId || undefined,
              stage: nextFilters.stage || undefined,
              origin: nextFilters.origin || undefined,
              search: nextFilters.search || undefined,
              dateStart: nextFilters.dateStart || undefined,
              dateEnd: nextFilters.dateEnd || undefined,
              page: nextPage,
              limit: 20,
            })
              .then((prefetchedResult) => {
                cacheRef.current.set(nextPageCacheKey, prefetchedResult);
              })
              .catch(() => undefined);
          }
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        addToast({
          type: "error",
          title: "Erro",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel carregar as vendas fechadas.",
        });
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [addToast, canViewAllClosedDeals, crmId, user?.id]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    cacheRef.current.clear();
    setDomains(null);
    setFilters(EMPTY_FILTERS);
    setResult(EMPTY_RESULT);
    setSelectedDeal(null);
    setEditingDeal(null);
    setIsPeriodFilterOpen(false);
    domainsRef.current = null;
    resultRef.current = EMPTY_RESULT;
    hasLoadedRef.current = false;
    setLoading(true);
    setIsRefreshing(false);
    void loadClosedDeals(EMPTY_FILTERS, 1, { forceRefresh: true });
  }, [crmId]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadClosedDeals(filters, 1);
    }, filters.search ? 250 : 80);

    return () => window.clearTimeout(timeoutId);
  }, [filters, loadClosedDeals]);

  useEffect(
    () =>
      subscribeToCommercialDataChanged(() => {
        cacheRef.current.clear();
        void loadClosedDeals(filters, resultRef.current.pagina || 1, {
          forceRefresh: true,
        });
      }),
    [filters, loadClosedDeals]
  );

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

  const ownerOptions = useMemo(() => domains?.responsaveis || [], [domains]);
  const saleOriginOptions = useMemo(() => domains?.origens_venda || [], [domains]);
  const paymentOptions = useMemo(() => domains?.formas_pagamento || [], [domains]);
  const lossReasonOptions = useMemo(() => domains?.motivos_perda || [], [domains]);
  const productCatalog = useMemo(() => domains?.produtos || [], [domains]);
  const rows = result.items || [];
  const totalPages = Math.max(Number(result.total_paginas || 1), 1);
  const currentPage = Math.max(Number(result.pagina || 1), 1);
  const visiblePages = useMemo(
    () => buildVisiblePages(currentPage, totalPages),
    [currentPage, totalPages]
  );
  const startItem = result.total > 0 ? (currentPage - 1) * result.limite + 1 : 0;
  const endItem = result.total > 0 ? startItem + rows.length - 1 : 0;
  const ownerLabel = canViewAllClosedDeals
    ? ownerOptions.find((owner) => String(owner.id) === String(filters.ownerId))?.nome || ""
    : user?.name || "";
  const stageLabel = filters.stage ? getStageLabel(filters.stage) : "";
  const saleOriginLabel = filters.origin ? formatSaleOriginLabel(filters.origin) : "";

  const periodFilterLabel = useMemo(() => {
    const start = filters.dateStart;
    const end = filters.dateEnd;

    if (start && end) return `${formatDate(start)} ate ${formatDate(end)}`;
    if (start) return `A partir de ${formatDate(start)}`;
    if (end) return `Ate ${formatDate(end)}`;
    return "Definir periodo";
  }, [filters.dateEnd, filters.dateStart]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.search ||
          filters.ownerId ||
          filters.stage ||
          filters.origin ||
          filters.dateStart ||
          filters.dateEnd
      ),
    [filters]
  );

  const summaryLabel = useMemo(() => {
    if (!result.total) return "Nenhum fechamento encontrado.";
    return `Mostrando ${startItem}-${endItem} de ${result.total} fechamentos.`;
  }, [endItem, result.total, startItem]);

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setIsPeriodFilterOpen(false);
  };

  const openPeriodFilterModal = () => {
    setIsPeriodFilterOpen((current) => !current);
  };

  const applyPeriodFilter = (nextPeriod: { dateStart: string; dateEnd: string }) => {
    setFilters((current) => ({
      ...current,
      dateStart: nextPeriod.dateStart,
      dateEnd: nextPeriod.dateEnd,
    }));
    setIsPeriodFilterOpen(false);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    void loadClosedDeals(filters, page);
  };

  const handleClosedDealUpdated = useCallback((updatedDeal: Deal) => {
    setResult((current) => ({
      ...current,
      items: (current.items || []).map((item) =>
        String(item.id) === String(updatedDeal.id) ? updatedDeal : item
      ),
    }));
    setSelectedDeal(updatedDeal);
  }, []);

  const handleSaveClosedDeal = useCallback(
    async (deal: Deal, updates: Partial<Deal>, successTitle: string) => {
      if (!domains?.crm_id) return;

      try {
        setIsSavingDealEdit(true);
        const updatedDeal = await updateCommercialDeal(
          String(deal.id),
          updates,
          Number(domains.crm_id)
        );

        cacheRef.current.clear();
        handleClosedDealUpdated(updatedDeal);
        setEditingDeal(null);
        addToast({
          type: "success",
          title: successTitle,
          description: "Fechamento atualizado com sucesso.",
        });
        await loadClosedDeals(filters, currentPage, { forceRefresh: true });
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro ao editar venda",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel atualizar este fechamento.",
        });
      } finally {
        setIsSavingDealEdit(false);
      }
    },
    [addToast, currentPage, domains?.crm_id, filters, handleClosedDealUpdated, loadClosedDeals]
  );

  const handleExportPdf = useCallback(async () => {
    if (!crmId) return;

    setIsExportingPdf(true);

    try {
      let nextDomains = domainsRef.current;
      if (!nextDomains || Number(nextDomains.crm_id) !== Number(crmId || nextDomains.crm_id)) {
        nextDomains = await getCommercialDomains(crmId);
        setDomains(nextDomains);
        domainsRef.current = nextDomains;
      }

      if (!nextDomains) throw new Error("Funil nao encontrado.");

      const requestPayload = {
        crmId: nextDomains.crm_id,
        ownerId: effectiveOwnerId || undefined,
        stage: filters.stage || undefined,
        origin: filters.origin || undefined,
        search: filters.search || undefined,
        dateStart: filters.dateStart || undefined,
        dateEnd: filters.dateEnd || undefined,
        limit: 100,
      };

      const firstPage = await getCommercialClosedDeals({
        ...requestPayload,
        page: 1,
      });

      let allItems = [...(firstPage.items || [])];
      const exportPages = Math.max(Number(firstPage.total_paginas || 1), 1);

      for (let page = 2; page <= exportPages; page += 1) {
        const pageResult = await getCommercialClosedDeals({
          ...requestPayload,
          page,
        });
        allItems = [...allItems, ...(pageResult.items || [])];
      }

      if (!allItems.length) {
        addToast({
          type: "warning",
          title: "Sem dados",
          description: "Nao ha fechamentos para exportar com os filtros atuais.",
        });
        return;
      }

      const exportWindow = window.open("", "_blank", "width=1120,height=820");
      if (!exportWindow) {
        throw new Error("O navegador bloqueou a janela de exportacao. Libere pop-ups e tente novamente.");
      }

      exportWindow.document.open();
      exportWindow.document.write(
        buildClosedDealsPdfHtml({
          rows: allItems,
          filters,
          paymentOptions: nextDomains.formas_pagamento || [],
        })
      );
      exportWindow.document.close();
      exportWindow.focus();

      window.setTimeout(() => {
        exportWindow.print();
      }, 300);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Nao foi possivel exportar os fechamentos em PDF.",
      });
    } finally {
      setIsExportingPdf(false);
    }
  }, [addToast, crmId, effectiveOwnerId, filters]);

  const handleExportExcel = useCallback(async () => {
    if (!crmId) return;

    setIsExportingExcel(true);

    try {
      let nextDomains = domainsRef.current;
      if (!nextDomains || Number(nextDomains.crm_id) !== Number(crmId || nextDomains.crm_id)) {
        nextDomains = await getCommercialDomains(crmId);
        setDomains(nextDomains);
        domainsRef.current = nextDomains;
      }

      if (!nextDomains) throw new Error("Funil nao encontrado.");

      const requestPayload = {
        crmId: nextDomains.crm_id,
        ownerId: effectiveOwnerId || undefined,
        stage: filters.stage || undefined,
        origin: filters.origin || undefined,
        search: filters.search || undefined,
        dateStart: filters.dateStart || undefined,
        dateEnd: filters.dateEnd || undefined,
        limit: 100,
      };

      const firstPage = await getCommercialClosedDeals({
        ...requestPayload,
        page: 1,
      });

      let allItems = [...(firstPage.items || [])];
      const exportPages = Math.max(Number(firstPage.total_paginas || 1), 1);

      for (let page = 2; page <= exportPages; page += 1) {
        const pageResult = await getCommercialClosedDeals({
          ...requestPayload,
          page,
        });
        allItems = [...allItems, ...(pageResult.items || [])];
      }

      if (!allItems.length) {
        addToast({
          type: "warning",
          title: "Sem dados",
          description: "Nao ha fechamentos para exportar com os filtros atuais.",
        });
        return;
      }

      exportClosedDealsWorkbook({
        crmName: nextDomains.crm_id ? `crm_${nextDomains.crm_id}` : "comercial",
        deals: allItems,
        filters: {
          search: filters.search,
          ownerLabel,
          stageLabel,
          saleOriginLabel,
          dateStart: filters.dateStart,
          dateEnd: filters.dateEnd,
        },
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel exportar os fechamentos em Excel.",
      });
    } finally {
      setIsExportingExcel(false);
    }
  }, [addToast, crmId, effectiveOwnerId, filters, ownerLabel, stageLabel]);

  if (!crmId) {
    return (
      <div className="closed-deals-page">
        <div className="closed-deals-empty-state">
          Nenhum funil disponivel para listar fechamentos.
        </div>
      </div>
    );
  }

  return (
    <div className="closed-deals-page">
      <div className="closed-deals-toolbar">
        <div className="closed-deals-filters">
          <div className="closed-deals-search">
            <FiSearch className="closed-deals-search__icon" />
            <input
              type="text"
              placeholder="Buscar cliente, contato ou card..."
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
          </div>

          {canViewAllClosedDeals ? (
            <select
              className="closed-deals-filter-select compact"
              value={filters.ownerId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, ownerId: event.target.value }))
              }
            >
              <option value="">Vendedores</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={String(owner.id)}>
                  {owner.nome}
                </option>
              ))}
            </select>
          ) : (
            <div className="closed-deals-locked-filter">
              <span>Vendedor</span>
              <strong>{user?.name || "Minhas vendas"}</strong>
            </div>
          )}

          <select
            className="closed-deals-filter-select compact"
            value={filters.stage}
            onChange={(event) =>
              setFilters((current) => ({ ...current, stage: event.target.value }))
            }
          >
            <option value="">Status</option>
            <option value="closed-won">Ganhos</option>
            <option value="closed-lost">Perdidos</option>
          </select>

          <select
            className="closed-deals-filter-select compact"
            value={filters.origin}
            onChange={(event) =>
              setFilters((current) => ({ ...current, origin: event.target.value }))
            }
          >
            <option value="">Origem da venda</option>
            {saleOriginOptions.map((origin) => (
              <option key={origin.valor} value={origin.valor}>
                {origin.label || formatSaleOriginLabel(origin.valor)}
              </option>
            ))}
          </select>

          <div
            className={`closed-deals-period-menu-wrapper ${
              isPeriodFilterOpen ? "open" : ""
            }`}
            ref={periodFilterRef}
          >
            <button
              type="button"
              className={`closed-deals-date-filter-trigger ${
                filters.dateStart || filters.dateEnd ? "is-active" : ""
              }`}
              onClick={openPeriodFilterModal}
              aria-haspopup="dialog"
              aria-expanded={isPeriodFilterOpen}
            >
              <FiCalendar />
              <span>{periodFilterLabel}</span>
            </button>

            {isPeriodFilterOpen ? (
              <div className="closed-deals-period-dropdown">
                <PeriodRangePicker
                  value={{ dateStart: filters.dateStart, dateEnd: filters.dateEnd }}
                  onApply={applyPeriodFilter}
                  onCancel={() => setIsPeriodFilterOpen(false)}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="closed-deals-toolbar__actions">
          <details className="closed-deals-toolbar-menu">
            <summary className="closed-deals-toolbar-button closed-deals-toolbar-button--outline">
              Ações
              <FiChevronDown />
            </summary>
            <div className="closed-deals-toolbar-menu__panel closed-deals-toolbar-menu__panel--actions">
              <button
                type="button"
                className="closed-deals-toolbar-menu__item"
                onClick={() => void handleExportExcel()}
                disabled={loading || isRefreshing || isExportingPdf || isExportingExcel}
              >
                <FiDownload />
                {isExportingExcel ? "Gerando Excel..." : "Exportar Excel"}
              </button>

              <button
                type="button"
                className="closed-deals-toolbar-menu__item"
                onClick={() => void handleExportPdf()}
                disabled={loading || isRefreshing || isExportingPdf || isExportingExcel}
              >
                <FiDownload />
                {isExportingPdf ? "Gerando PDF..." : "Exportar PDF"}
              </button>
            </div>
          </details>

          {hasActiveFilters ? (
            <button
              type="button"
              className="closed-deals-toolbar-button closed-deals-toolbar-button--outline closed-deals-clear"
              onClick={clearFilters}
              disabled={loading || isRefreshing || isExportingPdf || isExportingExcel}
            >
              <FiFilter />
              Limpar filtros
            </button>
          ) : null}
        </div>
      </div>

      <div className="closed-deals-summary">
        <strong>Fechadas</strong>
        <span>{summaryLabel}</span>
        {isRefreshing ? <small>Atualizando...</small> : null}
      </div>

      <div className="closed-deals-table-wrap">
        <table className="closed-deals-table">
          <thead>
            <tr>
              <th>Fechamento</th>
              <th>Status</th>
              <th>Cliente</th>
              <th>Card</th>
              <th>Vendedor</th>
              <th>Valor</th>
              <th>Origem</th>
              <th>Pagamento</th>
              <th>Orcamento</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="closed-deals-table__empty">
                  Carregando fechamentos...
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((deal: Deal) => (
                <tr key={deal.id}>
                  <td>{formatDate(deal.saleDate || deal.closingDate || deal.createdAt)}</td>
                  <td>
                    <span
                      className={`closed-deals-status closed-deals-status--${
                        deal.stage === "closed-lost" ? "lost" : "won"
                      }`}
                    >
                      {getStageLabel(deal.stage)}
                    </span>
                  </td>
                  <td>{deal.contactName || deal.companyName || "-"}</td>
                  <td>{deal.title || "-"}</td>
                  <td>{deal.ownerName || "-"}</td>
                  <td>{formatCurrency(deal.amount)}</td>
                  <td>{formatSaleOriginLabel(deal.saleOrigin)}</td>
                  <td>{formatPaymentLabel(deal.paymentMethod, paymentOptions)}</td>
                  <td>
                    <button
                      type="button"
                      className="closed-deals-toggle"
                      onClick={() => setSelectedDeal(deal)}
                    >
                      <FiEye />
                      Ver
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="closed-deals-table__empty">
                  Nenhum fechamento encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="closed-deals-pagination">
        <button
          type="button"
          onClick={() => handlePageChange(1)}
          disabled={loading || currentPage <= 1}
        >
          Primeira
        </button>
        <button
          type="button"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={loading || currentPage <= 1}
        >
          <FiChevronLeft />
          Anterior
        </button>
        <div className="closed-deals-pagination__pages">
          {visiblePages.map((page, index) =>
            page === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="closed-deals-pagination__ellipsis">
                ...
              </span>
            ) : (
              <button
                key={page}
                type="button"
                className={`closed-deals-pagination__page${
                  page === currentPage ? " is-active" : ""
                }`}
                onClick={() => handlePageChange(page)}
                disabled={loading}
              >
                {page}
              </button>
            )
          )}
        </div>
        <span className="closed-deals-pagination__status">
          Pagina {currentPage} de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={loading || currentPage >= totalPages}
        >
          Proxima
          <FiChevronRight />
        </button>
        <button
          type="button"
          onClick={() => handlePageChange(totalPages)}
          disabled={loading || currentPage >= totalPages}
        >
          Ultima
        </button>
      </div>

      <Modal
        isOpen={Boolean(selectedDeal)}
        onClose={() => setSelectedDeal(null)}
        title={
          selectedDeal?.contactName ||
          selectedDeal?.companyName ||
          selectedDeal?.title ||
          "Orcamento"
        }
        size="lg"
      >
        {selectedDeal ? (
          <div className="closed-deals-modal">
            <div className="closed-deals-modal__meta">
              <span>
                <strong>Status:</strong> {getStageLabel(selectedDeal.stage)}
              </span>
              <span>
                <strong>Fechamento:</strong>{" "}
                {formatDate(
                  selectedDeal.saleDate || selectedDeal.closingDate || selectedDeal.createdAt
                )}
              </span>
              <span>
                <strong>Origem:</strong> {formatSaleOriginLabel(selectedDeal.saleOrigin)}
              </span>
              <span>
                <strong>Pagamento:</strong>{" "}
                {formatPaymentLabel(selectedDeal.paymentMethod, paymentOptions)}
              </span>
            </div>

            {canEditClosedDeals ? (
              <div className="closed-deals-modal__actions">
                <button
                  type="button"
                  className="closed-deals-action-button"
                  onClick={() => {
                    setEditingDeal(selectedDeal);
                    setSelectedDeal(null);
                  }}
                  disabled={isSavingDealEdit}
                >
                  <FiEdit2 />
                  Editar venda
                </button>
              </div>
            ) : null}

            <DealQuoteModalContent deal={selectedDeal} />
          </div>
        ) : null}
      </Modal>

      {editingDeal ? (
        <FinishServiceModal
          isOpen
          onClose={() => {
            if (isSavingDealEdit) return;
            setEditingDeal(null);
          }}
          deal={editingDeal}
          initialFinishType={null}
          paymentOptions={paymentOptions}
          lossReasonOptions={lossReasonOptions}
          productCatalog={productCatalog}
          onConfirmSale={(data) =>
            void handleSaveClosedDeal(editingDeal, data, "Venda atualizada")
          }
          onConfirmRefusal={(data) =>
            void handleSaveClosedDeal(editingDeal, data, "Perda atualizada")
          }
        />
      ) : null}

    </div>
  );
}
