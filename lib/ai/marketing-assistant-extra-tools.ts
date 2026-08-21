import "server-only";

import { z } from "zod";
import type { AgentContext } from "@/lib/ai/context/types";
import {
  applyRulesToCustomersQuery,
  SegmentRulesSchema,
  type CustomersQueryLike,
  type SegmentRules,
} from "@/lib/marketing/segments-rules";
import {
  recomputeMemberCount,
  resolveSegmentMembers,
} from "@/lib/marketing/segments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function sanitizeLike(raw: string): string {
  return raw.replace(/[%_\\]/g, "");
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveSegmentByName(
  businessId: string,
  nameQuery: string,
): Promise<
  | { kind: "one"; id: string; name: string }
  | { kind: "none" }
  | { kind: "many"; names: string[] }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_segments")
    .select("id, name")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error("Could not load segments.");

  const query = normalizeName(nameQuery);
  const matches = (data ?? []).filter((row) =>
    normalizeName(row.name).includes(query),
  );

  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) {
    return { kind: "one", id: matches[0].id, name: matches[0].name };
  }
  return { kind: "many", names: matches.map((m) => m.name) };
}

async function resolveCustomerByName(
  businessId: string,
  nameQuery: string,
): Promise<
  | { kind: "one"; id: string; name: string }
  | { kind: "none" }
  | { kind: "many"; names: string[] }
> {
  const supabase = await createSupabaseServerClient();
  const safe = sanitizeLike(nameQuery);
  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .ilike("name", `%${safe}%`)
    .order("name", { ascending: true })
    .limit(10);

  if (error) throw new Error("Could not load customers.");

  const matches = data ?? [];
  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) {
    return { kind: "one", id: matches[0].id, name: matches[0].name };
  }
  return { kind: "many", names: matches.map((m) => m.name) };
}

async function resolveContentByHook(
  businessId: string,
  hookQuery: string,
): Promise<
  | { kind: "one"; id: string; hook: string | null }
  | { kind: "none" }
  | { kind: "many"; hooks: string[] }
> {
  const supabase = await createSupabaseServerClient();
  const safe = sanitizeLike(hookQuery);
  const { data, error } = await supabase
    .from("content_plan")
    .select("id, hook")
    .eq("business_id", businessId)
    .ilike("hook", `%${safe}%`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) throw new Error("Could not load content.");

  const matches = data ?? [];
  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) {
    return { kind: "one", id: matches[0].id, hook: matches[0].hook };
  }
  return {
    kind: "many",
    hooks: matches.map((m) => m.hook ?? m.id.slice(0, 8)),
  };
}

async function resolveCouponByCode(
  businessId: string,
  codeQuery: string,
): Promise<
  | { kind: "one"; id: string; code: string }
  | { kind: "none" }
  | { kind: "many"; codes: string[] }
