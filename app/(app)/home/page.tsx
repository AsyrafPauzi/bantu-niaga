import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PILLAR_LIST } from "@/lib/pillars";

export const metadata = {
  title: "Home",
};

export default function HomePage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-accent-600 dark:text-accent-300">Welcome back</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl dark:text-cream-100">
          Bantu Niaga
        </h1>
        <p className="mt-2 max-w-2xl text-base text-ink-muted dark:text-cream-400">
          Six modules, one product. The scaffold below mirrors{" "}
          <code className="text-sm">docs/v1-core-scope.md</code>. Real surfaces
          land during the relevant build phase.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
          Modules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PILLAR_LIST.map((pillar) => (
            <Link
              key={pillar.id}
              href={pillar.href}
              className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-xl"
            >
              <Card className="h-full transition-shadow group-hover:shadow-elevated">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{pillar.label}</CardTitle>
                    <Badge tone="brand">core</Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  <p className="text-sm text-ink-muted dark:text-cream-400">{pillar.description}</p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {pillar.surfaces.slice(0, 4).map((surface) => (
                      <li key={surface.href}>
                        <Badge tone="neutral">{surface.label}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/boardroom" className="block">
          <Card className="h-full transition-shadow hover:shadow-elevated">
            <CardHeader>
              <CardTitle>AI Boardroom</CardTitle>
            </CardHeader>
            <CardBody className="text-sm text-ink-muted dark:text-cream-400">
              Multi-agent business decisions. Activates when ≥ 2 AI Agents are
              subscribed.
            </CardBody>
          </Card>
        </Link>
        <Link href="/marketplace" className="block">
          <Card className="h-full transition-shadow hover:shadow-elevated">
            <CardHeader>
              <CardTitle>Marketplace</CardTitle>
            </CardHeader>
            <CardBody className="text-sm text-ink-muted dark:text-cream-400">
              Add-on activation. Deferred until v1 core ships.
            </CardBody>
          </Card>
        </Link>
      </section>
    </div>
  );
}
