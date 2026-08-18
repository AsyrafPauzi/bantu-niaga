/**
 * Branded HTML wrapper for marketing email broadcasts.
 * Plain-text body is still sent for clients that prefer text.
 */

import { escapeHtml, renderNiagaXEmail } from "@/lib/email/layout";

export { escapeHtml };

/** Turn plain message (with newlines) into safe HTML paragraphs. */
export function plainTextToHtmlBody(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "<p></p>";
  return trimmed
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").map((line) => escapeHtml(line));
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0B1220;">${lines.join("<br />")}</p>`;
    })
    .join("");
}

export interface MarketingEmailHtmlOptions {
  subject: string;
  bodyText: string;
  businessName?: string;
  previewText?: string;
}

export function buildMarketingEmailHtml(opts: MarketingEmailHtmlOptions): string {
  const business = opts.businessName?.trim() || "Your business";
  return renderNiagaXEmail({
    locale: "en",
    brandName: business,
    subject: opts.subject,
    heading: opts.subject,
    bodyText: opts.bodyText,
    footerText:
      "You received this because you are a customer of this business. Bantu Niaga Sdn. Bhd.",
    previewText: opts.previewText,
  });
}
