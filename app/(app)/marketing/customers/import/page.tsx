import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Import customers" };

export default function ImportCustomersPage() {
  return (
    <div className="space-y-4">
      <Link
        href="/marketing/customers"
        className="text-sm text-brand-700 hover:underline dark:text-brand-300"
      >
        ← All customers
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Import customers from CSV</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-ink dark:text-cream-100">
          <p>
            Bulk import lands in <strong>Marketing M3</strong>. The wizard
            will support upload → dry-run preview → confirm, with row-level
            dedup outcomes and a 5 MB / 5,000 row cap.
          </p>
          <p className="text-ink-muted dark:text-cream-400">
            In the meantime, add customers one at a time from{" "}
            <Link
              href="/marketing/customers/new"
              className="text-brand-700 hover:underline dark:text-brand-300"
            >
              the manual add form
            </Link>
            .
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
