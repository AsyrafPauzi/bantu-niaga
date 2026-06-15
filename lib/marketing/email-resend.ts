/**
 * Bantu Niaga — Resend HTTP API wrapper.
 *
 * Thin `fetch`-based client for Resend's `/emails` and `/emails/batch`
 * endpoints. No SDK install — Resend's SDK is heavy and we only need
 * two POST calls. Stays server-only.
 *
 * Spec: docs/superpowers/specs/2026-06-15-marketing-segments-broadcasts-coupons-design.md §8.
 *
 * Configuration:
 *   - `RESEND_API_KEY`         (required to actually send)
 *   - `MARKETING_FROM_EMAIL`   (required; the From header value)
 *
 * Missing-config behaviour: callers pass `{ apiKey, fromEmail }` in,
 * and the helpers return `{ ok:false, reason:'email_channel_not_configured' }`
 * without making the HTTP request when either is empty. The API
 * routes translate that into the 412 documented in spec §8.
 */
import "server-only";

const RESEND_BASE = "https://api.resend.com";
/**
 * Resend batch endpoint accepts up to 100 emails per call. Anything
 * bigger gets chunked client-side by `sendEmailBatch`.
 */
export const RESEND_BATCH_LIMIT = 100;

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  fromEmail: string;
  apiKey: string;
}

export type SendEmailMissingConfigResult = {
  ok: false;
  reason: "email_channel_not_configured";
  missing: ("RESEND_API_KEY" | "MARKETING_FROM_EMAIL")[];
};

export type SendEmailFailureResult = {
  ok: false;
  reason: "resend_api_error";
  status: number;
  message: string;
};

export type SendEmailSuccessResult = {
  ok: true;
  id?: string;
};

export type SendEmailResult =
  | SendEmailSuccessResult
  | SendEmailMissingConfigResult
  | SendEmailFailureResult;

function missingConfig(
  apiKey: string | null | undefined,
  fromEmail: string | null | undefined,
): SendEmailMissingConfigResult | null {
  const missing: ("RESEND_API_KEY" | "MARKETING_FROM_EMAIL")[] = [];
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (!fromEmail) missing.push("MARKETING_FROM_EMAIL");
  if (missing.length === 0) return null;
  return { ok: false, reason: "email_channel_not_configured", missing };
}

/**
 * Send a single email through Resend.
 *
 * v1.1 sends the message_template as plain text (Resend accepts a
 * `text` field). HTML support is explicitly out of scope per spec §3.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const cfg = missingConfig(input.apiKey, input.fromEmail);
  if (cfg) return cfg;

  let res: Response;
  try {
    res = await fetch(`${RESEND_BASE}/emails`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: input.fromEmail,
        to: input.to,
        subject: input.subject,
        text: input.body,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      reason: "resend_api_error",
      status: 0,
      message: e instanceof Error ? e.message : "fetch failed",
    };
  }

  if (!res.ok) {
    let msg = `resend returned ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      msg = body.message ?? body.error ?? msg;
    } catch {
      // fall through with the generic status message
    }
    return { ok: false, reason: "resend_api_error", status: res.status, message: msg };
  }

  let id: string | undefined;
  try {
    const body = (await res.json()) as { id?: string };
    id = body.id;
  } catch {
    // Resend returns JSON on success, but a non-JSON 2xx is still OK.
  }
  return { ok: true, id };
}

export interface BatchRecipient {
  to: string;
  subject: string;
  body: string;
  /** Caller-supplied correlation id (e.g. broadcast_recipients.id). */
  ref: string;
}

export interface BatchResultEntry {
  ref: string;
  ok: boolean;
  /** Present on success. */
  resendId?: string;
  /** Present on failure. */
  error?: string;
}

export type SendEmailBatchResult =
  | SendEmailMissingConfigResult
  | { ok: true; results: BatchResultEntry[] };

/**
 * Send a batch of emails. Chunks the input list into Resend-sized
 * groups (100 max per their batch endpoint) and concatenates the
 * per-recipient results.
 *
 * On Resend HTTP errors the whole batch is recorded as failed with
 * the upstream error message; we do NOT retry. The caller (the
 * /send route) is responsible for updating broadcast_recipients
 * rows in the same transaction.
 */
export async function sendEmailBatch(
  recipients: BatchRecipient[],
  opts: { fromEmail: string; apiKey: string },
): Promise<SendEmailBatchResult> {
  const cfg = missingConfig(opts.apiKey, opts.fromEmail);
  if (cfg) return cfg;
  if (recipients.length === 0) return { ok: true, results: [] };

  const results: BatchResultEntry[] = [];

  for (let i = 0; i < recipients.length; i += RESEND_BATCH_LIMIT) {
    const chunk = recipients.slice(i, i + RESEND_BATCH_LIMIT);
    const payload = chunk.map((r) => ({
      from: opts.fromEmail,
      to: [r.to],
      subject: r.subject,
      text: r.body,
    }));

    let res: Response;
    try {
      res = await fetch(`${RESEND_BASE}/emails/batch`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${opts.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fetch failed";
      for (const r of chunk) {
        results.push({ ref: r.ref, ok: false, error: msg });
      }
      continue;
    }

    if (!res.ok) {
      let msg = `resend batch returned ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string; error?: string };
        msg = body.message ?? body.error ?? msg;
      } catch {
        // keep the generic status message
      }
      for (const r of chunk) {
        results.push({ ref: r.ref, ok: false, error: msg });
      }
      continue;
    }

    // Resend's batch response is `{ data: [{ id: '...' }, ...] }`,
    // positional with the request payload. We zip by index.
    let ids: string[] = [];
    try {
      const body = (await res.json()) as { data?: { id?: string }[] };
      ids = (body.data ?? []).map((d) => d.id ?? "");
    } catch {
      ids = chunk.map(() => "");
    }
    chunk.forEach((r, idx) => {
      results.push({ ref: r.ref, ok: true, resendId: ids[idx] });
    });
  }

  return { ok: true, results };
}
