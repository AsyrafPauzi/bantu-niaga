import { requirePillar } from "@/lib/auth/require-pillar";

export default async function MarketingPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePillar("marketing");
  return <>{children}</>;
}
