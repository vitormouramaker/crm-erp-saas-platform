import { createContext, useState, useContext, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { getPlanPermissions } from "../config/planPermissions";
import {
  clearStoredSession,
  getSessionUserFromToken,
  getTokenExpiryMs,
  persistSession,
  readStoredSession,
} from "../utils/authSession";

export interface User {
  id: number;
  name: string;
  email: string;
  telefone?: string | null;
  empresa_id: number;
  is_master: boolean;
  permissions: string[];
  id_plano: number;
  nome_plano: string;
  cargo_id?: number;
  pdv: boolean;
  foto_perfil_url?: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthReady: boolean;
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const expiryTimeoutRef = useRef<number | null>(null);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimeoutRef.current !== null) {
      window.clearTimeout(expiryTimeoutRef.current);
      expiryTimeoutRef.current = null;
    }
  }, []);

  const logout = useCallback(() => {
    clearExpiryTimer();
    clearStoredSession();
    setUser(null);
    setIsAuthenticated(false);
  }, [clearExpiryTimer]);

  const scheduleTokenExpiry = useCallback(
    (token: string) => {
      clearExpiryTimer();

      const expiryAt = getTokenExpiryMs(token);
      if (!expiryAt) return;

      const delay = expiryAt - Date.now();
      if (delay <= 0) {
        logout();
        return;
      }

      expiryTimeoutRef.current = window.setTimeout(() => {
        logout();
      }, delay);
    },
    [clearExpiryTimer, logout]
  );

  useEffect(() => {
    let isMounted = true;

    const hydrateAuth = async () => {
      const session = await readStoredSession();
      if (!isMounted) return;

      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      if (session?.token) {
        scheduleTokenExpiry(session.token);
      } else {
        clearExpiryTimer();
      }
      setIsAuthReady(true);
    };

    hydrateAuth();

    return () => {
      isMounted = false;
      clearExpiryTimer();
    };
  }, [clearExpiryTimer, scheduleTokenExpiry]);

  useEffect(() => {
    window.addEventListener("orbita:session-expired", logout);
    return () => window.removeEventListener("orbita:session-expired", logout);
  }, [logout]);

  const login = async (token: string) => {
    const existingSession = await readStoredSession();

    if (existingSession?.token === token) {
      setUser(existingSession.user);
      setIsAuthenticated(true);
      scheduleTokenExpiry(token);
      return;
    }

    const nextUser = await getSessionUserFromToken(token);

    if (!nextUser) {
      clearStoredSession();
      setUser(null);
      setIsAuthenticated(false);
      throw new Error("Sessao invalida ou expirada.");
    }

    persistSession(token);
    setUser(nextUser);
    setIsAuthenticated(true);
    scheduleTokenExpiry(token);
  };

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;

      const planAllowed = getPlanPermissions(user.id_plano, user.pdv);
      if (!planAllowed.includes(permission)) return false;

      if (user.is_master) return true;

      const customPermissions = Array.isArray(user.permissions) ? user.permissions : [];
      const isCommercialManager = customPermissions.includes("commercial.manager");
      const isChatManager = customPermissions.includes("chat.manager");
      if (permission.startsWith("commercial.") && isCommercialManager) {
        return true;
      }
      if (permission.startsWith("chat.") && isChatManager) {
        return true;
      }

      return customPermissions.includes(permission);
    },
    [user]
  );

  const value = { isAuthenticated, isAuthReady, user, login, logout, hasPermission };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
