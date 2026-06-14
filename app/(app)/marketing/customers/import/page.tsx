import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { CsvImportWizardPencil } from "@/components/marketing/CsvImportWizardPencil";

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
        title="Import CSV"
        description="Upload up to 5,000 rows. We'll preview duplicates and auto-merge by phone number before commit."
        action={
          <Link
            href="/marketing/customers"
            className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            Export
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <CsvImportWizardPencil />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <FileText className="h-4 w-4" strokeWidth={2} />
              </span>
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                Expected columns
              </p>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-ink-muted dark:text-cream-400">
              <li>
                <code className="font-mono text-ink dark:text-cream-100">
                  name
                </code>{" "}
                · required
              </li>
              <li>
                <code className="font-mono text-ink dark:text-cream-100">
                  phone
                </code>{" "}
                · E.164 or MY local (012-345 6789)
              </li>
              <li>
                <code className="font-mono text-ink dark:text-cream-100">
                  email
                </code>
              </li>
              <li>
                <code className="font-mono text-ink dark:text-cream-100">
                  address
                </code>
              </li>
              <li>
                <code className="font-mono text-ink dark:text-cream-100">
                  manual_tags
                </code>{" "}
                · semicolon-separated
              </li>
              <li>
                <code className="font-mono text-ink dark:text-cream-100">
                  notes
                </code>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              What we check
            </p>
            <ul className="mt-2.5 space-y-1.5 text-xs text-ink-muted dark:text-cream-400">
              <li>· Duplicate phone numbers (auto-merge)</li>
              <li>· Invalid phones &amp; emails (rejected)</li>
              <li>· Missing name (rejected)</li>
              <li>· File size ≤ 2 MB · rows ≤ 5,000</li>
            </ul>
          </div>

          <div className="rounded-xl border border-accent-200 bg-accent-50 p-5 text-xs text-ink-muted dark:border-accent-700/40 dark:bg-accent-700/15 dark:text-cream-400">
            <p className="text-[11px] font-bold uppercase tracking-wider text-accent-700 dark:text-accent-200">
              Pro tip
            </p>
            <p className="mt-1.5 leading-relaxed">
              Rows we can&apos;t place are kept in the file. Fix them in your
              spreadsheet, re-upload, and we&apos;ll only commit the new rows.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
