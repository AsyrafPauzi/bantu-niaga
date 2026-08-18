import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureMembership } from "@/lib/auth/memberships";
import {
  DEFAULT_GENERIC_QUIZ_ANSWERS,
  planQuizToDbPayload,
} from "@/lib/onboarding/default-quiz";
import type { PlanQuizAnswers } from "@/lib/onboarding/plan-quiz";
import type { OnboardingQuizInput } from "@/lib/onboarding/schemas";
import type { EmailLocale } from "@/lib/email/types";
import {
  freePlanRenewalAt,
  issueSubscriptionInvoice,
  subscriptionPeriodLabel,
  trialRenewalAt,
} from "@/lib/settings/subscription-billing";
import { grantBasicTrialCredits } from "@/lib/settings/subscription-credits";

export type SignupPath = "free" | "starter_trial";

export function ownerProvisionPlan(signupPath: SignupPath): {
  tier: "starter" | "basic";
  subscriptionStatus: "active" | "trial";
  trialDays: 0 | 7;
  grantCredits: boolean;
  periodLabel: string;
} {
  if (signupPath === "free") {
    return {
      tier: "starter",
      subscriptionStatus: "active",
      trialDays: 0,
      grantCredits: false,
      periodLabel: `${subscriptionPeriodLabel()} — Free plan`,
    };
  }
  return {
    tier: "basic",
    subscriptionStatus: "trial",
    trialDays: 7,
    grantCredits: true,
    periodLabel: "7-day Basic trial",
  };
}

function quizAnswersForSignUp(
  onboardingQuiz: OnboardingQuizInput | undefined,
): PlanQuizAnswers {
  if (onboardingQuiz) {
    return {
      businessType: onboardingQuiz.business_type,
      teamSize: onboardingQuiz.team_size_band,
      priorities: onboardingQuiz.priorities,
    };
  }
  return DEFAULT_GENERIC_QUIZ_ANSWERS;
}

function slugifyBusiness(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "business"
  );
}

function randomShort(): string {
  return Math.random().toString(36).slice(2, 8);
}

export interface ProvisionOwnerInput {
  authUserId: string;
  email: string;
  businessName: string;
  stateCode?: string;
  signupPath: SignupPath;
  onboardingQuiz?: OnboardingQuizInput;
  sourceIp: string | null;
  userAgent: string | null;
  signupSource: "self_serve" | "google";
  preferredLocale: EmailLocale;
}

export function ownerProfileInsertPayload(
  input: Pick<
    ProvisionOwnerInput,
    "authUserId" | "email" | "businessName" | "preferredLocale"
  >,
  businessId: string,
): {
  id: string;
  business_id: string;
  role: "owner";
  display_name: string;
  email: string;
  preferred_locale: EmailLocale;
} {
  return {
    id: input.authUserId,
    business_id: businessId,
    role: "owner",
    display_name: input.businessName,
    email: input.email,
    preferred_locale: input.preferredLocale,
  };
}

export type ProvisionOwnerResult =
  | { ok: true; businessId: string; idcompany: string }
  | { ok: false; error: string; message: string; status: number };

async function rollbackProvision(
  admin: SupabaseClient,
  authUserId: string,
  businessId: string | null,
): Promise<void> {
  if (!businessId) return;
  await admin.from("user_consents").delete().eq("user_id", authUserId);
  await admin.from("users").delete().eq("id", authUserId);
  await admin
    .from("user_business_memberships")
    .delete()
    .eq("user_id", authUserId)
    .eq("business_id", businessId);
  await admin.from("businesses").delete().eq("id", businessId);
}

