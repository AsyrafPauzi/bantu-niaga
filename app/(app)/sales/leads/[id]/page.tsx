import { notFound, redirect } from "next/navigation";
import { LeadDetailClient } from "@/components/sales/LeadDetailClient";
import { SalesSubpageShell } from "@/components/sales/SalesSubpageShell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUseLeads, LEAD_ASSIGNEE_ROLES } from "@/lib/sales/access";
import type { LeadChannel, LeadStatus } from "@/lib/sales/schemas";
import { loadLeadQuotes } from "@/lib/sales/lead-quotes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAdminFileNames } from "@/lib/admin/validate-admin-file";
import { loadBusiness } from "@/lib/settings/business";

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

  const [leadRes, notesRes, membersRes, business] = await Promise.all([
    supabase
      .from("sales_leads")
      .select(
        "id, name, phone_e164, channel, interest, estimated_value_myr, status, follow_up_at, assigned_to, customer_id, converted_at, lost_reason, admin_file_id, created_at, updated_at",
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
    loadBusiness(user.businessId),
  ]);

  if (!leadRes.data) notFound();

  const fileNames = await loadAdminFileNames(
    supabase,
    user.businessId,
    leadRes.data.admin_file_id ? [leadRes.data.admin_file_id] : [],
  );

  const lead = {
    ...leadRes.data,
    channel: leadRes.data.channel as LeadChannel | null,
    status: leadRes.data.status as LeadStatus,
    admin_file_name: leadRes.data.admin_file_id
      ? (fileNames.get(leadRes.data.admin_file_id) ?? null)
      : null,
  };

  const quotes = await loadLeadQuotes(supabase, user.businessId, {
    name: lead.name,
    phone_e164: lead.phone_e164,
  });

  return (
    <SalesSubpageShell
      headline={lead.name}
      subcopy={lead.phone_e164}
      variant={
        lead.status === "won"
          ? "calm"
          : lead.status === "lost"
            ? "attention"
            : "sales"
      }
    >
      <LeadDetailClient
        lead={lead}
        notes={notesRes.data ?? []}
        assignees={(membersRes.data ?? []).map((m) => ({
          user_id: m.user_id,
          display_name: m.display_name,
          role: m.role,
        }))}
        businessName={business?.name ?? undefined}
        idcompany={business?.idcompany ?? ""}
        quotes={quotes}
      />
    </SalesSubpageShell>
  );
}
