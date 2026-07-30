import DOMPurify from "isomorphic-dompurify";

const TASK_DESCRIPTION_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "h3",
  "blockquote",
] as const;

/** Strip unsafe HTML before storing or rendering task descriptions. */
export function sanitizeTaskDescription(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";

  const clean = DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [...TASK_DESCRIPTION_ALLOWED_TAGS],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });

  const normalized = clean
    .replace(/<p><br><\/p>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .trim();

  return normalized;
}

export function plainTextFromTaskDescription(html: string | null): string {
  if (!html) return "";
  const clean = sanitizeTaskDescription(html);
  if (!clean) return "";
  return clean
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEmptyTaskDescription(html: string | null | undefined): boolean {
  if (!html) return true;
  return plainTextFromTaskDescription(html).length === 0;
}
