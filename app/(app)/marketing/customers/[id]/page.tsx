import { notFound, redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { CustomerDetailDesktopView } from "@/components/marketing/CustomerDetailDesktopView";
import type { CustomerActivityTab } from "@/components/marketing/CustomerDetailDesktopView";
import { CustomerDetailMobileView } from "@/components/marketing/CustomerDetailMobileView";
import { MarketingCustomersBackLink } from "@/components/marketing/MarketingCustomersBackLink";
import type { CustomerFullRow } from "@/components/marketing/types";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCustomerMayaInsight } from "@/lib/marketing/subpage-hero";
import { loadCustomerCouponRedemptions } from "@/lib/marketing/coupon-redemptions-load";
import { CustomerDetailAdaptive } from "../CustomerDetailAdaptive";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface CustomerRow {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  address: string | null;
  manual_tags: string[];
  auto_tags: string[];
  notes: string | null;
  source: string | null;
  total_spend_myr: number;
  last_purchase_at: string | null;
  order_count: number;
  aov_myr: number | null;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  id: string;
  name: string;
  payload: Record<string, unknown>;
  emitted_at: string;
}

interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number | string;
  line_total_myr: number | string;
  sort_order: number;
}

interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  total_myr: number | string;
  invoice_date: string | null;
  created_at: string;
  title: string | null;
  items: InvoiceItemRow[];
}

interface PosSaleItemRow {
  id: string;
  sale_id: string;
  product_name: string;
  quantity: number | string;
  line_total_myr: number | string;
  sort_order: number;
}

interface PosSaleRow {
  id: string;
  sale_number: string;
  total_myr: number | string;
  payment_method: string;
  created_at: string;
  items: PosSaleItemRow[];
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { title: "Customer" };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select("name")
    .eq("business_id", user.businessId)
    .eq("id", id)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .maybeSingle();
  return { title: data?.name ?? "Customer" };
}

export default async function CustomerProfilePage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const activeTab: CustomerActivityTab =
    tabParam === "orders" ? "orders" : "activity";

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
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to the Marketing CRM.
          </p>
        </CardBody>
      </Card>
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select(
      "id, name, phone_e164, email, address, manual_tags, auto_tags, " +
        "notes, source, total_spend_myr, last_purchase_at, order_count, " +
        "aov_myr, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .eq("id", id)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .maybeSingle();

  if (error) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-status-danger">
            Failed to load customer: {error.message}
          </p>
        </CardBody>
      </Card>
    );
  }
  if (!customer) notFound();

  const c = customer as unknown as CustomerRow;
  const totalSpend =
    typeof c.total_spend_myr === "number"
      ? c.total_spend_myr
      : Number(c.total_spend_myr) || 0;
  const aov =
    c.aov_myr ?? (c.order_count > 0 ? totalSpend / c.order_count : 0);

  const [{ data: eventsRaw }, { data: invoicesRaw }, { data: posSalesRaw }] =
    await Promise.all([
      supabase
        .from("events_outbox")
        .select("id, name, payload, emitted_at")
        .eq("business_id", user.businessId)
        .in("name", [
          "customer.created",
          "customer.updated",
          "customer.merged",
          "customer.tag_changed",
        ])
        .ilike("payload->>customer_id", id)
        .order("emitted_at", { ascending: false })
        .limit(8),
      supabase
        .from("finance_invoices")
        .select(
          "id, number, status, total_myr, invoice_date, created_at, title",
        )
        .eq("business_id", user.businessId)
        .eq("customer_id", id)
        .is("deleted_at", null)
        .neq("status", "void")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("pos_sales")
        .select("id, sale_number, total_myr, payment_method, created_at")
        .eq("business_id", user.businessId)
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  const events = (eventsRaw ?? []) as unknown as EventRow[];
  const invoicesBase = (invoicesRaw ?? []) as Array<Omit<InvoiceRow, "items">>;
  const posSalesBase = (posSalesRaw ?? []) as Array<
    Omit<PosSaleRow, "items">
  >;

  let invoices: InvoiceRow[] = [];
  if (invoicesBase.length > 0) {
    const invoiceIds = invoicesBase.map((inv) => inv.id);
    const { data: invoiceItemsRaw } = await supabase
      .from("finance_invoice_items")
      .select(
        "id, invoice_id, description, quantity, line_total_myr, sort_order",
      )
      .eq("business_id", user.businessId)
      .in("invoice_id", invoiceIds)
      .order("sort_order", { ascending: true });

    const itemsByInvoice = new Map<string, InvoiceItemRow[]>();
    for (const item of (invoiceItemsRaw ?? []) as unknown as InvoiceItemRow[]) {
      const list = itemsByInvoice.get(item.invoice_id) ?? [];
      list.push(item);
      itemsByInvoice.set(item.invoice_id, list);
    }

    invoices = invoicesBase.map((invoice) => ({
      ...invoice,
      items: itemsByInvoice.get(invoice.id) ?? [],
    }));
  }

  let posSales: PosSaleRow[] = [];
  if (posSalesBase.length > 0) {
    const saleIds = posSalesBase.map((s) => s.id);
    const { data: posItemsRaw } = await supabase
      .from("pos_sale_items")
      .select("id, sale_id, product_name, quantity, line_total_myr, sort_order")
      .eq("business_id", user.businessId)
      .in("sale_id", saleIds)
      .order("sort_order", { ascending: true });

    const itemsBySale = new Map<string, PosSaleItemRow[]>();
    for (const item of (posItemsRaw ?? []) as unknown as PosSaleItemRow[]) {
      const list = itemsBySale.get(item.sale_id) ?? [];
      list.push(item);
      itemsBySale.set(item.sale_id, list);
    }

    posSales = posSalesBase.map((sale) => ({
      ...sale,
      items: itemsBySale.get(sale.id) ?? [],
    }));
  }

  const mayaInsight = buildCustomerMayaInsight({
    name: c.name,
    autoTags: c.auto_tags,
    totalSpendMyr: totalSpend,
    orderCount: c.order_count,
  });

  const [couponRedemptions, businessRow] = await Promise.all([
    loadCustomerCouponRedemptions(supabase, user.businessId, c.id),
    supabase
      .from("businesses")
      .select("name")
      .eq("id", user.businessId)
      .maybeSingle(),
  ]);

  const customerFullRow: CustomerFullRow = {
    id: c.id,
    name: c.name,
    phone_e164: c.phone_e164,
    email: c.email,
    address: c.address,
    manual_tags: c.manual_tags,
    auto_tags: c.auto_tags,
    notes: c.notes,
    source: c.source ?? "manual",
    total_spend_myr: totalSpend,
    last_purchase_at: c.last_purchase_at,
    order_count: c.order_count,
    aov_myr: aov,
    created_at: c.created_at,
    updated_at: c.updated_at,
    created_by_user_id: null,
    merged_into_id: null,
    deleted_at: null,
  };

  return (
    <div className="space-y-4 pb-8">
      <MarketingCustomersBackLink />

      <CustomerDetailAdaptive
        mobile={
          <CustomerDetailMobileView
            customer={customerFullRow}
            mayaInsight={mayaInsight}
            businessName={businessRow.data?.name ?? undefined}
            couponRedemptions={couponRedemptions}
          />
        }
        desktop={
          <CustomerDetailDesktopView
            customer={customerFullRow}
            activeTab={activeTab}
            events={events}
            invoices={invoices}
            posSales={posSales}
            mayaInsight={mayaInsight}
            businessName={businessRow.data?.name ?? undefined}
            couponRedemptions={couponRedemptions}
          />
        }
      />
    </div>
  );
}
