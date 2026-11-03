import { AccountDeletionPage } from "./pages/AccountDeletionPage/AccountDeletionPage";
﻿import React, { Suspense, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Tooltip } from "react-tooltip";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { SleeknoteMaintenance } from "./pages/SleeknoteMaintenance/SleeknoteMaintenance.tsx";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage/ResetPasswordPage";
import { OnboardingPage } from "./pages/OnboardingPage/OnboardingPage";
import { DashboardPage } from "./pages/DashboardPage/DashboardPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/common/ProtectedRoute/ProtectedRoute";
import { MainLayout } from "./components/common/MainLayout/MainLayout";
import { CommandsProvider } from "./contexts/CommandsContext";
import { TagsProvider } from "./contexts/TagsContext";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GlobalChatToastNotifications } from "./components/GlobalChatToastNotifications/GlobalChatToastNotifications";
import { NewsProvider } from "./contexts/NewsContext";
import { SubscriptionAccessProvider } from "./contexts/SubscriptionAccessContext";
import { InventoryPage } from "./pages/InventoryPage/InventoryPage";
import { UsersPage } from "./pages/UsersPage/UsersPage";
import { TransactionsPage } from "./pages/TransactionsPage/TransactionsPage";
// import { SalesPage } from "./pages/SalesPage/SalesPage";
import { ContactsPage } from "./pages/ContactsPage/ContactsPage";
import { ChatPage } from "./pages/ChatPage/ChatPage";
import { SubscriptionPage } from "./pages/SubscriptionPage/SubscriptionPage";
import { PaymentHistoryPage } from "./pages/PaymentHistoryPage/PaymentHistoryPage";
import { CommercialApiPage } from "./pages/CommercialApiPage/CommercialApiPage";
import { getDefaultRouteForUser } from "./utils/getDefaultRoute";
import { FinancialPage } from "./pages/FinancialPage/FinancialPage";
import { RhPage } from "./pages/rh/RhPage";
import { RhAdminPage } from "./pages/rh/RhAdminPage";
import { Funcionarios } from "./pages/rh/Funcionarios";
import { Feriados } from "./pages/rh/Feriados";
import { Ferias } from "./pages/rh/Ferias";
import { HorariosTrabalho } from "./pages/rh/HorariosTrabalho";
import { RelatorioPonto } from "./pages/rh/RelatorioPonto";
import { ValidarDayOff } from "./pages/rh/ValidarDayOff";
import { GoogleAdsPage } from "./pages/GoogleAdsPage/GoogleAdsPage";
import { GoogleAdsOAuthCallbackPage } from "./pages/GoogleAdsOAuthCallbackPage/GoogleAdsOAuthCallbackPage";
import { NpsReportPage } from "./pages/NpsReportPage/NpsReportPage";
import { NpsPage } from "./pages/NpsPage/NpsPage";
import { ManualPage } from "./pages/ManualPage/ManualPage";
import { ManualAdminPage } from "./pages/ManualAdminPage/ManualAdminPage";
import { SETTINGS_ACCESS_PERMISSIONS } from "./config/settingsTabs";
import { useSubscriptionAccess } from "./contexts/SubscriptionAccessContext";
import { API_BASE } from "./config/api";
import { decrypt, encrypt } from "./utils/cripto";
import { Modal } from "./components/common/Modal/Modal";
import { TermsPage } from "./pages/TermsPage/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage/PrivacyPage";

const DATA_REQUEST_OPTIONS = [
  { key: "contatos", label: "Contatos" },
  { key: "vendas", label: "Vendas" },
  { key: "funis", label: "Funis e pipeline" },
  { key: "produtos", label: "Produtos" },
  { key: "mensagens", label: "Mensagens e atendimentos" },
  { key: "usuarios", label: "Usuarios e permissoes" },
  { key: "assinatura", label: "Assinatura, faturas e cobrancas" },
  { key: "outros", label: "Outros dados pertinentes ao sistema" },
] as const;

