import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { registerForPushNotificationsAsync } from '@/hooks/usePushNotifications';
import { setSessionExpiredHandler } from '@/services/apiClient';
import { logout as apiLogout, readStoredSession } from '@/services/authApi';
import {
  clearLastPushRegistration,
  getLastPushRegistration,
  isPushEnabled,
  registerPushToken,
  setLastPushRegistration,
  setPushEnabledPreference,
  unregisterPushToken,
} from '@/services/pushApi';
import { AuthContext, type AuthContextValue } from '@/store/authStore';
import type { User } from '@/types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const pushTokenRef = useRef<string | null>(null);

  // Sessão do back caiu (401 SESSION_INVALID) e o relogin silencioso não
  // rolou: limpa o estado pra o guard de rotas mandar pro login. Não usa
  // logout() — ele chama unregisterPushToken, que também tomaria 401.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      apiLogout().catch(() => {});
      setUser(null);
      setToken(null);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      const enabled = await isPushEnabled();
      setPushEnabled(enabled);
      const session = await readStoredSession();
      if (session) {
        setUser(session.user);
        setToken(session.token);
        if (enabled) registerPush(session.user);
      }
      setLoading(false);
    })();
  }, []);

  // Dispara em background: não deve atrasar login nem tela de sessão restaurada.
  // Retorna o token obtido (ou null se simulador/permissão negada) pra quem
  // chama (ex.: toggle manual) saber se o registro realmente aconteceu.
  async function registerPush(loggedUser: User): Promise<string | null> {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
    const expoPushToken = await registerForPushNotificationsAsync();
    if (!expoPushToken) return null;

    // Mesmo aparelho pode ter ficado com o token da conta anterior ativo no
    // back (ex.: sessão anterior expirou ou app foi fechado sem logout
    // explícito) — desregistra ela antes de registrar a conta atual pra não
    // continuar recebendo push de atendimento de outro usuário.
    const previous = await getLastPushRegistration();
    if (
      previous &&
      (previous.usuario_id !== loggedUser.id || previous.expo_push_token !== expoPushToken)
    ) {
      await unregisterPushToken(
        { id: previous.usuario_id, empresa_id: previous.empresa_id } as User,
        previous.expo_push_token
      );
    }

    pushTokenRef.current = expoPushToken;
    await registerPushToken(loggedUser, expoPushToken, Platform.OS);
    await setLastPushRegistration({
      usuario_id: loggedUser.id,
      empresa_id: loggedUser.empresa_id,
      expo_push_token: expoPushToken,
    });
    return expoPushToken;
  }

  function setSession(nextToken: string, nextUser: User) {
    setToken(nextToken);
    setUser(nextUser);
    if (pushEnabled) registerPush(nextUser);
  }

  async function logout() {
    if (user && pushTokenRef.current) {
      await unregisterPushToken(user, pushTokenRef.current);
      pushTokenRef.current = null;
      await clearLastPushRegistration();
    }
    await apiLogout();
    setUser(null);
    setToken(null);
  }

  // Chamado pelo toggle em Perfil. Liga: pede permissão/token e registra no
  // back. Desliga: cancela o token atual no back (não mexe na permissão do
  // SO, só para de mandar push pra esse usuário/device).
  // Retorna false quando o usuário tentou ligar mas a permissão do SO tá
  // negada (registerPush não consegue token) — tela mostra aviso nesse caso.
  async function togglePushNotifications(): Promise<boolean> {
    const next = !pushEnabled;
    if (next) {
      if (user) {
        const registeredToken = await registerPush(user);
        if (!registeredToken) return false;
      }
    } else if (user) {
      // pushTokenRef pode estar nulo (cold start sem registro concluído ainda);
      // cai no token persistido pra garantir que o back desative de fato.
      const tokenToRemove =
        pushTokenRef.current ?? (await getLastPushRegistration())?.expo_push_token ?? null;
      if (tokenToRemove) {
        await unregisterPushToken(user, tokenToRemove);
        pushTokenRef.current = null;
        await clearLastPushRegistration();
      }
    }
    setPushEnabled(next);
    await setPushEnabledPreference(next);
    return true;
  }

  const value: AuthContextValue = {
    user,
    token,
    loading,
    setSession,
    logout,
    pushEnabled,
    togglePushNotifications,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
