import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiBold, FiChevronDown, FiChevronUp, FiFileText, FiImage, FiItalic,
  FiMinus, FiMove, FiPhone, FiPlus, FiTrash2, FiType, FiVideo, FiVolume2,
} from "react-icons/fi";
import type {
  Command, CommandCreationData, QuickMessageDraftMedia,
  QuickMessageDraftSequenceItem, QuickMessageMediaType,
} from "../../contexts/CommandsContext";
import type {
  QuickMessageGalleryAudio, QuickMessageGalleryDocument, QuickMessageGalleryImage,
} from "../../types/quickMessages";
import { Input } from "../common/Input/Input";
import "./CommandForm.css";

const VIDEO_LIMIT = 10;
const LIMITS = {
  image: 5 * 1024 * 1024,
  document: 100 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
};
const ALLOWED_MIMES: Record<QuickMessageMediaType, string[]> = {
  image: ["image/jpeg", "image/png"],
  document: ["application/pdf"],
  audio: ["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"],
  video: ["video/mp4", "video/3gpp"],
};
const LABELS = { image: "Imagem", document: "Documento", audio: "Audio", video: "Video" };

type TextBlock = { key: string; value: string };
type GalleryItem = { id: number; nome_arquivo: string; url?: string };

function key(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderWhatsAppText(value: string) {
  const pattern = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;
  return value.split(pattern).map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```")) return <code key={index}>{part.slice(3, -3)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <strong key={index}>{part.slice(1, -1)}</strong>;
    if (part.startsWith("_") && part.endsWith("_")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("~") && part.endsWith("~")) return <s key={index}>{part.slice(1, -1)}</s>;
    return part;
  });
}

interface Props {
  onSave: (data: Command | CommandCreationData) => void;
  onCancel: () => void;
  initialData?: Command | null;
  galleryImages: QuickMessageGalleryImage[];
  galleryDocuments: QuickMessageGalleryDocument[];
  galleryAudios: QuickMessageGalleryAudio[];
  users: Array<{ id: number; name: string }>;
  currentUserId: number;
  canManageScope: boolean;
}

export function CommandForm(props: Props) {
  const { initialData, galleryImages, galleryDocuments, galleryAudios } = props;
  const [command, setCommand] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState(String(props.currentUserId));
  const [texts, setTexts] = useState<TextBlock[]>([]);
  const [media, setMedia] = useState<QuickMessageDraftMedia[]>([]);
  const [sequence, setSequence] = useState<QuickMessageDraftSequenceItem[]>([]);
  const [error, setError] = useState("");
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const objectUrls = useRef(new Set<string>());

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);

  useEffect(() => {
    const content = initialData?.content;
    const initialTexts = (content?.texts?.length ? content.texts : [initialData?.text || ""])
      .map((value, index) => ({ key: `text-${index}`, value }));
    const collections = [
      ["image", content?.images || (initialData?.image_url ? [{ id: Number(initialData.gallery_image_id), name: initialData.image_name || "Imagem", url: initialData.image_url }] : [])],
      ["document", content?.documents || (initialData?.document_url ? [{ id: Number(initialData.gallery_document_id), name: initialData.document_name || "Documento", url: initialData.document_url }] : [])],
      ["audio", content?.audios || (initialData?.audio_url ? [{ id: Number(initialData.gallery_audio_id), name: initialData.audio_name || "Audio", url: initialData.audio_url }] : [])],
      ["video", content?.videos || []],
    ] as const;
    const initialMedia: QuickMessageDraftMedia[] = collections.flatMap(([type, items]) =>
      items.filter((item) => Number(item.id) > 0).map((item) => ({
        key: `${type}-${item.id}`, type, id: Number(item.id), name: String(item.name || LABELS[type]), url: String(item.url || ""),
      })),
    );
    const legacyOrder = content?.order || (Array.isArray(initialData?.media_order) ? initialData.media_order : []);
    const orderedInitialMedia = [...initialMedia].sort((a, b) => {
      const aIndex = legacyOrder.indexOf(a.type);
      const bIndex = legacyOrder.indexOf(b.type);
      return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
    });
    const mediaKeyByIdentity = new Map(initialMedia.map((item) => [`${item.type}:${item.id}`, item.key]));
    const initialSequence: QuickMessageDraftSequenceItem[] = content?.sequence?.length
      ? content.sequence.reduce<QuickMessageDraftSequenceItem[]>((result, item, index) => {
          if (item.type === "text" && Number.isInteger(item.text_index) && initialTexts[item.text_index!]) {
            result.push({ key: `sequence-${index}`, type: "text", text_key: initialTexts[item.text_index!].key });
            return result;
          }
          const mediaKey = mediaKeyByIdentity.get(`${item.type}:${item.id}`);
          if (!mediaKey) return result;
          result.push({
            key: `sequence-${index}`, type: item.type as QuickMessageMediaType, media_key: mediaKey,
            caption_text_key: Number.isInteger(item.caption_text_index) ? initialTexts[item.caption_text_index!]?.key : null,
          });
          return result;
        }, [])
      : [
          ...initialTexts.map((item) => ({ key: key("sequence"), type: "text" as const, text_key: item.key })),
          ...orderedInitialMedia.map((item) => ({
            key: key("sequence"),
            type: item.type,
            media_key: item.key,
            caption_text_key:
              initialData?.use_text_as_image_caption && item.type === "image" && initialTexts.length === 1
                ? initialTexts[0].key
                : null,
          })),
        ];
    setCommand(initialData?.command || "");
    setDescription(initialData?.description || "");
    setOwner(initialData ? (initialData.usuario_id ? String(initialData.usuario_id) : "global") : String(props.currentUserId));
    setTexts(initialTexts.length ? initialTexts : [{ key: key("text"), value: "" }]);
    setMedia(initialMedia);
    setSequence(initialSequence);
    setError("");
  }, [initialData, props.currentUserId]);

  const captionTextKeys = useMemo(() => new Set(sequence.map((item) => item.caption_text_key).filter(Boolean)), [sequence]);
  const galleryByType: Record<QuickMessageMediaType, GalleryItem[]> = {
    image: galleryImages,
    document: galleryDocuments,
    audio: galleryAudios,
    video: initialData?.content?.videos?.map((item) => ({ id: item.id, nome_arquivo: item.name, url: item.url })) || [],
  };

  const addText = () => {
    const text = { key: key("text"), value: "" };
    setTexts((current) => [...current, text]);
    setSequence((current) => [...current, { key: key("sequence"), type: "text", text_key: text.key }]);
  };
  const removeText = (textKey: string) => {
    if (texts.length === 1) return;
    setTexts((current) => current.filter((item) => item.key !== textKey));
    setSequence((current) => current
      .filter((item) => item.text_key !== textKey)
      .map((item) => item.caption_text_key === textKey ? { ...item, caption_text_key: null } : item));
  };
  const formatText = (textKey: string, before: string, after = before, placeholder = "texto") => {
    const textarea = textareaRefs.current[textKey];
    const block = texts.find((item) => item.key === textKey);
    if (!block) return;
    const start = textarea?.selectionStart ?? block.value.length;
    const end = textarea?.selectionEnd ?? block.value.length;
    const selected = block.value.slice(start, end) || placeholder;
    const value = `${block.value.slice(0, start)}${before}${selected}${after}${block.value.slice(end)}`;
    setTexts((current) => current.map((item) => item.key === textKey ? { ...item, value } : item));
  };
  const addGalleryMedia = (type: QuickMessageMediaType, idValue: string) => {
    const id = Number(idValue);
    const item = galleryByType[type].find((entry) => Number(entry.id) === id);
    if (!item || media.some((entry) => entry.type === type && Number(entry.id) === id)) return;
    const draft: QuickMessageDraftMedia = { key: key(type), type, id, name: item.nome_arquivo, url: item.url };
    setMedia((current) => [...current, draft]);
    setSequence((current) => [...current, { key: key("sequence"), type, media_key: draft.key }]);
  };
  const addFiles = (type: QuickMessageMediaType, files: File[]) => {
    const invalid = files.find((file) => !ALLOWED_MIMES[type].includes(file.type));
    if (invalid) return setError(`${invalid.name}: formato nao aceito pela Meta.`);
    const oversized = files.find((file) => file.size > LIMITS[type]);
    if (oversized) return setError(`${oversized.name}: limite de ${LIMITS[type] / 1024 / 1024}MB excedido.`);
    const currentVideos = media.filter((item) => item.type === "video").length;
    if (type === "video" && currentVideos + files.length > VIDEO_LIMIT) return setError(`Limite de ${VIDEO_LIMIT} videos atingido.`);
    const additions = files.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);
      return { key: key(type), type, file, name: file.name, url };
    });
    setMedia((current) => [...current, ...additions]);
    setSequence((current) => [...current, ...additions.map((item) => ({ key: key("sequence"), type, media_key: item.key }))]);
    setError("");
  };
  const removeMedia = (mediaKey: string) => {
    const item = media.find((entry) => entry.key === mediaKey);
    if (item?.file && item.url) {
      URL.revokeObjectURL(item.url);
      objectUrls.current.delete(item.url);
    }
    setMedia((current) => current.filter((entry) => entry.key !== mediaKey));
    setSequence((current) => current.filter((entry) => entry.media_key !== mediaKey));
  };
  const moveSequence = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sequence.length) return;
    setSequence((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  };
  const setMediaCaption = (sequenceKey: string, textKey: string) => {
    setSequence((current) => current.map((item) => {
      if (item.key === sequenceKey) return { ...item, caption_text_key: textKey || null };
      if (textKey && item.caption_text_key === textKey) return { ...item, caption_text_key: null };
      return item;
    }));
  };

  const renderMedia = (item: QuickMessageDraftMedia, compact = false) => {
    if (item.type === "image") return item.url ? <img className={compact ? "command-sequence-thumb" : "command-preview-image"} src={item.url} alt={item.name} /> : <FiImage />;
    if (item.type === "audio") return item.url ? <audio controls preload="metadata" src={item.url} /> : <FiVolume2 />;
    if (item.type === "video") return item.url ? <video controls preload="metadata" src={item.url} /> : <FiVideo />;
    return <div className="command-document-visual"><FiFileText /><span><strong>{item.name}</strong><small>PDF</small></span></div>;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nonEmptyTexts = texts.filter((item) => item.value.trim());
    if (!nonEmptyTexts.length && !media.length) return setError("Adicione ao menos um texto ou uma midia.");
    for (const item of sequence) {
      const caption = texts.find((text) => text.key === item.caption_text_key)?.value || "";
      if (caption.length > 1024) return setError("Legenda da midia deve ter no maximo 1024 caracteres.");
    }
    const validTextKeys = new Set(nonEmptyTexts.map((item) => item.key));
    const validMediaKeys = new Set(media.map((item) => item.key));
    const finalSequence = sequence.filter((item) => item.type === "text" ? validTextKeys.has(String(item.text_key)) : validMediaKeys.has(String(item.media_key)));
    const data: CommandCreationData = {
      command: command.replace(/\s+/g, "_").toLowerCase(), description,
      text: nonEmptyTexts[0]?.value.trim() || "", text_blocks: nonEmptyTexts.map((item) => item.value.trim()),
      text_keys: nonEmptyTexts.map((item) => item.key), draft_media: media, draft_sequence: finalSequence,
      media_order: [], use_text_as_image_caption: finalSequence.some((item) => Boolean(item.caption_text_key)),
      usuario_id: owner === "global" ? null : Number(owner), scope: owner === "global" ? "global" : "user",
    };
    props.onSave(initialData ? { ...data, id: initialData.id } : data);
  };

  const mediaPicker = (type: QuickMessageMediaType, icon: React.ReactNode, accept: string) => (
    <article className="command-media-picker">
      <header><span>{icon}</span><div><strong>{LABELS[type]}s</strong><small>{type === "image" ? "JPEG/PNG, ate 5MB" : type === "video" ? "Ate 10 MP4/3GP de 16MB" : type === "audio" ? "AAC, M4A, MP3, AMR ou OGG, ate 16MB" : "PDF, ate 100MB"}</small></div></header>
      {galleryByType[type].length ? <select value="" onChange={(event) => addGalleryMedia(type, event.target.value)}><option value="">Escolher da galeria...</option>{galleryByType[type].map((item) => <option key={item.id} value={item.id}>{item.nome_arquivo}</option>)}</select> : null}
      <label className="command-media-upload"><FiPlus /> Enviar arquivos<input type="file" multiple accept={accept} onChange={(event) => { addFiles(type, Array.from(event.target.files || [])); event.target.value = ""; }} /></label>
    </article>
  );

  return <form className="command-form command-composer" onSubmit={submit}>
    <div className="command-composer-grid">
      <main className="command-composer-main">
        <section className="command-form-card">
          <div className="command-form-section-title"><span>1</span><div><strong>Identificacao</strong><small>Nome curto para localizar resposta.</small></div></div>
          <div className="command-identification-grid"><Input label="Comando (sem /)" value={command} onChange={(event) => setCommand(event.target.value)} required /><Input label="Descricao" value={description} onChange={(event) => setDescription(event.target.value)} required /></div>
          {props.canManageScope ? <label className="command-gallery-field"><span>Quem pode usar</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value={String(props.currentUserId)}>Somente eu</option><option value="global">Todos os usuarios</option>{props.users.filter((user) => user.id !== props.currentUserId).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label> : null}
        </section>

        <section className="command-form-card">
          <div className="command-form-section-heading"><div className="command-form-section-title"><span>2</span><div><strong>Textos</strong><small>Cada caixa pode ser mensagem ou legenda.</small></div></div><button type="button" className="command-add-button" onClick={addText}><FiPlus /> Nova caixa</button></div>
          <div className="command-text-blocks">{texts.map((block, index) => <article key={block.key} className="command-text-block"><header><strong>Texto {index + 1}</strong>{texts.length > 1 ? <button type="button" onClick={() => removeText(block.key)}><FiTrash2 /> Remover</button> : null}</header><div className="command-format-toolbar"><button type="button" onClick={() => formatText(block.key, "*", "*", "negrito")}><FiBold /></button><button type="button" onClick={() => formatText(block.key, "_", "_", "italico")}><FiItalic /></button><button type="button" onClick={() => formatText(block.key, "~", "~", "tachado")}><FiMinus /></button><button type="button" onClick={() => formatText(block.key, "```", "```", "codigo")}><FiType /></button></div><textarea ref={(element) => { textareaRefs.current[block.key] = element; }} value={block.value} onChange={(event) => setTexts((current) => current.map((item) => item.key === block.key ? { ...item, value: event.target.value } : item))} rows={4} placeholder="Digite o texto..." /></article>)}</div>
        </section>

        <section className="command-form-card">
          <div className="command-form-section-title"><span>3</span><div><strong>Biblioteca desta mensagem</strong><small>Arquivos adicionados entram no fim da sequencia.</small></div></div>
          <div className="command-media-picker-grid">{mediaPicker("image", <FiImage />, "image/jpeg,image/png,.jpg,.jpeg,.png")}{mediaPicker("document", <FiFileText />, "application/pdf")}{mediaPicker("audio", <FiVolume2 />, "audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,.aac,.m4a,.mp3,.amr,.ogg,.opus")}{mediaPicker("video", <FiVideo />, "video/mp4,video/3gpp,.mp4,.3gp")}</div>
          {error ? <p className="command-limit-warning">{error}</p> : null}
        </section>

        <section className="command-form-card command-sequence-section">
          <div className="command-form-section-title"><span>4</span><div><strong>Sequencia de envio</strong><small>Mova cada item. Em imagens, videos e documentos, escolha o texto usado como legenda.</small></div></div>
          <div className="command-sequence-list">{sequence.map((entry, index) => {
            const text = texts.find((item) => item.key === entry.text_key);
            const mediaItem = media.find((item) => item.key === entry.media_key);
            if (!text && !mediaItem) return null;
            return <article className="command-sequence-item" key={entry.key}><span className="command-sequence-position">{index + 1}</span><span className="command-sequence-drag"><FiMove /></span><div className="command-sequence-content">{text ? <><strong>Texto</strong><p>{text.value || "Texto vazio"}</p>{captionTextKeys.has(text.key) ? <small>Usado como legenda, nao sera enviado separado.</small> : null}</> : mediaItem ? <div className="command-sequence-media">{renderMedia(mediaItem, true)}<div><strong>{LABELS[mediaItem.type]}</strong><p>{mediaItem.name}</p></div></div> : null}{mediaItem && ["image", "video", "document"].includes(mediaItem.type) ? <label className="command-caption-select"><span>Legenda deste arquivo</span><select value={entry.caption_text_key || ""} onChange={(event) => setMediaCaption(entry.key, event.target.value)}><option value="">Sem legenda</option>{texts.filter((item) => item.value.trim()).map((item, textIndex) => <option key={item.key} value={item.key}>Texto {textIndex + 1}: {item.value.slice(0, 45)}</option>)}</select></label> : null}</div><div className="command-sequence-actions"><button type="button" disabled={index === 0} onClick={() => moveSequence(index, -1)}><FiChevronUp /></button><button type="button" disabled={index === sequence.length - 1} onClick={() => moveSequence(index, 1)}><FiChevronDown /></button>{mediaItem ? <button type="button" className="is-danger" onClick={() => removeMedia(mediaItem.key)}><FiTrash2 /></button> : null}</div></article>;
          })}</div>
        </section>
      </main>

      <aside className="command-live-preview">
        <div className="command-live-preview-title"><span><FiPhone /></span><div><strong>Preview completo</strong><small>Ordem final no WhatsApp</small></div></div>
        <div className="command-whatsapp-phone"><div className="command-whatsapp-phone__header"><span>W</span><div><strong>Cliente</strong><small>online</small></div></div><div className="command-whatsapp-chat">
          {!sequence.length ? <p className="command-whatsapp-empty">Adicione textos e midias.</p> : sequence.map((entry) => {
            const text = texts.find((item) => item.key === entry.text_key);
            const mediaItem = media.find((item) => item.key === entry.media_key);
            if (text && captionTextKeys.has(text.key)) return null;
            if (text && text.value.trim()) return <div className="command-whatsapp-bubble" key={entry.key}><div className="command-whatsapp-text">{renderWhatsAppText(text.value)}</div><time>12:45 ✓✓</time></div>;
            if (!mediaItem) return null;
            const captionText = texts.find((item) => item.key === entry.caption_text_key)?.value;
            return <div className="command-whatsapp-bubble command-whatsapp-media-bubble" key={entry.key}>{renderMedia(mediaItem)}{captionText ? <div className="command-whatsapp-text">{renderWhatsAppText(captionText)}</div> : null}<time>12:45 ✓✓</time></div>;
          })}
        </div></div><div className="command-whatsapp-preview__command"><small>Atalho</small><strong>/{command || "comando"}</strong></div>
      </aside>
    </div>
    <div className="form-actions"><button type="button" className="cancel-button" onClick={props.onCancel}>Cancelar</button><button type="submit" className="save-button">Salvar mensagem</button></div>
  </form>;
}
