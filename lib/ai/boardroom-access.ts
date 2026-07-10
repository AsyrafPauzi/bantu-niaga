import type { Role } from "@/lib/permissions";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import { BOARDROOM_AGENTS } from "@/lib/ai/boardroom-shared";

/** v1 inviteable agents — expand when Finance/Ops chat ships. */
export const BOARDROOM_INVITABLE_V1: BoardroomAgentId[] = [
  "marketing",
  "hr",
  "sales",
];

export function canManageBoardroom(role: Role): boolean {
  return role === "owner" || role === "manager";
}

export function boardroomAgentLabel(id: string): string {
  return BOARDROOM_AGENTS.find((a) => a.id === id)?.label ?? id;
}

export function isInvitableV1(id: string): id is BoardroomAgentId {
  return (BOARDROOM_INVITABLE_V1 as string[]).includes(id);
}
