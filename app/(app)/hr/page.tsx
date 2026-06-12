import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "HR" };

export default function HrPage() {
  return (
    <PillarStub
      pillar="Pillar 6"
      surface="Human Resource"
      description="Keep employee data safe, manage leave, track public holidays, generate contracts."
      baseFeatures={[
        "Core HRM Registry (employees, encrypted IC + bank fields)",
        "Leave Overview Dashboard (AL · EL · MC) with carry-forward rules",
        "State-Aware Malaysian Public-Holiday Calendar",
        "Onboarding Checklist (template per business)",
        "Contract / Employment Letter Generator (uses Admin Templates)",
      ]}
    />
  );
}
