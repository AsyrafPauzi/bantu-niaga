import "server-only";

import { randomBytes } from "node:crypto";

/** Short URL-safe token for public share links (invoices, admin files). */
export function generateShareHash(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}
