import { notFound, redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { MarketingBroadcastsBackLink } from "@/components/marketing/MarketingBroadcastsBackLink";
import { BroadcastDetailView } from "@/components/marketing/BroadcastDetailView";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BroadcastRow } from "@/lib/marketing/broadcasts";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface RecipientDetail {
  id: string;
  broadcast_id: string;
  customer_id: string;
  channel_address: string;
  rendered_message: string;
  rendered_subject: string | null;
  status: "queued" | "sent" | "failed" | "opened";
  error: string | null;
  sent_at: string | null;
  customers: { id: string; name: string } | null;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { title: "Broadcast" };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("broadcasts")
    .select("name")
    .eq("business_id", user.businessId)
    .eq("id", id)
    .maybeSingle();
  return { title: data?.name ?? "Broadcast" };
}

export default async function BroadcastDetailPage({ params }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "broadcasts")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to Marketing broadcasts.
          </p>
        </CardBody>
      </Card>
    );
  }

  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const [{ data: broadcastRaw, error }, { data: business }] = await Promise.all([
    supabase
      .from("broadcasts")
      .select(
        "id, business_id, name, channel, segment_id, subject, message_template, " +
          "coupon_id, status, total_recipients, sent_count, failed_count, " +
          "scheduled_at, sent_at, created_by, created_at, updated_at, " +
          "customer_segments:segment_id (id, name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("name")
      .eq("id", user.businessId)
      .maybeSingle(),
  ]);

  if (error) {
    return (
      <Card>
        <CardBody className="text-sm text-status-danger">
          Failed to load broadcast: {error.message}
        </CardBody>
      </Card>
    );
  }
  if (!broadcastRaw) notFound();

  const broadcast = broadcastRaw as unknown as BroadcastRow & {
    customer_segments: { id: string; name: string } | null;
  };

  const { data: rcptRaw } = await supabase
    .from("broadcast_recipients")
    .select(
      "id, broadcast_id, customer_id, channel_address, rendered_message, " +
        "rendered_subject, status, error, sent_at, customers:customer_id (id, name)",
    )
    .eq("broadcast_id", id)
    .order("status", { ascending: true })
    .order("sent_at", { ascending: false, nullsFirst: true })
    .limit(500);
  const recipients = (rcptRaw ?? []) as unknown as RecipientDetail[];

  const businessName =
    typeof business?.name === "string" ? business.name : "Your business";
  const fromEmail = process.env.MARKETING_FROM_EMAIL ?? "hello@yourdomain.com";

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingBroadcastsBackLink />
      <BroadcastDetailView
        broadcast={broadcast}
        recipients={recipients}
        businessName={businessName}
        fromEmailLabel={fromEmail}
      />
    </div>
  );
}
