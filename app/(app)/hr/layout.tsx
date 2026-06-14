import { requirePillar } from "@/lib/auth/require-pillar";

export default async function HrPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePillar("hr");
  return <>{children}</>;
}
