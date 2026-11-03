import { useCallback, useEffect, useState } from "react";
import {
  FiBriefcase,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiDownload,
  FiGlobe,
  FiHash,
  FiMail,
  FiMapPin,
  FiMessageCircle,
  FiPlus,
  FiPhone,
  FiRefreshCcw,
  FiShoppingBag,
  FiTag,
  FiTrash2,
  FiUpload,
  FiTrendingUp,
  FiUser,
} from "react-icons/fi";
import type { Conversation, Note, Tag } from "../../data/mockData";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { API_BASE } from "../../config/api";
import { encrypt, decrypt } from "../../utils/cripto";
import { sanitizeUserHtml } from "../../utils/sanitizeHtml";
import {
  getCommercialCrms,
  getCommercialDomains,
  type CommercialCrm,
  type CommercialResponsible,
  type CommercialStage,
} from "../../service/commercialService";
import { Modal } from "../common/Modal/Modal";
import "./ContactHistoryModal.css";

type CrmAtendimento = {
  negocio_id?: number | null;
  crm_id?: number | null;
  crm_nome?: string | null;
  etapa_id?: number | null;
  etapa_nome?: string | null;
  titulo?: string | null;
  produto_principal?: string | null;
  responsavel_id?: number | null;
  responsavel_nome?: string | null;
};

type CrmInteracao = {
  id: number;
  tipo_nome?: string | null;
  tipo_codigo?: string | null;
  descricao?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  atendente_nome?: string | null;
  valor?: number | null;
};

type CrmHistorico = {
  id: number;
  titulo?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  criado_em?: string | null;
  atendente_nome?: string | null;
};

type WhatsappAttendance = {
  conversa_id: number;
  status_id: number;
  data_inicio?: string | null;
  data_fim?: string | null;
  atendente_nome?: string | null;
};

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

type ContactHistoryResponse = {
  tags?: Tag[];
  notes?: Note[];
  cliente?: {
    cliente_id?: number;
    nome?: string;
    telefone?: string;
    email?: string;
    origem?: string | null;
    utms?: unknown;
    meta_ads_referral?: Record<string, unknown> | null;
    meta_ads_utm?: Record<string, unknown> | null;
    meta_ads_attributed_at?: string | null;
    data_aniversario?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
    empresa?: string | null;
    cargo?: string | null;
    faturamento?: number | string | null;
  } | null;
  crm?: {
    atendimento?: CrmAtendimento | null;
    interacoes?: CrmInteracao[];
    historico?: CrmHistorico[];
  };
  documentos?: ContactDocument[];
  historico_atendimentos_whatsapp?: WhatsappAttendance[];
};

type ContactHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  contact: Conversation | null;
};

type CrmQuickActionKey = "responsavel" | "pipeline";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatFileSize(value?: number | null) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhatsappStatus(statusId?: number | null) {
  if (Number(statusId) === 1) return "Em andamento";
  if (Number(statusId) === 2) return "Finalizado";
  return "Aguardando";
}

const UTM_LABELS: Record<string, string> = {
  source_id: "ID do anúncio",
  source_type: "Tipo de origem",
  source_url: "Link do anúncio",
  headline: "Título do anúncio",
  body: "Texto do anúncio",
  media_type: "Tipo de mídia",
  image_url: "Imagem",
  video_url: "Vídeo",
  thumbnail_url: "Miniatura",
  ctwa_clid: "ID do clique CTWA",
  utm_source: "Origem",
  source: "Origem",
  utm_medium: "Mídia",
  medium: "Mídia",
  utm_campaign: "Campanha",
  campaign: "Campanha",
  utm_term: "Termo",
  term: "Termo",
  utm_content: "Conteúdo",
  content: "Conteúdo",
  utm_id: "ID",
  url: "URL",
  url_origem: "URL de origem",
  landing_page: "Página de entrada",
  page_url: "URL da página",
  utm_url: "URL da UTM",
  link: "Link",
  valor: "Valor",
};

