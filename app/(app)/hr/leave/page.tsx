import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Leave" };

export default function LeavePage() {
  return (
    <PillarStub
      pillar="HR"
      surface="Leave Dashboard"
      description="Centralized leave tracking — AL · EL · MC."
      baseFeatures={[
        "Per-employee balance + history",
        "Calendar view (day / week / month)",
        "AL carry-forward rules (configurable per business)",
        "Public holidays auto-marked (state-aware)",
        "Manual entry by admin (self-service via add-on)",
      ]}
    />
  );
}
