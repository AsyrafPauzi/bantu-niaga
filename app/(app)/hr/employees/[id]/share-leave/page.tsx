import { redirect } from "next/navigation";

export const metadata = { title: "Send leave request link" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Legacy route — leave link is inline on the employee profile. */
export default async function ShareLeavePage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/hr/employees/${id}?tab=leave&leave_link=1`);
}
