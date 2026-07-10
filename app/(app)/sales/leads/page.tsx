import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusPill } from "@/components/dashboard/status-pill";
import { LeadCreateForm } from "@/components/sales/LeadCreateForm";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { formatMyr } from "@/lib/marketing/metrics";
import { canUseLeads, LEAD_ASSIGNEE_ROLES } from "@/lib/sales/access";
import {
  LEAD_STATUSES,
  malaysiaDayBounds,
  malaysiaTodayYmd,
  type LeadStatus,
} from "@/lib/sales/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function param(
  raw: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = raw[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return "";
}

const STATUS_TONE: Record<
  LeadStatus,
  "neutral" | "brand" | "success" | "warning" | "accent"
> = {
  new: "neutral",
  contacted: "brand",
  interested: "accent",
  won: "success",
  lost: "warning",
};

export default async function LeadsPage({ searchParams }: PageProps) {
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

  const raw = await searchParams;
  const q = param(raw, "q").trim();
  const status = param(raw, "status");
  const followUp = param(raw, "follow_up");
  const mine = param(raw, "mine") === "1";

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("sales_leads")
    .select(
      "id, name, phone_e164, channel, interest, estimated_value_myr, status, follow_up_at, assigned_to, customer_id, updated_at",
    )
    .eq("business_id", user.businessId)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }
  if (mine) {
    query = query.eq("assigned_to", user.id);
  }

  const { dayStartIso, dayEndIso } = malaysiaDayBounds(malaysiaTodayYmd());
  if (followUp === "due_today") {
    query = query
      .gte("follow_up_at", dayStartIso)
      .lt("follow_up_at", dayEndIso);
  } else if (followUp === "overdue") {
    query = query
      .not("follow_up_at", "is", null)
      .lt("follow_up_at", dayStartIso)
      .not("status", "in", "(won,lost)");
  }

  if (q) {
    const safe = q.replace(/[%_,]/g, "");
    if (safe) {
      query = query.or(`name.ilike.%${safe}%,phone_e164.ilike.%${safe}%`);
    }
  }

  const [leadsRes, membersRes] = await Promise.all([
    query,
    supabase
      .from("user_business_memberships")
      .select("user_id, display_name, role")
      .eq("business_id", user.businessId)
      .in("role", LEAD_ASSIGNEE_ROLES),
  ]);

  const leads = leadsRes.data ?? [];
  const assignees = (membersRes.data ?? []).map((m) => ({
    user_id: m.user_id,
    display_name: m.display_name,
    role: m.role,
  }));
  const nameById = new Map(
    assignees.map((a) => [a.user_id, a.display_name || a.role]),
  );

  function href(overrides: Record<string, string | null>) {
    const sp = new URLSearchParams();
    const next = {
      q: overrides.q !== undefined ? overrides.q : q,
      status: overrides.status !== undefined ? overrides.status : status,
      follow_up:
        overrides.follow_up !== undefined ? overrides.follow_up : followUp,
      mine: overrides.mine !== undefined ? overrides.mine : mine ? "1" : "",
    };
    if (next.q) sp.set("q", next.q);
    if (next.status) sp.set("status", next.status);
    if (next.follow_up) sp.set("follow_up", next.follow_up);
    if (next.mine === "1") sp.set("mine", "1");
    const s = sp.toString();
    return s ? `/sales/leads?${s}` : "/sales/leads";
  }

  return (
    <div className="space-y-6">
      <Link
        href="/sales"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Sales
      </Link>

      <PageHeader
        eyebrow="Sales"
        title="Leads"
        description="Chase prospects, set follow-ups, convert won leads to customers."
        action={
          <LeadCreateForm
            assignees={assignees}
            currentUserId={user.id}
          />
        }
      />

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or phone"
          className="min-w-[12rem] flex-1 rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark"
        />
        {mine ? <input type="hidden" name="mine" value="1" /> : null}
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {followUp ? (
          <input type="hidden" name="follow_up" value={followUp} />
        ) : null}
        <button
          type="submit"
          className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <FilterChip href={href({ status: null })} active={!status}>
          All statuses
        </FilterChip>
        {LEAD_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={href({ status: s })}
            active={status === s}
          >
            {s}
          </FilterChip>
        ))}
        <FilterChip
          href={href({ follow_up: followUp === "due_today" ? null : "due_today" })}
          active={followUp === "due_today"}
        >
          Due today
        </FilterChip>
        <FilterChip
          href={href({ follow_up: followUp === "overdue" ? null : "overdue" })}
          active={followUp === "overdue"}
        >
          Overdue
        </FilterChip>
        <FilterChip
          href={href({ mine: mine ? null : "1" })}
          active={mine}
        >
          Mine
        </FilterChip>
      </div>

      <div className="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        {leads.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            No leads yet. Create one to start chasing.
          </p>
        ) : (
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {leads.map((lead) => {
              const overdue =
                lead.follow_up_at &&
                lead.status !== "won" &&
                lead.status !== "lost" &&
                new Date(lead.follow_up_at) < new Date(dayStartIso);
              return (
                <li key={lead.id}>
                  <Link
                    href={`/sales/leads/${lead.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-cream-50/80 dark:hover:bg-hairline-dark/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                        {lead.name}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {lead.phone_e164}
                        {lead.assigned_to
                          ? ` · ${nameById.get(lead.assigned_to) ?? "Assigned"}`
                          : ""}
                        {lead.follow_up_at
                          ? ` · Follow-up ${toDateInput(lead.follow_up_at)}`
                          : ""}
                        {overdue ? " · Overdue" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.estimated_value_myr != null ? (
                        <span className="text-xs font-medium text-ink-muted">
                          {formatMyr(Number(lead.estimated_value_myr))}
                        </span>
                      ) : null}
                      <StatusPill
                        tone={STATUS_TONE[lead.status as LeadStatus] ?? "neutral"}
                      >
                        {lead.status}
                      </StatusPill>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
        active
          ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
          : "border-cream-300 text-ink-muted hover:border-brand-300 dark:border-hairline-dark",
      )}
    >
      {children}
    </Link>
  );
}

function toDateInput(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
