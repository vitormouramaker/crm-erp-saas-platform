import type { ReactNode } from "react";
import type {
  BatchDispatchResultItem,
  MetaIntegrationAccount,
  MetaTemplateItem,
  TemplateMetricDataPoint,
  TemplateMetricsResult,
  WhatsAppProfileData,
  WhatsAutoMessage,
} from "../../service/metaService";

export type AutoMessageTypeId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type MetaViewTab =
  | "whatsapp_profile"
  | "templates"
  | "dispatch_costs"
  | "auto_messages"
  | "automation_schedule";
export type AutomationScheduleCardTypeId = 4 | 6 | 7;
export type TemplateDispatchHints = ReturnType<typeof getDispatchHintSummary>;
export type AutomationScheduleCardProps = {
  title: string;
  toggleTypeId: AutomationScheduleCardTypeId;
  description: string;
  loadingText: string;
  statusText: string;
  defaultDispatchStatusText: string;
  templateLabel: string;
  tipText: string;
  loading: boolean;
  saving: boolean;
  templateName: string;
  setTemplateName: (value: string) => void;
  templateLanguage: string;
  setTemplateLanguage: (value: string) => void;
  templateSchedule: string;
  setTemplateSchedule: (value: string) => void;
  delayDays?: string;
  setDelayDays?: (value: string) => void;
  delayLabel?: string;
  delayHelperText?: string;
  isDefaultDispatchNumber: boolean;
  setIsDefaultDispatchNumber: (value: boolean) => void;
  headerMediaUrl: string;
  setHeaderMediaUrl: (value: string) => void;
  headerFile: File | null;
  setHeaderFile: (value: File | null) => void;
  currentHeaderImageUrl: string;
  selectedTemplateHints: TemplateDispatchHints | null;
  headerMediaType: string;
  headerParameterValues: TemplateParameterInput[];
  onHeaderParameterChange: (
    index: number,
    patch: Partial<TemplateParameterInput>,
  ) => void;
  bodyParameterValues: TemplateParameterInput[];
  onBodyParameterChange: (
    index: number,
    patch: Partial<TemplateParameterInput>,
  ) => void;
  buttonParameterValues: Record<number, TemplateParameterInput[]>;
  onButtonParameterChange: (
    buttonIndex: number,
    parameterIndexPosition: number,
    patch: Partial<TemplateParameterInput>,
  ) => void;
  onSave: () => void | Promise<void>;
  onClear: () => void | Promise<void>;
  clearDisabled: boolean;
};
export type TemplateOperationTab = "preview" | "dispatch";
export type TemplateDispatchMode = "single" | "batch";

export type AutoMessageType = {
  tipoId: AutoMessageTypeId;
  title: string;
  description: string;
  placeholder: string;
};

export type AutoMessageDraft = {
  id: number | null;
  texto: string;
  mensagemComplementarTexto: string;
  galeriaImagemId: number | null;
  galeriaImagemUrl: string | null;
  galeriaImagemNomeArquivo: string | null;
  empresaMetaParamId: number | null;
  ativo: boolean;
  habilitada: boolean;
};

export type WhatsAppProfileDraft = {
  about: string;
  address: string;
  description: string;
  email: string;
  vertical: string;
  websites: string;
  displayName: string;
  displayPhoneNumber: string;
  profilePictureUrl: string;
};

export function buildWhatsAppProfileDraft(
  profile?: WhatsAppProfileData | null,
): WhatsAppProfileDraft {
  return {
    about: profile?.about ? String(profile.about).trim() : "",
    address: profile?.address ? String(profile.address).trim() : "",
    description: profile?.description ? String(profile.description).trim() : "",
    email: profile?.email ? String(profile.email).trim() : "",
    vertical: profile?.vertical ? String(profile.vertical).trim() : "",
    websites: Array.isArray(profile?.websites)
      ? profile.websites.filter(Boolean).join("\n")
      : "",
    displayName: String(
      profile?.display_name || profile?.verified_name || "",
    ).trim(),
    displayPhoneNumber: String(profile?.display_phone_number || "").trim(),
    profilePictureUrl: String(profile?.profile_picture_url || "").trim(),
  };
}

export type TemplateMediaSampleType = "NONE" | "IMAGE" | "VIDEO" | "DOCUMENT";
export type TemplateButtonType =
  | "QUICK_REPLY"
  | "URL"
  | "PHONE_NUMBER"
  | "COPY_CODE"
  | "OTP";

export type TemplateButtonDraft = {
  id: string;
  type: TemplateButtonType;
  text: string;
  url: string;
  phone_number: string;
  example: string;
  extraParamsJson: string;
};

export type MetaEmbeddedSignupIdentifiers = {
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  embeddedSignupEvent?: string;
  isWaLoginUser?: boolean;
};

export function extractMetaEmbeddedSignupValue(
  root: unknown,
  acceptedKeys: string[],
): string | undefined {
  const normalizedAcceptedKeys = new Set(
    acceptedKeys.map((key) => key.toLowerCase()),
  );
  const visited = new WeakSet<object>();
  const queue: unknown[] = [root];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;

    if (typeof current === "string") {
      const trimmed = current.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          queue.push(JSON.parse(trimmed));
        } catch {
          // noop
        }
      }
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const entries = Object.entries(current as Record<string, unknown>);
    for (const [key, value] of entries) {
      if (
        normalizedAcceptedKeys.has(key.toLowerCase()) &&
        value !== null &&
        value !== undefined
      ) {
        const normalizedValue = String(value).trim();
        if (normalizedValue) return normalizedValue;
      }

      if (value && (typeof value === "object" || typeof value === "string")) {
        queue.push(value);
      }
    }
  }

  return undefined;
}

