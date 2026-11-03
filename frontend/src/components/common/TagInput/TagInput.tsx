import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import './TagInput.css';

interface TagInputProps {
  tags: string[];
  setTags: (tags: string[]) => void;
  placeholder?: string;
}

export const TagInput = React.forwardRef<HTMLInputElement, TagInputProps>(
  ({ tags, setTags, placeholder }, ref) => {
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inputValue.trim() !== '') {
        e.preventDefault();
        const newTag = inputValue.trim().replace(/\s+/g, '_').toLowerCase();
        if (!tags.includes(newTag)) {
          setTags([...tags, newTag]);
        }
        setInputValue('');
      } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
        const newTags = tags.slice(0, -1);
        setTags(newTags);
      }
    };

    const removeTag = (tagToRemove: string) => {
      const newTags = tags.filter(tag => tag !== tagToRemove);
      setTags(newTags);
    };

    return (
      <div className="tag-input-container">
        {tags.map((tag, index) => (
          <div key={index} className="tag-pill">
            {tag}
            <button type="button" onClick={() => removeTag(tag)}>
              <FiX size={14} />
            </button>
          </div>
        ))}
        <input
          ref={ref}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Adicione tags...'}
          className="tag-input-field"
        />
      </div>
    );
  }
);