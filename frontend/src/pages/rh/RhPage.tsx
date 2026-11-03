import { useCallback, useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import { useNavigate } from "react-router-dom";
import { FiCalendar, FiRefreshCw } from "react-icons/fi";
import type { Value } from "react-calendar/dist/shared/types.js";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Modal } from "../../components/common/Modal/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  RhPontoService,
  type JustificativaTipo,
  type PontoDia,
  type PontoRegistro,
} from "../../service/pontoService";
import {
  collectPontoRegistroMetadata,
  describeGeolocalizacaoStatus,
  hasCapturedGeolocation,
} from "../../utils/pontoRegistroMetadata";
import "react-calendar/dist/Calendar.css";
import "./RhPage.css";

const JUSTIFICATIVA_DESCRICAO_MAX_LENGTH = 500;

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value?: string): Date | null {
  if (!value) return null;

  const dateMatch = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    const normalized = new Date(`${dateMatch[1]}T00:00:00`);
    return Number.isNaN(normalized.getTime()) ? null : normalized;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateKey(value?: string): string | null {
  if (!value) return null;

  const dateMatch = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return dateMatch[1];

  const parsedDate = parseDateValue(value);
  return parsedDate ? toInputDate(parsedDate) : null;
}

function formatDateLabel(value?: string): string {
  const parsedDate = parseDateValue(value);
  if (!parsedDate) return "--/--/----";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsedDate);
}

