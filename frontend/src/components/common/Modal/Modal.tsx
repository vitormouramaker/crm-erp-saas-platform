import React from 'react';
import { FiX } from 'react-icons/fi';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'default' | 'sm' | 'lg'; // NOVO: Prop para o tamanho
  stackLevel?: number;
  overlayClassName?: string;
}

export function Modal({ isOpen, onClose, title, children, size = 'default', stackLevel = 0, overlayClassName = '' }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  const modalBaseZIndex = 1300;

  // NOVO: Define a classe do modal com base no tamanho
  const modalClass = `modal-content ${size === 'sm' ? 'modal-sm' : size === 'lg' ? 'modal-lg' : ''}`;

  return (
    <div className={`modal-overlay ${overlayClassName}`} style={{ zIndex: modalBaseZIndex + stackLevel }} onClick={onClose}>
      <div className={modalClass} onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="close-button" onClick={onClose}>
            <FiX size={24} />
          </button>
        </header>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
