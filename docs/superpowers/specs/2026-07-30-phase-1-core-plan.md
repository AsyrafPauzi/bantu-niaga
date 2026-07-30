# Phase 1 — Core product plan

> **Status:** Approved direction 2026-07-30  
> **Goal:** One kedai/kafe SME can run daily operations in Bantu Niaga without domain, Billplz, or hybrid deploy.  
> **Out of scope:** Phase 2 (SaaS vs standalone), production SMTP, Billplz live, paid add-ons.

---

## 1. Definition of done (“settled”)

Phase 1 is complete when a demo owner can walk through **one full business day** with no broken flows:

| # | Journey | Pass criteria |
|---|---------|---------------|
| 1 | **Morning — HR** | See team, pending leave, approve/reject; Hana gives a plan from real data |
| 2 | **Counter — Sales** | Ring POS (cash + DuitNow QR), see daily total; Sufi sees leads + overdue follow-ups |
| 3 | **Floor — Ops** | Products in catalog; create booking without buffer conflict; order in pipeline |
| 4 | **Back office — Finance** | Create quote → convert to invoice → customer opens public link → DuitNow panel (if enabled) |
| 5 | **Growth — Marketing** | Customer CRM, segment, coupon/broadcast draft; Maya plans from spend + content |
| 6 | **Owner — Admin** | Tasks, compliance reminder, upload document |
| 7 | **Strategy — Boardroom** | Pick 2+ agents, ask one question, pause/end, export PDF |
| 8 | **AI** | All five staff agents (Hana, Maya, Sufi, Fayza, Aiman) answer from tenant data; credits meter |

**Non-goals for Phase 1:** payroll, staff portal, Meta/WhatsApp API, offline POS, LHDN connector, Billplz production, custom domain email.

---

## 2. Current state (snapshot)

### Strong ✅
- Platform auth, RBAC, RLS, marketplace credits
- HR core + Hana
- Marketing core + Maya
- Sales POS + leads + Sufi
- Boardroom meeting room
- Finance/Ops AI chat (advise-only)
- Demo seed: `owner@demo.bantuniaga.local` + `npm run seed:ai`

### Needs polish 🟡
- Finance: quote/invoice edge cases, overdue status, payment reminder copy
- Operations: booking edit conflict check, low-stock visibility on overview
- Marketing: broadcast send needs Resend in prod (OK to skip locally)
- Admin: compliance alerts add-on still “coming soon” (core tasks OK)
- AI: Fayza/Ops snapshots — verify against `finance_invoices` / real ops tables
- Checklist doc slightly behind code — sync at end of Phase 1

### Not started (correctly deferred) ⬜
- All Marketplace “coming soon” add-ons
- Phase 2 platform (SMTP prod, Billplz renewals, hybrid deploy)

---

## 3. Build order (4 tracks)

Work in parallel where possible; **finish each track’s “settle” list before starting add-ons**.

### Track A — Finance core settle (Week 1–2)

| Priority | Task | Done when |
|----------|------|-----------|
| A1 | Quote list + create + convert → invoice | Owner converts quote in UI; new invoice has new number |
| A2 | DuitNow on public invoice respects `show_duitnow` | Toggle off hides pay panel |
| A3 | Invoice statuses: sent / paid / void flows | Status changes persist; list filters work |
| A4 | Income/expense ↔ ledger consistency | POS sale and manual txn appear on ledger |
| A5 | Monthly summary on Finance overview | Matches txn totals for demo business |
| A6 | Fayza briefing uses `finance_invoices` + transactions | Assistant cites real invoice counts |

**Acceptance test:** Create quote for Rajesh → convert → copy public link → open in incognito → see pay fields.

---

### Track B — Operations core settle (Week 1–2)

| Priority | Task | Done when |
|----------|------|-----------|
| B1 | Booking create blocks overlap (+ buffer) | 409 with clear message |
| B2 | Booking edit/PATCH also runs conflict check | Same as create |
| B3 | Products linked to POS catalog | POS shows ops products |
| B4 | Orders pipeline: create → in progress → completed | Status updates on overview |
| B5 | Low-stock warning on overview | Products below threshold surfaced |
| B6 | Aiman briefing shows products + bookings | Assistant cites real counts |

**Acceptance test:** Book same resource twice overlapping → blocked; POS sells product from catalog.

