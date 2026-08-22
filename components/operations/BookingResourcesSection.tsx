"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, MapPin, Pencil, Trash2 } from "lucide-react";
import { type OperationsBookingResourceRow } from "@/lib/operations/schemas";
import { InlineFeedback } from "@/components/ui/alert";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<OperationsBookingResourceRow | null>(null);

  useEffect(() => {
    const handler = () => setShowAddModal(true);
    window.addEventListener("operations:add-resource", handler);
    return () => window.removeEventListener("operations:add-resource", handler);
  }, []);

  // ── Add resource form state ──────────────────────────────────
  const [resourceName, setResourceName] = useState("");
  const [resourceBuffer, setResourceBuffer] = useState("0");
  const [resourceEmployeeId, setResourceEmployeeId] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Edit (staff assignment) form state ───────────────────────
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  const resetAddForm = () => {
    setResourceName("");
    setResourceBuffer("0");
    setResourceEmployeeId("");
    setFormError(null);
  };

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
        resetAddForm();
        setShowAddModal(false);
        onRefresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setCreating(false);
      }
    },
    [onRefresh, onResourceCreated, resourceBuffer, resourceEmployeeId, resourceName],
  );

  const openEditStaff = (r: OperationsBookingResourceRow) => {
    setEditingResource(r);
    setEditEmployeeId(r.employee_id ?? "");
    setEditError(null);
  };

  const onSaveStaff = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!editingResource) return;
      setEditError(null);
      setEditBusy(true);
      try {
        const res = await fetch(
          `/api/operations/booking-resources/${editingResource.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employee_id: editEmployeeId || null }),
          },
        );
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsBookingResourceRow;
        };
        if (!res.ok || !json.ok || !json.data)
          throw new Error("Could not update staff link.");
        const emp = employees.find((e) => e.id === editEmployeeId);
        onResourceEmployeeUpdated(
          editingResource.id,
          json.data,
          emp?.full_name ?? null,
        );
        setEditingResource(null);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Update failed.");
      } finally {
        setEditBusy(false);
      }
    },
    [editEmployeeId, editingResource, employees, onResourceEmployeeUpdated],
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
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
        Resources
      </h2>

      {/* ── Add resource modal ──────────────────────────────────── */}
      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); resetAddForm(); }}
        size="sm"
      >
        <ModalHeader
          title="Add resource"
          description="A room, equipment slot, or instructor to attach to bookings."
          onClose={() => { setShowAddModal(false); resetAddForm(); }}
        />
        <ModalBody>
          <form id="add-resource-form" onSubmit={onCreateResource} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink dark:text-cream-100">
                Resource name <span className="text-status-danger">*</span>
              </label>
              <input
                type="text"
                value={resourceName}
                onChange={(e) => setResourceName(e.target.value)}
                placeholder="e.g. Room 1, Baking oven, Chair A"
                required
                className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink dark:text-cream-100">
                Cleanup / buffer time
              </label>
              <p className="text-[11px] text-ink-muted dark:text-cream-400">
                Extra minutes blocked after each booking for cleaning, setup, or travel — no new booking can start until this time passes.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={resourceBuffer}
                  onChange={(e) => setResourceBuffer(e.target.value)}
                  className="w-24 rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                />
                <span className="text-sm text-ink-muted dark:text-cream-400">minutes</span>
                <div className="flex gap-1.5">
                  {[0, 15, 30, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setResourceBuffer(String(m))}
                      className="rounded-md border border-cream-300 px-2 py-1 text-xs font-semibold text-ink-muted hover:border-brand-400 hover:text-brand-700 dark:border-hairline-dark dark:text-cream-400 dark:hover:border-brand-500 dark:hover:text-brand-300"
                    >
                      {m === 0 ? "None" : `${m}m`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {employees.length > 0 ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink dark:text-cream-100">
                  Linked staff member
                </label>
                <p className="text-[11px] text-ink-muted dark:text-cream-400">
                  Optional — link to an HR employee so bookings are automatically blocked when they are on approved leave.
                </p>
                <select
                  value={resourceEmployeeId}
                  onChange={(e) => setResourceEmployeeId(e.target.value)}
                  className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                >
                  <option value="">No staff link</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {formError ? <InlineFeedback>{formError}</InlineFeedback> : null}
          </form>
        </ModalBody>
        <ModalFooter>
          <button
            type="submit"
            form="add-resource-form"
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save resource
          </button>
          <button
            type="button"
            onClick={() => { setShowAddModal(false); resetAddForm(); }}
            className="rounded-xl border border-cream-300 px-4 py-2.5 text-sm font-semibold text-ink-muted hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-hairline-dark/40"
          >
            Cancel
          </button>
        </ModalFooter>
      </Modal>

      {/* ── Edit staff modal ────────────────────────────────────── */}
      <Modal
        open={Boolean(editingResource)}
        onClose={() => setEditingResource(null)}
        size="sm"
      >
        <ModalHeader
          title={`Staff for ${editingResource?.name ?? ""}`}
          description="Link this resource to an HR employee to block bookings during leave."
          onClose={() => setEditingResource(null)}
        />
        <ModalBody>
          <form id="edit-staff-form" onSubmit={onSaveStaff} className="space-y-3">
            <select
              value={editEmployeeId}
              onChange={(e) => setEditEmployeeId(e.target.value)}
              className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <option value="">No staff link</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
            {editError ? <InlineFeedback>{editError}</InlineFeedback> : null}
          </form>
        </ModalBody>
        <ModalFooter>
          <button
            type="submit"
            form="edit-staff-form"
            disabled={editBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {editBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditingResource(null)}
            className="rounded-xl border border-cream-300 px-4 py-2.5 text-sm font-semibold text-ink-muted hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-hairline-dark/40"
          >
            Cancel
          </button>
        </ModalFooter>
      </Modal>

      {/* ── Resource pills ──────────────────────────────────────── */}
      {resources.length === 0 ? (
        <p className="text-sm text-ink-muted dark:text-cream-400">
          No resources yet — add a room, chair, or instructor slot.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {resources.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-xl border border-cream-200 bg-white px-3 py-2 text-xs dark:border-hairline-dark dark:bg-panel-dark"
            >
              <MapPin className="h-3 w-3 shrink-0 text-brand-600 dark:text-brand-300" />
              <div className="min-w-0">
                <p className="font-medium text-ink dark:text-cream-100">
                  {r.name}
                  {r.buffer_minutes > 0 ? (
                    <span className="ml-1 font-normal text-ink-muted dark:text-cream-400">
                      +{r.buffer_minutes}m
                    </span>
                  ) : null}
                </p>
                {employees.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => openEditStaff(r)}
                    className="flex items-center gap-1 text-[10px] text-ink-muted hover:text-brand-700 dark:text-cream-400 dark:hover:text-brand-300"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                    {r.employee_name ?? "No staff"}
                  </button>
                ) : r.employee_name ? (
                  <p className="text-[10px] text-ink-muted dark:text-cream-400">
                    {r.employee_name}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => void deleteResource(r.id)}
                className="ml-1 shrink-0 text-status-danger hover:opacity-75 disabled:opacity-50"
                aria-label={`Remove ${r.name}`}
              >
                {busyId === r.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
