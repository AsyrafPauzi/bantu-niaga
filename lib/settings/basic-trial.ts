export function shouldOfferBasicTrial(input: {
  isSaas: boolean;
  role: string;
  tier: string;
  subscriptionStatus: string;
  selfServeTrialUsedAt: string | null;
}): boolean {
  if (!input.isSaas) return false;
  if (input.role !== "owner") return false;
  if (input.tier !== "starter") return false;
  if (input.subscriptionStatus !== "active") return false;
  if (input.selfServeTrialUsedAt) return false;
  return true;
}
