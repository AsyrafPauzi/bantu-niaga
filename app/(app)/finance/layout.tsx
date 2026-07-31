import { requirePillar } from "@/lib/auth/require-pillar";

export default async function FinancePillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePillar("finance");
  return <>{children}</>;
}
