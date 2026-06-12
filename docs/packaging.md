# Packaging — Tier Detail

> What's included in Starter, Micro, and SME. Add-ons and AI Agents are sold separately on top of any tier.

## Overview

| Tier | Price (RM/mo) | Pillars Active | Core User Limit | Target |
|------|--------------:|----------------|-----------------|--------|
| **Starter** | 50 | Admin · Finance · Operations | 1 (owner only) | Solo founders, home-bakers, dropshippers |
| **Micro** | 80 | + Marketing + HR | Up to 3 staff | Retail stalls, boutique kiosks, small workshops |
| **SME** | 120 | + Sales (all 6 pillars) | Up to 10 staff | Established businesses scaling teams |

Each tier includes the **Base Package** of every active pillar — i.e. when a pillar is "active" in a tier, the user gets the full Base feature list for that pillar (see each pillar doc).

---

## Starter — RM 50/mo

**Active pillars:** Admin, Finance, Operations.
**Users:** owner only (1 seat).
**Designed for:** the owner-operator who is the entire company.

### What you get out of the box

- **Admin:** Digital Storage (1 GB) · Smart Task Matrix · Notification Feed · Document Template Library.
- **Finance:** Basic Accounting Module · Invoice Generator (Secure URL).
- **Operations:** Order Fulfillment Pipeline · Supplier Directory · Product Manager · Booking Slot Manager.

### What's locked

- Marketing, Sales, HR pillars (entire sections hidden / disabled in nav).
- No additional staff seats.

### Typical Starter user
Home-baker selling on Instagram and WA → uses Operations bookings for delivery slots, Finance invoices for cash collection, Admin storage for receipts.

---

## Micro — RM 80/mo

**Active pillars:** Starter + **Marketing + HR**.
**Users:** up to **3 staff** seats (in addition to owner).
**Designed for:** the first hire — when the owner can no longer do everything alone.

### What unlocks vs. Starter

- **Marketing:** Customer Profiles CRM · Social Media Content Calendar.
- **HR:** Core HRM Registry · Leave Overview Dashboard.
- **3 staff seats** can sign in and operate the system under the owner.

### What's locked

- Sales pillar (Lead CRM, Mobile POS) still hidden.
- Staff seat ceiling: hard limit at 3.

### Typical Micro user
A small kedai with 2 part-time helpers — needs to track who works which day (HR) and start nurturing a customer database (Marketing CRM).

---

## SME — RM 120/mo

**Active pillars:** all 6.
**Users:** up to **10 staff** seats.
**Designed for:** established operations with a formal sales motion.

### What unlocks vs. Micro

- **Sales pillar:**
  - Sales Prospect CRM (lead tracking).
  - Basic Mobile POS Interface (cash + DuitNow Static QR).
- **10 staff seats.**

### Typical SME user
A cafe with 6 staff running counter sales daily, a salon with a booking + walk-in mix, a homestay operator with multiple properties.

---

## Cross-Tier Rules

### What's the same across all tiers

- Mobile-first UX.
- Marketplace add-ons available for **any active pillar** in your tier.
- AI Agents available for **any active pillar** in your tier.
- Secure URL system for invoices, leave forms, etc.
- Multi-tenant data isolation.

### Add-ons follow active pillars

You can only enable a pillar's add-ons if that pillar is **active** in your tier.

| Add-on | Requires Tier |
|--------|---------------|
| LHDN Tax Exporter | Starter+ (Finance active everywhere) |
| Micro Stock Tracker | Starter+ (Operations active) |
| Custom Document Builder | Starter+ (Admin active) |
| Smart Link Tracker (UTM) | **Micro+** (Marketing required) |
| Promo Engine | **Micro+** |
| Shift Rota Scheduler | **Micro+** (HR required) |
| Self-Service Leave Forms | **Micro+** |
| Stale Deal Alarms | **SME** (Sales required) |
| Hardware & POS Extensions | **SME** |

### AI Agents follow active pillars

Same rule. You can subscribe to an AI Agent only for an active pillar in your tier.

| Agent | Available from |
|-------|----------------|
| Admin AI · Finance AI · Operations AI | Starter |
| Marketing AI · HR AI | Micro |
| Sales AI | SME |

The **Executive Boardroom** activates whenever ≥ 2 AI Agents are subscribed, regardless of tier — though in practice it's most useful at Micro and SME tiers where more pillars are active.

---

## Upgrades & Downgrades

- **Upgrade (Starter → Micro → SME):** instant. Newly unlocked pillars become visible immediately. Billing prorates for the current cycle.
- **Downgrade:** takes effect at the next billing cycle. Locked pillars' data is **retained** (not deleted) and re-appears upon re-upgrade. While locked: data is read-only via API, hidden from UI, no new events triggered, add-ons on locked pillars suspended.
- **Staff seat overage:** when downgrading to a tier with a lower seat cap, the owner must either pay overage (TBD) or deactivate excess staff before the cycle ends.

---

## Open Packaging Questions

- Annual prepay discount? (10%? 15%? — TBD)
- Free trial duration per tier? (14 days? 30 days?)
- Multi-business / multi-`idcompany` discount for one owner?
- Partner / reseller pricing (e.g. for accountants).
- Educational / non-profit pricing.
- Staff seat overage pricing.
- Grandfathering rules when base tier pricing changes.
