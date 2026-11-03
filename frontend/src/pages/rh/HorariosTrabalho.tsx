import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiClock, FiEdit2, FiPlusCircle, FiTrash2, FiUser } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Modal } from "../../components/common/Modal/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  RhPontoService,
  type EmpresaUsuarioResumo,
  type HorarioFaixa,
  type HorarioTrabalhoItem,
} from "../../service/pontoService";
import "./HorariosTrabalho.css";

const WEEK_DAYS: Array<{ value: string; label: string }> = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terca" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sabado" },
];

function resolveHorarioId(item: HorarioTrabalhoItem): string {
  return String(item.usuario_horario_id || item.id || item.horario_trabalho_id || "");
}

function normalizeFaixas(value: unknown): HorarioFaixa[] {
  if (typeof value === "string") {
    try {
      return normalizeFaixas(JSON.parse(value));
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) return [];
  const faixas: HorarioFaixa[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const current = item as Record<string, unknown>;
    faixas.push({
      entrada: current.entrada ? String(current.entrada) : null,
      saida: current.saida ? String(current.saida) : null,
    });
  }
  return faixas;
}

function extractFaixasFromDias(value: unknown): HorarioFaixa[] {
  if (typeof value === "string") {
    try {
      return extractFaixasFromDias(JSON.parse(value));
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value) || value.length === 0) return [];

  const dias = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .sort((a, b) => Number(a.dia_semana ?? 99) - Number(b.dia_semana ?? 99));

  const primeiroDia = dias[0];
  if (!primeiroDia) return [];

  const faixas: HorarioFaixa[] = [];
  const entrada1 = primeiroDia.entrada_1 ? String(primeiroDia.entrada_1) : null;
  const saida1 = primeiroDia.saida_1 ? String(primeiroDia.saida_1) : null;
  const entrada2 = primeiroDia.entrada_2 ? String(primeiroDia.entrada_2) : null;
  const saida2 = primeiroDia.saida_2 ? String(primeiroDia.saida_2) : null;

  if (entrada1 || saida1) {
    faixas.push({ entrada: entrada1, saida: saida1 });
  }
  if (entrada2 || saida2) {
    faixas.push({ entrada: entrada2, saida: saida2 });
  }

  return faixas;
}

function resolveItemFaixas(item: HorarioTrabalhoItem): HorarioFaixa[] {
  const directFaixas = normalizeFaixas(item.faixas);
  if (directFaixas.length > 0) return directFaixas;

  const diasFaixas = extractFaixasFromDias(item.dias);
  if (diasFaixas.length > 0) return diasFaixas;

  const rootFaixas = extractFaixasFromDias([item as unknown as Record<string, unknown>]);
  return rootFaixas;
}

function formatFaixas(item: HorarioTrabalhoItem): string {
  const faixas = resolveItemFaixas(item);
  if (faixas.length === 0) return "--";
  return faixas
    .map((faixa) => {
      const entrada = faixa.entrada?.slice(0, 5) || "--:--";
      const saida = faixa.saida?.slice(0, 5) || "--:--";
      return `${entrada}-${saida}`;
    })
    .join(" | ");
}

function extractDiasFromItem(item: HorarioTrabalhoItem): string[] {
  if (Array.isArray(item.dias) && item.dias.length > 0) {
    const dias = item.dias
      .map((dia) => String(dia?.dia_semana ?? ""))
      .filter((dia) => dia !== "");
    if (dias.length > 0) return Array.from(new Set(dias));
  }

  if (item.dia_semana !== undefined && item.dia_semana !== null) {
    return [String(item.dia_semana)];
  }

  return [];
}

function formatDias(item: HorarioTrabalhoItem): string {
  const dias = extractDiasFromItem(item);
  if (dias.length === 0) return "--";

  return dias
    .map(
      (dia) =>
        WEEK_DAYS.find((weekDay) => weekDay.value === String(dia))?.label || String(dia),
    )
    .join(", ");
}

function parseTimeToMinutes(value: string): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function calculateCargaPrevista(
  entrada1: string,
  saida1: string,
  entrada2: string,
  saida2: string,
): string {
  const faixas = [
    [entrada1, saida1],
    [entrada2, saida2],
  ] as const;

  const total = faixas.reduce((acc, [entrada, saida]) => {
    const inicio = parseTimeToMinutes(entrada);
    const fim = parseTimeToMinutes(saida);
    if (inicio === null || fim === null || fim <= inicio) return acc;
    return acc + (fim - inicio);
  }, 0);

  return String(total);
}

export function HorariosTrabalho({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const initialUsuarioId = searchParams.get("usuario_id") || "";
  const lastUsuarioIdFromUrlRef = useRef(initialUsuarioId);
  const [usuarios, setUsuarios] = useState<EmpresaUsuarioResumo[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usuarioId, setUsuarioId] = useState(initialUsuarioId);
  const [lista, setLista] = useState<HorarioTrabalhoItem[]>([]);

  const [novoNome, setNovoNome] = useState("Horario padrao");
  const [novoDiasSelecionados, setNovoDiasSelecionados] = useState<string[]>([
    "1",
    "2",
    "3",
    "4",
    "5",
  ]);
  const [novaEntrada1, setNovaEntrada1] = useState("08:00");
  const [novaSaida1, setNovaSaida1] = useState("12:00");
  const [novaEntrada2, setNovaEntrada2] = useState("13:00");
  const [novaSaida2, setNovaSaida2] = useState("17:00");

  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<HorarioTrabalhoItem | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editDiasSelecionados, setEditDiasSelecionados] = useState<string[]>([]);
  const [editEntrada1, setEditEntrada1] = useState("");
  const [editSaida1, setEditSaida1] = useState("");
  const [editEntrada2, setEditEntrada2] = useState("");
  const [editSaida2, setEditSaida2] = useState("");

  const usuarioSelecionado = useMemo(
    () => usuarios.find((item) => String(item.id) === String(usuarioId)) || null,
    [usuarioId, usuarios],
  );
  const novoCargaCalculada = useMemo(
    () => calculateCargaPrevista(novaEntrada1, novaSaida1, novaEntrada2, novaSaida2),
    [novaEntrada1, novaSaida1, novaEntrada2, novaSaida2],
  );
  const editCargaCalculada = useMemo(
    () => calculateCargaPrevista(editEntrada1, editSaida1, editEntrada2, editSaida2),
    [editEntrada1, editSaida1, editEntrada2, editSaida2],
  );

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
        description:
          error instanceof Error ? error.message : "Nao foi possivel carregar os colaboradores.",
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

  const carregarHorarios = useCallback(async (showValidationMessage = false) => {
    if (!user?.empresa_id) return;
    if (!usuarioId) {
      if (showValidationMessage) {
        addToast({
          type: "warning",
          title: "Selecione um colaborador",
        });
      }
      setLista([]);
      return;
    }

    try {
      setLoading(true);
      const horarios = await RhPontoService.listarHorariosTrabalho({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
      });
      setLista(horarios || []);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao listar horarios",
        description: error instanceof Error ? error.message : "Nao foi possivel listar os horarios.",
      });
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, user?.empresa_id, usuarioId]);

  useEffect(() => {
    if (!usuarioId) {
      setLista([]);
      return;
    }
    void carregarHorarios(false);
  }, [carregarHorarios, usuarioId]);

  const buildFaixas = (
    entrada1: string,
    saida1: string,
    entrada2: string,
    saida2: string,
  ): HorarioFaixa[] => {
    const faixas: HorarioFaixa[] = [];
    if (entrada1 || saida1) faixas.push({ entrada: entrada1 || null, saida: saida1 || null });
    if (entrada2 || saida2) faixas.push({ entrada: entrada2 || null, saida: saida2 || null });
    return faixas;
  };

  const toggleDiaSelecionado = (
    current: string[],
    value: string,
    setValue: (dias: string[]) => void,
  ) => {
    const exists = current.includes(value);
    if (exists) {
      setValue(current.filter((dia) => dia !== value));
      return;
    }
    setValue([...current, value].sort((a, b) => Number(a) - Number(b)));
  };

  const buildDiasPayload = (
    diasSelecionados: string[],
    cargaPrevista: string,
    faixas: HorarioFaixa[],
  ) => {
    const faixa1 = faixas[0] || {};
    const faixa2 = faixas[1] || {};

    return diasSelecionados
      .map((dia) => Number(dia))
      .filter((dia) => Number.isFinite(dia))
      .map((diaSemana) => ({
        dia_semana: diaSemana,
        carga_horaria_diaria_minutos: Number(cargaPrevista || 0),
        carga_prevista_minutos: Number(cargaPrevista || 0),
        entrada_1: faixa1.entrada || null,
        saida_1: faixa1.saida || null,
        entrada_2: faixa2.entrada || null,
        saida_2: faixa2.saida || null,
      }));
  };

  const handleCriar = async () => {
    if (!user?.empresa_id) return;
    if (!usuarioId) {
      addToast({
        type: "warning",
        title: "Selecione um colaborador",
      });
      return;
    }
    if (novoDiasSelecionados.length === 0) {
      addToast({
        type: "warning",
        title: "Selecione ao menos um dia da semana",
      });
      return;
    }

    try {
      setSaving(true);
      const faixas = buildFaixas(novaEntrada1, novaSaida1, novaEntrada2, novaSaida2);
      const dias = buildDiasPayload(novoDiasSelecionados, novoCargaCalculada, faixas);
      await RhPontoService.cadastrarHorarioTrabalho({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        dados: {
          nome: novoNome || "Horario padrao",
          dia_semana: Number(novoDiasSelecionados[0]),
          carga_horaria_diaria_minutos: Number(novoCargaCalculada || 0),
          carga_prevista_minutos: Number(novoCargaCalculada || 0),
          faixas,
          dias,
        },
      });
      await carregarHorarios();
      addToast({
        type: "success",
        title: "Horario cadastrado com sucesso",
      });
      setCreateOpen(false);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao cadastrar horario",
        description: error instanceof Error ? error.message : "Nao foi possivel cadastrar o horario.",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: HorarioTrabalhoItem) => {
    const faixas = resolveItemFaixas(item);
    const dias = extractDiasFromItem(item);
    setEditItem(item);
    setEditNome(String(item.nome || "Horario padrao"));
    setEditDiasSelecionados(dias.length > 0 ? dias : ["1"]);
    setEditEntrada1(String(faixas[0]?.entrada || ""));
    setEditSaida1(String(faixas[0]?.saida || ""));
    setEditEntrada2(String(faixas[1]?.entrada || ""));
    setEditSaida2(String(faixas[1]?.saida || ""));
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditOpen(false);
    setEditItem(null);
  };

  const handleSalvarEdicao = async () => {
    if (!user?.empresa_id || !editItem || !usuarioId) return;
    const horarioId = resolveHorarioId(editItem);
    if (!horarioId) {
      addToast({
        type: "error",
        title: "Nao foi possivel identificar o horario selecionado",
      });
      return;
    }
    if (editDiasSelecionados.length === 0) {
      addToast({
        type: "warning",
        title: "Selecione ao menos um dia da semana",
      });
      return;
    }

    try {
      setSaving(true);
      const faixas = buildFaixas(editEntrada1, editSaida1, editEntrada2, editSaida2);
      const dias = buildDiasPayload(editDiasSelecionados, editCargaCalculada, faixas);
      await RhPontoService.editarHorarioTrabalho({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        usuarioHorarioId: horarioId,
        dados: {
          nome: editNome || "Horario padrao",
          dia_semana: Number(editDiasSelecionados[0]),
          carga_horaria_diaria_minutos: Number(editCargaCalculada || 0),
          carga_prevista_minutos: Number(editCargaCalculada || 0),
          faixas,
          dias,
        },
      });
      await carregarHorarios();
      addToast({
        type: "success",
        title: "Horario atualizado com sucesso",
      });
      closeEdit();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao editar horario",
        description: error instanceof Error ? error.message : "Nao foi possivel editar o horario.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemover = async (item: HorarioTrabalhoItem) => {
    if (!user?.empresa_id || !usuarioId) return;
    const horarioId = resolveHorarioId(item);
    if (!horarioId) {
      addToast({
        type: "error",
        title: "Nao foi possivel identificar o horario selecionado",
      });
      return;
    }

    const confirmed = window.confirm("Deseja remover este horario de trabalho?");
    if (!confirmed) return;

    try {
      setSaving(true);
      await RhPontoService.deletarHorarioTrabalho({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        usuarioHorarioId: horarioId,
      });
      await carregarHorarios();
      addToast({
        type: "success",
        title: "Horario removido com sucesso",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao remover horario",
        description: error instanceof Error ? error.message : "Nao foi possivel remover o horario.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLimparPesquisa = () => {
    if (loading || saving) return;
    setUsuarioId("");
    setLista([]);
  };

  const renderHorarioForm = ({
    mode,
    nome,
    setNome,
    diasSelecionados,
    setDiasSelecionados,
    cargaPrevista,
    entrada1,
    setEntrada1,
    saida1,
    setSaida1,
    entrada2,
    setEntrada2,
    saida2,
    setSaida2,
    onCancel,
    onSubmit,
  }: {
    mode: "create" | "edit";
    nome: string;
    setNome: (value: string) => void;
    diasSelecionados: string[];
    setDiasSelecionados: (dias: string[]) => void;
    cargaPrevista: string;
    entrada1: string;
    setEntrada1: (value: string) => void;
    saida1: string;
    setSaida1: (value: string) => void;
    entrada2: string;
    setEntrada2: (value: string) => void;
    saida2: string;
    setSaida2: (value: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
  }) => (
    <div className="rh-schedule__modal">
      <div className="rh-schedule__modal-layout">
        <section className="rh-schedule__group rh-schedule__group--summary">
          <h3>{mode === "create" ? "Novo horario" : "Edicao do horario"}</h3>
          <p className="rh-schedule__modal-description">
            Configure os dias da semana, a carga prevista e as faixas de entrada e saida.
          </p>
          <div className="rh-schedule__modal-summary">
            <div>
              <span>Colaborador</span>
              <strong>
                {usuarioSelecionado?.nome || usuarioSelecionado?.name || "Selecione um colaborador"}
              </strong>
            </div>
            <div>
              <span>Dias selecionados</span>
              <strong>{diasSelecionados.length}</strong>
            </div>
          </div>
        </section>

        <section className="rh-schedule__group">
          <h3>Informacoes gerais</h3>
          <div className="rh-schedule__modal-grid rh-schedule__modal-grid--info">
            <div className="rh-schedule__field">
              <label htmlFor={mode === "create" ? "rh-schedule-nome" : "rh-schedule-edit-nome"}>
                Nome
              </label>
              <input
                id={mode === "create" ? "rh-schedule-nome" : "rh-schedule-edit-nome"}
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-schedule__field">
              <label htmlFor={mode === "create" ? "rh-schedule-carga" : "rh-schedule-edit-carga"}>
                Carga prevista (min)
              </label>
              <input
                id={mode === "create" ? "rh-schedule-carga" : "rh-schedule-edit-carga"}
                type="number"
                min={0}
                value={cargaPrevista}
                readOnly
                disabled={saving}
              />
            </div>
          </div>
        </section>

        <section className="rh-schedule__group">
          <h3>Dias da semana</h3>
          <div className="rh-schedule__days-grid rh-schedule__days-grid--modal">
            {WEEK_DAYS.map((day) => (
              <label key={`${mode}-dia-${day.value}`} className="rh-schedule__day-check">
                <input
                  type="checkbox"
                  checked={diasSelecionados.includes(day.value)}
                  onChange={() =>
                    toggleDiaSelecionado(diasSelecionados, day.value, setDiasSelecionados)
                  }
                  disabled={saving}
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="rh-schedule__group">
          <h3>Faixas de horario</h3>
          <div className="rh-schedule__modal-grid rh-schedule__modal-grid--time">
            <div className="rh-schedule__field">
              <label htmlFor={mode === "create" ? "rh-schedule-entrada1" : "rh-schedule-edit-entrada1"}>
                Entrada 1
              </label>
              <input
                id={mode === "create" ? "rh-schedule-entrada1" : "rh-schedule-edit-entrada1"}
                type="time"
                value={entrada1}
                onChange={(event) => setEntrada1(event.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-schedule__field">
              <label htmlFor={mode === "create" ? "rh-schedule-saida1" : "rh-schedule-edit-saida1"}>
                Saida 1
              </label>
              <input
                id={mode === "create" ? "rh-schedule-saida1" : "rh-schedule-edit-saida1"}
                type="time"
                value={saida1}
                onChange={(event) => setSaida1(event.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-schedule__field">
              <label htmlFor={mode === "create" ? "rh-schedule-entrada2" : "rh-schedule-edit-entrada2"}>
                Entrada 2
              </label>
              <input
                id={mode === "create" ? "rh-schedule-entrada2" : "rh-schedule-edit-entrada2"}
                type="time"
                value={entrada2}
                onChange={(event) => setEntrada2(event.target.value)}
                disabled={saving}
              />
            </div>
            <div className="rh-schedule__field">
              <label htmlFor={mode === "create" ? "rh-schedule-saida2" : "rh-schedule-edit-saida2"}>
                Saida 2
              </label>
              <input
                id={mode === "create" ? "rh-schedule-saida2" : "rh-schedule-edit-saida2"}
                type="time"
                value={saida2}
                onChange={(event) => setSaida2(event.target.value)}
                disabled={saving}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="rh-schedule__modal-actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button className="rh-schedule__primary" type="button" onClick={onSubmit} disabled={saving || !usuarioId}>
          {mode === "create" ? <FiPlusCircle size={16} /> : <FiClock size={16} />}
          {saving ? "Salvando..." : mode === "create" ? "Cadastrar horário" : "Salvar"}
        </button>
      </div>
    </div>
  );

  return (
    <div className={embedded ? "rh-schedule rh-schedule--embedded" : "rh-schedule"}>
      {!embedded && <MobileHeader title="Horários de Trabalho" />}

      <section className="rh-schedule__filters">
        <div className="rh-schedule__field">
          <label htmlFor="rh-schedule-user">
            <FiUser size={16} /> Colaborador
          </label>
          <select
            id="rh-schedule-user"
            value={usuarioId}
            onChange={(event) => setUsuarioId(event.target.value)}
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

        <div className="rh-schedule__actions">
          
          <button
            className="rh-schedule__primary"
            type="button"
            onClick={() => void carregarHorarios(true)}
            disabled={loading || saving || usuariosLoading}
          >
            {loading ? "Carregando..." : "Buscar"}
          </button>
          <button
            className="rh-schedule__secondary"
            type="button"
            onClick={handleLimparPesquisa}
            disabled={loading || saving || usuariosLoading}
          >
            Limpar
          </button>
        </div>
      </section>

      <div className={embedded ? "rh-schedule-wrapper rh-schedule-wrapper--embedded" : "rh-schedule-wrapper"}>
        <section className="rh-schedule__create">
          <h2>Gestão de horários</h2>
          <p className="rh-schedule__subtitle">
            {usuarioSelecionado?.nome || usuarioSelecionado?.name || "Selecione um colaborador"}
          </p>

          <button
            className="rh-schedule__primary"
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={saving || !usuarioId}
          >
            <FiPlusCircle size={16} />
            Cadastrar horário
          </button>
        </section>

        <section className="rh-schedule__table">
          <div className="rh-schedule__table-header">
            <h2>Horários cadastrados</h2>
            <span>{lista.length} item(ns)</span>
          </div>

          {loading ? (
            <div className="rh-schedule__empty">Carregando...</div>
          ) : lista.length === 0 ? (
            <div className="rh-schedule__empty">Nenhum horário encontrado.</div>
          ) : (
            <div className="rh-schedule__table-wrapper">
              <table className="rh-schedule__gridtable">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Dia</th>
                    <th>Carga (min)</th>
                    <th>Faixas</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((item) => (
                    <tr key={resolveHorarioId(item)}>
                      <td>{item.nome || "--"}</td>
                      <td>{formatDias(item)}</td>
                      <td>
                        {item.carga_horaria_diaria_minutos || item.carga_prevista_minutos || "--"}
                      </td>
                      <td>{formatFaixas(item)}</td>
                      <td className="rh-schedule__row-actions">
                        <button type="button" onClick={() => openEdit(item)} disabled={saving}>
                          <FiEdit2 size={16} />
                        </button>
                        <button type="button" onClick={() => void handleRemover(item)} disabled={saving}>
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

      <Modal isOpen={editOpen} onClose={closeEdit} title="Editar horário de trabalho" size="lg">
        {renderHorarioForm({
          mode: "edit",
          nome: editNome,
          setNome: setEditNome,
          diasSelecionados: editDiasSelecionados,
          setDiasSelecionados: setEditDiasSelecionados,
          cargaPrevista: editCargaCalculada,
          entrada1: editEntrada1,
          setEntrada1: setEditEntrada1,
          saida1: editSaida1,
          setSaida1: setEditSaida1,
          entrada2: editEntrada2,
          setEntrada2: setEditEntrada2,
          saida2: editSaida2,
          setSaida2: setEditSaida2,
          onCancel: closeEdit,
          onSubmit: () => void handleSalvarEdicao(),
        })}
      </Modal>

      <Modal
        isOpen={createOpen}
        onClose={() => {
          if (saving) return;
          setCreateOpen(false);
        }}
        title="Novo horário de trabalho"
        size="lg"
      >
        {renderHorarioForm({
          mode: "create",
          nome: novoNome,
          setNome: setNovoNome,
          diasSelecionados: novoDiasSelecionados,
          setDiasSelecionados: setNovoDiasSelecionados,
          cargaPrevista: novoCargaCalculada,
          entrada1: novaEntrada1,
          setEntrada1: setNovaEntrada1,
          saida1: novaSaida1,
          setSaida1: setNovaSaida1,
          entrada2: novaEntrada2,
          setEntrada2: setNovaEntrada2,
          saida2: novaSaida2,
          setSaida2: setNovaSaida2,
          onCancel: () => setCreateOpen(false),
          onSubmit: () => void handleCriar(),
        })}
      </Modal>
    </div>
  );
}
