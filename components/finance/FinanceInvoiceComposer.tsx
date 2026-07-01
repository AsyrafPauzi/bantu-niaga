"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { apiErrorMessage } from "@/lib/api/client-error";
import { computeInvoiceTotals, lineTotal } from "@/lib/finance/invoice-math";
import {
  emailShareUrl,
  FINANCE_INVOICE_STATUSES,
  buildInvoiceShareMessage,
  invoiceShareUrl,
  type FinanceCustomerRow,
  type FinanceInvoiceRow,
  type FinanceInvoiceStatus,
} from "@/lib/finance/schemas";

const UNITS = [
  { value: "unit", label: "Unit" },
  { value: "pcs", label: "pcs" },
  { value: "hours", label: "hours" },
  { value: "days", label: "days" },
  { value: "kg", label: "kg" },
  { value: "lot", label: "lot" },
  { value: "set", label: "set" },
] as const;

const STATUS_LABEL: Record<FinanceInvoiceStatus, string> = {
  draft: "New",
  sent: "Sent",
  paid: "Paid",
  void: "Void",
};

type LineDraft = {
  key: string;
  description: string;
  unit_price: string;
  quantity: string;
  unit: string;
  taxable: boolean;
};

interface FinanceInvoiceComposerProps {
  customers: FinanceCustomerRow[];
  invoice?: FinanceInvoiceRow | null;
  nextNumberPreview?: string;
  defaultInvoiceDate?: string;
  idcompany?: string;
  businessName?: string;
  duitnowId?: string | null;
  appUrl?: string;
}

function emptyLine(key: string): LineDraft {
  return {
    key,
    description: "",
    unit_price: "0.00",
    quantity: "1",
    unit: "unit",
    taxable: false,
  };
}

function linesFromInvoice(invoice?: FinanceInvoiceRow | null): LineDraft[] {
  if (invoice?.items && invoice.items.length > 0) {
    return invoice.items.map((item) => ({
      key: item.id,
      description: item.description,
      unit_price: Number(item.unit_price).toFixed(2),
      quantity: String(item.quantity),
      unit: item.unit ?? "unit",
      taxable: item.taxable,
    }));
  }
  return [emptyLine("line-0")];
}

function fmtAmount(n: number): string {
  return n.toFixed(2);
}

