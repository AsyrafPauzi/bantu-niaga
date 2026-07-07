/** Max businesses one login may create as owner (sign-up + add company). */
export const MAX_OWNED_BUSINESSES_PER_USER = 5;

export function canCreateOwnedBusiness(ownedCount: number): boolean {
  return ownedCount < MAX_OWNED_BUSINESSES_PER_USER;
}

export function ownedBusinessLimitMessage(): string {
  return `Each account can own up to ${MAX_OWNED_BUSINESSES_PER_USER} companies. Sign in with another email or contact support if you need more.`;
}
