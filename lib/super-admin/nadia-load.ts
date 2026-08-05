import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  DEFAULT_NADIA_SETTINGS,
  parseNadiaSettings,
  type NadiaSettings,
} from "@/lib/super-admin/nadia-settings";

export async function loadNadiaSettings(): Promise<NadiaSettings> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("ai_agents")
    .select("settings")
    .eq("slug", "nadia")
    .maybeSingle();

  if (!data?.settings) return { ...DEFAULT_NADIA_SETTINGS };
  return parseNadiaSettings(data.settings);
}

export async function saveNadiaSettings(
  settings: NadiaSettings,
): Promise<void> {
  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("ai_agents")
    .update({
      settings,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", "nadia");

  if (error) throw new Error(error.message);
}
