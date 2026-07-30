import "server-only";

import {
  agentBySlug,
  type AgentSlug,
} from "@/lib/settings/ai-agents-catalog";
import { loadAgentsOverview } from "@/lib/settings/ai-agents";

export interface SidebarAssistantLink {
  href: string;
  label: string;
}

/** Parent module path → assistant sub-link(s) when the agent is enabled. */
export type SidebarAssistantsByModule = Partial<
  Record<string, readonly SidebarAssistantLink[]>
>;

const MODULE_PARENT_HREF: Record<AgentSlug, string | null> = {
  admin: "/admin",
  finance: "/finance",
  operations: "/operations",
  marketing: "/marketing",
  sales: "/sales",
  hr: "/hr",
  boardroom: null,
};

export async function loadSidebarAssistantsByModule(
  businessId: string,
): Promise<SidebarAssistantsByModule> {
  const overview = await loadAgentsOverview(businessId);
  const out: Record<string, SidebarAssistantLink[]> = {};

  for (const agent of overview.agents) {
    if (!agent.addon_active || !agent.assistant_enabled) continue;

    const def = agentBySlug(agent.slug);
    const parent = MODULE_PARENT_HREF[agent.slug];
    if (!def?.chatHref || !parent) continue;

    const link: SidebarAssistantLink = {
      href: def.chatHref,
      label: `${agent.display_name} AI`,
    };

    out[parent] = [...(out[parent] ?? []), link];
  }

  return out;
}
