import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyAuthHookSignature } from "@/lib/email/hook-secret";

const SECRET_BYTES = Buffer.from("niagax-hook-test-secret");
const SECRET_RAW = `v1,whsec_${SECRET_BYTES.toString("base64")}`;

function sign(id: string, timestamp: string, body: string): string {
  const mac = createHmac("sha256", SECRET_BYTES)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${mac}`;
}

describe("verifyAuthHookSignature", () => {
  it("accepts a valid Standard Webhooks signature", () => {
    const body = '{"ok":true}';
    const id = "msg_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = new Headers({
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": sign(id, timestamp, body),
    });
    expect(
      verifyAuthHookSignature({
        rawBody: body,
        headers,
        secretRaw: SECRET_RAW,
      }),
    ).toBe(true);
  });

  it("rejects a wrong signature", () => {
    const body = '{"ok":true}';
    const headers = new Headers({
      "webhook-id": "msg_1",
      "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      "webhook-signature": "v1,aaaa",
    });
    expect(
      verifyAuthHookSignature({
        rawBody: body,
        headers,
        secretRaw: SECRET_RAW,
      }),
    ).toBe(false);
  });

  it("rejects a timestamp older than 5 minutes", () => {
    const body = '{"ok":true}';
    const id = "msg_old";
    const timestamp = String(Math.floor(Date.now() / 1000) - 400);
    const headers = new Headers({
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": sign(id, timestamp, body),
    });
    expect(
      verifyAuthHookSignature({
        rawBody: body,
        headers,
        secretRaw: SECRET_RAW,
      }),
    ).toBe(false);
  });
});
