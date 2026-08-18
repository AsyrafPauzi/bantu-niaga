import "server-only";

import {
  sendEmail,
  type SendEmailResult,
} from "@/lib/marketing/email-resend";
import { isConsentGranted } from "@/lib/privacy/consent";
import type { ConsentKind } from "@/lib/privacy/types";

export type PlatformEmailCategory = "marketing" | "product_updates";

const CATEGORY_CONSENT: Record<PlatformEmailCategory, ConsentKind> = {
  marketing: "marketing_email",
  product_updates: "product_updates",
};

export type PlatformEmailDenied = {
  ok: false;
  reason: "consent_denied";
  consentKind: ConsentKind;
};

export type PlatformEmailResult = SendEmailResult | PlatformEmailDenied;

/**
 * Send a platform-owned email (not a tenant marketing broadcast) only when
 * the recipient user has granted the matching consent kind.
 */
export async function sendPlatformEmail(input: {
  userId: string;
  category: PlatformEmailCategory;
  to: string;
  subject: string;
  body: string;
  html?: string;
  fromEmail: string;
  apiKey: string;
}): Promise<PlatformEmailResult> {
  const consentKind = CATEGORY_CONSENT[input.category];
  const allowed = await isConsentGranted(input.userId, consentKind);
  if (!allowed) {
    return { ok: false, reason: "consent_denied", consentKind };
  }

  return sendEmail({
    to: input.to,
    subject: input.subject,
    body: input.body,
    html: input.html,
    fromEmail: input.fromEmail,
    apiKey: input.apiKey,
  });
}