function normalizeUtmHistory(value: unknown): Record<string, unknown>[] {
  if (value === null || value === undefined || value === "") return [];

  if (typeof value === "string") {
    try {
      return normalizeUtmHistory(JSON.parse(value));
    } catch {
      return [{ valor: value }];
    }
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeUtmHistory(item));
  }

  if (typeof value === "object") {
    return [value as Record<string, unknown>];
  }

  return [{ valor: value }];
}

function formatUtmLabel(key: string) {
  return UTM_LABELS[key.toLowerCase()] || key.replaceAll("_", " ");
}

function formatUtmValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ContactHistoryModal({
  isOpen,
  onClose,
  contact,
}: ContactHistoryModalProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<ContactHistoryResponse | null>(null);
  const [activeCrmQuickAction, setActiveCrmQuickAction] =
    useState<CrmQuickActionKey | null>(null);
  const [crmOptions, setCrmOptions] = useState<CommercialCrm[]>([]);
  const [crmTransferStages, setCrmTransferStages] = useState<CommercialStage[]>([]);
  const [selectedTransferCrmId, setSelectedTransferCrmId] = useState<number | "">("");
  const [selectedTransferStageId, setSelectedTransferStageId] = useState<number | "">("");
  const [loadingCrmOptions, setLoadingCrmOptions] = useState(false);
  const [loadingCrmStages, setLoadingCrmStages] = useState(false);
  const [isTransferringCrm, setIsTransferringCrm] = useState(false);
  const [crmResponsibles, setCrmResponsibles] = useState<CommercialResponsible[]>([]);
  const [selectedResponsibleId, setSelectedResponsibleId] = useState<number | "">("");
  const [loadingResponsibleOptions, setLoadingResponsibleOptions] = useState(false);
  const [isUpdatingResponsible, setIsUpdatingResponsible] = useState(false);
  const [contactDocumentFile, setContactDocumentFile] = useState<File | null>(null);
  const [isUploadingContactDocument, setIsUploadingContactDocument] = useState(false);
  const [deletingContactDocumentId, setDeletingContactDocumentId] = useState<number | null>(null);
  const [isDocumentsUploadOpen, setIsDocumentsUploadOpen] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!isOpen || !contact || !user?.empresa_id) {
      setDetails(null);
      return;
    }

    try {
      setLoading(true);
      const payload = await encrypt({
        cliente_id: contact.cliente_id || contact.id,
        empresa_id: user.empresa_id,
      });

      const response = await fetch(
        `${API_BASE}/atendimento/buscar_detalhes_cliente`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        },
      );

      const responseData = await response.json();
      const parsed = (await decrypt(responseData.payload)) as {
        boleano?: boolean;
        obj?: ContactHistoryResponse;
      };

      if (parsed?.boleano && parsed.obj) {
        setDetails(parsed.obj);
      } else {
        setDetails(null);
      }
    } catch (error) {
      console.error("Erro ao buscar histórico do contato:", error);
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [contact, isOpen, user?.empresa_id]);

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails]);

  useEffect(() => {
    setContactDocumentFile(null);
    setDeletingContactDocumentId(null);
    setIsDocumentsUploadOpen(false);
    setActiveCrmQuickAction(null);
  }, [contact?.id, isOpen]);

  const crmAtendimento = details?.crm?.atendimento || null;

  useEffect(() => {
    if (activeCrmQuickAction !== "pipeline" || !crmAtendimento?.negocio_id) return;

    const loadCrms = async () => {
      try {
        setLoadingCrmOptions(true);
        const crms = await getCommercialCrms();
        setCrmOptions(crms);
        setSelectedTransferCrmId(Number(crmAtendimento.crm_id) || "");
      } finally {
        setLoadingCrmOptions(false);
      }
    };

    void loadCrms();
  }, [activeCrmQuickAction, crmAtendimento?.crm_id, crmAtendimento?.negocio_id]);

  useEffect(() => {
    if (activeCrmQuickAction !== "pipeline" || !selectedTransferCrmId) {
      setCrmTransferStages([]);
      setSelectedTransferStageId("");
      return;
    }

    const loadStages = async () => {
      try {
        setLoadingCrmStages(true);
        const domains = await getCommercialDomains(Number(selectedTransferCrmId));
        const stages = Array.isArray(domains?.etapas) ? domains.etapas : [];
        setCrmTransferStages(stages);
        const sameCrm =
          Number(selectedTransferCrmId) === Number(crmAtendimento?.crm_id || 0);
        const fallbackStage =
          (sameCrm
            ? stages.find((stage) => Number(stage.id) === Number(crmAtendimento?.etapa_id || 0))
            : null) ||
          stages.find((stage) => stage.eh_inicial) ||
          stages[0] ||
          null;
        setSelectedTransferStageId(fallbackStage ? Number(fallbackStage.id) : "");
      } finally {
        setLoadingCrmStages(false);
      }
    };

    void loadStages();
  }, [activeCrmQuickAction, crmAtendimento?.crm_id, crmAtendimento?.etapa_id, selectedTransferCrmId]);

  useEffect(() => {
    if (!user?.is_master || !crmAtendimento?.crm_id) {
      setCrmResponsibles([]);
      return;
    }

    const loadResponsibles = async () => {
      try {
        setLoadingResponsibleOptions(true);
        const domains = await getCommercialDomains(Number(crmAtendimento.crm_id));
        setCrmResponsibles(
          Array.isArray(domains?.responsaveis) ? domains.responsaveis : [],
        );
      } finally {
        setLoadingResponsibleOptions(false);
      }
    };

    void loadResponsibles();
  }, [crmAtendimento?.crm_id, user?.is_master]);

  useEffect(() => {
    setSelectedResponsibleId(Number(crmAtendimento?.responsavel_id || 0) || "");
  }, [crmAtendimento?.responsavel_id]);

  if (!contact) return null;

  const tags = details?.tags?.length ? details.tags : contact.tags || [];
  const notes = details?.notes || [];
  const crmInteracoes = details?.crm?.interacoes || [];
  const crmHistorico = details?.crm?.historico || [];
  const contactDocuments = details?.documentos || [];
  const whatsappAttendances = details?.historico_atendimentos_whatsapp || [];
  const origin = details?.cliente?.origem || contact.origem || null;
  const utmHistory = normalizeUtmHistory(details?.cliente?.utms ?? contact.utms);
  const metaAdsReferral = details?.cliente?.meta_ads_referral || null;
  const metaAdsUtm = details?.cliente?.meta_ads_utm || null;
  const metaAdsFields = metaAdsReferral
    ? Object.entries({ ...metaAdsReferral, ...metaAdsUtm }).filter(
        ([key, value]) =>
          key !== "raw" &&
          value !== null &&
          value !== undefined &&
          formatUtmValue(value).trim() !== "",
      )
    : [];
  const birthday =
    details?.cliente?.data_aniversario || contact.birthday || null;
  const company = details?.cliente?.empresa || contact.empresa || null;
  const role = details?.cliente?.cargo || contact.cargo || null;
  const revenue = details?.cliente?.faturamento ?? contact.faturamento ?? null;
  const address = [
    [details?.cliente?.logradouro || contact.logradouro, details?.cliente?.numero || contact.numero]
      .filter(Boolean)
      .join(", "),
    details?.cliente?.complemento || contact.complemento || "",
    details?.cliente?.bairro || contact.bairro || "",
    [
      details?.cliente?.cidade || contact.cidade,
      details?.cliente?.uf || contact.uf,
    ]
      .filter(Boolean)
      .join(" - "),
    details?.cliente?.cep || contact.cep || "",
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" | ");
  const documentLimitReached = contactDocuments.length >= 3;
  const canUploadContactDocument =
    !isUploadingContactDocument && !documentLimitReached && Boolean(contactDocumentFile);
  const remainingDocumentSlots = Math.max(0, 3 - contactDocuments.length);

  const handleTransferCrm = async () => {
    if (!user?.empresa_id || !crmAtendimento?.negocio_id || !selectedTransferCrmId || !selectedTransferStageId) {
      return;
    }

    try {
      setIsTransferringCrm(true);
      const payload = await encrypt({
        empresa_id: user.empresa_id,
        negocio_id: Number(crmAtendimento.negocio_id),
        crm_id: Number(selectedTransferCrmId),
        etapa_id: Number(selectedTransferStageId),
      });
      const response = await fetch(`${API_BASE}/vendas/crm_editar_negocio`, {
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
        throw new Error(parsed?.mensagem || "Não foi possível transferir o atendimento.");
      }
      await fetchDetails();
      setActiveCrmQuickAction(null);
      addToast({
        type: "success",
        title: "Atendimento movido",
        description: "O atendimento foi enviado para o pipeline selecionado.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao mover atendimento",
        description:
          error instanceof Error ? error.message : "Não foi possível mover o atendimento.",
      });
    } finally {
      setIsTransferringCrm(false);
    }
  };

  const handleUpdateResponsible = async () => {
    if (!user?.is_master || !user?.empresa_id || !crmAtendimento?.negocio_id || !selectedResponsibleId) {
      return;
    }

    try {
      setIsUpdatingResponsible(true);
      const payload = await encrypt({
        empresa_id: user.empresa_id,
        negocio_id: Number(crmAtendimento.negocio_id),
        crm_id: Number(crmAtendimento.crm_id),
        ownerId: Number(selectedResponsibleId),
      });
      const response = await fetch(`${API_BASE}/vendas/crm_editar_negocio`, {
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
        throw new Error(parsed?.mensagem || "Não foi possível alterar o responsável.");
      }
      await fetchDetails();
      setActiveCrmQuickAction(null);
      addToast({
        type: "success",
        title: "Responsável atualizado",
        description: "O responsável do funil foi alterado com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao atualizar responsável",
        description:
          error instanceof Error ? error.message : "Não foi possível alterar o responsável.",
      });
    } finally {
      setIsUpdatingResponsible(false);
    }
  };

  const handleToggleCrmQuickAction = (action: CrmQuickActionKey) => {
    setActiveCrmQuickAction((current) => (current === action ? null : action));
  };

  const handleUploadContactDocument = async () => {
    if (!user?.empresa_id || !contact?.cliente_id || !contactDocumentFile) {
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
        cliente_id: contact.cliente_id || contact.id,
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
        throw new Error(parsed?.mensagem || "Nao foi possivel salvar o documento.");
      }

      setContactDocumentFile(null);
      await fetchDetails();
      addToast({
        type: "success",
        title: "Documento salvo",
        description: "O documento foi adicionado ao contato.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao enviar documento",
        description:
          error instanceof Error ? error.message : "Nao foi possivel enviar o documento.",
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
        throw new Error(parsed?.mensagem || "Nao foi possivel remover o documento.");
      }

      await fetchDetails();
      addToast({
        type: "success",
        title: "Documento removido",
        description: "O documento foi removido do contato.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao remover documento",
        description:
          error instanceof Error ? error.message : "Nao foi possivel remover o documento.",
      });
    } finally {
      setDeletingContactDocumentId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Histórico de ${contact.name}`}
      size="lg"
    >
      {loading ? (
        <div className="contact-history-loading">Carregando histórico...</div>
      ) : (
        <div className="contact-history-shell">
          <section className="contact-history-hero">
            <div className="contact-history-identity">
              <h3>{contact.name}</h3>
              <div className="contact-history-contact-grid">
                <span>
                  <FiMail /> {contact.email || "-"}
                </span>
                <span>
                  <FiPhone /> {contact.phone || "-"}
                </span>
                <span>
                  <FiCalendar /> Aniversário: {formatDate(birthday)}
                </span>
                <span>
                  <FiClock /> Cliente desde: {formatDate(contact.data_cadastro)}
                </span>
                <span>
                  <FiBriefcase /> Empresa: {company || "-"}
                </span>
                <span>
                  <FiUser /> Cargo: {role || "-"}
                </span>
                <span>
                  <FiDollarSign /> Faturamento: {revenue !== null ? formatCurrency(Number(revenue)) : "-"}
                </span>
                <span>
                  <FiMapPin /> Endereço: {address || "-"}
                </span>
              </div>
            </div>

            <div className="contact-history-tags">
              {tags.length ? (
                tags.map((tag) => (
                  <span key={tag.id} className="contact-history-tag">
                    <FiTag />
                    {tag.name}
                  </span>
                ))
              ) : (
                <span className="contact-history-empty-chip">Sem tags</span>
              )}
            </div>
          </section>

          <section className="contact-history-kpis">
            <article className="contact-history-kpi contact-history-kpi--money">
              <div className="contact-history-kpi-icon">
                <FiDollarSign />
              </div>
              <div>
                <span>Total gasto</span>
                <strong>{formatCurrency(contact.totalSpent)}</strong>
              </div>
            </article>
            <article className="contact-history-kpi contact-history-kpi--purchases">
              <div className="contact-history-kpi-icon">
                <FiShoppingBag />
              </div>
              <div>
                <span>Compras</span>
                <strong>{Number(contact.totalPurchases || 0)}</strong>
              </div>
            </article>
            <article className="contact-history-kpi contact-history-kpi--ticket">
              <div className="contact-history-kpi-icon">
                <FiHash />
              </div>
              <div>
                <span>Ticket médio</span>
                <strong>{formatCurrency(contact.averageTicket)}</strong>
              </div>
            </article>
            <article className="contact-history-kpi contact-history-kpi--interactions">
              <div className="contact-history-kpi-icon">
                <FiClock />
              </div>
              <div>
                <span>Interações</span>
                <strong>{Number(contact.totalInteractions || 0)}</strong>
              </div>
            </article>
            <article className="contact-history-kpi contact-history-kpi--funnel">
              <div className="contact-history-kpi-icon">
                <FiTrendingUp />
              </div>
              <div>
                <span>Histórico do funil</span>
                <strong>{Number(contact.totalHistoryEntries || 0)}</strong>
              </div>
            </article>
            <article className="contact-history-kpi contact-history-kpi--whatsapp">
              <div className="contact-history-kpi-icon">
                <FiMessageCircle />
              </div>
              <div>
                <span>Atendimentos WhatsApp</span>
                <strong>{Number(contact.totalWhatsappAttendances || 0)}</strong>
              </div>
            </article>
          </section>

          <section className="contact-history-grid">
            <article className="contact-history-section">
              <header>
                <FiGlobe />
                <h4>Origem e UTMs</h4>
              </header>
              <div className="contact-history-origin">
                <span>Origem cadastrada</span>
                <strong>{origin || "Não informada"}</strong>
              </div>
              {metaAdsFields.length ? (
                <div className="contact-history-utm-card">
                  <div className="contact-history-utm-card__header">
                    <strong>Anúncio mais recente</strong>
                    {details?.cliente?.meta_ads_attributed_at ? (
                      <span>{formatDateTime(details.cliente.meta_ads_attributed_at)}</span>
                    ) : null}
                  </div>
                  <div className="contact-history-utm-fields">
                    {metaAdsFields.map(([key, value]) => (
                      <div key={`meta-ad-${key}`} className="contact-history-utm-field">
                        <span>{formatUtmLabel(key)}</span>
                        <strong title={formatUtmValue(value)}>{formatUtmValue(value)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {utmHistory.length ? (
                <div className="contact-history-utm-list">
                  {utmHistory.map((utm, index) => {
                    const receivedAt = formatUtmValue(utm.data_recebimento);
                    const fields = Object.entries(utm).filter(
                      ([key, value]) =>
                        key !== "data_recebimento" &&
                        value !== null &&
                        value !== undefined &&
                        formatUtmValue(value).trim() !== "",
                    );

                    return (
                      <div key={`utm-${index}-${receivedAt}`} className="contact-history-utm-card">
                        <div className="contact-history-utm-card__header">
                          <strong>Registro #{index + 1}</strong>
                          {receivedAt ? <span>{formatDateTime(receivedAt)}</span> : null}
                        </div>
                        <div className="contact-history-utm-fields">
                          {fields.map(([key, value]) => (
                            <div key={`${index}-${key}`} className="contact-history-utm-field">
                              <span>{formatUtmLabel(key)}</span>
                              <strong title={formatUtmValue(value)}>{formatUtmValue(value)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !metaAdsFields.length ? (
                <p className="contact-history-empty">Nenhuma UTM registrada para este contato.</p>
              ) : null}
            </article>

            <article className="contact-history-section">
              <header>
                <FiTrendingUp />
                <h4>Resumo comercial</h4>
              </header>
              {crmAtendimento ? (
                <div className="contact-history-summary-card">
                  <p>
                    <strong>Funil:</strong> {crmAtendimento.crm_nome || "-"}
                  </p>
                  <p>
                    <strong>Etapa:</strong> {crmAtendimento.etapa_nome || "-"}
                  </p>
                  <p>
                    <strong>Título:</strong> {crmAtendimento.titulo || "-"}
                  </p>
                  <p>
                    <strong>Produto:</strong>{" "}
                    {crmAtendimento.produto_principal || "-"}
                  </p>
                  <p>
                    <strong>Responsável:</strong>{" "}
                    {crmAtendimento.responsavel_nome || "-"}
                  </p>
                  <div className="contact-history-crm-quick-actions">
                    {user?.is_master && (
                      <button
                        type="button"
                        className={`contact-history-crm-action-button${
                          activeCrmQuickAction === "responsavel" ? " active" : ""
                        }`}
                        onClick={() => handleToggleCrmQuickAction("responsavel")}
                        title="Atualizar responsavel"
                        aria-label="Atualizar responsavel"
                      >
                        <FiRefreshCcw size={16} />
                        <span>Responsavel</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`contact-history-crm-action-button${
                        activeCrmQuickAction === "pipeline" ? " active" : ""
                      }`}
                      onClick={() => handleToggleCrmQuickAction("pipeline")}
                      title="Transferir pipeline"
                      aria-label="Transferir pipeline"
                    >
                      <FiBriefcase size={16} />
                      <span>Pipeline</span>
                    </button>
                  </div>

                  {user?.is_master && activeCrmQuickAction === "responsavel" && (
                    <div className="contact-history-crm-panel contact-history-crm-panel--responsavel">
                      <label>
                        <span>Responsável no funil</span>
                        <select
                          value={selectedResponsibleId}
                          onChange={(event) =>
                            setSelectedResponsibleId(Number(event.target.value))
                          }
                          disabled={loadingResponsibleOptions || isUpdatingResponsible}
                        >
                          <option value="">
                            {loadingResponsibleOptions
                              ? "Carregando responsáveis..."
                              : "Selecione um responsável"}
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
                        className="contact-history-crm-button contact-history-crm-button--secondary"
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

                  {activeCrmQuickAction === "pipeline" && (
                    <div className="contact-history-crm-panel">
                      <label>
                        <span>Pipeline destino</span>
                        <select
                          value={selectedTransferCrmId}
                          onChange={(event) =>
                            setSelectedTransferCrmId(Number(event.target.value))
                          }
                          disabled={loadingCrmOptions || isTransferringCrm}
                        >
                          <option value="">
                            {loadingCrmOptions
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
                      <label>
                        <span>Etapa destino</span>
                        <select
                          value={selectedTransferStageId}
                          onChange={(event) =>
                            setSelectedTransferStageId(Number(event.target.value))
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
                          {crmTransferStages.map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {stage.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="contact-history-crm-button"
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
                </div>
              ) : (
                <p className="contact-history-empty">
                  Nenhum negócio vinculado no funil.
                </p>
              )}
            </article>

            <article className="contact-history-section">
              <header className="contact-history-section-header contact-history-section-header--documents">
                <div className="contact-history-section-title">
                  <FiFileText />
                  <h4>Documentos do contato</h4>
                </div>
                <button
                  type="button"
                  className={`contact-history-documents-toggle${isDocumentsUploadOpen ? " is-open" : ""}`}
                  onClick={() => setIsDocumentsUploadOpen((current) => !current)}
                >
                  <FiPlus />
                  {isDocumentsUploadOpen ? "Fechar acoes" : "Adicionar documento"}
                  {isDocumentsUploadOpen ? <FiChevronUp /> : <FiChevronDown />}
                </button>
              </header>
              {isDocumentsUploadOpen ? (
                <div className="contact-history-documents-panel">
                  <div className="contact-history-documents-toolbar">
                    <div className="contact-history-documents-summary">
                      <strong>{contactDocuments.length}/3 documentos ativos</strong>
                      <span>
                        {documentLimitReached
                          ? "Limite atingido. Remova um documento para adicionar outro."
                          : `${remainingDocumentSlots} ${remainingDocumentSlots === 1 ? "vaga disponivel" : "vagas disponiveis"} para novos arquivos.`}
                      </span>
                    </div>
                    <p className="contact-history-documents-hint">
                      Envie arquivos de suporte do cliente em um unico lugar. Limite de 20MB por
                      arquivo.
                    </p>
                  </div>
                  <div className="contact-history-documents-upload">
                    <label className="contact-history-documents-picker">
                      <span>Selecionar documento</span>
                      <small>
                        PDF, Office, TXT, ZIP e RAR
                      </small>
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
                    <div className="contact-history-documents-cta">
                      {contactDocumentFile ? (
                        <div className="contact-history-selected-document">
                          <div className="contact-history-selected-document__meta">
                            <strong>{contactDocumentFile.name}</strong>
                            <span>{formatFileSize(contactDocumentFile.size)}</span>
                          </div>
                          <button
                            type="button"
                            className="contact-history-selected-document__clear"
                            onClick={() => setContactDocumentFile(null)}
                            disabled={isUploadingContactDocument}
                          >
                            Trocar arquivo
                          </button>
                        </div>
                      ) : (
                        <div className="contact-history-selected-document contact-history-selected-document--placeholder">
                          Nenhum arquivo selecionado.
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`contact-history-crm-button contact-history-documents-save-button${canUploadContactDocument ? " is-active" : ""}`}
                      onClick={() => void handleUploadContactDocument()}
                      disabled={
                        isUploadingContactDocument ||
                        !contactDocumentFile ||
                        documentLimitReached
                      }
                    >
                      <FiUpload />
                      {isUploadingContactDocument ? "Enviando..." : "Salvar documento"}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="contact-history-list">
                {contactDocuments.length ? (
                  contactDocuments.map((document) => (
                    <div
                      key={`document-${document.id}`}
                      className="contact-history-item contact-history-document-card"
                    >
                      <div className="contact-history-item-head">
                        <strong>{document.nome_arquivo || "Documento"}</strong>
                        <span>{formatDateTime(document.data_criacao)}</span>
                      </div>
                      <div className="contact-history-document-row">
                        <div className="contact-history-document-badges">
                          <span className="contact-history-document-badge">
                            {document.origem || "contato"}
                          </span>
                          <span className="contact-history-document-badge">
                            {formatFileSize(document.tamanho_bytes)}
                          </span>
                        </div>
                        <div className="contact-history-item-meta">
                          <div className="contact-history-document-actions">
                            {document.url ? (
                              <a
                                className="contact-history-document-download"
                                href={document.url}
                                target="_blank"
                                rel="noreferrer"
                                download={document.nome_arquivo || "documento"}
                                title="Baixar documento"
                                aria-label="Baixar documento"
                              >
                                <FiDownload />
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className="contact-history-document-delete"
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
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="contact-history-empty contact-history-empty-documents">
                    Nenhum documento cadastrado. Use a área acima para anexar o primeiro arquivo
                    deste contato.
                  </p>
                )}
              </div>
            </article>

            <article className="contact-history-section">
              <header>
                <FiShoppingBag />
                <h4>Compras e recorrência</h4>
              </header>
              <div className="contact-history-summary-card">
                <p>
                  <strong>Última compra:</strong>{" "}
                  {formatDateTime(contact.lastPurchaseAt)}
                </p>
                <p>
                  <strong>Última interação:</strong>{" "}
                  {formatDateTime(contact.lastInteraction)}
                </p>
                <p>
                  <strong>Último atendimento:</strong>{" "}
                  {formatDateTime(contact.lastWhatsappAttendance)}
                </p>
              </div>
            </article>

            <article className="contact-history-section">
              <header>
                <FiClock />
                <h4>Interações</h4>
              </header>
              <div className="contact-history-list">
                {crmInteracoes.length ? (
                  crmInteracoes.map((item) => (
                    <div key={`interaction-${item.id}`} className="contact-history-item">
                      <div className="contact-history-item-icon contact-history-item-icon--interaction">
                        <FiClock />
                      </div>
                      <div className="contact-history-item-head">
                        <strong>
                          {item.tipo_nome || item.tipo_codigo || "Interação"}
                        </strong>
                        <span>{formatDateTime(item.data_inicio)}</span>
                      </div>
                      <p>{item.descricao || "-"}</p>
                      <div className="contact-history-item-meta">
                        <span>
                          <FiUser /> {item.atendente_nome || "Sistema"}
                        </span>
                        {item.valor !== null && item.valor !== undefined && (
                          <span>{formatCurrency(item.valor)}</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="contact-history-empty">
                    Nenhuma interação registrada.
                  </p>
                )}
              </div>
            </article>

            <article className="contact-history-section">
              <header>
                <FiTrendingUp />
                <h4>Histórico do funil</h4>
              </header>
              <div className="contact-history-list">
                {crmHistorico.length ? (
                  crmHistorico.map((item) => (
                    <div key={`history-${item.id}`} className="contact-history-item">
                      <div className="contact-history-item-icon contact-history-item-icon--funnel">
                        <FiTrendingUp />
                      </div>
                      <div className="contact-history-item-head">
                        <strong>{item.titulo || item.tipo || "Registro"}</strong>
                        <span>{formatDateTime(item.criado_em)}</span>
                      </div>
                      <p>{item.descricao || "-"}</p>
                      <div className="contact-history-item-meta">
                        <span>
                          <FiUser /> {item.atendente_nome || "Sistema"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="contact-history-empty">
                    Nenhum histórico de funil encontrado.
                  </p>
                )}
              </div>
            </article>

            <article className="contact-history-section">
              <header>
                <FiMessageCircle />
                <h4>Atendimentos WhatsApp</h4>
              </header>
              <div className="contact-history-list">
                {whatsappAttendances.length ? (
                  whatsappAttendances.map((item) => (
                    <div key={`attendance-${item.conversa_id}`} className="contact-history-item">
                      <div className="contact-history-item-icon contact-history-item-icon--whatsapp">
                        <FiMessageCircle />
                      </div>
                      <div className="contact-history-item-head">
                        <strong>Atendimento #{item.conversa_id}</strong>
                        <span>{formatDateTime(item.data_inicio)}</span>
                      </div>
                      <p>Status: {formatWhatsappStatus(item.status_id)}</p>
                      <div className="contact-history-item-meta">
                        <span>
                          <FiUser /> {item.atendente_nome || "Não atribuido"}
                        </span>
                        <span>Fim: {formatDateTime(item.data_fim)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="contact-history-empty">
                    Nenhum atendimento WhatsApp registrado.
                  </p>
                )}
              </div>
            </article>

            <article className="contact-history-section">
              <header>
                <FiTag />
                <h4>Anotações internas</h4>
              </header>
              <div className="contact-history-list">
                {notes.length ? (
                  notes.map((note, index) => (
                    <div
                      key={`note-${note.user_id}-${note.createdAt}-${index}`}
                      className="contact-history-item"
                    >
                      <div className="contact-history-item-icon contact-history-item-icon--note">
                        <FiTag />
                      </div>
                      <div className="contact-history-item-head">
                        <strong>{note.author || "Colaborador"}</strong>
                        <span>{note.createdAt || "-"}</span>
                      </div>
                      <div
                        className="contact-history-note-html"
                        dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(note.content || "-") }}
                      />
                    </div>
                  ))
                ) : (
                  <p className="contact-history-empty">
                    Nenhuma anotação cadastrada.
                  </p>
                )}
              </div>
            </article>
          </section>
        </div>
      )}
    </Modal>
  );
}
