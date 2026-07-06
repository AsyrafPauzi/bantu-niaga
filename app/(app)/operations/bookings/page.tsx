import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { OperationsBookingPanel } from "@/components/operations/OperationsBookingPanel";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  OperationsBookingResourceRow,
  OperationsBookingRow,
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

  const [bookingsRes, resourcesRes] = await Promise.all([
    supabase
      .from("operations_bookings")
      .select(
        "id, business_id, number, resource_id, customer_name, customer_phone, " +
          "service_title, starts_at, ends_at, status, amount_myr, notes, " +
          "completed_at, created_by, created_at, updated_at",
      )
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true }),
    supabase
      .from("operations_booking_resources")
      .select(
        "id, business_id, name, description, buffer_minutes, is_active, " +
          "created_by, created_at, updated_at",
      )
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  const bookings = (bookingsRes.data ?? []) as unknown as OperationsBookingRow[];
  const resources = (resourcesRes.data ??
    []) as unknown as OperationsBookingResourceRow[];

  const resourceLookup = new Map(resources.map((r) => [r.id, r.name]));
  const enriched = bookings.map((b) => ({
    ...b,
    resource_name: b.resource_id
      ? (resourceLookup.get(b.resource_id) ?? null)
      : null,
  }));

  const error = bookingsRes.error ?? resourcesRes.error;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        description="Appointments and reservations — held → confirmed → completed."
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load bookings: {error.message}
          </CardBody>
        </Card>
      ) : (
        <OperationsBookingPanel
          initialBookings={enriched}
          initialResources={resources}
        />
      )}
    </div>
  );
}
