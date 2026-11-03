import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMemo } from "react";
import { io, type Socket } from "socket.io-client";
import { getServerSessionToken } from "../../utils/authenticatedFetch";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { ConversationList } from "../../components/ConversationList/ConversationList";
import { ChatWindow } from "../../components/ChatWindow/ChatWindow";
import { MetaTemplatePreview } from "../../components/MetaTemplatePreview/MetaTemplatePreview";
import { Modal } from "../../components/common/Modal/Modal";
import type { Note, Conversation, TabType, Tag } from "../../data/mockData";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { ClientDetails } from "../../components/ClientDetails/ClientDetails";
import { useAuth } from "../../contexts/AuthContext";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { BottomSheet } from "../../components/common/BottomSheet/BottomSheet";
import { encrypt, decrypt } from "../../utils/cripto";
import { API_BASE } from "../../config/api";
import { generateColorFromName } from "../../utils/colors";
import {
  createCommercialDeal,
  updateCommercialDeal,
  type DealProduct,
} from "../../service/commercialService";
import {
  MetaService,
  type MetaIntegrationAccount,
  type MetaTemplateQuickSuggestion,
  type MetaTemplateItem,
} from "../../service/metaService";
import type {
  QuickMessageGalleryDocument,
  QuickMessageGalleryImage,
} from "../../types/quickMessages";
import "./ChatPage.css";

interface ApiConversation {
  id: number;
  cliente_id: number;
  nome: string;
  telefone: string;
  status: TabType;
  data_inicio: string;
  ultima_atualizacao: string;
  ultima_mensagem: string | null;
  ultima_mensagem_send_by?: number | null;
  tags?: Tag[];
  notes?: Note[];
  unread_count?: number;
  nome_atendente?: string;
  setor?: { id: number; nome: string } | null;
  fila_desde?: string | null;
  fila_mais_24h?: boolean;
  ultima_mensagem_cliente_em?: string | null;
  janela_meta_expira_em?: string | null;
  janela_meta_aberta?: boolean;
  aguardando_resposta_template?: boolean;
  usuario_id?: number | null;
  empresa_meta_param_id?: number | null;
  meta_numero_conta?: string | null;
  meta_nome_conta?: string | null;
  meta_cor?: string | null;
  usuario_atribuido_id?: number | null;
  nome_usuario_atribuido?: string | null;
  search_match_preview?: string | null;
  search_match_timestamp?: string | null;
}

type AtendimentoConfig = {
  atendimento_lista_atribuida_adm: boolean;
  atendimento_mensagens_rapidas_ativas: boolean;
  atendimento_disparo_nps_ativo: boolean;
  atendimento_fila_automatica_ativa: boolean;
  atendimento_fila_usuarios: number[];
};

type AssignableUser = {
  id: number;
  name: string;
  is_master?: boolean;
};

type MetaNumberFilterOption = {
  value: string;
  label: string;
};

type ConversationSearchRequest = {
  term: string;
  status: TabType;
  showUnreadOnly: boolean;
};

type ConversationsListResponse = {
  items: ApiConversation[];
  finishedPagination: {
    limit: number;
    offset: number;
    loaded: number;
    total: number;
    hasMore: boolean;
  };
};

type FinishedConversationsFetchOptions = {
  finishedLimit?: number;
  finishedOffset?: number;
  finishedPage?: number;
  loadingMoreFinished?: boolean;
};

function normalizeRouteConversationSnapshot(value: unknown): ApiConversation | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<ApiConversation> & { status?: unknown };
  const id = Number(raw.id || 0);
  if (!Number.isInteger(id) || id <= 0) return null;

  const rawStatus = String(raw.status || "").trim();
  const status: TabType =
    rawStatus === "waiting" || rawStatus === "finished" ? rawStatus : "active";

  return {
    id,
    cliente_id: Number(raw.cliente_id || 0) || 0,
    nome: String(raw.nome || "").trim() || "Cliente",
    telefone: String(raw.telefone || "").trim(),
    status,
    data_inicio:
      String(raw.data_inicio || raw.fila_desde || raw.ultima_atualizacao || "").trim() ||
      new Date().toISOString(),
    ultima_atualizacao:
      String(raw.ultima_atualizacao || raw.data_inicio || "").trim() ||
      new Date().toISOString(),
    ultima_mensagem:
      raw.ultima_mensagem === null || raw.ultima_mensagem === undefined
        ? null
        : String(raw.ultima_mensagem),
    ultima_mensagem_send_by:
      raw.ultima_mensagem_send_by === null || raw.ultima_mensagem_send_by === undefined
        ? null
        : Number(raw.ultima_mensagem_send_by || 0),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    unread_count:
      raw.unread_count === null || raw.unread_count === undefined
        ? undefined
        : Number(raw.unread_count || 0),
    nome_atendente: raw.nome_atendente || undefined,
    setor: raw.setor || null,
    fila_desde: raw.fila_desde || raw.data_inicio || null,
    fila_mais_24h:
      raw.fila_mais_24h === undefined ? undefined : Boolean(raw.fila_mais_24h),
    ultima_mensagem_cliente_em: raw.ultima_mensagem_cliente_em || null,
    janela_meta_expira_em: raw.janela_meta_expira_em || null,
    janela_meta_aberta:
      raw.janela_meta_aberta === undefined ? undefined : Boolean(raw.janela_meta_aberta),
    aguardando_resposta_template:
      raw.aguardando_resposta_template === undefined
        ? undefined
        : Boolean(raw.aguardando_resposta_template),
    usuario_id:
      raw.usuario_id === null || raw.usuario_id === undefined
        ? null
        : Number(raw.usuario_id || 0),
    empresa_meta_param_id:
      raw.empresa_meta_param_id === null || raw.empresa_meta_param_id === undefined
        ? null
        : Number(raw.empresa_meta_param_id || 0),
    meta_numero_conta: raw.meta_numero_conta || null,
    meta_nome_conta: raw.meta_nome_conta || null,
    meta_cor: raw.meta_cor || null,
    usuario_atribuido_id:
      raw.usuario_atribuido_id === null || raw.usuario_atribuido_id === undefined
        ? null
        : Number(raw.usuario_atribuido_id || 0),
    nome_usuario_atribuido: raw.nome_usuario_atribuido || null,
    search_match_preview: raw.search_match_preview || null,
    search_match_timestamp: raw.search_match_timestamp || null,
  };
}

type ChatGalleryImage = QuickMessageGalleryImage & {
  selectionKey: string;
};

type ChatGalleryDocument = QuickMessageGalleryDocument & {
  selectionKey: string;
};

type AtendimentoIaAnalise = {
  precisa_contexto_minimo: boolean;
  solicitacao_contexto: string;
  notas_por_etapa: {
    abordagem: number;
    diagnostico: number;
    proposta: number;
    negociacao: number;
    follow_up: number;
    fechamento: number;
    pos_venda: number;
  };
  nota_final: number;
  kpis_comerciais: string[];
  diagnostico_gargalos: string[];
  risco_perda: string;
  probabilidade_avanco: string;
  proxima_etapa_recomendada: string;
  ajustes_finos: string[];
  boas_praticas_reforcar: string[];
  script_sugestao_imediato: string[];
  script_completo_nota_10: string[];
};

type AtendimentoIaResultado = {
  conversa_id: number;
  cliente?: {
    id?: number;
    nome?: string;
    telefone?: string;
  };
  atendente?: {
    nome?: string | null;
  };
  total_mensagens?: number;
  analise?: AtendimentoIaAnalise;
};

type AssistenciaConversaoIa = {
  resumo_situacao: string;
  estagio_funil_atual: string;
  dor_principal_cliente: string;
  objetivo_imediato_atendente: string;
  proxima_melhor_acao: string;
  mensagens_sugeridas: string[];
  perguntas_estrategicas: string[];
  objecoes_provaveis: string[];
  respostas_recomendadas_objecoes: string[];
  cta_recomendado: string;
  riscos_de_perda: string[];
  produtos_recomendados: Array<{
    nome: string;
    motivo: string;
    preco_referencia: number | null;
    quantidade_sugerida: number;
    abordagem: string;
  }>;
  rascunho_orcamento?: {
    resumo: string;
    itens: Array<{
      nome: string;
      quantidade: number;
      preco_unitario: number | null;
      subtotal: number | null;
    }>;
    total_estimado: number | null;
    mensagem_pronta: string;
    observacoes: string[];
  };
};

type AssistenciaConversaoResultado = {
  conversa_id: number;
  cliente?: {
    id?: number;
    nome?: string;
    telefone?: string;
  };
  atendente?: {
    nome?: string | null;
  };
  crm?: {
    negocio_id?: number | null;
    crm_id?: number | null;
    crm_nome?: string | null;
    etapa_id?: number | null;
    etapa_nome?: string | null;
    etapa_fechamento?: boolean;
    produto_atual?: string | null;
  } | null;
  produtos_catalogo?: Array<{
    id: number;
    nome: string;
    descricao?: string | null;
    preco_base?: number | null;
  }>;
  assistencia?: AssistenciaConversaoIa;
};

type LiveQuoteItem = {
  key: string;
  productId: number | null;
  name: string;
  quantity: number;
  unitPrice: number;
};

type LiveQuoteCrmContext = {
  negocioId?: number | null;
  crmId?: number | null;
  crmNome?: string | null;
  etapaNome?: string | null;
  etapaFechamento?: boolean;
};

type LiveQuoteCatalogProduct = {
  id: number;
  nome: string;
  descricao?: string | null;
  preco_base?: number | null;
};

type LiveQuoteOpenPayload = {
  crm?: LiveQuoteCrmContext | null;
  catalogo?: LiveQuoteCatalogProduct[];
  products?: DealProduct[];
  notes?: string;
  headerMessage?: string;
  iaNotes?: string[];
};

