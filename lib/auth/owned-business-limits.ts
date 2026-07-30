import { maxOwnedBusinessesPerUser } from "@/lib/platform/deployment";

/** SaaS default — use `getMaxOwnedBusinessesPerUser()` when enforcing limits. */
export const MAX_OWNED_BUSINESSES_PER_USER_SAAS = 5;

export function getMaxOwnedBusinessesPerUser(): number {
  return maxOwnedBusinessesPerUser();
}

export function canCreateOwnedBusiness(ownedCount: number): boolean {
  return ownedCount < getMaxOwnedBusinessesPerUser();
}

export function ownedBusinessLimitMessage(): string {
  const max = getMaxOwnedBusinessesPerUser();
  if (max <= 1) {
    return "This installation supports one company per account. Sign in with another email if you need a separate login.";
  }
  return `Each account can own up to ${max} companies. Sign in with another email or contact support if you need more.`;
}
