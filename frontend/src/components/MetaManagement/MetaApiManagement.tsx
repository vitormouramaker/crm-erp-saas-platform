import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiSearch } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  type BirthdayTemplateConfig,
  MetaService,
  type BatchDispatchProgressResult,
  type BatchDispatchTemplateResult,
  type DispatchCostMetricsResult,
  type DispatchCostRow,
  type IntegrationStatusData,
  type MetaIntegrationAccount,
  type MetaTemplateItem,
  type TemplateAutomationConfig,
  type TemplateMetricsResult,
  type TemplateComponent,
  type WhatsAppProfileData,
  type WhatsAutoMessage,
} from "../../service/metaService";
import {
  fetchBroadcastLists,
  type BroadcastList,
} from "../../service/contactsService";
import {
  TEMPLATE_MAX_BUTTONS,
  aggregateTypedValues,
  applySavedMessageToDrafts,
  applyStyleToken,
  applyVariableSample,
  buildClientBatchToken,
  buildDefaultDrafts,
  buildTemplateButtonDraft,
  buildTemplateButtons,
  buildWhatsAppProfileDraft,
  createTemplateParameterInputs,
  ensureTemplateParameterInputsLength,
  extractTemplateTexts,
  extractTemplateVariables,
  flattenTemplateMetricPoints,
  formatDateTime,
  formatUnixToDateInput,
  getDispatchHintSummary,
  getTodayDateInput,
  getMetaAccountPrimaryLabel,
  getMetaAccountSecondaryLabel,
  getMetaAccountTechnicalLabel,
  getPreviewButtonLabel,
  getTemplateSavedHeaderImageUrl,
  isTemplateBatchTerminalStatus,
  mapAutoMessagesToDrafts,
  mapTemplateButtonPayloadArrayToInputs,
  mapTemplateParameterInputToPayload,
  mapTemplateParameterPayloadArrayToInputs,
  normalizeTemplateCategory,
  normalizeTemplateStatus,
  normalizeTimeInputValue,
  parseMetaEmbeddedSignupIdentifiers,
  summarizeTemplateMetrics,
  toApiDateRange,
  toSafeNumber,
  type AutoMessageDraft,
  type AutoMessageTypeId,
  type MetaEmbeddedSignupIdentifiers,
  type MetaViewTab,
  type TemplateButtonDraft,
  type TemplateDispatchMode,
  type TemplateMediaSampleType,
  type TemplateOperationTab,
  type TemplateParameterInput,
  type WhatsAppProfileDraft,
} from "./MetaApiManagement.helpers";
import type { QuickMessageGalleryImage } from "../../types/quickMessages";
import {
  searchCommercialCustomers,
  type CommercialCustomerSuggestion,
} from "../../service/commercialService";
import { exportMetaTemplateBatchReport } from "../../utils/metaTemplateBatchExport";
import { AutoMessagesSection } from "./AutoMessagesSection";
import { CreateTemplateModal } from "./CreateTemplateModal";
import { DispatchCostsSection } from "./DispatchCostsSection";
import { renderAutomationScheduleCard } from "./AutomationScheduleCard";
import { MetaApiManagementToolbar } from "./MetaApiManagementToolbar";
import { TemplateListCard } from "./TemplateListCard";
import { TemplateDetailsModal } from "./TemplateDetailsModal";
import { WhatsAppProfileSection } from "./WhatsAppProfileSection";
import { TemplateOperationModal } from "./TemplateOperationModal";
import "../ApiMetaSettings/ApiMetaSettings.css";

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options?: FacebookLoginOptions,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type FacebookLoginResponse = {
  status?: string;
  authResponse?: {
    code?: string;
    accessToken?: string;
  };
};

type FacebookLoginOptions = {
  config_id: string;
  response_type: "code";
  override_default_response_type: boolean;
  scope?: string;
  return_scopes?: boolean;
  display?: "popup";
  extras?: {
    feature: "whatsapp_embedded_signup";
    featureType?: "whatsapp_business_app_onboarding";
    sessionInfoVersion: number | string;
    version?: "v3";
    setup?: Record<string, unknown>;
  };
};

type ApiMetaModuleMode = "integration" | "management";

type ApiMetaSettingsModuleProps = {
  mode: ApiMetaModuleMode;
  onInitialLoadChange?: (loading: boolean) => void;
};

