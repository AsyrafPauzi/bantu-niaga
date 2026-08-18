import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { isSaasDeployment } from "@/lib/platform/deployment";
import { shouldOfferBasicTrial } from "@/lib/settings/basic-trial";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BasicTrialBanner } from "./BasicTrialBanner";

export async function BasicTrialBannerHost() {
  try {
    const user = await getCurrentUser();
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("businesses")
      .select("tier, subscription_status, self_serve_trial_used_at")
      .eq("id", user.businessId)
      .maybeSingle();
    if (
      !shouldOfferBasicTrial({
        isSaas: isSaasDeployment(),
        role: user.role,
        tier: data?.tier ?? "starter",
        subscriptionStatus: data?.subscription_status ?? "active",
        selfServeTrialUsedAt: data?.self_serve_trial_used_at ?? null,
      })
    ) {
      return null;
    }
    return <BasicTrialBanner />;
  } catch (e) {
    if (e instanceof UnauthorizedError) return null;
    throw e;
  }
}
