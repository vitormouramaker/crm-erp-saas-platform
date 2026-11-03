import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiCheck,
  FiClock,
  FiExternalLink,
  FiX,
} from "react-icons/fi";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Modal } from "../../components/common/Modal/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  RhPontoService,
  type JustificativaItem,
} from "../../service/pontoService";
import "./Justificativa.css";

const MOTIVO_RECUSA_MAX_LENGTH = 500;

function formatDate(value?: string | null): string {
  if (!value) return "--/--/----";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--/--/----";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function formatDateTime(value?: string | null): string {
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

function normalizeStatus(status?: string): string {
  switch (status) {
    case "aprovado":
      return "Aprovado";
    case "reprovado":
      return "Reprovado";
    case "pendente":
      return "Pendente";
    default:
      return status || "Sem status";
  }
}

export function Justificativa({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [justificativas, setJustificativas] = useState<JustificativaItem[]>([]);
  const [statusFiltro, setStatusFiltro] = useState("");
  const [dataInicioFiltro, setDataInicioFiltro] = useState("");
  const [dataFimFiltro, setDataFimFiltro] = useState("");
  const [busca, setBusca] = useState("");
  const [rejeicaoAberta, setRejeicaoAberta] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [justificativaSelecionada, setJustificativaSelecionada] =
    useState<JustificativaItem | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState("");

  const carregarJustificativas = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setLoading(true);
      setMensagem("");
      const lista = await RhPontoService.listarJustificativas({
        empresaId: user.empresa_id,
        status: statusFiltro || undefined,
        dataInicio: dataInicioFiltro || undefined,
        dataFim: dataFimFiltro || undefined,
      });
      setJustificativas(lista);
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Erro ao carregar as justificativas.",
      );
      setJustificativas([]);
    } finally {
      setLoading(false);
    }
  }, [dataFimFiltro, dataInicioFiltro, statusFiltro, user?.empresa_id]);

  useEffect(() => {
    void carregarJustificativas();
  }, [carregarJustificativas]);

  useEffect(() => {
    if (!mensagem) return;
    addToast({
      type: /sucesso|aprovada|reprovada/i.test(mensagem) ? "success" : "error",
      title: mensagem,
    });
    setMensagem("");
  }, [addToast, mensagem]);

  const justificativasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return justificativas;

    return justificativas.filter((item) => {
      const campos = [
        item.usuario_nome,
        item.tipo,
        item.tipo_descricao,
        item.descricao,
        item.status,
      ];

      return campos.some((valor) =>
        String(valor || "")
          .toLowerCase()
          .includes(termo),
      );
    });
  }, [busca, justificativas]);

  const handleAprovar = async (justificativa: JustificativaItem) => {
    if (!user?.empresa_id || !user?.id) return;

    try {
      setActionLoadingId(String(justificativa.id));
      setMensagem("");
      await RhPontoService.aprovarReprovarJustificativa({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        justificativaId: String(justificativa.id),
        status: "aprovado",
      });
      await carregarJustificativas();
      resetModais();
      setMensagem("Justificativa aprovada com sucesso.");
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível aprovar a justificativa.",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const abrirModalReprovacao = (justificativa: JustificativaItem) => {
    setJustificativaSelecionada(justificativa);
    setMotivoRecusa("");
    setDetalheAberto(false);
    setRejeicaoAberta(true);
  };

  const abrirModalDetalhe = (justificativa: JustificativaItem) => {
    setJustificativaSelecionada(justificativa);
    setDetalheAberto(true);
  };

  const resetModais = () => {
    setRejeicaoAberta(false);
    setDetalheAberto(false);
    setMotivoRecusa("");
    setJustificativaSelecionada(null);
  };

  const fecharModalReprovacao = () => {
    if (actionLoadingId) return;
    setRejeicaoAberta(false);
    setMotivoRecusa("");
    if (!detalheAberto) {
      setJustificativaSelecionada(null);
    }
  };

  const fecharModalDetalhe = () => {
    setDetalheAberto(false);
    if (!rejeicaoAberta) {
      setJustificativaSelecionada(null);
    }
  };

  const handleReprovar = async () => {
    if (!user?.empresa_id || !user?.id || !justificativaSelecionada) return;
    if (!motivoRecusa.trim()) {
      setMensagem("Informe o motivo da reprovação.");
      return;
    }

    try {
      setActionLoadingId(String(justificativaSelecionada.id));
      setMensagem("");
      await RhPontoService.aprovarReprovarJustificativa({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        justificativaId: String(justificativaSelecionada.id),
        status: "reprovado",
        motivoRecusa: motivoRecusa.trim(),
      });
      await carregarJustificativas();
      resetModais();
      setMensagem("Justificativa reprovada com sucesso.");
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível reprovar a justificativa.",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const totalPendentes = justificativas.filter(
    (item) => item.status === "pendente",
  ).length;
  const hasFiltrosAplicados = Boolean(
    statusFiltro || dataInicioFiltro || dataFimFiltro || busca.trim(),
  );

  return (
    <div
      className={
        embedded
          ? "rh-justificativa-page rh-justificativa-page--embedded"
          : "rh-justificativa-page"
      }
    >
      {!embedded && <MobileHeader title="Justificativas" />}

      {!embedded && (
        <header className="rh-justificativa-header">
          <div className="rh-justificativa-header__content">
            <h1>Gestão de justificativas</h1>
            <p>
              Analise solicitações de ausência, atraso e outros ajustes enviados
              pelos colaboradores.
            </p>
          </div>

          <div className="rh-justificativa-header__actions">
            <span className="rh-justificativa-counter">
              <FiClock size={16} />
              {totalPendentes} pendente{totalPendentes === 1 ? "" : "s"}
            </span>
            <Link className="rh-justificativa-back" to="/rh/admin">
              Voltar ao RH
            </Link>
          </div>
        </header>
      )}

      <div
        className={
          embedded
            ? "rh-justificativa-content rh-justificativa-content--embedded"
            : "rh-justificativa-content"
        }
      >
        <section className="rh-justificativa-filters">
          <div className="rh-justificativa-filters__grid">
            <div className="rh-justificativa-field rh-justificativa-field--search">
              <label htmlFor="rh-just-busca">Busca local</label>
              <input
                id="rh-just-busca"
                type="search"
                placeholder="Buscar por colaborador, tipo ou texto..."
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                disabled={loading}
              />
            </div>
            <div className="rh-justificativa-field">
              <label htmlFor="rh-just-status">Status</label>
              <select
                id="rh-just-status"
                value={statusFiltro}
                onChange={(event) => setStatusFiltro(event.target.value)}
                disabled={loading}
              >
                <option value="">Todos</option>
                <option value="pendente">Pendentes</option>
                <option value="aprovado">Aprovadas</option>
                <option value="reprovado">Reprovadas</option>
              </select>
            </div>

            <div className="rh-justificativa-field">
              <label htmlFor="rh-just-data-inicio">Data início</label>
              <input
                id="rh-just-data-inicio"
                type="date"
                value={dataInicioFiltro}
                onChange={(event) => setDataInicioFiltro(event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="rh-justificativa-field">
              <label htmlFor="rh-just-data-fim">Data fim</label>
              <input
                id="rh-just-data-fim"
                type="date"
                value={dataFimFiltro}
                onChange={(event) => setDataFimFiltro(event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="rh-justificativa-filters__actions">
              {hasFiltrosAplicados && (
                <button
                  className="rh-justificativa-button rh-justificativa-button--secondary"
                  type="button"
                  onClick={() => {
                    setStatusFiltro("");
                    setDataInicioFiltro("");
                    setDataFimFiltro("");
                    setBusca("");
                  }}
                  disabled={loading}
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </section>

        <div
          className={
            embedded
              ? "rh-justificativa-wrapper rh-justificativa-wrapper--embedded"
              : "rh-justificativa-wrapper"
          }
        >
          <section className="rh-justificativa-list">
            {loading ? (
              <div className="rh-justificativa-empty">
                <p>Carregando justificativas...</p>
              </div>
            ) : justificativasFiltradas.length === 0 ? (
              <div className="rh-justificativa-empty">
                <p>Nenhuma justificativa encontrada para os filtros atuais.</p>
              </div>
            ) : (
              justificativasFiltradas.map((item) => {
                return (
                  <article key={item.id} className="rh-justificativa-card">
                    <div className="rh-justificativa-card__header">
                      <div>
                        <h2>
                          {item.usuario_nome || `Usuário ${item.usuario_id}`}
                        </h2>
                        <p>
                          {item.tipo_descricao ||
                            item.tipo ||
                            "Tipo não informado"}
                        </p>
                      </div>
                      <span
                        className={`rh-justificativa-badge rh-justificativa-badge--${item.status || "default"}`}
                      >
                        {normalizeStatus(item.status)}
                      </span>
                    </div>

                    <div className="rh-justificativa-card__meta">
                      <div>
                        <strong>Período</strong>
                        <span>
                          {formatDate(item.data_inicio)} até{" "}
                          {formatDate(item.data_fim)}
                        </span>
                      </div>
                      <div>
                        <strong>Solicitado em</strong>
                        <span>{formatDateTime(item.created_at)}</span>
                      </div>
                      <div>
                        <strong>Aprovador</strong>
                        <span>{item.aprovado_por_nome || "--"}</span>
                      </div>
                    </div>

                    <button
                      className="rh-justificativa-link"
                      type="button"
                      onClick={() => abrirModalDetalhe(item)}
                    >
                      Ver mais
                    </button>
                  </article>
                );
              })
            )}
          </section>
        </div>
      </div>

      <Modal
        isOpen={rejeicaoAberta}
        onClose={fecharModalReprovacao}
        title="Reprovar justificativa"
      >
        <div className="rh-justificativa-modal">
          <p className="rh-justificativa-modal__description">
            Informe o motivo da reprovação para a justificativa de{" "}
            <strong>
              {justificativaSelecionada?.usuario_nome ||
                `usuário ${justificativaSelecionada?.usuario_id || ""}`}
            </strong>
            .
          </p>

          <div className="rh-justificativa-field">
            <label htmlFor="rh-just-motivo-recusa">Motivo da reprovação</label>
            <textarea
              id="rh-just-motivo-recusa"
              rows={5}
              value={motivoRecusa}
              onChange={(event) =>
                setMotivoRecusa(
                  event.target.value.slice(0, MOTIVO_RECUSA_MAX_LENGTH),
                )
              }
              disabled={Boolean(actionLoadingId)}
              placeholder="Explique por que esta solicitação não será aprovada."
              maxLength={MOTIVO_RECUSA_MAX_LENGTH}
            />
            <p className="rh-justificativa-field__counter">
              {motivoRecusa.length}/{MOTIVO_RECUSA_MAX_LENGTH}
            </p>
          </div>

          <div className="rh-justificativa-modal__actions">
            <button
              className="rh-justificativa-button rh-justificativa-button--secondary"
              type="button"
              onClick={fecharModalReprovacao}
              disabled={Boolean(actionLoadingId)}
            >
              Cancelar
            </button>
            <button
              className="rh-justificativa-button rh-justificativa-button--reject"
              type="button"
              onClick={() => void handleReprovar()}
              disabled={Boolean(actionLoadingId)}
            >
              {actionLoadingId ? "Reprovando..." : "Confirmar reprovação"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={detalheAberto}
        onClose={fecharModalDetalhe}
        title="Detalhes da justificativa"
        size="lg"
      >
        <div className="rh-justificativa-detail">
          <div className="rh-justificativa-detail__header">
            <h3>
              {justificativaSelecionada?.usuario_nome ||
                `Usuário ${justificativaSelecionada?.usuario_id || ""}`}
            </h3>
            <span
              className={`rh-justificativa-badge rh-justificativa-badge--${justificativaSelecionada?.status || "default"}`}
            >
              {normalizeStatus(justificativaSelecionada?.status)}
            </span>
          </div>

          <div className="rh-justificativa-detail__meta">
            <div>
              <strong>Tipo</strong>
              <span>
                {justificativaSelecionada?.tipo_descricao ||
                  justificativaSelecionada?.tipo ||
                  "--"}
              </span>
            </div>
            <div>
              <strong>Período</strong>
              <span>
                {formatDate(justificativaSelecionada?.data_inicio)} até{" "}
                {formatDate(justificativaSelecionada?.data_fim)}
              </span>
            </div>
            <div>
              <strong>Solicitado em</strong>
              <span>
                {formatDateTime(justificativaSelecionada?.created_at)}
              </span>
            </div>
            <div>
              <strong>Aprovador</strong>
              <span>{justificativaSelecionada?.aprovado_por_nome || "--"}</span>
            </div>
          </div>

          <div className="rh-justificativa-detail__section">
            <strong>Descricao</strong>
            <p>
              {justificativaSelecionada?.descricao ||
                "Sem descrição informada."}
            </p>
          </div>

          {justificativaSelecionada?.status === "aprovado" && (
            <div className="rh-justificativa-detail__section">
              <strong>Resultado</strong>
              <p>Justificativa aprovada.</p>
            </div>
          )}

          {justificativaSelecionada?.motivo_recusa && (
            <div className="rh-justificativa-detail__section rh-justificativa-detail__section--danger">
              <strong>Motivo da reprovação</strong>
              <p>{justificativaSelecionada.motivo_recusa}</p>
            </div>
          )}

          <div className="rh-justificativa-detail__section">
            <strong>Anexos</strong>
            {(justificativaSelecionada?.anexos || []).length > 0 ? (
              <ul className="rh-justificativa-detail__attachments">
                {(justificativaSelecionada?.anexos || []).map((anexo) => (
                  <li key={String(anexo.id || anexo.url)}>
                    <a href={anexo.url || "#"} target="_blank" rel="noreferrer">
                      <FiExternalLink size={14} />
                      {anexo.nome_arquivo || "Abrir anexo"}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhum anexo enviado.</p>
            )}
          </div>

          {justificativaSelecionada?.status === "pendente" && (
            <div className="rh-justificativa-detail__actions">
              <button
                className="rh-justificativa-button rh-justificativa-button--approve"
                type="button"
                onClick={() =>
                  justificativaSelecionada &&
                  void handleAprovar(justificativaSelecionada)
                }
                disabled={
                  actionLoadingId === String(justificativaSelecionada.id)
                }
              >
                <FiCheck size={16} />
                {actionLoadingId === String(justificativaSelecionada.id)
                  ? "Processando..."
                  : "Aprovar"}
              </button>
              <button
                className="rh-justificativa-button rh-justificativa-button--reject"
                type="button"
                onClick={() =>
                  justificativaSelecionada &&
                  abrirModalReprovacao(justificativaSelecionada)
                }
                disabled={
                  actionLoadingId === String(justificativaSelecionada.id)
                }
              >
                <FiX size={16} />
                Reprovar
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