export function extractMetaEmbeddedSignupBoolean(
  root: unknown,
  acceptedKeys: string[],
): boolean | undefined {
  const normalizedAcceptedKeys = new Set(
    acceptedKeys.map((key) => key.toLowerCase()),
  );
  const visited = new WeakSet<object>();
  const queue: unknown[] = [root];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;

    if (typeof current === "string") {
      const trimmed = current.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          queue.push(JSON.parse(trimmed));
        } catch {
          // noop
        }
      }
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const entries = Object.entries(current as Record<string, unknown>);
    for (const [key, value] of entries) {
      if (normalizedAcceptedKeys.has(key.toLowerCase())) {
        if (typeof value === "boolean") return value;
        if (value === 1 || value === "1" || value === "true") return true;
        if (value === 0 || value === "0" || value === "false") return false;
      }

      if (value && (typeof value === "object" || typeof value === "string")) {
        queue.push(value);
      }
    }
  }

  return undefined;
}

export function parseMetaEmbeddedSignupIdentifiers(
  raw: unknown,
): MetaEmbeddedSignupIdentifiers | null {
  const parseObject = (value: unknown): Record<string, unknown> | null => {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }
    if (typeof value === "object") return value as Record<string, unknown>;
    return null;
  };

  const root = parseObject(raw);
  if (!root) return null;

  const data = parseObject(root.data) || root;
  const setup = parseObject(data.setup);

  const wabaId =
    extractMetaEmbeddedSignupValue(root, [
      "waba_id",
      "whatsapp_account_id",
      "whatsapp_business_account_id",
    ]) ||
    String(setup?.waba_id || "").trim();

  const phoneNumberId =
    extractMetaEmbeddedSignupValue(root, [
      "phone_number_id",
      "phone_id",
      "phoneNumberId",
    ]) ||
    String(setup?.phone_number_id || "").trim();

  const businessId =
    extractMetaEmbeddedSignupValue(root, [
      "business_id",
      "business_manager_id",
    ]) ||
    String(setup?.business_id || "").trim();

  const embeddedSignupEvent = extractMetaEmbeddedSignupValue(root, ["event"]);
  const isWaLoginUser = extractMetaEmbeddedSignupBoolean(root, [
    "is_wa_login_user",
  ]);

  if (!wabaId && !phoneNumberId && !businessId && !embeddedSignupEvent) return null;

  return {
    wabaId: wabaId || undefined,
    phoneNumberId: phoneNumberId || undefined,
    businessId: businessId || undefined,
    embeddedSignupEvent: embeddedSignupEvent || undefined,
    isWaLoginUser,
  };
}

export const AUTO_MESSAGE_TYPES: AutoMessageType[] = [
  {
    tipoId: 1,
    title: "Mensagem de boas-vindas",
    description: "Enviada automaticamente quando o cliente inicia contato.",
    placeholder: "Ex: Ola! Recebemos sua mensagem e vamos te atender por aqui.",
  },
  {
    tipoId: 2,
    title: "Mensagem final de atendimento",
    description: "Enviada quando o atendimento e finalizado no chat.",
    placeholder:
      "Ex: Atendimento finalizado com sucesso. Obrigado pelo contato.",
  },
  {
    tipoId: 5,
    title: "Mensagem de inicio do atendente",
    description:
      "Enviada quando um atendente assume a conversa. Use {{nome_atendente}} para inserir o nome automaticamente.",
    placeholder:
      "Ex: Ola, sou {{nome_atendente}} e irei cuidar do seu atendimento hoje. Como posso ajudar?",
  },
  {
    tipoId: 8,
    title: "Cliente sem resposta por 6 horas",
    description:
      "Enviada quando o cliente nao responde por 6 horas apos a ultima mensagem do atendente. O envio ocorre somente dentro da janela de 24 horas da Meta.",
    placeholder:
      "Ex: Ola! Conseguiu ver nossa ultima mensagem? Podemos continuar seu atendimento?",
  },
  {
    tipoId: 3,
    title: "Texto de NPS",
    description: "Texto enviado junto ao botao para avaliação NPS.",
    placeholder: "Ex: Sua opiniao e importante. Clique no botao para avaliar.",
  },
];

export const TEMPLATE_EMOJI_OPTIONS = [
  "\u{1F60A}",
  "\u{1F609}",
  "\u{1F64F}",
  "\u{2705}",
  "\u{1F389}",
  "\u{1F4C5}",
  "\u{1F4CD}",
  "\u{1F4DE}",
  "\u{26A0}\u{FE0F}",
  "\u{2764}\u{FE0F}",
];

export const TEMPLATE_BUTTON_TYPE_OPTIONS: Array<{
  value: TemplateButtonType;
  label: string;
}> = [
  { value: "QUICK_REPLY", label: "Resposta rápida (QUICK_REPLY)" },
  { value: "URL", label: "Abrir URL (URL)" },
  { value: "PHONE_NUMBER", label: "Ligar (PHONE_NUMBER)" },
  { value: "COPY_CODE", label: "Copiar código (COPY_CODE)" },
  { value: "OTP", label: "OTP" },
];

