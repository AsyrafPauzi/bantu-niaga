/**
 * Helpers for linking a Settings → Team login to an HR employee row.
 */

export type LinkableTeamMember = {
  id: string;
  email: string | null;
  display_name: string | null;
  role?: string;
};

/** Suggest a team member when employee email matches (case-insensitive). */
export function suggestTeamMemberByEmail(
  employeeEmail: string | null | undefined,
  members: LinkableTeamMember[],
  takenUserIds: ReadonlySet<string>,
): string | null {
  const needle = employeeEmail?.trim().toLowerCase();
  if (!needle) return null;
  const hit = members.find((m) => {
    if (takenUserIds.has(m.id)) return false;
    return (m.email ?? "").trim().toLowerCase() === needle;
  });
  return hit?.id ?? null;
}

export function filterAvailableTeamMembers(
  members: LinkableTeamMember[],
  takenUserIds: ReadonlySet<string>,
  currentUserId: string | null,
): LinkableTeamMember[] {
  return members.filter(
    (m) => m.id === currentUserId || !takenUserIds.has(m.id),
  );
}
