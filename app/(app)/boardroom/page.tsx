import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BoardroomMeetingClient } from "@/components/boardroom/BoardroomMeetingClient";
import { BoardroomGate } from "@/components/boardroom/BoardroomGate";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageBoardroom } from "@/lib/ai/boardroom-access";
import { loadBoardroomStatus } from "@/lib/ai/boardroom";

export const metadata = { title: "Boardroom" };
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
    <div className="space-y-4 pb-8">
      <Link
        href="/home"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-brand-700 dark:text-cream-400 dark:hover:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Home
      </Link>

      {!status.unlocked ? (
        <BoardroomGate agents={status.agents} activeCount={status.activeCount} />
      ) : (
        <BoardroomMeetingClient agents={status.agents} />
      )}
    </div>
  );
}
