import { createContext, useContext } from 'react';
import type { User } from '@/types';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => Promise<void>;
  pushEnabled: boolean;
  togglePushNotifications: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
