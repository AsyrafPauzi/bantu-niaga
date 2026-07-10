"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Loader2, Plus, X } from "lucide-react";
import type { LeadChannel } from "@/lib/sales/schemas";

type Assignee = { user_id: string; display_name: string | null; role: string };

const CHANNELS: { value: LeadChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "referral", label: "Referral" },
  { value: "walk_in", label: "Walk-in" },
  { value: "call", label: "Call" },
  { value: "other", label: "Other" },
];

export function LeadCreateForm({
  assignees,
  currentUserId,
}: {
  assignees: Assignee[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<LeadChannel | "">("");
  const [interest, setInterest] = useState("");
  const [value, setValue] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [assignedTo, setAssignedTo] = useState(currentUserId);

  function reset() {
    setName("");
    setPhone("");
    setChannel("");
    setInterest("");
    setValue("");
    setFollowUp("");
    setAssignedTo(currentUserId);
    setError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/sales/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          channel: channel || null,
          interest: interest.trim() || null,
          estimated_value_myr: value ? Number(value) : null,
          follow_up_at: followUp || null,
          assigned_to: assignedTo || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          json?.message ??
            json?.error ??
            "Could not create lead. Check name and phone.",
        );
        return;
      }
      reset();
      setOpen(false);
      router.push(`/sales/leads/${json.data.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
      >
        <Plus className="h-4 w-4" />
        New lead
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-create-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-panel-dark"
          >
            <div className="flex items-start justify-between gap-2">
              <h2
                id="lead-create-title"
                className="text-base font-bold text-ink dark:text-cream-100"
              >
                New lead
              </h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block text-sm">
              <span className="font-medium text-ink dark:text-cream-100">
                Name *
              </span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-ink dark:text-cream-100">
                Phone *
              </span>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="012-345 6789"
                className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-ink dark:text-cream-100">
                  Channel
                </span>
                <select
                  value={channel}
                  onChange={(e) =>
                    setChannel(e.target.value as LeadChannel | "")
                  }
                  className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
                >
                  <option value="">—</option>
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-ink dark:text-cream-100">
                  Est. value (RM)
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="font-medium text-ink dark:text-cream-100">
                Interest
              </span>
              <input
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                placeholder="What are they looking for?"
                className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-ink dark:text-cream-100">
                  Follow-up date
                </span>
                <input
                  type="date"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-ink dark:text-cream-100">
                  Assigned to
                </span>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
                >
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a.user_id} value={a.user_id}>
                      {a.display_name || a.role}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <p className="text-sm text-status-danger">{error}</p>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="rounded-lg border border-cream-300 px-3 py-2 text-sm font-semibold dark:border-hairline-dark"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
