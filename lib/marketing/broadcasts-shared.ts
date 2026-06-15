/**
 * Bantu Niaga — Marketing v1.1 broadcasts SHARED helpers.
 *
 * Pure, client-safe. No `server-only` directive — both the server
 * (API routes, server components) and the client (composer, recipient
 * row preview) import from this file.
 *
 * Server-only helpers (resolveRecipients, sendEmailBatch) live in
 * `lib/marketing/broadcasts.ts` which guards with `server-only`.
 *
 * Spec: docs/superpowers/specs/2026-06-15-marketing-segments-broadcasts-coupons-design.md §4, §8.
 */

// ─────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────

export type BroadcastChannel = "whatsapp_ctc" | "email";

export type BroadcastStatus =
  | "draft"
  | "sending"
  | "sent"
  | "failed"
  | "partially_sent";

export interface BroadcastRow {
  id: string;
  business_id: string;
  name: string;
  channel: BroadcastChannel;
  segment_id: string;
  subject: string | null;
  message_template: string;
  coupon_id: string | null;
  status: BroadcastStatus;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BroadcastRecipientRow {
  id: string;
  broadcast_id: string;
  customer_id: string;
  channel_address: string;
  rendered_message: string;
  rendered_subject: string | null;
  status: "queued" | "sent" | "failed" | "opened";
  error: string | null;
  sent_at: string | null;
  opened_at: string | null;
}

/**
 * Shape of the customer record consumed by `renderTemplate`. Kept
 * intentionally narrow so callers can synthesize one from any data
 * source (resolveSegmentMembers row, raw DB row, test fixture).
 */
export interface RenderCustomer {
  name: string;
  phone_e164?: string | null;
  email?: string | null;
}

export interface RenderCoupon {
  code: string;
}

// ─────────────────────────────────────────────────────────────────────────
// renderTemplate
// ─────────────────────────────────────────────────────────────────────────

const FIRST_NAME_RE = /\s+/;

/**
 * Replace `{name}`, `{first_name}`, `{coupon_code}` placeholders in
 * the template. Missing fields → empty string.
 *
 * No HTML / WhatsApp escaping — the channels we support in v1.1 both
 * take plain text. The composer is responsible for warning the
 * operator if they paste something dangerous.
 */
export function renderTemplate(
  template: string,
  customer: RenderCustomer,
  coupon?: RenderCoupon | null,
): string {
  const name = customer.name ?? "";
  const firstName = name.split(FIRST_NAME_RE)[0] ?? "";
  const couponCode = coupon?.code ?? "";

  return template
    .replaceAll("{first_name}", firstName)
    .replaceAll("{name}", name)
    .replaceAll("{coupon_code}", couponCode);
}

// ─────────────────────────────────────────────────────────────────────────
// buildCtcUrl
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build a WhatsApp click-to-chat URL.
 *
 * Drops the leading `+` on the phone (wa.me expects digits only) and
 * URL-encodes the prefilled message. Pure function — does no
 * validation other than the leading-plus strip.
 */
export function buildCtcUrl(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/^\+/, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
