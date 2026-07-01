# Project Proposal: Bantu Niaga

**Subtitle:** Dual-Mode AI Business Operating System for Malaysian Micro-SMEs  
**Prepared for:** Investors, strategic partners, implementation stakeholders, and founder review  
**Date:** 21 June 2026  
**Version:** Final Draft / v1 Proposal  
**Prepared by:** Bantu Niaga project team

---

## Executive Summary

Bantu Niaga is a Malaysia-native, dual-mode business operating system for micro-SMEs, sole proprietors, and small owner-operated teams. It brings together the daily tools that most small businesses currently run across WhatsApp, Excel, paper receipts, ad hoc bank transfers, and disconnected point solutions.

The product is positioned as a unified operating layer rather than a single-purpose app. It is not accounting-only, not POS-only, not CRM-only, and not a traditional heavyweight ERP. Bantu Niaga combines six operational modules, a shared multi-tenant database, role-based access control, secure public links, and an optional AI decision layer in one practical SaaS product.

The core strategic insight is that Malaysian micro-SME owners work in two modes. During the day they execute from a phone: record a sale, share an invoice on WhatsApp, capture a receipt, approve a task, check a booking, or message a customer. At night or on weekends they need control: analytics, compliance, staff records, role management, content planning, billing, and deeper reviews. Bantu Niaga therefore uses a dual-mode concept:

- **Desktop ERP control layer** for management, configuration, reporting, compliance, and AI Boardroom decisions.
- **Mobile PWA execution layer** for fast counter, field, WhatsApp, camera, and staff workflows.

Bantu Niaga is already more than a concept. The repository contains a live Next.js and Supabase implementation with tenant scoping, RBAC foundations, app shell, marketing CRM surfaces, marketplace, privacy tooling, platform admin surfaces, AI context isolation, and multiple Supabase migrations. The most recent implementation progress includes Marketing core v1.1 shipped across segments, broadcasts, coupons, and media upload; Admin Digital Storage shipped with a 100 MB file cap and signed URL flow; and live Supabase migrations applied. A Vercel deployment branch mismatch has been diagnosed separately: production should deploy from `main` to avoid stale branch assets, old CSP, or fetch/runtime issues.

The commercial thesis is straightforward: micro-SMEs need a simple operating system before they need an enterprise ERP. Bantu Niaga can start with low fixed infrastructure cost, expand by tiered modules, monetize add-ons and AI credits, and grow with customers as they move from manual survival workflows into structured digital operations.

---

## Problem Statement

Malaysian micro-SMEs are operationally sophisticated but tooling-poor. A single owner may sell on WhatsApp, take orders from Instagram, record expenses in a notebook, issue invoices manually, keep staff IC copies in chat threads, track stock in memory, and chase customers through copied messages. This creates a daily burden that scales badly.

The typical pain points are:

- **Fragmented records:** WhatsApp conversations, Excel files, paper receipts, and phone galleries become the real database.
- **Manual bookkeeping:** revenue, expenses, invoices, SST assumptions, payment references, and LHDN preparation are often reconstructed after the fact.
- **Disconnected marketing and sales:** customer lists, broadcast audiences, coupons, social content, leads, and POS records are rarely tied to one customer profile.
- **Compliance exposure:** SSM renewal, LHDN e-invoicing readiness, SST lines, staff records, PDPA obligations, and audit trails are difficult to manage without process discipline.
- **Staff access risk:** small teams need helpers, cashiers, HR assistants, and accountants, but most affordable tools do not provide practical role separation.
- **Low technical tolerance:** complex ERP language and corporate workflows do not fit a kedai, salon, home bakery, homestay, tuition centre, or online seller.
- **Mobile-first behaviour:** the owner's phone is the main business terminal, but most serious business software is still desktop-first.

The result is not merely inconvenience. Fragmentation causes missed payments, lost customer history, duplicate contacts, late follow-ups, weak cash visibility, compliance risk, and owner burnout.

---

## Target Market

Bantu Niaga targets Malaysian micro-SMEs and owner-operated businesses that need structure without the cost or complexity of traditional ERP.

Primary target segments:

- Sole proprietors and SSM Enterprise businesses.
- Home businesses and online sellers.
- Retail shops, kedai runcit, mini marts, and pop-up sellers.
- F&B stalls, cafes, bakeries, food trucks, and home kitchens.
- Salons, beauty services, barbers, tuition centres, repair shops, photography studios, and homestays.
- Small teams of 1 to 20 staff where the owner is still hands-on.

Representative personas:

