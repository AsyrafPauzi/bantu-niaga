import type { NiagaXEmailInput } from "@/lib/email/types";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bodyToHtml(text: string): string {
  const escaped = escapeHtml(text).replace(/\n/g, "<br />");
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0B1220;">${escaped}</p>`;
}

export function renderNiagaXEmail(input: NiagaXEmailInput): string {
  const lang = input.locale === "ms" ? "ms" : "en";
  const brand = escapeHtml(input.brandName);
  const subject = escapeHtml(input.subject);
  const heading = escapeHtml(input.heading);
  const footer = escapeHtml(input.footerText);
  const preview = escapeHtml(
    (input.previewText ?? input.bodyText).split("\n")[0]?.slice(0, 120) ?? "",
  );
  const bodyHtml = bodyToHtml(input.bodyText);

  const ctaHref = input.ctaHref?.trim() ?? "";
  const ctaLabel = escapeHtml(input.ctaLabel?.trim() || "Continue");
  const button =
    ctaHref.length > 0
      ? `<a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#0E7490;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">${ctaLabel}</a>`
      : "";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#0E7490;padding:20px 24px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">${brand}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0B1220;">${heading}</h1>
              ${bodyHtml}
              ${button ? `<p style="margin:24px 0 0;">${button}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 28px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">${footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
