import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CustomerProfileDesktop } from "@/components/marketing/CustomerProfileDesktop";
import { CustomerProfileMobile } from "@/components/marketing/CustomerProfileMobile";
import { CustomerListAdaptive } from "../CustomerListAdaptive";
import type {
  CustomerFullRow,
  CustomerTagHistoryRow,
} from "@/components/marketing/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Customer ${id.slice(0, 8)}` };
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;

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

  const supabase = await createSupabaseServerClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select(
      "id, name, phone_e164, email, address, manual_tags, auto_tags, " +
        "notes, source, total_spend_myr, last_purchase_at, order_count, " +
        "aov_myr, created_at, updated_at, created_by_user_id, " +
        "merged_into_id, deleted_at",
    )
    .eq("business_id", user.businessId)
    .eq("id", id)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .maybeSingle();

  if (error) {
    return (
      <Card>
        <CardBody className="py-6">
          <p className="text-sm text-status-danger">
            Failed to load customer: {error.message}
          </p>
        </CardBody>
      </Card>
    );
  }
  if (!customer) notFound();

  const { data: history } = await supabase
    .from("customer_tag_history")
    .select("id, prior_auto_tags, new_auto_tags, computed_at, run_id")
    .eq("business_id", user.businessId)
    .eq("customer_id", id)
    .order("computed_at", { ascending: false })
    .limit(10);

  const c = customer as unknown as CustomerFullRow;
  const tagHistory = (history ?? []) as unknown as CustomerTagHistoryRow[];

  return (
    <div className="space-y-4">
      <Link
        href="/marketing/customers"
        className="text-sm text-brand-700 hover:underline dark:text-brand-300"
      >
        ← All customers
      </Link>

      <CustomerListAdaptive
        desktop={
          <CustomerProfileDesktop customer={c} tagHistory={tagHistory} />
        }
        mobile={<CustomerProfileMobile customer={c} />}
      />
    </div>
  );
}
