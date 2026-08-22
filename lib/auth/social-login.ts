/**
 * Social login helpers (Google via Supabase Auth).
 * Enterprise SSO (SAML/OIDC per-tenant) is intentionally out of scope.
 */

const DEFAULT_NEXT = "/home";

/** Block open redirects and auth-loop paths. */
export function sanitizeAuthNextPath(
  raw: string | null | undefined,
): string {
  if (!raw || typeof raw !== "string") return DEFAULT_NEXT;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DEFAULT_NEXT;
  }
  if (
    trimmed.startsWith("/sign-in") ||
    trimmed.startsWith("/sign-up") ||
    trimmed.startsWith("/auth/callback")
  ) {
    return DEFAULT_NEXT;
  }
  return trimmed;
}

/** Browser-only: OAuth return URL for Supabase `redirectTo`. */
export function buildOAuthCallbackUrl(nextPath: string): string {
  if (typeof window === "undefined") {
    throw new Error("buildOAuthCallbackUrl must run in the browser.");
  }
  const next = sanitizeAuthNextPath(nextPath);
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export type SocialOAuthProvider = "google";

export function socialAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "missing_code":
      return "That invite or sign-in link could not be completed. Open the latest email link again, or sign in with your email and password.";
    case "no_account":
      return "No NiagaX account exists for this Google email. Start a trial or ask your manager for an invite.";
    case "oauth_cancelled":
      return "Google sign-in was cancelled. Try again when you're ready.";
    case "email_taken":
      return "That Google email already belongs to a NiagaX account. Sign in with the original method.";
    default:
      return code.length > 120
        ? "Google sign-in could not be completed. Try email sign-in instead."
        : `Google sign-in could not be completed: ${code}`;
  }
}
