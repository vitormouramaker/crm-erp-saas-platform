import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiClock,
  FiEdit2,
  FiExternalLink,
  FiMapPin,
  FiSave,
  FiSearch,
  FiUser,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import { useSearchParams } from "react-router-dom";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Modal } from "../../components/common/Modal/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  RhPontoService,
  type EmpresaFilialResumo,
  type EmpresaUsuarioResumo,
  type PontoDayInfo,
  type PontoDia,
  type PontoRegistro,
} from "../../service/pontoService";
import {
  collectPontoRegistroMetadata,
  describeGeolocalizacaoStatus,
} from "../../utils/pontoRegistroMetadata";
import "./EditarPontoUsuario.css";

const RH_TIMEZONE = "America/Sao_Paulo";

const BATIDA_TYPE_OPTIONS = [
  { value: "entrada_1", label: "Entrada 1" },
  { value: "saida_1", label: "Saida 1" },
  { value: "entrada_2", label: "Entrada 2" },
  { value: "saida_2", label: "Saida 2" },
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saida" },
] as const;

const BATIDA_TYPE_CREATE_OPTIONS = BATIDA_TYPE_OPTIONS.filter(
  (option) => option.value !== "entrada" && option.value !== "saida",
);

const batidaMarkerIcon = L.divIcon({
  className: "rh-edit-point__leaflet-marker rh-edit-point__leaflet-marker--batida",
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const filialMarkerIcon = L.divIcon({
  className: "rh-edit-point__leaflet-marker rh-edit-point__leaflet-marker--filial",
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapBoundsController({
  positions,
}: {
  positions: Array<[number, number]>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!positions.length) return;

    if (positions.length === 1) {
      map.setView(positions[0], 17);
      return;
    }

    map.fitBounds(positions, {
      padding: [32, 32],
    });
  }, [map, positions]);

  return null;
}

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value?: string): string {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: RH_TIMEZONE,
  }).format(parsed);
}

function formatMinutesAsHours(value?: number): string {
  const minutes = Number(value || 0);
  const signal = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `${signal}${h}:${m}`;
}

function toTimeInputValue(value?: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: RH_TIMEZONE,
  }).format(parsed);
}

function buildDataHora(data: string, hora: string): string {
  const normalizedHora = hora.trim().length === 5 ? `${hora}:00` : hora.trim();
  return `${data} ${normalizedHora}`;
}

function getCurrentTimeValue(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatBatidaTypeLabel(value?: string): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  const match = BATIDA_TYPE_OPTIONS.find(
    (option) => option.value === normalized,
  );
  if (match) return match.label;
  if (!normalized) return "--";
  return formatBackendLabel(normalized);
}

function formatBackendLabel(value?: string): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "--";
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatCoordinate(value: unknown): string {
  const parsed = parseCoordinate(value);
  return parsed === null ? "--" : parsed.toFixed(6);
}

function formatPrecisao(value: unknown): string {
  const parsed = parseCoordinate(value);
  return parsed === null ? "--" : `${Math.round(parsed)} m`;
}

function formatMeters(value: unknown): string {
  const parsed = parseCoordinate(value);
  return parsed === null ? "--" : `${Math.round(parsed)} m`;
}

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function resolveGeolocationLabel(status?: string | null): string {
  switch (status) {
    case "capturada":
      return "Capturada";
    case "negada":
      return "Permissao negada";
    case "timeout":
      return "Tempo esgotado";
    case "indisponivel":
      return "Indisponivel";
    case "nao_solicitada":
      return "Nao solicitada";
    default:
      return status || "Nao informada";
  }
}

function hasMapCoordinates(registro: PontoRegistro): boolean {
  return (
    parseCoordinate(registro.latitude) !== null &&
    parseCoordinate(registro.longitude) !== null
  );
}

function buildOpenStreetMapLink(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;
}

