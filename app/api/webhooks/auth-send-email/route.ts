import { NextResponse } from "next/server";
import { enforceAuthRateLimit } from "@/lib/api/auth-rate-limit";
import { buildAuthVerifyUrl } from "@/lib/email/auth-mail";
import { authEmailCopy } from "@/lib/email/copy";
import { formatPlatformFrom } from "@/lib/email/from";
import { verifyAuthHookSignature } from "@/lib/email/hook-secret";
import { renderNiagaXEmail } from "@/lib/email/layout";
import { resolvePreferredLocale } from "@/lib/email/resolve-locale";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/marketing/email-resend";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function metadataString(
  meta: unknown,
  key: string,
): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(request: Request) {
  const rl = enforceAuthRateLimit(
    request,
    "auth.send-email-hook",
    30,
    60 * 1000,
  );
  if (!rl.ok) return rl.response;

  const secretRaw = process.env.AUTH_SEND_EMAIL_HOOK_SECRET?.trim() ?? "";
  if (!secretRaw) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const okSig = verifyAuthHookSignature({
    rawBody,
    headers: request.headers,
    secretRaw,
  });
  if (!okSig) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const user = (parsed as { user?: unknown }).user;
  const emailData = (parsed as { email_data?: unknown }).email_data;
  if (!user || typeof user !== "object" || !emailData || typeof emailData !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const email = (user as { email?: unknown }).email;
  const userId = (user as { id?: unknown }).id;
  const action = (emailData as { email_action_type?: unknown }).email_action_type;
  const tokenHash = (emailData as { token_hash?: unknown }).token_hash;
  if (
    typeof email !== "string" ||
    !email ||
    typeof action !== "string" ||
    !action ||
    typeof tokenHash !== "string" ||
    !tokenHash
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const fromRaw = process.env.MARKETING_FROM_EMAIL?.trim() ?? "";
  if (!supabaseUrl) {
    logger.error("auth.email_hook.config", { reason: "missing_supabase_url" });
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }

  const locale =
    typeof userId === "string"
      ? await resolvePreferredLocale(createServiceRoleClient(), userId)
      : "en";

  const meta = (user as { user_metadata?: unknown }).user_metadata;
  const copy = authEmailCopy(action, locale, {
    businessName: metadataString(meta, "business_name"),
    inviterName: metadataString(meta, "inviter_name"),
  });

  const redirectTo =
    typeof (emailData as { redirect_to?: unknown }).redirect_to === "string"
      ? (emailData as { redirect_to: string }).redirect_to
      : "";

  const otp =
    typeof (emailData as { token?: unknown }).token === "string"
      ? (emailData as { token: string }).token
      : "";

  const isOtp = action === "reauthentication";
  const ctaHref = isOtp
    ? undefined
    : buildAuthVerifyUrl({
        supabaseUrl,
        tokenHash,
        emailActionType: action,
        redirectTo,
      });

  const bodyText = isOtp && otp ? `${copy.bodyText}\n\n${otp}` : copy.bodyText;
  const html = renderNiagaXEmail({
    locale,
    brandName: "NiagaX",
    subject: copy.subject,
    heading: copy.heading,
    bodyText,
    ctaLabel: copy.ctaLabel,
    ctaHref,
    footerText: copy.footerText,
  });

  const textPart = [copy.heading, "", bodyText, "", ctaHref ?? otp]
    .filter((line) => line.length > 0)
    .join("\n");

  const result = await sendEmail({
    to: email,
    subject: copy.subject,
    body: textPart,
    html,
    fromEmail: formatPlatformFrom(fromRaw),
    apiKey,
  });

  if (!result.ok) {
    logger.error("auth.email_hook.send_failed", {
      userId: typeof userId === "string" ? userId : "unknown",
      reason: result.reason,
    });
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
