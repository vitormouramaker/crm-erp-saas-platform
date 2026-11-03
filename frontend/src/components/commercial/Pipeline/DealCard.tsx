import React, { useEffect, useMemo, useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import {
  FiCalendar,
  FiCheckCircle,
  FiCheckSquare,
  FiClock,
  FiDollarSign,
  FiEdit,
  FiBriefcase,
  FiMessageCircle,
  FiMinus,
  FiPhone,
  FiPlay,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { FaFire, FaSnowflake } from "react-icons/fa";
import { useToast } from "../../../contexts/ToastContext";
import {
  getCommercialCrms,
  getCommercialDomains,
  type CommercialStage,
  type CommercialCrm,
  type CommercialResponsible,
  updateCommercialDeal,
  deleteCommercialDeal,
  finalizeCommercialInteraction,
  registerCommercialInteraction,
  type CommercialDomainOption,
  type CommercialDomainProduct,
  type Deal,
} from "../../../service/commercialService";
import { CustomerHistoryModal } from "./CustomerHistoryModal";
import { DeleteDealModal } from "./DeleteDealModal";
import EditDealModal from "./EditDealModal";
import { FinishServiceModal } from "./FinishServiceModal";
import RegisterInteractionModal from "./RegisterInteractionModal";
import ScheduleCalendarModal from "./ScheduleCalendarModal";
import { Modal } from "../../common/Modal/Modal";
import "./DealCard.css";

type DealCardProps = {
  deal: Deal;
  index: number;
  currentUser: {
    id: number;
    name: string;
    isMaster?: boolean;
  };
  products: CommercialDomainProduct[];
  paymentOptions: CommercialDomainOption[];
  lossReasonOptions: CommercialDomainOption[];
  interactionTypes: CommercialDomainOption[];
  stages: CommercialStage[];
  onUpdate: (deal: Deal) => void;
  onDelete: (dealId: string) => void;
  crmId?: number | null;
};

function parseCommercialDate(value?: string | null) {
  if (!value) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  const normalizeFutureOffset = (date: Date) => {
    const futureMs = date.getTime() - Date.now();
    if (futureMs > 5 * 60 * 1000 && futureMs <= 3.5 * 60 * 60 * 1000) {
      return new Date(date.getTime() - 3 * 60 * 60 * 1000);
    }
    return date;
  };

  if (/([zZ]|[+-]\d{2}:\d{2})$/.test(normalized)) {
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : normalizeFutureOffset(parsed);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parsed = new Date(`${normalized}T00:00:00-03:00`);
    return Number.isNaN(parsed.getTime()) ? null : normalizeFutureOffset(parsed);
  }

  const normalizedDateTime = normalized.includes("T")
    ? normalized
    : normalized.replace(" ", "T");

  // Datas do pipeline vindas do banco estao chegando sem timezone, mas com relogio em UTC.
  // Nesses casos, interpretar como Z evita o deslocamento de +3h no card.
  const parsed = new Date(`${normalizedDateTime}Z`);
  return Number.isNaN(parsed.getTime()) ? null : normalizeFutureOffset(parsed);
}

function DealCardComponent({
  deal,
  index,
  currentUser,
  products,
  paymentOptions,
  lossReasonOptions,
  interactionTypes,
  stages,
  onUpdate,
  onDelete,
  crmId,
}: DealCardProps) {
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isRegisterInteractionModalOpen, setIsRegisterInteractionModalOpen] = useState(false);
  const [isScheduleCalendarModalOpen, setIsScheduleCalendarModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [crmOptions, setCrmOptions] = useState<CommercialCrm[]>([]);
  const [stageOptionsByTransfer, setStageOptionsByTransfer] = useState<CommercialStage[]>([]);
  const [responsibleOptions, setResponsibleOptions] = useState<CommercialResponsible[]>([]);
  const [selectedTransferCrmId, setSelectedTransferCrmId] = useState<number | "">("");
  const [selectedTransferStageId, setSelectedTransferStageId] = useState<number | "">("");
  const [selectedResponsibleId, setSelectedResponsibleId] = useState<number | "">(
    Number(deal.ownerId || 0) || "",
  );
  const [loadingTransferOptions, setLoadingTransferOptions] = useState(false);
  const [loadingTransferStages, setLoadingTransferStages] = useState(false);
  const [loadingResponsibles, setLoadingResponsibles] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [isSubmittingResponsible, setIsSubmittingResponsible] = useState(false);
  const [isFinalizingInteraction, setIsFinalizingInteraction] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { addToast } = useToast();
  const navigate = useNavigate();
  const quoteItems = useMemo(
    () =>
      Array.isArray(deal.quote?.items) && deal.quote?.items.length
        ? deal.quote.items
        : Array.isArray(deal.products)
          ? deal.products
          : [],
    [deal.products, deal.quote?.items],
  );
  const quoteTotal = Number(deal.quote?.total ?? deal.amount ?? 0);
  const hasOpenInteraction = Boolean(deal.hasOpenInteraction);
  const openInteractionStartedAt = useMemo(
    () => parseCommercialDate(deal.openInteractionStartedAt || undefined),
    [deal.openInteractionStartedAt],
  );
  const soldQuoteValue = useMemo(
    () =>
      quoteItems.reduce((sum, item) => {
        const soldQuantity =
          item.soldQuantity === null || item.soldQuantity === undefined
            ? deal.stage === "closed-won"
              ? Number(item.quantity || 0)
              : 0
            : Number(item.soldQuantity || 0);
        return sum + soldQuantity * Number(item.price || 0);
      }, 0),
    [deal.stage, quoteItems],
  );

  useEffect(() => {
    if (deal.stage !== "waiting" || !deal.entryDate) return undefined;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [deal.entryDate, deal.stage]);

  useEffect(() => {
    setSelectedResponsibleId(Number(deal.ownerId || 0) || "");
  }, [deal.ownerId]);

  useEffect(() => {
    if (!isTransferModalOpen) return;

    const loadTransferOptions = async () => {
      try {
        setLoadingTransferOptions(true);
        const [crms, currentDomains] = await Promise.all([
          getCommercialCrms(),
          getCommercialDomains(crmId ?? undefined),
        ]);

        setCrmOptions(crms);
        setSelectedTransferCrmId(Number(crmId || 0) || "");
        setResponsibleOptions(
          Array.isArray(currentDomains?.responsaveis) ? currentDomains.responsaveis : [],
        );
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel carregar os pipelines e responsaveis.",
        });
      } finally {
        setLoadingTransferOptions(false);
      }
    };

    void loadTransferOptions();
  }, [addToast, crmId, isTransferModalOpen]);

  useEffect(() => {
    if (!isTransferModalOpen || !selectedTransferCrmId) {
      setStageOptionsByTransfer([]);
      setSelectedTransferStageId("");
      return;
    }

    const loadStages = async () => {
      try {
        setLoadingTransferStages(true);
        const domains = await getCommercialDomains(Number(selectedTransferCrmId));
        const stagesForTransfer = Array.isArray(domains?.etapas) ? domains.etapas : [];
        setStageOptionsByTransfer(stagesForTransfer);
        const fallbackStage =
          stagesForTransfer.find((stage) => stage.codigo === deal.stage) ||
          stagesForTransfer.find((stage) => stage.eh_inicial) ||
          stagesForTransfer[0] ||
          null;
        setSelectedTransferStageId(fallbackStage ? Number(fallbackStage.id) : "");
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel carregar as etapas do pipeline selecionado.",
        });
      } finally {
        setLoadingTransferStages(false);
      }
    };

    void loadStages();
  }, [addToast, deal.stage, isTransferModalOpen, selectedTransferCrmId]);

  const timeDisplay = useMemo(() => {
    if (deal.stage !== "waiting" || !deal.entryDate) return "";

    const start = parseCommercialDate(deal.entryDate);
    if (!start) return "";

    const diffMs = Math.max(0, now - start.getTime());
    const seconds = Math.floor((diffMs / 1000) % 60);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    return `${hours}h:${minutes}m:${seconds}s`;
  }, [deal.entryDate, deal.stage, now]);

  const statusTag = (() => {
    if (deal.temperature === "quente") return { label: "Quente", className: "quente", icon: <FaFire /> };
    if (deal.temperature === "frio") return { label: "Frio", className: "frio", icon: <FaSnowflake /> };
    if (deal.temperature === "morno") return { label: "Morno", className: "morno", icon: <FiMinus /> };
    if (deal.probability >= 75) return { label: "Quente", className: "quente", icon: <FaFire /> };
    if (deal.probability <= 25) return { label: "Frio", className: "frio", icon: <FaSnowflake /> };
    return { label: "Morno", className: "morno", icon: <FiMinus /> };
  })();

  const updateDeal = async (updates: Partial<Deal>) => {
    const updatedDeal = await updateCommercialDeal(deal.id, updates, crmId);
    onUpdate(updatedDeal);
    return updatedDeal;
  };

  const startStageCode =
    stages
      .filter((stage) => stage.ativo !== false && !stage.eh_fechamento && stage.codigo !== "waiting")
      .sort((a, b) => a.ordem - b.ordem)[0]?.codigo || "waiting";

  const handleTransferDeal = async () => {
    if (!selectedTransferCrmId || !selectedTransferStageId) return;

    try {
      setIsSubmittingTransfer(true);
      const destinationCrmId = Number(selectedTransferCrmId);
      const movedToAnotherCrm = Number(crmId || 0) !== destinationCrmId;
      const updatedDeal = await updateCommercialDeal(
        deal.id,
        {
          crm_id: destinationCrmId,
          etapa_id: Number(selectedTransferStageId),
        } as Partial<Deal>,
        destinationCrmId,
      );
      setIsTransferModalOpen(false);
      if (movedToAnotherCrm) {
        onDelete(deal.id);
      } else {
        onUpdate(updatedDeal);
      }
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Atendimento transferido com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel transferir o atendimento.",
      });
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleUpdateResponsible = async () => {
    if (!currentUser.isMaster || !selectedResponsibleId) return;

    try {
      setLoadingResponsibles(true);
      setIsSubmittingResponsible(true);
      const selectedResponsible = responsibleOptions.find(
        (item) => Number(item.id) === Number(selectedResponsibleId),
      );
      const updated = await updateCommercialDeal(
        deal.id,
        {
          ownerId: String(selectedResponsibleId),
          ownerName: selectedResponsible?.nome,
        },
        crmId,
      );
      onUpdate(updated);
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Responsavel atualizado com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel alterar o responsavel.",
      });
    } finally {
      setLoadingResponsibles(false);
      setIsSubmittingResponsible(false);
    }
  };

  const handleFinalizeInteraction = async () => {
    if (!hasOpenInteraction) return;

    const confirmed = window.confirm("Deseja finalizar a interacao em andamento deste atendimento?");
    if (!confirmed) return;

    try {
      setIsFinalizingInteraction(true);
      await finalizeCommercialInteraction(deal.id);
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Interacao finalizada com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel finalizar a interacao.",
      });
    } finally {
      setIsFinalizingInteraction(false);
    }
  };

  const handleOpenCustomerChat = () => {
    const conversationId = Number(deal.chatConversationId || 0);
    if (!conversationId) {
      addToast({
        type: "info",
        title: "Sem conversa",
        description: "Este cliente ainda nao possui conversa vinculada no atendimento.",
      });
      return;
    }

    const status = String(deal.chatConversationStatus || "active").trim() || "active";
    navigate(`/chat/${conversationId}?status=${status}`, {
      state: {
        conversationSnapshot: {
          id: conversationId,
          cliente_id: Number(deal.clienteId || deal.cliente_id || 0) || 0,
          nome: String(deal.contactName || deal.companyName || "Cliente"),
          telefone: String(deal.customerPhone || ""),
          status,
          data_inicio: String(deal.entryDate || deal.createdAt || new Date().toISOString()),
          ultima_atualizacao: String(
            deal.entryDate || deal.createdAt || new Date().toISOString()
          ),
          ultima_mensagem: null,
          nome_atendente: deal.ownerName || null,
          usuario_id: Number(deal.ownerId || 0) || null,
          usuario_atribuido_id: Number(deal.ownerId || 0) || null,
          nome_usuario_atribuido: deal.ownerName || null,
          fila_desde: deal.entryDate || deal.createdAt || null,
        },
      },
    });
  };

  return (
    <>
      <Draggable draggableId={deal.id} index={index} isDragDisabled={deal.stage === "closed-won"}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`deal-card ${snapshot.isDragging ? "is-dragging" : ""} ${
              deal.stage === "closed-won" ? "deal-closed-won" : ""
            }`}
            style={{ ...provided.draggableProps.style }}
          >
            <div className="deal-card-header">           
              <div className="deal-actions">
                <button title="Histórico" onClick={() => setIsHistoryModalOpen(true)} className="icon-btn history">
                  <FiClock />
                </button>
                <button
                  title="Registrar interação"
                  onClick={() => setIsRegisterInteractionModalOpen(true)}
                  className="icon-btn interaction"
                >
                  <FiMessageCircle />
                </button>
                <button
                  title="Abrir conversa no chat"
                  onClick={handleOpenCustomerChat}
                  className="icon-btn chat"
                >
                  <FiMessageCircle />
                </button>
                <button
                  title="Agendar"
                  onClick={() => setIsScheduleCalendarModalOpen(true)}
                  className="icon-btn history"
                >
                  <FiCalendar />
                </button>
                <button title="Editar" onClick={() => setIsEditModalOpen(true)} className="icon-btn edit">
                  <FiEdit />
                </button>
                <button title="Excluir" onClick={() => setIsDeleteModalOpen(true)} className="icon-btn delete">
                  <FiTrash2 />
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <h4 className="deal-client-name">
                {deal.contactName}
              </h4>
              <div className="deal-product-name">
                {deal.quote?.title ||
                  (quoteItems.length > 0
                    ? `${quoteItems.length} item(ns) no orcamento`
                    : (deal.title || "").split(" - ")[0])}
              </div>
            </div>

            {hasOpenInteraction ? (
              <div className="deal-open-interaction-banner">
                <div className="deal-open-interaction-banner__content">
                  <strong>Interacao em andamento</strong>
                  <span>
                    {openInteractionStartedAt
                      ? `Aberta desde ${openInteractionStartedAt.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "Existe uma interacao aberta para este atendimento."}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="deal-quote-card">
              <div className="deal-quote-card__header">
                <strong>Orçamento</strong>
                <span>
                  {quoteItems.length} item(ns) • R$ {quoteTotal.toFixed(2)}
                </span>
              </div>
              {quoteItems.length ? (
                <div className="deal-quote-card__items">
                  {quoteItems.map((item, index) => (
                    <div key={`${deal.id}-quote-item-${index}-${item.name}`} className="deal-quote-card__item">
                      <span className="deal-quote-card__item-name">
                        {item.name}
                      </span>
                      <span className="deal-quote-card__item-meta">
                        {Number(item.quantity || 0)} x R$ {Number(item.price || 0).toFixed(2)}
                      </span>
                      {deal.stage === "closed-won" || deal.stage === "closed-lost" ? (
                        <span className="deal-quote-card__item-meta">
                          Vendido: {Number(item.soldQuantity || 0)} • Não vendido: {Number(item.lostQuantity || 0)}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="deal-quote-card__empty">Nenhum item no orcamento ainda.</p>
              )}
              {deal.stage === "closed-won" || deal.stage === "closed-lost" ? (
                <p className="deal-quote-card__notes">
                  Fechamento: vendido R$ {Number(deal.amount || soldQuoteValue || 0).toFixed(2)} de um orcamento de R$ {quoteTotal.toFixed(2)}.
                </p>
              ) : null}
              {deal.quote?.notes ? (
                <p className="deal-quote-card__notes">{deal.quote.notes}</p>
              ) : null}
            </div>

            <div className="deal-tags">
              <span className={`deal-probability-tag ${statusTag.className}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {statusTag.icon}
                {statusTag.label}
              </span>

              {deal.stage === "waiting" && deal.entryDate && (() => {
                const entryDate = parseCommercialDate(deal.entryDate);
                if (!entryDate) return null;
                const diffMinutes = (Date.now() - entryDate.getTime()) / (1000 * 60);
                if (diffMinutes >= 90) return <span className="deal-tag urgency-danger">Perigo</span>;
                if (diffMinutes >= 60) return <span className="deal-tag urgency-warning">Atenção</span>;
                if (diffMinutes >= 30) return <span className="deal-tag urgency-tolerance">Toleravel</span>;
                return (
                  <span className="deal-tag novo pulse-animation" style={{ backgroundColor: "#2c5282", color: "white" }}>
                    NOVO
                  </span>
                );
              })()}

              {(deal.tags || []).map((tag) => {
                if (tag.toLowerCase() === statusTag.label.toLowerCase()) return null;
                if (tag.toLowerCase() === "novo" && deal.stage === "waiting") return null;
                return (
                  <span key={tag} className={`deal-tag ${tag.toLowerCase() === "quente" ? "quente" : ""}`}>
                    {tag}
                  </span>
                );
              })}
            </div>

            <div className="deal-info-grid">
              <div className="deal-info-item" title="Valor">
                <FiDollarSign className="deal-icon" />
                <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deal.amount)}</span>
              </div>

              <div className="deal-info-item" title="Contato">
                <FiUser className="deal-icon" />
                <span>{deal.contactName}</span>
              </div>

              {deal.customerPhone && (
                <div className="deal-info-item" title="Telefone">
                  <FiPhone className="deal-icon" />
                  <span>{deal.customerPhone}</span>
                </div>
              )}

              <div className="deal-info-item" title={deal.stage === "waiting" ? "Tempo de espera" : "Entrada no pipeline"}>
                <FiClock className="deal-icon" />
                <span>
                  {deal.stage === "waiting" && deal.entryDate
                    ? `Aguarda há ${timeDisplay}`
                    : deal.entryDate
                    ? parseCommercialDate(deal.entryDate)?.toLocaleDateString("pt-BR") || "-"
                    : "-"}
                </span>
              </div>

              {deal.closingDate && (
                <div className="deal-info-item" title="Fechamento">
                  <FiCheckCircle className="deal-icon" />
                  <span>{parseCommercialDate(deal.closingDate)?.toLocaleDateString("pt-BR") || "-"}</span>
                </div>
              )}
            </div>

            {deal.ownerName && (
              <div className="deal-owner-status">
                {deal.stage === "closed-won" || deal.stage === "closed-lost"
                  ? "Atendimento finalizado por "
                  : deal.stage === "waiting"
                    ? "Aguardando com "
                    : "Em atendimento por "}
                <strong>{deal.ownerName}</strong>
              </div>
            )}

            <div className="deal-crm-toolbar">
              <button
                type="button"
                className={`deal-crm-toggle ${isTransferModalOpen ? "active" : ""}`}
                onClick={() => setIsTransferModalOpen(true)}
              >
                <FiBriefcase />
                Transferir para funil
              </button>
            </div>


            {deal.stage === "waiting" && !deal.ownerId ? (
              <button
                className="start-service-btn"
                type="button"
                onClick={async () => {
                  const optimisticDeal: Deal = {
                    ...deal,
                    stage: startStageCode,
                    order: 0,
                    ownerId: String(currentUser.id),
                    ownerName: currentUser.name,
                  };

                  onUpdate(optimisticDeal);
                  try {
                    await updateDeal({
                      stage: startStageCode,
                      order: 0,
                      ownerId: String(currentUser.id),
                      ownerName: currentUser.name,
                    });
                  } catch (error) {
                    onUpdate(deal);
                    addToast({
                      type: "error",
                      title: "Erro",
                      description: error instanceof Error ? error.message : "Nao foi possivel assumir o atendimento.",
                    });
                  }
                }}
              >
                <FiPlay className="btn-icon" /> Iniciar atendimento
              </button>
            ) : !["closed-won", "closed-lost"].includes(deal.stage) ? (
              <>
                {hasOpenInteraction ? (
                  <button className="finish-interaction-btn" type="button" onClick={() => void handleFinalizeInteraction()} disabled={isFinalizingInteraction}>
                    <FiCheckCircle className="btn-icon" /> Finalizar interacao
                  </button>
                ) : null}
                <button className="finish-service-btn" onClick={() => setIsFinishModalOpen(true)}>
                  <FiCheckSquare className="btn-icon" /> Finalizar atendimento
                </button>
              </>
            ) : null}
          </div>
        )}
      </Draggable>

      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => {
          if (isSubmittingTransfer || isSubmittingResponsible) return;
          setIsTransferModalOpen(false);
        }}
        title="Transferir para funil"
        size="sm"
      >
        <div className="deal-transfer-modal">
          <div className="deal-transfer-panel">
            <label className="deal-transfer-field">
              <span>Pipeline destino</span>
              <select
                value={selectedTransferCrmId}
                onChange={(event) => setSelectedTransferCrmId(Number(event.target.value))}
                disabled={loadingTransferOptions || isSubmittingTransfer}
              >
                <option value="">
                  {loadingTransferOptions
                    ? "Carregando pipelines..."
                    : "Selecione um pipeline"}
                </option>
                {crmOptions.map((crm) => (
                  <option key={crm.id} value={crm.id}>
                    {crm.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="deal-transfer-field">
              <span>Etapa destino</span>
              <select
                value={selectedTransferStageId}
                onChange={(event) => setSelectedTransferStageId(Number(event.target.value))}
                disabled={!selectedTransferCrmId || loadingTransferStages || isSubmittingTransfer}
              >
                <option value="">
                  {loadingTransferStages
                    ? "Carregando etapas..."
                    : "Selecione uma etapa"}
                </option>
                {stageOptionsByTransfer.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.nome}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="deal-transfer-submit"
              onClick={() => void handleTransferDeal()}
              disabled={isSubmittingTransfer || !selectedTransferCrmId || !selectedTransferStageId}
            >
              {isSubmittingTransfer ? "Transferindo..." : "Confirmar transferencia"}
            </button>
          </div>

          {currentUser.isMaster && deal.stage !== "waiting" && (
            <div className="deal-transfer-panel deal-transfer-panel--owner">
              <label className="deal-transfer-field">
                <span>Responsavel no funil</span>
                <select
                  value={selectedResponsibleId}
                  onChange={(event) => setSelectedResponsibleId(Number(event.target.value))}
                  disabled={loadingResponsibles || isSubmittingResponsible}
                >
                  <option value="">
                    {loadingResponsibles
                      ? "Carregando responsaveis..."
                      : "Selecione um responsavel"}
                  </option>
                  {responsibleOptions.map((responsible) => (
                    <option key={responsible.id} value={responsible.id}>
                      {responsible.nome}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="deal-transfer-submit deal-transfer-submit--secondary"
                onClick={() => void handleUpdateResponsible()}
                disabled={
                  isSubmittingResponsible ||
                  !selectedResponsibleId ||
                  Number(selectedResponsibleId) === Number(deal.ownerId || 0)
                }
              >
                {isSubmittingResponsible ? "Atualizando..." : "Atualizar responsavel"}
              </button>
            </div>
          )}
        </div>
      </Modal>

      <FinishServiceModal
        isOpen={isFinishModalOpen}
        onClose={() => setIsFinishModalOpen(false)}
        deal={deal}
        paymentOptions={paymentOptions}
        lossReasonOptions={lossReasonOptions}
        productCatalog={products}
        onConfirmSale={async (saleData) => {
          try {
            await updateDeal(saleData);
            setIsFinishModalOpen(false);
          } catch (error) {
            addToast({
              type: "error",
              title: "Erro",
              description: error instanceof Error ? error.message : "Nao foi possivel finalizar a venda.",
            });
          }
        }}
        onConfirmRefusal={async (refusalData) => {
          try {
            await updateDeal(refusalData);
            setIsFinishModalOpen(false);
          } catch (error) {
            addToast({
              type: "error",
              title: "Erro",
              description: error instanceof Error ? error.message : "Nao foi possivel registrar a recusa.",
            });
          }
        }}
      />

      <EditDealModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        deal={deal}
        products={products}
        stages={stages}
        onConfirm={async (updates) => {
          try {
            await updateDeal(updates);
            setIsEditModalOpen(false);
          } catch (error) {
            addToast({
              type: "error",
              title: "Erro",
              description: error instanceof Error ? error.message : "Nao foi possivel atualizar o atendimento.",
            });
          }
        }}
      />

      <DeleteDealModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          try {
            await deleteCommercialDeal(deal.id);
            onDelete(deal.id);
            setIsDeleteModalOpen(false);
          } catch (error) {
            addToast({
              type: "error",
              title: "Erro",
              description: error instanceof Error ? error.message : "Nao foi possivel excluir o atendimento.",
            });
          }
        }}
      />

      <CustomerHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        dealId={deal.id}
      />

      <RegisterInteractionModal
        isOpen={isRegisterInteractionModalOpen}
        onClose={() => setIsRegisterInteractionModalOpen(false)}
        interactionTypes={interactionTypes}
        onConfirm={async (payload) => {
          try {
            await registerCommercialInteraction({
              dealId: deal.id,
              type: payload.type,
              description: payload.description,
              date: payload.date,
              endDate: payload.endDate,
              isCurrent: payload.isCurrent,
              value: payload.value,
            });
            setIsRegisterInteractionModalOpen(false);
            addToast({
              type: "success",
              title: "Sucesso",
              description: "Interacao registrada com sucesso.",
            });
          } catch (error) {
            addToast({
              type: "error",
              title: "Erro",
              description: error instanceof Error ? error.message : "Nao foi possivel registrar a interacao.",
            });
          }
        }}
      />

      {crmId ? (
        <ScheduleCalendarModal
          isOpen={isScheduleCalendarModalOpen}
          onClose={() => setIsScheduleCalendarModalOpen(false)}
          crmId={crmId}
          interactionTypes={interactionTypes}
          deal={{
            id: deal.id,
            contactName: deal.contactName,
            companyName: deal.companyName,
            title: deal.title,
          }}
        />
      ) : null}
    </>
  );
}

export const DealCard = React.memo(DealCardComponent);
