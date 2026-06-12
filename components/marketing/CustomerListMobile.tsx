import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { TagBadge } from "@/components/marketing/TagBadge";
import { cn } from "@/lib/utils/cn";
import type { CustomerListRow } from "./types";

interface CustomerListMobileProps {
  customers: CustomerListRow[];
  basePath?: string;
  className?: string;
}

function fmtMyr(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return `RM ${n.toFixed(2)}`;
}

function fmtRelativeDate(value: string | null | undefined): string {
  if (!value) return "no purchases yet";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  const diff = (Date.now() - d.getTime()) / 86_400_000;
  if (diff < 1) return "today";
  if (diff < 2) return "yesterday";
  if (diff < 30) return `${Math.floor(diff)} days ago`;
  return d.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function CustomerListMobile({
  customers,
  basePath = "/marketing/customers",
  className,
}: CustomerListMobileProps) {
  if (customers.length === 0) {
    return (
      <Card className={className}>
        <CardBody className="py-10 text-center text-sm text-ink-muted dark:text-cream-400">
          No customers match the current search.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {customers.map((c) => {
        const tags = [
          ...(c.auto_tags ?? []).slice(0, 3),
          ...(c.manual_tags ?? []).slice(0, 2),
        ];
        return (
          <Link key={c.id} href={`${basePath}/${c.id}`} className="block">
            <Card className="transition-shadow hover:shadow-elevated">
              <CardBody className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                    {c.name}
                  </h3>
                  <span className="text-xs tabular-nums text-ink-muted dark:text-cream-400">
                    {fmtMyr(c.total_spend_myr)}
                  </span>
                </div>
                <div className="text-xs text-ink-muted dark:text-cream-400">
                  <span>{c.phone_e164 ?? "no phone"}</span>
                  <span aria-hidden> · </span>
                  <span>{fmtRelativeDate(c.last_purchase_at)}</span>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(c.auto_tags ?? []).slice(0, 3).map((t) => (
                      <TagBadge key={`a-${t}`} label={t} kind="auto" />
                    ))}
                    {(c.manual_tags ?? []).slice(0, 2).map((t) => (
                      <TagBadge key={`m-${t}`} label={t} kind="manual" />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
