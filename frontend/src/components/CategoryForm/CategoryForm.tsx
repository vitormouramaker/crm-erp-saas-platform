import { useState, useEffect } from 'react';
import { Input } from '../common/Input/Input';
import type { Category } from '../../data/mockData';
import './CategoryForm.css';
import { API_BASE } from '../../config/api';
import { encrypt, decrypt } from '../../utils/cripto';
import { useAuth } from '../../contexts/AuthContext';

interface CategoryFormProps {
  onCancel: () => void;
  initialData?: Category | null;
  onSuccess?: () => void;
}

export function CategoryForm({ onCancel, initialData, onSuccess }: CategoryFormProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(initialData?.name || '');
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      if (!user?.empresa_id) {
        alert('Usuario nao encontrado na sessao');
        return;
      }

      const payloadData = {
        name,
        empresa_id: user.empresa_id,
        ...(initialData ? { id: initialData.id } : {}),
      };

      const encrypted = await encrypt(payloadData);

      const response = await fetch(
        `${API_BASE}/user/${initialData ? 'editar_categoria' : 'cadastro_categoria'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ payload: encrypted }),
        }
      );

      const respData = await response.json();
      const resp = await decrypt(respData.payload);

      if (!resp?.boleano) {
        console.error('Erro ao salvar categoria:', resp?.mensagem);
        alert(resp?.mensagem || 'Erro ao salvar categoria');
      } else {
        alert(initialData ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!');
        if (onSuccess) onSuccess();
        onCancel();
      }
    } catch (error) {
      console.error(error);
      alert('Erro de comunicacao com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="category-form">
      <Input
        label="Nome da Categoria"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      <div className="form-actions">
        <button type="button" className="cancel-button" onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button type="submit" className="save-button" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