export const TEMPLATE_MAX_BUTTONS = 2;

export function buildTemplateButtonDraft(): TemplateButtonDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: "QUICK_REPLY",
    text: "",
    url: "",
    phone_number: "",
    example: "",
    extraParamsJson: "",
  };
}

export function parseJsonObject(value: string): Record<string, unknown> | null {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

export function buildTemplateButtons(
  drafts: TemplateButtonDraft[],
  strictValidation: boolean,
): { buttons: Array<Record<string, unknown>>; error?: string } {
  const buttons: Array<Record<string, unknown>> = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    const text = draft.text.trim();
    const url = draft.url.trim();
    const phoneNumber = draft.phone_number.trim();
    const exampleText = draft.example.trim();
    const extraJson = draft.extraParamsJson.trim();
    const hasSomeInput =
      text.length > 0 ||
      url.length > 0 ||
      phoneNumber.length > 0 ||
      exampleText.length > 0 ||
      extraJson.length > 0;

    if (!hasSomeInput) continue;

    if (strictValidation) {
      if ((draft.type === "QUICK_REPLY" || draft.type === "URL") && !text) {
        return {
          buttons: [],
          error: `Preencha o texto do botão ${index + 1}.`,
        };
      }
      if (draft.type === "URL" && !url) {
        return {
          buttons: [],
          error: `Preencha a URL do botão ${index + 1}.`,
        };
      }
      if (draft.type === "PHONE_NUMBER" && !phoneNumber) {
        return {
          buttons: [],
          error: `Preencha o phone_number do botão ${index + 1}.`,
        };
      }
    }

    const button: Record<string, unknown> = {
      type: draft.type,
    };

    if (text) button.text = text;
    if (url) button.url = url;
    if (phoneNumber) button.phone_number = phoneNumber;

    if (exampleText) {
      try {
        button.example = JSON.parse(exampleText);
      } catch {
        button.example = exampleText;
      }
    }

    if (extraJson) {
      try {
        const extraParams = parseJsonObject(extraJson);
        if (!extraParams) {
          return {
            buttons: [],
            error: `JSON extra inválido no botão ${index + 1}. Use um objeto JSON.`,
          };
        }
        Object.assign(button, extraParams);
        button.type = draft.type;
      } catch {
        return {
          buttons: [],
          error: `JSON extra inválido no botão ${index + 1}.`,
        };
      }
    }

    buttons.push(button);
  }

  return { buttons };
}

export function getPreviewButtonLabel(button: Record<string, unknown>): string {
  const text = String(button.text || "").trim();
  if (text) return text;

  const type = String(button.type || "").toUpperCase();
  if (type === "URL") {
    const url = String(button.url || "").trim();
    return url ? `URL: ${url}` : "Abrir URL";
  }
  if (type === "PHONE_NUMBER") {
    const phoneNumber = String(button.phone_number || "").trim();
    return phoneNumber ? `Ligar: ${phoneNumber}` : "Ligar";
  }
  if (type === "COPY_CODE") return "Copiar código";
  if (type === "OTP") return "Código OTP";
  return type || "Botão";
}

export function buildDefaultDrafts(): Record<AutoMessageTypeId, AutoMessageDraft> {
  return {
    1: {
      id: null,
      texto: "",
      mensagemComplementarTexto: "",
      galeriaImagemId: null,
      galeriaImagemUrl: null,
      galeriaImagemNomeArquivo: null,
      empresaMetaParamId: null,
      ativo: false,
      habilitada: true,
    },
    2: {
      id: null,
      texto: "",
      mensagemComplementarTexto: "",
      galeriaImagemId: null,
      galeriaImagemUrl: null,
      galeriaImagemNomeArquivo: null,
      empresaMetaParamId: null,
      ativo: false,
      habilitada: true,
    },
    3: {
      id: null,
      texto: "",
      mensagemComplementarTexto: "",
      galeriaImagemId: null,
      galeriaImagemUrl: null,
      galeriaImagemNomeArquivo: null,
      empresaMetaParamId: null,
      ativo: false,
      habilitada: true,
    },
    4: {
      id: null,
      texto: "",
      mensagemComplementarTexto: "",
      galeriaImagemId: null,
      galeriaImagemUrl: null,
      galeriaImagemNomeArquivo: null,
      empresaMetaParamId: null,
      ativo: false,
      habilitada: true,
    },
    5: {
      id: null,
      texto: "",
      mensagemComplementarTexto: "",
      galeriaImagemId: null,
      galeriaImagemUrl: null,
      galeriaImagemNomeArquivo: null,
      empresaMetaParamId: null,
      ativo: false,
      habilitada: true,
    },
    6: {
      id: null,
      texto: "",
      mensagemComplementarTexto: "",
      galeriaImagemId: null,
      galeriaImagemUrl: null,
      galeriaImagemNomeArquivo: null,
      empresaMetaParamId: null,
      ativo: false,
      habilitada: true,
    },
    7: {
      id: null,
      texto: "",
      mensagemComplementarTexto: "",
      galeriaImagemId: null,
      galeriaImagemUrl: null,
      galeriaImagemNomeArquivo: null,
      empresaMetaParamId: null,
      ativo: false,
      habilitada: true,
    },
    8: {
      id: null,
      texto: "",
      mensagemComplementarTexto: "",
      galeriaImagemId: null,
      galeriaImagemUrl: null,
      galeriaImagemNomeArquivo: null,
      empresaMetaParamId: null,
      ativo: false,
      habilitada: false,
    },
  };
}

