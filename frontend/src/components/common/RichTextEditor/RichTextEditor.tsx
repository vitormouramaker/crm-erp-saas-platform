import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { FiBold, FiItalic, FiUnderline, FiLink } from 'react-icons/fi';
import './RichTextEditor.css';
import { useCallback, useEffect } from 'react';
import { useShortcuts } from '../../../contexts/ShortcutsContext';

const Toolbar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const applyFormatAndDeselect = (format: 'bold' | 'italic' | 'underline') => {
    editor.chain().focus().toggleMark(format).run();

    if (!editor.state.selection.empty) {
      editor.chain().focus().unsetAllMarks().run();
    }
  };

  return (
    <div className="toolbar">
      <button
        onClick={() => applyFormatAndDeselect('bold')}
        className={editor.isActive('bold') ? 'is-active' : ''}
        title="Negrito"
      >
        <FiBold />
      </button>
      <button
        onClick={() => applyFormatAndDeselect('italic')}
        className={editor.isActive('italic') ? 'is-active' : ''}
        title="Itálico"
      >
        <FiItalic />
      </button>
      <button
        onClick={() => applyFormatAndDeselect('underline')}
        className={editor.isActive('underline') ? 'is-active' : ''}
        title="Sublinhado"
      >
        <FiUnderline />
      </button>
      <button 
        onClick={editor.isActive('link') ? () => editor.chain().focus().unsetLink().run() : setLink} 
        className={editor.isActive('link') ? 'is-active' : ''}
        title={editor.isActive('link') ? 'Remover Link' : 'Adicionar Link'}
      >
        <FiLink />
      </button>
    </div>
  );
};

interface RichTextEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const { noteEditorRef } = useShortcuts();
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        strike: false,
        bulletList: false,
        orderedList: false,
        underline: false,
        link: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: content, 
    onUpdate({ editor }) {
      onChange(editor.isEmpty ? '' : editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        'data-placeholder': placeholder || 'Digite algo...',
      },
    },
  });

  useEffect(() => {
    if (editor) {
      noteEditorRef.current = editor;
    }
    return () => {
      noteEditorRef.current = null;
    }
  }, [editor, noteEditorRef]);

  useEffect(() => {
    if (editor) {
      const isSame = editor.getHTML() === content;
      if (!isSame) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }
  }, [content, editor]);

  return (
    <div className="editor-container">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
