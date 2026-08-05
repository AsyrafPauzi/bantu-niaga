import { redirectPillarAssistant } from "@/lib/ai/pillar-assistant-redirect";

export const dynamic = "force-dynamic";

/** Legacy route — Maya opens as a floating panel on any Marketing page. */
export default async function MarketingAssistantRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirectPillarAssistant("marketing", await searchParams);
}
