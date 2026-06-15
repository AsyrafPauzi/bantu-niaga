/**
 * Bantu Niaga — coupon code generator (isomorphic helper).
 *
 * Pulled out of lib/marketing/coupons.ts so the client-side "Generate"
 * button (in components/marketing/CouponForm.tsx) can call it without
 * dragging the supabase-js + server-only chain into the bundle.
 *
 * Alphabet drops the visually ambiguous I/O/0/1 so codes survive
 * receipt OCR + thumb keypads.
 */

const COUPON_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCouponCode(length = 8): string {
  if (!Number.isInteger(length) || length < 3 || length > 32) {
    throw new Error(
      `generateCouponCode: length must be an integer in [3, 32]; got ${length}`,
    );
  }
  const out: string[] = [];
  // crypto.getRandomValues is guaranteed in modern Node (≥ 18) and
  // every browser. The `typeof` guard is purely defensive against
  // hand-rolled test stubs that strip globalThis.crypto.
  const cryptoObj =
    typeof globalThis.crypto !== "undefined" ? globalThis.crypto : null;
  if (cryptoObj) {
    const buf = new Uint32Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i++) {
      out.push(COUPON_ALPHABET[buf[i] % COUPON_ALPHABET.length]);
    }
  } else {
    for (let i = 0; i < length; i++) {
      out.push(
        COUPON_ALPHABET[Math.floor(Math.random() * COUPON_ALPHABET.length)],
      );
    }
  }
  return out.join("");
}

export const COUPON_CODE_ALPHABET = COUPON_ALPHABET;
