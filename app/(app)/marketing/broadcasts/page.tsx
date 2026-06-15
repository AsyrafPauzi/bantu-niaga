import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, Plus, Send } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BroadcastRow } from "@/lib/marketing/broadcasts";

export const metadata = { title: "Broadcasts" };
export const dynamic = "force-dynamic";

interface ListRow extends BroadcastRow {
  customer_segments: { id: string; name: string } | null;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function statusToneOf(status: BroadcastRow["status"]) {
  switch (status) {
    case "draft":
      return "neutral" as const;
    case "sending":
      return "warning" as const;
    case "sent":
      return "success" as const;
    case "partially_sent":
      return "accent" as const;
    case "failed":
      return "danger" as const;
  }
}

export default async function MarketingBroadcastsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "broadcasts")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to Marketing broadcasts.
          </p>
        </CardBody>
      </Card>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: dataRaw, error } = await supabase
    .from("broadcasts")
    .select(
      "id, business_id, name, channel, segment_id, subject, message_template, " +
        "coupon_id, status, total_recipients, sent_count, failed_count, " +
        "scheduled_at, sent_at, created_by, created_at, updated_at, " +
        "customer_segments:segment_id (id, name)",
    )
    .eq("business_id", user.businessId)
    .order("created_at", { ascending: false });

  const rows = (dataRaw ?? []) as unknown as ListRow[];

  return (
    <div className="space-y-6">
      <Link
        href="/marketing"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        Back to Marketing
      </Link>

      <PageHeader
        eyebrow="Marketing"
        title="Broadcasts"
        description="WhatsApp click-to-chat and email blasts to any customer segment. Compose, preview, send."
        action={
          <Link
            href="/marketing/broadcasts/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            New broadcast
          </Link>
        }
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load broadcasts: {error.message}
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
            <tr>
              <th className="px-5 py-3 text-left">Broadcast</th>
              <th className="px-3 py-3 text-left">Channel</th>
              <th className="px-3 py-3 text-left">Segment</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-right">Sent / Total</th>
              <th className="px-5 py-3 text-right">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-sm text-ink-muted dark:text-cream-400"
                >
                  <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200">
                    <Send className="h-6 w-6" strokeWidth={2} />
                  </span>
                  <p className="text-base font-semibold text-ink dark:text-cream-100">
                    No broadcasts yet
                  </p>
                  <p className="mx-auto mt-1 max-w-md">
                    Build your first WhatsApp or email blast against any saved
                    segment.
                  </p>
                  <Link
                    href="/marketing/broadcasts/new"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.25} />
                    New broadcast
                  </Link>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="bg-panel-light hover:bg-cream-100/60 dark:bg-panel-dark dark:hover:bg-hairline-dark/40"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/marketing/broadcasts/${row.id}`}
                      className="font-semibold text-ink hover:text-brand-700 dark:text-cream-100"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted dark:text-cream-400">
                      {row.channel === "whatsapp_ctc" ? (
                        <MessageCircle
                          className="h-4 w-4 text-[#25D366]"
                          strokeWidth={2}
                        />
                      ) : (
                        <Mail
                          className="h-4 w-4 text-brand-700 dark:text-brand-200"
                          strokeWidth={2}
                        />
                      )}
                      {row.channel === "whatsapp_ctc"
                        ? "WhatsApp"
                        : "Email"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-muted dark:text-cream-400">
                    {row.customer_segments?.name ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill tone={statusToneOf(row.status)}>
                      {row.status.replace("_", " ")}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-ink dark:text-cream-100">
                    {row.sent_count}
                    {" / "}
                    {row.total_recipients}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-ink-muted dark:text-cream-400">
                    {relativeTime(row.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
