import { encrypt, decrypt } from './security';

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4444';

// Token de sessão (JWT de 12h) devolvido pelo back no header `X-Session-Token`
// do /web/login. Todas as rotas fora da lista pública do back exigem
// `Authorization: Bearer <token>`; sem ele o back responde 401 SESSION_INVALID.
let sessionToken: string | null = null;
let recoverSession: (() => Promise<boolean>) | null = null;
let onSessionExpired: (() => void) | null = null;
let recovering: Promise<boolean> | null = null;

export function setSessionToken(token: string | null) {
  sessionToken = token;
}

export function getSessionToken() {
  return sessionToken;
}

// authApi registra o relogin silencioso (credenciais salvas); AuthProvider
// registra o que fazer quando não dá pra recuperar (voltar ao login).
export function setSessionRecovery(handler: (() => Promise<boolean>) | null) {
  recoverSession = handler;
}

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

async function isSessionInvalid(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const body = await response.clone().json();
    return body?.code === 'SESSION_INVALID';
  } catch {
    return true;
  }
}

async function tryRecover(): Promise<boolean> {
  if (!recoverSession) return false;
  // Várias requisições podem tomar 401 ao mesmo tempo: um único relogin.
  if (!recovering) {
    recovering = recoverSession()
      .catch(() => false)
      .finally(() => {
        recovering = null;
      });
  }
  return recovering;
}

function withAuth(init: RequestInit): RequestInit {
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) || {}) };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  return { ...init, headers };
}

// fetch autenticado. Em 401 SESSION_INVALID tenta relogar uma vez e repete a
// requisição; se não der, avisa o AuthProvider pra derrubar a sessão.
// Atenção: o body é reenviado no retry — FormData com `uri` de arquivo é ok.
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, withAuth(init));
  if (!(await isSessionInvalid(response))) return response;

  if (await tryRecover()) {
    const retry = await fetch(url, withAuth(init));
    if (!(await isSessionInvalid(retry))) return retry;
  }
  onSessionExpired?.();
  throw new Error('Sessão expirada. Entre novamente.');
}

export async function postEncrypted<T = any>(
  basePath: string,
  endpoint: string,
  payload: Record<string, unknown>,
  extraPlainFields?: Record<string, unknown>,
  method: 'POST' | 'DELETE' | 'PUT' | 'PATCH' = 'POST'
): Promise<{ obj: T; message: string }> {
  const encrypted = encrypt(payload);

  const response = await authFetch(`${API_BASE}${basePath}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    body: JSON.stringify({ payload: encrypted, ...extraPlainFields }),
  });

  const responseData = await response.json();
  const decrypted = decrypt(responseData.payload);

  if (!decrypted?.boleano) {
    throw new Error(decrypted?.mensagem || decrypted?.msg || 'Não foi possível concluir a operação.');
  }

  return { obj: decrypted.obj as T, message: decrypted.mensagem || '' };
}

export interface RNFile {
  uri: string;
  name: string;
  type: string;
}

export async function postEncryptedMultipart<T = any>(
  basePath: string,
  endpoint: string,
  payload: Record<string, unknown>,
  files: Record<string, RNFile | undefined>
): Promise<{ obj: T; message: string }> {
  const encrypted = encrypt(payload);

  const form = new FormData();
  form.append('payload', encrypted);
  for (const [field, file] of Object.entries(files)) {
    if (!file) continue;
    form.append(field, file as unknown as Blob);
  }

  const response = await authFetch(`${API_BASE}${basePath}${endpoint}`, {
    method: 'POST',
    headers: { 'ngrok-skip-browser-warning': 'true' },
    body: form,
  });

  const responseData = await response.json();
  const decrypted = decrypt(responseData.payload);

  if (!decrypted?.boleano) {
    throw new Error(decrypted?.mensagem || decrypted?.msg || 'Não foi possível concluir a operação.');
  }

  return { obj: decrypted.obj as T, message: decrypted.mensagem || '' };
}
