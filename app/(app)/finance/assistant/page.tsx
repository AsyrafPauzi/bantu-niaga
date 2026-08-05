import { redirectPillarAssistant } from "@/lib/ai/pillar-assistant-redirect";

export const dynamic = "force-dynamic";

export default async function FinanceAssistantRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirectPillarAssistant("finance", await searchParams);
}