export function mapAutoMessagesToDrafts(
  messages: WhatsAutoMessage[],
): Record<AutoMessageTypeId, AutoMessageDraft> {
  const drafts = buildDefaultDrafts();

  messages.forEach((msg) => {
    const tipoId = Number(msg.tipo_id) as AutoMessageTypeId;
    if (![1, 2, 3, 4, 5, 6, 7, 8].includes(tipoId)) return;

    drafts[tipoId] = {
      id: typeof msg.id === "number" ? msg.id : null,
      texto: msg.texto || "",
      mensagemComplementarTexto: msg.mensagem_complementar_texto || "",
      galeriaImagemId:
        typeof msg.galeria_imagem_id === "number" ? msg.galeria_imagem_id : null,
      galeriaImagemUrl: msg.galeria_imagem_url || null,
      galeriaImagemNomeArquivo: msg.galeria_imagem_nome_arquivo || null,
      empresaMetaParamId:
        typeof msg.empresa_meta_param_id === "number"
          ? msg.empresa_meta_param_id
          : null,
      ativo: Boolean(msg.ativo),
      habilitada: msg.habilitada !== false,
    };
  });

  return drafts;
}

export function applySavedMessageToDrafts(
  prev: Record<AutoMessageTypeId, AutoMessageDraft>,
  saved: WhatsAutoMessage,
  fallbackTipoId: AutoMessageTypeId,
): Record<AutoMessageTypeId, AutoMessageDraft> {
  const tipoId = Number(saved.tipo_id) as AutoMessageTypeId;
  const resolvedTipoId: AutoMessageTypeId =
    [1, 2, 3, 4, 5, 6, 7, 8].includes(tipoId)
      ? tipoId
      : fallbackTipoId;

  return {
    ...prev,
    [resolvedTipoId]: {
      id: typeof saved.id === "number" ? saved.id : prev[resolvedTipoId].id,
      texto: saved.texto || prev[resolvedTipoId].texto,
      mensagemComplementarTexto:
        saved.mensagem_complementar_texto || "",
      galeriaImagemId:
        typeof saved.galeria_imagem_id === "number"
          ? saved.galeria_imagem_id
          : null,
      galeriaImagemUrl: saved.galeria_imagem_url || null,
      galeriaImagemNomeArquivo: saved.galeria_imagem_nome_arquivo || null,
      empresaMetaParamId:
        typeof saved.empresa_meta_param_id === "number"
          ? saved.empresa_meta_param_id
          : null,
      ativo: Boolean(saved.ativo),
      habilitada:
        typeof saved.habilitada === "boolean"
          ? saved.habilitada
          : prev[resolvedTipoId].habilitada,
    },
  };
}

export function extractTemplateTexts(template: MetaTemplateItem): {
  header?: string;
  body?: string;
  footer?: string;
  buttons: Array<Record<string, unknown>>;
} {
  const result: {
    header?: string;
    body?: string;
    footer?: string;
    buttons: Array<Record<string, unknown>>;
  } = { buttons: [] };

  const components = template.components as unknown;

  if (Array.isArray(components)) {
    components.forEach((component) => {
      const type = String(component?.type || "").toUpperCase();
      if (type === "HEADER" && typeof component.text === "string") {
        result.header = component.text;
      }
      if (type === "BODY" && typeof component.text === "string") {
        result.body = component.text;
      }
      if (type === "FOOTER" && typeof component.text === "string") {
        result.footer = component.text;
      }
      if (type === "BUTTONS" && Array.isArray(component.buttons)) {
        result.buttons = component.buttons
          .map((button: unknown) => {
            if (!button || typeof button !== "object") return null;
            const normalized = button as Record<string, unknown>;
            return getPreviewButtonLabel(normalized).trim()
              ? normalized
              : null;
          })
          .filter(
            (button: Record<string, unknown> | null): button is Record<string, unknown> =>
              Boolean(button),
          );
      }
    });
    return result;
  }

  if (components && typeof components === "object") {
    const normalized = components as {
      header?: { text?: string } | null;
      body?: { text?: string } | null;
      footer?: { text?: string } | null;
      buttons?: Array<{ text?: string }> | null;
    };

    if (normalized.header?.text) {
      result.header = normalized.header.text;
    }
    if (normalized.body?.text) {
      result.body = normalized.body.text;
    }
    if (normalized.footer?.text) {
      result.footer = normalized.footer.text;
    }
    if (Array.isArray(normalized.buttons)) {
      result.buttons = normalized.buttons
        .map((button) => {
          const normalizedButton = (button as Record<string, unknown>) || {};
          return getPreviewButtonLabel(normalizedButton).trim()
            ? normalizedButton
            : null;
        })
        .filter(
          (button: Record<string, unknown> | null): button is Record<string, unknown> =>
            Boolean(button),
        );
    }
  }

  return result;
}

export function getTemplateSavedHeaderMedia(
  template: MetaTemplateItem | null | undefined,
) {
  const media = template?.saved_header_media;
  if (!media || typeof media !== "object") return null;
  return media;
}

