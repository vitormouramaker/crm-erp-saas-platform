import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCalendar, FiClock, FiDownload, FiUser } from "react-icons/fi";
import * as XLSX from "xlsx";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useSearchParams } from "react-router-dom";
import {
  RhPontoService,
  type EmpresaUsuarioResumo,
  type PontoDia,
} from "../../service/pontoService";
import "./RelatorioPonto.css";

type BancoHorasLancamento = {
  id?: number | string;
  usuario_id?: number | string;
  data_referencia?: string;
  tipo?: string;
  minutos?: number | string;
  origem?: string;
  referencia_id?: number | string;
  observacao?: string | null;
  created_at?: string;
};

type BalancoResumo = {
  dias_processados?: number;
  minutos_previstos?: number;
  minutos_trabalhados?: number;
  minutos_abonados?: number;
  minutos_extras?: number;
  minutos_falta?: number;
  saldo_periodo_minutos?: number;
  saldo_banco_horas_minutos?: number;
};

type BalancoPayload = {
  resumo?: BalancoResumo;
  apuracoes?: PontoDia[];
  banco_horas?: BancoHorasLancamento[];
};

function formatDate(value?: string): string {
  if (!value) return "--/--/----";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--/--/----";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function formatMinutesAsHours(value?: number): string {
  const minutes = Number(value || 0);
  const signal = minutes < 0 ? "-" : "";
  const absolute = Math.abs(minutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const rest = String(absolute % 60).padStart(2, "0");
  return `${signal}${hours}:${rest}`;
}

function resolveStatusLabel(status?: string): string {
  switch (status) {
    case "incompleto":
      return "Incompleto";
    case "justificado":
      return "Justificado";
    case "feriado":
      return "Feriado";
    case "day_off":
      return "Day-off";
    case "sem_horario":
      return "Sem horário";
    case "apurado":
      return "Apurado";
    default:
      return status || "Sem status";
  }
}

function formatDateTime(value?: string): string {
  if (!value) return "--";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : null;
  }
  return null;
}

function findFirstNumericByKeys(
  payload: unknown,
  keys: string[],
  depth = 0,
): number | null {
  if (depth > 3 || !payload || typeof payload !== "object") return null;

  const current = payload as Record<string, unknown>;
  for (const key of keys) {
    if (!(key in current)) continue;
    const parsed = parseNumericValue(current[key]);
    if (parsed !== null) return parsed;
  }

  for (const value of Object.values(current)) {
    const parsed = findFirstNumericByKeys(value, keys, depth + 1);
    if (parsed !== null) return parsed;
  }

  return null;
}

function countLancamentos(payload: unknown): number {
  if (!payload) return 0;
  if (Array.isArray(payload)) return payload.length;
  if (typeof payload !== "object") return 0;

  const current = payload as Record<string, unknown>;
  const candidates = [
    current.lancamentos,
    current.itens,
    current.registros,
    current.rows,
    current.lista,
    current.obj,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.length;
  }

  return 0;
}

function extractLancamentos(payload: unknown): BancoHorasLancamento[] {
  if (Array.isArray(payload)) return payload as BancoHorasLancamento[];
  if (!payload || typeof payload !== "object") return [];

  const current = payload as Record<string, unknown>;
  const candidates = [
    current.lancamentos,
    current.itens,
    current.registros,
    current.rows,
    current.lista,
    current.obj,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as BancoHorasLancamento[];
  }

  return [];
}

function formatWeekday(value?: string): string {
  if (!value) return "--";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
  }).format(parsed);
}

