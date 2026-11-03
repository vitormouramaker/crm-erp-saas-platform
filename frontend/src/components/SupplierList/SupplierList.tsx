import { useState, useMemo, useEffect } from 'react';
import { FiEdit, FiTrash2, FiPlus } from 'react-icons/fi';
import type { Supplier } from '../../data/mockData';
import { Modal } from '../common/Modal/Modal';
import { SupplierForm } from '../SupplierForm/SupplierForm';
import { API_BASE } from '../../config/api';
import { encrypt, decrypt } from '../../utils/cripto';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import './SupplierList.css';

interface SupplierListProps {
  searchTerm: string;
}

export function SupplierList({ searchTerm }: SupplierListProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!user?.empresa_id) {
        setLoading(false);
        return;
      }

      try {
        const encrypted = await encrypt({ empresa_id: user.empresa_id });
        const response = await fetch(`${API_BASE}/estoque/lista_fabricante`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });

        const respData = await response.json();
        const resp = await decrypt(respData.payload) as { boleano: boolean; obj: Supplier[] };

        if (resp?.boleano && Array.isArray(resp.obj)) {
          setSuppliers(resp.obj);
        }
      } catch (err) {
        console.error("Erro ao carregar fornecedores:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
  }, [user?.empresa_id]);

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    const lowercasedFilter = searchTerm.toLowerCase();
    if (!lowercasedFilter) return suppliers;
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(lowercasedFilter) ||
      s.contactPerson.toLowerCase().includes(lowercasedFilter) ||
      s.email.toLowerCase().includes(lowercasedFilter)
    );
  }, [suppliers, searchTerm]);

  const handleOpenModal = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
  };

  const confirmDeleteSupplier = async () => {
    if (!user?.empresa_id || !supplierToDelete) return;

    try {
      const encrypted = await encrypt({ empresa_id: user.empresa_id, fabricante_id: supplierToDelete.id });
      const response = await fetch(`${API_BASE}/estoque/deletar_fabricante`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = await decrypt(respData.payload) as { boleano: boolean };

      if (resp?.boleano) {
        setSuppliers(prev => prev.filter(s => s.id !== supplierToDelete.id));
        setSupplierToDelete(null);
        addToast({ type: "success", title: "Fornecedor excluído com sucesso!" });
      } else {
        addToast({ type: "error", title: "Não foi possível excluir o fornecedor." });
      }
    } catch (err) {
      console.error("Erro ao deletar fornecedor:", err);
      addToast({ type: "error", title: "Erro ao excluir fornecedor." });
    }
  };

  const handleSave = async (supplierData: Omit<Supplier, 'id'> | Supplier) => {
    if (!user?.empresa_id) return;

    try {
      if ('id' in supplierData) {
        const encrypted = await encrypt({ empresa_id: user.empresa_id, ...supplierData });
        const response = await fetch(`${API_BASE}/estoque/editar_fabricante`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });

        const respData = await response.json();
        const resp = await decrypt(respData.payload) as { boleano: boolean; obj: Supplier };

        if (resp?.boleano) {
          setSuppliers(prev => prev.map(s => (s.id === supplierData.id ? supplierData : s)));
          addToast({ type: "success", title: "Fornecedor atualizado com sucesso!" });
        } else {
          addToast({ type: "error", title: "Não foi possível atualizar o fornecedor." });
        }
      } else {
        const encrypted = await encrypt({ empresa_id: user.empresa_id, ...supplierData });
        const response = await fetch(`${API_BASE}/estoque/cadastro_fabricante`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });

        const respData = await response.json();
        const resp = await decrypt(respData.payload) as { boleano: boolean; obj: Supplier };

        if (resp?.boleano) {
          setSuppliers(prev => [resp.obj, ...prev]);
          addToast({ type: "success", title: "Fornecedor cadastrado com sucesso!" });
        } else {
          addToast({ type: "error", title: "Não foi possível cadastrar o fornecedor." });
        }
      }
    } catch (err) {
      console.error("Erro ao salvar fornecedor:", err);
    } finally {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="supplier-list-container">
      <div className="list-header-actions">
        <h3>Fornecedores Cadastrados</h3>
        <button className="add-new-button" onClick={handleOpenModal}>
          <FiPlus /> Novo Fornecedor
        </button>
      </div>

      {loading ? (
        <p>Carregando fornecedores...</p>
      ) : (
        <div className="supplier-grid">
          {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="supplier-card">
              <div className="card-header">
                <h4 className="supplier-name">{supplier.name}</h4>
                <span className="supplier-id">ID: {supplier.id}</span>
              </div>
              <div className="card-body">
                <div className="info-row">
                  <span>Contato:</span>
                  <span>{supplier.contactPerson}</span>
                </div>
                <div className="info-row">
                  <span>CNPJ:</span>
                  <span>{supplier.cnpj}</span>
                </div>
                <div className="info-row">
                  <span>Telefone:</span>
                  <span>{supplier.phone}</span>
                </div>
                <div className="info-row">
                  <span>E-mail:</span>
                  <span>{supplier.email}</span>
                </div>
              </div>
              <div className="card-footer">
                <div className="action-buttons">
                  <button className="action-button" title="Editar Fornecedor" onClick={() => handleEdit(supplier)}>
                    <FiEdit />
                  </button>
                  <button className="action-button" title="Remover Fornecedor" onClick={() => handleDelete(supplier)}>
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'Editar Fornecedor' : 'Adicionar Novo Fornecedor'}
      >
        <SupplierForm
          onSave={handleSave}
          onCancel={() => setIsModalOpen(false)}
          initialData={editingSupplier}
        />
      </Modal>

      <Modal
        isOpen={!!supplierToDelete}
        onClose={() => setSupplierToDelete(null)}
        title="Excluir Fornecedor"
      >
        <div className="supplier-delete-modal">
          <p>
            Tem certeza que deseja excluir o fornecedor{" "}
            <strong>{supplierToDelete?.name}</strong>? Essa ação pode afetar
            cadastros e produtos vinculados.
          </p>
          <div className="supplier-delete-actions">
            <button className="cancel-button" onClick={() => setSupplierToDelete(null)}>
              Cancelar
            </button>
            <button className="danger-button" onClick={confirmDeleteSupplier}>
              Excluir fornecedor
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
