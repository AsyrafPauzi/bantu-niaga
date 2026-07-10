/**
 * Email verification gate — off by default until transactional email (Resend /
 * Supabase SMTP) is configured. Set AUTH_REQUIRE_EMAIL_VERIFICATION=true to enforce.
 */
export function isEmailVerificationRequired(): boolean {
  return process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true";
}

export function isEmailVerified(
  user: { email_confirmed_at?: string | null } | null | undefined,
): boolean {
  if (!isEmailVerificationRequired()) return true;
  return Boolean(user?.email_confirmed_at);
}
