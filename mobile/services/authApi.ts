// services/authApi.ts
import * as SecureStore from 'expo-secure-store';
import { encrypt, decrypt } from './security';
import { API_BASE, postEncrypted, setSessionRecovery, setSessionToken } from './apiClient';

const AUTH_TOKEN_KEY = 'authToken';
const SESSION_TOKEN_KEY = 'sessionToken';
const AUTH_CREDENTIALS_KEY = 'authCredentials';
const AUTH_KEEP_SESSION_KEY = 'authKeepSession';

async function saveCredentials(email: string, senha: string) {
  await SecureStore.setItemAsync(AUTH_CREDENTIALS_KEY, JSON.stringify({ email, senha }));
}

export async function loadCredentials(): Promise<{ email: string; senha: string } | null> {
  const raw = await SecureStore.getItemAsync(AUTH_CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function clearCredentials() {
  await SecureStore.deleteItemAsync(AUTH_CREDENTIALS_KEY);
}

async function setKeepSession(keep: boolean) {
  if (keep) {
    await SecureStore.setItemAsync(AUTH_KEEP_SESSION_KEY, '1');
  } else {
    await SecureStore.deleteItemAsync(AUTH_KEEP_SESSION_KEY);
  }
}

async function getKeepSession(): Promise<boolean> {
  return (await SecureStore.getItemAsync(AUTH_KEEP_SESSION_KEY)) === '1';
}

function normalizeUser(u: any) {
  const rawIsMaster = u?.is_master;
  const rawPdv = u?.pdv;
  return {
    ...u,
    is_master: rawIsMaster === true || rawIsMaster === 1 || rawIsMaster === '1',
    pdv: rawPdv === true || rawPdv === 1 || rawPdv === '1',
    name: u?.name ?? u?.nome ?? 'Usuario',
  };
}

export async function login(email: string, senha: string, remember = false) {
  try {
    const encrypted = encrypt({ user: email, pass: senha });

    const response = await fetch(`${API_BASE}/web/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: encrypted }),
    });

    const data = await response.json();
    const resp = decrypt(data.payload);

    if (!resp?.boleano) {
      return { success: false, message: resp?.mensagem || 'Email ou senha incorretos.' };
    }

    const sessionToken = response.headers.get('X-Session-Token');
    if (!sessionToken) {
      return { success: false, message: 'Servidor desatualizado. Tente novamente mais tarde.' };
    }

    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.payload);
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken);
    setSessionToken(sessionToken);
    if (remember) {
      await saveCredentials(email, senha);
      await setKeepSession(true);
    } else {
      await clearCredentials();
      await setKeepSession(false);
    }
    return { success: true, message: '', user: normalizeUser(resp.obj), token: data.payload as string };
  } catch (error) {
    console.log('[authApi] erro no login', error);
    return { success: false, message: 'Não foi possível conectar ao servidor.' };
  }
}

export async function getSessionUserFromToken(token: string) {
  const decoded = decrypt(token);
  if (!decoded?.boleano || !decoded.obj) return null;
  return normalizeUser(decoded.obj);
}

export async function readStoredSession() {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  const sessionToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  // Sem sessionToken (ex.: sessão salva por versão anterior do app) o token
  // antigo não autentica mais nada no back — cai pro relogin silencioso.
  if (token && sessionToken) {
    const user = await getSessionUserFromToken(token);
    if (user) {
      setSessionToken(sessionToken);
      return { token, user };
    }
  }
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);

  // Token ausente/expirado: se a sessão automática estava ativa (checkbox
  // marcado e nenhum logout explícito depois), tenta relogar silenciosamente
  // com as credenciais guardadas em vez de forçar a tela de login.
  const keepSession = await getKeepSession();
  if (!keepSession) return null;

  const credentials = await loadCredentials();
  if (!credentials) return null;

  const result = await login(credentials.email, credentials.senha, true);
  if (!result.success || !result.token || !result.user) {
    await clearCredentials();
    await setKeepSession(false);
    return null;
  }
  return { token: result.token, user: result.user };
}

// Chamado pelo apiClient quando uma requisição toma 401 SESSION_INVALID
// (JWT de 12h expirou ou back foi reimplantado com outro segredo): relogin
// silencioso com as credenciais guardadas, só se a sessão automática estiver ativa.
setSessionRecovery(async () => {
  if (!(await getKeepSession())) return false;
  const credentials = await loadCredentials();
  if (!credentials) return false;
  const result = await login(credentials.email, credentials.senha, true);
  return result.success;
});

export async function logout() {
  setSessionToken(null);
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  // Mantém a credencial salva pra pré-preencher a tela de login, mas desliga
  // a sessão automática — logout explícito não deve relogar sozinho.
  await setKeepSession(false);
}

// Conta excluída: além do logout, descarta a credencial guardada pra não
// pré-preencher/relogar uma conta que não existe mais.
export async function purgeStoredCredentials() {
  await clearCredentials();
  await setKeepSession(false);
}

export async function forgotPassword(email: string) {
  try {
    const { message } = await postEncrypted('/web', '/forgot_pass', { email });
    return { success: true, message };
  } catch (error: any) {
    console.log('[authApi] erro no forgot_pass', error);
    return { success: false, message: error?.message || 'Não foi possível conectar ao servidor.' };
  }
}

export async function resetPassword(email: string, codigo: string, senha: string) {
  try {
    const { message } = await postEncrypted('/web', '/new_pass', { email, codigo, senha });
    return { success: true, message };
  } catch (error: any) {
    console.log('[authApi] erro no new_pass', error);
    return { success: false, message: error?.message || 'Não foi possível conectar ao servidor.' };
  }
}