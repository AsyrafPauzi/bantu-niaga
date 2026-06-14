import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";

import { PageTopbar } from "@/components/super-admin/PageTopbar";
import { PageBody, Section } from "@/components/super-admin/primitives";
import { IntegrationEditor } from "@/components/super-admin/IntegrationEditor";
import { CATEGORY_META } from "@/lib/integrations/catalog";
import { encryptionConfigured } from "@/lib/integrations/crypto";
import { loadIntegration } from "@/lib/integrations/load";

export const dynamic = "force-dynamic";

export default async function IntegrationDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadIntegration(slug);
  if (!loaded) notFound();

  const { descriptor, row } = loaded;
  const category = CATEGORY_META[descriptor.category];

  return (
    <>
      <PageTopbar
        title={descriptor.name}
        subtitle={`${category.label} · ${descriptor.tagline}`}
        right={
          <a
            href={descriptor.docsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100"
          >
            <BookOpen className="h-3.5 w-3.5" strokeWidth={2} />
            Docs
            <ExternalLink className="h-3 w-3" strokeWidth={2} />
          </a>
        }
      />
      <PageBody>
        <Link
          href="/super-admin/integrations"
          className="inline-flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Back to integrations
        </Link>

        <Section title="About">
          <div className="space-y-3 text-sm text-ink">
            <p>{descriptor.description}</p>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                What this unlocks
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-ink-muted">
                {descriptor.capabilities.map((c) => (
                  <li key={c}>· {c}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {descriptor.wired ? (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                  Wired
                </span>
              ) : (
                <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-bold text-ink-subtle">
                  Catalog only
                </span>
              )}
              <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-bold text-accent-700 capitalize">
                {descriptor.importance}
              </span>
            </div>
          </div>
        </Section>

        <IntegrationEditor
          descriptor={descriptor}
          initialRow={row}
          encryptionConfigured={encryptionConfigured()}
        />
      </PageBody>
    </>
  );
}
