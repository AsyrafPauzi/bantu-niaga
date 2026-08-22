import Link from "next/link";
import { Mail, MessageCircle, Users } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  ModuleDashboardHero,
  ModuleHeroStat,
} from "@/components/dashboard/module-layout";
import { BroadcastRecipientRow } from "@/components/marketing/BroadcastRecipientRow";
import { EmailBroadcastPreview } from "@/components/marketing/EmailBroadcastPreview";
import type { BroadcastRow } from "@/lib/marketing/broadcasts-shared";
import { broadcastDetailSubpageHero } from "@/lib/marketing/subpage-hero";
import { BroadcastDetailActions } from "@/app/(app)/marketing/broadcasts/[id]/detail-actions";

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

interface BroadcastDetailViewProps {
  broadcast: BroadcastRow & {
    customer_segments: { id: string; name: string } | null;
  };
  recipients: RecipientDetail[];
  businessName?: string;
  fromEmailLabel?: string;
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

export function BroadcastDetailView({
  broadcast,
  recipients,
  businessName,
  fromEmailLabel,
}: BroadcastDetailViewProps) {
  const segName = broadcast.customer_segments?.name ?? "Segment";
  const isDraft = broadcast.status === "draft";
  const isEmail = broadcast.channel === "email";
  const hero = broadcastDetailSubpageHero({
    name: broadcast.name,
    channel: broadcast.channel,
    status: broadcast.status,
    totalRecipients: broadcast.total_recipients ?? 0,
    sentCount: broadcast.sent_count ?? 0,
    failedCount: broadcast.failed_count ?? 0,
    segmentName: segName,
  });

  return (
    <div className="space-y-4 pb-8">
      <ModuleDashboardHero
        module="Marketing · Broadcasts"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant={hero.variant}
        headerExtra={
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusPill tone={statusToneOf(broadcast.status)}>
              {broadcast.status.replace("_", " ")}
            </StatusPill>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                isEmail
                  ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              }`}
            >
              {isEmail ? (
                <Mail className="h-3 w-3" strokeWidth={2} />
              ) : (
                <MessageCircle className="h-3 w-3 text-[#25D366]" />
              )}
              {isEmail ? "Email" : "WhatsApp"}
            </span>
            {broadcast.customer_segments ? (
              <Link
                href={`/marketing/segments/${broadcast.customer_segments.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-cream-200/80 px-2.5 py-1 text-[11px] font-semibold text-ink-muted transition-colors hover:text-brand-700 dark:bg-hairline-dark dark:text-cream-400 dark:hover:text-brand-200"
              >
                <Users className="h-3 w-3" strokeWidth={2} />
                {segName}
              </Link>
            ) : null}
          </div>
        }
        cta={
          isDraft ? (
            <BroadcastDetailActions
              broadcastId={broadcast.id}
              channel={broadcast.channel}
            />
          ) : null
        }
      >
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Recipients"
            value={broadcast.total_recipients ?? 0}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Sent"
            value={broadcast.sent_count ?? 0}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Failed"
            value={broadcast.failed_count ?? 0}
            iconClassName="text-rose-700 dark:text-rose-300"
          />
          <ModuleHeroStat
            label="Channel"
            value={isEmail ? "Email" : "WA"}
            hint={isEmail ? "auto-send" : "tap to open"}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
        </div>
      </ModuleDashboardHero>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          {/* Message template — compact, scroll if long */}
          <section className="rounded-xl border border-cream-200 bg-panel-light p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark sm:p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              Message
            </h2>
            {isEmail && broadcast.subject ? (
              <p className="mt-2 text-sm font-semibold text-ink dark:text-cream-100">
                {broadcast.subject}
              </p>
            ) : null}
            <div className="mt-2 max-h-36 overflow-y-auto overscroll-contain rounded-lg border border-cream-100 bg-cream-50/60 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink dark:text-cream-100">
                {broadcast.message_template}
              </p>
            </div>
          </section>

          {/* Recipients — scrollable list, no repeated message column */}
          <section className="overflow-hidden rounded-xl border border-cream-200 bg-panel-light shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center justify-between gap-2 border-b border-cream-200 px-4 py-3 dark:border-hairline-dark sm:px-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                Recipients
              </h2>
              <span className="text-[11px] tabular-nums text-ink-subtle dark:text-cream-500">
                {recipients.length}
              </span>
            </div>

            {recipients.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-muted dark:text-cream-400 sm:px-5">
                {isDraft ? (
                  <span className="inline-flex items-center gap-2">
                    {isEmail ? (
                      <Mail className="h-4 w-4 text-brand-700" />
                    ) : (
                      <MessageCircle className="h-4 w-4 text-[#25D366]" />
                    )}
                    Draft — recipients appear when you send.
                  </span>
                ) : (
                  "No recipients (segment was empty at send time)."
                )}
              </p>
            ) : (
              <ul className="max-h-[28rem] divide-y divide-cream-100 overflow-y-auto overscroll-contain dark:divide-hairline-dark">
                {recipients.map((r) => (
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
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          {isEmail ? (
            <EmailBroadcastPreview
              fromLabel={fromEmailLabel ?? "hello@yourdomain.com"}
              toName="Sample customer"
              toEmail="customer@example.com"
              subject={broadcast.subject ?? ""}
              bodyText={broadcast.message_template}
              businessName={businessName}
            />
          ) : (
            <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 shadow-card dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-panel-dark dark:to-teal-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                WhatsApp click-to-chat
              </p>
              <p className="mt-2 text-sm text-ink dark:text-cream-100">
                Tap Open WhatsApp on each row. Messages are prefilled — you send
                them yourself.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 shadow-card dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-fuchsia-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Personalisation
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-ink dark:text-cream-100">
              <li>
                <code className="rounded bg-violet-100 px-1 text-xs dark:bg-violet-900/50">
                  {"{{name}}"}
                </code>{" "}
                → first name
              </li>
              <li>
                <code className="rounded bg-violet-100 px-1 text-xs dark:bg-violet-900/50">
                  {"{{coupon}}"}
                </code>{" "}
                → coupon code
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
