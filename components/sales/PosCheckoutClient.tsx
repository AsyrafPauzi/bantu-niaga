"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Banknote,
  Loader2,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface PosProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  price_myr: number;
}

interface CartLine {
  product: PosProduct;
  quantity: number;
}

interface ReceiptData {
  sale: {
    id: string;
    sale_number: string;
    subtotal_myr: number;
    discount_amount_myr: number;
    sst_amount_myr: number;
    total_myr: number;
    payment_method: string;
    payment_received_myr: number | null;
    change_myr: number;
    customer_name: string | null;
    created_at: string;
  };
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price_myr: number;
    line_total_myr: number;
  }>;
  finance_warning?: string;
}

interface PosCheckoutClientProps {
  businessName: string;
  sstEnabled: boolean;
  sstRatePct: number;
  duitnowId: string | null;
  duitnowQrUrl: string | null;
  canCheckout: boolean;
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
}: PosCheckoutClientProps) {
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountType, setDiscountType] = useState<"amount" | "pct" | null>(
    null,
  );
  const [discountValue, setDiscountValue] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "duitnow_qr_static">(
    "cash",
  );
  const [cashReceived, setCashReceived] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showDuitnow, setShowDuitnow] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/pos/products");
      const json = (await res.json()) as { data?: PosProduct[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load products");
      setProducts(
        (json.data ?? []).map((p) => ({
          ...p,
          price_myr: Number(p.price_myr),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.sku.toLowerCase().includes(needle) ||
        (p.category ?? "").toLowerCase().includes(needle),
    );
  }, [products, q]);

  const lineSubtotal = cart.reduce(
    (a, l) => a + l.product.price_myr * l.quantity,
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

  function addProduct(p: PosProduct) {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  }

  function setQty(productId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.product.id === productId ? { ...l, quantity } : l,
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
        items: cart.map((l) => ({
          product_id: l.product.id,
          quantity: l.quantity,
        })),
        payment_method: payMethod,
        discount_type: discountType,
        discount_value:
          discountType && discountValue !== ""
            ? Number(discountValue)
            : null,
        payment_received_myr:
          payMethod === "cash"
            ? cashReceived !== ""
              ? Number(cashReceived)
              : total
            : null,
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
      setCashReceived("");
      setCustomerName("");
      setShowDuitnow(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-[#E5E0D8] bg-white p-6 dark:border-hairline-dark dark:bg-panel-dark">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Receipt
          </p>
          <h2 className="mt-1 text-lg font-bold text-ink dark:text-cream-100">
            {businessName}
          </h2>
          <p className="text-sm text-ink-muted">{receipt.sale.sale_number}</p>
        </div>
        <ul className="space-y-2 border-y border-cream-200 py-3 text-sm dark:border-hairline-dark">
          {receipt.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {it.product_name} × {it.quantity}
              </span>
              <span className="tabular-nums">{money(Number(it.line_total_myr))}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {money(Number(receipt.sale.subtotal_myr))}
            </span>
          </div>
          {Number(receipt.sale.discount_amount_myr) > 0 ? (
            <div className="flex justify-between text-ink-muted">
              <span>Discount</span>
              <span className="tabular-nums">
                −{money(Number(receipt.sale.discount_amount_myr))}
              </span>
            </div>
          ) : null}
          {Number(receipt.sale.sst_amount_myr) > 0 ? (
            <div className="flex justify-between text-ink-muted">
              <span>SST</span>
              <span className="tabular-nums">
                {money(Number(receipt.sale.sst_amount_myr))}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">
              {money(Number(receipt.sale.total_myr))}
            </span>
          </div>
          <p className="pt-2 text-xs text-ink-muted">
            Paid via{" "}
            {receipt.sale.payment_method === "cash" ? "Cash" : "DuitNow QR"}
            {receipt.sale.customer_name
              ? ` · ${receipt.sale.customer_name}`
              : " · Walk-in"}
          </p>
          {receipt.finance_warning ? (
            <p className="text-xs text-amber-700">{receipt.finance_warning}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setReceipt(null)}
          className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600"
        >
          New sale
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border border-[#E5E0D8] bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-cream-200 px-3 py-2 dark:border-hairline-dark">
          <Search className="h-4 w-4 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-muted">
            No active products.{" "}
            <Link
              href="/operations/products"
              className="font-semibold text-brand-700"
            >
              Add products in Operations
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="rounded-xl border border-cream-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-hairline-dark dark:hover:bg-brand-900/20"
              >
                <p className="line-clamp-2 text-sm font-semibold text-ink dark:text-cream-100">
                  {p.name}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{p.sku}</p>
                <p className="mt-2 text-sm font-bold tabular-nums text-brand-700 dark:text-brand-200">
                  {money(p.price_myr)}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col rounded-2xl border border-[#E5E0D8] bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ShoppingCart className="h-4 w-4" /> Cart
        </div>
        {cart.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            Tap products to add
          </p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {cart.map((l) => (
              <li
                key={l.product.id}
                className="flex items-center gap-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.product.name}</p>
                  <p className="text-xs text-ink-muted">
                    {money(l.product.price_myr)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-md border p-1"
                    onClick={() => setQty(l.product.id, l.quantity - 1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center tabular-nums">
                    {l.quantity}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border p-1"
                    onClick={() => setQty(l.product.id, l.quantity + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1 text-ink-muted"
                    onClick={() => setQty(l.product.id, 0)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-2 border-t border-cream-200 pt-3 text-sm dark:border-hairline-dark">
          <label className="block text-xs font-semibold text-ink-muted">
            Customer (optional)
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in or name"
              className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
            />
          </label>

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
              className="rounded-lg border border-cream-300 px-2 py-2 text-xs dark:border-hairline-dark dark:bg-panel-dark"
            >
              <option value="">No discount</option>
              <option value="amount">RM off</option>
              <option value="pct">% off</option>
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              disabled={!discountType}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder="0"
              className="w-24 rounded-lg border border-cream-300 px-2 py-2 text-xs disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark"
            />
          </div>

          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(lineSubtotal)}</span>
          </div>
          {discountAmount > 0 ? (
            <div className="flex justify-between text-ink-muted">
              <span>Discount</span>
              <span className="tabular-nums">−{money(discountAmount)}</span>
            </div>
          ) : null}
          {sstEnabled ? (
            <div className="flex justify-between text-ink-muted">
              <span>SST ({sstRatePct}%)</span>
              <span className="tabular-nums">{money(sst)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{money(total)}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setPayMethod("cash");
              setShowDuitnow(false);
            }}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold",
              payMethod === "cash"
                ? "border-brand-500 bg-brand-50 text-brand-800"
                : "border-cream-300 text-ink-muted",
            )}
          >
            <Banknote className="h-4 w-4" /> Cash
          </button>
          <button
            type="button"
            onClick={() => {
              setPayMethod("duitnow_qr_static");
              setShowDuitnow(true);
            }}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold",
              payMethod === "duitnow_qr_static"
                ? "border-brand-500 bg-brand-50 text-brand-800"
                : "border-cream-300 text-ink-muted",
            )}
          >
            <QrCode className="h-4 w-4" /> DuitNow
          </button>
        </div>

        {payMethod === "cash" ? (
          <label className="mt-2 block text-xs font-semibold text-ink-muted">
            Cash received
            <input
              type="number"
              min={0}
              step="0.01"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder={total.toFixed(2)}
              className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark"
            />
          </label>
        ) : null}

        {showDuitnow || payMethod === "duitnow_qr_static" ? (
          <div className="mt-3 rounded-xl border border-dashed border-cream-300 p-3 text-center dark:border-hairline-dark">
            {duitnowQrUrl ? (
              <Image
                src={duitnowQrUrl}
                alt="DuitNow QR"
                width={180}
                height={180}
                className="mx-auto rounded-lg"
                unoptimized
              />
            ) : (
              <p className="text-xs text-ink-muted">
                No QR image yet.{" "}
                <Link
                  href="/settings/branding"
                  className="font-semibold text-brand-700"
                >
                  Upload in Branding
                </Link>
                {duitnowId ? ` · ID: ${duitnowId}` : null}
              </p>
            )}
            <p className="mt-2 text-xs text-ink-muted">
              Ask customer to pay {money(total)}, then confirm below.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        ) : null}

        <button
          type="button"
          disabled={!canCheckout || cart.length === 0 || busy || total <= 0}
          onClick={() => void completeSale()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {payMethod === "cash" ? "Complete cash sale" : "Confirm DuitNow paid"}
        </button>
        {!canCheckout ? (
          <p className="mt-2 text-center text-[11px] text-ink-muted">
            View only — ask owner/manager/cashier to take payment.
          </p>
        ) : null}
      </section>
    </div>
  );
}
