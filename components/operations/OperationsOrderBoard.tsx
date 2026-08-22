"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  GripVertical,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  Package,
  PartyPopper,
  Receipt,
  Search,
  Trash2,
  UserPlus,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { AdminStorageFileAttach } from "@/components/admin/AdminStorageFileAttach";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
} from "@/components/dashboard/module-list-panel";
import { OperationsCustomerFields } from "@/components/operations/OperationsCustomerFields";
import { QuickCreateActions } from "@/components/ui/quick-create";
import { InlineFeedback } from "@/components/ui/alert";
import { customerHintsFromOrders } from "@/lib/operations/customer-hints";
import { cn } from "@/lib/utils/cn";
import {
  formatOrderAmount,
  fulfillmentStatusLabel,
  nextOrderStatus,
  orderStatusLabel,
  OPERATIONS_FULFILLMENT_STATUSES,
  OPERATIONS_FULFILLMENT_TYPES,
  OPERATIONS_ORDER_STATUSES,
  type OperationsFulfillmentStatus,
  type OperationsFulfillmentType,
  type OperationsOrderRow,
  type OperationsOrderStatus,
  type OperationsSupplierRow,
} from "@/lib/operations/schemas";

interface OperationsOrderBoardProps {
  initialOrders: OperationsOrderRow[];
  suppliers: OperationsSupplierRow[];
  leadLinks?: Record<string, string>;
  highlightOrderId?: string | null;
}

type OrderViewMode = "board" | "list";

const STATUS_RANK: Record<OperationsOrderStatus, number> = {
  todo: 0,
  in_progress: 1,
  ready: 2,
  done: 3,
};

const COLUMN_META: Record<
  OperationsOrderStatus,
  {
    label: string;
    Icon: LucideIcon;
    empty: string;
    header: string;
    ring: string;
    badge: string;
  }
> = {
  todo: {
    label: "To do",
    Icon: FileText,
    empty: "Nothing queued — add an order when a customer bites.",
    header:
      "border-slate-200 bg-gradient-to-b from-slate-50 to-white dark:border-hairline-dark dark:from-slate-950/40 dark:to-panel-dark",
    ring: "ring-slate-300 dark:ring-slate-700",
    badge:
      "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
  },
  in_progress: {
    label: "In progress",
    Icon: Wrench,
    empty: "No jobs in the works. Drag a card here when you start.",
    header:
      "border-amber-200 bg-gradient-to-b from-amber-50 to-white dark:border-amber-900/40 dark:from-amber-950/30 dark:to-panel-dark",
    ring: "ring-amber-300 dark:ring-amber-800",
    badge:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
  },
  ready: {
    label: "Ready",
    Icon: Package,
    empty: "Nothing waiting for pickup or delivery yet.",
    header:
      "border-sky-200 bg-gradient-to-b from-sky-50 to-white dark:border-sky-900/40 dark:from-sky-950/30 dark:to-panel-dark",
    ring: "ring-sky-300 dark:ring-sky-800",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-100",
  },
  done: {
    label: "Done",
    Icon: PartyPopper,
    empty: "Completed jobs show up here — ship one to celebrate.",
    header:
      "border-emerald-200 bg-gradient-to-b from-emerald-50 to-white dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-panel-dark",
    ring: "ring-emerald-300 dark:ring-emerald-800",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
  },
};

const COLUMNS = OPERATIONS_ORDER_STATUSES.map((status) => ({
  status,
  ...COLUMN_META[status],
}));

