"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { BookingEditForm } from "@/components/operations/BookingEditForm";
import { BookingListFilters } from "@/components/operations/BookingListFilters";
import { BookingListItem } from "@/components/operations/BookingListItem";
import { BookingResourcesSection } from "@/components/operations/BookingResourcesSection";
import { OperationsCatalogList } from "@/components/operations/OperationsCatalogUi";
import { ListPagination } from "@/components/ui/list-pagination";
import { QuickCreateActions } from "@/components/ui/quick-create";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { InlineFeedback } from "@/components/ui/alert";
import { CustomerPicker, type CustomerPickerValue } from "@/components/operations/CustomerPicker";
import { useQuickCreate } from "@/hooks/use-quick-create";
import {
  type OperationsBookingResourceRow,
  type OperationsBookingRow,
  type OperationsServiceRow,
} from "@/lib/operations/schemas";
import type { OperationsLeaveBlockRow } from "@/lib/operations/leave-blocks";

interface BookingEmployee {
  id: string;
  full_name: string;
}

interface OperationsBookingPanelProps {
  initialBookings: OperationsBookingRow[];
  initialResources: OperationsBookingResourceRow[];
  initialServices: OperationsServiceRow[];
  employees?: BookingEmployee[];
  leaveBlocks?: OperationsLeaveBlockRow[];
  page?: number;
  pageSize?: number;
  total?: number;
}

function toMalaysiaYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(d);
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OperationsBookingPanel({
  initialBookings,
  initialResources,
  initialServices,
  employees = [],
  leaveBlocks = [],
  page = 1,
  pageSize = 10,
  total = 0,
}: OperationsBookingPanelProps) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initialBookings);
  const [resources, setResources] = useState(initialResources);
  const { open: showForm, close: closeForm, openPanel: openForm } =
    useQuickCreate();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [linkedCustomer, setLinkedCustomer] = useState<CustomerPickerValue | null>(null);
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [amountMyr, setAmountMyr] = useState("");
  const [notes, setNotes] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "week">("list");
  const [selectedDay, setSelectedDay] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(
      new Date(),
    ),
  );

  const weekDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const day = b.starts_at.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    return map;
  }, [bookings]);

  const displayedBookings = useMemo(() => {
    if (viewMode === "list") return bookings;
    return bookings.filter((b) => b.starts_at.slice(0, 10) === selectedDay);
  }, [bookings, selectedDay, viewMode]);

  const refresh = useCallback(() => router.refresh(), [router]);

  const activeServices = useMemo(
    () => initialServices.filter((s) => s.is_active),
    [initialServices],
  );

  const applyServiceSelection = useCallback(
    (id: string, startValue?: string) => {
      setServiceId(id);
      if (!id) return;
      const svc = initialServices.find((s) => s.id === id);
      if (!svc) return;
      setServiceTitle(svc.name);
      setAmountMyr(svc.price_myr != null ? String(svc.price_myr) : "");
      const start = startValue ?? startsAt;
      if (start) {
        const end = new Date(
          new Date(start).getTime() + svc.duration_minutes * 60_000,
        );
        setEndsAt(toDatetimeLocal(end));
      }
    },
    [initialServices, startsAt],
  );

  const applySlotMinutes = useCallback(
    (minutes: number) => {
      if (!startsAt) return;
      const end = new Date(new Date(startsAt).getTime() + minutes * 60_000);
      setEndsAt(toDatetimeLocal(end));
    },
    [startsAt],
  );

  const startEditBooking = useCallback(
    (booking: OperationsBookingRow) => {
      setEditingBookingId(booking.id);
      setCustomerName(booking.customer_name);
      setCustomerPhone(booking.customer_phone ?? "");
      setLinkedCustomer(
        booking.customer_id
          ? { id: booking.customer_id, name: booking.customer_name, phone_e164: booking.customer_phone }
          : null,
      );
      setServiceTitle(booking.service_title);
      setServiceId(booking.service_id ?? "");
      setResourceId(booking.resource_id ?? "");
      setStartsAt(toDatetimeLocal(new Date(booking.starts_at)));
      setEndsAt(toDatetimeLocal(new Date(booking.ends_at)));
      setAmountMyr(
        booking.amount_myr != null ? String(booking.amount_myr) : "",
      );
      setNotes(booking.notes ?? "");
      closeForm();
      setFormError(null);
    },
    [closeForm],
  );

  const resetBookingForm = useCallback(() => {
    setCustomerName("");
    setCustomerPhone("");
    setServiceTitle("");
    setServiceId("");
    setResourceId("");
    setStartsAt("");
    setEndsAt("");
    setAmountMyr("");
    setNotes("");
    setEditingBookingId(null);
    setFormError(null);
    setLinkedCustomer(null);
  }, []);

  useEffect(() => {
    const handler = () => { resetBookingForm(); openForm(); };
    window.addEventListener("operations:new-booking", handler);
    return () => window.removeEventListener("operations:new-booking", handler);
  }, [resetBookingForm, openForm]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return bookings.filter(
      (b) =>
        b.status !== "cancelled" &&
        b.status !== "completed" &&
        new Date(b.starts_at).getTime() >= now - 60 * 60 * 1000,
    );
  }, [bookings]);

  const onCreateBooking = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      if (!startsAt || !endsAt) {
        setFormError("Start and end time are required.");
        return;
      }
      setCreating(true);
      try {
        const res = await fetch("/api/operations/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: linkedCustomer?.id ?? null,
            customer_name: customerName,
            customer_phone: customerPhone || null,
            service_title: serviceTitle,
            service_id: serviceId || null,
            resource_id: resourceId || null,
            starts_at: new Date(startsAt).toISOString(),
            ends_at: new Date(endsAt).toISOString(),
            amount_myr: amountMyr === "" ? null : Number(amountMyr),
            notes: notes || null,
            status: "held",
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsBookingRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not save booking.");
        }
        const resource = resources.find((r) => r.id === json.data!.resource_id);
        setBookings((prev) =>
          [
            ...prev,
            { ...json.data!, resource_name: resource?.name ?? null },
          ].sort(
            (a, b) =>
              new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
          ),
        );
        resetBookingForm();
        closeForm();
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setCreating(false);
      }
    },
    [
      amountMyr,
      closeForm,
      customerName,
      customerPhone,
      endsAt,
      notes,
      refresh,
      resetBookingForm,
      resourceId,
      resources,
      serviceId,
      serviceTitle,
      startsAt,
    ],
  );

  const onUpdateBooking = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!editingBookingId) return;
      setFormError(null);
      if (!startsAt || !endsAt) {
        setFormError("Start and end time are required.");
        return;
      }
      setCreating(true);
      try {
        const res = await fetch(
          `/api/operations/bookings/${editingBookingId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_id: linkedCustomer?.id ?? null,
              customer_name: customerName,
              customer_phone: customerPhone || null,
              service_title: serviceTitle,
              service_id: serviceId || null,
              resource_id: resourceId || null,
              starts_at: new Date(startsAt).toISOString(),
              ends_at: new Date(endsAt).toISOString(),
              amount_myr: amountMyr === "" ? null : Number(amountMyr),
              notes: notes || null,
            }),
          },
        );
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsBookingRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not update booking.");
        }
        const resource = resources.find((r) => r.id === json.data!.resource_id);
        setBookings((prev) =>
          prev
            .map((b) =>
              b.id === editingBookingId
                ? { ...json.data!, resource_name: resource?.name ?? null }
                : b,
            )
            .sort(
              (a, b) =>
                new Date(a.starts_at).getTime() -
                new Date(b.starts_at).getTime(),
            ),
        );
        resetBookingForm();
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Update failed.");
      } finally {
        setCreating(false);
      }
    },
    [
      amountMyr,
      customerName,
      customerPhone,
      editingBookingId,
      endsAt,
      notes,
      refresh,
      resetBookingForm,
      resourceId,
      resources,
      serviceId,
      serviceTitle,
      startsAt,
    ],
  );

  const advanceStatus = useCallback(
    async (booking: OperationsBookingRow) => {
      setBusyId(booking.id);
      try {
        const next =
          booking.status === "held"
            ? "confirmed"
            : booking.status === "confirmed"
              ? "completed"
              : null;
        if (!next) return;
        const res = await fetch(`/api/operations/bookings/${booking.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) throw new Error("Update failed.");
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsBookingRow;
        };
        if (json.data) {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === booking.id
                ? { ...json.data!, resource_name: b.resource_name }
                : b,
            ),
          );
        }
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const cancelBooking = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/operations/bookings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        });
        if (!res.ok) throw new Error("Cancel failed.");
        setBookings((prev) =>
          prev.map((b) =>
            b.id === id ? { ...b, status: "cancelled" as const } : b,
          ),
        );
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const bookingListFilters = (
    <BookingListFilters
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      upcomingCount={upcoming.length}
      weekDays={weekDays}
      selectedDay={selectedDay}
      bookingsByDay={bookingsByDay}
      onSelectDay={setSelectedDay}
      toMalaysiaYmd={toMalaysiaYmd}
    />
  );

  return (
    <div className="space-y-4">
      {leaveBlocks.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Staff on approved leave</p>
          <ul className="mt-2 space-y-1 text-xs">
            {leaveBlocks.map((block) => (
              <li key={block.id}>
                {block.employee_name}: {block.starts_on} → {block.ends_on}
                {block.reason ? ` · ${block.reason}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">
            Link each resource to an HR employee below to block bookings during
            leave.
          </p>
        </div>
      ) : null}

      <BookingResourcesSection
        resources={resources}
        employees={employees}
        onResourceCreated={(resource) =>
          setResources((prev) =>
            [...prev, resource].sort((a, b) => a.name.localeCompare(b.name)),
          )
        }
        onResourceDeleted={(id) =>
          setResources((prev) => prev.filter((r) => r.id !== id))
        }
        onResourceEmployeeUpdated={(id, data, employeeName) =>
          setResources((prev) =>
            prev.map((r) =>
              r.id === id ? { ...data, employee_name: employeeName } : r,
            ),
          )
        }
        onRefresh={refresh}
      />

      {/* ── New booking modal ─────────────────────────────────────── */}
      <Modal open={showForm} onClose={() => { closeForm(); resetBookingForm(); }} size="lg">
        <ModalHeader
          title="New booking"
          description="Customer, service, and time slot."
          onClose={() => { closeForm(); resetBookingForm(); }}
        />
        <ModalBody>
          <form id="new-booking-form" onSubmit={onCreateBooking} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <CustomerPicker
                customerName={customerName}
                onCustomerNameChange={setCustomerName}
                linkedCustomer={linkedCustomer}
                onLink={(c) => { setLinkedCustomer(c); setCustomerPhone(c.phone_e164 ?? ""); }}
                onUnlink={() => setLinkedCustomer(null)}
                required
              />
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone / WhatsApp" className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
            </div>
            <input type="text" value={serviceTitle} onChange={(e) => setServiceTitle(e.target.value)} placeholder="Service (e.g. Haircut, Homestay night) *" required className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
            {activeServices.length > 0 ? (
              <select value={serviceId} onChange={(e) => applyServiceSelection(e.target.value)} className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100">
                <option value="">Pick from catalogue (optional)</option>
                {activeServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}m{s.price_myr != null ? ` · RM${s.price_myr}` : ""}</option>
                ))}
              </select>
            ) : null}
            <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100">
              <option value="">No resource / walk-in</option>
              {resources.filter((r) => r.is_active).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block text-ink-muted dark:text-cream-400">Starts *</span>
                <input type="datetime-local" value={startsAt} onChange={(e) => { const v = e.target.value; setStartsAt(v); if (serviceId && v) applyServiceSelection(serviceId, v); }} required className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-ink-muted dark:text-cream-400">Ends *</span>
                <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
              </label>
            </div>
            {startsAt ? (
              <div className="flex flex-wrap gap-2">
                {[30, 60, 90].map((mins) => (
                  <button key={mins} type="button" onClick={() => applySlotMinutes(mins)} className="rounded-md border border-cream-300 px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-panel-dark">{mins}m slot</button>
                ))}
              </div>
            ) : null}
            <input type="number" min={0} step="0.01" value={amountMyr} onChange={(e) => setAmountMyr(e.target.value)} placeholder="Amount (MYR, optional)" className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
            {formError ? <InlineFeedback>{formError}</InlineFeedback> : null}
          </form>
        </ModalBody>
        <ModalFooter>
          <QuickCreateActions submitLabel="Save booking" loading={creating} onCancel={() => { closeForm(); resetBookingForm(); }} form="new-booking-form" />
        </ModalFooter>
      </Modal>

      {/* ── Reschedule modal ──────────────────────────────────────── */}
      <Modal open={Boolean(editingBookingId)} onClose={resetBookingForm} size="lg">
        <ModalHeader title="Reschedule booking" description="Update customer, time, or resource." onClose={resetBookingForm} />
        <ModalBody>
          <form id="reschedule-form" onSubmit={onUpdateBooking} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <CustomerPicker
                customerName={customerName}
                onCustomerNameChange={setCustomerName}
                linkedCustomer={linkedCustomer}
                onLink={(c) => { setLinkedCustomer(c); setCustomerPhone(c.phone_e164 ?? ""); }}
                onUnlink={() => setLinkedCustomer(null)}
                required
              />
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone / WhatsApp" className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
            </div>
            <input type="text" value={serviceTitle} onChange={(e) => setServiceTitle(e.target.value)} placeholder="Service *" required className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
            <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100">
              <option value="">No resource / walk-in</option>
              {resources.filter((r) => r.is_active).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block text-ink-muted dark:text-cream-400">Starts *</span>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-ink-muted dark:text-cream-400">Ends *</span>
                <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
              </label>
            </div>
            <input type="number" min={0} step="0.01" value={amountMyr} onChange={(e) => setAmountMyr(e.target.value)} placeholder="Amount (MYR, optional)" className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100" />
            {formError ? <InlineFeedback>{formError}</InlineFeedback> : null}
          </form>
        </ModalBody>
        <ModalFooter>
          <QuickCreateActions submitLabel="Save changes" loading={creating} onCancel={resetBookingForm} form="reschedule-form" />
        </ModalFooter>
      </Modal>

      {displayedBookings.length === 0 ? (
        <OperationsCatalogList
          title={viewMode === "week" ? "Day schedule" : "Schedule"}
          total={0}
          filters={bookingListFilters}
        >
          <div className="px-5 py-14 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cream-200 bg-cream-50 text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400" aria-hidden>
              <Calendar className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink dark:text-cream-100">
              {viewMode === "week"
                ? "No bookings on this day"
                : "No bookings yet"}
            </p>
            <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
              {viewMode === "week"
                ? "Pick another day or switch to list view."
                : "Tap New booking to schedule your first appointment."}
            </p>
          </div>
        </OperationsCatalogList>
      ) : (
        <OperationsCatalogList
          title={viewMode === "week" ? "Day schedule" : "Schedule"}
          total={viewMode === "list" ? total : displayedBookings.length}
          filters={bookingListFilters}
        >
          <ul className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {displayedBookings.map((b) => (
              <BookingListItem
                key={b.id}
                booking={b}
                busy={busyId === b.id}
                onAdvanceStatus={(booking) => void advanceStatus(booking)}
                onEdit={startEditBooking}
                onCancel={(id) => void cancelBooking(id)}
              />
            ))}
          </ul>
        </OperationsCatalogList>
      )}

      {viewMode === "list" ? (
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          basePath="/operations/bookings"
          searchParams={{}}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      ) : null}
    </div>
  );
}
