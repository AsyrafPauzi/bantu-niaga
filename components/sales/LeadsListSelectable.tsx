"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { AdminCatalogEmpty } from "@/components/admin/AdminCatalogUi";
import {
  ModuleListPanel,
  ModuleListPanelFooter,
  ModuleListTable,
  ModuleListTableBody,
  ModuleListTableHead,
  MODULE_LIST_TABLE_ROW_CLASS,
} from "@/components/dashboard/module-list-panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { ListPagination } from "@/components/ui/list-pagination";
import { formatMyr } from "@/lib/marketing/metrics";
import {
  LEAD_STATUSES,
  type LeadStatus,
} from "@/lib/sales/schemas";
import { cn } from "@/lib/utils/cn";

export type LeadListRow = {
  id: string;
  name: string;
  phone_e164: string;
  status: LeadStatus;
  follow_up_at: string | null;
  assigned_to: string | null;
  estimated_value_myr: number | string | null;
};

type Assignee = { user_id: string; display_name: string | null; role: string };

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

interface LeadsListSelectableProps {
  leads: LeadListRow[];
  total: number;
  assigneeNames: Map<string, string>;
  assignees: Assignee[];
  overdueBeforeIso: string;
  pagination: { page: number; pageSize: number };
  searchParamsForPagination: Record<string, string | undefined>;
  embedded?: boolean;
}

function toDateInput(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function LeadsListSelectable({
  leads,
  total,
  assigneeNames,
  assignees,
  overdueBeforeIso,
  pagination,
  searchParamsForPagination,
  embedded = false,
}: LeadsListSelectableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<LeadStatus | "">("");
  const [bulkAssignee, setBulkAssignee] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pageIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setBulkStatus("");
    setBulkAssignee("");
    setError(null);
  }

  async function applyBulk() {
    const lead_ids = [...selected];
    if (lead_ids.length === 0) return;

    const body: Record<string, unknown> = { lead_ids };
    if (bulkStatus) body.status = bulkStatus;
    if (bulkAssignee === "__unassign__") body.unassign = true;
    else if (bulkAssignee) body.assigned_to = bulkAssignee;

    if (!body.status && !body.assigned_to && !body.unassign) {
      setError("Choose a status or assignee to apply.");
      return;
    }

    setError(null);
    try {
      const res = await fetch("/api/sales/leads/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        message?: string;
        updated?: number;
      } | null;

      if (!res.ok) {
        setError(json?.message ?? json?.error ?? `Update failed (${res.status})`);
        return;
      }

      startTransition(() => {
        clearSelection();
        router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  }

  if (leads.length === 0) {
    const empty = (
      <div className="px-5 py-14 text-center">
        <AdminCatalogEmpty
          icon={Users}
          title={embedded ? "No leads match" : "No leads yet"}
          hint={
            embedded
              ? "Try another filter or create a new lead."
              : "Create one to start chasing prospects."
          }
          className="border-blue-200/80 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/15"
        />
      </div>
    );
    if (embedded) return empty;
    return <ModuleListPanel>{empty}</ModuleListPanel>;
  }

  const listBody = (
    <>
      {someSelected ? (
        <div className="flex flex-col gap-3 border-b border-blue-200 bg-blue-50/60 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/20 sm:px-5">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            {selected.size} selected
            <button
              type="button"
              onClick={clearSelection}
              className="ml-2 text-xs font-medium text-[#2563EB] underline-offset-2 hover:underline dark:text-blue-300"
            >
              Clear
            </button>
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="font-medium text-ink-muted">Status</span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as LeadStatus | "")}
                className="mt-1 block rounded-lg border border-cream-300 px-2 py-1.5 text-sm dark:border-hairline-dark dark:bg-panel-dark"
              >
                <option value="">No change</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="font-medium text-ink-muted">Assignee</span>
              <select
                value={bulkAssignee}
                onChange={(e) => setBulkAssignee(e.target.value)}
                className="mt-1 block rounded-lg border border-cream-300 px-2 py-1.5 text-sm dark:border-hairline-dark dark:bg-panel-dark"
              >
                <option value="">No change</option>
                <option value="__unassign__">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a.user_id} value={a.user_id}>
                    {a.display_name || a.role}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void applyBulk()}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Apply to selected
            </button>
          </div>
          {error ? (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <ModuleListTable>
        <ModuleListTableHead>
          <tr>
            <th className="w-10 px-3 py-3">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={togglePage}
                aria-label="Select all on this page"
                className="h-4 w-4 rounded border-cream-300 text-[#2563EB]"
              />
            </th>
            <th className="px-3 py-3 text-left">Lead</th>
            <th className="px-3 py-3 text-left">Phone</th>
            <th className="px-3 py-3 text-left">Assignee</th>
            <th className="px-3 py-3 text-left">Follow-up</th>
            <th className="px-3 py-3 text-left">Status</th>
            <th className="px-5 py-3 text-right">Value</th>
          </tr>
        </ModuleListTableHead>
        <ModuleListTableBody>
          {leads.map((lead) => {
            const overdue =
              lead.follow_up_at &&
              lead.status !== "won" &&
              lead.status !== "lost" &&
              new Date(lead.follow_up_at) < new Date(overdueBeforeIso);
            const checked = selected.has(lead.id);
            return (
              <tr
                key={lead.id}
                className={cn(
                  MODULE_LIST_TABLE_ROW_CLASS,
                  checked && "bg-blue-50/40 dark:bg-blue-950/10",
                )}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOne(lead.id)}
                    aria-label={`Select ${lead.name}`}
                    className="h-4 w-4 rounded border-cream-300 text-[#2563EB]"
                  />
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/sales/leads/${lead.id}`}
                    className="font-semibold text-ink hover:text-[#2563EB] dark:text-cream-100"
                  >
                    {lead.name}
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs text-ink-muted dark:text-cream-400">
                  {lead.phone_e164}
                </td>
                <td className="px-3 py-3 text-xs text-ink-muted dark:text-cream-400">
                  {lead.assigned_to
                    ? (assigneeNames.get(lead.assigned_to) ?? "Assigned")
                    : "—"}
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-xs",
                    overdue
                      ? "font-semibold text-rose-700 dark:text-rose-300"
                      : "text-ink-muted dark:text-cream-400",
                  )}
                >
                  {lead.follow_up_at
                    ? toDateInput(lead.follow_up_at)
                    : "—"}
                  {overdue ? " · Overdue" : ""}
                </td>
                <td className="px-3 py-3">
                  <StatusPill tone={STATUS_TONE[lead.status]}>
                    {lead.status}
                  </StatusPill>
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums text-ink-muted dark:text-cream-300">
                  {lead.estimated_value_myr != null
                    ? formatMyr(Number(lead.estimated_value_myr))
                    : "—"}
                </td>
              </tr>
            );
          })}
        </ModuleListTableBody>
      </ModuleListTable>

      {embedded ? (
        <ModuleListPanelFooter className="p-0">
          <ListPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            basePath="/sales/leads"
            searchParams={searchParamsForPagination}
            className="w-full border-0"
          />
        </ModuleListPanelFooter>
      ) : (
        <ListPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={total}
          basePath="/sales/leads"
          searchParams={searchParamsForPagination}
        />
      )}
    </>
  );

  if (embedded) return listBody;
  return <ModuleListPanel>{listBody}</ModuleListPanel>;
}
