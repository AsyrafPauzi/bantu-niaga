import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Download,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { CustomerForm } from "@/components/marketing/CustomerForm";

export const metadata = { title: "New customer" };
export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "customers")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to the Marketing CRM.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/marketing/customers"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        All customers
      </Link>

      <PageHeader
        eyebrow="Marketing · Customers"
        title="New customer"
        description="Add a customer to your card-index CRM. Phone + name fields auto-merge if a match already exists."
        action={
          <a
            href="/api/marketing/customers/csv-export"
            rel="nofollow"
            className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            Export book
          </a>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <CustomerForm mode="create" />
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border border-accent-200 bg-accent-50 p-4 dark:border-accent-700/40 dark:bg-accent-700/15">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white">
                <Sparkles className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-200">
                  Why register?
                </p>
                <ul className="mt-2 space-y-2 text-sm text-ink dark:text-cream-100">
                  {[
                    "Auto-segments (VIP, Repeat, At-risk) update in real time.",
                    "Activate WhatsApp + email broadcasts and personalised offers.",
                    "AI-suggested win-back actions when customers go cold.",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <HelpCircle className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink dark:text-cream-100">
                    Got many customers?
                  </p>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    Bulk import in a tap.
                  </p>
                </div>
              </div>
              <Link
                href="/marketing/customers/import"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
              >
                Import CSV
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                Dedup behaviour
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                If a customer with the same phone number already exists, we
                offer to merge into the existing record. If the names differ,
                you&apos;ll see a merge prompt above the form.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
