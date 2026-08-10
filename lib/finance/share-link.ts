import "server-only";

import { generateShareHash } from "@/lib/utils/share-hash";

export const INVOICE_SHARE_TTL_DAYS = 3;

export function invoiceShareExpiryFromNow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + INVOICE_SHARE_TTL_DAYS);
  return d;
}

export function buildInvoiceShareFields(status: string): {
  share_hash: string;
  share_issued_at: string;
  share_expires_at: string | null;
} {
  const now = new Date();
  const share_hash = generateShareHash();
  const share_issued_at = now.toISOString();
  const share_expires_at =
    status === "paid" ? null : invoiceShareExpiryFromNow().toISOString();
  return { share_hash, share_issued_at, share_expires_at };
}

export function isInvoiceShareExpired(
  status: string,
  share_expires_at: string | null | undefined,
): boolean {
  if (status === "paid") return false;
  if (!share_expires_at) return false;
  return new Date(share_expires_at) < new Date();
}