function ApiMetaSettingsModule({
  mode,
  onInitialLoadChange,
}: ApiMetaSettingsModuleProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const isIntegrationModule = mode === "integration";
  const isManagementModule = mode === "management";
  const [isMetaSdkReady, setIsMetaSdkReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState(
    "Aguardando consulta...",
  );
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isIntegrationActive, setIsIntegrationActive] = useState(false);
  const [isIntegrationDetailsOpen, setIsIntegrationDetailsOpen] = useState(false);
  const [integrationData, setIntegrationData] =
    useState<IntegrationStatusData | null>(null);
  const [isSavingIntegration, setIsSavingIntegration] = useState(false);
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaSignupCode, setMetaSignupCode] = useState("");
  const [metaRedirectUri, setMetaRedirectUri] = useState("");
  const [metaWebhookUrl, setMetaWebhookUrl] = useState("");
  const [metaWhatsappAccountId, setMetaWhatsappAccountId] = useState("");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaDisplayPhoneNumber, setMetaDisplayPhoneNumber] = useState("");
  const [metaVerifiedName, setMetaVerifiedName] = useState("");
  const [metaBusinessId, setMetaBusinessId] = useState("");
  const [, setMetaBusinessName] = useState("");
  const [, setMetaBusinessManagerId] = useState("");
  const [, setMetaBusinessManagerName] = useState("");
  const [, setMetaWhatsappAccountName] = useState("");
  const [unlinkingMetaParamId, setUnlinkingMetaParamId] = useState<number | null>(null);
  const [updatingMetaColorParamId, setUpdatingMetaColorParamId] = useState<number | null>(null);
  const [metaNumberColorDrafts, setMetaNumberColorDrafts] = useState<Record<string, string>>({});
  const [linkedMetaAccounts, setLinkedMetaAccounts] = useState<MetaIntegrationAccount[]>([]);
  const [selectedMetaParamId, setSelectedMetaParamId] = useState("");
  const [isAccountPanelExpanded, setIsAccountPanelExpanded] = useState(false);
  const [templates, setTemplates] = useState<MetaTemplateItem[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("UTILITY");
  const [templateLanguage, setTemplateLanguage] = useState("pt_BR");
  const [templateAllowCategoryChange, setTemplateAllowCategoryChange] =
    useState(true);
  const [templateMediaSampleType, setTemplateMediaSampleType] =
    useState<TemplateMediaSampleType>("NONE");
  const [templateMediaSampleFile, setTemplateMediaSampleFile] = useState<File | null>(null);
  const [templateMediaSamplePreviewUrl, setTemplateMediaSamplePreviewUrl] = useState("");
  const [templateHeader, setTemplateHeader] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateFooter, setTemplateFooter] = useState("");
  const [templateButtons, setTemplateButtons] = useState<TemplateButtonDraft[]>([
    buildTemplateButtonDraft(),
  ]);
  const [templateVariableSamples, setTemplateVariableSamples] = useState<
    Record<string, string>
  >({});
  const [hasSubmittedTemplate, setHasSubmittedTemplate] = useState(false);
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");
  const templateBodyRef = useRef<HTMLTextAreaElement | null>(null);

  const [autoMessageDrafts, setAutoMessageDrafts] =
    useState<Record<AutoMessageTypeId, AutoMessageDraft>>(buildDefaultDrafts());
  const [isLoadingAutoMessages, setIsLoadingAutoMessages] = useState(false);
  const [autoMessageGalleryImages, setAutoMessageGalleryImages] = useState<
    QuickMessageGalleryImage[]
  >([]);
  const [isLoadingAutoMessageGalleryImages, setIsLoadingAutoMessageGalleryImages] =
    useState(false);
  const [isUploadingAutoMessageGalleryImage, setIsUploadingAutoMessageGalleryImage] =
    useState(false);
  const [savingType, setSavingType] = useState<AutoMessageTypeId | null>(null);
  const [deletingType, setDeletingType] = useState<AutoMessageTypeId | null>(
    null,
  );
  const [togglingType, setTogglingType] = useState<AutoMessageTypeId | null>(null);
  const [editingType, setEditingType] = useState<AutoMessageTypeId | null>(null);
  const [birthdayTemplateConfig, setBirthdayTemplateConfig] =
    useState<BirthdayTemplateConfig | null>(null);
  const [birthdayTemplateName, setBirthdayTemplateName] = useState("");
  const [birthdayTemplateLanguage, setBirthdayTemplateLanguage] =
    useState("pt_BR");
  const [birthdayTemplateSchedule, setBirthdayTemplateSchedule] =
    useState("09:00");
  const [birthdayIsDefaultDispatchNumber, setBirthdayIsDefaultDispatchNumber] =
    useState(false);
  const [birthdayTemplateHeaderMediaUrl, setBirthdayTemplateHeaderMediaUrl] =
    useState("");
  const [birthdayTemplateHeaderFile, setBirthdayTemplateHeaderFile] =
    useState<File | null>(null);
  const [birthdayTemplateHeaderPreviewUrl, setBirthdayTemplateHeaderPreviewUrl] =
    useState("");
  const [birthdayHeaderParameterValues, setBirthdayHeaderParameterValues] =
    useState<TemplateParameterInput[]>([]);
  const [birthdayBodyParameterValues, setBirthdayBodyParameterValues] =
    useState<TemplateParameterInput[]>([]);
  const [birthdayButtonParameterValues, setBirthdayButtonParameterValues] =
    useState<Record<number, TemplateParameterInput[]>>({});
  const [isLoadingBirthdayTemplateConfig, setIsLoadingBirthdayTemplateConfig] =
    useState(false);
  const [isSavingBirthdayTemplateConfig, setIsSavingBirthdayTemplateConfig] =
    useState(false);
  const [saleCompletedTemplateConfig, setSaleCompletedTemplateConfig] =
    useState<TemplateAutomationConfig | null>(null);
  const [saleCompletedTemplateName, setSaleCompletedTemplateName] = useState("");
  const [saleCompletedTemplateLanguage, setSaleCompletedTemplateLanguage] =
    useState("pt_BR");
  const [saleCompletedTemplateSchedule, setSaleCompletedTemplateSchedule] =
    useState("09:00");
  const [saleCompletedDelayDays, setSaleCompletedDelayDays] = useState("3");
  const [saleCompletedIsDefaultDispatchNumber, setSaleCompletedIsDefaultDispatchNumber] =
    useState(false);
  const [saleCompletedTemplateHeaderMediaUrl, setSaleCompletedTemplateHeaderMediaUrl] =
    useState("");
  const [saleCompletedTemplateHeaderFile, setSaleCompletedTemplateHeaderFile] =
    useState<File | null>(null);
  const [saleCompletedTemplateHeaderPreviewUrl] = useState("");
  const [saleCompletedHeaderParameterValues, setSaleCompletedHeaderParameterValues] =
    useState<TemplateParameterInput[]>([]);
  const [saleCompletedBodyParameterValues, setSaleCompletedBodyParameterValues] =
    useState<TemplateParameterInput[]>([]);
  const [saleCompletedButtonParameterValues, setSaleCompletedButtonParameterValues] =
    useState<Record<number, TemplateParameterInput[]>>({});
  const [isLoadingSaleCompletedTemplateConfig, setIsLoadingSaleCompletedTemplateConfig] =
    useState(false);
  const [isSavingSaleCompletedTemplateConfig, setIsSavingSaleCompletedTemplateConfig] =
    useState(false);
  const [saleRefusedTemplateConfig, setSaleRefusedTemplateConfig] =
    useState<TemplateAutomationConfig | null>(null);
  const [saleRefusedTemplateName, setSaleRefusedTemplateName] = useState("");
  const [saleRefusedTemplateLanguage, setSaleRefusedTemplateLanguage] =
    useState("pt_BR");
  const [saleRefusedTemplateSchedule, setSaleRefusedTemplateSchedule] =
    useState("09:00");
  const [saleRefusedDelayDays, setSaleRefusedDelayDays] = useState("3");
  const [saleRefusedIsDefaultDispatchNumber, setSaleRefusedIsDefaultDispatchNumber] =
    useState(false);
  const [saleRefusedTemplateHeaderMediaUrl, setSaleRefusedTemplateHeaderMediaUrl] =
    useState("");
  const [saleRefusedTemplateHeaderFile, setSaleRefusedTemplateHeaderFile] =
    useState<File | null>(null);
  const [saleRefusedTemplateHeaderPreviewUrl] = useState("");
  const [saleRefusedHeaderParameterValues, setSaleRefusedHeaderParameterValues] =
    useState<TemplateParameterInput[]>([]);
  const [saleRefusedBodyParameterValues, setSaleRefusedBodyParameterValues] =
    useState<TemplateParameterInput[]>([]);
  const [saleRefusedButtonParameterValues, setSaleRefusedButtonParameterValues] =
    useState<Record<number, TemplateParameterInput[]>>({});
  const [isLoadingSaleRefusedTemplateConfig, setIsLoadingSaleRefusedTemplateConfig] =
    useState(false);
  const [isSavingSaleRefusedTemplateConfig, setIsSavingSaleRefusedTemplateConfig] =
    useState(false);
  const [activeMetaViewTab, setActiveMetaViewTab] =
    useState<MetaViewTab>("templates");
  const [whatsAppProfile, setWhatsAppProfile] =
    useState<WhatsAppProfileData | null>(null);
  const [whatsAppProfileDraft, setWhatsAppProfileDraft] =
    useState<WhatsAppProfileDraft>(buildWhatsAppProfileDraft());
  const [whatsAppProfileError, setWhatsAppProfileError] = useState("");
  const [isLoadingWhatsAppProfile, setIsLoadingWhatsAppProfile] =
    useState(false);
  const [isSavingWhatsAppProfile, setIsSavingWhatsAppProfile] =
    useState(false);
  const [whatsAppProfilePictureFile, setWhatsAppProfilePictureFile] =
    useState<File | null>(null);
  const [whatsAppProfilePicturePreviewUrl, setWhatsAppProfilePicturePreviewUrl] =
    useState("");
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] =
    useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [archivingTemplateId, setArchivingTemplateId] = useState<string | null>(null);
  const [isEmojiMenuOpen, setIsEmojiMenuOpen] = useState(false);
  const emojiMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplateItem | null>(
    null,
  );
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [isTemplateDetailsModalOpen, setIsTemplateDetailsModalOpen] =
    useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [isLoadingTemplateMetrics, setIsLoadingTemplateMetrics] =
    useState(false);
  const [templateMetricsError, setTemplateMetricsError] = useState("");
  const [templateMetricsById, setTemplateMetricsById] = useState<
    Record<string, TemplateMetricsResult>
  >({});
  const [metricsStartDate, setMetricsStartDate] = useState("");
  const [metricsEndDate, setMetricsEndDate] = useState("");
  const [isApplyingMetricsPeriod, setIsApplyingMetricsPeriod] = useState(false);
  const [templateOperationLanguage, setTemplateOperationLanguage] =
    useState("pt_BR");
  const [templateDispatchCustomerSearch, setTemplateDispatchCustomerSearch] =
    useState("");
  const [templateDispatchCustomerSuggestions, setTemplateDispatchCustomerSuggestions] =
    useState<CommercialCustomerSuggestion[]>([]);
  const [isSearchingTemplateDispatchCustomer, setIsSearchingTemplateDispatchCustomer] =
    useState(false);
  const [selectedTemplateDispatchCustomer, setSelectedTemplateDispatchCustomer] =
    useState<CommercialCustomerSuggestion | null>(null);
  const [templateHeaderParameterValues, setTemplateHeaderParameterValues] =
    useState<TemplateParameterInput[]>([]);
  const [templateBodyParameterValues, setTemplateBodyParameterValues] = useState<
    TemplateParameterInput[]
  >([]);
  const [templateButtonParameterValues, setTemplateButtonParameterValues] =
    useState<Record<number, TemplateParameterInput[]>>({});
  const [templateHeaderFile, setTemplateHeaderFile] = useState<File | null>(null);
  const [templateHeaderPreviewUrl, setTemplateHeaderPreviewUrl] = useState("");
  const [templateDispatchResult, setTemplateDispatchResult] =
    useState<Record<string, unknown> | null>(null);
  const [templateOperationTab, setTemplateOperationTab] =
    useState<TemplateOperationTab>("preview");
  const [templateBatchStopOnError, setTemplateBatchStopOnError] = useState(false);
  const [templateBatchLeadStartedMessagesGenerateAutoMessage, setTemplateBatchLeadStartedMessagesGenerateAutoMessage] =
    useState(true);
  const [templateDispatchMode, setTemplateDispatchMode] =
    useState<TemplateDispatchMode>("single");
  const [templateBatchResult, setTemplateBatchResult] =
    useState<BatchDispatchTemplateResult | null>(null);
  const [templateBatchProgress, setTemplateBatchProgress] =
    useState<BatchDispatchProgressResult | null>(null);
  const [currentTemplateBatchToken, setCurrentTemplateBatchToken] = useState("");
  const [broadcastLists, setBroadcastLists] = useState<BroadcastList[]>([]);
  const [isLoadingBroadcastLists, setIsLoadingBroadcastLists] = useState(false);
  const [selectedBroadcastListId, setSelectedBroadcastListId] = useState("");
  const [selectedBroadcastListContactCount, setSelectedBroadcastListContactCount] =
    useState<number | null>(null);
  const selectedBroadcastList = useMemo(
    () =>
      broadcastLists.find((list) => String(list.id) === selectedBroadcastListId) || null,
    [broadcastLists, selectedBroadcastListId],
  );
  const [templateOperationError, setTemplateOperationError] = useState("");
  const [isDispatchingTemplate, setIsDispatchingTemplate] = useState(false);
  const [isDispatchingTemplateBatch, setIsDispatchingTemplateBatch] =
    useState(false);
  const [dispatchCostStartDate, setDispatchCostStartDate] = useState("");
  const [dispatchCostEndDate, setDispatchCostEndDate] = useState("");
  const [dispatchCostMetrics, setDispatchCostMetrics] =
    useState<DispatchCostMetricsResult | null>(null);
  const [dispatchCostError, setDispatchCostError] = useState("");
  const [isLoadingDispatchCostMetrics, setIsLoadingDispatchCostMetrics] =
    useState(false);
  const settingsContentScrollTopRef = useRef(0);
  const [hasFetchedStatusOnce, setHasFetchedStatusOnce] = useState(false);
  const [hasFetchedTemplatesOnce, setHasFetchedTemplatesOnce] = useState(false);
  const [hasFetchedAutoMessagesOnce, setHasFetchedAutoMessagesOnce] = useState(false);
  const metaEmbeddedIdentifiersRef = useRef<MetaEmbeddedSignupIdentifiers>({});

  useEffect(() => {
    if (!isMetricsModalOpen) return;

    const normalizedSearch = String(templateDispatchCustomerSearch || "").trim();
    if (selectedTemplateDispatchCustomer) {
      setTemplateDispatchCustomerSuggestions([]);
      setIsSearchingTemplateDispatchCustomer(false);
      return;
    }

    if (normalizedSearch.length < 2) {
      setTemplateDispatchCustomerSuggestions([]);
      setIsSearchingTemplateDispatchCustomer(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsSearchingTemplateDispatchCustomer(true);
      searchCommercialCustomers(normalizedSearch, 8)
        .then((items) => setTemplateDispatchCustomerSuggestions(items))
        .catch(() => setTemplateDispatchCustomerSuggestions([]))
        .finally(() => setIsSearchingTemplateDispatchCustomer(false));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    isMetricsModalOpen,
    selectedTemplateDispatchCustomer,
    templateDispatchCustomerSearch,
  ]);

  useEffect(() => {
    if (!templateHeaderFile) {
      setTemplateHeaderPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(templateHeaderFile);
    setTemplateHeaderPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [templateHeaderFile]);

  useEffect(() => {
    if (!birthdayTemplateHeaderFile) {
      setBirthdayTemplateHeaderPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(birthdayTemplateHeaderFile);
    setBirthdayTemplateHeaderPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [birthdayTemplateHeaderFile]);

  useEffect(() => {
    if (!whatsAppProfilePictureFile) {
      setWhatsAppProfilePicturePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(whatsAppProfilePictureFile);
    setWhatsAppProfilePicturePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [whatsAppProfilePictureFile]);

  const waitForMetaEmbeddedIdentifiers = useCallback(
    async (timeoutMs = 8000): Promise<MetaEmbeddedSignupIdentifiers> => {
      const start = Date.now();

      while (Date.now() - start < timeoutMs) {
        const identifiers = metaEmbeddedIdentifiersRef.current;
        if (
          identifiers.phoneNumberId ||
          identifiers.wabaId
        ) {
          return identifiers;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 150));
      }

      return metaEmbeddedIdentifiersRef.current;
    },
    [],
  );

  const metaAppId = String(import.meta.env.VITE_META_APP_ID || "");
  const metaApiVersion = String(
    import.meta.env.VITE_META_API_VERSION || "v25.0",
  );
  const metaConfigId = String(
    import.meta.env.VITE_META_CONFIG_ID || "",
  );
  const metaDefaultRedirectUri = String(
    import.meta.env.VITE_META_REDIRECT_URI || "",
  ).trim();
  const metaEmbeddedSignupOptions: FacebookLoginOptions = {
    config_id: metaConfigId,
    response_type: "code",
    override_default_response_type: true,
    scope:
      "business_management,whatsapp_business_management,whatsapp_business_messaging",
    return_scopes: true,
    display: "popup",
    extras: {
      feature: "whatsapp_embedded_signup",
      featureType: "whatsapp_business_app_onboarding",
      sessionInfoVersion: "3",
      version: "v3",
      setup: {},
    },
  };

  useEffect(() => {
    if (!metaRedirectUri && metaDefaultRedirectUri) {
      setMetaRedirectUri(metaDefaultRedirectUri);
    }
  }, [metaDefaultRedirectUri, metaRedirectUri]);

  useEffect(() => {
    const handleMetaEmbeddedMessage = (event: MessageEvent) => {
      const origin = String(event.origin || "");
      if (!origin.includes("facebook.com")) {
        return;
      }

      const identifiers = parseMetaEmbeddedSignupIdentifiers(event.data);
      if (!identifiers) return;
      metaEmbeddedIdentifiersRef.current = {
        ...metaEmbeddedIdentifiersRef.current,
        ...identifiers,
      };

      if (identifiers.wabaId) {
        setMetaWhatsappAccountId((current) => current || identifiers.wabaId || "");
      }
      if (identifiers.phoneNumberId) {
        setMetaPhoneNumberId((current) => current || identifiers.phoneNumberId || "");
      }
      if (identifiers.businessId) {
        setMetaBusinessId((current) => current || identifiers.businessId || "");
      }
    };

    window.addEventListener("message", handleMetaEmbeddedMessage);
    return () => window.removeEventListener("message", handleMetaEmbeddedMessage);
  }, []);

  const visibleStatus = isLoadingStatus
    ? "Consultando status..."
    : integrationStatus;
  // const templateHeaderLength = templateHeader.length;
  const templateBodyLength = templateBody.length;
  const templateFooterLength = templateFooter.length;
  const templateVariables = useMemo(
    () =>
      extractTemplateVariables(
        [templateHeader, templateBody, templateFooter].filter(Boolean).join(" "),
      ),
    [templateBody, templateFooter, templateHeader],
  );
  const templateHeaderVariables = useMemo(
    () => extractTemplateVariables(templateHeader),
    [templateHeader],
  );
  const templateBodyVariables = useMemo(
    () => extractTemplateVariables(templateBody),
    [templateBody],
  );
  const missingSampleVariables = useMemo(
    () =>
      templateVariables.filter(
        (variableId) => !templateVariableSamples[variableId]?.trim(),
      ),
    [templateVariableSamples, templateVariables],
  );
  const previewBody = useMemo(
    () => applyVariableSample(templateBody, templateVariableSamples),
    [templateBody, templateVariableSamples],
  );
  const previewHeader = useMemo(
    () => applyVariableSample(templateHeader, templateVariableSamples),
    [templateHeader, templateVariableSamples],
  );
  const previewFooter = useMemo(
    () => applyVariableSample(templateFooter, templateVariableSamples),
    [templateFooter, templateVariableSamples],
  );
  const previewTemplateButtons = useMemo(
    () => buildTemplateButtons(templateButtons, false).buttons,
    [templateButtons],
  );
  const previewPayload = useMemo(() => {
    const payloadComponents: TemplateComponent[] = [];
    const headerVariableSamples = templateHeaderVariables.map(
      (variableId) => templateVariableSamples[variableId]?.trim() || "",
    );
    const bodyVariableSamples = templateBodyVariables.map(
      (variableId) => templateVariableSamples[variableId]?.trim() || "",
    );

    if (templateMediaSampleType !== "NONE") {
      payloadComponents.push({
        type: "HEADER",
        format: templateMediaSampleType,
      });
    } else if (templateHeader.trim()) {
      const headerComponent: TemplateComponent = {
        type: "HEADER",
        format: "TEXT",
        text: templateHeader.trim(),
      };

      if (templateHeaderVariables.length > 0) {
        headerComponent.example = { header_text: headerVariableSamples };
      }
      payloadComponents.push(headerComponent);
    }

    const bodyComponent: TemplateComponent = {
      type: "BODY",
      text: templateBody.trim(),
    };
    if (templateBodyVariables.length > 0) {
      bodyComponent.example = { body_text: [bodyVariableSamples] };
    }
    payloadComponents.push(bodyComponent);

    if (templateFooter.trim()) {
      payloadComponents.push({
        type: "FOOTER",
        text: templateFooter.trim(),
      });
    }

    const previewButtons = buildTemplateButtons(templateButtons, false).buttons;
    if (previewButtons.length > 0) {
      payloadComponents.push({
        type: "BUTTONS",
        buttons: previewButtons,
      });
    }

    return {
      name: templateName.trim(),
      category: templateCategory,
      language: templateLanguage.trim(),
      allow_category_change: templateAllowCategoryChange,
      parameter_format: "POSITIONAL",
      components: payloadComponents,
      variable_samples: templateVariables.map((variableId) => ({
        variable: `{{${variableId}}}`,
        sample: templateVariableSamples[variableId]?.trim() || "",
      })),
      media_sample_type: templateMediaSampleType,
    };
  }, [
    templateAllowCategoryChange,
    templateBody,
    templateButtons,
    templateCategory,
    templateFooter,
    templateHeader,
    templateLanguage,
    templateMediaSampleType,
    templateName,
    templateBodyVariables,
    templateHeaderVariables,
    templateVariableSamples,
    templateVariables,
  ]);

  const filteredTemplates = useMemo(() => {
    const term = templateSearchTerm.trim().toLowerCase();
    if (!term) return templates;

    return templates.filter((template) => {
      const content = extractTemplateTexts(template);
      const statusLabel = normalizeTemplateStatus(template.status);
      const categoryLabel = normalizeTemplateCategory(template.category);
      const haystack = [
        template.name,
        template.category,
        template.status,
        categoryLabel,
        statusLabel,
        template.language,
          content.header,
          content.body,
          content.footer,
          content.buttons.map((button) => getPreviewButtonLabel(button)).join(" "),
        ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [templateSearchTerm, templates]);
  const statusTone = useMemo(() => {
    if (isLoadingStatus) return "loading";

    const normalized = integrationStatus.toLowerCase();

    if (normalized.includes("erro") || normalized.includes("invalido")) {
      return "danger";
    }

    if (
      normalized.includes("integrado") ||
      normalized.includes("ativa") ||
      normalized.includes("ativo") ||
      normalized.includes("conectado")
    ) {
      return "success";
    }

    if (
      normalized.includes("nao integrado") ||
      normalized.includes("aguardando") ||
      normalized.includes("sem empresa") ||
      normalized.includes("pendente")
    ) {
      return "warning";
    }

    return "neutral";
  }, [integrationStatus, isLoadingStatus]);

  const buildIntegrationStatusLabel = useCallback((data: IntegrationStatusData) => {
    if (data.pronto_para_uso || data.conectado) {
      return "Integracao ativa";
    }

    if (Array.isArray(data.campos_faltantes) && data.campos_faltantes.length) {
      return "Integracao com campos pendentes";
    }

    return "Integracao atualizada";
  }, []);

  const sortLinkedMetaAccounts = useCallback((accounts: MetaIntegrationAccount[]) => {
    return [...accounts].sort((left, right) => {
      const leftTime = left.last_embedded_signup_at
        ? new Date(left.last_embedded_signup_at).getTime()
        : 0;
      const rightTime = right.last_embedded_signup_at
        ? new Date(right.last_embedded_signup_at).getTime()
        : 0;

      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return Number(right.id || 0) - Number(left.id || 0);
    });
  }, []);

  const getPrimaryLinkedMetaAccount = useCallback(
    (accounts: MetaIntegrationAccount[]) => {
      const sortedAccounts = sortLinkedMetaAccounts(accounts);
      const activeAccount =
        sortedAccounts.find((account) => account.ativo !== false) || null;
      return activeAccount || sortedAccounts[0] || null;
    },
    [sortLinkedMetaAccounts],
  );

  const normalizeMetaAccountColor = useCallback((value?: string | null) => {
    const normalized = String(value || "").trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : "#0F766E";
  }, []);

  const selectedMetaAccount = useMemo(() => {
    if (!linkedMetaAccounts.length) return null;
    if (!selectedMetaParamId) {
      return getPrimaryLinkedMetaAccount(linkedMetaAccounts);
    }

    const selectedAccount =
      linkedMetaAccounts.find(
        (account) => String(account.id || "") === selectedMetaParamId,
      ) || null;

    if (selectedAccount?.ativo !== false) {
      return selectedAccount;
    }

    return getPrimaryLinkedMetaAccount(linkedMetaAccounts);
  }, [getPrimaryLinkedMetaAccount, linkedMetaAccounts, selectedMetaParamId]);

  useEffect(() => {
    setMetaNumberColorDrafts((current) => {
      const next: Record<string, string> = {};

      linkedMetaAccounts.forEach((account) => {
        const accountId = String(account.id || "").trim();
        if (!accountId) return;

        next[accountId] =
          current[accountId] || normalizeMetaAccountColor(account.color);
      });

      return next;
    });
  }, [linkedMetaAccounts, normalizeMetaAccountColor]);

  const selectedMetaScope = useMemo(() => {
    const accountId = Number(selectedMetaAccount?.id || 0);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return {};
    }

    return { metaParamId: accountId };
  }, [selectedMetaAccount]);

  const applyBirthdayTemplateConfigSnapshot = useCallback(
    (config?: BirthdayTemplateConfig | null) => {
      setBirthdayTemplateConfig(config || null);
      setBirthdayTemplateName(String(config?.template_name || "").trim());
      setBirthdayTemplateLanguage(
        String(config?.template_language || "pt_BR").trim() || "pt_BR",
      );
      setBirthdayTemplateSchedule(normalizeTimeInputValue(config?.horario));
      setBirthdayIsDefaultDispatchNumber(
        config?.is_default_dispatch_number === true,
      );
      setBirthdayTemplateHeaderMediaUrl(
        String(config?.header_media_url || "").trim(),
      );
      setBirthdayTemplateHeaderFile(null);
      setBirthdayHeaderParameterValues(
        mapTemplateParameterPayloadArrayToInputs(
          Array.isArray(config?.header_parameters)
            ? config.header_parameters
            : [],
        ),
      );
      setBirthdayBodyParameterValues(
        mapTemplateParameterPayloadArrayToInputs(
          Array.isArray(config?.body_parameters) ? config.body_parameters : [],
        ),
      );
      setBirthdayButtonParameterValues(
        mapTemplateButtonPayloadArrayToInputs(
          Array.isArray(config?.button_parameters)
            ? config.button_parameters
            : [],
        ),
      );
    },
    [],
  );

  const applySaleCompletedTemplateConfigSnapshot = useCallback(
    (config?: TemplateAutomationConfig | null) => {
      setSaleCompletedTemplateConfig(config || null);
      setSaleCompletedTemplateName(String(config?.template_name || "").trim());
      setSaleCompletedTemplateLanguage(
        String(config?.template_language || "pt_BR").trim() || "pt_BR",
      );
      setSaleCompletedTemplateSchedule(normalizeTimeInputValue(config?.horario));
      setSaleCompletedDelayDays(String(config?.delay_days ?? 3));
      setSaleCompletedIsDefaultDispatchNumber(
        config?.is_default_dispatch_number === true,
      );
      setSaleCompletedTemplateHeaderMediaUrl(
        String(config?.header_media_url || "").trim(),
      );
      setSaleCompletedTemplateHeaderFile(null);
      setSaleCompletedHeaderParameterValues(
        mapTemplateParameterPayloadArrayToInputs(
          Array.isArray(config?.header_parameters)
            ? config.header_parameters
            : [],
        ),
      );
      setSaleCompletedBodyParameterValues(
        mapTemplateParameterPayloadArrayToInputs(
          Array.isArray(config?.body_parameters) ? config.body_parameters : [],
        ),
      );
      setSaleCompletedButtonParameterValues(
        mapTemplateButtonPayloadArrayToInputs(
          Array.isArray(config?.button_parameters)
            ? config.button_parameters
            : [],
        ),
      );
    },
    [],
  );

  const applySaleRefusedTemplateConfigSnapshot = useCallback(
    (config?: TemplateAutomationConfig | null) => {
      setSaleRefusedTemplateConfig(config || null);
      setSaleRefusedTemplateName(String(config?.template_name || "").trim());
      setSaleRefusedTemplateLanguage(
        String(config?.template_language || "pt_BR").trim() || "pt_BR",
      );
      setSaleRefusedTemplateSchedule(normalizeTimeInputValue(config?.horario));
      setSaleRefusedDelayDays(String(config?.delay_days ?? 3));
      setSaleRefusedIsDefaultDispatchNumber(
        config?.is_default_dispatch_number === true,
      );
      setSaleRefusedTemplateHeaderMediaUrl(
        String(config?.header_media_url || "").trim(),
      );
      setSaleRefusedTemplateHeaderFile(null);
      setSaleRefusedHeaderParameterValues(
        mapTemplateParameterPayloadArrayToInputs(
          Array.isArray(config?.header_parameters)
            ? config.header_parameters
            : [],
        ),
      );
      setSaleRefusedBodyParameterValues(
        mapTemplateParameterPayloadArrayToInputs(
          Array.isArray(config?.body_parameters) ? config.body_parameters : [],
        ),
      );
      setSaleRefusedButtonParameterValues(
        mapTemplateButtonPayloadArrayToInputs(
          Array.isArray(config?.button_parameters)
            ? config.button_parameters
            : [],
        ),
      );
    },
    [],
  );

  const loadBirthdayTemplateConfig = useCallback(async () => {
    if (!user?.empresa_id) return;

    const selectedMetaParamId = Number(selectedMetaScope.metaParamId || 0);
    if (!Number.isInteger(selectedMetaParamId) || selectedMetaParamId <= 0) {
      applyBirthdayTemplateConfigSnapshot(null);
      return;
    }

    try {
      setIsLoadingBirthdayTemplateConfig(true);
      const config = await MetaService.getBirthdayTemplateConfig(
        user.empresa_id,
        selectedMetaScope,
      );
      applyBirthdayTemplateConfigSnapshot(config);
    } catch (error) {
      applyBirthdayTemplateConfigSnapshot(null);
      addToast({
        type: "error",
        title: "Erro ao carregar aniversario",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar a configuracao de aniversario.",
      });
    } finally {
      setIsLoadingBirthdayTemplateConfig(false);
    }
  }, [
    addToast,
    applyBirthdayTemplateConfigSnapshot,
    selectedMetaScope,
    user?.empresa_id,
  ]);

  const loadSaleCompletedTemplateConfig = useCallback(async () => {
    if (!user?.empresa_id) return;

    const selectedMetaParamId = Number(selectedMetaScope.metaParamId || 0);
    if (!Number.isInteger(selectedMetaParamId) || selectedMetaParamId <= 0) {
      applySaleCompletedTemplateConfigSnapshot(null);
      return;
    }

    try {
      setIsLoadingSaleCompletedTemplateConfig(true);
      const config = await MetaService.getTemplateAutomationConfig(
        user.empresa_id,
        "sale_completed",
        selectedMetaScope,
      );
      applySaleCompletedTemplateConfigSnapshot(config);
    } catch (error) {
      applySaleCompletedTemplateConfigSnapshot(null);
      addToast({
        type: "error",
        title: "Erro ao carregar follow-up de venda realizada",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar a configuracao do follow-up de venda realizada.",
      });
    } finally {
      setIsLoadingSaleCompletedTemplateConfig(false);
    }
  }, [
    addToast,
    applySaleCompletedTemplateConfigSnapshot,
    selectedMetaScope,
    user?.empresa_id,
  ]);

  const loadSaleRefusedTemplateConfig = useCallback(async () => {
    if (!user?.empresa_id) return;

    const selectedMetaParamId = Number(selectedMetaScope.metaParamId || 0);
    if (!Number.isInteger(selectedMetaParamId) || selectedMetaParamId <= 0) {
      applySaleRefusedTemplateConfigSnapshot(null);
      return;
    }

    try {
      setIsLoadingSaleRefusedTemplateConfig(true);
      const config = await MetaService.getTemplateAutomationConfig(
        user.empresa_id,
        "sale_refused",
        selectedMetaScope,
      );
      applySaleRefusedTemplateConfigSnapshot(config);
    } catch (error) {
      applySaleRefusedTemplateConfigSnapshot(null);
      addToast({
        type: "error",
        title: "Erro ao carregar follow-up de venda recusada",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar a configuracao do follow-up de venda recusada.",
      });
    } finally {
      setIsLoadingSaleRefusedTemplateConfig(false);
    }
  }, [
    addToast,
    applySaleRefusedTemplateConfigSnapshot,
    selectedMetaScope,
    user?.empresa_id,
  ]);

  const loadBroadcastLists = useCallback(async () => {
    if (!user?.empresa_id || !user?.id) return;

    try {
      setIsLoadingBroadcastLists(true);
      const lists = await fetchBroadcastLists(
        user.empresa_id,
        user.id,
        Number(selectedMetaScope.metaParamId || 0) || null
      );
      setBroadcastLists(lists);
      setSelectedBroadcastListId((current) => {
        if (current && lists.some((item) => String(item.id) === current)) {
          return current;
        }
        return lists[0] ? String(lists[0].id) : "";
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar listas",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as listas de transmissao.",
      });
    } finally {
      setIsLoadingBroadcastLists(false);
    }
  }, [addToast, selectedMetaScope.metaParamId, user?.empresa_id, user?.id]);

  useEffect(() => {
    if (!isManagementModule) return;
    void loadBroadcastLists();
  }, [isManagementModule, loadBroadcastLists]);

  const selectedMetaAccountLabel = useMemo(() => {
    if (!selectedMetaAccount) return "Conta padrao da empresa";

    return (
      getMetaAccountPrimaryLabel(selectedMetaAccount) ||
      selectedMetaAccount.verified_name ||
      selectedMetaAccount.whatsapp_account_name ||
      `Conta ${selectedMetaAccount.id || ""}`.trim()
    );
  }, [selectedMetaAccount]);

  const selectedMetaAccountOfficialLabel = useMemo(
    () =>
      selectedMetaAccount
        ? getMetaAccountSecondaryLabel(selectedMetaAccount)
        : "-",
    [selectedMetaAccount],
  );

  const selectedMetaAccountTechnicalLabel = useMemo(
    () =>
      selectedMetaAccount
        ? getMetaAccountTechnicalLabel(selectedMetaAccount)
        : "-",
    [selectedMetaAccount],
  );

  const currentWhatsAppProfilePictureUrl =
    whatsAppProfilePicturePreviewUrl ||
    whatsAppProfileDraft.profilePictureUrl ||
    "";

  const applyWhatsAppProfileSnapshot = useCallback(
    (profile: WhatsAppProfileData | null) => {
      setWhatsAppProfile(profile);
      setWhatsAppProfileDraft(buildWhatsAppProfileDraft(profile));
      setWhatsAppProfilePictureFile(null);
      setWhatsAppProfileError("");
    },
    [],
  );

  const applyLinkedAccountSnapshot = useCallback((account: MetaIntegrationAccount | null) => {
    if (!account) {
      return;
    }

    setMetaWebhookUrl(account.webhook_url || "");
    setMetaWhatsappAccountId(account.whatsapp_account_id || "");
    setMetaPhoneNumberId(account.phone_number_id || "");
    setMetaDisplayPhoneNumber(account.display_phone_number || "");
    setMetaVerifiedName(account.verified_name || "");
    setMetaBusinessId(account.business_id || "");
    setMetaBusinessName(account.business_name || "");
    setMetaBusinessManagerId(account.business_manager_id || "");
    setMetaBusinessManagerName(account.business_manager_name || "");
    setMetaWhatsappAccountName(account.whatsapp_account_name || "");
    setIntegrationData((current) =>
      current
        ? {
            ...current,
            id: account.id ?? current.id,
            business_id: account.business_id ?? current.business_id,
            business_name: account.business_name ?? current.business_name,
            business_manager_id:
              account.business_manager_id ?? current.business_manager_id,
            business_manager_name:
              account.business_manager_name ?? current.business_manager_name,
            whatsapp_account_id:
              account.whatsapp_account_id ?? current.whatsapp_account_id,
            whatsapp_account_name:
              account.whatsapp_account_name ?? current.whatsapp_account_name,
            phone_number_id: account.phone_number_id ?? current.phone_number_id,
            display_phone_number:
              account.display_phone_number ?? current.display_phone_number,
            verified_name: account.verified_name ?? current.verified_name,
            wa_id: account.wa_id ?? current.wa_id,
            webhook_verify_token:
              account.webhook_verify_token ?? current.webhook_verify_token,
            webhook_url: account.webhook_url ?? current.webhook_url,
            graph_api_version:
              account.graph_api_version ?? current.graph_api_version,
            token_expires_at: account.token_expires_at ?? current.token_expires_at,
            last_embedded_signup_at:
              account.last_embedded_signup_at ?? current.last_embedded_signup_at,
            ativo: account.ativo ?? current.ativo,
          }
        : current,
    );
  }, []);

  const applyIntegrationSnapshot = useCallback(
    (data: IntegrationStatusData, statusText?: string) => {
      setIntegrationStatus(statusText || buildIntegrationStatusLabel(data));
      setIsIntegrationActive(Boolean(data.pronto_para_uso || data.conectado));
      setIntegrationData(data);
      setMetaWebhookUrl(data.webhook_url || "");
      setMetaWhatsappAccountId(data.whatsapp_account_id || "");
      setMetaPhoneNumberId(data.phone_number_id || "");
      setMetaDisplayPhoneNumber(data.display_phone_number || "");
      setMetaVerifiedName(data.verified_name || "");
      setMetaBusinessId(data.business_id || "");
      setMetaBusinessName(data.business_name || "");
      setMetaBusinessManagerId(data.business_manager_id || "");
      setMetaBusinessManagerName(data.business_manager_name || "");
      setMetaWhatsappAccountName(data.whatsapp_account_name || "");
    },
    [buildIntegrationStatusLabel],
  );

  const refreshLinkedMetaAccounts = useCallback(async () => {
    if (!user?.empresa_id) {
      setLinkedMetaAccounts([]);
      return [];
    }

    const linkedAccounts = await MetaService.getIntegrationNumbers(
      user.empresa_id,
      user.id
    ).catch(
      () => [],
    );
    const normalizedAccounts = Array.isArray(linkedAccounts)
      ? sortLinkedMetaAccounts(linkedAccounts)
      : [];
    setLinkedMetaAccounts(normalizedAccounts);
    setSelectedMetaParamId((current) => {
      if (
        current &&
        normalizedAccounts.some(
          (account) =>
            String(account.id || "") === current && account.ativo !== false,
        )
      ) {
        return current;
      }

      const primaryAccount = getPrimaryLinkedMetaAccount(normalizedAccounts);
      return primaryAccount?.id ? String(primaryAccount.id) : "";
    });
    return normalizedAccounts;
  }, [getPrimaryLinkedMetaAccount, sortLinkedMetaAccounts, user?.empresa_id, user?.id]);

  const handleSaveMetaIntegration = useCallback(
    async (overrides?: {
      accessToken?: string;
      signupCode?: string;
      whatsappAccountId?: string;
      phoneNumberId?: string;
      businessId?: string;
      embeddedSignupEvent?: string;
      isWaLoginUser?: boolean;
    }) => {
      if (!user?.empresa_id) {
        return false;
      }

      const signupCode = overrides?.signupCode || metaSignupCode || "";
      const accessToken = overrides?.accessToken || metaAccessToken || "";
      const whatsappAccountId =
        overrides?.whatsappAccountId ||
        metaEmbeddedIdentifiersRef.current.wabaId ||
        metaWhatsappAccountId ||
        "";
      const phoneNumberId =
        overrides?.phoneNumberId ||
        metaEmbeddedIdentifiersRef.current.phoneNumberId ||
        metaPhoneNumberId ||
        "";
      const businessId =
        overrides?.businessId ||
        metaEmbeddedIdentifiersRef.current.businessId ||
        metaBusinessId ||
        "";
      const embeddedSignupEvent =
        overrides?.embeddedSignupEvent ||
        metaEmbeddedIdentifiersRef.current.embeddedSignupEvent ||
        undefined;
      const isWaLoginUser =
        overrides?.isWaLoginUser ??
        metaEmbeddedIdentifiersRef.current.isWaLoginUser ??
        undefined;

      if (!signupCode && !accessToken) {
        addToast({
          type: "warning",
          title: "Retorno da Meta incompleto",
          description:
            "A Meta nao retornou code/access token para persistir a vinculacao no backend.",
        });
        return false;
      }

      try {
        setIsSavingIntegration(true);

        const result = await MetaService.saveIntegration({
          empresaId: user.empresa_id,
          accessToken: accessToken || undefined,
          signupCode: signupCode || undefined,
          redirectUri: metaRedirectUri || undefined,
          webhookUrl: metaWebhookUrl || undefined,
          whatsappAccountId: whatsappAccountId || undefined,
          wabaId: whatsappAccountId || undefined,
          phoneNumberId: phoneNumberId || undefined,
          displayPhoneNumber: metaDisplayPhoneNumber || undefined,
          verifiedName: metaVerifiedName || undefined,
          businessId: businessId || undefined,
          embeddedSignupEvent,
          isWaLoginUser,
        });

        applyIntegrationSnapshot(result, buildIntegrationStatusLabel(result));
        const refreshedAccounts = await refreshLinkedMetaAccounts();
        applyLinkedAccountSnapshot(getPrimaryLinkedMetaAccount(refreshedAccounts));
        setMetaSignupCode("");
        setMetaAccessToken("");

        if (Array.isArray(result.campos_faltantes) && result.campos_faltantes.length) {
          addToast({
            type: "warning",
            title: "Vinculo salvo com pendencias",
            description: `Backend ainda reporta campos pendentes: ${result.campos_faltantes.join(", ")}.`,
          });
        } else {
          addToast({
            type: "success",
            title: "Conta vinculada",
            description: "A conta da Meta foi vinculada e salva no backend.",
          });
        }

        return true;
      } catch (error) {
        console.error("[MetaSettings] erro ao salvar integracao:", error);
        addToast({
          type: "error",
          title: "Erro ao salvar integracao",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel persistir a vinculacao da Meta no backend.",
        });
        return false;
      } finally {
        setIsSavingIntegration(false);
      }
    },
    [
      addToast,
      applyLinkedAccountSnapshot,
      applyIntegrationSnapshot,
      buildIntegrationStatusLabel,
      getPrimaryLinkedMetaAccount,
      metaAccessToken,
      metaBusinessId,
      metaDisplayPhoneNumber,
      metaPhoneNumberId,
      metaRedirectUri,
      metaSignupCode,
      metaVerifiedName,
      metaWebhookUrl,
      metaWhatsappAccountId,
      refreshLinkedMetaAccounts,
      user?.empresa_id,
    ],
  );

  const fetchIntegrationStatus = useCallback(async () => {
    if (!user?.empresa_id) {
      setIntegrationStatus("Usuario sem empresa vinculada.");
      setIsIntegrationActive(false);
      setHasFetchedStatusOnce(true);
      return;
    }

    try {
      setIsLoadingStatus(true);
      const result = await MetaService.getIntegrationStatus(user.empresa_id);
      applyIntegrationSnapshot(result.data, result.statusText);
      const refreshedAccounts = await refreshLinkedMetaAccounts();
      applyLinkedAccountSnapshot(getPrimaryLinkedMetaAccount(refreshedAccounts));
    } catch (error) {
      console.error(
        "[MetaSignup] erro ao consultar status da integra��o:",
        error,
      );
      setIntegrationData(null);
      setLinkedMetaAccounts([]);
      setIntegrationStatus("Erro ao consultar status.");
      setIsIntegrationActive(false);
    } finally {
      setIsLoadingStatus(false);
      setHasFetchedStatusOnce(true);
    }
  }, [
    applyIntegrationSnapshot,
    applyLinkedAccountSnapshot,
    getPrimaryLinkedMetaAccount,
    refreshLinkedMetaAccounts,
    user?.empresa_id,
  ]);

  const fetchAutoMessages = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setIsLoadingAutoMessages(true);
      const messages = await MetaService.listAutoMessages(
        user.empresa_id,
        selectedMetaScope,
      );
      console.log("[ApiMetaSettings] auto messages fetched", {
        empresaId: user.empresa_id,
        selectedMetaScope,
        messages,
      });
      setAutoMessageDrafts(mapAutoMessagesToDrafts(messages));
    } catch (error) {
      console.error(
        "[MetaSettings] erro ao listar mensagens automaticas:",
        error,
      );
      addToast({
        type: "error",
        title: "Erro ao carregar mensagens",
        description:
          error instanceof Error
            ? error.message
            : "Erro ao carregar mensagens automaticas.",
      });
    } finally {
      setIsLoadingAutoMessages(false);
      setHasFetchedAutoMessagesOnce(true);
    }
  }, [addToast, selectedMetaScope, user?.empresa_id]);

  const fetchAutoMessageGalleryImages = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setIsLoadingAutoMessageGalleryImages(true);
      const images = await MetaService.listReusableGalleryImages(user.empresa_id);
      setAutoMessageGalleryImages(images);
    } catch (error) {
      console.error("[MetaSettings] erro ao listar imagens da galeria:", error);
      addToast({
        type: "error",
        title: "Erro ao carregar galeria",
        description:
          error instanceof Error
            ? error.message
            : "Erro ao carregar as imagens da galeria da empresa.",
      });
      setAutoMessageGalleryImages([]);
    } finally {
      setIsLoadingAutoMessageGalleryImages(false);
    }
  }, [addToast, user?.empresa_id]);

  const handleUploadAutoMessageGalleryImage = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] || null;
      if (!file || !user?.empresa_id) {
        if (event.target) event.target.value = "";
        return;
      }

      try {
        setIsUploadingAutoMessageGalleryImage(true);
        const uploadedImage = await MetaService.uploadReusableGalleryImage(
          user.empresa_id,
          file,
        );
        await fetchAutoMessageGalleryImages();
        setAutoMessageDrafts((prev) => ({
          ...prev,
          1: {
            ...prev[1],
            galeriaImagemId: Number(uploadedImage.id),
            galeriaImagemUrl: uploadedImage.url || null,
            galeriaImagemNomeArquivo: uploadedImage.nome_arquivo || null,
          },
        }));
        addToast({
          type: "success",
          title: "Imagem enviada",
          description:
            "A imagem foi adicionada a galeria da empresa e vinculada a mensagem de boas-vindas.",
        });
      } catch (error) {
        console.error("[MetaSettings] erro ao enviar imagem da galeria:", error);
        addToast({
          type: "error",
          title: "Erro ao enviar imagem",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel enviar a imagem para a galeria da empresa.",
        });
      } finally {
        setIsUploadingAutoMessageGalleryImage(false);
        if (event.target) event.target.value = "";
      }
    },
    [addToast, fetchAutoMessageGalleryImages, user?.empresa_id],
  );

  const fetchTemplates = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setIsLoadingTemplates(true);
      const templateList = await MetaService.getTemplates(
        user.empresa_id,
        selectedMetaScope,
      );
      setTemplates(templateList);
    } catch (error) {
      console.error("[MetaSettings] erro ao listar templates:", error);
      addToast({
        type: "error",
        title: "Erro ao carregar templates",
        description:
          error instanceof Error ? error.message : "Erro ao carregar templates.",
      });
    } finally {
      setIsLoadingTemplates(false);
      setHasFetchedTemplatesOnce(true);
    }
  }, [addToast, selectedMetaScope, user?.empresa_id]);

  const fetchWhatsAppProfile = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setIsLoadingWhatsAppProfile(true);
      setWhatsAppProfileError("");
      const profile = await MetaService.getWhatsAppProfile(
        user.empresa_id,
        selectedMetaScope,
      );
      applyWhatsAppProfileSnapshot(profile);
    } catch (error) {
      console.error("[MetaSettings] erro ao carregar perfil do WhatsApp:", error);
      const description =
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar o perfil do WhatsApp.";
      setWhatsAppProfileError(description);
      addToast({
        type: "error",
        title: "Erro ao carregar perfil",
        description,
      });
    } finally {
      setIsLoadingWhatsAppProfile(false);
    }
  }, [
    addToast,
    applyWhatsAppProfileSnapshot,
    selectedMetaScope,
    user?.empresa_id,
  ]);

  const handleWhatsAppProfileFieldChange = useCallback(
    (field: keyof WhatsAppProfileDraft, value: string) => {
      setWhatsAppProfileDraft((current) => ({
        ...current,
        [field]: value,
      }));
    },
    [],
  );

  const handleSaveWhatsAppProfile = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setIsSavingWhatsAppProfile(true);
      setWhatsAppProfileError("");
      const updatedProfile = await MetaService.updateWhatsAppProfile(
        user.empresa_id,
        {
          ...selectedMetaScope,
          about: whatsAppProfileDraft.about,
          address: whatsAppProfileDraft.address,
          description: whatsAppProfileDraft.description,
          email: whatsAppProfileDraft.email,
          websites: whatsAppProfileDraft.websites,
          profilePictureFile: whatsAppProfilePictureFile,
        },
      );

      applyWhatsAppProfileSnapshot(updatedProfile);
      addToast({
        type: "success",
        title: "Perfil atualizado",
        description:
          "As informacoes do perfil comercial do WhatsApp foram salvas.",
      });
    } catch (error) {
      console.error("[MetaSettings] erro ao salvar perfil do WhatsApp:", error);
      const description =
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar o perfil do WhatsApp.";
      setWhatsAppProfileError(description);
      addToast({
        type: "error",
        title: "Erro ao salvar perfil",
        description,
      });
    } finally {
      setIsSavingWhatsAppProfile(false);
    }
  }, [
    addToast,
    applyWhatsAppProfileSnapshot,
    selectedMetaScope,
    user?.empresa_id,
    whatsAppProfileDraft.about,
    whatsAppProfileDraft.address,
    whatsAppProfileDraft.description,
    whatsAppProfileDraft.email,
    whatsAppProfileDraft.websites,
    whatsAppProfilePictureFile,
  ]);

  useEffect(() => {
    void fetchIntegrationStatus();
  }, [fetchIntegrationStatus]);

  useEffect(() => {
    if (!isManagementModule) return;

    if (!isIntegrationActive) {
      setTemplates([]);
      setAutoMessageDrafts(buildDefaultDrafts());
      setAutoMessageGalleryImages([]);
      applyBirthdayTemplateConfigSnapshot(null);
      applySaleCompletedTemplateConfigSnapshot(null);
      applySaleRefusedTemplateConfigSnapshot(null);
      applyWhatsAppProfileSnapshot(null);
      setEditingType(null);
      setActiveMetaViewTab("templates");
      setIsEmojiMenuOpen(false);
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
      setSelectedTemplateName("");
      setIsMetricsModalOpen(false);
      setTemplateMetricsById({});
      setTemplateMetricsError("");
      return;
    }

    void fetchTemplates();
    void fetchAutoMessages();
    void fetchAutoMessageGalleryImages();
  }, [
    applyBirthdayTemplateConfigSnapshot,
    applySaleCompletedTemplateConfigSnapshot,
    applySaleRefusedTemplateConfigSnapshot,
    applyWhatsAppProfileSnapshot,
    fetchAutoMessageGalleryImages,
    fetchAutoMessages,
    fetchTemplates,
    isIntegrationActive,
    isManagementModule,
  ]);

  useEffect(() => {
    if (!isManagementModule || !isIntegrationActive) return;

    setTemplates([]);
    setAutoMessageDrafts(buildDefaultDrafts());
    applyBirthdayTemplateConfigSnapshot(null);
    applySaleCompletedTemplateConfigSnapshot(null);
    applySaleRefusedTemplateConfigSnapshot(null);
    applyWhatsAppProfileSnapshot(null);
    setEditingType(null);
    setTemplateMetricsById({});
    setTemplateMetricsError("");
    setSelectedTemplateId(null);
    setSelectedTemplate(null);
    setSelectedTemplateName("");
    setIsMetricsModalOpen(false);
  }, [
    applyBirthdayTemplateConfigSnapshot,
    applySaleCompletedTemplateConfigSnapshot,
    applySaleRefusedTemplateConfigSnapshot,
    applyWhatsAppProfileSnapshot,
    isIntegrationActive,
    isManagementModule,
    selectedMetaParamId,
  ]);

  useEffect(() => {
    if (!isManagementModule || !isIntegrationActive) return;
    if (activeMetaViewTab !== "automation_schedule") return;

    void loadBirthdayTemplateConfig();
    void loadSaleCompletedTemplateConfig();
    void loadSaleRefusedTemplateConfig();
  }, [
    activeMetaViewTab,
    isIntegrationActive,
    isManagementModule,
    loadBirthdayTemplateConfig,
    loadSaleCompletedTemplateConfig,
    loadSaleRefusedTemplateConfig,
    selectedMetaParamId,
  ]);

  useEffect(() => {
    if (!isManagementModule || !isIntegrationActive) return;
    if (activeMetaViewTab !== "whatsapp_profile") return;

    void fetchWhatsAppProfile();
  }, [
    activeMetaViewTab,
    fetchWhatsAppProfile,
    isIntegrationActive,
    isManagementModule,
    selectedMetaParamId,
  ]);

  const isInitialManagementLoading =
    isManagementModule &&
    (!hasFetchedStatusOnce ||
      (isIntegrationActive &&
        (!hasFetchedTemplatesOnce || !hasFetchedAutoMessagesOnce)));

  useEffect(() => {
    onInitialLoadChange?.(isInitialManagementLoading);
  }, [isInitialManagementLoading, onInitialLoadChange]);

  useEffect(() => {
    if (!isDispatchingTemplateBatch) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDispatchingTemplateBatch]);

  useEffect(() => {
    if (!isEmojiMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!emojiMenuRef.current) return;
      if (!emojiMenuRef.current.contains(event.target as Node)) {
        setIsEmojiMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEmojiMenuOpen]);

  useEffect(() => {
    if (templateMediaSampleType === "NONE") return;
    setTemplateHeader("");
  }, [templateMediaSampleType]);

  useEffect(() => {
    if (
      !templateMediaSampleFile ||
      templateMediaSampleType !== "IMAGE"
    ) {
      setTemplateMediaSamplePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(templateMediaSampleFile);
    setTemplateMediaSamplePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [templateMediaSampleFile, templateMediaSampleType]);

  useEffect(() => {
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: metaAppId,
        cookie: true,
        xfbml: true,
        version: metaApiVersion,
      });

      setIsMetaSdkReady(true);
    };

    const existingScript = document.getElementById("facebook-jssdk");
    if (existingScript) {
      if (window.FB) {
        window.fbAsyncInit?.();
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  const waitForMetaSdk = useCallback(async (timeoutMs = 5000) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (window.FB) {
        setIsMetaSdkReady(true);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    return Boolean(window.FB);
  }, []);

  const handleMetaLogin = useCallback(() => {
    console.log("[Meta Login] Iniciando fluxo", {
      empresaId: user?.empresa_id ?? null,
      isMetaSdkReady,
      hasFacebookSdk: Boolean(window.FB),
    });

    if (!user?.empresa_id) {
      console.log("[Meta Login] Fluxo cancelado: empresa_id ausente");
      return;
    }

    void (async () => {
      const sdkAvailable = window.FB || isMetaSdkReady || (await waitForMetaSdk());

      if (!sdkAvailable || !window.FB) {
        addToast({
          type: "warning",
          title: "SDK indisponivel",
          description:
            "A SDK da Meta ainda nao foi carregada. Aguarde alguns segundos e tente novamente.",
        });
        return;
      }

      setIsConnecting(true);
      metaEmbeddedIdentifiersRef.current = {};
      setMetaWhatsappAccountId("");
      setMetaPhoneNumberId("");
      setMetaDisplayPhoneNumber("");
      setMetaVerifiedName("");
      setMetaBusinessId("");
      setMetaBusinessName("");
      setMetaBusinessManagerId("");
      setMetaBusinessManagerName("");
      setMetaWhatsappAccountName("");

      window.FB.login((response) => {
        const authCode = response?.authResponse?.code || "";
        const authAccessToken = response?.authResponse?.accessToken || "";

        if (authCode) {
          setMetaSignupCode(authCode);
        }
        if (authAccessToken) {
          setMetaAccessToken(authAccessToken);
        }

        setIsConnecting(false);

        if (!authCode && !authAccessToken) {
          addToast({
            type: "warning",
            title: "Fluxo finalizado",
            description:
              "A Meta nao retornou code/access token. Nao foi possivel salvar a vinculacao no backend.",
          });
          return;
        }

        addToast({
          type: "success",
          title: "Autenticacao concluida",
          description: "A Meta retornou os dados da vinculacao. Salvando no backend...",
        });

        void (async () => {
          const embeddedIdentifiers = await waitForMetaEmbeddedIdentifiers();
          await handleSaveMetaIntegration({
            signupCode: authCode || undefined,
            accessToken: authAccessToken || undefined,
            whatsappAccountId: embeddedIdentifiers.wabaId,
            phoneNumberId: embeddedIdentifiers.phoneNumberId,
            businessId: embeddedIdentifiers.businessId,
            embeddedSignupEvent: embeddedIdentifiers.embeddedSignupEvent,
            isWaLoginUser: embeddedIdentifiers.isWaLoginUser,
          });
        })();
      }, metaEmbeddedSignupOptions);
    })();
  }, [
    addToast,
    handleSaveMetaIntegration,
    isMetaSdkReady,
    metaEmbeddedSignupOptions,
    user?.empresa_id,
    waitForMetaEmbeddedIdentifiers,
    waitForMetaSdk,
  ]);

  const handleUnlinkMetaNumber = useCallback(
    async (account: MetaIntegrationAccount) => {
      const accountId = Number(account.id || 0);
      if (!user?.empresa_id || !Number.isInteger(accountId) || accountId <= 0) {
        return;
      }

      const label =
        account.display_phone_number ||
        account.phone_number_id ||
        "este numero";

      if (
        !window.confirm(
          `Deseja remover ${label}? O registro sera mantido, mas marcado como inativo.`
        )
      ) {
        return;
      }

      try {
        setUnlinkingMetaParamId(accountId);
        const result = await MetaService.unlinkIntegrationNumber(
          user.empresa_id,
          accountId
        );
        setIntegrationData(result);
        setIntegrationStatus(
          result.pronto_para_uso
            ? "Integracao ativa"
            : "Integracao atualizada"
        );
        setIsIntegrationActive(Boolean(result.pronto_para_uso || result.conectado));
        addToast({
          type: "success",
          title: "Numero removido",
          description: `${label} foi marcado como inativo com sucesso.`,
        });
        await fetchIntegrationStatus();
      } catch (error) {
        console.error("[MetaSettings] erro ao desvincular numero:", error);
        addToast({
          type: "error",
          title: "Erro ao desvincular numero",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel desvincular este numero.",
        });
      } finally {
        setUnlinkingMetaParamId(null);
      }
    },
    [addToast, fetchIntegrationStatus, user?.empresa_id]
  );

  const handleUpdateMetaNumberColor = useCallback(
    async (account: MetaIntegrationAccount) => {
      const accountId = Number(account.id || 0);
      if (!user?.empresa_id || !Number.isInteger(accountId) || accountId <= 0) {
        return;
      }

      const normalizedColor = normalizeMetaAccountColor(
        metaNumberColorDrafts[String(accountId)]
      );
      const label =
        account.display_phone_number ||
        account.phone_number_id ||
        "este numero";

      try {
        setUpdatingMetaColorParamId(accountId);
        const result = await MetaService.updateIntegrationNumberColor(
          user.empresa_id,
          accountId,
          normalizedColor
        );
        setIntegrationData(result);
        setIntegrationStatus(
          result.pronto_para_uso ? "Integracao ativa" : "Integracao atualizada"
        );
        setIsIntegrationActive(Boolean(result.pronto_para_uso || result.conectado));
        await refreshLinkedMetaAccounts();
        addToast({
          type: "success",
          title: "Cor atualizada",
          description: `A cor do numero ${label} foi salva.`,
        });
      } catch (error) {
        console.error("[MetaSettings] erro ao atualizar cor do numero:", error);
        addToast({
          type: "error",
          title: "Erro ao salvar cor",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel salvar a cor deste numero.",
        });
      } finally {
        setUpdatingMetaColorParamId(null);
      }
    },
    [
      addToast,
      metaNumberColorDrafts,
      normalizeMetaAccountColor,
      refreshLinkedMetaAccounts,
      user?.empresa_id,
    ]
  );

  const renderLinkedMetaAccountsSection = useCallback(() => {
    return (
      <div
        className="meta-readonly-field"
        style={{ gridColumn: "1 / -1" }}
      >
        <span>Numeros vinculados</span>
        {linkedMetaAccounts.length > 0 ? (
          <div className="meta-linked-accounts-list">
            {linkedMetaAccounts.map((account, index) => {
              const accountId = Number(account.id || 0);
              const isActive = account.ativo !== false;
              const isSelected =
                String(account.id || "") === selectedMetaParamId;
              const primaryLabel = getMetaAccountPrimaryLabel(account, index);
              const secondaryLabel = getMetaAccountSecondaryLabel(account);
              const technicalLabel = getMetaAccountTechnicalLabel(account);
              const currentDraftColor = normalizeMetaAccountColor(
                metaNumberColorDrafts[String(account.id || "")] || account.color
              );
              const hasUnsavedColorChange =
                currentDraftColor !== normalizeMetaAccountColor(account.color);

              return (
                <div
                  key={`${account.id || account.phone_number_id || primaryLabel}-${index}`}
                  className={`meta-linked-account-card${
                    isActive ? "" : " meta-linked-account-card--inactive"
                  }${
                    isSelected ? " meta-linked-account-card--selected" : ""
                  }`}
                >
                  <div className="meta-linked-account-copy">
                    <strong className="meta-linked-account-title">
                      <span
                        className="meta-linked-account-color-preview"
                        style={{
                          backgroundColor: currentDraftColor,
                        }}
                        aria-hidden="true"
                      />
                      <span>{primaryLabel}</span>
                    </strong>
                    <span>{secondaryLabel}</span>
                    <small>ID tecnico: {technicalLabel}</small>
                  </div>

                  <div className="meta-template-actions">
                    <span className="meta-linked-account-badge">
                      {isActive ? "Ativo" : "Inativo"}
                    </span>
                    {isActive && accountId > 0 ? (
                      <button
                        type="button"
                        className={`meta-secondary-button ${
                          isSelected
                            ? "meta-linked-account-select-button meta-linked-account-select-button--active"
                            : "meta-linked-account-select-button"
                        }`}
                        onClick={() =>
                          setSelectedMetaParamId(String(accountId))
                        }
                      >
                        {isSelected ? "Usando nesta gestao" : "Usar nesta gestao"}
                      </button>
                    ) : null}
                    {accountId > 0 ? (
                      <label className="meta-linked-account-color-field">
                        <span>Cor</span>
                        <input
                          type="color"
                          value={currentDraftColor}
                          disabled={updatingMetaColorParamId === accountId}
                          onChange={(event) =>
                            setMetaNumberColorDrafts((current) => ({
                              ...current,
                              [String(accountId)]: normalizeMetaAccountColor(
                                event.target.value
                              ),
                            }))
                          }
                        />
                      </label>
                    ) : null}
                    {accountId > 0 ? (
                      <button
                        type="button"
                        className="meta-secondary-button meta-linked-account-save-button"
                        onClick={() =>
                          void handleUpdateMetaNumberColor(account)
                        }
                        disabled={
                          !isActive ||
                          !hasUnsavedColorChange ||
                          updatingMetaColorParamId === accountId
                        }
                      >
                        {updatingMetaColorParamId === accountId
                          ? "Salvando..."
                          : "Salvar"}
                      </button>
                    ) : null}
                    {accountId > 0 ? (
                      <button
                        type="button"
                        className="meta-secondary-button"
                        onClick={() =>
                          void handleUnlinkMetaNumber(account)
                        }
                        disabled={
                          !isActive || unlinkingMetaParamId === accountId
                        }
                      >
                        {!isActive
                          ? "Removido"
                          : unlinkingMetaParamId === accountId
                            ? "Removendo..."
                            : "Remover"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <strong>Nenhum numero vinculado encontrado.</strong>
        )}
      </div>
    );
  }, [
    handleUnlinkMetaNumber,
    handleUpdateMetaNumberColor,
    linkedMetaAccounts,
    metaNumberColorDrafts,
    normalizeMetaAccountColor,
    selectedMetaParamId,
    unlinkingMetaParamId,
    updatingMetaColorParamId,
  ]);

  const handleChangeAutoMessage = (
    tipoId: AutoMessageTypeId,
    value: string,
  ) => {
    setAutoMessageDrafts((prev) => ({
      ...prev,
      [tipoId]: {
        ...prev[tipoId],
        texto: value,
      },
    }));
  };

  const handleChangeAutoMessageComplementaryText = (
    tipoId: AutoMessageTypeId,
    value: string,
  ) => {
    setAutoMessageDrafts((prev) => ({
      ...prev,
      [tipoId]: {
        ...prev[tipoId],
        mensagemComplementarTexto: value,
      },
    }));
  };

  const handleSelectAutoMessageImage = (
    tipoId: AutoMessageTypeId,
    value: string,
  ) => {
    const nextImageId = Number(value);
    const selectedImage =
      Number.isInteger(nextImageId) && nextImageId > 0
        ? autoMessageGalleryImages.find((image) => Number(image.id) === nextImageId) ||
          null
        : null;

    setAutoMessageDrafts((prev) => ({
      ...prev,
      [tipoId]: {
        ...prev[tipoId],
        galeriaImagemId: selectedImage ? Number(selectedImage.id) : null,
        galeriaImagemUrl: selectedImage?.url || null,
        galeriaImagemNomeArquivo: selectedImage?.nome_arquivo || null,
      },
    }));
  };

  const handleCreateTemplate = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!user?.empresa_id) return;
    setHasSubmittedTemplate(true);

    if (!templateName.trim() || !templateBody.trim()) {
      addToast({
        type: "warning",
        title: "Campos obrigatorios",
        description: "Informe nome e texto do corpo (BODY).",
      });
      return;
    }

    if (missingSampleVariables.length > 0) {
      addToast({
        type: "warning",
        title: "Amostras obrigatorias",
        description:
          "Preencha todas as amostras das variaveis para validar o template.",
      });
      return;
    }

    if (templateMediaSampleType !== "NONE" && !templateMediaSampleFile) {
      addToast({
        type: "warning",
        title: "Amostra de midia obrigatoria",
        description:
          "Quando header do template usa midia, envie arquivo de amostra para aprovacao da Meta.",
      });
      return;
    }

    try {
      const components: TemplateComponent[] = [];
      const headerVariableSamples = templateHeaderVariables.map(
        (variableId) => templateVariableSamples[variableId].trim(),
      );
      const bodyVariableSamples = templateBodyVariables.map(
        (variableId) => templateVariableSamples[variableId].trim(),
      );

      if (templateMediaSampleType !== "NONE") {
        components.push({
          type: "HEADER",
          format: templateMediaSampleType,
        });
      } else if (templateHeader.trim()) {
        const headerComponent: TemplateComponent = {
          type: "HEADER",
          format: "TEXT",
          text: templateHeader.trim(),
        };
        if (templateHeaderVariables.length > 0) {
          headerComponent.example = { header_text: headerVariableSamples };
        }
        components.push(headerComponent);
      }

      const bodyComponent: TemplateComponent = {
        type: "BODY",
        text: templateBody.trim(),
      };
      if (templateBodyVariables.length > 0) {
        bodyComponent.example = { body_text: [bodyVariableSamples] };
      }
      components.push(bodyComponent);

      if (templateFooter.trim()) {
        components.push({
          type: "FOOTER",
          text: templateFooter.trim(),
        });
      }

      const builtButtons = buildTemplateButtons(templateButtons, true);
      if (builtButtons.error) {
        addToast({
          type: "warning",
          title: "Bot�es inv�lidos",
          description: builtButtons.error,
        });
        return;
      }

      if (builtButtons.buttons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: builtButtons.buttons,
        });
      }

      setIsSubmittingTemplate(true);
      const templatePayload = {
        name: templateName.trim(),
        category: templateCategory,
        language: templateLanguage.trim(),
        allow_category_change: templateAllowCategoryChange,
        parameter_format: "POSITIONAL",
        media_sample_type: templateMediaSampleType,
        media_sample_file: templateMediaSampleFile,
        components,
        ...selectedMetaScope,
      };
      if (editingTemplateId) {
        await MetaService.updateTemplate(
          user.empresa_id,
          editingTemplateId,
          templatePayload,
        );
      } else {
        await MetaService.createTemplate(user.empresa_id, templatePayload);
      }

      setTemplateName("");
      setTemplateHeader("");
      setTemplateBody("");
      setTemplateFooter("");
      setTemplateMediaSampleType("NONE");
      setTemplateMediaSampleFile(null);
      setTemplateButtons([buildTemplateButtonDraft()]);
      setTemplateVariableSamples({});
      setHasSubmittedTemplate(false);
      addToast({
        type: "success",
        title: editingTemplateId ? "Template atualizado" : "Template criado",
        description: editingTemplateId
          ? "As alteracoes foram enviadas para revisao da Meta."
          : "Template criado com sucesso.",
      });
      setEditingTemplateId(null);
      setIsCreateTemplateModalOpen(false);
      await fetchTemplates();
    } catch (error) {
      console.error("[MetaSettings] erro ao salvar template:", error);
      addToast({
        type: "error",
        title: editingTemplateId ? "Erro ao editar template" : "Erro ao criar template",
        description:
          error instanceof Error ? error.message : "Erro ao salvar template.",
      });
    } finally {
      setIsSubmittingTemplate(false);
    }
  };

  const handleTemplateVariableSampleChange = (
    variableId: string,
    value: string,
  ) => {
    setTemplateVariableSamples((prev) => ({
      ...prev,
      [variableId]: value,
    }));
  };

  const handleTemplateButtonChange = (
    buttonId: string,
    field: keyof Omit<TemplateButtonDraft, "id">,
    value: string,
  ) => {
    setTemplateButtons((prev) =>
      prev.map((button) =>
        button.id === buttonId ? { ...button, [field]: value } : button,
      ),
    );
  };

  const handleAddTemplateButton = () => {
    if (templateButtons.length >= TEMPLATE_MAX_BUTTONS) {
      addToast({
        type: "warning",
        title: "Limite de bot�es",
        description: `A Meta permite no m�ximo ${TEMPLATE_MAX_BUTTONS} bot�es por template.`,
      });
      return;
    }
    setTemplateButtons((prev) => [...prev, buildTemplateButtonDraft()]);
  };

  const handleRemoveTemplateButton = (buttonId: string) => {
    setTemplateButtons((prev) => {
      const next = prev.filter((button) => button.id !== buttonId);
      return next.length > 0 ? next : [buildTemplateButtonDraft()];
    });
  };

  const handleInsertBodyTemplateToken = (
    tokenStart: string,
    tokenEnd = tokenStart,
  ) => {
    const textarea = templateBodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? templateBody.length;
    const end = textarea.selectionEnd ?? templateBody.length;
    const applied = applyStyleToken(templateBody, start, end, tokenStart, tokenEnd);

    setTemplateBody(applied.value);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(applied.nextStart, applied.nextEnd);
    });
  };

  const handleInsertVariable = () => {
    const nextVariableNumber =
      templateVariables.length > 0
        ? Math.max(...templateVariables.map((value) => Number(value))) + 1
        : 1;
    handleInsertBodyTemplateToken(`{{${nextVariableNumber}}}`, "");
  };

  const handleInsertTemplateEmoji = (emoji: string) => {
    handleInsertBodyTemplateToken(emoji, "");
    setIsEmojiMenuOpen(false);
  };

  const handleSaveAutoMessage = async (tipoId: AutoMessageTypeId) => {
    if (!user?.empresa_id) return;
    const draft = autoMessageDrafts[tipoId];
    const selectedScopedMetaParamId = Number(selectedMetaScope.metaParamId || 0);
    const isScopedDraft =
      selectedScopedMetaParamId > 0
        ? Number(draft.empresaMetaParamId || 0) === selectedScopedMetaParamId
        : draft.empresaMetaParamId === null;

    if (!draft.texto.trim()) {
      addToast({
        type: "warning",
        title: "Texto obrigatorio",
        description: "O texto da mensagem nao pode ficar vazio.",
      });
      return;
    }

    try {
      setSavingType(tipoId);

      let savedMessage: WhatsAutoMessage;
      if (draft.id && isScopedDraft) {
        savedMessage = await MetaService.editAutoMessage({
          empresaId: user.empresa_id,
          tipoId,
          id: draft.id,
          texto: draft.texto.trim(),
          mensagemComplementarTexto: draft.mensagemComplementarTexto.trim(),
          galeriaImagemId: draft.galeriaImagemId,
          metaParamId: selectedMetaScope.metaParamId,
        });
      } else {
        savedMessage = await MetaService.createAutoMessage({
          empresaId: user.empresa_id,
          tipoId,
          texto: draft.texto.trim(),
          mensagemComplementarTexto: draft.mensagemComplementarTexto.trim(),
          galeriaImagemId: draft.galeriaImagemId,
          metaParamId: selectedMetaScope.metaParamId,
        });
      }

      setAutoMessageDrafts((prev) =>
        applySavedMessageToDrafts(prev, savedMessage, tipoId),
      );
      setEditingType(null);
      addToast({
        type: "success",
        title: "Mensagem salva",
        description: "Mensagem automatica salva com sucesso.",
      });
    } catch (error) {
      console.error(
        "[MetaSettings] erro ao salvar mensagem automatica:",
        error,
      );
      addToast({
        type: "error",
        title: "Erro ao salvar mensagem",
        description:
          error instanceof Error
            ? error.message
            : "Erro ao salvar mensagem automatica.",
      });
    } finally {
      setSavingType(null);
    }
  };

  const handleDeleteAutoMessage = async (tipoId: AutoMessageTypeId) => {
    if (!user?.empresa_id) return;
    const draft = autoMessageDrafts[tipoId];
    const selectedScopedMetaParamId = Number(selectedMetaScope.metaParamId || 0);
    const isScopedDraft =
      selectedScopedMetaParamId > 0
        ? Number(draft.empresaMetaParamId || 0) === selectedScopedMetaParamId
        : draft.empresaMetaParamId === null;

    if (!draft.id) {
      setAutoMessageDrafts((prev) => ({
        ...prev,
        [tipoId]: {
          ...prev[tipoId],
          texto: "",
          mensagemComplementarTexto: "",
          galeriaImagemId: null,
          galeriaImagemUrl: null,
          galeriaImagemNomeArquivo: null,
          empresaMetaParamId: null,
          ativo: false,
          habilitada: prev[tipoId].habilitada,
        },
      }));
      return;
    }

    if (!isScopedDraft) {
      addToast({
        type: "warning",
        title: "Mensagem herdada do cadastro antigo",
        description:
          "Esse texto ainda esta no escopo antigo da empresa. Para este numero, salve uma mensagem propria antes de remover.",
      });
      return;
    }

    try {
      setDeletingType(tipoId);
      await MetaService.deleteAutoMessage({
        empresaId: user.empresa_id,
        tipoId,
        id: draft.id,
        metaParamId: selectedMetaScope.metaParamId,
      });

      setAutoMessageDrafts((prev) => ({
        ...prev,
        [tipoId]: {
          id: null,
          texto: "",
          mensagemComplementarTexto: "",
          galeriaImagemId: null,
          galeriaImagemUrl: null,
          galeriaImagemNomeArquivo: null,
          empresaMetaParamId: null,
          ativo: false,
          habilitada: prev[tipoId].habilitada,
        },
      }));
      setEditingType(null);
      addToast({
        type: "success",
        title: "Mensagem removida",
        description: "Mensagem automatica removida.",
      });
    } catch (error) {
      console.error(
        "[MetaSettings] erro ao remover mensagem automatica:",
        error,
      );
      addToast({
        type: "error",
        title: "Erro ao remover mensagem",
        description:
          error instanceof Error
            ? error.message
            : "Erro ao remover mensagem automatica.",
      });
    } finally {
      setDeletingType(null);
    }
  };

  const handleToggleAutoMessage = async (
    tipoId: AutoMessageTypeId,
    habilitada: boolean,
  ) => {
    if (!user?.empresa_id) return;

    try {
      setTogglingType(tipoId);
      const updated = await MetaService.updateAutoMessageToggle({
        empresaId: user.empresa_id,
        tipoId,
        habilitada,
        metaParamId: selectedMetaScope.metaParamId,
      });

      setAutoMessageDrafts((prev) => ({
        ...prev,
        [tipoId]: {
          ...prev[tipoId],
          habilitada:
            typeof updated.habilitada === "boolean"
              ? updated.habilitada
              : habilitada,
        },
      }));

      addToast({
        type: "success",
        title: habilitada ? "Mensagem automatica ativada" : "Mensagem automatica desativada",
        description: habilitada
          ? "O envio automatico voltou a ficar habilitado para este numero."
          : "O texto foi mantido salvo, mas o envio automatico foi desligado para este numero.",
      });
    } catch (error) {
      console.error(
        "[MetaSettings] erro ao alterar toggle da mensagem automatica:",
        error,
      );
      addToast({
        type: "error",
        title: "Erro ao alterar toggle",
        description:
          error instanceof Error
            ? error.message
            : "Erro ao alterar o toggle da mensagem automatica.",
      });
    } finally {
      setTogglingType(null);
    }
  };

  const fetchTemplateMetrics = async (params: {
    templateId: string;
    startDate?: string;
    endDate?: string;
  }) => {
    if (!user?.empresa_id) return;
    const { templateId, startDate, endDate } = params;
    try {
      setIsLoadingTemplateMetrics(true);
      const metrics = await MetaService.getTemplateMetrics(user.empresa_id, {
        templateId,
        granularity: "DAILY",
        startDate: startDate ? toApiDateRange(startDate, false) : undefined,
        endDate: endDate ? toApiDateRange(endDate, true) : undefined,
        ...selectedMetaScope,
      });
      setTemplateMetricsById((prev) => ({
        ...prev,
        [templateId]: metrics,
      }));
      setMetricsStartDate(formatUnixToDateInput(metrics?.filters?.start));
      setMetricsEndDate(formatUnixToDateInput(metrics?.filters?.end));
      setTemplateMetricsError("");
    } catch (error) {
      console.error("[MetaSettings] erro ao carregar metricas do template:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Erro ao carregar metricas do template.";
      setTemplateMetricsError(message);
      addToast({
        type: "error",
        title: "Erro ao carregar metricas",
        description: message,
      });
    } finally {
      setIsLoadingTemplateMetrics(false);
    }
  };

  const handleOpenTemplateMetrics = async (template: MetaTemplateItem) => {
    if (!user?.empresa_id) return;

    const templateId = String(template.id || "").trim();
    if (!templateId) {
      addToast({
        type: "warning",
        title: "Template sem ID",
        description: "Nao foi possivel consultar metricas deste template.",
      });
      return;
    }

    setSelectedTemplateName(String(template.name || "Template"));
    setSelectedTemplate(template);
    setTemplateMetricsError("");
    setTemplateOperationError("");
    setIsMetricsModalOpen(true);
    setSelectedTemplateId(templateId);
    setTemplateOperationLanguage(String(template.language || "pt_BR"));
    setTemplateDispatchCustomerSearch("");
    setTemplateDispatchCustomerSuggestions([]);
    setSelectedTemplateDispatchCustomer(null);
    const dispatchHints = getDispatchHintSummary(template);
    setTemplateHeaderParameterValues(
      createTemplateParameterInputs(dispatchHints.headerParameterCount),
    );
    setTemplateBodyParameterValues(
      createTemplateParameterInputs(dispatchHints.bodyParameterCount),
    );
    setTemplateButtonParameterValues(
      dispatchHints.buttons.reduce<Record<number, TemplateParameterInput[]>>((acc, button) => {
        acc[button.index] = createTemplateParameterInputs(button.parameterCount);
        return acc;
      }, {}),
    );
    setTemplateHeaderFile(null);
    setTemplateDispatchResult(null);
    setTemplateOperationTab("preview");
    setTemplateBatchStopOnError(false);
    setTemplateBatchLeadStartedMessagesGenerateAutoMessage(true);
    setTemplateDispatchMode("single");
    setTemplateBatchResult(null);
    setSelectedBroadcastListContactCount(null);

    const cached = templateMetricsById[templateId];
    if (cached) {
      setMetricsStartDate(formatUnixToDateInput(cached?.filters?.start));
      setMetricsEndDate(formatUnixToDateInput(cached?.filters?.end));
      return;
    }

    await fetchTemplateMetrics({ templateId });
  };

  const handleApplyMetricsPeriod = async () => {
    if (!selectedTemplateId) return;
    if (!metricsStartDate || !metricsEndDate) {
      addToast({
        type: "warning",
        title: "Per�odo incompleto",
        description: "Preencha data inicial e data final.",
      });
      return;
    }
    if (metricsStartDate > metricsEndDate) {
      addToast({
        type: "warning",
        title: "Per�odo inv�lido",
        description: "A data inicial n�o pode ser maior que a final.",
      });
      return;
    }
    const today = getTodayDateInput();
    if (metricsStartDate > today || metricsEndDate > today) {
      addToast({
        type: "warning",
        title: "Data futura n�o permitida",
        description: "Selecione um per�odo at� a data de hoje.",
      });
      return;
    }

    try {
      setIsApplyingMetricsPeriod(true);
      await fetchTemplateMetrics({
        templateId: selectedTemplateId,
        startDate: metricsStartDate,
        endDate: metricsEndDate,
      });
    } finally {
      setIsApplyingMetricsPeriod(false);
    }
  };

  const handleCloseTemplateMetricsModal = useCallback(() => {
    if (isDispatchingTemplateBatch) {
      addToast({
        type: "warning",
        title: "Disparo em andamento",
        description:
          "O modal permanece aberto ate o disparo em lote terminar, para voce acompanhar o relatorio.",
      });
      return;
    }

    setIsMetricsModalOpen(false);
    setIsTemplateDetailsModalOpen(false);
    setTemplateMetricsError("");
    setTemplateOperationError("");
    setSelectedTemplate(null);
    setTemplateHeaderFile(null);
  }, [addToast, isDispatchingTemplateBatch]);

  const handleOpenTemplateDetailsModal = useCallback(() => {
    setIsTemplateDetailsModalOpen(true);
  }, []);

  const handleCloseTemplateDetailsModal = useCallback(() => {
    setIsTemplateDetailsModalOpen(false);
  }, []);

  const handleCloseCreateTemplateModal = () => {
    setIsCreateTemplateModalOpen(false);
    setEditingTemplateId(null);
    setIsEmojiMenuOpen(false);
    setTemplateMediaSampleFile(null);
  };

  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateCategory("UTILITY");
    setTemplateLanguage("pt_BR");
    setTemplateAllowCategoryChange(true);
    setTemplateMediaSampleType("NONE");
    setTemplateMediaSampleFile(null);
    setTemplateHeader("");
    setTemplateBody("");
    setTemplateFooter("");
    setTemplateButtons([buildTemplateButtonDraft()]);
    setTemplateVariableSamples({});
    setHasSubmittedTemplate(false);
  };

  const handleOpenCreateTemplateModal = () => {
    resetTemplateForm();
    setIsCreateTemplateModalOpen(true);
  };

  const handleOpenEditTemplateModal = (template: MetaTemplateItem) => {
    const templateId = String(template.id || "").trim();
    if (!templateId) {
      addToast({
        type: "error",
        title: "Template sem identificador",
        description: "A Meta nao retornou o ID necessario para editar este template.",
      });
      return;
    }

    const texts = extractTemplateTexts(template);
    const components = Array.isArray(template.components) ? template.components : [];
    const headerComponent = components.find(
      (component) => String(component?.type || "").toUpperCase() === "HEADER",
    );
    const bodyComponent = components.find(
      (component) => String(component?.type || "").toUpperCase() === "BODY",
    );
    const buttonComponent = components.find(
      (component) => String(component?.type || "").toUpperCase() === "BUTTONS",
    );
    const headerFormat = String(headerComponent?.format || "TEXT").toUpperCase();
    const mediaSampleType: TemplateMediaSampleType =
      headerFormat === "IMAGE" || headerFormat === "VIDEO" || headerFormat === "DOCUMENT"
        ? headerFormat
        : "NONE";
    const sourceButtons = Array.isArray(buttonComponent?.buttons)
      ? buttonComponent.buttons
      : [];
    const buttonDrafts = sourceButtons.map((button) => {
      const source = button as Record<string, unknown>;
      const { type, text, url, phone_number, example, ...extra } = source;
      return {
        ...buildTemplateButtonDraft(),
        type: String(type || "QUICK_REPLY").toUpperCase() as TemplateButtonDraft["type"],
        text: String(text || ""),
        url: String(url || ""),
        phone_number: String(phone_number || ""),
        example:
          example === undefined
            ? ""
            : typeof example === "string"
              ? example
              : JSON.stringify(example),
        extraParamsJson: Object.keys(extra).length ? JSON.stringify(extra, null, 2) : "",
      };
    });
    const samples: Record<string, string> = {};
    const headerVariables = extractTemplateVariables(texts.header || "");
    const bodyVariables = extractTemplateVariables(texts.body || "");
    const headerExamples = Array.isArray((headerComponent?.example as any)?.header_text)
      ? (headerComponent?.example as any).header_text
      : [];
    const bodyExampleGroups = Array.isArray((bodyComponent?.example as any)?.body_text)
      ? (bodyComponent?.example as any).body_text
      : [];
    const bodyExamples = Array.isArray(bodyExampleGroups[0]) ? bodyExampleGroups[0] : [];
    headerVariables.forEach((variable, index) => {
      samples[variable] = String(headerExamples[index] || "");
    });
    bodyVariables.forEach((variable, index) => {
      if (!samples[variable]) samples[variable] = String(bodyExamples[index] || "");
    });

    setEditingTemplateId(templateId);
    setTemplateName(String(template.name || ""));
    setTemplateCategory(String(template.category || "UTILITY").toUpperCase());
    setTemplateLanguage(String(template.language || "pt_BR"));
    setTemplateAllowCategoryChange(true);
    setTemplateMediaSampleType(mediaSampleType);
    setTemplateMediaSampleFile(null);
    setTemplateHeader(mediaSampleType === "NONE" ? texts.header || "" : "");
    setTemplateBody(texts.body || "");
    setTemplateFooter(texts.footer || "");
    setTemplateButtons(buttonDrafts.length ? buttonDrafts : [buildTemplateButtonDraft()]);
    setTemplateVariableSamples(samples);
    setHasSubmittedTemplate(false);
    setIsCreateTemplateModalOpen(true);
  };

  const handleArchiveTemplate = async (template: MetaTemplateItem) => {
    const templateName = String(template.name || "").trim();
    const templateId = String(template.id || "").trim();
    if (!templateName || !templateId || !user?.empresa_id) {
      addToast({
        type: "error",
        title: "Template invalido",
        description: "A Meta nao retornou os dados necessarios para arquivar este template.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Arquivar o template "${templateName}"? Ele deixara de aparecer e de ser selecionado no sistema, mas continuara existindo na Meta.`,
    );
    if (!confirmed) return;

    try {
      setArchivingTemplateId(templateId);
      await MetaService.archiveTemplate(user.empresa_id, template, selectedMetaScope);
      setTemplates((current) =>
        current.filter((item) => String(item.id || "") !== templateId),
      );
      addToast({
        type: "success",
        title: "Template arquivado",
        description: `O template ${templateName} foi ocultado no sistema e preservado na Meta.`,
      });
    } catch (error) {
      console.error("[MetaSettings] erro ao arquivar template:", error);
      addToast({
        type: "error",
        title: "Erro ao arquivar template",
        description:
          error instanceof Error ? error.message : "Nao foi possivel arquivar o template.",
      });
    } finally {
      setArchivingTemplateId(null);
    }
  };

  const handleLoadDispatchCosts = useCallback(async (options?: {
    startDate?: string;
    endDate?: string;
    silent?: boolean;
  }) => {
    if (!user?.empresa_id) return;

    const effectiveStartDate = options?.startDate ?? dispatchCostStartDate;
    const effectiveEndDate = options?.endDate ?? dispatchCostEndDate;
    const silent = Boolean(options?.silent);

    if (
      effectiveStartDate &&
      effectiveEndDate &&
      effectiveStartDate > effectiveEndDate
    ) {
      setDispatchCostError("A data inicial nao pode ser maior que a data final.");
      return;
    }

    try {
      setIsLoadingDispatchCostMetrics(true);
      setDispatchCostError("");
      const result = await MetaService.getDispatchCostMetrics({
        empresaId: user.empresa_id,
        granularity: "DAILY",
        startDate: effectiveStartDate
          ? toApiDateRange(effectiveStartDate, false)
          : undefined,
        endDate: effectiveEndDate
          ? toApiDateRange(effectiveEndDate, true)
          : undefined,
        ...selectedMetaScope,
      });
      setDispatchCostMetrics(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel consultar o custo dos disparos.";
      setDispatchCostError(message);
      if (!silent) {
        addToast({
          type: "error",
          title: "Erro ao consultar custos",
          description: message,
        });
      }
    } finally {
      setIsLoadingDispatchCostMetrics(false);
    }
  }, [
    addToast,
    dispatchCostEndDate,
    dispatchCostStartDate,
    selectedMetaScope,
    user?.empresa_id,
  ]);

  const handleHeaderParameterChange = useCallback(
    (index: number, patch: Partial<TemplateParameterInput>) => {
      setTemplateHeaderParameterValues((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleBodyParameterChange = useCallback((index: number, patch: Partial<TemplateParameterInput>) => {
    setTemplateBodyParameterValues((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  }, []);

  const handleButtonParameterChange = useCallback(
    (buttonIndex: number, parameterIndex: number, patch: Partial<TemplateParameterInput>) => {
      setTemplateButtonParameterValues((current) => ({
        ...current,
        [buttonIndex]: (current[buttonIndex] || []).map((item, itemIndex) =>
          itemIndex === parameterIndex
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      }));
    },
    [],
  );

  const handleBirthdayHeaderParameterChange = useCallback(
    (index: number, patch: Partial<TemplateParameterInput>) => {
      setBirthdayHeaderParameterValues((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleBirthdayBodyParameterChange = useCallback(
    (index: number, patch: Partial<TemplateParameterInput>) => {
      setBirthdayBodyParameterValues((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleBirthdayButtonParameterChange = useCallback(
    (
      buttonIndex: number,
      parameterIndex: number,
      patch: Partial<TemplateParameterInput>,
    ) => {
      setBirthdayButtonParameterValues((current) => ({
        ...current,
        [buttonIndex]: (current[buttonIndex] || []).map((item, itemIndex) =>
          itemIndex === parameterIndex
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      }));
    },
    [],
  );

  const buildBirthdayTemplateConfigPayload = useCallback(() => {
    const selectedBirthdayTemplateItem =
      templates.find(
        (template) =>
          String(template.name || "").trim() === birthdayTemplateName.trim(),
      ) || null;
    const birthdayTemplateHints = selectedBirthdayTemplateItem
      ? getDispatchHintSummary(selectedBirthdayTemplateItem)
      : null;
    const normalizedBirthdayHeaderMediaType =
      birthdayTemplateHints?.headerRequiresMedia
        ? String(birthdayTemplateHints.headerType || "").trim().toLowerCase()
        : "";
    const buttonParameters = Object.entries(birthdayButtonParameterValues)
      .map(([index, parameters]) => ({
        index: Number(index) - 1,
        parameters: parameters
          .map(mapTemplateParameterInputToPayload)
          .filter((item) => item !== null),
      }))
      .filter((item) => item.parameters.length > 0);

    return {
      templateName: birthdayTemplateName.trim() || null,
      language: birthdayTemplateLanguage.trim() || "pt_BR",
      horario: birthdayTemplateSchedule.trim() || "09:00",
      isDefaultDispatchNumber: birthdayIsDefaultDispatchNumber,
      headerMediaType:
        birthdayTemplateHints?.headerRequiresMedia &&
        ["image", "document", "video"].includes(normalizedBirthdayHeaderMediaType)
          ? normalizedBirthdayHeaderMediaType
          : null,
      headerMediaUrl:
        birthdayTemplateHints?.headerRequiresMedia
          ? birthdayTemplateHeaderMediaUrl.trim() || null
          : null,
      headerParameters: birthdayHeaderParameterValues
        .map(mapTemplateParameterInputToPayload)
        .filter((item) => item !== null),
      bodyParameters: birthdayBodyParameterValues
        .map(mapTemplateParameterInputToPayload)
        .filter((item) => item !== null),
      buttonParameters,
      headerFile: birthdayTemplateHeaderFile,
    };
  }, [
    birthdayBodyParameterValues,
    birthdayButtonParameterValues,
    birthdayHeaderParameterValues,
    birthdayIsDefaultDispatchNumber,
    birthdayTemplateHeaderFile,
    birthdayTemplateHeaderMediaUrl,
    birthdayTemplateLanguage,
    birthdayTemplateName,
    birthdayTemplateSchedule,
    templates,
  ]);

  const handleSaleCompletedHeaderParameterChange = useCallback(
    (index: number, patch: Partial<TemplateParameterInput>) => {
      setSaleCompletedHeaderParameterValues((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleSaleCompletedBodyParameterChange = useCallback(
    (index: number, patch: Partial<TemplateParameterInput>) => {
      setSaleCompletedBodyParameterValues((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleSaleCompletedButtonParameterChange = useCallback(
    (
      buttonIndex: number,
      parameterIndex: number,
      patch: Partial<TemplateParameterInput>,
    ) => {
      setSaleCompletedButtonParameterValues((current) => ({
        ...current,
        [buttonIndex]: (current[buttonIndex] || []).map((item, itemIndex) =>
          itemIndex === parameterIndex
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      }));
    },
    [],
  );

  const buildSaleCompletedTemplateConfigPayload = useCallback(() => {
    const selectedTemplateItem =
      templates.find(
        (template) =>
          String(template.name || "").trim() === saleCompletedTemplateName.trim(),
      ) || null;
    const templateHints = selectedTemplateItem
      ? getDispatchHintSummary(selectedTemplateItem)
      : null;
    const normalizedHeaderMediaType = templateHints?.headerRequiresMedia
      ? String(templateHints.headerType || "").trim().toLowerCase()
      : "";
    const buttonParameters = Object.entries(saleCompletedButtonParameterValues)
      .map(([index, parameters]) => ({
        index: Number(index) - 1,
        parameters: parameters
          .map(mapTemplateParameterInputToPayload)
          .filter((item) => item !== null),
      }))
      .filter((item) => item.parameters.length > 0);

    return {
      templateName: saleCompletedTemplateName.trim() || null,
      language: saleCompletedTemplateLanguage.trim() || "pt_BR",
      horario: saleCompletedTemplateSchedule.trim() || "09:00",
      delayDays: Math.max(0, Number(saleCompletedDelayDays || 0) || 0),
      isDefaultDispatchNumber: saleCompletedIsDefaultDispatchNumber,
      headerMediaType:
        templateHints?.headerRequiresMedia &&
        ["image", "document", "video"].includes(normalizedHeaderMediaType)
          ? normalizedHeaderMediaType
          : null,
      headerMediaUrl: templateHints?.headerRequiresMedia
        ? saleCompletedTemplateHeaderMediaUrl.trim() || null
        : null,
      headerParameters: saleCompletedHeaderParameterValues
        .map(mapTemplateParameterInputToPayload)
        .filter((item) => item !== null),
      bodyParameters: saleCompletedBodyParameterValues
        .map(mapTemplateParameterInputToPayload)
        .filter((item) => item !== null),
      buttonParameters,
      headerFile: saleCompletedTemplateHeaderFile,
    };
  }, [
    saleCompletedBodyParameterValues,
    saleCompletedButtonParameterValues,
    saleCompletedDelayDays,
    saleCompletedHeaderParameterValues,
    saleCompletedIsDefaultDispatchNumber,
    saleCompletedTemplateHeaderFile,
    saleCompletedTemplateHeaderMediaUrl,
    saleCompletedTemplateLanguage,
    saleCompletedTemplateName,
    saleCompletedTemplateSchedule,
    templates,
  ]);

  const handleSaleRefusedHeaderParameterChange = useCallback(
    (index: number, patch: Partial<TemplateParameterInput>) => {
      setSaleRefusedHeaderParameterValues((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleSaleRefusedBodyParameterChange = useCallback(
    (index: number, patch: Partial<TemplateParameterInput>) => {
      setSaleRefusedBodyParameterValues((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleSaleRefusedButtonParameterChange = useCallback(
    (
      buttonIndex: number,
      parameterIndex: number,
      patch: Partial<TemplateParameterInput>,
    ) => {
      setSaleRefusedButtonParameterValues((current) => ({
        ...current,
        [buttonIndex]: (current[buttonIndex] || []).map((item, itemIndex) =>
          itemIndex === parameterIndex
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      }));
    },
    [],
  );

  const buildSaleRefusedTemplateConfigPayload = useCallback(() => {
    const selectedTemplateItem =
      templates.find(
        (template) =>
          String(template.name || "").trim() === saleRefusedTemplateName.trim(),
      ) || null;
    const templateHints = selectedTemplateItem
      ? getDispatchHintSummary(selectedTemplateItem)
      : null;
    const normalizedHeaderMediaType = templateHints?.headerRequiresMedia
      ? String(templateHints.headerType || "").trim().toLowerCase()
      : "";
    const buttonParameters = Object.entries(saleRefusedButtonParameterValues)
      .map(([index, parameters]) => ({
        index: Number(index) - 1,
        parameters: parameters
          .map(mapTemplateParameterInputToPayload)
          .filter((item) => item !== null),
      }))
      .filter((item) => item.parameters.length > 0);

    return {
      templateName: saleRefusedTemplateName.trim() || null,
      language: saleRefusedTemplateLanguage.trim() || "pt_BR",
      horario: saleRefusedTemplateSchedule.trim() || "09:00",
      delayDays: Math.max(0, Number(saleRefusedDelayDays || 0) || 0),
      isDefaultDispatchNumber: saleRefusedIsDefaultDispatchNumber,
      headerMediaType:
        templateHints?.headerRequiresMedia &&
        ["image", "document", "video"].includes(normalizedHeaderMediaType)
          ? normalizedHeaderMediaType
          : null,
      headerMediaUrl: templateHints?.headerRequiresMedia
        ? saleRefusedTemplateHeaderMediaUrl.trim() || null
        : null,
      headerParameters: saleRefusedHeaderParameterValues
        .map(mapTemplateParameterInputToPayload)
        .filter((item) => item !== null),
      bodyParameters: saleRefusedBodyParameterValues
        .map(mapTemplateParameterInputToPayload)
        .filter((item) => item !== null),
      buttonParameters,
      headerFile: saleRefusedTemplateHeaderFile,
    };
  }, [
    saleRefusedBodyParameterValues,
    saleRefusedButtonParameterValues,
    saleRefusedDelayDays,
    saleRefusedHeaderParameterValues,
    saleRefusedIsDefaultDispatchNumber,
    saleRefusedTemplateHeaderFile,
    saleRefusedTemplateHeaderMediaUrl,
    saleRefusedTemplateLanguage,
    saleRefusedTemplateName,
    saleRefusedTemplateSchedule,
    templates,
  ]);

  const handleSaveBirthdayTemplateConfig = useCallback(async () => {
    if (!user?.empresa_id) return;

    const selectedMetaParamId = Number(selectedMetaScope.metaParamId || 0);
    if (!Number.isInteger(selectedMetaParamId) || selectedMetaParamId <= 0) {
      addToast({
        type: "warning",
        title: "Numero obrigatorio",
        description:
          "Selecione um numero da Meta para configurar a automacao de aniversario.",
      });
      return;
    }

    const payload = buildBirthdayTemplateConfigPayload();
    if (!payload.templateName) {
      addToast({
        type: "warning",
        title: "Template obrigatorio",
        description:
          "Selecione um template de WhatsApp para salvar a automacao de aniversario.",
      });
      return;
    }

    if (
      !payload.isDefaultDispatchNumber &&
      (
        !birthdayTemplateConfig?.default_dispatch_meta_param_id ||
        Number(birthdayTemplateConfig.default_dispatch_meta_param_id) ===
          selectedMetaParamId
      )
    ) {
      addToast({
        type: "warning",
        title: "Numero padrao obrigatorio",
        description:
          "Selecione um numero padrao para aniversariantes sem ultima conversa antes de salvar a automacao.",
      });
      return;
    }

    try {
      setIsSavingBirthdayTemplateConfig(true);
      const savedConfig = await MetaService.saveBirthdayTemplateConfig({
        empresaId: user.empresa_id,
        metaParamId: selectedMetaScope.metaParamId,
        templateName: payload.templateName,
        language: payload.language,
        horario: payload.horario,
        isDefaultDispatchNumber: payload.isDefaultDispatchNumber,
        headerMediaType: payload.headerMediaType,
        headerMediaUrl: payload.headerMediaUrl,
        headerParameters: payload.headerParameters,
        bodyParameters: payload.bodyParameters,
        buttonParameters: payload.buttonParameters,
        headerFile: payload.headerFile,
      });
      if (payload.headerFile) {
        await fetchTemplates();
      }
      applyBirthdayTemplateConfigSnapshot(savedConfig);
      addToast({
        type: "success",
        title: "Automacao salva",
        description:
          "A configuracao de aniversario foi salva para o numero Meta selecionado.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao salvar aniversario",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar a automacao de aniversario.",
      });
    } finally {
      setIsSavingBirthdayTemplateConfig(false);
    }
  }, [
    addToast,
    applyBirthdayTemplateConfigSnapshot,
    birthdayTemplateConfig?.default_dispatch_meta_param_id,
    buildBirthdayTemplateConfigPayload,
    fetchTemplates,
    selectedMetaScope.metaParamId,
    selectedMetaScope,
    user?.empresa_id,
  ]);

  const handleClearBirthdayTemplateConfig = useCallback(async () => {
    if (!user?.empresa_id) return;

    const selectedMetaParamId = Number(selectedMetaScope.metaParamId || 0);
    if (!Number.isInteger(selectedMetaParamId) || selectedMetaParamId <= 0) {
      return;
    }

    if (birthdayTemplateConfig?.is_default_dispatch_number) {
      addToast({
        type: "warning",
        title: "Numero padrao em uso",
        description:
          "Defina outro numero como padrao para aniversariantes sem ultima conversa antes de limpar esta configuracao.",
      });
      return;
    }

    try {
      setIsSavingBirthdayTemplateConfig(true);
      const clearedConfig = await MetaService.saveBirthdayTemplateConfig({
        empresaId: user.empresa_id,
        metaParamId: selectedMetaScope.metaParamId,
        templateName: null,
        language: "pt_BR",
        horario: birthdayTemplateSchedule.trim() || "09:00",
        isDefaultDispatchNumber: false,
        headerMediaType: null,
        headerMediaUrl: null,
        headerParameters: [],
        bodyParameters: [],
        buttonParameters: [],
        headerFile: null,
      });
      applyBirthdayTemplateConfigSnapshot(clearedConfig);
      addToast({
        type: "success",
        title: "Configuracao removida",
        description:
          "A automacao de aniversario foi limpa para o numero Meta selecionado.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao limpar aniversario",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel limpar a configuracao de aniversario.",
      });
    } finally {
      setIsSavingBirthdayTemplateConfig(false);
    }
  }, [
    addToast,
    applyBirthdayTemplateConfigSnapshot,
    birthdayTemplateConfig?.is_default_dispatch_number,
    birthdayTemplateSchedule,
    selectedMetaScope,
    user?.empresa_id,
  ]);

  const handleSaveSaleCompletedTemplateConfig = useCallback(async () => {
    if (!user?.empresa_id) return;

    const selectedMetaParamId = Number(selectedMetaScope.metaParamId || 0);
    if (!Number.isInteger(selectedMetaParamId) || selectedMetaParamId <= 0) {
      addToast({
        type: "warning",
        title: "Numero obrigatorio",
        description:
          "Selecione um numero da Meta para configurar o follow-up de venda realizada.",
      });
      return;
    }

    const payload = buildSaleCompletedTemplateConfigPayload();
    if (!payload.templateName) {
      addToast({
        type: "warning",
        title: "Template obrigatorio",
        description:
          "Selecione um template de WhatsApp para salvar o follow-up de venda realizada.",
      });
      return;
    }

    if (
      !payload.isDefaultDispatchNumber &&
      (
        !saleCompletedTemplateConfig?.default_dispatch_meta_param_id ||
        Number(saleCompletedTemplateConfig.default_dispatch_meta_param_id) ===
          selectedMetaParamId
      )
    ) {
      addToast({
        type: "warning",
        title: "Numero padrao obrigatorio",
        description:
          "Selecione um numero padrao para clientes sem ultima conversa antes de salvar o follow-up de venda realizada.",
      });
      return;
    }

    try {
      setIsSavingSaleCompletedTemplateConfig(true);
      const savedConfig = await MetaService.saveTemplateAutomationConfig({
        empresaId: user.empresa_id,
        automationType: "sale_completed",
        metaParamId: selectedMetaScope.metaParamId,
        templateName: payload.templateName,
        language: payload.language,
        horario: payload.horario,
        delayDays: payload.delayDays,
        isDefaultDispatchNumber: payload.isDefaultDispatchNumber,
        headerMediaType: payload.headerMediaType,
        headerMediaUrl: payload.headerMediaUrl,
        headerParameters: payload.headerParameters,
        bodyParameters: payload.bodyParameters,
        buttonParameters: payload.buttonParameters,
        headerFile: payload.headerFile,
      });
      if (payload.headerFile) {
        await fetchTemplates();
      }
      applySaleCompletedTemplateConfigSnapshot(savedConfig);
      addToast({
        type: "success",
        title: "Automacao salva",
        description:
          "A configuracao de follow-up de venda realizada foi salva para o numero Meta selecionado.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao salvar follow-up de venda realizada",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar a automacao de follow-up de venda realizada.",
      });
    } finally {
      setIsSavingSaleCompletedTemplateConfig(false);
    }
  }, [
    addToast,
    applySaleCompletedTemplateConfigSnapshot,
    buildSaleCompletedTemplateConfigPayload,
    fetchTemplates,
    saleCompletedTemplateConfig?.default_dispatch_meta_param_id,
    selectedMetaScope.metaParamId,
    user?.empresa_id,
  ]);

  const handleClearSaleCompletedTemplateConfig = useCallback(async () => {
    if (!user?.empresa_id) return;

    const selectedMetaParamId = Number(selectedMetaScope.metaParamId || 0);
    if (!Number.isInteger(selectedMetaParamId) || selectedMetaParamId <= 0) {
      return;
    }

    if (saleCompletedTemplateConfig?.is_default_dispatch_number) {
      addToast({
        type: "warning",
        title: "Numero padrao em uso",
        description:
          "Defina outro numero como padrao antes de limpar o follow-up de venda realizada deste numero.",
      });
      return;
    }

    try {
      setIsSavingSaleCompletedTemplateConfig(true);
      const clearedConfig = await MetaService.saveTemplateAutomationConfig({
        empresaId: user.empresa_id,
        automationType: "sale_completed",
        metaParamId: selectedMetaScope.metaParamId,
        templateName: null,
        language: "pt_BR",
        horario: saleCompletedTemplateSchedule.trim() || "09:00",
        delayDays: Math.max(0, Number(saleCompletedDelayDays || 0) || 0),
        isDefaultDispatchNumber: false,
        headerMediaType: null,
        headerMediaUrl: null,
        headerParameters: [],
        bodyParameters: [],
        buttonParameters: [],
        headerFile: null,
      });
      applySaleCompletedTemplateConfigSnapshot(clearedConfig);
      addToast({
        type: "success",
        title: "Configuracao removida",
        description:
          "A automacao de follow-up de venda realizada foi limpa para o numero Meta selecionado.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao limpar follow-up de venda realizada",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel limpar a configuracao do follow-up de venda realizada.",
      });
    } finally {
      setIsSavingSaleCompletedTemplateConfig(false);
    }
  }, [
    addToast,
    applySaleCompletedTemplateConfigSnapshot,
    saleCompletedDelayDays,
    saleCompletedTemplateConfig?.is_default_dispatch_number,
    saleCompletedTemplateSchedule,
    selectedMetaScope.metaParamId,
    user?.empresa_id,
  ]);

  const handleSaveSaleRefusedTemplateConfig = useCallback(async () => {
    if (!user?.empresa_id) return;

    const selectedMetaParamId = Number(selectedMetaScope.metaParamId || 0);
    if (!Number.isInteger(selectedMetaParamId) || selectedMetaParamId <= 0) {
      addToast({
        type: "warning",
        title: "Numero obrigatorio",
        description:
          "Selecione um numero da Meta para configurar o follow-up de venda recusada.",
      });
      return;
    }

    const payload = buildSaleRefusedTemplateConfigPayload();
    if (!payload.templateName) {
      addToast({
        type: "warning",
        title: "Template obrigatorio",
        description:
          "Selecione um template de WhatsApp para salvar o follow-up de venda recusada.",
      });
      return;
    }

    if (
      !payload.isDefaultDispatchNumber &&
      (
        !saleRefusedTemplateConfig?.default_dispatch_meta_param_id ||
        Number(saleRefusedTemplateConfig.default_dispatch_meta_param_id) ===
          selectedMetaParamId
      )
    ) {
      addToast({
        type: "warning",
        title: "Numero padrao obrigatorio",
        description:
          "Selecione um numero padrao para clientes sem ultima conversa antes de salvar o follow-up de venda recusada.",
      });
      return;
    }

    try {
      setIsSavingSaleRefusedTemplateConfig(true);
      const savedConfig = await MetaService.saveTemplateAutomationConfig({
        empresaId: user.empresa_id,
        automationType: "sale_refused",
        metaParamId: selectedMetaScope.metaParamId,
        templateName: payload.templateName,
        language: payload.language,
        horario: payload.horario,
        delayDays: payload.delayDays,
        isDefaultDispatchNumber: payload.isDefaultDispatchNumber,
        headerMediaType: payload.headerMediaType,
        headerMediaUrl: payload.headerMediaUrl,
        headerParameters: payload.headerParameters,
        bodyParameters: payload.bodyParameters,
        buttonParameters: payload.buttonParameters,
        headerFile: payload.headerFile,
      });
      if (payload.headerFile) {
        await fetchTemplates();
      }
      applySaleRefusedTemplateConfigSnapshot(savedConfig);
      addToast({
        type: "success",
        title: "Automacao salva",
        description:
          "A configuracao de follow-up de venda recusada foi salva para o numero Meta selecionado.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao salvar follow-up de venda recusada",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar a automacao de follow-up de venda recusada.",
      });
    } finally {
      setIsSavingSaleRefusedTemplateConfig(false);
    }
  }, [
    addToast,
    applySaleRefusedTemplateConfigSnapshot,
    buildSaleRefusedTemplateConfigPayload,
    fetchTemplates,
    saleRefusedTemplateConfig?.default_dispatch_meta_param_id,
    selectedMetaScope.metaParamId,
    user?.empresa_id,
  ]);

  const handleClearSaleRefusedTemplateConfig = useCallback(async () => {
    if (!user?.empresa_id) return;

    const selectedMetaParamId = Number(selectedMetaScope.metaParamId || 0);
    if (!Number.isInteger(selectedMetaParamId) || selectedMetaParamId <= 0) {
      return;
    }

    if (saleRefusedTemplateConfig?.is_default_dispatch_number) {
      addToast({
        type: "warning",
        title: "Numero padrao em uso",
        description:
          "Defina outro numero como padrao antes de limpar o follow-up de venda recusada deste numero.",
      });
      return;
    }

    try {
      setIsSavingSaleRefusedTemplateConfig(true);
      const clearedConfig = await MetaService.saveTemplateAutomationConfig({
        empresaId: user.empresa_id,
        automationType: "sale_refused",
        metaParamId: selectedMetaScope.metaParamId,
        templateName: null,
        language: "pt_BR",
        horario: saleRefusedTemplateSchedule.trim() || "09:00",
        delayDays: Math.max(0, Number(saleRefusedDelayDays || 0) || 0),
        isDefaultDispatchNumber: false,
        headerMediaType: null,
        headerMediaUrl: null,
        headerParameters: [],
        bodyParameters: [],
        buttonParameters: [],
        headerFile: null,
      });
      applySaleRefusedTemplateConfigSnapshot(clearedConfig);
      addToast({
        type: "success",
        title: "Configuracao removida",
        description:
          "A automacao de follow-up de venda recusada foi limpa para o numero Meta selecionado.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao limpar follow-up de venda recusada",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel limpar a configuracao do follow-up de venda recusada.",
      });
    } finally {
      setIsSavingSaleRefusedTemplateConfig(false);
    }
  }, [
    addToast,
    applySaleRefusedTemplateConfigSnapshot,
    saleRefusedDelayDays,
    saleRefusedTemplateConfig?.is_default_dispatch_number,
    saleRefusedTemplateSchedule,
    selectedMetaScope.metaParamId,
    user?.empresa_id,
  ]);

  const buildTemplateOperationPayload = useCallback(() => {
    if (!selectedTemplate) {
      throw new Error("Selecione um template antes de operar.");
    }

    const buttonParameters = Object.entries(templateButtonParameterValues)
      .map(([index, parameters]) => ({
        index: Number(index) - 1,
        parameters: parameters
          .map(mapTemplateParameterInputToPayload)
          .filter((item) => item !== null),
      }))
      .filter((item) => item.parameters.length > 0);
    const dispatchHints = selectedTemplate
      ? getDispatchHintSummary(selectedTemplate)
      : null;
    const savedHeaderImageUrl = getTemplateSavedHeaderImageUrl(selectedTemplate);
    const normalizedHeaderMediaType =
      dispatchHints?.headerRequiresMedia
        ? String(dispatchHints.headerType || "")
            .trim()
            .toLowerCase() || null
        : null;
    const resolvedHeaderMediaUrl =
      !templateHeaderFile && normalizedHeaderMediaType
        ? String(templateHeaderPreviewUrl || savedHeaderImageUrl || "").trim() || null
        : null;

    return {
      templateName: String(selectedTemplate.name || "").trim(),
      language: templateOperationLanguage.trim() || "pt_BR",
      headerMediaType: normalizedHeaderMediaType,
      headerMediaUrl: resolvedHeaderMediaUrl,
      headerParameters: templateHeaderParameterValues
        .map(mapTemplateParameterInputToPayload)
        .filter((item) => item !== null),
      bodyParameters: templateBodyParameterValues
        .map(mapTemplateParameterInputToPayload)
        .filter((item) => item !== null),
      buttonParameters,
      headerFile: templateHeaderFile,
    };
  }, [
    selectedTemplate,
    templateBodyParameterValues,
    templateButtonParameterValues,
    templateHeaderFile,
    templateHeaderParameterValues,
    templateOperationLanguage,
    templateHeaderPreviewUrl,
  ]);

  const handleDispatchTemplate = useCallback(async () => {
    if (!user?.empresa_id) return;

    const selectedCustomerPhone = String(
      selectedTemplateDispatchCustomer?.telefone || "",
    ).trim();

    if (!selectedTemplateDispatchCustomer) {
      addToast({
        type: "warning",
        title: "Cliente obrigatorio",
        description: "Selecione um cliente cadastrado para disparar o template.",
      });
      return;
    }

    if (!selectedCustomerPhone) {
      addToast({
        type: "warning",
        title: "Cliente sem telefone",
        description: "O cliente selecionado nao possui telefone cadastrado.",
      });
      return;
    }

    try {
      setIsDispatchingTemplate(true);
      setTemplateOperationError("");
      const result = await MetaService.dispatchTemplate({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        ...buildTemplateOperationPayload(),
        numero: selectedCustomerPhone,
        clienteId: Number(selectedTemplateDispatchCustomer.id || 0) || undefined,
        contactName: String(selectedTemplateDispatchCustomer.nome || "").trim() || undefined,
        email: String(selectedTemplateDispatchCustomer.email || "").trim() || undefined,
        birthday: selectedTemplateDispatchCustomer.data_aniversario || undefined,
        ...selectedMetaScope,
      });
      setTemplateDispatchResult(result as Record<string, unknown>);
      const messageStatus = String(
        (result as Record<string, unknown>)?.message_status || "",
      ).toLowerCase();
      const isQueued = messageStatus === "accepted" || messageStatus === "queued";
      addToast({
        type: isQueued ? "warning" : "success",
        title: isQueued ? "Template enfileirado" : "Template disparado",
        description: isQueued
          ? "A Meta aceitou o envio, mas a entrega final depende do status recebido no webhook."
          : "Disparo concluido.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel disparar o template.";
      setTemplateOperationError(message);
      addToast({
        type: "error",
        title: "Erro ao disparar template",
        description: message,
      });
    } finally {
      setIsDispatchingTemplate(false);
    }
  }, [
    addToast,
    buildTemplateOperationPayload,
    selectedMetaScope,
    selectedTemplateDispatchCustomer,
    user?.empresa_id,
  ]);

  const handleDispatchTemplateBatch = useCallback(async () => {
    if (!user?.empresa_id || !user?.id) return;
    if (!selectedBroadcastListId) {
      setTemplateOperationError("Selecione uma lista de transmiss�o para o disparo em lote.");
      addToast({
        type: "warning",
        title: "Lista obrigatoria",
        description: "Selecione uma lista de transmiss�o antes de continuar.",
      });
      return;
    }

    const listaId = Number(selectedBroadcastListId);
    if (!Number.isFinite(listaId) || listaId <= 0) {
      setTemplateOperationError("Lista de transmiss�o invalida.");
      return;
    }

    const totalContacts = Math.max(
      Number(selectedBroadcastList?.total_contatos || selectedBroadcastListContactCount || 0),
      0,
    );
    setSelectedBroadcastListContactCount(totalContacts);

    if (!totalContacts) {
      addToast({
        type: "warning",
        title: "Lista sem contatos",
        description: "A lista selecionada nao possui contatos com telefone.",
      });
      return;
    }

    try {
      const clientBatchToken = buildClientBatchToken();
      setIsDispatchingTemplateBatch(true);
      setTemplateOperationTab("dispatch");
      setTemplateDispatchMode("batch");
      setTemplateOperationError("");
      setTemplateBatchResult(null);
      setCurrentTemplateBatchToken(clientBatchToken);
      setTemplateBatchProgress({
        found: false,
        template_name: selectedTemplateName || null,
        total_items: totalContacts,
        processed_items: 0,
        success_count: 0,
        error_count: 0,
        remaining_items: totalContacts,
        progress_percent: 0,
        started_at: new Date().toISOString(),
        status: "starting",
      });
      const today = getTodayDateInput();
      setDispatchCostStartDate(today);
      setDispatchCostEndDate(today);
      const result = await MetaService.dispatchTemplateBatch({
        empresaId: user.empresa_id,
        usuarioId: user.id,
        ...buildTemplateOperationPayload(),
        listaTransmissaoId: listaId,
        clientBatchToken,
        stopOnError: templateBatchStopOnError,
        leadStartedMessagesGenerateAutoMessage:
          templateBatchLeadStartedMessagesGenerateAutoMessage,
        ...selectedMetaScope,
      });
      setTemplateBatchProgress((current) => ({
        ...(current || {}),
        found: true,
        dispatch_history_id: result.dispatch_history_id || current?.dispatch_history_id || null,
        template_id: result.template_id || current?.template_id || null,
        template_name:
          result.template_name || current?.template_name || selectedTemplateName || null,
        template_category: result.template_category || current?.template_category || null,
        lista_transmissao_id:
          result.lista_transmissao_id || current?.lista_transmissao_id || null,
        total_items: result.total_items || current?.total_items || totalContacts,
        processed_items: result.processed_items || 0,
        success_count: result.success_count || 0,
        error_count: result.error_count || 0,
        remaining_items: result.remaining_items || 0,
        progress_percent: result.progress_percent ?? 0,
        stopped_on_error: result.stopped_on_error || false,
        started_at: result.started_at || current?.started_at || null,
        finished_at: result.finished_at || null,
        duration_ms: result.duration_ms || 0,
        status: result.batch_status || "processing",
      }));
      addToast({
        type: "info",
        title: "Lote iniciado",
        description: `${totalContacts} contato(s) entraram na fila de processamento.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel processar o lote.";
      setTemplateOperationError(message);
      addToast({
        type: "error",
        title: "Erro no disparo em lote",
        description: message,
      });
      setIsDispatchingTemplateBatch(false);
      setCurrentTemplateBatchToken("");
    }
  }, [
    addToast,
    buildTemplateOperationPayload,
    selectedBroadcastListId,
    selectedBroadcastList,
    selectedBroadcastListContactCount,
    selectedMetaScope,
    selectedTemplateName,
    templateBatchLeadStartedMessagesGenerateAutoMessage,
    templateBatchStopOnError,
    user?.empresa_id,
    user?.id,
  ]);

  useEffect(() => {
    if (!currentTemplateBatchToken || !user?.empresa_id) {
      return;
    }

    let cancelled = false;
    let intervalId = 0;

    const loadProgress = async () => {
      try {
        const progress = await MetaService.getTemplateBatchProgress({
          empresaId: user.empresa_id,
          clientBatchToken: currentTemplateBatchToken,
        });

        if (!cancelled && progress) {
          setTemplateBatchProgress((current) => ({
            ...(current || {}),
            ...progress,
            total_items:
              progress.total_items ??
              current?.total_items ??
              0,
          }));

          if (isTemplateBatchTerminalStatus(progress.status)) {
            cancelled = true;
            if (intervalId) {
              window.clearInterval(intervalId);
            }

            setTemplateBatchResult((current) => ({
              ...(current || {}),
              dispatch_history_id:
                progress.dispatch_history_id || current?.dispatch_history_id || null,
              template_id: progress.template_id || current?.template_id || null,
              template_name:
                progress.template_name || current?.template_name || selectedTemplateName || "",
              template_category:
                progress.template_category || current?.template_category || null,
              lista_transmissao_id:
                progress.lista_transmissao_id || current?.lista_transmissao_id || null,
              total_items: progress.total_items || current?.total_items || 0,
              processed_items: progress.processed_items || 0,
              success_count: progress.success_count || 0,
              error_count: progress.error_count || 0,
              stopped_on_error: progress.stopped_on_error || false,
              remaining_items: progress.remaining_items || 0,
              started_at: progress.started_at || current?.started_at || null,
              finished_at: progress.finished_at || null,
              duration_ms: progress.duration_ms || 0,
              batch_status: progress.status || current?.batch_status || null,
              cost_summary: progress.cost_summary || current?.cost_summary || null,
              results: Array.isArray(current?.results) ? current.results : [],
            }));

            if (progress.cost_summary) {
              setDispatchCostMetrics(progress.cost_summary);
              setDispatchCostError("");
            }

            if (progress.status === "failed") {
              const fatalError =
                typeof progress.metadata?.fatal_error === "string"
                  ? progress.metadata.fatal_error
                  : "O lote falhou durante o processamento.";
              setTemplateOperationError(fatalError);
              addToast({
                type: "error",
                title: "Lote com falha",
                description: fatalError,
              });
            } else {
              addToast({
                type:
                  (progress.error_count || 0) > 0 || progress.status === "stopped_on_error"
                    ? "warning"
                    : "success",
                title:
                  progress.status === "stopped_on_error"
                    ? "Lote interrompido"
                    : "Lote concluido",
                description:
                  (progress.error_count || 0) > 0
                    ? `${progress.success_count || 0} envio(s) concluido(s) e ${progress.error_count || 0} falha(s) no lote.`
                    : `${progress.success_count || 0} item(ns) enviado(s) com sucesso.`,
              });
            }

            setIsDispatchingTemplateBatch(false);
            setCurrentTemplateBatchToken("");
          }
        }
      } catch {
        // noop
      }
    };

    void loadProgress();
    intervalId = window.setInterval(() => {
      void loadProgress();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [addToast, currentTemplateBatchToken, selectedTemplateName, user?.empresa_id]);

  useEffect(() => {
    const scrollContainer = document.querySelector(
      ".settings-content, .meta-management-content",
    ) as HTMLElement | null;

    const isAnyModalOpen =
      isMetricsModalOpen || isTemplateDetailsModalOpen || isCreateTemplateModalOpen;

    if (!isAnyModalOpen) return;

    if (scrollContainer) {
      settingsContentScrollTopRef.current = scrollContainer.scrollTop;
      scrollContainer.style.overflowY = "hidden";
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isDispatchingTemplateBatch) {
          event.preventDefault();
          addToast({
            type: "warning",
            title: "Disparo em andamento",
            description:
              "A tela permanece bloqueada ate o processamento do lote terminar.",
          });
          return;
        }
        if (isTemplateDetailsModalOpen) {
          handleCloseTemplateDetailsModal();
          return;
        }
        if (isMetricsModalOpen) {
          handleCloseTemplateMetricsModal();
        }
        if (isCreateTemplateModalOpen) {
          handleCloseCreateTemplateModal();
        }
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      if (scrollContainer) {
        scrollContainer.style.overflowY = "";
        scrollContainer.scrollTop = settingsContentScrollTopRef.current;
      }
    };
  }, [
    addToast,
    handleCloseTemplateDetailsModal,
    handleCloseTemplateMetricsModal,
    isCreateTemplateModalOpen,
    isDispatchingTemplateBatch,
    isMetricsModalOpen,
    isTemplateDetailsModalOpen,
  ]);

  const currentTemplateMetrics =
    selectedTemplateId ? templateMetricsById[selectedTemplateId] : undefined;
  const currentMetricPoints = currentTemplateMetrics
    ? flattenTemplateMetricPoints(currentTemplateMetrics)
    : [];
  const visibleMetricPoints = currentMetricPoints.filter(
    (point) => toSafeNumber(point.sent) > 0,
  );
  const currentMetricTotals = summarizeTemplateMetrics(currentMetricPoints);
  const currentMetricCostTotals = aggregateTypedValues(
    currentMetricPoints,
    "cost",
    "value",
  );
  const currentMetricClickTotals = aggregateTypedValues(
    currentMetricPoints,
    "clicked",
    "count",
  );
  const selectedTemplateDispatchHints = selectedTemplate
    ? getDispatchHintSummary(selectedTemplate)
    : null;
  const selectedBirthdayTemplate = useMemo(
    () =>
      templates.find(
        (template) =>
          String(template.name || "").trim() === birthdayTemplateName.trim(),
      ) || null,
    [birthdayTemplateName, templates],
  );
  const selectedBirthdayTemplateHints = useMemo(
    () =>
      selectedBirthdayTemplate
        ? getDispatchHintSummary(selectedBirthdayTemplate)
        : null,
    [selectedBirthdayTemplate],
  );
  const selectedBirthdayTemplateSavedHeaderImageUrl =
    getTemplateSavedHeaderImageUrl(selectedBirthdayTemplate);
  const birthdayHeaderMediaType = selectedBirthdayTemplateHints?.headerRequiresMedia
    ? String(selectedBirthdayTemplateHints.headerType || "").trim().toLowerCase()
    : "";
  const currentBirthdayTemplateHeaderImageUrl =
    birthdayTemplateHeaderPreviewUrl ||
    (birthdayHeaderMediaType === "image"
      ? birthdayTemplateHeaderMediaUrl.trim()
      : "") ||
    selectedBirthdayTemplateSavedHeaderImageUrl;
  const selectedSaleCompletedTemplate = useMemo(
    () =>
      templates.find(
        (template) =>
          String(template.name || "").trim() === saleCompletedTemplateName.trim(),
      ) || null,
    [saleCompletedTemplateName, templates],
  );
  const selectedSaleCompletedTemplateHints = useMemo(
    () =>
      selectedSaleCompletedTemplate
        ? getDispatchHintSummary(selectedSaleCompletedTemplate)
        : null,
    [selectedSaleCompletedTemplate],
  );
  const selectedSaleCompletedTemplateSavedHeaderImageUrl =
    getTemplateSavedHeaderImageUrl(selectedSaleCompletedTemplate);
  const saleCompletedHeaderMediaType =
    selectedSaleCompletedTemplateHints?.headerRequiresMedia
      ? String(selectedSaleCompletedTemplateHints.headerType || "")
          .trim()
          .toLowerCase()
      : "";
  const currentSaleCompletedTemplateHeaderImageUrl =
    saleCompletedTemplateHeaderPreviewUrl ||
    (saleCompletedHeaderMediaType === "image"
      ? saleCompletedTemplateHeaderMediaUrl.trim()
      : "") ||
    selectedSaleCompletedTemplateSavedHeaderImageUrl;
  const selectedSaleRefusedTemplate = useMemo(
    () =>
      templates.find(
        (template) =>
          String(template.name || "").trim() === saleRefusedTemplateName.trim(),
      ) || null,
    [saleRefusedTemplateName, templates],
  );
  const selectedSaleRefusedTemplateHints = useMemo(
    () =>
      selectedSaleRefusedTemplate
        ? getDispatchHintSummary(selectedSaleRefusedTemplate)
        : null,
    [selectedSaleRefusedTemplate],
  );
  const selectedSaleRefusedTemplateSavedHeaderImageUrl =
    getTemplateSavedHeaderImageUrl(selectedSaleRefusedTemplate);
  const saleRefusedHeaderMediaType =
    selectedSaleRefusedTemplateHints?.headerRequiresMedia
      ? String(selectedSaleRefusedTemplateHints.headerType || "")
          .trim()
          .toLowerCase()
      : "";
  const currentSaleRefusedTemplateHeaderImageUrl =
    saleRefusedTemplateHeaderPreviewUrl ||
    (saleRefusedHeaderMediaType === "image"
      ? saleRefusedTemplateHeaderMediaUrl.trim()
      : "") ||
    selectedSaleRefusedTemplateSavedHeaderImageUrl;
  const selectedTemplateSavedHeaderImageUrl = getTemplateSavedHeaderImageUrl(
    selectedTemplate,
  );
  const currentTemplateHeaderImageUrl =
    templateHeaderPreviewUrl ||
    selectedTemplateSavedHeaderImageUrl;
  const dispatchCostRows: DispatchCostRow[] = Array.isArray(dispatchCostMetrics?.rows)
    ? dispatchCostMetrics.rows
    : [];
  const batchResults = Array.isArray(templateBatchResult?.results)
    ? templateBatchResult.results
    : [];
  const batchSuccessItems = batchResults.filter((item) => item.success);
  const batchFailureItems = batchResults.filter((item) => !item.success);
  const batchCostSummary = templateBatchResult?.cost_summary || null;
  const batchCostRows = Array.isArray(batchCostSummary?.rows) ? batchCostSummary.rows : [];
  const activeBatchProgress = templateBatchProgress;
  const activeBatchProgressPercent = Math.min(
    Math.max(toSafeNumber(activeBatchProgress?.progress_percent), 0),
    100,
  );
  const activeBatchProcessedItems = Math.max(
    toSafeNumber(activeBatchProgress?.processed_items),
    0,
  );
  const activeBatchTotalItems = Math.max(toSafeNumber(activeBatchProgress?.total_items), 0);
  const activeBatchSuccessCount = Math.max(
    toSafeNumber(activeBatchProgress?.success_count),
    0,
  );
  const activeBatchErrorCount = Math.max(toSafeNumber(activeBatchProgress?.error_count), 0);
  const handleExportBatchReport = useCallback(() => {
    if (!templateBatchResult) return;

    exportMetaTemplateBatchReport({
      report: templateBatchResult,
      templateName: selectedTemplateName || selectedTemplate?.name || "template",
    });
  }, [selectedTemplate?.name, selectedTemplateName, templateBatchResult]);

  useEffect(() => {
    if (!selectedBirthdayTemplateHints) {
      setBirthdayHeaderParameterValues([]);
      setBirthdayBodyParameterValues([]);
      setBirthdayButtonParameterValues({});
      return;
    }

    setBirthdayHeaderParameterValues((current) =>
      ensureTemplateParameterInputsLength(
        current,
        selectedBirthdayTemplateHints.headerParameterCount,
      ),
    );
    setBirthdayBodyParameterValues((current) =>
      ensureTemplateParameterInputsLength(
        current,
        selectedBirthdayTemplateHints.bodyParameterCount,
      ),
    );
    setBirthdayButtonParameterValues((current) => {
      const next: Record<number, TemplateParameterInput[]> = {};
      selectedBirthdayTemplateHints.buttons
        .filter((button) => button.parameterCount > 0)
        .forEach((button) => {
          next[button.index] = ensureTemplateParameterInputsLength(
            current[button.index] || [],
            button.parameterCount,
          );
        });
      return next;
    });
  }, [selectedBirthdayTemplateHints]);

  useEffect(() => {
    if (!selectedSaleCompletedTemplateHints) {
      setSaleCompletedHeaderParameterValues([]);
      setSaleCompletedBodyParameterValues([]);
      setSaleCompletedButtonParameterValues({});
      return;
    }

    setSaleCompletedHeaderParameterValues((current) =>
      ensureTemplateParameterInputsLength(
        current,
        selectedSaleCompletedTemplateHints.headerParameterCount,
      ),
    );
    setSaleCompletedBodyParameterValues((current) =>
      ensureTemplateParameterInputsLength(
        current,
        selectedSaleCompletedTemplateHints.bodyParameterCount,
      ),
    );
    setSaleCompletedButtonParameterValues((current) => {
      const next: Record<number, TemplateParameterInput[]> = {};
      selectedSaleCompletedTemplateHints.buttons
        .filter((button) => button.parameterCount > 0)
        .forEach((button) => {
          next[button.index] = ensureTemplateParameterInputsLength(
            current[button.index] || [],
            button.parameterCount,
          );
        });
      return next;
    });
  }, [selectedSaleCompletedTemplateHints]);

  useEffect(() => {
    if (!selectedSaleRefusedTemplateHints) {
      setSaleRefusedHeaderParameterValues([]);
      setSaleRefusedBodyParameterValues([]);
      setSaleRefusedButtonParameterValues({});
      return;
    }

    setSaleRefusedHeaderParameterValues((current) =>
      ensureTemplateParameterInputsLength(
        current,
        selectedSaleRefusedTemplateHints.headerParameterCount,
      ),
    );
    setSaleRefusedBodyParameterValues((current) =>
      ensureTemplateParameterInputsLength(
        current,
        selectedSaleRefusedTemplateHints.bodyParameterCount,
      ),
    );
    setSaleRefusedButtonParameterValues((current) => {
      const next: Record<number, TemplateParameterInput[]> = {};
      selectedSaleRefusedTemplateHints.buttons
        .filter((button) => button.parameterCount > 0)
        .forEach((button) => {
          next[button.index] = ensureTemplateParameterInputsLength(
            current[button.index] || [],
            button.parameterCount,
          );
        });
      return next;
    });
  }, [selectedSaleRefusedTemplateHints]);

  const automationScheduleCardContext = {
    autoMessageDrafts,
    togglingType,
    handleToggleAutoMessage,
    templates,
    isLoadingTemplates,
  };


  return (
    <div className="api-meta-settings-container">
      {isIntegrationModule && (
        <header className="api-meta-hero">
          <div className="page-actions">
            <span className="api-meta-eyebrow">Meta Business</span>
            <h2>Conecte a empresa ao WhatsApp oficial da Meta</h2>
            {/* comentado temporariamente <p>
              Use o Embedded Signup (ES) da Meta para vincular Business Manager,
              conta do WhatsApp e numero de telefone em um unico fluxo.
            </p> */}
            <div className="meta-integration-status-field">
              <label htmlFor="meta-integration-status">
                Status da integra��o:
              </label>
              <input
                id="meta-integration-status"
                type="text"
                className={`meta-integration-status-input meta-integration-status-input--${statusTone}`}
                value={visibleStatus}
                readOnly
              />
            </div>
            <div className="meta-button-space">
            <button
              type="button"
              className="add-button meta-connect-button"
              onClick={handleMetaLogin}
              disabled={isConnecting || isSavingIntegration}
            >
              {isConnecting
                ? "Conectando empresa..."
                : isSavingIntegration
                  ? "Salvando vinculacao..."
                  : "Vincular conta da Meta"}
            </button>
            <button
              type="button"
              className="meta-toggle-details-button"
              onClick={() =>
                setIsIntegrationDetailsOpen((current) => !current)
              }
            >
              {isIntegrationDetailsOpen ? "Ver menos" : "Ver mais"}
            </button>
            </div>

            {isIntegrationDetailsOpen ? (
              <>
                <div className="meta-template-block meta-template-block--integration-summary">
                  <div className="meta-field-grid meta-field-grid--template-base">
                    <div className="meta-summary-field">
                      <span>Status atual</span>
                      <strong>{visibleStatus}</strong>
                    </div>
                    <div className="meta-summary-field">
                      <span>Webhook</span>
                      <strong>{integrationData?.webhook_url || "-"}</strong>
                    </div>
                    <div className="meta-summary-field">
                      <span>Ultima vincula��o</span>
                      <strong>
                        {formatDateTime(integrationData?.last_embedded_signup_at)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="meta-template-block">
                  <div className="meta-field-grid meta-field-grid--template-base">
                    <div className="meta-readonly-field">
                      <span>WhatsApp Account ID</span>
                      <strong>{metaWhatsappAccountId || "-"}</strong>
                    </div>
                    <div className="meta-readonly-field">
                      <span>Phone Number ID</span>
                      <strong>{metaPhoneNumberId || "-"}</strong>
                    </div>
                    <div className="meta-readonly-field">
                      <span>Numero exibido</span>
                      <strong>{metaDisplayPhoneNumber || "-"}</strong>
                    </div>
                    <div className="meta-readonly-field">
                      <span>Business ID</span>
                      <strong>{metaBusinessId || "-"}</strong>
                    </div>
                    <div className="meta-readonly-field">
                      <span>Verified name</span>
                      <strong>{metaVerifiedName || "-"}</strong>
                    </div>
                    {renderLinkedMetaAccountsSection()}
                    {/* <label>
                      Signup code
                      <input
                        type="text"
                        value={metaSignupCode}
                        onChange={(event) => setMetaSignupCode(event.target.value)}
                        placeholder="Retornado pelo Embedded Signup"
                      />
                    </label> */}
                    {/* <label>
                      Access token
                      <input
                        type="text"
                        value={metaAccessToken}
                        onChange={(event) => setMetaAccessToken(event.target.value)}
                        placeholder="Token de acesso da Meta"
                      />
                    </label> */}
                    {/* <label>
                      Redirect URI
                      <input
                        type="text"
                        value={metaRedirectUri}
                        onChange={(event) => setMetaRedirectUri(event.target.value)}
                        placeholder="https://..."
                      />
                    </label> */}
                    {/* <label>
                      WhatsApp Account ID
                      <input
                        type="text"
                        value={metaWhatsappAccountId}
                        onChange={(event) =>
                          setMetaWhatsappAccountId(event.target.value)
                        }
                        placeholder="WABA ID"
                      />
                    </label> */}
                    {/* <label>
                      Phone Number ID
                      <input
                        type="text"
                        value={metaPhoneNumberId}
                        onChange={(event) => setMetaPhoneNumberId(event.target.value)}
                        placeholder="ID do numero"
                      />
                    </label> */}
                    {/* <label>
                      Numero exibido
                      <input
                        type="text"
                        value={metaDisplayPhoneNumber}
                        onChange={(event) =>
                          setMetaDisplayPhoneNumber(event.target.value)
                        }
                        placeholder="5511999999999"
                      />
                    </label> */}
                    {/* <label>
                      Business ID
                      <input
                        type="text"
                        value={metaBusinessId}
                        onChange={(event) => setMetaBusinessId(event.target.value)}
                        placeholder="Business ID"
                      />
                    </label> */}
                    {/* <label>
                      Nome do business
                      <input
                        type="text"
                        value={metaBusinessName}
                        onChange={(event) => setMetaBusinessName(event.target.value)}
                        placeholder="Nome da empresa na Meta"
                      />
                    </label> */}
                    {/* <label>
                      Business Manager ID
                      <input
                        type="text"
                        value={metaBusinessManagerId}
                        onChange={(event) =>
                          setMetaBusinessManagerId(event.target.value)
                        }
                        placeholder="BM ID"
                      />
                    </label> */}
                    {/* <label>
                      Nome do Business Manager
                      <input
                        type="text"
                        value={metaBusinessManagerName}
                        onChange={(event) =>
                          setMetaBusinessManagerName(event.target.value)
                        }
                        placeholder="Nome do BM"
                      />
                    </label> */}
                    {/* <label>
                      Nome da conta WhatsApp
                      <input
                        type="text"
                        value={metaWhatsappAccountName}
                        onChange={(event) =>
                          setMetaWhatsappAccountName(event.target.value)
                        }
                        placeholder="Nome da conta oficial"
                      />
                    </label> */}
                    {/* <label>
                      Verified name
                      <input
                        type="text"
                        value={metaVerifiedName}
                        onChange={(event) => setMetaVerifiedName(event.target.value)}
                        placeholder="Nome verificado"
                      />
                    </label> */}
                    {/* <label style={{ gridColumn: "1 / -1" }}>
                      URL do webhook
                      <input
                        type="text"
                        value={metaWebhookUrl}
                        onChange={(event) => setMetaWebhookUrl(event.target.value)}
                        placeholder="https://seu-backend/meta/webhook"
                      />
                    </label> */}
                  </div>
                  {/* <div className="meta-template-actions">
                    <button
                      type="button"
                      className="meta-secondary-button"
                      onClick={() => void handleSaveMetaIntegration()}
                      disabled={isSavingIntegration}
                    >
                      {isSavingIntegration ? "Salvando..." : "Salvar integracao"}
                    </button>
                  </div> */}
                  {integrationData?.campos_faltantes?.length ? (
                    <p className="meta-template-metrics-error">
                      Campos pendentes no backend:{" "}
                      {integrationData.campos_faltantes.join(", ")}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </header>
      )}

      {isManagementModule && (
        <>
          <MetaApiManagementToolbar
            activeMetaViewTab={activeMetaViewTab}
            setActiveMetaViewTab={setActiveMetaViewTab}
            isIntegrationActive={isIntegrationActive}
            linkedMetaAccounts={linkedMetaAccounts}
            isAccountPanelExpanded={isAccountPanelExpanded}
            setIsAccountPanelExpanded={setIsAccountPanelExpanded}
            selectedMetaAccountLabel={selectedMetaAccountLabel}
            selectedMetaAccountOfficialLabel={selectedMetaAccountOfficialLabel}
            selectedMetaAccountTechnicalLabel={selectedMetaAccountTechnicalLabel}
            selectedMetaParamId={selectedMetaParamId}
            setSelectedMetaParamId={setSelectedMetaParamId}
          />


          {activeMetaViewTab === "whatsapp_profile" && !isIntegrationActive && (
            <section className="meta-config-section">
              <div className="meta-template-list-section">
                <div className="meta-template-block">
                  <h4>Integração pendente</h4>
                  <p>
                    Ative primeiro a integração na aba <strong>Integração</strong>{" "}
                    para liberar o perfil comercial do WhatsApp.
                  </p>
                </div>
              </div>
            </section>
          )}

          {activeMetaViewTab === "templates" && !isIntegrationActive && (
            <section className="meta-config-section">
              <div className="meta-template-list-section">
                <div className="meta-template-block">
                  <h4>Integração pendente</h4>
                  <p>
                    Ative primeiro a integração na aba <strong>Integração</strong>{" "}
                    para liberar templates, preview e disparos.
                  </p>
                </div>
              </div>
            </section>
          )}

          {activeMetaViewTab === "dispatch_costs" && !isIntegrationActive && (
            <section className="meta-config-section">
              <div className="meta-template-list-section">
                <div className="meta-template-block">
                  <h4>Integração pendente</h4>
                  <p>
                    Ative primeiro a integração na aba <strong>Integração</strong>{" "}
                    para liberar os custos de disparo.
                  </p>
                </div>
              </div>
            </section>
          )}

          {activeMetaViewTab === "whatsapp_profile" && isIntegrationActive && (
            <WhatsAppProfileSection
              currentWhatsAppProfilePictureUrl={currentWhatsAppProfilePictureUrl}
              whatsAppProfileDraft={whatsAppProfileDraft}
              selectedMetaAccountLabel={selectedMetaAccountLabel}
              selectedMetaAccount={selectedMetaAccount}
              fetchWhatsAppProfile={fetchWhatsAppProfile}
              handleSaveWhatsAppProfile={handleSaveWhatsAppProfile}
              isLoadingWhatsAppProfile={isLoadingWhatsAppProfile}
              isSavingWhatsAppProfile={isSavingWhatsAppProfile}
              whatsAppProfileError={whatsAppProfileError}
              whatsAppProfile={whatsAppProfile}
              setWhatsAppProfilePictureFile={setWhatsAppProfilePictureFile}
              handleWhatsAppProfileFieldChange={handleWhatsAppProfileFieldChange}
            />
          )}


          {activeMetaViewTab === "templates" && isIntegrationActive && (
            <section className="meta-config-section">
            <CreateTemplateModal
              isOpen={isCreateTemplateModalOpen}
              isEditing={Boolean(editingTemplateId)}
              onClose={handleCloseCreateTemplateModal}
              handleCreateTemplate={handleCreateTemplate}
              templateName={templateName}
              setTemplateName={setTemplateName}
              templateCategory={templateCategory}
              setTemplateCategory={setTemplateCategory}
              templateLanguage={templateLanguage}
              setTemplateLanguage={setTemplateLanguage}
              templateMediaSampleType={templateMediaSampleType}
              setTemplateMediaSampleType={setTemplateMediaSampleType}
              setTemplateMediaSampleFile={setTemplateMediaSampleFile}
              templateHeader={templateHeader}
              setTemplateHeader={setTemplateHeader}
              templateMediaSamplePreviewUrl={templateMediaSamplePreviewUrl}
              templateBodyRef={templateBodyRef}
              templateBody={templateBody}
              setTemplateBody={setTemplateBody}
              templateBodyLength={templateBodyLength}
              emojiMenuRef={emojiMenuRef}
              isEmojiMenuOpen={isEmojiMenuOpen}
              setIsEmojiMenuOpen={setIsEmojiMenuOpen}
              handleInsertTemplateEmoji={handleInsertTemplateEmoji}
              handleInsertBodyTemplateToken={handleInsertBodyTemplateToken}
              handleInsertVariable={handleInsertVariable}
              templateVariables={templateVariables}
              hasSubmittedTemplate={hasSubmittedTemplate}
              templateVariableSamples={templateVariableSamples}
              handleTemplateVariableSampleChange={handleTemplateVariableSampleChange}
              templateFooter={templateFooter}
              setTemplateFooter={setTemplateFooter}
              templateFooterLength={templateFooterLength}
              templateButtons={templateButtons}
              handleRemoveTemplateButton={handleRemoveTemplateButton}
              handleTemplateButtonChange={handleTemplateButtonChange}
              handleAddTemplateButton={handleAddTemplateButton}
              templateAllowCategoryChange={templateAllowCategoryChange}
              setTemplateAllowCategoryChange={setTemplateAllowCategoryChange}
              isSubmittingTemplate={isSubmittingTemplate}
              previewHeader={previewHeader}
              previewBody={previewBody}
              previewFooter={previewFooter}
              previewTemplateButtons={previewTemplateButtons}
              previewPayload={previewPayload}
            />


            <div className="meta-template-list-section">
              <div className="meta-template-list-header meta-template-list-header--templates">
                <div>
                  <h3>Lista dos templates</h3>
                  <p>
                    Templates e metricas desta aba estao vinculados a: {" "}
                    <strong>{selectedMetaAccountLabel}</strong>
                  </p>
                </div>
                <div className="meta-template-list-header__controls">
                  <div className="meta-template-search-wrapper">
                    <FiSearch className="meta-template-search-icon" />
                    <input
                      type="search"
                      className="meta-template-search-input"
                      placeholder="Buscar template..."
                      value={templateSearchTerm}
                      onChange={(e) => setTemplateSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="meta-template-actions">
                    <button
                      type="button"
                      className="add-button"
                      onClick={handleOpenCreateTemplateModal}
                    >
                      Adicionar novo template
                    </button>
                    {/* <button
                    type="button"
                    className="meta-secondary-button"
                    onClick={() => void fetchTemplates()}
                    disabled={isLoadingTemplates}
                  >
                    {isLoadingTemplates ? "Atualizando..." : "Atualizar lista"}
                  </button> */}
                  </div>
                </div>
              </div>

              <div className="meta-template-list">
                {isLoadingTemplates ? (
                  <p>Carregando templates...</p>
                ) : filteredTemplates.length === 0 ? (
                  <p>Nenhum template retornado pela Meta.</p>
                                ) : (
                  filteredTemplates.map((template, index) => (
                    <TemplateListCard
                      key={template.id || `${template.name || "template"}-${index}`}
                      template={template}
                      onOpen={handleOpenTemplateMetrics}
                      onEdit={handleOpenEditTemplateModal}
                      onArchive={handleArchiveTemplate}
                      isArchiving={archivingTemplateId === String(template.id || "")}
                    />
                  ))
                )}
              </div>
            </div>

            <TemplateOperationModal
              isMetricsModalOpen={isMetricsModalOpen}
              handleCloseTemplateMetricsModal={handleCloseTemplateMetricsModal}
              isDispatchingTemplateBatch={isDispatchingTemplateBatch}
              selectedTemplateName={selectedTemplateName}
              activeBatchProcessedItems={activeBatchProcessedItems}
              activeBatchTotalItems={activeBatchTotalItems}
              activeBatchProgressPercent={activeBatchProgressPercent}
              activeBatchSuccessCount={activeBatchSuccessCount}
              activeBatchErrorCount={activeBatchErrorCount}
              activeBatchProgress={activeBatchProgress}
              handleOpenTemplateDetailsModal={handleOpenTemplateDetailsModal}
              selectedTemplateId={selectedTemplateId}
              templateOperationTab={templateOperationTab}
              setTemplateOperationTab={setTemplateOperationTab}
              selectedMetaAccountLabel={selectedMetaAccountLabel}
              selectedTemplateDispatchHints={selectedTemplateDispatchHints}
              templateOperationLanguage={templateOperationLanguage}
              setTemplateOperationLanguage={setTemplateOperationLanguage}
              templateHeaderParameterValues={templateHeaderParameterValues}
              handleHeaderParameterChange={handleHeaderParameterChange}
              templateBodyParameterValues={templateBodyParameterValues}
              handleBodyParameterChange={handleBodyParameterChange}
              templateButtonParameterValues={templateButtonParameterValues}
              handleButtonParameterChange={handleButtonParameterChange}
              selectedTemplate={selectedTemplate}
              selectedTemplateSavedHeaderImageUrl={selectedTemplateSavedHeaderImageUrl}
              templateHeaderFile={templateHeaderFile}
              setTemplateHeaderFile={setTemplateHeaderFile}
              currentTemplateHeaderImageUrl={currentTemplateHeaderImageUrl}
              templateDispatchMode={templateDispatchMode}
              setTemplateDispatchMode={setTemplateDispatchMode}
              templateDispatchCustomerSearch={templateDispatchCustomerSearch}
              setTemplateDispatchCustomerSearch={setTemplateDispatchCustomerSearch}
              setTemplateDispatchCustomerSuggestions={setTemplateDispatchCustomerSuggestions}
              isSearchingTemplateDispatchCustomer={isSearchingTemplateDispatchCustomer}
              templateDispatchCustomerSuggestions={templateDispatchCustomerSuggestions}
              selectedTemplateDispatchCustomer={selectedTemplateDispatchCustomer}
              setSelectedTemplateDispatchCustomer={setSelectedTemplateDispatchCustomer}
              isDispatchingTemplate={isDispatchingTemplate}
              templateDispatchResult={templateDispatchResult}
              templateOperationError={templateOperationError}
              handleDispatchTemplate={handleDispatchTemplate}
              broadcastLists={broadcastLists}
              selectedBroadcastListId={selectedBroadcastListId}
              setSelectedBroadcastListId={setSelectedBroadcastListId}
              isLoadingBroadcastLists={isLoadingBroadcastLists}
              selectedBroadcastList={selectedBroadcastList}
              selectedBroadcastListContactCount={selectedBroadcastListContactCount}
              templateBatchLeadStartedMessagesGenerateAutoMessage={templateBatchLeadStartedMessagesGenerateAutoMessage}
              setTemplateBatchLeadStartedMessagesGenerateAutoMessage={setTemplateBatchLeadStartedMessagesGenerateAutoMessage}
              templateBatchStopOnError={templateBatchStopOnError}
              setTemplateBatchStopOnError={setTemplateBatchStopOnError}
              handleDispatchTemplateBatch={handleDispatchTemplateBatch}
              templateBatchResult={templateBatchResult}
              handleExportBatchReport={handleExportBatchReport}
              batchCostSummary={batchCostSummary}
              batchCostRows={batchCostRows}
              batchFailureItems={batchFailureItems}
              batchSuccessItems={batchSuccessItems}
            />

            <TemplateDetailsModal
              isOpen={isTemplateDetailsModalOpen}
              onClose={handleCloseTemplateDetailsModal}
              selectedTemplateName={selectedTemplateName}
              metricsStartDate={metricsStartDate}
              setMetricsStartDate={setMetricsStartDate}
              metricsEndDate={metricsEndDate}
              setMetricsEndDate={setMetricsEndDate}
              handleApplyMetricsPeriod={handleApplyMetricsPeriod}
              isLoadingTemplateMetrics={isLoadingTemplateMetrics}
              isApplyingMetricsPeriod={isApplyingMetricsPeriod}
              selectedTemplateId={selectedTemplateId}
              templateMetricsError={templateMetricsError}
              currentTemplateMetrics={currentTemplateMetrics}
              currentMetricTotals={currentMetricTotals}
              currentMetricCostTotals={currentMetricCostTotals}
              currentMetricClickTotals={currentMetricClickTotals}
              visibleMetricPoints={visibleMetricPoints}
            />

            </section>
          )}

          {activeMetaViewTab === "dispatch_costs" && isIntegrationActive && (
            <DispatchCostsSection
              selectedMetaAccountLabel={selectedMetaAccountLabel}
              dispatchCostStartDate={dispatchCostStartDate}
              setDispatchCostStartDate={setDispatchCostStartDate}
              dispatchCostEndDate={dispatchCostEndDate}
              setDispatchCostEndDate={setDispatchCostEndDate}
              handleLoadDispatchCosts={handleLoadDispatchCosts}
              isLoadingDispatchCostMetrics={isLoadingDispatchCostMetrics}
              dispatchCostError={dispatchCostError}
              dispatchCostMetrics={dispatchCostMetrics}
              dispatchCostRows={dispatchCostRows}
            />
          )}


          {activeMetaViewTab === "auto_messages" && !isIntegrationActive && (
            <section className="meta-config-section">
              <div className="meta-template-list-section">
                <div className="meta-template-block">
                  <h4>Integracao pendente</h4>
                  <p>
                    Ative primeiro a integracao na aba <strong>Integracao</strong>{" "}
                    para liberar as mensagens automaticas.
                  </p>
                </div>
              </div>
            </section>
          )}

          {activeMetaViewTab === "auto_messages" && isIntegrationActive && (
            <AutoMessagesSection
              isLoadingAutoMessages={isLoadingAutoMessages}
              autoMessageDrafts={autoMessageDrafts}
              selectedMetaParamId={String(selectedMetaScope.metaParamId || "")}
              savingType={savingType}
              deletingType={deletingType}
              togglingType={togglingType}
              editingType={editingType}
              setEditingType={setEditingType}
              handleToggleAutoMessage={handleToggleAutoMessage}
              handleChangeAutoMessage={handleChangeAutoMessage}
              handleChangeAutoMessageComplementaryText={handleChangeAutoMessageComplementaryText}
              handleUploadAutoMessageGalleryImage={handleUploadAutoMessageGalleryImage}
              isUploadingAutoMessageGalleryImage={isUploadingAutoMessageGalleryImage}
              isLoadingAutoMessageGalleryImages={isLoadingAutoMessageGalleryImages}
              autoMessageGalleryImages={autoMessageGalleryImages}
              handleSelectAutoMessageImage={handleSelectAutoMessageImage}
              handleSaveAutoMessage={handleSaveAutoMessage}
              handleDeleteAutoMessage={handleDeleteAutoMessage}
            />
          )}


          {activeMetaViewTab === "automation_schedule" &&
            !isIntegrationActive && (
              <section className="meta-config-section">
                <div className="meta-template-list-section">
                  <div className="meta-template-block">
                    <h4>Integração pendente</h4>
                    <p>
                      Ative primeiro a integração na aba{" "}
                      <strong>Integração</strong> para liberar os agendamentos
                      de automação.
                    </p>
                  </div>
                </div>
              </section>
            )}

          {activeMetaViewTab === "automation_schedule" &&
            isIntegrationActive && (
              <div className="meta-template-list-section">
                <section className="meta-config-section">
                  <div className="meta-template-list-header">
                    <div>
                      <h3>Agendamento de automação</h3>
                      <p>
                        Configure templates agendados por numero Meta para
                        aniversario e follow-ups comerciais.
                      </p>
                    </div>
                  </div>

                  <div className="meta-automation-schedule-grid">
                    {renderAutomationScheduleCard({
                      ...automationScheduleCardContext,
                      title: "Mensagem automatica de aniversario",
                      toggleTypeId: 4,
                      description:
                        "Selecione um template da Meta para o cron disparar no aniversario do cliente usando o numero da ultima conversa. Se o cliente ainda nao tiver conversa anterior, o sistema usa o numero padrao definido abaixo.",
                      loadingText: "Carregando configuracao de aniversario...",
                      statusText: autoMessageDrafts[4].habilitada
                        ? "Envio automatico habilitado"
                        : "Envio automatico desabilitado",
                      defaultDispatchStatusText: birthdayIsDefaultDispatchNumber
                        ? "Este numero sera salvo como padrao para aniversariantes sem conversa anterior."
                        : birthdayTemplateConfig?.default_dispatch_display_phone_number
                          ? `Numero padrao atual: ${birthdayTemplateConfig.default_dispatch_display_phone_number}`
                          : "Nenhum numero padrao foi selecionado. Clientes sem ultima conversa nao receberao a automacao ate voce definir um padrao.",
                      templateLabel: "Template de aniversario",
                      tipText:
                        "O cron considera os contatos aniversariantes que ja tiveram conversa vinculada ao numero Meta selecionado.",
                      loading: isLoadingBirthdayTemplateConfig,
                      saving: isSavingBirthdayTemplateConfig,
                      templateName: birthdayTemplateName,
                      setTemplateName: setBirthdayTemplateName,
                      templateLanguage: birthdayTemplateLanguage,
                      setTemplateLanguage: setBirthdayTemplateLanguage,
                      templateSchedule: birthdayTemplateSchedule,
                      setTemplateSchedule: setBirthdayTemplateSchedule,
                      isDefaultDispatchNumber: birthdayIsDefaultDispatchNumber,
                      setIsDefaultDispatchNumber:
                        setBirthdayIsDefaultDispatchNumber,
                      headerMediaUrl: birthdayTemplateHeaderMediaUrl,
                      setHeaderMediaUrl: setBirthdayTemplateHeaderMediaUrl,
                      headerFile: birthdayTemplateHeaderFile,
                      setHeaderFile: setBirthdayTemplateHeaderFile,
                      currentHeaderImageUrl:
                        currentBirthdayTemplateHeaderImageUrl,
                      selectedTemplateHints: selectedBirthdayTemplateHints,
                      headerMediaType: birthdayHeaderMediaType,
                      headerParameterValues: birthdayHeaderParameterValues,
                      onHeaderParameterChange:
                        handleBirthdayHeaderParameterChange,
                      bodyParameterValues: birthdayBodyParameterValues,
                      onBodyParameterChange: handleBirthdayBodyParameterChange,
                      buttonParameterValues: birthdayButtonParameterValues,
                      onButtonParameterChange:
                        handleBirthdayButtonParameterChange,
                      onSave: handleSaveBirthdayTemplateConfig,
                      onClear: handleClearBirthdayTemplateConfig,
                      clearDisabled:
                        isSavingBirthdayTemplateConfig ||
                        (!birthdayTemplateConfig?.template_name &&
                          !birthdayTemplateName),
                    })}

                    {renderAutomationScheduleCard({
                      ...automationScheduleCardContext,
                      title: "Follow-up de venda realizada",
                      toggleTypeId: 6,
                      description:
                        "Selecione um template da Meta para enviar um follow-up depois de negocios fechados como ganhos. O cron considera o numero da ultima conversa do cliente e pode usar um numero padrao quando ainda nao existir historico.",
                      loadingText:
                        "Carregando configuracao de follow-up de venda realizada...",
                      statusText: autoMessageDrafts[6].habilitada
                        ? "Envio automatico habilitado"
                        : "Envio automatico desabilitado",
                      defaultDispatchStatusText:
                        saleCompletedIsDefaultDispatchNumber
                          ? "Este numero sera salvo como padrao para clientes com venda realizada sem conversa anterior."
                          : saleCompletedTemplateConfig?.default_dispatch_display_phone_number
                            ? `Numero padrao atual: ${saleCompletedTemplateConfig.default_dispatch_display_phone_number}`
                            : "Nenhum numero padrao foi selecionado. Clientes sem ultima conversa nao receberao esta automacao ate voce definir um padrao.",
                      templateLabel: "Template do follow-up ganho",
                      tipText:
                        "O cron procura negocios fechados como ganhos na data calculada pelos dias configurados apos a venda.",
                      loading: isLoadingSaleCompletedTemplateConfig,
                      saving: isSavingSaleCompletedTemplateConfig,
                      templateName: saleCompletedTemplateName,
                      setTemplateName: setSaleCompletedTemplateName,
                      templateLanguage: saleCompletedTemplateLanguage,
                      setTemplateLanguage: setSaleCompletedTemplateLanguage,
                      templateSchedule: saleCompletedTemplateSchedule,
                      setTemplateSchedule: setSaleCompletedTemplateSchedule,
                      delayDays: saleCompletedDelayDays,
                      setDelayDays: setSaleCompletedDelayDays,
                      delayLabel: "Dias apos a venda realizada",
                      delayHelperText:
                        "Informe quantos dias depois do fechamento ganho o cliente deve receber a mensagem.",
                      isDefaultDispatchNumber:
                        saleCompletedIsDefaultDispatchNumber,
                      setIsDefaultDispatchNumber:
                        setSaleCompletedIsDefaultDispatchNumber,
                      headerMediaUrl: saleCompletedTemplateHeaderMediaUrl,
                      setHeaderMediaUrl:
                        setSaleCompletedTemplateHeaderMediaUrl,
                      headerFile: saleCompletedTemplateHeaderFile,
                      setHeaderFile: setSaleCompletedTemplateHeaderFile,
                      currentHeaderImageUrl:
                        currentSaleCompletedTemplateHeaderImageUrl,
                      selectedTemplateHints:
                        selectedSaleCompletedTemplateHints,
                      headerMediaType: saleCompletedHeaderMediaType,
                      headerParameterValues:
                        saleCompletedHeaderParameterValues,
                      onHeaderParameterChange:
                        handleSaleCompletedHeaderParameterChange,
                      bodyParameterValues: saleCompletedBodyParameterValues,
                      onBodyParameterChange:
                        handleSaleCompletedBodyParameterChange,
                      buttonParameterValues:
                        saleCompletedButtonParameterValues,
                      onButtonParameterChange:
                        handleSaleCompletedButtonParameterChange,
                      onSave: handleSaveSaleCompletedTemplateConfig,
                      onClear: handleClearSaleCompletedTemplateConfig,
                      clearDisabled:
                        isSavingSaleCompletedTemplateConfig ||
                        (!saleCompletedTemplateConfig?.template_name &&
                          !saleCompletedTemplateName),
                    })}

                    {renderAutomationScheduleCard({
                      ...automationScheduleCardContext,
                      title: "Follow-up de venda recusada",
                      toggleTypeId: 7,
                      description:
                        "Selecione um template da Meta para enviar um follow-up depois de negocios fechados como perdidos ou recusados. O cron considera o numero da ultima conversa do cliente e pode usar um numero padrao quando ainda nao existir historico.",
                      loadingText:
                        "Carregando configuracao de follow-up de venda recusada...",
                      statusText: autoMessageDrafts[7].habilitada
                        ? "Envio automatico habilitado"
                        : "Envio automatico desabilitado",
                      defaultDispatchStatusText:
                        saleRefusedIsDefaultDispatchNumber
                          ? "Este numero sera salvo como padrao para clientes com venda recusada sem conversa anterior."
                          : saleRefusedTemplateConfig?.default_dispatch_display_phone_number
                            ? `Numero padrao atual: ${saleRefusedTemplateConfig.default_dispatch_display_phone_number}`
                            : "Nenhum numero padrao foi selecionado. Clientes sem ultima conversa nao receberao esta automacao ate voce definir um padrao.",
                      templateLabel: "Template do follow-up recusado",
                      tipText:
                        "O cron procura negocios fechados como perdidos na data calculada pelos dias configurados apos a recusa.",
                      loading: isLoadingSaleRefusedTemplateConfig,
                      saving: isSavingSaleRefusedTemplateConfig,
                      templateName: saleRefusedTemplateName,
                      setTemplateName: setSaleRefusedTemplateName,
                      templateLanguage: saleRefusedTemplateLanguage,
                      setTemplateLanguage: setSaleRefusedTemplateLanguage,
                      templateSchedule: saleRefusedTemplateSchedule,
                      setTemplateSchedule: setSaleRefusedTemplateSchedule,
                      delayDays: saleRefusedDelayDays,
                      setDelayDays: setSaleRefusedDelayDays,
                      delayLabel: "Dias apos a venda recusada",
                      delayHelperText:
                        "Informe quantos dias depois do fechamento perdido o cliente deve receber a mensagem.",
                      isDefaultDispatchNumber:
                        saleRefusedIsDefaultDispatchNumber,
                      setIsDefaultDispatchNumber:
                        setSaleRefusedIsDefaultDispatchNumber,
                      headerMediaUrl: saleRefusedTemplateHeaderMediaUrl,
                      setHeaderMediaUrl:
                        setSaleRefusedTemplateHeaderMediaUrl,
                      headerFile: saleRefusedTemplateHeaderFile,
                      setHeaderFile: setSaleRefusedTemplateHeaderFile,
                      currentHeaderImageUrl:
                        currentSaleRefusedTemplateHeaderImageUrl,
                      selectedTemplateHints: selectedSaleRefusedTemplateHints,
                      headerMediaType: saleRefusedHeaderMediaType,
                      headerParameterValues:
                        saleRefusedHeaderParameterValues,
                      onHeaderParameterChange:
                        handleSaleRefusedHeaderParameterChange,
                      bodyParameterValues: saleRefusedBodyParameterValues,
                      onBodyParameterChange:
                        handleSaleRefusedBodyParameterChange,
                      buttonParameterValues:
                        saleRefusedButtonParameterValues,
                      onButtonParameterChange:
                        handleSaleRefusedButtonParameterChange,
                      onSave: handleSaveSaleRefusedTemplateConfig,
                      onClear: handleClearSaleRefusedTemplateConfig,
                      clearDisabled:
                        isSavingSaleRefusedTemplateConfig ||
                        (!saleRefusedTemplateConfig?.template_name &&
                          !saleRefusedTemplateName),
                    })}
                  </div>
                </section>
              </div>
            )}

        </>
      )}
    </div>
  );
}

export function ApiMetaSettings() {
  return <ApiMetaSettingsModule mode="integration" />;
}

export function MetaManagementSettings({
  onInitialLoadChange,
}: {
  onInitialLoadChange?: (loading: boolean) => void;
}) {
  return (
    <ApiMetaSettingsModule
      mode="management"
      onInitialLoadChange={onInitialLoadChange}
    />
  );
}









