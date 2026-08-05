import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import { BOARDROOM_AGENTS } from "@/lib/ai/boardroom-shared";
import type { Role } from "@/lib/permissions";

/** Module staff who can be invited when subscribed and switched on. */
export const BOARDROOM_INVITABLE: BoardroomAgentId[] = BOARDROOM_AGENTS.map(
  (a) => a.id,
);

/** @deprecated use BOARDROOM_INVITABLE */
export const BOARDROOM_INVITABLE_V1 = BOARDROOM_INVITABLE;

export function canManageBoardroom(role: Role): boolean {
  return role === "owner" || role === "manager";
}

export function boardroomAgentLabel(id: string): string {
  return BOARDROOM_AGENTS.find((a) => a.id === id)?.label ?? id;
}

/** Tenant display name from Settings, else catalog default (Maya, Fayza, …). */
export function resolveBoardroomDisplayName(
  id: string,
  displayNames?: Record<string, string>,
): string {
  const custom = displayNames?.[id]?.trim();
  return custom || boardroomAgentLabel(id);
}

export function isBoardroomInvitable(id: string): id is BoardroomAgentId {
  return (BOARDROOM_INVITABLE as string[]).includes(id);
}

/** @deprecated use isBoardroomInvitable */
export function isInvitableV1(id: string): id is BoardroomAgentId {
  return isBoardroomInvitable(id);
}
