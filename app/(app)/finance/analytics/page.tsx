import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AnalyticsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const days = typeof params.days === "string" ? params.days : "7";
  redirect(`/finance/reports?tab=analytics&days=${days}`);
}