const SettingsPage = React.lazy(() =>
  import("./pages/SettingsPage/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const MetaManagementPage = React.lazy(() =>
  import("./pages/MetaManagementPage/MetaManagementPage").then((module) => ({
    default: module.MetaManagementPage,
  })),
);
const ProfilePage = React.lazy(() =>
  import("./pages/ProfilePage/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);
function RouteLoader() {
  return <div className="app-route-loader">Carregando...</div>;
}



// --- NOVO COMPONENTE DE PROTEÃ‡ÃƒO POR PERMISSÃƒO ---
function PermissionRoute({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission: string;
}) {
  const { hasPermission } = useAuth();

  // Se não tiver a permissão específica, redireciona para o dashboard (ou rota segura)
  if (!hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function AnyPermissionRoute({
  children,
  permissions,
}: {
  children: React.ReactNode;
  permissions: string[];
}) {
  const { hasPermission } = useAuth();

  if (!permissions.some((permission) => hasPermission(permission))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function SubscriptionBlockedState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isRequestingData, setIsRequestingData] = useState(false);
  const [isDataRequestModalOpen, setIsDataRequestModalOpen] = useState(false);
  const [selectedDataRequestOptions, setSelectedDataRequestOptions] = useState<string[]>([
    "contatos",
    "vendas",
    "funis",
    "produtos",
  ]);
  const [dataRequestNotes, setDataRequestNotes] = useState("");

  const closeDataRequestModal = () => {
    if (isRequestingData) return;
    setIsDataRequestModalOpen(false);
  };

  const toggleDataRequestOption = (key: string) => {
    setSelectedDataRequestOptions((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  const handleRequestData = async () => {
    if (!user?.id || !user?.empresa_id) {
      window.alert("Nao foi possivel identificar o usuario para solicitar os dados.");
      return;
    }

    if (selectedDataRequestOptions.length === 0) {
      window.alert("Selecione pelo menos um tipo de dado para solicitar.");
      return;
    }

    try {
      setIsRequestingData(true);
      const selectedLabels = DATA_REQUEST_OPTIONS.filter((option) =>
        selectedDataRequestOptions.includes(option.key)
      ).map((option) => option.label);
      const payload = await encrypt({
        usuario_id: user.id,
        empresa_id: user.empresa_id,
        tipo: "data_request",
        assunto: "Solicitacao de dados do titular",
        mensagem:
          `Solicito o envio dos dados vinculados ao meu acesso na plataforma.\n` +
          `Categorias solicitadas: ${selectedLabels.join(", ")}\n` +
          `Data da solicitacao: ${new Date().toLocaleString("pt-BR")}\n` +
          `Usuario: ${user.name || "Usuario"}\n` +
          `Email: ${user.email || "-"}\n` +
          `Telefone: ${user.telefone || "-"}\n` +
          `Observacoes: ${dataRequestNotes.trim() || "-"}`,
        email_usuario: user.email,
        dados_formulario: {
          categorias: selectedLabels,
          observacoes: dataRequestNotes.trim(),
        },
      });

      const response = await fetch(`${API_BASE}/web/enviar_feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });

      const responseData = await response.json();
      const decoded = responseData?.payload
        ? ((await decrypt(responseData.payload)) as
            | { boleano?: boolean; mensagem?: string }
            | null)
        : null;

      if (response.ok && decoded?.boleano) {
        setIsDataRequestModalOpen(false);
        setDataRequestNotes("");
        window.alert(
          decoded?.mensagem ||
            "Solicitacao enviada com sucesso para o provedor dos dados."
        );
        return;
      }

      window.alert(decoded?.mensagem || "Nao foi possivel enviar a solicitacao de dados.");
    } catch (error) {
      console.error("[subscription-blocked-state] falha ao solicitar dados:", error);
      window.alert("Erro ao enviar a solicitacao de dados.");
    } finally {
      setIsRequestingData(false);
    }
  };

  return (
    <section className="subscription-feature-block">
      <div className="subscription-feature-block__card">
        <p className="subscription-feature-block__eyebrow">Assinatura vencida</p>
        <h1 className="subscription-feature-block__title">{title}</h1>
        <p className="subscription-feature-block__description">{description}</p>
        <ul className="subscription-feature-block__list">
          <li>A area de cobranca e assinatura continua liberada para regularizacao.</li>
          <li>O manual e o perfil permanecem acessiveis durante o bloqueio.</li>
          <li>Assim que a validade for regularizada, o acesso operacional volta automaticamente.</li>
        </ul>
        <div className="subscription-feature-block__actions">
          <button
            type="button"
            className="subscription-feature-block__primary"
            onClick={() => navigate("/assinatura?view=regularizar")}
          >
            Regularizar assinatura
          </button>
          <button
            type="button"
            className="subscription-feature-block__secondary"
            onClick={() => setIsDataRequestModalOpen(true)}
          >
            Solicitar meus dados
          </button>
          <button
            type="button"
            className="subscription-feature-block__secondary"
            onClick={() => navigate("/manual")}
          >
            Abrir manual
          </button>
        </div>
      </div>
      <Modal
        isOpen={isDataRequestModalOpen}
        onClose={closeDataRequestModal}
        title="Solicitar dados ao provedor"
        size="lg"
      >
        <div className="subscription-data-request">
          <p className="subscription-data-request__description">
            Selecione os dados que deseja receber. Essa solicitacao sera enviada por e-mail
            para o provedor responsavel pelo tratamento dos dados.
          </p>

          <div className="subscription-data-request__grid">
            {DATA_REQUEST_OPTIONS.map((option) => {
              const checked = selectedDataRequestOptions.includes(option.key);
              return (
                <label
                  key={option.key}
                  className={`subscription-data-request__option ${checked ? "is-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDataRequestOption(option.key)}
                    disabled={isRequestingData}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>

          <div className="subscription-data-request__notes">
            <label htmlFor="subscription-data-request-notes">
              Observacoes adicionais
            </label>
            <textarea
              id="subscription-data-request-notes"
              rows={4}
              value={dataRequestNotes}
              onChange={(event) => setDataRequestNotes(event.target.value)}
              placeholder="Se quiser, detalhe um periodo, contexto ou outro dado especifico."
              disabled={isRequestingData}
            />
          </div>

          <div className="subscription-data-request__footer">
            <button
              type="button"
              className="subscription-feature-block__secondary"
              onClick={closeDataRequestModal}
              disabled={isRequestingData}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="subscription-feature-block__primary"
              onClick={() => void handleRequestData()}
              disabled={isRequestingData}
            >
              {isRequestingData ? "Solicitando dados..." : "Enviar solicitacao"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function SubscriptionFeatureGate({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  const { isLimitedMode } = useSubscriptionAccess();

  if (isLimitedMode) {
    return <SubscriptionBlockedState title={title} description={description} />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();


  const getHomeRoute = () => {
    if (!isAuthenticated) return "/";
    if (user) return getDefaultRouteForUser(user);
    return "/";
  };


  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/termos-de-uso" element={<TermsPage />} />
      <Route path="/termos" element={<Navigate to="/termos-de-uso" replace />} />
      <Route path="/politica-de-privacidade" element={<PrivacyPage />} />
      <Route path="/privacidade" element={<Navigate to="/politica-de-privacidade" replace />} />
      <Route path="/exclusao-de-conta" element={<AccountDeletionPage />} />
      <Route path="/manutencao" element={<SleeknoteMaintenance />} />
      <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
      <Route path="/reset" element={<ResetPasswordPage />} />
      <Route path="/finalizar-cadastro" element={<OnboardingPage />} />
      <Route path="/nps" element={<NpsPage />} />
      <Route path="/nps/:token" element={<NpsPage />} />
      <Route
        path="/oauth/google-ads/callback"
        element={<GoogleAdsOAuthCallbackPage />}
      />

      {/* --- ROTAS PROTEGIDAS POR PERMISSÃO --- */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {/* Dashboard geralmente é liberado, mas podemos forçar 'dashboard.view' se quiser */}
            <MainLayout>
              <SubscriptionFeatureGate
                title="Dashboard bloqueado"
                description="Os indicadores e visoes operacionais ficam indisponiveis enquanto a assinatura estiver vencida."
              >
                <DashboardPage />
              </SubscriptionFeatureGate>
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/rh"
        element={
          <ProtectedRoute>
            <Navigate to="/rh/ponto" replace />
          </ProtectedRoute>
        }
      />

      <Route
        path="/rh/ponto"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="rh.point.register">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Modulo de RH bloqueado"
                  description="Os recursos operacionais de ponto e RH ficam indisponiveis ate a regularizacao da assinatura."
                >
                  <RhPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/rh/relatorio"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="rh.point.manage">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Relatorio bloqueado"
                  description="Relatorios operacionais podem ficar indisponiveis enquanto a assinatura estiver vencida."
                >
                  <RelatorioPonto />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      {/* Rotas administrativas do RH */}
      <Route
        path="/rh/admin"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="rh.point.manage">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Configuracoes de RH bloqueadas"
                  description="As configuracoes operacionais do modulo de RH ficam bloqueadas durante a suspensao da assinatura."
                >
                  <RhAdminPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/rh/funcionarios"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="rh.point.manage">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Gestao de equipe bloqueada"
                  description="Cadastros e ajustes operacionais de colaboradores ficam bloqueados ate a regularizacao da assinatura."
                >
                  <Funcionarios />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/rh/feriados"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="rh.point.manage">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Configuracao bloqueada"
                  description="As configuracoes de feriados ficam indisponiveis enquanto a assinatura estiver vencida."
                >
                  <Feriados />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/rh/ferias"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="rh.point.manage">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Configuracao bloqueada"
                  description="As configuracoes de ferias ficam indisponiveis enquanto a assinatura estiver vencida."
                >
                  <Ferias />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/rh/horarios"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="rh.point.manage">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Configuracao bloqueada"
                  description="A gestao de horarios de trabalho fica indisponivel durante a suspensao da assinatura."
                >
                  <HorariosTrabalho />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/rh/day-off"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="rh.point.manage">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Configuracao bloqueada"
                  description="As rotinas operacionais de day off ficam indisponiveis enquanto a assinatura estiver vencida."
                >
                  <ValidarDayOff />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/rh/justificativa"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="rh.point.manage">
              <Navigate to="/rh/admin?tab=justificativas" replace />
            </PermissionRoute>
          </ProtectedRoute>
        }
      />


      <Route
        path="/estoque"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="stock.view">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Estoque bloqueado"
                  description="Os modulos operacionais de estoque ficam indisponiveis enquanto a assinatura estiver vencida."
                >
                  <InventoryPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/relatorios/nps"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="reports.nps.view">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Relatorio NPS bloqueado"
                  description="Relatorios operacionais podem ficar indisponiveis durante a suspensao da assinatura."
                >
                  <NpsReportPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/chat/:contactId?"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="chat.view">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Envio de WhatsApp bloqueado"
                  description="O atendimento e o disparo de mensagens ficam bloqueados enquanto a assinatura estiver vencida."
                >
                  <ChatPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/contatos"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="contacts.view">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Gestao de leads bloqueada"
                  description="A criacao e edicao de leads e contatos ficam bloqueadas durante a suspensao da assinatura."
                >
                  <ContactsPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/perfil/*"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ProfilePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AnyPermissionRoute permissions={SETTINGS_ACCESS_PERMISSIONS}>
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Configuracoes gerais bloqueadas"
                  description="As configuracoes da plataforma ficam indisponiveis enquanto a assinatura estiver vencida."
                >
                  <SettingsPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </AnyPermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/meta-management"
        element={
          <ProtectedRoute>
            <AnyPermissionRoute permissions={["meta.view", "meta_ads.view"]}>
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Integracoes bloqueadas"
                  description="As integracoes da Meta e o uso de APIs ficam bloqueados durante a suspensao da assinatura."
                >
                  <MetaManagementPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </AnyPermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/google-ads"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="google_ads.view">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Integracoes bloqueadas"
                  description="As integracoes e recursos de anuncios ficam indisponiveis enquanto a assinatura estiver vencida."
                >
                  <GoogleAdsPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      {/* <Route
        path="/vendas"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="sales.view">
              <MainLayout>
                <SalesPage />
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      /> */}

      <Route
        path="/comercial"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="commercial.view">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Funil comercial bloqueado"
                  description="Criacao de negocios, alteracoes no pipeline e operacoes comerciais ficam bloqueadas enquanto a assinatura estiver vencida."
                >
                  <CommercialApiPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/comercial-api"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="commercial.view">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Funil comercial bloqueado"
                  description="Criacao de negocios, alteracoes no pipeline e operacoes comerciais ficam bloqueadas enquanto a assinatura estiver vencida."
                >
                  <CommercialApiPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/transacoes"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="sales.view">
              {" "}
              {/* Assume permissÃ£o de vendas */}
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Transacoes bloqueadas"
                  description="Os modulos operacionais de vendas ficam indisponiveis enquanto a assinatura estiver vencida."
                >
                  <TransactionsPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/manual/admin"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ManualAdminPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/manual/:articleSlug?"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ManualPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/usuarios"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="users.manage">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Gestao de equipe bloqueada"
                  description="A administracao operacional de usuarios e permissoes fica indisponivel ate a regularizacao da assinatura."
                >
                  <UsersPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/assinatura"
        element={
          <ProtectedRoute>
            <MainLayout>
              <SubscriptionPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/financeiro"
        element={
          <ProtectedRoute>
            <PermissionRoute permission="financial.manage">
              <MainLayout>
                <SubscriptionFeatureGate
                  title="Financeiro bloqueado"
                  description="As operacoes financeiras ficam indisponiveis enquanto a assinatura estiver vencida."
                >
                  <FinancialPage />
                </SubscriptionFeatureGate>
              </MainLayout>
            </PermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/assinatura/historico"
        element={
          <ProtectedRoute>
            <MainLayout>
              <PaymentHistoryPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionAccessProvider>
          <CommandsProvider>
            <ToastProvider>
              <NewsProvider>
                <TagsProvider>
                  <ShortcutsProvider>
                    <AppRoutes />
                    <GlobalChatToastNotifications />
                    <Tooltip id="tags-tooltip" />
                  </ShortcutsProvider>
                </TagsProvider>
              </NewsProvider>
            </ToastProvider>
          </CommandsProvider>
        </SubscriptionAccessProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;


