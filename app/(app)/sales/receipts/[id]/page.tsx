import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SalesBackLink } from "@/components/sales/SalesBackLink";
import { PosSaleVoidButton } from "@/components/sales/PosSaleVoidButton";
import { SalesReceiptPrintButton } from "@/components/sales/SalesReceiptPrintButton";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageSalesCore } from "@/lib/sales/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Receipt" };
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function money(n: number) {
  return `RM ${n.toFixed(2)}`;
}

function payLabel(method: string): string {
  if (method === "cash") return "Cash";
  if (method === "duitnow_qr_static") return "DuitNow QR";
  return method;
}

export default async function SalesReceiptPage({ params }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canManageSalesCore(user.role)) {
    redirect("/sales");
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [saleRes, itemsRes] = await Promise.all([
    supabase
      .from("pos_sales")
      .select(
        "id, sale_number, subtotal_myr, discount_amount_myr, sst_amount_myr, total_myr, payment_method, payment_received_myr, change_myr, customer_name, coupon_code, status, created_at",
      )
      .eq("id", id)
      .eq("business_id", user.businessId)
      .maybeSingle(),
    supabase
      .from("pos_sale_items")
      .select("product_name, quantity, unit_price_myr, line_total_myr")
      .eq("sale_id", id)
      .eq("business_id", user.businessId)
      .order("created_at", { ascending: true }),
  ]);

  if (!saleRes.data) notFound();

  const sale = saleRes.data;
  const canVoid = user.role === "owner" || user.role === "manager";
  const isVoided = sale.status === "voided";
  const items = itemsRes.data ?? [];

  return (
    <div className="mx-auto max-w-md space-y-4 pb-20 print:max-w-none print:pb-0 lg:pb-8">
      <div className="print:hidden">
        <SalesBackLink href="/sales/history" label="Sales history" />
      </div>

      <div className="rounded-2xl border border-cream-200 bg-white p-6 shadow-card print:border-0 print:p-0 print:shadow-none dark:border-hairline-dark dark:bg-panel-dark">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Receipt
          </p>
          <h1 className="mt-1 text-lg font-bold text-ink dark:text-cream-100">
            {sale.sale_number}
            {isVoided ? (
              <span className="ml-2 text-sm font-semibold text-red-600">
                VOIDED
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-ink-muted">
            {new Date(sale.created_at).toLocaleString("en-MY", {
              timeZone: "Asia/Kuala_Lumpur",
            })}
          </p>
        </div>

        <ul className="mt-4 space-y-2 border-y border-cream-200 py-3 text-sm dark:border-hairline-dark">
          {items.map((it, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {it.product_name} × {it.quantity}
              </span>
              <span className="tabular-nums">
                {money(Number(it.line_total_myr))}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {money(Number(sale.subtotal_myr))}
            </span>
          </div>
          {Number(sale.discount_amount_myr) > 0 ? (
            <div className="flex justify-between text-ink-muted">
              <span>Discount</span>
              <span className="tabular-nums">
                −{money(Number(sale.discount_amount_myr))}
              </span>
            </div>
          ) : null}
          {Number(sale.sst_amount_myr) > 0 ? (
            <div className="flex justify-between text-ink-muted">
              <span>SST</span>
              <span className="tabular-nums">
                {money(Number(sale.sst_amount_myr))}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">
              {money(Number(sale.total_myr))}
            </span>
          </div>
          {sale.coupon_code ? (
            <p className="text-xs text-ink-muted">Coupon: {sale.coupon_code}</p>
          ) : null}
          <p className="pt-2 text-xs text-ink-muted">
            Paid via {payLabel(sale.payment_method)}
            {sale.customer_name ? ` · ${sale.customer_name}` : " · Walk-in"}
          </p>
          {sale.payment_method === "cash" &&
          sale.payment_received_myr != null ? (
            <p className="text-xs text-ink-muted">
              Received {money(Number(sale.payment_received_myr))}
              {Number(sale.change_myr) > 0
                ? ` · Change ${money(Number(sale.change_myr))}`
                : ""}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2 print:hidden">
          <SalesReceiptPrintButton />
          <Link
            href="/sales/pos"
            className="w-full rounded-xl bg-[#2563EB] py-3 text-center text-sm font-semibold text-white hover:bg-[#1D4ED8]"
          >
            New sale
          </Link>
          {canVoid && !isVoided ? <PosSaleVoidButton saleId={sale.id} /> : null}
          <Link
            href="/sales/history"
            className="w-full rounded-xl border border-cream-300 py-3 text-center text-sm font-semibold text-ink-muted hover:border-blue-300 dark:border-hairline-dark"
          >
            Back to history
          </Link>
        </div>
      </div>
    </div>
  );
}
