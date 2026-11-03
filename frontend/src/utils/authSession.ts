import { decrypt } from "./cripto";
import type { User } from "../contexts/AuthContext";
import { clearServerSessionToken, hasServerSessionToken } from "./authenticatedFetch";

const AUTH_TOKEN_KEY = "authToken";

type RawUser = User & {
  nome?: string;
};

type AuthEnvelope = {
  boleano?: boolean;
  obj?: RawUser;
};

function normalizeUser(u: RawUser): User {
  const rawIsMaster = u?.is_master as unknown;
  const rawPdv = u?.pdv as unknown;
  const isMaster =
    rawIsMaster === true ||
    rawIsMaster === 1 ||
    rawIsMaster === "1" ||
    String(rawIsMaster || "").toLowerCase() === "true";
  const pdv =
    rawPdv === true ||
    rawPdv === 1 ||
    rawPdv === "1" ||
    String(rawPdv || "").toLowerCase() === "true";

  return {
    ...u,
    is_master: isMaster,
    pdv,
    name: u?.name ?? u?.nome ?? "Usuario",
  };
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return atob(padded);
  } catch {
    return null;
  }
}

export async function getSessionUserFromToken(token: string): Promise<User | null> {
  const decrypted = (await decrypt(token)) as AuthEnvelope | null;

  if (!decrypted?.boleano || !decrypted.obj) {
    return null;
  }

  return normalizeUser(decrypted.obj);
}

export async function readStoredSession(): Promise<{ token: string; user: User } | null> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token || !hasServerSessionToken()) {
    return null;
  }

  const user = await getSessionUserFromToken(token);
  if (!user) {
    clearStoredSession();
    return null;
  }

  return { token, user };
}

export function persistSession(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  clearServerSessionToken();
}

export function getTokenExpiryMs(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;

  const decoded = decodeBase64Url(payload);
  if (!decoded) return null;

  try {
    const parsed = JSON.parse(decoded) as { exp?: number };
    return typeof parsed.exp === "number" ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}
