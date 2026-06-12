import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <PillarStub
      pillar="Pillar 1"
      surface="Admin"
      description="Daily back-office: documents, tasks, notifications, compliance, signatures."
      baseFeatures={[
        "Digital Storage 1 GB · folder + tag organization · image / PDF preview",
        "Smart Task Matrix (Kanban: To-Do → Doing → Done)",
        "System Notification Feed (cross-pillar events)",
        "Document Template Library (locked layouts, fill-in-the-blank)",
        "Compliance Calendar — SSM, signboard licence, halal cert, insurance",
        "Digital Signature on Shared Documents",
      ]}
    />
  );
}
