"use client";

/**
 * PosReceiptView — shown immediately after a successful POS checkout.
 */

import Link from "next/link";
import { useState } from "react";
import {
  Check,
  Copy,
  Mail,
  MessageCircle,
  Receipt,
  Zap,
} from "lucide-react";
import { SalesBackLink } from "@/components/sales/SalesBackLink";
import { cn } from "@/lib/utils/cn";

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
  /** True when the sale was saved offline and not yet synced to the server. */
  is_offline?: boolean;
}

interface PosReceiptViewProps {
  receipt: PosReceiptData;
  shareDone: boolean;
  onNewSale: () => void;
  onCopy: () => void;
  /** @deprecated Prefer the WhatsApp tab with phone — kept for callers. */
  onWhatsApp?: () => void;
}

type ShareTab = "email" | "whatsapp";

function money(n: number) {
  return `RM ${n.toFixed(2)}`;
}

function receiptMessage(data: PosReceiptData): string {
  const lines = [
    `Receipt ${data.sale.sale_number}`,
    ...data.items.map(
      (it) =>
        `${it.product_name} x${it.quantity} — ${money(Number(it.line_total_myr))}`,
    ),
  ];
  if (Number(data.sale.discount_amount_myr) > 0) {
    lines.push(
      `Discount${data.sale.coupon_code ? ` (${data.sale.coupon_code})` : ""}: −${money(Number(data.sale.discount_amount_myr))}`,
    );
  }
  if (Number(data.sale.sst_amount_myr) > 0) {
    lines.push(`SST: ${money(Number(data.sale.sst_amount_myr))}`);
  }
  lines.push(
    "",
    `Total: ${money(Number(data.sale.total_myr))}`,
    `Paid: ${data.sale.payment_method === "cash" ? "Cash" : "DuitNow QR"}`,
  );
  if (data.sale.customer_name?.trim()) {
    lines.push(`Customer: ${data.sale.customer_name.trim()}`);
  }
  return lines.join("\n");
}

