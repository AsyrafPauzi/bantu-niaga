import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { CsvImportWizardPencil } from "@/components/marketing/CsvImportWizardPencil";
import { MarketingCustomersBackLink } from "@/components/marketing/MarketingCustomersBackLink";
import { ModuleDashboardHero } from "@/components/dashboard/module-layout";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { importCustomerSubpageHero } from "@/lib/marketing/subpage-hero";

export const metadata = { title: "Import CSV" };
export const dynamic = "force-dynamic";

export default async function CustomerImportPage() {
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

  const hero = importCustomerSubpageHero();

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingCustomersBackLink />

      <ModuleDashboardHero
        module="Marketing · Customers"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant={hero.variant}
        cta={
          <Link
            href="/marketing/customers/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm hover:bg-white dark:border-violet-900/50 dark:bg-panel-dark/80 dark:text-violet-200"
          >
            <Upload className="h-4 w-4" strokeWidth={2} />
            Add one manually
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <CsvImportWizardPencil />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-card dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-fuchsia-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Preview before commit
            </p>
            <p className="mt-2 text-sm text-ink dark:text-cream-100">
              After upload you&apos;ll see exact counts for{" "}
              <strong>new</strong>, <strong>duplicate merges</strong>, and{" "}
              <strong>rejected</strong> rows — nothing is saved until you confirm.
            </p>
          </div>

          <Card>
            <CardBody className="space-y-2 text-xs text-ink-muted dark:text-cream-400">
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                Required columns
              </p>
              <p>
                <code className="font-mono text-ink dark:text-cream-100">name</code>
                ,{" "}
                <code className="font-mono text-ink dark:text-cream-100">phone</code>
              </p>
              <p className="pt-2 text-sm font-semibold text-ink dark:text-cream-100">
                Optional
              </p>
              <p>email · address · notes · manual_tags</p>
              <p className="pt-2">Max 2 MB · 5,000 rows · UTF-8</p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
