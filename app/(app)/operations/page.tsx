import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Operations" };

export default function OperationsPage() {
  return (
    <PillarStub
      pillar="Pillar 3"
      surface="Operations"
      description="Move work from order to delivery; manage suppliers, products, bookings."
      baseFeatures={[
        "Order Fulfillment Pipeline (Kanban) — configurable columns",
        "Supplier Directory + material cost log",
        "Product Manager (catalog) — variants in core (size / colour / weight)",
        "Services & Booking Slot Manager — buffer time per resource",
        "Customer-Facing Booking Page (public secure-hash URL)",
      ]}
    />
  );
}
