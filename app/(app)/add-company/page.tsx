import { redirect } from "next/navigation";
import { AddCompanyForm } from "@/components/auth/AddCompanyForm";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  canCreateOwnedBusiness,
  MAX_OWNED_BUSINESSES_PER_USER,
  ownedBusinessLimitMessage,
} from "@/lib/auth/owned-business-limits";
import { countOwnedBusinesses } from "@/lib/auth/count-owned-businesses";

export const metadata = { title: "Add company" };
export const dynamic = "force-dynamic";

export default async function AddCompanyPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in?next=/add-company");
    throw e;
  }

  const ownedCount = await countOwnedBusinesses(user.id);
  const atLimit = !canCreateOwnedBusiness(ownedCount);

  return (
    <div className="py-4">
      {atLimit ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-cream-300 bg-white p-6 text-center shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <h1 className="text-xl font-bold text-ink dark:text-cream-100">
            Company limit reached
          </h1>
          <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
            {ownedBusinessLimitMessage()}
          </p>
          <p className="mt-3 text-xs text-ink-subtle dark:text-cream-500">
            You own {ownedCount} of {MAX_OWNED_BUSINESSES_PER_USER} companies on
            this account.
          </p>
        </div>
      ) : (
        <AddCompanyForm
          ownedCount={ownedCount}
          maxOwned={MAX_OWNED_BUSINESSES_PER_USER}
        />
      )}
    </div>
  );
}
