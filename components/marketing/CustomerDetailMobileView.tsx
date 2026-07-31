"use client";

import { MessageCircle, Phone } from "lucide-react";
import { CustomerForm } from "@/components/marketing/CustomerForm";
import { CustomerMayaWinBackCard } from "@/components/marketing/CustomerMayaWinBackCard";
import { CustomerRemoveAction } from "@/components/marketing/CustomerRemoveAction";
import { CustomerProfileMobile } from "@/components/marketing/CustomerProfileMobile";
import type { CustomerFullRow } from "@/components/marketing/types";
import { cn } from "@/lib/utils/cn";

interface CustomerDetailMobileViewProps {
  customer: CustomerFullRow;
  mayaInsight: string;
  className?: string;
}

export function CustomerDetailMobileView({
  customer,
  mayaInsight,
  className,
}: CustomerDetailMobileViewProps) {
  const phoneDigits = customer.phone_e164?.replace(/[^\d]/g, "") ?? "";

  return (
    <div className={cn("space-y-4 pb-24", className)}>
      <CustomerProfileMobile customer={customer} />

      <CustomerMayaWinBackCard
        customerName={customer.name}
        autoTags={customer.auto_tags ?? []}
        insight={mayaInsight}
      />

      <section className="rounded-2xl border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark">
        <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
          Quick edit
        </h2>
        <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
          Phone, tags, and notes — full profile on desktop.
        </p>
        <div className="mt-3">
          <CustomerForm
            mode="edit-restricted"
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
        </div>
      </section>

      <CustomerRemoveAction
        customerId={customer.id}
        customerName={customer.name}
      />

      {customer.phone_e164 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-hairline-dark dark:bg-panel-dark/95">
          <div className="mx-auto flex max-w-lg gap-2">
            <a
              href={`https://wa.me/${phoneDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
              WhatsApp
            </a>
            <a
              href={`tel:${customer.phone_e164}`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cream-300 bg-white px-4 py-3 text-sm font-semibold text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <Phone className="h-4 w-4" strokeWidth={2} />
              Call
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
