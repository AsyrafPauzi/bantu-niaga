import { describe, expect, it } from "vitest";
import {
  sanitizeAuthNextPath,
  socialAuthErrorMessage,
} from "@/lib/auth/social-login";

describe("sanitizeAuthNextPath", () => {
  it("defaults unsafe or missing paths to /home", () => {
    expect(sanitizeAuthNextPath(null)).toBe("/home");
    expect(sanitizeAuthNextPath("")).toBe("/home");
    expect(sanitizeAuthNextPath("https://evil.test")).toBe("/home");
    expect(sanitizeAuthNextPath("//evil.test")).toBe("/home");
  });

  it("blocks auth-loop paths", () => {
    expect(sanitizeAuthNextPath("/sign-in")).toBe("/home");
    expect(sanitizeAuthNextPath("/sign-up?path=free")).toBe("/home");
    expect(sanitizeAuthNextPath("/auth/callback?next=/home")).toBe("/home");
  });

  it("allows in-app relative paths", () => {
    expect(sanitizeAuthNextPath("/home")).toBe("/home");
    expect(sanitizeAuthNextPath("/settings/team")).toBe("/settings/team");
  });
});

describe("socialAuthErrorMessage", () => {
  it("maps known OAuth errors", () => {
    expect(socialAuthErrorMessage("no_account")).toMatch(/No NiagaX account/);
    expect(socialAuthErrorMessage("oauth_cancelled")).toMatch(/cancelled/i);
  });

  it("maps email_taken", () => {
    expect(socialAuthErrorMessage("email_taken")).toMatch(
      /already belongs to a NiagaX account/i,
    );
  });
});