| Persona | Current behaviour | Bantu Niaga value |
| --- | --- | --- |
| Home baker | Orders through WhatsApp, manual notebook, bank transfer screenshots | Mobile invoice, customer record, order pipeline, content planner |
| Kedai owner | Counter sales, helper shifts, stock memory, supplier contacts | POS foundation, product catalog, finance ledger, staff roles |
| Salon operator | Appointment bookings, staff leave, recurring customers | Booking, customer CRM, HR registry, leave overview, marketing segments |
| Online seller | TikTok/IG/Facebook traffic, promo blasts, loose customer list | Content calendar, broadcasts, coupons, customer cohorts, Sales pipeline |
| Service provider | Quotation PDFs, deposits, renewal reminders, document storage | Admin templates, digital storage, compliance calendar, invoice links |

Market behaviour assumptions:

- WhatsApp is the primary operating channel for customers, suppliers, and staff.
- Owners value speed and clarity more than feature breadth.
- Mobile actions must be fast enough for real counter usage.
- Desktop value appears when owners review business performance, compliance, staff, and strategy.
- Malaysia-specific workflows are a differentiator, not a localization afterthought.

---

## Product Vision and Positioning

Bantu Niaga is a **Dual-Mode AI Business Operating System for Malaysian Micro-SMEs**.

It is designed around four positioning principles:

1. **Unified, not siloed.** Finance, Operations, Marketing, Sales, HR, and Admin share one database and one tenant model.
2. **Modular, not bloated.** Users start with the modules they need, then upgrade as the business grows.
3. **WhatsApp-first, not channel-agnostic.** Secure links, message drafts, click-to-chat broadcasts, and share flows respect how Malaysian SMEs already work.
4. **AI-assisted, not AI-chaotic.** AI is structured through agents, briefing packets, strict schemas, credits, and role-aware tenant context. It augments decisions without turning the product into an open-ended chatbot.

Bantu Niaga deliberately avoids competing head-on as only accounting software, only CRM, only POS, or only HR. The product wins by connecting these workflows in the daily context of a small Malaysian business.

---

## Six Core Modules

### 1. Admin

**Purpose:** back-office hygiene, documents, storage, notifications, tasks, and operational reminders.

Core features:

- Digital Storage for receipts, PDFs, HR documents, signed files, and business documents.
- Smart Task Matrix with To-Do, Doing, Done workflow.
- System Notification Feed for events such as invoice sent, payment received, low stock, leave requests, and compliance reminders.
- Document Template Library for standard Malaysian documents such as quotations, offer letters, tenancy-related documents, and HR letters.
- Compliance Calendar for SSM renewal, signboard licence, halal/food-handler requirements, insurance, tenancy dates, and other practical reminders.
- Digital Signature on shared documents through secure links.

Current implementation status:

- Admin Digital Storage is shipped in the app with `admin_files` metadata, a private Supabase Storage bucket, RLS policies, soft-delete model, signed upload/download flow, and a 100 MB file cap.
- Broader Admin templates, compliance calendar, task matrix depth, and notification feed expansion remain part of the product roadmap.

Business value:

- Reduces document chaos and WhatsApp-file dependency.
- Creates a compliance memory for the business.
- Builds trust through professional quotations, PDFs, and secure links.

### 2. Finance

**Purpose:** simple money tracking, invoice sharing, payment readiness, and compliance preparation.

Core features:

- Basic revenue and expense ledger.
- Mobile-first expense capture with receipt photo attachment.
- Invoice Generator with secure public URL.
- Per-business invoice numbering, for example `INV-2026-0001`.
- SST line support through a simple business-level toggle.
- Pay Now panel using DuitNow ID, amount, and reference without requiring a payment gateway.
- Quote-to-Invoice conversion.
- Late-payment reminder generator with WhatsApp-ready BM/EN copy.
- Future LHDN e-invoicing exporter and full ledger analytics as commercial add-ons or tier-bundled features depending on packaging.

Current implementation status:

- Finance is the always-available foundation tier in current code.
- The broader app has invoices, credit ledger, billing, and platform metrics hooks in place, but the full Finance pillar is not presented as complete.

Business value:

- Gives owners cash visibility without forcing accounting jargon.
- Makes invoice sharing and payment references clearer.
- Prepares the product for LHDN and SST workflows.

### 3. Operations

**Purpose:** move work from order to delivery while managing suppliers, products, bookings, and service capacity.

Core features:

- Order Fulfillment Pipeline with configurable columns.
- Supplier Directory with payment terms and material cost logs.
- Product Manager with SKU, category, price, image, and variants.
- Services & Booking Slot Manager for appointments, rentals, homestays, salons, tuition, and other time-based businesses.
- Customer-facing booking page using secure hash URL.
- Buffer time between bookings.
- Future stock tracker, low-stock alerts, auto-PO, and multi-location inventory as add-ons or later roadmap features.

