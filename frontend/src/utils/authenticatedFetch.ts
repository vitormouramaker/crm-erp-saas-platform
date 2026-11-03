import { API_BASE } from "../config/api";

const SESSION_TOKEN_KEY = "sessionToken";

export function clearServerSessionToken() {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

export function hasServerSessionToken() {
  return Boolean(localStorage.getItem(SESSION_TOKEN_KEY));
}

export function getServerSessionToken() {
  return localStorage.getItem(SESSION_TOKEN_KEY) || "";
}

export function installAuthenticatedFetch() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const isBackendRequest = requestUrl.startsWith(API_BASE);
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
    if (isBackendRequest && sessionToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${sessionToken}`);
    }
    const response = await originalFetch(input, { ...init, headers });
    if (isBackendRequest) {
      const refreshedToken = response.headers.get("X-Session-Token");
      if (refreshedToken) localStorage.setItem(SESSION_TOKEN_KEY, refreshedToken);
      if (response.status === 401) {
        clearServerSessionToken();
        window.dispatchEvent(new Event("orbita:session-expired"));
      }
    }
    return response;
  };
}
