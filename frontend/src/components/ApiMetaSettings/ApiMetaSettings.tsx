import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  MetaService,
  type IntegrationStatusData,
  type MetaIntegrationAccount,
} from "../../service/metaService";
import {
  normalizeIntegrationTone,
  useMetaSdk,
  type FacebookLoginOptions,
} from "./shared/metaSdk";
import "./ApiMetaSettings.css";

type MetaEmbeddedSignupIdentifiers = {
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  embeddedSignupEvent?: string;
  isWaLoginUser?: boolean;
};

function extractSignupValue(
  root: unknown,
  acceptedKeys: string[],
): string | undefined {
  const accepted = new Set(acceptedKeys.map((key) => key.toLowerCase()));
  const visited = new WeakSet<object>();
  const queue: unknown[] = [root];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;

    if (typeof current === "string") {
      const trimmed = current.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          queue.push(JSON.parse(trimmed));
        } catch {
          // Ignore non-JSON SDK messages.
        }
      }
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (accepted.has(key.toLowerCase()) && value !== null && value !== undefined) {
        const normalizedValue = String(value).trim();
        if (normalizedValue) return normalizedValue;
      }

      if (value && (typeof value === "object" || typeof value === "string")) {
        queue.push(value);
      }
    }
  }

  return undefined;
}

function extractSignupBoolean(
  root: unknown,
  acceptedKeys: string[],
): boolean | undefined {
  const accepted = new Set(acceptedKeys.map((key) => key.toLowerCase()));
  const visited = new WeakSet<object>();
  const queue: unknown[] = [root];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;

    if (typeof current === "string") {
      const trimmed = current.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          queue.push(JSON.parse(trimmed));
        } catch {
          // Ignore non-JSON SDK messages.
        }
      }
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (accepted.has(key.toLowerCase())) {
        if (typeof value === "boolean") return value;
        if (value === 1 || value === "1" || value === "true") return true;
        if (value === 0 || value === "0" || value === "false") return false;
      }

      if (value && (typeof value === "object" || typeof value === "string")) {
        queue.push(value);
      }
    }
  }

  return undefined;
}

function parseMetaEmbeddedSignupIdentifiers(
  raw: unknown,
): MetaEmbeddedSignupIdentifiers | null {
  const parseObject = (value: unknown): Record<string, unknown> | null => {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }
    return typeof value === "object" ? (value as Record<string, unknown>) : null;
  };

  const root = parseObject(raw);
  if (!root) return null;

  const data = parseObject(root.data) || root;
  const setup = parseObject(data.setup);
  const wabaId =
    extractSignupValue(root, [
      "waba_id",
      "whatsapp_account_id",
      "whatsapp_business_account_id",
    ]) || String(setup?.waba_id || "").trim();
  const phoneNumberId =
    extractSignupValue(root, [
      "phone_number_id",
      "phone_id",
      "phoneNumberId",
    ]) || String(setup?.phone_number_id || "").trim();
  const businessId =
    extractSignupValue(root, ["business_id", "business_manager_id"]) ||
    String(setup?.business_id || "").trim();
  const embeddedSignupEvent = extractSignupValue(root, ["event"]);
  const isWaLoginUser = extractSignupBoolean(root, ["is_wa_login_user"]);

  if (!wabaId && !phoneNumberId && !businessId && !embeddedSignupEvent) {
    return null;
  }

  return {
    wabaId: wabaId || undefined,
    phoneNumberId: phoneNumberId || undefined,
    businessId: businessId || undefined,
    embeddedSignupEvent: embeddedSignupEvent || undefined,
    isWaLoginUser,
  };
}

function getLinkedAccountLabel(account: MetaIntegrationAccount) {
  return (
    account.display_phone_number ||
    account.verified_name ||
    account.phone_number_id ||
    "Numero vinculado"
  );
}

function normalizeLinkedAccountColor(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(normalized)) {
    return normalized;
  }

  return "#0F766E";
}

