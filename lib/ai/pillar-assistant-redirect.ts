import { redirect } from "next/navigation";
import {
  PILLAR_ASSISTANT_FLOAT_META,
  pillarAssistantOpenQuery,
  type PillarAssistantFloatKey,
} from "@/lib/ai/pillar-assistant-float-meta";

/** Legacy /{pillar}/assistant → /{pillar}?{agent}=open */
export function redirectPillarAssistant(
  pillar: PillarAssistantFloatKey,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const config = PILLAR_ASSISTANT_FLOAT_META[pillar];
  const params = new URLSearchParams({ [config.queryParam]: "open" });

  const seed =
    (typeof searchParams.seed === "string" && searchParams.seed.trim()) ||
    (typeof searchParams.q === "string" && searchParams.q.trim()) ||
    undefined;

  if (seed) {
    params.set("seed", seed.slice(0, 2000));
  }

  redirect(`${config.basePath}?${params.toString()}`);
}