Current implementation status:

- Operations surfaces exist in the application shell and are tier-gated in code.
- Full Operations workflows such as product variants, bookings, stock sync, supplier analytics, and booking pages are roadmap work.

Business value:

- Helps owners know what is pending, in progress, ready, or delivered.
- Connects orders to customers, invoices, and stock.
- Makes service scheduling less dependent on manual WhatsApp checking.

### 4. Marketing

**Purpose:** know customers, plan content, act on segments, and run promotions.

Core features:

- Customer Profiles CRM with name, phone, email, address, tags, notes, and purchase metrics.
- Phone-based deduplication, with Malaysian phone normalization.
- Auto customer segmentation tags: new, repeat, VIP, dormant, and at-risk.
- CSV import/export for onboarding from existing lists.
- Social Media Content Calendar for TikTok, Instagram, and Facebook planning.
- Media uploader for photo, video, carousel, and content assets.
- Saved customer segments, including auto and custom cohorts.
- Broadcasts through WhatsApp click-to-chat and email.
- Coupons with percentage or ringgit-off codes, validation, redemption tracking, and future POS compatibility.
- Meta Facebook/Instagram integration architecture exists for OAuth, publishing, and insights, but real customer use depends on Meta App Review and platform credentials.

Current implementation status:

- Marketing core v1.1 is shipped in recent commits: segments, broadcasts, coupons, media uploader, and the supporting migrations/API/UI/tests.
- Earlier Marketing core also shipped CRM, customer dedup, CSV import/export, auto-tags, content calendar, and KPI foundations.
- Full Meta Cloud API auto-posting is not the default v1 assumption. Current practical broadcast channel is WhatsApp click-to-chat and email; full API-based WhatsApp or social automation is deferred or gated by app review and credentials.

Business value:

- Turns a customer list into actionable customer cohorts.
- Lets owners create campaigns without expensive marketing suites.
- Makes promotions trackable instead of being lost in WhatsApp screenshots.

### 5. Sales

**Purpose:** track leads and take payment quickly at the counter.

Core features:

- Sales Prospect CRM with lead statuses from New to Won/Lost.
- Lead notes, channel, interest, and value estimate.
- One-tap Lead to Customer conversion through Marketing CRM.
- Basic Mobile POS with product grid.
- Cash and DuitNow QR payment methods.
- Dynamic DuitNow QR per amount for suitable DuitNow IDs.
- Discounts, refunds, voids, SST line on receipts, and auditable ledger reversal flows.
- Future hardware, barcode scanning, receipt printer, table management, and offline POS add-ons.

Current implementation status:

- Sales is tier-gated and appears in the codebase structure, with POS coupon validation plumbing started as part of Marketing v1.1.
- Full Sales CRM and POS implementation remain pending.

Business value:

- Prevents warm leads from being forgotten.
- Creates a bridge from marketing campaigns to actual sales.
- Gives cashiers a narrow role without exposing finance, HR, or admin areas.

### 6. HR

**Purpose:** keep employee data safe, manage leave, and prepare for staffing workflows.

Core features:

- Core HRM Registry for employee name, IC number, IC copy, emergency contact, bank account, role, and employment type.
- Leave Overview Dashboard for AL, EL, and MC.
- State-aware Malaysian public holiday calendar.
- AL carry-forward rules.
- Employee onboarding checklist.
- Contract and employment letter generator using Admin templates.
- Future shift rota, self-service leave forms, statutory payroll, EPF/SOCSO/EIS/PCB, time clock, and EA form generation.

Current implementation status:

- HR is present in docs, app navigation, entitlements, and RBAC model.
- Full HR operational implementation remains pending.

Business value:

- Removes sensitive employee records from chat threads.
- Gives owners a structured employee and leave record.
- Builds a path toward statutory payroll and workforce scheduling.

---

## AI Layer

Bantu Niaga's AI layer is designed as an opt-in decision intelligence layer, not a free-form chat feature.

The AI model:

- One AI agent per pillar: Admin AI, Finance AI, Operations AI, Marketing AI, Sales AI, and HR AI.
- Structured triggers only: daily summaries, contextual text generation, data aggregation, and Boardroom turns.
- Strict JSON Schema outputs to control UI rendering, token usage, and parser reliability.
- Shared credit pool with Fast Mode and Slow Mode.
- Top-ups for extra credits.
- Tenant-scoped briefing packets so AI reads only compact, business-scoped summaries rather than raw cross-tenant data.

The **Executive Boardroom** unlocks when a business subscribes to two or more AI agents. It lets a founder ask one multi-pillar question and receive structured perspectives from relevant agents. For example, a Buy-1-Free-1 promotion can be reviewed by Marketing, Finance, Operations, and HR from demand, margin, stock, and staffing angles.

