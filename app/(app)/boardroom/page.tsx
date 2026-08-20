import { redirect } from "next/navigation";
import { BoardroomBackLink } from "@/components/boardroom/BoardroomBackLink";
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
      <BoardroomBackLink />

      {!status.unlocked ? (
        <BoardroomGate agents={status.agents} activeCount={status.activeCount} />
      ) : (
        <BoardroomMeetingClient agents={status.agents} />
      )}
    </div>
  );
}

