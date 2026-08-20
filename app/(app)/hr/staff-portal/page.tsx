import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrStaffPortalPanel } from "@/components/hr/HrStaffPortalPanel";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Staff portal" };
export const dynamic = "force-dynamic";

export default async function HrStaffPortalPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canManageHrCore(user.role)) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-ink-muted dark:text-cream-400">
          You do not have access to staff portal settings.
        </CardBody>
      </Card>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: employeeRows } = await supabase
    .from("hr_employees")
    .select("user_id")
    .eq("business_id", user.businessId)
    .eq("status", "active")
    .is("deleted_at", null);

  const rows = employeeRows ?? [];
  const totalCount = rows.length;
  const linkedCount = rows.filter((r) => r.user_id).length;

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Staff portal"
          subtitle="Link team logins so staff can use /hr/me — included on Solo+"
          helpHref="/more"
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />
        <HrStaffPortalPanel linkedCount={linkedCount} totalCount={totalCount} />
      </HrPageBody>
    </HrPageShell>
  );
}
