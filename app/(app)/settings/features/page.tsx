"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Beaker,
  Boxes,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Info,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type FlagStatus = "on" | "off";
type FlagStage = "stable" | "beta" | "experimental";

interface Flag {
  id: string;
  label: string;
  description: string;
  stage: FlagStage;
  status: FlagStatus;
  ownerPillar?: string;
}

interface Group {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  flags: Flag[];
}

const INITIAL_GROUPS: Group[] = [
  {
    id: "modules",
    title: "Modules",
    description: "Turn whole modules on or off for this business.",
    icon: Boxes,
    flags: [
      {
        id: "module.finance",
        label: "Finance module",
        description: "Invoices, expenses, ledger, payments.",
        stage: "stable",
        status: "on",
        ownerPillar: "Finance",
      },
      {
        id: "module.operations",
        label: "Operations module",
        description: "Orders, suppliers, products, bookings.",
        stage: "stable",
        status: "on",
        ownerPillar: "Operations",
      },
      {
        id: "module.marketing",
        label: "Marketing module",
        description: "Customers CRM, content calendar, broadcasts.",
        stage: "stable",
        status: "on",
        ownerPillar: "Marketing",
      },
      {
        id: "module.sales",
        label: "Sales module",
        description: "POS, leads, deals pipeline.",
        stage: "stable",
        status: "on",
        ownerPillar: "Sales",
      },
      {
        id: "module.hr",
        label: "HR module",
        description: "Employees, leave, payroll.",
        stage: "stable",
        status: "on",
        ownerPillar: "HR",
      },
      {
        id: "module.boardroom",
        label: "AI Boardroom",
        description: "Cross-module AI summary and weekly briefing.",
        stage: "stable",
        status: "on",
      },
    ],
  },
  {
    id: "beta",
    title: "Beta features",
    description: "Production-ready but optional. Toggle per business.",
    icon: Beaker,
    flags: [
      {
        id: "beta.auto-post",
        label: "Auto-post to channels",
        description:
          "Publish scheduled content_plan entries to TikTok / IG / FB automatically.",
        stage: "beta",
        status: "off",
        ownerPillar: "Marketing",
      },
      {
        id: "beta.public-booking",
        label: "Public booking page",
        description: "Branded /bantuniaga.demo booking page for walk-in leads.",
        stage: "beta",
        status: "on",
        ownerPillar: "Operations",
      },
      {
        id: "beta.whatsapp-broadcast",
        label: "WhatsApp broadcasts",
        description: "Send templated messages from Marketing → Customers.",
        stage: "beta",
        status: "off",
        ownerPillar: "Marketing",
      },
      {
        id: "beta.merchant-feed",
        label: "TikTok Shop merchant feed",
        description:
          "Sync inventory from Operations to TikTok Shop nightly.",
        stage: "beta",
        status: "off",
        ownerPillar: "Operations",
      },
    ],
  },
  {
    id: "experimental",
    title: "Experimental",
    description:
      "Early prototypes. May change or be removed without notice.",
    icon: FlaskConical,
    flags: [
      {
        id: "exp.voice-input",
        label: "Voice commands for Maya",
        description:
          "Speak instead of type. Bahasa Malaysia + English support.",
        stage: "experimental",
        status: "off",
      },
      {
        id: "exp.predictive-inventory",
        label: "Predictive inventory",
        description: "AI forecasts low-stock alerts 14 days ahead.",
        stage: "experimental",
        status: "off",
        ownerPillar: "Operations",
      },
      {
        id: "exp.competitor-radar",
        label: "Competitor radar",
        description:
          "Scrape public pricing from listed competitors weekly.",
        stage: "experimental",
        status: "off",
        ownerPillar: "Marketing",
      },
    ],
  },
];

