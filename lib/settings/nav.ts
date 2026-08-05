import {
  Building2,
  CreditCard,
  Crown,
  Image as ImageIcon,
  Plug,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SunMoon,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/permissions";
import { isStandaloneDeployment } from "@/lib/platform/deployment";

export interface SettingsNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
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
    icon: Crown,
  },
  {
    href: "/settings/billing",
    label: "Billing",
    description: "Invoices and payment methods.",
    icon: CreditCard,
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
          icon: ShieldCheck,
        },
        {
          href: "/settings/integrations",
          label: "API & integrations",
          description: "API keys, webhooks, and connected apps.",
          icon: Plug,
        },
        {
          href: "/settings/privacy",
          label: "Privacy (PDPA)",
          description: "Export data, consent, and account deletion.",
          icon: ShieldAlert,
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
          icon: Building2,
        },
        {
          href: "/settings/team",
          label: "Team",
          description: "Invite staff and assign roles.",
          icon: Users,
        },
        {
          href: "/settings/branding",
          label: "Branding",
          description: "Logo, colours, and DuitNow QR.",
          icon: ImageIcon,
        },
        {
          href: "/settings/appearance",
          label: "Appearance",
          description: "Light or dark mode.",
          icon: SunMoon,
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
          icon: Sparkles,
        },
      ],
    },
  );

  return groups;
}
