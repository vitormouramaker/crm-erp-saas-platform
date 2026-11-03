import { useState, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  FiSearch,
  FiCheckCircle,
  FiSettings,
  FiFilter,
  FiCpu,
  FiXCircle,
  FiArrowUp,
  FiCircle,
} from "react-icons/fi";
import { Avatar } from "../common/Avatar/Avatar";
import { generateColorFromName } from "../../utils/colors";
import type { TabType } from "../../data/mockData";
import "./ConversationList.css";

interface ApiConversation {
  id: number;
  cliente_id: number;
  nome: string;
  telefone: string;
  status: TabType;
  data_inicio: string;
  ultima_atualizacao: string;
  ultima_mensagem: string | null;
  ultima_mensagem_send_by?: number | null;
  nome_atendente?: string;
  cor_atendente?: string | null;
  unread_count?: number;
  usuario_id?: number | null;
  meta_numero_conta?: string | null;
  meta_nome_conta?: string | null;
  meta_cor?: string | null;
  usuario_atribuido_id?: number | null;
  nome_usuario_atribuido?: string | null;
  cor_usuario_atribuido?: string | null;
  fila_mais_24h?: boolean;
  search_match_preview?: string | null;
  search_match_timestamp?: string | null;
}

interface AttendantFilterOption {
  id: number;
  name: string;
}

interface MetaNumberFilterOption {
  value: string;
  label: string;
}

type ConversationSearchRequest = {
  term: string;
  status: TabType;
  showUnreadOnly: boolean;
};

type FinishedDatePreset = "all" | "today" | "7d" | "30d" | "90d" | "custom";

