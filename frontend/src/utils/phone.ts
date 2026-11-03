const DEFAULT_COUNTRY_CODE = "55";

export function normalizePhoneForWhatsApp(value?: string | null): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  const normalized = digits.startsWith("00") ? digits.slice(2) : digits;
  if (!normalized) return "";

  const withCountryCode =
    normalized.length <= 11 && !normalized.startsWith(DEFAULT_COUNTRY_CODE)
      ? `${DEFAULT_COUNTRY_CODE}${normalized}`
      : normalized;

  if (
    withCountryCode.startsWith(DEFAULT_COUNTRY_CODE) &&
    withCountryCode.length === 13 &&
    withCountryCode.slice(2, 4).length === 2 &&
    withCountryCode[4] === "9"
  ) {
    return `${DEFAULT_COUNTRY_CODE}${withCountryCode.slice(2, 4)}${withCountryCode.slice(5)}`;
  }

  return withCountryCode;
}

export function formatPhoneForInput(value?: string | null): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  const normalized = digits.startsWith("00") ? digits.slice(2) : digits;
  if (
    normalized.startsWith(DEFAULT_COUNTRY_CODE) &&
    (normalized.length === 12 || normalized.length === 13)
  ) {
    return normalized.slice(DEFAULT_COUNTRY_CODE.length);
  }

  if (normalized.length <= 11) {
    return normalized;
  }

  return normalized;
}
