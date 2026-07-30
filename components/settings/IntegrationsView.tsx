"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Copy,
  Facebook,
  KeyRound,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  Video,
  Webhook,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WEBHOOK_EVENT_OPTIONS } from "@/lib/settings/schemas";

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
  initialApiKeys: ApiKeyRow[];
  initialWebhooks: WebhookRow[];
  canEdit: boolean;
  encryptionReady: boolean;
}

const COMING_SOON_CHANNELS = [
  { id: "facebook", name: "Facebook Page", icon: Facebook },
  { id: "instagram", name: "Instagram Business", icon: Camera },
  { id: "tiktok", name: "TikTok for Business", icon: Video },
  { id: "whatsapp", name: "WhatsApp Business Cloud", icon: MessageCircle },
] as const;

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

export function IntegrationsView({
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

  useEffect(() => {
    setApiKeys(initialApiKeys);
  }, [initialApiKeys]);

  useEffect(() => {
    setWebhooks(initialWebhooks);
  }, [initialWebhooks]);

  function refresh() {
    router.refresh();
  }

  async function reloadLists() {
    const [keysRes, hooksRes] = await Promise.all([
      fetch("/api/settings/integrations/api-keys", { credentials: "same-origin" }),
      fetch("/api/settings/integrations/webhooks", { credentials: "same-origin" }),
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
        credentials: "same-origin",
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
        hint: "Copy this key now — you won't see it again.",
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
        { method: "POST", credentials: "same-origin" },
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
        credentials: "same-origin",
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
        credentials: "same-origin",
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
          hint: "Save this secret to verify X-BantuNiaga-Signature.",
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
        credentials: "same-origin",
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
        { method: "POST", credentials: "same-origin" },
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
        credentials: "same-origin",
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
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 p-2.5 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {!canEdit ? (
        <p className="text-sm text-ink-muted dark:text-cream-400">
          Read-only — only the owner can manage API keys and webhooks.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center justify-between gap-2 border-b border-cream-200 p-3 dark:border-hairline-dark">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <KeyRound className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                    API keys
                  </h2>
                  <p className="text-[11px] text-ink-muted dark:text-cream-400">
                    {apiKeys.length === 0
                      ? "No keys yet"
                      : `${apiKeys.length} active`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(true)}
                disabled={!canEdit || pending}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                New key
              </button>
            </div>

            {apiKeys.length === 0 ? (
              <p className="px-3 py-4 text-xs text-ink-muted dark:text-cream-400">
                Create a key for POS, scripts, or external apps.
              </p>
            ) : (
              <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
                {apiKeys.map((k) => (
                  <li
                    key={k.id}
                    className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink dark:text-cream-100">
                        {k.label}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-ink-muted dark:text-cream-400">
                        {k.key_prefix}••••••••
                      </p>
                      <p className="mt-1 text-[11px] text-ink-muted dark:text-cream-400">
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
                        <span className="ml-2">
                          Last used {fmtRelative(k.last_used_at)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
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
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center justify-between gap-2 border-b border-cream-200 p-3 dark:border-hairline-dark">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <Webhook className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                    Webhooks
                  </h2>
                  <p className="text-[11px] text-ink-muted dark:text-cream-400">
                    {webhooks.length === 0
                      ? "No endpoints yet"
                      : `${webhooks.length} endpoint${webhooks.length === 1 ? "" : "s"}`}
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
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-cream-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Add webhook
              </button>
            </div>

            {!encryptionReady ? (
              <p className="border-b border-cream-200 px-3 py-2 text-[11px] text-status-warning dark:border-hairline-dark">
                Webhooks need INTEGRATION_ENCRYPTION_KEY on the server.
              </p>
            ) : null}

            {webhooks.length === 0 ? (
              <p className="px-3 py-4 text-xs text-ink-muted dark:text-cream-400">
                Add an HTTPS URL to receive signed event payloads.
              </p>
            ) : (
              <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
                {webhooks.map((w) => (
                  <li
                    key={w.id}
                    className="flex flex-col gap-2 px-3 py-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-mono text-sm text-ink dark:text-cream-100">
                          {w.url}
                        </p>
                        <Badge tone={w.active ? "success" : "neutral"}>
                          {w.active ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <span
                            key={e}
                            className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-ink-muted dark:text-cream-400">
                        {w.delivered_count.toLocaleString("en-MY")} delivered
                        {w.failed_count > 0
                          ? ` · ${w.failed_count} failed`
                          : ""}
                        {w.last_delivered_at
                          ? ` · last ${fmtRelative(w.last_delivered_at)}`
                          : ""}
                      </p>
                      {w.last_error ? (
                        <p className="mt-1 text-[11px] text-status-danger">
                          {w.last_error}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
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
        </div>

        <aside className="min-w-0">
          <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center gap-2.5 border-b border-cream-200 p-3 dark:border-hairline-dark">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <Share2 className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-tight text-ink dark:text-cream-100">
                  Channels
                </h2>
                <p className="text-[11px] leading-tight text-ink-muted dark:text-cream-400">
                  Marketing social
                </p>
              </div>
            </div>
            <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {COMING_SOON_CHANNELS.map((channel) => {
                const Icon = channel.icon;
                return (
                  <li
                    key={channel.id}
                    className="flex items-center gap-2 px-3 py-2"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-cream-100 text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink dark:text-cream-100">
                      {channel.name}
                    </p>
                    <Badge
                      tone="neutral"
                      className="shrink-0 whitespace-nowrap px-1.5 py-0 text-[10px] leading-5"
                    >
                      Coming soon
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      {showKeyModal ? (
        <Modal title="New API key" onClose={() => setShowKeyModal(false)}>
          <div className="space-y-3">
            <Field label="Label">
              <input
                value={keyLabel}
                onChange={(e) => setKeyLabel(e.target.value)}
                placeholder="POS terminal"
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
                <option value="read">read</option>
                <option value="read+write">read+write</option>
                <option value="admin">admin</option>
              </select>
            </Field>
          </div>
          <ModalActions
            pending={pending}
            onCancel={() => setShowKeyModal(false)}
            onConfirm={createApiKey}
            confirmLabel="Create"
          />
        </Modal>
      ) : null}

      {showWebhookModal ? (
        <Modal title="Add webhook" onClose={() => setShowWebhookModal(false)}>
          <div className="space-y-3">
            <Field label="HTTPS URL">
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
            confirmLabel="Add"
          />
        </Modal>
      ) : null}

      {secretModal ? (
        <Modal title={secretModal.title} onClose={() => setSecretModal(null)}>
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
    </div>
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
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-cream-300 bg-white disabled:opacity-50 ${
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
