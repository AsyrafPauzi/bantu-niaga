import { createHash, randomBytes } from "node:crypto";

export interface LeaveLinkState {
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
}

export function makeLeaveLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLeaveLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function expiresIn24Hours(now = new Date()): string {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

export function isLeaveLinkUsable(link: LeaveLinkState, now = new Date()): boolean {
  if (link.used_at || link.revoked_at) return false;
  return new Date(link.expires_at).getTime() > now.getTime();
}

export function buildStaffLeaveUrl(origin: string, token: string): string {
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${base}/staff/leave/${encodeURIComponent(token)}`;
}
