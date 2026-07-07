import { describe, expect, it } from "vitest";
import { authCallbackUrl, getSiteUrl } from "@/lib/auth/site-url";

describe("auth site url helpers", () => {
  it("prefers NEXT_PUBLIC_APP_URL", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test/";
    expect(getSiteUrl()).toBe("https://app.example.test");
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  it("builds callback url with encoded next path", () => {
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(authCallbackUrl("/accept-invite", "https://app.example.test")).toBe(
      "https://app.example.test/auth/callback?next=%2Faccept-invite",
    );
    process.env.NEXT_PUBLIC_APP_URL = prevApp;
    process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  });
});
