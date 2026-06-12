# Marketplace Add-ons — Master Catalog

> Every paid upgrade in BantuNiaga, in one place. Prices are monthly add-ons on top of the Base Subscription.

## How the Marketplace Works

- Every account has all six **Base Packages** included.
- The Marketplace is a switchboard inside the dashboard — owners enable an add-on with one tap, billing prorates.
- Add-ons are scoped to **a single business account**; they don't transfer.
- Storage tiers are **mutually exclusive** (one tier active at a time); all other add-ons are independent.

## Full Catalog

| Pillar | Add-on | Price (RM/mo) | Summary |
|--------|--------|--------------:|---------|
| Admin | Custom Document Builder | 15 | Drag-and-drop visual editor: customize core text, sections, branding, build templates from scratch. |
| Admin | Storage Tier — 5 GB | 5 | Raises storage cap from 1 GB to 5 GB. |
| Admin | Storage Tier — 20 GB | 15 | Raises storage cap to 20 GB. |
| Finance | Full Ledger Analytics Suite | 25 | Balance Sheet, multi-account reconciliations, structural P&L reports. |
| Finance | LHDN Tax & E-Invoicing Exporter | 35 | XML schemas for Malaysian e-invoicing; Form B / Form P mapping. |
| Operations | Micro Stock Tracker & Low-Stock Alarms | 20 | Auto-decrements stock on paid invoices; alerts when below safety line. |
| Marketing | Smart Link Tracker (UTM) | 15 | Generates UTM-tagged links; trace traffic per source/campaign. |
| Marketing | Promo Engine & WhatsApp Script Templates | 20 | Builds discounts + ready-to-paste WhatsApp scripts. |
| Sales | Stale Deal & Detail Alarms | 15 | Alerts when premium leads stay uncontacted > 48 hours. |
| Sales | Hardware & Advanced POS Extensions | 25 | Thermal printer pairing, barcode scanning, table maps, offline cache. |
| HR | Shift Rota Scheduler | 20 | Drag-and-drop weekly shift planner. |
| HR | Self-Service Mobile Leave Forms | 25 | Public secure leave-request URL + auto email on Approve/Reject. |

## Bundles (Suggested)

These are recommended combinations — not enforced bundles. They're useful as sales talking points.

### "Retail Starter" — RM 60/mo of add-ons
For a small kedai runcit or convenience store.

- Micro Stock Tracker (RM20)
- Hardware & POS Extensions (RM25)
- Storage 5 GB (RM5)
- Stale Deal Alarms (RM15) — optional if owner has B2B side

### "Compliance Pack" — RM 60/mo
For a growing business that needs to be LHDN-ready.

- Full Ledger Analytics Suite (RM25)
- LHDN E-Invoicing Exporter (RM35)

### "Growth Marketing" — RM 35/mo
For online sellers leaning on TikTok/IG.

- Smart Link Tracker (RM15)
- Promo Engine & WA Templates (RM20)

### "People Ops" — RM 45/mo
For a 5–15 person team.

- Shift Rota Scheduler (RM20)
- Self-Service Leave Forms (RM25)

### "Bespoke Branding" — RM 30/mo
For service businesses (consultants, agencies, contractors).

- Custom Document Builder (RM15)
- Storage 20 GB (RM15)

## Add-on Dependencies & Interactions

A few add-ons enrich each other or interlock with Base features. These are worth noting in onboarding flows:

| Add-on | Depends on / Enriches |
|--------|------------------------|
| Micro Stock Tracker | Finance → Invoice (Paid event triggers decrement); Operations → Product Manager (must have SKUs). |
| LHDN Exporter | Finance → Invoice ledger; recommended pairing with Full Ledger Analytics. |
| Self-Service Leave Forms | HR → Core Registry (Staff IDs); Admin → Storage (MC photo uploads); Admin → Notifications. |
| Hardware & POS Extensions | Sales → POS; Operations → Product Manager (barcodes / SKUs). |
| Promo Engine | Marketing → Customer CRM (for targeting). |
| Smart Link Tracker | Independent — but ROI shows best when paired with Promo Engine. |

## Activation / Deactivation Rules

- **Activation:** prorated for the current billing cycle; feature unlocks immediately.
- **Deactivation:** access remains until the end of the paid period; feature locks at next cycle.
- **Data retention on deactivation:**
  - Custom Document Builder → custom templates stay read-only; can be re-activated to edit.
  - Storage downgrades → uploads block if over the new cap; existing files remain accessible read-only until usage drops below the cap. (Final policy: see Open Questions in Admin pillar.)
  - LHDN Exporter → previously generated XMLs remain downloadable; no new generation.
  - Stock Tracker → stock counts freeze at last value; no auto-decrement.
