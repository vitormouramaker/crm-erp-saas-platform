import CryptoJS from 'crypto-js';

// O corpo das requisições vai como JSON em base64url ({ payload }), igual ao
// front web. Isto é só codificação, não segurança: a identidade vem do token
// de sessão (Authorization: Bearer), validado no back. Por isso o app não
// carrega nenhuma chave secreta.

function toBase64Url(wordArray: CryptoJS.lib.WordArray): string {
  const base64 = CryptoJS.enc.Base64.stringify(wordArray);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64UrlJson(segment: string): any {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(CryptoJS.enc.Base64.parse(base64).toString(CryptoJS.enc.Utf8));
}

export function encrypt(payload: Record<string, any>, expiresInSeconds = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
  return toBase64Url(CryptoJS.enc.Utf8.parse(JSON.stringify(fullPayload)));
}

export function decrypt(token: string): any | null {
  try {
    if (!token || token.split('.').length !== 1) {
      return null;
    }
    const payload = decodeBase64UrlJson(token);
    if (payload && payload.exp && Date.now() / 1000 > payload.exp) {
      console.warn('[security] payload expirado');
      return null;
    }
    return payload;
  } catch (err) {
    console.error('[security] erro ao decodificar payload', err);
    return null;
  }
}
