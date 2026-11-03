import { useCallback, useEffect, useState } from "react";

export type FacebookLoginResponse = {
  status?: string;
  authResponse?: {
    code?: string;
    accessToken?: string;
    expiresIn?: number;
  };
};

export type FacebookLoginOptions = {
  config_id?: string;
  response_type?: "code";
  override_default_response_type?: boolean;
  scope?: string;
  return_scopes?: boolean;
  display?: "popup";
  extras?: {
    feature?: "whatsapp_embedded_signup";
    featureType?: "whatsapp_business_app_onboarding";
    sessionInfoVersion?: number | string;
    version?: "v3";
    setup?: Record<string, unknown>;
  };
};

type MetaWindow = typeof window & {
  FB?: {
    init: (options: {
      appId: string;
      cookie: boolean;
      xfbml: boolean;
      version: string;
    }) => void;
    login: (
      callback: (response: FacebookLoginResponse) => void,
      options?: FacebookLoginOptions,
    ) => void;
  };
  fbAsyncInit?: () => void;
};

export function useMetaSdk(appId: string, apiVersion: string) {
  const metaWindow = window as MetaWindow;
  const [isMetaSdkReady, setIsMetaSdkReady] = useState(Boolean(metaWindow.FB));

  const initializeMetaSdk = useCallback(() => {
    const currentWindow = window as MetaWindow;
    if (!currentWindow.FB) return false;

    currentWindow.FB.init({
      appId,
      cookie: true,
      xfbml: true,
      version: apiVersion,
    });
    setIsMetaSdkReady(true);
    return true;
  }, [apiVersion, appId]);

  useEffect(() => {
    const currentWindow = window as MetaWindow;

    currentWindow.fbAsyncInit = () => {
      initializeMetaSdk();
    };

    const existingScript = document.getElementById("facebook-jssdk");
    if (existingScript) {
      if (currentWindow.FB) {
        initializeMetaSdk();
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [initializeMetaSdk]);

  const waitForMetaSdk = useCallback(async (timeoutMs = 5000) => {
    const startedAt = Date.now();
    const currentWindow = window as MetaWindow;

    while (Date.now() - startedAt < timeoutMs) {
      if (currentWindow.FB) {
        setIsMetaSdkReady(true);
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }

    return Boolean(currentWindow.FB);
  }, []);

  const ensureMetaSdkApp = useCallback(
    async (timeoutMs = 5000) => {
      const sdkLoaded = await waitForMetaSdk(timeoutMs);
      if (!sdkLoaded) return false;
      return initializeMetaSdk();
    },
    [initializeMetaSdk, waitForMetaSdk],
  );

  return { isMetaSdkReady, waitForMetaSdk, ensureMetaSdkApp };
}

export function normalizeIntegrationTone(
  statusText: string,
  isLoading: boolean,
): string {
  if (isLoading) return "loading";

  const normalized = statusText.toLowerCase();
  if (
    normalized.includes("erro") ||
    normalized.includes("invalido") ||
    normalized.includes("falha")
  ) {
    return "danger";
  }

  if (
    normalized.includes("ativa") ||
    normalized.includes("vinculada") ||
    normalized.includes("vinculadas") ||
    normalized.includes("conectado")
  ) {
    return "success";
  }

  if (
    normalized.includes("nenhuma") ||
    normalized.includes("aguardando") ||
    normalized.includes("nao")
  ) {
    return "warning";
  }

  return "default";
}
