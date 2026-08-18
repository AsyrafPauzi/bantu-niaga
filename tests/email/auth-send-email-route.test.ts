import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET_BYTES = Buffer.from("niagax-hook-test-secret");
const SECRET_RAW = `v1,whsec_${SECRET_BYTES.toString("base64")}`;

const PAYLOAD = {
  user: {
    id: "8484b834-f29e-4af2-bf42-80644d154f76",
    email: "valid.email@example.test",
    user_metadata: {},
  },
  email_data: {
    token: "305805",
    token_hash: "7d5b7b1964cf5d388340a7f04f1dbb5e",
    redirect_to: "https://app.niagax.my/auth/callback?next=%2Freset-password",
    email_action_type: "recovery",
    site_url: "https://abc.supabase.co",
    token_new: "",
    token_hash_new: "",
  },
};

function sign(id: string, timestamp: string, body: string): string {
  const mac = createHmac("sha256", SECRET_BYTES)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${mac}`;
}

function signedRequest(body: string, secretOk = true): Request {
  const id = "msg_test";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = new Headers({
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": secretOk ? sign(id, timestamp, body) : "v1,aaaa",
  });
  return new Request("http://localhost/api/webhooks/auth-send-email", {
    method: "POST",
    headers,
    body,
  });
}

const sendEmail = vi.fn(async () => ({ ok: true as const, id: "re_test" }));

async function loadRoute() {
  vi.resetModules();
  vi.doMock("@/lib/marketing/email-resend", () => ({ sendEmail }));
  vi.doMock("@/lib/logger", () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), child: () => ({ error: vi.fn() }) },
  }));
  vi.doMock("@/lib/supabase/service-role", () => ({
    createServiceRoleClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { preferred_locale: "en" }, error: null }),
          }),
        }),
      }),
    }),
  }));
  process.env.AUTH_SEND_EMAIL_HOOK_SECRET = SECRET_RAW;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  process.env.MARKETING_FROM_EMAIL = "noreply@app.niagax.my";
  process.env.RESEND_API_KEY = "re_test_key";
  return import("@/app/api/webhooks/auth-send-email/route");
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/marketing/email-resend");
  vi.doUnmock("@/lib/logger");
  vi.doUnmock("@/lib/supabase/service-role");
  sendEmail.mockClear();
});

describe("POST /api/webhooks/auth-send-email", () => {
  beforeEach(() => {
    sendEmail.mockClear();
  });

  it("returns 401 and does not send when the signature is wrong", async () => {
    const { POST } = await loadRoute();
    const res = await POST(signedRequest(JSON.stringify(PAYLOAD), false));
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends a NiagaX HTML mail on a valid recovery hook", async () => {
    const { POST } = await loadRoute();
    const res = await POST(signedRequest(JSON.stringify(PAYLOAD), true));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "valid.email@example.test",
        fromEmail: "NiagaX <noreply@app.niagax.my>",
      }),
    );
    const html = (sendEmail.mock.calls as unknown as [{ html?: string }][])[0]?.[0]
      ?.html;
    expect(html).toContain("#0E7490");
  });
});
