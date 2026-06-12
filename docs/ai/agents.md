# AI Agents — Per-Pillar Intelligence Layer

> An opt-in premium layer on top of the base tiers. One AI Agent per pillar. Structured triggers only — no open chat. Predictable cost, abuse-proof, never blocks workflow.

---

## 1. Why AI Is a Separate Layer

The base tiers cover the **operational** workflow. The AI layer covers the **analytical & generative** workflow on top of that data:

- Watching for things the owner should know about (overdue invoices, stale leads, low stock).
- Drafting outputs the owner would otherwise write themselves (follow-up messages, restock notes).
- Cross-examining multi-pillar decisions in the Executive Boardroom.

This separation keeps the base tiers cheap (no AI cost baked into RM50) and lets margin scale through the AI upsell.

---

## 2. The Six Agents

| Agent | Available from tier | Watches | Generates |
|-------|---------------------|---------|-----------|
| **Admin AI** | Starter | Tasks, document expiries, storage limits | Daily task summary, reminders |
| **Finance AI** | Starter | Cashflow, overdue invoices, expense trends | Overdue follow-up drafts, P&L anomaly notes |
| **Operations AI** | Starter | Stock levels, supplier costs, pipeline aging | Reorder nudges, cost-trend summaries |
| **Marketing AI** | Micro | Customer cohorts, content calendar gaps | Post hooks, customer re-engagement scripts |
| **HR AI** | Micro | Leave balances, shift coverage gaps | Leave decision drafts, rota suggestions |
| **Sales AI** | SME | Lead aging, POS trends, conversion funnel | Lead follow-up drafts, deal-stage nudges |

Each Agent is priced **RM 15–20/month** (exact per-pillar pricing TBD).

---

## 3. Structured Triggers — No Open Chat

The most important design choice in the AI layer: **the user never sees a free-text chat input directed at an Agent.**

Instead, every Agent interaction is one of a small number of **structured triggers**:

