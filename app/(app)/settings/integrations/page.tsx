import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  Copy,
  Eye,
  EyeOff,
  Facebook,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  Video,
  Webhook,
  AlertCircle,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadSocialAccounts } from "@/lib/social/load";
import { isMetaConfigured, missingMetaEnvVars } from "@/lib/social/meta";
import { CallbackToast } from "@/components/settings/integrations/CallbackToast";
import { DisconnectSocialButton } from "@/components/settings/integrations/DisconnectSocialButton";
import type { SocialAccount } from "@/lib/social/types";
import { Suspense } from "react";

export const metadata = { title: "API keys & integrations" };
export const dynamic = "force-dynamic";

interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  scope: "read" | "read+write" | "admin";
  lastUsed: string;
  createdAt: string;
}

interface ChannelIntegration {
  id: string;
  name: string;
  description: string;
  icon: typeof Camera;
  tone: "brand" | "accent" | "info";
  provider?: "facebook" | "instagram";
  comingSoon?: boolean;
}

interface OutgoingWebhook {
  id: string;
  url: string;
  events: string[];
  delivered: number;
  failed: number;
  active: boolean;
}

const API_KEYS: readonly ApiKey[] = [
  {
    id: "k1",
    label: "POS terminal — Shah Alam",
    prefix: "bn_live_a7f3",
    scope: "read+write",
    lastUsed: "2 minutes ago",
    createdAt: "12 Jun 2026",
  },
  {
    id: "k2",
    label: "Mobile delivery app",
    prefix: "bn_live_c19d",
    scope: "read",
    lastUsed: "Yesterday",
    createdAt: "08 Jun 2026",
  },
  {
    id: "k3",
    label: "Backup script (read-only)",
    prefix: "bn_live_4521",
    scope: "read",
    lastUsed: "5 days ago",
    createdAt: "01 Jun 2026",
  },
];

const CHANNELS: readonly ChannelIntegration[] = [
  {
    id: "facebook",
    name: "Facebook Page",
    description:
      "Cross-post and pull reach from your Facebook Pages. Free — no API fees.",
    icon: Facebook,
    tone: "brand",
    provider: "facebook",
  },
  {
    id: "instagram",
    name: "Instagram Business",
    description:
      "Publish photos & captions, pull engagement metrics into Content Detail.",
    icon: Camera,
    tone: "accent",
    provider: "instagram",
  },
  {
    id: "tiktok",
    name: "TikTok for Business",
    description: "Sync post performance and run TikTok Ads from Marketing.",
    icon: Video,
    tone: "accent",
    comingSoon: true,
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business Cloud",
    description: "Send broadcasts and order confirmations.",
    icon: KeyRound,
    tone: "info",
    comingSoon: true,
  },
];

const WEBHOOKS: readonly OutgoingWebhook[] = [
  {
    id: "w1",
    url: "https://example.com/webhooks/bantuniaga",
    events: ["customer.created", "order.paid", "content.posted"],
    delivered: 1_240,
    failed: 3,
    active: true,
  },
];

