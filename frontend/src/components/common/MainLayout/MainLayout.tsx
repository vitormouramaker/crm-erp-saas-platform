import React from 'react';
import { MainSidebar } from '../../MainSidebar/MainSidebar';
import { LayoutProvider, useLayout } from '../../../contexts/LayoutContext';
import { useSubscriptionAccess } from '../../../contexts/SubscriptionAccessContext';
import { useNavigate } from 'react-router-dom';
import './MainLayout.css';

// A lógica de atalhos (useEffect) foi removida daqui e movida para o ShortcutsContext
function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const { isMobileMenuOpen, toggleMobileMenu } = useLayout();
  const navigate = useNavigate();
  const {
    bannerDescription,
    bannerTitle,
    dismissSessionModal,
    isActionRequired,
    isLimitedMode,
    regularizePath,
    sessionModalOpen,
    status,
  } = useSubscriptionAccess();

  return (
    <div className="main-layout">
      {isMobileMenuOpen && <div className="mobile-menu-overlay" onClick={toggleMobileMenu}></div>}
      <MainSidebar />
      <main className="main-content">
        {isActionRequired ? (
          <div
            className={`subscription-access-banner subscription-access-banner--${status}`}
            role="status"
            aria-live="polite"
          >
            <div className="subscription-access-banner__content">
              <strong>{bannerTitle}</strong>
              <span>{bannerDescription}</span>
            </div>
            <div className="subscription-access-banner__actions subscription-access-allow-interaction">
              <button
                type="button"
                className="subscription-access-banner__button"
                onClick={() => navigate(regularizePath)}
              >
                Regularizar assinatura
              </button>
              {isLimitedMode ? (
                <span className="subscription-access-banner__pill">Acesso limitado</span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="main-content__body">{children}</div>

        {sessionModalOpen ? (
          <div className="subscription-access-modal" role="dialog" aria-modal="true">
            <div className="subscription-access-modal__card subscription-access-allow-interaction">
              <div className="subscription-access-modal__header">
                <div>
                  <p className="subscription-access-modal__eyebrow">Assinatura</p>
                  <h3>{bannerTitle}</h3>
                </div>
                <button
                  type="button"
                  className="subscription-access-modal__close"
                  onClick={dismissSessionModal}
                  aria-label="Fechar aviso"
                >
                  ×
                </button>
              </div>
              <p className="subscription-access-modal__description">{bannerDescription}</p>
              <div className="subscription-access-modal__actions">
                <button
                  type="button"
                  className="subscription-access-modal__secondary"
                  onClick={dismissSessionModal}
                >
                  Continuar em consulta
                </button>
                <button
                  type="button"
                  className="subscription-access-modal__primary"
                  onClick={() => {
                    dismissSessionModal();
                    navigate(regularizePath);
                  }}
                >
                  Regularizar assinatura
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <LayoutProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </LayoutProvider>
  );
}
