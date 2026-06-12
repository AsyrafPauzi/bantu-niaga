/**
 * Bantu Niaga — Marketing M6 cross-pillar event listener integration tests.
 *
 * Exercises the SQL pipeline end-to-end against the live remote
 * Supabase project, using synthetic `events_outbox` rows because the
 * upstream Finance / Operations / Sales pillars are not yet built
 * (decisions Q4 + plan §3.3 D1–D4).
 *
 * Covers (mission section E):
 *   1. Synthetic events of all 4 supported types apply the metric
 *      update rule from plan §3.2 to the seeded customer.
 *   2. marketing_event_dedup gets one row per event with outcome=
 *      applied.
 *   3. Re-running the batch RPC is idempotent (no metric drift, no
 *      new dedup rows).
 *   4. Cross-business event (payload.business_id ≠ outbox business)
 *      → outcome=skipped_cross_business, no metric change.
 *   5. Event targeting a merged customer redirects to the survivor.
 *   6. Event targeting a missing customer → outcome=
 *      skipped_no_customer (graceful, no exception).
 *
 * Self-skips when the env vars to reach the live project are absent.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENABLED = Boolean(URL_ && SERVICE);

interface SeedCustomer {
  id: string;
  business_id: string;
  initial_total_spend: number;
  initial_order_count: number;
}

interface Fixture {
  service: SupabaseClient;
  bizA: string;
  bizB: string;
  customerA: SeedCustomer;
  customerB: SeedCustomer;
  /** A second customer in biz A whose merged_into_id points at customerA. */
  mergedDuplicate: SeedCustomer;
  eventIds: string[];
}

let fixture: Fixture | null = null;

