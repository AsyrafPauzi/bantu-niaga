import { requirePillar } from "@/lib/auth/require-pillar";
import { getCurrentUser } from "@/lib/auth/current-user";
import { MarketingGuideJourney } from "@/components/marketing/MarketingGuideJourney";

export default async function MarketingPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePillar("marketing");
  let businessId: string | null = null;
  try {
    const user = await getCurrentUser();
    businessId = user.businessId;
  } catch {
    businessId = null;
  }

  return (
    <>
      {businessId ? <MarketingGuideJourney businessId={businessId} /> : null}
      {children}
    </>
  );
}
