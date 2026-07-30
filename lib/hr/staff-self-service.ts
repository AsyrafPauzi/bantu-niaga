import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { EMPLOYEE_LIST_SELECT } from "@/lib/hr/employee-fields";
import { mapEmployeeListRow } from "@/lib/hr/employee-api";
import type { HrEmployeeRow } from "@/lib/hr/load";
import { hasStaffPortalAddon } from "@/lib/marketplace/entitlements";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface StaffMeContext {
  user: CurrentUser;
  employee: HrEmployeeRow;
}

export type StaffMePageContext =
  | ({ kind: "ok" } & StaffMeContext)
  | { kind: "redirect"; path: string }
  | { kind: "unauthorized" }
  | { kind: "addon_inactive" }
  | { kind: "not_linked" };

export function canUseStaffSelfService(role: CurrentUser["role"]): boolean {
  return role === "staff";
}

export async function loadHrEmployeeByUserId(
  businessId: string,
  userId: string,
): Promise<HrEmployeeRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_employees")
    .select(EMPLOYEE_LIST_SELECT)
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return mapEmployeeListRow(data as unknown as Record<string, unknown>);
}

export async function requireStaffMeContext(): Promise<
  StaffMeContext | NextResponse
> {
  let user: CurrentUser;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: error.code },
        { status: 401 },
      );
    }
    throw error;
  }

  if (!canUseStaffSelfService(user.role)) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Staff self-service is only available to staff accounts.",
      },
      { status: 403 },
    );
  }

  const addonActive = await hasStaffPortalAddon(user.businessId);
  if (!addonActive) {
    return NextResponse.json(
      {
        error: "addon_inactive",
        message:
          "Staff self-service is not enabled for your company. Ask your owner to activate Staff Self-Service Portal in Marketplace.",
      },
      { status: 403 },
    );
  }

  const employee = await loadHrEmployeeByUserId(user.businessId, user.id);
  if (!employee) {
    return NextResponse.json(
      {
        error: "employee_not_linked",
        message:
          "Your login is not linked to an employee profile yet. Ask HR to link your account.",
      },
      { status: 404 },
    );
  }

  return { user, employee };
}

export async function loadStaffMePageContext(): Promise<StaffMePageContext> {
  let user: CurrentUser;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { kind: "unauthorized" };
    }
    throw error;
  }

  if (canUseStaffSelfService(user.role)) {
    const addonActive = await hasStaffPortalAddon(user.businessId);
    if (!addonActive) {
      return { kind: "addon_inactive" };
    }
    const employee = await loadHrEmployeeByUserId(user.businessId, user.id);
    if (!employee) {
      return { kind: "not_linked" };
    }
    return { kind: "ok", user, employee };
  }

  return {
    kind: "redirect",
    path: "/hr",
  };
}

/** Server page helper — redirects non-staff; returns null when layout gate applies. */
export async function resolveStaffMePage():
  Promise<StaffMeContext | null> {
  const ctx = await loadStaffMePageContext();
  if (ctx.kind === "unauthorized") {
    redirect("/sign-in");
  }
  if (ctx.kind === "redirect") {
    redirect(ctx.path);
  }
  if (ctx.kind === "addon_inactive" || ctx.kind === "not_linked") {
    return null;
  }
  return { user: ctx.user, employee: ctx.employee };
}
