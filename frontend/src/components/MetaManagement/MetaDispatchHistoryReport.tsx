import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  FiArrowDown,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiCornerUpLeft,
  FiDollarSign,
  FiDownload,
  FiEye,
  FiRefreshCw,
  FiSend,
  FiX,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  MetaService,
  type MetaCompanyUser,
  type MetaIntegrationAccount,
  type TemplateDispatchHistoryReportDetailResult,
  type TemplateDispatchHistoryReportResult,
  type TemplateDispatchHistoryReportRow,
} from "../../service/metaService";
import {
  formatDateTime,
  formatDispatchCurrency,
} from "./MetaApiManagement.helpers";
import {
  exportMetaDispatchHistoryDetail,
  exportMetaDispatchHistoryReport,
} from "../../utils/metaDispatchHistoryReportExport";
import "./MetaDispatchHistoryReport.css";

const PAGE_SIZE = 10;

function toDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return toDateInput(date);
}

function getDefaultEndDate() {
  return toDateInput(new Date());
}

function getStatusLabel(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  switch (normalized) {
    case "completed":
      return "Concluido";
    case "processing":
      return "Processando";
    case "stopped_on_error":
      return "Parado por erro";
    case "failed":
      return "Falhou";
    default:
      return normalized || "-";
  }
}

function formatDateInputLabel(value: string) {
  if (!value) return "--/--/----";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getPercent(value: number, total: number) {
  if (!total) return 0;
  return clampPercent((value / total) * 100);
}

function formatPercent(value: number) {
  return `${Math.round(clampPercent(value))}%`;
}

type MetaDispatchHistoryReportProps = {
  onInitialLoadChange?: (loading: boolean) => void;
};

type DispatchReportFilters = {
  startDate: string;
  endDate: string;
  dispatchType: "all" | "list" | "single";
  selectedStatus: "all" | "processing" | "completed" | "stopped_on_error" | "failed";
  selectedMetaParamId: string;
  selectedUsuarioFiltroId: string;
};

type DispatchTypeFilter = DispatchReportFilters["dispatchType"];
type DispatchStatusFilter = DispatchReportFilters["selectedStatus"];

function normalizeDispatchType(value?: string | null): Exclude<DispatchTypeFilter, "all"> | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (["list", "lista", "lote", "batch", "broadcast"].includes(normalized)) {
    return "list";
  }

  if (["single", "individual", "unitario", "unico"].includes(normalized)) {
    return "single";
  }

  return null;
}

function getRowDispatchType(
  row: TemplateDispatchHistoryReportRow,
): Exclude<DispatchTypeFilter, "all"> {
  const normalized = normalizeDispatchType(row.dispatch_type);
  if (normalized) return normalized;

  if (row.lista_transmissao_id || row.lista_nome || row.lista_descricao) {
    return "list";
  }

  return "single";
}

function getDispatchTypeLabel(value?: string | null) {
  return normalizeDispatchType(value) === "list" ? "Lista" : "Individual";
}

function getDefaultFilters(): DispatchReportFilters {
  return {
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
    dispatchType: "all",
    selectedStatus: "all",
    selectedMetaParamId: "",
    selectedUsuarioFiltroId: "",
  };
}