export function ApiMetaSettings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [integrationStatus, setIntegrationStatus] = useState(
    "Consultando status...",
  );
  const [integrationData, setIntegrationData] =
    useState<IntegrationStatusData | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<MetaIntegrationAccount[]>(
    [],
  );
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSavingIntegration, setIsSavingIntegration] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [unlinkingMetaParamId, setUnlinkingMetaParamId] = useState<number | null>(null);
  const [updatingMetaColorParamId, setUpdatingMetaColorParamId] = useState<number | null>(null);
  const [linkedAccountColorDrafts, setLinkedAccountColorDrafts] = useState<Record<string, string>>({});
  const embeddedIdentifiersRef = useRef<MetaEmbeddedSignupIdentifiers>({});

  const metaAppId = String(
    import.meta.env.VITE_META_APP_ID || "",
  );
  const metaApiVersion = String(
    import.meta.env.VITE_META_API_VERSION || "v25.0",
  );
  const metaConfigId = String(
    import.meta.env.VITE_META_CONFIG_ID || "",
  );
  const metaDefaultRedirectUri = String(
    import.meta.env.VITE_META_REDIRECT_URI || "",
  ).trim();
  const { ensureMetaSdkApp } = useMetaSdk(metaAppId, metaApiVersion);

  const statusTone = useMemo(
    () => normalizeIntegrationTone(integrationStatus, isLoadingStatus),
    [integrationStatus, isLoadingStatus],
  );

  const loginOptions: FacebookLoginOptions = useMemo(
    () => ({
      config_id: metaConfigId,
      response_type: "code",
      override_default_response_type: true,
      scope:
        "business_management,whatsapp_business_management,whatsapp_business_messaging",
      return_scopes: true,
      display: "popup",
      extras: {
        feature: "whatsapp_embedded_signup",
        featureType: "whatsapp_business_app_onboarding",
        sessionInfoVersion: "3",
        version: "v3",
        setup: {},
      },
    }),
    [metaConfigId],
  );

  const visibleStatus = isLoadingStatus
    ? "Consultando status..."
    : integrationStatus;

  const fetchIntegrationStatus = useCallback(async () => {
    if (!user?.empresa_id) {
      setIntegrationStatus("Usuario sem empresa vinculada.");
      setIntegrationData(null);
      setLinkedAccounts([]);
      return;
    }

    try {
      setIsLoadingStatus(true);
      const result = await MetaService.getIntegrationStatus(user.empresa_id);
      const numbers = await MetaService.getIntegrationNumbers(
        user.empresa_id,
        user.id,
      );
      setIntegrationData(result.data);
      setLinkedAccounts(numbers);
      setIntegrationStatus(
        numbers.length ? "Integracao ativa" : result.statusText,
      );
    } catch (error) {
      console.error("[ApiMetaSettings] erro ao consultar status:", error);
      setIntegrationStatus("Erro ao consultar status.");
      setIntegrationData(null);
      setLinkedAccounts([]);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [user?.empresa_id, user?.id]);

  useEffect(() => {
    void fetchIntegrationStatus();
  }, [fetchIntegrationStatus]);

  useEffect(() => {
    setLinkedAccountColorDrafts((current) => {
      const next: Record<string, string> = {};

      linkedAccounts.forEach((account) => {
        const accountId = String(account.id || "").trim();
        if (!accountId) return;
        next[accountId] =
          current[accountId] || normalizeLinkedAccountColor(account.color);
      });

      return next;
    });
  }, [linkedAccounts]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = String(event.origin || "");
      if (!origin.includes("facebook.com")) return;

      const identifiers = parseMetaEmbeddedSignupIdentifiers(event.data);
      if (!identifiers) return;
      embeddedIdentifiersRef.current = {
        ...embeddedIdentifiersRef.current,
        ...identifiers,
      };
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const waitForEmbeddedIdentifiers = useCallback(async (timeoutMs = 8000) => {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const identifiers = embeddedIdentifiersRef.current;
      if (identifiers.phoneNumberId || identifiers.wabaId) {
        return identifiers;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }

    return embeddedIdentifiersRef.current;
  }, []);

  const handleSaveIntegration = useCallback(
    async (params: {
      signupCode?: string;
      accessToken?: string;
      whatsappAccountId?: string;
      phoneNumberId?: string;
      businessId?: string;
      embeddedSignupEvent?: string;
      isWaLoginUser?: boolean;
    }) => {
      if (!user?.empresa_id) return;

      try {
        setIsSavingIntegration(true);
        await MetaService.saveIntegration({
          empresaId: user.empresa_id,
          signupCode: params.signupCode,
          accessToken: params.accessToken,
          redirectUri: metaDefaultRedirectUri || undefined,
          whatsappAccountId: params.whatsappAccountId,
          wabaId: params.whatsappAccountId,
          phoneNumberId: params.phoneNumberId,
          businessId: params.businessId,
          embeddedSignupEvent: params.embeddedSignupEvent,
          isWaLoginUser: params.isWaLoginUser,
        });

        addToast({
          type: "success",
          title: "Conta vinculada",
          description: "A integracao com a Meta foi salva para esta empresa.",
        });
        await fetchIntegrationStatus();
      } catch (error) {
        console.error("[ApiMetaSettings] erro ao salvar integracao:", error);
        addToast({
          type: "error",
          title: "Erro ao salvar integracao",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel salvar a vinculacao com a Meta.",
        });
      } finally {
        setIsSavingIntegration(false);
      }
    },
    [addToast, fetchIntegrationStatus, metaDefaultRedirectUri, user?.empresa_id],
  );

  const handleMetaLogin = useCallback(() => {
    if (!user?.empresa_id) return;

    void (async () => {
      const metaWindow = window as unknown as {
        FB?: {
          login: (
            callback: (response: {
              authResponse?: { code?: string; accessToken?: string };
            }) => void,
            options?: FacebookLoginOptions,
          ) => void;
        };
      };
      const sdkAvailable = await ensureMetaSdkApp();

      if (!sdkAvailable || !metaWindow.FB) {
        addToast({
          type: "warning",
          title: "SDK indisponivel",
          description:
            "A SDK da Meta ainda nao foi carregada. Aguarde alguns segundos e tente novamente.",
        });
        return;
      }

      setIsConnecting(true);
      embeddedIdentifiersRef.current = {};

      metaWindow.FB.login((response) => {
        const authCode = response?.authResponse?.code || "";
        const accessToken = response?.authResponse?.accessToken || "";
        setIsConnecting(false);

        if (!authCode && !accessToken) {
          addToast({
            type: "warning",
            title: "Fluxo finalizado",
            description:
              "A Meta nao retornou code/access token para concluir a vinculacao.",
          });
          return;
        }

        void (async () => {
          const identifiers = await waitForEmbeddedIdentifiers();
          await handleSaveIntegration({
            signupCode: authCode || undefined,
            accessToken: accessToken || undefined,
            whatsappAccountId: identifiers.wabaId,
            phoneNumberId: identifiers.phoneNumberId,
            businessId: identifiers.businessId,
            embeddedSignupEvent: identifiers.embeddedSignupEvent,
            isWaLoginUser: identifiers.isWaLoginUser,
          });
        })();
      }, loginOptions);
    })();
  }, [
    addToast,
    handleSaveIntegration,
    loginOptions,
    user?.empresa_id,
    ensureMetaSdkApp,
    waitForEmbeddedIdentifiers,
  ]);

  const handleUnlinkLinkedAccount = useCallback(
    async (account: MetaIntegrationAccount) => {
      const accountId = Number(account.id || 0);
      if (!user?.empresa_id || !Number.isInteger(accountId) || accountId <= 0) {
        return;
      }

      const label = getLinkedAccountLabel(account);
      if (!window.confirm(`Deseja remover ${label}? O registro sera mantido, mas marcado como inativo.`)) {
        return;
      }

      try {
        setUnlinkingMetaParamId(accountId);
        await MetaService.unlinkIntegrationNumber(user.empresa_id, accountId);
        addToast({
          type: "success",
          title: "Numero removido",
          description: `${label} foi marcado como inativo com sucesso.`,
        });
        await fetchIntegrationStatus();
      } catch (error) {
        console.error("[ApiMetaSettings] erro ao remover numero:", error);
        addToast({
          type: "error",
          title: "Erro ao remover numero",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel remover este numero.",
        });
      } finally {
        setUnlinkingMetaParamId(null);
      }
    },
    [addToast, fetchIntegrationStatus, user?.empresa_id],
  );

  const handleSaveLinkedAccountColor = useCallback(
    async (account: MetaIntegrationAccount) => {
      const accountId = Number(account.id || 0);
      if (!user?.empresa_id || !Number.isInteger(accountId) || accountId <= 0) {
        return;
      }

      const label = getLinkedAccountLabel(account);
      const nextColor = normalizeLinkedAccountColor(
        linkedAccountColorDrafts[String(accountId)]
      );

      try {
        setUpdatingMetaColorParamId(accountId);
        await MetaService.updateIntegrationNumberColor(
          user.empresa_id,
          accountId,
          nextColor
        );
        addToast({
          type: "success",
          title: "Cor atualizada",
          description: `A cor do numero ${label} foi salva.`,
        });
        await fetchIntegrationStatus();
      } catch (error) {
        console.error("[ApiMetaSettings] erro ao salvar cor:", error);
        addToast({
          type: "error",
          title: "Erro ao salvar cor",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel salvar a cor deste numero.",
        });
      } finally {
        setUpdatingMetaColorParamId(null);
      }
    },
    [addToast, fetchIntegrationStatus, linkedAccountColorDrafts, user?.empresa_id],
  );

  return (
    <div className="api-meta-settings-container">
      <header className="api-meta-hero">
        <div className="page-actions">
          <span className="api-meta-eyebrow">Meta Business</span>
          <h2>Conecte a empresa ao WhatsApp oficial da Meta</h2>
          <div className="meta-integration-status-field">
            <label htmlFor="meta-integration-status">
              Status da integração:
            </label>
            <input
              id="meta-integration-status"
              type="text"
              className={`meta-integration-status-input meta-integration-status-input--${statusTone}`}
              value={visibleStatus}
              readOnly
            />
          </div>

          <div className="meta-button-space">
            <button
              type="button"
              className="add-button meta-connect-button"
              onClick={handleMetaLogin}
              disabled={isConnecting || isSavingIntegration}
            >
              {isConnecting
                ? "Conectando empresa..."
                : isSavingIntegration
                  ? "Salvando vinculacao..."
                  : "Vincular conta da Meta"}
            </button>
            <button
              type="button"
              className="meta-toggle-details-button"
              onClick={() => setIsDetailsOpen((current) => !current)}
            >
              {isDetailsOpen ? "Ver menos" : "Ver mais"}
            </button>
          </div>

          {isDetailsOpen ? (
            <div className="meta-template-block meta-template-block--integration-summary">
              <div className="meta-field-grid meta-field-grid--template-base">
                <div className="meta-summary-field">
                  <span>Status atual</span>
                  <strong>{visibleStatus}</strong>
                </div>
                <div className="meta-summary-field">
                  <span>Webhook</span>
                  <strong>{integrationData?.webhook_url || "-"}</strong>
                </div>
                <div className="meta-summary-field">
                  <span>Numeros vinculados</span>
                  <strong>{linkedAccounts.length || 0}</strong>
                </div>
              </div>

              {linkedAccounts.length ? (
                <div className="meta-linked-accounts-list">
                  {linkedAccounts.map((account, index) => {
                    const accountId = Number(account.id || 0);
                    const isActive = account.ativo !== false;
                    const currentDraftColor = normalizeLinkedAccountColor(
                      linkedAccountColorDrafts[String(account.id || "")] || account.color
                    );
                    const hasUnsavedColorChange =
                      currentDraftColor !== normalizeLinkedAccountColor(account.color);

                    return (
                      <div
                        key={`${account.id || account.phone_number_id || index}`}
                        className={`meta-linked-account-card${
                          isActive ? "" : " meta-linked-account-card--inactive"
                        }`}
                      >
                        <div className="meta-linked-account-copy">
                          <strong className="meta-linked-account-title">
                            <span
                              className="meta-linked-account-color-preview"
                              style={{ backgroundColor: currentDraftColor }}
                              aria-hidden="true"
                            />
                            <span>{getLinkedAccountLabel(account)}</span>
                          </strong>
                          <span>{account.whatsapp_account_name || "-"}</span>
                          <small>ID tecnico: {account.phone_number_id || "-"}</small>
                        </div>

                        <div className="meta-template-actions">
                          <span className="meta-linked-account-badge">
                            {isActive ? "Ativo" : "Inativo"}
                          </span>
                          {accountId > 0 ? (
                            <label className="meta-linked-account-color-field">
                              <span>Cor</span>
                              <input
                                type="color"
                                value={currentDraftColor}
                                disabled={updatingMetaColorParamId === accountId}
                                onChange={(event) =>
                                  setLinkedAccountColorDrafts((current) => ({
                                    ...current,
                                    [String(accountId)]: normalizeLinkedAccountColor(
                                      event.target.value
                                    ),
                                  }))
                                }
                              />
                            </label>
                          ) : null}
                          {accountId > 0 ? (
                            <button
                              type="button"
                              className="meta-secondary-button meta-linked-account-save-button"
                              onClick={() => void handleSaveLinkedAccountColor(account)}
                              disabled={
                                !isActive ||
                                !hasUnsavedColorChange ||
                                updatingMetaColorParamId === accountId
                              }
                            >
                              {updatingMetaColorParamId === accountId
                                ? "Salvando..."
                                : "Salvar"}
                            </button>
                          ) : null}
                          {accountId > 0 ? (
                            <button
                              type="button"
                              className="meta-secondary-button"
                              onClick={() => void handleUnlinkLinkedAccount(account)}
                              disabled={!isActive || unlinkingMetaParamId === accountId}
                            >
                              {!isActive
                                ? "Removido"
                                : unlinkingMetaParamId === accountId
                                  ? "Removendo..."
                                  : "Remover"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="meta-template-actions">
                <Link className="meta-secondary-button" to="/meta-management">
                  Abrir gestao
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </header>
    </div>
  );
}
