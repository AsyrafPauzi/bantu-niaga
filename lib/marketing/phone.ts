/**
 * Phone normalization to E.164 with a Malaysia (+60) default.
 *
 * Decisions doc Q6: accept any valid E.164. Default `+60` is added when
 * the input is unprefixed and starts with `0`. Foreign numbers are
 * accepted as-is when prefixed. No `international` auto-tag in v1.
 *
 * Returns `null` for empty / unparseable input. The caller decides
 * whether `null` is acceptable (CSV import rejects; manual add allows).
 */

const E164_PATTERN = /^\+\d{8,15}$/;

export function normalizeMyPhone(input: string | null | undefined): string | null {
  if (input == null) return null;

  const stripped = input
    .replace(/[\s\-().]/g, "")
    .trim();

  if (stripped.length === 0) return null;

  let candidate: string;

  if (stripped.startsWith("+")) {
    candidate = stripped;
  } else if (/^60\d+$/.test(stripped)) {
    // e.g. 60123456789 → +60123456789
    candidate = `+${stripped}`;
  } else if (/^0\d{8,10}$/.test(stripped)) {
    // Local Malaysian format e.g. 0123456789 → +60123456789
    // 9–11 digits total covers both mobile (10 digits) and 9-digit fixed lines.
    candidate = `+60${stripped.slice(1)}`;
  } else {
    return null;
  }

  if (!E164_PATTERN.test(candidate)) return null;
  return candidate;
}