export function MetaDispatchHistoryReport({
  onInitialLoadChange,
}: MetaDispatchHistoryReportProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const defaultFilters = useMemo(() => getDefaultFilters(), []);
  const [startDate, setStartDate] = useState(defaultFilters.startDate);
  const [endDate, setEndDate] = useState(defaultFilters.endDate);
  const [dispatchType, setDispatchType] = useState<"all" | "list" | "single">("all");
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "processing" | "completed" | "stopped_on_error" | "failed"
  >("all");
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [selectedMetaParamId, setSelectedMetaParamId] = useState("");
  const [selectedUsuarioFiltroId, setSelectedUsuarioFiltroId] = useState("");
  const [appliedFilters, setAppliedFilters] =
    useState<DispatchReportFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFilterOptions, setIsLoadingFilterOptions] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isLoadingDetailId, setIsLoadingDetailId] = useState<number | string | null>(null);
  const [isExportingDetail, setIsExportingDetail] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailReport, setDetailReport] =
    useState<TemplateDispatchHistoryReportDetailResult | null>(null);
  const [metaNumberOptions, setMetaNumberOptions] = useState<MetaIntegrationAccount[]>([]);
  const [userOptions, setUserOptions] = useState<MetaCompanyUser[]>([]);
  const [report, setReport] = useState<TemplateDispatchHistoryReportResult>({
    items: [],
  });
  const latestReportRequestRef = useRef(0);
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  const loadFilterOptions = useCallback(async () => {
    if (!user?.empresa_id || !user?.id) return;

    setIsLoadingFilterOptions(true);
    try {
      const [numbers, users] = await Promise.all([
        MetaService.getIntegrationNumbers(user.empresa_id, user.id),
        MetaService.listCompanyUsers(user.empresa_id),
      ]);
      setMetaNumberOptions(Array.isArray(numbers) ? numbers : []);
      setUserOptions(Array.isArray(users) ? users : []);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar filtros",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os filtros do relatorio.",
      });
    } finally {
      setIsLoadingFilterOptions(false);
    }
  }, [addToast, user?.empresa_id, user?.id]);

  const loadReport = useCallback(async (pageNumber: number) => {
    if (!user?.empresa_id || !user?.id) return;

    const requestId = latestReportRequestRef.current + 1;
    latestReportRequestRef.current = requestId;
    setIsLoading(true);
    try {
      const result = await MetaService.getDispatchHistoryReport({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
        dispatchType: appliedFilters.dispatchType,
        status: appliedFilters.selectedStatus,
        metaParamId: appliedFilters.selectedMetaParamId || undefined,
        usuarioFiltroId: appliedFilters.selectedUsuarioFiltroId || undefined,
        limit: PAGE_SIZE,
        offset: pageNumber * PAGE_SIZE,
      });
      if (requestId !== latestReportRequestRef.current) return;
      setReport(result);
      setPage(pageNumber);
      setHasLoadedOnce(true);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar relatorio",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar o relatorio de envios.",
      });
    } finally {
      if (requestId === latestReportRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    addToast,
    appliedFilters,
    user?.empresa_id,
    user?.id,
  ]);

  useEffect(() => {
    void loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    void loadReport(0);
  }, [loadReport]);

  useEffect(() => {
    onInitialLoadChange?.(isLoading && !hasLoadedOnce);
  }, [hasLoadedOnce, isLoading, onInitialLoadChange]);

  const rows = useMemo(
    () => (Array.isArray(report.items) ? report.items : []),
    [report.items],
  );
  const dispatchTypeFilteredRows = useMemo(
    () =>
      appliedFilters.dispatchType === "all"
        ? rows
        : rows.filter((row) => getRowDispatchType(row) === appliedFilters.dispatchType),
    [appliedFilters.dispatchType, rows],
  );
  const templateOptions = useMemo(
    () =>
      Array.from(
        new Set(
          dispatchTypeFilteredRows
            .map((row) => String(row.template_name || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [dispatchTypeFilteredRows],
  );
  const visibleRows = useMemo(
    () =>
      selectedTemplateName
        ? dispatchTypeFilteredRows.filter((row) => row.template_name === selectedTemplateName)
        : dispatchTypeFilteredRows,
    [dispatchTypeFilteredRows, selectedTemplateName],
  );
  const hasBackendDispatchTypeMismatch =
    appliedFilters.dispatchType !== "all" && dispatchTypeFilteredRows.length !== rows.length;
  const totalRecords = hasBackendDispatchTypeMismatch
    ? visibleRows.length
    : Number(report.pagination?.total || 0);
  const hasPreviousPage = page > 0;
  const hasNextPage = hasBackendDispatchTypeMismatch
    ? false
    : Boolean(report.pagination?.has_more);
  const summaryRows = hasBackendDispatchTypeMismatch ? visibleRows : null;
  const totalSent = Number(
    summaryRows
      ? summaryRows.reduce(
          (total, row) => total + Number(row.enviados || row.total_clientes || 0),
          0,
        )
      : report.summary?.total_enviados ||
          report.summary?.total_clientes ||
          report.summary?.total_disparos ||
          0,
  );
  const totalDelivered = Number(
    summaryRows
      ? summaryRows.reduce((total, row) => total + Number(row.recebidos || 0), 0)
      : report.summary?.total_recebidos || 0,
  );
  const totalViewed = Number(
    summaryRows
      ? summaryRows.reduce((total, row) => total + Number(row.visualizados || 0), 0)
      : report.summary?.total_visualizados || 0,
  );
  const totalAnswered = Number(
    summaryRows
      ? summaryRows.reduce((total, row) => total + Number(row.respondidos || 0), 0)
      : report.summary?.total_respondidos || 0,
  );
  const totalCost = Number(
    summaryRows
      ? summaryRows.reduce((total, row) => total + Number(row.valor_total || 0), 0)
      : report.summary?.total_custo || 0,
  );
  const averageCost = totalSent ? totalCost / totalSent : 0;
  const deliveredPercent = getPercent(totalDelivered, totalSent);
  const viewedPercent = getPercent(totalViewed, totalDelivered);
  const answeredPercent = getPercent(totalAnswered, totalDelivered);
  const firstVisibleRecord = totalRecords ? page * PAGE_SIZE + 1 : 0;
  const lastVisibleRecord = totalRecords
    ? Math.min(page * PAGE_SIZE + visibleRows.length, totalRecords)
    : 0;
  const hasActiveFilters =
    startDate !== defaultFilters.startDate ||
    endDate !== defaultFilters.endDate ||
    dispatchType !== defaultFilters.dispatchType ||
    selectedStatus !== defaultFilters.selectedStatus ||
    selectedMetaParamId !== defaultFilters.selectedMetaParamId ||
    selectedUsuarioFiltroId !== defaultFilters.selectedUsuarioFiltroId ||
    Boolean(selectedTemplateName);

  const handleRefresh = useCallback(() => {
    void loadReport(page);
  }, [loadReport, page]);

  const handleClearFilters = useCallback(() => {
    setStartDate(defaultFilters.startDate);
    setEndDate(defaultFilters.endDate);
    setDispatchType(defaultFilters.dispatchType);
    setSelectedStatus(defaultFilters.selectedStatus);
    setSelectedMetaParamId(defaultFilters.selectedMetaParamId);
    setSelectedUsuarioFiltroId(defaultFilters.selectedUsuarioFiltroId);
    setSelectedTemplateName("");
    setAppliedFilters(defaultFilters);
  }, [defaultFilters]);

  const applyPeriodFilter = useCallback(
    (nextStartDate: string, nextEndDate: string) => {
      if (nextStartDate && nextEndDate && nextStartDate > nextEndDate) {
        return;
      }

      setSelectedTemplateName("");
      setAppliedFilters((current) => ({
        ...current,
        startDate: nextStartDate,
        endDate: nextEndDate,
      }));
    },
    [],
  );

  const handleStartDateChange = useCallback(
    (value: string) => {
      setStartDate(value);
      applyPeriodFilter(value, endDate);
    },
    [applyPeriodFilter, endDate],
  );

  const handleEndDateChange = useCallback(
    (value: string) => {
      setEndDate(value);
      applyPeriodFilter(startDate, value);
    },
    [applyPeriodFilter, startDate],
  );

  const updateAppliedFilter = useCallback(
    (changes: Partial<DispatchReportFilters>) => {
      setSelectedTemplateName("");
      setAppliedFilters((current) => ({
        ...current,
        ...changes,
      }));
    },
    [],
  );

  const handleStatusChange = useCallback(
    (value: DispatchStatusFilter) => {
      setSelectedStatus(value);
      updateAppliedFilter({ selectedStatus: value });
    },
    [updateAppliedFilter],
  );

  const handleDispatchTypeChange = useCallback(
    (value: DispatchTypeFilter) => {
      setDispatchType(value);
      updateAppliedFilter({ dispatchType: value });
    },
    [updateAppliedFilter],
  );

  const handleMetaParamChange = useCallback(
    (value: string) => {
      setSelectedMetaParamId(value);
      updateAppliedFilter({ selectedMetaParamId: value });
    },
    [updateAppliedFilter],
  );

  const handleUsuarioFiltroChange = useCallback(
    (value: string) => {
      setSelectedUsuarioFiltroId(value);
      updateAppliedFilter({ selectedUsuarioFiltroId: value });
    },
    [updateAppliedFilter],
  );

  const openDatePicker = useCallback((target: "start" | "end") => {
    const input =
      target === "start" ? startDateInputRef.current : endDateInputRef.current;
    if (!input) return;

    input.focus();
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }

    input.click();
  }, []);

  const handlePeriodControlKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, target: "start" | "end") => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDatePicker(target);
      }
    },
    [openDatePicker],
  );

  const handleExportLoadedReport = useCallback(() => {
    exportMetaDispatchHistoryReport({ report });
  }, [report]);

  const handleOpenDispatchDetail = useCallback(async (row: TemplateDispatchHistoryReportRow) => {
    if (!user?.empresa_id || !user?.id || !row.dispatch_history_id) return;

    setIsLoadingDetailId(row.dispatch_history_id);
    setDetailModalOpen(true);
    setDetailReport(null);
    try {
      const detail: TemplateDispatchHistoryReportDetailResult =
        await MetaService.getDispatchHistoryReportDetail({
          empresaId: user.empresa_id,
          usuarioId: user.id,
          dispatchHistoryId: row.dispatch_history_id,
        });
      setDetailReport(detail);
    } catch (error) {
      setDetailModalOpen(false);
      addToast({
        type: "error",
        title: "Erro ao carregar detalhe",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os detalhes deste disparo.",
      });
    } finally {
      setIsLoadingDetailId(null);
    }
  }, [addToast, user?.empresa_id, user?.id]);

  const handleCloseDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setDetailReport(null);
    setIsExportingDetail(false);
  }, []);

  const handleExportCurrentDetail = useCallback(() => {
    if (!detailReport) return;

    setIsExportingDetail(true);
    try {
      exportMetaDispatchHistoryDetail({ report: detailReport });
    } finally {
      setIsExportingDetail(false);
    }
  }, [detailReport]);

  const detailDispatch = detailReport?.dispatch || null;
  const detailItems = Array.isArray(detailReport?.items) ? detailReport.items : [];

  return (
    <section className="meta-dispatch-report">
      <header className="meta-dispatch-report__header">
        <div>
          <h2>Relatorio de envios</h2>
          <p>
            Acompanhe o desempenho dos seus disparos via WhatsApp (API Meta).
          </p>
        </div>

        <div className="meta-dispatch-report__header-actions">
          <button
            type="button"
            className="meta-dispatch-report__button meta-dispatch-report__button--secondary"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <FiRefreshCw aria-hidden="true" />
            Atualizar
          </button>
          <button
            type="button"
            className="meta-dispatch-report__button meta-dispatch-report__button--primary"
            onClick={handleExportLoadedReport}
            disabled={!rows.length}
          >
            <FiDownload aria-hidden="true" />
            Exportar relatorio
          </button>
        </div>
      </header>

      <div className="meta-dispatch-report__filters">
        <label className="meta-dispatch-report__field meta-dispatch-report__field--period">
          <span>Periodo</span>
          <div
            className="meta-dispatch-report__period-control"
          >
            <input
              ref={startDateInputRef}
              type="date"
              value={startDate}
              aria-label="Data inicial"
              tabIndex={-1}
              onChange={(event) => handleStartDateChange(event.target.value)}
            />
            <span
              className="meta-dispatch-report__period-date"
              role="button"
              tabIndex={0}
              aria-label="Alterar data inicial"
              onClick={() => openDatePicker("start")}
              onKeyDown={(event) => handlePeriodControlKeyDown(event, "start")}
            >
              <strong>{formatDateInputLabel(startDate)}</strong>
            </span>
            <span aria-hidden="true">&rarr;</span>
            <span
              className="meta-dispatch-report__period-date"
              role="button"
              tabIndex={0}
              aria-label="Alterar data final"
              onClick={() => openDatePicker("end")}
              onKeyDown={(event) => handlePeriodControlKeyDown(event, "end")}
            >
              <strong>{formatDateInputLabel(endDate)}</strong>
            </span>
            <input
              ref={endDateInputRef}
              type="date"
              value={endDate}
              aria-label="Data final"
              tabIndex={-1}
              onChange={(event) => handleEndDateChange(event.target.value)}
            />
            <FiCalendar aria-hidden="true" />
          </div>
        </label>
        <label className="meta-dispatch-report__field">
          <span>Status</span>
          <select
            value={selectedStatus}
            onChange={(event) =>
              handleStatusChange(
                event.target.value as
                  DispatchStatusFilter,
              )
            }
          >
            <option value="all">Todos</option>
            <option value="processing">Processando</option>
            <option value="completed">Concluido</option>
            <option value="stopped_on_error">Parado por erro</option>
            <option value="failed">Falhou</option>
          </select>
        </label>
        <label className="meta-dispatch-report__field">
          <span>Template</span>
          <select
            value={selectedTemplateName}
            onChange={(event) => setSelectedTemplateName(event.target.value)}
            disabled={!templateOptions.length}
          >
            <option value="">Todos</option>
            {templateOptions.map((templateName) => (
              <option key={templateName} value={templateName}>
                {templateName}
              </option>
            ))}
          </select>
        </label>
        <label className="meta-dispatch-report__field">
          <span>Tipo</span>
          <select
            value={dispatchType}
            onChange={(event) =>
              handleDispatchTypeChange(event.target.value as DispatchTypeFilter)
            }
          >
            <option value="all">Todos</option>
            <option value="list">Listas</option>
            <option value="single">Individuais</option>
          </select>
        </label>
        <label className="meta-dispatch-report__field">
          <span>Numero Meta</span>
          <select
            value={selectedMetaParamId}
            onChange={(event) => handleMetaParamChange(event.target.value)}
            disabled={isLoadingFilterOptions}
          >
            <option value="">Todos</option>
            {metaNumberOptions.map((option, index) => (
              <option key={String(option.id || option.phone_number_id || index)} value={String(option.id || "")}>
                {option.display_phone_number || option.verified_name || `Numero ${option.id || index + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label className="meta-dispatch-report__field">
          <span>Disparado por</span>
          <select
            value={selectedUsuarioFiltroId}
            onChange={(event) => handleUsuarioFiltroChange(event.target.value)}
            disabled={isLoadingFilterOptions}
          >
            <option value="">Todos</option>
            {userOptions.map((option, index) => (
              <option key={String(option.id || index)} value={String(option.id || "")}>
                {option.name || `Usuario ${option.id || index + 1}`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`meta-dispatch-report__button meta-dispatch-report__button--clear${
            hasActiveFilters ? " meta-dispatch-report__button--clear-active" : ""
          }`}
          onClick={handleClearFilters}
          disabled={isLoading || !hasActiveFilters}
        >
          <FiX aria-hidden="true" />
          Limpar filtros
        </button>
      </div>

      <div className="meta-dispatch-report__summary">
        <article className="meta-dispatch-report__summary-card meta-dispatch-report__summary-card--send">
          <span className="meta-dispatch-report__summary-icon">
            <FiSend aria-hidden="true" />
          </span>
          <div>
            <span>Disparos</span>
            <strong>{totalSent}</strong>
            <small>Total enviados</small>
          </div>
        </article>
        <article className="meta-dispatch-report__summary-card meta-dispatch-report__summary-card--delivered">
          <span className="meta-dispatch-report__summary-icon">
            <FiCheckCircle aria-hidden="true" />
          </span>
          <div>
            <span>Entregues</span>
            <strong>{totalDelivered}</strong>
            <small>{formatPercent(deliveredPercent)} do total</small>
          </div>
        </article>
        <article className="meta-dispatch-report__summary-card meta-dispatch-report__summary-card--viewed">
          <span className="meta-dispatch-report__summary-icon">
            <FiEye aria-hidden="true" />
          </span>
          <div>
            <span>Visualizados</span>
            <strong>{totalViewed}</strong>
            <small>{formatPercent(viewedPercent)} dos entregues</small>
          </div>
        </article>
        <article className="meta-dispatch-report__summary-card meta-dispatch-report__summary-card--answered">
          <span className="meta-dispatch-report__summary-icon">
            <FiCornerUpLeft aria-hidden="true" />
          </span>
          <div>
            <span>Respondidos</span>
            <strong>{totalAnswered}</strong>
            <small>{formatPercent(answeredPercent)} dos entregues</small>
          </div>
        </article>
        <article className="meta-dispatch-report__summary-card meta-dispatch-report__summary-card--cost">
          <span className="meta-dispatch-report__summary-icon">
            <FiDollarSign aria-hidden="true" />
          </span>
          <div>
            <span>Custo total</span>
            <strong>{formatDispatchCurrency(totalCost, "USD")}</strong>
            <small>Custo medio: {formatDispatchCurrency(averageCost, "USD")}</small>
          </div>
        </article>
      </div>

      <div className="meta-dispatch-report__table-shell">
        <div className="meta-dispatch-report__table-wrap">
          <table className="meta-dispatch-report__table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Entregues (%)</th>
                <th>Respondidos (%)</th>
                <th>Visualizados (%)</th>
                <th>Custo</th>
                <th>Número Meta</th>
                <th>Disparado por</th>
                <th>Status</th>
                <th>
                  <span className="meta-dispatch-report__sortable-heading">
                    Data / Hora <FiArrowDown aria-hidden="true" />
                  </span>
                </th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? (
                visibleRows.map((row, index) => {
                  const sentCount = Number(row.enviados || row.total_clientes || 0);
                  const deliveredCount = Number(row.recebidos || 0);
                  const answeredCount = Number(row.respondidos || 0);
                  const viewedCount = Number(row.visualizados || 0);
                  const deliveredRowPercent = getPercent(deliveredCount, sentCount);
                  const answeredRowPercent = getPercent(answeredCount, deliveredCount || sentCount);
                  const viewedRowPercent = getPercent(viewedCount, deliveredCount || sentCount);
                  const statusClass = String(row.status || "unknown")
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9_-]+/g, "-");

                  return (
                    <tr
                      key={String(
                        row.dispatch_history_id ||
                          `${row.template_id || "dispatch"}-${index}`,
                      )}
                    >
                      <td>
                        <div className="meta-dispatch-report__cell-main">
                          <strong>{row.template_name || "-"}</strong>
                          <span>{getDispatchTypeLabel(getRowDispatchType(row))}</span>
                        </div>
                      </td>
                      <td>
                        <MetricCell value={deliveredCount} percent={deliveredRowPercent} />
                      </td>
                      <td>
                        <MetricCell value={answeredCount} percent={answeredRowPercent} />
                      </td>
                      <td>
                        <MetricCell value={viewedCount} percent={viewedRowPercent} />
                      </td>
                      <td>
                        {formatDispatchCurrency(
                          Number(row.valor_total || 0),
                          row.moeda || "USD",
                        )}
                      </td>
                      <td>
                        <div className="meta-dispatch-report__cell-main meta-dispatch-report__cell-main--compact">
                          <strong>{row.meta_numero_conta || "-"}</strong>
                          <span>{row.meta_nome_conta || "Conta Meta"}</span>
                        </div>
                      </td>
                      <td>{row.usuario_nome || "Sistema"}</td>
                      <td>
                        <span className={`meta-dispatch-report__status meta-dispatch-report__status--${statusClass}`}>
                          {getStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>{formatDateTime(row.data_inicio)}</td>
                      <td>
                        <button
                          type="button"
                          className="meta-dispatch-report__export-button"
                          onClick={() => void handleOpenDispatchDetail(row)}
                          disabled={
                            !row.dispatch_history_id ||
                            isLoadingDetailId === row.dispatch_history_id
                          }
                        >
                          {isLoadingDetailId === row.dispatch_history_id
                            ? "Carregando"
                            : "Detalhe"}
                          <FiChevronRight aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10}>
                    <div className="meta-dispatch-report__empty">
                      {isLoading
                        ? "Atualizando..."
                        : "Nenhum disparo encontrado para os filtros selecionados."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="meta-dispatch-report__pagination">
          <span>
            {isLoading
              ? "Atualizando dados..."
              : `Mostrando ${firstVisibleRecord} a ${lastVisibleRecord} de ${totalRecords} registros`}
          </span>
          <div className="meta-dispatch-report__page-controls">
            <button type="button" onClick={() => void loadReport(page - 1)} disabled={!hasPreviousPage || isLoading} aria-label="Pagina anterior">
              <FiChevronLeft aria-hidden="true" />
            </button>
            <strong>{page + 1}</strong>
            <button type="button" onClick={() => void loadReport(page + 1)} disabled={!hasNextPage || isLoading} aria-label="Proxima pagina">
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>
          <label className="meta-dispatch-report__page-size">
            <span>Itens por pagina</span>
            <select value={PAGE_SIZE} disabled>
              <option value={PAGE_SIZE}>{PAGE_SIZE}</option>
            </select>
          </label>
        </div>
      </div>

      {detailModalOpen ? (
        <div
          className="meta-dispatch-report__modal-backdrop"
          role="presentation"
          onClick={handleCloseDetailModal}
        >
          <section
            className="meta-dispatch-report__modal"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do disparo"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="meta-dispatch-report__modal-header">
              <div>
                <h3>Detalhes do disparo</h3>
                <p>
                  {detailDispatch
                    ? `${detailDispatch.template_name || "Template"} - ${getDispatchTypeLabel(getRowDispatchType(detailDispatch))}`
                    : "Carregando informações do disparo..."}
                </p>
              </div>

              <div className="meta-dispatch-report__modal-actions">
                <button
                  type="button"
                  onClick={handleExportCurrentDetail}
                  disabled={!detailReport || isExportingDetail}
                >
                  <FiDownload aria-hidden="true" />
                  {isExportingDetail ? "Exportando" : "Exportar detalhe"}
                </button>
                <button type="button" onClick={handleCloseDetailModal} aria-label="Fechar modal">
                  <FiX aria-hidden="true" />
                </button>
              </div>
            </header>

            {detailReport ? (
              <>
                <div className="meta-dispatch-report__modal-summary">
                  <article>
                    <strong>{detailDispatch?.usuario_nome || "Sistema"}</strong>
                    <span>Disparado por</span>
                  </article>
                  <article>
                    <strong>{detailDispatch?.meta_numero_conta || "-"}</strong>
                    <span>Numero Meta</span>
                  </article>
                  <article>
                    <strong>{Number(detailDispatch?.enviados || 0)}</strong>
                    <span>Enviados</span>
                  </article>
                  <article>
                    <strong>{Number(detailDispatch?.recebidos || 0)}</strong>
                    <span>Recebidos</span>
                  </article>
                  <article>
                    <strong>{Number(detailDispatch?.recebidos_unicos || 0)}</strong>
                    <span>Recebidos unicos</span>
                  </article>
                  <article>
                    <strong>{Number(detailDispatch?.visualizados || 0)}</strong>
                    <span>Visualizados</span>
                  </article>
                  <article>
                    <strong>{Number(detailDispatch?.respondidos || 0)}</strong>
                    <span>Respondidos</span>
                  </article>
                  <article>
                    <strong>{Number(detailDispatch?.respondidos_unicos || 0)}</strong>
                    <span>Respondidos unicos</span>
                  </article>
                </div>

                <div className="meta-dispatch-report__modal-meta">
                  <span>Inicio: {formatDateTime(detailDispatch?.data_inicio)}</span>
                  <span>Fim: {formatDateTime(detailDispatch?.data_fim)}</span>
                  <span>
                    Custo: {formatDispatchCurrency(
                      Number(detailDispatch?.valor_total || 0),
                      detailDispatch?.moeda || "USD",
                    )}
                  </span>
                  <span>Status: {getStatusLabel(detailDispatch?.status)}</span>
                </div>

                <div className="meta-dispatch-report__modal-table-wrap">
                  <table className="meta-dispatch-report__table meta-dispatch-report__table--detail">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Telefone</th>
                        <th>Status</th>
                        <th>Enviado</th>
                        <th>Recebido</th>
                        <th>Visualizado</th>
                        <th>Respondeu</th>
                        <th>Respondido em</th>
                        <th>Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailItems.length ? (
                        detailItems.map((item, index) => (
                          <tr key={String(item.item_id || `${item.message_id || "item"}-${index}`)}>
                            <td>{item.contato_nome || "-"}</td>
                            <td>{item.numero_normalizado || item.numero_original || "-"}</td>
                            <td>{item.message_status || (item.sucesso ? "sent" : "failed")}</td>
                            <td>{formatDateTime(item.enviado_em)}</td>
                            <td>{item.recebido ? "Sim" : "Nao"}</td>
                            <td>{item.visualizado ? "Sim" : "Nao"}</td>
                            <td>{item.respondeu ? "Sim" : "Nao"}</td>
                            <td>{formatDateTime(item.respondido_em)}</td>
                            <td>{item.erro_mensagem || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9}>
                            <div className="meta-dispatch-report__empty">
                              Nenhum envio encontrado para este disparo.
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="meta-dispatch-report__modal-loading">
                Carregando informações do disparo...
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function MetricCell({ value, percent }: { value: number; percent: number }) {
  const safePercent = clampPercent(percent);

  return (
    <div className="meta-dispatch-report__metric-cell">
      <div>
        <strong>{value}</strong>
        <span>{formatPercent(safePercent)}</span>
      </div>
      <span className="meta-dispatch-report__metric-bar" aria-hidden="true">
        <span style={{ width: `${safePercent}%` }} />
      </span>
    </div>
  );
}
