import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { darkColors, lightColors } from '@/constants/theme/tokens';
import { ThemeContext, type ThemePreference } from '@/store/themeStore';

const STORAGE_KEY = '@orbita/theme-preference';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        setPreferenceState(stored);
      }
    })();
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const colors = useMemo(() => (preference === 'dark' ? darkColors : lightColors), [preference]);

  const value = { colors, scheme: preference, preference, setPreference };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
