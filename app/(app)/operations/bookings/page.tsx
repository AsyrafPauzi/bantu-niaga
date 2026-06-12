import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Bookings" };

export default function BookingsPage() {
  return (
    <PillarStub
      pillar="Operations"
      surface="Bookings"
      description="Calendar booking system for time-allocated or reservation-based businesses (homestay, salon, tuition, rentals)."
      baseFeatures={[
        "Resources (room, chair, vehicle, instructor) + Service Types",
        "Calendar views: day / week / month",
        "Slot states: Available → Held → Confirmed → Completed → Cancelled",
        "Buffer time per resource (e.g. 10 min salon turnover)",
        "Customer-facing public booking page",
        "Optional invoice generation on confirmation",
      ]}
    />
  );
}
