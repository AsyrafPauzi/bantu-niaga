"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Banknote,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Minus,
  Plus,
  QrCode,
  Receipt,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { SalesBackLink } from "@/components/sales/SalesBackLink";
import { PosReceiptView, type PosReceiptData } from "@/components/sales/PosReceiptView";
import { formatMyr } from "@/lib/marketing/metrics";
import { salesClasses } from "@/lib/sales/theme";
import { cn } from "@/lib/utils/cn";

interface PosProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  price_myr: number;
  stock_qty?: number | null;
  low_stock_threshold?: number | null;
  image_url?: string | null;
}

interface CustomerHit {
  id: string;
  name: string;
  phone_e164: string | null;
}

interface PosService {
  id: string;
  name: string;
  price_myr: number;
  duration_minutes: number | null;
}

interface CartLine {
  kind: "product" | "service";
  id: string;
  name: string;
  price_myr: number;
  quantity: number;
}

// ReceiptData is defined in PosReceiptView — imported as PosReceiptData above.
type ReceiptData = PosReceiptData;

interface PosCheckoutClientProps {
  businessName: string;
  sstEnabled: boolean;
  sstRatePct: number;
  duitnowId: string | null;
  duitnowQrUrl: string | null;
  canCheckout: boolean;
  todaySalesMyr: number;
  todayTxnCount: number;
  initialCustomerId?: string;
  initialCustomerName?: string;
  initialLeadId?: string;
  initialLeadName?: string;
  initialLeadPhone?: string;
}

function money(n: number) {
  return `RM ${n.toFixed(2)}`;
}

