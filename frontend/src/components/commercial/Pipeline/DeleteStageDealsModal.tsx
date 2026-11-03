import "./NewAtendimentoModal.css";

type DeleteStageDealsModalProps = {
  isOpen: boolean;
  stageTitle: string;
  dealCount: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteStageDealsModal({
  isOpen,
  stageTitle,
  dealCount,
  loading = false,
  onClose,
  onConfirm,
}: DeleteStageDealsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content new-atendimento-modal">
        <div className="modal-header">
          <h3>Excluir cards da coluna</h3>
          <button className="close-btn" onClick={onClose} disabled={loading}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p>
            Isso vai excluir <strong>{dealCount}</strong> card(s) da coluna{" "}
            <strong>{stageTitle}</strong>.
          </p>
          <p>Essa acao nao pode ser desfeita. Deseja continuar?</p>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="button" className="btn-confirm" onClick={onConfirm} disabled={loading}>
              {loading ? "Excluindo..." : "Excluir todos"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
