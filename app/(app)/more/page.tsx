import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  hasPillar,
  minimumTierFor,
  type Pillar,
} from "@/lib/auth/entitlements";
import { tierBy, type TierKey } from "@/lib/settings/plans";

export const metadata = { title: "More" };
export const dynamic = "force-dynamic";

interface MoreItem {
  href: string;
  label: string;
  description: string;
  pillar?: Pillar;
}

const SECTIONS: readonly { label: string; items: MoreItem[] }[] = [
  {
    label: "Modules",
    items: [
      {
        href: "/admin",
        label: "Admin",
        description: "Tasks · Compliance · Documents · Storage",
        pillar: "admin",
      },
      {
        href: "/sales",
        label: "Sales",
        description: "POS · Leads",
        pillar: "sales",
      },
      {
        href: "/hr",
        label: "HR",
        description: "Employees · Leave · Public holidays",
        pillar: "hr",
      },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        href: "/boardroom",
        label: "AI Boardroom",
        description: "Multi-agent business decisions",
      },
      {
        href: "/marketplace",
        label: "Marketplace",
        description: "Add-ons & AI Agents",
      },
      {
        href: "/settings/team",
        label: "Settings · Team",
        description: "Roles & invitations",
      },
      {
        href: "/settings/billing",
        label: "Settings · Billing",
        description: "Tier & subscriptions",
      },
    ],
  },
];

export default async function MorePage() {
  let tier: TierKey = "starter";
  try {
    const user = await getCurrentUser();
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("businesses")
      .select("tier")
      .eq("id", user.businessId)
      .maybeSingle();
    if (data?.tier) tier = data.tier as TierKey;
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink">More</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Surfaces not covered by the bottom-nav.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <Card key={section.label}>
          <CardHeader>
            <CardTitle className="text-base">{section.label}</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-cream-200">
              {section.items.map((item) => {
                const locked = item.pillar
                  ? !hasPillar(tier, item.pillar)
                  : false;
                const minTier = locked
                  ? tierBy(minimumTierFor(item.pillar!))
                  : null;
                const href = locked
                  ? `/settings/subscription?locked=${item.pillar}`
                  : item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={href}
                      className="flex items-center justify-between gap-3 px-4 py-3 min-h-tap-min hover:bg-cream-100 active:bg-cream-200 transition-colors"
                    >
                      <div className="min-w-0">
                        <p
                          className={`flex items-center gap-2 font-medium ${
                            locked ? "text-ink-muted" : "text-ink"
                          }`}
                        >
                          {item.label}
                          {locked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                              <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
                              {minTier?.label ?? "Upgrade"}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-ink-muted truncate">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight
                        className="h-5 w-5 text-ink-subtle shrink-0"
                        strokeWidth={2}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
