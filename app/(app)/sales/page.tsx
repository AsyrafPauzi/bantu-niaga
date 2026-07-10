import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Banknote,
  CreditCard,
  Plus,
  ShoppingCart,
  Smartphone,
  Users,
} from "lucide-react";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TxRow } from "@/components/dashboard/tx-row";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { formatMyr } from "@/lib/marketing/metrics";
import { canUsePos } from "@/lib/sales/access";
import { malaysiaTodayYmd } from "@/lib/sales/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

type SaleRow = {
  id: string;
  sale_number: string;
  total_myr: number | string;
  payment_method: string;
  customer_name: string | null;
  created_at: string;
  status: string;
};

function payLabel(method: string) {
  if (method === "cash") return "Cash";
  if (method === "duitnow_qr_static") return "DuitNow QR";
  return method;
}

function payIcon(method: string) {
  if (method === "cash") return Banknote;
  if (method === "duitnow_qr_static") return Smartphone;
  return CreditCard;
}

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

export default async function SalesPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const today = malaysiaTodayYmd();
  const dayStart = `${today}T00:00:00.000+08:00`;
  const endDate = new Date(`${today}T00:00:00.000+08:00`);
  endDate.setDate(endDate.getDate() + 1);
  const dayEnd = endDate.toISOString();

  const [recentRes, todayRes] = await Promise.all([
    supabase
      .from("pos_sales")
      .select(
        "id, sale_number, total_myr, payment_method, customer_name, created_at, status",
      )
      .eq("business_id", user.businessId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("pos_sales")
      .select("id, total_myr, payment_method")
      .eq("business_id", user.businessId)
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),
  ]);

  const recent = (recentRes.data ?? []) as SaleRow[];
  const todayRows = todayRes.data ?? [];
  const salesToday = todayRows.reduce(
    (a, r) => a + Number(r.total_myr ?? 0),
    0,
  );
  const txnToday = todayRows.length;
  const avgTicket = txnToday > 0 ? salesToday / txnToday : 0;
  const cashToday = todayRows
    .filter((r) => r.payment_method === "cash")
    .reduce((a, r) => a + Number(r.total_myr ?? 0), 0);
  const duitnowToday = todayRows
    .filter((r) => r.payment_method === "duitnow_qr_static")
    .reduce((a, r) => a + Number(r.total_myr ?? 0), 0);
  const cashPct =
    salesToday > 0 ? Math.round((cashToday / salesToday) * 100) : 0;
  const duitnowPct =
    salesToday > 0 ? Math.round((duitnowToday / salesToday) * 100) : 0;

  const showPos = canUsePos(user.role);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales"
        title="Overview"
        description="Today’s counter totals, recent receipts, and payment mix."
        action={
          showPos ? (
            <Link
              href="/sales/pos"
              className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              New sale
            </Link>
          ) : null
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiTile
          label="Sales today"
          value={formatMyr(salesToday)}
          helper={today}
          icon={ShoppingCart}
        />
        <KpiTile
          label="Transactions today"
          value={String(txnToday)}
          helper={
            txnToday > 0 ? `avg ticket ${formatMyr(avgTicket)}` : "No sales yet"
          }
          icon={CreditCard}
        />
        <KpiTile
          label="Cash today"
          value={formatMyr(cashToday)}
          helper={salesToday > 0 ? `${cashPct}% of today` : "—"}
          icon={Banknote}
        />
        <KpiTile
          label="DuitNow today"
          value={formatMyr(duitnowToday)}
          helper={salesToday > 0 ? `${duitnowPct}% of today` : "—"}
          icon={Smartphone}
        />
      </section>

      <AiBanner
        label="Sales"
        message="Ring up from your Operations catalog. Cash and static DuitNow are included — set your QR in Branding if you have not yet."
        cta="Open POS"
        href="/sales/pos"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard
          title="Recent sales"
          subtitle="Latest completed receipts"
          className="lg:col-span-2"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={
            showPos ? (
              <Link
                href="/sales/pos"
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
              >
                Open POS
              </Link>
            ) : null
          }
        >
          {recent.length === 0 ? (
            <p className="px-1 py-6 text-sm text-ink-muted">
              No sales yet.{" "}
              {showPos ? (
                <Link
                  href="/sales/pos"
                  className="font-semibold text-brand-700"
                >
                  Start your first sale
                </Link>
              ) : (
                "Ask a cashier or manager to open POS."
              )}
            </p>
          ) : (
            recent.map((row) => (
              <TxRow
                key={row.id}
                icon={payIcon(row.payment_method)}
                tone={
                  row.payment_method === "cash" ? "success" : "brand"
                }
                title={`${row.sale_number} — ${row.customer_name?.trim() || "Walk-in"}`}
                subtitle={`${payLabel(row.payment_method)} · ${relativeTime(row.created_at)}`}
                amount={`+${formatMyr(Number(row.total_myr))}`}
              />
            ))
          )}
        </SectionCard>

        <SectionCard
          title="Payment mix (today)"
          subtitle="Cash vs static DuitNow"
          bodyClassName="space-y-3"
          action={
            <StatusPill tone="brand">{`${txnToday} txns`}</StatusPill>
          }
        >
          {txnToday === 0 ? (
            <p className="text-sm text-ink-muted">No payments recorded today.</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">Cash</span>
                <span className="font-semibold text-ink dark:text-cream-100">
                  {formatMyr(cashToday)} · {cashPct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark">
                <div
                  className="h-full rounded-full bg-status-success"
                  style={{ width: `${cashPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">DuitNow QR</span>
                <span className="font-semibold text-ink dark:text-cream-100">
                  {formatMyr(duitnowToday)} · {duitnowPct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${duitnowPct}%` }}
                />
              </div>
            </>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Quick actions"
        subtitle="Counter shortcuts"
        bodyClassName="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {[
          {
            href: "/sales/pos",
            icon: ShoppingCart,
            label: "Open POS",
            helper: "Start a new sale",
            show: showPos,
          },
          {
            href: "/settings/branding",
            icon: Smartphone,
            label: "DuitNow QR",
            helper: "Upload merchant QR",
            show: true,
          },
          {
            href: "/sales/leads",
            icon: Users,
            label: "Leads",
            helper: "Prospect pipeline",
            show: true,
          },
        ]
          .filter((a) => a.show)
          .map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-start gap-3 rounded-lg border border-cream-200 p-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/40 dark:border-hairline-dark dark:hover:border-brand-700 dark:hover:bg-brand-900/20"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <action.icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink dark:text-cream-100">
                  {action.label}
                </span>
                <span className="block text-xs text-ink-muted dark:text-cream-400">
                  {action.helper}
                </span>
              </span>
            </Link>
          ))}
      </SectionCard>
    </div>
  );
}
