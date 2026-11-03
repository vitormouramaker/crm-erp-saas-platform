import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiEdit2,
  FiTarget,
  FiPlus,
  FiPackage,
  FiSlash,
  FiClock,
  FiMessageCircle,
  FiRefreshCcw,
  FiFileText,
  FiBriefcase,
  FiTag,
  FiCpu,
  FiDownload,
  FiTrash2,
  FiUpload,
  FiShield,
  FiFlag,
} from "react-icons/fi";
import { Modal } from "../common/Modal/Modal";
import { RichTextEditor } from "../common/RichTextEditor/RichTextEditor";
import type { Conversation, Tag, Note } from "../../data/mockData";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { encrypt, decrypt } from "../../utils/cripto";
import { API_BASE } from "../../config/api";
import {
  createCommercialDeal,
  getCommercialCrms,
  getCommercialDomains,
  subscribeToCommercialDataChanged,
  updateCommercialDeal,
  type CommercialDomainOption,
  type CommercialDomainProduct,
  type CommercialCrm,
  type CommercialResponsible,
  type CommercialStage,
  type Deal,
  type DealProduct,
  type DealQuote,
} from "../../service/commercialService";
import { FinishServiceModal } from "../commercial/Pipeline/FinishServiceModal";
import { ContactForm } from "../ContactForm/ContactForm";
import { formatPhoneForInput } from "../../utils/phone";
import { appSafetyService } from "../../service/appSafetyService";
import { sanitizeUserHtml } from "../../utils/sanitizeHtml";
import "./ClientDetails.css";

interface ClientDetailsProps {
  conversation: Conversation;
  onSaveNote: (noteContent: string) => void;
  onAddTag: (tag: Tag) => void;
  onRemoveTag: (tagId: number) => void;
  onAssistConversionIa?: () => void;
  onOpenLiveQuote?: (payload: {
    crm?: {
      negocioId?: number | null;
      crmId?: number | null;
      crmNome?: string | null;
      etapaNome?: string | null;
      etapaFechamento?: boolean;
    } | null;
    catalogo?: CommercialDomainProduct[];
    products?: DealProduct[];
    notes?: string;
    headerMessage?: string;
  }) => void;
  currentUserId?: number;
  currentUserName?: string;
  onUpdateClient?: (contactData: Partial<Conversation>) => void;
}

type ContactDocument = {
  id: number;
  nome_arquivo?: string | null;
  url?: string | null;
  path_bunny?: string | null;
  mime_type?: string | null;
  tamanho_bytes?: number | null;
  origem?: string | null;
  data_criacao?: string | null;
  ativo?: boolean;
};

function formatClientBirthday(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

function formatClientPhone(value?: string | null) {
  const localDigits = formatPhoneForInput(value);
  const digits = String(localDigits || "").replace(/\D/g, "");

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return String(value || "").trim() || "-";
}

function formatClientCpf(value?: string | null) {
  return String(value || "").trim() || "-";
}

function formatClientCurrency(value?: number | string | null) {
  if (value === undefined || value === null || value === "") return "-";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue);
}

function formatClientAddress(contact: {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}) {
  const parts = [
    [contact.logradouro, contact.numero].filter(Boolean).join(", "),
    contact.complemento,
    contact.bairro,
    [contact.cidade, contact.uf].filter(Boolean).join(" - "),
    contact.cep,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return parts.length ? parts.join(" | ") : "-";
}

function formatFileSize(value?: number | null) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDocumentFileName(value?: string | null, maxLength = 30) {
  const fileName = String(value || "Documento").trim() || "Documento";
  if (fileName.length <= maxLength) return fileName;

  const dotIndex = fileName.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < fileName.length - 1;
  const extension = hasExtension ? fileName.slice(dotIndex) : "";
  const baseName = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  const suffixLength = Math.max(8, Math.min(14, maxLength - 12));
  const prefixLength = Math.max(8, maxLength - suffixLength - extension.length - 3);

  return `${baseName.slice(0, prefixLength)}...${baseName.slice(-suffixLength)}${extension}`;
}

function normalizeClientOrigin(value?: string | null) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (
    normalized === "whatsapp" ||
    normalized === "meta_ads" ||
    normalized === "importacao" ||
    normalized === "comercial"
  ) {
    return normalized;
  }

  return "manual";
}

function formatClientOrigin(value?: string | null) {
  switch (normalizeClientOrigin(value)) {
    case "whatsapp":
      return "WhatsApp";
    case "meta_ads":
      return "Meta Ads";
    case "importacao":
      return "Importação";
    case "comercial":
      return "Comercial";
    default:
      return "Manual";
  }
}

