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
        <p className="text-sm font-medium text-ink-muted">Welcome back</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">
          Bantu Niaga · v0 scaffold
        </h1>
        <p className="mt-2 max-w-2xl text-base text-ink-muted">
          Six pillars, one product. The scaffold below mirrors{" "}
          <code className="text-sm">docs/v1-core-scope.md</code>. Real surfaces
          land during the relevant build phase.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-base font-semibold text-ink-muted uppercase tracking-wider text-xs">
          Pillars
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
                  <p className="text-sm text-ink-muted">{pillar.description}</p>
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
            <CardBody className="text-sm text-ink-muted">
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
            <CardBody className="text-sm text-ink-muted">
              Add-on activation. Deferred until v1 core ships.
            </CardBody>
          </Card>
        </Link>
      </section>
    </div>
  );
}
