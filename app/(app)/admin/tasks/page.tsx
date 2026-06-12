import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <PillarStub
      pillar="Admin"
      surface="Smart Task Matrix"
      description="Kanban grid for daily to-dos: To-Do → Doing → Done. Mobile-first with tap-to-drag."
      baseFeatures={[
        "Default board per business",
        "Tap-to-drag between columns",
        "Optional due date + reminder",
        "Assignee picker (multi-user)",
      ]}
    />
  );
}
