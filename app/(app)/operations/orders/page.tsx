import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <PillarStub
      pillar="Operations"
      surface="Order Pipeline"
      description="Kanban pipeline tracking production stages from order receipt to customer delivery."
      baseFeatures={[
        "Default columns: New Order → In Progress → Ready → Delivered",
        "User-configurable column names + order (up to 8 columns)",
        "Order card → Customer (Marketing CRM) + Invoice (Finance)",
        "Drag-and-drop on mobile, tap-to-update on small screens",
        "Filters: status, date, customer",
      ]}
    />
  );
}