async function seedBusiness(svc: SupabaseClient, label: string): Promise<string> {
  const id = randomUUID();
  const { error } = await svc.from("businesses").insert({
    id,
    idcompany: `m6-${label}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    name: `M6 fixture ${label}`,
    tier: "micro",
  });
  if (error) throw new Error(`seed biz ${label}: ${error.message}`);
  return id;
}

async function insertCustomer(
  svc: SupabaseClient,
  bizId: string,
  name: string,
  init: { total_spend_myr?: number; order_count?: number } = {},
): Promise<SeedCustomer> {
  const { data, error } = await svc
    .from("customers")
    .insert({
      business_id: bizId,
      name,
      total_spend_myr: init.total_spend_myr ?? 0,
      order_count: init.order_count ?? 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`insert customer ${name}: ${error.message}`);
  return {
    id: data!.id as string,
    business_id: bizId,
    initial_total_spend: init.total_spend_myr ?? 0,
    initial_order_count: init.order_count ?? 0,
  };
}

async function insertOutboxEvent(
  svc: SupabaseClient,
  bizId: string,
  name: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const id = randomUUID();
  const { error } = await svc.from("events_outbox").insert({
    id,
    business_id: bizId,
    name,
    payload,
  });
  if (error) throw new Error(`insert outbox ${name}: ${error.message}`);
  return id;
}

beforeAll(async () => {
  if (!ENABLED) return;
  const service = createClient(URL_!, SERVICE!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const bizA = await seedBusiness(service, "a");
  const bizB = await seedBusiness(service, "b");
  const customerA = await insertCustomer(service, bizA, "M6 A primary");
  const customerB = await insertCustomer(service, bizB, "M6 B primary");
  const mergedDuplicate = await insertCustomer(
    service,
    bizA,
    "M6 A duplicate (merged)",
  );

  // Point the duplicate at customerA (single-hop merge target).
  const { error: mergeErr } = await service
    .from("customers")
    .update({ merged_into_id: customerA.id })
    .eq("id", mergedDuplicate.id);
  if (mergeErr) throw new Error(`merge fixture: ${mergeErr.message}`);

  fixture = {
    service,
    bizA,
    bizB,
    customerA,
    customerB,
    mergedDuplicate,
    eventIds: [],
  };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;
  if (fixture.eventIds.length > 0) {
    await svc.from("marketing_event_dedup").delete().in(
      "event_id",
      fixture.eventIds,
    );
    await svc.from("events_outbox").delete().in("id", fixture.eventIds);
  }
  // Sweep customer.updated rows we may have generated.
  await svc
    .from("events_outbox")
    .delete()
    .in("business_id", [fixture.bizA, fixture.bizB])
    .eq("name", "customer.updated");
  await svc
    .from("customers")
    .delete()
    .in("id", [
      fixture.customerA.id,
      fixture.customerB.id,
      fixture.mergedDuplicate.id,
    ]);
  await svc.from("businesses").delete().in("id", [fixture.bizA, fixture.bizB]);
}, 60_000);

interface DedupRow {
  event_id: string;
  outcome: string | null;
  linked_customer_id: string | null;
  linked_invoice_id: string | null;
  business_id: string | null;
  event_name: string | null;
}

async function fetchDedup(
  svc: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, DedupRow>> {
  const { data, error } = await svc
    .from("marketing_event_dedup")
    .select(
      "event_id, outcome, linked_customer_id, linked_invoice_id, business_id, event_name",
    )
    .in("event_id", eventIds);
  if (error) throw new Error(`dedup fetch: ${error.message}`);
  const map = new Map<string, DedupRow>();
  for (const row of (data ?? []) as DedupRow[]) {
    map.set(row.event_id, row);
  }
  return map;
}

interface CustomerRow {
  id: string;
  total_spend_myr: number | string;
  order_count: number;
  last_purchase_at: string | null;
}

async function fetchCustomer(
  svc: SupabaseClient,
  id: string,
): Promise<CustomerRow> {
  const { data, error } = await svc
    .from("customers")
    .select("id, total_spend_myr, order_count, last_purchase_at")
    .eq("id", id)
    .single();
  if (error) throw new Error(`fetch customer ${id}: ${error.message}`);
  return data as CustomerRow;
}

function num(value: number | string): number {
  return typeof value === "string" ? Number(value) : value;
}

describe.runIf(ENABLED)("M6 — happy path: 4 supported events apply metric updates", () => {
  it("invoice.paid + order.delivered + booking.completed + lead.converted update the seeded customer", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    const before = await fetchCustomer(svc, fixture.customerA.id);
    expect(num(before.total_spend_myr)).toBe(0);
    expect(before.order_count).toBe(0);

    const invoicePaidAt = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const orderDeliveredAt = new Date(
      Date.now() - 4 * 86_400_000,
    ).toISOString();
    const bookingCompletedAt = new Date(
      Date.now() - 3 * 86_400_000,
    ).toISOString();
    const leadConvertedAt = new Date(
      Date.now() - 2 * 86_400_000,
    ).toISOString();

    const invoiceId = randomUUID();
    const evInvoicePaid = await insertOutboxEvent(svc, fixture.bizA, "invoice.paid", {
      invoice_id: invoiceId,
      invoice_number: "INV-M6-001",
      customer_id: fixture.customerA.id,
      business_id: fixture.bizA,
      total_myr: 250.5,
      payment_method: "duitnow_qr",
      paid_at: invoicePaidAt,
      line_items: [],
    });
    fixture.eventIds.push(evInvoicePaid);

    const evOrderDelivered = await insertOutboxEvent(
      svc,
      fixture.bizA,
      "order.delivered",
      {
        order_id: randomUUID(),
        customer_id: fixture.customerA.id,
        // invoice_id is null → no look-aside dedup, the order itself
        // contributes to metrics (cash-on-delivery case from plan §3.2.2).
        invoice_id: null,
        business_id: fixture.bizA,
        total_myr: 80,
        delivered_at: orderDeliveredAt,
        line_items: [],
      },
    );
    fixture.eventIds.push(evOrderDelivered);

    const evBookingCompleted = await insertOutboxEvent(
      svc,
      fixture.bizA,
      "booking.completed",
      {
        booking_id: randomUUID(),
        customer_id: fixture.customerA.id,
        invoice_id: null,
        business_id: fixture.bizA,
        service_total_myr: 120,
        completed_at: bookingCompletedAt,
      },
    );
    fixture.eventIds.push(evBookingCompleted);

    const evLeadConverted = await insertOutboxEvent(
      svc,
      fixture.bizA,
      "lead.converted",
      {
        lead_id: randomUUID(),
        customer_id: fixture.customerA.id,
        business_id: fixture.bizA,
        name: "M6 A primary",
        phone_e164: null,
        email: null,
        note: null,
        converted_at: leadConvertedAt,
      },
    );
    fixture.eventIds.push(evLeadConverted);

    const { data, error } = await svc.rpc(
      "marketing_apply_metric_events_batch",
      { p_limit: 100 },
    );
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{
      event_id: string;
      outcome: string;
      applied: boolean;
      error_message: string | null;
    }>;
    const targeted = rows.filter((r) =>
      [
        evInvoicePaid,
        evOrderDelivered,
        evBookingCompleted,
        evLeadConverted,
      ].includes(r.event_id),
    );
    expect(targeted.length).toBe(4);
    for (const r of targeted) {
      expect(r.outcome, `${r.event_id} outcome`).toBe("applied");
      expect(r.applied).toBe(true);
      expect(r.error_message).toBeNull();
    }

    // Customer metrics: 3 monetary events; lead.converted does not
    // touch metrics.
    const after = await fetchCustomer(svc, fixture.customerA.id);
    expect(num(after.total_spend_myr)).toBeCloseTo(250.5 + 80 + 120, 2);
    expect(after.order_count).toBe(3);
    expect(after.last_purchase_at).not.toBeNull();
    // last_purchase_at = max of (paid_at, delivered_at, completed_at).
    // booking.completed has the latest timestamp.
    expect(
      new Date(after.last_purchase_at!).valueOf(),
    ).toBeGreaterThanOrEqual(new Date(bookingCompletedAt).valueOf() - 1000);

    // Dedup: 4 rows all `applied`.
    const dedup = await fetchDedup(svc, [
      evInvoicePaid,
      evOrderDelivered,
      evBookingCompleted,
      evLeadConverted,
    ]);
    expect(dedup.size).toBe(4);
    for (const [, row] of dedup) {
      expect(row.outcome).toBe("applied");
      expect(row.business_id).toBe(fixture.bizA);
    }
    expect(dedup.get(evInvoicePaid)?.linked_invoice_id).toBe(invoiceId);
  });

  it("is idempotent — second batch run yields no metric drift and no new dedup rows", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;

    const before = await fetchCustomer(svc, fixture.customerA.id);

    const { data: data2, error: err2 } = await svc.rpc(
      "marketing_apply_metric_events_batch",
      { p_limit: 100 },
    );
    expect(err2).toBeNull();
    // The second run sees no new unprocessed events for these ids —
    // batch returns rows only for events absent from dedup. Our 4
    // events are already in dedup, so they should NOT appear.
    const rows = (data2 ?? []) as Array<{ event_id: string }>;
    for (const id of fixture.eventIds) {
      const seen = rows.find((r) => r.event_id === id);
      expect(seen, `event ${id} should NOT be re-processed`).toBeUndefined();
    }

    const after = await fetchCustomer(svc, fixture.customerA.id);
    expect(num(after.total_spend_myr)).toBe(num(before.total_spend_myr));
    expect(after.order_count).toBe(before.order_count);

    // Dedup row count for our 4 events is still 4.
    const dedup = await fetchDedup(svc, fixture.eventIds.slice(0, 4));
    expect(dedup.size).toBe(4);
  });

  it("calling marketing_apply_metric_event directly on an already-processed id returns skipped_already_processed", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    const replayId = fixture.eventIds[0];
    const before = await fetchCustomer(svc, fixture.customerA.id);

    const { data, error } = await svc.rpc("marketing_apply_metric_event", {
      p_event_id: replayId,
    });
    expect(error).toBeNull();
    const result = Array.isArray(data) ? data[0] : data;
    expect((result as { outcome: string }).outcome).toBe(
      "skipped_already_processed",
    );

    const after = await fetchCustomer(svc, fixture.customerA.id);
    expect(num(after.total_spend_myr)).toBe(num(before.total_spend_myr));
    expect(after.order_count).toBe(before.order_count);
  });
});

describe.runIf(ENABLED)("M6 — cross-business event is rejected", () => {
  it("event with payload.business_id = bizB targeted at customerA is marked skipped_cross_business", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    const before = await fetchCustomer(svc, fixture.customerA.id);

    // Outbox row says business A; payload claims business B → cross-
    // business inversion is caught early.
    const evId = await insertOutboxEvent(svc, fixture.bizA, "invoice.paid", {
      invoice_id: randomUUID(),
      invoice_number: "INV-XBUS-001",
      customer_id: fixture.customerA.id,
      business_id: fixture.bizB, // <-- disagrees with outbox business_id
      total_myr: 999,
      payment_method: "cash",
      paid_at: new Date().toISOString(),
      line_items: [],
    });
    fixture.eventIds.push(evId);

    const { data, error } = await svc.rpc("marketing_apply_metric_event", {
      p_event_id: evId,
    });
    expect(error).toBeNull();
    const result = Array.isArray(data) ? data[0] : data;
    expect((result as { outcome: string }).outcome).toBe(
      "skipped_cross_business",
    );

    const after = await fetchCustomer(svc, fixture.customerA.id);
    expect(num(after.total_spend_myr)).toBe(num(before.total_spend_myr));
    expect(after.order_count).toBe(before.order_count);

    const dedup = await fetchDedup(svc, [evId]);
    expect(dedup.get(evId)?.outcome).toBe("skipped_cross_business");
  });

  it("event whose customer lives in a different business than the outbox row is also rejected", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    const beforeA = await fetchCustomer(svc, fixture.customerA.id);
    const beforeB = await fetchCustomer(svc, fixture.customerB.id);

    // Outbox row says business A; customer_id is in business B.
    const evId = await insertOutboxEvent(svc, fixture.bizA, "invoice.paid", {
      invoice_id: randomUUID(),
      invoice_number: "INV-XBUS-002",
      customer_id: fixture.customerB.id, // <-- belongs to bizB
      total_myr: 555,
      payment_method: "cash",
      paid_at: new Date().toISOString(),
      line_items: [],
    });
    fixture.eventIds.push(evId);

    const { data, error } = await svc.rpc("marketing_apply_metric_event", {
      p_event_id: evId,
    });
    expect(error).toBeNull();
    const result = Array.isArray(data) ? data[0] : data;
    expect((result as { outcome: string }).outcome).toBe(
      "skipped_cross_business",
    );

    const afterA = await fetchCustomer(svc, fixture.customerA.id);
    const afterB = await fetchCustomer(svc, fixture.customerB.id);
    expect(num(afterA.total_spend_myr)).toBe(num(beforeA.total_spend_myr));
    expect(num(afterB.total_spend_myr)).toBe(num(beforeB.total_spend_myr));
  });
});

describe.runIf(ENABLED)("M6 — merged customer redirects to survivor", () => {
  it("invoice.paid targeting a merged customer applies the metric update to the surviving customer", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    const beforeSurvivor = await fetchCustomer(svc, fixture.customerA.id);
    const beforeMerged = await fetchCustomer(svc, fixture.mergedDuplicate.id);

    const evId = await insertOutboxEvent(svc, fixture.bizA, "invoice.paid", {
      invoice_id: randomUUID(),
      invoice_number: "INV-MERGED-001",
      customer_id: fixture.mergedDuplicate.id, // <-- merged-away id
      business_id: fixture.bizA,
      total_myr: 42,
      payment_method: "cash",
      paid_at: new Date().toISOString(),
      line_items: [],
    });
    fixture.eventIds.push(evId);

    const { data, error } = await svc.rpc("marketing_apply_metric_event", {
      p_event_id: evId,
    });
    expect(error).toBeNull();
    const result = Array.isArray(data) ? data[0] : data;
    expect((result as { outcome: string }).outcome).toBe("applied");
    expect((result as { customer_id: string }).customer_id).toBe(
      fixture.customerA.id,
    );

    const afterSurvivor = await fetchCustomer(svc, fixture.customerA.id);
    const afterMerged = await fetchCustomer(svc, fixture.mergedDuplicate.id);
    expect(num(afterSurvivor.total_spend_myr)).toBeCloseTo(
      num(beforeSurvivor.total_spend_myr) + 42,
      2,
    );
    expect(afterSurvivor.order_count).toBe(beforeSurvivor.order_count + 1);
    // Merged-away row untouched.
    expect(num(afterMerged.total_spend_myr)).toBe(num(beforeMerged.total_spend_myr));
    expect(afterMerged.order_count).toBe(beforeMerged.order_count);

    const dedup = await fetchDedup(svc, [evId]);
    expect(dedup.get(evId)?.outcome).toBe("applied");
    expect(dedup.get(evId)?.linked_customer_id).toBe(fixture.customerA.id);
  });
});

describe.runIf(ENABLED)("M6 — missing customer is skipped, not errored", () => {
  it("invoice.paid for a customer id that does not exist returns skipped_no_customer", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    const ghostCustomerId = randomUUID();
    const evId = await insertOutboxEvent(svc, fixture.bizA, "invoice.paid", {
      invoice_id: randomUUID(),
      invoice_number: "INV-GHOST-001",
      customer_id: ghostCustomerId,
      business_id: fixture.bizA,
      total_myr: 99,
      payment_method: "cash",
      paid_at: new Date().toISOString(),
      line_items: [],
    });
    fixture.eventIds.push(evId);

    const { data, error } = await svc.rpc("marketing_apply_metric_event", {
      p_event_id: evId,
    });
    expect(error).toBeNull();
    const result = Array.isArray(data) ? data[0] : data;
    expect((result as { outcome: string }).outcome).toBe("skipped_no_customer");

    const dedup = await fetchDedup(svc, [evId]);
    expect(dedup.get(evId)?.outcome).toBe("skipped_no_customer");
  });
});

describe.runIf(ENABLED)("M6 — order.delivered look-aside avoids double-counting with invoice.paid", () => {
  it("order.delivered carrying the same invoice_id as a processed invoice.paid event is skipped", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    const sharedInvoiceId = randomUUID();
    const before = await fetchCustomer(svc, fixture.customerA.id);

    // Process invoice.paid first.
    const evInvoice = await insertOutboxEvent(svc, fixture.bizA, "invoice.paid", {
      invoice_id: sharedInvoiceId,
      invoice_number: "INV-DOUBLE-001",
      customer_id: fixture.customerA.id,
      business_id: fixture.bizA,
      total_myr: 175,
      payment_method: "cash",
      paid_at: new Date().toISOString(),
      line_items: [],
    });
    fixture.eventIds.push(evInvoice);

    const { error: e1 } = await svc.rpc("marketing_apply_metric_event", {
      p_event_id: evInvoice,
    });
    expect(e1).toBeNull();

    const afterInvoice = await fetchCustomer(svc, fixture.customerA.id);
    expect(num(afterInvoice.total_spend_myr)).toBeCloseTo(
      num(before.total_spend_myr) + 175,
      2,
    );
    expect(afterInvoice.order_count).toBe(before.order_count + 1);

    // Now the matching order.delivered arrives. Should be skipped via
    // the linked_invoice_id look-aside; no further metric update.
    const evOrder = await insertOutboxEvent(
      svc,
      fixture.bizA,
      "order.delivered",
      {
        order_id: randomUUID(),
        customer_id: fixture.customerA.id,
        invoice_id: sharedInvoiceId,
        business_id: fixture.bizA,
        total_myr: 175,
        delivered_at: new Date().toISOString(),
        line_items: [],
      },
    );
    fixture.eventIds.push(evOrder);

    const { data, error: e2 } = await svc.rpc("marketing_apply_metric_event", {
      p_event_id: evOrder,
    });
    expect(e2).toBeNull();
    const result = Array.isArray(data) ? data[0] : data;
    expect((result as { outcome: string }).outcome).toBe(
      "skipped_already_processed",
    );

    const afterOrder = await fetchCustomer(svc, fixture.customerA.id);
    expect(num(afterOrder.total_spend_myr)).toBe(num(afterInvoice.total_spend_myr));
    expect(afterOrder.order_count).toBe(afterInvoice.order_count);
  });
});
