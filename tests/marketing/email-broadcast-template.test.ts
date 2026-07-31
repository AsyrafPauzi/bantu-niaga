import { describe, expect, it } from "vitest";
import {
  buildMarketingEmailHtml,
  escapeHtml,
  plainTextToHtmlBody,
} from "@/lib/marketing/email-broadcast-template";

describe("email-broadcast-template", () => {
  it("escapes HTML in body", () => {
    const html = buildMarketingEmailHtml({
      subject: "Test <script>",
      bodyText: "Hello <b>world</b>",
      businessName: "Cafe & Co",
    });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Hello &lt;b&gt;world&lt;/b&gt;");
    expect(html).toContain("Cafe &amp; Co");
  });

  it("converts paragraphs from double newlines", () => {
    const body = plainTextToHtmlBody("Line one\n\nLine two");
    expect(body).toContain("Line one");
    expect(body).toContain("Line two");
    expect(body.match(/<p/g)?.length).toBe(2);
  });

  it("escapeHtml handles quotes", () => {
    expect(escapeHtml('"hi"')).toBe("&quot;hi&quot;");
  });
});
