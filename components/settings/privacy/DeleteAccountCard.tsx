"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

import type { Role } from "@/lib/permissions";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/privacy/catalog";
import type { DataSubjectRequest } from "@/lib/privacy/types";

interface Props {
  userRole: Role;
  pendingDeletion: DataSubjectRequest | null;
}

type Scope = "user" | "business";

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
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
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
      <section className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-10 w-10 place-items-center rounded-lg bg-status-danger/10 text-status-danger"
          >
            <AlertTriangle className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ink dark:text-cream-100">
              Deletion scheduled
            </h2>
            <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
              {pendingDeletion.kind === "delete_business"
                ? "This entire business will be permanently deleted on "
                : "Your account will be permanently deleted on "}
              <strong className="font-semibold text-ink dark:text-cream-100">
                {pendingDeletion.scheduledFor
                  ? new Date(pendingDeletion.scheduledFor).toLocaleDateString(
                      "en-MY",
                      { year: "numeric", month: "long", day: "numeric" },
                    )
                  : "—"}
              </strong>
              . Cancelling restores access immediately.
            </p>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 text-sm font-semibold text-ink transition-colors hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:border-brand-700 dark:hover:bg-brand-900/30"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <X className="h-4 w-4" strokeWidth={2} />
          )}
          Cancel deletion
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-status-danger/30 bg-white p-6 shadow-card dark:border-status-danger/30 dark:bg-panel-dark">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 place-items-center rounded-lg bg-status-danger/10 text-status-danger"
        >
          <Trash2 className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink dark:text-cream-100">
            Close my account
          </h2>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Your account is soft-deleted immediately and permanently removed
            after a {ACCOUNT_DELETION_GRACE_DAYS}-day grace period. PDPA s.30
            (Right to Erasure).
          </p>
        </div>
      </div>

      {userRole === "owner" ? (
        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
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
              <strong className="font-semibold">Close the entire business.</strong>{" "}
              All team members lose access, every record is deleted.
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
              <strong className="font-semibold">Just my user account.</strong>{" "}
              The business survives; transfer ownership first.
            </span>
          </label>
        </fieldset>
      ) : null}

      <label className="mt-4 block text-sm">
        <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
          Reason (optional, helps us improve)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={280}
          className="block w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-card placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          placeholder="e.g. switching to another platform"
        />
      </label>

      <label className="mt-3 block text-sm">
        <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
          Type <code className="rounded bg-cream-100 px-1 font-mono text-xs dark:bg-hairline-dark">DELETE</code> to confirm
        </span>
        <input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
          className="block w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-card focus:border-status-danger focus:outline-none focus:ring-2 focus:ring-status-danger/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={busy || confirmation !== "DELETE"}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-status-danger px-4 text-sm font-semibold text-white transition-colors hover:bg-status-danger/90 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-ink-subtle dark:disabled:bg-hairline-dark dark:disabled:text-cream-400"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : (
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        )}
        Schedule deletion
      </button>
    </section>
  );
}
