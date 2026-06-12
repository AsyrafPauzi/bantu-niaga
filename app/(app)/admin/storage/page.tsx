import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Storage" };

export default function StoragePage() {
  return (
    <PillarStub
      pillar="Admin"
      surface="Digital Storage"
      description="Secure cloud repository for business documents and receipts. 1 GB included on every account."
      baseFeatures={[
        "1 GB free tier",
        "Folder + tag organization",
        "Image preview (receipts, ICs, contracts) and PDF preview",
        "Upload from camera or gallery on mobile",
        "Secure-hash share links",
      ]}
      primaryMode="desktop"
    />
  );
}