export function EditarPontoUsuario({
  embedded = false,
  fixedUsuarioId,
}: {
  embedded?: boolean;
  fixedUsuarioId?: number | string;
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const initialUsuario = String(
    fixedUsuarioId ?? searchParams.get("usuario_id") ?? "",
  );
  const lastUsuarioIdFromUrlRef = useRef(initialUsuario);

  const [usuarios, setUsuarios] = useState<EmpresaUsuarioResumo[]>([]);
  const [filiais, setFiliais] = useState<EmpresaFilialResumo[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuarioId, setUsuarioId] = useState(initialUsuario);
  const [dataReferencia, setDataReferencia] = useState(toInputDate(new Date()));
  const [hora, setHora] = useState("");
  const [tipo, setTipo] = useState("entrada_1");
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [loadedBuscaKey, setLoadedBuscaKey] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [infoDia, setInfoDia] = useState<PontoDayInfo | null>(null);
  const [dia, setDia] = useState<PontoDia | null>(null);
  const [editingRegistroId, setEditingRegistroId] = useState<
    number | string | null
  >(null);
  const [editRegistroHora, setEditRegistroHora] = useState("");
  const [editRegistroTipo, setEditRegistroTipo] = useState("entrada_1");
  const [registroMapaSelecionado, setRegistroMapaSelecionado] =
    useState<PontoRegistro | null>(null);

  const usuarioSelecionado = useMemo(
    () =>
      usuarios.find((item) => String(item.id) === String(usuarioId)) || null,
    [usuarioId, usuarios],
  );
  const filialSelecionada = useMemo(
    () =>
      filiais.find(
        (item) =>
          String(item.id) === String(usuarioSelecionado?.filial_id || ""),
      ) || null,
    [filiais, usuarioSelecionado?.filial_id],
  );
  const currentBuscaKey = `${usuarioId}|${dataReferencia}`;
  const hasDiaLoaded =
    loadedBuscaKey === currentBuscaKey && (infoDia !== null || dia !== null);

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
            : "Tente novamente mais tarde!",
      });
      setUsuarios([]);
    } finally {
      setUsuariosLoading(false);
    }
  }, [addToast, user?.empresa_id]);

  const carregarFiliais = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      const lista = await RhPontoService.listarFiliaisEmpresa(user.empresa_id);
      setFiliais(lista);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar filiais",
        description:
          error instanceof Error
            ? error.message
            : "Tente novamente mais tarde!",
      });
      setFiliais([]);
    }
  }, [addToast, user?.empresa_id]);

  useEffect(() => {
    void carregarUsuarios();
  }, [carregarUsuarios]);

  useEffect(() => {
    void carregarFiliais();
  }, [carregarFiliais]);

  useEffect(() => {
    if (fixedUsuarioId !== undefined && fixedUsuarioId !== null) {
      setUsuarioId(String(fixedUsuarioId));
      return;
    }
    const nextUsuarioId = searchParams.get("usuario_id") || "";
    if (nextUsuarioId === lastUsuarioIdFromUrlRef.current) return;
    lastUsuarioIdFromUrlRef.current = nextUsuarioId;
    setUsuarioId(nextUsuarioId);
  }, [fixedUsuarioId, searchParams]);

  const buscarDia = useCallback(async () => {
    if (!user?.empresa_id) return;
    if (!usuarioId) {
      addToast({
        type: "error",
        title: "Selecione um colaborador",
        description: "Escolha um colaborador antes de buscar o dia.",
      });
      return;
    }
    if (!dataReferencia) {
      addToast({
        type: "error",
        title: "Selecione uma data",
        description: "Informe a data que deseja consultar.",
      });
      return;
    }

    try {
      setLoading(true);
      console.log("[RH][EditarPonto] buscarDia:start", {
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        dataReferencia,
      });
      const resultado = await RhPontoService.recalcularDia(
        user.empresa_id,
        Number(usuarioId),
        dataReferencia,
      );
      console.log("[RH][EditarPonto] buscarDia:resultado", resultado);

      setDia({
        ...(resultado.apuracao || {}),
        data_referencia: resultado.apuracao?.data_referencia || dataReferencia,
        registros: resultado.contexto?.registros || [],
      });

      setInfoDia({
        permite_batida: !resultado.contexto?.day_off,
        data_referencia: dataReferencia,
        day_off:
          (resultado.contexto?.day_off as PontoDayInfo["day_off"]) || null,
        feriado:
          (resultado.contexto?.feriado as PontoDayInfo["feriado"]) || null,
        horario: resultado.contexto?.horario || null,
      });
      setLoadedBuscaKey(`${usuarioId}|${dataReferencia}`);
    } catch (error) {
      console.error("[RH][EditarPonto] buscarDia:error", error);
      addToast({
        type: "error",
        title: "Erro ao buscar o dia",
        description:
          error instanceof Error
            ? error.message
            : "Tente novamente mais tarde!",
      });
      setDia(null);
      setInfoDia(null);
      setLoadedBuscaKey(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, dataReferencia, user?.empresa_id, usuarioId]);

  const handleRegistrar = async () => {
    if (!user?.empresa_id) return;
    if (!usuarioId) {
      addToast({
        type: "error",
        title: "Selecione um colaborador",
        description: "Escolha um colaborador antes de registrar a batida.",
      });
      return;
    }

    try {
      setSaving(true);
      const horaReferencia = hora || getCurrentTimeValue();
      const dataHora = buildDataHora(dataReferencia, horaReferencia);
      const pontoMetadata = await collectPontoRegistroMetadata({
        origem_registro: "web_admin_manual",
        registrado_por_usuario_id: user.id,
        solicitarGeolocalizacao: false,
      });
      console.log("[RH][EditarPonto] registrar:start", {
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        tipo,
        dataReferencia,
        hora,
        horaReferencia,
        dataHora,
        pontoMetadata,
      });
      const response = await RhPontoService.registrarBatida(
        user.empresa_id,
        Number(usuarioId),
        tipo,
        dataHora,
        pontoMetadata,
      );
      console.log("[RH][EditarPonto] registrar:response", response);

      if (response.apuracao || response.contexto?.registros) {
        setDia((prev) => ({
          ...(prev || {}),
          ...(response.apuracao || {}),
          data_referencia: response.apuracao?.data_referencia || dataReferencia,
          registros: response.contexto?.registros || prev?.registros || [],
        }));
      }

      if (response.contexto) {
        setInfoDia((prev) => ({
          ...(prev || {}),
          day_off: response.contexto?.day_off ?? null,
          feriado: response.contexto?.feriado ?? null,
          horario: response.contexto?.horario ?? null,
          permite_batida: true,
          data_referencia: dataReferencia,
        }));
      }

      addToast({
        type: "success",
        title: "Batida registrada",
        description: describeGeolocalizacaoStatus(
          pontoMetadata.geolocalizacao_status,
        ),
      });
      setRegisterModalOpen(false);
      setHora("");
      setTipo("entrada_1");
      await buscarDia();
    } catch (error) {
      console.error("[RH][EditarPonto] registrar:error", error);
      addToast({
        type: "error",
        title: "Erro ao registrar batida",
        description:
          error instanceof Error
            ? error.message
            : "Tente novamente mais tarde!",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRecalcular = async () => {
    if (!user?.empresa_id) return;
    if (!usuarioId) {
      addToast({
        type: "error",
        title: "Selecione um colaborador",
        description: "Escolha um colaborador antes de recalcular o dia.",
      });
      return;
    }
    if (!dataReferencia) {
      addToast({
        type: "error",
        title: "Selecione uma data",
        description: "Informe a data que deseja recalcular.",
      });
      return;
    }

    try {
      setSaving(true);
      console.log("[RH][EditarPonto] recalcular:start", {
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        dataReferencia,
      });
      await RhPontoService.recalcularDia(
        user.empresa_id,
        Number(usuarioId),
        dataReferencia,
      );
      console.log("[RH][EditarPonto] recalcular:done");
      await buscarDia();
      addToast({
        type: "success",
        title: "Dia recalculado",
      });
    } catch (error) {
      console.error("[RH][EditarPonto] recalcular:error", error);
      addToast({
        type: "error",
        title: "Erro ao recalcular o dia",
        description:
          error instanceof Error
            ? error.message
            : "Tente novamente mais tarde!",
      });
    } finally {
      setSaving(false);
    }
  };

  const registros = (dia?.registros || []) as PontoRegistro[];
  const registroMapaLatitude = parseCoordinate(
    registroMapaSelecionado?.latitude,
  );
  const registroMapaLongitude = parseCoordinate(
    registroMapaSelecionado?.longitude,
  );
  const filialMapaLatitude = parseCoordinate(filialSelecionada?.latitude);
  const filialMapaLongitude = parseCoordinate(filialSelecionada?.longitude);
  const filialMapaTolerancia =
    parseCoordinate(filialSelecionada?.toleranceMeters) ?? 100;
  const mapaDisponivel =
    registroMapaLatitude !== null && registroMapaLongitude !== null;
  const filialMapaDisponivel =
    filialMapaLatitude !== null && filialMapaLongitude !== null;
  const distanciaBatidaFilial =
    mapaDisponivel && filialMapaDisponivel
      ? calculateDistanceMeters(
          registroMapaLatitude,
          registroMapaLongitude,
          filialMapaLatitude,
          filialMapaLongitude,
        )
      : null;
  const dentroDaTolerancia =
    distanciaBatidaFilial !== null
      ? distanciaBatidaFilial <= filialMapaTolerancia
      : null;
  const mapPositions: Array<[number, number]> = [];
  if (mapaDisponivel) {
    mapPositions.push([registroMapaLatitude, registroMapaLongitude]);
  }
  if (filialMapaDisponivel) {
    mapPositions.push([filialMapaLatitude, filialMapaLongitude]);
  }

  const handleStartEditRegistro = (registro: PontoRegistro) => {
    setEditingRegistroId(registro.id);
    setEditRegistroHora(toTimeInputValue(registro.data_hora));
    setEditRegistroTipo(registro.tipo || "entrada_1");
  };

  const handleCancelEditRegistro = () => {
    if (saving) return;
    setEditingRegistroId(null);
    setEditRegistroHora("");
    setEditRegistroTipo("entrada_1");
  };

  const handleSalvarRegistro = async (registroId: number | string) => {
    if (!user?.empresa_id || !usuarioId) return;
    if (!editRegistroHora) {
      addToast({
        type: "error",
        title: "Informe a hora da batida",
      });
      return;
    }

    try {
      setSaving(true);
      await RhPontoService.editarBatida({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        registroPontoId: registroId,
        tipo: editRegistroTipo,
        dataHora: buildDataHora(dataReferencia, editRegistroHora),
      });
      await buscarDia();
      handleCancelEditRegistro();
      addToast({
        type: "success",
        title: "Batida atualizada",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao atualizar batida",
        description:
          error instanceof Error
            ? error.message
            : "Tente novamente mais tarde!",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoverRegistro = async (registroId: number | string) => {
    if (!user?.empresa_id || !usuarioId) return;

    const confirmed = window.confirm("Deseja remover esta batida?");
    if (!confirmed) return;

    try {
      setSaving(true);
      await RhPontoService.deletarBatida({
        empresaId: user.empresa_id,
        usuarioId: Number(usuarioId),
        registroPontoId: registroId,
      });
      await buscarDia();
      if (editingRegistroId === registroId) {
        handleCancelEditRegistro();
      }
      addToast({
        type: "success",
        title: "Batida removida",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao remover batida",
        description:
          error instanceof Error
            ? error.message
            : "Tente novamente mais tarde!",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={
        embedded ? "rh-edit-point rh-edit-point--embedded" : "rh-edit-point"
      }
    >
      {!embedded && <MobileHeader title="Editar Ponto" />}
      <section className="rh-edit-point__filters">
        <div className="rh-edit-point__field">
          <label htmlFor="rh-edit-user">
            <FiUser size={16} /> Colaborador
          </label>
          {fixedUsuarioId !== undefined && fixedUsuarioId !== null ? (
            <input
              value={
                usuarioSelecionado?.nome ||
                usuarioSelecionado?.name ||
                "Carregando colaborador..."
              }
              readOnly
              disabled
            />
          ) : (
            <select
              id="rh-edit-user"
              value={usuarioId}
              onChange={(e) => setUsuarioId(e.target.value)}
              disabled={usuariosLoading || loading || saving}
            >
              {usuarios.length === 0 ? (
                <option value="">
                  {usuariosLoading ? "Carregando..." : "Nenhum usuario"}
                </option>
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
          )}
        </div>

        <div className="rh-edit-point__field">
          <label htmlFor="rh-edit-date">Data</label>
          <input
            id="rh-edit-date"
            type="date"
            value={dataReferencia}
            onChange={(e) => setDataReferencia(e.target.value)}
            disabled={loading || saving}
          />
        </div>

        <div className="rh-edit-point__actions">
          <button
            className="rh-edit-point__secondary"
            type="button"
            onClick={() => void buscarDia()}
            disabled={loading || saving || usuariosLoading}
          >
            <FiSearch size={16} />
            Buscar dia
          </button>
          <button
            className="rh-edit-point__danger"
            type="button"
            onClick={() => void handleRecalcular()}
            disabled={saving || loading || !usuarioId}
          >
            Recalcular dia
          </button>
        </div>
      </section>

      <div
        className={
          embedded
            ? "rh-edit-point-wrapper rh-edit-point-wrapper--embedded"
            : "rh-edit-point-wrapper"
        }
      >
        {hasDiaLoaded ? (
          <>
        <article className="rh-edit-point__card">
         
              <h2>Resumo</h2>
              <p className="rh-edit-point__muted">
                {usuarioSelecionado?.nome ||
                  usuarioSelecionado?.name ||
                  "Colaborador"}{" "}
                • {dataReferencia}
              </p>
            

          <div className="rh-edit-point__summary-grid">
            <div>
              <strong>Status</strong>
              <span>{formatBackendLabel(dia?.status)}</span>
            </div>
            <div>
              <strong>Permite batida</strong>
              <span>{infoDia?.permite_batida ? "Sim" : "Nao"}</span>
            </div>
            <div>
              <strong>Saldo</strong>
              <span>{formatMinutesAsHours(dia?.saldo_minutos)}</span>
            </div>
            <div>
              <strong>Trabalhado</strong>
              <span>{formatMinutesAsHours(dia?.minutos_trabalhados)}</span>
            </div>
          </div>

          {(infoDia?.day_off || infoDia?.feriado) && (
            <div className="rh-edit-point__alerts">
              {infoDia?.day_off && (
                <div className="rh-edit-point__alert">
                  <strong>Day-off:</strong>{" "}
                  <span>
                    {formatBackendLabel(
                      String(infoDia.day_off.tipo || "day-off"),
                    )}
                  </span>
                </div>
              )}
              {infoDia?.feriado && (
                <div className="rh-edit-point__alert">
                  <strong>Feriado:</strong>{" "}
                  <span>{String(infoDia.feriado.descricao || "feriado")}</span>
                </div>
              )}
            </div>
          )}
        </article>

        <section className="rh-edit-point__content">
          <article className="rh-edit-point__card">
            <div className="juscledi">
              <h2>Registros do dia</h2>
              <button
                className="rh-edit-point__register-toggle"
                type="button"
                onClick={() => setRegisterModalOpen(true)}
              >
                <FiClock size={16} />
                Registrar nova batida
              </button>
            </div>
            {registros.length === 0 ? (
              <p className="rh-edit-point__muted">Nenhuma batida encontrada.</p>
            ) : (
              <ul className="rh-edit-point__list">
                {registros.map((registro) => (
                  <li key={registro.id} className="rh-edit-point__list-item">
                    {editingRegistroId === registro.id ? (
                      <div className="rh-edit-point__list-edit">
                        <div className="rh-edit-point__list-edit-fields">
                          <select
                            value={editRegistroTipo}
                            onChange={(event) =>
                              setEditRegistroTipo(event.target.value)
                            }
                            disabled={saving}
                          >
                            {BATIDA_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={editRegistroHora}
                            onChange={(event) =>
                              setEditRegistroHora(event.target.value)
                            }
                            disabled={saving}
                          />
                        </div>
                        <div className="rh-edit-point__list-actions">
                          <button
                            type="button"
                            className="rh-edit-point__icon-button rh-edit-point__icon-button--save"
                            onClick={() =>
                              void handleSalvarRegistro(registro.id)
                            }
                            disabled={saving}
                          >
                            <FiSave size={15} />
                          </button>
                          <button
                            type="button"
                            className="rh-edit-point__icon-button"
                            onClick={handleCancelEditRegistro}
                            disabled={saving}
                          >
                            <FiX size={15} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="rh-edit-point__list-content">
                          <span className="rh-edit-point__tag">
                            {formatBatidaTypeLabel(registro.tipo)}
                          </span>
                        </div>
                        <div className="rh-edit-point__list-actions"></div>
                      </>
                    )}
                    <div className="rh-edit-point__list-main">
                      <span>{formatDateTime(registro.data_hora)}</span>                    
                    </div>
                    <div className="rh-edit-point__list-actions">
                      <button
                        type="button"
                        className="rh-edit-point__icon-button"
                        onClick={() => handleStartEditRegistro(registro)}
                        disabled={saving}
                      >
                        <FiEdit2 size={15} />
                      </button>
                      <button
                        type="button"
                        className="rh-edit-point__icon-button rh-edit-point__icon-button--danger"
                        onClick={() => void handleRemoverRegistro(registro.id)}
                        disabled={saving}
                      >
                        <FiTrash2 size={15} />
                      </button>
                      {hasMapCoordinates(registro) ? (
                        <button
                          type="button"
                          className="rh-edit-point__map-button"
                          onClick={() => setRegistroMapaSelecionado(registro)}
                        >
                          <FiMapPin size={16} />
                          Ver mapa
                        </button>
                      ) : (
                        <span className="rh-edit-point__meta rh-edit-point__meta--empty">
                          Sem coordenadas
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
          </>
        ) : (
          <article className="rh-edit-point__card">
            <h2>Consultar dia</h2>
            <p className="rh-edit-point__muted">
              Selecione o colaborador e a data, depois clique em "Buscar dia" para
              carregar o resumo e os registros.
            </p>
          </article>
        )}
      </div>

      <Modal
        isOpen={registerModalOpen}
        onClose={() => {
          if (saving) return;
          setRegisterModalOpen(false);
        }}
        title="Registrar nova batida"
      >
        <div className="rh-edit-point__register-grid">
          <div className="rh-edit-point__field">
            <label htmlFor="rh-edit-time">
              <FiClock size={16} /> Hora (opcional)
            </label>
            <input
              id="rh-edit-time"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              disabled={loading || saving}
            />
          </div>

          <div className="rh-edit-point__field">
            <label htmlFor="rh-edit-type">Tipo</label>
            <select
              id="rh-edit-type"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={loading || saving}
            >
              {BATIDA_TYPE_CREATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rh-edit-point__actions">
            <button
              className="rh-edit-point__primary"
              type="button"
              onClick={() => void handleRegistrar()}
              disabled={
                saving ||
                loading ||
                !usuarioId ||
                infoDia?.permite_batida === false
              }
            >
              <FiSave size={16} />
              {saving ? "Salvando..." : "Registrar batida"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(registroMapaSelecionado)}
        onClose={() => setRegistroMapaSelecionado(null)}
        title="Posicao da batida"
        size="lg"
      >
        {registroMapaSelecionado && (
          <div className="rh-edit-point__map-modal">
            <div className="rh-edit-point__map-summary">
              <div>
                <strong>Registro</strong>
                <span>{registroMapaSelecionado.tipo || "--"}</span>
              </div>
              <div>
                <strong>Data/hora</strong>
                <span>{formatDateTime(registroMapaSelecionado.data_hora)}</span>
              </div>
              <div>
                <strong>Latitude</strong>
                <span>
                  {formatCoordinate(registroMapaSelecionado.latitude)}
                </span>
              </div>
              <div>
                <strong>Longitude</strong>
                <span>
                  {formatCoordinate(registroMapaSelecionado.longitude)}
                </span>
              </div>
              <div>
                <strong>Precisao</strong>
                <span>
                  {formatPrecisao(registroMapaSelecionado.precisao_metros)}
                </span>
              </div>
              <div>
                <strong>Status geo</strong>
                <span>
                  {resolveGeolocationLabel(
                    registroMapaSelecionado.geolocalizacao_status,
                  )}
                </span>
              </div>
              <div>
                <strong>IP publico</strong>
                <span>{registroMapaSelecionado.ip_publico || "--"}</span>
              </div>
              <div>
                <strong>Faixa IP</strong>
                <span>{registroMapaSelecionado.faixa_ip || "--"}</span>
              </div>
              <div>
                <strong>Filial vinculada</strong>
                <span>
                  {filialSelecionada?.name ||
                    usuarioSelecionado?.filial_nome ||
                    "Sem filial vinculada"}
                </span>
              </div>
              <div>
                <strong>Tolerancia filial</strong>
                <span>{formatMeters(filialSelecionada?.toleranceMeters ?? 100)}</span>
              </div>
              <div>
                <strong>Distancia da filial</strong>
                <span>
                  {distanciaBatidaFilial === null
                    ? "--"
                    : `${Math.round(distanciaBatidaFilial)} m`}
                </span>
              </div>
              <div>
                <strong>Validacao de raio</strong>
                <span>
                  {dentroDaTolerancia === null
                    ? "Filial sem coordenadas"
                    : dentroDaTolerancia
                      ? "Dentro da tolerancia"
                      : "Fora da tolerancia"}
                </span>
              </div>
            </div>

            {mapPositions.length > 0 ? (
              <>
                <div className="rh-edit-point__map-frame">
                  <MapContainer
                    center={mapPositions[0]}
                    zoom={17}
                    scrollWheelZoom
                    className="rh-edit-point__leaflet-map"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapBoundsController positions={mapPositions} />
                    {mapaDisponivel ? (
                      <Marker
                        position={[registroMapaLatitude, registroMapaLongitude]}
                        icon={batidaMarkerIcon}
                      >
                        <Popup>
                          Batida registrada
                          <br />
                          {formatDateTime(registroMapaSelecionado.data_hora)}
                        </Popup>
                      </Marker>
                    ) : null}
                    {filialMapaDisponivel ? (
                      <>
                        <Marker
                          position={[filialMapaLatitude, filialMapaLongitude]}
                          icon={filialMarkerIcon}
                        >
                          <Popup>
                            {filialSelecionada?.name || "Filial vinculada"}
                            <br />
                            Tolerancia: {Math.round(filialMapaTolerancia)} m
                          </Popup>
                        </Marker>
                        <Circle
                          center={[filialMapaLatitude, filialMapaLongitude]}
                          radius={filialMapaTolerancia}
                          pathOptions={{
                            color: "#22c55e",
                            fillColor: "#86efac",
                            fillOpacity: 0.18,
                            weight: 2,
                          }}
                        />
                      </>
                    ) : null}
                  </MapContainer>
                </div>
                <div className="rh-edit-point__map-links">
                  {mapaDisponivel ? (
                    <a
                      className="rh-edit-point__map-link"
                      href={buildOpenStreetMapLink(
                        registroMapaLatitude,
                        registroMapaLongitude,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FiExternalLink size={16} />
                      Abrir batida no OpenStreetMap
                    </a>
                  ) : null}
                  {filialMapaDisponivel ? (
                    <a
                      className="rh-edit-point__map-link"
                      href={buildOpenStreetMapLink(
                        filialMapaLatitude,
                        filialMapaLongitude,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FiExternalLink size={16} />
                      Abrir filial no OpenStreetMap
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="rh-edit-point__muted">
                Este registro e a filial vinculada nao possuem coordenadas
                validas para exibicao no mapa.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
