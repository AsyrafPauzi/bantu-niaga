import type { TenantAgentDefinition } from "@/lib/settings/ai-agents-catalog";

export interface ResolvedDailyNoticeAgent {
  agentSlug: string;
  displayName: string;
  assistantHref: string;
}

/** Matches Settings → AI agents default: on when subscribed unless explicitly off. */
export function isDailyNoticeEnabled(
  addonActive: boolean,
  supportsDailyNotice: boolean,
  storedDailyNoticeEnabled: boolean | null | undefined,
): boolean {
  if (!supportsDailyNotice || !addonActive) {
    return false;
  }
  return storedDailyNoticeEnabled ?? true;
}

export function resolveDailyNoticeAgents(
  defs: readonly TenantAgentDefinition[],
  activeAddonSlugs: Set<string>,
  settingsBySlug: Map<
    string,
    { display_name: string | null; daily_notice_enabled: boolean | null }
  >,
): ResolvedDailyNoticeAgent[] {
  const resolved: ResolvedDailyNoticeAgent[] = [];

  for (const def of defs) {
    if (!def.supportsDailyNotice || !def.addonSlug) {
      continue;
    }

    const addonActive = activeAddonSlugs.has(def.addonSlug);
    const stored = settingsBySlug.get(def.slug);
    if (
      !isDailyNoticeEnabled(
        addonActive,
        def.supportsDailyNotice,
        stored?.daily_notice_enabled,
      )
    ) {
      continue;
    }

    resolved.push({
      agentSlug: def.slug,
      displayName: stored?.display_name ?? def.defaultName,
      assistantHref: def.chatHref ?? "/home",
    });
  }

  return resolved;
}
