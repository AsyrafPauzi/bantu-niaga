"use client";

/**
 * PosReceiptView — shown immediately after a successful POS checkout.
 * Extracted from PosCheckoutClient to keep that file under a manageable size.
 */

import Link from "next/link";
import { Check, Copy, Receipt, Share2, Zap } from "lucide-react";
import { SalesBackLink } from "@/components/sales/SalesBackLink";

export interface PosReceiptData {
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
    coupon_code?: string | null;
  };
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price_myr: number;
    line_total_myr: number;
  }>;
  finance_warning?: string;
}

interface PosReceiptViewProps {
  receipt: PosReceiptData;
  shareDone: boolean;
  onNewSale: () => void;
  onCopy: () => void;
  onWhatsApp: () => void;
}

function money(n: number) {
  return `RM ${n.toFixed(2)}`;
}

export function PosReceiptView({
  receipt,
  shareDone,
  onNewSale,
  onCopy,
  onWhatsApp,
}: PosReceiptViewProps) {
  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <SalesBackLink />
      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50 via-white to-cream-100 shadow-card dark:border-blue-900/40 dark:from-blue-950/30 dark:via-panel-dark dark:to-cream-100/20">
          <div className="border-b border-blue-200/60 bg-[#2563EB]/10 px-6 py-5 text-center dark:border-blue-900/40">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#2563EB] text-white">
              <Check className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">
              Sale complete
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink dark:text-cream-100">
              {money(Number(receipt.sale.total_myr))}
            </h2>
            <p className="text-sm text-ink-muted">{receipt.sale.sale_number}</p>
          </div>
          <div className="space-y-4 p-6">
            <ul className="space-y-2 text-sm">
              {receipt.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-ink-muted">
                    {it.product_name}{" "}
                    <span className="text-ink-subtle">x{it.quantity}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">
                    {money(Number(it.line_total_myr))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t border-cream-200 pt-3 text-sm dark:border-hairline-dark">
              {Number(receipt.sale.discount_amount_myr) > 0 ? (
                <div className="flex justify-between text-ink-muted">
                  <span>
                    {receipt.sale.coupon_code
                      ? `Coupon ${receipt.sale.coupon_code}`
                      : "Discount"}
                  </span>
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
              <p className="pt-1 text-xs text-ink-muted">
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
              onClick={onNewSale}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3.5 text-sm font-bold text-white transition hover:bg-[#1D4ED8] active:scale-[0.98]"
            >
              <Zap className="h-4 w-4" />
              Next sale
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cream-300 py-2.5 text-xs font-semibold dark:border-hairline-dark"
              >
                <Copy className="h-3.5 w-3.5" />
                {shareDone ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={onWhatsApp}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 py-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
              >
                <Share2 className="h-3.5 w-3.5" />
                WhatsApp
              </button>
            </div>
            {receipt.sale.id ? (
              <Link
                href={`/sales/receipts/${receipt.sale.id}`}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300"
              >
                <Receipt className="h-3.5 w-3.5" />
                View full receipt
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
