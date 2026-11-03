import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2, FiPlusCircle, FiSearch, FiTrash2 } from "react-icons/fi";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Modal } from "../../components/common/Modal/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { RhPontoService, type FeriadoItem } from "../../service/pontoService";
import "./Feriados.css";

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultRange() {
  const year = new Date().getFullYear();
  return {
    dataInicio: toInputDate(new Date(year, 0, 1)),
    dataFim: toInputDate(new Date(year, 11, 31)),
  };
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

export function Feriados({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const defaultRange = useMemo(() => getDefaultRange(), []);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dataInicio, setDataInicio] = useState(defaultRange.dataInicio);
  const [dataFim, setDataFim] = useState(defaultRange.dataFim);
  const [feriados, setFeriados] = useState<FeriadoItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [novoData, setNovoData] = useState(toInputDate(new Date()));
  const [novoDescricao, setNovoDescricao] = useState("");
  const [novoTipo, setNovoTipo] = useState("");
  const [novoAtivo, setNovoAtivo] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<FeriadoItem | null>(null);
  const [editData, setEditData] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [editAtivo, setEditAtivo] = useState(true);

  const canLoad = Boolean(user?.empresa_id);

  const carregar = useCallback(
    async (periodo?: { dataInicio?: string; dataFim?: string }) => {
      if (!user?.empresa_id) return;

      const inicio = periodo?.dataInicio ?? dataInicio;
      const fim = periodo?.dataFim ?? dataFim;

      if (fim && inicio && fim < inicio) {
        addToast({
          type: "error",
          title: "Periodo invalido",
          description: "A data final nao pode ser menor que a data inicial.",
        });
        return;
      }

      try {
        setLoading(true);
        const lista = await RhPontoService.listarFeriados({
          empresaId: user.empresa_id,
          dataInicio: inicio || undefined,
          dataFim: fim || undefined,
        });
        setFeriados(lista);
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro ao listar feriados",
          description:
            error instanceof Error ? error.message : "Tente novamente mais tarde!",
        });
        setFeriados([]);
      } finally {
        setLoading(false);
      }
    },
    [addToast, dataFim, dataInicio, user?.empresa_id],
  );

  useEffect(() => {
    if (canLoad) void carregar();
  }, [canLoad]);

  const feriadosOrdenados = useMemo(() => {
    return [...feriados].sort((a, b) =>
      String(a.data_referencia || "").localeCompare(String(b.data_referencia || "")),
    );
  }, [feriados]);

  const handleBuscar = async () => {
    await carregar();
  };

  const handleLimpar = async () => {
    setDataInicio(defaultRange.dataInicio);
    setDataFim(defaultRange.dataFim);
    await carregar(defaultRange);
  };

  const openCreate = () => {
    setNovoData(toInputDate(new Date()));
    setNovoDescricao("");
    setNovoTipo("");
    setNovoAtivo(true);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (saving) return;
    setCreateOpen(false);
  };

  const handleCriar = async () => {
    if (!user?.empresa_id) return;
    if (!novoData || !novoDescricao.trim()) {
      addToast({
        type: "error",
        title: "Preencha os campos obrigatorios",
        description: "Informe data e descricao.",
      });
      return;
    }

    try {
      setSaving(true);
      await RhPontoService.criarFeriado({
        empresaId: user.empresa_id,
        dataReferencia: novoData,
        descricao: novoDescricao.trim(),
        tipo: novoTipo || undefined,
        ativo: novoAtivo,
      });
      setCreateOpen(false);
      await carregar();
      addToast({ type: "success", title: "Feriado cadastrado" });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao criar feriado",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde!",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: FeriadoItem) => {
    setEditItem(item);
    setEditData(String(item.data_referencia || toInputDate(new Date())));
    setEditDescricao(String(item.descricao || ""));
    setEditTipo(String(item.tipo || ""));
    setEditAtivo(Boolean(item.ativo ?? true));
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditOpen(false);
    setEditItem(null);
  };

  const handleSalvarEdicao = async () => {
    if (!user?.empresa_id || !editItem) return;
    if (!editData || !editDescricao.trim()) {
      addToast({
        type: "error",
        title: "Preencha os campos obrigatorios",
        description: "Informe data e descricao.",
      });
      return;
    }

    try {
      setSaving(true);
      await RhPontoService.editarFeriado({
        empresaId: user.empresa_id,
        feriadoId: editItem.id,
        dataReferencia: editData,
        descricao: editDescricao.trim(),
        tipo: editTipo || undefined,
        ativo: editAtivo,
      });
      await carregar();
      closeEdit();
      addToast({ type: "success", title: "Feriado atualizado" });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao editar feriado",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde!",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemover = async (item: FeriadoItem) => {
    if (!user?.empresa_id) return;
    const confirmed = window.confirm("Deseja remover este feriado?");
    if (!confirmed) return;

    try {
      setSaving(true);
      await RhPontoService.removerFeriado({
        empresaId: user.empresa_id,
        feriadoId: item.id,
      });
      await carregar();
      addToast({ type: "success", title: "Feriado removido" });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao remover feriado",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde!",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? "rh-holidays rh-holidays--embedded" : "rh-holidays"}>
      {!embedded && <MobileHeader title="Feriados" />}

      <section className="rh-holidays__filters">
        <div className="rh-holidays__field">
          <label htmlFor="rh-holidays-start">Data inicio</label>
          <input
            id="rh-holidays-start"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            disabled={loading || saving}
          />
        </div>
        <div className="rh-holidays__field">
          <label htmlFor="rh-holidays-end">Data fim</label>
          <input
            id="rh-holidays-end"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            disabled={loading || saving}
          />
        </div>
        <div className="rh-holidays__actions">
          <button
            className="rh-holidays__primary"
            type="button"
            onClick={() => void handleBuscar()}
            disabled={loading || saving}
          >
            <FiSearch size={16} />
            Buscar
          </button>
          <button
            className="rh-holidays__secondary"
            type="button"
            onClick={() => void handleLimpar()}
            disabled={loading || saving}
          >
            Limpar
          </button>
        </div>
      </section>

      <div
        className={
          embedded ? "rh-holidays-wrapper rh-holidays-wrapper--embedded" : "rh-holidays-wrapper"
        }
      >
        <section className="rh-holidays__create rh-holidays__create--action">
          <div>
            <h2>Novo feriado</h2>
            <p>Cadastre datas especiais sem ocupar a area principal da listagem.</p>
          </div>
          <button
            className="rh-holidays__primary"
            type="button"
            onClick={openCreate}
            disabled={saving}
          >
            <FiPlusCircle size={16} />
            Cadastrar feriado
          </button>
        </section>

        <section className="rh-holidays__table">
          <div className="rh-holidays__table-header">
            <h2>Feriados cadastrados</h2>
            <span>{feriados.length} item(ns)</span>
          </div>

          {loading ? (
            <div className="rh-holidays__empty">Carregando...</div>
          ) : feriadosOrdenados.length === 0 ? (
            <div className="rh-holidays__empty">Nenhum feriado encontrado.</div>
          ) : (
            <div className="rh-holidays__table-wrapper">
              <table className="rh-holidays__gridtable">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descricao</th>
                    <th>Tipo</th>
                    <th>Ativo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {feriadosOrdenados.map((item) => (
                    <tr key={String(item.id)}>
                      <td>{formatDate(item.data_referencia)}</td>
                      <td>{item.descricao || "--"}</td>
                      <td>{item.tipo || "--"}</td>
                      <td>{item.ativo === false ? "Nao" : "Sim"}</td>
                      <td className="rh-holidays__row-actions">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          disabled={saving}
                        >
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

      <Modal isOpen={createOpen} onClose={closeCreate} title="Novo feriado">
        <div className="rh-holidays__modal">
          <div className="rh-holidays__create-grid">
            <div className="rh-holidays__field">
              <label htmlFor="rh-holidays-new-date">Data</label>
              <input
                id="rh-holidays-new-date"
                type="date"
                value={novoData}
                onChange={(e) => setNovoData(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-holidays__field">
              <label htmlFor="rh-holidays-new-desc">Descricao</label>
              <input
                id="rh-holidays-new-desc"
                value={novoDescricao}
                onChange={(e) => setNovoDescricao(e.target.value)}
                placeholder="Ex: Natal"
                disabled={saving}
              />
            </div>
            <div className="rh-holidays__field">
              <label htmlFor="rh-holidays-new-type">Tipo (opcional)</label>
              <input
                id="rh-holidays-new-type"
                value={novoTipo}
                onChange={(e) => setNovoTipo(e.target.value)}
                placeholder="Ex: nacional"
                disabled={saving}
              />
            </div>
            <div className="rh-holidays__toggle">
              <label htmlFor="rh-holidays-new-active">
                <input
                  id="rh-holidays-new-active"
                  type="checkbox"
                  checked={novoAtivo}
                  onChange={(e) => setNovoAtivo(e.target.checked)}
                  disabled={saving}
                />
                Ativo
              </label>
            </div>
          </div>

          <div className="rh-holidays__modal-actions">
            <button type="button" onClick={closeCreate} disabled={saving}>
              Cancelar
            </button>
            <button
              className="rh-holidays__primary"
              type="button"
              onClick={() => void handleCriar()}
              disabled={saving}
            >
              <FiPlusCircle size={16} />
              {saving ? "Salvando..." : "Cadastrar feriado"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editOpen} onClose={closeEdit} title="Editar feriado">
        <div className="rh-holidays__modal">
          <div className="rh-holidays__create-grid">
            <div className="rh-holidays__field">
              <label htmlFor="rh-holidays-edit-date">Data</label>
              <input
                id="rh-holidays-edit-date"
                type="date"
                value={editData}
                onChange={(e) => setEditData(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-holidays__field">
              <label htmlFor="rh-holidays-edit-desc">Descricao</label>
              <input
                id="rh-holidays-edit-desc"
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-holidays__field">
              <label htmlFor="rh-holidays-edit-type">Tipo</label>
              <input
                id="rh-holidays-edit-type"
                value={editTipo}
                onChange={(e) => setEditTipo(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-holidays__toggle">
              <label htmlFor="rh-holidays-edit-active">
                <input
                  id="rh-holidays-edit-active"
                  type="checkbox"
                  checked={editAtivo}
                  onChange={(e) => setEditAtivo(e.target.checked)}
                  disabled={saving}
                />
                Ativo
              </label>
            </div>
          </div>

          <div className="rh-holidays__modal-actions">
            <button type="button" onClick={closeEdit} disabled={saving}>
              Cancelar
            </button>
            <button
              className="rh-holidays__primary"
              type="button"
              onClick={() => void handleSalvarEdicao()}
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
