import { useEffect, useMemo, useState } from "react";
import {
  FiChevronDown,
  FiClock,
  FiMail,
  FiMessageCircle,
  FiPhone,
  FiPhoneCall,
  FiShoppingBag,
  FiSlash,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";
import {
  useToast,
} from "../../../contexts/ToastContext";
import {
  getCommercialCustomerHistory,
  finalizeCommercialInteraction,
  type CustomerProfile,
  type HistoryEntry,
  type Interaction,
} from "../../../service/commercialService";
import "./CustomerHistoryModal.css";

type CustomerHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
};

function AttendanceCard({
  interaction,
  formatCurrency,
  isLast,
  onFinalize,
}: {
  interaction: Interaction;
  formatCurrency: (val: number) => string;
  isLast: boolean;
  onFinalize?: (interaction: Interaction) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(Boolean(interaction.isCurrent));

  const getIconForType = (type: string) => {
    if (type === "sale") return <FiShoppingBag />;
    if (type === "call") return <FiPhoneCall />;
    if (type === "meeting") return <FiUsers />;
    if (type === "refusal") return <FiSlash />;
    return <FiMessageCircle />;
  };

  const getLabelForType = (type: string) => {
    if (type === "sale") return "Compra realizada";
    if (type === "call") return "Ligacao";
    if (type === "meeting") return "Reuniao";
    if (type === "whatsapp") return "WhatsApp";
    if (type === "refusal") return "Venda recusada";
    return "Interacao";
  };

  const formatTimeRange = (startStr: string | null, endStr?: string) => {
    if (!startStr) return "-";
    const start = new Date(startStr);
    const startTime = start.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (!endStr) return startTime;

    const end = new Date(endStr);
    const endTime = end.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const startDate = start.toLocaleDateString("pt-BR");
    const endDate = end.toLocaleDateString("pt-BR");
    return startDate === endDate
      ? `${startTime} - ${endTime}`
      : `${startDate} ${startTime} - ${endDate} ${endTime}`;
  };

  return (
    <div className={`timeline-row ${interaction.isCurrent ? "current-row" : ""}`}>
      <div className="timeline-left-col">
        <div className="timeline-line" style={{ display: isLast ? "none" : "block" }} />
        <div
          className={`timeline-icon-bubble ${interaction.type} ${
            interaction.isCurrent ? "pulse-icon" : ""
          }`}
        >
          {getIconForType(interaction.type)}
        </div>
      </div>

      <div
        className={`attendance-card-wrapper ${
          interaction.isCurrent ? "current-card" : ""
        } ${interaction.type === "refusal" ? "refusal-card" : ""}`}
      >
        {interaction.isCurrent && <div className="current-badge">Em andamento</div>}
        {interaction.type === "refusal" && <div className="refusal-badge">Proposta recusada</div>}

        <div className="attendance-card">
          <div
            className={`attendance-header ${isExpanded ? "expanded" : ""}`}
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            <div className="attendance-title-row">
              <div className="attendance-title-text">
                <span className="attendance-main-title">
                  {interaction.category === "agendamento"
                    ? `Agendamento de ${
                        interaction.date
                          ? new Date(interaction.date).toLocaleDateString("pt-BR")
                          : "-"
                      }`
                    : interaction.isCurrent
                    ? "Atendimento atual"
                    : `Atendimento de ${
                        interaction.date
                          ? new Date(interaction.date).toLocaleDateString("pt-BR")
                          : "-"
                      }`}
                </span>
                <span className="attendance-subtitle">
                  {interaction.category === "agendamento"
                    ? `${formatTimeRange(interaction.date, interaction.endDate)} • ${getLabelForType(interaction.type)}`
                    : interaction.isCurrent
                    ? `${interaction.date ? new Date(interaction.date).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }) : "-"} • ${getLabelForType(interaction.type)}`
                    : `${formatTimeRange(interaction.date, interaction.endDate)} • ${getLabelForType(interaction.type)}`}
                </span>
              </div>
            </div>
            <FiChevronDown className={`expand-icon ${isExpanded ? "rotated" : ""}`} size={20} />
          </div>

          {isExpanded && (
            <div className="attendance-body">
              <p className="attendance-desc">{interaction.description}</p>
              <div className="attendance-footer">
                <div className="attendant-badge">
                  <FiUser /> {interaction.attendantName}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {interaction.duration && (
                    <span className="attendant-badge">
                      <FiClock /> {interaction.duration}
                    </span>
                  )}
                  {typeof interaction.value === "number" && (
                    <span className="value-badge">{formatCurrency(interaction.value)}</span>
                  )}
                  {interaction.isCurrent && onFinalize ? (
                    <button
                      type="button"
                      className="attendance-finalize-btn"
                      onClick={() => onFinalize(interaction)}
                    >
                      Finalizar interacao
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryCard({
  item,
  isLast,
}: {
  item: HistoryEntry;
  isLast: boolean;
}) {
  return (
    <div className="timeline-row">
      <div className="timeline-left-col">
        <div className="timeline-line" style={{ display: isLast ? "none" : "block" }} />
        <div className="timeline-icon-bubble">
          <FiClock />
        </div>
      </div>

      <div className="attendance-card-wrapper">
        <div className="attendance-card">
          <div className="attendance-header expanded">
            <div className="attendance-title-row">
              <div className="attendance-title-text">
                <span className="attendance-main-title">{item.title || "Registro"}</span>
                <span className="attendance-subtitle">
                  {(item.date ? new Date(item.date).toLocaleString("pt-BR") : "-") +
                    " • " +
                    (item.attendantName || "Sistema")}
                </span>
              </div>
            </div>
          </div>
          <div className="attendance-body">
            <p className="attendance-desc">{item.description || "-"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomerHistoryModal({
  isOpen,
  onClose,
  dealId,
}: CustomerHistoryModalProps) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (!isOpen || !dealId) {
      setProfile(null);
      return;
    }

    setLoading(true);
    getCommercialCustomerHistory(dealId)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [dealId, isOpen]);
  const orderedInteractions = useMemo(() => {
    if (!profile?.interactions) return [];

    return [...profile.interactions].sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;

      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });
  }, [profile?.interactions]);

  const orderedAppointments = useMemo(() => {
    if (!profile?.appointments) return [];

    return [...profile.appointments].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });
  }, [profile?.appointments]);

  const orderedHistory = useMemo(() => {
    if (!profile?.history) return [];
    return [...profile.history].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });
  }, [profile?.history]);

  if (!isOpen) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const hasInteractions = Boolean(profile?.interactions?.length);
  const hasAppointments = Boolean(profile?.appointments?.length);
  const hasHistory = Boolean(profile?.history?.length);

  const handleFinalizeInteraction = async (interaction: Interaction) => {
    if (!dealId) return;
    if (!interaction.isCurrent) return;
    const confirmed = window.confirm("Finalizar interacao em andamento?");
    if (!confirmed) return;

    try {
      await finalizeCommercialInteraction(interaction.id);
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Interacao finalizada.",
      });
      const nextProfile = await getCommercialCustomerHistory(dealId);
      setProfile(nextProfile);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Nao foi possivel finalizar a interacao.",
      });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content customer-history-modal">
        <div className="modal-header header-simple">
          <h3 style={{ margin: 0 }}>Histórico do cliente</h3>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#718096" }}>
            Carregando histórico...
          </div>
        ) : profile ? (
          <>
            <div className="history-header">
              <div className="customer-main-info">
                <div className="customer-identity">
                  <h2>{profile.name}</h2>
                  <span className="customer-since">
                    Cliente desde{" "}
                    {profile.entryDate ? new Date(profile.entryDate).toLocaleDateString("pt-BR") : "-"}
                  </span>
                  <span className="customer-since">
                    Ultima interacao{" "}
                    {profile.lastInteraction
                      ? new Date(profile.lastInteraction).toLocaleDateString("pt-BR")
                      : "ainda nao registrada"}
                  </span>
                </div>
              </div>

              <div className="customer-contact-grid">
                <div className="contact-item">
                  <FiMail /> {profile.email || "-"}
                </div>
                <div className="contact-item">
                  <FiPhone /> {profile.phone || "-"}
                </div>
              </div>
            </div>

            <div className="history-kpis">
              <div className="history-kpi-card">
                <span className="kpi-label">Total gasto</span>
                <span className="kpi-value money">{formatCurrency(profile.totalSpent)}</span>
              </div>
              <div className="history-kpi-card">
                <span className="kpi-label">Compras realizadas</span>
                <span className="kpi-value">{profile.totalPurchases}</span>
              </div>
              <div className="history-kpi-card">
                <span className="kpi-label">Ticket médio</span>
                <span className="kpi-value">{formatCurrency(profile.averageTicket)}</span>
              </div>
            </div>

            <div className="history-timeline-container">
              <h4 style={{ margin: "0 0 12px", color: "#2d3748" }}>Interações (ações do atendimento)</h4>
              {hasInteractions ? (
                <div className="timeline-list">
                  {orderedInteractions.map((interaction, index) => (
                    <AttendanceCard
                      key={interaction.id}
                      interaction={interaction}
                      formatCurrency={formatCurrency}
                      isLast={index === orderedInteractions.length - 1}
                      onFinalize={handleFinalizeInteraction}
                    />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: 16,
                    textAlign: "center",
                    color: "#718096",
                    background: "#f7fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    marginBottom: 14,
                  }}
                >
                  Nenhuma interação registrada.
                </div>
              )}

              <h4 style={{ margin: "10px 0 12px", color: "#2d3748" }}>Agendamentos</h4>
              {hasAppointments ? (
                <div className="timeline-list">
                  {orderedAppointments.map((interaction, index) => (
                    <AttendanceCard
                      key={interaction.id}
                      interaction={interaction}
                      formatCurrency={formatCurrency}
                      isLast={index === orderedAppointments.length - 1}
                    />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: 16,
                    textAlign: "center",
                    color: "#718096",
                    background: "#f7fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    marginBottom: 14,
                  }}
                >
                  Nenhum agendamento registrado.
                </div>
              )}

              <h4 style={{ margin: "10px 0 12px", color: "#2d3748" }}>Histórico do funil</h4>
              {hasHistory ? (
                <div className="timeline-list">
                  {orderedHistory.map((item, index) => (
                    <HistoryCard key={item.id} item={item} isLast={index === orderedHistory.length - 1} />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: 16,
                    textAlign: "center",
                    color: "#718096",
                    background: "#f7fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                  }}
                >
                  Nenhum histórico registrado.
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "#718096",
            }}
          >
            Não foi possível carregar o histórico deste cliente.
          </div>
        )}
      </div>
    </div>
  );
}
