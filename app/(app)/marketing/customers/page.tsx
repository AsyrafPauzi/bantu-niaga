import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ListQuerySchema } from "@/lib/marketing/schemas";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CustomerFilters } from "@/components/marketing/CustomerFilters";
import { CustomerListTable } from "@/components/marketing/CustomerListTable";
import { CustomerListMobile } from "@/components/marketing/CustomerListMobile";
import { CustomerListAdaptive } from "./CustomerListAdaptive";
import type { CustomerListRow } from "@/components/marketing/types";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function flattenParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v.length > 0) out[k] = v[0];
  }
  return out;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "customers")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <h1 className="text-xl font-semibold text-ink dark:text-cream-100">
            Customers
          </h1>
          <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
            You don't have access to the Marketing CRM. Ask your owner /
            manager.
          </p>
        </CardBody>
      </Card>
    );
  }

  const raw = flattenParams(await searchParams);
  const parsed = ListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return (
      <Card>
        <CardBody className="py-6">
          <h1 className="text-xl font-semibold text-ink dark:text-cream-100">
            Customers
          </h1>
          <p className="mt-2 text-sm text-status-danger">
            Invalid filter values in the URL. Reset filters and try again.
          </p>
        </CardBody>
      </Card>
    );
  }
  const query = parsed.data;

  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("customers")
    .select(
      "id, name, phone_e164, email, manual_tags, auto_tags, source, " +
        "total_spend_myr, last_purchase_at, order_count, aov_myr",
      { count: "exact" },
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .is("merged_into_id", null);

  if (query.q) {
    const safe = query.q.replace(/[\\*,()]/g, "");
    q = q.or(`name.ilike.*${safe}*,phone_e164.ilike.*${safe}*`);
  }
  if (query.tags && query.tags.length > 0) {
    const tagList = `{${query.tags
      .map((t) => `"${t.replace(/"/g, '\\"')}"`)
      .join(",")}}`;
    q = q.or(`auto_tags.ov.${tagList},manual_tags.ov.${tagList}`);
  }
  if (query.source) q = q.eq("source", query.source);
  if (query.last_purchase_before)
    q = q.lt("last_purchase_at", query.last_purchase_before);
  if (query.last_purchase_after)
    q = q.gt("last_purchase_at", query.last_purchase_after);
  if (typeof query.min_spend === "number")
    q = q.gte("total_spend_myr", query.min_spend);
  if (typeof query.max_spend === "number")
    q = q.lte("total_spend_myr", query.max_spend);
  q = q
    .order(query.sort, { ascending: query.order === "asc", nullsFirst: false })
    .range(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize - 1,
    );

  const { data, count, error } = await q;
  if (error) {
    return (
      <Card>
        <CardBody className="py-6">
          <h1 className="text-xl font-semibold text-ink dark:text-cream-100">
            Customers
          </h1>
          <p className="mt-2 text-sm text-status-danger">
            Failed to load customers: {error.message}
          </p>
        </CardBody>
      </Card>
    );
  }

  const rows = (data ?? []) as unknown as CustomerListRow[];
  const total = count ?? 0;

  const baseParams = new URLSearchParams();
  if (query.q) baseParams.set("q", query.q);
  if (query.tags && query.tags.length > 0)
    baseParams.set("tags", query.tags.join(","));
  if (query.source) baseParams.set("source", query.source);
  if (query.last_purchase_before)
    baseParams.set("last_purchase_before", query.last_purchase_before);
  if (query.last_purchase_after)
    baseParams.set("last_purchase_after", query.last_purchase_after);
  if (typeof query.min_spend === "number")
    baseParams.set("min_spend", String(query.min_spend));
  if (typeof query.max_spend === "number")
    baseParams.set("max_spend", String(query.max_spend));
  baseParams.set("pageSize", String(query.pageSize));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
            Marketing
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink dark:text-cream-100">
            Customer Profiles CRM
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Card-index customer log with auto-computed purchase metrics
            and segmentation tags.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/marketing/customers/new">
            <Button size="sm">Add customer</Button>
          </Link>
          <Link href="/marketing/customers/import">
            <Button size="sm" variant="secondary">
              Import CSV
            </Button>
          </Link>
        </div>
      </header>

      <CustomerListAdaptive
        desktop={
          <div className="space-y-3">
            <CustomerFilters />
            <CustomerListTable
              customers={rows}
              page={query.page}
              pageSize={query.pageSize}
              total={total}
              sort={query.sort}
              order={query.order}
              baseSearchParams={baseParams}
            />
          </div>
        }
        mobile={
          <div className="space-y-3">
            <MobileSearchBar initial={query.q ?? ""} />
            <CustomerListMobile customers={rows} />
          </div>
        }
      />
    </div>
  );
}

function MobileSearchBar({ initial }: { initial: string }) {
  return (
    <form
      method="get"
      action="/marketing/customers"
      className="flex items-center gap-2"
    >
      <input
        type="search"
        name="q"
        defaultValue={initial}
        placeholder="Search by name or phone"
        className="flex-1 rounded-md border border-cream-300 bg-panel-light px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
      />
      <Button type="submit" size="sm">
        Search
      </Button>
      <Link href="/marketing/customers/new">
        <Button size="sm" variant="accent" type="button">
          +
        </Button>
      </Link>
    </form>
  );
}
