import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { ContentEntryForm } from "@/components/marketing/ContentEntryForm";

export const metadata = { title: "New post" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TIPS = [
  "Hook in the first 3 seconds — show the product or the problem.",
  "End with a clear CTA (DM us, link in bio, call).",
  "Schedule mid-week mornings for highest engagement in MY.",
];

export default async function NewContentPage({ searchParams }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "content")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to the Content calendar.
          </p>
        </CardBody>
      </Card>
    );
  }

  const raw = await searchParams;
  const dateParam = typeof raw.date === "string" ? raw.date : undefined;
  // Convert YYYY-MM-DD → ISO timestamp at 09:00 MYT for the form prefill.
  let prefillIso: string | undefined;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    prefillIso = new Date(`${dateParam}T09:00:00+08:00`).toISOString();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/marketing/content"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to calendar
      </Link>

      <PageHeader
        eyebrow="Marketing · Content"
        title="New post"
        description="Plan a TikTok, Instagram or Facebook post. Save as idea, draft, or schedule directly."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <ContentEntryForm mode="create" prefillDateIso={prefillIso} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-accent-200 bg-accent-50 p-4 dark:border-accent-700/40 dark:bg-accent-700/15">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white">
                <Sparkles className="h-4 w-4" strokeWidth={2} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-200">
                  Maya · Content tips
                </p>
                <ul className="mt-2 space-y-2 text-sm text-ink dark:text-cream-100">
                  {TIPS.map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <Card>
            <CardBody className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                Status flow
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                idea → drafted → scheduled → posted. You can move backwards
                between the first three; posted is terminal.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
