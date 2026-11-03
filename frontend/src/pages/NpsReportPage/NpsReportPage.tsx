import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
  FiFilter,
  FiMessageSquare,
  FiRefreshCw,
  FiStar,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import {
  PeriodRangePicker,
  type PeriodRangeValue,
} from "../../components/common/PeriodRangePicker/PeriodRangePicker";
import { useAuth } from "../../contexts/AuthContext";
import {
  obterRelatorioNps,
  type NpsReportAnswerItem,
  type NpsReportResponse,
} from "../../service/npsService";
import "./NpsReportPage.css";

type BranchOption = {
  id: number;
  name: string;
};

const initialReport: NpsReportResponse = {
  filtros: {},
  filiais: [],
  resumo: {
    totalAvaliacoes: 0,
    totalRespostas: 0,
    promotores: 0,
    neutros: 0,
    detratores: 0,
    mediaNota: 0,
    npsGeral: 0,
  },
  evolucao: [],
  porAtendente: [],
  distribuicaoNotas: [],
  respostas: [],
};

function getCurrentMonthPeriod() {
  const today = new Date();
  const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return {
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(today.getDate()).padStart(2, "0")}`,
  };
}

function formatPeriodLabel(start?: string, end?: string) {
  const currentMonth = getCurrentMonthPeriod();
  if (start === currentMonth.start && end === currentMonth.end) return "Este mês";

  const formatDate = (value?: string | null) => {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    const [year, month, day] = normalized.split("-");
    if (!year || !month || !day) return normalized;
    return `${day}/${month}/${year}`;
  };

  return `${formatDate(start) || "Inicio"} ate ${formatDate(end) || "Hoje"}`;
}

function parseReportDateTime(value: string) {
  const normalized = value.trim();
  // Datas do relatório sem indicação de fuso são interpretadas como UTC.
  const utcDateTime = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)
    ? `${normalized.replace(" ", "T")}Z`
    : normalized;
  return new Date(utcDateTime);
}

function getResponseDateTime(item: NpsReportAnswerItem) {
  // O timestamp agregado passa pelo driver pg; o JSON das perguntas preserva o horário original.
  const questionDates = item.perguntas
    .map((question) => question.data_resposta ? parseReportDateTime(question.data_resposta) : null)
    .filter((date): date is Date => date !== null && !Number.isNaN(date.getTime()));

  if (questionDates.length > 0) {
    return new Date(Math.max(...questionDates.map((date) => date.getTime()))).toISOString();
  }

  return item.data_resposta || item.data_fim || item.data_inicio;
}

function formatDateTime(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  const date = parseReportDateTime(normalized);
  if (Number.isNaN(date.getTime())) return normalized;
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function formatShortDate(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const datePart = normalized.split("T")[0];
  const date = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(date.getTime())) return normalized;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function classificationLabel(value: NpsReportAnswerItem["classificacao"]) {
  if (value === "promotor") return "Promotor";
  if (value === "neutro") return "Neutro";
  return "Detrator";
}

export function NpsReportPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<NpsReportResponse>(initialReport);
  const [expandedQuestions, setExpandedQuestions] = useState<Record<number, boolean>>({});
  const [periodFilter, setPeriodFilter] = useState(getCurrentMonthPeriod);
  const [branchFilter, setBranchFilter] = useState("all");
  const [isPeriodFilterOpen, setIsPeriodFilterOpen] = useState(false);
  const periodFilterRef = useRef<HTMLDivElement | null>(null);
  const hasActiveFilters = Boolean(
    branchFilter !== "all" || periodFilter.start || periodFilter.end
  );

  const branchOptions = useMemo<BranchOption[]>(
    () =>
      (Array.isArray(report.filiais) ? report.filiais : [])
        .map((item) => ({
          id: Number(item?.id || 0),
          name: String(item?.nome || item?.name || `Filial ${item?.id || ""}`),
        }))
        .filter((item) => item.id > 0),
    [report.filiais]
  );

  const activePeriodLabel = useMemo(
    () => formatPeriodLabel(periodFilter.start, periodFilter.end),
    [periodFilter.end, periodFilter.start]
  );

  const evolutionData = useMemo(
    () =>
      report.evolucao.map((item) => ({
        ...item,
        data_label: formatShortDate(item.data_referencia),
      })),
    [report.evolucao]
  );

  const totalNotas = useMemo(
    () => report.distribuicaoNotas.reduce((acc, item) => acc + Number(item.total || 0), 0),
    [report.distribuicaoNotas]
  );

  const topAttendants = useMemo(
    () => [...report.porAtendente].sort((a, b) => Number(b.nps || 0) - Number(a.nps || 0)).slice(0, 10),
    [report.porAtendente]
  );

  const clearFilters = () => {
    setPeriodFilter({ start: "", end: "" });
    setBranchFilter("all");
    setIsPeriodFilterOpen(false);
  };

  const applyPeriodFilter = (nextPeriod: PeriodRangeValue) => {
    setPeriodFilter({
      start: nextPeriod.dateStart,
      end: nextPeriod.dateEnd,
    });
    setIsPeriodFilterOpen(false);
  };

  useEffect(() => {
    if (!isPeriodFilterOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!periodFilterRef.current?.contains(event.target as Node)) {
        setIsPeriodFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isPeriodFilterOpen]);

  useEffect(() => {
    const loadReport = async () => {
      if (!user?.empresa_id || !user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await obterRelatorioNps({
          empresaId: user.empresa_id,
          usuarioId: user.id,
          dateStart: periodFilter.start || undefined,
          dateEnd: periodFilter.end || undefined,
          filialId: branchFilter !== "all" ? Number(branchFilter) : null,
          limit: 100,
        });
        setReport(response);
      } catch (loadError) {
        console.error("Erro ao carregar relatório NPS:", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar o relatório de NPS."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadReport();
  }, [branchFilter, periodFilter.end, periodFilter.start, user?.empresa_id, user?.id]);

  return (
    <div className="nps-report-page">
      <MobileHeader title="Relatorio NPS" />

      <header className="nps-report-page__header">
        <div className="nps-report-page__header-title">
          <h1>Relatório NPS</h1>
          <p className="nps-report-page__subtitle">
            Analise a satisfação dos atendimentos com resumo, evolução e respostas detalhadas.
          </p>
        </div>

        <section className="nps-report-page__filters" aria-label="Filtros do relatório NPS">
          <select
            className="filter-select compact"
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            aria-label="Filial"
          >
            <option value="all">Todas as filiais</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={String(branch.id)}>
                {branch.name}
              </option>
            ))}
          </select>

          <div className="nps-report-page__period" ref={periodFilterRef}>
            <button
              type="button"
              className="filter-button compact"
              onClick={() => setIsPeriodFilterOpen((current) => !current)}
              aria-haspopup="dialog"
              aria-expanded={isPeriodFilterOpen}
            >
              <FiCalendar />
              <span>{activePeriodLabel}</span>
            </button>

            {isPeriodFilterOpen ? (
              <div className="nps-report-page__period-dropdown">
                <PeriodRangePicker
                  value={{
                    dateStart: periodFilter.start,
                    dateEnd: periodFilter.end,
                  }}
                  onApply={applyPeriodFilter}
                  onCancel={() => setIsPeriodFilterOpen(false)}
                />
              </div>
            ) : null}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="filter-button compact nps-report-page__clear-filters"
              onClick={clearFilters}
            >
              <FiFilter />
              <span>Limpar</span>
            </button>
          )}
        </section>
      </header>

      {loading ? (
        <div className="nps-report-page__state">
          <FiRefreshCw className="nps-report-page__spinner" />
          <span>Carregando relatorio...</span>
        </div>
      ) : error ? (
        <div className="nps-report-page__state nps-report-page__state--error">{error}</div>
      ) : (
        <>
          <section className="nps-report-page__summary-grid">
            <article className="nps-report-card nps-report-card--highlight">
              <div className="nps-report-card__icon">
                <FiStar size={20} />
              </div>
              <div>
                <p>NPS geral</p>
                <strong>{report.resumo.npsGeral.toFixed(1)}</strong>
                <span>Indice consolidado do periodo filtrado</span>
              </div>
            </article>

            <article className="nps-report-card">
              <div className="nps-report-card__icon">
                <FiUsers size={20} />
              </div>
              <div>
                <p>Atendimentos avaliados</p>
                <strong>{report.resumo.totalAvaliacoes}</strong>
                <span>{report.resumo.totalRespostas} resposta(s) registradas</span>
              </div>
            </article>

            <article className="nps-report-card">
              <div className="nps-report-card__icon">
                <FiTrendingUp size={20} />
              </div>
              <div>
                <p>Média da nota</p>
                <strong>{report.resumo.mediaNota.toFixed(1)}</strong>
                <span>Média das notas por atendimento</span>
              </div>
            </article>

            <article className="nps-report-card nps-report-card--positive">
              <div className="nps-report-card__icon">
                <FiUsers size={20} />
              </div>
              <div>
                <p>Promotores</p>
                <strong>{report.resumo.promotores}</strong>
                <span>Notas médias entre 9 e 10</span>
              </div>
            </article>

            <article className="nps-report-card">
              <div className="nps-report-card__icon">
                <FiUsers size={20} />
              </div>
              <div>
                <p>Neutros</p>
                <strong>{report.resumo.neutros}</strong>
                <span>Notas médias entre 7 e 8</span>
              </div>
            </article>

            <article className="nps-report-card nps-report-card--negative">
              <div className="nps-report-card__icon">
                <FiMessageSquare size={20} />
              </div>
              <div>
                <p>Detratores</p>
                <strong>{report.resumo.detratores}</strong>
                <span>Notas médias entre 1 e 6</span>
              </div>
            </article>
          </section>

          <section className="nps-report-page__charts-grid">
            <article className="nps-report-panel">
              <header className="nps-report-panel__header">
                <div>
                  <h2>Evolução do NPS</h2>
                  <p>Variação diária do índice e do volume de atendimentos avaliados</p>
                </div>
              </header>

              {evolutionData.length > 0 ? (
                <div className="nps-report-chart">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={evolutionData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="data_label" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === "NPS") return [Number(value || 0).toFixed(1), name];
                          return [String(value || 0), name];
                        }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="nps"
                        name="NPS"
                        stroke="#c5d200"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="total_avaliacoes"
                        name="Avaliações"
                        stroke="#4ade80"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="nps-report-panel__empty">Nenhum dado de evolução encontrado para os filtros selecionados.</p>
              )}
            </article>

            <article className="nps-report-panel">
              <header className="nps-report-panel__header">
                <div>
                  <h2>Distribuição por nota</h2>
                  <p>{totalNotas} resposta(s) individuais agrupadas por nota</p>
                </div>
              </header>

              <div className="nps-report-chart">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={report.distribuicaoNotas} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="nota" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                    <Tooltip formatter={(value: number) => [String(value || 0), "Respostas"]} />
                    <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                      {report.distribuicaoNotas.map((item) => (
                        <Cell
                          key={`dist-${item.nota}`}
                          fill={item.nota >= 9 ? "#4ade80" : item.nota >= 7 ? "#facc15" : "#fb7185"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="nps-report-page__content-grid">
            <article className="nps-report-panel">
              <header className="nps-report-panel__header">
                <div>
                  <h2>Ranking por atendente</h2>
                  <p>Comparativo de satisfação da equipe com base nos atendimentos avaliados</p>
                </div>
              </header>

              {topAttendants.length > 0 ? (
                <div className="nps-report-table-wrap">
                  <table className="nps-report-table">
                    <thead>
                      <tr>
                        <th>Atendente</th>
                        <th>Avaliações</th>
                        <th>Média</th>
                        <th>NPS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAttendants.map((item) => (
                        <tr key={item.usuario_id}>
                          <td>{item.usuario_nome}</td>
                          <td>{item.total_avaliacoes}</td>
                          <td>{Number(item.media_nota || 0).toFixed(1)}</td>
                          <td>{Number(item.nps || 0).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="nps-report-panel__empty">Nenhum atendente com avaliacoes no periodo.</p>
              )}
            </article>

            <article className="nps-report-panel nps-report-panel--responses">
              <header className="nps-report-panel__header">
                <div>
                  <h2>Respostas recentes</h2>
                  <p>Últimos atendimentos avaliados, com notas e comentários do cliente</p>
                </div>
              </header>

              {report.respostas.length > 0 ? (
                <div className="nps-report-responses">
                  {report.respostas.map((item) => (
                    <article key={item.atendimento_id} className="nps-report-response-card">
                      <div className="nps-report-response-card__top">
                        <div>
                          <strong>{item.cliente_nome}</strong>
                          <span>
                            Atendimento #{item.atendimento_id}
                            {item.atendente_nome ? ` • ${item.atendente_nome}` : ""}
                          </span>
                        </div>
                        <div className={`nps-report-response-card__badge nps-report-response-card__badge--${item.classificacao}`}>
                          {classificationLabel(item.classificacao)} • {item.nota_media.toFixed(1)}
                        </div>
                      </div>

                      <div className="nps-report-response-card__meta">
                        <span>{item.cliente_telefone || "Telefone nao informado"}</span>
                        <span>{formatDateTime(getResponseDateTime(item))}</span>
                        <Link to={`/chat/${item.atendimento_id}?status=finished`}>
                          Abrir atendimento <FiExternalLink size={13} aria-hidden="true" />
                        </Link>
                      </div>

                      {item.comentarios.length > 0 ? (
                        <div className="nps-report-response-card__comments">
                          {item.comentarios.map((comment, index) => (
                            <p key={`${item.atendimento_id}-comment-${index}`}>{comment}</p>
                          ))}
                        </div>
                      ) : null}

                      {item.perguntas.length > 0 && (
                        <button
                          type="button"
                          className="nps-report-response-card__questions-toggle"
                          aria-expanded={Boolean(expandedQuestions[item.atendimento_id])}
                          aria-controls={`nps-response-questions-${item.atendimento_id}`}
                          onClick={() => setExpandedQuestions((current) => ({
                            ...current,
                            [item.atendimento_id]: !current[item.atendimento_id],
                          }))}
                        >
                          {expandedQuestions[item.atendimento_id] ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}
                          {expandedQuestions[item.atendimento_id] ? "Recolher" : "Ver perguntas"}
                        </button>
                      )}

                      <div
                        id={`nps-response-questions-${item.atendimento_id}`}
                        className="nps-report-response-card__questions"
                        hidden={!expandedQuestions[item.atendimento_id]}
                      >
                        {item.perguntas.map((question, index) => (
                          <div key={`${item.atendimento_id}-${question.pergunta_id}-${index}`}>
                            <strong>{question.pergunta || `Pergunta ${index + 1}`}</strong>
                            <span>Nota {Number(question.nota || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="nps-report-panel__empty">Nenhuma resposta de NPS encontrada para os filtros selecionados.</p>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  );
}
