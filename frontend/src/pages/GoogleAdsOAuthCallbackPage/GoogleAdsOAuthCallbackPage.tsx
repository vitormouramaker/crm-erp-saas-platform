import { useEffect } from "react";

export function GoogleAdsOAuthCallbackPage() {
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code") || undefined;
    const state = searchParams.get("state") || undefined;
    const error = searchParams.get("error") || undefined;
    const errorDescription =
      searchParams.get("error_description") || undefined;

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: "google_ads_oauth_callback",
          code,
          state,
          error,
          error_description: errorDescription,
        },
        window.location.origin,
      );
    }

    window.setTimeout(() => {
      window.close();
    }, 150);
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div>
        <h1>Google Ads</h1>
        <p>Autenticacao concluida. Esta janela pode ser fechada.</p>
      </div>
    </main>
  );
}
