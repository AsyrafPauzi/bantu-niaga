import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <PillarStub
      pillar="Admin"
      surface="Document Templates"
      description="Interactive form templates for standard Malaysian business documents. Locked layouts, fill-in-the-blank fields, secure share link."
      baseFeatures={[
        "Tenancy Agreement",
        "Letter of Offer",
        "Quotation",
        "Output: PDF + secure share link",
        "Recipient signs via Digital Signature flow",
      ]}
      primaryMode="desktop"
    />
  );
}
