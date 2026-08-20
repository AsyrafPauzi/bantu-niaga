import type { Role } from "@/lib/permissions";
import { isStandaloneDeployment } from "@/lib/platform/deployment";

export type SettingsIconName =
  | "Crown"
  | "CreditCard"
  | "ShieldCheck"
  | "Plug"
  | "ShieldAlert"
  | "Building2"
  | "Users"
  | "Image"
  | "SunMoon"
  | "Sparkles";

export interface SettingsNavItem {
  href: string;
  label: string;
  description: string;
  iconName: SettingsIconName;
}

export interface SettingsNavGroup {
  title: string;
  items: SettingsNavItem[];
}

export interface SettingsNavOptions {
  role?: Role;
  /** Override deployment detection (tests). */
  standalone?: boolean;
}

const PLAN_AND_BILLING_ITEMS: SettingsNavItem[] = [
  {
    href: "/settings/subscription",
    label: "Subscription",
    description: "Your plan and renewal date.",
    iconName: "Crown",
  },
  {
    href: "/settings/billing",
    label: "Billing",
    description: "Invoices and payment methods.",
    iconName: "CreditCard",
  },
];

/** Owners always see plan & billing; SaaS shows it for all roles. */
export function shouldShowPlanAndBilling(
  standalone: boolean,
  role?: Role,
): boolean {
  if (!standalone) return true;
  return role === "owner";
}

/** Server components — reads `DEPLOYMENT_MODE` unless overridden. */
export function getSettingsNavGroups(options?: SettingsNavOptions): SettingsNavGroup[] {
  const standalone = options?.standalone ?? isStandaloneDeployment();
  return buildSettingsNavGroups(standalone, options?.role);
}

export function buildSettingsNavGroups(
  standalone: boolean,
  role?: Role,
): SettingsNavGroup[] {
  const groups: SettingsNavGroup[] = [];

  if (shouldShowPlanAndBilling(standalone, role)) {
    groups.push({
      title: "Plan & billing",
      items: PLAN_AND_BILLING_ITEMS,
    });
  }

  groups.push(
    {
      title: "Security",
      items: [
        {
          href: "/settings/security",
          label: "Security",
          description: "Password, 2FA, and active sessions.",
          iconName: "ShieldCheck",
        },
        {
          href: "/settings/integrations",
          label: "API & integrations",
          description: "API keys, webhooks, and connected apps.",
          iconName: "Plug",
        },
        {
          href: "/settings/privacy",
          label: "Privacy (PDPA)",
          description: "Export data, consent, and account deletion.",
          iconName: "ShieldAlert",
        },
      ],
    },
    {
      title: "Workspace",
      items: [
        {
          href: "/settings/business",
          label: "Business profile",
          description: "Company name, state, and contact details.",
          iconName: "Building2",
        },
        {
          href: "/settings/team",
          label: "Team",
          description: "Invite staff and assign roles.",
          iconName: "Users",
        },
        {
          href: "/settings/branding",
          label: "Branding",
          description: "Logo, colours, and DuitNow QR.",
          iconName: "Image",
        },
        {
          href: "/settings/appearance",
          label: "Appearance",
          description: "Light or dark mode.",
          iconName: "SunMoon",
        },
      ],
    },
    {
      title: "AI",
      items: [
        {
          href: "/settings/ai-agents",
          label: "AI agents",
          description: "Turn module assistants on or off.",
          iconName: "Sparkles",
        },
      ],
    },
  );

  return groups;
}
