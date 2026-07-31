/**
 * Branded HTML wrapper for marketing email broadcasts.
 * Plain-text body is still sent for clients that prefer text.
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn plain message (with newlines) into safe HTML paragraphs. */
export function plainTextToHtmlBody(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "<p></p>";
  return trimmed
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").map((line) => escapeHtml(line));
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a;">${lines.join("<br />")}</p>`;
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
  const business = escapeHtml(opts.businessName?.trim() || "Your business");
  const subject = escapeHtml(opts.subject);
  const preview = escapeHtml(
    opts.previewText?.trim() || opts.bodyText.split("\n")[0]?.slice(0, 120) || "",
  );
  const bodyHtml = plainTextToHtmlBody(opts.bodyText);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f0eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0eb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#6d28d9 0%,#7c3aed 100%);padding:20px 24px;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:rgba(255,255,255,0.85);">${business}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 28px;border-top:1px solid #ece7e0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
                You received this because you are a customer of ${business}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
