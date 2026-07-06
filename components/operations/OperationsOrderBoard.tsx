"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, Phone, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  formatOrderAmount,
  orderStatusLabel,
  type OperationsOrderRow,
  type OperationsOrderStatus,
  type OperationsSupplierRow,
} from "@/lib/operations/schemas";

interface OperationsOrderBoardProps {
  initialOrders: OperationsOrderRow[];
  suppliers: OperationsSupplierRow[];
}

const COLUMNS: Array<{ status: OperationsOrderStatus; label: string }> = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
];

function fmtDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(iso: string | null, status: OperationsOrderStatus): boolean {
  if (!iso || status === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso + "T00:00:00") < today;
}

function nextStatus(status: OperationsOrderStatus): OperationsOrderStatus {
  if (status === "todo") return "in_progress";
  if (status === "in_progress") return "done";
  return "todo";
}

export function OperationsOrderBoard({
  initialOrders,
  suppliers,
}: OperationsOrderBoardProps) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const byStatus = useMemo(() => {
    const map: Record<OperationsOrderStatus, OperationsOrderRow[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const o of orders) {
      map[o.status].push(o);
    }
    return map;
  }, [orders]);

  const refresh = useCallback(() => router.refresh(), [router]);

  const patchOrder = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/operations/orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsOrderRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Update failed.");
        }
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, ...json.data! } : o)),
        );
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const advanceStatus = useCallback(
    (order: OperationsOrderRow) => {
      void patchOrder(order.id, { status: nextStatus(order.status) });
    },
    [patchOrder],
  );

  const deleteOrder = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/operations/orders/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed.");
        setOrders((prev) => prev.filter((o) => o.id !== id));
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const onCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCreating(true);
      try {
        const res = await fetch("/api/operations/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: customerName,
            customer_phone: customerPhone || null,
            title,
            due_date: dueDate || null,
            amount_myr: amount ? Number(amount) : null,
            supplier_id: supplierId || null,
            notes: notes || null,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsOrderRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not create order.");
        }
        setOrders((prev) => [json.data!, ...prev]);
        setCustomerName("");
        setCustomerPhone("");
        setTitle("");
        setDueDate("");
        setAmount("");
        setSupplierId("");
        setNotes("");
        setShowForm(false);
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Create failed.");
      } finally {
        setCreating(false);
      }
    },
    [
      amount,
      customerName,
      customerPhone,
      dueDate,
      notes,
      refresh,
      supplierId,
      title,
    ],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          New order
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={onCreate}
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What did they order? *"
            required
            className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (RM)"
              className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
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
              Save order
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => (
          <section
            key={col.status}
            className="rounded-lg border border-cream-200 bg-cream-50/50 dark:border-hairline-dark dark:bg-panel-dark/40"
          >
            <header className="border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                {col.label}
                <span className="ml-2 text-xs font-normal text-ink-muted dark:text-cream-400">
                  {byStatus[col.status].length}
                </span>
              </h2>
            </header>
            <ul className="space-y-2 p-3">
              {byStatus[col.status].length === 0 ? (
                <li className="py-6 text-center text-xs text-ink-muted dark:text-cream-400">
                  No orders
                </li>
              ) : (
                byStatus[col.status].map((order) => {
                  const overdue = isOverdue(order.due_date, order.status);
                  const busy = busyId === order.id;
                  const amountLabel = formatOrderAmount(
                    order.amount_myr != null ? Number(order.amount_myr) : null,
                  );
                  return (
                    <li
                      key={order.id}
                      className="rounded-lg border border-cream-200 bg-white p-3 shadow-card dark:border-hairline-dark dark:bg-panel-dark"
                    >
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => advanceStatus(order)}
                        className="w-full text-left"
                      >
                        <p className="text-xs font-medium text-brand-600 dark:text-brand-300">
                          {order.number}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-ink dark:text-cream-100">
                          {order.title}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                          {order.customer_name}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted dark:text-cream-400">
                          {order.due_date ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1",
                                overdue && "font-semibold text-status-danger",
                              )}
                            >
                              <Calendar className="h-3 w-3" />
                              {fmtDue(order.due_date)}
                              {overdue ? " · overdue" : ""}
                            </span>
                          ) : null}
                          {order.customer_phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {order.customer_phone}
                            </span>
                          ) : null}
                          {amountLabel ? <span>· {amountLabel}</span> : null}
                          {order.supplier_name ? (
                            <span>· {order.supplier_name}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-brand-600 dark:text-brand-300">
                          Tap to move →{" "}
                          {orderStatusLabel(nextStatus(order.status))}
                        </p>
                      </button>
                      <div className="mt-2 flex justify-end border-t border-cream-100 pt-2 dark:border-hairline-dark">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void deleteOrder(order.id)}
                          className="inline-flex items-center gap-1 text-xs text-status-danger hover:underline disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
