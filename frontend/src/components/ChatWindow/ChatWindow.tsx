import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FiAlertCircle,
  FiArrowDown,
  FiArrowLeft,
  FiArrowUp,
  FiCamera,
  FiChevronDown,
  FiCheck,
  FiCheckSquare,
  FiClock,
  FiCopy,
  FiCornerUpLeft,
  FiCpu,
  FiDownload,
  FiEdit2,
  FiFilm,
  FiFileText,
  FiGlobe,
  FiGrid,
  FiImage,
  FiInfo,
  FiMapPin,
  FiMail,
  FiMic,
  FiPackage,
  FiPaperclip,
  FiPhone,
  FiSmile,
  FiPlus,
  FiRepeat,
  FiSend,
  FiUser,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import type {
  Branch,
  Conversation,
  Message,
  TemplateMessageData,
} from "../../data/mockData";
import { useCommands } from "../../contexts/CommandsContext";
import type {
  Command,
  QuickMessageContentItem,
  QuickMessageMediaType,
  QuickMessageSequenceItem,
} from "../../contexts/CommandsContext";
import { useShortcuts } from "../../contexts/ShortcutsContext";
import { encrypt, decrypt } from "../../utils/cripto";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { formatPhoneForInput } from "../../utils/phone";
import { appSafetyService } from "../../service/appSafetyService";
import { AudioRecorder } from "../AudioRecorder/AudioRecorder";
import { CameraCapture } from "../CameraCapture/CameraCapture";
import { Modal } from "../common/Modal/Modal";
import { Avatar } from "../common/Avatar/Avatar";
import { ChatImageViewer } from "./ChatImageViewer";
import "./ChatWindow.css";

interface ChatWindowProps {
  conversation: Conversation;
  onSendMessage: (conversationId: number, text: string) => void;
  onBack: () => void;
  onInfoClick: () => void;
  onFinalizeChat: (conversationId: number) => void;
  isLocked?: boolean;
  children?: ReactNode;
  readOnly?: boolean;
  refreshSignal?: number;
  socketConnected?: boolean;
  isMetaWindowExpired?: boolean;
  isAwaitingTemplateReply?: boolean;
  metaWindowExpiresAt?: string | null;
  metaWindowMessage?: string;
  quickMessagesEnabled?: boolean;
  showTransferButton?: boolean;
  onTransferAttendant?: () => void;
  showProductGalleryButton?: boolean;
  onOpenProductGallery?: () => void;
  showDocumentGalleryButton?: boolean;
  onOpenDocumentGallery?: () => void;
  onAnalyzeConversationIa?: () => void;
  composerPrefillText?: string;
  composerPrefillToken?: number;
  onComposerPrefillConsumed?: () => void;
  readOnlyStatusLabel?: string;
  readOnlyAttendanceLabel?: string;
  readOnlyFooterTitle?: string;
  readOnlyFooterDescription?: string;
  readOnlyFooterActions?: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
    tone?: "default" | "danger";
  }>;
  onOpenTemplateDispatch?: () => void;
}

function isAbsoluteUrl(value?: string | null) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function formatConversationPhoneLabel(value?: string | null) {
  const localDigits = formatPhoneForInput(value);
  const digits = String(localDigits || "").replace(/\D/g, "");

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return String(value || "").trim();
}

function buildApiMediaUrl(path?: string | null) {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) return undefined;
  if (isAbsoluteUrl(normalizedPath)) return normalizedPath;

  if (normalizedPath.startsWith("/")) {
    return `${API_BASE}${normalizedPath}`;
  }

  return `${API_BASE}/${normalizedPath.replace(/^\.?\//, "")}`;
}

type QuickMessageReviewDraft = {
  commandName: string;
  texts: string[];
  images: QuickMessageContentItem[];
  documents: QuickMessageContentItem[];
  audios: QuickMessageContentItem[];
  videos: QuickMessageContentItem[];
  sequence: QuickMessageSequenceItem[];
};

function getQuickMessageReviewMedia(
  draft: QuickMessageReviewDraft,
  type: QuickMessageMediaType,
  id?: number,
) {
  const collection =
    type === "image"
      ? draft.images
      : type === "document"
        ? draft.documents
        : type === "audio"
          ? draft.audios
          : draft.videos;
  return collection.find((item) => Number(item.id) === Number(id));
}

function buildMetaReferralVideoPreviewUrl(
  path: string | null | undefined,
  empresaId?: number | null,
) {
  const resolvedUrl = buildApiMediaUrl(path);
  if (!resolvedUrl) return undefined;

  if (!isAbsoluteUrl(resolvedUrl) || !empresaId) {
    return resolvedUrl;
  }

  try {
    const proxyUrl = new URL(
      `${API_BASE}/atendimento/meta_referral_media/${empresaId}`,
      window.location.origin,
    );
    proxyUrl.searchParams.set("url", resolvedUrl);
    return proxyUrl.toString();
  } catch {
    return resolvedUrl;
  }
}

function appendPlaybackFormatParam(
  mediaUrl: string | undefined,
  format?: string | null,
) {
  const normalizedMediaUrl = String(mediaUrl || "").trim();
  const normalizedFormat = String(format || "").trim().toLowerCase();

  if (!normalizedMediaUrl || !normalizedFormat) {
    return mediaUrl;
  }

  try {
    const resolvedUrl = new URL(normalizedMediaUrl, window.location.origin);
    resolvedUrl.searchParams.set("format", normalizedFormat);
    return resolvedUrl.toString();
  } catch {
    return mediaUrl;
  }
}

function isMobileCameraDevice() {
  if (typeof navigator === "undefined") return false;

  const nav = navigator as Navigator & {
    userAgentData?: {
      mobile?: boolean;
    };
  };
  const userAgent = navigator.userAgent || "";
  const mobileByUserAgent =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent,
    );
  const mobileByUserAgentData =
    typeof nav.userAgentData?.mobile === "boolean"
      ? nav.userAgentData.mobile
      : false;

  return mobileByUserAgent || mobileByUserAgentData;
}

type StructuredLocationPayload = {
  latitude?: number | null;
  longitude?: number | null;
  name?: string | null;
  address?: string | null;
  url?: string | null;
};

type StructuredContactPayload = {
  name?:
    | string
    | {
        formatted_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }
    | null;
  formatted_name?: string | null;
  first_name?: string | null;
  phones?: Array<{
    phone?: string | null;
    wa_id?: string | null;
    type?: string | null;
  }>;
  emails?: Array<{
    email?: string | null;
    type?: string | null;
  }>;
  urls?: Array<{
    url?: string | null;
    type?: string | null;
  }>;
  org?: {
    company?: string | null;
    department?: string | null;
    title?: string | null;
  } | null;
};

type StructuredContactsPayload = {
  contacts?: StructuredContactPayload[];
};

type StructuredMetaReferralPayload = {
  kind?: "meta_referral";
  source_url?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  headline?: string | null;
  body?: string | null;
  media_type?: string | null;
  image_url?: string | null;
  video_url?: string | null;
};

type DeliveryStatus = "pending" | "sent" | "delivered" | "read" | "failed";
type FetchMessagesMode = "reset" | "delta" | "before" | "tail";

type ConversationCursor = {
  timestamp: string;
  sortId: number;
};

type ChatWindowMessage = Message & {
  cursorSortId: number;
  cursorTimestamp: string;
  replyMessageId?: number;
  externalMessageId?: string;
  isOptimistic?: boolean;
  messageUserId?: number;
  agentAvatarUrl?: string;
  isSystemGenerated?: boolean;
  deleted?: boolean;
  deletedAt?: Date;
};
type ConversationGalleryMessage = Extract<ChatWindowMessage, { type: "media" }>;

type ConversationGalleryFilter = "all" | "image" | "video" | "audio" | "document";

type MessageReactionMap = Record<string, string>;

function readStoredMessageReactions(storageKey: string): MessageReactionMap {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    return Object.fromEntries(Object.entries(stored).filter(([id, emoji]) => /^\d+$/.test(id) && typeof emoji === "string" && emoji.length > 0));
  } catch {
    return {};
  }
}
type MessageMenuDirection = "up" | "down";
type PendingComposerFile = {
  id: string;
  file: File;
};

const COMMON_MESSAGE_REACTIONS = [
  "\u{1F44D}",
  "\u{2764}\u{FE0F}",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F64F}",
];

const COMMON_COMPOSER_EMOJIS = [
  "\u{1F600}",
  "\u{1F603}",
  "\u{1F604}",
  "\u{1F601}",
  "\u{1F642}",
  "\u{1F643}",
  "\u{1F609}",
  "\u{1F60A}",
  "\u{1F60D}",
  "\u{1F970}",
  "\u{1F618}",
  "\u{1F60E}",
  "\u{1F923}",
  "\u{1F602}",
  "\u{1F605}",
  "\u{1F917}",
  "\u{1F914}",
  "\u{1F610}",
  "\u{1F615}",
  "\u{1F641}",
  "\u{1F62D}",
  "\u{1F62E}",
  "\u{1F631}",
  "\u{1F634}",
  "\u{1F44D}",
  "\u{1F44E}",
  "\u{1F44F}",
  "\u{1F44C}",
  "\u{270C}\u{FE0F}",
  "\u{1F91D}",
  "\u{1F64F}",
  "\u{2764}\u{FE0F}",
  "\u{1F49A}",
  "\u{1F499}",
  "\u{1F49B}",
  "\u{1F389}",
  "\u{2705}",
  "\u{274C}",
  "\u{26A0}\u{FE0F}",
  "\u{2757}",
  "\u{2753}",
  "\u{23F0}",
  "\u{1F4C5}",
  "\u{1F4CC}",
  "\u{1F4DE}",
  "\u{1F4F2}",
  "\u{1F4E7}",
  "\u{1F4DD}",
  "\u{1F4AA}",
  "\u{1F525}",
  "\u{1F4A1}",
  "\u{1F4B0}",
  "\u{1F4B3}",
  "\u{1F9FE}",
  "\u{1F6D2}",
  "\u{1F3F7}\u{FE0F}",
  "\u{1F69A}",
  "\u{1F4E6}",
  "\u{1F381}",
  "\u{1F680}",
];

const MESSAGE_TEXT_COLLAPSE_CHAR_LIMIT = 700;
const MESSAGE_TEXT_COLLAPSE_LINE_LIMIT = 10;
const MAX_COMPOSER_ATTACHMENTS = 5;
const MAX_HOSTED_ATTACHMENT_BYTES = 100 * 1024 * 1024;
const AUDIO_PLAYBACK_RATES = [1, 1.5, 2] as const;

function getMetaAttachmentLimit(file: File) {
  const mime = String(file.type || "").toLowerCase();
  if (mime === "image/webp") return 100 * 1024;
  if (mime.startsWith("image/")) return 5 * 1024 * 1024;
  if (mime.startsWith("video/") || mime.startsWith("audio/")) return 16 * 1024 * 1024;
  return 100 * 1024 * 1024;
}

function willSendAttachmentAsLink(file: File) {
  return file.size > getMetaAttachmentLimit(file);
}

function normalizeChatText(value?: string | null) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  const decodeCodePoint = (match: string, code: string, radix: number) => {
    const codePoint = Number.parseInt(code, radix);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : match;
  };

  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/&#x([0-9a-f]+);/gi, (match, code: string) =>
      decodeCodePoint(match, code, 16),
    )
    .replace(/&#(\d+);/g, (match, code: string) =>
      decodeCodePoint(match, code, 10),
    )
    .replace(/&(amp|apos|gt|lt|nbsp|quot);/gi, (_match, entity: string) =>
      namedEntities[entity.toLowerCase()] || _match,
    );
}

function renderWhatsAppText(value?: string | null) {
  const normalizedText = normalizeChatText(value);
  const tokenPattern = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

  return normalizedText.split(tokenPattern).map((part, index) => {
    const key = `${index}-${part.slice(0, 12)}`;

    if (part.startsWith("```") && part.endsWith("```")) {
      return <code key={key}>{part.slice(3, -3)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <strong key={key}>{part.slice(1, -1)}</strong>;
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("~") && part.endsWith("~")) {
      return <s key={key}>{part.slice(1, -1)}</s>;
    }

    return part;
  });
}

function ChatAudioPlayer({
  mediaUrl,
  messageId,
}: {
  mediaUrl?: string;
  messageId: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackRate, setPlaybackRate] = useState<
    (typeof AUDIO_PLAYBACK_RATES)[number]
  >(1);

  const handlePlaybackRateChange = () => {
    const currentIndex = AUDIO_PLAYBACK_RATES.indexOf(playbackRate);
    const nextRate =
      AUDIO_PLAYBACK_RATES[(currentIndex + 1) % AUDIO_PLAYBACK_RATES.length];

    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
      audioRef.current.defaultPlaybackRate = nextRate;
    }
  };

  return (
    <div className="chat-audio-player">
      <audio
        ref={audioRef}
        key={mediaUrl || messageId}
        src={mediaUrl}
        controls
        preload="metadata"
        className="audio"
      >
        {mediaUrl ? (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
            Abrir audio
          </a>
        ) : null}
      </audio>
      <button
        type="button"
        className="chat-audio-player__speed"
        onClick={handlePlaybackRateChange}
        aria-label={`Velocidade do audio: ${playbackRate}x`}
        title="Alterar velocidade do audio"
      >
        {playbackRate}x
      </button>
    </div>
  );
}

const FETCH_MODE_PRIORITY: Record<FetchMessagesMode, number> = {
  delta: 1,
  tail: 2,
  before: 3,
  reset: 4,
};

function normalizeMessageDeliveryStatus(value?: unknown): DeliveryStatus | undefined {
  if (value === null || value === undefined) return undefined;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;

  switch (normalized) {
    case "0":
    case "accepted":
    case "pending":
    case "processing":
    case "queued":
      return "pending";
    case "1":
    case "sent":
      return "sent";
    case "2":
    case "delivered":
      return "delivered";
    case "3":
    case "read":
      return "read";
    case "4":
    case "failed":
      return "failed";
    default:
      return undefined;
  }
}

function getMessageDeliveryStatusLabel(
  status?: DeliveryStatus,
  fallback?: string | null,
) {
  switch (status) {
    case "pending":
      return "Enviando";
    case "sent":
      return "Enviado";
    case "delivered":
      return "Recebido";
    case "read":
      return "Visto";
    case "failed":
      return "Falhou";
    default:
      return String(fallback || "").trim();
  }
}

function parseTemplateMessageData(raw: unknown): TemplateMessageData | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const candidate = raw as TemplateMessageData;
  if (candidate.kind !== "template") {
    return undefined;
  }

  return candidate;
}

function resolveAgentAvatarUrl(message: {
  sender: "customer" | "agent";
  agentAvatarUrl?: string;
}) {
  if (message.sender !== "agent") return undefined;

  const normalizedImageUrl = String(message.agentAvatarUrl || "").trim();
  if (normalizedImageUrl) {
    return normalizedImageUrl;
  }

  return undefined;
}

function renderMessageDeliveryStatus(
  status?: DeliveryStatus,
  fallback?: string | null,
) {
  const label = getMessageDeliveryStatusLabel(status, fallback);
  if (!label) return null;
  const tooltip = (
    <span className="message-status-tooltip" role="tooltip">
      <span className="tooltip-title">{label}</span>
    </span>
  );

  if (status === "pending") {
    return (
      <span className="message-status-indicator message-status-indicator--pending">
        <FiClock size={11} />
        {tooltip}
      </span>
    );
  }

  if (status === "sent") {
    return (
      <span className="message-status-indicator message-status-indicator--sent">
        <FiCheck size={12} />
        {tooltip}
      </span>
    );
  }

  if (status === "delivered" || status === "read") {
    return (
      <span
        className={`message-status-indicator message-status-indicator--double message-status-indicator--${status}`}
      >
        <FiCheck className="message-status-indicator__check message-status-indicator__check--first" size={12} />
        <FiCheck className="message-status-indicator__check message-status-indicator__check--second" size={12} />
        {tooltip}
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="message-status-indicator message-status-indicator--failed">
        <FiAlertCircle size={12} />
        {tooltip}
      </span>
    );
  }

  return <span className="message-status-text">{label}</span>;
}

function renderEditedBadge(edited?: boolean) {
  if (!edited) return null;
  return <span className="message-edited-badge">Editada</span>;
}

function renderDeletedBadge(deleted?: boolean) {
  if (!deleted) return null;
  return <span className="message-deleted-badge">Apagada</span>;
}

function normalizeCursorTimestamp(value?: Date | string | number | null) {
  const date =
    value instanceof Date
      ? value
      : parseChatTimestamp(value ?? "1970-01-01T00:00:00.000Z");
  return Number.isNaN(date.getTime())
    ? "1970-01-01T00:00:00.000Z"
    : date.toISOString();
}

function normalizeMessageCursorTimestamp(value?: Date | string | number | null) {
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return "1970-01-01T00:00:00.000Z";

    const parsed = parseChatTimestamp(raw);
    if (Number.isNaN(parsed.getTime())) {
      return "1970-01-01T00:00:00.000Z";
    }

    const normalizedRaw = raw.replace(" ", "T");
    if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalizedRaw)) {
      return parsed.toISOString();
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalizedRaw)) {
      return `${normalizedRaw}:00.000`;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalizedRaw)) {
      return `${normalizedRaw}.000`;
    }

    const fractionalMatch = normalizedRaw.match(
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{1,3})$/,
    );
    if (fractionalMatch) {
      return `${fractionalMatch[1]}.${fractionalMatch[2].padEnd(3, "0")}`;
    }
  }

  return normalizeCursorTimestamp(value);
}

function normalizeCursorSortId(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : Math.trunc(fallback);
}

function getConversationCursor(message: {
  id: number | string;
  cursorSortId?: number;
  cursorTimestamp?: string;
  timestamp?: Date;
}): ConversationCursor {
  return {
    timestamp: message.cursorTimestamp
      ? String(message.cursorTimestamp)
      : normalizeCursorTimestamp(message.timestamp || null),
    sortId: normalizeCursorSortId(message.cursorSortId, Number(message.id) || 0),
  };
}

