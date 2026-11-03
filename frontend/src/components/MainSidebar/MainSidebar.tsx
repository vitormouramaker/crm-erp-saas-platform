import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiSettings,
  FiLogOut,
  FiArchive,
  FiPieChart,
  FiDollarSign,
  FiUserCheck,
  FiMessageSquare,
  FiUsers,
  FiList,
  FiStar,
  FiFilter,
  FiClock,
  FiBookOpen,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiMoon,
  FiSun,
  FiTarget,
  FiUser,
  FiBell,
  FiCheck,
  FiFileText,
  FiShield,
} from "react-icons/fi";
import { FaMeta } from "react-icons/fa6";
import { useLayout } from "../../contexts/LayoutContext";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useNews } from "../../contexts/NewsContext";
import { SETTINGS_ACCESS_PERMISSIONS } from "../../config/settingsTabs";
import { Avatar } from "../common/Avatar/Avatar";
import "./MainSidebar.css";

type NavItemType =
  | "chats"
  | "contacts"
  | "settings"
  | "inventory"
  | "sales"
  | "dashboard"
  | "nps-report"
  | "users"
  | "financial"
  | "subscription"
  | "transactions"
  | "commercial"
  | "rh"
  | "meta-management"
  | "google-ads"
  | "profile"
  | "manual";