export default function FeatureTogglesPage() {
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [expanded, setExpanded] = useState<string[]>(
    INITIAL_GROUPS.map((g) => g.id),
  );

  function toggleGroup(id: string) {
    setExpanded((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  function toggleFlag(groupId: string, flagId: string) {
    setGroups((all) =>
      all.map((g) =>
        g.id === groupId
          ? {
              ...g,
              flags: g.flags.map((f) =>
                f.id === flagId
                  ? { ...f, status: f.status === "on" ? "off" : "on" }
                  : f,
              ),
            }
          : g,
      ),
    );
  }

  const totalOn = groups.reduce(
    (n, g) => n + g.flags.filter((f) => f.status === "on").length,
    0,
  );
  const total = groups.reduce((n, g) => n + g.flags.length, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to settings
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
            Settings · Power features
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl dark:text-cream-100">
            Feature toggles
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-muted dark:text-cream-400">
            Enable or disable modules, beta features, and experimental flows.
            Changes apply business-wide within 60 seconds.
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-accent-700 dark:text-accent-200">
            {totalOn}
            <span className="text-sm font-medium text-ink-muted dark:text-cream-400">
              {" "}
              / {total}
            </span>
          </p>
          <p className="text-[11px] text-ink-muted dark:text-cream-400">
            features enabled
          </p>
        </div>
      </header>

      {/* Maya hint */}
      <div className="flex items-start gap-3 rounded-xl border border-accent-200 bg-accent-50 p-4 text-sm dark:border-accent-700/40 dark:bg-accent-700/15">
        <Sparkles
          className="mt-0.5 h-4 w-4 shrink-0 text-accent-700 dark:text-accent-200"
          strokeWidth={2}
        />
        <p className="text-ink dark:text-cream-100">
          <strong className="text-accent-700 dark:text-accent-200">
            Maya tip:
          </strong>{" "}
          You haven&apos;t enabled <em>Auto-post to channels</em> yet. Turn it
          on and your scheduled content publishes automatically at the perfect
          time.
        </p>
      </div>

      {groups.map((group) => {
        const open = expanded.includes(group.id);
        const onCount = group.flags.filter((f) => f.status === "on").length;
        return (
          <section
            key={group.id}
            className="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark"
          >
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-cream-50 dark:hover:bg-hairline-dark/30"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <group.icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                    {group.title}
                  </h3>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    {group.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="neutral">
                  {onCount} / {group.flags.length} on
                </Badge>
                {open ? (
                  <ChevronUp className="h-4 w-4 text-ink-subtle" strokeWidth={2} />
                ) : (
                  <ChevronDown
                    className="h-4 w-4 text-ink-subtle"
                    strokeWidth={2}
                  />
                )}
              </div>
            </button>
            {open ? (
              <ul className="divide-y divide-cream-200 border-t border-cream-200 dark:divide-hairline-dark dark:border-hairline-dark">
                {group.flags.map((flag) => {
                  const on = flag.status === "on";
                  return (
                    <li
                      key={flag.id}
                      className="flex items-start justify-between gap-3 px-5 py-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink dark:text-cream-100">
                            {flag.label}
                          </p>
                          {flag.stage !== "stable" ? (
                            <Badge
                              tone={
                                flag.stage === "beta" ? "warning" : "info"
                              }
                            >
                              {flag.stage}
                            </Badge>
                          ) : null}
                          {flag.ownerPillar ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                              {flag.ownerPillar}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                          {flag.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFlag(group.id, flag.id)}
                        className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                          on
                            ? "bg-accent-500"
                            : "bg-cream-300 dark:bg-hairline-dark"
                        }`}
                        aria-pressed={on}
                        aria-label={`Toggle ${flag.label}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            on ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        );
      })}

      <div className="flex items-start gap-2 rounded-lg border border-cream-200 bg-cream-50 p-3 text-xs text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <p>
          Disabling a module hides it from the sidebar for everyone, but
          keeps the data. You can re-enable any time without data loss.
        </p>
      </div>
    </div>
  );
}
