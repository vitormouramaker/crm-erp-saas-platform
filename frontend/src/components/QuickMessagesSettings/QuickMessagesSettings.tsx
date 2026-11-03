import { useState, useEffect, useCallback } from "react";
import {
  useCommands,
  type Command,
  type CommandCreationData,
  type QuickMessageSequenceItem,
} from "../../contexts/CommandsContext";
import type {
  QuickMessageGalleryDocument,
  QuickMessageGalleryImage,
  QuickMessageGalleryAudio,
} from "../../types/quickMessages";
import {
  FiEdit,
  FiTrash2,
  FiPlus,
  FiImage,
  FiRefreshCw,
  FiFileText,
  FiVolume2,
} from "react-icons/fi";
import { Modal } from "../common/Modal/Modal";
import { CommandForm } from "../CommandForm/CommandForm";
import { encrypt, decrypt } from "../../utils/cripto";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import "./QuickMessagesSettings.css";

type QuickMessagesView = "messages" | "gallery" | "documents" | "audios";

type EncryptedResponse<T> = {
  boleano?: boolean;
  obj?: T;
  msg?: string;
  mensagem?: string;
};

type QuickMessageUser = { id: number; name: string };

const QUICK_MESSAGE_DOCUMENT_LIMIT = 5;
const QUICK_MESSAGE_IMAGE_FILE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
const QUICK_MESSAGE_DOCUMENT_FILE_SIZE_LIMIT_BYTES = 100 * 1024 * 1024;
const QUICK_MESSAGE_AUDIO_LIMIT = 60;
const QUICK_MESSAGE_AUDIO_FILE_SIZE_LIMIT_BYTES = 16 * 1024 * 1024;