interface ConversationListProps {
  conversations: ApiConversation[];
  activeConversationId: number | null;
  onConversationSelect: (id: number, conversation?: ApiConversation) => void;
  initialTab: TabType | null;
  currentTab?: TabType;
  refreshSignal?: number;
  onTabChange?: (tab: TabType) => void;
  loading: boolean;
  onAnalyzeConversationIa?: (conversation: ApiConversation) => void;
  showSettingsButton?: boolean;
  onOpenSettings?: () => void;
  showWaitingFinalizeButton?: boolean;
  onFinalizeWaitingConversation?: (conversationId: number) => void;
  waitingFinalizeConversationId?: number | null;
  showFinalizeStaleWaitingButton?: boolean;
  onFinalizeStaleWaitingConversations?: () => void;
  staleWaitingConversationsCount?: number;
  isFinalizingStaleWaitingConversations?: boolean;
  showConversationFilterButton?: boolean;
  showAttendantFilterButton?: boolean;
  attendantFilterOptions?: AttendantFilterOption[];
  selectedAttendantFilter?: string;
  onAttendantFilterChange?: (value: string) => void;
  metaNumberFilterOptions?: MetaNumberFilterOption[];
  selectedMetaNumberFilter?: string;
  onMetaNumberFilterChange?: (value: string) => void;
  selectedFinishedDatePreset?: FinishedDatePreset;
  onFinishedDatePresetChange?: (value: FinishedDatePreset) => void;
  selectedFinishedDateStart?: string;
  selectedFinishedDateEnd?: string;
  onFinishedDateStartChange?: (value: string) => void;
  onFinishedDateEndChange?: (value: string) => void;
  searchResults?: ApiConversation[];
  searchTotalCount?: number;
  searchLoading?: boolean;
  searchLoadingMore?: boolean;
  searchHasMore?: boolean;
  onSearchRequest?: (request: ConversationSearchRequest) => void;
  onSearchLoadMore?: () => void;
  finishedCurrentPage?: number;
  finishedTotalPages?: number;
  finishedTotalCount?: number;
  finishedLoadingPage?: boolean;
  onFinishedPageChange?: (page: number) => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onConversationSelect,
  initialTab,
  currentTab,
  refreshSignal = 0,
  onTabChange,
  loading,
  onAnalyzeConversationIa,
  showSettingsButton = false,
  onOpenSettings,
  showWaitingFinalizeButton = false,
  onFinalizeWaitingConversation,
  waitingFinalizeConversationId = null,
  showFinalizeStaleWaitingButton = false,
  onFinalizeStaleWaitingConversations,
  staleWaitingConversationsCount = 0,
  isFinalizingStaleWaitingConversations = false,
  showConversationFilterButton = false,
  showAttendantFilterButton = false,
  attendantFilterOptions = [],
  selectedAttendantFilter = "",
  onAttendantFilterChange,
  metaNumberFilterOptions = [],
  selectedMetaNumberFilter = "",
  onMetaNumberFilterChange,
  selectedFinishedDatePreset = "all",
  onFinishedDatePresetChange,
  selectedFinishedDateStart = "",
  selectedFinishedDateEnd = "",
  onFinishedDateStartChange,
  onFinishedDateEndChange,
  searchResults = [],
  searchTotalCount = 0,
  searchLoading = false,
  searchLoadingMore = false,
  searchHasMore = false,
  onSearchRequest,
  onSearchLoadMore,
  finishedCurrentPage = 1,
  finishedTotalPages = 1,
  finishedTotalCount = 0,
  finishedLoadingPage = false,
  onFinishedPageChange,
}: ConversationListProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || "active");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAttendantFilterOpen, setIsAttendantFilterOpen] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const attendantFilterRef = useRef<HTMLDivElement | null>(null);
  const conversationsListRef = useRef<HTMLUListElement | null>(null);
  const scrollTopRef = useRef(0);
  const scrollTopDismissTimerRef = useRef<number | null>(null);
  const isScrollTopButtonHoveredRef = useRef(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [finishedPageInput, setFinishedPageInput] = useState("1");

  const parseConversationTime = (value?: string | null) => {
    if (!value) return null;

    const raw = String(value).trim();
    const match = raw.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?(?:Z|[+-]\d{2}:\d{2})?$/,
    );

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hour = Number(match[4] || "00");
      const minute = Number(match[5] || "00");
      const second = Number(match[6] || "00");
      const millisecond = Number(String(match[7] || "0").padEnd(3, "0"));
      const date = new Date(year, month - 1, day, hour, minute, second, millisecond);

      return Number.isNaN(date.getTime())
        ? null
        : {
            raw,
            year,
            month,
            day,
            hour,
            minute,
            date,
          };
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return {
      raw,
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
      hour: parsed.getHours(),
      minute: parsed.getMinutes(),
      date: parsed,
    };
  };

  const formatConversationTime = (value?: string | null) => {
    if (!value) return { label: "--:--", title: "Data indisponível" };

    const parsed = parseConversationTime(value);
    if (!parsed) {
      return { label: "--:--", title: "Data inválida" };
    }

    const getDateParts = (date: Date) => {
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
      };
    };

    const todayParts = getDateParts(new Date());
    const valueParts = {
      year: parsed.year,
      month: parsed.month,
      day: parsed.day,
    };
    const todayUtc = Date.UTC(
      todayParts.year,
      todayParts.month - 1,
      todayParts.day,
    );
    const valueUtc = Date.UTC(
      valueParts.year,
      valueParts.month - 1,
      valueParts.day,
    );
    const dayDiff = Math.floor((todayUtc - valueUtc) / (24 * 60 * 60 * 1000));

    const title = `${String(parsed.day).padStart(2, "0")}/${String(parsed.month).padStart(2, "0")}/${parsed.year} ${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;

    if (dayDiff === 0) {
      return {
        label: `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`,
        title,
      };
    }

    if (dayDiff > 0 && dayDiff < 7) {
      const weekday = new Intl.DateTimeFormat("pt-BR", {
        weekday: "short",
      })
        .format(parsed.date)
        .replace(".", "");

      return {
        label: weekday.charAt(0).toUpperCase() + weekday.slice(1),
        title,
      };
    }

    return {
      label:
        todayParts.year === valueParts.year
          ? `${String(parsed.day).padStart(2, "0")}/${String(parsed.month).padStart(2, "0")}`
          : `${String(parsed.day).padStart(2, "0")}/${String(parsed.month).padStart(2, "0")}/${String(parsed.year).slice(-2)}`,
      title,
    };
  };

  useEffect(() => {
    if (currentTab) {
      setActiveTab(currentTab);
      return;
    }
    if (initialTab) setActiveTab(initialTab);
  }, [currentTab, initialTab]);

  useEffect(() => {
    if (!isAttendantFilterOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!attendantFilterRef.current?.contains(event.target as Node)) {
        setIsAttendantFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isAttendantFilterOpen]);

  const clearScrollToTopTimer = () => {
    if (scrollTopDismissTimerRef.current === null) return;
    window.clearTimeout(scrollTopDismissTimerRef.current);
    scrollTopDismissTimerRef.current = null;
  };

  const scheduleScrollToTopDismiss = () => {
    clearScrollToTopTimer();
    if (isScrollTopButtonHoveredRef.current) return;

    scrollTopDismissTimerRef.current = window.setTimeout(() => {
      if (!isScrollTopButtonHoveredRef.current) {
        setShowScrollToTop(false);
      }
    }, 5000);
  };

  useEffect(() => {
    return () => {
      clearScrollToTopTimer();
    };
  }, []);

  useEffect(() => {
    if (!onSearchRequest) return;

    const debounceTimer = window.setTimeout(() => {
      onSearchRequest({
        term: searchTerm,
        status: activeTab,
        showUnreadOnly,
      });
    }, searchTerm.trim() ? 300 : 0);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [
    activeTab,
    onSearchRequest,
    refreshSignal,
    searchTerm,
    selectedAttendantFilter,
    selectedMetaNumberFilter,
    showUnreadOnly,
  ]);

  useEffect(() => {
    setFinishedPageInput(String(finishedCurrentPage || 1));
  }, [finishedCurrentPage]);

  const normalizedSearchTerm = searchTerm.trim();
  const isSearchMode = normalizedSearchTerm.length > 0 && Boolean(onSearchRequest);

  useEffect(() => {
    if (activeTab !== "finished" || isSearchMode) return;
    const listElement = conversationsListRef.current;
    if (!listElement) return;
    listElement.scrollTo({ top: 0, behavior: "smooth" });
    scrollTopRef.current = 0;
    clearScrollToTopTimer();
    setShowScrollToTop(false);
  }, [activeTab, finishedCurrentPage, isSearchMode]);

  useLayoutEffect(() => {
    const listElement = conversationsListRef.current;
    if (!listElement) return;

    const maxScrollTop = Math.max(0, listElement.scrollHeight - listElement.clientHeight);
    const nextScrollTop = Math.min(scrollTopRef.current, maxScrollTop);

    if (Math.abs(listElement.scrollTop - nextScrollTop) > 1) {
      listElement.scrollTop = nextScrollTop;
    }
  }, [conversations, searchResults, isSearchMode]);

  const handleConversationsScroll = () => {
    const listElement = conversationsListRef.current;
    if (!listElement) return;

    const previousScrollTop = scrollTopRef.current;
    const currentScrollTop = listElement.scrollTop;
    const hasManualScroll = Math.abs(currentScrollTop - previousScrollTop) > 2;

    scrollTopRef.current = currentScrollTop;

    if (currentScrollTop <= 160) {
      clearScrollToTopTimer();
      setShowScrollToTop(false);
      return;
    }

    if (hasManualScroll) {
      setShowScrollToTop(true);
      scheduleScrollToTopDismiss();
    }
  };

  const handleScrollToTop = () => {
    const listElement = conversationsListRef.current;
    if (!listElement) return;

    clearScrollToTopTimer();
    setShowScrollToTop(false);
    listElement.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleScrollTopButtonEnter = () => {
    isScrollTopButtonHoveredRef.current = true;
    clearScrollToTopTimer();
  };

  const handleScrollTopButtonLeave = () => {
    isScrollTopButtonHoveredRef.current = false;
    if (scrollTopRef.current > 160) {
      scheduleScrollToTopDismiss();
    }
  };

  const awaitingCount = conversations.filter(
    (conv) => conv.status === "waiting"
  ).length;
  const normalizedFinishedTotalPages = Math.max(
    1,
    Number(finishedTotalPages || 1)
  );
  const normalizedFinishedCurrentPage = Math.min(
    normalizedFinishedTotalPages,
    Math.max(1, Number(finishedCurrentPage || 1))
  );
  const isFinishedCustomRange = selectedFinishedDatePreset === "custom";
  const hasFinishedDateFilter =
    activeTab === "finished" &&
    (selectedFinishedDatePreset !== "all" ||
      Boolean(selectedFinishedDateStart) ||
      Boolean(selectedFinishedDateEnd));
  const hasActiveListFilters =
    Boolean(selectedAttendantFilter) ||
    Boolean(selectedMetaNumberFilter) ||
    Boolean(showUnreadOnly) ||
    hasFinishedDateFilter;

  const selectedAttendantOption = attendantFilterOptions.find(
    (option) => String(option.id) === selectedAttendantFilter
  );
  const selectedMetaNumberOption = metaNumberFilterOptions.find(
    (option) => option.value === selectedMetaNumberFilter
  );
  const finishedDatePresetLabel =
    selectedFinishedDatePreset === "today"
      ? "hoje"
      : selectedFinishedDatePreset === "7d"
        ? "ultimos 7 dias"
        : selectedFinishedDatePreset === "30d"
          ? "ultimos 30 dias"
          : selectedFinishedDatePreset === "90d"
            ? "ultimos 90 dias"
            : selectedFinishedDatePreset === "custom"
              ? "periodo personalizado"
              : "";

  const resolveConversationAttendantId = (conv: ApiConversation) => {
    const rawId =
      conv.status === "waiting"
        ? conv.usuario_atribuido_id ?? conv.usuario_id ?? null
        : conv.usuario_id ?? conv.usuario_atribuido_id ?? null;
    const normalizedId = Number(rawId);
    return Number.isInteger(normalizedId) && normalizedId > 0 ? normalizedId : null;
  };

  const matchesSelectedAttendant = (conv: ApiConversation) => {
    if (!selectedAttendantFilter) return true;

    const conversationAttendantId = resolveConversationAttendantId(conv);
    if (selectedAttendantFilter === "unassigned") {
      return conversationAttendantId === null;
    }

    const selectedId = Number(selectedAttendantFilter);
    if (Number.isInteger(selectedId) && selectedId > 0) {
      if (conversationAttendantId === selectedId) {
        return true;
      }

      const selectedName = String(selectedAttendantOption?.name || "")
        .trim()
        .toLowerCase();
      if (!selectedName) {
        return false;
      }

      return [
        String(conv.nome_atendente || "").trim().toLowerCase(),
        String(conv.nome_usuario_atribuido || "").trim().toLowerCase(),
      ].includes(selectedName);
    }

    return true;
  };

  const matchesSelectedMetaNumber = (conv: ApiConversation) => {
    if (!selectedMetaNumberFilter) return true;
    return String(conv.meta_numero_conta || "").trim() === selectedMetaNumberFilter;
  };

  const resolveConversationMetaColor = (conv: ApiConversation) => {
    const normalized = String(conv.meta_cor || "").trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      return normalized;
    }

    return generateColorFromName(
      conv.meta_numero_conta || conv.meta_nome_conta || conv.nome || "Meta"
    );
  };

  const resolveConversationAttendantName = (conv: ApiConversation) =>
    String(conv.nome_atendente || conv.nome_usuario_atribuido || "").trim();

  const resolveConversationAttendantColor = (conv: ApiConversation) => {
    const attendantId = Number(conv.usuario_id || conv.usuario_atribuido_id || 0);
    const configuredColor = String(
      conv.cor_atendente || conv.cor_usuario_atribuido || ""
    ).trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(configuredColor)) {
      return configuredColor;
    }

    return generateColorFromName(`atendente-${attendantId}`);
  };

  const resolveLastMessageIndicator = (conv: ApiConversation) => {
    const sender = Number(conv.ultima_mensagem_send_by);
    if (sender === 1) {
      return { label: "Cliente", modifier: "customer" as const };
    }

    if ([2, 3, 4].includes(sender)) {
      return { label: "Usuário", modifier: "agent" as const };
    }

    return null;
  };

  const filteredConversations = conversations
    .filter((conv) => conv.status === activeTab)
    .filter(matchesSelectedAttendant)
    .filter(matchesSelectedMetaNumber)
    .filter((conv) => !showUnreadOnly || Number(conv.unread_count || 0) > 0)
    .filter((conv) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();

      return (
        (conv.nome || "").toLowerCase().includes(term) ||
        (conv.telefone || "").includes(term) ||
        (conv.ultima_mensagem || "").toLowerCase().includes(term)
      );
    });

  const visibleConversations = isSearchMode ? searchResults : filteredConversations;
  const isListLoading = isSearchMode ? searchLoading : loading;
  const normalizedSearchTotal = Math.max(0, Number(searchTotalCount || 0));
  const searchCountLabel =
    normalizedSearchTotal === 1
      ? "1 contato encontrado"
      : `${normalizedSearchTotal} contatos encontrados`;
  const searchSummaryText = searchLoading
    ? `Procurando por "${normalizedSearchTerm}" nas conversas.`
    : normalizedSearchTotal === 0
      ? `Nenhum resultado para "${normalizedSearchTerm}".`
      : searchHasMore
        ? `Mostrando ${visibleConversations.length} dos ${normalizedSearchTotal} contatos mais recentes.`
        : `Resultados mais recentes para "${normalizedSearchTerm}".`;
  const emptyStateMessage = isSearchMode
    ? searchLoading
      ? "Pesquisando conversas..."
      : "Nenhuma conversa encontrada."
    : "Nenhuma conversa encontrada.";

  return (
    <aside className="conversation-list-container">
      <header className="list-header">
        <div className="list-header-top">
          <h2>Atendimentos</h2>
        </div>
        <div className="list-search-row">
          <div className="search-bar">
            <FiSearch size={18} color="var(--color-text-secondary)" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="conversation-list-actions">
            {showConversationFilterButton ? (
              <div
                className="conversation-filter-wrapper"
                ref={attendantFilterRef}
              >
                <button
                  type="button"
                  className={`conversation-settings-button ${
                    hasActiveListFilters
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setIsAttendantFilterOpen((currentValue) => !currentValue)
                  }
                  title={
                    hasActiveListFilters
                      ? `Filtros ativos: ${
                          [
                            selectedAttendantFilter
                              ? selectedAttendantFilter === "unassigned"
                                ? "sem atendente"
                                : selectedAttendantOption?.name || "atendente"
                              : null,
                            selectedMetaNumberFilter
                              ? selectedMetaNumberOption?.label || selectedMetaNumberFilter
                              : null,
                            showUnreadOnly ? "nao lidas" : null,
                            hasFinishedDateFilter
                              ? selectedFinishedDatePreset === "custom"
                                ? `periodo ${selectedFinishedDateStart || "inicio"} ate ${
                                    selectedFinishedDateEnd || "fim"
                                  }`
                                : finishedDatePresetLabel
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" | ")
                        }`
                      : "Filtrar conversas"
                   }
                   aria-label="Filtrar conversas"
                   aria-expanded={isAttendantFilterOpen}
                 >
                   <FiFilter size={18} />
                </button>

                 {isAttendantFilterOpen ? (
                   <div className="conversation-filter-popover">
                    {showAttendantFilterButton ? (
                      <>
                        <label htmlFor="conversation-attendant-filter">
                          Filtrar filas
                        </label>
                        <select
                          id="conversation-attendant-filter"
                          value={selectedAttendantFilter}
                          onChange={(event) =>
                            onAttendantFilterChange?.(event.target.value)
                          }
                        >
                          <option value="">Todos os atendentes</option>
                          <option value="unassigned">Sem atendente</option>
                          {attendantFilterOptions.map((option) => (
                            <option key={option.id} value={String(option.id)}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : null}
                    <select
                      id="conversation-meta-number-filter"
                      value={selectedMetaNumberFilter}
                      onChange={(event) =>
                        onMetaNumberFilterChange?.(event.target.value)
                      }
                    >
                      <option value="">Todos numeros Meta</option>
                      {metaNumberFilterOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <label
                      htmlFor="conversation-unread-filter"
                      className="conversation-filter-checkbox"
                    >
                      <input
                        id="conversation-unread-filter"
                        type="checkbox"
                        checked={showUnreadOnly}
                        onChange={(event) => setShowUnreadOnly(event.target.checked)}
                      />
                      <span>Somente conversas nao lidas</span>
                    </label>
                    {activeTab === "finished" ? (
                      <div className="conversation-finished-date-grid">
                        <label
                          htmlFor="conversation-finished-date-preset"
                          className="conversation-filter-field"
                        >
                          <span>Periodo</span>
                          <select
                            id="conversation-finished-date-preset"
                            value={selectedFinishedDatePreset}
                            onChange={(event) =>
                              onFinishedDatePresetChange?.(
                                event.target.value as FinishedDatePreset
                              )
                            }
                          >
                            <option value="all">Todos</option>
                            <option value="today">Hoje</option>
                            <option value="7d">Ultimos 7 dias</option>
                            <option value="30d">Ultimos 30 dias</option>
                            <option value="90d">Ultimos 90 dias</option>
                            <option value="custom">Personalizado</option>
                          </select>
                        </label>
                        {isFinishedCustomRange ? (
                          <>
                        <label
                          htmlFor="conversation-finished-date-start"
                          className="conversation-filter-field"
                        >
                          <span>Finalizados de</span>
                          <input
                            id="conversation-finished-date-start"
                            type="date"
                            value={selectedFinishedDateStart}
                            onChange={(event) =>
                              onFinishedDateStartChange?.(event.target.value)
                            }
                          />
                        </label>
                        <label
                          htmlFor="conversation-finished-date-end"
                          className="conversation-filter-field"
                        >
                          <span>Até</span>
                          <input
                            id="conversation-finished-date-end"
                            type="date"
                            value={selectedFinishedDateEnd}
                            onChange={(event) =>
                              onFinishedDateEndChange?.(event.target.value)
                            }
                          />
                        </label>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {hasActiveListFilters ? (
                      <button
                        type="button"
                        className="conversation-filter-clear"
                        onClick={() => {
                          onAttendantFilterChange?.("");
                          onMetaNumberFilterChange?.("");
                          onFinishedDatePresetChange?.("all");
                          onFinishedDateStartChange?.("");
                          onFinishedDateEndChange?.("");
                          setShowUnreadOnly(false);
                        }}
                      >
                        Limpar filtro
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {showSettingsButton ? (
              <button
                type="button"
                className="conversation-settings-button"
                onClick={onOpenSettings}
                title="Configurar atendimentos"
                aria-label="Configurar atendimentos"
              >
                <FiSettings size={18} />
              </button>
            ) : null}
          </div>
        </div>
        {isSearchMode ? (
          <div className="conversation-search-summary" role="status" aria-live="polite">
            <strong>{searchLoading ? "Buscando contatos..." : searchCountLabel}</strong>
            <span>{searchSummaryText}</span>
          </div>
        ) : null}
      </header>

      <div className="tabs-container">
        <button
          className={`tab-item ${activeTab === "active" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("active");
            onTabChange?.("active");
          }}
        >
          Ativos
        </button>
        <button
          className={`tab-item ${activeTab === "waiting" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("waiting");
            onTabChange?.("waiting");
          }}
        >
          Aguardando
          {awaitingCount > 0 && (
            <span className="awaiting-badge">{awaitingCount}</span>
          )}
        </button>
        <button
          className={`tab-item ${activeTab === "finished" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("finished");
            onTabChange?.("finished");
          }}
        >
          Finalizados
        </button>
      </div>

      {showFinalizeStaleWaitingButton && activeTab === "waiting" ? (
        <div className="waiting-bulk-actions">
          <button
            type="button"
            className="waiting-bulk-finalize-button"
            onClick={() => onFinalizeStaleWaitingConversations?.()}
            disabled={
              isFinalizingStaleWaitingConversations ||
              staleWaitingConversationsCount <= 0
            }
          >
            <FiXCircle size={14} />
            <span>
              {isFinalizingStaleWaitingConversations
                ? "Finalizando fila..."
                : `Finalizar fila +48h (${staleWaitingConversationsCount})`}
            </span>
          </button>
        </div>
      ) : null}

      <div className="conversations-scroll-region">
        {showScrollToTop && !isListLoading ? (
          <button
            type="button"
            className="conversation-scroll-top-button"
            onClick={handleScrollToTop}
            onMouseEnter={handleScrollTopButtonEnter}
            onMouseLeave={handleScrollTopButtonLeave}
            onFocus={handleScrollTopButtonEnter}
            onBlur={handleScrollTopButtonLeave}
            aria-label="Ir para o topo da lista de conversas"
          >
            <FiArrowUp size={15} />
            <span>Ir para o topo</span>
          </button>
        ) : null}

        {isListLoading ? (
          <p className="conversation-empty-state">
            {isSearchMode ? "Pesquisando conversas..." : "Carregando conversas..."}
          </p>
        ) : (
          <ul
            className="conversations"
            ref={conversationsListRef}
            onScroll={handleConversationsScroll}
          >
            {visibleConversations.length === 0 && (
              <p className="conversation-empty-state">
                {emptyStateMessage}
              </p>
            )}

            {visibleConversations.map((conv) => {
              const attendantName = resolveConversationAttendantName(conv);
              const lastMessageIndicator = resolveLastMessageIndicator(conv);
              const lastMessagePreview =
                conv.search_match_preview || conv.ultima_mensagem || "Iniciar conversa...";

              return (
                <li
                  key={conv.id}
                  className={`conversation-item ${
                    conv.id === activeConversationId ? "active" : ""
                  } ${activeTab === "finished" ? "conversation-item--finished" : ""} ${
                    activeTab === "waiting" ? "conversation-item--waiting" : ""
                  }`}
                  onClick={() => onConversationSelect(conv.id, conv)}
                >
                  <Avatar
                    name={conv.nome}
                    color={
                      generateColorFromName
                        ? generateColorFromName(conv.nome)
                        : "#4CAF50"
                    }
                    size="medium"
                  />

                  <div className="conversation-details">
                    <div className="conversation-header">
                      <span className="conversation-name">{conv.nome}</span>
                    </div>

                    <div className="conversation-last-message">
                      {lastMessageIndicator ? (
                        <span
                          className={`conversation-last-message__indicator conversation-last-message__indicator--${lastMessageIndicator.modifier}`}
                        >
                          {lastMessageIndicator.label}
                        </span>
                      ) : null}
                      <span className="conversation-last-message__text">
                        {lastMessagePreview}
                      </span>
                    </div>

                    {(attendantName || conv.meta_numero_conta) && (
                      <div className="conversation-channel">
                        {activeTab === "active" && attendantName ? (
                          <span
                            className="conversation-attendant-badge"
                            title={`Atendente: ${attendantName}`}
                            style={
                              {
                                "--conversation-attendant-color":
                                  resolveConversationAttendantColor(conv),
                              } as CSSProperties
                            }
                          >
                            
                            <span>Usuário: {attendantName}</span>
                          </span>
                        ) : (
                          <span className="conversation-channel__attendant">
                            {attendantName
                              ? `Atendente: ${attendantName}`
                              : "Sem atendente"}
                          </span>
                        )}
                        {conv.meta_numero_conta ? (
                          <span
                            className="conversation-meta-number-badge"
                            style={
                              {
                                "--conversation-meta-color":
                                  resolveConversationMetaColor(conv),
                              } as CSSProperties
                            }
                          >
                            <FiCircle
                              className="conversation-meta-number-badge__dot"
                              aria-hidden="true"
                              size={8}
                            />
                            <span className="conversation-meta-number-badge__text">
                              {conv.meta_numero_conta}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    )}

                    {activeTab === "waiting" && conv.nome_usuario_atribuido ? (
                      <div className="conversation-assignee">
                        Atribuido para: {conv.nome_usuario_atribuido}
                      </div>
                    ) : null}

                    {activeTab === "waiting" && showWaitingFinalizeButton ? (
                      <div className="conversation-waiting-actions">
                        <button
                          type="button"
                          className="conversation-waiting-finalize-button"
                          disabled={
                            waitingFinalizeConversationId !== null &&
                            waitingFinalizeConversationId !== conv.id
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            onFinalizeWaitingConversation?.(conv.id);
                          }}
                        >
                          <FiXCircle size={13} />
                          <span>
                            {waitingFinalizeConversationId === conv.id
                              ? "Finalizando..."
                              : "Finalizar fila"}
                          </span>
                        </button>
                      </div>
                    ) : null}

                    {activeTab === "finished" && attendantName && (
                      <div className="finalized-by">
                        <FiCheckCircle size={12} />
                        <span>Finalizado por: {attendantName}</span>
                      </div>
                    )}
                  </div>
                  <div className="conversation-meta">
                  {(() => {
                    const timeMeta = formatConversationTime(
                      conv.search_match_timestamp || conv.ultima_atualizacao,
                    );

                    return (
                      <span className="conversation-time" title={timeMeta.title}>
                        {timeMeta.label}
                      </span>
                    );
                  })()}
                  {activeTab === "finished" && onAnalyzeConversationIa ? (
                    <button
                      type="button"
                      className="conversation-ia-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAnalyzeConversationIa(conv);
                      }}
                      title="Analisar atendimento com IA"
                      aria-label="Analisar atendimento com IA"
                    >
                      <FiCpu size={13} />
                      <span>IA</span>
                    </button>
                  ) : null}
                  {conv.unread_count && conv.unread_count > 0 ? (
                    <span className="unread-message-badge">
                      {conv.unread_count}
                    </span>
                  ) : null}
                </div>
              </li>
              );
            })}
            {isSearchMode && searchLoadingMore ? (
              <li className="conversation-list-feedback">
                Carregando mais resultados...
              </li>
            ) : null}
            {isSearchMode && searchHasMore && !searchLoadingMore ? (
              <li className="conversation-list-load-more">
                <button
                  type="button"
                  className="conversation-list-load-more-button"
                  onClick={() => onSearchLoadMore?.()}
                >
                  Carregar mais
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </div>
      {!isSearchMode && activeTab === "finished" ? (
        <div className="conversation-pagination-footer">
          <div className="conversation-pagination-summary">
            <strong className="conversation-pagination-title">
              Pagina {normalizedFinishedCurrentPage} de {normalizedFinishedTotalPages}
            </strong>
            <span className="conversation-pagination-count">
              {Math.max(0, Number(finishedTotalCount || 0))} finalizadas
            </span>
          </div>
          <div className="conversation-pagination-controls">
            <button
              type="button"
              className="conversation-pagination-button"
              title="Ir para a primeira pagina"
              aria-label="Ir para a primeira pagina"
              disabled={finishedLoadingPage || normalizedFinishedCurrentPage <= 1}
              onClick={() => onFinishedPageChange?.(1)}
            >
              {"<<"}
            </button>
            <button
              type="button"
              className="conversation-pagination-button"
              title="Ir para a pagina anterior"
              aria-label="Ir para a pagina anterior"
              disabled={finishedLoadingPage || normalizedFinishedCurrentPage <= 1}
              onClick={() =>
                onFinishedPageChange?.(normalizedFinishedCurrentPage - 1)
              }
            >
              {"<"}
            </button>
            <div className="conversation-pagination-jump">
              <span className="conversation-pagination-jump-label">Pag.</span>
              <input
                type="number"
                min={1}
                max={normalizedFinishedTotalPages}
                inputMode="numeric"
                value={finishedPageInput}
                onChange={(event) => setFinishedPageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  const nextPage = Math.max(
                    1,
                    Math.min(
                      normalizedFinishedTotalPages,
                      Math.floor(Number(finishedPageInput) || 1)
                    )
                  );
                  onFinishedPageChange?.(nextPage);
                }}
              />
              <button
                type="button"
                className="conversation-pagination-button conversation-pagination-button--ghost"
                title="Ir para a pagina informada"
                aria-label="Ir para a pagina informada"
                disabled={finishedLoadingPage}
                onClick={() => {
                  const nextPage = Math.max(
                    1,
                    Math.min(
                      normalizedFinishedTotalPages,
                      Math.floor(Number(finishedPageInput) || 1)
                    )
                  );
                  onFinishedPageChange?.(nextPage);
                }}
              >
                Ir
              </button>
            </div>
            <button
              type="button"
              className="conversation-pagination-button"
              title="Ir para a proxima pagina"
              aria-label="Ir para a proxima pagina"
              disabled={
                finishedLoadingPage ||
                normalizedFinishedCurrentPage >= normalizedFinishedTotalPages
              }
              onClick={() =>
                onFinishedPageChange?.(normalizedFinishedCurrentPage + 1)
              }
            >
              {">"}
            </button>
            <button
              type="button"
              className="conversation-pagination-button"
              title="Ir para a ultima pagina"
              aria-label="Ir para a ultima pagina"
              disabled={
                finishedLoadingPage ||
                normalizedFinishedCurrentPage >= normalizedFinishedTotalPages
              }
              onClick={() => onFinishedPageChange?.(normalizedFinishedTotalPages)}
            >
              {">>"}
            </button>
          </div>
          {finishedLoadingPage ? (
            <div className="conversation-pagination-status">
              Carregando pagina de conversas finalizadas...
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
