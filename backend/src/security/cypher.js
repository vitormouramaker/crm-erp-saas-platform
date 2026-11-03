const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authContext = require("./auth_context");

// Todas as chaves vem do ambiente. Os valores de desenvolvimento abaixo so
// existem para o projeto subir localmente; em producao a API se recusa a
// iniciar sem os segredos reais.
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function readSecret(name, devFallback, minLength = 32) {
  const value = String(process.env[name] || "").trim();
  if (value.length >= minLength) return value;
  if (IS_PRODUCTION) {
    throw new Error(`${name} deve possuir pelo menos ${minLength} caracteres em producao.`);
  }
  if (value) {
    console.warn(`[security] ${name} curto demais; usando o valor de desenvolvimento.`);
  }
  return devFallback;
}

// Sessao (Bearer) e links publicos (NPS, midia do chat, onboarding, reset).
const sessionSecret = readSecret("SESSION_JWT_SECRET", "dev-only-session-secret-change-me-0000000001");
const publicLinkSecret = readSecret("PUBLIC_LINK_SECRET", "dev-only-public-link-secret-change-me-000002");
// AES-256-CBC para CPF: 32 bytes de chave (64 hex) e 16 bytes de IV (32 hex).
const cpfKeyHex = readSecret("CPF_ENCRYPTION_KEY", "00".repeat(32), 64);
const cpfIvHex = readSecret("CPF_ENCRYPTION_IV", "00".repeat(16), 32);

const sessionIssuer = "orbita-crm-api";
const sessionAudience = "orbita-crm-app";
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 11);

function getSessionSecret() {
  return sessionSecret;
}

function encryptCPF(cpf) {
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(cpfKeyHex, "hex"), Buffer.from(cpfIvHex, "hex"));
  let encrypted = cipher.update(cpf, "utf-8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function decryptCPF(encryptedCPF) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(cpfKeyHex, "hex"), Buffer.from(cpfIvHex, "hex"));
  let decrypted = decipher.update(encryptedCPF, "hex", "utf-8");
  decrypted += decipher.final("utf-8");
  return decrypted;
}

// ---------------------------------------------------------------------------
// Senhas
// O sistema original guardava md5(senha) sem salt. Agora as senhas novas sao
// bcrypt e as antigas (32 hex) continuam aceitas uma ultima vez: no login
// certo o hash e trocado por bcrypt (migracao transparente).
// ---------------------------------------------------------------------------
const LEGACY_MD5_RE = /^[a-f0-9]{32}$/i;

function legacyMd5(value) {
  return crypto.createHash("md5").update(String(value)).digest("hex");
}

function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), BCRYPT_ROUNDS);
}

function isLegacyPasswordHash(stored) {
  return LEGACY_MD5_RE.test(String(stored || ""));
}