function fmtDue(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

function isOverdue(iso: string | null, status: OperationsOrderStatus): boolean {
  if (!iso || status === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso + "T00:00:00") < today;
}

function waUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}`;
}

export function OperationsOrderBoard({
  initialOrders,
  suppliers,
  leadLinks = {},
  highlightOrderId = null,
}: OperationsOrderBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [listPage, setListPage] = useState(1);
  const LIST_PAGE_SIZE = 20;
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [linkedCustomerId, setLinkedCustomerId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [fulfillmentType, setFulfillmentType] =
    useState<OperationsFulfillmentType>("pickup");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState(
    () => searchParams.get("q")?.trim() ?? "",
  );
  const [viewMode, setViewMode] = useState<OrderViewMode>("board");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<OperationsOrderStatus | null>(
    null,
  );
  const [linkedLeads, setLinkedLeads] = useState(leadLinks);

  useEffect(() => {
    const handler = () => setShowForm(true);
    window.addEventListener("operations:new-order", handler);
    return () => window.removeEventListener("operations:new-order", handler);
  }, []);

  useEffect(() => {
    setLinkedLeads(leadLinks);
  }, [leadLinks]);

  useEffect(() => {
    if (!highlightOrderId) return;
    setExpandedId(highlightOrderId);
    const el = document.getElementById(`order-${highlightOrderId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightOrderId]);

  const customerHints = useMemo(
    () => customerHintsFromOrders(orders),
    [orders],
  );

  useEffect(() => {
    setListPage(1);
  }, [query]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      [o.number, o.customer_name, o.title, o.customer_phone ?? ""].some(
        (field) => field.toLowerCase().includes(q),
      ),
    );
  }, [orders, query]);

  const byStatus = useMemo(() => {
    const map: Record<OperationsOrderStatus, OperationsOrderRow[]> = {
      todo: [],
      in_progress: [],
      ready: [],
      done: [],
    };
    for (const o of filteredOrders) {
      map[o.status].push(o);
    }
    return map;
  }, [filteredOrders]);

  const sortedListOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (rank !== 0) return rank;
      const aDue = a.due_date ?? "9999-12-31";
      const bDue = b.due_date ?? "9999-12-31";
      if (aDue !== bDue) return aDue.localeCompare(bDue);
      return b.created_at.localeCompare(a.created_at);
    });
  }, [filteredOrders]);

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
      if (order.status === "done") return;
      void patchOrder(order.id, { status: nextOrderStatus(order.status) });
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
        setExpandedId((cur) => (cur === id ? null : cur));
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const archiveOrder = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/operations/orders/${id}/archive`, {
          method: "POST",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as { error?: { message?: string } };
          throw new Error(json?.error?.message ?? "Archive failed.");
        }
        setOrders((prev) => prev.filter((o) => o.id !== id));
        setExpandedId((cur) => (cur === id ? null : cur));
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
            customer_id: linkedCustomerId || null,
            customer_name: customerName,
            customer_phone: customerPhone || null,
            title,
            fulfillment_type: fulfillmentType,
            due_date: dueDate || null,
            amount_myr: amount ? Number(amount) : null,
            supplier_id: supplierId || null,
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
        setLinkedCustomerId(null);
        setTitle("");
        setFulfillmentType("pickup");
        setDueDate("");
        setAmount("");
        setSupplierId("");
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
      fulfillmentType,
      refresh,
      supplierId,
      title,
    ],
  );

  const recordExpense = useCallback(
    async (order: OperationsOrderRow) => {
      setBusyId(order.id);
      setFormError(null);
      try {
        const res = await fetch(
          `/api/operations/orders/${order.id}/record-expense`,
          { method: "POST" },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (json.error === "already_recorded" && json.expense_id) {
            router.push(`/finance/expenses?txn=${json.expense_id}`);
            return;
          }
          throw new Error(
            json.message ?? json.error ?? "Could not record expense.",
          );
        }
        router.push(json.data?.href ?? "/finance/expenses");
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "Could not record expense.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  const createLead = useCallback(
    async (order: OperationsOrderRow) => {
      setBusyId(order.id);
      setFormError(null);
      try {
        const res = await fetch(
          `/api/operations/orders/${order.id}/create-lead`,
          { method: "POST" },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            json.message ?? json.error ?? "Could not create lead.",
          );
        }
        const leadId = json.data?.lead_id as string | undefined;
        if (leadId) {
          setLinkedLeads((prev) => ({ ...prev, [order.id]: leadId }));
          router.push(`/sales/leads/${leadId}`);
        }
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "Could not create lead.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  const renderExpandedDetails = (
    order: OperationsOrderRow,
    busy: boolean,
  ) => {
    const isDone = order.status === "done";
    return (
    <div
      className="space-y-3 border-t border-cream-100 px-3 py-3 dark:border-hairline-dark"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap gap-2">
        {order.amount_myr != null && Number(order.amount_myr) > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void recordExpense(order)}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-bold text-violet-800 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100"
          >
            <Receipt className="h-3 w-3" />
            Record expense
          </button>
        ) : null}
        {linkedLeads[order.id] ? (
          <Link
            href={`/sales/leads/${linkedLeads[order.id]}`}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          >
            <UserPlus className="h-3 w-3" />
            View lead
          </Link>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void createLead(order)}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-800 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
          >
            <UserPlus className="h-3 w-3" />
            Create lead
          </button>
        )}
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-muted dark:text-cream-400">
          Fulfillment status
        </label>
        <select
          value={order.fulfillment_status}
          disabled={busy}
          onChange={(e) =>
            void patchOrder(order.id, {
              fulfillment_status: e.target
                .value as OperationsFulfillmentStatus,
            })
          }
          className="w-full rounded-lg border border-cream-300 bg-white px-2 py-1.5 text-xs dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        >
          {OPERATIONS_FULFILLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {fulfillmentStatusLabel(s, order.fulfillment_type)}
            </option>
          ))}
        </select>
      </div>
      <AdminStorageFileAttach
        compact
        category="operations"
        fileId={order.admin_file_id}
        fileName={order.admin_file_name}
        disabled={busy}
        onAttach={async (fileId) => {
          await patchOrder(order.id, { admin_file_id: fileId });
        }}
      />
      {isDone ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void archiveOrder(order.id)}
          className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-amber-200 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Archive className="h-3 w-3" />
          )}
          Archive order
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void deleteOrder(order.id)}
        className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-rose-200 py-1.5 text-xs font-semibold text-status-danger hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Trash2 className="h-3 w-3" />
        )}
        Remove order
      </button>
    </div>
    );
  };

  const pagedListOrders = useMemo(() => {
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    return sortedListOrders.slice(start, start + LIST_PAGE_SIZE);
  }, [sortedListOrders, listPage]);
  const totalListPages = Math.max(1, Math.ceil(sortedListOrders.length / LIST_PAGE_SIZE));

  return (
    <div className="space-y-4">
      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl border border-cream-200 bg-white shadow-elevated dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
              <div>
                <p className="text-sm font-bold text-ink dark:text-cream-100">New customer order</p>
                <p className="text-xs text-ink-muted dark:text-cream-400">Lands in To do — advance it as you work.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-100 hover:text-ink dark:hover:bg-hairline-dark/60 dark:hover:text-cream-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={onCreate} className="space-y-4 p-5">
              <OperationsCustomerFields
                name={customerName}
                phone={customerPhone}
                onNameChange={setCustomerName}
                onPhoneChange={setCustomerPhone}
                linkedCustomerId={linkedCustomerId}
                onLink={(id, name, phone) => { setLinkedCustomerId(id); setCustomerName(name); setCustomerPhone(phone ?? ""); }}
                onUnlink={() => setLinkedCustomerId(null)}
                localHints={customerHints}
              />
              <div className="space-y-1">
                <label htmlFor="order-title" className="text-xs font-semibold text-ink dark:text-cream-100">
                  Order details <span className="text-status-danger">*</span>
                </label>
                <input
                  id="order-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What did they order?"
                  required
                  className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                />
              </div>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <div className="space-y-1">
                  <label htmlFor="order-due-date" className="text-xs font-semibold text-ink dark:text-cream-100">
                    Due date <span className="font-normal text-ink-muted dark:text-cream-400">(optional)</span>
                  </label>
                  <input
                    id="order-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="order-amount" className="text-xs font-semibold text-ink dark:text-cream-100">
                    Amount (RM)
                  </label>
                  <input
                    id="order-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="order-fulfillment" className="text-xs font-semibold text-ink dark:text-cream-100">
                    Fulfillment
                  </label>
                  <select
                    id="order-fulfillment"
                    value={fulfillmentType}
                    onChange={(e) => setFulfillmentType(e.target.value as OperationsFulfillmentType)}
                    className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                  >
                    {OPERATIONS_FULFILLMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t === "pickup" ? "Pickup" : "Delivery"}
                      </option>
                    ))}
                  </select>
                </div>
                {suppliers.length > 0 ? (
                  <div className="space-y-1">
                    <label htmlFor="order-supplier" className="text-xs font-semibold text-ink dark:text-cream-100">
                      Supplier
                    </label>
                    <select
                      id="order-supplier"
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                    >
                      <option value="">No supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
              {formError ? <InlineFeedback>{formError}</InlineFeedback> : null}
              <QuickCreateActions
                submitLabel="Add to board"
                loading={creating}
                onCancel={() => setShowForm(false)}
              />
            </form>
          </div>
        </div>
      ) : null}

      <ModuleListPanel>
        <ModuleListPanelFilters>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-cream-300 dark:border-hairline-dark">
              <button
                type="button"
                onClick={() => setViewMode("board")}
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold",
                  viewMode === "board"
                    ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
                    : "text-ink-muted dark:text-cream-400",
                )}
                aria-pressed={viewMode === "board"}
              >
                <LayoutGrid className="h-4 w-4" />
                Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "inline-flex items-center gap-1 border-l border-cream-300 px-3 py-2 text-sm font-semibold dark:border-hairline-dark",
                  viewMode === "list"
                    ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
                    : "text-ink-muted dark:text-cream-400",
                )}
                aria-pressed={viewMode === "list"}
              >
                <List className="h-4 w-4" />
                List
              </button>
            </div>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {viewMode === "board"
                ? "Drag cards · or tap Advance"
                : "List view · tap Advance to move status"}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-cream-300 bg-cream-50/50 px-3 py-2.5 dark:border-hairline-dark dark:bg-panel-dark/60">
              <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={2} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customer, order #, title…"
                className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100"
              />
            </div>
            {query.trim() ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
              >
                Clear
              </button>
            ) : null}
          </div>
        </ModuleListPanelFilters>

      {viewMode === "list" ? (
        sortedListOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-cream-300 bg-cream-50/50 py-14 text-center dark:border-hairline-dark dark:bg-panel-dark/30">
            <Package className="mx-auto h-8 w-8 text-ink-muted dark:text-cream-400" />
            <p className="mt-3 text-sm font-semibold text-ink dark:text-cream-100">
              {query.trim() ? "No orders match your search" : "No orders yet"}
            </p>
            <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
              {query.trim()
                ? "Try another name or order number."
                : "Add your first customer order — it lands in To do."}
            </p>
          </div>
        ) : (
          <>
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {pagedListOrders.map((order) => {
                const overdue = isOverdue(order.due_date, order.status);
                const busy = busyId === order.id;
                const expanded = expandedId === order.id;
                const amountLabel = formatOrderAmount(
                  order.amount_myr != null ? Number(order.amount_myr) : null,
                );
                const nextStatus = nextOrderStatus(order.status);
                const canAdvance = order.status !== "done";
                const col = COLUMN_META[order.status];

                return (
                  <li
                    key={order.id}
                    id={`order-${order.id}`}
                    className={cn(
                      "bg-white dark:bg-panel-dark",
                      overdue && "bg-rose-50/40 dark:bg-rose-950/10",
                      highlightOrderId === order.id &&
                        "ring-2 ring-inset ring-amber-300 dark:ring-amber-700",
                    )}
                  >
                    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                              col.badge,
                            )}
                          >
                            {col.label}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                            {order.number}
                          </span>
                          <span className="text-[10px] font-semibold uppercase text-ink-muted dark:text-cream-400">
                            {order.fulfillment_type === "pickup"
                              ? "Pickup"
                              : "Delivery"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-ink dark:text-cream-100">
                          {order.title}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                          {order.customer_name}
                          {order.due_date ? (
                            <>
                              {" · "}
                              <span
                                className={cn(
                                  overdue &&
                                    "font-semibold text-rose-700 dark:text-rose-200",
                                )}
                              >
                                Due {fmtDue(order.due_date)}
                                {overdue ? " (late)" : ""}
                              </span>
                            </>
                          ) : null}
                          {amountLabel ? <> · {amountLabel}</> : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                        {canAdvance ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => advanceStatus(order)}
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-600 disabled:opacity-50"
                          >
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ArrowRight className="h-3 w-3" />
                            )}
                            {orderStatusLabel(nextStatus)}
                          </button>
                        ) : (
                          <span className="rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                            Completed
                          </span>
                        )}
                        {order.customer_phone ? (
                          <a
                            href={waUrl(order.customer_phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                          >
                            <MessageCircle className="h-3 w-3" />
                            WA
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(expanded ? null : order.id)
                          }
                          className="inline-flex items-center gap-0.5 rounded-lg border border-cream-200 px-2 py-1.5 text-[11px] font-semibold text-ink-muted hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-hairline-dark/40"
                          aria-expanded={expanded}
                        >
                          {expanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          More
                        </button>
                      </div>
                    </div>
                    {expanded ? renderExpandedDetails(order, busy) : null}
                  </li>
                );
              })}
            </ul>
            {totalListPages > 1 ? (
              <div className="flex items-center justify-between border-t border-cream-200 px-4 py-3 dark:border-hairline-dark">
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  Page {listPage} of {totalListPages} · {sortedListOrders.length} orders
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={listPage <= 1}
                    onClick={() => setListPage((p) => p - 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cream-300 text-ink-muted hover:bg-cream-50 disabled:opacity-40 dark:border-hairline-dark dark:hover:bg-hairline-dark/40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={listPage >= totalListPages}
                    onClick={() => setListPage((p) => p + 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cream-300 text-ink-muted hover:bg-cream-50 disabled:opacity-40 dark:border-hairline-dark dark:hover:bg-hairline-dark/40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )
      ) : (
      <div
        role="region"
        aria-label="Order board"
        className="-mx-1 flex items-start gap-3 overflow-x-auto overscroll-x-contain px-1 pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:thin] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-cream-300 dark:[&::-webkit-scrollbar-thumb]:bg-hairline-dark"
      >
        {COLUMNS.map((col) => (
          <section
            key={col.status}
            className={cn(
              "flex h-[min(70vh,640px)] w-[min(88vw,18rem)] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border-2 transition-all sm:w-72",
              col.header,
              dropTarget === col.status
                ? cn("scale-[1.01] shadow-lg", col.ring, "ring-2")
                : "border-transparent shadow-sm",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropTarget(col.status);
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDropTarget(null);
              if (!dragId) return;
              const order = orders.find((o) => o.id === dragId);
              if (order && order.status !== col.status) {
                void patchOrder(dragId, { status: col.status });
              }
              setDragId(null);
            }}
          >
            <header className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-3 dark:border-white/5">
              <div className="flex items-center gap-2">
                <col.Icon className="h-4 w-4 shrink-0 text-ink-muted dark:text-cream-400" aria-hidden />
                <h2 className="text-sm font-bold text-ink dark:text-cream-100">
                  {col.label}
                </h2>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
                  col.badge,
                )}
              >
                {byStatus[col.status].length}
              </span>
            </header>

            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 [scrollbar-width:thin]">
              {byStatus[col.status].length === 0 ? (
                <li className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-cream-300/80 px-4 py-8 text-center dark:border-hairline-dark">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cream-200 bg-cream-50 text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400">
                    <col.Icon className="h-6 w-6" />
                  </span>
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted dark:text-cream-400">
                    {col.empty}
                  </p>
                </li>
              ) : (
                byStatus[col.status].map((order) => {
                  const overdue = isOverdue(order.due_date, order.status);
                  const busy = busyId === order.id;
                  const expanded = expandedId === order.id;
                  const amountLabel = formatOrderAmount(
                    order.amount_myr != null ? Number(order.amount_myr) : null,
                  );
                  const nextStatus = nextOrderStatus(order.status);
                  const canAdvance = order.status !== "done";

                  return (
                    <li
                      key={order.id}
                      id={`order-${order.id}`}
                      draggable
                      onDragStart={() => setDragId(order.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropTarget(null);
                      }}
                      className={cn(
                        "group rounded-xl border bg-white shadow-sm transition-all dark:bg-panel-dark",
                        overdue
                          ? "border-rose-300 ring-1 ring-rose-200 dark:border-rose-900 dark:ring-rose-950"
                          : "border-cream-200 dark:border-hairline-dark",
                        dragId === order.id && "scale-[0.98] opacity-50",
                        highlightOrderId === order.id &&
                          "ring-2 ring-amber-300 dark:ring-amber-700",
                      )}
                    >
                      <div className="p-3">
                        <div className="flex items-start gap-2">
                          <GripVertical
                            className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-ink-subtle opacity-40 group-hover:opacity-100 dark:text-cream-500"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                                {order.number}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
                                  col.badge,
                                )}
                              >
                                {order.fulfillment_type === "pickup"
                                  ? "Pickup"
                                  : "Delivery"}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-ink dark:text-cream-100">
                              {order.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-ink-muted dark:text-cream-400">
                              {order.customer_name}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              {order.due_date ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                                    overdue
                                      ? "bg-rose-50 font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                                      : "text-ink-muted dark:text-cream-400",
                                  )}
                                >
                                  <Calendar className="h-3 w-3" />
                                  {fmtDue(order.due_date)}
                                  {overdue ? " · late" : ""}
                                </span>
                              ) : null}
                              {amountLabel ? (
                                <span className="font-semibold tabular-nums text-ink dark:text-cream-100">
                                  {amountLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {canAdvance ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => advanceStatus(order)}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-500 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-brand-600 disabled:opacity-50 sm:flex-none sm:px-3"
                            >
                              {busy ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ArrowRight className="h-3 w-3" />
                              )}
                              {orderStatusLabel(nextStatus)}
                            </button>
                          ) : (
                            <span className="rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                              Completed
                            </span>
                          )}
                          {order.customer_phone ? (
                            <a
                              href={waUrl(order.customer_phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                            >
                              <MessageCircle className="h-3 w-3" />
                              WA
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(expanded ? null : order.id)
                            }
                            className="inline-flex items-center gap-0.5 rounded-lg border border-cream-200 px-2 py-1.5 text-[11px] font-semibold text-ink-muted hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-hairline-dark/40"
                            aria-expanded={expanded}
                          >
                            {expanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                            More
                          </button>
                        </div>
                      </div>

                      {expanded ? renderExpandedDetails(order, busy) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        ))}
      </div>
      )}
      </ModuleListPanel>
    </div>
  );
}
