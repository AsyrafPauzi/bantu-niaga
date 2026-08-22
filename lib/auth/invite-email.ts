/**
 * When true, team invites prefer Supabase Auth email (inviteUserByEmail)
 * instead of the local "copy this join link" bypass.
 *
 * Requires Supabase Dashboard → Authentication → SMTP / Send Email hook
 * to actually deliver mail in production.
 */
export function isSupabaseInviteEmailEnabled(): boolean {
  const raw = process.env.SUPABASE_INVITE_EMAIL_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Resend HTTP credentials used by the app (not Supabase SMTP). */
export function hasAppResendConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.MARKETING_FROM_EMAIL?.trim(),
  );
}

/**
 * Local apps never receive Supabase Send Email hooks (webhook URL is public HTTPS).
 * When true, the invite API sends the join link via Resend after creating the Auth user.
 */
export function shouldDeliverInviteViaAppResend(siteUrl?: string): boolean {
  const override = process.env.TEAM_INVITE_APP_RESEND?.trim().toLowerCase();
  if (override === "true" || override === "1" || override === "yes") return true;
  if (override === "false" || override === "0" || override === "no") return false;
  const url =
    siteUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  return /localhost|127\.0\.0\.1/i.test(url);
}