---

### Track C — Sales + Marketing glue (Week 2)

| Priority | Task | Done when |
|----------|------|-----------|
| C1 | Lead convert → customer appears in Marketing | Phone match works |
| C2 | POS sale with `customer_id` → POS history on profile | Orders tab shows line items |
| C3 | Customer segments refresh (cron or manual) | VIP/dormant tags sensible on demo data |
| C4 | Sales overview matches POS + leads KPIs | Same numbers as Sufi packet |
| C5 | First-visit guides still work after nav changes | Skip = done |

**Acceptance test:** Win lead → convert → see customer → POS sale linked → Sufi says chase overdue.

---

### Track D — Admin + platform hardening (Week 3)

| Priority | Task | Done when |
|----------|------|-----------|
| D1 | Admin tasks + compliance calendar usable | Create task, set reminder |
| D2 | Document upload + download | File in storage, HR can link |
| D3 | Team invite works locally (dev link) | Owner invites manager; accept flow |
| D4 | `npm run seed:ai` documented in README | New dev can demo in 5 min |
| D5 | Typecheck + smoke scripts green | `tsc`, key vitest suites |
| D6 | Update `docs/CHECKLIST.md` to match reality | No false ⬜ on shipped items |
| D7 | Boardroom PDF + meeting flow regression | Export works with emoji in transcript |

**Acceptance test:** Fresh clone → seed → sign in → complete Track A–C demo script in one session.

---

## 4. AI & Boardroom (continuous, Week 2–3)

| Agent | Phase 1 scope | Not in Phase 1 |
|-------|---------------|----------------|
| Hana | Clarify → plan → leave tools | Appraisal create via chat |
| Maya | Clarify → plan → coupon/broadcast/content drafts | Meta publish |
| Sufi | Clarify → plan → lead tools | Auto stale-lead cron |
| Fayza | Clarify → plan (advise only) | Create invoice via chat |
| Aiman | Clarify → plan (advise only) | Create booking via chat |
| Boardroom | Meeting + PDF + create-after-confirm | Weekly digest email (needs domain) |

**Demo prompts to verify:**
- Hana: “Who needs my attention this week?”
- Maya: “Plan a win-back for dormant customers”
- Sufi: “Who should I chase today?”
- Fayza: “What invoices are still unpaid?”
- Aiman: “What bookings do we have this week?”
- Boardroom: “How do we boost lunch sales this month?” (Maya + Sufi + Hana)

---

## 5. Testing without domain / Billplz

| Need | Phase 1 workaround |
|------|-------------------|
| Sign-in | `owner@demo.bantuniaga.local` / `DemoPassword!2026` |
| Team invite | Dev `dev_invite_link` in API response (local) |
| Credits | Dev bypass (no `BILLPLZ_*` env) |
| Email broadcasts | Skip send locally; compose + draft OK |
| Public invoice | Use Vercel preview URL or localhost tunnel if needed |
| Boardroom digest | Skip until Resend + domain |

---

## 6. Phase 1 exit checklist

Before starting **Phase 2** (hybrid SaaS/standalone + domain + Billplz):

- [ ] All Track A–D acceptance tests pass on demo tenant
- [ ] No P0 bugs in POS, leads, invoices, leave
- [ ] `docs/CHECKLIST.md` updated
- [ ] One recorded demo script (5–10 min) or written walkthrough in `docs/`
- [ ] Migrations pushed; `tsc` clean
- [ ] Team agrees: “We could onboard a real kedai on Growth plan with core only”

---

## 7. What Phase 2 will add (reminder — not now)

- `DEPLOYMENT_MODE=saas | standalone`
- Hide `/sign-up` in standalone; single business bootstrap
- Custom domain + Supabase SMTP + Resend
- Billplz top-up + subscription charge
- Optional: company account data link for standalone

---

## 8. Suggested weekly focus

| Week | You test / we build |
|------|---------------------|
| **1** | Finance quotes + Ops bookings + run demo seed |
| **2** | Sales/Marketing glue + all AI prompts |
| **3** | Admin hardening + checklist + bug fixes |
| **4** | Buffer week: real-user feedback, polish only |

---

*Reference: [team-direction.md §3.5](../../team-direction.md), [CHECKLIST.md](../../CHECKLIST.md)*
