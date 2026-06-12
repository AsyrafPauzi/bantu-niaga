/**
 * <RequirePermission> — server-side UI guard.
 *
 * Hides a subtree from roles that don't have access to the given pillar /
 * surface. This is the *UI hide* layer of defense-in-depth — API routes and
 * Postgres RLS still enforce the same rules.
 *
 * Usage:
 *   <RequirePermission area="finance">
 *     <FinancePage />
 *   </RequirePermission>
 *
 *   <RequirePermission area="sales" surface="pos">
 *     <PosTerminal />
 *   </RequirePermission>
 */
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can, canSurface, type RolePermissions } from "@/lib/permissions";
import { Card, CardBody } from "@/components/ui/card";

interface RequirePermissionProps {
  area: keyof RolePermissions;
  surface?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

function NoAccessCard() {
  return (
    <Card className="bg-cream-100 border-cream-300">
      <CardBody className="space-y-1">
        <p className="text-sm font-semibold text-ink">No access</p>
        <p className="text-sm text-ink-muted">
          You don&apos;t have access to this area. Ask your business owner to
          enable it for your role.
        </p>
      </CardBody>
    </Card>
  );
}

export async function RequirePermission({
  area,
  surface,
  fallback,
  children,
}: RequirePermissionProps) {
  const { role } = await getCurrentUser();

  const allowed = surface
    ? canSurface(role, area, surface)
    : can(role, area);

  if (!allowed) {
    return <>{fallback ?? <NoAccessCard />}</>;
  }

  return <>{children}</>;
}
