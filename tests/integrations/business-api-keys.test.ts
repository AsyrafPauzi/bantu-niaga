import { describe, expect, it } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  parseBearerApiKey,
  scopeAllows,
  signWebhookBody,
} from "@/lib/integrations/business-api-keys";

describe("generateApiKey", () => {
  it("creates bn_live prefix keys", () => {
    const { rawKey, keyPrefix, keyHash } = generateApiKey();
    expect(rawKey.startsWith("bn_live_")).toBe(true);
    expect(keyPrefix).toBe(rawKey.slice(0, 16));
    expect(keyHash).toBe(hashApiKey(rawKey));
  });
});

describe("parseBearerApiKey", () => {
  it("extracts token from Authorization header", () => {
    expect(parseBearerApiKey("Bearer bn_live_abc123")).toBe("bn_live_abc123");
    expect(parseBearerApiKey("Basic xyz")).toBeNull();
  });
});

describe("scopeAllows", () => {
  it("ranks scopes correctly", () => {
    expect(scopeAllows("read", "read")).toBe(true);
    expect(scopeAllows("read", "read+write")).toBe(false);
    expect(scopeAllows("admin", "read+write")).toBe(true);
  });
});

describe("signWebhookBody", () => {
  it("produces stable HMAC", () => {
    const sig = signWebhookBody("secret", '{"a":1}');
    expect(sig).toHaveLength(64);
    expect(signWebhookBody("secret", '{"a":1}')).toBe(sig);
  });
});
