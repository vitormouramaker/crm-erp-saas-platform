import { useEffect, useMemo, useRef, useState } from "react";
import { FiCalendar, FiChevronDown, FiDownload, FiFilter, FiMinus, FiPlus, FiSearch } from "react-icons/fi";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  createCommercialDeal,
  getCommercialDeals,
  getCommercialDealsPage,
  getCommercialDomains,
  subscribeToCommercialDataChanged,
  type CommercialDomains,
  type CommercialStage,
  type Deal,
} from "../../../service/commercialService";
import { exportCrmWorkbook } from "../../../utils/crmExport";
import { KanbanBoard } from "./KanbanBoard";
import NewAtendimentoModal from "./NewAtendimentoModal";
import ScheduleCalendarModal from "./ScheduleCalendarModal";
import { PeriodRangePicker, type PeriodRangeValue } from "../../common/PeriodRangePicker/PeriodRangePicker";
import "./PipelinePage.css";

type CommercialPipelineProps = {
  crmId?: number | null;
};

type PipelineFilters = {
  search: string;
  owner: string;
  tag: string;
  dateStart: string;
  dateEnd: string;
};

type StagePageState = {
  items: Deal[];
  total: number;
  totalValue: number;
  loadedCount: number;
  loadingMore: boolean;
};

type StagePaginationMeta = {
  totalDealsCount: number;
  totalValue: number;
  hasMore: boolean;
  loadingMore: boolean;
};

const EMPTY_FILTERS: PipelineFilters = {
  search: "",
  owner: "",
  tag: "",
  dateStart: "",
  dateEnd: "",
};

const STAGE_PAGE_SIZE = 20;
const PIPELINE_ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5] as const;

