import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  GoogleAdsService,
  type GoogleAdsAccount,
  type GoogleAdsTokenData,
} from "../../service/googleAdsService";
import "../ApiMetaSettings/ApiMetaSettings.css";

type GoogleAdsCallbackMessage = {
  type?: string;
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
};

function buildGoogleAdsRedirectUri(): string {
  const explicitUri = String(
    import.meta.env.VITE_GOOGLE_ADS_REDIRECT_URI || "",
  ).trim();
  if (explicitUri) return explicitUri;

  const path = String(
    import.meta.env.VITE_GOOGLE_ADS_REDIRECT_PATH || "/oauth/google-ads/callback",
  ).trim();

  return new URL(path, window.location.origin).toString();
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getStatusPillClass(status?: string | null): string {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();

  if (
    normalized.includes("ENABLED") ||
    normalized.includes("ACTIVE") ||
    normalized.includes("ATIVO")
  ) {
    return "meta-ads-dashboard-status-pill--active";
  }

  if (
    normalized.includes("PAUSED") ||
    normalized.includes("CANCELED") ||
    normalized.includes("CANCELLED") ||
    normalized.includes("INACTIVE") ||
    normalized.includes("REMOVED")
  ) {
    return "meta-ads-dashboard-status-pill--inactive";
  }

  return "meta-ads-dashboard-status-pill--neutral";
}

function getAccountCardStateClass(
  selected: boolean,
  alreadyLinked: boolean,
  selectable: boolean,
): string {
  if (!selectable) return "meta-ads-account-card--initial";
  if (selected) return "meta-ads-account-card--selected meta-template-item--active";
  if (alreadyLinked) return "meta-ads-account-card--muted";
  return "";
}

function getSelectableCustomerIds(accounts: GoogleAdsAccount[]): string[] {
  return accounts
    .filter((account) => !account.manager)
    .map((account) => String(account.customer_id || "").trim())
    .filter(Boolean);
}

function getIntegrationStatusTone(
  statusText: string,
  isLoading: boolean,
): "loading" | "danger" | "success" | "warning" | "neutral" {
  if (isLoading) return "loading";

  const normalized = String(statusText || "")
    .trim()
    .toLowerCase();

  if (
    normalized.includes("erro") ||
    normalized.includes("falha") ||
    normalized.includes("invalido")
  ) {
    return "danger";
  }

  if (
    normalized.includes("vinculada") ||
    normalized.includes("vinculado") ||
    normalized.includes("ativa") ||
    normalized.includes("ativo") ||
    normalized.includes("conectado")
  ) {
    return "success";
  }

  if (
    normalized.includes("aguardando") ||
    normalized.includes("pendente") ||
    normalized.includes("sem empresa") ||
    normalized.includes("nenhuma conta")
  ) {
    return "warning";
  }

  return "neutral";
}

export function GoogleAdsManagementSettings({
  onInitialLoadChange,
}: {
  onInitialLoadChange?: (loading: boolean) => void;
}) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isStartingOauth, setIsStartingOauth] = useState(false);
  const [isAwaitingOauth, setIsAwaitingOauth] = useState(false);
  const [isValidatingOauth, setIsValidatingOauth] = useState(false);
  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [removingCustomerId, setRemovingCustomerId] = useState("");
  const [statusText, setStatusText] = useState("Aguardando consulta...");
  const [isIntegrationActive, setIsIntegrationActive] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<GoogleAdsAccount[]>([]);
  const [validatedAccounts, setValidatedAccounts] = useState<GoogleAdsAccount[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [pendingOauthToken, setPendingOauthToken] =
    useState<GoogleAdsTokenData | null>(null);
  const [pendingOauthState, setPendingOauthState] = useState("");
  const [pendingRedirectUri, setPendingRedirectUri] = useState("");
  const [hasFetchedStatusOnce, setHasFetchedStatusOnce] = useState(false);
  const [hasFetchedAccountsOnce, setHasFetchedAccountsOnce] = useState(false);

  const popupRef = useRef<Window | null>(null);
  const popupWatcherRef = useRef<number | null>(null);

  const linkedAccountIdSet = useMemo(
    () =>
      new Set(
        linkedAccounts
          .map((account) => String(account.customer_id || "").trim())
          .filter(Boolean),
      ),
    [linkedAccounts],
  );
  const integrationStatusTone = useMemo(
    () => getIntegrationStatusTone(statusText, isLoadingStatus),
    [isLoadingStatus, statusText],
  );
  const visibleStatusText = isLoadingStatus
    ? "Consultando status..."
    : statusText;
  const oauthStageText = isValidatingOauth
    ? "Validando contas retornadas"
    : isAwaitingOauth
      ? "Aguardando aprovacao no Google"
      : isStartingOauth
        ? "Abrindo janela de autenticacao"
        : pendingOauthToken
          ? "OAuth validado e pronto para salvar"
          : "Login nao iniciado";

  const stopPopupWatcher = useCallback(() => {
    if (popupWatcherRef.current !== null) {
      window.clearInterval(popupWatcherRef.current);
      popupWatcherRef.current = null;
    }
  }, []);

  const fetchIntegrationStatus = useCallback(async () => {
    if (!user?.empresa_id) {
      setStatusText("Usuario sem empresa vinculada.");
      setIsIntegrationActive(false);
      setHasFetchedStatusOnce(true);
      return;
    }

    try {
      setIsLoadingStatus(true);
      const result = await GoogleAdsService.getIntegrationStatus(user.empresa_id);
      setStatusText(result.statusText);
      setIsIntegrationActive(result.isActive);
    } catch (error) {
      console.error("[GoogleAdsSettings] erro ao consultar status:", error);
      setStatusText("Erro ao consultar status.");
      setIsIntegrationActive(false);
    } finally {
      setIsLoadingStatus(false);
      setHasFetchedStatusOnce(true);
    }
  }, [user?.empresa_id]);

  const fetchAccounts = useCallback(async () => {
    if (!user?.empresa_id) {
      setLinkedAccounts([]);
      setHasFetchedAccountsOnce(true);
      return;
    }

    try {
      setIsLoadingAccounts(true);
      const accounts = await GoogleAdsService.listAccounts(user.empresa_id);
      setLinkedAccounts(accounts);
    } catch (error) {
      console.error("[GoogleAdsSettings] erro ao listar contas:", error);
      addToast({
        type: "error",
        title: "Erro ao carregar contas",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as contas do Google Ads.",
      });
    } finally {
      setIsLoadingAccounts(false);
      setHasFetchedAccountsOnce(true);
    }
  }, [addToast, user?.empresa_id]);

  const handleValidateOauth = useCallback(
    async (code: string, redirectUri: string) => {
      if (!user?.empresa_id) return;

      try {
        setIsValidatingOauth(true);

        const validation = await GoogleAdsService.validateAssets({
          empresaId: user.empresa_id,
          code,
          redirectUri,
        });

        const nextAccounts = validation.available_accounts || [];
        setPendingOauthToken(validation.oauth_token || null);
        setValidatedAccounts(nextAccounts);
        setSelectedCustomerIds(getSelectableCustomerIds(nextAccounts));

        if (!nextAccounts.length) {
          addToast({
            type: "warning",
            title: "Sem contas retornadas",
            description:
              "A autenticacao foi concluida, mas o Google Ads nao retornou contas acessiveis para este usuario.",
          });
          return;
        }

        addToast({
          type: "success",
          title: "Contas carregadas",
          description:
            "Selecione as contas do Google Ads que deseja manter vinculadas ao sistema.",
        });
      } catch (error) {
        console.error("[GoogleAdsSettings] erro ao validar OAuth:", error);
        addToast({
          type: "error",
          title: "Falha ao validar acesso",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel validar as contas do Google Ads.",
        });
      } finally {
        setIsValidatingOauth(false);
      }
    },
    [addToast, user?.empresa_id],
  );

  useEffect(() => {
    void fetchIntegrationStatus();
  }, [fetchIntegrationStatus]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const isInitialLoading = !hasFetchedStatusOnce || !hasFetchedAccountsOnce;

  useEffect(() => {
    onInitialLoadChange?.(isInitialLoading);
  }, [isInitialLoading, onInitialLoadChange]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<GoogleAdsCallbackMessage>) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (data?.type !== "google_ads_oauth_callback") return;

      stopPopupWatcher();
      setIsAwaitingOauth(false);

      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;

      if (data.state !== pendingOauthState) {
        addToast({
          type: "error",
          title: "Estado OAuth invalido",
          description:
            "A resposta do Google Ads nao corresponde ao fluxo iniciado. Tente novamente.",
        });
        return;
      }

      if (data.error) {
        addToast({
          type: "warning",
          title: "Autorizacao cancelada",
          description: data.error_description || data.error,
        });
        return;
      }

      if (!data.code) {
        addToast({
          type: "error",
          title: "Codigo ausente",
          description:
            "O Google Ads nao retornou o codigo de autorizacao esperado.",
        });
        return;
      }

      void handleValidateOauth(data.code, pendingRedirectUri);
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [
    addToast,
    handleValidateOauth,
    pendingOauthState,
    pendingRedirectUri,
    stopPopupWatcher,
  ]);

  useEffect(() => {
    return () => {
      stopPopupWatcher();
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, [stopPopupWatcher]);

  const handleStartOauth = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setIsStartingOauth(true);

      const redirectUri = buildGoogleAdsRedirectUri();
      const result = await GoogleAdsService.getOauthUrl({
        empresaId: user.empresa_id,
        redirectUri,
        loginHint: user.email || undefined,
      });

      const authUrl = String(result.auth_url || "").trim();
      const state = String(result.state || "").trim();
      const finalRedirectUri = String(result.redirect_uri || redirectUri).trim();

      if (!authUrl || !state || !finalRedirectUri) {
        throw new Error("O backend nao retornou os dados necessarios para abrir o OAuth.");
      }

      setPendingOauthState(state);
      setPendingRedirectUri(finalRedirectUri);
      setPendingOauthToken(null);
      setValidatedAccounts([]);
      setSelectedCustomerIds([]);

      const popup = window.open(
        authUrl,
        "google_ads_oauth",
        "width=720,height=760,menubar=no,toolbar=no,location=yes,resizable=yes,scrollbars=yes",
      );

      if (!popup) {
        throw new Error(
          "O navegador bloqueou a janela de login. Libere pop-ups e tente novamente.",
        );
      }

      popupRef.current = popup;
      popup.focus();
      setIsAwaitingOauth(true);

      stopPopupWatcher();
      popupWatcherRef.current = window.setInterval(() => {
        if (popup.closed) {
          stopPopupWatcher();
          popupRef.current = null;
          setIsAwaitingOauth(false);
        }
      }, 500);
    } catch (error) {
      console.error("[GoogleAdsSettings] erro ao iniciar OAuth:", error);
      addToast({
        type: "error",
        title: "Falha ao abrir login",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel iniciar o login do Google Ads.",
      });
    } finally {
      setIsStartingOauth(false);
    }
  }, [addToast, stopPopupWatcher, user?.email, user?.empresa_id]);

  const handleToggleValidatedAccount = useCallback((customerId: string) => {
    setSelectedCustomerIds((current) =>
      current.includes(customerId)
        ? current.filter((item) => item !== customerId)
        : [...current, customerId],
    );
  }, []);

  const handleSaveSelection = useCallback(async () => {
    if (!user?.empresa_id) return;
    if (!pendingOauthToken?.access_token) {
      addToast({
        type: "warning",
        title: "Refaca a autenticacao",
        description:
          "O token temporario do Google Ads nao esta mais disponivel. Inicie o login novamente.",
      });
      return;
    }

    if (!selectedCustomerIds.length) {
      addToast({
        type: "warning",
        title: "Nenhuma conta selecionada",
        description: "Selecione ao menos uma conta antes de salvar a integração.",
      });
      return;
    }

    try {
      setIsSavingSelection(true);

      const result = await GoogleAdsService.saveIntegration({
        empresaId: user.empresa_id,
        oauthToken: pendingOauthToken,
        selectedCustomerIds,
      });

      const totalContas = Number(result.status?.total_contas || selectedCustomerIds.length);
      setStatusText(
        totalContas > 0
          ? `${totalContas} conta(s) Google Ads vinculada(s)`
          : "Nenhuma conta Google Ads vinculada",
      );
      setIsIntegrationActive(totalContas > 0);
      setPendingOauthToken(null);
      setValidatedAccounts([]);
      setSelectedCustomerIds([]);

      await fetchAccounts();
      await fetchIntegrationStatus();

      addToast({
        type: "success",
        title: "Integração salva",
        description: "As contas selecionadas do Google Ads foram vinculadas com sucesso.",
      });
    } catch (error) {
      console.error("[GoogleAdsSettings] erro ao salvar integração:", error);
      addToast({
        type: "error",
        title: "Falha ao salvar",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar a integração do Google Ads.",
      });
    } finally {
      setIsSavingSelection(false);
    }
  }, [
    addToast,
    fetchAccounts,
    fetchIntegrationStatus,
    pendingOauthToken,
    selectedCustomerIds,
    user?.empresa_id,
  ]);

  const handleRemoveLinkedAccount = useCallback(
    async (account: GoogleAdsAccount) => {
      if (!user?.empresa_id) return;

      const customerId = String(account.customer_id || "").trim();
      if (!customerId) return;

      const accountLabel = account.customer_name || customerId;
      const shouldRemove = window.confirm(
        `Remover acesso da conta Google Ads ${accountLabel}?`,
      );

      if (!shouldRemove) return;

      try {
        setRemovingCustomerId(customerId);
        const result = await GoogleAdsService.removeAccount({
          empresaId: user.empresa_id,
          customerId,
        });

        setLinkedAccounts(result.contas || []);
        const totalContas = Number(result.status?.total_contas || 0);
        setStatusText(
          totalContas > 0
            ? `${totalContas} conta(s) Google Ads vinculada(s)`
            : "Nenhuma conta Google Ads vinculada",
        );
        setIsIntegrationActive(totalContas > 0);
        setValidatedAccounts((current) =>
          current.filter(
            (linkedAccount) => String(linkedAccount.customer_id || "").trim() !== customerId,
          ),
        );
        setSelectedCustomerIds((current) =>
          current.filter((selectedId) => selectedId !== customerId),
        );

        addToast({
          type: "success",
          title: "Conta removida",
          description: "A conta Google Ads foi desvinculada com sucesso.",
        });
      } catch (error) {
        console.error("[GoogleAdsSettings] erro ao remover conta:", error);
        addToast({
          type: "error",
          title: "Falha ao remover conta",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel remover a conta do Google Ads.",
        });
      } finally {
        setRemovingCustomerId("");
      }
    },
    [addToast, user?.empresa_id],
  );

  return (
    <div className="api-meta-settings-container">
      <header className="api-meta-hero google-ads-settings-hero">
        <div className="page-actions google-ads-settings-hero__content">
          <span className="api-meta-eyebrow">Google Ads</span>
          <h2>Conecte a empresa ao Google Ads</h2>
          <p>
            Vincule contas do Google Ads via OAuth para liberar consultas e
            futuras automações de campanhas dentro do sistema.
          </p>

          <div className="meta-integration-status-field">
            <label htmlFor="google-ads-integration-status">
              Status da integração:
            </label>
            <input
              id="google-ads-integration-status"
              type="text"
              className={`meta-integration-status-input meta-integration-status-input--${integrationStatusTone}`}
              value={visibleStatusText}
              readOnly
            />
          </div>

          <div className="meta-button-space google-ads-settings-hero__actions">
            <button
              type="button"
              className="add-button meta-connect-button"
              onClick={() => void handleStartOauth()}
              disabled={isStartingOauth || isAwaitingOauth || isValidatingOauth}
            >
              {isStartingOauth
                ? "Abrindo login..."
                : isAwaitingOauth
                  ? "Aguardando aprovacao..."
                  : "Conectar Google Ads"}
            </button>
          
          </div>

          <div className="meta-template-block meta-template-block--integration-summary google-ads-settings-summary">
            <div className="meta-field-grid meta-field-grid--template-base">
              <div className="meta-summary-field">
                <span>Status atual</span>
                <strong>{visibleStatusText}</strong>
              </div>
              <div className="meta-summary-field">
                <span>Integração</span>
                <strong>{isIntegrationActive ? "Ativa" : "Inativa"}</strong>
              </div>
              <div className="meta-summary-field">
                <span>Contas vinculadas</span>
                <strong>{linkedAccounts.length}</strong>
              </div>
              <div className="meta-summary-field">
                <span>Fluxo OAuth</span>
                <strong>{oauthStageText}</strong>
              </div>
            </div>
          </div>
        </div>

      </header>

      {isValidatingOauth && (
        <div className="meta-ads-onboarding-help">
          <h4>Validando acesso</h4>
          <p>O sistema esta consultando as contas retornadas pelo Google Ads.</p>
        </div>
      )}

      {validatedAccounts.length > 0 && (
        <section className="meta-template-block">
          <div className="meta-template-list-header">
            <div>
              <h3>Contas retornadas pelo OAuth</h3>
              <p>
                Selecione quais contas devem ficar disponiveis para esta empresa
                dentro do sistema.
              </p>
            </div>
            <div className="meta-template-actions">
              <button
                type="button"
                className="meta-secondary-button"
                onClick={() => setSelectedCustomerIds(getSelectableCustomerIds(validatedAccounts))}
              >
                Selecionar contas de anuncios
              </button>
              <button
                type="button"
                className="add-button"
                onClick={() => void handleSaveSelection()}
                disabled={isSavingSelection || !selectedCustomerIds.length}
              >
                {isSavingSelection ? "Salvando..." : "Salvar contas selecionadas"}
              </button>
            </div>
          </div>

          <div className="meta-template-list">
            {validatedAccounts.map((account) => {
              const customerId = String(account.customer_id || "").trim();
              const selected = selectedCustomerIds.includes(customerId);
              const alreadyLinked = linkedAccountIdSet.has(customerId);
              const selectable = !account.manager;
              const cardStateClass = getAccountCardStateClass(
                selected,
                alreadyLinked,
                selectable,
              );

              return (
                <label
                  key={customerId}
                  className={`meta-template-item meta-template-item--interactive meta-ads-account-card ${cardStateClass}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => handleToggleValidatedAccount(customerId)}
                    disabled={!selectable}
                    style={{ marginTop: 4 }}
                  />
                  <div className="meta-template-item-meta meta-ads-account-card-meta">
                    <div className="meta-ads-account-card-header">
                      <p className="meta-ads-account-card-name">
                        {account.customer_name || customerId}
                      </p>
                      <span
                        className={`meta-ads-dashboard-status-pill ${getStatusPillClass(account.status)}`}
                      >
                        {account.status || "Sem status"}
                      </span>
                    </div>
                    <div className="google-ads-settings-linked-card__grid">
                      <div className="google-ads-settings-linked-card__field">
                        <span>ID da conta</span>
                        <strong>{customerId}</strong>
                      </div>
                      <div className="google-ads-settings-linked-card__field">
                        <span>Fuso</span>
                        <strong>{account.time_zone || "-"}</strong>
                      </div>
                      <div className="google-ads-settings-linked-card__field">
                        <span>Moeda</span>
                        <strong>{account.currency_code || "-"}</strong>
                      </div>
                      <div className="google-ads-settings-linked-card__field">
                        <span>Tipo</span>
                        <strong>
                      {account.manager ? "Conta gerente" : "Conta de anuncios"}
                      {account.test_account ? " • teste" : ""}
                        </strong>
                      </div>
                    </div>
                    {account.manager && (
                      <p>
                        <strong>Observacao:</strong> contas gerentes nao exibem metricas
                        diretas. Vincule as contas clientes abaixo dela.
                      </p>
                    )}
                    {account.login_customer_id && (
                      <p>
                        <strong>Conta gerente:</strong> {account.login_customer_id}
                      </p>
                    )}
                    {alreadyLinked && (
                      <p>
                        <strong>Ja vinculada:</strong> esta conta ja existe na
                        empresa e sera atualizada ao salvar.
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      )}

      <section className="meta-template-block google-ads-settings-linked-section">
        <div className="meta-template-list-header google-ads-settings-section-header">
          <div>
            <h3>Contas atualmente vinculadas</h3>
            <p>
              Lista persistida no banco para uso posterior no modulo de Google Ads.
            </p>
          </div>
        </div>

        {isLoadingAccounts ? (
          <div className="google-ads-settings-empty-state">
            <p>Carregando contas vinculadas...</p>
          </div>
        ) : linkedAccounts.length === 0 ? (
          <div className="google-ads-settings-empty-state">
            <p>Nenhuma conta Google Ads vinculada ate o momento.</p>
          </div>
        ) : (
          <div className="google-ads-settings-linked-grid">
            {linkedAccounts.map((account) => {
              const customerId = String(account.customer_id || "").trim();

              return (
                <article
                  key={customerId}
                  className="google-ads-settings-linked-card"
                >
                  <div className="google-ads-settings-linked-card__body">
                    <div className="google-ads-settings-linked-card__header">
                      <p className="meta-ads-account-card-name">
                        {account.customer_name || customerId}
                      </p>
                      <span
                        className={`meta-ads-dashboard-status-pill ${getStatusPillClass(account.status)}`}
                      >
                        {account.status || "Sem status"}
                      </span>
                    </div>
                    <div className="google-ads-settings-linked-card__grid">
                      <div className="google-ads-settings-linked-card__field">
                        <span>ID da conta</span>
                        <strong>{customerId}</strong>
                      </div>
                      <div className="google-ads-settings-linked-card__field">
                        <span>Fuso</span>
                        <strong>{account.time_zone || "-"}</strong>
                      </div>
                      <div className="google-ads-settings-linked-card__field">
                        <span>Moeda</span>
                        <strong>{account.currency_code || "-"}</strong>
                      </div>
                      <div className="google-ads-settings-linked-card__field">
                        <span>Tipo</span>
                        <strong>
                      {account.manager ? "Conta gerente" : "Conta de anuncios"}
                      {account.test_account ? " • teste" : ""}
                        </strong>
                      </div>
                      <div className="google-ads-settings-linked-card__field">
                        <span>Ultimo OAuth</span>
                        <strong>{formatDateTime(account.last_oauth_at)}</strong>
                      </div>
                      <div className="google-ads-settings-linked-card__field">
                        <span>Token expira em</span>
                        <strong>{formatDateTime(account.token_expires_at)}</strong>
                      </div>
                    </div>
                    <div className="google-ads-settings-linked-card__actions">
                      <button
                        type="button"
                        className="meta-secondary-button"
                        onClick={() => void handleRemoveLinkedAccount(account)}
                        disabled={
                          Boolean(removingCustomerId) &&
                          removingCustomerId === customerId
                        }
                      >
                        {removingCustomerId === customerId
                          ? "Removendo..."
                          : "Remover acesso"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
