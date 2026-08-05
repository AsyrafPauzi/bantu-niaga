import { redirect } from "next/navigation";
import { OperationsBookingPanel } from "@/components/operations/OperationsBookingPanel";
import { OperationsSubpageShell } from "@/components/operations/OperationsSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { Card, CardBody } from "@/components/ui/card";
import { OperationsBackLink } from "@/components/operations/OperationsBackLink";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { computeOperationsSummary } from "@/lib/operations/helpers";
import { loadActiveLeaveBlocks } from "@/lib/operations/leave-blocks";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  OperationsBookingResourceRow,
  OperationsBookingRow,
  OperationsServiceRow,
} from "@/lib/operations/schemas";

export const metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!can(user.role, "operations")) {
    redirect("/home");
  }

  const supabase = await createSupabaseServerClient();

  const [bookingsRes, resourcesRes, servicesRes, employeesRes, leaveBlocks, summary] =
    await Promise.all([
    supabase
      .from("operations_bookings")
      .select(
        "id, business_id, number, resource_id, service_id, customer_name, customer_phone, " +
          "service_title, starts_at, ends_at, status, amount_myr, notes, " +
          "completed_at, created_by, created_at, updated_at",
      )
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true }),
    supabase
      .from("operations_booking_resources")
      .select(
        "id, business_id, name, description, buffer_minutes, is_active, employee_id, " +
          "created_by, created_at, updated_at",
      )
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("operations_services")
      .select(
        "id, business_id, name, description, duration_minutes, price_myr, " +
          "is_active, notes, created_by, created_at, updated_at",
      )
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("hr_employees")
      .select("id, full_name")
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    loadActiveLeaveBlocks(supabase, user.businessId),
    computeOperationsSummary(supabase, user.businessId),
  ]);

  const bookings = (bookingsRes.data ?? []) as unknown as OperationsBookingRow[];
  const resources = (resourcesRes.data ??
    []) as unknown as OperationsBookingResourceRow[];
  const services = (servicesRes.data ??
    []) as unknown as OperationsServiceRow[];
  const employees = (employeesRes.data ?? []) as Array<{
    id: string;
    full_name: string;
  }>;
  const employeeLookup = new Map(employees.map((e) => [e.id, e.full_name]));
  const enrichedResources = resources.map((r) => ({
    ...r,
    employee_name: r.employee_id
      ? (employeeLookup.get(r.employee_id) ?? null)
      : null,
  }));

  const resourceLookup = new Map(enrichedResources.map((r) => [r.id, r.name]));
  const enriched = bookings.map((b) => ({
    ...b,
    resource_name: b.resource_id
      ? (resourceLookup.get(b.resource_id) ?? null)
      : null,
  }));

  const error = bookingsRes.error ?? resourcesRes.error ?? servicesRes.error;

  const heroHeadline =
    summary.upcoming_bookings > 0
      ? `${summary.upcoming_bookings} upcoming appointment${summary.upcoming_bookings === 1 ? "" : "s"}`
      : bookings.length > 0
        ? "Calendar is clear — time to fill slots"
        : "Your booking calendar is ready";

  const heroSub =
    summary.upcoming_bookings > 0
      ? "List or week view — advance held → confirmed → completed from each row."
      : "Add resources, pick a service, and book your first customer slot.";

  if (error) {
    return (
      <div className="space-y-4">
        <OperationsBackLink />
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load bookings: {error.message}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <OperationsSubpageShell
      headline={heroHeadline}
      subcopy={heroSub}
      variant={summary.upcoming_bookings > 0 ? "calm" : "calm"}
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <ModuleHeroStat
            label="Upcoming"
            value={summary.upcoming_bookings}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Resources"
            value={summary.resource_count}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Services"
            value={summary.active_service_count}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
        </div>
      }
    >
      <OperationsBookingPanel
        initialBookings={enriched}
        initialResources={enrichedResources}
        initialServices={services}
        employees={employees}
        leaveBlocks={leaveBlocks}
      />
    </OperationsSubpageShell>
  );
}
