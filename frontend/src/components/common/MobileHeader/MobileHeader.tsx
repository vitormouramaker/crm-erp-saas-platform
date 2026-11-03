import { FiMenu } from 'react-icons/fi';
import { useLayout } from '../../../contexts/LayoutContext';
import './MobileHeader.css';

interface MobileHeaderProps {
  title: string;
}

export function MobileHeader({ title }: MobileHeaderProps) {
  const { toggleMobileMenu } = useLayout();

  return (
    <header className="mobile-header">
      <button onClick={toggleMobileMenu} className="hamburger-button">
        <FiMenu size={24} />
      </button>
      <h1 className="mobile-header-title">{title}</h1>
    </header>
  );
}