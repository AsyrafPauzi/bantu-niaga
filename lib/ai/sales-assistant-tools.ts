import "server-only";

import { z } from "zod";
import type { AgentContext } from "@/lib/ai/context/types";
import { buildSalesSnapshot } from "@/lib/ai/context/sales";
import { normalizeMyPhone } from "@/lib/marketing/phone";
import {
  assertLeadAssignee,
  convertLeadToCustomer,
} from "@/lib/sales/convert-lead";
import {
  LEAD_CHANNELS,
  LEAD_STATUSES,
  malaysiaDayBounds,
  malaysiaTodayYmd,
  normalizeFollowUpAt,
} from "@/lib/sales/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export { malaysiaTodayIso } from "@/lib/ai/malaysia-today";

export const SALES_ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_sales_overview",
      description:
        "Read today's POS summary, open leads, overdue follow-ups, and pipeline counts.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_leads",
      description:
        "List leads filtered by status, follow-up urgency, or search text.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: [...LEAD_STATUSES] },
          follow_up: {
            type: "string",
            enum: ["overdue", "due_today"],
          },
          q: { type: "string", description: "Search name or phone" },
          limit: { type: "number", minimum: 1, maximum: 20 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_lead_detail",
      description: "Get one lead by id or partial name match.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          lead_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_lead",
      description:
        "Create a sales lead when the user explicitly asks to add a prospect.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string", description: "Malaysian or E.164 phone" },
          channel: {
            type: "string",
            enum: [...LEAD_CHANNELS],
          },
          interest: { type: "string" },
          estimated_value_myr: { type: "number" },
          follow_up_at: {
            type: "string",
            description: "ISO datetime or YYYY-MM-DD",
          },
          assigned_to_user_id: {
            type: "string",
            description: "UUID of assignee if known",
          },
        },
        required: ["name", "phone"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_lead",
      description:
        "Update an existing lead by name (or id) — status, follow-up, assignee, interest.",
      parameters: {
        type: "object",
        properties: {
          lead_name: { type: "string" },
          lead_id: { type: "string" },
          status: { type: "string", enum: [...LEAD_STATUSES] },
          follow_up_at: {
            type: "string",
            description: "ISO datetime, YYYY-MM-DD, or empty to clear",
          },
          clear_follow_up: { type: "boolean" },
          interest: { type: "string" },
          assigned_to_user_id: { type: "string" },
          unassign: { type: "boolean" },
          lost_reason: { type: "string" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_lead_note",
      description: "Append a note on a lead when the user asks to record a note.",
      parameters: {
        type: "object",
        properties: {
          lead_name: { type: "string" },
          lead_id: { type: "string" },
          body: { type: "string" },
        },
        required: ["body"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "convert_lead",
      description:
        "Convert a won (or ready) lead into a Marketing customer by phone.",
      parameters: {
        type: "object",
        properties: {
          lead_name: { type: "string" },
          lead_id: { type: "string" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_lead_analytics",
      description:
        "Get pipeline analytics: win rate, conversion rate, average deal value, leads by status, and this month vs last month comparison. Use when the user asks about pipeline performance, conversion, or win rate.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_team_members",
      description:
        "List team members (business users) who can be assigned to leads. Use when the user asks who is on the team or wants to assign a lead to someone by name.",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description: "Search by name or email",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "archive_lead",
      description:
        "Archive (soft-delete) a lead that is lost, duplicate, or no longer relevant. Only archive lost leads or confirmed duplicates.",
      parameters: {
        type: "object",
        properties: {
          lead_name: { type: "string" },
          lead_id: { type: "string" },
          reason: { type: "string", description: "Reason for archiving" },
        },
        additionalProperties: false,
      },
    },
  },
];

const ACTION_TOOLS = new Set([
  "create_lead",
  "update_lead",
  "add_lead_note",
  "convert_lead",
  "archive_lead",
]);

export function isSalesActionTool(name: string): boolean {
  return ACTION_TOOLS.has(name);
}

const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(40),
  channel: z.enum(LEAD_CHANNELS).optional(),
  interest: z.string().trim().max(500).optional(),
  estimated_value_myr: z.number().finite().nonnegative().optional(),
  follow_up_at: z.string().optional(),
  assigned_to_user_id: z.string().uuid().optional(),
});

const updateLeadSchema = z.object({
  lead_name: z.string().trim().min(1).max(200).optional(),
  lead_id: z.string().uuid().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  follow_up_at: z.string().optional(),
  clear_follow_up: z.boolean().optional(),
  interest: z.string().trim().max(500).optional(),
  assigned_to_user_id: z.string().uuid().optional(),
  unassign: z.boolean().optional(),
  lost_reason: z.string().trim().max(500).optional(),
});

const noteSchema = z.object({
  lead_name: z.string().trim().min(1).max(200).optional(),
  lead_id: z.string().uuid().optional(),
  body: z.string().trim().min(1).max(2000),
});

const convertSchema = z.object({
  lead_name: z.string().trim().min(1).max(200).optional(),
  lead_id: z.string().uuid().optional(),
});

const listTeamMembersSchema = z.object({
  q: z.string().trim().max(100).optional(),
});

const archiveLeadSchema = z.object({
  lead_name: z.string().trim().min(1).max(200).optional(),
  lead_id: z.string().uuid().optional(),
  reason: z.string().trim().max(500).optional(),
});

const listLeadsSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  follow_up: z.enum(["overdue", "due_today"]).optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.number().int().min(1).max(20).optional().default(10),
});

const getLeadDetailSchema = z.object({
  lead_id: z.string().uuid().optional(),
  lead_name: z.string().trim().min(1).max(200).optional(),
});

async function findLead(
  businessId: string,
  opts: { lead_id?: string; lead_name?: string },
) {
  const supabase = await createSupabaseServerClient();
  if (opts.lead_id) {
    const { data } = await supabase
      .from("sales_leads")
      .select("id, name, phone_e164, customer_id, status")
      .eq("business_id", businessId)
      .eq("id", opts.lead_id)
      .maybeSingle();
    return data;
  }
  if (opts.lead_name) {
    const { data } = await supabase
      .from("sales_leads")
      .select("id, name, phone_e164, customer_id, status")
      .eq("business_id", businessId)
      .ilike("name", `%${opts.lead_name.replace(/[%_]/g, "")}%`)
      .limit(5);
    if (!data || data.length === 0) return null;
    if (data.length > 1) {
      return {
        ambiguous: true as const,
        matches: data.map((d) => ({ id: d.id, name: d.name })),
      };
    }
    return data[0];
  }
  return null;
}

async function executeGetLeadAnalytics(
  ctx: AgentContext,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("sales_leads")
    .select("id, status, estimated_value_myr, created_at")
    .eq("business_id", ctx.businessId);
  if (error || !data) {
    return { ok: false, error: "analytics_unavailable" };
  }

  const today = malaysiaTodayYmd();
  const thisMonthStart = today.slice(0, 7) + "-01";
  const lastMonthDate = new Date(thisMonthStart);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStart = lastMonthDate.toISOString().slice(0, 10);

  const byStatus: Record<string, number> = {};
  let won = 0, lost = 0;
  let wonValueSum = 0, wonCount = 0;
  let pipelineValueSum = 0;
  let newThisMonth = 0, newLastMonth = 0;

  for (const lead of data) {
    const s = lead.status as string;
    byStatus[s] = (byStatus[s] ?? 0) + 1;
    if (s === "won") {
      won++;
      if (lead.estimated_value_myr) {
        wonValueSum += lead.estimated_value_myr;
        wonCount++;
      }
    }
    if (s === "lost") lost++;
    if (s !== "lost" && lead.estimated_value_myr) {
      pipelineValueSum += lead.estimated_value_myr;
    }
    const createdAt = lead.created_at as string;
    if (createdAt >= thisMonthStart) newThisMonth++;
    else if (createdAt >= lastMonthStart && createdAt < thisMonthStart) newLastMonth++;
  }

  const winRate =
    won + lost > 0
      ? Math.round((won / (won + lost)) * 1000) / 10
      : 0;

  const avgDealValue =
    wonCount > 0
      ? Math.round((wonValueSum / wonCount) * 100) / 100
      : data.length > 0
        ? Math.round(
            (data.reduce((s, l) => s + (l.estimated_value_myr ?? 0), 0) /
              data.length) *
              100,
          ) / 100
        : 0;

  return {
    ok: true,
    total_leads: data.length,
    by_status: byStatus,
    win_rate: winRate,
    avg_deal_value_myr: avgDealValue,
    total_pipeline_value_myr: Math.round(pipelineValueSum * 100) / 100,
    won_value_myr: Math.round(wonValueSum * 100) / 100,
    new_leads_this_month: newThisMonth,
    new_leads_last_month: newLastMonth,
  };
}

async function executeListTeamMembers(
  ctx: AgentContext,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  args: unknown,
): Promise<Record<string, unknown>> {
  const parsed = listTeamMembersSchema.parse(args ?? {});
  let query = supabase
    .from("business_users")
    .select("user_id, display_name, email, role")
    .eq("business_id", ctx.businessId)
    .eq("status", "active");
  if (parsed.q) {
    const safeQ = parsed.q.replace(/[%_]/g, "");
    if (safeQ) {
      query = query.or(
        `display_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%`,
      );
    }
  }
  const { data, error } = await query;
  if (error) return { ok: false, error: "team_unavailable" };
  return {
    ok: true,
    members: (data ?? []).map((m) => ({
      user_id: m.user_id,
      display_name: m.display_name,
      email: m.email,
      role: m.role,
    })),
    note: "Use user_id as assigned_to_user_id when calling create_lead or update_lead",
  };
}

async function executeArchiveLead(
  ctx: AgentContext,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  args: unknown,
): Promise<Record<string, unknown>> {
  const parsed = archiveLeadSchema.parse(args ?? {});
  if (!parsed.lead_id && !parsed.lead_name) {
    return { ok: false, error: "lead_name_or_id_required" };
  }
  const found = await findLead(ctx.businessId, parsed);
  if (!found) return { ok: false, error: "lead_not_found" };
  if ("ambiguous" in found && found.ambiguous) {
    return { ok: false, error: "ambiguous_lead", matches: found.matches };
  }
  const lead = found as { id: string; name: string; status: string };
  if (!["lost", "won"].includes(lead.status)) {
    return {
      ok: false,
      error:
        "Only lost or won leads can be archived. Update status to lost first if needed.",
    };
  }

  const reason = parsed.reason ?? "No reason provided";
  const noteBody = `Archived: ${reason}`;
  await supabase.from("sales_lead_notes").insert({
    business_id: ctx.businessId,
    lead_id: lead.id,
    body: noteBody,
    created_by: ctx.userId,
  });

  const { error: updateError } = await supabase
    .from("sales_leads")
    .update({ status: "lost", updated_at: new Date().toISOString() })
    .eq("id", lead.id)
    .eq("business_id", ctx.businessId);

  if (updateError) return { ok: false, error: "archive_failed" };

  return {
    ok: true,
    action: "archived",
    lead_name: lead.name,
    reason,
    href: `/sales/leads/${lead.id}`,
  };
}

export async function executeSalesAssistantTool(
  ctx: AgentContext,
  name: string,
  args: unknown,
): Promise<Record<string, unknown>> {
  const supabase = await createSupabaseServerClient();

  try {
    if (name === "get_sales_overview") {
      const snapshot = await buildSalesSnapshot(ctx, supabase);
      return {
        ok: true,
        headline: snapshot.headline,
        kpis: snapshot.kpis,
        attention: snapshot.attention,
        recent: snapshot.recent,
      };
    }

    if (name === "list_leads") {
      const parsed = listLeadsSchema.parse(args);
      const { dayStartIso, dayEndIso } = malaysiaDayBounds(malaysiaTodayYmd());
      let query = supabase
        .from("sales_leads")
        .select(
          "id, name, phone_e164, status, follow_up_at, estimated_value_myr, channel",
        )
        .eq("business_id", ctx.businessId)
        .order("updated_at", { ascending: false })
        .limit(parsed.limit);

      if (parsed.status) query = query.eq("status", parsed.status);
      if (parsed.follow_up === "due_today") {
        query = query
          .gte("follow_up_at", dayStartIso)
          .lt("follow_up_at", dayEndIso);
      } else if (parsed.follow_up === "overdue") {
        query = query
          .not("follow_up_at", "is", null)
          .lt("follow_up_at", dayStartIso)
          .not("status", "in", "(won,lost)");
      }
      if (parsed.q) {
        const safe = parsed.q.replace(/[%_,]/g, "");
        if (safe) {
          query = query.or(`name.ilike.%${safe}%,phone_e164.ilike.%${safe}%`);
        }
      }

      const { data, error } = await query;
      if (error) return { ok: false, error: error.message };
      return {
        ok: true,
        leads: (data ?? []).map((l) => ({
          ...l,
          href: `/sales/leads/${l.id}`,
        })),
      };
    }

    if (name === "get_lead_detail") {
      const parsed = getLeadDetailSchema.parse(args);
      if (!parsed.lead_id && !parsed.lead_name) {
        return { ok: false, error: "lead_name_or_id_required" };
      }
      const found = await findLead(ctx.businessId, parsed);
      if (!found) return { ok: false, error: "lead_not_found" };
      if ("ambiguous" in found && found.ambiguous) {
        return { ok: false, error: "ambiguous_lead", matches: found.matches };
      }
      const leadId = (found as { id: string }).id;
      const { data: lead, error } = await supabase
        .from("sales_leads")
        .select(
          "id, name, phone_e164, channel, interest, estimated_value_myr, status, follow_up_at, assigned_to, customer_id, lost_reason",
        )
        .eq("id", leadId)
        .eq("business_id", ctx.businessId)
        .single();
      if (error || !lead) {
        return { ok: false, error: error?.message ?? "lead_not_found" };
      }
      const { data: notes } = await supabase
        .from("sales_lead_notes")
        .select("body, created_at")
        .eq("lead_id", leadId)
        .eq("business_id", ctx.businessId)
        .order("created_at", { ascending: false })
        .limit(5);
      return {
        ok: true,
        lead,
        notes: notes ?? [],
        href: `/sales/leads/${leadId}`,
      };
    }

    if (name === "create_lead") {
      const parsed = createLeadSchema.parse(args);
      const phone = normalizeMyPhone(parsed.phone);
      if (!phone) {
        return { ok: false, error: "invalid_phone" };
      }
      if (parsed.assigned_to_user_id) {
        const ok = await assertLeadAssignee({
          businessId: ctx.businessId,
          userId: parsed.assigned_to_user_id,
        });
        if (!ok) return { ok: false, error: "invalid_assignee" };
      }
      const { data, error } = await supabase
        .from("sales_leads")
        .insert({
          business_id: ctx.businessId,
          name: parsed.name,
          phone_e164: phone,
          channel: parsed.channel ?? null,
          interest: parsed.interest ?? null,
          estimated_value_myr: parsed.estimated_value_myr ?? null,
          follow_up_at: normalizeFollowUpAt(parsed.follow_up_at ?? null) ?? null,
          assigned_to: parsed.assigned_to_user_id ?? null,
          status: "new",
          created_by: ctx.userId,
        })
        .select("id, name, phone_e164, status")
        .single();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "create_failed" };
      }
      return { ok: true, lead: data, href: `/sales/leads/${data.id}` };
    }

    if (name === "update_lead") {
      const parsed = updateLeadSchema.parse(args);
      if (!parsed.lead_id && !parsed.lead_name) {
        return { ok: false, error: "lead_name_or_id_required" };
      }
      const found = await findLead(ctx.businessId, parsed);
      if (!found) return { ok: false, error: "lead_not_found" };
      if ("ambiguous" in found && found.ambiguous) {
        return { ok: false, error: "ambiguous_lead", matches: found.matches };
      }
      const lead = found as {
        id: string;
        name: string;
        phone_e164: string;
        customer_id: string | null;
        status: string;
      };
      const patch: Record<string, unknown> = {};
      if (parsed.status) patch.status = parsed.status;
      if (parsed.interest !== undefined) patch.interest = parsed.interest;
      if (parsed.lost_reason !== undefined) patch.lost_reason = parsed.lost_reason;
      if (parsed.clear_follow_up) patch.follow_up_at = null;
      else if (parsed.follow_up_at !== undefined) {
        patch.follow_up_at = normalizeFollowUpAt(parsed.follow_up_at) ?? null;
      }
      if (parsed.unassign) patch.assigned_to = null;
      else if (parsed.assigned_to_user_id) {
        const ok = await assertLeadAssignee({
          businessId: ctx.businessId,
          userId: parsed.assigned_to_user_id,
        });
        if (!ok) return { ok: false, error: "invalid_assignee" };
        patch.assigned_to = parsed.assigned_to_user_id;
      }
      if (Object.keys(patch).length === 0) {
        return { ok: false, error: "no_fields" };
      }
      const { data, error } = await supabase
        .from("sales_leads")
        .update(patch)
        .eq("id", lead.id)
        .eq("business_id", ctx.businessId)
        .select("id, name, status, follow_up_at, assigned_to")
        .single();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "update_failed" };
      }
      return { ok: true, lead: data, href: `/sales/leads/${data.id}` };
    }

    if (name === "add_lead_note") {
      const parsed = noteSchema.parse(args);
      if (!parsed.lead_id && !parsed.lead_name) {
        return { ok: false, error: "lead_name_or_id_required" };
      }
      const found = await findLead(ctx.businessId, parsed);
      if (!found) return { ok: false, error: "lead_not_found" };
      if ("ambiguous" in found && found.ambiguous) {
        return { ok: false, error: "ambiguous_lead", matches: found.matches };
      }
      const lead = found as { id: string };
      const { data, error } = await supabase
        .from("sales_lead_notes")
        .insert({
          business_id: ctx.businessId,
          lead_id: lead.id,
          body: parsed.body,
          created_by: ctx.userId,
        })
        .select("id, body, created_at")
        .single();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "note_failed" };
      }
      await supabase
        .from("sales_leads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", lead.id)
        .eq("business_id", ctx.businessId);
      return { ok: true, note: data, href: `/sales/leads/${lead.id}` };
    }

    if (name === "convert_lead") {
      const parsed = convertSchema.parse(args);
      if (!parsed.lead_id && !parsed.lead_name) {
        return { ok: false, error: "lead_name_or_id_required" };
      }
      const found = await findLead(ctx.businessId, parsed);
      if (!found) return { ok: false, error: "lead_not_found" };
      if ("ambiguous" in found && found.ambiguous) {
        return { ok: false, error: "ambiguous_lead", matches: found.matches };
      }
      const lead = found as {
        id: string;
        name: string;
        phone_e164: string;
        customer_id: string | null;
      };
      const result = await convertLeadToCustomer({
        businessId: ctx.businessId,
        leadId: lead.id,
        name: lead.name,
        phoneE164: lead.phone_e164,
        existingCustomerId: lead.customer_id,
        actorUserId: ctx.userId,
      });
      return {
        ok: true,
        action: result.action,
        customer_id: result.customerId,
        href: `/marketing/customers/${result.customerId}`,
        lead_href: `/sales/leads/${lead.id}`,
      };
    }

    if (name === "get_lead_analytics") {
      return executeGetLeadAnalytics(ctx, supabase);
    }

    if (name === "list_team_members") {
      return executeListTeamMembers(ctx, supabase, args);
    }

    if (name === "archive_lead") {
      return executeArchiveLead(ctx, supabase, args);
    }

    return { ok: false, error: "unknown_tool" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "tool_failed",
    };
  }
}
