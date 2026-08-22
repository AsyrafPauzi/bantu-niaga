import { describe, expect, it } from "vitest";
import {
  incompleteSessionDecision,
  isPublicAuthPath,
  isPublicSharePath,
} from "@/lib/auth/incomplete-session";

describe("incompleteSessionDecision", () => {
  it("allows complete page and complete API", () => {
    expect(
      incompleteSessionDecision({
        pathname: "/sign-up/complete",
        hasProfile: false,
      }),
    ).toBe("allow");
    expect(
      incompleteSessionDecision({
        pathname: "/api/auth/complete-google-signup",
        hasProfile: false,
      }),
    ).toBe("allow");
  });

  it("forbids other APIs", () => {
    expect(
      incompleteSessionDecision({
        pathname: "/api/finance/invoices",
        hasProfile: false,
      }),
    ).toBe("forbidden_api");
  });

  it("allows accept-invite without a profile", () => {
    expect(
      incompleteSessionDecision({
        pathname: "/accept-invite",
        hasProfile: false,
      }),
    ).toBe("allow");
  });

  it("redirects app and auth pages", () => {
    expect(
      incompleteSessionDecision({ pathname: "/home", hasProfile: false }),
    ).toBe("redirect_complete");
    expect(
      incompleteSessionDecision({ pathname: "/sign-in", hasProfile: false }),
    ).toBe("redirect_complete");
    expect(
      incompleteSessionDecision({ pathname: "/sign-up", hasProfile: false }),
    ).toBe("redirect_complete");
  });

  it("allows when a profile exists", () => {
    expect(
      incompleteSessionDecision({ pathname: "/home", hasProfile: true }),
    ).toBe("allow");
  });
});

describe("isPublicAuthPath", () => {
  it("allows logged-out auth and legal pages", () => {
    expect(isPublicAuthPath("/sign-in")).toBe(true);
    expect(isPublicAuthPath("/sign-up")).toBe(true);
    expect(isPublicAuthPath("/sign-up/complete")).toBe(true);
    expect(isPublicAuthPath("/accept-invite")).toBe(true);
    expect(isPublicAuthPath("/legal/terms")).toBe(true);
    expect(isPublicAuthPath("/home")).toBe(false);
  });
});

describe("isPublicSharePath", () => {
  it("allows secure-hash public surfaces", () => {
    expect(isPublicSharePath("/demo/inv-abc123xyz")).toBe(true);
    expect(isPublicSharePath("/demo/book-abc123xyz")).toBe(true);
    expect(isPublicSharePath("/demo/leave-abc123xyz")).toBe(true);
    expect(isPublicSharePath("/demo/file-abc123xyz")).toBe(true);
    expect(isPublicSharePath("/finance/invoices")).toBe(false);
    expect(isPublicSharePath("/demo/inv-")).toBe(false);
  });
});
