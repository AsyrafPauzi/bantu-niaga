import { redirect } from "next/navigation";
import { HrMeGate } from "@/components/hr/me/HrMeGate";
import { loadStaffMePageContext } from "@/lib/hr/staff-self-service";

export default async function HrMeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await loadStaffMePageContext();

  if (ctx.kind === "unauthorized") {
    redirect("/sign-in");
  }
  if (ctx.kind === "redirect") {
    redirect(ctx.path);
  }
  if (ctx.kind === "addon_inactive") {
    return <HrMeGate kind="addon_inactive" />;
  }
  if (ctx.kind === "not_linked") {
    return <HrMeGate kind="not_linked" />;
  }

  return children;
}
