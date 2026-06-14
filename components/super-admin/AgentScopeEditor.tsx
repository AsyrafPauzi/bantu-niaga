"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Loader2, Play, Save } from "lucide-react";
import type {
  AiAgentVersion,
  AllowedAction,
  EscalationRule,
  Guardrail,
  KnowledgeSource,
} from "@/lib/super-admin/types";

interface Props {
  slug: string;
  version: AiAgentVersion | null;
}

type Draft = {
  version_label: string;
  system_prompt: string;
  default_tone: string;
  allowed_actions: AllowedAction[];
  guardrails: Guardrail[];
  escalation: EscalationRule[];
  knowledge_base: KnowledgeSource[];
};

function defaultDraft(version: AiAgentVersion | null): Draft {
  return {
    version_label: bumpVersion(version?.version_label ?? "v1.0.0"),
    system_prompt: version?.system_prompt ?? "",
    default_tone: version?.default_tone ?? "Friendly + clear",
    allowed_actions: version?.allowed_actions ?? [],
    guardrails: version?.guardrails ?? [],
    escalation: version?.escalation ?? [],
    knowledge_base: version?.knowledge_base ?? [],
  };
}

function bumpVersion(label: string): string {
  const m = label.match(/^v(\d+)\.(\d+)\.(\d+)/);
  if (!m) return `${label}.draft`;
  const [, a, b, c] = m;
  return `v${a}.${b}.${Number(c) + 1}`;
}

