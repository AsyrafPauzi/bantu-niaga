"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Camera,
  CheckCircle2,
  Facebook,
  Send,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { SocialAccount } from "@/lib/social/types";

interface PublishPanelProps {
  contentPlanId: string;
  contentChannel: "tiktok" | "instagram" | "facebook";
  defaultCaption: string;
  accounts: SocialAccount[];
  /** True when the entry has already been posted (we then disable publish). */
  alreadyPosted: boolean;
}

interface PublishResult {
  accountId: string;
  publishId: string;
  status: "posted" | "failed";
  externalPostId?: string;
  permalink?: string;
  error?: string;
}

/**
 * Publish-to-channels panel.
 *
 * Reads the list of connected social_accounts (passed in by the server
 * component) and offers a checkbox-style picker. When the user clicks
 * "Publish now", we POST to /api/social/meta/post with the selected
 * accountIds + optional caption override + optional image URL.
 *
 * The response is rendered inline as a per-account result list so a
 * partial failure (e.g. IG rejected because no media URL) is visible
 * next to the account it relates to.
 */
export function PublishPanel({
  contentPlanId,
  contentChannel,
  defaultCaption,
  accounts,
  alreadyPosted,
}: PublishPanelProps) {
  const router = useRouter();

  const matching = useMemo(
    () =>
      accounts.filter((a) => {
        if (contentChannel === "facebook") return a.provider === "facebook";
        if (contentChannel === "instagram") return a.provider === "instagram";
        // tiktok channel — we can't publish to TikTok via Meta, so no match.
        return false;
      }),
    [accounts, contentChannel],
  );

  const [selected, setSelected] = useState<Set<string>>(() => {
    // Pre-select all matching accounts so the common case is a single click.
    return new Set(matching.map((a) => a.id));
  });
  const [caption, setCaption] = useState(defaultCaption);
  const [imageUrl, setImageUrl] = useState("");
  const [results, setResults] = useState<PublishResult[] | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const igSelected = matching.some(
    (a) => selected.has(a.id) && a.provider === "instagram",
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePublish() {
    if (pending || selected.size === 0) return;
    setTopError(null);
    setResults(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/social/meta/post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentPlanId,
            accountIds: Array.from(selected),
            captionOverride: caption !== defaultCaption ? caption : undefined,
            imageUrl: imageUrl.trim() || undefined,
          }),
        });
        const body = (await res.json().catch(() => null)) as {
          succeeded?: number;
          results?: PublishResult[];
          error?: string;
          message?: string;
        } | null;
        if (!res.ok) {
          setTopError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
          return;
        }
        setResults(body?.results ?? []);
        router.refresh();
      } catch (e) {
        setTopError((e as Error).message ?? "Network error");
      }
    });
  }

  if (alreadyPosted && (!results || results.length === 0)) {
    return null;
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
            <Send className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
              Publish to channels
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              No social accounts connected.{" "}
              <a
                href="/settings/integrations"
                className="font-semibold text-brand-700 underline dark:text-brand-200"
              >
                Connect Facebook or Instagram
              </a>{" "}
              first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (matching.length === 0) {
    return (
      <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-status-warning"
            strokeWidth={2}
          />
          <div>
            <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
              No matching channel
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              This entry is for <strong>{contentChannel}</strong>, but you
              haven&apos;t connected a {contentChannel} account.
              {contentChannel === "tiktok"
                ? " TikTok publishing is not yet supported."
                : ""}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Send className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
            Publish to channels
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            Sends this entry to the selected Meta accounts using the Graph
            API. Choose which accounts to publish to below.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {matching.map((a) => {
          const checked = selected.has(a.id);
          const Icon = a.provider === "facebook" ? Facebook : Camera;
          return (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-cream-200 p-3 dark:border-hairline-dark"
            >
              <input
                id={`acct-${a.id}`}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(a.id)}
                className="h-4 w-4 rounded border-cream-300 text-brand-500 focus:ring-brand-500"
              />
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  a.provider === "facebook"
                    ? "text-[#1877F2]"
                    : "text-accent-600"
                }`}
                strokeWidth={2}
              />
              <label
                htmlFor={`acct-${a.id}`}
                className="min-w-0 flex-1 cursor-pointer"
              >
                <span className="block truncate text-sm font-semibold text-ink dark:text-cream-100">
                  {a.name}
                </span>
                <span className="block truncate text-[11px] text-ink-muted dark:text-cream-400">
                  {a.provider === "facebook"
                    ? "Facebook Page"
                    : `Instagram Business${a.username ? ` · @${a.username}` : ""}`}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
            Caption{" "}
            <span className="text-[10px] font-normal normal-case">
              (defaults to hook + caption from this entry)
            </span>
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-inner placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
            Image URL{" "}
            <span
              className={`text-[10px] font-normal normal-case ${
                igSelected ? "text-status-warning" : ""
              }`}
            >
              {igSelected
                ? "Required for Instagram — must be publicly accessible"
                : "Optional for Facebook"}
            </span>
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://your-storage.example/image.jpg"
            className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-inner placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-muted dark:text-cream-400">
          {selected.size} of {matching.length} selected
        </p>
        <button
          type="button"
          onClick={handlePublish}
          disabled={
            pending || selected.size === 0 || (igSelected && !imageUrl.trim())
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          {pending ? "Publishing…" : "Publish now"}
        </button>
      </div>

      {topError && (
        <p
          role="alert"
          className="mt-3 rounded-md bg-[#F8DDD9] px-3 py-2 text-xs text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]"
        >
          {topError}
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {results.map((r) => {
            const acct = matching.find((a) => a.id === r.accountId);
            const ok = r.status === "posted";
            return (
              <li
                key={r.accountId}
                className={`flex items-start gap-2 rounded-md p-2 text-xs ${
                  ok
                    ? "bg-status-success/10 text-status-success"
                    : "bg-status-danger/10 text-status-danger"
                }`}
              >
                {ok ? (
                  <CheckCircle2
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.5}
                  />
                ) : (
                  <AlertTriangle
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.5}
                  />
                )}
                <div className="min-w-0">
                  <p className="font-semibold">
                    {acct?.name ?? r.accountId.slice(0, 8)}{" "}
                    <span className="font-normal opacity-80">
                      {ok ? "published" : "failed"}
                    </span>
                  </p>
                  {ok && r.permalink ? (
                    <a
                      href={r.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all underline opacity-80"
                    >
                      {r.permalink}
                    </a>
                  ) : null}
                  {!ok && r.error ? <p className="opacity-80">{r.error}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
