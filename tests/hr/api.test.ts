import { afterEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/current-user";

const OWNER_USER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000aa",
  role: "owner",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const ACCOUNTANT_USER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000cc",
  role: "accountant",
  businessId: OWNER_USER.businessId,
  isStub: false,
};

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildInsertClient(result: { data: unknown; error: null | { message: string } }) {
  const single = vi.fn(async () => result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const eq = vi.fn(() => ({ insert, select }));
  const from = vi.fn(() => ({ insert, select, eq }));
  return { client: { from }, insert, select, single };
}

function buildUpdateClient(result: { data: unknown; error: null | { message: string } }) {
  const single = vi.fn(async () => result);
  const select = vi.fn(() => ({ single }));
  const eqSecond = vi.fn(() => ({ select }));
  const eqFirst = vi.fn(() => ({ eq: eqSecond }));
  const update = vi.fn(() => ({ eq: eqFirst }));
  const from = vi.fn(() => ({ update }));
  return { client: { from }, update, eqFirst, eqSecond, select, single };
}

function buildLeaveLinkGenerateClient(results: {
  employee: { data: unknown; error: null | { message: string } };
  link: { data: unknown; error: null | { message: string } };
}) {
  const employeeSingle = vi.fn(async () => results.employee);
  const employeeEqBusiness = vi.fn(() => ({ single: employeeSingle }));
  const employeeEqId = vi.fn(() => ({ eq: employeeEqBusiness }));
  const employeeSelect = vi.fn(() => ({ eq: employeeEqId }));

  const linkSingle = vi.fn(async () => results.link);
  const linkSelectAfterInsert = vi.fn(() => ({ single: linkSingle }));
  const linkInsert = vi.fn(() => ({ select: linkSelectAfterInsert }));

  const from = vi.fn((table: string) => {
    if (table === "hr_employees") return { select: employeeSelect };
    if (table === "hr_leave_request_links") return { insert: linkInsert };
    throw new Error(`unexpected table ${table}`);
  });

  return { client: { from }, linkInsert, employeeEqId, employeeEqBusiness };
}

function buildPublicLeaveClient(results: {
  link: { data: unknown; error: null | { message: string } };
  used: { data: unknown; error: null | { message: string } };
  leave: { data: unknown; error: null | { message: string } };
}) {
  const linkMaybeSingle = vi.fn(async () => results.link);
  const linkEq = vi.fn(() => ({ maybeSingle: linkMaybeSingle }));
  const linkSelect = vi.fn(() => ({ eq: linkEq }));

  const usedSelectSingle = vi.fn(async () => results.used);
  const usedSelect = vi.fn(() => ({ single: usedSelectSingle }));
  const usedEq = vi.fn(() => ({ select: usedSelect }));
  const usedUpdate = vi.fn(() => ({ eq: usedEq }));

  const leaveSingle = vi.fn(async () => results.leave);
  const leaveSelect = vi.fn(() => ({ single: leaveSingle }));
  const leaveInsert = vi.fn(() => ({ select: leaveSelect }));

  const from = vi.fn((table: string) => {
    if (table === "hr_leave_request_links") {
      return { select: linkSelect, update: usedUpdate };
    }
    if (table === "hr_leave_records") return { insert: leaveInsert };
    throw new Error(`unexpected table ${table}`);
  });

  return { client: { from }, usedUpdate, leaveInsert };
}

async function mockRoute(opts: {
  user?: CurrentUser | "unauthorized";
  client: unknown;
}) {
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
        return opts.user ?? OWNER_USER;
      }),
    };
  });
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => opts.client),
  }));
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/server");
});

