import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronRight,
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
import { Badge } from "@/components/ui/badge";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadBusiness } from "@/lib/settings/business";
import { tierBy } from "@/lib/settings/plans";
import {
  loadTeamInvites,
  loadTeamMembers,
  seatQuota,
} from "@/lib/settings/team";

export const metadata = { title: "Settings" };

interface SettingsSection {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: { label: string; tone: "brand" | "accent" | "neutral" };
}

interface SettingsGroup {
  title: string;
  description: string;
  sections: SettingsSection[];
}

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    title: "Account & plan",
    description: "What you pay for and how Bantu Niaga bills you.",
    sections: [
      {
        href: "/settings/subscription",
        label: "Subscription plan",
        description:
          "Your tier, included quotas, AI Agent seats, and renewal date.",
        icon: Crown,
        badge: { label: "Growth · RM 139", tone: "accent" },
      },
      {
        href: "/settings/billing",
        label: "Billing & payment",
        description:
          "Payment methods, invoices, top-ups, and the next charge.",
        icon: CreditCard,
      },
    ],
  },
  {
    title: "Security",
    description: "Lock the workspace down and choose who can connect.",
    sections: [
      {
        href: "/settings/security",
        label: "Security settings",
        description:
          "Two-factor auth, active sessions, password rotation, and audit log.",
        icon: ShieldCheck,
      },
      {
        href: "/settings/integrations",
        label: "API keys & integrations",
        description:
          "Bantu Niaga API tokens, webhooks, OAuth connections to TikTok, IG, FB, WhatsApp.",
        icon: Plug,
      },
      {
        href: "/settings/privacy",
        label: "Privacy & data (PDPA)",
        description:
          "Download your data, manage consent, or close your account. Aligned with Malaysia's PDPA 2010.",
        icon: ShieldAlert,
      },
    ],
  },
  {
    title: "Workspace",
    description: "People, brand identity, and how the app looks.",
    sections: [
      {
        href: "/settings/team",
        label: "Team & roles",
        description:
          "Invite staff, assign roles, revoke access, view the activity log.",
        icon: Users,
      },
      {
        href: "/settings/branding",
        label: "Branding",
        description:
          "Logo, primary colour, receipt header, and public booking-page identity.",
        icon: ImageIcon,
      },
      {
        href: "/settings/appearance",
        label: "Appearance",
        description:
          "Light, dark, or follow your system. Stored per browser for now.",
        icon: SunMoon,
      },
    ],
  },
  {
    title: "Power features",
    description: "Turn AI agents on or off and manage their daily budget.",
    sections: [
      {
        href: "/settings/ai-agents",
        label: "AI Agent activation",
        description:
          "Switch Maya, Fayza, Aiman, Sufi, Hana, Amir, and Boardroom agents on or off; set their daily budget.",
        icon: Sparkles,
        badge: { label: "7 agents", tone: "brand" },
      },
    ],
  },
];

export const dynamic = "force-dynamic";

export default async function SettingsIndexPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const business = await loadBusiness(user.businessId);
  const [members, invites] = await Promise.all([
    loadTeamMembers(user.businessId),
    loadTeamInvites(user.businessId),
  ]);

  const tier = business?.tier ?? "starter";
  const tierMeta = tierBy(tier);
  const quota = seatQuota(tier);
  const seatUsed = members.length + invites.length;
  const seatsValue =
    quota >= 999 ? `${members.length}` : `${seatUsed} / ${quota}`;
  const seatsCaption =
    invites.length > 0
      ? `${invites.length} invite${invites.length === 1 ? "" : "s"} pending`
      : `${members.length} active member${members.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
            Settings
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl dark:text-cream-100">
            Company settings
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-muted dark:text-cream-400">
            Manage your subscription, security posture, integrations, branding,
            and which AI agents are active for this business.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="accent">
            {tierMeta?.label ?? tier}
            {tierMeta?.priceMyr != null ? ` · RM ${tierMeta.priceMyr}/mo` : ""}
          </Badge>
          <Badge tone="brand">{user.role === "owner" ? "Owner" : user.role}</Badge>
        </div>
      </header>

      {/* Inline quick-status strip — at-a-glance health */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusTile
          label="Plan"
          value={tierMeta?.label ?? tier}
          caption={
            business?.subscription_renewal_at
              ? `Renews ${new Date(business.subscription_renewal_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}`
              : "—"
          }
          tone="accent"
        />
        <StatusTile
          label="Seats"
          value={seatsValue}
          caption={seatsCaption}
          tone="brand"
        />
        <StatusTile
          label="2FA"
          value="Off"
          caption="Enable to protect data"
          tone="warning"
        />
        <StatusTile
          label="AI agents"
          value="4 / 4"
          caption="All modules covered"
          tone="success"
        />
      </section>

      {SETTINGS_GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-ink dark:text-cream-100">
              {group.title}
            </h2>
            <p className="text-sm text-ink-muted dark:text-cream-400">
              {group.description}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.sections.map((section) => (
              <SectionCard key={section.href} section={section} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatusTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: "accent" | "brand" | "success" | "warning";
}) {
  const TONE_BG = {
    accent: "border-accent-200 bg-accent-50 dark:border-accent-700/40 dark:bg-accent-700/15",
    brand: "border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/30",
    success: "border-status-success/30 bg-status-success/10",
    warning: "border-status-warning/30 bg-status-warning/15",
  }[tone];
  const TONE_TEXT = {
    accent: "text-accent-700 dark:text-accent-200",
    brand: "text-brand-700 dark:text-brand-200",
    success: "text-status-success",
    warning: "text-[#8C5C0A] dark:text-[#F5C97A]",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${TONE_BG}`}>
      <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${TONE_TEXT}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-muted dark:text-cream-400">
        {caption}
      </p>
    </div>
  );
}

function SectionCard({ section }: { section: SettingsSection }) {
  const { href, label, description, icon: Icon, badge } = section;
  return (
    <Link
      href={href}
      className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <div className="flex h-full flex-col gap-3 rounded-xl border border-cream-200 bg-white p-5 shadow-card transition-shadow group-hover:border-brand-200 group-hover:shadow-elevated dark:border-hairline-dark dark:bg-panel-dark dark:group-hover:border-brand-700">
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden
            className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
          <ChevronRight
            aria-hidden
            className="h-4 w-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 dark:text-cream-400"
            strokeWidth={2}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
              {label}
            </h3>
            {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
          </div>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}
