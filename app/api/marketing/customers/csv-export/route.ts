import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/marketing/csv";

/**
 * GET /api/marketing/customers/csv-export — Marketing M3.
 *
 * Streams the current customer book as a single CSV file. Excludes
 * merged-away (merged_into_id IS NOT NULL) and soft-deleted
 * (deleted_at IS NOT NULL) rows by virtue of the M1 RLS SELECT policy
 * (`customers_select_self_business`) which already filters tombstones.
 * The `merged_into_id IS NULL` clause is added defensively in case
 * an admin tool ever bypasses RLS.
 *
 * Columns (plan §8.5 with M3 spec §C additions):
 *   name, phone, email, address, notes, manual_tags, auto_tags,
 *   total_spend_myr, last_purchase_at, order_count, created_at
 *
 *  - `phone` is the E.164 stored form.
 *  - tag arrays are pipe-joined.
 *  - dates are ISO 8601 UTC.
 *
 * Filename: `bantuniaga-customers-YYYY-MM-DD.csv`.
 *
 * Owner/Manager only. Cashier/Staff/Accountant/HR → 403.
 */

export const dynamic = "force-dynamic";

const EXPORT_COLUMNS = [
  "name",
  "phone",
  "email",
  "address",
  "notes",
  "manual_tags",
  "auto_tags",
  "total_spend_myr",
  "last_purchase_at",
  "order_count",
  "created_at",
] as const;

interface ExportRow {
  name: string;
  phone_e164: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  manual_tags: string[] | null;
  auto_tags: string[] | null;
  total_spend_myr: number | string | null;
  last_purchase_at: string | null;
  order_count: number | null;
  created_at: string;
}

function todayUtcDateStamp(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }
  if (!canSurface(user.role, "marketing", "customers")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.csv_import access denied" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || undefined;
  const tagsRaw = url.searchParams.get("tags")?.trim() || undefined;
  const source = url.searchParams.get("source")?.trim() || undefined;
  const minSpendRaw = url.searchParams.get("min_spend");
  const maxSpendRaw = url.searchParams.get("max_spend");
  const minSpend =
    minSpendRaw && !Number.isNaN(Number(minSpendRaw))
      ? Number(minSpendRaw)
      : undefined;
  const maxSpend =
    maxSpendRaw && !Number.isNaN(Number(maxSpendRaw))
      ? Number(maxSpendRaw)
      : undefined;
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;
  const idsRaw = url.searchParams.get("ids")?.trim() || undefined;
  const ids = idsRaw
    ? idsRaw
        .split(",")
        .map((id) => id.trim())
        .filter((id) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            id,
          ),
        )
    : undefined;

  const supabase = await createSupabaseServerClient();

  // PostgREST `range()` cap is 1000 by default for `?.from(…).select(…)`
  // — we keep paging until exhausted so a business with 5k customers
  // doesn't silently truncate. The 5k cap matches the import side.
  const pageSize = 1000;
  let from = 0;
  const all: ExportRow[] = [];
  // Hard cap on rows to prevent runaway exports; matches the import cap.
  const HARD_CAP = 50_000;

  while (true) {
    let query = supabase
      .from("customers")
      .select(
        "name, phone_e164, email, address, notes, manual_tags, auto_tags, " +
          "total_spend_myr, last_purchase_at, order_count, created_at",
      )
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .is("merged_into_id", null);

    if (q) {
      const safe = q.replace(/[\\*,()]/g, "");
      query = query.or(`name.ilike.*${safe}*,phone_e164.ilike.*${safe}*`);
    }
    if (tags && tags.length > 0) {
      const tagList = `{${tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(",")}}`;
      query = query.or(`auto_tags.ov.${tagList},manual_tags.ov.${tagList}`);
    }
    if (source) query = query.eq("source", source);
    if (typeof minSpend === "number") query = query.gte("total_spend_myr", minSpend);
    if (typeof maxSpend === "number") query = query.lte("total_spend_myr", maxSpend);
    if (ids && ids.length > 0) query = query.in("id", ids);

    const { data, error } = await query
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      return NextResponse.json(
        { error: "export_failed", message: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as unknown as ExportRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
    if (all.length >= HARD_CAP) break;
  }

  const renderable = all.map((r) => ({
    name: r.name ?? "",
    phone: r.phone_e164 ?? "",
    email: r.email ?? "",
    address: r.address ?? "",
    notes: r.notes ?? "",
    manual_tags: r.manual_tags ?? [],
    auto_tags: r.auto_tags ?? [],
    total_spend_myr:
      r.total_spend_myr === null || r.total_spend_myr === undefined
        ? ""
        : String(r.total_spend_myr),
    last_purchase_at: r.last_purchase_at ?? "",
    order_count: r.order_count ?? 0,
    created_at: r.created_at ?? "",
  }));

  const body = toCsv(renderable, EXPORT_COLUMNS as unknown as string[]);
  const filtered = Boolean(
    q || tags?.length || source || minSpend != null || maxSpend != null,
  );
  const filename =
    ids && ids.length > 0
      ? `bantuniaga-customers-selected-${todayUtcDateStamp()}.csv`
      : filtered
        ? `bantuniaga-customers-filtered-${todayUtcDateStamp()}.csv`
        : `bantuniaga-customers-${todayUtcDateStamp()}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Row-Count": String(renderable.length),
    },
  });
}
