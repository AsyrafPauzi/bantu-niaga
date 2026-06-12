import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Content Calendar" };

export default function ContentCalendarPage() {
  return (
    <PillarStub
      pillar="Marketing"
      surface="Content Calendar"
      description="Plan TikTok / IG / FB posts on a calendar. v1 is plan-only — does not auto-post."
      baseFeatures={[
        "Channels: TikTok · Instagram · Facebook",
        "Day / week / month calendar views",
        "Entry: channel, scheduled date+time, caption draft, hook, attached media",
        "Status: Idea → Drafted → Scheduled → Posted",
      ]}
      primaryMode="desktop"
    />
  );
}