export function getTemplateSavedHeaderImageUrl(
  template: MetaTemplateItem | null | undefined,
): string {
  const media = getTemplateSavedHeaderMedia(template);
  if (!media) return "";
  if (String(media.media_type || "").toLowerCase() !== "image") return "";
  return String(media.url || "").trim();
}

export function extractTemplateVariables(text: string): string[] {
  const found = new Set<string>();
  const regex = /{{\s*(\d+)\s*}}/g;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match) {
    found.add(match[1]);
    match = regex.exec(text);
  }

  return Array.from(found).sort((a, b) => Number(a) - Number(b));
}

export function applyStyleToken(
  source: string,
  selectionStart: number,
  selectionEnd: number,
  wrapperStart: string,
  wrapperEnd = wrapperStart,
): { value: string; nextStart: number; nextEnd: number } {
  const selectedText = source.slice(selectionStart, selectionEnd);
  const safeSelectedText = selectedText || "texto";
  const nextValue =
    source.slice(0, selectionStart) +
    wrapperStart +
    safeSelectedText +
    wrapperEnd +
    source.slice(selectionEnd);

  const nextStart = selectionStart + wrapperStart.length;
  const nextEnd = nextStart + safeSelectedText.length;

  return { value: nextValue, nextStart, nextEnd };
}

export function renderWhatsAppFormattedText(text: string): ReactNode[] {
  const chunks: ReactNode[] = [];
  const tokenRegex = /```([\s\S]+?)```|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;
  let lastIndex = 0;
  let match = tokenRegex.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      chunks.push(text.slice(lastIndex, match.index));
    }

    const [fullMatch, codeText, boldText, italicText, strikeText] = match;
    const key = `fmt-${match.index}-${fullMatch.length}`;

    if (codeText !== undefined) {
      chunks.push(
        <code key={key} className="meta-template-preview-inline-code">
          {codeText}
        </code>,
      );
    } else if (boldText !== undefined) {
      chunks.push(<strong key={key}>{boldText}</strong>);
    } else if (italicText !== undefined) {
      chunks.push(<em key={key}>{italicText}</em>);
    } else if (strikeText !== undefined) {
      chunks.push(<s key={key}>{strikeText}</s>);
    }

    lastIndex = match.index + fullMatch.length;
    match = tokenRegex.exec(text);
  }

  if (lastIndex < text.length) {
    chunks.push(text.slice(lastIndex));
  }

  return chunks.length ? chunks : [text];
}

export function normalizeTemplateStatus(status?: string): string {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();

  const labels: Record<string, string> = {
    APPROVED: "Aprovado",
    PENDING: "Pendente",
    IN_REVIEW: "Em análise",
    REJECTED: "Reprovado",
    PAUSED: "Pausado",
    DISABLED: "Desativado",
    ACTIVE: "Ativo",
    DRAFT: "Rascunho",
  };

  return labels[normalized] || (status?.trim() || "-");
}

export function normalizeTemplateCategory(category?: string): string {
  const normalized = String(category || "")
    .trim()
    .toUpperCase();

  const labels: Record<string, string> = {
    MARKETING: "Marketing",
    UTILITY: "Utilidade",
    AUTHENTICATION: "Autenticação",
  };

  return labels[normalized] || (category?.trim() || "-");
}

export function getMetaAccountPrimaryLabel(
  account: MetaIntegrationAccount,
  index = 0,
): string {
  return (
    account.display_phone_number ||
    account.phone_number_id ||
    `Numero ${index + 1}`
  );
}

export function getMetaAccountSecondaryLabel(account: MetaIntegrationAccount): string {
  return (
    account.verified_name ||
    account.whatsapp_account_name ||
    account.business_name ||
    "Conta Meta"
  );
}

export function getMetaAccountTechnicalLabel(account: MetaIntegrationAccount): string {
  return account.phone_number_id || account.whatsapp_account_id || "-";
}

export function applyVariableSample(text: string, samples: Record<string, string>): string {
  return text.replace(/{{\s*(\d+)\s*}}/g, (_, variableId: string) => {
    const sample = samples[variableId]?.trim();
    return sample || `{{${variableId}}}`;
  });
}