function formatHour(value?: string): string {
  if (!value) return "--";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function buildRegistroResumoDia(dia: PontoDia): string[] {
  const registros = Array.isArray(dia.registros) ? dia.registros : [];
  return registros.map((registro) => {
    const hora = formatHour(registro.data_hora);
    const tipo = registro.tipo
      ? String(registro.tipo)
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
      : "Registro";
    return `${tipo} - ${hora}`;
  });
}

function setWorksheetColumns(
  worksheet: XLSX.WorkSheet,
  widths: number[],
): XLSX.WorkSheet {
  worksheet["!cols"] = widths.map((width) => ({ wch: width }));
  return worksheet;
}

export function RelatorioPonto({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const initialUsuarioId = searchParams.get("usuario_id") || "";
  const lastUsuarioIdFromUrlRef = useRef(initialUsuarioId);
  const [usuarios, setUsuarios] = useState<EmpresaUsuarioResumo[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usuarioId, setUsuarioId] = useState(initialUsuarioId);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [dias, setDias] = useState<PontoDia[]>([]);
  const [balanco, setBalanco] = useState<Record<string, unknown> | null>(null);
  const [bancoHoras, setBancoHoras] = useState<unknown>(null);

  const usuarioSelecionado = useMemo(
    () => usuarios.find((item) => String(item.id) === String(usuarioId)) || null,
    [usuarioId, usuarios],
  );

  const resumo = useMemo(() => {
    const totals = dias.reduce(
      (acc, dia) => {
        acc.previstos += Number(dia.minutos_previstos || 0);
        acc.trabalhados += Number(dia.minutos_trabalhados || 0);
        acc.abonados += Number(dia.minutos_abonados || 0);
        acc.saldo += Number(dia.saldo_minutos || 0);
        if ((dia.registros || []).length > 0) acc.comRegistro += 1;
        if (dia.status && dia.status !== "apurado") acc.comOcorrencia += 1;
        return acc;
      },
      {
        previstos: 0,
        trabalhados: 0,
        abonados: 0,
        saldo: 0,
        comRegistro: 0,
        comOcorrencia: 0,
      },
    );

    return totals;
  }, [dias]);

  const saldoBalanco = useMemo(
    () =>
      findFirstNumericByKeys(balanco, [
        "saldo_minutos",
        "saldo",
        "saldo_total_minutos",
        "saldo_periodo_minutos",
      ]),
    [balanco],
  );

  const saldoBancoHoras = useMemo(
    () =>
      findFirstNumericByKeys(bancoHoras, [
        "saldo_minutos",
        "saldo",
        "saldo_banco_horas_minutos",
        "banco_horas_saldo_minutos",
      ]),
    [bancoHoras],
  );

  const totalLancamentosBancoHoras = useMemo(
    () => countLancamentos(bancoHoras),
    [bancoHoras],
  );

  const bancoHorasLancamentos = useMemo(
    () => extractLancamentos(bancoHoras),
    [bancoHoras],
  );

  const balancoDetalhe = useMemo(() => (balanco || null) as BalancoPayload | null, [balanco]);
  const balancoResumo = balancoDetalhe?.resumo || null;
  const balancoApuracoes = Array.isArray(balancoDetalhe?.apuracoes)
    ? balancoDetalhe.apuracoes
    : [];
  const hasGeneratedReport =
    dias.length > 0 || bancoHorasLancamentos.length > 0 || Boolean(balancoResumo);
  const canBuscar = Boolean(usuarioId && dataInicio && dataFim) && !loading && !usuariosLoading;

  const carregarUsuarios = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setUsuariosLoading(true);
      const lista = await RhPontoService.listarUsuariosEmpresa(user.empresa_id);
      setUsuarios(lista);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar colaboradores",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os colaboradores.",
      });
      setUsuarios([]);
    } finally {
      setUsuariosLoading(false);
    }
  }, [addToast, user?.empresa_id]);

  useEffect(() => {
    void carregarUsuarios();
  }, [carregarUsuarios]);

  useEffect(() => {
    const nextUsuarioId = searchParams.get("usuario_id") || "";
    if (nextUsuarioId === lastUsuarioIdFromUrlRef.current) return;
    lastUsuarioIdFromUrlRef.current = nextUsuarioId;
    setUsuarioId(nextUsuarioId);
  }, [searchParams]);

  const handleBuscar = async () => {
    if (!user?.empresa_id) return;
    if (!usuarioId) {
      addToast({
        type: "warning",
        title: "Selecione um colaborador",
      });
      return;
    }
    if (!dataInicio || !dataFim) {
      addToast({
        type: "warning",
        title: "Preencha a data inicial e a data final",
      });
      return;
    }
    if (dataFim < dataInicio) {
      addToast({
        type: "warning",
        title: "Periodo invalido",
        description: "A data final nao pode ser menor que a data inicial.",
      });
      return;
    }

    try {
      setLoading(true);
      const relatorio = await RhPontoService.relatorioPonto(
        user.empresa_id,
        Number(usuarioId),
        dataInicio,
        dataFim,
      );
      setDias(relatorio.dias || []);
      const [balancoResult, bancoHorasResult] = await Promise.allSettled([
        RhPontoService.balancoPonto({
          empresaId: user.empresa_id,
          usuarioId: Number(usuarioId),
          dataInicio,
          dataFim,
        }),
        RhPontoService.bancoHoras({
          empresaId: user.empresa_id,
          usuarioId: Number(usuarioId),
          dataInicio,
          dataFim,
        }),
      ]);

      setBalanco(
        balancoResult.status === "fulfilled"
          ? (balancoResult.value as Record<string, unknown>)
          : null,
      );
      setBancoHoras(
        bancoHorasResult.status === "fulfilled" ? bancoHorasResult.value : null,
      );
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar relatorio",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar o relatorio.",
      });
      setDias([]);
      setBalanco(null);
      setBancoHoras(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLimparPesquisa = () => {
    if (loading) return;
    setUsuarioId("");
    setDataInicio("");
    setDataFim("");
    setDias([]);
    setBalanco(null);
    setBancoHoras(null);
  };

  const handleExportarRelatorio = () => {
    if (!hasGeneratedReport) return;

    const colaboradorNome =
      usuarioSelecionado?.nome || usuarioSelecionado?.name || "Colaborador";
    const workbook = XLSX.utils.book_new();

    const resumoRows: Array<Array<string | number>> = [
      ["Relatorio de ponto"],
      ["Colaborador", colaboradorNome],
      ["Periodo", `${formatDate(dataInicio)} ate ${formatDate(dataFim)}`],
      [],
      ["Resumo do periodo", ""],
      ["Dias no periodo", dias.length],
      ["Dias com registro", resumo.comRegistro],
      ["Dias com ocorrencia", resumo.comOcorrencia],
      ["Carga prevista", formatMinutesAsHours(resumo.previstos)],
      ["Horas trabalhadas", formatMinutesAsHours(resumo.trabalhados)],
      ["Horas abonadas", formatMinutesAsHours(resumo.abonados)],
      ["Saldo do periodo", formatMinutesAsHours(resumo.saldo)],
      ["Saldo balanco", saldoBalanco === null ? "--:--" : formatMinutesAsHours(saldoBalanco)],
      [
        "Saldo banco de horas",
        saldoBancoHoras === null ? "--:--" : formatMinutesAsHours(saldoBancoHoras),
      ],
      ["Lancamentos banco de horas", totalLancamentosBancoHoras],
    ];

    if (balancoResumo) {
      resumoRows.push(
        [],
        ["Resumo do balanco", ""],
        ["Dias processados", Number(balancoResumo.dias_processados || 0)],
        ["Minutos extras", formatMinutesAsHours(balancoResumo.minutos_extras)],
        ["Minutos falta", formatMinutesAsHours(balancoResumo.minutos_falta)],
        [
          "Saldo periodo (balanco)",
          formatMinutesAsHours(balancoResumo.saldo_periodo_minutos),
        ],
        [
          "Saldo banco horas (balanco)",
          formatMinutesAsHours(balancoResumo.saldo_banco_horas_minutos),
        ],
        ["Apuracoes no balanco", balancoApuracoes.length],
      );
    }

    const resumoSheet = setWorksheetColumns(
      XLSX.utils.aoa_to_sheet(resumoRows),
      [28, 28],
    );
    XLSX.utils.book_append_sheet(workbook, resumoSheet, "Resumo");

    const diasRows = dias.map((dia) => {
      const registrosResumo = buildRegistroResumoDia(dia);
      return {
        Data: formatDate(dia.data_referencia),
        Dia: formatWeekday(dia.data_referencia),
        Status: resolveStatusLabel(dia.status),
        "Qtd. registros": (dia.registros || []).length,
        "Batida 1": registrosResumo[0] || "--",
        "Batida 2": registrosResumo[1] || "--",
        "Batida 3": registrosResumo[2] || "--",
        "Batida 4": registrosResumo[3] || "--",
        "Batida 5": registrosResumo[4] || "--",
        "Batida 6": registrosResumo[5] || "--",
        Previsto: formatMinutesAsHours(dia.minutos_previstos),
        Trabalhado: formatMinutesAsHours(dia.minutos_trabalhados),
        Abonado: formatMinutesAsHours(dia.minutos_abonados),
        Saldo: formatMinutesAsHours(dia.saldo_minutos),
      };
    });

    const diasSheet = setWorksheetColumns(
      XLSX.utils.json_to_sheet(diasRows.length ? diasRows : [
        {
          Data: "",
          Dia: "",
          Status: "",
          "Qtd. registros": "",
          "Batida 1": "",
          "Batida 2": "",
          "Batida 3": "",
          "Batida 4": "",
          "Batida 5": "",
          "Batida 6": "",
          Previsto: "",
          Trabalhado: "",
          Abonado: "",
          Saldo: "",
        },
      ]),
      [14, 18, 18, 14, 22, 22, 22, 22, 22, 22, 12, 12, 12, 12],
    );
    XLSX.utils.book_append_sheet(workbook, diasSheet, "Dias");

    const registrosRows = dias.flatMap((dia) =>
      (dia.registros || []).map((registro, index) => ({
        Data: formatDate(dia.data_referencia),
        Dia: formatWeekday(dia.data_referencia),
        Ordem: index + 1,
        Tipo: String(registro.tipo || "--")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase()),
        Hora: formatHour(registro.data_hora),
        "Data/hora completa": formatDateTime(registro.data_hora),
        Latitude: registro.latitude ?? "--",
        Longitude: registro.longitude ?? "--",
        "Precisao metros": registro.precisao_metros ?? "--",
        "Status geolocalizacao": registro.geolocalizacao_status || "--",
        Origem: registro.origem_registro || "--",
        "IP publico": registro.ip_publico || "--",
        "Faixa IP": registro.faixa_ip || "--",
      })),
    );

    const registrosSheet = setWorksheetColumns(
      XLSX.utils.json_to_sheet(registrosRows.length ? registrosRows : [
        {
          Data: "",
          Dia: "",
          Ordem: "",
          Tipo: "",
          Hora: "",
          "Data/hora completa": "",
          Latitude: "",
          Longitude: "",
          "Precisao metros": "",
          "Status geolocalizacao": "",
          Origem: "",
          "IP publico": "",
          "Faixa IP": "",
        },
      ]),
      [14, 18, 8, 18, 10, 20, 14, 14, 14, 22, 18, 16, 18],
    );
    XLSX.utils.book_append_sheet(workbook, registrosSheet, "Registros");

    const bancoHorasRows = bancoHorasLancamentos.map((item) => ({
      Data: formatDate(item.data_referencia),
      Tipo: item.tipo || "--",
      Horas: formatMinutesAsHours(Number(item.minutos || 0)),
      Origem: item.origem || "--",
      Referencia: item.referencia_id || "--",
      Observacao: item.observacao || "--",
      "Criado em": formatDateTime(item.created_at),
    }));

    const bancoHorasSheet = setWorksheetColumns(
      XLSX.utils.json_to_sheet(bancoHorasRows.length ? bancoHorasRows : [
        {
          Data: "",
          Tipo: "",
          Horas: "",
          Origem: "",
          Referencia: "",
          Observacao: "",
          "Criado em": "",
        },
      ]),
      [14, 18, 12, 18, 14, 42, 20],
    );
    XLSX.utils.book_append_sheet(workbook, bancoHorasSheet, "BancoHoras");

    XLSX.writeFile(
      workbook,
      `relatorio_ponto_${String(colaboradorNome)
        .toLowerCase()
        .replace(/\s+/g, "_")}_${dataInicio}_${dataFim}.xlsx`,
    );
  };

  return (
    <div
      className={
        embedded
          ? "rh-report-page rh-report-page--embedded"
          : "rh-report-page"
      }
    >
      {!embedded && <MobileHeader title="Relatório de ponto" />}

      {!embedded && (
        <header className="rh-report-header">
          <div className="rh-report-header__content">
            <h1>Relatório de ponto</h1>
            <p>Consulte o fechamento por período e acompanhe o status diário.</p>
          </div>
        </header>
      )}

      <div
        className={
          embedded
            ? "rh-report-content rh-report-content--embedded"
            : "rh-report-content"
        }
      >
        <section className="rh-report-filters">
          <div className="rh-report-filters__grid">
            <div className="rh-report-field">
              <label htmlFor="rh-report-usuario">
                <FiUser size={16} />
                Colaborador
              </label>
              <select
                id="rh-report-usuario"
                value={usuarioId}
                onChange={(event) => setUsuarioId(event.target.value)}
                disabled={usuariosLoading || loading}
              >
                {usuarios.length === 0 ? (
                  <option value="">
                    {usuariosLoading ? "Carregando..." : "Nenhum colaborador disponível"}
                  </option>
                ) : (
                  <>
                    <option value="">Selecione um colaborador</option>
                    {usuarios.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.nome || item.name || `Usuário ${item.id}`}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div className="rh-report-field">
              <label htmlFor="rh-report-data-inicio">
                <FiCalendar size={16} />
                Data inicial
              </label>
              <input
                id="rh-report-data-inicio"
                type="date"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="rh-report-field">
              <label htmlFor="rh-report-data-fim">
                <FiCalendar size={16} />
                Data final
              </label>
              <input
                id="rh-report-data-fim"
                type="date"
                value={dataFim}
                onChange={(event) => setDataFim(event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="rh-report-actions">
              <button
                className="rh-report-button rh-report-button--secondary"
                type="button"
                onClick={handleLimparPesquisa}
                disabled={loading}
              >
                Limpar pesquisa
              </button>
              {hasGeneratedReport && (
                <button
                  className="rh-report-button rh-report-button--secondary"
                  type="button"
                  onClick={handleExportarRelatorio}
                  disabled={loading}
                >
                  <FiDownload size={16} />
                  Exportar Excel
                </button>
              )}
              <button
                className="rh-report-button rh-report-button--primary"
                type="button"
                onClick={() => void handleBuscar()}
                disabled={!canBuscar}
              >
                {loading ? "Carregando..." : "Gerar relatório"}
              </button>
            </div>
          </div>
        </section>

        <div
          className={
            embedded ? "rh-report-wrapper rh-report-wrapper--embedded" : "rh-report-wrapper"
          }
        >
        <section className="rh-report-summary">
          <article className="rh-report-summary__card">
            <span>Dias no período</span>
            <strong>{dias.length}</strong>
          </article>
          <article className="rh-report-summary__card">
            <span>Dias com registro</span>
            <strong>{resumo.comRegistro}</strong>
          </article>
          <article className="rh-report-summary__card">
            <span>Horas trabalhadas</span>
            <strong>{formatMinutesAsHours(resumo.trabalhados)}</strong>
          </article>
          <article className="rh-report-summary__card">
            <span>Horas abonadas</span>
            <strong>{formatMinutesAsHours(resumo.abonados)}</strong>
          </article>
          <article className="rh-report-summary__card">
            <span>Carga prevista</span>
            <strong>{formatMinutesAsHours(resumo.previstos)}</strong>
          </article>
          <article className="rh-report-summary__card">
            <span>Saldo do período</span>
            <strong>{formatMinutesAsHours(resumo.saldo)}</strong>
          </article>
          <article className="rh-report-summary__card">
            <span>Saldo balanço</span>
            <strong>
              {saldoBalanco === null ? "--:--" : formatMinutesAsHours(saldoBalanco)}
            </strong>
          </article>
          <article className="rh-report-summary__card">
            <span>Saldo banco horas</span>
            <strong>
              {saldoBancoHoras === null ? "--:--" : formatMinutesAsHours(saldoBancoHoras)}
            </strong>
          </article>
          <article className="rh-report-summary__card">
            <span>Lançamentos banco horas</span>
            <strong>{totalLancamentosBancoHoras}</strong>
          </article>
        </section>

        <section className="rh-report-detail-grid">
          <article className="rh-report-table-card rh-report-table-card--balance">
            <div className="rh-report-table-card__header">
              <div>
                <h2>Resumo do balanço</h2>
                <p>Consolidado retornado pelo endpoint de balanço do periodo.</p>
              </div>
            </div>

            {balancoResumo ? (
              <div className="rh-report-balance-grid">
                <article className="rh-report-balance-item">
                  <span>Dias processados</span>
                  <strong>{Number(balancoResumo.dias_processados || 0)}</strong>
                </article>
                <article className="rh-report-balance-item">
                  <span>Minutos extras</span>
                  <strong>{formatMinutesAsHours(balancoResumo.minutos_extras)}</strong>
                </article>
                <article className="rh-report-balance-item">
                  <span>Minutos falta</span>
                  <strong>{formatMinutesAsHours(balancoResumo.minutos_falta)}</strong>
                </article>
                <article className="rh-report-balance-item">
                  <span>Saldo periodo</span>
                  <strong>{formatMinutesAsHours(balancoResumo.saldo_periodo_minutos)}</strong>
                </article>
                <article className="rh-report-balance-item">
                  <span>Saldo banco horas</span>
                  <strong>
                    {formatMinutesAsHours(balancoResumo.saldo_banco_horas_minutos)}
                  </strong>
                </article>
                <article className="rh-report-balance-item">
                  <span>Apurações</span>
                  <strong>{balancoApuracoes.length}</strong>
                </article>
              </div>
            ) : (
              <div className="rh-report-empty">
                <p>Nenhum resumo de balanço disponível para o período.</p>
              </div>
            )}
          </article>
          <div className="rh-report-detail-grid__stack">
          <article className="rh-report-table-card">
            <div className="rh-report-table-card__header">
              <div>
                <h2>Banco de horas</h2>
              </div>
              <div className="rh-report-table-card__meta">
                <FiClock size={16} />
                <span>{bancoHorasLancamentos.length} lançamento(s)</span>
              </div>
            </div>

            {bancoHorasLancamentos.length === 0 ? (
              <div className="rh-report-empty">
                <p>Nenhum lançamento de banco de horas encontrado.</p>
              </div>
            ) : (
              <div className="rh-report-table-wrapper">
                <table className="rh-report-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Minutos</th>
                      <th>Origem</th>
                      <th>Referencia</th>
                      <th>Observação</th>
                      <th>Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bancoHorasLancamentos.map((item) => (
                      <tr key={String(item.id || `${item.data_referencia}-${item.created_at}`)}>
                        <td>{formatDate(item.data_referencia)}</td>
                        <td>{item.tipo || "--"}</td>
                        <td>{formatMinutesAsHours(Number(item.minutos || 0))}</td>
                        <td>{item.origem || "--"}</td>
                        <td>{item.referencia_id || "--"}</td>
                        <td>{item.observacao || "--"}</td>
                        <td>{formatDateTime(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
          <article className="rh-report-table-card">
          <div className="rh-report-table-card__header">
            <div>
              <h2>
                {usuarioSelecionado?.nome || usuarioSelecionado?.name || "Colaborador"}
              </h2>
              <p>
                Período de {formatDate(dataInicio)} até {formatDate(dataFim)}
              </p>
            </div>
            <div className="rh-report-table-card__meta">
              <FiClock size={16} />
              <span>{resumo.comOcorrencia} ocorrência(s)</span>
            </div>
          </div>

          {dias.length === 0 ? (
            <div className="rh-report-empty">
              <p>Nenhum dia encontrado para o período selecionado.</p>
            </div>
          ) : (
            <div className="rh-report-table-wrapper">
              <table className="rh-report-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Registros</th>
                    <th>Previsto</th>
                    <th>Trabalhado</th>
                    <th>Abonado</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((dia) => (
                    <tr key={`${dia.data_referencia}-${dia.id || ""}`}>
                      <td>{formatDate(dia.data_referencia)}</td>
                      <td>{resolveStatusLabel(dia.status)}</td>
                      <td>{(dia.registros || []).length}</td>
                      <td>{formatMinutesAsHours(dia.minutos_previstos)}</td>
                      <td>{formatMinutesAsHours(dia.minutos_trabalhados)}</td>
                      <td>{formatMinutesAsHours(dia.minutos_abonados)}</td>
                      <td>{formatMinutesAsHours(dia.saldo_minutos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </article>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}

