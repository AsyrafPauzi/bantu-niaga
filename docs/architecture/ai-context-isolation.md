# AI agent context — tenant isolation + token optimisation

The AI agents (Maya, Finance, Operations, Boardroom) operate on a
single contract:

> Each invocation receives a strictly tenant-scoped briefing packet
> derived from the caller's `business_id`. The agent NEVER sees raw
> SQL access, NEVER sees other tenants' data, and NEVER sees more
> than the briefing.

That contract is enforced in three layers:

| Layer | Where | What it does |
| --- | --- | --- |
| Postgres RLS | `business_id = current_business_id()` policies on every table | Ground truth — even if app code is buggy, the DB refuses cross-tenant reads. |
| Application guard | [`lib/ai/context/guard.ts`](../../lib/ai/context/guard.ts) | Resolves `AgentContext` from `getCurrentUser()`, asserts `business_id` on every returned row, throws `TenantIsolationViolation` on drift. |
| Briefing packet | [`lib/ai/context/index.ts`](../../lib/ai/context/index.ts) | The agent only ever consumes a rendered briefing — never a database client. |

## Why this exists

Two problems were causing engineering anxiety:

1. **Cross-tenant leakage.** A single missed `eq("business_id", …)` in
   agent code could surface another tenant's invoice in a chat reply.
   Without RLS as a backstop this would have been disastrous; even
   with RLS, defence-in-depth at the app layer is required.
2. **Token cost.** Letting an agent "browse" the DB through a tool-call
   loop was burning 5–10× the tokens vs. just inlining the relevant
   facts up front.

The context subsystem solves both with one design.

## The data flow

```
HTTP request
   │
   ▼
getCurrentUser()  ──▶  AgentContext { businessId, userId, role }   ← FROZEN
   │                       │
   │                       ▼
   │              createAgentScopedClient(ctx)
   │                       │     uses createSupabaseServerClient (RLS-aware)
   │                       ▼
   │              query → verifyRows(rows, ctx, "table")
   │                       │     throws on tenant drift
   │                       ▼
   │            PillarSnapshot { kpis, recent, attention, notes }
   │                       │
   │                       ▼
   └─────────────▶  renderBriefingText(snapshot)
                            │
                            ▼
              { role: "system", content: briefing.text }
                            │
                            ▼
                  openaiChat({ … })
```

## What's in a snapshot

A `PillarSnapshot` is the only artifact the AI ever consumes. Each one
contains at most:

- `headline` — one-sentence summary
- ≤ 8 `kpis` — labelled numeric / short text
- ≤ 10 `recent` items — id + short label + ISO date
- ≤ 5 `attention` items — flagged severity items
- optional `notes` — under 300 chars of free-form context

Total size: typically 800–2000 bytes → ~200–500 tokens after JSON
serialisation. That fits inside every prompt without affecting cost
materially even on GPT-4o-mini's small context.

## Per-pillar builders

| Pillar | File | Status |
| --- | --- | --- |
| Admin | [`lib/ai/context/admin.ts`](../../lib/ai/context/admin.ts) | Live — business, subscription, credits, audit |
| Finance | [`lib/ai/context/finance.ts`](../../lib/ai/context/finance.ts) | Live — invoices + credit_ledger |
| Marketing | [`lib/ai/context/marketing.ts`](../../lib/ai/context/marketing.ts) | Live — customers + content_plan + social_accounts |
| Operations | [`lib/ai/context/operations.ts`](../../lib/ai/context/operations.ts) | Placeholder — `available: false` until tables ship |
| Sales | [`lib/ai/context/sales.ts`](../../lib/ai/context/sales.ts) | Placeholder — `available: false` |
| HR | [`lib/ai/context/hr.ts`](../../lib/ai/context/hr.ts) | Placeholder — `available: false` |

When a placeholder pillar's briefing is rendered, the prompt explicitly
includes "WARNING: This pillar has no live data — do not invent
figures." so the AI doesn't hallucinate from a thin signal.

## Using it from an agent

```ts
import { openaiChat } from "@/lib/ai/openai";

const reply = await openaiChat({
  briefingFor: "marketing",          // ← strictly tenant-scoped
  messages: [
    { role: "system", content: AGENT_RULES },
    { role: "user", content: userPrompt },
  ],
});
```

`openaiChat` will:

1. Call `resolveAgentContext()` to get the caller's `business_id`.
2. Build the marketing snapshot (RLS-scoped, run-time tenant-checked).
3. Render it to text and prepend it as the FIRST system message.
4. Send everything to OpenAI.

If you want the briefing as data (e.g. to merge with another pillar's),
use `buildBriefing("marketing")` directly.

## API surface

```
GET /api/ai/context/[pillar]
```

Returns the briefing packet for the calling tenant. Useful for:

- Server-to-server AI agent invocations that don't go through
  `openaiChat()`.
- A future "What does the AI see?" panel on `/home` for power users
  who want to know exactly what the agent has access to.

## Adding a new pillar

1. Build a new file under `lib/ai/context/<pillar>.ts` exporting
   `build<Pillar>Snapshot(ctx)`.
2. Register it in `BUILDERS` in `lib/ai/context/index.ts`.
3. Every DB read must run through `verifyRows(result, ctx, "table")`
   so tenant drift throws.
4. Keep the snapshot under 2 KB rendered. If a section gets noisy,
   roll it up to a count + a top-N list instead of full rows.

## What's NOT in the snapshot

Three categories are intentionally excluded so the AI can't accidentally
leak them:

- **PII beyond what's already in the tenant.** Phone numbers, emails,
  ID-card numbers are summarised as counts only.
- **Cross-tenant aggregates.** Even an admin can't see "average customer
  count across all tenants" through an agent — that's a super-admin
  surface, separate code path.
- **Credentials & integration secrets.** Out of reach by design — the
  encrypted-credentials field is service-role only.

## Defence in depth

The system has four guard rails:

1. **Type-level.** `AgentContext` is `Object.freeze`'d so consumers
   cannot mutate `businessId`.
2. **Compile-time.** Snapshot builders take an `AgentContext` parameter;
   forgetting to pass it is a TypeScript error.
3. **Run-time.** `verifyRows` throws on tenant drift before the agent
   ever sees the data.
4. **Database.** RLS enforces `business_id = current_business_id()`.

Removing any one layer still leaves three. That's the bar for a system
this sensitive.
