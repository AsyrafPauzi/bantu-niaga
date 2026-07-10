import "server-only";

import { z } from "zod";
import type { AgentContext } from "@/lib/ai/context/types";
import { normalizeMyPhone } from "@/lib/marketing/phone";
import {
  assertLeadAssignee,
  convertLeadToCustomer,
} from "@/lib/sales/convert-lead";
import {
  LEAD_CHANNELS,
  LEAD_STATUSES,
  normalizeFollowUpAt,
} from "@/lib/sales/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function malaysiaTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

export const SALES_ASSISTANT_TOOLS = [
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
];

const ACTION_TOOLS = new Set([
  "create_lead",
  "update_lead",
  "add_lead_note",
  "convert_lead",
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

export async function executeSalesAssistantTool(
  ctx: AgentContext,
  name: string,
  args: unknown,
): Promise<Record<string, unknown>> {
  const supabase = await createSupabaseServerClient();

  try {
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

    return { ok: false, error: "unknown_tool" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "tool_failed",
    };
  }
}
