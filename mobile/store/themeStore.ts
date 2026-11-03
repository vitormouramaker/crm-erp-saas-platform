import { createContext, useContext } from 'react';
import type { ThemeColors } from '@/constants/theme/tokens';

export type ThemePreference = 'light' | 'dark';
export type ResolvedScheme = ThemePreference;

export interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ResolvedScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within AppThemeProvider');
  return ctx;
}
