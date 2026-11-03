import * as SecureStore from 'expo-secure-store';

import { TERMS_VERSION } from '@/constants/legal';

const TERMS_ACCEPTED_KEY = 'termsAcceptedVersion';

// Por enquanto o aceite fica só no aparelho. Quando o back tiver o campo,
// enviar `TERMS_VERSION` + data junto do login e tratar a resposta aqui.
export async function hasAcceptedCurrentTerms(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(TERMS_ACCEPTED_KEY)) === TERMS_VERSION;
  } catch {
    return false;
  }
}

export async function saveTermsAcceptance(): Promise<void> {
  try {
    await SecureStore.setItemAsync(TERMS_ACCEPTED_KEY, TERMS_VERSION);
  } catch (error) {
    console.log('[terms] erro ao salvar aceite', error);
  }
}