function compareConversationCursor(a: ConversationCursor, b: ConversationCursor) {
  const timeDiff =
    parseChatTimestamp(a.timestamp).getTime() -
    parseChatTimestamp(b.timestamp).getTime();
  if (timeDiff !== 0) return timeDiff;
  return a.sortId - b.sortId;
}

function sortConversationMessages(messages: ChatWindowMessage[]) {
  return [...messages].sort((left, right) =>
    compareConversationCursor(
      getConversationCursor(left),
      getConversationCursor(right),
    ),
  );
}

function normalizeOptimisticMatchText(value: unknown) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function isOptimisticReplacedByPersisted(
  optimistic: ChatWindowMessage,
  persisted: ChatWindowMessage,
) {
  if (!optimistic.isOptimistic || persisted.isOptimistic) {
    return false;
  }

  if (optimistic.type === "event" || persisted.type === "event") {
    return false;
  }

  if (optimistic.sender !== persisted.sender || optimistic.type !== persisted.type) {
    return false;
  }

  if (optimistic.type === "chat" && persisted.type === "chat") {
    const optimisticText = normalizeOptimisticMatchText(optimistic.text);
    const persistedText = normalizeOptimisticMatchText(persisted.text);
    if (!optimisticText || optimisticText !== persistedText) {
      return false;
    }
  }

  if (optimistic.type === "media" && persisted.type === "media") {
    if (optimistic.mediaType !== persisted.mediaType) {
      return false;
    }

    const optimisticCaption = normalizeOptimisticMatchText(optimistic.caption);
    const persistedCaption = normalizeOptimisticMatchText(persisted.caption);
    if (optimisticCaption !== persistedCaption) {
      return false;
    }
  }

  const optimisticTime = optimistic.timestamp?.getTime?.() ?? NaN;
  const persistedTime = persisted.timestamp?.getTime?.() ?? NaN;
  if (!Number.isFinite(optimisticTime) || !Number.isFinite(persistedTime)) {
    return false;
  }

  return Math.abs(persistedTime - optimisticTime) <= 2 * 60 * 1000;
}

function mergeConversationMessages(
  current: ChatWindowMessage[],
  incoming: ChatWindowMessage[],
) {
  const merged = new Map<number, ChatWindowMessage>();
  current.forEach((message) => {
    merged.set(Number(message.id), message);
  });

  incoming.forEach((message) => {
    if (!message.isOptimistic) {
      for (const [messageId, existing] of merged.entries()) {
        if (isOptimisticReplacedByPersisted(existing, message)) {
          merged.delete(messageId);
          break;
        }
      }
    }

    merged.set(Number(message.id), message);
  });

  return sortConversationMessages(Array.from(merged.values()));
}

function getLatestPersistedMessage(messages: ChatWindowMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (!messages[index]?.isOptimistic) {
      return messages[index];
    }
  }
  return null;
}

function parseChatTimestamp(value: Date | string | number | null | undefined) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    return new Date(value);
  }

  const raw = String(value ?? "").trim();
  if (!raw) {
    return new Date("");
  }

  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)) {
    return new Date(raw);
  }

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/,
  );

  if (match) {
    const [, yyyy, mm, dd, hh = "00", min = "00", ss = "00", ms = "0"] = match;
    return new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss),
      Number(ms.padEnd(3, "0")),
    );
  }

  return new Date(raw);
}

function normalizeStructuredMediaType(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "voice" ||
    normalized === "ptt" ||
    normalized.startsWith("audio/")
  ) {
    return "audio";
  }
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";
  if (
    normalized.startsWith("application/") ||
    normalized === "document" ||
    normalized === "file"
  ) {
    return "document";
  }
  if (normalized === "contact") return "contacts";
  return normalized;
}

function isStructuredMediaType(value?: string | null) {
  const normalized = normalizeStructuredMediaType(value);
  return (
    normalized === "location" ||
    normalized === "contacts" ||
    normalized === "meta_referral"
  );
}

function isTextLikeLegacyMediaType(value?: string | null) {
  const normalized = normalizeStructuredMediaType(value);
  return (
    normalized === "button" ||
    normalized === "interactive" ||
    normalized === "reaction"
  );
}

function parseStructuredMediaPayload(raw: unknown) {
  if (!raw) return null;

  try {
    return JSON.parse(String(raw));
  } catch (error) {
    console.warn("Nao foi possivel interpretar payload estruturado da mensagem.", error);
    return null;
  }
}

function readLocationPayload(data: unknown): StructuredLocationPayload | null {
  if (!data || typeof data !== "object") return null;
  return data as StructuredLocationPayload;
}

function readContactsPayload(data: unknown): StructuredContactsPayload | null {
  if (!data || typeof data !== "object") return null;
  return data as StructuredContactsPayload;
}

function readMetaReferralPayload(data: unknown): StructuredMetaReferralPayload | null {
  if (!data || typeof data !== "object") return null;
  return data as StructuredMetaReferralPayload;
}

