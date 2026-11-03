import { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiPlus } from 'react-icons/fi';
import type { Category } from '../../data/mockData';
import { Modal } from '../common/Modal/Modal';
import { CategoryForm } from '../CategoryForm/CategoryForm';
import './CategoriesSettings.css';
import { API_BASE } from '../../config/api';
import { encrypt, decrypt } from '../../utils/cripto';
import { useAuth } from '../../contexts/AuthContext';

export function CategoriesSettings() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      if (!user?.empresa_id) {
        alert('Usuario nao encontrado na sessao');
        return;
      }

      const encrypted = await encrypt({ empresa_id: user.empresa_id });
      const response = await fetch(`${API_BASE}/user/listar_categoria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = await decrypt(respData.payload) as {
        boleano: boolean;
        obj: Category[];
        mensagem: string;
      };

      if (resp?.boleano) {
        setCategories(resp.obj);
      } else {
        console.error('Erro ao listar categorias:', resp?.mensagem);
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao buscar categorias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [user?.empresa_id]);

  const handleOpenModal = (category: Category | null) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setIsModalOpen(false);
    fetchCategories();
  };

  const handleDelete = async (categoryId: number) => {
    if (!window.confirm('Tem certeza? Excluir uma categoria pode afetar produtos existentes.')) return;

    try {
      if (!user?.id) {
        alert('Usuario nao encontrado na sessao');
        return;
      }

      const encrypted = await encrypt({ id: categoryId, usuario_id: user.id });
      const response = await fetch(`${API_BASE}/user/deletar_categoria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = await decrypt(respData.payload);

      if (resp?.boleano) {
        alert('Categoria deletada com sucesso!');
        fetchCategories();
      } else {
        alert(resp?.mensagem || 'Erro ao deletar categoria');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de comunicacao com o servidor.');
    }
  };

  return (
    <div className="categories-settings-container">
      <div className="list-header-actions">
        <h3>Categorias de Produtos</h3>
        <button className="add-new-button" onClick={() => handleOpenModal(null)}>
          <FiPlus /> Nova Categoria
        </button>
      </div>

      {loading ? (
        <p>Carregando categorias...</p>
      ) : (
        <div className="categories-list">
          {categories.map(category => (
            <div key={category.id} className="category-card">
              <div className="category-card-content">
                <span className="category-item-name">{category.name}</span>
                <span className="category-item-id">ID: {category.id}</span>
              </div>
              <div className="category-card-actions">
                <button onClick={() => handleOpenModal(category)} title="Editar"><FiEdit /></button>
                <button onClick={() => handleDelete(category.id)} title="Excluir"><FiTrash2 /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
      >
        <CategoryForm
          initialData={editingCategory}
          onCancel={() => setIsModalOpen(false)}
          onSuccess={handleSave}
        />
      </Modal>
    </div>
  );
}
