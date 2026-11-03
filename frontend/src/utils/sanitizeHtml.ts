import DOMPurify from "dompurify";

export function sanitizeUserHtml(value?: string | null) {
  return DOMPurify.sanitize(String(value || ""), {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}
