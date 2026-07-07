/**
 * Canonical public site URL for auth email links (invite, recovery, etc.).
 */
export function getSiteUrl(fallbackOrigin?: string | null): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, "");
  return "http://localhost:3000";
}

export function authCallbackUrl(
  nextPath: string,
  fallbackOrigin?: string | null,
): string {
  const site = getSiteUrl(fallbackOrigin);
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `${site}/auth/callback?next=${encodeURIComponent(next)}`;
}
