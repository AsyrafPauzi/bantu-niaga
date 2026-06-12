import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Marketplace" };

export default function MarketplacePage() {
  return (
    <PillarStub
      pillar="Cross-cutting"
      surface="Marketplace"
      description="Add-on activation. Owners enable add-ons with one tap; billing prorates. Deferred until v1 core ships."
      baseFeatures={[
        "Per-pillar add-on catalog (see docs/marketplace-addons.md)",
        "Activation prorated to current cycle",
        "Deactivation effective at next cycle",
        "Add-on dependencies + interactions",
      ]}
      primaryMode="desktop"
    />
  );
}
