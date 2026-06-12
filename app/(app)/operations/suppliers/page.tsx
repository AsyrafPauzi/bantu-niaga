import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Suppliers" };

export default function SuppliersPage() {
  return (
    <PillarStub
      pillar="Operations"
      surface="Supplier Directory"
      description="Master contact list of vendors with material cost log per vendor."
      baseFeatures={[
        "Vendor record: name, contact, address, payment terms, notes",
        "Material cost log: product, qty, unit cost, purchase date",
        "Useful for COGS reporting",
      ]}
      primaryMode="desktop"
    />
  );
}
