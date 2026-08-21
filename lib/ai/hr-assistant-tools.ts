import "server-only";

import { z } from "zod";
import type { AgentContext } from "@/lib/ai/context/types";
import {
  applyAnnualLeaveApproval,
  loadEmployeeLeaveBalance,
} from "@/lib/hr/leave-balance";
import { analyzeLeaveDateRange } from "@/lib/hr/leave-date-check";
import {
  appraisalCreateSchema,
  appraisalUpdateSchema,
  LEAVE_TYPES,
  leaveCreateSchema,
  leaveStatusUpdateSchema,
} from "@/lib/hr/schemas";
import { hasStaffAppraisalAddon } from "@/lib/marketplace/entitlements";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const HR_ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_leave_balance",
      description:
        "Look up an employee's annual leave balance for the current year when the user asks how many days they have left.",
      parameters: {
        type: "object",
        properties: {
          employee_name: {
            type: "string",
            description: "Employee full or first name.",
          },
        },
        required: ["employee_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_leave_record",
      description:
        "Create a leave record when the user explicitly asks to record, book, or create leave (cuti/MC). Warns about weekends and public holidays in the range.",
      parameters: {
        type: "object",
        properties: {
          employee_name: { type: "string" },
          leave_type: {
            type: "string",
            enum: [...LEAVE_TYPES],
          },
          start_date: { type: "string", description: "YYYY-MM-DD" },
          end_date: { type: "string", description: "YYYY-MM-DD" },
          reason: { type: "string" },
        },
        required: ["employee_name", "leave_type", "start_date", "end_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_leave_status",
      description:
        "Approve or reject a pending leave request. Use leave_id or start_date when the employee has more than one pending request.",
      parameters: {
        type: "object",
        properties: {
          employee_name: { type: "string" },
          decision: { type: "string", enum: ["approved", "rejected"] },
          leave_id: {
            type: "string",
            description: "Optional UUID from the data packet.",
          },
          start_date: {
            type: "string",
            description: "Optional YYYY-MM-DD to pick a specific pending request.",
          },
          decision_note: { type: "string" },
        },
        required: ["employee_name", "decision"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_onboarding_item",
      description:
        "Mark an open onboarding checklist item as done when the user confirms (e.g. completed orientation, submitted IC).",
      parameters: {
        type: "object",
        properties: {
          employee_name: { type: "string" },
          item_label: {
            type: "string",
            description: "Part of the checklist label to match.",
          },
        },
        required: ["employee_name", "item_label"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_staff_appraisal",
      description:
        "Schedule a staff performance appraisal when the user asks to set up, schedule, or create a review. Requires Staff Appraisal Checker add-on.",
      parameters: {
        type: "object",
        properties: {
          employee_name: { type: "string" },
          period_label: {
            type: "string",
            description: "e.g. 2026 Annual, Q1 2026",
          },
          due_date: { type: "string", description: "YYYY-MM-DD" },
          notes: { type: "string" },
        },
        required: ["employee_name", "period_label", "due_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_staff_appraisal",
      description:
        "Mark a pending staff appraisal as completed when the user confirms the review is done. Optional rating 1–5. Requires Staff Appraisal Checker add-on.",
      parameters: {
        type: "object",
        properties: {
          employee_name: { type: "string" },
          period_label: {
            type: "string",
            description: "Match scheduled period when multiple exist.",
          },
          appraisal_id: {
            type: "string",
            description: "Optional UUID from the data packet.",
          },
          rating: {
            type: "integer",
            description: "Optional score 1–5.",
            minimum: 1,
            maximum: 5,
          },
          notes: { type: "string" },
        },
        required: ["employee_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_employees",
      description:
        "List employees with optional filters. Use when the user asks to see, search, or count employees.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "inactive", "all"],
            description: "Filter by employment status. Defaults to active.",
          },
          q: {
            type: "string",
            description: "Search by name (partial match, max 80 chars).",
          },
          limit: {
            type: "integer",
            description: "Number of results to return (1–30). Defaults to 20.",
            minimum: 1,
            maximum: 30,
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_leave_records",
      description:
        "List leave records filtered by employee, status, or date range. Use when the user asks about leave history, upcoming leave, or pending requests.",
      parameters: {
        type: "object",
        properties: {
          employee_name: {
            type: "string",
            description: "Filter by employee name.",
          },
          status: {
            type: "string",
            enum: ["pending", "approved", "rejected", "all"],
            description: "Filter by leave status. Defaults to all.",
          },
          from_date: {
            type: "string",
            description: "Start of date range (YYYY-MM-DD).",
          },
          to_date: {
            type: "string",
            description: "End of date range (YYYY-MM-DD).",
          },
          limit: {
            type: "integer",
            description: "Number of results to return (1–30). Defaults to 15.",
            minimum: 1,
            maximum: 30,
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_employee_profile",
      description:
        "Get full HR profile for one employee including leave balance, onboarding items, and recent leave history. Use when user asks about a specific employee's details.",
      parameters: {
        type: "object",
        properties: {
          employee_name: {
            type: "string",
            description: "Full or partial employee name.",
          },
        },
        required: ["employee_name"],
        additionalProperties: false,
      },
    },
  },
];

const getBalanceArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160),
});

const createLeaveArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160),
  leave_type: z.enum(LEAVE_TYPES),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(500).optional(),
});

const updateLeaveStatusArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160),
  decision: z.enum(["approved", "rejected"]),
  leave_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  decision_note: z.string().trim().max(500).optional(),
});

const completeOnboardingArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160),
  item_label: z.string().trim().min(1).max(200),
});

const createAppraisalArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160),
  period_label: z.string().trim().min(1).max(80),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(1000).optional(),
});

const completeAppraisalArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160),
  period_label: z.string().trim().min(1).max(80).optional(),
  appraisal_id: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const listEmployeesArgsSchema = z.object({
  status: z.enum(["active", "inactive", "all"]).optional().default("active"),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional().default(20),
});

const listLeaveRecordsArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160).optional(),
  status: z.enum(["pending", "approved", "rejected", "all"]).optional().default("all"),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional().default(15),
});

const getEmployeeProfileArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160),
});

type HrToolSuccess = {
  ok: true;
  action: string;
  warnings?: string[];
  href?: string;
  [key: string]: unknown;
};

export type HrToolResult =
  | HrToolSuccess
  | { ok: false; action: string; message: string; href?: string };

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveEmployeeByName(
  businessId: string,
  nameQuery: string,
): Promise<
  | { kind: "one"; id: string; full_name: string; entitlement: number }
  | { kind: "none" }
  | { kind: "many"; names: string[] }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_employees")
    .select("id, full_name, annual_leave_entitlement_days")
    .eq("business_id", businessId)
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (error) throw new Error("Could not load employees.");

  const query = normalizeName(nameQuery);
  const matches = (data ?? []).filter((row) =>
    normalizeName(row.full_name).includes(query),
  );

  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) {
    return {
      kind: "one",
      id: matches[0].id,
      full_name: matches[0].full_name,
      entitlement: Number(matches[0].annual_leave_entitlement_days ?? 8),
    };
  }
  return { kind: "many", names: matches.map((m) => m.full_name) };
}

