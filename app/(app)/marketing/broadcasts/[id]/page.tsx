import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
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
import { BroadcastRecipientRow } from "@/components/marketing/BroadcastRecipientRow";
import { BroadcastDetailActions } from "./detail-actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface RecipientDetail {
  id: string;
  broadcast_id: string;
  customer_id: string;
  channel_address: string;
  rendered_message: string;
  rendered_subject: string | null;
  status: "queued" | "sent" | "failed" | "opened";
  error: string | null;
  sent_at: string | null;
  customers: { id: string; name: string } | null;
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

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Broadcast ${id.slice(0, 8)}` };
}

export default async function BroadcastDetailPage({ params }: PageProps) {
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

  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: broadcastRaw, error } = await supabase
    .from("broadcasts")
    .select(
      "id, business_id, name, channel, segment_id, subject, message_template, " +
        "coupon_id, status, total_recipients, sent_count, failed_count, " +
        "scheduled_at, sent_at, created_by, created_at, updated_at, " +
        "customer_segments:segment_id (id, name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return (
      <Card>
        <CardBody className="text-sm text-status-danger">
          Failed to load broadcast: {error.message}
        </CardBody>
      </Card>
    );
  }
  if (!broadcastRaw) notFound();
  const broadcast = broadcastRaw as unknown as BroadcastRow & {
    customer_segments: { id: string; name: string } | null;
  };

  const segName = broadcast.customer_segments?.name ?? "(segment)";

  const { data: rcptRaw } = await supabase
    .from("broadcast_recipients")
    .select(
      "id, broadcast_id, customer_id, channel_address, rendered_message, " +
        "rendered_subject, status, error, sent_at, customers:customer_id (id, name)",
    )
    .eq("broadcast_id", id)
    .order("status", { ascending: true })
    .order("sent_at", { ascending: false, nullsFirst: true })
    .limit(500);
  const recipients = (rcptRaw ?? []) as unknown as RecipientDetail[];

  const isDraft = broadcast.status === "draft";

  return (
    <div className="space-y-6">
      <Link
        href="/marketing/broadcasts"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        Back to Broadcasts
      </Link>

      <PageHeader
        eyebrow="Marketing · Broadcasts"
        title={broadcast.name}
        description={
          broadcast.channel === "whatsapp_ctc"
            ? "WhatsApp click-to-chat — tap each link below to open WhatsApp prefilled."
            : "Email broadcast via Resend."
        }
        action={
          isDraft ? (
            <BroadcastDetailActions
              broadcastId={broadcast.id}
              channel={broadcast.channel}
            />
          ) : (
            <StatusPill tone={statusToneOf(broadcast.status)}>
              {broadcast.status.replace("_", " ")}
            </StatusPill>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Status" value={broadcast.status.replace("_", " ")} />
        <Stat label="Channel" value={broadcast.channel === "whatsapp_ctc" ? "WhatsApp" : "Email"} />
        <Stat label="Recipients" value={String(broadcast.total_recipients)} />
        <Stat
          label="Sent / Failed"
          value={`${broadcast.sent_count} / ${broadcast.failed_count}`}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-cream-200 px-5 py-3 dark:border-hairline-dark">
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
            Segment ·{" "}
            <span className="font-mono text-xs text-ink-muted dark:text-cream-400">
              {segName}
            </span>
          </h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted dark:text-cream-400">
            {broadcast.channel === "email" && broadcast.subject ? (
              <span className="block font-semibold text-ink dark:text-cream-100">
                Subject: {broadcast.subject}
              </span>
            ) : null}
            {broadcast.message_template}
          </p>
        </div>

        <table className="min-w-full text-sm">
          <thead className="bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
            <tr>
              <th className="px-5 py-3 text-left">Customer</th>
              <th className="px-3 py-3 text-left">Message</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-right">
                {broadcast.channel === "whatsapp_ctc" ? "Actions" : "Sent at"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {recipients.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-12 text-center text-sm text-ink-muted dark:text-cream-400"
                >
                  {isDraft ? (
                    <>
                      <p className="mb-2 inline-flex items-center gap-2">
                        {broadcast.channel === "whatsapp_ctc" ? (
                          <MessageCircle className="h-4 w-4 text-[#25D366]" />
                        ) : (
                          <Mail className="h-4 w-4 text-brand-700" />
                        )}
                        Draft — recipients are resolved when you send.
                      </p>
                    </>
                  ) : (
                    "No recipients (segment was empty at send time)."
                  )}
                </td>
              </tr>
            ) : (
              recipients.map((r) => (
                <BroadcastRecipientRow
                  key={r.id}
                  broadcastId={broadcast.id}
                  channel={broadcast.channel}
                  recipient={{
                    id: r.id,
                    customer_id: r.customer_id,
                    channel_address: r.channel_address,
                    rendered_message: r.rendered_message,
                    rendered_subject: r.rendered_subject,
                    status: r.status,
                    error: r.error,
                    sent_at: r.sent_at,
                    customer_name: r.customers?.name ?? r.customer_id,
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-cream-200 bg-panel-light p-3 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-ink dark:text-cream-100">
        {value}
      </p>
    </div>
  );
}
