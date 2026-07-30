import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FinanceCustomerPanel } from "@/components/finance/FinanceCustomerPanel";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  loadFinanceCustomersPage,
  loadFinanceCustomersSummary,
} from "@/lib/finance/customers";
import { parsePagination } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function FinanceCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "finance")) redirect("/home");

  const params = await searchParams;
  const pagination = parsePagination(params, { defaultPageSize: 10 });
  const searchQuery =
    typeof params.q === "string" ? params.q.trim() : "";

  const supabase = await createSupabaseServerClient();
  const [summary, pageData] = await Promise.all([
    loadFinanceCustomersSummary(supabase, user.businessId),
    loadFinanceCustomersPage(supabase, user.businessId, {
      from: pagination.from,
      to: pagination.to,
      q: searchQuery || undefined,
    }),
  ]);

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <Link
        href="/finance"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Finance dashboard
      </Link>

      <FinanceCustomerPanel
        initialCustomers={pageData.customers}
        summary={summary}
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pageData.total}
        searchQuery={searchQuery}
      />
    </div>
  );
}
