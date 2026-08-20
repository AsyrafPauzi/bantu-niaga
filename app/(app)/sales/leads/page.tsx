import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
} from "@/components/dashboard/module-list-panel";
import { LeadCreateForm } from "@/components/sales/LeadCreateForm";
import { LeadsKanban } from "@/components/sales/LeadsKanban";
import { LeadsListSelectable } from "@/components/sales/LeadsListSelectable";
import { LeadsViewToggle } from "@/components/sales/LeadsViewToggle";
import { SalesSubpageShell } from "@/components/sales/SalesSubpageShell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { formatMyr } from "@/lib/marketing/metrics";
import { parsePagination } from "@/lib/pagination";
import { canUseLeads, LEAD_ASSIGNEE_ROLES } from "@/lib/sales/access";
import { loadLeadsInsights } from "@/lib/sales/leads-insights";
import { loadLeadChannelBreakdown } from "@/lib/sales/leads-channels";
import {
  LEAD_STATUSES,
  malaysiaDayBounds,
  malaysiaTodayYmd,
  type LeadStatus,
} from "@/lib/sales/schemas";
import { leadsSubpageHero } from "@/lib/sales/subpage-hero";
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
  const assigned = param(raw, "assigned");
  const mine = param(raw, "mine") === "1";
  const view = param(raw, "view") === "kanban" ? "kanban" : "list";
  const pagination = parsePagination(raw, { defaultPageSize: 20 });

  const supabase = await createSupabaseServerClient();
  const insights = await loadLeadsInsights(supabase, user.businessId);
  const channelBreakdown = await loadLeadChannelBreakdown(
    supabase,
    user.businessId,
  );
  const hero = leadsSubpageHero(insights);
  const { dayStartIso, dayEndIso } = malaysiaDayBounds(malaysiaTodayYmd());

  let query = supabase
    .from("sales_leads")
    .select(
      "id, name, phone_e164, channel, interest, estimated_value_myr, status, follow_up_at, assigned_to, customer_id, updated_at",
      { count: "exact" },
    )
    .eq("business_id", user.businessId)
    .order("updated_at", { ascending: false });

  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }
  if (mine) {
    query = query.eq("assigned_to", user.id);
  } else if (assigned === "__unassigned__") {
    query = query.is("assigned_to", null);
  } else if (assigned) {
    query = query.eq("assigned_to", assigned);
  }

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

  if (view === "list") {
    query = query.range(pagination.from, pagination.to);
  } else {
    query = query.limit(200);
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
  const total = leadsRes.count ?? leads.length;
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
      assigned: overrides.assigned !== undefined ? overrides.assigned : assigned,
      mine: overrides.mine !== undefined ? overrides.mine : mine ? "1" : "",
      view: overrides.view !== undefined ? overrides.view : view,
    };
    if (next.q) sp.set("q", next.q);
    if (next.status) sp.set("status", next.status);
    if (next.follow_up) sp.set("follow_up", next.follow_up);
    if (next.assigned) sp.set("assigned", next.assigned);
    if (next.mine === "1") sp.set("mine", "1");
    if (next.view === "kanban") sp.set("view", "kanban");
    const s = sp.toString();
    return s ? `/sales/leads?${s}` : "/sales/leads";
  }

  const searchParamsForPagination: Record<string, string | undefined> = {
    q: q || undefined,
    status: status || undefined,
    follow_up: followUp || undefined,
    assigned: assigned || undefined,
    mine: mine ? "1" : undefined,
  };

  return (
    <SalesSubpageShell
      headline={hero.headline}
      subcopy={hero.subcopy}
      variant={hero.variant}
      cta={
        <LeadCreateForm
          assignees={assignees}
          currentUserId={user.id}
          prefill={{
            name: param(raw, "prefill_name"),
            phone: param(raw, "prefill_phone"),
            interest: param(raw, "prefill_interest"),
            value: param(raw, "prefill_value"),
          }}
          autoOpen={param(raw, "open_create") === "1"}
        />
      }
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Open"
            value={String(insights.open)}
            hint="In pipeline"
            icon={<Users />}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Overdue"
            value={String(insights.overdue)}
            hint="Need chase"
            icon={<Users />}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="Due today"
            value={String(insights.dueToday)}
            hint="Follow-ups"
            icon={<Users />}
            iconClassName="text-blue-700 dark:text-blue-300"
          />
          <ModuleHeroStat
            label="Pipeline"
            value={
              insights.pipelineValueMyr > 0
                ? formatMyr(insights.pipelineValueMyr)
                : "—"
            }
            hint={
              insights.topChannel
                ? `Top: ${insights.topChannel}`
                : "Est. value"
            }
            icon={<Users />}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LeadsViewToggle view={view} baseHref={href({})} />
      </div>

      {channelBreakdown.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {channelBreakdown.map((row) => (
            <span
              key={row.channel}
              className="rounded-full border border-cream-300 px-3 py-1 text-xs font-semibold capitalize text-ink-muted dark:border-hairline-dark"
            >
              {row.channel.replace(/_/g, " ")} · {row.count}
            </span>
          ))}
        </div>
      ) : null}

      <ModuleListPanel>
        <ModuleListPanelFilters>
          <form className="flex flex-col gap-3 lg:flex-row lg:items-center" method="get">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-cream-300 bg-cream-50/50 px-3 py-2.5 dark:border-hairline-dark dark:bg-panel-dark/60">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name or phone"
                className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100"
              />
            </div>
            {mine ? <input type="hidden" name="mine" value="1" /> : null}
            {status ? <input type="hidden" name="status" value={status} /> : null}
            {followUp ? (
              <input type="hidden" name="follow_up" value={followUp} />
            ) : null}
            {view === "kanban" ? (
              <input type="hidden" name="view" value="kanban" />
            ) : null}
            <button
              type="submit"
              className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
            >
              Search
            </button>
          </form>

          <nav
            aria-label="Filter leads"
            className="mt-3 flex flex-wrap gap-2"
          >
            <FilterChip href={href({ status: null })} active={!status}>
              All statuses
            </FilterChip>
            {LEAD_STATUSES.map((s) => (
              <FilterChip key={s} href={href({ status: s })} active={status === s}>
                {s}
              </FilterChip>
            ))}
            <FilterChip
              href={href({
                follow_up: followUp === "due_today" ? null : "due_today",
              })}
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
            <FilterChip href={href({ mine: mine ? null : "1" })} active={mine}>
              Mine
            </FilterChip>
            {assignees.length > 0 ? (
              <>
                <FilterChip
                  href={href({
                    assigned: assigned === "__unassigned__" ? null : "__unassigned__",
                    mine: null,
                  })}
                  active={assigned === "__unassigned__"}
                >
                  Unassigned
                </FilterChip>
                {assignees.map((a) => (
                  <FilterChip
                    key={a.user_id}
                    href={href({
                      assigned: assigned === a.user_id ? null : a.user_id,
                      mine: null,
                    })}
                    active={assigned === a.user_id}
                  >
                    {a.display_name || a.role}
                  </FilterChip>
                ))}
              </>
            ) : null}
          </nav>
          <p className="mt-3 text-xs font-medium text-[#2563EB] dark:text-blue-300">
            {total} lead{total === 1 ? "" : "s"}
            {view === "kanban" ? " · Board view" : " · List view"}
          </p>
        </ModuleListPanelFilters>

        {view === "kanban" ? (
          <LeadsKanban
            leads={leads.map((l) => ({
              ...l,
              status: l.status as LeadStatus,
            }))}
            assigneeNames={nameById}
            overdueBeforeIso={dayStartIso}
          />
        ) : (
          <LeadsListSelectable
            embedded
            leads={leads.map((l) => ({
              ...l,
              status: l.status as LeadStatus,
            }))}
            total={total}
            assigneeNames={nameById}
            assignees={assignees}
            overdueBeforeIso={dayStartIso}
            pagination={{ page: pagination.page, pageSize: pagination.pageSize }}
            searchParamsForPagination={searchParamsForPagination}
          />
        )}
      </ModuleListPanel>
    </SalesSubpageShell>
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
          ? "border-[#2563EB] bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
          : "border-cream-300 text-ink-muted hover:border-blue-300 dark:border-hairline-dark",
      )}
    >
      {children}
    </Link>
  );
}
