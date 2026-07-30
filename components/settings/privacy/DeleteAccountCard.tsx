"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

import type { Role } from "@/lib/permissions";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/privacy/catalog";
import { canScheduleDeletionScope } from "@/lib/privacy/delete-access";
import type { DataSubjectRequest } from "@/lib/privacy/types";

interface Props {
  userRole: Role;
  pendingDeletion: DataSubjectRequest | null;
}

type Scope = "user" | "business";

const inputCx =
  "block w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

export function DeleteAccountCard({ userRole, pendingDeletion }: Props) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>(
    userRole === "owner" ? "business" : "user",
  );
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const effectiveScope =
      userRole === "owner" ? scope : ("user" as const);
    if (!canScheduleDeletionScope(userRole, effectiveScope)) {
      setError("Only the business owner can close the entire business.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          scope: effectiveScope,
          confirmation: "DELETE",
          reason: reason.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "Could not schedule deletion.");
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!pendingDeletion) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ request_id: pendingDeletion.id }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "Could not cancel deletion.");
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (pendingDeletion) {
    return (
      <section className="rounded-xl border border-status-danger/30 bg-status-danger/5 shadow-card dark:bg-status-danger/5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-status-danger/20 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-status-danger/10 text-status-danger">
              <AlertTriangle className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Deletion scheduled
              </h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {pendingDeletion.scheduledFor
                  ? new Date(pendingDeletion.scheduledFor).toLocaleDateString(
                      "en-MY",
                      { year: "numeric", month: "long", day: "numeric" },
                    )
                  : "—"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Cancel deletion
          </button>
        </div>
        <p className="px-4 py-4 text-sm text-ink-muted dark:text-cream-400">
          {pendingDeletion.kind === "delete_business"
            ? "This entire business will be permanently deleted after the grace period."
            : "Your account will be permanently deleted after the grace period."}
        </p>
        {error ? (
          <p role="alert" className="border-t border-status-danger/20 px-4 py-3 text-sm text-status-danger">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-status-danger/30 bg-white shadow-card dark:border-status-danger/30 dark:bg-panel-dark">
      <div className="flex items-center gap-3 border-b border-cream-200 p-4 dark:border-hairline-dark">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-status-danger/10 text-status-danger">
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
            Close my account
          </h2>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {userRole === "owner"
              ? `${ACCOUNT_DELETION_GRACE_DAYS}-day grace period · owner can close business or account only`
              : `${ACCOUNT_DELETION_GRACE_DAYS}-day grace period · your account only`}
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {userRole === "owner" ? (
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-ink dark:text-cream-100">
              Scope
            </legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="scope"
                checked={scope === "business"}
                onChange={() => setScope("business")}
                className="mt-0.5 h-4 w-4 text-brand-500 focus:ring-brand-400"
              />
              <span className="text-ink dark:text-cream-100">
                Close the entire business (all team members and records)
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="scope"
                checked={scope === "user"}
                onChange={() => setScope("user")}
                className="mt-0.5 h-4 w-4 text-brand-500 focus:ring-brand-400"
              />
              <span className="text-ink dark:text-cream-100">
                Just my user account (transfer ownership first)
              </span>
            </label>
          </fieldset>
        ) : (
          <p className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-2 text-xs text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400">
            Only the <strong className="font-semibold text-ink dark:text-cream-100">owner</strong> can
            close the entire business. You can remove your own account; the
            business and other team members stay active.
          </p>
        )}

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
            Reason (optional)
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={280}
            className={inputCx}
            placeholder="e.g. switching to another platform"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
            Type{" "}
            <code className="rounded bg-cream-100 px-1 font-mono text-xs dark:bg-hairline-dark">
              DELETE
            </code>{" "}
            to confirm
          </span>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            className={`${inputCx} focus:border-status-danger focus:ring-status-danger/40`}
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={busy || confirmation !== "DELETE"}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-status-danger px-4 text-sm font-semibold text-white hover:bg-status-danger/90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          )}
          Schedule deletion
        </button>
      </div>
    </section>
  );
}
