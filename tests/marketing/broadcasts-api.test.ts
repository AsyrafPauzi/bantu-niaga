/**
 * Integration tests for /api/marketing/broadcasts routes.
 *
 * Mocks getCurrentUser, createSupabaseServerClient, the service-role
 * client, and the lib/marketing/broadcasts.resolveRecipients helper
 * so the routes can be exercised without a live DB or Resend
 * connection. Verifies:
 *
 *   - list (200 happy / 403 forbidden)
 *   - create draft (201 happy / 400 invalid)
 *   - detail (200 with recipients)
 *   - delete draft (200) + delete non-draft (409)
 *   - send CTC happy path (returns wa_url list, sets status='sending')
 *   - mark-sent updates recipient + broadcast aggregate
 *   - mark-sent flips broadcast to 'sent' when all queued are done
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/current-user";

const OWNER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000aa",
  role: "owner",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const ACCOUNTANT: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000cc",
  role: "accountant",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const SEGMENT_ID = "20000000-0000-4000-8000-000000000001";
const BROADCAST_ID = "30000000-0000-4000-8000-000000000001";
const RECIPIENT_ID_1 = "40000000-0000-4000-8000-000000000001";
const RECIPIENT_ID_2 = "40000000-0000-4000-8000-000000000002";

interface QueryStub {
  table: string;
  ops: { method: string; args: unknown[] }[];
}

interface SupabaseStub {
  queries: QueryStub[];
  from: (table: string) => Promise<unknown> & Record<string, unknown>;
}

function makeSupabaseStub(
  handlers: Record<string, (q: QueryStub) => Promise<unknown>>,
): SupabaseStub {
  const queries: QueryStub[] = [];

  function from(table: string) {
    const q: QueryStub = { table, ops: [] };
    queries.push(q);

    function method(name: string) {
      return (...args: unknown[]) => {
        q.ops.push({ method: name, args });
        return chain;
      };
    }
    function thenLike(onResolve: (value: unknown) => unknown) {
      const handler =
        handlers[`${table}:${q.ops.map((o) => o.method).join(",")}`] ??
        handlers[table] ??
        (async () => ({ data: null, error: null }));
      return handler(q).then(onResolve);
    }
    const chain: Record<string, unknown> = {
      select: method("select"),
      insert: method("insert"),
      update: method("update"),
      upsert: method("upsert"),
      delete: method("delete"),
      eq: method("eq"),
      neq: method("neq"),
      is: method("is"),
      in: method("in"),
      gte: method("gte"),
      lte: method("lte"),
      gt: method("gt"),
      lt: method("lt"),
      or: method("or"),
      not: method("not"),
      overlaps: method("overlaps"),
      order: method("order"),
      limit: method("limit"),
      range: method("range"),
      maybeSingle: method("maybeSingle"),
      single: method("single"),
      then: thenLike,
    };
    return chain;
  }

  return { queries, from: from as SupabaseStub["from"] };
}

interface LoadOpts {
  user?: CurrentUser | "unauthorized";
  serverHandlers?: Record<string, (q: QueryStub) => Promise<unknown>>;
  serviceHandlers?: Record<string, (q: QueryStub) => Promise<unknown>>;
  resolveRecipientsResult?: {
    customer_id: string;
    name: string;
    channel_address: string;
  }[];
}

async function loadRoutes(opts: LoadOpts = {}) {
  vi.resetModules();
  const { UnauthorizedError } = await import("@/lib/auth/current-user");

  vi.doMock("@/lib/auth/current-user", async () => {
    const actual = await vi.importActual<typeof import("@/lib/auth/current-user")>(
      "@/lib/auth/current-user",
    );
    return {
      ...actual,
      getCurrentUser: vi.fn(async () => {
        if (opts.user === "unauthorized") {
          throw new UnauthorizedError("no_session", "test: no session");
        }
        return opts.user ?? OWNER;
      }),
    };
  });

  const serverStub = makeSupabaseStub(opts.serverHandlers ?? {});
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => serverStub),
  }));

  const serviceStub = makeSupabaseStub(opts.serviceHandlers ?? {});
  vi.doMock("@/lib/supabase/service-role", () => ({
    createServiceRoleClient: vi.fn(() => serviceStub),
  }));

  // Stub resolveRecipients to avoid pulling in resolveSegmentMembers.
  vi.doMock("@/lib/marketing/broadcasts", async () => {
    const actual = await vi.importActual<typeof import("@/lib/marketing/broadcasts")>(
      "@/lib/marketing/broadcasts",
    );
    return {
      ...actual,
      resolveRecipients: vi.fn(async () => opts.resolveRecipientsResult ?? []),
      // Don't actually call Resend in tests.
      sendEmailBatch: vi.fn(async (recipients: { ref: string }[]) => ({
        ok: true,
        results: recipients.map((r) => ({ ref: r.ref, ok: true })),
      })),
    };
  });

  const list = await import("@/app/api/marketing/broadcasts/route");
  const detail = await import("@/app/api/marketing/broadcasts/[id]/route");
  const send = await import("@/app/api/marketing/broadcasts/[id]/send/route");
  const markSent = await import(
    "@/app/api/marketing/broadcasts/[id]/recipients/[rid]/mark-sent/route"
  );

  return { list, detail, send, markSent, serverStub, serviceStub };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/supabase/service-role");
  vi.doUnmock("@/lib/marketing/broadcasts");
});

const BROADCAST_FIXTURE = {
  id: BROADCAST_ID,
  business_id: OWNER.businessId,
  name: "Test",
  channel: "whatsapp_ctc",
  segment_id: SEGMENT_ID,
  subject: null,
  message_template: "Hi {first_name}",
  coupon_id: null,
  status: "draft",
  total_recipients: 0,
  sent_count: 0,
  failed_count: 0,
  scheduled_at: null,
  sent_at: null,
  created_by: OWNER.id,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("GET /api/marketing/broadcasts", () => {
  beforeEach(() => vi.resetModules());

  it("401 unauthorized", async () => {
    const { list } = await loadRoutes({ user: "unauthorized" });
    const res = await list.GET(
      new Request("http://x/api/marketing/broadcasts"),
    );
    expect(res.status).toBe(401);
  });

  it("403 accountant", async () => {
    const { list } = await loadRoutes({ user: ACCOUNTANT });
    const res = await list.GET(
      new Request("http://x/api/marketing/broadcasts"),
    );
    expect(res.status).toBe(403);
  });

  it("200 returns rows scoped to caller's business", async () => {
    const { list, serverStub } = await loadRoutes({
      serverHandlers: {
        broadcasts: async () => ({
          data: [BROADCAST_FIXTURE],
          error: null,
        }),
      },
    });
    const res = await list.GET(
      new Request("http://x/api/marketing/broadcasts"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    const q = serverStub.queries.find((q) => q.table === "broadcasts");
    const eqBiz = q!.ops.find(
      (o) => o.method === "eq" && o.args[0] === "business_id",
    );
    expect(eqBiz?.args[1]).toBe(OWNER.businessId);
  });
});

describe("POST /api/marketing/broadcasts (create draft)", () => {
  it("400 invalid body (missing segment_id)", async () => {
    const { list } = await loadRoutes();
    const res = await list.POST(
      new Request("http://x/api/marketing/broadcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "no segment",
          channel: "whatsapp_ctc",
          message_template: "hi",
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when subject is provided for whatsapp_ctc", async () => {
    const { list } = await loadRoutes();
    const res = await list.POST(
      new Request("http://x/api/marketing/broadcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "x",
          channel: "whatsapp_ctc",
          segment_id: SEGMENT_ID,
          subject: "nope",
          message_template: "hi",
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("201 happy path; inserts caller's business + status=draft", async () => {
    let inserted: Record<string, unknown> | null = null;
    const { list } = await loadRoutes({
      serverHandlers: {
        customer_segments: async () => ({
          data: {
            id: SEGMENT_ID,
            business_id: OWNER.businessId,
            deleted_at: null,
          },
          error: null,
        }),
        broadcasts: async (q) => {
          const insertCall = q.ops.find((o) => o.method === "insert");
          if (insertCall) {
            inserted = insertCall.args[0] as Record<string, unknown>;
          }
          return { data: { ...BROADCAST_FIXTURE }, error: null };
        },
      },
    });
    const res = await list.POST(
      new Request("http://x/api/marketing/broadcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          channel: "whatsapp_ctc",
          segment_id: SEGMENT_ID,
          message_template: "Hi {first_name}",
        }),
      }),
    );
    expect(res.status).toBe(201);
    expect(inserted).toBeTruthy();
    const ins = inserted!;
    expect(ins.business_id).toBe(OWNER.businessId);
    expect(ins.channel).toBe("whatsapp_ctc");
  });
});

describe("GET /api/marketing/broadcasts/[id]", () => {
  it("404 not found", async () => {
    const { detail } = await loadRoutes({
      serverHandlers: {
        broadcasts: async () => ({ data: null, error: null }),
      },
    });
    const res = await detail.GET(
      new Request(`http://x/api/marketing/broadcasts/${BROADCAST_ID}`),
      { params: Promise.resolve({ id: BROADCAST_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it("200 with recipients", async () => {
    const { detail } = await loadRoutes({
      serverHandlers: {
        broadcasts: async () => ({ data: BROADCAST_FIXTURE, error: null }),
        broadcast_recipients: async () => ({
          data: [
            {
              id: RECIPIENT_ID_1,
              broadcast_id: BROADCAST_ID,
              customer_id: "c1",
              channel_address: "+60123456789",
              rendered_message: "Hi Ali",
              rendered_subject: null,
              status: "sent",
              error: null,
              sent_at: new Date().toISOString(),
              opened_at: null,
            },
          ],
          error: null,
        }),
      },
    });
    const res = await detail.GET(
      new Request(`http://x/api/marketing/broadcasts/${BROADCAST_ID}`),
      { params: Promise.resolve({ id: BROADCAST_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(BROADCAST_ID);
    expect(body.recipients).toHaveLength(1);
  });
});

describe("DELETE /api/marketing/broadcasts/[id]", () => {
  it("200 deletes a draft", async () => {
    let calls = 0;
    const { detail } = await loadRoutes({
      serverHandlers: {
        broadcasts: async () => {
          calls += 1;
          if (calls === 1) {
            return { data: { id: BROADCAST_ID, status: "draft" }, error: null };
          }
          return { data: null, error: null };
        },
      },
    });
    const res = await detail.DELETE(
      new Request(`http://x/api/marketing/broadcasts/${BROADCAST_ID}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: BROADCAST_ID }) },
    );
    expect(res.status).toBe(200);
  });

  it("409 when status != draft", async () => {
    const { detail } = await loadRoutes({
      serverHandlers: {
        broadcasts: async () => ({
          data: { id: BROADCAST_ID, status: "sent" },
          error: null,
        }),
      },
    });
    const res = await detail.DELETE(
      new Request(`http://x/api/marketing/broadcasts/${BROADCAST_ID}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: BROADCAST_ID }) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("not_deletable");
  });
});

describe("POST /api/marketing/broadcasts/[id]/send (CTC happy path)", () => {
  it("locks status='sending', inserts recipients, returns wa_url list", async () => {
    const allBcastUpdates: Record<string, unknown>[] = [];
    let recipientInsert: Record<string, unknown>[] | null = null;
    const { send } = await loadRoutes({
      serverHandlers: {
        broadcasts: async () => ({
          data: { ...BROADCAST_FIXTURE, status: "draft" },
          error: null,
        }),
      },
      serviceHandlers: {
        broadcasts: async (q) => {
          const insertCall = q.ops.find((o) => o.method === "update");
          if (insertCall) {
            allBcastUpdates.push(insertCall.args[0] as Record<string, unknown>);
          }
          return { data: { id: BROADCAST_ID }, error: null };
        },
        broadcast_recipients: async (q) => {
          const insertCall = q.ops.find((o) => o.method === "insert");
          if (insertCall) {
            recipientInsert = insertCall.args[0] as Record<string, unknown>[];
          }
          return {
            data: [
              {
                id: RECIPIENT_ID_1,
                customer_id: "c1",
                channel_address: "+60123456789",
                rendered_message: "Hi Ali",
                rendered_subject: null,
                status: "queued",
              },
              {
                id: RECIPIENT_ID_2,
                customer_id: "c2",
                channel_address: "+60987654321",
                rendered_message: "Hi Siti",
                rendered_subject: null,
                status: "queued",
              },
            ],
            error: null,
          };
        },
      },
      resolveRecipientsResult: [
        {
          customer_id: "c1",
          name: "Ali bin Abu",
          channel_address: "+60123456789",
        },
        {
          customer_id: "c2",
          name: "Siti Sara",
          channel_address: "+60987654321",
        },
      ],
    });
    const res = await send.POST(
      new Request(
        `http://x/api/marketing/broadcasts/${BROADCAST_ID}/send`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id: BROADCAST_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channel).toBe("whatsapp_ctc");
    expect(body.recipients).toHaveLength(2);
    expect(body.recipients[0].wa_url).toContain(
      "https://wa.me/60123456789?text=",
    );
    // The first broadcast update should be the status=sending lock.
    expect(allBcastUpdates[0]).toMatchObject({ status: "sending" });
    expect(recipientInsert).toHaveLength(2);
  });

  it("409 when broadcast is not in draft", async () => {
    const { send } = await loadRoutes({
      serverHandlers: {
        broadcasts: async () => ({
          data: { ...BROADCAST_FIXTURE, status: "sent" },
          error: null,
        }),
      },
    });
    const res = await send.POST(
      new Request(
        `http://x/api/marketing/broadcasts/${BROADCAST_ID}/send`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id: BROADCAST_ID }) },
    );
    expect(res.status).toBe(409);
  });
});

describe("POST /api/marketing/broadcasts/[id]/recipients/[rid]/mark-sent", () => {
  it("updates recipient; broadcast not yet 'sent' when queued remain", async () => {
    let bcastPatch: Record<string, unknown> | null = null;
    const { markSent } = await loadRoutes({
      serverHandlers: {
        broadcasts: async () => ({
          data: {
            id: BROADCAST_ID,
            business_id: OWNER.businessId,
            channel: "whatsapp_ctc",
            status: "sending",
            total_recipients: 2,
          },
          error: null,
        }),
        broadcast_recipients: async () => ({
          data: {
            id: RECIPIENT_ID_1,
            broadcast_id: BROADCAST_ID,
            status: "queued",
          },
          error: null,
        }),
      },
      serviceHandlers: {
        broadcast_recipients: async (q) => {
          // Counts: 1 sent, 0 failed, 1 queued
          const select = q.ops.find((o) => o.method === "select");
          if (select && q.ops.find(
            (o) => o.method === "eq" && o.args[0] === "status" && o.args[1] === "sent",
          )) {
            return { count: 1, data: null, error: null };
          }
          if (select && q.ops.find(
            (o) => o.method === "eq" && o.args[0] === "status" && o.args[1] === "failed",
          )) {
            return { count: 0, data: null, error: null };
          }
          if (select && q.ops.find(
            (o) => o.method === "eq" && o.args[0] === "status" && o.args[1] === "queued",
          )) {
            return { count: 1, data: null, error: null };
          }
          return { data: null, error: null };
        },
        broadcasts: async (q) => {
          const u = q.ops.find((o) => o.method === "update");
          if (u) bcastPatch = u.args[0] as Record<string, unknown>;
          return { data: null, error: null };
        },
      },
    });
    const res = await markSent.POST(
      new Request(
        `http://x/api/marketing/broadcasts/${BROADCAST_ID}/recipients/${RECIPIENT_ID_1}/mark-sent`,
        { method: "POST" },
      ),
      {
        params: Promise.resolve({ id: BROADCAST_ID, rid: RECIPIENT_ID_1 }),
      },
    );
    expect(res.status).toBe(200);
    expect(bcastPatch).toMatchObject({ sent_count: 1 });
    // While queued remain, status stays as-is (not bumped to 'sent').
    expect(bcastPatch!.status).toBeUndefined();
  });

  it("rolls broadcast to 'sent' when all queued are done", async () => {
    let bcastPatch: Record<string, unknown> | null = null;
    const { markSent } = await loadRoutes({
      serverHandlers: {
        broadcasts: async () => ({
          data: {
            id: BROADCAST_ID,
            business_id: OWNER.businessId,
            channel: "whatsapp_ctc",
            status: "sending",
            total_recipients: 2,
          },
          error: null,
        }),
        broadcast_recipients: async () => ({
          data: {
            id: RECIPIENT_ID_2,
            broadcast_id: BROADCAST_ID,
            status: "queued",
          },
          error: null,
        }),
      },
      serviceHandlers: {
        broadcast_recipients: async (q) => {
          // Counts: 2 sent, 0 failed, 0 queued — terminal.
          if (q.ops.find(
            (o) => o.method === "eq" && o.args[0] === "status" && o.args[1] === "sent",
          )) {
            return { count: 2, data: null, error: null };
          }
          if (q.ops.find(
            (o) => o.method === "eq" && o.args[0] === "status" && o.args[1] === "failed",
          )) {
            return { count: 0, data: null, error: null };
          }
          if (q.ops.find(
            (o) => o.method === "eq" && o.args[0] === "status" && o.args[1] === "queued",
          )) {
            return { count: 0, data: null, error: null };
          }
          return { data: null, error: null };
        },
        broadcasts: async (q) => {
          const u = q.ops.find((o) => o.method === "update");
          if (u) bcastPatch = u.args[0] as Record<string, unknown>;
          return { data: null, error: null };
        },
      },
    });
    const res = await markSent.POST(
      new Request(
        `http://x/api/marketing/broadcasts/${BROADCAST_ID}/recipients/${RECIPIENT_ID_2}/mark-sent`,
        { method: "POST" },
      ),
      {
        params: Promise.resolve({ id: BROADCAST_ID, rid: RECIPIENT_ID_2 }),
      },
    );
    expect(res.status).toBe(200);
    expect(bcastPatch).toMatchObject({ sent_count: 2, status: "sent" });
  });
});