export function FinanceInvoiceComposer({
  customers: initialCustomers,
  invoice,
  nextNumberPreview,
  defaultInvoiceDate = "",
  idcompany = "",
  businessName = "",
  duitnowId,
  appUrl = "",
}: FinanceInvoiceComposerProps) {
  const router = useRouter();
  const formId = useId();
  const nextLineKey = useRef(1);
  const isEdit = Boolean(invoice?.id);

  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState(invoice?.customer_id ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [title, setTitle] = useState(invoice?.title ?? "");
  const [invoiceDate, setInvoiceDate] = useState(
    invoice?.invoice_date ?? defaultInvoiceDate,
  );
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? "");
  const [status, setStatus] = useState<FinanceInvoiceStatus>(
    invoice?.status ?? "draft",
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [discountMyr, setDiscountMyr] = useState(
    fmtAmount(Number(invoice?.discount_myr ?? 0)),
  );
  const [taxPct, setTaxPct] = useState(fmtAmount(Number(invoice?.tax_pct ?? 0)));
  const [shippingMyr, setShippingMyr] = useState(
    fmtAmount(Number(invoice?.shipping_myr ?? 0)),
  );
  const [lines, setLines] = useState<LineDraft[]>(() =>
    linesFromInvoice(invoice),
  );
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customerId, customers],
  );

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone_e164?.includes(q) ?? false),
    );
  }, [customerQuery, customers]);

  const parsedLines = useMemo(
    () =>
      lines.map((line) => ({
        description: line.description.trim(),
        unit_price: parseFloat(line.unit_price) || 0,
        quantity: parseFloat(line.quantity) || 0,
        unit: line.unit,
        taxable: line.taxable,
      })),
    [lines],
  );

  const totals = useMemo(
    () =>
      computeInvoiceTotals({
        items: parsedLines.filter((l) => l.quantity > 0),
        discount_myr: parseFloat(discountMyr) || 0,
        discount_pct: 0,
        tax_myr: 0,
        tax_pct: parseFloat(taxPct) || 0,
        shipping_myr: parseFloat(shippingMyr) || 0,
      }),
    [discountMyr, parsedLines, shippingMyr, taxPct],
  );

  useEffect(() => {
    if (selectedCustomer && !customerQuery) {
      setCustomerQuery(selectedCustomer.name);
    }
  }, [selectedCustomer, customerQuery]);

  const invoiceNumber =
    invoice?.number ?? nextNumberPreview ?? "Auto on save";

  const addLine = useCallback(() => {
    const key = `line-${nextLineKey.current++}`;
    setLines((prev) => [...prev, emptyLine(key)]);
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((line) => line.key !== key),
    );
  }, []);

  const createCustomer = useCallback(async () => {
    setCreatingCustomer(true);
    setFormError(null);
    try {
      const res = await fetch("/api/finance/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName,
          phone: newCustomerPhone || null,
          email: newCustomerEmail || null,
          address: newCustomerAddress || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(apiErrorMessage(json, "Could not create customer."));
      }
      const row = json.data as FinanceCustomerRow;
      setCustomers((prev) =>
        [...prev, row].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setCustomerId(row.id);
      setCustomerQuery(row.name);
      setShowNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      setNewCustomerAddress("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setCreatingCustomer(false);
    }
  }, [
    newCustomerAddress,
    newCustomerEmail,
    newCustomerName,
    newCustomerPhone,
  ]);

  const saveInvoice = useCallback(
    async (nextStatus?: FinanceInvoiceStatus): Promise<FinanceInvoiceRow | null> => {
      if (!customerId) {
        setFormError("Please select a customer.");
        return null;
      }

      const validLines = parsedLines.filter(
        (line) => line.description && line.quantity > 0,
      );
      if (validLines.length === 0) {
        setFormError("Add at least one line item.");
        return null;
      }

      setSaving(true);
      setFormError(null);

      const payload = {
        customer_id: customerId,
        title: title || null,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        notes: notes || null,
        discount_myr: parseFloat(discountMyr) || 0,
        discount_pct: 0,
        tax_myr: totals.tax_myr,
        tax_pct: parseFloat(taxPct) || 0,
        shipping_myr: parseFloat(shippingMyr) || 0,
        status: nextStatus ?? status,
        items: validLines,
      };

      try {
        const res = await fetch(
          isEdit
            ? `/api/finance/invoices/${invoice!.id}`
            : "/api/finance/invoices",
          {
            method: isEdit ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const json = await res.json();
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(apiErrorMessage(json, "Could not save invoice."));
        }
        return json.data as FinanceInvoiceRow;
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [
      customerId,
      discountMyr,
      dueDate,
      invoice,
      invoiceDate,
      isEdit,
      notes,
      parsedLines,
      shippingMyr,
      status,
      taxPct,
      title,
      totals.tax_myr,
    ],
  );

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const saved = await saveInvoice();
      if (saved) {
        router.push("/finance/invoices");
        router.refresh();
      }
    },
    [router, saveInvoice],
  );

  const onSaveAndEmail = useCallback(async () => {
    const saved = await saveInvoice("sent");
    if (!saved) return;

    if (idcompany && appUrl) {
      const url = invoiceShareUrl(appUrl, idcompany, saved.share_hash);
      const message = buildInvoiceShareMessage(
        businessName,
        saved.number,
        Number(saved.total_myr),
        url,
      );
      const mail = emailShareUrl(
        `Invoice ${saved.number} from ${businessName}`,
        message,
        saved.customer_email ?? undefined,
      );
      window.location.href = mail;
    }

    router.push("/finance/invoices");
    router.refresh();
  }, [appUrl, businessName, idcompany, router, saveInvoice]);

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="pb-24">
      <div className="overflow-hidden rounded-lg border border-cream-300 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        {/* ── Row 1: Customer + Invoice meta ── */}
        <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-cream-200 dark:lg:divide-hairline-dark">
          {/* Customer */}
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink dark:text-cream-100">
                Customer
              </span>
              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="inline-flex items-center gap-1 rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                New customer
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={customerQuery}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setCustomerOpen(true);
                  if (!e.target.value) setCustomerId("");
                }}
                onFocus={() => setCustomerOpen(true)}
                placeholder="Search or select customer…"
                className={cn(fieldCx, "pl-9 pr-9")}
              />
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              {customerOpen && filteredCustomers.length > 0 ? (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-cream-300 bg-white py-1 shadow-lg dark:border-hairline-dark dark:bg-panel-dark">
                  {filteredCustomers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-cream-100 dark:hover:bg-hairline-dark/60"
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerQuery(c.name);
                          setCustomerOpen(false);
                        }}
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {selectedCustomer ? (
              <div className="space-y-1.5 border-t border-cream-200 pt-3 text-sm dark:border-hairline-dark">
                <p className="font-semibold text-ink dark:text-cream-100">
                  {selectedCustomer.name}
                </p>
                {selectedCustomer.address ? (
                  <p className="leading-relaxed text-ink-muted dark:text-cream-400">
                    {selectedCustomer.address}
                  </p>
                ) : null}
                <p className="text-ink-muted dark:text-cream-400">
                  <span className="text-ink-subtle dark:text-cream-500">
                    Phone:{" "}
                  </span>
                  {selectedCustomer.phone_e164 ?? "—"}
                </p>
                <p className="text-ink-muted dark:text-cream-400">
                  <span className="text-ink-subtle dark:text-cream-500">
                    Email:{" "}
                  </span>
                  {selectedCustomer.email ?? "—"}
                </p>
                <Link
                  href="/finance/customers"
                  className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-ink-muted hover:text-brand-700 dark:text-cream-400 dark:hover:text-brand-200"
                >
                  <Pencil className="h-3 w-3" />
                  Update customer
                </Link>
              </div>
            ) : (
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Select a saved customer — details fill in automatically.
              </p>
            )}
          </div>

          {/* Invoice meta — grey panel */}
          <div className="space-y-3 bg-cream-100/90 p-4 sm:p-5 dark:bg-panel-dark/80">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Invoice date">
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className={fieldCx}
                />
              </Field>
              <Field label="Pay before">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={fieldCx}
                />
              </Field>
            </div>
            <Field label="Invoice status">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as FinanceInvoiceStatus)
                }
                className={fieldCx}
              >
                {FINANCE_INVOICE_STATUSES.filter((s) => s !== "void").map(
                  (s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <div className="pt-2 text-center">
              <p className="text-2xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-3xl">
                #{invoiceNumber}
              </p>
            </div>
          </div>
        </div>

        {/* ── Title ── */}
        <div className="border-t border-cream-200 px-4 py-4 sm:px-5 dark:border-hairline-dark">
          <Field label="Title / description">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is this invoice for?"
              className={fieldCx}
            />
          </Field>
        </div>

        {/* ── Line items ── */}
        <div className="border-t border-cream-200 px-4 py-4 sm:px-5 dark:border-hairline-dark">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink dark:text-cream-100">
              Items / services
            </span>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add item
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => {
              const taxInputId = `${formId}-tax-${index}`;
              const total = lineTotal(
                parseFloat(line.unit_price) || 0,
                parseFloat(line.quantity) || 0,
              );
              return (
                <div
                  key={line.key}
                  className="grid gap-0 overflow-hidden rounded-md border border-cream-300 dark:border-hairline-dark lg:grid-cols-[1fr_220px]"
                >
                  {/* Description column */}
                  <div className="flex min-h-[160px] flex-col border-b border-cream-300 lg:border-b-0 lg:border-r dark:border-hairline-dark">
                    <textarea
                      value={line.description}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row) =>
                            row.key === line.key
                              ? { ...row, description: e.target.value }
                              : row,
                          ),
                        )
                      }
                      placeholder="Describe the item or service…"
                      className="min-h-[120px] flex-1 resize-y border-0 bg-transparent px-3 py-3 text-sm focus:outline-none focus:ring-0 dark:text-cream-100"
                    />
                    <div className="flex items-center justify-end gap-2 border-t border-cream-200 px-2 py-1.5 dark:border-hairline-dark">
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-status-danger hover:bg-status-danger/10"
                        >
                          <X className="h-3 w-3" />
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Pricing column */}
                  <div className="grid grid-cols-2 divide-x divide-cream-200 bg-cream-50/50 dark:divide-hairline-dark dark:bg-panel-dark/40">
                    <MiniField label="Unit price">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === line.key
                                ? { ...row, unit_price: e.target.value }
                                : row,
                            ),
                          )
                        }
                        className={miniInputCx}
                      />
                    </MiniField>
                    <MiniField label="Qty">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === line.key
                                ? { ...row, quantity: e.target.value }
                                : row,
                            ),
                          )
                        }
                        className={miniInputCx}
                      />
                    </MiniField>
                    <div className="col-span-2 flex items-center gap-2 border-t border-cream-200 px-2 py-2 dark:border-hairline-dark">
                      <input
                        type="checkbox"
                        id={taxInputId}
                        checked={line.taxable}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === line.key
                                ? { ...row, taxable: e.target.checked }
                                : row,
                            ),
                          )
                        }
                        className="h-4 w-4 rounded border-cream-400"
                      />
                      <label
                        htmlFor={taxInputId}
                        className="text-xs text-ink-muted dark:text-cream-400"
                      >
                        Tax
                      </label>
                    </div>
                    <MiniField label="Unit">
                      <select
                        value={line.unit}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === line.key
                                ? { ...row, unit: e.target.value }
                                : row,
                            ),
                          )
                        }
                        className={miniInputCx}
                      >
                        {UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </MiniField>
                    <MiniField label="Amount">
                      <div className="flex h-8 items-center justify-end px-2 text-sm font-semibold tabular-nums text-ink dark:text-cream-100">
                        {fmtAmount(total)}
                      </div>
                    </MiniField>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Notes + Totals ── */}
        <div className="grid border-t border-cream-200 lg:grid-cols-2 lg:divide-x lg:divide-cream-200 dark:border-hairline-dark dark:lg:divide-hairline-dark">
          <div className="p-4 sm:p-5">
            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment terms, thank-you note, extra instructions…"
                rows={8}
                className={cn(fieldCx, "resize-y min-h-[180px]")}
              />
            </Field>
          </div>

          <div className="divide-y divide-cream-200 border-t border-cream-200 lg:border-t-0 dark:divide-hairline-dark dark:border-hairline-dark">
            <SummaryRow label="Subtotal" value={fmtAmount(totals.amount_myr)} />
            <SummaryRow
              label="Discount (RM)"
              input={
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountMyr}
                  onChange={(e) => setDiscountMyr(e.target.value)}
                  className={summaryInputCx}
                />
              }
            />
            <SummaryRow label="Tax (RM)" value={fmtAmount(totals.tax_myr)} />
            <SummaryRow
              label="Tax (%)"
              input={
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxPct}
                  onChange={(e) => setTaxPct(e.target.value)}
                  className={summaryInputCx}
                />
              }
            />
            <SummaryRow
              label="Shipping"
              input={
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingMyr}
                  onChange={(e) => setShippingMyr(e.target.value)}
                  className={summaryInputCx}
                />
              }
            />
            <SummaryRow
              label="Final total"
              value={fmtAmount(totals.total_myr)}
              strong
            />
          </div>
        </div>

        {/* ── Payment info (DuitNow) ── */}
        <div className="border-t border-cream-200 p-4 sm:p-5 dark:border-hairline-dark">
          <p className="mb-2 text-sm font-semibold text-ink dark:text-cream-100">
            Bank account on invoice
          </p>
          {duitnowId ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked className="h-4 w-4" />
              <span className="text-ink dark:text-cream-100">
                DuitNow — {duitnowId}
              </span>
            </label>
          ) : (
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Add your DuitNow ID in Settings so customers can pay from the
              invoice link.
            </p>
          )}
        </div>
      </div>

      {formError ? (
        <p role="alert" className="mt-3 text-sm text-status-danger">
          {formError}
        </p>
      ) : null}

      {/* ── Fixed footer actions (screenshot style) ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-300 bg-white/95 px-4 py-3 backdrop-blur dark:border-hairline-dark dark:bg-panel-dark/95">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
          <Link
            href="/finance/invoices"
            className="inline-flex items-center gap-1.5 rounded border border-cream-400 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            <X className="h-4 w-4" />
            Cancel
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSaveAndEmail()}
            className="inline-flex items-center gap-1.5 rounded bg-status-danger px-5 py-2.5 text-sm font-semibold text-white hover:bg-status-danger/90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Email
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" strokeWidth={2.5} />
            )}
            Save
          </button>
        </div>
      </div>

      {showNewCustomer ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCustomerOpen(false)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-lg border border-cream-300 bg-white p-5 shadow-xl dark:border-hairline-dark dark:bg-panel-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                New customer
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCustomer(false)}
                className="text-ink-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="text"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="Name / company *"
              className={fieldCx}
            />
            <input
              type="tel"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="Phone"
              className={fieldCx}
            />
            <input
              type="email"
              value={newCustomerEmail}
              onChange={(e) => setNewCustomerEmail(e.target.value)}
              placeholder="Email"
              className={fieldCx}
            />
            <textarea
              value={newCustomerAddress}
              onChange={(e) => setNewCustomerAddress(e.target.value)}
              placeholder="Address"
              rows={3}
              className={fieldCx}
            />
            <button
              type="button"
              disabled={creatingCustomer || !newCustomerName.trim()}
              onClick={() => void createCustomer()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {creatingCustomer ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Save customer
            </button>
          </div>
        </div>
      ) : null}

      {/* Click-away to close customer dropdown */}
      {customerOpen ? (
        <button
          type="button"
          aria-label="Close customer list"
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setCustomerOpen(false)}
        />
      ) : null}
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-xs font-medium text-ink-muted dark:text-cream-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function MiniField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-2">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted dark:text-cream-400">
        {label}
      </p>
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  input,
  strong,
}: {
  label: string;
  value?: string;
  input?: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 items-center gap-2 px-4 py-2.5 sm:px-5",
        strong && "bg-cream-50 dark:bg-panel-dark/60",
      )}
    >
      <span
        className={cn(
          "text-sm",
          strong
            ? "font-bold text-ink dark:text-cream-100"
            : "text-ink-muted dark:text-cream-400",
        )}
      >
        {label}
      </span>
      {input ?? (
        <span
          className={cn(
            "text-right text-sm tabular-nums",
            strong
              ? "text-lg font-bold text-ink dark:text-cream-100"
              : "text-ink dark:text-cream-100",
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}

const fieldCx =
  "w-full rounded border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

const miniInputCx =
  "h-8 w-full rounded border border-cream-300 bg-white px-2 text-right text-sm tabular-nums focus:border-brand-500 focus:outline-none dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

const summaryInputCx =
  "h-8 w-full rounded border border-cream-300 bg-white px-2 text-right text-sm tabular-nums focus:border-brand-500 focus:outline-none dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";
