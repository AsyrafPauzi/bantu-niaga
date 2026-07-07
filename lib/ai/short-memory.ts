import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const SHORT_MEMORY_MAX_TURNS = 4;
export const SHORT_MEMORY_MAX_CHARS = 400;

export interface ShortMemoryTurn {
  role: "user" | "assistant";
  content: string;
}

function trimTurn(turn: ShortMemoryTurn): ShortMemoryTurn {
  const content = turn.content.trim().slice(0, SHORT_MEMORY_MAX_CHARS);
  return { role: turn.role, content };
}

export function trimShortMemoryTurns(
  turns: ShortMemoryTurn[],
): ShortMemoryTurn[] {
  return turns
    .filter(
      (t) =>
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string" &&
        t.content.trim().length > 0,
    )
    .map(trimTurn)
    .slice(-SHORT_MEMORY_MAX_TURNS);
}

/**
 * Load the last few turns for this user + business + agent.
 * One small row — no scan, no join.
 */
export async function loadShortMemory(opts: {
  businessId: string;
  userId: string;
  agentSlug: string;
}): Promise<ShortMemoryTurn[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_chat_short_memory")
    .select("turns")
    .eq("business_id", opts.businessId)
    .eq("user_id", opts.userId)
    .eq("agent_slug", opts.agentSlug)
    .maybeSingle();

  if (error || !data?.turns) return [];

  if (!Array.isArray(data.turns)) return [];
  return trimShortMemoryTurns(data.turns as ShortMemoryTurn[]);
}

export async function saveShortMemory(opts: {
  businessId: string;
  userId: string;
  agentSlug: string;
  turns: ShortMemoryTurn[];
}): Promise<void> {
  const trimmed = trimShortMemoryTurns(opts.turns);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ai_chat_short_memory").upsert(
    {
      business_id: opts.businessId,
      user_id: opts.userId,
      agent_slug: opts.agentSlug,
      turns: trimmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,user_id,agent_slug" },
  );
  if (error) throw new Error(error.message);
}

export async function clearShortMemory(opts: {
  businessId: string;
  userId: string;
  agentSlug: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("ai_chat_short_memory")
    .delete()
    .eq("business_id", opts.businessId)
    .eq("user_id", opts.userId)
    .eq("agent_slug", opts.agentSlug);
}
