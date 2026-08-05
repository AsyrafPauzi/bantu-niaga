import "server-only";

import type { Role } from "@/lib/permissions";
import { can } from "@/lib/permissions";
import { canUseAdminAssistant } from "@/lib/admin/access";
import { canUseFinanceAssistant } from "@/lib/finance/access";
import { canManageHrCore } from "@/lib/hr/access";
import { canManageMarketingCore } from "@/lib/marketing/access";
import { canManageSalesCore } from "@/lib/sales/access";
import {
  hasAdminAssistantAddon,
  hasFinanceAssistantAddon,
  hasHrAssistantAddon,
  hasMarketingAssistantAddon,
  hasOperationsAssistantAddon,
  hasSalesAssistantAddon,
} from "@/lib/marketplace/entitlements";
import {
  PILLAR_ASSISTANT_FLOAT_META,
  type PillarAssistantFloatKey,
} from "@/lib/ai/pillar-assistant-float-meta";

export type { PillarAssistantFloatKey } from "@/lib/ai/pillar-assistant-float-meta";
export { pillarAssistantOpenQuery } from "@/lib/ai/pillar-assistant-float-meta";

const ACCESS: Record<PillarAssistantFloatKey, (role: Role) => boolean> = {
  admin: canUseAdminAssistant,
  finance: canUseFinanceAssistant,
  operations: (role) => can(role, "operations"),
  marketing: canManageMarketingCore,
  sales: canManageSalesCore,
  hr: canManageHrCore,
};

const ADDON_CHECK: Record<
  PillarAssistantFloatKey,
  (businessId: string) => Promise<boolean>
> = {
  admin: hasAdminAssistantAddon,
  finance: hasFinanceAssistantAddon,
  operations: hasOperationsAssistantAddon,
  marketing: hasMarketingAssistantAddon,
  sales: hasSalesAssistantAddon,
  hr: hasHrAssistantAddon,
};

export function canAccessPillarAssistantFloat(
  pillar: PillarAssistantFloatKey,
  role: Role,
): boolean {
  return ACCESS[pillar](role);
}

export async function hasPillarAssistantAddon(
  pillar: PillarAssistantFloatKey,
  businessId: string,
): Promise<boolean> {
  return ADDON_CHECK[pillar](businessId);
}

export function getPillarAssistantFloatMeta(pillar: PillarAssistantFloatKey) {
  return PILLAR_ASSISTANT_FLOAT_META[pillar];
}
