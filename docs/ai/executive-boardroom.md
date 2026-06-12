# The Multi-Agent AI Executive Boardroom

> Premium innovation. When a business subscribes to **2 or more AI Agents**, the Boardroom unlocks: a virtual executive committee where each pillar's AI cross-examines a single multi-pillar business question.

---

## 1. What It Is

A solo business owner rarely has a CFO, a CMO, an HR director, and an Ops lead in the same room to debate a decision. The Boardroom gives them exactly that — for the price of a few subscriptions.

### Canonical example

```
=========================================================================
                       THE AI EXECUTIVE BOARDROOM
=========================================================================
User: "I want to offer a Buy-1-Free-1 deal to clear our beauty stocks."
-------------------------------------------------------------------------
[Marketing AI] : Database confirms 40% target interest. Good strategy.
[Finance AI]   : Warning: Margin drops from 60% to 20%.
                 Breakeven is 200 units.
[Ops AI]       : Stock data shows 250 expiring items.
                 Packing requires 3 days.
[HR AI]        : Part-time packing support will increase costs by RM240.
=========================================================================
```

One business question. Four structured, **data-backed** perspectives. Resolution in seconds.

---

## 2. Unlock Conditions

| Condition | Required |
|-----------|----------|
| At least **2 AI Agents** subscribed | Yes |
| Tier | Any (Starter through SME — agents follow active pillars) |
| Extra fee for the Boardroom itself | **No** — it's a capability layered on top of Agent subscriptions |

So:
- Starter user with Finance AI + Operations AI → Boardroom on.
- Micro user with Marketing AI + HR AI → Boardroom on.
- SME user with all 6 Agents → Full Boardroom.

---

## 3. How a Boardroom Query Runs

### 3.1 Sequential orchestration

The Boardroom is **not** a parallel free-for-all. It runs through a deterministic orchestrator:

```
                ┌─────────────────────────┐
User prompt ──▶ │  Master Orchestrator    │
                │  (relevance filter +    │
                │   schema enforcement)   │
                └────────────┬────────────┘
                             │ 1 credit / turn
            ┌────────────────┼────────────────┐
            v                v                v
       [Agent A]        [Agent B]        [Agent C]
            │                │                │
            ▼                ▼                ▼
   (structured JSON   (sees prior      (sees prior
    response, fixed    Agent outputs   outputs from
    schema)            as context)     A and B)
            │                │                │
            └────────────────┼────────────────┘
                             v
                ┌─────────────────────────┐
                │  Aggregated Boardroom    │
                │  Output (UI-rendered)   │
                └─────────────────────────┘
```

Each Agent's turn includes:
1. Its **pillar context slice** (only data relevant to its pillar — Marketing AI never sees raw payroll).
2. The **prior Agents' structured responses** so it can cross-examine.
3. A **strict JSON Schema** output spec.

### 3.2 Cost
- **1 credit per Agent turn.**
- A 4-Agent Boardroom run = 4 credits.
- Compare to the standalone equivalents: a 2-credit text gen × 4 = 8 credits. **The Boardroom is cheaper per turn than running each Agent independently**, which is intentional — it rewards owners for using the multi-Agent stack.

### 3.3 Latency
- Sequential dispatch keeps each turn within model latency (~1–2s on GPT-4o-mini).
- Total wall-clock for a 4-Agent run: ~5–8 seconds in Fast Mode.
- Slow Mode applies if the credit pool is depleted (15–20s per turn) — see [agents.md §5.3](./agents.md).

---

## 4. Security Rules & Financial Controls

### 4.1 Relevance Safeguard Filter

The master orchestrator inspects the user's prompt **before** dispatching to any Agent. For each subscribed Agent, it decides:

- **Include** → Agent receives its pillar context slice and contributes a turn.
- **Silence** → Agent is skipped entirely. No token cost. No credit charged.

This prevents the user from paying for a Marketing AI's opinion on, say, an LHDN tax question where it has nothing useful to add.

Examples:

| User prompt | Included Agents | Silenced |
|-------------|-----------------|----------|
| "Should I run a B1F1 promo on expiring beauty stocks?" | Marketing, Finance, Ops, HR | Admin, Sales |
| "How should I respond to this overdue invoice from Ali?" | Finance | All others |
| "Can I afford to hire one more staff for weekends?" | Finance, HR, Ops, Sales | Marketing, Admin |
| "Reorganize my product categories" | Ops | All others |

