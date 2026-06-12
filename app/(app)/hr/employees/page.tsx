import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Employees" };

export default function EmployeesPage() {
  return (
    <PillarStub
      pillar="HR"
      surface="Employee Registry"
      description="Secure storage locker for employee data. Replaces IC photos in WhatsApp."
      baseFeatures={[
        "Name · IC (encrypted) · IC copy upload",
        "Emergency contact: name, relationship, phone",
        "Bank account routing keys (encrypted)",
        "Role · employment type · start date",
        "Onboarding checklist applied per new employee",
        "Generate Employment / Confirmation / Termination letters",
      ]}
      primaryMode="desktop"
    />
  );
}