export function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatUnixDate(value?: number): string {
  if (!value) return "-";
  return new Date(value * 1000).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

export function formatUnixDateUtc(value?: number): string {
  if (!value) return "-";
  return new Date(value * 1000).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
}

export function formatUnixToDateInput(value?: number): string {
  if (!value) return "";
  return new Date(value * 1000).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

export function getTodayDateInput(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

export function getNowInSaoPauloIso(): string {
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

  return `${formatted.replace(" ", "T")}-03:00`;
}

export function toApiDateRange(value: string, endOfDay: boolean): string {
  if (endOfDay && value === getTodayDateInput()) {
    return getNowInSaoPauloIso();
  }
  const suffix = endOfDay ? "23:59:59-03:00" : "00:00:00-03:00";
  return `${value}T${suffix}`;
}

export function flattenTemplateMetricPoints(metrics: TemplateMetricsResult | undefined): TemplateMetricDataPoint[] {
  const metricEntries = Array.isArray(metrics?.metrics) ? metrics.metrics : [];
  const points = metricEntries.flatMap((entry) =>
    Array.isArray(entry.data_points) ? entry.data_points : [],
  );

  return points.sort((a, b) => toSafeNumber(a.start) - toSafeNumber(b.start));
}

export function summarizeTemplateMetrics(points: TemplateMetricDataPoint[]) {
  return points.reduce<{
    sent: number;
    delivered: number;
    read: number;
    replied: number;
  }>(
    (acc, point) => ({
      sent: acc.sent + toSafeNumber(point.sent),
      delivered: acc.delivered + toSafeNumber(point.delivered),
      read: acc.read + toSafeNumber(point.read),
      replied: acc.replied + toSafeNumber(point.replied),
    }),
    { sent: 0, delivered: 0, read: 0, replied: 0 },
  );
}

export type MetricTypedValue = {
  type?: string;
  value?: unknown;
  count?: unknown;
  button_content?: unknown;
};

export const METRIC_TYPE_LABELS: Record<string, string> = {
  amount_spent: "Valor gasto",
  cost_per_delivered: "Custo por entregue",
  cost_per_url_button_click: "Custo por clique no botão URL",
  url_button: "Cliques no botão URL",
  unique_url_button: "Cliques únicos no botão URL",
};

export function getMetricTypeLabel(type: string): string {
  return METRIC_TYPE_LABELS[type] || type.replace(/_/g, " ");
}

export function formatMetricNumber(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function getMetricValues(
  point: TemplateMetricDataPoint,
  key: "cost" | "clicked",
): MetricTypedValue[] {
  const value = (point as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as MetricTypedValue[];
}

export function mapMetricTypedValues(values: MetricTypedValue[], valueKey: "value" | "count"): string[] {
  if (!values.length) return [];
  return values.map((item) => {
    const type = String(item.type || "unknown");
    const label = getMetricTypeLabel(type);
    const amount = toSafeNumber(item[valueKey]);
    const buttonContent =
      valueKey === "count" && item.button_content
        ? ` (${String(item.button_content)})`
        : "";
    return `${label}${buttonContent}: ${formatMetricNumber(amount)}`;
  });
}

export function aggregateTypedValues(
  points: TemplateMetricDataPoint[],
  key: "cost" | "clicked",
  valueKey: "value" | "count",
): Array<{ label: string; total: number }> {
  const map = new Map<string, number>();

  points.forEach((point) => {
    const values = getMetricValues(point, key);
    values.forEach((item) => {
      const type = String(item.type || "unknown");
      const normalizedType = getMetricTypeLabel(type);
      const buttonContent =
        key === "clicked" && item.button_content
          ? ` (${String(item.button_content)})`
          : "";
      const label = `${normalizedType}${buttonContent}`;
      map.set(label, (map.get(label) || 0) + toSafeNumber(item[valueKey]));
    });
  });

  return Array.from(map.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

export function formatDurationMs(value?: number | null): string {
  const durationMs = Number(value || 0);
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "-";

  const totalSeconds = Math.max(Math.round(durationMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}min ${seconds}s`;
}

export function buildClientBatchToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `meta-batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isTemplateBatchTerminalStatus(status?: string | null): boolean {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  return (
    normalizedStatus === "completed" ||
    normalizedStatus === "stopped_on_error" ||
    normalizedStatus === "failed"
  );
}

export function formatDispatchCurrency(
  value: number,
  currency = "USD",
): string {
  const normalizedCurrency = String(currency || "USD").trim().toUpperCase();

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  } catch {
    return `${formatMetricNumber(value)} ${normalizedCurrency}`;
  }
}

export function getBatchResultPhoneLabel(item: BatchDispatchResultItem): string {
  const normalized = String(item.numero || "").trim();
  if (normalized) return normalized;

  const original = String(item.numero_original || "").trim();
  if (original) return original;

  return "Sem numero informado";
}

export function getBatchResultTitle(item: BatchDispatchResultItem): string {
  const contactName = String(item.contato_nome || "").trim();
  if (contactName) return contactName;

  const email = String(item.email || "").trim();
  if (email) return email;

  return getBatchResultPhoneLabel(item);
}

export function getBatchResultErrorMessage(item: BatchDispatchResultItem): string {
  const explicit = String(item.error_message || "").trim();
  if (explicit) return explicit;

  const fallback = String(item.error || "").trim();
  return fallback || "Falha nao detalhada pela Meta.";
}

export function getDispatchHintSummary(template: MetaTemplateItem): {
  headerType: string;
  headerRequiresMedia: boolean;
  headerParameterIndexes: number[];
  headerParameterCount: number;
  bodyParameterIndexes: number[];
  bodyParameterCount: number;
  buttons: Array<{
    index: number;
    type: string;
    text: string;
    parameterIndexes: number[];
    parameterCount: number;
  }>;
} {
  const fallback = {
    headerType: "TEXT",
    headerRequiresMedia: false,
    headerParameterIndexes: [] as number[],
    headerParameterCount: 0,
    bodyParameterIndexes: [] as number[],
    bodyParameterCount: 0,
    buttons: [] as Array<{
      index: number;
      type: string;
      text: string;
      parameterIndexes: number[];
      parameterCount: number;
    }>,
  };

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
    return fallback;
  }

  return {
    headerType: String(components.header?.type || "TEXT").toUpperCase(),
    headerRequiresMedia: ["IMAGE", "DOCUMENT", "VIDEO"].includes(
      String(components.header?.type || "TEXT").toUpperCase(),
    ),
    headerParameterIndexes: Array.isArray(components.header?.parameter_indexes)
      ? components.header.parameter_indexes.map((item) => Number(item))
      : [],
    headerParameterCount: Array.isArray(components.header?.parameter_indexes)
      ? components.header?.parameter_indexes.length
      : 0,
    bodyParameterIndexes: Array.isArray(components.body?.parameter_indexes)
      ? components.body.parameter_indexes.map((item) => Number(item))
      : [],
    bodyParameterCount: Array.isArray(components.body?.parameter_indexes)
      ? components.body?.parameter_indexes.length
      : 0,
    buttons: Array.isArray(components.buttons)
      ? components.buttons.map((button, index) => ({
          index: Number(button?.index ?? index + 1),
          type: String(button?.type || "BUTTON"),
          text: String(button?.text || "").trim(),
          parameterIndexes: Array.isArray(button?.parameter_indexes)
            ? button.parameter_indexes.map((item) => Number(item))
            : [],
          parameterCount: Array.isArray(button?.parameter_indexes)
            ? button.parameter_indexes.length
            : 0,
        }))
      : [],
  };
}

export function formatDispatchHeaderHint(hints: ReturnType<typeof getDispatchHintSummary>): string {
  const mediaLabelByType: Record<string, string> = {
    IMAGE: "midia obrigatoria (imagem)",
    VIDEO: "midia obrigatoria (video)",
    DOCUMENT: "midia obrigatoria (documento)",
  };

  const mediaHint = hints.headerRequiresMedia
    ? mediaLabelByType[hints.headerType] || "midia obrigatoria"
    : "sem midia obrigatoria";

  if (!hints.headerParameterCount) {
    return `${hints.headerType} - ${mediaHint}`;
  }

  return `${hints.headerType} - ${hints.headerParameterCount} parametro(s) [${hints.headerParameterIndexes.join(
    ", ",
  )}] - ${mediaHint}`;
}

export function formatDispatchBodyHint(hints: ReturnType<typeof getDispatchHintSummary>): string {
  if (!hints.bodyParameterCount) {
    return "Sem variaveis";
  }

  return `${hints.bodyParameterCount} parametro(s) [${hints.bodyParameterIndexes.join(", ")}]`;
}

export function formatDispatchButtonsHint(
  hints: ReturnType<typeof getDispatchHintSummary>,
): string {
  if (!hints.buttons.length) {
    return "Nenhum";
  }

  return hints.buttons
    .map((button) => {
      const type = String(button.type || "BUTTON").toUpperCase();
      let parameterHint = "sem variaveis";

      if (button.parameterCount > 0) {
        parameterHint = `${button.parameterCount} parametro(s) [${button.parameterIndexes.join(", ")}]`;
      } else if (type === "URL") {
        parameterHint = "url fixa";
      }

      return `#${button.index} ${type} - ${parameterHint}${button.text ? ` - ${button.text}` : ""}`;
    })
    .join(" | ");
}

export type TemplateParameterKind = "manual" | "contact_field";
export type TemplateParameterStandardField = "contact_name" | "birthday" | "email";
export type TemplateParameterNameFormat = "first_name" | "full_name";

export type TemplateParameterInput = {
  kind: TemplateParameterKind;
  text: string;
  standardField: TemplateParameterStandardField | "";
  nameFormat: TemplateParameterNameFormat;
};

export const TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS: Array<{
  value: TemplateParameterStandardField;
  label: string;
}> = [
  { value: "contact_name", label: "Nome do cliente" },
  { value: "birthday", label: "Data de aniversario" },
  { value: "email", label: "Email" },
];

export function getTemplateParameterStandardFieldLabel(
  field: TemplateParameterStandardField | "",
): string {
  return (
    TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS.find(
      (option) => option.value === field,
    )?.label || "Campo do contato"
  );
}

export function getBirthdayContactFieldHelperText(
  parameterLabel: string,
  input: TemplateParameterInput,
): string {
  if (!input.standardField) {
    return `Selecione qual campo do contato deve preencher ${parameterLabel}.`;
  }

  if (input.standardField === "contact_name") {
    return input.nameFormat === "first_name"
      ? `Usa o campo Nome do cliente do contato e envia apenas o primeiro nome em ${parameterLabel}.`
      : `Usa o campo Nome do cliente do contato e envia o nome completo em ${parameterLabel}.`;
  }

  return `Usa o campo ${getTemplateParameterStandardFieldLabel(
    input.standardField,
  )} do contato para preencher ${parameterLabel}.`;
}

export function getBirthdayHeaderMediaLabel(headerType: string): string {
  const normalizedType = String(headerType || "TEXT").trim().toUpperCase();

  if (normalizedType === "IMAGE") return "imagem";
  if (normalizedType === "VIDEO") return "video";
  if (normalizedType === "DOCUMENT") return "documento";
  return "midia";
}

export function getBirthdayHeaderParameterHelperText(
  hints: ReturnType<typeof getDispatchHintSummary>,
  parameterIndex: number,
  input: TemplateParameterInput,
): string {
  const parameterLabel = `Header {{${parameterIndex}}}`;

  if (input.kind !== "contact_field") {
    if (hints.headerRequiresMedia) {
      return `Campo digitavel: informe manualmente a URL publica da ${getBirthdayHeaderMediaLabel(
        hints.headerType,
      )} usada em ${parameterLabel}.`;
    }

    return `Campo digitavel: informe manualmente o valor que sera enviado em ${parameterLabel}.`;
  }

  const contactFieldHelper = getBirthdayContactFieldHelperText(
    parameterLabel,
    input,
  );

  if (!hints.headerRequiresMedia || !input.standardField) {
    return contactFieldHelper;
  }

  return `${contactFieldHelper.slice(0, -1)}. Esse campo precisa armazenar a URL publica da ${getBirthdayHeaderMediaLabel(
    hints.headerType,
  )}.`;
}

export function getBirthdayBodyParameterHelperText(
  parameterIndex: number,
  input: TemplateParameterInput,
): string {
  const parameterLabel = `Body {{${parameterIndex}}}`;

  if (input.kind !== "contact_field") {
    return `Campo digitavel: informe manualmente o valor que sera enviado em ${parameterLabel}.`;
  }

  return getBirthdayContactFieldHelperText(parameterLabel, input);
}

export function getBirthdayButtonParameterHelperText(
  button: ReturnType<typeof getDispatchHintSummary>["buttons"][number],
  parameterIndex: number,
  input: TemplateParameterInput,
): string {
  const parameterLabel = `Botao {{${parameterIndex}}}`;
  const buttonType = String(button.type || "BUTTON").trim().toUpperCase();

  if (input.kind !== "contact_field") {
    if (buttonType === "URL") {
      return `Campo digitavel: informe manualmente o valor dinamico que completa o link usado em ${parameterLabel}.`;
    }

    return `Campo digitavel: informe manualmente o valor que sera enviado em ${parameterLabel}.`;
  }

  const contactFieldHelper = getBirthdayContactFieldHelperText(
    parameterLabel,
    input,
  );

  if (buttonType !== "URL" || !input.standardField) {
    return contactFieldHelper;
  }

  return `${contactFieldHelper.slice(0, -1)}. Esse campo precisa armazenar o valor dinamico que completa o link do botao.`;
}

export function createEmptyTemplateParameterInput(): TemplateParameterInput {
  return {
    kind: "manual",
    text: "",
    standardField: "",
    nameFormat: "full_name",
  };
}

export function createTemplateParameterInputs(length: number): TemplateParameterInput[] {
  return Array.from({ length }, () => createEmptyTemplateParameterInput());
}

export function mapTemplateParameterInputToPayload(input: TemplateParameterInput): unknown | null {
  if (input.kind === "contact_field") {
    if (!input.standardField) {
      return null;
    }

    return {
      type: "text",
      parameter_source: "contact_field",
      field: input.standardField,
      name_format:
        input.standardField === "contact_name" ? input.nameFormat : undefined,
    };
  }

  const normalizedText = input.text.trim();
  return normalizedText ? normalizedText : null;
}

export function mapTemplateParameterPayloadToInput(value: unknown): TemplateParameterInput {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const source = String(
      (value as Record<string, unknown>).parameter_source || "",
    )
      .trim()
      .toLowerCase();
    const field = String((value as Record<string, unknown>).field || "")
      .trim()
      .toLowerCase();

    if (source === "contact_field") {
      const standardField =
        field === "contact_name" || field === "birthday" || field === "email"
          ? field
          : "";
      return {
        kind: "contact_field",
        text: "",
        standardField,
        nameFormat:
          String((value as Record<string, unknown>).name_format || "")
            .trim()
            .toLowerCase() === "first_name"
            ? "first_name"
            : "full_name",
      };
    }

    if (
      Object.prototype.hasOwnProperty.call(value as Record<string, unknown>, "text")
    ) {
      return {
        kind: "manual",
        text: String((value as Record<string, unknown>).text || ""),
        standardField: "",
        nameFormat: "full_name",
      };
    }
  }

  return {
    kind: "manual",
    text:
      value === null || value === undefined
        ? ""
        : typeof value === "string"
          ? value
          : String(value),
    standardField: "",
    nameFormat: "full_name",
  };
}

export function mapTemplateParameterPayloadArrayToInputs(
  values: unknown[],
): TemplateParameterInput[] {
  if (!Array.isArray(values)) return [];
  return values.map(mapTemplateParameterPayloadToInput);
}

export function mapTemplateButtonPayloadArrayToInputs(
  values: Array<{ index?: number; parameters?: unknown[] }>,
): Record<number, TemplateParameterInput[]> {
  if (!Array.isArray(values)) return {};

  return values.reduce<Record<number, TemplateParameterInput[]>>((acc, item) => {
    const buttonIndex = Number(item?.index);
    if (!Number.isFinite(buttonIndex)) {
      return acc;
    }

    acc[buttonIndex + 1] = mapTemplateParameterPayloadArrayToInputs(
      Array.isArray(item?.parameters) ? item.parameters : [],
    );
    return acc;
  }, {});
}

export function ensureTemplateParameterInputsLength(
  current: TemplateParameterInput[],
  length: number,
): TemplateParameterInput[] {
  const safeLength = Math.max(Number(length) || 0, 0);
  return Array.from({ length: safeLength }, (_, index) => {
    return current[index] || createEmptyTemplateParameterInput();
  });
}

export function normalizeTimeInputValue(value: string | null | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized) return "09:00";

  const match = normalized.match(/^(\d{2}):(\d{2})/);
  if (!match) return "09:00";
  return `${match[1]}:${match[2]}`;
}


