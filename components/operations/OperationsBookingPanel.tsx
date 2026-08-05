"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import { AdminStorageFileAttach } from "@/components/admin/AdminStorageFileAttach";
import { BookingListFilters } from "@/components/operations/BookingListFilters";
import {
  OperationsCatalogEditShell,
  OperationsCatalogList,
  OperationsCatalogThumb,
} from "@/components/operations/OperationsCatalogUi";
import {
  QuickActionBar,
  QuickCreateActions,
  QuickCreatePanel,
} from "@/components/ui/quick-create";
import { useQuickCreate } from "@/hooks/use-quick-create";
import {
  bookingStatusLabel,
  formatBookingWhen,
  formatOrderAmount,
  type OperationsBookingResourceRow,
  type OperationsBookingRow,
  type OperationsBookingStatus,
  type OperationsServiceRow,
} from "@/lib/operations/schemas";
import { cn } from "@/lib/utils/cn";

interface OperationsBookingPanelProps {
  initialBookings: OperationsBookingRow[];
  initialResources: OperationsBookingResourceRow[];
  initialServices: OperationsServiceRow[];
}

const STATUS_TONE: Record<
  OperationsBookingStatus,
  string
> = {
  held: "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
  confirmed:
    "bg-status-warning/15 text-status-warning dark:bg-status-warning/10",
  completed:
    "bg-status-success/15 text-status-success dark:bg-status-success/10",
  cancelled: "bg-cream-100 text-ink-subtle line-through dark:bg-panel-dark",
};

function toMalaysiaYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(d);
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextStatus(
  current: OperationsBookingStatus,
): OperationsBookingStatus | null {
  switch (current) {
    case "held":
      return "confirmed";
    case "confirmed":
      return "completed";
    default:
      return null;
  }
}

