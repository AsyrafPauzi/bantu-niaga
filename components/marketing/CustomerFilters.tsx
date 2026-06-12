"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

/**
 * <CustomerFilters> — controlled filter form for the customer list.
 *
 * URL is the source of truth (so navigation + bookmarking work and the
 * list page stays a server component). The form pushes a new URL on
 * submit and the page re-renders with the new DB read.
 */

interface CustomerFiltersProps {
  className?: string;
  basePath?: string;
}

const SOURCE_OPTIONS = [
  { value: "", label: "Any source" },
  { value: "manual", label: "Manual" },
  { value: "pos", label: "POS" },
  { value: "booking", label: "Booking" },
  { value: "lead_conversion", label: "Lead conversion" },
  { value: "csv_import", label: "CSV import" },
  { value: "public_booking_page", label: "Public booking" },
];

export function CustomerFilters({
  className,
  basePath = "/marketing/customers",
}: CustomerFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [tags, setTags] = useState(params.get("tags") ?? "");
  const [source, setSource] = useState(params.get("source") ?? "");
  const [from, setFrom] = useState(params.get("last_purchase_after") ?? "");
  const [to, setTo] = useState(params.get("last_purchase_before") ?? "");
  const [minSpend, setMinSpend] = useState(params.get("min_spend") ?? "");
  const [maxSpend, setMaxSpend] = useState(params.get("max_spend") ?? "");

  // Re-sync when the URL changes externally (e.g. user clicks sort link
  // which preserves filters but the form must reflect anything that
  // changes outside this component).
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setTags(params.get("tags") ?? "");
    setSource(params.get("source") ?? "");
    setFrom(params.get("last_purchase_after") ?? "");
    setTo(params.get("last_purchase_before") ?? "");
    setMinSpend(params.get("min_spend") ?? "");
    setMaxSpend(params.get("max_spend") ?? "");
  }, [params]);

  function buildHref(): string {
    const next = new URLSearchParams(params.toString());
    setOrDelete(next, "q", q);
    setOrDelete(next, "tags", tags);
    setOrDelete(next, "source", source);
    setOrDelete(next, "last_purchase_after", from);
    setOrDelete(next, "last_purchase_before", to);
    setOrDelete(next, "min_spend", minSpend);
    setOrDelete(next, "max_spend", maxSpend);
    next.set("page", "1");
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(buildHref());
  }

  function reset() {
    router.push(basePath);
  }

  return (
    <Card className={cn("", className)}>
      <CardBody>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Search">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name or phone"
              className={inputCls}
            />
          </FilterField>

          <FilterField label="Tags (any)">
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="vip, kedai-runcit"
              className={inputCls}
            />
          </FilterField>

          <FilterField label="Source">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={inputCls}
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Last purchase after">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputCls}
            />
          </FilterField>

          <FilterField label="Last purchase before">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
            />
          </FilterField>

          <FilterField label="Min spend (RM)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={minSpend}
              onChange={(e) => setMinSpend(e.target.value)}
              className={inputCls}
            />
          </FilterField>

          <FilterField label="Max spend (RM)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxSpend}
              onChange={(e) => setMaxSpend(e.target.value)}
              className={inputCls}
            />
          </FilterField>

          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">
              Apply
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

const inputCls =
  "w-full rounded-md border border-cream-300 bg-panel-light px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-muted dark:text-cream-400">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function setOrDelete(p: URLSearchParams, key: string, value: string) {
  if (!value || value.trim().length === 0) {
    p.delete(key);
  } else {
    p.set(key, value.trim());
  }
}
