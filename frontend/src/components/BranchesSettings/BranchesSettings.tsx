import { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiPlus, FiStar } from 'react-icons/fi';
import type { Branch } from '../../data/mockData';
import { useAuth } from "../../contexts/AuthContext";
import { Modal } from '../common/Modal/Modal';
import { BranchForm } from '../BranchForm/BranchForm';
import { DeleteBranchModal } from '../DeleteBranchModal/DeleteBranchModal';
import { API_BASE } from '../../config/api';
import { encrypt, decrypt } from '../../utils/cripto';
import './BranchesSettings.css';

function formatCoordinate(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'Nao informado';
  }

  return Number(value).toFixed(7);
}

export function BranchesSettings() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado para controlar o modal de exclusão e qual filial está sendo deletada
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);


  const { user: currentUser } = useAuth();

  if (!currentUser?.empresa_id) {
    return <p>Carregando usuário...</p>;
  }

  const planName = (currentUser as any)?.nome_plano as string | undefined;

  // conta filiais da lista
  const currFilial = branches.length;
  const maxFilial = Number((currentUser as any)?.max_filial ?? 0);
  const additionalFilial = Number((currentUser as any)?.additional_filial ?? 0);

  const filialLimit = maxFilial + additionalFilial;
  const remainingFiliais = Math.max(filialLimit - currFilial, 0);

  // master respeita o plano
  const isAtFilialLimit = filialLimit > 0 && currFilial >= filialLimit;

  const hasPrimaryBranch = branches.some(b => b.isPrimary);

  // Carregar filiais do backend
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const encrypted = await encrypt({ empresa_id: currentUser.empresa_id });
        const response = await fetch(`${API_BASE}/user/lista_filial`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });
        const respData = await response.json();
        const resp = await decrypt(respData.payload) as { boleano: boolean; obj: Branch[] };
        if (resp?.boleano) {
          setBranches(resp.obj);
        }
      } catch (err) {
        console.error("Erro ao carregar filiais:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBranches();
  }, [currentUser.empresa_id]);

  const handleOpenFormModal = (branch: Branch | null) => {
    setEditingBranch(branch);
    setIsFormModalOpen(true);
  };

  // A ação do botão de lixeira apenas abre o modal de confirmação
  const handleOpenDeleteModal = (branch: Branch) => {
    setDeletingBranch(branch);
  };

  // Função chamada pelo DeleteBranchModal para executar a exclusão
  const handleConfirmDelete = async (branchId: number, destinationBranchId?: number) => {
    try {
      const payload: { empresa_id: any; filial_id: number; destinationBranchId?: number } = {
        empresa_id: currentUser.empresa_id,
        filial_id: branchId,
      };
      // Adiciona o ID de destino ao payload se o remanejamento for selecionado
      if (destinationBranchId) {
        payload.destinationBranchId = destinationBranchId;
      }

      const encrypted = await encrypt(payload);
      const response = await fetch(`${API_BASE}/user/deletar_filial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = await decrypt(respData.payload) as { boleano: boolean };

      if (resp?.boleano) {
        setBranches(prev => prev.filter(b => b.id !== branchId));
        alert('Filial removida com sucesso!');
      } else {
        throw new Error('Falha ao remover a filial no servidor.');
      }
    } catch (err) {
      console.error("Erro ao deletar filial:", err);
      alert('Não foi possível remover a filial.');
    } finally {
      setDeletingBranch(null); // Fecha o modal de exclusão
    }
  };

  const handleSave = async (branchData: Omit<Branch, 'id'> | Branch) => {

    const isCreating = !("id" in branchData);

    if (isCreating && isAtFilialLimit) {
      alert(
        `Você atingiu o limite de filiais do seu plano (${filialLimit}). ` +
        `Remova uma filial ou compre pacotes extras (em breve).`
      );
      return;
    }
    
    try {
      const payload = { empresa_id: currentUser.empresa_id, ...branchData };

      if (branchData.isPrimary) {
        setBranches(prev => prev.map(b => ({ ...b, isPrimary: false })));
      }

      if ('id' in branchData) {
        const encrypted = await encrypt(payload);
        const response = await fetch(`${API_BASE}/user/editar_filial`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });
        const respData = await response.json();
        const resp = await decrypt(respData.payload) as { boleano: boolean; obj: Branch };
        if (resp?.boleano) {
          setBranches(prev => prev.map(b => b.id === branchData.id ? (resp.obj || branchData as Branch) : b));
        }
      } else {
        const encrypted = await encrypt(payload);
        const response = await fetch(`${API_BASE}/user/cadastro_filial`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });
        const respData = await response.json();
        const resp = await decrypt(respData.payload) as { boleano: boolean; obj: Branch };
        if (resp?.boleano) {
          setBranches(prev => [resp.obj, ...prev]);
        }
      }
    } catch (err) {
      console.error("Erro ao salvar filial:", err);
    } finally {
      setIsFormModalOpen(false);
    }
  };

  if (loading) return <p>Carregando filiais...</p>;

  return (
    <div className="branches-settings-container">
      <div className="list-header-actions">
        <h3>Filiais Cadastradas</h3>

        <div className="users-plan-counter">
          <div className="branches-plan-info">
            <div className="plan-line">
              <strong>Plano:</strong> <span>{planName || "—"}</span>
            </div>

            <div className="count-line">
              <strong>Filiais:</strong>{" "}
              <span>
                {currFilial}/{filialLimit} • Restam {remainingFiliais}
                {additionalFilial > 0 ? ` (+${additionalFilial} extra)` : ""}
              </span>
            </div>
          </div>

          <div className="users-plan-actions-buttons">
            {!isAtFilialLimit && (
              <button className="add-new-button" onClick={() => handleOpenFormModal(null)}>
                <FiPlus /> Nova Filial
              </button>
            )}

            {isAtFilialLimit && (
              <button
                className="buy-more-button"
                type="button"
                disabled
                title="Em breve (pagamento via Stripe)"
              >
                Comprar mais filiais
              </button>
            )}
          </div>
        </div>


      </div>

      <div className="branches-grid">
        {branches.map((branch) => {
          const hasCoordinates =
            branch.latitude !== null &&
            branch.latitude !== undefined &&
            branch.longitude !== null &&
            branch.longitude !== undefined;
          const mapUrl = hasCoordinates
            ? `https://www.google.com/maps?q=${branch.latitude},${branch.longitude}`
            : '';

          return (
            <div key={branch.id} className={`branch-card ${branch.isPrimary ? 'primary' : ''}`}>
            {branch.isPrimary && <div className="primary-badge"><FiStar size={12} /> Principal</div>}
            <div className="card-header">
              <h4 className="branch-name">{branch.name}</h4>
            </div>
            <div className="card-body">
              <p>{branch.address}</p>
              <p><strong>Responsável:</strong> {branch.manager}</p>
              <p><strong>CNPJ:</strong> {branch.cnpj}</p>
              <p><strong>Contato:</strong> {branch.contact}</p>
              <p><strong>Latitude:</strong> {formatCoordinate(branch.latitude)}</p>
              <p><strong>Longitude:</strong> {formatCoordinate(branch.longitude)}</p>
              <p><strong>Tolerancia:</strong> {branch.toleranceMeters || 100} m</p>
              {hasCoordinates ? (
                <a
                  className="branch-map-link"
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir localizacao no mapa
                </a>
              ) : null}
            </div>
            <div className="card-footer">
              <div className="action-buttons">
                <button className="action-button" title="Editar" onClick={() => handleOpenFormModal(branch)}><FiEdit /></button>
                {!branch.isPrimary && (
                  <button className="action-button" title="Remover" onClick={() => handleOpenDeleteModal(branch)}><FiTrash2 /></button>
                )}
              </div>
            </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingBranch ? 'Editar Filial' : 'Adicionar Nova Filial'}
      >
        <BranchForm
          onSave={handleSave}
          onCancel={() => setIsFormModalOpen(false)}
          initialData={editingBranch}
          isPrimaryDisabled={!editingBranch?.isPrimary && hasPrimaryBranch}
        />
      </Modal>

      {deletingBranch && (
        <Modal
          isOpen={!!deletingBranch}
          onClose={() => setDeletingBranch(null)}
          title={`Apagar Filial: ${deletingBranch.name}`}
        >
          <DeleteBranchModal
            branchToDelete={deletingBranch}
            allBranches={branches}
            onConfirm={handleConfirmDelete}
            onClose={() => setDeletingBranch(null)}
          />
        </Modal>
      )}
    </div>
  );
}
