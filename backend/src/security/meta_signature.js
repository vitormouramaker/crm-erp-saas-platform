const crypto = require("crypto");

// Confere o cabecalho X-Hub-Signature-256 que a Meta manda nos webhooks
// (HMAC-SHA256 do corpo cru com o App Secret). O original nao conferia: quem
// soubesse o phone_number_id de uma empresa injetava mensagens nela.
//
// Sem META_APP_SECRET: em producao tudo e recusado; fora de producao o aviso
// e aceito (para testar localmente com payloads de exemplo).
function verifyMetaWebhookSignature(req) {
  const secret = String(process.env.META_APP_SECRET || "").trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const header = String(req.get("x-hub-signature-256") || "");
  const match = /^sha256=([a-f0-9]{64})$/i.exec(header);
  if (!match || !Buffer.isBuffer(req.rawBody)) return false;
  const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest();
  const received = Buffer.from(match[1], "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

module.exports = { verifyMetaWebhookSignature };
