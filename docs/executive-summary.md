# Executive Summary

## The Problem

Malaysian micro-SMEs and sole proprietors operating under **Enterprise** status are structurally ignored by traditional software vendors.

- **Cost-prohibitive.** Mainstream ERPs are priced for Sdn Bhd companies, not RM5k/month kedai operators.
- **Overly technical.** Onboarding assumes a finance team, not a one-person founder.
- **Wrong legal shape.** Most ERPs are built around double-entry bookkeeping and corporate HR overhead — workflow weight that an Enterprise sole prop does not legally need.

The default response: owners coordinate operations manually using **fragmented tools** — WhatsApp text threads, physical logbooks, Google Sheets, paper receipts. Knowledge is siloed in one person's head; nothing is auditable; nothing is recoverable if the phone is lost.

## The Solution — Bantu Niaga (SME-OS)

A **dual-mode AI Business Operating System** built around how a real Malaysian micro-SME actually works:

- 🖥️ **Desktop ERP** — control & analytics. For the Sunday-night review, the payroll run, the AI Boardroom session.
- 📱 **Mobile PWA** — execution. For the dozens of <10-second actions across the day: ring up a sale, snap a receipt, share an invoice via WhatsApp, swipe a task done.

Both modes share **one PostgreSQL backbone, one auth & 6-role RBAC layer, one event bus, one AI orchestrator.** Same business, two surfaces tuned to two very different jobs.

The product maps operations into **6 Core Pillars** under a **"Golden Middle"** philosophy: enough workflow value to replace fragmented tools, without the data-entry fatigue of a full ERP.

The six pillars:

1. **Admin** — back-office: documents, tasks, templates, notifications.
2. **Finance** — money in/out, invoices, LHDN-compliant exports.
3. **Operations** — order pipeline, suppliers, products, bookings.
4. **Marketing** — customer CRM, content calendar, promos.
5. **Sales** — leads + mobile POS.
6. **HR** — employee registry, leave, shift rota.

### What Bantu Niaga IS — and ISN'T

| ✅ Bantu Niaga IS | ❌ Bantu Niaga is NOT |
|------------------|------------------------|
| A dual-mode AI Business Operating System | Accounting software (Xero, QuickBooks, Bukku) |
| A modular SaaS marketplace platform | A traditional ERP (Odoo, SAP) |
| A mobile-first execution engine with desktop-grade analytics | A standalone CRM (HubSpot, Pipedrive) |
| A premium AI executive boardroom for solo owners | A POS-only app (StoreHub, Loyverse) |

## Why It Wins

The product is a triangle of three reinforcing strategies:

### 1. Extreme entry affordability
Starting at **RM50/month**, the Starter tier undercuts every comparable ERP on the market while still offering the three pillars most micro-SMEs use daily.

### 2. À-la-carte expansion (the Marketplace)
Owners scale spend with their business, not their fear of switching platforms. Each pillar has its own catalog of plug-in upgrades, billed monthly, switchable from inside the dashboard.

### 3. Premium AI layer (Executive Boardroom)
A solo owner can subscribe to per-pillar AI Agents (RM15–20/mo each). With 2+ Agents active, the **Executive Boardroom** unlocks — a virtual exec committee where Marketing, Finance, Operations, and HR Agents cross-examine a single business question.

This is the moat: the more pillars an owner uses, the more powerful the Boardroom becomes — and the more "lock-in" exists through structured business data accumulating in PostgreSQL.

## Target Segments

| Segment | Tier sweet spot |
|---------|-----------------|
| Solo home-baker / dropshipper / freelancer | Starter (RM50) |
| Retail stall / boutique kiosk / small workshop | Micro (RM80) |
| F&B with 5+ staff / salon chain / homestay operator | SME (RM120) |
| Growing business needing tax-readiness | SME + LHDN add-on + Finance AI |
| Service business needing branded paperwork | Micro + Custom Document Builder + AI |

## Margin Story

Bantu Niaga is engineered for **99%+ gross margin from day one** — not earned over time, structural. Stack is locked on Vercel + Supabase (Singapore) + OpenAI GPT-4o-mini + Billplz/Curlec.

| Cost Category | Amount |
|---------------|-------:|
| **Fixed infrastructure (MVP, 0–100 paying users)** | **~RM 10 / month** (Vercel Hobby + Supabase Free + Resend) |
| **Fixed infrastructure (Growth, 100–1K paying users)** | **~RM 220 / month** (Vercel Pro + Supabase Pro) |
| **Variable AI cost** | **~RM 0.26 per active user / month** |
| **Marginal cost per customer** | **~RM 1–4 / month** |
| **Break-even on infrastructure** | **1 paying customer at MVP stage** |

How:

- **Single Next.js codebase** powers both Desktop ERP and Mobile PWA — no dual-team overhead.
- **Structured AI triggers** (no open chat) keep token usage predictable per click.
- **Credit pool per Agent** (100 fast credits/month) prevents runaway usage.
- **Slow Mode throttle** (15–20s response) when credits run out — preserves UX without burning compute.
- **GPT-4o-mini** for Boardroom orchestration (~RM 0.005 per multi-agent chain).
- **Top-up packs** (RM 10 / 50 credits) for users who want to stay in Fast Mode.

See [ai/agents.md](./ai/agents.md) for the full token economy and [architecture/tech-stack.md §10](./architecture/tech-stack.md) for the infrastructure cost model.

## Strategic Differentiation

| Competitor archetype | Their gap | Bantu Niaga's answer |
|----------------------|-----------|----------------------|
| Generic ERPs (SAP, Odoo) | Too heavy, Sdn Bhd-shaped, desktop-only | Enterprise-shaped, dual-mode (desktop control + mobile execution), 5-second hot paths |
| Bookkeeping apps (Xero, Wave) | Finance only, no operations/HR | Six pillars + cross-pillar sync |
| WhatsApp + spreadsheets | No structure, no audit trail, no AI | Structured DB, secure shareable URLs, AI insights |
| Local POS-only tools (StoreHub, Loyverse) | Single-function, no LHDN, no CRM, no AI | Full pillar coverage, LHDN-ready, native CRM, AI Boardroom |

## Status

Pre-build. Product proposal and feature specification phase. See [README.md](./README.md) §9 for status table.
