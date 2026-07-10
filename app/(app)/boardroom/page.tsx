import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusPill } from "@/components/dashboard/status-pill";
import { BoardroomMeetingClient } from "@/components/boardroom/BoardroomMeetingClient";
import { BoardroomGate } from "@/components/boardroom/BoardroomGate";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageBoardroom } from "@/lib/ai/boardroom-access";
import { loadBoardroomStatus } from "@/lib/ai/boardroom";

export const metadata = { title: "AI Boardroom" };
export const dynamic = "force-dynamic";

export default async function BoardroomPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canManageBoardroom(user.role)) {
    redirect("/home");
  }

  const status = await loadBoardroomStatus(user.businessId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Boardroom"
        title="Executive room"
        description="Pick who joins, ask one business question — staff agents clarify or speak, then a shared recommendation."
        action={
          status.unlocked ? (
            <StatusPill tone="brand">
              {`${status.activeCount} agents live`}
            </StatusPill>
          ) : (
            <StatusPill tone="warning">
              {`${status.activeCount} / 2 agents needed`}
            </StatusPill>
          )
        }
      />

      {!status.unlocked ? (
        <>
          <BoardroomGate agents={status.agents} activeCount={status.activeCount} />
          <p className="text-center text-xs text-ink-muted dark:text-cream-400">
            Already activated another agent?{" "}
            <Link
              href="/marketplace"
              className="font-semibold text-brand-700 dark:text-brand-200"
            >
              Refresh from Marketplace
            </Link>
          </p>
        </>
      ) : (
        <BoardroomMeetingClient
          agents={status.agents}
          activeCount={status.activeCount}
        />
      )}
    </div>
  );
}
