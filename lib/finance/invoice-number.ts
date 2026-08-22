/**
 * Pure helpers for INV/QUO document numbers: `{PREFIX}-{YEAR}-{seq}`.
 * Seq is zero-padded to at least 4 digits (grows past 9999 without padding).
 */

export function invoiceNumberPattern(prefix: string, year: number): string {
  return `${prefix}-${year}-`;
}

/** Parse trailing digits after `pattern`; null if missing or non-numeric. */
export function parseInvoiceSequence(
  number: string,
  pattern: string,
): number | null {
  if (!number.startsWith(pattern)) return null;
  const tail = number.slice(pattern.length);
  if (!/^\d+$/.test(tail)) return null;
  const seq = Number.parseInt(tail, 10);
  return Number.isFinite(seq) && seq >= 0 ? seq : null;
}

export function formatInvoiceNumber(
  prefix: string,
  year: number,
  seq: number,
): string {
  const safe = Math.max(1, Math.floor(seq));
  return `${invoiceNumberPattern(prefix, year)}${String(safe).padStart(4, "0")}`;
}

/** Next sequence = max numeric suffix among `numbers` matching `pattern`, plus 1. */
export function nextInvoiceSequenceFromNumbers(
  numbers: readonly string[],
  pattern: string,
): number {
  let max = 0;
  for (const number of numbers) {
    const seq = parseInvoiceSequence(number, pattern);
    if (seq != null && seq > max) max = seq;
  }
  return max + 1;
}

/** Calendar year in Asia/Kuala_Lumpur (invoice dating for MY businesses). */
export function malaysiaInvoiceYear(now: Date = new Date()): number {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(now);
  return Number(ymd.slice(0, 4));
}