AI is monetizable because the cost model is controlled:

- GPT-4o-mini is used for cost-efficient structured calls.
- Each agent contributes a defined monthly credit pool.
- Each trigger has a known credit cost.
- Slow Mode reduces abuse without blocking operational use.
- The Boardroom uses a relevance filter to avoid charging for irrelevant agents.

Current AI implementation status:

- AI context isolation and briefing packet infrastructure exists for tenant-scoped agent context.
- Admin, Finance, and Marketing snapshots are live; Operations, Sales, and HR snapshots are placeholders until their tables mature.
- Full customer-facing AI agents and Boardroom workflows remain roadmap work.

---

## Technical Architecture

Bantu Niaga is built as one modern SaaS application rather than a collection of disconnected services.

| Layer | Current choice |
| --- | --- |
| Frontend | Next.js 15 App Router, React 19 |
| Styling | Tailwind CSS |
| Hosting | Vercel, with Singapore edge positioning |
| Backend | Next.js Route Handlers and Supabase Edge Functions |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Security | Supabase RLS, RBAC matrix, tenant scoping, audit logs |
| AI | OpenAI GPT-4o-mini with strict JSON Schema patterns |
| Email | Resend for app/marketing emails; Supabase Auth emails for auth flows |
| Payments | Billplz primary and Curlec fallback planned |
| Future integrations | Meta, TikTok, WhatsApp Cloud, LHDN MyInvois, logistics, analytics |

### Multi-Tenant Data Model

The platform uses a shared database with tenant isolation through `business_id`. Each business owns its own records; every table that contains tenant data is scoped by business. This allows a cost-efficient SaaS architecture while retaining strong isolation.

Core architectural principles:

- `business_id` on tenant-owned tables.
- RLS policies at the database layer.
- App-layer user resolution through `getCurrentUser()`.
- Role and business lookup per request for v1, with JWT custom claims deferred until scale requires it.
- Explicit service-role use only in narrow, audited server-side paths.

### Cross-Pillar Event Model

Bantu Niaga's modules are connected through domain events. The goal is for one owner action to update the rest of the business without manual duplicate entry.

Examples:

- `invoice.paid` can create Finance ledger movement, update Operations stock, post Admin notification, and update Marketing customer metrics.
- `lead.converted` links Sales to Marketing customer records.
- `booking.completed` updates Marketing customer activity.
- `payroll.approved` can post Finance expense entries in future HR payroll flows.

The architecture uses a transactional outbox pattern so important events can be retried, audited, and processed idempotently.

### Storage and Signed URLs

The app uses private Supabase Storage buckets with metadata in Postgres and signed upload/download URLs. Public business artifacts, such as invoices, bookings, leave forms, and document links, use secure hash conventions rather than guessable URLs.

Admin Storage and Marketing media both use:

- Private buckets.
- `business_id` path conventions.
- RLS-protected metadata tables.
- Soft-delete metadata.
- 100 MB upload cap enforced at client, API, and database levels.
- Signed URLs for controlled access.

### Deployment Note

The production deployment should deploy from `main`. A Vercel branch mismatch can make production serve stale assets or older security policy/configuration, including old CSP and fetch behaviour. This has been diagnosed separately and should be treated as an operations/configuration fix, not a product architecture limitation.

---

## Security, Privacy, and Compliance

Security is a core investment area because the product handles business finance, customer records, employee data, invoices, and future AI summaries.

### RBAC

Bantu Niaga uses six roles:

| Role | Intended access |
| --- | --- |
| Owner | Full system access, billing, team management, all active modules |
| Manager | Operational access across active modules, excluding billing and team ownership controls |
| Accountant | Finance module access only |
| HR Officer | HR access plus HR-scoped Admin storage |
| Cashier | Sales POS surface only |
| Staff | Assigned tasks and self-service leave only |

The RBAC model is enforced through:

- A single TypeScript permissions matrix.
- API route checks.
- UI shell hiding and navigation gating.
- Supabase RLS as database defense in depth.

### Tenant Isolation

Tenant isolation depends on `business_id` scoping and RLS. This is especially important for:

- Customer CRM and marketing segments.
- Invoices, transactions, and billing records.
- HR employee records and sensitive IC/bank fields.
- Admin and marketing files.
- AI briefing packets.
- Platform admin cross-tenant tooling.

### Audit and Administration

The system includes audit concepts at both tenant and platform levels:

- Tenant `audit_log` for business mutations.
- `super_admin_audit` for platform-admin activity.
- Platform admin app separated under `/super-admin/*`.
- Impersonation is explicitly bannered and audited.