| Trigger | Initiated by | Cost (credits) |
|---------|-------------|---------------:|
| Daily System Summary | System (every morning at owner's local time) | **1** |
| Contextual Text Generation (e.g. "Draft follow-up for invoice INV-X") | User click on a structured suggestion | **2** |
| Pillar Data Aggregation (e.g. "Summarize this quarter's supplier costs") | User click on a report tile | **3** |
| Executive Boardroom query | User submits one prompt to the Boardroom | **1 per turn** |

Each trigger has a fixed prompt template and a strict JSON Schema output. The user never types tokens that go directly into an LLM prompt — they pick from structured options.

**Why this matters:**
- Token usage is **predictable per click** → credit pricing is honest.
- Prompt injection surface is dramatically reduced.
- No "ChatGPT clone" UX expectations to manage.

---

## 4. The Proactive Morning Dashboard

Every morning at the business's local "open" hour (configurable; defaults to 8 AM Asia/Kuala_Lumpur), each subscribed Agent evaluates its pillar's structured updates and writes **exactly three** scannable instructions onto the dashboard.

### Example — Finance AI morning briefing

> 1. **Invoices for client Ali are 48 hours overdue.** _Click here to construct a follow-up alert template._
> 2. **Your inventory spending rose 20% against income trends this week.** _Click for breakdown._
> 3. **3 expenses last week are uncategorized.** _Click to auto-suggest categories._

Each card has a **one-tap action** that triggers a Contextual Text Generation (2 credits) or a Pillar Data Aggregation (3 credits). Users decide what's worth spending on.

### Cost of the briefing itself
- 1 credit per Agent per day = ~30 credits/month of the 100-credit pool.
- Leaves ~70 credits/month for user-initiated drafts and aggregations.

---

## 5. Token / Credit Economy

### 5.1 The Pool System

Each subscribed AI Agent appends **100 Fast Credits** to the business's monthly utility account.

| Agents subscribed | Bundled fast credits / month |
|------------------:|----------------------------:|
| 1 | 100 |
| 2 | 200 |
| 3 | 300 |
| ... | _N × 100_ |

The pool is **shared across all subscribed Agents and the Boardroom** — it's not per-Agent.

### 5.2 Execution Costs

| Action | Credits | Notes |
|--------|--------:|-------|
| Daily System Summary | 1 | Fixed; runs per subscribed Agent automatically. |
| Contextual Text Generation | 2 | Per user click (e.g. draft a follow-up message). |
| Pillar Data Aggregation | 3 | Per user click (e.g. quarterly supplier analysis). |
| Executive Boardroom turn | 1 | Flat — each turn in the orchestrator chain. |

### 5.3 The Anti-Abuse Speed Brake — Slow Mode

When a business's Fast Credit pool is exhausted **before** the billing cycle resets:

> The system does **not** block, cut off, or deny queries.
> It **does** reroute the same query through an automated background rate-limiter — "Slow Mode" — where responses scale from sub-second returns to a deliberate **15–20 second wait window**.

Mechanism:

1. Request arrives → credit balance checked.
2. Balance > 0 → **Fast Mode** (immediate execution, normal cost).
3. Balance = 0 → **Slow Mode**:
   - Request queued with a deterministic 15–20s delay (jittered to feel natural).
   - Same model and quality — the only penalty is latency.
   - Credit balance does **not** go negative; no further deduction happens.

**Why this design:**
- Workflow is never broken — owners can keep operating their business even when out of credits.
- The latency penalty is annoying enough to drive top-ups, without being punitive.
- Compute cost is still ~capped by queue depth; OpenAI bills the same per token whether fast or slow, so the limit comes from queue-rate enforcement.

### 5.4 Top-Ups

| Pack | Price | Credits |
|------|------:|--------:|
| Fast Top-Up | RM 10 | 50 Fast Credits |

- Stacks on top of the monthly pool.
- Unused top-up credits **roll over** to next month (default policy — TBD).
- Subscribed Agent's monthly 100-credit refill does **not** roll over — use it or lose it.
- Larger top-up bundles (RM20 / 120, RM50 / 350) are an open question — see §9.

---

## 6. AI Usage Accounting (Internal)

Every AI call writes to `ai_usage`:

```
ai_usage
 ├── id, business_id, agent: ADMIN|FINANCE|OPS|MARKETING|HR|SALES|BOARDROOM
 ├── trigger_type: SUMMARY|CONTEXT_TEXT|AGGREGATION|BOARDROOM_TURN
 ├── credits_charged
 ├── mode: FAST|SLOW
 ├── tokens_in, tokens_out
 ├── cost_myr_estimated
 ├── created_at
 └── prompt_template_version
```

Use cases:
- Per-business credit balance derivation (instead of a stateful counter — derive from sum of events for auditability).
- Internal margin reporting (cost_myr_estimated vs. revenue).
- Detecting abuse signatures (e.g. burst patterns).

---

## 7. Margin Math

The system is engineered for a **>95% gross margin** on the AI layer. Rough sketch:

| Item | Value |
|------|------:|
| Agent subscription | RM 15–20 / month |
| Credits bundled | 100 / month |
| Approx. OpenAI cost per credit (GPT-4o-mini, structured triggers) | ~RM 0.005 |
| Max cost if user burns 100 credits in Fast Mode | ~RM 0.50 |
| Gross margin per Agent subscription | ≥ 95% |
| Top-up: 50 credits for RM 10 | Marginal cost ~RM 0.25 → ~97.5% margin on top-ups |

These figures assume the structured trigger model holds (predictable token counts). Open-ended chat would break the math — which is precisely why it isn't shipped.

---

## 8. UI Surfaces

### 8.1 The Proactive Morning Dashboard
- Top of the home screen.
- One card per subscribed Agent, each showing exactly 3 items.
- Each item has a primary action button with the credit cost shown next to it (e.g. _"Draft follow-up · 2 credits"_).

### 8.2 The Credit Meter
- Persistent header chip: `⚡ 78 / 200 credits` with mode indicator (Fast / Slow).
- Tap → opens credit history + top-up CTA.

### 8.3 Slow Mode Indicator
- When in Slow Mode, the chip turns amber and shows `🐢 Slow Mode`.
- Action buttons display the expected wait time: _"Draft follow-up · ~18s"_.
- Top-up CTA inlined into the wait screen.

---

## 9. Open Questions

- Exact per-Agent pricing: uniform RM18, or differentiated (e.g. Finance AI = RM20, others = RM15)?
- Top-up ladder beyond RM10/50 — what's the largest pack?
- Do top-up credits expire? Roll over indefinitely?
- Should the Daily Summary be skippable / pausable to save credits (e.g. weekends for retail closed Sundays)?
- Localization of the AI outputs: BM-only? Mix EN + BM? Custom tone per business?
- Owner opt-out of specific trigger types (e.g. "never auto-summarize HR")?
- Multi-language inputs — if owner writes a Boardroom prompt in BM, does each Agent reply in BM or in the system locale?
- Failover model if OpenAI is unavailable — graceful degradation (briefings skipped) vs hot failover (Anthropic / Gemini)?
- Audit / transparency: show the user *which* prompt was sent on their behalf for each click? (For trust + debugging.)
