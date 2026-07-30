import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PnlRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const days = typeof params.days === "string" ? `days=${params.days}` : "days=30";
  redirect(`/finance/reports?tab=pnl&${days}`);
}
