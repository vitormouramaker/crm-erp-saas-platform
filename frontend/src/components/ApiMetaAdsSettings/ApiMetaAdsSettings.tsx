import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  MetaAdsService,
  type MetaAdsAccount,
} from "../../service/metaAdsService";
import {
  normalizeIntegrationTone,
  useMetaSdk,
  type FacebookLoginOptions,
} from "../ApiMetaSettings/shared/metaSdk";
import "../ApiMetaSettings/ApiMetaSettings.css";

export function ApiMetaAdsSettings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [integrationStatus, setIntegrationStatus] = useState(
    "Consultando status...",
  );
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [accounts, setAccounts] = useState<MetaAdsAccount[]>([]);

  const metaAppId = String(
    import.meta.env.VITE_META_ADS_APP_ID || "",
  ).trim();
  const metaApiVersion = String(
    import.meta.env.VITE_META_API_VERSION || "v25.0",
  ).trim();
  const metaAdsConfigId = String(
    import.meta.env.VITE_META_ADS_CONFIG_ID || "",
  ).trim();
  const metaAdsDefaultRedirectUri = String(
    import.meta.env.VITE_META_ADS_REDIRECT_URI ||
      import.meta.env.VITE_META_REDIRECT_URI ||
      "",
  ).trim();
  const { ensureMetaSdkApp } = useMetaSdk(metaAppId, metaApiVersion);

  const statusTone = useMemo(
    () => normalizeIntegrationTone(integrationStatus, isLoadingStatus),
    [integrationStatus, isLoadingStatus],
  );

  const loginOptions: FacebookLoginOptions = useMemo(
    () => ({
      config_id: metaAdsConfigId,
      response_type: "code",
      override_default_response_type: true,
      scope: "ads_management,ads_read,business_management",
      return_scopes: true,
      display: "popup",
      extras: {
        sessionInfoVersion: "3",
      },
    }),
    [metaAdsConfigId],
  );

  const fetchIntegrationStatus = useCallback(async () => {
    if (!user?.empresa_id) {
      setIntegrationStatus("Usuario sem empresa vinculada.");
      return;
    }

    try {
      setIsLoadingStatus(true);
      const result = await MetaAdsService.getIntegrationStatus(user.empresa_id);
      const nextAccounts = await MetaAdsService.listAccounts(user.empresa_id);
      setAccounts(nextAccounts);
      setIntegrationStatus(
        nextAccounts.length
          ? `${nextAccounts.length} conta(s) de anuncio vinculada(s)`
          : result.statusText,
      );
    } catch (error) {
      console.error("[ApiMetaAdsSettings] erro ao consultar status:", error);
      setIntegrationStatus("Erro ao consultar status.");
    } finally {
      setIsLoadingStatus(false);
    }
  }, [user?.empresa_id]);

  useEffect(() => {
    void fetchIntegrationStatus();
  }, [fetchIntegrationStatus]);

  const handleMetaAdsLogin = useCallback(() => {
    if (!user?.empresa_id) return;

    if (!metaAdsConfigId) {
      addToast({
        type: "warning",
        title: "Configuracao pendente",
        description:
          "Defina VITE_META_ADS_CONFIG_ID no front para habilitar o Embedded Signup da Meta Ads.",
      });
      return;
    }

    void (async () => {
      const metaWindow = window as unknown as {
        FB?: {
          login: (
            callback: (
              response: { authResponse?: { code?: string; accessToken?: string } },
            ) => void,
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

      metaWindow.FB.login((response) => {
        void (async () => {
          try {
            const signupCode = response?.authResponse?.code;
            const accessToken = response?.authResponse?.accessToken;

            if (!signupCode && !accessToken) {
              throw new Error(
                "A Meta nao retornou code/access token para concluir a vinculacao.",
              );
            }

            const validation = await MetaAdsService.validateAssets({
              empresaId: user.empresa_id,
              signupCode,
              accessToken,
              redirectUri: metaAdsDefaultRedirectUri || undefined,
            });
            const selectedAdAccountIds = (validation.available_accounts || [])
              .map((account) => String(account.id || ""))
              .filter(Boolean);

            if (!selectedAdAccountIds.length) {
              addToast({
                type: "warning",
                title: "Aprovacao concluida, mas sem ativos liberados",
                description:
                  "A Meta ainda nao retornou contas acessiveis para importação.",
              });
              await fetchIntegrationStatus();
              return;
            }

            await MetaAdsService.saveIntegration({
              empresaId: user.empresa_id,
              signupCode,
              accessToken,
              redirectUri: metaAdsDefaultRedirectUri || undefined,
              selectedAdAccountIds,
            });

            addToast({
              type: "success",
              title: "Ativos liberados e importados",
              description:
                "As contas liberadas pela Meta foram salvas para esta empresa.",
            });
            await fetchIntegrationStatus();
          } catch (error) {
            console.error("[ApiMetaAdsSettings] erro ao vincular:", error);
            addToast({
              type: "error",
              title: "Erro ao vincular contas",
              description:
                error instanceof Error
                  ? error.message
                  : "Nao foi possivel vincular as contas de anuncio.",
            });
          } finally {
            setIsConnecting(false);
          }
        })();
      }, loginOptions);
    })();
  }, [
    addToast,
    fetchIntegrationStatus,
    loginOptions,
    metaAdsConfigId,
    metaAdsDefaultRedirectUri,
    user?.empresa_id,
    ensureMetaSdkApp,
  ]);

  return (
    <div className="api-meta-settings-container">
      <header className="api-meta-hero">
        <div className="page-actions">
          <span className="api-meta-eyebrow">Meta Ads</span>
          <h2>Aprove o acesso e importe as contas liberadas</h2>
          <div className="meta-integration-status-field">
            <label htmlFor="meta-ads-integration-status">
              Status da integração:
            </label>
            <input
              id="meta-ads-integration-status"
              type="text"
              className={`meta-integration-status-input meta-integration-status-input--${statusTone}`}
              value={
                isLoadingStatus ? "Consultando status..." : integrationStatus
              }
              readOnly
            />
          </div>
          <button
            type="button"
            className="add-button meta-connect-button"
            onClick={handleMetaAdsLogin}
            disabled={isConnecting}
          >
            {isConnecting ? "Solicitando aprovacao..." : "Aprovar acesso na Meta Ads"}
          </button>
          {accounts.length > 0 ? (
            <span className="meta-linked-account-badge">
              {accounts.length} conta(s) vinculada(s)
            </span>
          ) : null}
        </div>
      </header>
    </div>
  );
}