export function QuickMessagesSettings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { commands, loadingCommands, commandsError, refreshCommands } = useCommands();
  const [activeView, setActiveView] = useState<QuickMessagesView>("messages");
  const [galleryImages, setGalleryImages] = useState<QuickMessageGalleryImage[]>([]);
  const [galleryDocuments, setGalleryDocuments] = useState<QuickMessageGalleryDocument[]>([]);
  const [galleryAudios, setGalleryAudios] = useState<QuickMessageGalleryAudio[]>([]);
  const [quickMessageUsers, setQuickMessageUsers] = useState<QuickMessageUser[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [loadingAudios, setLoadingAudios] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [commandToDeleteId, setCommandToDeleteId] = useState<number | null>(null);
  const [deletingGalleryImageId, setDeletingGalleryImageId] = useState<number | null>(null);
  const [deletingGalleryDocumentId, setDeletingGalleryDocumentId] = useState<number | null>(null);
  const [deletingGalleryAudioId, setDeletingGalleryAudioId] = useState<number | null>(null);
  const [uploadingGalleryImage, setUploadingGalleryImage] = useState(false);
  const [uploadingGalleryDocument, setUploadingGalleryDocument] = useState(false);
  const [uploadingGalleryAudio, setUploadingGalleryAudio] = useState(false);
  const [savingCommand, setSavingCommand] = useState(false);
  const reusableGalleryImages = galleryImages.filter(
    (image) => image.disponivel_para_mensagem_rapida !== false
  );
  const reusableGalleryDocuments = galleryDocuments.filter(
    (document) => document.disponivel_para_mensagem_rapida !== false
  );
  const reusableGalleryAudios = galleryAudios.filter(
    (audio) => audio.disponivel_para_mensagem_rapida !== false
  );
  const documentUploadLimitReached =
    reusableGalleryDocuments.length >= QUICK_MESSAGE_DOCUMENT_LIMIT;
  const audioUploadLimitReached = reusableGalleryAudios.length >= QUICK_MESSAGE_AUDIO_LIMIT;

  const fetchGalleryImages = useCallback(async () => {
    try {
      if (!user?.empresa_id) {
        setGalleryImages([]);
        return;
      }

      setLoadingGallery(true);
      const encrypted = await encrypt({ empresa_id: user.empresa_id });
      const response = await fetch(`${API_BASE}/user/galeria_empresa_imagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as EncryptedResponse<
        QuickMessageGalleryImage[]
      >;

      if (resp?.boleano) {
        setGalleryImages(Array.isArray(resp.obj) ? resp.obj : []);
      } else {
        throw new Error(String(resp?.mensagem || resp?.msg || "Falha ao carregar a galeria."));
      }
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro na galeria de imagens",
        description:
          err instanceof Error ? err.message : "Nao foi possivel carregar a galeria da empresa.",
      });
      setGalleryImages([]);
    } finally {
      setLoadingGallery(false);
    }
  }, [addToast, user?.empresa_id]);

  const fetchGalleryDocuments = useCallback(async () => {
    try {
      if (!user?.empresa_id) {
        setGalleryDocuments([]);
        return;
      }

      setLoadingDocuments(true);
      const encrypted = await encrypt({ empresa_id: user.empresa_id });
      const response = await fetch(`${API_BASE}/user/galeria_empresa_documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as EncryptedResponse<
        QuickMessageGalleryDocument[]
      >;

      if (resp?.boleano) {
        setGalleryDocuments(Array.isArray(resp.obj) ? resp.obj : []);
      } else {
        throw new Error(
          String(resp?.mensagem || resp?.msg || "Falha ao carregar os documentos.")
        );
      }
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro na galeria de documentos",
        description:
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar os documentos da empresa.",
      });
      setGalleryDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  }, [addToast, user?.empresa_id]);

  const fetchGalleryAudios = useCallback(async () => {
    try {
      if (!user?.empresa_id) {
        setGalleryAudios([]);
        return;
      }
      setLoadingAudios(true);
      const encrypted = await encrypt({ empresa_id: user.empresa_id });
      const response = await fetch(`${API_BASE}/user/galeria_empresa_audios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as EncryptedResponse<QuickMessageGalleryAudio[]>;
      if (!resp?.boleano) {
        throw new Error(String(resp?.mensagem || resp?.msg || "Falha ao carregar os audios."));
      }
      setGalleryAudios(Array.isArray(resp.obj) ? resp.obj : []);
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro na galeria de audios",
        description: err instanceof Error ? err.message : "Nao foi possivel carregar os audios.",
      });
      setGalleryAudios([]);
    } finally {
      setLoadingAudios(false);
    }
  }, [addToast, user?.empresa_id]);

  useEffect(() => {
    void fetchGalleryImages();
    void fetchGalleryDocuments();
    void fetchGalleryAudios();
  }, [fetchGalleryAudios, fetchGalleryDocuments, fetchGalleryImages]);

  useEffect(() => {
    void refreshCommands(Boolean(user?.is_master));
    if (!user?.is_master || !user.empresa_id) {
      setQuickMessageUsers([]);
      return;
    }
    void (async () => {
      try {
        const payload = await encrypt({ empresa_id: user.empresa_id, usuario_id: user.id });
        const response = await fetch(`${API_BASE}/user/lista_usuarios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        const responseData = await response.json();
        const result = (await decrypt(responseData.payload)) as EncryptedResponse<QuickMessageUser[]>;
        setQuickMessageUsers(Array.isArray(result?.obj) ? result.obj : []);
      } catch {
        setQuickMessageUsers([]);
      }
    })();
  }, [refreshCommands, user?.empresa_id, user?.id, user?.is_master]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshCommands(Boolean(user?.is_master)),
      fetchGalleryImages(),
      fetchGalleryDocuments(),
      fetchGalleryAudios(),
    ]);
  }, [fetchGalleryAudios, fetchGalleryDocuments, fetchGalleryImages, refreshCommands, user?.is_master]);

  const handleOpenCreateModal = () => {
    setEditingCommand(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (cmd: Command) => {
    setEditingCommand(cmd);
    setIsFormModalOpen(true);
  };

  const handleSaveCommand = async (commandData: Command | CommandCreationData) => {
    try {
      if (!user?.empresa_id) throw new Error("Usuario nao encontrado.");

      setSavingCommand(true);
      const isEditing = "id" in commandData;
      const creationData = commandData as CommandCreationData;
      const uploadGalleryFile = async (endpoint: string, field: string, file: File) => {
        const encryptedUpload = await encrypt({ empresa_id: user.empresa_id });
        const uploadData = new FormData();
        uploadData.append("payload", encryptedUpload);
        uploadData.append(field, file);
        const uploadResponse = await fetch(`${API_BASE}/user/${endpoint}`, { method: "POST", body: uploadData });
        const uploadJson = await uploadResponse.json();
        const uploadResult = (await decrypt(uploadJson.payload)) as EncryptedResponse<{ id?: number }>;
        if (!uploadResult?.boleano || !Number(uploadResult.obj?.id)) {
          throw new Error(String(uploadResult?.mensagem || uploadResult?.msg || `Falha ao enviar ${file.name}.`));
        }
        return Number(uploadResult.obj?.id);
      };
      const imageIds = [...(creationData.gallery_image_ids || [])];
      const documentIds = [...(creationData.gallery_document_ids || [])];
      const audioIds = [...(creationData.gallery_audio_ids || [])];
      const videoIds = [...(creationData.gallery_video_ids || [])];
      const uploadedIdByKey = new Map<string, number>();
      const uploadConfig = {
        image: ["galeria_empresa_imagens_upload", "image"],
        document: ["galeria_empresa_documentos_upload", "document"],
        audio: ["galeria_empresa_audios_upload", "audio"],
        video: ["galeria_empresa_videos_upload", "video"],
      } as const;
      for (const media of creationData.draft_media || []) {
        let id = Number(media.id || 0);
        if (!id && media.file) {
          const [endpoint, field] = uploadConfig[media.type];
          id = await uploadGalleryFile(endpoint, field, media.file);
        }
        if (id) uploadedIdByKey.set(media.key, id);
      }
      if (!creationData.draft_media) {
        for (const file of creationData.imageFiles || []) imageIds.push(await uploadGalleryFile("galeria_empresa_imagens_upload", "image", file));
        for (const file of creationData.documentFiles || []) documentIds.push(await uploadGalleryFile("galeria_empresa_documentos_upload", "document", file));
        for (const file of creationData.audioFiles || []) audioIds.push(await uploadGalleryFile("galeria_empresa_audios_upload", "audio", file));
        for (const file of creationData.videoFiles || []) videoIds.push(await uploadGalleryFile("galeria_empresa_videos_upload", "video", file));
      } else {
        for (const media of creationData.draft_media) {
          const id = uploadedIdByKey.get(media.key);
          if (!id) continue;
          if (media.type === "image") imageIds.push(id);
          if (media.type === "document") documentIds.push(id);
          if (media.type === "audio") audioIds.push(id);
          if (media.type === "video") videoIds.push(id);
        }
      }
      if (videoIds.length > 10) throw new Error("Limite de 10 videos por mensagem rapida atingido.");
      const textIndexByKey = new Map((creationData.text_keys || []).map((key, index) => [key, index]));
      const sequence = (creationData.draft_sequence || []).reduce<QuickMessageSequenceItem[]>((result, item) => {
        if (item.type === "text") {
          const textIndex = textIndexByKey.get(String(item.text_key || ""));
          if (textIndex !== undefined) result.push({ type: "text", text_index: textIndex });
          return result;
        }
        const id = uploadedIdByKey.get(String(item.media_key || ""));
        if (!id) return result;
        const captionIndex = textIndexByKey.get(String(item.caption_text_key || ""));
        result.push({ type: item.type, id, ...(captionIndex === undefined ? {} : { caption_text_index: captionIndex }) });
        return result;
      }, []);
      const imageFile = "imageFile" in commandData ? commandData.imageFile : null;
      const documentFile = "documentFile" in commandData ? commandData.documentFile : null;
      const audioFile = "audioFile" in commandData ? commandData.audioFile : null;
      const removeImage = "removeImage" in commandData ? commandData.removeImage : false;
      const removeDocument = "removeDocument" in commandData ? commandData.removeDocument : false;
      const removeAudio = "removeAudio" in commandData ? commandData.removeAudio : false;
      const payload = await encrypt({
        ...(isEditing ? { id: commandData.id } : {}),
        comando: commandData.command,
        descricao: commandData.description,
        texto: commandData.text,
        usar_texto_como_legenda: Boolean(commandData.use_text_as_image_caption),
        empresa_id: user.empresa_id,
        usuario_id: user.id,
        galeria_imagem_id: commandData.gallery_image_id || null,
        galeria_documento_id: commandData.gallery_document_id || null,
        galeria_audio_id: commandData.gallery_audio_id || null,
        ordem_midias: commandData.media_order || [],
        conteudo: {
          version: 2,
          texts: creationData.text_blocks || [commandData.text].filter(Boolean),
          order: Array.isArray(commandData.media_order) ? commandData.media_order : [],
          image_ids: imageIds,
          document_ids: documentIds,
          audio_ids: audioIds,
          video_ids: videoIds,
          sequence,
        },
        escopo: commandData.scope || (commandData.usuario_id == null ? "global" : "user"),
        mensagem_usuario_id: commandData.usuario_id || null,
        remove_image: removeImage ? "true" : "false",
        remove_document: removeDocument ? "true" : "false",
        remove_audio: removeAudio ? "true" : "false",
      });

      const formData = new FormData();
      formData.append("payload", payload);
      if (imageFile && !creationData.imageFiles) {
        formData.append("image", imageFile);
      }
      if (documentFile && !creationData.documentFiles) {
        formData.append("document", documentFile);
      }
      if (audioFile && !creationData.audioFiles) {
        formData.append("audio", audioFile);
      }

      const response = await fetch(
        `${API_BASE}/user/${isEditing ? "alterar_mensagens_rapidas" : "criar_mensagens_rapidas"}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as EncryptedResponse<Command>;

      if (!resp?.boleano) {
        throw new Error(
          String(resp?.mensagem || resp?.msg || "Nao foi possivel salvar a mensagem rapida.")
        );
      }

      await refreshAll();
      addToast({
        type: "success",
        title: isEditing ? "Mensagem atualizada" : "Mensagem criada",
        description: "A mensagem rapida foi salva com sucesso.",
      });
      setIsFormModalOpen(false);
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro ao salvar mensagem",
        description:
          err instanceof Error ? err.message : "Nao foi possivel salvar a mensagem rapida.",
      });
    } finally {
      setSavingCommand(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (commandToDeleteId === null) return;

    try {
      const payload = await encrypt({
        id: commandToDeleteId,
        empresa_id: user?.empresa_id,
        usuario_id: user?.id,
      });
      const response = await fetch(`${API_BASE}/user/deletar_mensagens_rapidas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as EncryptedResponse<Record<string, never>>;

      if (!resp?.boleano) {
        throw new Error(String(resp?.mensagem || resp?.msg || "Falha ao deletar mensagem."));
      }

      await refreshAll();
      addToast({
        type: "success",
        title: "Mensagem removida",
        description: "A mensagem rapida foi removida com sucesso.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro ao remover mensagem",
        description:
          err instanceof Error ? err.message : "Nao foi possivel remover a mensagem rapida.",
      });
    } finally {
      setIsConfirmModalOpen(false);
      setCommandToDeleteId(null);
    }
  };

  const handleGalleryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file || !user?.empresa_id) {
      if (event.target) event.target.value = "";
      return;
    }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      addToast({ type: "error", title: "Imagem invalida", description: "A Meta aceita apenas JPEG ou PNG." });
      event.target.value = "";
      return;
    }
    if (file.size > QUICK_MESSAGE_IMAGE_FILE_SIZE_LIMIT_BYTES) {
      addToast({ type: "error", title: "Arquivo muito grande", description: "A imagem deve ter no maximo 5MB, limite da Meta." });
      event.target.value = "";
      return;
    }

    try {
      setUploadingGalleryImage(true);
      const payload = await encrypt({ empresa_id: user.empresa_id });
      const formData = new FormData();
      formData.append("payload", payload);
      formData.append("image", file);

      const response = await fetch(`${API_BASE}/user/galeria_empresa_imagens_upload`, {
        method: "POST",
        body: formData,
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as EncryptedResponse<QuickMessageGalleryImage>;

      if (!resp?.boleano) {
        throw new Error(String(resp?.mensagem || resp?.msg || "Falha ao enviar imagem."));
      }

      await fetchGalleryImages();
      addToast({
        type: "success",
        title: "Imagem salva",
        description: "A imagem foi adicionada a galeria da empresa.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro ao enviar imagem",
        description:
          err instanceof Error ? err.message : "Nao foi possivel enviar a imagem.",
      });
    } finally {
      setUploadingGalleryImage(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file || !user?.empresa_id) {
      if (event.target) event.target.value = "";
      return;
    }

    if (file.type !== "application/pdf") {
      addToast({
        type: "error",
        title: "Arquivo invalido",
        description: "Envie apenas arquivos PDF.",
      });
      if (event.target) event.target.value = "";
      return;
    }

    if (file.size > QUICK_MESSAGE_DOCUMENT_FILE_SIZE_LIMIT_BYTES) {
      addToast({
        type: "error",
        title: "Arquivo muito grande",
        description: "O documento deve ter no maximo 100MB, limite da Meta.",
      });
      if (event.target) event.target.value = "";
      return;
    }

    try {
      setUploadingGalleryDocument(true);
      const payload = await encrypt({ empresa_id: user.empresa_id });
      const formData = new FormData();
      formData.append("payload", payload);
      formData.append("document", file);

      const response = await fetch(`${API_BASE}/user/galeria_empresa_documentos_upload`, {
        method: "POST",
        body: formData,
      });
      const respData = await response.json();
      const resp =
        (await decrypt(respData.payload)) as EncryptedResponse<QuickMessageGalleryDocument>;

      if (!resp?.boleano) {
        throw new Error(String(resp?.mensagem || resp?.msg || "Falha ao enviar documento."));
      }

      await fetchGalleryDocuments();
      addToast({
        type: "success",
        title: "Documento salvo",
        description: "O documento foi adicionado a galeria da empresa.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro ao enviar documento",
        description:
          err instanceof Error ? err.message : "Nao foi possivel enviar o documento.",
      });
    } finally {
      setUploadingGalleryDocument(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file || !user?.empresa_id) {
      event.target.value = "";
      return;
    }
    if (!["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"].includes(file.type)) {
      addToast({ type: "error", title: "Audio invalido", description: "Use AAC, M4A, MP3, AMR ou OGG/Opus." });
      event.target.value = "";
      return;
    }
    if (file.size > QUICK_MESSAGE_AUDIO_FILE_SIZE_LIMIT_BYTES) {
      addToast({
        type: "error",
        title: "Arquivo muito grande",
        description: "O audio deve ter no maximo 16MB.",
      });
      event.target.value = "";
      return;
    }
    try {
      setUploadingGalleryAudio(true);
      const payload = await encrypt({ empresa_id: user.empresa_id });
      const formData = new FormData();
      formData.append("payload", payload);
      formData.append("audio", file);
      const response = await fetch(`${API_BASE}/user/galeria_empresa_audios_upload`, {
        method: "POST",
        body: formData,
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as EncryptedResponse<QuickMessageGalleryAudio>;
      if (!resp?.boleano) {
        throw new Error(String(resp?.mensagem || resp?.msg || "Falha ao enviar audio."));
      }
      await fetchGalleryAudios();
      addToast({
        type: "success",
        title: "Audio salvo",
        description: "O audio foi adicionado a galeria da empresa.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro ao enviar audio",
        description: err instanceof Error ? err.message : "Nao foi possivel enviar o audio.",
      });
    } finally {
      setUploadingGalleryAudio(false);
      event.target.value = "";
    }
  };

  const handleDeleteGalleryImage = async (image: QuickMessageGalleryImage) => {
    const confirmed = window.confirm(`Deseja remover a imagem "${image.nome_arquivo}"?`);
    if (!confirmed || !user?.empresa_id) return;

    try {
      setDeletingGalleryImageId(image.id);
      const payload = await encrypt({ id: image.id, empresa_id: user.empresa_id });
      const response = await fetch(`${API_BASE}/user/galeria_empresa_imagens_deletar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as EncryptedResponse<Record<string, never>>;

      if (!resp?.boleano) {
        throw new Error(String(resp?.mensagem || resp?.msg || "Falha ao remover imagem."));
      }

      await refreshAll();
      addToast({
        type: "success",
        title: "Imagem removida",
        description: "A imagem foi removida da galeria.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro ao remover imagem",
        description:
          err instanceof Error ? err.message : "Nao foi possivel remover a imagem.",
      });
    } finally {
      setDeletingGalleryImageId(null);
    }
  };

  const handleDeleteGalleryDocument = async (document: QuickMessageGalleryDocument) => {
    const confirmed = window.confirm(`Deseja remover o documento "${document.nome_arquivo}"?`);
    if (!confirmed || !user?.empresa_id) return;

    try {
      setDeletingGalleryDocumentId(document.id);
      const payload = await encrypt({ id: document.id, empresa_id: user.empresa_id });
      const response = await fetch(`${API_BASE}/user/galeria_empresa_documentos_deletar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as EncryptedResponse<Record<string, never>>;

      if (!resp?.boleano) {
        throw new Error(String(resp?.mensagem || resp?.msg || "Falha ao remover documento."));
      }

      await refreshAll();
      addToast({
        type: "success",
        title: "Documento removido",
        description: "O documento foi removido da galeria.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro ao remover documento",
        description:
          err instanceof Error ? err.message : "Nao foi possivel remover o documento.",
      });
    } finally {
      setDeletingGalleryDocumentId(null);
    }
  };

  const handleDeleteGalleryAudio = async (audio: QuickMessageGalleryAudio) => {
    const confirmed = window.confirm(`Deseja remover o audio "${audio.nome_arquivo}"?`);
    if (!confirmed || !user?.empresa_id) return;
    try {
      setDeletingGalleryAudioId(audio.id);
      const payload = await encrypt({ id: audio.id, empresa_id: user.empresa_id });
      const response = await fetch(`${API_BASE}/user/galeria_empresa_audios_deletar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as EncryptedResponse<Record<string, never>>;
      if (!resp?.boleano) {
        throw new Error(String(resp?.mensagem || resp?.msg || "Falha ao remover audio."));
      }
      await refreshAll();
      addToast({
        type: "success",
        title: "Audio removido",
        description: "O audio foi removido da galeria.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Erro ao remover audio",
        description: err instanceof Error ? err.message : "Nao foi possivel remover o audio.",
      });
    } finally {
      setDeletingGalleryAudioId(null);
    }
  };

  return (
    <div className="quick-messages-container">
      <div className="page-actions">
        <div>
          <h2>Mensagens Rapidas</h2>
          <p className="quick-messages-subtitle">
            Cadastre respostas com varias caixas de texto, imagens, documentos, audios e videos.
            <br />Audios: ate {QUICK_MESSAGE_AUDIO_FILE_SIZE_LIMIT_BYTES / 1024 / 1024}MB,
            limite de {QUICK_MESSAGE_AUDIO_LIMIT} arquivos ativos.
          </p>
        </div>

        <div className="quick-messages-actions" key={`quick-actions-${activeView}`}>
          <button className="quick-messages-secondary-button" onClick={() => void refreshAll()}>
            <FiRefreshCw /> Atualizar
          </button>
          {activeView === "messages" ? (
            <button className="quick-messages-primary-button" onClick={handleOpenCreateModal}>
              <FiPlus /> Nova Mensagem
            </button>
          ) : activeView === "gallery" ? (
            <label className="quick-messages-primary-button quick-gallery-upload-button">
              <FiPlus />{" "}
              {uploadingGalleryImage
                ? "Enviando..."
                : "Adicionar Imagem"}
              <input
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                disabled={uploadingGalleryImage}
                onChange={(event) => void handleGalleryUpload(event)}
              />
            </label>
          ) : activeView === "documents" ? (
            <label
              className={`quick-messages-primary-button quick-gallery-upload-button${
                documentUploadLimitReached ? " is-disabled" : ""
              }`}
              aria-disabled={documentUploadLimitReached}
            >
              <FiPlus />{" "}
              {uploadingGalleryDocument
                ? "Enviando..."
                : documentUploadLimitReached
                  ? "Limite de documentos atingido"
                  : "Adicionar Documento"}
              <input
                type="file"
                accept="application/pdf"
                disabled={uploadingGalleryDocument || documentUploadLimitReached}
                onChange={(event) => void handleDocumentUpload(event)}
              />
            </label>
          ) : (
            <label
              className={`quick-messages-primary-button quick-gallery-upload-button${
                audioUploadLimitReached ? " is-disabled" : ""
              }`}
              aria-disabled={audioUploadLimitReached}
            >
              <FiPlus />{" "}
              {uploadingGalleryAudio
                ? "Enviando..."
                : audioUploadLimitReached
                  ? "Limite de audios atingido"
                  : "Adicionar Audio"}
              <input
                type="file"
                accept="audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,.aac,.m4a,.mp3,.amr,.ogg,.opus"
                disabled={uploadingGalleryAudio || audioUploadLimitReached}
                onChange={(event) => void handleAudioUpload(event)}
              />
            </label>
          )}
        </div>
      </div>

      <div className="quick-messages-tabs">
        <button
          type="button"
          className={activeView === "messages" ? "active" : ""}
          onClick={() => setActiveView("messages")}
        >
          Mensagens
        </button>
        <button
          type="button"
          className={activeView === "gallery" ? "active" : ""}
          onClick={() => setActiveView("gallery")}
        >
          Imagens
        </button>
        <button
          type="button"
          className={activeView === "documents" ? "active" : ""}
          onClick={() => setActiveView("documents")}
        >
          Documentos
        </button>
        <button
          type="button"
          className={activeView === "audios" ? "active" : ""}
          onClick={() => setActiveView("audios")}
        >
          Audios
        </button>
      </div>

      {commandsError ? (
        <div className="quick-messages-warning">
          <strong>Mensagens rapidas com carregamento parcial</strong>
          <p>{commandsError}</p>
        </div>
      ) : null}

      <div key={`quick-content-${activeView}`}>
        {activeView === "messages" ? (
          loadingCommands ? (
            <p>Carregando comandos...</p>
          ) : commands.length ? (
            <div className="messages-list">
              {commands.map((cmd) => (
                <div key={cmd.id} className="message-card">
                  {cmd.image_url ? (
                    <div className="message-card-image">
                      <img src={cmd.image_url} alt={cmd.image_name || cmd.command} />
                    </div>
                  ) : null}

                  <div className="message-card-content">
                    <strong className="message-command">/{cmd.command}</strong>
                    <span className={`message-scope-badge ${cmd.usuario_id ? "is-personal" : "is-global"}`}>
                      {cmd.usuario_id
                        ? Number(cmd.usuario_id) === Number(user?.id)
                          ? "Minha mensagem"
                          : `Usuario: ${cmd.usuario_nome || cmd.usuario_id}`
                        : "Global"}
                    </span>
                    <p className="message-description">{cmd.description}</p>
                    {cmd.image_name ? (
                      <p className="message-image-label">
                        <FiImage /> {cmd.image_name}
                      </p>
                    ) : null}
                    {cmd.use_text_as_image_caption ? (
                      <p className="message-caption-label">Texto enviado como legenda</p>
                    ) : null}
                    {cmd.document_name ? (
                      <p className="message-image-label">
                        <FiFileText /> {cmd.document_name}
                      </p>
                    ) : null}
                    {cmd.audio_name ? (
                      <p className="message-image-label">
                        <FiVolume2 /> {cmd.audio_name}
                      </p>
                    ) : null}
                    {cmd.text ? <p className="command-card-text">"{cmd.text}"</p> : null}
                  </div>

                  {cmd.can_edit !== false ? <div className="message-card-actions">
                    <button title="Editar" onClick={() => handleOpenEditModal(cmd)}>
                      <FiEdit />
                    </button>
                    <button
                      title="Excluir"
                      onClick={() => {
                        setCommandToDeleteId(cmd.id);
                        setIsConfirmModalOpen(true);
                      }}
                    >
                      <FiTrash2 />
                    </button>
                  </div> : <p className="message-card-readonly">Disponibilizada pelo administrador</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="quick-messages-empty">
              <FiPlus />
              <strong>Nenhuma mensagem rapida cadastrada</strong>
              <p>Crie a primeira mensagem com texto, imagem, documento ou audio.</p>
            </div>
          )
        ) : activeView === "gallery" ? (
          loadingGallery ? (
            <p>Carregando galeria...</p>
          ) : galleryImages.length ? (
            <>
              <div className="quick-gallery-section">
              <div className="quick-gallery-grid">
              {galleryImages.map((image) => (
                <article key={image.id} className="quick-gallery-card">
                  <div className="quick-gallery-card__image">
                    <img src={image.url} alt={image.nome_arquivo} />
                  </div>
                  <div className="quick-gallery-card__content">
                    <strong>{image.nome_arquivo}</strong>
                    <p>{image.origem || "galeria"}</p>
                    {image.referencia_nome ? <span>Referência: {image.referencia_nome}</span> : null}
                    <span>{image.mensagens_vinculadas} mensagem(ns) vinculada(s)</span>
                  </div>
                  <div className="quick-gallery-card__actions">
                    {image.permite_exclusao === false ? (
                      <span className="quick-gallery-card__locked">
                        Gerencie esta imagem no cadastro do produto
                      </span>
                    ) : image.mensagens_vinculadas > 0 ? (
                      <span className="quick-gallery-card__locked">
                        Remova primeiro a mensagem rapida vinculada para apagar esta imagem
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={deletingGalleryImageId === image.id}
                        onClick={() => void handleDeleteGalleryImage(image)}
                      >
                        {deletingGalleryImageId === image.id ? "Removendo..." : "Remover"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
              </div>
              <p className="quick-messages-limit-status quick-messages-limit-status--bottom-left">
                {reusableGalleryImages.length} imagens de mensagens rapidas em uso.
              </p>
              </div>
            </>
          ) : (
            <div className="quick-messages-empty">
              <FiImage />
              <strong>Nenhuma imagem salva</strong>
              <p>Adicione imagens para reutilizar nas mensagens rapidas da empresa.</p>
            </div>
          )
        ) : activeView === "documents" ? loadingDocuments ? (
          <p>Carregando documentos...</p>
        ) : galleryDocuments.length ? (
          <>
            <div className="quick-documents-section">
            <div className="quick-documents-list">
            {galleryDocuments.map((document) => (
              <article key={document.id} className="quick-document-card">
                <div className="quick-document-card__content">
                  <p className="message-image-label quick-document-card__badge">
                    <FiFileText /> PDF
                  </p>
                  <strong>{document.nome_arquivo}</strong>
                  <p>{document.origem || "documento"}</p>
                  {document.referencia_nome ? (
                    <span>Referencia: {document.referencia_nome}</span>
                  ) : null}
                  <span>{document.mensagens_vinculadas} mensagem(ns) vinculada(s)</span>
                </div>
                <div className="quick-document-card__actions">
                  {document.permite_exclusao === false ? (
                    <span className="quick-gallery-card__locked">
                      Gerencie este documento no cadastro do produto
                    </span>
                  ) : document.mensagens_vinculadas > 0 ? (
                    <span className="quick-gallery-card__locked">
                      Remova primeiro a mensagem rapida vinculada para apagar este documento
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="Excluir"
                      disabled={deletingGalleryDocumentId === document.id}
                      onClick={() => void handleDeleteGalleryDocument(document)}
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              </article>
            ))}
            </div>
            <p className="quick-messages-limit-status quick-messages-limit-status--bottom-left">
              {reusableGalleryDocuments.length} / {QUICK_MESSAGE_DOCUMENT_LIMIT} documentos
              de mensagens rapidas em uso.
            </p>
            </div>
          </>
        ) : (
          <div className="quick-messages-empty">
            <FiFileText />
            <strong>Nenhum documento salvo</strong>
            <p>Adicione documentos PDF para reutilizar nas mensagens rapidas da empresa.</p>
          </div>
        ) : loadingAudios ? (
          <p>Carregando audios...</p>
        ) : galleryAudios.length ? (
          <div className="quick-documents-section">
            <div className="quick-documents-list">
              {galleryAudios.map((audio) => (
                <article key={audio.id} className="quick-document-card quick-audio-card">
                  <div className="quick-document-card__content">
                    <p className="message-image-label quick-document-card__badge">
                      <FiVolume2 /> Audio
                    </p>
                    <strong>{audio.nome_arquivo}</strong>
                    <audio controls preload="metadata" src={audio.url}>
                      Seu navegador nao suporta reproducao de audio.
                    </audio>
                    <p>{audio.origem || "audio"}</p>
                    <span>{audio.mensagens_vinculadas} mensagem(ns) vinculada(s)</span>
                  </div>
                  <div className="quick-document-card__actions">
                    {audio.mensagens_vinculadas > 0 ? (
                      <span className="quick-gallery-card__locked">
                        Remova primeiro a mensagem rapida vinculada para apagar este audio
                      </span>
                    ) : (
                      <button
                        type="button"
                        title="Excluir"
                        disabled={deletingGalleryAudioId === audio.id}
                        onClick={() => void handleDeleteGalleryAudio(audio)}
                      >
                        <FiTrash2 />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <p className="quick-messages-limit-status quick-messages-limit-status--bottom-left">
              {reusableGalleryAudios.length} / {QUICK_MESSAGE_AUDIO_LIMIT} audios de mensagens
              rapidas em uso.
            </p>
          </div>
        ) : (
          <div className="quick-messages-empty">
            <FiVolume2 />
            <strong>Nenhum audio salvo</strong>
            <p>Adicione audios para reutilizar nas mensagens rapidas da empresa.</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingCommand ? "Editar Mensagem Rapida" : "Criar Nova Mensagem Rapida"}
        size="lg"
      >
        <CommandForm
          onSave={handleSaveCommand}
          onCancel={() => setIsFormModalOpen(false)}
          initialData={editingCommand}
          galleryImages={reusableGalleryImages}
          galleryDocuments={reusableGalleryDocuments}
          galleryAudios={reusableGalleryAudios}
          users={quickMessageUsers}
          currentUserId={Number(user?.id || 0)}
          canManageScope={Boolean(user?.is_master)}
        />
        {savingCommand ? <p className="quick-message-saving">Salvando...</p> : null}
      </Modal>

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirmar Exclusao"
      >
        <div className="confirm-modal-content">
          <p>Voce tem certeza que deseja excluir este comando? Esta acao nao pode ser desfeita.</p>
          <div className="confirm-modal-actions">
            <button
              className="quick-messages-modal-cancel-button"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="quick-messages-modal-delete-button"
              onClick={() => void handleConfirmDelete()}
            >
              Sim, Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
