import { requirePillar } from "@/lib/auth/require-pillar";

export default async function SalesPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePillar("sales");
  return <>{children}</>;
}
