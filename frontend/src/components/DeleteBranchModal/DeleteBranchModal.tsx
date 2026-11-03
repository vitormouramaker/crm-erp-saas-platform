import { useState } from 'react';
import type { Branch } from '../../data/mockData';
import { FiArrowRight } from 'react-icons/fi'; // Importar o novo ícone
import './DeleteBranchModal.css';

interface DeleteBranchModalProps {
  branchToDelete: Branch;
  allBranches: Branch[];
  onConfirm: (branchToDeleteId: number, destinationBranchId?: number) => void;
  onClose: () => void;
}

export function DeleteBranchModal({ branchToDelete, allBranches, onConfirm, onClose }: DeleteBranchModalProps) {
  const [shouldRemanejar, setShouldRemanejar] = useState(false);
  const [destinationBranchId, setDestinationBranchId] = useState<string>('');

  const handleConfirm = () => {
    // Se o remanejamento estiver marcado, mas nenhuma filial de destino for selecionada, exibe um erro.
    if (shouldRemanejar && !destinationBranchId) {
      alert('Por favor, selecione uma filial de destino para o estoque.');
      return;
    }
    onConfirm(branchToDelete.id, shouldRemanejar ? Number(destinationBranchId) : undefined);
  };

  // Filtra a lista de filiais para o dropdown de destino, removendo a filial que será apagada.
  const destinationOptions = allBranches.filter(b => b.id !== branchToDelete.id);

  return (
    <div className="delete-branch-modal">
      <p>Você tem certeza que deseja apagar a filial <strong>{branchToDelete.name}</strong>? Esta ação não pode ser desfeita.</p>

      <div className="toggle-wrapper">
        <label htmlFor="toggle-remanejar">Você deseja remanejar o estoque desta filial?</label>
        <input 
          type="checkbox" 
          id="toggle-remanejar" 
          className="toggle-switch" 
          checked={shouldRemanejar} 
          onChange={(e) => setShouldRemanejar(e.target.checked)} 
        />
      </div>

      {shouldRemanejar && (
        <div className="remanejar-section">
          <div className="remanejar-row">
            <div className="form-group">
              <label>De:</label>
              <input type="text" value={branchToDelete.name} disabled />
            </div>
            {/* ATUALIZADO: Usando o ícone de seta */}
            <FiArrowRight className="remanejar-arrow-icon" /> 
            <div className="form-group">
              <label>Para:</label>
              <select value={destinationBranchId} onChange={e => setDestinationBranchId(e.target.value)} required>
                <option value="" disabled>Selecione a filial de destino...</option>
                {destinationOptions.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="cancel-button" onClick={onClose}>Cancelar</button>
        <button type="button" className="delete-button" onClick={handleConfirm}>
          Sim, Apagar Filial
        </button>
      </div>
    </div>
  );
}