export async function executeGetLeaveBalance(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof getBalanceArgsSchema>;
  try {
    args = getBalanceArgsSchema.parse(rawArgs);
  } catch {
    return { ok: false, action: "get_leave_balance", message: "Invalid request." };
  }

  const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
  if (employee.kind === "none") {
    return {
      ok: false,
      action: "get_leave_balance",
      message: `No active employee matching "${args.employee_name}".`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "get_leave_balance",
      message: `Several employees match: ${employee.names.join(", ")}.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const balance = await loadEmployeeLeaveBalance(
    supabase,
    ctx.businessId,
    employee.id,
    employee.entitlement,
  );

  return {
    ok: true,
    action: "get_leave_balance",
    employee_name: employee.full_name,
    leave_year: balance.leaveYear,
    entitlement_days: balance.entitlementDays,
    taken_days: balance.takenDays,
    available_days: balance.availableDays,
    href: `/hr/employees/${employee.id}?tab=leave`,
  };
}

export async function executeCreateLeaveRecord(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof createLeaveArgsSchema>;
  try {
    args = createLeaveArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "create_leave_record",
      message: "Invalid leave details. Use YYYY-MM-DD dates and a valid leave type.",
    };
  }

  const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
  if (employee.kind === "none") {
    return {
      ok: false,
      action: "create_leave_record",
      message: `No active employee matching "${args.employee_name}".`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "create_leave_record",
      message: `Several employees match: ${employee.names.join(", ")}.`,
    };
  }

  let payload: z.infer<typeof leaveCreateSchema>;
  try {
    payload = leaveCreateSchema.parse({
      employee_id: employee.id,
      leave_type: args.leave_type,
      start_date: args.start_date,
      end_date: args.end_date,
      reason: args.reason ?? null,
    });
  } catch {
    return {
      ok: false,
      action: "create_leave_record",
      message: "End date cannot be before start date.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const dateAnalysis = await analyzeLeaveDateRange(
    supabase,
    ctx.businessId,
    args.start_date,
    args.end_date,
  );

  const { data, error } = await supabase
    .from("hr_leave_records")
    .insert({
      ...payload,
      business_id: ctx.businessId,
      requested_by: ctx.userId,
    })
    .select("id, leave_type, start_date, end_date, status")
    .single();

  if (error || !data) {
    return {
      ok: false,
      action: "create_leave_record",
      message: "Could not save the leave record.",
    };
  }

  return {
    ok: true,
    action: "create_leave_record",
    employee_name: employee.full_name,
    leave_type: data.leave_type,
    start_date: data.start_date,
    end_date: data.end_date,
    status: data.status,
    leave_id: data.id,
    working_days_in_range: dateAnalysis.workingDays,
    warnings: dateAnalysis.warnings.length > 0 ? dateAnalysis.warnings : undefined,
    href: `/hr/leave/history`,
  };
}

export async function executeUpdateLeaveStatus(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof updateLeaveStatusArgsSchema>;
  try {
    args = updateLeaveStatusArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "update_leave_status",
      message: "Invalid approval details.",
    };
  }

  const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
  if (employee.kind === "none") {
    return {
      ok: false,
      action: "update_leave_status",
      message: `No active employee matching "${args.employee_name}".`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "update_leave_status",
      message: `Several employees match: ${employee.names.join(", ")}.`,
    };
  }

  let statusPayload: z.infer<typeof leaveStatusUpdateSchema>;
  try {
    statusPayload = leaveStatusUpdateSchema.parse({
      status: args.decision,
      decision_note: args.decision_note ?? null,
    });
  } catch {
    return {
      ok: false,
      action: "update_leave_status",
      message: "Could not validate the decision.",
    };
  }

  const supabase = await createSupabaseServerClient();

  let pendingQuery = supabase
    .from("hr_leave_records")
    .select("id, leave_type, start_date, end_date, status, employee_id")
    .eq("business_id", ctx.businessId)
    .eq("employee_id", employee.id)
    .eq("status", "pending");

  if (args.leave_id) {
    pendingQuery = pendingQuery.eq("id", args.leave_id);
  } else if (args.start_date) {
    pendingQuery = pendingQuery.eq("start_date", args.start_date);
  }

  const { data: pendingRows, error: findError } = await pendingQuery
    .order("created_at", { ascending: false })
    .limit(args.leave_id || args.start_date ? 1 : 5);

  if (findError) {
    return {
      ok: false,
      action: "update_leave_status",
      message: "Could not look up pending leave.",
    };
  }

  const pending = pendingRows?.[0];
  if (!pending) {
    return {
      ok: false,
      action: "update_leave_status",
      message: `No matching pending leave for ${employee.full_name}.`,
    };
  }
  if (!args.leave_id && !args.start_date && (pendingRows?.length ?? 0) > 1) {
    const options = (pendingRows ?? [])
      .map((r) => `${r.start_date}–${r.end_date} (${r.leave_type}, id ${r.id})`)
      .join("; ");
    return {
      ok: false,
      action: "update_leave_status",
      message: `Multiple pending requests — ask which dates or pass leave_id: ${options}`,
    };
  }

  const warnings: string[] = [];
  if (statusPayload.status === "approved" && pending.leave_type === "annual") {
    const analysis = await analyzeLeaveDateRange(
      supabase,
      ctx.businessId,
      String(pending.start_date),
      String(pending.end_date),
    );
    warnings.push(...analysis.warnings);
  }

  const { data, error } = await supabase
    .from("hr_leave_records")
    .update({
      status: statusPayload.status,
      decision_note: statusPayload.decision_note ?? null,
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("business_id", ctx.businessId)
    .eq("id", pending.id)
    .select("id, leave_type, start_date, end_date, status")
    .single();

  if (error || !data) {
    return {
      ok: false,
      action: "update_leave_status",
      message: "Could not update leave status.",
    };
  }

  if (
    statusPayload.status === "approved" &&
    pending.leave_type === "annual"
  ) {
    const result = await applyAnnualLeaveApproval(supabase, {
      businessId: ctx.businessId,
      employeeId: employee.id,
      startDate: String(pending.start_date),
      endDate: String(pending.end_date),
      entitlementDays: employee.entitlement,
    });
    if (result.warning) {
      warnings.push(result.warning.message);
    }
  }

  return {
    ok: true,
    action: "update_leave_status",
    employee_name: employee.full_name,
    leave_type: data.leave_type,
    start_date: data.start_date,
    end_date: data.end_date,
    status: data.status,
    leave_id: data.id,
    warnings: warnings.length > 0 ? warnings : undefined,
    href: "/hr/leave/history",
  };
}

export async function executeCompleteOnboardingItem(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof completeOnboardingArgsSchema>;
  try {
    args = completeOnboardingArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: "Invalid onboarding details.",
    };
  }

  const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
  if (employee.kind === "none") {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: `No active employee matching "${args.employee_name}".`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: `Several employees match: ${employee.names.join(", ")}.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const labelQuery = normalizeName(args.item_label);
  const { data: items, error: listError } = await supabase
    .from("hr_onboarding_items")
    .select("id, label, is_done")
    .eq("business_id", ctx.businessId)
    .eq("employee_id", employee.id)
    .eq("is_done", false);

  if (listError) {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: "Could not load onboarding items.",
    };
  }

  const matches = (items ?? []).filter((row) =>
    normalizeName(String(row.label)).includes(labelQuery),
  );
  if (matches.length === 0) {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: `No open onboarding item matching "${args.item_label}" for ${employee.full_name}.`,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: `Several items match: ${matches.map((m) => m.label).join(", ")}.`,
    };
  }

  const { data, error } = await supabase
    .from("hr_onboarding_items")
    .update({
      is_done: true,
      completed_by: ctx.userId,
      completed_at: new Date().toISOString(),
    })
    .eq("business_id", ctx.businessId)
    .eq("id", matches[0].id)
    .select("id, label, is_done")
    .single();

  if (error || !data) {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: "Could not update the onboarding item.",
    };
  }

  return {
    ok: true,
    action: "complete_onboarding_item",
    employee_name: employee.full_name,
    item_label: data.label,
    item_id: data.id,
    href: `/hr/employees/${employee.id}?tab=onboarding`,
  };
}

