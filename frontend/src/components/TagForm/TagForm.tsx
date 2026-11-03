import { useState, useEffect } from 'react';
import type { Tag, TagCreationData } from '../../contexts/TagsContext';
import { Input } from '../common/Input/Input';
import './TagForm.css';

interface TagFormProps {
  onSave: (tagData: Tag | TagCreationData) => void;
  onCancel: () => void;
  initialData?: Tag | null;
}

export function TagForm({ onSave, onCancel, initialData }: TagFormProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
    } else {
      setName('');
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tagData = {
      name: name.replace(/\s+/g, '_').toLowerCase(),
    };
    onSave(initialData ? { ...tagData, id: initialData.id } : tagData);
  };

  return (
    <form onSubmit={handleSubmit} className="tag-form">
      <Input
        label="Nome da Tag (sem espaços)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ex: cliente_vip"
        required
      />
      <div className="form-actions">
        <button type="button" className="cancel-button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="save-button">
          Salvar Tag
        </button>
      </div>
    </form>
  );
}