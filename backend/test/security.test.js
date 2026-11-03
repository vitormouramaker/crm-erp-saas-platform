// Testes das funcoes de seguranca (sem banco): node --test test/
const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const security = require("../src/security/cypher");
const { isPrivateAddress } = require("../src/security/outbound_url");

test("senha nova usa bcrypt e confere", () => {
  const hash = security.hashPassword("Demo@123");
  assert.ok(hash.startsWith("$2"));
  assert.deepStrictEqual(security.verifyPassword("Demo@123", hash), { ok: true, needsRehash: false });
  assert.strictEqual(security.verifyPassword("errada", hash).ok, false);
});

test("hash MD5 legado e aceito e pede migracao", () => {
  const md5 = crypto.createHash("md5").update("Demo@123").digest("hex");
  assert.deepStrictEqual(security.verifyPassword("Demo@123", md5), { ok: true, needsRehash: true });
  assert.strictEqual(security.verifyPassword("outra", md5).ok, false);
  assert.strictEqual(security.verifyPassword("Demo@123", "").ok, false);
});

test("codigo de redefinicao e ligado ao usuario", () => {
  const code = security.generateResetCode();
  assert.match(code, /^\d{6}$/);
  assert.notStrictEqual(security.hashResetCode(1, code), security.hashResetCode(2, code));
});

test("token de onboarding e assinado e preso ao hash de senha", () => {
  const token = security.generateOnboardingToken({ empresa_id: 7, email: "A@Example.com", senha_hash: "h1" });
  const payload = security.verifyOnboardingToken(token);
  assert.strictEqual(payload.empresa_id, 7);
  assert.strictEqual(payload.email, "a@example.com");
  assert.strictEqual(payload.pwv, security.passwordVersion("h1"));
  assert.notStrictEqual(payload.pwv, security.passwordVersion("h2"));

  // formato antigo (JSON em base64, sem assinatura) e recusado
  const forged = Buffer.from(JSON.stringify({ tipo: "stripe_onboarding", empresa_id: 7, email: "a@example.com" })).toString("base64url");
  assert.strictEqual(security.verifyOnboardingToken(forged), null);
  // assinatura adulterada
  assert.strictEqual(security.verifyOnboardingToken(token.slice(0, -2) + "xx"), null);
});

test("jwtdecript sobrescreve a identidade com a sessao", async () => {
  const authContext = require("../src/security/auth_context");
  const body = { payload: security.jwtencript({ empresa_id: 99, usuario_id: 99, cliente_id: 5 }) };
  const data = authContext.runWithAuth({ empresa_id: 1, usuario_id: 2, is_master: false, permissions: [] }, () =>
    security.jwtdecript(body)
  );
  assert.strictEqual(data.empresa_id, 1);
  assert.strictEqual(data.usuario_id, 2);
  assert.strictEqual(data.cliente_id, 5);
  assert.strictEqual(security.decodeRawPayload(body).usuario_id, 99);
});

test("webhook de saida bloqueia enderecos internos", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "::1", "fd00::1"]) {
    assert.ok(isPrivateAddress(ip), ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1"]) {
    assert.ok(!isPrivateAddress(ip), ip);
  }
});
