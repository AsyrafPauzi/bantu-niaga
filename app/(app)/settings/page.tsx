import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { isSaasDeployment } from "@/lib/platform/deployment";
import { loadBusiness } from "@/lib/settings/business";
import {
  getSettingsNavGroups,
  type SettingsNavItem,
} from "@/lib/settings/nav";
import { tierBy } from "@/lib/settings/plans";

export const metadata = { title: "Settings" };

export const dynamic = "force-dynamic";

export default async function SettingsIndexPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const business = await loadBusiness(user.businessId);
  const tier = business?.tier ?? "starter";
  const tierMeta = tierBy(tier);
  const settingsGroups = getSettingsNavGroups({ role: user.role });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl dark:text-cream-100">
            Settings
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            {business?.name ?? "Your business"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(isSaasDeployment() || user.role === "owner") && tierMeta ? (
            <Badge tone="accent">{tierMeta.label}</Badge>
          ) : null}
          <Badge tone="brand">
            {user.role === "owner"
              ? "Owner"
              : user.role.replace(/_/g, " ")}
          </Badge>
        </div>
      </header>

      {settingsGroups.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
            {group.title}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((section) => (
              <SectionCard key={section.href} section={section} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SectionCard({ section }: { section: SettingsNavItem }) {
  const { href, label, description, icon: Icon } = section;
  return (
    <Link
      href={href}
      className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <div className="flex h-full items-center gap-3 rounded-xl border border-cream-200 bg-white p-4 shadow-card transition-shadow group-hover:border-brand-200 group-hover:shadow-elevated dark:border-hairline-dark dark:bg-panel-dark dark:group-hover:border-brand-700">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
            {label}
          </h3>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {description}
          </p>
        </div>
        <ChevronRight
          aria-hidden
          className="h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 dark:text-cream-400"
          strokeWidth={2}
        />
      </div>
    </Link>
  );
}
