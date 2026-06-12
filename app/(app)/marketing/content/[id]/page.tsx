import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContentEntryForm } from "@/components/marketing/ContentEntryForm";
import { ContentStatusBadge } from "@/components/marketing/ContentStatusBadge";
import { ContentPlatformBadge } from "@/components/marketing/ContentPlatformBadge";
import { ContentEntryActions } from "./ContentEntryActions";
import type {
  ContentEntryRow,
  ContentMediaRow,
} from "@/components/marketing/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Content ${id.slice(0, 8)}` };
}

function fmtMyt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-MY", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function ContentEntryDetailPage({ params }: PageProps) {
  const { id } = await params;

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
            You don't have access to the Marketing content calendar.
          </p>
        </CardBody>
      </Card>
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: entry, error } = await supabase
    .from("content_plan")
    .select(
      "id, business_id, channel, status, scheduled_at, hook, caption, " +
        "created_by, posted_at, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <Card>
        <CardBody className="py-6">
          <p className="text-sm text-status-danger">
            Failed to load entry: {error.message}
          </p>
        </CardBody>
      </Card>
    );
  }
  if (!entry) notFound();

  const { data: mediaRows } = await supabase
    .from("content_plan_media")
    .select("content_plan_id, file_id, position")
    .eq("business_id", user.businessId)
    .eq("content_plan_id", id)
    .order("position", { ascending: true });

  const e = entry as unknown as ContentEntryRow;
  const media = (mediaRows ?? []).map((r) => ({
    file_id: r.file_id as string,
    position: r.position as number,
  })) as ContentMediaRow[];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/marketing/content"
            className="text-sm text-brand-700 hover:underline dark:text-brand-300"
          >
            ← Content calendar
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-ink dark:text-cream-100">
            Content entry
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ContentPlatformBadge channel={e.channel} />
            <ContentStatusBadge status={e.status} />
            <span className="text-xs text-ink-muted dark:text-cream-400">
              Scheduled: {fmtMyt(e.scheduled_at)}
            </span>
            {e.posted_at && (
              <span className="text-xs text-ink-muted dark:text-cream-400">
                Posted: {fmtMyt(e.posted_at)}
              </span>
            )}
          </div>
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Status & actions</CardTitle>
          <ContentEntryActions entryId={e.id} currentStatus={e.status} />
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-ink dark:text-cream-100">
          <p className="text-xs text-ink-muted dark:text-cream-400">
            Move the entry through{" "}
            <code>idea → drafted → scheduled → posted</code>. Backwards
            transitions are allowed; <code>posted</code> is terminal in v1.
          </p>
        </CardBody>
      </Card>

      <ContentEntryForm mode="edit" initial={e} initialMedia={media} />
    </div>
  );
}
