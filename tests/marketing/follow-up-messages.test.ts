import { describe, expect, it } from "vitest";
import {
  buildFollowUpMessages,
  waMeUrl,
} from "@/lib/marketing/follow-up-messages";

describe("buildFollowUpMessages", () => {
  it("builds EN/MS without IC numbers for dormant", () => {
    const m = buildFollowUpMessages({
      reason: "dormant",
      customerName: "Aina",
      businessName: "Kedai Mira",
    });
    expect(m.en).toMatch(/Aina/);
    expect(m.ms).toMatch(/Aina/);
    expect(m.en + m.ms).not.toMatch(/\d{12}/);
  });

  it("covers no_purchase and check_in", () => {
    expect(
      buildFollowUpMessages({ reason: "no_purchase", customerName: "Ben" }).en,
    ).toMatch(/Ben/);
    expect(
      buildFollowUpMessages({ reason: "check_in", customerName: "Cai" }).ms,
    ).toMatch(/Cai/);
  });
});

describe("waMeUrl", () => {
  it("strips non-digits", () => {
    expect(waMeUrl("+60 12-345 6789", "hi")).toContain("wa.me/60123456789");
  });
});