export default async function IntegrationsSettingsPage() {
  const user = await getCurrentUser();
  const accounts = await loadSocialAccounts(user.businessId);
  const metaReady = isMetaConfigured();
  const missingEnv = missingMetaEnvVars();

  const byProvider = new Map<string, SocialAccount[]>();
  for (const a of accounts) {
    const list = byProvider.get(a.provider) ?? [];
    list.push(a);
    byProvider.set(a.provider, list);
  }

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to settings
      </Link>

      <PageHeader
        eyebrow="Settings · Security"
        title="API keys & integrations"
        description="Issue API tokens, manage webhooks, and connect Bantu Niaga to Meta (Facebook + Instagram), TikTok and WhatsApp Business."
        action={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-3.5 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New API key
          </button>
        }
      />

      <Suspense fallback={null}>
        <CallbackToast />
      </Suspense>

      {/* Meta config status banner */}
      {!metaReady && (
        <div className="flex items-start gap-3 rounded-xl border border-status-warning/30 bg-status-warning/10 p-4">
          <AlertCircle
            className="h-5 w-5 shrink-0 text-status-warning"
            strokeWidth={2}
          />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-ink dark:text-cream-100">
              Meta integration is not configured yet
            </p>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              Add the following env var{missingEnv.length === 1 ? "" : "s"} to
              <code className="mx-1 rounded bg-cream-100 px-1 font-mono text-[11px] dark:bg-hairline-dark">
                .env.local
              </code>
              then restart the server:{" "}
              {missingEnv.map((v, i) => (
                <span key={v}>
                  {i > 0 && ", "}
                  <code className="rounded bg-cream-100 px-1 font-mono text-[11px] dark:bg-hairline-dark">
                    {v}
                  </code>
                </span>
              ))}
              . You can get an App ID + Secret for free at{" "}
              <a
                href="https://developers.facebook.com/apps/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand-700 underline dark:text-brand-200"
              >
                developers.facebook.com/apps
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {/* Channel integrations */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-ink dark:text-cream-100">
            Channel integrations
          </h2>
          <p className="text-sm text-ink-muted dark:text-cream-400">
            Connect to bring live engagement metrics into the Marketing module
            and unlock auto-posting.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <ChannelCard
              key={c.id}
              channel={c}
              accounts={c.provider ? (byProvider.get(c.provider) ?? []) : []}
              metaReady={metaReady}
            />
          ))}
        </div>
      </section>

      {/* API keys */}
      <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <KeyRound className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                API keys
              </h3>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Use these to authenticate REST calls. Treat them like
                passwords — never commit to git.
              </p>
            </div>
          </div>
          <Badge tone="neutral">{API_KEYS.length} active</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-cream-100/60 text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
              <tr>
                <th className="px-5 py-2.5 text-left">Label</th>
                <th className="px-5 py-2.5 text-left">Key</th>
                <th className="px-5 py-2.5 text-left">Scope</th>
                <th className="px-5 py-2.5 text-left">Last used</th>
                <th className="px-5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {API_KEYS.map((k) => (
                <tr key={k.id}>
                  <td className="px-5 py-3 text-sm font-semibold text-ink dark:text-cream-100">
                    {k.label}
                    <p className="text-[11px] font-normal text-ink-muted dark:text-cream-400">
                      Created {k.createdAt}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <code className="rounded bg-cream-100 px-2 py-1 font-mono text-xs text-ink dark:bg-hairline-dark dark:text-cream-100">
                      {k.prefix}••••••••
                    </code>
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      tone={
                        k.scope === "admin"
                          ? "warning"
                          : k.scope === "read+write"
                            ? "accent"
                            : "brand"
                      }
                    >
                      {k.scope}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-muted dark:text-cream-400">
                    {k.lastUsed}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <IconBtn icon={Eye} label="Reveal" />
                      <IconBtn icon={Copy} label="Copy" />
                      <IconBtn icon={RefreshCw} label="Rotate" />
                      <IconBtn icon={Trash2} label="Revoke" tone="danger" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Webhooks */}
      <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <Webhook className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                Outgoing webhooks
              </h3>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Listen to events_outbox events from your own server.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
            Add webhook
          </button>
        </div>
        <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {WEBHOOKS.map((w) => (
            <li
              key={w.id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold text-ink dark:text-cream-100">
                  {w.url}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {w.events.map((e) => (
                    <span
                      key={e}
                      className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-status-success">
                    {w.delivered.toLocaleString("en-MY")} delivered
                  </p>
                  <p className="text-[11px] text-status-danger">
                    {w.failed} failed
                  </p>
                </div>
                <IconBtn icon={RefreshCw} label="Retry" />
                <IconBtn icon={EyeOff} label="Disable" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

interface ChannelCardProps {
  channel: ChannelIntegration;
  accounts: SocialAccount[];
  metaReady: boolean;
}

function ChannelCard({ channel, accounts, metaReady }: ChannelCardProps) {
  const Icon = channel.icon;
  const isMeta =
    channel.provider === "facebook" || channel.provider === "instagram";
  const activeAccounts = accounts.filter((a) => a.status === "active");
  const connected = activeAccounts.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
              channel.tone === "accent"
                ? "bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200"
                : channel.tone === "info"
                  ? "bg-[#DCE9F0] text-[#1F4E66] dark:bg-[#13303D] dark:text-[#A6CFE0]"
                  : "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
                {channel.name}
              </h3>
              {channel.comingSoon ? (
                <Badge tone="neutral">Coming soon</Badge>
              ) : connected ? (
                <Badge tone="success">Connected</Badge>
              ) : (
                <Badge tone="neutral">Available</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              {channel.description}
            </p>
          </div>
        </div>
        {/* Per-card action */}
        {isMeta ? (
          channel.provider === "facebook" ? (
            connected ? null : (
              <ConnectMetaButton disabled={!metaReady} />
            )
          ) : null
        ) : (
          <button
            type="button"
            disabled
            className="shrink-0 cursor-not-allowed rounded-lg border border-cream-300 bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400"
          >
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" strokeWidth={2} />
              Soon
            </span>
          </button>
        )}
      </div>

      {/* Connected account rows */}
      {activeAccounts.length > 0 && (
        <ul className="space-y-2">
          {activeAccounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-cream-200 bg-cream-100/40 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20"
            >
              <div className="flex min-w-0 items-center gap-3">
                {a.picture_url ? (
                  <Image
                    src={a.picture_url}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                    {a.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                    {a.name}
                  </p>
                  <p className="truncate text-[11px] text-ink-muted dark:text-cream-400">
                    {a.provider === "facebook" ? "Page" : "Business"}
                    {a.username ? ` · @${a.username}` : ""}
                    {a.connected_at
                      ? ` · connected ${formatDate(a.connected_at)}`
                      : ""}
                  </p>
                </div>
              </div>
              <DisconnectSocialButton
                accountId={a.id}
                accountName={a.name}
                cascadeProvider={a.provider === "facebook" ? "both" : "self"}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Empty state for Meta-supported providers with no connections */}
      {isMeta && !connected && (
        <p className="inline-flex items-center gap-1 text-[11px] text-ink-muted dark:text-cream-400">
          <Link2 className="h-3 w-3" strokeWidth={2} />
          {channel.provider === "instagram"
            ? "Instagram is auto-linked when you connect a Facebook Page that has an IG Business account."
            : "Connect once and we'll auto-detect any linked Instagram Business accounts."}
        </p>
      )}
    </div>
  );
}

function ConnectMetaButton({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title="Configure META_APP_ID and META_APP_SECRET first"
        className="inline-flex shrink-0 cursor-not-allowed items-center gap-1 rounded-lg border border-cream-300 bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400"
      >
        <Lock className="h-3 w-3" strokeWidth={2} />
        Configure env first
      </button>
    );
  }
  return (
    <a
      href="/api/social/meta/connect"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1877F2] px-3 py-1.5 text-xs font-semibold text-white shadow-card hover:opacity-90"
    >
      <Facebook className="h-3 w-3" strokeWidth={2} />
      Connect with Facebook
    </a>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function IconBtn({
  icon: Icon,
  label,
  tone = "neutral",
}: {
  icon: typeof RefreshCw;
  label: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-cream-300 bg-white ${
        tone === "danger"
          ? "text-status-danger hover:bg-status-danger/10"
          : "text-ink-muted hover:bg-cream-100 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60"
      } dark:border-hairline-dark dark:bg-panel-dark`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}
