import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "AI Boardroom" };

export default function BoardroomPage() {
  return (
    <PillarStub
      pillar="AI"
      surface="Executive Boardroom"
      description="Multi-agent business decisions. Ask one business question; get perspectives from Marketing, Finance, Operations, HR, and Sales AI agents."
      baseFeatures={[
        "Activates when ≥ 2 AI Agents are subscribed",
        "Sequential orchestration with relevance safeguard filter",
        "Per-Agent context slice (token-bounded)",
        "Synthesized recommendation block",
        "Saved Boardroom history (Phase 5)",
      ]}
      primaryMode="desktop"
    />
  );
}