function formatTimeLabel(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMinutesAsHours(value?: number): string {
  const minutes = Number(value || 0);
  const signal = minutes < 0 ? "-" : "";
  const absMinutes = Math.abs(minutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const rest = String(absMinutes % 60).padStart(2, "0");
  return `${signal}${hours}:${rest}`;
}

function normalizeLabel(tipo: string, index: number): string {
  if (tipo.startsWith("entrada")) return "Entrada";
  if (tipo.startsWith("saida")) return "Saída";
  return index % 2 === 0 ? "Entrada" : "Saída";
}

function formatBatidaTypeLabel(tipo?: string): string {
  const normalized = String(tipo || "").trim().toLowerCase();

  switch (normalized) {
    case "entrada_1":
      return "Entrada 1";
    case "saida_1":
      return "Saída 1";
    case "entrada_2":
      return "Entrada 2";
    case "saida_2":
      return "Saída 2";
    case "entrada":
      return "Entrada";
    case "saida":
      return "Saída";
    default:
      if (!normalized) return "--";
      return normalized
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function resolveStatusMessage(
  diaSelecionado: PontoDia | null,
  infoDia: unknown,
): string {
  if (infoDia && typeof infoDia === "object") {
    const current = infoDia as Record<string, unknown>;
    if (current.day_off) return "Day-off registrado. Bater ponto bloqueado.";
    if (current.feriado) return "Dia marcado como feriado para a empresa.";
    if (current.horario === null) return "Sem horário de trabalho vinculado.";
  }

  switch (diaSelecionado?.status) {
    case "incompleto":
      return "Registros incompletos para a jornada.";
    case "justificado":
      return "Dia com justificativa aprovada.";
    case "feriado":
      return "Dia marcado como feriado.";
    case "day_off":
      return "Day-off aprovado para esta data.";
    case "apurado":
      return "Dia apurado sem ocorrências.";
    case "sem_horario":
      return "Nenhum horário de trabalho vinculado para este dia.";
      // pendente
    default: 
      return "Dia com um ou mais registros pendentes.";
  }
}

export function RhPage() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDayInfo, setSelectedDayInfo] = useState<unknown>(null);
  const [monthReport, setMonthReport] = useState<PontoDia[]>([]);
  const [podeBater, setPodeBater] = useState(true);
  const [isJustificativaOpen, setIsJustificativaOpen] = useState(false);
  const [justificativaTipos, setJustificativaTipos] = useState<JustificativaTipo[]>([]);
  const [justificativaTiposLoading, setJustificativaTiposLoading] = useState(false);
  const [justificativaTipo, setJustificativaTipo] = useState("");
  const [justificativaDataInicio, setJustificativaDataInicio] = useState("");
  const [justificativaDataFim, setJustificativaDataFim] = useState("");
  const [justificativaDescricao, setJustificativaDescricao] = useState("");
  const [justificativaFile, setJustificativaFile] = useState<File | null>(null);
  const [justificativaLoading, setJustificativaLoading] = useState(false);

  const canManage = hasPermission("rh.point.manage");
  const today = useMemo(() => toInputDate(new Date()), []);
  const selectedDateString = useMemo(
    () => toInputDate(selectedDate),
    [selectedDate],
  );
  const isToday = selectedDateString === today;

  const loadMonth = useCallback(
    async (referenceDate: Date) => {
      if (!user?.empresa_id || !user?.id) return;

      const year = referenceDate.getFullYear();
      const month = referenceDate.getMonth();
      const start = toInputDate(new Date(year, month, 1));
      const end = toInputDate(new Date(year, month + 1, 0));

      setLoadingRelatorio(true);

      try {
        const report = await RhPontoService.relatorioPonto(
          user.empresa_id,
          user.id,
          start,
          end,
        );
        setMonthReport(report.dias || []);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Erro ao carregar o relatório mensal.";
        setMensagem(errorMessage);
        setMonthReport([]);
      } finally {
        setLoadingRelatorio(false);
      }
    },
    [user?.empresa_id, user?.id],
  );

  const loadSelectedDayInfo = useCallback(async () => {
    if (!user?.empresa_id || !user?.id) return;

    try {
      const dayInfo = await RhPontoService.validarDayOff(
        user.empresa_id,
        user.id,
        selectedDateString,
      );
      console.log("[RH][RhPage] validarDayOff", {
        empresaId: user.empresa_id,
        usuarioId: user.id,
        dataReferencia: selectedDateString,
        dayInfo,
      });

      setSelectedDayInfo(dayInfo);
      const canPunch = Boolean(dayInfo.permite_batida) && isToday;
      console.log("[RH][RhPage] estadoBotaoRegistrar", {
        isToday,
        permite_batida: dayInfo.permite_batida,
        podeBater: canPunch,
      });
      setPodeBater(canPunch);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erro ao carregar os dados do dia.";
      setMensagem(errorMessage);
      setSelectedDayInfo(null);
      setPodeBater(false);
    }
  }, [isToday, selectedDateString, user?.empresa_id, user?.id]);

  useEffect(() => {
    setMensagem("");
    void loadMonth(selectedDate);
  }, [loadMonth, selectedDate]);

  useEffect(() => {
    setMensagem("");
    void loadSelectedDayInfo();
  }, [loadSelectedDayInfo]);

  useEffect(() => {
    if (!mensagem) return;
    addToast({
      type: /sucesso|recalculado|enviada/i.test(mensagem) ? "success" : "error",
      title: mensagem,
    });
    setMensagem("");
  }, [addToast, mensagem]);

  const selectedDay = useMemo(
    () =>
      monthReport.find(
        (item) => normalizeDateKey(item?.data_referencia) === selectedDateString,
      ) || null,
    [monthReport, selectedDateString],
  );

  const registros = selectedDay?.registros || [];
  const ultimoRegistro =
    registros.length > 0 ? registros[registros.length - 1] : null;
  const statusMessage = resolveStatusMessage(selectedDay, selectedDayInfo);
  const saldoDia = formatMinutesAsHours(selectedDay?.saldo_minutos);
  const horasTrabalhadas = formatMinutesAsHours(
    selectedDay?.minutos_trabalhados,
  );
  const saldoMes = formatMinutesAsHours(
    monthReport.reduce((acc, item) => acc + Number(item.saldo_minutos || 0), 0),
  );
  const justificativaTipoSelecionado =
    justificativaTipos.find(
      (item) => String(item.id) === String(justificativaTipo),
    ) || null;
  const descricaoObrigatoria = Boolean(justificativaTipoSelecionado?.has_text);
  const anexoObrigatorio = Boolean(justificativaTipoSelecionado?.has_anexo);

  const handleCalendarChange = (value: Value) => {
    if (value instanceof Date) {
      setSelectedDate(value);
      return;
    }

    if (Array.isArray(value) && value[0] instanceof Date) {
      setSelectedDate(value[0]);
    }
  };

  const handleRegistrar = async () => {
    if (!user?.empresa_id || !user?.id) {
      setMensagem("Sessão inválida. Faça login novamente.");
      return;
    }

    try {
      setLoading(true);
      setMensagem("");
      console.log("[RH][RhPage] tentativaRegistrarBatida", {
        empresaId: user.empresa_id,
        usuarioId: user.id,
        selectedDateString,
        isToday,
        podeBater,
      });
      const pontoMetadata = await collectPontoRegistroMetadata({
        origem_registro: "web_colaborador",
        registrado_por_usuario_id: user.id,
        solicitarGeolocalizacao: true,
      });
      if (!hasCapturedGeolocation(pontoMetadata)) {
        setMensagem(
          `Nao foi possivel registrar o ponto. ${describeGeolocalizacaoStatus(
            pontoMetadata.geolocalizacao_status,
          )} Ative a localizacao do dispositivo e tente novamente.`,
        );
        return;
      }
      const response = await RhPontoService.registrarBatida(
        user.empresa_id,
        user.id,
        undefined,
        undefined,
        pontoMetadata,
      );
      console.log("[RH][RhPage] registrarBatida:response", response);

      const registrosAtualizados = response.contexto?.registros || [];
      const apuracao = response.apuracao;

      if (registrosAtualizados.length > 0 || apuracao) {
        setMonthReport((current) => {
          const nextDay: PontoDia = {
            ...(current.find(
              (item) => normalizeDateKey(item.data_referencia) === selectedDateString,
            ) || {}),
            ...apuracao,
            data_referencia:
              normalizeDateKey(apuracao?.data_referencia) || selectedDateString,
            registros: registrosAtualizados,
          };

          const filtered = current.filter(
            (item) => normalizeDateKey(item.data_referencia) !== selectedDateString,
          );

          return [...filtered, nextDay].sort((a, b) =>
            String(normalizeDateKey(a.data_referencia)).localeCompare(
              String(normalizeDateKey(b.data_referencia)),
            ),
          );
        });
      }

      if (response.contexto) {
        setSelectedDayInfo((prev: unknown) => ({
          ...(prev && typeof prev === "object" ? prev : {}),
          day_off: response.contexto?.day_off ?? null,
          feriado: response.contexto?.feriado ?? null,
          horario: response.contexto?.horario ?? null,
        }));
      }

      await loadMonth(selectedDate);
      setMensagem(
        `Batida registrada com sucesso. ${describeGeolocalizacaoStatus(
          pontoMetadata.geolocalizacao_status,
        )}`,
      );
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o ponto.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRecalcular = async () => {
    if (!user?.empresa_id || !user?.id || !canManage) return;

    try {
      setLoading(true);
      setMensagem("");
      await RhPontoService.recalcularDia(
        user.empresa_id,
        user.id,
        selectedDateString,
      );
      await Promise.all([loadSelectedDayInfo(), loadMonth(selectedDate)]);
      setMensagem("Dia recalculado.");
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Erro ao recalcular a apuracao do dia.",
      );
    } finally {
      setLoading(false);
    }
  };

  const resetJustificativaForm = () => {
    setJustificativaTipo("");
    setJustificativaDataInicio(selectedDateString);
    setJustificativaDataFim(selectedDateString);
    setJustificativaDescricao("");
    setJustificativaFile(null);
  };

  const loadJustificativaTipos = useCallback(async () => {
    try {
      setJustificativaTiposLoading(true);
      const tipos = await RhPontoService.listarJustificativaTipos();
      setJustificativaTipos(tipos);
      setJustificativaTipo((current) =>
        current || (tipos.length > 0 ? String(tipos[0].id) : ""),
      );
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Erro ao carregar os tipos de justificativa.",
      );
      setJustificativaTipos([]);
    } finally {
      setJustificativaTiposLoading(false);
    }
  }, []);

  const handleOpenJustificativa = () => {
    resetJustificativaForm();
    setIsJustificativaOpen(true);
    if (justificativaTipos.length === 0) {
      void loadJustificativaTipos();
    }
  };

  const handleCloseJustificativa = () => {
    if (justificativaLoading) return;
    setIsJustificativaOpen(false);
    resetJustificativaForm();
  };

  const handleEnviarJustificativa = async () => {
    if (!user?.empresa_id || !user?.id) {
      setMensagem("Sessão inválida. Faça login novamente.");
      return;
    }

    if (!justificativaTipo) {
      setMensagem("Selecione um tipo de justificativa.");
      return;
    }

    if (!justificativaDataInicio || !justificativaDataFim) {
      setMensagem("Preencha a data de início e a data de fim.");
      return;
    }

    if (justificativaDataFim < justificativaDataInicio) {
      setMensagem("A data de fim não pode ser menor que a data de início.");
      return;
    }

    if (descricaoObrigatoria && !justificativaDescricao.trim()) {
      setMensagem("Este tipo de justificativa exige o preenchimento da descrição.");
      return;
    }

    if (justificativaDescricao.length > JUSTIFICATIVA_DESCRICAO_MAX_LENGTH) {
      setMensagem(
        `A descrição deve ter no máximo ${JUSTIFICATIVA_DESCRICAO_MAX_LENGTH} caracteres.`,
      );
      return;
    }

    if (anexoObrigatorio && !justificativaFile) {
      setMensagem("Este tipo de justificativa exige o envio de um anexo.");
      return;
    }

    try {
      setJustificativaLoading(true);
      setMensagem("");

      await RhPontoService.adicionarJustificativa({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        tipoJustificativaId: justificativaTipo,
        dataInicio: justificativaDataInicio,
        dataFim: justificativaDataFim,
        descricao: justificativaDescricao,
        file: justificativaFile,
      });

      await Promise.all([loadSelectedDayInfo(), loadMonth(selectedDate)]);
      setMensagem("Justificativa enviada com sucesso.");
      handleCloseJustificativa();
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a justificativa.",
      );
    } finally {
      setJustificativaLoading(false);
    }
  };

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== "month") return null;

    const key = toInputDate(date);
    const currentDay = monthReport.find(
      (item) => normalizeDateKey(item.data_referencia) === key,
    );

    if (!currentDay) return null;
    if (currentDay.day_off || currentDay.status === "day_off")
      return "rh-calendar__tile--dayoff";
    if (currentDay.status === "feriado") return "rh-calendar__tile--holiday";
    if (Number(currentDay.saldo_minutos || 0) < 0)
      return "rh-calendar__tile--negative";
    if ((currentDay.registros || []).length > 0)
      return "rh-calendar__tile--worked";
    return null;
  };

  return (
    <div className="rh-page">
      <MobileHeader title="Registro de Ponto" />
      <header className="rh-module-header">
        <div className="rh-module-header__content">
          <h1>Controle de ponto</h1>
          <p className="rh-module-header__subtitle">
            Consulte o calendário, acompanhe o saldo e registre a jornada do dia.
          </p>
        </div>

        {canManage && (
          <button className="rh-manage-button" onClick={() => navigate("/rh/admin")}>
            Gestão de RH
          </button>
        )}
      </header>

      <div className="rh-home-root">

        <section className="rh-main-layout">
          <div className="rh-primeira-linha">
            <div className="rh-content-column">
              <article className="rh-card rh-card--calendar">
                <div className="rh-title-calendar">
                  <FiCalendar size={18} />
                  <h3>Calendário</h3>
                </div>

                <Calendar
                  locale="pt-BR"
                  onChange={handleCalendarChange}
                  onActiveStartDateChange={({ activeStartDate }) => {
                    if (activeStartDate) {
                      void loadMonth(activeStartDate);
                    }
                  }}
                  value={selectedDate}
                  tileClassName={tileClassName}
                />

                <div className="rh-relatorio">
                  <p className="rh-relatorio__label">Data selecionada</p>
                  <strong>{formatDateLabel(selectedDateString)}</strong>
                </div>
              </article>
            </div>

            <div className="rh-ponto-column">
              <article className="rh-card rh-card--ponto">
                <div className="rh-saldo-dia-hero">
                  <h2 className="rh-saldo-titulo">Saldo do dia</h2>
                  <p
                    className={`rh-saldo-valor ${
                      saldoDia.startsWith("-")
                        ? "rh-saldo-valor--negativo"
                        : "rh-saldo-valor--positivo"
                    }`}
                  >
                    {saldoDia}
                  </p>
                </div>

                <div className="rh-acoes-principais">
                  <button
                    className="rh-page__button rh-page__button--primary rh-page__button--cta rh-page__button--block"
                    onClick={handleRegistrar}
                    disabled={loading || loadingRelatorio || !podeBater}
                  >
                    {loading ? "Registrando..." : "Registrar ponto"}
                  </button>

                  {canManage && (
                    <button
                      className="rh-page__button rh-page__button--block"
                      onClick={handleRecalcular}
                      disabled={loading || loadingRelatorio}
                    >
                      <FiRefreshCw size={16} />
                      Recalcular dia
                    </button>
                  )}

                  <div className="rh-saldo-mes">
                    <p>
                      Horas trabalhadas: <span>{horasTrabalhadas}</span>
                    </p>
                  </div>
                  <div className="rh-saldo-mes">
                    <p>
                      Saldo do mês: <span>{saldoMes}</span>
                    </p>
                  </div>
                  <div className="rh-saldo-mes">
                    <p>
                      Status: <span>{statusMessage}</span>
                    </p>
                  </div>
                </div>

                {ultimoRegistro ? (
                  <>
                    <div className="rh-detalhes-ultima-batida">
                      <h3 className="rh-secao-titulo">Último registro</h3>
                      <div className="rh-detalhes-grid">
                        <div>
                          <h4 className="rh-detalhe-titulo">Registro</h4>
                          <p className="rh-detalhe-valor">
                            {formatTimeLabel(ultimoRegistro.data_hora)}
                          </p>
                        </div>
                        <div>
                          <h4 className="rh-detalhe-titulo">Tipo</h4>
                          <p className="rh-detalhe-valor">
                            {normalizeLabel(
                              ultimoRegistro.tipo || "",
                              registros.length - 1,
                            )}
                          </p>
                        </div>
                        <div>
                          <h4 className="rh-detalhe-titulo">Referência</h4>
                          <p className="rh-detalhe-valor">
                            {formatDateLabel(selectedDateString)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rh-historico-dia">
                      <h3 className="rh-secao-titulo">Registros do dia</h3>
                      <ul className="rh-lista-historico">
                        {registros.map((registro: PontoRegistro, index) => {
                          const label = normalizeLabel(
                            registro.tipo || "",
                            index,
                          );

                          return (
                            <li key={registro.id} className="rh-historico-item">
                              <div className="rh-historico-info">
                                <span
                                  className={`rh-tag ${
                                    label === "Entrada"
                                      ? "rh-tag-entrada"
                                      : "rh-tag-saida"
                                  }`}
                                >
                                  {label}
                                </span>
                                <span className="rh-historico-hora">
                                  {formatTimeLabel(registro.data_hora)}
                                </span>
                              </div>
                              <span className="rh-historico-tipo">
                                {formatBatidaTypeLabel(registro.tipo)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="rh-mensagem-vazio">
                    <p>Você ainda não registrou nenhum ponto nesta data.</p>
                  </div>
                )}

                <div className="rh-acoes-secundarias">
                  <button
                    className="rh-page__button rh-page__button--secondary-accent rh-page__button--block"
                    onClick={handleOpenJustificativa}
                    type="button"
                  >
                    Justificar este dia
                  </button>
                  {!isToday && (
                    <p className="rh-acoes-secundarias-text">
                      O registro de ponto fica habilitado apenas para a data
                      atual.
                    </p>
                  )}
                </div>
              </article>
            </div>
          </div>
{/* 
          <div className="rh-tabelas-extras">
            <article className="rh-card rh-tabela-box">
              <h3>Resumo do mÃªs</h3>
              <div className="rh-scrollable-tabela">
                <table className="rh-tabela-extra">
                  <thead>
                    <tr>
                      <th>Indicador</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Dias com registro</td>
                      <td>{diasComRegistro.length}</td>
                    </tr>
                    <tr>
                      <td>Saldo acumulado</td>
                      <td>{saldoMes}</td>
                    </tr>
                    <tr>
                      <td>Horas trabalhadas no dia</td>
                      <td>{horasTrabalhadas}</td>
                    </tr>
                    <tr>
                      <td>Status da data selecionada</td>
                      <td>{selectedDay?.status || "sem apura??o"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rh-card rh-tabela-box">
              <h3>Ocorrencias do periodo</h3>
              <div className="rh-scrollable-tabela">
                <table className="rh-tabela-extra">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasComOcorrencia.length > 0 ? (
                      diasComOcorrencia.map((dia) => (
                        <tr key={dia.data_referencia}>
                          <td>
                            {formatShortDateLabel(dia.data_referencia || today)}
                          </td>
                          <td>{dia.status || "apurado"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2}>
                          Nenhuma ocorrÃªncia encontrada neste mÃªs.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </div> */}
        </section>
      </div>

      <Modal
        isOpen={isJustificativaOpen}
        onClose={handleCloseJustificativa}
        title="Adicionar justificativa"
      >
        <div className="rh-justificativa-form">
          <div className="rh-justificativa-form__dates">
            <div className="rh-justificativa-form__group">
              <label htmlFor="rh-justificativa-data-inicio">Data início</label>
              <input
                id="rh-justificativa-data-inicio"
                type="date"
                value={justificativaDataInicio}
                onChange={(event) => setJustificativaDataInicio(event.target.value)}
                disabled={justificativaLoading}
              />
            </div>

            <div className="rh-justificativa-form__group">
              <label htmlFor="rh-justificativa-data-fim">Data fim</label>
              <input
                id="rh-justificativa-data-fim"
                type="date"
                value={justificativaDataFim}
                onChange={(event) => setJustificativaDataFim(event.target.value)}
                disabled={justificativaLoading}
              />
            </div>
          </div>

          <div className="rh-justificativa-form__group">
            <label htmlFor="rh-justificativa-tipo">Tipo</label>
            <select
              id="rh-justificativa-tipo"
              value={justificativaTipo}
              onChange={(event) => setJustificativaTipo(event.target.value)}
              disabled={justificativaTiposLoading || justificativaLoading}
            >
              {justificativaTipos.length === 0 ? (
                <option value="">
                  {justificativaTiposLoading ? "Carregando..." : "Nenhum tipo disponivel"}
                </option>
              ) : (
                justificativaTipos.map((tipo) => (
                  <option key={tipo.id} value={String(tipo.id)}>
                    {tipo.descricao}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="rh-justificativa-form__group">
            <label htmlFor="rh-justificativa-descricao">
              Descrição
              {descricaoObrigatoria ? " obrigatória" : " opcional"}
            </label>
            <textarea
              id="rh-justificativa-descricao"
              rows={4}
              value={justificativaDescricao}
              onChange={(event) =>
                setJustificativaDescricao(
                  event.target.value.slice(0, JUSTIFICATIVA_DESCRICAO_MAX_LENGTH),
                )
              }
              maxLength={JUSTIFICATIVA_DESCRICAO_MAX_LENGTH}
              placeholder={
                descricaoObrigatoria
                  ? "Descreva o motivo da justificativa."
                  : "Descrição opcional para complementar a justificativa."
              }
              disabled={justificativaLoading}
            />
            <p className="rh-justificativa-form__counter">
              {justificativaDescricao.length}/{JUSTIFICATIVA_DESCRICAO_MAX_LENGTH}
            </p>
          </div>

          <div className="rh-justificativa-form__group">
            <label htmlFor="rh-justificativa-file">
              Anexo
              {anexoObrigatorio ? " obrigatorio" : " opcional"}
            </label>
            <input
              id="rh-justificativa-file"
              type="file"
              disabled={justificativaLoading}
              onChange={(event) =>
                setJustificativaFile(event.target.files?.[0] || null)
              }
            />
            {justificativaFile && (
              <p className="rh-justificativa-form__filename">
                Arquivo: {justificativaFile.name}
              </p>
            )}
            {!justificativaFile && (
              <p className="rh-justificativa-form__hint">
                {anexoObrigatorio
                  ? "Selecione um arquivo para concluir esta justificativa."
                  : "Você pode enviar um arquivo para complementar a justificativa."}
              </p>
            )}
          </div>

          <div className="rh-justificativa-form__actions">
            <button
              className="rh-page__button"
              onClick={handleCloseJustificativa}
              type="button"
              disabled={justificativaLoading}
            >
              Cancelar
            </button>
            <button
              className="rh-page__button rh-page__button--primary"
              onClick={handleEnviarJustificativa}
              type="button"
              disabled={justificativaLoading}
            >
              {justificativaLoading ? "Enviando..." : "Enviar justificativa"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
