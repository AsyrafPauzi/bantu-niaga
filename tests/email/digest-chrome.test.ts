import { describe, expect, it } from "vitest";
import { digestEmailChrome } from "@/lib/email/copy";
import { renderNiagaXEmail } from "@/lib/email/layout";

describe("digestEmailChrome", () => {
  it("returns Malay CTA and footer for ms", () => {
    const chrome = digestEmailChrome("ms");
    expect(chrome.ctaLabel).toBe("Buka Boardroom");
    expect(chrome.footerText).toMatch(/Ringkasan Boardroom/i);
    const html = renderNiagaXEmail({
      locale: "ms",
      brandName: "NiagaX",
      subject: "Weekly digest",
      heading: "Weekly digest",
      bodyText: "English body stays as generated.",
      ctaLabel: chrome.ctaLabel,
      ctaHref: "https://app.niagax.my/boardroom",
      footerText: chrome.footerText,
    });
    expect(html).toContain('lang="ms"');
    expect(html).toContain("Buka Boardroom");
    expect(html).toContain("English body stays as generated.");
  });

  it("keeps English chrome for en", () => {
    expect(digestEmailChrome("en")).toEqual({
      ctaLabel: "Open Boardroom",
      footerText: "Weekly Boardroom digest from NiagaX. Bantu Niaga Sdn. Bhd.",
    });
  });
});
