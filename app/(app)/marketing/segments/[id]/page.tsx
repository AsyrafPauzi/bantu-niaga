import { notFound, redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { MarketingSegmentsBackLink } from "@/components/marketing/MarketingSegmentsBackLink";
import { SegmentDetailView } from "@/components/marketing/SegmentDetailView";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  recomputeMemberCount,
  resolveSegmentMembers,
  SegmentNotFoundError,
  MemberCountUpdateError,
  type SegmentRow,
} from "@/lib/marketing/segments";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { title: "Segment" };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customer_segments")
    .select("name")
    .eq("business_id", user.businessId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return { title: data?.name ?? "Segment" };
}

export default async function SegmentDetailPage({
  params,
  searchParams,
}: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "segments")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to Marketing segments.
          </p>
        </CardBody>
      </Card>
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const openEditOnLoad = sp.edit === "1" || sp.edit === "true";
  const supabase = await createSupabaseServerClient();

  let segment: SegmentRow;
  let memberCount: number;
  try {
    const result = await recomputeMemberCount(supabase, id);
    segment = result.segment;
    memberCount = result.count;
  } catch (e) {
    if (e instanceof SegmentNotFoundError) notFound();
    if (e instanceof MemberCountUpdateError) {
      memberCount = e.count;
      const { data: row } = await supabase
        .from("customer_segments")
        .select(
          "id, business_id, name, kind, auto_key, rules, member_count, member_count_at, created_by, created_at, updated_at, deleted_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (!row) notFound();
      segment = row as SegmentRow;
    } else {
      throw e;
    }
  }

  const memberPage = await resolveSegmentMembers(supabase, id, { limit: 25 });

  return (
    <div className="space-y-4">
      <MarketingSegmentsBackLink />
      <SegmentDetailView
        segment={segment}
        memberCount={memberCount}
        members={memberPage.members}
        hasMoreMembers={Boolean(memberPage.nextCursor)}
        openEditOnLoad={openEditOnLoad && segment.kind === "custom"}
      />
    </div>
  );
}
