import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  patchSchemaForMode,
  type SurfaceMode,
  type PatchCustomerFull,
} from "@/lib/marketing/schemas";
import { normalizeMyPhone } from "@/lib/marketing/phone";
import { dedupCustomer } from "@/lib/marketing/dedup";
import type { CustomerUpdatedField } from "@/lib/events/types";

/**
 * /api/marketing/customers/[id] — single-row CRUD for Marketing M2.
 *
 *   GET    → full customer + last 10 tag-history rows
 *   PATCH  → diff-aware update + `customer.updated` outbox emission
 *   DELETE → soft-delete (sets `deleted_at`) + `customer.deleted` outbox
 *
 * PATCH respects the desktop-vs-mobile field whitelist by reading
 * `X-Surface-Mode: desktop | mobile`. Mobile is restricted to
 * `notes`, `manual_tags`, `phone` (decisions doc Q10). The header is
 * defensive: an absent / unknown value falls back to `desktop`.
 */

export const dynamic = "force-dynamic";

function resolveSurfaceMode(request: Request): SurfaceMode {
  const header = request.headers.get("x-surface-mode")?.toLowerCase() ?? "";
  return header === "mobile" ? "mobile" : "desktop";
}

async function requireUser(request: Request) {
  void request;
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "marketing", "customers")) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "forbidden", reason: "marketing.customers access denied" },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "unauthorized", code: e.code },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user!;

  const supabase = await createSupabaseServerClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select(
      "id, name, phone_e164, email, address, manual_tags, auto_tags, " +
        "notes, source, total_spend_myr, last_purchase_at, order_count, " +
        "aov_myr, created_at, updated_at, created_by_user_id, merged_into_id, deleted_at",
    )
    .eq("business_id", user.businessId)
    .eq("id", id)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "load_failed", message: error.message },
      { status: 500 },
    );
  }
  if (!customer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: history, error: histErr } = await supabase
    .from("customer_tag_history")
    .select("id, prior_auto_tags, new_auto_tags, computed_at, run_id")
    .eq("business_id", user.businessId)
    .eq("customer_id", id)
    .order("computed_at", { ascending: false })
    .limit(10);

  if (histErr) {
    return NextResponse.json(
      { error: "load_failed", message: histErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { customer, tag_history: history ?? [] },
    { status: 200 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user!;

  const mode = resolveSurfaceMode(request);
  const schema = patchSchemaForMode(mode);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = schema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();

  // Load current state so we can diff for the `changed_fields` payload
  // and run dedup if the phone is being changed.
  const { data: current, error: currentErr } = await supabase
    .from("customers")
    .select("id, name, phone_e164, email, address, manual_tags, notes")
    .eq("business_id", user.businessId)
    .eq("id", id)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .maybeSingle();

  if (currentErr) {
    return NextResponse.json(
      { error: "load_failed", message: currentErr.message },
      { status: 500 },
    );
  }
  if (!current) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Decide which fields the RPC will write. The RPC needs explicit
  // boolean "set_*" flags so it can distinguish "set to null" from
  // "don't touch".
  const fields = parsed as PatchCustomerFull;
  const setName = Object.prototype.hasOwnProperty.call(fields, "name");
  const setPhone = Object.prototype.hasOwnProperty.call(fields, "phone");
  const setEmail = Object.prototype.hasOwnProperty.call(fields, "email");
  const setAddress = Object.prototype.hasOwnProperty.call(fields, "address");
  const setManualTags = Object.prototype.hasOwnProperty.call(
    fields,
    "manual_tags",
  );
  const setNotes = Object.prototype.hasOwnProperty.call(fields, "notes");

  let nextPhoneE164: string | null | undefined = undefined;
  if (setPhone) {
    if (fields.phone == null || fields.phone === "") {
      nextPhoneE164 = null;
    } else {
      const normalized = normalizeMyPhone(fields.phone);
      if (normalized === null) {
        return NextResponse.json(
          {
            error: "invalid_phone",
            message:
              "Phone could not be parsed as E.164. Use +60… for international or 0… for Malaysian local format.",
          },
          { status: 400 },
        );
      }
      nextPhoneE164 = normalized;
    }

    // Phone-collision check mirrors the create flow (assumption #14):
    // if the new phone matches another customer in this business, signal
    // an `action: "prompt"` so the UI surfaces a merge banner instead of
    // silently violating the unique-phone constraint.
    if (nextPhoneE164 !== null && nextPhoneE164 !== current.phone_e164) {
      const dedup = await dedupCustomer(
        {
          phone: nextPhoneE164,
          name: setName && fields.name ? fields.name : current.name,
          businessId: user.businessId,
        },
        supabase,
      );
      if (
        (dedup.action === "merge" || dedup.action === "prompt") &&
        dedup.existingCustomerId &&
        dedup.existingCustomerId !== id
      ) {
        return NextResponse.json(
          {
            action: "prompt",
            existing_customer_id: dedup.existingCustomerId,
            existing_name: dedup.existingName ?? null,
          },
          { status: 200 },
        );
      }
    }
  }

  const nextEmail = setEmail
    ? fields.email === "" || fields.email == null
      ? null
      : fields.email
    : null;
  const nextAddress = setAddress ? fields.address ?? null : null;
  const nextNotes = setNotes ? fields.notes ?? null : null;
  const nextManualTags = setManualTags ? fields.manual_tags ?? [] : null;
  const nextName = setName && fields.name ? fields.name : null;

  // Diff the incoming values against the loaded row so the outbox event
  // carries an accurate `changed_fields` list.
  const changed: CustomerUpdatedField[] = [];
  if (setName && nextName !== null && nextName !== current.name) {
    changed.push("name");
  }
  if (setPhone && (nextPhoneE164 ?? null) !== (current.phone_e164 ?? null)) {
    changed.push("phone_e164");
  }
  if (setEmail && (nextEmail ?? null) !== (current.email ?? null)) {
    changed.push("email");
  }
  if (setAddress && (nextAddress ?? null) !== (current.address ?? null)) {
    changed.push("address");
  }
  if (setNotes && (nextNotes ?? null) !== (current.notes ?? null)) {
    changed.push("notes");
  }
  if (setManualTags && nextManualTags !== null) {
    const a = [...(current.manual_tags ?? [])].sort();
    const b = [...nextManualTags].sort();
    if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
      changed.push("manual_tags");
    }
  }

  const { data, error: rpcErr } = await supabase.rpc(
    "marketing_update_customer",
    {
      p_business_id: user.businessId,
      p_customer_id: id,
      p_name: nextName,
      p_phone_e164: nextPhoneE164 ?? null,
      p_email: nextEmail,
      p_address: nextAddress,
      p_manual_tags: nextManualTags,
      p_notes: nextNotes,
      p_changed_fields: changed,
      p_actor_user_id: user.id,
      p_set_phone: setPhone,
      p_set_email: setEmail,
      p_set_address: setAddress,
      p_set_notes: setNotes,
      p_set_name: setName,
      p_set_manual_tags: setManualTags,
    },
  );

  if (rpcErr) {
    if (rpcErr.code === "P0001" && rpcErr.message === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (rpcErr.code === "23505") {
      // Unique-phone violation slipped past the dedup check.
      return NextResponse.json(
        { error: "duplicate_phone", message: rpcErr.message },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "update_failed", message: rpcErr.message },
      { status: 500 },
    );
  }

  const row = Array.isArray(data)
    ? (data[0] as { customer_id?: string; event_id?: string | null } | undefined)
    : (data as { customer_id?: string; event_id?: string | null } | null);

  return NextResponse.json(
    {
      action: "updated",
      customer_id: row?.customer_id ?? id,
      event_id: row?.event_id ?? null,
      changed_fields: changed,
    },
    { status: 200 },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user!;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc(
    "marketing_soft_delete_customer",
    {
      p_business_id: user.businessId,
      p_customer_id: id,
      p_actor_user_id: user.id,
    },
  );

  if (error) {
    if (error.code === "P0001" && error.message === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "delete_failed", message: error.message },
      { status: 500 },
    );
  }

  const row = Array.isArray(data)
    ? (data[0] as
        | { customer_id?: string; event_id?: string; deleted_at?: string }
        | undefined)
    : (data as
        | { customer_id?: string; event_id?: string; deleted_at?: string }
        | null);

  return NextResponse.json(
    {
      action: "deleted",
      customer_id: row?.customer_id ?? id,
      event_id: row?.event_id ?? null,
      deleted_at: row?.deleted_at ?? null,
    },
    { status: 200 },
  );
}
