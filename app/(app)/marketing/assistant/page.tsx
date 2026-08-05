import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy route — Maya now opens as a floating panel on any Marketing page. */
export default async function MarketingAssistantRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams({ maya: "open" });
  const seed =
    typeof sp.seed === "string" && sp.seed.trim().length > 0
      ? sp.seed.trim().slice(0, 2000)
      : undefined;
  if (seed) {
    params.set("seed", seed);
  }
  redirect(`/marketing?${params.toString()}`);
}
