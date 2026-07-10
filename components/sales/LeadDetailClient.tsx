"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  LEAD_CHANNELS,
  LEAD_STATUSES,
  type LeadChannel,
  type LeadStatus,
} from "@/lib/sales/schemas";
import { formatMyr } from "@/lib/marketing/metrics";

type Lead = {
  id: string;
  name: string;
  phone_e164: string;
  channel: LeadChannel | null;
  interest: string | null;
  estimated_value_myr: number | string | null;
  status: LeadStatus;
  follow_up_at: string | null;
  assigned_to: string | null;
  customer_id: string | null;
  converted_at: string | null;
  lost_reason: string | null;
};

type Note = {
  id: string;
  body: string;
  created_by: string;
  created_at: string;
};

type Assignee = { user_id: string; display_name: string | null; role: string };

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  won: "Won",
  lost: "Lost",
};

const CHANNEL_LABEL: Record<LeadChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  referral: "Referral",
  walk_in: "Walk-in",
  call: "Call",
  other: "Other",
};

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function LeadDetailClient({
  lead: initial,
  notes: initialNotes,
  assignees,
}: {
  lead: Lead;
  notes: Note[];
  assignees: Assignee[];
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initial);
  const [notes, setNotes] = useState(initialNotes);
  const [pending, startTransition] = useTransition();
  const [notePending, startNote] = useTransition();
  const [convertPending, startConvert] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [dismissConvert, setDismissConvert] = useState(false);

  const [name, setName] = useState(lead.name);
  const [phone, setPhone] = useState(lead.phone_e164);
  const [channel, setChannel] = useState(lead.channel ?? "");
  const [interest, setInterest] = useState(lead.interest ?? "");
  const [value, setValue] = useState(
    lead.estimated_value_myr != null ? String(lead.estimated_value_myr) : "",
  );
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [followUp, setFollowUp] = useState(toDateInput(lead.follow_up_at));
  const [assignedTo, setAssignedTo] = useState(lead.assigned_to ?? "");
  const [lostReason, setLostReason] = useState(lead.lost_reason ?? "");

  const showConvertPrompt =
    status === "won" && !lead.customer_id && !dismissConvert;

  function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/sales/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          channel: channel || null,
          interest: interest.trim() || null,
          estimated_value_myr: value ? Number(value) : null,
          status,
          follow_up_at: followUp || null,
          assigned_to: assignedTo || null,
          lost_reason: status === "lost" ? lostReason.trim() || null : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? json?.error ?? "Could not save.");
        return;
      }
      setLead(json.data);
      setSaved(true);
      router.refresh();
    });
  }

  function addNote(e: FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setError(null);
    startNote(async () => {
      const res = await fetch(`/api/sales/leads/${lead.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? "Could not add note.");
        return;
      }
      setNotes((n) => [json.data, ...n]);
      setNoteBody("");
      router.refresh();
    });
  }

  function convert() {
    setError(null);
    startConvert(async () => {
      const res = await fetch(`/api/sales/leads/${lead.id}/convert`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? "Could not convert lead.");
        return;
      }
      setLead((l) => ({
        ...l,
        customer_id: json.customer_id,
        status: "won",
        converted_at: new Date().toISOString(),
      }));
      setStatus("won");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {showConvertPrompt ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 dark:border-brand-800 dark:bg-brand-900/20">
          <p className="text-sm font-medium text-ink dark:text-cream-100">
            This lead is won. Convert to a Marketing customer?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={convert}
              disabled={convertPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {convertPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Convert
            </button>
            <button
              type="button"
              onClick={() => setDismissConvert(true)}
              className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold dark:border-hairline-dark"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {lead.customer_id ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm">
          <StatusPill tone="success">Converted</StatusPill>
          <Link
            href={`/marketing/customers/${lead.customer_id}`}
            className="font-semibold text-brand-700 dark:text-brand-200"
          >
            Open customer
          </Link>
          <Link
            href="/sales/pos"
            className="font-semibold text-brand-700 dark:text-brand-200"
          >
            Open POS
          </Link>
        </div>
      ) : null}

      <form onSubmit={save} className="space-y-4 rounded-xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus)}
              className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Channel</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
            >
              <option value="">—</option>
              {LEAD_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">Interest</span>
            <input
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Est. value (RM)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Follow-up</span>
            <input
              type="date"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">Assigned to</span>
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
          {status === "lost" ? (
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">Lost reason</span>
              <input
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
              />
            </label>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm text-status-danger">{error}</p>
        ) : null}
        {saved ? (
          <p className="text-sm text-status-success">Saved.</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </button>
      </form>

      <section className="rounded-xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark sm:p-5">
        <h2 className="text-sm font-bold text-ink dark:text-cream-100">
          Notes
        </h2>
        <form onSubmit={addNote} className="mt-3 flex gap-2">
          <input
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Add a note…"
            className="min-w-0 flex-1 rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark"
          />
          <button
            type="submit"
            disabled={notePending || !noteBody.trim()}
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            Add
          </button>
        </form>
        <ul className="mt-4 space-y-3">
          {notes.length === 0 ? (
            <li className="text-sm text-ink-muted">No notes yet.</li>
          ) : (
            notes.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-cream-200 px-3 py-2 text-sm dark:border-hairline-dark"
              >
                <p className="whitespace-pre-wrap text-ink dark:text-cream-100">
                  {n.body}
                </p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {new Date(n.created_at).toLocaleString("en-MY", {
                    timeZone: "Asia/Kuala_Lumpur",
                  })}
                </p>
              </li>
            ))
          )}
        </ul>
        {lead.estimated_value_myr != null ? (
          <p className="mt-4 text-xs text-ink-muted">
            Est. value {formatMyr(Number(lead.estimated_value_myr))}
          </p>
        ) : null}
      </section>
    </div>
  );
}
