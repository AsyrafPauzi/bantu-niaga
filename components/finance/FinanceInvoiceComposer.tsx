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
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { OperationsProductPickerRow } from "@/lib/finance/invoice-composer-shared";
import { addDaysToYmd } from "@/lib/finance/invoice-composer-shared";
import { AdminStorageFileAttach } from "@/components/admin/AdminStorageFileAttach";
import { cn } from "@/lib/utils/cn";
import { apiErrorMessage } from "@/lib/api/client-error";
import { computeInvoiceTotals, lineTotal } from "@/lib/finance/invoice-math";
import {
  FINANCE_INVOICE_STATUSES,
  buildInvoiceShareMessage,
  buildQuoteShareMessage,
  defaultQuoteTermsNote,
  invoiceShareUrl,
  isDefaultQuoteTermsNote,
  whatsAppShareUrl,
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
  initialCustomerId?: string;
  recentCustomers?: FinanceCustomerRow[];
  products?: OperationsProductPickerRow[];
  idcompany?: string;
  businessName?: string;
  duitnowId?: string | null;
  duitnowQrUrl?: string | null;
  /** Server-derived: Billplz env configured (FPX on public invoice). */
  fpxEnabled?: boolean;
  sstEnabled?: boolean;
  sstRatePct?: number;
  appUrl?: string;
  documentKind?: "invoice" | "quote";
  /** Merged page title + total in the hero (no duplicate PageHeader). */
  mergedHeader?: boolean;
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

function defaultSecondDate(
  invoiceDate: string,
  kind: "invoice" | "quote",
): string {
  if (!invoiceDate) return "";
  return addDaysToYmd(invoiceDate, kind === "quote" ? 14 : 30);
}

function linesFromInvoiceRecord(inv: FinanceInvoiceRow): LineDraft[] {
  if (inv.items && inv.items.length > 0) {
    return inv.items.map((item) => ({
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
  initialCustomerId = "",
  recentCustomers = [],
  products = [],
  idcompany = "",
  businessName = "",
  duitnowId,
  duitnowQrUrl,
  fpxEnabled = false,
  sstEnabled = false,
  sstRatePct = 0,
  appUrl = "",
  documentKind = "invoice",
  mergedHeader = false,
}: FinanceInvoiceComposerProps) {
  const router = useRouter();
  const formId = useId();
  const nextLineKey = useRef(1);
  const dueDateTouched = useRef(Boolean(invoice?.due_date));
  const isEdit = Boolean(invoice?.id);
  const kind = invoice?.document_kind ?? documentKind;
  const isQuote = kind === "quote";

  const startInvoiceDate = invoice?.invoice_date ?? defaultInvoiceDate;
  const startDueDate =
    invoice?.due_date ?? (!isEdit ? defaultSecondDate(startInvoiceDate, kind) : "");

  const initialNotes = (() => {
    if (invoice?.notes) return invoice.notes;
    if (kind === "quote" && !invoice?.id && startInvoiceDate && startDueDate) {
      return defaultQuoteTermsNote(startInvoiceDate, startDueDate);
    }
    return "";
  })();

  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState(
    invoice?.customer_id ?? initialCustomerId,
  );
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [title, setTitle] = useState(invoice?.title ?? "");
  const [documentNumber, setDocumentNumber] = useState(
    invoice?.number ?? nextNumberPreview ?? "",
  );
  const [invoiceDate, setInvoiceDate] = useState(startInvoiceDate);
  const [dueDate, setDueDate] = useState(startDueDate);
  const [status, setStatus] = useState<FinanceInvoiceStatus>(
    invoice?.status ?? "draft",
  );
  const [notes, setNotes] = useState(initialNotes);
  const [discountMyr, setDiscountMyr] = useState(
    fmtAmount(Number(invoice?.discount_myr ?? 0)),
  );
  const [taxPct, setTaxPct] = useState(fmtAmount(Number(invoice?.tax_pct ?? 0)));
  const [shippingMyr, setShippingMyr] = useState(
    fmtAmount(Number(invoice?.shipping_myr ?? 0)),
  );
  const [lines, setLines] = useState<LineDraft[]>(() =>
    invoice ? linesFromInvoiceRecord(invoice) : [emptyLine("line-0")],
  );
  const [savedRecord, setSavedRecord] = useState<FinanceInvoiceRow | null>(
    invoice ?? null,
  );
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] = useState<{
    customer?: string;
    number?: string;
    lines?: string;
  }>({});
  const [copyingLast, setCopyingLast] = useState(false);
  const [converting, setConverting] = useState(false);
  const [productPickId, setProductPickId] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showDuitnow, setShowDuitnow] = useState(
    invoice?.show_duitnow ?? Boolean(duitnowId),
  );
  const [adminFileId, setAdminFileId] = useState<string | null>(
    invoice?.admin_file_id ?? null,
  );
  const [adminFileName, setAdminFileName] = useState<string | null>(
    invoice?.admin_file_name ?? null,
  );

  const initialSnapshot = useRef(
    JSON.stringify({
      customerId: invoice?.customer_id ?? initialCustomerId,
      documentNumber: invoice?.number ?? nextNumberPreview ?? "",
      title: invoice?.title ?? "",
      invoiceDate: startInvoiceDate,
      dueDate: startDueDate,
      notes: initialNotes,
      lines: invoice ? linesFromInvoiceRecord(invoice) : [emptyLine("line-0")],
    }),
  );

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

  useEffect(() => {
    if (initialCustomerId && !invoice?.customer_id) {
      const c = customers.find((x) => x.id === initialCustomerId);
      if (c) setCustomerQuery(c.name);
    }
  }, [initialCustomerId, invoice?.customer_id, customers]);

  useEffect(() => {
    if (dueDateTouched.current || !invoiceDate) return;
    setDueDate(defaultSecondDate(invoiceDate, kind));
  }, [invoiceDate, kind]);

  useEffect(() => {
    if (!isQuote || !invoiceDate || !dueDate) return;
    setNotes((prev) => {
      if (!prev.trim() || isDefaultQuoteTermsNote(prev)) {
        return defaultQuoteTermsNote(invoiceDate, dueDate);
      }
      return prev;
    });
  }, [invoiceDate, dueDate, isQuote]);

  useEffect(() => {
    const snap = JSON.stringify({
      customerId,
      documentNumber,
      title,
      invoiceDate,
      dueDate,
      notes,
      lines,
    });
    const dirty = snap !== initialSnapshot.current;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [customerId, documentNumber, title, invoiceDate, dueDate, notes, lines]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const numberLabel = isQuote ? "Quote no" : "Invoice no";
  const dateLabel = isQuote ? "Quote date" : "Invoice date";
  const dueLabel = isQuote ? "Valid until" : "Due date";
  const statusOptions = FINANCE_INVOICE_STATUSES.filter((s) => {
    if (s === "void") return false;
    if (isQuote) return s === "draft" || s === "sent";
    return true;
  });

  const shareMessage = useCallback(
    (row: FinanceInvoiceRow) => {
      const url = invoiceShareUrl(appUrl, idcompany, row.share_hash);
      const total = Number(row.total_myr);
      return isQuote
        ? buildQuoteShareMessage(
            businessName,
            row.number,
            total,
            url,
            row.due_date,
          )
        : buildInvoiceShareMessage(businessName, row.number, total, url);
    },
    [appUrl, businessName, idcompany, isQuote],
  );

  const showEmailWarning =
    selectedCustomer && !selectedCustomer.email?.trim();

  const paymentPreview = useMemo(() => {
    if (isQuote) {
      return { fpx: false, duitnowQr: false, duitnowTransfer: false, hasAny: false };
    }
    const duitnowOn = showDuitnow && Boolean(duitnowQrUrl || duitnowId);
    const fpx = fpxEnabled;
    const duitnowQr = duitnowOn && Boolean(duitnowQrUrl);
    const duitnowTransfer = duitnowOn && Boolean(duitnowId);
    return {
      fpx,
      duitnowQr,
      duitnowTransfer,
      hasAny: fpx || duitnowQr || duitnowTransfer,
    };
  }, [duitnowId, duitnowQrUrl, fpxEnabled, isQuote, showDuitnow]);

  const showSstHint =
    !isQuote &&
    sstEnabled &&
    sstRatePct > 0 &&
    (parseFloat(taxPct) === 0 || !lines.some((line) => line.taxable));

  const applySst = useCallback(() => {
    setTaxPct(fmtAmount(sstRatePct));
    setLines((prev) =>
      prev.map((line) =>
        line.description.trim() ? { ...line, taxable: true } : line,
      ),
    );
  }, [sstRatePct]);

  const addLine = useCallback(() => {
    const key = `line-${nextLineKey.current++}`;
    setLines((prev) => [...prev, emptyLine(key)]);
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((line) => line.key !== key),
    );
  }, []);

  const duplicateLine = useCallback((line: LineDraft) => {
    const key = `line-${nextLineKey.current++}`;
    setLines((prev) => [
      ...prev,
      {
        ...line,
        key,
      },
    ]);
  }, []);

  const addProductLine = useCallback(() => {
    const product = products.find((p) => p.id === productPickId);
    if (!product) return;
    const key = `line-${nextLineKey.current++}`;
    setLines((prev) => [
      ...prev,
      {
        key,
        description: product.name,
        unit_price: Number(product.price_myr).toFixed(2),
        quantity: "1",
        unit: "unit",
        taxable: false,
      },
    ]);
    setProductPickId("");
  }, [productPickId, products]);

  const copyLastInvoice = useCallback(async () => {
    if (!customerId) return;
    setCopyingLast(true);
    setFormError(null);
    try {
      const params = new URLSearchParams({ customer_id: customerId });
      if (isQuote) params.set("kind", "quote");
      else params.set("kind", "invoice");
      const res = await fetch(
        `/api/finance/invoices/last-for-customer?${params.toString()}`,
      );
      const json = (await res.json()) as {
        ok?: boolean;
        data?: FinanceInvoiceRow | null;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message ?? "Could not load previous document.");
      }
      if (!json.data) {
        setToast({
          kind: "err",
          msg: isQuote
            ? "No previous quote for this customer."
            : "No previous invoice for this customer.",
        });
        return;
      }
      const src = json.data;
      setTitle(src.title ?? "");
      setNotes(src.notes ?? "");
      setDiscountMyr(fmtAmount(Number(src.discount_myr ?? 0)));
      setTaxPct(fmtAmount(Number(src.tax_pct ?? 0)));
      setShippingMyr(fmtAmount(Number(src.shipping_myr ?? 0)));
      setLines(linesFromInvoiceRecord(src));
      setToast({ kind: "ok", msg: `Copied from ${src.number}.` });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Copy failed.");
    } finally {
      setCopyingLast(false);
    }
  }, [customerId, isQuote]);

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

  const validateForm = useCallback((): boolean => {
    const errors: typeof fieldErrors = {};
    if (!customerId) errors.customer = "Select a customer.";
    const trimmedNumber = documentNumber.trim().toUpperCase();
    if (!trimmedNumber) {
      errors.number = `${numberLabel} is required.`;
    } else if (
      !/^[A-Z0-9][A-Z0-9._-]*$/.test(trimmedNumber) ||
      trimmedNumber.length > 40
    ) {
      errors.number =
        "Use 1–40 characters: letters, numbers, hyphens, dots, or underscores.";
    }
    const validLines = parsedLines.filter(
      (line) => line.description && line.quantity > 0,
    );
    if (validLines.length === 0) {
      errors.lines = "Add at least one line item with a description.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Fix the highlighted fields before saving.");
      return false;
    }
    setFieldErrors({});
    setFormError(null);
    return true;
  }, [customerId, documentNumber, numberLabel, parsedLines]);

  const saveInvoice = useCallback(
    async (nextStatus?: FinanceInvoiceStatus): Promise<FinanceInvoiceRow | null> => {
      if (!validateForm()) return null;

      const validLines = parsedLines.filter(
        (line) => line.description && line.quantity > 0,
      );
      const trimmedNumber = documentNumber.trim().toUpperCase();

      setSaving(true);
      setFormError(null);
      setFieldErrors({});

      const payload = {
        customer_id: customerId,
        number: trimmedNumber,
        title: title || null,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        notes: notes || null,
        discount_myr: parseFloat(discountMyr) || 0,
        discount_pct: 0,
        tax_myr: totals.tax_myr,
        tax_pct: parseFloat(taxPct) || 0,
        shipping_myr: parseFloat(shippingMyr) || 0,
        status: nextStatus ?? (isEdit ? status : "draft"),
        document_kind: kind,
        show_duitnow: isQuote ? false : showDuitnow,
        admin_file_id: adminFileId,
        items: validLines,
      };

      try {
        const res = await fetch(
          savedRecord?.id
            ? `/api/finance/invoices/${savedRecord.id}`
            : "/api/finance/invoices",
          {
            method: savedRecord?.id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const json = await res.json();
        if (!res.ok || !json.ok || !json.data) {
          const msg = apiErrorMessage(json, "Could not save.");
          if (res.status === 409) {
            setFieldErrors({ number: msg });
          }
          throw new Error(msg);
        }
        const row = json.data as FinanceInvoiceRow;
        setSavedRecord(row);
        initialSnapshot.current = JSON.stringify({
          customerId,
          documentNumber: row.number,
          title: row.title ?? "",
          invoiceDate: row.invoice_date,
          dueDate: row.due_date ?? "",
          notes: row.notes ?? "",
          lines: linesFromInvoiceRecord(row),
        });
        if (!savedRecord?.id) {
          router.replace(`/finance/invoices/${row.id}/edit`);
        }
        router.refresh();
        return row;
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [
      validateForm,
      customerId,
      documentNumber,
      discountMyr,
      dueDate,
      savedRecord?.id,
      invoiceDate,
      isEdit,
      notes,
      parsedLines,
      shippingMyr,
      showDuitnow,
      adminFileId,
      kind,
      isQuote,
      status,
      taxPct,
      title,
      totals.tax_myr,
      router,
    ],
  );

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const saved = await saveInvoice();
      if (saved) {
        setToast({ kind: "ok", msg: "Saved." });
      }
    },
    [saveInvoice],
  );

  const onSaveAndShare = useCallback(async () => {
    const saved = await saveInvoice("sent");
    if (!saved) return;
    const msg = shareMessage(saved);
    window.open(whatsAppShareUrl(msg), "_blank", "noopener,noreferrer");
    setToast({ kind: "ok", msg: isQuote ? "Quote saved — WhatsApp opened." : "Invoice saved — WhatsApp opened." });
  }, [isQuote, saveInvoice, shareMessage]);

  const onConvertToInvoice = useCallback(async () => {
    if (!savedRecord?.id) return;
    setConverting(true);
    setFormError(null);
    try {
      const due = addDaysToYmd(
        new Date().toISOString().slice(0, 10),
        30,
      );
      const res = await fetch(
        `/api/finance/invoices/${savedRecord.id}/convert-to-invoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ due_date: due }),
        },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        data?: FinanceInvoiceRow;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error?.message ?? "Conversion failed.");
      }
      router.push(`/finance/invoices/${json.data.id}/edit?converted=1`);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setConverting(false);
    }
  }, [router, savedRecord?.id]);

  const onPreview = useCallback(async () => {
    let row = savedRecord;
    if (!row?.share_hash) {
      row = await saveInvoice();
      if (!row?.share_hash) return;
    }
    const url = invoiceShareUrl(appUrl, idcompany, row.share_hash);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [appUrl, idcompany, saveInvoice, savedRecord]);

  const onCopyPayLink = useCallback(async () => {
    let row = savedRecord;
    if (!row?.share_hash) {
      row = await saveInvoice("sent");
      if (!row?.share_hash) return;
    }
    const url = invoiceShareUrl(appUrl, idcompany, row.share_hash);
    try {
      await navigator.clipboard.writeText(url);
      setToast({ kind: "ok", msg: "Link copied." });
    } catch {
      setFormError("Could not copy link.");
    }
  }, [appUrl, idcompany, saveInvoice, savedRecord]);

  const handleLineKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      index: number,
      field: "description" | "quantity" | "unit_price",
    ) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      const isLastLine = index === lines.length - 1;
      if (isLastLine && field === "unit_price") {
        e.preventDefault();
        addLine();
      }
    },
    [addLine, lines.length],
  );

  const onSaveAndEmail = useCallback(async () => {
    const saved = await saveInvoice("sent");
    if (!saved?.id) return;

    if (!saved.customer_email?.trim()) {
      const msg = shareMessage(saved);
      window.open(whatsAppShareUrl(msg), "_blank", "noopener,noreferrer");
      setToast({
        kind: "ok",
        msg: "No email on file — opened WhatsApp instead.",
      });
      return;
    }

    setEmailSending(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/finance/invoices/${saved.id}/send`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        throw new Error(
          json.error?.message ?? "Could not email customer.",
        );
      }
      setToast({
        kind: "ok",
        msg: isQuote ? "Quote sent by email." : "Invoice sent by email.",
      });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not send email.",
      );
    } finally {
      setEmailSending(false);
    }
  }, [isQuote, saveInvoice, shareMessage]);

  const headerTitle = isQuote
    ? isEdit
      ? "Edit quote"
      : "New quote"
    : isEdit
      ? "Edit invoice"
      : "New invoice";

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3 pb-20">
      {toast ? (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            toast.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-status-danger/30 bg-status-danger/10 text-status-danger",
          )}
        >
          {toast.msg}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-cream-200 bg-gradient-to-br from-brand-50 via-white to-cream-50 p-4 shadow-card dark:border-hairline-dark dark:from-brand-950/30 dark:via-panel-dark dark:to-panel-dark">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {mergedHeader ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700/70 dark:text-brand-200/70">
                  Finance
                </p>
                <span className="text-ink-muted dark:text-cream-500">·</span>
                <h1 className="text-lg font-semibold text-ink dark:text-cream-100">
                  {headerTitle}
                </h1>
              </div>
            ) : (
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                {headerTitle}
              </p>
            )}
            {!mergedHeader && (
              <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                {isQuote
                  ? "Send a quote — convert to invoice when they say yes."
                  : "Bill a customer and share a pay link."}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-ink-muted dark:text-cream-400">
              Total
            </p>
            <p className="text-xl font-bold tabular-nums text-ink dark:text-cream-100">
              RM {fmtAmount(totals.total_myr)}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label={numberLabel} compact>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => {
                setDocumentNumber(e.target.value.toUpperCase());
                setFieldErrors((prev) => ({ ...prev, number: undefined }));
              }}
              placeholder={nextNumberPreview ?? "INV-2026-0001"}
              className={cn(
                compactFieldCx,
                "font-semibold tracking-tight",
                fieldErrors.number &&
                  "border-status-danger focus:border-status-danger focus:ring-status-danger/30",
              )}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(fieldErrors.number)}
            />
          </Field>
          <Field label={dateLabel} compact>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className={compactFieldCx}
            />
          </Field>
          <Field label={dueLabel} compact>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                dueDateTouched.current = true;
                setDueDate(e.target.value);
              }}
              className={compactFieldCx}
            />
          </Field>
          {isEdit ? (
            <Field label="Status" compact>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as FinanceInvoiceStatus)
                }
                className={compactFieldCx}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Title (optional)" compact>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. March retainer"
                className={compactFieldCx}
              />
            </Field>
          )}
        </div>
        {fieldErrors.number ? (
          <p className="mt-1 text-xs text-status-danger">{fieldErrors.number}</p>
        ) : null}
      </section>

      {isQuote && savedRecord?.id ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 dark:border-brand-800 dark:bg-brand-950/30">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
              Quote saved
            </p>
            <p className="text-xs text-brand-800/90 dark:text-brand-200/90">
              Customer accepted? Convert to a draft invoice in one click.
            </p>
          </div>
          <button
            type="button"
            disabled={converting || saving}
            onClick={() => void onConvertToInvoice()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {converting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Convert to invoice
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        {/* Customer */}
        <div className="border-b border-cream-200 px-4 py-3 sm:px-4 dark:border-hairline-dark">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                Customer
              </span>
              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-200"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={customerQuery}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setCustomerOpen(true);
                  if (!e.target.value) setCustomerId("");
                  setFieldErrors((prev) => ({ ...prev, customer: undefined }));
                }}
                onFocus={() => setCustomerOpen(true)}
                placeholder="Search customer…"
                className={cn(
                  compactFieldCx,
                  "pl-8 pr-8",
                  fieldErrors.customer &&
                    "border-status-danger focus:border-status-danger focus:ring-status-danger/30",
                )}
                aria-invalid={Boolean(fieldErrors.customer)}
              />
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              {customerOpen && filteredCustomers.length > 0 ? (
                <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-cream-300 bg-white py-1 shadow-lg dark:border-hairline-dark dark:bg-panel-dark">
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
            {fieldErrors.customer ? (
              <p className="text-xs text-status-danger">{fieldErrors.customer}</p>
            ) : selectedCustomer ? (
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {selectedCustomer.phone_e164 ?? "No phone"}
                {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ""}
                {!selectedCustomer.email?.trim() ? (
                  <span className="text-amber-700 dark:text-amber-300">
                    {" "}
                    · No email — use Save &amp; share
                  </span>
                ) : null}
                <Link
                  href="/finance/customers"
                  className="ml-2 font-semibold text-brand-700 dark:text-brand-200"
                >
                  Edit
                </Link>
              </p>
            ) : (
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Pick a saved customer to bill.
              </p>
            )}
            {recentCustomers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {recentCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerQuery(c.name);
                      setCustomerOpen(false);
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                      customerId === c.id
                        ? "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-100"
                        : "border-cream-300 text-ink-muted hover:border-brand-200 dark:border-hairline-dark dark:text-cream-400",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            ) : null}
            {customerId ? (
              <button
                type="button"
                disabled={copyingLast}
                onClick={() => void copyLastInvoice()}
                className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-60 dark:text-brand-200"
              >
                {copyingLast ? "Copying…" : isQuote ? "Copy last quote" : "Copy last invoice"}
              </button>
            ) : null}
          </div>
          {isEdit ? (
            <div className="mt-2 border-t border-cream-100 pt-2 dark:border-hairline-dark">
              <Field label="Title (optional)" compact>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Website design — March"
                  className={compactFieldCx}
                />
              </Field>
            </div>
          ) : null}
        </div>

        {/* Line items */}
        <div className="border-b border-cream-200 px-4 py-3 sm:px-4 dark:border-hairline-dark">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              Line items
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {products.length > 0 ? (
                <>
                  <select
                    value={productPickId}
                    onChange={(e) => setProductPickId(e.target.value)}
                    className="h-8 max-w-[180px] rounded-lg border border-cream-300 bg-white px-2 text-xs dark:border-hairline-dark dark:bg-panel-dark"
                  >
                    <option value="">From catalog…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — RM {Number(p.price_myr).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!productPickId}
                    onClick={addProductLine}
                    className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-cream-50 disabled:opacity-50 dark:border-hairline-dark dark:text-cream-100"
                  >
                    Add product
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                <Plus className="h-3.5 w-3.5" />
                Add row
              </button>
            </div>
          </div>
          {fieldErrors.lines ? (
            <p className="mb-2 text-xs text-status-danger">{fieldErrors.lines}</p>
          ) : null}
          {showSstHint ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="text-xs text-amber-900 dark:text-amber-100">
                SST is enabled at{" "}
                <span className="font-semibold tabular-nums">{sstRatePct}%</span>
                {" — "}tick <span className="font-medium">Tax</span> on taxable
                lines and set the rate below.
              </p>
              <button
                type="button"
                onClick={applySst}
                className="shrink-0 rounded-md bg-amber-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-900 dark:bg-amber-700 dark:hover:bg-amber-600"
              >
                Apply {sstRatePct}% SST
              </button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-cream-200 dark:border-hairline-dark">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 bg-cream-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:border-hairline-dark dark:bg-panel-dark/60 dark:text-cream-400">
                  <th className="px-3 py-2">Description</th>
                  <th className="w-16 px-2 py-2">Qty</th>
                  <th className="w-20 px-2 py-2">Unit</th>
                  <th className="w-24 px-2 py-2 text-right">Price</th>
                  <th className="w-10 px-2 py-2 text-center">Tax</th>
                  <th className="w-24 px-2 py-2 text-right">Amount</th>
                  <th className="w-16 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100 dark:divide-hairline-dark">
                {lines.map((line, index) => {
                  const taxInputId = `${formId}-tax-${index}`;
                  const lineInvalid =
                    Boolean(fieldErrors.lines) && !line.description.trim();
                  const total = lineTotal(
                    parseFloat(line.unit_price) || 0,
                    parseFloat(line.quantity) || 0,
                  );
                  return (
                    <tr key={line.key} className="group">
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => {
                            setLines((prev) =>
                              prev.map((row) =>
                                row.key === line.key
                                  ? { ...row, description: e.target.value }
                                  : row,
                              ),
                            );
                            setFieldErrors((prev) => ({ ...prev, lines: undefined }));
                          }}
                          onKeyDown={(e) =>
                            handleLineKeyDown(e, index, "description")
                          }
                          placeholder="What are you billing?"
                          className={cn(
                            tableInputCx,
                            lineInvalid &&
                              "border-status-danger focus:border-status-danger focus:ring-status-danger/30",
                          )}
                          aria-invalid={lineInvalid}
                        />
                      </td>
                      <td className="px-1 py-1.5">
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
                          onKeyDown={(e) =>
                            handleLineKeyDown(e, index, "quantity")
                          }
                          className={cn(tableInputCx, "text-right")}
                        />
                      </td>
                      <td className="px-1 py-1.5">
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
                          className={tableInputCx}
                        >
                          {UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1.5">
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
                          onKeyDown={(e) =>
                            handleLineKeyDown(e, index, "unit_price")
                          }
                          className={cn(tableInputCx, "text-right")}
                        />
                      </td>
                      <td className="px-1 py-1.5 text-center">
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
                          className="h-3.5 w-3.5 rounded border-cream-400"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-ink dark:text-cream-100">
                        {fmtAmount(total)}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => duplicateLine(line)}
                            className="rounded p-1 text-ink-muted opacity-60 hover:bg-cream-100 hover:text-brand-700 group-hover:opacity-100 dark:hover:bg-panel-dark/80 dark:hover:text-brand-200"
                            aria-label="Duplicate line"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {lines.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeLine(line.key)}
                              className="rounded p-1 text-ink-muted opacity-60 hover:bg-status-danger/10 hover:text-status-danger group-hover:opacity-100"
                              aria-label="Remove line"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes + totals */}
        <div className="grid border-b border-cream-200 lg:grid-cols-[1fr_minmax(200px,240px)] lg:divide-x lg:divide-cream-200 dark:border-hairline-dark dark:lg:divide-hairline-dark">
          <div className="px-4 py-3 sm:px-4">
            <Field label={isQuote ? "Terms & notes" : "Notes (optional)"} compact>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  isQuote
                    ? "Prices valid 14 days, payment terms…"
                    : "Payment terms, thank-you note…"
                }
                rows={3}
                className={textareaFieldCx}
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
              label={sstEnabled ? "SST / tax (%)" : "Tax (%)"}
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

        {/* Payment + attachment */}
        <div
          className={cn(
            "divide-y divide-cream-200 dark:divide-hairline-dark",
            !isQuote && "sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0",
          )}
        >
          {!isQuote ? (
            <div className="min-w-0 space-y-2 px-4 py-2.5 sm:px-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                Payment on invoice
              </p>
              {duitnowId || duitnowQrUrl ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showDuitnow}
                    onChange={(e) => setShowDuitnow(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-cream-400"
                  />
                  <span className="text-ink dark:text-cream-100">
                    Show DuitNow
                    {duitnowId ? ` — ${duitnowId}` : ""}
                  </span>
                </label>
              ) : (
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  <Link
                    href="/settings/branding"
                    className="font-semibold text-brand-700 hover:underline dark:text-brand-200"
                  >
                    Add DuitNow in Branding
                  </Link>{" "}
                  to show pay details on the invoice link.
                </p>
              )}

              <div className="rounded-md border border-cream-200 bg-cream-50/80 p-2 dark:border-hairline-dark dark:bg-panel-dark/50">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                  Public link preview
                </p>
                <ul className="space-y-1.5">
                  <PaymentPreviewRow
                    active={paymentPreview.fpx}
                    label="FPX / card online"
                    detail={
                      paymentPreview.fpx
                        ? "Pay button on invoice link"
                        : "Billplz not configured"
                    }
                  />
                  <PaymentPreviewRow
                    active={paymentPreview.duitnowQr}
                    label="DuitNow QR scan"
                    detail={
                      paymentPreview.duitnowQr
                        ? "QR from Branding settings"
                        : duitnowQrUrl
                          ? "Enable “Show DuitNow” above"
                          : "Upload QR in Branding"
                    }
                  />
                  <PaymentPreviewRow
                    active={paymentPreview.duitnowTransfer}
                    label="DuitNow transfer fields"
                    detail={
                      paymentPreview.duitnowTransfer
                        ? paymentPreview.duitnowQr
                          ? "Fallback copy fields below QR"
                          : "Copy ID, amount, reference"
                        : duitnowId
                          ? "Enable “Show DuitNow” above"
                          : "Add DuitNow ID in Branding"
                    }
                  />
                </ul>
                {!paymentPreview.hasAny ? (
                  <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                    Customers won&apos;t see a pay section until FPX or DuitNow
                    is set up.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "flex min-w-0 items-center gap-2 px-4 py-2.5 sm:px-4",
              !isQuote && "sm:pl-4",
            )}
          >
            <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              Attachment
            </span>
            <AdminStorageFileAttach
              fileId={adminFileId}
              fileName={adminFileName}
              compact
              className="min-w-0 flex-1"
              onAttach={async (fileId) => {
                if (isEdit && invoice?.id) {
                  const res = await fetch(`/api/finance/invoices/${invoice.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ admin_file_id: fileId }),
                  });
                  const json = await res.json();
                  if (!res.ok || !json.ok) {
                    throw new Error(
                      apiErrorMessage(json, "Could not attach document."),
                    );
                  }
                  const row = json.data as FinanceInvoiceRow;
                  setAdminFileId(row.admin_file_id);
                  setAdminFileName(row.admin_file_name ?? null);
                } else {
                  setAdminFileId(fileId);
                  const picked = await fetch("/api/admin/storage/picker?limit=100")
                    .then((r) => r.json())
                    .then(
                      (j: {
                        ok: boolean;
                        data?: { files: { id: string; file_name: string }[] };
                      }) =>
                        j.data?.files.find((f) => f.id === fileId)?.file_name ??
                        null,
                    );
                  setAdminFileName(picked);
                }
              }}
            />
          </div>
        </div>
      </div>

      {formError ? (
        <p role="alert" className="mt-3 text-sm text-status-danger">
          {formError}
        </p>
      ) : null}

      {/* Fixed footer */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-300 bg-white/95 px-4 py-3 backdrop-blur dark:border-hairline-dark dark:bg-panel-dark/95">
        <div className="mx-auto max-w-5xl space-y-2">
          {showEmailWarning ? (
            <p className="text-center text-xs text-amber-800 dark:text-amber-200 sm:text-left">
              No email on file — &ldquo;{isQuote ? "Save & send quote" : "Save & email"}&rdquo; will open WhatsApp instead.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/finance/invoices"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cream-400 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onPreview()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cream-400 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-cream-50 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <ExternalLink className="h-4 w-4" />
              Preview
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onCopyPayLink()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cream-400 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-cream-50 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <Copy className="h-4 w-4" />
              Copy link
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSaveAndShare()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60 dark:border-brand-400 dark:bg-panel-dark dark:text-brand-200 dark:hover:bg-brand-950/30"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              Save &amp; share
            </button>
            <button
              type="button"
              disabled={saving || emailSending}
              onClick={() => void onSaveAndEmail()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60 dark:border-brand-400 dark:bg-panel-dark dark:text-brand-200 dark:hover:bg-brand-950/30"
            >
              {saving || emailSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {isQuote ? "Save & send quote" : "Save & email"}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
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
  compact,
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span
        className={cn(
          "mb-1 block font-medium text-ink-muted dark:text-cream-400",
          compact ? "mb-0.5 text-[10px] uppercase tracking-wide" : "mb-1 text-xs",
        )}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function PaymentPreviewRow({
  active,
  label,
  detail,
}: {
  active: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-2 text-xs">
      {active ? (
        <Check
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success"
          strokeWidth={2.5}
        />
      ) : (
        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted/50 dark:text-cream-500" />
      )}
      <span className="min-w-0">
        <span
          className={cn(
            "font-medium",
            active
              ? "text-ink dark:text-cream-100"
              : "text-ink-muted dark:text-cream-400",
          )}
        >
          {label}
        </span>
        <span className="text-ink-muted dark:text-cream-500"> — {detail}</span>
      </span>
    </li>
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
        "grid grid-cols-2 items-center gap-2 px-3 py-2 sm:px-4",
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
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

const compactFieldCx =
  "h-9 w-full rounded-lg border border-cream-300 bg-white px-3 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

const textareaFieldCx =
  "min-h-[72px] w-full resize-y rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm leading-relaxed text-ink focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

const tableInputCx =
  "h-8 w-full rounded border-0 bg-transparent px-2 text-sm text-ink placeholder:text-ink-muted/60 focus:bg-cream-50 focus:outline-none focus:ring-1 focus:ring-brand-400/40 dark:text-cream-100 dark:focus:bg-panel-dark/80";

const summaryInputCx =
  "h-8 w-full rounded border border-cream-300 bg-white px-2 text-right text-sm tabular-nums focus:border-brand-500 focus:outline-none dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";
