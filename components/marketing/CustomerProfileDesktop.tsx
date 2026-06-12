"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "@/components/marketing/CustomerForm";
import { TagBadge } from "@/components/marketing/TagBadge";
import { cn } from "@/lib/utils/cn";
import type { CustomerFullRow, CustomerTagHistoryRow } from "./types";

/**
 * Full desktop customer profile.
 *
 *   - Header with name + tag chips
 *   - KPI tiles (total spend, order count, AOV, last purchase)
 *   - <CustomerForm mode="edit-full"> for inline edits
 *   - Tag history timeline (last 10 transitions)
 *   - Danger zone: soft-delete + manual merge
 */

interface CustomerProfileDesktopProps {
  customer: CustomerFullRow;
  tagHistory: CustomerTagHistoryRow[];
  className?: string;
}

function fmtMyr(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return `RM ${n.toFixed(2)}`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function CustomerProfileDesktop({
  customer,
  tagHistory,
  className,
}: CustomerProfileDesktopProps) {
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [loserId, setLoserId] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function softDelete() {
    if (!confirm(`Soft-delete ${customer.name}? It will be hidden from the CRM.`)) {
      return;
    }
    setMergeError(null);
    try {
      const res = await fetch(`/api/marketing/customers/${customer.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        setMergeError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      startTransition(() => {
        router.push("/marketing/customers");
        router.refresh();
      });
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : "Network error");
    }
  }

  async function mergeWith() {
    if (!loserId.trim()) {
      setMergeError("Enter a customer id to merge in.");
      return;
    }
    setMergeBusy(true);
    setMergeError(null);
    try {
      const res = await fetch(
        `/api/marketing/customers/${customer.id}/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winner_id: customer.id,
            loser_id: loserId.trim(),
          }),
        },
      );
      const body = (await res.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      if (!res.ok) {
        setMergeError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
      setLoserId("");
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : "Network error");
    } finally {
      setMergeBusy(false);
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
          Customer
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-ink dark:text-cream-100">
            {customer.name}
          </h1>
          {(customer.auto_tags ?? []).map((t) => (
            <TagBadge key={`h-a-${t}`} label={t} kind="auto" />
          ))}
          {(customer.manual_tags ?? []).map((t) => (
            <TagBadge key={`h-m-${t}`} label={t} kind="manual" />
          ))}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Total spend" value={fmtMyr(customer.total_spend_myr)} />
        <KpiTile label="Orders" value={String(customer.order_count)} />
        <KpiTile label="AOV" value={fmtMyr(customer.aov_myr)} />
        <KpiTile label="Last purchase" value={fmtDate(customer.last_purchase_at)} />
      </section>

      <CustomerForm
        mode="edit-full"
        initial={{
          id: customer.id,
          name: customer.name,
          phone_e164: customer.phone_e164,
          email: customer.email ?? null,
          address: customer.address ?? null,
          manual_tags: customer.manual_tags ?? [],
          notes: customer.notes ?? null,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Auto-tag history</CardTitle>
        </CardHeader>
        <CardBody>
          {tagHistory.length === 0 ? (
            <p className="text-sm text-ink-muted dark:text-cream-400">
              No tag transitions recorded yet. The nightly tag refresh writes
              one row per change.
            </p>
          ) : (
            <ol className="space-y-3 text-sm">
              {tagHistory.map((row) => (
                <li key={row.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs uppercase text-ink-muted dark:text-cream-400">
                    {fmtDate(row.computed_at)}
                  </span>
                  <span className="text-ink dark:text-cream-100">
                    {(row.prior_auto_tags ?? []).join(", ") || "(none)"}
                  </span>
                  <span aria-hidden>→</span>
                  <span className="text-ink dark:text-cream-100">
                    {(row.new_auto_tags ?? []).join(", ") || "(none)"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      <Card className="border-status-danger/40">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <p className="text-sm text-ink dark:text-cream-100">
              Soft-delete hides this customer from the CRM and exports.
              Foreign-key references from Finance / Operations / Sales remain
              resolvable.
            </p>
            <div className="mt-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={softDelete}
                disabled={pending}
              >
                Soft-delete customer
              </Button>
            </div>
          </div>

          <div className="border-t border-cream-200 pt-4 dark:border-hairline-dark">
            <p className="text-sm text-ink dark:text-cream-100">
              Merge another customer <em>into</em> this record. The other
              customer's tags + notes are folded in; their foreign-key
              references are re-pointed here; their row is tombstoned.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={loserId}
                onChange={(e) => setLoserId(e.target.value)}
                placeholder="Customer id to merge in (uuid)"
                className="min-w-[280px] flex-1 rounded-md border border-cream-300 bg-panel-light px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={mergeWith}
                disabled={mergeBusy}
              >
                {mergeBusy ? "Merging…" : "Merge"}
              </Button>
            </div>
          </div>

          {mergeError && (
            <p
              role="alert"
              className="rounded-md bg-[#F8DDD9] px-3 py-2 text-sm text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]"
            >
              {mergeError}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs uppercase tracking-wider text-ink-muted dark:text-cream-400">
          {label}
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-ink dark:text-cream-100">
          {value}
        </p>
      </CardBody>
    </Card>
  );
}
