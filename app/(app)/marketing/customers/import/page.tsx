import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Upload } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { CsvImportWizard } from "@/components/marketing/CsvImportWizard";

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
      />

      <Card>
        <CardBody>
          <ol className="grid grid-cols-3 gap-3 sm:gap-6">
            {[
              {
                step: 1,
                title: "Upload",
                desc: "CSV file (≤ 2 MB)",
                icon: Upload,
                state: "active" as const,
              },
              {
                step: 2,
                title: "Map columns",
                desc: "Auto-detected",
                icon: FileText,
                state: "next" as const,
              },
              {
                step: 3,
                title: "Preview & dedupe",
                desc: "Commit on confirm",
                icon: CheckCircle2,
                state: "next" as const,
              },
            ].map((s) => (
              <li key={s.step} className="flex items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    s.state === "active"
                      ? "bg-brand-500 text-white"
                      : "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400"
                  }`}
                >
                  {s.step}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      s.state === "active"
                        ? "text-ink dark:text-cream-100"
                        : "text-ink-muted dark:text-cream-400"
                    }`}
                  >
                    {s.title}
                  </p>
                  <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                    {s.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <CsvImportWizard />
        </div>

        <aside className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <FileText className="h-4 w-4" strokeWidth={2} />
                </span>
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  Expected columns
                </p>
              </div>
              <ul className="space-y-1.5 text-xs text-ink-muted dark:text-cream-400">
                <li>
                  <code className="font-mono text-ink dark:text-cream-100">name</code>{" "}
                  · required
                </li>
                <li>
                  <code className="font-mono text-ink dark:text-cream-100">phone</code>{" "}
                  · E.164 or MY local (012-345 6789)
                </li>
                <li>
                  <code className="font-mono text-ink dark:text-cream-100">email</code>
                </li>
                <li>
                  <code className="font-mono text-ink dark:text-cream-100">address</code>
                </li>
                <li>
                  <code className="font-mono text-ink dark:text-cream-100">tags</code>{" "}
                  · semicolon-separated
                </li>
                <li>
                  <code className="font-mono text-ink dark:text-cream-100">notes</code>
                </li>
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                What we check
              </p>
              <ul className="space-y-1.5 text-xs text-ink-muted dark:text-cream-400">
                <li>· Duplicate phone numbers (auto-merge)</li>
                <li>· Invalid phones &amp; emails (rejected)</li>
                <li>· Missing name (rejected)</li>
                <li>· File size ≤ 2 MB · rows ≤ 5,000</li>
              </ul>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
