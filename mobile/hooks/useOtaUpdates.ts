import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

// Checa OTA (EAS Update) em background: uma vez no boot e a cada vez que o app
// volta do background. Sem UI: se achar update, baixa e deixa pendente — aplica
// sozinho no próximo cold start, nunca dá reload no meio do uso.
// Erros são engolidos: OTA jamais pode travar o app.
// No-op em dev client / Expo Go / build sem updates (Updates.isEnabled === false).
async function checkForOtaUpdate() {
  try {
    if (__DEV__ || !Updates.isEnabled) return;

    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;

    await Updates.fetchUpdateAsync();
    console.log('[ota] update baixado, aplica no proximo cold start');
  } catch (error) {
    console.log('[ota] erro ao checar update:', error);
  }
}

// Monta uma única vez na raiz do app (app/_layout.tsx).
export function useOtaUpdates() {
  useEffect(() => {
    checkForOtaUpdate();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkForOtaUpdate();
    });
    return () => subscription.remove();
  }, []);
}
