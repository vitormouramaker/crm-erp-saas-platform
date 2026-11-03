import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { API_BASE } from "../config/api";
import { useAuth } from "./AuthContext";
import { decrypt, encrypt } from "../utils/cripto";

export type QuickMessageMediaType = "image" | "document" | "audio" | "video";
export interface QuickMessageContentItem {
  id: number;
  url: string;
  name: string;
  mime_type?: string | null;
  size?: number | null;
}
export interface QuickMessageSequenceItem {
  type: "text" | QuickMessageMediaType;
  text_index?: number;
  id?: number;
  caption_text_index?: number | null;
}
export interface QuickMessageContent {
  version: 2;
  texts: string[];
  order: QuickMessageMediaType[];
  images: QuickMessageContentItem[];
  documents: QuickMessageContentItem[];
  audios: QuickMessageContentItem[];
  videos: QuickMessageContentItem[];
  sequence?: QuickMessageSequenceItem[];
}

export interface QuickMessageDraftMedia {
  key: string;
  type: QuickMessageMediaType;
  id?: number;
  file?: File;
  name: string;
  url?: string;
}

export interface QuickMessageDraftSequenceItem {
  key: string;
  type: "text" | QuickMessageMediaType;
  text_key?: string;
  media_key?: string;
  caption_text_key?: string | null;
}

export interface Command {
  id: number;
  command: string;
  text: string;
  description: string;
  use_text_as_image_caption?: boolean;
  gallery_image_id?: number | null;
  image_url?: string | null;
  image_name?: string | null;
  image_mime_type?: string | null;
  gallery_document_id?: number | null;
  document_url?: string | null;
  document_name?: string | null;
  document_mime_type?: string | null;
  gallery_audio_id?: number | null;
  audio_url?: string | null;
  audio_name?: string | null;
  audio_mime_type?: string | null;
  media_order?: QuickMessageMediaType[] | QuickMessageContent;
  content?: QuickMessageContent;
  usuario_id?: number | null;
  usuario_nome?: string | null;
  can_edit?: boolean;
  scope?: "global" | "user";
}

export type CommandCreationData = Omit<Command, "id"> & {
  imageFile?: File | null;
  documentFile?: File | null;
  audioFile?: File | null;
  imageFiles?: File[];
  documentFiles?: File[];
  audioFiles?: File[];
  videoFiles?: File[];
  text_blocks?: string[];
  gallery_image_ids?: number[];
  gallery_document_ids?: number[];
  gallery_audio_ids?: number[];
  gallery_video_ids?: number[];
  text_keys?: string[];
  draft_media?: QuickMessageDraftMedia[];
  draft_sequence?: QuickMessageDraftSequenceItem[];
  removeImage?: boolean;
  removeDocument?: boolean;
  removeAudio?: boolean;
};

type EncryptedResponse<T> = {
  boleano?: boolean;
  obj?: T;
  msg?: string;
  mensagem?: string;
};

interface CommandsContextType {
  commands: Command[];
  loadingCommands: boolean;
  commandsError: string;
  refreshCommands: (includeAllForAdmin?: boolean) => Promise<void>;
  addCommand: (commandData: CommandCreationData) => void;
  updateCommand: (updatedCommand: Command) => void;
  deleteCommand: (commandId: number) => void;
}

const CommandsContext = createContext<CommandsContextType | undefined>(undefined);

function sortCommands(list: Command[]) {
  return [...list].sort((a, b) => a.command.localeCompare(b.command, "pt-BR"));
}