/** Malaysian-friendly → digits for wa.me (no +). Returns null if too short. */
function toWhatsAppDigits(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function PosReceiptView({
  receipt,
  shareDone,
  onNewSale,
  onCopy,
}: PosReceiptViewProps) {
  const [shareTab, setShareTab] = useState<ShareTab>("email");
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [waOpened, setWaOpened] = useState(false);

  const canEmail = Boolean(receipt.sale.id) && !receipt.is_offline;

  async function sendEmailReceipt() {
    if (!canEmail || emailBusy) return;
    const to = email.trim();
    if (!to) {
      setEmailError("Enter an email address.");
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    try {
      const res = await fetch(
        `/api/sales/pos/sales/${receipt.sale.id}/email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: to }),
        },
      );
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        to?: string;
        message?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        setEmailError(
          body?.message ?? body?.error ?? `Could not send (${res.status})`,
        );
        return;
      }
      setEmailSentTo(body?.to ?? to);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Network error");
    } finally {
      setEmailBusy(false);
    }
  }

  function openWhatsApp() {
    const digits = toWhatsAppDigits(phone);
    if (!digits) {
      setPhoneError("Enter a valid phone (e.g. 0123456789 or +60123456789).");
      return;
    }
    setPhoneError(null);
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(receiptMessage(receipt))}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setWaOpened(true);
  }

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <SalesBackLink />
      <div className="mx-auto w-full max-w-xl">
        <div className="overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50 via-white to-cream-100 shadow-card dark:border-blue-900/40 dark:from-blue-950/30 dark:via-panel-dark dark:to-surface-dark">
          <div
            className={
              receipt.is_offline
                ? "border-b border-amber-200/60 bg-amber-500/10 px-6 py-5 text-center dark:border-amber-900/40 sm:px-8"
                : "border-b border-blue-200/60 bg-[#2563EB]/10 px-6 py-5 text-center dark:border-blue-900/40 sm:px-8"
            }
          >
            <div
              className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full text-white ${receipt.is_offline ? "bg-amber-500" : "bg-[#2563EB]"}`}
            >
              <Check className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <p
              className={`text-xs font-bold uppercase tracking-widest ${receipt.is_offline ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300"}`}
            >
              {receipt.is_offline ? "Saved offline" : "Sale complete"}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-ink dark:text-cream-100">
              {money(Number(receipt.sale.total_myr))}
            </h2>
            <p className="text-sm text-ink-muted">{receipt.sale.sale_number}</p>
          </div>

          <div className="space-y-4 p-6 sm:p-8">
            <ul className="space-y-2 text-sm">
              {receipt.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-ink-muted">
                    {it.product_name}{" "}
                    <span className="text-ink-subtle">x{it.quantity}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
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

            <div className="space-y-3 rounded-xl border border-cream-200 bg-white/70 p-3 dark:border-hairline-dark dark:bg-panel-dark/60">
              <div
                role="tablist"
                aria-label="Send receipt"
                className="grid grid-cols-2 gap-1 rounded-lg bg-cream-100/80 p-0.5 dark:bg-hairline-dark/40"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={shareTab === "email"}
                  onClick={() => setShareTab("email")}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition",
                    shareTab === "email"
                      ? "bg-white text-ink shadow-sm dark:bg-panel-dark dark:text-cream-100"
                      : "text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100",
                  )}
                >
                  <Mail className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Email
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={shareTab === "whatsapp"}
                  onClick={() => setShareTab("whatsapp")}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition",
                    shareTab === "whatsapp"
                      ? "bg-white text-ink shadow-sm dark:bg-panel-dark dark:text-cream-100"
                      : "text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100",
                  )}
                >
                  <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
                  WhatsApp
                </button>
              </div>

              {shareTab === "email" ? (
                <div className="space-y-2" role="tabpanel">
                  {canEmail ? (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setEmailError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void sendEmailReceipt();
                            }
                          }}
                          placeholder="customer@email.com"
                          autoComplete="email"
                          disabled={emailBusy}
                          className="min-w-0 flex-1 rounded-lg border border-cream-300 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                        />
                        <button
                          type="button"
                          onClick={() => void sendEmailReceipt()}
                          disabled={emailBusy || !email.trim()}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50"
                        >
                          <Mail className="h-3.5 w-3.5" strokeWidth={2.25} />
                          {emailBusy ? "Sending…" : "Send"}
                        </button>
                      </div>
                      {emailSentTo ? (
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Sent to {emailSentTo}
                        </p>
                      ) : null}
                      {emailError ? (
                        <p className="text-xs text-status-danger" role="alert">
                          {emailError}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {receipt.is_offline
                        ? "Sync this sale online before emailing the receipt."
                        : "Email is unavailable for this sale."}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2" role="tabpanel">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setPhoneError(null);
                        setWaOpened(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          openWhatsApp();
                        }
                      }}
                      placeholder="012-345 6789"
                      autoComplete="tel"
                      inputMode="tel"
                      className="min-w-0 flex-1 rounded-lg border border-cream-300 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                    />
                    <button
                      type="button"
                      onClick={openWhatsApp}
                      disabled={!phone.trim()}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1ebe57] disabled:opacity-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
                      Open chat
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-subtle dark:text-cream-400">
                    Opens WhatsApp with the receipt ready — you send it
                    manually.
                  </p>
                  {waOpened ? (
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      WhatsApp opened for {phone.trim()}
                    </p>
                  ) : null}
                  {phoneError ? (
                    <p className="text-xs text-status-danger" role="alert">
                      {phoneError}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onNewSale}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3.5 text-sm font-bold text-white transition hover:bg-[#1D4ED8] active:scale-[0.98]"
            >
              <Zap className="h-4 w-4" />
              Next sale
            </button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cream-300 py-2.5 text-xs font-semibold dark:border-hairline-dark"
              >
                <Copy className="h-3.5 w-3.5" />
                {shareDone ? "Copied" : "Copy text"}
              </button>
              {receipt.sale.id && !receipt.is_offline ? (
                <Link
                  href={`/sales/receipts/${receipt.sale.id}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cream-300 py-2.5 text-xs font-semibold text-blue-700 dark:border-hairline-dark dark:text-blue-300"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Full receipt
                </Link>
              ) : (
                <span className="hidden sm:block" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
