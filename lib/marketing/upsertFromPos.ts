import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeMyPhone } from "@/lib/marketing/phone";
import { dedupCustomer } from "@/lib/marketing/dedup";

/**
 * POS → Marketing customer upsert.
 *
 * Decisions doc Q3, Q11: the cashier role has zero permissions on the
 * Marketing pillar, so the POS handler can't talk to `/api/marketing/*`
 * directly. Sales' own POS endpoints call this helper instead, and this
 * helper uses the service-role Supabase client to bypass RLS.
 *
 * The service-role bypass is the entire risk surface here. To keep it
 * tiny:
 *
 *   - `businessId` is required and asserted non-empty BEFORE any DB call.
 *   - Every query is tenant-scoped via `.eq("business_id", businessId)`.
 *   - Calls go through the standard `dedupCustomer` helper so behaviour
 *     matches the Marketing-owned create path exactly.
 *
 * Returns a discriminated outcome:
 *   - `new`    — a new customer was created.
 *   - `merge`  — phone matched an existing customer and the name agreed;
 *                no insert, returns the existing id.
 *   - `prompt` — phone matched but the name diverges; a fresh row is
 *                inserted so the POS sale can complete, and the existing
 *                id is returned for surfacing in the CRM later.
 */

export interface PosUpsertInput {
  phone: string;
  name: string;
  businessId: string;
}

export type PosUpsertAction = "new" | "merge" | "prompt";

export interface PosUpsertResult {
  customerId: string;
  action: PosUpsertAction;
  existingCustomerId?: string;
  existingName?: string;
}

export async function upsertCustomerFromPos(
  input: PosUpsertInput,
): Promise<PosUpsertResult> {
  if (typeof input.businessId !== "string" || input.businessId.length === 0) {
    throw new Error(
      "upsertCustomerFromPos: businessId is required and must be a non-empty string",
    );
  }
  if (typeof input.name !== "string" || input.name.trim().length === 0) {
    throw new Error("upsertCustomerFromPos: name is required");
  }

  const supabase = createServiceRoleClient();
  const phoneE164 = normalizeMyPhone(input.phone);

  const dedup = await dedupCustomer(
    { phone: phoneE164, name: input.name, businessId: input.businessId },
    supabase,
  );

  if (dedup.action === "merge" && dedup.existingCustomerId) {
    return {
      customerId: dedup.existingCustomerId,
      action: "merge",
      existingCustomerId: dedup.existingCustomerId,
      existingName: dedup.existingName,
    };
  }

  // For both `new` and `prompt`, insert a fresh row so the POS sale can
  // attach a customer_id. The atomic insert + outbox event lives in the
  // `marketing_create_customer` RPC.
  const { data, error } = await supabase
    .rpc("marketing_create_customer", {
      p_business_id: input.businessId,
      p_name: input.name,
      p_phone_e164: phoneE164,
      p_email: null,
      p_address: null,
      p_manual_tags: [],
      p_notes: null,
      p_source: "pos",
      p_created_by_user_id: null,
    });

  if (error) {
    throw new Error(`upsertCustomerFromPos: insert failed: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : (data as { customer_id?: string } | null);
  const customerId = row?.customer_id;
  if (!customerId || typeof customerId !== "string") {
    throw new Error("upsertCustomerFromPos: RPC returned no customer id");
  }

  if (dedup.action === "prompt") {
    return {
      customerId,
      action: "prompt",
      existingCustomerId: dedup.existingCustomerId,
      existingName: dedup.existingName,
    };
  }

  return { customerId, action: "new" };
}
