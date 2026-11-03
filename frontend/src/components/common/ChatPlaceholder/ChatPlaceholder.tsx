import './ChatPlaceholder.css';

interface ChatPlaceholderProps {
  buttonText: string;
  onClick: () => void;
  message: string;
  loading?: boolean;
}

export function ChatPlaceholder({ buttonText, onClick, message, loading = false }: ChatPlaceholderProps) {
  return (
    <div className="chat-placeholder-container">
      <div className="placeholder-content">
        <p>{message}</p>
        <button onClick={onClick} className="action-button" disabled={loading}>
          {loading ? 'Processando...' : buttonText}
        </button>
      </div>
    </div>
  );
}