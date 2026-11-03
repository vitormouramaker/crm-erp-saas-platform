// Rate limit simples em memoria, por IP e por rota. Suficiente para uma
// instancia; com varias instancias atras de um balanceador, troque por um
// armazenamento compartilhado (Redis) ou pelo limite do proprio proxy.
function rateLimit({ windowMs = 15 * 60 * 1000, max = 20, name = "default" } = {}) {
  const hits = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, Math.min(windowMs, 60 * 1000));
  if (typeof cleanup.unref === "function") cleanup.unref();

  return function rateLimitMiddleware(req, res, next) {
    const key = `${name}:${req.ip || req.socket?.remoteAddress || "unknown"}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({
        boleano: false,
        obj: {},
        mensagem: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
      });
    }
    return next();
  };
}

module.exports = { rateLimit };
