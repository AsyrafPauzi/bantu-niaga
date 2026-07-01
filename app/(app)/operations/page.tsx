import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Plus,
  Truck,
  Users,
} from "lucide-react";
import { BulletRow } from "@/components/dashboard/bullet-row";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { computeOperationsSummary } from "@/lib/operations/helpers";
import {
  formatOrderAmount,
  orderStatusLabel,
  type OperationsOrderStatus,
} from "@/lib/operations/schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const metadata = { title: "Operations" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<
  OperationsOrderStatus,
  "neutral" | "warning" | "success"
> = {
  todo: "neutral",
  in_progress: "warning",
  done: "success",
};

export default async function OperationsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "operations")) {
    redirect("/home");
  }

  const admin = createServiceRoleClient();
  const summary = await computeOperationsSummary(admin, user.businessId);

  const { data: recentOrders } = await admin
    .from("operations_orders")
    .select("id, number, customer_name, title, status, due_date, amount_myr")
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  const pipelineTotal =
    summary.todo_count + summary.in_progress_count + summary.done_this_month ||
    1;

  const pipeline = [
    {
      label: "To do",
      sublabel: "New orders waiting",
      value: String(summary.todo_count),
      fill: Math.round((summary.todo_count / pipelineTotal) * 100),
      tone: "muted" as const,
    },
    {
      label: "In progress",
      sublabel: "Being worked on",
      value: String(summary.in_progress_count),
      fill: Math.round((summary.in_progress_count / pipelineTotal) * 100),
      tone: "warning" as const,
    },
    {
      label: "Done this month",
      sublabel: "Completed jobs",
      value: String(summary.done_this_month),
      fill: Math.round((summary.done_this_month / pipelineTotal) * 100),
      tone: "success" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Overview"
        description="Track customer orders without the WhatsApp chaos — see what's waiting, in progress, and done."
        action={
          <Link
            href="/operations/orders"
            className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New order
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiTile
          label="Open orders"
          value={String(summary.open_orders)}
          delta={
            summary.overdue_count > 0
              ? `${summary.overdue_count} overdue`
              : "On track"
          }
          deltaTone={summary.overdue_count > 0 ? "danger" : "success"}
          helper="To do + in progress"
          icon={Package}
        />
        <KpiTile
          label="In progress"
          value={String(summary.in_progress_count)}
          delta={`${summary.todo_count} waiting`}
          deltaTone="brand"
          helper="active jobs"
          icon={Truck}
        />
        <KpiTile
          label="Done this month"
          value={String(summary.done_this_month)}
          delta="Completed"
          deltaTone="success"
          helper="jobs finished"
          icon={CheckCircle2}
        />
        <KpiTile
          label="Suppliers"
          value={String(summary.supplier_count)}
          delta="Vendors saved"
          deltaTone="neutral"
          helper="contact list"
          icon={Users}
        />
      </section>

      {summary.overdue_count > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning/5 px-4 py-3 text-sm dark:border-status-warning/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          <p className="text-ink dark:text-cream-100">
            <span className="font-semibold">{summary.overdue_count}</span>{" "}
            open order{summary.overdue_count === 1 ? "" : "s"} past due date.
            Check the{" "}
            <Link
              href="/operations/orders"
              className="font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              order board
            </Link>
            .
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard
          title="Order pipeline"
          subtitle={`${summary.open_orders} open · ${summary.done_this_month} done this month`}
          className="lg:col-span-2"
          bodyClassName="space-y-4"
          action={
            <Link
              href="/operations/orders"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              View board
            </Link>
          }
        >
          {pipeline.map((row) => (
            <BulletRow key={row.label} {...row} />
          ))}
        </SectionCard>

        <SectionCard
          title="Recent orders"
          subtitle="Latest updates"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={
            <Link
              href="/operations/orders"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              All
            </Link>
          }
        >
          {(recentOrders ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted dark:text-cream-400">
              No orders yet.{" "}
              <Link
                href="/operations/orders"
                className="font-medium text-brand-600 dark:text-brand-300"
              >
                Add your first
              </Link>
              .
            </p>
          ) : (
            (recentOrders ?? []).map(
              (row: {
                id: string;
                number: string;
                customer_name: string;
                title: string;
                status: OperationsOrderStatus;
                due_date: string | null;
                amount_myr: number | null;
              }) => {
                const amount = formatOrderAmount(
                  row.amount_myr != null ? Number(row.amount_myr) : null,
                );
                return (
                  <div
                    key={row.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                        {row.number} — {row.customer_name}
                      </p>
                      <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                        {row.title}
                        {row.due_date ? ` · due ${row.due_date}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusPill tone={STATUS_TONE[row.status]}>
                        {orderStatusLabel(row.status)}
                      </StatusPill>
                      {amount ? (
                        <span className="text-xs font-medium text-ink dark:text-cream-100">
                          {amount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              },
            )
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Quick links"
        subtitle="Operations shortcuts"
        bodyClassName="grid gap-2 sm:grid-cols-2"
      >
        {[
          {
            href: "/operations/orders",
            icon: Package,
            label: "Order board",
            helper: "To do → In progress → Done",
          },
          {
            href: "/operations/suppliers",
            icon: Users,
            label: "Supplier list",
            helper: "Vendor contacts & terms",
          },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-start gap-3 rounded-lg border border-cream-200 p-3 transition-colors hover:border-brand-200 hover:bg-brand-50/40 dark:border-hairline-dark dark:hover:border-brand-700 dark:hover:bg-brand-900/20"
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