export function PosCheckoutClient({
  businessName,
  sstEnabled,
  sstRatePct,
  duitnowId,
  duitnowQrUrl,
  canCheckout,
  todaySalesMyr,
  todayTxnCount,
  initialCustomerId,
  initialCustomerName,
  initialLeadId,
  initialLeadName,
  initialLeadPhone,
}: PosCheckoutClientProps) {
  const tSales = useTranslations("sales");
  const tNav = useTranslations("nav");
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [services, setServices] = useState<PosService[]>([]);
  const [catalogMode, setCatalogMode] = useState<"products" | "services">(
    "products",
  );
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountType, setDiscountType] = useState<"amount" | "pct" | null>(
    null,
  );
  const [discountValue, setDiscountValue] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "duitnow_qr_static">(
    "cash",
  );
  const [cashReceived, setCashReceived] = useState("");
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [customerName, setCustomerName] = useState(
    initialCustomerName ?? initialLeadName ?? "",
  );
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<CustomerHit[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [showExtras, setShowExtras] = useState(
    Boolean(initialLeadId || initialCustomerId),
  );
  const [shareDone, setShareDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [addedPulse, setAddedPulse] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("bn-pos-tour-v1")) setShowTour(true);
    } catch {
      setShowTour(true);
    }
  }, []);

  function dismissTour() {
    try {
      localStorage.setItem("bn-pos-tour-v1", "done");
    } catch { /* ignore */ }
    setShowTour(false);
  }

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, svcRes] = await Promise.all([
        fetch("/api/sales/pos/products"),
        fetch("/api/sales/pos/services"),
      ]);
      const prodJson = (await prodRes.json()) as {
        data?: PosProduct[];
        error?: string;
      };
      const svcJson = (await svcRes.json()) as {
        data?: PosService[];
        error?: string;
      };
      if (!prodRes.ok) throw new Error(prodJson.error ?? "Failed to load products");
      setProducts(
        (prodJson.data ?? []).map((p) => ({
          ...p,
          price_myr: Number(p.price_myr),
        })),
      );
      setServices(
        (svcJson.data ?? []).map((s) => ({
          ...s,
          price_myr: Number(s.price_myr),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const needle = customerQuery.trim();
    if (needle.length < 2) {
      setCustomerHits([]);
      return;
    }
    const timer = setTimeout(() => {
      void (async () => {
        setCustomerSearching(true);
        try {
          const res = await fetch(
            `/api/sales/pos/customer-search?q=${encodeURIComponent(needle)}`,
          );
          const json = (await res.json()) as { data?: CustomerHit[] };
          setCustomerHits(json.data ?? []);
        } catch {
          setCustomerHits([]);
        } finally {
          setCustomerSearching(false);
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category?.trim()) set.add(p.category.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products]);

  function isLowStock(p: PosProduct): boolean {
    if (p.stock_qty == null || p.low_stock_threshold == null) return false;
    return p.stock_qty <= p.low_stock_threshold;
  }

  function pulseAdd(key: string) {
    setAddedPulse(key);
    setTimeout(() => setAddedPulse(null), 400);
  }

  function receiptText(data: ReceiptData): string {
    const lines = [
      businessName,
      data.sale.sale_number,
      "",
      ...data.items.map(
        (it) =>
          `${it.product_name} x${it.quantity} — ${money(Number(it.line_total_myr))}`,
      ),
      "",
      `Total: ${money(Number(data.sale.total_myr))}`,
      `Paid: ${data.sale.payment_method === "cash" ? "Cash" : "DuitNow QR"}`,
    ];
    return lines.join("\n");
  }

  async function copyReceipt(data: ReceiptData) {
    try {
      await navigator.clipboard.writeText(receiptText(data));
      setShareDone(true);
      setTimeout(() => setShareDone(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  function shareWhatsApp(data: ReceiptData) {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(receiptText(data))}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (catalogMode === "services") {
      if (!needle) return services;
      return services.filter((s) => s.name.toLowerCase().includes(needle));
    }
    let list = products;
    if (categoryFilter) {
      list = list.filter((p) => p.category === categoryFilter);
    }
    if (!needle) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        (p.category ?? "").toLowerCase().includes(needle),
    );
  }, [products, services, q, catalogMode, categoryFilter]);

  const lineSubtotal = cart.reduce(
    (a, l) => a + l.price_myr * l.quantity,
    0,
  );

  const discountAmount = useMemo(() => {
    const v = Number(discountValue);
    if (!discountType || !Number.isFinite(v) || v < 0) return 0;
    if (discountType === "amount") return Math.min(lineSubtotal, v);
    return Math.min(lineSubtotal, (lineSubtotal * v) / 100);
  }, [discountType, discountValue, lineSubtotal]);

  const afterDiscount = Math.max(0, lineSubtotal - discountAmount);
  const sst = sstEnabled ? (afterDiscount * sstRatePct) / 100 : 0;
  const total = afterDiscount + sst;
  const cartCount = cart.reduce((a, l) => a + l.quantity, 0);

  const cashIn = cashReceived !== "" ? Number(cashReceived) : total;
  const changeDue =
    payMethod === "cash" && Number.isFinite(cashIn) ? Math.max(0, cashIn - total) : 0;

  function addProduct(p: PosProduct) {
    pulseAdd(`product:${p.id}`);
    setCart((prev) => {
      const i = prev.findIndex((l) => l.kind === "product" && l.id === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          kind: "product",
          id: p.id,
          name: p.name,
          price_myr: p.price_myr,
          quantity: 1,
        },
      ];
    });
  }

  function addService(s: PosService) {
    pulseAdd(`service:${s.id}`);
    setCart((prev) => {
      const i = prev.findIndex((l) => l.kind === "service" && l.id === s.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          kind: "service",
          id: s.id,
          name: s.name,
          price_myr: s.price_myr,
          quantity: 1,
        },
      ];
    });
  }

  function setQty(lineKey: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          `${l.kind}:${l.id}` === lineKey ? { ...l, quantity } : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }

  async function completeSale() {
    if (!canCheckout || cart.length === 0 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const body = {
        items: cart.map((l) =>
          l.kind === "product"
            ? { product_id: l.id, quantity: l.quantity }
            : { service_id: l.id, quantity: l.quantity },
        ),
        payment_method: payMethod,
        discount_type: couponCode.trim() ? null : discountType,
        discount_value:
          !couponCode.trim() && discountType && discountValue !== ""
            ? Number(discountValue)
            : null,
        coupon_code: couponCode.trim() || null,
        payment_received_myr:
          payMethod === "cash"
            ? cashReceived !== ""
              ? Number(cashReceived)
              : total
            : null,
        customer_id: customerId.trim() || null,
        customer_name: customerName.trim() || null,
      };

      const res = await fetch("/api/sales/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        data?: ReceiptData;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Checkout failed");
      }
      if (!json.data) throw new Error("No receipt returned");
      setReceipt(json.data);
      setCart([]);
      setDiscountType(null);
      setDiscountValue("");
      setCouponCode("");
      setCashReceived("");
      if (!initialLeadId && !initialCustomerId) {
        setCustomerName("");
        setCustomerId("");
      }
      setCustomerQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <PosReceiptView
        receipt={receipt}
        shareDone={shareDone}
        onNewSale={() => {
          setReceipt(null);
          setShareDone(false);
        }}
        onCopy={() => void copyReceipt(receipt)}
        onWhatsApp={() => shareWhatsApp(receipt)}
      />
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      {showTour ? (
        <div className="relative rounded-xl border border-violet-200/80 bg-violet-50/80 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
          <button
            type="button"
            onClick={dismissTour}
            className="absolute right-3 top-3 rounded-lg p-1 text-ink-muted hover:bg-white/60 dark:text-cream-400"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            How POS works — 3 steps
          </p>
          <ol className="mt-2 grid gap-2 pr-6 sm:grid-cols-3">
            {[
              { n: 1, title: "Find & add items", body: "Search or browse your product/service catalogue. Tap any item to add it to the cart on the right." },
              { n: 2, title: "Review the cart", body: "Adjust quantities with + / −. Add a coupon or discount if needed. The total updates live." },
              { n: 3, title: "Choose payment & complete", body: "Select Cash or DuitNow QR, tap Complete Sale, and a receipt is printed or shared." },
            ].map((step) => (
              <li key={step.n} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-200 text-[11px] font-bold text-violet-800 dark:bg-violet-800/40 dark:text-violet-200">
                  {step.n}
                </span>
                <div>
                  <p className="text-xs font-semibold text-ink dark:text-cream-100">{step.title}</p>
                  <p className="text-xs text-ink-muted dark:text-cream-400">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={dismissTour}
            className="mt-3 text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
          >
            Got it, don&apos;t show again
          </button>
        </div>
      ) : null}
      {/* Header */}
      <section
        className={cn(
          "rounded-xl border p-4 shadow-sm sm:p-5",
          salesClasses.heroBorder,
          salesClasses.heroBg,
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <SalesBackLink />
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-widest",
                salesClasses.textMuted,
              )}
            >
              {tNav("sales")}
            </p>
            <h1 className="text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
              {tSales("pos")}
            </h1>
            <p className="text-sm text-ink-muted dark:text-cream-400">{businessName}</p>
          </div>
          <div
            className={cn(
              "rounded-xl border px-4 py-2.5 text-right",
              salesClasses.sectionPanelItem,
            )}
          >
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                salesClasses.eyebrow,
              )}
            >
              Today
            </p>
            <p className="text-lg font-bold tabular-nums text-ink dark:text-cream-100">
              {formatMyr(todaySalesMyr)}
            </p>
            <p className="text-xs text-ink-muted">
              {todayTxnCount} sale{todayTxnCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </section>

      {/* Lead / customer pre-fill chip */}
      {(initialLeadId || initialCustomerId) && customerName ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
          <Sparkles className="h-3.5 w-3.5" />
          {initialLeadId ? "Lead" : "Customer"}: {customerName}
          {initialLeadPhone ? ` · ${initialLeadPhone}` : ""}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
        {/* Catalog */}
        <section className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex flex-col gap-2 border-b border-cream-200 p-3 sm:flex-row sm:flex-wrap sm:items-center dark:border-hairline-dark">
            <div className="flex flex-1 gap-1 rounded-xl bg-cream-100 p-1 dark:bg-hairline-dark/40 sm:min-w-[10rem] sm:flex-none">
              {(["products", "services"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setCatalogMode(mode);
                    setCategoryFilter(null);
                  }}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2.5 text-xs font-bold capitalize transition",
                    catalogMode === mode
                      ? "bg-white text-blue-800 shadow-sm dark:bg-panel-dark dark:text-blue-200"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="relative min-w-0 w-full sm:flex-[2]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-xl border border-cream-200 bg-cream-50/50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-300 dark:border-hairline-dark dark:bg-panel-dark"
              />
            </div>
          </div>

          {catalogMode === "products" && categories.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto border-b border-cream-100 px-3 py-2 dark:border-hairline-dark/50">
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition",
                  !categoryFilter
                    ? "bg-[#2563EB] text-white"
                    : "bg-cream-100 text-ink-muted hover:bg-cream-200 dark:bg-hairline-dark/40",
                )}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize transition",
                    categoryFilter === cat
                      ? "bg-[#2563EB] text-white"
                      : "bg-cream-100 text-ink-muted hover:bg-cream-200 dark:bg-hairline-dark/40",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          ) : null}

          <div className="p-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
                <Loader2 className="h-5 w-5 animate-spin text-[#2563EB]" />
                Loading catalog…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <ShoppingBag className="mx-auto h-10 w-10 text-ink-subtle" />
                <p className="mt-3 text-sm font-medium text-ink-muted">
                  No {catalogMode} yet
                </p>
                <Link
                  href={
                    catalogMode === "products"
                      ? "/operations/products"
                      : "/operations/services"
                  }
                  className="mt-1 inline-block text-sm font-semibold text-blue-700 dark:text-blue-300"
                >
                  Add in Operations
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {catalogMode === "products"
                  ? (filtered as PosProduct[]).map((p) => {
                      const low = isLowStock(p);
                      const key = `product:${p.id}`;
                      const inCart = cart.find(
                        (l) => l.kind === "product" && l.id === p.id,
                      );
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addProduct(p)}
                          className={cn(
                            "group relative flex flex-col rounded-xl border p-3 text-left transition touch-manipulation active:scale-[0.97]",
                            "border-cream-200 hover:border-blue-300 hover:bg-blue-50/50 dark:border-hairline-dark dark:hover:border-blue-800 dark:hover:bg-blue-950/20",
                            addedPulse === key && "ring-2 ring-blue-400",
                            low && "border-amber-300/80",
                          )}
                        >
                          {p.image_url ? (
                            <div className="relative mb-2 aspect-[4/3] w-full overflow-hidden rounded-lg bg-cream-100 dark:bg-hairline-dark/40">
                              <Image
                                src={p.image_url}
                                alt=""
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : null}
                          {inCart ? (
                            <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2563EB] px-1 text-[10px] font-bold text-white">
                              {inCart.quantity}
                            </span>
                          ) : null}
                          <p className="line-clamp-2 pr-6 text-sm font-bold leading-snug text-ink group-hover:text-blue-900 dark:text-cream-100 dark:group-hover:text-blue-100">
                            {p.name}
                          </p>
                          {p.category ? (
                            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-subtle">
                              {p.category}
                            </p>
                          ) : null}
                          {low ? (
                            <p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                              {p.stock_qty} left
                            </p>
                          ) : null}
                          <p className="mt-auto pt-2 text-base font-bold tabular-nums text-blue-600 dark:text-blue-400">
                            {money(p.price_myr)}
                          </p>
                        </button>
                      );
                    })
                  : (filtered as PosService[]).map((s) => {
                      const key = `service:${s.id}`;
                      const inCart = cart.find(
                        (l) => l.kind === "service" && l.id === s.id,
                      );
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => addService(s)}
                          className={cn(
                            "group relative flex flex-col rounded-xl border border-cream-200 p-3 text-left transition touch-manipulation active:scale-[0.97] hover:border-blue-300 hover:bg-blue-50/50 dark:border-hairline-dark dark:hover:border-blue-800 dark:hover:bg-blue-950/20",
                            addedPulse === key && "ring-2 ring-blue-400",
                          )}
                        >
                          {inCart ? (
                            <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2563EB] px-1 text-[10px] font-bold text-white">
                              {inCart.quantity}
                            </span>
                          ) : null}
                          <p className="line-clamp-2 pr-6 text-sm font-bold leading-snug text-ink dark:text-cream-100">
                            {s.name}
                          </p>
                          {s.duration_minutes ? (
                            <p className="mt-1 text-[10px] text-ink-muted">
                              {s.duration_minutes} min
                            </p>
                          ) : null}
                          <p className="mt-auto pt-2 text-base font-bold tabular-nums text-blue-600 dark:text-blue-400">
                            {money(s.price_myr)}
                          </p>
                        </button>
                      );
                    })}
              </div>
            )}
          </div>
        </section>

        {/* Cart panel */}
        <section className="flex flex-col rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark md:sticky md:top-4 md:max-h-[calc(100dvh-6rem)]">
          <div className="border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB] text-white">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink dark:text-cream-100">
                    Current order
                  </p>
                  <p className="text-xs text-ink-muted">
                    {cartCount} item{cartCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <p className="text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {money(total)}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-2xl bg-cream-100 p-4 dark:bg-hairline-dark/40">
                  <ShoppingBag className="h-8 w-8 text-ink-subtle" />
                </div>
                <p className="mt-3 text-sm font-medium text-ink-muted">
                  Tap items to build an order
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {cart.map((l) => {
                  const lineKey = `${l.kind}:${l.id}`;
                  const lineTotal = l.price_myr * l.quantity;
                  return (
                    <li
                      key={lineKey}
                      className="flex items-center gap-2 rounded-xl bg-cream-50/80 p-2.5 dark:bg-hairline-dark/20"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{l.name}</p>
                        <p className="text-xs tabular-nums text-ink-muted">
                          {money(lineTotal)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-cream-300 hover:bg-white dark:border-hairline-dark"
                          onClick={() => setQty(lineKey, l.quantity - 1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-bold tabular-nums">
                          {l.quantity}
                        </span>
                        <button
                          type="button"
                          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-cream-300 hover:bg-white dark:border-hairline-dark"
                          onClick={() => setQty(lineKey, l.quantity + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                          onClick={() => setQty(lineKey, 0)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {cart.length > 0 ? (
            <div className="border-t border-cream-200 p-4 dark:border-hairline-dark">
              {/* Totals */}
              <div className="mb-3 space-y-1 text-sm">
                <div className="flex justify-between text-ink-muted">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{money(lineSubtotal)}</span>
                </div>
                {discountAmount > 0 ? (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>Discount</span>
                    <span className="tabular-nums">−{money(discountAmount)}</span>
                  </div>
                ) : null}
                {sstEnabled ? (
                  <div className="flex justify-between text-ink-muted">
                    <span>SST {sstRatePct}%</span>
                    <span className="tabular-nums">{money(sst)}</span>
                  </div>
                ) : null}
              </div>

              {/* Payment method */}
              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayMethod("cash")}
                  className={cn(
                    "flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-bold transition",
                    payMethod === "cash"
                      ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                      : "border-cream-200 text-ink-muted dark:border-hairline-dark",
                  )}
                >
                  <Banknote className="h-5 w-5" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod("duitnow_qr_static")}
                  className={cn(
                    "flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-bold transition",
                    payMethod === "duitnow_qr_static"
                      ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                      : "border-cream-200 text-ink-muted dark:border-hairline-dark",
                  )}
                >
                  <QrCode className="h-5 w-5" />
                  DuitNow
                </button>
              </div>

              {payMethod === "cash" ? (
                <div className="mb-3">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    Cash received
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder={total.toFixed(2)}
                    className="mt-1 w-full rounded-xl border border-cream-200 px-3 py-2.5 text-sm font-semibold tabular-nums outline-none focus:border-blue-300 dark:border-hairline-dark dark:bg-panel-dark"
                  />
                  {changeDue > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Change: {money(changeDue)}
                    </p>
                  ) : null}
                </div>
              ) : duitnowQrUrl ? (
                <div className="mb-3 rounded-xl border border-dashed border-cream-300 p-3 text-center dark:border-hairline-dark">
                  <Image
                    src={duitnowQrUrl}
                    alt="DuitNow QR"
                    width={140}
                    height={140}
                    className="mx-auto rounded-lg"
                    unoptimized
                  />
                  <p className="mt-2 text-xs text-ink-muted">
                    Customer pays {money(total)}
                  </p>
                </div>
              ) : (
                <p className="mb-3 text-xs text-ink-muted">
                  <Link
                    href="/settings/branding"
                    className="font-semibold text-blue-700 dark:text-blue-300"
                  >
                    Upload DuitNow QR
                  </Link>{" "}
                  in Branding settings.
                </p>
              )}

              {/* Collapsible extras */}
              <button
                type="button"
                onClick={() => setShowExtras((v) => !v)}
                className="mb-2 flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
              >
                Customer, discount or coupon
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition",
                    showExtras && "rotate-180",
                  )}
                />
              </button>
              {showExtras ? (
                <div className="mb-3 space-y-2 rounded-xl bg-cream-50/80 p-3 dark:bg-hairline-dark/20">
                  <input
                    value={customerQuery || customerName}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setCustomerName(e.target.value);
                    }}
                    placeholder="Customer name"
                    className="w-full rounded-lg border border-cream-200 px-3 py-2 text-xs dark:border-hairline-dark dark:bg-panel-dark"
                  />
                  {customerSearching ? (
                    <p className="text-[10px] text-ink-muted">Searching…</p>
                  ) : null}
                  {customerHits.length > 0 ? (
                    <ul className="max-h-24 overflow-y-auto rounded-lg border border-cream-200 dark:border-hairline-dark">
                      {customerHits.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerId(c.id);
                              setCustomerName(c.name);
                              setCustomerQuery("");
                              setCustomerHits([]);
                            }}
                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-white dark:hover:bg-panel-dark"
                          >
                            {c.name}
                            {c.phone_e164 ? ` · ${c.phone_e164}` : ""}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex gap-2">
                    <select
                      value={discountType ?? ""}
                      onChange={(e) =>
                        setDiscountType(
                          e.target.value === ""
                            ? null
                            : (e.target.value as "amount" | "pct"),
                        )
                      }
                      disabled={Boolean(couponCode.trim())}
                      className="flex-1 rounded-lg border border-cream-200 px-2 py-2 text-xs disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark"
                    >
                      <option value="">No discount</option>
                      <option value="amount">RM off</option>
                      <option value="pct">% off</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={!discountType || Boolean(couponCode.trim())}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder="0"
                      className="w-16 rounded-lg border border-cream-200 px-2 py-2 text-xs disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark"
                    />
                  </div>
                  <input
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      if (e.target.value.trim()) {
                        setDiscountType(null);
                        setDiscountValue("");
                      }
                    }}
                    placeholder="Coupon code"
                    aria-label="Coupon code from Marketing"
                    className="w-full rounded-lg border border-cream-200 px-3 py-2 text-xs uppercase dark:border-hairline-dark dark:bg-panel-dark"
                  />
                  <p className="mt-1 text-[10px] text-ink-muted dark:text-cream-500">
                    Coupon code from Marketing
                  </p>
                </div>
              ) : null}

              {error ? (
                <p className="mb-2 text-xs font-medium text-red-600">{error}</p>
              ) : null}

              <button
                type="button"
                disabled={!canCheckout || busy || total <= 0}
                onClick={() => void completeSale()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-4 text-base font-bold text-white transition hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {tSales("completeSale")}
              </button>
              {!canCheckout ? (
                <p className="mt-2 text-center text-[11px] text-ink-muted">
                  View only — cashier role needed to complete sales.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
