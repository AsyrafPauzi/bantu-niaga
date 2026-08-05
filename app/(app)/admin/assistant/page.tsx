import { redirectPillarAssistant } from "@/lib/ai/pillar-assistant-redirect";

export const dynamic = "force-dynamic";

export default async function AdminAssistantRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirectPillarAssistant("admin", await searchParams);
}