The filter itself runs at the master-orchestrator layer using a cheap classification call (folded into the first turn's cost; not a separate charge).

### 4.2 Schema discipline

Every Agent in the Boardroom emits a structured JSON object that conforms to this shape:

```json
{
  "agent": "FINANCE",
  "stance": "warning | support | neutral",
  "headline": "Margin drops from 60% to 20%.",
  "evidence": [
    { "metric": "current_margin_pct", "value": 60 },
    { "metric": "promo_margin_pct", "value": 20 },
    { "metric": "breakeven_units", "value": 200 }
  ],
  "recommendation": "Cap promo at 250 units to avoid loss exposure."
}
```

The UI renders these consistently across all Agents — no free-text variance, no broken layouts.

### 4.3 Cost ceiling

A Boardroom run is hard-capped at:
- **Max 6 turns** (one per pillar) regardless of how many Agents the user subscribes to.
- **Per-turn `max_tokens`** enforced server-side.

This guarantees a worst-case Boardroom run costs no more than ~RM0.005 of OpenAI compute — preserving the 95%+ margin target.

### 4.4 Prompt injection defense

Because each Agent receives:
- A **fixed system prompt** (controlled by us).
- A **structured pillar context slice** (controlled by us).
- The **prior Agents' structured outputs** (controlled by us, schema-validated).
- The **user's prompt** (free text).

…and produces a strict JSON Schema output (no free text leak), the surface for prompt injection escaping the schema is very small. The only place user text appears is the original prompt, which is never executed as code or passed verbatim to subsequent calls without the schema wrapper.

---

## 5. Monetization Profile

| Metric | Value |
|--------|------:|
| Cost per Agent turn (GPT-4o-mini, structured I/O) | ~RM 0.001 |
| 4-Agent Boardroom run | ~RM 0.005 total |
| Charged to user | 4 credits ≈ RM 0.80 of revenue at top-up rates |
| Gross margin per run | **>99%** |

The Boardroom is the highest-margin product surface in the entire system. Engineering and product investment here directly compounds margin growth.

---

## 6. UI Surface

### Entry
- Prominent button on the home dashboard once 2+ Agents are active: **"Open the Boardroom →"**.
- The button is hidden (not greyed out) if the unlock condition isn't met — clean upsell rather than visible-but-locked.

### Query screen
- Single multi-line input box for the business question.
- Optional context chips ("Attach: invoice INV-2241", "Attach: product SKU-BEAUTY-01") so the user doesn't have to retype data.
- Submit shows the credit cost preview: _"~4 credits · ~6s response"_ (Fast Mode) or _"~4 credits · ~80s response"_ (Slow Mode).

### Result screen
- One card per included Agent, in deterministic order (Marketing → Sales → Operations → Finance → HR → Admin).
- Color-coded stance: green (support), amber (neutral), red (warning).
- A final **synthesized recommendation block** rendered by the orchestrator that summarizes the cross-examination into a single action line.

### Saved decisions
- Each Boardroom run is saved to the business's history.
- Owner can revisit, share via WhatsApp (read-only secure URL), or re-run with new data.

---

## 7. Example Run, End to End

**Prompt:** _"I want to offer a Buy-1-Free-1 deal to clear our beauty stocks."_

**Step 1 — Master orchestrator (relevance filter):**
> Activated: Marketing, Finance, Operations, HR.
> Silenced: Admin, Sales.

**Step 2 — Sequential turns:**

| # | Agent | Output |
|---|-------|--------|
| 1 | Marketing | _"Database confirms 40% target interest. Good strategy."_ (stance: **support**) |
| 2 | Finance | _"Warning: Margin drops from 60% to 20%. Breakeven is 200 units."_ (stance: **warning**) |
| 3 | Operations | _"Stock data shows 250 expiring items. Packing requires 3 days."_ (stance: **neutral**) |
| 4 | HR | _"Part-time packing support will increase costs by RM240."_ (stance: **warning**) |

**Step 3 — Synthesized recommendation:**
> _"Proceed with the B1F1 — but cap it at the 250 expiring units to lock margin exposure at RM240 (part-time packing). Run the promo for max 5 days to align with packing capacity. Marketing demand confirms uptake."_

**Step 4 — Credits charged:** 4 (one per included Agent).
**Step 5 — Saved to Boardroom history** for future reference.

---

## 8. Open Questions

- Pinned Agents — should the user be able to force certain Agents to always include (override the relevance filter)?
- Boardroom replays — re-run the same prompt next month to see how the business has changed?
- Confidence scores per Agent on a 0–100 scale?
- Cross-business benchmarks ("Owners in your sector typically chose…") — interesting, but opens data-privacy questions.
- Recording the underlying prompt + context for full auditability to the owner.
- Should the synthesized recommendation be its own Agent ("Chairperson AI"), or remain part of the orchestrator?
- Localization — synthesize in BM if the user's prompt is in BM?
