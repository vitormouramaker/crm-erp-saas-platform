import React, { createContext, useContext, useRef, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';

interface ShortcutRefs {
  messageInputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  tagInputRef: React.RefObject<HTMLInputElement | null>;
  noteEditorRef: React.RefObject<Editor | null>;
}

const ShortcutsContext = createContext<ShortcutRefs | undefined>(undefined);

// O Provider que irá gerenciar as refs e o listener
export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const messageInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const noteEditorRef = useRef<Editor | null>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.altKey) {
      switch (event.key.toLowerCase()) {
        case 'm':
          event.preventDefault();
          messageInputRef.current?.focus();
          break;
        case 'n':
          event.preventDefault();
          noteEditorRef.current?.commands.focus();
          break;
        case 't':
          event.preventDefault();
          tagInputRef.current?.focus();
          break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
  
  const value = { messageInputRef, tagInputRef, noteEditorRef };

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
    </ShortcutsContext.Provider>
  );
}

// Hook customizado para consumir o contexto
export function useShortcuts() {
  const context = useContext(ShortcutsContext);
  if (!context) {
    throw new Error('useShortcuts deve ser usado dentro de um ShortcutsProvider');
  }
  return context;
}
