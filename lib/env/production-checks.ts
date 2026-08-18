import "server-only";

import { getDeploymentMode } from "@/lib/platform/deployment";

export interface ProductionEnvCheck {
  key: string;
  ok: boolean;
  required: boolean;
  hint?: string;
}

/**
 * Runtime checks for production deploy readiness.
 * Used by /api/health — does not throw on missing vars (reports status).
 */
export function runProductionEnvChecks(): ProductionEnvCheck[] {
  const isProd = process.env.NODE_ENV === "production";

  const checks: ProductionEnvCheck[] = [
    {
      key: "DEPLOYMENT_MODE",
      ok: true,
      required: false,
      hint: `Active mode: ${getDeploymentMode()}. Set standalone for on-prem installs.`,
    },
    {
      key: "NEXT_PUBLIC_APP_URL",
      ok: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
      required: isProd,
      hint: "Required for invite links and Billplz callbacks.",
    },
    {
      key: "CRON_SECRET",
      ok: Boolean(process.env.CRON_SECRET?.trim()),
      required: isProd,
      hint: "Protects Vercel cron routes.",
    },
    {
      key: "INTEGRATION_ENCRYPTION_KEY",
      ok: Boolean(process.env.INTEGRATION_ENCRYPTION_KEY?.trim()),
      required: isProd,
      hint: "Generate: openssl rand -hex 32",
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      required: true,
    },
    {
      key: "BILLPLZ_API_KEY",
      ok: Boolean(process.env.BILLPLZ_API_KEY?.trim()),
      required: false,
      hint: "Optional — without it, billing uses dev bypass.",
    },
    {
      key: "BILLPLZ_X_SIGNATURE_KEY",
      ok: Boolean(process.env.BILLPLZ_X_SIGNATURE_KEY?.trim()),
      required: Boolean(process.env.BILLPLZ_API_KEY?.trim()),
      hint: "Required when Billplz is enabled (webhook verification).",
    },
    {
      key: "RESEND_API_KEY",
      ok: Boolean(process.env.RESEND_API_KEY?.trim()),
      required: false,
      hint: "Marketing broadcasts + Boardroom digest email.",
    },
    {
      key: "MARKETING_FROM_EMAIL",
      ok: Boolean(process.env.MARKETING_FROM_EMAIL?.trim()),
      required: false,
      hint: "From address for Resend emails.",
    },
    {
      key: "AUTH_SEND_EMAIL_HOOK_SECRET",
      ok: Boolean(process.env.AUTH_SEND_EMAIL_HOOK_SECRET?.trim()),
      required: false,
      hint: "Supabase Auth Send Email hook signing secret.",
    },
  ];

  return checks;
}

export function productionEnvHealthy(): boolean {
  return runProductionEnvChecks()
    .filter((c) => c.required)
    .every((c) => c.ok);
}
