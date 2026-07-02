import { describe, expect, it } from "vitest";
import {
  buildStaffLeaveUrl,
  hashLeaveLinkToken,
  isLeaveLinkUsable,
  makeLeaveLinkToken,
} from "@/lib/hr/leave-links";

describe("HR staff leave links", () => {
  it("generates unguessable URL-safe tokens and hashes them", () => {
    const first = makeLeaveLinkToken();
    const second = makeLeaveLinkToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(first).not.toBe(second);
    expect(hashLeaveLinkToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashLeaveLinkToken(first)).toBe(hashLeaveLinkToken(first));
    expect(hashLeaveLinkToken(first)).not.toBe(first);
  });

  it("marks links unusable after expiry, revocation, or use", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();

    expect(
      isLeaveLinkUsable({ expires_at: future, used_at: null, revoked_at: null }),
    ).toBe(true);
    expect(
      isLeaveLinkUsable({ expires_at: past, used_at: null, revoked_at: null }),
    ).toBe(false);
    expect(
      isLeaveLinkUsable({ expires_at: future, used_at: future, revoked_at: null }),
    ).toBe(false);
    expect(
      isLeaveLinkUsable({ expires_at: future, used_at: null, revoked_at: future }),
    ).toBe(false);
  });

  it("builds the staff-facing link from a request origin", () => {
    expect(buildStaffLeaveUrl("https://app.example.test", "abc_123")).toBe(
      "https://app.example.test/staff/leave/abc_123",
    );
  });
});
