import type { Role } from "@/lib/permissions";

export type DeletionScope = "user" | "business";

/** Only the business owner may schedule deletion of the entire tenant. */
export function canScheduleDeletionScope(
  role: Role,
  scope: DeletionScope,
): boolean {
  if (scope === "business") return role === "owner";
  return true;
}
