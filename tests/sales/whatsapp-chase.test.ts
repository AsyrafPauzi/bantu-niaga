import { describe, expect, it } from "vitest";
import { buildWhatsAppChaseUrl } from "@/lib/sales/whatsapp-chase";

describe("buildWhatsAppChaseUrl", () => {
  it("builds wa.me link with encoded message", () => {
    const url = buildWhatsAppChaseUrl({
      phoneE164: "+60123456789",
      leadName: "Ali",
      businessName: "Kedai Runcit",
    });
    expect(url).toMatch(/^https:\/\/wa\.me\/60123456789\?text=/);
    expect(decodeURIComponent(url.split("text=")[1] ?? "")).toContain("Ali");
    expect(decodeURIComponent(url.split("text=")[1] ?? "")).toContain(
      "Kedai Runcit",
    );
  });

  it("uses formal tone when requested", () => {
    const url = buildWhatsAppChaseUrl({
      phoneE164: "60111222333",
      leadName: "Siti",
      businessName: "BN Shop",
      tone: "formal",
    });
    expect(decodeURIComponent(url.split("text=")[1] ?? "")).toContain(
      "Assalamualaikum",
    );
  });
});