function timingSafeEqualText(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Retorna { ok, needsRehash }.
function verifyPassword(plain, stored) {
  const hash = String(stored || "");
  if (!hash || plain === undefined || plain === null) return { ok: false, needsRehash: false };
  if (hash.startsWith("$2")) {
    return { ok: bcrypt.compareSync(String(plain), hash), needsRehash: false };
  }
  if (isLegacyPasswordHash(hash)) {
    const ok = timingSafeEqualText(legacyMd5(plain), hash.toLowerCase());
    return { ok, needsRehash: ok };
  }
  return { ok: false, needsRehash: false };
}

// Mantido por compatibilidade com as chamadas antigas: agora gera bcrypt.
function cripto(data) {
  return hashPassword(data);
}

// ---------------------------------------------------------------------------
// Codigo de redefinicao de senha: 6 digitos aleatorios por pedido, guardados
// apenas como HMAC ligado ao usuario (ver execute_web / usuario_senha_reset).
// ---------------------------------------------------------------------------
function generateResetCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashResetCode(usuarioId, code) {
  return crypto
    .createHmac("sha256", publicLinkSecret)
    .update(`reset:${Number(usuarioId)}:${String(code || "").trim()}`)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Link de "finalizar cadastro" (onboarding apos a compra): JWT assinado, com
// validade e de uso unico. O campo pwv e um resumo do hash de senha atual do
// usuario: quando a senha e definida, o hash muda e o link deixa de valer.
// ---------------------------------------------------------------------------
const ONBOARDING_TTL = process.env.ONBOARDING_LINK_TTL || "7d";

function passwordVersion(senhaHash) {
  return crypto
    .createHmac("sha256", publicLinkSecret)
    .update(`pwv:${String(senhaHash || "")}`)
    .digest("hex")
    .slice(0, 24);
}

function generateOnboardingToken({ empresa_id, email, stripe_customer_id, senha_hash }) {
  return jwt.sign(
    {
      tipo: "stripe_onboarding",
      empresa_id: Number(empresa_id),
      email: String(email || "").trim().toLowerCase(),
      stripe_customer_id: stripe_customer_id || null,
      pwv: passwordVersion(senha_hash),
    },
    publicLinkSecret,
    { expiresIn: ONBOARDING_TTL, audience: "onboarding" }
  );
}

function verifyOnboardingToken(token) {
  try {
    const payload = jwt.verify(String(token || ""), publicLinkSecret, { audience: "onboarding" });
    if (!payload || payload.tipo !== "stripe_onboarding") return null;
    return payload;
  } catch {
    return null;
  }
}

function generateExpirationTimestamp(hours) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return (nowInSeconds + hours * 3600).toString();
}

function geradortokenvideos(token_security_key, video_id) {
  const expiration = generateExpirationTimestamp(3);
  const data = token_security_key + video_id + expiration;
  return crypto.createHash("sha256").update(data).digest("hex");
}

// O corpo das requisicoes chega como { payload: base64url(JSON) }. Isso e so
// codificacao: quem faz a requisicao vem da sessao (Bearer), e os campos de
// identidade abaixo sempre sao sobrescritos pelos da sessao.
function jwtencript(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

// Le o corpo SEM sobrescrever os campos de identidade. Usar so para ids de
// registros-alvo (ex.: o usuario que vai ser editado), sempre conferindo a
// empresa da sessao antes de agir.
function decodeRawPayload(payload) {
  try {
    const rawPayload = String(payload?.payload || "").trim();
    if (!rawPayload) return null;
    return JSON.parse(Buffer.from(rawPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function jwtdecript(payload) {
  try {
    const rawPayload = String(payload?.payload || "").trim();
    if (!rawPayload) return null;
    const decoded = JSON.parse(Buffer.from(rawPayload, "base64url").toString("utf8"));
    const auth = authContext.getAuth();
    if (!auth) return decoded;
    return {
      ...decoded,
      empresa_id: auth.empresa_id,
      usuario_id: auth.usuario_id,
      is_master: auth.is_master,
      permissions: auth.permissions,
      permissoes: auth.permissions,
    };
  } catch (err) {
    if (!IS_PRODUCTION) {
      console.error("Payload invalido:", err.message);
    }
    return null;
  }
}

function generateSessionToken(usuario) {
  return jwt.sign(
    {
      sub: String(usuario.id),
      empresa_id: Number(usuario.empresa_id),
      usuario_id: Number(usuario.id),
      is_master: Boolean(usuario.is_master),
      permissions: Array.isArray(usuario.permissions) ? usuario.permissions : [],
      token_type: "session",
    },
    getSessionSecret(),
    { expiresIn: "12h", issuer: sessionIssuer, audience: sessionAudience }
  );
}

function verifySessionToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getSessionSecret(), {
      issuer: sessionIssuer,
      audience: sessionAudience,
    });
    if (payload?.token_type !== "session") return null;
    const usuarioId = Number(payload.usuario_id || payload.sub);
    const empresaId = Number(payload.empresa_id);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0 || !Number.isInteger(empresaId) || empresaId <= 0) return null;
    return {
      usuario_id: usuarioId,
      empresa_id: empresaId,
      is_master: Boolean(payload.is_master),
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    };
  } catch {
    return null;
  }
}

function generateNpsPublicToken(atendimento_id) {
  return jwt.sign(
    {
      atendimento_id,
      tipo: "nps_public_link",
    },
    publicLinkSecret,
    { expiresIn: "30d" }
  );
}

function decryptNpsPublicToken(token) {
  try {
    const payload = jwt.verify(token, publicLinkSecret);
    if (!payload || payload.tipo !== "nps_public_link") {
      return null;
    }
    return payload;
  } catch (err) {
    console.error("Token NPS invalido ou expirado:", err.message);
    return null;
  }
}

function generateChatMediaPublicToken({
  path_bunny,
  file_name,
}) {
  return jwt.sign(
    {
      p: path_bunny,
      f: file_name,
      t: "cm",
    },
    publicLinkSecret,
    { expiresIn: "30d" }
  );
}

function decryptChatMediaPublicToken(token) {
  try {
    const payload = jwt.verify(token, publicLinkSecret);
    const pathBunny = String(payload?.p || payload?.path_bunny || "").trim();
    const fileName = String(payload?.f || payload?.file_name || "").trim();
    const tokenType = String(payload?.t || payload?.tipo || "").trim();
    if (!payload || (tokenType && tokenType !== "cm" && tokenType !== "chat_media_public_link")) {
      return null;
    }
    if (!pathBunny || !fileName) {
      return null;
    }
    return {
      ...payload,
      path_bunny: pathBunny,
      file_name: fileName,
    };
  } catch (err) {
    console.error("Token de arquivo do chat invalido ou expirado:", err.message);
    return null;
  }
}

module.exports = {
  encryptCPF: encryptCPF,
  decryptCPF: decryptCPF,
  cripto: cripto,
  hashPassword,
  verifyPassword,
  isLegacyPasswordHash,
  timingSafeEqualText,
  generateResetCode,
  hashResetCode,
  generateOnboardingToken,
  verifyOnboardingToken,
  passwordVersion,
  geradortokenvideos: geradortokenvideos,
  generateExpirationTimestamp: generateExpirationTimestamp,
  jwtencript: jwtencript,
  jwtdecript: jwtdecript,
  decodeRawPayload,
  generateSessionToken,
  verifySessionToken,
  generateNpsPublicToken: generateNpsPublicToken,
  decryptNpsPublicToken: decryptNpsPublicToken,
  generateChatMediaPublicToken: generateChatMediaPublicToken,
  decryptChatMediaPublicToken: decryptChatMediaPublicToken,
};
