import { createContext, useState, useContext } from 'react';
import type { ReactNode } from 'react';

interface LayoutContextType {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  return (
    <LayoutContext.Provider value={{ isMobileMenuOpen, toggleMobileMenu }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout deve ser usado dentro de um LayoutProvider');
  }
  return context;
}