"use client";

import { useCallback, useState, type FormEvent } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import {
  type OperationsBookingResourceRow,
} from "@/lib/operations/schemas";

interface BookingEmployee {
  id: string;
  full_name: string;
}

interface BookingResourcesSectionProps {
  resources: OperationsBookingResourceRow[];
  employees: BookingEmployee[];
  onResourceCreated: (resource: OperationsBookingResourceRow) => void;
  onResourceDeleted: (id: string) => void;
  onResourceEmployeeUpdated: (
    id: string,
    data: OperationsBookingResourceRow,
    employeeName: string | null,
  ) => void;
  onRefresh: () => void;
}

export function BookingResourcesSection({
  resources,
  employees,
  onResourceCreated,
  onResourceDeleted,
  onResourceEmployeeUpdated,
  onRefresh,
}: BookingResourcesSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [resourceName, setResourceName] = useState("");
  const [resourceBuffer, setResourceBuffer] = useState("0");
  const [resourceEmployeeId, setResourceEmployeeId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onCreateResource = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCreating(true);
      try {
        const res = await fetch("/api/operations/booking-resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: resourceName,
            buffer_minutes: Number(resourceBuffer) || 0,
            employee_id: resourceEmployeeId || null,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsBookingResourceRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not save resource.");
        }
        onResourceCreated(json.data);
        setResourceName("");
        setResourceBuffer("0");
        setResourceEmployeeId("");
        setShowForm(false);
        onRefresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setCreating(false);
      }
    },
    [onRefresh, onResourceCreated, resourceBuffer, resourceEmployeeId, resourceName],
  );

  const updateResourceEmployee = useCallback(
    async (resourceId: string, employeeId: string | null) => {
      setBusyId(resourceId);
      try {
        const res = await fetch(`/api/operations/booking-resources/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employee_id: employeeId }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsBookingResourceRow;
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error("Could not update staff link.");
        }
        const emp = employees.find((e) => e.id === employeeId);
        onResourceEmployeeUpdated(resourceId, json.data, emp?.full_name ?? null);
      } finally {
        setBusyId(null);
      }
    },
    [employees, onResourceEmployeeUpdated],
  );

  const deleteResource = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/operations/booking-resources/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed.");
        onResourceDeleted(id);
        onRefresh();
      } finally {
        setBusyId(null);
      }
    },
    [onRefresh, onResourceDeleted],
  );

  return (
    <section className="space-y-3 rounded-xl border border-cream-200 bg-white p-3 dark:border-hairline-dark dark:bg-panel-dark sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
          Resources
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Add resource
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={onCreateResource}
          className="grid gap-3 rounded-lg border border-cream-200 bg-white p-4 sm:grid-cols-3 dark:border-hairline-dark dark:bg-panel-dark"
        >
          <input
            type="text"
            value={resourceName}
            onChange={(e) => setResourceName(e.target.value)}
            placeholder="Resource name (e.g. Room 1) *"
            required
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          <input
            type="number"
            min={0}
            value={resourceBuffer}
            onChange={(e) => setResourceBuffer(e.target.value)}
            placeholder="Buffer (minutes)"
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          {employees.length > 0 ? (
            <select
              value={resourceEmployeeId}
              onChange={(e) => setResourceEmployeeId(e.target.value)}
              className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <option value="">No staff link</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          ) : null}
          {formError ? (
            <p className="col-span-full text-sm text-status-danger">{formError}</p>
          ) : null}
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            Save resource
          </button>
        </form>
      ) : null}

      {resources.length === 0 ? (
        <p className="text-sm text-ink-muted dark:text-cream-400">
          No resources yet — add a room, chair, or instructor slot.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {resources.map((r) => (
            <li
              key={r.id}
              className="inline-flex items-center gap-2 rounded-full border border-cream-200 bg-white px-3 py-1.5 text-xs dark:border-hairline-dark dark:bg-panel-dark"
            >
              <MapPin className="h-3 w-3 text-brand-600 dark:text-brand-300" />
              <span className="font-medium text-ink dark:text-cream-100">
                {r.name}
              </span>
              {r.buffer_minutes > 0 ? (
                <span className="text-ink-muted dark:text-cream-400">
                  +{r.buffer_minutes}m buffer
                </span>
              ) : null}
              {employees.length > 0 ? (
                <select
                  value={r.employee_id ?? ""}
                  disabled={busyId === r.id}
                  onChange={(e) =>
                    void updateResourceEmployee(r.id, e.target.value || null)
                  }
                  className="max-w-[8rem] rounded border border-cream-200 bg-transparent px-1 py-0.5 text-[10px] dark:border-hairline-dark"
                  aria-label={`Staff for ${r.name}`}
                >
                  <option value="">Staff</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name}
                    </option>
                  ))}
                </select>
              ) : r.employee_name ? (
                <span className="text-ink-muted dark:text-cream-400">
                  · {r.employee_name}
                </span>
              ) : null}
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => void deleteResource(r.id)}
                className="text-status-danger hover:underline disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
