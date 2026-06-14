import Link from "next/link";
import { ArrowRight, Plug } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ConnectPosCard() {
  return (
    <Card className="relative overflow-hidden border-brand-100 bg-gradient-to-r from-brand-50 to-cream-50 dark:border-brand-900/40 dark:from-brand-900/30 dark:to-panel-dark">
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-accent-500/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-card">
            <Plug className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-200">
              Next up
            </p>
            <h3 className="mt-1 text-lg font-semibold text-ink dark:text-cream-100">
              Connect your POS to start tracking spend automatically
            </h3>
            <p className="mt-1 text-sm text-ink-muted dark:text-cream-300">
              Once Sales POS goes live, every sale will roll up into Total
              spend, AOV, VIP tagging — without lifting a finger.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Link href="/sales">
            <Button size="sm">
              Open Sales module
              <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </Link>
          <Link href="/marketing/customers/import">
            <Button size="sm" variant="secondary">
              Or import CSV
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
