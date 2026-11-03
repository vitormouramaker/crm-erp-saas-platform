import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { Conversation } from "../../data/mockData";
import {
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiDollarSign,
  FiDownload,
  FiEdit,
  FiEye,
  FiFileText,
  FiFilter,
  FiInfo,
  FiList,
  FiMail,
  FiMessageCircle,
  FiPhone,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiSend,
  FiTarget,
  FiTrash2,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import { Modal } from "../../components/common/Modal/Modal";
import { ContactForm } from "../../components/ContactForm/ContactForm";
import {
  ContactDirectSaleModal,
  type ContactDirectSaleDraft,
} from "../../components/ContactDirectSaleModal/ContactDirectSaleModal";
import { ContactHistoryModal } from "../../components/ContactHistoryModal/ContactHistoryModal";
import { MetaTemplatePreview } from "../../components/MetaTemplatePreview/MetaTemplatePreview";
import { FinishServiceModal } from "../../components/commercial/Pipeline/FinishServiceModal";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Avatar } from "../../components/common/Avatar/Avatar";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { encrypt, decrypt } from "../../utils/cripto";
import { API_BASE } from "../../config/api";
import { normalizePhoneForWhatsApp } from "../../utils/phone";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { generateColorFromName } from "../../utils/colors";
import { getFirstTwoNames } from "../../utils/string";
import {
  CONTACT_IMPORT_HEADERS,
  CONTACT_IMPORT_SAMPLE_ROW,
  downloadContactImportTemplate,
  parseContactsFromSpreadsheet,
  type ImportedContactRow,
  type ContactImportIssue,
} from "../../utils/importContactsFromSpreadsheet";
import {
  exportContactsWorkbook,
  type ContactExportMode,
} from "../../utils/contactExport";
import {
  addContactToBroadcastList,
  createBroadcastList,
  deleteBroadcastList,
  fetchBroadcastListContacts,
  fetchBroadcastLists,
  fetchBroadcastMetaNumbers,
  fetchContactTags,
  removeContactFromBroadcastList,
  searchContactTags,
  syncBroadcastList,
  updateBroadcastList,
  type BroadcastList,
  type BroadcastListContact,
  type BroadcastUtmFilters,
  type ContactTagOption,
} from "../../service/contactsService";
import {
  createCommercialDeal,
  getCommercialCrms,
  type CommercialCrm,
} from "../../service/commercialService";
import {
  MetaService,
  type MetaIntegrationAccount,
  type MetaTemplateItem,
} from "../../service/metaService";
import {
  MetaAdsService,
  type MetaAdsAccount,
  type MetaAdsFieldMapping,
  type MetaAdsForm,
  type MetaAdsRetrievedLead,
} from "../../service/metaAdsService";
import { useNavigate } from "react-router-dom";
import "react-tooltip/dist/react-tooltip.css";
import "./ContactsPage.css";

type ContactsViewTab = "clients" | "broadcast" | "meta_ads";

type RawTag = {
  id: number;
  name: string;
};

type RawContact = {
  id: number | string;
  cliente_id?: number | string;
  name?: string;
  phone?: string;
  email?: string;
  cpf?: string | null;
  origem?: string | null;
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
  tags?: RawTag[];
  utms?: unknown;
  meta_ads_referral?: unknown;
  meta_ads_utm?: unknown;
  meta_ads_attributed_at?: string | null;
  meta_ads_source_url?: string | null;
  meta_ads_source_type?: string | null;
  meta_ads_source_id?: string | null;
  meta_ads_headline?: string | null;
  meta_ads_body?: string | null;
  meta_ads_media_type?: string | null;
  meta_ads_image_url?: string | null;
  meta_ads_video_url?: string | null;
  meta_ads_thumbnail_url?: string | null;
  meta_ads_ctwa_clid?: string | null;
  meta_ads_message_id?: string | null;
  meta_ads_phone_number_id?: string | null;
  data_cadastro?: string | null;
  data_aniversario?: string | null;
  last_contact?: string | null;
  total_purchases?: number | string | null;
  total_spent?: number | string | null;
  average_ticket?: number | string | null;
  last_purchase_at?: string | null;
  total_interactions?: number | string | null;
  last_interaction?: string | null;
  total_history_entries?: number | string | null;
  total_whatsapp_attendances?: number | string | null;
  last_whatsapp_attendance?: string | null;
  crm_nome?: string | null;
  crm_stage_name?: string | null;
  crm_title?: string | null;
  crm_responsible_name?: string | null;
};

type BroadcastListDraft = {
  nome: string;
  descricao: string;
  metaParamId: string;
  tagLogic: "and" | "or";
  selectedTagIds: number[];
  utmFilters: BroadcastUtmFilters;
};

type ContactsFilterValue = "all" | "birthday_5_days" | "with_crm" | "without_crm";

type ContactListResponse = {
  items?: RawContact[];
  total?: number;
  pagina?: number;
  limite?: number;
  total_paginas?: number;
};

type ContactOriginValue =
  | "manual"
  | "whatsapp"
  | "meta_ads"
  | "importacao"
  | "comercial";

type ContactCompositeFilters = {
  utm: string;
  origem: "" | ContactOriginValue;
  tag_ids: number[];
  data_entrada_inicial: string;
  data_entrada_final: string;
};

type MetaAdsMappingScopeType = "form" | "campaign";
type MetaAdsLeadFilterValue = "all" | "not_imported" | "ready" | "incomplete" | "imported";
type MetaAdsLeadStatus = "imported" | "ready" | "partial" | "critical";

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateInput(value?: string | null) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
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

function formatDateTime(value?: string | null) {
  if (!value) return "Sem registro";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem registro";
  return parsed.toLocaleString("pt-BR");
}

function normalizeContact(raw: RawContact): Conversation {
  const id = toNumber(raw.id);
  const name = String(raw.name || "Cliente");
  return {
    id,
    cliente_id: toNumber(raw.cliente_id ?? raw.id),
    name,
    email: String(raw.email || ""),
    phone: String(raw.phone || ""),
    cpf: String(raw.cpf || ""),
    origem: raw.origem || "manual",
    logradouro: raw.logradouro ? String(raw.logradouro) : null,
    numero: raw.numero ? String(raw.numero) : null,
    complemento: raw.complemento ? String(raw.complemento) : null,
    bairro: raw.bairro ? String(raw.bairro) : null,
    cidade: raw.cidade ? String(raw.cidade) : null,
    uf: raw.uf ? String(raw.uf) : null,
    cep: raw.cep ? String(raw.cep) : null,
    empresa: raw.empresa ? String(raw.empresa) : null,
    cargo: raw.cargo ? String(raw.cargo) : null,
    faturamento:
      raw.faturamento === null || raw.faturamento === undefined || raw.faturamento === ""
        ? null
        : Number(raw.faturamento),
    avatarColor: generateColorFromName(name),
    messages: [],
    status: "finished",
    notes: [],
    attendent: '',
    last_contact: String(raw.last_contact || ""),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    birthday: normalizeDateInput(raw.data_aniversario),
    data_cadastro: raw.data_cadastro || null,
    totalPurchases: toNumber(raw.total_purchases),
    totalSpent: toNumber(raw.total_spent),
    averageTicket: toNumber(raw.average_ticket),
    lastPurchaseAt: raw.last_purchase_at || null,
    totalInteractions: toNumber(raw.total_interactions),
    lastInteraction: raw.last_interaction || null,
    totalHistoryEntries: toNumber(raw.total_history_entries),
    totalWhatsappAttendances: toNumber(raw.total_whatsapp_attendances),
    lastWhatsappAttendance: raw.last_whatsapp_attendance || null,
    crmName: raw.crm_nome || null,
    crmStageName: raw.crm_stage_name || null,
    crmTitle: raw.crm_title || null,
    crmResponsibleName: raw.crm_responsible_name || null,
  };
}

function createBroadcastDraft(list?: BroadcastList | null): BroadcastListDraft {
  return {
    nome: String(list?.nome || ""),
    descricao: String(list?.descricao || ""),
    metaParamId: String(list?.empresa_meta_param_id || ""),
    tagLogic: list?.tag_logic === "and" ? "and" : "or",
    selectedTagIds: Array.isArray(list?.tags) ? list.tags.map((tag) => Number(tag.id)) : [],
    utmFilters: {
      utm_source: String(list?.utm_filters?.utm_source || ""),
      utm_medium: String(list?.utm_filters?.utm_medium || ""),
      utm_campaign: String(list?.utm_filters?.utm_campaign || ""),
      utm_term: String(list?.utm_filters?.utm_term || ""),
      utm_content: String(list?.utm_filters?.utm_content || ""),
      utm_id: String(list?.utm_filters?.utm_id || ""),
    },
  };
}

function normalizeDraftUtmFilters(filters: BroadcastUtmFilters): BroadcastUtmFilters {
  return Object.entries(filters).reduce((acc, [key, value]) => {
    const normalized = String(value || "").trim();
    if (normalized) {
      acc[key as keyof BroadcastUtmFilters] = normalized;
    }
    return acc;
  }, {} as BroadcastUtmFilters);
}

function formatBroadcastOrigin(origin: string) {
  return String(origin || "").toLowerCase() === "manual" ? "Manual" : "Segmento";
}

