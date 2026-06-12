import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Compliance" };

export default function CompliancePage() {
  return (
    <PillarStub
      pillar="Admin"
      surface="Compliance Calendar"
      description="Pre-seeded reminders for the recurring legal / licensing obligations that quietly bankrupt micro-SMEs when missed."
      baseFeatures={[
        "SSM business registration renewal",
        "Local council signboard licence (papan tanda)",
        "Halal certification renewal",
        "Food handler / typhoid jab certificate",
        "Premises insurance / fire insurance",
        "Tenancy agreement end date",
        "Monthly EPF / SOCSO / LHDN filing dates (informational)",
      ]}
    />
  );
}
