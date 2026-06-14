import { requirePillar } from "@/lib/auth/require-pillar";

export default async function AdminPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePillar("admin");
  return <>{children}</>;
}
