import "server-only";

import { randomBytes } from "node:crypto";

/** URL-safe unpredictable token for public share links (invoices, admin files). */
export function generateShareHash(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 22; i++) {
    out += alphabet[bytes[i % bytes.length]! % alphabet.length];
  }
  return out;
}
