import {
  Banknote,
  Boxes,
  Megaphone,
  Send,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "AI Boardroom" };

const AGENTS = [
  {
    id: "finance",
    label: "Fayza",
    role: "Finance AI",
    icon: Banknote,
    tone: "brand" as const,
    status: "active" as const,
  },
  {
    id: "ops",
    label: "Aiman",
    role: "Operations AI",
    icon: Boxes,
    tone: "accent" as const,
    status: "active" as const,
  },
  {
    id: "marketing",
    label: "Maya",
    role: "Marketing AI",
    icon: Megaphone,
    tone: "accent" as const,
    status: "active" as const,
  },
  {
    id: "sales",
    label: "Sufi",
    role: "Sales AI",
    icon: ShoppingCart,
    tone: "brand" as const,
    status: "preview" as const,
  },
  {
    id: "hr",
    label: "Hana",
    role: "HR AI",
    icon: Users,
    tone: "brand" as const,
    status: "preview" as const,
  },
];

const TONE_CLASS: Record<"brand" | "accent", { bg: string; text: string }> = {
  brand: {
    bg: "bg-brand-50 dark:bg-brand-900/40",
    text: "text-brand-700 dark:text-brand-200",
  },
  accent: {
    bg: "bg-accent-50 dark:bg-accent-700/20",
    text: "text-accent-700 dark:text-accent-200",
  },
};

const CONVERSATION = [
  {
    role: "user" as const,
    text:
      "We're spending more on ads this month but AR is climbing. Should I push Q3 marketing harder, or pause and chase the cash first?",
  },
  {
    role: "agent" as const,
    agentId: "finance",
    text:
      "Outstanding AR is RM 12,840 across 6 customers. 3 invoices over 30 days from Sri Aman and Hijau Hortikultur make up RM 4,820. Recovering even half closes the marketing spend gap this month.",
    suggestions: ["Open AR aging", "Draft reminders"],
  },
  {
    role: "agent" as const,
    agentId: "marketing",
    text:
      "Current TikTok cohort (Reels · 280 first-hour views) is converting 2.4× the FB campaign. Reallocating 30% of FB budget to TikTok keeps reach flat while freeing RM 1,800/mo.",
    suggestions: ["See cohort", "Pause FB ads"],
  },
  {
    role: "agent" as const,
    agentId: "ops",
    text:
      "Beras 5kg supply will drop below reorder point in ~6 days. Front-loading the buy by 4 days locks in supplier pricing before next week's rumored increase.",
    suggestions: ["Reorder list"],
  },
  {
    role: "synth" as const,
    text:
      "Recommendation: don't pause marketing — rotate the FB → TikTok budget for an immediate RM 1,800/mo saving. Run automated WA reminders on the 3 overdue invoices to recover RM 2.4–4.8K. Front-load Beras 5kg restock by Friday to hedge supplier price risk.",
  },
];

function AgentAvatar({
  agentId,
  size = "sm",
}: {
  agentId: string;
  size?: "sm" | "md";
}) {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) return null;
  const Icon = agent.icon;
  const tone = TONE_CLASS[agent.tone];
  const dim = size === "md" ? "h-10 w-10" : "h-8 w-8";
  const iconDim = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        dim,
        tone.bg,
        tone.text,
      )}
    >
      <Icon className={iconDim} strokeWidth={2} />
    </span>
  );
}

export default function BoardroomPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Boardroom"
        title="Executive room"
        description="Ask one business question — get perspectives from Finance, Marketing, Operations, Sales, and HR AI agents, then a synthesized recommendation."
        action={
          <StatusPill tone="brand">3 agents live</StatusPill>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6">
        <aside className="space-y-3 lg:col-span-1">
          <SectionCard
            title="Agents in the room"
            subtitle="Activate more from Marketplace"
            bodyClassName="space-y-2"
          >
            {AGENTS.map((agent) => {
              const tone = TONE_CLASS[agent.tone];
              const Icon = agent.icon;
              const live = agent.status === "active";
              return (
                <div
                  key={agent.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-2.5",
                    live
                      ? "border-cream-200 dark:border-hairline-dark"
                      : "border-dashed border-cream-300 dark:border-hairline-dark",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      tone.bg,
                      tone.text,
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                      {agent.label}
                    </p>
                    <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                      {agent.role}
                    </p>
                  </div>
                  <StatusPill tone={live ? "success" : "neutral"}>
                    {live ? "Live" : "Preview"}
                  </StatusPill>
                </div>
              );
            })}
          </SectionCard>

          <SectionCard
            title="Saved questions"
            subtitle="Quick re-runs"
            bodyClassName="space-y-2"
          >
            {[
              "What's hurting our cashflow this month?",
              "Where should I invest next RM 5K?",
              "Which SKU is hidden gold?",
            ].map((q) => (
              <button
                key={q}
                className="w-full rounded-lg border border-cream-200 px-3 py-2 text-left text-xs text-ink transition-colors hover:border-brand-200 hover:bg-brand-50/40 dark:border-hairline-dark dark:text-cream-100 dark:hover:border-brand-700 dark:hover:bg-brand-900/20"
              >
                {q}
              </button>
            ))}
          </SectionCard>
        </aside>

        <section className="space-y-3 lg:col-span-3">
          <Card>
            <CardBody className="space-y-4">
              {CONVERSATION.map((entry, idx) => {
                if (entry.role === "user") {
                  return (
                    <div key={idx} className="flex justify-end">
                      <div className="max-w-2xl rounded-2xl rounded-tr-md bg-brand-500 px-4 py-3 text-sm text-white shadow-card">
                        {entry.text}
                      </div>
                    </div>
                  );
                }
                if (entry.role === "synth") {
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-accent-200 bg-accent-50 p-4 dark:border-accent-700/40 dark:bg-accent-700/15"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-accent-700 dark:text-accent-200" strokeWidth={2} />
                        <p className="text-xs font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-200">
                          Synthesized recommendation
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-ink dark:text-cream-100">
                        {entry.text}
                      </p>
                    </div>
                  );
                }
                const agent = AGENTS.find((a) => a.id === entry.agentId);
                return (
                  <div key={idx} className="flex items-start gap-3">
                    {entry.agentId ? <AgentAvatar agentId={entry.agentId} /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-semibold text-ink dark:text-cream-100">
                          {agent?.label}
                        </p>
                        <p className="text-xs text-ink-muted dark:text-cream-400">
                          {agent?.role}
                        </p>
                      </div>
                      <div className="mt-1 rounded-2xl rounded-tl-md border border-cream-200 bg-cream-100 px-4 py-3 text-sm text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100">
                        {entry.text}
                      </div>
                      {entry.suggestions ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {entry.suggestions.map((s) => (
                            <button
                              key={s}
                              className="rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-brand-200 dark:hover:border-brand-700 dark:hover:bg-brand-900/20"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <form className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ask the boardroom anything…"
                  className="flex-1 rounded-md border border-cream-300 bg-white px-3 py-2.5 text-sm text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
                >
                  <Send className="h-4 w-4" strokeWidth={2} />
                  Send
                </button>
              </form>
              <p className="mt-2 text-xs text-ink-muted dark:text-cream-400">
                Each AI agent answers from its own pillar context with a token-bounded slice. Subscribe more agents in <span className="font-medium text-brand-700 dark:text-brand-200">Marketplace</span> to expand the room.
              </p>
            </CardBody>
          </Card>
        </section>
      </div>
    </div>
  );
}
