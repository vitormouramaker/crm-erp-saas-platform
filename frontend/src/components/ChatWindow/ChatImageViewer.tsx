import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiChevronLeft, FiChevronRight, FiCornerUpLeft, FiDownload, FiExternalLink, FiSmile, FiX, FiZoomIn, FiZoomOut } from "react-icons/fi";
import "./ChatImageViewer.css";

export interface ViewerImage {
  id: number;
  url: string;
  name: string;
  sender: string;
  timestamp: Date;
  caption?: string;
}

interface Props {
  images: ViewerImage[];
  selectedId: number;
  reactions: string[];
  canInteract: boolean;
  onSelect: (id: number) => void;
  onClose: () => void;
  onReply: (id: number) => void;
  onDownload: (id: number) => void;
  onReact: (id: number, reaction: string) => Promise<void>;
}

export function ChatImageViewer(props: Props) {
  const { images, selectedId, onSelect, onClose } = props;
  const index = images.findIndex((item) => item.id === selectedId);
  const selected = images[index];
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showReactions, setShowReactions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    setZoom(1);
    setNotice("");
    setShowReactions(false);
    stageRef.current?.scrollTo(0, 0);
  }, [selectedId]);

  useEffect(() => {
    if (!selected) onClose();
  }, [selected, onClose]);

  useEffect(() => {
    const strip = thumbnailsRef.current;
    if (!strip) return;
    const centerSelected = () => {
      const thumbnail = strip.querySelector<HTMLButtonElement>('[aria-current="true"]');
      if (thumbnail) strip.scrollTo({ left: thumbnail.offsetLeft + thumbnail.offsetWidth / 2 - strip.clientWidth / 2 });
    };
    centerSelected();
    const observer = new ResizeObserver(centerSelected);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [selectedId, images.length]);

  if (!selected) return null;

  return createPortal(
    <div className="chat-image-viewer" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Visualizador de imagens"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
        if (event.key === "ArrowLeft" && index > 0) onSelect(images[index - 1].id);
        if (event.key === "ArrowRight" && index < images.length - 1) onSelect(images[index + 1].id);
        if (event.key === "Tab") {
          const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || []);
          const first = buttons[0]; const last = buttons[buttons.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <header className="chat-image-viewer__header">
        <div className="chat-image-viewer__sender"><strong>{selected.sender}</strong><span>{selected.timestamp.toLocaleString("pt-BR")} · {index + 1} / {images.length}</span></div>
        <div className="chat-image-viewer__actions">
          <button title="Diminuir zoom" aria-label="Diminuir zoom" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.5))}><FiZoomOut /></button>
          <button title="Ampliar imagem" aria-label="Ampliar imagem" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + 0.5))}><FiZoomIn /></button>
          <button title="Responder" aria-label="Responder à imagem" disabled={!props.canInteract} onClick={() => props.onReply(selectedId)}><FiCornerUpLeft /></button>
          <button title="Reagir" aria-label="Reagir à imagem" disabled={!props.canInteract || busy} aria-expanded={showReactions} onClick={() => setShowReactions(!showReactions)}><FiSmile /></button>
          <button title="Abrir imagem em nova aba" aria-label="Abrir imagem em nova aba" onClick={() => window.open(selected.url, "_blank", "noopener,noreferrer")}><FiExternalLink /></button>
          <button title="Baixar imagem" aria-label="Baixar imagem" onClick={() => props.onDownload(selectedId)}><FiDownload /></button>
          <button title="Fechar" aria-label="Fechar visualizador" onClick={onClose}><FiX /></button>
        </div>
      </header>
      {showReactions && <div className="chat-image-viewer__reactions" aria-label="Escolher reação">{props.reactions.map((reaction) => <button key={reaction} disabled={busy} aria-label={`Reagir com ${reaction}`} onClick={async () => { setBusy(true); try { await props.onReact(selectedId, reaction); setShowReactions(false); } finally { setBusy(false); } }}>{reaction}</button>)}</div>}
      <div className="chat-image-viewer__stage" ref={stageRef}
        onPointerDown={(event) => { if (zoom <= 1 || event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }; }}
        onPointerMove={(event) => { const drag = dragRef.current; if (drag) { event.currentTarget.scrollLeft = drag.left - (event.clientX - drag.x); event.currentTarget.scrollTop = drag.top - (event.clientY - drag.y); } }}
        onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
        <div className="chat-image-viewer__canvas" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, cursor: zoom > 1 ? "grab" : "default" }}>
          <img key={selectedId} src={selected.url} alt={selected.caption || selected.name} draggable={false} onDoubleClick={() => setZoom(zoom > 1 ? 1 : 2)} onError={() => setNotice("Não foi possível carregar a imagem.")} />
        </div>
      </div>
      <button className="chat-image-viewer__previous" title="Imagem anterior" aria-label="Imagem anterior" disabled={index === 0} onClick={() => onSelect(images[index - 1].id)}><FiChevronLeft /></button>
      <button className="chat-image-viewer__next" title="Próxima imagem" aria-label="Próxima imagem" disabled={index === images.length - 1} onClick={() => onSelect(images[index + 1].id)}><FiChevronRight /></button>
      <div className="chat-image-viewer__notice" role="status">{notice}</div>
      <footer className="chat-image-viewer__thumbnails" ref={thumbnailsRef}>{images.map((item) => <button key={item.id} aria-label={`Abrir imagem ${item.name}`} aria-current={item.id === selectedId ? "true" : undefined} onClick={() => onSelect(item.id)}><img src={item.url} alt="" loading="lazy" /></button>)}</footer>
    </div>, document.body,
  );
}
