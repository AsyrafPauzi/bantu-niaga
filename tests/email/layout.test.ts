import { describe, expect, it } from "vitest";
import { escapeHtml, renderNiagaXEmail } from "@/lib/email/layout";

describe("renderNiagaXEmail", () => {
  it("escapes brand, subject, heading, body, and href", () => {
    const html = renderNiagaXEmail({
      locale: "en",
      brandName: "Cafe <script> & Co",
      subject: "Hi <b>",
      heading: "Reset <img>",
      bodyText: "Hello <b>world</b>",
      ctaLabel: "Go",
      ctaHref: 'https://example.test/?next="evil"',
      footerText: "Bantu Niaga Sdn. Bhd.",
    });
    expect(html).toContain("Cafe &lt;script&gt; &amp; Co");
    expect(html).toContain("Hello &lt;b&gt;world&lt;/b&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("#0E7490");
    expect(html).toContain("#EEF2F6");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("#6d28d9");
    expect(html).toContain('href="https://example.test/?next=&quot;evil&quot;"');
  });

  it("omits the button when ctaHref is missing", () => {
    const html = renderNiagaXEmail({
      locale: "en",
      brandName: "NiagaX",
      subject: "Code",
      heading: "Confirm",
      bodyText: "Your code is 123456",
      footerText: "Footer",
    });
    expect(html).not.toContain("<a ");
  });
});

describe("escapeHtml", () => {
  it("escapes quotes", () => {
    expect(escapeHtml('"hi"')).toBe("&quot;hi&quot;");
  });
});
