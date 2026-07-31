import Link from "next/link";
import { ArrowRight, ShoppingBag, Upload, UserPlus, Wallet } from "lucide-react";

export function CustomerListEmptyState() {
  const steps = [
    {
      icon: UserPlus,
      title: "Add your first customer",
      body: "Name and phone are enough. We normalise +60 and check for duplicates.",
      href: "/marketing/customers/new",
      cta: "New customer",
      primary: true,
    },
    {
      icon: Upload,
      title: "Or import a CSV",
      body: "Up to 5,000 rows with phone dedupe preview before you commit.",
      href: "/marketing/customers/import",
      cta: "Import CSV",
      primary: false,
    },
    {
      icon: ShoppingBag,
      title: "Connect sales data",
      body: "POS orders and Finance invoices feed VIP, repeat, and dormant auto-tags.",
      href: "/operations/orders",
      cta: "Operations",
      primary: false,
    },
    {
      icon: Wallet,
      title: "Invoice customers",
      body: "Link buyers in Finance — they appear here with spend history.",
      href: "/finance/invoices",
      cta: "Finance",
      primary: false,
    },
  ] as const;

  return (
    <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-white to-fuchsia-50/50 p-6 dark:border-violet-900/40 dark:from-violet-950/20 dark:via-panel-dark dark:to-fuchsia-950/10">
      <p className="text-lg font-bold text-ink dark:text-cream-100">
        Your CRM is empty — let&apos;s fill it
      </p>
      <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
        Pick one path below. Auto-tags (VIP, dormant, at-risk) appear once
        customers have purchase history.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.title}
              href={step.href}
              className={
                step.primary
                  ? "flex flex-col rounded-xl border border-violet-500 bg-violet-600 p-4 text-white shadow-sm transition-colors hover:bg-violet-700"
                  : "flex flex-col rounded-xl border border-cream-200 bg-white p-4 transition-colors hover:border-violet-300 hover:shadow-card dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-violet-800"
              }
            >
              <Icon
                className={`h-5 w-5 ${step.primary ? "text-white" : "text-violet-600 dark:text-violet-300"}`}
                strokeWidth={2}
              />
              <p
                className={`mt-2 text-sm font-semibold ${step.primary ? "text-white" : "text-ink dark:text-cream-100"}`}
              >
                {step.title}
              </p>
              <p
                className={`mt-1 flex-1 text-xs leading-relaxed ${step.primary ? "text-violet-100" : "text-ink-muted dark:text-cream-400"}`}
              >
                {step.body}
              </p>
              <span
                className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${step.primary ? "text-white" : "text-violet-700 dark:text-violet-300"}`}
              >
                {step.cta}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
