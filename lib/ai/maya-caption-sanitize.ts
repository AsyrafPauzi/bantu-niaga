/**
 * Pure caption post-processing for Maya rewrite (no server imports).
 */

const REPORT_HEADING =
  /(\*{0,2}\s*(ringkasan|menu\s+hari\s+ini|jualan(\s+bulan(\s+ini)?)?|langkah\s+seterusnya|summary|today'?s\s+menu|sales\s+(mtd|this\s+month)|next\s+steps)\s*\*{0,2}\s*:?\s*$)/im;

export function looksLikeStaffReport(text: string): boolean {
  if (REPORT_HEADING.test(text)) return true;
  const bulletPrices = (text.match(/RM\s*\d/gi) ?? []).length;
  if (bulletPrices >= 4 && /(^|\n)\s*[-*•]/m.test(text)) return true;
  if ((text.match(/\*\*[^*]+\*\*/g) ?? []).length >= 3) return true;
  return false;
}

export function sanitizeRewrittenCaption(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  if (text.startsWith("```")) {
    text = text.replace(/^```(?:\w+)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  const cut = text.search(REPORT_HEADING);
  if (cut > 40) {
    text = text.slice(0, cut).trim();
  } else if (cut === 0) {
    return "";
  }

  text = text
    .split("\n")
    .filter((line) => !REPORT_HEADING.test(line.trim()))
    .join("\n");

  text = text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = text.split("\n");
  if (
    lines.length > 1 &&
    /^(here('|’)s|rewritten|caption|maya|berikut)\b/i.test(lines[0]!.trim())
  ) {
    text = lines.slice(1).join("\n").trim();
  }

  return text;
}
