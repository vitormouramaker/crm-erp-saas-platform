import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  MetaIgService,
  type MetaIgAccount,
} from "../../service/metaIgService";
import {
  normalizeIntegrationTone,
  useMetaSdk,
  type FacebookLoginOptions,
} from "../ApiMetaSettings/shared/metaSdk";
import "../ApiMetaSettings/ApiMetaSettings.css";

export function ApiMetaIgSettings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [integrationStatus, setIntegrationStatus] = useState(
    "Consultando status...",
  );
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [accounts, setAccounts] = useState<MetaIgAccount[]>([]);

  const metaAppId = String(
    import.meta.env.VITE_META_APP_ID || "",
  ).trim();
  const metaApiVersion = String(
    import.meta.env.VITE_META_API_VERSION || "v25.0",
  ).trim();
  const { isMetaSdkReady, ensureMetaSdkApp } = useMetaSdk(
    metaAppId,
    metaApiVersion,
  );

  const statusTone = useMemo(
    () => normalizeIntegrationTone(integrationStatus, isLoadingStatus),
    [integrationStatus, isLoadingStatus],
  );

  const loginOptions: FacebookLoginOptions = useMemo(
    () => ({
      scope:
        "public_profile,pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights,business_management",
      return_scopes: true,
      display: "popup",
    }),
    [],
  );

  const fetchIntegrationStatus = useCallback(async () => {
    if (!user?.empresa_id) {
      setIntegrationStatus("Usuario sem empresa vinculada.");
      return;
    }

    try {
      setIsLoadingStatus(true);
      const result = await MetaIgService.getIntegrationStatus(user.empresa_id);
      const nextAccounts = await MetaIgService.listAccounts(user.empresa_id);
      setAccounts(nextAccounts);
      setIntegrationStatus(
        nextAccounts.length
          ? `${nextAccounts.length} conta(s) Instagram vinculada(s)`
          : result.statusText,
      );
    } catch (error) {
      console.error("[ApiMetaIgSettings] erro ao consultar status:", error);
      setIntegrationStatus("Erro ao consultar status.");
    } finally {
      setIsLoadingStatus(false);
    }
  }, [user?.empresa_id]);

  useEffect(() => {
    void fetchIntegrationStatus();
  }, [fetchIntegrationStatus]);

  const handleMetaIgLogin = useCallback(() => {
    if (!user?.empresa_id) return;

    void (async () => {
      const metaWindow = window as unknown as {
        FB?: {
          login: (
            callback: (response: { authResponse?: { accessToken?: string } }) => void,
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
            const accessToken = response?.authResponse?.accessToken;

            if (!accessToken) {
              throw new Error(
                "A Meta nao retornou access token para concluir a vinculacao.",
              );
            }

            const validation = await MetaIgService.validateAssets({
              empresaId: user.empresa_id,
              accessToken,
            });
            const selectedInstagramAccountIds = (
              validation.available_accounts || []
            )
              .map((account) => account.instagram_business_account_id)
              .filter((item): item is string => Boolean(item));

            if (!selectedInstagramAccountIds.length) {
              addToast({
                type: "warning",
                title: "Aprovacao concluida, mas sem conta Instagram",
                description:
                  "A Meta ainda nao retornou contas Instagram acessiveis.",
              });
              await fetchIntegrationStatus();
              return;
            }

            await MetaIgService.saveIntegration({
              empresaId: user.empresa_id,
              accessToken,
              selectedInstagramAccountIds,
            });

            addToast({
              type: "success",
              title: "Instagram vinculado",
              description:
                "As contas Instagram acessiveis foram salvas para esta empresa.",
            });
            await fetchIntegrationStatus();
          } catch (error) {
            console.error("[ApiMetaIgSettings] erro ao vincular:", error);
            addToast({
              type: "error",
              title: "Erro ao vincular Instagram",
              description:
                error instanceof Error
                  ? error.message
                  : "Nao foi possivel vincular as contas Instagram.",
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
    isMetaSdkReady,
    loginOptions,
    user?.empresa_id,
    ensureMetaSdkApp,
  ]);

  return (
    <div className="api-meta-settings-container">
      <header className="api-meta-hero">
        <div className="page-actions">
          <span className="api-meta-eyebrow">Meta Instagram</span>
          <h2>Conecte e sincronize contas Instagram profissionais</h2>
          <div className="meta-integration-status-field">
            <label htmlFor="meta-ig-integration-status">
              Status da integração:
            </label>
            <input
              id="meta-ig-integration-status"
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
            onClick={handleMetaIgLogin}
            disabled={!isMetaSdkReady || isConnecting}
          >
            {isConnecting ? "Solicitando aprovacao..." : "Aprovar acesso Instagram"}
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