export async function provisionOwnerBusiness(
  admin: SupabaseClient,
  input: ProvisionOwnerInput,
): Promise<ProvisionOwnerResult> {
  const plan = ownerProvisionPlan(input.signupPath);
  const idcompany = slugifyBusiness(input.businessName) + "-" + randomShort();
  const quizDb = planQuizToDbPayload(
    quizAnswersForSignUp(input.onboardingQuiz),
  );
  const policyVersion = process.env.PRIVACY_POLICY_VERSION || "2026-06-14";

  const { data: businessRow, error: businessError } = await admin
    .from("businesses")
    .insert({
      idcompany,
      name: input.businessName,
      state_code: input.stateCode ?? null,
      tier: plan.tier,
      subscription_status: plan.subscriptionStatus,
      subscription_renewal_at:
        input.signupPath === "free" ? freePlanRenewalAt() : trialRenewalAt(),
      brand_primary_hex: "#5B8C5A",
      brand_accent_hex: "#F4A340",
      credit_balance: 0,
      self_serve_trial_used_at:
        input.signupPath === "starter_trial" ? new Date().toISOString() : null,
      business_type: quizDb.business_type,
      team_size_band: quizDb.team_size_band,
      onboarding_priorities: quizDb.priorities,
    })
    .select("id, idcompany, name")
    .single();

  if (businessError || !businessRow) {
    return {
      ok: false,
      error: "business_create_failed",
      message: businessError?.message ?? "Could not create business",
      status: 500,
    };
  }

  const { error: profileError } = await admin.from("users").insert({
    ...ownerProfileInsertPayload(input, businessRow.id),
    last_password_change_at: new Date().toISOString(),
  });

  if (profileError) {
    await rollbackProvision(admin, input.authUserId, businessRow.id);
    return {
      ok: false,
      error: "profile_create_failed",
      message: profileError.message,
      status: 500,
    };
  }

  try {
    await ensureMembership(input.authUserId, businessRow.id, "owner", {
      email: input.email,
      display_name: input.businessName,
    });
  } catch (membershipError) {
    await rollbackProvision(admin, input.authUserId, businessRow.id);
    return {
      ok: false,
      error: "membership_create_failed",
      message:
        membershipError instanceof Error
          ? membershipError.message
          : "Could not link business membership",
      status: 500,
    };
  }

  try {
    await issueSubscriptionInvoice(admin, {
      businessId: businessRow.id,
      userId: input.authUserId,
      periodLabel: plan.periodLabel,
      amountMyr: 0,
    });
  } catch (invoiceError) {
    await rollbackProvision(admin, input.authUserId, businessRow.id);
    return {
      ok: false,
      error: "invoice_create_failed",
      message:
        invoiceError instanceof Error
          ? invoiceError.message
          : "Could not create subscription invoice",
      status: 500,
    };
  }

  if (plan.grantCredits) {
    try {
      await grantBasicTrialCredits(businessRow.id, input.authUserId, admin);
    } catch (creditError) {
      await rollbackProvision(admin, input.authUserId, businessRow.id);
      return {
        ok: false,
        error: "credit_grant_failed",
        message:
          creditError instanceof Error
            ? creditError.message
            : "Could not grant trial credits",
        status: 500,
      };
    }
  }

  await Promise.all([
    admin.from("audit_log").insert({
      business_id: businessRow.id,
      actor_user_id: input.authUserId,
      action: "auth.sign_up",
      entity_type: "business",
      entity_id: businessRow.id,
      diff: {
        tier: plan.tier,
        signup_path: input.signupPath,
        signup_source: input.signupSource,
        trial_days: plan.trialDays,
        policy_version: policyVersion,
      },
    }),
    admin.from("user_consents").insert([
      {
        business_id: businessRow.id,
        user_id: input.authUserId,
        kind: "terms_of_service",
        granted: true,
        policy_version: policyVersion,
        granted_at: new Date().toISOString(),
        source_ip: input.sourceIp,
        user_agent: input.userAgent,
      },
      {
        business_id: businessRow.id,
        user_id: input.authUserId,
        kind: "privacy_notice",
        granted: true,
        policy_version: policyVersion,
        granted_at: new Date().toISOString(),
        source_ip: input.sourceIp,
        user_agent: input.userAgent,
      },
    ]),
  ]);

  return {
    ok: true,
    businessId: businessRow.id,
    idcompany: businessRow.idcompany,
  };
}