### PDPA

The privacy architecture aligns with Malaysia's PDPA direction:

- Data export endpoint for access and portability.
- Account/business deletion request flow with 30-day grace period.
- Consent catalog and consent history.
- DSR audit table.
- Public privacy and terms pages.
- Strictly necessary cookies by default.

### LHDN, SST, and E-Invoicing

The product roadmap includes:

- Invoice numbering and audit trails.
- SST line support.
- LHDN/MyInvois connector and XML/export flow as roadmap or tier-bundled commercial capability.
- Record retention policies appropriate for tax/audit requirements.

The proposal assumes final LHDN schema details will need continuous maintenance as government requirements evolve.

---

## Business Model and Pricing

Bantu Niaga uses a tiered SaaS model supported by add-ons and AI credits.

### Current Code-Backed Tiers

The latest implementation-facing pricing model in code uses Free/Plus/Growth/Pro labels mapped to internal tier keys:

| Commercial label | Internal tier | Price | Included modules |
| --- | --- | ---: | --- |
| Free | `starter` | RM 0/month | Finance |
| Plus | `micro` | RM 80/month | Finance, Admin, Operations |
| Growth | `sme` | RM 120/month | Finance, Admin, Operations, Sales, HR |
| Pro | `enterprise` | RM 220/month | Finance, Admin, Operations, Sales, HR, Marketing |

The current plan metadata also includes quotas such as seats, customer limits, storage, and fast credits. Add-ons include extra seats, extra storage, AI credit top-ups, and WhatsApp Business API pricing.

### Pricing Caveat

There is a known documentation conflict:

- Older PRD/persona materials use **Starter RM50, Micro RM80, SME RM120** and describe earlier packaging assumptions.
- Current implementation files use **Free, Plus RM80, Growth RM120, Pro RM220** with Marketing unlocked at Pro.
- Some older pillar/add-on docs also describe add-ons such as 5 GB/20 GB storage, stock tracker, rota, self-service leave, and other proposed packages that are not all live marketplace items today.

This proposal uses the current code-backed Free/Plus/Growth/Pro model as the baseline while treating all pricing and packaging as subject to founder approval before commercial launch.

### Add-Ons and Marketplace

The marketplace model lets Bantu Niaga monetize advanced capabilities without making the base product feel expensive.

Current live catalog examples include:

- WhatsApp Business API.
- TikTok Shop sync.
- Extra staff seat.
- Extra 10 GB storage.
- Boost Credits.
- Boardroom weekly digest.
- LHDN e-Invoice connector.
- Shopee sync.
- Payroll bank export.
- Public holiday calendar sync.

Future add-ons may include:

- Payment Gateway Connector for Billplz, Curlec, FPX, cards, e-wallets, and auto-reconciliation.
- Advanced POS hardware.
- Stock automation.
- Shift rota and statutory payroll.
- Smart link tracking and deeper marketing automation.

### AI Monetization

AI can be sold as:

- Per-agent subscription.
- Bundled fast credits.
- One-time top-up credit packs.
- Boardroom-related digest or premium decision surfaces.

The AI model is commercially attractive because structured triggers allow cost control and high gross margin.

---

## Go-To-Market Strategy

Bantu Niaga should start founder-led and vertical-specific.

Recommended go-to-market sequence:

1. **Founder-led onboarding:** onboard early users personally, using real Malaysian micro-SME workflows.
2. **Demo account and live app:** use seeded demo tenants to show customer CRM, content calendar, invoices, admin storage, marketplace, privacy, and platform admin credibility.
3. **Start with urgent verticals:** salons, F&B, home bakeries, small retail, service bookings, and online sellers.
4. **WhatsApp support loop:** provide in-app WhatsApp support with context, because the target market already uses WhatsApp for trust.
5. **Referral mechanics:** encourage referrals after first invoice, first broadcast, first coupon campaign, or first month of recorded transactions.
6. **Pilot-to-paid path:** offer hands-on migration from Excel/WhatsApp lists into Marketing CRM and Finance starter workflows.
7. **Partner channels:** collaborate with SME accountants, digital marketing freelancers, local business associations, and micro-financing/community programs.

The initial wedge should be practical: customer records, invoice sharing, admin storage, simple finance, content planning, broadcasts, and coupons. This gives owners visible value before the full six-module vision is complete.

---

## Implementation Roadmap

### Phase 0: Foundations

Focus:

- Next.js and Supabase project foundation.
- Supabase Auth.
- Business onboarding and tenant model.
- `business_id` scoping.
- RBAC matrix and permissions helpers.
- RLS policies.
- Audit logs.
- Event outbox foundation.
- Vercel deployment.

Current status:

