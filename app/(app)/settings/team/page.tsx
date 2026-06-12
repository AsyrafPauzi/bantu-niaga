import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Team" };

export default function TeamSettingsPage() {
  return (
    <PillarStub
      pillar="Settings"
      surface="Team & Roles"
      description="Invite staff, assign roles, revoke access, view activity log. Owner-only."
      baseFeatures={[
        "6 roles: Owner · Manager · Accountant · HR Officer · Cashier · Staff",
        "Magic-link invite flow (Supabase Auth)",
        "Per-role permission preview",
        "Activity log (audit trail)",
      ]}
      primaryMode="desktop"
    />
  );
}
