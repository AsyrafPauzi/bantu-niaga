/**
 * Bantu Niaga — Marketing v1.1 broadcasts SERVER-ONLY helpers.
 *
 * Server-only: do NOT import from client components. Pure helpers
 * (renderTemplate, buildCtcUrl, shared types) live in
 * `lib/marketing/broadcasts-shared.ts` and are safe to import from
 * either context — this file re-exports them so server callers have
 * a single import surface.
 *
 * Exports added here (server-only):
 *   - resolveRecipients({...}) — resolves a segment to send-ready
 *     recipient records, filtering out customers without a usable
 *     channel address. Reuses `lib/marketing/segments.resolveSegmentMembers`.
 *   - sendEmailBatch — re-exported from `lib/marketing/email-resend`
 *     for ergonomic single-import in the /send route.
 *
 * Spec: docs/superpowers/specs/2026-06-15-marketing-segments-broadcasts-coupons-design.md §4, §8.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSegmentMembers } from "@/lib/marketing/segments";
import {
  sendEmailBatch as resendSendEmailBatch,
  type SendEmailBatchResult,
  type BatchRecipient,
} from "@/lib/marketing/email-resend";
import type { BroadcastChannel } from "@/lib/marketing/broadcasts-shared";

// Re-export everything from the shared module so server callers keep
// a single import surface.
export {
  renderTemplate,
  buildCtcUrl,
  type BroadcastChannel,
  type BroadcastStatus,
  type BroadcastRow,
  type BroadcastRecipientRow,
  type RenderCustomer,
  type RenderCoupon,
} from "@/lib/marketing/broadcasts-shared";

// ─────────────────────────────────────────────────────────────────────────
// resolveRecipients
// ─────────────────────────────────────────────────────────────────────────

export interface ResolveRecipientsInput {
  supabase: SupabaseClient;
  businessId: string;
  segmentId: string;
  channel: BroadcastChannel;
}

export interface ResolvedRecipient {
  customer_id: string;
  name: string;
  /** Phone (whatsapp_ctc) or email (email). Always non-empty. */
  channel_address: string;
}

/**
 * Resolve the customers in a segment to send-ready recipients for the
 * given channel. Filters out customers without a usable channel
 * address (no phone for whatsapp_ctc, no email for email).
 *
 * Walks the segment's members in pages of up to 200 (the
 * resolveSegmentMembers max) and concatenates the result. v1.1 caps
 * broadcast size at the segment's member count; we don't paginate the
 * send itself.
 */
export async function resolveRecipients(
  input: ResolveRecipientsInput,
): Promise<ResolvedRecipient[]> {
  const out: ResolvedRecipient[] = [];
  let cursor: string | null = null;
  // Hard ceiling so a buggy resolver can't spin forever. Resend free
  // tier is 3,000/month; v1.1 sends one batch per click.
  const HARD_LIMIT = 5_000;
  let safety = 0;

  while (safety < 100) {
    safety += 1;
    const page = await resolveSegmentMembers(input.supabase, input.segmentId, {
      limit: 200,
      cursor,
    });
    // Sanity-check the segment's business matches the caller's. The
    // RLS layer already enforces this, but a service-role caller
    // could otherwise wander out of tenancy.
    if (page.businessId !== input.businessId) {
      throw new Error(
        `segment ${input.segmentId} business mismatch: expected ${input.businessId}, got ${page.businessId}`,
      );
    }

    for (const m of page.members) {
      const address =
        input.channel === "whatsapp_ctc" ? m.phone_e164 : m.email;
      if (!address) continue;
      out.push({
        customer_id: m.id,
        name: m.name,
        channel_address: address,
      });
      if (out.length >= HARD_LIMIT) break;
    }
    if (out.length >= HARD_LIMIT) break;
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// sendEmailBatch re-export — single import surface for the /send route.
// ─────────────────────────────────────────────────────────────────────────

export async function sendEmailBatch(
  recipients: BatchRecipient[],
  opts: { fromEmail: string; apiKey: string },
): Promise<SendEmailBatchResult> {
  return resendSendEmailBatch(recipients, opts);
}

export type { BatchRecipient, SendEmailBatchResult } from "@/lib/marketing/email-resend";