function LegalUserSubmenu({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      className="sidebar-user-legal"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "ArrowLeft") {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="sidebar-user-dropdown-action"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="sidebar-user-legal-submenu"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            setIsOpen(true);
            requestAnimationFrame(() => submenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
          }
        }}
      >
        <FiShield size={18} />
        <span>Termos e privacidade</span>
        <FiChevronRight size={16} className="sidebar-user-legal-chevron" />
      </button>
      {isOpen && (
        <div ref={submenuRef} id="sidebar-user-legal-submenu" className="sidebar-user-legal-submenu" role="menu" aria-label="Termos e privacidade">
          <button type="button" className="sidebar-user-dropdown-action" role="menuitem" onClick={() => onNavigate("/termos-de-uso")}>
            <FiFileText size={18} /><span>Termos de uso</span>
          </button>
          <button type="button" className="sidebar-user-dropdown-action" role="menuitem" onClick={() => onNavigate("/politica-de-privacidade")}>
            <FiShield size={18} /><span>Política de privacidade</span>
          </button>
          <button type="button" className="sidebar-user-dropdown-action" role="menuitem" onClick={() => onNavigate("/exclusao-de-conta")}>
            <FiUser size={18} /><span>Exclusão de conta</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function MainSidebar() {
  const { isMobileMenuOpen } = useLayout();
  const { logout, hasPermission, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    previewItems,
    unreadCount,
    isLoadingPreview,
    markAllAsRead,
    markAsRead,
    openHighlight,
    refreshPreview,
  } = useNews();
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const newsMenuRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(() => {
    return window.localStorage.getItem("orbita.sidebar.expanded") === "true";
  });
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNewsMenuOpen, setIsNewsMenuOpen] = useState(false);
  const [newsTab, setNewsTab] = useState<"unread" | "read">("unread");

  useEffect(() => {
    window.localStorage.setItem("orbita.sidebar.expanded", String(isExpanded));
  }, [isExpanded]);

  useEffect(() => {
    if (!isUserMenuOpen && !isNewsMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedUserMenu = userMenuRef.current?.contains(target);
      const clickedNewsMenu = newsMenuRef.current?.contains(target);

      if (!clickedUserMenu) {
        setIsUserMenuOpen(false);
      }

      if (!clickedNewsMenu) {
        setIsNewsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
        setIsNewsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNewsMenuOpen, isUserMenuOpen]);

  const iconSize = 20;

  let activeItem: NavItemType | "" = "";

  if (pathname === "/" || pathname.startsWith("/dashboard")) {
    activeItem = "dashboard";
  } else if (pathname.startsWith("/relatorios/nps")) {
    activeItem = "nps-report";
  } else if (pathname.startsWith("/chat")) {
    activeItem = "chats";
  } else if (pathname.startsWith("/usuarios")) {
    activeItem = "users";
  } else if (pathname.startsWith("/contatos")) {
    activeItem = "contacts";
  } else if (pathname.startsWith("/estoque")) {
    activeItem = "inventory";
  } else if (pathname.startsWith("/comercial")) {
    activeItem = "commercial";
  } else if (pathname.startsWith("/rh")) {
    activeItem = "rh";
  } else if (pathname.startsWith("/perfil")) {
    activeItem = "profile";
  } else if (pathname.startsWith("/settings")) {
    activeItem = "settings";
  } else if (pathname.startsWith("/meta-management")) {
    activeItem = "meta-management";
  } else if (pathname.startsWith("/google-ads")) {
    activeItem = "google-ads";
  } else if (pathname.startsWith("/transacoes")) {
    activeItem = "transactions";
  } else if (pathname.startsWith("/financeiro")) {
    activeItem = "financial";
  } else if (pathname.startsWith("/assinatura")) {
    activeItem = "subscription";
  } else if (pathname.startsWith("/manual")) {
    activeItem = "manual";
  }

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    setIsNewsMenuOpen(false);
    if (window.confirm("Você tem certeza que deseja sair?")) {
      logout();
    }
  };

  const navigateFromUserMenu = (path: string) => {
    setIsUserMenuOpen(false);
    setIsNewsMenuOpen(false);
    navigate(path);
  };

  const userName = user?.name || "Usuário";
  const userEmail = user?.email || "E-mail não informado";
  const userDescription = user?.is_master
    ? "Administrador"
    : user?.nome_plano || "Usuário da plataforma";
  const isUserMenuActive = activeItem === "profile" || activeItem === "settings" || activeItem === "manual";
  const canAccessSettings = SETTINGS_ACCESS_PERMISSIONS.some((permission) =>
    hasPermission(permission)
  );
  const latestUnreadCount = previewItems.filter((item) => !item.read).length;
  const unreadItems = previewItems.filter((item) => !item.read);
  const readItems = previewItems.filter((item) => item.read);
  const visibleNewsItems = newsTab === "unread" ? unreadItems : readItems;

  return (
    <nav
      className={`main-sidebar ${isExpanded ? "expanded" : "collapsed"} ${
        isUserMenuOpen ? "user-menu-open" : ""
      } ${
        isMobileMenuOpen ? "mobile-open" : ""
      }`}
    >
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <img
            src="/logo-icon.svg"
            alt="Logo da Empresa"
            className="sidebar-logo"
          />
          {isExpanded && <span className="sidebar-brand-name">Órbita</span>}
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsExpanded((current) => !current)}
            aria-label={isExpanded ? "Recolher menu" : "Expandir menu"}
            data-label={isExpanded ? "Recolher menu" : "Expandir menu"}
          >
            {isExpanded ? (
              <FiChevronLeft size={16} />
            ) : (
              <FiChevronRight size={16} />
            )}
          </button>
        </div>

        <ul className="nav-list">
          {hasPermission("dashboard.view") && (
            <li
              className={`nav-item ${activeItem === "dashboard" ? "active" : ""}`}
            >
              <Link to="/dashboard" aria-label="Dashboard" data-label="Dashboard">
                <FiPieChart size={iconSize} />
                <span className="nav-label">Dashboard</span>
              </Link>
            </li>
          )}

          {hasPermission("reports.nps.view") && (
            <li className={`nav-item ${activeItem === "nps-report" ? "active" : ""}`}>
              <Link to="/relatorios/nps" aria-label="Relatorio NPS" data-label="Relatorio NPS">
                <FiStar size={iconSize} />
                <span className="nav-label">Relatorio NPS</span>
              </Link>
            </li>
          )}

          {hasPermission("chat.view") && (
            <li className={`nav-item ${activeItem === "chats" ? "active" : ""}`}>
              <Link to="/chat" aria-label="Atendimentos" data-label="Atendimentos">
                <FiMessageSquare size={iconSize} />
                <span className="nav-label">Atendimentos</span>
              </Link>
            </li>
          )}

          {hasPermission("users.manage") && (
            <li
              className={`nav-item ${activeItem === "users" ? "active" : ""}`}
            >
              <Link to="/usuarios" aria-label="Gestão de Equipe" data-label="Gestão de Equipe">
                <FiUserCheck size={iconSize} />
                <span className="nav-label">Gestão de Equipe</span>
              </Link>
            </li>
          )}

          {hasPermission("contacts.view") && (
            <li className={`nav-item ${activeItem === "contacts" ? "active" : ""}`}>
              <Link to="/contatos" aria-label="Contatos" data-label="Contatos">
                <FiUsers size={iconSize} />
                <span className="nav-label">Contatos</span>
              </Link>
            </li>
          )}

          {hasPermission("stock.view") && (
            <li
              className={`nav-item ${activeItem === "inventory" ? "active" : ""}`}
            >
              <Link to="/estoque" aria-label="Estoque" data-label="Estoque">
                <FiArchive size={iconSize} />
                <span className="nav-label">Estoque</span>
              </Link>
            </li>
          )}

          {hasPermission("commercial.view") && (
            <li
              className={`nav-item ${
                activeItem === "commercial" ? "active" : ""
              }`}
            >
              <Link to="/comercial" aria-label="Funil" data-label="Funil">
                <FiFilter size={iconSize} />
                <span className="nav-label">Funil</span>
              </Link>
            </li>
          )}

          {hasPermission("rh.point.register") && (
            <li className={`nav-item ${activeItem === "rh" ? "active" : ""}`}>
              <Link to="/rh/ponto" aria-label="Módulo RH" data-label="Módulo RH">
                <FiClock size={iconSize} />
                <span className="nav-label">Recursos humanos</span>
              </Link>
            </li>
          )}

          {(hasPermission("meta.view") || hasPermission("meta_ads.view")) && (
            <li
              className={`nav-item ${
                activeItem === "meta-management" ? "active" : ""
              }`}
            >
              <Link to="/meta-management" aria-label="Gestão da Meta" data-label="Gestão da Meta">
                <FaMeta size={iconSize} />
                <span className="nav-label">Gestão da Meta</span>
              </Link>
            </li>
          )}

          {hasPermission("google_ads.view") && (
            <li
              className={`nav-item ${
                activeItem === "google-ads" ? "active" : ""
              }`}
            >
              <Link to="/google-ads" aria-label="Google Ads" data-label="Google Ads">
                <FiTarget size={iconSize} />
                <span className="nav-label">Google Ads</span>
              </Link>
            </li>
          )}

          {hasPermission("sales.view") && (
            <li
              className={`nav-item ${
                activeItem === "transactions" ? "active" : ""
              }`}
            >
              <Link to="/transacoes" aria-label="Transações PDV" data-label="Transações PDV">
                <FiList size={iconSize} />
                <span className="nav-label">Transações PDV</span>
              </Link>
            </li>
          )}

          {hasPermission("financial.manage") && (
            <li
              className={`nav-item ${
                activeItem === "financial" ? "active" : ""
              }`}
            >
              <Link to="/financeiro" aria-label="Financeiro" data-label="Financeiro">
                <FiDollarSign size={iconSize} />
                <span className="nav-label">Financeiro</span>
              </Link>
            </li>
          )}

          {hasPermission("subscription.manage") && (
            <li
              className={`nav-item highlight-plan ${
                activeItem === "subscription" ? "active" : ""
              }`}
            >
              <Link to="/assinatura" aria-label="Planos e Suporte" data-label="Planos e Suporte">
                <FiStar size={iconSize} />
                <span className="nav-label">Planos e Suporte</span>
              </Link>
            </li>
          )}
        </ul>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-notification-wrapper" ref={newsMenuRef}>
          <div className={`nav-item nav-item--notification ${isNewsMenuOpen ? "active" : ""}`}>
            <button
              type="button"
              className="sidebar-notification-trigger"
              onClick={() => {
                setIsUserMenuOpen(false);
                setIsNewsMenuOpen((current) => {
                  const next = !current;
                  if (!current) {
                    setNewsTab(unreadCount > 0 ? "unread" : "read");
                    void refreshPreview({ silent: true });
                  }
                  return next;
                });
              }}
              aria-label="Abrir notificações"
              aria-haspopup="dialog"
              aria-expanded={isNewsMenuOpen}
              data-label="Notificações"
            >
              <span className="sidebar-notification-trigger__icon" aria-hidden="true">
                <FiBell size={iconSize} />
              </span>
              <span className="nav-label">Notificações</span>
              {unreadCount > 0 ? (
                <span className="sidebar-notification-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>
          </div>

          {isNewsMenuOpen && (
            <div className="sidebar-news-dropdown" role="dialog" aria-label="Novidades do sistema">
              <div className="sidebar-news-dropdown__header">
                <div>
                  <strong>Notificações</strong>
                  <small>
                    {unreadCount > 0
                      ? `${unreadCount} não lida(s) no total`
                      : "Você está em dia com as atualizações"}
                  </small>
                </div>

                <div className="sidebar-news-dropdown__header-actions">
                  {unreadCount > 0 ? (
                    <button
                      type="button"
                      className="sidebar-news-dropdown__mark-all"
                      onClick={() => {
                        void markAllAsRead().catch(() => undefined);
                      }}
                    >
                      <FiCheck size={14} />
                      <span>Marcar tudo</span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="sidebar-news-dropdown__tabs" role="tablist" aria-label="Filtro de notificações">
                <button
                  type="button"
                  className={`sidebar-news-dropdown__tab ${newsTab === "unread" ? "is-active" : ""}`}
                  onClick={() => setNewsTab("unread")}
                  role="tab"
                  aria-selected={newsTab === "unread"}
                >
                  <span>Não lidas</span>
                  <strong>{unreadItems.length}</strong>
                </button>
                <button
                  type="button"
                  className={`sidebar-news-dropdown__tab ${newsTab === "read" ? "is-active" : ""}`}
                  onClick={() => setNewsTab("read")}
                  role="tab"
                  aria-selected={newsTab === "read"}
                >
                  <span>Lidas</span>
                  <strong>{readItems.length}</strong>
                </button>
              </div>

              <div className="sidebar-news-dropdown__body">
                {isLoadingPreview ? (
                  <p className="sidebar-news-preview__empty">Carregando notificações...</p>
                ) : previewItems.length === 0 ? (
                  <p className="sidebar-news-preview__empty">Nenhuma notificação publicada ainda.</p>
                ) : visibleNewsItems.length === 0 ? (
                  <p className="sidebar-news-preview__empty">
                    {newsTab === "unread"
                      ? "Nenhuma notificação não lida nesta lista."
                      : "Nenhuma notificação lida nesta lista."}
                  </p>
                ) : (
                  <div className="sidebar-news-preview__list">
                    {visibleNewsItems.map((item) => (
                      <button
                        key={`sidebar-news-${item.id}`}
                        type="button"
                        className={`sidebar-news-preview__item ${item.read ? "is-read" : "is-unread"}`}
                        onClick={() => {
                          if (!item.read) {
                            void markAsRead(item.id).catch(() => undefined);
                          }
                          setIsNewsMenuOpen(false);
                          openHighlight(item);
                        }}
                      >
                        <div className="sidebar-news-preview__item-top">
                          <strong>{item.title}</strong>
                          <div className="sidebar-news-preview__item-badges">
                            {item.onlyMaster ? <span className="is-master">Master</span> : null}
                            {!item.read ? <span>Nova</span> : null}
                          </div>
                        </div>
                        <p>{item.summary || item.content.slice(0, 104)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {previewItems.length > 0 ? (
                <div className="sidebar-news-dropdown__footer">
                  <span>
                    {newsTab === "unread"
                      ? latestUnreadCount > 0
                        ? `${latestUnreadCount} não lida(s) nesta lista`
                        : "Todas as desta lista ja foram lidas"
                      : `${readItems.length} lida(s) nesta lista`}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div ref={userMenuRef}>
        <div className={`sidebar-user-menu-wrapper ${isUserMenuOpen ? "open" : ""}`}>
          <div
            className={`nav-item nav-item--profile ${
              isUserMenuActive ? "active" : ""
            }`}
          >
            <button
              type="button"
              className="sidebar-user-trigger"
              onClick={() => setIsUserMenuOpen((current) => !current)}
              aria-label="Abrir menu do usuário"
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              data-label="Menu do usuário"
            >
              {user?.foto_perfil_url ? (
                <Avatar
                  name={userName}
                  imageUrl={user?.foto_perfil_url}
                  size="xsmall"
                  className="sidebar-profile-avatar"
                />
              ) : (
                <FiUser size={iconSize} />
              )}
              <span className="nav-label">{userName}</span>
              {isExpanded && (
                <FiChevronDown
                  size={14}
                  className={`sidebar-user-chevron ${isUserMenuOpen ? "open" : ""}`}
                />
              )}
            </button>
          </div>

          {isUserMenuOpen && (
            <div className="sidebar-user-dropdown" role="menu">
              <div className="sidebar-user-dropdown-header">
                <Avatar
                  name={userName}
                  imageUrl={user?.foto_perfil_url}
                  size="small"
                  className="sidebar-user-dropdown-avatar"
                />
                <div className="sidebar-user-dropdown-identity">
                  <strong>{userName}</strong>
                  <span>{userDescription}</span>
                  <small>{userEmail}</small>
                </div>
              </div>

              <div className="sidebar-user-dropdown-section">
                <button
                  type="button"
                  className="sidebar-user-dropdown-action"
                  onClick={() => navigateFromUserMenu("/perfil")}
                  role="menuitem"
                >
                  <FiUser size={18} />
                  <span>Visualizar perfil</span>
                </button>

                {canAccessSettings && (
                  <button
                    type="button"
                    className="sidebar-user-dropdown-action"
                    onClick={() => navigateFromUserMenu("/settings")}
                    role="menuitem"
                  >
                    <FiSettings size={18} />
                    <span>Configurações da conta</span>
                  </button>
                )}

                <button
                  type="button"
                  className="sidebar-user-dropdown-action sidebar-user-dropdown-action--theme"
                  onClick={toggleTheme}
                  role="menuitem"
                >
                  {theme === "dark" ? <FiSun size={18} /> : <FiMoon size={18} />}
                  <span>
                    <strong>{theme === "dark" ? "Tema claro" : "Tema escuro"}</strong>
                    <small>Alternar entre claro e escuro</small>
                  </span>
                  <span
                    className={`sidebar-user-theme-switch ${
                      theme === "dark" ? "is-dark" : "is-light"
                    }`}
                    aria-hidden="true"
                  >
                    <span className="sidebar-user-theme-switch-icon sidebar-user-theme-switch-icon--sun">
                      <FiSun size={12} />
                    </span>
                    <span className="sidebar-user-theme-switch-icon sidebar-user-theme-switch-icon--moon">
                      <FiMoon size={12} />
                    </span>
                    <span className="sidebar-user-theme-switch-thumb">
                      {theme === "dark" ? <FiMoon size={12} /> : <FiSun size={12} />}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className="sidebar-user-dropdown-action"
                  onClick={() => navigateFromUserMenu("/manual")}
                  role="menuitem"
                >
                  <FiBookOpen size={18} />
                  <span>Manual</span>
                </button>

                <LegalUserSubmenu onNavigate={navigateFromUserMenu} />
              </div>

              <div className="sidebar-user-dropdown-section">
                <button
                  type="button"
                  className="sidebar-user-dropdown-action sidebar-user-dropdown-action--logout"
                  onClick={handleLogout}
                  role="menuitem"
                >
                  <FiLogOut size={18} />
                  <span>Sair da conta</span>
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </nav>
  );
}
