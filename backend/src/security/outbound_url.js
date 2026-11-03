const dns = require("dns").promises;
const net = require("net");

// Bloqueia webhooks de saida para enderecos internos (SSRF): loopback, redes
// privadas, link-local (inclui o metadata de nuvem 169.254.169.254) e afins.
// Para testar com um receptor local, ligue DEVELOPER_WEBHOOKS_ALLOW_PRIVATE=true.
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return (
    v6 === "::" || v6 === "::1" ||
    v6.startsWith("fc") || v6.startsWith("fd") ||
    v6.startsWith("fe80") || v6.startsWith("ff")
  );
}

async function assertPublicHttpUrl(rawUrl) {
  const url = new URL(String(rawUrl || ""));
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("A URL do webhook deve usar http ou https.");
  }
  if (String(process.env.DEVELOPER_WEBHOOKS_ALLOW_PRIVATE || "").toLowerCase() === "true") {
    return url;
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host)
    ? [{ address: host }]
    : await dns.lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("A URL do webhook aponta para um endereco interno e foi bloqueada.");
  }
  return url;
}

module.exports = { assertPublicHttpUrl, isPrivateAddress };
