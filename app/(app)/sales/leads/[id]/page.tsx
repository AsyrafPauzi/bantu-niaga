import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { LeadDetailClient } from "@/components/sales/LeadDetailClient";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUseLeads, LEAD_ASSIGNEE_ROLES } from "@/lib/sales/access";
import type { LeadChannel, LeadStatus } from "@/lib/sales/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function LeadDetailPage({ params }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canUseLeads(user.role)) {
    redirect("/sales");
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [leadRes, notesRes, membersRes] = await Promise.all([
    supabase
      .from("sales_leads")
      .select(
        "id, name, phone_e164, channel, interest, estimated_value_myr, status, follow_up_at, assigned_to, customer_id, converted_at, lost_reason, created_at, updated_at",
      )
      .eq("id", id)
      .eq("business_id", user.businessId)
      .maybeSingle(),
    supabase
      .from("sales_lead_notes")
      .select("id, body, created_by, created_at")
      .eq("lead_id", id)
      .eq("business_id", user.businessId)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_business_memberships")
      .select("user_id, display_name, role")
      .eq("business_id", user.businessId)
      .in("role", LEAD_ASSIGNEE_ROLES),
  ]);

  if (!leadRes.data) notFound();

  const lead = {
    ...leadRes.data,
    channel: leadRes.data.channel as LeadChannel | null,
    status: leadRes.data.status as LeadStatus,
  };

  return (
    <div className="space-y-6">
      <Link
        href="/sales/leads"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        All leads
      </Link>

      <PageHeader
        eyebrow="Sales · Lead"
        title={lead.name}
        description={lead.phone_e164}
      />

      <LeadDetailClient
        lead={lead}
        notes={notesRes.data ?? []}
        assignees={(membersRes.data ?? []).map((m) => ({
          user_id: m.user_id,
          display_name: m.display_name,
          role: m.role,
        }))}
      />
    </div>
  );
}
