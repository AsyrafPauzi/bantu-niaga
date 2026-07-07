"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Copy,
  Facebook,
  KeyRound,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  RefreshCw,
  Trash2,
  Video,
  Webhook,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WEBHOOK_EVENT_OPTIONS } from "@/lib/settings/schemas";

export interface ChannelCardConfig {
  id: string;
  name: string;
  description: string;
  icon: "facebook" | "instagram" | "tiktok" | "whatsapp";
}

export interface ApiKeyRow {
  id: string;
  label: string;
  key_prefix: string;
  scope: "read" | "read+write" | "admin";
  last_used_at: string | null;
  created_at: string;
}

export interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  delivered_count: number;
  failed_count: number;
  last_delivered_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface IntegrationsViewProps {
  channels: readonly ChannelCardConfig[];
  initialApiKeys: ApiKeyRow[];
  initialWebhooks: WebhookRow[];
  canEdit: boolean;
  encryptionReady: boolean;
}

const CHANNEL_ICONS = {
  facebook: Facebook,
  instagram: Camera,
  tiktok: Video,
  whatsapp: MessageCircle,
} as const;

function fmtRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function IntegrationsView({
  channels,
  initialApiKeys,
  initialWebhooks,
  canEdit,
  encryptionReady,
}: IntegrationsViewProps) {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [secretModal, setSecretModal] = useState<null | {
    title: string;
    secret: string;
    hint: string;
  }>(null);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyLabel, setKeyLabel] = useState("");
  const [keyScope, setKeyScope] = useState<"read" | "read+write" | "admin">(
    "read+write",
  );

  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    "customer.created",
  ]);

  function refresh() {
    router.refresh();
  }

  async function reloadLists() {
    const [keysRes, hooksRes] = await Promise.all([
      fetch("/api/settings/integrations/api-keys"),
      fetch("/api/settings/integrations/webhooks"),
    ]);
    if (keysRes.ok) {
      const j = await keysRes.json();
      setApiKeys(j.data ?? []);
    }
    if (hooksRes.ok) {
      const j = await hooksRes.json();
      setWebhooks(j.data ?? []);
    }
  }

  function createApiKey() {
    setError(null);
    if (!keyLabel.trim()) {
      setError("Give the key a label.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/settings/integrations/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: keyLabel.trim(), scope: keyScope }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? "Could not create API key.");
        return;
      }
      setShowKeyModal(false);
      setKeyLabel("");
      setSecretModal({
        title: "API key created",
        secret: json.secret,
        hint: "Copy this key now — you won't be able to see it again.",
      });
      await reloadLists();
      refresh();
    });
  }

  function rotateKey(id: string) {
    if (!confirm("Rotate this key? The old key stops working immediately."))
      return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/settings/integrations/api-keys/${id}/rotate`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? "Could not rotate key.");
        return;
      }
      setSecretModal({
        title: "New API key",
        secret: json.secret,
        hint: "Copy the new key now — the previous key no longer works.",
      });
      await reloadLists();
      refresh();
    });
  }

  function revokeKey(id: string) {
    if (!confirm("Revoke this API key? Apps using it will stop working."))
      return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/settings/integrations/api-keys/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.message ?? "Could not revoke key.");
        return;
      }
      setApiKeys((s) => s.filter((k) => k.id !== id));
      refresh();
    });
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text).catch(() => {
      setError("Could not copy to clipboard.");
    });
  }

  function createWebhook() {
    setError(null);
    if (!webhookUrl.trim()) {
      setError("Enter a webhook URL.");
      return;
    }
    if (webhookEvents.length === 0) {
      setError("Select at least one event.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/settings/integrations/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl.trim(), events: webhookEvents }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? "Could not create webhook.");
        return;
      }
      setShowWebhookModal(false);
      setWebhookUrl("");
      setWebhookEvents(["customer.created"]);
      if (json.signing_secret) {
        setSecretModal({
          title: "Webhook signing secret",
          secret: json.signing_secret,
          hint: "Verify deliveries with X-BantuNiaga-Signature. Save this secret now.",
        });
      }
      await reloadLists();
      refresh();
    });
  }

  function toggleWebhook(id: string, active: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/settings/integrations/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? "Could not update webhook.");
        return;
      }
      setWebhooks((s) =>
        s.map((w) => (w.id === id ? { ...w, active: json.webhook.active } : w)),
      );
    });
  }

  function testWebhook(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/settings/integrations/webhooks/${id}/test`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? "Test delivery failed.");
        await reloadLists();
        return;
      }
      await reloadLists();
    });
  }

  function deleteWebhook(id: string) {
    if (!confirm("Delete this webhook endpoint?")) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/settings/integrations/webhooks/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.message ?? "Could not delete webhook.");
        return;
      }
      setWebhooks((s) => s.filter((w) => w.id !== id));
      refresh();
    });
  }

  function toggleEvent(event: string) {
    setWebhookEvents((s) =>
      s.includes(event) ? s.filter((e) => e !== event) : [...s, event],
    );
  }

  return (
    <>
      {error ? (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 p-3 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-ink dark:text-cream-100">
          Read-only — only the <strong>owner</strong> can manage API keys and
          webhooks.
        </div>
      ) : null}

      {/* Channel integrations — all coming soon */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-ink dark:text-cream-100">
            Channel integrations
          </h2>
          <p className="text-sm text-ink-muted dark:text-cream-400">
            Connect social channels for Marketing auto-posting and analytics.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {channels.map((c) => {
            const Icon = CHANNEL_ICONS[c.icon];
            return (
              <div
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
                        {c.name}
                      </h3>
                      <Badge tone="neutral">Coming soon</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                      {c.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled
                  className="inline-flex shrink-0 cursor-not-allowed items-center gap-1 rounded-lg border border-cream-300 bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400"
                >
                  <Lock className="h-3 w-3" strokeWidth={2} />
                  Soon
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* API keys */}
      <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <KeyRound className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                API keys
              </h3>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Authenticate REST calls with{" "}
                <code className="rounded bg-cream-100 px-1 dark:bg-hairline-dark">
                  Authorization: Bearer bn_live_…
                </code>
                . Test with{" "}
                <code className="rounded bg-cream-100 px-1 dark:bg-hairline-dark">
                  GET /api/external/v1/ping
                </code>
                .
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{apiKeys.length} active</Badge>
            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              disabled={!canEdit || pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              New API key
            </button>
          </div>
        </div>

        {apiKeys.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-muted dark:text-cream-400">
            No API keys yet. Create one for POS terminals, mobile apps, or
            scripts.
          </p>
        ) : (
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
                {apiKeys.map((k) => (
                  <tr key={k.id}>
                    <td className="px-5 py-3 font-semibold text-ink dark:text-cream-100">
                      {k.label}
                      <p className="text-[11px] font-normal text-ink-muted dark:text-cream-400">
                        Created {fmtDate(k.created_at)}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <code className="rounded bg-cream-100 px-2 py-1 font-mono text-xs dark:bg-hairline-dark">
                        {k.key_prefix}••••••••
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
                      {fmtRelative(k.last_used_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <IconBtn
                          icon={Copy}
                          label="Copy prefix"
                          onClick={() => copyText(k.key_prefix)}
                        />
                        <IconBtn
                          icon={RefreshCw}
                          label="Rotate"
                          disabled={!canEdit || pending}
                          onClick={() => rotateKey(k.id)}
                        />
                        <IconBtn
                          icon={Trash2}
                          label="Revoke"
                          tone="danger"
                          disabled={!canEdit || pending}
                          onClick={() => revokeKey(k.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Webhooks */}
      <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <Webhook className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                Outgoing webhooks
              </h3>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Receive signed POST payloads when events fire in your business.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowWebhookModal(true)}
            disabled={!canEdit || pending || !encryptionReady}
            title={
              encryptionReady
                ? undefined
                : "Set INTEGRATION_ENCRYPTION_KEY to enable webhooks"
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
            Add webhook
          </button>
        </div>

        {!encryptionReady ? (
          <p className="border-b border-cream-200 px-5 py-3 text-xs text-status-warning dark:border-hairline-dark">
            Webhook signing secrets require{" "}
            <code>INTEGRATION_ENCRYPTION_KEY</code> on the server.
          </p>
        ) : null}

        {webhooks.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-muted dark:text-cream-400">
            No webhooks yet. Add an HTTPS endpoint to receive event payloads.
          </p>
        ) : (
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {webhooks.map((w) => (
              <li
                key={w.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-mono text-sm font-semibold text-ink dark:text-cream-100">
                      {w.url}
                    </p>
                    <Badge tone={w.active ? "success" : "neutral"}>
                      {w.active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {w.events.map((e) => (
                      <span
                        key={e}
                        className="inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                  {w.last_error ? (
                    <p className="mt-1 text-[11px] text-status-danger">
                      Last error: {w.last_error}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right text-[11px]">
                    <p className="font-semibold text-status-success">
                      {w.delivered_count.toLocaleString("en-MY")} delivered
                    </p>
                    <p className="text-status-danger">
                      {w.failed_count} failed
                    </p>
                  </div>
                  <IconBtn
                    icon={RefreshCw}
                    label="Send test"
                    disabled={!canEdit || pending}
                    onClick={() => testWebhook(w.id)}
                  />
                  <button
                    type="button"
                    disabled={!canEdit || pending}
                    onClick={() => toggleWebhook(w.id, !w.active)}
                    className="rounded-md border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:text-cream-100"
                  >
                    {w.active ? "Pause" : "Enable"}
                  </button>
                  <IconBtn
                    icon={Trash2}
                    label="Delete"
                    tone="danger"
                    disabled={!canEdit || pending}
                    onClick={() => deleteWebhook(w.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* New API key modal */}
      {showKeyModal ? (
        <Modal title="New API key" onClose={() => setShowKeyModal(false)}>
          <div className="space-y-3">
            <Field label="Label">
              <input
                value={keyLabel}
                onChange={(e) => setKeyLabel(e.target.value)}
                placeholder="POS terminal — Shah Alam"
                className={inputCx}
              />
            </Field>
            <Field label="Scope">
              <select
                value={keyScope}
                onChange={(e) =>
                  setKeyScope(
                    e.target.value as "read" | "read+write" | "admin",
                  )
                }
                className={inputCx}
              >
                <option value="read">read — GET only</option>
                <option value="read+write">read+write — read + mutate</option>
                <option value="admin">admin — full access</option>
              </select>
            </Field>
          </div>
          <ModalActions
            pending={pending}
            onCancel={() => setShowKeyModal(false)}
            onConfirm={createApiKey}
            confirmLabel="Create key"
          />
        </Modal>
      ) : null}

      {/* New webhook modal */}
      {showWebhookModal ? (
        <Modal title="Add webhook" onClose={() => setShowWebhookModal(false)}>
          <div className="space-y-3">
            <Field label="Endpoint URL (HTTPS)">
              <input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-server.com/webhooks/bantuniaga"
                className={inputCx}
              />
            </Field>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink dark:text-cream-100">
                Events
              </p>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENT_OPTIONS.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => toggleEvent(ev)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      webhookEvents.includes(ev)
                        ? "bg-accent-500 text-white"
                        : "border border-cream-300 bg-white text-ink-muted dark:border-hairline-dark dark:bg-panel-dark"
                    }`}
                  >
                    {ev}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <ModalActions
            pending={pending}
            onCancel={() => setShowWebhookModal(false)}
            onConfirm={createWebhook}
            confirmLabel="Add webhook"
          />
        </Modal>
      ) : null}

      {/* One-time secret reveal */}
      {secretModal ? (
        <Modal
          title={secretModal.title}
          onClose={() => setSecretModal(null)}
        >
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {secretModal.hint}
          </p>
          <code className="mt-3 block select-all break-all rounded-lg bg-cream-100 p-3 font-mono text-xs text-ink dark:bg-hairline-dark dark:text-cream-100">
            {secretModal.secret}
          </code>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => copyText(secretModal.secret)}
              className="inline-flex items-center gap-2 rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-100"
            >
              <Copy className="h-4 w-4" strokeWidth={2} />
              Copy
            </button>
            <button
              type="button"
              onClick={() => setSecretModal(null)}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-cream-200 bg-white p-6 shadow-elevated dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink dark:text-cream-100">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-cream-100"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  pending,
  onCancel,
  onConfirm,
  confirmLabel,
}: {
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60 dark:border-hairline-dark dark:text-cream-100"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : null}
        {confirmLabel}
      </button>
    </div>
  );
}

function IconBtn({
  icon: Icon,
  label,
  tone = "neutral",
  disabled,
  onClick,
}: {
  icon: typeof RefreshCw;
  label: string;
  tone?: "neutral" | "danger";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-cream-300 bg-white disabled:opacity-50 ${
        tone === "danger"
          ? "text-status-danger hover:bg-status-danger/10"
          : "text-ink-muted hover:bg-cream-100 hover:text-ink dark:text-cream-400"
      } dark:border-hairline-dark dark:bg-panel-dark`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}

const inputCx =
  "w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[13px] font-semibold text-ink dark:text-cream-100">
        {label}
      </span>
      {children}
    </label>
  );
}
