import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  PlugZap,
  XCircle,
  Zap,
} from "lucide-react";

import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  StatusPill,
} from "@/components/super-admin/primitives";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";
import { encryptionConfigured } from "@/lib/integrations/crypto";
import { loadIntegrationCatalog } from "@/lib/integrations/load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations · Super admin" };

export default async function SuperAdminIntegrationsIndex() {
  const groups = await loadIntegrationCatalog();
  const all = groups.flatMap((g) => g.items);
  const enabledCount = all.filter((i) => i.enabled).length;
  const failingCount = all.filter((i) => i.testStatus === "fail").length;
  const wiredCount = INTEGRATION_CATALOG.filter((d) => d.wired).length;
  const hasKey = encryptionConfigured();

  return (
    <>
      <PageTopbar
        title="API integrations"
        subtitle={`${INTEGRATION_CATALOG.length} integrations in catalog · ${wiredCount} wired into the app`}
      />
      <PageBody>
        {!hasKey ? (
          <div className="flex items-start gap-3 rounded-xl border border-status-warning/40 bg-status-warning/10 p-4">
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-lg bg-status-warning/20 text-status-warning"
            >
              <PlugZap className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">
                INTEGRATION_ENCRYPTION_KEY is not configured
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Generate a 32-byte hex key with{" "}
                <code className="rounded bg-cream-200 px-1 font-mono text-[11px]">
                  openssl rand -hex 32
                </code>
                {" "}and set it as <strong>INTEGRATION_ENCRYPTION_KEY</strong>{" "}
                in your environment, then redeploy. Until then, secrets
                cannot be persisted — you can still toggle integrations on or
                off and edit non-secret config.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex gap-3 flex-wrap">
          <KpiCard
            label="Enabled"
            value={enabledCount}
            subtle={`of ${all.length} in catalog`}
            trend="up"
          />
          <KpiCard
            label="Wired into app"
            value={wiredCount}
            subtle="active consumers"
          />
          <KpiCard
            label="Failing test"
            value={failingCount}
            subtle="last smoke-test"
            trend={failingCount > 0 ? "down" : "flat"}
          />
          <KpiCard
            label="Categories"
            value={groups.length}
            subtle="AI · Payments · Comms …"
          />
        </div>

        {groups.map((group) => (
          <section key={group.category} className="space-y-3">
            <header className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-ink">
                  <span className="mr-2" aria-hidden>
                    {group.emoji}
                  </span>
                  {group.label}
                </h2>
                <p className="text-xs text-ink-muted">{group.description}</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                {group.items.length} integrations
              </span>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((row) => {
                const descriptor = INTEGRATION_CATALOG.find(
                  (d) => d.slug === row.slug,
                );
                if (!descriptor) return null;
                return (
                  <Link
                    key={row.slug}
                    href={`/super-admin/integrations/${row.slug}`}
                    className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    <div className="flex h-full flex-col gap-3 rounded-xl border border-cream-300 bg-white p-4 shadow-card transition-shadow group-hover:border-brand-300 group-hover:shadow-elevated">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink truncate">
                            {row.displayName}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted line-clamp-2">
                            {descriptor.tagline}
                          </p>
                        </div>
                        <ChevronRight
                          aria-hidden
                          className="h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5"
                          strokeWidth={2}
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {row.enabled ? (
                          <StatusPill tone="success" label="Enabled" />
                        ) : (
                          <StatusPill tone="muted" label="Disabled" />
                        )}
                        {row.testStatus === "ok" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 text-[10px] font-semibold text-status-success">
                            <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
                            Test OK
                          </span>
                        ) : row.testStatus === "fail" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-status-danger/10 px-2 py-0.5 text-[10px] font-semibold text-status-danger">
                            <XCircle className="h-3 w-3" strokeWidth={2.5} />
                            Test failed
                          </span>
                        ) : null}
                        {descriptor.wired ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                            <Zap className="h-3 w-3" strokeWidth={2.5} />
                            Wired
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-semibold text-ink-subtle">
                            Catalog only
                          </span>
                        )}
                        {descriptor.importance === "core" ? (
                          <span className="inline-flex rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-700">
                            Core
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </PageBody>
    </>
  );
}
