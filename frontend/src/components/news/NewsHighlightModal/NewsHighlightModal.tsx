import { FiAlertCircle, FiBell, FiCheckCircle, FiRefreshCw, FiTool, FiZap } from "react-icons/fi";
import { Modal } from "../../common/Modal/Modal";
import type { NewsItem } from "../../../service/newsService";
import "./NewsHighlightModal.css";

type NewsHighlightModalProps = {
  item: NewsItem | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkRead: () => void;
};

function getTypeMeta(type: NewsItem["type"]) {
  switch (type) {
    case "feature":
      return { label: "Nova funcionalidade", icon: <FiZap size={16} /> };
    case "improvement":
      return { label: "Melhoria", icon: <FiRefreshCw size={16} /> };
    case "fix":
      return { label: "Correção", icon: <FiTool size={16} /> };
    case "warning":
      return { label: "Aviso importante", icon: <FiAlertCircle size={16} /> };
    default:
      return { label: "Atualização", icon: <FiBell size={16} /> };
  }
}

function formatDateTime(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;
  return date.toLocaleString("pt-BR");
}

export function NewsHighlightModal({
  item,
  isOpen,
  onClose,
  onMarkRead,
}: NewsHighlightModalProps) {
  if (!isOpen || !item) {
    return null;
  }

  const typeMeta = getTypeMeta(item.type);
  const publishedAt = formatDateTime(item.publishedAt || item.createdAt);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novidade em destaque"
      size="lg"
      stackLevel={4000}
      overlayClassName="news-highlight-overlay"
    >
      <div className="news-highlight-modal">
        <div className="news-highlight-modal__hero">
          <div className="news-highlight-modal__eyebrow">
            {typeMeta.icon}
            <span>{typeMeta.label}</span>
          </div>
          <h3>{item.title}</h3>
          {item.summary ? <p>{item.summary}</p> : null}
        </div>

        <div className="news-highlight-modal__meta">
          {publishedAt ? <span>Publicado em {publishedAt}</span> : null}
          {item.featured ? <span>Destaque ativo</span> : null}
          {item.onlyMaster ? <span>Somente masters</span> : null}
          {!item.read ? <span>Não lida</span> : null}
        </div>

        {item.mediaUrl ? (
          <div className="news-highlight-modal__media">
            {item.mediaType === "video" ? (
              <video
                className="news-highlight-modal__media-asset"
                src={item.mediaUrl}
                controls
                preload="metadata"
                playsInline
              />
            ) : (
              <img
                className="news-highlight-modal__media-asset"
                src={item.mediaUrl}
                alt={item.title}
                loading="lazy"
              />
            )}
          </div>
        ) : null}

        <article className="news-highlight-modal__content">
          {item.content.split(/\r?\n/).filter(Boolean).map((paragraph, index) => (
            <p key={`${item.id}-paragraph-${index}`}>{paragraph}</p>
          ))}
        </article>

        <div className="news-highlight-modal__actions">
          <button
            type="button"
            className="news-highlight-modal__button news-highlight-modal__button--secondary"
            onClick={onClose}
          >
            Ver depois
          </button>
          <button
            type="button"
            className="news-highlight-modal__button news-highlight-modal__button--primary"
            onClick={onMarkRead}
          >
            <FiCheckCircle size={16} />
            <span>Marcar como lida</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
