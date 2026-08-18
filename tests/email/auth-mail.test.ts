import { describe, expect, it } from "vitest";
import { authEmailCopy } from "@/lib/email/copy";
import { buildAuthVerifyUrl } from "@/lib/email/auth-mail";
import { formatPlatformFrom } from "@/lib/email/from";

describe("authEmailCopy", () => {
  it("returns English recovery copy", () => {
    const c = authEmailCopy("recovery", "en", {});
    expect(c.heading).toBe("Set a new password");
    expect(c.ctaLabel).toBe("Set new password");
  });

  it("returns Malay signup copy", () => {
    const c = authEmailCopy("signup", "ms", {});
    expect(c.heading).toBe("Sahkan e-mel anda");
  });

  it("falls back to English generic for unknown actions", () => {
    const c = authEmailCopy("not_a_real_type", "ms", {});
    expect(c.subject).toBe("Continue in NiagaX");
  });
});

describe("buildAuthVerifyUrl", () => {
  it("puts token_hash in the token query param", () => {
    const url = buildAuthVerifyUrl({
      supabaseUrl: "https://abc.supabase.co/",
      tokenHash: "hash123",
      emailActionType: "recovery",
      redirectTo: "https://app.niagax.my/auth/callback?next=/reset-password",
    });
    expect(url.startsWith("https://abc.supabase.co/auth/v1/verify?")).toBe(true);
    expect(url).toContain("token=hash123");
    expect(url).toContain("type=recovery");
    expect(url).toContain("redirect_to=");
  });
});

describe("formatPlatformFrom", () => {
  it("wraps a bare address", () => {
    expect(formatPlatformFrom("noreply@app.niagax.my")).toBe(
      "NiagaX <noreply@app.niagax.my>",
    );
  });

  it("keeps an existing display name", () => {
    expect(formatPlatformFrom("NiagaX <noreply@app.niagax.my>")).toBe(
      "NiagaX <noreply@app.niagax.my>",
    );
  });
});
