import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
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
            You don't have access to the Marketing CRM.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/marketing/customers"
          className="text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          ← All customers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink dark:text-cream-100">
          Add a new customer
        </h1>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          We auto-merge if the phone number already exists with the same
          name. If the names differ you'll see a merge prompt.
        </p>
      </header>

      <CustomerForm mode="create" />
    </div>
  );
}