function normalizeCommand(command: Partial<Command>): Command {
  const validMediaTypes = new Set(["image", "document", "audio", "video"]);
  const rawContent = command.media_order && !Array.isArray(command.media_order)
    ? command.media_order as QuickMessageContent
    : command.content;
  const content = rawContent && Number(rawContent.version) === 2 ? {
    version: 2 as const,
    texts: Array.isArray(rawContent.texts) ? rawContent.texts.map(String) : [],
    order: Array.isArray(rawContent.order)
      ? rawContent.order.filter((item) => validMediaTypes.has(item))
      : [],
    images: Array.isArray(rawContent.images) ? rawContent.images : [],
    documents: Array.isArray(rawContent.documents) ? rawContent.documents : [],
    audios: Array.isArray(rawContent.audios) ? rawContent.audios : [],
    videos: Array.isArray(rawContent.videos) ? rawContent.videos : [],
    sequence: Array.isArray(rawContent.sequence) ? rawContent.sequence : undefined,
  } : undefined;
  const mediaOrder = Array.isArray(command.media_order)
    ? command.media_order.filter(
        (item, index, list) => validMediaTypes.has(item) && list.indexOf(item) === index,
      )
    : [];

  return {
    id: Number(command.id || 0),
    command: String(command.command || ""),
    text: String(command.text || ""),
    description: String(command.description || ""),
    use_text_as_image_caption: Boolean(command.use_text_as_image_caption),
    gallery_image_id:
      Number.isInteger(command.gallery_image_id) && Number(command.gallery_image_id) > 0
        ? Number(command.gallery_image_id)
        : null,
    image_url: command.image_url ? String(command.image_url) : null,
    image_name: command.image_name ? String(command.image_name) : null,
    image_mime_type: command.image_mime_type ? String(command.image_mime_type) : null,
    gallery_document_id:
      Number.isInteger(command.gallery_document_id) && Number(command.gallery_document_id) > 0
        ? Number(command.gallery_document_id)
        : null,
    document_url: command.document_url ? String(command.document_url) : null,
    document_name: command.document_name ? String(command.document_name) : null,
    document_mime_type: command.document_mime_type
      ? String(command.document_mime_type)
      : null,
    gallery_audio_id:
      Number.isInteger(command.gallery_audio_id) && Number(command.gallery_audio_id) > 0
        ? Number(command.gallery_audio_id)
        : null,
    audio_url: command.audio_url ? String(command.audio_url) : null,
    audio_name: command.audio_name ? String(command.audio_name) : null,
    audio_mime_type: command.audio_mime_type ? String(command.audio_mime_type) : null,
    media_order: content || mediaOrder as QuickMessageMediaType[],
    content,
    usuario_id: Number(command.usuario_id) > 0 ? Number(command.usuario_id) : null,
    usuario_nome: command.usuario_nome ? String(command.usuario_nome) : null,
    can_edit: command.can_edit !== false,
  };
}

export function CommandsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [commands, setCommands] = useState<Command[]>([]);
  const [loadingCommands, setLoadingCommands] = useState(false);
  const [commandsError, setCommandsError] = useState("");

  const refreshCommands = useCallback(async (includeAllForAdmin = false) => {
    if (!user?.empresa_id) {
      setCommands([]);
      setCommandsError("");
      return;
    }

    setLoadingCommands(true);

    try {
      setCommandsError("");
      const encrypted = await encrypt({
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        incluir_todas: includeAllForAdmin ? "true" : "false",
      });
      const response = await fetch(`${API_BASE}/user/mensagens_rapidas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as EncryptedResponse<Command[]>;

      if (!resp?.boleano) {
        throw new Error(String(resp?.mensagem || resp?.msg || "Falha ao carregar comandos."));
      }

      const nextCommands = Array.isArray(resp.obj)
        ? resp.obj.map((item) => normalizeCommand(item))
        : [];
      setCommands(sortCommands(nextCommands));
    } catch (error) {
      setCommandsError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar as mensagens rapidas."
      );
      console.error("Erro ao carregar mensagens rapidas:", error);
    } finally {
      setLoadingCommands(false);
    }
  }, [user?.empresa_id]);

  useEffect(() => {
    void refreshCommands();
  }, [refreshCommands]);

  const addCommand = (commandData: CommandCreationData) => {
    const newCommand = normalizeCommand({ ...commandData, id: Date.now() });
    setCommands((prevCommands) => sortCommands([...prevCommands, newCommand]));
  };

  const updateCommand = (updatedCommand: Command) => {
    const normalized = normalizeCommand(updatedCommand);
    setCommands((prevCommands) =>
      sortCommands(
        prevCommands.map((cmd) => (cmd.id === normalized.id ? normalized : cmd))
      )
    );
  };

  const deleteCommand = (commandId: number) => {
    setCommands((prevCommands) => prevCommands.filter((cmd) => cmd.id !== commandId));
  };

  return (
    <CommandsContext.Provider
      value={{
        commands,
        loadingCommands,
        commandsError,
        refreshCommands,
        addCommand,
        updateCommand,
        deleteCommand,
      }}
    >
      {children}
    </CommandsContext.Provider>
  );
}

export function useCommands() {
  const context = useContext(CommandsContext);
  if (context === undefined) {
    throw new Error("useCommands deve ser usado dentro de um CommandsProvider");
  }
  return context;
}
