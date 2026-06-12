import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <PillarStub
      pillar="Operations"
      surface="Product Manager"
      description="Catalog of products with variants. Drives the POS grid and the order pipeline."
      baseFeatures={[
        "Fields: SKU, name, description, image, base price, group/category",
        "Variants: one parent SKU → N variants (size / colour / weight)",
        "Group products by category for the POS grid",
        "Stock counts via the Micro Stock Tracker add-on (deferred)",
      ]}
      primaryMode="desktop"
    />
  );
}