async function requireAppraisalAddon(
  businessId: string,
  action: string,
): Promise<HrToolResult | null> {
  const active = await hasStaffAppraisalAddon(businessId);
  if (!active) {
    return {
      ok: false,
      action,
      message:
        "Staff Appraisal Checker is not active. Activate it in Marketplace first.",
      href: "/marketplace",
    };
  }
  return null;
}

export async function executeCreateStaffAppraisal(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof createAppraisalArgsSchema>;
  try {
    args = createAppraisalArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "create_staff_appraisal",
      message: "Invalid appraisal details. Use YYYY-MM-DD for due_date.",
    };
  }

  const blocked = await requireAppraisalAddon(ctx.businessId, "create_staff_appraisal");
  if (blocked) return blocked;

  const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
  if (employee.kind === "none") {
    return {
      ok: false,
      action: "create_staff_appraisal",
      message: `No active employee matching "${args.employee_name}".`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "create_staff_appraisal",
      message: `Several employees match: ${employee.names.join(", ")}.`,
    };
  }

  let payload: z.infer<typeof appraisalCreateSchema>;
  try {
    payload = appraisalCreateSchema.parse({
      employee_id: employee.id,
      period_label: args.period_label,
      due_date: args.due_date,
      notes: args.notes ?? null,
    });
  } catch {
    return {
      ok: false,
      action: "create_staff_appraisal",
      message: "Could not validate appraisal fields.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_staff_appraisals")
    .insert({
      business_id: ctx.businessId,
      employee_id: payload.employee_id,
      period_label: payload.period_label,
      due_date: payload.due_date,
      notes: payload.notes ?? null,
    })
    .select(
      "id, employee_id, period_label, due_date, status, rating, notes, completed_at",
    )
    .single();

  if (error) {
    const duplicate = error.message.includes("unique");
    return {
      ok: false,
      action: "create_staff_appraisal",
      message: duplicate
        ? `${employee.full_name} already has an appraisal for "${payload.period_label}".`
        : "Could not schedule appraisal.",
    };
  }
  if (!data) {
    return {
      ok: false,
      action: "create_staff_appraisal",
      message: "Could not schedule appraisal.",
    };
  }

  return {
    ok: true,
    action: "create_staff_appraisal",
    employee_name: employee.full_name,
    period_label: data.period_label,
    due_date: data.due_date,
    status: data.status,
    appraisal_id: data.id,
    href: "/hr/appraisals",
  };
}