> {
  const supabase = await createSupabaseServerClient();
  const safe = sanitizeLike(codeQuery).toUpperCase();
  const { data, error } = await supabase
    .from("coupons")
    .select("id, code")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .ilike("code", `%${safe}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw new Error("Could not load coupons.");

  const matches = data ?? [];
  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) {
    return { kind: "one", id: matches[0].id, code: matches[0].code };
  }
  return { kind: "many", codes: matches.map((m) => m.code) };
}

/** Additional Maya tools — read deeper + more module actions. */
export const MARKETING_ASSISTANT_EXTRA_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_customer_profile",
      description:
        "Read one customer's CRM profile (spend, tags, notes, last purchase) by name or id.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Partial name match." },
          customer_id: { type: "string", description: "UUID if known." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_segment_detail",
      description:
        "Read a segment's rules, member count, and sample members before targeting a broadcast.",
      parameters: {
        type: "object",
        properties: {
          segment_name: { type: "string" },
          segment_id: { type: "string" },
          member_limit: {
            type: "number",
            description: "Sample members to return (default 10, max 20).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "preview_segment_rules",
      description:
        "Count how many customers match proposed segment rules before creating a custom segment.",
      parameters: {
        type: "object",
        properties: {
          rules: {
            type: "object",
            description:
              "Segment rules: auto_tags_any (vip|repeat|new|at_risk|dormant), min_spend_myr, max_spend_myr, inactive_days, manual_tags_any, sources.",
          },
        },
        required: ["rules"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_coupons",
      description: "List coupons with optional status filter.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "paused", "expired", "all"],
          },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_broadcasts",
      description: "List recent broadcasts with status and channel.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["draft", "sent", "sending", "failed", "all"],
          },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_content",
      description: "List content calendar entries by status.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["idea", "drafted", "scheduled", "posted", "all"],
          },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_custom_segment",
      description:
        "Create a custom segment with rules when the user explicitly asks to save a new audience group.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Segment display name (max 80)." },
          rules: {
            type: "object",
            description:
              "Rules object: auto_tags_any, min_spend_myr, max_spend_myr, inactive_days, manual_tags_any, sources.",
          },
        },
        required: ["name", "rules"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_coupon_status",
      description:
        "Pause or reactivate a coupon by code when the user asks to pause/stop/enable a promo.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Coupon code (partial match OK)." },
          status: { type: "string", enum: ["active", "paused"] },
        },
        required: ["code", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "schedule_content",
      description:
        "Schedule or update a content calendar post (set date/time and status scheduled).",
      parameters: {
        type: "object",
        properties: {
          content_hook: {
            type: "string",
            description: "Partial hook/title to find the post.",
          },
          content_id: { type: "string", description: "UUID if known." },
          scheduled_at: {
            type: "string",
            description: "ISO datetime or YYYY-MM-DD (defaults 09:00 MYT).",
          },
        },
        required: ["scheduled_at"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "mark_content_posted",
      description:
        "Mark a content calendar entry as posted when the user says they published it.",
      parameters: {
        type: "object",
        properties: {
          content_hook: { type: "string" },
          content_id: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_broadcast_result",
      description:
        "Get send results for a specific broadcast — how many were sent, delivered, failed, and when it was sent. Use when the user asks how a campaign performed.",
      parameters: {
        type: "object",
        properties: {
          broadcast_id: {
            type: "string",
            description: "UUID of the broadcast if known.",
          },
          broadcast_name: {
            type: "string",
            description: "Partial title match to find the broadcast.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "remove_customer_tag",
      description:
        "Remove a manual tag from a CRM customer. Use when the user wants to untag or remove a label from a customer.",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description: "Partial name match.",
          },
          customer_id: {
            type: "string",
            description: "UUID if known.",
          },
          tag: {
            type: "string",
            description: "Tag to remove from the customer.",
          },
        },
        required: ["tag"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "deactivate_coupon",
      description:
        "Permanently deactivate a coupon so it can no longer be used. Use when the user wants to end a promo permanently (not just pause it).",
      parameters: {
        type: "object",
        properties: {
          coupon_id: {
            type: "string",
            description: "UUID of the coupon if known.",
          },
          coupon_code: {
            type: "string",
            description: "Coupon code (exact or partial match).",
          },
          confirm: {
            type: "boolean",
            description:
              "Must be true — confirms the owner wants permanent deactivation.",
          },
        },
        required: ["confirm"],
        additionalProperties: false,
      },
    },
  },
] as const;

export const EXTRA_READ_TOOLS = new Set([
  "get_customer_profile",
  "get_segment_detail",
  "preview_segment_rules",
  "list_coupons",
  "list_broadcasts",
  "list_content",
  "get_broadcast_result",
]);

export const EXTRA_ACTION_TOOLS = new Set([
  "create_custom_segment",
  "update_coupon_status",
  "schedule_content",
  "mark_content_posted",
  "remove_customer_tag",
  "deactivate_coupon",
]);

export async function executeMarketingExtraTool(
  ctx: AgentContext,
  name: string,
  rawArgs: unknown,
): Promise<Record<string, unknown>> {
  const supabase = await createSupabaseServerClient();

  if (name === "get_customer_profile") {
    const parsed = z
      .object({
        customer_name: z.string().trim().min(1).max(160).optional(),
        customer_id: z.string().uuid().optional(),
      })
      .refine((v) => Boolean(v.customer_name || v.customer_id), {
        message: "Provide customer_name or customer_id.",
      })
      .parse(rawArgs ?? {});

    let customerId = parsed.customer_id;
    if (!customerId && parsed.customer_name) {
      const match = await resolveCustomerByName(
        ctx.businessId,
        parsed.customer_name,
      );
      if (match.kind === "none") {
        return {
          ok: false,
          action: name,
          message: `No customer matching "${parsed.customer_name}".`,
        };
      }
      if (match.kind === "many") {
        return {
          ok: false,
          action: name,
          message: `Several customers match: ${match.names.join(", ")}. Ask which one.`,
        };
      }
      customerId = match.id;
    }

    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, name, phone_e164, email, address, manual_tags, auto_tags, notes, source, total_spend_myr, order_count, aov_myr, last_purchase_at, created_at",
      )
      .eq("business_id", ctx.businessId)
      .eq("id", customerId!)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) {
      return { ok: false, action: name, message: "Customer not found." };
    }

    return {
      ok: true,
      action: name,
      customer: data,
      href: `/marketing/customers/${data.id}`,
    };
  }

  if (name === "get_segment_detail") {
    const parsed = z
      .object({
        segment_name: z.string().trim().min(1).max(160).optional(),
        segment_id: z.string().uuid().optional(),
        member_limit: z.number().int().min(1).max(20).optional().default(10),
      })
      .refine((v) => Boolean(v.segment_name || v.segment_id), {
        message: "Provide segment_name or segment_id.",
      })
      .parse(rawArgs ?? {});

    let segmentId = parsed.segment_id;
    if (!segmentId && parsed.segment_name) {
      const match = await resolveSegmentByName(
        ctx.businessId,
        parsed.segment_name,
      );
      if (match.kind === "none") {
        return {
          ok: false,
          action: name,
          message: `No segment matching "${parsed.segment_name}".`,
        };
      }
      if (match.kind === "many") {
        return {
          ok: false,
          action: name,
          message: `Several segments match: ${match.names.join(", ")}. Ask which one.`,
        };
      }
      segmentId = match.id;
    }

    const { segment, count } = await recomputeMemberCount(supabase, segmentId!);
    const memberResult = await resolveSegmentMembers(supabase, segmentId!, {
      limit: parsed.member_limit,
    });
    const members = memberResult.members;

    return {
      ok: true,
      action: name,
      segment: {
        id: segment.id,
        name: segment.name,
        kind: segment.kind,
        auto_key: segment.auto_key,
        rules: segment.rules,
        member_count: count,
      },
      sample_members: members.map((m) => ({
        id: m.id,
        name: m.name,
        total_spend_myr: m.total_spend_myr,
        last_purchase_at: m.last_purchase_at,
        auto_tags: m.auto_tags,
        href: `/marketing/customers/${m.id}`,
      })),
      href: `/marketing/segments/${segment.id}`,
    };
  }

  if (name === "preview_segment_rules") {
    let rules: SegmentRules;
    try {
      const body = z.object({ rules: z.unknown() }).parse(rawArgs ?? {});
      rules = SegmentRulesSchema.parse(body.rules);
    } catch {
      return {
        ok: false,
        action: name,
        message: "Invalid segment rules. Use auto_tags_any, min_spend_myr, inactive_days, etc.",
      };
    }

    const baseQuery = supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .is("merged_into_id", null);
    const q = applyRulesToCustomersQuery(
      baseQuery as unknown as CustomersQueryLike,
      rules,
    ) as unknown as typeof baseQuery;
    const { count, error } = await q;
    if (error) {
      return { ok: false, action: name, message: "Could not preview segment rules." };
    }

    return { ok: true, action: name, match_count: count ?? 0, rules };
  }

  if (name === "list_coupons") {
    const parsed = z
      .object({
        status: z
          .enum(["active", "paused", "expired", "all"])
          .optional()
          .default("all"),
        limit: z.number().int().min(1).max(30).optional().default(15),
      })
      .parse(rawArgs ?? {});

    let query = supabase
      .from("coupons")
      .select("id, code, name, type, value, status, redeemed_count, valid_until")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(parsed.limit);

    if (parsed.status !== "all") {
      query = query.eq("status", parsed.status);
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, action: name, message: "Could not load coupons." };
    }

    return {
      ok: true,
      action: name,
      coupons: (data ?? []).map((row) => ({
        ...row,
        href: `/marketing/coupons/${row.id}`,
      })),
    };
  }

  if (name === "list_broadcasts") {
    const parsed = z
      .object({
        status: z
          .enum(["draft", "sent", "sending", "failed", "all"])
          .optional()
          .default("all"),
        limit: z.number().int().min(1).max(20).optional().default(10),
      })
      .parse(rawArgs ?? {});

    let query = supabase
      .from("broadcasts")
      .select(
        "id, name, channel, status, total_recipients, sent_count, failed_count, created_at",
      )
      .eq("business_id", ctx.businessId)
      .order("created_at", { ascending: false })
      .limit(parsed.limit);

    if (parsed.status !== "all") {
      if (parsed.status === "sent") {
        query = query.in("status", ["sent", "partially_sent"]);
      } else {
        query = query.eq("status", parsed.status);
      }
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, action: name, message: "Could not load broadcasts." };
    }

    return {
      ok: true,
      action: name,
      broadcasts: (data ?? []).map((row) => ({
        ...row,
        href: `/marketing/broadcasts/${row.id}`,
      })),
    };
  }

  if (name === "list_content") {
    const parsed = z
      .object({
        status: z
          .enum(["idea", "drafted", "scheduled", "posted", "all"])
          .optional()
          .default("all"),
        limit: z.number().int().min(1).max(20).optional().default(10),
      })
      .parse(rawArgs ?? {});

    let query = supabase
      .from("content_plan")
      .select("id, channel, status, hook, scheduled_at, posted_at")
      .eq("business_id", ctx.businessId)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(parsed.limit);

    if (parsed.status !== "all") {
      query = query.eq("status", parsed.status);
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, action: name, message: "Could not load content." };
    }

    return {
      ok: true,
      action: name,
      content: (data ?? []).map((row) => ({
        ...row,
        href: `/marketing/content/${row.id}`,
      })),
    };
  }

  if (name === "create_custom_segment") {
    let args: { name: string; rules: SegmentRules };
    try {
      const parsed = z
        .object({
          name: z.string().trim().min(1).max(80),
          rules: z.unknown(),
        })
        .parse(rawArgs);
      args = { name: parsed.name, rules: SegmentRulesSchema.parse(parsed.rules) };
    } catch {
      return {
        ok: false,
        action: name,
        message: "Invalid segment name or rules.",
      };
    }

    const { data, error } = await supabase
      .from("customer_segments")
      .insert({
        business_id: ctx.businessId,
        name: args.name,
        kind: "custom",
        auto_key: null,
        rules: args.rules,
        created_by: ctx.userId,
      })
      .select("id, name")
      .single();

    if (error || !data) {
      return {
        ok: false,
        action: name,
        message: "Could not create the segment. Try from Segments.",
      };
    }

    try {
      await recomputeMemberCount(supabase, data.id);
    } catch {
      /* member count may lag — segment still created */
    }

    return {
      ok: true,
      action: name,
      segment_id: data.id,
      name: data.name,
      href: `/marketing/segments/${data.id}`,
    };
  }

  if (name === "update_coupon_status") {
    const parsed = z
      .object({
        code: z.string().trim().min(1).max(32),
        status: z.enum(["active", "paused"]),
      })
      .parse(rawArgs);

    const match = await resolveCouponByCode(ctx.businessId, parsed.code);
    if (match.kind === "none") {
      return {
        ok: false,
        action: name,
        message: `No coupon matching "${parsed.code}".`,
      };
    }
    if (match.kind === "many") {
      return {
        ok: false,
        action: name,
        message: `Several coupons match: ${match.codes.join(", ")}. Ask which code.`,
      };
    }

    const { error } = await supabase
      .from("coupons")
      .update({ status: parsed.status })
      .eq("id", match.id)
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null);

    if (error) {
      return { ok: false, action: name, message: "Could not update coupon status." };
    }

    return {
      ok: true,
      action: name,
      coupon_id: match.id,
      code: match.code,
      status: parsed.status,
      href: `/marketing/coupons/${match.id}`,
    };
  }

  if (name === "schedule_content") {
    const parsed = z
      .object({
        content_hook: z.string().trim().min(1).max(280).optional(),
        content_id: z.string().uuid().optional(),
        scheduled_at: z.string().trim().min(1).max(40),
      })
      .refine((v) => Boolean(v.content_hook || v.content_id), {
        message: "Provide content_hook or content_id.",
      })
      .parse(rawArgs);

    let contentId = parsed.content_id;
    if (!contentId && parsed.content_hook) {
      const match = await resolveContentByHook(
        ctx.businessId,
        parsed.content_hook,
      );
      if (match.kind === "none") {
        return {
          ok: false,
          action: name,
          message: `No content matching "${parsed.content_hook}".`,
        };
      }
      if (match.kind === "many") {
        return {
          ok: false,
          action: name,
          message: `Several posts match: ${match.hooks.join(", ")}. Ask which one.`,
        };
      }
      contentId = match.id;
    }

    let scheduledIso: string;
    if (/^\d{4}-\d{2}-\d{2}$/.test(parsed.scheduled_at)) {
      scheduledIso = new Date(
        `${parsed.scheduled_at}T09:00:00+08:00`,
      ).toISOString();
    } else {
      const d = new Date(parsed.scheduled_at);
      if (Number.isNaN(d.valueOf())) {
        return {
          ok: false,
          action: name,
          message: "Invalid scheduled_at. Use YYYY-MM-DD or ISO datetime.",
        };
      }
      scheduledIso = d.toISOString();
    }

    const { data, error } = await supabase
      .from("content_plan")
      .update({ scheduled_at: scheduledIso, status: "scheduled" })
      .eq("business_id", ctx.businessId)
      .eq("id", contentId!)
      .select("id, hook, scheduled_at")
      .maybeSingle();

    if (error || !data) {
      return { ok: false, action: name, message: "Could not schedule content." };
    }

    return {
      ok: true,
      action: name,
      content_id: data.id,
      hook: data.hook,
      scheduled_at: data.scheduled_at,
      href: `/marketing/content/${data.id}`,
    };
  }

  if (name === "mark_content_posted") {
    const parsed = z
      .object({
        content_hook: z.string().trim().min(1).max(280).optional(),
        content_id: z.string().uuid().optional(),
      })
      .refine((v) => Boolean(v.content_hook || v.content_id), {
        message: "Provide content_hook or content_id.",
      })
      .parse(rawArgs);

    let contentId = parsed.content_id;
    if (!contentId && parsed.content_hook) {
      const match = await resolveContentByHook(
        ctx.businessId,
        parsed.content_hook,
      );
      if (match.kind === "none") {
        return {
          ok: false,
          action: name,
          message: `No content matching "${parsed.content_hook}".`,
        };
      }
      if (match.kind === "many") {
        return {
          ok: false,
          action: name,
          message: `Several posts match: ${match.hooks.join(", ")}. Ask which one.`,
        };
      }
      contentId = match.id;
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("content_plan")
      .update({ status: "posted", posted_at: nowIso })
      .eq("business_id", ctx.businessId)
      .eq("id", contentId!)
      .select("id, hook")
      .maybeSingle();

    if (error || !data) {
      return { ok: false, action: name, message: "Could not mark content posted." };
    }

    return {
      ok: true,
      action: name,
      content_id: data.id,
      hook: data.hook,
      href: `/marketing/content/${data.id}`,
    };
  }

  if (name === "get_broadcast_result") {
    const parsed = z
      .object({
        broadcast_id: z.string().uuid().optional(),
        broadcast_name: z.string().trim().min(1).max(160).optional(),
      })
      .refine((v) => Boolean(v.broadcast_id || v.broadcast_name), {
        message: "Provide broadcast_id or broadcast_name.",
      })
      .parse(rawArgs ?? {});

    let query = supabase
      .from("broadcasts")
      .select(
        "id, name, status, channel, segment_id, sent_count, failed_count, sent_at, scheduled_at, created_at",
      )
      .eq("business_id", ctx.businessId);

    if (parsed.broadcast_id) {
      query = query.eq("id", parsed.broadcast_id) as typeof query;
      const { data, error } = await query.maybeSingle();
      if (error || !data) {
        return { ok: false, action: name, message: "Broadcast not found." };
      }
      const notSentYet =
        (!data.sent_count || data.sent_count === 0) && data.status !== "sent";
      return {
        ok: true,
        action: name,
        broadcast: data,
        performance_note: notSentYet
          ? "This broadcast has not been sent yet."
          : null,
        href: `/marketing/broadcasts/${data.id}`,
      };
    }

    const safe = sanitizeLike(parsed.broadcast_name!);
    const { data, error } = await query
      .ilike("name", `%${safe}%`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      return { ok: false, action: name, message: "Could not load broadcasts." };
    }

    if (!data || data.length === 0) {
      return {
        ok: false,
        action: name,
        message: `No broadcast matching "${parsed.broadcast_name}".`,
      };
    }

    if (data.length === 1) {
      const b = data[0];
      const notSentYet =
        (!b.sent_count || b.sent_count === 0) && b.status !== "sent";
      return {
        ok: true,
        action: name,
        broadcast: b,
        performance_note: notSentYet
          ? "This broadcast has not been sent yet."
          : null,
        href: `/marketing/broadcasts/${b.id}`,
      };
    }

    return {
      ok: true,
      action: name,
      broadcasts: data.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        channel: b.channel,
        sent_count: b.sent_count,
        failed_count: b.failed_count,
        sent_at: b.sent_at,
        href: `/marketing/broadcasts/${b.id}`,
      })),
      note: "Multiple matches found — please pick one.",
    };
  }

  if (name === "remove_customer_tag") {
    const parsed = z
      .object({
        customer_name: z.string().trim().min(1).max(160).optional(),
        customer_id: z.string().uuid().optional(),
        tag: z.string().trim().min(1).max(40),
      })
      .refine((v) => Boolean(v.customer_name || v.customer_id), {
        message: "Provide customer_name or customer_id.",
      })
      .parse(rawArgs ?? {});

    let customerId = parsed.customer_id;
    let customerName: string | null = null;

    if (!customerId && parsed.customer_name) {
      const match = await resolveCustomerByName(
        ctx.businessId,
        parsed.customer_name,
      );
      if (match.kind === "none") {
        return {
          ok: false,
          action: name,
          message: `No customer matching "${parsed.customer_name}".`,
        };
      }
      if (match.kind === "many") {
        return {
          ok: false,
          action: name,
          message: `Several customers match: ${match.names.join(", ")}. Ask which one.`,
        };
      }
      customerId = match.id;
      customerName = match.name;
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("customers")
      .select("id, name, manual_tags")
      .eq("business_id", ctx.businessId)
      .eq("id", customerId!)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchErr || !existing) {
      return { ok: false, action: name, message: "Customer not found." };
    }

    customerName = customerName ?? existing.name;
    const tagsBefore: string[] = Array.isArray(existing.manual_tags)
      ? existing.manual_tags
      : [];
    const tagToRemove = parsed.tag.trim().toLowerCase();
    const tagsAfter = tagsBefore.filter(
      (t) => t.toLowerCase() !== tagToRemove,
    );

    const { error: updateErr } = await supabase
      .from("customers")
      .update({ manual_tags: tagsAfter })
      .eq("id", existing.id)
      .eq("business_id", ctx.businessId);

    if (updateErr) {
      return {
        ok: false,
        action: name,
        message: "Could not update customer tags.",
      };
    }

    return {
      ok: true,
      action: name,
      customer_id: existing.id,
      customer_name: customerName,
      tags_before: tagsBefore,
      tags_after: tagsAfter,
      href: `/marketing/customers/${existing.id}`,
    };
  }

  if (name === "deactivate_coupon") {
    const parsed = z
      .object({
        coupon_id: z.string().uuid().optional(),
        coupon_code: z.string().trim().min(1).max(32).optional(),
        confirm: z.boolean(),
      })
      .refine((v) => Boolean(v.coupon_id || v.coupon_code), {
        message: "Provide coupon_id or coupon_code.",
      })
      .parse(rawArgs ?? {});

    if (!parsed.confirm) {
      return {
        ok: false,
        action: name,
        message:
          "Please confirm you want to permanently deactivate this coupon.",
      };
    }

    let couponId = parsed.coupon_id;
    let couponCode: string | null = null;

    if (!couponId && parsed.coupon_code) {
      const match = await resolveCouponByCode(
        ctx.businessId,
        parsed.coupon_code,
      );
      if (match.kind === "none") {
        return {
          ok: false,
          action: name,
          message: `No coupon matching "${parsed.coupon_code}".`,
        };
      }
      if (match.kind === "many") {
        return {
          ok: false,
          action: name,
          message: `Several coupons match: ${match.codes.join(", ")}. Be more specific.`,
        };
      }
      couponId = match.id;
      couponCode = match.code;
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("coupons")
      .select("id, code, status")
      .eq("business_id", ctx.businessId)
      .eq("id", couponId!)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchErr || !existing) {
      return { ok: false, action: name, message: "Coupon not found." };
    }

    couponCode = couponCode ?? existing.code;

    const { error: updateErr } = await supabase
      .from("coupons")
      .update({ status: "inactive" })
      .eq("id", existing.id)
      .eq("business_id", ctx.businessId);

    if (updateErr) {
      return {
        ok: false,
        action: name,
        message: "Could not deactivate coupon.",
      };
    }

    return {
      ok: true,
      action: name,
      coupon_id: existing.id,
      coupon_code: couponCode,
      action_taken: "permanently_deactivated",
      href: `/marketing/coupons/${existing.id}`,
    };
  }

  return { ok: false, action: name, message: "Unknown action." };
}
