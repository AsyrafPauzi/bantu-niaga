import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { IntegrationsView } from "@/components/settings/IntegrationsView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encryptionConfigured } from "@/lib/integrations/crypto";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

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

  const apiKeys = keysRes.data ?? [];
  const webhooks = webhooksRes.data ?? [];
  const canEdit = user.role === "owner";

  const summaryParts = [
    `${apiKeys.length} API key${apiKeys.length === 1 ? "" : "s"}`,
    `${webhooks.length} webhook${webhooks.length === 1 ? "" : "s"}`,
  ];

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Integrations"
        description={summaryParts.join(" · ")}
      />

      <IntegrationsView
        initialApiKeys={apiKeys}
        initialWebhooks={webhooks}
        canEdit={canEdit}
        encryptionReady={encryptionConfigured()}
      />
    </>
  );
}