export async function executeCompleteStaffAppraisal(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof completeAppraisalArgsSchema>;
  try {
    args = completeAppraisalArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "complete_staff_appraisal",
      message: "Invalid completion details. Rating must be 1–5 if provided.",
    };
  }

  const blocked = await requireAppraisalAddon(ctx.businessId, "complete_staff_appraisal");
  if (blocked) return blocked;

  const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
  if (employee.kind === "none") {
    return {
      ok: false,
      action: "complete_staff_appraisal",
      message: `No active employee matching "${args.employee_name}".`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "complete_staff_appraisal",
      message: `Several employees match: ${employee.names.join(", ")}.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: allPending, error: listError } = await supabase
    .from("hr_staff_appraisals")
    .select("id, period_label, due_date, status")
    .eq("business_id", ctx.businessId)
    .eq("employee_id", employee.id)
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  if (listError) {
    return {
      ok: false,
      action: "complete_staff_appraisal",
      message: "Could not look up pending appraisals.",
    };
  }

  let candidates = allPending ?? [];
  if (args.appraisal_id) {
    candidates = candidates.filter((row) => row.id === args.appraisal_id);
  } else if (args.period_label) {
    const periodQuery = normalizeName(args.period_label);
    candidates = candidates.filter((row) =>
      normalizeName(String(row.period_label)).includes(periodQuery),
    );
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      action: "complete_staff_appraisal",
      message: args.period_label
        ? `No pending appraisal matching "${args.period_label}" for ${employee.full_name}.`
        : `No pending appraisal for ${employee.full_name}.`,
    };
  }
  if (candidates.length > 1 && !args.appraisal_id) {
    const options = candidates
      .map((r) => `${r.period_label} (due ${r.due_date}, id ${r.id})`)
      .join("; ");
    return {
      ok: false,
      action: "complete_staff_appraisal",
      message: `Multiple pending appraisals — specify period_label or appraisal_id: ${options}`,
    };
  }

  const pending = candidates[0];

  let updatePayload: z.infer<typeof appraisalUpdateSchema>;
  try {
    updatePayload = appraisalUpdateSchema.parse({
      status: "completed",
      rating: args.rating ?? null,
      notes: args.notes ?? undefined,
    });
  } catch {
    return {
      ok: false,
      action: "complete_staff_appraisal",
      message: "Could not validate rating or notes.",
    };
  }

  const patch: Record<string, unknown> = {
    status: "completed",
    completed_by: ctx.userId,
    completed_at: new Date().toISOString(),
  };
  if (updatePayload.rating !== undefined) patch.rating = updatePayload.rating;
  if (updatePayload.notes !== undefined) patch.notes = updatePayload.notes;

  const { data, error } = await supabase
    .from("hr_staff_appraisals")
    .update(patch)
    .eq("business_id", ctx.businessId)
    .eq("id", pending.id)
    .select(
      "id, employee_id, period_label, due_date, status, rating, notes, completed_at",
    )
    .single();

  if (error || !data) {
    return {
      ok: false,
      action: "complete_staff_appraisal",
      message: "Could not mark appraisal complete.",
    };
  }

  return {
    ok: true,
    action: "complete_staff_appraisal",
    employee_name: employee.full_name,
    period_label: data.period_label,
    due_date: data.due_date,
    status: data.status,
    rating: data.rating,
    appraisal_id: data.id,
    href: "/hr/appraisals",
  };
}

export async function executeListEmployees(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof listEmployeesArgsSchema>;
  try {
    args = listEmployeesArgsSchema.parse(rawArgs);
  } catch {
    return { ok: false, action: "list_employees", message: "Invalid request." };
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("hr_employees")
    .select(
      "id, full_name, status, department, job_title, start_date, phone, annual_leave_entitlement_days",
      { count: "exact" },
    )
    .eq("business_id", ctx.businessId);

  if (args.status !== "all") {
    query = query.eq("status", args.status);
  }
  if (args.q) {
    query = query.ilike("full_name", `%${args.q}%`);
  }

  const { data, error, count } = await query
    .order("full_name", { ascending: true })
    .limit(args.limit);

  if (error) {
    return { ok: false, action: "list_employees", message: "Could not load employees." };
  }

  const employees = (data ?? []).map((e) => ({
    ...e,
    href: `/hr/employees/${e.id}`,
  }));

  return {
    ok: true,
    action: "list_employees",
    employees,
    total: count ?? employees.length,
    href: "/hr/employees",
  };
}

export async function executeListLeaveRecords(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof listLeaveRecordsArgsSchema>;
  try {
    args = listLeaveRecordsArgsSchema.parse(rawArgs);
  } catch {
    return { ok: false, action: "list_leave_records", message: "Invalid request." };
  }

  let employeeId: string | null = null;
  if (args.employee_name) {
    const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
    if (employee.kind === "none") {
      return {
        ok: false,
        action: "list_leave_records",
        message: `No active employee matching "${args.employee_name}".`,
      };
    }
    if (employee.kind === "many") {
      return {
        ok: false,
        action: "list_leave_records",
        message: `Several employees match: ${employee.names.join(", ")}.`,
      };
    }
    employeeId = employee.id;
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("hr_leave_records")
    .select(
      "id, leave_type, start_date, end_date, status, reason, decision_note, hr_employees!inner(full_name)",
    )
    .eq("business_id", ctx.businessId);

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }
  if (args.status !== "all") {
    query = query.eq("status", args.status);
  }
  if (args.from_date) {
    query = query.gte("start_date", args.from_date);
  }
  if (args.to_date) {
    query = query.lte("end_date", args.to_date);
  }

  const { data, error } = await query
    .order("start_date", { ascending: false })
    .limit(args.limit);

  if (error) {
    return { ok: false, action: "list_leave_records", message: "Could not load leave records." };
  }

  const records = (data ?? []).map((r) => {
    const emp = Array.isArray(r.hr_employees) ? r.hr_employees[0] : r.hr_employees;
    return {
      id: r.id,
      employee_name: emp?.full_name ?? null,
      leave_type: r.leave_type,
      start_date: r.start_date,
      end_date: r.end_date,
      status: r.status,
      reason: r.reason,
      decision_note: r.decision_note,
    };
  });

  return {
    ok: true,
    action: "list_leave_records",
    records,
    href: "/hr/leave/history",
  };
}

export async function executeGetEmployeeProfile(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof getEmployeeProfileArgsSchema>;
  try {
    args = getEmployeeProfileArgsSchema.parse(rawArgs);
  } catch {
    return { ok: false, action: "get_employee_profile", message: "Invalid request." };
  }

  const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
  if (employee.kind === "none") {
    return {
      ok: false,
      action: "get_employee_profile",
      message: `No active employee matching "${args.employee_name}".`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "get_employee_profile",
      message: `Several employees match: ${employee.names.join(", ")}. Please be more specific.`,
    };
  }

  const supabase = await createSupabaseServerClient();

  const [empResult, leaveBalance, recentLeaveResult, onboardingResult] = await Promise.all([
    supabase
      .from("hr_employees")
      .select(
        "id, full_name, status, department, job_title, start_date, phone, email, bank_name, bank_account_number, annual_leave_entitlement_days",
      )
      .eq("id", employee.id)
      .eq("business_id", ctx.businessId)
      .single(),
    loadEmployeeLeaveBalance(supabase, ctx.businessId, employee.id, employee.entitlement),
    supabase
      .from("hr_leave_records")
      .select("id, leave_type, start_date, end_date, status")
      .eq("business_id", ctx.businessId)
      .eq("employee_id", employee.id)
      .order("start_date", { ascending: false })
      .limit(5),
    supabase
      .from("hr_onboarding_items")
      .select("id", { count: "exact" })
      .eq("business_id", ctx.businessId)
      .eq("employee_id", employee.id)
      .eq("is_done", false),
  ]);

  if (empResult.error || !empResult.data) {
    return {
      ok: false,
      action: "get_employee_profile",
      message: "Could not load employee profile.",
    };
  }

  const emp = empResult.data;
  const hasBankDetails = !!(emp.bank_name || emp.bank_account_number);

  return {
    ok: true,
    action: "get_employee_profile",
    employee: {
      id: emp.id,
      full_name: emp.full_name,
      status: emp.status,
      department: emp.department,
      job_title: emp.job_title,
      start_date: emp.start_date,
      phone: emp.phone,
      email: emp.email,
      bank_details: hasBankDetails ? "on file" : null,
      annual_leave_entitlement_days: emp.annual_leave_entitlement_days,
    },
    leave_balance: leaveBalance,
    recent_leave: recentLeaveResult.data ?? [],
    open_onboarding_count: onboardingResult.count ?? 0,
    href: `/hr/employees/${emp.id}`,
  };
}

const ALLOWED_TOOLS = new Set([
  "get_leave_balance",
  "create_leave_record",
  "update_leave_status",
  "complete_onboarding_item",
  "create_staff_appraisal",
  "complete_staff_appraisal",
  "list_employees",
  "list_leave_records",
  "get_employee_profile",
]);

export async function executeHrAssistantTool(
  ctx: AgentContext,
  name: string,
  rawArgs: unknown,
): Promise<HrToolResult> {
  if (!ALLOWED_TOOLS.has(name)) {
    return { ok: false, action: name, message: "That action is not allowed." };
  }
  if (name === "get_leave_balance") {
    return executeGetLeaveBalance(ctx, rawArgs);
  }
  if (name === "create_leave_record") {
    return executeCreateLeaveRecord(ctx, rawArgs);
  }
  if (name === "update_leave_status") {
    return executeUpdateLeaveStatus(ctx, rawArgs);
  }
  if (name === "complete_onboarding_item") {
    return executeCompleteOnboardingItem(ctx, rawArgs);
  }
  if (name === "create_staff_appraisal") {
    return executeCreateStaffAppraisal(ctx, rawArgs);
  }
  if (name === "complete_staff_appraisal") {
    return executeCompleteStaffAppraisal(ctx, rawArgs);
  }
  if (name === "list_employees") {
    return executeListEmployees(ctx, rawArgs);
  }
  if (name === "list_leave_records") {
    return executeListLeaveRecords(ctx, rawArgs);
  }
  if (name === "get_employee_profile") {
    return executeGetEmployeeProfile(ctx, rawArgs);
  }
  return { ok: false, action: name, message: "Unknown action." };
}

export { malaysiaTodayIso } from "@/lib/ai/malaysia-today";

export function isHrActionTool(name: string): boolean {
  return (
    name === "create_leave_record" ||
    name === "update_leave_status" ||
    name === "complete_onboarding_item" ||
    name === "create_staff_appraisal" ||
    name === "complete_staff_appraisal"
  );
}