- Major foundations exist in the repository, including auth, tenant resolution, roles, entitlements, RLS-oriented migrations, settings, platform admin, privacy, marketplace, and app shell.

### Phase 1: Starter / Core Admin, Finance, Operations

Focus:

- Finance ledger and invoice core.
- Admin storage, document templates, task matrix, notifications.
- Operations product/supplier/order foundation.
- Secure public invoice and booking links.

Current status:

- Admin Storage is shipped.
- Finance is the baseline tier and shell foundation exists.
- Operations remains roadmap for full workflows.

### Phase 2: Marketing and HR

Focus:

- Marketing CRM.
- Customer CSV import/export.
- Auto tags and segments.
- Content calendar and media uploader.
- Broadcasts and coupons.
- HR registry, leave, holidays, onboarding checklist, employment letters.

Current status:

- Marketing core through v1.1 is shipped.
- HR remains pending beyond docs/shell/role model.

### Phase 3: Sales, POS, Payments, and LHDN

Focus:

- Sales Prospect CRM.
- Mobile POS.
- Coupon validation and redemption inside POS.
- Payment Gateway Connector.
- LHDN e-invoicing/export flows.
- Refunds, voids, stock sync, and end-of-day controls.

Current status:

- Coupon validation plumbing is prepared for POS compatibility.
- Full Sales/POS and payment gateway integrations remain pending.

### Phase 4: AI Agents

Focus:

- Per-pillar agents.
- Morning briefs.
- AI usage metering.
- Structured trigger outputs.
- Credit pool, top-ups, Slow Mode.
- Agent context isolation for each completed pillar.

Current status:

- AI context isolation and tenant-scoped briefing packets exist.
- Full customer-facing agent subscriptions and UI are roadmap.

### Phase 5: Executive Boardroom

Focus:

- Multi-agent orchestration.
- Relevance filtering.
- Boardroom history.
- Shareable decision summaries.
- Platform-admin agent scope management.

Current status:

- Boardroom concept and some platform admin/AI-agent catalog foundations exist.
- Full customer Boardroom product is roadmap.

---

## Infrastructure and Cost Model

Bantu Niaga is designed for low fixed infrastructure cost at launch.

Expected infrastructure profile:

- Vercel handles the Next.js frontend, route handlers, previews, and edge delivery.
- Supabase provides Postgres, Auth, Storage, Realtime, RLS, and managed database operations.
- OpenAI GPT-4o-mini keeps AI variable cost low.
- Resend handles email.
- Billplz/Curlec are planned for billing and payments.

Indicative fixed-cost stages from current docs:

| Stage | Paying users | Vercel | Supabase | Other | Indicative total |
| --- | ---: | --- | --- | --- | ---: |
| MVP | 0-100 | Free/Hobby | Free | Domain/email baseline | ~RM10/month |
| Growth | 100-1,000 | Pro | Pro | Email/logging | ~RM220/month |
| Scale | 1,000-10,000 | Pro/Team path | Supabase Team | Higher usage | ~RM720/month |

AI variable cost is expected to be small per active user if structured triggers hold. The current model assumes AI cost in the range of sen per user per month for summaries and controlled Boardroom usage. The key margin safeguard is to avoid open-ended free chat and keep every AI action tied to a bounded schema and credit cost.

Salaries, sales, support, legal, accounting, content, and founder time are operating expenses and are not included in the infrastructure cost model.

---

## Success Metrics

Bantu Niaga should be measured across activation, retention, revenue, reliability, and operational quality.

Recommended product metrics:

- Activation rate: percentage of new businesses that complete onboarding and create a first meaningful record within 7 days.
- First-value milestones: first invoice, first customer import, first content plan, first broadcast, first coupon, first staff record, first file upload.
- Weekly active businesses.
- Monthly retained businesses.
- Module adoption per tier.
- Add-on attach rate by day 30 and day 90.
- AI adoption rate among paying users.
- Boardroom runs per eligible account.
- Average support tickets per 100 active accounts.
- Time-to-complete mobile hot paths such as POS sale, invoice send, expense capture, and task update.

Recommended business metrics:

- MRR and ARR.
- ARPU by tier.
- Conversion from Free to Plus/Growth/Pro.
- Churn by tier and vertical.
- Gross margin by account.
- Cost per activated account.
- Referral conversion rate.
- CAC payback once paid acquisition begins.

Recommended technical metrics:

- Uptime target: 99.9%.
- API p95 latency.
- Error rate by route group.
- AI token cost per business.
- Supabase DB usage and RLS policy coverage.
- Storage usage per tenant.
- Failed webhook/integration smoke tests.
- Privacy/DSR SLA performance.

---

