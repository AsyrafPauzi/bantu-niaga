# Sales Phase B Leads — Implementation Plan

> **For agentic workers:** Implement task-by-task. Spec: `docs/superpowers/specs/2026-07-11-sales-leads-phase-b-design.md`

**Goal:** Ship lead list, notes, follow-up filters, assignment, and convert-to-Marketing-customer.

**Architecture:** `sales_leads` + `sales_lead_notes` with RLS; Next.js API routes; list + detail UI; convert links/creates Marketing customer by phone (always link on phone match).

**Tech Stack:** Supabase Postgres/RLS, Zod, Next.js App Router

---

## Tasks

- [x] Migration `sales_leads` + `sales_lead_notes` + RLS
- [x] `lib/sales` access, schemas, convert helper
- [x] APIs: list/create, get/patch, notes, convert
- [x] UI: `/sales/leads` list + `/sales/leads/[id]` detail
- [x] Checklist + guide polish; `supabase db push`; typecheck