function formatPipelineDate(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

function buildStagePageState(
  items: Deal[],
  total: number,
  totalValue: number | undefined,
  loadedCount: number,
  loadingMore = false
): StagePageState {
  return {
    items,
    total,
    totalValue:
      totalValue === null || totalValue === undefined
        ? items.reduce((sum, deal) => sum + Number(deal.amount || 0), 0)
        : Number(totalValue || 0),
    loadedCount,
    loadingMore,
  };
}

function formatZoomLevel(value: number) {
  return `${value.toFixed(2).replace(/\.00$/, ".0").replace(/(\.\d)0$/, "$1")}x`;
}

export function CommercialPipeline({ crmId }: CommercialPipelineProps) {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();
  const [stagePages, setStagePages] = useState<Record<string, StagePageState>>({});
  const [domains, setDomains] = useState<CommercialDomains | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNewDealModalOpen, setIsNewDealModalOpen] = useState(false);
  const [isScheduleCalendarOpen, setIsScheduleCalendarOpen] = useState(false);
  const [isPeriodFilterOpen, setIsPeriodFilterOpen] = useState(false);
  const [isExportingCrm, setIsExportingCrm] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<(typeof PIPELINE_ZOOM_LEVELS)[number]>(1);
  const [isZoomControlOpen, setIsZoomControlOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<PipelineFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<PipelineFilters>(EMPTY_FILTERS);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const hasLoadedRef = useRef(false);
  const periodFilterRef = useRef<HTMLDivElement | null>(null);
  const stagePagesRef = useRef<Record<string, StagePageState>>({});

  useEffect(() => {
    stagePagesRef.current = stagePages;
  }, [stagePages]);

  const sortedStages = useMemo(
    () =>
      ((domains?.etapas || []).slice() as CommercialStage[]).sort(
        (a, b) => a.ordem - b.ordem
      ),
    [domains?.etapas]
  );

  const filteredDeals = useMemo(
    () => (Object.values(stagePages) as StagePageState[]).flatMap((stagePage) => stagePage.items),
    [stagePages]
  );

  const zoomIndex = useMemo(
    () => PIPELINE_ZOOM_LEVELS.findIndex((item) => item === zoomLevel),
    [zoomLevel]
  );

  const canZoomOut = zoomIndex > 0;
  const canZoomIn = zoomIndex < PIPELINE_ZOOM_LEVELS.length - 1;

  const stagePaginationMeta = useMemo(
    () =>
      (Object.entries(stagePages) as Array<[string, StagePageState]>).reduce<
        Record<string, StagePaginationMeta>
      >((acc, [stageId, state]) => {
        acc[stageId] = {
          totalDealsCount: Number(state.total || 0),
          totalValue: Number(state.totalValue || 0),
          hasMore: state.items.length < state.total,
          loadingMore: state.loadingMore === true,
        };
        return acc;
      }, {}),
    [stagePages]
  );

  const fetchStageDeals = async (
    resolvedCrmId: number,
    stageId: string,
    filters: PipelineFilters,
    limit: number
  ) =>
    getCommercialDealsPage({
      crmId: resolvedCrmId,
      stage: stageId,
      search: filters.search || undefined,
      ownerId: filters.owner || undefined,
      dateStart: filters.dateStart || undefined,
      dateEnd: filters.dateEnd || undefined,
      tag: filters.tag || undefined,
      page: 1,
      limit,
      paginated: true,
    });

  const loadPipeline = async (
    filters: PipelineFilters = appliedFilters,
    options: { preserveLoadedCounts?: boolean; forceReloadDomains?: boolean } = {}
  ) => {
    if (!crmId) {
      setStagePages({});
      setDomains(null);
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    const { preserveLoadedCounts = false, forceReloadDomains = false } = options;
    const currentStagePages = stagePagesRef.current;
    const isInitialLoad = !domains && Object.keys(currentStagePages).length === 0;

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      let nextDomains = forceReloadDomains ? null : domains;
      if (!nextDomains || Number(nextDomains.crm_id) !== Number(crmId || nextDomains.crm_id)) {
        nextDomains = await getCommercialDomains(crmId);
        setDomains(nextDomains);
      }
      if (!nextDomains) throw new Error("Funil nao encontrado.");

      const nextStagePagesEntries = await Promise.all(
        nextDomains.etapas.map(async (stage) => {
          const previousLoadedCount = currentStagePages[stage.codigo]?.loadedCount || STAGE_PAGE_SIZE;
          const requestedLimit = preserveLoadedCounts
            ? Math.max(previousLoadedCount, STAGE_PAGE_SIZE)
            : STAGE_PAGE_SIZE;
          const result = await fetchStageDeals(nextDomains.crm_id, stage.codigo, filters, requestedLimit);
          return [
            stage.codigo,
            buildStagePageState(
              result.items,
              result.total,
              result.total_valor,
              requestedLimit
            ),
          ] as const;
        })
      );

      setStagePages(Object.fromEntries(nextStagePagesEntries));
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description: error instanceof Error ? error.message : "Nao foi possivel carregar o pipeline.",
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadMoreStage = async (stageId: string) => {
    if (!domains?.crm_id) return;

    const currentState = stagePagesRef.current[stageId];
    if (!currentState || currentState.loadingMore || currentState.items.length >= currentState.total) {
      return;
    }

    const nextLoadedCount = currentState.loadedCount + STAGE_PAGE_SIZE;

    setStagePages((prev) => ({
      ...prev,
      [stageId]: {
        ...prev[stageId],
        loadingMore: true,
      },
    }));

    try {
      const result = await fetchStageDeals(domains.crm_id, stageId, appliedFilters, nextLoadedCount);
      setStagePages((prev) => ({
        ...prev,
        [stageId]: buildStagePageState(
          result.items,
          result.total,
          result.total_valor,
          nextLoadedCount
        ),
      }));
    } catch (error) {
      setStagePages((prev) => ({
        ...prev,
        [stageId]: {
          ...prev[stageId],
          loadingMore: false,
        },
      }));
      addToast({
        type: "error",
        title: "Erro",
        description: error instanceof Error ? error.message : "Nao foi possivel carregar mais cards.",
      });
    }
  };

  useEffect(() => {
    setDomains(null);
    setStagePages({});
    setAppliedFilters(EMPTY_FILTERS);
    setDraftFilters(EMPTY_FILTERS);
    setIsPeriodFilterOpen(false);
    setIsFiltersOpen(false);
    hasLoadedRef.current = false;
    void loadPipeline(EMPTY_FILTERS, { forceReloadDomains: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crmId]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      return;
    }
    if (!crmId) return;

    const timeoutId = window.setTimeout(() => {
      void loadPipeline(appliedFilters);
    }, appliedFilters.search ? 300 : 0);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

  useEffect(() => {
    setAppliedFilters((current) => {
      if (
        current.search === draftFilters.search &&
        current.owner === draftFilters.owner &&
        current.tag === draftFilters.tag
      ) {
        return current;
      }

      return {
        ...current,
        search: draftFilters.search,
        owner: draftFilters.owner,
        tag: draftFilters.tag,
      };
    });
  }, [draftFilters.owner, draftFilters.search, draftFilters.tag]);

  useEffect(
    () =>
      subscribeToCommercialDataChanged(() => {
        void loadPipeline(appliedFilters, { preserveLoadedCounts: true });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [crmId, appliedFilters]
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
  const stageLabels = useMemo(
    () =>
      (domains?.etapas || []).reduce<Record<string, string>>((acc, stage) => {
        if (stage.codigo) {
          acc[stage.codigo] = stage.nome || stage.codigo;
        }
        return acc;
      }, {}),
    [domains?.etapas]
  );
  const appliedOwnerLabel = useMemo(() => {
    if (!appliedFilters.owner) return "";
    const owner = ownerOptions.find((item) => String(item.id) === String(appliedFilters.owner));
    return owner?.nome || appliedFilters.owner;
  }, [appliedFilters.owner, ownerOptions]);

  const tagOptions = useMemo(
    () => (domains?.tags || []).map((tag) => tag.nome).filter(Boolean),
    [domains]
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.search) count += 1;
    if (appliedFilters.owner) count += 1;
    if (appliedFilters.tag) count += 1;
    if (appliedFilters.dateStart || appliedFilters.dateEnd) count += 1;
    return count;
  }, [appliedFilters]);

  const periodFilterLabel = useMemo(() => {
    const start = appliedFilters.dateStart;
    const end = appliedFilters.dateEnd;

    if (start && end) return `${formatPipelineDate(start)} ate ${formatPipelineDate(end)}`;
    if (start) return `A partir de ${formatPipelineDate(start)}`;
    if (end) return `Ate ${formatPipelineDate(end)}`;
    return "Definir periodo";
  }, [appliedFilters.dateEnd, appliedFilters.dateStart]);

  const hasDraftFilters =
    Boolean(draftFilters.search) ||
    Boolean(draftFilters.owner) ||
    Boolean(draftFilters.tag) ||
    Boolean(draftFilters.dateStart) ||
    Boolean(draftFilters.dateEnd);

  const clearFilters = () => {
    if (!crmId) return;
    const hadAppliedFilters = Boolean(
      appliedFilters.search ||
        appliedFilters.owner ||
        appliedFilters.tag ||
        appliedFilters.dateStart ||
        appliedFilters.dateEnd
    );
    setDraftFilters(EMPTY_FILTERS);
    if (hadAppliedFilters) {
      setAppliedFilters(EMPTY_FILTERS);
    }
    setIsPeriodFilterOpen(false);
    setIsFiltersOpen(false);
  };

  const openPeriodFilterModal = () => {
    setIsPeriodFilterOpen((current) => !current);
  };

  const applyPeriodFilter = (nextPeriod: PeriodRangeValue) => {
    setDraftFilters((current) => ({
      ...current,
      dateStart: nextPeriod.dateStart,
      dateEnd: nextPeriod.dateEnd,
    }));
    setAppliedFilters((current) => ({
      ...current,
      dateStart: nextPeriod.dateStart,
      dateEnd: nextPeriod.dateEnd,
    }));
    setIsPeriodFilterOpen(false);
  };

  const handleExportCrm = async () => {
    if (!crmId || !domains) {
      return;
    }

    setIsExportingCrm(true);
    try {
      const exportDeals = await getCommercialDeals({
        crmId: domains.crm_id,
        search: appliedFilters.search || undefined,
        ownerId: appliedFilters.owner || undefined,
        dateStart: appliedFilters.dateStart || undefined,
        dateEnd: appliedFilters.dateEnd || undefined,
        tag: appliedFilters.tag || undefined,
      });

      if (!exportDeals.length) {
        addToast({
          type: "warning",
          title: "Nada para exportar",
          description: "Nao existem negocios no funil com os filtros atuais.",
        });
        return;
      }

      exportCrmWorkbook({
        crmName: `Funil ${domains.crm_id}`,
        deals: exportDeals,
        filters: {
          search: appliedFilters.search,
          ownerLabel: appliedOwnerLabel,
          tag: appliedFilters.tag,
          dateStart: appliedFilters.dateStart,
          dateEnd: appliedFilters.dateEnd,
        },
        stageLabels,
      });

      addToast({
        type: "success",
        title: "Exportacao concluida",
        description: `${exportDeals.length} negocio(s) exportados para Excel.`,
      });
    } catch (error) {
      console.error("Erro ao exportar Funil:", error);
      addToast({
        type: "error",
        title: "Falha na exportacao",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel exportar o funil neste momento.",
      });
    } finally {
      setIsExportingCrm(false);
    }
  };

  if (!crmId) {
    return (
      <div className="pipeline-page">
        <div className="pipeline-empty-state">
          Nenhum pipeline disponivel para o seu usuario no momento.
        </div>
      </div>
    );
  }

  return (
    <div className="pipeline-page">
      <div className="pipeline-header-controls">
        <div className="pipeline-filters-area">
          <div className="pipeline-filters-toggle-wrapper">
            <button
              type="button"
              className={`pipeline-filters-toggle ${isFiltersOpen ? "open" : ""}`}
              onClick={() => setIsFiltersOpen((prev) => !prev)}
              aria-label={isFiltersOpen ? "Fechar filtros" : "Abrir filtros"}
              title={isFiltersOpen ? "Fechar filtros" : "Abrir filtros"}
            >
              <FiFilter aria-hidden="true" />
              {activeFiltersCount > 0 && <span className="pipeline-filters-badge">{activeFiltersCount}</span>}
            </button>
          </div>

          <div className={`pipeline-filters-group ${isFiltersOpen ? "open" : ""}`}>
            <div className="pipeline-search-wrapper">
              <FiSearch className="pipeline-search-icon" />
              <input
                type="text"
                placeholder="Pesquisar..."
                className="filter-input search-global-compact"
                value={draftFilters.search}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, search: e.target.value }))}
              />
            </div>

            <select
              className="filter-select compact"
              value={draftFilters.owner}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, owner: e.target.value }))}
            >
              <option value="">Vendedores</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={String(owner.id)}>
                  {owner.nome}
                </option>
              ))}
            </select>

            <select
              className="filter-select compact pipeline-tag-filter-select"
              value={draftFilters.tag}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, tag: e.target.value }))}
            >
              <option value="">Tags</option>
              {tagOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>

            <div
              className={`pipeline-period-menu-wrapper ${isPeriodFilterOpen ? "open" : ""}`}
              ref={periodFilterRef}
            >
              <button
                type="button"
                className={`pipeline-date-filter-trigger ${
                  appliedFilters.dateStart || appliedFilters.dateEnd ? "is-active" : ""
                }`}
                onClick={openPeriodFilterModal}
                aria-haspopup="dialog"
                aria-expanded={isPeriodFilterOpen}
              >
                <FiCalendar />
                <span>{periodFilterLabel}</span>
              </button>

              {isPeriodFilterOpen ? (
                <div className="pipeline-period-dropdown">
                  <PeriodRangePicker
                    value={{
                      dateStart: appliedFilters.dateStart,
                      dateEnd: appliedFilters.dateEnd,
                    }}
                    onApply={applyPeriodFilter}
                    onCancel={() => setIsPeriodFilterOpen(false)}
                  />
                </div>
              ) : null}
            </div>

            <div className="pipeline-filters-actions">
              {(activeFiltersCount > 0 || hasDraftFilters) && (
                <button
                  className="pipeline-toolbar-button pipeline-toolbar-button--outline pipeline-clear-filters-button"
                  onClick={clearFilters}
                  disabled={loading || isRefreshing}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {isRefreshing && (
            <span className="pipeline-refresh-status">
              Atualizando...
            </span>
          )}
        </div>

        <div className="pipeline-actions">
          <details className="pipeline-toolbar-menu">
            <summary className="pipeline-toolbar-button pipeline-toolbar-button--outline">
              Ações
              <FiChevronDown />
            </summary>
            <div className="pipeline-toolbar-menu__panel pipeline-toolbar-menu__panel--actions">
              <button
                type="button"
                className="pipeline-toolbar-menu__item"
                onClick={() => setIsScheduleCalendarOpen(true)}
              >
                <FiCalendar /> Agenda
              </button>
              <button
                type="button"
                className="pipeline-toolbar-menu__item"
                onClick={() => void handleExportCrm()}
                disabled={loading || isRefreshing || isExportingCrm}
              >
                <FiDownload /> {isExportingCrm ? "Exportando..." : "Exportar Excel"}
              </button>
            </div>
          </details>
          <button className="btn-primary pipeline-new-deal-button" onClick={() => setIsNewDealModalOpen(true)}>
            Novo atendimento
          </button>
        </div>
      </div>

      <div className="pipeline-content">
        <KanbanBoard
          deals={filteredDeals}
          loading={loading}
          stages={sortedStages}
          stagePaginationMeta={stagePaginationMeta}
          onLoadMoreStage={(stageId) => void loadMoreStage(stageId)}
          zoomLevel={zoomLevel}
          products={domains?.produtos || []}
          paymentOptions={domains?.formas_pagamento || []}
          lossReasonOptions={domains?.motivos_perda || []}
          interactionTypes={domains?.tipos_interacao || []}
          currentUser={{
            id: user?.id || 0,
            name: user?.name || "Usuario",
            isMaster: Boolean(user?.is_master) || hasPermission("commercial.manager"),
          }}
          crmId={domains?.crm_id}
          onDealUpdate={() => undefined}
          onDealDelete={() => undefined}
          onReload={() => void loadPipeline(appliedFilters, { preserveLoadedCounts: true })}
        />
      </div>

      <div className={`pipeline-zoom-fab ${isZoomControlOpen ? "open" : ""}`}>
        {isZoomControlOpen ? (
          <div className="pipeline-zoom-panel">
            <button
              type="button"
              className="pipeline-zoom-step"
              onClick={() => {
                if (!canZoomOut) return;
                setZoomLevel(PIPELINE_ZOOM_LEVELS[zoomIndex - 1]);
              }}
              disabled={!canZoomOut}
              aria-label="Diminuir zoom do funil"
              title="Diminuir zoom"
            >
              <FiMinus />
            </button>
            <span className="pipeline-zoom-level">{formatZoomLevel(zoomLevel)}</span>
            <button
              type="button"
              className="pipeline-zoom-step"
              onClick={() => {
                if (!canZoomIn) return;
                setZoomLevel(PIPELINE_ZOOM_LEVELS[zoomIndex + 1]);
              }}
              disabled={!canZoomIn}
              aria-label="Aumentar zoom do funil"
              title="Aumentar zoom"
            >
              <FiPlus />
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="pipeline-zoom-trigger"
          onClick={() => setIsZoomControlOpen((current) => !current)}
          aria-label={isZoomControlOpen ? "Fechar controle de zoom" : "Abrir controle de zoom"}
          title={isZoomControlOpen ? "Fechar zoom" : "Zoom do funil"}
        >
          <FiSearch />
        </button>
      </div>

      <NewAtendimentoModal
        isOpen={isNewDealModalOpen}
        onClose={() => setIsNewDealModalOpen(false)}
        products={domains?.produtos || []}
        stages={sortedStages}
        currentUserName={user?.name || "Usuario"}
        onConfirm={async (dealData) => {
          try {
            await createCommercialDeal(dealData, domains?.crm_id);
            setIsNewDealModalOpen(false);
            addToast({
              type: "success",
              title: "Sucesso",
              description: "Novo atendimento iniciado com sucesso.",
            });
          } catch (error) {
            console.error("[CommercialPipeline] create deal error", {
              dealData,
              error,
            });
            addToast({
              type: "error",
              title: "Erro",
              description: error instanceof Error ? error.message : "Nao foi possivel criar o atendimento.",
            });
          }
        }}
      />

      {domains?.crm_id ? (
        <ScheduleCalendarModal
          isOpen={isScheduleCalendarOpen}
          onClose={() => setIsScheduleCalendarOpen(false)}
          crmId={domains.crm_id}
          interactionTypes={domains?.tipos_interacao || []}
        />
      ) : null}

    </div>
  );
}
