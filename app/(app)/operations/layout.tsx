import { requirePillar } from "@/lib/auth/require-pillar";

export default async function OperationsPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePillar("operations");
  return <>{children}</>;
}