describe("POST /api/hr/employees", () => {
  it("returns 401 when unauthenticated", async () => {
    const db = buildInsertClient({ data: null, error: null });
    await mockRoute({ user: "unauthorized", client: db.client });
    const { POST } = await import("@/app/api/hr/employees/route");

    const res = await POST(jsonRequest("http://localhost/api/hr/employees", {}));

    expect(res.status).toBe(401);
  });

  it("returns 403 for roles without HR access", async () => {
    const db = buildInsertClient({ data: null, error: null });
    await mockRoute({ user: ACCOUNTANT_USER, client: db.client });
    const { POST } = await import("@/app/api/hr/employees/route");

    const res = await POST(
      jsonRequest("http://localhost/api/hr/employees", {
        full_name: "Siti",
        employment_type: "full_time",
        role_title: "Supervisor",
        start_date: "2026-06-24",
      }),
    );

    expect(res.status).toBe(403);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates an employee scoped to the current business", async () => {
    const row = { id: "emp_1", full_name: "Siti Aminah" };
    const db = buildInsertClient({ data: row, error: null });
    await mockRoute({ client: db.client });
    const { POST } = await import("@/app/api/hr/employees/route");

    const res = await POST(
      jsonRequest("http://localhost/api/hr/employees", {
        full_name: "Siti Aminah",
        employment_type: "full_time",
        role_title: "Supervisor",
        start_date: "2026-06-24",
      }),
    );

    expect(res.status).toBe(201);
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: OWNER_USER.businessId,
        created_by: OWNER_USER.id,
        full_name: "Siti Aminah",
      }),
    );
  });
});

describe("PATCH /api/hr/leave/[id]/status", () => {
  it("approves leave with approver metadata", async () => {
    const db = buildUpdateClient({
      data: { id: "leave_1", status: "approved" },
      error: null,
    });
    await mockRoute({ client: db.client });
    const { PATCH } = await import("@/app/api/hr/leave/[id]/status/route");

    const res = await PATCH(
      jsonRequest("http://localhost/api/hr/leave/leave_1/status", {
        status: "approved",
      }),
      { params: Promise.resolve({ id: "leave_1" }) },
    );

    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        decided_by: OWNER_USER.id,
      }),
    );
  });
});

describe("POST /api/hr/leave-links", () => {
  it("creates a 24-hour leave link scoped to the current business employee", async () => {
    const db = buildLeaveLinkGenerateClient({
      employee: {
        data: { id: "00000000-0000-0000-0000-000000000123", full_name: "Aisyah" },
        error: null,
      },
      link: {
        data: {
          id: "link_1",
          employee_id: "00000000-0000-0000-0000-000000000123",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      },
    });
    await mockRoute({ client: db.client });
    const { POST } = await import("@/app/api/hr/leave-links/route");

    const res = await POST(
      jsonRequest("http://localhost/api/hr/leave-links", {
        employee_id: "00000000-0000-0000-0000-000000000123",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.url).toMatch(/^http:\/\/localhost:3000\/staff\/leave\/[A-Za-z0-9_-]+$/);
    expect(db.employeeEqBusiness).toHaveBeenCalledWith("business_id", OWNER_USER.businessId);
    expect(db.linkInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: OWNER_USER.businessId,
        employee_id: "00000000-0000-0000-0000-000000000123",
        token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        created_by: OWNER_USER.id,
      }),
    );
  });
});

describe("POST /api/staff/leave/[token]", () => {
  it("creates pending leave for the token employee and marks the link used", async () => {
    const db = buildPublicLeaveClient({
      link: {
        data: {
          id: "link_1",
          business_id: OWNER_USER.businessId,
          employee_id: "00000000-0000-0000-0000-000000000123",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
        },
        error: null,
      },
      used: { data: { id: "link_1" }, error: null },
      leave: { data: { id: "leave_1", status: "pending" }, error: null },
    });
    vi.resetModules();
    vi.doMock("@/lib/supabase/service-role", () => ({
      createServiceRoleClient: vi.fn(() => db.client),
    }));
    const { POST } = await import("@/app/api/staff/leave/[token]/route");

    const res = await POST(
      jsonRequest("http://localhost/api/staff/leave/test-token", {
        leave_type: "annual",
        start_date: "2026-07-01",
        end_date: "2026-07-02",
        reason: "Family trip",
      }),
      { params: Promise.resolve({ token: "test-token" }) },
    );

    expect(res.status).toBe(201);
    expect(db.usedUpdate).toHaveBeenCalledWith(expect.objectContaining({ used_at: expect.any(String) }));
    expect(db.leaveInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: OWNER_USER.businessId,
        employee_id: "00000000-0000-0000-0000-000000000123",
        leave_type: "annual",
        status: "pending",
        requested_by: null,
      }),
    );
  });
});