export function ClientDetails({
  conversation,
  onSaveNote,
  onAddTag,
  onRemoveTag,
  onAssistConversionIa,
  onOpenLiveQuote,
  currentUserId,
  currentUserName,
  onUpdateClient,
}: ClientDetailsProps) {
  type AttendanceActionPanelKey = "transferir-crm" | "tags" | "anotacoes";
  type CrmTransferSubpanelKey = "responsavel" | "pipeline";
  type FinishType = "won" | "lost" | null;
  type DetailsModalKey =
    | "crm-interacoes"
    | "crm-historico"
    | "whatsapp-atendimentos"
    | "anotacoes";
  type TransferDraft = {
    crmTransferOpen: boolean;
    selectedTransferCrmId: number | "";
    selectedTransferStageId: number | "";
    selectedTransferCrmName?: string;
    selectedTransferStageName?: string;
  };

  const { user } = useAuth();
  const { addToast } = useToast();
  const [noteContent, setNoteContent] = useState("");
  const [clienteDetalhes, setClienteDetalhes] = useState<Conversation | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [hasLoadedDetails, setHasLoadedDetails] = useState(false);
  const [tagsState, setTagsState] = useState<Tag[]>([]);
  const [notesState, setNotesState] = useState<Note[]>([]);
  const [crmAtendimento, setCrmAtendimento] = useState<any | null>(null);
  const [crmInteracoes, setCrmInteracoes] = useState<any[]>([]);
  const [crmHistorico, setCrmHistorico] = useState<any[]>([]);
  const [historicoAtendimentosWhatsapp, setHistoricoAtendimentosWhatsapp] =
    useState<any[]>([]);
  const [contactDocuments, setContactDocuments] = useState<ContactDocument[]>([]);
  const [contactDocumentFile, setContactDocumentFile] = useState<File | null>(null);
  const [isUploadingContactDocument, setIsUploadingContactDocument] = useState(false);
  const [deletingContactDocumentId, setDeletingContactDocumentId] = useState<number | null>(null);
  const [isDocumentsUploadOpen, setIsDocumentsUploadOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [crmTransferOpen, setCrmTransferOpen] = useState(false);
  const [crmOptions, setCrmOptions] = useState<CommercialCrm[]>([]);
  const [crmTransferStages, setCrmTransferStages] = useState<CommercialStage[]>(
    [],
  );
  const [loadingCrmOptions, setLoadingCrmOptions] = useState(false);
  const [loadingCrmStages, setLoadingCrmStages] = useState(false);
  const [isTransferringCrm, setIsTransferringCrm] = useState(false);
  const [isEnsuringCrmAttendance, setIsEnsuringCrmAttendance] = useState(false);
  const [selectedTransferCrmId, setSelectedTransferCrmId] = useState<
    number | ""
  >("");
  const [selectedTransferStageId, setSelectedTransferStageId] = useState<
    number | ""
  >("");
  const [crmResponsibles, setCrmResponsibles] = useState<
    CommercialResponsible[]
  >([]);
  const [crmProductOptions, setCrmProductOptions] = useState<
    CommercialDomainProduct[]
  >([]);
  const [crmPaymentOptions, setCrmPaymentOptions] = useState<
    CommercialDomainOption[]
  >([]);
  const [crmLossReasonOptions, setCrmLossReasonOptions] = useState<
    CommercialDomainOption[]
  >([]);
  const [loadingCrmDomains, setLoadingCrmDomains] = useState(false);
  const [loadingResponsibleOptions, setLoadingResponsibleOptions] =
    useState(false);
  const [finishModalType, setFinishModalType] = useState<FinishType>(null);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [editClientInitialData, setEditClientInitialData] =
    useState<Conversation | null>(null);
  const [selectedResponsibleId, setSelectedResponsibleId] = useState<
    number | ""
  >("");
  const [isUpdatingResponsible, setIsUpdatingResponsible] = useState(false);
  const [activeAttendanceActionPanel, setActiveAttendanceActionPanel] =
    useState<AttendanceActionPanelKey | null>(null);
  const [activeCrmTransferSubpanel, setActiveCrmTransferSubpanel] =
    useState<CrmTransferSubpanelKey | null>(null);
  const [detailsModalPanel, setDetailsModalPanel] =
    useState<DetailsModalKey | null>(null);
  const [isClientProfileExpanded, setIsClientProfileExpanded] = useState(false);
  const [isClientBlocked, setIsClientBlocked] = useState(false);
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);
  const [safetyModal, setSafetyModal] = useState<"block" | "report" | null>(null);
  const [safetyReason, setSafetyReason] = useState("");
  const [safetyDescription, setSafetyDescription] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const crmSectionRef = useRef<HTMLDivElement | null>(null);
  const prevConversationIdRef = useRef<number | null>(null);
  const transferDraftByConversationRef = useRef<Record<number, TransferDraft>>(
    {},
  );
  const savedTransferDraft = conversation.id
    ? transferDraftByConversationRef.current[conversation.id]
    : undefined;
  const selectedTransferCrmOption = crmOptions.find(
    (crm) => Number(crm.id) === Number(selectedTransferCrmId),
  );
  const selectedTransferStageOption = crmTransferStages.find(
    (stage) => Number(stage.id) === Number(selectedTransferStageId),
  );

  const fetchClienteDetalhes = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setLoading(true);
        setHasLoadedDetails(false);
      }
      try {
        const encryptedPayload = await encrypt({
          cliente_id: conversation.cliente_id,
          empresa_id: user?.empresa_id,
        });
        const response = await fetch(
          `${API_BASE}/atendimento/buscar_detalhes_cliente`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: encryptedPayload }),
          },
        );
        const respData = await response.json();
        const resp = (await decrypt(respData.payload)) as {
          boleano: boolean;
          obj?: {
            tags?: Tag[];
            notes?: Note[];
            cliente?: Conversation | null;
            crm?: {
              atendimento?: any;
              interacoes?: any[];
              historico?: any[];
            };
            documentos?: ContactDocument[];
            historico_atendimentos_whatsapp?: any[];
          };
        };

        if (resp?.boleano && resp.obj) {
          setClienteDetalhes((resp.obj.cliente as any) || null);
          setTagsState(resp.obj.tags || []);
          setNotesState(resp.obj.notes || []);
          setCrmAtendimento(resp.obj.crm?.atendimento || null);
          setCrmInteracoes(resp.obj.crm?.interacoes || []);
          setCrmHistorico(resp.obj.crm?.historico || []);
          setContactDocuments(resp.obj.documentos || []);
          setHistoricoAtendimentosWhatsapp(
            resp.obj.historico_atendimentos_whatsapp || [],
          );
        } else {
          setTagsState(conversation.tags || []);
          setNotesState(conversation.notes || []);
          setCrmAtendimento(null);
          setCrmInteracoes([]);
          setCrmHistorico([]);
          setContactDocuments([]);
          setHistoricoAtendimentosWhatsapp([]);
        }
      } catch (err) {
        console.error("Erro ao buscar detalhes do cliente:", err);
        setTagsState(conversation.tags || []);
        setNotesState(conversation.notes || []);
        setCrmAtendimento(null);
        setCrmInteracoes([]);
        setCrmHistorico([]);
        setContactDocuments([]);
        setHistoricoAtendimentosWhatsapp([]);
      } finally {
        if (showLoader) {
          setLoading(false);
        }
        setHasLoadedDetails(true);
      }
    },
    [conversation.cliente_id, user?.empresa_id],
  );

  useEffect(
    () =>
      subscribeToCommercialDataChanged(() => void fetchClienteDetalhes(false)),
    [fetchClienteDetalhes],
  );

  useEffect(() => {
    if (conversation.id) {
      const previousConversationId = prevConversationIdRef.current;
      if (previousConversationId) {
        transferDraftByConversationRef.current[previousConversationId] = {
          crmTransferOpen,
          selectedTransferCrmId,
          selectedTransferStageId,
          selectedTransferCrmName:
            selectedTransferCrmOption?.nome ||
            transferDraftByConversationRef.current[previousConversationId]
              ?.selectedTransferCrmName,
          selectedTransferStageName:
            selectedTransferStageOption?.nome ||
            transferDraftByConversationRef.current[previousConversationId]
              ?.selectedTransferStageName,
        };
      }

      const savedDraft =
        transferDraftByConversationRef.current[conversation.id];
      void fetchClienteDetalhes(true);
      setTagSearch("");
      setTagSuggestions([]);
      setActiveAttendanceActionPanel(
        savedDraft?.crmTransferOpen ? "transferir-crm" : null,
      );
      setDetailsModalPanel(null);
      setIsEditClientModalOpen(false);
      setEditClientInitialData(null);
      setCrmTransferOpen(savedDraft?.crmTransferOpen ?? false);
      setActiveCrmTransferSubpanel(null);
      setFinishModalType(null);
      setNoteContent("");
      setSelectedTransferCrmId(savedDraft?.selectedTransferCrmId ?? "");
      setSelectedTransferStageId(savedDraft?.selectedTransferStageId ?? "");
      setCrmTransferStages([]);
      prevConversationIdRef.current = conversation.id;
    }
  }, [conversation.cliente_id, conversation.id, fetchClienteDetalhes]);

  useEffect(() => {
    setContactDocumentFile(null);
    setDeletingContactDocumentId(null);
    setIsDocumentsUploadOpen(false);
  }, [conversation.id]);

  useEffect(() => {
    let active = true;
    void appSafetyService.listBlockedClients().then((response) => {
      if (!active) return;
      setIsClientBlocked(Boolean(response.obj?.some(
        (item) => Number(item.cliente_id) === Number(conversation.cliente_id),
      )));
    }).catch((error) => console.error("Falha ao consultar bloqueio do cliente:", error));
    return () => { active = false; };
  }, [conversation.cliente_id]);

  const handleToggleClientBlock = async () => {
    setIsUpdatingBlock(true);
    try {
      if (isClientBlocked) {
        await appSafetyService.unblockClient({ clienteId: conversation.cliente_id, conversaId: conversation.id });
        setIsClientBlocked(false);
        addToast({ type: "success", title: "Cliente desbloqueado", description: "O envio e o recebimento voltaram a ser permitidos." });
      } else {
        await appSafetyService.blockClient({ clienteId: conversation.cliente_id, conversaId: conversation.id, motivo: safetyReason.trim() });
        setIsClientBlocked(true);
        setSafetyModal(null);
        setSafetyReason("");
        addToast({ type: "success", title: "Cliente bloqueado", description: "Novas mensagens não gerarão fila ou notificações." });
      }
    } catch (error) {
      addToast({ type: "error", title: "Não foi possível alterar o bloqueio", description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setIsUpdatingBlock(false);
    }
  };

  const handleReportClient = async () => {
    if (!safetyReason.trim()) return;
    setIsSubmittingReport(true);
    try {
      await appSafetyService.report({ clienteId: conversation.cliente_id, conversaId: conversation.id, motivo: safetyReason.trim(), descricao: safetyDescription.trim() });
      setSafetyModal(null);
      setSafetyReason("");
      setSafetyDescription("");
      addToast({ type: "success", title: "Denuncia enviada", description: "Nossa equipe foi notificada para analisar o caso." });
    } catch (error) {
      addToast({ type: "error", title: "Não foi possível enviar a denúncia", description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  useEffect(() => {
    if (!conversation.id) return;

    transferDraftByConversationRef.current[conversation.id] = {
      crmTransferOpen,
      selectedTransferCrmId,
      selectedTransferStageId,
      selectedTransferCrmName:
        selectedTransferCrmOption?.nome ||
        transferDraftByConversationRef.current[conversation.id]
          ?.selectedTransferCrmName,
      selectedTransferStageName:
        selectedTransferStageOption?.nome ||
        transferDraftByConversationRef.current[conversation.id]
          ?.selectedTransferStageName,
    };
  }, [
    conversation.id,
    crmTransferOpen,
    selectedTransferCrmOption?.nome,
    selectedTransferCrmId,
    selectedTransferStageOption?.nome,
    selectedTransferStageId,
  ]);

  useEffect(() => {
    const fetchTags = async () => {
      if (!tagSearch.trim()) {
        setTagSuggestions([]);
        return;
      }

      if (!user?.empresa_id) {
        setTagSuggestions([]);
        return;
      }

      setLoadingTags(true);
      try {
        const encrypted = await encrypt({
          pesquisa: tagSearch,
          empresa_id: user.empresa_id,
        });
        const response = await fetch(`${API_BASE}/user/busca_tag`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });
        const respData = await response.json();
        const resp = (await decrypt(respData.payload)) as {
          boleano: boolean;
          obj?: Tag[];
        };

        if (resp?.boleano && resp.obj) {
          setTagSuggestions(resp.obj);
        }
      } catch (err) {
        console.error("Erro ao buscar tags:", err);
      } finally {
        setLoadingTags(false);
      }
    };

    const delayDebounce = setTimeout(fetchTags, 300);
    return () => clearTimeout(delayDebounce);
  }, [tagSearch, user?.empresa_id]);

  useEffect(() => {
    if (!crmAtendimento?.crm_id) {
      setCrmProductOptions([]);
      setCrmPaymentOptions([]);
      setCrmLossReasonOptions([]);
      return;
    }

    const loadCrmDomains = async () => {
      const crmId = Number(crmAtendimento.crm_id);
      try {
        setLoadingCrmDomains(true);
        const domains = await getCommercialDomains(crmId);
        const produtos = Array.isArray(domains?.produtos)
          ? domains.produtos
          : [];
        const formasPagamento = Array.isArray(domains?.formas_pagamento)
          ? domains.formas_pagamento
          : [];
        const motivosPerda = Array.isArray(domains?.motivos_perda)
          ? domains.motivos_perda
          : [];

        setCrmProductOptions(produtos);
        setCrmPaymentOptions(formasPagamento);
        setCrmLossReasonOptions(motivosPerda);
      } catch (err) {
        console.error("Erro ao carregar dominios do funil:", {
          crmId,
          err,
        });
        setCrmProductOptions([]);
        setCrmPaymentOptions([]);
        setCrmLossReasonOptions([]);
      } finally {
        setLoadingCrmDomains(false);
      }
    };

    void loadCrmDomains();
  }, [conversation.id, crmAtendimento?.crm_id]);

  useEffect(() => {
    if (!crmTransferOpen || !user?.empresa_id || !crmAtendimento?.negocio_id) {
      return;
    }

    const loadCrms = async () => {
      try {
        setLoadingCrmOptions(true);
        const crms = await getCommercialCrms();
        setCrmOptions(crms);
      } catch (err) {
        console.error("Erro ao carregar funis:", err);
        addToast({
          type: "error",
          title: "Erro ao carregar pipelines",
          description: "Não foi possível carregar os pipelines comerciais.",
        });
      } finally {
        setLoadingCrmOptions(false);
      }
    };

    void loadCrms();
  }, [
    addToast,
    crmAtendimento?.crm_id,
    crmAtendimento?.negocio_id,
    crmTransferOpen,
    user?.empresa_id,
  ]);

  useEffect(() => {
    if (!selectedTransferCrmId) {
      setCrmTransferStages([]);
      setSelectedTransferStageId("");
      return;
    }

    if (!crmTransferOpen) {
      if (crmTransferStages.length) {
        setCrmTransferStages([]);
      }
      return;
    }

    const loadStages = async () => {
      try {
        setLoadingCrmStages(true);
        const domains = await getCommercialDomains(
          Number(selectedTransferCrmId),
        );
        const stages = Array.isArray(domains?.etapas) ? domains.etapas : [];
        setCrmTransferStages(stages);
        setSelectedTransferStageId((currentValue) => {
          if (!currentValue) return "";

          const hasCurrentStage = stages.some(
            (stage) => Number(stage.id) === Number(currentValue),
          );
          return hasCurrentStage ? currentValue : "";
        });
      } catch (err) {
        console.error("Erro ao carregar etapas do funil:", err);
        addToast({
          type: "error",
          title: "Erro ao carregar etapas",
          description:
            "Não foi possível carregar as etapas do pipeline selecionado.",
        });
      } finally {
        setLoadingCrmStages(false);
      }
    };

    void loadStages();
  }, [addToast, crmTransferOpen, selectedTransferCrmId]);

  useEffect(() => {
    if (!user?.is_master || !crmAtendimento?.crm_id) {
      setCrmResponsibles([]);
      return;
    }

    const loadResponsibles = async () => {
      const crmId = Number(crmAtendimento.crm_id);
      try {
        setLoadingResponsibleOptions(true);
        const domains = await getCommercialDomains(crmId);
        const responsaveis = Array.isArray(domains?.responsaveis)
          ? domains.responsaveis
          : [];

        setCrmResponsibles(responsaveis);
      } catch (err) {
        console.error("Erro ao carregar responsaveis do funil:", {
          crmId,
          err,
        });
      } finally {
        setLoadingResponsibleOptions(false);
      }
    };

    void loadResponsibles();
  }, [conversation.id, crmAtendimento?.crm_id, user?.is_master]);

  useEffect(() => {
    setSelectedResponsibleId(Number(crmAtendimento?.responsavel_id || 0) || "");
  }, [crmAtendimento?.responsavel_id]);

  const produtosCrm = useMemo(() => {
    const raw = crmAtendimento?.produtos;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [crmAtendimento?.produtos]);

  const valorOrcamentoCrm =
    Number(
      crmAtendimento?.valor_fechamento ?? crmAtendimento?.valor_estimado ?? 0,
    ) || 0;
  const produtosCrmNormalizados = useMemo(() => {
    const normalized = produtosCrm
      .map((produto: any) => {
        const nome = String(
          produto?.nome || produto?.name || produto?.produto || "",
        ).trim();
        if (!nome) return null;

        const soldQuantity =
          produto?.quantidade_ganha === null ||
          produto?.quantidade_ganha === undefined
            ? undefined
            : Number(produto.quantidade_ganha || 0);
        const lostQuantity =
          produto?.quantidade_perdida === null ||
          produto?.quantidade_perdida === undefined
            ? undefined
            : Number(produto.quantidade_perdida || 0);
        const quantity = Math.max(
          Number(
            produto?.quantidade ?? produto?.quantity ?? produto?.itemQuantity ?? 0,
          ) || 0,
          Number(soldQuantity || 0) + Number(lostQuantity || 0),
        );

        return {
          id: produto?.id,
          comercialProdutoId:
            produto?.produto_id ?? produto?.comercialProdutoId ?? undefined,
          name: nome,
          quantity: quantity > 0 ? quantity : 1,
          price:
            Number(
              produto?.preco_unitario ?? produto?.price ?? produto?.preco ?? 0,
            ) || 0,
          soldQuantity,
          lostQuantity,
          status: produto?.status || undefined,
        } satisfies DealProduct;
      })
      .filter(Boolean) as DealProduct[];

    if (normalized.length > 0) {
      return normalized;
    }

    return [];
  }, [
    produtosCrm,
  ]);
  const quantidadeItensCrm =
    produtosCrmNormalizados.reduce(
      (sum: number, produto) => sum + (Number(produto?.quantity || 0) || 0),
      0,
    ) ||
    (Number(
      crmAtendimento?.quantidade_itens ??
        crmAtendimento?.itemQuantity ??
        crmAtendimento?.quantidade_total ??
        0,
    ) || 0);
  const quoteForFinish: DealQuote | null = useMemo(() => {
    if (!crmAtendimento?.negocio_id) return null;
    if (!produtosCrmNormalizados.length) return null;

    const subtotal = produtosCrmNormalizados.reduce(
      (sum, produto) =>
        sum + Number(produto.quantity || 0) * Number(produto.price || 0),
      0,
    );
    const total = valorOrcamentoCrm > 0 ? valorOrcamentoCrm : subtotal;

    return {
      id: String(crmAtendimento.negocio_id),
      title:
        crmAtendimento.titulo ||
        crmAtendimento.produto_principal ||
        "Orçamento do atendimento",
      subtotal,
      discount: Math.max(0, subtotal - total),
      total,
      status: crmAtendimento.etapa_fechamento
        ? crmAtendimento.etapa_codigo === "closed-won"
          ? "ganho"
          : "perdido"
        : "ativo",
      items: produtosCrmNormalizados,
    };
  }, [
    crmAtendimento?.etapa_codigo,
    crmAtendimento?.etapa_fechamento,
    crmAtendimento?.negocio_id,
    crmAtendimento?.produto_principal,
    crmAtendimento?.titulo,
    produtosCrmNormalizados,
    valorOrcamentoCrm,
  ]);

  const normalizedTagSearch = tagSearch.trim();
  const canCreateTag = useMemo(() => {
    if (!normalizedTagSearch) return false;

    const normalized = normalizedTagSearch.toLowerCase();
    const alreadyLinked = tagsState.some(
      (tag) =>
        String(tag.name || "")
          .trim()
          .toLowerCase() === normalized,
    );
    const alreadySuggested = tagSuggestions.some(
      (tag) =>
        String(tag.name || "")
          .trim()
          .toLowerCase() === normalized,
    );

    return !alreadyLinked && !alreadySuggested;
  }, [normalizedTagSearch, tagSuggestions, tagsState]);

  const handleSelectTag = async (tag: Tag) => {
    try {
      const encrypted = await encrypt({
        cliente_id: conversation.cliente_id,
        tag_id: tag.id,
      });
      const response = await fetch(`${API_BASE}/user/vincular_tag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as { boleano: boolean };

      if (resp?.boleano) {
        setTagsState((prev) => {
          if (prev.some((currentTag) => currentTag.id === tag.id)) return prev;
          return [...prev, tag];
        });
        onAddTag(tag);
        setTagSearch("");
        setTagSuggestions([]);
      }
    } catch (err) {
      console.error("Erro ao vincular tag:", err);
    }
  };

  const handleCreateTag = async () => {
    if (!user?.empresa_id || !normalizedTagSearch || isCreatingTag) return;

    try {
      setIsCreatingTag(true);
      const encrypted = await encrypt({
        cliente_id: conversation.cliente_id,
        empresa_id: user.empresa_id,
        nome: normalizedTagSearch,
      });
      const response = await fetch(`${API_BASE}/user/criar_vincular_tag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj?: Tag;
      };

      if (resp?.boleano && resp.obj) {
        const createdTag = resp.obj;
        setTagsState((prev) => {
          if (prev.some((tag) => tag.id === createdTag.id)) return prev;
          return [...prev, createdTag];
        });
        onAddTag(createdTag);
        setTagSearch("");
        setTagSuggestions([]);
      }
    } catch (err) {
      console.error("Erro ao criar e vincular tag:", err);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      const encrypted = await encrypt({
        usuario_id: conversation.cliente_id,
        tag_id: tagId,
      });
      const response = await fetch(`${API_BASE}/user/remover_vinculo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as { boleano: boolean };

      if (resp?.boleano) {
        setTagsState((prev) => prev.filter((tag) => tag.id !== tagId));
        onRemoveTag(tagId);
      }
    } catch (err) {
      console.error("Erro ao remover tag:", err);
    }
  };

  const handleEnsureCrmAttendance = async () => {
    if (!user?.empresa_id || !user?.id || !conversation.id) {
      return;
    }

    try {
      setIsEnsuringCrmAttendance(true);
      const encryptedPayload = await encrypt({
        conversa_id: conversation.id,
        usuario_id: user.id,
      });

      const response = await fetch(
        `${API_BASE}/atendimento/garantir_crm_atendimento`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encryptedPayload }),
        },
      );
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano?: boolean;
        mensagem?: string;
        obj?: {
          created?: boolean;
          reason?: string;
        };
      };

      if (!resp?.boleano) {
        throw new Error(
          resp?.mensagem ||
            "Nao foi possivel vincular este atendimento ao funil.",
        );
      }

      await fetchClienteDetalhes(false);
      setActiveCrmTransferSubpanel("pipeline");
      addToast({
        type: "success",
        title:
          resp.obj?.created === true
            ? "Atendimento vinculado"
            : "Funil localizado",
        description:
          resp?.mensagem ||
          "O atendimento agora pode ser gerenciado pelo funil.",
      });
    } catch (err) {
      console.error("Erro ao vincular atendimento ao funil:", err);
      addToast({
        type: "error",
        title: "Erro ao vincular funil",
        description:
          err instanceof Error
            ? err.message
            : "Nao foi possivel vincular este atendimento ao funil.",
      });
    } finally {
      setIsEnsuringCrmAttendance(false);
    }
  };

  const handleTransferCrm = async () => {
    if (
      !user?.empresa_id ||
      !crmAtendimento?.negocio_id ||
      !selectedTransferCrmId ||
      !selectedTransferStageId
    ) {
      return;
    }

    try {
      setIsTransferringCrm(true);
      const encryptedPayload = await encrypt({
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        is_master: Boolean(user.is_master),
        conversa_id: conversation.id,
        negocio_id: Number(crmAtendimento.negocio_id),
        crm_id: Number(selectedTransferCrmId),
        etapa_id: Number(selectedTransferStageId),
      });

      const response = await fetch(`${API_BASE}/vendas/crm_editar_negocio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encryptedPayload }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        mensagem?: string;
      };

      if (!resp?.boleano) {
        throw new Error(
          resp?.mensagem || "Não foi possível mover o atendimento de pipeline.",
        );
      }

      await fetchClienteDetalhes(false);
      setCrmTransferOpen(false);
      setActiveAttendanceActionPanel(null);
      setActiveCrmTransferSubpanel(null);
      addToast({
        type: "success",
        title: "Atendimento movido",
        description: "O atendimento foi enviado para o pipeline selecionado.",
      });
    } catch (err) {
      console.error("Erro ao mover atendimento de pipeline:", err);
      addToast({
        type: "error",
        title: "Erro ao mover atendimento",
        description:
          err instanceof Error
            ? err.message
            : "Não foi possível mover o atendimento para outro pipeline.",
      });
    } finally {
      setIsTransferringCrm(false);
    }
  };

  const handleUpdateResponsible = async () => {
    if (
      !user?.is_master ||
      !user?.empresa_id ||
      !crmAtendimento?.negocio_id ||
      !selectedResponsibleId
    ) {
      return;
    }

    try {
      setIsUpdatingResponsible(true);
      const encryptedPayload = await encrypt({
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        is_master: Boolean(user.is_master),
        conversa_id: conversation.id,
        negocio_id: Number(crmAtendimento.negocio_id),
        crm_id: Number(crmAtendimento.crm_id),
        ownerId: Number(selectedResponsibleId),
      });

      const response = await fetch(`${API_BASE}/vendas/crm_editar_negocio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encryptedPayload }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        mensagem?: string;
      };

      if (!resp?.boleano) {
        throw new Error(
          resp?.mensagem ||
            "Não foi possível alterar o responsável do atendimento no funil.",
        );
      }

      await fetchClienteDetalhes(false);
      addToast({
        type: "success",
        title: "Responsável atualizado",
        description: "O responsável do atendimento no funil foi alterado.",
      });
    } catch (err) {
      console.error("Erro ao alterar responsável do funil:", err);
      addToast({
        type: "error",
        title: "Erro ao alterar responsável",
        description:
          err instanceof Error
            ? err.message
            : "Não foi possível alterar o responsável do atendimento.",
      });
    } finally {
      setIsUpdatingResponsible(false);
    }
  };

  const handleUploadContactDocument = async () => {
    const clienteId = Number(conversation.cliente_id || conversation.id || 0);
    if (!user?.empresa_id || !clienteId || !contactDocumentFile) {
      return;
    }

    if (contactDocuments.length >= 3) {
      addToast({
        type: "warning",
        title: "Limite atingido",
        description: "Cada cliente pode ter no máximo 3 documentos ativos.",
      });
      return;
    }

    if (contactDocumentFile.size > 20 * 1024 * 1024) {
      addToast({
        type: "warning",
        title: "Arquivo grande demais",
        description: "O documento deve ter no máximo 20MB.",
      });
      return;
    }

    try {
      setIsUploadingContactDocument(true);
      const payload = await encrypt({
        empresa_id: user.empresa_id,
        cliente_id: clienteId,
      });

      const formData = new FormData();
      formData.append("payload", payload);
      formData.append("document", contactDocumentFile);

      const response = await fetch(`${API_BASE}/atendimento/documento_cliente_upload`, {
        method: "POST",
        body: formData,
      });
      const responseData = await response.json();
      const parsed = (await decrypt(responseData.payload)) as {
        boleano?: boolean;
        mensagem?: string;
      };

      if (!parsed?.boleano) {
        throw new Error(parsed?.mensagem || "Não foi possível salvar o documento.");
      }

      setContactDocumentFile(null);
      setIsDocumentsUploadOpen(false);
      await fetchClienteDetalhes(false);
      addToast({
        type: "success",
        title: "Documento salvo",
        description: "Documento anexado ao cliente.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro ao enviar documento",
        description:
          err instanceof Error ? err.message : "Não foi possível enviar o documento.",
      });
    } finally {
      setIsUploadingContactDocument(false);
    }
  };

  const handleDeleteContactDocument = async (documentId: number) => {
    if (!user?.empresa_id || !documentId) return;
    const confirmed = window.confirm("Deseja remover este documento do contato?");
    if (!confirmed) return;

    try {
      setDeletingContactDocumentId(documentId);
      const payload = await encrypt({
        empresa_id: user.empresa_id,
        documento_id: documentId,
      });
      const response = await fetch(`${API_BASE}/atendimento/documento_cliente_deletar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const responseData = await response.json();
      const parsed = (await decrypt(responseData.payload)) as {
        boleano?: boolean;
        mensagem?: string;
      };

      if (!parsed?.boleano) {
        throw new Error(parsed?.mensagem || "Não foi possível remover o documento.");
      }

      await fetchClienteDetalhes(false);
      addToast({
        type: "success",
        title: "Documento removido",
        description: "Documento removido do cliente.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro ao remover documento",
        description:
          err instanceof Error ? err.message : "Não foi possível remover o documento.",
      });
    } finally {
      setDeletingContactDocumentId(null);
    }
  };

  const handleOpenCrmQuote = () => {
    if (!onOpenLiveQuote || !crmAtendimento?.negocio_id) {
      return;
    }

    const products = produtosCrm
      .map((produto: any, index: number) => {
        const nome = String(produto?.nome || "").trim();
        if (!nome) return null;

        const matchedProduct = crmProductOptions.find(
          (item) =>
            String(item.nome || "")
              .trim()
              .toLowerCase() === nome.toLowerCase(),
        );

        return {
          id: produto?.id || `${matchedProduct?.id || nome}-${index}`,
          comercialProdutoId: matchedProduct?.id,
          name: nome,
          quantity: Number(produto?.quantidade || 1) || 1,
          price:
            Number(
              produto?.preco_unitario ?? matchedProduct?.preco_base ?? 0,
            ) || 0,
        } satisfies DealProduct;
      })
      .filter(Boolean) as DealProduct[];

    onOpenLiveQuote({
      crm: {
        negocioId: Number(crmAtendimento.negocio_id),
        crmId: Number(crmAtendimento.crm_id || 0) || null,
        crmNome: crmAtendimento.crm_nome || null,
        etapaNome: crmAtendimento.etapa_nome || null,
        etapaFechamento: Boolean(crmAtendimento.etapa_fechamento),
      },
      catalogo: crmProductOptions,
      products,
      notes:
        String(crmAtendimento?.titulo || "").trim() ||
        String(crmAtendimento?.produto_principal || "").trim(),
      headerMessage: `Olá, ${conversation.name || "cliente"}! Montei um orçamento para você:`,
    });
  };

  const handleFinishDeal = async (
    updates: Partial<Deal>,
    successTitle: string,
  ) => {
    if (!crmAtendimento?.crm_id) {
      return;
    }

    try {
      const crmId = Number(crmAtendimento.crm_id);
      const shouldCreateNewDeal = Boolean(crmAtendimento.etapa_fechamento);
      const baseDealPayload: Partial<Deal> = {
        title:
          String(crmAtendimento?.titulo || "").trim() ||
          `WhatsApp - ${conversation.name || "Cliente"}`,
        companyName:
          String(crmAtendimento?.nome_empresa || "").trim() ||
          String(conversation.name || "").trim() ||
          "Cliente",
        contactName:
          String(crmAtendimento?.nome_contato || "").trim() ||
          String(conversation.name || "").trim() ||
          "Cliente",
        customerPhone:
          String(crmAtendimento?.telefone || "").trim() ||
          String(conversation.phone || "").trim() ||
          undefined,
        customerEmail:
          String(crmAtendimento?.email || "").trim() || undefined,
        customerDocument:
          String(crmAtendimento?.documento || "").trim() || undefined,
        clienteId: Number(conversation.cliente_id || 0) || undefined,
        ownerId: crmAtendimento?.responsavel_id
          ? String(crmAtendimento.responsavel_id)
          : undefined,
        ownerName: crmAtendimento?.responsavel_nome || undefined,
      };

      if (shouldCreateNewDeal) {
        await createCommercialDeal(
          {
            ...baseDealPayload,
            ...updates,
          },
          crmId,
        );
      } else if (crmAtendimento?.negocio_id) {
        await updateCommercialDeal(
          String(crmAtendimento.negocio_id),
          updates,
          crmId,
        );
      } else {
        return;
      }

      await fetchClienteDetalhes(false);
      setFinishModalType(null);
      addToast({
        type: "success",
        title: successTitle,
        description: shouldCreateNewDeal
          ? "Nova negociação criada e finalizada com sucesso."
          : "Funil atualizado com sucesso.",
      });
    } catch (err) {
      console.error("Erro ao finalizar negocio do funil:", err);
      addToast({
        type: "error",
        title: "Erro ao atualizar funil",
        description:
          err instanceof Error
            ? err.message
            : "Não foi possível atualizar o fechamento do funil.",
      });
    }
  };

  const handleSaveNoteClick = () => {
    if (!noteContent || noteContent === "<p></p>") return;

    const userId = currentUserId ?? 0;
    const authorName = currentUserName || user?.name || "Usuario";

    const newNote: Note = {
      user_id: userId,
      author: authorName,
      createdAt: new Date().toLocaleString(),
      content: noteContent,
    } as Note;

    setNotesState((prev) => [newNote, ...prev]);
    onSaveNote(noteContent);
    setNoteContent("");
  };

  const resetResponsibleSelection = () => {
    setSelectedResponsibleId(Number(crmAtendimento?.responsavel_id || 0) || "");
  };

  const resetPipelineTransferSelection = () => {
    setSelectedTransferCrmId("");
    setSelectedTransferStageId("");
    setCrmTransferStages([]);
  };

  const handleToggleAttendanceActionPanel = (
    panel: AttendanceActionPanelKey,
  ) => {
    setActiveAttendanceActionPanel((prev) => {
      const next = prev === panel ? null : panel;
      setCrmTransferOpen(next === "transferir-crm");
      if (next !== "transferir-crm") {
        setActiveCrmTransferSubpanel(null);
        resetResponsibleSelection();
        resetPipelineTransferSelection();
      }

      return next;
    });
  };

  const handleToggleCrmTransferSubpanel = (panel: CrmTransferSubpanelKey) => {
    setActiveCrmTransferSubpanel((prev) => {
      const next = prev === panel ? null : panel;

      resetResponsibleSelection();
      resetPipelineTransferSelection();

      return next;
    });
  };

  const handleClientSave = (contactData: Partial<Conversation>) => {
    const nextClientData: Partial<Conversation> = {
      ...contactData,
      id: conversation.cliente_id,
      cliente_id: conversation.cliente_id,
      phone: convPhone,
    };

    setClienteDetalhes(
      (current) =>
        ({
          ...(current || conversation),
          name: nextClientData.name || convName,
          nome: nextClientData.name || convName,
          email: nextClientData.email || "",
          cpf: nextClientData.cpf || "",
          phone: convPhone,
          telefone: convPhone,
          birthday: nextClientData.birthday || null,
          data_aniversario: nextClientData.birthday || null,
          origem: nextClientData.origem || convOrigin,
          logradouro: nextClientData.logradouro || "",
          numero: nextClientData.numero || "",
          complemento: nextClientData.complemento || "",
          bairro: nextClientData.bairro || "",
          cidade: nextClientData.cidade || "",
          uf: nextClientData.uf || "",
          cep: nextClientData.cep || "",
          empresa: nextClientData.empresa || "",
          cargo: nextClientData.cargo || "",
          faturamento: nextClientData.faturamento ?? null,
        }) as Conversation,
    );
    onUpdateClient?.(nextClientData);
    closeEditClientModal();
    void fetchClienteDetalhes(false);
  };

  const conv = clienteDetalhes || conversation;
  const convName =
    (conv as any)?.name || (conv as any)?.nome || conversation.name;
  const convPhone =
    (conv as any)?.phone || (conv as any)?.telefone || conversation.phone;
  const convEmail = (conv as any)?.email || conversation.email || "";
  const convCpf = (conv as any)?.cpf || conversation.cpf || "";
  const convBirthday =
    (conv as any)?.birthday ||
    (conv as any)?.data_aniversario ||
    conversation.birthday ||
    null;
  const convOrigin = (conv as any)?.origem || conversation.origem || "manual";
  const convLogradouro = (conv as any)?.logradouro || conversation.logradouro || "";
  const convNumero = (conv as any)?.numero || conversation.numero || "";
  const convComplemento = (conv as any)?.complemento || conversation.complemento || "";
  const convBairro = (conv as any)?.bairro || conversation.bairro || "";
  const convCidade = (conv as any)?.cidade || conversation.cidade || "";
  const convUf = (conv as any)?.uf || conversation.uf || "";
  const convCep = (conv as any)?.cep || conversation.cep || "";
  const convEmpresa = (conv as any)?.empresa || conversation.empresa || "";
  const convCargo = (conv as any)?.cargo || conversation.cargo || "";
  const convFaturamento =
    (conv as any)?.faturamento ?? conversation.faturamento ?? null;
  const documentLimitReached = contactDocuments.length >= 3;
  const canUploadContactDocument =
    !isUploadingContactDocument && !documentLimitReached && Boolean(contactDocumentFile);
  const latestNote = notesState[0] || null;
  const contactFormInitialData: Conversation = {
    ...conversation,
    id: conversation.cliente_id,
    name: convName,
    phone: convPhone,
    email: convEmail,
    cpf: convCpf,
    birthday: typeof convBirthday === "string" ? convBirthday : "",
    origem: convOrigin,
    logradouro: convLogradouro,
    numero: convNumero,
    complemento: convComplemento,
    bairro: convBairro,
    cidade: convCidade,
    uf: convUf,
    cep: convCep,
    empresa: convEmpresa,
    cargo: convCargo,
    faturamento: convFaturamento,
  };
  const openEditClientModal = () => {
    setEditClientInitialData({
      ...contactFormInitialData,
      tags: Array.isArray((conv as any)?.tags)
        ? ((conv as any).tags as Tag[])
        : conversation.tags || [],
      notes: Array.isArray((conv as any)?.notes)
        ? ((conv as any).notes as Note[])
        : conversation.notes || [],
    });
    setIsEditClientModalOpen(true);
  };
  const closeEditClientModal = () => {
    setIsEditClientModalOpen(false);
    setEditClientInitialData(null);
  };
  const getDetailsModalTitle = (panel: DetailsModalKey | null) => {
    if (panel === "whatsapp-atendimentos") return "Últimos Atendimentos";
    if (panel === "crm-historico") return "Histórico do funil";
    if (panel === "crm-interacoes") return "Interações do funil";
    if (panel === "anotacoes") return `Anotações sobre ${convName}`;
    return "Detalhes do atendimento";
  };
  const dealForFinish: Deal | null = useMemo(
    () =>
      crmAtendimento?.negocio_id
        ? {
            id: String(crmAtendimento.negocio_id),
            title: crmAtendimento.titulo || `Funil - ${convName}`,
            amount: Number(
              crmAtendimento.valor_fechamento ??
                crmAtendimento.valor_estimado ??
                0,
            ),
            companyName: convName,
            contactName: convName,
            stage: String(crmAtendimento.etapa_codigo || "waiting"),
            probability: 0,
            createdAt: crmAtendimento.data_criacao || null,
            entryDate: crmAtendimento.data_entrada_pipeline || null,
            closingDate: crmAtendimento.data_fechamento_real || null,
            ownerId: crmAtendimento.responsavel_id
              ? String(crmAtendimento.responsavel_id)
              : "",
            ownerName: crmAtendimento.responsavel_nome || "",
            itemQuantity: quantidadeItensCrm || undefined,
            quote: quoteForFinish,
            products: produtosCrmNormalizados,
          }
        : null,
    [
      convName,
      crmAtendimento?.data_criacao,
      crmAtendimento?.data_entrada_pipeline,
      crmAtendimento?.data_fechamento_real,
      crmAtendimento?.etapa_codigo,
      crmAtendimento?.negocio_id,
      crmAtendimento?.responsavel_id,
      crmAtendimento?.responsavel_nome,
      crmAtendimento?.titulo,
      crmAtendimento?.valor_estimado,
      crmAtendimento?.valor_fechamento,
      produtosCrmNormalizados,
      quantidadeItensCrm,
      quoteForFinish,
    ],
  );

  if (loading && !hasLoadedDetails) {
    return (
      <div className="client-details-container">
        <p>Carregando detalhes...</p>
      </div>
    );
  }

  return (
    <aside className="client-details-container">
      <div className="client-details-content">
        <div className="client-details-title-block">
          <h3>Detalhes - {convName}</h3>
          <div className="client-details-top-actions">
            <span
              className={`card-badge contact-origin-badge origin-${normalizeClientOrigin(convOrigin)}`}
            >
              <FiTarget size={12} />
              <span className="card-badge__label">Origem:</span>
              <span className="card-badge__value">
                {formatClientOrigin(convOrigin)}
              </span>
            </span>
            <div className="details-section-actions">
              <button
                type="button"
                className="details-inline-action"
                onClick={() =>
                  setIsClientProfileExpanded((current) => !current)
                }
                aria-expanded={isClientProfileExpanded}
              >
                {isClientProfileExpanded ? (
                  <FiChevronUp size={14} />
                ) : (
                  <FiChevronDown size={14} />
                )}
                <span>
                  {isClientProfileExpanded ? "Ver menos" : "Ver mais"}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="details-section details-section--client-profile">
          <div className="details-section-header" />
          {isClientProfileExpanded && (
            <div className="client-profile-card">
             
              <div className="client-profile-grid">
                <div className="client-profile-field">
                  <span>Nome</span>
                  <strong>{convName || "-"}</strong>
                </div>
                <div className="client-profile-field">
                  <span>Telefone</span>
                  <strong>{formatClientPhone(convPhone)}</strong>
                </div>
                <div className="client-profile-field">
                  <span>E-mail</span>
                  <strong>{convEmail || "-"}</strong>
                </div>
                <div className="client-profile-field">
                  <span>CPF</span>
                  <strong>{formatClientCpf(convCpf)}</strong>
                </div>
                <div className="client-profile-field">
                  <span>Aniversário</span>
                  <strong>{formatClientBirthday(convBirthday)}</strong>
                </div>
                <div className="client-profile-field">
                  <span>Empresa</span>
                  <strong>{convEmpresa || "-"}</strong>
                </div>
                <div className="client-profile-field">
                  <span>Cargo</span>
                  <strong>{convCargo || "-"}</strong>
                </div>
                <div className="client-profile-field">
                  <span>Faturamento</span>
                  <strong>{formatClientCurrency(convFaturamento)}</strong>
                </div>
                <div className="client-profile-field">
                  <span>Endereço</span>
                  <strong>
                    {formatClientAddress({
                      logradouro: convLogradouro,
                      numero: convNumero,
                      complemento: convComplemento,
                      bairro: convBairro,
                      cidade: convCidade,
                      uf: convUf,
                      cep: convCep,
                    })}
                  </strong>
                </div>
              </div>
             
               <div className="client-profile-card-actions">
                <button
                  type="button"
                  className="details-inline-action"
                  onClick={openEditClientModal}
                  aria-label="Editar cliente"
                  title="Editar cliente"
                >
                  <FiEdit2 size={14} />
                  <span>Editar</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="details-section">
          <h3 className="details-section-title">Ações do atendimento</h3>
          <div
            className={`details-icon-tabs details-icon-tabs--actions ${
              onAssistConversionIa ? "details-icon-tabs--actions-with-ia" : ""
            }`}
          >
            {onAssistConversionIa && (
              <button
                type="button"
                className="details-icon-tab"
                onClick={onAssistConversionIa}
                title="Auxilio de conversao via IA"
                aria-label="Auxilio de conversao via IA"
              >
                <FiCpu size={16} />
                <span>Auxilio IA</span>
              </button>
            )}
            <button
              type="button"
              className={`details-icon-tab details-icon-tab--transfer ${activeAttendanceActionPanel === "transferir-crm" ? "active" : ""}`}
              onClick={() =>
                handleToggleAttendanceActionPanel("transferir-crm")
              }
              title="Transferir para funil"
              aria-label="Transferir para funil"
            >
              <FiBriefcase size={16} />
              <span>Funil</span>
            </button>
            <button
              type="button"
              className={`details-icon-tab ${activeAttendanceActionPanel === "tags" ? "active" : ""}`}
              onClick={() => handleToggleAttendanceActionPanel("tags")}
              title="Tags"
              aria-label="Tags"
            >
              <FiTag size={16} />
              <span>Tags</span>
            </button>
            <button
              type="button"
              className={`details-icon-tab ${activeAttendanceActionPanel === "anotacoes" ? "active" : ""}`}
              onClick={() => handleToggleAttendanceActionPanel("anotacoes")}
              title={`Anotações sobre ${convName}`}
              aria-label={`Anotações sobre ${convName}`}
            >
              <FiFileText size={16} />
              <span>Anotações</span>
            </button>
            <button
              type="button"
              className={`details-icon-tab ${isClientBlocked ? "active details-icon-tab--danger" : ""}`}
              onClick={() => isClientBlocked ? void handleToggleClientBlock() : setSafetyModal("block")}
              disabled={isUpdatingBlock}
              title={isClientBlocked ? "Desbloquear cliente" : "Bloquear cliente"}
            >
              <FiShield size={16} />
              <span>{isClientBlocked ? "Desbloquear" : "Bloquear"}</span>
            </button>
            <button
              type="button"
              className="details-icon-tab details-icon-tab--danger"
              onClick={() => { setSafetyReason(""); setSafetyDescription(""); setSafetyModal("report"); }}
              title="Denunciar cliente"
            >
              <FiFlag size={16} />
              <span>Denunciar</span>
            </button>
          </div>

          {activeAttendanceActionPanel === "tags" && (
            <div className="details-panel-body">
              <div className="tag-input-wrapper">
                <div className="tag-input-form">
                  <input
                    id="tag-input"
                    type="text"
                    className="tag-input"
                    placeholder="Buscar ou adicionar tag..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canCreateTag) {
                        e.preventDefault();
                        void handleCreateTag();
                      }
                    }}
                  />
                </div>
                {loadingTags && (
                  <div className="tag-suggestions-loading">Buscando...</div>
                )}
                {(tagSuggestions.length > 0 || canCreateTag) && (
                  <ul className="tag-suggestions-list">
                    {tagSuggestions.map((tag) => (
                      <li
                        className="tag-suggestion-item"
                        key={tag.id}
                        onClick={() => handleSelectTag(tag)}
                      >
                        {tag.name}
                      </li>
                    ))}
                    {canCreateTag && (
                      <li
                        className="tag-suggestion-item tag-suggestion-item--create"
                        onClick={() => void handleCreateTag()}
                      >
                        {isCreatingTag
                          ? "Criando tag..."
                          : `Criar tag "${normalizedTagSearch}"`}
                      </li>
                    )}
                  </ul>
                )}
              </div>
              <div className="associated-tags-section">
                <strong>Tags associadas</strong>
                <div className="tags-list">
                  {tagsState.length ? (
                    tagsState.map((tag) => (
                      <span key={tag.id} className="tag-item">
                        {tag.name}
                        <button
                          className="remove-tag-btn"
                          onClick={() => handleRemoveTag(tag.id)}
                          title={`Remover tag ${tag.name}`}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </span>
                    ))
                  ) : (
                    <p className="no-notes-message">
                      Nenhuma tag associada.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeAttendanceActionPanel === "anotacoes" && (
            <div className="details-panel-body attendance-notes-panel">
              <div className="note-input-section">
                <RichTextEditor
                  content={noteContent}
                  onChange={setNoteContent}
                  placeholder="Adicionar uma anotação..."
                />
                <button
                  type="button"
                  className="save-note-button"
                  onClick={handleSaveNoteClick}
                  disabled={!noteContent || noteContent === "<p></p>"}
                >
                  <FiPlus size={16} /> Salvar anotação
                </button>
              </div>

              <div className="latest-note-section">
                <div className="latest-note-section__header">
                  <strong>Última anotação</strong>
                  <button
                    type="button"
                    className="details-inline-action"
                    onClick={() => setDetailsModalPanel("anotacoes")}
                  >
                    Ver todas
                  </button>
                </div>
                {latestNote ? (
                  <div className="note-item">
                    <div className="note-header">
                      <span className="note-author">
                        Colaborador: {latestNote.author}
                      </span>
                      <span className="note-date">{latestNote.createdAt}</span>
                    </div>
                    <div
                      className="note-content"
                      dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(latestNote.content) }}
                    />
                  </div>
                ) : (
                  <p className="no-notes-message">
                    Nenhuma anotação encontrada.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeAttendanceActionPanel === "transferir-crm" && (
            <div className="details-panel-body">
              {crmAtendimento ? (
                <>
                  <h4 className="crm-actions-title">Ações do funil</h4>
                  <div className="crm-action-grid">
                    <button
                      type="button"
                      className="crm-transfer-action-button crm-transfer-action-button--secondary"
                      onClick={handleOpenCrmQuote}
                      disabled={loadingCrmDomains || !onOpenLiveQuote}
                      title="Abrir orçamento"
                      aria-label="Abrir orçamento"
                    >
                      <FiPackage size={16} />
                      <span>Orçamento</span>
                    </button>
                    <button
                      type="button"
                      className="crm-transfer-action-button crm-transfer-action-button--success"
                      onClick={() => setFinishModalType("won")}
                      title="Marcar venda como ganha"
                      aria-label="Marcar venda como ganha"
                      disabled={
                        loadingCrmDomains ||
                        !dealForFinish ||
                        !crmPaymentOptions.length
                      }
                    >
                      <FiCheckCircle size={16} />
                      <span>Venda ganha</span>
                    </button>
                    <button
                      type="button"
                      className="crm-transfer-action-button crm-transfer-action-button--danger"
                      onClick={() => setFinishModalType("lost")}
                      title="Marcar venda como perdida"
                      aria-label="Marcar venda como perdida"
                      disabled={
                        loadingCrmDomains ||
                        !dealForFinish ||
                        !crmLossReasonOptions.length
                      }
                    >
                      <FiSlash size={16} />
                      <span>Venda perdida</span>
                    </button>
                    {user?.is_master && (
                      <button
                        type="button"
                        className={`crm-transfer-action-button ${
                          activeCrmTransferSubpanel === "responsavel"
                            ? "active"
                            : ""
                        }`}
                        onClick={() => handleToggleCrmTransferSubpanel("responsavel")}
                        title="Atualizar responsavel"
                        aria-label="Atualizar responsavel"
                      >
                        <FiRefreshCcw size={16} />
                        <span>Responsavel</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`crm-transfer-action-button ${
                        activeCrmTransferSubpanel === "pipeline" ? "active" : ""
                      }`}
                      onClick={() => handleToggleCrmTransferSubpanel("pipeline")}
                      title="Transferir pipeline"
                      aria-label="Transferir pipeline"
                    >
                      <FiBriefcase size={16} />
                      <span>Pipeline</span>
                    </button>
                  </div>

                  {user?.is_master && activeCrmTransferSubpanel === "responsavel" && (
                    <div className="crm-transfer-panel crm-transfer-panel--responsavel">
                      <label className="crm-transfer-field">
                        <span>Responsavel no funil</span>
                        <select
                          className="sector-select"
                          value={selectedResponsibleId}
                          onChange={(e) =>
                            setSelectedResponsibleId(Number(e.target.value))
                          }
                          disabled={
                            loadingResponsibleOptions || isUpdatingResponsible
                          }
                        >
                          <option value="">
                            {loadingResponsibleOptions
                              ? "Carregando responsaveis..."
                              : "Selecione um responsavel"}
                          </option>
                          {crmResponsibles.map((responsavel) => (
                            <option key={responsavel.id} value={responsavel.id}>
                              {responsavel.nome}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        className="crm-transfer-submit crm-transfer-submit--secondary"
                        onClick={() => void handleUpdateResponsible()}
                        disabled={
                          isUpdatingResponsible ||
                          loadingResponsibleOptions ||
                          !selectedResponsibleId ||
                          Number(selectedResponsibleId) ===
                            Number(crmAtendimento.responsavel_id || 0)
                        }
                      >
                        {isUpdatingResponsible
                          ? "Atualizando..."
                          : "Atualizar responsavel"}
                      </button>
                    </div>
                  )}

                  {activeCrmTransferSubpanel === "pipeline" && (
                  <div className="crm-transfer-panel">
                    <label className="crm-transfer-field">
                      <span>Pipeline destino</span>
                      <select
                        className="sector-select"
                        value={selectedTransferCrmId}
                        onChange={(e) =>
                          setSelectedTransferCrmId(Number(e.target.value))
                        }
                        disabled={loadingCrmOptions || isTransferringCrm}
                      >
                        <option value="">
                          {loadingCrmOptions
                            ? "Carregando pipelines..."
                            : "Selecione um pipeline"}
                        </option>
                        {selectedTransferCrmId &&
                        !selectedTransferCrmOption &&
                        savedTransferDraft?.selectedTransferCrmName ? (
                          <option value={selectedTransferCrmId}>
                            {savedTransferDraft.selectedTransferCrmName}
                          </option>
                        ) : null}
                        {crmOptions.map((crm) => (
                          <option key={crm.id} value={crm.id}>
                            {crm.nome}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="crm-transfer-field">
                      <span>Etapa destino</span>
                      <select
                        className="sector-select"
                        value={selectedTransferStageId}
                        onChange={(e) =>
                          setSelectedTransferStageId(Number(e.target.value))
                        }
                        disabled={
                          !selectedTransferCrmId ||
                          loadingCrmStages ||
                          isTransferringCrm
                        }
                      >
                        <option value="">
                          {loadingCrmStages
                            ? "Carregando etapas..."
                            : "Selecione uma etapa"}
                        </option>
                        {selectedTransferStageId &&
                        !selectedTransferStageOption &&
                        savedTransferDraft?.selectedTransferStageName ? (
                          <option value={selectedTransferStageId}>
                            {savedTransferDraft.selectedTransferStageName}
                          </option>
                        ) : null}
                        {crmTransferStages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.nome}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className="crm-transfer-submit"
                      onClick={() => void handleTransferCrm()}
                      disabled={
                        isTransferringCrm ||
                        loadingCrmOptions ||
                        loadingCrmStages ||
                        !selectedTransferCrmId ||
                        !selectedTransferStageId
                      }
                    >
                      {isTransferringCrm
                        ? "Movendo..."
                        : "Confirmar transferencia"}
                    </button>
                  </div>
                  )}
                </>
              ) : (
                <div className="crm-transfer-panel">
                  <p className="no-notes-message">
                    Cliente sem atendimento ativo no funil.
                  </p>
                  <button
                    type="button"
                    className="crm-transfer-submit"
                    onClick={() => void handleEnsureCrmAttendance()}
                    disabled={
                      isEnsuringCrmAttendance ||
                      !conversation.empresaMetaParamId
                    }
                  >
                    {isEnsuringCrmAttendance
                      ? "Vinculando..."
                      : "Vincular atendimento ao funil deste numero"}
                  </button>
                  {!conversation.empresaMetaParamId && (
                    <p className="no-notes-message">
                      Esta conversa nao possui um numero da Meta identificado para
                      localizar o pipeline correto.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="details-section">
          <div className="details-section-header details-section-header--documents">
            <h3 className="details-section-title">Documentos do cliente</h3>
          </div>

          <div className="client-documents-summary">
            <div className="client-documents-summary__count">
              <strong>{contactDocuments.length}/3 documentos ativos</strong>
            </div>
            <button
              type="button"
              className={`details-inline-action${isDocumentsUploadOpen ? " is-open" : ""}`}
              onClick={() => setIsDocumentsUploadOpen((current) => !current)}
              disabled={documentLimitReached && !isDocumentsUploadOpen}
              title={
                isDocumentsUploadOpen
                  ? "Fechar envio de documento"
                  : documentLimitReached
                    ? "Limite atingido. Remova um documento para adicionar outro."
                    : "Adicionar documento"
              }
              aria-label={
                isDocumentsUploadOpen
                  ? "Fechar envio de documento"
                  : documentLimitReached
                    ? "Limite atingido. Remova um documento para adicionar outro."
                    : "Adicionar documento"
              }
            >
              <FiPlus size={14} />
              <span>{isDocumentsUploadOpen ? "Fechar" : "Adicionar"}</span>
            </button>
          </div>

          {isDocumentsUploadOpen ? (
            <div className="client-documents-upload-panel">
              <p className="client-documents-hint">
                Até 3 arquivos ativos, 20MB por arquivo.
              </p>
              <label className="client-documents-picker">
                <span>Selecionar documento</span>
                <small>PDF, Office, TXT, ZIP e RAR</small>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                  disabled={isUploadingContactDocument || documentLimitReached}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setContactDocumentFile(file);
                  }}
                />
              </label>

              {contactDocumentFile ? (
                <div className="client-documents-selected">
                  <div className="client-documents-selected__meta">
                    <strong>{contactDocumentFile.name}</strong>
                    <span>{formatFileSize(contactDocumentFile.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="client-documents-selected__clear"
                    onClick={() => setContactDocumentFile(null)}
                    disabled={isUploadingContactDocument}
                  >
                    Trocar arquivo
                  </button>
                </div>
              ) : (
                <div className="client-documents-selected client-documents-selected--placeholder">
                  Nenhum arquivo selecionado.
                </div>
              )}

              <button
                type="button"
                className={`crm-transfer-submit crm-transfer-submit--secondary client-documents-submit${canUploadContactDocument ? " is-active" : ""}`}
                onClick={() => void handleUploadContactDocument()}
                disabled={
                  isUploadingContactDocument ||
                  !contactDocumentFile ||
                  documentLimitReached
                }
              >
                <FiUpload size={14} />
                <span>{isUploadingContactDocument ? "Enviando..." : "Salvar documento"}</span>
              </button>
            </div>
          ) : null}

          <div className="client-documents-list">
            {contactDocuments.length ? (
              contactDocuments.map((document) => (
                <div key={`client-doc-${document.id}`} className="client-document-card">
                  <div className="client-document-card__info">
                    <div className="client-document-card__head">
                      <strong title={document.nome_arquivo || "Documento"}>
                        {formatDocumentFileName(document.nome_arquivo)}
                      </strong>
                      <span>
                        {document.data_criacao
                          ? new Date(document.data_criacao).toLocaleString("pt-BR")
                          : "-"}
                      </span>
                    </div>
                    <div className="client-document-card__meta">
                      <span className="client-document-badge">{document.origem || "contato"}</span>
                      <span className="client-document-badge">
                        {formatFileSize(document.tamanho_bytes)}
                      </span>
                    </div>
                  </div>
                  <div className="client-document-card__actions">
                    {document.url ? (
                      <a
                        className="client-document-action"
                        href={document.url}
                        target="_blank"
                        rel="noreferrer"
                        download={document.nome_arquivo || "documento"}
                        title="Baixar documento"
                        aria-label="Baixar documento"
                      >
                        <FiDownload size={14} />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="client-document-action client-document-action--danger"
                      onClick={() => void handleDeleteContactDocument(document.id)}
                      disabled={deletingContactDocumentId === document.id}
                      title={
                        deletingContactDocumentId === document.id
                          ? "Removendo documento"
                          : "Remover documento"
                      }
                      aria-label={
                        deletingContactDocumentId === document.id
                          ? "Removendo documento"
                          : "Remover documento"
                      }
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-notes-message">
                Nenhum documento cadastrado para este cliente.
              </p>
            )}
          </div>
        </div>

        <div className="details-section">
          <h3 className="details-section-title">Detalhes do atendimento</h3>
          <div className="details-icon-tabs">
            <button
              type="button"
              className="details-icon-tab"
              onClick={() => setDetailsModalPanel("whatsapp-atendimentos")}
              title="Últimos Atendimentos"
              aria-label="Últimos Atendimentos"
            >
              <FiMessageCircle size={16} />
              <span>Últimos Atendimentos</span>
            </button>
            <button
              type="button"
              className="details-icon-tab"
              onClick={() => setDetailsModalPanel("crm-historico")}
              title="Historico do funil"
              aria-label="Historico do funil"
            >
              <FiRefreshCcw size={16} />
              <span>Historico do funil</span>
            </button>
            <button
              type="button"
              className="details-icon-tab"
              onClick={() => setDetailsModalPanel("crm-interacoes")}
              title="Interações do funil"
              aria-label="Interações do funil"
            >
              <FiClock size={16} />
              <span>Interações do funil</span>
            </button>
          </div>
        </div>

        <div className="details-section" ref={crmSectionRef}>
          <div className="crm-section-header">
            <h3 className="details-section-title">Funil</h3>
          </div>
          {crmAtendimento ? (
            <div className="crm-summary-card">
              <p>
                <strong>Funil:</strong> {crmAtendimento.crm_nome || "-"}
              </p>
              <p>
                <strong>Etapa:</strong> {crmAtendimento.etapa_nome || "-"}
              </p>
              <p>
                <strong>Titulo:</strong> {crmAtendimento.titulo || "-"}
              </p>
              <p>
                <strong>Orçamento em negociação:</strong>{" "}
                {valorOrcamentoCrm > 0
                  ? `R$ ${valorOrcamentoCrm.toFixed(2)}`
                  : "Não definido"}
              </p>
              <p>
                <strong>Itens negociados:</strong>{" "}
                {quantidadeItensCrm > 0 ? quantidadeItensCrm : "-"}
              </p>
              {produtosCrm.length > 0 && (
                <p>
                  <strong>Produtos:</strong>{" "}
                  {produtosCrm
                    .map((produto: any) => produto?.nome)
                    .filter(Boolean)
                    .join(", ") || "-"}
                </p>
              )}
              <p>
                <strong>Responsável:</strong>{" "}
                {crmAtendimento.responsavel_nome || "Sem responsável"}
              </p>
            </div>
          ) : (
            <p className="no-notes-message">
              Cliente sem atendimento ativo no funil.
            </p>
          )}
        </div>
      </div>

      {dealForFinish && finishModalType && (
        <FinishServiceModal
          isOpen={Boolean(finishModalType)}
          onClose={() => setFinishModalType(null)}
          deal={dealForFinish}
          initialFinishType={finishModalType}
          paymentOptions={crmPaymentOptions}
          lossReasonOptions={crmLossReasonOptions}
          productCatalog={crmProductOptions}
          onConfirmSale={(data) =>
            void handleFinishDeal(data, "Venda marcada como ganha")
          }
          onConfirmRefusal={(data) =>
            void handleFinishDeal(data, "Venda marcada como perdida")
          }
        />
      )}
      <Modal
        isOpen={isEditClientModalOpen}
        onClose={closeEditClientModal}
        title="Editar cliente"
      >
        <ContactForm
          initialData={editClientInitialData}
          onCancel={closeEditClientModal}
          onSave={handleClientSave}
        />
      </Modal>
      <Modal
        isOpen={safetyModal === "block"}
        onClose={() => setSafetyModal(null)}
        title="Bloquear cliente?"
        size="sm"
      >
        <div className="client-safety-modal">
          <p>Mensagens deste cliente não entrarão na fila e não gerarão notificações enquanto ele estiver bloqueado.</p>
          <label>Motivo (opcional)<textarea value={safetyReason} onChange={(event) => setSafetyReason(event.target.value)} placeholder="Ex.: envio recorrente de spam" /></label>
          <div className="client-safety-modal__actions">
            <button type="button" className="details-secondary-button" onClick={() => setSafetyModal(null)}>Cancelar</button>
            <button type="button" className="details-danger-button" onClick={() => void handleToggleClientBlock()} disabled={isUpdatingBlock}>{isUpdatingBlock ? "Bloqueando..." : "Confirmar bloqueio"}</button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={safetyModal === "report"}
        onClose={() => setSafetyModal(null)}
        title="Denunciar comportamento"
        size="sm"
      >
        <div className="client-safety-modal">
          <label>Motivo da denúncia *<input value={safetyReason} onChange={(event) => setSafetyReason(event.target.value)} placeholder="Ex.: assédio, fraude ou conteúdo abusivo" /></label>
          <label>Detalhes (opcional)<textarea value={safetyDescription} onChange={(event) => setSafetyDescription(event.target.value)} placeholder="Descreva o ocorrido para ajudar na análise." /></label>
          <div className="client-safety-modal__actions">
            <button type="button" className="details-secondary-button" onClick={() => setSafetyModal(null)}>Cancelar</button>
            <button type="button" className="details-danger-button" onClick={() => void handleReportClient()} disabled={isSubmittingReport || !safetyReason.trim()}>{isSubmittingReport ? "Enviando..." : "Enviar denúncia"}</button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={detailsModalPanel !== null}
        onClose={() => setDetailsModalPanel(null)}
        title={getDetailsModalTitle(detailsModalPanel)}
        size="lg"
      >
        <div className="details-modal-content">
          {detailsModalPanel === "crm-interacoes" && (
            <div className="details-modal-list">
              {crmInteracoes.length ? (
                crmInteracoes.map((item) => (
                  <div key={`modal-int-${item.id}`} className="note-item">
                    <div className="note-header">
                      <span className="note-author">
                        {item.tipo_nome || item.tipo_codigo || "Interação"}
                      </span>
                      <span className="note-date">
                        {item.data_inicio
                          ? new Date(item.data_inicio).toLocaleString("pt-BR")
                          : "-"}
                      </span>
                    </div>
                    <div className="note-content">{item.descricao || "-"}</div>
                  </div>
                ))
              ) : (
                <p className="no-notes-message">Nenhuma interação no funil.</p>
              )}
            </div>
          )}

          {detailsModalPanel === "crm-historico" && (
            <div className="details-modal-list">
              {crmHistorico.length ? (
                crmHistorico.map((item) => (
                  <div key={`modal-hist-${item.id}`} className="note-item">
                    <div className="note-header">
                      <span className="note-author">
                        {item.titulo || item.tipo || "Registro"}
                      </span>
                      <span className="note-date">
                        {item.criado_em
                          ? new Date(item.criado_em).toLocaleString("pt-BR")
                          : "-"}
                      </span>
                    </div>
                    <div className="note-content">
                      <p>
                        <strong>Alterado por:</strong>{" "}
                        {item.atendente_nome || "Sistema"}
                      </p>
                      <p>{item.descricao || "-"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-notes-message">Nenhum histórico no funil.</p>
              )}
            </div>
          )}

          {detailsModalPanel === "whatsapp-atendimentos" && (
            <div className="details-modal-list">
              {historicoAtendimentosWhatsapp.length ? (
                historicoAtendimentosWhatsapp.map((item) => (
                  <div
                    key={`modal-ccw-${item.conversa_id}`}
                    className="note-item"
                  >
                    <div className="note-header">
                      <span className="note-author">
                        Atendimento #{item.conversa_id}
                      </span>
                      <span className="note-date">
                        {item.data_inicio
                          ? new Date(item.data_inicio).toLocaleString("pt-BR")
                          : "-"}
                      </span>
                    </div>
                    <div className="note-content">
                      <p>
                        <strong>Status:</strong>{" "}
                        {Number(item.status_id) === 1
                          ? "Em andamento"
                          : Number(item.status_id) === 2
                            ? "Finalizado"
                            : "Aguardando"}
                      </p>
                      <p>
                        <strong>Atendente:</strong>{" "}
                        {item.atendente_nome || "Não atribuido"}
                      </p>
                      <p>
                        <strong>Fim:</strong>{" "}
                        {item.data_fim
                          ? new Date(item.data_fim).toLocaleString("pt-BR")
                          : "-"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-notes-message">
                  Sem histórico de atendimentos.
                </p>
              )}
            </div>
          )}

          {detailsModalPanel === "anotacoes" && (
            <div className="details-modal-list">
              {notesState.length > 0 ? (
                notesState.map((note, index) => (
                  <div
                    key={`modal-${note.user_id}_${note.createdAt}_${index}`}
                    className="note-item"
                  >
                    <div className="note-header">
                      <span className="note-author">
                        Colaborador: {note.author}
                      </span>
                      <span className="note-date">{note.createdAt}</span>
                    </div>
                    <div
                      className="note-content"
                      dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(note.content) }}
                    />
                  </div>
                ))
              ) : (
                <p className="no-notes-message">Nenhuma anotação encontrada.</p>
              )}
            </div>
          )}
        </div>
      </Modal>

    </aside>
  );
}
