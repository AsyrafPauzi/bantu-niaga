import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { CsvImportWizard } from "@/components/marketing/CsvImportWizard";

export const metadata = { title: "Import customers" };
export const dynamic = "force-dynamic";

export default async function ImportCustomersPage() {
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
            You don't have access to CSV import.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/marketing/customers"
            className="text-sm text-brand-700 hover:underline dark:text-brand-300"
          >
            ← All customers
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-ink dark:text-cream-100">
            Import customers from CSV
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-muted dark:text-cream-400">
            Three steps: upload your CSV, review the dry-run preview
            (created / merged / rejected), then commit. We deduplicate by
            phone — same phone + same name auto-merges, same phone + a
            different name is rejected as ambiguous.
          </p>
        </div>
        <a href="/api/marketing/customers/csv-export" rel="nofollow">
          <Button size="sm" variant="secondary" type="button">
            Export current book
          </Button>
        </a>
      </header>

      <CsvImportWizard />
    </div>
  );
}
