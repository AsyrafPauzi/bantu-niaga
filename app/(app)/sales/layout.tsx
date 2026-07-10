import { requirePillar } from "@/lib/auth/require-pillar";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SalesGuideJourney } from "@/components/sales/SalesGuideJourney";

export default async function SalesPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePillar("sales");
  let businessId: string | null = null;
  try {
    const user = await getCurrentUser();
    businessId = user.businessId;
  } catch {
    businessId = null;
  }

  return (
    <>
      {businessId ? <SalesGuideJourney businessId={businessId} /> : null}
      {children}
    </>
  );
}
