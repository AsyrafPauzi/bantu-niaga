# Pricing — Reference Sheet

> Every price in BantuNiaga (SME-OS), in one place. Currency: MYR. Billing: monthly.

---

## 1. Base Tiers

| Tier | Price (RM/mo) | Pillars Active | Staff Seats |
|------|--------------:|----------------|------------:|
| Starter | **50** | Admin · Finance · Operations | 1 |
| Micro | **80** | + Marketing + HR | up to 3 |
| SME | **120** | + Sales (all 6) | up to 10 |

Tier-by-tier inclusion detail → [packaging.md](./packaging.md).

---

## 2. Marketplace Add-ons (per pillar)

> Add-ons require the parent pillar to be active in your tier.

### Admin
| Add-on | RM/mo |
|--------|------:|
| Storage Tier — 5 GB | 5 |
| Storage Tier — 20 GB | 15 |
| Custom Document Builder | 15 |

### Finance
| Add-on | RM/mo |
|--------|------:|
| Full Ledger Analytics Suite | 25 |
| LHDN Tax & E-Invoicing Exporter | 35 |

### Operations
| Add-on | RM/mo |
|--------|------:|
| Micro Stock Tracker & Low-Stock Alarms | 20 |

### Marketing _(requires Micro+)_
| Add-on | RM/mo |
|--------|------:|
| Smart Link Tracker (UTM) | 15 |
| Promo Engine & WhatsApp Script Templates | 20 |

### Sales _(requires SME)_
| Add-on | RM/mo |
|--------|------:|
| Stale Deal & Detail Alarms | 15 |
| Hardware & Advanced POS Extensions | 25 |

### HR _(requires Micro+)_
| Add-on | RM/mo |
|--------|------:|
| Shift Rota Scheduler | 20 |
| Self-Service Mobile Leave Forms | 25 |

Full catalog with descriptions and dependencies → [marketplace-addons.md](./marketplace-addons.md).

---

## 3. AI Agents (per pillar)

> Each AI Agent is **RM15–RM20/mo** (exact price TBD per pillar) and includes **100 Fast Credits/month**.

| AI Agent | Available from tier | Price band (RM/mo) |
|----------|---------------------|---------------------|
| Admin AI | Starter | 15–20 |
| Finance AI | Starter | 15–20 |
| Operations AI | Starter | 15–20 |
| Marketing AI | Micro | 15–20 |
| HR AI | Micro | 15–20 |
| Sales AI | SME | 15–20 |

**Subscribe to ≥ 2 AI Agents** → unlocks the **AI Executive Boardroom** at no extra base fee.

### Credit pool & top-ups

| Item | Detail |
|------|--------|
| Bundled credits per Agent | 100 Fast Credits / month |
| Daily System Summary | 1 credit (~30/month per Agent) |
| Contextual text generation | 2 credits / click |
| Pillar data aggregation | 3 credits / click |
| Executive Boardroom query | 1 credit / execution turn (flat) |
| Slow Mode trigger | Pool exhausted → response time stretches to 15–20s |
| Top-up | **RM 10 / 50 Fast Credits** |

See [ai/agents.md](./ai/agents.md) for the full token economy.

---

## 4. Worked Examples

### Example A — Solo home-baker (Starter)
- Starter tier (RM50)
- Custom Document Builder (RM15) — branded quotations
- Finance AI (RM18) — overdue invoice nudges
- **Monthly: RM 83**

### Example B — Cafe with 3 staff (Micro)
- Micro tier (RM80)
- Micro Stock Tracker (RM20)
- Shift Rota Scheduler (RM20)
- Storage 5 GB (RM5)
- Operations AI (RM18) + HR AI (RM18) → Boardroom unlocked
- **Monthly: RM 161**

### Example C — Established retail, LHDN-ready (SME)
- SME tier (RM120)
- Micro Stock Tracker (RM20)
- Hardware & POS Extensions (RM25)
- Full Ledger Analytics (RM25)
- LHDN Exporter (RM35)
- Finance AI + Sales AI + Operations AI (3 × ~RM18 = RM54) → Boardroom on
- **Monthly: RM 279**

### Example D — Salon / booking-based service (Micro+)
- Micro tier (RM80)
- Self-Service Leave Forms (RM25)
- Shift Rota Scheduler (RM20)
- Promo Engine (RM20)
- Marketing AI + HR AI (≈ RM36) → Boardroom on
- **Monthly: RM 181**

### Example E — Online seller scaling for TikTok / FB ads (SME)
- SME tier (RM120)
- Smart Link Tracker (RM15)
- Promo Engine (RM20)
- Stale Deal Alarms (RM15)
- Marketing AI + Sales AI (≈ RM36) → Boardroom on
- **Monthly: RM 206**

---

## 5. Billing Rules

- **Currency:** MYR.
- **Cycle:** monthly, billed on subscription anniversary.
- **Payment rails:** Billplz / Curlec — FPX + Credit Card.
- **Activation:** prorated to remaining days in the current cycle (add-ons and AI Agents).
- **Deactivation:** remains active until end of paid cycle; not refunded mid-cycle.
- **Storage tiers:** only one active at a time; downgrade follows retention rules in [marketplace-addons.md](./marketplace-addons.md).
- **Failed payment grace:** add-ons + AI Agents suspended first; Base Tier suspended after grace window (final policy TBD).
- **Refund policy:** TBD.

---

## 6. Open Pricing Questions

- Final price per AI Agent (RM15 or RM20)? Per-pillar or uniform?
- Annual prepay discount?
- Free trial — across all tiers, or Starter only?
- Multi-business discount for one owner.
- Educational / non-profit pricing.
- Reseller / partner accountant pricing.
- Staff seat overage rate (Micro = 3, SME = 10 — what happens at +1?).
- Promo seasonal pricing (Raya, Merdeka).
- Top-up bundle ladder (RM10/50 today — RM20/120? RM50/350?).
