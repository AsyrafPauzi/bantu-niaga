import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_SECONDS = 300;

export function parseHookSecret(raw: string): Buffer {
  const trimmed = raw.trim();
  const withoutPrefix = trimmed.replace(/^v1,whsec_/, "").replace(/^whsec_/, "");
  return Buffer.from(withoutPrefix, "base64");
}

function signaturesFromHeader(header: string): Buffer[] {
  const out: Buffer[] = [];
  for (const part of header.trim().split(/\s+/)) {
    const [ver, sig] = part.split(",", 2);
    if (ver !== "v1" || !sig) continue;
    out.push(Buffer.from(sig, "base64"));
  }
  return out;
}

export function verifyAuthHookSignature(opts: {
  rawBody: string;
  headers: Headers;
  secretRaw: string;
  nowMs?: number;
}): boolean {
  const id = opts.headers.get("webhook-id");
  const timestamp = opts.headers.get("webhook-timestamp");
  const signatureHeader = opts.headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowSeconds = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) return false;

  let secret: Buffer;
  try {
    secret = parseHookSecret(opts.secretRaw);
  } catch {
    return false;
  }
  if (secret.length === 0) return false;

  const signed = `${id}.${timestamp}.${opts.rawBody}`;
  const expected = createHmac("sha256", secret).update(signed).digest();
  const candidates = signaturesFromHeader(signatureHeader);
  for (const candidate of candidates) {
    if (candidate.length !== expected.length) continue;
    if (timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}
