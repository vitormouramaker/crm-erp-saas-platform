import * as SecureStore from 'expo-secure-store';
import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export type PushPlatform = 'ios' | 'android';

type PushRegistration = {
  usuario_id: number;
  empresa_id?: number;
  expo_push_token: string;
};

const LAST_PUSH_REGISTRATION_KEY = 'lastPushRegistration';
const PUSH_ENABLED_KEY = 'pushNotificationsEnabled';

// Preferência local (por device) de receber ou não push, independente da
// permissão do SO. Ausência da chave = habilitado (default pra quem já usava
// o app antes dessa preferência existir).
export async function isPushEnabled(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(PUSH_ENABLED_KEY);
    return raw !== 'false';
  } catch (error) {
    console.log('[pushApi] erro ao ler preferencia de push', error);
    return true;
  }
}

export async function setPushEnabledPreference(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(PUSH_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.log('[pushApi] erro ao salvar preferencia de push', error);
  }
}

// Marca qual conta está registrada pro push token deste aparelho. Como o
// token é do device (não da conta), é o que permite detectar troca de
// usuário no mesmo aparelho e desregistrar a conta anterior antes de
// registrar a nova — sem isso, o device continua recebendo push de
// atendimentos da conta antiga mesmo depois de logar com outro usuário.
export async function getLastPushRegistration(): Promise<PushRegistration | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_PUSH_REGISTRATION_KEY);
    return raw ? (JSON.parse(raw) as PushRegistration) : null;
  } catch (error) {
    console.log('[pushApi] erro ao ler ultimo registro de push', error);
    return null;
  }
}

export async function setLastPushRegistration(entry: PushRegistration): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_PUSH_REGISTRATION_KEY, JSON.stringify(entry));
  } catch (error) {
    console.log('[pushApi] erro ao salvar ultimo registro de push', error);
  }
}

export async function clearLastPushRegistration(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LAST_PUSH_REGISTRATION_KEY);
  } catch (error) {
    console.log('[pushApi] erro ao limpar ultimo registro de push', error);
  }
}

// Chamadas silenciosamente ignoram falha pra não travar login/logout
// caso a rede ou o back fiquem indisponíveis.
export async function registerPushToken(
  user: User,
  expoPushToken: string,
  platform: PushPlatform,
  deviceId?: string
): Promise<void> {
  try {
    // Campos duplicados fora do JWT: rota /push/register no back lê
    // expo_push_token/platform/device_id direto de req.body (bug lá),
    // em vez do payload decriptado. Workaround só no front até corrigir lá.
    const fields = {
      usuario_id: user.id,
      empresa_id: user.empresa_id,
      expo_push_token: expoPushToken,
      platform,
      device_id: deviceId,
    };
    const result = await postEncrypted('/push', '/register', fields, fields);
    console.log('[push][debug] back respondeu ao registrar token:', result);
  } catch (error) {
    console.log('[pushApi] erro ao registrar push token', error);
  }
}

export async function unregisterPushToken(user: User, expoPushToken: string): Promise<void> {
  try {
    const fields = {
      usuario_id: user.id,
      empresa_id: user.empresa_id,
      expo_push_token: expoPushToken,
    };
    // Rota /push/unregister no back é DELETE, não POST. Mesmo padrão do
    // /register: expo_push_token/usuario_id/empresa_id vão também como campos
    // planos fora do payload criptografado.
    await postEncrypted('/push', '/unregister', fields, fields, 'DELETE');
  } catch (error) {
    console.log('[pushApi] erro ao remover push token', error);
  }
}