## Key Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| RBAC or RLS bug leaks tenant/role data | Very high | Defense in depth through `business_id`, RLS, API gates, UI gates, role tests, audit logs |
| LHDN/MyInvois schema changes | High | Versioned export path, advisor review, modular connector, avoid hardcoding brittle compliance assumptions |
| Adoption friction among low-tech owners | High | Mobile-first flows, WhatsApp CTAs, founder-led onboarding, demo data, BM-friendly copy |
| Platform integration dependency risk | Medium/high | Integrations registry, smoke tests, clear fallback modes, do not block core operations on optional integrations |
| Meta/TikTok/WhatsApp API review delays | Medium | Keep click-to-chat and manual-post planning as core; defer full automation until credentials/app review are ready |
| AI cost or quality drift | Medium | Strict JSON Schema, credit accounting, token caps, Slow Mode, usage logs, AI context snapshots |
| Deployment branch/config mistakes | Medium | Deploy production from `main`, align Vercel env, use health checks, document branch policy |
| Sensitive HR/finance records mishandled | High | Signed URLs, private buckets, sensitive flags, encryption roadmap, role-limited access |
| Pricing confusion from older docs | Medium | Founder-approved packaging decision before public launch; proposal states current baseline and caveat |
| Scope creep across six modules | High | Phase-based roadmap, ship practical loops first, keep add-ons deferred until validated |

---

## Deployment and Operations

Bantu Niaga's operational model should be simple enough for a lean founding team.

Deployment:

- Vercel hosts the Next.js app.
- Supabase hosts Postgres, Auth, Storage, Realtime, and migrations.
- Production branch should be `main`.
- Preview deployments should be used for feature verification.
- Environment variables must be managed per environment and never committed.

Runtime operations:

- Use Supabase migrations as the source of database truth.
- Keep RLS enabled for tenant tables.
- Use platform integrations registry for API keys where possible.
- Use smoke tests for OpenAI, Resend, Meta, WhatsApp Cloud, Billplz, and future integrations.
- Use health checks to detect DB/API degradation.
- Monitor privacy sweep, event outbox retries, and webhook failures.

Support operations:

- Platform admin app enables tenant/user overview, impersonation, marketplace status, AI agent scope, audit log, data monitor, and investor metrics.
- Impersonation should remain read-first unless explicitly enabled for support writes.
- Support actions should be audited.

Current operational caveats:

- Some integrations require real credentials and external approvals before production use.
- Public coupon landing pages are pending if the product wants a customer-facing campaign link beyond WhatsApp/email messages.
- Meta App Review and WhatsApp Cloud API work remain separate from the current click-to-chat baseline.
- Vercel production branch alignment should be corrected and documented.

---

## Current Implementation Snapshot

This repository contains a live implementation, not only documentation.

Current shipped/high-confidence areas:

- Next.js 15 App Router and React 19 app foundation.
- Tailwind CSS UI system and adaptive desktop/mobile shell.
- Supabase Auth, Postgres, Storage, RLS-oriented migrations, and Realtime-ready architecture.
- Tier entitlements for Free, Plus, Growth, and Pro.
- Six-role permissions matrix.
- Platform admin app with users, businesses, marketplace, AI agents, audit, and investor/data monitor surfaces.
- Marketplace catalog and add-on activation model.
- PDPA privacy/export/delete/consent architecture.
- Platform integrations registry with encrypted credentials and smoke-test pattern.
- AI tenant isolation and briefing-packet architecture.
- Admin Digital Storage with private bucket, signed URLs, RLS, soft-delete, and 100 MB cap.
- Marketing CRM, content, segments, broadcasts, coupons, media uploader, migrations, API surfaces, UI, and tests.
- Meta social integration architecture for Facebook/Instagram OAuth, publishing, and insights.
- Demo seed for realistic tenant/customer/content data.

Known pending or not-yet-complete areas:

- Full Sales CRM and POS.
- Full HR registry, leave, public holiday, onboarding, and document generation implementation.
- Full Operations workflow including booking and stock/product integrations.
- Full Finance ledger/invoice/LHDN/payment gateway implementation.
- Payment Gateway Connector with Billplz/Curlec webhooks.
- Public coupon landing page.
- Meta App Review and production credentials for full social publishing.
- WhatsApp Cloud API automation.
- Full customer-facing AI agents and Executive Boardroom.
- Final commercial pricing approval.
- Production Vercel branch correction if not yet fixed in deployment settings.

Verification caveat:

- Historical changelog notes include prior `npx tsc --noEmit` and `npm run build` success for the platform hardening pass.
- This proposal does not claim a fresh full build/test run for the latest repository state; it summarizes known implementation state from docs, migrations, package metadata, and recent commits.

---