function normalizeContactOrigin(value?: string | null): ContactOriginValue {
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

function formatContactOrigin(value?: string | null) {
  switch (normalizeContactOrigin(value)) {
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

function createDefaultContactCompositeFilters(): ContactCompositeFilters {
  return {
    utm: "",
    origem: "",
    tag_ids: [],
    data_entrada_inicial: "",
    data_entrada_final: "",
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
          text: String(button?.text || "").trim(),
          type: String(button?.type || "BUTTON").toUpperCase(),
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

function formatMetaIntegrationNumberLabel(account: MetaIntegrationAccount) {
  const phoneLabel = String(
    account.display_phone_number || account.phone_number_id || "Número sem identificação"
  ).trim();
  const verifiedName = String(
    account.verified_name || account.whatsapp_account_name || ""
  ).trim();

  return verifiedName ? `${phoneLabel} · ${verifiedName}` : phoneLabel;
}

function formatBroadcastListMetaLabel(list: BroadcastList) {
  const phoneLabel = String(
    list.meta_display_phone_number || list.meta_phone_number_id || "Número não vinculado"
  ).trim();
  const verifiedName = String(list.meta_verified_name || "").trim();

  return verifiedName ? `${phoneLabel} · ${verifiedName}` : phoneLabel;
}

function normalizeContactCompositeFilters(
  filters: ContactCompositeFilters
): ContactCompositeFilters {
  const normalizedOrigin = String(filters.origem || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const origem =
    normalizedOrigin === "manual" ||
    normalizedOrigin === "whatsapp" ||
    normalizedOrigin === "meta_ads" ||
    normalizedOrigin === "importacao" ||
    normalizedOrigin === "comercial"
      ? (normalizedOrigin as ContactOriginValue)
      : "";

  const tagIds = Array.isArray(filters.tag_ids)
    ? [...new Set(
        filters.tag_ids
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item > 0)
      )]
    : [];

  let dataEntradaInicial = normalizeDateInput(filters.data_entrada_inicial) || "";
  let dataEntradaFinal = normalizeDateInput(filters.data_entrada_final) || "";

  if (dataEntradaInicial && dataEntradaFinal && dataEntradaInicial > dataEntradaFinal) {
    [dataEntradaInicial, dataEntradaFinal] = [dataEntradaFinal, dataEntradaInicial];
  }

  return {
    utm: String(filters.utm || "").trim(),
    origem,
    tag_ids: tagIds,
    data_entrada_inicial: dataEntradaInicial,
    data_entrada_final: dataEntradaFinal,
  };
}

function buildExportFiltersByMode(
  mode: ContactExportMode,
  filters: ContactCompositeFilters
): ContactCompositeFilters {
  const normalized = normalizeContactCompositeFilters(filters);

  if (mode === "date") {
    return normalizeContactCompositeFilters({
      ...createDefaultContactCompositeFilters(),
      data_entrada_inicial: normalized.data_entrada_inicial,
      data_entrada_final: normalized.data_entrada_final,
    });
  }

  if (mode === "tag") {
    return normalizeContactCompositeFilters({
      ...createDefaultContactCompositeFilters(),
      tag_ids: normalized.tag_ids,
    });
  }

  return normalizeContactCompositeFilters({
    ...createDefaultContactCompositeFilters(),
    utm: normalized.utm,
  });
}

function buildContactsExportFilename(mode: ContactExportMode) {
  const dateLabel = new Date().toISOString().slice(0, 10);
  const modeLabel =
    mode === "date" ? "por_data" : mode === "tag" ? "por_tag" : "por_utm";
  return `contatos_${modeLabel}_${dateLabel}.xlsx`;
}

function normalizeMetaAdsFieldKey(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getMetaAdsLeadFieldValue(
  lead: MetaAdsRetrievedLead,
  fieldKey?: string | null
) {
  const normalizedFieldKey = normalizeMetaAdsFieldKey(fieldKey);
  if (!normalizedFieldKey) return null;

  const match = (lead.fields || []).find(
    (field) => normalizeMetaAdsFieldKey(field.key || "") === normalizedFieldKey
  );

  return match?.value || null;
}

function getMetaAdsLeadStatus(lead: MetaAdsRetrievedLead): MetaAdsLeadStatus {
  if (lead.imported) return "imported";

  const hasName = Boolean(String(lead.nome || "").trim());
  const hasPhone = Boolean(String(lead.telefone || "").trim());
  const hasEmail = Boolean(String(lead.email || "").trim());

  if (hasName && hasPhone && hasEmail) return "ready";
  if (!hasName || (!hasPhone && !hasEmail)) return "critical";
  return "partial";
}

function formatMetaAdsLeadStatus(status: MetaAdsLeadStatus) {
  switch (status) {
    case "imported":
      return "Importado";
    case "ready":
      return "Pronto para importar";
    case "partial":
      return "Revisar dados";
    default:
      return "Dados incompletos";
  }
}

function getNextBirthdayDate(value?: string | null) {
  const normalized = normalizeDateInput(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const [, monthText, dayText] = normalized.split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;

  const today = new Date();
  const currentYear = today.getFullYear();

  const buildBirthdayDate = (year: number) => {
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    return new Date(year, month - 1, Math.min(day, lastDayOfMonth));
  };

  const birthdayThisYear = buildBirthdayDate(currentYear);
  birthdayThisYear.setHours(0, 0, 0, 0);

  const todayAtMidnight = new Date(today);
  todayAtMidnight.setHours(0, 0, 0, 0);

  if (birthdayThisYear >= todayAtMidnight) {
    return birthdayThisYear;
  }

  return buildBirthdayDate(currentYear + 1);
}

function formatDateShort(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, month, day] = value.split("-");
    return `${day}/${month}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatDaysUntilLabel(value: number) {
  if (value <= 0) return "Hoje";
  if (value === 1) return "Amanha";
  return `Em ${value} dias`;
}

type ContactSearchInputProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

type DebouncedTextInputProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  delay?: number;
};

const DebouncedTextInput = memo(function DebouncedTextInput({
  value,
  placeholder,
  onChange,
  delay = 300,
}: DebouncedTextInputProps) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextValue = draftValue.trim();

      if (nextValue !== value) {
        onChange(nextValue);
      }
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [delay, draftValue, onChange, value]);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraftValue(event.target.value);
  }, []);

  return (
    <input
      type="text"
      placeholder={placeholder}
      value={draftValue}
      onChange={handleChange}
    />
  );
});

const ContactSearchInput = memo(function ContactSearchInput({
  value,
  placeholder,
  onChange,
}: ContactSearchInputProps) {
  return (
    <div className="search-bar-wrapper">
      <FiSearch className="search-icon" />
      <DebouncedTextInput value={value} placeholder={placeholder} onChange={onChange} />
    </div>
  );
});

export function ContactsPage() {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const toolbarMenusRef = useRef<Array<HTMLDetailsElement | null>>([]);

  const [activeTab, setActiveTab] = useState<ContactsViewTab>("clients");

  const [contacts, setContacts] = useState<Conversation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<ContactsFilterValue>("all");
  const [compositeFilters, setCompositeFilters] = useState<ContactCompositeFilters>(
    createDefaultContactCompositeFilters
  );
  const [contactTagSearchTerm, setContactTagSearchTerm] = useState("");
  const [contactTagOptions, setContactTagOptions] = useState<ContactTagOption[]>([]);
  const [loadingContactTagOptions, setLoadingContactTagOptions] = useState(false);
  const [selectedContactFilterTags, setSelectedContactFilterTags] = useState<ContactTagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshingContacts, setIsRefreshingContacts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalContacts, setTotalContacts] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Conversation | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Conversation | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [contactToDeleteId, setContactToDeleteId] = useState<number | null>(null);
  const [isMobileClientFiltersModalOpen, setIsMobileClientFiltersModalOpen] = useState(false);
  const [isEntryDateFilterModalOpen, setIsEntryDateFilterModalOpen] = useState(false);
  const [entryDateFilterDraft, setEntryDateFilterDraft] = useState({
    data_entrada_inicial: "",
    data_entrada_final: "",
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportGuideModalOpen, setIsImportGuideModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState<ContactExportMode>("date");
  const [exportFilters, setExportFilters] = useState<ContactCompositeFilters>(
    createDefaultContactCompositeFilters
  );
  const [exportTagSearchTerm, setExportTagSearchTerm] = useState("");
  const [debouncedExportTagSearchTerm, setDebouncedExportTagSearchTerm] = useState("");
  const [exportTagOptions, setExportTagOptions] = useState<ContactTagOption[]>([]);
  const [loadingExportTagOptions, setLoadingExportTagOptions] = useState(false);
  const [selectedExportTags, setSelectedExportTags] = useState<ContactTagOption[]>([]);
  const [exportingContacts, setExportingContacts] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ImportedContactRow[]>([]);
  const [importErrors, setImportErrors] = useState<ContactImportIssue[]>([]);
  const [importWarnings, setImportWarnings] = useState<ContactImportIssue[]>([]);
  const [parsingImportFile, setParsingImportFile] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<{
    criados: number;
    atualizados: number;
    ignorados: number;
    erros: Array<{ linha: number; mensagem: string }>;
  } | null>(null);

  const [broadcastLists, setBroadcastLists] = useState<BroadcastList[]>([]);
  const [loadingBroadcastLists, setLoadingBroadcastLists] = useState(false);
  const [availableTags, setAvailableTags] = useState<ContactTagOption[]>([]);
  const [selectedBroadcastListId, setSelectedBroadcastListId] = useState<number | null>(null);
  const [broadcastDraft, setBroadcastDraft] = useState<BroadcastListDraft>(
    createBroadcastDraft()
  );
  const [broadcastListContacts, setBroadcastListContacts] = useState<BroadcastListContact[]>([]);
  const [broadcastListContactSearchTerm, setBroadcastListContactSearchTerm] = useState("");
  const [loadingBroadcastContacts, setLoadingBroadcastContacts] = useState(false);
  const [savingBroadcastList, setSavingBroadcastList] = useState(false);
  const [syncingBroadcastList, setSyncingBroadcastList] = useState(false);
  const [removingBroadcastContactId, setRemovingBroadcastContactId] = useState<number | null>(
    null
  );
  const [isCreateBroadcastListModalOpen, setIsCreateBroadcastListModalOpen] = useState(false);
  const [creatingBroadcastList, setCreatingBroadcastList] = useState(false);
  const [newBroadcastListName, setNewBroadcastListName] = useState("");
  const [newBroadcastListDescription, setNewBroadcastListDescription] = useState("");
  const [newBroadcastListMetaParamId, setNewBroadcastListMetaParamId] = useState("");
  const [isAddToListModalOpen, setIsAddToListModalOpen] = useState(false);
  const [isMobileBroadcastListsModalOpen, setIsMobileBroadcastListsModalOpen] = useState(false);
  const [selectedContactForBroadcast, setSelectedContactForBroadcast] =
    useState<Conversation | null>(null);
  const [isAddContactToSelectedListModalOpen, setIsAddContactToSelectedListModalOpen] =
    useState(false);
  const [broadcastContactSearchTerm, setBroadcastContactSearchTerm] = useState("");
  const [debouncedBroadcastContactSearchTerm, setDebouncedBroadcastContactSearchTerm] =
    useState("");
  const [broadcastContactSearchResults, setBroadcastContactSearchResults] = useState<
    Conversation[]
  >([]);
  const [loadingBroadcastContactSearch, setLoadingBroadcastContactSearch] = useState(false);
  const [selectedBroadcastContactsToAdd, setSelectedBroadcastContactsToAdd] = useState<
    Conversation[]
  >([]);
  const [expandedBroadcastMobileCards, setExpandedBroadcastMobileCards] = useState<
    Record<number, boolean>
  >({});
  const [selectedTargetBroadcastListId, setSelectedTargetBroadcastListId] = useState<
    number | null
  >(null);
  const [addingContactToBroadcastList, setAddingContactToBroadcastList] = useState(false);
  const [isTemplateDispatchModalOpen, setIsTemplateDispatchModalOpen] = useState(false);
  const [selectedContactForTemplateDispatch, setSelectedContactForTemplateDispatch] =
    useState<Conversation | null>(null);
  const [isContactDirectSaleModalOpen, setIsContactDirectSaleModalOpen] = useState(false);
  const [selectedContactForDirectSale, setSelectedContactForDirectSale] =
    useState<Conversation | null>(null);
  const [pendingContactDirectSale, setPendingContactDirectSale] =
    useState<ContactDirectSaleDraft | null>(null);
  const [savingDirectContactSale, setSavingDirectContactSale] = useState(false);
  const [availableMetaIntegrationNumbers, setAvailableMetaIntegrationNumbers] = useState<
    MetaIntegrationAccount[]
  >([]);
  const [loadingMetaIntegrationNumbers, setLoadingMetaIntegrationNumbers] = useState(false);
  const [selectedMetaIntegrationNumberId, setSelectedMetaIntegrationNumberId] = useState("");
  const [availableMetaTemplates, setAvailableMetaTemplates] = useState<MetaTemplateItem[]>([]);
  const [loadingMetaTemplates, setLoadingMetaTemplates] = useState(false);
  const [dispatchingMetaTemplate, setDispatchingMetaTemplate] = useState(false);
  const [selectedMetaTemplateName, setSelectedMetaTemplateName] = useState("");
  const [metaTemplateLanguage, setMetaTemplateLanguage] = useState("pt_BR");
  const [metaTemplateHeaderParameters, setMetaTemplateHeaderParameters] = useState<
    TemplateParameterInput[]
  >([]);
  const [metaTemplateBodyParameters, setMetaTemplateBodyParameters] = useState<
    TemplateParameterInput[]
  >([]);
  const [metaTemplateButtonParameters, setMetaTemplateButtonParameters] = useState<
    Record<number, TemplateParameterInput[]>
  >({});
  const [metaTemplateHeaderFile, setMetaTemplateHeaderFile] = useState<File | null>(null);
  const [metaTemplateHeaderPreviewUrl, setMetaTemplateHeaderPreviewUrl] = useState("");
  const [metaTemplateDispatchError, setMetaTemplateDispatchError] = useState("");
  const [upcomingBirthdayContacts, setUpcomingBirthdayContacts] = useState<Conversation[]>([]);
  const [upcomingBirthdayTotal, setUpcomingBirthdayTotal] = useState(0);
  const [isBirthdayHighlightExpanded, setIsBirthdayHighlightExpanded] = useState(false);
  const [metaAdsAccounts, setMetaAdsAccounts] = useState<MetaAdsAccount[]>([]);
  const [metaAdsCrms, setMetaAdsCrms] = useState<CommercialCrm[]>([]);
  const [loadingMetaAdsCrms, setLoadingMetaAdsCrms] = useState(false);
  const [loadingMetaAdsAccounts, setLoadingMetaAdsAccounts] = useState(false);
  const [selectedMetaAdsCrmId, setSelectedMetaAdsCrmId] = useState("");
  const [selectedMetaAdsAccountId, setSelectedMetaAdsAccountId] = useState("");
  const [metaAdsForms, setMetaAdsForms] = useState<MetaAdsForm[]>([]);
  const [metaAdsFormsAccountId, setMetaAdsFormsAccountId] = useState("");
  const [loadingMetaAdsForms, setLoadingMetaAdsForms] = useState(false);
  const [selectedMetaAdsFormId, setSelectedMetaAdsFormId] = useState("");
  const [isMobileMetaAdsFormsModalOpen, setIsMobileMetaAdsFormsModalOpen] = useState(false);
  const [metaAdsLeads, setMetaAdsLeads] = useState<MetaAdsRetrievedLead[]>([]);
  const [loadingMetaAdsLeads, setLoadingMetaAdsLeads] = useState(false);
  const [selectedMetaAdsLeadIds, setSelectedMetaAdsLeadIds] = useState<string[]>([]);
  const [metaAdsLeadSearchTerm, setMetaAdsLeadSearchTerm] = useState("");
  const [metaAdsLeadFilter, setMetaAdsLeadFilter] = useState<MetaAdsLeadFilterValue>("all");
  const [importingMetaAdsLeads, setImportingMetaAdsLeads] = useState(false);
  const [metaAdsMappingScopeType, setMetaAdsMappingScopeType] =
    useState<MetaAdsMappingScopeType>("form");
  const [selectedMetaAdsCampaignMappingId, setSelectedMetaAdsCampaignMappingId] =
    useState("");
  const [metaAdsFieldMapping, setMetaAdsFieldMapping] = useState<MetaAdsFieldMapping | null>(
    null
  );
  const [loadingMetaAdsFieldMapping, setLoadingMetaAdsFieldMapping] = useState(false);
  const [savingMetaAdsFieldMapping, setSavingMetaAdsFieldMapping] = useState(false);
  const [metaAdsTabLoading, setMetaAdsTabLoading] = useState(true);
  const metaAdsFormsRequestRef = useRef(0);
  const metaAdsLeadsRequestRef = useRef(0);
  const contactsRequestRef = useRef(0);
  const contactsLoadedRef = useRef(false);
  const contactsCacheRef = useRef<
    Record<string, { items: Conversation[]; total: number }>
  >({});

  const ITEMS_PER_PAGE = 12;
  const UPCOMING_BIRTHDAY_LIMIT = 8;
  const MAX_VISIBLE_TAGS = 3;
  const normalizedCompositeFilters = useMemo(
    () => normalizeContactCompositeFilters(compositeFilters),
    [compositeFilters]
  );
  const normalizedExportFilters = useMemo(
    () => buildExportFiltersByMode(exportMode, exportFilters),
    [exportFilters, exportMode]
  );
  const hasCompositeFilters = useMemo(
    () =>
      Boolean(
        normalizedCompositeFilters.utm ||
          normalizedCompositeFilters.origem ||
          normalizedCompositeFilters.tag_ids.length > 0 ||
          normalizedCompositeFilters.data_entrada_inicial ||
          normalizedCompositeFilters.data_entrada_final
      ),
    [normalizedCompositeFilters]
  );
  const hasAnyClientFilters =
    Boolean(searchTerm.trim()) || selectedFilter !== "all" || hasCompositeFilters;
  const canRegisterDirectSale = hasPermission("commercial.view");
  const activeClientAdvancedFilterCount = useMemo(() => {
    let count = 0;

    if (selectedFilter !== "all") count += 1;
    if (normalizedCompositeFilters.utm) count += 1;
    if (normalizedCompositeFilters.origem) count += 1;
    if (normalizedCompositeFilters.tag_ids.length) count += 1;
    if (
      normalizedCompositeFilters.data_entrada_inicial ||
      normalizedCompositeFilters.data_entrada_final
    ) {
      count += 1;
    }

    return count;
  }, [normalizedCompositeFilters, selectedFilter]);
  const activeClientMoreFilterCount = useMemo(() => {
    let count = 0;

    if (normalizedCompositeFilters.utm) count += 1;
    if (normalizedCompositeFilters.tag_ids.length) count += 1;

    return count;
  }, [normalizedCompositeFilters]);
  const entryDateFilterLabel = useMemo(() => {
    const start = normalizedCompositeFilters.data_entrada_inicial;
    const end = normalizedCompositeFilters.data_entrada_final;

    if (start && end) return `${formatDate(start)} ate ${formatDate(end)}`;
    if (start) return `A partir de ${formatDate(start)}`;
    if (end) return `Ate ${formatDate(end)}`;
    return "Definir periodo";
  }, [normalizedCompositeFilters]);

  const openEntryDateFilterModal = useCallback(() => {
    setEntryDateFilterDraft({
      data_entrada_inicial: normalizedCompositeFilters.data_entrada_inicial,
      data_entrada_final: normalizedCompositeFilters.data_entrada_final,
    });
    setIsEntryDateFilterModalOpen(true);
  }, [normalizedCompositeFilters]);

  const applyEntryDateFilter = useCallback(() => {
    const normalizedDraft = normalizeContactCompositeFilters({
      ...createDefaultContactCompositeFilters(),
      data_entrada_inicial: entryDateFilterDraft.data_entrada_inicial,
      data_entrada_final: entryDateFilterDraft.data_entrada_final,
    });

    setCompositeFilters((current) => ({
      ...current,
      data_entrada_inicial: normalizedDraft.data_entrada_inicial,
      data_entrada_final: normalizedDraft.data_entrada_final,
    }));
    setIsEntryDateFilterModalOpen(false);
  }, [entryDateFilterDraft]);

  const clearEntryDateFilter = useCallback(() => {
    setEntryDateFilterDraft({
      data_entrada_inicial: "",
      data_entrada_final: "",
    });
    setCompositeFilters((current) => ({
      ...current,
      data_entrada_inicial: "",
      data_entrada_final: "",
    }));
    setIsEntryDateFilterModalOpen(false);
  }, []);

  const clearClientFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedFilter("all");
    setCompositeFilters(createDefaultContactCompositeFilters());
    setContactTagSearchTerm("");
    setContactTagOptions([]);
    setSelectedContactFilterTags([]);
    setEntryDateFilterDraft({
      data_entrada_inicial: "",
      data_entrada_final: "",
    });
  }, []);

  const resetExportState = useCallback(() => {
    setExportMode("date");
    setExportFilters(createDefaultContactCompositeFilters());
    setExportTagSearchTerm("");
    setDebouncedExportTagSearchTerm("");
    setExportTagOptions([]);
    setSelectedExportTags([]);
  }, []);

  const handleOpenExportModal = useCallback(() => {
    resetExportState();
    setIsExportModalOpen(true);
  }, [resetExportState]);

  const handleCloseExportModal = useCallback(() => {
    setIsExportModalOpen(false);
    resetExportState();
  }, [resetExportState]);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileClientFiltersModalOpen(false);
      setIsMobileBroadcastListsModalOpen(false);
      setIsMobileMetaAdsFormsModalOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const closeToolbarMenus = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const clickedInsideToolbarMenu = toolbarMenusRef.current.some((menu) =>
        menu?.contains(target)
      );

      if (clickedInsideToolbarMenu) return;

      toolbarMenusRef.current.forEach((menu) => {
        if (menu) {
          menu.open = false;
        }
      });
    };

    document.addEventListener("pointerdown", closeToolbarMenus, true);
    return () => {
      document.removeEventListener("pointerdown", closeToolbarMenus, true);
    };
  }, []);

  const handleSelectContactFilterTag = useCallback((tag: ContactTagOption) => {
    setCompositeFilters((current) => {
      if (current.tag_ids.includes(tag.id)) {
        return current;
      }
      return {
        ...current,
        tag_ids: [...current.tag_ids, tag.id],
      };
    });
    setSelectedContactFilterTags((current) => {
      if (current.some((item) => item.id === tag.id)) {
        return current;
      }
      return [...current, tag];
    });
    setContactTagSearchTerm("");
    setContactTagOptions([]);
  }, []);

  const handleSelectExportTag = useCallback((tag: ContactTagOption) => {
    setExportFilters((current) => {
      if (current.tag_ids.includes(tag.id)) {
        return current;
      }
      return {
        ...current,
        tag_ids: [...current.tag_ids, tag.id],
      };
    });
    setSelectedExportTags((current) => {
      if (current.some((item) => item.id === tag.id)) {
        return current;
      }
      return [...current, tag];
    });
    setExportTagSearchTerm("");
    setDebouncedExportTagSearchTerm("");
    setExportTagOptions([]);
  }, []);

  const handleRemoveExportTag = useCallback((tagId: number) => {
    setExportFilters((current) => ({
      ...current,
      tag_ids: current.tag_ids.filter((item) => item !== tagId),
    }));
    setSelectedExportTags((current) => current.filter((item) => item.id !== tagId));
  }, []);

  const renderBroadcastListSelector = () => {
    if (loadingBroadcastLists) {
      return <p className="broadcast-empty-state">Carregando listas...</p>;
    }

    if (!broadcastLists.length) {
      return (
        <div className="broadcast-empty-state">
          <FiTarget />
          <strong>Nenhuma lista criada</strong>
          <p>
            Crie a primeira lista de transmissao para montar segmentos por tags,
            UTMs e inclusoes manuais.
          </p>
        </div>
      );
    }

    return (
      <div className="broadcast-list-stack">
        {broadcastLists.map((list) => (
          <button
            key={list.id}
            type="button"
            className={`broadcast-list-card ${
              list.id === selectedBroadcastListId ? "active" : ""
            }`}
            onClick={() => handleSelectBroadcastList(list.id)}
          >
            <div className="broadcast-list-card-top">
              <strong>{list.nome}</strong>
              <span>{list.total_contatos} contato(s)</span>
            </div>
            <p>{list.descricao || "Sem descrição."}</p>
            <div className="broadcast-list-card-meta">
              <span>{formatBroadcastListMetaLabel(list)}</span>
              <span>{list.tags.length} tag(s)</span>
              <span>{Object.keys(list.utm_filters || {}).length} filtro(s) de UTM</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderMetaAdsFormSelector = () => {
    if (!selectedMetaAdsAccountId) {
      return (
        <div className="broadcast-empty-state broadcast-empty-state--light">
          <FiTarget />
          <strong>Selecione uma conta</strong>
          <p>Escolha uma conta de anuncios vinculada para listar os formularios.</p>
        </div>
      );
    }

    if (hasMetaAdsFormsForSelectedAccount) {
      return (
        <div className="broadcast-list-stack">
          {metaAdsForms.map((form) => {
            const formId = String(form.id || "");
            const isActive = formId === selectedMetaAdsFormId;

            return (
              <button
                key={formId}
                type="button"
                className={`broadcast-list-card ${isActive ? "active" : ""}`}
                onClick={() => {
                  handleMetaAdsFormChange(formId);
                  if (isMobile) {
                    setIsMobileMetaAdsFormsModalOpen(false);
                  }
                }}
              >
                <div className="broadcast-list-card-top">
                  <strong>{form.name || "Formulario sem nome"}</strong>
                  <span>{form.leads_count || 0} lead(s)</span>
                </div>
                <p>Status: {form.status || "Não informado"}</p>
                <div className="broadcast-list-card-meta">
                  <span>Criado em {formatDate(form.created_time || null)}</span>
                  <span>{form.page_name || form.locale || "Sem página"}</span>
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="broadcast-empty-state">
        <FiTarget />
        <strong>Nenhum formulario encontrado</strong>
        <p>A conta selecionada ainda não retornou formularios de captação.</p>
      </div>
    );
  };

  const renderClientMainFiltersFields = () => (
    <>
      <label className="contacts-filter-field contacts-filter-field--compact-select">
        <select
          value={selectedFilter}
          onChange={(event) =>
            setSelectedFilter(event.target.value as ContactsFilterValue)
          }
        >
          <option value="all">Todos os contatos</option>
          <option value="birthday_5_days">Aniversário em 5 dias</option>
          <option value="with_crm">Com funil</option>
          <option value="without_crm">Sem funil</option>
        </select>
      </label>
      <label className="contacts-filter-field contacts-filter-field--compact-select">
        <select
          value={compositeFilters.origem}
          onChange={(event) =>
            setCompositeFilters((current) => ({
              ...current,
              origem: event.target.value as ContactCompositeFilters["origem"],
            }))
          }
        >
          <option value="">Todas as origens</option>
          <option value="manual">Manual</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="meta_ads">Meta Ads</option>
          <option value="importacao">Importação</option>
          <option value="comercial">Comercial</option>
        </select>
      </label>
      <div className="contacts-filter-field contacts-filter-field--entry-date">
        <button
          type="button"
          className={`contacts-date-filter-trigger ${
            normalizedCompositeFilters.data_entrada_inicial ||
            normalizedCompositeFilters.data_entrada_final
              ? "is-active"
              : ""
          }`}
          onClick={openEntryDateFilterModal}
        >
          <FiCalendar />
          <span>{entryDateFilterLabel}</span>
        </button>
      </div>
    </>
  );

  const renderClientAdvancedFiltersFields = () => (
    <>
      <label className="contacts-filter-field">
        <span>UTM</span>
        <DebouncedTextInput
          value={compositeFilters.utm}
          onChange={(value) =>
            setCompositeFilters((current) => ({
              ...current,
              utm: value,
            }))
          }
          placeholder="Buscar por qualquer UTM"
        />
      </label>
      <div className="contacts-filter-field contacts-filter-field--tag">
        <span>Tags</span>
        <div className="contacts-tag-search-field">
          <DebouncedTextInput
            value={contactTagSearchTerm}
            onChange={setContactTagSearchTerm}
            delay={250}
            placeholder="Buscar tag para adicionar"
          />
          {loadingContactTagOptions ? (
            <div className="contacts-tag-search-results">
              <span className="contacts-tag-search-status">Buscando tags...</span>
            </div>
          ) : contactTagSearchTerm ? (
            <div className="contacts-tag-search-results">
              {contactTagOptions.length ? (
                contactTagOptions.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="contacts-tag-search-option"
                    onClick={() => handleSelectContactFilterTag(tag)}
                  >
                    {tag.name}
                  </button>
                ))
              ) : (
                <span className="contacts-tag-search-status">
                  Nenhuma tag encontrada para essa busca.
                </span>
              )}
            </div>
          ) : null}
        </div>
        <div className="contacts-tag-filter-grid">
          {selectedContactFilterTags.length ? (
            selectedContactFilterTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="contacts-selected-tag-chip"
                onClick={() => handleRemoveContactFilterTag(tag.id)}
                title="Remover tag do filtro"
              >
                <span>{tag.name}</span>
                <strong>x</strong>
              </button>
            ))
          ) : null}
        </div>
      </div>
    </>
  );

  const renderClientFiltersFields = () => (
    <>
      {renderClientMainFiltersFields()}
      {renderClientAdvancedFiltersFields()}
    </>
  );

  const handleRemoveContactFilterTag = useCallback((tagId: number) => {
    setCompositeFilters((current) => ({
      ...current,
      tag_ids: current.tag_ids.filter((item) => item !== tagId),
    }));
    setSelectedContactFilterTags((current) => current.filter((item) => item.id !== tagId));
  }, []);

  const fetchContactsPage = useCallback(
    async ({
      pagina,
      limite,
      busca,
      filtro,
      filtrosCompostos,
    }: {
      pagina: number;
      limite: number;
      busca: string;
      filtro: ContactsFilterValue;
      filtrosCompostos: ContactCompositeFilters;
    }) => {
      if (!user?.empresa_id) {
        return {
          items: [],
          total: 0,
          pagina,
          limite,
          total_paginas: 0,
        } as ContactListResponse;
      }

      const payload = await encrypt({
        pagina,
        limite,
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        busca,
        filtro,
        filtros_compostos: filtrosCompostos,
      });
      const response = await fetch(`${API_BASE}/user/lista_clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });

      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano?: boolean;
        obj?: ContactListResponse;
        msg?: string;
        mensagem?: string;
      };

      if (!resp?.boleano) {
        throw new Error(resp?.mensagem || resp?.msg || "Nao foi possivel carregar os contatos.");
      }

      return resp.obj || {};
    },
    [user?.empresa_id]
  );

  const fetchContacts = useCallback(async () => {
    const cacheKey = JSON.stringify({
      pagina: currentPage,
      limite: ITEMS_PER_PAGE,
      busca: searchTerm,
      filtro: selectedFilter,
      filtrosCompostos: normalizedCompositeFilters,
      empresaId: user?.empresa_id || 0,
    });
    const cachedPage = contactsCacheRef.current[cacheKey];
    const requestId = ++contactsRequestRef.current;
    const shouldBlockList = !contactsLoadedRef.current && !cachedPage;

    try {
      if (!user?.empresa_id) {
        setContacts([]);
        setTotalContacts(0);
        contactsLoadedRef.current = false;
        setLoading(false);
        setIsRefreshingContacts(false);
        return;
      }

      if (cachedPage) {
        setContacts(cachedPage.items);
        setTotalContacts(cachedPage.total);
        contactsLoadedRef.current = true;
      }

      if (shouldBlockList) {
        setLoading(true);
      } else {
        setIsRefreshingContacts(true);
      }

      const responseData = await fetchContactsPage({
        pagina: currentPage,
        limite: ITEMS_PER_PAGE,
        busca: searchTerm,
        filtro: selectedFilter,
        filtrosCompostos: normalizedCompositeFilters,
      });

      const pageContacts = Array.isArray(responseData.items)
        ? responseData.items.map(normalizeContact)
        : [];
      const nextTotalContacts = Number(responseData.total || 0);

      if (requestId !== contactsRequestRef.current) {
        return;
      }

      contactsCacheRef.current[cacheKey] = {
        items: pageContacts,
        total: nextTotalContacts,
      };
      setContacts(pageContacts);
      setTotalContacts(nextTotalContacts);
      contactsLoadedRef.current = true;
    } catch (error) {
      if (requestId !== contactsRequestRef.current) {
        return;
      }

      console.error("Erro na requisicao:", error);
      if (!cachedPage && !contactsLoadedRef.current) {
        setContacts([]);
        setTotalContacts(0);
      }
    } finally {
      if (requestId === contactsRequestRef.current) {
        setLoading(false);
        setIsRefreshingContacts(false);
      }
    }
  }, [
    currentPage,
    fetchContactsPage,
    searchTerm,
    selectedFilter,
    normalizedCompositeFilters,
    user?.empresa_id,
  ]);

  const handleExportContacts = useCallback(async () => {
    if (!user?.empresa_id) {
      return;
    }

    if (
      exportMode === "date" &&
      !normalizedExportFilters.data_entrada_inicial &&
      !normalizedExportFilters.data_entrada_final
    ) {
      addToast({
        type: "warning",
        title: "Periodo obrigatorio",
        description: "Informe uma data inicial, final ou ambas para exportar por data.",
      });
      return;
    }

    if (exportMode === "tag" && !normalizedExportFilters.tag_ids.length) {
      addToast({
        type: "warning",
        title: "Tag obrigatoria",
        description: "Selecione ao menos uma tag para exportar os contatos.",
      });
      return;
    }

    if (exportMode === "utm" && !normalizedExportFilters.utm) {
      addToast({
        type: "warning",
        title: "UTM obrigatoria",
        description: "Informe um termo de UTM para exportar os contatos.",
      });
      return;
    }

    setExportingContacts(true);

    try {
      const exportRows: RawContact[] = [];
      let pagina = 1;
      const limite = 50;
      let total = 0;

      while (true) {
        const responseData = await fetchContactsPage({
          pagina,
          limite,
          busca: "",
          filtro: "all",
          filtrosCompostos: normalizedExportFilters,
        });

        const pageItems = Array.isArray(responseData.items) ? responseData.items : [];
        exportRows.push(...pageItems);
        total = Number(responseData.total || 0);

        if (!pageItems.length || exportRows.length >= total) {
          break;
        }

        pagina += 1;
      }

      if (!exportRows.length) {
        addToast({
          type: "warning",
          title: "Nenhum contato encontrado",
          description: "Nenhum contato corresponde ao criterio escolhido para exportacao.",
        });
        return;
      }

      exportContactsWorkbook({
        rows: exportRows,
        filename: buildContactsExportFilename(exportMode),
        criteria: {
          mode: exportMode,
          dateStart: normalizedExportFilters.data_entrada_inicial,
          dateEnd: normalizedExportFilters.data_entrada_final,
          tagNames: selectedExportTags.map((tag) => tag.name),
          utm: normalizedExportFilters.utm,
          totalContacts: exportRows.length,
        },
      });

      addToast({
        type: "success",
        title: "Exportacao concluida",
        description: `${exportRows.length} contato(s) foram exportados para Excel.`,
      });
      handleCloseExportModal();
    } catch (error) {
      console.error("Erro ao exportar contatos:", error);
      addToast({
        type: "error",
        title: "Falha na exportacao",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel exportar os contatos neste momento.",
      });
    } finally {
      setExportingContacts(false);
    }
  }, [
    addToast,
    exportMode,
    fetchContactsPage,
    handleCloseExportModal,
    normalizedExportFilters,
    selectedExportTags,
    user?.empresa_id,
  ]);

  const fetchUpcomingBirthdayContacts = useCallback(async () => {
    try {
      if (!user?.empresa_id) {
        setUpcomingBirthdayContacts([]);
        setUpcomingBirthdayTotal(0);
        return;
      }

      const payload = await encrypt({
        pagina: 1,
        limite: UPCOMING_BIRTHDAY_LIMIT,
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        busca: "",
        filtro: "birthday_5_days",
      });
      const response = await fetch(`${API_BASE}/user/lista_clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });

      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano?: boolean;
        obj?: ContactListResponse;
        msg?: string;
      };

      if (!resp?.boleano) {
        console.error("Erro ao carregar aniversariantes:", resp?.msg);
        setUpcomingBirthdayContacts([]);
        setUpcomingBirthdayTotal(0);
        return;
      }

      setUpcomingBirthdayContacts(
        Array.isArray(resp.obj?.items) ? resp.obj.items.map(normalizeContact) : []
      );
      setUpcomingBirthdayTotal(Number(resp.obj?.total || 0));
    } catch (error) {
      console.error("Erro ao carregar aniversariantes:", error);
      setUpcomingBirthdayContacts([]);
      setUpcomingBirthdayTotal(0);
    }
  }, [UPCOMING_BIRTHDAY_LIMIT, user?.empresa_id]);

  const fetchBroadcastListsData = useCallback(
    async (preferredListId?: number | null) => {
      if (!user?.empresa_id || !user?.id) {
        setBroadcastLists([]);
        setSelectedBroadcastListId(null);
        return;
      }

      try {
        setLoadingBroadcastLists(true);
        const lists = await fetchBroadcastLists(user.empresa_id, user.id);
        setBroadcastLists(lists);
        setSelectedBroadcastListId((current) => {
          const candidate = preferredListId ?? current;
          if (candidate && lists.some((item) => item.id === candidate)) {
            return candidate;
          }
          return null;
        });
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro nas listas de transmissão",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel carregar as listas de transmissão.",
        });
      } finally {
        setLoadingBroadcastLists(false);
      }
    },
    [addToast, user?.empresa_id, user?.id]
  );

  const fetchAvailableTagsData = useCallback(async () => {
    if (!user?.empresa_id) {
      setAvailableTags([]);
      return;
    }

    try {
      const tags = await fetchContactTags(user.empresa_id);
      setAvailableTags(tags);
    } catch (error) {
      console.error("Erro ao carregar tags de contatos:", error);
      setAvailableTags([]);
    }
  }, [user?.empresa_id]);

  const fetchMetaAdsAccountsData = useCallback(async () => {
    if (!user?.empresa_id) {
      setMetaAdsAccounts([]);
      setSelectedMetaAdsAccountId("");
      setMetaAdsFormsAccountId("");
      return;
    }

    try {
      setLoadingMetaAdsAccounts(true);
      const accounts = await MetaAdsService.listAccounts(user.empresa_id);
      setMetaAdsAccounts(accounts);
      setSelectedMetaAdsAccountId((current) => {
        if (current && accounts.some((account) => account.ad_account_id === current)) {
          return current;
        }
        return String(accounts[0]?.ad_account_id || "");
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar contas Meta Ads",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as contas de anuncios vinculadas.",
      });
      setMetaAdsAccounts([]);
      setSelectedMetaAdsAccountId("");
    } finally {
      setLoadingMetaAdsAccounts(false);
    }
  }, [addToast, user?.empresa_id, user?.id]);

  const fetchMetaAdsFormsData = useCallback(async () => {
    if (!user?.empresa_id || !selectedMetaAdsAccountId) {
      console.log("[ContactsPage][MetaAds] limpando formularios: conta nao selecionada", {
        empresaId: user?.empresa_id,
        selectedMetaAdsAccountId,
      });
      setMetaAdsForms([]);
      setMetaAdsFormsAccountId("");
      setSelectedMetaAdsFormId("");
      return;
    }

    const requestId = metaAdsFormsRequestRef.current + 1;
    metaAdsFormsRequestRef.current = requestId;
    const accountId = selectedMetaAdsAccountId;
    console.log("[ContactsPage][MetaAds] buscando formularios", {
      requestId,
      empresaId: user.empresa_id,
      selectedMetaAdsAccountId,
      accountId,
    });

    try {
      setLoadingMetaAdsForms(true);
      const forms = await MetaAdsService.listLeadForms({
        empresaId: user.empresa_id,
        adAccountId: accountId,
      });
      console.log("[ContactsPage][MetaAds] formularios recebidos", {
        requestId,
        accountId,
        selectedMetaAdsAccountId,
        totalForms: forms.length,
        formIds: forms.map((form) => String(form.id || "")),
        formNames: forms.map((form) => form.name || "Formulario sem nome"),
      });

      if (
        metaAdsFormsRequestRef.current !== requestId ||
        accountId !== selectedMetaAdsAccountId
      ) {
        console.log("[ContactsPage][MetaAds] descartando resposta de formularios", {
          requestId,
          accountId,
          selectedMetaAdsAccountId,
          currentRequestId: metaAdsFormsRequestRef.current,
        });
        return;
      }

      setMetaAdsForms(forms);
      setMetaAdsFormsAccountId(accountId);
      setSelectedMetaAdsFormId((current) => {
        if (current && forms.some((form) => String(form.id || "") === current)) {
          return current;
        }
        return String(forms[0]?.id || "");
      });
    } catch (error) {
      console.log("[ContactsPage][MetaAds] erro ao carregar formularios", {
        requestId,
        accountId,
        error,
      });
      addToast({
        type: "error",
        title: "Erro ao carregar formularios",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os formularios da conta selecionada.",
      });
      setMetaAdsForms([]);
      setMetaAdsFormsAccountId("");
      setSelectedMetaAdsFormId("");
    } finally {
      setLoadingMetaAdsForms(false);
    }
  }, [addToast, selectedMetaAdsAccountId, user?.empresa_id]);

  const fetchMetaAdsLeadsData = useCallback(async () => {
    if (!user?.empresa_id || !selectedMetaAdsAccountId || !selectedMetaAdsFormId) {
      setMetaAdsLeads([]);
      setSelectedMetaAdsLeadIds([]);
      return;
    }

    const requestId = metaAdsLeadsRequestRef.current + 1;
    metaAdsLeadsRequestRef.current = requestId;
    const accountId = selectedMetaAdsAccountId;
    const formId = selectedMetaAdsFormId;

    try {
      setLoadingMetaAdsLeads(true);
      const selectedForm = metaAdsForms.find(
        (form) => String(form.id || "") === formId
      );
      const leads = await MetaAdsService.listFormLeads({
        empresaId: user.empresa_id,
        adAccountId: accountId,
        formId,
        formName: selectedForm?.name,
        pageId: selectedForm?.page_id || undefined,
        limit: 100,
      });

      if (
        metaAdsLeadsRequestRef.current !== requestId ||
        accountId !== selectedMetaAdsAccountId ||
        formId !== selectedMetaAdsFormId
      ) {
        return;
      }

      setMetaAdsLeads(leads);
      setSelectedMetaAdsLeadIds([]);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar leads",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel recuperar os leads do formulario selecionado.",
      });
      setMetaAdsLeads([]);
      setSelectedMetaAdsLeadIds([]);
    } finally {
      setLoadingMetaAdsLeads(false);
    }
  }, [
    addToast,
    metaAdsForms,
    selectedMetaAdsAccountId,
    selectedMetaAdsFormId,
    user?.empresa_id,
  ]);

  const handleMetaAdsAccountChange = useCallback((accountId: string) => {
    setMetaAdsTabLoading(true);
    console.log("[ContactsPage][MetaAds] troca de conta", {
      previousAccountId: selectedMetaAdsAccountId,
      nextAccountId: accountId,
      previousFormsAccountId: metaAdsFormsAccountId,
      previousFormsCount: metaAdsForms.length,
    });
    metaAdsFormsRequestRef.current += 1;
    metaAdsLeadsRequestRef.current += 1;
    setSelectedMetaAdsAccountId(accountId);
    setMetaAdsForms([]);
    setMetaAdsFormsAccountId("");
    setSelectedMetaAdsFormId("");
    setMetaAdsLeads([]);
    setSelectedMetaAdsLeadIds([]);
    setSelectedMetaAdsCampaignMappingId("");
    setMetaAdsFieldMapping(null);
    setMetaAdsMappingScopeType("form");
  }, [metaAdsForms.length, metaAdsFormsAccountId, selectedMetaAdsAccountId]);

  const handleMetaAdsFormChange = useCallback((formId: string) => {
    setMetaAdsTabLoading(true);
    metaAdsLeadsRequestRef.current += 1;
    setSelectedMetaAdsFormId(formId);
    setMetaAdsLeads([]);
    setSelectedMetaAdsLeadIds([]);
    setSelectedMetaAdsCampaignMappingId("");
    setMetaAdsFieldMapping(null);
    setMetaAdsMappingScopeType("form");
  }, []);

  const fetchMetaAdsFieldMappingData = useCallback(async () => {
    const scopeId =
      metaAdsMappingScopeType === "campaign"
        ? selectedMetaAdsCampaignMappingId || null
        : selectedMetaAdsFormId || null;

    if (!user?.empresa_id || !scopeId) {
      setMetaAdsFieldMapping(null);
      return;
    }

    try {
      setLoadingMetaAdsFieldMapping(true);
      const mapping = await MetaAdsService.getFieldMapping({
        empresaId: user.empresa_id,
        scopeType: metaAdsMappingScopeType,
        scopeId,
      });
      setMetaAdsFieldMapping(mapping);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar mapeamento",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar o mapeamento salvo para esse escopo.",
      });
      setMetaAdsFieldMapping(null);
    } finally {
      setLoadingMetaAdsFieldMapping(false);
    }
  }, [
    addToast,
    metaAdsMappingScopeType,
    selectedMetaAdsCampaignMappingId,
    selectedMetaAdsFormId,
    user?.empresa_id,
  ]);

  const fetchSelectedBroadcastContacts = useCallback(
    async (listId: number | null) => {
      if (!user?.empresa_id || !user?.id || !listId) {
        setBroadcastListContacts([]);
        return;
      }

      try {
        setLoadingBroadcastContacts(true);
        const contactsData = await fetchBroadcastListContacts(
          user.empresa_id,
          user.id,
          listId
        );
        setBroadcastListContacts(contactsData);
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro ao carregar contatos da lista",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel carregar os contatos da lista selecionada.",
        });
      } finally {
        setLoadingBroadcastContacts(false);
      }
    },
    [addToast, user?.empresa_id, user?.id]
  );

  const fetchMetaAdsCrmsData = useCallback(async () => {
    try {
      setLoadingMetaAdsCrms(true);
      const crms = await getCommercialCrms();
      setMetaAdsCrms(crms);
      setSelectedMetaAdsCrmId((current) => {
        if (current && crms.some((crm) => String(crm.id) === current)) {
          return current;
        }
        return crms[0] ? String(crms[0].id) : "";
      });
    } catch (error) {
      setMetaAdsCrms([]);
      setSelectedMetaAdsCrmId("");
      addToast({
        type: "error",
        title: "Erro ao carregar funis",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os funis disponiveis para importação.",
      });
    } finally {
      setLoadingMetaAdsCrms(false);
    }
  }, [addToast]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    void fetchUpcomingBirthdayContacts();
    void fetchBroadcastListsData();
    void fetchAvailableTagsData();
  }, [fetchAvailableTagsData, fetchBroadcastListsData, fetchUpcomingBirthdayContacts]);

  useEffect(() => {
    if (activeTab !== "meta_ads") return;
    void fetchMetaAdsAccountsData();
  }, [activeTab, fetchMetaAdsAccountsData]);

  useEffect(() => {
    if (activeTab !== "meta_ads") return;
    void fetchMetaAdsCrmsData();
  }, [activeTab, fetchMetaAdsCrmsData]);

  useEffect(() => {
    void fetchSelectedBroadcastContacts(selectedBroadcastListId);
  }, [fetchSelectedBroadcastContacts, selectedBroadcastListId]);

  useEffect(() => {
    if (activeTab !== "meta_ads") return;
    void fetchMetaAdsFormsData();
  }, [activeTab, fetchMetaAdsFormsData]);

  useEffect(() => {
    if (activeTab !== "meta_ads") return;
    void fetchMetaAdsLeadsData();
  }, [activeTab, fetchMetaAdsLeadsData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedExportTagSearchTerm(exportTagSearchTerm.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [exportTagSearchTerm]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedBroadcastContactSearchTerm(broadcastContactSearchTerm.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [broadcastContactSearchTerm]);

  useEffect(() => {
    setSelectedContactFilterTags((current) =>
      current.filter((tag) => compositeFilters.tag_ids.includes(tag.id))
    );
  }, [compositeFilters.tag_ids]);

  const selectedMetaTemplate = useMemo(
    () =>
      availableMetaTemplates.find((template) => template.name === selectedMetaTemplateName) ||
      null,
    [availableMetaTemplates, selectedMetaTemplateName]
  );

  const selectedMetaTemplateHints = useMemo(
    () => (selectedMetaTemplate ? getTemplateDispatchHints(selectedMetaTemplate) : null),
    [selectedMetaTemplate]
  );

  useEffect(() => {
    if (!selectedMetaTemplateHints) {
      setMetaTemplateLanguage("pt_BR");
      setMetaTemplateHeaderParameters([]);
      setMetaTemplateBodyParameters([]);
      setMetaTemplateButtonParameters({});
      setMetaTemplateHeaderFile(null);
      setMetaTemplateDispatchError("");
      return;
    }

    setMetaTemplateLanguage(String(selectedMetaTemplate?.language || "pt_BR"));
    setMetaTemplateHeaderParameters(
      createTemplateParameterInputs(selectedMetaTemplateHints.headerParameterCount)
    );
    setMetaTemplateBodyParameters(createTemplateParameterInputs(selectedMetaTemplateHints.bodyParameterCount));
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
    setMetaTemplateDispatchError("");
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

  useEffect(() => {
    let active = true;

    const loadContactTagOptions = async () => {
      if (!user?.empresa_id || !contactTagSearchTerm) {
        setContactTagOptions([]);
        setLoadingContactTagOptions(false);
        return;
      }

      try {
        setLoadingContactTagOptions(true);
        const tags = await searchContactTags(user.empresa_id, contactTagSearchTerm);
        if (!active) return;
        setContactTagOptions(
          tags.filter((tag) => !compositeFilters.tag_ids.includes(tag.id)).slice(0, 12)
        );
      } catch (error) {
        if (!active) return;
        console.error("Erro ao buscar tags para o filtro de contatos:", error);
        setContactTagOptions([]);
      } finally {
        if (active) {
          setLoadingContactTagOptions(false);
        }
      }
    };

    void loadContactTagOptions();

    return () => {
      active = false;
    };
  }, [compositeFilters.tag_ids, contactTagSearchTerm, user?.empresa_id]);

  useEffect(() => {
    let active = true;

    const loadExportTagOptions = async () => {
      if (!user?.empresa_id || !debouncedExportTagSearchTerm || !isExportModalOpen) {
        setExportTagOptions([]);
        setLoadingExportTagOptions(false);
        return;
      }

      try {
        setLoadingExportTagOptions(true);
        const tags = await searchContactTags(user.empresa_id, debouncedExportTagSearchTerm);
        if (!active) return;
        setExportTagOptions(
          tags.filter((tag) => !exportFilters.tag_ids.includes(tag.id)).slice(0, 12)
        );
      } catch (error) {
        if (!active) return;
        console.error("Erro ao buscar tags para exportacao de contatos:", error);
        setExportTagOptions([]);
      } finally {
        if (active) {
          setLoadingExportTagOptions(false);
        }
      }
    };

    void loadExportTagOptions();

    return () => {
      active = false;
    };
  }, [
    debouncedExportTagSearchTerm,
    exportFilters.tag_ids,
    isExportModalOpen,
    user?.empresa_id,
  ]);

  const selectedBroadcastList = useMemo(
    () => broadcastLists.find((list) => list.id === selectedBroadcastListId) || null,
    [broadcastLists, selectedBroadcastListId]
  );
  const selectedBroadcastContactIds = useMemo(
    () =>
      new Set(
        broadcastListContacts
          .map((contact) => Number(contact.cliente_id || contact.id))
          .filter((contactId) => Number.isInteger(contactId) && contactId > 0)
      ),
    [broadcastListContacts]
  );
  const filteredBroadcastListContacts = useMemo(() => {
    const normalizedTerm = String(broadcastListContactSearchTerm || "")
      .trim()
      .toLowerCase();
    if (!normalizedTerm) {
      return broadcastListContacts;
    }

    const normalizedDigits = normalizedTerm.replace(/\D/g, "");

    return broadcastListContacts.filter((contact) => {
      const contactName = String(contact.nome || "").trim().toLowerCase();
      const contactPhone = String(contact.telefone || "").trim().toLowerCase();
      const contactDigits = contactPhone.replace(/\D/g, "");

      if (contactName.includes(normalizedTerm) || contactPhone.includes(normalizedTerm)) {
        return true;
      }

      return Boolean(normalizedDigits) && contactDigits.includes(normalizedDigits);
    });
  }, [broadcastListContactSearchTerm, broadcastListContacts]);

  const selectedMetaAdsForm = useMemo(
    () => metaAdsForms.find((form) => String(form.id || "") === selectedMetaAdsFormId) || null,
    [metaAdsForms, selectedMetaAdsFormId]
  );

  const selectedMetaAdsCrm = useMemo(
    () => metaAdsCrms.find((crm) => String(crm.id) === selectedMetaAdsCrmId) || null,
    [metaAdsCrms, selectedMetaAdsCrmId]
  );

  const selectedMetaAdsAccount = useMemo(
    () =>
      metaAdsAccounts.find((account) => account.ad_account_id === selectedMetaAdsAccountId) ||
      null,
    [metaAdsAccounts, selectedMetaAdsAccountId]
  );

  const hasMetaAdsFormsForSelectedAccount =
    metaAdsFormsAccountId === selectedMetaAdsAccountId && metaAdsForms.length > 0;

  const hasNoMetaAdsInfoForAccount =
    Boolean(selectedMetaAdsAccountId) &&
    !loadingMetaAdsForms &&
    metaAdsFormsAccountId === selectedMetaAdsAccountId &&
    metaAdsForms.length === 0;

  const metaAdsCampaignOptions = useMemo(() => {
    const deduped = new Map<string, { id: string; name: string }>();
    metaAdsLeads.forEach((lead) => {
      const campaignId = String(lead.campaign_id || "").trim();
      if (!campaignId || deduped.has(campaignId)) return;
      deduped.set(campaignId, {
        id: campaignId,
        name: String(lead.campaign_name || campaignId),
      });
    });
    return [...deduped.values()];
  }, [metaAdsLeads]);

  const metaAdsFieldOptions = useMemo(() => {
    const deduped = new Map<string, { key: string; label: string }>();
    metaAdsLeads.forEach((lead) => {
      (lead.fields || []).forEach((field) => {
        const key = normalizeMetaAdsFieldKey(field.key || "");
        if (!key || deduped.has(key)) return;
        deduped.set(key, {
          key,
          label: String(field.label || field.originalKey || field.key || key),
        });
      });
    });
    return [...deduped.values()];
  }, [metaAdsLeads]);

  const currentMetaAdsMappingScopeId = useMemo(() => {
    if (metaAdsMappingScopeType === "campaign") {
      return selectedMetaAdsCampaignMappingId || null;
    }
    return selectedMetaAdsFormId || null;
  }, [metaAdsMappingScopeType, selectedMetaAdsCampaignMappingId, selectedMetaAdsFormId]);

  const isMetaAdsTabBusy = useMemo(() => {
    if (loadingMetaAdsCrms || loadingMetaAdsAccounts) return true;
    if (selectedMetaAdsAccountId && loadingMetaAdsForms) return true;
    if (selectedMetaAdsFormId && loadingMetaAdsLeads) return true;
    if (currentMetaAdsMappingScopeId && loadingMetaAdsFieldMapping) return true;
    return false;
  }, [
    currentMetaAdsMappingScopeId,
    loadingMetaAdsAccounts,
    loadingMetaAdsCrms,
    loadingMetaAdsFieldMapping,
    loadingMetaAdsForms,
    loadingMetaAdsLeads,
    selectedMetaAdsAccountId,
    selectedMetaAdsFormId,
  ]);

  const shouldShowMetaAdsTabLoading =
    activeTab === "meta_ads" && (metaAdsTabLoading || isMetaAdsTabBusy);

  const currentMetaAdsMappingScopeName = useMemo(() => {
    if (metaAdsMappingScopeType === "campaign") {
      return (
        metaAdsCampaignOptions.find((item) => item.id === selectedMetaAdsCampaignMappingId)?.name ||
        null
      );
    }
    return selectedMetaAdsForm?.name || null;
  }, [
    metaAdsCampaignOptions,
    metaAdsMappingScopeType,
    selectedMetaAdsCampaignMappingId,
    selectedMetaAdsForm,
  ]);

  const displayedMetaAdsLeads = useMemo(() => {
    return metaAdsLeads.map((lead) => {
      const shouldApplyCurrentMapping =
        metaAdsFieldMapping &&
        currentMetaAdsMappingScopeId &&
        (
          metaAdsMappingScopeType === "form" ||
          String(lead.campaign_id || "") === currentMetaAdsMappingScopeId
        );

      if (!shouldApplyCurrentMapping) {
        return lead;
      }

      return {
        ...lead,
        nome:
          getMetaAdsLeadFieldValue(lead, metaAdsFieldMapping?.campo_nome) || lead.nome || null,
        telefone:
          getMetaAdsLeadFieldValue(lead, metaAdsFieldMapping?.campo_telefone) ||
          lead.telefone ||
          null,
        email:
          getMetaAdsLeadFieldValue(lead, metaAdsFieldMapping?.campo_email) ||
          lead.email ||
          null,
      };
    });
  }, [
    currentMetaAdsMappingScopeId,
    metaAdsFieldMapping,
    metaAdsLeads,
    metaAdsMappingScopeType,
  ]);

  const metaAdsLeadSummary = useMemo(() => {
    return displayedMetaAdsLeads.reduce(
      (acc, lead) => {
        const status = getMetaAdsLeadStatus(lead);
        acc.total += 1;
        if (status === "imported") {
          acc.imported += 1;
        } else {
          acc.notImported += 1;
          if (status === "ready") {
            acc.ready += 1;
          } else {
            acc.incomplete += 1;
          }
        }
        return acc;
      },
      { total: 0, notImported: 0, ready: 0, incomplete: 0, imported: 0 }
    );
  }, [displayedMetaAdsLeads]);

  const filteredMetaAdsLeads = useMemo(() => {
    const normalizedSearch = metaAdsLeadSearchTerm.trim().toLowerCase();

    return displayedMetaAdsLeads.filter((lead) => {
      const status = getMetaAdsLeadStatus(lead);
      const matchesFilter =
        metaAdsLeadFilter === "all" ||
        (metaAdsLeadFilter === "not_imported" && status !== "imported") ||
        (metaAdsLeadFilter === "ready" && status === "ready") ||
        (metaAdsLeadFilter === "incomplete" &&
          (status === "partial" || status === "critical")) ||
        (metaAdsLeadFilter === "imported" && status === "imported");

      if (!matchesFilter) return false;
      if (!normalizedSearch) return true;

      const searchContent = [
        lead.nome,
        lead.telefone,
        lead.email,
        lead.campaign_name,
        lead.ad_name,
        lead.form_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchContent.includes(normalizedSearch);
    });
  }, [displayedMetaAdsLeads, metaAdsLeadFilter, metaAdsLeadSearchTerm]);

  const selectableFilteredMetaAdsLeadIds = useMemo(
    () =>
      filteredMetaAdsLeads
        .filter((lead) => !lead.imported && lead.id)
        .map((lead) => String(lead.id)),
    [filteredMetaAdsLeads]
  );

  const selectedMetaAdsLeads = useMemo(
    () =>
      displayedMetaAdsLeads.filter((lead) =>
        selectedMetaAdsLeadIds.includes(String(lead.id || ""))
      ),
    [displayedMetaAdsLeads, selectedMetaAdsLeadIds]
  );

  const selectedFilteredMetaAdsLeadCount = useMemo(
    () =>
      selectableFilteredMetaAdsLeadIds.filter((leadId) =>
        selectedMetaAdsLeadIds.includes(leadId)
      ).length,
    [selectableFilteredMetaAdsLeadIds, selectedMetaAdsLeadIds]
  );

  const allFilteredMetaAdsLeadsSelected =
    selectableFilteredMetaAdsLeadIds.length > 0 &&
    selectedFilteredMetaAdsLeadCount === selectableFilteredMetaAdsLeadIds.length;

  useEffect(() => {
    if (metaAdsCampaignOptions.length && !selectedMetaAdsCampaignMappingId) {
      setSelectedMetaAdsCampaignMappingId(metaAdsCampaignOptions[0].id);
    }

    if (!metaAdsCampaignOptions.length) {
      setSelectedMetaAdsCampaignMappingId("");
    }
  }, [metaAdsCampaignOptions, selectedMetaAdsCampaignMappingId]);

  useEffect(() => {
    setMetaAdsMappingScopeType("form");
  }, [selectedMetaAdsFormId]);

  useEffect(() => {
    if (activeTab !== "meta_ads") return;
    void fetchMetaAdsFieldMappingData();
  }, [activeTab, fetchMetaAdsFieldMappingData]);

  useEffect(() => {
    if (activeTab !== "meta_ads") return;

    if (isMetaAdsTabBusy) {
      setMetaAdsTabLoading(true);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setMetaAdsTabLoading(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, isMetaAdsTabBusy]);

  useEffect(() => {
    setBroadcastDraft(createBroadcastDraft(selectedBroadcastList));
  }, [selectedBroadcastList]);

  useEffect(() => {
    setBroadcastListContactSearchTerm("");
  }, [selectedBroadcastListId]);

  useEffect(() => {
    if (!isCreateBroadcastListModalOpen) return;

    setNewBroadcastListMetaParamId((current) => {
      if (
        current &&
        availableMetaIntegrationNumbers.some((account) => String(account.id || "") === current)
      ) {
        return current;
      }

      return String(availableMetaIntegrationNumbers[0]?.id || "");
    });
  }, [availableMetaIntegrationNumbers, isCreateBroadcastListModalOpen]);

  useEffect(() => {
    if (!isAddToListModalOpen) return;
    setSelectedTargetBroadcastListId((current) => {
      if (current && broadcastLists.some((list) => list.id === current)) {
        return current;
      }
      return broadcastLists[0]?.id ?? null;
    });
  }, [broadcastLists, isAddToListModalOpen]);

  const highlightedUpcomingBirthdays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return upcomingBirthdayContacts
      .map((contact) => {
        const nextBirthdayDate = getNextBirthdayDate(contact.birthday);
        if (!nextBirthdayDate) return null;

        const diffMs = nextBirthdayDate.getTime() - today.getTime();
        const daysUntil = Math.round(diffMs / 86400000);
        if (daysUntil < 0 || daysUntil > 5) return null;

        return {
          contact,
          nextBirthdayDate,
          daysUntil,
        };
      })
      .filter(
        (
          item
        ): item is {
          contact: Conversation;
          nextBirthdayDate: Date;
          daysUntil: number;
        } => Boolean(item)
      )
      .sort((a, b) => {
        if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
        return a.contact.name.localeCompare(b.contact.name, "pt-BR");
      })
      .slice(0, UPCOMING_BIRTHDAY_LIMIT);
  }, [UPCOMING_BIRTHDAY_LIMIT, upcomingBirthdayContacts]);

  const totalPages = Math.ceil(totalContacts / ITEMS_PER_PAGE);
  const contactsCountLabel = useMemo(() => {
    const noun = totalContacts === 1 ? "contato" : "contatos";
    return `${totalContacts} ${noun}`;
  }, [totalContacts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilter, normalizedCompositeFilters]);

  useEffect(() => {
    if (totalPages === 0) {
      setCurrentPage(1);
      return;
    }

    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleUpdateContact = (contactData: Partial<Conversation>) => {
    setContacts((prevContacts) =>
      prevContacts.map((contact) =>
        contact.id === contactData.id ? { ...contact, ...contactData } : contact
      )
    );
    setIsEditModalOpen(false);
    void fetchContacts();
    void fetchUpcomingBirthdayContacts();
  };

  const handleDeleteContact = async () => {
    if (contactToDeleteId === null) return;

    try {
      const payload = await encrypt({ cliente_id: contactToDeleteId });
      const response = await fetch(`${API_BASE}/user/remover_cliente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });

      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano?: boolean;
        msg?: string;
      };

      if (resp?.boleano) {
        await fetchContacts();
        await fetchUpcomingBirthdayContacts();
        if (selectedBroadcastListId) {
          await fetchSelectedBroadcastContacts(selectedBroadcastListId);
          await fetchBroadcastListsData(selectedBroadcastListId);
        }
      } else {
        console.error("Erro ao deletar cliente:", resp?.msg);
      }
    } catch (error) {
      console.error("Erro na requisicao de remocao:", error);
    } finally {
      setIsConfirmModalOpen(false);
      setContactToDeleteId(null);
    }
  };

  const handleOpenEditModal = (contact: Conversation) => {
    setEditingContact(contact);
    setIsEditModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    setEditingContact(null);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingContact(null);
  };

  const handleOpenDetailsModal = (contact: Conversation) => {
    setSelectedContact(contact);
    setIsDetailsModalOpen(true);
  };

  const handleOpenConfirmModal = (contactId: number) => {
    setContactToDeleteId(contactId);
    setIsConfirmModalOpen(true);
  };

  const handleOpenAddToListModal = (contact: Conversation) => {
    setSelectedContactForBroadcast(contact);

    if (!broadcastLists.length) {
      setActiveTab("broadcast");
      setIsCreateBroadcastListModalOpen(true);
      addToast({
        type: "info",
        title: "Crie a primeira lista",
        description:
          "Voce ainda nao possui lista de transmissão. Crie uma para adicionar este contato.",
      });
      return;
    }

    setSelectedTargetBroadcastListId(broadcastLists[0]?.id ?? null);
    setIsAddToListModalOpen(true);
  };

  const handleOpenAddContactToSelectedListModal = useCallback(() => {
    if (!selectedBroadcastListId) return;
    setBroadcastContactSearchTerm("");
    setDebouncedBroadcastContactSearchTerm("");
    setSelectedBroadcastContactsToAdd([]);
    setBroadcastContactSearchResults([]);
    setIsAddContactToSelectedListModalOpen(true);
  }, [selectedBroadcastListId]);

  const handleCloseAddContactToSelectedListModal = useCallback(() => {
    setIsAddContactToSelectedListModalOpen(false);
    setBroadcastContactSearchTerm("");
    setDebouncedBroadcastContactSearchTerm("");
    setSelectedBroadcastContactsToAdd([]);
    setBroadcastContactSearchResults([]);
  }, []);

  const loadMetaTemplates = useCallback(async (metaParamId?: number | string) => {
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
        return String(left.name || "").localeCompare(String(right.name || ""), "pt-BR");
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
      addToast({
        type: "error",
        title: "Erro ao carregar templates",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os templates da Meta.",
      });
    } finally {
      setLoadingMetaTemplates(false);
    }
  }, [addToast, user?.empresa_id]);

  const loadMetaIntegrationNumbers = useCallback(async () => {
    if (!user?.empresa_id || !user?.id) {
      setAvailableMetaIntegrationNumbers([]);
      setSelectedMetaIntegrationNumberId("");
      return;
    }

    try {
      setLoadingMetaIntegrationNumbers(true);
      const numbers = await fetchBroadcastMetaNumbers(user.empresa_id, user.id);
      const activeNumbers = numbers.filter((account) => account.ativo !== false);

      setAvailableMetaIntegrationNumbers(activeNumbers);
      setSelectedMetaIntegrationNumberId((current) => {
        if (current && activeNumbers.some((account) => String(account.id || "") === current)) {
          return current;
        }

        return String(activeNumbers[0]?.id || "");
      });
    } catch (error) {
      setAvailableMetaIntegrationNumbers([]);
      setSelectedMetaIntegrationNumberId("");
      addToast({
        type: "error",
        title: "Erro ao carregar numeros da Meta",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os numeros vinculados da Meta.",
      });
    } finally {
      setLoadingMetaIntegrationNumbers(false);
    }
  }, [addToast, user?.empresa_id, user?.id]);

  useEffect(() => {
    if (activeTab !== "broadcast" && !isCreateBroadcastListModalOpen) return;
    void loadMetaIntegrationNumbers();
  }, [activeTab, isCreateBroadcastListModalOpen, loadMetaIntegrationNumbers]);

  useEffect(() => {
    if (!isTemplateDispatchModalOpen) {
      return;
    }

    const normalizedMetaParamId = Number(selectedMetaIntegrationNumberId || 0);
    if (!Number.isInteger(normalizedMetaParamId) || normalizedMetaParamId <= 0) {
      setAvailableMetaTemplates([]);
      setSelectedMetaTemplateName("");
      setLoadingMetaTemplates(false);
      return;
    }

    void loadMetaTemplates(normalizedMetaParamId);
  }, [isTemplateDispatchModalOpen, loadMetaTemplates, selectedMetaIntegrationNumberId]);

  const handleOpenTemplateDispatchModal = (contact: Conversation) => {
    const normalizedPhone = normalizePhoneForWhatsApp(contact.phone);
    if (!normalizedPhone) {
      addToast({
        type: "warning",
        title: "Telefone obrigatorio",
        description: "O cliente precisa ter um telefone valido para receber um template.",
      });
      return;
    }

    setSelectedContactForTemplateDispatch({
      ...contact,
      phone: normalizedPhone,
    });
    setAvailableMetaIntegrationNumbers([]);
    setSelectedMetaIntegrationNumberId("");
    setAvailableMetaTemplates([]);
    setSelectedMetaTemplateName("");
    setMetaTemplateDispatchError("");
    setIsTemplateDispatchModalOpen(true);
    void loadMetaIntegrationNumbers();
  };

  const handleCloseTemplateDispatchModal = () => {
    setIsTemplateDispatchModalOpen(false);
    setSelectedContactForTemplateDispatch(null);
    setAvailableMetaIntegrationNumbers([]);
    setLoadingMetaIntegrationNumbers(false);
    setSelectedMetaIntegrationNumberId("");
    setAvailableMetaTemplates([]);
    setLoadingMetaTemplates(false);
    setSelectedMetaTemplateName("");
    setMetaTemplateLanguage("pt_BR");
    setMetaTemplateHeaderParameters([]);
    setMetaTemplateBodyParameters([]);
    setMetaTemplateButtonParameters({});
    setMetaTemplateHeaderFile(null);
    setMetaTemplateDispatchError("");
  };

  const handleOpenContactDirectSaleModal = (contact: Conversation) => {
    if (!canRegisterDirectSale) {
      addToast({
        type: "warning",
        title: "Acesso comercial necessário",
        description: "Seu usuário precisa de acesso ao módulo Comercial para registrar a venda.",
      });
      return;
    }

    setSelectedContactForDirectSale(contact);
    setPendingContactDirectSale(null);
    setIsContactDirectSaleModalOpen(true);
  };

  const handleCloseContactDirectSaleModal = () => {
    setIsContactDirectSaleModalOpen(false);
    setSelectedContactForDirectSale(null);
  };

  const handlePrepareContactDirectSale = (draft: ContactDirectSaleDraft) => {
    setPendingContactDirectSale(draft);
    setIsContactDirectSaleModalOpen(false);
  };

  const handleCancelPendingContactDirectSale = () => {
    if (savingDirectContactSale) {
      return;
    }

    setPendingContactDirectSale(null);
    setSelectedContactForDirectSale(null);
  };

  const handleMetaTemplateHeaderParameterChange = (
    index: number,
    patch: Partial<TemplateParameterInput>
  ) => {
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
  };

  const handleMetaTemplateBodyParameterChange = (
    index: number,
    patch: Partial<TemplateParameterInput>
  ) => {
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
  };

  const handleMetaTemplateButtonParameterChange = (
    buttonIndex: number,
    parameterIndex: number,
    patch: Partial<TemplateParameterInput>
  ) => {
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
  };

  const handleDispatchTemplateToContact = async () => {
    if (!user?.empresa_id || !selectedContactForTemplateDispatch || !selectedMetaTemplate) {
      return;
    }

    if (!isTemplateApproved(selectedMetaTemplate)) {
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
        templateName: String(selectedMetaTemplate.name || "").trim(),
        language: metaTemplateLanguage.trim() || "pt_BR",
        numero: selectedContactForTemplateDispatch.phone,
        clienteId:
          selectedContactForTemplateDispatch.cliente_id || selectedContactForTemplateDispatch.id,
        contactName: selectedContactForTemplateDispatch.name,
        email: String(selectedContactForTemplateDispatch.email || "").trim() || undefined,
        birthday: selectedContactForTemplateDispatch.birthday || undefined,
        headerParameters: metaTemplateHeaderParameters
          .map(mapTemplateParameterInputToPayload)
          .filter((item) => item !== null),
        bodyParameters: metaTemplateBodyParameters
          .map(mapTemplateParameterInputToPayload)
          .filter((item) => item !== null),
        buttonParameters,
        headerFile: metaTemplateHeaderFile,
      });

      handleCloseTemplateDispatchModal();

      if (result.chat_opened_automatically && result.conversa_id) {
        navigate(`/chat/${result.conversa_id}?status=active`, {
          state: {
            templateDispatchNotice:
              result.guidance_message ||
              "Template enviado. Aguarde o cliente responder para continuar o atendimento.",
          },
        });
        return;
      }

      addToast({
        type: "success",
        title: "Template disparado",
        description:
          result.guidance_message ||
          (result.conversa_id
            ? "O template foi enviado e a conversa do cliente foi preparada para acompanhamento."
            : "O template foi enviado com sucesso."),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel disparar o template para este cliente.";
      setMetaTemplateDispatchError(message);
      addToast({
        type: "error",
        title: "Erro no disparo",
        description: message,
      });
    } finally {
      setDispatchingMetaTemplate(false);
    }
  };

  const handleSelectBroadcastList = (listId: number) => {
    setSelectedBroadcastListId((current) => (current === listId ? null : listId));
    if (isMobile) {
      setIsMobileBroadcastListsModalOpen(false);
    }
  };

  const resetImportState = () => {
    setSelectedImportFile(null);
    setImportRows([]);
    setImportErrors([]);
    setImportWarnings([]);
    setLastImportSummary(null);
    setParsingImportFile(false);
    setImportingContacts(false);
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
    resetImportState();
  };

  const handleParseImportFile = async () => {
    if (!selectedImportFile) {
      addToast({
        type: "error",
        title: "Arquivo obrigatorio",
        description: "Selecione um arquivo CSV ou XLSX para continuar.",
      });
      return;
    }

    try {
      setParsingImportFile(true);
      setLastImportSummary(null);
      const parsed = await parseContactsFromSpreadsheet(selectedImportFile);
      setImportRows(parsed.rows);
      setImportErrors(parsed.errors);
      setImportWarnings(parsed.warnings);

      addToast({
        type: parsed.rows.length ? "success" : "info",
        title: "Arquivo processado",
        description: `${parsed.rows.length} linha(s) valida(s), ${parsed.errors.length} erro(s) e ${parsed.warnings.length} aviso(s).`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Falha ao ler arquivo",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel processar o arquivo selecionado.",
      });
    } finally {
      setParsingImportFile(false);
    }
  };

  const handleImportContacts = async () => {
    if (!importRows.length || !user?.empresa_id) {
      addToast({
        type: "error",
        title: "Nenhuma linha valida",
        description:
          "Processe um arquivo com pelo menos uma linha valida antes de importar.",
      });
      return;
    }

    try {
      setImportingContacts(true);
      const payload = await encrypt({
        empresa_id: user.empresa_id,
        rows: importRows,
      });
      const response = await fetch(`${API_BASE}/user/importar_clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });

      const responseData = await response.json();
      const resp = (await decrypt(responseData.payload)) as {
        boleano?: boolean;
        obj?: {
          criados: number;
          atualizados: number;
          ignorados: number;
          erros?: Array<{ linha: number; mensagem: string }>;
        };
        msg?: string;
      };

      if (!resp?.boleano || !resp.obj) {
        throw new Error(resp?.msg || "Nao foi possivel importar os contatos.");
      }

      setLastImportSummary({
        criados: Number(resp.obj.criados || 0),
        atualizados: Number(resp.obj.atualizados || 0),
        ignorados: Number(resp.obj.ignorados || 0),
        erros: Array.isArray(resp.obj.erros) ? resp.obj.erros : [],
      });

      await fetchContacts();
      await fetchUpcomingBirthdayContacts();
      await fetchBroadcastListsData(selectedBroadcastListId);

      addToast({
        type: "success",
        title: "Importação concluída",
        description: `${resp.obj.criados || 0} criado(s) e ${resp.obj.atualizados || 0} atualizado(s).`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro na importação",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel concluir a importação dos contatos.",
      });
    } finally {
      setImportingContacts(false);
    }
  };

  const persistSelectedBroadcastList = useCallback(async () => {
    if (!user?.empresa_id || !selectedBroadcastListId) {
      throw new Error("Selecione uma lista de transmissão.");
    }

    const normalizedName = broadcastDraft.nome.trim();
    if (!normalizedName) {
      throw new Error("Informe o nome da lista de transmissão.");
    }

    const normalizedMetaParamId = Number(broadcastDraft.metaParamId || 0);
    if (!Number.isInteger(normalizedMetaParamId) || normalizedMetaParamId <= 0) {
      throw new Error("Selecione o numero da Meta vinculado a esta lista.");
    }

    const updated = await updateBroadcastList({
      empresaId: user.empresa_id,
      usuarioId: user.id,
      listaId: selectedBroadcastListId,
      metaParamId: normalizedMetaParamId,
      nome: normalizedName,
      descricao: broadcastDraft.descricao.trim(),
      tagLogic: broadcastDraft.tagLogic,
      tagIds: broadcastDraft.selectedTagIds,
      utmFilters: normalizeDraftUtmFilters(broadcastDraft.utmFilters),
    });

    await fetchBroadcastListsData(updated.id);
    return updated;
  }, [
    broadcastDraft,
    fetchBroadcastListsData,
    selectedBroadcastListId,
    user?.empresa_id,
    user?.id,
  ]);

  const handleSaveBroadcastList = async () => {
    try {
      setSavingBroadcastList(true);
      await persistSelectedBroadcastList();
      addToast({
        type: "success",
        title: "Lista salva",
        description: "As regras da lista de transmissão foram atualizadas.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao salvar lista",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar a lista de transmissão.",
      });
    } finally {
      setSavingBroadcastList(false);
    }
  };

  const handleSyncBroadcastList = async () => {
    if (!user?.empresa_id || !user?.id || !selectedBroadcastListId) return;

    try {
      setSyncingBroadcastList(true);
      await persistSelectedBroadcastList();
      const result = await syncBroadcastList({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        listaId: selectedBroadcastListId,
      });
      await fetchBroadcastListsData(selectedBroadcastListId);
      await fetchSelectedBroadcastContacts(selectedBroadcastListId);

      addToast({
        type: "success",
        title: "Lista sincronizada",
        description: `${result.contatos_encontrados} contato(s) encontrados e ${result.total_contatos} no total da lista.`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro na sincronizacao",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel sincronizar a lista de transmissão.",
      });
    } finally {
      setSyncingBroadcastList(false);
    }
  };

  const handleDeleteBroadcastList = async () => {
    if (!user?.empresa_id || !user?.id || !selectedBroadcastListId || !selectedBroadcastList)
      return;

    const confirmed = window.confirm(
      `Deseja remover a lista "${selectedBroadcastList.nome}"?`
    );
    if (!confirmed) return;

    try {
      await deleteBroadcastList(user.empresa_id, user.id, selectedBroadcastListId);
      await fetchBroadcastListsData();
      setBroadcastListContacts([]);
      addToast({
        type: "success",
        title: "Lista removida",
        description: "A lista de transmissão foi removida com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao remover lista",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel remover a lista de transmissão.",
      });
    }
  };

  const handleCreateBroadcastList = async () => {
    if (!user?.empresa_id || !user?.id) return;

    const normalizedName = newBroadcastListName.trim();
    if (!normalizedName) {
      addToast({
        type: "error",
        title: "Nome obrigatorio",
        description: "Informe o nome da lista de transmissão.",
      });
      return;
    }

    const normalizedMetaParamId = Number(newBroadcastListMetaParamId || 0);
    if (!Number.isInteger(normalizedMetaParamId) || normalizedMetaParamId <= 0) {
      addToast({
        type: "error",
        title: "Numero obrigatorio",
        description: "Selecione o numero da Meta vinculado a esta lista de transmissão.",
      });
      return;
    }

    try {
      setCreatingBroadcastList(true);
      const created = await createBroadcastList({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        metaParamId: normalizedMetaParamId,
        nome: normalizedName,
        descricao: newBroadcastListDescription.trim(),
      });

      setIsCreateBroadcastListModalOpen(false);
      setNewBroadcastListName("");
      setNewBroadcastListDescription("");
      setNewBroadcastListMetaParamId("");
      await fetchBroadcastListsData(created.id);
      setActiveTab("broadcast");

      addToast({
        type: "success",
        title: "Lista criada",
        description: "A nova lista de transmissão ja esta pronta para configuracao.",
      });

      if (selectedContactForBroadcast) {
        setSelectedTargetBroadcastListId(created.id);
        setIsAddToListModalOpen(true);
      }
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao criar lista",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar a lista de transmissão.",
      });
    } finally {
      setCreatingBroadcastList(false);
    }
  };

  const executeAddContactToBroadcastList = useCallback(
    async (contact: Conversation, listId: number) => {
      if (!user?.empresa_id || !user?.id) return false;

      try {
        setAddingContactToBroadcastList(true);
        await addContactToBroadcastList({
          empresaId: user.empresa_id,
          usuarioId: user.id,
          listaId: listId,
          clienteId: Number(contact.cliente_id || contact.id),
        });

        await fetchBroadcastListsData(listId);
        if (selectedBroadcastListId === listId) {
          await fetchSelectedBroadcastContacts(listId);
        }

        addToast({
          type: "success",
          title: "Contato adicionado",
          description: `${contact.name} foi adicionado a lista com sucesso.`,
        });
        return true;
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro ao adicionar contato",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel adicionar o contato a lista de transmissao.",
        });
        return false;
      } finally {
        setAddingContactToBroadcastList(false);
      }
    },
    [
      addToast,
      fetchBroadcastListsData,
      fetchSelectedBroadcastContacts,
      selectedBroadcastListId,
      user?.empresa_id,
      user?.id,
    ]
  );

  const handleConfirmAddToBroadcastList = async () => {
    if (!selectedTargetBroadcastListId || !selectedContactForBroadcast) {
      return;
    }

    const didAdd = await executeAddContactToBroadcastList(
      selectedContactForBroadcast,
      selectedTargetBroadcastListId
    );
    if (!didAdd) return;

    setIsAddToListModalOpen(false);
    setSelectedContactForBroadcast(null);
  };

  const handleConfirmAddContactToSelectedList = async () => {
    if (!selectedBroadcastListId || !selectedBroadcastContactsToAdd.length) {
      return;
    }

    for (const contact of selectedBroadcastContactsToAdd) {
      const didAdd = await executeAddContactToBroadcastList(contact, selectedBroadcastListId);
      if (!didAdd) return;
    }

    handleCloseAddContactToSelectedListModal();
  };

  const handleRemoveBroadcastContact = async (contact: BroadcastListContact) => {
    if (!user?.empresa_id || !user?.id || !selectedBroadcastListId) return;

    try {
      setRemovingBroadcastContactId(contact.cliente_id);
      await removeContactFromBroadcastList({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        listaId: selectedBroadcastListId,
        clienteId: contact.cliente_id,
      });

      await fetchBroadcastListsData(selectedBroadcastListId);
      await fetchSelectedBroadcastContacts(selectedBroadcastListId);

      addToast({
        type: "success",
        title: "Contato removido",
        description: `${contact.nome} foi removido da lista de transmissão.`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao remover contato",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel remover o contato da lista de transmissão.",
      });
    } finally {
      setRemovingBroadcastContactId(null);
    }
  };

  const handleQueueBroadcastContact = useCallback((contact: Conversation) => {
    const contactId = Number(contact.cliente_id || contact.id);
    setSelectedBroadcastContactsToAdd((current) => {
      if (current.some((item) => Number(item.cliente_id || item.id) === contactId)) {
        return current;
      }
      return [...current, contact];
    });
    setBroadcastContactSearchTerm("");
    setDebouncedBroadcastContactSearchTerm("");
    setBroadcastContactSearchResults([]);
  }, []);

  const handleRemoveQueuedBroadcastContact = useCallback((contactId: number) => {
    setSelectedBroadcastContactsToAdd((current) =>
      current.filter((contact) => Number(contact.cliente_id || contact.id) !== contactId)
    );
  }, []);

  const handleToggleBroadcastMobileCard = useCallback((contactId: number) => {
    setExpandedBroadcastMobileCards((current) => ({
      ...current,
      [contactId]: !current[contactId],
    }));
  }, []);

  useEffect(() => {
    let active = true;

    const loadBroadcastContactSearchResults = async () => {
      if (!isAddContactToSelectedListModalOpen) {
        setBroadcastContactSearchResults([]);
        setLoadingBroadcastContactSearch(false);
        return;
      }

      if (!user?.empresa_id) {
        setBroadcastContactSearchResults([]);
        setLoadingBroadcastContactSearch(false);
        return;
      }

      if (!debouncedBroadcastContactSearchTerm) {
        setBroadcastContactSearchResults([]);
        setLoadingBroadcastContactSearch(false);
        return;
      }

      try {
        setLoadingBroadcastContactSearch(true);

        const payload = await encrypt({
          pagina: 1,
          limite: 12,
          empresa_id: user.empresa_id,
          usuario_id: user.id,
          busca: debouncedBroadcastContactSearchTerm,
          filtro: "all",
        });
        const response = await fetch(`${API_BASE}/user/lista_clientes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });

        const respData = await response.json();
        const resp = (await decrypt(respData.payload)) as {
          boleano?: boolean;
          obj?: ContactListResponse;
          msg?: string;
        };

        if (!active) return;

        if (!resp?.boleano) {
          setBroadcastContactSearchResults([]);
          return;
        }

        const searchedContacts = Array.isArray(resp.obj?.items)
          ? resp.obj.items
              .map(normalizeContact)
              .filter(
                (contact) => {
                  const contactId = Number(contact.cliente_id || contact.id);
                  return (
                    !selectedBroadcastContactIds.has(contactId) &&
                    !selectedBroadcastContactsToAdd.some(
                      (queuedContact) =>
                        Number(queuedContact.cliente_id || queuedContact.id) === contactId
                    )
                  );
                }
              )
          : [];

        setBroadcastContactSearchResults(searchedContacts);
      } catch (error) {
        if (!active) return;
        console.error("Erro ao buscar contatos para adicionar a lista:", error);
        setBroadcastContactSearchResults([]);
      } finally {
        if (active) {
          setLoadingBroadcastContactSearch(false);
        }
      }
    };

    void loadBroadcastContactSearchResults();

    return () => {
      active = false;
    };
  }, [
    debouncedBroadcastContactSearchTerm,
    isAddContactToSelectedListModalOpen,
    selectedBroadcastContactIds,
    selectedBroadcastContactsToAdd,
    user?.empresa_id,
  ]);

  const handleToggleMetaAdsLead = (leadId: string) => {
    setSelectedMetaAdsLeadIds((current) =>
      current.includes(leadId)
        ? current.filter((item) => item !== leadId)
        : [...current, leadId]
    );
  };

  const handleToggleMetaAdsLeadFilter = (filter: MetaAdsLeadFilterValue) => {
    setMetaAdsLeadFilter((current) => (current === filter ? "all" : filter));
  };

  const handleClearMetaAdsLeadFilters = () => {
    setMetaAdsLeadSearchTerm("");
    setMetaAdsLeadFilter("all");
  };

  const handleToggleAllMetaAdsLeads = () => {
    setSelectedMetaAdsLeadIds((current) =>
      selectableFilteredMetaAdsLeadIds.every((leadId) => current.includes(leadId))
        ? current.filter((leadId) => !selectableFilteredMetaAdsLeadIds.includes(leadId))
        : [
            ...current.filter((leadId) => !selectableFilteredMetaAdsLeadIds.includes(leadId)),
            ...selectableFilteredMetaAdsLeadIds,
          ]
    );
  };

  const handleImportMetaAdsLeads = async () => {
    if (
      !user?.empresa_id ||
      !selectedMetaAdsAccountId ||
      !selectedMetaAdsLeads.length ||
      !selectedMetaAdsCrmId
    ) {
      if (!selectedMetaAdsCrmId) {
        addToast({
          type: "warning",
          title: "Escolha um funil",
          description:
            "Selecione o funil de destino para enviar os leads para Aguardando Atendimento.",
        });
      }
      return;
    }

    try {
      setImportingMetaAdsLeads(true);
      const leadsToImport = displayedMetaAdsLeads.filter((lead) =>
        selectedMetaAdsLeadIds.includes(String(lead.id || ""))
      );
      const result = await MetaAdsService.importLeads({
        empresaId: user.empresa_id,
        adAccountId: selectedMetaAdsAccountId,
        crmId: Number(selectedMetaAdsCrmId),
        formId: selectedMetaAdsFormId || undefined,
        formName: selectedMetaAdsForm?.name,
        leads: leadsToImport,
      });

      await fetchMetaAdsLeadsData();
      await fetchContacts();

      addToast({
        type: "success",
        title: "Leads importados",
        description: `${result.criados || 0} criado(s), ${result.atualizados || 0} atualizado(s), ${result.ignorados || 0} ignorado(s) e ${result.negocios_criados || 0} enviado(s) para ${selectedMetaAdsCrm?.nome || "funil selecionado"}.`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao importar leads",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel importar os leads selecionados.",
      });
    } finally {
      setImportingMetaAdsLeads(false);
    }
  };

  const handleSaveMetaAdsFieldMapping = async () => {
    if (!user?.empresa_id || !currentMetaAdsMappingScopeId) return;

    try {
      setSavingMetaAdsFieldMapping(true);
      const saved = await MetaAdsService.saveFieldMapping({
        empresaId: user.empresa_id,
        scopeType: metaAdsMappingScopeType,
        scopeId: currentMetaAdsMappingScopeId,
        scopeName: currentMetaAdsMappingScopeName || undefined,
        campoNome: metaAdsFieldMapping?.campo_nome || null,
        campoTelefone: metaAdsFieldMapping?.campo_telefone || null,
        campoEmail: metaAdsFieldMapping?.campo_email || null,
      });
      setMetaAdsFieldMapping(saved);
      await fetchMetaAdsLeadsData();
      addToast({
        type: "success",
        title: "Mapeamento salvo",
        description: "Os campos desse escopo foram salvos com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao salvar mapeamento",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o mapeamento dos campos.",
      });
    } finally {
      setSavingMetaAdsFieldMapping(false);
    }
  };

  const previewImportRows = useMemo(() => importRows.slice(0, 5), [importRows]);

  return (
    <div className="contacts-page-layout">
      <MobileHeader title="Contatos" />

      <header className="contacts-header desktop-only">
        <div className="contacts-header-content">
          <h1>Contatos</h1>
        </div>
      </header>

      <nav className="contacts-view-tabs" aria-label="Visualizacoes de contatos">
        <button
          type="button"
          className={`contacts-view-tab ${activeTab === "clients" ? "active" : ""}`}
          onClick={() => setActiveTab("clients")}
        >
          <FiUsers /> Clientes
        </button>
        <button
          type="button"
          className={`contacts-view-tab ${activeTab === "broadcast" ? "active" : ""}`}
          onClick={() => setActiveTab("broadcast")}
        >
          <FiSend /> Lista de transmissão
        </button>
        <button
          type="button"
          className={`contacts-view-tab ${activeTab === "meta_ads" ? "active" : ""}`}
          onClick={() => setActiveTab("meta_ads")}
        >
          <FiTarget /> Leads Meta Ads
        </button>
      </nav>

      <div className="contacts-desktop-toolbar-shell desktop-only">
          <section
            className={`contacts-toolbar-strip ${activeTab === "broadcast" ? "contacts-toolbar-strip--broadcast" : ""}`}
            aria-label="Ações de contatos"
          >
            {activeTab === "clients" ? (
              <>
                <div className="contacts-header-tools">
                <div className="contacts-toolbar-filters">
                  <label className="contacts-filter-field contacts-filter-field--search">
                    <ContactSearchInput
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder="Buscar por nome, email, telefone ou funil..."
                    />
                  </label>
                  {renderClientMainFiltersFields()}
                  <details
                    className="contacts-toolbar-menu contacts-toolbar-menu--filters"
                    ref={(element) => {
                      toolbarMenusRef.current[0] = element;
                    }}
                  >
                    <summary className="contacts-toolbar-button contacts-toolbar-button--outline">
                      <FiFilter />
                      Mais filtros
                      {activeClientMoreFilterCount > 0 && (
                        <span className="contacts-toolbar-menu__badge">
                          {activeClientMoreFilterCount}
                        </span>
                      )}
                      <FiChevronDown />
                    </summary>
                    <div className="contacts-toolbar-menu__panel">
                      {renderClientAdvancedFiltersFields()}
                    </div>
                  </details>
                  {hasAnyClientFilters && (
                    <button
                      type="button"
                      className="contacts-toolbar-button contacts-toolbar-button--outline contacts-clear-filters-button"
                      onClick={clearClientFilters}
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
                <div className="contacts-toolbar-actions contacts-toolbar-actions--right">
                  <details
                    className="contacts-toolbar-menu"
                    ref={(element) => {
                      toolbarMenusRef.current[1] = element;
                    }}
                  >
                    <summary className="contacts-toolbar-button contacts-toolbar-button--outline">
                      Ações
                      <FiChevronDown />
                    </summary>
                    <div className="contacts-toolbar-menu__panel contacts-toolbar-menu__panel--actions">
                      <button
                        type="button"
                        className="contacts-toolbar-menu__item"
                        onClick={handleOpenExportModal}
                      >
                        <FiDownload /> Exportar contatos
                      </button>
                      <button
                        type="button"
                        className="contacts-toolbar-menu__item"
                        onClick={() => setIsImportModalOpen(true)}
                      >
                        <FiUpload /> Importar CSV/XLSX
                      </button>
                    </div>
                  </details>
                  <button
                    type="button"
                    className="contacts-toolbar-button contacts-toolbar-button--primary contacts-create-button"
                    onClick={handleOpenCreateModal}
                  >
                    <FiPlus /> Criar contato
                  </button>
                </div>
                </div>
              </>
            ) : activeTab === "broadcast" ? null : (
              <div className="contacts-header-tools">
                <div className="contacts-toolbar-filters">
                  <label className="contacts-filter-field">
                    <span>Funil de destino</span>
                    <select
                      value={selectedMetaAdsCrmId}
                      onChange={(event) => setSelectedMetaAdsCrmId(event.target.value)}
                      disabled={loadingMetaAdsCrms || !metaAdsCrms.length}
                    >
                      {metaAdsCrms.length ? (
                        metaAdsCrms.map((crm) => (
                          <option key={crm.id} value={String(crm.id)}>
                            {crm.nome}
                          </option>
                        ))
                      ) : (
                        <option value="">Nenhum funil disponivel</option>
                      )}
                    </select>
                  </label>
                  <label className="contacts-filter-field">
                    <span>Conta de anuncios</span>
                    <select
                      value={selectedMetaAdsAccountId}
                      onChange={(event) => handleMetaAdsAccountChange(event.target.value)}
                      disabled={loadingMetaAdsAccounts || !metaAdsAccounts.length}
                    >
                      {metaAdsAccounts.length ? (
                        metaAdsAccounts.map((account) => (
                          <option
                            key={String(account.ad_account_id || account.id)}
                            value={String(account.ad_account_id || "")}
                          >
                            {account.ad_account_name || account.ad_account_id}
                          </option>
                        ))
                      ) : (
                        <option value="">Nenhuma conta vinculada</option>
                      )}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </section>
      </div>

      <div className="mobile-only contacts-mobile-tools">
        {activeTab === "clients" ? (
          <>
            <div className="contacts-mobile-client-toolbar">
              <ContactSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar contatos..."
              />
                <div className="contacts-mobile-client-toolbar__summary">
                  <div className="contacts-mobile-client-toolbar__count">
                  <strong>
                    {loading && !contacts.length ? "Carregando contatos..." : contactsCountLabel}
                  </strong>
                  <span>
                    {isRefreshingContacts
                      ? "Atualizando resultados..."
                      : hasAnyClientFilters
                      ? "Resultados filtrados em tempo real."
                      : "Total da base de contatos."}
                  </span>
                </div>
                <div className="contacts-mobile-client-toolbar__filter-actions">
                  <button
                    type="button"
                    className="contacts-toolbar-button contacts-toolbar-button--outline contacts-mobile-filter-trigger"
                    onClick={() => setIsMobileClientFiltersModalOpen(true)}
                  >
                    <FiFilter />
                    Filtros
                    {activeClientAdvancedFilterCount > 0 && (
                      <span className="contacts-mobile-filter-badge">
                        {activeClientAdvancedFilterCount}
                      </span>
                    )}
                  </button>
                  {hasAnyClientFilters && (
                    <button
                      type="button"
                      className="contacts-toolbar-button contacts-toolbar-button--outline contacts-mobile-clear-trigger contacts-clear-filters-button"
                      onClick={clearClientFilters}
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
                <div className="contacts-toolbar-actions contacts-mobile-client-toolbar__quick-actions">
                  <button
                    type="button"
                    className="contacts-toolbar-button contacts-toolbar-button--primary contacts-create-button"
                    onClick={handleOpenCreateModal}
                    aria-label="Criar contato"
                    title="Criar contato"
                  >
                  <FiPlus /> 
                  </button>
                  <details
                    className="contacts-toolbar-menu contacts-toolbar-menu--mobile"
                    ref={(element) => {
                      toolbarMenusRef.current[2] = element;
                    }}
                  >
                    <summary
                      className="contacts-toolbar-button contacts-toolbar-button--outline"
                      aria-label="Acoes de contatos"
                      title="Acoes de contatos"
                    >
                      Ações
                      <FiChevronDown />
                    </summary>
                    <div className="contacts-toolbar-menu__panel contacts-toolbar-menu__panel--actions">
                      <button
                        type="button"
                        className="contacts-toolbar-menu__item"
                        onClick={handleOpenExportModal}
                      >
                        <FiDownload /> Exportar contatos
                      </button>
                      <button
                        type="button"
                        className="contacts-toolbar-menu__item"
                        onClick={() => setIsImportModalOpen(true)}
                      >
                        <FiUpload /> Importar CSV/XLSX
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </>
        ) : activeTab === "broadcast" ? null : (
          <>
            <div className="contacts-toolbar-filters contacts-toolbar-filters--mobile">
              <label className="contacts-filter-field">
                <span>Funil de destino</span>
                <select
                  value={selectedMetaAdsCrmId}
                  onChange={(event) => setSelectedMetaAdsCrmId(event.target.value)}
                  disabled={loadingMetaAdsCrms || !metaAdsCrms.length}
                >
                  {metaAdsCrms.length ? (
                    metaAdsCrms.map((crm) => (
                      <option key={crm.id} value={String(crm.id)}>
                        {crm.nome}
                      </option>
                    ))
                  ) : (
                    <option value="">Nenhum funil disponivel</option>
                  )}
                </select>
              </label>
              <label className="contacts-filter-field">
                <span>Conta de anuncios</span>
                <select
                  value={selectedMetaAdsAccountId}
                  onChange={(event) => handleMetaAdsAccountChange(event.target.value)}
                  disabled={loadingMetaAdsAccounts || !metaAdsAccounts.length}
                >
                  {metaAdsAccounts.length ? (
                    metaAdsAccounts.map((account) => (
                      <option
                        key={String(account.ad_account_id || account.id)}
                        value={String(account.ad_account_id || "")}
                      >
                        {account.ad_account_name || account.ad_account_id}
                      </option>
                    ))
                  ) : (
                    <option value="">Nenhuma conta vinculada</option>
                  )}
                </select>
              </label>
            </div>
            <div className="contacts-toolbar-actions contacts-toolbar-actions--mobile">
              <button
                type="button"
                className="contacts-toolbar-button contacts-toolbar-button--outline"
                onClick={() => {
                  void fetchMetaAdsCrmsData();
                  void fetchMetaAdsAccountsData();
                }}
              >
                <FiRefreshCw /> Atualizar
              </button>
              <button
                type="button"
                className="contacts-toolbar-button contacts-toolbar-button--primary"
                onClick={() => void handleImportMetaAdsLeads()}
                disabled={
                  importingMetaAdsLeads ||
                  !selectedMetaAdsLeads.length ||
                  !selectedMetaAdsCrmId
                }
              >
                <FiUpload /> Importar
              </button>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={isMobile && activeTab === "clients" && isMobileClientFiltersModalOpen}
        onClose={() => setIsMobileClientFiltersModalOpen(false)}
        title="Filtrar clientes"
      >
        <div className="contacts-mobile-filter-modal">
          <div className="contacts-mobile-filter-modal__intro">
            <p>
              Os filtros são aplicados em tempo real. Ajuste os campos abaixo e feche
              para voltar aos resultados.
            </p>
          </div>
          <div className="contacts-toolbar-filters contacts-toolbar-filters--mobile contacts-mobile-filter-fields">
            {renderClientFiltersFields()}
          </div>
          <div className="contacts-mobile-filter-modal__actions">
            {hasAnyClientFilters && (
              <button
                type="button"
                className="contacts-toolbar-button contacts-toolbar-button--outline contacts-clear-filters-button"
                onClick={clearClientFilters}
              >
                Limpar filtros
              </button>
            )}
            <button
              type="button"
              className="contacts-toolbar-button contacts-toolbar-button--primary"
              onClick={() => setIsMobileClientFiltersModalOpen(false)}
            >
              Ver resultados
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={activeTab === "clients" && isEntryDateFilterModalOpen}
        onClose={() => setIsEntryDateFilterModalOpen(false)}
        title="Data de entrada"
        size="sm"
      >
        <div className="contacts-entry-date-modal">
          <div className="contacts-entry-date-modal__intro">
            <p>Defina o periodo de entrada dos contatos e aplique o filtro em conjunto.</p>
          </div>
          <div className="contacts-entry-date-modal__fields">
            <label className="contacts-filter-field">
              <span>Data inicial</span>
              <input
                type="date"
                value={entryDateFilterDraft.data_entrada_inicial}
                onChange={(event) =>
                  setEntryDateFilterDraft((current) => ({
                    ...current,
                    data_entrada_inicial: event.target.value,
                  }))
                }
              />
            </label>
            <label className="contacts-filter-field">
              <span>Data final</span>
              <input
                type="date"
                value={entryDateFilterDraft.data_entrada_final}
                onChange={(event) =>
                  setEntryDateFilterDraft((current) => ({
                    ...current,
                    data_entrada_final: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="contacts-entry-date-modal__actions">
            {(normalizedCompositeFilters.data_entrada_inicial ||
              normalizedCompositeFilters.data_entrada_final ||
              entryDateFilterDraft.data_entrada_inicial ||
              entryDateFilterDraft.data_entrada_final) && (
              <button
                type="button"
                className="contacts-toolbar-button contacts-toolbar-button--outline"
                onClick={clearEntryDateFilter}
              >
                Limpar periodo
              </button>
            )}
            <button
              type="button"
              className="contacts-toolbar-button contacts-toolbar-button--outline"
              onClick={() => setIsEntryDateFilterModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="contacts-toolbar-button contacts-toolbar-button--primary"
              onClick={applyEntryDateFilter}
            >
              Aplicar periodo
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isMobile && activeTab === "broadcast" && isMobileBroadcastListsModalOpen}
        onClose={() => setIsMobileBroadcastListsModalOpen(false)}
        title="Selecionar lista"
      >
        <div className="broadcast-mobile-lists-modal">
          <div className="broadcast-mobile-lists-modal__intro">
            <strong>Escolha a lista para editar regras e contatos.</strong>       
          </div>
          {renderBroadcastListSelector()}
        </div>
      </Modal>

      <Modal
        isOpen={isMobile && activeTab === "meta_ads" && isMobileMetaAdsFormsModalOpen}
        onClose={() => setIsMobileMetaAdsFormsModalOpen(false)}
        title="Selecionar formulario"
      >
        <div className="broadcast-mobile-lists-modal">
          <div className="broadcast-mobile-lists-modal__intro">
            <strong>Escolha o formulario para recuperar e importar os leads.</strong>
          </div>
          {renderMetaAdsFormSelector()}
        </div>
      </Modal>

      <main className="contacts-content">
        {activeTab === "clients" ? (
          loading ? (
            <p>Carregando contatos...</p>
          ) : (
            <>
              {highlightedUpcomingBirthdays.length > 0 && (
                <section className="contacts-birthday-highlight">
                  <div className="contacts-birthday-highlight__header">
                    <div className="contacts-birthday-highlight__content">
                      <span className="contacts-birthday-highlight__eyebrow">
                        Relacionamento
                      </span>
                      <h2>Leads com aniversário nos próximos 5 dias</h2>
                      <p>
                        Destaque rapido para contatos que pedem uma ação de relacionamento
                        imediata.
                      </p>
                      <button
                        type="button"
                        className="contacts-birthday-highlight__toggle"
                        onClick={() =>
                          setIsBirthdayHighlightExpanded((current) => !current)
                        }
                      >
                        {isBirthdayHighlightExpanded ? "Fechar exibição" : "Ver mais"}
                      </button>
                    </div>
                    <strong className="contacts-birthday-highlight__count">
                      {upcomingBirthdayTotal} lead(s)
                    </strong>
                  </div>

                  {isBirthdayHighlightExpanded && (
                    <div className="contacts-birthday-highlight__grid">
                      {highlightedUpcomingBirthdays.map(
                        ({ contact, nextBirthdayDate, daysUntil }) => (
                          <button
                            key={`birthday-highlight-${contact.id}`}
                            type="button"
                            className="birthday-highlight-card"
                            onClick={() => handleOpenDetailsModal(contact)}
                          >
                            <div className="birthday-highlight-card__top">
                              <span className="birthday-highlight-card__when">
                                {formatDaysUntilLabel(daysUntil)}
                              </span>
                              <span className="birthday-highlight-card__date">
                                <FiCalendar size={14} />{" "}
                                {formatDateShort(nextBirthdayDate.toISOString().slice(0, 10))}
                              </span>
                            </div>
                            <strong>{contact.name || "Sem nome"}</strong>
                            <p>{contact.phone || contact.email || "Sem telefone ou email"}</p>
                            <small>Clique para abrir o contato</small>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </section>
              )}

              {contacts.length === 0 && (
                <p className="no-results-message">Nenhum contato encontrado.</p>
              )}

              <div className="contacts-grid">
                {contacts.map((contact) => {
                  const tags = Array.isArray(contact.tags) ? contact.tags : [];
                  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
                  const hiddenTagsCount = Math.max(tags.length - MAX_VISIBLE_TAGS, 0);

                  return (
                    <article key={contact.id} className="contact-card">
                      <div className="card-header" style={{ padding: "0" }}>
                        <Avatar
                          name={contact.name}
                          color={contact.avatarColor}
                          size="small"
                        />
                        <div className="card-contact-info">
                          <h3 className="card-name" title={contact.name}>
                            {getFirstTwoNames(contact.name) || "Sem nome"}
                          </h3>
                          {contact.email && (
                            <p className="card-detail">
                              <FiMail size={12} /> {contact.email}
                            </p>
                          )}
                          <p className="card-detail">
                            <FiPhone size={12} /> {contact.phone || "-"}
                          </p>
                        </div>
                        <span className={`card-badge contact-card-badge contact-origin-badge origin-${normalizeContactOrigin(contact.origem)}`}>
                          <FiTarget size={12} />
                          <span className="card-badge__label">Origem:</span>
                          <span className="card-badge__value">{formatContactOrigin(contact.origem)}</span>
                        </span>
                      </div>
                      <div className="info-cards-separator">
                      <div className="card-badges">
                        <span className="card-badge contact-card-badge contact-card-info-badge">
                          <FiCalendar size={12} />
                          <span className="card-badge__label">Aniversário:</span>
                          <span className="card-badge__value">{formatDate(contact.birthday)}</span>
                        </span>
                        <span className="card-badge contact-card-badge contact-card-info-badge">
                          <FiClock size={12} />
                          <span className="card-badge__label">Cliente desde</span>
                          <span className="card-badge__value">{formatDate(contact.data_cadastro)}</span>
                        </span>
                      </div>

                      <div className="card-tags-section">
                        {visibleTags.length ? (
                          visibleTags.map((tag) => (
                            <span key={tag.id} className="tag-item-table">
                              {tag.name}
                            </span>
                          ))
                        ) : (
                          <span className="tag-item-table empty">Sem tags</span>
                        )}

                        {hiddenTagsCount > 0 && (
                          <span className="tag-item-table more-tags">
                            +{hiddenTagsCount} tags
                          </span>
                        )}
                      </div>
                    </div>
                      <div className="card-actions">
                        <div className="card-actions__group">
                        <button
                          className="action-button danger"
                          onClick={() => handleOpenConfirmModal(contact.id)}
                          title="Excluir contato"
                        >
                          <FiTrash2 />
                        </button>
                         <button
                          className="action-button"
                          onClick={() => handleOpenEditModal(contact)}
                          title="Editar contato"
                        >
                          <FiEdit />
                        </button>
                        <button
                          className="action-button action-button-primary action-button-icon"
                          onClick={() => handleOpenDetailsModal(contact)}
                           title="Ver detalhes do contato"
                        >
                          <FiEye /> 
                        </button>
                        </div>
                       
                        <div className="card-actions__group">
                        {canRegisterDirectSale ? (
                          <button
                            className="action-button action-button-primary action-button-direct-sale"
                            onClick={() => handleOpenContactDirectSaleModal(contact)}
                            title="Registrar venda direta para este cliente"
                          >
                            <FiDollarSign />
                          </button>
                        ) : null}
                        <button
                          className="action-button action-button-list-save"
                          onClick={() => handleOpenAddToListModal(contact)}
                          title="Adicionar a lista de transmissão"
                        >
                          <FiSave />
                          
                        </button>
                         <button
                          className="action-button action-button-template"
                          onClick={() => handleOpenTemplateDispatchModal(contact)}
                          title="Disparar template para este cliente"
                        >
                          <FiSend />
                        </button>
                        </div>
                       
                      </div>
                    </article>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="contacts-pagination-controls">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    Anterior
                  </button>
                  <span>
                    Pagina {currentPage} de {totalPages} · {totalContacts} contato(s)
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                  >
                    Proxima
                  </button>
                </div>
              )}
            </>
          )
        ) : activeTab === "broadcast" ? (
          <section className="broadcast-layout">
            {isMobile ? (
              <section className="broadcast-mobile-summary">
                <div className="broadcast-mobile-summary__content">                
                  <span>
                    {selectedBroadcastList
                      ? `${selectedBroadcastList.total_contatos} contato(s) - ${broadcastLists.length} lista(s) cadastrada(s)`
                      : `${broadcastLists.length} lista(s) cadastrada(s)`}
                  </span>
                </div>
                <div className="broadcast-mobile-summary__actions">
                  <button
                    type="button"
                    className="contacts-toolbar-button contacts-toolbar-button--outline"
                    onClick={() => setIsMobileBroadcastListsModalOpen(true)}
                  >
                    <FiList /> Listas
                  </button>
                  <button
                    type="button"
                    className="contacts-toolbar-button contacts-toolbar-button--primary"
                    onClick={() => setIsCreateBroadcastListModalOpen(true)}
                  >
                    <FiPlus /> Nova lista
                  </button>
                </div>
              </section>
            ) : (
            <aside className="broadcast-sidebar">
              <div className="broadcast-sidebar-header">
                <div>
                  <strong>Listas</strong>
                  <span>{broadcastLists.length} cadastrada(s)</span>
                </div>
                <button
                  type="button"
                  className="contacts-toolbar-button contacts-toolbar-button desktop-only"
                  onClick={() => setIsCreateBroadcastListModalOpen(true)}
                >
                  <FiPlus /> Nova lista
                </button>
              </div>

              {loadingBroadcastLists ? (
                <p className="broadcast-empty-state">Carregando listas...</p>
              ) : broadcastLists.length ? (
                <div className="broadcast-list-stack">
                  {broadcastLists.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      className={`broadcast-list-card ${
                        list.id === selectedBroadcastListId ? "active" : ""
                      }`}
                      onClick={() => handleSelectBroadcastList(list.id)}
                    >
                      <div className="broadcast-list-card-top">
                        <strong>{list.nome}</strong>
                        <span>{list.total_contatos} contato(s)</span>
                      </div>
                      <p>{list.descricao || "Sem descrição."}</p>
                      <div className="broadcast-list-card-meta">
                        <span>{formatBroadcastListMetaLabel(list)}</span>
                        <span>{list.tags.length} tag(s)</span>
                        <span>
                          {Object.keys(list.utm_filters || {}).length} filtro(s) de UTM
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="broadcast-empty-state">
                  <FiTarget />
                  <strong>Nenhuma lista criada</strong>
                  <p>
                    Crie a primeira lista de transmissão para montar segmentos por tags,
                    UTMs e inclusões manuais.
                  </p>
                </div>
              )}
            </aside>
            )}

            <div className="broadcast-main">
              {selectedBroadcastList ? (
                <>
                  <section className="broadcast-panel">
                    <div className="broadcast-panel-header">
                      <div>
                        <h2>{selectedBroadcastList.nome}</h2>
                        <p>
                          Contatos manuais continuam na lista mesmo depois das
                          sincronizações por segmento.
                        </p>
                        <p>{formatBroadcastListMetaLabel(selectedBroadcastList)}</p>
                      </div>
                      <div className="broadcast-panel-actions">
                        <button
                          type="button"
                          className="contacts-toolbar-button contacts-toolbar-button--outline"
                          onClick={() => void handleSaveBroadcastList()}
                          disabled={savingBroadcastList || syncingBroadcastList}
                          aria-label="Salvar regras"
                          title="Salvar regras"
                        >
                          {savingBroadcastList ? (
                            "..."
                            
                          ) : isMobile ? (
                            <FiSave />
                          ) : (
                            "Salvar regras"
                          )}
                        </button>
                        <button
                          type="button"
                          className="contacts-toolbar-button contacts-toolbar-button--primary"
                          onClick={() => void handleSyncBroadcastList()}
                          disabled={savingBroadcastList || syncingBroadcastList}
                          aria-label="Sincronizar contatos"
                          title="Sincronizar contatos"
                        >
                          {syncingBroadcastList ? (
                            "Sincronizando..."
                          ) : isMobile ? (
                            <FiRefreshCw />
                          ) : (
                            "Sincronizar contatos"
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="broadcast-form-grid">
                      <label className="broadcast-field">
                        <span>Numero da Meta</span>
                        <select
                          value={broadcastDraft.metaParamId}
                          onChange={(event) =>
                            setBroadcastDraft((current) => ({
                              ...current,
                              metaParamId: event.target.value,
                            }))
                          }
                          disabled={loadingMetaIntegrationNumbers}
                        >
                          <option value="">
                            {loadingMetaIntegrationNumbers
                              ? "Carregando numeros..."
                              : "Selecione um numero"}
                          </option>
                          {availableMetaIntegrationNumbers.map((account) => (
                            <option key={String(account.id || "")} value={String(account.id || "")}>
                              {formatMetaIntegrationNumberLabel(account)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="broadcast-field">
                        <span>Nome da lista</span>
                        <input
                          type="text"
                          value={broadcastDraft.nome}
                          onChange={(event) =>
                            setBroadcastDraft((current) => ({
                              ...current,
                              nome: event.target.value,
                            }))
                          }
                          placeholder="Ex.: Leads campanha maio"
                        />
                      </label>

                      <label className="broadcast-field broadcast-field--full">
                        <span>Descrição</span>
                        <textarea
                          value={broadcastDraft.descricao}
                          onChange={(event) =>
                            setBroadcastDraft((current) => ({
                              ...current,
                              descricao: event.target.value,
                            }))
                          }
                          placeholder="Descreva o objetivo desta lista..."
                          rows={3}
                        />
                      </label>
                    </div>

                    <div className="broadcast-rule-block">
                      <div className="broadcast-rule-block-header">
                        <strong>Regras por tags</strong>
                        <span>
                          Adicione uma ou varias tags e escolha se o contato precisa ter
                          todas ou apenas uma delas.
                        </span>
                      </div>

                      <div className="broadcast-tag-logic-switch">
                        <button
                          type="button"
                          className={broadcastDraft.tagLogic === "or" ? "active" : ""}
                          onClick={() =>
                            setBroadcastDraft((current) => ({
                              ...current,
                              tagLogic: "or",
                            }))
                          }
                        >
                          OU
                        </button>
                        <button
                          type="button"
                          className={broadcastDraft.tagLogic === "and" ? "active" : ""}
                          onClick={() =>
                            setBroadcastDraft((current) => ({
                              ...current,
                              tagLogic: "and",
                            }))
                          }
                        >
                          E
                        </button>
                      </div>

                      <div className="broadcast-tag-grid">
                        {availableTags.length ? (
                          availableTags.map((tag) => {
                            const checked = broadcastDraft.selectedTagIds.includes(tag.id);
                            return (
                              <label key={tag.id} className={`broadcast-tag-chip ${checked ? "active" : ""}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setBroadcastDraft((current) => ({
                                      ...current,
                                      selectedTagIds: checked
                                        ? current.selectedTagIds.filter((item) => item !== tag.id)
                                        : [...current.selectedTagIds, tag.id],
                                    }))
                                  }
                                />
                                <span>{tag.name}</span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="broadcast-empty-inline">
                            Nenhuma tag cadastrada. Crie tags nos contatos para usar esta segmentação.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="broadcast-rule-block">
                      <div className="broadcast-rule-block-header">
                        <strong>Regras por UTM</strong>
                        <span>
                          Os filtros de UTM são combinados entre si. Preencha apenas os que
                          quiser considerar.
                        </span>
                      </div>

                      <div className="broadcast-form-grid">
                        {([
                          ["utm_source", "UTM Source"],
                          ["utm_medium", "UTM Medium"],
                          ["utm_campaign", "UTM Campaign"],
                          ["utm_term", "UTM Term"],
                          ["utm_content", "UTM Content"],
                          ["utm_id", "UTM ID"],
                        ] as Array<[keyof BroadcastUtmFilters, string]>).map(([key, label]) => (
                          <label key={key} className="broadcast-field">
                            <span>{label}</span>
                            <input
                              type="text"
                              value={String(broadcastDraft.utmFilters[key] || "")}
                              onChange={(event) =>
                                setBroadcastDraft((current) => ({
                                  ...current,
                                  utmFilters: {
                                    ...current.utmFilters,
                                    [key]: event.target.value,
                                  },
                                }))
                              }
                              placeholder={`Filtrar por ${label.toLowerCase()}`}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="broadcast-footnote">
                      <FiTarget />
                      A sincronização automática usa as regras de tags e UTMs.
                    </div>

                    <div className="broadcast-danger-zone">
                      <button
                        type="button"
                        className="broadcast-danger-button"
                        onClick={() => void handleDeleteBroadcastList()}
                      >
                        <FiTrash2 /> Remover lista
                      </button>
                    </div>
                  </section>

                  <section className="broadcast-panel">
                    <div className="broadcast-panel-header">
                      <div>
                        <h2>Contatos da lista</h2>
                        <p>
                          {broadcastListContactSearchTerm.trim()
                            ? `${filteredBroadcastListContacts.length} de ${selectedBroadcastList.total_contatos} contato(s) encontrados.`
                            : `${selectedBroadcastList.total_contatos} contato(s) no momento.`}
                        </p>
                      </div>
                      <div className="broadcast-panel-actions">
                        <button
                          type="button"
                          className="contacts-toolbar-button contacts-toolbar-button--primary"
                          onClick={handleOpenAddContactToSelectedListModal}
                          disabled={addingContactToBroadcastList}
                        >
                          {addingContactToBroadcastList ? <FiRefreshCw /> : <FiPlus />}
                          {isMobile ? "" : "Adicionar contato"}
                        </button>
                      </div>
                    </div>

                    <div className="broadcast-panel-search">
                      <div className="search-bar-wrapper">
                        <FiSearch className="search-icon" />
                        <input
                          type="text"
                          value={broadcastListContactSearchTerm}
                          onChange={(event) =>
                            setBroadcastListContactSearchTerm(event.target.value)
                          }
                          placeholder="Buscar contato da lista por nome ou telefone"
                        />
                      </div>
                    </div>

                    {loadingBroadcastContacts ? (
                      <p className="broadcast-empty-inline">Carregando contatos da lista...</p>
                    ) : filteredBroadcastListContacts.length ? (
                      isMobile ? (
                        <div className="broadcast-contacts-mobile-list">
                          {filteredBroadcastListContacts.map((contact) => {
                            const isExpanded = Boolean(
                              expandedBroadcastMobileCards[contact.cliente_id]
                            );

                            return (
                              <article
                                key={`${contact.cliente_id}-${contact.id}`}
                                className="broadcast-contact-mobile-card"
                              >
                                <div className="broadcast-contact-mobile-card__header">
                                  <div className="broadcast-contact-main">
                                    <strong>{contact.nome}</strong>
                                    <small>Desde {formatDate(contact.data_cadastro)}</small>
                                  </div>
                                  <div className="broadcast-contact-mobile-card__actions">
                                    <span
                                      className={`broadcast-origin-pill origin-${contact.origem}`}
                                    >
                                      {formatBroadcastOrigin(contact.origem)}
                                    </span>
                                    <button
                                      type="button"
                                      className="broadcast-row-remove broadcast-row-remove--icon"
                                      onClick={() => void handleRemoveBroadcastContact(contact)}
                                      disabled={removingBroadcastContactId === contact.cliente_id}
                                      aria-label="Remover contato"
                                      title="Remover contato"
                                    >
                                      <FiTrash2 />
                                    </button>
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <div className="broadcast-contact-mobile-card__meta">
                                    <span>Telefone: {contact.telefone || "-"}</span>
                                    <span>Email: {contact.email || "-"}</span>
                                    <span>Aniversário: {formatDate(contact.data_aniversario)}</span>
                                  </div>
                                ) : null}
                                <button
                                  type="button"
                                  className="broadcast-mobile-expand"
                                  onClick={() =>
                                    handleToggleBroadcastMobileCard(contact.cliente_id)
                                  }
                                >
                                  {isExpanded ? (
                                    <>
                                      <FiChevronUp /> Ver menos
                                    </>
                                  ) : (
                                    <>
                                      <FiChevronDown /> Ver mais
                                    </>
                                  )}
                                </button>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="broadcast-contacts-table-wrap">
                          <table className="broadcast-contacts-table">
                            <thead>
                              <tr>
                                <th>Contato</th>
                                <th>Telefone</th>
                                <th>Email</th>
                                <th>Origem</th>
                                <th>Aniversário</th>
                                <th>Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredBroadcastListContacts.map((contact) => (
                                <tr key={`${contact.cliente_id}-${contact.id}`}>
                                  <td>
                                    <div className="broadcast-contact-main">
                                      <strong>{contact.nome}</strong>
                                      <small>
                                        Desde {formatDate(contact.data_cadastro)}
                                      </small>
                                    </div>
                                  </td>
                                  <td>{contact.telefone || "-"}</td>
                                  <td>{contact.email || "-"}</td>
                                  <td>
                                    <span className={`broadcast-origin-pill origin-${contact.origem}`}>
                                      {formatBroadcastOrigin(contact.origem)}
                                    </span>
                                  </td>
                                  <td>{formatDate(contact.data_aniversario)}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="broadcast-row-remove"
                                      onClick={() => void handleRemoveBroadcastContact(contact)}
                                      disabled={removingBroadcastContactId === contact.cliente_id}
                                    >
                                      {removingBroadcastContactId === contact.cliente_id
                                        ? "Removendo..."
                                        : "Remover"}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : broadcastListContacts.length ? (
                      <div className="broadcast-empty-state broadcast-empty-state--light">
                        <FiSearch />
                        <strong>Nenhum contato encontrado</strong>
                        <p>
                          Ajuste a busca por nome ou telefone para localizar alguém desta
                          lista.
                        </p>
                      </div>
                    ) : (
                      <div className="broadcast-empty-state broadcast-empty-state--light">
                        <FiSend />
                        <strong>Nenhum contato na lista</strong>
                        <p>
                          Salve regras e sincronize por tags/UTMs, ou adicione contatos
                          manualmente pela aba de clientes.
                        </p>
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <div className="broadcast-empty-state broadcast-empty-state--main">
                  {broadcastLists.length ? (
                    <>
                      <FiList />
                      <strong>Selecione uma lista</strong>
                      <p>
                        Escolha uma lista cadastrada para visualizar os contatos e editar
                        as informacoes dela.
                      </p>
                    </>
                  ) : (
                    <>
                      <FiSend />
                      <strong>Nenhuma lista criada</strong>
                      <p>
                        Crie uma nova lista para comecar a organizar sua segmentacao de
                        transmissão.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="contacts-meta-ads-tab-content">
            {shouldShowMetaAdsTabLoading ? (
              <div className="contacts-meta-ads-tab-loading" aria-live="polite">
                <div
                  className="contacts-meta-ads-tab-loading__spinner"
                  aria-hidden="true"
                />
                <div className="contacts-meta-ads-tab-loading__text">
                  <strong>Carregando...</strong>
                  <span>
                    Aguarde enquanto os dados de formularios, leads e mapeamentos são
                    preparados.
                  </span>
                </div>
              </div>
            ) : null}

            <div
              className={`contacts-meta-ads-tab-panel ${
                shouldShowMetaAdsTabLoading ? "is-loading" : ""
              }`}
            >
              {hasNoMetaAdsInfoForAccount ? (
                <section className="meta-ads-leads-layout">
            <div className="broadcast-empty-state broadcast-empty-state--main">
              <FiTarget />
              <strong>Não há informações para esta conta de anuncios</strong>
              <p>
                {selectedMetaAdsAccount?.ad_account_name || "A conta selecionada"} ainda não
                retornou formularios nem leads disponiveis.
              </p>
            </div>
          </section>
        ) : (
          <section className="meta-ads-leads-layout">
            {isMobile ? (
              <section className="meta-ads-mobile-summary">
                <div className="meta-ads-mobile-summary__content">
                  <strong>{selectedMetaAdsForm?.name || "Selecione um formulario"}</strong>
                  <span>
                    {selectedMetaAdsForm
                      ? `${selectedMetaAdsForm.leads_count || 0} lead(s) - ${metaAdsForms.length} formulario(s)`
                      : `${metaAdsForms.length} formulario(s) encontrado(s)`}
                  </span>
                </div>
                <div className="meta-ads-mobile-summary__actions">
                  <button
                    type="button"
                    className="contacts-toolbar-button contacts-toolbar-button--outline"
                    onClick={() => setIsMobileMetaAdsFormsModalOpen(true)}
                  >
                    <FiList /> Formularios
                  </button>
                </div>
              </section>
            ) : (
              <aside className="meta-ads-sidebar">
                <div className="broadcast-sidebar-header">
                  <div>
                    <strong>Formularios</strong>
                    <span>{metaAdsForms.length} encontrado(s)</span>
                  </div>
                </div>

                {renderMetaAdsFormSelector()}
              </aside>
            )}

            <div className="meta-ads-main">
              <section className="broadcast-panel meta-ads-summary-panel">
                <div className="broadcast-panel-header">
                  <div>
                    <h2>Leads recuperados da Meta</h2>
                    <p>
                      Selecione um formulario para trazer nome, telefone, email e os
                      campos preenchidos no cadastro.
                    </p>
                  </div>
                </div>

                <div className="meta-ads-summary-grid">
                  <div className="contacts-import-summary-card">
                    <span>Funil de destino</span>
                    <strong>{selectedMetaAdsCrm?.nome || "Nenhum"}</strong>
                  </div>
                  <div className="contacts-import-summary-card">
                    <span>Conta atual</span>
                    <strong>
                      {selectedMetaAdsAccount?.ad_account_name || "Nao selecionada"}
                    </strong>
                  </div>
                  <div className="contacts-import-summary-card">
                    <span>Formulario atual</span>
                    <strong>{selectedMetaAdsForm?.name || "Nenhum"}</strong>
                  </div>
                  <div className="contacts-import-summary-card">
                    <span>Leads selecionados</span>
                    <strong>{selectedMetaAdsLeads.length}</strong>
                  </div>
                </div>
              </section>

              <section className="broadcast-panel meta-ads-mapping-panel">
                <div className="broadcast-panel-header">
                  <div>
                    <h2>Mapeamento de campos</h2>
                    <p>
                      Escolha quais campos do lead alimentam nome, telefone e email para
                      este formulario ou para uma campanha especifica.
                    </p>
                  </div>
                  <div className="broadcast-panel-actions">
                  
                    <div className="meta-ads-mapping-save-group">
                      <button
                        type="button"
                        className="contacts-toolbar-button contacts-toolbar-button--primary"
                        onClick={() => void handleSaveMetaAdsFieldMapping()}
                        disabled={savingMetaAdsFieldMapping || !currentMetaAdsMappingScopeId}
                        aria-label="Salvar mapeamento"
                        title="Salvar mapeamento"
                      >
                        {isMobile ? (
                          <FiSave />
                        ) : (
                          (savingMetaAdsFieldMapping ? "." : "Salvar mapeamento")
                        )}
                      </button>
                      <div className="meta-ads-info-tooltip">
                        <button
                          type="button"
                          className="meta-ads-info-tooltip__trigger"
                          aria-label="Informacoes sobre o mapeamento"
                        >
                          <FiInfo />
                        </button>
                        <div className="meta-ads-info-tooltip__content" role="tooltip">
                          O mapeamento salvo passa a valer para os proximos carregamentos e
                          para a importação dos leads desse escopo.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`meta-ads-mapping-grid ${
                    metaAdsMappingScopeType === "campaign"
                      ? "meta-ads-mapping-grid--campaign"
                      : "meta-ads-mapping-grid--form"
                  }`}
                >
                  <label className="broadcast-field">
                    <span>Aplicar em</span>
                    <select
                      value={metaAdsMappingScopeType}
                      onChange={(event) => {
                        setMetaAdsTabLoading(true);
                        setMetaAdsMappingScopeType(
                          event.target.value as MetaAdsMappingScopeType
                        );
                      }}
                    >
                      <option value="form">Formulario atual</option>
                      <option
                        value="campaign"
                        disabled={!metaAdsCampaignOptions.length}
                      >
                        Campanha
                      </option>
                    </select>
                  </label>

                  {metaAdsMappingScopeType === "campaign" && (
                    <label className="broadcast-field">
                      <span>Campanha</span>
                      <select
                        value={selectedMetaAdsCampaignMappingId}
                        onChange={(event) => {
                          setMetaAdsTabLoading(true);
                          setSelectedMetaAdsCampaignMappingId(event.target.value);
                        }}
                      >
                        {metaAdsCampaignOptions.length ? (
                          metaAdsCampaignOptions.map((campaign) => (
                            <option key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </option>
                          ))
                        ) : (
                          <option value="">Nenhuma campanha encontrada</option>
                        )}
                      </select>
                    </label>
                  )}
                  <label className="broadcast-field">
                    <span>Campo do nome</span>
                    <select
                      value={metaAdsFieldMapping?.campo_nome || ""}
                      onChange={(event) =>
                        setMetaAdsFieldMapping((current) => ({
                          ...(current || {}),
                          escopo_tipo: metaAdsMappingScopeType,
                          escopo_id: currentMetaAdsMappingScopeId || undefined,
                          campo_nome: event.target.value || null,
                        }))
                      }
                    >
                      <option value="">Selecionar campo</option>
                      {metaAdsFieldOptions.map((field) => (
                        <option key={`name-${field.key}`} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="broadcast-field">
                    <span>Campo do telefone</span>
                    <select
                      value={metaAdsFieldMapping?.campo_telefone || ""}
                      onChange={(event) =>
                        setMetaAdsFieldMapping((current) => ({
                          ...(current || {}),
                          escopo_tipo: metaAdsMappingScopeType,
                          escopo_id: currentMetaAdsMappingScopeId || undefined,
                          campo_telefone: event.target.value || null,
                        }))
                      }
                    >
                      <option value="">Selecionar campo</option>
                      {metaAdsFieldOptions.map((field) => (
                        <option key={`phone-${field.key}`} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="broadcast-field">
                    <span>Campo do email</span>
                    <select
                      value={metaAdsFieldMapping?.campo_email || ""}
                      onChange={(event) =>
                        setMetaAdsFieldMapping((current) => ({
                          ...(current || {}),
                          escopo_tipo: metaAdsMappingScopeType,
                          escopo_id: currentMetaAdsMappingScopeId || undefined,
                          campo_email: event.target.value || null,
                        }))
                      }
                    >
                      <option value="">Selecionar campo</option>
                      {metaAdsFieldOptions.map((field) => (
                        <option key={`email-${field.key}`} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="broadcast-footnote">
                  <FiTarget />
                  O mapeamento salvo passa a valer para os proximos carregamentos e para a
                  importação dos leads desse escopo.
                </div>
              </section>

              <section className="broadcast-panel">
                <div className="broadcast-panel-header">
                  <div>
                    <h2>Lista de leads</h2>
                    <p>{displayedMetaAdsLeads.length} lead(s) carregado(s) do formulario.</p>
                  </div>
                  <div className="broadcast-panel-actions">
                   
                    <button
                      type="button"
                      className="contacts-toolbar-button contacts-toolbar-button--primary"
                      onClick={() => void handleImportMetaAdsLeads()}
                      disabled={
                        importingMetaAdsLeads ||
                        !selectedMetaAdsLeads.length ||
                        !selectedMetaAdsCrmId
                      }
                    >
                      <FiUpload /> Importar {selectedMetaAdsLeads.length || 0} lead(s)
                    </button>
                  </div>
                </div>

                <div className="meta-ads-leads-toolbar">
                  <div className="search-bar-wrapper meta-ads-leads-search">
                    <FiSearch className="search-icon" />
                    <input
                      type="text"
                      placeholder="Buscar por nome, telefone, email ou campanha"
                      value={metaAdsLeadSearchTerm}
                      onChange={(event) => setMetaAdsLeadSearchTerm(event.target.value)}
                    />
                  </div>

                  <label className="contacts-filter-field meta-ads-leads-filter">
                    <span>Status do lead</span>
                    <select
                      value={metaAdsLeadFilter}
                      onChange={(event) =>
                        setMetaAdsLeadFilter(event.target.value as MetaAdsLeadFilterValue)
                      }
                    >
                      <option value="all">Todos</option>
                      <option value="not_imported">Não importados</option>
                      <option value="ready">Prontos para importar</option>
                      <option value="incomplete">Com revisão pendente</option>
                      <option value="imported">Já importados</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    className="contacts-toolbar-button contacts-toolbar-button--outline meta-ads-clear-filter-button contacts-clear-filters-button"
                    onClick={handleClearMetaAdsLeadFilters}
                    disabled={metaAdsLeadFilter === "all" && !metaAdsLeadSearchTerm.trim()}
                  >
                    Limpar filtros
                  </button>
                </div>

                <div className="meta-ads-status-strip">
                  <button
                    type="button"
                    className={`meta-ads-status-card ${
                      metaAdsLeadFilter === "not_imported" ? "active" : ""
                    }`}
                    onClick={() => handleToggleMetaAdsLeadFilter("not_imported")}
                  >
                    <span>Não importados</span>
                    <strong>{metaAdsLeadSummary.notImported}</strong>
                  </button>
                  <button
                    type="button"
                    className={`meta-ads-status-card ${
                      metaAdsLeadFilter === "ready" ? "active" : ""
                    }`}
                    onClick={() => handleToggleMetaAdsLeadFilter("ready")}
                  >
                    <span>Prontos</span>
                    <strong>{metaAdsLeadSummary.ready}</strong>
                  </button>
                  <button
                    type="button"
                    className={`meta-ads-status-card ${
                      metaAdsLeadFilter === "incomplete" ? "active" : ""
                    }`}
                    onClick={() => handleToggleMetaAdsLeadFilter("incomplete")}
                  >
                    <span>Revisão pendente</span>
                    <strong>{metaAdsLeadSummary.incomplete}</strong>
                  </button>
                  <button
                    type="button"
                    className={`meta-ads-status-card ${
                      metaAdsLeadFilter === "imported" ? "active" : ""
                    }`}
                    onClick={() => handleToggleMetaAdsLeadFilter("imported")}
                  >
                    <span>Importados</span>
                    <strong>{metaAdsLeadSummary.imported}</strong>
                  </button>
                </div>

                {!selectedMetaAdsFormId ? (
                  <div className="broadcast-empty-state broadcast-empty-state--light">
                    <FiFileText />
                    <strong>Escolha um formulario</strong>
                    <p>Selecione um formulario na lateral para recuperar os leads.</p>
                  </div>
                ) : filteredMetaAdsLeads.length ? (
                  isMobile ? (
                    <div className="meta-ads-leads-mobile-list">
                      {filteredMetaAdsLeads.map((lead) => {
                        const leadId = String(lead.id || "");
                        const checked = selectedMetaAdsLeadIds.includes(leadId);
                        const leadStatus = getMetaAdsLeadStatus(lead);
                        const extraFields = (lead.fields || []).filter(
                          (field) =>
                            !["full_name", "name", "phone_number", "phone", "telefone", "email", "email_address"].includes(
                              String(field.key || "").toLowerCase()
                            )
                        );

                        return (
                          <article key={leadId} className="meta-ads-lead-mobile-card">
                            <div className="meta-ads-lead-mobile-card__top">
                              <label className="meta-ads-lead-mobile-card__check">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={Boolean(lead.imported)}
                                  onChange={() => handleToggleMetaAdsLead(leadId)}
                                />
                                <span>Selecionar lead</span>
                              </label>
                              <span className={`meta-ads-inline-badge meta-ads-status-pill--${leadStatus}`}>
                                {formatMetaAdsLeadStatus(leadStatus)}
                              </span>
                            </div>
                            <div className="broadcast-contact-main">
                              <strong>{lead.nome || "Lead sem nome"}</strong>
                              <small>
                                {lead.created_time
                                  ? `Recebido em ${formatDate(lead.created_time)}`
                                  : "Data nao informada"}
                              </small>
                            </div>
                            <div className="meta-ads-lead-contact">
                              <span>Telefone: {lead.telefone || "-"}</span>
                              <span>Email: {lead.email || "-"}</span>
                              <span>Campanha: {lead.campaign_name || "-"}</span>
                            </div>
                            {extraFields.length > 0 && (
                              <div className="meta-ads-lead-fields">
                                {extraFields.slice(0, 4).map((field) => (
                                  <span key={`${leadId}-${field.key}`}>
                                    {field.key}: {field.value || "-"}
                                  </span>
                                ))}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="broadcast-contacts-table-wrap">
                      <table className="broadcast-contacts-table meta-ads-leads-table">
                        <thead>
                          <tr>
                            <th>
                              <input
                                type="checkbox"
                                checked={allFilteredMetaAdsLeadsSelected}
                                onChange={handleToggleAllMetaAdsLeads}
                              />
                            </th>
                            <th>Lead</th>
                            <th>Contato</th>
                            <th>Origem</th>
                            <th>Campos extras</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMetaAdsLeads.map((lead) => {
                            const leadId = String(lead.id || "");
                            const checked = selectedMetaAdsLeadIds.includes(leadId);
                            const leadStatus = getMetaAdsLeadStatus(lead);
                            const extraFields = (lead.fields || []).filter(
                              (field) =>
                                !["full_name", "name", "phone_number", "phone", "telefone", "email", "email_address"].includes(
                                  String(field.key || "").toLowerCase()
                                )
                            );

                            return (
                              <tr key={leadId}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={Boolean(lead.imported)}
                                    onChange={() => handleToggleMetaAdsLead(leadId)}
                                  />
                                </td>
                                <td>
                                  <div className="broadcast-contact-main">
                                    <strong>{lead.nome || "Lead sem nome"}</strong>
                                    <small>
                                    {lead.campaign_name || lead.ad_name || "Sem campanha vinculada"}
                                  </small>
                                </div>
                              </td>
                              <td>
                                <div className="meta-ads-lead-contact">
                                  <span>{lead.telefone || "Sem telefone"}</span>
                                  <span>{lead.email || "Sem email"}</span>
                                  <div className="meta-ads-lead-signals">
                                    {!lead.nome && (
                                      <span className="meta-ads-inline-badge meta-ads-inline-badge--warning">
                                        Sem nome
                                      </span>
                                    )}
                                    {!lead.telefone && (
                                      <span className="meta-ads-inline-badge meta-ads-inline-badge--warning">
                                        Sem telefone
                                      </span>
                                    )}
                                    {!lead.email && (
                                      <span className="meta-ads-inline-badge meta-ads-inline-badge--muted">
                                        Sem email
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="card-badge contact-origin-badge origin-meta_ads">
                                  Meta Ads
                                </span>
                              </td>
                              <td>
                                <div className="meta-ads-lead-fields">
                                  {extraFields.length ? (
                                    extraFields.slice(0, 3).map((field) => (
                                      <span key={`${leadId}-${field.key}`}>
                                        {field.label}: {field.value}
                                      </span>
                                    ))
                                  ) : (
                                    <span>Nenhum campo extra relevante</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="meta-ads-status-cell">
                                  <span
                                    className={`broadcast-origin-pill meta-ads-status-pill meta-ads-status-pill--${leadStatus}`}
                                  >
                                    {formatMetaAdsLeadStatus(leadStatus)}
                                  </span>
                                  <small>
                                    {lead.imported
                                      ? `Importado em ${formatDateTime(lead.imported_at)}`
                                      : leadStatus === "ready"
                                        ? "Nome, telefone e email prontos para importação."
                                        : leadStatus === "partial"
                                          ? "Lead capturado, mas ainda exige revisão dos dados."
                                          : "Faltam dados essenciais para uma triagem confiável."}
                                  </small>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )) : displayedMetaAdsLeads.length ? (
                  <div className="broadcast-empty-state broadcast-empty-state--light">
                    <FiSearch />
                    <strong>Nenhum lead combina com os filtros atuais</strong>
                    <p>
                      Ajuste a busca ou altere o filtro de status para visualizar outros
                      leads deste formulario.
                    </p>
                  </div>
                ) : (
                  <div className="broadcast-empty-state broadcast-empty-state--light">
                    <FiUsers />
                    <strong>Nenhum lead retornado</strong>
                    <p>Esse formulario ainda nao retornou leads disponiveis para importação.</p>
                  </div>
                )}
              </section>
            </div>
          </section>
              )}
            </div>
          </section>
        )}
      </main>

      <Modal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        title={editingContact ? "Editar contato" : "Criar contato"}
      >
        <ContactForm
          onSave={(contactData) => {
            if (editingContact) {
              handleUpdateContact(contactData);
              return;
            }

            void fetchContacts();
            void fetchUpcomingBirthdayContacts();
            handleCloseEditModal();
          }}
          onCancel={handleCloseEditModal}
          initialData={editingContact}
        />
      </Modal>

      <ContactHistoryModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        contact={selectedContact}
      />

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirmar exclusao"
      >
        <div className="confirm-modal-content">
          <p>
            Voce tem certeza que deseja excluir este contato? Esta ação não pode ser
            desfeita.
          </p>
          <div className="confirm-modal-actions">
            <button
              className="cancel-button"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Cancelar
            </button>
            <button className="delete-button" onClick={() => void handleDeleteContact()}>
              Sim, excluir
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isImportModalOpen}
        onClose={handleCloseImportModal}
        title="Importar contatos"
        size="lg"
      >
        <div className="contacts-import-modal">
          <div className="contacts-import-hero">
            <div>
              <strong>Arquivos aceitos</strong>
              <p>
                Use CSV, XLS ou XLSX com os cabeçalhos esperados. Tags e UTMs
                também podem subir junto.
              </p>
            </div>
            <div className="contacts-import-hero-actions">
              <button
                type="button"
                className="contacts-toolbar-button contacts-toolbar-button--outline"
                onClick={() => downloadContactImportTemplate()}
              >
                <FiDownload /> Baixar modelo
              </button>
              <button
                type="button"
                className="contacts-toolbar-button contacts-toolbar-button--outline"
                onClick={() => setIsImportGuideModalOpen(true)}
              >
                <FiFileText /> Ver modelo
              </button>
            </div>
          </div>

          <div className="contacts-import-file-row">
            <label className="contacts-import-file-field">
              <span>Arquivo de contatos</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => {
                  setSelectedImportFile(event.target.files?.[0] || null);
                  setImportRows([]);
                  setImportErrors([]);
                  setImportWarnings([]);
                  setLastImportSummary(null);
                }}
              />
            </label>
            <button
              type="button"
              className={`contacts-toolbar-button contacts-import-process-button${
                selectedImportFile ? " contacts-import-process-button--ready" : ""
              }`}
              onClick={() => void handleParseImportFile()}
              disabled={parsingImportFile || !selectedImportFile}
            >
              {parsingImportFile ? "Processando..." : "Processar arquivo"}
            </button>
          </div>

          <div className="contacts-import-summary-grid">
            <div className="contacts-import-summary-card">
              <span>Linhas validas</span>
              <strong>{importRows.length}</strong>
            </div>
            <div className="contacts-import-summary-card">
              <span>Erros</span>
              <strong>{importErrors.length}</strong>
            </div>
            <div className="contacts-import-summary-card">
              <span>Avisos</span>
              <strong>{importWarnings.length}</strong>
            </div>
          </div>

          {previewImportRows.length > 0 && (
            <div className="contacts-import-preview">
              <div className="contacts-import-section-header">
                <strong>Preview das primeiras linhas</strong>
                <span>
                  {previewImportRows.length} de {importRows.length}
                </span>
              </div>
              <div className="contacts-import-preview-table-wrap">
                <table className="contacts-import-preview-table">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Nome</th>
                      <th>Telefone</th>
                      <th>Email</th>
                      <th>Aniversário</th>
                      <th>Tags</th>
                      <th>UTMs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewImportRows.map((row) => (
                      <tr key={row.linha}>
                        <td>{row.linha}</td>
                        <td>{row.nome || "-"}</td>
                        <td>{row.telefone || "-"}</td>
                        <td>{row.email || "-"}</td>
                        <td>{row.data_aniversario || "-"}</td>
                        <td>{row.tags.join(", ") || "-"}</td>
                        <td>{row.utms.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(importErrors.length > 0 || importWarnings.length > 0 || lastImportSummary) && (
            <div className="contacts-import-feedback">
              {lastImportSummary && (
                <div className="contacts-import-feedback-block">
                  <strong>Resultado da importação</strong>
                  <p>
                    {lastImportSummary.criados} criado(s), {lastImportSummary.atualizados} atualizado(s) e {lastImportSummary.ignorados} ignorado(s).
                  </p>
                  {lastImportSummary.erros.length > 0 && (
                    <ul>
                      {lastImportSummary.erros.slice(0, 8).map((erro) => (
                        <li key={`resultado-${erro.linha}-${erro.mensagem}`}>
                          Linha {erro.linha}: {erro.mensagem}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {importErrors.length > 0 && (
                <div className="contacts-import-feedback-block contacts-import-feedback-block--error">
                  <strong>Erros de leitura</strong>
                  <ul>
                    {importErrors.slice(0, 8).map((erro) => (
                      <li key={`erro-${erro.row}-${erro.message}`}>
                        Linha {erro.row}: {erro.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importWarnings.length > 0 && (
                <div className="contacts-import-feedback-block contacts-import-feedback-block--warning">
                  <strong>Avisos</strong>
                  <ul>
                    {importWarnings.slice(0, 8).map((warning) => (
                      <li key={`warning-${warning.row}-${warning.message}`}>
                        Linha {warning.row}: {warning.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="contacts-import-actions">
            <button
              type="button"
              className="contacts-toolbar-button contacts-toolbar-button--primary contacts-import-submit-button"
              onClick={() => void handleImportContacts()}
              disabled={importingContacts || parsingImportFile || !importRows.length}
            >
              {importingContacts ? "Importando..." : "Importar contatos"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isImportGuideModalOpen}
        onClose={() => setIsImportGuideModalOpen(false)}
        title="Cabeçalhos aceitos para importação"
        size="lg"
      >
        <div className="contacts-import-guide">
          <div className="contacts-import-guide-intro">
            <p>
              Você pode importar contatos por CSV ou XLSX usando os cabeçalhos
              abaixo. Alias como <code>name</code>, <code>phone</code> e{" "}
              <code>birthday</code> também são aceitos.
            </p>
          </div>

          <div className="contacts-import-guide-grid">
            {CONTACT_IMPORT_HEADERS.map((header) => {
              const maxLength = 65;
              const isLongDesc = header.description.length > maxLength;
              const displayedDesc = isLongDesc
                ? header.description.substring(0, maxLength)
                : header.description;

              return (
                <article key={header.key} className="contacts-import-guide-card">
                  <strong>{header.key}</strong>
                  <span>{header.required ? "Obrigatorio" : "Opcional"}</span>
                  <div className="guide-card-description-wrapper">
                    <p className="guide-card-description">
                      {displayedDesc}
                      {isLongDesc && (
                        <span className="guide-card-ver-mais">
                          ...ver mais
                          <div className="guide-card-tooltip">
                            {header.description}
                          </div>
                        </span>
                      )}
                    </p>
                  </div>
                  <small>Alias: {header.aliases.join(", ")}</small>
                </article>
              );
            })}
          </div>

          <div className="contacts-import-sample">
            <div className="contacts-import-section-header">
              <strong>Exemplo de linha</strong>
            </div>
            <pre>{JSON.stringify(CONTACT_IMPORT_SAMPLE_ROW, null, 2)}</pre>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isExportModalOpen}
        onClose={handleCloseExportModal}
        title="Exportar contatos"
      >
        <div className="contacts-export-modal">
          <div className="contacts-import-hero">
            <div>
              <strong>Escolha o criterio da exportação</strong>
              <p>
                Gere um arquivo Excel filtrando os contatos por data de entrada,
                tag ou UTM.
              </p>
            </div>
          </div>

          <div className="contacts-export-mode-grid">
            <button
              type="button"
              className={`contacts-export-mode-card ${exportMode === "date" ? "is-active" : ""}`}
              onClick={() => {
                setExportMode("date");
                setExportFilters(createDefaultContactCompositeFilters());
                setSelectedExportTags([]);
                setExportTagSearchTerm("");
                setDebouncedExportTagSearchTerm("");
                setExportTagOptions([]);
              }}
            >
              <strong>Por data</strong>
              <span>Exporta pela data de entrada do contato.</span>
            </button>
            <button
              type="button"
              className={`contacts-export-mode-card ${exportMode === "tag" ? "is-active" : ""}`}
              onClick={() => {
                setExportMode("tag");
                setExportFilters(createDefaultContactCompositeFilters());
                setSelectedExportTags([]);
                setExportTagSearchTerm("");
                setDebouncedExportTagSearchTerm("");
                setExportTagOptions([]);
              }}
            >
              <strong>Por tag</strong>
              <span>Exporta somente os contatos marcados com as tags escolhidas.</span>
            </button>
            <button
              type="button"
              className={`contacts-export-mode-card ${exportMode === "utm" ? "is-active" : ""}`}
              onClick={() => {
                setExportMode("utm");
                setExportFilters(createDefaultContactCompositeFilters());
                setSelectedExportTags([]);
                setExportTagSearchTerm("");
                setDebouncedExportTagSearchTerm("");
                setExportTagOptions([]);
              }}
            >
              <strong>Por UTM</strong>
              <span>Busca o termo informado dentro do historico de UTMs do contato.</span>
            </button>
          </div>

          <div className="contacts-export-fields">
            {exportMode === "date" ? (
              <label className="contacts-filter-field">
                <span>Data de entrada</span>
                <div className="contacts-date-range-field">
                  <input
                    type="date"
                    value={exportFilters.data_entrada_inicial}
                    onChange={(event) =>
                      setExportFilters((current) => ({
                        ...current,
                        data_entrada_inicial: event.target.value,
                      }))
                    }
                    aria-label="Data inicial de exportacao"
                  />
                  <span>ate</span>
                  <input
                    type="date"
                    value={exportFilters.data_entrada_final}
                    onChange={(event) =>
                      setExportFilters((current) => ({
                        ...current,
                        data_entrada_final: event.target.value,
                      }))
                    }
                    aria-label="Data final de exportacao"
                  />
                </div>
              </label>
            ) : null}

            {exportMode === "tag" ? (
              <div className="contacts-filter-field contacts-filter-field--tag contacts-export-filter-field">
                <span>Tags para exportar</span>
                <div className="contacts-tag-search-field">
                  <div className="search-bar-wrapper contacts-export-search-wrapper">
                    <FiSearch className="search-icon" />
                    <DebouncedTextInput
                      placeholder="Digite o nome da tag"
                      value={exportTagSearchTerm}
                      onChange={setExportTagSearchTerm}
                      delay={250}
                    />
                  </div>
                  {(loadingExportTagOptions || exportTagSearchTerm.trim()) && (
                    <div className="contacts-tag-search-results">
                      {loadingExportTagOptions ? (
                        <span className="contacts-tag-search-status">Buscando tags...</span>
                      ) : exportTagOptions.length ? (
                        exportTagOptions.map((tag) => (
                          <button
                            key={`export-tag-${tag.id}`}
                            type="button"
                            className="contacts-tag-search-option"
                            onClick={() => handleSelectExportTag(tag)}
                          >
                            {tag.name}
                          </button>
                        ))
                      ) : (
                        <span className="contacts-tag-search-status">
                          Nenhuma tag encontrada para essa busca.
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="contacts-tag-filter-grid">
                  {selectedExportTags.length ? (
                    selectedExportTags.map((tag) => (
                      <button
                        key={`selected-export-tag-${tag.id}`}
                        type="button"
                        className="contacts-selected-tag-chip"
                        onClick={() => handleRemoveExportTag(tag.id)}
                        title="Remover tag da exportacao"
                      >
                        <span>{tag.name}</span>
                        <strong>x</strong>
                      </button>
                    ))
                  ) : (
                    <span className="contacts-export-empty-hint">
                      Nenhuma tag selecionada ainda.
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {exportMode === "utm" ? (
              <label className="contacts-filter-field contacts-filter-field--search contacts-export-filter-field">
                <span>Termo da UTM</span>
                <div className="search-bar-wrapper">
                  <FiSearch className="search-icon" />
                  <DebouncedTextInput
                    placeholder="Ex.: campanha_maio, google, meta_ads..."
                    value={exportFilters.utm}
                    onChange={(value) =>
                      setExportFilters((current) => ({
                        ...current,
                        utm: value,
                      }))
                    }
                  />
                </div>
              </label>
            ) : null}
          </div>

          <div className="contacts-export-note">
            <strong>O arquivo inclui:</strong>
            <span>
              dados cadastrais, tags, historico resumido de funil e colunas separadas
              para as principais UTMs encontradas.
            </span>
          </div>

          <div className="contacts-import-actions">
            <button
              type="button"
              className="contacts-toolbar-button contacts-toolbar-button--outline"
              onClick={handleCloseExportModal}
              disabled={exportingContacts}
            >
              Fechar
            </button>
            <button
              type="button"
              className="contacts-toolbar-button contacts-toolbar-button--primary"
              onClick={() => void handleExportContacts()}
              disabled={exportingContacts}
            >
              {exportingContacts ? "Exportando..." : "Gerar Excel"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isCreateBroadcastListModalOpen}
        onClose={() => {
          setIsCreateBroadcastListModalOpen(false);
          setNewBroadcastListName("");
          setNewBroadcastListDescription("");
          setNewBroadcastListMetaParamId("");
          if (!isAddToListModalOpen) {
            setSelectedContactForBroadcast(null);
          }
        }}
        title="Nova lista de transmissão"
      >
        <div className="broadcast-create-modal">
          <label className="broadcast-field">
            <span>Numero da Meta</span>
            <select
              value={newBroadcastListMetaParamId}
              onChange={(event) => setNewBroadcastListMetaParamId(event.target.value)}
              disabled={loadingMetaIntegrationNumbers}
            >
              <option value="">
                {loadingMetaIntegrationNumbers ? "Carregando numeros..." : "Selecione um numero"}
              </option>
              {availableMetaIntegrationNumbers.map((account) => (
                <option key={String(account.id || "")} value={String(account.id || "")}>
                  {formatMetaIntegrationNumberLabel(account)}
                </option>
              ))}
            </select>
          </label>
          <label className="broadcast-field">
            <span>Nome</span>
            <input
              type="text"
              value={newBroadcastListName}
              onChange={(event) => setNewBroadcastListName(event.target.value)}
              placeholder="Ex.: Clientes quentes abril"
            />
          </label>
          <label className="broadcast-field">
            <span>Descrição</span>
            <textarea
              value={newBroadcastListDescription}
              onChange={(event) => setNewBroadcastListDescription(event.target.value)}
              placeholder="Descreva a finalidade desta lista"
              rows={4}
            />
          </label>
          <div className="contacts-import-actions">
            <button
              type="button"
              className="contacts-toolbar-button contacts-toolbar-button--outline"
              onClick={() => {
                setIsCreateBroadcastListModalOpen(false);
                setNewBroadcastListName("");
                setNewBroadcastListDescription("");
                setNewBroadcastListMetaParamId("");
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="contacts-toolbar-button contacts-toolbar-button--primary"
              onClick={() => void handleCreateBroadcastList()}
              disabled={creatingBroadcastList}
            >
              {creatingBroadcastList ? "Criando..." : "Criar lista"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isAddToListModalOpen}
        onClose={() => {
          setIsAddToListModalOpen(false);
          setSelectedContactForBroadcast(null);
        }}
        title="Adicionar contato a lista"
      >
        <div className="broadcast-create-modal">
          {selectedContactForBroadcast && (
            <div className="broadcast-contact-highlight">
              <strong>{selectedContactForBroadcast.name}</strong>
              <span>{selectedContactForBroadcast.phone || "Sem telefone"}</span>
            </div>
          )}

          {broadcastLists.length ? (
            <>
              <label className="broadcast-field">
                <span>Lista de transmissão</span>
                <select
                  value={selectedTargetBroadcastListId ?? ""}
                  onChange={(event) =>
                    setSelectedTargetBroadcastListId(Number(event.target.value) || null)
                  }
                >
                  {broadcastLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {`${list.nome} - ${formatBroadcastListMetaLabel(list)}`}
                    </option>
                  ))}
                </select>
              </label>

              <div className="contacts-import-actions">
                <button
                  type="button"
                  className="contacts-toolbar-button contacts-toolbar-button--outline"
                  onClick={() => setIsAddToListModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="contacts-toolbar-button contacts-toolbar-button--primary"
                  onClick={() => void handleConfirmAddToBroadcastList()}
                  disabled={addingContactToBroadcastList || !selectedTargetBroadcastListId}
                >
                  {addingContactToBroadcastList ? "Adicionando..." : "Adicionar contato"}
                </button>
              </div>
            </>
          ) : (
            <div className="broadcast-empty-state broadcast-empty-state--light">
              <FiSend />
              <strong>Crie uma lista primeiro</strong>
              <p>
                Voce precisa criar ao menos uma lista de transmissão antes de adicionar
                contatos manualmente.
              </p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isAddContactToSelectedListModalOpen}
        onClose={handleCloseAddContactToSelectedListModal}
        title="Adicionar contato na lista"
      >
        <div className="broadcast-create-modal">
          <label className="broadcast-field">
            <span>Buscar contato</span>
            <div className="search-bar-wrapper">
              <FiSearch className="search-icon" />
              <input
                type="text"
                value={broadcastContactSearchTerm}
                onChange={(event) => setBroadcastContactSearchTerm(event.target.value)}
                placeholder="Buscar por nome, telefone ou email"
              />
            </div>
          </label>

          {selectedBroadcastList && (
            <div className="broadcast-contact-highlight">
              <strong>{selectedBroadcastList.nome}</strong>
              <span>
                Pesquise um contato, clique para adicionar a seleção e repita o processo antes de confirmar.
              </span>
            </div>
          )}

          <div className="broadcast-contact-picker">
            {selectedBroadcastContactsToAdd.length ? (
              <div className="broadcast-contact-picker__queued">
                <strong>Contatos preparados</strong>
                <div className="broadcast-contact-picker__queued-list">
                  {selectedBroadcastContactsToAdd.map((contact) => (
                    <button
                      key={Number(contact.cliente_id || contact.id)}
                      type="button"
                      className="broadcast-contact-picker__queued-chip"
                      onClick={() =>
                        handleRemoveQueuedBroadcastContact(
                          Number(contact.cliente_id || contact.id)
                        )
                      }
                      title="Remover da selecao"
                    >
                      <span>{contact.name}</span>
                      <strong>x</strong>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {loadingBroadcastContactSearch ? (
              <div className="broadcast-empty-state broadcast-empty-state--light">
                <FiRefreshCw />
                <strong>Buscando contatos</strong>
                <p>Aguarde enquanto carregamos os contatos disponiveis.</p>
              </div>
            ) : broadcastContactSearchResults.length ? (
              <div className="broadcast-contact-picker__list">
                {broadcastContactSearchResults.map((contact) => {
                  const contactId = Number(contact.cliente_id || contact.id);

                  return (
                    <div key={contactId} className="broadcast-contact-picker__option">
                      <div className="broadcast-contact-picker__option-main">
                        <strong>{contact.name}</strong>
                        <span>{contact.phone || contact.email || "Sem telefone ou email"}</span>
                      </div>
                      <div className="broadcast-contact-picker__option-meta">
                        <span>{formatContactOrigin(contact.origem)}</span>
                        {contact.data_cadastro ? (
                          <small>Desde {formatDate(contact.data_cadastro)}</small>
                        ) : null}
                        <button
                          type="button"
                          className="contacts-toolbar-button contacts-toolbar-button--outline"
                          onClick={() => handleQueueBroadcastContact(contact)}
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="broadcast-empty-state broadcast-empty-state--light">
                <FiUsers />
                <strong>Nenhum contato disponivel</strong>
                <p>
                  {debouncedBroadcastContactSearchTerm
                    ? "Nenhum contato encontrado para essa busca ou todos ja estao na lista."
                    : "Digite um termo para pesquisar contatos antes de adicionar."}
                </p>
              </div>
            )}
          </div>

          <div className="contacts-import-actions">
            <button
              type="button"
              className="contacts-toolbar-button contacts-toolbar-button--outline"
              onClick={handleCloseAddContactToSelectedListModal}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="contacts-toolbar-button contacts-toolbar-button--primary"
              onClick={() => void handleConfirmAddContactToSelectedList()}
              disabled={addingContactToBroadcastList || !selectedBroadcastContactsToAdd.length}
            >
              {addingContactToBroadcastList
                ? "Adicionando..."
                : `Adicionar contato${selectedBroadcastContactsToAdd.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isTemplateDispatchModalOpen}
        onClose={handleCloseTemplateDispatchModal}
        title="Disparar template para cliente"
      >
        <div className="broadcast-create-modal">
          {selectedContactForTemplateDispatch && (
            <div className="broadcast-contact-highlight">
              <strong>{selectedContactForTemplateDispatch.name}</strong>
              <span>{selectedContactForTemplateDispatch.phone || "Sem telefone"}</span>
            </div>
          )}

          {loadingMetaIntegrationNumbers ? (
            <div className="broadcast-empty-state broadcast-empty-state--light">
              <FiRefreshCw />
              <strong>Carregando numeros da Meta</strong>
              <p>Aguarde enquanto buscamos os numeros ativos vinculados a empresa.</p>
            </div>
          ) : !availableMetaIntegrationNumbers.length ? (
            <div className="broadcast-empty-state broadcast-empty-state--light">
              <FiMessageCircle />
              <strong>Nenhum numero Meta disponivel</strong>
              <p>Vincule e ative ao menos um numero da Meta para disparar templates.</p>
            </div>
          ) : (
            <>
              <label className="broadcast-field">
                <span>Numero da Meta</span>
                <select
                  value={selectedMetaIntegrationNumberId}
                  onChange={(event) => setSelectedMetaIntegrationNumberId(event.target.value)}
                >
                  {availableMetaIntegrationNumbers.map((account) => (
                    <option key={String(account.id || "")} value={String(account.id || "")}>
                      {formatMetaIntegrationNumberLabel(account)}
                    </option>
                  ))}
                </select>
              </label>

              {loadingMetaTemplates ? (
                <div className="broadcast-empty-state broadcast-empty-state--light">
                  <FiRefreshCw />
                  <strong>Carregando templates</strong>
                  <p>Aguarde enquanto buscamos os templates aprovados da Meta.</p>
                </div>
              ) : availableMetaTemplates.length ? (
                <>
                  <label className="broadcast-field">
                    <span>Template</span>
                    <select
                      value={selectedMetaTemplateName}
                      onChange={(event) => setSelectedMetaTemplateName(event.target.value)}
                    >
                      {availableMetaTemplates.map((template) => (
                        <option key={`${template.name}-${template.language}`} value={template.name}>
                          {template.name} · {template.language || "pt_BR"} ·{" "}
                          {template.status || "sem status"}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedMetaTemplate && (
                    <div className="template-dispatch-summary">
                      <span>
                        Status:{" "}
                        {isTemplateApproved(selectedMetaTemplate)
                          ? "Aprovado"
                          : selectedMetaTemplate.status || "Sem status"}
                      </span>
                      <span>Idioma: {selectedMetaTemplate.language || "pt_BR"}</span>
                      {selectedMetaTemplateHints && (
                        <>
                          <span>Header: {selectedMetaTemplateHints.headerType}</span>
                          <span>
                            Variaveis do body: {selectedMetaTemplateHints.bodyParameterCount}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {selectedMetaTemplateHints?.headerRequiresMedia && (
                    <label className="broadcast-field">
                      <span>Arquivo do header</span>
                      <input
                        type="file"
                        onChange={(event) =>
                          setMetaTemplateHeaderFile(event.target.files?.[0] || null)
                        }
                      />
                    </label>
                  )}

                  {metaTemplateHeaderParameters.length > 0 && (
                    <div className="template-parameter-section">
                      <strong>Parametros do header</strong>
                      <div className="template-parameter-grid">
                        {metaTemplateHeaderParameters.map((currentParameter, index) => (
                          <label key={`header-${index}`} className="broadcast-field">
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
                                    <option key={`header-field-${index}-${option.value}`} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>

                                {currentParameter.standardField === "contact_name" ? (
                                  <select
                                    value={currentParameter.nameFormat}
                                    onChange={(event) =>
                                      handleMetaTemplateHeaderParameterChange(index, {
                                        nameFormat: event.target.value as TemplateParameterNameFormat,
                                      })
                                    }
                                  >
                                    <option value="first_name">Primeiro nome</option>
                                    <option value="full_name">Nome completo</option>
                                  </select>
                                ) : null}

                                <small className="template-parameter-helper">
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
                  )}

                  {metaTemplateBodyParameters.length > 0 && (
                    <div className="template-parameter-section">
                      <strong>Parametros do body</strong>
                      <div className="template-parameter-grid">
                        {metaTemplateBodyParameters.map((currentParameter, index) => (
                          <label key={`body-${index}`} className="broadcast-field">
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
                                    <option key={`body-field-${index}-${option.value}`} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>

                                {currentParameter.standardField === "contact_name" ? (
                                  <select
                                    value={currentParameter.nameFormat}
                                    onChange={(event) =>
                                      handleMetaTemplateBodyParameterChange(index, {
                                        nameFormat: event.target.value as TemplateParameterNameFormat,
                                      })
                                    }
                                  >
                                    <option value="first_name">Primeiro nome</option>
                                    <option value="full_name">Nome completo</option>
                                  </select>
                                ) : null}

                                <small className="template-parameter-helper">
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
                  )}

                  {selectedMetaTemplateHints?.buttons.some(
                    (button) => button.parameterCount > 0
                  ) && (
                    <div className="template-parameter-section">
                      <strong>Parametros dos botoes</strong>
                      <div className="template-button-groups">
                        {selectedMetaTemplateHints.buttons
                          .filter((button) => button.parameterCount > 0)
                          .map((button) => (
                            <div key={`button-${button.index}`} className="template-button-group">
                              <span>
                                Botao {button.index}
                                {button.text ? ` · ${button.text}` : ""}
                              </span>
                              <div className="template-parameter-grid">
                                {(metaTemplateButtonParameters[button.index] || []).map(
                                  (currentParameter, parameterIndex) => (
                                    <label
                                      key={`button-${button.index}-${parameterIndex}`}
                                      className="broadcast-field"
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
                                                key={`button-field-${button.index}-${parameterIndex}-${option.value}`}
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

                                          <small className="template-parameter-helper">
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
                  )}

                  <MetaTemplatePreview
                    template={selectedMetaTemplate}
                    language={metaTemplateLanguage}
                    title="Preview da mensagem"
                    className="template-dispatch-preview"
                    headerParameters={metaTemplateHeaderParameters}
                    bodyParameters={metaTemplateBodyParameters}
                    buttonParameters={metaTemplateButtonParameters}
                    headerImageUrl={metaTemplateHeaderPreviewUrl}
                    headerFileName={metaTemplateHeaderFile?.name || ""}
                  />
                </>
              ) : (
                <div className="broadcast-empty-state broadcast-empty-state--light">
                  <FiFileText />
                  <strong>Nenhum template encontrado</strong>
                  <p>Cadastre e aprove um template na integracao Meta antes de usar esta acao.</p>
                </div>
              )}

              {metaTemplateDispatchError && (
                <p className="template-dispatch-error">{metaTemplateDispatchError}</p>
              )}

              <div className="contacts-import-actions">
                <button
                  type="button"
                  className="contacts-toolbar-button contacts-toolbar-button--outline"
                  onClick={handleCloseTemplateDispatchModal}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="contacts-toolbar-button contacts-toolbar-button--outline"
                  onClick={() => void loadMetaTemplates(selectedMetaIntegrationNumberId)}
                  disabled={loadingMetaTemplates || !selectedMetaIntegrationNumberId}
                >
                  Atualizar templates
                </button>
                <button
                  type="button"
                  className="contacts-toolbar-button contacts-toolbar-button--primary"
                  onClick={() => void handleDispatchTemplateToContact()}
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
            </>
          )}
        </div>
      </Modal>

      <ContactDirectSaleModal
        isOpen={isContactDirectSaleModalOpen}
        contact={selectedContactForDirectSale}
        currentUser={{
          id: Number(user?.id || 0),
          name: user?.name || "Usuário",
          isMaster: Boolean(user?.is_master),
        }}
        onClose={handleCloseContactDirectSaleModal}
        onSubmit={handlePrepareContactDirectSale}
      />

      {pendingContactDirectSale ? (
        <FinishServiceModal
          isOpen
          onClose={handleCancelPendingContactDirectSale}
          deal={pendingContactDirectSale.deal}
          initialFinishType="won"
          paymentOptions={pendingContactDirectSale.paymentOptions}
          lossReasonOptions={pendingContactDirectSale.lossReasonOptions}
          productCatalog={pendingContactDirectSale.productCatalog}
          onConfirmSale={async (saleData) => {
            if (savingDirectContactSale) {
              return;
            }

            try {
              setSavingDirectContactSale(true);
              await createCommercialDeal(
                {
                  ...pendingContactDirectSale.deal,
                  ...saleData,
                  stage: pendingContactDirectSale.wonStageCode,
                  ownerId: pendingContactDirectSale.deal.ownerId,
                  ownerName: pendingContactDirectSale.deal.ownerName,
                },
                pendingContactDirectSale.crmId
              );

              addToast({
                type: "success",
                title: "Venda registrada",
                description: "A venda foi vinculada ao CRM selecionado com sucesso.",
              });

              setPendingContactDirectSale(null);
              setSelectedContactForDirectSale(null);
              await fetchContacts();
            } catch (error) {
              addToast({
                type: "error",
                title: "Erro ao registrar venda",
                description:
                  error instanceof Error
                    ? error.message
                    : "Nao foi possivel registrar a venda para este contato.",
              });
            } finally {
              setSavingDirectContactSale(false);
            }
          }}
          onConfirmRefusal={() => {}}
        />
      ) : null}
    </div>
  );
}

