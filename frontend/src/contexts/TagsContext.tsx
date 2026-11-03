import { createContext, useState, useContext } from 'react';
// CORREÇÃO APLICADA AQUI: 'ReactNode' foi movido para uma importação de tipo.
import type { ReactNode } from 'react';

export interface Tag {
  id: number;
  name: string;
}

// Para criar uma nova tag, não precisamos do ID
export type TagCreationData = Omit<Tag, 'id'>;

const initialTags: Tag[] = [
  { id: 1, name: 'cliente_vip' },
  { id: 2, name: 'fatura_pendente' },
  { id: 3, name: 'problema_entrega' },
  { id: 4, name: 'logistica' },
  { id: 5, name: 'suporte_tecnico' },
];

interface TagsContextType {
  tags: Tag[];
  addTag: (tagData: TagCreationData) => void;
  updateTag: (updatedTag: Tag) => void;
  deleteTag: (tagId: number) => void;
}

const TagsContext = createContext<TagsContextType | undefined>(undefined);

export function TagsProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<Tag[]>(initialTags);

  const addTag = (tagData: TagCreationData) => {
    const newTag = { ...tagData, name: tagData.name.trim(), id: Date.now() };
    // Evita adicionar tags duplicadas (ignorando maiúsculas/minúsculas)
    if (!tags.some(tag => tag.name.toLowerCase() === newTag.name.toLowerCase())) {
      setTags(prevTags => [...prevTags, newTag]);
    }
  };

  const updateTag = (updatedTag: Tag) => {
    setTags(prevTags =>
      prevTags.map(tag =>
        tag.id === updatedTag.id ? { ...updatedTag, name: updatedTag.name.trim() } : tag
      )
    );
  };

  const deleteTag = (tagId: number) => {
    setTags(prevTags =>
      prevTags.filter(tag => tag.id !== tagId)
    );
  };

  return (
    <TagsContext.Provider value={{ tags, addTag, updateTag, deleteTag }}>
      {children}
    </TagsContext.Provider>
  );
}

export function useTags() {
  const context = useContext(TagsContext);
  if (context === undefined) {
    throw new Error('useTags deve ser usado dentro de um TagsProvider');
  }
  return context;
}