## Appendix A: Glossary

| Term | Meaning |
| --- | --- |
| Bantu Niaga | Unified AI Business Operating System for Malaysian micro-SMEs |
| Micro-SME | Small, owner-operated business, often 1-20 staff |
| Dual-mode | Desktop ERP control layer plus Mobile PWA execution layer |
| Pillar/module | One of Admin, Finance, Operations, Marketing, Sales, HR |
| `business_id` | Internal tenant identifier used for database scoping |
| `idcompany` | Public business slug used in secure URLs |
| RLS | Row-Level Security in Supabase/Postgres |
| RBAC | Role-Based Access Control |
| Secure hash URL | Non-guessable public link for invoice, booking, leave, document, or other shared surfaces |
| AI Agent | Per-pillar structured assistant with scoped data and bounded outputs |
| Executive Boardroom | Multi-agent decision surface for cross-pillar questions |
| Fast Credits | Monthly AI credits used for structured AI actions |
| Slow Mode | Delayed AI mode when credits run out, preserving access without encouraging abuse |
| PDPA | Malaysia Personal Data Protection Act |
| LHDN/MyInvois | Malaysian tax/e-invoicing authority and e-invoice system |

---

## Appendix B: Module Matrix

| Module | Core value | Built/current | Roadmap |
| --- | --- | --- | --- |
| Admin | Documents, storage, tasks, notifications | Storage shipped | Templates, compliance calendar, notification depth |
| Finance | Ledger, invoices, payments, LHDN readiness | Tier foundation and docs | Full ledger, invoices, LHDN, gateway connector |
| Operations | Orders, suppliers, products, bookings | Shell/tier/docs | Product/booking/order workflows, stock |
| Marketing | CRM, content, cohorts, campaigns | v1.1 shipped | Public coupon pages, deeper automation, Meta review |
| Sales | Leads and POS | POS coupon plumbing | Full CRM/POS/payment/refunds |
| HR | Staff records and leave | Shell/tier/docs | Registry, leave, holidays, rota, payroll add-ons |

---

## Appendix C: Technology Stack Table

| Area | Detail |
| --- | --- |
| App | Next.js 15 App Router |
| UI | React 19 |
| Styling | Tailwind CSS |
| Data validation | Zod |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Storage | Supabase Storage private buckets |
| Realtime/events | Supabase Realtime plus event outbox pattern |
| Backend APIs | Next.js Route Handlers |
| Longer jobs | Supabase Edge Functions |
| Hosting | Vercel |
| AI | OpenAI GPT-4o-mini |
| Email | Resend and Supabase Auth email |
| Payments | Billplz primary, Curlec fallback planned |
| Social | Meta Graph architecture; TikTok/WhatsApp planned |
| Compliance | PDPA flows, LHDN/SST roadmap |
| Tests | Vitest and Testing Library present in package scripts/dependencies |

---

## Appendix D: Open Decisions

Commercial:

- Final public pricing and naming: Free/Plus/Growth/Pro versus Starter/Micro/SME language.
- Trial duration, annual prepay discount, seat overage pricing, and multi-business pricing.
- Which add-ons are bundled into tiers versus sold separately.
- Exact AI agent pricing and credit top-up ladder.

Product:

- Whether Marketing should remain Pro-only or be introduced earlier as a growth wedge.
- Final list of Admin document templates.
- Full public coupon landing page scope.
- How much POS functionality ships before payment gateway integration.
- Whether statutory payroll is an HR add-on or later enterprise feature.

Technical:

- Whether to keep Supabase JS only or add Drizzle for complex queries.
- Observability stack beyond Vercel/Supabase logs and Sentry.
- AI failover provider strategy.
- Long-term migration path if Supabase Team is outgrown.
- Session strategy if role/business claims move into JWT custom claims at scale.

Compliance and operations:

- LHDN advisor process for schema changes.
- Retention policy for event outbox and audit logs.
- Encryption scheme details for IC numbers and bank accounts.
- Production branch policy and deployment release checklist.

---

## Closing Case

Bantu Niaga is credible because it starts from how Malaysian micro-SMEs actually operate: phone-first, WhatsApp-heavy, cashflow-sensitive, compliance-aware, and resource-constrained. Its differentiation is not a single feature, but the integrated operating model: six business modules, one tenant-scoped database, secure sharing, role-based access, practical marketing action loops, and a structured AI layer that becomes more valuable as the business records more of its work.

The investment opportunity is to turn that operating model into the default business system for the long tail of Malaysian micro-SMEs. The product already has meaningful foundations and shipped modules; the next milestone is commercial packaging, early customer pilots, completion of Sales/Finance/Operations/HR loops, and disciplined deployment operations.
