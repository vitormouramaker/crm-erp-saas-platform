const security = require("./cypher");
const authContext = require("./auth_context");

const PUBLIC_ROUTES = [
  /^\/web(?:\/|$)/,
  /^\/meta\/webhook(?:\/|$)/,
  /^\/hotmart\/webhook(?:\/|$)/,
  /^\/hubla\/webhook(?:\/|$)/,
  /^\/pagamento\/webhook\/stripe(?:\/|$)/,
  /^\/integracao\/gestao360(?:\/|$)/,
  // "status" e "configuracao" sao rotas do painel (exigem sessao).
  /^\/webhook\/cliente\/(?!(?:configuracao|status)(?:\/|$))[^/]+(?:\/usuarios|\/utm_url)?$/,
  /^\/webhook\/n8n\//,
  // NPS publico so com o link assinado (/:token). As versoes sem token, que
  // aceitavam um atendimento_id qualquer, ficam restritas a sessao.
  /^\/nps\/questionario\/[^/]+$/,
  /^\/nps\/responder\/[^/]+$/,
  /^\/atendimento\/download(?:_external)?\//,
  /^\/atendimento\/meta_referral_media\//,
];

function isPublicRequest(req) {
  if (req.method === "OPTIONS") return true;
  return PUBLIC_ROUTES.some((pattern) => pattern.test(req.path));
}

function getBearerToken(req) {
  const authorization = String(req.headers.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function sessionAuth(req, res, next) {
  if (isPublicRequest(req)) return next();

  const token = getBearerToken(req);
  const auth = security.verifySessionToken(token);
  if (!auth) {
    return res.status(401).json({
      boleano: false,
      obj: {},
      mensagem: "Sessao invalida ou expirada.",
      code: "SESSION_INVALID",
    });
  }

  req.auth = auth;
  return authContext.runWithAuth(auth, next);
}

module.exports = sessionAuth;
