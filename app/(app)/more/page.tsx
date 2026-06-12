import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

export const metadata = { title: "More" };

const SECTIONS = [
  {
    label: "Pillars",
    items: [
      { href: "/admin", label: "Admin", description: "Tasks · Compliance · Documents · Storage" },
      { href: "/sales", label: "Sales", description: "POS · Leads" },
      { href: "/hr", label: "HR", description: "Employees · Leave · Public holidays" },
    ],
  },
  {
    label: "Cross-cutting",
    items: [
      { href: "/boardroom", label: "AI Boardroom", description: "Multi-agent business decisions" },
      { href: "/marketplace", label: "Marketplace", description: "Add-ons & AI Agents" },
      { href: "/settings/team", label: "Settings · Team", description: "Roles & invitations" },
      { href: "/settings/billing", label: "Settings · Billing", description: "Tier & subscriptions" },
    ],
  },
] as const;

export default function MorePage() {
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
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 px-4 py-3 min-h-tap-min hover:bg-cream-100 active:bg-cream-200 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{item.label}</p>
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
              ))}
            </ul>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