const CONVERSATION_SEARCH_PAGE_SIZE = 20;
const FINALIZED_CONVERSATIONS_PAGE_SIZE = 20;
type FinishedDatePreset = "all" | "today" | "7d" | "30d" | "90d" | "custom";

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildFinishedDatePresetRange(preset: FinishedDatePreset) {
  if (preset === "all" || preset === "custom") {
    return { start: "", end: "" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = formatDateInputValue(today);
  const startDate = new Date(today);

  if (preset === "today") {
    return { start: end, end };
  }

  const daysToSubtract = preset === "7d" ? 6 : preset === "30d" ? 29 : 89;
  startDate.setDate(startDate.getDate() - daysToSubtract);

  return {
    start: formatDateInputValue(startDate),
    end,
  };
}

function isTemplateApproved(template: MetaTemplateItem) {
  return String(template.status || "").trim().toUpperCase() === "APPROVED";
}

function getTemplateDispatchHints(template: MetaTemplateItem): {
  headerType: string;
  headerRequiresMedia: boolean;
  headerParameterCount: number;
  bodyParameterCount: number;
  buttons: Array<{
    index: number;
    parameterCount: number;
    text: string;
    type: string;
  }>;
} {
  const components = template.components as
    | {
        header?: {
          type?: string;
          parameter_indexes?: unknown[];
        } | null;
        body?: {
          parameter_indexes?: unknown[];
        } | null;
        buttons?: Array<{
          index?: number | string;
          type?: string;
          text?: string;
          parameter_indexes?: unknown[];
        }> | null;
      }
    | undefined;

  if (!components || typeof components !== "object" || Array.isArray(components)) {
    return {
      headerType: "TEXT",
      headerRequiresMedia: false,
      headerParameterCount: 0,
      bodyParameterCount: 0,
      buttons: [],
    };
  }

  const headerType = String(components.header?.type || "TEXT").toUpperCase();

  return {
    headerType,
    headerRequiresMedia: ["IMAGE", "DOCUMENT", "VIDEO"].includes(headerType),
    headerParameterCount: Array.isArray(components.header?.parameter_indexes)
      ? components.header.parameter_indexes.length
      : 0,
    bodyParameterCount: Array.isArray(components.body?.parameter_indexes)
      ? components.body.parameter_indexes.length
      : 0,
    buttons: Array.isArray(components.buttons)
      ? components.buttons.map((button, index) => ({
          index: Number(button?.index ?? index + 1),
          parameterCount: Array.isArray(button?.parameter_indexes)
            ? button.parameter_indexes.length
            : 0,
          text: String(button?.text || ""),
          type: String(button?.type || "UNKNOWN").toUpperCase(),
        }))
      : [],
  };
}

type TemplateParameterKind = "manual" | "contact_field";
type TemplateParameterStandardField = "contact_name" | "birthday" | "email";
type TemplateParameterNameFormat = "first_name" | "full_name";

type TemplateParameterInput = {
  kind: TemplateParameterKind;
  text: string;
  standardField: TemplateParameterStandardField | "";
  nameFormat: TemplateParameterNameFormat;
};

const TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS: Array<{
  value: TemplateParameterStandardField;
  label: string;
}> = [
  { value: "contact_name", label: "Nome do cliente" },
  { value: "birthday", label: "Data de aniversario" },
  { value: "email", label: "Email" },
];

function createEmptyTemplateParameterInput(): TemplateParameterInput {
  return {
    kind: "manual",
    text: "",
    standardField: "",
    nameFormat: "full_name",
  };
}

function createTemplateParameterInputs(length: number): TemplateParameterInput[] {
  return Array.from({ length }, () => createEmptyTemplateParameterInput());
}

function mapTemplateParameterInputToPayload(input: TemplateParameterInput): unknown | null {
  if (input.kind === "contact_field") {
    if (!input.standardField) {
      return null;
    }

    return {
      type: "text",
      parameter_source: "contact_field",
      field: input.standardField,
      name_format: input.standardField === "contact_name" ? input.nameFormat : undefined,
    };
  }

  const normalizedText = input.text.trim();
  return normalizedText ? normalizedText : null;
}

export function ChatPage() {
  const metaWindowLockMessage =
    "A janela de 24h da Meta expirou. Reative a conversa com um template antes de enviar novas mensagens.";
  const templateReplyPendingMessage =
    "Aguarde o cliente responder ao template para continuar o atendimento.";
  const { user } = useAuth();
  const sessionPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const isAttendanceManager =
    Boolean(user?.is_master) || sessionPermissions.includes("chat.manager");
  const [apiConversations, setApiConversations] = useState<ApiConversation[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [isAssigningConversation, setIsAssigningConversation] = useState(false);
  const [assignmentUserId, setAssignmentUserId] = useState<string>("");
  const [queueCandidateUserId, setQueueCandidateUserId] = useState("");
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isTransferringConversation, setIsTransferringConversation] =
    useState(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isFinalizingConversation, setIsFinalizingConversation] = useState(false);
  const [isFinalizingStaleWaitingConversations, setIsFinalizingStaleWaitingConversations] =
    useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isIaModalOpen, setIsIaModalOpen] = useState(false);
  const [isAnalyzingIa, setIsAnalyzingIa] = useState(false);
  const [iaAnalysisResult, setIaAnalysisResult] =
    useState<AtendimentoIaResultado | null>(null);
  const [iaAnalysisError, setIaAnalysisError] = useState("");
  const [isAssistModalOpen, setIsAssistModalOpen] = useState(false);
  const [isLoadingAssistIa, setIsLoadingAssistIa] = useState(false);
  const [assistIaError, setAssistIaError] = useState("");
  const [assistIaResult, setAssistIaResult] =
    useState<AssistenciaConversaoResultado | null>(null);
  const [isLiveQuoteModalOpen, setIsLiveQuoteModalOpen] = useState(false);
  const [isSavingLiveQuoteToCrm, setIsSavingLiveQuoteToCrm] = useState(false);
  const [chatComposerPrefillText, setChatComposerPrefillText] = useState("");
  const [chatComposerPrefillToken, setChatComposerPrefillToken] = useState(0);
  const [liveQuoteItems, setLiveQuoteItems] = useState<LiveQuoteItem[]>([]);
  const [liveQuoteDiscount, setLiveQuoteDiscount] = useState(0);
  const [liveQuoteNotes, setLiveQuoteNotes] = useState("");
  const [liveQuoteHeaderMessage, setLiveQuoteHeaderMessage] = useState("");
  const [liveQuoteCatalogProducts, setLiveQuoteCatalogProducts] = useState<
    LiveQuoteCatalogProduct[]
  >([]);
  const [liveQuoteIaNotes, setLiveQuoteIaNotes] = useState<string[]>([]);
  const [liveQuoteCrmContext, setLiveQuoteCrmContext] =
    useState<LiveQuoteCrmContext | null>(null);
  const [galleryImages, setGalleryImages] = useState<ChatGalleryImage[]>([]);
  const [galleryDocuments, setGalleryDocuments] = useState<ChatGalleryDocument[]>([]);
  const [isProductGalleryOpen, setIsProductGalleryOpen] = useState(false);
  const [isDocumentGalleryOpen, setIsDocumentGalleryOpen] = useState(false);
  const [isLoadingGalleryImages, setIsLoadingGalleryImages] = useState(false);
  const [isLoadingGalleryDocuments, setIsLoadingGalleryDocuments] = useState(false);
  const [isSendingGalleryImages, setIsSendingGalleryImages] = useState(false);
  const [isSendingGalleryDocuments, setIsSendingGalleryDocuments] = useState(false);
  const [productImageSearch, setProductImageSearch] = useState("");
  const [productDocumentSearch, setProductDocumentSearch] = useState("");
  const [selectedGalleryImageKeys, setSelectedGalleryImageKeys] = useState<string[]>([]);
  const [selectedGalleryDocumentKeys, setSelectedGalleryDocumentKeys] = useState<string[]>([]);
  const [productImageCaption, setProductImageCaption] = useState("");
  const [productDocumentCaption, setProductDocumentCaption] = useState("");
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [selectedAttendantFilter, setSelectedAttendantFilter] = useState("");
  const [selectedMetaNumberFilter, setSelectedMetaNumberFilter] = useState("");
  const [finishedDatePreset, setFinishedDatePreset] =
    useState<FinishedDatePreset>("all");
  const [finishedDateStart, setFinishedDateStart] = useState("");
  const [finishedDateEnd, setFinishedDateEnd] = useState("");
  const [conversationSearchResults, setConversationSearchResults] = useState<
    ApiConversation[]
  >([]);
  const [selectedConversationSnapshot, setSelectedConversationSnapshot] =
    useState<ApiConversation | null>(null);
  const [isConversationSearchLoading, setIsConversationSearchLoading] =
    useState(false);
  const [isConversationSearchLoadingMore, setIsConversationSearchLoadingMore] =
    useState(false);
  const [conversationSearchHasMore, setConversationSearchHasMore] =
    useState(false);
  const [conversationSearchTotal, setConversationSearchTotal] = useState(0);
  const [finalizedCurrentPage, setFinalizedCurrentPage] = useState(1);
  const [finalizedTotalPages, setFinalizedTotalPages] = useState(1);
  const [finalizedTotalCount, setFinalizedTotalCount] = useState(0);
  const [isFinalizedConversationsPageLoading, setIsFinalizedConversationsPageLoading] =
    useState(false);
  const [atendimentoConfig, setAtendimentoConfig] = useState<AtendimentoConfig>({
    atendimento_lista_atribuida_adm: false,
    atendimento_mensagens_rapidas_ativas: true,
    atendimento_disparo_nps_ativo: true,
    atendimento_fila_automatica_ativa: false,
    atendimento_fila_usuarios: [],
  });
  const [settingsDraft, setSettingsDraft] = useState<AtendimentoConfig>({
    atendimento_lista_atribuida_adm: false,
    atendimento_mensagens_rapidas_ativas: true,
    atendimento_disparo_nps_ativo: true,
    atendimento_fila_automatica_ativa: false,
    atendimento_fila_usuarios: [],
  });
  const [transferUserId, setTransferUserId] = useState<string>("");
  const [isTemplateDispatchModalOpen, setIsTemplateDispatchModalOpen] =
    useState(false);
  const [availableMetaIntegrationNumbers, setAvailableMetaIntegrationNumbers] =
    useState<MetaIntegrationAccount[]>([]);
  const [loadingMetaIntegrationNumbers, setLoadingMetaIntegrationNumbers] =
    useState(false);
  const [selectedMetaIntegrationNumberId, setSelectedMetaIntegrationNumberId] =
    useState("");
  const [availableMetaTemplates, setAvailableMetaTemplates] = useState<
    MetaTemplateItem[]
  >([]);
  const [metaTemplateQuickSuggestions, setMetaTemplateQuickSuggestions] = useState<
    MetaTemplateQuickSuggestion[]
  >([]);
  const [loadingMetaTemplates, setLoadingMetaTemplates] = useState(false);
  const [loadingMetaTemplateQuickSuggestions, setLoadingMetaTemplateQuickSuggestions] =
    useState(false);
  const [dispatchingMetaTemplate, setDispatchingMetaTemplate] = useState(false);
  const [selectedMetaTemplateName, setSelectedMetaTemplateName] = useState("");
  const [metaTemplateLanguage, setMetaTemplateLanguage] = useState("pt_BR");
  const [metaTemplateHeaderParameters, setMetaTemplateHeaderParameters] =
    useState<TemplateParameterInput[]>([]);
  const [metaTemplateBodyParameters, setMetaTemplateBodyParameters] =
    useState<TemplateParameterInput[]>([]);
  const [metaTemplateButtonParameters, setMetaTemplateButtonParameters] =
    useState<Record<number, TemplateParameterInput[]>>({});
  const [metaTemplateHeaderFile, setMetaTemplateHeaderFile] =
    useState<File | null>(null);
  const [metaTemplateHeaderPreviewUrl, setMetaTemplateHeaderPreviewUrl] = useState("");
  const [metaTemplateDispatchError, setMetaTemplateDispatchError] =
    useState("");
  const [pendingFinalizeConversationId, setPendingFinalizeConversationId] =
    useState<number | null>(null);
  const [chatRefreshSignal, setChatRefreshSignal] = useState(0);
  const [conversationListRefreshSignal, setConversationListRefreshSignal] =
    useState(0);
  const [metaWindowClockTick, setMetaWindowClockTick] = useState(() =>
    Date.now()
  );
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const finalizedCurrentPageRef = useRef(1);
  const isFetchingConversationsRef = useRef(false);
  const pendingConversationsRefreshRef = useRef(false);
  const pendingConversationsOptionsRef = useRef<{
    finishedLimit?: number;
    finishedOffset?: number;
    finishedPage?: number;
    loadingMoreFinished?: boolean;
  } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const scheduledConversationRefreshRef = useRef<number | null>(null);
  const delayedConversationRefreshRef = useRef<number | null>(null);
  const selectedConversationRef = useRef<number | null>(null);
  const subscribedConversationRef = useRef<number | null>(null);
  const conversationSearchResultsRef = useRef<ApiConversation[]>([]);
  const selectedConversationSnapshotRef = useRef<ApiConversation | null>(null);
  const conversationSearchRequestIdRef = useRef(0);
  const conversationSearchOffsetRef = useRef(0);
  const conversationSearchParamsRef = useRef<ConversationSearchRequest | null>(
    null
  );

  const { contactId } = useParams<{ contactId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeConversationSnapshot = useMemo(() => {
    if (!location.state || typeof location.state !== "object") return null;

    const snapshot =
      "conversationSnapshot" in location.state
        ? (location.state as { conversationSnapshot?: unknown }).conversationSnapshot
        : null;

    return normalizeRouteConversationSnapshot(snapshot);
  }, [location.state]);
  const initialTabStatus = searchParams.get("status") as TabType | null;
  const [listTab, setListTab] = useState<TabType>(
    initialTabStatus || "active"
  );

  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(() => {
    return contactId ? parseInt(contactId, 10) : null;
  });

  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const [isDesktopDetailsOpen, setIsDesktopDetailsOpen] = useState(false);

  const buildGallerySelectionKey = (image: Pick<QuickMessageGalleryImage, "id" | "origem">) =>
    `${String(image.origem || "galeria")}:${Number(image.id)}`;

  const buildDocumentSelectionKey = (
    document: Pick<QuickMessageGalleryDocument, "id" | "origem">
  ) => `${String(document.origem || "galeria_documento")}:${Number(document.id)}`;

  const formatDate = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  };

  const formatConversationDateTime = (value?: string | null) => {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const parsed = new Date(raw.replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(parsed);
  };

  const parseAttendanceDateTime = useCallback((value?: string | null) => {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const normalizedRaw = raw.replace(" ", "T");
    if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalizedRaw)) {
      const parsed = new Date(normalizedRaw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const match = raw.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/,
    );

    if (match) {
      const [, yyyy, mm, dd, hh = "00", min = "00", ss = "00", ms = "0"] = match;
      const parsed = new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(min),
        Number(ss),
        Number(ms.padEnd(3, "0")),
      );
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const parseBackendBoolean = (value: unknown) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    const normalized = String(value ?? "").trim().toLowerCase();
    if (["true", "1", "sim", "yes"].includes(normalized)) return true;
    if (["false", "0", "nao", "não", "no"].includes(normalized)) return false;
    return null;
  };

  const calculateMetaWindowOpen = (conversation: ApiConversation) => {
    const backendWindowOpen = parseBackendBoolean(conversation.janela_meta_aberta);
    const expiresAt =
      parseAttendanceDateTime(conversation.janela_meta_expira_em) ||
      (() => {
        const lastCustomerMessageAt = parseAttendanceDateTime(
          conversation.ultima_mensagem_cliente_em,
        );
        if (!lastCustomerMessageAt) return null;
        return new Date(lastCustomerMessageAt.getTime() + 24 * 60 * 60 * 1000);
      })();

    if (backendWindowOpen === false) return false;
    if (backendWindowOpen === true && !expiresAt) return true;

    if (!expiresAt) return false;
    return expiresAt.getTime() > metaWindowClockTick;
  };

  const formatCurrencyCaption = (value: number) => `R$ ${Number(value || 0).toFixed(2)}`;

  const buildCommercialProductImageCaption = (
    image: ChatGalleryImage,
    extraCaption = ""
  ) => {
    const trimmedExtraCaption = String(extraCaption || "").trim();
    const isCommercialProductImage = String(image.origem || "") === "produto_comercial";

    if (!isCommercialProductImage) {
      return trimmedExtraCaption;
    }

    const normalizedDescription = String(image.produto_descricao || "").trim();
    const hasBasePrice =
      image.produto_preco_base !== null &&
      image.produto_preco_base !== undefined &&
      Number.isFinite(Number(image.produto_preco_base));

    const automaticLines = [
      normalizedDescription,
      hasBasePrice
        ? `Preco base: ${formatCurrencyCaption(Number(image.produto_preco_base))}`
        : "",
    ].filter(Boolean);

    const automaticCaption = automaticLines.join("\n");
    if (!trimmedExtraCaption) {
      return automaticCaption;
    }

    return automaticCaption
      ? `${automaticCaption}\n\n${trimmedExtraCaption}`
      : trimmedExtraCaption;
  };

  useEffect(() => {
    const nextConversationId = contactId ? parseInt(contactId, 10) : null;
    setSelectedConversationId(nextConversationId);

    if (
      nextConversationId &&
      routeConversationSnapshot &&
      Number(routeConversationSnapshot.id) === Number(nextConversationId)
    ) {
      setSelectedConversationSnapshot((current) => {
        if (Number(current?.id || 0) !== Number(routeConversationSnapshot.id)) {
          return routeConversationSnapshot;
        }

        return {
          ...routeConversationSnapshot,
          ...current,
        };
      });
      return;
    }

    if (!nextConversationId) {
      setSelectedConversationSnapshot(null);
    }
  }, [contactId, routeConversationSnapshot]);

  useEffect(() => {
    const templateDispatchNotice =
      location.state &&
      typeof location.state === "object" &&
      "templateDispatchNotice" in location.state
        ? String(location.state.templateDispatchNotice || "").trim()
        : "";

    if (!templateDispatchNotice) return;

    alert(templateDispatchNotice);
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    conversationSearchResultsRef.current = conversationSearchResults;
  }, [conversationSearchResults]);

  useEffect(() => {
    selectedConversationSnapshotRef.current = selectedConversationSnapshot;
  }, [selectedConversationSnapshot]);

  useEffect(() => {
    if (initialTabStatus) setListTab(initialTabStatus);
  }, [initialTabStatus]);

  const loadAtendimentoConfig = useCallback(async () => {
    if (!user?.empresa_id || !user?.id) return null;

    const encrypted = await encrypt({
      empresa_id: user.empresa_id,
      usuario_id: user.id,
    });
    const response = await fetch(`${API_BASE}/atendimento/configuracoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: encrypted }),
    });
    const respData = await response.json();
    const resp = (await decrypt(respData.payload)) as {
      boleano: boolean;
      obj?: Partial<AtendimentoConfig>;
      mensagem?: string;
      msg?: string;
    };

    if (!resp?.boleano) {
      throw new Error(
        resp?.mensagem || resp?.msg || "Falha ao carregar configuracoes."
      );
    }

    return {
      atendimento_lista_atribuida_adm: Boolean(
        resp.obj?.atendimento_lista_atribuida_adm
      ),
      atendimento_mensagens_rapidas_ativas:
        resp.obj?.atendimento_mensagens_rapidas_ativas === undefined
          ? true
          : Boolean(resp.obj?.atendimento_mensagens_rapidas_ativas),
      atendimento_disparo_nps_ativo:
        resp.obj?.atendimento_disparo_nps_ativo === undefined
          ? true
          : Boolean(resp.obj?.atendimento_disparo_nps_ativo),
      atendimento_fila_automatica_ativa: Boolean(
        resp.obj?.atendimento_fila_automatica_ativa
      ),
      atendimento_fila_usuarios: Array.isArray(resp.obj?.atendimento_fila_usuarios)
        ? [...new Set(
            resp.obj.atendimento_fila_usuarios
              .map((value) => Number(value || 0))
              .filter((value) => Number.isInteger(value) && value > 0)
          )]
        : [],
    } satisfies AtendimentoConfig;
  }, [user?.empresa_id, user?.id]);

  const fetchAssignableUsers = useCallback(async () => {
    if (!user?.empresa_id) {
      setAssignableUsers([]);
      return;
    }

    const encrypted = await encrypt({ empresa_id: user.empresa_id });
    const response = await fetch(`${API_BASE}/user/lista_usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: encrypted }),
    });
    const respData = await response.json();
    const resp = (await decrypt(respData.payload)) as {
      boleano: boolean;
      obj?: AssignableUser[];
      mensagem?: string;
      msg?: string;
    };

    if (!resp?.boleano) {
      throw new Error(resp?.mensagem || resp?.msg || "Falha ao carregar usuarios.");
    }

    setAssignableUsers(
      Array.isArray(resp.obj)
        ? [...resp.obj].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        : []
    );
  }, [user?.empresa_id]);

  const loadGalleryImages = useCallback(async () => {
    if (!user?.empresa_id) {
      setGalleryImages([]);
      return;
    }

    setIsLoadingGalleryImages(true);
    try {
      const encrypted = await encrypt({ empresa_id: user.empresa_id });
      const response = await fetch(`${API_BASE}/user/galeria_empresa_imagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano?: boolean;
        obj?: QuickMessageGalleryImage[];
        mensagem?: string;
        msg?: string;
      };

      if (!resp?.boleano) {
        throw new Error(resp?.mensagem || resp?.msg || "Falha ao carregar a galeria.");
      }

      const nextImages = Array.isArray(resp.obj)
        ? resp.obj
            .filter((image) => Boolean(String(image.url || "").trim()))
            .map((image) => ({
              ...image,
              selectionKey: buildGallerySelectionKey(image),
            }))
        : [];
      setGalleryImages(nextImages);
    } finally {
      setIsLoadingGalleryImages(false);
    }
  }, [user?.empresa_id]);

  const loadGalleryDocuments = useCallback(async () => {
    if (!user?.empresa_id) {
      setGalleryDocuments([]);
      return;
    }

    setIsLoadingGalleryDocuments(true);
    try {
      const encrypted = await encrypt({ empresa_id: user.empresa_id });
      const response = await fetch(`${API_BASE}/user/galeria_empresa_documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano?: boolean;
        obj?: QuickMessageGalleryDocument[];
        mensagem?: string;
        msg?: string;
      };

      if (!resp?.boleano) {
        throw new Error(resp?.mensagem || resp?.msg || "Falha ao carregar a galeria de documentos.");
      }

      const nextDocuments = Array.isArray(resp.obj)
        ? resp.obj
            .filter((document) => Boolean(String(document.url || "").trim()))
            .map((document) => ({
              ...document,
              selectionKey: buildDocumentSelectionKey(document),
            }))
        : [];
      setGalleryDocuments(nextDocuments);
    } finally {
      setIsLoadingGalleryDocuments(false);
    }
  }, [user?.empresa_id]);

  const loadConversationsFromApi = useCallback(
    async (options?: {
      finishedLimit?: number;
      finishedOffset?: number;
    }): Promise<ConversationsListResponse> => {
      if (!user?.empresa_id) {
        return {
          items: [],
          finishedPagination: {
            limit: FINALIZED_CONVERSATIONS_PAGE_SIZE,
            offset: 0,
            loaded: 0,
            total: 0,
            hasMore: false,
          },
        };
      }

      const requestedFinishedLimit = Math.min(
        Math.max(
          Number(options?.finishedLimit || FINALIZED_CONVERSATIONS_PAGE_SIZE) ||
            FINALIZED_CONVERSATIONS_PAGE_SIZE,
          1,
        ),
        200,
      );
      const requestedFinishedOffset = Math.max(Number(
        options?.finishedOffset ??
          Math.max(0, (finalizedCurrentPageRef.current - 1) * FINALIZED_CONVERSATIONS_PAGE_SIZE)
      ) || 0, 0);

      const payload: Record<string, unknown> = {
        empresa_id: user.empresa_id,
        finished_limit: requestedFinishedLimit,
      };

      if (requestedFinishedOffset > 0) {
        payload.finished_offset = requestedFinishedOffset;
      }

      if (finishedDateStart) {
        payload.finished_date_start = finishedDateStart;
      }

      if (finishedDateEnd) {
        payload.finished_date_end = finishedDateEnd;
      }

      if (user.id) {
        payload.usuario_id = user.id;
      }

      if (isAttendanceManager) {
        payload.is_master = true;
        payload.visualizar_todos_atendentes = true;
        payload.visualizar_todas_conversas = true;
      }

      const encrypted = await encrypt(payload);
      const response = await fetch(
        `${API_BASE}/atendimento/carregar_conversas_usuario`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }
      );

      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj?:
          | ApiConversation[]
          | {
              items?: ApiConversation[];
              finished_pagination?: {
                limit?: number;
                offset?: number;
                loaded?: number;
                total?: number;
                has_more?: boolean;
              };
            };
        mensagem?: string;
        msg?: string;
      };

      if (!resp?.boleano) {
        throw new Error(
          resp?.mensagem || resp?.msg || "Falha ao carregar conversas."
        );
      }

      if (Array.isArray(resp.obj)) {
        return {
          items: resp.obj,
          finishedPagination: {
            limit: requestedFinishedLimit,
            offset: requestedFinishedOffset,
            loaded: resp.obj.filter((conversation) => conversation.status === "finished").length,
            total: resp.obj.filter((conversation) => conversation.status === "finished").length,
            hasMore: false,
          },
        };
      }

      return {
        items: Array.isArray(resp.obj?.items) ? resp.obj.items : [],
        finishedPagination: {
          limit: Number(resp.obj?.finished_pagination?.limit || requestedFinishedLimit),
          offset: Number(resp.obj?.finished_pagination?.offset || requestedFinishedOffset || 0),
          loaded: Number(resp.obj?.finished_pagination?.loaded || 0),
          total: Number(resp.obj?.finished_pagination?.total || 0),
          hasMore: Boolean(resp.obj?.finished_pagination?.has_more),
        },
      };
    },
    [
      finishedDateEnd,
      finishedDateStart,
      isAttendanceManager,
      user?.empresa_id,
      user?.id,
    ]
  );

  const searchConversationsFromApi = useCallback(
    async (
      request: ConversationSearchRequest & {
        offset?: number;
      }
    ) => {
      if (!user?.empresa_id || !user?.id) {
        return {
          items: [] as ApiConversation[],
          hasMore: false,
          nextOffset: 0,
          total: 0,
        };
      }

      const encrypted = await encrypt({
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        pesquisa: request.term,
        status: request.status,
        show_unread_only: request.showUnreadOnly,
        selected_attendant_filter: selectedAttendantFilter,
        selected_meta_number_filter: selectedMetaNumberFilter,
        offset: request.offset || 0,
        limit: CONVERSATION_SEARCH_PAGE_SIZE,
      });
      const response = await fetch(
        `${API_BASE}/atendimento/buscar_conversas_usuario`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }
      );

      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj?: {
          items?: ApiConversation[];
          has_more?: boolean;
          next_offset?: number;
          total?: number;
        };
        mensagem?: string;
        msg?: string;
      };

      if (!resp?.boleano) {
        throw new Error(
          resp?.mensagem || resp?.msg || "Falha ao pesquisar conversas."
        );
      }

      return {
        items: Array.isArray(resp.obj?.items) ? resp.obj.items : [],
        hasMore: Boolean(resp.obj?.has_more),
        nextOffset: Number(resp.obj?.next_offset || 0),
        total: Number(resp.obj?.total || 0),
      };
    },
    [
      selectedAttendantFilter,
      selectedMetaNumberFilter,
      user?.empresa_id,
      user?.id,
    ]
  );

  const fetchConversations = useCallback(async (options?: FinishedConversationsFetchOptions) => {
    if (isFetchingConversationsRef.current) {
      pendingConversationsRefreshRef.current = true;
      if (
        options?.loadingMoreFinished ||
        Number.isFinite(Number(options?.finishedLimit)) ||
        Number.isFinite(Number(options?.finishedOffset)) ||
        Number.isFinite(Number(options?.finishedPage))
      ) {
        pendingConversationsOptionsRef.current = options || null;
      }
      return;
    }

    try {
      isFetchingConversationsRef.current = true;
      if (!user?.id || !user?.empresa_id) {
        setApiConversations([]);
        setFinalizedTotalCount(0);
        setFinalizedTotalPages(1);
        setIsFinalizedConversationsPageLoading(false);
        return;
      }

      const requestedFinishedPage = Math.max(
        Number(options?.finishedPage || finalizedCurrentPageRef.current) || 1,
        1
      );
      const requestedFinishedLimit = Math.min(
        Math.max(
          Number(options?.finishedLimit || FINALIZED_CONVERSATIONS_PAGE_SIZE) ||
            FINALIZED_CONVERSATIONS_PAGE_SIZE,
          1,
        ),
        200,
      );
      const requestedFinishedOffset = Math.max(
        Number(
          options?.finishedOffset ?? (requestedFinishedPage - 1) * requestedFinishedLimit
        ) || 0,
        0
      );
      const response = await loadConversationsFromApi({
        finishedLimit: requestedFinishedLimit,
        finishedOffset: requestedFinishedOffset,
      });
      const conversations = Array.isArray(response.items) ? response.items : [];
      setApiConversations(conversations);
      finalizedCurrentPageRef.current = requestedFinishedPage;
      setFinalizedCurrentPage(requestedFinishedPage);
      setFinalizedTotalCount(Math.max(0, Number(response.finishedPagination.total || 0)));
      setFinalizedTotalPages(
        Math.max(
          1,
          Math.ceil(
            Math.max(0, Number(response.finishedPagination.total || 0)) /
              FINALIZED_CONVERSATIONS_PAGE_SIZE
          )
        )
      );
      const selectedConversationStillVisibleInSearch = Boolean(
        selectedConversationRef.current &&
          conversationSearchResultsRef.current.some(
            (conversation) => conversation.id === selectedConversationRef.current
          )
      );
      const selectedConversationStillCached =
        Number(selectedConversationSnapshotRef.current?.id || 0) ===
        Number(selectedConversationRef.current || 0);

      if (
        selectedConversationRef.current &&
        !conversations.some((conversation) => conversation.id === selectedConversationRef.current) &&
        !selectedConversationStillVisibleInSearch &&
        !selectedConversationStillCached
      ) {
        setSelectedConversationId(null);
      }
    } catch (err) {
      console.error("Erro ao carregar conversas:", err);
    } finally {
      isFetchingConversationsRef.current = false;
      if (options?.loadingMoreFinished) {
        setIsFinalizedConversationsPageLoading(false);
      }
      setLoading(false);
      if (pendingConversationsRefreshRef.current) {
        const pendingOptions = pendingConversationsOptionsRef.current;
        pendingConversationsRefreshRef.current = false;
        pendingConversationsOptionsRef.current = null;
        void fetchConversations(pendingOptions || undefined);
      }
    }
  }, [
    loadConversationsFromApi,
    user?.empresa_id,
    user?.id,
  ]);

  const handleFinishedPageChange = useCallback(async (page: number) => {
    const normalizedPage = Math.max(1, Math.floor(Number(page) || 1));
    if (
      isFinalizedConversationsPageLoading ||
      normalizedPage === finalizedCurrentPageRef.current
    ) {
      return;
    }

    setIsFinalizedConversationsPageLoading(true);
    try {
      await fetchConversations({
        finishedPage: normalizedPage,
        finishedOffset:
          (normalizedPage - 1) * FINALIZED_CONVERSATIONS_PAGE_SIZE,
        finishedLimit: FINALIZED_CONVERSATIONS_PAGE_SIZE,
        loadingMoreFinished: true,
      });
    } catch (error) {
      console.error("Erro ao alterar a pagina das conversas finalizadas:", error);
      setIsFinalizedConversationsPageLoading(false);
    }
  }, [
    fetchConversations,
    isFinalizedConversationsPageLoading,
  ]);

  const handleFinishedDatePresetChange = useCallback((value: string) => {
    const normalizedPreset = ([
      "all",
      "today",
      "7d",
      "30d",
      "90d",
      "custom",
    ] as const).includes(value as FinishedDatePreset)
      ? (value as FinishedDatePreset)
      : "all";

    setIsFinalizedConversationsPageLoading(false);
    finalizedCurrentPageRef.current = 1;
    setFinalizedCurrentPage(1);
    setFinalizedTotalPages(1);
    setFinalizedTotalCount(0);
    setFinishedDatePreset(normalizedPreset);

    if (normalizedPreset === "custom") {
      return;
    }

    const range = buildFinishedDatePresetRange(normalizedPreset);
    setFinishedDateStart(range.start);
    setFinishedDateEnd(range.end);
  }, []);

  const handleFinishedDateStartChange = useCallback((value: string) => {
    setIsFinalizedConversationsPageLoading(false);
    finalizedCurrentPageRef.current = 1;
    setFinalizedCurrentPage(1);
    setFinalizedTotalPages(1);
    setFinalizedTotalCount(0);
    setFinishedDatePreset("custom");
    setFinishedDateStart(value);
  }, []);

  const handleFinishedDateEndChange = useCallback((value: string) => {
    setIsFinalizedConversationsPageLoading(false);
    finalizedCurrentPageRef.current = 1;
    setFinalizedCurrentPage(1);
    setFinalizedTotalPages(1);
    setFinalizedTotalCount(0);
    setFinishedDatePreset("custom");
    setFinishedDateEnd(value);
  }, []);

  const clearConversationSearchState = useCallback(() => {
    conversationSearchRequestIdRef.current += 1;
    conversationSearchOffsetRef.current = 0;
    conversationSearchParamsRef.current = null;
    setConversationSearchResults([]);
    setConversationSearchHasMore(false);
    setConversationSearchTotal(0);
    setIsConversationSearchLoading(false);
    setIsConversationSearchLoadingMore(false);
  }, []);

  const handleConversationSearchRequest = useCallback(
    async (request: ConversationSearchRequest) => {
      const normalizedTerm = String(request.term || "").trim();
      if (!normalizedTerm) {
        clearConversationSearchState();
        return;
      }

      const normalizedRequest = {
        ...request,
        term: normalizedTerm,
      };
      const requestId = conversationSearchRequestIdRef.current + 1;
      conversationSearchRequestIdRef.current = requestId;
      conversationSearchOffsetRef.current = 0;
      conversationSearchParamsRef.current = normalizedRequest;
      setConversationSearchTotal(0);
      setIsConversationSearchLoading(true);
      setIsConversationSearchLoadingMore(false);

      try {
        const result = await searchConversationsFromApi({
          ...normalizedRequest,
          offset: 0,
        });
        if (conversationSearchRequestIdRef.current !== requestId) return;

        setConversationSearchResults(result.items);
        setConversationSearchHasMore(result.hasMore);
        setConversationSearchTotal(result.total);
        conversationSearchOffsetRef.current = result.nextOffset;
      } catch (error) {
        if (conversationSearchRequestIdRef.current !== requestId) return;
        console.error("Erro ao pesquisar conversas:", error);
        setConversationSearchResults([]);
        setConversationSearchHasMore(false);
        setConversationSearchTotal(0);
      } finally {
        if (conversationSearchRequestIdRef.current === requestId) {
          setIsConversationSearchLoading(false);
        }
      }
    },
    [clearConversationSearchState, searchConversationsFromApi]
  );

  const handleConversationSearchLoadMore = useCallback(async () => {
    const currentRequest = conversationSearchParamsRef.current;
    if (
      !currentRequest ||
      !conversationSearchHasMore ||
      isConversationSearchLoading ||
      isConversationSearchLoadingMore
    ) {
      return;
    }

    const requestId = conversationSearchRequestIdRef.current;
    setIsConversationSearchLoadingMore(true);

    try {
      const result = await searchConversationsFromApi({
        ...currentRequest,
        offset: conversationSearchOffsetRef.current,
      });
      if (conversationSearchRequestIdRef.current !== requestId) return;

      setConversationSearchResults((current) => [...current, ...result.items]);
      setConversationSearchHasMore(result.hasMore);
      setConversationSearchTotal(result.total);
      conversationSearchOffsetRef.current = result.nextOffset;
    } catch (error) {
      if (conversationSearchRequestIdRef.current !== requestId) return;
      console.error("Erro ao carregar mais conversas da busca:", error);
    } finally {
      if (conversationSearchRequestIdRef.current === requestId) {
        setIsConversationSearchLoadingMore(false);
      }
    }
  }, [
    conversationSearchHasMore,
    isConversationSearchLoading,
    isConversationSearchLoadingMore,
    searchConversationsFromApi,
  ]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  const scheduleConversationRefresh = useCallback(() => {
    if (scheduledConversationRefreshRef.current !== null) return;
    scheduledConversationRefreshRef.current = window.setTimeout(() => {
      scheduledConversationRefreshRef.current = null;
      void fetchConversations();
    }, 250);
  }, [fetchConversations]);

  const scheduleConversationResync = useCallback(() => {
    scheduleConversationRefresh();
    if (delayedConversationRefreshRef.current !== null) {
      window.clearTimeout(delayedConversationRefreshRef.current);
    }
    delayedConversationRefreshRef.current = window.setTimeout(() => {
      delayedConversationRefreshRef.current = null;
      void fetchConversations();
    }, 1500);
  }, [fetchConversations, scheduleConversationRefresh]);

  useEffect(() => {
    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        void fetchConversations();
      }
    };

    window.addEventListener("focus", handleVisibilityRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    return () => {
      window.removeEventListener("focus", handleVisibilityRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [fetchConversations]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchConversations();
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [fetchConversations]);

  useEffect(() => {
    if (!user?.empresa_id || !user?.id) return;

    loadAtendimentoConfig()
      .then((config) => {
        if (!config) return;
        setAtendimentoConfig(config);
        setSettingsDraft(config);
      })
      .catch((error) => {
        console.error("Erro ao carregar configurações de atendimento:", error);
      });
  }, [loadAtendimentoConfig, user?.empresa_id, user?.id]);

  useEffect(() => {
    fetchAssignableUsers().catch((error) => {
      console.error("Erro ao carregar usuários para atribuição:", error);
    });
  }, [fetchAssignableUsers]);

  useEffect(() => {
    if (!user?.empresa_id) return;

    const socket =
      socketRef.current ||
      io(API_BASE, {
        auth: { token: getServerSessionToken() },
        transports: ["websocket", "polling"],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
    socketRef.current = socket;

    const handleConnect = () => {
      setIsSocketConnected(true);
      if (import.meta.env.DEV) {
        console.log("[socket] connect", socket.id);
      }
      socket.emit("join_empresa", { empresa_id: user.empresa_id });
      if (selectedConversationRef.current) {
        socket.emit("join_conversa", {
          conversa_id: selectedConversationRef.current,
        });
        subscribedConversationRef.current = selectedConversationRef.current;
      }
      scheduleConversationResync();
    };

    const handleChatUpdate = (payload: any) => {
      if (import.meta.env.DEV) {
        const emittedAtMs = payload?.emitted_at ? new Date(payload.emitted_at).getTime() : NaN;
        const lagMs = Number.isFinite(emittedAtMs) ? Date.now() - emittedAtMs : null;
        console.debug("[chat:update] recebido", {
          event_id: payload?.event_id || null,
          tipo: payload?.tipo || null,
          origem: payload?.origem || null,
          conversa_id: payload?.conversa_id || null,
          empresa_id: payload?.empresa_id || null,
          emitted_at: payload?.emitted_at || null,
          lag_ms: lagMs,
        });
      }
      setConversationListRefreshSignal((prev) => prev + 1);
      scheduleConversationResync();
      if (selectedConversationRef.current) {
        setChatRefreshSignal((prev) => prev + 1);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("chat:update", handleChatUpdate);
    const handleConnectError = (error: any) => {
      setIsSocketConnected(false);
      if (import.meta.env.DEV) {
        console.error("[socket] connect_error", error?.message || error);
      }
    };
    const handleDisconnect = (reason: any) => {
      setIsSocketConnected(false);
      if (import.meta.env.DEV) {
        console.warn("[socket] disconnect", reason);
      }
    };
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      if (subscribedConversationRef.current) {
        socket.emit("leave_conversa", {
          conversa_id: subscribedConversationRef.current,
        });
      }
      socket.emit("leave_empresa", { empresa_id: user.empresa_id });
      socket.off("connect", handleConnect);
      socket.off("chat:update", handleChatUpdate);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      setIsSocketConnected(false);
      if (scheduledConversationRefreshRef.current !== null) {
        window.clearTimeout(scheduledConversationRefreshRef.current);
        scheduledConversationRefreshRef.current = null;
      }
      if (delayedConversationRefreshRef.current !== null) {
        window.clearTimeout(delayedConversationRefreshRef.current);
        delayedConversationRefreshRef.current = null;
      }
      subscribedConversationRef.current = null;
    };
  }, [scheduleConversationResync, user?.empresa_id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const previous = subscribedConversationRef.current;
    if (previous && previous !== selectedConversationId) {
      socket.emit("leave_conversa", { conversa_id: previous });
    }

    if (
      selectedConversationId &&
      selectedConversationId > 0 &&
      selectedConversationId !== previous
    ) {
      socket.emit("join_conversa", { conversa_id: selectedConversationId });
      subscribedConversationRef.current = selectedConversationId;
      return;
    }

    subscribedConversationRef.current = selectedConversationId || null;
  }, [selectedConversationId]);

  const isMobile = useMediaQuery("(max-width: 768px)");
  const chatAttendantFilterOptions = useMemo(
    () =>
      [...assignableUsers].sort((left, right) =>
        String(left.name || "").localeCompare(String(right.name || ""), "pt-BR", {
          sensitivity: "base",
        })
      ),
    [assignableUsers]
  );
  const chatMetaNumberFilterOptions = useMemo<MetaNumberFilterOption[]>(
    () =>
      Array.from(
        new Map(
          apiConversations
            .map((conversation) => {
              const value = String(conversation.meta_numero_conta || "").trim();
              if (!value) return null;
              const accountName = String(conversation.meta_nome_conta || "").trim();
              return [
                value,
                {
                  value,
                  label: accountName ? `${value} - ${accountName}` : value,
                },
              ] as const;
            })
            .filter((item): item is readonly [string, MetaNumberFilterOption] => Boolean(item))
        ).values()
      ).sort((left, right) =>
        left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base" })
      ),
    [apiConversations]
  );

  const handleSelectConversation = (id: number, conversation?: ApiConversation) => {
    setChatComposerPrefillText("");
    if (conversation && Number(conversation.id) === Number(id)) {
      setSelectedConversationSnapshot(conversation);
    }
    setSelectedConversationId(id);
  };
  const handleBackToList = useCallback(() => {
    setChatComposerPrefillText("");
    setSelectedConversationId(null);
    setIsDetailsSheetOpen(false);
    setIsDesktopDetailsOpen(false);
    if (contactId) {
      navigate(`/chat${location.search}`, { replace: true });
    }
  }, [contactId, location.search, navigate]);

  const handleOpenClientDetails = useCallback(() => {
    if (isMobile) {
      setIsDetailsSheetOpen(true);
      return;
    }

    setIsDesktopDetailsOpen(true);
  }, [isMobile]);

  const handleToggleClientDetails = useCallback(() => {
    if (isMobile) {
      setIsDetailsSheetOpen((current) => !current);
      return;
    }

    setIsDesktopDetailsOpen((current) => !current);
  }, [isMobile]);

  useEffect(() => {
    if (!selectedConversationId) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTyping =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        Boolean(target?.isContentEditable);

      if (isTyping) return;

      event.preventDefault();
      handleBackToList();
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [handleBackToList, selectedConversationId]);

  useEffect(() => {
    setIsDetailsSheetOpen(false);
    setIsDesktopDetailsOpen(false);
  }, [selectedConversationId]);

  const handleClientUpdatedFromChat = useCallback(
    (contactData: Partial<Conversation>) => {
      const clienteId = Number(contactData.cliente_id || contactData.id || 0);
      if (!clienteId) return;

      setApiConversations((current) =>
        current.map((conversation) =>
          Number(conversation.cliente_id) === clienteId
            ? {
                ...conversation,
                nome: String(contactData.name || conversation.nome),
              }
            : conversation
        )
      );
    },
    []
  );
  const toggleDetailsSheet = () => {
    setIsDetailsSheetOpen((prev) => !prev);
  };

  const closeConversationSupportOverlays = useCallback(() => {
    if (isMobile) {
      setIsDetailsSheetOpen(false);
    }
  }, [isMobile]);

  const sendMessageToConversation = useCallback(
    async (conversationId: number, text: string): Promise<boolean> => {
      if (!user?.empresa_id) return false;
      const mensagem = String(text || "").trim();
      if (!mensagem) return false;

      try {
        const nome = user?.name ?? "Usuario";
        const cargo = (user as any).cargo;

        const encrypted = await encrypt({
          conversa_id: conversationId,
          empresa_id: user.empresa_id,
          usuario_id: user.id,
          mensagem,
          nome,
          cargo,
        });

        const response = await fetch(`${API_BASE}/atendimento/enviar_mensagem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });

        const respData = await response.json();
        const resp = (await decrypt(respData.payload)) as {
          boleano: boolean;
          mensagem?: string;
        };

        if (!resp?.boleano) {
          throw new Error(resp?.mensagem || "Falha ao enviar mensagem.");
        }

        await fetchConversations();
        return true;
      } catch (error) {
        console.error("Erro ao enviar mensagem (atalho IA):", error);
        return false;
      }
    },
    [fetchConversations, user],
  );

  const handleSendMessage = (conversationId: number, text: string) => {
    void sendMessageToConversation(conversationId, text);
  };

  const handleSaveNote = async (clienteId: number, noteContent: string) => {
    if (!user || noteContent.trim() === "" || noteContent === "<p></p>") {
      alert("Nao foi possivel salvar a nota.");
      return;
    }

    const newNote: Note = {
      content: noteContent,
      author: user.name,
      createdAt: formatDate(new Date()),
      user_id: user.id,
    };

    console.log("Dados enviados para a API:", {
      cliente_id: clienteId,
      note_content: newNote,
    });

    try {
      const encrypted = await encrypt({
        cliente_id: clienteId,
        note_content: newNote,
      });
      const response = await fetch(`${API_BASE}/user/salvar_nota`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        note?: Note;
        msg?: string;
      };

      if (resp?.boleano) {
        alert("Nota salva com sucesso!");
      } else {
        throw new Error(resp?.msg || "Erro ao salvar nota no servidor.");
      }
    } catch (err: any) {
      console.error("Erro ao salvar nota:", err);
      alert(`Nao foi possivel salvar a nota: ${err.message}`);
    }
  };

  const handleAddTag = (conversationId: number, tagToAdd: Tag) => {
    setApiConversations((prevConvs) =>
      prevConvs.map((conv) => {
        if (conv.id === conversationId) {
          const currentTags = conv.tags || [];
          if (currentTags.some((t: Tag) => t.id === tagToAdd.id)) {
            return conv;
          }
          return { ...conv, tags: [...currentTags, tagToAdd] };
        }
        return conv;
      })
    );
  };

  const handleRemoveTag = (conversationId: number, tagIdToRemove: number) => {
    setApiConversations((prevConvs) =>
      prevConvs.map((conv) => {
        if (conv.id === conversationId) {
          const currentTags = conv.tags || [];
          return {
            ...conv,
            tags: currentTags.filter((tag: Tag) => tag.id !== tagIdToRemove),
          };
        }
        return conv;
      })
    );
  };

  const handleFinalizeChat = (conversationId: number) => {
    setPendingFinalizeConversationId(conversationId);
    setIsFinalizeModalOpen(true);
  };

  const handleFinalizeWaitingConversation = async (conversationId: number) => {
    if (!user) return;

    const confirmed = window.confirm(
      "Finalizar atendimento da fila sem enviar mensagem ao cliente?"
    );
    if (!confirmed) return;

    setIsFinalizingConversation(true);
    setPendingFinalizeConversationId(conversationId);
    try {
      const encrypted = await encrypt({
        conversa_id: conversationId,
        empresa_id: user.empresa_id,
        usuario_id: user.id,
      });
      const response = await fetch(
        `${API_BASE}/atendimento/finalizar_atendimento_fila`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }
      );
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        msg?: string;
        mensagem?: string;
      };
      if (resp?.boleano) {
        alert("Atendimento da fila finalizado com sucesso!");
        setIsFinalizeModalOpen(false);
        setPendingFinalizeConversationId(null);
        setSelectedConversationId(null);
        await fetchConversations();
      } else {
        throw new Error(
          resp?.mensagem || resp?.msg || "Falha ao finalizar atendimento da fila."
        );
      }
    } catch (err: any) {
      console.error("Erro ao finalizar atendimento da fila:", err);
      alert(`Nao foi possivel finalizar o atendimento: ${err.message}`);
    } finally {
      setIsFinalizingConversation(false);
      setPendingFinalizeConversationId(null);
      setIsFinalizeModalOpen(false);
    }
  };

  const handleFinalizeStaleWaitingConversations = async () => {
    if (!user?.empresa_id || !user?.id || !isAttendanceManager) return;

    const confirmed = window.confirm(
      "Finalizar todos os leads com mais de 48 horas na fila de aguardando atendimento?"
    );
    if (!confirmed) return;

    try {
      setIsFinalizingStaleWaitingConversations(true);
      const encrypted = await encrypt({
        empresa_id: user.empresa_id,
        usuario_id: user.id,
      });
      const response = await fetch(
        `${API_BASE}/atendimento/finalizar_atendimentos_fila_expirados`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }
      );
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano?: boolean;
        obj?: {
          total_finalizados?: number;
        };
        mensagem?: string;
        msg?: string;
      };

      if (!resp?.boleano) {
        throw new Error(
          resp?.mensagem || resp?.msg || "Falha ao finalizar leads expirados da fila."
        );
      }

      alert(
        resp?.mensagem ||
          `${Number(resp?.obj?.total_finalizados || 0)} atendimento(s) finalizado(s).`
      );
      setSelectedConversationId(null);
      await fetchConversations();
    } catch (err) {
      console.error("Erro ao finalizar leads expirados da fila:", err);
      alert(
        `Nao foi possivel finalizar os leads expirados: ${err instanceof Error ? err.message : "erro desconhecido"}`
      );
    } finally {
      setIsFinalizingStaleWaitingConversations(false);
    }
  };

  const handleConfirmFinalizeChat = async () => {
    if (!user) return;
    if (!pendingFinalizeConversationId) {
      return;
    }

    setIsFinalizingConversation(true);
    try {
      const encrypted = await encrypt({
        conversa_id: pendingFinalizeConversationId,
        empresa_id: user.empresa_id,
        usuario_id: user.id,
      });
      const response = await fetch(
        `${API_BASE}/atendimento/finalizar_atendimento`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }
      );
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        msg?: string;
        mensagem?: string;
      };
      if (resp?.boleano) {
        alert(
          isPendingFinalizeWaitingConversation
            ? "Atendimento da fila finalizado com sucesso!"
            : "Atendimento finalizado com sucesso!"
        );
        setIsFinalizeModalOpen(false);
        setPendingFinalizeConversationId(null);
        setSelectedConversationId(null);
        await fetchConversations();
      } else {
        throw new Error(
          resp?.mensagem || resp?.msg || "Falha ao finalizar atendimento no servidor."
        );
      }
    } catch (err: any) {
      console.error("Erro ao finalizar atendimento:", err);
      alert(`Nao foi possivel finalizar o atendimento: ${err.message}`);
    } finally {
      setIsFinalizingConversation(false);
    }
  };

  const handleStartChat = async (conversationId: number) => {
    if (!user) return;

    setActionLoading(true);
    try {
      const encrypted = await encrypt({
        conversa_id: conversationId,
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        nome_usuario: user.name,
      });
      const response = await fetch(
        `${API_BASE}/atendimento/iniciar_atendimento`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }
      );
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        msg?: string;
      };
      if (resp?.boleano) {
        window.dispatchEvent(new CustomEvent("commercial:data-changed"));
        await fetchConversations();
        setListTab("active");
        setSearchParams({ status: "active" });
      } else {
        throw new Error(resp?.msg || "Falha ao iniciar atendimento.");
      }
    } catch (err: any) {
      console.error("Erro ao iniciar atendimento:", err);
      alert(`Nao foi possivel iniciar o atendimento: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const loadMetaTemplates = useCallback(
    async (metaParamId?: number | string) => {
      if (!user?.empresa_id) {
        setAvailableMetaTemplates([]);
        setSelectedMetaTemplateName("");
        return;
      }

      const normalizedMetaParamId = Number(metaParamId || 0);
      if (!Number.isInteger(normalizedMetaParamId) || normalizedMetaParamId <= 0) {
        setAvailableMetaTemplates([]);
        setSelectedMetaTemplateName("");
        setLoadingMetaTemplates(false);
        return;
      }

      try {
        setLoadingMetaTemplates(true);
        const templates = await MetaService.getTemplates(user.empresa_id, {
          metaParamId: normalizedMetaParamId,
        });
        const sortedTemplates = [...templates].sort((left, right) => {
          const leftApproved = isTemplateApproved(left) ? 1 : 0;
          const rightApproved = isTemplateApproved(right) ? 1 : 0;
          if (leftApproved !== rightApproved) return rightApproved - leftApproved;
          return String(left.name || "").localeCompare(
            String(right.name || ""),
            "pt-BR"
          );
        });

        setAvailableMetaTemplates(sortedTemplates);
        setSelectedMetaTemplateName((current) => {
          if (current && sortedTemplates.some((template) => template.name === current)) {
            return current;
          }

          return (
            sortedTemplates.find((template) => isTemplateApproved(template))?.name ||
            String(sortedTemplates[0]?.name || "")
          );
        });
      } catch (error) {
        setAvailableMetaTemplates([]);
        setSelectedMetaTemplateName("");
        setMetaTemplateDispatchError(
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os templates da Meta."
        );
      } finally {
        setLoadingMetaTemplates(false);
      }
    },
    [user?.empresa_id]
  );

  const loadMetaTemplateQuickSuggestions = useCallback(
    async (metaParamId?: number | string) => {
      if (!user?.empresa_id || !user?.id) {
        setMetaTemplateQuickSuggestions([]);
        return;
      }

      const normalizedMetaParamId = Number(metaParamId || 0);
      if (!Number.isInteger(normalizedMetaParamId) || normalizedMetaParamId <= 0) {
        setMetaTemplateQuickSuggestions([]);
        setLoadingMetaTemplateQuickSuggestions(false);
        return;
      }

      try {
        setLoadingMetaTemplateQuickSuggestions(true);
        const suggestions = await MetaService.getTemplateQuickSuggestions(
          user.empresa_id,
          {
            metaParamId: normalizedMetaParamId,
            usuarioId: user.id,
            limit: 5,
          }
        );
        setMetaTemplateQuickSuggestions(
          Array.isArray(suggestions)
            ? suggestions.filter((item) => Boolean(String(item.template_name || "").trim()))
            : []
        );
      } catch (error) {
        console.error("Erro ao carregar templates sugeridos:", error);
        setMetaTemplateQuickSuggestions([]);
      } finally {
        setLoadingMetaTemplateQuickSuggestions(false);
      }
    },
    [user?.empresa_id, user?.id]
  );

  const loadMetaIntegrationNumbers = useCallback(async () => {
    if (!user?.empresa_id || !user?.id) {
      setAvailableMetaIntegrationNumbers([]);
      setSelectedMetaIntegrationNumberId("");
      return [];
    }

    try {
      setLoadingMetaIntegrationNumbers(true);
      const numbers = await MetaService.getIntegrationNumbers(user.empresa_id, user.id);
      const activeNumbers = numbers.filter((account) => account.ativo !== false);
      setAvailableMetaIntegrationNumbers(activeNumbers);
      return activeNumbers;
    } catch (error) {
      setAvailableMetaIntegrationNumbers([]);
      setSelectedMetaIntegrationNumberId("");
      setMetaTemplateDispatchError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar os numeros da Meta."
      );
      return [];
    } finally {
      setLoadingMetaIntegrationNumbers(false);
    }
  }, [user?.empresa_id, user?.id]);

  const resolveSelectedConversationContext = useCallback(() => {
    return (
      apiConversations.find((conversation) => conversation.id === selectedConversationId) ||
      conversationSearchResults.find(
        (conversation) => conversation.id === selectedConversationId
      ) ||
      (selectedConversationSnapshot &&
      Number(selectedConversationSnapshot.id) === Number(selectedConversationId || 0)
        ? selectedConversationSnapshot
        : null)
    );
  }, [
    apiConversations,
    conversationSearchResults,
    selectedConversationId,
    selectedConversationSnapshot,
  ]);

  const handleOpenTemplateDispatchModal = useCallback(async () => {
    const currentConversation = resolveSelectedConversationContext();
    if (!currentConversation) return;

    if (!String(currentConversation.telefone || "").trim()) {
      alert("Este cliente precisa ter um telefone valido para receber um template.");
      return;
    }

    setMetaTemplateDispatchError("");
    setAvailableMetaTemplates([]);
    setMetaTemplateQuickSuggestions([]);
    setSelectedMetaTemplateName("");
    setMetaTemplateLanguage("pt_BR");
    setMetaTemplateHeaderParameters([]);
    setMetaTemplateBodyParameters([]);
    setMetaTemplateButtonParameters({});
    setMetaTemplateHeaderFile(null);
    setIsTemplateDispatchModalOpen(true);

    const activeNumbers = await loadMetaIntegrationNumbers();
    const preferredMetaParamId = Number(currentConversation.empresa_meta_param_id || 0);
    const preferredExists = activeNumbers.some(
      (account) => Number(account.id || 0) === preferredMetaParamId
    );

    setSelectedMetaIntegrationNumberId(
      preferredExists
        ? String(preferredMetaParamId)
        : String(activeNumbers[0]?.id || "")
    );
  }, [loadMetaIntegrationNumbers, resolveSelectedConversationContext]);

  const handleCloseTemplateDispatchModal = useCallback(() => {
    setIsTemplateDispatchModalOpen(false);
    setAvailableMetaIntegrationNumbers([]);
    setLoadingMetaIntegrationNumbers(false);
    setSelectedMetaIntegrationNumberId("");
    setAvailableMetaTemplates([]);
    setMetaTemplateQuickSuggestions([]);
    setLoadingMetaTemplates(false);
    setLoadingMetaTemplateQuickSuggestions(false);
    setSelectedMetaTemplateName("");
    setMetaTemplateLanguage("pt_BR");
    setMetaTemplateHeaderParameters([]);
    setMetaTemplateBodyParameters([]);
    setMetaTemplateButtonParameters({});
    setMetaTemplateHeaderFile(null);
    setMetaTemplateDispatchError("");
  }, []);

  const handleMetaTemplateHeaderParameterChange = useCallback(
    (index: number, patch: Partial<TemplateParameterInput>) => {
      setMetaTemplateHeaderParameters((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...patch,
              }
            : item
        )
      );
    },
    []
  );

  const handleMetaTemplateBodyParameterChange = useCallback(
    (index: number, patch: Partial<TemplateParameterInput>) => {
      setMetaTemplateBodyParameters((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...patch,
              }
            : item
        )
      );
    },
    []
  );

  const handleMetaTemplateButtonParameterChange = useCallback(
    (buttonIndex: number, parameterIndex: number, patch: Partial<TemplateParameterInput>) => {
      setMetaTemplateButtonParameters((current) => ({
        ...current,
        [buttonIndex]: (current[buttonIndex] || []).map((item, itemIndex) =>
          itemIndex === parameterIndex
            ? {
                ...item,
                ...patch,
              }
            : item
        ),
      }));
    },
    []
  );

  const handleDispatchTemplateToConversation = useCallback(async () => {
    const currentConversation = resolveSelectedConversationContext();
    const currentTemplate =
      availableMetaTemplates.find((template) => template.name === selectedMetaTemplateName) ||
      null;

    if (!user?.empresa_id || !currentConversation || !currentTemplate) {
      return;
    }

    if (!isTemplateApproved(currentTemplate)) {
      setMetaTemplateDispatchError("Selecione um template aprovado pela Meta.");
      return;
    }

    const normalizedMetaParamId = Number(selectedMetaIntegrationNumberId || 0);
    if (!Number.isInteger(normalizedMetaParamId) || normalizedMetaParamId <= 0) {
      setMetaTemplateDispatchError("Selecione o numero da Meta que sera usado no disparo.");
      return;
    }

    try {
      setDispatchingMetaTemplate(true);
      setMetaTemplateDispatchError("");

      const buttonParameters = Object.entries(metaTemplateButtonParameters)
        .map(([buttonIndex, parameters]) => ({
          index: Number(buttonIndex) - 1,
          parameters: parameters
            .map(mapTemplateParameterInputToPayload)
            .filter((item) => item !== null),
        }))
        .filter((item) => item.parameters.length > 0);

      const result = await MetaService.dispatchTemplate({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        metaParamId: normalizedMetaParamId,
        conversaId: currentConversation.id,
        numero: currentConversation.telefone,
        clienteId: currentConversation.cliente_id || currentConversation.id,
        contactName: currentConversation.nome,
        templateName: String(currentTemplate.name || "").trim(),
        language: metaTemplateLanguage.trim() || "pt_BR",
        headerParameters: metaTemplateHeaderParameters
          .map(mapTemplateParameterInputToPayload)
          .filter((item) => item !== null),
        bodyParameters: metaTemplateBodyParameters
          .map(mapTemplateParameterInputToPayload)
          .filter((item) => item !== null),
        buttonParameters,
        headerFile: metaTemplateHeaderFile,
      });

      const nextConversationId = Number(result?.conversa_id || 0);
      const shouldFocusActiveConversation =
        (Number.isInteger(nextConversationId) &&
          nextConversationId > 0 &&
          nextConversationId !== Number(selectedConversationId || 0)) ||
        Boolean(result?.chat_opened_automatically) ||
        Boolean(result?.assigned_to_user);

      handleCloseTemplateDispatchModal();
      if (shouldFocusActiveConversation) {
        if (Number.isInteger(nextConversationId) && nextConversationId > 0) {
          setSelectedConversationId(nextConversationId);
        }
        setListTab("active");
        setSearchParams({ status: "active" });
      }
      await fetchConversations();
      setChatRefreshSignal((prev) => prev + 1);
      alert(result.guidance_message || "Template enviado com sucesso.");
    } catch (error) {
      console.error("[ChatPage] Falha ao disparar template pela tela de chat:", {
        templateName: selectedMetaTemplateName,
        language: metaTemplateLanguage,
        metaParamId: selectedMetaIntegrationNumberId,
        conversationId: currentConversation.id,
        error,
      });
      setMetaTemplateDispatchError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel disparar o template para este cliente."
      );
    } finally {
      setDispatchingMetaTemplate(false);
    }
  }, [
    fetchConversations,
    handleCloseTemplateDispatchModal,
    availableMetaTemplates,
    metaTemplateBodyParameters,
    metaTemplateButtonParameters,
    metaTemplateHeaderFile,
    metaTemplateHeaderParameters,
    metaTemplateLanguage,
    selectedMetaIntegrationNumberId,
    selectedMetaTemplateName,
    setSearchParams,
    resolveSelectedConversationContext,
    user?.empresa_id,
  ]);

  const handleOpenSettings = () => {
    setSettingsDraft(atendimentoConfig);
    setQueueCandidateUserId("");
    setIsSettingsModalOpen(true);
  };

  const handleAddQueueUser = () => {
    const normalizedUserId = Number(queueCandidateUserId || 0);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return;
    }

    setSettingsDraft((prev) => {
      if (prev.atendimento_fila_usuarios.includes(normalizedUserId)) {
        return prev;
      }

      return {
        ...prev,
        atendimento_fila_usuarios: [
          ...prev.atendimento_fila_usuarios,
          normalizedUserId,
        ],
      };
    });
    setQueueCandidateUserId("");
  };

  const handleRemoveQueueUser = (userId: number) => {
    setSettingsDraft((prev) => ({
      ...prev,
      atendimento_fila_usuarios: prev.atendimento_fila_usuarios.filter(
        (currentUserId) => currentUserId !== userId
      ),
    }));
  };

  const handleMoveQueueUser = (userId: number, direction: -1 | 1) => {
    setSettingsDraft((prev) => {
      const currentIndex = prev.atendimento_fila_usuarios.indexOf(userId);
      const targetIndex = currentIndex + direction;

      if (
        currentIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= prev.atendimento_fila_usuarios.length
      ) {
        return prev;
      }

      const nextQueue = [...prev.atendimento_fila_usuarios];
      const [movedUserId] = nextQueue.splice(currentIndex, 1);
      nextQueue.splice(targetIndex, 0, movedUserId);

      return {
        ...prev,
        atendimento_fila_usuarios: nextQueue,
      };
    });
  };

  const handleSaveSettings = async () => {
    if (!user?.empresa_id || !user?.id || !isAttendanceManager) return;

    setIsSavingSettings(true);
    try {
      const encrypted = await encrypt({
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        ...settingsDraft,
      });
      const response = await fetch(
        `${API_BASE}/atendimento/salvar_configuracoes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }
      );
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj?: Partial<AtendimentoConfig>;
        mensagem?: string;
        msg?: string;
      };

      if (!resp?.boleano) {
        throw new Error(resp?.mensagem || resp?.msg || "Falha ao salvar configurações.");
      }

      const nextConfig: AtendimentoConfig = {
        atendimento_lista_atribuida_adm: Boolean(
          resp.obj?.atendimento_lista_atribuida_adm
        ),
        atendimento_mensagens_rapidas_ativas:
          resp.obj?.atendimento_mensagens_rapidas_ativas === undefined
            ? true
            : Boolean(resp.obj?.atendimento_mensagens_rapidas_ativas),
        atendimento_disparo_nps_ativo:
          resp.obj?.atendimento_disparo_nps_ativo === undefined
            ? true
            : Boolean(resp.obj?.atendimento_disparo_nps_ativo),
        atendimento_fila_automatica_ativa: Boolean(
          resp.obj?.atendimento_fila_automatica_ativa
        ),
        atendimento_fila_usuarios: Array.isArray(resp.obj?.atendimento_fila_usuarios)
          ? [...new Set(
              resp.obj.atendimento_fila_usuarios
                .map((value) => Number(value || 0))
                .filter((value) => Number.isInteger(value) && value > 0)
            )]
          : [],
      };

      setAtendimentoConfig(nextConfig);
      setSettingsDraft(nextConfig);
      setQueueCandidateUserId("");
      setIsSettingsModalOpen(false);
      await fetchConversations();
    } catch (error: any) {
      console.error("Erro ao salvar configurações de atendimento:", error);
      alert(`Nao foi possivel salvar as configurações: ${error.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleOpenTransferModal = () => {
    const currentTransferUserId =
      apiConversation?.usuario_id ?? apiConversation?.usuario_atribuido_id ?? null;
    setTransferUserId(currentTransferUserId ? String(currentTransferUserId) : "");
    setIsTransferModalOpen(true);
  };

  const handleOpenAssignmentModal = () => {
    setAssignmentUserId(
      apiConversation?.usuario_atribuido_id
        ? String(apiConversation.usuario_atribuido_id)
        : ""
    );
    setIsAssignmentModalOpen(true);
  };

  const handleAssignConversation = async () => {
    if (!user?.empresa_id || !user?.id || !selectedConversationId) {
      return;
    }

    const trimmedAssignmentUserId = assignmentUserId.trim();
    const usuarioAtribuidoId = trimmedAssignmentUserId
      ? Number(trimmedAssignmentUserId)
      : null;

    if (
      trimmedAssignmentUserId &&
      (!Number.isInteger(usuarioAtribuidoId) || Number(usuarioAtribuidoId) <= 0)
    ) {
      alert("Selecione um atendente valido.");
      return;
    }

    setIsAssigningConversation(true);
    try {
      const encrypted = await encrypt({
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        conversa_id: selectedConversationId,
        usuario_atribuido_id: usuarioAtribuidoId,
      });
      const response = await fetch(
        `${API_BASE}/atendimento/atribuir_conversa`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }
      );
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        mensagem?: string;
        msg?: string;
      };

      if (!resp?.boleano) {
        throw new Error(resp?.mensagem || resp?.msg || "Falha ao atribuir atendimento.");
      }

      setIsAssignmentModalOpen(false);
      await fetchConversations();
      setChatRefreshSignal((prev) => prev + 1);
    } catch (error: any) {
      console.error("Erro ao atribuir atendimento:", error);
      alert(`Nao foi possivel atualizar a atribuicao: ${error.message}`);
    } finally {
      setIsAssigningConversation(false);
    }
  };

  const handleTransferConversation = async () => {
    if (!user?.empresa_id || !user?.id || !selectedConversationId) {
      return;
    }

    const novoUsuarioId = Number(transferUserId);
    if (!Number.isInteger(novoUsuarioId) || novoUsuarioId <= 0) {
      alert("Selecione um atendente valido.");
      return;
    }

    setIsTransferringConversation(true);
    try {
      const encrypted = await encrypt({
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        conversa_id: selectedConversationId,
        novo_usuario_id: novoUsuarioId,
      });
      const response = await fetch(
        `${API_BASE}/atendimento/transferir_atendimento`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }
      );
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        mensagem?: string;
        msg?: string;
      };

      if (!resp?.boleano) {
        throw new Error(resp?.mensagem || resp?.msg || "Falha ao trocar atendente.");
      }

      setIsTransferModalOpen(false);
      await fetchConversations();
      setChatRefreshSignal((prev) => prev + 1);
    } catch (error: any) {
      console.error("Erro ao trocar atendente:", error);
      alert(`Nao foi possivel trocar o atendente: ${error.message}`);
    } finally {
      setIsTransferringConversation(false);
    }
  };

  const handleOpenProductGallery = async () => {
    setSelectedGalleryImageKeys([]);
    setProductImageCaption("");
    setProductImageSearch("");
    setIsProductGalleryOpen(true);

    try {
      await loadGalleryImages();
    } catch (error) {
      console.error("Erro ao carregar galeria de imagens:", error);
      alert("Nao foi possivel carregar a galeria de imagens.");
    }
  };

  const handleOpenDocumentGallery = async () => {
    setSelectedGalleryDocumentKeys([]);
    setProductDocumentCaption("");
    setProductDocumentSearch("");
    setIsDocumentGalleryOpen(true);

    try {
      await loadGalleryDocuments();
    } catch (error) {
      console.error("Erro ao carregar galeria de documentos:", error);
      alert("Nao foi possivel carregar a galeria de documentos.");
    }
  };

  const toggleGalleryImageSelection = (selectionKey: string) => {
    setSelectedGalleryImageKeys((prev) =>
      prev.includes(selectionKey)
        ? prev.filter((key) => key !== selectionKey)
        : [...prev, selectionKey]
    );
  };

  const toggleGalleryDocumentSelection = (selectionKey: string) => {
    setSelectedGalleryDocumentKeys((prev) =>
      prev.includes(selectionKey)
        ? prev.filter((key) => key !== selectionKey)
        : [...prev, selectionKey]
    );
  };

  const handleSendCommercialProductImages = async () => {
    if (!user?.empresa_id || !user?.id || !selectedConversationId || !selectedConversation) {
      return;
    }
    if (!selectedGalleryImageKeys.length) {
      alert("Selecione ao menos uma imagem.");
      return;
    }

    setIsSendingGalleryImages(true);
    try {
      const selectedImages = selectedGalleryImageKeys
        .map((selectionKey) =>
          galleryImages.find((image) => image.selectionKey === selectionKey) || null
        )
        .filter((image): image is ChatGalleryImage => Boolean(image));

      if (!selectedImages.length) {
        throw new Error("Nenhuma imagem valida foi encontrada para envio.");
      }

      for (const [index, image] of selectedImages.entries()) {
        const caption = buildCommercialProductImageCaption(
          image,
          index === 0 ? productImageCaption.trim() : ""
        );
        const encrypted = await encrypt({
          conversa_id: selectedConversationId,
          empresa_id: user.empresa_id,
          usuario_id: user.id,
          numero: selectedConversation.phone,
          image_url: image.url,
          caption,
        });

        const response = await fetch(`${API_BASE}/atendimento/enviar_imagem_url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });

        const respData = await response.json();
        const resp = (await decrypt(respData.payload)) as {
          boleano: boolean;
          mensagem?: string;
          msg?: string;
        };

        if (!resp?.boleano) {
          throw new Error(resp?.mensagem || resp?.msg || "Falha ao enviar imagens.");
        }
      }

      setIsProductGalleryOpen(false);
      setSelectedGalleryImageKeys([]);
      setProductImageCaption("");
      setChatRefreshSignal((prev) => prev + 1);
    } catch (error: any) {
      console.error("Erro ao enviar imagens da galeria:", error);
      alert(`Nao foi possivel enviar as imagens: ${error.message}`);
    } finally {
      setIsSendingGalleryImages(false);
    }
  };

  const handleSendCommercialProductDocuments = async () => {
    if (!user?.empresa_id || !user?.id || !selectedConversationId || !selectedConversation) {
      return;
    }
    if (!selectedGalleryDocumentKeys.length) {
      alert("Selecione ao menos um documento.");
      return;
    }

    setIsSendingGalleryDocuments(true);
    try {
      const selectedDocuments = selectedGalleryDocumentKeys
        .map((selectionKey) =>
          galleryDocuments.find((document) => document.selectionKey === selectionKey) || null
        )
        .filter((document): document is ChatGalleryDocument => Boolean(document));

      if (!selectedDocuments.length) {
        throw new Error("Nenhum documento valido foi encontrado para envio.");
      }

      for (const [index, document] of selectedDocuments.entries()) {
        const encrypted = await encrypt({
          conversa_id: selectedConversationId,
          empresa_id: user.empresa_id,
          usuario_id: user.id,
          numero: selectedConversation.phone,
          document_url: document.url,
          filename: document.nome_arquivo,
          caption: index === 0 ? productDocumentCaption.trim() : "",
        });

        const response = await fetch(`${API_BASE}/atendimento/enviar_documento_url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });

        const respData = await response.json();
        const resp = (await decrypt(respData.payload)) as {
          boleano: boolean;
          mensagem?: string;
          msg?: string;
        };

        if (!resp?.boleano) {
          throw new Error(resp?.mensagem || resp?.msg || "Falha ao enviar documentos.");
        }
      }

      setIsDocumentGalleryOpen(false);
      setSelectedGalleryDocumentKeys([]);
      setProductDocumentCaption("");
      setChatRefreshSignal((prev) => prev + 1);
    } catch (error: any) {
      console.error("Erro ao enviar documentos da galeria:", error);
      alert(`Nao foi possivel enviar os documentos: ${error.message}`);
    } finally {
      setIsSendingGalleryDocuments(false);
    }
  };

  const handleConfirmResumeChat = async () => {
    if (!selectedConversationId) return;
    setActionLoading(true);
    setIsResumeModalOpen(false);
    try {
      const encrypted = await encrypt({ conversa_id: selectedConversationId });
      const response = await fetch(`${API_BASE}/atendimento/retomar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        msg?: string;
      };
      if (resp?.boleano) {
        await fetchConversations();
        setListTab("active");
        setSearchParams({ status: "active" });
      } else {
        throw new Error(resp?.msg || "Falha ao retomar atendimento.");
      }
    } catch (err: any) {
      console.error("Erro ao retomar atendimento:", err);
      alert(`Nao foi possivel retomar o atendimento: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnalyzeConversationIa = async (conversation: ApiConversation) => {
    if (!user?.empresa_id) return;

    setIsIaModalOpen(true);
    setIsAnalyzingIa(true);
    setIaAnalysisError("");
    setIaAnalysisResult(null);

    try {
      const encrypted = await encrypt({
        conversa_id: conversation.id,
        empresa_id: user.empresa_id,
      });

      const response = await fetch(`${API_BASE}/atendimento/analisar_atendimento_ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj?: AtendimentoIaResultado;
        mensagem?: string;
      };

      if (!resp?.boleano) {
        throw new Error(resp?.mensagem || "Nao foi possivel analisar o atendimento.");
      }

      setIaAnalysisResult(resp.obj || null);
    } catch (error: any) {
      console.error("Erro ao analisar atendimento via IA:", error);
      setIaAnalysisError(error?.message || "Falha ao gerar analise de IA.");
    } finally {
      setIsAnalyzingIa(false);
    }
  };

  const handleAssistActiveConversionIa = async () => {
    if (!user?.empresa_id || !selectedConversationId) return;

    setIsAssistModalOpen(true);
    setIsLoadingAssistIa(true);
    setAssistIaError("");
    setAssistIaResult(null);

    try {
      const encrypted = await encrypt({
        conversa_id: selectedConversationId,
        empresa_id: user.empresa_id,
      });

      const response = await fetch(`${API_BASE}/atendimento/assistente_conversao_ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj?: AssistenciaConversaoResultado;
        mensagem?: string;
      };

      if (!resp?.boleano) {
        throw new Error(resp?.mensagem || "Nao foi possivel gerar assistencia de conversao.");
      }

      setAssistIaResult(resp.obj || null);
    } catch (error: any) {
      console.error("Erro ao gerar assistencia de conversao IA:", error);
      setAssistIaError(error?.message || "Falha ao gerar assistencia por IA.");
    } finally {
      setIsLoadingAssistIa(false);
    }
  };

  const getSelectedConversationName = () =>
    apiConversations.find((conv) => conv.id === selectedConversationId)?.nome ||
    "cliente";

  const buildLiveQuoteItemsFromProducts = useCallback(
    (products: DealProduct[] = [], catalog: LiveQuoteCatalogProduct[] = []) =>
      products
        .map((item, index) => {
          const name = String(item?.name || "").trim();
          if (!name) return null;

          const matchedCatalogProduct = catalog.find(
            (product) =>
              Number(product.id) === Number(item.comercialProdutoId || item.id) ||
              product.nome.trim().toLowerCase() === name.toLowerCase(),
          );

          return {
            key: `${matchedCatalogProduct?.id || item.comercialProdutoId || item.id || name}-${index}`,
            productId: matchedCatalogProduct?.id
              ? Number(matchedCatalogProduct.id)
              : item.comercialProdutoId
                ? Number(item.comercialProdutoId)
                : null,
            name,
            quantity: Number(item?.quantity || 1) || 1,
            unitPrice:
              Number(item?.price ?? matchedCatalogProduct?.preco_base ?? 0) || 0,
          };
        })
        .filter((item): item is LiveQuoteItem => Boolean(item)),
    [],
  );

  const resetLiveQuoteDraft = useCallback(() => {
    setLiveQuoteItems([]);
    setLiveQuoteDiscount(0);
    setLiveQuoteNotes("");
    setLiveQuoteHeaderMessage("");
    setLiveQuoteCatalogProducts([]);
    setLiveQuoteIaNotes([]);
    setLiveQuoteCrmContext(null);
    setIsLiveQuoteModalOpen(false);
  }, []);

  const hydrateLiveQuoteFromAssistResult = useCallback(
    (result: AssistenciaConversaoResultado | null) => {
      if (!result?.assistencia) {
        return;
      }

      const catalog = Array.isArray(result.produtos_catalogo)
        ? result.produtos_catalogo
        : [];
      const draft = result.assistencia.rascunho_orcamento;
      const recommended = Array.isArray(result.assistencia.produtos_recomendados)
        ? result.assistencia.produtos_recomendados
        : [];

      const initialItems =
        draft?.itens?.length
          ? draft.itens.map((item, index) => {
              const catalogItem = catalog.find(
                (product) =>
                  product.nome.trim().toLowerCase() ===
                  item.nome.trim().toLowerCase(),
              );
              return {
                key: `${catalogItem?.id || item.nome}-${index}`,
                productId: catalogItem?.id || null,
                name: item.nome,
                quantity: Number(item.quantidade || 1) || 1,
                unitPrice:
                  Number(item.preco_unitario ?? catalogItem?.preco_base ?? 0) || 0,
              };
            })
          : recommended.slice(0, 2).map((item, index) => {
              const catalogItem = catalog.find(
                (product) =>
                  product.nome.trim().toLowerCase() ===
                  item.nome.trim().toLowerCase(),
              );
              return {
                key: `${catalogItem?.id || item.nome}-${index}`,
                productId: catalogItem?.id || null,
                name: item.nome,
                quantity: Number(item.quantidade_sugerida || 1) || 1,
                unitPrice:
                  Number(item.preco_referencia ?? catalogItem?.preco_base ?? 0) || 0,
              };
            });

      setLiveQuoteItems(initialItems);
      setLiveQuoteDiscount(0);
      setLiveQuoteNotes(
        String(draft?.resumo || "").trim() ||
          String(result.assistencia.proxima_melhor_acao || "").trim(),
      );
      setLiveQuoteHeaderMessage(
        String(draft?.mensagem_pronta || "").trim() ||
          `Ola, ${result.cliente?.nome || "cliente"}! Montei um orçamento inicial para você:`,
      );
      setLiveQuoteCatalogProducts(catalog);
      setLiveQuoteIaNotes(
        Array.isArray(draft?.observacoes) ? draft.observacoes : [],
      );
      setLiveQuoteCrmContext(
        result.crm
          ? {
              negocioId: result.crm.negocio_id ?? null,
              crmId: result.crm.crm_id ?? null,
              crmNome: result.crm.crm_nome ?? null,
              etapaNome: result.crm.etapa_nome ?? null,
              etapaFechamento: Boolean(result.crm.etapa_fechamento),
            }
          : null,
      );
    },
    [],
  );

  const handleOpenLiveQuoteModal = useCallback(
    (payload?: LiveQuoteOpenPayload) => {
      if (payload) {
        const catalog = Array.isArray(payload.catalogo) ? payload.catalogo : [];
        setLiveQuoteCatalogProducts(catalog);
        setLiveQuoteCrmContext(payload.crm || null);
        setLiveQuoteHeaderMessage(
          String(payload.headerMessage || "").trim() ||
            `Ola, ${getSelectedConversationName()}! Montei um orçamento para você:`,
        );
        setLiveQuoteNotes(String(payload.notes || "").trim());
        setLiveQuoteIaNotes(
          Array.isArray(payload.iaNotes) ? payload.iaNotes : [],
        );
        setLiveQuoteDiscount(0);
        setLiveQuoteItems(
          buildLiveQuoteItemsFromProducts(payload.products || [], catalog),
        );
      } else if (!liveQuoteHeaderMessage.trim()) {
        setLiveQuoteHeaderMessage(
          `Ola, ${getSelectedConversationName()}! Montei um orçamento para você:`,
        );
      }

      setIsLiveQuoteModalOpen(true);
    },
    [
      buildLiveQuoteItemsFromProducts,
      getSelectedConversationName,
      liveQuoteHeaderMessage,
    ],
  );

  const buildQuoteMessage = () => {
    const validItems = liveQuoteItems.filter((item) => String(item.name || "").trim());
    const subtotal = validItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );
    const discount = Math.max(0, Number(liveQuoteDiscount || 0));
    const total = Math.max(0, subtotal - discount);
    const formatCurrency = (value: number) =>
      value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

    const itemBlocks = validItems.map((item) => {
      const lineSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      return [
        `*${String(item.name || "").trim()}*`,
        `Qtd: ${item.quantity}`,
        `Unit: ${formatCurrency(Number(item.unitPrice || 0))}`,
        `Subtotal: ${formatCurrency(lineSubtotal)}`,
      ].join("\n");
    });

    const header =
      String(liveQuoteHeaderMessage || "").trim() ||
      `Ola, ${getSelectedConversationName()}! Montei um orçamento para você:`;

    const footer = [
      `Subtotal: ${formatCurrency(subtotal)}`,
      discount > 0 ? `Desconto: ${formatCurrency(discount)}` : null,
      `Total: ${formatCurrency(total)}`,
      liveQuoteNotes.trim() || assistIaResult?.assistencia?.cta_recomendado || "",
    ]
      .filter(Boolean)
      .join("\n");

    return [header, "", itemBlocks.join("\n\n"), "", footer].filter(Boolean).join("\n");
  };

  const appendProductToLiveQuote = (product: {
    id?: number | null;
    nome: string;
    preco_base?: number | null;
    quantidade_sugerida?: number;
    preco_referencia?: number | null;
  }) => {
    if (!product?.nome) return;

    setLiveQuoteItems((current) => {
      const existing = current.find(
        (item) =>
          (product.id && item.productId === Number(product.id)) ||
          item.name.toLowerCase() === product.nome.toLowerCase(),
      );

      if (existing) {
        return current.map((item) =>
          item.key === existing.key
            ? {
                ...item,
                quantity:
                  item.quantity + (Number(product.quantidade_sugerida || 1) || 1),
              }
            : item,
        );
      }

      return [
        ...current,
        {
          key: `${product.id || product.nome}-${Date.now()}`,
          productId: product.id ? Number(product.id) : null,
          name: product.nome,
          quantity: Number(product.quantidade_sugerida || 1) || 1,
          unitPrice:
            Number(product.preco_base ?? product.preco_referencia ?? 0) || 0,
        },
      ];
    });
  };

  useEffect(() => {
    hydrateLiveQuoteFromAssistResult(assistIaResult);
  }, [assistIaResult, hydrateLiveQuoteFromAssistResult]);

  useEffect(() => {
    resetLiveQuoteDraft();
  }, [resetLiveQuoteDraft, selectedConversationId]);

  const handlePrefillIaShortcutMessage = (text: string) => {
    const message = String(text || "").trim();
    if (!message || !selectedConversationId) return;
    if (selectedConversation?.metaWindowOpen === false) {
      alert(
        selectedConversation.awaitingTemplateReply
          ? templateReplyPendingMessage
          : metaWindowLockMessage
      );
      return;
    }

    setChatComposerPrefillText(message);
    setChatComposerPrefillToken((current) => current + 1);
    setIsAssistModalOpen(false);
    setIsLiveQuoteModalOpen(false);
    closeConversationSupportOverlays();
  };

  const handleComposerPrefillConsumed = useCallback(() => {
    setChatComposerPrefillText("");
  }, []);

  const handleUpdateLiveQuoteItem = (
    key: string,
    field: "name" | "quantity" | "unitPrice",
    value: string | number,
  ) => {
    setLiveQuoteItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        if (field === "name") {
          return { ...item, name: String(value || "") };
        }
        if (field === "quantity") {
          return { ...item, quantity: Math.max(1, Number(value || 1) || 1) };
        }
        return { ...item, unitPrice: Math.max(0, Number(value || 0) || 0) };
      }),
    );
  };

  const handleRemoveLiveQuoteItem = (key: string) => {
    setLiveQuoteItems((current) => current.filter((item) => item.key !== key));
  };

  const handleAddBlankLiveQuoteItem = () => {
    setLiveQuoteItems((current) => [
      ...current,
      {
        key: `manual-${Date.now()}`,
        productId: null,
        name: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleAddCatalogProductToQuote = (productId: number) => {
    const product = liveQuoteCatalogProducts.find(
      (item) => Number(item.id) === Number(productId),
    );
    if (!product) return;
    appendProductToLiveQuote(product);
  };

  const handleSaveLiveQuoteToCrm = async () => {
    const validItems = liveQuoteItems.filter((item) => String(item.name || "").trim());
    if (!liveQuoteCrmContext?.negocioId || !liveQuoteCrmContext?.crmId || !validItems.length) {
      alert("Nao existe negocio de funil valido para salvar este orçamento.");
      return;
    }

    try {
      setIsSavingLiveQuoteToCrm(true);
      const quotePayload = {
        amount: liveQuoteTotal,
        itemQuantity: validItems.reduce(
          (sum, item) => sum + (Number(item.quantity || 0) || 0),
          0,
        ),
        products: validItems.map((item) => ({
          comercialProdutoId: item.productId || undefined,
          name: item.name,
          quantity: Number(item.quantity || 1) || 1,
          price: Number(item.unitPrice || 0) || 0,
        })),
        saleNotes: liveQuoteNotes.trim() || buildQuoteMessage(),
      };

      if (liveQuoteCrmContext.etapaFechamento) {
        const conversationName = String(selectedConversation?.name || "").trim() || "Cliente";
        const createdDeal = await createCommercialDeal(
          {
            title: `WhatsApp - ${conversationName}`,
            companyName: conversationName,
            contactName: conversationName,
            customerPhone: String(selectedConversation?.phone || "").trim() || undefined,
            clienteId: Number(selectedConversation?.cliente_id || 0) || undefined,
            ...quotePayload,
          },
          Number(liveQuoteCrmContext.crmId),
        );

        setLiveQuoteCrmContext((current) =>
          current
            ? {
                ...current,
                negocioId: Number(createdDeal.id || 0) || current.negocioId || null,
                etapaFechamento: false,
              }
            : current,
        );
      } else {
        await updateCommercialDeal(
          String(liveQuoteCrmContext.negocioId),
          quotePayload,
          Number(liveQuoteCrmContext.crmId),
        );
      }

      setIsLiveQuoteModalOpen(false);
      alert("Orçamento salvo no funil.");
    } catch (error: any) {
      console.error("Erro ao salvar orçamento no funil:", error);
      alert(error?.message || "Nao foi possivel salvar o orçamento no funil.");
    } finally {
      setIsSavingLiveQuoteToCrm(false);
    }
  };

  const handleSendLiveQuote = async () => {
    const validItems = liveQuoteItems.filter((item) => String(item.name || "").trim());
    if (!selectedConversationId || !validItems.length) return;
    const ok = await sendMessageToConversation(
      selectedConversationId,
      buildQuoteMessage(),
    );
    if (!ok) {
      alert("Nao foi possivel enviar o orçamento ao cliente.");
      return;
    }
    setIsLiveQuoteModalOpen(false);
    setIsAssistModalOpen(false);
    closeConversationSupportOverlays();
    alert("Orçamento enviado ao cliente.");
  };

  const apiConversation =
    apiConversations.find((conv) => conv.id === selectedConversationId) ||
    conversationSearchResults.find((conv) => conv.id === selectedConversationId) ||
    (selectedConversationSnapshot &&
    Number(selectedConversationSnapshot.id) === Number(selectedConversationId || 0)
      ? selectedConversationSnapshot
      : undefined);

  useEffect(() => {
    if (apiConversation) {
      setSelectedConversationSnapshot(apiConversation);
      return;
    }

    if (!selectedConversationId) {
      setSelectedConversationSnapshot(null);
    }
  }, [apiConversation, selectedConversationId]);

  const selectedConversation: Conversation | undefined = apiConversation
    ? {
        id: apiConversation.id,
        name: apiConversation.nome,
        cliente_id: apiConversation.cliente_id,
        phone: apiConversation.telefone,
        attendent:
          apiConversation.nome_atendente ||
          apiConversation.nome_usuario_atribuido ||
          "Sem atendente",
        empresaMetaParamId: apiConversation.empresa_meta_param_id || null,
        metaAccountDisplayPhoneNumber: apiConversation.meta_numero_conta || null,
        metaAccountName: apiConversation.meta_nome_conta || null,
        email: "",
        status: apiConversation.status,
        messages: [],
        notes: apiConversation.notes || [],
        tags: apiConversation.tags || [],
        avatarColor: generateColorFromName(apiConversation.nome),
        last_contact: apiConversation.ultima_atualizacao,
        sector: apiConversation.setor
          ? { id: apiConversation.setor.id, name: apiConversation.setor.nome }
          : null,
        metaWindowOpen: calculateMetaWindowOpen(apiConversation),
        metaWindowExpiresAt: apiConversation.janela_meta_expira_em || null,
        awaitingTemplateReply: Boolean(
          apiConversation.aguardando_resposta_template
        ),
        lastCustomerMessageAt:
          apiConversation.ultima_mensagem_cliente_em || null,
      }
    : undefined;

  useEffect(() => {
    if (
      selectedConversation?.status !== "active" ||
      selectedConversation.metaWindowOpen !== true
    ) {
      return;
    }

    const expiresAt = parseAttendanceDateTime(
      selectedConversation.metaWindowExpiresAt,
    );
    if (!expiresAt) return;

    const delay = expiresAt.getTime() - Date.now();
    if (delay <= 0) {
      setMetaWindowClockTick(Date.now());
      void fetchConversations();
      return;
    }

    const timeout = window.setTimeout(() => {
      setMetaWindowClockTick(Date.now());
      void fetchConversations();
    }, Math.min(delay + 250, 2_147_483_647));

    return () => window.clearTimeout(timeout);
  }, [
    fetchConversations,
    parseAttendanceDateTime,
    selectedConversation?.id,
    selectedConversation?.metaWindowExpiresAt,
    selectedConversation?.metaWindowOpen,
    selectedConversation?.status,
  ]);

  const selectedMetaTemplate = useMemo(
    () =>
      availableMetaTemplates.find((template) => template.name === selectedMetaTemplateName) ||
      null,
    [availableMetaTemplates, selectedMetaTemplateName]
  );
  const normalizedMetaTemplateQuickSuggestions = useMemo(() => {
    return metaTemplateQuickSuggestions.map((suggestion) => {
      const templateName = String(suggestion.template_name || "").trim();
      const templateLanguage =
        String(suggestion.template_language || "pt_BR").trim() || "pt_BR";
      const matchedTemplate =
        availableMetaTemplates.find(
          (template) =>
            String(template.name || "").trim().toLowerCase() === templateName.toLowerCase() &&
            String(template.language || "pt_BR").trim().toLowerCase() ===
              templateLanguage.toLowerCase()
        ) ||
        availableMetaTemplates.find(
          (template) =>
            String(template.name || "").trim().toLowerCase() === templateName.toLowerCase()
        ) ||
        null;

      return {
        ...suggestion,
        template_name: templateName,
        template_language: templateLanguage,
        matchedTemplate,
        isAvailable: Boolean(matchedTemplate && isTemplateApproved(matchedTemplate)),
      };
    });
  }, [availableMetaTemplates, metaTemplateQuickSuggestions]);
  const selectedMetaTemplateHints = useMemo(
    () => (selectedMetaTemplate ? getTemplateDispatchHints(selectedMetaTemplate) : null),
    [selectedMetaTemplate]
  );

  const assistRecommendedProducts = Array.isArray(
    assistIaResult?.assistencia?.produtos_recomendados,
  )
    ? assistIaResult?.assistencia?.produtos_recomendados
    : [];
  const liveQuoteSubtotal = liveQuoteItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0,
  );
  const liveQuoteTotal = Math.max(
    0,
    liveQuoteSubtotal - Math.max(0, Number(liveQuoteDiscount || 0)),
  );
  const hasLiveQuoteCrm =
    Number(liveQuoteCrmContext?.negocioId || 0) > 0 &&
    Number(liveQuoteCrmContext?.crmId || 0) > 0;

  useEffect(() => {
    setTransferUserId(
      apiConversation?.usuario_id ? String(apiConversation.usuario_id) : ""
    );
  }, [apiConversation?.id, apiConversation?.usuario_id]);

  useEffect(() => {
    if (!isTemplateDispatchModalOpen) return;

    const normalizedMetaParamId = Number(selectedMetaIntegrationNumberId || 0);
    if (!Number.isInteger(normalizedMetaParamId) || normalizedMetaParamId <= 0) {
      setAvailableMetaTemplates([]);
      setMetaTemplateQuickSuggestions([]);
      setSelectedMetaTemplateName("");
      setLoadingMetaTemplates(false);
      setLoadingMetaTemplateQuickSuggestions(false);
      return;
    }

    void loadMetaTemplates(normalizedMetaParamId);
    void loadMetaTemplateQuickSuggestions(normalizedMetaParamId);
  }, [
    isTemplateDispatchModalOpen,
    loadMetaTemplateQuickSuggestions,
    loadMetaTemplates,
    selectedMetaIntegrationNumberId,
  ]);

  useEffect(() => {
    if (!selectedMetaTemplateHints) {
      setMetaTemplateLanguage("pt_BR");
      setMetaTemplateHeaderParameters([]);
      setMetaTemplateBodyParameters([]);
      setMetaTemplateButtonParameters({});
      setMetaTemplateHeaderFile(null);
      return;
    }

    setMetaTemplateDispatchError("");
    setMetaTemplateLanguage(String(selectedMetaTemplate?.language || "pt_BR"));
    setMetaTemplateHeaderParameters(
      createTemplateParameterInputs(selectedMetaTemplateHints.headerParameterCount)
    );
    setMetaTemplateBodyParameters(
      createTemplateParameterInputs(selectedMetaTemplateHints.bodyParameterCount)
    );
    setMetaTemplateButtonParameters(
      selectedMetaTemplateHints.buttons.reduce<Record<number, TemplateParameterInput[]>>(
        (acc, button) => {
          if (button.parameterCount > 0) {
            acc[button.index] = createTemplateParameterInputs(button.parameterCount);
          }
          return acc;
        },
        {}
      )
    );
    setMetaTemplateHeaderFile(null);
  }, [selectedMetaTemplate, selectedMetaTemplateHints]);

  useEffect(() => {
    if (!metaTemplateHeaderFile || !String(metaTemplateHeaderFile.type || "").startsWith("image/")) {
      setMetaTemplateHeaderPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(metaTemplateHeaderFile);
    setMetaTemplateHeaderPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [metaTemplateHeaderFile]);

  const canFinalizeSelectedWaitingConversation =
    isAttendanceManager &&
    apiConversation?.status === "waiting" &&
    Boolean(apiConversation?.fila_mais_24h);
  const canAssignSelectedWaitingConversation =
    isAttendanceManager &&
    apiConversation?.status === "waiting" &&
    atendimentoConfig.atendimento_lista_atribuida_adm;
  const canTransferSelectedWaitingConversation =
    apiConversation?.status === "waiting" &&
    Number(apiConversation?.usuario_atribuido_id || 0) > 0 &&
    (isAttendanceManager ||
      Number(apiConversation?.usuario_atribuido_id) === Number(user?.id || 0));
  const queueUsersInDraft = settingsDraft.atendimento_fila_usuarios
    .map((userId) =>
      assignableUsers.find((assignableUser) => assignableUser.id === userId)
    )
    .filter(
      (assignableUser): assignableUser is AssignableUser => Boolean(assignableUser)
    );
  const availableQueueUsers = assignableUsers.filter(
    (assignableUser) =>
      !settingsDraft.atendimento_fila_usuarios.includes(assignableUser.id)
  );
  const waitingAssignmentLabel = apiConversation?.nome_usuario_atribuido
    ? `Atribuido para ${apiConversation.nome_usuario_atribuido}.`
    : "Nenhum atendente foi atribuido a esta conversa ainda.";
  const waitingQueueSinceLabel = formatConversationDateTime(
    apiConversation?.fila_desde || apiConversation?.data_inicio || null
  );
  const pendingFinalizeConversation = apiConversations.find(
    (conversation) => conversation.id === pendingFinalizeConversationId
  );
  const staleWaitingConversationsCount = apiConversations.filter((conversation) => {
    if (conversation.status !== "waiting") return false;
    const queueSince = String(
      conversation.fila_desde || conversation.data_inicio || ""
    ).trim();
    if (!queueSince) return false;
    const parsed = new Date(queueSince);
    if (Number.isNaN(parsed.getTime())) return false;
    return Date.now() - parsed.getTime() >= 48 * 60 * 60 * 1000;
  }).length;
  const isPendingFinalizeWaitingConversation =
    pendingFinalizeConversation?.status === "waiting";

  const filteredGalleryImages = galleryImages.filter((image) => {
    if (!productImageSearch.trim()) return true;
    const term = productImageSearch.toLowerCase();
    return (
      String(image.nome_arquivo || "").toLowerCase().includes(term) ||
      String(image.referencia_nome || "").toLowerCase().includes(term) ||
      String(image.origem || "").toLowerCase().includes(term)
    );
  });

  const filteredProductGalleryImages = filteredGalleryImages.filter(
    (image) => String(image.origem || "") === "produto_comercial"
  );

  const filteredCompanyGalleryImages = filteredGalleryImages.filter(
    (image) => String(image.origem || "") !== "produto_comercial"
  );

  const filteredGalleryDocuments = galleryDocuments.filter((document) => {
    if (!productDocumentSearch.trim()) return true;
    const term = productDocumentSearch.toLowerCase();
    return (
      String(document.nome_arquivo || "").toLowerCase().includes(term) ||
      String(document.referencia_nome || "").toLowerCase().includes(term) ||
      String(document.origem || "").toLowerCase().includes(term)
    );
  });

  const filteredProductGalleryDocuments = filteredGalleryDocuments.filter(
    (document) => String(document.origem || "") === "produto_comercial_documento"
  );

  const filteredCompanyGalleryDocuments = filteredGalleryDocuments.filter(
    (document) => String(document.origem || "") !== "produto_comercial_documento"
  );

  const isMetaWindowLocked =
    selectedConversation?.status === "active" &&
    selectedConversation?.metaWindowOpen === false;
  const isAwaitingTemplateReply =
    selectedConversation?.status === "active" &&
    Boolean(selectedConversation?.awaitingTemplateReply);

  const renderChatContent = () => {
    if (!selectedConversation) {
      return (
        <div className="no-chat-selected">
          <h2>Selecione uma conversa</h2>
          <p>Escolha um atendimento na lista a esquerda para comecar.</p>
        </div>
      );
    }
    switch (selectedConversation.status) {
      case "waiting":
        return (
          <ChatWindow
            key={selectedConversationId}
            conversation={selectedConversation}
            onSendMessage={handleSendMessage}
            onBack={handleBackToList}
            onInfoClick={handleOpenClientDetails}
            onFinalizeChat={handleFinalizeChat}
            readOnly={true}
            refreshSignal={chatRefreshSignal}
            socketConnected={isSocketConnected}
            quickMessagesEnabled={
              atendimentoConfig.atendimento_mensagens_rapidas_ativas
            }
            readOnlyStatusLabel="Aguardando"
            readOnlyAttendanceLabel="Responsavel atual:"
            readOnlyFooterTitle="Atendimento aguardando inicio"
            readOnlyFooterDescription={
              waitingQueueSinceLabel
                ? `${waitingAssignmentLabel} Na fila desde ${waitingQueueSinceLabel}. Inicie o atendimento para responder este cliente.`
                : `${waitingAssignmentLabel} Este chat permanece em modo somente leitura ate alguem iniciar o atendimento.`
            }
            readOnlyFooterActions={[
              ...(canAssignSelectedWaitingConversation
                ? [
                    {
                      label: apiConversation?.usuario_atribuido_id
                        ? "Reatribuir atendimento"
                        : "Atribuir atendimento",
                      onClick: handleOpenAssignmentModal,
                      disabled: isAssigningConversation,
                    },
                  ]
                : []),
              ...(canTransferSelectedWaitingConversation
                ? [
                    {
                      label: "Transferir atendimento",
                      onClick: handleOpenTransferModal,
                      disabled: isTransferringConversation,
                    },
                  ]
                : []),
              {
                label: actionLoading ? "Processando..." : "Iniciar Atendimento",
                onClick: () => handleStartChat(selectedConversation.id),
                disabled: actionLoading,
              },
              ...(canFinalizeSelectedWaitingConversation
                ? [
                    {
                      label: "Finalizar fila +24h",
                      onClick: () => handleFinalizeChat(selectedConversation.id),
                      tone: "danger" as const,
                    },
                  ]
                : []),
            ]}
          />
        );
      case "finished":
        return (
          <ChatWindow
            key={selectedConversationId}
            conversation={selectedConversation}
            onSendMessage={handleSendMessage}
            onBack={handleBackToList}
            onInfoClick={handleOpenClientDetails}
            onFinalizeChat={handleFinalizeChat}
            readOnly={true}
            refreshSignal={chatRefreshSignal}
            socketConnected={isSocketConnected}
            quickMessagesEnabled={
              atendimentoConfig.atendimento_mensagens_rapidas_ativas
            }
            composerPrefillText={chatComposerPrefillText}
            composerPrefillToken={chatComposerPrefillToken}
            onComposerPrefillConsumed={handleComposerPrefillConsumed}
            readOnlyFooterActions={[
              {
                label: "Enviar template",
                onClick: () => void handleOpenTemplateDispatchModal(),
              },
            ]}
            onAnalyzeConversationIa={() =>
              void handleAnalyzeConversationIa({
                id: selectedConversation.id,
                cliente_id: selectedConversation.cliente_id,
                nome: selectedConversation.name,
                telefone: selectedConversation.phone,
                status: "finished",
                data_inicio: "",
                ultima_atualizacao:
                  typeof selectedConversation.last_contact === "string"
                    ? selectedConversation.last_contact
                    : new Date().toISOString(),
                ultima_mensagem: null,
                nome_atendente: selectedConversation.attendent,
              })
            }
          />
        );
      case "active":
        return (
          <ChatWindow
            key={selectedConversationId}
            conversation={selectedConversation}
            onSendMessage={handleSendMessage}
            onBack={handleBackToList}
            onInfoClick={handleOpenClientDetails}
            onFinalizeChat={handleFinalizeChat}
            refreshSignal={chatRefreshSignal}
            socketConnected={isSocketConnected}
            isMetaWindowExpired={Boolean(isMetaWindowLocked)}
            metaWindowExpiresAt={selectedConversation.metaWindowExpiresAt}
            metaWindowMessage={
              isAwaitingTemplateReply
                ? templateReplyPendingMessage
                : metaWindowLockMessage
            }
            isAwaitingTemplateReply={isAwaitingTemplateReply}
            quickMessagesEnabled={
              atendimentoConfig.atendimento_mensagens_rapidas_ativas
            }
            showTransferButton={Boolean(user)}
            onTransferAttendant={handleOpenTransferModal}
            showProductGalleryButton={true}
            onOpenProductGallery={() => void handleOpenProductGallery()}
            showDocumentGalleryButton={true}
            onOpenDocumentGallery={() => void handleOpenDocumentGallery()}
            composerPrefillText={chatComposerPrefillText}
            composerPrefillToken={chatComposerPrefillToken}
            onComposerPrefillConsumed={handleComposerPrefillConsumed}
            onOpenTemplateDispatch={handleOpenTemplateDispatchModal}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {!(isMobile && selectedConversationId) ? (
        <MobileHeader title="Atendimentos" />
      ) : null}
      <div className="chat-page-layout">
        {isMobile ? (
          <>
            {!selectedConversationId ? (
              <div className="conversation-list-wrapper">
                <ConversationList
                  conversations={apiConversations}
                  refreshSignal={conversationListRefreshSignal}
                  searchResults={conversationSearchResults}
                  searchTotalCount={conversationSearchTotal}
                  searchLoading={isConversationSearchLoading}
                  searchLoadingMore={isConversationSearchLoadingMore}
                  searchHasMore={conversationSearchHasMore}
                  onSearchRequest={handleConversationSearchRequest}
                  onSearchLoadMore={handleConversationSearchLoadMore}
                  finishedCurrentPage={finalizedCurrentPage}
                  finishedTotalPages={finalizedTotalPages}
                  finishedTotalCount={finalizedTotalCount}
                  finishedLoadingPage={isFinalizedConversationsPageLoading}
                  onFinishedPageChange={handleFinishedPageChange}
                  activeConversationId={selectedConversationId}
                  onConversationSelect={handleSelectConversation}
                  initialTab={initialTabStatus}
                  currentTab={listTab}
                  onTabChange={setListTab}
                  loading={loading}
                  showSettingsButton={isAttendanceManager}
                  showConversationFilterButton={true}
                  showAttendantFilterButton={isAttendanceManager}
                  attendantFilterOptions={chatAttendantFilterOptions}
                  selectedAttendantFilter={selectedAttendantFilter}
                  onAttendantFilterChange={setSelectedAttendantFilter}
                  metaNumberFilterOptions={chatMetaNumberFilterOptions}
                  selectedMetaNumberFilter={selectedMetaNumberFilter}
                  onMetaNumberFilterChange={setSelectedMetaNumberFilter}
                  selectedFinishedDatePreset={finishedDatePreset}
                  onFinishedDatePresetChange={handleFinishedDatePresetChange}
                  selectedFinishedDateStart={finishedDateStart}
                  selectedFinishedDateEnd={finishedDateEnd}
                  onFinishedDateStartChange={handleFinishedDateStartChange}
                  onFinishedDateEndChange={handleFinishedDateEndChange}
                  onOpenSettings={handleOpenSettings}
                  showWaitingFinalizeButton={isAttendanceManager}
                  onFinalizeWaitingConversation={handleFinalizeWaitingConversation}
                  waitingFinalizeConversationId={
                    isFinalizingConversation ? pendingFinalizeConversationId : null
                  }
                  showFinalizeStaleWaitingButton={isAttendanceManager}
                  onFinalizeStaleWaitingConversations={
                    handleFinalizeStaleWaitingConversations
                  }
                  staleWaitingConversationsCount={staleWaitingConversationsCount}
                  isFinalizingStaleWaitingConversations={
                    isFinalizingStaleWaitingConversations
                  }
                  onAnalyzeConversationIa={(conversation) =>
                    void handleAnalyzeConversationIa(conversation)
                  }
                />
              </div>
            ) : (
              <div className="chat-window-wrapper">{renderChatContent()}</div>
            )}
          </>
        ) : (
          <>
            <div className="conversation-list-wrapper">
              <ConversationList
                conversations={apiConversations}
                refreshSignal={conversationListRefreshSignal}
                searchResults={conversationSearchResults}
                searchTotalCount={conversationSearchTotal}
                searchLoading={isConversationSearchLoading}
                searchLoadingMore={isConversationSearchLoadingMore}
                searchHasMore={conversationSearchHasMore}
                onSearchRequest={handleConversationSearchRequest}
                onSearchLoadMore={handleConversationSearchLoadMore}
                finishedCurrentPage={finalizedCurrentPage}
                finishedTotalPages={finalizedTotalPages}
                finishedTotalCount={finalizedTotalCount}
                finishedLoadingPage={isFinalizedConversationsPageLoading}
                onFinishedPageChange={handleFinishedPageChange}
                activeConversationId={selectedConversationId}
                onConversationSelect={handleSelectConversation}
                initialTab={initialTabStatus}
                currentTab={listTab}
                onTabChange={setListTab}
                loading={loading}
                showSettingsButton={isAttendanceManager}
                showConversationFilterButton={true}
                showAttendantFilterButton={isAttendanceManager}
                attendantFilterOptions={chatAttendantFilterOptions}
                selectedAttendantFilter={selectedAttendantFilter}
                onAttendantFilterChange={setSelectedAttendantFilter}
                metaNumberFilterOptions={chatMetaNumberFilterOptions}
                selectedMetaNumberFilter={selectedMetaNumberFilter}
                onMetaNumberFilterChange={setSelectedMetaNumberFilter}
                selectedFinishedDatePreset={finishedDatePreset}
                onFinishedDatePresetChange={handleFinishedDatePresetChange}
                selectedFinishedDateStart={finishedDateStart}
                selectedFinishedDateEnd={finishedDateEnd}
                onFinishedDateStartChange={handleFinishedDateStartChange}
                onFinishedDateEndChange={handleFinishedDateEndChange}
                onOpenSettings={handleOpenSettings}
                showWaitingFinalizeButton={isAttendanceManager}
                onFinalizeWaitingConversation={handleFinalizeWaitingConversation}
                waitingFinalizeConversationId={
                  isFinalizingConversation ? pendingFinalizeConversationId : null
                }
                showFinalizeStaleWaitingButton={isAttendanceManager}
                onFinalizeStaleWaitingConversations={
                  handleFinalizeStaleWaitingConversations
                }
                staleWaitingConversationsCount={staleWaitingConversationsCount}
                isFinalizingStaleWaitingConversations={
                  isFinalizingStaleWaitingConversations
                }
                onAnalyzeConversationIa={(conversation) =>
                  void handleAnalyzeConversationIa(conversation)
                }
              />
            </div>
            <div className="chat-window-wrapper">{renderChatContent()}</div>
            {!isMobile && selectedConversation ? (
              <div
                className={`client-details-wrapper ${
                  isDesktopDetailsOpen ? "is-open" : "is-collapsed"
                }`}
              >
                {isDesktopDetailsOpen ? (
                  <>
                    <div className="client-details-panel-toolbar">
                      <button
                        type="button"
                        className="client-details-panel-action"
                        onClick={handleToggleClientDetails}
                        title="Recolher detalhes"
                        aria-label="Recolher detalhes"
                      >
                        <FiChevronRight size={18} />
                      </button>
                    </div>
                    <ClientDetails
                      conversation={selectedConversation}
                      onSaveNote={(noteContent) =>
                        handleSaveNote(selectedConversation.cliente_id, noteContent)
                      }
                      onAddTag={(tag) => handleAddTag(selectedConversation.id, tag)}
                      onRemoveTag={(tagId) =>
                        handleRemoveTag(selectedConversation.id, tagId)
                      }
                      onAssistConversionIa={
                        selectedConversation.status === "active"
                          ? () => void handleAssistActiveConversionIa()
                          : undefined
                      }
                      onOpenLiveQuote={(payload) => handleOpenLiveQuoteModal(payload)}
                      currentUserId={user?.id}
                      currentUserName={user?.name}
                      onUpdateClient={handleClientUpdatedFromChat}
                    />
                  </>
                ) : (
                  <button
                    type="button"
                    className="client-details-expand-button"
                    onClick={handleToggleClientDetails}
                    title="Abrir detalhes do cliente"
                    aria-label="Abrir detalhes do cliente"
                  >
                    <FiChevronLeft size={18} />
                  </button>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>

      <BottomSheet isOpen={isDetailsSheetOpen} onClose={toggleDetailsSheet}>
        {isMobile && isDetailsSheetOpen && selectedConversation && (
          <ClientDetails
            conversation={selectedConversation}
            onSaveNote={(noteContent) =>
              handleSaveNote(selectedConversation.id, noteContent)
            }
            onAddTag={(tag) => handleAddTag(selectedConversation.id, tag)}
            onRemoveTag={(tagId) =>
              handleRemoveTag(selectedConversation.id, tagId)
            }
            onAssistConversionIa={
              selectedConversation.status === "active"
                ? () => void handleAssistActiveConversionIa()
                : undefined
            }
            onOpenLiveQuote={(payload) => handleOpenLiveQuoteModal(payload)}
            currentUserId={user?.id}
            currentUserName={user?.name}
            onUpdateClient={handleClientUpdatedFromChat}
          />
        )}
      </BottomSheet>

      <Modal
        isOpen={isFinalizeModalOpen}
        onClose={() => {
          if (isFinalizingConversation) return;
          setIsFinalizeModalOpen(false);
          setPendingFinalizeConversationId(null);
        }}
        title={
          isPendingFinalizeWaitingConversation
            ? "Finalizar atendimento da fila"
            : "Finalizar atendimento"
        }
      >
        <div className="chat-transfer-modal">
          <p>
            {isPendingFinalizeWaitingConversation
              ? "Confirme se deseja encerrar este atendimento parado na fila."
              : "Confirme se deseja finalizar este atendimento."}
            <br />{" "}
            <span className="chat-transfer-note">
              {isPendingFinalizeWaitingConversation
                ? "* Esta acao remove a conversa da lista de espera e envia o atendimento para os finalizados."
                : "* A conversa saira da fila ativa e ira para os atendimentos finalizados."}
            </span>
          </p>
          
          <div className="chat-transfer-actions">
            <button
              type="button"
              className="chat-settings-cancel"
              onClick={() => {
                setIsFinalizeModalOpen(false);
                setPendingFinalizeConversationId(null);
              }}
              disabled={isFinalizingConversation}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="chat-settings-save"
              onClick={() => void handleConfirmFinalizeChat()}
              disabled={isFinalizingConversation}
            >
              {isFinalizingConversation ? "Finalizando..." : "Finalizar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isAssignmentModalOpen}
        onClose={() => {
          if (isAssigningConversation) return;
          setIsAssignmentModalOpen(false);
        }}
        title="Atribuir atendimento"
      >
        <div className="chat-transfer-modal">
          <p>
            Escolha o atendente que deve assumir este lead na fila de espera.
            <br />{" "}
            <span className="chat-transfer-note">
              * O chat continuara aguardando, mas passara a aparecer na fila do
              usuario atribuido quando a regra da fila por administrador estiver ativa.
            </span>
          </p>

          <label htmlFor="chat-assignment-select">Atendente responsavel</label>
          <select
            id="chat-assignment-select"
            value={assignmentUserId}
            onChange={(event) => setAssignmentUserId(event.target.value)}
            disabled={isAssigningConversation}
          >
            <option value="">Sem atribuicao</option>
            {assignableUsers.map((assignableUser) => (
              <option key={assignableUser.id} value={assignableUser.id}>
                {assignableUser.name}
              </option>
            ))}
          </select>
          <div className="chat-transfer-actions">
            <button
              type="button"
              className="chat-settings-cancel"
              onClick={() => setIsAssignmentModalOpen(false)}
              disabled={isAssigningConversation}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="chat-settings-save"
              onClick={() => void handleAssignConversation()}
              disabled={isAssigningConversation}
            >
              {isAssigningConversation ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Trocar atendente"
      >
        <div className="chat-transfer-modal">
          <p>Escolha o novo atendente responsavel por este chat ativo.  <br /> <span className="chat-transfer-note">
            * A conversa continuara em andamento e passara a aparecer para o
            novo usuario.
          </span></p>
          
          <label htmlFor="chat-transfer-select">Novo atendente</label>
          <select
            id="chat-transfer-select"
            value={transferUserId}
            onChange={(event) => setTransferUserId(event.target.value)}
            disabled={isTransferringConversation}
          >
            <option value="">Selecione um atendente</option>
            {assignableUsers.map((assignableUser) => (
              <option key={assignableUser.id} value={assignableUser.id}>
                {assignableUser.name}
              </option>
            ))}
          </select>
          <div className="chat-transfer-actions">
            <button
              type="button"
              className="chat-settings-cancel"
              onClick={() => setIsTransferModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="chat-settings-save"
              onClick={() => void handleTransferConversation()}
              disabled={isTransferringConversation}
            >
              {isTransferringConversation
                ? "Transferindo..."
                : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isTemplateDispatchModalOpen}
        onClose={handleCloseTemplateDispatchModal}
        title="Enviar template"
      >
        <div className="chat-template-modal">
          <p>
            Reative esta conversa com um template aprovado pela Meta para voltar a
            enviar mensagens fora da janela de 24 horas.
          </p>

          <div className="chat-template-target">
            <strong>{selectedConversation?.name || "Cliente"}</strong>
            <span>{selectedConversation?.phone || "Telefone nao informado"}</span>
          </div>

          <label className="chat-template-field">
            <span>Numero da Meta</span>
            <select
              value={selectedMetaIntegrationNumberId}
              onChange={(event) => setSelectedMetaIntegrationNumberId(event.target.value)}
              disabled={loadingMetaIntegrationNumbers || dispatchingMetaTemplate}
            >
              <option value="">
                {loadingMetaIntegrationNumbers
                  ? "Carregando numeros..."
                  : "Selecione um numero"}
              </option>
              {availableMetaIntegrationNumbers.map((account) => (
                <option key={String(account.id || "")} value={String(account.id || "")}>
                  {account.display_phone_number || account.phone_number_id || "Número sem identificação"}
                  {account.verified_name ? ` · ${account.verified_name}` : ""}
                </option>
              ))}
            </select>
          </label>

          {selectedMetaIntegrationNumberId ? (
            <div className="chat-template-quick-suggestions">
              <div className="chat-template-quick-suggestions__header">
                <strong>Atalhos de template</strong>
                <span>
                  Ultimos 5 enviados por este numero, com apoio dos mais usados quando faltar historico.
                </span>
              </div>

              {loadingMetaTemplateQuickSuggestions ? (
                <div className="chat-template-quick-suggestions__loading">
                  Carregando sugestoes...
                </div>
              ) : normalizedMetaTemplateQuickSuggestions.length ? (
                <div className="chat-template-quick-suggestions__list">
                  {normalizedMetaTemplateQuickSuggestions.map((suggestion) => {
                    const sourceLabel =
                      suggestion.source === "popular" ? "Mais usado" : "Recente";

                    return (
                      <button
                        key={`${suggestion.template_name}-${suggestion.template_language}-${suggestion.source}`}
                        type="button"
                        className={`chat-template-quick-suggestion ${
                          selectedMetaTemplateName === suggestion.template_name
                            ? "is-active"
                            : ""
                        }`}
                        disabled={!suggestion.isAvailable || dispatchingMetaTemplate}
                        title={
                          suggestion.isAvailable
                            ? `Selecionar template ${suggestion.template_name}`
                            : `Template ${suggestion.template_name} nao esta mais disponivel ou aprovado para este numero.`
                        }
                        onClick={() => {
                          if (!suggestion.isAvailable) return;
                          setMetaTemplateDispatchError("");
                          setSelectedMetaTemplateName(suggestion.template_name || "");
                        }}
                      >
                        <span className="chat-template-quick-suggestion__name">
                          {suggestion.template_name}
                        </span>
                        <span className="chat-template-quick-suggestion__meta">
                          {sourceLabel} · {suggestion.template_language || "pt_BR"} ·{" "}
                          {Number(suggestion.usage_count || 0)}x
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="chat-template-quick-suggestions__empty">
                  Nenhum template sugerido encontrado para este numero ainda.
                </div>
              )}
            </div>
          ) : null}

          {loadingMetaTemplates ? (
            <div className="chat-template-empty">
              <strong>Carregando templates</strong>
              <p>Aguarde enquanto buscamos os templates disponiveis para este numero.</p>
            </div>
          ) : availableMetaTemplates.length ? (
            <>
              <label className="chat-template-field">
                <span>Template</span>
                <select
                  value={selectedMetaTemplateName}
                  onChange={(event) => setSelectedMetaTemplateName(event.target.value)}
                >
                  {availableMetaTemplates.map((template) => (
                    <option key={`${template.name}-${template.language}`} value={String(template.name || "")}>
                      {template.name} · {template.language || "pt_BR"} · {template.status || "sem status"}
                    </option>
                  ))}
                </select>
              </label>

              {selectedMetaTemplate ? (
                <div className="chat-template-summary">
                  <span>
                    Status: {isTemplateApproved(selectedMetaTemplate)
                      ? "Aprovado"
                      : selectedMetaTemplate.status || "Sem status"}
                  </span>
                  <span>Idioma: {selectedMetaTemplate.language || "pt_BR"}</span>
                  {selectedMetaTemplateHints ? (
                    <>
                      <span>Header: {selectedMetaTemplateHints.headerType}</span>
                      <span>
                        Variaveis do body: {selectedMetaTemplateHints.bodyParameterCount}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}

              {selectedMetaTemplateHints?.headerRequiresMedia ? (
                <label className="chat-template-field">
                  <span>Arquivo do header</span>
                  <input
                    type="file"
                    onChange={(event) =>
                      setMetaTemplateHeaderFile(event.target.files?.[0] || null)
                    }
                  />
                </label>
              ) : null}

              {metaTemplateHeaderParameters.length > 0 ? (
                <div className="chat-template-parameter-section">
                  <strong>Parametros do header</strong>
                  <div className="chat-template-parameter-grid">
                    {metaTemplateHeaderParameters.map((currentParameter, index) => (
                      <label key={`chat-template-header-${index}`} className="chat-template-field">
                        <span>Header {index + 1}</span>
                        <select
                          value={currentParameter.kind}
                          onChange={(event) => {
                            const nextKind = event.target.value as TemplateParameterKind;
                            handleMetaTemplateHeaderParameterChange(index, {
                              kind: nextKind,
                              standardField:
                                nextKind === "contact_field"
                                  ? currentParameter.standardField || "contact_name"
                                  : "",
                            });
                          }}
                        >
                          <option value="manual">Valor manual</option>
                          <option value="contact_field">Campo padrao do cliente</option>
                        </select>

                        {currentParameter.kind === "contact_field" ? (
                          <>
                            <select
                              value={currentParameter.standardField}
                              onChange={(event) =>
                                handleMetaTemplateHeaderParameterChange(index, {
                                  standardField:
                                    event.target.value as TemplateParameterStandardField,
                                  nameFormat:
                                    event.target.value === "contact_name"
                                      ? currentParameter.nameFormat
                                      : "full_name",
                                })
                              }
                            >
                              {TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS.map((option) => (
                                <option
                                  key={`chat-template-header-field-${index}-${option.value}`}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>

                            {currentParameter.standardField === "contact_name" ? (
                              <select
                                value={currentParameter.nameFormat}
                                onChange={(event) =>
                                  handleMetaTemplateHeaderParameterChange(index, {
                                    nameFormat:
                                      event.target.value as TemplateParameterNameFormat,
                                  })
                                }
                              >
                                <option value="first_name">Primeiro nome</option>
                                <option value="full_name">Nome completo</option>
                              </select>
                            ) : null}

                            <small className="chat-template-helper">
                              Valor preenchido automaticamente no disparo.
                            </small>
                          </>
                        ) : (
                          <input
                            type="text"
                            value={currentParameter.text}
                            onChange={(event) =>
                              handleMetaTemplateHeaderParameterChange(index, {
                                text: event.target.value,
                              })
                            }
                            placeholder={`Valor do header ${index + 1}`}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {metaTemplateBodyParameters.length > 0 ? (
                <div className="chat-template-parameter-section">
                  <strong>Parametros do body</strong>
                  <div className="chat-template-parameter-grid">
                    {metaTemplateBodyParameters.map((currentParameter, index) => (
                      <label key={`chat-template-body-${index}`} className="chat-template-field">
                        <span>Body {index + 1}</span>
                        <select
                          value={currentParameter.kind}
                          onChange={(event) => {
                            const nextKind = event.target.value as TemplateParameterKind;
                            handleMetaTemplateBodyParameterChange(index, {
                              kind: nextKind,
                              standardField:
                                nextKind === "contact_field"
                                  ? currentParameter.standardField || "contact_name"
                                  : "",
                            });
                          }}
                        >
                          <option value="manual">Valor manual</option>
                          <option value="contact_field">Campo padrao do cliente</option>
                        </select>

                        {currentParameter.kind === "contact_field" ? (
                          <>
                            <select
                              value={currentParameter.standardField}
                              onChange={(event) =>
                                handleMetaTemplateBodyParameterChange(index, {
                                  standardField:
                                    event.target.value as TemplateParameterStandardField,
                                  nameFormat:
                                    event.target.value === "contact_name"
                                      ? currentParameter.nameFormat
                                      : "full_name",
                                })
                              }
                            >
                              {TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS.map((option) => (
                                <option
                                  key={`chat-template-body-field-${index}-${option.value}`}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>

                            {currentParameter.standardField === "contact_name" ? (
                              <select
                                value={currentParameter.nameFormat}
                                onChange={(event) =>
                                  handleMetaTemplateBodyParameterChange(index, {
                                    nameFormat:
                                      event.target.value as TemplateParameterNameFormat,
                                  })
                                }
                              >
                                <option value="first_name">Primeiro nome</option>
                                <option value="full_name">Nome completo</option>
                              </select>
                            ) : null}

                            <small className="chat-template-helper">
                              Valor preenchido automaticamente no disparo.
                            </small>
                          </>
                        ) : (
                          <input
                            type="text"
                            value={currentParameter.text}
                            onChange={(event) =>
                              handleMetaTemplateBodyParameterChange(index, {
                                text: event.target.value,
                              })
                            }
                            placeholder={`Valor do body ${index + 1}`}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedMetaTemplateHints?.buttons.some(
                (button) => button.parameterCount > 0
              ) ? (
                <div className="chat-template-parameter-section">
                  <strong>Parametros dos botoes</strong>
                  <div className="chat-template-button-groups">
                    {selectedMetaTemplateHints.buttons
                      .filter((button) => button.parameterCount > 0)
                      .map((button) => (
                        <div
                          key={`chat-template-button-${button.index}`}
                          className="chat-template-button-group"
                        >
                          <span>
                            Botao {button.index}
                            {button.text ? ` · ${button.text}` : ""}
                          </span>
                          <div className="chat-template-parameter-grid">
                            {(metaTemplateButtonParameters[button.index] || []).map(
                              (currentParameter, parameterIndex) => (
                                <label
                                  key={`chat-template-button-${button.index}-${parameterIndex}`}
                                  className="chat-template-field"
                                >
                                  <span>Parametro {parameterIndex + 1}</span>
                                  <select
                                    value={currentParameter.kind}
                                    onChange={(event) => {
                                      const nextKind = event.target.value as TemplateParameterKind;
                                      handleMetaTemplateButtonParameterChange(
                                        button.index,
                                        parameterIndex,
                                        {
                                          kind: nextKind,
                                          standardField:
                                            nextKind === "contact_field"
                                              ? currentParameter.standardField || "contact_name"
                                              : "",
                                        }
                                      );
                                    }}
                                  >
                                    <option value="manual">Valor manual</option>
                                    <option value="contact_field">Campo padrao do cliente</option>
                                  </select>

                                  {currentParameter.kind === "contact_field" ? (
                                    <>
                                      <select
                                        value={currentParameter.standardField}
                                        onChange={(event) =>
                                          handleMetaTemplateButtonParameterChange(
                                            button.index,
                                            parameterIndex,
                                            {
                                              standardField:
                                                event.target.value as TemplateParameterStandardField,
                                              nameFormat:
                                                event.target.value === "contact_name"
                                                  ? currentParameter.nameFormat
                                                  : "full_name",
                                            }
                                          )
                                        }
                                      >
                                        {TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS.map((option) => (
                                          <option
                                            key={`chat-template-button-field-${button.index}-${parameterIndex}-${option.value}`}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>

                                      {currentParameter.standardField === "contact_name" ? (
                                        <select
                                          value={currentParameter.nameFormat}
                                          onChange={(event) =>
                                            handleMetaTemplateButtonParameterChange(
                                              button.index,
                                              parameterIndex,
                                              {
                                                nameFormat:
                                                  event.target.value as TemplateParameterNameFormat,
                                              }
                                            )
                                          }
                                        >
                                          <option value="first_name">Primeiro nome</option>
                                          <option value="full_name">Nome completo</option>
                                        </select>
                                      ) : null}

                                      <small className="chat-template-helper">
                                        Valor preenchido automaticamente no disparo.
                                      </small>
                                    </>
                                  ) : (
                                    <input
                                      type="text"
                                      value={currentParameter.text}
                                      onChange={(event) =>
                                        handleMetaTemplateButtonParameterChange(
                                          button.index,
                                          parameterIndex,
                                          {
                                            text: event.target.value,
                                          }
                                        )
                                      }
                                      placeholder={`Valor do botao ${button.index}`}
                                    />
                                  )}
                                </label>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              <MetaTemplatePreview
                template={selectedMetaTemplate}
                language={metaTemplateLanguage}
                title="Preview da mensagem"
                className="chat-template-preview"
                headerParameters={metaTemplateHeaderParameters}
                bodyParameters={metaTemplateBodyParameters}
                buttonParameters={metaTemplateButtonParameters}
                headerImageUrl={metaTemplateHeaderPreviewUrl}
                headerFileName={metaTemplateHeaderFile?.name || ""}
              />
            </>
          ) : (
            <div className="chat-template-empty">
              <strong>Nenhum template encontrado</strong>
              <p>Cadastre e aprove um template na integracao Meta antes de usar esta acao.</p>
            </div>
          )}

          {metaTemplateDispatchError ? (
            <p className="chat-template-error">{metaTemplateDispatchError}</p>
          ) : null}

          <div className="chat-template-actions">
            <button
              type="button"
              className="chat-settings-cancel"
              onClick={handleCloseTemplateDispatchModal}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="chat-settings-cancel"
              onClick={() => void loadMetaTemplates(selectedMetaIntegrationNumberId)}
              disabled={loadingMetaTemplates || !selectedMetaIntegrationNumberId}
            >
              Atualizar templates
            </button>
            <button
              type="button"
              className="chat-settings-save"
              onClick={() => void handleDispatchTemplateToConversation()}
              disabled={
                dispatchingMetaTemplate ||
                !availableMetaTemplates.length ||
                !selectedMetaIntegrationNumberId ||
                !selectedMetaTemplate ||
                !isTemplateApproved(selectedMetaTemplate)
              }
            >
              {dispatchingMetaTemplate ? "Disparando..." : "Disparar template"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isProductGalleryOpen}
        onClose={() => setIsProductGalleryOpen(false)}
        title="Galeria"
        size="lg"
      >
        <div className="chat-product-gallery-modal">
          <p className="chat-product-gallery-description">
            Selecione uma ou mais imagens da galeria da empresa para enviar ao
            cliente pelo WhatsApp. As imagens de produto aparecem separadas das
            demais imagens da galeria.
          </p>

          <input
            type="text"
            className="chat-product-gallery-search"
            placeholder="Pesquisar imagem, produto ou origem..."
            value={productImageSearch}
            onChange={(event) => setProductImageSearch(event.target.value)}
          />

          <div className="chat-product-gallery-list">
            {isLoadingGalleryImages ? (
              <p className="chat-product-gallery-feedback">
                Carregando galeria...
              </p>
            ) : filteredGalleryImages.length === 0 ? (
              <p className="chat-product-gallery-feedback">
                Nenhuma imagem foi encontrada.
              </p>
            ) : (
              <>
                {filteredProductGalleryImages.length ? (
                  <section className="chat-product-gallery-product">
                    <div className="chat-product-gallery-product__header">
                      <div>
                        <strong>Imagens de produtos</strong>
                        <p>Fotos vinculadas aos produtos comerciais do funil.</p>
                      </div>
                      <span>
                        {filteredProductGalleryImages.length} imagem
                        {filteredProductGalleryImages.length === 1 ? "" : "ns"}
                      </span>
                    </div>

                    <div className="chat-product-gallery-grid">
                      {filteredProductGalleryImages.map((image) => {
                        const selected = selectedGalleryImageKeys.includes(
                          image.selectionKey
                        );

                        return (
                          <button
                            type="button"
                            key={image.selectionKey}
                            className={`chat-product-gallery-image${
                              selected ? " is-selected" : ""
                            }`}
                            onClick={() =>
                              toggleGalleryImageSelection(image.selectionKey)
                            }
                          >
                            <img
                              src={image.url}
                              alt={image.nome_arquivo || image.referencia_nome || "Imagem de produto"}
                            />
                            <div className="chat-product-gallery-image__meta">
                              <strong>{image.referencia_nome || "Produto comercial"}</strong>
                              <span>{image.nome_arquivo}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {filteredCompanyGalleryImages.length ? (
                  <section className="chat-product-gallery-product">
                    <div className="chat-product-gallery-product__header">
                      <div>
                        <strong>Outras imagens da galeria</strong>
                        <p>Imagens salvas diretamente na galeria da empresa.</p>
                      </div>
                      <span>
                        {filteredCompanyGalleryImages.length} imagem
                        {filteredCompanyGalleryImages.length === 1 ? "" : "ns"}
                      </span>
                    </div>

                    <div className="chat-product-gallery-grid">
                      {filteredCompanyGalleryImages.map((image) => {
                        const selected = selectedGalleryImageKeys.includes(
                          image.selectionKey
                        );

                        return (
                          <button
                            type="button"
                            key={image.selectionKey}
                            className={`chat-product-gallery-image${
                              selected ? " is-selected" : ""
                            }`}
                            onClick={() =>
                              toggleGalleryImageSelection(image.selectionKey)
                            }
                          >
                            <img
                              src={image.url}
                              alt={image.nome_arquivo || "Imagem da galeria"}
                            />
                            <div className="chat-product-gallery-image__meta">
                              <strong>{image.nome_arquivo}</strong>
                              <span>{image.origem || "galeria_empresa"}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>

          <textarea
            className="chat-product-gallery-caption"
            rows={3}
            placeholder="Observacao opcional para complementar a legenda automatica da primeira imagem..."
            value={productImageCaption}
            onChange={(event) => setProductImageCaption(event.target.value)}
          />
          <span className="chat-product-gallery-selection">
              {selectedGalleryImageKeys.length} image
              {selectedGalleryImageKeys.length === 1 ? "" : "ns"} selecionada
              {selectedGalleryImageKeys.length === 1 ? "" : "s"}
            </span>

          <div className="chat-product-gallery-actions">
            <button
              type="button"
              className="chat-settings-cancel"
              onClick={() => setIsProductGalleryOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="chat-settings-save"
              onClick={() => void handleSendCommercialProductImages()}
              disabled={
                isSendingGalleryImages ||
                selectedGalleryImageKeys.length === 0
              }
            >
              {isSendingGalleryImages
                ? "Enviando..."
                : "Enviar imagens"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDocumentGalleryOpen}
        onClose={() => setIsDocumentGalleryOpen(false)}
        title="Documentos"
        size="lg"
      >
        <div className="chat-product-gallery-modal">
          <p className="chat-product-gallery-description">
            Selecione um ou mais documentos para enviar ao cliente pelo WhatsApp.
            Os documentos de produtos aparecem separados dos documentos salvos na
            galeria e vinculados as mensagens rapidas.
          </p>

          <input
            type="text"
            className="chat-product-gallery-search"
            placeholder="Pesquisar documento, produto ou origem..."
            value={productDocumentSearch}
            onChange={(event) => setProductDocumentSearch(event.target.value)}
          />

          <div className="chat-product-gallery-list">
            {isLoadingGalleryDocuments ? (
              <p className="chat-product-gallery-feedback">
                Carregando documentos...
              </p>
            ) : filteredGalleryDocuments.length === 0 ? (
              <p className="chat-product-gallery-feedback">
                Nenhum documento foi encontrado.
              </p>
            ) : (
              <>
                {filteredProductGalleryDocuments.length ? (
                  <section className="chat-product-gallery-product">
                    <div className="chat-product-gallery-product__header">
                      <div>
                        <strong>Documentos de produtos</strong>
                        <p>PDFs vinculados aos produtos comerciais do funil.</p>
                      </div>
                      <span>
                        {filteredProductGalleryDocuments.length} documento
                        {filteredProductGalleryDocuments.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="chat-document-gallery-grid">
                      {filteredProductGalleryDocuments.map((document) => {
                        const selected = selectedGalleryDocumentKeys.includes(
                          document.selectionKey
                        );

                        return (
                          <button
                            type="button"
                            key={document.selectionKey}
                            className={`chat-document-gallery-card${
                              selected ? " is-selected" : ""
                            }`}
                            onClick={() =>
                              toggleGalleryDocumentSelection(document.selectionKey)
                            }
                          >
                            <div className="chat-document-gallery-card__icon">PDF</div>
                            <div className="chat-document-gallery-card__meta">
                              <strong>{document.referencia_nome || "Produto comercial"}</strong>
                              <span>{document.nome_arquivo}</span>
                              <small>{document.origem || "produto_comercial_documento"}</small>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {filteredCompanyGalleryDocuments.length ? (
                  <section className="chat-product-gallery-product">
                    <div className="chat-product-gallery-product__header">
                      <div>
                        <strong>Outros documentos salvos</strong>
                        <p>Documentos da galeria da empresa e das mensagens rapidas.</p>
                      </div>
                      <span>
                        {filteredCompanyGalleryDocuments.length} documento
                        {filteredCompanyGalleryDocuments.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="chat-document-gallery-grid">
                      {filteredCompanyGalleryDocuments.map((document) => {
                        const selected = selectedGalleryDocumentKeys.includes(
                          document.selectionKey
                        );

                        return (
                          <button
                            type="button"
                            key={document.selectionKey}
                            className={`chat-document-gallery-card${
                              selected ? " is-selected" : ""
                            }`}
                            onClick={() =>
                              toggleGalleryDocumentSelection(document.selectionKey)
                            }
                          >
                            <div className="chat-document-gallery-card__icon">PDF</div>
                            <div className="chat-document-gallery-card__meta">
                              <strong>{document.nome_arquivo}</strong>
                              <span>{document.referencia_nome || "Galeria da empresa"}</span>
                              <small>{document.origem || "galeria_empresa_documento"}</small>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>

          <textarea
            className="chat-product-gallery-caption"
            rows={3}
            placeholder="Legenda opcional para o primeiro documento..."
            value={productDocumentCaption}
            onChange={(event) => setProductDocumentCaption(event.target.value)}
          />

          <div className="chat-product-gallery-actions">
            <span className="chat-product-gallery-selection">
              {selectedGalleryDocumentKeys.length} documento
              {selectedGalleryDocumentKeys.length === 1 ? "" : "s"} selecionado
              {selectedGalleryDocumentKeys.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="chat-settings-cancel"
              onClick={() => setIsDocumentGalleryOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="chat-settings-save"
              onClick={() => void handleSendCommercialProductDocuments()}
              disabled={
                isSendingGalleryDocuments ||
                selectedGalleryDocumentKeys.length === 0
              }
            >
              {isSendingGalleryDocuments
                ? "Enviando..."
                : "Enviar documentos"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="Configurações de atendimento"
      >
        <div className="chat-settings-modal">
          <div className="chat-settings-row">
            <div>
              <h3>Lista de espera atribuída pelo adm</h3>
              <p>
                Quando ativado, os atendimentos em espera só aparecem para o
                usuário escolhido pelo administrador.
              </p>
            </div>
            <label className="chat-toggle">
              <input
                type="checkbox"
                checked={settingsDraft.atendimento_lista_atribuida_adm}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    atendimento_lista_atribuida_adm: event.target.checked,
                    atendimento_fila_automatica_ativa: event.target.checked
                      ? false
                      : prev.atendimento_fila_automatica_ativa,
                  }))
                }
              />
              <span className="chat-toggle-slider" />
            </label>
          </div>

          <div className="chat-settings-row">
            <div>
              <h3>Fila automática de leads</h3>
              <p>
                Novos leads que entrarem no chat serão distribuídos em ordem
                para os atendentes abaixo e aparecerão na aba de aguardando de
                cada responsável.
              </p>
            </div>
            <label className="chat-toggle">
              <input
                type="checkbox"
                checked={settingsDraft.atendimento_fila_automatica_ativa}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    atendimento_lista_atribuida_adm: event.target.checked
                      ? false
                      : prev.atendimento_lista_atribuida_adm,
                    atendimento_fila_automatica_ativa: event.target.checked,
                  }))
                }
              />
              <span className="chat-toggle-slider" />
            </label>
          </div>

          <div className="chat-settings-queue-panel">
            <div className="chat-settings-queue-panel__header">
              <div>
                <h3>Ordem da fila</h3>
                <p>
                  Escolha quem pode receber novos leads e ajuste a sequência do
                  round-robin.
                </p>
              </div>
              <span>
                {settingsDraft.atendimento_fila_usuarios.length} atendente
                {settingsDraft.atendimento_fila_usuarios.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="chat-settings-queue-adder">
              <select
                value={queueCandidateUserId}
                onChange={(event) => setQueueCandidateUserId(event.target.value)}
                disabled={!availableQueueUsers.length}
              >
                <option value="">Selecione um atendente</option>
                {availableQueueUsers.map((assignableUser) => (
                  <option key={assignableUser.id} value={assignableUser.id}>
                    {assignableUser.name}
                    {assignableUser.is_master ? " (adm)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="chat-settings-save"
                onClick={handleAddQueueUser}
                disabled={!queueCandidateUserId}
              >
                Adicionar
              </button>
            </div>

            {queueUsersInDraft.length ? (
              <div className="chat-settings-queue-list">
                {queueUsersInDraft.map((queueUser, index) => (
                  <div className="chat-settings-queue-item" key={queueUser.id}>
                    <div className="chat-settings-queue-item__info">
                      <strong>
                        {index + 1}. {queueUser.name}
                      </strong>
                      <span>
                        {queueUser.is_master
                          ? "Administrador"
                          : "Atendente da fila"}
                      </span>
                    </div>
                    <div className="chat-settings-queue-item__actions">
                      <button
                        type="button"
                        className="chat-settings-cancel"
                        onClick={() => handleMoveQueueUser(queueUser.id, -1)}
                        disabled={index === 0}
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        className="chat-settings-cancel"
                        onClick={() => handleMoveQueueUser(queueUser.id, 1)}
                        disabled={index === queueUsersInDraft.length - 1}
                      >
                        Descer
                      </button>
                      <button
                        type="button"
                        className="chat-settings-cancel"
                        onClick={() => handleRemoveQueueUser(queueUser.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="chat-settings-queue-empty">
                Nenhum atendente foi adicionado à fila ainda.
              </p>
            )}
          </div>

          <div className="chat-settings-row">
            <div>
              <h3>Ativar mensagens rápidas</h3>
              <p>
                Permite que os atendentes usem atalhos com comando `/` durante
                o atendimento.
              </p>
            </div>
            <label className="chat-toggle">
              <input
                type="checkbox"
                checked={settingsDraft.atendimento_mensagens_rapidas_ativas}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    atendimento_mensagens_rapidas_ativas: event.target.checked,
                  }))
                }
              />
              <span className="chat-toggle-slider" />
            </label>
          </div>

          <div className="chat-settings-row">
            <div>
              <h3>Disparo de NPS</h3>
              <p>
                Define se o link de avaliação NPS será enviado automaticamente
                após a finalização do atendimento.
              </p>
            </div>
            <label className="chat-toggle">
              <input
                type="checkbox"
                checked={settingsDraft.atendimento_disparo_nps_ativo}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    atendimento_disparo_nps_ativo: event.target.checked,
                  }))
                }
              />
              <span className="chat-toggle-slider" />
            </label>
          </div>

          <div className="chat-settings-actions">
            <button
              type="button"
              className="chat-settings-cancel"
              onClick={() => setIsSettingsModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="chat-settings-save"
              onClick={() => void handleSaveSettings()}
              disabled={isSavingSettings}
            >
              {isSavingSettings ? "Salvando..." : "Salvar configurações"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        title="Retomar Atendimento Finalizado"
      >
        <div className="confirm-modal-content">
          <p>
            Se você iniciar uma conversa com status "FINALIZADA" você terá
            custos adicionais devido às políticas da META. Deseja realmente
            retomar essa conversa?
          </p>
          <div className="confirm-modal-actions">
            <button
              className="cancel-button"
              onClick={() => setIsResumeModalOpen(false)}
            >
              Cancelar
            </button>
            <button className="delete-button" onClick={handleConfirmResumeChat}>
              Sim, Retomar Atendimento
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isIaModalOpen}
        onClose={() => setIsIaModalOpen(false)}
        title="Análise de atendimento via IA"
        size="lg"
      >
        <div className="ia-analysis-modal-content">
          {isAnalyzingIa && <p>Analisando atendimento...</p>}

          {!isAnalyzingIa && iaAnalysisError && (
            <p className="ia-analysis-error">{iaAnalysisError}</p>
          )}

          {!isAnalyzingIa && !iaAnalysisError && iaAnalysisResult?.analise && (
            <div className="ia-analysis-result">
              <p>
                <strong>Cliente:</strong>{" "}
                {iaAnalysisResult.cliente?.nome || "Não informado"}
              </p>
              <p>
                <strong>Atendente:</strong>{" "}
                {iaAnalysisResult.atendente?.nome || "Não identificado"}
              </p>
              <p>
                <strong>Nota final:</strong>{" "}
                {Number(iaAnalysisResult.analise.nota_final || 0).toFixed(1)}
              </p>
              {iaAnalysisResult.analise.precisa_contexto_minimo ? (
                <section>
                  <h4>Contexto mínimo necessário</h4>
                  <p>{iaAnalysisResult.analise.solicitacao_contexto}</p>
                </section>
              ) : (
                <>
                  <section>
                    <h4>Notas por etapa do funil</h4>
                    <ul>
                      <li>Abordagem: {iaAnalysisResult.analise.notas_por_etapa.abordagem}</li>
                      <li>Diagnóstico: {iaAnalysisResult.analise.notas_por_etapa.diagnostico}</li>
                      <li>Proposta: {iaAnalysisResult.analise.notas_por_etapa.proposta}</li>
                      <li>Negociação: {iaAnalysisResult.analise.notas_por_etapa.negociacao}</li>
                      <li>Follow-up: {iaAnalysisResult.analise.notas_por_etapa.follow_up}</li>
                      <li>Fechamento: {iaAnalysisResult.analise.notas_por_etapa.fechamento}</li>
                      <li>Pós-venda: {iaAnalysisResult.analise.notas_por_etapa.pos_venda}</li>
                    </ul>
                  </section>

                  <section>
                    <h4>KPIs comerciais</h4>
                    <ul>
                      {iaAnalysisResult.analise.kpis_comerciais.map((item, index) => (
                        <li key={`kpi-${index}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h4>Diagnóstico executivo dos gargalos</h4>
                    <ul>
                      {iaAnalysisResult.analise.diagnostico_gargalos.map((item, index) => (
                        <li key={`gargalo-${index}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h4>Risco e avanço</h4>
                    <p>
                      <strong>Risco de perda:</strong> {iaAnalysisResult.analise.risco_perda}
                    </p>
                    <p>
                      <strong>Probabilidade de avanço:</strong>{" "}
                      {iaAnalysisResult.analise.probabilidade_avanco}
                    </p>
                    <p>
                      <strong>Próxima etapa recomendada:</strong>{" "}
                      {iaAnalysisResult.analise.proxima_etapa_recomendada}
                    </p>
                  </section>

                  <section>
                    <h4>Ajustes finos</h4>
                    <ul>
                      {iaAnalysisResult.analise.ajustes_finos.map((item, index) => (
                        <li key={`ajuste-${index}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h4>Boas práticas para reforçar</h4>
                    <ul>
                      {iaAnalysisResult.analise.boas_praticas_reforcar.map((item, index) => (
                        <li key={`boa-pratica-${index}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h4>Script de sugestão imediato</h4>
                    <ul>
                      {iaAnalysisResult.analise.script_sugestao_imediato.map((item, index) => (
                        <li key={`script-imediato-${index}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h4>Script completo para nota 10</h4>
                    <ul>
                      {iaAnalysisResult.analise.script_completo_nota_10.map((item, index) => (
                        <li key={`script-completo-${index}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isAssistModalOpen}
        onClose={() => setIsAssistModalOpen(false)}
        title="Auxílio de conversão via IA"
        size="lg"
      >
        <div className="ia-analysis-modal-content">
          {isLoadingAssistIa && <p>Gerando assistência de conversão...</p>}

          {!isLoadingAssistIa && assistIaError && (
            <p className="ia-analysis-error">{assistIaError}</p>
          )}

          {!isLoadingAssistIa && !assistIaError && assistIaResult?.assistencia && (
            <div className="ia-analysis-result">
              <p>
                <strong>Cliente:</strong>{" "}
                {assistIaResult.cliente?.nome || "Não informado"}
              </p>
              <p>
                <strong>Atendente:</strong>{" "}
                {assistIaResult.atendente?.nome || "Não identificado"}
              </p>
              {assistIaResult.crm?.crm_nome && (
                <p>
                  <strong>Funil atual:</strong> {assistIaResult.crm.crm_nome} /{" "}
                  {assistIaResult.crm.etapa_nome || "Sem etapa"}
                </p>
              )}
              <p>
                <strong>Resumo da situação:</strong>{" "}
                {assistIaResult.assistencia.resumo_situacao}
              </p>
              <p>
                <strong>Estágio atual do funil:</strong>{" "}
                {assistIaResult.assistencia.estagio_funil_atual}
              </p>
              <p>
                <strong>Dor principal:</strong>{" "}
                {assistIaResult.assistencia.dor_principal_cliente}
              </p>
              <p>
                <strong>Objetivo imediato:</strong>{" "}
                {assistIaResult.assistencia.objetivo_imediato_atendente}
              </p>
              <p>
                <strong>Próxima melhor ação:</strong>{" "}
                {assistIaResult.assistencia.proxima_melhor_acao}
              </p>

              <section>
                <h4>Mensagens sugeridas</h4>
                <ul>
                  {assistIaResult.assistencia.mensagens_sugeridas.map((item, index) => (
                    <li key={`msg-sugerida-${index}-${item}`} className="ia-shortcut-item">
                      <span>{item}</span>
                      <button
                        type="button"
                        className="ia-shortcut-send-button"
                        onClick={() => handlePrefillIaShortcutMessage(item)}
                      >
                        Editar no chat
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h4>Perguntas estratégicas</h4>
                <ul>
                  {assistIaResult.assistencia.perguntas_estrategicas.map((item, index) => (
                    <li key={`pergunta-${index}-${item}`} className="ia-shortcut-item">
                      <span>{item}</span>
                      <button
                        type="button"
                        className="ia-shortcut-send-button"
                        onClick={() => handlePrefillIaShortcutMessage(item)}
                      >
                        Editar no chat
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h4>Objeções prováveis</h4>
                <ul>
                  {assistIaResult.assistencia.objecoes_provaveis.map((item, index) => (
                    <li key={`objecao-${index}-${item}`}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h4>Respostas recomendadas para objeções</h4>
                <ul>
                  {assistIaResult.assistencia.respostas_recomendadas_objecoes.map((item, index) => (
                    <li key={`resposta-objecao-${index}-${item}`}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h4>CTA recomendado</h4>
                <p>{assistIaResult.assistencia.cta_recomendado}</p>
              </section>

              <section>
                <h4>Riscos de perda</h4>
                <ul>
                  {assistIaResult.assistencia.riscos_de_perda.map((item, index) => (
                    <li key={`risco-${index}-${item}`}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h4>Produtos recomendados pela IA</h4>
                {assistRecommendedProducts.length ? (
                  <div className="ia-product-recommendations">
                    {assistRecommendedProducts.map((item, index) => (
                      <article
                        key={`produto-recomendado-${index}-${item.nome}`}
                        className="ia-product-card"
                      >
                        <div className="ia-product-card__header">
                          <strong>{item.nome}</strong>
                          <span>
                            {item.preco_referencia !== null
                              ? `R$ ${Number(item.preco_referencia).toFixed(2)}`
                              : "Preço sob consulta"}
                          </span>
                        </div>
                        <p>{item.motivo || "Sem motivo detalhado."}</p>
                        {item.abordagem && (
                          <small>Como vender: {item.abordagem}</small>
                        )}
                        <div className="ia-product-card__actions">
                          <button
                            type="button"
                            className="ia-shortcut-send-button"
                            onClick={() => {
                              appendProductToLiveQuote(item);
                              handleOpenLiveQuoteModal();
                            }}
                          >
                            Adicionar ao orçamento
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>Nenhum produto recomendado pela IA nesta conversa.</p>
                )}
              </section>

              <section>
                <h4>Orçamento ao vivo</h4>
                {assistIaResult.assistencia.rascunho_orcamento?.resumo && (
                  <p>{assistIaResult.assistencia.rascunho_orcamento.resumo}</p>
                )}
                <div className="ia-live-quote-preview">
                  <h5>Resumo atual do orçamento</h5>
                  <p>
                    {liveQuoteItems.length
                      ? `${liveQuoteItems.length} item(ns) montados | Total estimado: R$ ${liveQuoteTotal.toFixed(2)}`
                      : "Nenhum item montado ainda."}
                  </p>
                </div>

                <div className="ia-live-quote-actions">
                  <button
                    type="button"
                    className="ia-shortcut-send-button"
                    onClick={() => handleOpenLiveQuoteModal()}
                  >
                    Abrir modal de orçamento
                  </button>
                </div>

                {liveQuoteIaNotes.length ? (
                  <div className="ia-live-quote-notes">
                    <h5>Observações da IA</h5>
                    <ul>
                      {liveQuoteIaNotes.map((item, index) => (
                        <li key={`quote-note-${index}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isLiveQuoteModalOpen}
        onClose={() => setIsLiveQuoteModalOpen(false)}
        title="Orçamento ao vivo"
        size="lg"
        stackLevel={isAssistModalOpen ? 1 : 0}
      >
        <div className="ia-analysis-modal-content ia-live-quote-modal">
          <div className="ia-live-quote-toolbar">
            <div className="ia-live-quote-toolbar__meta">
              <strong>Cliente:</strong> {selectedConversation?.name || "Não informado"}
            </div>
            {liveQuoteCrmContext?.crmNome && (
              <div className="ia-live-quote-toolbar__meta">
                <strong>Funil:</strong> {liveQuoteCrmContext.crmNome}
                {liveQuoteCrmContext.etapaNome
                  ? ` / ${liveQuoteCrmContext.etapaNome}`
                  : ""}
              </div>
            )}
          </div>

          {liveQuoteCatalogProducts.length > 0 && (
            <div className="ia-quote-catalog">
              <label htmlFor="ia-live-quote-catalog-select">
                Adicionar produto do catálogo
              </label>
              <select
                id="ia-live-quote-catalog-select"
                onChange={(event) => {
                  const value = Number(event.target.value || 0);
                  if (value > 0) {
                    handleAddCatalogProductToQuote(value);
                    event.target.value = "";
                  }
                }}
                defaultValue=""
              >
                <option value="">Selecione um produto</option>
                {liveQuoteCatalogProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.nome} - R$ {Number(product.preco_base || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="ia-live-quote-list">
            {liveQuoteItems.map((item) => (
              <div key={item.key} className="ia-live-quote-item">
                <input
                  type="text"
                  value={item.name}
                  onChange={(event) =>
                    handleUpdateLiveQuoteItem(item.key, "name", event.target.value)
                  }
                  placeholder="Produto"
                />
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) =>
                    handleUpdateLiveQuoteItem(
                      item.key,
                      "quantity",
                      event.target.value,
                    )
                  }
                  placeholder="Qtd"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(event) =>
                    handleUpdateLiveQuoteItem(
                      item.key,
                      "unitPrice",
                      event.target.value,
                    )
                  }
                  placeholder="Preço"
                />
                <button
                  type="button"
                  className="ia-shortcut-send-button ia-shortcut-send-button--danger"
                  onClick={() => handleRemoveLiveQuoteItem(item.key)}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          <div className="ia-live-quote-actions">
            <button
              type="button"
              className="ia-shortcut-send-button"
              onClick={handleAddBlankLiveQuoteItem}
            >
              Adicionar linha
            </button>
          </div>

          <div className="ia-live-quote-summary">
            <label>
              Mensagem de abertura
              <textarea
                value={liveQuoteHeaderMessage}
                onChange={(event) => setLiveQuoteHeaderMessage(event.target.value)}
                placeholder="Ex.: Montei um orçamento inicial para você:"
              />
            </label>
            <label>
              Desconto
              <input
                type="number"
                min="0"
                step="0.01"
                value={liveQuoteDiscount}
                onChange={(event) =>
                  setLiveQuoteDiscount(Number(event.target.value || 0))
                }
              />
            </label>
            <label>
              Observação final / CTA
              <textarea
                value={liveQuoteNotes}
                onChange={(event) => setLiveQuoteNotes(event.target.value)}
                placeholder="Ex.: Posso reservar agora e te enviar o link de pagamento."
              />
            </label>
            <p>
              <strong>Subtotal:</strong> R$ {liveQuoteSubtotal.toFixed(2)}
            </p>
            <p>
              <strong>Total:</strong> R$ {liveQuoteTotal.toFixed(2)}
            </p>
          </div>

          <div className="ia-live-quote-preview">
            <h5>Mensagem pronta do orçamento</h5>
            <pre>{buildQuoteMessage()}</pre>
          </div>

          {liveQuoteIaNotes.length ? (
            <div className="ia-live-quote-notes">
              <h5>Observações da IA</h5>
              <ul>
                {liveQuoteIaNotes.map((item, index) => (
                  <li key={`live-quote-ia-note-${index}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="ia-live-quote-footer">
            <button
              type="button"
              className="ia-live-quote-footer__cancel"
              onClick={() => setIsLiveQuoteModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="ia-live-quote-footer__secondary"
              onClick={() => void handleSaveLiveQuoteToCrm()}
              disabled={!liveQuoteItems.length || !hasLiveQuoteCrm || isSavingLiveQuoteToCrm}
            >
              {isSavingLiveQuoteToCrm ? "Salvando..." : "Salvar orçamento no funil"}
            </button>
            <button
              type="button"
              className="ia-live-quote-footer__primary"
              onClick={() => void handleSendLiveQuote()}
              disabled={!liveQuoteItems.length}
            >
              Enviar orçamento ao cliente
            </button>
          </div>

          {!hasLiveQuoteCrm && (
            <p className="ia-live-quote-feedback">
              Este cliente ainda não possui negócio ativo no funil para receber o orçamento.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}




