import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  IntegrationsView,
  type ChannelCardConfig,
} from "@/components/settings/IntegrationsView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encryptionConfigured } from "@/lib/integrations/crypto";

export const metadata = { title: "API keys & integrations" };
export const dynamic = "force-dynamic";

const CHANNELS: readonly ChannelCardConfig[] = [
  {
    id: "facebook",
    name: "Facebook Page",
    description:
      "Cross-post and pull reach from your Facebook Pages. Free — no API fees.",
    icon: "facebook",
  },
  {
    id: "instagram",
    name: "Instagram Business",
    description:
      "Publish photos and captions, pull engagement metrics into Content Detail.",
    icon: "instagram",
  },
  {
    id: "tiktok",
    name: "TikTok for Business",
    description: "Sync post performance and run TikTok Ads from Marketing.",
    icon: "tiktok",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business Cloud",
    description: "Send broadcasts and order confirmations.",
    icon: "whatsapp",
  },
];

export default async function IntegrationsSettingsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const [keysRes, webhooksRes] = await Promise.all([
    supabase
      .from("business_api_keys")
      .select("id, label, key_prefix, scope, last_used_at, created_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("business_webhooks")
      .select(
        "id, url, events, active, delivered_count, failed_count, last_delivered_at, last_error, created_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const canEdit = user.role === "owner";

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to settings
      </Link>

      <PageHeader
        eyebrow="Settings · Security"
        title="API keys & integrations"
        description="Issue API tokens, configure outgoing webhooks, and connect marketing channels."
      />

      <IntegrationsView
        channels={CHANNELS}
        initialApiKeys={keysRes.data ?? []}
        initialWebhooks={webhooksRes.data ?? []}
        canEdit={canEdit}
        encryptionReady={encryptionConfigured()}
      />
    </div>
  );
}