function looksLikeDirectVideoUrl(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;

  return (
    /\.(mp4|m4v|webm|mov)(?:[\?#].*)?$/i.test(normalized) ||
    normalized.includes("video.xx.fbcdn.net") ||
    normalized.includes(".fbcdn.net")
  );
}

function parseLegacyMetaReferralPayload(
  text?: string | null,
): StructuredMetaReferralPayload | null {
  const normalizedText = String(text || "").trim();
  if (!normalizedText.startsWith("[Meta Ads]")) return null;

  const payload: StructuredMetaReferralPayload = {
    kind: "meta_referral",
  };

  normalizedText.split(/\r?\n/).forEach((line) => {
    const normalizedLine = line.trim();
    if (!normalizedLine) return;

    if (/^Titulo:/i.test(normalizedLine)) {
      payload.headline = normalizedLine.replace(/^Titulo:\s*/i, "").trim() || null;
      return;
    }

    if (/^Descricao:/i.test(normalizedLine)) {
      payload.body = normalizedLine.replace(/^Descricao:\s*/i, "").trim() || null;
      return;
    }

    if (/^Tipo de origem:/i.test(normalizedLine)) {
      payload.source_type =
        normalizedLine.replace(/^Tipo de origem:\s*/i, "").trim() || null;
      return;
    }

    if (/^Source ID:/i.test(normalizedLine)) {
      payload.source_id = normalizedLine.replace(/^Source ID:\s*/i, "").trim() || null;
      return;
    }

    if (/^Source URL:/i.test(normalizedLine)) {
      payload.source_url =
        normalizedLine.replace(/^Source URL:\s*/i, "").trim() || null;
      return;
    }

    if (/^Midia:/i.test(normalizedLine)) {
      payload.media_type = normalizedLine.replace(/^Midia:\s*/i, "").trim() || null;
      return;
    }

    if (/^Imagem:/i.test(normalizedLine)) {
      payload.image_url = normalizedLine.replace(/^Imagem:\s*/i, "").trim() || null;
      return;
    }

    if (/^Video:/i.test(normalizedLine)) {
      payload.video_url = normalizedLine.replace(/^Video:\s*/i, "").trim() || null;
    }
  });

  return Object.values(payload).some(Boolean)
    ? payload
    : {
        kind: "meta_referral",
      };
}

function normalizeContactDisplayName(contact: StructuredContactPayload, fallback: string) {
  const rawName = contact.name;

  if (typeof rawName === "string") {
    const normalizedName = rawName.trim();
    if (normalizedName) return normalizedName;
  }

  if (rawName && typeof rawName === "object") {
    const nestedName = [
      rawName.formatted_name,
      [rawName.first_name, rawName.last_name].filter(Boolean).join(" ").trim(),
      rawName.first_name,
    ]
      .map((value) => String(value || "").trim())
      .find(Boolean);

    if (nestedName) return nestedName;
  }

  const normalizedFormattedName = String(contact.formatted_name || "").trim();
  if (normalizedFormattedName) return normalizedFormattedName;

  const normalizedFirstName = String(contact.first_name || "").trim();
  if (normalizedFirstName) return normalizedFirstName;

  return fallback;
}

function buildMapUrl(latitude?: number | null, longitude?: number | null) {
  if (
    typeof latitude !== "number" ||
    Number.isNaN(latitude) ||
    typeof longitude !== "number" ||
    Number.isNaN(longitude)
  ) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

const locationMarkerIcon = L.divIcon({
  className: "chat-location-marker",
  html: '<span></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function buildReplyPreview(
  replyText?: string | null,
  replyMediaType?: string | null,
) {
  const normalizedText = String(replyText || "").trim();
  if (normalizedText) {
    return {
      text: normalizedText,
      mediaType: String(replyMediaType || "").trim() || undefined,
    };
  }

  const normalizedMediaType = String(replyMediaType || "").trim();
  if (normalizedMediaType) {
    return {
      text: `[${normalizedMediaType}]`,
      mediaType: normalizedMediaType,
    };
  }

  return undefined;
}

function getMessageActionText(message: ChatWindowMessage) {
  if (message.type === "chat") {
    return String(message.text || "").trim();
  }

  if (message.type === "media") {
    const caption = String(message.caption || "").trim();
    if (caption && !isPlaceholderMediaCaption(caption, message.mediaType)) {
      return caption;
    }

    const fileName = String(message.fileName || "").trim();
    if (fileName) return fileName;

    return `[${message.mediaType}]`;
  }

  return "";
}

function getMessageReplyText(message: ChatWindowMessage) {
  const text = getMessageActionText(message);
  if (text) return text;
  return "Mensagem";
}

function getMessageExternalId(raw: Record<string, unknown>) {
  const value =
    raw.message_id ??
    raw.messageId ??
    raw.externalMessageId ??
    raw.wamid ??
    raw.whatsapp_message_id ??
    raw.meta_message_id ??
    raw.id_mensagem_meta;

  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function buildReplyPayload(message?: ChatWindowMessage | null) {
  if (!message) return {};

  const replyText = getMessageReplyText(message);
  const replyMediaType = message.type === "media" ? message.mediaType : undefined;
  const payload: Record<string, string | number> = {
    mensagem_reply_id: message.id,
    reply_to_message_id: message.id,
    replyText,
  };

  if (replyMediaType) {
    payload.replyMediaType = replyMediaType;
    payload.reply_media_type = replyMediaType;
  }

  if (message.externalMessageId) {
    payload.reply_external_message_id = message.externalMessageId;
    payload.reply_meta_message_id = message.externalMessageId;
    payload.context_message_id = message.externalMessageId;
  }

  return payload;
}

function appendReplyFormData(
  formData: FormData,
  message?: ChatWindowMessage | null,
) {
  const replyPayload = buildReplyPayload(message);
  Object.entries(replyPayload).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
}

function isPlaceholderMediaCaption(
  caption?: string | null,
  mediaType?: string | null,
) {
  const normalizedCaption = String(caption || "").trim().toLowerCase();
  const normalizedMediaType = String(mediaType || "").trim().toLowerCase();

  if (!normalizedCaption || !normalizedMediaType) {
    return false;
  }

  return (
    normalizedCaption === `[${normalizedMediaType}]` ||
    normalizedCaption === "[media]" ||
    normalizedCaption === "[arquivo]"
  );
}

function resolveMessageMediaUrl(params: {
  conversationId?: number | null;
  empresaId?: number | null;
  mediaType?: string | null;
  mediaUrl?: string | null;
  mediaId?: string | number | null;
}) {
  if (isStructuredMediaType(params.mediaType)) {
    return undefined;
  }

  const normalizedMediaType = String(params.mediaType || "").trim().toLowerCase();
  const shouldUseAudioFallback = normalizedMediaType === "audio";
  const directMediaUrl = buildApiMediaUrl(params.mediaUrl);
  if (directMediaUrl) {
    return shouldUseAudioFallback
      ? appendPlaybackFormatParam(directMediaUrl, "mp3")
      : directMediaUrl;
  }

  const mediaId = String(params.mediaId ?? "").trim();
  if (!mediaId || !params.empresaId) {
    return undefined;
  }

  if (isAbsoluteUrl(mediaId)) {
    return mediaId;
  }

  if (mediaId.startsWith("/")) {
    return `${API_BASE}${mediaId}`;
  }

  const downloadUrl = new URL(
    `${API_BASE}/atendimento/download/${params.empresaId}/${mediaId}`,
    window.location.origin,
  );

  if (params.conversationId) {
    downloadUrl.searchParams.set("conversa_id", String(params.conversationId));
  }

  if (shouldUseAudioFallback) {
    downloadUrl.searchParams.set("format", "mp3");
  }

  return downloadUrl.toString();
}

export function ChatWindow({
  conversation,
  onBack,
  onInfoClick,
  onFinalizeChat,
  isLocked = false,
  children,
  readOnly = false,
  refreshSignal = 0,
  socketConnected = false,
  isMetaWindowExpired = false,
  isAwaitingTemplateReply = false,
  metaWindowExpiresAt = null,
  metaWindowMessage = "",
  quickMessagesEnabled = true,
  showTransferButton = false,
  onTransferAttendant,
  showProductGalleryButton = false,
  onOpenProductGallery,
  showDocumentGalleryButton = false,
  onOpenDocumentGallery,
  onAnalyzeConversationIa,
  composerPrefillText = "",
  composerPrefillToken = 0,
  onComposerPrefillConsumed,
  readOnlyStatusLabel = "Finalizado",
  readOnlyAttendanceLabel = "Finalizado por:",
  readOnlyFooterTitle = "Atendimento finalizado",
  readOnlyFooterDescription = "O historico permanece disponivel para consulta e revisão.",
  readOnlyFooterActions = [],
  onOpenTemplateDispatch,
}: ChatWindowProps) {
  const { commands, refreshCommands } = useCommands();
  const { messageInputRef } = useShortcuts();
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [isMediaSheetOpen, setIsMediaSheetOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isHeaderDetailsOpen, setIsHeaderDetailsOpen] = useState(false);
  const [isConversationGalleryOpen, setIsConversationGalleryOpen] = useState(false);
  const [isConversationGalleryLoading, setIsConversationGalleryLoading] = useState(false);
  const [conversationGalleryError, setConversationGalleryError] = useState("");
  const [conversationGalleryFilter, setConversationGalleryFilter] =
    useState<ConversationGalleryFilter>("all");
  const [conversationGalleryMessages, setConversationGalleryMessages] = useState<
    ConversationGalleryMessage[]
  >([]);
  const [conversationGalleryVisibleCount, setConversationGalleryVisibleCount] = useState(60);
  const [unavailableGalleryMediaIds, setUnavailableGalleryMediaIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [isDraggingFileOverComposer, setIsDraggingFileOverComposer] =
    useState(false);
  const [isSendingStructuredMessage, setIsSendingStructuredMessage] =
    useState(false);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [isLoadingLocationBranches, setIsLoadingLocationBranches] =
    useState(false);
  const [locationCaptureError, setLocationCaptureError] = useState("");
  const [locationBranchesError, setLocationBranchesError] = useState("");
  const [locationBranches, setLocationBranches] = useState<Branch[]>([]);
  const [selectedLocationBranchId, setSelectedLocationBranchId] = useState("");
  const [locationForm, setLocationForm] = useState({
    latitude: "",
    longitude: "",
    name: "",
    address: "",
  });
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    department: "",
    title: "",
  });
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoVideoInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const messageComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaMenuRef = useRef<HTMLDivElement>(null);
  const composerDragDepthRef = useRef(0);
  const consumedComposerPrefillTokenRef = useRef(0);

  const messageListRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasLoadedInitialMessagesRef = useRef(false);
  const isFetchingMessagesRef = useRef(false);
  const pendingFetchModeRef = useRef<FetchMessagesMode | null>(null);
  const messagesRef = useRef<ChatWindowMessage[]>([]);
  const messageElementRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [, setJustSent] = useState(false);

  const [messages, setMessages] = useState<ChatWindowMessage[]>([]);
  const [viewerImageId, setViewerImageId] = useState<number | null>(null);

  useEffect(() => {
    setViewerImageId(null);
  }, [conversation.id]);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isCorrectingMessage, setIsCorrectingMessage] = useState(false);
  const [pendingMediaFiles, setPendingMediaFiles] = useState<
    PendingComposerFile[]
  >([]);
  const [uploadingMediaFiles, setUploadingMediaFiles] = useState<
    PendingComposerFile[]
  >([]);
  const [showCommands, setShowCommands] = useState(false);
  const [quickMessageReview, setQuickMessageReview] =
    useState<QuickMessageReviewDraft | null>(null);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>(
    commands.filter((command) => !command.usuario_id || Number(command.usuario_id) === Number(user?.id)),
  );

  useEffect(() => {
    void refreshCommands(false);
  }, [refreshCommands]);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<number | null>(null);
  const [openReactionPickerId, setOpenReactionPickerId] = useState<number | null>(
    null,
  );
  const [messageMenuDirection, setMessageMenuDirection] =
    useState<MessageMenuDirection>("up");
  const [replyingToMessage, setReplyingToMessage] =
    useState<ChatWindowMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(
    null,
  );
  const [messageReactions, setMessageReactions] = useState<MessageReactionMap>({});
  const reactionStorageKey = `chat-message-reactions:${user?.empresa_id}:${conversation.id}`;
  const reactionStorageKeyRef = useRef(reactionStorageKey);

  useEffect(() => {
    reactionStorageKeyRef.current = reactionStorageKey;
    setMessageReactions(readStoredMessageReactions(reactionStorageKey));
    const syncReactions = (event: StorageEvent) => {
      if (event.key === reactionStorageKey || event.key === null) {
        setMessageReactions(readStoredMessageReactions(reactionStorageKey));
      }
    };
    window.addEventListener("storage", syncReactions);
    return () => window.removeEventListener("storage", syncReactions);
  }, [reactionStorageKey]);
  const [expandedMessageTextIds, setExpandedMessageTextIds] = useState<
    Record<number, boolean>
  >({});
  const [, setLoading] = useState(true);

  const SCROLL_EPS = 100;

  const computeIsAtBottom = (el: HTMLElement | null) => {
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_EPS;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const list = messageListRef.current;
        if (list) {
          list.scrollTo({
            top: list.scrollHeight,
            behavior,
          });
          return;
        }

        bottomRef.current?.scrollIntoView({ behavior, block: "end" });
      });
    });
  };

  useEffect(() => {
    setPendingMediaFiles([]);
    setUploadingMediaFiles([]);
    setIsDraggingFileOverComposer(false);
    composerDragDepthRef.current = 0;
  }, [conversation.id]);

  useEffect(() => {
    setFilteredCommands(
      commands.filter((command) => !command.usuario_id || Number(command.usuario_id) === Number(user?.id)),
    );
  }, [commands, user?.id]);

  useEffect(() => {
    setExpandedMessageTextIds({});
  }, [conversation.id]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!quickMessagesEnabled) {
      setShowCommands(false);
    }
  }, [quickMessagesEnabled]);

  useEffect(() => {
    if (openMessageMenuId === null) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest(".message-actions")) {
        return;
      }

      setOpenMessageMenuId(null);
      setOpenReactionPickerId(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [openMessageMenuId]);

  useEffect(() => {
    if (!isMediaSheetOpen && !isEmojiPickerOpen) return;

    const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (mediaMenuRef.current?.contains(target)) {
        return;
      }

      setIsMediaSheetOpen(false);
      setIsEmojiPickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("touchstart", handlePointerDownOutside);

    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("touchstart", handlePointerDownOutside);
    };
  }, [isEmojiPickerOpen, isMediaSheetOpen]);

  useEffect(() => {
    if (!isLocationModalOpen || !user?.empresa_id) return;

    let isActive = true;

    const fetchLocationBranches = async () => {
      try {
        setIsLoadingLocationBranches(true);
        setLocationBranchesError("");

        const encrypted = await encrypt({ empresa_id: user.empresa_id });
        const response = await fetch(`${API_BASE}/user/lista_filial`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });
        const respData = await response.json();
        const resp = (await decrypt(respData.payload)) as {
          boleano: boolean;
          obj?: Branch[];
          mensagem?: string;
        };

        if (!isActive) return;

        if (!resp?.boleano || !Array.isArray(resp.obj)) {
          setLocationBranches([]);
          setLocationBranchesError(
            String(resp?.mensagem || "").trim() ||
              "Nao foi possivel carregar as filiais cadastradas.",
          );
          return;
        }

        setLocationBranches(resp.obj);
      } catch (error) {
        if (!isActive) return;
        console.error("Erro ao carregar filiais para envio de localizacao:", error);
        setLocationBranches([]);
        setLocationBranchesError(
          "Nao foi possivel carregar as filiais cadastradas.",
        );
      } finally {
        if (isActive) {
          setIsLoadingLocationBranches(false);
        }
      }
    };

    void fetchLocationBranches();

    return () => {
      isActive = false;
    };
  }, [isLocationModalOpen, user?.empresa_id]);

  const formatMessageDateTime = (value: Date | string | number) => {
    const date = parseChatTimestamp(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const normalizeEventTextTime = (text?: string) => {
    if (!text) return "";

    return text.replace(
      /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/g,
      (_match, dd, mm, yyyy, hh, min) => {
        const parsed = new Date(
          Number(yyyy),
          Number(mm) - 1,
          Number(dd),
          Number(hh),
          Number(min),
          0,
        );
        if (Number.isNaN(parsed.getTime())) return _match;

        const outDd = String(parsed.getDate()).padStart(2, "0");
        const outMm = String(parsed.getMonth() + 1).padStart(2, "0");
        const outYyyy = parsed.getFullYear();
        const outHh = String(parsed.getHours()).padStart(2, "0");
        const outMin = String(parsed.getMinutes()).padStart(2, "0");
        return `${outDd}/${outMm}/${outYyyy} ${outHh}:${outMin}`;
      },
    );
  };

  const metaWindowExpiryLabel = metaWindowExpiresAt
    ? formatMessageDateTime(metaWindowExpiresAt)
    : "";
  const hasPendingMediaFiles = pendingMediaFiles.length > 0;
  const hasTypedSendableMessage =
    newMessage.trim().length > 0 &&
    !(quickMessagesEnabled && newMessage.startsWith("/"));
  const shouldShowMobileSendButton =
    isMobile && (hasTypedSendableMessage || hasPendingMediaFiles);
  const isComposerLocked = isMetaWindowExpired || isAwaitingTemplateReply;
  const composerLockMessage =
    metaWindowMessage ||
    (isAwaitingTemplateReply
      ? "Aguarde o cliente responder ao template para continuar o atendimento."
      : "A janela de 24h da Meta expirou. Reative a conversa com um template antes de enviar novas mensagens.");

  const statusLabel = readOnly
    ? readOnlyStatusLabel
    : isAwaitingTemplateReply
      ? "Aguardando resposta"
      : isMetaWindowExpired
      ? "Janela Meta encerrada"
      : "Ativo";
  const conversationPhoneLabel = formatConversationPhoneLabel(conversation.phone);

  const showMetaWindowExpiredAlert = () => {
    alert(composerLockMessage);
  };

  const getGeolocationErrorMessage = (error?: GeolocationPositionError) => {
    if (!error) {
      return "Nao foi possivel capturar a localização atual.";
    }

    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Permita o acesso a localização do navegador para enviar sua posição atual.";
      case error.POSITION_UNAVAILABLE:
        return "O dispositivo nao conseguiu determinar a localização atual.";
      case error.TIMEOUT:
        return "A captura da localização expirou. Tente novamente.";
      default:
        return "Nao foi possivel capturar a localização atual.";
    }
  };

  const closeLocationModal = () => {
    if (isCapturingLocation || isSendingStructuredMessage) return;
    setIsLocationModalOpen(false);
    setLocationCaptureError("");
    setLocationBranchesError("");
    setSelectedLocationBranchId("");
  };

  const handleUseCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationCaptureError(
        "Geolocalização nao suportada neste navegador ou dispositivo.",
      );
      return;
    }

    setLocationCaptureError("");
    setIsCapturingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(7),
          longitude: position.coords.longitude.toFixed(7),
        }));
        setIsCapturingLocation(false);
      },
      (error) => {
        setIsCapturingLocation(false);
        setLocationCaptureError(getGeolocationErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const handleSelectLocationBranch = (branchId: string) => {
    setSelectedLocationBranchId(branchId);

    if (!branchId) {
      setLocationBranchesError("");
      return;
    }

    const branch = locationBranches.find(
      (item) => String(item.id) === String(branchId),
    );
    const latitude = Number(branch?.latitude);
    const longitude = Number(branch?.longitude);

    if (!branch || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setLocationBranchesError(
        "A filial selecionada nao possui coordenadas validas para envio.",
      );
      return;
    }

    setLocationBranchesError("");
    setLocationForm((current) => ({
      ...current,
      latitude: latitude.toFixed(7),
      longitude: longitude.toFixed(7),
      name: branch.name || current.name,
      address: branch.address || current.address,
    }));
  };

  const fetchMessages = async ({
    mode = "reset",
  }: {
    mode?: FetchMessagesMode;
  } = {}) => {
    if (!user?.empresa_id) return;
    if (isFetchingMessagesRef.current) {
      const pendingMode = pendingFetchModeRef.current;
      if (
        !pendingMode ||
        FETCH_MODE_PRIORITY[mode] > FETCH_MODE_PRIORITY[pendingMode]
      ) {
        pendingFetchModeRef.current = mode;
      }
      return;
    }

    const currentMessages = messagesRef.current;
    const latestPersistedMessage = getLatestPersistedMessage(currentMessages);
    const effectiveMode =
      mode === "delta" && !latestPersistedMessage ? "reset" : mode;
    const listElement = messageListRef.current;
    const shouldScrollToBottom =
      effectiveMode === "reset" || computeIsAtBottom(listElement);
    const previousScrollHeight =
      effectiveMode === "before" ? listElement?.scrollHeight ?? 0 : 0;
    const previousScrollTop =
      effectiveMode === "before" ? listElement?.scrollTop ?? 0 : 0;

    const payload: Record<string, unknown> = {
      conversa_id: conversation.id,
      usuario_id: user?.id,
      permissions: Array.isArray(user?.permissions) ? user.permissions : [],
    };

      if (effectiveMode === "delta" && latestPersistedMessage) {
      const latestCursor = getConversationCursor(latestPersistedMessage);
      payload.after_timestamp = latestCursor.timestamp;
      payload.after_sort_id = latestCursor.sortId;
      payload.limit = 200;
    } else if (effectiveMode === "tail") {
      payload.limit = 120;
    } else if (effectiveMode === "before" && currentMessages.length) {
      const earliestCursor = getConversationCursor(currentMessages[0]);
      payload.before_timestamp = earliestCursor.timestamp;
      payload.before_sort_id = earliestCursor.sortId;
      payload.limit = 60;
    } else {
      payload.limit = 80;
    }

    isFetchingMessagesRef.current = true;
    if (effectiveMode === "before") {
      setIsLoadingOlderMessages(true);
    } else {
      setLoading(true);
    }

    try {
      const encrypted = await encrypt(payload);
      const response = await fetch(`${API_BASE}/atendimento/carregar_conversa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj?: {
          mensagens?: Array<{
            id: number | string;
            sender: "me" | "other" | "system";
            mensagem: string;
            type: "chat" | "text" | "media" | "event";
            timestamp: string | number | Date;
            user_bubble?: string;
            mediaUrl?: string;
            fileName?: string;
            mediaType?: string;
            midia_id?: string | number | null;
            message_id?: string | null;
            messageId?: string | null;
            externalMessageId?: string | null;
            wamid?: string | null;
            whatsapp_message_id?: string | null;
            meta_message_id?: string | null;
            id_mensagem_meta?: string | null;
            messageUserId?: number | string | null;
            messageUserPhotoUrl?: string | null;
            messageStatusId?: number | null;
            messageStatus?: string | null;
            messageStatusLabel?: string | null;
            edited?: boolean;
            editedAt?: string | number | Date | null;
            reply?: boolean;
            mensagem_reply_id?: number | null;
            replyText?: string | null;
            replyMediaType?: string | null;
            templateData?: unknown;
            sort_id?: number | string | null;
          }>;
          page?: {
            has_more_before?: boolean;
          };
          dados?: {
            atendente?: string;
            meta_numero_conta?: string | null;
            meta_nome_conta?: string | null;
          };
        };
        mensagem?: string;
      };

      if (!resp?.boleano || !Array.isArray(resp.obj?.mensagens)) {
        return;
      }

      const normalized: ChatWindowMessage[] = resp.obj.mensagens.map((m: any) => {
        const timestamp = parseChatTimestamp(m.timestamp);
        const cursorTimestamp = normalizeMessageCursorTimestamp(m.timestamp);
        const cursorSortId = normalizeCursorSortId(
          m.sort_id,
          Number(m.id) || timestamp.getTime(),
        );
        const replyTo = buildReplyPreview(m.replyText, m.replyMediaType);
        const replyMessageId = Number(m.mensagem_reply_id) || undefined;
        const deliveryStatus = normalizeMessageDeliveryStatus(
          m.messageStatus ?? m.messageStatusId,
        );
        const deliveryStatusLabel = getMessageDeliveryStatusLabel(
          deliveryStatus,
          m.messageStatusLabel,
        );

        if (m.type === "chat" || m.type === "text") {
          const sender: "customer" | "agent" =
            m.sender === "me" ? "customer" : "agent";
          const isSystemGenerated = m.sender === "system";
          const templateData = parseTemplateMessageData(m.templateData);
          return {
            id: Number(m.id),
            sender,
            text: m.mensagem,
            type: "chat",
            timestamp,
            cursorTimestamp,
            cursorSortId,
            agentName: m.user_bubble,
            messageUserId: Number(m.messageUserId) || undefined,
            agentAvatarUrl: m.messageUserPhotoUrl || undefined,
            isSystemGenerated,
            deleted: Boolean(m.deleted || m.apagada),
            deletedAt: m.deletedAt ? parseChatTimestamp(m.deletedAt) : undefined,
            edited: Boolean(m.edited),
            editedAt: m.editedAt ? parseChatTimestamp(m.editedAt) : undefined,
            deliveryStatus,
            deliveryStatusLabel,
            replyTo,
            replyMessageId,
            externalMessageId: getMessageExternalId(m),
            templateData,
          } as ChatWindowMessage;
        }

        if (m.type === "event" || m.sender === "system") {
          return {
            id: Number(m.id),
            text: normalizeEventTextTime(m.mensagem),
            type: "event",
            timestamp,
            cursorTimestamp,
            cursorSortId,
          } as ChatWindowMessage;
        }

        if (m.type === "media") {
          const mediaType = normalizeStructuredMediaType(m.mediaType);
          const sender: "customer" | "agent" =
            m.sender === "me" ? "customer" : "agent";
          const isSystemGenerated = m.sender === "system";

          if (isTextLikeLegacyMediaType(mediaType)) {
            return {
              id: Number(m.id),
              sender,
              text: m.mensagem,
              type: "chat",
              timestamp,
              cursorTimestamp,
              cursorSortId,
              agentName: m.user_bubble,
              messageUserId: Number(m.messageUserId) || undefined,
              agentAvatarUrl: m.messageUserPhotoUrl || undefined,
              isSystemGenerated,
              deleted: Boolean(m.deleted || m.apagada),
              deletedAt: m.deletedAt ? parseChatTimestamp(m.deletedAt) : undefined,
              deliveryStatus,
              deliveryStatusLabel,
              replyTo,
              replyMessageId,
              externalMessageId: getMessageExternalId(m),
            } as ChatWindowMessage;
          }

          const structuredData = isStructuredMediaType(mediaType)
            ? parseStructuredMediaPayload(m.midia_id)
            : undefined;

          return {
            id: Number(m.id),
            sender,
            type: "media",
            timestamp,
            cursorTimestamp,
            cursorSortId,
            mediaUrl: resolveMessageMediaUrl({
              conversationId: conversation.id,
              empresaId: user.empresa_id,
              mediaType,
              mediaUrl: m.mediaUrl,
              mediaId: m.midia_id,
            }),
            fileName: m.fileName,
            mediaType: mediaType as
              | "image"
              | "video"
              | "audio"
              | "document"
              | "sticker"
              | "location"
              | "contacts"
              | "meta_referral",
            structuredData,
            agentName: m.user_bubble,
            messageUserId: Number(m.messageUserId) || undefined,
            agentAvatarUrl: m.messageUserPhotoUrl || undefined,
            isSystemGenerated,
            deleted: Boolean(m.deleted || m.apagada),
            deletedAt: m.deletedAt ? parseChatTimestamp(m.deletedAt) : undefined,
            edited: Boolean(m.edited),
            editedAt: m.editedAt ? parseChatTimestamp(m.editedAt) : undefined,
            deliveryStatus,
            deliveryStatusLabel,
            caption: (m.mensagem ?? "").trim() || undefined,
            replyTo,
            replyMessageId,
            externalMessageId: getMessageExternalId(m),
          } as ChatWindowMessage;
        }

        return {
          id: Number(m.id),
          text: "Mensagem nao suportada",
          type: "event",
          timestamp,
          cursorTimestamp,
          cursorSortId,
        } as ChatWindowMessage;
      });

      const hasMoreOlder = Boolean(resp.obj?.page?.has_more_before);

      if (effectiveMode === "before") {
        if (normalized.length) {
          setMessages((prev) => mergeConversationMessages(prev, normalized));
          requestAnimationFrame(() => {
            const list = messageListRef.current;
            if (!list) return;
            const nextScrollHeight = list.scrollHeight;
            list.scrollTop =
              previousScrollTop + (nextScrollHeight - previousScrollHeight);
          });
        }
        setHasMoreBefore(hasMoreOlder);
        return;
      }

      if (effectiveMode === "delta") {
        if (!normalized.length) return;
        setMessages((prev) => mergeConversationMessages(prev, normalized));
        if (shouldScrollToBottom) {
          scrollToBottom("smooth");
        }
        return;
      }

      if (effectiveMode === "tail") {
        if (!normalized.length) return;
        setMessages((prev) => mergeConversationMessages(prev, normalized));
        if (shouldScrollToBottom) {
          scrollToBottom("smooth");
        }
        return;
      }

      const nextMessages = sortConversationMessages(normalized);
      setMessages(nextMessages);
      setHasMoreBefore(hasMoreOlder);
      hasLoadedInitialMessagesRef.current = true;

      if (nextMessages.length && shouldScrollToBottom) {
        scrollToBottom("auto");
      }
    } catch (err) {
      console.error("Erro ao carregar conversa:", err);
    } finally {
      isFetchingMessagesRef.current = false;
      setIsLoadingOlderMessages(false);
      setLoading(false);
      if (pendingFetchModeRef.current) {
        const nextMode = pendingFetchModeRef.current;
        pendingFetchModeRef.current = null;
        void fetchMessages({ mode: nextMode });
      }
    }
  };

  const loadConversationGallery = async () => {
    if (!user?.empresa_id || !user?.id || isConversationGalleryLoading) return;

    setIsConversationGalleryLoading(true);
    setConversationGalleryError("");

    try {
      const mediaByKey = new Map<string, ConversationGalleryMessage>();
      let beforeTimestamp: string | null = null;
      let beforeSortId: number | null = null;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore && pageCount < 250) {
        const requestPayload: Record<string, unknown> = {
          conversa_id: conversation.id,
          usuario_id: user.id,
          permissions: Array.isArray(user.permissions) ? user.permissions : [],
          limit: 200,
        };

        if (beforeTimestamp) {
          requestPayload.before_timestamp = beforeTimestamp;
          requestPayload.before_sort_id = beforeSortId;
        }

        const encrypted = await encrypt(requestPayload);
        const response = await fetch(`${API_BASE}/atendimento/carregar_conversa`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });
        const responseData = await response.json();
        const parsed = await decrypt(responseData.payload);

        if (!parsed?.boleano || !Array.isArray(parsed.obj?.mensagens)) {
          throw new Error(parsed?.mensagem || "Nao foi possivel carregar as midias.");
        }

        for (const rawMessage of parsed.obj.mensagens) {
          if (rawMessage?.type !== "media" || rawMessage?.deleted || rawMessage?.apagada) continue;

          const mediaType = normalizeStructuredMediaType(rawMessage.mediaType);
          if (!["image", "video", "audio", "document", "sticker"].includes(mediaType)) continue;

          const timestamp = parseChatTimestamp(rawMessage.timestamp);
          const messageId = Number(rawMessage.id);
          const mediaMessage: ConversationGalleryMessage = {
            id: messageId,
            sender: rawMessage.sender === "me" ? "customer" : "agent",
            type: "media",
            timestamp,
            cursorTimestamp: normalizeMessageCursorTimestamp(rawMessage.timestamp),
            cursorSortId: normalizeCursorSortId(
              rawMessage.sort_id,
              messageId || timestamp.getTime(),
            ),
            mediaUrl: resolveMessageMediaUrl({
              conversationId: conversation.id,
              empresaId: user.empresa_id,
              mediaType,
              mediaUrl: rawMessage.mediaUrl,
              mediaId: rawMessage.midia_id,
            }),
            fileName: rawMessage.fileName,
            mediaType: mediaType as "image" | "video" | "audio" | "document" | "sticker",
            caption: String(rawMessage.mensagem || "").trim() || undefined,
            agentName: rawMessage.user_bubble,
          };

          mediaByKey.set(`${mediaType}:${messageId}:${rawMessage.midia_id || ""}`, mediaMessage);
        }

        hasMore = Boolean(parsed.obj?.page?.has_more_before);
        const earliestCursor = parsed.obj?.page?.earliest_cursor;
        beforeTimestamp = earliestCursor?.timestamp || null;
        beforeSortId = Number.isFinite(Number(earliestCursor?.sort_id))
          ? Number(earliestCursor.sort_id)
          : null;
        pageCount += 1;

        if (hasMore && !beforeTimestamp) break;
      }

      setConversationGalleryMessages(
        Array.from(mediaByKey.values()).sort(
          (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
        ),
      );
    } catch (error) {
      console.error("Erro ao carregar galeria da conversa:", error);
      setConversationGalleryError(
        error instanceof Error ? error.message : "Nao foi possivel carregar as midias.",
      );
    } finally {
      setIsConversationGalleryLoading(false);
    }
  };

  const handleOpenConversationGallery = () => {
    setIsConversationGalleryOpen(true);
    setConversationGalleryFilter("all");
    setConversationGalleryVisibleCount(60);
    setUnavailableGalleryMediaIds(new Set());
    void loadConversationGallery();
  };

  useEffect(() => {
    hasLoadedInitialMessagesRef.current = false;
    setMessages([]);
    setHasMoreBefore(false);
    setNewMessage("");
    setShowCommands(false);
    setReplyingToMessage(null);
    setIsConversationGalleryOpen(false);
    setConversationGalleryMessages([]);
    setUnavailableGalleryMediaIds(new Set());
    void fetchMessages({ mode: "reset" });
  }, [conversation.id]);

  useEffect(() => {
    if (!refreshSignal) return;
    void fetchMessages({ mode: "tail" });
  }, [refreshSignal]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchMessages({ mode: "tail" });
    }, socketConnected ? 3000 : 5000);
    return () => window.clearInterval(interval);
  }, [conversation.id, socketConnected]);

  useEffect(() => {
    setIsHeaderDetailsOpen(false);
  }, [conversation.id]);

  useEffect(() => {
    if (!composerPrefillToken) return;
    if (consumedComposerPrefillTokenRef.current === composerPrefillToken) return;
    if (readOnly || isComposerLocked) return;

    const nextMessage = String(composerPrefillText || "");
    consumedComposerPrefillTokenRef.current = composerPrefillToken;
    setNewMessage(nextMessage);
    setShowCommands(false);
    onComposerPrefillConsumed?.();

    requestAnimationFrame(() => {
      const composer = messageComposerRef.current;
      if (!composer) return;

      composer.focus();
      const cursorPosition = nextMessage.length;
      composer.setSelectionRange(cursorPosition, cursorPosition);
    });
  }, [
    composerPrefillText,
    composerPrefillToken,
    isComposerLocked,
    onComposerPrefillConsumed,
    readOnly,
  ]);

  const handleSendMessage = async (conversationId: number, text: string) => {
    if (!text.trim()) return false;
    if (!user?.empresa_id) return false;
    if (isCorrectingMessage) return false;
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return false;
    }

    const tempId = Date.now();
    const optimisticTimestamp = new Date();
    const replyMessage = replyingToMessage;
    const optimisticMsg: ChatWindowMessage = {
      id: tempId,
      text,
      sender: "agent",
      timestamp: optimisticTimestamp,
      cursorTimestamp: optimisticTimestamp.toISOString(),
      cursorSortId: tempId,
      isOptimistic: true,
      type: "chat",
      agentName: user?.name || "Eu",
      messageUserId: user?.id,
      agentAvatarUrl: user?.foto_perfil_url || undefined,
      deliveryStatus: "pending",
      deliveryStatusLabel: "Enviando",
      replyTo: replyMessage
        ? {
            text: getMessageReplyText(replyMessage),
            mediaType:
              replyMessage.type === "media" ? replyMessage.mediaType : undefined,
          }
        : undefined,
      replyMessageId: replyMessage?.id,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage("");
    setReplyingToMessage(null);
    setJustSent(true);
    scrollToBottom("smooth");

    try {
      const nome = user?.name ?? "Usuario";
      const cargo = (user as any).cargo;

      const encrypted = await encrypt({
        conversa_id: conversationId,
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        mensagem: text,
        ...buildReplyPayload(replyMessage),
        nome,
        cargo,
      });

      const response = await fetch(`${API_BASE}/atendimento/enviar_mensagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = await decrypt(respData.payload);

      if (!resp?.boleano) {
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        const errorMessage =
          String(resp?.mensagem || "").trim() ||
          "Nao foi possivel enviar a mensagem.";
        console.error("Falha ao enviar mensagem:", errorMessage);
        alert(errorMessage);
        return false;
      }
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                deliveryStatus: "sent",
                deliveryStatusLabel: "Enviado",
              }
            : msg,
        ),
      );
      await fetchMessages();
      return true;
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      console.error("Erro ao enviar mensagem:", err);
      alert("Nao foi possivel enviar a mensagem.");
      return false;
    }
  };

  const handleSendImageByUrl = async (imageUrl: string, caption = "") => {
    if (!user?.empresa_id || !user?.id) return false;
    if (!isAbsoluteUrl(imageUrl)) return false;
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return false;
    }

    try {
      const replyMessage = replyingToMessage;
      const encrypted = await encrypt({
        conversa_id: conversation.id,
        usuario_id: user.id,
        numero: conversation.phone,
        image_url: imageUrl,
        caption,
        ...buildReplyPayload(replyMessage),
      });

      const response = await fetch(
        `${API_BASE}/atendimento/enviar_imagem_url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        },
      );

      const respData = await response.json();
      const resp = await decrypt(respData.payload);

      if (!resp?.boleano) {
        const errorMessage =
          String(resp?.mensagem || "").trim() ||
          "Nao foi possivel enviar a imagem.";
        console.error(
          "Falha ao enviar imagem da mensagem rapida:",
          errorMessage,
        );
        alert(errorMessage);
        return false;
      }

      await fetchMessages();
      setReplyingToMessage(null);
      scrollToBottom("smooth");
      return true;
    } catch (error) {
      console.error("Erro ao enviar imagem da mensagem rapida:", error);
      alert("Nao foi possivel enviar a imagem.");
      return false;
    }
  };

  const handleSendVideoByUrl = async (videoUrl: string, caption = "") => {
    if (!user?.empresa_id || !user?.id || !isAbsoluteUrl(videoUrl)) return false;
    if (isComposerLocked) { showMetaWindowExpiredAlert(); return false; }
    try {
      const encrypted = await encrypt({
        conversa_id: conversation.id,
        usuario_id: user.id,
        numero: conversation.phone,
        video_url: videoUrl,
        caption,
      });
      const response = await fetch(`${API_BASE}/atendimento/enviar_video_url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = await decrypt(respData.payload);
      if (!resp?.boleano) {
        alert(String(resp?.mensagem || "Nao foi possivel enviar o video."));
        return false;
      }
      await fetchMessages();
      scrollToBottom("smooth");
      return true;
    } catch (error) {
      console.error("Erro ao enviar video da mensagem rapida:", error);
      alert("Nao foi possivel enviar o video.");
      return false;
    }
  };

  const handleSendDocumentByUrl = async (
    documentUrl: string,
    filename = "",
    caption = "",
  ) => {
    if (!user?.empresa_id || !user?.id) return false;
    if (!isAbsoluteUrl(documentUrl)) return false;
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return false;
    }

    try {
      const replyMessage = replyingToMessage;
      const encrypted = await encrypt({
        conversa_id: conversation.id,
        usuario_id: user.id,
        numero: conversation.phone,
        document_url: documentUrl,
        filename,
        caption,
        ...buildReplyPayload(replyMessage),
      });

      const response = await fetch(
        `${API_BASE}/atendimento/enviar_documento_url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        },
      );

      const respData = await response.json();
      const resp = await decrypt(respData.payload);

      if (!resp?.boleano) {
        const errorMessage =
          String(resp?.mensagem || "").trim() ||
          "Nao foi possivel enviar o documento.";
        console.error(
          "Falha ao enviar documento da mensagem rapida:",
          errorMessage,
        );
        alert(errorMessage);
        return false;
      }

      await fetchMessages();
      setReplyingToMessage(null);
      scrollToBottom("smooth");
      return true;
    } catch (error) {
      console.error("Erro ao enviar documento da mensagem rapida:", error);
      alert("Nao foi possivel enviar o documento.");
      return false;
    }
  };

  const handleSendLocation = async () => {
    if (!user?.empresa_id || !user?.id) return false;
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return false;
    }

    const latitude = Number(locationForm.latitude);
    const longitude = Number(locationForm.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      alert("Informe latitude e longitude validas.");
      return false;
    }

    try {
      setIsSendingStructuredMessage(true);
      const replyMessage = replyingToMessage;
      const encrypted = await encrypt({
        conversa_id: conversation.id,
        usuario_id: user.id,
        numero: conversation.phone,
        latitude,
        longitude,
        name: locationForm.name.trim(),
        address: locationForm.address.trim(),
        ...buildReplyPayload(replyMessage),
      });

      const response = await fetch(`${API_BASE}/atendimento/enviar_localizacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = await decrypt(respData.payload);

      if (!resp?.boleano) {
        const errorMessage =
          String(resp?.mensagem || "").trim() ||
          "Nao foi possivel enviar a localização.";
        alert(errorMessage);
        return false;
      }

      setIsLocationModalOpen(false);
      setLocationCaptureError("");
      setLocationForm({
        latitude: "",
        longitude: "",
        name: "",
        address: "",
      });
      setReplyingToMessage(null);
      await fetchMessages();
      scrollToBottom("smooth");
      return true;
    } catch (error) {
      console.error("Erro ao enviar localização:", error);
      alert("Nao foi possivel enviar a localização.");
      return false;
    } finally {
      setIsSendingStructuredMessage(false);
    }
  };

  const handleSendContact = async () => {
    if (!user?.empresa_id || !user?.id) return false;
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return false;
    }

    const name = contactForm.name.trim();
    const phone = contactForm.phone.trim();
    const email = contactForm.email.trim();

    if (!name) {
      alert("Informe o nome do contato.");
      return false;
    }

    if (!phone && !email) {
      alert("Informe ao menos telefone ou email do contato.");
      return false;
    }

    try {
      setIsSendingStructuredMessage(true);
      const replyMessage = replyingToMessage;
      const encrypted = await encrypt({
        conversa_id: conversation.id,
        usuario_id: user.id,
        numero: conversation.phone,
        name,
        phone,
        email,
        company: contactForm.company.trim(),
        department: contactForm.department.trim(),
        title: contactForm.title.trim(),
        ...buildReplyPayload(replyMessage),
      });

      const response = await fetch(`${API_BASE}/atendimento/enviar_contato`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = await decrypt(respData.payload);

      if (!resp?.boleano) {
        const errorMessage =
          String(resp?.mensagem || "").trim() ||
          "Nao foi possivel enviar o contato.";
        alert(errorMessage);
        return false;
      }

      setIsContactModalOpen(false);
      setContactForm({
        name: "",
        phone: "",
        email: "",
        company: "",
        department: "",
        title: "",
      });
      setReplyingToMessage(null);
      await fetchMessages();
      scrollToBottom("smooth");
      return true;
    } catch (error) {
      console.error("Erro ao enviar contato:", error);
      alert("Nao foi possivel enviar o contato.");
      return false;
    } finally {
      setIsSendingStructuredMessage(false);
    }
  };

  const searchTemplate = async (searchTerm: string) => {
    try {
      if (!user?.empresa_id || !user?.id) return;
      if (!searchTerm.trim()) {
        setFilteredCommands(
          commands.filter((command) => !command.usuario_id || Number(command.usuario_id) === Number(user?.id)),
        );
        setShowCommands(true);
        return;
      }
      const encrypted = await encrypt({
        pesquisa: searchTerm,
        empresa_id: user.empresa_id,
        usuario_id: user.id,
      });
      const response = await fetch(`${API_BASE}/atendimento/mensagem_busca`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = await decrypt(respData.payload);
      if (resp?.boleano && Array.isArray(resp.obj)) {
        setFilteredCommands(
          resp.obj.map((tpl: any) => ({
            id: tpl.id,
            command: tpl.nome,
            description: tpl.descricao,
            text: tpl.texto,
            gallery_image_id: tpl.gallery_image_id,
            image_url: tpl.image_url,
            image_name: tpl.image_name,
            image_mime_type: tpl.image_mime_type,
            gallery_document_id: tpl.gallery_document_id,
            document_url: tpl.document_url,
            document_name: tpl.document_name,
            document_mime_type: tpl.document_mime_type,
            gallery_audio_id: tpl.gallery_audio_id,
            audio_url: tpl.audio_url,
            audio_name: tpl.audio_name,
            audio_mime_type: tpl.audio_mime_type,
            media_order: tpl.media_order,
            content: tpl.media_order && !Array.isArray(tpl.media_order) ? tpl.media_order : undefined,
            use_text_as_image_caption: Boolean(tpl.use_text_as_image_caption),
          })),
        );
        setShowCommands(true);
      }
    } catch (err) {
      console.error("Erro ao pesquisar template:", err);
    }
  };

  const resizeMessageComposer = () => {
    const element = messageComposerRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
  };

  useEffect(() => {
    resizeMessageComposer();
  }, [newMessage]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isComposerLocked) {
      return;
    }
    const value = event.target.value;
    setNewMessage(value);
    if (quickMessagesEnabled && value.startsWith("/")) {
      const searchTerm = value.substring(1).toLowerCase();
      searchTemplate(searchTerm);
    } else {
      setShowCommands(false);
    }
  };

  const handleSendAudioByUrl = async (
    galleryAudioId: number,
    audioUrl: string,
    audioName = "",
  ) => {
    if (!user?.empresa_id || !user?.id) return false;
    if (!isAbsoluteUrl(audioUrl)) return false;
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return false;
    }

    try {
      setIsSendingAudio(true);
      const encrypted = await encrypt({
        conversa_id: conversation.id,
        usuario_id: user.id,
        numero: conversation.phone,
        galeria_audio_id: galleryAudioId,
        audio_url: audioUrl,
        audio_name: audioName,
      });
      const response = await fetch(`${API_BASE}/atendimento/enviar_audio_url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = await decrypt(respData.payload);
      if (!resp?.boleano) {
        const errorMessage =
          String(resp?.mensagem || "").trim() || "Nao foi possivel enviar o audio.";
        console.error("Falha ao enviar audio da mensagem rapida:", errorMessage);
        alert(errorMessage);
        return false;
      }
      await fetchMessages();
      setReplyingToMessage(null);
      scrollToBottom("smooth");
      return true;
    } catch (error) {
      console.error("Erro ao enviar audio da mensagem rapida:", error);
      alert("Nao foi possivel enviar o audio.");
      return false;
    } finally {
      setIsSendingAudio(false);
    }
  };

  const handleCorrectMessage = async () => {
    if (!user?.empresa_id || !user?.id) return;
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return;
    }

    const textToCorrect = String(newMessage || "").trim();
    if (!textToCorrect || isCorrectingMessage) return;

    if (quickMessagesEnabled && textToCorrect.startsWith("/")) {
      alert("A correcao nao esta disponivel para comandos iniciados por /.");
      return;
    }

    try {
      setIsCorrectingMessage(true);
      setShowCommands(false);
      setIsMediaSheetOpen(false);
      setIsEmojiPickerOpen(false);
      const encrypted = await encrypt({
        conversa_id: conversation.id,
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        texto: textToCorrect,
      });
      const response = await fetch(`${API_BASE}/atendimento/corrigir_texto_chat_ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano?: boolean;
        mensagem?: string;
        obj?: {
          corrected_text?: string;
          texto_corrigido?: string;
          changed?: boolean;
        };
      };

      if (!resp?.boleano) {
        throw new Error(
          String(resp?.mensagem || "").trim() ||
            "Nao foi possivel corrigir o texto.",
        );
      }

      const correctedText = String(
        resp?.obj?.corrected_text || resp?.obj?.texto_corrigido || textToCorrect,
      );
      setNewMessage(correctedText);
      setShowCommands(false);

      requestAnimationFrame(() => {
        const composer = messageComposerRef.current;
        if (!composer) return;
        composer.focus();
        const cursorPosition = correctedText.length;
        composer.setSelectionRange(cursorPosition, cursorPosition);
      });
    } catch (error) {
      console.error("Erro ao corrigir texto do chat:", error);
      alert(
        error instanceof Error && error.message
          ? error.message
          : "Nao foi possivel corrigir o texto.",
      );
    } finally {
      setIsCorrectingMessage(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return;
    }

    const composer = messageComposerRef.current;
    const start = composer?.selectionStart ?? newMessage.length;
    const end = composer?.selectionEnd ?? newMessage.length;
    const nextMessage =
      newMessage.slice(0, start) + emoji + newMessage.slice(end);
    const nextCursorPosition = start + emoji.length;

    setNewMessage(nextMessage);
    setShowCommands(false);
    setIsMediaSheetOpen(false);
    setIsEmojiPickerOpen(false);

    requestAnimationFrame(() => {
      const input = messageComposerRef.current;
      if (!input) return;

      input.focus();
      input.setSelectionRange(nextCursorPosition, nextCursorPosition);
      resizeMessageComposer();
    });
  };

  const handleCommandSelect = (command: Command) => {
    if (!quickMessagesEnabled || isCorrectingMessage) return;
    if (isComposerLocked) { showMetaWindowExpiredAlert(); return; }
    setNewMessage(""); setShowCommands(false);

    const content = command.content;
    const texts = content?.texts?.length ? content.texts : [command.text].filter(Boolean);
    const images = content?.images?.length ? content.images : (isAbsoluteUrl(command.image_url) ? [{ id: Number(command.gallery_image_id || 0), url: command.image_url!, name: command.image_name || "imagem" }] : []);
    const documents = content?.documents?.length ? content.documents : (isAbsoluteUrl(command.document_url) ? [{ id: Number(command.gallery_document_id || 0), url: command.document_url!, name: command.document_name || "documento" }] : []);
    const audios = content?.audios?.length ? content.audios : (isAbsoluteUrl(command.audio_url) ? [{ id: Number(command.gallery_audio_id || 0), url: command.audio_url!, name: command.audio_name || "audio" }] : []);
    const videos = content?.videos || [];
    const availableMedia = [
      ...(images.length ? ["image" as const] : []),
      ...(documents.length ? ["document" as const] : []),
      ...(audios.length ? ["audio" as const] : []),
      ...(videos.length ? ["video" as const] : []),
    ];
    const requestedOrder = content?.order || (Array.isArray(command.media_order) ? command.media_order : []);
    const mediaOrder = [...requestedOrder.filter((type, index) => availableMedia.includes(type) && requestedOrder.indexOf(type) === index), ...availableMedia.filter((type) => !requestedOrder.includes(type))];
    const fallbackCaption = texts.length === 1 && images.length === 1 && Boolean(command.use_text_as_image_caption);
    const fallbackSequence = [
      ...texts.map((_, text_index) => ({ type: "text" as const, text_index })),
      ...mediaOrder.flatMap((type) => {
        const items = type === "image" ? images : type === "document" ? documents : type === "audio" ? audios : videos;
        return items.map((item, index) => ({
          type,
          id: item.id,
          ...(type === "image" && fallbackCaption && index === 0 ? { caption_text_index: 0 } : {}),
        }));
      }),
    ];
    const sendSequence = content?.sequence?.length ? [...content.sequence] : fallbackSequence;
    const captionedTextIndexes = new Set(sendSequence
      .filter((item) => ["image", "video", "document"].includes(item.type) && "caption_text_index" in item && Number.isInteger(item.caption_text_index))
      .map((item) => Number("caption_text_index" in item ? item.caption_text_index : -1)));
    if (!texts.some((item) => String(item).trim()) && !availableMedia.length) {
      alert("Esta mensagem rapida nao possui texto ou midia para enviar."); return;
    }

    setQuickMessageReview({
      commandName: command.command,
      texts: [...texts],
      images: [...images],
      documents: [...documents],
      audios: [...audios],
      videos: [...videos],
      sequence: sendSequence.filter(
        (item) => item.type !== "text" || !captionedTextIndexes.has(Number(item.text_index)),
      ),
    });
  };

  const moveQuickMessageReviewItem = (index: number, direction: -1 | 1) => {
    setQuickMessageReview((current) => {
      if (!current) return current;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.sequence.length) return current;
      const sequence = [...current.sequence];
      [sequence[index], sequence[targetIndex]] = [sequence[targetIndex], sequence[index]];
      return { ...current, sequence };
    });
  };

  const updateQuickMessageReviewText = (textIndex: number, value: string) => {
    setQuickMessageReview((current) => {
      if (!current) return current;
      const texts = [...current.texts];
      texts[textIndex] = value;
      return { ...current, texts };
    });
  };

  const handleConfirmQuickMessage = async () => {
    if (!quickMessageReview || isSendingMedia) return;
    const { texts, images, documents, audios, videos, sequence } = quickMessageReview;
    const captionedTextIndexes = new Set(sequence
      .filter((item) => ["image", "video", "document"].includes(item.type) && Number.isInteger(item.caption_text_index))
      .map((item) => Number(item.caption_text_index)));

    setIsSendingMedia(true);
    try {
      const collections = { image: images, document: documents, audio: audios, video: videos };
      for (const entry of sequence) {
        if (entry.type === "text") {
          const textIndex = Number(entry.text_index);
          const text = texts[textIndex];
          if (!captionedTextIndexes.has(textIndex) && String(text || "").trim()) {
            if (!(await handleSendMessage(conversation.id, text))) return;
          }
          continue;
        }
        const item = collections[entry.type]?.find((mediaItem) => Number(mediaItem.id) === Number(entry.id));
        if (!item) continue;
        const caption = Number.isInteger(entry.caption_text_index) ? texts[Number(entry.caption_text_index)] || "" : "";
        if (entry.type === "image") {
          if (!(await handleSendImageByUrl(item.url, caption))) return;
        }
        if (entry.type === "document" && !(await handleSendDocumentByUrl(item.url, item.name || "", caption))) return;
        if (entry.type === "audio" && !(await handleSendAudioByUrl(item.id, item.url, item.name || ""))) return;
        if (entry.type === "video" && !(await handleSendVideoByUrl(item.url, caption))) return;
      }
      setQuickMessageReview(null);
    } finally {
      setIsSendingMedia(false);
    }
  };

  const handleSubmit = async (
    event: React.FormEvent | React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    event.preventDefault();
    if (isCorrectingMessage) return;
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return;
    }
    if (isSendingMedia) return;

    const pendingFilesSnapshot = pendingMediaFiles;
    const files = pendingFilesSnapshot.map((item) => item.file);
    if (files.length) {
      const caption = newMessage;
      setPendingMediaFiles([]);
      setNewMessage("");

      const sent = await uploadMediaFiles(files, caption);
      if (!sent) {
        setPendingMediaFiles(pendingFilesSnapshot);
        setNewMessage(caption);
      }
      return;
    }

    if (newMessage.trim() === "") return;
    if (quickMessagesEnabled && newMessage.startsWith("/")) return;
    void handleSendMessage(conversation.id, newMessage);
    setNewMessage("");
  };

  const closeMessageMenu = () => {
    setOpenMessageMenuId(null);
    setOpenReactionPickerId(null);
  };

  const handleToggleMessageMenu = (
    messageId: number,
    triggerElement: HTMLElement,
  ) => {
    if (openMessageMenuId === messageId) {
      setOpenMessageMenuId(null);
      setOpenReactionPickerId(null);
      return;
    }

    const listRect = messageListRef.current?.getBoundingClientRect();
    const triggerRect = triggerElement.getBoundingClientRect();
    const menuEstimatedHeight = 330;

    const availableAbove = triggerRect.top - (listRect?.top ?? 0);
    const availableBelow = (listRect?.bottom ?? window.innerHeight) - triggerRect.bottom;

    setMessageMenuDirection(
      availableAbove >= menuEstimatedHeight || availableAbove > availableBelow
        ? "up"
        : "down",
    );
    setOpenReactionPickerId(null);
    setOpenMessageMenuId(messageId);
  };

  const handleReplyToMessage = (message: ChatWindowMessage) => {
    setReplyingToMessage(message);
    closeMessageMenu();
    requestAnimationFrame(() => messageComposerRef.current?.focus());
  };

  const handleJumpToReplyMessage = (replyMessageId?: number) => {
    if (!replyMessageId) return;

    const targetElement = messageElementRefs.current.get(replyMessageId);
    if (!targetElement) {
      alert("Mensagem original nao esta carregada nesta conversa.");
      return;
    }

    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setHighlightedMessageId(replyMessageId);
    window.setTimeout(() => {
      setHighlightedMessageId((current) =>
        current === replyMessageId ? null : current,
      );
    }, 1800);
  };

  const handleCopyMessage = async (message: ChatWindowMessage) => {
    const text = getMessageActionText(message);
    closeMessageMenu();

    if (!text) {
      alert("Esta mensagem nao possui texto para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Nao foi possivel copiar a mensagem:", error);
      alert("Nao foi possivel copiar a mensagem.");
    }
  };

  const handleSetMessageReaction = async (
    message: ChatWindowMessage,
    reaction: string,
  ) => {
    if (!user?.empresa_id) return;

    const key = String(message.id);
    const storageKey = reactionStorageKey;
    const nextReaction = messageReactions[key] === reaction ? "" : reaction;

    try {
      const encrypted = await encrypt({
        conversa_id: conversation.id,
        mensagem_id: message.id,
        emoji: nextReaction,
        empresa_id: user.empresa_id,
        usuario_id: user.id,
      });

      const response = await fetch(`${API_BASE}/atendimento/reagir_mensagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = await decrypt(respData.payload);

      if (!resp?.boleano) {
        alert(
          String(resp?.mensagem || "").trim() ||
            "Nao foi possivel enviar a reacao.",
        );
        return;
      }

      const storedReactions = readStoredMessageReactions(storageKey);
      if (nextReaction) storedReactions[key] = nextReaction;
      else delete storedReactions[key];
      try {
        localStorage.setItem(storageKey, JSON.stringify(storedReactions));
      } catch (error) {
        console.error("Não foi possível salvar as reações neste navegador:", error);
        alert("Reação enviada, mas não foi possível salvá-la neste navegador.");
      }
      if (reactionStorageKeyRef.current === storageKey) {
        setMessageReactions(storedReactions);
      }
      closeMessageMenu();
    } catch (error) {
      console.error("Erro ao enviar reacao:", error);
      alert("Nao foi possivel enviar a reacao.");
    }
  };

  const handleEditMessage = () => {
    closeMessageMenu();
    alert(
      "Para editar mensagens preciso do endpoint do backend e do contrato do payload/retorno.",
    );
  };

  const handleComposerKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (isCorrectingMessage) return;
      void handleSubmit(event);
    }
  };

  const attachMediaFiles = (files: File[]) => {
    if (!files.length) return false;
    if (isCorrectingMessage) return false;
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return false;
    }
    if (isSendingMedia) {
      return false;
    }

    const oversized = files.find((file) => file.size > MAX_HOSTED_ATTACHMENT_BYTES);
    if (oversized) {
      alert(`${oversized.name}: tamanho maximo para anexos e 100MB.`);
      return false;
    }

    const availableSlots = MAX_COMPOSER_ATTACHMENTS - pendingMediaFiles.length;
    if (availableSlots <= 0) {
      alert(`Voce pode anexar no maximo ${MAX_COMPOSER_ATTACHMENTS} arquivos.`);
      return false;
    }

    const filesToAttach = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      alert(`Limite de ${MAX_COMPOSER_ATTACHMENTS} arquivos por envio.`);
    }

    const timestamp = Date.now();
    setShowCommands(false);
    setPendingMediaFiles((current) => [
      ...current,
      ...filesToAttach.map((file, index) => ({
        id: `${timestamp}-${index}-${file.name}-${file.size}`,
        file,
      })),
    ]);
    requestAnimationFrame(() => messageComposerRef.current?.focus());
    return true;
  };

  const removePendingMediaFile = (fileId: string) => {
    setPendingMediaFiles((current) =>
      current.filter((item) => item.id !== fileId),
    );
  };

  const uploadMediaFiles = async (files: File[], captionText = newMessage) => {
    if (!files.length || !user?.empresa_id || isSendingMedia) {
      return false;
    }

    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return false;
    }

    setIsSendingMedia(true);
    setUploadingMediaFiles(
      files.map((file, index) => ({
        id: `uploading-${Date.now()}-${index}`,
        file,
      })),
    );
    const caption = captionText.trim();
    const replyMessage = replyingToMessage;

    try {
      for (const [index, file] of files.entries()) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("conversa_id", String(conversation.id));
        formData.append("numero", conversation.phone);
        formData.append("caption", index === 0 ? caption : "");
        formData.append("empresa_id", String(user.empresa_id));
        formData.append("usuario_id", String(user.id));
        appendReplyFormData(formData, replyMessage);

        const response = await fetch(`${API_BASE}/atendimento/upload_media`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const fallbackMessage = `Falha no upload de ${file.name || "arquivo"}.`;
          try {
            const errorPayload = await response.text();
            throw new Error(errorPayload.trim() || fallbackMessage);
          } catch (error) {
            if (error instanceof Error && error.message) throw error;
            throw new Error(fallbackMessage);
          }
        }

        const respData = await response.json();
        const resp = (await decrypt(respData.payload)) as {
          boleano?: boolean;
          mensagem?: string;
        };
        if (!resp?.boleano) {
          throw new Error(
            String(resp?.mensagem || "").trim() ||
              `Nao foi possivel enviar ${file.name || "o arquivo"}.`,
          );
        }
      }

      setJustSent(true);
      setReplyingToMessage(null);
      await fetchMessages();
      scrollToBottom("smooth");
      return true;
    } catch (error) {
      console.error("Erro ao enviar midia:", error);
      alert(
        error instanceof Error && error.message
          ? error.message
          : "Nao foi possivel enviar o arquivo.",
      );
      return false;
    } finally {
      setUploadingMediaFiles([]);
      setIsSendingMedia(false);
    }
  };

  const handleDownloadMessageMedia = async (
    message: Extract<ChatWindowMessage, { type: "media" }>,
  ) => {
    closeMessageMenu();
    if (!message.mediaUrl) {
      alert("Esta midia nao possui um arquivo disponivel para download.");
      return;
    }

    const extensionByType: Partial<Record<typeof message.mediaType, string>> = {
      image: "jpg",
      video: "mp4",
      audio: "ogg",
      document: "bin",
      sticker: "webp",
    };
    const fallbackName = `midia-${message.id}.${extensionByType[message.mediaType] || "bin"}`;
    const fileName = String(message.fileName || fallbackName)
      .replace(/[\\/:*?"<>|]+/g, "-")
      .trim() || fallbackName;

    try {
      const response = await fetch(message.mediaUrl);
      if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error("Nao foi possivel baixar a midia:", error);
      alert("Nao foi possivel baixar esta midia. Tente novamente.");
    }
  };

  const handleHideMessage = async (message: ChatWindowMessage) => {
    closeMessageMenu();
    if (message.deleted || !window.confirm("Ocultar esta mensagem somente na plataforma?")) return;
    try {
      await appSafetyService.hideMessage({ conversaId: conversation.id, mensagemId: message.id });
      setMessages((current) => current.map((item) =>
        item.id === message.id ? { ...item, deleted: true, deletedAt: new Date() } : item,
      ));
    } catch (error) {
      console.error("Nao foi possivel apagar a mensagem:", error);
      alert(error instanceof Error ? error.message : "Nao foi possivel apagar a mensagem.");
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      if (event.target) event.target.value = "";
      return;
    }

    setIsMediaSheetOpen(false);
    attachMediaFiles(files);

    if (event.target) {
      event.target.value = "";
    }
  };

  const getFilesFromClipboard = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files || []);
    if (files.length) return files;

    return Array.from(event.clipboardData.items || [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
  };

  const getFilesFromDragEvent = (
    event: React.DragEvent<HTMLElement>,
  ) => Array.from(event.dataTransfer.files || []);

  const hasFilesInDragEvent = (event: React.DragEvent<HTMLElement>) => {
    const types = Array.from(event.dataTransfer.types || []);
    return types.includes("Files");
  };

  const handleComposerPaste = (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const files = getFilesFromClipboard(event);
    if (!files.length) return;

    event.preventDefault();
    setIsMediaSheetOpen(false);
    setIsEmojiPickerOpen(false);
    attachMediaFiles(files);
  };

  const handleComposerDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFilesInDragEvent(event) || isComposerLocked) return;

    event.preventDefault();
    composerDragDepthRef.current += 1;
    setIsMediaSheetOpen(false);
    setIsEmojiPickerOpen(false);
    setIsDraggingFileOverComposer(true);
  };

  const handleComposerDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFilesInDragEvent(event) || isComposerLocked) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFileOverComposer(true);
  };

  const handleComposerDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFilesInDragEvent(event)) return;

    event.preventDefault();
    composerDragDepthRef.current = Math.max(0, composerDragDepthRef.current - 1);
    if (composerDragDepthRef.current === 0) {
      setIsDraggingFileOverComposer(false);
    }
  };

  const handleComposerDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFilesInDragEvent(event)) return;

    event.preventDefault();
    composerDragDepthRef.current = 0;
    setIsDraggingFileOverComposer(false);

    const files = getFilesFromDragEvent(event);
    if (!files.length) return;

    setIsMediaSheetOpen(false);
    setIsEmojiPickerOpen(false);
    attachMediaFiles(files);
  };

  const handleAudioSend = async (audioBlob: Blob, duration: number) => {
    if (isSendingAudio) return;
    if (isCorrectingMessage) return;
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return;
    }

    setIsSendingAudio(true);
    setIsRecordingMode(false);

    const formData = new FormData();
    formData.append("file", audioBlob, `audio_${Date.now()}.webm`);
    formData.append("conversa_id", String(conversation.id));
    formData.append("numero", conversation.phone);
    formData.append("duration", String(duration));
    formData.append("empresa_id", String(user?.empresa_id));
    formData.append("usuario_id", String(user?.id));
    formData.append("type", "voice");
    appendReplyFormData(formData, replyingToMessage);

    try {
      const response = await fetch(`${API_BASE}/atendimento/upload_audio`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Falha no envio do audio.");

      await fetchMessages();
      setReplyingToMessage(null);
      scrollToBottom("smooth");
    } catch (error) {
      console.error("Erro ao enviar audio:", error);
      alert("Nao foi possivel enviar o audio.");
    } finally {
      setIsSendingAudio(false);
    }
  };

  const handleOpenCamera = () => {
    if (isComposerLocked) {
      showMetaWindowExpiredAlert();
      return;
    }
    setIsMediaSheetOpen(false);
    setIsEmojiPickerOpen(false);
    setIsRecordingMode(false);

    if (isMobileCameraDevice()) {
      cameraInputRef.current?.click();
      return;
    }

    setIsCameraMode(true);
  };

  const handleCameraSend = (photoBlob: Blob) => {
    const extension = photoBlob.type.includes("png") ? "png" : "jpg";
    const photoFile = new File(
      [photoBlob],
      `camera_${Date.now()}.${extension}`,
      {
        type: photoBlob.type || "image/jpeg",
      },
    );

    const attached = attachMediaFiles([photoFile]);
    if (attached) {
      setIsCameraMode(false);
    }
  };

  const shouldCollapseMessageText = (text?: string | null) => {
    const value = normalizeChatText(text);
    if (value.length > MESSAGE_TEXT_COLLAPSE_CHAR_LIMIT) return true;

    return value.split(/\r\n|\r|\n/).length > MESSAGE_TEXT_COLLAPSE_LINE_LIMIT;
  };

  const handleToggleExpandedMessageText = (messageId: number) => {
    setExpandedMessageTextIds((current) => {
      if (current[messageId]) {
        const next = { ...current };
        delete next[messageId];
        return next;
      }

      return { ...current, [messageId]: true };
    });
  };

  const renderMessageText = (
    msg: Extract<ChatWindowMessage, { type: "chat" | "text" }>,
  ) => {
    if (msg.deleted) {
      return <p className="message-text message-text--deleted">Mensagem apagada</p>;
    }

    const isCollapsible = shouldCollapseMessageText(msg.text);
    const isExpanded = Boolean(expandedMessageTextIds[msg.id]);
    const textId = `message-text-${msg.id}`;

    if (!isCollapsible) {
      return <p className="message-text">{renderWhatsAppText(msg.text)}</p>;
    }

    return (
      <div className="message-text-block">
        <p
          id={textId}
          className={`message-text${
            isExpanded ? "" : " message-text--collapsed"
          }`}
        >
          {renderWhatsAppText(msg.text)}
        </p>
        <button
          type="button"
          className="message-text-toggle"
          onClick={() => handleToggleExpandedMessageText(msg.id)}
          aria-expanded={isExpanded}
          aria-controls={textId}
        >
          {isExpanded ? "Mostrar menos" : "Ler mais"}
        </button>
      </div>
    );
  };

  const renderLocationCard = (msg: Extract<Message, { type: "media" }>) => {
    const payload = readLocationPayload(msg.structuredData);
    const mapUrl =
      payload?.url || buildMapUrl(payload?.latitude, payload?.longitude);
    const title = payload?.name || "Localização compartilhada";
    const subtitle = payload?.address || "Toque para abrir a localização no mapa";
    const hasCoordinates =
      typeof payload?.latitude === "number" &&
      typeof payload?.longitude === "number";
    const coordinatesLabel = hasCoordinates
      ? `${payload.latitude!.toFixed(5)}, ${payload.longitude!.toFixed(5)}`
      : null;
    const handleOpenMap = () => {
      if (!mapUrl) return;
      window.open(mapUrl, "_blank", "noopener,noreferrer");
    };
    const previewContent = (
      <>
        {hasCoordinates ? (
          <MapContainer
            center={[payload.latitude!, payload.longitude!]}
            zoom={16}
            zoomControl={false}
            attributionControl={false}
            dragging={false}
            doubleClickZoom={false}
            scrollWheelZoom={false}
            touchZoom={false}
            boxZoom={false}
            keyboard={false}
            className="location-card-preview__map"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker
              position={[payload.latitude!, payload.longitude!]}
              icon={locationMarkerIcon}
            />
          </MapContainer>
        ) : (
          <div className="location-card-preview__fallback" aria-hidden="true">
            <FiMapPin size={26} />
          </div>
        )}
        {coordinatesLabel ? (
          <div className="location-card-preview__coords">
            {coordinatesLabel}
          </div>
        ) : null}
        <div className="location-card-preview__badge">Mapa</div>
      </>
    );

    return (
      <div className="structured-message-card structured-message-card--location">
        {mapUrl ? (
          <div
            className="location-card-preview location-card-preview--interactive"
            role="link"
            tabIndex={0}
            aria-label="Abrir localização no mapa"
            onClick={handleOpenMap}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpenMap();
              }
            }}
          >
            {previewContent}
          </div>
        ) : (
          <div className="location-card-preview">{previewContent}</div>
        )}

        <div className="structured-message-card__body">
          <strong className="structured-message-card__title">{title}</strong>
          <p className="structured-message-card__text">{subtitle}</p>

          {coordinatesLabel ? (
            <p className="structured-message-card__meta">
              {coordinatesLabel}
            </p>
          ) : null}

          {!payload && msg.caption ? (
            <p className="structured-message-card__text">{msg.caption}</p>
          ) : null}
        </div>

        {mapUrl ? (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="structured-message-card__cta"
          >
            Google Maps
          </a>
        ) : (
          <div className="structured-message-card__cta structured-message-card__cta--disabled">
            Localização sem link disponível
          </div>
        )}
      </div>
    );
  };

  const renderContactsCard = (msg: Extract<Message, { type: "media" }>) => {
    const payload = readContactsPayload(msg.structuredData);
    const contacts = Array.isArray(payload?.contacts) ? payload.contacts : [];

    if (!contacts.length) {
      return (
        <div className="structured-message-card">
          <div className="structured-message-card__header">
            <FiUser size={18} />
            <strong>Contato compartilhado</strong>
          </div>
          {msg.caption ? (
            <p className="structured-message-card__text">{msg.caption}</p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="structured-message-card structured-message-card--contacts">
        {contacts.map((contact, index) => {
          const phones = Array.isArray(contact.phones) ? contact.phones : [];
          const emails = Array.isArray(contact.emails) ? contact.emails : [];
          const urls = Array.isArray(contact.urls) ? contact.urls : [];
          const companyLabel = [
            contact.org?.company,
            contact.org?.department,
            contact.org?.title,
          ]
            .filter(Boolean)
            .join(" | ");
          const title = normalizeContactDisplayName(
            contact,
            `Contato ${index + 1}`,
          );

          return (
            <div key={`${title}-${index}`} className="structured-contact-card">
              <div className="structured-message-card__header">
                <FiUser size={18} />
                <strong>{title}</strong>
              </div>
              {companyLabel ? (
                <p className="structured-message-card__meta">{companyLabel}</p>
              ) : null}
              {phones.map((phone, phoneIndex) =>
                phone?.phone ? (
                  <a
                    key={`${title}-phone-${phoneIndex}`}
                    href={`tel:${phone.phone}`}
                    className="structured-message-card__row"
                  >
                    <FiPhone size={14} />
                    <span>{phone.phone}</span>
                  </a>
                ) : null,
              )}
              {emails.map((email, emailIndex) =>
                email?.email ? (
                  <a
                    key={`${title}-email-${emailIndex}`}
                    href={`mailto:${email.email}`}
                    className="structured-message-card__row"
                  >
                    <FiMail size={14} />
                    <span>{email.email}</span>
                  </a>
                ) : null,
              )}
              {urls.map((item, urlIndex) =>
                item?.url ? (
                  <a
                    key={`${title}-url-${urlIndex}`}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="structured-message-card__row"
                  >
                    <FiGlobe size={14} />
                    <span>{item.url}</span>
                  </a>
                ) : null,
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderMetaReferralCard = (msg: Extract<Message, { type: "media" }>) => {
    const payload =
      readMetaReferralPayload(msg.structuredData) ||
      parseLegacyMetaReferralPayload(msg.caption);
    const headline = String(payload?.headline || "").trim() || "Lead do Meta Ads";
    const body = String(payload?.body || "").trim();
    const sourceType = String(payload?.source_type || "").trim();
    const sourceId = String(payload?.source_id || "").trim();
    const mediaType = String(payload?.media_type || "").trim();
    const sourceUrl = buildApiMediaUrl(payload?.source_url);
    const imageUrl = buildApiMediaUrl(payload?.image_url);
    const videoUrl = buildMetaReferralVideoPreviewUrl(
      payload?.video_url,
      user?.empresa_id,
    );
    const resolvedVideoUrl =
      videoUrl ||
      (looksLikeDirectVideoUrl(sourceUrl)
        ? buildMetaReferralVideoPreviewUrl(sourceUrl, user?.empresa_id)
        : undefined);
    const isVideoAd = mediaType.toLowerCase() === "video";
    const fallbackText = String(msg.caption || "").trim();
    const hasDetails = Boolean(body || sourceType || sourceId || mediaType || sourceUrl);
    const shouldShowFallbackText =
      Boolean(fallbackText) &&
      fallbackText.toLowerCase() !== "lead originado por anuncio do meta ads";

    return (
      <div className="structured-message-card structured-message-card--meta-referral">
        <div className="meta-referral-card__badge">Meta Ads</div>

        {resolvedVideoUrl && isVideoAd ? (
          <div className="meta-referral-card__preview">
            <video
              src={resolvedVideoUrl}
              controls
              preload="metadata"
              playsInline
              className="meta-referral-card__video"
            />
          </div>
        ) : imageUrl ? (
          <a
            href={sourceUrl || imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="meta-referral-card__preview"
          >
            <img
              src={imageUrl}
              alt={headline}
              className="meta-referral-card__image"
            />
          </a>
        ) : isVideoAd ? (
          <div className="meta-referral-card__preview meta-referral-card__preview--fallback meta-referral-card__preview--video">
            <FiFilm size={24} />
            <span>Video do anuncio sem preview</span>
          </div>
        ) : (
          <div className="meta-referral-card__preview meta-referral-card__preview--fallback">
            <FiImage size={24} />
            <span>Anuncio identificado</span>
          </div>
        )}

        <div className="structured-message-card__body">
          <strong className="structured-message-card__title structured-message-card__title--meta-referral">
            {headline}
          </strong>

          {body ? <p className="structured-message-card__text">{body}</p> : null}

          {!hasDetails && shouldShowFallbackText ? (
            <p className="structured-message-card__text">{fallbackText}</p>
          ) : null}

          {sourceType || mediaType ? (
            <div className="meta-referral-card__chips">
              {sourceType ? (
                <span className="meta-referral-card__chip">
                  Origem: {sourceType}
                </span>
              ) : null}
              {mediaType ? (
                <span className="meta-referral-card__chip">
                  Midia: {mediaType}
                </span>
              ) : null}
            </div>
          ) : null}

          {sourceId ? (
            <p className="structured-message-card__meta">Source ID: {sourceId}</p>
          ) : null}
        </div>

        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="structured-message-card__cta"
          >
            <FiGlobe size={14} />
            <span>Abrir origem do anuncio</span>
          </a>
        ) : (
          <div className="structured-message-card__cta structured-message-card__cta--disabled">
            Origem do anuncio sem link disponivel
          </div>
        )}
      </div>
    );
  };

  const renderMediaContent = (msg: Message) => {
    if (msg.type !== "media") return null;
    switch (msg.mediaType) {
      case "image":
        return (
          <button type="button" className="chat-media-image-trigger" aria-label="Ampliar imagem" onClick={() => setViewerImageId(msg.id)}>
            <img
              src={msg.mediaUrl}
              alt={msg.fileName}
              className="media-image"
            />
          </button>
        );
      case "video":
        return <video src={msg.mediaUrl} controls className="media-video" />;
      case "audio":
        return (
          <ChatAudioPlayer mediaUrl={msg.mediaUrl} messageId={msg.id} />
        );
      case "sticker":
        return (
          <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={msg.mediaUrl}
              alt={msg.fileName || "Sticker"}
              className="media-sticker"
            />
          </a>
        );
      case "document":
        return (
          <a
            href={msg.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={msg.fileName}
            className="media-document"
            onClick={() => {
              const mediaUrl = msg.mediaUrl || "";
              let safeUrl = mediaUrl;
              try {
                const parsedUrl = new URL(mediaUrl, window.location.origin);
                safeUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
              } catch {
                // Keep the original relative value for diagnostics.
              }
              console.log("[ChatWindow] download de documento solicitado", {
                conversation_id: conversation.id,
                message_id: msg.id,
                file_name: msg.fileName || null,
                media_type: msg.mediaType,
                media_url: safeUrl,
                has_media_url: Boolean(msg.mediaUrl),
              });
            }}
          >
            <FiFileText size={24} />
            <span>{msg.fileName}</span>
            <FiDownload size={20} />
          </a>
        );
      case "location":
        return renderLocationCard(msg);
      case "contacts":
        return renderContactsCard(msg);
      case "meta_referral":
        return renderMetaReferralCard(msg);
      default:
        return <p>Tipo de midia nao suportado.</p>;
    }
  };

  const shouldShowMediaCaption = (msg: Message) => {
    if (msg.type !== "media" || !("caption" in msg) || !msg.caption) {
      return false;
    }

    if (isPlaceholderMediaCaption(msg.caption, msg.mediaType)) {
      return false;
    }

    if (
      (
        msg.mediaType === "location" ||
        msg.mediaType === "contacts" ||
        msg.mediaType === "meta_referral"
      ) &&
      msg.structuredData
    ) {
      return false;
    }

    if (msg.mediaType === "meta_referral") {
      return false;
    }

    return true;
  };

  const renderReplyPreview = (msg: ChatWindowMessage) => {
    if (!("replyTo" in msg) || !msg.replyTo?.text) {
      return null;
    }

    const hasReplyTarget = Boolean(msg.replyMessageId);

    return (
      <button
        type="button"
        className={`reply-preview ${hasReplyTarget ? "reply-preview--clickable" : ""}`}
        onClick={
          hasReplyTarget
            ? () => handleJumpToReplyMessage(msg.replyMessageId)
            : undefined
        }
        disabled={!hasReplyTarget}
      >
        <span className="reply-preview__label">Em resposta a</span>
        <span className="reply-preview__text">{msg.replyTo.text}</span>
      </button>
    );
  };

  const renderTemplatePreview = (templateData?: TemplateMessageData) => {
    if (!templateData) return null;

    const normalizedButtons = Array.isArray(templateData.buttons)
      ? templateData.buttons
      : [];
    const headerMediaUrl = buildApiMediaUrl(templateData.header?.mediaUrl);
    const headerMediaType = String(templateData.header?.mediaType || "")
      .trim()
      .toLowerCase();

    return (
      <div className="template-message-card">
        <div className="template-message-card__badge">Template</div>
        {templateData.templateName && (
          <div className="template-message-card__name">{templateData.templateName}</div>
        )}

        {headerMediaUrl && headerMediaType === "image" && (
          <img
            src={headerMediaUrl}
            alt={templateData.templateName || "Template"}
            className="template-message-card__image"
          />
        )}

        {headerMediaUrl && headerMediaType === "video" && (
          <a
            href={headerMediaUrl}
            target="_blank"
            rel="noreferrer"
            className="template-message-card__media-link"
          >
            <FiFilm size={14} />
            <span>Video do template</span>
          </a>
        )}

        {headerMediaUrl && headerMediaType === "document" && (
          <a
            href={headerMediaUrl}
            target="_blank"
            rel="noreferrer"
            className="template-message-card__media-link"
          >
            <FiFileText size={14} />
            <span>Documento do template</span>
          </a>
        )}

        {templateData.header?.text && (
          <div className="template-message-card__header">
            {templateData.header.text}
          </div>
        )}

        {templateData.bodyText && (
          <p className="template-message-card__body">{templateData.bodyText}</p>
        )}

        {templateData.footerText && (
          <div className="template-message-card__footer">
            {templateData.footerText}
          </div>
        )}

        {normalizedButtons.length > 0 && (
          <div className="template-message-card__buttons">
            {normalizedButtons.map((button) => {
              const buttonType = String(button.type || "").trim().toUpperCase();
              const buttonKey = `${button.index}-${button.text || buttonType}`;
              const buttonLabel =
                button.text ||
                (buttonType === "URL"
                  ? button.url
                  : buttonType === "PHONE_NUMBER"
                    ? button.phoneNumber
                    : buttonType) ||
                "Botao";

              return (
                <div key={buttonKey} className="template-message-card__button">
                  {buttonType === "URL" ? <FiGlobe size={13} /> : null}
                  {buttonType === "PHONE_NUMBER" ? <FiPhone size={13} /> : null}
                  {buttonType !== "URL" && buttonType !== "PHONE_NUMBER" ? (
                    <FiSend size={13} />
                  ) : null}
                  <span>{buttonLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const filteredConversationGalleryMessages = conversationGalleryMessages.filter((message) => {
    if (conversationGalleryFilter === "all") return true;
    if (conversationGalleryFilter === "image") {
      return message.mediaType === "image" || message.mediaType === "sticker";
    }
    return message.mediaType === conversationGalleryFilter;
  });
  const visibleConversationGalleryMessages = filteredConversationGalleryMessages.slice(
    0,
    conversationGalleryVisibleCount,
  );
  const markGalleryMediaUnavailable = (messageId: number) => {
    setUnavailableGalleryMediaIds((current) => {
      if (current.has(messageId)) return current;
      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  };

  return (
    <main className={`chat-window-container ${isLocked ? "is-locked" : ""}`}>
      {viewerImageId !== null && (
        <ChatImageViewer
          key={conversation.id}
          selectedId={viewerImageId}
          images={messages.flatMap((message) => message.type === "media" && message.mediaType === "image" && message.mediaUrl && !message.deleted ? [{
            id: message.id,
            url: message.mediaUrl,
            name: message.fileName || `imagem-${message.id}.jpg`,
            sender: message.sender === "customer" ? conversation.name : message.agentName || "Você",
            timestamp: message.timestamp,
            caption: message.caption,
          }] : [])}
          reactions={COMMON_MESSAGE_REACTIONS}
          canInteract={!readOnly && !isLocked && !isComposerLocked}
          onSelect={setViewerImageId}
          onClose={() => setViewerImageId(null)}
          onReply={(id) => {
            const message = messages.find((item) => item.id === id);
            setViewerImageId(null);
            if (message) handleReplyToMessage(message);
          }}
          onDownload={(id) => {
            const message = messages.find((item) => item.id === id);
            if (message?.type === "media") void handleDownloadMessageMedia(message);
          }}
          onReact={async (id, reaction) => {
            const message = messages.find((item) => item.id === id);
            if (message) await handleSetMessageReaction(message, reaction);
          }}
        />
      )}
      {isLocked && <div className="chat-overlay">{children}</div>}

      <header className="chat-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>
            <FiArrowLeft size={22} />
          </button>
          <div
            className="chat-header-info"
            role="button"
            tabIndex={0}
            onClick={onInfoClick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onInfoClick();
              }
            }}
          >
            <div className="chat-header-name-row">
              <span
                className={`status-indicator status-indicator--mobile ${readOnly || isComposerLocked ? "offline" : ""}`}
              ></span>
              <h3 className="chat-customer-name">
                <span>{conversation.name}</span>
                {conversationPhoneLabel ? (
                  <small className="chat-customer-phone-inline">
                    {conversationPhoneLabel}
                  </small>
                ) : null}
              </h3>
              <button
                type="button"
                className="chat-header-more-button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsHeaderDetailsOpen((current) => !current);
                }}
                onKeyDown={(event) => event.stopPropagation()}
                aria-label="Ver mais informações do atendimento"
                aria-expanded={isHeaderDetailsOpen}
              >
                <FiChevronDown size={18} />
              </button>
            </div>

            <div className="chat-header-details-desktop">
                <p className="chat-attendance-line">
                  <span className="chat-attendance-label">
                  {readOnly ? readOnlyAttendanceLabel : "Em atendimento por:"}
                  </span>
                  <span className="chat-attendance-value">
                    {conversation.attendent || "Sem atendente"}
                </span>
              </p>
              {(conversation.metaAccountDisplayPhoneNumber ||
                conversation.metaAccountName) && (
                <p className="meta-account-line">
                  <span className="chat-attendance-label">Meta:</span>
                  <span className="chat-attendance-value">
                    {conversation.metaAccountDisplayPhoneNumber || "-"}
                    {conversation.metaAccountName
                      ? ` | ${conversation.metaAccountName}`
                      : ""}
                  </span>
                </p>
              )}
            </div>

            {isHeaderDetailsOpen ? (
              <div className="chat-header-details-popover">
                <p className="chat-attendance-line">
                  <span className="chat-attendance-label">
                    {readOnly ? readOnlyAttendanceLabel : "Em atendimento por:"}
                  </span>
                  <span className="chat-attendance-value">
                    {conversation.attendent || "Sem atendente"}
                  </span>
                </p>
                {(conversation.metaAccountDisplayPhoneNumber ||
                  conversation.metaAccountName) && (
                  <p className="meta-account-line">
                    <span className="chat-attendance-label">Meta:</span>
                    <span className="chat-attendance-value">
                      {conversation.metaAccountDisplayPhoneNumber || "-"}
                      {conversation.metaAccountName
                        ? ` | ${conversation.metaAccountName}`
                        : ""}
                    </span>
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="header-right">
          <div
            className={`status-pill status-pill--desktop ${readOnly || isComposerLocked ? "offline" : ""}`}
          >
            <span
              className={`status-indicator ${readOnly || isComposerLocked ? "offline" : ""}`}
            ></span>
            <p>{statusLabel}</p>
          </div>
          <button
            className="conversation-gallery-button"
            onClick={handleOpenConversationGallery}
            title="Midias da conversa"
            aria-label="Abrir galeria de midias da conversa"
            type="button"
          >
            <FiGrid size={21} />
          </button>
          {!readOnly && (
            <>
              {showTransferButton ? (
                <button
                  className="transfer-button"
                  onClick={onTransferAttendant}
                  title="Trocar atendente"
                  type="button"
                >
                  <FiRepeat size={20} />
                </button>
              ) : null}
              <button
                className="finalize-button"
                onClick={() => onFinalizeChat(conversation.id)}
                title="Finalizar Atendimento"
              >
                <FiCheckSquare size={22} />
              </button>
            </>
          )}
          <button className="info-button" onClick={onInfoClick}>
            <FiInfo size={22} />
          </button>
        </div>
      </header>

      <div className="message-list" ref={messageListRef}>
        {hasMoreBefore ? (
          <button
            type="button"
            className="load-older-messages-button"
            onClick={() => void fetchMessages({ mode: "before" })}
            disabled={isLoadingOlderMessages}
          >
            {isLoadingOlderMessages
              ? "Carregando mensagens antigas..."
              : "Carregar mensagens antigas"}
          </button>
        ) : null}
        {messages.map((msg) => {
          if (msg.type === "event") {
            return (
              <div key={msg.id} className="event-message">
                <span>{msg.text}</span>
              </div>
            );
          }

          const bubbleClassName = [
            "message-bubble",
            msg.type === "chat" &&
            "templateData" in msg &&
            msg.templateData
              ? "message-bubble--template"
              : "",
            msg.type === "media" && msg.mediaType === "sticker"
              ? "message-bubble--sticker"
              : "",
            msg.type === "media" && msg.mediaType === "location"
              ? "message-bubble--location"
              : "",
          ]
            .filter(Boolean)
            .join(" ");

          const isMessageMenuOpen = openMessageMenuId === msg.id;
          const messageReaction = messageReactions[String(msg.id)];
          const wrapperClassName = [
            "message-wrapper",
            msg.sender,
            highlightedMessageId === msg.id ? "message-wrapper--highlight" : "",
            isMessageMenuOpen || openReactionPickerId === msg.id
              ? "message-wrapper--menu-open"
              : "",
            msg.type === "media" && msg.mediaType === "sticker"
              ? "message-wrapper--sticker"
              : "",
            msg.type === "media" && msg.mediaType === "location"
              ? "message-wrapper--location"
              : "",
          ]
            .filter(Boolean)
            .join(" ");
          const deliveryStatusNode =
            msg.sender === "agent"
              ? renderMessageDeliveryStatus(
                  msg.deliveryStatus,
                  msg.deliveryStatusLabel,
                )
              : null;
          const editedBadgeNode = msg.deleted
            ? null
            : renderEditedBadge(msg.edited);
          const deletedBadgeNode = renderDeletedBadge(msg.deleted);

          return (
            <div
              key={msg.id}
              className={wrapperClassName}
              ref={(node) => {
                if (node) {
                  messageElementRefs.current.set(msg.id, node);
                } else {
                  messageElementRefs.current.delete(msg.id);
                }
              }}
            >
              {highlightedMessageId === msg.id ? (
                <span className="message-highlight-band" aria-hidden="true" />
              ) : null}
              <div className={bubbleClassName}>
                <div className="message-bubble-header">
                  {msg.sender === "agent" && msg.agentName ? (
                    <p className="agent-name">{msg.agentName}</p>
                  ) : msg.sender === "customer" ? (
                    <p className="message-sender-name">{conversation.name}</p>
                  ) : (
                    <span className="message-bubble-header__spacer" />
                  )}
                  <div className="message-actions">
                    <button
                      type="button"
                      className="message-actions__trigger"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleToggleMessageMenu(msg.id, event.currentTarget);
                      }}
                      aria-label="Abrir opcoes da mensagem"
                      aria-expanded={isMessageMenuOpen}
                    >
                      <FiChevronDown size={16} />
                    </button>
                    {isMessageMenuOpen ? (
                      <div
                        className={`message-actions__menu message-actions__menu--${messageMenuDirection}`}
                        role="menu"
                      >
                        <button
                          type="button"
                          className="message-actions__item"
                          onClick={() => handleReplyToMessage(msg)}
                          role="menuitem"
                        >
                          <FiCornerUpLeft size={15} />
                          <span>Responder</span>
                        </button>
                        <button
                          type="button"
                          className="message-actions__item"
                          onClick={() => void handleCopyMessage(msg)}
                          role="menuitem"
                        >
                          <FiCopy size={15} />
                          <span>Copiar</span>
                        </button>
                        {msg.sender === "customer" &&
                        msg.type === "media" &&
                        Boolean(msg.mediaUrl) &&
                        !["location", "contacts", "meta_referral"].includes(msg.mediaType) ? (
                          <button
                            type="button"
                            className="message-actions__item"
                            onClick={() => void handleDownloadMessageMedia(msg)}
                            role="menuitem"
                          >
                            <FiDownload size={15} />
                            <span>Baixar midia</span>
                          </button>
                        ) : null}
                        <div className="message-actions__reaction-anchor">
                          <button
                            type="button"
                            className="message-actions__item"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenReactionPickerId((current) =>
                                current === msg.id ? null : msg.id,
                              );
                            }}
                            role="menuitem"
                            aria-expanded={openReactionPickerId === msg.id}
                          >
                            <FiSmile size={15} />
                            <span>Reagir</span>
                          </button>
                          {openReactionPickerId === msg.id ? (
                            <div
                              className={`message-actions__reaction-popover message-actions__reaction-popover--${messageMenuDirection}`}
                              role="group"
                              aria-label="Escolher reacao"
                            >
                              <div className="message-actions__reaction-options">
                                {COMMON_MESSAGE_REACTIONS.map((reaction) => (
                                  <button
                                    key={reaction}
                                    type="button"
                                    className={`message-actions__reaction-button${
                                      messageReaction === reaction ? " is-active" : ""
                                    }`}
                                    onClick={() =>
                                      void handleSetMessageReaction(msg, reaction)
                                    }
                                    aria-label={`Reagir com ${reaction}`}
                                  >
                                    {reaction}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        {msg.sender === "agent" ? (
                          <button
                            type="button"
                            className="message-actions__item"
                            onClick={handleEditMessage}
                            role="menuitem"
                          >
                            <FiEdit2 size={15} />
                            <span>Editar</span>
                          </button>
                        ) : null}
                        {!msg.deleted ? (
                          <button
                            type="button"
                            className="message-actions__item message-actions__item--danger"
                            onClick={() => void handleHideMessage(msg)}
                            role="menuitem"
                          >
                            <FiTrash2 size={15} />
                            <span>Apagar da plataforma</span>
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                {renderReplyPreview(msg)}
                {msg.type === "chat" && (
                  "templateData" in msg && msg.templateData ? (
                    renderTemplatePreview(msg.templateData)
                  ) : (
                    renderMessageText(msg)
                  )
                )}
                {msg.type === "media" && (
                  msg.deleted ? (
                    <p className="message-text message-text--deleted">Mensagem apagada</p>
                  ) : (
                    <>
                      {renderMediaContent(msg)}
                      {shouldShowMediaCaption(msg) && (
                        <p className="media-caption">
                          {renderWhatsAppText(msg.caption)}
                        </p>
                      )}
                    </>
                  )
                )}

                {messageReaction ? (
                  <span className="message-reaction">{messageReaction}</span>
                ) : null}
                <span className="message-timestamp">
                  {formatMessageDateTime(msg.timestamp)}
                  {deletedBadgeNode}
                  {editedBadgeNode}
                  {deliveryStatusNode}
                </span>
              </div>
              {msg.sender === "agent" ? (
                <div className="message-avatar">
                  <Avatar
                    name={
                      msg.agentName ||
                      (msg.isSystemGenerated || !msg.messageUserId
                        ? "Sistema"
                        : "Usuario")
                    }
                    imageUrl={resolveAgentAvatarUrl(msg)}
                    icon={
                      msg.isSystemGenerated || !msg.messageUserId ? (
                        <FiUser />
                      ) : undefined
                    }
                    size="xsmall"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {readOnly ? (
        <div className="chat-readonly-footer">
          <div className="chat-readonly-footer__content">
            <strong>{readOnlyFooterTitle}</strong>
            <p>{readOnlyFooterDescription}</p>
          </div>
          {readOnlyFooterActions.length > 0 || onAnalyzeConversationIa ? (
            <div className="chat-readonly-footer__actions">
              {readOnlyFooterActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={`chat-readonly-footer__button ${
                    action.tone === "danger"
                      ? "chat-readonly-footer__button--danger"
                      : ""
                  }`.trim()}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  <span>{action.label}</span>
                </button>
              ))}
              {onAnalyzeConversationIa ? (
                <button
                  type="button"
                  className="chat-readonly-footer__button"
                  onClick={onAnalyzeConversationIa}
                >
                  <FiCpu size={16} />
                  <span>Analisar atendimento com IA</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={`message-input-container ${
            isDraggingFileOverComposer ? "message-input-container--dragging" : ""
          }`}
          onDragEnter={handleComposerDragEnter}
          onDragOver={handleComposerDragOver}
          onDragLeave={handleComposerDragLeave}
          onDrop={handleComposerDrop}
        >
          {isComposerLocked ? (
            <div className="meta-window-lock-notice">
              <strong>
                {isAwaitingTemplateReply
                  ? "Aguardando resposta do cliente"
                  : "Envio bloqueado pela janela de 24h da Meta"}
              </strong>
              <p>
                {composerLockMessage}
              </p>
              {!isAwaitingTemplateReply && metaWindowExpiryLabel && (
                <span>Janela encerrada em {metaWindowExpiryLabel}.</span>
              )}
              {!isAwaitingTemplateReply && onOpenTemplateDispatch ? (
                <div className="meta-window-lock-actions">
                  <button
                    type="button"
                    className="meta-window-lock-button"
                    onClick={onOpenTemplateDispatch}
                  >
                    Enviar template
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isComposerLocked &&
            quickMessagesEnabled &&
            showCommands &&
            filteredCommands.length > 0 && (
              <div className="commands-popup">
                <ul className="commands-list">
                  {filteredCommands.map((cmd) => (
                    <li
                      key={cmd.id}
                      className="command-item"
                      onClick={() => void handleCommandSelect(cmd)}
                    >
                      <div className="command-item-main">
                        <strong className="command-name">/{cmd.command}</strong>
                        <span className="command-description">
                          {cmd.description}
                        </span>
                      </div>
                      <div className="command-item-meta">
                        {cmd.image_url ? (
                          <span className="command-image-chip">
                            <FiImage size={14} />
                            Imagem
                          </span>
                        ) : null}
                        {cmd.document_url ? (
                          <span className="command-image-chip">
                            <FiFileText size={14} />
                            Documento
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {isRecordingMode ? (
            <AudioRecorder
              onSend={handleAudioSend}
              onCancel={() => setIsRecordingMode(false)}
            />
          ) : (
            <>
            {replyingToMessage ? (
              <div className="composer-reply-preview">
                <div className="composer-reply-preview__content">
                  <span>Respondendo</span>
                  <strong>{getMessageReplyText(replyingToMessage)}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingToMessage(null)}
                  aria-label="Cancelar resposta"
                >
                  x
                </button>
              </div>
            ) : null}
            {hasPendingMediaFiles ? (
              <div className="composer-attachments" aria-label="Arquivos anexados">
                <div className="composer-attachments__header">
                  <span>
                    {isSendingMedia
                      ? "Enviando anexos..."
                      : "Arquivos anexados"}
                  </span>
                  <strong>
                    {pendingMediaFiles.length}/{MAX_COMPOSER_ATTACHMENTS}
                  </strong>
                </div>
                <ul className="composer-attachments__list">
                  {pendingMediaFiles.map((item) => {
                    const fileType = item.file.type || "";
                    const fileName = item.file.name || "Arquivo sem nome";
                    const AttachmentIcon = fileType.startsWith("image/")
                      ? FiImage
                      : fileType.startsWith("video/")
                        ? FiFilm
                        : FiFileText;

                    return (
                      <li key={item.id} className="composer-attachments__item">
                        <AttachmentIcon size={18} />
                        <div className="composer-attachments__file">
                          <span title={fileName}>{fileName}</span>
                          <small>
                            {formatFileSize(item.file.size)}
                            {willSendAttachmentAsLink(item.file) ? " • sera enviado como link" : ""}
                          </small>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingMediaFile(item.id)}
                          disabled={isSendingMedia}
                          aria-label={`Remover ${fileName}`}
                          title="Remover anexo"
                        >
                          <FiX size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {isSendingMedia && uploadingMediaFiles.length ? (
              <div
                className="composer-upload-status"
                aria-live="polite"
                aria-label="Midias em envio"
              >
                <div className="composer-upload-status__header">
                  <div className="composer-upload-status__title">
                    <span className="composer-upload-status__spinner" aria-hidden="true" />
                    <strong>
                      {uploadingMediaFiles.length > 1
                        ? "Enviando midias..."
                        : "Enviando midia..."}
                    </strong>
                  </div>
                  <span>
                    {uploadingMediaFiles.length} arquivo
                    {uploadingMediaFiles.length > 1 ? "s" : ""}
                  </span>
                </div>
                <ul className="composer-upload-status__list">
                  {uploadingMediaFiles.map((item) => {
                    const fileType = item.file.type || "";
                    const fileName = item.file.name || "Arquivo sem nome";
                    const UploadIcon = fileType.startsWith("image/")
                      ? FiImage
                      : fileType.startsWith("video/")
                        ? FiFilm
                        : FiFileText;

                    return (
                      <li key={item.id} className="composer-upload-status__item">
                        <UploadIcon size={18} />
                        <div className="composer-upload-status__file">
                          <span title={fileName}>{fileName}</span>
                          <small>
                            {formatFileSize(item.file.size)}
                            {willSendAttachmentAsLink(item.file) ? " • enviado como link" : ""}
                          </small>
                        </div>
                        <span className="composer-upload-status__badge">
                          Enviando
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            <form className="message-input-area" onSubmit={handleSubmit}>
              {isDraggingFileOverComposer ? (
                <div className="message-input-drop-overlay" aria-hidden="true">
                  <FiPaperclip size={18} />
                  <span>Solte para enviar o arquivo</span>
                </div>
              ) : null}
              <div className="composer-tools" ref={mediaMenuRef}>
                {isMediaSheetOpen && !isComposerLocked && !isCorrectingMessage ? (
                  <div className="media-sheet">
                    <ul>
                      <li
                        className="media-sheet-item"
                        onClick={() => photoVideoInputRef.current?.click()}
                      >
                        <FiFilm size={22} />
                        <span>Fotos e videos</span>
                      </li>
                      <li
                        className="media-sheet-item"
                        onClick={() => stickerInputRef.current?.click()}
                      >
                        <FiImage size={22} />
                        <span>Stickers</span>
                      </li>
                      <li
                        className="media-sheet-item"
                        onClick={() => documentInputRef.current?.click()}
                      >
                        <FiPaperclip size={22} />
                        <span>Arquivos</span>
                      </li>
                      <li
                        className="media-sheet-item"
                        onClick={() => {
                          setIsMediaSheetOpen(false);
                          setIsLocationModalOpen(true);
                        }}
                      >
                        <FiMapPin size={22} />
                        <span>Localização</span>
                      </li>
                      <li
                        className="media-sheet-item"
                        onClick={() => {
                          setIsMediaSheetOpen(false);
                          setIsContactModalOpen(true);
                        }}
                      >
                        <FiUser size={22} />
                        <span>Contato</span>
                      </li>
                      {showProductGalleryButton ? (
                        <li
                          className="media-sheet-item"
                          onClick={() => {
                            setIsMediaSheetOpen(false);
                            onOpenProductGallery?.();
                          }}
                        >
                          <FiPackage size={22} />
                          <span>Produtos</span>
                        </li>
                      ) : null}
                      {showDocumentGalleryButton ? (
                        <li
                          className="media-sheet-item"
                          onClick={() => {
                            setIsMediaSheetOpen(false);
                            onOpenDocumentGallery?.();
                          }}
                        >
                          <FiFileText size={22} />
                          <span>Documentos</span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
                {isEmojiPickerOpen && !isComposerLocked && !isCorrectingMessage ? (
                  <div className="emoji-picker" aria-label="Selecionar emoji">
                    {COMMON_COMPOSER_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="emoji-picker__item"
                        onClick={() => handleEmojiSelect(emoji)}
                        aria-label={`Inserir emoji ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="media-button"
                  onClick={() => {
                    setIsEmojiPickerOpen(false);
                    setIsMediaSheetOpen(!isMediaSheetOpen);
                  }}
                  title="Anexar midia"
                  disabled={isComposerLocked || isSendingMedia || isCorrectingMessage}
                >
                  <FiPlus size={24} />
                </button>
                <button
                  type="button"
                  className="media-button emoji-button"
                  onClick={() => {
                    setIsMediaSheetOpen(false);
                    setIsEmojiPickerOpen(!isEmojiPickerOpen);
                  }}
                  title="Emojis"
                  disabled={isComposerLocked || isSendingMedia || isCorrectingMessage}
                >
                  <FiSmile size={22} />
                </button>
              </div>
              <textarea
                ref={(node) => {
                  messageComposerRef.current = node;
                  messageInputRef.current = node;
                }}
                id="message-input"
                placeholder={
                  quickMessagesEnabled
                    ? "Mensagem, / para comandos"
                    : "Mensagem"
                }
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={handleComposerKeyDown}
                onPaste={handleComposerPaste}
                autoComplete="off"
                rows={1}
                disabled={isComposerLocked || isCorrectingMessage}
                aria-busy={isCorrectingMessage}
              />
              <div className="composer-inline-actions">
                <button
                  type="button"
                  className="correction-button"
                  onClick={() => void handleCorrectMessage()}
                  title={isCorrectingMessage ? "Corrigindo texto..." : "Corrigir texto"}
                  aria-label={isCorrectingMessage ? "Corrigindo texto" : "Corrigir texto"}
                  disabled={
                    isSendingMedia ||
                    isComposerLocked ||
                    isCorrectingMessage ||
                    !newMessage.trim() ||
                    (quickMessagesEnabled && newMessage.startsWith("/"))
                  }
                >
                  <FiEdit2 size={18} />
                </button>
                <button
                  type="button"
                  className="camera-button"
                  onClick={handleOpenCamera}
                  title="Abrir camera"
                  disabled={isSendingMedia || isComposerLocked || isCorrectingMessage}
                >
                  <FiCamera size={22} />
                </button>
              </div>
              <button
                type={shouldShowMobileSendButton ? "submit" : "button"}
                className="mic-button"
                onClick={
                  shouldShowMobileSendButton
                    ? undefined
                    : () => {
                        setIsMediaSheetOpen(false);
                        setIsEmojiPickerOpen(false);
                        setIsCameraMode(false);
                        setIsRecordingMode(true);
                      }
                }
                title={
                  shouldShowMobileSendButton
                    ? "Enviar mensagem"
                    : "Gravar audio"
                }
                disabled={isComposerLocked || isSendingMedia || isCorrectingMessage}
              >
                {shouldShowMobileSendButton ? (
                  <FiSend size={22} />
                ) : (
                  <FiMic size={22} />
                )}
              </button>
            </form>
            </>
          )}
        </div>
      )}

      <Modal
        isOpen={Boolean(quickMessageReview)}
        onClose={() => !isSendingMedia && setQuickMessageReview(null)}
        title="Revisar mensagem rapida"
        size="lg"
      >
        {quickMessageReview ? (
          <div className="quick-message-review">
            <div className="quick-message-review__intro">
              <div>
                <span>Comando selecionado</span>
                <strong>/{quickMessageReview.commandName}</strong>
              </div>
              <p>Edite os textos e ajuste a ordem exata antes de enviar.</p>
            </div>

            <div className="quick-message-review__sequence">
              {quickMessageReview.sequence.map((entry, index) => {
                const media = entry.type === "text"
                  ? null
                  : getQuickMessageReviewMedia(
                      quickMessageReview,
                      entry.type,
                      entry.id,
                    );
                const textIndex = entry.type === "text"
                  ? Number(entry.text_index)
                  : Number(entry.caption_text_index);
                const hasCaption = ["image", "video", "document"].includes(entry.type) && Number.isInteger(entry.caption_text_index);
                const itemLabel = entry.type === "text"
                  ? "Texto"
                  : entry.type === "image"
                    ? "Imagem"
                    : entry.type === "video"
                      ? "Video"
                      : entry.type === "audio"
                        ? "Audio"
                        : "Documento";

                return (
                  <article
                    className="quick-message-review__item"
                    key={`${entry.type}-${entry.id ?? entry.text_index}-${index}`}
                  >
                    <div className="quick-message-review__item-header">
                      <span className="quick-message-review__position">{index + 1}</span>
                      <strong>{itemLabel}</strong>
                      <div className="quick-message-review__order-actions">
                        <button
                          type="button"
                          onClick={() => moveQuickMessageReviewItem(index, -1)}
                          disabled={index === 0 || isSendingMedia}
                          title="Mover para cima"
                        >
                          <FiArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveQuickMessageReviewItem(index, 1)}
                          disabled={index === quickMessageReview.sequence.length - 1 || isSendingMedia}
                          title="Mover para baixo"
                        >
                          <FiArrowDown size={16} />
                        </button>
                      </div>
                    </div>

                    {entry.type === "text" ? (
                      <textarea
                        value={quickMessageReview.texts[textIndex] || ""}
                        onChange={(event) => updateQuickMessageReviewText(textIndex, event.target.value)}
                        rows={4}
                        disabled={isSendingMedia}
                        placeholder="Digite o texto da mensagem"
                      />
                    ) : (
                      <div className="quick-message-review__media">
                        {entry.type === "image" && media?.url ? (
                          <img src={media.url} alt={media.name || "Imagem"} />
                        ) : null}
                        {entry.type === "video" && media?.url ? (
                          <video src={media.url} controls preload="metadata" />
                        ) : null}
                        {entry.type === "audio" && media?.url ? (
                          <audio src={media.url} controls preload="metadata" />
                        ) : null}
                        {entry.type === "document" ? <FiFileText size={28} /> : null}
                        <div>
                          <strong>{media?.name || `${itemLabel} sem nome`}</strong>
                          <span>{media?.mime_type || itemLabel}</span>
                        </div>
                      </div>
                    )}

                    {hasCaption ? (
                      <label className="quick-message-review__caption">
                        <span>Legenda do {itemLabel.toLowerCase()}</span>
                        <textarea
                          value={quickMessageReview.texts[textIndex] || ""}
                          onChange={(event) => updateQuickMessageReviewText(textIndex, event.target.value)}
                          rows={3}
                          disabled={isSendingMedia}
                          placeholder={`Digite a legenda do ${itemLabel.toLowerCase()}`}
                        />
                      </label>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <div className="quick-message-review__footer">
              <button
                type="button"
                className="quick-message-review__cancel"
                onClick={() => setQuickMessageReview(null)}
                disabled={isSendingMedia}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="quick-message-review__send"
                onClick={() => void handleConfirmQuickMessage()}
                disabled={isSendingMedia}
              >
                <FiSend size={17} />
                {isSendingMedia ? "Enviando..." : "Confirmar e enviar"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={isLocationModalOpen}
        onClose={closeLocationModal}
        title="Enviar localização"
      >
        <div className="structured-form">
          <div className="structured-form__helper">
            <label className="structured-form__field">
              <span>Usar localizacao da filial</span>
              <select
                className="structured-form__select"
                value={selectedLocationBranchId}
                onChange={(event) =>
                  handleSelectLocationBranch(event.target.value)
                }
                disabled={isLoadingLocationBranches || isSendingStructuredMessage}
              >
                <option value="">
                  {isLoadingLocationBranches
                    ? "Carregando filiais..."
                    : "Selecione uma filial cadastrada"}
                </option>
                {locationBranches
                  .filter((branch) => {
                    const latitude = Number(branch.latitude);
                    const longitude = Number(branch.longitude);
                    return Number.isFinite(latitude) && Number.isFinite(longitude);
                  })
                  .sort(
                    (a, b) =>
                      Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)),
                  )
                  .map((branch) => (
                    <option key={branch.id} value={String(branch.id)}>
                      {branch.name}
                      {branch.isPrimary ? " (Principal)" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <p className="structured-form__hint">
              Preenche o formulario com a localizacao ja cadastrada de uma filial.
            </p>
            {locationBranchesError ? (
              <p className="structured-form__feedback structured-form__feedback--error">
                {locationBranchesError}
              </p>
            ) : null}
            {!isLoadingLocationBranches &&
            !locationBranchesError &&
            !locationBranches.some((branch) => {
              const latitude = Number(branch.latitude);
              const longitude = Number(branch.longitude);
              return Number.isFinite(latitude) && Number.isFinite(longitude);
            }) ? (
              <p className="structured-form__feedback">
                Nenhuma filial com latitude e longitude cadastradas foi encontrada.
              </p>
            ) : null}
          </div>
          <div className="structured-form__helper">
            <button
              type="button"
              className="structured-form__button structured-form__button--secondary structured-form__button--full"
              onClick={handleUseCurrentLocation}
              disabled={isCapturingLocation || isSendingStructuredMessage}
            >
              {isCapturingLocation
                ? "Capturando localização..."
                : "Usar localização atual"}
            </button>
            <p className="structured-form__hint">
              Captura a posição atual do navegador e preenche latitude e longitude automaticamente.
            </p>
            {locationCaptureError ? (
              <p className="structured-form__feedback structured-form__feedback--error">
                {locationCaptureError}
              </p>
            ) : null}
          </div>
          <label className="structured-form__field">
            <span>Latitude</span>
            <input
              type="number"
              step="any"
              value={locationForm.latitude}
              onChange={(event) =>
                setLocationForm((current) => ({
                  ...current,
                  latitude: event.target.value,
                }))
              }
              placeholder="-23.550520"
            />
          </label>
          <label className="structured-form__field">
            <span>Longitude</span>
            <input
              type="number"
              step="any"
              value={locationForm.longitude}
              onChange={(event) =>
                setLocationForm((current) => ({
                  ...current,
                  longitude: event.target.value,
                }))
              }
              placeholder="-46.633308"
            />
          </label>
          <label className="structured-form__field">
            <span>Nome</span>
            <input
              type="text"
              value={locationForm.name}
              onChange={(event) =>
                setLocationForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Loja matriz"
            />
          </label>
          <label className="structured-form__field">
            <span>Endereco</span>
            <input
              type="text"
              value={locationForm.address}
              onChange={(event) =>
                setLocationForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              placeholder="Rua, numero, cidade"
            />
          </label>
          <div className="structured-form__actions">
            <button
              type="button"
              className="structured-form__button structured-form__button--secondary"
              onClick={closeLocationModal}
              disabled={isSendingStructuredMessage || isCapturingLocation}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="structured-form__button"
              onClick={() => void handleSendLocation()}
              disabled={isSendingStructuredMessage || isCapturingLocation}
            >
              {isSendingStructuredMessage ? "Enviando..." : "Enviar localização"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        title="Enviar contato"
      >
        <div className="structured-form">
          <label className="structured-form__field">
            <span>Nome</span>
            <input
              type="text"
              value={contactForm.name}
              onChange={(event) =>
                setContactForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Nome do contato"
            />
          </label>
          <label className="structured-form__field">
            <span>Telefone</span>
            <input
              type="text"
              value={contactForm.phone}
              onChange={(event) =>
                setContactForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              placeholder="+55 11 99999-9999"
            />
          </label>
          <label className="structured-form__field">
            <span>E-mail</span>
            <input
              type="email"
              value={contactForm.email}
              onChange={(event) =>
                setContactForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="contato@empresa.com"
            />
          </label>
          <label className="structured-form__field">
            <span>Empresa</span>
            <input
              type="text"
              value={contactForm.company}
              onChange={(event) =>
                setContactForm((current) => ({
                  ...current,
                  company: event.target.value,
                }))
              }
              placeholder="Empresa"
            />
          </label>
          <label className="structured-form__field">
            <span>Departamento</span>
            <input
              type="text"
              value={contactForm.department}
              onChange={(event) =>
                setContactForm((current) => ({
                  ...current,
                  department: event.target.value,
                }))
              }
              placeholder="Comercial"
            />
          </label>
          <label className="structured-form__field">
            <span>Cargo</span>
            <input
              type="text"
              value={contactForm.title}
              onChange={(event) =>
                setContactForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Consultor"
            />
          </label>
          <div className="structured-form__actions">
            <button
              type="button"
              className="structured-form__button structured-form__button--secondary"
              onClick={() => setIsContactModalOpen(false)}
              disabled={isSendingStructuredMessage}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="structured-form__button"
              onClick={() => void handleSendContact()}
              disabled={isSendingStructuredMessage}
            >
              {isSendingStructuredMessage ? "Enviando..." : "Enviar contato"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isCameraMode}
        onClose={() => setIsCameraMode(false)}
        title="Capturar foto"
        size="lg"
      >
        <CameraCapture
          onSend={handleCameraSend}
          onCancel={() => setIsCameraMode(false)}
          isSubmitting={isSendingMedia}
        />
      </Modal>

      <Modal
        isOpen={isConversationGalleryOpen}
        onClose={() => setIsConversationGalleryOpen(false)}
        title={`Midias da conversa - ${conversation.name}`}
        size="lg"
      >
        <div className="conversation-media-gallery">
          <div className="conversation-media-gallery__toolbar">
            {(
              [
                ["all", "Todas"],
                ["image", "Imagens"],
                ["video", "Videos"],
                ["audio", "Audios"],
                ["document", "Documentos"],
              ] as Array<[ConversationGalleryFilter, string]>
            ).map(([filter, label]) => (
              <button
                key={filter}
                type="button"
                className={conversationGalleryFilter === filter ? "is-active" : ""}
                onClick={() => {
                  setConversationGalleryFilter(filter);
                  setConversationGalleryVisibleCount(60);
                }}
              >
                {label}
              </button>
            ))}
            <span>{conversationGalleryMessages.length} arquivo(s)</span>
          </div>

          {isConversationGalleryLoading ? (
            <div className="conversation-media-gallery__feedback">
              <span className="conversation-media-gallery__spinner" />
              Carregando todo o historico de midias...
            </div>
          ) : conversationGalleryError ? (
            <div className="conversation-media-gallery__feedback is-error">
              <p>{conversationGalleryError}</p>
              <button type="button" onClick={() => void loadConversationGallery()}>
                Tentar novamente
              </button>
            </div>
          ) : filteredConversationGalleryMessages.length === 0 ? (
            <div className="conversation-media-gallery__feedback">
              Nenhuma midia encontrada neste filtro.
            </div>
          ) : (
            <div className="conversation-media-gallery__grid">
              {visibleConversationGalleryMessages.map((message) => (
                <article
                  key={`${message.mediaType}-${message.id}`}
                  className="conversation-media-gallery__item"
                >
                  <div className="conversation-media-gallery__preview">
                    {!message.mediaUrl || unavailableGalleryMediaIds.has(message.id) ? (
                      <div className="conversation-media-gallery__unavailable">
                        <FiAlertCircle size={28} />
                        <strong>Midia indisponivel</strong>
                        <span>O arquivo original nao esta mais disponivel na Meta.</span>
                      </div>
                    ) : message.mediaType === "image" || message.mediaType === "sticker" ? (
                      <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={message.mediaUrl}
                          alt={message.caption || "Midia da conversa"}
                          loading="lazy"
                          onError={() => markGalleryMediaUnavailable(message.id)}
                        />
                      </a>
                    ) : message.mediaType === "video" ? (
                      <video
                        src={message.mediaUrl}
                        controls
                        preload="none"
                        onError={() => markGalleryMediaUnavailable(message.id)}
                      />
                    ) : message.mediaType === "audio" ? (
                      <div className="conversation-media-gallery__audio">
                        <FiMic size={24} />
                        <audio
                          src={message.mediaUrl}
                          controls
                          preload="none"
                          onError={() => markGalleryMediaUnavailable(message.id)}
                        />
                      </div>
                    ) : (
                      <a
                        className="conversation-media-gallery__document"
                        href={message.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FiFileText size={34} />
                        <span>{message.fileName || "Documento"}</span>
                      </a>
                    )}
                  </div>
                  <div className="conversation-media-gallery__meta">
                    <div>
                      <strong>{message.sender === "customer" ? conversation.name : message.agentName || "Equipe"}</strong>
                      <time>{message.timestamp.toLocaleString("pt-BR")}</time>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDownloadMessageMedia(message)}
                      title="Baixar midia"
                      aria-label="Baixar midia"
                      disabled={!message.mediaUrl || unavailableGalleryMediaIds.has(message.id)}
                    >
                      <FiDownload size={17} />
                    </button>
                  </div>
                  {message.caption ? (
                    <p className="conversation-media-gallery__caption">{message.caption}</p>
                  ) : null}
                </article>
              ))}
              {visibleConversationGalleryMessages.length < filteredConversationGalleryMessages.length ? (
                <button
                  type="button"
                  className="conversation-media-gallery__load-more"
                  onClick={() => setConversationGalleryVisibleCount((current) => current + 60)}
                >
                  Carregar mais midias
                </button>
              ) : null}
            </div>
          )}
        </div>
      </Modal>

      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
      />
      <input
        type="file"
        ref={photoVideoInputRef}
        onChange={handleFileSelect}
        multiple
        accept="image/*,video/*"
        style={{ display: "none" }}
      />
      <input
        type="file"
        ref={stickerInputRef}
        onChange={handleFileSelect}
        multiple
        accept=".webp,image/webp"
        style={{ display: "none" }}
      />
      <input
        type="file"
        ref={documentInputRef}
        onChange={handleFileSelect}
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.dwg"
        style={{ display: "none" }}
      />
    </main>
  );
}