export function OperationsBookingPanel({
  initialBookings,
  initialResources,
  initialServices,
}: OperationsBookingPanelProps) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initialBookings);
  const [resources, setResources] = useState(initialResources);
  const { open: showForm, toggle: toggleForm, close: closeForm } =
    useQuickCreate();
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [amountMyr, setAmountMyr] = useState("");
  const [notes, setNotes] = useState("");
  const [resourceName, setResourceName] = useState("");
  const [resourceBuffer, setResourceBuffer] = useState("0");
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

  const startEditBooking = useCallback((booking: OperationsBookingRow) => {
    setEditingBookingId(booking.id);
    setCustomerName(booking.customer_name);
    setCustomerPhone(booking.customer_phone ?? "");
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
  }, [closeForm]);

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
  }, []);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return bookings.filter(
      (b) =>
        b.status !== "cancelled" &&
        b.status !== "completed" &&
        new Date(b.starts_at).getTime() >= now - 60 * 60 * 1000,
    );
  }, [bookings]);

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
        setResources((prev) =>
          [...prev, json.data!].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setResourceName("");
        setResourceBuffer("0");
        setShowResourceForm(false);
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setCreating(false);
      }
    },
    [refresh, resourceBuffer, resourceName],
  );

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
            {
              ...json.data!,
              resource_name: resource?.name ?? null,
            },
          ].sort(
            (a, b) =>
              new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
          ),
        );
        setCustomerName("");
        setCustomerPhone("");
        setServiceTitle("");
        setServiceId("");
        setResourceId("");
        setStartsAt("");
        setEndsAt("");
        setAmountMyr("");
        setNotes("");
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
      customerName,
      customerPhone,
      endsAt,
      notes,
      refresh,
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
      const next = nextStatus(booking.status);
      if (!next) return;
      setBusyId(booking.id);
      try {
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

  const deleteResource = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/operations/booking-resources/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed.");
        setResources((prev) => prev.filter((r) => r.id !== id));
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
      <section className="space-y-3 rounded-xl border border-cream-200 bg-white p-3 dark:border-hairline-dark dark:bg-panel-dark sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
            Resources
          </h2>
          <button
            type="button"
            onClick={() => setShowResourceForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Add resource
          </button>
        </div>

        {showResourceForm ? (
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

      <QuickActionBar
        open={showForm}
        onToggle={() => {
          if (showForm) {
            closeForm();
            resetBookingForm();
          } else {
            resetBookingForm();
            toggleForm();
          }
        }}
        actionLabel="New booking"
      />

      <QuickCreatePanel
        open={showForm}
        onSubmit={onCreateBooking}
        title="New booking"
        subtitle="Customer, service, and time slot."
        icon={Calendar}
        accent="violet"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer name *"
            required
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Phone / WhatsApp"
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
        </div>
        <input
          type="text"
          value={serviceTitle}
          onChange={(e) => setServiceTitle(e.target.value)}
          placeholder="Service (e.g. Haircut, Homestay night) *"
          required
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        {activeServices.length > 0 ? (
          <select
            value={serviceId}
            onChange={(e) => applyServiceSelection(e.target.value)}
            className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            <option value="">Pick from catalogue (optional)</option>
            {activeServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.duration_minutes}m
                {s.price_myr != null ? ` · RM${s.price_myr}` : ""}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        >
          <option value="">No resource / walk-in</option>
          {resources
            .filter((r) => r.is_active)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="mb-1 block text-ink-muted dark:text-cream-400">
              Starts *
            </span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => {
                const value = e.target.value;
                setStartsAt(value);
                if (serviceId && value) {
                  applyServiceSelection(serviceId, value);
                }
              }}
              required
              className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-ink-muted dark:text-cream-400">
              Ends *
            </span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
              className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </label>
        </div>
        {startsAt ? (
          <div className="flex flex-wrap gap-2">
            {[30, 60, 90].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => applySlotMinutes(mins)}
                className="rounded-md border border-cream-300 px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-panel-dark"
              >
                {mins}m slot
              </button>
            ))}
          </div>
        ) : null}
        <input
          type="number"
          min={0}
          step="0.01"
          value={amountMyr}
          onChange={(e) => setAmountMyr(e.target.value)}
          placeholder="Amount (MYR, optional)"
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          rows={2}
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        {formError ? (
          <p className="text-sm text-status-danger">{formError}</p>
        ) : null}
        <QuickCreateActions
          submitLabel="Save booking"
          loading={creating}
          onCancel={() => {
            closeForm();
            resetBookingForm();
          }}
        />
      </QuickCreatePanel>

      {editingBookingId ? (
        <OperationsCatalogEditShell title="Reschedule booking" accent="violet">
          <form onSubmit={onUpdateBooking} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name *"
                required
                className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone / WhatsApp"
                className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              />
            </div>
            <input
              type="text"
              value={serviceTitle}
              onChange={(e) => setServiceTitle(e.target.value)}
              placeholder="Service *"
              required
              className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <option value="">No resource / walk-in</option>
              {resources
                .filter((r) => r.is_active)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block text-ink-muted dark:text-cream-400">
                  Starts *
                </span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                  className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-ink-muted dark:text-cream-400">
                  Ends *
                </span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                  className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                />
              </label>
            </div>
            {formError ? (
              <p className="text-sm text-status-danger">{formError}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save changes
              </button>
              <button
                type="button"
                onClick={resetBookingForm}
                className="rounded-md border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </OperationsCatalogEditShell>
      ) : null}

      {displayedBookings.length === 0 ? (
        <OperationsCatalogList
          title={viewMode === "week" ? "Day schedule" : "Schedule"}
          total={0}
          filters={bookingListFilters}
        >
          <div className="px-5 py-14 text-center">
            <p className="text-4xl" aria-hidden>
              📅
            </p>
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
          total={displayedBookings.length}
          filters={bookingListFilters}
        >
          <ul className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {displayedBookings.map((b) => {
              const busy = busyId === b.id;
              const next = nextStatus(b.status);
              const amount = formatOrderAmount(
                b.amount_myr != null ? Number(b.amount_myr) : null,
              );
              return (
                <li
                  key={b.id}
                  className="group px-3 py-2.5 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/60"
                >
                  <div className="flex items-start gap-3">
                    <OperationsCatalogThumb emoji="📅" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-ink-muted dark:text-cream-400">
                          {b.number}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_TONE[b.status]}`}
                        >
                          {bookingStatusLabel(b.status)}
                        </span>
                      </div>
                      <h3 className="mt-0.5 text-sm font-semibold text-ink dark:text-cream-100">
                        {b.service_title}
                      </h3>
                      <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                        {b.customer_name}
                        {b.resource_name ? ` · ${b.resource_name}` : ""}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted dark:text-cream-500">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {formatBookingWhen(b.starts_at, b.ends_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {amount ? (
                        <span className="text-sm font-bold tabular-nums text-ink dark:text-cream-100">
                          {amount}
                        </span>
                      ) : null}
                      {next ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void advanceStatus(b)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          {bookingStatusLabel(next)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {b.status !== "cancelled" && b.status !== "completed" ? (
                    <div className="mt-2 flex flex-wrap gap-2 pl-[3.75rem]">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEditBooking(b)}
                        className="text-[11px] font-semibold text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cancelBooking(b.id)}
                        className="text-[11px] text-status-danger hover:underline disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </OperationsCatalogList>
      )}
    </div>
  );
}
