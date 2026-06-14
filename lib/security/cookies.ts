/**
 * Bantu Niaga — central cookie-flag policy.
 *
 * Every server-issued cookie should be built through one of these
 * helpers so we never accidentally ship one without `httpOnly` /
 * `secure` / `sameSite` set correctly.
 *
 *   - Session-shaped cookies (impersonation, oauth state) → `httpOnly`,
 *     `secure` in prod, `sameSite: lax` so they survive the OAuth
 *     302-redirect dance.
 *   - Client-visible UI cookies (locale, theme) → not `httpOnly`,
 *     same secure / sameSite rules. (None today; add here when needed.)
 *
 * `__Host-` prefix considered. Skipped for now because the impersonation
 * cookie needs `path: /` and we'd want to add CSRF tokens via a
 * `__Host-csrf` cookie in a follow-up.
 */

interface SecureCookieInput {
  name: string;
  value: string;
  /** TTL in seconds. Default: session cookie (no maxAge). */
  maxAge?: number;
  /** Default: "/". Override only when you need a narrower scope. */
  path?: string;
  /** Default: "lax". Use "strict" for highly sensitive cookies. */
  sameSite?: "lax" | "strict" | "none";
}

export interface SecureCookieAttributes {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge?: number;
}

/** Build the attribute bag for a server-only, secure cookie. */
export function secureCookie(
  input: SecureCookieInput,
): SecureCookieAttributes {
  return {
    name: input.name,
    value: input.value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: input.sameSite ?? "lax",
    path: input.path ?? "/",
    maxAge: input.maxAge,
  };
}

/** Build a clear-the-cookie attribute bag. */
export function clearedCookie(
  name: string,
  path = "/",
): SecureCookieAttributes {
  return {
    name,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path,
    maxAge: 0,
  };
}