export function AgentScopeEditor({ slug, version }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => defaultDraft(version));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(publish: boolean) {
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/super-admin/agents/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version_label: draft.version_label,
          system_prompt: draft.system_prompt,
          allowed_actions: draft.allowed_actions,
          guardrails: draft.guardrails,
          escalation: draft.escalation,
          knowledge_base: draft.knowledge_base,
          default_tone: draft.default_tone || null,
          publish,
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-cream-300 bg-white p-5 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-ink">System prompt</h2>
            <p className="mt-1 text-xs text-ink-muted">
              This is the agent&apos;s identity. Loaded at the start of every
              conversation. Use clear, short paragraphs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft.version_label}
              onChange={(e) =>
                setDraft({ ...draft, version_label: e.target.value })
              }
              className="w-28 rounded-md border border-cream-300 bg-cream-100 px-2 py-1 text-xs font-bold text-ink focus:bg-white focus:outline-none"
              aria-label="Version label"
            />
            <input
              type="text"
              value={draft.default_tone}
              onChange={(e) =>
                setDraft({ ...draft, default_tone: e.target.value })
              }
              className="w-40 rounded-md border border-cream-300 bg-cream-100 px-2 py-1 text-xs text-ink focus:bg-white focus:outline-none"
              aria-label="Default tone"
            />
          </div>
        </div>
        <textarea
          rows={8}
          value={draft.system_prompt}
          onChange={(e) =>
            setDraft({ ...draft, system_prompt: e.target.value })
          }
          className="mt-3 w-full rounded-lg border border-cream-300 bg-cream-100 p-3 font-mono text-[12px] leading-relaxed text-ink focus:bg-white focus:outline-none"
          placeholder="You are Maya, a marketing copilot for SMEs in Malaysia…"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ListEditor
          title="Allowed actions"
          description="What the agent IS allowed to do. The runtime tool layer reads this list and refuses any tool not listed here."
          items={draft.allowed_actions}
          onChange={(allowed_actions) =>
            setDraft({ ...draft, allowed_actions })
          }
          renderRow={(a, idx, onPatch) => (
            <ActionRow
              key={idx}
              action={a}
              onPatch={(patch) => onPatch(patch)}
            />
          )}
          newItem={() => ({
            key: `action_${Date.now()}`,
            label: "New action",
            note: "",
            on: true,
          })}
        />
        <ListEditor
          title="Guardrails"
          description="What the agent is NEVER allowed to do. Enforced at the prompt + tool level. Each entry shows up to the tenant as a hard rule."
          items={draft.guardrails}
          onChange={(guardrails) => setDraft({ ...draft, guardrails })}
          renderRow={(g, idx, onPatch) => (
            <GuardrailRow
              key={idx}
              rail={g}
              onPatch={(patch) => onPatch(patch)}
            />
          )}
          newItem={() => ({
            label: "New guardrail",
            detail: "Why this rule exists",
            severity: "always",
          })}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ListEditor
          title="Escalation rules"
          description="When the agent should stop and hand control back to a human. Mapped to the Inbox / support ticketing surface."
          items={draft.escalation}
          onChange={(escalation) => setDraft({ ...draft, escalation })}
          renderRow={(e, idx, onPatch) => (
            <EscalationRow
              key={idx}
              rule={e}
              onPatch={(patch) => onPatch(patch)}
            />
          )}
          newItem={() => ({
            trigger: "Trigger description",
            target: "Action to take",
          })}
        />
        <ListEditor
          title="Knowledge sources"
          description="What the agent can read from. The runtime pulls only these sources into context — anything else is invisible to the agent."
          items={draft.knowledge_base}
          onChange={(knowledge_base) =>
            setDraft({ ...draft, knowledge_base })
          }
          renderRow={(k, idx, onPatch) => (
            <KnowledgeRow
              key={idx}
              src={k}
              onPatch={(patch) => onPatch(patch)}
            />
          )}
          newItem={() => ({
            label: "New source",
            kind: "Internal",
            size: "—",
          })}
        />
      </div>

      <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border border-cream-300 bg-white px-4 py-3 shadow-elevated">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          {saved && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-status-success/10 px-2 py-0.5 font-semibold text-status-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <span>
            Saving here updates the published version that every tenant sees
            within seconds. Use Save as draft to test before rollout.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => save(false)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save as draft
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-muted disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Publish &amp; roll out
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ListEditor<T>({
  title,
  description,
  items,
  onChange,
  renderRow,
  newItem,
}: {
  title: string;
  description: string;
  items: T[];
  onChange: (next: T[]) => void;
  renderRow: (
    item: T,
    idx: number,
    onPatch: (patch: Partial<T>) => void,
  ) => React.ReactNode;
  newItem: () => T;
}) {
  function patchAt(idx: number, patch: Partial<T>) {
    const next = [...items];
    next[idx] = { ...next[idx]!, ...patch };
    onChange(next);
  }
  function removeAt(idx: number) {
    const next = [...items];
    next.splice(idx, 1);
    onChange(next);
  }

  return (
    <section className="rounded-xl border border-cream-300 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <p className="mt-1 text-xs text-ink-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...items, newItem()])}
          className="inline-flex items-center gap-1 rounded-md border border-cream-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink hover:bg-cream-100"
        >
          + Add
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {items.length === 0 && (
          <li className="rounded-md border border-dashed border-cream-300 px-3 py-4 text-center text-xs text-ink-muted">
            Empty. Click <em>Add</em> to create the first entry.
          </li>
        )}
        {items.map((it, idx) => (
          <li
            key={idx}
            className="group relative rounded-lg border border-cream-300 bg-cream-100 p-3"
          >
            <div className="absolute right-2 top-2">
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="rounded-md px-2 py-0.5 text-[10px] font-bold text-status-danger opacity-0 transition group-hover:opacity-100"
                aria-label="Remove"
              >
                Remove
              </button>
            </div>
            {renderRow(it, idx, (patch) => patchAt(idx, patch))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActionRow({
  action,
  onPatch,
}: {
  action: AllowedAction;
  onPatch: (patch: Partial<AllowedAction>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={action.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          className="flex-1 rounded-md border border-cream-300 bg-white px-2 py-1 text-sm font-semibold text-ink focus:outline-none"
        />
        <label className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-ink">
          <input
            type="checkbox"
            checked={action.on}
            onChange={(e) => onPatch({ on: e.target.checked })}
            className="h-3.5 w-3.5"
          />
          {action.on ? "Allowed" : "Disabled"}
        </label>
      </div>
      <input
        type="text"
        value={action.note ?? ""}
        onChange={(e) => onPatch({ note: e.target.value })}
        placeholder="Optional note shown in audit + tenant UI"
        className="w-full rounded-md border border-cream-300 bg-white px-2 py-1 text-xs text-ink focus:outline-none"
      />
    </div>
  );
}

function GuardrailRow({
  rail,
  onPatch,
}: {
  rail: Guardrail;
  onPatch: (patch: Partial<Guardrail>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={rail.label}
        onChange={(e) => onPatch({ label: e.target.value })}
        className="w-full rounded-md border border-cream-300 bg-white px-2 py-1 text-sm font-semibold text-ink focus:outline-none"
      />
      <input
        type="text"
        value={rail.detail}
        onChange={(e) => onPatch({ detail: e.target.value })}
        placeholder="How is this enforced?"
        className="w-full rounded-md border border-cream-300 bg-white px-2 py-1 text-xs text-ink focus:outline-none"
      />
      <select
        value={rail.severity}
        onChange={(e) => onPatch({ severity: e.target.value })}
        className="w-full rounded-md border border-cream-300 bg-white px-2 py-1 text-xs font-semibold text-ink focus:outline-none"
      >
        <option value="always">Always blocked</option>
        <option value="enforced">Enforced at tool layer</option>
        <option value="warn">Warn only</option>
      </select>
    </div>
  );
}

function EscalationRow({
  rule,
  onPatch,
}: {
  rule: EscalationRule;
  onPatch: (patch: Partial<EscalationRule>) => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      <input
        type="text"
        value={rule.trigger}
        onChange={(e) => onPatch({ trigger: e.target.value })}
        placeholder="When…"
        className="rounded-md border border-cream-300 bg-white px-2 py-1 text-xs text-ink focus:outline-none"
      />
      <input
        type="text"
        value={rule.target}
        onChange={(e) => onPatch({ target: e.target.value })}
        placeholder="…do this"
        className="rounded-md border border-cream-300 bg-white px-2 py-1 text-xs text-ink focus:outline-none"
      />
    </div>
  );
}

function KnowledgeRow({
  src,
  onPatch,
}: {
  src: KnowledgeSource;
  onPatch: (patch: Partial<KnowledgeSource>) => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[2fr_1fr_80px]">
      <input
        type="text"
        value={src.label}
        onChange={(e) => onPatch({ label: e.target.value })}
        className="rounded-md border border-cream-300 bg-white px-2 py-1 text-sm text-ink focus:outline-none"
      />
      <input
        type="text"
        value={src.kind}
        onChange={(e) => onPatch({ kind: e.target.value })}
        placeholder="Kind"
        className="rounded-md border border-cream-300 bg-white px-2 py-1 text-xs text-ink focus:outline-none"
      />
      <input
        type="text"
        value={src.size}
        onChange={(e) => onPatch({ size: e.target.value })}
        placeholder="Size"
        className="rounded-md border border-cream-300 bg-white px-2 py-1 text-xs text-ink focus:outline-none"
      />
    </div>
  );
}
