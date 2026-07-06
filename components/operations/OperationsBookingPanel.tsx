"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronRight,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import {
  bookingStatusLabel,
  formatBookingWhen,
  formatOrderAmount,
  type OperationsBookingResourceRow,
  type OperationsBookingRow,
  type OperationsBookingStatus,
} from "@/lib/operations/schemas";

interface OperationsBookingPanelProps {
  initialBookings: OperationsBookingRow[];
  initialResources: OperationsBookingResourceRow[];
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
}: OperationsBookingPanelProps) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initialBookings);
  const [resources, setResources] = useState(initialResources);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");
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

  const refresh = useCallback(() => router.refresh(), [router]);

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
        setResourceId("");
        setStartsAt("");
        setEndsAt("");
        setAmountMyr("");
        setNotes("");
        setShowBookingForm(false);
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

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
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

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBookingForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New booking
          </button>
          <span className="text-xs text-ink-muted dark:text-cream-400">
            {upcoming.length} upcoming
          </span>
        </div>

        {showBookingForm ? (
          <form
            onSubmit={onCreateBooking}
            className="space-y-3 rounded-lg border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark"
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
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save booking
              </button>
              <button
                type="button"
                onClick={() => setShowBookingForm(false)}
                className="rounded-md border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-cream-300 py-12 text-center dark:border-hairline-dark">
            <p className="text-sm text-ink-muted dark:text-cream-400">
              No bookings yet. Create your first appointment.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-cream-200 rounded-lg border border-cream-200 bg-white dark:divide-hairline-dark dark:border-hairline-dark dark:bg-panel-dark">
            {bookings.map((b) => {
              const busy = busyId === b.id;
              const next = nextStatus(b.status);
              const amount = formatOrderAmount(
                b.amount_myr != null ? Number(b.amount_myr) : null,
              );
              return (
                <li key={b.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-ink-muted dark:text-cream-400">
                          {b.number}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_TONE[b.status]}`}
                        >
                          {bookingStatusLabel(b.status)}
                        </span>
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-ink dark:text-cream-100">
                        {b.service_title}
                      </h3>
                      <div className="mt-2 space-y-1 text-xs text-ink-muted dark:text-cream-400">
                        <p className="flex items-center gap-1.5">
                          <User className="h-3 w-3 shrink-0" />
                          {b.customer_name}
                        </p>
                        {b.customer_phone ? (
                          <p className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 shrink-0" />
                            {b.customer_phone}
                          </p>
                        ) : null}
                        <p className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {formatBookingWhen(b.starts_at, b.ends_at)}
                        </p>
                        {b.resource_name ? (
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {b.resource_name}
                          </p>
                        ) : null}
                        {amount ? (
                          <p className="font-medium text-ink dark:text-cream-100">
                            {amount}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {next ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void advanceStatus(b)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          Mark {bookingStatusLabel(next)}
                        </button>
                      ) : null}
                      {b.status !== "cancelled" && b.status !== "completed" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void cancelBooking(b.id)}
                          className="text-xs text-status-danger hover:underline disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
