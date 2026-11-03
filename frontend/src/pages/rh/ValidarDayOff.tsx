import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiCalendar,
  FiCheckCircle,
  FiEdit,
  FiPlusCircle,
  FiSlash,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { Modal } from "../../components/common/Modal/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  RhPontoService,
  type DayOffItem,
  type EmpresaUsuarioResumo,
  type PontoDayInfo,
} from "../../service/pontoService";
import "./ValidarDayOff.css";

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMinutesAsHours(value?: number): string {
  const total = Number(value || 0);
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatFaixaLabel(
  entrada?: string | null,
  saida?: string | null,
): string {
  if (!entrada && !saida) return "--";
  if (entrada && saida) return `${entrada.slice(0, 5)} às ${saida.slice(0, 5)}`;
  return entrada?.slice(0, 5) || saida?.slice(0, 5) || "--";
}

function resolveResultado(info: PontoDayInfo | null): {
  title: string;
  tone: "success" | "warning";
  description: string;
} | null {
  if (!info) return null;

  if (info.day_off) {
    return {
      title: "Day-off encontrado",
      tone: "warning",
      description: "A batida fica bloqueada para a data selecionada.",
    };
  }

  if (info.feriado) {
    return {
      title: "Feriado cadastrado",
      tone: "warning",
      description: "A data possui um feriado ativo para a empresa.",
    };
  }

  if (!info.horario) {
    return {
      title: "Sem horário vinculado",
      tone: "warning",
      description:
        "O colaborador não possui horário de trabalho para esse dia.",
    };
  }

  return {
    title: "Batida permitida",
    tone: "success",
    description:
      "Nenhum bloqueio de day-off foi encontrado para a data informada.",
  };
}

function getStatusBadgeClass(status?: string): string {
  const normalized = String(status || "").trim().toLowerCase();

  switch (normalized) {
    case "aprovado":
      return "rh-dayoff__status-badge rh-dayoff__status-badge--approved";
    case "pendente":
      return "rh-dayoff__status-badge rh-dayoff__status-badge--pending";
    case "reprovado":
      return "rh-dayoff__status-badge rh-dayoff__status-badge--rejected";
    default:
      return "rh-dayoff__status-badge";
  }
}

export function ValidarDayOff() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const initialUsuarioId = searchParams.get("usuario_id") || "";
  const lastUsuarioIdFromUrlRef = useRef(initialUsuarioId);
  const [usuarios, setUsuarios] = useState<EmpresaUsuarioResumo[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dayOffLoading, setDayOffLoading] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [usuarioId, setUsuarioId] = useState(initialUsuarioId);
  const [dataReferencia, setDataReferencia] = useState(toInputDate(new Date()));
  const [dataInicioHistorico, setDataInicioHistorico] = useState(
    toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [dataFimHistorico, setDataFimHistorico] = useState(toInputDate(new Date()));
  const [resultado, setResultado] = useState<PontoDayInfo | null>(null);
  const [historico, setHistorico] = useState<DayOffItem[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [dayOffTipo, setDayOffTipo] = useState("");
  const [dayOffStatus, setDayOffStatus] = useState("aprovado");
  const [dayOffObservacao, setDayOffObservacao] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [editingDayOff, setEditingDayOff] = useState<DayOffItem | null>(null);

  const usuarioSelecionado = useMemo(
    () =>
      usuarios.find((item) => String(item.id) === String(usuarioId)) || null,
    [usuarioId, usuarios],
  );

  const resumo = resolveResultado(resultado);
  const editingDayOffId = editingDayOff ? String(editingDayOff.id || "") : "";
  const isEditingDayOff = Boolean(editingDayOffId);

  const resetDayOffForm = useCallback(() => {
    setDayOffTipo("");
    setDayOffStatus("aprovado");
    setDayOffObservacao("");
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingDayOff(null);
    resetDayOffForm();
    setManageOpen(true);
  }, [resetDayOffForm]);

  const openEditModal = useCallback((item: DayOffItem) => {
    setEditingDayOff(item);
    setDayOffTipo(String(item.tipo || ""));
    setDayOffStatus(String(item.status || "aprovado"));
    setDayOffObservacao(String(item.observacao || ""));
    setManageOpen(true);
  }, []);

  const carregarUsuarios = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setUsuariosLoading(true);
      setMensagem("");
      const lista = await RhPontoService.listarUsuariosEmpresa(user.empresa_id);
      setUsuarios(lista);
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Erro ao carregar os colaboradores.",
      );
      setUsuarios([]);
    } finally {
      setUsuariosLoading(false);
    }
  }, [user?.empresa_id]);

  useEffect(() => {
    void carregarUsuarios();
  }, [carregarUsuarios]);

  useEffect(() => {
    const nextUsuarioId = searchParams.get("usuario_id") || "";
    if (nextUsuarioId === lastUsuarioIdFromUrlRef.current) return;
    lastUsuarioIdFromUrlRef.current = nextUsuarioId;
    setUsuarioId(nextUsuarioId);
  }, [searchParams]);

  useEffect(() => {
    setHasValidated(false);
    setResultado(null);
    setHistorico([]);
  }, [usuarioId, dataReferencia]);

  useEffect(() => {
    if (!mensagem) return;
    addToast({
      type: /sucesso|criado|atualizado|removido/i.test(mensagem) ? "success" : "error",
      title: mensagem,
    });
    setMensagem("");
  }, [addToast, mensagem]);

  const carregarHistoricoDayOff = useCallback(async () => {
    if (!user?.empresa_id || !usuarioId) {
      setHistorico([]);
      return;
    }
    if (
      dataInicioHistorico &&
      dataFimHistorico &&
      dataFimHistorico < dataInicioHistorico
    ) {
      setMensagem("A data final do historico nao pode ser menor que a inicial.");
      return;
    }

    try {
      setHistoricoLoading(true);
      const lista = await RhPontoService.listarDayOffUsuario({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        dataInicio: dataInicioHistorico || undefined,
        dataFim: dataFimHistorico || undefined,
      });
      setHistorico(lista);
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : "Erro ao carregar o historico.",
      );
      setHistorico([]);
    } finally {
      setHistoricoLoading(false);
    }
  }, [dataFimHistorico, dataInicioHistorico, user?.empresa_id, usuarioId]);

  const handleValidar = async () => {
    if (!user?.empresa_id) return;
    if (!usuarioId) {
      setMensagem("Selecione um colaborador.");
      return;
    }
    if (!dataReferencia) {
      setMensagem("Selecione uma data.");
      return;
    }

    try {
      setLoading(true);
      setMensagem("");
      const [info, listaHistorico] = await Promise.all([
        RhPontoService.validarDayOff(
          user.empresa_id,
          Number(usuarioId),
          dataReferencia,
        ),
        RhPontoService.listarDayOffUsuario({
          empresaId: user.empresa_id,
          usuarioId: Number(usuarioId),
          dataInicio: dataInicioHistorico || undefined,
          dataFim: dataFimHistorico || undefined,
        }),
      ]);
      setResultado(info);
      setHistorico(listaHistorico);
      setHasValidated(true);
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : "Erro ao validar o day-off.",
      );
      setResultado(null);
      setHasValidated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarDayOff = async () => {
    if (!user?.empresa_id) return;
    if (!usuarioId) {
      setMensagem("Selecione um colaborador.");
      return;
    }
    if (!dataReferencia) {
      setMensagem("Selecione uma data.");
      return;
    }

    try {
      setDayOffLoading(true);
      setMensagem("");

      if (editingDayOffId) {
        await RhPontoService.editarDayOff({
          empresaId: user.empresa_id,
          dayOffId: editingDayOffId,
          dataReferencia: editingDayOff?.data_referencia || dataReferencia,
          tipo: dayOffTipo || undefined,
          observacao: dayOffObservacao || undefined,
          status: dayOffStatus || undefined,
        });
        setMensagem("Day-off atualizado com sucesso.");
      } else {
        await RhPontoService.criarDayOff({
          empresaId: user.empresa_id,
          usuarioId: Number(usuarioId),
          dataReferencia,
          tipo: dayOffTipo || undefined,
          observacao: dayOffObservacao || undefined,
          status: dayOffStatus || undefined,
        });
        setMensagem("Day-off criado com sucesso.");
      }

      await handleValidar();
      setManageOpen(false);
      setEditingDayOff(null);
      resetDayOffForm();
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : "Erro ao salvar o day-off.",
      );
    } finally {
      setDayOffLoading(false);
    }
  };

  const handleRemoverDayOff = async () => {
    if (!user?.empresa_id) return;
    if (!editingDayOffId) return;

    const confirmed = window.confirm(
      "Deseja remover o day-off desta data para o colaborador selecionado?",
    );
    if (!confirmed) return;

    try {
      setDayOffLoading(true);
      setMensagem("");
      await RhPontoService.removerDayOff({
        empresaId: user.empresa_id,
        dayOffId: editingDayOffId,
      });
      setMensagem("Day-off removido com sucesso.");
      await handleValidar();
      setManageOpen(false);
      setEditingDayOff(null);
      resetDayOffForm();
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : "Erro ao remover o day-off.",
      );
    } finally {
      setDayOffLoading(false);
    }
  };

  return (
    <div className="rh-dayoff">
      {/* <section className="rh-dayoff__hero">
        <div>
          <h2>Validação de day-off</h2>
          <p>
            Consulte se o colaborador está bloqueado para bater ponto em uma data
            específica e veja o contexto do dia.
          </p>
        </div>
      </section> */}

      <section className="rh-dayoff__filters">
        <div className="rh-dayoff__field">
          <label htmlFor="rh-dayoff-usuario">
            <FiUser size={16} />
            Colaborador
          </label>
          <select
            id="rh-dayoff-usuario"
            value={usuarioId}
            onChange={(event) => setUsuarioId(event.target.value)}
            disabled={usuariosLoading || loading}
          >
            {usuarios.length === 0 ? (
              <option value="">
                {usuariosLoading
                  ? "Carregando..."
                  : "Nenhum colaborador disponível"}
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

        <div className="rh-dayoff__field">
          <label htmlFor="rh-dayoff-data">
            <FiCalendar size={16} />
            Data de referência
          </label>
          <input
            id="rh-dayoff-data"
            type="date"
            value={dataReferencia}
            onChange={(event) => setDataReferencia(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="rh-dayoff__actions">
          <button
            className="rh-dayoff__button rh-dayoff__button--primary"
            type="button"
            onClick={() => void handleValidar()}
            disabled={loading || usuariosLoading}
          >
            {loading ? "Validando..." : "Validar day-off"}
          </button>
        </div>
      </section>
      <div className="rh-dayoff-wrapper">
        <div className="rh-dayoff__manage-overview">
          <article className="rh-dayoff__manage rh-dayoff__manage--action">
            <div className="rh-dayoff__manage-header">
              <div>
                <h4>Criar day-off</h4>
                <p>Cadastre um novo day-off para o colaborador na data informada.</p>
              </div>
              <span className="rh-dayoff__manage-badge">{dataReferencia}</span>
            </div>

            <div className="rh-dayoff__manage-actions">
              <button
                className="rh-dayoff__button rh-dayoff__button--primary rh-dayoff__button--inline"
                type="button"
                onClick={openCreateModal}
                disabled={!usuarioId || dayOffLoading || loading}
              >
                <>
                  <FiPlusCircle size={16} /> Criar day-off
                </>
              </button>
            </div>
          </article>
        </div>

        {resultado && resumo && (
          <section className="rh-dayoff__result">
            <div className="rh-dayoff__overview">
              

              <div className="rh-dayoff__grid">
                

                {resultado.horario?.faixas &&
                resultado.horario.faixas.length > 0 && (
                  <article className="rh-dayoff__schedule">
                    <h4>Faixas do horário</h4>
                    <div className="rh-dayoff__schedule-list">
                      {resultado.horario.faixas.map((faixa, index) => (
                        <div
                          key={`${faixa.entrada}-${faixa.saida}-${index}`}
                          className="rh-dayoff__schedule-item"
                        >
                          <strong>Faixa {index + 1}</strong>
                          <span>
                            {formatFaixaLabel(faixa.entrada, faixa.saida)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                )}

                <article
                className={`rh-dayoff__summary rh-dayoff__summary--${resumo.tone}`}
              >
                <div className="rh-dayoff__summary-icon">
                  {resumo.tone === "success" ? (
                    <FiCheckCircle size={20} />
                  ) : (
                    <FiSlash size={20} />
                  )}
                </div>
                <div>
                  <h3>{resumo.title}</h3>
                  <p>{resumo.description}</p>
                  <span>
                    {usuarioSelecionado?.nome ||
                      usuarioSelecionado?.name ||
                      "Colaborador"}{" "}
                    em {dataReferencia}
                  </span>
                </div>
              </article>

              <article className="rh-dayoff__card">
                  <h4>Permissão de batida</h4>
                  <p>{resultado.permite_batida ? "Permitida" : "Bloqueada"}</p>
                </article>

                <article className="rh-dayoff__card">
                  <h4>Day-off</h4>
                  {resultado.day_off ? (
                    <>
                      <p>{resultado.day_off.tipo || "Day-off aprovado"}</p>
                      <span>
                        {resultado.day_off.observacao || "Sem observação."}
                      </span>
                    </>
                  ) : (
                    <p>Nenhum day-off encontrado.</p>
                  )}
                </article>

                <article className="rh-dayoff__card">
                  <h4>Feriado</h4>
                  {resultado.feriado ? (
                    <>
                      <p>{resultado.feriado.descricao || "Feriado ativo"}</p>
                      <span>
                        {resultado.feriado.tipo || "Sem tipo informado."}
                      </span>
                    </>
                  ) : (
                    <p>Nenhum feriado encontrado.</p>
                  )}
                </article>

                <article className="rh-dayoff__card">
                  <h4>Horário do dia</h4>
                  {resultado.horario ? (
                    <>
                      <span>
                        Carga prevista:{" "}
                        {formatMinutesAsHours(
                          resultado.horario.carga_prevista_minutos,
                        )}
                      </span>
                    </>
                  ) : (
                    <p>Sem horário vinculado.</p>
                  )}
                </article>
              </div>

              {hasValidated && usuarioId ? (
          <section className="rh-dayoff__history">
            <div className="rh-dayoff__history-header">
              <div>
                <h4>Historico de day-offs</h4>
                <p>
                  Consulte os lancamentos do colaborador no periodo selecionado.
                </p>
              </div>
            </div>

            <div className="rh-dayoff__history-filters">
              <div className="rh-dayoff__field">
                <label htmlFor="rh-dayoff-history-start">Data inicial</label>
                <input
                  id="rh-dayoff-history-start"
                  type="date"
                  value={dataInicioHistorico}
                  onChange={(event) => setDataInicioHistorico(event.target.value)}
                  disabled={historicoLoading || loading || dayOffLoading}
                />
              </div>
              <div className="rh-dayoff__field">
                <label htmlFor="rh-dayoff-history-end">Data final</label>
                <input
                  id="rh-dayoff-history-end"
                  type="date"
                  value={dataFimHistorico}
                  onChange={(event) => setDataFimHistorico(event.target.value)}
                  disabled={historicoLoading || loading || dayOffLoading}
                />
              </div>
              <div className="rh-dayoff__actions">
                <button
                  className="rh-dayoff__button rh-dayoff__button--primary"
                  type="button"
                  onClick={() => void carregarHistoricoDayOff()}
                  disabled={historicoLoading || loading || dayOffLoading}
                >
                  {historicoLoading ? "Carregando..." : "Buscar historico"}
                </button>
              </div>
            </div>

            {historicoLoading ? (
              <div className="rh-dayoff__empty">Carregando historico...</div>
            ) : historico.length === 0 ? (
              <div className="rh-dayoff__empty">
                Nenhum day-off encontrado para o periodo informado.
              </div>
            ) : (
              <div className="rh-dayoff__history-table-wrapper">
                <table className="rh-dayoff__history-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Status</th>
                      <th>Observação</th>
                      <th>Criado em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((item) => (
                      <tr key={String(item.id)}>
                        <td>{item.data_referencia || "--"}</td>
                        <td>{item.tipo || "--"}</td>
                        <td>
                          <span className={getStatusBadgeClass(item.status)}>
                            {item.status || "--"}
                          </span>
                        </td>
                        <td>{item.observacao || "--"}</td>
                        <td>{item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "--"}</td>
                        <td>
                          <button
                            className="rh-dayoff__history-action"
                            type="button"
                            onClick={() => openEditModal(item)}
                            disabled={dayOffLoading || loading}
                          >
                            <FiEdit size={14} /> Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

            </div>

          </section>
        )}

        
      </div>

      <Modal
        isOpen={manageOpen}
        onClose={() => {
          if (dayOffLoading) return;
          setManageOpen(false);
          setEditingDayOff(null);
          resetDayOffForm();
        }}
        title={isEditingDayOff ? "Editar day-off" : "Criar day-off"}
      >
        <div className="rh-dayoff__modal">
          <div className="rh-dayoff__manage-header">
            <div>
              <h4>{isEditingDayOff ? "Editar day-off" : "Criar day-off"}</h4>
              <p>
                {isEditingDayOff
                  ? "Atualize os dados do day-off selecionado."
                  : "Cadastre um novo day-off para a data informada."}
              </p>
            </div>
            {isEditingDayOff ? (
              <span className="rh-dayoff__manage-badge">ID {editingDayOffId}</span>
            ) : (
              <span className="rh-dayoff__manage-badge">{dataReferencia}</span>
            )}
          </div>

          <div className="rh-dayoff__manage-grid">
            <div className="rh-dayoff__manage-field">
              <label htmlFor="rh-dayoff-tipo">Tipo</label>
              <input
                id="rh-dayoff-tipo"
                value={dayOffTipo}
                onChange={(event) => setDayOffTipo(event.target.value)}
                placeholder="Ex: folga, day_off..."
                disabled={dayOffLoading || loading}
              />
            </div>

            <div className="rh-dayoff__manage-field">
              <label htmlFor="rh-dayoff-status">Status</label>
              <select
                id="rh-dayoff-status"
                value={dayOffStatus}
                onChange={(event) => setDayOffStatus(event.target.value)}
                disabled={dayOffLoading || loading}
              >
                <option value="aprovado">Aprovado</option>
                <option value="pendente">Pendente</option>
                <option value="reprovado">Reprovado</option>
              </select>
            </div>

            <div className="rh-dayoff__manage-field rh-dayoff__manage-field--full">
              <label htmlFor="rh-dayoff-observacao">Observação</label>
              <textarea
                id="rh-dayoff-observacao"
                rows={3}
                value={dayOffObservacao}
                onChange={(event) => setDayOffObservacao(event.target.value)}
                disabled={dayOffLoading || loading}
              />
            </div>
          </div>

          <div className="rh-dayoff__manage-actions">
            <button
              className="rh-dayoff__button rh-dayoff__button--primary rh-dayoff__button--inline"
              type="button"
              onClick={() => void handleSalvarDayOff()}
              disabled={dayOffLoading || loading}
            >
              {dayOffLoading ? (
                "Salvando..."
              ) : isEditingDayOff ? (
                <>
                  <FiEdit size={16} /> Atualizar
                </>
              ) : (
                <>
                  <FiPlusCircle size={16} /> Criar
                </>
              )}
            </button>

            {isEditingDayOff && (
              <button
                className="rh-dayoff__button rh-dayoff__button--danger rh-dayoff__button--inline"
                type="button"
                onClick={() => void handleRemoverDayOff()}
                disabled={dayOffLoading || loading}
              >
                <FiTrash2 size={16} /> Remover
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
