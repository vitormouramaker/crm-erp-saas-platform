import "./NewAtendimentoModal.css";

type DeleteDealModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteDealModal({
  isOpen,
  onClose,
  onConfirm,
}: DeleteDealModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content new-atendimento-modal">
        <div className="modal-header">
          <h3>Excluir atendimento</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p>Essa acao remove o negocio do pipeline. Deseja continuar?</p>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn-confirm" onClick={onConfirm}>
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
