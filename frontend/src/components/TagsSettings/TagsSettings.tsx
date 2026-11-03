import { useState, useEffect } from 'react';
import type { Tag, TagCreationData } from '../../contexts/TagsContext';
import { FiEdit, FiTrash2, FiPlus } from 'react-icons/fi';
import { Modal } from '../common/Modal/Modal';
import { TagForm } from '../TagForm/TagForm';
import { encrypt, decrypt } from '../../utils/cripto';
import { API_BASE } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import './TagsSettings.css';

export function TagsSettings() {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [tagToDeleteId, setTagToDeleteId] = useState<number | null>(null);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        if (!user?.empresa_id) {
          setTags([]);
          return;
        }

        const encrypted = await encrypt({ empresa_id: user.empresa_id });
        const response = await fetch(`${API_BASE}/user/lista_tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: encrypted }),
        });
        const respData = await response.json();
        const resp = await decrypt(respData.payload) as { boleano: boolean; obj: Tag[]; msg?: string };
        if (resp?.boleano) {
          setTags(resp.obj);
        } else {
          console.error('Erro ao carregar tags:', resp?.msg);
        }
      } catch (err) {
        console.error('Erro na requisicao de tags:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, [user?.empresa_id]);

  const handleOpenCreateModal = () => {
    setEditingTag(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setIsFormModalOpen(true);
  };

  const handleSaveTag = async (tagData: Tag | TagCreationData) => {
    try {
      if ('id' in tagData) {
        const payload = await encrypt({ tag_id: tagData.id, nome: tagData.name });
        const response = await fetch(`${API_BASE}/user/alterar_tag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        });

        const respData = await response.json();
        const resp = await decrypt(respData.payload) as { boleano: boolean; msg: string };

        if (resp?.boleano) {
          setTags(prev => prev.map(tag => (tag.id === tagData.id ? { ...tag, name: tagData.name } : tag)));
        } else {
          console.error('Erro ao alterar tag:', resp?.msg);
        }
      } else {
        if (!user?.empresa_id) throw new Error("Usuario nao encontrado");

        const payload = await encrypt({ nome: tagData.name, empresa_id: user.empresa_id });
        const response = await fetch(`${API_BASE}/user/criar_tag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        });

        const respData = await response.json();
        const resp = await decrypt(respData.payload) as { boleano: boolean; obj?: Tag; msg?: string };

        if (resp?.boleano && resp.obj) {
          setTags(prev => [...prev, resp.obj!]);
        } else {
          console.error('Erro ao criar tag:', resp?.msg);
        }
      }
    } catch (err) {
      console.error('Erro na requisicao:', err);
    } finally {
      setIsFormModalOpen(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (tagToDeleteId === null) return;

    try {
      const payload = await encrypt({ tag_id: tagToDeleteId });
      const response = await fetch(`${API_BASE}/user/deletar_tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      const respData = await response.json();
      const resp = await decrypt(respData.payload) as { boleano: boolean; msg?: string };

      if (resp?.boleano) {
        setTags(prevTags => prevTags.filter(tag => tag.id !== tagToDeleteId));
      } else {
        console.error('Erro ao deletar tag:', resp?.msg);
      }
    } catch (err) {
      console.error('Erro na requisicao de remocao:', err);
    } finally {
      setIsConfirmModalOpen(false);
      setTagToDeleteId(null);
    }
  };

  const handleCancelDelete = () => {
    setIsConfirmModalOpen(false);
    setTagToDeleteId(null);
  };

  return (
    <div className="tags-settings-container">
      <div className="page-actions">
        <h2>Gerenciar Tags</h2>
        <button className="add-button" onClick={handleOpenCreateModal}>
          <FiPlus /> Nova Tag
        </button>
      </div>

      {loading ? (
        <p>Carregando tags...</p>
      ) : (
        <div className="tags-list-settings">
          {tags.map(tag => (
            <div key={tag.id} className="tag-card">
              <span className="tag-item-setting">{tag.name}</span>
              <div className="tag-card-actions">
                <button title="Renomear" onClick={() => handleOpenEditModal(tag)}><FiEdit /></button>
                <button title="Excluir" onClick={() => {
                  setTagToDeleteId(tag.id);
                  setIsConfirmModalOpen(true);
                }}><FiTrash2 /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingTag ? 'Renomear Tag' : 'Criar Nova Tag'}
      >
        <TagForm
          onSave={handleSaveTag}
          onCancel={() => setIsFormModalOpen(false)}
          initialData={editingTag}
        />
      </Modal>

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={handleCancelDelete}
        title="Confirmar Exclusao"
      >
        <div className="confirm-modal-content">
          <p>Voce tem certeza que deseja excluir esta tag? Ela sera removida de todas as conversas associadas.</p>
          <div className="confirm-modal-actions">
            <button className="cancel-button" onClick={handleCancelDelete}>Cancelar</button>
            <button className="delete-button" onClick={handleConfirmDelete}>Sim, Excluir</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
