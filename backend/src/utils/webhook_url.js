function normalizeWebhookUrl(url = "") {
  const value = String(url || "").trim().replace(/\/+$/, "");
  if (!value) return "";

  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]";

    if (!isLocal) {
      parsed.protocol = "https:";
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return value;
  }
}

function resolveWebhookBaseUrl(req, configuredUrls = []) {
  const configured = configuredUrls.find((url) => String(url || "").trim());
  if (configured) {
    return normalizeWebhookUrl(configured);
  }

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const protocol = forwardedProto || req.protocol || "https";
  const host = String(req.get("host") || "").trim();
  if (!host) return "";

  return normalizeWebhookUrl(`${protocol}://${host}`);
}

module.exports = {
  normalizeWebhookUrl,
  resolveWebhookBaseUrl,
};
