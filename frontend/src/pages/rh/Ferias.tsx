import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2, FiPlusCircle, FiTrash2, FiUser } from "react-icons/fi";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Modal } from "../../components/common/Modal/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  RhPontoService,
  type EmpresaUsuarioResumo,
  type FeriasItem,
  type PeriodoFeriasItem,
} from "../../service/pontoService";
import "./Ferias.css";

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string): string {
  if (!value) return "--/--/----";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function getStatusLabel(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "aprovado") return "Aprovado";
  if (normalized === "reprovado") return "Reprovado";
  if (normalized === "ativo") return "Ativo";
  if (normalized === "encerrado") return "Encerrado";
  return "Pendente";
}

function calculateDays(start?: string, end?: string) {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  const diff = endDate.getTime() - startDate.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

export function Ferias({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [usuarios, setUsuarios] = useState<EmpresaUsuarioResumo[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuarioId, setUsuarioId] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [periodFilterOpen, setPeriodFilterOpen] = useState(false);

  const [dataInicioFiltro, setDataInicioFiltro] = useState(
    toInputDate(new Date(new Date().getFullYear(), 0, 1)),
  );
  const [dataFimFiltro, setDataFimFiltro] = useState(
    toInputDate(new Date(new Date().getFullYear(), 11, 31)),
  );
  const [filtroUsuarioId, setFiltroUsuarioId] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState(
    toInputDate(new Date(new Date().getFullYear(), 0, 1)),
  );
  const [filtroDataFim, setFiltroDataFim] = useState(
    toInputDate(new Date(new Date().getFullYear(), 11, 31)),
  );

  const [lista, setLista] = useState<FeriasItem[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoFeriasItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [periodoCreateOpen, setPeriodoCreateOpen] = useState(false);

  const [novaDataInicio, setNovaDataInicio] = useState(toInputDate(new Date()));
  const [novaDataFim, setNovaDataFim] = useState(toInputDate(new Date()));
  const [novaObservacao, setNovaObservacao] = useState("");
  const [novoStatus, setNovoStatus] = useState("pendente");
  const [novoPeriodoFeriasId, setNovoPeriodoFeriasId] = useState("");

  const [novoPeriodoInicio, setNovoPeriodoInicio] = useState(
    toInputDate(new Date(new Date().getFullYear(), 0, 1)),
  );
  const [novoPeriodoFim, setNovoPeriodoFim] = useState(
    toInputDate(new Date(new Date().getFullYear(), 11, 31)),
  );
  const [novoPeriodoSaldoDias, setNovoPeriodoSaldoDias] = useState("30");

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<FeriasItem | null>(null);
  const [editDataInicio, setEditDataInicio] = useState("");
  const [editDataFim, setEditDataFim] = useState("");
  const [editObservacao, setEditObservacao] = useState("");
  const [editStatus, setEditStatus] = useState("pendente");
  const [editPeriodoFeriasId, setEditPeriodoFeriasId] = useState("");

  const [periodoEditOpen, setPeriodoEditOpen] = useState(false);
  const [periodoEditItem, setPeriodoEditItem] = useState<PeriodoFeriasItem | null>(null);
  const [editPeriodoInicio, setEditPeriodoInicio] = useState("");
  const [editPeriodoFim, setEditPeriodoFim] = useState("");
  const [editPeriodoSaldoDias, setEditPeriodoSaldoDias] = useState("30");

  const usuarioSelecionado = useMemo(
    () => usuarios.find((item) => String(item.id) === String(usuarioId)) || null,
    [usuarioId, usuarios],
  );

  const colaboradorLabel =
    usuarioSelecionado?.nome || usuarioSelecionado?.name || "Selecionar colaborador";

  const carregarUsuarios = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setUsuariosLoading(true);
      const listaUsuarios = await RhPontoService.listarUsuariosEmpresa(user.empresa_id);
      setUsuarios(listaUsuarios);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar colaboradores",
        description: error instanceof Error ? error.message : "Nao foi possivel carregar os usuarios.",
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
    setFiltroUsuarioId(usuarioId);
    setFiltroDataInicio(dataInicioFiltro);
    setFiltroDataFim(dataFimFiltro);
  }, [usuarioId, dataInicioFiltro, dataFimFiltro]);

  const carregarFerias = useCallback(async () => {
    if (!user?.empresa_id) return;
    if (!usuarioId) {
      addToast({
        type: "warning",
        title: "Selecione um colaborador",
      });
      setLista([]);
      setPeriodos([]);
      return;
    }
    if (dataFimFiltro && dataInicioFiltro && dataFimFiltro < dataInicioFiltro) {
      addToast({
        type: "warning",
        title: "Periodo invalido",
        description: "A data final nao pode ser menor que a inicial.",
      });
      return;
    }

    try {
      setLoading(true);
      const items = await RhPontoService.listarFeriasUsuario({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        dataInicio: dataInicioFiltro || undefined,
        dataFim: dataFimFiltro || undefined,
      });
      const periodosItems = await RhPontoService.listarPeriodosFerias({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
      });
      setLista(items);
      setPeriodos(periodosItems);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao listar ferias",
        description: error instanceof Error ? error.message : "Nao foi possivel listar as ferias.",
      });
      setLista([]);
      setPeriodos([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, dataFimFiltro, dataInicioFiltro, user?.empresa_id, usuarioId]);

  const listaOrdenada = useMemo(() => {
    return [...lista].sort((a, b) =>
      String(a.data_inicio || "").localeCompare(String(b.data_inicio || "")),
    );
  }, [lista]);

  const periodosOrdenados = useMemo(() => {
    return [...periodos].sort((a, b) =>
      String(a.periodo_aquisitivo_inicio || "").localeCompare(
        String(b.periodo_aquisitivo_inicio || ""),
      ),
    );
  }, [periodos]);

  const handleCriar = async () => {
    if (!user?.empresa_id || !user?.id) return;
    if (!usuarioId) {
      addToast({
        type: "warning",
        title: "Selecione um colaborador",
      });
      return;
    }
    if (!novaDataInicio) {
      addToast({
        type: "warning",
        title: "Informe a data de inicio",
      });
      return;
    }
    if (!novaDataFim) {
      addToast({
        type: "warning",
        title: "Informe a data de fim",
      });
      return;
    }
    if (novaDataFim < novaDataInicio) {
      addToast({
        type: "warning",
        title: "Periodo invalido",
        description: "A data de fim nao pode ser menor que a data de inicio.",
      });
      return;
    }

    try {
      setSaving(true);
      await RhPontoService.criarFerias({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        dataInicio: novaDataInicio,
        dataFim: novaDataFim,
        observacao: novaObservacao || undefined,
        status: novoStatus || undefined,
        periodoFeriasId: novoPeriodoFeriasId || undefined,
        aprovadoPor: user.id,
      });
      const precisaExpandirFiltro =
        (dataInicioFiltro && novaDataInicio < dataInicioFiltro) ||
        (dataFimFiltro && novaDataFim > dataFimFiltro);

      if (precisaExpandirFiltro) {
        setDataInicioFiltro((current) =>
          !current || novaDataInicio < current ? novaDataInicio : current,
        );
        setDataFimFiltro((current) =>
          !current || novaDataFim > current ? novaDataFim : current,
        );
      }
      setNovaObservacao("");
      setNovoStatus("pendente");
      setNovoPeriodoFeriasId("");
      const filtroInicioAtualizado =
        !dataInicioFiltro || novaDataInicio < dataInicioFiltro ? novaDataInicio : dataInicioFiltro;
      const filtroFimAtualizado =
        !dataFimFiltro || novaDataFim > dataFimFiltro ? novaDataFim : dataFimFiltro;

      const items = await RhPontoService.listarFeriasUsuario({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        dataInicio: filtroInicioAtualizado || undefined,
        dataFim: filtroFimAtualizado || undefined,
      });
      const periodosItems = await RhPontoService.listarPeriodosFerias({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
      });
      setLista(items);
      setPeriodos(periodosItems);
      addToast({
        type: "success",
        title: "Ferias cadastradas com sucesso",
        description: precisaExpandirFiltro
          ? "O periodo da listagem foi ajustado para exibir o novo registro."
          : undefined,
      });
      setCreateOpen(false);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao cadastrar ferias",
        description: error instanceof Error ? error.message : "Nao foi possivel cadastrar as ferias.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCriarPeriodo = async () => {
    if (!user?.empresa_id) return;
    if (!usuarioId) {
      addToast({
        type: "warning",
        title: "Selecione um colaborador",
      });
      return;
    }
    if (!novoPeriodoInicio || !novoPeriodoFim) {
      addToast({
        type: "warning",
        title: "Informe o periodo aquisitivo",
      });
      return;
    }
    if (novoPeriodoFim < novoPeriodoInicio) {
      addToast({
        type: "warning",
        title: "Periodo invalido",
        description: "O fim do periodo aquisitivo nao pode ser menor que o inicio.",
      });
      return;
    }

    try {
      setSaving(true);
      await RhPontoService.criarPeriodoFerias({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        periodoAquisitivoInicio: novoPeriodoInicio,
        periodoAquisitivoFim: novoPeriodoFim,
        saldoDias: Number(novoPeriodoSaldoDias || 0),
      });
      setNovoPeriodoSaldoDias("30");
      await carregarFerias();
      addToast({
        type: "success",
        title: "Per?odo aquisitivo cadastrado com sucesso",
      });
      setPeriodoCreateOpen(false);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao cadastrar periodo aquisitivo",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel cadastrar o periodo aquisitivo.",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: FeriasItem) => {
    setEditItem(item);
    setEditDataInicio(String(item.data_inicio || ""));
    setEditDataFim(String(item.data_fim || ""));
    setEditObservacao(String(item.observacao || ""));
    setEditStatus(String(item.status || "pendente"));
    setEditPeriodoFeriasId(String(item.periodo_ferias_id || ""));
    setEditOpen(true);
  };

  const openCreate = () => {
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (saving) return;
    setCreateOpen(false);
  };

  const openCreatePeriodo = () => {
    setPeriodoCreateOpen(true);
  };

  const closeCreatePeriodo = () => {
    if (saving) return;
    setPeriodoCreateOpen(false);
  };

  const openFilter = () => {
    setFiltroUsuarioId(usuarioId);
    setFilterOpen(true);
  };

  const closeFilter = () => {
    if (loading || saving) return;
    setFilterOpen(false);
  };

  const openPeriodFilter = () => {
    setFiltroDataInicio(dataInicioFiltro);
    setFiltroDataFim(dataFimFiltro);
    setPeriodFilterOpen(true);
  };

  const closePeriodFilter = () => {
    if (loading || saving) return;
    setPeriodFilterOpen(false);
  };

  const handleLimparPesquisa = () => {
    if (loading || saving) return;
    const inicioPadrao = toInputDate(new Date(new Date().getFullYear(), 0, 1));
    const fimPadrao = toInputDate(new Date(new Date().getFullYear(), 11, 31));

    setUsuarioId("");
    setFiltroUsuarioId("");
    setFiltroDataInicio(inicioPadrao);
    setFiltroDataFim(fimPadrao);
    setDataInicioFiltro(inicioPadrao);
    setDataFimFiltro(fimPadrao);
    setLista([]);
    setPeriodos([]);
  };

  const handleAplicarColaborador = async () => {
    setUsuarioId(filtroUsuarioId);

    if (!user?.empresa_id) {
      setFilterOpen(false);
      return;
    }

    if (!filtroUsuarioId) {
      addToast({
        type: "warning",
        title: "Selecione um colaborador",
      });
      setLista([]);
      setPeriodos([]);
      setFilterOpen(false);
      return;
    }

    try {
      setLoading(true);
      const items = await RhPontoService.listarFeriasUsuario({
        empresaId: user.empresa_id,
        usuarioId: Number(filtroUsuarioId),
        dataInicio: dataInicioFiltro || undefined,
        dataFim: dataFimFiltro || undefined,
      });
      const periodosItems = await RhPontoService.listarPeriodosFerias({
        empresaId: user.empresa_id,
        usuarioId: Number(filtroUsuarioId),
      });
      setLista(items);
      setPeriodos(periodosItems);
      setFilterOpen(false);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao buscar ferias",
        description: error instanceof Error ? error.message : "Nao foi possivel listar as ferias.",
      });
      setLista([]);
      setPeriodos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAplicarPeriodo = async () => {
    if (filtroDataFim && filtroDataInicio && filtroDataFim < filtroDataInicio) {
      addToast({
        type: "warning",
        title: "Periodo invalido",
        description: "A data final nao pode ser menor que a inicial.",
      });
      return;
    }

    setDataInicioFiltro(filtroDataInicio);
    setDataFimFiltro(filtroDataFim);

    if (!user?.empresa_id || !usuarioId) {
      setPeriodFilterOpen(false);
      return;
    }

    try {
      setLoading(true);
      const items = await RhPontoService.listarFeriasUsuario({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
      });
      setLista(items);
      setPeriodFilterOpen(false);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao filtrar ferias",
        description: error instanceof Error ? error.message : "Nao foi possivel filtrar as ferias.",
      });
      setLista([]);
    } finally {
      setLoading(false);
    }
  };

  const closeEdit = () => {
    if (saving) return;
    setEditOpen(false);
    setEditItem(null);
  };

  const handleSalvarEdicao = async () => {
    if (!user?.empresa_id || !user?.id || !editItem) return;
    if (!editDataInicio) {
      addToast({
        type: "warning",
        title: "Informe a data de inicio",
      });
      return;
    }
    if (!editDataFim) {
      addToast({
        type: "warning",
        title: "Informe a data de fim",
      });
      return;
    }
    if (editDataFim < editDataInicio) {
      addToast({
        type: "warning",
        title: "Periodo invalido",
        description: "A data de fim nao pode ser menor que a data de inicio.",
      });
      return;
    }

    try {
      setSaving(true);
      await RhPontoService.editarFerias({
        empresaId: user.empresa_id,
        feriasId: editItem.id,
        dataInicio: editDataInicio,
        dataFim: editDataFim,
        observacao: editObservacao || undefined,
        status: editStatus || undefined,
        periodoFeriasId: editPeriodoFeriasId || undefined,
        aprovadoPor: user.id,
      });
      await carregarFerias();
      addToast({
        type: "success",
        title: "Ferias atualizadas com sucesso",
      });
      closeEdit();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao editar ferias",
        description: error instanceof Error ? error.message : "Nao foi possivel editar as ferias.",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditPeriodo = (item: PeriodoFeriasItem) => {
    setPeriodoEditItem(item);
    setEditPeriodoInicio(String(item.periodo_aquisitivo_inicio || ""));
    setEditPeriodoFim(String(item.periodo_aquisitivo_fim || ""));
    setEditPeriodoSaldoDias(String(item.saldo_dias ?? 30));
    setPeriodoEditOpen(true);
  };

  const closeEditPeriodo = () => {
    if (saving) return;
    setPeriodoEditOpen(false);
    setPeriodoEditItem(null);
  };

  const handleSalvarPeriodo = async () => {
    if (!user?.empresa_id || !periodoEditItem) return;
    if (!editPeriodoInicio || !editPeriodoFim) {
      addToast({
        type: "warning",
        title: "Informe o periodo aquisitivo",
      });
      return;
    }
    if (editPeriodoFim < editPeriodoInicio) {
      addToast({
        type: "warning",
        title: "Periodo invalido",
        description: "O fim do periodo aquisitivo nao pode ser menor que o inicio.",
      });
      return;
    }

    try {
      setSaving(true);
      await RhPontoService.editarPeriodoFerias({
        empresaId: user.empresa_id,
        periodoFeriasId: periodoEditItem.id,
        periodoAquisitivoInicio: editPeriodoInicio,
        periodoAquisitivoFim: editPeriodoFim,
        saldoDias: Number(editPeriodoSaldoDias || 0),
      });
      await carregarFerias();
      addToast({
        type: "success",
        title: "Período aquisitivo atualizado com sucesso",
      });
      closeEditPeriodo();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao editar periodo aquisitivo",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel editar o periodo aquisitivo.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoverPeriodo = async (item: PeriodoFeriasItem) => {
    if (!user?.empresa_id) return;
    const confirmed = window.confirm("Deseja remover este periodo aquisitivo?");
    if (!confirmed) return;

    try {
      setSaving(true);
      await RhPontoService.removerPeriodoFerias({
        empresaId: user.empresa_id,
        periodoFeriasId: item.id,
      });
      await carregarFerias();
      addToast({
        type: "success",
        title: "Período aquisitivo removido com sucesso",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao remover periodo aquisitivo",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel remover o periodo aquisitivo.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemover = async (item: FeriasItem) => {
    if (!user?.empresa_id) return;
    const confirmed = window.confirm("Deseja remover este periodo de ferias?");
    if (!confirmed) return;

    try {
      setSaving(true);
      await RhPontoService.removerFerias({ empresaId: user.empresa_id, feriasId: item.id });
      await carregarFerias();
      addToast({
        type: "success",
        title: "Ferias removidas com sucesso",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao remover ferias",
        description: error instanceof Error ? error.message : "Nao foi possivel remover as ferias.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? "rh-vacations rh-vacations--embedded" : "rh-vacations"}>
      {!embedded && <MobileHeader title="Ferias" />}

      <section className="rh-vacations__filters">
        <div className="rh-vacations__filter-summary">
          <div>
            <span className="rh-vacations__filter-label">Colaborador selecionado</span>
            <strong>{colaboradorLabel}</strong>
          </div>
          <div>
            <span className="rh-vacations__filter-label">Periodo consultado</span>
            <strong>
              {formatDate(dataInicioFiltro)} ate {formatDate(dataFimFiltro)}
            </strong>
          </div>
        </div>

        <div className="rh-vacations__actions">
          <button
            className="rh-vacations__primary"
            type="button"
            onClick={openFilter}
            disabled={loading || saving || usuariosLoading}
          >
            <FiUser size={16} />
            Selecionar colaborador
          </button>
          <button
            className="rh-vacations__secondary"
            type="button"
            onClick={openPeriodFilter}
            disabled={loading || saving || !usuarioId}
          >
            Filtrar período
          </button>
          <button
            className="rh-vacations__secondary"
            type="button"
            onClick={handleLimparPesquisa}
            disabled={loading || saving}
          >
            Limpar pesquisa
          </button>
        </div>
      </section>

      <div
        className={
          embedded ? "rh-vacations-wrapper rh-vacations-wrapper--embedded" : "rh-vacations-wrapper"
        }
      >
        <section className="rh-vacations__create">
          <h2>GestÃ£o de ferias</h2>
          <p className="rh-vacations__subtitle">
            {usuarioSelecionado?.nome || usuarioSelecionado?.name || "Selecione um colaborador"}
          </p>

          <div className="rh-vacations__create-actions">
            <button
              className="rh-vacations__primary"
              type="button"
              onClick={openCreatePeriodo}
              disabled={saving || !usuarioId}
            >
              <FiPlusCircle size={16} />
              Cadastrar periodo aquisitivo
            </button>
            <button
              className="rh-vacations__primary"
              type="button"
              onClick={openCreate}
              disabled={saving || !usuarioId}
            >
              <FiPlusCircle size={16} />
              Cadastrar férias
            </button>
          </div>
        </section>

        <section className="rh-vacations__table">
          <div className="rh-vacations__table-header">
            <h2>Períodos aquisitivos</h2>
          </div>

          {!usuarioId ? (
            <div className="rh-vacations__empty">Selecione um colaborador para ver os periodos.</div>
          ) : periodosOrdenados.length === 0 ? (
            <div className="rh-vacations__empty">Nenhum periodo aquisitivo encontrado.</div>
          ) : (
            <div className="rh-vacations__table-wrapper">
              <table className="rh-vacations__gridtable">
                <thead>
                  <tr>
                    <th>Inicio</th>
                    <th>Fim</th>
                    <th>Saldo</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {periodosOrdenados.map((item) => (
                    <tr key={String(item.id)}>
                      <td>{formatDate(item.periodo_aquisitivo_inicio)}</td>
                      <td>{formatDate(item.periodo_aquisitivo_fim)}</td>
                      <td>{item.saldo_dias ?? "--"}</td>
                      <td>{getStatusLabel(item.status)}</td>
                      <td className="rh-vacations__row-actions">
                        <button type="button" onClick={() => openEditPeriodo(item)} disabled={saving}>
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemoverPeriodo(item)}
                          disabled={saving}
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rh-vacations__table">
          <div className="rh-vacations__table-header">
            <h2>Períodos de férias</h2>
          </div>

          {loading ? (
            <div className="rh-vacations__empty">Carregando...</div>
          ) : !usuarioId ? (
            <div className="rh-vacations__empty">Selecione um colaborador para ver as férias.</div>
          ) : listaOrdenada.length === 0 ? (
            <div className="rh-vacations__empty">Nenhum período encontrado.</div>
          ) : (
            <div className="rh-vacations__table-wrapper">
              <table className="rh-vacations__gridtable">
                <thead>
                  <tr>
                    <th>Inicio</th>
                    <th>Fim</th>
                    <th>Dias</th>
                    <th>Status</th>
                    <th>Observação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {listaOrdenada.map((item) => (
                    <tr key={String(item.id)}>
                      <td>{formatDate(item.data_inicio)}</td>
                      <td>{formatDate(item.data_fim)}</td>
                      <td>{calculateDays(item.data_inicio, item.data_fim)}</td>
                      <td>{getStatusLabel(item.status)}</td>
                      <td className="rh-vacations__cell-muted">{item.observacao || "--"}</td>
                      <td className="rh-vacations__row-actions">
                        <button type="button" onClick={() => openEdit(item)} disabled={saving}>
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemover(item)}
                          disabled={saving}
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Modal isOpen={editOpen} onClose={closeEdit} title="Editar ferias">
        <div className="rh-vacations__modal">
          <div className="rh-vacations__create-grid">
            <div className="rh-vacations__field">
              <label htmlFor="rh-vacations-edit-start">Inicio</label>
              <input
                id="rh-vacations-edit-start"
                type="date"
                value={editDataInicio}
                onChange={(e) => setEditDataInicio(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-vacations__field">
              <label htmlFor="rh-vacations-edit-end">Fim</label>
              <input
                id="rh-vacations-edit-end"
                type="date"
                value={editDataFim}
                onChange={(e) => setEditDataFim(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-vacations__field">
              <label htmlFor="rh-vacations-edit-status">Status</label>
              <select
                id="rh-vacations-edit-status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                disabled={saving}
              >
                <option value="pendente">Pendente</option>
                <option value="aprovado">Aprovado</option>
                <option value="reprovado">Reprovado</option>
              </select>
            </div>
            <div className="rh-vacations__field">
              <label htmlFor="rh-vacations-edit-periodo">Período aquisitivo</label>
              <select
                id="rh-vacations-edit-periodo"
                value={editPeriodoFeriasId}
                onChange={(e) => setEditPeriodoFeriasId(e.target.value)}
                disabled={saving}
              >
                <option value="">Selecionar automaticamente</option>
                {periodosOrdenados.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {formatDate(item.periodo_aquisitivo_inicio)} ate{" "}
                    {formatDate(item.periodo_aquisitivo_fim)} | saldo {item.saldo_dias ?? 0}
                  </option>
                ))}
              </select>
            </div>
            <div className="rh-vacations__field rh-vacations__field--full">
              <label htmlFor="rh-vacations-edit-obs">Observação</label>
              <textarea
                id="rh-vacations-edit-obs"
                rows={3}
                value={editObservacao}
                onChange={(e) => setEditObservacao(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="rh-vacations__modal-actions">
            <button type="button" onClick={closeEdit} disabled={saving}>
              Cancelar
            </button>
            <button
              className="rh-vacations__primary"
              type="button"
              onClick={() => void handleSalvarEdicao()}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={filterOpen} onClose={closeFilter} title="Selecionar colaborador">
        <div className="rh-vacations__modal">
          <div className="rh-vacations__create-grid">
            <div className="rh-vacations__field rh-vacations__field--full">
              <label htmlFor="rh-vacations-filter-user">
                <FiUser size={16} /> Colaborador
              </label>
              <select
                id="rh-vacations-filter-user"
                value={filtroUsuarioId}
                onChange={(e) => setFiltroUsuarioId(e.target.value)}
                disabled={usuariosLoading || loading || saving}
              >
                {usuarios.length === 0 ? (
                  <option value="">{usuariosLoading ? "Carregando..." : "Nenhum usuário"}</option>
                ) : (
                  <>
                    <option value="">Selecione um colaborador</option>
                    {usuarios.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.nome || item.name || `Usuario ${item.id}`}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="rh-vacations__modal-actions">
            <button type="button" onClick={closeFilter} disabled={loading || saving}>
              Cancelar
            </button>
            <button
              className="rh-vacations__primary"
              type="button"
              onClick={() => void handleAplicarColaborador()}
              disabled={loading || saving || usuariosLoading}
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={periodFilterOpen} onClose={closePeriodFilter} title="Filtrar período">
        <div className="rh-vacations__modal">
          <div className="rh-vacations__create-grid">
            <div className="rh-vacations__field">
              <label htmlFor="rh-vacations-period-start">Data inicio</label>
              <input
                id="rh-vacations-period-start"
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                disabled={loading || saving}
              />
            </div>

            <div className="rh-vacations__field">
              <label htmlFor="rh-vacations-period-end">Data fim</label>
              <input
                id="rh-vacations-period-end"
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                disabled={loading || saving}
              />
            </div>
          </div>

          <div className="rh-vacations__modal-actions">
            <button type="button" onClick={closePeriodFilter} disabled={loading || saving}>
              Cancelar
            </button>
            <button
              className="rh-vacations__primary"
              type="button"
              onClick={() => void handleAplicarPeriodo()}
              disabled={loading || saving}
            >
              {loading ? "Filtrando..." : "Aplicar filtro"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={createOpen} onClose={closeCreate} title="Cadastrar férias">
        <div className="rh-vacations__modal">
          <div className="rh-vacations__create-grid">
            <div className="rh-vacations__field">
              <label htmlFor="rh-vacations-new-start">Inicio</label>
              <input
                id="rh-vacations-new-start"
                type="date"
                value={novaDataInicio}
                onChange={(e) => setNovaDataInicio(e.target.value)}
                disabled={saving || !usuarioId}
              />
            </div>
            <div className="rh-vacations__field">
              <label htmlFor="rh-vacations-new-end">Fim</label>
              <input
                id="rh-vacations-new-end"
                type="date"
                value={novaDataFim}
                onChange={(e) => setNovaDataFim(e.target.value)}
                disabled={saving || !usuarioId}
              />
            </div>
            <div className="rh-vacations__field">
              <label htmlFor="rh-vacations-new-status">Status</label>
              <select
                id="rh-vacations-new-status"
                value={novoStatus}
                onChange={(e) => setNovoStatus(e.target.value)}
                disabled={saving || !usuarioId}
              >
                <option value="pendente">Pendente</option>
                <option value="aprovado">Aprovado</option>
                <option value="reprovado">Reprovado</option>
              </select>
            </div>
            <div className="rh-vacations__field">
              <label htmlFor="rh-vacations-new-periodo">Período aquisitivo</label>
              <select
                id="rh-vacations-new-periodo"
                value={novoPeriodoFeriasId}
                onChange={(e) => setNovoPeriodoFeriasId(e.target.value)}
                disabled={saving || !usuarioId}
              >
                <option value="">Selecionar automaticamente</option>
                {periodosOrdenados.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {formatDate(item.periodo_aquisitivo_inicio)} ate{" "}
                    {formatDate(item.periodo_aquisitivo_fim)} | saldo {item.saldo_dias ?? 0}
                  </option>
                ))}
              </select>
            </div>
            <div className="rh-vacations__field rh-vacations__field--full">
              <label htmlFor="rh-vacations-new-obs">Observação (opcional)</label>
              <textarea
                id="rh-vacations-new-obs"
                rows={3}
                value={novaObservacao}
                onChange={(e) => setNovaObservacao(e.target.value)}
                disabled={saving || !usuarioId}
              />
            </div>
          </div>

          <div className="rh-vacations__modal-actions">
            <button type="button" onClick={closeCreate} disabled={saving}>
              Cancelar
            </button>
            <button
              className="rh-vacations__primary"
              type="button"
              onClick={() => void handleCriar()}
              disabled={saving || !usuarioId}
            >
              {saving ? "Salvando..." : "Cadastrar férias"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={periodoCreateOpen}
        onClose={closeCreatePeriodo}
        title="Cadastrar período aquisitivo"
      >
        <div className="rh-vacations__modal">
          <div className="rh-vacations__create-grid">
            <div className="rh-vacations__field">
              <label htmlFor="rh-period-start">Inicio aquisitivo</label>
              <input
                id="rh-period-start"
                type="date"
                value={novoPeriodoInicio}
                onChange={(e) => setNovoPeriodoInicio(e.target.value)}
                disabled={saving || !usuarioId}
              />
            </div>
            <div className="rh-vacations__field">
              <label htmlFor="rh-period-end">Fim aquisitivo</label>
              <input
                id="rh-period-end"
                type="date"
                value={novoPeriodoFim}
                onChange={(e) => setNovoPeriodoFim(e.target.value)}
                disabled={saving || !usuarioId}
              />
            </div>
            <div className="rh-vacations__field">
              <label htmlFor="rh-period-saldo">Saldo dias</label>
              <input
                id="rh-period-saldo"
                type="number"
                min={0}
                value={novoPeriodoSaldoDias}
                onChange={(e) => setNovoPeriodoSaldoDias(e.target.value)}
                disabled={saving || !usuarioId}
              />
            </div>
          </div>

          <div className="rh-vacations__modal-actions">
            <button type="button" onClick={closeCreatePeriodo} disabled={saving}>
              Cancelar
            </button>
            <button
              className="rh-vacations__primary"
              type="button"
              onClick={() => void handleCriarPeriodo()}
              disabled={saving || !usuarioId}
            >
              {saving ? "Salvando..." : "Cadastrar período aquisitivo"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={periodoEditOpen}
        onClose={closeEditPeriodo}
        title="Editar período aquisitivo"
      >
        <div className="rh-vacations__modal">
          <div className="rh-vacations__create-grid">
            <div className="rh-vacations__field">
              <label htmlFor="rh-period-edit-start">Inicio aquisitivo</label>
              <input
                id="rh-period-edit-start"
                type="date"
                value={editPeriodoInicio}
                onChange={(e) => setEditPeriodoInicio(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-vacations__field">
              <label htmlFor="rh-period-edit-end">Fim aquisitivo</label>
              <input
                id="rh-period-edit-end"
                type="date"
                value={editPeriodoFim}
                onChange={(e) => setEditPeriodoFim(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-vacations__field">
              <label htmlFor="rh-period-edit-saldo">Saldo dias</label>
              <input
                id="rh-period-edit-saldo"
                type="number"
                min={0}
                value={editPeriodoSaldoDias}
                onChange={(e) => setEditPeriodoSaldoDias(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="rh-vacations__modal-actions">
            <button type="button" onClick={closeEditPeriodo} disabled={saving}>
              Cancelar
            </button>
            <button
              className="rh-vacations__primary"
              type="button"
              onClick={() => void handleSalvarPeriodo()}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
