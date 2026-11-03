import React from 'react';
import './BottomSheet.css';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ isOpen, onClose, children }: BottomSheetProps) {
  return (
    <div className={`bottom-sheet-container ${isOpen ? 'open' : ''}`}>
      <div className="bottom-sheet-overlay" onClick={onClose}></div>
      <div className="bottom-sheet-content">
        {children}
      </div>
    </div>
  );
}