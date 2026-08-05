"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatMyr } from "@/lib/marketing/metrics";
import {
  LEAD_STATUSES,
  type LeadStatus,
} from "@/lib/sales/schemas";
import { cn } from "@/lib/utils/cn";

type LeadRow = {
  id: string;
  name: string;
  phone_e164: string;
  status: LeadStatus;
  follow_up_at: string | null;
  estimated_value_myr: number | string | null;
  assigned_to: string | null;
};

const STATUS_TONE: Record<
  LeadStatus,
  "neutral" | "brand" | "success" | "warning" | "accent"
> = {
  new: "neutral",
  contacted: "brand",
  interested: "accent",
  won: "success",
  lost: "warning",
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  won: "Won",
  lost: "Lost",
};

interface LeadsKanbanProps {
  leads: LeadRow[];
  assigneeNames: Map<string, string>;
  overdueBeforeIso: string;
}

export function LeadsKanban({
  leads: initialLeads,
  assigneeNames,
  overdueBeforeIso,
}: LeadsKanbanProps) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<LeadStatus | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const byStatus = Object.fromEntries(
    LEAD_STATUSES.map((s) => [s, [] as LeadRow[]]),
  ) as Record<LeadStatus, LeadRow[]>;

  for (const lead of leads) {
    const status = lead.status as LeadStatus;
    if (byStatus[status]) byStatus[status].push(lead);
  }

  const moveLead = useCallback(
    async (leadId: string, newStatus: LeadStatus) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead || lead.status === newStatus) return;

      setUpdatingId(leadId);
      setError(null);
      const prev = leads;
      setLeads((current) =>
        current.map((l) =>
          l.id === leadId ? { ...l, status: newStatus } : l,
        ),
      );

      try {
        const res = await fetch(`/api/sales/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        const json = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;

        if (!res.ok) {
          setLeads(prev);
          setError(json?.message ?? json?.error ?? "Could not update status");
          return;
        }

        startTransition(() => router.refresh());
      } catch (e) {
        setLeads(prev);
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        setUpdatingId(null);
        setDraggingId(null);
        setDropTarget(null);
      }
    },
    [leads, router],
  );

  function onDragStart(e: React.DragEvent, leadId: string) {
    e.dataTransfer.setData("text/plain", leadId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(leadId);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function onColumnDragOver(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(status);
  }

  function onColumnDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) void moveLead(leadId, status);
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-ink-muted">
        Drag cards between columns to update status.
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {LEAD_STATUSES.map((status) => (
          <div
            key={status}
            onDragOver={(e) => onColumnDragOver(e, status)}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => onColumnDrop(e, status)}
            className={cn(
              "w-64 shrink-0 rounded-xl border border-cream-200 bg-cream-50/50 transition dark:border-hairline-dark dark:bg-panel-dark/50",
              dropTarget === status &&
                "border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800",
            )}
          >
            <div className="flex items-center justify-between border-b border-cream-200 px-3 py-2 dark:border-hairline-dark">
              <StatusPill tone={STATUS_TONE[status]}>
                {STATUS_LABEL[status]}
              </StatusPill>
              <span className="text-xs font-semibold text-ink-muted">
                {byStatus[status].length}
              </span>
            </div>
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto p-2">
              {byStatus[status].length === 0 ? (
                <li className="px-2 py-4 text-center text-xs text-ink-muted">
                  Drop here
                </li>
              ) : (
                byStatus[status].map((lead) => {
                  const overdue =
                    lead.follow_up_at &&
                    status !== "won" &&
                    status !== "lost" &&
                    new Date(lead.follow_up_at) < new Date(overdueBeforeIso);
                  const isDragging = draggingId === lead.id;
                  const isUpdating = updatingId === lead.id;
                  return (
                    <li key={lead.id}>
                      <div
                        draggable={!isUpdating}
                        onDragStart={(e) => onDragStart(e, lead.id)}
                        onDragEnd={onDragEnd}
                        className={cn(
                          "rounded-lg border border-cream-200 bg-white text-sm shadow-sm transition dark:border-hairline-dark dark:bg-panel-dark",
                          isDragging && "opacity-40",
                          overdue && "border-amber-300 dark:border-amber-800",
                        )}
                      >
                        <Link
                          href={`/sales/leads/${lead.id}`}
                          className="block p-3 hover:border-blue-300"
                          draggable={false}
                          onClick={(e) => {
                            if (draggingId) e.preventDefault();
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-ink dark:text-cream-100">
                              {lead.name}
                            </p>
                            {isUpdating ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-muted" />
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {lead.phone_e164}
                          </p>
                          {lead.estimated_value_myr != null ? (
                            <p className="mt-1 text-xs font-medium text-ink-muted">
                              {formatMyr(Number(lead.estimated_value_myr))}
                            </p>
                          ) : null}
                          {lead.assigned_to ? (
                            <p className="mt-1 text-[10px] text-ink-muted">
                              {assigneeNames.get(lead.assigned_to) ?? "Assigned"}
                            </p>
                          ) : null}
                          {overdue ? (
                            <p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                              Overdue
                            </p>
                          ) : null}
                        </Link>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
