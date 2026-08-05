import { redirectPillarAssistant } from "@/lib/ai/pillar-assistant-redirect";

export const dynamic = "force-dynamic";

export default async function HrAssistantRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirectPillarAssistant("hr", await searchParams);
}
