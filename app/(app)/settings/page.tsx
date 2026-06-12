import Link from "next/link";
import { Users, CreditCard, SunMoon, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Settings" };

const SETTINGS_SECTIONS = [
  {
    href: "/settings/team",
    label: "Team & Roles",
    description:
      "Invite staff, assign roles, revoke access, view activity log.",
    icon: Users,
  },
  {
    href: "/settings/billing",
    label: "Billing",
    description:
      "Subscription tier, add-ons, AI Agents, and payment method.",
    icon: CreditCard,
  },
  {
    href: "/settings/appearance",
    label: "Appearance",
    description:
      "Light, dark, or follow your system. Stored per browser for now.",
    icon: SunMoon,
  },
] as const;

export default function SettingsIndexPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
            Settings
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl dark:text-cream-100">
            Workspace settings
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-muted dark:text-cream-400">
            Manage who can access the workspace, what you&apos;re paying for,
            and how Bantu Niaga looks on this device.
          </p>
        </div>
        <Badge tone="brand">v1 core</Badge>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_SECTIONS.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <Card className="h-full transition-shadow group-hover:shadow-elevated">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="grid h-9 w-9 place-items-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                    >
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <CardTitle>{label}</CardTitle>
                  </div>
                  <ChevronRight
                    aria-hidden
                    className="h-4 w-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 dark:text-cream-400"
                    strokeWidth={2}
                  />
                </div>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-ink-muted dark:text-cream-400">
                  {description}
                </p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
